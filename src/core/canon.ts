// The canon cutoff: where the story stands in its source ("Buffy, season 3, before Graduation"), and
// the names, events and reveals from later in it that haven't happened here. The note tells the model
// every turn; the check of each reply flags any of those words on the page that the story hasn't
// reached itself (said earlier in the chat, by the player, or in the card or lore); the model read
// looks for later canon the words don't catch. The model can suggest the list from the point.

import type { CanonCutoff } from "./types";
import { SAFETY_DATA } from "./prompts";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");

/** A term as a pattern: whole words, any case, "the" optional in front. */
export function termPattern(term: string): RegExp | null {
  const t = term.trim().replace(/^the\s+/i, "");
  if (t.length < 3) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:the\\s+)?${esc(t)}(?![\\p{L}\\p{N}])`, "iu");
}

/** The terms the story hasn't reached: on the list, and not yet in the chat, the card or the lore. */
export function liveTerms(cut: CanonCutoff | undefined, established: (re: RegExp) => boolean): string[] {
  if (!cut?.notYet?.length) return [];
  return cut.notYet.filter((t) => {
    const re = termPattern(t);
    return !!re && !established(re);
  });
}

/** The [CANON] lane: where the story stands, and what it hasn't reached. */
export function cutoffLane(cut: CanonCutoff | undefined, live: string[]): string {
  if (!cut?.point?.trim()) return "";
  const later = live.length ? ` Not yet happened, not known to anyone, never named or hinted at: ${live.slice(0, 24).join(", ")}.` : "";
  return `[CANON] This story stands at ${cut.point.trim()} in the source. Nothing from later in the source has happened or is known.${later} What the source has after this point is not this story's past: no foreshadowing it, no one remembering it.`;
}

/** Terms from later in the source on the page; each with the words around it. */
export function cutoffHits(page: string, live: string[], player: string): { term: string; quote: string }[] {
  const out: { term: string; quote: string }[] = [];
  for (const t of live) {
    const re = termPattern(t);
    if (!re || re.test(player)) continue;
    const m = re.exec(page);
    if (m) out.push({ term: t, quote: page.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60).replace(/\s+/g, " ").trim() });
  }
  return out;
}

/** The model suggests what comes after the point: short terms a leak would put on the page word for word. */
export function cutoffPrompt(point: string, context: string): { system: string; user: string } {
  return {
    system: `You know the source material of a roleplay well. ${SAFETY_DATA}
The player says where their story stands in the source. List what comes AFTER that point in the source: characters who haven't appeared yet, later villains, deaths, betrayals, identity reveals, places, objects, titles and coined terms. Each as a short term (one to four words) that a writer leaking it would put on the page word for word: a name ("Glory"), a title ("the Ascension"), a coined term ("the Initiative"). Never something already present by that point. At most 30, most telling first. When you don't know the source or the point, return an empty list.
Output JSON only: {"notYet":["term", "…"]}`,
    user: `<source>\nWhere the story stands: ${point}\n</source>${context ? `\n\n<story>\n${context.slice(0, 3000)}\n</story>` : ""}`,
  };
}

/** The list as the player edits it: one a line or comma-separated, no repeats. */
export function cleanTerms(raw: string | string[]): string[] {
  const list = (Array.isArray(raw) ? raw : raw.split(/\n|,(?![^()]*\))/)).map((t) => String(t).replace(/^[-*•\s]+/, "").trim()).filter((t) => t.length >= 3 && t.length <= 60);
  const seen = new Set<string>();
  return list.filter((t) => (seen.has(t.toLowerCase()) ? false : (seen.add(t.toLowerCase()), true))).slice(0, 60);
}
