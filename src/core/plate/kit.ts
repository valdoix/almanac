// The interiors' set dressing: small full-colour illustrations (furniture,
// lamps, plants, pets, curios) drawn at build time from a seed, each handed to
// CSS as an SVG image. Rooms place them on the plate (see ./rooms.ts); the
// plate darkens them at night through a mask of their own shape, so lamps and
// screens drawn beside them can still glow.
//
// Units: one unit is about one pixel of a 258px-tall plate. Light comes from
// the upper left: right faces and undersides are darker.
import { svgUrl, type Rng } from "./art";

const between = (r: Rng, a: number, b: number) => a + (b - a) * r();
const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const f = (v: number) => String(Math.round(v * 10) / 10);

const rgb = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
/** Mix two #rrggbb colours (t = share of b). */
export const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
export const dk = (c: string, t = 0.25) => mix(c, "#000000", t);
export const lt = (c: string, t = 0.25) => mix(c, "#ffffff", t);
/** #rrggbb plus an alpha 0..1 as #rrggbbaa. */
export const al = (c: string, a: number) => c.slice(0, 7) + Math.round(a * 255).toString(16).padStart(2, "0");

/** One illustration: an SVG canvas w×h with a tiny drawing API. */
export class Pic {
  out = ""; d = ""; g = 0;
  /** Consecutive shapes of one fill are merged into one path (smaller, same picture). */
  private pf = ""; private pd = "";
  /** Named points for overlays: glow (lamps, candles), steam (cups), fire, screen. */
  pts: Record<string, [number, number][]> = {};
  constructor(public w: number, public h: number) {}
  mark(k: string, x: number, y: number) { (this.pts[k] ??= []).push([x, y]); return this; }
  private flush() { if (this.pd) this.out += `<path d='${this.pd}' fill='${this.pf}'/>`; this.pd = ""; this.pf = ""; }
  private seg(d: string, fill: string) { if (fill !== this.pf) { this.flush(); this.pf = fill; } this.pd += d; return this; }
  private el(s: string) { this.flush(); this.out += s; return this; }
  /** The drawing so far (SVG elements). */
  get s() { this.flush(); return this.out; }
  rect(x: number, y: number, w: number, h: number, fill: string, rx = 0) {
    if (rx) return this.el(`<rect x='${f(x)}' y='${f(y)}' width='${f(w)}' height='${f(h)}' rx='${f(rx)}' fill='${fill}'/>`);
    return this.seg(`M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`, fill);
  }
  path(d: string, fill: string) { return this.seg(/^[Mm]/.test(d) ? d : `M${d}`, fill); }
  poly(p: number[], fill: string) { return this.seg(`M${p.map(f).join(" ")}Z`, fill); }
  ell(cx: number, cy: number, rx: number, ry: number, fill: string) { return this.seg(`M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0z`, fill); }
  circ(cx: number, cy: number, r: number, fill: string) { return fill === "none" ? this : this.ell(cx, cy, r, r, fill); }
  line(d: string, stroke: string, w: number) { return this.el(`<path d='${d}' fill='none' stroke='${stroke}' stroke-width='${f(w)}' stroke-linecap='round' stroke-linejoin='round'/>`); }
  /** Rotated ellipse (leaves, petals). */
  leaf(cx: number, cy: number, rx: number, ry: number, deg: number, fill: string) {
    const a = (deg * Math.PI) / 180, dx = Math.cos(a) * rx, dy = Math.sin(a) * rx;
    return this.seg(`M${f(cx - dx)} ${f(cy - dy)}A${f(rx)} ${f(ry)} ${f(deg)} 1 0 ${f(cx + dx)} ${f(cy + dy)}A${f(rx)} ${f(ry)} ${f(deg)} 1 0 ${f(cx - dx)} ${f(cy - dy)}z`, fill);
  }
  text(x: number, y: number, size: number, fill: string, t: string, extra = "") { return this.el(`<text x='${f(x)}' y='${f(y)}' font-size='${f(size)}' fill='${fill}' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-weight='700'${extra}>${t}</text>`); }
  raw(s: string) { return this.el(s); }
  /** Linear gradient (vertical by default); returns the fill reference. */
  lin(cols: string[], horiz = false) {
    const id = `g${this.g++}`;
    this.d += `<linearGradient id='${id}'${horiz ? "" : " x2='0' y2='1'"}>${cols.map((c, i) => `<stop offset='${f(i / Math.max(1, cols.length - 1))}' stop-color='${c}'/>`).join("")}</linearGradient>`;
    return `url(#${id})`;
  }
  rad(cols: string[], cx = 0.5, cy = 0.5) {
    const id = `g${this.g++}`;
    this.d += `<radialGradient id='${id}' cx='${cx}' cy='${cy}' r='.5'>${cols.map((c, i) => `<stop offset='${f(i / Math.max(1, cols.length - 1))}' stop-color='${c}'/>`).join("")}</radialGradient>`;
    return `url(#${id})`;
  }
  /** A shaded box: face, lit top edge, shaded right side. */
  box(x: number, y: number, w: number, h: number, c: string, rx = 0) {
    this.rect(x, y, w, h, c, rx);
    this.rect(x, y, w, Math.min(3, h * 0.2), lt(c, 0.18), rx);
    this.rect(x + w - Math.min(4, w * 0.12), y, Math.min(4, w * 0.12), h, dk(c, 0.2));
    return this;
  }
  private get body() { return `${this.d ? `<defs>${this.d}</defs>` : ""}${this.s}`.replace(/(\d+\.\d)\d+/g, "$1"); }
  get url() { return svgUrl(this.body, this.w, this.h); }
  /** Stretched to its box (curtains, wide bands). */
  get urlFill() { return svgUrl(this.body, this.w, this.h, true); }
}

// ── Palettes ────────────────────────────────────────────────────────────────
export const WOOD = { oak: "#8a5a32", walnut: "#5a3820", pine: "#b07a44", mahogany: "#6a2a1c", ebony: "#2a1e1a", ash: "#c8a678", painted: "#e8e0d0" };
export const BOOKS = ["#7a2e2a", "#2f4a3a", "#a8742c", "#3b3556", "#8a4a22", "#26405e", "#5e2430", "#4d5a2a", "#b49a6a", "#2a2a30", "#9a3a2a", "#1f5a5a"];
const GOLD = "#d9b45a", BRASS = "#c39a4a", IRON = "#2a2a2e", GLASS = "#cfe6ee";

// ── Books, shelves and storage ───────────────────────────────────────────────
function books(p: Pic, r: Rng, x0: number, x1: number, base: number, maxH: number, gaps = true) {
  // one path per colour keeps a full bookcase small
  const by = new Map<string, string>(), add = (c: string, x: number, y: number, w: number, h: number) => by.set(c, (by.get(c) ?? "") + `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`);
  let x = x0;
  while (x < x1 - 4) {
    const bw = Math.min(between(r, 4.5, 10), x1 - x), bh = maxH * between(r, 0.62, 0.97), c = pick(r, BOOKS);
    const roll = r();
    if (gaps && roll < 0.06 && x1 - x > 16) {
      // a curio: jar, skull-white vase or small globe
      const k = Math.floor(r() * 3), cx = x + 7;
      if (k === 0) { p.rect(cx - 5, base - 13, 10, 13, al(GLASS, 0.55), 2); p.rect(cx - 5, base - 8, 10, 8, pick(r, ["#a8582a", "#5a8a3a", "#7a3a6a"]), 2); p.rect(cx - 4, base - 15, 8, 3, BRASS); }
      else if (k === 1) { p.path(`M${cx - 4} ${base}Q${cx - 7} ${base - 9} ${cx - 2} ${base - 13}H${cx + 2}Q${cx + 7} ${base - 9} ${cx + 4} ${base}Z`, pick(r, ["#2a5a8a", "#c8b89a", "#8a2a3a"])); }
      else { p.circ(cx, base - 9, 6, "#3a7a9a"); p.path(`M${cx - 3} ${base - 12}q3 -2 5 1q-1 3 -4 2z`, "#6aa04a"); p.rect(cx - 3, base - 2, 6, 2, BRASS); }
      x += 15;
      continue;
    }
    if (roll < 0.12 && x1 - x > 14) {
      // a leaning book
      p.poly([x, base, x + bw, base, x + bw + bh * 0.35, base - bh * 0.94, x + bh * 0.35, base - bh * 0.94], c);
      x += bw + bh * 0.35 + 1;
      continue;
    }
    add(c, x, base - bh, bw, bh);
    add("#ffffff33", x, base - bh, 1.2, bh);
    if (r() < 0.55) { add(GOLD, x, base - bh + 3, bw, 1.4); add(GOLD, x, base - 5, bw, 1.2); }
    if (r() < 0.2) add("#ffffff55", x + 1.5, base - bh * 0.62, bw - 3, bh * 0.16);
    x += bw + (r() < 0.15 ? 0.8 : 0.2);
  }
  for (const k of [...by.keys()].sort((a, b) => (a.length > 7 ? 1 : 0) - (b.length > 7 ? 1 : 0) || (a === GOLD ? 1 : 0) - (b === GOLD ? 1 : 0))) p.path(by.get(k)!, k);
}
export function bookcase(r: Rng, wood: string, w = 110, h = 190, shelves = 4, top: "plant" | "globe" | "candle" | "bust" | "none" = "none") {
  const T = top === "none" ? 0 : 26, p = new Pic(w, h + T);
  p.rect(2, T + 4, w - 4, h - 4, wood);
  p.rect(0, T, w, 7, lt(wood, 0.12));
  p.rect(0, T + 6, w, 2, dk(wood, 0.35));
  p.rect(7, T + 12, w - 14, h - 18, dk(wood, 0.62));
  const sh = (h - 18) / shelves;
  for (let i = 0; i < shelves; i++) {
    const y0 = T + 12 + i * sh, base = y0 + sh - 5;
    books(p, r, 9, w - 9, base, sh - 9);
    p.rect(7, y0, w - 14, 4, "#00000055");
    p.rect(5, base, w - 10, 5, wood);
    p.rect(5, base, w - 10, 1.3, lt(wood, 0.3));
  }
  p.rect(w - 9, T + 8, 7, h - 8, dk(wood, 0.22));
  p.rect(0, T + h - 6, w, 6, dk(wood, 0.15));
  if (top === "plant") { const c = w * 0.25; p.path(`M${c - 9} ${T}l2 -12h14l2 12z`, "#b8643a"); for (let i = 0; i < 7; i++) p.leaf(c + between(r, -12, 12), T - 14 - between(r, 0, 8), 8, 3.4, between(r, -60, 60), i % 2 ? "#4a8a4a" : "#3a7a3e"); for (let i = 0; i < 4; i++) p.leaf(c + 14 + i * 5, T + 6 + i * 9, 4, 2.4, 40, "#4a8a4a"); }
  if (top === "globe") { const c = w * 0.7; p.rect(c - 7, T - 3, 14, 3, BRASS); p.rect(c - 1, T - 8, 2, 6, BRASS); p.circ(c, T - 17, 10, "#3a7a9a"); p.path(`M${c - 6} ${T - 21}q4 -3 7 1q-2 5 -6 3zM${c + 2} ${T - 13}q4 0 4 3q-3 2 -4 0z`, "#7aa04a"); p.line(`M${c - 12} ${T - 17}a12 12 0 0 1 24 0`, BRASS, 1.5); }
  if (top === "candle") { const c = w * 0.72; p.rect(c - 7, T - 2, 14, 2, BRASS); p.rect(c - 3, T - 18, 6, 16, "#efe6d0"); p.ell(c, T - 22, 2.4, 4, "#ffcf6a"); p.path(`M${c - 3} ${T - 18}q1 4 1 7v-7z`, "#d8ccb4"); }
  if (top === "bust") { const c = w * 0.3; p.rect(c - 9, T - 5, 18, 5, "#d8d2c8"); p.path(`M${c - 12} ${T - 5}q2 -9 12 -10q10 1 12 10z`, "#e8e2d8"); p.ell(c, T - 20, 6, 7.5, "#ece6dc"); p.path(`M${c + 3} ${T - 27}q5 4 2 10l-2 -2z`, "#cfc8bc"); }
  return p;
}
export function ladder(wood: string, h = 200) {
  const p = new Pic(44, h);
  p.line(`M6 ${h}L26 0M22 ${h}L42 0`, wood, 4);
  for (let y = 18; y < h; y += 22) { const t = y / h; p.line(`M${6 + 20 * (1 - t)} ${y}H${22 + 20 * (1 - t)}`, dk(wood, 0.15), 3); }
  p.line(`M24 2h20`, BRASS, 3);
  return p;
}
export function jarShelf(r: Rng, wood: string, w = 170, rows = 2, kind: "jars" | "potions" | "goods" | "plates" = "jars") {
  const rh = 46, p = new Pic(w, rows * rh + 8);
  for (let j = 0; j < rows; j++) {
    const base = (j + 1) * rh;
    let x = 6;
    while (x < w - 16) {
      if (kind === "plates") { const s = between(r, 13, 17), c = pick(r, ["#e8eef4", "#2a5a9a", "#f0e8d8"]); p.circ(x + s, base - s - 2, s, c); p.circ(x + s, base - s - 2, s * 0.62, c === "#2a5a9a" ? "#f0f0f0" : "#5a7aaa"); p.circ(x + s, base - s - 2, s * 0.5, c); x += 2 * s + 4; continue; }
      if (kind === "potions") {
        const c = pick(r, ["#7aff9a", "#ff6ad0", "#6ad8ff", "#ffcf4a", "#b06aff", "#ff7a4a"]), sh = Math.floor(r() * 3);
        if (sh === 0) { p.circ(x + 9, base - 10, 10, al(GLASS, 0.5)); p.circ(x + 9, base - 9, 8.5, c); p.rect(x + 6, base - 27, 6, 9, al(GLASS, 0.6)); p.rect(x + 5.5, base - 30, 7, 4, "#8a5a32"); p.circ(x + 6, base - 13, 2.5, "#ffffffaa"); x += 22; }
        else if (sh === 1) { p.path(`M${x + 2} ${base}l5 -18v-10h6v10l5 18z`, al(GLASS, 0.5)); p.path(`M${x + 3} ${base}l3.5 -12h10l3.5 12z`, c); p.rect(x + 7, base - 32, 6, 4, "#5a3a2a"); x += 22; }
        else { p.rect(x + 2, base - 24, 12, 24, al(GLASS, 0.5), 3); p.rect(x + 2, base - 15, 12, 15, c, 3); p.rect(x + 4, base - 28, 8, 4, "#3a2a1a"); p.rect(x + 3, base - 21, 10, 5, "#efe6cf"); x += 17; }
        continue;
      }
      if (kind === "goods") {
        const t = Math.floor(r() * 3), c = pick(r, ["#c84a3a", "#3a7ab8", "#e8b84a", "#5a9a5a", "#efe6d6", "#8a4a8a"]);
        if (t === 0) { const bw = between(r, 14, 22), bh = between(r, 16, 30); p.box(x, base - bh, bw, bh, c); p.rect(x + 2, base - bh * 0.7, bw - 5, bh * 0.3, lt(c, 0.6)); x += bw + 2; }
        else if (t === 1) { p.rect(x, base - 20, 12, 20, c, 2); p.rect(x, base - 14, 12, 7, "#f4efe4"); p.rect(x + 1, base - 22, 10, 3, "#888"); x += 14; }
        else { p.path(`M${x} ${base}V${base - 14}q0 -6 6 -8v-6h4v6q6 2 6 8V${base}z`, c); p.rect(x + 2, base - 11, 12, 6, "#f4efe4"); x += 18; }
        continue;
      }
      const jw = between(r, 14, 22), jh = between(r, 18, 34), c = pick(r, ["#c8742a", "#8a3a2a", "#6a8a3a", "#d8b44a", "#a85a6a", "#4a6a3a", "#e8d8b0"]);
      p.rect(x, base - jh, jw, jh, al(GLASS, 0.45), 4);
      p.rect(x + 1, base - jh * 0.75, jw - 2, jh * 0.75, c, 3);
      p.rect(x + 2, base - jh * 0.6, jw - 4, jh * 0.28, "#efe6cfdd");
      p.rect(x - 1, base - jh - 4, jw + 2, 5, pick(r, ["#8a5a32", "#c84a3a", "#e8e0d0"]), 1.5);
      p.rect(x + 2, base - jh + 2, 2, jh - 6, "#ffffff55");
      x += jw + between(r, 2, 6);
    }
    p.rect(0, base, w, 6, wood);
    p.rect(0, base, w, 1.5, lt(wood, 0.3));
    p.path(`M8 ${base + 6}l6 8h3l-3 -8zM${w - 8} ${base + 6}l-6 8h-3l3 -8z`, dk(wood, 0.2));
  }
  return p;
}
export function bottleShelf(r: Rng, wood: string, w = 210) {
  const p = new Pic(w, 120);
  p.rect(0, 0, w, 120, dk(wood, 0.55));
  p.rect(6, 6, w - 12, 108, p.lin(["#5a6a70", "#2a3236", "#4a585e"], true));
  p.rect(6, 6, w - 12, 108, "#00000066");
  for (const base of [54, 108]) {
    let x = 10;
    while (x < w - 16) {
      const c = pick(r, ["#2a5a2a", "#7a4a12", "#c89a3a", "#d8e8e0", "#5a1a2a", "#1a3a5a", "#a86a1a"]), k = Math.floor(r() * 4), bh = between(r, 30, 44);
      if (k === 0) { p.path(`M${x} ${base}V${base - bh * 0.6}q0 -6 5 -8V${base - bh}h4V${base - bh * 0.6 + -2}q5 2 5 8V${base}z`, c); }
      else if (k === 1) { p.rect(x, base - bh * 0.62, 14, bh * 0.62, c, 2); p.rect(x + 4, base - bh, 6, bh * 0.4, c); }
      else if (k === 2) { p.path(`M${x} ${base}q0 -18 7 -20V${base - bh}h0V${base - 20}q7 2 7 20z`, c); p.rect(x + 5, base - bh, 4, bh - 18, c); }
      else { p.rect(x, base - bh * 0.5, 14, bh * 0.5, c, 6); p.rect(x + 5, base - bh * 0.75, 4, bh * 0.3, c); }
      p.rect(x + 2, base - bh * 0.42, 10, bh * 0.2, pick(r, ["#efe6cf", "#d8c08a", "#1a1a1a"]));
      p.rect(x + 2, base - bh * 0.58, 1.5, bh * 0.5, "#ffffff44");
      x += 16 + between(r, 0, 3);
    }
    p.rect(0, base, w, 6, wood); p.rect(0, base, w, 1.5, lt(wood, 0.3));
  }
  return p;
}
export function crates(r: Rng, n = 3) {
  const p = new Pic(130, 96), c = "#a87a46";
  const one = (x: number, y: number, s: number) => {
    p.box(x, y, 50 * s, 40 * s, c);
    for (let k = 1; k < 4; k++) p.rect(x, y + k * 10 * s, 50 * s, 1, dk(c, 0.3));
    p.line(`M${x + 3} ${y + 3}L${x + 50 * s - 4} ${y + 40 * s - 3}`, dk(c, 0.15), 4 * s);
    p.rect(x, y, 4 * s, 40 * s, dk(c, 0.12)); p.rect(x + 46 * s, y, 4 * s, 40 * s, dk(c, 0.25));
  };
  one(4, 56, 1); one(60, 50, 1.15);
  if (n > 2) one(24 + r() * 10, 16, 1);
  return p;
}
export function barrels(r: Rng, rows = 2, wood = "#7a4a26") {
  const w = 70 * (rows + 1), p = new Pic(w, rows * 62 + 4);
  for (let j = 0; j < rows; j++) for (let i = 0; i < rows + 1 - j; i++) {
    const cx = 36 + i * 68 + j * 34, cy = (rows - j) * 62 - 30, R = 30;
    p.circ(cx, cy, R, dk(wood, 0.35));
    p.circ(cx, cy, R - 4, wood);
    for (let k = 1; k < 4; k++) p.circ(cx, cy, R - 4 - k * 6, k % 2 ? dk(wood, 0.12) : lt(wood, 0.06));
    p.line(`M${cx - R + 4} ${cy}H${cx + R - 4}`, dk(wood, 0.3), 1);
    p.circ(cx, cy, R - 1, "none");
    p.raw(`<circle cx='${cx}' cy='${cy}' r='${R - 2}' fill='none' stroke='${IRON}' stroke-width='3'/>`);
    if (r() < 0.6) { p.rect(cx - 3, cy + 10, 6, 10, BRASS, 1); p.rect(cx - 6, cy + 16, 12, 3, BRASS); }
    if (r() < 0.5) p.text(cx, cy - 6, 9, dk(wood, 0.5), pick(r, ["XXX", "ALE", "1792", "RUM", "♣"]));
  }
  return p;
}
export function standingBarrel(wood = "#7a4a26") {
  const p = new Pic(56, 70);
  p.path("M4 6Q0 35 4 64Q28 70 52 64Q56 35 52 6Q28 0 4 6Z", wood);
  for (const y of [14, 54]) p.line(`M3 ${y}Q28 ${y + 4} 53 ${y}`, IRON, 3);
  p.ell(28, 6, 24, 5, lt(wood, 0.15));
  p.path("M40 8Q46 35 42 64Q48 63 52 64Q56 35 52 6Z", dk(wood, 0.25));
  return p;
}

// ── Seating and beds ─────────────────────────────────────────────────────────
export function armchair(fab: string, wood: string, wing = true) {
  const p = new Pic(120, 112), d = dk(fab, 0.22);
  p.path(wing ? "M20 70V22Q20 6 40 6H80Q100 6 100 22V70Z" : "M22 72V30Q22 14 40 14H80Q98 14 98 30V72Z", fab);
  for (const x of [44, 60, 76]) for (const y of [26, 42]) p.circ(x, y, 1.6, d);
  if (wing) p.path("M14 76V30Q14 18 26 20V70ZM106 76V30Q106 18 94 20V70Z", d);
  p.rect(26, 62, 68, 20, lt(fab, 0.12), 6);
  p.rect(6, 54, 24, 46, fab, 10); p.rect(90, 54, 24, 46, d, 10);
  p.rect(8, 56, 20, 6, lt(fab, 0.2), 3);
  p.rect(26, 80, 68, 20, d, 3);
  p.rect(14, 98, 92, 4, dk(fab, 0.4));
  p.rect(12, 100, 7, 12, wood, 2); p.rect(101, 100, 7, 12, dk(wood, 0.2), 2);
  return p;
}
export function sofa(r: Rng, fab: string, pillows: string[] = ["#e8c46a", "#c8584a"]) {
  const p = new Pic(230, 100), d = dk(fab, 0.22);
  p.rect(18, 10, 194, 56, fab, 14);
  p.rect(18, 10, 194, 6, lt(fab, 0.15), 6);
  p.rect(24, 48, 182, 22, lt(fab, 0.1), 6);
  p.line("M115 18V66", d, 1.5);
  p.rect(2, 36, 30, 52, fab, 12); p.rect(198, 36, 30, 52, d, 12);
  p.rect(4, 38, 26, 7, lt(fab, 0.2), 4);
  p.rect(26, 66, 178, 22, d, 4);
  pillows.forEach((c, i) => { const x = i ? 168 : 36; p.path(`M${x} 50Q${x - 2} 30 ${x + 4} 26Q${x + 14} 22 ${x + 24} 26Q${x + 30} 30 ${x + 28} 50Q${x + 14} 54 ${x} 50Z`, c); p.line(`M${x + 6} 30Q${x + 14} 40 ${x + 22} 30`, dk(c, 0.2), 1.2); });
  if (r() < 0.6) { const c = pick(r, ["#5a7a9a", "#9a5a7a", "#7a8a5a"]); p.path("M130 48Q150 44 170 50L176 90H140Z", c); for (let y = 56; y < 88; y += 7) p.line(`M138 ${y}H174`, lt(c, 0.25), 1.5); }
  p.rect(12, 86, 6, 12, "#3a2a1a"); p.rect(212, 86, 6, 12, "#2a1a10");
  return p;
}
export function bed(r: Rng, frame: string, quilt: string, sheet = "#efe8dc") {
  const p = new Pic(250, 120), q2 = pick(r, ["#e8c46a", "#efe6d6", "#7a9ac8", "#c87a8a"]);
  p.path("M4 120V22Q4 4 24 4Q44 4 44 22V120Z", frame);
  p.path("M10 50V24Q10 10 24 10Q38 10 38 24V50Z", lt(frame, 0.12));
  p.rect(36, 64, 202, 34, sheet, 4);
  p.path("M44 66Q42 46 58 44H96Q106 46 104 66Z", "#f6f2ea");
  p.line("M52 52Q74 58 98 52", "#d8d2c6", 1.2);
  p.path("M104 60Q170 54 240 62L244 100Q170 106 104 100Z", quilt);
  for (let x = 116; x < 236; x += 18) for (let y = 64; y < 98; y += 14) if (((x + y) / 2) % 2 < 1) p.rect(x, y, 9, 7, q2);
  p.path("M104 60Q170 54 240 62L240 66Q170 58 104 64Z", lt(quilt, 0.2));
  p.rect(36, 98, 206, 8, dk(frame, 0.15));
  p.path("M230 120V56Q230 46 240 46Q250 46 250 56V120Z", frame);
  p.rect(42, 106, 6, 14, dk(frame, 0.2)); p.rect(220, 106, 6, 14, dk(frame, 0.3));
  return p;
}
export function bench(wood: string, w = 150) {
  const p = new Pic(w, 46);
  p.rect(0, 10, w, 8, wood, 2); p.rect(0, 10, w, 2, lt(wood, 0.2));
  p.rect(10, 18, 7, 28, dk(wood, 0.2)); p.rect(w - 17, 18, 7, 28, dk(wood, 0.3));
  return p;
}
export function stool(top: string, metal = "#b8bcc4", h = 70) {
  const p = new Pic(40, h);
  p.ell(20, 8, 18, 7, top); p.ell(20, 6, 18, 6, lt(top, 0.15));
  p.rect(18, 12, 4, h - 14, metal); p.ell(20, h - 3, 13, 3, metal);
  p.ell(20, h * 0.65, 10, 2.5, "none"); p.raw(`<ellipse cx='20' cy='${f(h * 0.65)}' rx='10' ry='2.5' fill='none' stroke='${metal}' stroke-width='2'/>`);
  return p;
}
export function chair(wood: string, seat = wood) {
  const p = new Pic(54, 100);
  p.rect(6, 2, 6, 96, wood, 2); p.rect(42, 2, 6, 60, dk(wood, 0.2), 2);
  for (const y of [8, 22, 36]) p.rect(10, y, 34, 5, wood, 2);
  p.rect(2, 56, 50, 8, seat, 2); p.rect(2, 56, 50, 2, lt(seat, 0.2));
  p.rect(40, 62, 6, 36, dk(wood, 0.3)); p.rect(6, 62, 6, 36, dk(wood, 0.1));
  return p;
}

// ── Tables and surfaces ──────────────────────────────────────────────────────
export type Item = "candle" | "bottle" | "glass" | "mug" | "teapot" | "vase" | "books" | "fruit" | "lamp" | "banker" | "typewriter" | "computer" | "laptop" | "papers" | "skull" | "plant" | "register" | "radio" | "tankard" | "cake" | "map" | "chess";
/** Items standing on a surface at y = base, starting at x; returns their glow points (x, y) for lamps and candles. */
export function items(p: Pic, r: Rng, list: Item[], x0: number, x1: number, base: number) {
  const step = (x1 - x0) / list.length;
  list.forEach((it, i) => {
    const x = x0 + step * i + step / 2 + between(r, -step * 0.15, step * 0.15);
    switch (it) {
      case "candle": p.rect(x - 7, base - 3, 14, 3, BRASS); p.rect(x - 3, base - 20, 6, 17, "#f2ead6"); p.path(`M${x - 3} ${base - 20}q1 5 1 9v-9z`, "#d8ccb4"); p.ell(x, base - 24, 2.2, 4, "#ffcf6a"); p.ell(x, base - 23, 1, 2, "#fff6d0"); p.mark("glow", x, base - 24); break;
      case "bottle": { const c = pick(r, ["#2a5a2a", "#5a1a2a", "#7a4a12"]); p.path(`M${x - 6} ${base}V${base - 22}q0 -6 4 -8v-10h4v10q4 2 4 8V${base}z`, c); p.rect(x - 5, base - 16, 10, 8, "#efe6cf"); p.rect(x - 2, base - 42, 4, 3, "#c84a3a"); p.rect(x - 4.5, base - 26, 1.5, 22, "#ffffff40"); break; }
      case "glass": p.path(`M${x - 6} ${base - 26}h12q0 10 -5 12v10h4v4h-10v-4h4v-10q-5 -2 -5 -12z`, al(GLASS, 0.6)); p.path(`M${x - 5.5} ${base - 22}h11q-1 6 -5.5 7q-4.5 -1 -5.5 -7z`, "#8a1a2a"); break;
      case "mug": { const c = pick(r, ["#e8e0d0", "#c84a3a", "#3a6a9a", "#e8b84a"]); p.mark("steam", x, base - 16); p.rect(x - 7, base - 14, 14, 14, c, 2); p.path(`M${x + 7} ${base - 11}a4 4 0 0 1 0 8`, "none"); p.line(`M${x + 7} ${base - 11}q6 0 6 4q0 4 -6 4`, c, 2.5); p.rect(x - 6, base - 13, 2, 11, "#ffffff55"); break; }
      case "tankard": p.rect(x - 8, base - 20, 16, 20, "#8a8e96", 2); p.rect(x - 9, base - 22, 18, 4, "#a8acb4", 2); p.line(`M${x + 8} ${base - 16}q7 0 7 6q0 6 -7 6`, "#8a8e96", 3); p.ell(x, base - 23, 8, 3, "#f4ecd8"); p.rect(x - 8, base - 12, 16, 2, "#6a6e76"); break;
      case "teapot": p.mark("steam", x + 20, base - 22); p.ell(x, base - 10, 13, 10, "#f0ece4"); p.path(`M${x + 12} ${base - 12}l9 -8l1 2l-7 10z`, "#f0ece4"); p.line(`M${x - 12} ${base - 14}q-8 0 -7 6q1 4 6 3`, "#f0ece4", 2.5); p.ell(x, base - 20, 6, 2, "#d8d2c6"); p.circ(x, base - 22, 2, "#3a6a9a"); p.line(`M${x - 8} ${base - 9}q8 4 16 0`, "#3a6a9a", 1.5); break;
      case "vase": { const c = pick(r, ["#3a5a8a", "#c8b48a", "#8a3a4a", "#e8e4dc"]); p.path(`M${x - 5} ${base}q-6 -10 -1 -18h12q5 8 -1 18z`, c); for (let k = 0; k < 6; k++) { const a = -1 + k * 0.4, ex = x + Math.sin(a) * 18, ey = base - 26 - Math.cos(a) * 12; p.line(`M${x} ${base - 16}Q${x + Math.sin(a) * 8} ${base - 26} ${ex} ${ey}`, "#4a7a3a", 1.2); p.circ(ex, ey, 3.5, pick(r, ["#e85a6a", "#f4c84a", "#f0f0f0", "#c86ad8", "#ff8a4a"])); p.circ(ex, ey, 1.3, "#ffe08a"); } break; }
      case "books": for (let k = 0; k < 3 + Math.floor(r() * 2); k++) { const c = pick(r, BOOKS), w = between(r, 22, 30); p.rect(x - w / 2 + between(r, -2, 2), base - 5 * (k + 1), w, 5, c, 1); p.rect(x - w / 2 + 1, base - 5 * (k + 1) + 1, w - 3, 1.2, "#efe6cf"); } break;
      case "fruit": p.path(`M${x - 14} ${base - 8}q14 12 28 0z`, "#c8a46a"); for (const [dx, c] of [[-7, "#d83a2a"], [0, "#f0a02a"], [7, "#6aa03a"], [-3, "#e8c43a"]] as [number, string][]) p.circ(x + dx, base - 11 - (dx === -3 ? 5 : 0), 5, c); break;
      case "lamp": { const c = pick(r, ["#f0d8a0", "#e8c0a0", "#d8e0c8"]); p.path(`M${x - 6} ${base}q-2 -6 2 -14h8q4 8 2 14z`, "#c8a46a"); p.rect(x - 1, base - 26, 2, 12, BRASS); p.path(`M${x - 12} ${base - 26}l4 -16h16l4 16z`, c); p.path(`M${x - 12} ${base - 26}l4 -16h3l-3 16z`, lt(c, 0.3)); p.mark("glow", x, base - 30); break; }
      case "banker": p.rect(x - 9, base - 4, 18, 4, BRASS, 1); p.rect(x - 1, base - 16, 2, 12, BRASS); p.path(`M${x - 16} ${base - 16}q0 -9 16 -9q16 0 16 9z`, "#1f6a3a"); p.path(`M${x - 13} ${base - 18}q4 -5 13 -5`, "none"); p.line(`M${x - 12} ${base - 19}q5 -4 12 -4`, "#6aba7a", 1.5); p.mark("glow", x, base - 14); break;
      case "typewriter": p.path(`M${x - 22} ${base}l4 -14h36l4 14z`, "#2a2a2e"); p.rect(x - 18, base - 22, 36, 9, "#3a3a40", 2); p.rect(x - 24, base - 24, 48, 4, "#1a1a1e", 2); p.rect(x - 12, base - 38, 24, 16, "#f4efe4"); for (let k = 0; k < 3; k++) p.rect(x - 9, base - 35 + k * 4, 18 - k * 5, 1.2, "#8a8a8a"); for (let k = 0; k < 8; k++) p.circ(x - 14 + k * 4, base - 6, 1.3, "#d8d8d8"); break;
      case "computer": p.mark("screen", x, base - 25); p.rect(x - 22, base - 40, 44, 30, "#1a1c22", 3); p.rect(x - 19, base - 37, 38, 24, "#2a4a6a"); p.rect(x - 19, base - 37, 38, 24, p.lin(["#5ab0e8", "#1a3a6a"])); for (let k = 0; k < 4; k++) p.rect(x - 15, base - 33 + k * 5, 10 + ((k * 7) % 16), 2, "#d8f0ff99"); p.rect(x - 3, base - 10, 6, 6, "#2a2c32"); p.rect(x - 12, base - 4, 24, 4, "#2a2c32", 1); p.rect(x + 16, base - 4, 22, 3, "#d8dade", 1); p.mark("glow", x, base - 25); break;
      case "laptop": p.path(`M${x - 18} ${base - 2}l3 -26h30l3 26z`, "#c8ccd4"); p.path(`M${x - 15} ${base - 5}l2.5 -21h25l2.5 21z`, "#6ac0ff"); p.rect(x - 22, base - 3, 44, 3, "#a8acb4", 1); p.mark("glow", x, base - 16); break;
      case "papers": for (let k = 0; k < 4; k++) p.rect(x - 14 + k * 2, base - 2 - k * 1.5, 26, 2, k % 2 ? "#f4efe4" : "#e4dccb"); p.rect(x + 2, base - 9, 16, 3, "#1a1a1a", 1); p.rect(x + 14, base - 9, 4, 3, BRASS); break;
      case "skull": p.circ(x, base - 11, 9, "#ece4d0"); p.rect(x - 5, base - 5, 10, 5, "#ece4d0", 2); p.ell(x - 3.5, base - 11, 2.6, 3, "#3a2a20"); p.ell(x + 3.5, base - 11, 2.6, 3, "#3a2a20"); p.rect(x - 0.6, base - 7, 1.2, 2.4, "#3a2a20"); p.rect(x + 2, base - 22, 3, 7, "#f2ead6"); p.ell(x + 3.5, base - 25, 1.6, 3, "#ffcf6a"); p.mark("glow", x + 3.5, base - 25); break;
      case "plant": p.path(`M${x - 7} ${base}l-2 -12h18l-2 12z`, "#c06a3a"); for (let k = 0; k < 6; k++) p.leaf(x + between(r, -8, 8), base - 16 - between(r, 0, 10), 7, 3, between(r, -70, 70), k % 2 ? "#4a8a4a" : "#3a7a42"); break;
      case "register": p.path(`M${x - 20} ${base}l3 -22h34l3 22z`, "#b88a3a"); p.rect(x - 14, base - 34, 28, 12, "#d8aa4a", 2); p.rect(x - 9, base - 32, 18, 6, "#1a2a1a"); p.text(x, base - 27.5, 6, "#7aff9a", "0.42"); for (let k = 0; k < 6; k++) p.circ(x - 12 + k * 5, base - 14, 1.8, "#f4efe4"); for (let k = 0; k < 6; k++) p.circ(x - 12 + k * 5, base - 8, 1.8, "#f4efe4"); break;
      case "radio": p.rect(x - 18, base - 26, 36, 26, "#8a5a32", 8); p.rect(x - 14, base - 22, 18, 16, "#d8c08a", 3); for (let k = 0; k < 4; k++) p.rect(x - 13, base - 20 + k * 4, 16, 1.5, "#8a5a32"); p.circ(x + 10, base - 17, 4, "#3a2a1a"); p.circ(x + 10, base - 7, 3, "#3a2a1a"); break;
      case "cake": p.rect(x - 6, base - 2, 12, 2, "#d8d8d8"); p.rect(x - 16, base - 4, 32, 4, "#e8e8e8", 2); p.rect(x - 13, base - 18, 26, 14, "#f0d8b8", 2); p.rect(x - 13, base - 18, 26, 4, "#f8f0f0", 2); p.rect(x - 13, base - 12, 26, 2.5, "#c8486a"); p.circ(x, base - 21, 3, "#d8283a"); break;
      case "map": p.path(`M${x - 26} ${base - 1}l4 -6h44l4 6z`, "#e8d8a8"); p.line(`M${x - 18} ${base - 4}q8 -2 12 0t14 -1`, "#8a4a2a", 1); p.circ(x + 10, base - 4, 1.5, "#c82a2a"); break;
      case "chess": p.rect(x - 22, base - 4, 44, 4, "#1a1a1a"); for (let k = 0; k < 8; k++) p.rect(x - 22 + k * 5.5, base - 4, 2.75, 2, "#f0e8d8"); for (const [dx, c, h] of [[-14, "#f0e8d8", 12], [-6, "#f0e8d8", 9], [6, "#2a2a2a", 14], [14, "#2a2a2a", 9]] as [number, string, number][]) { p.path(`M${x + dx - 3} ${base - 4}l1 -${h - 4}h4l1 ${h - 4}z`, c); p.circ(x + dx, base - h, 2.4, c); } break;
    }
  });
}
export function table(r: Rng, wood: string, list: Item[], opts: { w?: number; h?: number; cloth?: string; round?: boolean } = {}) {
  const w = opts.w ?? 150, th = opts.h ?? 60, T = 50, p = new Pic(w, th + T);
  if (opts.round) {
    p.rect(w / 2 - 4, T + 6, 8, th - 10, dk(wood, 0.15));
    p.ell(w / 2, T + th - 3, 22, 4, dk(wood, 0.2));
    p.ell(w / 2, T + 4, w / 2 - 4, 5, wood); p.ell(w / 2, T + 2.5, w / 2 - 4, 4, lt(wood, 0.15));
  } else {
    p.rect(8, T + 6, 7, th - 6, dk(wood, 0.1)); p.rect(w - 15, T + 6, 7, th - 6, dk(wood, 0.3));
    p.rect(16, T + 6, w - 32, 8, dk(wood, 0.25));
    p.rect(2, T, w - 4, 7, wood, 2); p.rect(2, T, w - 4, 2, lt(wood, 0.25));
  }
  if (opts.cloth) { p.path(`M0 ${T - 1}H${w}L${w - 4} ${T + 26}Q${w * 0.75} ${T + 20} ${w / 2} ${T + 27}Q${w * 0.25} ${T + 20} 4 ${T + 26}Z`, opts.cloth); p.rect(0, T - 2, w, 3, lt(opts.cloth, 0.2)); }
  items(p, r, list, 10, w - 10, T);
  return p;
}
export function desk(r: Rng, wood: string, list: Item[], w = 180) {
  const p = new Pic(w, 120), T = 54;
  p.box(4, T, w - 8, 66, wood);
  p.rect(0, T - 4, w, 7, lt(wood, 0.08), 2); p.rect(0, T - 4, w, 2, lt(wood, 0.3));
  for (let k = 0; k < 3; k++) { p.rect(w - 58, T + 10 + k * 18, 46, 14, dk(wood, 0.12), 1); p.rect(w - 39, T + 16 + k * 18, 8, 2.5, BRASS, 1); }
  p.rect(14, T + 10, w - 80, 56, dk(wood, 0.45));
  items(p, r, list, 8, w - 8, T - 4);
  return p;
}
export function counter(r: Rng, wood: string, top: string, w = 300, list: Item[] = []) {
  const p = new Pic(w, 110), T = 50;
  p.rect(0, T + 6, w, 54, wood);
  for (let x = 10; x < w - 20; x += 46) { p.rect(x, T + 14, 36, 40, dk(wood, 0.12), 2); p.rect(x + 3, T + 17, 30, 2, lt(wood, 0.15)); }
  p.rect(0, T, w, 8, top, 2); p.rect(0, T, w, 2, lt(top, 0.3));
  p.rect(0, T + 58, w, 2, dk(wood, 0.4));
  items(p, r, list, 10, w - 10, T);
  return p;
}
export function rug(r: Rng, cols: [string, string, string], w = 280) {
  const p = new Pic(w, 40), [a, b, c] = cols;
  p.poly([30, 2, w - 30, 2, w, 38, 0, 38], a);
  p.poly([38, 6, w - 38, 6, w - 12, 34, 12, 34], b);
  p.poly([50, 10, w - 50, 10, w - 28, 30, 28, 30], a);
  p.ell(w / 2, 20, w * 0.16, 7, c); p.ell(w / 2, 20, w * 0.09, 4, b);
  for (let x = 2; x < w; x += 6) p.rect(x, 38, 2, 2, lt(a, 0.4));
  if (r() < 0.5) for (let k = 0; k < 6; k++) p.circ(70 + k * ((w - 140) / 5), 20, 2.5, c);
  return p;
}

// ── Lamps, lights and fire ───────────────────────────────────────────────────
export function floorLamp(shade: string, metal = BRASS, h = 190) {
  const p = new Pic(60, h);
  p.ell(30, h - 4, 18, 4, dk(metal, 0.2));
  p.rect(28.5, 40, 3, h - 44, metal);
  p.path("M8 46L16 6H44L52 46Z", shade);
  p.path("M8 46L16 6H22L16 46Z", lt(shade, 0.3));
  p.path("M8 46h44l-2 3H10z", lt(shade, 0.5));
  return p;
}
export function pendant(shade: string, drop = 50, kind: "dome" | "cone" | "globe" | "lantern" | "bare" = "dome") {
  const p = new Pic(60, drop + 34);
  p.line(`M30 0V${drop + 4}`, "#1a1a1a", 1.4);
  if (kind === "dome") { p.path(`M8 ${drop + 30}Q8 ${drop + 2} 30 ${drop + 2}Q52 ${drop + 2} 52 ${drop + 30}Z`, shade); p.path(`M12 ${drop + 28}Q14 ${drop + 8} 26 ${drop + 5}`, "none"); p.ell(30, drop + 30, 22, 3, "#fff2c8"); p.line(`M14 ${drop + 26}Q16 ${drop + 10} 28 ${drop + 6}`, lt(shade, 0.35), 2); }
  else if (kind === "cone") { p.path(`M14 ${drop + 30}L26 ${drop + 2}H34L46 ${drop + 30}Z`, shade); p.ell(30, drop + 30, 16, 2.5, "#fff2c8"); }
  else if (kind === "globe") { p.rect(26, drop, 8, 6, BRASS); p.circ(30, drop + 18, 14, "#fff1cc"); p.circ(26, drop + 14, 5, "#ffffff"); }
  else if (kind === "lantern") { p.rect(22, drop + 2, 16, 4, IRON); p.path(`M20 ${drop + 6}h20l-2 22h-16z`, al("#ffcf7a", 0.85)); p.line(`M20 ${drop + 6}l2 22M40 ${drop + 6}l-2 22M30 ${drop + 6}v22`, IRON, 1.6); p.rect(20, drop + 27, 20, 4, IRON); p.ell(30, drop + 18, 3, 5, "#fff6d0"); }
  else { p.rect(27, drop, 6, 6, "#2a2a2a"); p.path(`M24 ${drop + 6}h12q4 8 -1 14h-10q-5 -6 -1 -14z`, "#fff4cc"); p.ell(30, drop + 13, 3, 4, "#ffffff"); }
  return p;
}
export function chandelier(metal = GOLD, arms = 5) {
  const p = new Pic(170, 110);
  p.line("M85 0V40", metal, 2.5);
  p.ell(85, 46, 8, 10, metal);
  for (let i = 0; i < arms; i++) {
    const x = 15 + (140 * i) / (arms - 1);
    p.line(`M85 52Q${(85 + x) / 2} 80 ${x} 64`, metal, 2.6);
    p.rect(x - 5, 60, 10, 4, metal, 1);
    p.rect(x - 2.5, 46, 5, 14, "#f4ecd8");
    p.ell(x, 41, 2.2, 4, "#ffd27a"); p.ell(x, 42, 1, 2, "#fff8e0");
    p.path(`M${x - 1.5} ${68}l1.5 7l1.5 -7z`, al("#e8f4ff", 0.8));
  }
  p.path("M77 56Q85 76 93 56Z", metal);
  for (let k = 0; k < 7; k++) p.path(`M${50 + k * 12} 74l2 8l2 -8z`, al("#e8f4ff", 0.75));
  p.circ(85, 90, 4, al("#e8f4ff", 0.85));
  return p;
}
export function wagonWheel(n = 6) {
  const p = new Pic(170, 90), w = "#4a2e18";
  p.line("M30 0L60 50M140 0L110 50M85 0V40", IRON, 1.5);
  p.raw(`<ellipse cx='85' cy='50' rx='72' ry='14' fill='none' stroke='${w}' stroke-width='6'/>`);
  p.line("M13 50H157M85 36V64M35 40L135 60M35 60L135 40", w, 3);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = 85 + Math.cos(a) * 72, y = 50 + Math.sin(a) * 14; p.rect(x - 3, y - 18, 6, 14, "#f2ead6"); p.ell(x, y - 22, 2, 3.6, "#ffd27a"); }
  return p;
}
export function stringLights(r: Rng, colors: string[] | null, w = 800, sag = 22, loops = 3) {
  const p = new Pic(w, sag + 22), seg = w / loops;
  let d = "M0 2";
  for (let i = 0; i < loops; i++) d += `Q${seg * i + seg / 2} ${sag * 2} ${seg * (i + 1)} 2`;
  p.line(d, "#2a2a22", 1.2);
  for (let i = 0; i < loops; i++) for (let k = 1; k < 8; k++) {
    const t = k / 8, x = seg * i + seg * t, y = 2 + (1 - (2 * t - 1) ** 2) * sag;
    const c = colors ? pick(r, colors) : "#ffd98a";
    p.rect(x - 1.5, y, 3, 3, "#2a2a22");
    p.circ(x, y + 7, 9, al(c, 0.22));
    p.ell(x, y + 7, 3, 4.5, c);
    p.ell(x - 1, y + 6, 1, 1.8, "#ffffffcc");
  }
  return p;
}
export function bunting(r: Rng, colors: string[], w = 800, sag = 16, loops = 2) {
  const p = new Pic(w, sag + 30), seg = w / loops;
  let d = "M0 2";
  for (let i = 0; i < loops; i++) d += `Q${seg * i + seg / 2} ${sag * 2} ${seg * (i + 1)} 2`;
  p.line(d, "#efe6d6", 1.2);
  for (let i = 0; i < loops; i++) for (let k = 1; k < 12; k++) {
    const t = k / 12, x = seg * i + seg * t, y = 2 + (1 - (2 * t - 1) ** 2) * sag, c = colors[(i * 11 + k) % colors.length];
    p.poly([x - 9, y, x + 9, y, x, y + 22], c);
    p.poly([x - 9, y, x - 3, y, x, y + 22], lt(c, 0.15));
  }
  return p;
}
export function candles(r: Rng, n = 4) {
  const p = new Pic(70, 64);
  for (let i = 0; i < n; i++) {
    const x = 10 + (50 * i) / Math.max(1, n - 1) + between(r, -3, 3), h = between(r, 16, 40), w = between(r, 6, 10);
    p.rect(x - w / 2, 64 - h, w, h, "#f2ead6", 1.5);
    p.path(`M${x - w / 2} ${64 - h}q2 ${h * 0.25} 1 ${h * 0.4}l1 -${h * 0.4}z`, "#e0d6c0");
    p.rect(x + w / 2 - 2, 64 - h, 2, h, "#d8ccb4");
    p.line(`M${x} ${64 - h}v-3`, "#2a2a2a", 0.8);
    p.ell(x, 64 - h - 6, 2.4, 4.4, "#ffcf6a"); p.ell(x, 64 - h - 5, 1.1, 2.2, "#fff8e0");
    p.mark("glow", x, 64 - h - 6);
  }
  return p;
}
export function candelabra(metal = GOLD, h = 130) {
  const p = new Pic(60, h);
  p.path(`M16 ${h}q14 -10 28 0z`, metal);
  p.rect(28, 30, 4, h - 34, metal);
  p.line("M30 44Q30 30 12 28M30 44Q30 30 48 28", metal, 3);
  for (const x of [12, 30, 48]) { p.rect(x - 4, x === 30 ? 20 : 26, 8, 3, metal); p.rect(x - 2.5, x === 30 ? 4 : 10, 5, 16, "#f2ead6"); p.ell(x, x === 30 ? 0.5 : 6.5, 2, 3.5, "#ffd27a"); }
  return p;
}
export function lantern(metal = IRON) {
  const p = new Pic(36, 62);
  p.raw(`<path d='M18 0a6 6 0 0 1 0 12' fill='none' stroke='${metal}' stroke-width='2'/>`);
  p.rect(10, 10, 16, 4, metal); p.path("M8 14h20l-2 34h-16z", al("#ffc870", 0.9)); p.ell(18, 32, 4, 7, "#fff4d0");
  p.line("M8 14l2 34M28 14l-2 34M18 14v34", metal, 1.6);
  p.rect(6, 48, 24, 5, metal); p.path("M9 10l9 -6l9 6z", metal);
  return p;
}
export function fireplace(r: Rng, stone: string, mantel: string, top: Item[] = ["candle", "vase", "candle"]) {
  const p = new Pic(210, 170), T = 40;
  p.rect(10, T + 10, 190, 120, stone);
  for (const tone of [0, 1]) for (let y = T + 18; y < T + 130; y += 14) for (let x = 10 + ((y / 14) % 2) * 14; x < 196; x += 28) if ((x * 7 + y * 3) % 2 === tone) p.rect(x, y, 26, 12, lt(stone, tone ? 0.1 : 0.04));
  p.path(`M50 ${T + 130}V${T + 70}Q50 ${T + 38} 105 ${T + 38}Q160 ${T + 38} 160 ${T + 70}V${T + 130}Z`, "#140a06");
  p.path(`M56 ${T + 130}V${T + 72}Q56 ${T + 44} 105 ${T + 44}Q154 ${T + 44} 154 ${T + 72}V${T + 130}Z`, p.rad(["#5a2410", "#1a0a04"], 0.5, 0.9));
  p.path(`M70 ${T + 122}l70 -10l4 8l-70 10z`, "#4a2a14"); p.path(`M74 ${T + 112}l60 10l-2 8l-60 -10z`, "#5a3418");
  p.rect(66, T + 124, 6, 6, IRON); p.rect(138, T + 124, 6, 6, IRON);
  p.rect(0, T, 210, 12, mantel, 2); p.rect(0, T, 210, 3, lt(mantel, 0.25));
  p.rect(4, T + 12, 202, 4, dk(mantel, 0.3));
  p.rect(0, T + 128, 210, 6, dk(stone, 0.2));
  items(p, r, top, 20, 190, T);
  p.mark("fire", 105, T + 108);
  return p;
}
export function stove(kind: "range" | "modern" | "hearth" = "range") {
  if (kind === "modern") {
    const p = new Pic(110, 120);
    p.rect(0, 30, 110, 90, "#e8ecef", 3); p.rect(0, 26, 110, 6, "#2a2c30", 2);
    p.rect(10, 52, 90, 56, "#2a2c30", 4); p.rect(14, 56, 82, 48, p.lin(["#3a3e44", "#16181c"])); p.rect(14, 44, 82, 4, "#c8ccd4", 2);
    for (let k = 0; k < 4; k++) p.circ(20 + k * 23, 38, 3.5, "#2a2c30");
    p.path("M30 26V12q0 -4 4 -4h30q4 0 4 4v14z", "#b8bcc4"); p.rect(26, 10, 46, 3, "#9a9ea6"); p.mark("steam", 49, 6);
    return p;
  }
  if (kind === "hearth") {
    const p = new Pic(170, 160);
    p.rect(0, 0, 170, 160, "#5a4a3e");
    for (let y = 4; y < 156; y += 16) for (let x = (y / 16) % 2 ? 0 : 16; x < 170; x += 32) p.rect(x, y, 30, 14, (x + y) % 3 ? "#6a584a" : "#62503f", 2);
    p.path("M20 160V70Q20 40 85 40Q150 40 150 70V160Z", "#120804");
    p.line("M85 40V96", IRON, 2); p.path("M60 96h50q0 30 -25 30q-25 0 -25 -30z", IRON); p.rect(56, 92, 58, 6, "#3a3a40", 2); p.mark("steam", 85, 92); p.mark("fire", 85, 146);
    p.path("M50 150l70 -6l2 6l-70 6z", "#3a2010");
    return p;
  }
  const p = new Pic(140, 160);
  p.rect(58, 0, 14, 60, IRON); p.rect(54, 20, 22, 4, "#3a3a40");
  p.rect(0, 60, 140, 100, IRON, 4); p.rect(0, 60, 140, 8, "#4a4a52", 2);
  p.rect(12, 80, 52, 40, "#3a3a42", 3); p.rect(76, 80, 52, 40, "#3a3a42", 3);
  p.rect(18, 86, 40, 28, p.rad(["#ff9a3a", "#8a2a0a", "#2a0a04"], 0.5, 0.8));
  p.rect(16, 98, 44, 2, IRON); p.rect(16, 106, 44, 2, IRON);
  p.rect(90, 98, 24, 4, BRASS, 2); p.rect(0, 150, 140, 10, "#1a1a1e");
  p.path("M86 60q-2 -14 12 -16h12q14 2 12 16z", "#3a5a7a"); p.line("M118 48q10 -4 14 -12", "#3a5a7a", 3); p.line("M92 46q12 -10 24 0", "#2a2a2e", 2); p.mark("steam", 128, 34); p.mark("glow", 38, 100);
  return p;
}
export function grandfatherClock(wood: string) {
  const p = new Pic(64, 210);
  p.path("M6 210V70H58V210Z", wood);
  p.path("M2 74V24Q2 4 32 4Q62 4 62 24V74Z", wood);
  p.path("M10 70V28Q10 12 32 12Q54 12 54 28V70Z", dk(wood, 0.3));
  p.circ(32, 40, 19, "#f2ead6"); p.raw(`<circle cx='32' cy='40' r='19' fill='none' stroke='${GOLD}' stroke-width='2.5'/>`);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; p.line(`M${32 + Math.sin(a) * 15} ${40 - Math.cos(a) * 15}L${32 + Math.sin(a) * 17} ${40 - Math.cos(a) * 17}`, "#2a2a2a", 1.4); }
  p.line("M32 40L32 28M32 40L40 44", "#1a1a1a", 1.8);
  p.rect(16, 86, 32, 96, dk(wood, 0.45), 14); p.rect(19, 89, 26, 90, al(GLASS, 0.12), 12);
  p.rect(0, 70, 64, 6, lt(wood, 0.1)); p.rect(2, 196, 60, 14, dk(wood, 0.15));
  p.rect(52, 74, 6, 136, dk(wood, 0.2));
  return p;
}
export function wallClock(rim = "#2a2a2a", face = "#f4efe4", h = 3, m = 50) {
  const p = new Pic(60, 60);
  p.circ(30, 30, 28, rim); p.circ(30, 30, 24, face);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; p.line(`M${30 + Math.sin(a) * 19} ${30 - Math.cos(a) * 19}L${30 + Math.sin(a) * 22} ${30 - Math.cos(a) * 22}`, "#2a2a2a", k % 3 ? 1 : 2.2); }
  const ha = (h / 12) * Math.PI * 2, ma = (m / 60) * Math.PI * 2;
  p.line(`M30 30L${30 + Math.sin(ha) * 12} ${30 - Math.cos(ha) * 12}M30 30L${30 + Math.sin(ma) * 18} ${30 - Math.cos(ma) * 18}`, "#1a1a1a", 2.2);
  p.circ(30, 30, 2, "#c83a2a");
  p.path("M8 22Q14 8 30 6", "none"); p.line("M10 20Q16 9 28 8", "#ffffff66", 2);
  return p;
}
/** Kit-Cat style clock: googly eyes, a bow tie, the tail swings (see the room's :after). */
export function catClock() {
  const p = new Pic(50, 110);
  p.path("M8 30L4 6L18 18Q25 15 32 18L46 6L42 30Q44 44 25 46Q6 44 8 30Z", "#16161a");
  p.ell(17, 28, 6, 5, "#f4efe4"); p.ell(33, 28, 6, 5, "#f4efe4"); p.circ(19, 28, 3, "#1a1a1a"); p.circ(35, 28, 3, "#1a1a1a");
  p.path("M20 38q5 4 10 0", "#f4efe4");
  p.rect(10, 46, 30, 50, "#16161a", 10); p.circ(25, 64, 11, "#f4efe4"); p.line("M25 64V57M25 64L30 66", "#1a1a1a", 1.4);
  p.path("M17 48l8 4l8 -4l-1 7l-7 -3l-7 3z", "#c83a2a");
  return p;
}

// ── Pictures and wall things ─────────────────────────────────────────────────
export type Art = "land" | "sea" | "portrait" | "abstract" | "night" | "flowers" | "map" | "poster";
export function painting(r: Rng, kind: Art, frame = GOLD, w = 90, h = 70) {
  const p = new Pic(w, h), b = kind === "poster" ? 3 : 7, X = b, Y = b, W = w - 2 * b, H = h - 2 * b;
  if (kind !== "poster") { p.rect(0, 0, w, h, frame, 2); p.rect(2, 2, w - 4, 2, lt(frame, 0.3)); p.rect(b - 2, b - 2, W + 4, H + 4, dk(frame, 0.35)); }
  else p.rect(0, 0, w, h, "#f4efe4");
  const sky = (a: string, c: string) => p.rect(X, Y, W, H, p.lin([a, c]));
  if (kind === "land") { sky(pick(r, ["#7ab0d8", "#f0a87a", "#8ac0e0"]), "#f8e0b0"); p.circ(X + W * 0.7, Y + H * 0.35, H * 0.12, "#fff2c0"); p.path(`M${X} ${Y + H * 0.7}Q${X + W * 0.3} ${Y + H * 0.45} ${X + W * 0.6} ${Y + H * 0.66}T${X + W} ${Y + H * 0.6}V${Y + H}H${X}Z`, "#6a9a5a"); p.path(`M${X} ${Y + H * 0.85}Q${X + W * 0.5} ${Y + H * 0.7} ${X + W} ${Y + H * 0.82}V${Y + H}H${X}Z`, "#4a7a3a"); p.circ(X + W * 0.25, Y + H * 0.6, H * 0.1, "#3a6a3a"); }
  else if (kind === "sea") { sky("#9ac8e8", "#e8f0f0"); p.rect(X, Y + H * 0.6, W, H * 0.4, p.lin(["#3a7aa8", "#1a4a6a"])); p.path(`M${X + W * 0.45} ${Y + H * 0.62}l${W * 0.12} 0l-${W * 0.02} ${H * 0.06}h-${W * 0.08}z`, "#5a3a2a"); p.path(`M${X + W * 0.5} ${Y + H * 0.6}V${Y + H * 0.25}l${W * 0.12} ${H * 0.3}z`, "#f4efe4"); for (let k = 0; k < 4; k++) p.line(`M${X + 4 + k * W * 0.25} ${Y + H * 0.8 + (k % 2) * 4}q4 -3 8 0`, "#ffffff99", 1); }
  else if (kind === "night") { sky("#1a2a6a", "#3a5aa0"); for (let k = 0; k < 4; k++) p.raw(`<path d='M${f(X + W * (0.1 + k * 0.22))} ${f(Y + H * 0.35)}q${f(W * 0.08)} -${f(H * 0.2)} ${f(W * 0.16)} 0t${f(W * 0.12)} 0' fill='none' stroke='#8ab0f0' stroke-width='2'/>`); p.circ(X + W * 0.8, Y + H * 0.2, H * 0.1, "#ffe25a"); for (let k = 0; k < 5; k++) p.circ(X + W * r(), Y + H * r() * 0.5, 2, "#ffe88a"); p.path(`M${X + W * 0.2} ${Y + H}Q${X + W * 0.14} ${Y + H * 0.4} ${X + W * 0.24} ${Y + H * 0.15}Q${X + W * 0.32} ${Y + H * 0.5} ${X + W * 0.3} ${Y + H}Z`, "#1a2a1a"); p.path(`M${X} ${Y + H * 0.85}Q${X + W * 0.5} ${Y + H * 0.7} ${X + W} ${Y + H * 0.8}V${Y + H}H${X}Z`, "#2a3a5a"); }
  else if (kind === "portrait") { sky("#3a2a24", "#1a1210"); p.path(`M${X + W * 0.15} ${Y + H}Q${X + W * 0.2} ${Y + H * 0.62} ${X + W * 0.5} ${Y + H * 0.6}Q${X + W * 0.8} ${Y + H * 0.62} ${X + W * 0.85} ${Y + H}Z`, pick(r, ["#2a3a5a", "#5a1a2a", "#1a1a1a"])); p.ell(X + W * 0.5, Y + H * 0.4, W * 0.16, H * 0.2, "#e8c8a8"); p.path(`M${X + W * 0.32} ${Y + H * 0.4}Q${X + W * 0.3} ${Y + H * 0.12} ${X + W * 0.5} ${Y + H * 0.14}Q${X + W * 0.72} ${Y + H * 0.14} ${X + W * 0.68} ${Y + H * 0.42}Q${X + W * 0.6} ${Y + H * 0.24} ${X + W * 0.5} ${Y + H * 0.24}Q${X + W * 0.4} ${Y + H * 0.24} ${X + W * 0.32} ${Y + H * 0.4}Z`, pick(r, ["#3a2414", "#c8a050", "#1a1a1a", "#8a3a1a"])); p.path(`M${X + W * 0.42} ${Y + H * 0.62}l${W * 0.08} ${H * 0.12}l${W * 0.08} -${H * 0.12}z`, "#f4efe4"); }
  else if (kind === "abstract") { p.rect(X, Y, W, H, "#f0ead8"); const cs = ["#d83a2a", "#2a5aa8", "#f0c02a", "#1a1a1a", "#e87a3a", "#3a9a8a"]; for (let k = 0; k < 4; k++) { const c = pick(r, cs); if (r() < 0.5) p.circ(X + W * r(), Y + H * r(), H * between(r, 0.12, 0.3), al(c, 0.9)); else p.rect(X + W * r() * 0.6, Y + H * r() * 0.6, W * between(r, 0.2, 0.4), H * between(r, 0.2, 0.4), c); } p.line(`M${X} ${Y + H * 0.66}H${X + W}M${X + W * 0.4} ${Y}V${Y + H}`, "#1a1a1a", 2); }
  else if (kind === "flowers") { sky("#2a2a2a", "#4a3a2a"); p.path(`M${X + W * 0.4} ${Y + H}l${W * 0.04} -${H * 0.3}h${W * 0.12}l${W * 0.04} ${H * 0.3}z`, "#c8a46a"); for (let k = 0; k < 9; k++) { const cx = X + W * between(r, 0.25, 0.75), cy = Y + H * between(r, 0.15, 0.6); p.circ(cx, cy, H * 0.08, pick(r, ["#f4c84a", "#e86a3a", "#f0e0a0", "#d84a5a"])); p.circ(cx, cy, H * 0.03, "#6a3a1a"); } }
  else if (kind === "map") { p.rect(X, Y, W, H, "#e8d8a8"); p.path(`M${X + W * 0.1} ${Y + H * 0.3}q${W * 0.2} -${H * 0.2} ${W * 0.35} 0t${W * 0.2} ${H * 0.4}q-${W * 0.2} ${H * 0.3} -${W * 0.45} ${H * 0.1}z`, "#b8c88a"); p.path(`M${X + W * 0.7} ${Y + H * 0.2}q${W * 0.15} 0 ${W * 0.15} ${H * 0.2}t-${W * 0.1} ${H * 0.2}z`, "#b8c88a"); p.line(`M${X + W * 0.3} ${Y + H * 0.5}l${W * 0.1} ${H * 0.1}l${W * 0.15} -${H * 0.05}`, "#a82a2a", 1.2); p.text(X + W * 0.86, Y + H * 0.85, H * 0.18, "#8a5a2a", "✦"); }
  else { const c = pick(r, ["#d83a2a", "#2a5aa8", "#1a1a1a", "#e8a02a"]); p.rect(X, Y, W, H, c); p.circ(X + W / 2, Y + H * 0.42, W * 0.28, lt(c, 0.35)); p.rect(X + W * 0.15, Y + H * 0.78, W * 0.7, H * 0.06, "#f4efe4"); p.rect(X + W * 0.25, Y + H * 0.88, W * 0.5, H * 0.04, "#f4efe4"); p.rect(w / 2 - 6, -2, 12, 6, al("#f4f0d8", 0.7)); }
  return p;
}
export function mirror(frame = GOLD, w = 60, h = 90) {
  const p = new Pic(w, h);
  p.ell(w / 2, h / 2, w / 2, h / 2, frame); p.ell(w / 2, h / 2, w / 2 - 5, h / 2 - 5, p.lin(["#c8d8e4", "#7a8a98", "#a8b8c4"]));
  p.path(`M${w * 0.28} ${h * 0.3}L${w * 0.5} ${h * 0.18}L${w * 0.36} ${h * 0.44}Z`, "#ffffff66");
  return p;
}
export function shelf(r: Rng, wood: string, list: Item[], w = 140) {
  const p = new Pic(w, 60);
  p.rect(0, 46, w, 6, wood); p.rect(0, 46, w, 1.5, lt(wood, 0.3));
  p.path(`M12 52l6 8h3l-3 -8zM${w - 12} 52l-6 8h-3l3 -8z`, dk(wood, 0.25));
  items(p, r, list, 6, w - 6, 46);
  return p;
}
export function corkboard(r: Rng, w = 130, h = 90, string = true) {
  const p = new Pic(w, h);
  p.rect(0, 0, w, h, "#6a4a2a", 2); p.rect(5, 5, w - 10, h - 10, "#c89a62");
  const pins: [number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const x = 10 + r() * (w - 44), y = 10 + r() * (h - 44), photo = r() < 0.5;
    p.raw(`<g transform='rotate(${f(between(r, -8, 8))} ${f(x + 14)} ${f(y + 14)})'>`);
    if (photo) { p.rect(x, y, 26, 30, "#f4efe4"); p.rect(x + 3, y + 3, 20, 18, pick(r, ["#5a6a7a", "#7a6a5a", "#4a5a4a"])); p.circ(x + 13, y + 10, 4, "#2a2a2a"); p.path(`M${x + 6} ${y + 21}q7 -8 14 0z`, "#2a2a2a"); }
    else { p.rect(x, y, 28, 22, pick(r, ["#f4e87a", "#f4efe4", "#f4b4c4"])); for (let l = 0; l < 4; l++) p.rect(x + 3, y + 4 + l * 4, 22 - l * 3, 1.2, "#5a5a5a"); }
    p.raw("</g>");
    p.circ(x + 13, y + 2, 2.4, "#d82a2a"); pins.push([x + 13, y + 2]);
  }
  if (string) p.line(`M${pins.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}`, "#d82a2a", 1);
  return p;
}
export function chalkboard(r: Rng, w = 170, h = 100, kind: "lesson" | "menu" = "lesson") {
  const p = new Pic(w, h + 8), chalk = "#eef0e8cc";
  p.rect(0, 0, w, h, "#7a5230", 2); p.rect(6, 6, w - 12, h - 12, kind === "menu" ? "#1e2422" : "#2e4a3a");
  p.rect(6, 6, w - 12, h - 12, p.rad(["#ffffff14", "#00000000"], 0.3, 0.3));
  if (kind === "menu") {
    p.text(w / 2, 24, 12, chalk, "MENU", " font-family='Georgia,serif' font-style='italic'");
    for (let k = 0; k < 5; k++) { p.rect(16, 34 + k * 11, between(r, 40, 80), 2, chalk); p.rect(w - 36, 34 + k * 11, 18, 2, "#f4d87acc"); }
    p.circ(w - 26, 18, 6, "none"); p.line(`M${w - 32} 20h12q0 7 -6 7q-6 0 -6 -7zM${w - 20} 21q4 0 3 3q-1 2 -3 1`, chalk, 1.2);
  } else {
    p.line(`M16 22h40M16 32h28l6 -4M16 44h52`, chalk, 1.4);
    p.text(w * 0.36, 70, 12, chalk, "E = mc²", " font-family='Georgia,serif' font-style='italic'");
    p.circ(w * 0.74, 34, 13, "none"); p.raw(`<circle cx='${f(w * 0.74)}' cy='34' r='13' fill='none' stroke='${chalk}' stroke-width='1.4'/>`);
    p.line(`M${w * 0.74 - 13} 34h26M${w * 0.74} 21v26M${w * 0.62} 70l6 -10l6 10l6 -10l6 10`, chalk, 1.2);
    p.line(`M${w * 0.82} 62q4 -8 8 0q4 -8 8 0q0 8 -8 14q-8 -6 -8 -14z`, "#f4a8b8cc", 1.4);
  }
  p.rect(-2, h - 4, w + 4, 8, "#7a5230"); p.rect(20, h - 7, 12, 3, "#f4f4ec"); p.rect(40, h - 7, 8, 3, "#f4c8c8");
  return p;
}
export function banner(c: string, emblem: string, w = 44, h = 130) {
  const p = new Pic(w + 10, h);
  p.rect(0, 0, w + 10, 5, GOLD, 2); p.circ(2, 2.5, 3, GOLD); p.circ(w + 8, 2.5, 3, GOLD);
  p.path(`M5 4H${w + 5}V${h - 4}L${w / 2 + 5} ${h - 18}L5 ${h - 4}Z`, c);
  p.path(`M5 4H${w * 0.3 + 5}V${h - 10}L5 ${h - 4}Z`, lt(c, 0.12));
  p.line(`M8 8V${h - 12}M${w + 2} 8V${h - 14}`, GOLD, 1.5);
  p.text(w / 2 + 5, h * 0.45, w * 0.6, GOLD, emblem);
  return p;
}
export function shield(r: Rng) {
  const p = new Pic(90, 80), c = pick(r, ["#8a1a1a", "#1a3a7a", "#1a5a2a"]);
  p.line("M8 8L82 72M82 8L8 72", "#b8bcc4", 4); p.rect(4, 4, 8, 8, "#6a4a2a"); p.rect(78, 4, 8, 8, "#6a4a2a");
  p.path("M20 14H70V40Q70 64 45 76Q20 64 20 40Z", c); p.path("M45 14H70V40Q70 64 45 76Z", dk(c, 0.15));
  p.raw(`<path d='M20 14H70V40Q70 64 45 76Q20 64 20 40Z' fill='none' stroke='${GOLD}' stroke-width='3'/>`);
  p.text(45, 52, 24, GOLD, pick(r, ["✠", "⚜", "♛"]));
  return p;
}
export function antlers() {
  const p = new Pic(110, 70);
  p.path("M45 40q10 -6 20 0l-4 18h-12z", "#6a4a2a"); p.path("M48 44q7 4 14 0", "none");
  p.line("M50 40Q30 34 18 10M28 26Q18 26 10 18M22 16Q16 8 18 2M60 40Q80 34 92 10M82 26Q92 26 100 18M88 16Q94 8 92 2M38 34Q34 24 36 16M72 34Q76 24 74 16", "#e8dcc4", 4.5);
  p.ell(55, 64, 22, 6, "#5a3a20");
  return p;
}
export function hangingPans(r: Rng, w = 240) {
  const p = new Pic(w, 80);
  p.rect(0, 4, w, 5, IRON, 2);
  for (let x = 22; x < w - 10; x += between(r, 34, 48)) {
    const s = between(r, 0.7, 1.15), c = pick(r, ["#c8743a", "#b8642a", "#2a2a2e", "#d88a4a"]), len = 14 * s;
    p.line(`M${x} 8V${len + 8}`, "#4a4a4a", 1.2);
    p.rect(x - 2, len + 8, 4, 22 * s, dk(c, 0.2), 2);
    p.circ(x, len + 8 + 22 * s + 14 * s, 15 * s, c); p.circ(x, len + 8 + 22 * s + 14 * s, 11 * s, dk(c, 0.18)); p.circ(x - 4 * s, len + 8 + 22 * s + 10 * s, 3 * s, "#ffffff33");
  }
  return p;
}
export function herbs(r: Rng, w = 170) {
  const p = new Pic(w, 70);
  p.rect(0, 2, w, 5, "#5a3a20", 2);
  for (let x = 14; x < w - 8; x += between(r, 22, 32)) {
    const c = pick(r, ["#6a8a3a", "#8a9a4a", "#a86a8a", "#c8a43a", "#5a7a4a"]), len = between(r, 36, 60);
    p.line(`M${x} 6V16`, "#c8b48a", 1.2); p.rect(x - 4, 14, 8, 4, "#c84a3a");
    for (let k = 0; k < 9; k++) p.leaf(x + between(r, -6, 6), 22 + k * (len - 22) / 9, 3.2, 7, between(r, -30, 30), k % 2 ? c : dk(c, 0.15));
  }
  return p;
}

// ── Plants ───────────────────────────────────────────────────────────────────
export type PlantKind = "monstera" | "fern" | "snake" | "palm" | "cactus" | "fiddle" | "bonsai" | "flowers";
export function plant(r: Rng, kind: PlantKind, pot = "#c06a3a", scale = 1) {
  const W2 = 110, H2 = kind === "snake" || kind === "fiddle" ? 170 : kind === "bonsai" ? 80 : 140, p = new Pic(W2, H2), cx = W2 / 2, potH = kind === "bonsai" ? 12 : 30, py = H2 - potH;
  const g1 = "#3e7a42", g2 = "#2e6a36", g3 = "#5a9a52";
  if (kind === "monstera") {
    for (let k = 0; k < 7; k++) {
      const a = -1.3 + k * 0.43 + between(r, -0.1, 0.1), len = between(r, 60, 100), ex = cx + Math.sin(a) * len * 0.8, ey = py - Math.cos(a) * len;
      p.line(`M${cx} ${py}Q${cx + Math.sin(a) * len * 0.3} ${py - len * 0.5} ${ex} ${ey}`, "#4a7a3a", 2);
      const lw = between(r, 18, 26), deg = (a * 180) / Math.PI;
      p.leaf(ex, ey, lw, lw * 0.8, deg, k % 2 ? g1 : g2);
      p.raw(`<path d='M${f(ex)} ${f(ey)}l${f(-lw * 0.8)} -2M${f(ex)} ${f(ey)}l${f(lw * 0.8)} 3M${f(ex)} ${f(ey)}l${f(-lw * 0.6)} ${f(lw * 0.45)}' stroke='${dk(g2, 0.35)}' stroke-width='2' transform='rotate(${f(deg)} ${f(ex)} ${f(ey)})'/>`);
      p.leaf(ex - 4, ey - 4, lw * 0.4, lw * 0.18, deg - 20, al(g3, 0.6));
    }
  } else if (kind === "fern") {
    for (let k = 0; k < 9; k++) {
      const a = -1.4 + k * 0.35, len = between(r, 50, 75);
      for (let j = 1; j < 7; j++) { const t = j / 7, x = cx + Math.sin(a) * len * t, y = py - Math.cos(a) * len * t * 0.9 + (Math.abs(a) * len * t * t) * 0.5; p.leaf(x, y, 7 * (1 - t * 0.6), 2.4, (a * 180) / Math.PI + (j % 2 ? 60 : -60), j % 2 ? g1 : g3); }
    }
  } else if (kind === "snake") {
    for (let k = 0; k < 7; k++) { const x = cx - 22 + k * 7.5, h = between(r, 80, 135), lean = between(r, -10, 10); p.path(`M${x - 5} ${py}Q${x - 7 + lean / 2} ${py - h * 0.6} ${x + lean} ${py - h}Q${x + 7 + lean / 2} ${py - h * 0.6} ${x + 5} ${py}Z`, k % 2 ? "#2e5a32" : "#3a6a3a"); p.line(`M${x - 4} ${py}Q${x - 6 + lean / 2} ${py - h * 0.6} ${x + lean} ${py - h}`, "#c8c86a", 1); for (let j = 1; j < 6; j++) p.line(`M${x - 3} ${py - j * h * 0.15}h5`, "#5a8a4a", 1.2); }
  } else if (kind === "fiddle") {
    p.line(`M${cx} ${py}V${py - 120}`, "#5a3a20", 4);
    for (let k = 0; k < 12; k++) { const y = py - 30 - k * 9, side = k % 2 ? 1 : -1; p.leaf(cx + side * 14, y, 16, 11, side * 30, k % 3 ? g1 : g2); p.line(`M${cx} ${y + 4}l${side * 26} -8`, dk(g2, 0.2), 1); }
  } else if (kind === "palm") {
    for (let k = 0; k < 6; k++) { const a = -1.2 + k * 0.48, len = between(r, 70, 100), ex = cx + Math.sin(a) * len, ey = py - Math.cos(a) * len * 0.9 + 10; p.line(`M${cx} ${py}Q${cx + Math.sin(a) * len * 0.3} ${py - len * 0.8} ${ex} ${ey}`, "#5a7a3a", 2); for (let j = 3; j < 9; j++) { const t = j / 9; const x = cx + Math.sin(a) * len * t, y = py - Math.cos(a) * len * 0.9 * t - (1 - t) * t * 40 + 10 * t; p.leaf(x, y + 6, 2.4, 11, (a * 180) / Math.PI + 20, g1); p.leaf(x, y + 6, 2.4, 11, (a * 180) / Math.PI - 20, g3); } }
  } else if (kind === "cactus") {
    p.path(`M${cx - 12} ${py}V${py - 80}q0 -12 12 -12q12 0 12 12V${py}Z`, "#4a8a4a");
    p.path(`M${cx - 12} ${py - 40}h-10q-8 0 -8 -8v-20q0 -6 5 -6q5 0 5 6v14h8zM${cx + 12} ${py - 54}h10q8 0 8 -8v-14q0 -6 -5 -6q-5 0 -5 6v8h-8z`, "#4a8a4a");
    for (let k = -1; k < 2; k++) p.line(`M${cx + k * 6} ${py - 86}V${py - 4}`, "#3a7a3a", 1.5);
    p.circ(cx, py - 94, 6, "#f46a9a"); p.circ(cx, py - 94, 2.5, "#ffd84a");
  } else if (kind === "bonsai") {
    p.path(`M${cx - 4} ${py}Q${cx - 14} ${py - 20} ${cx + 4} ${py - 34}Q${cx + 16} ${py - 42} ${cx + 2} ${py - 50}`, "none"); p.line(`M${cx - 2} ${py}Q${cx - 16} ${py - 20} ${cx + 4} ${py - 34}Q${cx + 16} ${py - 42} ${cx + 2} ${py - 50}M${cx + 4} ${py - 34}Q${cx - 14} ${py - 40} ${cx - 26} ${py - 38}`, "#5a3a2a", 4);
    for (const [x, y, s] of [[cx - 26, py - 42, 16], [cx + 4, py - 54, 20], [cx + 20, py - 38, 14]] as [number, number, number][]) { p.ell(x, y, s, s * 0.5, g2); p.ell(x - 3, y - 3, s * 0.7, s * 0.32, g3); }
    p.rect(cx - 30, py, 60, potH, "#3a5a6a", 2); p.rect(cx - 32, py, 64, 3, "#4a6a7a");
    return p;
  } else {
    for (let k = 0; k < 9; k++) { const a = -0.9 + k * 0.22, len = between(r, 40, 70), ex = cx + Math.sin(a) * len * 0.7, ey = py - Math.cos(a) * len; p.line(`M${cx} ${py}Q${cx + Math.sin(a) * len * 0.2} ${py - len * 0.5} ${ex} ${ey}`, "#4a7a3a", 1.6); p.leaf(cx + Math.sin(a) * len * 0.4, py - len * 0.45, 8, 3, a * 57 + 40, g1); const c = pick(r, ["#f46a7a", "#f4c84a", "#f4f0e8", "#b46ad8", "#ff8a4a"]); for (let j = 0; j < 5; j++) p.leaf(ex + Math.cos(j * 1.26) * 4, ey + Math.sin(j * 1.26) * 4, 4.5, 2.6, j * 72, c); p.circ(ex, ey, 2.4, "#ffe08a"); }
  }
  const pw = 46 * (kind === "cactus" ? 0.8 : 1);
  p.path(`M${cx - pw / 2} ${py}l5 ${potH}h${pw - 10}l5 -${potH}z`, pot);
  p.rect(cx - pw / 2 - 3, py - 2, pw + 6, 8, lt(pot, 0.12), 2);
  p.path(`M${cx + pw / 2 - 12} ${py + 6}l4 ${potH - 6}h3l5 -${potH - 6}z`, dk(pot, 0.2));
  void scale;
  return p;
}
export function hangingPlant(r: Rng, pot = "#e8e0d0") {
  const p = new Pic(80, 130);
  p.line("M40 0L22 36M40 0L58 36M40 0V36", "#c8b48a", 1.2);
  p.path("M20 36h40l-6 18h-28z", pot); p.rect(18, 34, 44, 4, lt(pot, 0.1), 2);
  for (let k = 0; k < 5; k++) {
    const x0 = 22 + k * 9, len = between(r, 40, 90);
    let d = `M${x0} 46`;
    for (let j = 1; j <= 6; j++) d += `Q${x0 + (j % 2 ? 6 : -6)} ${46 + (len * (j - 0.5)) / 6} ${x0 + (j % 2 ? 2 : -2)} ${46 + (len * j) / 6}`;
    p.line(d, "#3a6a32", 1.2);
    for (let j = 1; j < 7; j++) p.leaf(x0 + (j % 2 ? 4 : -4), 46 + (len * j) / 7, 4.6, 3.2, j % 2 ? 30 : -30, j % 3 ? "#4a8a46" : "#5aa04e");
  }
  return p;
}

// ── Creatures ────────────────────────────────────────────────────────────────
export const CAT_COATS: [string, string, string][] = [["#d9822b", "#b0601a", "#f0c08a"], ["#1d1a20", "#0e0c10", "#2c2830"], ["#8a8f99", "#6a6e78", "#c8ccd4"], ["#1d1a20", "#0e0c10", "#f4f2ec"], ["#efe2c8", "#d8c4a0", "#fffaf0"], ["#5a4a3e", "#3a2e24", "#a89078"]];
/** A cat asleep in a loaf (64×40). Stripes on gingers and tabbies, a white chest on tuxedos. */
export function catLoaf(coat: [string, string, string]) {
  const [c, d, b] = coat, p = new Pic(66, 42);
  p.path("M14 38Q4 38 6 30", "none");
  p.ell(38, 28, 26, 13, c);
  p.ell(40, 33, 22, 7, d);
  p.path("M64 34Q66 41 46 41Q30 41 26 37Q40 38 58 36Z", c);
  p.circ(17, 25, 11, c);
  p.poly([8, 19, 9, 9, 15, 15], c); p.poly([19, 15, 26, 9, 26, 20], c);
  p.poly([10, 17, 10.5, 12, 14, 15], "#e8a0a0"); p.poly([21, 15, 25, 12, 24.5, 17], "#e8a0a0");
  p.ell(15, 30, 7, 5, b);
  p.line("M10 25q2.5 2 5 0M19 25q2.5 2 5 0", "#1a1214", 1.2);
  p.path("M16 28.5l1.5 1.5l1.5 -1.5z", "#e88a8a");
  if (c === "#d9822b" || c === "#5a4a3e") for (let k = 0; k < 4; k++) p.line(`M${32 + k * 8} 16q2 6 0 10`, d, 2.4);
  if (c === "#1d1a20") p.line("M10 25q2.5 2 5 0M19 25q2.5 2 5 0", "#8aa05a", 1.2);
  return p;
}
/** A sitting cat seen from behind-ish, looking out (44×60); its tail is drawn separately so it can swish. */
export function catSit(coat: [string, string, string]) {
  const [c, d] = coat, p = new Pic(46, 62);
  p.path("M8 60Q4 40 14 28Q10 22 12 14Q16 6 23 6Q30 6 34 14Q36 22 32 28Q42 40 38 60Z", c);
  p.poly([12, 14, 12, 0, 20, 8], c); p.poly([26, 8, 34, 0, 34, 14], c);
  p.poly([14, 11, 14, 4, 18, 8], "#d88a8a"); p.poly([28, 8, 32, 4, 32, 11], "#d88a8a");
  p.path("M28 32Q38 42 36 60H30Q32 44 26 36Z", d);
  if (c === "#d9822b" || c === "#5a4a3e") for (let k = 0; k < 4; k++) p.line(`M12 ${36 + k * 6}q10 2 20 0`, d, 2);
  return p;
}
export function catTail(coat: [string, string, string]) {
  const p = new Pic(40, 24);
  p.line("M2 20Q20 22 28 12Q32 4 38 6", coat[0], 6);
  return p;
}
export function dogBed(r: Rng) {
  const p = new Pic(110, 50), coat = pick(r, ["#c89a5a", "#3a2a1a", "#e8dcc4", "#8a5a3a"]);
  p.ell(55, 38, 52, 12, "#7a4a5a"); p.ell(55, 34, 44, 9, "#c8a0a8");
  p.ell(58, 28, 30, 11, coat); p.ell(30, 26, 12, 10, coat); p.path("M22 20q-6 4 -4 14q6 0 8 -10z", dk(coat, 0.3));
  p.line("M26 26q2 1.5 4 0", "#1a1a1a", 1.2); p.circ(20, 30, 2, "#1a1a1a");
  p.ell(88, 32, 8, 4, coat);
  return p;
}
export function horse() {
  const p = new Pic(90, 90);
  p.path("M20 90Q22 60 30 44Q26 30 34 18L30 6L40 14Q48 10 54 14Q70 26 80 46Q86 54 80 60Q74 64 66 58Q60 52 56 54Q52 70 56 90Z", "#7a4a2a");
  p.path("M34 18Q30 30 32 46Q26 60 24 90H20Q22 60 28 44Q26 32 30 22Z", "#4a2a14");
  p.path("M56 18Q70 30 78 46Q72 40 62 30Z", "#f4efe4");
  p.circ(58, 30, 2.4, "#1a1a1a"); p.circ(76, 54, 2, "#2a1a10");
  for (let k = 0; k < 6; k++) p.line(`M${36 - k * 2} ${16 + k * 8}q-6 4 -8 10`, "#2a1a0a", 2.4);
  return p;
}
export function duck() {
  const p = new Pic(30, 26);
  p.ell(15, 18, 12, 7, "#ffd02a"); p.circ(10, 9, 6.5, "#ffd02a"); p.path("M3 9l-4 1.5l4 1.5z", "#ff8a1a"); p.circ(9, 7.5, 1.3, "#1a1a1a"); p.path("M22 12q6 -2 6 4z", "#ffd02a");
  return p;
}

// ── People in silhouette ──────────────────────────────────────────────────────
/** A row of heads and shoulders (audiences, crowds); `arms` raises some hands. */
export function crowd(r: Rng, w = 800, arms = false, color = "#0a0a10") {
  const p = new Pic(w, 70);
  for (let x = between(r, 0, 20); x < w; x += between(r, 30, 46)) {
    const s = between(r, 0.85, 1.15), y = 70 - between(r, 34, 44) * s;
    p.path(`M${x - 22 * s} 70Q${x - 20 * s} ${y + 22 * s} ${x} ${y + 20 * s}Q${x + 20 * s} ${y + 22 * s} ${x + 22 * s} 70Z`, color);
    p.ell(x, y + 6 * s, 10 * s, 12 * s, color);
    if (r() < 0.3) p.ell(x - 3, y - 4 * s, 12 * s, 7 * s, color);
    if (arms && r() < 0.45) { const side = r() < 0.5 ? -1 : 1; p.line(`M${x + side * 14 * s} ${y + 26 * s}Q${x + side * 24 * s} ${y} ${x + side * 18 * s} ${y - 18 * s}`, color, 7 * s); p.circ(x + side * 18 * s, y - 20 * s, 4.5 * s, color); }
  }
  return p;
}
export function couple(color = "#06080e") {
  const p = new Pic(90, 170);
  p.path("M10 170L14 110Q12 80 22 68Q18 56 24 48Q30 38 38 44Q44 52 40 64Q50 76 48 110L50 170Z", color);
  p.ell(30, 36, 10, 12, color); p.path("M20 32q10 -16 22 -2q-4 -2 -10 -2q-8 0 -12 4z", color);
  p.path("M46 170L48 120Q44 92 54 78Q50 70 56 62Q64 54 72 62Q76 70 70 78Q82 92 78 120L82 170Z", color);
  p.ell(64, 54, 9, 11, color); p.path("M54 50q8 -14 20 -2q2 8 6 22q-6 -4 -8 -14z", color);
  p.line("M44 90Q52 96 58 90", color, 6);
  return p;
}
