// Stamina: how fast someone's body needs build and recover. A Slayer tires and hungers
// slower than a librarian and heals in days, a vampire wants blood rather than lunch, an
// android needs nothing. Read from the card, the persona, the lorebooks' person entries and
// the story's own trait lines; the player's choice on the Cast page beats them all.

import type { CharacterState, StaminaEdit } from "./types";

/** Speeds against an ordinary person (1): 0.5 builds at half speed, 0 never, 3 heals three times as fast. */
export interface StaminaProfile {
  hunger: number;
  thirst: number;
  fatigue: number;
  /** How fast sleep takes fatigue away. */
  sleep: number;
  heal: number;
}

export interface StaminaKind {
  label: string;
  p: StaminaProfile;
  /** Words for the model that the numbers don't say ("hungers for blood, not food"). */
  hungerWords?: string;
  extra?: string;
}

const ORDINARY: StaminaProfile = { hunger: 1, thirst: 1, fatigue: 1, sleep: 1, heal: 1 };

export const STAMINA_KINDS: Record<string, StaminaKind> = {
  ordinary: { label: "Ordinary", p: ORDINARY },
  hardy: { label: "Hardy (soldier, athlete)", p: { hunger: 1, thirst: 1, fatigue: 0.7, sleep: 1.25, heal: 1.25 } },
  slayer: { label: "Slayer", p: { hunger: 1, thirst: 1, fatigue: 0.4, sleep: 1.5, heal: 3 } },
  superhuman: { label: "Superhuman", p: { hunger: 0.6, thirst: 0.6, fatigue: 0.3, sleep: 2, heal: 3 } },
  werewolf: { label: "Werewolf / shifter", p: { hunger: 1.5, thirst: 1, fatigue: 0.7, sleep: 1.25, heal: 3 } },
  vampire: { label: "Vampire", p: { hunger: 0.4, thirst: 0, fatigue: 0.5, sleep: 1, heal: 5 }, hungerWords: "hungers for blood, not food", extra: "sleeps by day" },
  immortal: { label: "Immortal / divine", p: { hunger: 0, thirst: 0, fatigue: 0.25, sleep: 2, heal: 5 } },
  construct: { label: "Construct / ghost", p: { hunger: 0, thirst: 0, fatigue: 0, sleep: 1, heal: 0 } },
  wizard: { label: "Witch / wizard", p: ORDINARY },
};

/** The steps the Cast page offers for one speed (and what they read as). */
export const NEED_SPEEDS: [number, string][] = [[0, "never"], [0.25, "¼ speed"], [0.4, "much slower"], [0.6, "slower"], [0.8, "a little slower"], [1, "normal"], [1.5, "faster"], [2, "twice as fast"]];
export const HEAL_SPEEDS: [number, string][] = [[0, "not on its own"], [0.5, "slower"], [1, "normal"], [1.5, "a little faster"], [2, "twice as fast"], [3, "three times as fast"], [5, "five times as fast"]];

export interface ResolvedStamina extends StaminaProfile {
  kind: string;
  /** Where the kind came from: the player, the card or persona, the lore, the story's trait lines. */
  by: "user" | "card" | "lore" | "story" | "";
  /** The player changed one of the speeds. */
  custom?: boolean;
}

// What a source says someone is. Strong: an identity statement about them ("Buffy is the
// Slayer", "Identity: the first male Slayer", "Called as a Slayer", "Spike, a vampire").
// Weak: any singular mention, for kinds a card names in passing ("Slayer strength"). A card
// talks about other people too, so plurals, other people's appositions ("Angel, a vampire")
// and "vampire slayer" / "vampire incident" don't count.
const TERMS: [string, string, boolean][] = [
  ["construct", "android|robot|automaton|golem|cyborg|ghost|spectre|specter|wraith|zombie|revenant|lich|undead construct", true],
  ["immortal", "angel|archangel|demon|deity|god|goddess|immortal|celestial|seraph", true],
  ["vampire", "vampire|vampyre|nosferatu", false],
  ["werewolf", "werewolf|lycanthrope|shape-?shifter|skinwalker|wolf shifter", false],
  ["slayer", "slayer|chosen one|vampire slayer", false],
  ["superhuman", "superhero|super-?soldier|superhuman|kryptonian|mutant|meta-?human|demigod|dhampir|half-vampire|half-demon", false],
  ["wizard", "wizard|witch|warlock|sorcerer|sorceress|mage|wizarding|magic-user", false],
  ["hardy", "soldier|knight|warrior|athlete|ranger|mercenary|marine|legionnaire|gladiator|commando", true],
];
const PRIORITY = TERMS.map(([k]) => k);
const NOT_THEIRS = /\s+(?:slayers?|hunters?|killers?|incidents?|attacks?|nests?|bites?|lairs?|dens?|kills?|fights?|problems?|activity|sightings?|lore|movies?|novels?|stor(?:y|ies)|shows?|clans?|court)\b/iy;
const NEGATED = /\b(?:not|n['’]t|never|no longer|former|ex-|formerly|pretends? to be|disguised as|posing as|thought (?:she|he|they) was)\s+(?:(?:a|an|the)\s+)?(?:[\p{L}'’-]+\s+){0,2}$/iu;
const FILLER = "(?:(?!(?:who|whom|that|which|hunts?|hunted|kills?|killed|fights?|fought|slays?|slew|loves?|loved|met|meets|with|by|of|for|against|from|to|than|like|and\\s+(?:a|an)\\b)\\b)[\\p{L}'’-]+\\s+)";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The stamina kind a description gives `names`' owner, or null when it names none. */
export function detectStamina(text: string, names: string[]): string | null {
  if (!text) return null;
  const subj = [...new Set(names.filter((n) => n && n.length >= 2).map(esc))].join("|");
  const who = `(?:${subj ? `${subj}|` : ""}she|he|they|i)`;
  const score: Record<string, number> = {};
  for (const [kind, terms, strongOnly] of TERMS) {
    const term = `(${terms})(?![\\p{L}-])`;
    const strong = [
      // "Identity: the first known male Slayer", "Species: vampire", "Blood Status: …wizarding line".
      new RegExp(`(?:^|\\n)[ \\t>*#_-]*(?:identity|species|race|kind|type|nature|class|heritage|blood status|calling|occupation|role|what (?:she|he|they) (?:is|are))[*_ \\t]*:[*_ \\t]*[^\\n]{0,80}?\\b${term}`, "giu"),
      // "Buffy Anne Summers is a twenty-year-old human woman and the current Slayer".
      new RegExp(`\\b${who}\\s+(?:is|was|am|are|became|becomes|remains|['’]s)\\s+(?:(?:now|also|still|currently|actually|really|secretly|newly)\\s+)?(?:(?:a|an|the)\\s+)?${FILLER}{0,7}?${term}`, "giu"),
      // "Gabriel Winters, 22 — the first male Slayer", "Spike, a vampire".
      ...(subj ? [new RegExp(`\\b(?:${subj})\\b[^.\\n,—–]{0,30}?(?:,|—|–| - )\\s*(?:\\d{1,3}\\s*(?:,|—|–| - )\\s*)?(?:(?:a|an|the)\\s+)${FILLER}{0,5}?${term}`, "giu")] : []),
      // "Called as a Slayer", "turned into a vampire".
      new RegExp(`\\b(?:called|chosen|activated|turned|sired|made|born|reborn|raised)\\s+(?:as|into)\\s+(?:(?:a|an|the)\\s+)?${FILLER}{0,3}?${term}`, "giu"),
    ];
    let s = 0;
    for (const re of strong) {
      for (const m of text.matchAll(re)) {
        const at = m.index! + m[0].length - m[1].length;
        NOT_THEIRS.lastIndex = m.index! + m[0].length;
        if (NOT_THEIRS.test(text)) continue;
        if (NEGATED.test(text.slice(Math.max(0, at - 40), at))) continue;
        s += 5;
      }
    }
    if (!strongOnly) {
      for (const m of text.matchAll(new RegExp(`\\b${term}`, "giu"))) {
        NOT_THEIRS.lastIndex = m.index! + m[0].length;
        if (NOT_THEIRS.test(text)) continue;
        const lead = text.slice(Math.max(0, m.index! - 50), m.index!);
        // "Angel, a vampire cursed with a soul": someone else's.
        if (/\b[A-Z][\p{L}'’-]+,\s+(?:(?:a|an|the)\s+)?(?:[\p{L}-]+\s+){0,2}$/u.test(lead) && !(subj && new RegExp(`\\b(?:${subj}),\\s+(?:(?:a|an|the)\\s+)?(?:[\\p{L}-]+\\s+){0,2}$`, "iu").test(lead))) continue;
        if (NEGATED.test(lead)) continue;
        s += 1;
      }
    }
    if (s) score[kind] = s;
  }
  const best = Object.entries(score).sort((a, b) => b[1] - a[1] || PRIORITY.indexOf(a[0]) - PRIORITY.indexOf(b[0]))[0];
  return best && best[1] >= 3 ? best[0] : null;
}

/** A trait line or the player's "always" line naming what someone is ("vampire; bleached hair"). */
export function staminaFromTraits(texts: string[]): string | null {
  const parts = texts.flatMap((t) => t.split(/\s*[;,·]\s*/)).map((p) => p.trim()).filter(Boolean);
  for (const [kind, terms] of TERMS) {
    const re = new RegExp(`^(?:(?:a|an|the)\\s+)?(?:[\\p{L}'’-]+\\s+){0,3}?(${terms})(?![\\p{L}-])`, "iu");
    for (const p of parts) {
      const m = re.exec(p);
      if (!m) continue;
      NOT_THEIRS.lastIndex = m[0].length;
      if (!NOT_THEIRS.test(p) && !NEGATED.test(p.slice(0, m[0].length - m[1].length))) return kind;
    }
  }
  return null;
}

/**
 * The stamina that holds for someone: the player's choice, else what the card, persona or lore
 * says (`sources`, by lower-case name; "user" for the persona), else the story's trait lines.
 */
export function resolveStamina(c: CharacterState, sources: Record<string, { kind: string; by: "card" | "lore" }> | undefined, edit: StaminaEdit | undefined): ResolvedStamina {
  let kind = "ordinary";
  let by: ResolvedStamina["by"] = "";
  const src = sources ? (c.isUser ? sources.user : undefined) ?? sourceFor(c, sources) : undefined;
  if (edit?.kind && STAMINA_KINDS[edit.kind]) {
    kind = edit.kind;
    by = "user";
  } else if (src && STAMINA_KINDS[src.kind]) {
    kind = src.kind;
    by = src.by;
  } else {
    const told = staminaFromTraits([...(c.traits ?? []).map((t) => t.text), c.always ?? ""].filter(Boolean));
    if (told) {
      kind = told;
      by = "story";
    }
  }
  const p = { ...STAMINA_KINDS[kind].p };
  let custom = false;
  for (const k of ["hunger", "thirst", "fatigue", "heal"] as const) {
    const v = edit?.[k];
    if (typeof v === "number" && v >= 0 && v <= 10) {
      if (v !== p[k]) custom = true;
      p[k] = v;
    }
  }
  return { kind, by: custom && !by ? "user" : by, ...p, ...(custom ? { custom } : {}) };
}

function sourceFor(c: CharacterState, sources: Record<string, { kind: string; by: "card" | "lore" }>) {
  const names = [c.name, ...c.aliases].map((n) => n.toLowerCase());
  for (const n of names) if (sources[n]) return sources[n];
  // "Buffy" on the page, "Buffy Summers" on the card.
  const first = c.name.split(/\s+/)[0].toLowerCase();
  for (const [k, v] of Object.entries(sources)) if (k !== "user" && k.split(/\s+/)[0] === first) return v;
  return undefined;
}

/** "Slayer: tires slowly, recovers fast, heals fast" — for the note and the Cast page; "" for an ordinary body. */
export function staminaWords(s: ResolvedStamina): string {
  const k = STAMINA_KINDS[s.kind] ?? STAMINA_KINDS.ordinary;
  const bits: string[] = [];
  const need = (v: number, never: string, slow: string, slower: string, fast: string) => (v === 0 ? never : v <= 0.3 ? slower : v < 0.9 ? slow : v >= 1.3 ? fast : "");
  const sameHunger = k.hungerWords && s.hunger === k.p.hunger;
  if (sameHunger) bits.push(k.hungerWords!);
  else if (s.hunger === s.thirst && s.hunger !== 1) bits.push(need(s.hunger, "needs no food or drink", "hungers and thirsts slowly", "rarely hungry or thirsty", "hungers and thirsts fast"));
  else {
    bits.push(need(s.hunger, "needs no food", "hungers slowly", "rarely hungry", "eats a lot"));
    if (!(sameHunger && s.thirst === 0 && k.hungerWords)) bits.push(need(s.thirst, "no thirst", "thirsts slowly", "rarely thirsty", "thirsts fast"));
  }
  if (sameHunger && s.thirst === 0) bits.push("no thirst");
  bits.push(need(s.fatigue, "never tires", "tires slowly", "rarely tires", "tires fast"));
  if (s.fatigue > 0 && s.sleep >= 1.5) bits.push("recovers fast");
  bits.push(s.heal === 0 ? "doesn't heal on its own" : s.heal >= 4 ? "heals very fast" : s.heal >= 2 ? "heals fast" : s.heal < 0.9 ? "heals slowly" : "");
  if (k.extra) bits.push(k.extra);
  const said = [...new Set(bits.filter(Boolean))].join(", ");
  if (!said) return s.kind === "ordinary" || s.kind === "wizard" ? "" : k.label;
  return `${s.kind === "ordinary" ? "stamina" : k.label.split(" (")[0]}: ${said}`;
}
