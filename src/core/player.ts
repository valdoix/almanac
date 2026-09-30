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
  // In an aside or opening the message: "The next morning.", "((three hours later))"
  const lead = [...asides(text), t.slice(0, 80)].join(" \n ");
  const next = /\b(?:the\s+)?(?:next|following)\s+(morning|day|evening|night)\b/i.exec(lead);
  if (next && ctx.day != null) {
    const minute = { morning: 8 * 60, day: 9 * 60, evening: 19 * 60, night: 22 * 60 }[next[1].toLowerCase() as "morning"];
    return { op: "clock", args: { kind: "abs", day: ctx.day + 1, minute, fromPlayer: true }, raw: `(you said) ${next[0].trim()}` };
  }
  const later = /\b(\d{1,3}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|several|few)\s+(minutes?|hours?|days?|weeks?)\s+later\b/i.exec(lead);
  if (later) {
    const n = /^\d+$/.test(later[1]) ? parseInt(later[1], 10) : WORD_NUM[later[1].toLowerCase()] ?? 1;
    const u = later[2].toLowerCase()[0];
    const minutes = n * (u === "m" ? 1 : u === "h" ? 60 : u === "d" ? 1440 : 10080);
    return { op: "clock", args: { kind: "rel", minutes, fromPlayer: true }, raw: `(you said) ${later[0].trim()}` };
  }
  return null;
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
