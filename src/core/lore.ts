// Lore Bridge: read attached lorebooks (character, persona, chat, global) into
// Codex baselines by the Almanac lorebook format (loreformat.ts): exact metadata
// first, then the title label, then content tags, title shapes and first-sentence
// rules. Low-confidence entries go to a review queue (and can be sent to the LLM
// classifier).

import type { CodexKind, CodexOverlay } from "./codex";
import { slug } from "./util";
import { traitsFromText } from "./traits";
import { detectStamina } from "./stamina";
import type { TraitKind } from "./types";
import { BARE_DESCRIPTOR, category, categoryOfLabel, contentTag, DATED, HONORIFIC, isRank as isRankWord, labelNames, pairNames, readLoreMeta, VOICE_DESCRIPTOR, type LoreCategory } from "./loreformat";

export interface LoreEntry {
  id: string;
  world_book_id: string;
  comment: string;
  content: string;
  key: string[];
  disabled?: boolean;
  constant?: boolean;
  /** Lumiverse's insertion position: free-form books put people at 1 (after the character card). */
  position?: number;
  extensions?: Record<string, any>;
}

export interface Classified {
  entryId: string;
  bookId: string;
  kind: CodexKind;
  tense: "now" | "past" | "future" | "timeless";
  name: string;
  aliases: string[];
  confidence: number;
  /** How it was read: metadata, a title label, a content tag ("RULE:"), the title's shape, the first sentence, a weaker hint, or a guess. */
  via: "metadata" | "title" | "tag" | "shape" | "sentence" | "hint" | "guess" | "weaver";
  /** The format category (loreformat.ts) when one was read: several share a kind (voice, secret and customs are texture). */
  category?: string;
  role?: string;
  parent?: string;
  hours?: string;
  holder?: string;
  participants?: string[];
  members?: string[];
  place?: string;
  visibility?: "public" | "private";
  expected?: string[];
  mistaken?: boolean;
  secret?: { fact: string; sign?: string };
  climate?: string;
  routes?: string[];
  dead?: boolean;
  want?: string;
  voice?: string;
  /** A Weaver world's central tension, its agenda, and the lines it holds (agency on). */
  tension?: string;
  agenda?: string;
  holds?: string[];
  /** Whom a depth-book entry deepens. */
  subject?: string;
  /** The entry's own keywords (a playbook is recalled by them). */
  keys?: string[];
  /** Eyes, hair, age the entry states for a person. */
  looks?: { kind: TraitKind; text: string }[];
  /** What the entry says this person is, for their stamina ("vampire", "slayer"). */
  stamina?: string;
  weaver?: { role: WeaverRole; part?: WeaverPart };
  /** Always-on entries the Ledger must leave to the host: never folded, forced or switched off. */
  pinned?: boolean;
  summary: string;
}

// Dream Weaver (Lumiverse's authoring studio) ships a lean card plus small bound books:
// a rules book (always-on governance and a constant "re-anchor"), and for worlds a lore book
// and an NPC book, for characters an optional depth book. The book metadata carries the role,
// but a plain Lumiverse import replaces it, and a card export merges the rules into
// character_book, so the books' fixed names and blurbs and the entries' fixed titles count too.
// A persona built in the Weaver gets its own depth book ("X — persona depth").
export type WeaverRole = "governance" | "lore" | "npc" | "depth" | "persona";
export type WeaverPart = "anchor" | "rule" | "agenda";
export interface WeaverBook {
  role: WeaverRole;
  subject: string;
  /** A world build: the card is a narrator, and the subject is the place it runs. */
  world?: boolean;
}

// A world build's rules speak to a narrator (lore canon, narrator craft, NPC voicing, world agency);
// a character build's never do.
const WORLD_RULE = /^\s*<weaver_(?:lore|narrator|npcs|world_agency|agency)>/i;

const WEAVER_BOOKS: [RegExp, RegExp, WeaverRole][] = [
  [/^(.+?)\s+rules book$/i, /stays itself in any chat|Managed by the Weaver/i, "governance"],
  [/^(.+?)\s+NPC book$/i, /trigger by name so the narrator can voice them/i, "npc"],
  [/^(.+?)\s+lore book$/i, /narrator consults canon instead of inventing it/i, "lore"],
  [/^(.+?)\s+depth book$/i, /Deepening answers from the Weaver interview/i, "depth"],
  [/^(.+?)\s+[—–-]\s+persona depth$/i, /Triggered depth for the persona/i, "persona"],
];

/** Which Weaver governance piece an entry is, if any (works on card-embedded copies too). */
export function weaverEntry(e: { comment?: string; content?: string }): WeaverPart | null {
  const c = (e.comment ?? "").trim();
  const body = (e.content ?? "").trimStart();
  if (/^Weaver re-?anchor$/i.test(c)) return "anchor";
  if (/^Weaver agency\b/i.test(c) || /^<weaver_agency>/i.test(body)) return "agenda";
  if (/^Weaver governance\b/i.test(c) || /^<weaver_[a-z_]+>/i.test(body)) return "rule";
  return null;
}

/** A Dream Weaver book's role and subject, from its metadata, its name and blurb, or its entries. */
export function weaverBook(
  book: { name?: string; description?: string; metadata?: Record<string, unknown> | null },
  entries: { comment?: string; content?: string; key?: string[] }[] = [],
): WeaverBook | null {
  const name = (book.name ?? "").trim();
  const md = (book.metadata ?? {}) as Record<string, unknown>;
  if (md.almanac_chat_id) return null; // our own mirror book (older ones may hold copies of Weaver rules)
  const byName = WEAVER_BOOKS.find(([re]) => re.test(name));
  const anchor = entries.find((e) => weaverEntry(e) === "anchor");
  const subject = (byName ? byName[0].exec(name)![1] : anchor?.key?.[0] ?? name).trim();
  const tagged = WEAVER_BOOKS.find(([, , r]) => r === (md.persona_depth === true ? "persona" : md.weaver_role));
  let role: WeaverRole | null = tagged?.[2] ?? null;
  if (!role && byName && (md.source === "weaver" || byName[1].test(book.description ?? ""))) role = byName[2];
  if (!role && entries.some((e) => weaverEntry(e))) role = "governance";
  if (!role) return null;
  const world = entries.some((e) => WORLD_RULE.test(e.content ?? "") || (weaverEntry(e) === "anchor" && /^\s*(Tension|Stance):/im.test(e.content ?? "")));
  return world ? { role, subject, world } : { role, subject };
}

/** Agenda and hard lines from the Weaver's "agenda and holds" entry. */
export function parseAgency(content: string): { agenda?: string; holds: string[] } {
  const agenda = /^\s*Agenda:\s*(.+)$/im.exec(content)?.[1]?.trim();
  const after = content.split(/^\s*Hard lines[^\n]*$/im)[1] ?? "";
  const holds = [...after.matchAll(/^\s*[-*•]\s*(.+)$/gm)].map((m) => m[1].trim()).filter(Boolean);
  return { agenda, holds };
}

export interface WeaverWorld {
  name: string;
  premise?: string;
  tension?: string;
  /** Present only while the rules book's agency entry is on. */
  agenda?: string;
  holds?: string[];
}

/**
 * A Weaver world's narrator card, from the Bible slots the Weaver stores on it
 * (extensions.weaver.structured). Null for a character build or any other card.
 */
export function weaverWorldCard(card: { name?: string; extensions?: Record<string, unknown> | null } | null | undefined): WeaverWorld | null {
  const w = (card?.extensions as any)?.weaver;
  const s = w && typeof w === "object" ? w.structured : null;
  if (!s || typeof s !== "object") return null;
  const slot = (k: string): string | undefined => {
    const v = s[k];
    const t = typeof v === "string" ? v : typeof v?.content === "string" ? v.content : "";
    return t.trim() || undefined;
  };
  if (!["premise", "central_tension", "rules", "power", "hooks", "world_agency"].some((k) => slot(k))) return null;
  return { name: (card?.name ?? "").trim(), premise: slot("premise"), tension: slot("central_tension") };
}

/** "Core: …\nDrives: …" lines of a re-anchor, without the Weaver's "…" cut marks. */
function anchorLines(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of content.matchAll(/^\s*(Core|Drives|Voice|Now|Tension|Stance):\s*(.+)$/gim)) {
    out[m[1].toLowerCase()] = m[2].replace(/[;,\s]*…\s*$/, "").trim();
  }
  return out;
}

function clip(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), n / 2)).replace(/[,;:\s]+$/, "")}…`;
}

function classifyWeaverEntry(e: LoreEntry, part: WeaverPart, book: WeaverBook | null): Classified {
  const base: Classified = {
    entryId: e.id, bookId: e.world_book_id, kind: "directive", tense: "timeless", name: "", aliases: [],
    confidence: 1, via: "weaver", weaver: { role: "governance", part }, pinned: true, summary: "",
  };
  if (part === "anchor") {
    const l = anchorLines(e.content ?? "");
    const who = (e.key ?? []).find((k) => k.trim())?.trim() || book?.subject || "";
    // A world's anchor (Core, Tension, Stance, Voice) is the place the narrator runs.
    if (who && (book?.world || l.tension || l.stance)) {
      return { ...base, kind: "place", name: who, summary: clip(l.core ?? firstSentence(e.content ?? ""), 400), tension: l.tension ? clip(l.tension, 240) : undefined };
    }
    if (who) {
      return {
        ...base, kind: "person", name: who, summary: clip(l.core ?? firstSentence(e.content ?? ""), 240),
        role: l.core ? clip(l.core.split(/\s*(?:;|\.\s|,\s*(?:who|which|whose)\b)/)[0], 90) : undefined,
        want: l.drives ? clip(l.drives, 220) : undefined, voice: l.voice ? clip(l.voice, 220) : undefined,
      };
    }
    return { ...base, name: `${who || "World"} anchor`, summary: l.core ?? firstSentence(e.content ?? "") };
  }
  const title = (e.comment ?? "").replace(/^Weaver\s+(?:governance|agency)\s*[·:|-]\s*/i, "").trim();
  const tag = /^\s*<weaver_([a-z_]+)>/i.exec(e.content ?? "")?.[1]?.replace(/_/g, " ");
  const inner = (e.content ?? "").replace(/<\/?weaver_[a-z_]+>/gi, "").trim();
  const agency = part === "agenda" ? parseAgency(inner) : null;
  return {
    ...base, name: title || tag || "Weaver rule", summary: clip(inner.split(/\n/)[0] ?? "", 200),
    ...(agency ? { agenda: agency.agenda, holds: agency.holds } : {}),
  };
}

// Title words for unlabelled entries, first match wins. The strong nouns (a guild, a sword, a
// tavern) decide before a story's past tense does; the weak ones (a festival, a curse, "history")
// only after. Weaver lore books read them all at once, as before.
const GROUP_HINT = /\b(?:guild|order|council|clan|famil(?:y|ies)|house of|crew|church|cult|company|companies|holdings|corporation|firm|watch|brotherhood|sisterhood|society|faction|court|union|gang|coven|syndicate|circle|knight|kingsguard|minion|network|loyalist|program|programme|agency|initiative|unit|army|legion|band|tribe|dynasty|cabal|league|alliance|senate|parliament|household|retinue|staff)(?:e?s)?\b/i;
const OBJECT_HINT = /\b(?:ledger|book|tome|handbook|scroll|key|sword|blade|dagger|axe|hammer|bow|wand|stake|ring|amulet|gem|orb|sphere|urn|chalice|grail|map|relic|artifact|artefact|crown|mask|lantern|bell|idol|stone|coin|chip|katra|device|potion|vial|crystal|locket|necklace|talisman|totem|egg)(?:e?s)?\b/i;
const PLACE_HINT = /\b(?:harbou?r|bay|port|dock|pier|market|street|road|drive|square|quarter|district|ward|tavern|inn|pub|bar|club|nightclub|hall|temple|shrine|chapel|sept|godswood|keep|holdfast|castle|tower|manor|mansion|house|residence|home|apartment|flat|crypt|grave|tomb|office|library|school|academy|university|college|campus|forest|wood|marsh|river|lake|sea|coast|shore|island|mountain|valley|cave|mine|ruin|gate|wall|bridge|lighthouse|cemetery|graveyard|farm|mill|shop|store|warehouse|station|village|town|city|palace|prison|asylum|hospital|chamber|yard|ground|dragonpit|facility|base|lab|laboratory|bunker|garden|park|church|cathedral|abbey|monastery|estate|villa|cottage|cabin|hotel|motel|restaurant|diner|caf[eé]|passage|tunnel|sewer|kingdom|princedom|duchy|province|territor(?:y|ies)|land)(?:e?s)?\b/i;
const HISTORY_HINT = /\b(history|founding|founded|origins?|the fall of|war of|years? ago|age of|legend of|in the old days|before the)\b/i;
const LAW_HINT = /\b(rules?|laws?|magic|how .+ works|the price|cost of|curse|pact|oath|bargain|covenant|forbidden|taboo|doctrine|physiology|weakness(?:es)?|powers?)\b/i;
const TEXTURE_HINT = /\b(customs?|traditions?|festival|rites?|rituals?|ceremon(?:y|ies)|holiday|feast|superstitions?|etiquette|slang|dialect|cuisine|dress|fashion|night|day|season|precedence|politics|market)\b/i;

// Weaver lore books: as before, every hint in one ordered list.
const LORE_TITLE_HINTS: [RegExp, CodexKind, Classified["tense"]][] = [
  [HISTORY_HINT, "history", "past"],
  [GROUP_HINT, "group", "timeless"],
  [LAW_HINT, "law", "timeless"],
  [TEXTURE_HINT, "texture", "timeless"],
  [OBJECT_HINT, "object", "timeless"],
  [PLACE_HINT, "place", "timeless"],
];

const BELIEF = /\b(believes?|thinks?|assumes?|unaware|doesn'?t know|don'?t know|suspects?|convinced)\b/i;
const MISTAKEN = /\b(unbeknownst|in truth|actually|mistakenly|doesn'?t yet know|wrongly)\b/i;
const PUBLIC = /\b(raid|fire|attack|riot|festival|in the streets|sirens|crowds|the town watches|parade|war|siege|explosion)\b/i;
const SECRET = /\b(secret|hidden|concealed|unknown to most|no one knows)\b/i;
const SIGN = /[^.]*\b(sign|smell|scent|cold spot|mark|draft|draught|sound|stain|notice)\b[^.]*\./i;

// What an event is called ("The Wildfire Nameday", "Aelor & Cersei Betrothal", "Departure for Harrenhal").
const EVENT_NOUN = /\b(betrothal|wedding|marriage|death|murder|assassination|birth|coronation|battle|war|siege|attack|raid|fall|return|departure|arrival|visit|feast|nameday|birthday|grant|dismissal|ascension|resurrection|trial|duel|kiss|first kiss|campaign|rebellion|uprising|massacre|sacrifice|exile|escape|capture|founding|burning|sack|treaty|council of|tourney|tournament|funeral|execution|abdication|succession crisis)\b/i;
// A title that tells something happening ("Faith Kills Allan Finch", "Dawn Is Created from the Key").
const TITLE_VERB = /\b(?:is|are|was|were)\s+[a-z]+(?:ed|en)\b|\b(?:dies|die|kills|kill|loses|lose|leaves|leave|arrives|arrive|returns|return|captures|capture|drains|retaliates|performs|begins|begin|comes|prepares|flees|flee|opens|meets|marries|betrays|discovers|learns|saves|joins|becomes|escapes|attacks|takes|falls|rises|wins|finds|defeats|reveals|confesses|breaks|burns|claws|awakens|wakes|summons|seals)\b/i;
const PRESENT = /\b(is|are|has|have|lies|stands|sits|remains|serves|rules|runs|holds|keeps|carries|lives|works|owns|leads|guards|knows|wants|loves|hates|fears)\b/i;
const PAST = /\b(was|were|had|did|became|began|came|went|took|gave|made|found|left|fled|fell|broke|lost|won|led|grew|ran|saw|told|foretold|knew|met|threw|wrote|sent|brought|built|held|kept|stood|swore|bore|cut|struck|slew|rode|flew|chose|forgot|hid|sought|thought|fought|caught|taught|bought|spent)\b/i;
const STOP_END = /\s+(?:the|a|an|of|and|or|to|in|on|at|for|with|from|by|&)$/i;

/** Cut a name to `n` words without leaving it on "the", "of", "and". */
function cutName(s: string, n: number): string {
  let out = s.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, n).join(" ");
  while (STOP_END.test(out)) out = out.replace(STOP_END, "");
  return out;
}

export interface TitleParts {
  /** The category a known label names ("Character", "CURRENT", "AU Canon"). */
  label?: string;
  cat?: LoreCategory;
  /** What the entry is about: the part after a known label, or before a descriptor. */
  name: string;
  /** "Buffy Summers - The Slayer": the part after the name, when the left side isn't a label. */
  descriptor?: string;
  /** The left part as written, when the title has a separator. */
  left?: string;
}

/**
 * A title read as "Label: Name" (a known label), or "Name - Descriptor" (anything else before the
 * separator: a person, a place, a date). Only known labels count as labels, so "Buffy Summers -
 * The Slayer" is about Buffy Summers, not about "The Slayer".
 */
export function splitTitle(comment: string): TitleParts {
  const c = (comment ?? "").trim();
  const m = /^(.{1,60}?)\s*(?:\s-\s|\s–\s|\s—\s|:\s|\s\|\s)\s*(.+)$/.exec(c);
  if (!m) return { name: cutName(c, 10) };
  const left = m[1].trim();
  const right = m[2].trim();
  const cat = left.split(/\s+/).length <= 4 ? categoryOfLabel(left) : undefined;
  if (cat) return { label: left, cat, name: labelNames(left) ? cutName(`${left}: ${right}`, 12) : cutName(right, 10), left };
  return { name: cutName(left, 10), descriptor: right, left };
}

/** The first sentence, not cut at "Mr." or "St." or an initial. */
function firstSentence(s: string): string {
  const t = s.replace(/\{\{[^}]+\}\}/g, "X").trim();
  const re = /[.!?](?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const before = t.slice(Math.max(0, m.index - 6), m.index + 1);
    if (m[0] === "." && /(?:^|[\s(])(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Sgt|Lt|Col|Gen|Prof|vs|etc|e\.g|i\.e|[A-Z])\.$/.test(before)) continue;
    return t.slice(0, m.index + 1).trim();
  }
  return t;
}

/** The first sentence with a leading time or circumstance clause taken off ("In 1997, …", "After …, …"). */
function mainClause(fs: string): string {
  return fs.replace(/^(?:(?:in|on|at|by|after|before|during|while|when|once|as|following|believing|having|since|until|from)\b[^,]{0,90},\s*)/i, "");
}

function isPast(fs: string): boolean {
  const m = mainClause(fs);
  const pres = PRESENT.exec(m)?.index ?? Infinity;
  const pastIrr = PAST.exec(m)?.index ?? Infinity;
  // A regular past after the subject ("The Initiative captured Spike", "Five months passed"), not an
  // adjective after an article ("the abandoned mansion").
  let pastEd = Infinity;
  const words = [...m.matchAll(/\S+/g)];
  for (let i = 1; i < words.length; i++) {
    // Not after an article, and not after a comma ("Exceptionalism, accepted by the Faith" is a participle).
    if (/^\p{Ll}+ed[,;:]?$/u.test(words[i][0]) && !/^(?:a|an|the|very|most|more|less|so|too|and|or|its|their|his|her)$/i.test(words[i - 1][0]) && !/[,;:—–]$/.test(words[i - 1][0])) {
      pastEd = words[i].index!;
      break;
    }
  }
  // A present verb right after the subject ("Harrenhal broods over …", "King's Landing sprawls …").
  const s3 = /^(?:[A-Z][\p{L}'’.-]*\s+){1,3}(\p{Ll}+[^s\s]s)\s+(?:over|around|near|on|in|at|across|along|above|below|beneath|through|between|among|the|a|an|its|his|her|their|to|from|with|by|as|into)\b/u.exec(m);
  const pres3 = s3 && !/(?:ss|us|is)$/.test(s3[1]) ? s3.index + s3[0].length - s3[1].length : Infinity;
  return Math.min(pastIrr, pastEd) < Math.min(pres, pres3);
}

// A first sentence that names what something is: "X is a/an/the ROLE", "X is Sunnydale's ROLE",
// "X, called Glory, was an exiled hell-goddess".
const NAME = String.raw`(?:[A-Z][\p{L}'’.-]+|the)(?:\s+(?:[A-Z][\p{L}'’.-]+|of|the|de|du|van|von|al|ibn))*`;
const IS_ROLE = new RegExp(String.raw`^(${NAME})(?:,\s+[^,]{1,80},)?\s+(?:is|was)\s+(?:(?:a|an|the|one of the)\s+|(?:[A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){0,3})['’]s?\s+)([^,.;]+)`, "u");

/** What the role names, by its head noun: "an ancient vampire and leader of the Order" is a vampire. */
// Nouns that name a person even after a place or group word ("a senior Watchers Council authority").
const PERSON_NOUN = /^(?:authority|leader|member|head|chief|officer|agent|man|woman|girl|boy|child|figure|director|founder|heir|ruler|lord|lady|servant|guard|soldier|knight|priest|priestess|witch|wizard|mage|sorcerer|sorceress|vampire|demon|god|goddess|slayer|watcher|hunter|student|teacher|professor|doctor|friend|ally|enemy|rival|lover|wife|husband|son|daughter|mother|father|sister|brother|twin|cousin|uncle|aunt|prince|princess|king|queen|official|clerk|scholar|merchant|captain|commander|advisor|adviser|maester|steward|castellan|smith|cook|maid|nanny|nurse|physician|healer|engineer|historian|financier|jurist|poet|musician|singer|dancer|actor|artist|writer|thief|assassin|spy|mercenary|warrior|rider|dragon|creature|beast|cat|dog|wolf|horse|robot|android|construct|ghost|spirit|entity|being)s?$/i;

function roleKind(role: string): CodexKind {
  const head = role.split(/\s+(?:and|or|who|which|that|whose|whom|of|in|on|at|from|for|with|to|by|built|made|created|used|known|called|named|beneath|under|near)\b|[,;:(]/)[0];
  if (PERSON_NOUN.test(head.trim().split(/\s+/).pop() ?? "")) return "person";
  if (/\b(town|city|village|tavern|inn|club|nightclub|house|home|residence|mansion|apartment|crypt|grave|shop|store|forest|street|district|castle|keep|fortress|temple|library|school|university|college|campus|bar|pub|hospital|cemetery|island|kingdom|realm|region|country|land|valley|mountain|river|lake|chamber|hall|tower|yard|facility|base|complex|laboratory|lab|church|palace|prison|estate|venue|restaurant|cafe|café|market|port|harbou?r|ruins?)\b/i.test(head)) return "place";
  if (/\b(sword|blade|ring|amulet|book|volume|tome|handbook|locket|key|device|gun|staff|wand|stake|orb|sphere|urn|vessel|gem|hammer|chip|weapon|artifact|artefact|relic|object|potion|scroll|map|crown|mask)\b/i.test(head)) return "object";
  if (/\b(gangs?|orders?|guilds?|clans?|cults?|compan(?:y|ies)|groups?|factions?|societ(?:y|ies)|organi[sz]ations?|programs?|programmes?|agenc(?:y|ies)|councils?|arm(?:y|ies)|units?|networks?|houses?|dynast(?:y|ies)|famil(?:y|ies)|bands?|tribes?|alliances?|leagues?|corporations?|firms?|lineages?|bloodlines?|brotherhoods?|sisterhoods?|syndicates?|covens?)\b/i.test(head)) return "group";
  if (/\b(rule|law|spell|curse|ritual|process|system|doctrine|custom|tradition)\b/i.test(head)) return "law";
  return "person";
}

/** Names in a phrase ("Laenor and Laena" → [Laenor, Laena]); "the Realm" is nobody's. */
function namesIn(s: string): string[] {
  return s.split(/\s*(?:,|\band\b|&)\s*/).map((x) => x.trim()).filter((x) => /^[A-Z]/.test(x) && !/^(?:The|A|An)\b/.test(x));
}

export function classify(e: LoreEntry, book: WeaverBook | null = null): Classified {
  const part = weaverEntry(e);
  if (part) return classifyWeaverEntry(e, part, book);
  const meta = readLoreMeta(e.extensions);
  const t = splitTitle(e.comment);
  const titleName = t.name;
  const content = e.content ?? "";
  const fs = firstSentence(content);
  const aliases = (e.key ?? []).filter((k) => /^[A-Z]/.test(k) && k.split(/\s+/).length <= 3 && k !== titleName);
  const base: Classified = {
    entryId: e.id, bookId: e.world_book_id, kind: "texture", tense: "timeless", name: titleName || fs.slice(0, 40),
    aliases, confidence: 0.3, via: "guess", summary: fs,
  };
  const as = (cat: LoreCategory | undefined, via: Classified["via"], confidence: number, extra: Partial<Classified> = {}) => {
    if (!cat) return;
    Object.assign(base, { kind: cat.kind, tense: cat.tense, category: cat.id, via, confidence, ...extra });
  };

  if (meta) {
    const cat = category(meta.category);
    const kind = (meta.kind === "situation" && meta.tense === "future" ? "forecast" : meta.kind) as CodexKind;
    Object.assign(base, {
      kind, tense: meta.tense ?? cat?.tense ?? "timeless", confidence: 1, via: "metadata", category: cat?.id,
      participants: meta.participants, place: meta.place, visibility: meta.visibility, expected: meta.expected, members: meta.members,
      ...(meta.holder ? { holder: meta.holder } : {}),
      ...(meta.parent ? { parent: meta.parent } : {}),
      ...(meta.subject ? { subject: meta.subject } : {}),
      ...(typeof meta.name === "string" && meta.name.trim() ? { name: meta.name.trim() } : {}),
    });
  } else if (t.cat) {
    as(t.cat, "title", 0.85);
  }
  if (base.via === "guess" && !book) readUnlabelled(e, t, fs, base, as);
  if (base.via === "guess" && book) {
    // A Weaver book's unlabelled entry: only a plain "X is a/an/the role …" is read here; the book's
    // role decides the rest (an NPC book's people, a depth book's scenes).
    const m = /^([A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){0,3})\s+(?:is|was)\s+(?:a|an|the)\s+([^,.;]+)/u.exec(fs);
    if (m) Object.assign(base, { name: m[1], via: "sentence", confidence: 0.55, kind: roleKind(m[2]) });
  }
  if (book) {
    base.weaver = { role: book.role };
    const unlabelled = base.via === "guess" || base.via === "sentence";
    if (book.role === "npc" && unlabelled) {
      // NPC book: the Weaver titles each entry with the person's name.
      Object.assign(base, { kind: "person", tense: "timeless", name: titleName || base.name, confidence: 0.9, via: "weaver" });
    } else if ((book.role === "depth" || book.role === "persona") && base.via === "guess" && isScene(e.comment || titleName, content, book.role)) {
      // A scripted scene ("When Buffy learns…", "It happens in the kitchen…"): a playbook, not something that happened.
      Object.assign(base, { kind: "playbook", tense: "future", subject: book.subject, confidence: 0.8, via: "weaver", name: (e.comment ?? titleName).trim(), aliases: [], keys: e.key ?? [], summary: clip(content.replace(/\s+/g, " ").trim(), 700) });
    } else if ((book.role === "depth" || book.role === "persona") && base.via === "guess") {
      // Depth book: more about the card's character, or the persona's (history, bonds, secrets, daily texture).
      const past = /\b(history|past|childhood|upbringing|backstory|origins?|before|years ago|used to)\b/i.test(`${titleName} ${(e.key ?? []).join(" ")}`);
      Object.assign(base, { kind: past ? "history" : "texture", tense: past ? "past" : "timeless", subject: book.subject, confidence: 0.6, via: "weaver" });
    } else if (book.role === "lore" && base.via === "guess") {
      // A world's lore book: places, history, factions and customs under short plain titles.
      const hint = LORE_TITLE_HINTS.find(([re]) => re.test(titleName));
      if (hint) Object.assign(base, { kind: hint[1], tense: hint[2], confidence: 0.6, via: "weaver" });
      // Anything else goes to the review queue for the model classifier.
    }
  }
  if (base.kind === "situation" && BELIEF.test(`${titleName} ${fs}`)) {
    base.kind = "belief";
    base.category = "belief";
  }

  switch (base.kind) {
    case "person": {
      const r = /\b(?:is|was)\s+(?:(?:a|an|the)\s+|(?:[A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){0,3})['’]s?\s+)(.+?)(?=\s+(?:who|that|in|of|with)\b|[,.;]|$)/iu.exec(fs);
      if (r) base.role = r[1].trim();
      else if (t.descriptor && !base.role && personDescriptor(t.descriptor)) base.role = t.descriptor;
      // Eyes, hair and age the entry states for this person (not for someone it mentions).
      const looks = traitsFromText(content, [base.name, base.name.split(/\s+/)[0], ...base.aliases]);
      if (looks.length) base.looks = looks;
      const stamina = detectStamina(content, [base.name, base.name.split(/\s+/)[0], ...base.aliases]);
      if (stamina) base.stamina = stamina;
      if (/\b(died|is dead|was killed|passed away)\b/i.test(fs) || /^deceased\b/i.test(t.descriptor ?? "")) base.dead = true;
      break;
    }
    case "place": {
      const p = /\b(?:in|inside|within|part of|located in|beneath)\s+((?:the\s+)?[A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,3})/u.exec(content);
      if (base.parent) {
        /* metadata named it */
      } else if (p) base.parent = p[1].replace(/^the\s+/i, "");
      else if (t.descriptor && t.left && base.name !== t.left && !categoryOfLabel(t.left)) base.parent = t.left;
      const h = /\bopen\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|–|-|until)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i.exec(content);
      if (h) base.hours = h[1];
      const routes = [...content.matchAll(/((?:\w+|\d+)\s+(?:minutes?|hours?)['’]?\s+(?:walk|ride|drive|sail)\s+from\s+(?:the\s+)?[A-Z][\p{L}'’ -]+)/gu)].map((x) => x[1].trim());
      if (routes.length) base.routes = routes;
      const clim = /\b(?:a|an)\s+([\w -]*(?:coastal|desert|tropical|northern|southern|mountain|frozen|arid|temperate|maritime|continental|mediterranean)[\w -]*)\s+(?:town|city|region|land)/i.exec(content);
      if (clim) base.climate = clim[1];
      break;
    }
    case "object": {
      // "Faith's Draconian Katra": the title names whose it is.
      const owns = /^([A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+)?)['’]s\s/u.exec(e.comment ?? "")?.[1];
      if (!base.holder && owns && base.via !== "metadata") base.holder = owns;
      if (!base.holder) {
        const h = /\b(?:carried|held|owned|kept|worn|wielded)\s+by\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)?)/u.exec(fs) || /\b([A-Z][\p{L}'’-]+)(?:'s|’s)\b/u.exec(fs);
        if (h) base.holder = h[1];
      }
      break;
    }
    case "group": {
      if (!base.members) {
        const names = [...content.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g)].map((x) => x[1]).filter((n) => n !== base.name && !/^(The|A|An|In|Its|Their|They|It|He|She)$/.test(n));
        base.members = [...new Set(names)].slice(0, 12);
      }
      break;
    }
    case "bond": {
      if (!base.participants?.length) base.participants = pairNames(base.name) ?? namesIn(base.name).slice(0, 2);
      break;
    }
    case "playbook": {
      // A "Scene:" entry from any book: how someone acts if the story gets there. Recalled by its own words.
      const who = base.subject ?? base.participants?.[0] ?? namesIn(titleName.replace(/^(?:when|if|once|after|the first time|the moment)\s+/i, "").split(/\s+/).slice(0, 2).join(" "))[0];
      Object.assign(base, { subject: who, aliases: [], keys: e.key ?? [], name: base.via === "metadata" ? base.name : titleName, summary: clip(content.replace(/\s+/g, " ").trim(), 700) });
      break;
    }
    case "situation":
    case "forecast":
    case "belief": {
      if (!base.participants) {
        const before = /^(.+?)\s+(?:is|are|was|were|flee|fleeing|plan|plans|believe|believes|think|thinks|attack|attacks|search|searches|will|do not know|does not know|don't know|doesn't know)\b/i.exec(titleName)?.[1];
        if (before) base.participants = namesIn(before);
      }
      if (!base.visibility) base.visibility = PUBLIC.test(`${titleName} ${content}`) ? "public" : "private";
      if (!base.expected) base.expected = [...content.matchAll(/[^.]*\b(will|is about to|is going to|plans to|are about to|are going to)\b[^.]*\./gi)].map((x) => x[0].trim()).slice(0, 3);
      if (base.kind === "belief") base.mistaken = MISTAKEN.test(content) && !/\b(rightly|correctly)\b/i.test(content);
      break;
    }
    case "texture": {
      if (base.category === "voice") {
        // How someone talks: it goes on their card as their voice.
        base.subject ??= base.participants?.[0] ?? base.name;
        base.voice = clip(content.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim(), 240);
      } else if (base.category === "secret" || SECRET.test(content)) {
        const sign = SIGN.exec(content.replace(firstSentence(content), ""))?.[0]?.trim();
        base.secret = { fact: firstSentence(content), sign };
      }
      break;
    }
  }
  if (!base.name) base.name = e.id;
  return base;
}

/** A descriptor that reads as a role ("The Slayer", "Castellan"), not a trait or a status ("Age Eight", "Deceased"). */
function personDescriptor(d: string): boolean {
  if (BARE_DESCRIPTOR.test(d) || VOICE_DESCRIPTOR.test(d)) return false;
  if (/^(?:age|aged|deceased|dead|status|appearance|personality|backstory|history|past|secrets?|years?|fire|immunity|conflict)\b/i.test(d)) return false;
  return /^(?:the\s+)?[A-Z][\p{L}'’-]*(?:\s+(?:of|the|and|&|[A-Z][\p{L}'’-]*)){0,5}$/u.test(d);
}

/**
 * An entry with no metadata and no known label, read from what free-form books do: a tag the
 * content opens with, the title's shape (a pair of names, a voice, "What X Knows", a date, a rank),
 * the first sentence, then weaker hints. Each sets a category only when it is fairly sure.
 */
function readUnlabelled(e: LoreEntry, t: TitleParts, fs: string, base: Classified, as: (cat: LoreCategory | undefined, via: Classified["via"], confidence: number, extra?: Partial<Classified>) => void) {
  const title = (e.comment ?? "").trim();
  const left = t.left ?? title;
  const d = t.descriptor;
  const bare = d && BARE_DESCRIPTOR.test(d);
  const content = e.content ?? "";
  const pos1 = (e as any).position === 1;
  // Non-person names keep their descriptor, so "Harrenhal - The Five Towers" is no second "Harrenhal".
  const thingName = d && !bare ? cutName(`${left}: ${d}`, 12) : t.name;

  // 1. A tag the content opens with ("RULE:", "MYTHOLOGY:", "STORY ARC:", "AI DIRECTIVE:").
  const tag = contentTag(content);
  if (tag) {
    as(tag, "tag", 0.8, { name: tag.kind === "person" ? t.name : thingName });
    return;
  }
  // 2. A dated title: "109 AC - Daemon Begins …" is an event; "The Wildfire Nameday - 5 Third Moon 281 AC" too.
  if (d && DATED.test(left)) {
    as(category("history"), "shape", 0.7, { name: cutName(d, 12) });
    return;
  }
  if (d && DATED.test(d) && (EVENT_NOUN.test(left) || TITLE_VERB.test(left))) {
    as(category("history"), "shape", 0.7, { name: t.name });
    return;
  }
  // 3. Who knows what: "What Rhaenyra Does Not Know", "What the Realm Believes".
  const knows = /^what\s+(.+?)\s+(knows?|believes?|thinks?|suspects?|does(?:n['’]t| not) know|do(?:n['’]t| not) know|remembers?)$/i.exec(title);
  if (knows) {
    const who = namesIn(knows[1]);
    as(category("belief"), "shape", 0.7, { name: title, participants: who.length ? who : undefined, ...(/\b(realm|town|city|court|public|everyone|people|world)\b/i.test(knows[1]) ? { visibility: "public" } : {}) });
    return;
  }
  // 4. Two people: "Buffy & Spike - Truce", "Viserys and Rhaegel" (on its own, kept with the characters).
  // Not two places or groups ("Red Keep & Court"), not an event ("Kendra Dies & Acathla Opens").
  const pair = pairNames(left);
  const thingWord = (s: string) => [GROUP_HINT, PLACE_HINT, OBJECT_HINT].some((re) => re.test(s.split(/\s+/).pop() ?? ""));
  if (pair && (d || pos1) && !EVENT_NOUN.test(left) && !TITLE_VERB.test(left) && !thingWord(pair[0]) && !thingWord(pair[1])) {
    as(category("relationship"), "shape", 0.75, { name: `${pair[0]} & ${pair[1]}`, participants: pair });
    return;
  }
  // 5. How someone talks: "Rhaenyra - Speech and Manner".
  if (d && VOICE_DESCRIPTOR.test(d)) {
    as(category("voice"), "shape", 0.8, { name: t.name, participants: [t.name] });
    return;
  }
  // 6. Events: a title that tells something happening ("Faith Kills Allan Finch").
  if (!pos1 && TITLE_VERB.test(title) && !IS_ROLE.test(fs)) {
    as(category("history"), "shape", 0.6, { name: t.name === left && d ? thingName : t.name });
    return;
  }
  // 7. A group by its form: "House Velaryon", "Order of Dagon", "Knights of Byzantium".
  if (/^(?:House|Clan|Order|Knights|Brotherhood|Sisterhood|Church|Cult|Company|Band|Guild)\s+(?:of\s+(?:the\s+)?)?\p{Lu}/u.test(left)) {
    as(category("faction"), "shape", 0.7, { name: thingName });
    return;
  }
  // 8. A person by rank ("Ser Criston Cole", "Princess Elia Martell"), unless the first sentence says it's a thing.
  const role = IS_ROLE.exec(fs);
  const roleK = role ? roleKind(role[2]) : null;
  if (HONORIFIC.test(left) && !/['’]s\s/.test(left) && !EVENT_NOUN.test(left) && (!roleK || roleK === "person")) {
    const plain = left.replace(/^(?:grand\s+)?\S+\.?\s+(?=\p{Lu})/iu, "");
    as(category("character"), "shape", 0.75, { name: plain.split(/\s+/).length >= 2 ? plain : left, aliases: [...new Set([...base.aliases, left])].filter((a) => a !== plain) });
    return;
  }
  // 9. A name whose content opens with that person (their name, maybe after a rank, then a verb or an
  // aside: "Daniel 'Oz' Osbourne is …", "Lord Lyonel Strong, Hand of the King …", "Elia Martell — Twenty-two"),
  // not with something of theirs ("Rhaenyra's anger …").
  const c0 = content.trimStart().replace(/^(?:grand\s+)?(\p{L}+)\.?\s+(?=\p{Lu})/iu, (m, w) => (isRankWord(w) ? "" : m));
  const nameLed = (n: string) => {
    const words = n.split(/\s+/);
    if (words.length < 2 || !c0.startsWith(words[0]) || /^\S+['’]s\b/.test(c0)) return false;
    if (c0.startsWith(n) && /^(?:[\s,]+(?:\p{Ll}|\()|\s*[—–:-]\s)/u.test(c0.slice(n.length))) return true;
    return /^[^.!?]{0,40}?\s(?:is|was|has|had|serves|served|rules|ruled|remains|grew|became|endured)\b|^[^,.!?]{2,40},/.test(c0);
  };
  const named = /^\p{Lu}[\p{L}'’.-]+(?:\s+\p{Lu}[\p{L}'’.-]+){1,3}$/u.test(left) && !/^The\s/.test(left);
  const hinted = thingWord(left);
  // A descriptor that names a role ("Hand of the King", "Captain of the Household Guard", "Dragon of Prince Rhaegel").
  const roleDescriptor = d && !bare && [d.replace(/^the\s+/i, "").split(/\s+/)[0], d.split(/\s+/).pop() ?? ""].some((w) => PERSON_NOUN.test(w.replace(/['’]s$/, "")) || /^(?:hand|master|mistress|keeper|warden|lord|lady)$/i.test(w));
  if ((d ? !bare : named) && /^\p{Lu}/u.test(left) && (pos1 || !hinted) && (!roleK || roleK === "person") && (nameLed(left) || (role && role[1] === left) || (d && roleDescriptor && !hinted))) {
    as(category("character"), "shape", 0.7, { name: left });
    return;
  }
  // 10. The first sentence: "X is a/an/the …", "X is Sunnydale's …", "X, called Glory, was an …".
  // A title that names a thing ("Order of Taraka") outranks a first sentence read as a person.
  const titleHint = ([[GROUP_HINT, "group"], [OBJECT_HINT, "object"], [PLACE_HINT, "place"]] as [RegExp, CodexKind][]).find(([re]) => re.test(left))?.[1];
  if (role && !/^the$/i.test(role[1])) {
    const subject = d && role[1].endsWith(left) ? left : role[1];
    const kind = roleK === "person" && titleHint ? titleHint : roleK!;
    const cat = kind === "person" ? category("character") : kind === "place" ? category("location") : kind === "object" ? category("item") : kind === "group" ? category("faction") : category("rule");
    // A person is named for themselves; a place or thing keeps the title's own words.
    as(cat, "sentence", 0.6, { name: kind === "person" ? subject : t.name || subject });
    return;
  }
  // An aside that says what it is: "Harrenhal broods over the Gods Eye, the largest castle in …".
  const aside = content.trimStart().startsWith(left) ? /^[^,.;]{0,90},\s+(?:the|a|an)\s+([^,.;]+)/.exec(fs)?.[1] : undefined;
  const asideK = aside ? roleKind(aside) : null;
  if (asideK && asideK !== "person") {
    const cat = asideK === "place" ? category("location") : asideK === "object" ? category("item") : asideK === "group" ? category("faction") : category("rule");
    as(cat, "sentence", 0.55, { name: t.name });
    return;
  }
  // 11. Strong nouns in the title: a guild, a sword, a tavern.
  const strong: [RegExp, string][] = [[GROUP_HINT, "faction"], [OBJECT_HINT, "item"], [PLACE_HINT, "location"]];
  // The head noun (the title's last word) decides first: "Spike's Initiative Chip" is a chip.
  const lastWord = (left.split(/\s+/).pop() ?? "").replace(/['’]s$/, "");
  const hit = strong.find(([re]) => re.test(lastWord)) ?? strong.find(([re]) => re.test(left) || (d ? re.test(d) && !bare : false));
  if (hit) {
    as(category(hit[1]), "hint", 0.55, { name: thingName });
    return;
  }
  // 12. A past-tense entry is history ("Five months passed after Buffy's sacrifice").
  if (!pos1 && isPast(fs)) {
    as(category("history"), "hint", 0.55, { name: thingName });
    return;
  }
  // 13. Weaker words: rules, customs, history; then an event's name ("Buffy's Second Death").
  const weak: [RegExp, string][] = [[HISTORY_HINT, "history"], [LAW_HINT, "rule"], [TEXTURE_HINT, "customs"]];
  const w = weak.find(([re]) => re.test(title));
  if (w) {
    as(category(w[1]), "hint", 0.5, { name: thingName });
    return;
  }
  if (!pos1 && EVENT_NOUN.test(left)) {
    as(category("history"), "hint", 0.5, { name: thingName });
    return;
  }
  // 14. "Rhaenyra's Denial", "Daemon's Whisper Campaign": more about that person (not "King's Landing").
  const owner = /^([A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){0,2})['’]s\s+\S/u.exec(left)?.[1] ?? (d && /^[A-Z][\p{L}'’.-]+$/u.test(left) ? left : undefined);
  if (owner && !isRankWord(owner)) {
    Object.assign(base, { subject: owner, name: thingName, confidence: 0.5, via: "hint" as const, category: "customs" });
  }
}

// How a scripted scene opens: a trigger ("When…", "If…", "The first time…", "It happens…").
const SCENE_OPEN = /^(?:when|whenever|if|once|the first time|the next time|the moment|it happens|after|as soon as|the day|the night|until|learning|seeing|hearing)\b/i;
const SCENE_TITLE = /^(?:learning|seeing|hearing|arriving|finding|meeting|the first|the word|(?:her|his|their) first|when|if|once)\b/i;
const QUOTED = /['‘"“][^'’"”\n]{4,}['’"”]/;

/**
 * A depth-book entry that scripts a scene (how someone acts if the story reaches a moment), rather
 * than telling who they are. The Weaver's character depth books are mostly these, written as if
 * they happen; its persona depth books are backstory.
 */
export function isScene(title: string, content: string, role: WeaverRole = "depth"): boolean {
  const c = content.trim();
  if (SCENE_OPEN.test(c)) return true;
  if (role !== "depth") return false;
  if (SCENE_TITLE.test(title.trim())) return true;
  const first = firstSentence(c);
  const scenic = /\b(when|if|once|tonight|the first time)\b/i.test(first) || /:\s|\s[—–]\s/.test(title);
  return scenic && QUOTED.test(c);
}

const TITLE_STOP = new Set("with that this from their them then into when where what which while about after before have been were said says aloud".split(" "));

/**
 * Whether a chapter shows a playbook's scene happened: two of its own keywords (not names) and
 * most of its title's words. Conservative on purpose; the Lore page can mark one played by hand.
 */
export function playbookPlayed(pb: { name: string; keys: string[] }, chapter: string): boolean {
  const low = chapter.toLowerCase();
  const has = (w: string) => new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(low);
  const keyHits = pb.keys.map((k) => k.toLowerCase().trim()).filter((k) => k.length >= 4 && has(k)).length;
  const words = [...new Set((pb.name.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []).map((w) => w.replace(/['’]s$/, "")).filter((w) => !TITLE_STOP.has(w)))];
  if (keyHits < 2 || !words.length) return false;
  return words.filter(has).length / words.length >= 0.6;
}

const KIND_PREFIX: Partial<Record<CodexKind, string>> = {
  person: "char:", place: "loc:", object: "item:", group: "fac:", thread: "thread:", playbook: "play:", bond: "bond:",
};

/** Turn classified lore into Codex overlays (baseline records, "true as the story begins"). */
export function seedOverlays(items: Classified[], opts: { userName?: string } = {}): Record<string, CodexOverlay> {
  const out: Record<string, CodexOverlay> = {};
  const low = (s: string) => s.toLowerCase().replace(/’/g, "'").trim();
  // A Weaver re-anchor adds voice and drives to the card's character. When another book already has
  // that person (by this name, an alias, or a shorter form: "Buffy Summers" for "Buffy Anne Summers"),
  // it fills that record instead of making a second card. A world's anchor does the same for a lore
  // entry about the place itself (by exact name).
  const anchorInto = new Map<Classified, Classified>();
  for (const a of items) {
    if (a.weaver?.part !== "anchor" || (a.kind !== "person" && a.kind !== "place")) continue;
    const an = low(a.name);
    const at = an.split(/\s+/);
    const t = items.find((c) => {
      if (c === a || c.kind !== a.kind || c.weaver?.part === "anchor") return false;
      if ([c.name, ...c.aliases].some((n) => low(n) === an)) return true;
      const ct = low(c.name).split(/\s+/);
      return a.kind === "person" && ct[0] === at[0] && ct.every((w) => at.includes(w));
    });
    if (t) anchorInto.set(a, t);
  }
  // A voice entry ("Rhaenyra - Speech and Manner") is that person's voice, on their own card, when
  // a book has them (by name, alias, or first name: "Rhaenyra" for "Rhaenyra Targaryen").
  for (const v of items) {
    if (v.category !== "voice" || !v.voice || !v.subject) continue;
    const sn = low(v.subject);
    const t = items.find((c) => c.kind === "person" && c !== v && ([c.name, ...c.aliases].some((n) => low(n) === sn) || low(c.name).split(/\s+/)[0] === sn.split(/\s+/)[0]));
    if (!t) continue;
    if (!t.voice) t.voice = v.voice;
    anchorInto.set(v, t);
  }
  items = items.filter((c) => !anchorInto.has(c));
  const anchorsOf = (c: Classified) => [...anchorInto].filter(([, t]) => t === c).map(([a]) => a);
  const titles = new Set(items.map((c) => low(c.name)));
  // Which people answer to each name or alias (keys often name whoever the entry mentions).
  const claims = new Map<string, number>();
  for (const c of items) if (c.kind === "person") for (const n of new Set([c.name, ...c.aliases].map(low))) claims.set(n, (claims.get(n) ?? 0) + 1);
  const user = opts.userName ? low(opts.userName) : "";
  const aliasesOf = (c: Classified) => {
    const own = low(c.name).split(/\s+/);
    return c.aliases.filter((a) => {
      const n = low(a);
      if (n === low(c.name) || /'s$/.test(n)) return false; // possessive key forms ("Rack's") aren't names
      if (titles.has(n)) return false; // another entry's title: "Buffybot" is not Buffy
      if (user && (n === user || n === user.split(/\s+/)[0])) return false;
      // Claimed by another person too, and not part of this one's own name: nobody's alias.
      return (claims.get(n) ?? 0) <= 1 || n.split(/\s+/).every((t) => own.includes(t));
    });
  };
  for (const c of items) {
    // Instructions to the model, not story facts: the host keeps sending them.
    if (c.kind === "meta" || c.kind === "directive") continue;
    const prefix = KIND_PREFIX[c.kind] ?? "lore:";
    let id = `${prefix}${slug(c.name)}`;
    if (c.kind === "situation" || c.kind === "belief" || c.kind === "forecast") id = `lore:${slug(c.name)}`;
    if (opts.userName && c.kind === "person" && c.name.toLowerCase() === opts.userName.toLowerCase()) id = "char:user";
    const body: Record<string, any> = {};
    const anchors = anchorsOf(c);
    const role = c.role ?? anchors.find((a) => a.role)?.role;
    const want = c.want ?? anchors.find((a) => a.want)?.want;
    const voice = c.voice ?? anchors.find((a) => a.voice)?.voice;
    if (role) body.role = role;
    if (want) body.want = want;
    if (voice) body.voice = voice;
    if (c.looks?.length) body.looks = c.looks;
    if (c.stamina) body.stamina = c.stamina;
    const tension = c.tension ?? anchors.find((a) => a.tension)?.tension;
    if (tension) body.tension = tension;
    if (c.hours) body.hours = c.hours;
    if (c.routes) body.routes = c.routes;
    if (c.parent) body.parent = c.parent;
    if (c.holder) body.holder = c.holder;
    if (c.members) body.members = c.members;
    if (c.participants) body.participants = c.participants;
    if (c.expected?.length) body.expected = c.expected;
    if (c.visibility) body.visibility = c.visibility;
    if (c.mistaken != null) body.mistaken = c.mistaken;
    if (c.climate) body.climate = c.climate;
    if (c.secret) body.secrets = [c.secret];
    const links: { rel: string; to: string }[] = [];
    if (c.parent) links.push({ rel: "in", to: `loc:${slug(c.parent)}` });
    if (c.holder) links.push({ rel: "held-by", to: `char:${slug(c.holder)}` });
    for (const m of c.members ?? []) links.push({ rel: "member", to: `char:${slug(m)}` });
    for (const p of c.participants ?? []) links.push({ rel: "participant", to: `char:${slug(p)}` });
    if (c.place) links.push({ rel: "at", to: `loc:${slug(c.place)}` });
    if (c.subject) links.push({ rel: "about", to: user && low(c.subject) === user ? "char:user" : `char:${slug(c.subject)}` });
    const narratorOnly = c.kind === "texture" && !!c.secret;
    out[id] = {
      id,
      standalone: true,
      kind: c.kind,
      tense: c.tense,
      name: c.name,
      aliases: [...new Set([...aliasesOf(c), ...anchors.map((a) => a.name).filter((n) => low(n) !== low(c.name))])],
      summary: c.kind === "forecast" ? `Upcoming (not yet true): ${c.summary}` : c.kind === "belief" && c.mistaken ? `${c.summary} (a mistaken belief)` : c.summary,
      body,
      links,
      scope: narratorOnly || c.kind === "playbook" ? { narratorOnly: true } : c.visibility === "public" ? { public: true } : {},
      ...(c.kind === "playbook" && c.keys?.length ? { keys: c.keys.filter((k) => typeof k === "string" && k.trim()).slice(0, 12) } : {}),
      provenance: { loreEntryId: c.entryId, loreBookId: c.bookId, source: "lore" },
      status: c.dead ? "dead" : "active",
    };
  }
  return out;
}

export type BookMode = "native" | "assisted" | "managed";
export interface BookPolicy {
  mode: BookMode;
  permission: "read" | "overlay" | "write";
}
