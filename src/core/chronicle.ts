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
  // Raw tail: never summarised (count and token cap, whichever keeps more raw text)
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

/** Render the covered raw turns for the summariser (display markup stripped). */
export function transcriptFor(path: PathMessage[], job: ChronicleJob, userName: string, charName: string): string {
  return path
    .filter((m) => m.index >= job.startIdx && m.index <= job.endIdx)
    .map((m) => `${m.isUser ? userName : m.name || charName}: ${plainProse(m.content)}`)
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
      op.op === "know" || op.op === "thread" || op.op === "owe" || op.op === "cons" || op.op === "ladder" ||
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
 * Drop chat-history turns covered by a chronicle unit and put the unit's text
 * where they were (flush each summary before the next visible message).
 */
export function splice<T extends SpliceMessage>(messages: T[], store: ChronicleStore, idToIndex: Map<string, number>): { messages: T[]; injected: { index: number; name: string }[]; dropped: number } {
  const cover = coverageMap(store);
  if (!cover.size) return { messages, injected: [], dropped: 0 };
  const out: T[] = [];
  const injected: { index: number; name: string }[] = [];
  const emitted = new Set<string>();
  let dropped = 0;
  for (const m of messages) {
    const idx = m.__isChatHistory ? (m.sourceIndexInChat ?? (m.sourceMessageId ? idToIndex.get(m.sourceMessageId) : undefined)) : undefined;
    const unit = idx != null ? cover.get(idx) : undefined;
    if (unit) {
      if (!emitted.has(unit.id)) {
        emitted.add(unit.id);
        out.push({ role: "system", content: `${unitHeader(unit)}\n${unit.text}` } as T);
        injected.push({ index: out.length - 1, name: `ALMANAC · ${cap(unit.level)} ${unit.no}` });
      }
      dropped++;
      continue;
    }
    out.push(m);
  }
  return { messages: out, injected, dropped };
}

/** Zoom-in: when a fact lies inside an arc/volume span, offer the finer chapter text. */
export function zoomCandidates(store: ChronicleStore, query: string, limit = 2): { id: string; title: string; text: string; score: number }[] {
  const cover = coverageMap(store);
  const coarse = new Set([...cover.values()].filter((u) => u.level !== "chapter").flatMap((u) => u.children ?? []));
  const words = new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3));
  if (!words.size) return [];
  return store.units
    .filter((u) => coarse.has(u.id) && !u.stale)
    .map((u) => {
      const t = u.text.toLowerCase();
      let hits = 0;
      for (const w of words) if (t.includes(w)) hits++;
      return { id: u.id, title: unitHeader(u), text: u.text, score: hits / words.size };
    })
    .filter((x) => x.score >= 0.34)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
