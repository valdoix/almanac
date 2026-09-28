// Chronicle: summarise scenes → chapters → arcs → volumes, hide covered turns,
// and splice summaries into the prompt exactly where the turns used to be.
// Boundaries are narrative (from the ledger's scene log), not message counts.

import type { PathMessage } from "./branch";
import type { LedgerEvent, WorldState } from "./types";
import { estTokens, fmtTime, fromAbs, hash, plainProse, uid } from "./util";

export type ChronicleLevel = "chapter" | "arc" | "volume";

export interface ChronicleUnit {
  id: string;
  level: ChronicleLevel;
  no: number;
  title: string;
  startIdx: number;
  endIdx: number; // inclusive message index
  msgIds: string[];
  signature: string; // hash of (id, swipe, content) over the span
  text: string;
  storyStart?: string;
  storyEnd?: string;
  place?: string;
  children?: string[]; // unit ids this supersedes
  createdAt: number;
  locked?: boolean;
  ghost?: boolean;
  stale?: boolean;
  /** The summary detail setting it was written at. */
  detail?: string;
}

export interface ChronicleStore {
  units: ChronicleUnit[];
  hidden: string[]; // message ids we hid
  version: number;
}

export function emptyChronicle(): ChronicleStore {
  return { units: [], hidden: [], version: 1 };
}

export interface ChronicleSettings {
  rawTail: number;
  rawTailTokens: number;
  chapterThresholdTokens: number;
  fanIn: number;
}

export function spanSignature(path: PathMessage[], startIdx: number, endIdx: number): string {
  return hash(path.filter((m) => m.index >= startIdx && m.index <= endIdx).map((m) => `${m.id}:${m.swipe}:${hash(m.content)}`).join("|"));
}

/** Mark units whose covered messages changed (edit, delete, swipe) as stale. */
export function validateUnits(store: ChronicleStore, path: PathMessage[]): ChronicleUnit[] {
  const stale: ChronicleUnit[] = [];
  for (const u of store.units) {
    const ok = spanSignature(path, u.startIdx, u.endIdx) === u.signature && u.msgIds.every((id) => path.some((m) => m.id === id));
    if (!ok && !u.stale) stale.push(u);
    u.stale = !ok;
  }
  return stale;
}

/** Highest non-stale, non-ghost unit covering each message index. */
export function coverageMap(store: ChronicleStore): Map<number, ChronicleUnit> {
  const rank = { chapter: 1, arc: 2, volume: 3 } as const;
  const map = new Map<number, ChronicleUnit>();
  for (const u of store.units) {
    if (u.stale || u.ghost) continue;
    for (let i = u.startIdx; i <= u.endIdx; i++) {
      const cur = map.get(i);
      if (!cur || rank[u.level] > rank[cur.level]) map.set(i, u);
    }
  }
  return map;
}

export interface ChronicleJob {
  level: ChronicleLevel;
  startIdx: number;
  endIdx: number;
  msgIds: string[];
  children: ChronicleUnit[];
  scenes: number;
}

/** Decide the next summarisation job, if any. */
export function planChronicle(path: PathMessage[], state: WorldState, store: ChronicleStore, s: ChronicleSettings): ChronicleJob | null {
  if (path.length < s.rawTail + 4) return null;
  // Raw tail: never summarised. The last rawTail messages, cut short by the token cap
  // when they are long (whichever keeps less), but never fewer than 6.
  let tailStart = path.length - s.rawTail;
  let tok = 0;
  for (let i = path.length - 1; i >= 0; i--) {
    tok += estTokens(path[i].content);
    if (tok > s.rawTailTokens) {
      tailStart = Math.max(tailStart, i + 1);
      break;
    }
  }
  tailStart = Math.min(tailStart, path.length - 6);
  const tailIdx = path[Math.max(0, tailStart)]?.index ?? Infinity;

  // Arcs and volumes first (cheap, from existing text)
  for (const [lower, upper] of [["chapter", "arc"], ["arc", "volume"]] as const) {
    const open = store.units.filter((u) => u.level === lower && !u.stale && !store.units.some((p) => p.level === upper && !p.stale && p.children?.includes(u.id))).sort((a, b) => a.startIdx - b.startIdx);
    if (open.length >= s.fanIn) {
      const group = open.slice(0, s.fanIn);
      return { level: upper, startIdx: group[0].startIdx, endIdx: group[group.length - 1].endIdx, msgIds: group.flatMap((g) => g.msgIds), children: group, scenes: 0 };
    }
  }

  // Chapters: consecutive completed scenes before the tail, starting after the last chapter.
  const lastCovered = Math.max(-1, ...store.units.filter((u) => u.level === "chapter" && !u.stale).map((u) => u.endIdx));
  const scenes = state.sceneLog.filter((sc) => sc.startMsg > lastCovered);
  const firstIdx = path.find((m) => m.index > lastCovered)?.index;
  if (firstIdx == null) return null;
  // scene spans: [startMsg, nextStart-1]
  const spans: { start: number; end: number }[] = [];
  const starts = [firstIdx, ...scenes.map((sc) => sc.startMsg).filter((x) => x > firstIdx)];
  for (let i = 0; i < starts.length; i++) {
    const end = (starts[i + 1] ?? Infinity) - 1;
    if (end >= tailIdx) break; // scene not complete before the tail
    spans.push({ start: starts[i], end });
  }
  if (!spans.length) return null;
  let take = 0;
  let tokens = 0;
  for (const sp of spans) {
    take++;
    tokens += path.filter((m) => m.index >= sp.start && m.index <= sp.end).reduce((a, m) => a + estTokens(m.content), 0);
    if (take >= 3 || tokens >= s.chapterThresholdTokens) break;
  }
  if (take < 3 && tokens < s.chapterThresholdTokens) {
    // Force progress if a single scene is enormous or the uncovered span is long.
    const uncovered = path.filter((m) => m.index > lastCovered && m.index < tailIdx);
    if (uncovered.reduce((a, m) => a + estTokens(m.content), 0) < s.chapterThresholdTokens * 1.5) return null;
  }
  const startIdx = spans[0].start;
  const endIdx = spans[take - 1].end;
  const msgIds = path.filter((m) => m.index >= startIdx && m.index <= endIdx).map((m) => m.id);
  return { level: "chapter", startIdx, endIdx, msgIds, children: [], scenes: take };
}

/**
 * Render the covered raw turns for the summariser (display markup stripped). A world card's replies
 * are the narrator's, not a person called after the place, so `narrator` relabels them.
 */
export function transcriptFor(path: PathMessage[], job: ChronicleJob, userName: string, charName: string, narrator = false): string {
  const who = (m: PathMessage) => (m.isUser ? userName : narrator && (!m.name || m.name === charName) ? "Narrator" : m.name || charName);
  return path
    .filter((m) => m.index >= job.startIdx && m.index <= job.endIdx)
    .map((m) => `${who(m)}: ${plainProse(m.content)}`)
    .filter((l) => l.trim().length > 3)
    .join("\n\n");
}

/** Every accepted event with salience ≥ 0.5 must have its subject mentioned. */
export function coverageGaps(summary: string, events: LedgerEvent[], state: WorldState, startIdx: number, endIdx: number): string[] {
  const s = summary.toLowerCase();
  const needed = new Map<string, string>();
  for (const e of events) {
    if (e.verdict === "rejected" || e.msgIndex < startIdx || e.msgIndex > endIdx) continue;
    const op = e.op;
    const important =
      (op.op === "bond" && (op.args.changes ?? []).some((c: any) => Math.abs(c.delta) >= 2)) ||
      op.op === "know" || op.op === "reveal" || op.op === "secret" || op.op === "thread" || op.op === "owe" || op.op === "cons" || op.op === "ladder" ||
      (op.op === "item" && op.args.from) || (op.op === "body" && ((op.args.injuries ?? []).length || (op.args.flags ?? []).includes("dead"))) ||
      op.op === "artifact" || op.op === "clue";
    if (!important) continue;
    const subj = op.subject ?? "";
    const name = subj && state.chars[subj.toLowerCase()] ? state.chars[subj.toLowerCase()].name : subj;
    const label = `${name}${op.object ? " → " + op.object : ""}: ${op.raw.replace(/^\S+\s*/, "").slice(0, 90)}`;
    const keyWord = (op.op === "item" || op.op === "thread" || op.op === "artifact" ? subj : name).toLowerCase().split(/\s+/)[0];
    if (keyWord && !s.includes(keyWord)) needed.set(label, label);
  }
  return [...needed.values()].slice(0, 8);
}

export function makeUnit(job: ChronicleJob, text: string, path: PathMessage[], state: WorldState, store: ChronicleStore): ChronicleUnit {
  const no = store.units.filter((u) => u.level === job.level).length + 1;
  const sceneStarts = state.sceneLog.filter((s) => s.startMsg >= job.startIdx && s.startMsg <= job.endIdx);
  const firstAbs = sceneStarts.find((s) => s.startAbs != null)?.startAbs;
  const lastAbs = [...sceneStarts].reverse().find((s) => s.startAbs != null)?.startAbs;
  const titleLine = /^\s*(?:title|#)\s*:?\s*(.+)$/im.exec(text)?.[1]?.trim();
  return {
    id: uid(job.level[0]),
    level: job.level,
    no,
    title: titleLine?.slice(0, 80) || sceneStarts.find((s) => s.title)?.title || `${cap(job.level)} ${no}`,
    startIdx: job.startIdx,
    endIdx: job.endIdx,
    msgIds: job.msgIds,
    signature: spanSignature(path, job.startIdx, job.endIdx),
    text: text.replace(/^\s*(?:title|#)\s*:?\s*.+$/im, "").trim(),
    storyStart: firstAbs != null ? fmtTime(fromAbs(firstAbs)) : undefined,
    storyEnd: lastAbs != null ? fmtTime(fromAbs(lastAbs)) : undefined,
    place: sceneStarts[0]?.place,
    children: job.children.map((c) => c.id),
    createdAt: Date.now(),
  };
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}

export function unitHeader(u: ChronicleUnit): string {
  const when = u.storyStart ? ` · ${u.storyStart}${u.storyEnd && u.storyEnd !== u.storyStart ? ` – ${u.storyEnd}` : ""}` : "";
  return `[${cap(u.level)} ${u.no}: ${u.title}${when}${u.place ? ` · ${u.place}` : ""}]`;
}

export interface SpliceMessage {
  role: "system" | "user" | "assistant";
  content: any;
  __isChatHistory?: boolean;
  sourceMessageId?: string;
  sourceIndexInChat?: number;
  [k: string]: any;
}

/**
 * Drop chat-history turns covered by a chronicle unit, and put `units` (the
 * summaries chosen for this turn) where those turns were, in story order: each
 * one before the first visible turn that comes after it. Covered turns are
 * usually hidden, so the host has already left them out; the summaries still go
 * in, or the model would never see the story before the raw tail.
 */
export function splice<T extends SpliceMessage>(messages: T[], store: ChronicleStore, idToIndex: Map<string, number>, units: ChronicleUnit[]): { messages: T[]; injected: { index: number; name: string }[]; dropped: number } {
  const cover = coverageMap(store);
  if (!cover.size && !units.length) return { messages, injected: [], dropped: 0 };
  const pending = [...units].sort((a, b) => a.startIdx - b.startIdx);
  const out: T[] = [];
  const injected: { index: number; name: string }[] = [];
  const flush = (before: number) => {
    while (pending.length && pending[0].endIdx < before) {
      const u = pending.shift()!;
      out.push({ role: "system", content: `${unitHeader(u)}\n${u.text}` } as T);
      injected.push({ index: out.length - 1, name: `ALMANAC · ${cap(u.level)} ${u.no}` });
    }
  };
  let dropped = 0;
  let lastHistory = -1;
  for (const m of messages) {
    const idx = m.__isChatHistory ? (m.sourceIndexInChat ?? (m.sourceMessageId ? idToIndex.get(m.sourceMessageId) : undefined)) : undefined;
    if (idx != null && cover.has(idx)) {
      dropped++;
      continue;
    }
    if (idx != null) flush(idx);
    out.push(m);
    if (m.__isChatHistory) lastHistory = out.length - 1;
  }
  if (pending.length) {
    // Nothing visible after them: put them at the end of the chat history.
    const tail = out.splice(lastHistory + 1);
    flush(Infinity);
    out.push(...tail);
  }
  return { messages: out, injected, dropped };
}

// ---------------------------------------------------------------------------
// Which summaries go in the prompt
// ---------------------------------------------------------------------------

export type ChronicleInjection = "all" | "relevant";

/** The whole story so far, once: the coarsest live unit for each stretch, in order. */
export function storySoFar(store: ChronicleStore): ChronicleUnit[] {
  return [...new Set(coverageMap(store).values())].sort((a, b) => a.startIdx - b.startIdx);
}

/** The finest live unit for each stretch (the chapters, where they survive), in order. */
export function finestUnits(store: ChronicleStore): ChronicleUnit[] {
  const rank = { chapter: 1, arc: 2, volume: 3 } as const;
  const map = new Map<number, ChronicleUnit>();
  for (const u of store.units) {
    if (u.stale || u.ghost) continue;
    for (let i = u.startIdx; i <= u.endIdx; i++) {
      const cur = map.get(i);
      if (!cur || rank[u.level] < rank[cur.level]) map.set(i, u);
    }
  }
  return [...new Set(map.values())].sort((a, b) => a.startIdx - b.startIdx);
}

/** Text the current turn is about, weighted: the player's message counts most. */
export interface ChronicleQuery {
  player: string;
  lastReply: string;
  /** Place, who is present, open threads. */
  scene: string;
  /** Things the story tracks (people, places, objects, threads), each with every name it goes by. */
  entities?: string[][];
  /** The chat's messages: a word most of them use is not rare, however few summaries use it. */
  background?: string[];
}

const STOP = new Set(
  ("that this with from have were they them their there what when where which while would could should about into your just been then than like over only some back down still even more very will said says tell told know knows going being because through before after again other each those these here make made look looks looked asks asked turn turns hand hands eyes face voice head something nothing thing things want wants away around across against also another anything every everything maybe really right left little long much must never next once open other perhaps quite same seems since sure take takes took think thought though toward under until upon well went whole without yeah okay mean means come comes came gets give gives gave keep kept last let's lets while inside outside enough almost already always behind beside between both during either else ever first half later least less many most near off onto own part past second several shall should side small soon such their theirs there's they're three time times today tonight too two unless whom whose why yes yet your yours").split(" "),
);

function terms(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}']+/u)) {
    const w = raw.replace(/^'+|'+$/g, "").replace(/'s$/, "");
    if (w.length < 4 || STOP.has(w) || /^\d+$/.test(w)) continue;
    out.add(w.length > 5 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * How much each unit has to do with this turn. Two signals:
 * - Names: a person, place, object or thread the turn mentions (the player's
 *   message, the scene, or the last reply) that the summary mentions too.
 * - Rare words from the player's message that few summaries use.
 * Both are weighted by how few units share them, and anything in more than half
 * the units is ignored: the lead, the player's character and the home they share
 * say nothing about which chapter matters. Ordinary prose words from the model's
 * long replies are left out, because every summary is full of them.
 */
export function scoreUnits(units: ChronicleUnit[], q: ChronicleQuery): { unit: ChronicleUnit; score: number; matched: string[] }[] {
  if (!units.length) return [];
  const n = units.length;
  const texts = units.map((u) => `${u.title}\n${u.place ?? ""}\n${u.text}`);
  const idf = (df: number) => (df > 0 && df <= n / 2 ? Math.log((n + 1) / df) : 0);
  const scores = units.map(() => ({ score: 0, matched: [] as string[] }));

  // Names the turn mentions, by the strongest place it mentions them. The scene
  // (who is here, where) counts least: it is the same turn after turn.
  const segs = [[q.player, 3], [q.lastReply, 2], [q.scene, 1]] as const;
  for (const names of mergeNames(q.entities ?? [])) {
    // A name written with a capital is matched with one ("Will" the person, not "will");
    // aliases that are ordinary words are dropped.
    const alts = [...new Set(names.map((s) => s.trim()).filter((s) => s.length >= 3 && !STOP.has(s.toLowerCase())))].sort((a, b) => b.length - a.length);
    if (!alts.length) continue;
    const bound = (x: string) => `(?<![\p{L}\p{N}])${escapeRe(x)}(?![\p{L}\p{N}])`;
    const proper = alts.filter((x) => /^\p{Lu}/u.test(x));
    const plain = alts.filter((x) => !/^\p{Lu}/u.test(x));
    const res = [proper.length ? new RegExp(proper.map(bound).join("|"), "u") : null, plain.length ? new RegExp(plain.map(bound).join("|"), "iu") : null].filter((r): r is RegExp => !!r);
    const has = (t: string) => res.some((r) => r.test(t));
    const w = Math.max(0, ...segs.filter(([t]) => t && has(t)).map(([, w]) => w));
    if (!w) continue;
    const hits = texts.map(has);
    const k = idf(hits.filter(Boolean).length) * w;
    if (!k) continue;
    hits.forEach((h, i) => {
      if (!h) return;
      scores[i].score += k;
      scores[i].matched.push(alts[0]);
    });
  }

  // Rare words in the player's own message (a horse, a burnt letter): rare in the
  // summaries and in the chat itself. Two are needed to count.
  const bags = texts.map((t) => terms(t));
  const df = new Map<string, number>();
  for (const b of bags) for (const w of b) df.set(w, (df.get(w) ?? 0) + 1);
  const rare = Math.max(1, Math.floor(n / 6));
  const mine = [...terms(q.player)].filter((t) => t.length >= 5 && !t.includes("'") && (df.get(t) ?? 0) > 0 && df.get(t)! <= rare);
  const bg = q.background ?? [];
  const bgDf = new Map(mine.map((t) => [t, 0]));
  for (const m of bg) for (const t of terms(m)) if (bgDf.has(t)) bgDf.set(t, bgDf.get(t)! + 1);
  const bgMax = Math.max(2, bg.length * 0.05);
  for (const t of mine) {
    const d = df.get(t)!;
    if (bgDf.get(t)! > bgMax) continue;
    const k = 1.5 * idf(d);
    bags.forEach((b, i) => {
      if (!b.has(t) || scores[i].matched.some((m) => m.toLowerCase().includes(t))) return;
      scores[i].score += k;
      scores[i].matched.push(t);
    });
  }
  return units.map((unit, i) => ({ unit, ...scores[i] }));
}

/** Joins entries that share a name (a person the story tracks and the same person in a lorebook). */
function mergeNames(entities: string[][]): string[][] {
  const groups: Set<string>[] = [];
  for (const names of entities) {
    const g = new Set(names.map((x) => x.trim()).filter(Boolean));
    const keys = new Set([...g].map((x) => x.toLowerCase()));
    for (let i = groups.length - 1; i >= 0; i--) {
      if (![...groups[i]].some((x) => keys.has(x.toLowerCase()))) continue;
      for (const x of groups[i]) g.add(x);
      groups.splice(i, 1);
    }
    groups.push(g);
  }
  return groups.map((g) => [...g]);
}

/** A unit is relevant with one rare name, or a few rare words, in common with the turn. */
const RELEVANT_SCORE = 4.5;
const RELEVANT_MAX = 3;
const ZOOM_MAX = 2;

/**
 * The summaries this turn's prompt carries, in story order.
 * - all: the whole story so far, at the coarsest level that covers each stretch,
 *   plus (in full) up to two chapters folded into an arc or volume that this turn touches.
 * - relevant: the latest summary (it leads into the turns the model can see), and
 *   up to three earlier chapters this turn touches.
 */
export function pickChronicle(store: ChronicleStore, mode: ChronicleInjection, q: ChronicleQuery): ChronicleUnit[] {
  if (mode === "all") return [...storySoFar(store), ...zoomCandidates(store, q)].sort((a, b) => a.startIdx - b.startIdx || rankOf(b) - rankOf(a));
  const fine = finestUnits(store);
  if (!fine.length) return [];
  const latest = fine[fine.length - 1];
  const picked = scoreUnits(fine.slice(0, -1), q)
    .filter((x) => x.score >= RELEVANT_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, RELEVANT_MAX)
    .map((x) => x.unit);
  return [...picked, latest].sort((a, b) => a.startIdx - b.startIdx);
}

const rankOf = (u: ChronicleUnit) => ({ chapter: 1, arc: 2, volume: 3 })[u.level];

/** Zoom-in (whole-story mode): chapters folded into an arc or volume that this turn touches. */
export function zoomCandidates(store: ChronicleStore, q: ChronicleQuery, limit = ZOOM_MAX): ChronicleUnit[] {
  const shown = new Set(storySoFar(store).map((u) => u.id));
  const chapters = store.units.filter((u) => u.level === "chapter" && !u.stale && !u.ghost);
  const folded = new Set(chapters.filter((u) => !shown.has(u.id)).map((u) => u.id));
  if (!folded.size) return [];
  return scoreUnits(chapters, q)
    .filter((x) => folded.has(x.unit.id) && x.score >= RELEVANT_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.unit);
}
