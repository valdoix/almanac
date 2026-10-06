// Character journals: after a night's sleep, the people who carried the day write a few lines about
// it, in their own voice, from what they saw and what they kept to themselves (their thoughts in the
// Unspoken register). Read in the drawer only: they add depth without taking up the page or the
// prompt. Never for a sealed persona (their mind is the player's), never about what they didn't see.

import type { WorldState } from "./types";
import { SAFETY_DATA } from "./prompts";

export interface JournalEntry {
  day: number;
  text: string;
  /** The last message of the day it covers (an entry for a branch no longer on the path is hidden). */
  msgId: string;
  msgIndex: number;
  at: number;
}

/** The story day each message ends on, from the clock events filed with it (a message without one keeps the day before). */
export function dayOfMessages(events: { msgIndex: number; at?: { day: number } | null }[], count: number): number[] {
  const last: Record<number, number> = {};
  for (const e of events) if (e.at) last[e.msgIndex] = e.at.day;
  const out: number[] = [];
  let d = 0;
  for (let i = 0; i < count; i++) {
    if (last[i] != null) d = last[i];
    out.push(d);
  }
  return out;
}

/**
 * Who writes about a day: the people (not the player's sealed persona) who spoke most in its
 * messages, alive and still in the story. At most `max`.
 */
export function writersFor(st: WorldState, spoke: Record<string, number>, opts: { sealed: boolean; max?: number }): string[] {
  return Object.entries(spoke)
    .filter(([id, n]) => n >= 2 && st.chars[id] && !st.chars[id].dead && !(id === "user" && opts.sealed))
    .sort((a, b) => b[1] - a[1])
    .slice(0, opts.max ?? 2)
    .map(([id]) => id);
}

export function journalPrompt(o: { name: string; day: number; date?: string; transcript: string; thoughts: string[]; about: string; userName: string; never: string[] }): { system: string; user: string } {
  return {
    system: `You write one private diary entry in the voice of ${o.name}, a character in a roleplay story. ${SAFETY_DATA}
It is the night after story day ${o.day}${o.date ? ` (${o.date})` : ""}. Write what ${o.name} would put down about that day: what happened as ${o.name} saw it, what it meant to them, what they feel and won't say aloud. First person, their own voice and vocabulary, 70 to 150 words, plain prose, no heading or date line.
Only what ${o.name} saw, heard or was told that day, and what they already knew; nothing that happened out of their sight, nothing anyone else privately thought. Add no events. Don't decide anything about ${o.userName}'s inner life; ${o.name} may only guess at it.${o.never.length ? ` Never write these words: ${o.never.join(", ")}.` : ""}`,
    user: `<story>\nWho ${o.name} is: ${o.about || "(see the day)"}\n\nThe day, as it happened:\n${o.transcript}${o.thoughts.length ? `\n\nWhat ${o.name} thought and didn't say:\n${o.thoughts.map((t) => `- ${t}`).join("\n")}` : ""}\n</story>`,
  };
}

/** The entry as written: no quotes around it, no "Dear diary" date line, no ledger. */
export function cleanEntry(text: string): string {
  return text
    .replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, " ")
    .replace(/^\s*(?:["“]|\*\*?)?(?:day \d+|dear diary|entry|journal)[^\n]{0,60}\n+/i, "")
    .replace(/^\s*["“]|["”]\s*$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1400);
}
