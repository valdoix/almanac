// Off the page: a secret the story hasn't let out yet stays out of the narration, the thoughts, the
// Unspoken register and the chapter summaries, not only out of other characters' mouths. The
// knowledge firewall stops people acting on what they lack; this stops the page itself from
// spoiling it ("Buffy was in Heaven" named in narration before the scene that reveals it).
//
// A secret is kept off the page when it has words that must not appear yet: the model's own
// `secret … | never say: Heaven`, or the player's on the Knowledge page. It stays off until it
// comes out in the open, or until everyone it was kept from has it.

import type { FactState, WorldState } from "./types";

export interface OffPage {
  key: string;
  statement: string;
  words: string[];
  wording?: string;
  keepers: string[];
  by: "user" | "auto";
}

/** Whether a fact is still kept off the page. `auto`: honour the model's own `never say` words. */
export function isOffPage(f: FactState, auto: boolean): boolean {
  const o = f.offPage;
  if (!o || o.off || f.hidden) return false;
  if (o.by !== "user" && !auto) return false;
  if (!o.words.length && !o.wording) return false;
  if (f.out?.length) return false;
  const kept = f.keptFrom ?? [];
  // Everyone it was kept from has it now: it's out.
  if (kept.length && kept.every((id) => { const s = f.stances[id]; return !!s && s.status !== "unaware"; })) return false;
  return true;
}

export function offPageFacts(st: WorldState, auto: boolean): OffPage[] {
  return Object.values(st.facts ?? {})
    .filter((f) => isOffPage(f, auto))
    .map((f) => ({ key: f.key, statement: f.statement, words: f.offPage!.words, wording: f.offPage!.wording, keepers: f.keepers ?? [], by: f.offPage!.by === "user" ? "user" : "auto" }));
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function wordPattern(words: string[]): RegExp | null {
  const w = words.map((x) => x.trim()).filter((x) => x.length >= 2);
  return w.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${w.map(esc).join("|")})(?![\\p{L}\\p{N}])`, "giu") : null;
}

/** Replace the words of each off-page secret with its allowed wording (summaries, recall, lorebook text). */
export function redact(text: string, list: OffPage[]): string {
  let out = text;
  for (const o of list) {
    const re = wordPattern(o.words);
    if (re) out = out.replace(re, o.wording?.trim() || "[kept off the page]");
  }
  return out;
}

/** The words of any off-page secret this text uses. */
export function offPageHits(text: string, list: OffPage[]): { key: string; word: string }[] {
  const hits: { key: string; word: string }[] = [];
  for (const o of list) {
    const re = wordPattern(o.words);
    if (!re) continue;
    const m = re.exec(text);
    if (m) hits.push({ key: o.key, word: m[0] });
  }
  return hits;
}

/** The note's lines: what stays unsaid, and how the story may circle it. */
export function offPageLines(list: OffPage[], nm: (id: string) => string, max = 4): string[] {
  return list.slice(0, max).map((o) => {
    const who = o.keepers.length ? `${o.keepers.map(nm).join(" and ")}'s secret` : "a secret";
    const never = o.words.length ? `; never write ${o.words.map((w) => `"${w}"`).join(" or ")}` : "";
    const as = o.wording ? `; allude to it only as "${o.wording}"` : "";
    return `#${o.key} (${who}): not on the page yet. No narration, thought or register states it${never}${as}. It comes out only in a scene where someone tells it.`;
  });
}
