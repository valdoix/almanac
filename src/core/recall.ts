// Recall: hybrid, knowledge-aware retrieval into a budgeted block.
// Stages: query segments → candidates (keys, graph, temporal, semantic)
// (Chapters folded into an arc come back through the chronicle, not here.)
// → scoring → knowledge-perspective rendering → tiered compression to budget.

import type { CodexRecord } from "./codex";
import type { KeyHeat, KeyHit, KeyIndex } from "./keys";
import type { WorldState } from "./types";
import { absMinutes, estTokens, fmtSpan, fmtTime, slug, truncateTokens } from "./util";
import { normFact, overlap } from "./state";
import { lackOf, lackText, stanceVerb } from "./facts";
import { isOpen, parseHours, parseRoutine, routineAt } from "./engines/almanac";
import { isSchedule } from "./codex";
import { offPageHits, redact, type OffPage } from "./offpage";

export interface RecallInput {
  state: WorldState;
  records: CodexRecord[];
  index: KeyIndex;
  playerMsg: string;
  lastReply: string;
  recent: string[];
  semantic?: { recordId: string; score: number }[];
  heat?: Record<string, KeyHeat>;
  injectedHistory?: Record<string, number[]>; // recordId -> msgCounts when injected
  usedLastTurn?: Set<string>;
  leadGenre?: string;
  tier: "routine" | "charged" | "pivotal";
  budget: number;
  allowNarratorOnly: boolean;
  userName: string;
  /** Secrets kept off the page: a playbook that would spoil one stays out; their words are redacted. */
  offPage?: OffPage[];
}

export interface RecallItem {
  record: CodexRecord;
  score: number;
  reasons: string[];
  lane: "detail" | "document";
  text?: string;
}

export interface RecallResult {
  items: RecallItem[];
  text: string;
  tokens: number;
  feed: { id: string; name: string; score: number; reasons: string[]; injected: boolean }[];
  firedKeys: string[];
}

const GENRE_KINDS: Record<string, string[]> = {
  mystery: ["clue", "fact", "document"],
  romance: ["situation"],
  thriller: ["consequence", "group"],
  intrigue: ["group", "fact", "consequence"],
  horror: ["texture", "place"],
  fantasy: ["law", "texture"],
  adventure: ["place", "object"],
  noir: ["consequence", "group", "fact"],
  survival: ["object", "place"],
};

export function tierGuess(playerMsg: string, state: WorldState): "routine" | "charged" | "pivotal" {
  const t = playerMsg.toLowerCase();
  if (/\b(kill|attack|stab|shoot|kiss|confess|reveal|betray|die|run away|escape|fight|draw (my|a) (sword|gun|knife)|propose)\b/.test(t)) return "pivotal";
  const present = Object.values(state.chars).filter((c) => (c.tier === "spot" || c.tier === "peri") && !c.isUser).length;
  if (present >= 3 || /\b(lie|threat|negotiat|bargain|argue|accuse|touch|seduce|interrogat|demand)\b/.test(t) || state.mode === "conflict" || state.mode === "intimacy" || state.mode === "crisis") return "charged";
  return "routine";
}

export function recall(input: RecallInput): RecallResult {
  const { state, records } = input;
  const byId = new Map(records.map((r) => [r.id, r]));
  const now = state.time ? absMinutes(state.time) : null;
  const present = Object.values(state.chars).filter((c) => c.tier === "spot" || c.tier === "peri" || c.isUser).map((c) => c.id);
  const presentNpc = present.filter((id) => id !== "user");
  const here = state.place[state.place.length - 1];
  const hereId = here ? `loc:${slug(here)}` : null;
  const scores = new Map<string, { score: number; reasons: string[] }>();
  const bump = (id: string, v: number, why: string) => {
    if (!byId.has(id)) return;
    const s = scores.get(id) ?? { score: 0, reasons: [] };
    s.score += v;
    if (!s.reasons.includes(why)) s.reasons.push(why);
    scores.set(id, s);
  };

  // Stage 2a: key / alias hits, weighted by segment
  const fired: string[] = [];
  // A playbook (a scripted scene) is near only when this turn says two of its own words.
  const near = new Map<string, Set<string>>();
  const fromPlayer = new Map<string, Set<string>>();
  // Anyone's name is no sign a scene is near ("Willow" is in half the replies).
  const nameWords = new Set([
    ...Object.values(state.chars).flatMap((c) => [c.name, ...c.aliases]),
    ...records.filter((r) => r.kind === "person").flatMap((r) => [r.name, ...r.aliases]),
  ].flatMap((n) => n.toLowerCase().split(/\s+/)));
  const scan = (text: string, seg: string, w: number) => {
    if (!text) return;
    for (const h of input.index.match(text, seg) as KeyHit[]) {
      const hk = `${h.recordId}|${h.key}`;
      if (h.recordId.startsWith("play:") && !h.isName && (seg === "player" || seg === "last reply") && !nameWords.has(h.key.toLowerCase())) {
        near.set(h.recordId, (near.get(h.recordId) ?? new Set()).add(h.key.toLowerCase()));
        if (seg === "player") fromPlayer.set(h.recordId, (fromPlayer.get(h.recordId) ?? new Set()).add(h.key.toLowerCase()));
      }
      if (input.heat?.[hk]?.demoted && !h.isName) continue;
      fired.push(hk);
      bump(h.recordId, w * Math.min(2, h.count), `${seg}: “${h.key}”`);
    }
  };
  scan(input.playerMsg, "player", 10);
  scan(input.lastReply, "last reply", 6);
  scan(input.recent.join("\n"), "recent", 3);
  const frame = [state.place.join(" › "), ...presentNpc.map((id) => state.chars[id]?.name ?? ""), ...Object.values(state.threads).filter((t) => t.status !== "resolved").map((t) => t.title)].join(" · ");
  scan(frame, "scene", 4.5);

  // Stage 2b: graph expansion from present cast and place
  const hops = input.tier === "pivotal" ? 2 : 1;
  const frontier = new Set<string>([...presentNpc.map((id) => `char:${id}`), ...(hereId ? [hereId] : [])]);
  const seen = new Set(frontier);
  for (let h = 0; h < hops; h++) {
    const next = new Set<string>();
    for (const r of records) {
      for (const l of r.links) {
        if (frontier.has(l.to) && !seen.has(r.id)) {
          next.add(r.id);
          bump(r.id, h === 0 ? (l.to.startsWith("loc:") ? 4 : 5) : 2, h === 0 ? (l.to.startsWith("loc:") ? "linked to this place" : `linked to ${byId.get(l.to)?.name ?? l.to}`) : "2 hops from the scene");
        }
      }
      if (frontier.has(r.id)) for (const l of r.links) if (!seen.has(l.to)) next.add(l.to);
    }
    for (const n of next) seen.add(n);
    frontier.clear();
    for (const n of next) frontier.add(n);
  }

  // Stage 2c: temporal (due consequences, deadlines, routines, forecasts)
  for (const c of Object.values(state.cons)) {
    if (c.status !== "open" && c.status !== "due") continue;
    const due = c.due?.at ? absMinutes(c.due.at) : null;
    if (due != null && now != null && due - now <= 180) bump(c.id, 8, due <= now ? "overdue" : `due in ${fmtSpan(due - now)}`);
    else if (c.due?.trigger && overlap(normFact(c.due.trigger), normFact(`${input.playerMsg} ${frame}`)) > 0.3) bump(c.id, 8, "trigger in scene");
    if (present.includes(c.who) || (c.whom && present.includes(c.whom))) bump(c.id, 3, "holder present");
  }
  for (const r of records) {
    if (r.kind === "person" && typeof r.body.routine === "string" && now != null && here) {
      const slot = routineAt(parseRoutine(r.body.routine), now % 1440);
      if (slot && overlap(normFact(slot.place), normFact(here)) > 0.5 && !presentNpc.includes(r.id.slice(5))) bump(r.id, 6, `usually here now (${slot.activity ?? slot.place})`);
    }
    if (r.kind === "forecast" && r.status === "active") bump(r.id, 3, "upcoming");
    if (r.kind === "place" && typeof r.body.hours === "string" && r.id === hereId) bump(r.id, 4, "current place");
  }

  // Stage 2d: semantic (host vector hits on the mirror book)
  for (const s of input.semantic ?? []) bump(s.recordId, 6 * Math.max(0, Math.min(1, s.score)), `semantic ${s.score.toFixed(2)}`);

  // Salience, secrets, genre instruments, feedback, recency penalty
  for (const [id, s] of scores) {
    const r = byId.get(id)!;
    s.score += 4 * r.salience;
    if (r.kind === "fact") {
      // Someone here has it and someone here lacks it (with evidence): a slip would cost.
      const f = state.facts?.[r.body.key];
      const has = presentNpc.filter((p) => f?.stances[p] && f.stances[p].status !== "unaware");
      const lacks = f ? [...presentNpc, "user"].filter((p) => lackOf(state, f, p)) : [];
      if (has.length && lacks.length) {
        s.score += 3;
        s.reasons.push("someone here holds it that someone here lacks");
      }
    }
    if (input.leadGenre && (GENRE_KINDS[input.leadGenre] ?? []).includes(r.kind)) s.score += 2;
    if (input.usedLastTurn?.has(id)) s.score += 2;
    const hist = input.injectedHistory?.[id] ?? [];
    const recentInj = hist.filter((m) => state.msgCount - m <= 4).length;
    if (recentInj >= 2) {
      s.score -= 3;
      s.reasons.push("injected twice recently");
    }
    if (r.scope.narratorOnly && !input.allowNarratorOnly) s.score = -Infinity;
    if (r.kind === "playbook") {
      const spoils = offPageHits(`${r.name} ${r.summary}`, input.offPage ?? []).filter((x) => !new RegExp(`\\b${x.word}\\b`, "i").test(input.playerMsg));
      // Near: two of its own words this turn, at least one of them in the player's message.
      if (r.status !== "active" || (near.get(id)?.size ?? 0) < 2 || !fromPlayer.get(id)?.size || spoils.length) s.score = -Infinity;
      else s.reasons.push(`scene is near: ${[...near.get(id)!].join(", ")}`);
    }
    if (r.id === "char:user") s.score -= 5; // the player's card is already in the prompt
  }

  // Already-present characters' capsules live in the Now note; don't spend recall on bare person cards.
  for (const id of presentNpc) {
    const s = scores.get(`char:${id}`);
    if (s) s.score -= 6;
  }

  const ranked = [...scores.entries()]
    .map(([id, s]) => ({ record: byId.get(id)!, score: s.score, reasons: s.reasons }))
    .filter((x) => x.score > 5)
    .sort((a, b) => b.score - a.score);

  // Stage 5: render with tiered compression to budget
  const budget = Math.round(input.budget * (input.tier === "pivotal" ? 1.4 : 1));
  const items: RecallItem[] = [];
  let used = 0;
  const addItem = (item: RecallItem, tiers: string[]) => {
    for (const t of tiers) {
      const cost = estTokens(t);
      if (used + cost <= budget) {
        item.text = t;
        items.push(item);
        used += cost;
        return true;
      }
    }
    return false;
  };
  for (const x of ranked.slice(0, 40)) {
    const full = renderRecord(x.record, state, present, true, input.userName);
    const mid = renderRecord(x.record, state, present, false, input.userName);
    addItem({ ...x, lane: x.record.kind === "document" ? "document" : "detail" }, [full, mid, x.record.summary]);
    if (used >= budget) break;
  }
  // Anything that names an off-page secret is reworded before it reaches the model.
  if (input.offPage?.length) for (const i of items) if (i.text) i.text = redact(i.text, input.offPage);
  const text = items.length ? `<recall>\n${items.map((i) => i.text).join("\n")}\n</recall>` : "";
  const injected = new Set(items.map((i) => i.record.id));
  return {
    items,
    text,
    tokens: estTokens(text),
    firedKeys: [...new Set(fired)],
    feed: ranked.slice(0, 60).map((x) => ({ id: x.record.id, name: x.record.name, score: Math.round(x.score * 10) / 10, reasons: x.reasons, injected: injected.has(x.record.id) })),
  };
}

function nameOf(state: WorldState, id: string, userName: string): string {
  if (id === "user") return userName || "the player";
  return state.chars[id]?.name ?? id;
}

/** Knowledge-perspective rendering: the same record reads differently depending on who is in the room. */
export function renderRecord(r: CodexRecord, state: WorldState, present: string[], full: boolean, userName: string): string {
  const tag = r.scope.narratorOnly ? "[narrator-only] " : "";
  // A full card the player rewrote in the mirror lorebook stands as they wrote it.
  if (r.body.mirrorText && r.locked) return `${tag}${r.summary}`;
  const diverged = r.body.divergedNote ? ` [History — ${r.body.divergedNote}]` : "";
  switch (r.kind) {
    case "fact": {
      // Who here has it and how; who here lacks it, only with evidence (no record is not ignorance).
      const f = state.facts?.[r.body.key];
      const nm = (id: string) => nameOf(state, id, userName);
      const holders = ((r.body.holders ?? []) as { id: string; status: string; source?: string; truth?: string; version?: string }[]).filter((h) => h.status !== "unaware");
      const pres = holders.filter((h) => present.includes(h.id));
      const abs = holders.filter((h) => !present.includes(h.id));
      const lines = [`${tag}Fact${r.body.truth && r.body.truth !== "unknown" ? ` (${r.body.truth})` : ""}: ${r.name}.`];
      const verb = (h: (typeof holders)[number]) => (f?.stances[h.id] ? stanceVerb(f.stances[h.id], nm) : h.status);
      if (pres.length) lines.push(`  Present: ${pres.map((h) => `${nm(h.id)} (${verb(h)})`).join(", ")}.`);
      if (full && abs.length) lines.push(`  Absent holders: ${abs.map((h) => `${nm(h.id)} (${verb(h)})`).join(", ")}.`);
      const lacks = f ? present.map((p) => ({ p, r: lackOf(state, f, p) })).filter((x) => x.r) : [];
      if (lacks.length) lines.push(`  Lacking it: ${lacks.map((x) => `${nm(x.p)} (${lackText(x.r!)})`).join(", ")}.`);
      const wrong = pres.filter((h: any) => h.status === "wrong" || h.version || (h.status !== "knows" && (h.truth ?? r.body.truth) === "false"));
      const knowers = pres.filter((h) => h.status === "knows");
      if (wrong.length) lines.push(`  → Do not let ${wrong.map((h) => nm(h.id)).join(" or ")} act on the truth.`);
      else if (knowers.length && lacks.length) lines.push(`  → ${knowers.map((h) => nm(h.id)).join(", ")} may hint; ${lacks.map((x) => nm(x.p)).join(", ")} cannot act on it.`);
      return lines.join("\n");
    }
    case "document": {
      const text = String(r.body.text ?? "").trim();
      if (!text) return `${tag}${r.summary}`;
      return full ? `${tag}${r.summary}\n  Exact text: «${text}»` : `${tag}${r.summary} «${truncateTokens(text, 90)}»`;
    }
    case "person": {
      const b = r.body;
      const bits: string[] = [];
      if (b.fixed) bits.push(`always: ${b.fixed}`);
      if (b.status) bits.push(b.status);
      if (b.look) bits.push(`wearing: ${b.look}`);
      if (b.held?.length) bits.push(`holds: ${b.held.join(", ")}`);
      if (b.injuries?.length) bits.push(`injuries: ${b.injuries.map((i: any) => i.where).join(", ")}`);
      if (full && b.journal?.length) bits.push(`in their own words: “${b.journal[b.journal.length - 1].text}”`);
      if (full && b.routine && isSchedule(String(b.routine))) bits.push(`routine: ${b.routine}`);
      if (full && b.role) bits.push(b.role);
      if (full && b.archivist) bits.push(truncateTokens(String(b.archivist), 60));
      const lines = [`${tag}${r.summary}${bits.length ? " " + bits.join("; ") + "." : ""}${diverged}`];
      if (full && b.pressure && r.scope.narratorOnly !== false) lines.push(`  [narrator-only] Hidden pressure: ${b.pressure}. Show it only through behaviour.`);
      return lines.join("\n");
    }
    case "place": {
      const b = r.body;
      const bits: string[] = [];
      if (b.hours) {
        const h = parseHours(String(b.hours));
        const openNow = h && state.time ? isOpen(h, state.time.minute) : null;
        bits.push(`hours ${b.hours}${openNow === null ? "" : openNow ? " (open now)" : " (closed now)"}`);
      }
      if (full && b.customs) bits.push(`customs: ${[].concat(b.customs).join("; ")}`);
      if (full && b.routes) bits.push(`routes: ${[].concat(b.routes).map((x: any) => (typeof x === "string" ? x : `${x.to} ${x.minutes} min`)).join("; ")}`);
      if (full && b.secrets) bits.push(`[narrator-only] secrets: ${[].concat(b.secrets).map((x: any) => (typeof x === "string" ? x : `${x.fact} (sign: ${x.sign})`)).join("; ")}`);
      if (full && b.archivist) bits.push(truncateTokens(String(b.archivist), 60));
      return `${tag}${r.summary}${bits.length ? " " + bits.join("; ") + "." : ""}${diverged}`;
    }
    case "object": {
      const prev = r.body.previous as string[] | undefined;
      return `${tag}${r.summary}${full && prev?.length ? ` Previously held by ${prev.join(", ")}.` : ""}${full && r.body.archivist ? " " + truncateTokens(String(r.body.archivist), 50) : ""}${diverged}`;
    }
    case "thread": {
      const hist = (r.body.history ?? []) as { op: string; detail?: string }[];
      return `${tag}${r.summary}${full && hist.length > 1 ? ` Recent: ${hist.slice(-3).map((h) => `${h.op}${h.detail ? " (" + h.detail + ")" : ""}`).join(" → ")}.` : ""}`;
    }
    case "playbook": {
      const who = r.body.subject ? String(r.body.subject) : "they";
      return `[Playbook, not history] "${r.name}": how ${who} would act if the story reaches this moment. ${full ? truncateTokens(r.summary, 140) : truncateTokens(r.summary, 50)} It has not happened. Use it only if the player leads there; never stage it, and never treat it as past.`;
    }
    case "consequence": {
      const due = r.body.due?.at ? absMinutes(r.body.due.at) : null;
      const now = state.time ? absMinutes(state.time) : null;
      const when = due != null && now != null ? (due <= now ? " It is due NOW." : ` Due in ${fmtSpan(due - now)}.`) : "";
      return `${tag}${r.summary}${when}`;
    }
    default:
      return `${tag}${r.summary}${full && r.body.archivist ? " " + truncateTokens(String(r.body.archivist), 60) : ""}${full && r.body.text ? " " + truncateTokens(String(r.body.text), 80) : ""}${diverged}${r.body.at ? ` (${fmtTime(r.body.at)})` : ""}`;
  }
}
