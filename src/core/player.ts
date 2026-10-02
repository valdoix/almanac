// Facts the player states in their own messages. The player writes what is true ("THIS IS DAY 26 -
// FIRST MOON 27", "Daeron has violet eyes", "((truth: Jaime and Cersei are strictly family))"), and
// the model may not file it. These rules read the plain cases; the optional model read (backend,
// playerfacts.ts) files the rest after the reply. Everything here is the player's word: source "user".

import type { ParsedOp } from "./types";
import { traitsStated } from "./traits";

export interface PlayerCtx {
  /** Names the story knows (the player's persona included). */
  names: string[];
  /** The story day now, for dates that name a day of the calendar. */
  day: number | null;
  /** The day a calendar date names ("Second Moon 7", "17 October"), near the current day. */
  dayOfDate?: (text: string, nearDay: number) => number | null;
  /** Who "she" or "he" (or "I") is in this scene, when only one person present fits. */
  pronoun?: (word: "she" | "he" | "i") => string | null;
}

/** "He's wearing", "is dressed in", "changes into": what follows is what someone wears. */
const WEARS = /^(?:\s+(?:is|are)\s+(?:now\s+|still\s+)?(?:wearing|dressed in)|\s+(?:wears?|changes? into|changed into|puts? on|pulls? on|pulled on|slips? into|slipped into))\s+/i;

/** "He's wearing green pajamas. She's wearing blue pajamas.": what someone wears, said outright. */
export function looksStated(text: string, ctx: PlayerCtx): { who: string; text: string; add?: boolean }[] {
  // Narration only: what someone says aloud isn't the player's word on the scene.
  const t = text.replace(/"[^"\n]*"|“[^”\n]*”/g, " ");
  const out: { who: string; text: string; add?: boolean }[] = [];
  const names = ctx.names.filter((n) => n && n.length >= 2);
  const lower = new Map(names.map((n) => [n.toLowerCase(), n]));
  // A name or a pronoun, then "'s wearing", "is dressed in", "wears"…; "She's" and "I'm" read as "… is".
  for (const m of t.matchAll(/(?<![\p{L}'’])(\p{L}[\p{L}-]*)(['’][sm]\b|\s+am\b)?/gu)) {
    const w = m[1].toLowerCase();
    const who = w === "she" || w === "he" || w === "i" ? ctx.pronoun?.(w) : lower.get(w);
    if (!who) continue;
    const rest = (m[2] ? " is" : "") + t.slice(m.index + m[0].length);
    const verb = WEARS.exec(rest);
    if (!verb) continue;
    const what = /^([^.;!?\n]{3,80}?)(?=\s+(?:and|while|as|but|then)\s+(?:she|he|I|they|\p{Lu}\p{L}+)\b|[.;!?\n]|$)/u.exec(rest.slice(verb[0].length));
    // "Puts on glasses" adds to what they wear; "is wearing", "changes into" says all of it.
    if (what) out.push({ who, text: what[1].replace(/[*_]/g, "").trim(), ...(/\b(?:puts?|put|pulls?|pulled|slips?|slipped) (?:on|into)\b/i.test(verb[0]) ? { add: true } : {}) });
  }
  return out;
}

/** Out-of-character asides and direction lines: where a player states facts. */
function asides(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\(\(([\s\S]{2,600}?)\)\)|\[OOC[:\s]([^\]]{2,600})\]|^\s*(?:OOC|Next turn(?: should include)?|Note)\s*:\s*(.+)$/gim)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, several: 3, few: 3 };

/** Clock lines the player's message sets. Only plain statements count ("it's day 12"), never a story's "on day 12 of her captivity". */
export function playerClock(text: string, ctx: PlayerCtx): ParsedOp | null {
  const t = text.replace(/\s+/g, " ");
  const said = /\b(?:it'?s|it is|this is|today is|we'?re on|now it'?s|now)\s+(?:the\s+)?day\s+(\d{1,4})\b/i.exec(t) ?? /(?:^|\(\(|\n)\s*day\s+(\d{1,4})\s*(?:[-–—:,.]|$)/i.exec(text);
  const timeOf = (s: string) => {
    const m = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/i.exec(s);
    if (!m) return undefined;
    let h = parseInt(m[1] ?? m[4], 10);
    const mi = parseInt(m[2] ?? m[5] ?? "0", 10);
    if (m[3]?.toLowerCase() === "pm" && h < 12) h += 12;
    if (m[3]?.toLowerCase() === "am" && h === 12) h = 0;
    return (h % 24) * 60 + (mi % 60);
  };
  if (said) {
    const day = parseInt(said[1], 10);
    if (day >= 1) return { op: "clock", args: { kind: "abs", day, minute: timeOf(t.slice(said.index, said.index + 60)), keepMinute: true, fromPlayer: true }, raw: `(you said) ${said[0].trim()}` };
  }
  // "It's Second Moon 7", "today is the 17th of October"
  const date = /\b(?:it'?s|it is|this is|today is|now it'?s)\s+(?:the\s+)?([^.!?\n()]{3,40})/i.exec(t);
  if (date && ctx.dayOfDate && ctx.day != null) {
    const day = ctx.dayOfDate(date[1], ctx.day);
    if (day != null) return { op: "clock", args: { kind: "abs", day, minute: timeOf(date[1]), keepMinute: true, fromPlayer: true }, raw: `(you said) ${date[0].trim()}` };
  }
  // A time said outright: "it's 15:15", "it's now 3:15 pm", "the clock reads 15:15". Not "it's 1111".
  const clockSaid = /\b(?:it'?s|it is|now it'?s|the time is|the clock (?:says|reads|shows))\s+(?:now\s+|already\s+|just\s+(?:past|after)\s+|about\s+|around\s+)?(\d{1,2}:\d{2}(?:\s*[ap]\.?m\b\.?)?|\d{1,2}\s*[ap]\.?m\b\.?)/i.exec(t);
  const saidMinute = clockSaid ? timeOf(clockSaid[1].replace(/\./g, "")) : undefined;
  // In an aside or opening the message: "The next morning.", "((three hours later))"
  const lead = [...asides(text), t.slice(0, 80)].join(" \n ");
  const next = /\b(?:the\s+)?(?:next|following)\s+(morning|day|evening|night)\b/i.exec(lead);
  if (next && ctx.day != null) {
    // "The next day. … It is now 7:45": the day moves and the stated time holds.
    const minute = saidMinute ?? { morning: 8 * 60, day: 9 * 60, evening: 19 * 60, night: 22 * 60 }[next[1].toLowerCase() as "morning"];
    return { op: "clock", args: { kind: "abs", day: ctx.day + 1, minute, fromPlayer: true }, raw: `(you said) ${next[0].trim()}${clockSaid ? ` · ${clockSaid[0].trim()}` : ""}` };
  }
  if (saidMinute != null) return { op: "clock", args: { kind: "abs", minute: saidMinute, fromPlayer: true }, raw: `(you said) ${clockSaid![0].trim()}` };
  const later = /\b(\d{1,3}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|several|few)\s+(minutes?|hours?|days?|weeks?)\s+later\b/i.exec(lead);
  if (later) {
    const n = /^\d+$/.test(later[1]) ? parseInt(later[1], 10) : WORD_NUM[later[1].toLowerCase()] ?? 1;
    const u = later[2].toLowerCase()[0];
    const minutes = n * (u === "m" ? 1 : u === "h" ? 60 : u === "d" ? 1440 : 10080);
    return { op: "clock", args: { kind: "rel", minutes, fromPlayer: true }, raw: `(you said) ${later[0].trim()}` };
  }
  return null;
}

/** A note the reader added to its own line ("— player-stated, suggests a pet", "— per Gabriel"): a guess or someone's view, not a fact. */
const HEDGED = /\s[—–-]\s+(?:[^—–]*\b(?:player[- ]stated|suggests?|implie[sd]|seems?|maybe|perhaps|probably|per \p{Lu}[\p{L}'’-]*|according to|joking(?:ly)?|figure of speech)\b)/iu;
/** What happens or passes through someone in the scene, not a lasting fact about them. */
const SCENE = /^(?:recogni[sz]es|reali[sz]es|notices|thinks|believes|feels|wonders|sees|watches|decides|is (?:now )?(?:watching|thinking|feeling))\b/i;

/**
 * A line the player-facts reader filed, as far as the player's message bears it out. A trait about a
 * qualified or several people ("Buffy (Gabriel's sister)", "Buffy and Dawn") is a guess at who; a name
 * the message never uses ("is Xander's daughter" when Xander isn't in it) was made up; a hedged line
 * is someone's view or a guess. Null when nothing of it stands.
 */
export function keepPlayerOp(op: ParsedOp, message: string, known: string[] = []): ParsedOp | null {
  const raw = op.raw ?? "";
  if (HEDGED.test(raw)) return null;
  // The player's own character goes by "he" or "I" in their messages: their names always count.
  const own = new Set(known.flatMap((n) => n.toLowerCase().split(/\s+/)));
  const said = (w: string) => own.has(w.toLowerCase()) || new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "iu").test(message);
  // Every name in the line is one the message uses.
  const madeUp = (text: string) => (text.match(/(?<![\p{L}'’])\p{Lu}[\p{L}'’-]+/gu) ?? []).map((w) => w.replace(/['’]s$/, "")).some((w) => !said(w) && !/^(I|I'm|The|A|An|He|She|They|It|His|Her|Their|My|Mr|Mrs|Ms|Dr)$/.test(w));
  // An item line says who has it ("Thing: → Holder"); "pool: large with a jacuzzi" describes a place.
  if (op.op === "item" && !/:\s*(?:→|->)/.test(raw)) return null;
  // Whose it is, as the message says it: "Buffy's mom's" when the message only says "my mom" is a guess.
  for (const m of (op.op === "item" ? op.subject ?? "" : "").matchAll(/(\p{Lu}[\p{L}-]+)['’]s\s+(\p{L}+)/gu)) {
    if (own.has(m[1].toLowerCase())) continue;
    if (!new RegExp(`${m[1]}['’]s\\s+${m[2]}`, "iu").test(message)) return null;
  }
  if (op.op !== "trait") {
    // The thing's own name counts too ("Buffy's mom's therapist's contact"); the reader's note after a dash doesn't.
    const text = `${op.op === "item" ? op.subject ?? "" : ""} ${String(op.args.text ?? raw.replace(/^[^:]*:/, "")).split(/\s[—–]\s/)[0]}`;
    return madeUp(text) ? null : op;
  }
  const who = (op.subject ?? "").trim();
  if (!who || /[()[\],&]|\band\b|\bor\b/i.test(who)) return null;
  const traits = ((op.args.traits ?? []) as { kind: string; text: string }[]).filter((t) => !/\(kept where\)|\?/.test(t.text) && !SCENE.test(t.text.trim()) && !madeUp(t.text));
  if (!traits.length) return null;
  return { ...op, args: { ...op.args, traits }, raw: `trait ${who}: ${traits.map((t) => t.text).join("; ")}` };
}

/** Everything the rules can read from one player message. */
export function playerOps(text: string, ctx: PlayerCtx): ParsedOp[] {
  const ops: ParsedOp[] = [];
  const clock = playerClock(text, ctx);
  if (clock) ops.push(clock);
  // Looks and ages said outright, about someone the story knows.
  const byWho = new Map<string, { kind: any; text: string }[]>();
  for (const x of traitsStated(text, ctx.names)) byWho.set(x.who, [...(byWho.get(x.who) ?? []), { kind: x.kind, text: x.text }]);
  for (const [who, traits] of byWho) ops.push({ op: "trait", subject: who, args: { traits }, raw: `(you said) ${who}: ${traits.map((t) => t.text).join(", ")}` });
  // What someone wears, said outright ("She's wearing blue pajamas"): the latest line per person.
  const wears = new Map(looksStated(text, ctx).map((x) => [x.who, x]));
  for (const [who, { text: look, add }] of wears) ops.push({ op: "look", subject: who, args: { text: look, ...(add ? { add } : {}) }, raw: `(you said) look ${who}: ${add ? "+ " : ""}${look}` });
  // Pinned lines in an aside: ((truth: …)) · ((canon: …)) · ((bit: …))
  for (const a of asides(text)) {
    const m = /^\s*(truth|canon|fact|bit|motif|running joke)\s*:\s*(.{3,300})$/i.exec(a.trim());
    if (!m) continue;
    const kind = m[1].toLowerCase();
    if (kind === "bit" || kind === "motif" || kind === "running joke") ops.push({ op: "motif", args: { text: m[2].trim() }, raw: `(you said) ${a.trim()}` });
    else ops.push({ op: "canon", args: { text: m[2].trim(), pinned: kind === "truth" }, raw: `(you said) ${a.trim()}` });
  }
  return ops;
}
