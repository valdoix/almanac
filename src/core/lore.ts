// Lore Bridge: read attached lorebooks (character, persona, chat, global) into
// Codex baselines using VELLUM III reading conventions — exact metadata first,
// then the title label, then first-sentence rules. Low-confidence entries go to
// a review queue (and can be sent to the LLM classifier).

import type { CodexKind, CodexOverlay } from "./codex";
import { slug } from "./util";
import { traitsFromText } from "./traits";
import type { TraitKind } from "./types";

export interface LoreEntry {
  id: string;
  world_book_id: string;
  comment: string;
  content: string;
  key: string[];
  disabled?: boolean;
  constant?: boolean;
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
  via: "metadata" | "title" | "sentence" | "guess" | "weaver";
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

const LABELS: [RegExp, CodexKind, Classified["tense"]][] = [
  [/^(current|now|ongoing|active|right now)$/i, "situation", "now"],
  [/^(timeline boundary|era|canon point|story start)$/i, "boundary", "timeless"],
  [/^(faction|group|gang|order|clan|coven|guild|cult|society|house|company|crew|family)$/i, "group", "timeless"],
  [/^(location|place|city|town|village|building|district|region|realm|kingdom|country|planet|room|area|landmark)$/i, "place", "timeless"],
  [/^(character|npc|person)$/i, "person", "timeless"],
  [/^(item|object|artifact|artefact|weapon|relic|equipment)$/i, "object", "timeless"],
  [/^(rule|law|magic|magic system|how .* works|mechanic|physics)$/i, "law", "timeless"],
  [/^(history|past|backstory|previously|origins?)$/i, "history", "past"],
  [/^(upcoming|prophecy|planned|scheduled|future)$/i, "forecast", "future"],
  [/^(customs|culture|traditions|atmosphere|slang|language)$/i, "texture", "timeless"],
  [/^(ooc|instructions|author's note|format|style)$/i, "meta", "timeless"],
];

// Title words for untagged Weaver lore entries, first match wins ("The Harbour Guild" is a group,
// "Harbour Festival" a custom, "Rules of the Harbour" a rule, before any of them is a place).
const LORE_TITLE_HINTS: [RegExp, CodexKind, Classified["tense"]][] = [
  [/\b(history|founding|founded|origins?|the fall of|war of|years? ago|age of|legend of|in the old days|before the)\b/i, "history", "past"],
  [/\b(guild|order|council|clan|famil(?:y|ies)|house of|crew|church|cult|company|watch|brotherhood|sisterhood|society|faction|court|union|gang|coven|syndicate|circle)\b/i, "group", "timeless"],
  [/\b(rules?|laws?|magic|how .+ works|the price|cost of|curse|pact|oath|bargain|covenant|forbidden|taboo)\b/i, "law", "timeless"],
  [/\b(customs?|traditions?|festival|rites?|rituals?|ceremon(?:y|ies)|holiday|feast|superstitions?|etiquette|slang|dialect|cuisine|dress|fashion|night|day|season)\b/i, "texture", "timeless"],
  [/\b(ledger|book|key|sword|ring|amulet|map|relic|artifact|artefact|crown|blade|mask|lantern|bell|idol|stone|coin)\b/i, "object", "timeless"],
  [/\b(harbou?r|bay|port|docks?|pier|market|street|road|square|quarter|district|ward|tavern|inn|pub|bar|hall|temple|shrine|chapel|keep|castle|tower|manor|house|office|library|school|academy|forest|woods|marsh|river|lake|sea|coast|shore|island|mountain|valley|cave|mine|ruins?|gate|walls?|bridge|lighthouse|cemetery|graveyard|farm|mill|shop|store|warehouse|station|village|town|city|palace|prison|asylum|hospital)\b/i, "place", "timeless"],
];

const BELIEF = /\b(believes?|thinks?|assumes?|unaware|doesn'?t know|don'?t know|suspects?|convinced)\b/i;
const MISTAKEN = /\b(unbeknownst|in truth|actually|mistakenly|doesn'?t yet know|wrongly)\b/i;
const PUBLIC = /\b(raid|fire|attack|riot|festival|in the streets|sirens|crowds|the town watches|parade|war|siege|explosion)\b/i;
const SECRET = /\b(secret|hidden|concealed|unknown to most|no one knows)\b/i;
const SIGN = /[^.]*\b(sign|smell|scent|cold spot|mark|draft|draught|sound|stain|notice)\b[^.]*\./i;

export function splitTitle(comment: string): { label?: string; name: string } {
  const c = (comment ?? "").trim();
  const m = /^(.{1,40}?)\s*(?:\s-\s|\s–\s|:\s|\s\|\s)\s*(.+)$/.exec(c);
  if (m && m[1].split(/\s+/).length <= 4) return { label: m[1].trim(), name: m[2].replace(/\s*\([^)]*\)\s*/g, " ").trim().split(/\s+/).slice(0, 5).join(" ") };
  return { name: c };
}

function firstSentence(s: string): string {
  const t = s.replace(/\{\{[^}]+\}\}/g, "X").trim();
  const m = /^[\s\S]*?[.!?](\s|$)/.exec(t);
  return (m ? m[0] : t).trim();
}

export function classify(e: LoreEntry, book: WeaverBook | null = null): Classified {
  const part = weaverEntry(e);
  if (part) return classifyWeaverEntry(e, part, book);
  const meta = e.extensions?.vellum3 ?? e.extensions?.almanac?.vellum3 ?? null;
  const { label, name: titleName } = splitTitle(e.comment);
  const fs = firstSentence(e.content ?? "");
  const aliases = (e.key ?? []).filter((k) => /^[A-Z]/.test(k) && k.split(/\s+/).length <= 3 && k !== titleName);
  const base: Classified = {
    entryId: e.id, bookId: e.world_book_id, kind: "texture", tense: "timeless", name: titleName || fs.slice(0, 40),
    aliases, confidence: 0.3, via: "guess", summary: fs,
  };

  if (meta && typeof meta.kind === "string") {
    const kind = (meta.kind === "situation" && meta.tense === "future" ? "forecast" : meta.kind) as CodexKind;
    Object.assign(base, {
      kind, tense: meta.tense ?? "timeless", confidence: 1, via: "metadata",
      participants: meta.participants, place: meta.place, visibility: meta.visibility, expected: meta.expected, members: meta.members,
    });
  } else if (label) {
    for (const [re, kind, tense] of LABELS) {
      if (re.test(label)) {
        base.kind = kind;
        base.tense = tense;
        base.confidence = 0.85;
        base.via = "title";
        break;
      }
    }
  }
  if (base.via === "guess") {
    // Unlabelled: "X is a/an/the role …"
    const m = /^([A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){0,3})\s+(?:is|was)\s+(?:a|an|the)\s+([^,.;]+)/u.exec(fs);
    if (m) {
      base.name = m[1];
      base.via = "sentence";
      base.confidence = 0.55;
      base.kind = /\b(town|city|village|tavern|inn|club|house|shop|forest|street|district|castle|temple|library|school|bar|nightclub)\b/i.test(m[2]) ? "place" : /\b(sword|ring|amulet|book|blade|locket|key|device|gun|staff)\b/i.test(m[2]) ? "object" : /\b(gang|order|guild|clan|cult|company|group|faction|society)\b/i.test(m[2]) ? "group" : "person";
    }
  }
  if (book) {
    base.weaver = { role: book.role };
    const unlabelled = base.via === "guess" || base.via === "sentence";
    if (book.role === "npc" && unlabelled) {
      // NPC book: the Weaver titles each entry with the person's name.
      Object.assign(base, { kind: "person", tense: "timeless", name: titleName || base.name, confidence: 0.9, via: "weaver" });
    } else if ((book.role === "depth" || book.role === "persona") && base.via === "guess" && isScene(e.comment || titleName, e.content ?? "", book.role)) {
      // A scripted scene ("When Buffy learns…", "It happens in the kitchen…"): a playbook, not something that happened.
      Object.assign(base, { kind: "playbook", tense: "future", subject: book.subject, confidence: 0.8, via: "weaver", name: (e.comment ?? titleName).trim(), aliases: [], keys: e.key ?? [], summary: clip((e.content ?? "").replace(/\s+/g, " ").trim(), 700) });
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
  if (base.kind === "situation" && BELIEF.test(`${titleName} ${fs}`)) base.kind = "belief";

  const content = e.content ?? "";
  switch (base.kind) {
    case "person": {
      const r = /\b(?:is|was)\s+(?:a|an|the)\s+(.+?)(?=\s+(?:who|that|in|of|with)\b|[,.;]|$)/i.exec(fs);
      if (r) base.role = r[1].trim();
      // Eyes, hair and age the entry states for this person (not for someone it mentions).
      const looks = traitsFromText(content, [base.name, base.name.split(/\s+/)[0], ...base.aliases]);
      if (looks.length) base.looks = looks;
      if (/\b(died|is dead|was killed|passed away)\b/i.test(fs)) base.dead = true;
      break;
    }
    case "place": {
      const p = /\b(?:in|inside|within|part of|located in|beneath)\s+((?:the\s+)?[A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,3})/u.exec(content);
      if (p) base.parent = p[1].replace(/^the\s+/i, "");
      const h = /\bopen\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|–|-|until)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i.exec(content);
      if (h) base.hours = h[1];
      const routes = [...content.matchAll(/((?:\w+|\d+)\s+(?:minutes?|hours?)['’]?\s+(?:walk|ride|drive|sail)\s+from\s+(?:the\s+)?[A-Z][\p{L}'’ -]+)/gu)].map((x) => x[1].trim());
      if (routes.length) base.routes = routes;
      const clim = /\b(?:a|an)\s+([\w -]*(?:coastal|desert|tropical|northern|southern|mountain|frozen|arid|temperate|maritime|continental|mediterranean)[\w -]*)\s+(?:town|city|region|land)/i.exec(content);
      if (clim) base.climate = clim[1];
      break;
    }
    case "object": {
      const h = /\b(?:carried|held|owned|kept|worn|wielded)\s+by\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)?)/u.exec(fs) || /\b([A-Z][\p{L}'’-]+)(?:'s|’s)\b/u.exec(fs);
      if (h) base.holder = h[1];
      break;
    }
    case "group": {
      if (!base.members) {
        const names = [...content.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g)].map((x) => x[1]).filter((n) => n !== base.name && !/^(The|A|An|In|Its|Their|They|It|He|She)$/.test(n));
        base.members = [...new Set(names)].slice(0, 12);
      }
      break;
    }
    case "situation":
    case "forecast":
    case "belief": {
      if (!base.participants) {
        const before = /^(.+?)\s+(?:is|are|was|were|flee|fleeing|plan|plans|believe|believes|think|thinks|attack|attacks|search|searches|will)\b/i.exec(titleName)?.[1];
        if (before) base.participants = before.split(/\s*(?:,|\band\b|&)\s*/).map((s) => s.trim()).filter((s) => /^[A-Z]/.test(s));
      }
      if (!base.visibility) base.visibility = PUBLIC.test(`${titleName} ${content}`) ? "public" : "private";
      if (!base.expected) base.expected = [...content.matchAll(/[^.]*\b(will|is about to|is going to|plans to|are about to|are going to)\b[^.]*\./gi)].map((x) => x[0].trim()).slice(0, 3);
      if (base.kind === "belief") base.mistaken = MISTAKEN.test(content) && !/\b(rightly|correctly)\b/i.test(content);
      break;
    }
    case "texture": {
      if (SECRET.test(content)) {
        const sign = SIGN.exec(content.replace(firstSentence(content), ""))?.[0]?.trim();
        base.secret = { fact: firstSentence(content), sign };
      }
      break;
    }
  }
  if (!base.name) base.name = e.id;
  return base;
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
  person: "char:", place: "loc:", object: "item:", group: "fac:", thread: "thread:", playbook: "play:",
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
