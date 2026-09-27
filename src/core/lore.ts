// Lore Bridge: read attached lorebooks (character, persona, chat, global) into
// Codex baselines using VELLUM III reading conventions — exact metadata first,
// then the title label, then first-sentence rules. Low-confidence entries go to
// a review queue (and can be sent to the LLM classifier).

import type { CodexKind, CodexOverlay } from "./codex";
import { slug } from "./util";

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
  via: "metadata" | "title" | "sentence" | "guess";
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
  summary: string;
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

export function classify(e: LoreEntry): Classified {
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
  if (base.kind === "situation" && BELIEF.test(`${titleName} ${fs}`)) base.kind = "belief";

  const content = e.content ?? "";
  switch (base.kind) {
    case "person": {
      const r = /\b(?:is|was)\s+(?:a|an|the)\s+(.+?)(?=\s+(?:who|that|in|of|with)\b|[,.;]|$)/i.exec(fs);
      if (r) base.role = r[1].trim();
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

const KIND_PREFIX: Partial<Record<CodexKind, string>> = {
  person: "char:", place: "loc:", object: "item:", group: "fac:", thread: "thread:",
};

/** Turn classified lore into Codex overlays (baseline records, "true as the story begins"). */
export function seedOverlays(items: Classified[], opts: { userName?: string } = {}): Record<string, CodexOverlay> {
  const out: Record<string, CodexOverlay> = {};
  const low = (s: string) => s.toLowerCase().replace(/’/g, "'").trim();
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
    if (c.kind === "meta") continue;
    const prefix = KIND_PREFIX[c.kind] ?? "lore:";
    let id = `${prefix}${slug(c.name)}`;
    if (c.kind === "situation" || c.kind === "belief" || c.kind === "forecast") id = `lore:${slug(c.name)}`;
    if (opts.userName && c.kind === "person" && c.name.toLowerCase() === opts.userName.toLowerCase()) id = "char:user";
    const body: Record<string, any> = {};
    if (c.role) body.role = c.role;
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
    const narratorOnly = c.kind === "texture" && !!c.secret;
    out[id] = {
      id,
      standalone: true,
      kind: c.kind,
      tense: c.tense,
      name: c.name,
      aliases: aliasesOf(c),
      summary: c.kind === "forecast" ? `Upcoming (not yet true): ${c.summary}` : c.kind === "belief" && c.mistaken ? `${c.summary} (a mistaken belief)` : c.summary,
      body,
      links,
      scope: narratorOnly ? { narratorOnly: true } : c.visibility === "public" ? { public: true } : {},
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
