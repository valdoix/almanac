// The UI view model pushed to the frontend drawer tab and HUD.

import { VERSION } from "../core/version";
import { voiceColor, speakerCss } from "../core/render";
import { absMinutes, estTokens, fmtSpan, fmtTime, fromAbs, hhmm, partyName } from "../core/util";
import { elsewhereView } from "./elsewhere";
import { coverageMap, finestUnits, storySoFar } from "../core/chronicle";
import { factKind, factsInPlay, isHere, isKnower, lackOf, lackText, stanceVerb, storyStamp } from "../core/facts";
import type { WorldState } from "../core/types";
import type { ConnectionProfileDTO } from "lumiverse-spindle-types";
import { replyChanges, type ChangeRow } from "../core/changes";
import { debounce, describe, host, warn, within } from "./host";
import { ledgerFor } from "./ledger";
import { loadChat, loadSettings, onProblem } from "./store";
import { corrections } from "./ingest";
import { isEnabled, lastPlan, onPlanErrorChange } from "./turn";
import { clerkRunning, unreadReplies } from "./clerk";
import { checksFor } from "./check";
import { chronicleBits } from "../core/chronicle";
import { fixedTraits } from "../core/note";
import { carried } from "../core/state";
import { isOffPage } from "../core/offpage";
import { seedTraitsFor } from "./traitseed";
import { resolveStamina, staminaWords, STAMINA_KINDS, type ResolvedStamina } from "../core/stamina";
import type { CharacterState } from "../core/types";
import { filedKey, filedLine } from "../core/player";
import { exposures } from "../core/secrets";
import { allRecurring, dayLine, ruleOf } from "../core/recurring";
import { fmtDate } from "../core/engines/calendar";
import { bitStatus, bitsSeen } from "../core/callbacks";
import { belongingsOf, roomsOf } from "../core/belongings";
import { activeConditions, conditionWords } from "../core/conditions";
import { liveTerms } from "../core/canon";
import { plainProse } from "../core/util";
import type { Lesson } from "../core/autopsy";
import { journalsOnPath } from "./journals";

/** Someone's stamina for the Cast page: what holds, in words, and what the sources alone would say. */
function staminaView(c: CharacterState, sources: Record<string, { kind: string; by: "card" | "lore" }>) {
  const s: ResolvedStamina = c.stamina ?? { kind: "ordinary", by: "", hunger: 1, thirst: 1, fatigue: 1, sleep: 1, heal: 1 };
  const auto = resolveStamina({ ...c, stamina: undefined }, sources, undefined);
  return { ...s, label: STAMINA_KINDS[s.kind]?.label ?? s.kind, words: staminaWords(s), auto: { kind: auto.kind, label: STAMINA_KINDS[auto.kind]?.label ?? auto.kind, by: auto.by } };
}

export interface UIView {
  version: string;
  chatId: string;
  enabled: boolean;
  autoEnabled: boolean;
  settings: any;
  config: any;
  detected: any;
  names: any;
  theme: string;
  speakerCss: string;
  counts: { messages: number; ledgers: number; unverified: number; chapters: number };
  /** Message indexes of the latest turns whose ledger came from repair or the extractor. */
  unverifiedIdx: number[];
  now: any;
  cast: any[];
  bonds: any[];
  knowledge: any[];
  hiddenFacts: { key: string; statement: string }[];
  knowGaps: { id: string; name: string; gaps: { text: string; stale: boolean }[] }[];
  knowers: { id: string; name: string; here: boolean }[];
  clerk: { mode: string; running: boolean; repair: number; unread: number; replies: number };
  planError: { at: number; where: string; genType: string; message: string; stack: string } | null;
  codex: any[];
  chronicle: { units: any[]; coverage: Record<string, number>; tokens: Record<string, number>; counts: Record<string, number>; mode: "all" | "relevant" | "off" };
  timeline: any[];
  world: any;
  lore: any;
  feed: any[];
  rejected: any[];
  telemetry: any;
  note: string;
  recall: string;
  /** What the last reply changed, newest reply only. */
  changes: { msg: number; rows: ChangeRow[] };
  /** The last reply's private thoughts, and the preset's inner voice setting (off · prose · register). */
  thoughts: { msg: number; innerVoice: string; list: { name: string; color: string; isUser: boolean; cue?: string; text: string; kind: string }[] };
  /** Present people certain of something false (narrator-only). */
  irony: { name: string; color: string; statement: string }[];
  /** What the check of the latest reply found. */
  checks: { msg: number; issues: { kind: string; level: string; text: string; quote?: string }[] };
  /** Scripted scenes read from depth books, and whether the story has played them. */
  playbooks: { id: string; name: string; subject: string; played: boolean; summary: string }[];
  /** Running bits: the ledger's own and the chronicle's. */
  bits: { text: string; who?: string; uses: number; by: string }[];
  /** Recent background failures (summaries, the mirror, hiding turns), newest first. */
  problems: { at: number; where: string; message: string }[];
  /** The player's recorded corrections, newest first. */
  corrections: { key: string; id: string; at: number; index: number; lines: string[] }[];
  /** Turns the Almanac has hidden under summaries. */
  hiddenTurns: number;
  /** The user's Lumiverse connection profiles, for the connection pickers in Settings (null when they couldn't be read). */
  connections: { id: string; name: string; model: string; isDefault: boolean }[] | null;
  /** Elsewhere: the world off the page (subplots, the roster, arrivals, ticks). */
  elsewhere: ReturnType<typeof elsewhereView>;
  /** What the Almanac read from the player's own messages: the latest message's lines, and the rest. */
  filed: { msg: number; latest: FiledRow[]; all: FiledRow[]; undone: { key: string; line: string }[] };
  /** Secrets kept from someone: how near each is to coming out, and who is closest to learning it. */
  secrets: { key: string; statement: string; clock: number; why: string[]; keepers: string[]; keptFrom: string[]; closest: { id: string; name: string; color: string; score: number; why: string[] }[] }[];
  /** Days that come round again (the player's and the asides'), and what falls in the next weeks. */
  recurring: { list: { id: string; name: string; when: string; who?: string; by: string; own: boolean; ok: boolean }[]; upcoming: { day: number; date: string; name: string; kind: string; inDays: number }[]; today: string };
  /** Lessons from swipes the player set aside. */
  lessons: Lesson[];
  /** The canon cutoff, and how many of its terms the story hasn't reached yet. */
  cutoff: { point: string; notYet: string[]; live: number; busy: boolean };
}

export interface FiledRow {
  key: string;
  msg: number;
  line: string;
  op: string;
  ok: boolean;
  reason?: string;
}

const AUTO_THEME: Record<string, string> = {
  horror: "nocturne", tragedy: "nocturne", erotic: "nocturne", "erotic romance": "nocturne",
  "dark fantasy": "scriptorium", dark_fantasy: "scriptorium", fantasy: "arcana", adventure: "arcana",
  "science fiction": "prism", sci_fi: "prism", scifi: "prism", action: "orbital", survival: "botanical",
  noir: "dossier", thriller: "dossier", "political intrigue": "dossier", intrigue: "dossier", drama: "solar",
  comedy: "candy", cozy: "posy", romance: "posy", mystery: "almanac", "slice of life": "almanac", slice_of_life: "almanac",
};

export function themeFor(settingsTheme: string, detectedTheme?: string, lead?: string, configTheme?: string): string {
  if (settingsTheme && settingsTheme !== "preset") return settingsTheme;
  const t = (configTheme || detectedTheme || "auto").toLowerCase();
  if (t && t !== "auto") return t;
  return (lead && AUTO_THEME[lead.toLowerCase()]) || "almanac";
}

type Conn = NonNullable<UIView["connections"]>[number];
const connCache = new Map<string, { at: number; list: Conn[] }>();

/** The user's connection profiles, cached for a minute; a failed read is never cached. */
async function connectionsFor(userId?: string): Promise<Conn[] | null> {
  const key = userId ?? "";
  const hit = connCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.list;
  try {
    if (!host.connections?.list) return null;
    const raw = await within<ConnectionProfileDTO[] | null>(host.connections.list(userId), 3000, null, "connections");
    if (!raw) return hit?.list ?? null;
    const list = raw.map((c) => ({ id: c.id, name: c.name || c.id, model: c.model || "", isDefault: !!c.is_default }))
      .sort((a, b) => a.name.localeCompare(b.name));
    connCache.set(key, { at: Date.now(), list });
    return list;
  } catch (err) {
    warn("connections list failed:", describe(err));
    return hit?.list ?? null;
  }
}

export async function buildView(chatId: string, userId?: string): Promise<UIView | null> {
  const files = await loadChat(chatId, userId);
  const connections = await connectionsFor(userId);
  const settings = await loadSettings(userId);
  const meta = files.meta;
  const L = ledgerFor(chatId, userId);
  if (!L.state) await L.refresh({ reloadNames: true });
  const st = L.state;
  const al = L.almanac(meta, settings);
  const colors = meta.config.colors;
  const plan = lastPlan(chatId);
  const lead = meta.detected.lead || meta.detected.genres?.[0] || meta.config.genres?.[0];
  const nm = (id: string) => partyName(st, id, L.names.user);
  const now = st.time ? absMinutes(st.time) : null;
  const colorOf = (id: string) => (st.chars[id] ? voiceColor(st.chars[id], colors) : "var(--alm-muted)");

  // Facts, newest first: statement, kind, who has it and how, who lacks it and why, the secret's keeping, and how it came out.
  const allFacts = Object.values(st.facts ?? {});
  const people = Object.values(st.chars).filter((c) => isKnower(c));
  const inPlay = new Set(factsInPlay(st, "", 8).map((f) => f.key));
  const facts = allFacts.filter((f) => !f.hidden).sort((a, b) => b.lastMsg - a.lastMsg).map((f) => ({
    key: f.key, statement: f.statement, truth: f.truth, locked: !!f.locked, lastMsg: f.lastMsg, kind: factKind(f), inPlay: inPlay.has(f.key), added: !!f.added,
    offPage: f.offPage && !f.offPage.off ? { words: f.offPage.words, wording: f.offPage.wording ?? "", by: f.offPage.by, live: isOffPage(f, settings.secretsOffPage !== false) } : null,
    stances: Object.values(f.stances).filter((s) => s.status !== "unaware").sort((a, b) => a.msgIndex - b.msgIndex).map((s) => ({
      id: s.holder, name: nm(s.holder), status: s.status, how: s.how, verb: stanceVerb(s, nm), version: s.version, derived: s.derived ?? null, when: storyStamp(s.at),
    })),
    lacks: people.map((c) => ({ c, r: lackOf(st, f, c.id) })).filter((x) => x.r).map(({ c, r }) => ({ id: c.id, name: nm(c.id), reason: r, text: lackText(r!) })),
    keepers: (f.keepers ?? []).map((id) => ({ id, name: nm(id) })),
    keptFrom: (f.keptFrom ?? []).map((id) => ({ id, name: nm(id) })),
    history: f.history.map((h) => ({ id: h.holder, name: nm(h.holder), verb: stanceVerb(h, nm), how: h.how, version: h.version, note: h.note, derived: h.derived ?? null, when: storyStamp(h.at) || `message ${h.msgIndex + 1}` })),
  }));
  const hiddenFacts = allFacts.filter((f) => f.hidden).map((f) => ({ key: f.key, statement: f.statement }));
  const seed = seedTraitsFor(L, meta);
  const lastReply = L.lastAssistant();
  // Per person: what they don't know, in words.
  const gaps = Object.entries(st.gaps ?? {}).filter(([, g]) => g.length).map(([id, g]) => ({ id, name: nm(id), gaps: [...g].sort((a, b) => b.lastMsg - a.lastMsg).map((x) => ({ text: x.text, stale: st.msgCount - x.lastMsg > 40 })) }));
  const knowers = people.map((c) => ({ id: c.id, name: nm(c.id), here: isHere(c) }));
  // Which units the prompt carries. The whole story: the coarsest unit for each stretch
  // (the rest are folded into it). Only when relevant: the ones the last turn used.
  const cover = coverageMap(files.chronicle);
  const relevantOnly = settings.chronicleInject === "relevant";
  const inPrompt = new Set(!settings.chronicle ? [] : relevantOnly ? (meta.chronicleShown ?? []) : [...storySoFar(files.chronicle).map((u) => u.id), ...(meta.chronicleShown ?? [])]);
  // The units this mode draws from; the others stand aside (folded into an arc, or read as chapters instead).
  const pool = new Set((relevantOnly ? finestUnits(files.chronicle) : storySoFar(files.chronicle)).map((u) => u.id));
  const live = files.chronicle.units.filter((u) => !u.stale && !u.ghost);
  const units = files.chronicle.units.map((u) => {
    const parent = live.find((p) => p.id !== u.id && p.children?.includes(u.id));
    return {
      id: u.id, level: u.level, no: u.no, title: u.title, startIdx: u.startIdx, endIdx: u.endIdx, storyStart: u.storyStart, storyEnd: u.storyEnd, text: u.text,
      locked: !!u.locked, ghost: !!u.ghost, stale: !!u.stale, count: u.msgIds.length, detail: u.detail, children: u.children ?? [],
      parent: parent?.id, tokens: estTokens(u.text), folded: !u.stale && !u.ghost && !pool.has(u.id) && !inPrompt.has(u.id), inPrompt: inPrompt.has(u.id),
    };
  });
  const total = Math.max(1, L.path.length);
  const coverage: Record<string, number> = { raw: 0, chapter: 0, arc: 0, volume: 0 };
  // Prompt tokens by layer, and what the summarised turns would cost raw.
  const tokens: Record<string, number> = { raw: 0, chapter: 0, arc: 0, volume: 0, replaced: 0 };
  for (const m of L.path) {
    const u = cover.get(m.index);
    coverage[u ? u.level : "raw"]++;
    if (u) tokens.replaced += estTokens(m.content);
    else tokens.raw += estTokens(m.content);
  }
  for (const u of files.chronicle.units) if (inPrompt.has(u.id)) tokens[u.level] += estTokens(u.text);
  for (const k of Object.keys(coverage)) coverage[k] = Math.round((coverage[k] / total) * 100);
  const levelCounts: Record<string, number> = { chapter: 0, arc: 0, volume: 0 };
  for (const u of files.chronicle.units) if (!u.stale) levelCounts[u.level]++;

  // The player's own messages: what was read from each, newest first.
  const userIdx = new Set(L.path.filter((m) => m.isUser).map((m) => m.index));
  const filedAll: FiledRow[] = L.events
    .filter((e) => e.source === "user" && userIdx.has(e.msgIndex) && e.op.raw)
    .map((e) => ({ key: filedKey(e.msgId, e.swipe, e.op.raw), msg: e.msgIndex, line: filedLine(e.op), op: e.op.op, ok: e.verdict !== "rejected", ...(e.reason ? { reason: e.reason } : {}) }))
    .reverse();
  const lastUser = [...L.path].reverse().find((m) => m.isUser)?.index ?? -1;
  const rooms = roomsOf(st, meta.config.castEdits ?? {});
  const onPath = new Set(L.path.map((m) => m.id));
  const journals = journalsOnPath(meta.journals, (id) => onPath.has(id));
  const bitTexts = [...(st.motifs ?? []).map((m) => m.text), ...chronicleBits(files.chronicle)];
  const seen = bitsSeen(L.path.slice(-400).map((m) => ({ index: m.index, content: plainProse(m.content) })), bitTexts);
  let dayCtx: ReturnType<typeof L.dayCtx> | null = null;
  try {
    dayCtx = L.dayCtx(meta, settings);
  } catch {
    dayCtx = null;
  }
  const recList = allRecurring(st, meta.config.recurring);
  const ahead = st.time ? L.daysAhead(meta, settings, st.time.day, st.time.day + 45) : [];
  const cut = meta.config.canonCutoff;
  const corpus = cut?.notYet?.length ? [L.names.charText ?? "", L.names.personaText ?? "", ...L.path.map((m) => m.content)].join("\n") : "";

  return {
    version: VERSION,
    chatId,
    enabled: isEnabled(meta, settings),
    autoEnabled: !!meta.enabled,
    settings,
    config: meta.config,
    detected: meta.detected,
    names: L.names,
    theme: themeFor(settings.theme, meta.detected.theme, lead, meta.config.theme),
    speakerCss: speakerCss(st, colors),
    counts: { messages: L.path.length, ledgers: st.ledgerCount, unverified: st.unverified.length, chapters: files.chronicle.units.filter((u) => u.level === "chapter").length },
    unverifiedIdx: st.unverified.slice(-50),
    now: {
      day: st.time?.day ?? null, time: st.time ? hhmm(st.time.minute) : null, minute: st.time?.minute ?? null,
      clock: al?.clock ?? (st.time ? fmtTime(st.time) : "not started"),
      weather: al?.weather ?? (st.weather ? { condition: st.weather.condition, glyph: st.weather.glyph ?? "⛅", text: st.weather.condition } : null),
      date: al?.date ?? null, forecast: al?.forecast ?? "", forecastHours: (al?.forecastHours ?? []).map((h) => ({ t: hhmm(h.abs % 1440), glyph: h.glyph, temp: Math.round(h.tempC), condition: h.condition })),
      sun: al?.sun ?? null, moon: al?.moon ?? null, season: al?.season ?? "", band: al?.band ?? "",
      place: st.place, mode: st.mode, title: st.title ?? "", scene: st.sceneNo,
    },
    cast: Object.values(st.chars).sort((a, b) => (b.tier === "spot" ? 2 : b.tier === "peri" ? 1 : 0) - (a.tier === "spot" ? 2 : a.tier === "peri" ? 1 : 0) || b.lastSeen - a.lastSeen).map((c) => ({
      id: c.id, name: c.name, aliases: c.aliases, slot: c.slot, color: voiceColor(c, colors), tier: c.tier ?? "off", activity: c.activity, place: c.place,
      mood: c.mood ?? null, meters: c.meters, flags: c.flags, injuries: c.injuries, look: c.look, status: c.status, pressure: meta.pressures[c.id] ?? null,
      journal: c.journal.slice(-5), dead: !!c.dead, isUser: c.isUser, lastSeen: c.lastSeen,
      age: c.age ?? c.traits?.find((t) => t.kind === "age")?.text ?? loreAge(L.records, c.name, c.aliases), ageSet: !!c.age, appearance: c.appearance, edit: meta.config.castEdits?.[c.id] ?? null,
      fixed: fixedTraits(c, seed[c.id]), traits: (c.traits ?? []).map((t) => ({ kind: t.kind, text: t.text, by: t.by })),
      held: carried(st, c.id).map((i) => i.name),
      stamina: staminaView(c, L.staminaSources),
      moodFresh: !!c.mood?.prev && c.mood.prev !== c.mood.name && c.mood.msg != null && c.mood.msg === st.replyDelta?.msgIndex,
      toYou: bondToUser(st, c.id),
      conditions: activeConditions(c, now).map((x) => conditionWords(x, now)),
      belongings: belongingsOf(st, c.id, nm).slice(0, 12),
      rooms: rooms[c.id] ?? [],
      roomsSet: meta.config.castEdits?.[c.id]?.rooms ?? [],
      diary: (journals[c.id] ?? []).slice(0, 6),
    })),
    bonds: Object.values(st.bonds).map((b) => ({ from: b.from, to: b.to, fromName: nm(b.from), toName: nm(b.to), axes: b.axes, label: b.label, tags: b.tags, history: b.history.slice(-6), ladder: st.ladders[`${b.from}>${b.to}`] ?? null, lastMsg: b.history.at(-1)?.msgIndex ?? 0 })),
    knowledge: facts,
    knowGaps: gaps,
    knowers,
    clerk: { mode: settings.knowledgeClerk, running: clerkRunning(chatId), repair: (st.knowRepair ?? []).length, unread: unreadReplies(L.path, meta).length, replies: L.path.filter((m) => !m.isUser && /<ledger\b/i.test(m.content)).length },
    planError: meta.planError ?? null,
    hiddenFacts,
    codex: L.records.map((r) => ({ id: r.id, kind: r.kind, name: r.name, summary: r.summary, keys: r.keys, locked: !!r.locked, status: r.status, source: r.provenance.source, narratorOnly: !!r.scope.narratorOnly, salience: Math.round(r.salience * 100) / 100, body: pickBody(r.body), aliases: r.aliases })),
    chronicle: { units, coverage, tokens, counts: levelCounts, mode: !settings.chronicle ? "off" : relevantOnly ? "relevant" : "all" },
    timeline: st.milestones.slice(-120).map((m) => ({ at: m.at ? fmtTime(m.at) : "", day: m.at?.day ?? null, kind: m.kind, text: m.text, msgIndex: m.msgIndex })),
    world: {
      factions: Object.values(st.factions).map((f) => ({ id: f.id, name: f.name, aliases: f.aliases ?? [], clocks: Object.values(f.clocks), edit: meta.config.factionEdits?.[f.id] ?? null })),
      rumors: st.rumors.slice(-12), rep: Object.values(st.rep), gauges: Object.values(st.gauges),
      deadlines: Object.values(st.deadlines).map((d) => ({ title: d.title, at: fmtTime(d.at), left: now != null ? fmtSpan(absMinutes(d.at) - now) : "", leftMin: now != null ? absMinutes(d.at) - now : null, done: !!d.done, passed: now != null && absMinutes(d.at) <= now })),
      cons: Object.values(st.cons).map((c) => ({
        ...c, whoName: nm(c.who), whomName: c.whom ? nm(c.whom) : undefined, dueText: c.promise ? c.promise.when : c.due?.at ? fmtTime(c.due.at) : c.due?.trigger,
        ...(c.promise ? { leftText: now != null ? (now < c.promise.from ? `in ${fmtSpan(c.promise.from - now)}` : now <= c.promise.until ? `${fmtSpan(c.promise.until - now)} left` : "") : "", edit: meta.config.promiseEdits?.[c.id] ?? null } : {}),
      })),
      threads: Object.values(st.threads), clues: st.clues, plants: st.plants, canon: st.canon.slice(-20),
      calendar: al ? { weekday: al.weekday, date: al.date, season: al.season } : null,
      climate: L.almanacConfig(meta, settings).climate || "temperate maritime (default)",
      items: Object.values(st.items).map((i) => ({ name: i.name, holder: i.holder ? nm(i.holder) : "", owner: i.owner ? nm(i.owner) : "", where: i.where, gone: !!i.gone, condition: i.condition, custody: i.custody.slice(-4).map((c) => ({ from: c.from ? nm(c.from) : "", to: c.to ? nm(c.to) : "", how: c.how })) })),
    },
    // Per-entry hashes are bookkeeping for the scan; the page needs only counts and modes.
    lore: { ...meta.lore, books: Object.fromEntries(Object.entries(meta.lore.books).map(([id, b]) => [id, { ...b, entryHashes: {} }])) },
    feed: meta.feed.slice(0, 3),
    rejected: L.events.filter((e) => e.verdict !== "accepted").slice(-20).map((e) => ({ msgIndex: e.msgIndex, raw: e.op.raw, verdict: e.verdict, reason: e.reason })),
    telemetry: meta.telemetry ?? null,
    note: plan?.note ?? "",
    recall: plan?.recallText ?? "",
    changes: replyChanges(st, nm, colorOf),
    thoughts: {
      msg: st.thoughts?.msgIndex ?? -1,
      innerVoice: meta.detected.innerVoice ?? "",
      list: (st.thoughts?.list ?? []).map((t) => ({ name: t.name, color: colorOf(t.who), isUser: t.who === "user", cue: t.cue, text: t.text, kind: t.kind })),
    },
    irony: facts.flatMap((f) => f.stances.filter((s) => s.status === "wrong" && st.chars[s.id] && isHere(st.chars[s.id]) && !st.chars[s.id].isUser).map((s) => ({ name: s.name, color: colorOf(s.id), statement: f.statement }))).slice(0, 4),
    checks: { msg: lastReply?.index ?? -1, issues: lastReply ? checksFor(meta, lastReply.id, lastReply.swipe, lastReply.content) : [] },
    playbooks: L.records.filter((r) => r.kind === "playbook").map((r) => ({ id: r.id, name: r.name, subject: String(r.body.subject ?? ""), played: r.status !== "active", summary: r.summary })),
    bits: [
      ...(st.motifs ?? []).map((m) => ({ text: m.text, who: m.who, uses: m.uses, by: m.by, ...bitStatus(st, m.text, m.lastMsg, seen) })),
      ...chronicleBits(files.chronicle).map((t) => ({ text: t, uses: 0, by: "chronicle", ...bitStatus(st, t, -1, seen) })),
    ].slice(0, 30),
    problems: (meta.problems ?? []).filter((p) => Date.now() - p.at < 3 * 86_400_000),
    corrections: corrections(files.side),
    hiddenTurns: files.chronicle.hidden.length,
    connections,
    elsewhere: elsewhereView({ state: st, records: L.records, userName: L.names.user, meta, settings, fmt: (abs) => fmtTime(fromAbs(abs)) }),
    filed: {
      msg: lastUser,
      latest: filedAll.filter((r) => r.msg === lastUser),
      all: filedAll.slice(0, 80),
      undone: (meta.config.ignoredFacts ?? []).map((key) => ({ key, line: meta.config.ignoredLines?.[key] ?? key })).reverse().slice(0, 40),
    },
    secrets: exposures(st, nm).map((x) => ({ ...x, keepers: x.keepers.map(nm), keptFrom: x.keptFrom.map(nm), closest: x.closest.map((c) => ({ ...c, name: nm(c.id), color: colorOf(c.id) })) })),
    recurring: {
      list: recList.map((r) => ({ id: r.id, name: r.name, when: r.when, ...(r.who ? { who: r.who } : {}), by: r.by, own: (meta.config.recurring ?? []).some((x) => x.id === r.id), ok: !!dayCtx && !!ruleOf(r.when, dayCtx.cal) })),
      upcoming: ahead.slice(0, 40).map((o) => ({ day: o.day, date: dayCtx ? safeDate(dayCtx.cal, o.day) : "", name: o.name, kind: o.kind, inDays: o.day - (st.time?.day ?? o.day) })),
      today: st.time ? dayLine(ahead, st.time.day) : "",
    },
    lessons: meta.lessons ?? [],
    cutoff: { point: cut?.point ?? "", notYet: cut?.notYet ?? [], live: cut?.point ? liveTerms(cut, (re) => re.test(corpus)).length : 0, busy: !!meta.cutoffBusy },
  };
}

function safeDate(cal: Parameters<typeof fmtDate>[0], day: number): string {
  try {
    return fmtDate(cal, day);
  } catch {
    return "";
  }
}

/** Where this person stands with the player: trust and affection now, and before the last reply moved them. */
function bondToUser(st: WorldState, id: string): { trust?: number; affection?: number; trustWas?: number; affectionWas?: number } | null {
  const b = st.bonds[`${id}>user`];
  if (!b || id === "user") return null;
  const last = st.replyDelta?.msgIndex;
  const was = (axis: string) => b.history.find((h) => h.axis === axis && h.msgIndex === last)?.from;
  if (b.axes.trust == null && b.axes.affection == null) return null;
  return { trust: b.axes.trust, affection: b.axes.affection, trustWas: was("trust"), affectionWas: was("affection") };
}

function pickBody(b: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of ["role", "hours", "routine", "routes", "customs", "parent", "holder", "members", "participants", "expected", "text", "kind", "archivist", "divergedNote", "want", "voice", "tension", "fear", "traits", "secrets"]) if (b[k] != null) out[k] = b[k];
  return out;
}

export function pushState(chatId: string, userId?: string) {
  debounce(`view:${chatId}`, 250, async () => {
    try {
      const active = await host.chats.getActive(userId).catch(() => null);
      if (active && active.id !== chatId) return;
      const view = await buildView(chatId, userId);
      if (view) host.sendToFrontend({ type: "state", view }, userId);
    } catch (err) {
      warn(`push state: ${describe(err)}`);
    }
  });
}

const NUM_WORDS = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(" ");
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** An age the lore gives in passing ("the seventy-five-year-old patriarch", "aged 24"). */
export function loreAge(records: { kind: string; name: string; aliases: string[]; summary: string }[], name: string, aliases: string[]): string | undefined {
  const names = new Set([name, ...aliases].map((n) => n.toLowerCase()));
  const r = records.find((x) => x.kind === "person" && [x.name, ...x.aliases].some((n) => names.has(n.toLowerCase())));
  if (!r) return undefined;
  const m = /\b(\d{1,3}|[a-z]+(?:-[a-z]+)?)[- ]years?[- ]old\b|\baged? (\d{1,3})\b/i.exec(r.summary);
  if (!m) return undefined;
  if (m[2]) return m[2];
  const w = m[1].toLowerCase();
  if (/^\d+$/.test(w)) return w;
  const [a, b] = w.split("-");
  const n = (TENS[a] ?? (NUM_WORDS.indexOf(a) + 1 || 0)) + (b ? NUM_WORDS.indexOf(b) + 1 : 0);
  return n > 0 ? String(n) : undefined;
}

onPlanErrorChange(pushState);
onProblem(pushState);
