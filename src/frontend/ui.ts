// Small parts the drawer's pages share (the "Night Almanac" look): stickers,
// section heads, toggles, dot meters, clock rings, person medals and icons.

import { escapeHtml as e, initials } from "../core/util";

const P: Record<string, string> = {
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.6M6.5 7.6A15.6 15.6 0 0 0 2.5 12S6 18 12 18a9 9 0 0 0 4-1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/>',
  bandage: '<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M11 11h.01M13 13h.01M11 13h.01M13 11h.01"/>',
  loop: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.3L20 15"/><path d="M20 20v-5h-5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  warn: '<path d="M12 4 2.5 20h19Z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  masks: '<path d="M4 5h9v6a4.5 4.5 0 0 1-9 0Z"/><path d="M6.5 8.5h1M9.5 8.5h1M6.5 12.5c1 1 2.5 1 4 0"/><path d="M14 9h6.5v5.5a4.5 4.5 0 0 1-6.8 3.9"/><path d="M16 12.5h1M18.5 12.5h1M16 16.5c1-.8 2.5-.8 3.5 0"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  speech: '<path d="M4 5h16v11H9l-5 4Z"/>',
  radio: '<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M7 9 17 4M8 14.5h.01M15 13v3"/>',
  door: '<path d="M6 21V4h12v17"/><path d="M3 21h18M14.5 12.5h.01"/>',
  house: '<path d="M4 11 12 4l8 7v9H4Z"/><path d="M10 20v-5h4v5"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7Z"/><path d="M11 13 20 4"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 5v14l11-7Z"/>',
  forward: '<path d="M5 6l7 6-7 6ZM13 6l7 6-7 6Z"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  crystal: '<circle cx="12" cy="10" r="6.5"/><path d="M7 19h10M8.5 16.5 7 19M15.5 16.5 17 19"/><path d="M9.5 8a3 3 0 0 1 2.5-1.5"/>',
  heart: '<path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10Z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  gem: '<path d="M6 4h12l3 5-9 11L3 9Z"/><path d="M3 9h18M9 4l3 16M15 4l-3 16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  sparkle: '<path d="m12 3 1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4Z"/><path d="m19 15 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19 13 11"/>',
  film: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 9h17M8 5l-2 4M13 5l-2 4M18 5l-2 4"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  thread: '<path d="M4 12c3-6 6-6 8 0s5 6 8 0"/>',
  bars: '<path d="M4 20h16M6 16V9M10 16V5M14 16v-6M18 16V8"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  pinned: '<path d="M9 4h6l-1 6 4 3H6l4-3Z"/><path d="M12 13v7"/>',
  book: '<path d="M7 4h11v13a3 3 0 0 1-3 3H6"/><path d="M10 9h5M10 12.5h5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4Z"/><path d="M8 9.5h8M8 12.5h5"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  quill: '<path d="M20 4c-7 1-12 6-13.5 13.5L5 20"/><path d="M20 4c-.5 5-3.5 9.5-9 11"/>',
};

/** An inline stroke icon. */
export const ic = (name: string, cls = "") => `<svg class="almx-ic${cls ? ` ${cls}` : ""}" viewBox="0 0 24 24" aria-hidden="true">${P[name] ?? ""}</svg>`;

export type Tone = "" | "g" | "good" | "warn" | "bad" | "acc" | "acc2" | "ghost" | "voice";

/** A status sticker: a word on a colour, tilted a little. */
export const stk = (text: string, tone: Tone = "", title = "") => `<span class="almx-stk${tone ? ` ${tone}` : ""}"${title ? ` title="${e(title)}"` : ""}>${e(text)}</span>`;

/** A section head: title, an optional count bubble and a quiet hint at the right. */
export const sec = (title: string, n?: number | string | null, hint = "", hintHtml = "") =>
  `<div class="almx-sec"><h4>${e(title)}</h4>${n != null && n !== "" ? `<span class="almx-n">${e(String(n))}</span>` : ""}${hint ? `<span class="almx-hint">${e(hint)}</span>` : hintHtml ? `<span class="almx-hint">${hintHtml}</span>` : ""}</div>`;

/** A row of buttons, one pressed: [value, label, extra attrs]. `act` is the data-act each sends with data-id. */
export function toggle(act: string, cur: string, opts: [string, string, string?][], label = ""): string {
  return `<div class="almx-tgl" role="group"${label ? ` aria-label="${e(label)}"` : ""}>${opts.map(([v, lab, extra]) => `<button type="button" data-act="${act}" data-id="${e(v)}" aria-pressed="${v === cur}"${extra ? ` ${extra}` : ""}>${lab}</button>`).join("")}</div>`;
}

/** Five little blocks, `n` of them lit (0..5). */
export const dots = (n: number, of = 5) => `<span class="almx-dots" role="img" aria-label="${Math.round(n)} of ${of}">${Array.from({ length: of }, (_, i) => `<i${i < Math.round(n) ? ' class="on"' : ""}></i>`).join("")}</span>`;

/** A clock ring: `cur` of `max` filled, with the count in the middle. */
export function ring(cur: number, max: number, color: string): string {
  const pct = Math.max(0, Math.min(100, Math.round((cur / Math.max(1, max)) * 100)));
  return `<span class="almx-ring" style="background:conic-gradient(${color} 0 ${pct}%,var(--alm-line) 0)"><span>${cur}/${max}</span></span>`;
}

/** A round medal with someone's initials in their colour. */
export const medal = (name: string, color = "", size: "" | "sm" | "lg" | "xs" = "", dim = false) =>
  `<span class="almx-medal${size ? ` ${size}` : ""}${dim ? " dim" : ""}" style="--c:${e(color || "var(--alm-muted)")}">${e(initials(name))}</span>`;

/** "1 thing", "2 things". */
export const n = (x: number, one: string, many = `${one}s`) => `${x} ${x === 1 ? one : many}`;
