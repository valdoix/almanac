// The floating "Now" widget: a pill (time, weather, place, who is present)
// that opens into a small window with the scene, the people in it, what is
// owed, the forecast, and a button to the full Almanac drawer.

import { escapeHtml as e, initials } from "../core/util";
import { BAND_SKY } from "./orrery";

const PIN = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg>`;

const mini = (c: any) => `<span class="alm-mini" style="--c:${e(c.color)}" title="${e(c.name)}${c.mood?.name ? ` · ${e(c.mood.name)}` : ""}">${e(initials(c.name))}</span>`;
const presentOf = (v: any) => (v.cast ?? []).filter((c: any) => (c.tier === "spot" || c.tier === "peri") && !c.isUser && !c.dead);
const skyOf = (v: any) => BAND_SKY[v?.now?.band] ?? BAND_SKY.evening;

/** The collapsed pill. `note` replaces the scene when there is nothing to show yet. */
export function hudPill(v: any, note?: string): string {
  if (note || !v) {
    return `<div class="alm-hudw" role="button" tabindex="0" data-hud="toggle" title="Open the Almanac"><span class="alm-hudw__orb" style="background:${BAND_SKY.evening}"></span><b>ALMANAC</b><span class="alm-hudw__dim">${e(note ?? "connecting…")}</span></div>`;
  }
  const n = v.now ?? {};
  const place = (n.place ?? []) as string[];
  const present = presentOf(v).slice(0, 4);
  return `<div class="alm-hudw" role="button" tabindex="0" data-hud="toggle" aria-expanded="false" title="Open the Now window">
<span class="alm-hudw__orb" style="background:${skyOf(v)}"><i class="${/night|hours|pre-dawn|evening|dusk/.test(n.band ?? "evening") ? "moon" : "sun"}"></i></span><b class="alm-hudw__t">${e(n.time ?? "--:--")}</b>${n.weather ? `<span>${e(n.weather.glyph)} ${e(n.weather.condition)}</span>` : ""}${place.length ? `<span class="alm-hudw__pl">${PIN}${e(place[place.length - 1])}</span>` : ""}${present.length ? `<span class="alm-stack">${present.map(mini).join("")}</span>` : ""}</div>`;
}

/** The open window. */
export function hudCard(v: any): string {
  const n = v.now ?? {};
  const place = (n.place ?? []) as string[];
  const clock = String(n.clock ?? "");
  const cut = clock.lastIndexOf(", ");
  const date = n.time && cut > 0 ? clock.slice(0, cut) : "";
  const present = presentOf(v).slice(0, 5);
  const owed = (v.world?.cons ?? []).filter((c: any) => c.status === "due" || c.status === "open").slice(-2);
  const who = present.map((c: any) => `<li>${mini(c)}<div><b>${e(c.name)}</b>${c.mood?.name ? ` <span class="alm-hudc__mood">${e(c.mood.name)}</span>` : ""}${c.activity ? `<small>${e(c.activity)}</small>` : ""}</div></li>`).join("");
  return `<div class="alm-hudc" role="dialog" aria-label="ALMANAC · Now">
<div class="alm-hudc__sky" style="background:${skyOf(v)}">
  <div class="alm-hudc__row"><b class="alm-hudc__clock">${e(n.time ?? "--:--")}</b><span class="alm-hudc__date">${e(date)}</span><button class="alm-hudc__x" data-hud="toggle" aria-label="Close the Now window">✕</button></div>
  ${n.title ? `<div class="alm-hudc__title">${e(n.title)}</div>` : ""}
  <div class="alm-hudc__chips">${n.weather ? `<span>${e(n.weather.glyph)} ${e(n.weather.text ?? n.weather.condition)}</span>` : ""}${place.length ? `<span>${PIN} ${e(place.slice(-2).join(" › "))}</span>` : ""}${n.mode ? `<span>${e(n.mode)}</span>` : ""}</div>
</div>
<div class="alm-hudc__bd">
  <h5>Present</h5>
  ${who ? `<ul class="alm-hudc__who">${who}</ul>` : `<p class="alm-hudc__muted">No one else is here.</p>`}
  ${owed.length ? `<h5>Owed and due</h5><ul class="alm-hudc__owed">${owed.map((c: any) => `<li class="${c.status === "due" ? "due" : ""}">${e(c.whoName)}${c.whomName ? ` → ${e(c.whomName)}` : ""}: ${e(c.what ?? "")}${c.dueText ? ` <small>due ${e(c.dueText)}</small>` : ""}</li>`).join("")}</ul>` : ""}
  ${n.forecast ? `<h5>Ahead</h5><p class="alm-hudc__muted">${e(n.forecast)}</p>` : ""}
  <button class="alm-hudc__go" data-hud="open">Open the Almanac →</button>
</div></div>`;
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
  const avatars = (html.match(/class="alm-mini"/g) ?? []).length;
  return width ? { w: width, h: 380 } : { w: Math.ceil(text.length * 7.4 + 56 + avatars * 18), h: 40 };
}
