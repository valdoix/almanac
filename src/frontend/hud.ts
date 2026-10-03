// The floating "Now" widget, drawn as an orrery. Collapsed, it is a pill: a
// small sky dial, the time, weather, place, who is present (a pulsing mood dot
// when a mood just changed), one rotating chip for whatever is most urgent, and
// a badge counting what the last reply changed. Open, it is a window: the sky
// (sun and moon on their arcs, rain or snow, a skyline), the next hours'
// forecast, and a rail of tabs: Changed · Stakes · Cast · Threads · Unspoken ·
// Backstage. Colours, fonts and shapes come from the active skin's tokens;
// the sky is always a sky. Mockup: design/mockups/now-widget.html.

import { escapeHtml as e, initials } from "../core/util";
import { BAND_SKY } from "./orrery";

/** The widget's own state, kept by the frontend between renders. */
export interface HudUi {
  tab: string;
  /** Narrator view: hidden pressures and dramatic irony. */
  narr: boolean;
  /** Changes the player has not looked at yet. */
  unseen: number;
  /** Envelopes whose seal is broken (`msg:index`). */
  opened: Set<string>;
  /** The window's size, as the player last dragged it. */
  size?: { w: number; h: number };
  /** The player has looked at the Unspoken tab since these thoughts arrived. */
  thoughtsSeen?: boolean;
  /** The edge the widget is docked to: closed, it is a slim tab there. */
  dock?: "left" | "right" | null;
  /** The Soundtrack's song (Story › Soundtrack), when one is playing. */
  music?: HudMusic | null;
}

export interface HudMusic {
  /** Empty when the player is connected but nothing is loaded. */
  title: string;
  artist: string;
  thumb?: string;
  videoId?: string;
  paused: boolean;
  mood: string;
  /** The Almanac is choosing (Start pressed). */
  running: boolean;
  /** following · holding · yielded (the player's own song). */
  mode: string;
  /** Who started the song: ours, user, autoplay. */
  origin: string;
  /** The player chose the mood (not Auto). */
  chosen: boolean;
  /** The mood picker is open: Auto first, then every mood as [value, label]. */
  menu: [string, string][] | null;
  /** The mood the player chose, or "" for Auto. */
  pick: string;
}

export const HUD_SIZE = { w: 360, h: 540, minW: 250, minH: 320, maxW: 720, maxH: 960 };

export const HUD_TABS = ["changed", "stakes", "cast", "threads", "unspoken", "backstage"] as const;

const PIN = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg>`;
const ICON: Record<string, string> = {
  changed: `<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>`,
  stakes: `<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9"/>`,
  cast: `<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.4"/><path d="M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5M15 15c2.8-.3 5 1.2 5.6 4.5"/>`,
  threads: `<path d="M4 7c4-4 7 4 11 0s5 2 5 2M4 13c4-4 7 4 11 0s5 2 5 2"/><circle cx="6" cy="19" r="1.5"/><path d="M7.5 19H20"/>`,
  unspoken: `<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6.5L20.5 7"/><circle cx="12" cy="13.5" r="2.2" fill="currentColor"/>`,
  backstage: `<path d="M4 5h16v10H4z"/><path d="M8 19h8M12 15v4"/><path d="M8 9h5M8 12h8"/>`,
  book: `<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>`,
  dock: `<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16"/><path d="M15.5 9.5 13 12l2.5 2.5"/>`,
  undock: `<rect x="3" y="8" width="13" height="13" rx="2.5"/><path d="M13 3h8v8M21 3l-9 9"/>`,
  eye: `<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/>`,
};
const TAB_LABEL: Record<string, string> = { changed: "What changed", stakes: "Stakes", cast: "Who is here", threads: "Threads", unspoken: "Unspoken", backstage: "Backstage" };
const svg = (k: string, size = 19) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

const NIGHT = /night|hours|pre-dawn|evening|dusk/;
const skyOf = (v: any) => BAND_SKY[v?.now?.band] ?? BAND_SKY.evening;
const presentOf = (v: any) => (v.cast ?? []).filter((c: any) => (c.tier === "spot" || c.tier === "peri") && !c.isUser && !c.dead);
const hm = (s?: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? "");
  return m ? +m[1] * 60 + +m[2] : null;
};
const span = (min: number) => (min < 60 ? `${min}m` : min < 1440 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ""}` : `${Math.floor(min / 1440)}d ${Math.floor((min % 1440) / 60)}h`);

/** A mood's dot colour from its valence (or a neutral one). */
function moodDot(c: any): string {
  const v = c.mood?.v;
  if (typeof v !== "number") return c.mood ? "var(--alm-accent-2)" : "transparent";
  return v > 0.2 ? "var(--alm-gold)" : v < -0.2 ? "var(--alm-danger)" : "var(--alm-accent-2)";
}
const med = (c: any, big = false) =>
  `<span class="alm-om${big ? " alm-om--big" : ""}" style="--c:${e(c.color)}" title="${e(c.name)}${c.mood?.name ? ` · ${e(c.mood.name)}` : ""}">${e(initials(c.name))}${c.mood ? `<i class="alm-om__md${c.moodFresh ? " is-fresh" : ""}" style="--m:${moodDot(c)}"></i>` : ""}</span>`;

/** A −5…+5 (or 0…5) track: the old value as a dashed ghost, the new one as a knob. */
function track(v: number | undefined, was: number | undefined, color: string, lo = -5): string {
  if (v == null) return `<span class="alm-otrk is-empty"></span>`;
  const pct = (x: number) => ((x - lo) / (5 - lo)) * 100;
  const moved = was != null && was !== v;
  return `<span class="alm-otrk" style="--c:${e(color)}">${lo < 0 ? `<i class="alm-otrk__mid"></i>` : ""}${moved ? `<i class="alm-otrk__trail" style="left:${pct(Math.min(was!, v))}%;width:${Math.abs(pct(v) - pct(was!))}%"></i><i class="alm-otrk__ghost" style="left:${pct(was!)}%"></i>` : ""}<i class="alm-otrk__knob${moved ? " is-moved" : ""}" style="left:${pct(v)}%"></i></span>`;
}

/** A segmented clock ring. */
function ring(cur: number, max: number, color: string, size = 52): string {
  const n = Math.max(1, Math.min(12, max));
  const k = Math.round((Math.max(0, Math.min(cur, max)) / Math.max(1, max)) * n);
  const r = (size - 10) / 2;
  const c = size / 2;
  const C = 2 * Math.PI * r;
  const step = C / n;
  const seg = Math.max(1, step - (n > 8 ? 2.5 : 4));
  let out = `<svg class="alm-oring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${cur} of ${max}">`;
  for (let i = 0; i < n; i++) out += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${i < k ? color : "var(--alm-line)"}" stroke-width="6" stroke-dasharray="${seg.toFixed(2)} ${(C - seg).toFixed(2)}" stroke-dashoffset="${(-i * step).toFixed(2)}" transform="rotate(-90 ${c} ${c})"/>`;
  return `${out}<text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" fill="${color}">${cur}/${max}</text></svg>`;
}
const clockColor = (name: string) =>
  /suspicio|alert|threat|heat|doom|danger|wrath|hunt|alarm|war|fear|dread|pursuit|exposure/i.test(name) ? "var(--alm-danger)"
  : /trust|favou?r|hope|progress|support|loyal|alliance|ready|repair|heal/i.test(name) ? "var(--alm-good)" : "var(--alm-accent-2)";

/** The urgent things, most pressing first, for the pill's rotating chip. */
function urgent(v: any): string[] {
  const out: { w: number; t: string }[] = [];
  for (const d of v.world?.deadlines ?? []) {
    if (d.done || d.passed || d.leftMin == null || d.leftMin > 72 * 60) continue;
    out.push({ w: d.leftMin, t: `⏳ ${d.title} · ${span(d.leftMin)}` });
  }
  for (const c of v.world?.cons ?? []) if (c.status === "due") out.push({ w: 90, t: `⚖ ${c.whoName}${c.whomName ? ` → ${c.whomName}` : ""} due` });
  const n = v.now ?? {};
  const set = hm(n.sun?.set);
  const rise = hm(n.sun?.rise);
  if (n.minute != null) {
    const toSet = set != null ? set - n.minute : -1;
    const toRise = rise != null ? (rise - n.minute + 1440) % 1440 : -1;
    if (toSet > 0 && toSet <= 60) out.push({ w: 200 + toSet, t: `☀ sets in ${toSet}m` });
    else if (toRise > 0 && toRise <= 60) out.push({ w: 200 + toRise, t: `☀ rises in ${toRise}m` });
  }
  return out.sort((a, b) => a.w - b.w).slice(0, 3).map((x) => x.t);
}

const NOTE = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>`;
const HOLD = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/><path d="M11 10h1.5v5"/></svg>`;
const musicTip = (m: HudMusic) => `${m.paused ? "Paused" : "Playing"}: ${m.title} · ${m.artist}${m.mood ? ` (${m.mood})` : ""}`;

/** The Soundtrack in the open window: what plays, why, and the controls. */
function musicStrip(m: HudMusic | null | undefined): string {
  if (!m) return "";
  const b = (act: string, label: string, glyph: string, cls = "") => `<button class="alm-hudc__mub${cls}" data-hud="music" data-m="${act}" aria-label="${e(label)}" title="${e(label)}">${glyph}</button>`;
  const run = m.running ? b("stop", "Stop: the Almanac stops choosing", "■", " is-on") : b("start", "Start: the Almanac chooses music for the scene", "Start", " is-txt");
  if (!m.title) {
    return `<div class="alm-hudc__mu is-idle"><button class="alm-hudc__muart" data-hud="music" data-m="open" aria-label="Open the Soundtrack" title="Open the Soundtrack">${NOTE}</button><span class="alm-hudc__mut"><b>Nothing playing</b><i>${m.running ? "music starts with the next reply" : "press Start to score the scene"}</i></span><span class="alm-hudc__muc">${run}</span></div>`;
  }
  const state = m.mode === "holding" ? "holding this song" : m.mode === "yielded" || m.origin === "user" ? "your pick" : m.origin === "autoplay" ? "autoplay" : m.running ? m.mood || "following the scene" : "not choosing";
  const menu = m.menu
    ? `<div class="alm-hudc__mumenu" role="group" aria-label="The music's mood">${m.menu.map(([k, label]) => `<button data-hud="music" data-m="mood" data-mood="${e(k)}" aria-pressed="${k === m.pick}">${e(label)}</button>`).join("")}</div>`
    : "";
  const moodBtn = `<button class="alm-hudc__mumood" data-hud="music" data-m="moods" aria-expanded="${!!m.menu}" title="Change the music's mood (Auto: the scene decides)">${m.paused ? "paused · " : ""}${e(state)}${m.chosen ? " · yours" : ""} ▾</button>`;
  const hold = m.mode === "holding" ? b("release", "Release: change with the scene again", HOLD, " is-on") : b("hold", "Hold this song until the scene changes", HOLD);
  return `<div class="alm-hudc__mu${m.paused ? " is-paused" : ""}" title="${e(musicTip(m))}">
<button class="alm-hudc__muart" data-hud="music" data-m="open" aria-label="Open the Soundtrack" title="Open the Soundtrack">${m.thumb ? `<img src="${e(m.thumb)}" alt="">` : NOTE}</button>
<span class="alm-hudc__mut"><b>${e(m.title)}</b><i>${e(m.artist)}</i>${moodBtn}</span>
<span class="alm-hudc__muc">${b(m.paused ? "play" : "pause", m.paused ? "Play" : "Pause", m.paused ? "▶" : "❚❚")}${b("skip", "Skip: another song for this scene", "⏭")}${m.running ? hold : ""}${b("never", "Never play this song again", "⊘", " is-dim")}${run}</span>
</div>${menu}`;
}

/** The collapsed pill. `note` replaces the scene when there is nothing to show yet. */
export function hudPill(v: any, note?: string, ui?: HudUi): string {
  if (note || !v) {
    return `<div class="alm-hudw" role="button" tabindex="0" data-hud="toggle" title="Open the Almanac"><span class="alm-hudw__dial" style="background:${BAND_SKY.evening}"><b class="moon"></b></span><b class="alm-hudw__brand">ALMANAC</b><span class="alm-hudw__dim">${e(note ?? "connecting…")}</span></div>`;
  }
  const n = v.now ?? {};
  const place = (n.place ?? []) as string[];
  const present = presentOf(v).slice(0, 4);
  const chips = urgent(v);
  const night = NIGHT.test(n.band ?? "evening");
  const unseen = ui?.unseen ?? 0;
  return `<div class="alm-hudw" role="button" tabindex="0" data-hud="toggle" aria-expanded="false" title="Open the Now window">
<span class="alm-hudw__dial" style="background:${skyOf(v)}"><b class="${night ? "moon" : "sun"}"></b></span><b class="alm-hudw__t">${e(n.time ?? "--:--")}</b>${n.weather ? `<span class="alm-hudw__wx">${e(n.weather.glyph)}${n.weather.tempC != null ? ` ${Math.round(n.weather.tempC)}°` : ` ${e(n.weather.condition)}`}</span>` : ""}${place.length ? `<span class="alm-hudw__pl">${PIN}${e(place[place.length - 1])}</span>` : ""}${present.length ? `<span class="alm-hudw__who">${present.map((c: any) => med(c)).join("")}</span>` : ""}${ui?.music?.title && !ui.music.paused ? `<span class="alm-hudw__mu" title="${e(musicTip(ui.music))}">${NOTE}<i>${e(ui.music.title)}</i></span>` : ""}${chips.length ? `<span class="alm-hudw__chip"><span class="alm-hudw__rot" data-n="${chips.length}">${chips.map((c) => `<span>${e(c)}</span>`).join("")}</span></span>` : ""}${v.planError ? `<span class="alm-hudw__err" title="The last turn went to the model without the Almanac. Open the Almanac for details.">!</span>` : ""}${unseen ? `<span class="alm-hudw__badge" title="${unseen} change${unseen === 1 ? "" : "s"} since you last looked">${unseen > 9 ? "9+" : unseen}</span>` : ""}</div>`;
}

/** The docked tab: a slim bookmark against the screen edge. Drag it along the edge to move it, away from the edge to float the widget again. */
export function hudTab(v: any, edge: "left" | "right", note?: string, ui?: HudUi): string {
  const tip = "drag along the edge to move it, or away from the edge to float it";
  if (note || !v) {
    return `<div class="alm-hudt alm-hudt--${edge}" role="button" tabindex="0" data-hud="toggle" data-hud-tab title="ALMANAC · ${e(note ?? "connecting…")} · ${tip}"><span class="alm-hudw__dial" style="background:${BAND_SKY.evening}"><b class="moon"></b></span><b class="alm-hudt__t">…</b><i class="alm-hudt__grab"></i></div>`;
  }
  const n = v.now ?? {};
  const place = (n.place ?? []) as string[];
  const present = presentOf(v).slice(0, 3);
  const night = NIGHT.test(n.band ?? "evening");
  const unseen = ui?.unseen ?? 0;
  const where = [n.time, place[place.length - 1]].filter(Boolean).join(" · ");
  return `<div class="alm-hudt alm-hudt--${edge}" role="button" tabindex="0" data-hud="toggle" data-hud-tab aria-expanded="false" title="Open the Now window${where ? ` (${e(where)})` : ""} · ${tip}"><span class="alm-hudw__dial" style="background:${skyOf(v)}"><b class="${night ? "moon" : "sun"}"></b></span><b class="alm-hudt__t">${e(n.time ?? "--:--")}</b>${n.weather ? `<span class="alm-hudt__wx">${e(n.weather.glyph)}${n.weather.tempC != null ? `<small>${Math.round(n.weather.tempC)}°</small>` : ""}</span>` : ""}${present.length ? `<span class="alm-hudt__who">${present.map((c: any) => med(c)).join("")}</span>` : ""}${v.planError ? `<span class="alm-hudw__err" title="The last turn went to the model without the Almanac. Open the Almanac for details.">!</span>` : ""}${ui?.music?.title && !ui.music.paused ? `<span class="alm-hudw__mu alm-hudt__mu" title="${e(musicTip(ui.music))}">${NOTE}</span>` : ""}<i class="alm-hudt__grab"></i>${unseen ? `<span class="alm-hudw__badge" title="${unseen} change${unseen === 1 ? "" : "s"} since you last looked">${unseen > 9 ? "9+" : unseen}</span>` : ""}</div>`;
}

/** Sun and moon on their arcs, from the rise and set times. */
function skyArc(v: any): string {
  const n = v.now ?? {};
  const rise = hm(n.sun?.rise) ?? 360;
  const set = hm(n.sun?.set) ?? 1080;
  const now = n.minute ?? 720;
  const W = 360;
  const H = 150;
  // The arc sits on the right; the clock, date and title keep the left.
  const cx = 270;
  const base = 132;
  const rx = 78;
  const ry = 86;
  const at = (t: number) => ({ x: cx - rx * Math.cos(Math.PI * t), y: base - ry * Math.sin(Math.PI * t) });
  const day = set > rise && now >= rise && now < set;
  const nightLen = (rise + 1440 - set) % 1440 || 1;
  const t = day ? (now - rise) / (set - rise) : ((now - set + 1440) % 1440) / nightLen;
  const p = at(Math.min(0.97, Math.max(0.03, t)));
  const moon = n.moon;
  const lit = typeof moon?.illumination === "number" ? moon.illumination : 0.5;
  const body = day
    ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="26" fill="rgba(255,190,110,.22)"/><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="11" fill="#ffcf73"/>`
    : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="16" fill="rgba(244,236,214,.14)"/><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9" fill="#f4ecd6"/><circle cx="${(p.x + 3 + (1 - lit) * 6).toFixed(1)}" cy="${(p.y - 1).toFixed(1)}" r="${(8 * (1 - lit) + 0.01).toFixed(1)}" fill="rgba(20,22,60,.8)"/>`;
  return `<svg class="alm-hudc__arc" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMaxYMax meet" aria-hidden="true"><path d="M${cx - rx} ${base} A${rx} ${ry} 0 0 1 ${cx + rx} ${base}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.2" stroke-dasharray="2 5"/>${body}</svg>`;
}

const HILLS = `<svg class="alm-hudc__land" viewBox="0 0 360 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 40V26c30-8 60-12 96-6 20 3 30-6 44-6h6v-7h6v7h10v-4l7-5 7 5v8c26 2 52-10 86-8 34 2 60 8 98 2v24z"/><rect x="160" y="15" width="3" height="3" fill="#ffc86b"/><rect x="170" y="17" width="3" height="3" fill="#ffc86b"/></svg>`;

function precip(v: any): string {
  const c = String(v.now?.weather?.condition ?? "").toLowerCase();
  if (/snow|sleet|blizzard|flurr/.test(c)) return `<span class="alm-hudc__fx is-snow"></span>`;
  if (/rain|drizzle|storm|shower|thunder|downpour/.test(c)) return `<span class="alm-hudc__fx is-rain"></span>`;
  if (/fog|mist|haze/.test(c)) return `<span class="alm-hudc__fx is-fog"></span>`;
  return "";
}

const empty = (t: string) => `<p class="alm-hudc__empty">${t}</p>`;
const h6 = (t: string, right = "") => `<h6><span>${t}</span>${right ? `<span>${right}</span>` : ""}</h6>`;

function paneChanged(v: any): string {
  const rows = v.changes?.rows ?? [];
  // What the check of the last reply found comes first: a slip is worth a swipe.
  const warns = (v.checks?.issues ?? []).filter((x: any) => x.level === "warn");
  const check = warns.length ? h6("The check found", `${warns.length}`) + warns.slice(0, 4).map((x: any) => `<div class="alm-hudc__row"><span class="alm-hudc__ic">⚠</span><div><span>${e(x.text)}</span>${x.quote && !x.text.includes(x.quote) ? `<small>«${e(x.quote.slice(0, 90))}»</small>` : ""}</div></div>`).join("") : "";
  if (!rows.length) return check + h6("Since the last reply") + empty("The last reply didn't change anything the Almanac tracks.");
  return check + h6("Since the last reply", `${rows.length} change${rows.length === 1 ? "" : "s"}`) + rows.map((r: any, i: number) => {
    const delta = r.bond ? `<span class="alm-hudc__d ${r.bond.delta > 0 ? "up" : "dn"}">${r.bond.delta > 0 ? "▲ +" : "▼ "}${r.bond.delta}</span>` : r.tone === "due" ? `<span class="alm-hudc__d due">due</span>` : "";
    const body = r.bond
      ? `<b>${e(r.text)}</b>${track(r.bond.to, r.bond.from, r.bond.color, r.bond.lo)}${r.sub ? `<small>${e(r.sub)}</small>` : ""}`
      : `<span>${e(r.text)}</span>${r.sub ? `<small>${e(r.sub)}</small>` : ""}`;
    return `<div class="alm-hudc__row" style="--i:${i}"><span class="alm-hudc__ic">${e(r.icon)}</span><div>${body}</div>${delta}</div>`;
  }).join("");
}

function paneStakes(v: any): string {
  const w = v.world ?? {};
  const out: string[] = [];
  const dl = (w.deadlines ?? []).filter((d: any) => !d.done && !d.passed && d.leftMin != null).sort((a: any, b: any) => a.leftMin - b.leftMin);
  if (dl.length) {
    const d = dl[0];
    out.push(h6("Nearest deadline"), `<div class="alm-hudc__count"><b>${e(span(d.leftMin))}</b><span>${e(d.title)}</span><small>${e(d.at)}</small><i style="--p:${Math.max(4, Math.min(100, 100 - (d.leftMin / (72 * 60)) * 100)).toFixed(0)}%"></i></div>`);
    if (dl.length > 1) out.push(dl.slice(1, 4).map((x: any) => `<div class="alm-hudc__row"><span class="alm-hudc__ic">⏳</span><div><span>${e(x.title)}</span><small>${e(x.at)}</small></div><span class="alm-hudc__d">${e(span(x.leftMin))}</span></div>`).join(""));
  }
  const clocks = (w.factions ?? []).flatMap((f: any) => (f.clocks ?? []).map((c: any) => ({ ...c, faction: f.name }))).slice(0, 6);
  if (clocks.length) out.push(h6("Clocks"), `<div class="alm-hudc__rings">${clocks.map((c: any) => `<div>${ring(c.cur, c.max, clockColor(c.name))}<small>${e(c.faction)}<br>${e(c.name)}</small></div>`).join("")}</div>`);
  const gauges = w.gauges ?? [];
  if (gauges.length) out.push(h6("Gauges"), gauges.slice(0, 4).map((g: any) => {
    const prev = g.history?.length > 1 ? g.history[g.history.length - 2].v : null;
    const trend = prev == null || prev === g.cur ? "" : g.cur > prev ? `<span class="alm-hudc__d dn">▲</span>` : `<span class="alm-hudc__d up">▼</span>`;
    const segs = g.max <= 12 ? `<span class="alm-hudc__segs">${Array.from({ length: g.max }, (_, i) => `<i class="${i < g.cur ? "on" : ""}"></i>`).join("")}</span>` : `<span class="alm-hudc__bar"><i style="width:${Math.round((g.cur / Math.max(1, g.max)) * 100)}%"></i></span>`;
    return `<div class="alm-hudc__gauge"><span title="${e(g.cause ?? "")}">${e(g.name)}</span>${segs}<span class="alm-hudc__n">${g.cur}/${g.max}</span>${trend}</div>`;
  }).join(""));
  const owed = (w.cons ?? []).filter((c: any) => c.status === "due" || c.status === "open").sort((a: any, b: any) => (a.status === "due" ? -1 : 0) - (b.status === "due" ? -1 : 0) || b.msgIndex - a.msgIndex).slice(0, 5);
  if (owed.length) out.push(h6("Owed and due"), owed.map((c: any) => `<div class="alm-hudc__row"><span class="alm-hudc__ic">${c.kind === "owe" ? "⚖" : "⛓"}</span><div><span><b>${e(c.whoName)}${c.whomName ? ` → ${e(c.whomName)}` : ""}</b>: ${e(c.what ?? "")}</span>${c.dueText ? `<small>due ${e(c.dueText)}</small>` : ""}</div>${c.status === "due" ? `<span class="alm-hudc__d due">due</span>` : ""}</div>`).join(""));
  const clues = (w.clues ?? []).slice(-5).reverse();
  if (clues.length) {
    const rel = (r?: string) => (!r ? 0 : /solid|confirm|certain|strong|reliable|high/i.test(r) ? 3 : /likely|probable|good|medium|fair/i.test(r) ? 2 : 1);
    out.push(h6("Clue board"), clues.map((c: any) => `<div class="alm-hudc__clue"><span>📌</span><div>${e(c.text)}${c.pointsTo ? ` <em>→ ${e(c.pointsTo)}</em>` : ""}${c.reliability ? `<span class="alm-hudc__rel" title="${e(c.reliability)}">${[1, 2, 3].map((k) => `<i class="${k <= rel(c.reliability) ? "on" : ""}"></i>`).join("")}</span>` : ""}</div></div>`).join(""));
  }
  const rep = (w.rep ?? []).filter((r: any) => r.score).slice(0, 4);
  if (rep.length) out.push(h6("Standing"), `<div class="alm-hudc__tags">${rep.map((r: any) => `<span class="alm-hudc__tag ${r.score > 0 ? "up" : "dn"}">${e(r.group)} ${r.score > 0 ? "+" : ""}${r.score}</span>`).join("")}</div>`);
  return out.length ? out.join("") : h6("Stakes") + empty("No deadlines, clocks, gauges or debts yet.");
}

function paneCast(v: any, ui: HudUi): string {
  const who = presentOf(v);
  const narrBtn = `<button class="alm-hudc__narr${ui.narr ? " is-on" : ""}" data-hud="narr" aria-pressed="${ui.narr}" title="${ui.narr ? "Hide the narrator's secrets" : "Show the narrator's secrets (spoilers)"}">${svg("eye", 14)}${ui.narr ? "Narrator" : "Player"}</button>`;
  const head = `<h6><span>Present${(v.now?.place ?? []).length ? ` · ${e(v.now.place[v.now.place.length - 1])}` : ""}</span>${narrBtn}</h6>`;
  if (!who.length) return head + empty("No one else is here.");
  const cards = who.slice(0, 8).map((c: any) => {
    const tags = [
      c.mood ? `<span class="alm-hudc__tag" title="${e(c.mood.prev && c.moodFresh ? `${c.mood.prev} → ` : "")}${e(c.mood.name)}">${c.mood.prev && c.moodFresh ? `<s>${e(c.mood.prev)}</s> → ` : ""}${e(c.mood.name)}</span>` : "",
      ...(c.held ?? []).slice(0, 2).map((h: string) => `<span class="alm-hudc__tag" title="${e(h)}">✋ ${e(h)}</span>`),
      ...(c.injuries ?? []).slice(0, 2).map((i: any) => `<span class="alm-hudc__tag dn" title="${e(i.where)}${i.note ? `, ${e(i.note)}` : ""}">🩸 ${e(i.where)}${i.note ? `, ${e(i.note)}` : ""}</span>`),
    ].join("");
    const y = c.toYou;
    const bars = y ? `<div class="alm-hudc__bars">${y.trust != null ? `<span>trust</span>${track(y.trust, y.trustWas, c.color)}` : ""}${y.affection != null ? `<span>affection</span>${track(y.affection, y.affectionWas, c.color)}` : ""}</div>` : "";
    const secret = ui.narr && c.pressure ? `<div class="alm-hudc__secret"><b>Hidden pressure</b>${e(c.name)} ${e(c.pressure)}</div>` : "";
    return `<div class="alm-hudc__per" style="--c:${e(c.color)}"><div class="alm-hudc__perh">${med(c, true)}<div><b>${e(c.name)}</b>${c.activity ? `<small>${e(c.activity)}</small>` : ""}</div></div>${tags ? `<div class="alm-hudc__tags">${tags}</div>` : ""}${bars}${secret}</div>`;
  }).join("");
  const irony = v.irony ?? [];
  const hidden = presentOf(v).filter((c: any) => c.pressure).length + irony.length;
  const tail = ui.narr
    ? irony.map((x: any) => `<div class="alm-hudc__irony"><b>🎭 Dramatic irony</b>${e(x.name)} is certain of something false: ${e(x.statement)}</div>`).join("")
    : hidden ? `<p class="alm-hudc__locked">🔒 ${hidden} secret${hidden === 1 ? "" : "s"} the narrator keeps. Narrator view shows ${hidden === 1 ? "it" : "them"}.</p>` : "";
  return head + `<div class="alm-hudc__who">${cards}</div>` + tail;
}

function paneThreads(v: any): string {
  const w = v.world ?? {};
  const out: string[] = [];
  const threads = (w.threads ?? []).filter((t: any) => t.status !== "resolved").sort((a: any, b: any) => b.lastMsg - a.lastMsg).slice(0, 6);
  if (threads.length) out.push(h6("Threads"), threads.map((t: any) => `<div class="alm-hudc__thr"><div><b>${e(t.title)}</b><span class="alm-hudc__st ${t.status === "stalled" ? "stall" : ""}">${t.status === "stalled" ? `stalled${t.stalls ? ` · ${t.stalls}` : ""}` : "open"}</span></div>${t.latest ? `<small>${e(t.latest)}</small>` : ""}${t.blocker ? `<small>Blocked: ${e(t.blocker)}</small>` : ""}</div>`).join(""));
  const scene = v.now?.scene ?? 0;
  const plants = (w.plants ?? []).filter((p: any) => p.paidAt == null).slice(-3).reverse();
  if (plants.length) out.push(h6("Chekhov's shelf"), plants.map((p: any) => { const ago = Math.max(0, scene - (p.plantedScene ?? scene)); return `<div class="alm-hudc__chek"><span>🔫</span><div><b>${e(p.text)}</b><small>${ago ? `planted ${ago} scene${ago === 1 ? "" : "s"} ago` : "planted this scene"}${p.payoff ? ` · payoff: ${e(p.payoff)}` : ""}</small></div></div>`; }).join(""));
  const rumors = (w.rumors ?? []).slice(-2).reverse();
  if (rumors.length) out.push(h6("Word going round"), rumors.map((r: any) => `<p class="alm-hudc__rumor">“${e(r.text)}”<small>${r.hops ? `passed through ${r.hops} mouth${r.hops === 1 ? "" : "s"}` : "first-hand"}</small></p>`).join(""));
  return out.length ? out.join("") : h6("Threads") + empty("No open threads, plants or rumours yet.");
}

/** Whether the Unspoken tab shows: inner voice not off, and either set or already producing thoughts. */
export function hasThoughtsTab(v: any): boolean {
  const iv = v?.thoughts?.innerVoice ?? "";
  if (iv === "off") return false;
  return !!iv || (v?.thoughts?.list ?? []).length > 0;
}

function paneUnspoken(v: any, ui: HudUi): string {
  const t = v.thoughts ?? { list: [] };
  const list = t.list ?? [];
  const fresh = t.msg >= 0 && t.msg === v.changes?.msg;
  if (!list.length) return h6("Unspoken") + empty(t.innerVoice === "prose" ? "No one thought aloud in the last reply." : "The last reply kept its thoughts to itself.");
  const sealed = list.map((x: any, i: number) => {
    const key = `${t.msg}:${i}`;
    const nm = x.isUser ? `${x.name} · you` : x.name;
    if (x.kind === "inline" || !x.cue) return `<div class="alm-hudc__bub" style="--c:${e(x.color)}"><b>${e(nm)} thinks</b>${e(x.text)}</div>`;
    const open = ui.opened.has(key);
    return `<button class="alm-hudc__env${open ? " is-open" : ""}" style="--c:${e(x.color)}" data-hud="env" data-key="${e(key)}" aria-expanded="${open}">${open
      ? `<span class="alm-hudc__note">${e(x.text)}<em>— ${e(x.name)}</em></span>`
      : `<span class="alm-hudc__front"><span class="alm-hudc__seal">${e(initials(x.name))}</span><span class="alm-hudc__cue">“${e(x.cue)}”</span><span class="alm-hudc__envwho">${e(nm)} · break the seal</span></span>`}</button>`;
  }).join("");
  return h6(fresh ? "Unspoken · the last reply" : "Unspoken · an earlier reply", `${list.length}`) + `<p class="alm-hudc__lockcap">🔒 No one else in the story knows these.</p>` + sealed;
}

function paneBackstage(v: any): string {
  const f = (v.feed ?? [])[0];
  const out: string[] = [];
  const noteTok = Math.round(String(v.note ?? "").length / 4);
  const chron = v.chronicle?.tokens ? (v.chronicle.tokens.chapter ?? 0) + (v.chronicle.tokens.arc ?? 0) + (v.chronicle.tokens.volume ?? 0) : 0;
  const lore = f?.tokens ?? 0;
  const parts: [string, number, string][] = [["Lore & recall", lore, "var(--alm-gold)"], ["Chronicle", chron, "var(--alm-accent-2)"], ["Scene note", noteTok, "var(--alm-accent)"]];
  const total = parts.reduce((a, p) => a + p[1], 0);
  if (total) out.push(h6("Fed to the model", `~${total.toLocaleString()} tokens`), `<div class="alm-hudc__tok">${parts.filter((p) => p[1]).map((p) => `<i style="flex:${p[1]};background:${p[2]}"></i>`).join("")}</div><div class="alm-hudc__legend">${parts.filter((p) => p[1]).map((p) => `<span style="--c:${p[2]}">${p[0]} ${p[1].toLocaleString()}</span>`).join("")}</div>`);
  const items = (f?.items ?? []).filter((i: any) => i.injected).slice(0, 8);
  const chapters = (f?.chronicle ?? []).slice(0, 4);
  if (items.length || chapters.length) out.push(h6("What went in this turn"), [...items.map((i: any) => `<div class="alm-hudc__fed"><span class="alm-hudc__via">${e(i.via ?? "recall")}</span><span>${e(i.name)}</span></div>`), ...chapters.map((c: any) => `<div class="alm-hudc__fed"><span class="alm-hudc__via">chronicle</span><span>${e(c.name)}</span></div>`)].join(""));
  const k = v.clerk ?? {};
  const clerk = k.running ? "⏳ The knowledge clerk is reading replies…" : k.unread ? `${k.unread} repl${k.unread === 1 ? "y" : "ies"} the clerk hasn't read yet` : "✓ The clerk is idle; every reply read";
  out.push(h6("Health"), v.planError ? `<p class="alm-hudc__ok is-warn">The last turn went out without the Almanac (${e(v.planError.where)}).</p>` : `<p class="alm-hudc__ok">✓ The last turn went out with the Almanac</p>`, `<p class="alm-hudc__ok${k.unread ? " is-warn" : ""}">${e(clerk)}</p>`);
  return out.join("");
}

/** The open window. */
export function hudCard(v: any, ui: HudUi = { tab: "changed", narr: false, unseen: 0, opened: new Set() }): string {
  const n = v.now ?? {};
  const place = (n.place ?? []) as string[];
  const clock = String(n.clock ?? "");
  const cut = clock.lastIndexOf(", ");
  const date = String(n.date ?? (n.time && cut > 0 ? clock.slice(0, cut) : ""));
  // "Day 2" only when the calendar's own date doesn't already count days.
  const dayNo = n.day != null && !/\bday\b/i.test(date) ? `${date ? " · " : ""}Day ${n.day}` : "";
  const size = ui.size ?? HUD_SIZE;
  const night = NIGHT.test(n.band ?? "evening");
  const tabs = HUD_TABS.filter((t) => t !== "unspoken" || hasThoughtsTab(v));
  const tab = tabs.includes(ui.tab as any) ? ui.tab : "changed";
  const rows = v.changes?.rows?.length ?? 0;
  const due = (v.world?.cons ?? []).some((c: any) => c.status === "due") || (v.world?.deadlines ?? []).some((d: any) => !d.done && !d.passed && d.leftMin != null && d.leftMin < 180);
  const badge = (t: string) => t === "changed" && ui.unseen ? `<sup>${ui.unseen > 9 ? "9+" : ui.unseen}</sup>` : t === "stakes" && due ? `<sup class="dot"></sup>` : t === "unspoken" && (v.thoughts?.list ?? []).length && !ui.thoughtsSeen && tab !== "unspoken" ? `<sup class="dot soft" title="Unread"></sup>` : "";
  const set = hm(n.sun?.set);
  const rise = hm(n.sun?.rise);
  let sunChip = "";
  if (n.minute != null && set != null && rise != null) {
    const toSet = set - n.minute;
    const toRise = (rise - n.minute + 1440) % 1440;
    sunChip = n.sun?.daylight ? (toSet > 0 ? `☀ sets ${span(toSet)}` : "") : `☀ rises ${span(toRise)}`;
  }
  const astro = `${sunChip ? `<span>${e(sunChip)}</span>` : ""}${n.moon ? `<span title="${e(n.moon.name)}">${e(n.moon.glyph)}<i> ${e(n.moon.name)}</i></span>` : ""}`;
  const fc = (n.forecastHours ?? []).filter((_: any, i: number) => i % 2 === 0).slice(0, 6);
  const pane = tab === "stakes" ? paneStakes(v) : tab === "cast" ? paneCast(v, ui) : tab === "threads" ? paneThreads(v) : tab === "unspoken" ? paneUnspoken(v, ui) : tab === "backstage" ? paneBackstage(v) : paneChanged(v);
  return `<div class="alm-hudc" role="dialog" aria-label="ALMANAC · Now" style="width:${size.w}px;height:${size.h}px">
<header class="alm-hudc__sky${night ? " is-night" : ""}" style="background:${skyOf(v)}">
  ${night ? `<span class="alm-hudc__stars"></span>` : ""}${skyArc(v)}${precip(v)}${HILLS}
  <div class="alm-hudc__ttl"><b>${e(n.time ?? "--:--")}</b><span title="${e(date + dayNo)}">${e(date)}${e(dayNo)}</span>${n.title ? `<em title="${e(n.title)}">${e(n.title)}</em>` : ""}</div>
  <div class="alm-hudc__side"><div class="alm-hudc__btns"><button class="alm-hudc__b" data-hud="dock" aria-label="${ui.dock ? "Float the widget again" : "Dock to the screen edge"}" title="${ui.dock ? "Float the widget again" : "Dock to the screen edge"}">${svg(ui.dock ? "undock" : "dock", 15)}</button><button class="alm-hudc__b alm-hudc__x" data-hud="toggle" aria-label="Close the Now window" title="Close">✕</button></div>${astro ? `<div class="alm-hudc__astro">${astro}</div>` : ""}</div>
  <div class="alm-hudc__chips">${astro ? `<span class="alm-hudc__astro2">${astro}</span>` : ""}${n.weather ? `<span>${e(n.weather.glyph)} ${e(n.weather.text ?? n.weather.condition)}</span>` : ""}${place.length ? `<span class="alm-hudc__plc" title="${e(place.join(" › "))}">${PIN}${place.map((p, i, a) => `<b class="${i === a.length - 1 ? "last" : ""}">${e(p)}</b>${i < a.length - 1 ? "<s>›</s>" : ""}`).join("")}</span>` : ""}</div>
</header>
${musicStrip(ui.music)}
${fc.length ? `<div class="alm-hudc__fc">${fc.map((h: any, i: number) => `<div class="${i === 0 ? "now" : ""}"><span>${i === 0 ? "now" : e(h.t)}</span><b>${e(h.glyph)}</b><i>${e(h.temp)}°</i></div>`).join("")}</div>` : ""}
${v.planError ? `<p class="alm-hudc__err alm-hudc__err--top" data-hud="tab" data-tab="backstage"><b>The last turn went out without the Almanac.</b> ${e(v.planError.message)}</p>` : ""}
<div class="alm-hudc__body">
  <nav class="alm-hudc__rail" role="tablist" aria-orientation="vertical">${tabs.map((t) => `<button role="tab" data-hud="tab" data-tab="${t}" aria-selected="${t === tab}" title="${TAB_LABEL[t]}" aria-label="${TAB_LABEL[t]}">${svg(t)}${badge(t)}</button>`).join("")}<button class="alm-hudc__open" data-hud="open" title="Open the Almanac" aria-label="Open the Almanac">${svg("book")}</button></nav>
  <div class="alm-hudc__pane" role="tabpanel" data-tab="${tab}">${pane}</div>
</div><span class="alm-hudc__grip" data-hud-grip data-spindle-float-resize-handle title="Drag to resize · double-click to reset" aria-hidden="true"></span></div>`;
}

/** Measures rendered HTML off-screen (the widget's own root may not be in the page yet). */
export function measure(html: string, width?: number): { w: number; h: number } {
  try {
    const probe = document.createElement("div");
    probe.style.cssText = `position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;${width ? `width:${width}px;` : "width:max-content;"}`;
    probe.innerHTML = html;
    document.body.appendChild(probe);
    const el = probe.firstElementChild as HTMLElement | null;
    const r = el?.getBoundingClientRect();
    probe.remove();
    if (r && r.width > 0) return { w: Math.ceil(r.width), h: Math.ceil(r.height) };
  } catch {
    /* no layout available */
  }
  // Rough estimate from the text when layout isn't available yet.
  const text = html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const avatars = (html.match(/class="alm-om/g) ?? []).length;
  return width ? { w: width, h: 540 } : { w: Math.ceil(text.length * 7.4 + 56 + avatars * 18), h: 44 };
}
