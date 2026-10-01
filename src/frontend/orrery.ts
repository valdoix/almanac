// Orrery navigation for the Almanac drawer: a live sky header (clock, date,
// moon, weather, place) with a switcher for the current group's pages, and a
// dock at the bottom — the sun goes to Now, and each planet opens its pages on
// an orbit. Fourteen pages, never more than five buttons in a row.

import { escapeHtml as e } from "../core/util";

export type Page = "now" | "cast" | "bonds" | "knowledge" | "chronicle" | "timeline" | "world" | "elsewhere" | "codex" | "lore" | "creator" | "recall" | "craft" | "settings";

export interface Group {
  id: "people" | "story" | "library" | "engine";
  label: string;
  color: string;
  icon: Page;
  pages: Page[];
}

export const GROUPS: Group[] = [
  { id: "people", label: "People", color: "#ff8fa3", icon: "cast", pages: ["cast", "bonds", "knowledge"] },
  { id: "story", label: "Story", color: "#5fcfc0", icon: "chronicle", pages: ["chronicle", "timeline", "world", "elsewhere"] },
  { id: "library", label: "Library", color: "#a99bff", icon: "codex", pages: ["codex", "lore", "creator"] },
  { id: "engine", label: "Engine", color: "#ffc46b", icon: "settings", pages: ["recall", "craft", "settings"] },
];

export const PAGES: Page[] = ["now", ...GROUPS.flatMap((g) => g.pages)];

export const LABEL: Record<Page, string> = {
  now: "Now", cast: "Cast", bonds: "Bonds", knowledge: "Knowledge", chronicle: "Chronicle", timeline: "Timeline", world: "World", elsewhere: "Elsewhere",
  codex: "Codex", lore: "Lore", creator: "Creator", recall: "Recall", craft: "Craft", settings: "Settings",
};

export const groupOf = (p: Page): Group | undefined => GROUPS.find((g) => g.pages.includes(p));

const IC: Record<Page, string> = {
  now: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  cast: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.3-.3 4.3 1 5 3.8"/>',
  bonds: '<circle cx="6" cy="7" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.5 7h7M7.2 9.2l3.6 6.6M16.8 9.2l-3.6 6.6"/>',
  knowledge: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  chronicle: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5Z"/><path d="M12 6.5v13"/>',
  timeline: '<path d="M7 3v18"/><circle cx="7" cy="7" r="2"/><circle cx="7" cy="16" r="2"/><path d="M11 7h9M11 16h6"/>',
  world: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5Z"/>',
  elsewhere: '<path d="M15.5 4.5a8 8 0 1 0 4 11.2 6.5 6.5 0 0 1-4-11.2Z"/><path d="M4 19.5c3-1.5 5-1.5 8 0s5 1.5 8 0"/>',
  codex: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  lore: '<path d="M7 4h11v13a3 3 0 0 1-3 3H6"/><path d="M7 4a2 2 0 0 0-2 2v2h2M6 20a2 2 0 0 0 2-2v-1h10"/><path d="M10 9h5M10 12.5h5"/>',
  creator: '<path d="M20 4c-7 1-12 6-13.5 13.5L5 20"/><path d="M20 4c-.5 5-3.5 9.5-9 11"/><path d="m9 13.5 3 3"/>',
  recall: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/><path d="M10.5 7.5v3l2 1.5"/>',
  craft: '<path d="M4 20 15 9"/><path d="m14 5 1-2 1 2 2 1-2 1-1 2-1-2-2-1Z"/><path d="m19 12 .6 1.4L21 14l-1.4.6L19 16l-.6-1.4L17 14l1.4-.6Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
};
export const icon = (p: Page) => `<svg class="almo-ic" viewBox="0 0 24 24" aria-hidden="true">${IC[p]}</svg>`;

export const BAND_SKY: Record<string, string> = {
  "deep night": "linear-gradient(175deg,#070a1c,#161c3e)", "small hours": "linear-gradient(175deg,#0c1230,#252b58)", "pre-dawn": "linear-gradient(175deg,#1d2352,#5a4a78)",
  dawn: "linear-gradient(175deg,#3a3570,#e58b72)", sunrise: "linear-gradient(175deg,#6f7fb8,#ffc48a)", morning: "linear-gradient(175deg,#4f86c4,#9fc9e8)",
  midday: "linear-gradient(175deg,#3f86d0,#8cc3ea)", afternoon: "linear-gradient(175deg,#4a86c4,#a9c4dc)", "golden hour": "linear-gradient(175deg,#5b7cb4,#f0b865)",
  sunset: "linear-gradient(175deg,#4b3f7c,#e87a52)", dusk: "linear-gradient(175deg,#252459,#94507e)", evening: "linear-gradient(175deg,#141a44,#3b3566)",
};

const n = (x: number, one: string, many = `${one}s`) => `${x} ${x === 1 ? one : many}`;

/** A one-line summary per page, shown under its title and on the orbit. */
export function summary(p: Page, v: any): string {
  const w = v.world ?? {};
  const present = (v.cast ?? []).filter((c: any) => c.tier === "spot" || c.tier === "peri").length;
  switch (p) {
    case "now": return v.now?.time ? `Day ${v.now.day ?? "?"} · ${v.now.time}` : "not started";
    case "cast": return `${n((v.cast ?? []).length, "person", "people")} · ${present} present`;
    case "bonds": return n((v.bonds ?? []).length, "bond");
    case "knowledge": return n((v.knowledge ?? []).length, "fact");
    case "chronicle": {
      const c = v.chronicle?.counts ?? { chapter: v.counts?.chapters ?? 0 };
      return `${n(c.volume ?? 0, "volume")} · ${n(c.arc ?? 0, "arc")} · ${n(c.chapter ?? 0, "chapter")} · ${v.chronicle?.coverage?.raw ?? 100}% raw`;
    }
    case "timeline": return n((v.timeline ?? []).length, "milestone");
    case "world": {
      const due = dueCount(v);
      return `${n((w.threads ?? []).length, "thread")}${due ? ` · ${due} due` : ""}`;
    }
    case "elsewhere": {
      const x = v.elsewhere;
      if (!x || x.mode === "off") return "off";
      const live = (x.arcs ?? []).filter((a: any) => a.status === "running" || a.status === "held" || a.status === "fate").length;
      const fates = (x.arcs ?? []).filter((a: any) => a.status === "fate").length;
      return `${n(live, "subplot")}${fates ? ` · ${fates} waiting on you` : ""}`;
    }
    case "codex": return n((v.codex ?? []).length, "record");
    case "lore": {
      const books = Object.keys(v.lore?.books ?? {}).length;
      const review = v.lore?.review?.length ?? 0;
      return `${n(books, "book")}${review ? ` · ${review} to review` : ""}`;
    }
    case "creator": return "build a lorebook";
    case "recall": {
      const f = v.feed?.[0];
      return f ? `${f.items.filter((i: any) => i.injected).length} of ${f.items.length} injected` : "after the next reply";
    }
    case "craft": return v.telemetry?.technique ? `try: ${v.telemetry.technique}` : "after a few replies";
    case "settings": return v.enabled ? "Ledger on" : "Ledger off";
  }
}

function dueCount(v: any): number {
  const w = v.world ?? {};
  return (w.cons ?? []).filter((c: any) => c.status === "due").length + (w.deadlines ?? []).filter((d: any) => d.passed && !d.done).length;
}

/** The Engine's findings, one key each: unverified turns and rejected or corrected ledger lines. */
export function engineKeys(v: any): string[] {
  const checks = (v?.checks?.issues ?? []).filter((x: any) => x.level === "warn").map((x: any) => `c${v.checks.msg}:${x.text}`);
  return [...(v?.unverifiedIdx ?? []).map((i: number) => `u${i}`), ...(v?.rejected ?? []).map((r: any) => `r${r.msgIndex}:${r.raw}`), ...checks];
}

/** Engine findings the player hasn't looked at yet: each new unverified turn, plus one for any new rejected lines. */
export function engineNew(v: any, seen: ReadonlySet<string> = new Set()): number {
  const fresh = engineKeys(v).filter((k) => !seen.has(k));
  return fresh.filter((k) => k[0] === "u").length + (fresh.some((k) => k[0] === "r") ? 1 : 0) + (fresh.some((k) => k[0] === "c") ? 1 : 0);
}

/** Things that want a look, per group: shown as a glow and a count on the planet. */
export function attention(g: Group["id"], v: any, seen?: ReadonlySet<string>): number {
  if (!v) return 0;
  if (g === "story") return dueCount(v) + (v.elsewhere?.arcs ?? []).filter((a: any) => a.status === "fate").length;
  if (g === "library") return v.lore?.review?.length ?? 0;
  if (g === "engine") return engineNew(v, seen);
  return 0;
}

/** What a planet's count is for, in words: its tooltip, and the drawer tab's. */
export function attentionNote(g: Group["id"], v: any, seen?: ReadonlySet<string>): string {
  if (!v) return "";
  if (g === "story") {
    const due = dueCount(v);
    return due ? `${n(due, "promise or deadline", "promises and deadlines")} due or overdue` : "";
  }
  if (g === "library") {
    const r = v.lore?.review?.length ?? 0;
    return r ? `${n(r, "lorebook entry", "lorebook entries")} to review` : "";
  }
  if (g === "engine") {
    const fresh = engineKeys(v).filter((k) => !seen?.has(k));
    const u = fresh.filter((k) => k[0] === "u").length;
    const r = fresh.filter((k) => k[0] === "r").length;
    const c = fresh.filter((k) => k[0] === "c").length;
    return [
      c ? `the check found ${n(c, "slip", "slips")} in the last reply (see Recall)` : "",
      u ? `${n(u, "reply", "replies")} whose ledger had to be repaired or guessed (see the counts on Now)` : "",
      r ? `${n(r, "ledger line")} rejected or corrected (listed on Recall)` : "",
    ].filter(Boolean).join("; ");
  }
  return "";
}

function moon(m: any): string {
  if (!m) return "";
  const lit = Math.max(0, Math.min(1, Number(m.illumination ?? 0.5)));
  const dir = /wan/i.test(m.name ?? "") ? -1 : 1;
  const shadow = Math.round((1 - lit) * 34) * dir;
  return `<span class="almo-moon" style="--sh:${shadow}px" title="${e(m.name ?? "")}" aria-label="${e(m.name ?? "")}"></span>`;
}

/** The sky header: live clock, date, moon and scene chips, plus the sibling switcher. */
export function skyHeader(v: any, page: Page): string {
  const now = v.now ?? {};
  const sky = BAND_SKY[now.band] ?? BAND_SKY.evening;
  const clock = String(now.clock ?? "");
  const cut = clock.lastIndexOf(", ");
  const date = now.time && cut > 0 ? clock.slice(0, cut) : now.time ? clock : "The clock starts with the first scene";
  const [weekday, ...rest] = date.split(" ");
  const place = (now.place ?? []) as string[];
  const g = groupOf(page);
  const chips = [
    now.weather ? `${e(now.weather.glyph)} ${e(now.weather.text ?? now.weather.condition)}` : "",
    place.length ? `📍 ${e(place.slice(-2).join(" › "))}` : "",
    now.mode ? e(now.mode) : "",
  ].filter(Boolean);
  const rain = /rain|storm|drizzle|shower|sleet/i.test(now.weather?.condition ?? "") ? " almo-rain" : /snow/i.test(now.weather?.condition ?? "") ? " almo-snow" : "";
  const night = /night|hours|pre-dawn|evening|dusk/.test(now.band ?? "evening") ? " almo-night" : "";
  return `<header class="almo-sky${rain}${night}" style="background:${sky}">
  <div class="almo-sky__row"><div class="almo-clock">${e(now.time ?? "--:--")}</div><div class="almo-date">${rest.length ? `${e(weekday)}<br>${e(rest.join(" "))}` : e(date)}</div>${moon(now.moon)}</div>
  ${page === "now" && now.title ? `<div class="almo-title">${e(now.title)}</div>` : ""}
  ${chips.length ? `<div class="almo-chips">${chips.map((c) => `<span>${c}</span>`).join("")}</div>` : ""}
  ${g ? `<div class="almo-seg" role="tablist" aria-label="${e(g.label)}" style="--pc:${g.color}">${g.pages.map((p) => `<button role="tab" data-page="${p}" aria-selected="${p === page}">${icon(p)}<span>${LABEL[p]}</span></button>`).join("")}</div>` : ""}
</header>`;
}

export function pageTitle(v: any, page: Page): string {
  if (page === "now") return "";
  const g = groupOf(page);
  return `<div class="almo-head"><span class="almo-eyebrow" style="color:${g?.color}">${e(g?.label ?? "")}</span><h3>${LABEL[page]}</h3><small>${e(summary(page, v))}</small></div>`;
}

/** The dock, and the orbit of the open planet above it. */
export function dock(v: any, page: Page, orbit: string, seen?: ReadonlySet<string>): string {
  const cur = groupOf(page);
  const planet = (g: Group) => {
    const a = attention(g.id, v, seen);
    const why = a ? attentionNote(g.id, v, seen) : "";
    return `<button class="almo-pl${cur === g ? " on" : ""}${a ? " alert" : ""}" style="--pc:${g.color}" data-orbit="${g.id}" aria-expanded="${orbit === g.id}" aria-label="${e(g.label)}${why ? ` (${e(why)})` : ""}"${why ? ` title="${e(why)}"` : ""}><span class="almo-orb">${icon(g.icon)}${a ? `<b>${a > 9 ? "9+" : a}</b>` : ""}</span><span>${e(g.label)}</span></button>`;
  };
  const og = GROUPS.find((g) => g.id === orbit);
  // Three moons on an arc, or four (Story has Elsewhere too).
  const pos = og && og.pages.length > 3 ? [[0, 56], [70, 4], [140, 4], [210, 56]] : [[0, 50], [96, 0], [192, 50]];
  const ring = og
    ? `<div class="almo-orbit${og.pages.length > 3 ? " four" : ""}" style="--pc:${og.color}" role="menu" aria-label="${e(og.label)}">${og.pages.map((p, i) => `<button class="almo-moonb" role="menuitem" style="left:${pos[i][0]}px;top:${pos[i][1]}px;animation-delay:${i * 40}ms" data-page="${p}"><span class="almo-m">${icon(p)}</span><b>${LABEL[p]}</b><small>${e(v ? summary(p, v) : "")}</small></button>`).join("")}<div class="almo-orbit__t">${e(og.label)}</div></div>`
    : "";
  return `<div class="almo-dockwrap">${ring}<nav class="almo-dock" aria-label="Almanac pages">${planet(GROUPS[0])}${planet(GROUPS[1])}<button class="almo-sun${page === "now" ? " on" : ""}" data-page="now" aria-label="Now"><span>${icon("now")}<small>NOW</small></span></button>${planet(GROUPS[2])}${planet(GROUPS[3])}</nav></div>`;
}

/** Empty sky: no chat, still reading, or no answer from the backend. */
export function emptySky(status: string): string {
  const [title, text] = status === "nochat"
    ? ["No sky yet", "Open a chat to set the clock turning."]
    : status === "stalled"
      ? ["The Ledger hasn't answered", "Check that ALMANAC Ledger is enabled in Extensions and has its permissions, then retry."]
      : ["Reading this chat…", "Setting up the sky."];
  return `<div class="almo-empty"><div class="almo-dial${status === "waiting" ? " spin" : ""}"></div><h4>${title}</h4><p>${text}</p>${status === "stalled" ? `<button class="btn primary" data-act="retryState">Retry</button>` : ""}</div>`;
}
