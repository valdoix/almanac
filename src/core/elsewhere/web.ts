// How subplots bear on each other (design/09 §20). Two subplots that share a person are tied: each
// step of one is news to the other. The engine reads three things from the ties, all from what is
// already in the subplots (nothing stored):
// - what the other subplot did last (the telling continues in step with it, never against it);
// - what it settled about a shared person ("Willow's magic is gone"), which stands until a step undoes it;
// - which way it pulls: a subplot out to help someone, or to work against them, turns the dice of
//   the other by its own outcome ("Valeria took Willow's magic": Willow's next step is harder).

import type { ArcKind, ArcState } from "../types";
import type { Actor, Roster } from "./roster";

/** One step of a subplot (a beat or its ending), as the others see it. */
export interface ArcEvent {
  arcId: string;
  lead: string;
  kind: ArcKind;
  result: string;
  text: string;
  atAbs: number;
  ending?: boolean;
}

export interface Bearing {
  arcId: string;
  lead: string;
  kind: ArcKind;
  /** The person both subplots have in them. */
  person: string;
  /** Which way one of the two pulls on the other's lead, or neither. */
  stance: "for" | "against" | "shared";
  /** Whose pull it is: the other subplot on this one's lead ("theirs"), or this one on the other's lead ("mine"). */
  dir?: "theirs" | "mine";
  /** Its latest step (or ending) before this one. */
  text: string;
  atAbs: number;
  ending: boolean;
  /** It came after this subplot's own last step: this step answers it. */
  fresh: boolean;
  /** What it does to this subplot's next roll. */
  mod: number;
}

/** Something a subplot settled about a person that stands until a later step undoes it. */
export interface Condition {
  person: string;
  thing: string;
  /** "Willow's magic is gone". */
  text: string;
  arcId: string;
  lead: string;
  kind: ArcKind;
  atAbs: number;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const low = (s: string) => s.toLowerCase();
/** How far back another subplot's step still counts as "meanwhile". */
const WINDOW = 2 * 1440;

/** The people (not groups) in a subplot, by their roster names. */
export function peopleOf(arc: ArcState, r: Roster): Actor[] {
  const out: Actor[] = [];
  for (const n of [arc.lead, ...arc.cast]) {
    const a = r.find(n);
    if (a && !a.group && !out.includes(a)) out.push(a);
  }
  return out;
}

/** The people two subplots share. */
export function shared(a: ArcState, b: ArcState, r: Roster): Actor[] {
  const pb = peopleOf(b, r);
  return peopleOf(a, r).filter((x) => pb.includes(x));
}

/** People two subplots share where one of them is about that person (its lead): Buffy in two casts isn't a tie. */
export function tied(a: ArcState, b: ArcState, r: Roster): Actor[] {
  const leads = [r.find(a.lead), r.find(b.lead)];
  return shared(a, b, r).filter((x) => leads.includes(x));
}

/** Every step a subplot has taken, oldest first: its beats, then its ending. */
export function eventsOf(arc: ArcState): ArcEvent[] {
  const ev: ArcEvent[] = arc.beats.map((b) => ({ arcId: arc.id, lead: arc.lead, kind: arc.kind, result: b.result, text: b.text, atAbs: b.atAbs }));
  if (arc.ending && (arc.status === "resolved" || arc.status === "dropped")) ev.push({ arcId: arc.id, lead: arc.lead, kind: arc.kind, result: arc.ending.result, text: arc.ending.text, atAbs: arc.ending.atAbs, ending: true });
  return ev;
}

const AGAINST = "take(?:s|n)? away|takes?|took|strip(?:s|ped)?|bind(?:s)?|bound|stop(?:s|ped)?|expose(?:s|d)?|punish(?:es|ed)?|kill(?:s|ed)?|destroy(?:s|ed)?|defeat(?:s|ed)?|ruin(?:s|ed)?|hunt(?:s|ed)?(?: down)?|capture(?:s|d)?|arrest(?:s|ed)?|banish(?:es|ed)?|curse(?:s|d)?|betray(?:s|ed)?|undermine(?:s|d)?|discredit(?:s|ed)?|get rid of|be rid of|drive out|turn (?:\\w+ )?against";
const FOR = "help(?:s|ed)?|protect(?:s|ed)?|save(?:s|d)?|rescue(?:s|d)?|steer(?:s|ed)?|support(?:s|ed)?|heal(?:s|ed)?|guard(?:s|ed)?|shield(?:s|ed)?|warn(?:s|ed)?|comfort(?:s|ed)?|free(?:s|d)?|look after|stand by|keep (?:\\w+ )?safe|bring (?:\\w+ )?back|reach(?:es)?|win (?:\\w+ )?back";

/** Which way a subplot pulls on someone in it who isn't its lead: what its want (or premise) sets out to do to them. */
export function aimAt(arc: ArcState, person: Actor): "for" | "against" | "shared" {
  if (person.names.some((n) => low(n) === low(arc.lead))) return "shared";
  const names = [...new Set(person.names.flatMap((n) => [n, n.split(/\s+/)[0]]))].filter((n) => n.length >= 3).map(esc).join("|");
  if (!names) return "shared";
  for (const text of [arc.want, arc.premise]) {
    const near = (verbs: string) => new RegExp(`\\b(?:${verbs})\\b(?:\\s+[\\w'’-]+){0,4}?\\s+(?:${names})\\b`, "i").test(text);
    // The want first: what the lead is after is what they do to the other.
    if (near(AGAINST)) return "against";
    if (near(FOR)) return "for";
  }
  return "shared";
}

/** How a step went for its lead: +1 their way, -1 against them, 0 neither. */
const swing = (result: string) => (["win", "cost", "met", "price"].includes(result) ? 1 : ["loss", "lost"].includes(result) ? -1 : 0);

const THING = "dark magic|magic|magick|powers?|abilities|strength|memor(?:y|ies)|soul|sight|voice|wings|immortality|slayer powers";
/** Things of a kind: a subplot about dark magic is about the magic that was taken. */
const KIN: string[][] = [["magic", "magick", "dark magic", "power", "powers", "abilities", "spell", "spells", "spellwork", "witchcraft", "slayer powers"], ["memory", "memories"], ["sight", "eyes"]];
const kin = (thing: string) => KIN.find((k) => k.includes(low(thing))) ?? [low(thing)];
/** Words that make a sentence say what someone means or tries to do, not what happened. */
const NOT_DONE = /\b(?:to|would|will|could|might|n't|not|never|almost|nearly|about to|set to|means? to|plans? to|going to|tried to|try to|before|until|if|whether)\s+$/i;

/** What a step settles about the people in it: something taken from them, or given back. */
export function settled(text: string, r: Roster): { person: Actor; thing: string; gone: boolean }[] {
  const out: { person: Actor; thing: string; gone: boolean }[] = [];
  const people = r.actors.filter((a) => !a.group);
  for (const s of text.split(/(?<=[.!?;])\s+|\s+[—–]\s+/)) {
    if (/\b(?:stopped short|not yet|isn't|wasn't|didn't|did not|hasn't|failed to)\b/i.test(s)) continue;
    for (const a of people) {
      const names = [...new Set(a.names.flatMap((n) => [n, n.split(/\s+/)[0]]))].filter((n) => n.length >= 3).map(esc).join("|");
      if (!names) continue;
      const N = `(?:${names})`;
      const T = `(?:\\w+\\s+)?(${THING})`;
      const POSS = `(?:her|his|their|its)`;
      const tests: [RegExp, boolean][] = [
        [new RegExp(`\\b(?:took|taken|stripped|stole|stolen|drained|bound|sealed|removed|ripped (?:out|away)|burned out|cut off)\\s+(?:away\\s+)?${N}['’]s\\s+${T}`, "i"), true],
        [new RegExp(`\\b${N}['’]s\\s+${T}\\s+(?:is|was|were|are|has been|had been|now)?\\s*(?:now\\s+|all\\s+)?(?:gone|taken|stripped|bound|drained|sealed|removed|lost)\\b`, "i"), true],
        [new RegExp(`\\b(?:stripped|drained|robbed|emptied)\\s+${N}\\s+of\\s+(?:${POSS}\\s+)?${T}`, "i"), true],
        [new RegExp(`\\b${N}\\s+(?:is|was)\\s+(?:now\\s+)?(?:left\\s+)?without\\s+(?:${POSS}\\s+)?${T}`, "i"), true],
        [new RegExp(`\\b${N}\\s+(?:has\\s+)?(?:lost|no longer has)\\s+${POSS}\\s+${T}`, "i"), true],
        [new RegExp(`\\b${N}['’]s\\s+${T}\\s+(?:is|was|were|are|has|have|came|come)\\s+(?:now\\s+)?(?:back|restored|returned|come back)\\b`, "i"), false],
        [new RegExp(`\\b${N}\\s+(?:got|gets|won|has|took)\\s+${POSS}\\s+${T}\\s+back\\b`, "i"), false],
        [new RegExp(`\\b${N}\\s+(?:regained|recovered)\\s+${POSS}\\s+${T}`, "i"), false],
        [new RegExp(`\\b(?:restored|returned|gave back)\\s+${N}['’]s\\s+${T}`, "i"), false],
      ];
      for (const [re, gone] of tests) {
        const m = re.exec(s);
        if (!m || NOT_DONE.test(s.slice(0, m.index))) continue;
        const thing = low(m[1]);
        if (!out.some((x) => x.person === a && kin(x.thing).includes(thing))) out.push({ person: a, thing, gone });
        break;
      }
    }
  }
  return out;
}

/** What stands about these people now: the latest word on each thing taken from them. */
export function conditionsFor(people: Actor[], all: ArcEvent[], before: number): Condition[] {
  const latest = new Map<string, Condition | null>();
  const r = { actors: people } as Roster;
  for (const ev of [...all].filter((e) => e.atAbs <= before).sort((a, b) => a.atAbs - b.atAbs)) {
    for (const s of settled(ev.text, r)) {
      const k = `${s.person.key}|${kin(s.thing)[0]}`;
      latest.set(k, s.gone ? { person: s.person.name, thing: s.thing, text: `${s.person.name}'s ${s.thing} ${/(?:s|ies)$/.test(s.thing) ? "are" : "is"} gone`, arcId: ev.arcId, lead: ev.lead, kind: ev.kind, atAbs: ev.atAbs } : null);
    }
  }
  return [...latest.values()].filter((c): c is Condition => !!c);
}

/** Whether a subplot's own words are about this thing ("dark magic" is about the magic). */
export function touches(arc: ArcState, thing: string): boolean {
  const words = kin(thing);
  const text = low(`${arc.premise} ${arc.want} ${arc.fear} ${arc.beats.at(-1)?.text ?? ""}`);
  return words.some((w) => new RegExp(`\\b${esc(w)}\\b`).test(text));
}

/**
 * How the other subplots bear on this one at `atAbs`: one bearing per tied subplot, its latest step
 * before then (within two story days, or its ending). `extra` adds steps taken earlier in this tick.
 */
export function bearingsOn(arc: ArcState, arcs: ArcState[], r: Roster, atAbs: number, extra: ArcEvent[] = []): Bearing[] {
  const mine = peopleOf(arc, r);
  if (!mine.length) return [];
  const since = arc.beats.filter((b) => b.atAbs < atAbs).at(-1)?.atAbs ?? arc.startedAbs;
  const lead = r.find(arc.lead);
  const out: Bearing[] = [];
  for (const o of arcs) {
    // A dropped subplot stopped: what it last did no longer moves anyone.
    if (o.id === arc.id || o.status === "dropped") continue;
    const both = tied(arc, o, r);
    if (!both.length) continue;
    const ev = [...eventsOf(o), ...extra.filter((e) => e.arcId === o.id)].filter((e) => e.atAbs <= atAbs).sort((a, b) => a.atAbs - b.atAbs).at(-1);
    if (!ev || (atAbs - ev.atAbs > WINDOW && !ev.ending) || atAbs - ev.atAbs > 3 * WINDOW) continue;
    // After this subplot's last step (or, before its first, from its start on).
    const fresh = arc.beats.some((b) => b.atAbs < atAbs) ? ev.atAbs > since : ev.atAbs >= since;
    // Which way it pulls: the other subplot at this one's lead, or this one at the other's lead.
    const oLead = r.find(o.lead);
    let stance: Bearing["stance"] = "shared";
    let dir: Bearing["dir"];
    let person = both[0];
    let mod = 0;
    const g = swing(ev.result);
    // Theirs: helping this lead turns the dice their way when it goes well; working against them, by how it went.
    if (lead && !lead.group && both.includes(lead)) {
      const s = aimAt(o, lead);
      if (s !== "shared") (stance = s), (dir = "theirs"), (person = lead), (mod = s === "for" ? Math.max(0, g) : -g);
    }
    // Mine: the one this subplot helps doing well (or badly) is its own headway (or setback); the one it works against, the reverse.
    if (stance === "shared" && oLead && !oLead.group && both.includes(oLead)) {
      const s = aimAt(arc, oLead);
      if (s !== "shared") (stance = s), (dir = "mine"), (person = oLead), (mod = s === "for" ? g : -g);
    }
    out.push({ arcId: o.id, lead: o.lead, kind: o.kind, person: person.name, stance, dir, text: ev.text, atAbs: ev.atAbs, ending: !!ev.ending, fresh, mod: fresh ? mod : 0 });
  }
  return out.sort((a, b) => Number(b.fresh) - Number(a.fresh) || b.atAbs - a.atAbs);
}

/** What the ties do to this subplot's next roll: the fresh pulls, at most one step either way. */
export function webMod(bs: Bearing[]): { mod: number; why: string[] } {
  const pulls = bs.filter((b) => b.mod);
  const mod = Math.max(-1, Math.min(1, pulls.reduce((s, b) => s + b.mod, 0)));
  return { mod, why: mod ? pulls.filter((b) => Math.sign(b.mod) === Math.sign(mod)).map(pullWords) : [] };
}

/** A pull in words: "Valeria's duty went against Willow", "Willow's own decline went badly". */
export function pullWords(b: Bearing): string {
  if (b.dir === "theirs") return `${b.lead}'s ${b.kind} ${b.stance === "for" ? `helped ${b.person}` : `went against ${b.person}`}`;
  return `${b.person}'s own ${b.kind} went ${(b.mod > 0) === (b.stance === "for") ? "well" : "badly"}`;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : s);

/** The card's MEANWHILE lines: what the tied subplots did, newest that this step answers first. */
export function meanwhileLines(bs: Bearing[]): string[] {
  const label = (b: Bearing) => (b.dir === "theirs" ? (b.stance === "for" ? ` (on ${b.person}'s side)` : ` (against ${b.person})`) : b.dir === "mine" ? ` (${b.person}'s own story; this subplot is ${b.stance === "for" ? `on ${b.person}'s side` : `against ${b.person}`})` : "");
  return bs.slice(0, 3).map((b) => `${b.lead}'s ${b.kind}${label(b)}${b.ending ? ", ended" : ""}: ${clip(b.text, 220)}${b.fresh ? " [since this subplot's last step]" : ""}`);
}

/** The card's STANDS lines: what is settled about its people, which this step may not undo by itself. */
export function standsLines(cs: Condition[], since: number, first = false): string[] {
  return cs.slice(0, 3).map((c) => `${c.text} (from ${c.lead}'s ${c.kind})${c.atAbs > since || (first && c.atAbs >= since) ? " [new since this subplot's last step: this step follows from it]" : ""}`);
}
