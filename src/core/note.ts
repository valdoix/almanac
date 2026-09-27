// The <ledger-note>: verified story state placed just before the player's
// message. Lanes: NOW · PRESENT · CONSTRAINTS · KNOWLEDGE · ARRIVED · CRAFT ·
// GENRE · PLANTS · RETURNING. Each lane has a token budget and a minimum.

import type { AlmanacReport } from "./engines/almanac";
import type { CodexRecord } from "./codex";
import type { CraftReport } from "./telemetry";
import type { CharacterState, MessageDelta, WorldState } from "./types";
import { absMinutes, estTokens, fmtSpan, fmtTime, truncateTokens } from "./util";
import { LADDER_NAMES, normFact, overlap } from "./state";
import { factsInPlay, howVerb, unawareOf } from "./facts";
import { isOpen, parseHours } from "./engines/almanac";

export interface NoteInput {
  state: WorldState;
  almanac: AlmanacReport | null;
  records: CodexRecord[];
  userName: string;
  sealed: boolean;
  query: string; // player's message + last reply, for topics in play
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

export function capsule(c: CharacterState, state: WorldState, opts: { sealed: boolean; nsfw?: boolean; pressure?: string; full: boolean }): string {
  const bits: string[] = [c.tier === "spot" ? "spotlight" : c.tier === "peri" ? "periphery" : "here"];
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
  if (opts.full && c.look) bits.push(`looks: ${c.look}`);
  const held = Object.values(state.items).filter((i) => i.holder === c.id && !i.gone).map((i) => i.name);
  if (opts.full && held.length) bits.push(`holds ${held.slice(0, 4).join(", ")}`);
  let s = `${c.name} (${bits.join("; ")})`;
  if (opts.full && opts.pressure && !c.isUser) s += ` [narrator-only pressure: ${opts.pressure}]`;
  return s;
}

/**
 * One line per fact in play: its #key and statement, where the people here stand
 * on it (and how they came to it), and who here doesn't know it yet.
 */
export function knowledgeBrief(state: WorldState, query: string, userName: string, maxFacts = 4): string[] {
  const nm = (id: string) => (id === "user" ? userName : state.chars[id]?.name ?? id);
  const here = new Set(Object.values(state.chars).filter((c) => (c.tier === "spot" || c.tier === "peri") && !c.dead).map((c) => c.id));
  if (![...here].some((id) => id !== "user")) return [];
  const lines: string[] = [];
  for (const f of factsInPlay(state, query, maxFacts)) {
    const truth = f.truth !== "unknown" ? ` (${f.truth})` : "";
    const stances = Object.values(f.stances)
      .filter((s) => here.has(s.holder) || s.holder === "user")
      .sort((a, b) => b.msgIndex - a.msgIndex)
      .slice(0, 5)
      .map((s) => {
        if (s.status === "wrong") return `${nm(s.holder)} wrongly believes ${s.version ? `"${s.version}"` : "otherwise"}`;
        if (s.status === "unaware") return `${nm(s.holder)} doesn't know`;
        const how = s.derived ? "heard it said" : s.how ? howVerb(s.status, s.how).replace(/^(was |believes it \()/, "").replace(/\)$/, "") : "";
        return `${nm(s.holder)} ${s.status === "knows" ? "knows" : s.status}${how ? ` (${how})` : ""}`;
      });
    const unaware = unawareOf(state, f).filter((id) => here.has(id)).map(nm);
    const parts = [...stances, ...(unaware.length ? [`news to ${unaware.slice(0, 4).join(", ")}`] : [])];
    lines.push(`#${f.key} "${f.statement}"${truth} — ${parts.join("; ") || "no one here knows it"}.`);
  }
  if (lines.length) lines.push(`(Reuse a fact's #key in know lines about it; write the fact itself, not how it came out.)`);
  return lines;
}

export function constraints(state: WorldState, records: CodexRecord[], userName: string): string[] {
  const out: { t: string; w: number }[] = [];
  const now = state.time ? absMinutes(state.time) : null;
  const present = new Set(Object.values(state.chars).filter((c) => c.tier === "spot" || c.tier === "peri" || c.isUser).map((c) => c.id));
  const nm = (id?: string) => (!id ? "" : id === "user" ? userName : state.chars[id]?.name ?? id);
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
  const canonHere = state.canon.filter((c) => here && overlap(normFact(c.text), normFact(here)) > 0.4).slice(-2);
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
    const full = caps.map((c) => capsule(c, state, { sealed: input.sealed, nsfw: input.nsfw, pressure: input.pressures?.[c.id], full: true }));
    if (user && !caps.includes(user) && (user.injuries.length || user.flags.length || user.look)) full.push(capsule({ ...user, tier: "spot" }, state, { sealed: input.sealed, nsfw: input.nsfw, full: true }));
    let text = `[PRESENT] ${full.join(" · ") || "no one else"}`;
    if (estTokens(text) > B.present) text = `[PRESENT] ${caps.map((c) => capsule(c, state, { sealed: input.sealed, nsfw: input.nsfw, full: false })).join(" · ")}`;
    lanes.present = truncateTokens(text, B.present);
  }

  const cons = constraints(state, input.records, input.userName);
  const rejected = input.lastDelta?.rejected ?? [];
  if (rejected.length) cons.unshift(`Last reply's ledger was corrected: ${rejected.slice(0, 2).map((r) => `“${r.raw.slice(0, 60)}” (${r.reason})`).join("; ")}. The verified state here stands.`);
  if (cons.length) lanes.constraints = truncateTokens(`[CONSTRAINTS] ${cons.join(" · ")}`, B.constraints);

  const kb = knowledgeBrief(state, input.query, input.userName);
  if (kb.length) lanes.knowledge = truncateTokens(`[KNOWLEDGE] ${kb.join("\n  ")}`, B.knowledge);

  lanes.arrived = `[ARRIVED] ${input.arrivals?.length ? input.arrivals.join(" · ") + " — render these arrivals and invent no others." : "(none from off-screen this turn)"}`;

  const ladders = Object.values(state.ladders).filter((l) => present.some((c) => c.id === l.from || c.id === l.to) && l.tier > 0);
  if (ladders.length) {
    const nm = (id: string) => (id === "user" ? input.userName : state.chars[id]?.name ?? id);
    lanes.romance = `[ROMANCE] ${ladders.slice(0, 3).map((l) => `${nm(l.from)} → ${nm(l.to)}: ${LADDER_NAMES[l.tier]}${l.evidence ? ` (${l.evidence})` : ""}`).join(" · ")}`;
  }

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

  const order = ["now", "present", "constraints", "knowledge", "romance", "arrived", "craft", "genre", "plants", "returning", "notPeople"];
  const text = `<ledger-note>\n${order.filter((k) => lanes[k]).map((k) => lanes[k]).join("\n")}\n</ledger-note>`;
  return { text, tokens: estTokens(text), lanes };
}
