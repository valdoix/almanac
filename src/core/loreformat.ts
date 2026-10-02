// The Almanac lorebook format: the categories a lorebook entry can be, how each is titled and
// opened, its default fields, and the metadata that names it exactly. The Lore Bridge reads books
// by these rules and the Lorebook Creator writes them, so a book the Creator makes is read back
// exactly as it was meant.
//
// The categories come from the books players actually bring: labelled titles ("Character: …",
// "CURRENT - …"), and free-form ones ("Buffy Summers - The Slayer", "Buffy & Spike - Truce",
// "Rhaenyra - Speech and Manner", "What Viserys Knows", "109 AC - The Twins' First Kiss"), with
// content tags ("RULE:", "MYTHOLOGY:", "THEME:", "STORY ARC:", "AI DIRECTIVE:").

import type { CodexKind } from "./codex";

export type Tense = "now" | "past" | "future" | "timeless";

export interface LoreCategory {
  id: string;
  /** The title label the Creator writes ("Character"). */
  label: string;
  /** "Label: Name", or "Label - Name" for sentence-like names (CURRENT, Timeline Boundary). */
  sep: ": " | " - ";
  /** Other labels read as this category. */
  aliases: RegExp;
  kind: CodexKind;
  tense: Tense;
  /** Priority and order (the same tier): how it fares in Lumiverse's budget, and where it lands. */
  tier: number;
  position: number;
  depth: number;
  /** Short hard rules may be constant; everything else needs keywords. */
  constant?: boolean;
  /** What it is, for people choosing one. */
  blurb: string;
  /** How the content must open, for the model. */
  opens: string;
  /** Metadata fields this category carries besides kind and tense. */
  fields?: string[];
}

export const CATEGORIES: LoreCategory[] = [
  {
    id: "boundary", label: "Timeline Boundary", sep: " - ", kind: "boundary", tense: "timeless", tier: 300, position: 4, depth: 4, constant: true,
    aliases: /^(timeline boundary|timeline|era|canon point|canon cutoff|cutoff|story start|opening|au canon(?: baseline)?|canon baseline|canon|alternate universe|au)$/i,
    blurb: "where the story sits in a larger canon, and what it changes (AU rules)",
    opens: "Lead with the moment the story begins (date, place, what has just happened). Say what has not happened yet, and what this story changes from canon.",
  },
  {
    id: "rule", label: "Rule", sep: ": ", kind: "law", tense: "timeless", tier: 280, position: 4, depth: 4,
    aliases: /^(rule|rules|law|laws|magic|magic system|mechanic|mechanics|physics|mythology|how .+ works|.+ system|.+ rules)$/i,
    blurb: "how the world works: magic, powers, limits, costs",
    opens: "Lead with the rule itself (\"RULE: A vampire CANNOT enter a home uninvited.\"). Use MUST / CANNOT for hard limits.",
  },
  {
    id: "character", label: "Character", sep: ": ", kind: "person", tense: "timeless", tier: 200, position: 1, depth: 4,
    aliases: /^(character|characters|npc|person|people|cast|profile)$/i,
    blurb: "a person (or a being who acts like one: a dragon, a demon, a robot)",
    opens: "\"Name is a/an/the role …\" — then age, looks (eye and hair colour), manner, what they want. Say plainly if they are dead.",
  },
  {
    id: "relationship", label: "Relationship", sep: ": ", kind: "bond", tense: "timeless", tier: 180, position: 1, depth: 4,
    aliases: /^(relationship|relationships|bond|bonds|dynamic|pairing)$/i,
    blurb: "what lies between two people (title: \"Relationship: A & B\")",
    opens: "\"A and B are …\" — what they are to each other now, how it got there, what each won't say.",
    fields: ["participants"],
  },
  {
    id: "voice", label: "Voice", sep: ": ", kind: "texture", tense: "timeless", tier: 160, position: 2, depth: 4,
    aliases: /^(voice|speech|speech and manner|speech & manner|dialogue|mannerisms|how .+ speaks)$/i,
    blurb: "how one person talks: register, tics, sample lines (title: \"Voice: Name\")",
    opens: "\"When Name speaks, …\" — register, rhythm, words they use and never use, one short sample line.",
    fields: ["participants"],
  },
  {
    id: "current", label: "CURRENT", sep: " - ", kind: "situation", tense: "now", tier: 150, position: 4, depth: 2,
    aliases: /^(current|current scene|now|ongoing|active|right now|situation)$/i,
    blurb: "what is happening as the story opens (title names who, before the verb)",
    opens: "Participants first (\"Spike and Dawn are sheltering at Revello Drive …\"). Public events use words like raid, fire, crowds; private ones must not.",
    fields: ["participants", "place", "visibility", "expected"],
  },
  {
    id: "belief", label: "Belief", sep: ": ", kind: "belief", tense: "now", tier: 150, position: 1, depth: 4,
    aliases: /^(belief|beliefs|what .+ knows?|what .+ believes?|what .+ (?:does|do) not know|what .+ doesn'?t know|knowledge|misconception)$/i,
    blurb: "who believes or doesn't know something, and whether they're right",
    opens: "\"X believes …\" or \"X does not know …\". If the belief is wrong, say so (\"Unbeknownst to them, …\"); say \"rightly\" when it is true.",
    fields: ["participants"],
  },
  {
    id: "secret", label: "Secret", sep: ": ", kind: "texture", tense: "timeless", tier: 150, position: 0, depth: 4,
    aliases: /^(secret|secrets|hidden|classified)$/i,
    blurb: "something kept from people, kept off the page until a scene brings it out",
    opens: "Say it is secret and who keeps it from whom, then one sentence with the sign someone might notice.",
    fields: ["participants"],
  },
  {
    id: "faction", label: "Faction", sep: ": ", kind: "group", tense: "timeless", tier: 130, position: 0, depth: 4,
    aliases: /^(faction|factions|group|gang|order|clan|coven|guild|cult|society|house|company|crew|family|organisation|organization|institution|court|council)$/i,
    blurb: "a group: a house, order, gang, council",
    opens: "\"The X is a/an …\" — what it wants, who leads it, its members named exactly as their Character titles name them.",
    fields: ["members"],
  },
  {
    id: "upcoming", label: "Upcoming", sep: ": ", kind: "forecast", tense: "future", tier: 120, position: 0, depth: 4,
    aliases: /^(upcoming|prophecy|planned|scheduled|future|forecast|foreshadowing|possible flashpoints?)$/i,
    blurb: "what may happen next: plans, prophecies, threats (never fact)",
    opens: "Future tense only (\"The Trio will …\", \"may\"). Nothing in it has happened; say what could change it.",
    fields: ["participants", "place"],
  },
  {
    id: "item", label: "Item", sep: ": ", kind: "object", tense: "timeless", tier: 120, position: 0, depth: 4,
    aliases: /^(item|items|object|artifact|artefact|weapon|relic|equipment|device)$/i,
    blurb: "an object that matters: who holds it, what it does",
    opens: "Name the holder in the first sentence (\"… carried by Kael\", \"Kael's …\").",
  },
  {
    id: "location", label: "Location", sep: ": ", kind: "place", tense: "timeless", tier: 110, position: 0, depth: 4,
    aliases: /^(location|locations|place|places|city|town|village|building|district|region|realm|kingdom|country|planet|room|area|landmark|setting)$/i,
    blurb: "a place: what it looks like, where it is, who is found there",
    opens: "Name the parent place with in/inside/within/part of in the first sentence. Hours as \"Open 20:00 to 02:00\"; routes as \"ten minutes' walk from X\". End by naming who and what is found there.",
  },
  {
    id: "history", label: "History", sep: ": ", kind: "history", tense: "past", tier: 100, position: 0, depth: 4,
    aliases: /^(history|past|backstory|previously|origins?|event|events|arc|story arc|.+ arc|chronicle|timeline event)$/i,
    blurb: "what already happened (past tense; a date in the title helps)",
    opens: "Lead with the event itself, in the past tense, dated if the story has dates (\"In 109 AC, …\").",
  },
  {
    id: "customs", label: "Customs", sep: ": ", kind: "texture", tense: "timeless", tier: 90, position: 0, depth: 4,
    aliases: /^(customs|culture|traditions|atmosphere|slang|language|etiquette|daily life|texture)$/i,
    blurb: "how life goes somewhere: customs, slang, food, etiquette",
    opens: "Concrete and sensory; name the place or people it belongs to.",
  },
  {
    id: "scene", label: "Scene", sep: ": ", kind: "playbook", tense: "future", tier: 90, position: 0, depth: 4,
    aliases: /^(scene|scenes|playbook|if|when|scripted scene)$/i,
    blurb: "how someone acts if the story reaches a moment; never read as history",
    opens: "Open with the trigger (\"When Buffy learns …\", \"If Gabriel …\"), then how they act. Its keywords are the moment's own words, not names.",
    fields: ["participants"],
  },
  {
    id: "ooc", label: "OOC", sep: ": ", kind: "meta", tense: "timeless", tier: 275, position: 4, depth: 4,
    aliases: /^(ooc|instructions?|author'?s note|format|style|tone|theme|themes|role assignment|directive|ai directive|guidelines?)$/i,
    blurb: "an instruction to the model (tone, roles, style), not a story fact",
    opens: "Speak to the narrator directly and briefly. Never facts about the story here.",
  },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function category(id: string | undefined | null): LoreCategory | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** The category a title label names ("Character", "Location", "AU Canon", "Speech and Manner"). */
export function categoryOfLabel(label: string | undefined): LoreCategory | undefined {
  const l = (label ?? "").trim();
  if (!l) return undefined;
  return CATEGORIES.find((c) => c.label.toLowerCase() === l.toLowerCase()) ?? CATEGORIES.find((c) => c.aliases.test(l));
}

/** A label that carries its own subject ("Watcher System", "Season One Arc", "How Magic Works"): it stays part of the name. */
export function labelNames(label: string | undefined): boolean {
  return /^(?:.+\s+(?:system|rules|arc)|how\s+.+\s+(?:works|speaks)|what\s+.+)$/i.test((label ?? "").trim()) && !/^(?:magic system|story arc)$/i.test((label ?? "").trim());
}

/** The category that files as this Codex kind (the first, for kinds several share). */
export function categoryOfKind(kind: string, opts: { voice?: boolean; secret?: boolean } = {}): LoreCategory | undefined {
  if (kind === "texture") return BY_ID.get(opts.voice ? "voice" : opts.secret ? "secret" : "customs");
  if (kind === "situation") return BY_ID.get("current");
  return CATEGORIES.find((c) => c.kind === kind);
}

export function titleOf(cat: LoreCategory, name: string): string {
  return `${cat.label}${cat.sep}${name}`.slice(0, 140);
}

// ---------------------------------------------------------------------------
// Metadata: extensions.almanac.lore names an entry's category exactly.
// Books made elsewhere may carry the same shape under extensions.vellum3; it is read alike.
// ---------------------------------------------------------------------------

export interface LoreMeta {
  /** The category id (character, relationship, …). */
  category?: string;
  kind: string;
  tense?: Tense;
  participants?: string[];
  members?: string[];
  place?: string;
  visibility?: "public" | "private";
  expected?: string[];
  holder?: string;
  /** The record's name when the title alone wouldn't give it ("Harrenhal — The Five Towers"). */
  name?: string;
  /** A place's parent place. */
  parent?: string;
  /** Whom a voice, secret, scene or detail is about. */
  subject?: string;
}

/** An entry's exact category metadata, from wherever a tool put it. */
export function readLoreMeta(ext: Record<string, any> | null | undefined): LoreMeta | null {
  const m = ext?.almanac?.lore ?? ext?.vellum3 ?? ext?.almanac?.vellum3 ?? null;
  if (!m || typeof m !== "object" || typeof m.kind !== "string") return null;
  return m as LoreMeta;
}

/** The entry's extensions with this metadata in Almanac's place (other tools' blocks are kept). */
export function withLoreMeta(ext: Record<string, any> | null | undefined, meta: LoreMeta, extra: Record<string, any> = {}): Record<string, any> {
  const out = { ...(ext ?? {}) };
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(meta)) if (v != null && !(Array.isArray(v) && !v.length) && v !== "") clean[k] = v;
  out.almanac = { ...(out.almanac ?? {}), ...extra, lore: clean };
  delete out.almanac.vellum3;
  return out;
}

// ---------------------------------------------------------------------------
// Reading free-form books: content tags, title shapes, honorifics.
// ---------------------------------------------------------------------------

/** A tag the content opens with ("RULE:", "STORY ARC:", "AI DIRECTIVE:"), and the category it means. */
const CONTENT_TAGS: [RegExp, string][] = [
  [/^(?:meta[- ]rule|ai directive|directive|instruction|ooc|style|tone|theme|narrator note|note to (?:the )?(?:ai|narrator|model))\s*:/i, "ooc"],
  [/^(?:timeline boundary|canon cutoff|cutoff event|cutoff|canon point|au canon|story start)\s*:/i, "boundary"],
  [/^(?:rule|law|mythology|magic|lore rule|world rule)\s*:/i, "rule"],
  [/^(?:current scene|current|situation|right now)\s*:/i, "current"],
  [/^(?:story arc|arc|history|backstory|past event|event)\s*:/i, "history"],
  [/^(?:upcoming|prophecy|foreshadowing|future)\s*:/i, "upcoming"],
  [/^(?:secret|hidden truth)\s*:/i, "secret"],
  [/^(?:customs?|culture|atmosphere)\s*:/i, "customs"],
];

export function contentTag(content: string): LoreCategory | undefined {
  const c = (content ?? "").trimStart();
  const hit = CONTENT_TAGS.find(([re]) => re.test(c));
  return hit ? BY_ID.get(hit[1]) : undefined;
}

// Ranks and forms of address that open a person's name ("Ser Criston Cole", "Princess Elia Martell").
// Words that also open ordinary titles ("General Rules", "Major Events") are left out.
const RANKS = new Set("prince princess king queen lord lady ser sir dame maester archmaester septon septa goodwife goodman master mistress mr mrs ms miss dr doctor professor principal captain commander count countess duke duchess baron baroness emperor empress saint magister khal mayor deputy sheriff detective officer agent senator governor president chancellor bishop cardinal abbot rabbi reverend pastor sergeant lieutenant colonel admiral judge nurse".split(" "));

/** A rank on its own ("King" in "King's Landing" is nobody). */
export function isRank(word: string): boolean {
  return RANKS.has((word ?? "").toLowerCase().replace(/\.$/, ""));
}

/** Whether a title opens with a rank and then a capitalised name ("Grand Maester Mellos", "Mr. Pointy"). */
export const HONORIFIC = {
  test(s: string): boolean {
    const m = /^(?:grand\s+)?(\p{L}+)\.?\s+(\p{L})/iu.exec((s ?? "").trim());
    return !!m && RANKS.has(m[1].toLowerCase()) && /^(?:\p{Lu})/u.test((s ?? "").trim()) && /\p{Lu}/u.test(m[2]);
  },
};

/** "A & B", "A and B" with names on both sides (each one to four capitalised words). */
export function pairNames(s: string): [string, string] | null {
  const m = /^([A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){0,3})\s+(?:&|and)\s+([A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){0,3})$/u.exec(s.trim());
  return m ? [m[1], m[2]] : null;
}

/** A date or era in a title ("109 AC", "5 Third Moon 281 AC", "1997", "Season Two Arc", "Interseason Arc"). */
export const DATED = /^(?:(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:[A-Z][a-z]+\s+){1,2})?\d{1,4}\s*(?:AC|BC|AL|AD|BCE|CE|AR|DR|SR|TA|BBY|ABY)\b.*|\d{3,4}|(?:season|series|book|part|chapter|act|volume)\s+(?:\w+\s+)?arc|interseason arc|.+\s+arc)$/i;

/** The descriptor after a person's name that says it's about their speech. */
export const VOICE_DESCRIPTOR = /^(?:speech(?:\s*(?:and|&)\s*manner(?:s|isms)?)?|voice(?:\s*(?:and|&)\s*manner(?:s|isms)?)?|dialogue(?: style)?|mannerisms|how (?:she|he|they) speaks?|manner of speech|speech patterns?)$/i;

/** Descriptors that add nothing to a name ("Harrenhal - Overview"). */
export const BARE_DESCRIPTOR = /^(?:overview|summary|basics|general|introduction|intro|profile|world-facing profile|institution|details|notes|main)$/i;

/** One line per category, for prompts and the UI's reference. */
export function formatGuide(): string {
  return CATEGORIES.map((c) => `- ${c.label}${c.sep.trim() === "-" ? " -" : ":"} ${c.blurb}. Opens: ${c.opens} Tier ${c.tier}, position ${c.position}${c.position === 4 ? ` (depth ${c.depth})` : ""}${c.constant ? ", may be constant" : ""}. kind "${c.kind}", tense "${c.tense}"${c.fields?.length ? `; metadata adds ${c.fields.join(", ")}` : ""}.`).join("\n");
}
