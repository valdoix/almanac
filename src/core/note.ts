// The <ledger-note>: verified story state placed just before the player's
// message. Lanes: NOW · PRESENT · CONSTRAINTS · KNOWLEDGE · ARRIVED · CRAFT ·
// GENRE · PLANTS · RETURNING. Each lane has a token budget and a minimum.

import type { AlmanacReport } from "./engines/almanac";
import type { CodexRecord } from "./codex";
import type { CraftReport } from "./telemetry";
import type { CharacterState, MessageDelta, Trait, WorldState } from "./types";
import { mergeTraits, traitLine } from "./traits";
import { offPageFacts, offPageLines } from "./offpage";
import { absMinutes, estTokens, fmtSpan, fmtTime, partyName, truncateTokens } from "./util";
import { LADDER_NAMES, normFact, overlap } from "./state";
import { factsInPlay, gapsOf, lackOf, lackText, peopleHere, standsOn, stanceVerb } from "./facts";
import { isOpen, parseHours } from "./engines/almanac";

export interface NoteInput {
  state: WorldState;
  almanac: AlmanacReport | null;
  records: CodexRecord[];
  userName: string;
  sealed: boolean;
  query: string; // player's message + last reply, for topics in play
  /** The player's message alone: what is being talked about now. */
  player?: string;
  craft?: CraftReport | null;
  genreNudge?: string | null;
  plants?: string[];
  arrivals?: string[];
  returning?: string | null;
  lastDelta?: MessageDelta | null;
  pressures?: Record<string, string>;
  budgets?: Partial<Record<"now" | "present" | "constraints" | "knowledge" | "craft", number>>;
  nsfw?: boolean;
  /** Names the player removed from the cast: forces, spells, things. */
  notPeople?: string[];
  /** Traits read from the card, persona and lorebooks, by character id (the story's own win). */
  seedTraits?: Record<string, Trait[]>;
  /** Story truths the player pinned. */
  truths?: string[];
  /** Honour the model's own `never say` words on secrets. */
  offPageAuto?: boolean;
  /** Running bits from the chronicle (the ledger's own are in state). */
  bits?: string[];
  /** What the check of the last reply found, for the model to put right. */
  checks?: string[];
}

const DEFAULT_BUDGETS = { now: 120, present: 330, constraints: 150, knowledge: 250, craft: 110 };

function vad(c: CharacterState): string {
  const m = c.mood;
  if (!m) return "";
  const parts = [m.v != null ? `V${m.v >= 0 ? "+" : ""}${m.v}` : "", m.a != null ? `A${m.a}` : "", m.d != null ? `D${m.d >= 0 ? "+" : ""}${m.d}` : ""].filter(Boolean);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

/**
 * Meters go to the model as plain words ("exhausted"), not "fatigue 4": a
 * number in the note gets copied straight into the prose.
 */
const METER_WORDS: Record<string, string[]> = {
  health: ["near death", "badly hurt", "hurt", "", "", ""],
  fatigue: ["", "", "", "tired", "exhausted", "dead on their feet"],
  hunger: ["", "", "", "hungry", "very hungry", "starving"],
  thirst: ["", "", "", "thirsty", "parched", "desperate for water"],
  pain: ["", "", "", "in pain", "in bad pain", "in agony"],
  intox: ["", "", "", "tipsy", "drunk", "blind drunk"],
  arousal: ["", "", "", "aroused", "very aroused", "desperate with want"],
  composure: ["cracking", "barely holding together", "strained", "", "", ""],
};

export function meterWord(k: string, v: number): string {
  const w = METER_WORDS[k]?.[Math.max(0, Math.min(5, Math.round(v)))];
  return w || `${v >= 4 ? "very " : ""}${k === "cold" ? "cold" : `high ${k}`}`;
}

/** The traits that hold for a person: the story's and the player's over the card's and the lore's. */
export function fixedTraits(c: CharacterState, seed?: Trait[]): string {
  const merged = mergeTraits(seed ?? [], c.traits ?? []).list;
  return traitLine(merged, { age: c.age, appearance: c.appearance });
}

export function capsule(c: CharacterState, state: WorldState, opts: { sealed: boolean; nsfw?: boolean; pressure?: string; full: boolean; seed?: Trait[] }): string {
  const bits: string[] = [c.tier === "spot" ? "spotlight" : c.tier === "peri" ? "periphery" : "here"];
  // Eyes, hair, age: sent every turn, even in the short form; they never change without a cause.
  const fixed = fixedTraits(c, opts.seed);
  if (fixed) bits.push(`always: ${fixed}`);
  if (c.activity) bits.push(c.activity);
  const inner = !(c.isUser && opts.sealed);
  if (inner && c.mood?.name) bits.push(`${c.mood.name}${vad(c)}`);
  const meters = Object.entries(c.meters)
    .filter(([k, v]) => v != null && (v >= 3 || (k === "health" && v <= 2) || (k === "composure" && v <= 1)) && (k !== "arousal" || opts.nsfw))
    .map(([k, v]) => ({ k, word: meterWord(k, v!) }));
  const shown = meters.filter((m) => inner || !["arousal", "composure"].includes(m.k)).map((m) => m.word);
  if (shown.length) bits.push(shown.join(", "));
  const flags = c.flags.filter((f) => !f.startsWith("scar"));
  if (flags.length) bits.push(flags.slice(-3).join(", "));
  if (c.injuries.length) bits.push(c.injuries.map((i) => `${i.where} (${["", "scratch", "wound", "serious", "critical"][i.severity]}${i.treated ? ", treated" : ""})`).join(", "));
  if (opts.full && c.look) bits.push(`wearing: ${c.look}`);
  const held = Object.values(state.items).filter((i) => i.holder === c.id && !i.gone).map((i) => i.name);
  if (opts.full && held.length) bits.push(`holds ${held.slice(0, 4).join(", ")}`);
  let s = `${c.name} (${bits.join("; ")})`;
  if (opts.full && opts.pressure && !c.isUser) s += ` [narrator-only pressure: ${opts.pressure}]`;
  return s;
}

/**
 * The facts in play, ranked by what a slip would cost: for each, who here has it
 * and how, who here lacks it and why (only with evidence), and who keeps it from
 * whom. Then the gaps of the people here. A person not named on a fact is
 * unrecorded, never "doesn't know" — that guess, sent as fact, caused the leaks
 * and the re-telling it was meant to stop.
 */
export function knowledgeBrief(state: WorldState, query: string, userName: string, maxFacts = 5, player = ""): string[] {
  const nm = (id: string) => (id === "user" ? userName : state.chars[id]?.name ?? id);
  const here = peopleHere(state);
  if (!here.some((id) => id !== "user")) return [];
  const list = (ids: string[]) => (ids.length <= 2 ? ids.join(" and ") : `${ids.slice(0, -1).join(", ")} and ${ids[ids.length - 1]}`);
  const lines: string[] = [];
  // Without the player's message on its own, the whole query stands in for it.
  const focus = player || query;
  for (const f of factsInPlay(state, query, maxFacts, focus)) {
    const truth = f.truth !== "unknown" ? ` (${f.truth === "partial" ? "partly true" : f.truth})` : "";
    const has = here.filter((id) => standsOn(f.stances[id]));
    const lacks = here.map((id) => ({ id, r: lackOf(state, f, id) })).filter((x) => x.r);
    const parts: string[] = [];
    const allKnow = has.length >= 2 && !lacks.length && has.every((id) => f.stances[id].status === "knows") && here.every((id) => has.includes(id));
    if (allKnow) parts.push(`${list(has.map(nm))} ${has.length === 2 ? "both" : "all"} have it: don't explain it again`);
    else {
      // Group plain "knows" by how they came to it; beliefs and wrong beliefs one by one.
      const groups = new Map<string, string[]>();
      for (const id of has) {
        const s = f.stances[id];
        const verb = stanceVerb(s, nm);
        const how = s.status !== "knows" && s.how && !s.derived ? ` (${s.how.slice(0, 48)})` : "";
        const k = `${verb}${how}`;
        groups.set(k, [...(groups.get(k) ?? []), nm(id)]);
      }
      for (const [verb, who] of groups) parts.push(`${list(who)} ${verb}`);
      for (const { id, r } of lacks) parts.push(`${nm(id)} ${lackText(r!)}`);
    }
    const keepers = (f.keepers ?? []).filter((k) => !here.includes(k));
    if (keepers.length) parts.push(`kept by ${list(keepers.map(nm))}`);
    lines.push(`#${f.key} "${f.statement}"${truth} — ${parts.join("; ") || "no one here has it"}.`);
  }
  const gaps = here.map((id) => ({ id, g: gapsOf(state, id, focus) })).filter((x) => x.g.length);
  if (gaps.length) lines.push(`Gaps — ${gaps.map((x) => `${nm(x.id)} doesn't know ${x.g.map((g) => g.text).join("; ")}`).join(" · ")}.`);
  if (lines.length) {
    lines.unshift("Only what the story recorded: a person not named on a fact is unrecorded, not ignorant. Never let anyone act on a fact they lack.");
    lines.push("(Something comes out: reveal #key. A guess or wrong belief: know. A hidden fact: secret. Reuse the #key.)");
  }
  return lines;
}

export function constraints(state: WorldState, records: CodexRecord[], userName: string, query = ""): string[] {
  const out: { t: string; w: number }[] = [];
  const now = state.time ? absMinutes(state.time) : null;
  const present = new Set(Object.values(state.chars).filter((c) => c.tier === "spot" || c.tier === "peri" || c.isUser).map((c) => c.id));
  const nm = (id?: string) => (!id ? "" : partyName(state, id, userName));
  for (const c of Object.values(state.cons)) {
    if (c.status !== "open" && c.status !== "due") continue;
    const due = c.due?.at ? absMinutes(c.due.at) : null;
    const involves = present.has(c.who) || (c.whom ? present.has(c.whom) : false);
    if (due != null && now != null && due <= now) out.push({ t: `DUE NOW: ${nm(c.who)}${c.whom ? " → " + nm(c.whom) : ""}: ${c.what}`, w: 10 });
    else if (due != null && now != null && due - now <= 360) out.push({ t: `${nm(c.who)}${c.whom ? " → " + nm(c.whom) : ""}: ${c.what} (due in ${fmtSpan(due - now)})`, w: 7 });
    else if (involves) out.push({ t: `${nm(c.who)} ${c.kind === "owe" ? "owes" : "→"} ${c.whom ? nm(c.whom) + " " : ""}${c.what}`, w: 5 });
  }
  for (const d of Object.values(state.deadlines)) {
    if (d.done || now == null) continue;
    const left = absMinutes(d.at) - now;
    if (left < 0) out.push({ t: `DEADLINE PASSED: ${d.title} (${fmtTime(d.at)}) — the world acts on it`, w: 10 });
    else if (left <= 24 * 60) out.push({ t: `${d.title}: ${fmtSpan(left)} left`, w: 8 });
  }
  for (const it of Object.values(state.items)) {
    if (it.gone || !it.holder || !present.has(it.holder)) continue;
    const last = it.custody[it.custody.length - 1];
    if (last && state.msgCount - last.msgIndex <= 12) out.push({ t: `${it.name} is with ${nm(it.holder)}`, w: 4 });
  }
  for (const c of Object.values(state.chars)) {
    if (!present.has(c.id)) continue;
    for (const i of c.injuries) if (i.severity === 4 && !i.treated) out.push({ t: `${c.name}'s ${i.where} is critical and untreated — it worsens without care`, w: 9 });
  }
  const here = state.place[state.place.length - 1];
  const place = records.find((r) => r.kind === "place" && r.name === here);
  if (place?.body.hours && state.time) {
    const h = parseHours(String(place.body.hours));
    if (h) {
      const open = isOpen(h, state.time.minute);
      const closeIn = (h[1] - state.time.minute + 1440) % 1440;
      if (!open) out.push({ t: `${here} is closed now (hours ${place.body.hours})`, w: 6 });
      else if (closeIn <= 90) out.push({ t: `${here} closes in ${fmtSpan(closeIn)}`, w: 6 });
    }
  }
  for (const f of Object.values(state.factions)) for (const clk of Object.values(f.clocks)) {
    if (clk.cur >= clk.max - 1 && clk.cur < clk.max) out.push({ t: `${f.name}: ${clk.name} is one step from complete (${clk.cur}/${clk.max})`, w: 6 });
  }
  for (const t of Object.values(state.threads)) {
    if (t.status === "stalled" && t.stalls >= 2) out.push({ t: `Thread “${t.title}” has stalled ${t.stalls}× (blocker: ${t.blocker ?? "unnamed"}) — the next turn must change evidence, position, stakes or resolution`, w: 5 });
  }
  // World facts the story minted: the ones about this place, and the ones this turn talks about.
  const talk = normFact(query);
  const canonHere = state.canon.filter((c) => !c.pinned && ((here && overlap(normFact(c.text), normFact(here)) > 0.4) || (talk && overlap(normFact(c.text), talk) > 0.5))).slice(-3);
  for (const c of canonHere) out.push({ t: c.text, w: 3 });
  return out.sort((a, b) => b.w - a.w).map((x) => x.t);
}

export function buildLedgerNote(input: NoteInput): { text: string; tokens: number; lanes: Record<string, string> } {
  const { state, almanac: al } = input;
  const B = { ...DEFAULT_BUDGETS, ...(input.budgets ?? {}) };
  const lanes: Record<string, string> = {};

  // NOW
  if (state.time) {
    const parts = [`Day ${state.time.day}`];
    if (al) parts.push(al.calendar.seasons === "story" ? `${al.clock} · ${al.season}` : al.clock);
    else parts.push(fmtTime(state.time).replace(/^Day \d+ /, ""));
    if (al) parts.push(`${al.weather.text}${al.forecast ? ` (${al.forecast})` : ""}`);
    else if (state.weather) parts.push(state.weather.condition);
    if (state.place.length) parts.push(state.place.join(" › "));
    let now = `[NOW] ${parts.join(" · ")}`;
    if (al && (!al.sun.daylight || /golden|sunset|dusk|dawn/.test(al.band))) now += ` · ${al.band}; sun ${al.sun.text}; moon ${al.moon.name}`;
    if (state.mode && state.mode !== "social") now += ` · scene: ${state.mode}`;
    lanes.now = truncateTokens(now, B.now);
  } else lanes.now = "[NOW] The clock has not started. Seed it from the start point or the setting in this reply's header and ledger.";

  // PRESENT
  const present = Object.values(state.chars).filter((c) => (c.tier === "spot" || c.tier === "peri") && !c.dead);
  const user = state.chars.user;
  const caps = [...present].sort((a, b) => (a.tier === "spot" ? -1 : 1) - (b.tier === "spot" ? -1 : 1));
  if (caps.length || user) {
    const seed = input.seedTraits ?? {};
    const full = caps.map((c) => capsule(c, state, { sealed: input.sealed, nsfw: input.nsfw, pressure: input.pressures?.[c.id], full: true, seed: seed[c.id] }));
    const userFixed = user ? fixedTraits(user, seed.user) : "";
    const withUser = user && !caps.includes(user) && (user.injuries.length || user.flags.length || user.look || userFixed);
    if (withUser) full.push(capsule({ ...user!, tier: "spot" }, state, { sealed: input.sealed, nsfw: input.nsfw, full: true, seed: seed.user }));
    let text = `[PRESENT] ${full.join(" · ") || "no one else"}`;
    if (estTokens(text) > B.present) {
      const short = caps.map((c) => capsule(c, state, { sealed: input.sealed, nsfw: input.nsfw, full: false, seed: seed[c.id] }));
      if (withUser) short.push(capsule({ ...user!, tier: "spot" }, state, { sealed: input.sealed, nsfw: input.nsfw, full: false, seed: seed.user }));
      text = `[PRESENT] ${short.join(" · ")}`;
    }
    lanes.present = truncateTokens(text, B.present + 60);
  }

  // Story truths the player pinned: always sent, whatever the story says.
  const truths = [...(input.truths ?? []), ...state.canon.filter((c) => c.pinned).map((c) => c.text)].map((t) => t.trim()).filter(Boolean);
  if (truths.length) lanes.truths = truncateTokens(`[TRUTHS] ${[...new Set(truths)].join(" · ")} — these hold over anything in the source material or older chat.`, 160);

  const nmAll = (id: string) => (id === "user" ? input.userName : state.chars[id]?.name ?? id);
  const off = offPageFacts(state, input.offPageAuto ?? true);
  if (off.length) lanes.offPage = truncateTokens(`[OFF THE PAGE] ${offPageLines(off, nmAll).join("\n  ")}`, 180);

  const cons = constraints(state, input.records, input.userName, input.query);
  if (input.checks?.length) cons.unshift(`The last reply was checked: ${input.checks.slice(0, 3).join("; ")}. Don't carry it forward.`);
  const rejected = input.lastDelta?.rejected ?? [];
  if (rejected.length) cons.unshift(`Last reply's ledger was corrected: ${rejected.slice(0, 2).map((r) => `“${r.raw.slice(0, 60)}” (${r.reason})`).join("; ")}. The verified state here stands.`);
  if (cons.length) lanes.constraints = truncateTokens(`[CONSTRAINTS] ${cons.join(" · ")}`, B.constraints);

  const kb = knowledgeBrief(state, input.query, input.userName, 5, input.player ?? "");
  if (kb.length) lanes.knowledge = truncateTokens(`[KNOWLEDGE] ${kb.join("\n  ")}`, B.knowledge);

  lanes.arrived = `[ARRIVED] ${input.arrivals?.length ? input.arrivals.join(" · ") + " — render these arrivals and invent no others." : "(none from off-screen this turn)"}`;

  const ladders = Object.values(state.ladders).filter((l) => present.some((c) => c.id === l.from || c.id === l.to) && l.tier > 0);
  if (ladders.length) {
    const nm = (id: string) => (id === "user" ? input.userName : state.chars[id]?.name ?? id);
    // The rung as a number too, so the next ladder line can name it; an old reason is left out, it would read as now.
    const fresh = (l: (typeof ladders)[number]) => state.msgCount - l.msgIndex <= 12 && l.evidence;
    lanes.romance = `[ROMANCE] ${ladders.slice(0, 3).map((l) => `${nm(l.from)} → ${nm(l.to)}: ${LADDER_NAMES[l.tier]} (${l.tier}/7)${fresh(l) ? ` — ${truncateTokens(l.evidence!, 24)}` : ""}`).join(" · ")}`;
  }

  // Running bits worth calling back: not used lately, most used first.
  const recent = state.msgCount - 6;
  const bitsFromState = (state.motifs ?? []).filter((m) => m.lastMsg < recent).sort((a, b) => b.uses - a.uses || a.lastMsg - b.lastMsg).map((m) => `${m.text}${m.who ? ` (${m.who})` : ""}`);
  const allBits = [...new Set([...bitsFromState, ...(input.bits ?? [])])].slice(0, 5);
  if (allBits.length) lanes.callbacks = truncateTokens(`[CALLBACKS] Running bits you may call back when it fits, never forced: ${allBits.join(" · ")}`, 110);

  if (input.craft && (input.craft.avoids.length || input.craft.agency.length)) {
    const parts: string[] = [];
    if (input.craft.agency.length) parts.push(`Agency: ${input.craft.agency.join("; ")} — don't repeat it.`);
    if (input.craft.avoids.length) parts.push(`Avoid: ${input.craft.avoids.join(", ")}.`);
    parts.push(`Try: ${input.craft.technique}`);
    lanes.craft = truncateTokens(`[CRAFT] ${parts.join(" ")}`, B.craft);
  }
  if (input.genreNudge) lanes.genre = `[GENRE] ${input.genreNudge}`;
  if (input.plants?.length) lanes.plants = `[PLANTS] ${input.plants.join(" · ")}`;
  if (input.returning) lanes.returning = `[RETURNING] ${input.returning}`;
  if (input.notPeople?.length) lanes.notPeople = `[NOT PEOPLE] ${input.notPeople.join(", ")}: not characters (a force, power or thing). Keep them out of cast, mood, bond, ladder and know lines.`;

  const order = ["now", "truths", "present", "constraints", "offPage", "knowledge", "romance", "arrived", "callbacks", "craft", "genre", "plants", "returning", "notPeople"];
  const text = `<ledger-note>\n${order.filter((k) => lanes[k]).map((k) => lanes[k]).join("\n")}\n</ledger-note>`;
  return { text, tokens: estTokens(text), lanes };
}
