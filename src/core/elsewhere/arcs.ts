// Where subplots come from (design/09 §5.3), the gate every beat must pass (§7), and the lines
// the engine writes for them. Every candidate keeps its grounds: the records, facts and threads
// it rests on. Nothing without grounds is ever seeded.

import type { CodexRecord } from "../codex";
import type { WeaverWorld } from "../lore";
import type { ArcKind, ArcState, BeatResult, WorldState } from "../types";
import { slug } from "../util";
import { atPlace, GENRE_LEAN, groupName, kindFromText, SPECS } from "./grammar";
import { canAct, hasFact, TRAVEL, type Actor, type Roster } from "./roster";
import { newsValue } from "./news";

export interface SeedCand {
  id: string;
  kind: ArcKind;
  lead: Actor;
  cast: Actor[];
  premise: string;
  want: string;
  fear: string;
  grounds: string[];
  secrecy: "public" | "private" | "secret";
  weight: number;
  place?: string;
  heat: number;
  clock: number;
  cur?: number;
  faction?: { name: string; project: string };
  by: "engine" | "lore";
  why: string;
}

const NAME_RE = /[A-Z][\w'’-]+(?:\s+(?:of\s+)?[A-Z][\w'’-]+)*/g;
const low = (s: string) => s.toLowerCase();
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : s);
const first = (n: string) => n.split(/\s+/)[0];

/** The people a piece of text names, by the roster (unique first and last names count). */
export function namesIn(text: string, r: Roster): Actor[] {
  const out: Actor[] = [];
  for (const m of text.matchAll(NAME_RE)) {
    const words = m[0].split(/\s+/);
    // "Willow Rosenberg" or "Willow"; "Tara confronted Willow" finds both.
    for (let i = 0; i < words.length; i++) {
      for (let j = words.length; j > i; j--) {
        const a = r.find(words.slice(i, j).join(" ").replace(/['’]s$/, ""));
        if (a && !out.includes(a)) {
          out.push(a);
          i = j - 1;
          break;
        }
      }
    }
  }
  return out;
}

/** A subplot with nothing under it but the person's own record: it gives way to a better grounded one. */
export function isLight(a: ArcState): boolean {
  return !a.locked && a.status === "running" && a.grounds.length === 1 && /^char:/.test(a.grounds[0]) && a.clock.cur <= Math.ceil(a.clock.max / 2);
}


const VERB = /^(be|get|find|keep|protect|stay|win|make|help|see|know|learn|stop|save|leave|go|return|prove|earn|marry|take|have|become|avoid|escape|fix|end|mend|settle|reach|reunite|bring|destroy|kill|defeat|hide|claim|seize|rule|serve|free|heal|understand|undo|break|build|finish|catch|expose|warn|confront|reclaim|regain|restore|redeem|repay|survive|live|do|be)\b/i;
/** An archivist's blank ("Unknown — last seen…", "n/a", "—"): no want or fear at all. */
const PLACEHOLDER = /^(?:unknown|unclear|none|n\/a|tbd|not (?:known|stated)|\?+|[—–-]+)(?:\b|\s|$)/i;

/** A want as "to …": "Gabriel's recovery" becomes "to see Gabriel's recovery". */
export function asWant(text: string | undefined, fallback: string): string {
  // An archivist's note ("Unanswered apology suggests she wants forgiveness") holds the want after "wants".
  const t = (text ?? "").trim().replace(/[.;]+$/, "").split(/;\s*/)[0].replace(/^.*?\b(?:wants?|wishes|longs? for|hopes? for)\s+/i, "");
  if (!t || PLACEHOLDER.test(t)) return fallback;
  const bare = t.replace(/^to\s+/i, "");
  if (VERB.test(bare)) return `to ${bare.charAt(0).toLowerCase()}${bare.slice(1)}`;
  // A name or a thing ("Gabriel's recovery") is seen through; a state ("forgiveness") is found; anything else reads as a verb ("guide Buffy").
  if (/^(?:the|a|an|his|her|their|its|my|our|\p{Lu})/u.test(bare)) return `to see ${bare}`;
  if (/^\w+(?:ness|tion|sion|ment|ity|ance|ence|dom|ship|cy)\b/i.test(bare)) return `to find ${bare}`;
  // Things ("shoes for Saturday") are got; a bare verb rarely ends in a lone s ("pass", "focus" do).
  if (/^\w+[^su\s]s\b/i.test(bare)) return `to get ${bare}`;
  return `to ${bare}`;
}
/** A clause as a sentence: capital first, full stop last. */
export function sentence(t: string): string {
  const s = t.trim().replace(/[;,:\s]+$/, "");
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}${/[.!?…”"]$/.test(s) ? "" : "."}` : "";
}

/** A faction's clock as the start of a story: "The Hellions mean to raid Sunnydale, and they're already well on the way." */
export function factionPremise(name: string, project: string, cur: number, max: number): string {
  const g = groupName(name);
  const who = g.charAt(0).toUpperCase() + g.slice(1);
  const plural = /s$/.test(name.split(/\s+/).at(-1)!) && !/&/.test(name);
  const aim = project.replace(/^to\s+/i, "");
  const how = cur <= 0 ? "" : cur >= max - 1 ? `, and ${plural ? "they're" : "it's"} nearly ready` : cur >= max / 2 ? `, and ${plural ? "they're" : "it's"} well on the way` : `, and ${plural ? "they've" : "it's"} made a start`;
  return `${who} ${plural ? "mean" : "means"} to ${aim}${how}.`;
}

const MINOR = /\b(?:(?:[1-9]|1[0-7]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)[- ]year[- ]old|child|kid|little (?:girl|boy)|teenage(?:r|d)?|high[- ]school(?:er)?|minor)\b/i;
const FAMILY_TIE = /\b(mother|father|mom|mum|dad|parent|son|daughter|sister|brother|sibling|aunt|uncle|niece|nephew|cousin|grand\w*|step\w*|in-law|guardian|ward)\b/i;
/** Someone their record calls a child or a teenager. */
export const isMinor = (a: Actor) => MINOR.test(`${a.text} ${a.drives.role ?? ""}`);

/** A thread's latest news without the bookkeeping a model sometimes writes into it ("; latest: …; stalls: 0"). */
export function threadLatest(text: string | undefined): string {
  return (text ?? "").replace(/^[;:\s]*latest:\s*/i, "").replace(/;?\s*\bstalls:\s*\d+\s*/gi, "").replace(/[;,\s]+$/, "").trim();
}

/** A fear as a plain clause: "That the Willow she loves is gone" becomes "the Willow she loves is gone". */
export function asFear(text: string | undefined, fallback: string): string {
  const t = (text ?? "").trim().replace(/[.;]+$/, "").split(/;\s*/)[0].replace(/^(?:that|the fear that|fears? that)\s+/i, "");
  if (PLACEHOLDER.test(t)) return fallback;
  return t ? `${t.charAt(0).toLowerCase()}${t.slice(1)}` : fallback;
}

export interface SeedCtx {
  state: WorldState;
  roster: Roster;
  records: CodexRecord[];
  awake: Actor[];
  arcs: ArcState[];
  canonGravity: "off" | "light" | "strong";
  genres: string[];
  world?: WeaverWorld | null;
  pressures?: Record<string, string>;
  now: number;
}

/** A reason for someone away to come back: news they hold that names someone close to them. */
function reasonToReturn(a: Actor, r: Roster, st: WorldState): { key: string; about: Actor } | null {
  for (const k of a.knows) {
    const f = st.facts?.[k.key];
    if (!f || newsValue(f, st.msgCount) < 2) continue;
    for (const t of a.ties.filter((x) => x.strength >= 2)) {
      const o = r.byKey(t.to);
      if (o && o.names.some((n) => new RegExp(`\\b${first(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(f.statement))) return { key: k.key, about: o };
    }
  }
  return null;
}

export function seedCandidates(ctx: SeedCtx): SeedCand[] {
  const { state: st, roster: r } = ctx;
  const out: SeedCand[] = [];
  const live = ctx.arcs.filter((a) => a.status === "running" || a.status === "held" || a.status === "fate");
  // A light subplot (someone's own life or drives, nothing else under it) gives way to a stronger one.
  const busy = new Set(live.filter((a) => !isLight(a)).map((a) => low(a.lead)));
  const usedGrounds = new Set(live.flatMap((a) => a.grounds));
  const recentlyEnded = new Set(ctx.arcs.filter((a) => (a.status === "resolved" || a.status === "dropped") && ctx.now - (a.ending?.atAbs ?? a.lastBeatAbs ?? a.startedAbs) < 2880).map((a) => a.id));
  const awake = new Set(ctx.awake.map((a) => a.key));
  const town = r.town ?? st.place[0];
  const free = (a: Actor | undefined): a is Actor => !!a && !busy.has(low(a.name)) && a.ring !== "onstage" && canAct(a) && (a.group || awake.has(a.key));
  const lean = new Set(ctx.genres.flatMap((g) => GENRE_LEAN[g.toLowerCase()] ?? []));
  const push = (c: Omit<SeedCand, "id" | "weight"> & { weight: number }) => {
    if (c.grounds.some((g) => usedGrounds.has(g))) return;
    // A romance never with a child, and never within a family.
    if (c.kind === "courtship" && c.cast.some((o) => isMinor(o) || isMinor(c.lead) || c.lead.ties.some((t) => t.to === o.key && FAMILY_TIE.test(t.kind)))) return;
    const id = slug(`${first(c.lead.name)}-${c.kind}`) || `arc-${out.length}`;
    if (recentlyEnded.has(id)) return;
    out.push({ ...c, id, weight: c.weight * (lean.has(c.kind) ? 1.5 : 1) });
  };
  const spec = (k: ArcKind) => SPECS[k];

  // Factions with a clock: their project moves whatever the player does.
  for (const f of Object.values(st.factions)) {
    for (const clk of Object.values(f.clocks)) {
      if (clk.cur >= clk.max) continue;
      if (live.some((a) => a.faction && low(a.faction.name) === low(f.name))) continue;
      const g = r.groups.find((x) => low(x.name) === low(f.name));
      if (!g) continue;
      const leaders = r.actors.filter((a) => a.ties.some((t) => t.to === g.key && t.strength >= 3) && canAct(a));
      const kind = kindFromText(`${f.name} ${clk.name}`) ?? "threat";
      push({
        kind: kind === "pursuit" ? "threat" : kind, lead: g, cast: leaders.slice(0, 2), premise: factionPremise(f.name, clk.name, clk.cur, clk.max), want: `to ${clk.name.replace(/^to\s+/i, "")}`,
        fear: spec("threat").fear, grounds: [`fac:${slug(f.name)}`], secrecy: "public", weight: 3, place: town, heat: 2, clock: clk.max, cur: clk.cur,
        faction: { name: f.name, project: clk.name }, by: "engine", why: `${f.name}'s clock`,
      });
    }
  }

  // A Dream Weaver world with agency pursues its agenda.
  const w = ctx.world;
  if (w?.agenda && !live.some((a) => a.kind === "world")) {
    push({
      kind: "world", lead: { key: "world", name: w.name || "the world", names: [w.name || "the world"], ring: "unmet", standing: "here", reach: "town", drives: {}, ties: [], nocturnal: false, lastPage: -1, protected: false, flags: {}, text: w.premise ?? "", lore: "", knows: [], means: 1, group: true },
      cast: [], premise: clip(w.agenda, 200), want: `to move its agenda: ${clip(w.agenda, 80)}`, fear: "the agenda stalls", grounds: ["world"], secrecy: "public", weight: 2, place: town, heat: 1, clock: 8, by: "lore", why: "the world's agenda",
    });
  }

  // Story residue: open threads that name someone off the page.
  for (const t of Object.values(st.threads)) {
    if (t.status === "resolved") continue;
    const latest = threadLatest(t.latest);
    const text = `${t.title}. ${latest}`;
    const who = namesIn(text, r).filter((a) => !a.group);
    const lead = who.find(free);
    if (!lead) continue;
    const kind = kindFromText(text) ?? "pursuit";
    push({
      kind, lead, cast: who.filter((a) => a !== lead).slice(0, 3), premise: clip(latest ? latest.split(/;\s*/).slice(0, 2).map(sentence).join(" ") : `${lead.name} is still caught up in “${t.title}”.`, 220), want: asWant(lead.drives.want, "") || `to see “${t.title}” through`,
      fear: asFear(lead.drives.fear, "") || spec(kind).fear, grounds: [t.id], secrecy: spec(kind).secrecy, weight: 2.5, heat: 1, clock: spec(kind).clock, by: "engine", why: `the thread "${t.title}"`,
    });
  }

  // Debts and consequences.
  for (const c of Object.values(st.cons)) {
    if (c.status === "paid" || c.status === "resolved" || c.status === "healed") continue;
    const lead = r.actors.find((a) => a.charId === c.who);
    if (!free(lead)) continue;
    const whom = c.whom ? r.actors.find((a) => a.charId === c.whom) : undefined;
    push({
      kind: "debt", lead, cast: whom ? [whom] : [], premise: clip(c.kind === "owe" ? `${lead.name} still owes${whom ? ` ${whom.name}` : ""} ${c.what.replace(/\.$/, "")}, and it hasn't been settled.` : `${lead.name} has a reckoning coming${whom ? ` with ${whom.name}` : ""}: ${c.what.replace(/\.$/, "")}.`, 200), want: "to settle what's owed", fear: spec("debt").fear,
      grounds: [c.id], secrecy: "private", weight: 2, heat: c.status === "due" ? 2 : 1, clock: 4, by: "engine", why: "an open debt",
    });
  }

  // Secrets kept from someone.
  for (const f of Object.values(st.facts ?? {})) {
    if (f.hidden || !f.keepers?.length || !f.keptFrom?.length || f.offPage) continue;
    const lead = r.actors.find((a) => a.charId && f.keepers!.includes(a.charId));
    if (!free(lead)) continue;
    const from = r.actors.filter((a) => a.charId && f.keptFrom!.includes(a.charId));
    push({
      kind: "secret", lead, cast: from.slice(0, 2), premise: clip(`${lead.name} is keeping something from ${from.map((a) => a.name).join(" and ") || "the people closest to them"}, and keeping it is getting harder.`, 200), want: "to keep it hidden", fear: "it comes out",
      grounds: [`#${f.key}`], secrecy: "secret", weight: 1.5, heat: 1, clock: 6, by: "engine", why: `a secret (#${f.key})`,
    });
  }

  // Strained or charged bonds between people off the page.
  for (const b of Object.values(st.bonds)) {
    const a = r.actors.find((x) => x.charId === b.from);
    const o = b.to === "user" ? undefined : r.actors.find((x) => x.charId === b.to);
    if (!free(a) || !o) continue;
    const ax = b.axes;
    if ((ax.resentment ?? 0) >= 3 || (ax.rivalry ?? 0) >= 3) push({ kind: "rivalry", lead: a, cast: [o], premise: b.label ? `${a.name} and ${o.name}: ${b.label}. It hasn't cooled.` : `There's bad blood between ${a.name} and ${o.name}, and it hasn't cooled.`, want: "to come out on top", fear: spec("rivalry").fear, grounds: [`bond:${b.from}>${b.to}`], secrecy: "private", weight: 2, heat: 2, clock: 6, by: "engine", why: "a bond gone sour" });
    else if ((ax.attraction ?? 0) >= 3) push({ kind: "courtship", lead: a, cast: [o], premise: `${a.name} is drawn to ${o.name}, more than ${a.name} has said aloud.`, want: `to be with ${o.name}`, fear: spec("courtship").fear, grounds: [`bond:${b.from}>${b.to}`], secrecy: "private", weight: 2, heat: 1, clock: 6, by: "engine", why: "an attraction" });
    else if ((ax.trust ?? 0) <= -3 || (ax.affection ?? 0) <= -3) push({ kind: "rift", lead: a, cast: [o], premise: `${a.name} and ${o.name} have fallen out, and neither has made the first move.`, want: "to mend it, or end it cleanly", fear: spec("rift").fear, grounds: [`bond:${b.from}>${b.to}`], secrecy: "private", weight: 2, heat: 1, clock: 4, by: "engine", why: "a strained bond" });
  }

  // Lore: situations the story moved past, and forecasts (canon gravity).
  for (const rec of ctx.records) {
    // Bonds are filed as situations too; they seed below, from their axes.
    if ((rec.kind !== "forecast" && rec.kind !== "situation") || rec.id.startsWith("bond:")) continue;
    if (rec.kind === "forecast" && (ctx.canonGravity === "off" || rec.status === "diverged")) continue;
    const parts = (Array.isArray(rec.body?.participants) ? rec.body.participants.map(String) : []).map((n: string) => r.find(n)).filter(Boolean) as Actor[];
    const text = `${rec.summary} ${(Array.isArray(rec.body?.expected) ? rec.body.expected.join(" ") : "")}`.replace(/^Upcoming \(not yet true\):\s*/i, "");
    const who = parts.length ? parts : namesIn(text, r);
    const lead = who.find(free);
    if (!lead) continue;
    const cast = who.filter((a) => a !== lead);
    if (rec.kind === "situation") {
      // Someone the lead was with is now in the player's scene, away from the lead: the situation is over for them.
      const gone = cast.find((a) => a.ring === "onstage");
      if (!gone) continue;
      const place = rec.body?.place ?? /\bat ((?:[A-Z][\w'’-]+\s?)+)/.exec(rec.summary)?.[1]?.trim();
      push({
        kind: "pursuit", lead, cast: [gone, ...cast.filter((a) => a !== gone)].slice(0, 3), premise: clip(`${rec.summary.replace(/\.$/, "")}. Since then, ${gone.name} has gone elsewhere, and ${lead.name} doesn't know where.`, 240),
        want: `to find out where ${first(gone.name)} went`, fear: `${first(gone.name)} is in danger`, grounds: [rec.id], secrecy: "private", weight: 2.5, place, heat: 1, clock: 6, by: "lore", why: "a lore situation the story moved past",
      });
      continue;
    }
    const kind = kindFromText(text) ?? "pursuit";
    // "Once Willow tells him…": a conditional forecast waits until the news has reached the lead.
    const conditional = /\b(once|when|after|if)\b[^.]{0,60}\b(tells?|learns?|finds? out|hears?|knows?|discovers?)\b/i.test(text);
    const reason = reasonToReturn(lead, r, st);
    if ((conditional || kind === "return") && !reason) continue;
    if (kind === "return" && lead.reach !== "far" && lead.reach !== "region") continue;
    const sp = spec(kind);
    push({
      kind, lead, cast: [...(reason && !cast.includes(reason.about) ? [reason.about] : []), ...cast].slice(0, 3), premise: clip(text, 220),
      want: kind === "return" && reason ? `to see ${first(reason.about.name)} with their own eyes` : asWant(lead.drives.want, "") || sp.want,
      fear: asFear(lead.drives.fear, "") || sp.fear, grounds: [rec.id, ...(reason ? [`#${reason.key}`] : [])], secrecy: sp.secrecy, weight: ctx.canonGravity === "strong" ? 3 : 1.5, heat: 1, clock: sp.clock, by: "lore", why: `the forecast "${clip(rec.name, 50)}"`,
    });
  }

  // Drives: an awake person with no story yet gets the kind that fits them.
  for (const a of ctx.awake) {
    if (!free(a) || out.some((c) => c.lead === a)) continue;
    const text = `${a.drives.want ?? ""} ${a.drives.role ?? ""} ${a.drives.tension ?? ""} ${a.lore}`;
    // From what they want, any kind; from who they are (the lore), only kinds a description can carry.
    const fromLore = kindFromText(text);
    const loreKind = fromLore && ["duty", "scheme", "decline", "investigation", "secret", "life"].includes(fromLore) ? fromLore : fromLore === "loss" && /\b(grie\w*|mourn\w*|bereave\w*|widow\w*)\b/i.test(text) ? "loss" : null;
    let kind = kindFromText(`${a.drives.want ?? ""} ${a.drives.tension ?? ""}`) ?? loreKind ?? "pursuit";
    const reason = reasonToReturn(a, r, st);
    if (kind === "return" && !reason) kind = "life";
    const toUser = a.ties.find((t) => t.to === "user" && t.strength >= 2);
    if (kind === "pursuit" && !a.drives.want) kind = toUser || a.reach === "region" || a.reach === "far" ? "life" : kind;
    if (kind === "pursuit" && !a.drives.want) continue; // nothing to pursue
    const sp = spec(kind);
    const grounds = [a.recordId ?? `char:${a.key}`];
    if (kind === "life") {
      push({ kind, lead: a, cast: [], premise: clip(`${a.name}${a.name.endsWith("s") ? "'" : "'s"} own life goes on${a.where ? ` ${atPlace(a.where)}` : ""}${a.drives.role ? `: ${a.drives.role.replace(/[.;]+$/, "")}` : ""}.`, 200), want: sp.want, fear: sp.fear, grounds, secrecy: "private", weight: toUser ? 1.1 : 0.7, heat: 0, clock: 6, by: "lore", why: "their own life" });
      continue;
    }
    // Whoever their own record names (a rival, a mentor) is in it with them.
    const named = namesIn(a.lore, r).filter((o) => o !== a && !o.group && o.ring !== "onstage").slice(0, 2);
    push({
      kind, lead: a, cast: named, premise: clip(a.drives.want ? `${a.name} wants ${asWant(a.drives.want, "").replace(/^to\s+/i, "to ")}${a.drives.fear ? `, and fears ${asFear(a.drives.fear, "")}` : ""}.` : sentence(a.text), 200), want: asWant(a.drives.want, sp.want),
      fear: asFear(a.drives.fear, sp.fear), grounds, secrecy: sp.secrecy, weight: 1, heat: 1, clock: sp.clock, by: "lore", why: "what drives them",
    });
  }

  // Hidden pressures the story drew for people.
  for (const [charId, text] of Object.entries(ctx.pressures ?? {})) {
    const a = r.actors.find((x) => x.charId === charId);
    if (!free(a) || out.some((c) => c.lead === a && c.weight >= 1.2)) continue;
    const kind = kindFromText(text) ?? "secret";
    push({ kind, lead: a, cast: [], premise: sentence(`${a.name} ${text}`), want: spec(kind).want, fear: spec(kind).fear, grounds: [`pressure:${charId}`], secrecy: "secret", weight: 1.2, heat: 1, clock: spec(kind).clock, by: "engine", why: "a hidden pressure" });
  }

  // One candidate per lead: the best grounded.
  const best = new Map<string, SeedCand>();
  for (const c of out) {
    const k = c.lead.key;
    if (!best.has(k) || best.get(k)!.weight < c.weight) best.set(k, c);
  }
  const used = new Set(ctx.arcs.map((a) => a.id));
  return [...best.values()].map((c) => {
    let id = c.id;
    for (let i = 2; used.has(id); i++) id = `${c.id}-${i}`;
    used.add(id);
    return { ...c, id };
  });
}

// ---------------------------------------------------------------------------
// The gate (MKAMT, design/09 §7)
// ---------------------------------------------------------------------------

export interface GateResult {
  ok: boolean;
  mod: number;
  atAbs?: number;
  deferTo?: number;
  drop?: string;
  why: string[];
  /** Why it waits, in the player's words ("keeps night hours"), for the Elsewhere page. */
  wait?: string;
  /** The player pushed it through out of the lead's hours ("by day, though he keeps night hours"). */
  offHours?: string;
}

/** Whether this person is up at this minute of the day. */
export function awakeAt(a: Actor | undefined, minuteOfDay: number): boolean {
  if (!a || a.group && !a.nocturnal) return true;
  if (a.nocturnal) return minuteOfDay >= 19 * 60 || minuteOfDay < 5 * 60;
  return minuteOfDay >= 7 * 60 && minuteOfDay < 23 * 60;
}

/**
 * `push`: the player asked for this step now (a nudge, a story they just wrote): it happens even
 * out of the lead's hours, at a disadvantage. `forced`: the player moved the world a step, so the
 * step's whole window counts, whatever the subplot's cooldown.
 */
export function gate(arc: ArcState, lead: Actor | undefined, r: Roster, opts: { from: number; now: number; rand: () => number; push?: boolean; forced?: boolean }): GateResult {
  const why: string[] = [];
  if (lead && !lead.group && !canAct(lead)) return { ok: false, mod: 0, drop: `${lead.name} can no longer act (${lead.standing})`, why };
  // Knowledge: a beat acts only on facts the lead has. Unrecorded is not enough.
  if (lead && !lead.group) {
    const missing = arc.grounds.filter((g) => g.startsWith("#") && !hasFact(lead, g.slice(1)) && arc.kind !== "secret");
    if (missing.length) return { ok: false, mod: 0, deferTo: opts.now + 360, why: [`waits for news (${missing.join(", ")})`], wait: `waits until ${lead.name} hears ${missing.join(", ")}` };
  }
  // Time: a minute in the window when the lead is up.
  const since = Math.max(opts.from, arc.lastBeatAbs ?? arc.startedAbs);
  const start = opts.push || opts.forced ? Math.min(since, opts.now) : Math.max(opts.from, arc.nextAbs);
  if (start > opts.now) return { ok: false, mod: 0, deferTo: arc.nextAbs, why: ["not yet"] };
  let at: number | undefined;
  for (let i = 0; i < 24 && at == null; i++) {
    const t = Math.round(start + opts.rand() * Math.max(0, opts.now - start));
    if (awakeAt(lead, ((t % 1440) + 1440) % 1440)) at = t;
  }
  let mod = 0;
  let offHours: string | undefined;
  if (at == null) {
    const hours = lead?.nocturnal ? "keeps night hours" : "is asleep at this hour";
    if (!opts.push) {
      let t = opts.now;
      while (!awakeAt(lead, ((t % 1440) + 1440) % 1440) && t < opts.now + 1440) t += 30;
      return { ok: false, mod: 0, deferTo: t, why: ["asleep"], wait: `${lead?.name ?? arc.lead} ${hours}` };
    }
    at = opts.now;
    mod -= 1;
    why.push("out of hours");
    offHours = lead?.nocturnal ? `by day, though ${lead.name} keeps night hours` : `at an hour ${lead?.name ?? arc.lead} is usually asleep`;
  }
  // Means, allies, opponents, beliefs and distance.
  if (lead) {
    mod += lead.means;
    if (lead.means > 0) why.push("means");
    if (lead.means < 0) why.push("little means");
    const castActors = arc.cast.map((n) => r.find(n)).filter(Boolean) as Actor[];
    if (castActors.some((c) => canAct(c) && lead.ties.some((t) => t.to === c.key && t.strength >= 2) && c.ring !== "onstage")) {
      mod += 1;
      why.push("an ally");
    }
    if (["rivalry", "threat", "scheme"].includes(arc.kind) && castActors.some((c) => c.means > lead.means)) {
      mod -= 1;
      why.push("a stronger opponent");
    }
    const believes = arc.grounds.some((g) => g.startsWith("#") && hasFact(lead, g.slice(1))?.status !== "knows" && hasFact(lead, g.slice(1)));
    if (believes) {
      mod -= 1;
      why.push("acting on a belief");
    }
    if (["threat", "rivalry", "courtship"].includes(arc.kind) && (lead.reach === "far" || lead.reach === "region") && !lead.group) {
      mod -= 1;
      why.push("from afar");
    }
  }
  return { ok: true, mod: Math.max(-2, Math.min(2, mod)), atAbs: at, why, offHours };
}

/** Travel time to the scene's town, in minutes. */
export function travelTime(a: Actor | undefined): number {
  return a ? TRAVEL[a.reach] : 0;
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

/** A value safe inside an arc line (no field separators, no line breaks). */
export const cleanVal = (s: string | undefined) => (s ?? "").replace(/\s*\|\s*/g, " / ").replace(/\s*\n+\s*/g, " ").trim();

export function arcNewLine(c: { id: string; kind: ArcKind; lead: string; cast: string[]; secrecy: string; clock: number; cur?: number; heat: number; at: number; premise: string; want: string; fear: string; grounds: string[]; place?: string; by: string; faction?: { name: string; project: string }; push?: boolean }): string {
  const f = [
    `lead: ${cleanVal(c.lead)}`, c.cast.length ? `cast: ${cleanVal(c.cast.join(", "))}` : "", `secrecy: ${c.secrecy}`, `clock: ${c.clock}`, c.cur ? `cur: ${c.cur}` : "",
    `heat: ${c.heat}`, `at: ${c.at}`, `premise: ${cleanVal(c.premise)}`, `want: ${cleanVal(c.want)}`, `fear: ${cleanVal(c.fear)}`, `grounds: ${cleanVal(c.grounds.join(", "))}`,
    c.place ? `place: ${cleanVal(c.place)}` : "", `by: ${c.by}`, c.faction ? `faction: ${cleanVal(c.faction.name)} / ${cleanVal(c.faction.project)}` : "", c.push ? "push: yes" : "",
  ].filter(Boolean);
  return `arc new #${c.id}: ${c.kind} | ${f.join(" | ")}`;
}

export function beatLine(id: string, b: { result: BeatResult; roll: [number, number]; mod: number; at: number; text: string; told: "model" | "template"; twist?: string; place?: string; tick: string; next: number; note?: string; forced?: boolean }): string {
  const mod = b.mod ? `${b.mod > 0 ? "+" : "-"}${Math.abs(b.mod)}` : "";
  const f = [`roll: ${b.roll[0]}+${b.roll[1]}${mod}`, `at: ${b.at}`, b.twist ? `twist: ${cleanVal(b.twist)}` : "", b.place ? `place: ${cleanVal(b.place)}` : "", b.forced ? "forced: yes" : "", `tick: ${b.tick}`, `next: ${b.next}`, `told: ${b.told}`, b.note ? `note: ${cleanVal(b.note)}` : "", `text: ${cleanVal(b.text)}`].filter(Boolean);
  return `arc beat #${id}: ${b.result} | ${f.join(" | ")}`;
}
