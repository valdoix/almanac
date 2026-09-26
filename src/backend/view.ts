// The UI view model pushed to the frontend drawer tab and HUD.

import { voiceColor, speakerCss } from "../core/render";
import { absMinutes, fmtSpan, fmtTime, hhmm } from "../core/util";
import { normFact } from "../core/state";
import { debounce, describe, host, warn } from "./host";
import { ledgerFor } from "./ledger";
import { loadChat, loadSettings } from "./store";
import { isEnabled, lastPlan } from "./turn";

export interface UIView {
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
  codex: any[];
  chronicle: { units: any[]; coverage: Record<string, number> };
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
  horror: "nocturne", "dark fantasy": "nocturne", dark_fantasy: "nocturne", tragedy: "nocturne",
  "science fiction": "prism", sci_fi: "prism", scifi: "prism", thriller: "prism", action: "prism",
  fantasy: "botanical", adventure: "botanical", cozy: "candy", comedy: "candy", "slice of life": "candy",
  romance: "almanac", "erotic romance": "almanac", mystery: "solar", noir: "solar", drama: "solar", "political intrigue": "solar", intrigue: "solar",
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

  const facts: { fact: string; truth: string; holders: { id: string; name: string; status: string; source?: string }[] }[] = [];
  for (const k of st.knowledge.filter((x) => !x.supersededBy)) {
    const n = normFact(k.fact);
    let f = facts.find((x) => normFact(x.fact) === n);
    if (!f) facts.push((f = { fact: k.fact, truth: k.truth, holders: [] }));
    if (k.truth !== "unknown") f.truth = k.truth;
    f.holders = f.holders.filter((h) => h.id !== k.holder);
    f.holders.push({ id: k.holder, name: nm(k.holder), status: k.status, source: k.source });
  }
  const units = files.chronicle.units.map((u) => ({ id: u.id, level: u.level, no: u.no, title: u.title, startIdx: u.startIdx, endIdx: u.endIdx, storyStart: u.storyStart, storyEnd: u.storyEnd, text: u.text, locked: !!u.locked, ghost: !!u.ghost, stale: !!u.stale, count: u.msgIds.length }));
  const total = Math.max(1, L.path.length);
  const coverage: Record<string, number> = { raw: 0, chapter: 0, arc: 0, volume: 0 };
  const rank: Record<string, number> = { chapter: 1, arc: 2, volume: 3 };
  for (const m of L.path) {
    let best = "raw";
    for (const u of files.chronicle.units) if (!u.stale && !u.ghost && m.index >= u.startIdx && m.index <= u.endIdx && (best === "raw" || rank[u.level] > rank[best])) best = u.level;
    coverage[best]++;
  }
  for (const k of Object.keys(coverage)) coverage[k] = Math.round((coverage[k] / total) * 100);

  return {
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
    codex: L.records.map((r) => ({ id: r.id, kind: r.kind, name: r.name, summary: r.summary, keys: r.keys, locked: !!r.locked, status: r.status, source: r.provenance.source, narratorOnly: !!r.scope.narratorOnly, salience: Math.round(r.salience * 100) / 100, body: pickBody(r.body), aliases: r.aliases })),
    chronicle: { units, coverage },
    timeline: st.milestones.slice(-120).map((m) => ({ at: m.at ? fmtTime(m.at) : "", day: m.at?.day ?? null, kind: m.kind, text: m.text, msgIndex: m.msgIndex })),
    world: {
      factions: Object.values(st.factions).map((f) => ({ name: f.name, clocks: Object.values(f.clocks) })),
      rumors: st.rumors.slice(-12), rep: Object.values(st.rep), gauges: Object.values(st.gauges),
      deadlines: Object.values(st.deadlines).map((d) => ({ title: d.title, at: fmtTime(d.at), left: now != null ? fmtSpan(absMinutes(d.at) - now) : "", done: !!d.done, passed: now != null && absMinutes(d.at) <= now })),
      cons: Object.values(st.cons).map((c) => ({ ...c, whoName: nm(c.who), whomName: c.whom ? nm(c.whom) : undefined, dueText: c.due?.at ? fmtTime(c.due.at) : c.due?.trigger })),
      threads: Object.values(st.threads), clues: st.clues, plants: st.plants, canon: st.canon.slice(-20),
      calendar: al ? { weekday: al.weekday, date: al.date, season: al.season } : null,
      climate: L.almanacConfig(meta, settings).climate || "temperate maritime (default)",
      items: Object.values(st.items).map((i) => ({ name: i.name, holder: i.holder ? nm(i.holder) : "", gone: !!i.gone, condition: i.condition, custody: i.custody.slice(-4).map((c) => ({ from: c.from ? nm(c.from) : "", to: c.to ? nm(c.to) : "", how: c.how })) })),
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
