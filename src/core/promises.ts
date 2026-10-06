// Promises made aloud: "I'll call you tomorrow", "meet me at the Bronze at nine", "I promise I'll
// be there". Read from what people say (the player's lines and the story's), each gets a window
// on the story clock: due when it opens, broken when it closes with nothing kept. A meeting is
// kept when both people are in the scene inside the window; anything else is kept or broken by
// a ledger line (`promise Xander>Buffy: call her | kept`) or by the player on the Now page.
// Keeping one warms the bond; breaking one cools it, and a broken promise can seed a rift
// in Elsewhere.

import type { SpokenLine } from "./types";
import { MIN_PER_DAY } from "./util";

export type PromiseKind = "meet" | "call" | "do";

export interface PromiseFound {
  /** The promiser's name as the line gives it (the player's lines: the persona). */
  who: string;
  /** Whom it's made to, when the line or the scene makes it plain. */
  whom?: string;
  /** What was promised, from the promiser's side ("call Buffy tomorrow"). */
  what: string;
  /** The words as said. */
  said: string;
  kind: PromiseKind;
  /** The window it's due in (absolute story minutes). */
  from: number;
  until: number;
  /** "tomorrow", "at 21:00", "in two hours". */
  when: string;
}

const NUMS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, few: 3, couple: 2, "a few": 3, "a couple of": 2, "a couple": 2 };

/** A spoken commitment: the clause after "I'll", "I promise", "meet me"… (never a refusal or a question). */
const LEAD = /\b(?:I(?:['’]ll| will| shall)|I['’]m (?:gonna|going to)|I promise(?: (?:to|that I['’]ll|I['’]ll|I will|you I['’]ll|you))?|we(?:['’]ll| will)|let['’]s)\s+(?!not\b|never\b)(.{2,90}?)(?=[.!?;]|,\s*(?:okay|ok|alright|yeah|I promise|promise)\b|$)/i;
const MEET = /\b(meet(?: (?:me|you|us|up))?(?= at\b| by\b| in\b| outside\b| tomorrow\b| tonight\b| after\b| before\b|\s*$)|meet (?:me|you|us)|see you|pick (?:you|me) up|come (?:by|over|round|back|get you|for you)|be there|be back|be home|wait for you|take you|walk you|drive you|stop by|swing by)\b/i;
const CALL = /\b(call|text|ring|phone|write|message|email|letter|send word)\b/i;
/** Said as a vow: "I promise", "I swear", "you have my word". */
const VOW = /\b(?:promise|swear(?! to (?:god|christ|—|-))|you have my word|word of hono(?:u)?r|cross my heart)\b/i;
const NOW_ISH = /\b(right back|in a (?:sec(?:ond)?|minute|moment|jiffy)|right now|just a (?:sec|minute|moment)|one (?:sec|second|minute))\b/i;

/** Where a time said aloud puts the window, from `now` (absolute minutes). Null when the words name no time. */
export function promiseWindow(text: string, now: number): { from: number; until: number; when: string } | null {
  const t = text.toLowerCase();
  const day = Math.floor(now / MIN_PER_DAY);
  const at = (d: number, m: number) => d * MIN_PER_DAY + m;
  const tomorrow = /\btomorrow\b/.test(t);
  const base = tomorrow ? day + 1 : day;
  // A clock time: "at nine", "at 9:30", "at 9pm", "by noon".
  const clock = /\b(?:at|by|around|about|before)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|o['’]clock)?\b|\b(?:at|by|around|before)\s+(noon|midnight|dawn|sunrise|sunset|sundown|dusk|nightfall|daybreak|first light)\b|\b(?:at|by)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/.exec(t);
  if (clock) {
    let minute: number;
    if (clock[4]) minute = { noon: 720, midnight: 0, dawn: 360, sunrise: 360, daybreak: 360, "first light": 360, sunset: 1140, sundown: 1140, dusk: 1170, nightfall: 1200 }[clock[4]]!;
    else {
      let h = clock[5] ? NUMS[clock[5]] : parseInt(clock[1], 10);
      const mi = clock[2] ? parseInt(clock[2], 10) : 0;
      if (h > 23 || mi > 59) return null;
      const ap = clock[3]?.replace(/\./g, "");
      if (ap === "pm" && h < 12) h += 12;
      else if (ap === "am" && h === 12) h = 0;
      else if (!ap || ap === "o'clock" || ap === "o’clock") {
        // No am/pm: the next time the clock shows it (tomorrow, the sensible hour of the day).
        if (tomorrow) h = h < 7 ? h + 12 : h;
        else if (h <= 12) {
          const am = at(day, (h % 12) * 60 + mi), pm = at(day, ((h % 12) + 12) * 60 + mi);
          const next = [am, pm, am + MIN_PER_DAY].find((x) => x > now + 15)!;
          return { from: next - 30, until: next + 120, when: `at ${fmtHm(next)}` };
        }
      }
      minute = h * 60 + mi;
    }
    let target = at(base, minute);
    if (target <= now + 15 && !tomorrow) target += MIN_PER_DAY;
    return { from: target - 30, until: target + 120, when: `${tomorrow ? "tomorrow " : ""}at ${fmtHm(target)}` };
  }
  // "in two hours", "in ten minutes", "in a few days", "in a week".
  const rel = /\bin\s+(\d{1,3}|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a few|a couple(?: of)?)\s+(minutes?|mins?|hours?|days?|weeks?)\b/.exec(t);
  if (rel) {
    const n = /^\d+$/.test(rel[1]) ? parseInt(rel[1], 10) : NUMS[rel[1]] ?? 1;
    const u = rel[2][0];
    const span = n * (u === "m" ? 1 : u === "h" ? 60 : u === "d" ? MIN_PER_DAY : 7 * MIN_PER_DAY);
    if (span < 30) return null;
    const target = now + span;
    if (u === "d" || u === "w") return { from: at(Math.floor(target / MIN_PER_DAY), 0), until: at(Math.floor(target / MIN_PER_DAY), MIN_PER_DAY - 1), when: `in ${rel[1]} ${rel[2]}` };
    return { from: target - Math.min(30, span / 2), until: target + Math.max(60, span / 2), when: `in ${rel[1]} ${rel[2]}` };
  }
  if (/\bnext week\b/.test(t)) return { from: at(day + 6, 0), until: at(day + 8, MIN_PER_DAY - 1), when: "next week" };
  // Parts of a day: "tomorrow morning", "tonight", "this evening", "first thing".
  const part = /\b(?:(?:this|tomorrow|in the)\s+)?(morning|afternoon|evening|night)\b|\btonight\b|\bfirst thing\b/.exec(t);
  if (tomorrow || part) {
    const w = part?.[1] ?? (/\btonight\b/.test(t) ? "night" : /\bfirst thing\b/.test(t) ? "morning" : "");
    const d = tomorrow || (/\bfirst thing\b/.test(t)) || (w === "morning" && now % MIN_PER_DAY >= 12 * 60) ? day + 1 : day;
    const span: Record<string, [number, number]> = { morning: [7 * 60, 12 * 60], afternoon: [12 * 60, 18 * 60], evening: [17 * 60, 23 * 60], night: [19 * 60, 26 * 60] };
    const [s, e] = span[w] ?? [0, MIN_PER_DAY - 1];
    const from = Math.max(at(d, s), now + 15), until = at(d, e);
    if (until <= now + 30) return null;
    return { from, until, when: d > day ? `tomorrow${w ? ` ${w}` : ""}` : w === "night" ? "tonight" : `this ${w}` };
  }
  return null;
}

function fmtHm(abs: number): string {
  const m = ((abs % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * The promises in what was said. `speaker` names who said a line (null: unknown, skipped);
 * `addressee` names whom it's to when the line or the scene makes it plain.
 */
export function promisesIn(lines: SpokenLine[], now: number, speaker: (l: SpokenLine) => string | null, addressee: (l: SpokenLine, who: string) => string | undefined): PromiseFound[] {
  const out: PromiseFound[] = [];
  for (const l of lines) {
    const who = speaker(l);
    if (!who) continue;
    for (const sent of l.text.split(/(?<=[.!?])\s+/)) {
      // A question, a line cut off mid-word ("I swear to — I will take that phone and —"), or right now.
      if (/\?\s*$/.test(sent) || /[—–-]\s*["”]?\s*$/.test(sent) || NOW_ISH.test(sent)) continue;
      const lead = LEAD.exec(sent);
      const meet = MEET.exec(sent);
      if (!lead && !meet) continue;
      const vowed = VOW.test(sent);
      // A promise here has a time to keep it by; "I promise I'll never leave" is a vow, not a date.
      const win = promiseWindow(sent, now);
      if (!win) continue;
      // Wishes and habits: "can't wait to see you tomorrow", "every morning I'll take you".
      if (/\b(?:can(?:no|['’])t wait to|hope to|want to|would love to|looking forward to|wish I could)\b/i.test(sent) || /\b(?:every|each)\s+(?:morning|day|night|evening|week)\b|\balways\b|\bif (?:I|we) (?:have|need|must)\b/i.test(sent)) continue;
      // "I'll miss you tomorrow", "I'll be tired tomorrow": feelings and states aren't promises.
      const clause = (lead?.[1] ?? sent.slice(meet!.index)).trim();
      if (/^(?:be (?:fine|okay|ok|alright|tired|sad|late|sorry|careful|safe)|miss|need|have to|probably|maybe|try|see\b(?! you)|think|feel|know|bet|never|always)\b/i.test(clause) && !meet) continue;
      const kind: PromiseKind = MEET.test(clause) || meet ? "meet" : CALL.test(clause) ? "call" : "do";
      // "I'll make pancakes tomorrow", "we'll deal with it tomorrow": plans and deferrals, unless vowed.
      if (kind === "do" && !vowed) continue;
      if (lead && /^(?:we|let)/i.test(lead[0]) && kind !== "meet" && !vowed) continue;
      const whom = addressee(l, who);
      const what = clause
        .replace(/^(?:to|that)\s+/i, "")
        // "Meet me at nine" from the promiser's side: meet whom it's to.
        .replace(/^(meet|see|pick)\s+me\b/i, (_, v: string) => `${v.toLowerCase()} you`)
        .replace(/[.!]+$/, "")
        .replace(/\b(?:okay|ok|alright|yeah|I promise|promise)\b[,.]?\s*$/i, "")
        .replace(/\byour\b/gi, whom ? `${whom}'s` : "your")
        .replace(/\byou\b/gi, whom ?? "you")
        .replace(/\s+/g, " ").trim().slice(0, 90);
      if (what.length < 3) continue;
      out.push({ who, ...(whom ? { whom } : {}), what, said: sent.trim().slice(0, 160), kind, from: win.from, until: win.until, when: win.when });
    }
  }
  return out;
}

/** A name said at the start or the end of a line ("Buffy, I'll call you", "I'll be there, Willow"). */
export function vocative(text: string, names: string[]): string | undefined {
  for (const n of names.filter((x) => x && x.length >= 2)) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`^\\s*(?:hey,?\\s+|oh,?\\s+)?${esc}\\b\\s*[,!—–-]`, "i").test(text) || new RegExp(`[,—–]\\s*${esc}\\s*[.!?]*\\s*$`, "i").test(text)) return n;
  }
  return undefined;
}
