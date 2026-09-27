// HTML for the in-message Ledger drawer and HUD (linked mode). The render
// processor swaps a reply's <ledger> block for this snapshot of the world *as of
// that message*. Class names only; the extension stylesheet paints them. No
// <style> tags, so the markup stays in the light DOM where the stylesheet reaches.

import { VERSION } from "./version";
import type { AlmanacReport } from "./engines/almanac";
import type { CharacterState, MessageDelta, WorldState } from "./types";
import { absMinutes, escapeHtml as e, fmtSpan, fmtTime, hhmm, initials, kpNote } from "./util";
import { LADDER_NAMES } from "./state";
import { factKind, factsInPlay, isKnower, lackOf, lackText, stanceVerb } from "./facts";

/** Voice-slot palette (slot 0 = the player). Tuned for contrast on both paper and night skins. */
export const SLOT_COLORS = ["#9b6a0e", "#c02f52", "#6b45c6", "#0a7d6d", "#1f6fb2", "#b0521c", "#8a3f9e", "#2f7d4f", "#b3871a", "#4f5fbf", "#a8406f", "#51741a", "#1b7e93"];

export function slotColor(slot: number): string {
  return SLOT_COLORS[((slot % SLOT_COLORS.length) + SLOT_COLORS.length) % SLOT_COLORS.length];
}

export function voiceColor(c: CharacterState, colors: Record<string, string>): string {
  return colors[c.id] ?? slotColor(c.isUser ? 0 : c.slot);
}

function mini(c: CharacterState | undefined, colors: Record<string, string>, name?: string): string {
  if (!c) return `<span class="alm-mini">${e(initials(name ?? "?"))}</span>`;
  return `<span class="alm-mini alm-v" data-spk="${e(c.name)}" style="--c:${voiceColor(c, colors)}" title="${e(c.name)}">${e(initials(c.name))}</span>`;
}

const METER_CLASS: Record<string, string> = { health: "m-hp", fatigue: "m-fat", hunger: "m-hun", thirst: "m-drink", pain: "m-hp", intox: "m-drink", arousal: "m-heart", composure: "m-comp", cold: "m-cold" };

function seg(v: number, cls: string): string {
  let s = `<span class="alm-seg ${cls}">`;
  for (let i = 1; i <= 5; i++) s += `<i${i <= v ? ' class="on"' : ""}></i>`;
  return s + "</span>";
}

function vadRow(label: string, v: number | undefined, lo: number, hi: number): string {
  if (v == null) return "";
  const p = (v - lo) / (hi - lo);
  return `<span>${label}</span><div class="alm-slider"><i style="--v:${p.toFixed(2)}"></i></div>`;
}

function card(c: CharacterState, state: WorldState, colors: Record<string, string>, opts: { nsfw: boolean; sealed: boolean }): string {
  const tier = c.tier === "spot" ? "spotlight" : c.tier === "peri" ? "periphery" : c.isUser ? "you" : "away";
  const inner = !(c.isUser && opts.sealed);
  const vad = inner && c.mood ? vadRow("V", c.mood.v, -3, 3) + vadRow("A", c.mood.a, 0, 5) + vadRow("D", c.mood.d, -3, 3) : "";
  const meters = Object.entries(c.meters).filter(([k, v]) => v != null && (k !== "arousal" || opts.nsfw) && (inner || !["composure", "arousal"].includes(k)));
  const held = Object.values(state.items).filter((i) => i.holder === c.id && !i.gone).map((i) => i.name);
  const tags = [
    ...c.flags.slice(-4).map((f) => `<span class="alm-tag">${e(f)}</span>`),
    ...c.injuries.map((i) => `<span class="alm-tag${i.severity >= 3 || !i.treated ? " warn" : ""}">${e(i.where)} · ${["", "scratch", "wound", "serious", "critical"][i.severity]}${i.treated ? "" : " · untreated"}</span>`),
    ...held.slice(0, 3).map((h) => `<span class="alm-tag">holds: ${e(h)}</span>`),
  ];
  // One thing they're wrong about: their own version if they have one.
  const wrong = Object.values(state.facts ?? {}).filter((f) => !f.hidden && (f.stances[c.id]?.status === "wrong" || (f.truth === "false" && ["knows", "believes"].includes(f.stances[c.id]?.status ?? "")))).slice(0, 1);
  for (const f of wrong) tags.push(`<span class="alm-tag warn">believes: ${e(f.stances[c.id].version ?? f.statement)} (false)</span>`);
  return `<article class="alm-cc alm-v" data-spk="${e(c.name)}" style="--c:${voiceColor(c, colors)}">
<div class="alm-cc__band"><span class="alm-cc__tier">${tier}</span></div><span class="alm-say__medal alm-cc__medal">${e(initials(c.name))}</span>
<div class="alm-cc__bd"><div class="alm-cc__nm">${e(c.name)}${c.dead ? " ✝" : ""}</div>${inner && c.mood?.name ? `<div class="alm-cc__em">${e(c.mood.name)}${c.mood.prev ? ` <small>(was ${e(c.mood.prev)})</small>` : ""}</div>` : ""}
${vad ? `<div class="alm-vad">${vad}</div>` : ""}${meters.length ? `<div class="alm-meters">${meters.map(([k, v]) => `<span>${e(k)}</span>${seg(v!, METER_CLASS[k] ?? "m-comp")}`).join("")}</div>` : ""}
${tags.length ? `<div class="alm-tags">${tags.join("")}</div>` : ""}${c.activity ? `<div class="alm-cc__row"><b>doing</b>${e(c.activity)}</div>` : ""}${c.look ? `<div class="alm-cc__row"><b>look</b>${e(c.look)}</div>` : ""}${c.status ? `<div class="alm-cc__row"><b>status</b>${e(c.status)}</div>` : ""}
</div></article>`;
}

function bondRows(state: WorldState, colors: Record<string, string>, msgIndex: number, userName: string): { html: string; changed: number } {
  const changes = Object.values(state.bonds).flatMap((b) => b.history.filter((h) => h.msgIndex === msgIndex).map((h) => ({ b, h })));
  const rows = changes.map(({ b, h }) => {
    const A = state.chars[b.from];
    const B = state.chars[b.to];
    const bip = ["trust", "affection", "respect", "comfort"].includes(h.axis);
    const lo = bip ? -5 : 0;
    const f = (x: number) => ((x - lo) / (5 - lo)).toFixed(2);
    const up = h.delta > 0;
    const good = ["fear", "resentment", "rivalry"].includes(h.axis) ? !up : up;
    return `<div class="alm-bond" style="--ca:${A ? voiceColor(A, colors) : "#888"};--cb:${B ? voiceColor(B, colors) : "#888"}">
<div class="alm-bond__pair">${mini(A, colors)}<span class="alm-bond__link"></span>${mini(B, colors)}<span class="alm-bond__axis">${e(h.axis)}</span><span class="alm-bond__d ${good ? "up" : "dn"}">${up ? "▲" : "▼"} ${h.delta > 0 ? "+" : ""}${h.delta} → ${h.to > 0 && bip ? "+" : ""}${h.to}</span></div>
<div class="alm-move" style="--from:${f(h.from)};--to:${f(h.to)}"><span class="alm-move__trail"></span><span class="alm-move__ghost"></span><span class="alm-move__now"></span></div>
<div class="alm-scale"><span>${lo}</span>${bip ? "<span>0</span>" : ""}<span>+5</span></div>
${h.cause ? `<div class="alm-bond__why">“${e(h.cause)}”${b.from !== "user" && b.to !== "user" ? " · NPC↔NPC" : ""}</div>` : ""}</div>`;
  });
  void userName;
  return { html: rows.join(""), changed: rows.length };
}

/**
 * Who has what, among the people here: the facts the note picked (ranked by what a
 * slip would cost), then recent secrets and beliefs. ✓ has it · ? suspects/believes ·
 * ✗ wrong · — lacks it (only with evidence; the reason on hover) · blank: no record.
 */
function knowledgeTable(state: WorldState, colors: Record<string, string>, userName: string): string {
  const present = Object.values(state.chars).filter((c) => (c.tier === "spot" || c.tier === "peri") && !c.isUser && !c.dead && isKnower(c)).slice(0, 5);
  if (!present.length) return "";
  const picked = factsInPlay(state, "", 8);
  // Then what this reply filed (even one person's note), then recent secrets and beliefs.
  const latest = state.msgCount - 1;
  const more = Object.values(state.facts ?? {})
    .filter((f) => !f.hidden && !picked.includes(f) && present.some((c) => f.stances[c.id]) && (f.lastMsg === latest || (state.msgCount - f.lastMsg <= 30 && factKind(f) !== "noted")))
    .sort((a, b) => (b.lastMsg === latest ? 1 : 0) - (a.lastMsg === latest ? 1 : 0) || b.lastMsg - a.lastMsg);
  const facts = [...picked, ...more].slice(0, 8);
  if (!facts.length) return "";
  let irony = "";
  // Rows of divs on a shared grid rather than a <table>: the host's message
  // styles restyle tables (collapsed borders, header tint, padding) and win.
  const head = `<div class="alm-km__r alm-km__h" role="row"><span role="columnheader">Fact</span>${present.map((c) => `<span role="columnheader">${mini(c, colors)}</span>`).join("")}</div>`;
  const nm = (id: string) => (id === "user" ? userName : state.chars[id]?.name ?? id);
  const body = facts.map((f) => {
    const cells = present.map((c) => {
      const s = f.stances[c.id];
      const lack = lackOf(state, f, c.id);
      let pill = `<span class="alm-kp none" title="No record either way">·</span>`;
      if (lack) pill = `<span class="alm-kp un">— lacks it</span>${kpNote(lackText(lack))}`;
      else if (s) {
        if (s.status === "wrong" || (s.status !== "knows" && f.truth === "false")) {
          pill = `<span class="alm-kp wrong">✗ ${e(s.status === "wrong" ? "wrong" : s.status)}</span>`;
          if (s.version) pill += kpNote(`thinks “${s.version}”`);
          if (!irony) irony = `${e(c.name)} is certain of something false.`;
        } else if (s.status === "knows") pill = `<span class="alm-kp knows">✓ ${e(stanceVerb(s, nm).replace(/ it$/, ""))}</span>`;
        else pill = `<span class="alm-kp sus">? ${e(s.status)}</span>`;
        if (s.how && !s.derived && s.status !== "wrong") pill += kpNote(s.how);
      }
      return `<div class="alm-km__c" role="cell" data-who="${e(c.name)}">${pill}</div>`;
    });
    return `<div class="alm-km__r" role="row"><div class="alm-km__f" role="rowheader">${e(f.statement.replace(/\{\{user\}\}/g, userName))}</div>${cells.join("")}</div>`;
  });
  return `<div class="alm-km-wrap"><div class="alm-km alm-km--${present.length}" role="table" aria-label="Who knows what">${head}${body.join("")}</div></div>${irony ? `<div class="alm-irony"><span class="i">🎭</span><span><b>Dramatic irony:</b> ${irony}</span></div>` : ""}`;
}

function sub(icon: string, title: string, count: string, inner: string, open = false): string {
  if (!inner) return "";
  return `<details class="alm-sub"${open ? " open" : ""}><summary><span class="alm-sub__ico">${icon}</span>${e(title)}<span class="alm-sub__ct">${e(count)}</span></summary><div class="alm-sub__in">${inner}</div></details>`;
}

const ITEM_ICONS: [RegExp, string][] = [
  [/locket|necklace|amulet|pendant|ring/i, "📿"], [/letter|note|map|paper|scroll|book|ledger|journal|diary/i, "📜"], [/key/i, "🗝️"],
  [/knife|dagger|sword|blade|axe/i, "🗡️"], [/gun|pistol|rifle|revolver/i, "🔫"], [/coin|money|purse|gold|cash|wallet/i, "🪙"],
  [/pass|ticket|card|badge/i, "🎫"], [/phone|radio/i, "📱"], [/bottle|flask|potion|wine/i, "🍾"], [/lamp|lantern|candle|torch/i, "🏮"],
];

export interface DrawerInput {
  state: WorldState;
  delta: MessageDelta | null;
  almanac: AlmanacReport | null;
  colors: Record<string, string>;
  userName: string;
  sealed: boolean;
  nsfw: boolean;
  view: "drawer" | "hud" | "inline" | "off";
  trackers?: string[];
  latest: boolean;
  unverified?: boolean;
}

export function renderDrawer(inp: DrawerInput): string {
  const { state, colors, almanac: al } = inp;
  if (inp.view === "off") return "";
  const present = Object.values(state.chars).filter((c) => (c.tier === "spot" || c.tier === "peri") && !c.dead && !c.isUser);
  const clock = state.time ? hhmm(state.time.minute) : "—";
  const wx = al?.weather ?? (state.weather ? { condition: state.weather.condition, glyph: state.weather.glyph ?? "⛅" } : null);
  const place = state.place[state.place.length - 1] ?? "";
  if (inp.view === "hud") return renderHud(inp);

  const show = (k: string) => !inp.trackers || inp.trackers.includes(k);
  const delta = inp.delta;
  const count = delta?.count ?? 0;
  const summary = `<summary><span class="alm-pill">🕰 ${e(clock)}${delta?.elapsed ? ` <small>+${e(fmtSpan(delta.elapsed))}</small>` : ""}</span>${wx ? `<span class="alm-pill">${e(wx.glyph ?? "")} ${e(wx.condition)}</span>` : ""}${place ? `<span class="alm-pill">📍 ${e(place)}</span>` : ""}${present.length ? `<span class="alm-pill"><span class="alm-stack">${present.slice(0, 5).map((c) => mini(c, colors)).join("")}</span>${present.length} present</span>` : ""}${inp.unverified ? `<span class="alm-pill alm-pill--warn" title="This turn's ledger was repaired or extracted">unverified</span>` : ""}<span class="alm-caret">Δ ${count}</span></summary>`;

  const parts: string[] = [];
  if (show("scene")) {
    const lines: string[] = [];
    if (state.time) lines.push(`<span class="alm-tag">🗓 ${e(al ? al.clock : fmtTime(state.time))}</span>`);
    if (al) lines.push(`<span class="alm-tag">${e(al.weather.glyph)} ${e(al.weather.text)}</span>`, `<span class="alm-tag">☀ ${e(al.sun.text)}</span>`, `<span class="alm-tag">${e(al.moon.glyph)} ${e(al.moon.name)}</span>`);
    if (state.place.length) lines.push(`<span class="alm-tag">📍 ${e(state.place.join(" › "))}</span>`);
    if (state.mode && state.mode !== "social") lines.push(`<span class="alm-tag">scene: ${e(state.mode)}</span>`);
    const forecast = al?.forecast ? `<div class="alm-cc__row"><b>next</b>${e(al.forecast)}</div>` : "";
    const changes = delta?.lines.length ? `<ul class="alm-deltas">${delta.lines.slice(0, 14).map((l) => `<li>${e(l)}</li>`).join("")}</ul>` : "";
    const rej = delta?.rejected.length ? `<div class="alm-rejected">${delta.rejected.slice(0, 4).map((r) => `<div>✗ <code>${e(r.raw.slice(0, 80))}</code> — ${e(r.reason)}</div>`).join("")}</div>` : "";
    parts.push(sub("🕰", "Scene", count ? `${count} changed` : "no changes", `<div class="alm-tags">${lines.join("")}</div>${forecast}${changes}${rej}`, !!rej));
  }
  if (show("cast")) {
    const cast = [...present];
    const u = state.chars.user;
    if (u && (u.injuries.length || u.flags.length || u.look || Object.keys(u.meters).length)) cast.push(u);
    if (cast.length) parts.push(sub("🎭", "Cast", `${present.length} present`, `<div class="alm-cast">${cast.map((c) => card(c, state, colors, inp)).join("")}</div>`, inp.latest));
  }
  if (show("bonds")) {
    const b = bondRows(state, colors, delta?.msgIndex ?? -1, inp.userName);
    const ladders = Object.values(state.ladders).filter((l) => l.msgIndex === delta?.msgIndex).map((l) => {
      const A = state.chars[l.from];
      const B = state.chars[l.to];
      return `<div class="alm-ladder">${mini(A, colors)}<span class="alm-bond__link"></span>${mini(B, colors)}<span class="alm-ladder__steps">${LADDER_NAMES.map((n, i) => `<i class="${i <= l.tier ? "on" : ""}" title="${n}"></i>`).join("")}</span><b>${e(LADDER_NAMES[l.tier])}</b></div>`;
    });
    if (b.changed || ladders.length) parts.push(sub("🕸", "Bonds", `${b.changed + ladders.length} changed`, b.html + ladders.join(""), inp.latest));
  }
  if (show("inventory")) {
    const items = Object.values(state.items).filter((i) => !i.gone && (i.holder === "user" || present.some((c) => c.id === i.holder) || i.custody.at(-1)?.msgIndex === delta?.msgIndex));
    if (items.length) {
      parts.push(sub("🎒", "Inventory", `${items.length} items`, `<div class="alm-inv">${items.slice(0, 12).map((i) => {
        const holder = i.holder ? state.chars[i.holder] : undefined;
        const last = i.custody[i.custody.length - 1];
        const icon = ITEM_ICONS.find(([re]) => re.test(i.name))?.[1] ?? "✦";
        return `<div class="alm-it"><span class="alm-it__ic">${icon}</span><div><b>${e(i.name)}${i.quantity && i.quantity > 1 ? ` ×${i.quantity}` : ""}</b><span class="alm-it__h">${mini(holder, colors, i.holder)}${e(holder?.name ?? (i.holder?.startsWith("loc:") ? state.places[i.holder]?.name ?? i.holder.slice(4) : i.holder) ?? "?")}${i.where ? ` · ${e(i.where)}` : ""}${last?.at ? ` · since ${e(fmtTime(last.at))}` : ""}</span>${last?.how ? e(last.how) : ""}${i.condition ? ` · ${e(i.condition)}` : ""}</div></div>`;
      }).join("")}</div>`));
    }
  }
  if (show("threads")) {
    const clocks: string[] = [];
    for (const f of Object.values(state.factions)) for (const c of Object.values(f.clocks)) clocks.push(ring(c.cur, c.max, "var(--alm-danger)", `${f.name}: ${c.name}`, c.cur >= c.max ? "complete" : `${c.max - c.cur} to go`));
    for (const t of Object.values(state.threads).filter((t) => t.status !== "resolved").slice(-6)) {
      const n = Math.min(4, t.history.length);
      clocks.push(ring(n, 4, t.status === "stalled" ? "var(--alm-warn)" : "var(--alm-good)", t.title, t.status === "stalled" ? `stalled: ${t.blocker ?? "?"}` : t.latest ?? ""));
    }
    const now = state.time ? absMinutes(state.time) : null;
    for (const d of Object.values(state.deadlines).filter((d) => !d.done)) {
      const left = now != null ? absMinutes(d.at) - now : 0;
      clocks.push(ring(Math.max(0, 8 - Math.ceil(left / 180)), 8, "var(--alm-accent-2)", d.title, left > 0 ? `${fmtSpan(left)} left` : "passed"));
    }
    for (const g of Object.values(state.gauges)) clocks.push(ring(g.cur, g.max, /dread|corrupt|pressure/i.test(g.name) ? "var(--alm-danger)" : "var(--alm-accent)", g.name, g.cause ?? ""));
    if (clocks.length) parts.push(sub("⏳", "Threads & clocks", `${clocks.length} open`, `<div class="alm-clocks">${clocks.join("")}</div>`));
  }
  if (show("knowledge")) {
    const k = knowledgeTable(state, colors, inp.userName);
    if (k) parts.push(sub("👁", "Knowledge", "topics in play", k));
  }
  if (show("consequences")) {
    const open = Object.values(state.cons).filter((c) => c.status === "open" || c.status === "due");
    if (open.length) {
      const now = state.time ? absMinutes(state.time) : null;
      parts.push(sub("⚖", "Consequences", `${open.length} open`, `<ul class="alm-list">${open.slice(-8).map((c) => {
        const due = c.due?.at && now != null ? absMinutes(c.due.at) - now : null;
        return `<li${due != null && due <= 0 ? ' class="due"' : ""}>${mini(state.chars[c.who], colors, c.who)} ${e(state.chars[c.who]?.name ?? c.who)}${c.whom ? ` → ${e(state.chars[c.whom]?.name ?? c.whom)}` : ""}: ${e(c.what)}${due != null ? ` <small>${due <= 0 ? "due now" : `due in ${e(fmtSpan(due))}`}</small>` : ""}</li>`;
      }).join("")}</ul>`));
    }
  }
  if (show("world") && al?.forecastHours?.length) {
    const hours = al.forecastHours.filter((_, i) => i % 3 === 0).slice(0, 5);
    const rumors = state.rumors.slice(-3);
    parts.push(sub("🌦", "World", "forecast", `<div class="alm-fc">${hours.map((h) => `<div><small>${hhmm(h.abs % 1440)}</small><span>${h.glyph}</span><b>${Math.round(h.tempC)}°</b></div>`).join("")}</div>${rumors.length ? `<ul class="alm-list">${rumors.map((r) => `<li>🗣 ${e(r.text)}</li>`).join("")}</ul>` : ""}`));
  }
  const desk = inp.latest ? "[[alm-desk]]" : "";
  return `<details data-alm-v="${VERSION}" class="alm-drawer alm-ledger"${inp.view === "inline" ? " open" : ""}>${summary}<div class="alm-drawer__body">${parts.join("")}${desk}</div></details>`;
}

function ring(n: number, of: number, color: string, title: string, subText: string): string {
  return `<div class="alm-clock"><div class="alm-clock__face"><div class="alm-ring" style="--n:${n};--of:${Math.max(1, of)};--rc:${color}"></div><b>${n}/${of}</b></div><div><strong>${e(title)}</strong><span>${e(subText)}</span></div></div>`;
}

export function renderHud(inp: DrawerInput): string {
  const { state, almanac: al, colors } = inp;
  const present = Object.values(state.chars).filter((c) => (c.tier === "spot" || c.tier === "peri") && !c.dead && !c.isUser);
  const h = state.time ? state.time.minute / 60 : 12;
  const rise = al?.sun.rise && al.sun.rise !== "—" ? toH(al.sun.rise) : 6.5;
  const set = al?.sun.set && al.sun.set !== "—" ? toH(al.sun.set) : 18.5;
  const moodColor = (c: CharacterState) => {
    const v = c.mood?.v ?? 0;
    const a = c.mood?.a ?? 2;
    return v <= -2 ? "#ff6b8a" : v < 0 ? "#ffb86b" : a >= 4 ? "#ffd84d" : v > 1 ? "#7cc493" : "#b8c4d8";
  };
  return `<div class="alm-hud"><div class="alm-dial" style="--h:${h.toFixed(2)};--rise:${rise.toFixed(2)};--set:${set.toFixed(2)}"><div class="alm-dial__mk"></div></div><span>${state.time ? hhmm(state.time.minute) : "—"}</span>${al ? `<span>${e(al.weather.glyph)} ${e(al.weather.condition)}</span>` : ""}${state.place.length ? `<span>📍 ${e(state.place[state.place.length - 1])}</span>` : ""}${present.map((c) => `<span class="alm-hud__who">${mini(c, colors)}<span class="alm-hud__dot" style="--md:${moodColor(c)}" title="${e(c.mood?.name ?? "")}"></span></span>`).join("")}</div>`;
}

function toH(s: string): number {
  const [a, b] = s.split(":").map((x) => parseInt(x, 10));
  return a + (b || 0) / 60;
}

/** Linked-mode enrichment for the scene header: exact sun times and moon phase, read by the plate regex. */
export function plateSuffix(al: AlmanacReport): string {
  return ` ⟪${al.sun.rise}|${al.sun.set}|${al.moon.glyph} ${al.moon.name}⟫`;
}

/** Per-speaker colour rules (the stylesheet half of "regex for structure, stylesheet for paint"). */
export function speakerCss(state: WorldState, colors: Record<string, string>): string {
  const rules: string[] = [];
  const follow: string[] = [];
  for (const c of Object.values(state.chars)) {
    const col = voiceColor(c, colors);
    const names = [...new Set([c.name, ...c.aliases, ...(c.name.includes(" ") ? [c.name.split(" ")[0]] : [])])];
    const sel = names.map((n) => `.alm-v[data-spk="${n.replace(/["\\]/g, "")}" i]`).join(",");
    rules.push(`${sel}{--c:${col}!important}`);
    const safe = c.name.replace(/["\\]/g, "");
    follow.push(`.alm-say[data-spk="${safe}" i]+.alm-say[data-spk="${safe}" i]`);
  }
  if (follow.length) {
    const f = (suffix: string) => follow.map((s) => s + suffix).join(",");
    rules.push(`${f("")}{margin-top:-10px!important}`);
    rules.push(`${f(" .alm-say__medal")}{visibility:hidden!important;height:0!important}`);
    rules.push(`${f(" .alm-say__who")}{display:none!important}`);
    rules.push(`${f(" .alm-say__bubble")}{border-radius:var(--alm-radius)!important;padding-top:14px!important}`);
    rules.push(`${f(" .alm-say__bubble::before")},${f(" .alm-say__bubble::after")}{content:none!important;display:none!important}`);
  }
  return rules.join("\n");
}
