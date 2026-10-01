// Procedural silhouettes for the scene plate. Every shape is drawn at build time
// from a fixed seed, so the preset is deterministic, and handed to CSS as an SVG
// mask: the plate paints the colour (sky-tinted by the hour), the mask gives the
// shape. Tiles are W wide and H tall with the ground at y = H; anything that
// crosses the left/right edge is mirrored on the other side so tiles repeat.

export const W = 800;
export const H = 100;

export type Rng = () => number;
export function rng(seed: number): Rng {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return (s % 1_000_003) / 1_000_003;
  };
}
const between = (r: Rng, a: number, b: number) => a + (b - a) * r();
const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const n = (v: number) => {
  const x = Math.round(v);
  return String(x === 0 ? 0 : x);
};
const pts = (p: [number, number][]) => p.map(([x, y]) => `${n(x)} ${n(y)}`).join(" ");

/** SVG → CSS url() for a mask. Encodes only what a data URI needs. */
export function svgUrl(body: string, w = W, h = H, stretch = false): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'${stretch ? " preserveAspectRatio='none'" : ""}>${body}</svg>`;
  return `url("data:image/svg+xml,${svg.replace(/%/g, "%25").replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/"/g, "'")}")`;
}

/** A shape layer: filled paths plus stroked lines (masts, branches, fences). */
export class Layer {
  fill: string[] = [];
  odd: string[] = [];
  strokes: Map<number, string[]> = new Map();
  path(d: string) { this.fill.push(d); return this; }
  /** Even-odd path: inner rings cut holes (arches, windows, slits). */
  hole(d: string) { this.odd.push(d); return this; }
  poly(p: [number, number][]) { return this.path(`M${pts(p)}Z`); }
  rect(x: number, y: number, w: number, h: number) { return this.path(`M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`); }
  circle(cx: number, cy: number, r: number) { return this.path(`M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`); }
  ellipse(cx: number, cy: number, rx: number, ry: number) { return this.path(`M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0Z`); }
  line(w: number, d: string) {
    const k = Math.round(w * 2) / 2;
    if (!this.strokes.has(k)) this.strokes.set(k, []);
    this.strokes.get(k)!.push(d);
    return this;
  }
  get empty() { return !this.fill.length && !this.odd.length && !this.strokes.size; }
  svg(): string {
    let s = "";
    if (this.fill.length) s += `<path d='${this.fill.join("")}'/>`;
    if (this.odd.length) s += `<path fill-rule='evenodd' d='${this.odd.join("")}'/>`;
    for (const [w, ds] of this.strokes) s += `<path fill='none' stroke='#000' stroke-width='${w}' stroke-linecap='round' d='${ds.join("")}'/>`;
    return s;
  }
  url(w = W, h = H, stretch = false) { return svgUrl(this.svg(), w, h, stretch); }
}

/** Repeat a placement at x, and again one tile away if it would cross an edge. */
function wrap(x: number, half: number, draw: (x: number) => void) {
  draw(x);
  if (x - half < 0) draw(x + W);
  if (x + half > W) draw(x - W);
}

// ── Ground lines ────────────────────────────────────────────────────────────
/** A seamless height profile: k control points, smoothed with quadratic curves. */
export function profile(r: Rng, k: number, lo: number, hi: number): [number, number][] {
  const ys = Array.from({ length: k }, () => between(r, lo, hi));
  ys.push(ys[0]);
  return ys.map((y, i) => [(i * W) / k, y]);
}
export function smoothPath(p: [number, number][], base = H): string {
  let d = `M0 ${n(base)}L${n(p[0][0])} ${n(p[0][1])}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
    d += `Q${n(p[i][0])} ${n(p[i][1])} ${n(mx)} ${n(my)}`;
  }
  const last = p[p.length - 1];
  return d + `L${n(last[0])} ${n(last[1])}L${W} ${n(base)}Z`;
}
export function hills(L: Layer, r: Rng, k: number, lo: number, hi: number) {
  L.path(smoothPath(profile(r, k, lo, hi)));
  return L;
}
/** Jagged mountain ridge by midpoint displacement (seamless). */
export function ridge(L: Layer, r: Rng, lo: number, hi: number, rough = 0.55, depth = 7) {
  const N = 2 ** depth;
  const ys = new Array(N + 1).fill(0);
  ys[0] = ys[N] = between(r, lo + (hi - lo) * 0.35, hi);
  let step = N, amp = (hi - lo) * 0.95;
  while (step > 1) {
    const h = step / 2;
    for (let i = h; i < N; i += step) ys[i] = (ys[i - h] + ys[i + h]) / 2 + (r() - 0.5) * amp;
    amp *= rough;
    step = h;
  }
  const p = ys.map((y, i) => [(i * W) / N, Math.min(hi + 6, Math.max(lo, y))] as [number, number]);
  L.path(`M0 ${H}L${pts(p)}L${W} ${H}Z`);
  return p;
}
/** Flat-topped mesas and buttes with stepped ledges. */
export function mesas(L: Layer, r: Rng, count: number, top: [number, number], base = H) {
  for (let i = 0; i < count; i++) {
    const x = between(r, 0, W), w = between(r, 40, 180), t = between(r, top[0], top[1]);
    wrap(x, w / 2 + 30, (cx) => {
      const l = cx - w / 2, rr = cx + w / 2, s1 = between(r, 6, 16), s2 = between(r, 8, 22), ledge = t + (base - t) * between(r, 0.3, 0.55);
      L.poly([[l - s2 - 10, base], [l - s2, ledge + 4], [l - s1 * 0.4, ledge], [l, t + 3], [l + 4, t], [rr - 4, t], [rr, t + 2], [rr + s1 * 0.5, ledge], [rr + s2, ledge + 3], [rr + s2 + 12, base]]);
    });
  }
}

// ── Trees ───────────────────────────────────────────────────────────────────
export function pine(L: Layer, x: number, base: number, h: number, w: number, r: Rng) {
  const tiers = h > 40 ? 4 : h > 18 ? 3 : 2;
  const p: [number, number][] = [[x, base - h]];
  for (let i = 1; i <= tiers; i++) {
    const y = base - h + (h * 0.88 * i) / tiers, ww = (w / 2) * (0.45 + (0.55 * i) / tiers) * between(r, 0.85, 1.15);
    p.push([x + ww, y], [x + ww * 0.42, y - h * 0.06]);
  }
  p.pop();
  const right = p.slice(1);
  const left = right.map(([px, py]) => [2 * x - px, py] as [number, number]).reverse();
  L.poly([p[0], ...right, [x + w * 0.06, base - h * 0.12], [x + w * 0.06, base], [x - w * 0.06, base], [x - w * 0.06, base - h * 0.12], ...left]);
}
export function cypress(L: Layer, x: number, base: number, h: number, w: number) {
  L.path(`M${n(x)} ${n(base - h)}Q${n(x + w * 0.62)} ${n(base - h * 0.55)} ${n(x + w * 0.18)} ${n(base)}H${n(x - w * 0.18)}Q${n(x - w * 0.62)} ${n(base - h * 0.55)} ${n(x)} ${n(base - h)}Z`);
}
export function roundTree(L: Layer, x: number, base: number, h: number, w: number, r: Rng) {
  const tw = Math.max(1.5, w * 0.08);
  L.rect(x - tw / 2, base - h * 0.45, tw, h * 0.45);
  const cr = w / 2;
  L.circle(x, base - h + cr, cr);
  for (let i = 0; i < 3; i++) L.circle(x + between(r, -cr * 0.8, cr * 0.8), base - h + cr * between(r, 0.9, 1.6), cr * between(r, 0.5, 0.78));
}
export function birch(L: Layer, x: number, base: number, h: number, w: number, r: Rng) {
  L.line(Math.max(1, w * 0.06), `M${n(x)} ${n(base)}L${n(x + between(r, -2, 2))} ${n(base - h * 0.9)}`);
  for (let i = 0; i < 5; i++) L.ellipse(x + between(r, -w * 0.35, w * 0.35), base - h * between(r, 0.55, 0.9), w * between(r, 0.18, 0.3), h * between(r, 0.1, 0.18));
}
export function deadTree(L: Layer, x: number, base: number, h: number, r: Rng, wd = 2.5) {
  const branch = (x0: number, y0: number, ang: number, len: number, w: number, d: number) => {
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 - Math.sin(ang) * len;
    L.line(w, `M${n(x0)} ${n(y0)}Q${n((x0 + x1) / 2 + between(r, -3, 3))} ${n((y0 + y1) / 2)} ${n(x1)} ${n(y1)}`);
    if (d > 0) {
      const k = d > 2 ? 2 : pick(r, [1, 1, 2, 2]);
      for (let i = 0; i < k; i++) branch(x1, y1, ang + between(r, -0.75, 0.75), len * between(r, 0.5, 0.78), Math.max(0.5, w * 0.62), d - 1);
    }
  };
  branch(x, base, Math.PI / 2 + between(r, -0.1, 0.1), h * 0.42, wd, h > 50 ? 4 : 3);
}
export function palm(L: Layer, x: number, base: number, h: number, r: Rng, lean = between(r, -0.35, 0.35)) {
  const tx = x + h * lean, ty = base - h, cx = x + h * lean * 0.2;
  L.path(`M${n(x - 2.4)} ${n(base)}Q${n(cx - 1.5)} ${n(base - h * 0.5)} ${n(tx - 1)} ${n(ty)}L${n(tx + 1)} ${n(ty)}Q${n(cx + 1.5)} ${n(base - h * 0.5)} ${n(x + 2.4)} ${n(base)}Z`);
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const a = Math.PI * (0.05 + (0.9 * i) / (fronds - 1)) + between(r, -0.12, 0.12), len = h * between(r, 0.32, 0.46);
    const ex = tx + Math.cos(a) * len, ey = ty - Math.sin(a) * len * 0.45 + len * 0.42;
    const mx = tx + Math.cos(a) * len * 0.5, my = ty - Math.sin(a) * len * 0.62;
    L.path(`M${n(tx)} ${n(ty)}Q${n(mx)} ${n(my - 4)} ${n(ex)} ${n(ey)}Q${n(mx)} ${n(my + 2)} ${n(tx)} ${n(ty)}Z`);
  }
  L.circle(tx, ty + 1.5, 2.2);
}
export function willow(L: Layer, x: number, base: number, h: number, w: number, r: Rng) {
  L.rect(x - 1.5, base - h * 0.6, 3, h * 0.6);
  L.ellipse(x, base - h * 0.72, w * 0.45, h * 0.3);
  for (let i = 0; i < 9; i++) {
    const sx = x + between(r, -w * 0.45, w * 0.45);
    L.line(0.8, `M${n(sx)} ${n(base - h * 0.75)}Q${n(sx + between(r, -3, 3))} ${n(base - h * 0.35)} ${n(sx + between(r, -2, 2))} ${n(base - h * between(r, 0.02, 0.2))}`);
  }
}
export function bush(L: Layer, x: number, base: number, w: number, r: Rng) {
  for (let i = 0; i < 4; i++) L.circle(x + between(r, -w / 2, w / 2), base - between(r, 0, w * 0.2), w * between(r, 0.2, 0.35));
}
export type TreeKind = "pine" | "round" | "cypress" | "birch" | "dead" | "palm" | "willow" | "mixed";
export function forest(L: Layer, r: Rng, kind: TreeKind, count: number, base: number, h: [number, number], ground = 4) {
  L.path(smoothPath(profile(r, 6, base - ground, base), H));
  for (let i = 0; i < count; i++) {
    const x = between(r, 0, W), th = between(r, h[0], h[1]), b = base - between(r, 0, ground) + 1;
    const k = kind === "mixed" ? pick(r, ["pine", "round", "pine", "cypress"] as TreeKind[]) : kind;
    const w = k === "pine" ? th * between(r, 0.42, 0.55) : k === "cypress" ? th * 0.3 : th * between(r, 0.6, 0.85);
    wrap(x, w, (cx) => {
      if (k === "pine") pine(L, cx, b, th, w, r);
      else if (k === "cypress") cypress(L, cx, b, th, w);
      else if (k === "round") roundTree(L, cx, b, th, w, r);
      else if (k === "birch") birch(L, cx, b, th, w * 0.7, r);
      else if (k === "palm") palm(L, cx, b, th, r);
      else if (k === "willow") willow(L, cx, b, th, w * 1.3, r);
      else deadTree(L, cx, b, th, r, Math.max(1, th / 18));
    });
  }
  return L;
}

// ── Buildings ───────────────────────────────────────────────────────────────
export type Skyline = "modern" | "deco" | "old" | "gothic" | "eastern" | "future";
/** A skyline row; returns the lit-window layer drawn in the same frame. */
export function skyline(L: Layer, win: Layer | null, r: Rng, style: Skyline, base: number, h: [number, number], density = 1) {
  let x = between(r, -10, 10);
  L.rect(0, base - 2, W, H - base + 2);
  while (x < W) {
    const w = between(r, 18, 46) * (style === "old" ? 0.8 : 1), bh = between(r, h[0], h[1]) * (r() < 0.12 ? 1.35 : 1);
    const top = base - bh;
    const build = (x0: number) => {
      if (style === "deco" && bh > h[0] * 1.2) {
        L.rect(x0, top + bh * 0.2, w, bh * 0.8);
        L.rect(x0 + w * 0.15, top + bh * 0.08, w * 0.7, bh * 0.15);
        L.rect(x0 + w * 0.3, top, w * 0.4, bh * 0.1);
        L.line(1, `M${n(x0 + w / 2)} ${n(top)}V${n(top - bh * 0.18)}`);
      } else if (style === "future") {
        const tw = w * between(r, 0.5, 0.9);
        L.path(`M${n(x0)} ${n(base)}V${n(top + 8)}Q${n(x0 + tw / 2)} ${n(top - 6)} ${n(x0 + tw)} ${n(top + 8)}V${n(base)}Z`);
        if (r() < 0.4) { L.rect(x0 - 4, top + bh * 0.3, tw + 8, 2.5); L.line(0.8, `M${n(x0 + tw / 2)} ${n(top)}V${n(top - 16)}`); }
      } else {
        L.rect(x0, top, w, bh + 2);
        const roof = style === "gothic" ? pick(r, ["spire", "gable", "flat", "spire"]) : style === "eastern" ? pick(r, ["pagoda", "flat", "pagoda"]) : style === "old" ? pick(r, ["gable", "gable", "dome", "flat", "tower"]) : pick(r, ["flat", "flat", "antenna", "step", "slant"]);
        if (roof === "spire") L.poly([[x0 - 1, top], [x0 + w / 2, top - bh * between(r, 0.4, 0.8)], [x0 + w + 1, top]]);
        else if (roof === "gable") L.poly([[x0 - 2, top + 1], [x0 + w / 2, top - w * 0.42], [x0 + w + 2, top + 1]]);
        else if (roof === "dome") { L.ellipse(x0 + w / 2, top, w * 0.42, w * 0.38); L.line(1, `M${n(x0 + w / 2)} ${n(top - w * 0.38)}v-7`); }
        else if (roof === "tower") { L.rect(x0 + w * 0.3, top - bh * 0.35, w * 0.4, bh * 0.36); L.poly([[x0 + w * 0.25, top - bh * 0.35], [x0 + w / 2, top - bh * 0.55], [x0 + w * 0.75, top - bh * 0.35]]); }
        else if (roof === "antenna") { L.line(1, `M${n(x0 + w * 0.6)} ${n(top)}v${n(-bh * 0.3)}`); L.rect(x0 + w * 0.15, top - 4, w * 0.3, 4); }
        else if (roof === "step") { L.rect(x0 + w * 0.15, top - bh * 0.12, w * 0.7, bh * 0.13); L.rect(x0 + w * 0.32, top - bh * 0.2, w * 0.36, bh * 0.1); }
        else if (roof === "slant") L.poly([[x0, top + 1], [x0, top - w * 0.4], [x0 + w, top + 1]]);
        else if (roof === "pagoda") {
          const tiers = 2 + Math.floor(r() * 3);
          for (let t = 0; t < tiers; t++) {
            const ty = top - t * 9, ww = w * (1 - t * 0.17);
            const l = x0 + (w - ww) / 2;
            L.path(`M${n(l - 7)} ${n(ty - 1)}Q${n(l + ww / 2)} ${n(ty - 9)} ${n(l + ww + 7)} ${n(ty - 1)}L${n(l + ww - 2)} ${n(ty + 2)}H${n(l + 2)}Z`);
            if (t < tiers - 1) L.rect(l + 4, ty - 9, ww - 8, 9);
          }
          L.line(1, `M${n(x0 + w / 2)} ${n(top - tiers * 9)}v-8`);
        }
      }
      if (win) {
        const cols = Math.max(1, Math.floor(w / 7)), rows = Math.floor((bh - 6) / 7);
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (r() < 0.28 * density) win.rect(x0 + 3 + i * ((w - 6) / cols), top + 4 + j * 7, 2.6, 3.2);
      }
    };
    wrap(x + w / 2, w / 2 + 6, (cx) => build(cx - w / 2));
    x += w + between(r, -6, 4);
  }
}
/** Houses with pitched roofs and chimneys (town, village); optional steeple. */
export function houses(L: Layer, win: Layer | null, r: Rng, base: number, h: [number, number], opts: { thatch?: boolean; steeple?: number; gap?: [number, number] } = {}) {
  L.rect(0, base - 1, W, H - base + 1);
  let x = between(r, 0, 20);
  const steepleAt = opts.steeple != null ? opts.steeple * W : -1;
  while (x < W) {
    const w = between(r, 22, 42), bh = between(r, h[0], h[1]), top = base - bh, pitch = w * between(r, 0.38, 0.6);
    const isSteeple = steepleAt >= 0 && x <= steepleAt && x + w > steepleAt;
    const draw = (x0: number) => {
      L.rect(x0, top, w, bh + 1);
      if (opts.thatch) L.path(`M${n(x0 - 4)} ${n(top + 2)}Q${n(x0 + w / 2)} ${n(top - pitch * 1.25)} ${n(x0 + w + 4)} ${n(top + 2)}Z`);
      else L.poly([[x0 - 3, top + 1], [x0 + w / 2, top - pitch], [x0 + w + 3, top + 1]]);
      if (r() < 0.7) L.rect(x0 + w * between(r, 0.15, 0.7), top - pitch * 0.9, 4, pitch * 0.6);
      if (isSteeple) {
        const sw = 12, sx = x0 + w / 2 - sw / 2;
        L.rect(sx, top - pitch - 30, sw, 40);
        L.poly([[sx - 1, top - pitch - 30], [sx + sw / 2, top - pitch - 62], [sx + sw + 1, top - pitch - 30]]);
        L.line(1, `M${n(sx + sw / 2)} ${n(top - pitch - 62)}v-7M${n(sx + sw / 2 - 3)} ${n(top - pitch - 66)}h6`);
      }
      if (win && r() < 0.8) {
        const k = Math.max(1, Math.floor(w / 11));
        for (let i = 0; i < k; i++) if (r() < 0.55) win.rect(x0 + 4 + i * ((w - 8) / k), top + bh * 0.3, 3.5, 4.5);
      }
    };
    wrap(x + w / 2, w / 2 + 6, (cx) => draw(cx - w / 2));
    x += w + between(r, ...(opts.gap ?? [-4, 10]));
  }
}
export function castle(L: Layer, win: Layer | null, r: Rng, cx: number, base: number, scale: number) {
  const s = scale;
  const merlons = (x0: number, x1: number, y: number, m = 4 * s) => {
    for (let x = x0; x < x1 - m * 0.5; x += m * 2) L.rect(x, y - m, Math.min(m, x1 - x), m + 0.5);
  };
  const wallW = between(r, 150, 230) * s, wallH = 26 * s, l = cx - wallW / 2;
  L.rect(l, base - wallH, wallW, wallH + 1);
  merlons(l, l + wallW, base - wallH);
  const towers = 2 + Math.floor(r() * 3);
  for (let i = 0; i < towers; i++) {
    const tx = l + (wallW * i) / (towers - 1), tw = between(r, 16, 24) * s, th = wallH + between(r, 14, 34) * s;
    L.rect(tx - tw / 2, base - th, tw, th + 1);
    if (r() < 0.5) { L.poly([[tx - tw / 2 - 3 * s, base - th], [tx, base - th - tw * 1.3], [tx + tw / 2 + 3 * s, base - th]]); L.line(1, `M${n(tx)} ${n(base - th - tw * 1.3)}v-9`); L.poly([[tx, base - th - tw * 1.3 - 9], [tx + 8, base - th - tw * 1.3 - 6.5], [tx, base - th - tw * 1.3 - 4]]); }
    else { L.rect(tx - tw / 2 - 2 * s, base - th - 2, tw + 4 * s, 4); merlons(tx - tw / 2 - 2 * s, tx + tw / 2 + 2 * s, base - th - 2, 3.4 * s); }
    if (win) win.rect(tx - 1, base - th + 8 * s, 2.2, 5 * s);
  }
  const kx = cx + between(r, -wallW * 0.2, wallW * 0.2), kw = between(r, 34, 50) * s, kh = wallH + between(r, 34, 50) * s;
  L.rect(kx - kw / 2, base - kh, kw, kh);
  merlons(kx - kw / 2, kx + kw / 2, base - kh);
  L.rect(kx + kw * 0.12, base - kh - 16 * s, kw * 0.3, 16 * s + 1);
  merlons(kx + kw * 0.12, kx + kw * 0.42, base - kh - 16 * s, 3 * s);
  L.line(1, `M${n(kx + kw * 0.27)} ${n(base - kh - 20 * s)}v-14`);
  L.path(`M${n(kx + kw * 0.27)} ${n(base - kh - 20 * s - 14)}q6 2 12 0q-2 3 0 6q-6 2 -12 0Z`);
  if (win) for (let i = 0; i < 3; i++) win.rect(kx - kw / 2 + 6 + i * (kw / 3), base - kh + 12 * s, 2.5, 6 * s);
}
export function ruins(L: Layer, r: Rng, base: number, scale: number) {
  L.path(smoothPath(profile(r, 5, base - 6, base), H));
  let x = between(r, 0, 40);
  while (x < W) {
    const kind = pick(r, ["arch", "arch", "column", "wall", "tower", "column"]);
    const s = scale * between(r, 0.8, 1.2);
    const draw = (x0: number) => {
      if (kind === "arch") {
        const w = 46 * s, h = 52 * s, ar = 12 * s;
        const jag: [number, number][] = [[x0, base], [x0, base - h * 0.8], [x0 + w * 0.15, base - h], [x0 + w * 0.3, base - h * 0.88], [x0 + w * 0.45, base - h * 0.95], [x0 + w * 0.62, base - h * 0.7], [x0 + w * 0.8, base - h * 0.78], [x0 + w, base - h * 0.55], [x0 + w, base]];
        let d = `M${pts(jag)}Z`;
        for (const ax of [0.27, 0.73]) d += `M${n(x0 + w * ax - ar)} ${n(base)}V${n(base - h * 0.45)}a${n(ar)} ${n(ar)} 0 0 1 ${n(2 * ar)} 0V${n(base)}Z`;
        L.hole(d);
      } else if (kind === "column") {
        const cw = 7 * s, ch = between(r, 24, 58) * s;
        L.rect(x0 - cw / 2 - 2, base - 4, cw + 4, 4);
        L.poly([[x0 - cw / 2, base], [x0 - cw / 2, base - ch], [x0 - cw / 4, base - ch - 3], [x0 + cw / 5, base - ch + 1], [x0 + cw / 2, base - ch - 2], [x0 + cw / 2, base]]);
        if (r() < 0.35) L.rect(x0 - cw / 2 - 3, base - ch - 7, cw + 6, 4);
      } else if (kind === "wall") {
        const w = between(r, 30, 70) * s, h = between(r, 12, 26) * s;
        const p: [number, number][] = [[x0, base]];
        for (let i = 0; i <= 6; i++) p.push([x0 + (w * i) / 6, base - h * between(r, 0.4, 1)]);
        p.push([x0 + w, base]);
        L.poly(p);
      } else {
        const w = 20 * s, h = between(r, 50, 76) * s;
        L.hole(`M${pts([[x0, base], [x0, base - h], [x0 + w * 0.35, base - h - 6], [x0 + w * 0.55, base - h + 8], [x0 + w, base - h * 0.7], [x0 + w, base]])}ZM${n(x0 + w * 0.4)} ${n(base - h * 0.6)}h3v8h-3Z`);
      }
      for (let i = 0; i < 3; i++) L.rect(x0 + between(r, -14, 40), base - between(r, 2, 5), between(r, 3, 8), 6);
    };
    wrap(x + 25, 40, (cx) => draw(cx - 25));
    x += between(r, 60, 130);
  }
}
export function graves(L: Layer, r: Rng, base: number, count: number) {
  L.path(smoothPath(profile(r, 4, base - 5, base), H));
  for (let i = 0; i < count; i++) {
    const x = between(r, 0, W), s = between(r, 0.7, 1.3), b = base - between(r, 0, 4) + 2;
    wrap(x, 14, (cx) => {
      const k = pick(r, ["stone", "stone", "cross", "obelisk", "angel", "stone"]);
      if (k === "stone") { const w = 9 * s, h = 13 * s; L.path(`M${n(cx - w / 2)} ${n(b)}V${n(b - h + w / 2)}a${n(w / 2)} ${n(w / 2)} 0 0 1 ${n(w)} 0V${n(b)}Z`); }
      else if (k === "cross") { L.rect(cx - 1.5 * s, b - 22 * s, 3 * s, 22 * s); L.rect(cx - 6 * s, b - 17 * s, 12 * s, 3 * s); }
      else if (k === "obelisk") L.poly([[cx - 4 * s, b], [cx - 3 * s, b - 26 * s], [cx, b - 31 * s], [cx + 3 * s, b - 26 * s], [cx + 4 * s, b]]);
      else { L.rect(cx - 6 * s, b - 8 * s, 12 * s, 8 * s); L.ellipse(cx, b - 16 * s, 3.2 * s, 7 * s); L.circle(cx, b - 25 * s, 2.6 * s); L.path(`M${n(cx - 2)} ${n(b - 19 * s)}q-10 -6 -12 -14q8 3 12 8Z M${n(cx + 2)} ${n(b - 19 * s)}q10 -6 12 -14q-8 3 -12 8Z`); }
    });
  }
}
export function fence(L: Layer, base: number, gap: number, h: number, spikes = true) {
  let d = `M0 ${n(base - h * 0.75)}H${W}M0 ${n(base - h * 0.2)}H${W}`;
  for (let x = gap / 2; x < W; x += gap) d += `M${n(x)} ${n(base)}V${n(base - h)}`;
  L.line(1.2, d);
  if (spikes) for (let x = gap / 2; x < W; x += gap) L.poly([[x - 1.6, base - h], [x, base - h - 4], [x + 1.6, base - h]]);
}
export function tents(L: Layer, r: Rng, base: number, count: number, s = 1) {
  L.rect(0, base - 2, W, H - base + 2);
  for (let i = 0; i < count; i++) {
    const x = between(r, 0, W), w = between(r, 30, 60) * s, h = w * between(r, 0.5, 0.75);
    wrap(x, w / 2 + 4, (cx) => {
      if (r() < 0.35) {
        L.path(`M${n(cx - w / 2)} ${n(base)}Q${n(cx - w * 0.45)} ${n(base - h * 0.9)} ${n(cx)} ${n(base - h * 1.3)}Q${n(cx + w * 0.45)} ${n(base - h * 0.9)} ${n(cx + w / 2)} ${n(base)}Z`);
        L.line(1, `M${n(cx)} ${n(base - h * 1.3)}v-12`);
        L.poly([[cx, base - h * 1.3 - 12], [cx + 9, base - h * 1.3 - 9], [cx, base - h * 1.3 - 6]]);
      } else L.hole(`M${pts([[cx - w / 2, base], [cx, base - h], [cx + w / 2, base]])}ZM${pts([[cx - w * 0.08, base], [cx, base - h * 0.42], [cx + w * 0.1, base]])}Z`);
    });
  }
  for (let i = 0; i < 4; i++) {
    const x = between(r, 0, W), h = between(r, 20, 34) * s;
    L.line(1, `M${n(x)} ${n(base)}v${n(-h)}`);
    L.path(`M${n(x)} ${n(base - h)}h12l-3 4l3 4h-12Z`);
  }
}
export function ship(L: Layer, r: Rng, cx: number, base: number, s: number, masts = 3) {
  const len = 70 * s;
  L.path(`M${n(cx - len / 2)} ${n(base - 9 * s)}L${n(cx + len / 2 + 8 * s)} ${n(base - 11 * s)}Q${n(cx + len / 2)} ${n(base)} ${n(cx + len * 0.3)} ${n(base + 1)}H${n(cx - len * 0.36)}Q${n(cx - len / 2)} ${n(base - 3 * s)} ${n(cx - len / 2)} ${n(base - 9 * s)}Z`);
  L.rect(cx - len / 2, base - 14 * s, 14 * s, 6 * s);
  for (let i = 0; i < masts; i++) {
    const mx = cx - len * 0.3 + (len * 0.62 * i) / Math.max(1, masts - 1), mh = (i === Math.floor(masts / 2) ? 64 : 52) * s;
    L.line(1.2, `M${n(mx)} ${n(base - 9 * s)}V${n(base - 9 * s - mh)}`);
    for (let k = 0; k < 3; k++) {
      const y = base - 14 * s - mh * (0.2 + k * 0.27), sw = (15 - k * 3.5) * s;
      L.path(`M${n(mx - sw)} ${n(y - 12 * s)}H${n(mx + sw)}Q${n(mx + sw + 3 * s)} ${n(y - 5 * s)} ${n(mx + sw)} ${n(y)}H${n(mx - sw)}Q${n(mx - sw + 3 * s)} ${n(y - 5 * s)} ${n(mx - sw)} ${n(y - 12 * s)}Z`);
    }
  }
  L.line(0.6, `M${n(cx - len / 2)} ${n(base - 12 * s)}L${n(cx - len * 0.3)} ${n(base - 9 * s - 52 * s)}M${n(cx + len / 2 + 8 * s)} ${n(base - 11 * s)}L${n(cx + len * 0.32)} ${n(base - 9 * s - 52 * s)}`);
}
export function sailboat(L: Layer, cx: number, base: number, s: number) {
  L.path(`M${n(cx - 14 * s)} ${n(base - 4 * s)}H${n(cx + 16 * s)}Q${n(cx + 10 * s)} ${n(base)} ${n(cx - 10 * s)} ${n(base)}Z`);
  L.poly([[cx, base - 5 * s], [cx, base - 34 * s], [cx + 13 * s, base - 6 * s]]);
  L.poly([[cx - 1.5 * s, base - 7 * s], [cx - 1.5 * s, base - 28 * s], [cx - 11 * s, base - 7 * s]]);
}
export function lighthouse(L: Layer, cx: number, base: number, s: number) {
  L.poly([[cx - 8 * s, base], [cx - 5 * s, base - 46 * s], [cx + 5 * s, base - 46 * s], [cx + 8 * s, base]]);
  L.rect(cx - 7 * s, base - 49 * s, 14 * s, 3 * s);
  L.hole(`M${n(cx - 5 * s)} ${n(base - 49 * s)}v${n(-9 * s)}h${n(10 * s)}v${n(9 * s)}ZM${n(cx - 3 * s)} ${n(base - 50 * s)}v${n(-6 * s)}h${n(6 * s)}v${n(6 * s)}Z`);
  L.poly([[cx - 6 * s, base - 58 * s], [cx, base - 64 * s], [cx + 6 * s, base - 58 * s]]);
}
export function windmill(L: Layer, cx: number, base: number, s: number) {
  L.poly([[cx - 9 * s, base], [cx - 6 * s, base - 36 * s], [cx + 6 * s, base - 36 * s], [cx + 9 * s, base]]);
  L.path(`M${n(cx - 7 * s)} ${n(base - 36 * s)}Q${n(cx)} ${n(base - 46 * s)} ${n(cx + 7 * s)} ${n(base - 36 * s)}Z`);
  const hx = cx, hy = base - 38 * s;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2, ex = hx + Math.cos(a) * 30 * s, ey = hy - Math.sin(a) * 30 * s;
    const px = -Math.sin(a) * 4 * s, py = -Math.cos(a) * 4 * s;
    L.line(1.2, `M${n(hx)} ${n(hy)}L${n(ex)} ${n(ey)}`);
    L.poly([[hx + Math.cos(a) * 9 * s, hy - Math.sin(a) * 9 * s], [ex, ey], [ex + px, ey + py], [hx + Math.cos(a) * 9 * s + px, hy - Math.sin(a) * 9 * s + py]]);
  }
}
export function barn(L: Layer, cx: number, base: number, s: number) {
  L.path(`M${n(cx - 20 * s)} ${n(base)}V${n(base - 18 * s)}L${n(cx - 14 * s)} ${n(base - 30 * s)}L${n(cx)} ${n(base - 36 * s)}L${n(cx + 14 * s)} ${n(base - 30 * s)}L${n(cx + 20 * s)} ${n(base - 18 * s)}V${n(base)}Z`);
  L.rect(cx + 22 * s, base - 40 * s, 9 * s, 40 * s);
  L.ellipse(cx + 26.5 * s, base - 40 * s, 4.5 * s, 4 * s);
}
export function waterTower(L: Layer, cx: number, base: number, s: number) {
  L.line(1, `M${n(cx - 7 * s)} ${n(base)}L${n(cx - 5 * s)} ${n(base - 16 * s)}M${n(cx + 7 * s)} ${n(base)}L${n(cx + 5 * s)} ${n(base - 16 * s)}M${n(cx - 6 * s)} ${n(base - 8 * s)}H${n(cx + 6 * s)}`);
  L.rect(cx - 7 * s, base - 30 * s, 14 * s, 14 * s);
  L.poly([[cx - 8 * s, base - 30 * s], [cx, base - 36 * s], [cx + 8 * s, base - 30 * s]]);
}
export function pyramid(L: Layer, cx: number, base: number, w: number) {
  L.poly([[cx - w / 2, base], [cx, base - w * 0.62], [cx + w / 2, base]]);
}
export function cactus(L: Layer, cx: number, base: number, h: number) {
  const w = h * 0.14;
  L.path(`M${n(cx - w / 2)} ${n(base)}V${n(base - h + w / 2)}a${n(w / 2)} ${n(w / 2)} 0 0 1 ${n(w)} 0V${n(base)}Z`);
  L.path(`M${n(cx - w / 2)} ${n(base - h * 0.42)}H${n(cx - w * 1.7)}V${n(base - h * 0.75)}a${n(w * 0.38)} ${n(w * 0.38)} 0 0 1 ${n(w * 0.76)} 0V${n(base - h * 0.55)}H${n(cx - w / 2)}Z`);
  L.path(`M${n(cx + w / 2)} ${n(base - h * 0.55)}H${n(cx + w * 1.6)}V${n(base - h * 0.82)}a${n(w * 0.36)} ${n(w * 0.36)} 0 0 0 ${n(-w * 0.72)} 0V${n(base - h * 0.66)}H${n(cx + w / 2)}Z`);
}
export function camel(L: Layer, cx: number, base: number, s: number) {
  L.path(`M${n(cx - 12 * s)} ${n(base - 12 * s)}Q${n(cx - 9 * s)} ${n(base - 22 * s)} ${n(cx - 4 * s)} ${n(base - 15 * s)}Q${n(cx + 1 * s)} ${n(base - 22 * s)} ${n(cx + 6 * s)} ${n(base - 14 * s)}L${n(cx + 12 * s)} ${n(base - 21 * s)}L${n(cx + 15 * s)} ${n(base - 19 * s)}L${n(cx + 9 * s)} ${n(base - 11 * s)}L${n(cx - 12 * s)} ${n(base - 10 * s)}Z`);
  L.line(1.1 * s, `M${n(cx - 10 * s)} ${n(base - 11 * s)}V${n(base)}M${n(cx - 7 * s)} ${n(base - 11 * s)}V${n(base)}M${n(cx + 4 * s)} ${n(base - 11 * s)}V${n(base)}M${n(cx + 7 * s)} ${n(base - 11 * s)}V${n(base)}`);
}
export function reeds(L: Layer, r: Rng, base: number, count: number, h: [number, number]) {
  let d = "";
  for (let i = 0; i < count; i++) {
    const x = between(r, 0, W), hh = between(r, h[0], h[1]), bend = between(r, -6, 6);
    d += `M${n(x)} ${n(base)}Q${n(x + bend * 0.2)} ${n(base - hh * 0.6)} ${n(x + bend)} ${n(base - hh)}`;
    if (r() < 0.25) L.ellipse(x + bend * 0.85, base - hh * 0.88, 1.6, 4.5);
  }
  L.line(1, d);
}
export function ferns(L: Layer, r: Rng, base: number, count: number, s = 1) {
  for (let i = 0; i < count; i++) {
    const x = between(r, 0, W);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI * (0.18 + k * 0.21) + between(r, -0.1, 0.1), len = between(r, 18, 30) * s;
      const ex = x + Math.cos(a) * len, ey = base - Math.sin(a) * len * 0.8;
      L.path(`M${n(x)} ${n(base)}Q${n(x + Math.cos(a) * len * 0.5 - 3)} ${n(base - Math.sin(a) * len)} ${n(ex)} ${n(ey)}Q${n(x + Math.cos(a) * len * 0.5 + 3)} ${n(base - Math.sin(a) * len * 0.6)} ${n(x)} ${n(base)}Z`);
    }
  }
}
export function vines(L: Layer, r: Rng, count: number, len: [number, number]) {
  let d = "";
  for (let i = 0; i < count; i++) {
    const x = between(r, 0, W), l = between(r, len[0], len[1]);
    d += `M${n(x)} 0Q${n(x + between(r, -8, 8))} ${n(l * 0.5)} ${n(x + between(r, -4, 4))} ${n(l)}`;
    for (let k = 0; k < 3; k++) L.ellipse(x + between(r, -3, 3), l * between(r, 0.3, 1), 2.5, 1.4);
  }
  L.line(1, d);
}
export function canopy(L: Layer, r: Rng, depth: number) {
  let d = `M0 0H${W}V${n(depth * 0.4)}`;
  for (let x = W; x > 0; x -= between(r, 20, 50)) d += `Q${n(x - 10)} ${n(depth * between(r, 0.6, 1.1))} ${n(x - 25)} ${n(depth * between(r, 0.3, 0.6))}`;
  L.path(d + `L0 ${n(depth * 0.4)}Z`);
}
export function stalactites(L: Layer, r: Rng, depth: number, up = false) {
  let d = up ? `M0 ${H}` : "M0 0";
  let x = 0;
  const y0 = up ? H - depth * 0.35 : depth * 0.35;
  d += `L0 ${n(y0)}`;
  while (x < W) {
    const w = between(r, 6, 24), len = depth * between(r, 0.4, 1);
    d += `L${n(x + w * 0.4)} ${n(up ? H - len : len)}L${n(x + w)} ${n(y0 + between(r, -4, 4))}`;
    x += w;
  }
  return L.path(d + `L${W} ${n(y0)}L${W} ${up ? H : 0}Z`);
}
export function crystals(L: Layer, r: Rng, base: number, count: number) {
  for (let i = 0; i < count; i++) {
    const x = between(r, 0, W), k = 2 + Math.floor(r() * 3);
    for (let j = 0; j < k; j++) {
      const a = between(r, -0.5, 0.5), h = between(r, 10, 30), w = h * 0.22, bx = x + j * 4 - k * 2;
      const tx = bx + Math.sin(a) * h, ty = base - Math.cos(a) * h;
      L.poly([[bx - w / 2, base], [tx - w / 2, ty + w], [tx, ty], [tx + w / 2, ty + w], [bx + w / 2, base]]);
    }
  }
}
export function topiary(L: Layer, r: Rng, base: number) {
  L.rect(0, base - 1, W, H - base + 1);
  let x = between(r, 5, 30);
  while (x < W) {
    const k = pick(r, ["hedge", "ball", "cone", "arch", "hedge", "ball"]);
    const draw = (x0: number) => {
      if (k === "hedge") { const w = between(r, 40, 90), h = between(r, 10, 16); L.path(`M${n(x0)} ${n(base)}V${n(base - h + 4)}Q${n(x0)} ${n(base - h)} ${n(x0 + 4)} ${n(base - h)}H${n(x0 + w - 4)}Q${n(x0 + w)} ${n(base - h)} ${n(x0 + w)} ${n(base - h + 4)}V${n(base)}Z`); }
      else if (k === "ball") { L.rect(x0 - 1, base - 16, 2, 16); L.circle(x0, base - 22, 8); L.circle(x0, base - 37, 5); }
      else if (k === "cone") L.path(`M${n(x0)} ${n(base - 44)}Q${n(x0 + 12)} ${n(base - 14)} ${n(x0 + 9)} ${n(base)}H${n(x0 - 9)}Q${n(x0 - 12)} ${n(base - 14)} ${n(x0)} ${n(base - 44)}Z`);
      else { L.line(2.2, `M${n(x0 - 14)} ${n(base)}V${n(base - 24)}A14 14 0 0 1 ${n(x0 + 14)} ${n(base - 24)}V${n(base)}`); for (let i = 0; i < 8; i++) L.circle(x0 + between(r, -16, 16), base - between(r, 18, 40), between(r, 2, 4)); }
    };
    wrap(x, 50, draw);
    x += between(r, 30, 80);
  }
}
export function fountain(L: Layer, cx: number, base: number, s: number) {
  L.path(`M${n(cx - 26 * s)} ${n(base)}V${n(base - 6 * s)}H${n(cx + 26 * s)}V${n(base)}Z`);
  L.rect(cx - 2.5 * s, base - 22 * s, 5 * s, 16 * s);
  L.ellipse(cx, base - 22 * s, 13 * s, 2.5 * s);
  L.rect(cx - 1.5 * s, base - 32 * s, 3 * s, 10 * s);
  L.ellipse(cx, base - 32 * s, 6 * s, 1.6 * s);
  L.line(0.8, `M${n(cx)} ${n(base - 33 * s)}q-4 -10 -10 4M${n(cx)} ${n(base - 33 * s)}q4 -10 10 4M${n(cx - 12 * s)} ${n(base - 22 * s)}q-6 4 -8 15M${n(cx + 12 * s)} ${n(base - 22 * s)}q6 4 8 15`);
}
export function lampPosts(L: Layer, base: number, gap: number, h: number, start = 40) {
  for (let x = start; x < W; x += gap) {
    L.line(1.4, `M${n(x)} ${n(base)}V${n(base - h)}q0 -4 5 -4`);
    L.path(`M${n(x + 2)} ${n(base - h - 4)}h7l-1.5 5h-4Z`);
  }
}
export function archBridge(L: Layer, r: Rng, base: number, deck: number, arches: number) {
  const span = W / arches;
  let d = `M0 ${n(deck - 4)}H${W}V${n(base)}H0Z`;
  for (let i = 0; i < arches; i++) {
    const cx = span * (i + 0.5), ar = span * 0.38, top = deck + 4;
    d += `M${n(cx - ar)} ${n(base)}V${n(top + ar * 0.55)}A${n(ar)} ${n(ar * 0.7)} 0 0 1 ${n(cx + ar)} ${n(top + ar * 0.55)}V${n(base)}Z`;
  }
  L.hole(d);
  let p = "";
  for (let x = 4; x < W; x += 9) p += `M${n(x)} ${n(deck - 4)}v-6`;
  L.line(1.4, p + `M0 ${n(deck - 10)}H${W}`);
  void r;
}
export function suspension(L: Layer, base: number, deck: number) {
  L.rect(0, deck, W, 4);
  const tw = [W * 0.28, W * 0.72];
  for (const tx of tw) { L.rect(tx - 4, deck - 52, 8, base - deck + 52); L.rect(tx - 6, deck - 40, 12, 3); L.rect(tx - 6, deck - 20, 12, 3); }
  let d = `M0 ${n(deck - 22)}Q${n(tw[0] * 0.6)} ${n(deck - 6)} ${n(tw[0])} ${n(deck - 52)}Q${W / 2} ${n(deck + 4)} ${n(tw[1])} ${n(deck - 52)}Q${n(W - tw[0] * 0.6)} ${n(deck - 6)} ${W} ${n(deck - 22)}`;
  L.line(1.4, d);
  let h = "";
  for (let x = 10; x < W; x += 14) h += `M${n(x)} ${n(deck)}V${n(deck - 8)}`;
  L.line(0.5, h);
}
export function volcano(L: Layer, r: Rng, cx: number, base: number, w: number, h: number) {
  const cr = w * 0.07;
  L.path(`M${n(cx - w / 2)} ${n(base)}Q${n(cx - w * 0.18)} ${n(base - h * 0.5)} ${n(cx - cr * 1.4)} ${n(base - h)}L${n(cx - cr * 0.4)} ${n(base - h + 3)}L${n(cx + cr * 0.5)} ${n(base - h + 2)}L${n(cx + cr * 1.4)} ${n(base - h + between(r, -2, 2))}Q${n(cx + w * 0.2)} ${n(base - h * 0.5)} ${n(cx + w / 2)} ${n(base)}Z`);
}
export function station(L: Layer, r: Rng, cx: number, cy: number, s: number) {
  L.hole(`M${n(cx - 40 * s)} ${n(cy)}a${n(40 * s)} ${n(14 * s)} 0 1 0 ${n(80 * s)} 0a${n(40 * s)} ${n(14 * s)} 0 1 0 ${n(-80 * s)} 0ZM${n(cx - 34 * s)} ${n(cy)}a${n(34 * s)} ${n(10 * s)} 0 1 0 ${n(68 * s)} 0a${n(34 * s)} ${n(10 * s)} 0 1 0 ${n(-68 * s)} 0Z`);
  L.rect(cx - 3 * s, cy - 26 * s, 6 * s, 52 * s);
  L.rect(cx - 8 * s, cy - 6 * s, 16 * s, 12 * s);
  L.line(1, `M${n(cx - 36 * s)} ${n(cy)}H${n(cx + 36 * s)}`);
  for (const sx of [-1, 1]) { L.rect(cx + sx * 50 * s - 9 * s, cy - 18 * s, 18 * s, 6 * s); L.rect(cx + sx * 50 * s - 9 * s, cy + 12 * s, 18 * s, 6 * s); L.line(1, `M${n(cx + sx * 40 * s)} ${n(cy)}H${n(cx + sx * 50 * s)}V${n(cy - 12 * s)}M${n(cx + sx * 50 * s)} ${n(cy)}V${n(cy + 12 * s)}`); }
  void r;
}
export function asteroids(L: Layer, r: Rng, count: number, y: [number, number], size: [number, number]) {
  for (let i = 0; i < count; i++) {
    const cx = between(r, 0, W), cy = between(r, y[0], y[1]), s = between(r, size[0], size[1]);
    const p: [number, number][] = [];
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; p.push([cx + Math.cos(a) * s * between(r, 0.7, 1.15), cy + Math.sin(a) * s * between(r, 0.6, 1)]); }
    L.poly(p);
  }
}
/** Birds as tiny "m" strokes, used for flocks. */
export function birds(L: Layer, r: Rng, count: number, w: number, h: number) {
  let d = "";
  for (let i = 0; i < count; i++) {
    const x = between(r, 6, w - 6), y = between(r, 4, h - 4), s = between(r, 0.6, 1.2);
    d += `M${n(x - 5 * s)} ${n(y - 1)}q${n(2.5 * s)} ${n(-3 * s)} ${n(5 * s)} ${n(1 * s)}q${n(2.5 * s)} ${n(-4 * s)} ${n(5 * s)} ${n(-1 * s)}`;
  }
  L.line(1.2, d);
}
export function bats(L: Layer, r: Rng, count: number, w: number, h: number) {
  for (let i = 0; i < count; i++) {
    const x = between(r, 6, w - 6), y = between(r, 4, h - 4), s = between(r, 0.6, 1.1);
    L.path(`M${n(x)} ${n(y)}q${n(-3 * s)} ${n(-4 * s)} ${n(-8 * s)} ${n(-2 * s)}q${n(2 * s)} ${n(1 * s)} ${n(1 * s)} ${n(3 * s)}q${n(2 * s)} ${n(-1 * s)} ${n(3 * s)} ${n(1 * s)}q${n(1 * s)} ${n(-1.5 * s)} ${n(4 * s)} ${n(0)}q${n(3 * s)} ${n(-1.5 * s)} ${n(4 * s)} ${n(0)}q${n(1 * s)} ${n(-2 * s)} ${n(3 * s)} ${n(-1 * s)}q${n(-1 * s)} ${n(-2 * s)} ${n(1 * s)} ${n(-3 * s)}q${n(-5 * s)} ${n(-2 * s)} ${n(-8 * s)} ${n(2 * s)}Z`);
  }
}
export function balloon(L: Layer, cx: number, cy: number, s: number) {
  L.path(`M${n(cx)} ${n(cy - 14 * s)}a${n(11 * s)} ${n(12 * s)} 0 0 1 ${n(9 * s)} ${n(18 * s)}L${n(cx + 3 * s)} ${n(cy + 9 * s)}H${n(cx - 3 * s)}L${n(cx - 9 * s)} ${n(cy + 4 * s)}a${n(11 * s)} ${n(12 * s)} 0 0 1 ${n(9 * s)} ${n(-18 * s)}Z`);
  L.rect(cx - 2.5 * s, cy + 12 * s, 5 * s, 4 * s);
  L.line(0.5, `M${n(cx - 3 * s)} ${n(cy + 9 * s)}l0.5 3M${n(cx + 3 * s)} ${n(cy + 9 * s)}l-0.5 3`);
}
/** A gnarled branch reaching in from the top-left corner (horror). */
export function cornerBranch(L: Layer, r: Rng) {
  const branch = (x0: number, y0: number, ang: number, len: number, w: number, d: number) => {
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
    L.line(w, `M${n(x0)} ${n(y0)}Q${n((x0 + x1) / 2 + between(r, -4, 4))} ${n((y0 + y1) / 2 + between(r, -4, 4))} ${n(x1)} ${n(y1)}`);
    if (d > 0) for (let i = 0; i < 2; i++) branch(x1, y1, ang + between(r, -0.7, 0.7), len * between(r, 0.55, 0.75), Math.max(0.6, w * 0.6), d - 1);
  };
  branch(-6, 6, 0.18, 70, 6, 5);
  return L;
}
/** A floating island with a hanging root mass (fantasy). */
export function floatingIsle(L: Layer, r: Rng, cx: number, cy: number, w: number) {
  // domed top, then a jagged rock underside tapering to a point, with hanging roots
  let d = `M${n(cx - w / 2)} ${n(cy)}Q${n(cx)} ${n(cy - w * 0.08)} ${n(cx + w / 2)} ${n(cy)}`;
  const steps = 9;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, x = cx + w / 2 - w * t, depth = Math.sin(Math.PI * t) * w * 0.55 * between(r, 0.7, 1.1);
    d += `L${n(x + between(r, -3, 3))} ${n(cy + depth)}`;
  }
  L.path(d + "Z");
  for (let i = 0; i < 7; i++) { const x = cx + between(r, -w * 0.4, w * 0.4), h = between(r, 8, 20); pine(L, x, cy - w * 0.03, h, h * 0.5, r); }
  let roots = "";
  for (let i = 0; i < 6; i++) { const x = cx + between(r, -w * 0.25, w * 0.25), y = cy + w * between(r, 0.2, 0.4); roots += `M${n(x)} ${n(y)}q${n(between(r, -4, 4))} ${n(w * 0.12)} ${n(between(r, -3, 3))} ${n(w * 0.22)}`; }
  L.line(0.8, roots);
}
export function planetRing(L: Layer, cx: number, cy: number, rad: number) {
  L.hole(`M${n(cx - rad * 2)} ${n(cy)}a${n(rad * 2)} ${n(rad * 0.45)} 0 1 0 ${n(rad * 4)} 0a${n(rad * 2)} ${n(rad * 0.45)} 0 1 0 ${n(-rad * 4)} 0ZM${n(cx - rad * 1.6)} ${n(cy)}a${n(rad * 1.6)} ${n(rad * 0.3)} 0 1 0 ${n(rad * 3.2)} 0a${n(rad * 1.6)} ${n(rad * 0.3)} 0 1 0 ${n(-rad * 3.2)} 0Z`);
}
