// The Codex: the story bible. Most records are a deterministic projection of
// world state (always current, free). Stored overlays add what state can't
// derive: lore-seeded baselines, archivist prose, user edits (locked), routines,
// hidden pressures, colours and user keys.

import type { WorldState } from "./types";
import { fmtTime, slug, uniq } from "./util";
import { carried, LADDER_NAMES, normFact, overlap } from "./state";
import { factKind } from "./facts";
import { traitLine } from "./traits";

export type CodexKind =
  | "person" | "place" | "object" | "group" | "law" | "history" | "situation" | "belief" | "texture"
  | "boundary" | "meta" | "thread" | "document" | "forecast" | "consequence" | "fact" | "clue"
  // Always-on play rules for the model (a Dream Weaver rules book): read, never seeded as story.
  | "directive"
  // A scripted scene that hasn't happened ("When Buffy learns…", "It happens in the kitchen…"): how
  // someone would act if the story gets there. Never history; sent only when the story is close.
  | "playbook"
  // What lies between two people, from a lorebook ("Buffy & Spike - Truce"); linked to both.
  | "bond";

export interface CodexRecord {
  id: string;
  kind: CodexKind;
  tense: "now" | "past" | "future" | "timeless";
  name: string;
  aliases: string[];
  keys: string[];
  summary: string;
  body: Record<string, any>;
  links: { rel: string; to: string }[];
  scope: { knownBy?: string[]; hiddenFrom?: string[]; narratorOnly?: boolean; public?: boolean };
  provenance: { msgIndex?: number[]; loreEntryId?: string; loreBookId?: string; source: "story" | "lore" | "user" | "sim" | "archivist" };
  salience: number;
  lastSeen: number;
  status: "active" | "dormant" | "resolved" | "dead" | "destroyed" | "diverged";
  locked?: boolean;
  history?: { text: string; msgIndex: number }[];
}

/** Stored, non-derivable fields layered over derived records (by id). */
export interface CodexOverlay {
  id: string;
  kind?: CodexKind;
  name?: string;
  aliases?: string[];
  keys?: string[];
  userKeys?: string[];
  summary?: string;
  body?: Record<string, any>;
  scope?: CodexRecord["scope"];
  provenance?: CodexRecord["provenance"];
  status?: CodexRecord["status"];
  tense?: CodexRecord["tense"];
  locked?: boolean;
  links?: { rel: string; to: string }[];
  /** Records that exist only in the overlay (lore baselines, archivist-created). */
  standalone?: boolean;
  /** The message the archivist's text describes (its chapter's last); older text is left out of the prompt. */
  at?: number;
  divergedNote?: string;
}

export interface CodexStore {
  overlays: Record<string, CodexOverlay>;
  version: number;
}

export function emptyCodexStore(): CodexStore {
  return { overlays: {}, version: 1 };
}

function charName(state: WorldState, id: string | undefined): string {
  if (!id) return "nobody";
  if (id === "gone") return "gone";
  if (id.startsWith("loc:")) return state.places[id]?.name ?? id.slice(4);
  return state.chars[id]?.name ?? id;
}

export function buildCodex(state: WorldState, store: CodexStore): CodexRecord[] {
  const out = new Map<string, CodexRecord>();
  const put = (r: CodexRecord) => out.set(r.id, r);
  const recency = (mi: number) => Math.max(0.1, 1 - (state.msgCount - mi) / Math.max(40, state.msgCount));

  // People
  for (const c of Object.values(state.chars)) {
    const id = `char:${c.id}`;
    const bits: string[] = [];
    if (c.dead) bits.push("dead");
    if (c.tier === "spot" || c.tier === "peri") bits.push(`present${c.activity ? ` (${c.activity})` : ""}`);
    else if (c.place) bits.push(`last seen at ${c.place}`);
    if (c.mood?.name) bits.push(`mood: ${c.mood.name}`);
    const heldItems = carried(state, c.id).map((i) => i.name);
    const links: { rel: string; to: string }[] = [];
    for (const b of Object.values(state.bonds)) {
      if (b.from === c.id) links.push({ rel: "bond", to: `char:${b.to}` });
      if (b.to === c.id) links.push({ rel: "bond-in", to: `char:${b.from}` });
    }
    for (const i of heldItems) links.push({ rel: "holds", to: `item:${slug(i)}` });
    if (c.place) links.push({ rel: "at", to: `loc:${slug(c.place)}` });
    put({
      id, kind: "person", tense: c.dead ? "past" : "now", name: c.name, aliases: c.aliases, keys: [],
      summary: `${c.name}${c.isUser ? " (the player's character)" : ""}${bits.length ? ": " + bits.join("; ") : ""}.`,
      body: {
        mood: c.mood, meters: c.meters, flags: c.flags, injuries: c.injuries, look: c.look, status: c.status,
        tier: c.tier, place: c.place, activity: c.activity, slot: c.slot, held: heldItems,
        journal: c.journal.slice(-3), pressure: c.pressure, isUser: c.isUser,
        traits: c.traits, age: c.age, appearance: c.appearance,
        fixed: c.always || traitLine(c.traits, { age: c.age, appearance: c.appearance }) || undefined,
      },
      links, scope: {}, provenance: { msgIndex: [c.firstSeen, c.lastSeen], source: "story" },
      salience: (c.tier === "spot" ? 0.9 : c.tier === "peri" ? 0.7 : 0.4) * recency(c.lastSeen) + (c.isUser ? 0.1 : 0),
      lastSeen: c.lastSeen, status: c.dead ? "dead" : "active",
    });
  }

  // Places
  for (const p of Object.values(state.places)) {
    const here = state.place.join(" › ");
    put({
      id: p.id, kind: "place", tense: "now", name: p.name, aliases: [], keys: [],
      summary: `${p.name}${p.path.length > 1 ? `, in ${p.path.slice(0, -1).join(" › ")}` : ""}. Visited ${p.visits}×.`,
      body: { path: p.path, visits: p.visits, current: here.endsWith(p.name) },
      links: p.path.length > 1 ? [{ rel: "in", to: `loc:${slug(p.path[p.path.length - 2])}` }] : [],
      scope: { public: true }, provenance: { msgIndex: [p.lastMsg], source: "story" },
      salience: 0.4 * recency(p.lastMsg), lastSeen: p.lastMsg, status: "active",
    });
  }

  // Objects
  for (const it of Object.values(state.items)) {
    const last = it.custody[it.custody.length - 1];
    const prevHolders = uniq(it.custody.map((c) => c.from).filter(Boolean) as string[]).map((h) => charName(state, h));
    put({
      id: it.id, kind: "object", tense: it.gone ? "past" : "now", name: it.name, aliases: [], keys: [],
      summary: it.gone
        ? `${it.name}: gone${last?.how ? ` (${last.how})` : ""}.`
        : `${it.name}: held by ${charName(state, it.holder)}${it.condition ? `, ${it.condition}` : ""}${it.quantity && it.quantity > 1 ? ` ×${it.quantity}` : ""}${last?.at ? ` since ${fmtTime(last.at)}` : ""}${last?.how ? ` (${last.how})` : ""}.`,
      body: { holder: it.holder, condition: it.condition, quantity: it.quantity, custody: it.custody.slice(-5), previous: prevHolders },
      links: it.holder && !it.gone ? [{ rel: "held-by", to: it.holder.startsWith("loc:") ? it.holder : `char:${it.holder}` }] : [],
      scope: {}, provenance: { msgIndex: it.custody.map((c) => c.msgIndex), source: "story" },
      salience: 0.5 * recency(last?.msgIndex ?? 0), lastSeen: last?.msgIndex ?? 0, status: it.gone ? "destroyed" : "active",
    });
  }

  // Threads
  for (const t of Object.values(state.threads)) {
    put({
      id: t.id, kind: "thread", tense: t.status === "resolved" ? "past" : "now", name: t.title, aliases: [], keys: [],
      summary: `Thread (${t.status}${t.blocker ? `: blocked by ${t.blocker}` : ""}): ${t.title}${t.latest ? ` — ${t.latest}` : ""}.`,
      body: { status: t.status, latest: t.latest, blocker: t.blocker, stalls: t.stalls, history: t.history.slice(-3) },
      links: [], scope: {}, provenance: { msgIndex: t.history.map((h) => h.msgIndex), source: "story" },
      salience: (t.status === "resolved" ? 0.2 : 0.6) * recency(t.lastMsg), lastSeen: t.lastMsg, status: t.status === "resolved" ? "resolved" : "active",
    });
  }

  // Documents
  for (const a of Object.values(state.artifacts)) {
    put({
      id: a.id, kind: "document", tense: "timeless", name: a.title, aliases: [], keys: a.keys,
      summary: `${cap(a.kind)} “${a.title}”${a.holder ? `, held by ${charName(state, a.holder)}` : ""}.`,
      body: { kind: a.kind, text: a.text, meta: a.meta, holder: a.holder },
      links: a.holder ? [{ rel: "held-by", to: `char:${a.holder}` }] : [], scope: {},
      provenance: { msgIndex: [a.msgIndex], source: "story" }, salience: 0.5 * recency(a.msgIndex), lastSeen: a.msgIndex, status: "active",
    });
  }

  // Consequences
  for (const c of Object.values(state.cons)) {
    const open = c.status === "open" || c.status === "due";
    put({
      id: c.id, kind: "consequence", tense: open ? "now" : "past", name: c.what, aliases: [], keys: [],
      summary: `${open ? "Open" : cap(c.status)}: ${charName(state, c.who)}${c.whom ? ` → ${charName(state, c.whom)}` : ""}: ${c.what}${c.since ? ` (since ${fmtTime(c.since)})` : ""}${c.due?.at ? `, due ${fmtTime(c.due.at)}` : c.due?.trigger ? `, due when ${c.due.trigger}` : ""}.`,
      body: { ...c },
      links: [{ rel: "who", to: `char:${c.who}` }, ...(c.whom ? [{ rel: "whom", to: `char:${c.whom}` }] : [])],
      scope: {}, provenance: { msgIndex: [c.msgIndex], source: "story" },
      salience: open ? 0.6 : 0.15, lastSeen: c.msgIndex, status: open ? "active" : "resolved",
    });
  }

  // Groups
  for (const f of Object.values(state.factions)) {
    const clocks = Object.values(f.clocks);
    put({
      id: f.id, kind: "group", tense: "now", name: f.name, aliases: [], keys: [],
      summary: `${f.name}: ${clocks.map((c) => `${c.name} ${c.cur}/${c.max}`).join("; ") || "no projects tracked"}.`,
      body: { clocks: f.clocks, reputation: state.rep[slug(f.name)] },
      links: [], scope: {}, provenance: { source: "story" }, salience: 0.45, lastSeen: state.msgCount, status: "active",
    });
  }

  // Facts: one record per fact, with where each person stands on it.
  for (const f of Object.values(state.facts ?? {})) {
    if (f.hidden) continue;
    // Holders are the people with a stance; "unaware" stances carry their evidence (kept from them, said so).
    const stances = Object.values(f.stances);
    put({
      id: `fact:${f.key}`, kind: "fact", tense: "now", name: f.statement, aliases: [], keys: [],
      summary: `Fact${f.truth !== "unknown" ? ` (${f.truth})` : ""}: ${f.statement}.`,
      body: {
        key: f.key, truth: f.truth, kind: factKind(f),
        holders: stances.map((s) => ({ id: s.holder, status: s.status, source: s.how, route: s.route, version: s.version, at: s.at })),
        keepers: f.keepers ?? [], keptFrom: f.keptFrom ?? [],
      },
      links: stances.map((s) => ({ rel: s.status, to: `char:${s.holder}` })),
      scope: { knownBy: stances.filter((s) => s.status === "knows").map((s) => s.holder), hiddenFrom: f.keptFrom?.length ? f.keptFrom : undefined },
      provenance: { msgIndex: f.history.map((h) => h.msgIndex), source: "story" },
      salience: 0.55 * recency(f.lastMsg), lastSeen: f.lastMsg, status: "active",
    });
  }

  // Canon & clues
  state.canon.forEach((c, i) => put({
    id: `canon:${i}`, kind: "texture", tense: "timeless", name: c.text.slice(0, 60), aliases: [], keys: [],
    summary: c.text, body: {}, links: [], scope: { public: true }, provenance: { msgIndex: [c.msgIndex], source: "story" },
    salience: 0.35, lastSeen: c.msgIndex, status: "active",
  }));
  for (const c of state.clues) put({
    id: c.id, kind: "clue", tense: "now", name: c.text.slice(0, 60), aliases: [], keys: [],
    summary: `Clue: ${c.text}${c.pointsTo ? ` → points to ${c.pointsTo}` : ""}${c.reliability ? ` (${c.reliability})` : ""}.`,
    body: { ...c }, links: [], scope: {}, provenance: { msgIndex: [c.msgIndex], source: "story" },
    salience: 0.5 * recency(c.msgIndex), lastSeen: c.msgIndex, status: "active",
  });

  // Bond edges as records (retrievable by the two names)
  for (const b of Object.values(state.bonds)) {
    const axes = Object.entries(b.axes).filter(([, v]) => v).map(([k, v]) => `${k} ${v! > 0 ? "+" : ""}${v}`).join(", ");
    const last = b.history[b.history.length - 1];
    const ladder = state.ladders[`${b.from}>${b.to}`];
    put({
      id: `bond:${b.from}>${b.to}`, kind: "situation", tense: "now", name: `${charName(state, b.from)} → ${charName(state, b.to)}`, aliases: [], keys: [],
      summary: `${charName(state, b.from)} → ${charName(state, b.to)}: ${axes || "neutral"}${b.label ? ` (“${b.label}”)` : ""}${ladder ? `; romance: ${LADDER_NAMES[ladder.tier]}` : ""}${last?.cause ? ` — last: ${last.cause}` : ""}.`,
      body: { ...b, ladder }, links: [{ rel: "from", to: `char:${b.from}` }, { rel: "to", to: `char:${b.to}` }],
      scope: {}, provenance: { msgIndex: b.history.map((h) => h.msgIndex), source: "story" },
      salience: 0.45 * recency(last?.msgIndex ?? 0), lastSeen: last?.msgIndex ?? 0, status: "active",
    });
  }

  // Overlays: keys, locked edits, lore/archivist standalone records.
  // A lore person the story already tracks joins that person's record instead of standing beside it.
  const joins = loreJoins(state, store.overlays);
  for (const ov of Object.values(store.overlays)) {
    if (joins.has(ov.id)) continue;
    const base = out.get(ov.id);
    if (!base && !ov.standalone) continue;
    const rec: CodexRecord = base ?? {
      id: ov.id, kind: ov.kind ?? "texture", tense: ov.tense ?? "now", name: ov.name ?? ov.id, aliases: [], keys: [],
      summary: ov.summary ?? "", body: {}, links: [], scope: {}, provenance: ov.provenance ?? { source: "lore" },
      salience: 0.35, lastSeen: 0, status: "active",
    };
    if (ov.name && (ov.locked || !base)) rec.name = ov.name;
    if (ov.aliases) rec.aliases = uniq([...rec.aliases, ...ov.aliases]);
    const archived = !ov.locked && ov.provenance?.source === "archivist";
    // The archivist's text describes one moment; after a while it reads as now when it isn't
    // (Dawn "asleep in the next guest room" two days later). Older text is left out.
    const fresh = !archived || (ov.at != null && state.msgCount - ov.at <= ARCHIVIST_FRESH);
    if (ov.summary && (ov.locked || !base || rec.provenance.source !== "story")) rec.summary = ov.summary;
    else if (ov.summary && base && fresh) rec.body.archivist = ov.summary;
    if (ov.body) {
      // A story record's live fields (mood, look, place, injuries…) always win over stored notes;
      // the archivist only adds what lasts (role, traits, wants, fears, voice).
      const extra = archived ? lasting(ov.body) : ov.body;
      rec.body = base && !ov.locked ? { ...extra, ...defined(rec.body) } : { ...rec.body, ...extra };
    }
    if (ov.scope) rec.scope = { ...rec.scope, ...ov.scope };
    if (ov.links) rec.links = [...rec.links, ...ov.links];
    if (ov.status) rec.status = ov.status;
    if (ov.tense) rec.tense = ov.tense;
    if (ov.locked) rec.locked = true;
    if (ov.provenance?.loreEntryId) rec.provenance = { ...rec.provenance, loreEntryId: ov.provenance.loreEntryId, loreBookId: ov.provenance.loreBookId };
    rec.keys = uniq([...(ov.userKeys ?? []), ...(ov.keys ?? []), ...rec.keys]);
    if (ov.divergedNote) rec.body.divergedNote = ov.divergedNote;
    out.set(rec.id, rec);
  }
  for (const [oid, target] of joins) {
    const rec = out.get(target);
    if (rec) joinLore(rec, store.overlays[oid], out);
  }

  // Model keys from `keys` ops
  for (const [rid, keys] of Object.entries(state.keys)) {
    const r = out.get(rid) ?? out.get(rid.replace(/^custom:/, "char:")) ?? out.get(joins.get(rid) ?? "");
    if (r) r.keys = uniq([...r.keys, ...keys]);
  }
  return [...out.values()];
}

/** How long (in messages) an archivist's description of someone is still sent as current. */
export const ARCHIVIST_FRESH = 60;

/** What an archivist may say about a record that stays true: never where someone is or what they're doing. */
const LASTING_KEYS = new Set(["role", "traits", "want", "fear", "need", "voice", "appearance", "age", "members", "goal", "hours", "customs", "routes", "parent", "significance", "description"]);
function lasting(body: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!LASTING_KEYS.has(k) && !(k === "routine" && isSchedule(String(v)))) continue;
    out[k] = v;
  }
  return out;
}
/** A routine is a schedule ("06:00–09:00 docks", "mornings at the market"), not one moment ("asleep in the guest room"). */
export const isSchedule = (s: string) => /\d{1,2}[:.]\d{2}|\b(every|daily|each|mornings?|evenings?|nights?|weekdays?|weekends?|usually|always)\b/i.test(s);
const defined = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)));

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
// Titles and kin words: "Dr." is nobody's first name, and a story's "Mom" is not the lore's "Mom".
const TITLE = /^(mr|mrs|ms|miss|dr|doctor|uncle|aunt|auntie|grandpa|grandma|grandfather|grandmother|granny|nana|sir|lady|lord|father|mother|brother|sister|mom|mum|dad|mama|papa|captain|professor|boss|the)\.?$/i;

/**
 * Lore person overlays that describe a person the story already tracks: overlay id → story record id.
 * Joined on the full name or an alias (Valeria Ahearn's alias "Valeria"), or on the first name when
 * only one lore person and one story person carry it. A name another lore person owns never joins.
 */
export function loreJoins(state: WorldState, overlays: Record<string, CodexOverlay>): Map<string, string> {
  const out = new Map<string, string>();
  const lore = Object.values(overlays).filter((o) => o.provenance?.source === "lore" && o.kind === "person" && o.name);
  if (!lore.length) return out;
  const story = Object.values(state.chars).map((c) => ({ id: `char:${c.id}`, names: uniq([c.name, ...c.aliases].map(norm).filter(Boolean)) }));
  const storyIds = new Set(story.map((s) => s.id));
  const loreNames = new Set(lore.map((o) => norm(o.name!)));
  const words = (o: CodexOverlay) => norm(o.name!).split(" ");
  const firstOf = (o: CodexOverlay) => {
    const t = words(o);
    return t.length > 1 && t[0].length >= 3 && !TITLE.test(t[0]) ? t[0] : null;
  };
  // Built from the person's own name ("Buffy", "Mr. Clark") or a nickname ("Val", or a key naming someone else).
  const derived = (o: CodexOverlay, n: string) => n.split(" ").some((t) => words(o).includes(t));
  const namesOf = (o: CodexOverlay) => uniq([norm(o.name!), ...(o.aliases ?? []).map(norm).filter((a) => a && !loreNames.has(a) && !TITLE.test(a))]);
  // Which lore people answer to each name; a claim from one's own name outranks a nickname claim.
  const owners = new Map<string, { strong: Set<string>; weak: Set<string> }>();
  const claim = (n: string, id: string, strong: boolean) => {
    const o = owners.get(n) ?? { strong: new Set<string>(), weak: new Set<string>() };
    (strong ? o.strong : o.weak).add(id);
    owners.set(n, o);
  };
  for (const o of lore) {
    for (const n of namesOf(o)) claim(n, o.id, derived(o, n));
    const f = firstOf(o);
    if (f) claim(f, o.id, true);
  }
  const ownedBy = (n: string, id: string) => {
    const o = owners.get(n);
    const set = o?.strong.size ? o.strong : o?.weak;
    return !!set && set.size === 1 && set.has(id);
  };
  const claims = new Map<string, { lore: string; exact: boolean }[]>();
  for (const o of lore) {
    if (storyIds.has(o.id)) {
      out.set(o.id, o.id); // same id: already the story's record
      continue;
    }
    const full = norm(o.name!);
    const names = namesOf(o).filter((n) => ownedBy(n, o.id));
    const find = (ns: string[]) => story.filter((s) => s.names.some((n) => ns.includes(n)));
    // Surest first: the full name, then aliases built from it ("Buffy Anne Summers", "Walter"), then nicknames.
    const tiers = [names.filter((n) => n === full), names.filter((n) => n !== full && derived(o, n)), names.filter((n) => !derived(o, n))];
    let hit: typeof story = [];
    for (const t of tiers) if (!hit.length && t.length) hit = find(t);
    let exact = true;
    const f = firstOf(o);
    if (!hit.length && f && ownedBy(f, o.id)) {
      // "Valeria" in the story, "Valeria Ahearn" in the lore: a bare first name only.
      hit = find([f]);
      exact = false;
    }
    if (hit.length !== 1) continue;
    const list = claims.get(hit[0].id) ?? [];
    list.push({ lore: o.id, exact });
    claims.set(hit[0].id, list);
  }
  for (const [target, list] of claims) {
    if ([...out.values()].includes(target)) continue; // the story person already has its own lore record
    const exact = list.filter((c) => c.exact);
    const pick = exact.length ? exact : list;
    if (pick.length === 1) out.set(pick[0].lore, target);
  }
  return out;
}

/** Fold a lore baseline into the story's record: its facts fill gaps, the story keeps name, summary and status. */
function joinLore(rec: CodexRecord, ov: CodexOverlay, all: Map<string, CodexRecord>) {
  const others = new Set<string>();
  for (const r of all.values()) if (r.kind === "person" && r.id !== rec.id) others.add(norm(r.name));
  const mine = norm(rec.name);
  rec.aliases = uniq([...rec.aliases, ...[ov.name ?? "", ...(ov.aliases ?? [])].filter((a) => a && norm(a) !== mine && !others.has(norm(a)) && !rec.aliases.some((x) => norm(x) === norm(a)))]);
  for (const [k, v] of Object.entries(ov.body ?? {})) if (rec.body[k] == null) rec.body[k] = v;
  if (ov.summary) rec.body.lore = ov.summary;
  rec.body.loreStatus = ov.status ?? "active";
  if (ov.links) rec.links = [...rec.links, ...ov.links];
  if (ov.scope) rec.scope = { ...ov.scope, ...rec.scope };
  if (ov.provenance?.loreEntryId && !rec.provenance.loreEntryId) rec.provenance = { ...rec.provenance, loreEntryId: ov.provenance.loreEntryId, loreBookId: ov.provenance.loreBookId };
  rec.keys = uniq([...rec.keys, ...(ov.userKeys ?? []), ...(ov.keys ?? [])]);
  if (ov.divergedNote && !rec.body.divergedNote) rec.body.divergedNote = ov.divergedNote;
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Records whose baseline (lore) the story has moved past. */
export function detectDivergence(state: WorldState, records: CodexRecord[]): { id: string; note: string }[] {
  const out: { id: string; note: string }[] = [];
  for (const r of records) {
    // A story person carrying a lore baseline: the story says dead, the lore still has them alive.
    if (r.kind === "person" && r.provenance.source !== "lore" && r.status === "dead" && r.body.loreStatus && r.body.loreStatus !== "dead") {
      const c = state.chars[r.id.slice(5)];
      if (c) out.push({ id: r.id, note: `${c.name} is dead (as of message ${c.lastSeen + 1})` });
    }
    if (r.provenance.source !== "lore") continue;
    const name = r.name.toLowerCase();
    const c = Object.values(state.chars).find((x) => x.name.toLowerCase() === name || name.endsWith(x.name.toLowerCase()));
    if (c?.dead && r.kind === "person" && r.status !== "dead") out.push({ id: r.id, note: `${c.name} is dead (as of message ${c.lastSeen + 1})` });
    const it = Object.values(state.items).find((x) => x.name.toLowerCase() === name || name.endsWith(x.name.toLowerCase()));
    if (it?.gone && r.kind === "object") out.push({ id: r.id, note: `${it.name} is gone${it.custody.at(-1)?.how ? ` (${it.custody.at(-1)!.how})` : ""}` });
    if (r.kind === "forecast" && Array.isArray(r.body.participants)) {
      const dead = (r.body.participants as string[]).find((p) => Object.values(state.chars).some((x) => x.dead && x.name.toLowerCase() === p.toLowerCase()));
      if (dead) out.push({ id: r.id, note: `a participant (${dead}) is dead; this will not happen as foretold` });
    }
    const t = Object.values(state.threads).find((x) => x.status === "resolved" && overlap(normFact(x.title), normFact(r.name)) > 0.6);
    if (t && r.kind === "situation") out.push({ id: r.id, note: `resolved: ${t.latest ?? t.title}` });
  }
  return out;
}
