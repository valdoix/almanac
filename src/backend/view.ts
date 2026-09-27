// The UI view model pushed to the frontend drawer tab and HUD.

import { VERSION } from "../core/version";
import { voiceColor, speakerCss } from "../core/render";
import { absMinutes, estTokens, fmtSpan, fmtTime, hhmm } from "../core/util";
import { coverageMap } from "../core/chronicle";
import { factKind, factsInPlay, isHere, isKnower, lackOf, lackText, stanceVerb, storyStamp } from "../core/facts";
import { debounce, describe, host, warn } from "./host";
import { ledgerFor } from "./ledger";
import { loadChat, loadSettings } from "./store";
import { isEnabled, lastPlan } from "./turn";
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
  now: any;
  cast: any[];
  bonds: any[];
  knowledge: any[];
  hiddenFacts: { key: string; statement: string }[];
  knowGaps: { id: string; name: string; gaps: { text: string; stale: boolean }[] }[];
  knowers: { id: string; name: string; here: boolean }[];
  clerk: { mode: string; running: boolean; repair: number; unread: number; replies: number };
  codex: any[];
  chronicle: { units: any[]; coverage: Record<string, number>; tokens: Record<string, number>; counts: Record<string, number> };
  timeline: any[];
  world: any;
  lore: any;
  feed: any[];
  rejected: any[];
  telemetry: any;
  note: string;
  recall: string;
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

  // Facts, newest first: statement, kind, who has it and how, who lacks it and why, the secret's keeping, and how it came out.
  const allFacts = Object.values(st.facts ?? {});
  const people = Object.values(st.chars).filter((c) => isKnower(c));
  const inPlay = new Set(factsInPlay(st, "", 8).map((f) => f.key));
  const facts = allFacts.filter((f) => !f.hidden).sort((a, b) => b.lastMsg - a.lastMsg).map((f) => ({
    key: f.key, statement: f.statement, truth: f.truth, locked: !!f.locked, lastMsg: f.lastMsg, kind: factKind(f), inPlay: inPlay.has(f.key),
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
  // Which unit stands in for each message in the prompt; a unit none of them uses has been folded into a coarser one.
  const cover = coverageMap(files.chronicle);
  const inPrompt = new Set([...cover.values()].map((u) => u.id));
  const live = files.chronicle.units.filter((u) => !u.stale && !u.ghost);
  const units = files.chronicle.units.map((u) => {
    const parent = live.find((p) => p.id !== u.id && p.children?.includes(u.id));
    return {
      id: u.id, level: u.level, no: u.no, title: u.title, startIdx: u.startIdx, endIdx: u.endIdx, storyStart: u.storyStart, storyEnd: u.storyEnd, text: u.text,
      locked: !!u.locked, ghost: !!u.ghost, stale: !!u.stale, count: u.msgIds.length, detail: u.detail, children: u.children ?? [],
      parent: parent?.id, tokens: estTokens(u.text), folded: !u.stale && !u.ghost && !inPrompt.has(u.id),
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
    now: {
      day: st.time?.day ?? null, time: st.time ? hhmm(st.time.minute) : null, minute: st.time?.minute ?? null,
      clock: al?.clock ?? (st.time ? fmtTime(st.time) : "not started"),
      weather: al?.weather ?? (st.weather ? { condition: st.weather.condition, glyph: st.weather.glyph ?? "⛅", text: st.weather.condition } : null),
      forecast: al?.forecast ?? "", forecastHours: (al?.forecastHours ?? []).map((h) => ({ t: hhmm(h.abs % 1440), glyph: h.glyph, temp: Math.round(h.tempC), condition: h.condition })),
      sun: al?.sun ?? null, moon: al?.moon ?? null, season: al?.season ?? "", band: al?.band ?? "",
      place: st.place, mode: st.mode, title: st.title ?? "", scene: st.sceneNo,
    },
    cast: Object.values(st.chars).sort((a, b) => (b.tier === "spot" ? 2 : b.tier === "peri" ? 1 : 0) - (a.tier === "spot" ? 2 : a.tier === "peri" ? 1 : 0) || b.lastSeen - a.lastSeen).map((c) => ({
      id: c.id, name: c.name, aliases: c.aliases, slot: c.slot, color: voiceColor(c, colors), tier: c.tier ?? "off", activity: c.activity, place: c.place,
      mood: c.mood ?? null, meters: c.meters, flags: c.flags, injuries: c.injuries, look: c.look, status: c.status, pressure: meta.pressures[c.id] ?? null,
      journal: c.journal.slice(-5), dead: !!c.dead, isUser: c.isUser, lastSeen: c.lastSeen,
      held: Object.values(st.items).filter((i) => i.holder === c.id && !i.gone).map((i) => i.name),
    })),
    bonds: Object.values(st.bonds).map((b) => ({ from: b.from, to: b.to, fromName: nm(b.from), toName: nm(b.to), axes: b.axes, label: b.label, tags: b.tags, history: b.history.slice(-6), ladder: st.ladders[`${b.from}>${b.to}`] ?? null, lastMsg: b.history.at(-1)?.msgIndex ?? 0 })),
    knowledge: facts,
    knowGaps: gaps,
    knowers,
    clerk: { mode: settings.knowledgeClerk, running: clerkRunning(chatId), repair: (st.knowRepair ?? []).length, unread: unreadReplies(L.path, meta).length, replies: L.path.filter((m) => !m.isUser && /<ledger\b/i.test(m.content)).length },
    hiddenFacts,
    codex: L.records.map((r) => ({ id: r.id, kind: r.kind, name: r.name, summary: r.summary, keys: r.keys, locked: !!r.locked, status: r.status, source: r.provenance.source, narratorOnly: !!r.scope.narratorOnly, salience: Math.round(r.salience * 100) / 100, body: pickBody(r.body), aliases: r.aliases })),
    chronicle: { units, coverage, tokens, counts: levelCounts },
    timeline: st.milestones.slice(-120).map((m) => ({ at: m.at ? fmtTime(m.at) : "", day: m.at?.day ?? null, kind: m.kind, text: m.text, msgIndex: m.msgIndex })),
    world: {
      factions: Object.values(st.factions).map((f) => ({ name: f.name, clocks: Object.values(f.clocks) })),
      rumors: st.rumors.slice(-12), rep: Object.values(st.rep), gauges: Object.values(st.gauges),
      deadlines: Object.values(st.deadlines).map((d) => ({ title: d.title, at: fmtTime(d.at), left: now != null ? fmtSpan(absMinutes(d.at) - now) : "", done: !!d.done, passed: now != null && absMinutes(d.at) <= now })),
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
  };
}

function pickBody(b: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of ["role", "hours", "routine", "routes", "customs", "parent", "holder", "members", "participants", "expected", "text", "kind", "archivist", "divergedNote", "want", "fear", "traits", "secrets"]) if (b[k] != null) out[k] = b[k];
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
