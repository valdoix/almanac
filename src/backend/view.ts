// The UI view model pushed to the frontend drawer tab and HUD.

import { VERSION } from "../core/version";
import { voiceColor, speakerCss } from "../core/render";
import { absMinutes, estTokens, fmtSpan, fmtTime, hhmm } from "../core/util";
import { coverageMap, finestUnits, storySoFar } from "../core/chronicle";
import { factKind, factsInPlay, isHere, isKnower, lackOf, lackText, stanceVerb, storyStamp } from "../core/facts";
import type { WorldState } from "../core/types";
import { replyChanges, type ChangeRow } from "../core/changes";
import { debounce, describe, host, warn } from "./host";
import { ledgerFor } from "./ledger";
import { loadChat, loadSettings } from "./store";
import { isEnabled, lastPlan, onPlanErrorChange } from "./turn";
import { clerkRunning, unreadReplies } from "./clerk";

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

export async function buildView(chatId: string, userId?: string): Promise<UIView | null> {
  const files = await loadChat(chatId, userId);
  const settings = await loadSettings(userId);
  const meta = files.meta;
  const L = ledgerFor(chatId, userId);
  if (!L.state) await L.refresh({ reloadNames: true });
  const st = L.state;
  const al = L.almanac(meta, settings);
  const colors = meta.config.colors;
  const plan = lastPlan(chatId);
  const lead = meta.detected.lead || meta.detected.genres?.[0] || meta.config.genres?.[0];
  const nm = (id: string) => (id === "user" ? L.names.user : st.chars[id]?.name ?? id);
  const now = st.time ? absMinutes(st.time) : null;
  const colorOf = (id: string) => (st.chars[id] ? voiceColor(st.chars[id], colors) : "var(--alm-muted)");

  // Facts, newest first: statement, kind, who has it and how, who lacks it and why, the secret's keeping, and how it came out.
  const allFacts = Object.values(st.facts ?? {});
  const people = Object.values(st.chars).filter((c) => isKnower(c));
  const inPlay = new Set(factsInPlay(st, "", 8).map((f) => f.key));
  const facts = allFacts.filter((f) => !f.hidden).sort((a, b) => b.lastMsg - a.lastMsg).map((f) => ({
    key: f.key, statement: f.statement, truth: f.truth, locked: !!f.locked, lastMsg: f.lastMsg, kind: factKind(f), inPlay: inPlay.has(f.key), added: !!f.added,
    stances: Object.values(f.stances).filter((s) => s.status !== "unaware").sort((a, b) => a.msgIndex - b.msgIndex).map((s) => ({
      id: s.holder, name: nm(s.holder), status: s.status, how: s.how, verb: stanceVerb(s, nm), version: s.version, derived: s.derived ?? null, when: storyStamp(s.at),
    })),
    lacks: people.map((c) => ({ c, r: lackOf(st, f, c.id) })).filter((x) => x.r).map(({ c, r }) => ({ id: c.id, name: nm(c.id), reason: r, text: lackText(r!) })),
    keepers: (f.keepers ?? []).map((id) => ({ id, name: nm(id) })),
    keptFrom: (f.keptFrom ?? []).map((id) => ({ id, name: nm(id) })),
    history: f.history.map((h) => ({ id: h.holder, name: nm(h.holder), verb: stanceVerb(h, nm), how: h.how, version: h.version, note: h.note, derived: h.derived ?? null, when: storyStamp(h.at) || `message ${h.msgIndex + 1}` })),
  }));
  const hiddenFacts = allFacts.filter((f) => f.hidden).map((f) => ({ key: f.key, statement: f.statement }));
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
      age: c.age ?? loreAge(L.records, c.name, c.aliases), ageSet: !!c.age, appearance: c.appearance, edit: meta.config.castEdits?.[c.id] ?? null,
      held: Object.values(st.items).filter((i) => i.holder === c.id && !i.gone).map((i) => i.name),
      moodFresh: !!c.mood?.prev && c.mood.prev !== c.mood.name && c.mood.msg != null && c.mood.msg === st.replyDelta?.msgIndex,
      toYou: bondToUser(st, c.id),
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
      factions: Object.values(st.factions).map((f) => ({ name: f.name, clocks: Object.values(f.clocks) })),
      rumors: st.rumors.slice(-12), rep: Object.values(st.rep), gauges: Object.values(st.gauges),
      deadlines: Object.values(st.deadlines).map((d) => ({ title: d.title, at: fmtTime(d.at), left: now != null ? fmtSpan(absMinutes(d.at) - now) : "", leftMin: now != null ? absMinutes(d.at) - now : null, done: !!d.done, passed: now != null && absMinutes(d.at) <= now })),
      cons: Object.values(st.cons).map((c) => ({ ...c, whoName: nm(c.who), whomName: c.whom ? nm(c.whom) : undefined, dueText: c.due?.at ? fmtTime(c.due.at) : c.due?.trigger })),
      threads: Object.values(st.threads), clues: st.clues, plants: st.plants, canon: st.canon.slice(-20),
      calendar: al ? { weekday: al.weekday, date: al.date, season: al.season } : null,
      climate: L.almanacConfig(meta, settings).climate || "temperate maritime (default)",
      items: Object.values(st.items).map((i) => ({ name: i.name, holder: i.holder ? nm(i.holder) : "", where: i.where, gone: !!i.gone, condition: i.condition, custody: i.custody.slice(-4).map((c) => ({ from: c.from ? nm(c.from) : "", to: c.to ? nm(c.to) : "", how: c.how })) })),
    },
    lore: meta.lore,
    feed: meta.feed,
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
  };
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
