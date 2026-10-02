// ── Interiors ───────────────────────────────────────────────────────────────
// A room is a wall, a floor and windows (the scene, sky and view, masked to the
// window shapes, with a frame, a sill, curtains and a shaft of sun or moon
// light), dressed with full-colour pieces from ./kit.ts and ./kit2.ts: lamps
// that glow, cups that steam, fires that flicker, a cat asleep on the counter.
// Each piece is an <i> in the plate's .set, placed in plate percentages and
// sized from its own drawing; glows (<b>) light the wall around them. The
// location pill becomes the room's own sign.
import { Layer, W, rng, type Rng, houses, skyline, forest, hills, tents, lampPosts, ridge } from "./art";
import type { Variant } from "./kinds";
import { varChunk, scope } from "./kinds";
import * as K from "./kit";
import * as K2 from "./kit2";
import { Pic, dk, lt, al, WOOD, CAT_COATS } from "./kit";

const L = () => new Layer();
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const between = (r: Rng, a: number, b: number) => a + (b - a) * r();
const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

// ── Windows ─────────────────────────────────────────────────────────────────
/** Window outlines in a 400×200 box (stretched to the window box). */
const WB = 400, HB = 200;
const arch = (l: Layer, x: number, y: number, w: number, h: number) => l.path(`M${x} ${y + h}V${y + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2}V${y + h}Z`);
const lancet = (l: Layer, x: number, y: number, w: number, h: number) => l.path(`M${x} ${y + h}V${y + w * 0.8}Q${x} ${y} ${x + w / 2} ${y}Q${x + w} ${y} ${x + w} ${y + w * 0.8}V${y + h}Z`);
const rectW = (l: Layer, x: number, y: number, w: number, h: number, rr = 0) => (rr ? l.path(`M${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h - rr}Q${x + w} ${y + h} ${x + w - rr} ${y + h}H${x + rr}Q${x} ${y + h} ${x} ${y + h - rr}V${y + rr}Q${x} ${y} ${x + rr} ${y}Z`) : l.rect(x, y, w, h));
function mullions(l: Layer, x: number, y: number, w: number, h: number, cols: number, rows: number, wd = 3) {
  let d = "";
  for (let i = 1; i < cols; i++) d += `M${x + (w * i) / cols} ${y}V${y + h}`;
  for (let j = 1; j < rows; j++) d += `M${x} ${y + (h * j) / rows}H${x + w}`;
  l.line(wd, d);
}
type Shape = "arch" | "lancet" | "rect" | "round" | "tri" | "circle" | "trap" | "oval";
function windowSet(shape: Shape, count: number, cols: number, rows: number, frame = 7, gap = 40) {
  const mask = new Layer(), fr = new Layer();
  const w = (WB - gap * (count - 1)) / count;
  for (let i = 0; i < count; i++) {
    const x = i * (w + gap), y = 0, h = HB;
    const draw = (l: Layer, inset: number) => {
      const X = x + inset, Y = y + inset, Wd = w - 2 * inset, Hd = h - 2 * inset;
      if (shape === "arch") arch(l, X, Y, Wd, Hd);
      else if (shape === "lancet") lancet(l, X, Y, Wd, Hd);
      else if (shape === "round") rectW(l, X, Y, Wd, Hd, Math.min(Wd, Hd) * 0.18);
      else if (shape === "oval") rectW(l, X, Y, Wd, Hd, Math.min(Wd, Hd) * 0.48);
      else if (shape === "tri") l.poly([[X + Wd / 2, Y], [X + Wd, Y + Hd], [X, Y + Hd]]);
      else if (shape === "circle") l.ellipse(X + Wd / 2, Y + Hd / 2, Wd / 2, Hd / 2);
      else if (shape === "trap") l.path(`M${X + Wd * 0.08} ${Y + Hd}L${X} ${Y + Hd * 0.12}Q${X + Wd / 2} ${Y - Hd * 0.06} ${X + Wd} ${Y + Hd * 0.12}L${X + Wd * 0.92} ${Y + Hd}Z`);
      else rectW(l, X, Y, Wd, Hd);
    };
    draw(mask, frame);
    const outer = new Layer(), inner = new Layer();
    draw(outer, 0); draw(inner, frame);
    fr.hole(outer.fill.join("") + inner.fill.join(""));
    if (cols > 1 || rows > 1) mullions(fr, x + frame, y + frame, w - 2 * frame, h - 2 * frame, cols, rows);
    if (shape === "lancet") fr.line(3, `M${x + w / 2} ${y + 10}V${y + h}M${x + frame} ${y + h * 0.42}Q${x + w / 2} ${y + h * 0.3} ${x + w - frame} ${y + h * 0.42}`);
  }
  return { mask, frame: fr };
}
/** Window boxes: placement, the window's centre (for light) and the free wall. */
const BOXES = [
  { box: "right:7%;left:auto;width:clamp(116px,26%,190px)", wx: "80%", shx: "6%" },
  { box: "left:7%;right:auto;width:clamp(116px,26%,190px)", wx: "20%", shx: "64%" },
  { box: "left:auto;right:6%;width:clamp(200px,42%,330px)", wx: "73%", shx: "5%" },
  { box: "left:50%;right:auto;width:clamp(130px,30%,220px);transform:translateX(-50%)", wx: "50%", shx: "-100%" },
];
/** Which side the window sits on for the standard boxes (the furniture takes the other). */
const SIDE = ["r", "l", "r", "c"] as const;
type Side = "l" | "r" | "c";
const other = (s: Side): "l" | "r" => (s === "l" ? "r" : "l");

interface Win { mask: Layer; frame: Layer; box: string; wx?: string; shx?: string }

// ── Placing pieces ──────────────────────────────────────────────────────────
/** One piece on the plate: x in % from its anchor side, y in % from the floor (or the ceiling when `top`). */
export interface Put {
  p: Pic; x: number; at?: Side; y?: number; top?: boolean; s?: number;
  /** false: not darkened at night (lamps, screens, neon). */
  dim?: false;
  /** Glow colour for the piece's glow points, or false for none; gr is the radius in px. */
  glow?: string | false; gr?: number;
  css?: string; after?: string; anim?: string; afterAnim?: string;
  /** Shown only when the plate matches (e.g. :is([data-wx=rain],[data-wx=storm])). */
  when?: string;
  /** Only in these eras ("old|deco"). */
  era?: string;
}
/** A free light pool, in plate % (centre x, y; width w). */
export interface Glow { g: true; x: number; y: number; w: number; ar?: number; c: string; css?: string; anim?: string }
type Bit = Put | Glow | false | null | undefined;

const WET = ":is([data-wx=rain],[data-wx=storm],[data-wx=showers],[data-wx=sleet],[data-wx=snow])";
const MOTION = (rules: string) => `@media (prefers-reduced-motion:no-preference){${rules}}`;
const pct = (v: number) => `${Math.round(v * 10) / 10}%`;

/** Wisps over a piece's steam marks; 30 units of headroom above it. */
function steamPic(p: Pic) {
  const o = new Pic(p.w, p.h + 30);
  for (const [x, y] of p.pts.steam ?? []) { o.line(`M${x} ${y + 26}q-5 -7 0 -13t0 -13`, "#ffffffb0", 2.4); o.line(`M${x + 5} ${y + 24}q-4 -6 0 -11t0 -11`, "#ffffff70", 1.8); }
  return o;
}
function bubblePic(p: Pic) {
  const o = new Pic(p.w, p.h + 30);
  for (const [x, y] of p.pts.bubble ?? []) for (let k = 0; k < 3; k++) o.raw(`<circle cx='${x + ((k * 7) % 9) - 4}' cy='${y + 24 - k * 9}' r='${1.2 + (k % 2)}' fill='#e8fff455'/>`);
  return o;
}
function flamePic(p: Pic) {
  const o = new Pic(p.w, p.h);
  for (const [x, y] of p.pts.fire ?? []) {
    for (let k = -2; k <= 2; k++) {
      const fx = x + k * 10, fh = 34 - Math.abs(k) * 8;
      o.path(`M${fx - 8} ${y}Q${fx - 10} ${y - fh * 0.5} ${fx + (k % 2) * 3} ${y - fh}Q${fx + 10} ${y - fh * 0.5} ${fx + 8} ${y}Z`, "#ff6a1a");
      o.path(`M${fx - 5} ${y}Q${fx - 6} ${y - fh * 0.4} ${fx} ${y - fh * 0.7}Q${fx + 6} ${y - fh * 0.4} ${fx + 5} ${y}Z`, "#ffc23a");
      o.path(`M${fx - 2.5} ${y}Q${fx - 3} ${y - fh * 0.25} ${fx} ${y - fh * 0.4}Q${fx + 3} ${y - fh * 0.25} ${fx + 2.5} ${y}Z`, "#fff2b0");
    }
  }
  return o;
}

function setCss(sel: string, bits: Bit[]): { css: string; i: number; b: number } {
  let css = "", motion = "", i = 0, b = 0;
  // each drawing once, as a variable on the plate: pieces that repeat share it
  const urls = new Map<string, string>(), ref = (u: string) => { if (!urls.has(u)) urls.set(u, `--pc${urls.size}`); return `var(${urls.get(u)})`; };
  const one = (bit: Put, extraTop = 0, url = bit.p.url) => {
    i++;
    const q = `${sel}.p .set i:nth-of-type(${i})`, s = bit.s ?? 1, h = ((bit.p.h + extraTop) * s) / 2.9;
    const pos = bit.at === "r" ? `right:${pct(bit.x)}` : `left:${pct(bit.x)}` + (bit.at === "c" ? ";translate:-50% 0" : "");
    const vert = bit.top ? `top:${pct(bit.y ?? 0)}` : `bottom:calc(${pct(bit.y ?? 4)} + var(--fy))`;
    css += `${q}{display:block;${pos};${vert};height:calc(${pct(h)} * var(--rs));aspect-ratio:${bit.p.w}/${bit.p.h + extraTop};--u:${ref(url)}${bit.css ? ";" + bit.css : ""}}`;
    if (bit.era) css += `${sel}.p:not(${bit.era.split("|").map((e) => `[data-era=${e}]`).join(",")}) .set i:nth-of-type(${i}){display:none}`;
    if (bit.when) css += `${sel}.p:not(${bit.when}) .set i:nth-of-type(${i}){display:none}`;
    return q;
  };
  for (const bit of bits) {
    if (!bit) continue;
    if ("g" in bit) {
      b++;
      const q = `${sel}.p .set b:nth-of-type(${b})`;
      css += `${q}{display:block;left:${pct(bit.x)};top:${pct(bit.y)};width:${pct(bit.w)};aspect-ratio:${bit.ar ?? 1};background:radial-gradient(closest-side,${bit.c},transparent)${bit.css ? ";" + bit.css : ""}}`;
      if (bit.anim) motion += `${q}{animation:${bit.anim}}`;
      continue;
    }
    const q = one(bit);
    if (bit.dim === false) css += `${q}:before{display:none}`;
    if (bit.anim) motion += `${q}{animation:${bit.anim}}`;
    const glows = bit.glow === false ? [] : (bit.p.pts.glow ?? []), screens = bit.p.pts.screen ?? [];
    if (bit.after) css += `${q}:after{${bit.after}}`;
    if (bit.afterAnim) motion += `${q}:after{animation:${bit.afterAnim}}`;
    else if (glows.length || screens.length) {
      const R = bit.gr ?? 30, at = ([x, y]: [number, number]) => `${pct(((x / bit.p.w + 0.5) / 2) * 100)} ${pct(((y / bit.p.h + 0.5) / 2) * 100)}`;
      const warm = typeof bit.glow === "string" ? bit.glow : "rgba(255,190,105,.55)";
      const bg = [
        ...glows.map((g) => `radial-gradient(${R * 0.28}px ${R * 0.28}px at ${at(g)},rgba(255,244,214,.75),transparent)`),
        ...glows.map((g) => `radial-gradient(${R}px ${R}px at ${at(g)},${warm},transparent)`),
        ...screens.map((g) => `radial-gradient(${R * 1.2}px ${R}px at ${at(g)},rgba(120,200,255,.32),transparent)`),
      ];
      css += `${q}:after{inset:-50%;background:${bg.join(",")};opacity:calc(.3 + var(--lit) * .7)}`;
    }
    // overlays that line up with the piece: steam, bubbles, flames
    for (const [k, make, anim] of [["steam", steamPic, "steam 5s ease-in-out infinite"], ["bubble", bubblePic, "bub 3.2s ease-in infinite"]] as const) {
      if (!bit.p.pts[k] || bit.top) continue;
      const o = make(bit.p), q2 = one({ ...bit, p: o, css: "opacity:.75" + (bit.css ? ";" + bit.css : "") }, 0, o.url);
      css += `${q2}:before{display:none}`;
      motion += `${q2}{animation:${anim}}`;
    }
    if (bit.p.pts.fire) {
      const o = flamePic(bit.p), q2 = one({ ...bit, p: o, css: bit.css }, 0, o.url);
      const [fx, fy] = bit.p.pts.fire[0];
      css += `${q2}:before{display:none}${q2}{transform-origin:${pct((fx / bit.p.w) * 100)} ${pct((fy / bit.p.h) * 100)};filter:drop-shadow(0 0 6px rgba(255,140,40,.8))}${q2}:after{inset:-60%;background:radial-gradient(28% 26% at ${pct(((fx / bit.p.w + 0.6) / 2.2) * 100)} ${pct(((fy / bit.p.h + 0.6) / 2.2) * 100)},rgba(255,150,60,.5),transparent)}`;
      motion += `${q2}{animation:flame 1.3s ease-in-out infinite}${q2}:after{animation:flicker 2.2s ease-in-out infinite}`;
    }
  }
  const vars = [...urls].map(([u, v]) => `${v}:${u}`).join(";");
  return { css: (vars ? `${sel}.p{${vars}}` : "") + css + (motion ? MOTION(motion) : ""), i, b };
}

// ── Room pieces that are not furniture ──────────────────────────────────────
function curtains(c: string, kind: "drape" | "sheer" | "cafe" = "drape") {
  const p = new Pic(300, 200), d = dk(c, 0.28);
  if (kind === "sheer") {
    p.path("M0 0H80Q66 100 74 200H0Z", al(lt(c, 0.5), 0.55)); p.path("M300 0H220Q234 100 226 200H300Z", al(lt(c, 0.5), 0.55));
    for (const x of [16, 40, 60, 240, 260, 284]) p.line(`M${x} 0V200`, al("#ffffff", 0.35), 2);
  } else if (kind === "cafe") {
    p.path("M0 110H300V170Q225 178 150 170Q75 178 0 170Z", al(c, 0.92)); for (let x = 12; x < 300; x += 18) p.line(`M${x} 112V170`, d, 1.2);
    p.rect(0, 106, 300, 6, "#c39a4a");
  } else {
    p.path("M0 0H74Q60 60 50 112Q46 124 54 132Q40 170 46 200H0Z", c); p.path("M300 0H226Q240 60 250 112Q254 124 246 132Q260 170 254 200H300Z", c);
    for (const x of [14, 30, 46]) p.line(`M${x} 6Q${x - 6} 70 ${x * 0.7 + 4} 118Q${x * 0.5} 160 ${x * 0.8} 196`, d, 3); for (const x of [286, 270, 254]) p.line(`M${x} 6Q${x + 6} 70 ${300 - (300 - x) * 0.7 - 4} 118Q${300 - (300 - x) * 0.5} 160 ${300 - (300 - x) * 0.8} 196`, d, 3);
    p.rect(30, 116, 30, 7, "#d9b45a", 3); p.rect(240, 116, 30, 7, "#d9b45a", 3);
  }
  if (kind !== "cafe") {
    p.path("M-4 0H304V22Q276 34 250 22Q225 34 200 22Q175 34 150 22Q125 34 100 22Q75 34 50 22Q25 34 0 22Z", kind === "sheer" ? dk(c, 0.1) : d);
    p.rect(-4, 0, 308, 8, "#3a2a1a");
  }
  return p.urlFill;
}

// ── Walls and floors ────────────────────────────────────────────────────────
/** Planks running toward the viewer: rays from a vanishing point above the floor. */
const planks = (c: string, gap = 3.4) => `repeating-conic-gradient(from 0deg at 50% -420%,rgba(0,0,0,.34) 0 .16deg,transparent .16deg ${gap}deg),repeating-linear-gradient(180deg,transparent 0 9px,rgba(0,0,0,.12) 9px 10px,transparent 10px 23px,rgba(0,0,0,.1) 23px 24px),linear-gradient(180deg,${dk(c, 0.25)},${c} 45%,${dk(c, 0.18)})`;
const checker = (a: string, b: string, size = 46) => `background:repeating-conic-gradient(${a} 0 25%,${b} 0 50%) 0 0/${size}px ${size}px;left:-45%;right:-45%;transform:perspective(170px) rotateX(46deg);transform-origin:50% 100%`;
const tiles = (c: string, grout = "rgba(0,0,0,.3)", size = 34) => `background:repeating-linear-gradient(90deg,${grout} 0 1.5px,transparent 1.5px ${size}px),repeating-linear-gradient(0deg,${grout} 0 1.5px,transparent 1.5px ${size}px),linear-gradient(${lt(c, 0.06)},${dk(c, 0.15)});left:-45%;right:-45%;transform:perspective(170px) rotateX(46deg);transform-origin:50% 100%`;
/** A wallpaper tile: a small motif repeated over the base colour. */
function paper(base: string, ink: string, motif: "damask" | "dots" | "stripe" | "flower" | "diamond" | "star", size = 44) {
  const p = new Pic(40, 56);
  if (motif === "damask") { p.path("M20 6Q28 16 20 28Q12 16 20 6ZM20 28Q32 30 34 44Q24 42 20 28ZM20 28Q8 30 6 44Q16 42 20 28Z", ink); p.circ(20, 46, 2.4, ink); p.circ(0, 0, 3, ink); p.circ(40, 0, 3, ink); p.circ(0, 56, 3, ink); p.circ(40, 56, 3, ink); }
  else if (motif === "dots") { p.circ(10, 14, 2.4, ink); p.circ(30, 42, 2.4, ink); }
  else if (motif === "stripe") { p.rect(0, 0, 8, 56, ink); p.rect(16, 0, 1.5, 56, ink); }
  else if (motif === "flower") { for (let k = 0; k < 5; k++) p.leaf(20 + Math.cos(k * 1.26) * 5, 24 + Math.sin(k * 1.26) * 5, 5, 3, k * 72, ink); p.circ(20, 24, 2.2, ink); p.leaf(6, 48, 4, 1.8, 30, ink); p.leaf(34, 50, 4, 1.8, -30, ink); }
  else if (motif === "diamond") { p.poly([20, 4, 32, 28, 20, 52, 8, 28], "none"); p.line("M20 4L32 28L20 52L8 28Z", ink, 1.2); p.circ(20, 28, 2, ink); }
  else { p.text(20, 30, 14, ink, "✦"); p.text(4, 54, 8, ink, "·"); }
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 56'>${p.s}</svg>`).replace(/'/g, "%27")}") 0 0/${size * 0.714}px ${size}px,${base}`;
}
/** Panelling below a rail at `at` % of the wall height. */
const wainscot = (at: number, rail: string, panel: string) => `linear-gradient(180deg,transparent ${at}%,${lt(rail, 0.2)} ${at}% ${at + 0.6}%,${rail} ${at + 0.6}% ${at + 2.2}%,rgba(0,0,0,.35) ${at + 2.2}% ${at + 3}%,transparent ${at + 3}%),linear-gradient(180deg,transparent ${at + 3}%,${panel} ${at + 3}%)`;
const beams = (c: string, h = 8) => `linear-gradient(180deg,${dk(c, 0.2)} 0 ${h}%,${lt(c, 0.12)} ${h}% ${h + 0.8}%,rgba(0,0,0,.4) ${h + 0.8}% ${h + 2.4}%,transparent ${h + 2.4}%)`;
const sign = (css: string, b = "") => `&.p .crumb{${css}}${b ? `&.p .crumb b{${b}}` : ""}`;

// ── Views through windows ───────────────────────────────────────────────────
const UNDERWATER = `&.p :is(.sun,.moon,.rays,.clouds,.clouds2,.stars,.rain,.r2,.snow,.flash,.windl,.heat,.fog,.glow,.fx,.fx2,.gx,.ground,.water,.glint,.mglint,.refl){display:none}&.p .sky{filter:brightness(calc(1 - var(--lit) * .55));background:linear-gradient(180deg,#3aa8d0,#0e5a86 50%,#06283e)}&.p .wash{opacity:1;background:repeating-conic-gradient(from 160deg at 35% -30%,rgba(210,245,255,.16) 0 2.5deg,transparent 2.5deg 9deg);-webkit-mask:linear-gradient(#000,transparent 80%);mask:linear-gradient(#000,transparent 80%)}&.p .scene .land{--F:#0d4a62;--M:#0a3a50;--N:#062636}&.p .scene .far{background:#0f5068}&.p .scene .mid{background:#0a3a50}`;
const fishCss = (url: string, top: number, dur: number, rev = false) => `inset:auto;top:${top}%;left:-40%;width:160px;height:60px;background:${url} 0 0/100% 100% no-repeat;${rev ? "transform:scaleX(-1);" : ""}`;
const fishAnim = (dur: number, delay = 0, rev = false) => `${rev ? "swimr" : "fly"} ${dur}s linear ${delay}s infinite`;

// ── The rooms ───────────────────────────────────────────────────────────────
interface Room {
  id: string;
  css: string;
  view: (r: Rng) => Variant;
  windows: (v: number) => Win | null;
  cur?: (v: number) => [string, "drape" | "sheer" | "cafe"] | null;
  set?: (r: Rng, v: number) => Bit[];
}
const std = (shape: Shape, count: number, cols: number, rows: number, frame: number, extra: string, v: number, map = (x: number) => x): Win => { const b = BOXES[map(v)]; return { ...windowSet(shape, count, cols, rows, frame), box: b.box + extra, wx: b.wx, shx: b.shx }; };
const sideOf = (v: number, map = (x: number) => x): Side => SIDE[map(v)];
const coat = (r: Rng) => pick(r, CAT_COATS);
/** "z" rising from a sleeping cat (the piece's :after); it drifts only when motion is welcome. */
const ZZ = `content:"z";inset:auto;right:2%;top:-14%;font:italic 700 12px/1 Georgia,serif;color:#f4efe4;text-shadow:0 0 4px rgba(0,0,0,.6);opacity:.75`;
const ZZA = "zz 4s ease-out infinite";
/** A cat asleep in a loaf (z's drifting up) or sitting up with its tail swishing. */
function cat(r: Rng, x: number, y: number, at: Side, s = 0.6, sit = false, c = coat(r)): Put {
  if (!sit) return { p: K.catLoaf(c), x, y, at, s, after: ZZ, afterAnim: ZZA };
  return { p: K.catSit(c), x, y, at, s, after: `inset:auto;left:62%;bottom:2%;width:76%;aspect-ratio:40/24;background:${K.catTail(c).url} 0 0/100% 100% no-repeat;transform-origin:0 80%`, afterAnim: "tail 2.6s ease-in-out infinite alternate" };
}
/** A rubber duck on the tub's "duck" mark, drawn the tub's size so it lines up. */
function duckIn(tub: Pic) {
  const o = new Pic(tub.w, tub.h), [x, y] = tub.pts.duck?.[0] ?? [150, 22], d = K.duck();
  o.raw(`<g transform='translate(${x - 15} ${y - 20})'>${d.s}</g>`);
  return o;
}
/** Kelp for underwater views. */
function kelp(r: Rng, count: number, h: [number, number]) {
  const l = L();
  let d = "";
  for (let i = 0; i < count; i++) { const x = between(r, 0, W), hh = between(r, h[0], h[1]); d += `M${Math.round(x)} 100Q${Math.round(x - 8)} ${Math.round(100 - hh * 0.5)} ${Math.round(x + 6)} ${Math.round(100 - hh)}`; }
  l.line(4, d);
  return l;
}

const ROOMS: Room[] = [
  {
    id: "tavern",
    css: `&.p .wall{background:${beams("#3a2414", 7)},linear-gradient(90deg,rgba(0,0,0,.4) 0 1.6%,transparent 1.6% 98.4%,rgba(0,0,0,.4) 98.4%),repeating-linear-gradient(90deg,rgba(0,0,0,.22) 0 2px,transparent 2px 31px),${wainscot(60, "#3a2414", "#2c1a0e")},linear-gradient(180deg,#6a4628,#3a2414)}&.p .wain{height:15%;background:${planks("#3e2614")}}&.p .lamp{background:radial-gradient(60% 50% at 50% 10%,rgba(255,170,80,.28),transparent 70%),radial-gradient(40% 60% at 20% 100%,rgba(255,140,60,.25),transparent 70%)}`
      + sign(`background:linear-gradient(180deg,#8a5a32,#5a3418);border:2px solid #2a160a;border-radius:7px;color:#f4e2c0;font:600 13px/1.2 "IM Fell English","Cormorant Garamond",Georgia,serif;letter-spacing:.02em;box-shadow:0 3px 0 #2a160a,inset 0 1px 0 rgba(255,255,255,.22),0 8px 16px -6px rgba(0,0,0,.7);text-shadow:0 1px 0 #1a0c04`, "color:#ffd27a"),
    view: (r) => ({ far: (() => { const l = L(); houses(l, l, r, 100, [24, 40], { steeple: 0.4 }); return l; })(), vars: "--hf:46%;" }),
    windows: (v) => std(v === 2 ? "rect" : "arch", v === 2 ? 2 : 1, 2, 3, 9, v === 2 ? ";top:13%;aspect-ratio:2/1.15" : ";top:13%;aspect-ratio:1/1.1", v),
    cur: (v) => (v === 1 ? ["#7a2a22", "drape"] : null),
    set: (r, v) => {
      const sd = sideOf(v), fs = sd === "c" ? "r" : other(sd);
      return [
        sd !== "c" ? { p: K.bottleShelf(r, WOOD.walnut, 220), x: 3, at: fs, top: true, y: 17, s: 0.62 } : { p: K.fireplace(r, "#6a5a4e", "#4a2e18", ["candle", "skull", "candle"]), x: 2, at: "l", y: 3, s: 0.9 },
        { p: v % 2 ? K.shield(r) : K.antlers(), x: sd === "c" ? 76 : 44, at: "c", top: true, y: 13, s: 0.62 },
        { p: K.counter(r, "#4a2c16", "#7a4a26", 330, ["tankard", "candle", "tankard", "bottle", "tankard"]), x: 0, at: fs, y: 5, s: 0.86 },
        { p: K.stool("#7a4a26", "#3a2414"), x: 7, at: fs, y: 0, s: 0.95 },
        { p: K.stool("#7a4a26", "#3a2414"), x: 23, at: fs, y: 0, s: 0.95 },
        sd !== "c" && { p: K.barrels(r, 2), x: 1, at: sd, y: 3, s: 0.52 },
        sd !== "c" && { p: K.standingBarrel(), x: 22, at: sd, y: 4, s: 0.8 },
        { p: K.wagonWheel(), x: 50, at: "c", top: true, y: 0, s: 0.72, dim: false, gr: 26 },
        v % 2 === 0 && { p: K.catLoaf(coat(r)), x: 13, at: fs, y: 33, s: 0.62, after: ZZ, afterAnim: ZZA },
      ];
    },
  },
  {
    id: "library",
    css: `&.p .wall{background:${paper("linear-gradient(180deg,#2e3a2a,#161c14)", "#ffffff0d", "damask")}}&.p .wain{height:14%;background:${planks("#4a2c18", 2.6)}}&.p .lamp{background:radial-gradient(26% 40% at 50% 92%,rgba(140,230,150,.3),transparent 70%),radial-gradient(40% 50% at 50% 100%,rgba(255,200,120,.3),transparent 70%)}`
      + sign(`background:linear-gradient(180deg,#24402e,#14281c);border:1px solid #c9a45c;outline:1px solid #c9a45c;outline-offset:2px;border-radius:3px;color:#e8cf8a;font:600 12.5px/1.2 "Cormorant Garamond",Georgia,serif;letter-spacing:.08em;text-transform:uppercase;margin:3px;box-shadow:0 6px 14px -6px rgba(0,0,0,.7)`, "color:#fff0c0;font-weight:700"),
    view: (r) => ({ far: (() => { const l = L(); skyline(l, l, r, "old", 100, [30, 60]); return l; })(), vars: "--hf:46%;" }),
    windows: (v) => ({ ...windowSet(v === 1 ? "lancet" : "arch", v === 2 ? 2 : 1, 2, 4, 8), box: (v === 2 ? "left:50%;right:auto;width:clamp(160px,34%,260px);transform:translateX(-50%)" : "left:50%;right:auto;width:clamp(110px,22%,160px);transform:translateX(-50%)") + ";top:8%;bottom:16%", wx: "50%" }),
    cur: (v) => (v === 3 ? ["#5a1e1e", "drape"] : null),
    set: (r, v) => {
      const big = K.bookcase(r, WOOD.walnut, 120, 200, 5, v % 2 ? "bust" : "globe"), small = K.bookcase(r, WOOD.walnut, 110, 200, 5, v % 2 ? "candle" : "plant");
      return [
      { p: big, x: -2, at: "l", y: 6, s: 1.04 },
      { p: big, x: -2, at: "r", y: 6, s: 1.04, css: "transform:scaleX(-1)" },
      v !== 2 && { p: small, x: 14, at: "l", y: 6, s: 0.96 },
      v !== 2 && { p: small, x: 14, at: "r", y: 6, s: 0.96, css: "transform:scaleX(-1)" },
      { p: K.ladder("#7a4a26", 210), x: v % 2 ? 9 : 24, at: v % 2 ? "r" : "l", y: 4, s: 1 },
      { p: K.chandelier("#c39a4a", 5), x: 50, at: "c", top: true, y: -2, s: 0.62, dim: false, gr: 22 },
      { p: K.table(r, "#5a3418", ["books", "banker", "books"], { w: 170, cloth: undefined }), x: 50, at: "c", y: 3, s: 0.8, glow: "rgba(130,230,150,.5)", gr: 40 },
      { p: K.armchair("#6a1e22", "#3a2414"), x: v % 2 ? 30 : 30, at: v % 2 ? "l" : "r", y: 2, s: 0.82 },
      v % 2 === 1 && { p: K.catLoaf(coat(r)), x: 31, at: "l", y: 27, s: 0.55, after: ZZ, afterAnim: ZZA },
      { p: K2.globeStand(), x: v % 2 ? 31 : 31, at: v % 2 ? "r" : "l", y: 2, s: 0.82 },
      ];
    },
  },
  {
    id: "bedroom",
    css: `&.p .wall{background:${paper("linear-gradient(180deg,#5a4458,#2e2230)", "#ffffff12", "flower")}}&.p .wain{height:15%;background:${planks("#5a3a2a", 4)}}&.p .lamp{background:radial-gradient(30% 50% at var(--shx,30%) 70%,rgba(255,180,110,.3),transparent 70%)}`
      + sign(`background:#f6e8ec;color:#6a3a50;border-radius:14px;border:2px dashed #e4b4c4;font:600 12.5px/1.2 "Fredoka","Nunito",system-ui,sans-serif;box-shadow:0 6px 14px -6px rgba(0,0,0,.6),inset 0 0 0 3px #f6e8ec`, "color:#b03a6a"),
    view: (r) => ({ far: (() => { const l = L(); houses(l, l, r, 100, [26, 40]); return l; })(), vars: "--hf:40%;" }),
    windows: (v) => std("rect", 1, 2, 2, 8, ";top:10%;aspect-ratio:1/1.2", v, (x) => (x === 2 ? 0 : x)),
    cur: (v) => [pick(rng(v + 3), ["#c8607a", "#7a5aa0", "#5a8aa0"]), v === 3 ? "sheer" : "drape"],
    set: (r, v) => {
      const sd = sideOf(v, (x) => (x === 2 ? 0 : x)), fs = sd === "c" ? "l" : other(sd), q = pick(r, ["#c8607a", "#5a7ab0", "#7aa06a", "#e0a040"]);
      return [
        { p: K.painting(r, pick(r, ["land", "night", "flowers", "sea"]), "#c39a4a", 90, 66), x: 14, at: fs, top: true, y: 18, s: 0.7 },
        v === 2 && { p: K.stringLights(r, null, 500, 18, 2), x: 0, at: fs, top: true, y: 8, s: 0.5, dim: false },
        { p: K.bed(r, "#6a3a2a", q), x: 2, at: fs, y: 4, s: 0.95 },
        { p: K.table(r, "#6a3a2a", ["lamp"], { w: 54, h: 50 }), x: 34, at: fs, y: 4, s: 0.95, gr: 44 },
        v % 2 === 0 && { p: K.catLoaf(coat(r)), x: 20, at: fs, y: 30, s: 0.62, after: ZZ, afterAnim: ZZA },
        { p: K.plant(r, pick(r, ["monstera", "fiddle", "snake"])), x: 2, at: sd === "c" ? "r" : sd, y: 3, s: 0.62 },
        { p: K.rug(r, ["#c8a070", "#7a3a3a", "#e8d8b0"], 240), x: 50, at: "c", y: 0, s: 0.8 },
      ];
    },
  },
  {
    id: "chapel",
    css: `&.p .wall{background:repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 2px,transparent 2px 22px),repeating-linear-gradient(90deg,rgba(0,0,0,.2) 0 2px,transparent 2px 44px),linear-gradient(180deg,#46424e,#1c1a22)}&.p .wain{height:13%;${tiles("#3a3640", "rgba(0,0,0,.35)", 40)}}&.p .scene:after{content:"";position:absolute;inset:0;background:conic-gradient(from 30deg at 50% 60%,rgba(200,40,60,.5),rgba(40,90,200,.5),rgba(230,180,40,.5),rgba(40,150,90,.5),rgba(140,50,170,.5),rgba(200,40,60,.5));mix-blend-mode:color;opacity:.85}&.p .lamp{background:radial-gradient(40% 40% at 50% 100%,rgba(255,180,90,.3),transparent 70%)}&.p .ra,&.p .rb{top:0;bottom:0;width:6%;background:linear-gradient(90deg,#141217,#4a4650 40%,#1a181e)}&.p .ra{left:16%}&.p .rb{right:16%;left:auto}&.p .spill{background:linear-gradient(170deg,transparent 30%,rgba(255,220,180,.12) 50%,transparent 70%)}`
      + sign(`background:linear-gradient(180deg,#d8d2c4,#b0a898);color:#3a2a2a;border-radius:3px 3px 12px 12px;font:700 12px/1.2 "Cinzel","Cormorant Garamond",Georgia,serif;letter-spacing:.14em;text-transform:uppercase;box-shadow:inset 0 0 0 1px #8a8070,inset 0 -3px 0 rgba(0,0,0,.15),0 6px 14px -6px rgba(0,0,0,.7)`, "color:#8a1a2a"),
    view: () => ({}),
    windows: (v) => ({ ...windowSet("lancet", v === 2 ? 3 : 1, 2, 3, 8), box: `left:50%;right:auto;width:${v === 2 ? "clamp(180px,40%,300px)" : "clamp(90px,18%,130px)"};transform:translateX(-50%);top:6%;bottom:22%`, wx: "50%" }),
    set: (r, v) => [
      { g: true, x: 42, y: 92, w: 14, ar: 2.4, c: "rgba(220,60,90,.5)", css: "mix-blend-mode:screen;filter:blur(4px)" },
      { g: true, x: 52, y: 95, w: 12, ar: 2.4, c: "rgba(60,120,240,.5)", css: "mix-blend-mode:screen;filter:blur(4px)" },
      { g: true, x: 60, y: 91, w: 11, ar: 2.4, c: "rgba(240,190,60,.5)", css: "mix-blend-mode:screen;filter:blur(4px)" },
      { p: K2.altar(), x: 50, at: "c", y: 8, s: 0.62 },
      { p: K.candelabra("#c39a4a", 130), x: 31, at: "c", y: 6, s: 0.78, dim: false },
      { p: K.candelabra("#c39a4a", 130), x: 69, at: "c", y: 6, s: 0.78, dim: false },
      v === 3 && { p: K2.organ(), x: 2, at: "l", y: 10, s: 0.7 },
      { p: K2.pews("#5a3418", 300, 2), x: -2, at: "l", y: -2, s: 0.82 },
      { p: K2.pews("#5a3418", 300, 2), x: -2, at: "r", y: -2, s: 0.82 },
      { p: K.candles(r, 5), x: 6, at: "r", y: 30, s: 0.6, dim: false },
    ],
  },
  {
    id: "hall",
    css: `&.p .wall{background:repeating-linear-gradient(90deg,rgba(255,215,140,.12) 0 2px,transparent 2px 90px),${paper("linear-gradient(180deg,#5a1a24,#24080e)", "#ffd27a14", "damask", 52)}}&.p .wain{height:20%;${checker("#e8dcc6", "#1c1418")};filter:brightness(.75)}&.p .wain:after{content:"";position:absolute;left:44%;right:44%;top:0;bottom:0;background:linear-gradient(90deg,#c9a45c 0 3%,#8a1a24 3% 97%,#c9a45c 97%)}&.p .lamp{background:radial-gradient(30% 34% at 50% 20%,rgba(255,220,150,.45),transparent 70%)}`
      + sign(`background:linear-gradient(180deg,#9a1a2a,#5a0a14);color:#ffe6a8;border:2px solid #d9b45a;border-radius:4px;font:700 12px/1.2 "Cinzel","Cormorant Garamond",Georgia,serif;letter-spacing:.12em;box-shadow:inset 0 0 0 2px #5a0a14,inset 0 0 0 3px #d9b45a88,0 6px 14px -6px rgba(0,0,0,.8)`, "color:#fff"),
    view: (r) => ({ far: forest(L(), r, "cypress", 24, 99, [20, 40]), vars: "--hf:36%;" }),
    windows: (v) => ({ ...windowSet("arch", v === 1 ? 2 : 3, 2, 4, 7, v === 1 ? 120 : 60), box: "left:12%;right:12%;top:7%;bottom:34%", wx: "50%" }),
    cur: () => ["#8a1a24", "drape"],
    set: (r, v) => [
      { p: K.banner("#8a1a24", "⚜"), x: 1, at: "l", top: true, y: 4, s: 0.85 },
      { p: K.banner("#1a3a7a", "♛"), x: 1, at: "r", top: true, y: 4, s: 0.85 },
      { p: K.chandelier("#d9b45a", 7), x: 50, at: "c", top: true, y: -3, s: 0.75, dim: false, gr: 24 },
      { p: K2.throne(v % 2 ? "#1a3a7a" : "#8a1a24"), x: 50, at: "c", y: 10, s: 0.68 },
      { p: K2.armour(), x: 8, at: "l", y: 6, s: 0.82 },
      { p: K2.armour(), x: 8, at: "r", y: 6, s: 0.82, css: "transform:scaleX(-1)" },
      { p: K.candelabra(), x: 34, at: "c", y: 8, s: 0.6, dim: false },
      { p: K.candelabra(), x: 66, at: "c", y: 8, s: 0.6, dim: false },
    ],
  },
  {
    id: "lab",
    css: `&.p .wall{background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 30px),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 30px),linear-gradient(180deg,#22343e,#0c1418)}&.p .wain{height:15%;${tiles("#2a3a40", "rgba(120,240,255,.18)", 30)}}&.p .lamp{background:linear-gradient(180deg,rgba(200,250,255,.22),transparent 26%)}`
      + sign(`background:#041410;color:#5affb0;border:1px solid #5affb066;border-radius:4px;font:500 12px/1.2 "DM Mono",ui-monospace,monospace;text-shadow:0 0 6px #5affb0;box-shadow:0 0 14px rgba(90,255,176,.25),inset 0 0 12px rgba(90,255,176,.12)`, "color:#d8fff0") + `&.p .crumb:after{content:"▍";color:#5affb0;margin-left:-2px}` + MOTION(`&.p .crumb:after{animation:blink 1s steps(2) infinite}`),
    view: (r) => { const l = L(); skyline(l, l, r, "future", 100, [30, 70]); return { far: l, vars: "--hf:56%;" }; },
    windows: (v) => ({ ...windowSet("round", 1, v + 2, 1, 6), box: "left:auto;right:5%;width:clamp(220px,46%,400px);top:9%;bottom:40%", wx: "75%" }),
    set: (r, v) => [
      { p: K2.monitors(160, pick(r, ["graph", "code", "map"])), x: 4, at: "l", top: true, y: 18, s: 0.72, dim: false, gr: 40 },
      { p: K2.specimenTank(), x: 1, at: "r", y: 4, s: 0.92, dim: false, glow: "rgba(90,255,176,.5)", gr: 60 },
      { p: K2.labBench(r, 300), x: 0, at: "l", y: 3, s: 0.92 },
      v % 2 === 0 && { p: K.pendant("#d8dade", 30, "cone"), x: 22, at: "l", top: true, y: 0, s: 0.8, dim: false, gr: 26 },
      { p: K2.officeChair("#1a2a3a"), x: 38, at: "l", y: 1, s: 0.7 },
    ],
  },
  {
    id: "train",
    css: `&.p .sill:before{display:none}&.p .wall{background:linear-gradient(180deg,#4a3226,#1e1410)}&.p .wain{height:20%;background:repeating-linear-gradient(90deg,#5a1e22 0 18px,#4a161a 18px 36px),linear-gradient(#5a1e22,#2a0c10)}&.p .scene .land{-webkit-mask-size:800px 100%;mask-size:800px 100%}@media (prefers-reduced-motion:no-preference){&.p .scene .far{animation:pan 30s linear infinite}&.p .scene .mid{animation:pan 9s linear infinite}&.p .scene .near{animation:pan 2.6s linear infinite}&.p .scene{animation:rattle .5s steps(2) infinite}}&.p .lamp{background:radial-gradient(14% 30% at 12% 20%,rgba(255,200,120,.6),transparent 70%),radial-gradient(14% 30% at 88% 20%,rgba(255,200,120,.6),transparent 70%)}`
      + sign(`background:#f4ecd8;color:#1a2a5a;border:3px solid #a8282a;border-radius:999px;font:700 11.5px/1.2 "Gill Sans","Gill Sans MT","Trebuchet MS",sans-serif;letter-spacing:.12em;text-transform:uppercase;box-shadow:inset 0 0 0 1.5px #f4ecd8,inset 0 0 0 2.5px #1a2a5a,0 6px 14px -6px rgba(0,0,0,.7)`, "color:#a8282a"),
    view: (r) => { const near = L(); let d = ""; for (let x = 20; x < W; x += 200) { d += `M${x} 100V20M${x - 8} 26H${x + 8}`; } near.line(2.2, d); near.line(0.8, "M0 30Q100 40 200 30Q300 40 400 30Q500 40 600 30Q700 40 800 30"); return { far: hills(L(), r, 4, 40, 80), mid: forest(L(), r, "mixed", 24, 99, [20, 40]), near, vars: "--hf:46%;--hm:40%;--hn:70%;" }; },
    windows: (v) => ({ ...windowSet("round", v === 3 ? 1 : 2, 1, 1, 8), box: "left:16%;right:16%;top:22%;bottom:36%", wx: "50%" }),
    cur: () => ["#7a2a2a", "drape"],
    set: (r, v) => [
      { p: K2.luggageRack(r, 420), x: 50, at: "c", top: true, y: 2, s: 0.62 },
      { p: K2.trainSeat("#7a2a2a", "r"), x: -1, at: "l", y: 0, s: 1.25 },
      { p: K2.trainSeat("#7a2a2a", "l"), x: -1, at: "r", y: 0, s: 1.25 },
      { p: K.table(r, "#5a3418", v % 2 ? ["teapot", "mug", "mug"] : ["mug", "books", "glass"], { w: 140, h: 40, cloth: "#efe6d6" }), x: 50, at: "c", y: 16, s: 0.82, anim: "rattle .5s steps(2) infinite" },
      { p: K.pendant("#f0d8a0", 4, "globe"), x: 9, at: "l", top: true, y: 18, s: 0.7, dim: false, gr: 30 },
      { p: K.pendant("#f0d8a0", 4, "globe"), x: 9, at: "r", top: true, y: 18, s: 0.7, dim: false, gr: 30 },
    ],
  },
  {
    id: "home",
    css: `&.p .wall{background:${wainscot(62, "#e8e0d0", "#d8cfbf")},linear-gradient(180deg,#8a9a8c,#5a6a5c)}&.p .walldim{background:#0a0c14}&.p .wain{height:15%;background:${planks("#8a5a36", 4)}}&.p .lamp{background:radial-gradient(30% 50% at 33% 46%,rgba(255,210,140,.35),transparent 70%)}`
      + sign(`background:repeating-linear-gradient(90deg,#8a6a3a 0 2px,#a8844a 2px 4px);color:#2a1a0a;border-radius:6px;border:3px solid #5a3a1a;font:800 12px/1.2 "Fredoka","Nunito",system-ui,sans-serif;letter-spacing:.04em;text-shadow:0 1px 0 rgba(255,230,180,.6);box-shadow:0 6px 14px -6px rgba(0,0,0,.7)`, "color:#fff4d8;text-shadow:0 1px 0 #2a1a0a"),
    view: (r) => { const l = L(); skyline(l, l, r, "modern", 100, [30, 66]); return { far: l, vars: "--hf:56%;" }; },
    windows: (v) => std("rect", v === 2 ? 2 : 1, 3, 2, 6, ";top:12%;bottom:36%", v),
    cur: (v) => [pick(rng(v + 11), ["#e8d8b8", "#a8c8d8", "#d8a8a0"]), v % 2 ? "sheer" : "drape"],
    set: (r, v) => {
      const sd = sideOf(v), fs = sd === "c" ? "l" : other(sd), fab = pick(r, ["#4a6a8a", "#8a4a3a", "#5a7a5a", "#c8a050"]);
      return [
        { p: K.painting(r, pick(r, ["abstract", "land", "sea", "poster"]), "#2a2a2a", 80, 60), x: 12, at: fs, top: true, y: 16, s: 0.75 },
        { p: K.painting(r, pick(r, ["abstract", "flowers", "poster"]), "#c39a4a", 44, 56), x: 31, at: fs, top: true, y: 20, s: 0.6 },
        { p: K2.tv(), x: sd === "c" ? 2 : 34, at: sd === "c" ? "r" : fs, y: 4, s: 0.62, dim: false, era: "modern|future", gr: 54 },
        { p: K.fireplace(r, "#7a6a5e", "#5a3a22", ["vase", "candle", "books"]), x: sd === "c" ? 2 : 32, at: sd === "c" ? "r" : fs, y: 3, s: 0.72, era: "old|deco" },
        { p: K.sofa(r, fab), x: 2, at: fs, y: 2, s: 0.95 },
        { p: K.floorLamp("#f0d8a0"), x: 0.5, at: fs, y: 3, s: 0.92, dim: false, gr: 40 },
        { p: K.table(r, "#5a3a22", ["mug", "books"], { w: 110, h: 34 }), x: 27, at: fs, y: 1, s: 0.8 },
        { p: K.plant(r, pick(r, ["monstera", "fiddle", "snake", "palm"])), x: 1, at: sd === "c" ? "r" : sd, y: 2, s: 0.78 },
        v !== 1 && { p: K.catLoaf(coat(r)), x: 9, at: fs, y: 26, s: 0.58, after: ZZ, afterAnim: ZZA },
        v === 1 && cat(r, 22, 37, "r", 0.6, true),
      ];
    },
  },
  {
    id: "tent",
    css: `&.p .wall{background:repeating-linear-gradient(100deg,rgba(0,0,0,.12) 0 18px,transparent 18px 60px),radial-gradient(60% 80% at 50% 0%,#8a7044,transparent),linear-gradient(180deg,#7a6038,#2e2214)}&.p .wain{height:14%;background:repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 1px,transparent 1px 30px),linear-gradient(#5a4a2a,#2a2010)}&.p .lamp{background:radial-gradient(18% 30% at 24% 34%,rgba(255,190,100,.55),transparent 70%)}&.p .ra{left:50%;width:4px;top:0;height:12%;background:#2a1a0a}`
      + sign(`background:#e8dcc0;color:#3a2a14;border:2px dashed #8a6a3a;border-radius:3px;outline:3px solid #e8dcc0;font:700 11.5px/1.2 "Special Elite","Courier New",monospace;letter-spacing:.06em;text-transform:uppercase;box-shadow:0 6px 14px -6px rgba(0,0,0,.7)`, "color:#8a2a1a"),
    view: (r) => ({ far: hills(L(), r, 4, 40, 80), mid: (() => { const l = L(); tents(l, r, 100, 5, 1.2); return l; })(), vars: "--hf:46%;--hm:50%;" }),
    windows: () => ({ ...windowSet("tri", 1, 1, 1, 4), box: "left:50%;right:auto;width:clamp(150px,32%,240px);transform:translateX(-50%);top:4%;bottom:14%", wx: "50%" }),
    set: (r, v) => [
      { p: K.rug(r, ["#7a2a1a", "#c8944a", "#2a3a5a"], 300), x: 50, at: "c", y: -3, s: 0.9 },
      { p: K.lantern(), x: 41, at: "l", top: true, y: 6, s: 0.85, dim: false, gr: 50, css: "transform-origin:50% 0", anim: "swing 5s ease-in-out infinite alternate" },
      { p: K.shield(r), x: 4, at: v % 2 ? "l" : "r", top: true, y: 24, s: 0.6 },
      { p: K.table(r, "#6a4a2a", ["map", "candle", "chess", "candle"], { w: 200, h: 54 }), x: 50, at: "c", y: 2, s: 0.82 },
      { p: K.chair("#5a3a20", "#7a2a1a"), x: 36, at: "c", y: 1, s: 0.75 },
      { p: K2.cot("#5a6a4a", "#6a5030"), x: 0, at: v % 2 ? "l" : "r", y: 2, s: 0.8 },
      { p: K.banner(v % 2 ? "#1a3a7a" : "#7a1a1a", "⚔", 36, 110), x: 3, at: v % 2 ? "r" : "l", top: true, y: 14, s: 0.8 },
      { p: K2.seaChest("#4a3a2a"), x: 10, at: v % 2 ? "r" : "l", y: 2, s: 0.75 },
    ],
  },
  {
    id: "kitchen",
    css: `&.p .wall{background:linear-gradient(180deg,transparent 52%,rgba(0,0,0,.25) 52% 53%,transparent 53%),repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 1px,transparent 1px 16px),repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 1px,transparent 1px 16px),linear-gradient(180deg,#e8e0c8 0 30%,#c8c0a8)}&.p .walldim{background:#0a0a14}&.p .wain{height:14%;${checker("#e8e2d4", "#3a3a40", 40)}}&.p .rb{left:0;right:0;top:0;height:12%;background:repeating-linear-gradient(90deg,#6a4a2e 0 2px,#8a6a46 2px 16%);box-shadow:0 6px 12px rgba(0,0,0,.4)}`
      + sign(`background:#fffdf4;color:#3a2a1a;border-radius:3px;font:600 12.5px/1.2 "Caveat","Patrick Hand","Comic Sans MS",cursive;font-size:15px;background-image:repeating-linear-gradient(180deg,transparent 0 13px,#a8c8e8 13px 14px),linear-gradient(90deg,transparent 14px,#f4a0a0 14px 15px,transparent 15px);padding-left:20px;box-shadow:0 6px 14px -6px rgba(0,0,0,.7);transform:rotate(-1deg)`, "color:#c83a2a"),
    view: (r) => ({ far: (() => { const l = L(); houses(l, l, r, 100, [26, 40]); return l; })(), vars: "--hf:46%;" }),
    windows: (v) => std("rect", 1, 2, 2, 7, ";top:15%;bottom:48%", v, (x) => (x === 3 ? 0 : x)),
    cur: () => ["#d84a3a", "cafe"],
    set: (r, v) => {
      const sd = sideOf(v, (x) => (x === 3 ? 0 : x)), fs = other(sd);
      return [
        { p: K.hangingPans(r, 260), x: 8, at: fs, top: true, y: 11, s: 0.7 },
        { p: K.counter(r, "#6a4a2e", "#c8c0b0", 800, ["plant", "fruit", "mug", "books", "bottle", "teapot", "plant"]), x: 50, at: "c", y: 3, s: 0.92 },
        { p: K.stove("range"), x: 3, at: fs, y: 4, s: 0.95, era: "old|deco", gr: 40 },
        { p: K.stove("modern"), x: 3, at: fs, y: 4, s: 0.95, era: "modern|future" },
        { p: K2.fridge(r), x: 0.5, at: sd, y: 4, s: 1.05, era: "modern|future" },
        { p: K.jarShelf(r, "#6a4a2e", 120, 3, "plates"), x: 1, at: sd, top: true, y: 14, s: 0.72, era: "old|deco" },
        { p: K.herbs(r, 150), x: 50, at: "c", top: true, y: 13, s: 0.5 },
        v % 2 === 0 && cat(r, 38, 37, fs, 0.55, true),
      ];
    },
  },
  {
    id: "office",
    css: `&.p .wall{background:${wainscot(64, "#3a3e44", "#2a2e34")},linear-gradient(180deg,#4a5260,#252a32)}&.p .wf{background:linear-gradient(180deg,#c9ccd2,#7a7f88)}&.p .wain{height:14%;background:repeating-linear-gradient(90deg,rgba(0,0,0,.2) 0 1px,transparent 1px 6px),linear-gradient(#3a4250,#1e232c)}&.p .lamp{background:linear-gradient(180deg,rgba(220,235,255,.18),transparent 22%)}`
      + sign(`background:linear-gradient(180deg,#f0d890,#b8902e 60%,#e8c870);color:#2a1e08;border-radius:3px;font:700 11.5px/1.2 "Cinzel","Times New Roman",serif;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 1px 0 rgba(255,255,255,.5);box-shadow:inset 0 0 0 1px #8a6a1e,0 2px 0 #5a4210,0 8px 16px -6px rgba(0,0,0,.7)`, "color:#000"),
    view: (r) => { const l = L(), w = L(); skyline(l, w, r, "modern", 100, [30, 70], 1.3); return { far: l, win: w, winOn: "far", vars: "--hf:66%;" }; },
    windows: (v) => std("rect", v === 2 ? 2 : 1, 1, 14, 6, ";top:10%;bottom:36%", v),
    set: (r, v) => {
      const sd = sideOf(v), fs = sd === "c" ? "l" : other(sd);
      return [
        { p: K.corkboard(r, 130, 90, true), x: 16, at: fs, top: true, y: 14, s: 0.72 },
        { p: K.wallClock("#2a2a2a", "#f4efe4", 10, 10), x: 40, at: fs, top: true, y: 8, s: 0.55 },
        { p: K2.filingCabinet(), x: 1, at: fs, y: 4, s: 0.85 },
        { p: K2.officeChair(), x: 30, at: fs, y: 1, s: 0.78 },
        { p: K.desk(r, "#4a3a2e", ["papers", "computer", "mug"]), x: 14, at: fs, y: 3, s: 0.92, era: "modern|future", dim: false },
        { p: K.desk(r, "#4a2e1a", ["banker", "typewriter", "papers"]), x: 14, at: fs, y: 3, s: 0.92, era: "old|deco", glow: "rgba(130,230,150,.5)", gr: 40 },
        { p: K.plant(r, "snake", "#e8e4dc"), x: 2, at: sd === "c" ? "r" : sd, y: 3, s: 0.6 },
        v % 2 === 1 && { p: K2.waterCooler(), x: 14, at: sd === "c" ? "r" : sd, y: 4, s: 0.72 },
      ];
    },
  },
  {
    id: "cafe",
    css: `&.p .wall{background:${wainscot(58, "#3a2414", "#5a3a22")},repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0 1px,transparent 1px 10px),repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 1px,transparent 1px 22px),linear-gradient(180deg,#e8dcc4,#c8b898)}&.p .walldim{background:#0a0810}&.p .rb{left:0;right:0;top:0;height:11%;background:repeating-linear-gradient(90deg,#b8382e 0 26px,#efe4d0 26px 52px);-webkit-mask:radial-gradient(14px 10px at 13px 100%,transparent 98%,#000) 0 0/26px 100%;mask:radial-gradient(14px 10px at 13px 100%,transparent 98%,#000) 0 0/26px 100%;filter:brightness(calc(.6 + (1 - var(--lit)) * .4))}&.p .wain{height:13%;${checker("#efe6d6", "#2a2420", 36)}}`
      + sign(`background:#1e2422;color:#f4f0e4;border:4px solid #7a5230;border-radius:4px;font:700 13px/1.2 "Caveat","Patrick Hand","Comic Sans MS",cursive;font-size:15.5px;box-shadow:inset 0 0 18px rgba(255,255,255,.06),0 6px 14px -6px rgba(0,0,0,.7)`, "color:#f4d87a"),
    view: (r) => ({ far: (() => { const l = L(); houses(l, l, r, 100, [30, 46], { gap: [-2, 4] }); return l; })(), near: (() => { const l = L(); lampPosts(l, 100, 220, 60, 90); return l; })(), vars: "--hf:66%;--hn:64%;" }),
    windows: (v) => ({ ...windowSet("rect", 1, 3, 1, 8), box: (v % 2 ? "left:4%;right:auto;width:52%" : "left:auto;right:4%;width:52%") + ";top:14%;bottom:44%", wx: v % 2 ? "30%" : "70%" }),
    cur: () => ["#2a6a4a", "cafe"],
    set: (r, v) => {
      const fs = v % 2 ? "r" : "l", sd = other(fs);
      return [
        { p: K.chalkboard(r, 120, 100, "menu"), x: 4, at: fs, top: true, y: 14, s: 0.72 },
        { p: K.pendant("#2a4a3a", 24, "cone"), x: 30, at: "c", top: true, y: 0, s: 0.75, dim: false, gr: 32 },
        { p: K.pendant("#2a4a3a", 34, "cone"), x: 50, at: "c", top: true, y: 0, s: 0.75, dim: false, gr: 32 },
        { p: K.pendant("#2a4a3a", 24, "cone"), x: 70, at: "c", top: true, y: 0, s: 0.75, dim: false, gr: 32 },
        { p: K.hangingPlant(r), x: 3, at: sd, top: true, y: 8, s: 0.62 },
        { p: K.counter(r, "#5a3a22", "#2a2420", 360, []), x: -2, at: fs, y: 3, s: 0.9 },
        { p: K2.espresso(), x: 3, at: fs, y: 33, s: 0.62 },
        { p: K2.pastryCase(r, 160), x: 20, at: fs, y: 33, s: 0.62 },
        { p: K.table(r, "#2a2420", ["mug", "cake"], { w: 90, h: 64, round: true }), x: 12, at: sd, y: 2, s: 0.82 },
        { p: K.chair("#2a2420", "#5a3a22"), x: 4, at: sd, y: 1, s: 0.8 },
        { p: K.chair("#2a2420", "#5a3a22"), x: 29, at: sd, y: 1, s: 0.8, css: "transform:scaleX(-1)" },
      ];
    },
  },
  {
    id: "club",
    css: `&.p .wall{background:radial-gradient(70% 60% at 50% 0%,#3a124a,#07040c 70%)}&.p .walldim{opacity:0}&.p .rd{inset:9% 7% auto 7%;height:3px;border-radius:3px;background:#ff4fd8;box-shadow:0 0 10px 3px #ff4fd8,0 0 30px 8px rgba(255,79,216,.5)}&.p .ra{left:calc(50% - 18px);top:4%;width:36px;height:36px;border-radius:50%;background:repeating-conic-gradient(#e8e8e8 0 10deg,#5a5a6a 10deg 20deg);box-shadow:0 0 30px 8px rgba(255,255,255,.35)}&.p .rb{inset:0;background:conic-gradient(from 160deg at 50% 6%,transparent 0 10deg,rgba(255,80,220,.22) 12deg 18deg,transparent 20deg 30deg,rgba(80,240,255,.2) 32deg 38deg,transparent 40deg);mix-blend-mode:screen;transform-origin:50% 6%}&.p .rc{inset:0;background:radial-gradient(3px 3px at 20% 30%,#fff,transparent),radial-gradient(3px 3px at 70% 20%,#4ff0ff,transparent),radial-gradient(3px 3px at 40% 60%,#ff4fd8,transparent),radial-gradient(3px 3px at 85% 50%,#fff,transparent);background-size:240px 160px}&.p .wain{height:16%;${checker("#2a0a3a", "#120618", 38)};box-shadow:inset 0 0 40px rgba(255,79,216,.25)}&.p .lamp{opacity:1;background:radial-gradient(40% 30% at 50% 100%,rgba(255,79,216,.3),transparent 70%)}@media (prefers-reduced-motion:no-preference){&.p .rb{animation:sweep 6s ease-in-out infinite alternate}&.p .ra{animation:spin 8s linear infinite}&.p .rd{animation:flicker 2.4s ease-in-out infinite}&.p .rc{animation:disco 12s linear infinite}}`
      + sign(`background:#0a0410;color:#ffd8f8;border:2px solid #ff4fd8;border-radius:999px;font:700 12.5px/1.2 "Pacifico","Lobster","Brush Script MT",cursive;letter-spacing:.03em;text-shadow:0 0 4px #ff4fd8,0 0 12px #ff4fd8;box-shadow:0 0 10px #ff4fd8,inset 0 0 10px rgba(255,79,216,.4)`, "color:#c8fbff;text-shadow:0 0 4px #4ff0ff,0 0 12px #4ff0ff") + MOTION(`&.p .crumb{animation:flicker 3.4s ease-in-out infinite}`),
    view: () => ({}),
    windows: () => null,
    set: (r, v) => [
      { p: K2.neon(pick(r, ["DANCE", "★ LIVE ★", "LOVE", "♥"]), v % 2 ? "#4ff0ff" : "#ff4fd8", 160, 50), x: 5, at: v % 2 ? "r" : "l", top: true, y: 16, s: 0.7, dim: false, css: "filter:drop-shadow(0 0 8px currentColor)", anim: "flicker 3s ease-in-out infinite" },
      { p: K2.speaker(170), x: 1, at: "l", y: 6, s: 0.85 },
      { p: K2.speaker(170), x: 1, at: "r", y: 6, s: 0.85 },
      { p: K2.djBooth(r), x: 50, at: "c", y: 12, s: 0.72, dim: false },
      { p: K.crowd(r, 800, true, "#06030a"), x: 50, at: "c", y: -3, s: 1.2, anim: "bounce .5s ease-in-out infinite alternate" },
      { p: K.crowd(r, 800, true, "#000000"), x: 46, at: "c", y: -9, s: 1.45, anim: "bounce .5s ease-in-out .25s infinite alternate" },
    ],
  },
  {
    id: "classroom",
    css: `&.p .wall{background:${wainscot(60, "#7a5a3a", "#9a8a6a")},linear-gradient(180deg,#d8d4b8,#a8a488)}&.p .walldim{background:#0a0a14}&.p .wain{height:14%;${tiles("#8a8a7a", "rgba(0,0,0,.18)", 38)}}`
      + sign(`background:#2e4a3a;color:#f0f2e8;border:4px solid #7a5230;border-radius:3px;font:600 13px/1.2 "Caveat","Patrick Hand","Comic Sans MS",cursive;font-size:15px;box-shadow:inset 0 0 14px rgba(255,255,255,.08),0 6px 14px -6px rgba(0,0,0,.7)`, "color:#f4d87a;text-decoration:underline wavy #f4a8b8"),
    view: (r) => ({ far: forest(L(), r, "round", 20, 99, [20, 40]), mid: hills(L(), r, 3, 70, 92), vars: "--hf:46%;--hm:24%;" }),
    windows: (v) => ({ ...windowSet("rect", 3, 2, 3, 6), box: (v % 2 ? "left:4%;right:auto" : "left:auto;right:4%") + ";width:42%;top:10%;bottom:40%", wx: v % 2 ? "25%" : "75%" }),
    set: (r, v) => {
      const fs = v % 2 ? "r" : "l";
      return [
        { p: K.chalkboard(r, 200, 110, "lesson"), x: 4, at: fs, top: true, y: 13, s: 0.82 },
        { p: K.wallClock("#1a1a1a", "#f4efe4", 9, 15), x: 50, at: "c", top: true, y: 6, s: 0.5 },
        { p: K.bunting(r, ["#e83a3a", "#f4c42a", "#3a8ae8", "#5ac06a", "#e85ad8"], 800, 12, 3), x: 50, at: "c", top: true, y: 0, s: 0.42, dim: false },
        { p: K2.schoolDesks(r, 4), x: 50, at: "c", y: -1, s: 0.9 },
        { p: K2.globeStand(), x: 2, at: v % 2 ? "l" : "r", y: 30, s: 0.6 },
        { p: K.desk(r, "#7a5a3a", ["books", "fruit", "papers"], 160), x: 1, at: v % 2 ? "l" : "r", y: 4, s: 0.75 },
      ];
    },
  },
  {
    id: "ward",
    css: `&.p .wall{background:linear-gradient(180deg,transparent 56%,#c8d8d4 56% 57.5%,transparent 57.5%),linear-gradient(180deg,#a8c0bc,#6a8480)}&.p .walldim{background:#06100e}&.p .wain{height:13%;${tiles("#c8d0cc", "rgba(0,0,0,.15)", 36)}}&.p .rb{left:calc(var(--shx) - 4%);width:20%;top:3%;bottom:10%;background:repeating-linear-gradient(90deg,#9ab6b0 0 10px,#6e8a84 10px 16px,#9ab6b0 16px 24px);border-top:4px solid #ccc;opacity:.92}&.p .ra{left:auto;right:calc(100% - var(--shx) - 50%);top:16%;width:72px;height:50px;border-radius:6px;border:3px solid #2a2e34;background:#071810;overflow:hidden;box-shadow:0 0 18px rgba(106,255,154,.25)}&.p .ra:after{content:"";position:absolute;inset:0;background:linear-gradient(#6aff9a,#6aff9a) center/100% 2px no-repeat,linear-gradient(#6aff9a,#6aff9a) 30% 30%/2px 40% no-repeat,linear-gradient(#6aff9a,#6aff9a) 34% 70%/2px 30% no-repeat;filter:drop-shadow(0 0 3px #6aff9a)}&.p .lamp{background:linear-gradient(180deg,rgba(230,255,250,.25),transparent 30%)}@media (prefers-reduced-motion:no-preference){&.p .ra:after{animation:ecg 1.6s linear infinite}}`
      + sign(`background:#fff;color:#1a3a6a;border-radius:999px;border:2px solid #8ab8e8;font:700 11.5px/1.2 "DM Mono",ui-monospace,monospace;background-image:linear-gradient(90deg,#8ab8e8 0 10px,transparent 10px);padding-left:18px;box-shadow:0 6px 14px -6px rgba(0,0,0,.6)`, "color:#c82a3a"),
    view: (r) => ({ far: (() => { const l = L(); skyline(l, l, r, "modern", 100, [24, 60]); return l; })(), vars: "--hf:50%;" }),
    windows: (v) => std("rect", 1, 1, 10, 6, ";top:10%;bottom:40%", v, (x) => (x === 3 ? 1 : x)),
    set: (r, v) => {
      const sd = sideOf(v, (x) => (x === 3 ? 1 : x)), fs = other(sd);
      return [
        { p: K2.hospitalBed(), x: 6, at: fs, y: 3, s: 0.88 },
        { p: K2.ivStand(), x: 2, at: fs, y: 3, s: 0.92 },
        { p: K.table(r, "#c8ccd0", ["vase", "glass"], { w: 70, h: 54 }), x: 40, at: fs, y: 3, s: 0.8 },
        { p: K2.balloon(pick(r, ["#ff5a7a", "#5ab0ff", "#ffd24a"]), "♥"), x: 46, at: fs, y: 30, s: 0.62, css: "transform-origin:50% 100%", anim: "swing 4s ease-in-out infinite alternate" },
        v % 2 === 0 && { p: K.chair("#8a9a98", "#5a7a8a"), x: 3, at: sd, y: 2, s: 0.82 },
      ];
    },
  },
  {
    id: "cell",
    css: `&.p .wall{background:repeating-linear-gradient(0deg,rgba(0,0,0,.35) 0 2px,transparent 2px 30px),repeating-linear-gradient(90deg,rgba(0,0,0,.3) 0 2px,transparent 2px 60px),radial-gradient(30% 30% at 70% 60%,rgba(60,50,30,.3),transparent),linear-gradient(180deg,#4a4842,#1a1916)}&.p .wf{background:#1a1a1c}&.p .wain{height:11%;background:linear-gradient(#24221e,#100f0d)}&.p .lamp{background:none}&.p .spill{opacity:calc(.3 + (1 - var(--lit)) * .7);background:linear-gradient(160deg,transparent 30%,rgba(255,250,230,.14) 40%,transparent 56%)}`
      + sign(`background:#c8c4b8;color:#1a1a1a;border-radius:2px;font:700 12px/1.2 "Stardos Stencil","Black Ops One",Impact,sans-serif;letter-spacing:.16em;text-transform:uppercase;box-shadow:inset 0 0 0 2px #1a1a1a,inset 0 0 0 4px #c8c4b8,inset 0 0 0 5px #1a1a1a,0 6px 14px -6px rgba(0,0,0,.8)`, "color:#8a1a1a"),
    view: () => ({}),
    windows: (v) => ({ ...windowSet("rect", 1, 4, 1, 10), box: (v % 2 ? "left:20%;right:auto" : "left:auto;right:20%") + ";width:clamp(80px,18%,130px);top:9%;aspect-ratio:2/1", wx: v % 2 ? "28%" : "72%" }),
    set: (r, v) => {
      const fs = v % 2 ? "r" : "l";
      return [
        { p: K2.tally(19 + Math.floor(r() * 30)), x: 8, at: fs, top: true, y: 26, s: 0.8, css: "opacity:.8" },
        { p: K2.chains(), x: 38, at: fs, top: true, y: 30, s: 0.6 },
        { p: K2.cot("#4a4a3a", "#3a3c42"), x: 2, at: fs, y: 4, s: 0.85 },
        { p: K2.bucket(), x: 34, at: fs, y: 2, s: 0.7 },
        { p: K.pendant("#fff4cc", 30, "bare"), x: 50, at: "c", top: true, y: 0, s: 0.75, dim: false, gr: 46, css: "transform-origin:50% 0", anim: "swing 3.4s ease-in-out infinite alternate" },
        { p: K2.cellBars(240, 258), x: -2, at: v % 2 ? "l" : "r", y: 0, s: 1.02 },
      ];
    },
  },
  {
    id: "cabin",
    css: `&.p .sill:before{display:none}&.p .wall{background:repeating-linear-gradient(0deg,rgba(0,0,0,.3) 0 2px,transparent 2px 26px),${beams("#2a180c", 6)},linear-gradient(180deg,#6a4426,#2a180c)}&.p .wf{background:radial-gradient(circle,#d9b45a,#7a5a2a)}&.p .wain{height:14%;background:${planks("#4a2e18", 3)}}&.p .lamp{background:radial-gradient(24% 40% at 50% 36%,rgba(255,190,100,.45),transparent 70%)}@media (prefers-reduced-motion:no-preference){&.p .scene .land,&.p .scene .water{animation:sway 7s ease-in-out infinite alternate}}`
      + sign(`background:linear-gradient(180deg,#e8c46a,#a8822a);color:#2a1a08;border-radius:999px;border:3px double #5a3a14;font:700 11.5px/1.2 "Cinzel","Times New Roman",serif;letter-spacing:.1em;text-transform:uppercase;box-shadow:0 0 0 3px #c8a46a55,0 6px 14px -6px rgba(0,0,0,.7)`, "color:#5a1a0a"),
    view: (r) => { const near = L(); let d = "M0 100V70"; for (let i = 0; i < 12; i++) d += `Q${i * 66 + 20} ${between(r, 52, 62)} ${(i + 1) * 66.7} 70`; near.path(d + "V100Z"); return { near, vars: "--wl:52%;--hn:30%;" }; },
    windows: (v) => ({ ...windowSet("circle", v === 2 ? 1 : 2, 1, 1, 12), box: (v === 2 ? "left:auto;right:12%;width:clamp(90px,20%,140px);aspect-ratio:1" : "left:auto;right:6%;width:clamp(200px,42%,300px);aspect-ratio:2.2/1") + ";top:14%", wx: "70%" }),
    set: (r, v) => [
      { p: K2.hammock(), x: 1, at: "l", top: true, y: 14, s: 0.9, css: "transform-origin:50% 0", anim: "swing 6s ease-in-out infinite alternate" },
      { p: K.lantern(), x: 44, at: "c", top: true, y: 2, s: 0.85, dim: false, gr: 46, css: "transform-origin:50% 0", anim: "swing 4s ease-in-out infinite alternate" },
      { p: K2.shipInBottle(), x: 4, at: "l", top: true, y: 52, s: 0.7 },
      { p: K.table(r, "#5a3418", ["map", "candle", "glass"], { w: 160, h: 56 }), x: 40, at: "c", y: 3, s: 0.82 },
      { p: K2.seaChest(), x: 2, at: "l", y: 3, s: 0.8 },
      v % 2 === 0 && { p: K.barrels(r, 2), x: 1, at: "r", y: 3, s: 0.45 },
    ],
  },
  {
    id: "bridge",
    css: `&.p .sill:before{display:none}&.p :is(.clouds,.clouds2,.sun,.rays,.glow,.ground,.moon,.rain,.snow,.fog,.windl,.heat,.flash,.fx,.fx2){display:none}&.p .sky{filter:none;background:radial-gradient(50% 50% at 70% 40%,rgba(120,60,200,.35),transparent 70%),#02030a}&.p .stars{opacity:1}&.p .scene .kx{inset:auto;left:58%;top:30%;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at 34% 34%,#9fd3ff,#2a5aa0 50%,#0a1a3a 80%);box-shadow:0 0 30px 6px rgba(120,190,255,.4)}&.p .wall{background:repeating-linear-gradient(90deg,rgba(90,210,255,.06) 0 1px,transparent 1px 60px),linear-gradient(180deg,#1e2430,#0a0d12)}&.p .wf{background:linear-gradient(180deg,#3a4250,#141820)}&.p .wain{height:14%;background:repeating-linear-gradient(90deg,rgba(90,210,255,.12) 0 1px,transparent 1px 24px),linear-gradient(#1a202a,#0a0d12)}&.p .lamp{opacity:1;background:radial-gradient(40% 30% at 50% 100%,rgba(90,210,255,.22),transparent 70%)}`
      + sign(`background:rgba(4,20,30,.7);color:#8ae8ff;border:1px solid #5ad0ff;border-radius:2px;font:600 11.5px/1.2 "Orbitron","Space Grotesk",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 0 6px #5ad0ff;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);box-shadow:inset 0 0 12px rgba(90,210,255,.3)`, "color:#fff"),
    view: () => ({}),
    windows: (v) => ({ ...windowSet("trap", 1, v + 2, 1, 8), box: "left:5%;right:5%;top:6%;bottom:38%", wx: "50%" }),
    set: (r, v) => [
      { p: K2.consoles(r, 360), x: -2, at: "l", y: 3, s: 0.8, dim: false, gr: 24 },
      { p: K2.consoles(r, 360), x: -2, at: "r", y: 3, s: 0.8, dim: false, gr: 24 },
      { p: K2.captainChair(v % 2 ? "#5a1a24" : "#2a2e38"), x: 50, at: "c", y: 0, s: 0.95 },
      { g: true, x: 50, y: 62, w: 18, ar: 1.6, c: "rgba(90,210,255,.4)", css: "mix-blend-mode:screen", anim: "breathe 3s ease-in-out infinite alternate" },
    ],
  },
  {
    id: "car",
    css: `&.p .sill:before{display:none}&.p .wall{background:linear-gradient(180deg,#14161a,#0a0b0d)}&.p .wf{background:#0c0d10}&.p .rc{left:0;right:0;bottom:0;height:30%;border-radius:40% 40% 0 0/30% 30% 0 0;background:radial-gradient(5% 14% at 30% 40%,rgba(255,170,80,.7),transparent 70%),radial-gradient(5% 14% at 40% 40%,rgba(120,220,255,.6),transparent 70%),radial-gradient(4% 10% at 60% 46%,rgba(255,90,90,.5),transparent 70%),linear-gradient(#22252a,#08090a)}&.p .ra{left:calc(var(--shx) + 6%);bottom:-10%;width:26%;aspect-ratio:1;border-radius:50%;border:9px solid #050506;box-shadow:inset 0 0 0 2px #2a2a2e,0 0 0 2px #1a1a1e}&.p .rb{left:calc(50% - 44px);top:6%;width:88px;height:16px;border-radius:6px;background:linear-gradient(#4a4e56,#1a1c20);border:2px solid #000}&.p .lamp{background:radial-gradient(30% 30% at 35% 75%,rgba(255,170,80,.2),transparent 70%)}&.p .wain{display:none}&.p .scene .land{-webkit-mask-size:800px 100%;mask-size:800px 100%}@media (prefers-reduced-motion:no-preference){&.p .scene .far,&.p .scene .lit{animation:pan 40s linear infinite}&.p .scene .near{animation:pan 3s linear infinite}}`
      + sign(`background:linear-gradient(180deg,#f4f4f0,#d8dce0);color:#1a2a6a;border:2px solid #1a1a1a;border-radius:5px;font:700 12px/1.2 "DM Mono",ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;box-shadow:inset 0 0 0 2px #f4f4f0,inset 0 0 0 3px #1a2a6a,0 6px 14px -6px rgba(0,0,0,.8)`, "color:#c82a2a"),
    view: (r) => { const far = L(), win = L(); skyline(far, win, r, "modern", 100, [30, 70]); const near = L(); lampPosts(near, 100, 200, 70, 60); near.rect(0, 96, W, 4); return { far, win, winOn: "far", near, vars: "--hf:56%;--hn:56%;" }; },
    windows: (v) => ({ ...windowSet("trap", 1, 1, 1, 10), box: "left:3%;right:3%;top:5%;bottom:26%", wx: "50%", shx: v % 2 ? "52%" : "8%" }),
    set: (r, v) => [
      { p: v % 2 ? K2.fuzzyDice() : K2.airFreshener(), x: 50, at: "c", top: true, y: 12, s: 0.75, css: "transform-origin:50% 0", anim: "swing 2.2s ease-in-out infinite alternate" },
      { p: K2.wiper(), x: 18, at: "l", y: 30, s: 0.8, css: "transform-origin:0 50%;rotate:-6deg", when: WET, anim: "wipe 1.6s ease-in-out infinite" },
      { p: K2.wiper(), x: 52, at: "l", y: 30, s: 0.8, css: "transform-origin:0 50%;rotate:-6deg", when: WET, anim: "wipe 1.6s ease-in-out .1s infinite" },
    ],
  },
  {
    id: "theater",
    css: `&.p .wall{background:radial-gradient(50% 60% at 50% 40%,#3a1a14,#0c0505 70%)}&.p .walldim{opacity:0}&.p .ra,&.p .rb{top:0;bottom:0;width:22%;background:repeating-linear-gradient(90deg,#7a1018 0 12px,#3a0408 12px 22px,#9a1820 22px 30px);box-shadow:inset 0 0 30px rgba(0,0,0,.6)}&.p .ra{left:0;border-radius:0 0 60% 0}&.p .rb{right:0;left:auto;border-radius:0 0 0 60%}&.p .rc{left:0;right:0;top:0;height:14%;background:repeating-linear-gradient(90deg,#9a1820 0 30px,#5a0a10 30px 60px);-webkit-mask:radial-gradient(18px 12px at 15px 100%,transparent 98%,#000) 0 0/30px 100%;mask:radial-gradient(18px 12px at 15px 100%,transparent 98%,#000) 0 0/30px 100%;border-bottom:3px solid #c9a45c}&.p .rd{left:20%;right:20%;bottom:22%;height:6px;background:radial-gradient(6px 4px at 10% 50%,#ffe9a0,transparent),radial-gradient(6px 4px at 30% 50%,#ffe9a0,transparent),radial-gradient(6px 4px at 50% 50%,#ffe9a0,transparent),radial-gradient(6px 4px at 70% 50%,#ffe9a0,transparent),radial-gradient(6px 4px at 90% 50%,#ffe9a0,transparent);filter:drop-shadow(0 0 6px #ffcf6a)}&.p .lamp{opacity:1;background:conic-gradient(from 166deg at 30% -10%,transparent 0deg,rgba(255,240,200,.22) 6deg 18deg,transparent 24deg),conic-gradient(from 176deg at 70% -10%,transparent 0deg,rgba(255,230,190,.2) 6deg 18deg,transparent 24deg),radial-gradient(30% 22% at 50% 76%,rgba(255,230,170,.35),transparent 70%)}&.p .wain{height:24%;background:${planks("#5a3a20", 2.4)};border-top:3px solid #3a2410}`
      + sign(`background:#1a0c06;color:#ffe9a0;border:2px solid #c9a45c;border-radius:6px;font:700 12px/1.2 "Cinzel","Times New Roman",serif;letter-spacing:.14em;text-transform:uppercase;border:3px dotted #ffe9a0;outline:2px solid #c9a45c;outline-offset:2px;margin:4px;text-shadow:0 0 8px #ffcf6a;box-shadow:0 0 14px rgba(255,207,106,.35),inset 0 0 10px rgba(255,207,106,.2)`, "color:#fff"),
    view: () => ({}),
    windows: () => null,
    set: (r) => [
      { p: K2.ghostLight(), x: 50, at: "c", y: 22, s: 0.62, dim: false, gr: 50 },
      { p: K.crowd(r, 800, false, "#050204"), x: 50, at: "c", y: -4, s: 1.05 },
      { p: K.crowd(r, 800, false, "#000000"), x: 48, at: "c", y: -10, s: 1.3 },
    ],
  },
  {
    id: "shrine",
    css: `&.p .wall{background:linear-gradient(90deg,#2a1c10 0 6px,transparent 6px) 0 0/25% 100%,repeating-linear-gradient(0deg,rgba(60,40,20,.55) 0 2px,transparent 2px 25%),repeating-linear-gradient(90deg,rgba(60,40,20,.55) 0 2px,transparent 2px 12.5%),linear-gradient(180deg,#e8d8b0,#b8a070);filter:brightness(calc(.35 + (1 - var(--lit)) * .45))}&.p .walldim{opacity:0}&.p .lamp{opacity:1;background:radial-gradient(40% 60% at 50% 40%,rgba(255,200,120,calc(.15 + var(--lit) * .35)),transparent 70%)}&.p .wf{background:#2a1c10}&.p .wain{height:15%;background:repeating-linear-gradient(90deg,#3a3a1a 0 2px,transparent 2px 50%),repeating-linear-gradient(90deg,rgba(0,0,0,.08) 0 1px,transparent 1px 3px),linear-gradient(#a8a85a,#5a5a2a);border-top:4px solid #2a1c10}`
      + sign(`background:#f4ecd8;color:#2a1a10;border-left:4px solid #b8282a;border-right:4px solid #b8282a;border-radius:2px;font:600 12.5px/1.2 "Shippori Mincho","Noto Serif JP",Georgia,serif;letter-spacing:.08em;box-shadow:0 6px 14px -6px rgba(0,0,0,.6),inset 0 0 0 1px #d8c8a8`, "color:#b8282a"),
    view: (r) => { const l = L(); skyline(l, l, r, "eastern", 100, [24, 50]); return { far: forest(L(), r, "round", 20, 99, [16, 30]), mid: l, vars: "--hf:40%;--hm:44%;" }; },
    windows: (v) => ({ ...windowSet("circle", 1, 1, 1, 9), box: BOXES[v].box.replace(/width:clamp\([^)]*\)/, "width:clamp(110px,24%,170px)") + ";top:12%;aspect-ratio:1", wx: BOXES[v].wx }),
    set: (r, v) => {
      const sd = SIDE[v], fs = sd === "c" ? "l" : other(sd);
      return [
        { p: K2.scroll(r), x: 6, at: fs, top: true, y: 8, s: 0.82 },
        { p: K.pendant("#e04a2a", 24, "lantern"), x: 24, at: fs, top: true, y: 0, s: 0.95, dim: false, gr: 44, css: "transform-origin:50% 0;filter:hue-rotate(-20deg) saturate(1.4)", anim: "swing 6s ease-in-out infinite alternate" },
        { p: K2.ikebana(r), x: 2, at: sd === "c" ? "r" : sd, y: 6, s: 0.7 },
        { p: K.plant(r, "bonsai"), x: 14, at: sd === "c" ? "r" : sd, y: 6, s: 0.8 },
        { p: K2.zabuton("#7a2a3a"), x: 30, at: "c", y: 2, s: 0.9 },
        { p: K2.zabuton("#2a3a5a"), x: 70, at: "c", y: 2, s: 0.9 },
        { p: K2.lowTable(r), x: 50, at: "c", y: 3, s: 0.85 },
      ];
    },
  },
  {
    id: "attic",
    css: `&.p .wall{background:repeating-linear-gradient(90deg,rgba(0,0,0,.25) 0 2px,transparent 2px 46px),linear-gradient(180deg,#5a4430,#20160e)}&.p .ra,&.p .rb{top:0;width:52%;height:76%;background:repeating-linear-gradient(135deg,rgba(0,0,0,.25) 0 2px,transparent 2px 22px),linear-gradient(#3a2614,#1a1008)}&.p .ra{left:0;clip-path:polygon(0 0,100% 0,0 100%);background:repeating-linear-gradient(45deg,rgba(0,0,0,.25) 0 2px,transparent 2px 22px),linear-gradient(#3a2614,#1a1008)}&.p .rb{right:0;left:auto;clip-path:polygon(0 0,100% 0,100% 100%)}&.p .spill{opacity:calc(.25 + (1 - var(--lit)) * .75);background:linear-gradient(180deg,rgba(255,240,200,.18),transparent 80%) 50% 18%/22% 80% no-repeat}&.p .wain{height:13%;background:${planks("#4a3220", 5)}}`
      + sign(`background:#d8b88a;color:#3a2a1a;border-radius:2px;font:700 12px/1.2 "Permanent Marker","Marker Felt","Comic Sans MS",cursive;letter-spacing:.04em;text-transform:uppercase;transform:rotate(-1.5deg);box-shadow:0 6px 14px -6px rgba(0,0,0,.7);background-image:linear-gradient(90deg,rgba(255,250,220,.55) 0 18px,transparent 18px calc(100% - 18px),rgba(255,250,220,.55) calc(100% - 18px))`, "color:#1a1a1a"),
    view: (r) => ({ far: (() => { const l = L(); houses(l, l, r, 100, [20, 34]); return l; })(), vars: "--hf:50%;" }),
    windows: (v) => ({ ...windowSet(v % 2 ? "circle" : "tri", 1, 2, 2, 7), box: "left:50%;right:auto;width:clamp(80px,16%,120px);transform:translateX(-50%);top:4%;aspect-ratio:1", wx: "50%" }),
    set: (r, v) => [
      { p: K2.cobweb("l"), x: 0, at: "l", top: true, y: 0, s: 0.8, dim: false },
      { p: K2.cobweb("r"), x: 0, at: "r", top: true, y: 0, s: 0.6, dim: false },
      { p: K2.dressForm(), x: v % 2 ? 6 : 26, at: "l", y: 4, s: 0.82 },
      { p: K2.sheetMirror(), x: 6, at: "r", y: 4, s: 0.85 },
      { p: K2.trunk(pick(r, ["#5a3a5a", "#2a4a5a", "#6a2a1a"])), x: 2, at: v % 2 ? "r" : "l", y: 2, s: 0.82 },
      { p: K2.rockingHorse(), x: 50, at: "c", y: 2, s: 0.75 },
      { p: K.crates(r, 3), x: 22, at: "r", y: 2, s: 0.72 },
      { p: K.pendant("#fff4cc", 40, "bare"), x: 64, at: "l", top: true, y: 0, s: 0.7, dim: false, gr: 36 },
    ],
  },
  {
    id: "cellar",
    css: `&.p .wall{background:repeating-linear-gradient(0deg,rgba(0,0,0,.35) 0 2px,transparent 2px 16px),repeating-linear-gradient(90deg,rgba(0,0,0,.25) 0 2px,transparent 2px 34px),linear-gradient(180deg,#5a3424,#1a0e08)}&.p .ra{inset:0;background:radial-gradient(34% 70% at 25% 100%,transparent 60%,#120806 61%),radial-gradient(34% 70% at 75% 100%,transparent 60%,#120806 61%);opacity:.85}&.p .lamp{opacity:1;background:radial-gradient(40% 50% at 50% 40%,rgba(255,170,80,.3),transparent 70%)}&.p .wain{height:10%;background:repeating-linear-gradient(90deg,rgba(0,0,0,.3) 0 2px,transparent 2px 40px),linear-gradient(#2a1810,#120806)}`
      + sign(`background:#2a2622;color:#f0ece0;border-radius:3px;font:700 12px/1.2 "Caveat","Patrick Hand","Comic Sans MS",cursive;font-size:15px;box-shadow:inset 0 0 0 2px #4a4038,0 6px 14px -6px rgba(0,0,0,.8)`, "color:#e8c46a"),
    view: () => ({}),
    windows: () => null,
    set: (r, v) => [
      { p: K2.cobweb("l"), x: 0, at: "l", top: true, y: 0, s: 0.7, dim: false },
      { p: K2.wineRack(r, 6, 6), x: 2, at: v % 2 ? "r" : "l", y: 8, s: 1 },
      { p: K.barrels(r, 3), x: 1, at: v % 2 ? "l" : "r", y: 2, s: 0.62 },
      { p: K.standingBarrel(), x: 46, at: "c", y: 2, s: 0.95 },
      { p: K.candles(r, 3), x: 46, at: "c", y: 25, s: 0.55, dim: false },
      { p: K.pendant("#ffd27a", 50, "lantern"), x: 50, at: "c", top: true, y: 0, s: 0.75, dim: false, gr: 50 },
    ],
  },
  {
    id: "greenhouse",
    css: `&.p .sill:before{display:none}&.p .wall{background:linear-gradient(180deg,#1a2a1c,#0c140c)}&.p .wf{background:linear-gradient(180deg,#f0f2ec,#9aa49a)}&.p .scene:after{content:"";position:absolute;inset:0;background:rgba(160,255,190,.1)}&.p .wain{height:12%;background:repeating-linear-gradient(90deg,rgba(0,0,0,.25) 0 2px,transparent 2px 30px),linear-gradient(#8a6a4a,#4a3422)}&.p .lamp{opacity:calc(var(--lit) * .8);background:radial-gradient(5% 9% at 30% 30%,rgba(255,220,150,.9),transparent 70%),radial-gradient(5% 9% at 70% 30%,rgba(255,220,150,.9),transparent 70%)}`
      + sign(`background:#fdfdf8;color:#2a4a2a;border-radius:3px 3px 50% 50%/3px 3px 14px 14px;padding-bottom:10px;font:600 12.5px/1.2 "Caveat","Patrick Hand","Comic Sans MS",cursive;font-size:15px;box-shadow:0 6px 14px -6px rgba(0,0,0,.6),inset 0 -3px 0 #e8e8e0`, "color:#5a8a2a"),
    view: (r) => ({ far: forest(L(), r, "round", 30, 99, [20, 40]), vars: "--hf:40%;" }),
    windows: (v) => ({ ...windowSet(v % 2 ? "arch" : "rect", 1, 6 + v, 4, 5), box: "left:3%;right:3%;top:4%;bottom:4%", wx: "50%" }),
    set: (r, v) => { const hang = K.hangingPlant(r, "#c06a3a"); return [
      { p: hang, x: 18, at: "c", top: true, y: 0, s: 0.75 },
      { p: hang, x: 82, at: "c", top: true, y: 0, s: 0.68, css: "transform:scaleX(-1)" },
      { p: K2.plantBench(r, 300), x: 0, at: v % 2 ? "r" : "l", y: 2, s: 0.95 },
      { p: K.plant(r, "palm"), x: 0, at: v % 2 ? "l" : "r", y: 2, s: 1.1 },
      { p: K.plant(r, "fern"), x: 16, at: v % 2 ? "l" : "r", y: 1, s: 0.75 },
      { p: K2.wateringCan(), x: 46, at: "c", y: 2, s: 0.75 },
      { p: K2.butterfly("#ff8a2a"), x: 38, at: "l", top: true, y: 34, s: 0.7, anim: "flutter 2.6s ease-in-out infinite alternate" },
      { p: K2.butterfly("#5ab0ff"), x: 30, at: "r", top: true, y: 26, s: 0.55, anim: "flutter 3.2s ease-in-out -1s infinite alternate" },
    ]; },
  },
  {
    id: "shop",
    css: `&.p .wall{background:${paper("linear-gradient(180deg,#5a4430,#2c2014)", "#ffffff10", "stripe", 40)}}&.p .wain{height:13%;background:${planks("#5a3a22", 3)}}&.p .lamp{background:radial-gradient(30% 40% at 50% 20%,rgba(255,210,140,.35),transparent 70%)}`
      + sign(`background:#f4ecd8;color:#3a2a14;border-radius:4px 14px 14px 4px;padding-left:20px;font:700 12px/1.2 "Cormorant Garamond",Georgia,serif;font-size:14px;background-image:radial-gradient(circle at 9px 50%,#1a1a1a 0 3px,#f4ecd8 3.5px);box-shadow:0 6px 14px -6px rgba(0,0,0,.7),inset 0 0 0 1px #c8b88a`, "color:#a82a2a"),
    view: (r) => ({ far: (() => { const l = L(); houses(l, l, r, 100, [30, 46], { gap: [-2, 4] }); return l; })(), vars: "--hf:66%;" }),
    windows: (v) => ({ ...windowSet(v === 1 ? "arch" : "rect", 1, 2, 3, 8), box: (v % 2 ? "left:6%;right:auto" : "left:auto;right:6%") + ";width:30%;top:10%;bottom:36%", wx: v % 2 ? "21%" : "79%" }),
    cur: () => ["#2a5a3a", "drape"],
    set: (r, v) => {
      const fs = v % 2 ? "r" : "l", sd = other(fs);
      return [
        { p: K.jarShelf(r, "#5a3418", 200, 3, v === 2 ? "potions" : pick(r, ["jars", "goods"])), x: 2, at: fs, top: true, y: 12, s: 0.82 },
        { p: K2.shopBell(), x: 2, at: sd, top: true, y: 2, s: 0.7, css: "transform-origin:50% 0", anim: "swing 3s ease-in-out infinite alternate" },
        { p: K.counter(r, "#4a2e18", "#7a5232", 340, ["register", "books", "plant"]), x: 50, at: "c", y: 3, s: 0.9 },
        { p: K2.scale(), x: 58, at: "c", y: 36, s: 0.55 },
        v % 2 === 0 && { p: K.catLoaf(coat(r)), x: 38, at: "c", y: 36, s: 0.55, after: ZZ, afterAnim: ZZA },
        { p: K.pendant("#c39a4a", 30, "dome"), x: 50, at: "c", top: true, y: 0, s: 0.8, dim: false, gr: 34 },
        { p: K.crates(r, 3), x: 1, at: sd, y: 2, s: 0.6 },
      ];
    },
  },
  {
    id: "bath",
    css: `&.p .wall{background:repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 1px,transparent 1px 20px),repeating-linear-gradient(90deg,rgba(0,0,0,.14) 0 1px,transparent 1px 20px),linear-gradient(180deg,transparent 54%,#3a7a8a 54% 56%,transparent 56%),linear-gradient(180deg,#d8eef0,#88b0b6);filter:brightness(calc(.5 + (1 - var(--lit)) * .4))}&.p .scene{filter:blur(3px) saturate(.7)}&.p .wain{height:12%;${tiles("#e8eeee", "rgba(0,0,0,.2)", 24)}}&.p .rb{left:20%;width:60%;bottom:20%;height:56%;background:radial-gradient(30% 30% at 30% 70%,rgba(255,255,255,.35),transparent 70%),radial-gradient(26% 26% at 60% 50%,rgba(255,255,255,.3),transparent 70%),radial-gradient(30% 24% at 45% 24%,rgba(255,255,255,.22),transparent 70%);filter:blur(6px)}&.p .lamp{background:radial-gradient(30% 40% at 50% 20%,rgba(255,240,220,.3),transparent 70%)}@media (prefers-reduced-motion:no-preference){&.p .rb{animation:steam 9s ease-in-out infinite}}`
      + sign(`background:#f4fbfc;color:#1a5a6a;border-radius:6px;font:700 12px/1.2 "Fredoka","Nunito",system-ui,sans-serif;border:2px solid #7ac8d8;box-shadow:inset 0 0 0 3px #f4fbfc,inset 0 0 0 4px #c8e8f0,0 6px 14px -6px rgba(0,0,0,.6)`, "color:#e85a8a"),
    view: (r) => ({ far: forest(L(), r, "round", 24, 99, [20, 40]), vars: "--hf:46%;" }),
    windows: (v) => std(v === 2 ? "circle" : "rect", 1, 2, 2, 7, ";top:10%;aspect-ratio:1/1.1", v, (x) => (x === 3 ? 0 : x)),
    cur: () => ["#f4f4f4", "sheer"],
    set: (r, v) => {
      const sd = sideOf(v, (x) => (x === 3 ? 0 : x)), fs = other(sd), tub = K2.clawTub(r);
      return [
        { p: K.mirror("#c39a4a", 60, 84), x: 12, at: fs, top: true, y: 14, s: 0.72 },
        { p: K2.towelRack(pick(r, ["#7ab0c8", "#e8a0b0", "#f4e8c8"])), x: 2, at: fs, y: 6, s: 0.8 },
        { p: tub, x: 14, at: fs, y: 3, s: 0.92 },
        { p: duckIn(tub), x: 14, at: fs, y: 3, s: 0.92, anim: "bob 2.4s ease-in-out infinite alternate" },
        { p: K.candles(r, 4), x: 4, at: sd, y: 28, s: 0.55, dim: false },
        { p: K.plant(r, "fern", "#e8e4dc"), x: 1, at: sd, y: 2, s: 0.6 },
      ];
    },
  },
  // ── New rooms ──
  {
    id: "observatory",
    css: `&.p .sill:before{display:none}&.p .wall{background:repeating-conic-gradient(from 0deg at 50% 120%,rgba(0,0,0,.28) 0 .5deg,transparent .5deg 11deg),radial-gradient(130% 150% at 50% 120%,#4a5468,#1a1e2a 60%,#0c0e16)}&.p .wf{background:linear-gradient(90deg,#2a2e38,#5a6070,#2a2e38)}&.p .wain{height:13%;background:repeating-linear-gradient(90deg,rgba(0,0,0,.3) 0 2px,transparent 2px 22px),linear-gradient(#3a3e48,#1a1c22)}&.p .lamp{opacity:1;background:radial-gradient(22% 30% at 12% 82%,rgba(255,40,40,.32),transparent 70%)}`
      + sign(`background:linear-gradient(180deg,#e8c46a,#a8822a);color:#1a1a3a;border-radius:999px;font:700 11.5px/1.2 "Cinzel","Times New Roman",serif;letter-spacing:.14em;text-transform:uppercase;box-shadow:inset 0 0 0 1px #6a4a10,0 0 0 2px #1a1e2a,0 0 0 3px #c39a4a,0 6px 14px -6px rgba(0,0,0,.8)`, "color:#3a1a6a") + `&.p .crumb:before{content:"✦";margin-right:2px;color:#3a1a6a}`,
    view: (r) => ({ far: (() => { const l = L(); ridge(l, r, 70, 96, 0.5); return l; })(), vars: "--hf:20%;" }),
    windows: () => ({ ...windowSet("rect", 1, 1, 1, 6), box: "left:50%;right:auto;width:clamp(64px,13%,96px);transform:translateX(-50%);top:0;bottom:24%", wx: "50%" }),
    set: (r, v) => [
      { p: K2.starChart(), x: 4, at: v % 2 ? "r" : "l", top: true, y: 14, s: 0.75 },
      { p: K2.telescope(), x: 47, at: "c", y: 6, s: 1.05, css: v % 2 ? "transform:scaleX(-1)" : "" },
      { p: K.table(r, "#3a2414", [], { w: 120, h: 60 }), x: 5, at: v % 2 ? "l" : "r", y: 3, s: 0.8 },
      { p: K2.orrery(), x: 8, at: v % 2 ? "l" : "r", y: 31, s: 0.62, dim: false, glow: "rgba(255,200,90,.6)", gr: 30 },
      { p: K.ladder("#5a3a20", 200), x: 2, at: v % 2 ? "r" : "l", y: 4, s: 1 },
      { p: K.lantern("#3a1a1a"), x: 8, at: "l", y: 4, s: 0.7, dim: false, glow: "rgba(255,60,50,.6)", gr: 50, css: "filter:hue-rotate(-35deg) saturate(1.6)" },
    ],
  },
  {
    id: "aquarium",
    css: UNDERWATER + `&.p .sill:before{display:none}&.p .sky{filter:brightness(calc(1 - var(--lit) * .2))}&.p .wall{background:linear-gradient(180deg,#0c1e2c,#040a12)}&.p .walldim{opacity:0}&.p .wf{background:linear-gradient(180deg,#1a2a38,#0a121a)}&.p .wain{height:12%;background:linear-gradient(#0a1a24,#02060a)}&.p .lamp{opacity:1;background:radial-gradient(70% 60% at 50% 40%,rgba(60,180,255,.22),transparent 70%)}&.p .motes{background:repeating-radial-gradient(circle at 30% 120%,rgba(120,220,255,.05) 0 8px,transparent 8px 22px);opacity:1}`
      + sign(`background:radial-gradient(circle at 30% 30%,#8ae8ff,#1a6aa8);color:#fff;border-radius:999px;border:2px solid #c8f4ff;font:700 12px/1.2 "Fredoka","Nunito",system-ui,sans-serif;text-shadow:0 1px 2px #0a3a6a;box-shadow:inset -4px -4px 10px rgba(0,40,80,.4),inset 4px 4px 8px rgba(255,255,255,.4),0 6px 14px -6px rgba(0,0,0,.7)`, "color:#ffe88a"),
    view: (r) => ({ far: kelp(r, 40, [40, 90]), mid: (() => { const l = L(); hills(l, r, 6, 70, 92); return l; })(), vars: "--hf:56%;--hm:30%;", css: `&.p .scene .kx{${fishCss(K2.fish(r, 8).url, 30, 30)}}&.p .scene .kx2{${fishCss(K2.fish(r, 5).url, 54, 40, true)};left:auto;right:-40%}` + MOTION(`&.p .scene .kx{animation:${fishAnim(26)}}&.p .scene .kx2{animation:${fishAnim(34, -12, true)}}`) }),
    windows: () => ({ ...windowSet("round", 1, 1, 1, 10), box: "left:3%;right:3%;top:5%;bottom:14%", wx: "50%" }),
    set: (r, v) => [
      { p: K2.jellyfish("#ff8ad8"), x: 22, at: "l", top: true, y: 18, s: 0.9, dim: false, gr: 34, glow: "rgba(255,140,220,.5)", anim: "bob 4s ease-in-out infinite alternate" },
      { p: K2.jellyfish("#8ad8ff"), x: 30, at: "r", top: true, y: 28, s: 0.7, dim: false, gr: 28, glow: "rgba(140,220,255,.5)", anim: "bob 5s ease-in-out -2s infinite alternate" },
      { p: K2.aquariumRock(r), x: 50, at: "c", y: 13, s: 0.72 },
      { p: K.couple("#020408"), x: v % 2 ? 18 : 64, at: "l", y: -4, s: 0.95 },
      { p: K.bench("#0a1218", 180), x: v % 2 ? 56 : 12, at: "l", y: 2, s: 0.9 },
    ],
  },
  {
    id: "arcade",
    css: `&.p .wall{background:linear-gradient(180deg,#120a24,#06030e)}&.p .walldim{opacity:0}&.p .wain{height:18%;background:radial-gradient(circle at 20% 30%,#ff4fd8 0 3px,transparent 3.5px) 0 0/34px 30px,radial-gradient(circle at 70% 70%,#4ff0ff 0 2.5px,transparent 3px) 0 0/42px 36px,radial-gradient(circle at 50% 50%,#ffd24a 0 2px,transparent 2.5px) 10px 6px/26px 26px,linear-gradient(#1a0a34,#0a0418)}&.p .lamp{opacity:1;background:radial-gradient(40% 40% at 50% 70%,rgba(160,80,255,.25),transparent 70%)}&.p .rd{inset:7% 4% auto 4%;height:3px;border-radius:3px;background:#4ff0ff;box-shadow:0 0 10px 3px #4ff0ff,0 0 30px 8px rgba(79,240,255,.5)}`
      + sign(`background:#0a0a0a;color:#ffd24a;border:2px solid #3a3a3a;border-radius:2px;font:400 11px/1.2 "Press Start 2P","VT323",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;background-image:radial-gradient(circle,rgba(255,210,74,.12) 1px,transparent 1.2px);background-size:3px 3px;text-shadow:0 0 6px #ffb02a`, "color:#ff4fd8;text-shadow:0 0 6px #ff4fd8") + MOTION(`&.p .crumb b{animation:blink 1.2s steps(2) infinite}`),
    view: () => ({}),
    windows: () => null,
    set: (r) => [
      { p: K2.neon(pick(r, ["PLAY", "1UP", "GAME", "HI·SCORE"]), "#ff4fd8", 170, 46, "Arial Black,Arial,sans-serif"), x: 50, at: "c", top: true, y: 14, s: 0.72, dim: false, css: "filter:drop-shadow(0 0 8px #ff4fd8)", anim: "flicker 2.6s ease-in-out infinite" },
      { p: K2.arcadeCab(r, "#3a2a8a"), x: 1, at: "l", y: 6, s: 0.95, dim: false, gr: 36 },
      { p: K2.arcadeCab(r, "#8a1a3a"), x: 13, at: "l", y: 6, s: 0.95, dim: false, gr: 36 },
      { p: K2.arcadeCab(r, "#1a6a5a"), x: 1, at: "r", y: 6, s: 0.95, dim: false, gr: 36 },
      { p: K2.arcadeCab(r, "#8a5a1a"), x: 13, at: "r", y: 6, s: 0.95, dim: false, gr: 36 },
      { p: K.crowd(r, 300, false, "#05020a"), x: 50, at: "c", y: -3, s: 0.9 },
    ],
  },
  {
    id: "laundromat",
    css: `&.p .wall{background:linear-gradient(180deg,transparent 52%,#3aa0c8 52% 54%,transparent 54%),repeating-linear-gradient(0deg,rgba(0,0,0,.08) 0 1px,transparent 1px 22px),linear-gradient(180deg,#e8f0e8,#b8c8c0)}&.p .walldim{background:#060a10;opacity:calc(var(--lit) * .3)}&.p .wain{height:13%;${checker("#f0f0e8", "#3aa0c8", 34)}}&.p .lamp{background:linear-gradient(180deg,rgba(220,255,240,.3),transparent 26%)}&.p .rd{inset:5% 12% auto 12%;height:6px;border-radius:3px;background:#f4fff8;box-shadow:0 0 12px 4px rgba(220,255,240,.7)}&.p .rc{inset:0;background:radial-gradient(4px 4px at 20% 40%,rgba(255,255,255,.7),transparent),radial-gradient(6px 6px at 60% 70%,rgba(255,255,255,.5),transparent),radial-gradient(3px 3px at 80% 30%,rgba(255,255,255,.7),transparent);background-size:180px 160px}@media (prefers-reduced-motion:no-preference){&.p .rd{animation:flicker 5s ease-in-out infinite}&.p .rc{animation:bubbles 14s linear infinite}}`
      + sign(`background:#fff;color:#1a6a9a;border:2px solid #1a6a9a;border-radius:4px;font:800 11.5px/1.2 "Fredoka","Nunito",system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;background-image:repeating-linear-gradient(90deg,#1a6a9a 0 4px,transparent 4px 8px);background-size:100% 3px;background-repeat:no-repeat;background-position:0 100%;box-shadow:0 6px 14px -6px rgba(0,0,0,.6)`, "color:#e83a6a"),
    view: (r) => { const l = L(); skyline(l, l, r, "modern", 100, [30, 66]); return { far: l, vars: "--hf:56%;" }; },
    windows: (v) => std("rect", 1, 2, 1, 6, ";top:10%;bottom:44%", v, (x) => (x === 3 ? 0 : x)),
    set: (r, v) => {
      const sd = sideOf(v, (x) => (x === 3 ? 0 : x)), fs = other(sd);
      const row: Bit[] = [];
      for (let k = 0; k < 4; k++) {
        const x = 2 + k * 13;
        row.push({ p: K2.washer(), x, at: fs, y: 4, s: 0.82 });
        row.push({ p: K2.drumClothes(r), x, at: fs, y: 4, s: 0.82, css: `transform-origin:50% 56.4%;-webkit-mask:radial-gradient(28.9% 23.6% at 50% 56.4%,#000 98%,transparent);mask:radial-gradient(28.9% 23.6% at 50% 56.4%,#000 98%,transparent)`, anim: `spin ${1.4 + k * 0.3}s linear infinite` });
      }
      return [
        { p: K.wallClock("#1a6a9a", "#fff", 4, 40), x: 20, at: fs, top: true, y: 16, s: 0.6 },
        ...row,
        { p: K2.vending(r), x: 1, at: sd, y: 4, s: 0.88, dim: false, gr: 50, glow: "rgba(230,245,255,.5)" },
        { p: K2.plasticChairs(3, "#f4a02a"), x: 17, at: sd, y: 2, s: 0.72 },
        { p: K2.laundryBasket(r), x: 54, at: fs, y: 2, s: 0.7 },
      ];
    },
  },
  {
    id: "diner",
    css: `&.p .wall{background:linear-gradient(180deg,transparent 56%,#c8ccd4 56% 57%,#c8283a 57% 60%,#c8ccd4 60% 61%,transparent 61%),linear-gradient(180deg,#f0e8d4,#c8b898)}&.p .walldim{background:#08060a}&.p .wain{height:14%;${checker("#f4f0e8", "#1a1a1a", 32)}}&.p .lamp{background:radial-gradient(40% 40% at 50% 30%,rgba(255,210,150,.25),transparent 70%)}`
      + sign(`background:#c8283a;color:#fff4e0;border-radius:999px;border:3px solid #d4d8de;font:700 13px/1.2 "Pacifico","Lobster","Brush Script MT",cursive;box-shadow:0 0 0 2px #8a1a24,0 6px 14px -6px rgba(0,0,0,.7);text-shadow:0 2px 0 #8a1a24`, "color:#ffe08a"),
    view: (r) => ({ far: (() => { const l = L(); skyline(l, l, r, "deco", 100, [30, 60]); return l; })(), near: (() => { const l = L(); lampPosts(l, 100, 220, 60, 90); return l; })(), vars: "--hf:56%;--hn:60%;" }),
    windows: (v) => ({ ...windowSet("round", 2, 1, 1, 8, 20), box: (v % 2 ? "left:3%;right:auto" : "left:auto;right:3%") + ";width:48%;top:12%;bottom:46%", wx: v % 2 ? "27%" : "73%" }),
    set: (r, v) => {
      const fs = v % 2 ? "r" : "l", sd = other(fs);
      return [
        { p: K2.neon("OPEN", "#ff3a5a", 120, 44, "Arial Black,Arial,sans-serif"), x: 24, at: sd, top: true, y: 18, s: 0.62, dim: false, css: "filter:drop-shadow(0 0 8px #ff3a5a)", anim: "flicker 4s ease-in-out infinite" },
        { p: K.catClock(), x: 6, at: fs, top: true, y: 12, s: 0.62, after: `inset:auto;left:44%;top:86%;width:12%;height:30%;border-radius:0 0 50% 50%;background:#16161a;transform-origin:50% 0`, afterAnim: "swing 1s ease-in-out infinite alternate" },
        { p: K2.jukebox(), x: 1, at: fs, y: 4, s: 0.82, dim: false, gr: 40, glow: "rgba(255,140,200,.5)" },
        { p: K.counter(r, "#c8283a", "#d4d8de", 300, ["cake", "mug", "glass"]), x: 15, at: fs, y: 3, s: 0.82 },
        { p: K2.pie(), x: 22, at: fs, y: 32, s: 0.6 },
        { p: K.stool("#c8283a"), x: 18, at: fs, y: 0, s: 0.92 },
        { p: K.stool("#c8283a"), x: 30, at: fs, y: 0, s: 0.92 },
        { p: K2.booth(), x: 2, at: sd, y: 2, s: 0.95 },
      ];
    },
  },
  {
    id: "forge",
    css: `&.p .wall{background:repeating-linear-gradient(0deg,rgba(0,0,0,.35) 0 2px,transparent 2px 18px),repeating-linear-gradient(90deg,rgba(0,0,0,.28) 0 2px,transparent 2px 36px),radial-gradient(60% 70% at 50% 80%,#7a3a1a,#2a1408 70%)}&.p .walldim{opacity:calc(var(--lit) * .2)}&.p .wain{height:13%;background:repeating-linear-gradient(90deg,rgba(0,0,0,.3) 0 2px,transparent 2px 46px),linear-gradient(#3a2418,#140a04)}&.p .lamp{opacity:1;background:radial-gradient(50% 60% at 50% 80%,rgba(255,120,30,.35),transparent 70%)}&.p .rc{inset:0;background:radial-gradient(1.5px 1.5px at 20% 70%,#ffb84a,transparent),radial-gradient(1.5px 1.5px at 40% 40%,#ff8a2a,transparent),radial-gradient(2px 2px at 60% 60%,#ffd24a,transparent),radial-gradient(1.5px 1.5px at 80% 50%,#ff8a2a,transparent);background-size:200px 180px;filter:drop-shadow(0 0 3px #ff7a1a)}@media (prefers-reduced-motion:no-preference){&.p .rc{animation:embers 9s linear infinite}}`
      + sign(`background:linear-gradient(180deg,#5a5c64,#2a2c32);color:#f0e8d8;border-radius:3px;font:700 12px/1.2 "Cinzel","Times New Roman",serif;letter-spacing:.12em;text-transform:uppercase;background-image:radial-gradient(circle at 7px 50%,#8a8e96 0 2px,transparent 2.5px),radial-gradient(circle at calc(100% - 7px) 50%,#8a8e96 0 2px,transparent 2.5px),linear-gradient(180deg,#5a5c64,#2a2c32);padding:7px 18px;box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 6px 14px -6px rgba(0,0,0,.8)`, "color:#ffb84a;text-shadow:0 0 6px #ff7a1a"),
    view: () => ({}),
    windows: () => null,
    set: (r, v) => [
      { p: K2.forgeHearth(), x: v % 2 ? 4 : 50, at: v % 2 ? "l" : "c", y: 3, s: 0.95, dim: false, gr: 70, glow: "rgba(255,120,30,.6)" },
      { p: K2.toolRack(r), x: 3, at: v % 2 ? "r" : "l", top: true, y: 18, s: 0.8 },
      { p: K2.anvil(), x: v % 2 ? 30 : 4, at: v % 2 ? "r" : "r", y: 3, s: 0.92, glow: "rgba(255,160,60,.6)", gr: 26 },
      { p: K.standingBarrel("#5a3a22"), x: 2, at: v % 2 ? "r" : "l", y: 3, s: 0.9 },
      { p: K.crates(r, 2), x: 12, at: v % 2 ? "r" : "l", y: 3, s: 0.6 },
    ],
  },
  {
    id: "casino",
    css: `&.p .wall{background:${paper("linear-gradient(180deg,#2a0a14,#10040a)", "#d9b45a1c", "diamond", 48)}}&.p .walldim{opacity:calc(var(--lit) * .2)}&.p .wain{height:16%;background:radial-gradient(circle at 50% 50%,#d9b45a33 0 3px,transparent 3.5px) 0 0/22px 22px,linear-gradient(#5a0a1a,#2a040a)}&.p .lamp{opacity:1;background:radial-gradient(40% 40% at 50% 20%,rgba(255,220,150,.35),transparent 70%)}`
      + sign(`background:#0c3a1e;color:#f4e8c8;border:2px solid #d9b45a;border-radius:6px;font:700 12px/1.2 "Cinzel","Times New Roman",serif;letter-spacing:.1em;box-shadow:inset 0 0 0 3px #0c3a1e,inset 0 0 0 4px #d9b45a66,0 6px 14px -6px rgba(0,0,0,.8)`, "color:#ff5a6a") + `&.p .crumb:before{content:"♠ ♥";letter-spacing:.1em;color:#d9b45a}`,
    view: () => ({}),
    windows: () => null,
    set: (r, v) => [
      { p: K.chandelier("#d9b45a", 7), x: 50, at: "c", top: true, y: -3, s: 0.78, dim: false, gr: 24 },
      { p: K2.neon(pick(r, ["JACKPOT", "♠ ♥ ♦ ♣", "LUCKY 7"]), "#ffd24a", 180, 46, "Georgia,serif", true), x: v % 2 ? 4 : 4, at: v % 2 ? "r" : "l", top: true, y: 18, s: 0.62, dim: false, css: "filter:drop-shadow(0 0 8px #ffb02a)", anim: "flicker 3s ease-in-out infinite" },
      { p: K2.slotMachine(r), x: 1, at: "l", y: 4, s: 0.92, dim: false, gr: 30 },
      { p: K2.slotMachine(r), x: 12, at: "l", y: 4, s: 0.92, dim: false, gr: 30 },
      { p: K2.slotMachine(r), x: 1, at: "r", y: 4, s: 0.92, dim: false, gr: 30 },
      { p: K2.roulette(), x: 50, at: "c", y: 2, s: 0.95 },
      { p: K2.wheelTop(), x: 50, at: "c", y: 2, s: 0.95, dim: false },
    ],
  },
  {
    id: "alchemy",
    css: `&.p .wall{background:repeating-linear-gradient(0deg,rgba(0,0,0,.3) 0 2px,transparent 2px 24px),repeating-linear-gradient(90deg,rgba(0,0,0,.24) 0 2px,transparent 2px 48px),radial-gradient(70% 70% at 50% 70%,#3a2a4a,#140c1c 70%)}&.p .walldim{opacity:calc(var(--lit) * .25)}&.p .wain{height:13%;background:radial-gradient(60% 40% at 50% 0%,rgba(120,255,160,.15),transparent 70%),repeating-linear-gradient(90deg,rgba(0,0,0,.3) 0 2px,transparent 2px 38px),linear-gradient(#2a2030,#0e0a12)}&.p .lamp{opacity:1;background:radial-gradient(40% 40% at 50% 80%,rgba(90,255,140,.22),transparent 70%),radial-gradient(30% 30% at 80% 60%,rgba(180,110,255,.2),transparent 70%)}&.p .rc{inset:0;background:radial-gradient(2px 2px at 20% 30%,#c8a8ff,transparent),radial-gradient(1.5px 1.5px at 60% 20%,#a8ffc8,transparent),radial-gradient(2px 2px at 80% 60%,#ffe8a8,transparent),radial-gradient(1.5px 1.5px at 40% 70%,#c8a8ff,transparent);background-size:230px 190px;filter:drop-shadow(0 0 3px #b06aff)}@media (prefers-reduced-motion:no-preference){&.p .rc{animation:embers 16s linear infinite}}`
      + sign(`background:#efe2c0;color:#3a1a5a;border-radius:2px;font:700 12.5px/1.2 "IM Fell English","Cormorant Garamond",Georgia,serif;font-style:italic;padding:7px 26px 7px 14px;background-image:radial-gradient(circle at calc(100% - 11px) 50%,#a8182a 0 7px,transparent 7.5px),linear-gradient(90deg,#efe2c0,#e4d0a0);box-shadow:0 6px 14px -6px rgba(0,0,0,.8)`, "color:#7a1a3a"),
    view: () => ({}),
    windows: () => null,
    set: (r, v) => [
      { p: K.jarShelf(r, "#3a2414", 200, 2, "potions"), x: 2, at: v % 2 ? "r" : "l", top: true, y: 14, s: 0.8 },
      { p: K.jarShelf(r, "#3a2414", 160, 1, "jars"), x: 4, at: v % 2 ? "l" : "r", top: true, y: 20, s: 0.7 },
      { p: K2.floatingCandle(), x: 30, at: "l", top: true, y: 12, s: 0.8, dim: false, gr: 22, anim: "bob 3.4s ease-in-out infinite alternate" },
      { p: K2.floatingCandle(), x: 42, at: "l", top: true, y: 6, s: 0.7, dim: false, gr: 20, anim: "bob 4.2s ease-in-out -1s infinite alternate" },
      { p: K2.floatingCandle(), x: 34, at: "r", top: true, y: 10, s: 0.85, dim: false, gr: 22, anim: "bob 3.8s ease-in-out -2s infinite alternate" },
      { p: K2.floatingCandle(), x: 22, at: "r", top: true, y: 4, s: 0.65, dim: false, gr: 18, anim: "bob 4.6s ease-in-out -.5s infinite alternate" },
      { p: K2.lectern(r), x: v % 2 ? 3 : 3, at: v % 2 ? "r" : "l", y: 3, s: 0.9, dim: false, glow: "rgba(170,110,255,.6)", gr: 34 },
      { p: K2.cauldron(), x: 50, at: "c", y: 3, s: 0.92, dim: false, glow: "rgba(90,255,140,.55)", gr: 60 },
      { p: K2.crystalBall(), x: 6, at: v % 2 ? "l" : "r", y: 4, s: 0.82, dim: false, glow: "rgba(190,120,255,.6)", gr: 44 },
      cat(r, 22, 3, v % 2 ? "l" : "r", 0.72, true, CAT_COATS[1]),
    ],
  },
  {
    id: "gallery",
    css: `&.p .wall{background:linear-gradient(180deg,#f4f2ee,#d8d4cc)}&.p .walldim{background:#0a0a10;opacity:calc(var(--lit) * .45)}&.p .wain{height:14%;background:${planks("#c8a478", 5)}}&.p .lamp{opacity:1;background:conic-gradient(from 160deg at 22% -6%,transparent 0deg,rgba(255,245,220,.35) 8deg 32deg,transparent 40deg),conic-gradient(from 160deg at 54% -6%,transparent 0deg,rgba(255,245,220,.35) 8deg 32deg,transparent 40deg),conic-gradient(from 160deg at 84% -6%,transparent 0deg,rgba(255,245,220,.35) 8deg 32deg,transparent 40deg)}`
      + sign(`background:#fff;color:#1a1a1a;border-radius:0;font:500 11px/1.25 "Inter","Helvetica Neue",Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;border-left:3px solid #1a1a1a;box-shadow:0 1px 0 #ddd,0 6px 14px -6px rgba(0,0,0,.4)`, "color:#1a1a1a;font-weight:800"),
    view: () => ({}),
    windows: () => null,
    set: (r, v) => [
      { p: K.painting(r, "night", "#c39a4a", 110, 84), x: 22, at: "c", top: true, y: 16, s: 0.75 },
      { p: K.painting(r, v % 2 ? "portrait" : "abstract", "#1a1a1a", 80, 104), x: 54, at: "c", top: true, y: 13, s: 0.75 },
      { p: K.painting(r, pick(r, ["sea", "land", "flowers"]), "#c39a4a", 100, 76), x: 84, at: "c", top: true, y: 17, s: 0.75 },
      { p: K2.bust(), x: 4, at: v % 2 ? "r" : "l", y: 4, s: 0.85 },
      { p: K2.stanchions(240), x: 52, at: "c", y: 6, s: 0.72 },
      { p: K.bench("#2a2a2a", 160), x: 50, at: "c", y: 2, s: 0.95 },
      { p: K.couple("#2a2a32"), x: v % 2 ? 6 : 14, at: v % 2 ? "l" : "r", y: -2, s: 0.75 },
    ],
  },
  {
    id: "plane",
    css: `&.p .sill:before{display:none}&.p :is(.ground,.water,.glint,.mglint,.refl,.rain,.r2,.snow,.fog){display:none}&.p .scene .far{background:linear-gradient(180deg,color-mix(in oklab,#fff 72%,var(--s3)),color-mix(in oklab,#d0dae8 60%,var(--s2)))}&.p .scene .mid{background:linear-gradient(180deg,color-mix(in oklab,#fff 80%,var(--s3)),color-mix(in oklab,#e0e8f0 60%,var(--s2)))}&.p .wall{background:linear-gradient(180deg,#e4e8ec,#a8b0b8)}&.p .walldim{background:#060a14;opacity:calc(var(--lit) * .5)}&.p .wf{background:linear-gradient(180deg,#d8dce2,#9aa0aa)}&.p .wain{height:10%;background:repeating-linear-gradient(90deg,#2a3a6a 0 6px,#24335e 6px 12px)}`
      + sign(`background:#fff;color:#1a2a5a;border-radius:6px;font:700 11px/1.2 "DM Mono",ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;padding:7px 14px 7px 26px;background-image:linear-gradient(90deg,#1a5ac8 0 16px,transparent 16px),repeating-linear-gradient(180deg,#fff 0 3px,transparent 3px 6px);background-size:100% 100%,2px 100%;background-position:0 0,calc(100% - 22px) 0;background-repeat:no-repeat;box-shadow:0 6px 14px -6px rgba(0,0,0,.6)`, "color:#c82a2a") + `&.p .crumb:before{content:"✈";color:#fff;position:absolute;left:4px;font-size:10px}&.p .crumb{position:relative}`,
    view: (r) => ({ far: hills(L(), r, 7, 40, 80), mid: hills(L(), r, 5, 80, 98), vars: "--hf:34%;--hm:26%;" }),
    windows: (v) => ({ ...windowSet("oval", v === 2 ? 2 : 3, 1, 1, 14, v === 2 ? 160 : 90), box: "left:12%;right:12%;top:19%;bottom:47%", wx: "50%" }),
    set: (r) => [
      { p: K2.overheadBins(800), x: 50, at: "c", top: true, y: 0, s: 0.6 },
      { p: K2.seatbeltSign(), x: 50, at: "c", top: true, y: 13, s: 0.55, dim: false, gr: 16, glow: "rgba(255,210,74,.5)" },
      { p: K2.planeSeats(r, 800), x: 50, at: "c", y: -4, s: 1.05, gr: 18 },
    ],
  },
  {
    id: "submarine",
    css: UNDERWATER + `&.p .sill:before{display:none}&.p .wall{background:repeating-linear-gradient(90deg,rgba(0,0,0,.3) 0 2px,transparent 2px 70px),radial-gradient(circle at 35px 20px,#6a7064 0 3px,transparent 3.5px) 0 0/70px 40px,linear-gradient(180deg,#4a5248,#1a1e1a)}&.p .wf{background:radial-gradient(circle,#d9b45a 60%,#8a6a2a)}&.p .wain{height:12%;background:repeating-linear-gradient(90deg,#1a1c1a 0 3px,transparent 3px 12px),repeating-linear-gradient(0deg,#1a1c1a 0 3px,transparent 3px 12px),linear-gradient(#3a3e3a,#1a1c1a)}&.p .lamp{opacity:1;background:radial-gradient(60% 60% at 50% 20%,rgba(255,40,40,calc(var(--lit) * .35)),transparent 70%)}`
      + sign(`background:#2a2e2a;color:#e8e4d8;border:2px solid #6a6e64;border-radius:3px;font:700 12px/1.2 "Stardos Stencil","Black Ops One",Impact,sans-serif;letter-spacing:.16em;text-transform:uppercase;background-image:radial-gradient(circle at 6px 6px,#8a8e84 0 1.5px,transparent 2px),radial-gradient(circle at calc(100% - 6px) 6px,#8a8e84 0 1.5px,transparent 2px),radial-gradient(circle at 6px calc(100% - 6px),#8a8e84 0 1.5px,transparent 2px),radial-gradient(circle at calc(100% - 6px) calc(100% - 6px),#8a8e84 0 1.5px,transparent 2px)`, "color:#ffd24a"),
    view: (r) => ({ far: (() => { const l = L(); hills(l, r, 5, 60, 90); return l; })(), mid: kelp(r, 26, [30, 70]), vars: "--hf:40%;--hm:46%;", css: `&.p .scene .kx{${fishCss(K2.fish(r, 6).url, 36, 30)}}` + MOTION(`&.p .scene .kx{animation:${fishAnim(18)}}`) }),
    windows: (v) => ({ ...windowSet("circle", 1, 1, 1, 16), box: (v % 2 ? "left:12%;right:auto" : "left:auto;right:12%") + ";width:clamp(110px,24%,170px);aspect-ratio:1;top:16%", wx: v % 2 ? "24%" : "76%" }),
    set: (r, v) => [
      { p: K2.pipes(r, 800), x: 50, at: "c", top: true, y: 0, s: 0.75 },
      { p: K2.periscope(), x: v % 2 ? 26 : 26, at: v % 2 ? "r" : "l", top: true, y: 0, s: 0.95 },
      { p: K2.gauges(3), x: 4, at: v % 2 ? "r" : "l", top: true, y: 30, s: 0.7 },
      { p: K.pendant("#ff3a3a", 20, "globe"), x: 50, at: "c", top: true, y: 16, s: 0.6, dim: false, gr: 40, glow: "rgba(255,50,50,.6)", css: "filter:hue-rotate(-40deg) saturate(2)", anim: "flicker 2s ease-in-out infinite" },
      { p: K2.seaChest("#3a4a3a"), x: 4, at: v % 2 ? "l" : "r", y: 2, s: 0.8 },
      { p: K2.consoles(r, 260), x: 0, at: v % 2 ? "r" : "l", y: 2, s: 0.7, dim: false, gr: 20 },
    ],
  },
  {
    id: "stable",
    css: `&.p .wall{background:${beams("#3a2414", 8)},repeating-linear-gradient(90deg,rgba(0,0,0,.28) 0 2px,transparent 2px 26px),linear-gradient(180deg,#8a6a42,#4a3220)}&.p .wain{height:14%;background:repeating-linear-gradient(170deg,rgba(255,220,120,.4) 0 1px,transparent 1px 7px),repeating-linear-gradient(20deg,rgba(255,220,120,.3) 0 1px,transparent 1px 9px),linear-gradient(#a8843a,#5a4218)}&.p .lamp{background:radial-gradient(30% 40% at 30% 30%,rgba(255,190,100,.35),transparent 70%)}`
      + sign(`background:#5a3a1e;color:#f4e2b0;border-radius:4px;font:700 12px/1.2 "Rye","Cinzel",Georgia,serif;letter-spacing:.06em;border:2px solid #2a1a0a;box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 6px 14px -6px rgba(0,0,0,.7)`, "color:#ffd27a") + `&.p .crumb:before{content:"∩";transform:rotate(180deg);display:inline-block;color:#c8ccd4;font-weight:900;margin-right:2px}`,
    view: (r) => ({ far: hills(L(), r, 4, 50, 85), mid: (() => { const l = L(); hills(l, r, 3, 80, 95); return l; })(), vars: "--hf:40%;--hm:20%;" }),
    windows: (v) => std("rect", 1, 2, 2, 8, ";top:14%;aspect-ratio:1.4/1", v, (x) => (x === 2 || x === 3 ? 0 : x)),
    set: (r, v) => {
      const sd = sideOf(v, (x) => (x === 2 || x === 3 ? 0 : x)), fs = other(sd);
      return [
        { p: K2.cobweb(sd === "r" ? "r" : "l"), x: 0, at: sd, top: true, y: 8, s: 0.6, dim: false },
        { p: K2.stall(), x: 2, at: fs, y: 3, s: 0.95 },
        { p: K.horse(), x: 10, at: fs, y: 36, s: 0.8, anim: "bob 5s ease-in-out infinite alternate" },
        { p: K2.saddle(), x: 34, at: fs, y: 30, s: 0.6 },
        { p: K.lantern(), x: 50, at: "c", top: true, y: 8, s: 0.85, dim: false, gr: 46, css: "transform-origin:50% 0", anim: "swing 5s ease-in-out infinite alternate" },
        { p: K2.hayBales(r), x: 2, at: sd, y: 2, s: 0.75 },
        { p: K2.pitchfork(), x: 22, at: sd, y: 2, s: 0.9, css: "rotate:8deg" },
        v % 2 === 0 && { p: K.catLoaf(coat(r)), x: 12, at: sd, y: 31, s: 0.6, after: ZZ, afterAnim: ZZA },
      ];
    },
  },
  {
    id: "treehouse",
    css: `&.p .wall{background:repeating-linear-gradient(0deg,rgba(0,0,0,.3) 0 2px,transparent 2px 24px),repeating-linear-gradient(90deg,transparent 0 60px,rgba(0,0,0,.12) 60px 62px),linear-gradient(180deg,#b07a44,#6a4424)}&.p .wf{background:radial-gradient(circle,#8a5a2a 60%,#5a3a1a)}&.p .wain{height:14%;background:${planks("#8a5a32", 4.5)}}&.p .lamp{background:radial-gradient(30% 40% at 50% 30%,rgba(255,210,140,.3),transparent 70%)}`
      + sign(`background:#a8743a;color:#fff8e8;border-radius:3px;font:700 13px/1.2 "Permanent Marker","Comic Sans MS",cursive;transform:rotate(-2deg);border:2px solid #6a4418;text-shadow:1px 1px 0 #6a4418;box-shadow:0 6px 14px -6px rgba(0,0,0,.7)`, "color:#ffe25a"),
    view: (r) => ({ far: forest(L(), r, "round", 30, 99, [40, 80]), near: forest(L(), r, "round", 6, 100, [70, 100]), vars: "--hf:90%;--hn:100%;" }),
    windows: (v) => ({ ...windowSet(v % 2 ? "circle" : "rect", 1, v % 2 ? 1 : 2, v % 2 ? 1 : 2, 10), box: (v % 2 ? "left:8%;right:auto" : "left:auto;right:8%") + ";width:clamp(120px,24%,170px);aspect-ratio:1;top:12%", wx: v % 2 ? "20%" : "80%" }),
    set: (r, v) => {
      const fs = v % 2 ? "r" : "l", sd = other(fs);
      return [
        { p: K.bunting(r, ["#e83a3a", "#f4c42a", "#3a8ae8", "#5ac06a", "#e85ad8"], 800, 18, 2), x: 50, at: "c", top: true, y: 0, s: 0.5, dim: false },
        { p: K2.keepOut(), x: 6, at: fs, top: true, y: 20, s: 0.75 },
        { p: K2.ropeLadder(), x: 42, at: fs, y: 0, s: 1.1, css: "transform-origin:50% 0", anim: "swing 5s ease-in-out infinite alternate" },
        { p: K2.beanbag(pick(r, ["#e85a3a", "#3a8ae8", "#5ac06a"])), x: 4, at: fs, y: 2, s: 0.85 },
        { p: K2.comics(r), x: 26, at: fs, y: 2, s: 0.7 },
        { p: K2.fireflyJar(), x: 6, at: sd, y: 28, s: 0.75, dim: false, glow: "rgba(230,255,130,.6)", gr: 36, anim: "flicker 2s ease-in-out infinite" },
        v % 2 === 0 && { p: K.catLoaf(coat(r)), x: 6, at: fs, y: 17, s: 0.58, after: ZZ, afterAnim: ZZA },
      ];
    },
  },
  {
    id: "studio",
    css: `&.p .wall{background:repeating-conic-gradient(from 45deg at 50% 50%,#2a2a34 0 25%,#1a1a22 0 50%) 0 0/24px 24px,#1a1a22}&.p .walldim{opacity:calc(var(--lit) * .2)}&.p .wain{height:14%;background:repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 2px,transparent 2px 8px),linear-gradient(#2a2a30,#121216)}&.p .lamp{opacity:1;background:radial-gradient(30% 40% at 50% 30%,rgba(255,170,90,.22),transparent 70%)}`
      + sign(`background:#1a1a1e;color:#ff5a6a;border:2px solid #3a3a42;border-radius:6px;font:700 11px/1.2 "DM Mono",ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 0 6px #ff3a4a`, "color:#fff") + `&.p .crumb:before{content:"";width:8px;height:8px;border-radius:50%;background:#ff3a4a;box-shadow:0 0 8px #ff3a4a}` + MOTION(`&.p .crumb:before{animation:blink 1.4s ease-in-out infinite}`),
    view: () => ({}),
    windows: () => null,
    set: (r, v) => [
      { p: K2.onAir(), x: 50, at: "c", top: true, y: 14, s: 0.72, dim: false, css: "filter:drop-shadow(0 0 10px #ff3a4a)", anim: "flicker 3.6s ease-in-out infinite" },
      { p: K2.speaker(140), x: 1, at: "l", y: 6, s: 0.85 },
      { p: K2.speaker(140), x: 1, at: "r", y: 6, s: 0.85 },
      { p: K2.micStand(), x: v % 2 ? 22 : 30, at: v % 2 ? "r" : "l", y: 3, s: 0.95 },
      { p: K2.guitar(pick(r, ["#c86a2a", "#c82a3a", "#1a1a1a", "#3a7ab0"])), x: 14, at: v % 2 ? "l" : "r", y: 3, s: 0.85 },
      { p: K2.mixingDesk(r, 300), x: 50, at: "c", y: 2, s: 0.82, dim: false },
      { p: K.stringLights(r, null, 600, 14, 3), x: 50, at: "c", top: true, y: 2, s: 0.45, dim: false },
    ],
  },
];


export interface Chunk { key: string; css: string }
/** Most <i> and <b> slots any room uses; the plate emits this many. */
export const SLOTS = { i: 26, b: 6 };
export function roomChunks(): Chunk[] {
  const out: Chunk[] = [];
  for (const room of ROOMS) {
    for (let v = 0; v < 4; v++) {
      const key = `r_${room.id}-${v}`, sel = `[data-k=${key}]`;
      const r = rng(hash(key));
      const view = room.view(r), win = room.windows(v);
      let css = varChunk(`${sel}.p`, view);
      if (win) {
        css += `${sel}.p{--mwin:${win.mask.url(WB, HB, true)};--mfr:${win.frame.url(WB, HB, true)};--wx:${win.wx ?? "50%"};--shx:${win.shx ?? "-100%"}}`;
        css += `${sel}.p :is(.scene,.wf,.beam,.sill){inset:auto;bottom:auto;top:13%;${win.box}}`;
        const cur = room.cur?.(v);
        if (cur) css += `${sel}.p .sill:after{background:${curtains(cur[0], cur[1])} 0 0/100% 100% no-repeat}`;
      } else css += `${sel}.p :is(.scene,.wf,.beam,.sill){display:none}`;
      css += scope(room.css.replace(/\.wain\{height:(\d+)%/, ".wain{height:calc($1% + var(--fy))") + (view.css ?? ""), sel);
      const set = setCss(sel, room.set?.(rng(hash(key) + 101), v) ?? []);
      if (set.i > SLOTS.i || set.b > SLOTS.b) throw new Error(`${key}: ${set.i} pieces / ${set.b} lights exceed the plate's slots`);
      out.push({ key, css: css + set.css });
    }
  }
  return out;
}

// ── Classification ──────────────────────────────────────────────────────────
// Read in order; the first match wins (see ./index.ts placeKind).
export const ROOM_WORDS: [string, string][] = [
  ["train", "train|carriage|railcar|compartment|sleeper car|dining car|coach car|tram|subway car"],
  ["plane", "plane|airplane|aeroplane|airliner|private jet|jumbo jet|first class|business class|economy class|in-flight|mid-flight|aircraft cabin|cabin of the plane"],
  ["submarine", "submarine|u-boat|bathysphere|submersible"],
  ["bridge", "bridge of the|flight deck|helm|cockpit|command deck|starship bridge|shuttle|spacecraft|airship gondola"],
  ["car", "car|truck|van|taxi|cab|limo|limousine|backseat|back seat|driver's seat|passenger seat|jeep|sedan|pickup|motorcar|bus"],
  ["cabin", "ship's cabin|cabin of the ship|stateroom|captain's quarters|captain's cabin|below deck|below decks|berth|galley"],
  ["tent", "tent|pavilion|yurt|marquee"],
  ["observatory", "observatory|planetarium|telescope|star tower|astronomer"],
  ["aquarium", "aquarium|oceanarium|fish tank|sea life centre|sea life center"],
  ["arcade", "arcade|game room|games room|video arcade|pinball|bowling alley|bowling"],
  ["laundromat", "laundromat|laundrette|launderette|laundry|laundry room|wash house"],
  ["diner", "diner|truck stop|milk bar|soda fountain|drive-in|burger joint"],
  ["forge", "forge|smithy|blacksmith|foundry|smelter|metalworks"],
  ["casino", "casino|gambling den|gambling hall|card room|poker room|betting parlou?r"],
  ["alchemy", "alchemist|alchemy|wizard's|wizards tower|wizard tower|mage tower|sorcerer|witch's|witch hut|witches|potion|spell room|enchanter|arcane"],
  ["gallery", "gallery|museum|exhibition|exhibit|art gallery|sculpture hall"],
  ["stable", "stable|stables|hayloft|barn|horse stall|kennel|chicken coop|tack room"],
  ["treehouse", "treehouse|tree house|tree fort|clubhouse|den in the tree|fort"],
  ["studio", "recording studio|radio station|studio booth|sound booth|broadcast|radio booth|music studio|rehearsal room|jam room|on air"],
  ["shrine", "shrine|dojo|teahouse|tea house|tea room|tatami|ryokan|shoji|zen garden|temple hall"],
  ["chapel", "church|chapel|cathedral|sanctuary|sanctum|nave|monastery|temple interior|mosque|synagogue"],
  ["theater", "theatre|theater|stage|backstage|opera house|auditorium|cinema|concert hall|playhouse|green room"],
  ["library", "library|study|archive|scriptorium|bookshop|bookstore|reading room"],
  ["hall", "throne|ballroom|great hall|banquet|palace|court room|courtroom|audience chamber|grand hall|manor|mansion|dining hall"],
  ["ward", "hospital|ward|infirmary|clinic|sickbay|sick bay|medbay|emergency room|recovery room|icu|patient room"],
  ["lab", "lab|laboratory|clean room|server room|control room|engine room|operating|morgue|research station"],
  ["club", "nightclub|night club|club|disco|rave|karaoke|dance floor|lounge"],
  ["tavern", "tavern|inn|pub|bar|saloon|taproom|common room|alehouse|brewery|cabin|lodge|mead hall|speakeasy"],
  ["cafe", "caf[eé]|coffee shop|coffeehouse|coffee house|restaurant|bistro|tea shop|bakery|canteen|cafeteria|food court|ramen"],
  ["kitchen", "kitchen|scullery|pantry"],
  ["bath", "bathroom|bath|bathhouse|onsen|hot spring|spa|sauna|shower|washroom|restroom|locker room"],
  ["classroom", "classroom|lecture hall|schoolroom|school|homeroom|seminar room|art room|music room"],
  ["office", "office|cubicle|boardroom|meeting room|conference room|headquarters|precinct|newsroom|reception|bullpen"],
  ["shop", "shop|store|apothecary|boutique|emporium|pharmacy|pawnshop|market stall|general store|workshop|atelier"],
  ["cell", "cell|prison|jail|gaol|brig|holding cell|interrogation room|cage"],
  ["cellar", "cellar|wine cellar|storeroom|store room|larder|root cellar"],
  ["attic", "attic|loft|garret"],
  ["greenhouse", "greenhouse|conservatory|orangery|glasshouse|sunroom|solarium"],
  ["bedroom", "bedroom|bed|chamber|bedchamber|dorm|dormitory|bunk|suite|nursery|guest room|boudoir|hotel room|motel room|quarters"],
  ["home", "living room|lounge room|sitting room|den|apartment|flat|lobby|home|house|residence|hallway|corridor|parlou?r|salon|studio|garage|basement|warehouse|gym|motel|hotel|dining room|foyer|porch"],
];
