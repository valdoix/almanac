// The scene plate's places: what the 📍 path is classified as, and for each kind
// four drawn variants. A variant is a CSS chunk scoped to .p[data-k=kind-v] that
// hands the plate its silhouettes (as mask URLs) and layer heights; the regex
// emits only the chunk it picked, so a message carries one place's art.
import {
  Layer, W, H, rng, hills, ridge, mesas, forest, pine, roundTree, deadTree, palm, willow, bush, cypress, skyline, houses, castle, ruins, graves, fence, tents, ship, sailboat,
  lighthouse, windmill, barn, waterTower, pyramid, cactus, camel, reeds, ferns, vines, canopy, stalactites, crystals, topiary, fountain, lampPosts, archBridge, suspension,
  volcano, station, asteroids, smoothPath, profile, type Rng, type Skyline, svgUrl,
} from "./art";

export interface Variant {
  far?: Layer; mid?: Layer; near?: Layer; fg?: Layer;
  /** Lit windows, drawn over the layer named by `winOn`. */
  win?: Layer; winOn?: "far" | "mid" | "near";
  /** Custom properties for .p (heights, water line, tints). */
  vars?: string;
  /** Extra CSS; "&" is the plate selector. */
  css?: string;
}
export interface Kind {
  id: string;
  /** Shared CSS for every variant ("&" is the plate selector). */
  css?: string;
  vars?: string;
  variants: ((r: Rng) => Variant)[];
}

const L = () => new Layer();
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const between = (r: Rng, a: number, b: number) => a + (b - a) * r();

// Shared pieces ───────────────────────────────────────────────────────────────
const SNOWCAP = `&.p .far{background:linear-gradient(180deg,color-mix(in oklab,#f4f8fc 82%,var(--s3)) 0 16%,color-mix(in oklab,var(--F),var(--s3) 30%) 34%,var(--F))}`;
const MIST = (bottom: string, h = "18%", a = ".45") => `&.p .kx{top:auto;bottom:${bottom};height:${h};background:linear-gradient(180deg,transparent,color-mix(in oklab,var(--s3) 70%,#fff) 50%,transparent);opacity:${a};filter:blur(4px)}`;
const VEG = "--va:22%;";
const WARM = "--kt:#c98a4a;--ka:38%;";
const ROCK = "--kt:#9a4a2a;--ka:42%;";
const ICE = "--kt:#dfe9f4;--ka:55%;";
const JUNGLE = "--kt:#1f5a3a;--ka:30%;";
const SWAMP = "--kt:#3c4a2a;--ka:35%;";

/** Water kinds: a waterline, reflections on, the far layer sitting on the water. */
const water = (wl: string, extra = "") => `--wl:${wl};--bf:${wl};--rf:1;${extra}`;

function cityVariants(styles: [Skyline, Skyline, Skyline], extra: (r: Rng, far: Layer, mid: Layer, near: Layer, v: number) => string | void = () => {}): ((r: Rng) => Variant)[] {
  return [0, 1, 2, 3].map((v) => (r: Rng) => {
    const far = L(), mid = L(), near = L(), win = L();
    skyline(far, null, r, styles[0], 100, [30, 70]);
    skyline(mid, win, r, styles[1], 100, [24, 62], 1.1);
    skyline(near, null, r, styles[2], 100, [14, 40]);
    const css = extra(r, far, mid, near, v) || "";
    return { far, mid, near, win, winOn: "mid", vars: `--hf:${[64, 70, 58, 66][v]}%;--hm:${[48, 52, 44, 50][v]}%;--hn:${[26, 22, 30, 24][v]}%;`, css };
  });
}

export const KINDS: Kind[] = [
  // ── Woods and wilds ───────────────────────────────────────────────────────
  {
    id: "forest", vars: VEG, css: MIST("16%"),
    variants: [
      (r) => ({ far: hills(forest(L(), r, "pine", 52, 96, [10, 24]), r, 5, 70, 90), mid: forest(L(), r, "pine", 26, 98, [22, 44]), near: forest(L(), r, "pine", 11, 100, [48, 92], 2), vars: "--hf:52%;--hm:44%;--hn:42%;" }),
      (r) => ({ far: hills(forest(L(), r, "round", 34, 96, [12, 22]), r, 4, 60, 85), mid: forest(L(), r, "round", 18, 98, [22, 40]), near: (() => { const l = forest(L(), r, "round", 7, 100, [40, 80], 3); for (let i = 0; i < 6; i++) bush(l, between(r, 0, W), 100, 22, r); return l; })(), vars: "--hf:48%;--hm:40%;--hn:38%;" }),
      (r) => ({ far: forest(L(), r, "mixed", 44, 96, [12, 26]), mid: forest(L(), r, "birch", 18, 99, [26, 50]), near: (() => { const l = forest(L(), r, "birch", 7, 100, [60, 95], 2); ferns(l, r, 100, 8); return l; })(), vars: "--hf:50%;--hm:46%;--hn:48%;" }),
      (r) => {
        const near = L(), fg = L();
        for (let i = 0; i < 5; i++) { const x = between(r, 0, W), w = between(r, 14, 30); near.path(`M${x - w} 100Q${x - w * 0.4} 92 ${x - w * 0.45} 70V0H${x + w * 0.45}V70Q${x + w * 0.4} 92 ${x + w} 100Z`); }
        ferns(near, r, 100, 14, 1.2);
        canopy(fg, r, 30); vines(fg, r, 16, [20, 55]);
        return { far: forest(L(), r, "pine", 44, 98, [16, 30]), mid: forest(L(), r, "cypress", 30, 99, [26, 50]), near, fg, vars: "--hf:46%;--hm:50%;--hn:100%;--hg:100%;", css: MIST("10%", "30%", ".55") };
      },
    ],
  },
  {
    id: "jungle", vars: VEG + JUNGLE, css: MIST("22%", "22%", ".5"),
    variants: [
      (r) => { const fg = L(); canopy(fg, r, 26); vines(fg, r, 14, [20, 60]); const near = L(); ferns(near, r, 100, 12, 1.4); palm(near, between(r, 270, 300), 100, 80, r, 0.3); palm(near, between(r, 500, 530), 100, 70, r, -0.3); return { far: forest(L(), r, "round", 36, 96, [16, 30]), mid: forest(L(), r, "palm", 12, 99, [30, 56]), near, fg, vars: "--hf:56%;--hm:48%;--hn:60%;--hg:100%;" }; },
      (r) => {
        const far = forest(L(), r, "round", 28, 98, [12, 24]);
        const tx = between(r, 250, 550);
        for (let t = 0; t < 5; t++) far.rect(tx - 60 + t * 11, 98 - (t + 1) * 11, 120 - t * 22, 12);
        far.rect(tx - 9, 98 - 66, 18, 12);
        const near = L(); ferns(near, r, 100, 12, 1.3);
        const fg = L(); vines(fg, r, 12, [16, 50]); canopy(fg, r, 16);
        return { far, mid: forest(L(), r, "palm", 14, 99, [26, 50]), near, fg, vars: "--hf:60%;--hm:44%;--hn:46%;--hg:100%;" };
      },
      (r) => {
        const far = L();
        ridge(far, r, 22, 58, 0.45);
        return {
          far, mid: forest(L(), r, "round", 34, 99, [22, 40]), near: (() => { const l = L(); ferns(l, r, 100, 20, 1.3); return l; })(), vars: "--hf:66%;--hm:40%;--hn:40%;",
          css: `&.p .kx{left:44%;width:5%;top:30%;bottom:40%;background:repeating-linear-gradient(180deg,rgba(235,245,255,.75) 0 6px,rgba(200,225,245,.35) 6px 14px);filter:blur(1px);opacity:.85;border-radius:3px}&.p .kx2{left:38%;width:17%;top:auto;bottom:34%;height:12%;background:radial-gradient(50% 60% at 50% 50%,rgba(240,248,255,.7),transparent 70%);filter:blur(3px)}@media (prefers-reduced-motion:no-preference){&.p .kx{animation:fall 1.2s linear infinite}}`,
        };
      },
      (r) => { const fg = L(); canopy(fg, r, 34); vines(fg, r, 18, [30, 80]); return { far: forest(L(), r, "round", 32, 98, [20, 34]), mid: forest(L(), r, "round", 20, 99, [26, 44]), near: (() => { const l = L(); ferns(l, r, 100, 14, 1.5); return l; })(), fg, vars: "--hf:58%;--hm:52%;--hn:44%;--hg:100%;" }; },
    ],
  },
  {
    id: "swamp", vars: VEG + SWAMP + water("20%"), css: MIST("16%", "26%", ".6") + `&.p .water{filter:saturate(.5) brightness(.8)}`,
    variants: [
      (r) => ({ far: forest(L(), r, "dead", 14, 99, [20, 44]), mid: forest(L(), r, "willow", 6, 100, [30, 50], 0), near: (() => { const l = L(); reeds(l, r, 100, 80, [10, 30]); return l; })(), vars: "--hf:40%;--hm:44%;--hn:30%;" }),
      (r) => ({ far: forest(L(), r, "cypress", 40, 99, [14, 30]), mid: forest(L(), r, "dead", 7, 100, [36, 70], 0), near: (() => { const l = L(); reeds(l, r, 100, 100, [12, 34]); return l; })(), vars: "--hf:38%;--hm:56%;--hn:34%;" }),
      (r) => { const mid = L(); for (let i = 0; i < 6; i++) willow(mid, between(r, 0, W), 100, between(r, 40, 60), 50, r); return { far: forest(L(), r, "round", 40, 99, [10, 22]), mid, near: (() => { const l = L(); reeds(l, r, 100, 90, [8, 26]); return l; })(), vars: "--hf:34%;--hm:52%;--hn:28%;" }; },
      (r) => { const near = L(); deadTree(near, between(r, 300, 360), 100, 90, r, 4); reeds(near, r, 100, 90, [10, 30]); const mid = L(); mid.rect(between(r, 300, 500), 82, 46, 18); mid.poly([[300, 82], [323, 66], [346, 82]]); return { far: forest(L(), r, "dead", 16, 99, [14, 32]), mid, near, vars: "--hf:36%;--hm:38%;--hn:70%;" }; },
    ],
  },
  {
    id: "garden", vars: VEG,
    variants: [
      (r) => { const mid = L(); topiary(mid, r, 100); const near = L(); fountain(near, 400, 100, 2.2); lampPosts(near, 100, 260, 50, 120); return { far: forest(L(), r, "round", 30, 98, [16, 30]), mid, near, vars: "--hf:46%;--hm:30%;--hn:42%;" }; },
      (r) => { const mid = L(); topiary(mid, r, 100); const near = L(); for (let x = 30; x < W; x += 110) { near.line(2, `M${x - 22} 100V58A22 22 0 0 1 ${x + 22} 58V100`); for (let i = 0; i < 10; i++) near.circle(x + between(r, -26, 26), between(r, 36, 70), between(r, 2, 4.5)); } return { far: forest(L(), r, "cypress", 30, 98, [20, 40]), mid, near, vars: "--hf:50%;--hm:30%;--hn:46%;" }; },
      (r) => { const far = L(); far.rect(0, 70, W, 30); far.rect(260, 34, 280, 40); far.poly([[250, 36], [400, 12], [550, 36]]); for (let x = 280; x < 530; x += 26) far.hole(`M${x} 100V50h12v50ZM${x + 3} 56h6v12h-6Z`); const mid = L(); topiary(mid, r, 100); return { far, mid, near: (() => { const l = L(); fence(l, 100, 14, 22); return l; })(), win: (() => { const w = L(); for (let x = 283; x < 530; x += 26) w.rect(x, 56, 6, 12); return w; })(), winOn: "far", vars: "--hf:56%;--hm:28%;--hn:24%;" }; },
      (r) => { const near = L(); fountain(near, between(r, 350, 450), 100, 2.8); for (let i = 0; i < 12; i++) bush(near, between(r, 0, W), 100, 26, r); return { far: forest(L(), r, "mixed", 40, 98, [16, 34]), mid: forest(L(), r, "cypress", 14, 99, [30, 54]), near, vars: "--hf:50%;--hm:44%;--hn:40%;" }; },
    ],
  },
  {
    id: "plains", vars: VEG,
    variants: [
      (r) => { const near = hills(L(), r, 3, 80, 96); roundTree(near, between(r, 400, 500), 88, 60, 50, r); let d = ""; for (let x = 10; x < W; x += 34) d += `M${x} 100V84`; near.line(1.5, d + "M0 88H800"); return { far: hills(L(), r, 4, 50, 80), mid: hills(L(), r, 5, 60, 88), near, vars: "--hf:30%;--hm:24%;--hn:34%;" }; },
      (r) => { const mid = hills(L(), r, 4, 82, 94); barn(mid, between(r, 290, 340), 88, 1.1); windmill(mid, between(r, 450, 500), 86, 1.2); return { far: hills(L(), r, 5, 60, 85), mid, near: hills(L(), r, 3, 70, 90), vars: "--hf:30%;--hm:38%;--hn:20%;", css: `&.p .near{background-image:repeating-linear-gradient(100deg,transparent 0 3px,rgba(255,220,140,.12) 3px 4px),linear-gradient(var(--N),var(--N))}` }; },
      (r) => { const far = hills(L(), r, 4, 70, 90); houses(far, null, r, 92, [6, 10], { steeple: 0.5 }); const mid = hills(L(), r, 4, 80, 95); for (let i = 0; i < 9; i++) { const x = between(r, 0, W), y = between(r, 88, 96); mid.path(`M${x - 9} ${y}a9 8 0 0 1 18 0Z`); } return { far, mid, near: hills(L(), r, 3, 78, 95), vars: "--hf:28%;--hm:30%;--hn:18%;" }; },
      (r) => { const mid = hills(L(), r, 3, 84, 96); for (let i = 0; i < 7; i++) { const x = 300 + i * 26 + between(r, -5, 5), h = between(r, 12, 24); mid.rect(x, 90 - h, 9, h + 6); } mid.rect(318, 64, 70, 8); return { far: (() => { const l = L(); ridge(l, r, 40, 80, 0.5); return l; })(), mid, near: hills(L(), r, 3, 80, 96), vars: "--hf:44%;--hm:30%;--hn:18%;" }; },
    ],
  },
  {
    id: "mountain", vars: "",
    variants: [
      (r) => { const far = L(); ridge(far, r, 4, 60, 0.58); const mid = L(); ridge(mid, r, 30, 75, 0.55); return { far, mid, near: forest(L(), r, "pine", 26, 100, [24, 50], 6), vars: "--hf:76%;--hm:54%;--hn:36%;", css: SNOWCAP }; },
      (r) => { const far = L(); ridge(far, r, 20, 70, 0.4); return { far, mid: hills(L(), r, 4, 40, 80), near: (() => { const l = hills(L(), r, 3, 70, 92); for (let i = 0; i < 6; i++) { const x = between(r, 0, W); l.path(`M${x - 14} 100Q${x - 10} ${80 - i} ${x} ${78}Q${x + 12} 82 ${x + 16} 100Z`); } return l; })(), vars: "--hf:64%;--hm:40%;--hn:26%;" }; },
      (r) => { const far = L(); ridge(far, r, 0, 70, 0.72); const near = L(); near.path(`M0 100V20Q40 24 70 40L120 46Q160 70 190 100Z`); pine(near, 60, 22, 24, 12, r); pine(near, 92, 40, 18, 9, r); return { far, mid: (() => { const l = L(); ridge(l, r, 26, 80, 0.62); return l; })(), near, vars: "--hf:82%;--hm:58%;--hn:70%;--an:0;--kn:0;", css: SNOWCAP + MIST("30%", "20%", ".5") }; },
      (r) => { const far = L(); ridge(far, r, 6, 66, 0.55); return { far, mid: forest(L(), r, "pine", 40, 99, [10, 22]), near: forest(L(), r, "pine", 8, 100, [40, 80], 2), vars: water("26%", "--hf:56%;--hm:16%;--hn:46%;--bm:26%;"), css: SNOWCAP }; },
    ],
  },
  {
    id: "tundra", vars: ICE,
    variants: [
      (r) => { const far = L(); ridge(far, r, 30, 80, 0.4); return { far, mid: hills(L(), r, 6, 70, 92), near: forest(L(), r, "pine", 5, 100, [24, 46], 2), vars: "--hf:44%;--hm:26%;--hn:30%;" }; },
      (r) => { const mid = hills(L(), r, 4, 80, 95); tents(mid, r, 94, 3, 0.7); return { far: (() => { const l = L(); ridge(l, r, 20, 70, 0.6); return l; })(), mid, near: hills(L(), r, 3, 82, 96), vars: "--hf:50%;--hm:30%;--hn:16%;", css: `&.p .kx{top:auto;left:46%;width:12%;bottom:6%;height:14%;background:radial-gradient(50% 60% at 50% 100%,rgba(255,170,80,.7),transparent 70%);opacity:var(--lit)}` }; },
      (r) => { const far = L(); for (let i = 0; i < 12; i++) { const x = between(r, 0, W), h = between(r, 20, 60); far.poly([[x - 16, 100], [x - 4, 100 - h], [x + 3, 100 - h * 0.8], [x + 18, 100]]); } return { far, mid: hills(L(), r, 5, 76, 94), near: hills(L(), r, 3, 84, 96), vars: water("18%", "--hf:40%;--hm:22%;--hn:14%;--bm:0px;") }; },
      (r) => ({ far: hills(L(), r, 3, 60, 90), mid: forest(L(), r, "dead", 10, 100, [20, 40], 0), near: hills(L(), r, 4, 80, 96), vars: "--hf:30%;--hm:30%;--hn:18%;" }),
    ],
  },
  {
    id: "desert", vars: WARM,
    variants: [
      (r) => ({ far: hills(L(), r, 3, 50, 85), mid: hills(L(), r, 4, 55, 90), near: hills(L(), r, 3, 60, 92), vars: "--hf:36%;--hm:28%;--hn:20%;", css: `&.p .mid,&.p .near{background-image:repeating-linear-gradient(170deg,transparent 0 5px,rgba(255,230,190,.08) 5px 6px),linear-gradient(var(--M),var(--M))}` }),
      (r) => { const far = L(); mesas(far, r, 5, [30, 60]); const near = hills(L(), r, 3, 86, 96); for (let i = 0; i < 4; i++) cactus(near, between(r, 0, W), 92, between(r, 30, 56)); return { far, mid: hills(L(), r, 4, 70, 92), near, vars: "--hf:46%;--hm:24%;--hn:40%;--kt:#b5562a;--ka:40%;" }; },
      (r) => { const far = hills(L(), r, 3, 80, 95); pyramid(far, 300, 92, 120); pyramid(far, 420, 94, 80); pyramid(far, 505, 95, 46); const mid = hills(L(), r, 3, 82, 96); for (let i = 0; i < 5; i++) camel(mid, 300 + i * 40, 90 + i * 0.4, 1.1); return { far, mid, near: hills(L(), r, 3, 70, 94), vars: "--hf:40%;--hm:30%;--hn:16%;" }; },
      (r) => { const near = L(); for (let i = 0; i < 5; i++) palm(near, between(r, 260, 560), 100, between(r, 50, 80), r); bush(near, 400, 100, 40, r); return { far: hills(L(), r, 3, 50, 85), mid: hills(L(), r, 4, 70, 90), near, vars: water("12%", "--hf:32%;--hm:22%;--hn:46%;") }; },
    ],
  },
  {
    id: "canyon", vars: ROCK,
    variants: [
      (r) => { const far = L(); mesas(far, r, 6, [10, 40]); const mid = L(); mesas(mid, r, 4, [20, 50]); return { far, mid, near: hills(L(), r, 3, 80, 96), vars: "--hf:60%;--hm:46%;--hn:20%;", css: `&.p .far,&.p .mid{background-image:repeating-linear-gradient(180deg,transparent 0 9px,rgba(0,0,0,.12) 9px 11px),linear-gradient(var(--F),var(--M))}` }; },
      (r) => { const near = L(), fg = L(); near.path("M0 100V0H90Q120 30 110 60Q140 80 170 100Z"); fg.path("M800 100V0H690Q660 40 680 64Q640 84 620 100Z"); const far = L(); mesas(far, r, 5, [20, 50]); return { far, mid: hills(L(), r, 3, 60, 90), near, fg, vars: "--hf:56%;--hm:30%;--hn:100%;--hg:100%;--an:0;--kn:0;--ag:1;--kg:0;", css: `&.p .fg{background:var(--N)}` }; },
      (r) => { const mid = L(); mid.hole(`M200 100V30Q400 10 600 30V100H520V80A120 70 0 0 0 280 80V100Z`); return { far: (() => { const l = L(); mesas(l, r, 5, [30, 60]); return l; })(), mid, near: hills(L(), r, 3, 84, 96), vars: "--hf:46%;--hm:60%;--hn:16%;" }; },
      (r) => { const near = L(), fg = L(); near.path("M0 100V10Q60 20 120 50L200 70Q230 90 250 100Z"); fg.path("M800 100V20Q740 30 690 56L600 74Q580 92 560 100Z"); return { far: (() => { const l = L(); mesas(l, r, 6, [20, 45]); return l; })(), mid: hills(L(), r, 4, 50, 85), near, fg, vars: water("10%", "--hf:54%;--hm:40%;--hn:100%;--hg:100%;--an:0;--kn:0;--ag:1;--kg:0;"), css: `&.p .fg{background:var(--N)}` }; },
    ],
  },
  {
    id: "volcano", vars: "--kt:#3a2420;--ka:45%;",
    css: ANCHOR("f") + `&.p .kx:before{content:"";position:absolute;left:calc(50% - 70px);width:140px;top:calc(var(--cy) - 14%);height:44%;background:radial-gradient(40% 34% at 50% 34%,rgba(255,140,50,.9),rgba(255,60,20,.3) 60%,transparent 75%);filter:blur(3px)}&.p .kx:after{content:"";position:absolute;left:calc(50% - 100px);width:200px;bottom:calc(100% - var(--cy));height:150%;background:radial-gradient(26% 30% at 50% 92%,rgba(60,55,60,.9),transparent 70%),radial-gradient(36% 30% at 42% 58%,rgba(80,72,78,.72),transparent 70%),radial-gradient(44% 26% at 60% 24%,rgba(90,84,90,.55),transparent 70%);filter:blur(6px);transform-origin:50% 100%}@media (prefers-reduced-motion:no-preference){&.p .kx:after{animation:plume 18s ease-in-out infinite alternate}&.p .kx:before{animation:flicker 3s ease-in-out infinite}}`,
    variants: [0, 1, 2, 3].map((v) => (r: Rng) => {
      const far = L(); volcano(far, r, 400, 100, [560, 640, 520, 700][v], [62, 70, 56, 66][v]);
      const near = v === 2 ? forest(L(), r, "dead", 10, 100, [30, 60], 2) : hills(L(), r, 4, 70, 94);
      const lava = L(); for (let i = 0; i < 4; i++) { const x = between(r, 300, 500); lava.line(1.4, `M${x} ${between(r, 40, 50)}Q${x + between(r, -30, 30)} 70 ${x + between(r, -60, 60)} 100`); }
      return { far, mid: hills(L(), r, 5, 60, 90), near, win: lava, winOn: "far", vars: `--hf:${[64, 70, 58, 66][v]}%;--hm:24%;--hn:${v === 2 ? 40 : 18}%;--cy:${100 - [62, 70, 56, 66][v]}%;--kf:0;`, css: `&.p .lit{background:linear-gradient(180deg,#ffd27a,#ff5a1a);opacity:.9}` };
    }),
  },
  // ── Water ─────────────────────────────────────────────────────────────────
  {
    id: "sea", vars: water("62%", "--hn:18%;"),
    css: `&.p .near{background:linear-gradient(180deg,color-mix(in oklab,var(--N),#fff 18%),var(--N))}&.p .near{-webkit-mask-size:800px 100%;mask-size:800px 100%}@media (prefers-reduced-motion:no-preference){&.p .near{animation:pan 26s linear infinite}}`,
    variants: [
      (r) => { const mid = L(); ship(mid, r, 420, 96, 0.95); return { mid, near: waves(r, 6), vars: "--hm:66%;--bm:30%;" }; },
      (r) => { const far = L(); for (let i = 0; i < 4; i++) { const x = between(r, 0, W), w = between(r, 60, 160); far.path(`M${x - w / 2} 100Q${x - w * 0.2} ${between(r, 60, 80)} ${x} ${between(r, 62, 80)}Q${x + w * 0.25} ${between(r, 70, 84)} ${x + w / 2} 100Z`); } const mid = L(); sailboat(mid, between(r, 200, 600), 98, 1.3); return { far, mid, near: waves(r, 4), vars: "--hf:30%;--hm:30%;--bm:30%;" }; },
      (r) => { const far = L(); for (let i = 0; i < 4; i++) { const x = between(r, 0, W), w = between(r, 20, 50), h = between(r, 40, 80); far.poly([[x - w, 100], [x - w * 0.5, 100 - h], [x + w * 0.1, 100 - h - 5], [x + w * 0.6, 100 - h * 0.6], [x + w, 100]]); } lighthouse(far, 560, 70, 0.8); return { far, near: waves(r, 7), vars: "--hf:42%;", css: BEAM("f", 560, 70 - 53.5 * 0.8) }; },
      (r) => { const far = L(); ship(far, r, between(r, 200, 600), 98, 0.35); const win = L(); win.rect(380, 90, 4, 3); return { far, near: waves(r, 5), vars: "--hf:30%;" }; },
    ],
  },
  {
    id: "deck", vars: water("62%"),
    css: `&.p .fg{background:color-mix(in oklab,var(--N),#000 25%)}@media (prefers-reduced-motion:no-preference){&.p .scene{animation:sway 9s ease-in-out infinite alternate}}`,
    variants: [0, 1, 2, 3].map((v) => (r: Rng) => {
      const fg = L();
      fg.rect(0, 86, W, 14);
      let d = "M0 76H800";
      for (let x = 6; x < W; x += 28) d += `M${x} 86V76`;
      fg.line(2.2, d);
      const mx = [450, 330, 480, 360][v];
      fg.rect(mx - 4, 0, 8, 86);
      fg.line(1, `M${mx} 6L${mx - 260} 86M${mx} 6L${mx + 200} 86M${mx} 30L${mx - 180} 86M${mx} 30L${mx + 140} 86`);
      fg.path(`M${mx - 90} 18H${mx + 90}Q${mx + 96} 36 ${mx + 90} 52H${mx - 90}Q${mx - 84} 36 ${mx - 90} 18Z`);
      const far = L(); if (v % 2) { for (let i = 0; i < 3; i++) { const x = between(r, 0, W); far.path(`M${x - 70} 100Q${x} ${between(r, 66, 80)} ${x + 70} 100Z`); } } else sailboat(far, between(r, 100, 700), 98, 0.7);
      return { far, near: waves(r, 6), fg, vars: `--hf:20%;--hn:18%;--hg:100%;` };
    }),
  },
  {
    id: "coast", vars: water("34%", "--hn:20%;"),
    variants: [
      (r) => { const mid = L(); mid.path("M0 100V50Q60 46 110 54Q150 62 170 76L200 88Q215 96 230 100Z"); lighthouse(mid, 70, 50, 0.6); return { far: (() => { const l = L(); for (let i = 0; i < 2; i++) l.path(`M${between(r, 300, 700)} 100q60 -26 120 0Z`); return l; })(), mid, near: waves(r, 6), vars: "--hf:20%;--hm:56%;--bm:0px;--am:0;--km:0;", css: BEAM("m", 70, 50 - 53.5 * 0.6) }; },
      (r) => { const mid = hills(L(), r, 3, 72, 90); reeds(mid, r, 82, 80, [6, 16]); return { far: (() => { const l = L(); ridge(l, r, 50, 90, 0.5); return l; })(), mid, near: waves(r, 5), vars: "--hf:28%;--hm:22%;--bm:0px;" }; },
      (r) => { const far = L(); for (let i = 0; i < 5; i++) { const x = between(r, 0, W), w = between(r, 14, 40), h = between(r, 30, 90); far.poly([[x - w, 100], [x - w * 0.4, 100 - h], [x + w * 0.3, 100 - h - 6], [x + w, 100]]); } const mid = L(); mid.path("M800 100V30Q740 30 700 50Q660 64 640 100Z"); return { far, mid, near: waves(r, 7), vars: "--hf:46%;--hm:70%;--bm:0px;--am:1;--km:0;" }; },
      (r) => { const mid = L(), win = L(); mid.path("M0 100V62H330Q360 80 380 100Z"); for (let x = 6; x < 300; x += between(r, 30, 40)) { const w = 26, y = 62; mid.rect(x, y - 16, w, 18); mid.poly([[x - 2, y - 15], [x + w / 2, y - 28], [x + w + 2, y - 15]]); win.rect(x + 9, y - 10, 4, 5); } const boats = L(); sailboat(boats, 520, 98, 0.9); sailboat(boats, 660, 99, 0.7); return { far: boats, mid, win, winOn: "mid", near: waves(r, 5), vars: "--hf:16%;--hm:46%;--bm:0px;--am:0;--km:0;" }; },
    ],
  },
  {
    id: "harbour", vars: water("24%", "--hn:14%;"),
    variants: [0, 1, 2, 3].map((v) => (r: Rng) => {
      const far = L(), mid = L(), win = L();
      houses(far, win, r, 100, [14, 26], { steeple: v % 2 ? 0.7 : undefined });
      for (let i = 0; i < 1 + v; i++) ship(mid, r, 120 + i * 190 + between(r, -30, 30), 98, 0.8 + (i % 2) * 0.2, 2 + (i % 2));
      let d = ""; for (let x = 0; x < W; x += 16) d += `M${x} 100V92`;
      mid.line(1.6, d + "M0 92H800");
      return { far, mid, win, winOn: "far", near: waves(r, 4), vars: "--hf:40%;--hm:56%;--bm:6%;" };
    }),
  },
  {
    id: "lake", vars: water("30%", "--hn:22%;"),
    variants: [
      (r) => { const far = L(); ridge(far, r, 10, 70, 0.55); return { far, mid: forest(L(), r, "pine", 50, 99, [8, 18]), near: (() => { const l = L(); reeds(l, r, 100, 70, [14, 40]); return l; })(), vars: "--hf:52%;--hm:14%;--bm:30%;", css: SNOWCAP }; },
      (r) => ({ far: hills(forest(L(), r, "round", 40, 96, [8, 16]), r, 4, 60, 88), mid: L(), near: (() => { const l = L(); l.rect(300, 76, 300, 4); for (let x = 310; x < 600; x += 40) l.line(2, `M${x} 80V100`); willow(l, 330, 100, 70, 60, r); return l; })(), vars: "--hf:34%;--hn:40%;" }),
      (r) => { const far = forest(L(), r, "mixed", 60, 99, [10, 24]); const mid = L(); sailboat(mid, between(r, 200, 600), 98, 0.6); return { far, mid, near: (() => { const l = L(); reeds(l, r, 100, 120, [10, 34]); return l; })(), vars: "--hf:26%;--hm:12%;--bm:24%;" }; },
      (r) => { const far = hills(L(), r, 5, 40, 80); houses(far, far, r, 96, [5, 9], { steeple: 0.4 }); return { far, near: forest(L(), r, "birch", 6, 100, [50, 90], 0), vars: "--hf:30%;--hn:52%;" }; },
    ],
  },
  {
    id: "river", vars: water("20%", "--hn:42%;") + VEG,
    variants: [
      (r) => ({ far: forest(L(), r, "round", 40, 99, [10, 22]), near: banks(r, "round"), vars: "--hf:30%;" }),
      (r) => ({ far: hills(forest(L(), r, "pine", 50, 96, [8, 18]), r, 4, 60, 85), near: banks(r, "willow"), vars: "--hf:36%;" }),
      (r) => { const far = L(); houses(far, far, r, 100, [12, 22], { steeple: 0.3 }); return { far, near: banks(r, "cypress"), vars: "--hf:34%;" }; },
      (r) => { const mid = L(); windmill(mid, 470, 100, 1.4); return { far: hills(L(), r, 4, 60, 90), mid, near: banks(r, "round"), vars: "--hf:28%;--hm:44%;--bm:20%;" }; },
    ],
  },
  {
    id: "bridge", vars: water("22%", "--hn:30%;"),
    variants: [1, 3, 2, 4].map((arches, v) => (r: Rng) => {
      const mid = L();
      if (v === 3) suspension(mid, 100, 64); else archBridge(mid, r, 100, 56 + v * 4, arches);
      const far = v % 2 ? forest(L(), r, "round", 40, 99, [10, 22]) : (() => { const l = L(); houses(l, l, r, 100, [12, 24], { steeple: 0.6 }); return l; })();
      return { far, mid, near: banks(r, v === 0 ? "willow" : "round"), vars: `--hf:30%;--hm:${v === 3 ? 70 : 46}%;--bm:12%;` };
    }),
  },
  {
    id: "tropic", vars: water("30%", "--hn:58%;"),
    css: `&.p .water{background:linear-gradient(180deg,color-mix(in oklab,var(--s3),#3fd0c9 30%),color-mix(in oklab,var(--s2),#1aa1a8 40%) 60%,color-mix(in oklab,var(--near),#0b6a78 30%))}`,
    variants: [0, 1, 2, 3].map((v) => (r: Rng) => {
      const near = L();
      const side = v % 2 ? 620 : 120;
      near.path(`M${side - 200} 100Q${side - 60} ${78} ${side + 160} 100Z`);
      for (let i = 0; i < 2 + v; i++) palm(near, side + between(r, -90, 90), 96, between(r, 50, 84), r, (v % 2 ? -1 : 1) * between(r, 0.1, 0.35));
      const far = L();
      for (let i = 0; i < 2; i++) { const x = between(r, 200, 700); far.path(`M${x - 70} 100Q${x} ${between(r, 50, 70)} ${x + 70} 100Z`); palm(far, x, 92, 14, r); }
      if (v === 2) sailboat(far, between(r, 100, 500), 99, 0.6);
      return { far, near, vars: `--hf:24%;--an:${v % 2};--kn:0;` };
    }),
  },
  // ── Built places ──────────────────────────────────────────────────────────
  { id: "city_modern", variants: cityVariants(["modern", "modern", "modern"], (r, far, mid, near, v) => { if (v === 1) { suspension(near, 100, 76); } if (v === 3) waterTower(near, 400, 76, 1.4); }) },
  { id: "city_deco", variants: cityVariants(["deco", "deco", "old"]) },
  {
    id: "city_old",
    variants: [
      cityVariants(["old", "old", "old"])[0],
      cityVariants(["gothic", "gothic", "old"])[1],
      cityVariants(["eastern", "eastern", "eastern"])[2],
      cityVariants(["old", "old", "old"], (r, far) => { castle(far, null, r, 400, 80, 1.1); })[3],
    ],
  },
  { id: "city_future", css: `&.p .lit{background:linear-gradient(90deg,#4ff0ff,#ff4fd8 50%,#ffd27a);opacity:calc(.35 + var(--lit) * .65)}`, variants: cityVariants(["future", "future", "modern"], (r, far, mid, near, v) => { if (v % 2) for (let i = 0; i < 3; i++) far.rect(between(r, 0, W), between(r, 10, 40), between(r, 60, 140), 2); }) },
  {
    id: "town",
    variants: [
      (r) => { const mid = L(), win = L(); houses(mid, win, r, 100, [18, 30], { steeple: 0.55 }); return { far: hills(L(), r, 4, 50, 85), mid, win, winOn: "mid", near: (() => { const l = L(); houses(l, null, r, 100, [10, 18]); return l; })(), vars: "--hf:30%;--hm:46%;--hn:20%;" }; },
      (r) => { const mid = L(), win = L(); houses(mid, win, r, 100, [18, 28], {}); const cx = between(r, 300, 500); mid.rect(cx - 10, 30, 20, 70); mid.poly([[cx - 13, 30], [cx, 8], [cx + 13, 30]]); win.circle(cx, 40, 5); return { far: forest(L(), r, "round", 30, 98, [10, 20]), mid, win, winOn: "mid", near: (() => { const l = L(); lampPosts(l, 100, 180, 46); l.rect(0, 96, W, 4); return l; })(), vars: "--hf:30%;--hm:50%;--hn:30%;" }; },
      (r) => { const mid = L(), win = L(); const prof = profile(r, 3, 40, 70); mid.path(smoothPath(prof)); for (let x = 10; x < W; x += between(r, 26, 40)) { const y = 60 + Math.sin(x / 120) * 10, w = 24; mid.rect(x, y - 14, w, 40); mid.poly([[x - 2, y - 13], [x + w / 2, y - 26], [x + w + 2, y - 13]]); if (r() < 0.6) win.rect(x + 8, y - 6, 4, 5); } return { far: (() => { const l = L(); ridge(l, r, 10, 60, 0.5); return l; })(), mid, win, winOn: "mid", near: forest(L(), r, "cypress", 10, 100, [30, 60], 2), vars: "--hf:56%;--hm:56%;--hn:34%;" }; },
      (r) => { const mid = L(), win = L(); houses(mid, win, r, 100, [24, 40], { gap: [-2, 2] }); return { mid, win, winOn: "mid", vars: water("16%", "--hm:58%;--bm:16%;") }; },
    ],
  },
  {
    id: "village", vars: VEG,
    variants: [
      (r) => { const mid = L(), win = L(); houses(mid, win, r, 100, [10, 16], { thatch: true, steeple: 0.4, gap: [6, 40] }); for (let i = 0; i < 6; i++) roundTree(mid, between(r, 0, W), 100, between(r, 26, 40), 26, r); return { far: hills(L(), r, 4, 50, 85), mid, win, winOn: "mid", near: (() => { const l = hills(L(), r, 3, 86, 96); fence(l, 96, 22, 10, false); return l; })(), vars: "--hf:34%;--hm:40%;--hn:22%;" }; },
      (r) => { const mid = L(), win = L(); houses(mid, win, r, 100, [10, 14], { thatch: true, gap: [20, 60] }); windmill(mid, between(r, 430, 500), 100, 1.3); return { far: forest(L(), r, "round", 40, 98, [10, 20]), mid, win, winOn: "mid", near: hills(L(), r, 3, 84, 96), vars: "--hf:34%;--hm:46%;--hn:16%;" }; },
      (r) => { const mid = L(), win = L(); houses(mid, win, r, 100, [12, 18], { gap: [10, 50] }); return { far: (() => { const l = L(); ridge(l, r, 10, 60, 0.55); return l; })(), mid, win, winOn: "mid", near: forest(L(), r, "pine", 6, 100, [36, 70], 2), vars: "--hf:66%;--hm:36%;--hn:40%;", css: SNOWCAP }; },
      (r) => { const mid = L(), win = L(); houses(mid, win, r, 100, [10, 16], { thatch: true, steeple: 0.7, gap: [4, 30] }); return { far: hills(L(), r, 3, 60, 88), mid, win, winOn: "mid", vars: water("12%", "--hf:24%;--hm:40%;--bm:12%;") }; },
    ],
  },
  {
    id: "castle",
    variants: [
      (r) => { const far = hills(L(), r, 3, 70, 90), win = L(); castle(far, win, r, 420, 74, 1); return { far, mid: forest(L(), r, "round", 30, 99, [14, 26]), near: hills(L(), r, 3, 84, 96), win, winOn: "far", vars: "--hf:58%;--hm:30%;--hn:16%;" }; },
      (r) => { const mid = L(); castle(mid, null, r, 400, 100, 1.6); return { far: hills(L(), r, 4, 50, 85), mid, near: forest(L(), r, "pine", 6, 100, [30, 60], 2), vars: "--hf:30%;--hm:70%;--hn:30%;" }; },
      (r) => { const far = L(); far.path("M800 100V36Q700 30 640 40Q580 60 560 100Z"); castle(far, null, r, 690, 38, 0.8); return { far, near: waves(r, 6), vars: water("40%", "--hf:90%;--bf:0px;--hn:18%;--af:1;--kf:0;") }; },
      (r) => { const near = L(); near.rect(0, 40, W, 60); for (let x = 0; x < W; x += 22) near.rect(x, 30, 12, 11); near.rect(80, 0, 60, 100); near.rect(640, 0, 60, 100); const far = L(); castle(far, null, r, 400, 100, 1.2); return { far, near, vars: "--hf:56%;--hn:30%;", css: `&.p .far{background:linear-gradient(180deg,color-mix(in oklab,var(--F),var(--s3) 45%),var(--F))}` }; },
    ],
  },
  {
    id: "ruins", vars: VEG,
    variants: [
      (r) => { const mid = L(); ruins(mid, r, 100, 0.9); return { far: hills(L(), r, 4, 50, 85), mid, near: hills(L(), r, 3, 86, 96), vars: "--hf:30%;--hm:52%;--hn:14%;" }; },
      (r) => { const mid = L(); ruins(mid, r, 100, 1.3); return { far: forest(L(), r, "cypress", 24, 99, [16, 34]), mid, near: (() => { const l = L(); ferns(l, r, 100, 10); return l; })(), vars: "--hf:40%;--hm:62%;--hn:22%;", css: MIST("12%") }; },
      (r) => { const mid = L(); ruins(mid, r, 100, 1); return { far: forest(L(), r, "round", 26, 99, [16, 30]), mid, near: forest(L(), r, "dead", 2, 100, [60, 90], 0), fg: (() => { const l = L(); vines(l, r, 10, [10, 40]); return l; })(), vars: "--hf:46%;--hm:54%;--hn:60%;--hg:100%;" }; },
      (r) => { const mid = L(); ruins(mid, r, 100, 1.1); return { far: hills(L(), r, 3, 60, 90), mid, near: hills(L(), r, 3, 80, 96), vars: "--hf:30%;--hm:56%;--hn:16%;" + WARM }; },
    ],
  },
  {
    id: "graveyard",
    css: MIST("8%", "22%", ".55"),
    variants: [
      (r) => { const mid = L(); graves(mid, r, 100, 18); return { far: (() => { const l = L(); houses(l, null, r, 100, [10, 16], { steeple: 0.62, gap: [100, 200] }); return l; })(), mid, near: (() => { const l = L(); fence(l, 100, 12, 26); return l; })(), vars: "--hf:40%;--hm:26%;--hn:24%;" }; },
      (r) => { const mid = L(); graves(mid, r, 100, 14); deadTree(mid, between(r, 400, 470), 100, 90, r, 3.5); return { far: forest(L(), r, "cypress", 20, 99, [16, 34]), mid, vars: "--hf:36%;--hm:54%;" }; },
      (r) => { const mid = L(); mid.hole("M330 100V50L400 20L470 50V100ZM386 100V70a14 14 0 0 1 28 0V100Z"); mid.rect(392, 4, 16, 18); graves(mid, r, 100, 10); return { far: forest(L(), r, "dead", 10, 99, [16, 30]), mid, near: (() => { const l = L(); fence(l, 100, 10, 20); return l; })(), vars: "--hf:32%;--hm:48%;--hn:20%;" }; },
      (r) => { const mid = L(); graves(mid, r, 100, 22); return { far: hills(L(), r, 3, 60, 90), mid, near: forest(L(), r, "dead", 2, 100, [70, 95], 0), vars: "--hf:26%;--hm:28%;--hn:80%;" }; },
    ],
  },
  {
    id: "camp",
    css: `&.p .kx{top:auto;left:calc(50% - 50px);width:100px;bottom:0;height:34%;background:radial-gradient(40% 50% at 50% 100%,rgba(255,170,70,.75),rgba(255,110,40,.2) 60%,transparent 75%);opacity:calc(.3 + var(--lit) * .7)}@media (prefers-reduced-motion:no-preference){&.p .kx{animation:flicker 2.2s ease-in-out infinite}}`,
    variants: [
      (r) => ({ far: hills(L(), r, 4, 50, 85), mid: (() => { const l = L(); tents(l, r, 100, 8); return l; })(), vars: "--hf:30%;--hm:40%;" }),
      (r) => ({ far: forest(L(), r, "pine", 50, 98, [14, 30]), mid: (() => { const l = L(); tents(l, r, 100, 4, 1.2); return l; })(), near: forest(L(), r, "pine", 4, 100, [60, 90], 0), vars: "--hf:44%;--hm:40%;--hn:46%;" }),
      (r) => ({ far: hills(L(), r, 3, 60, 90), mid: (() => { const l = L(); tents(l, r, 100, 5, 1); return l; })(), near: hills(L(), r, 3, 84, 96), vars: "--hf:26%;--hm:36%;--hn:12%;" + WARM }),
      (r) => { const far = L(); ridge(far, r, 10, 60, 0.6); return { far, mid: (() => { const l = L(); tents(l, r, 100, 6, 0.9); return l; })(), vars: "--hf:58%;--hm:36%;", css: SNOWCAP }; },
    ],
  },
  {
    id: "rooftop",
    variants: [0, 1, 2, 3].map((v) => (r: Rng) => {
      const far = L(), mid = L(), win = L(), near = L();
      skyline(far, null, r, v === 3 ? "deco" : "modern", 100, [30, 70]);
      skyline(mid, win, r, v === 3 ? "deco" : "modern", 100, [30, 66], 1.2);
      near.rect(0, 80, W, 20);
      near.rect(0, 74, W, 6);
      waterTower(near, [460, 340, 420, 380][v], 74, 1.8);
      let d = ""; for (let i = 0; i < 3; i++) { const x = between(r, 0, W); d += `M${x} 74V${between(r, 30, 50)}`; near.rect(x - 2, 54, 12, 2); } near.line(1, d);
      for (let i = 0; i < 4; i++) near.rect(between(r, 0, W), 64, between(r, 14, 26), 10);
      return { far, mid, win, winOn: "mid", near, vars: "--hf:70%;--hm:58%;--hn:40%;" };
    }),
  },
  {
    id: "rooftop_old",
    variants: [0, 1, 2, 3].map((v) => (r: Rng) => {
      const far = L(), mid = L(), win = L(), near = L();
      skyline(far, null, r, v === 2 ? "gothic" : "old", 100, [26, 60]);
      houses(mid, win, r, 100, [20, 30], { steeple: v === 1 ? 0.5 : undefined });
      near.path(`M0 100V64L${W / 2} 52L${W} 64V100Z`);
      for (let i = 0; i < 4 + v; i++) { const x = between(r, 0, W); near.rect(x, 34, 14, 30); for (let k = 0; k < 3; k++) near.rect(x + 1 + k * 4.5, 28, 3, 7); }
      return { far, mid, win, winOn: "mid", near, vars: "--hf:60%;--hm:46%;--hn:44%;" };
    }),
  },
  // ── Underground, space ────────────────────────────────────────────────────
  {
    id: "underground",
    css: `&.p .scene{background:#0a0808}`,
    variants: [
      (r) => { const fg = L(); fg.hole(`M0 0H800V100H0ZM120 100Q140 20 400 14Q660 20 680 100Z`); stalactites(fg, r, 26); return { far: hills(L(), r, 4, 50, 85), mid: forest(L(), r, "pine", 20, 99, [14, 30]), vars: "--hf:30%;--hm:30%;--hg:100%;", css: `&.p{--mg:${fg.url(W, H, true)}}&.p .fg{background:linear-gradient(180deg,#1a1410,#0c0908);-webkit-mask-size:100% 100%;mask-size:100% 100%}` }; },
      (r) => { const fg = L(); stalactites(fg, r, 40); stalactites(fg, r, 30, true); const mid = L(); crystals(mid, r, 100, 9); return { mid, fg, win: mid, winOn: "mid", vars: "--hm:46%;--hg:100%;", css: `&.p :is(.sky,.stars,.sun,.moon,.clouds,.clouds2,.rays,.fx,.fx2,.glow){display:none}&.p .fg{background:#0b0a12}&.p .lit{background:linear-gradient(180deg,#b7f3ff,#5ad1ff 50%,#9a6bff);opacity:.9}&.p .kx{background:radial-gradient(60% 50% at 50% 90%,rgba(90,200,255,.35),transparent 70%)}&.p .scene{background:radial-gradient(80% 70% at 50% 80%,#1d2a44,#07070d)}@media (prefers-reduced-motion:no-preference){&.p .lit{animation:breathe 5s ease-in-out infinite alternate}}` }; },
      (r) => { const fg = L(); fg.rect(0, 0, W, 12); for (let x = 60; x < W; x += 260) { fg.rect(x, 0, 14, 100); fg.rect(x + 180, 0, 14, 100); fg.rect(x - 6, 10, 206, 12); } fg.line(2, "M0 96H800M0 90H800"); let d = ""; for (let x = 0; x < W; x += 16) d += `M${x} 100V90`; fg.line(3, d); return { fg, vars: "--hg:100%;", css: `&.p :is(.sky,.stars,.sun,.moon,.clouds,.clouds2,.rays,.fx,.fx2,.glow){display:none}&.p .scene{background:radial-gradient(40% 45% at 50% 52%,#3a2a1c,#120c08 60%,#050403)}&.p .fg{background:#1b130c}&.p .kx{background:radial-gradient(10% 18% at 33% 40%,rgba(255,180,90,.55),transparent 70%),radial-gradient(10% 18% at 66% 40%,rgba(255,180,90,.55),transparent 70%)}@media (prefers-reduced-motion:no-preference){&.p .kx{animation:flicker 3s ease-in-out infinite}}` }; },
      (r) => { const fg = L(); stalactites(fg, r, 36); const mid = L(); stalactites(mid, r, 50, true); return { mid, fg, vars: water("26%", "--hm:60%;--bm:20%;--hg:100%;"), css: `&.p :is(.sky,.stars,.sun,.moon,.clouds,.clouds2,.rays,.fx,.fx2,.glow){display:none}&.p .scene{background:radial-gradient(70% 60% at 50% 70%,#123040,#04080c)}&.p .fg{background:#060a0e}&.p .mid{background:#0b1820}&.p .water{background:linear-gradient(180deg,#1a5a6a,#06141a)}&.p .kx{background:radial-gradient(40% 30% at 50% 74%,rgba(90,230,220,.35),transparent 70%)}` }; },
    ],
  },
  {
    id: "space",
    vars: "--g:0px;",
    css: `&.p :is(.clouds,.clouds2,.rays,.sun,.moon,.glow,.ground){display:none}&.p .sky{background:radial-gradient(60% 50% at 70% 30%,rgba(120,60,180,.35),transparent 70%),radial-gradient(50% 40% at 20% 70%,rgba(40,120,200,.3),transparent 70%),#02030a}&.p .stars{opacity:1}`,
    variants: [
      () => ({ css: `&.p .kx{inset:auto;left:-20%;right:-20%;bottom:-160%;height:200%;border-radius:50%;background:radial-gradient(circle at 50% 30%,#3a6fb0,#123060 40%,#071430 60%);box-shadow:0 0 40px 10px rgba(120,190,255,.55),inset 0 12px 30px rgba(190,230,255,.45)}` }),
      () => ({ css: `&.p .kx{inset:auto;left:58%;top:16%;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#f5d6a0,#c08850 50%,#5a3a20 80%);box-shadow:inset -18px -10px 30px rgba(0,0,0,.6)}&.p .kx2{inset:auto;left:calc(58% - 70px);top:calc(16% + 48px);width:260px;height:26px;border-radius:50%;border:3px solid rgba(240,210,160,.6);transform:rotate(-14deg);box-shadow:0 0 0 4px rgba(240,210,160,.15)}` }),
      (r) => { const mid = L(); station(mid, r, 400, 50, 1.6); return { mid, win: (() => { const w = L(); for (let i = 0; i < 9; i++) w.rect(330 + i * 16, 49, 4, 2); return w; })(), winOn: "mid", vars: "--hm:70%;--bm:12%;", css: `&.p .mid{background:linear-gradient(180deg,#2a3346,#0c1018)}&.p .lit{background:#9ff3ff;opacity:1}&.p .kx{inset:0;background:radial-gradient(40% 50% at 30% 40%,rgba(255,80,160,.28),transparent 70%),radial-gradient(40% 40% at 70% 60%,rgba(80,200,255,.25),transparent 70%)}` }; },
      (r) => { const mid = L(); asteroids(mid, r, 30, [20, 95], [3, 12]); const near = L(); asteroids(near, r, 6, [60, 100], [14, 26]); return { mid, near, vars: "--hm:80%;--hn:60%;", css: `&.p .mid{background:#3a3436}&.p .near{background:#1a1718}&.p :is(.mid,.near){-webkit-mask-size:800px 100%;mask-size:800px 100%}@media (prefers-reduced-motion:no-preference){&.p .mid{animation:pan 120s linear infinite}&.p .near{animation:pan 60s linear infinite}}` }; },
    ],
  },
];

function waves(r: Rng, count: number): Layer {
  const l = L();
  let d = "M0 100V70";
  const k = count * 2;
  for (let i = 0; i < k; i++) {
    const x0 = (i * W) / k, x1 = ((i + 1) * W) / k;
    d += `Q${x0 + (x1 - x0) * 0.3} ${between(r, 40, 52)} ${x1} 70`;
  }
  l.path(d + `V100Z`);
  return l;
}
function banks(r: Rng, tree: "round" | "willow" | "cypress"): Layer {
  const l = L();
  l.path(`M0 100V40Q60 46 120 64Q170 80 200 100Z`);
  l.path(`M800 100V44Q740 50 690 66Q640 84 610 100Z`);
  for (const x of [30, 90, 730, 770]) {
    if (tree === "willow") willow(l, x, 50, 60, 70, r);
    else if (tree === "cypress") cypress(l, x, 50, 50, 16);
    else roundTree(l, x, 54, between(r, 40, 56), 36, r);
  }
  return l;
}
/**
 * Make an element (.kx by default) sit exactly over one land layer's tile, so
 * its pseudo-elements can be placed in tile coordinates (x/8 %, y %): it follows
 * the layer's alignment, offset and mirror.
 */
export function ANCHOR(x: "f" | "m" | "n" | "g", el = ".kx") {
  return `&.p ${el}{inset:auto;bottom:calc(var(--b${x},0px) + var(--g));height:var(--h${x});aspect-ratio:8;--A:calc((1 - var(--fl)) / 2 + var(--fl) * var(--a${x}));left:calc(var(--A) * 100% + var(--fl) * var(--ox) * var(--k${x}));translate:calc(var(--A) * -100%) 0;transform:scaleX(var(--fl))}`;
}
/** Rotating lighthouse beam at the lamp, given in tile units of layer x. */
function BEAM(x: "f" | "m", lx: number, ly: number) {
  const at = `left:${(lx / 8).toFixed(2)}%;top:${ly.toFixed(1)}%`;
  return ANCHOR(x) + `&.p .kx{opacity:calc(.25 + var(--lit) * .75)}&.p .kx:before{content:"";position:absolute;${at};margin-top:-14px;width:520px;height:28px;transform-origin:0 50%;background:linear-gradient(90deg,rgba(255,240,190,.75),rgba(255,240,190,0) 80%);clip-path:polygon(0 45%,100% 0,100% 100%,0 55%);filter:blur(2px)}&.p .kx:after{content:"";position:absolute;${at};margin:-6px 0 0 -6px;width:12px;height:12px;border-radius:50%;background:#fff6d0;box-shadow:0 0 18px 8px rgba(255,230,160,.8)}@media (prefers-reduced-motion:no-preference){&.p .kx:before{animation:beam 7s linear infinite}}`;
}

// ── Interiors ───────────────────────────────────────────────────────────────
// A room is a wall, a floor, its lamps and props, and windows: the scene (sky
// and a view) masked to the window shapes, with a frame drawn over it.
interface Room { id: string; css: string; view: (r: Rng) => Variant; windows: (v: number) => { mask: Layer; frame: Layer; box: string; wx?: string; shx?: string } }

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
type Shape = "arch" | "lancet" | "rect" | "round" | "wide" | "tri" | "circle" | "trap";
function windowSet(shape: Shape, count: number, cols: number, rows: number, frame = 7) {
  const mask = new Layer(), fr = new Layer();
  const gap = 40, w = (WB - gap * (count - 1)) / count;
  for (let i = 0; i < count; i++) {
    const x = i * (w + gap), y = 0, h = HB;
    const draw = (l: Layer, inset: number) => {
      const X = x + inset, Y = y + inset, Wd = w - 2 * inset, Hd = h - 2 * inset;
      if (shape === "arch") arch(l, X, Y, Wd, Hd);
      else if (shape === "lancet") lancet(l, X, Y, Wd, Hd);
      else if (shape === "round") rectW(l, X, Y, Wd, Hd, Math.min(Wd, Hd) * 0.18);
      else if (shape === "tri") l.poly([[X + Wd / 2, Y], [X + Wd, Y + Hd], [X, Y + Hd]]);
      else if (shape === "circle") l.ellipse(X + Wd / 2, Y + Hd / 2, Wd / 2, Hd / 2);
      else if (shape === "trap") l.path(`M${X + Wd * 0.08} ${Y + Hd}L${X} ${Y + Hd * 0.12}Q${X + Wd / 2} ${Y - Hd * 0.06} ${X + Wd} ${Y + Hd * 0.12}L${X + Wd * 0.92} ${Y + Hd}Z`);
      else rectW(l, X, Y, Wd, Hd);
    };
    draw(mask, frame);
    // the frame: an outline ring (outer minus inner) plus mullions
    const outer = new Layer(), inner = new Layer();
    draw(outer, 0); draw(inner, frame);
    fr.hole(outer.fill.join("") + inner.fill.join(""));
    if (cols > 1 || rows > 1) mullions(fr, x + frame, y + frame, w - 2 * frame, h - 2 * frame, cols, rows);
    if (shape === "lancet") fr.line(3, `M${x + w / 2} ${y + 10}V${y + h}M${x + frame} ${y + h * 0.42}Q${x + w / 2} ${y + h * 0.3} ${x + w - frame} ${y + h * 0.42}`);
  }
  return { mask, frame: fr };
}
/** Window boxes: placement, the window's centre (for curtains and light), and where the wall props go. */
const BOXES = [
  { box: "right:7%;left:auto;width:clamp(116px,26%,190px)", wx: "80%", shx: "6%" },
  { box: "left:7%;right:auto;width:clamp(116px,26%,190px)", wx: "20%", shx: "64%" },
  { box: "left:auto;right:6%;width:clamp(200px,42%,330px)", wx: "73%", shx: "5%" },
  { box: "left:50%;right:auto;width:clamp(130px,30%,220px);transform:translateX(-50%)", wx: "50%", shx: "-100%" },
];

const ROOMS: Room[] = [
  {
    id: "tavern",
    css: `&.p .wall{background:repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 2px,transparent 2px 64px),linear-gradient(180deg,#4a2e1a,#26170d)}&.p .wain{height:26%;border-top:5px solid #5a3c25;background:repeating-linear-gradient(90deg,#231509 0 3px,transparent 3px 40px),linear-gradient(#2c1b10,#1a100a)}&.p .lamp{background:radial-gradient(34% 70% at 12% 100%,rgba(255,150,60,.65),transparent 70%),radial-gradient(10% 22% at 40% 18%,rgba(255,200,120,.55),transparent 70%)}&.p .ra{top:30%;bottom:auto;left:var(--shx);width:30%;height:20%;-webkit-mask:var(--sh) 0 100%/auto 100% repeat-x;mask:var(--sh) 0 100%/auto 100% repeat-x;background:linear-gradient(180deg,#3a5a3a,#5a2a1a 50%,#1a0f08)}`,
    view: (r) => ({ far: (() => { const l = L(); houses(l, l, r, 100, [24, 40], { steeple: 0.4 }); return l; })(), vars: "--hf:46%;" }),
    windows: (v) => ({ ...windowSet(v === 2 ? "rect" : "arch", v === 2 ? 2 : 1, 2, 3, 9), box: BOXES[v].box + (v === 2 ? ";top:13%;aspect-ratio:2/1.15" : ";top:13%;aspect-ratio:1/1.1"), wx: BOXES[v].wx, shx: BOXES[v].shx }),
  },
  {
    id: "library",
    css: `&.p .wall{background:linear-gradient(180deg,#2c2218,#17110b)}&.p .ra,&.p .rb{top:0;bottom:0;width:30%;background:repeating-linear-gradient(180deg,transparent 0 calc(25% - 6px),#1a120a calc(25% - 6px) 25%),repeating-linear-gradient(90deg,#6b2d22 0 7px,#2c3e2a 7px 12px,#8a6a2a 12px 16px,#3a2a4a 16px 22px,#7a4a1c 22px 26px,#1e2e40 26px 33px,#5a1e1e 33px 37px);box-shadow:inset 0 0 40px rgba(0,0,0,.7);filter:brightness(calc(.55 + (1 - var(--lit)) * .3))}&.p .ra{left:0}&.p .rb{right:0;left:auto}&.p .lamp{background:radial-gradient(20% 40% at 50% 92%,rgba(140,230,150,.35),transparent 70%),radial-gradient(30% 50% at 50% 100%,rgba(255,200,120,.4),transparent 70%)}&.p .wain{height:14%;background:linear-gradient(#3a2416,#1c110a)}`,
    view: (r) => ({ far: (() => { const l = L(); skyline(l, l, r, "old", 100, [30, 60]); return l; })(), vars: "--hf:46%;" }),
    windows: (v) => ({ ...windowSet(v === 1 ? "lancet" : "arch", v === 2 ? 2 : 1, 2, 4, 8), box: (v === 2 ? "left:50%;right:auto;width:clamp(160px,34%,260px);transform:translateX(-50%)" : "left:50%;right:auto;width:clamp(110px,22%,160px);transform:translateX(-50%)") + ";top:8%;bottom:16%" }),
  },
  {
    id: "bedroom",
    css: `&.p .wall{background:radial-gradient(circle at 50% 50%,rgba(255,230,210,.07) 0 3px,transparent 4px) 0 0/34px 34px,linear-gradient(180deg,#3a2c38,#1e1620)}&.p .wain{height:18%;background:linear-gradient(#2a1d22,#140d10)}&.p .ra{left:var(--shx);width:44%;top:auto;bottom:10%;height:30%;-webkit-mask:var(--sh) 0 100%/100% 100%;mask:var(--sh) 0 100%/100% 100%;background:linear-gradient(180deg,#4a2c3a,#160c12 70%)}&.p .rb{inset:0;background:linear-gradient(90deg,transparent calc(var(--wx) - 12%),rgba(120,40,60,.85) calc(var(--wx) - 12%),rgba(70,20,35,.9) calc(var(--wx) - 6%),transparent calc(var(--wx) - 5.5%),transparent calc(var(--wx) + 5.5%),rgba(70,20,35,.9) calc(var(--wx) + 6%),rgba(120,40,60,.85) calc(var(--wx) + 12%),transparent calc(var(--wx) + 12%))}&.p .lamp{background:radial-gradient(18% 40% at 62% 72%,rgba(255,180,110,.6),transparent 70%)}`,
    view: (r) => ({ far: (() => { const l = L(); houses(l, l, r, 100, [26, 40]); return l; })(), vars: "--hf:40%;" }),
    windows: (v) => ({ ...windowSet("rect", 1, 2, 2, 8), box: BOXES[v === 2 ? 0 : v].box + ";top:10%;aspect-ratio:1/1.2", wx: BOXES[v === 2 ? 0 : v].wx, shx: BOXES[v === 2 ? 0 : v].shx }),
  },
  {
    id: "chapel",
    css: `&.p .wall{background:repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 2px,transparent 2px 22px),repeating-linear-gradient(90deg,rgba(0,0,0,.2) 0 2px,transparent 2px 44px),linear-gradient(180deg,#3a3640,#18161c)}&.p .wain{height:12%;background:linear-gradient(#26222a,#100e12)}&.p .scene:after{content:"";position:absolute;inset:0;background:conic-gradient(from 30deg at 50% 60%,rgba(200,40,60,.5),rgba(40,90,200,.5),rgba(230,180,40,.5),rgba(40,150,90,.5),rgba(140,50,170,.5),rgba(200,40,60,.5));mix-blend-mode:color;opacity:.8}&.p .lamp{background:radial-gradient(4% 10% at 20% 84%,rgba(255,200,110,.9),transparent 70%),radial-gradient(4% 10% at 28% 86%,rgba(255,200,110,.8),transparent 70%),radial-gradient(4% 10% at 72% 86%,rgba(255,200,110,.8),transparent 70%),radial-gradient(4% 10% at 80% 84%,rgba(255,200,110,.9),transparent 70%),radial-gradient(40% 40% at 50% 100%,rgba(255,180,90,.3),transparent 70%)}&.p .ra,&.p .rb{top:0;bottom:0;width:7%;background:linear-gradient(90deg,#141217,#3a3640 40%,#1a181e)}&.p .ra{left:12%}&.p .rb{right:12%;left:auto}&.p .spill{background:linear-gradient(170deg,transparent 30%,rgba(255,220,180,.12) 50%,transparent 70%)}`,
    view: () => ({}),
    windows: (v) => ({ ...windowSet("lancet", v === 2 ? 3 : 1, 2, 3, 8), box: `left:50%;right:auto;width:${v === 2 ? "clamp(180px,40%,300px)" : "clamp(90px,18%,130px)"};transform:translateX(-50%);top:6%;bottom:18%` }),
  },
  {
    id: "hall",
    css: `&.p .wall{background:repeating-linear-gradient(90deg,rgba(255,215,140,.1) 0 2px,transparent 2px 90px),linear-gradient(180deg,#4a1820,#22080e)}&.p .wain{height:22%;border-top:3px solid #c9a45c;background:repeating-conic-gradient(#e8dcc6 0 25%,#1c1418 0 50%) 0 0/40px 40px;transform:perspective(200px) rotateX(38deg);transform-origin:50% 100%;filter:brightness(.7)}&.p .ra{left:calc(50% - 60px);width:120px;top:0;height:30%;-webkit-mask:var(--sh) 50% 0/100% 100%;mask:var(--sh) 50% 0/100% 100%;background:#c9a45c;filter:drop-shadow(0 0 6px #ffd27a)}&.p .lamp{background:radial-gradient(30% 34% at 50% 20%,rgba(255,220,150,.55),transparent 70%)}`,
    view: (r) => ({ far: forest(L(), r, "cypress", 24, 99, [20, 40]), vars: "--hf:36%;" }),
    windows: (v) => ({ ...windowSet("arch", v === 1 ? 2 : 3, 2, 4, 7), box: "left:8%;right:8%;top:8%;bottom:26%" }),
  },
  {
    id: "lab",
    css: `&.p .wall{background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 30px),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 30px),linear-gradient(180deg,#1c2a32,#0c1418)}&.p .wain{height:16%;background:linear-gradient(#1a2328,#0a0f12);border-top:2px solid rgba(120,240,255,.4)}&.p .lamp{background:linear-gradient(180deg,rgba(200,250,255,.25),transparent 30%),radial-gradient(6% 8% at 14% 70%,rgba(80,240,255,.7),transparent 70%),radial-gradient(6% 8% at 24% 72%,rgba(120,255,170,.6),transparent 70%)}&.p .ra{left:6%;width:26%;top:auto;bottom:16%;height:22%;background:repeating-linear-gradient(90deg,#0b1216 0 30%,rgba(80,240,255,.35) 30% 32%,#0b1216 32% 34%);border-radius:4px;box-shadow:0 0 20px rgba(80,240,255,.25)}`,
    view: (r) => { const l = L(); skyline(l, l, r, "future", 100, [30, 70]); return { far: l, vars: "--hf:56%;" }; },
    windows: (v) => ({ ...windowSet("round", 1, v + 2, 1, 6), box: "left:auto;right:5%;width:clamp(220px,52%,420px);top:10%;bottom:30%" }),
  },
  {
    id: "train",
    css: `&.p .wall{background:linear-gradient(180deg,#3a2a24,#1c1210)}&.p .wain{height:22%;background:linear-gradient(#5a1e22,#2a0c10)}&.p .scene .land{-webkit-mask-size:800px 100%;mask-size:800px 100%}@media (prefers-reduced-motion:no-preference){&.p .scene .far{animation:pan 30s linear infinite}&.p .scene .mid{animation:pan 9s linear infinite}&.p .scene .near{animation:pan 2.6s linear infinite}&.p .scene{animation:rattle .5s steps(2) infinite}}&.p .lamp{background:radial-gradient(14% 30% at 12% 20%,rgba(255,200,120,.6),transparent 70%),radial-gradient(14% 30% at 88% 20%,rgba(255,200,120,.6),transparent 70%)}`,
    view: (r) => { const near = L(); let d = ""; for (let x = 20; x < W; x += 200) { d += `M${x} 100V20M${x - 8} 26H${x + 8}`; } near.line(2.2, d); near.line(0.8, "M0 30Q100 40 200 30Q300 40 400 30Q500 40 600 30Q700 40 800 30"); return { far: hills(L(), r, 4, 40, 80), mid: forest(L(), r, "mixed", 24, 99, [20, 40]), near, vars: "--hf:46%;--hm:40%;--hn:70%;" }; },
    windows: (v) => ({ ...windowSet("round", v === 3 ? 1 : 2, 1, 1, 8), box: "left:6%;right:6%;top:14%;bottom:30%" }),
  },
  {
    id: "home",
    css: `&.p .wall{background:linear-gradient(180deg,#3a3430,#1c1916)}&.p .wain{height:16%;background:linear-gradient(#2e2420,#16110e)}&.p .ra{left:auto;right:calc(100% - var(--wx) - 6%);width:20%;top:auto;bottom:30%;height:22%;-webkit-mask:var(--sh) 50% 100%/contain no-repeat;mask:var(--sh) 50% 100%/contain no-repeat;background:#141a12}&.p .rb{left:30%;width:40px;top:0;height:30%;background:linear-gradient(90deg,transparent 48%,#111 48% 52%,transparent 52%) 0 0/100% 70% no-repeat,radial-gradient(50% 40% at 50% 100%,#e8d3a0,#a07a3a 70%,transparent 72%) 0 100%/100% 34% no-repeat}&.p .lamp{background:radial-gradient(22% 46% at 33% 46%,rgba(255,210,140,.5),transparent 70%)}`,
    view: (r) => { const l = L(); skyline(l, l, r, "modern", 100, [30, 66]); return { far: l, vars: "--hf:56%;" }; },
    windows: (v) => ({ ...windowSet("rect", v === 2 ? 2 : 1, 3, 2, 6), box: BOXES[v].box + ";top:12%;bottom:32%", wx: BOXES[v].wx, shx: BOXES[v].shx }),
  },
  {
    id: "tent",
    css: `&.p .wall{background:repeating-linear-gradient(100deg,rgba(0,0,0,.12) 0 18px,transparent 18px 60px),linear-gradient(180deg,#6a5434,#2e2214)}&.p .wain{height:14%;background:linear-gradient(#3a2c1a,#1a120a)}&.p .lamp{background:radial-gradient(14% 26% at 24% 34%,rgba(255,190,100,.75),transparent 70%)}&.p .ra{left:24%;width:2px;top:0;height:30%;background:#111}`,
    view: (r) => ({ far: hills(L(), r, 4, 40, 80), mid: (() => { const l = L(); tents(l, r, 100, 5, 1.2); return l; })(), vars: "--hf:46%;--hm:50%;" }),
    windows: () => ({ ...windowSet("tri", 1, 1, 1, 4), box: "left:50%;right:auto;width:clamp(150px,32%,240px);transform:translateX(-50%);top:4%;bottom:14%" }),
  },
  {
    id: "kitchen",
    css: `&.p .wall{background:linear-gradient(180deg,#4a4238,#2a241e)}&.p .rd{left:0;right:0;bottom:30%;height:22%;background:repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 1px,transparent 1px 14px),repeating-linear-gradient(90deg,rgba(0,0,0,.25) 0 1px,transparent 1px 14px),linear-gradient(#8f8676,#6a6252);filter:brightness(calc(.45 + (1 - var(--lit)) * .3))}&.p .rc{left:0;right:0;bottom:0;height:30%;border-top:6px solid #8a7a66;background:repeating-linear-gradient(90deg,#2c241c 0 2px,#4a3c2e 2px 24%);filter:brightness(calc(.6 + (1 - var(--lit)) * .3))}&.p .rb{left:0;right:0;top:0;height:13%;background:repeating-linear-gradient(90deg,#2c241c 0 2px,#5a4a38 2px 16%);box-shadow:0 6px 12px rgba(0,0,0,.4)}&.p .ra{left:var(--shx);top:14%;width:28%;height:24%;-webkit-mask:var(--sh) 0 0/auto 100% repeat-x;mask:var(--sh) 0 0/auto 100% repeat-x;background:linear-gradient(#8a8f96,#2a2c30)}&.p .wain{display:none}&.p .lamp{background:radial-gradient(18% 40% at var(--wx) 46%,rgba(255,226,170,.45),transparent 70%)}`,
    view: (r) => ({ far: (() => { const l = L(); houses(l, l, r, 100, [26, 40]); return l; })(), vars: "--hf:46%;" }),
    windows: (v) => { const b = BOXES[v === 3 ? 0 : v]; return { ...windowSet("rect", 1, 2, 2, 7), box: b.box + ";top:15%;bottom:48%", wx: b.wx, shx: b.shx }; },
  },
  {
    id: "office",
    css: `&.p .wall{background:linear-gradient(180deg,#2e343c,#171b20)}&.p .wf{background:linear-gradient(180deg,#c9ccd2,#7a7f88)}&.p .wain{height:14%;background:linear-gradient(#22262c,#111316)}&.p .rc{left:var(--shx);width:40%;bottom:14%;height:18%;-webkit-mask:var(--sh) 50% 100%/100% 100%;mask:var(--sh) 50% 100%/100% 100%;background:#0e1013}&.p .ra{left:calc(var(--shx) + 14%);width:12%;bottom:30%;height:12%;border-radius:3px;background:linear-gradient(160deg,#9fe3ff,#2a6aa0);box-shadow:0 0 24px 6px rgba(120,200,255,.35);opacity:calc(.5 + var(--lit) * .5)}&.p .lamp{background:linear-gradient(180deg,rgba(220,235,255,.18),transparent 22%),radial-gradient(16% 30% at calc(var(--shx) + 20%) 66%,rgba(140,210,255,.35),transparent 70%)}`,
    view: (r) => { const l = L(), w = L(); skyline(l, w, r, "modern", 100, [30, 70], 1.3); return { far: l, win: w, winOn: "far", vars: "--hf:66%;" }; },
    windows: (v) => ({ ...windowSet("rect", v === 2 ? 2 : 1, 1, 14, 6), box: BOXES[v].box + ";top:10%;bottom:34%", wx: BOXES[v].wx, shx: BOXES[v].shx }),
  },
  {
    id: "cafe",
    css: `&.p .wall{background:linear-gradient(180deg,#3a2c22,#1e1610)}&.p .rb{left:0;right:0;top:0;height:11%;background:repeating-linear-gradient(90deg,#b8382e 0 26px,#efe4d0 26px 52px);-webkit-mask:radial-gradient(14px 10px at 13px 100%,transparent 98%,#000) 0 0/26px 100%;mask:radial-gradient(14px 10px at 13px 100%,transparent 98%,#000) 0 0/26px 100%;filter:brightness(calc(.55 + (1 - var(--lit)) * .4))}&.p .rd{left:var(--shx);top:20%;width:22%;height:32%;border:4px solid #5a3c22;border-radius:4px;background:repeating-linear-gradient(0deg,transparent 0 12px,rgba(240,240,230,.35) 12px 13px) 10px 10px/70% 80% no-repeat,#1e2a24}&.p .rc{left:0;right:0;bottom:0;height:24%;border-top:5px solid #6a4a2c;background:linear-gradient(#3a2a1c,#1a120a)}&.p .lamp{background:radial-gradient(5% 9% at 20% 20%,rgba(255,210,140,.95),transparent 70%),radial-gradient(5% 9% at 50% 20%,rgba(255,210,140,.95),transparent 70%),radial-gradient(5% 9% at 80% 20%,rgba(255,210,140,.95),transparent 70%),radial-gradient(60% 40% at 50% 30%,rgba(255,190,120,.25),transparent 70%)}&.p .wain{display:none}`,
    view: (r) => ({ far: (() => { const l = L(); houses(l, l, r, 100, [30, 46], { gap: [-2, 4] }); return l; })(), near: (() => { const l = L(); lampPosts(l, 100, 220, 60, 90); return l; })(), vars: "--hf:66%;--hn:64%;" }),
    windows: (v) => ({ ...windowSet("rect", 1, 3, 1, 8), box: (v % 2 ? "left:4%;right:auto;width:58%" : "left:auto;right:4%;width:58%") + ";top:14%;bottom:26%", wx: v % 2 ? "33%" : "67%", shx: v % 2 ? "70%" : "6%" }),
  },
  {
    id: "club",
    css: `&.p :is(.scene,.wf){display:none}&.p .wall{background:radial-gradient(70% 60% at 50% 0%,#2a0f3a,#07040c 70%)}&.p .walldim{opacity:0}&.p .rd{inset:9% 7% auto 7%;height:3px;border-radius:3px;background:#ff4fd8;box-shadow:0 0 10px 3px #ff4fd8,0 0 30px 8px rgba(255,79,216,.5)}&.p .rc{left:10%;right:10%;top:20%;height:20%;background:linear-gradient(90deg,#4ff0ff,#4ff0ff) 0 50%/100% 3px no-repeat;-webkit-mask:repeating-linear-gradient(90deg,#000 0 34px,transparent 34px 40px);mask:repeating-linear-gradient(90deg,#000 0 34px,transparent 34px 40px);filter:drop-shadow(0 0 6px #4ff0ff)}&.p .ra{left:calc(50% - 16px);top:4%;width:32px;height:32px;border-radius:50%;background:repeating-conic-gradient(#ddd 0 10deg,#666 10deg 20deg);box-shadow:0 0 30px 8px rgba(255,255,255,.35)}&.p .rb{inset:0;background:conic-gradient(from 160deg at 50% 6%,transparent 0 10deg,rgba(255,80,220,.22) 12deg 18deg,transparent 20deg 30deg,rgba(80,240,255,.2) 32deg 38deg,transparent 40deg);mix-blend-mode:screen;transform-origin:50% 6%}&.p .wain{height:22%;background:repeating-linear-gradient(90deg,rgba(255,79,216,.18) 0 2px,transparent 2px 40px),linear-gradient(#1a0a24,#050208)}&.p .lamp{opacity:1;background:radial-gradient(40% 30% at 50% 100%,rgba(255,79,216,.25),transparent 70%)}@media (prefers-reduced-motion:no-preference){&.p .rb{animation:sweep 6s ease-in-out infinite alternate}&.p .ra{animation:spin 8s linear infinite}&.p .rd{animation:flicker 2.4s ease-in-out infinite}}`,
    view: () => ({}),
    windows: () => ({ ...windowSet("rect", 1, 1, 1, 4), box: "left:0;width:0" }),
  },
  {
    id: "classroom",
    css: `&.p .wall{background:linear-gradient(180deg,#3c4038,#20231e)}&.p .rd{left:var(--shx);width:44%;top:16%;height:36%;border:6px solid #6a4a2a;border-radius:3px;background:radial-gradient(40% 10% at 30% 30%,rgba(255,255,255,.18),transparent 70%),radial-gradient(30% 8% at 60% 60%,rgba(255,255,255,.14),transparent 70%),linear-gradient(170deg,#2e4a3a,#1a2e24)}&.p .rd:after{content:"";position:absolute;left:10%;top:22%;width:60%;height:50%;background:repeating-linear-gradient(0deg,transparent 0 10px,rgba(240,240,230,.45) 10px 11px);-webkit-mask:linear-gradient(90deg,#000 0 40%,transparent 40% 48%,#000 48% 80%,transparent 80%);mask:linear-gradient(90deg,#000 0 40%,transparent 40% 48%,#000 48% 80%,transparent 80%)}&.p .rc{left:0;right:0;bottom:0;height:20%;-webkit-mask:var(--sh) 0 100%/auto 100% repeat-x;mask:var(--sh) 0 100%/auto 100% repeat-x;background:#1a140e}&.p .ra{left:calc(var(--shx) + 20%);top:5%;width:22px;height:22px;border-radius:50%;background:#efe9dc;border:2px solid #222;box-shadow:inset 0 0 0 1px #999}&.p .wain{height:20%;background:linear-gradient(#3a2e22,#1c160e)}`,
    view: (r) => ({ far: forest(L(), r, "round", 20, 99, [20, 40]), mid: hills(L(), r, 3, 70, 92), vars: "--hf:46%;--hm:24%;" }),
    windows: (v) => ({ ...windowSet("rect", 3, 2, 3, 6), box: (v % 2 ? "left:4%;right:auto" : "left:auto;right:4%") + ";width:44%;top:10%;bottom:28%", wx: v % 2 ? "26%" : "74%", shx: v % 2 ? "52%" : "4%" }),
  },
  {
    id: "ward",
    css: `&.p .wall{background:linear-gradient(180deg,#5a6e6a,#2e3a38)}&.p .rb{left:calc(var(--shx) - 4%);width:22%;top:4%;bottom:12%;background:repeating-linear-gradient(90deg,#9ab6b0 0 10px,#6e8a84 10px 16px,#9ab6b0 16px 24px);border-top:4px solid #ccc;opacity:.92}&.p .rc{left:calc(var(--shx) + 18%);width:38%;top:auto;bottom:10%;height:26%;-webkit-mask:var(--sh) 0 100%/100% 100%;mask:var(--sh) 0 100%/100% 100%;background:linear-gradient(#e8ecea,#9aa4a2)}&.p .ra{left:calc(var(--shx) + 46%);top:24%;width:14%;height:14%;border-radius:4px;border:3px solid #333;background:#071810;overflow:hidden}&.p .ra:after{content:"";position:absolute;inset:0;background:linear-gradient(#6aff9a,#6aff9a) center/100% 2px no-repeat,linear-gradient(#6aff9a,#6aff9a) 30% 30%/2px 40% no-repeat,linear-gradient(#6aff9a,#6aff9a) 34% 70%/2px 30% no-repeat;filter:drop-shadow(0 0 3px #6aff9a)}&.p .wain{height:12%;background:linear-gradient(#7a8a86,#3a4442)}&.p .lamp{background:linear-gradient(180deg,rgba(230,255,250,.25),transparent 30%)}@media (prefers-reduced-motion:no-preference){&.p .ra:after{animation:ecg 1.6s linear infinite}}`,
    view: (r) => ({ far: (() => { const l = L(); skyline(l, l, r, "modern", 100, [24, 60]); return l; })(), vars: "--hf:50%;" }),
    windows: (v) => { const b = BOXES[v === 3 ? 1 : v]; return { ...windowSet("rect", 1, 1, 10, 6), box: b.box + ";top:10%;bottom:36%", wx: b.wx, shx: b.shx }; },
  },
  {
    id: "cell",
    css: `&.p .wall{background:repeating-linear-gradient(0deg,rgba(0,0,0,.35) 0 2px,transparent 2px 30px),repeating-linear-gradient(90deg,rgba(0,0,0,.3) 0 2px,transparent 2px 60px),linear-gradient(180deg,#3a3834,#161512)}&.p .wf{background:#1a1a1c}&.p .rc{left:var(--shx);width:40%;bottom:8%;height:14%;background:linear-gradient(#4a4036,#1c1812);border-top:3px solid #6a5a48}&.p .ra{left:calc(var(--shx) + 6%);top:40%;width:2px;height:24%;background:repeating-linear-gradient(180deg,#555 0 5px,transparent 5px 7px)}&.p .wain{height:10%;background:#100f0d}&.p .lamp{background:none}&.p .spill{opacity:calc(.3 + (1 - var(--lit)) * .7);background:linear-gradient(160deg,transparent 30%,rgba(255,250,230,.14) 40%,transparent 56%)}`,
    view: () => ({}),
    windows: (v) => ({ ...windowSet("rect", 1, 4, 1, 10), box: (v % 2 ? "left:20%;right:auto" : "left:auto;right:20%") + ";width:clamp(80px,18%,130px);top:9%;aspect-ratio:2/1", wx: v % 2 ? "28%" : "72%", shx: v % 2 ? "52%" : "8%" }),
  },
  {
    id: "cabin",
    css: `&.p .wall{background:repeating-linear-gradient(0deg,rgba(0,0,0,.3) 0 2px,transparent 2px 26px),linear-gradient(180deg,#5a3a22,#2a180c)}&.p .wf{background:radial-gradient(circle,#c9a45c,#7a5a2a)}&.p .ra{left:var(--shx);top:0;width:30px;height:40%;transform-origin:50% 0;background:linear-gradient(#222,#222) 50% 0/2px 70% no-repeat,radial-gradient(40% 18% at 50% 82%,#ffd27a,#c06a1a 60%,transparent 64%)}&.p .lamp{background:radial-gradient(24% 40% at calc(var(--shx) + 2%) 36%,rgba(255,190,100,.6),transparent 70%)}&.p .wain{height:16%;background:linear-gradient(#3a2414,#1a0e06)}@media (prefers-reduced-motion:no-preference){&.p .ra{animation:swing 4s ease-in-out infinite alternate}&.p .scene .land,&.p .scene .water{animation:sway 7s ease-in-out infinite alternate}}`,
    view: (r) => { const near = L(); let d = "M0 100V70"; for (let i = 0; i < 12; i++) d += `Q${i * 66 + 20} ${between(r, 52, 62)} ${(i + 1) * 66.7} 70`; near.path(d + "V100Z"); return { near, vars: "--wl:52%;--hn:30%;" }; },
    windows: (v) => ({ ...windowSet("circle", v === 2 ? 1 : 2, 1, 1, 12), box: (v === 2 ? "left:auto;right:12%;width:clamp(90px,20%,140px);aspect-ratio:1" : "left:auto;right:6%;width:clamp(200px,42%,300px);aspect-ratio:2.2/1") + ";top:14%", wx: "70%", shx: "12%" }),
  },
  {
    id: "bridge",
    css: `&.p :is(.clouds,.clouds2,.sun,.rays,.glow,.ground,.moon,.rain,.snow,.fog,.windl,.heat,.flash,.fx,.fx2){display:none}&.p .sky{filter:none;background:radial-gradient(50% 50% at 70% 40%,rgba(120,60,200,.35),transparent 70%),#02030a}&.p .stars{opacity:1}&.p .scene .kx{inset:auto;left:58%;top:30%;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at 34% 34%,#9fd3ff,#2a5aa0 50%,#0a1a3a 80%);box-shadow:0 0 30px 6px rgba(120,190,255,.4)}&.p .wall{background:linear-gradient(180deg,#1a1f28,#0a0d12)}&.p .wf{background:linear-gradient(180deg,#3a4250,#141820)}&.p .rc{left:0;right:0;bottom:0;height:24%;background:radial-gradient(3px 3px at 10% 40%,#ff5a5a,transparent),radial-gradient(3px 3px at 14% 40%,#5aff9a,transparent),radial-gradient(3px 3px at 18% 40%,#5ad1ff,transparent),radial-gradient(3px 3px at 82% 40%,#ffd25a,transparent),radial-gradient(3px 3px at 86% 40%,#5ad1ff,transparent),linear-gradient(90deg,transparent 30%,rgba(90,210,255,.3) 30% 70%,transparent 70%) 0 30%/100% 30% no-repeat,linear-gradient(#222a36,#0a0d12);border-top:2px solid rgba(90,210,255,.5)}&.p .lamp{opacity:1;background:radial-gradient(40% 30% at 50% 100%,rgba(90,210,255,.25),transparent 70%)}&.p .wain{display:none}@media (prefers-reduced-motion:no-preference){&.p .rc{animation:flicker 3s ease-in-out infinite}}`,
    view: () => ({}),
    windows: (v) => ({ ...windowSet("trap", 1, v + 2, 1, 8), box: "left:5%;right:5%;top:6%;bottom:30%" }),
  },
  {
    id: "car",
    css: `&.p .wall{background:linear-gradient(180deg,#14161a,#0a0b0d)}&.p .wf{background:#0c0d10}&.p .rc{left:0;right:0;bottom:0;height:30%;border-radius:40% 40% 0 0/30% 30% 0 0;background:radial-gradient(5% 14% at 30% 40%,rgba(255,170,80,.7),transparent 70%),radial-gradient(5% 14% at 40% 40%,rgba(120,220,255,.6),transparent 70%),linear-gradient(#1c1e22,#08090a)}&.p .ra{left:calc(var(--shx) + 6%);bottom:-8%;width:24%;aspect-ratio:1;border-radius:50%;border:7px solid #050506;box-shadow:inset 0 0 0 2px #222}&.p .rb{left:calc(50% - 40px);top:6%;width:80px;height:14px;border-radius:6px;background:linear-gradient(#333,#111);border:2px solid #000}&.p .lamp{background:radial-gradient(30% 30% at 35% 75%,rgba(255,170,80,.2),transparent 70%)}&.p .wain{display:none}&.p .scene .land{-webkit-mask-size:800px 100%;mask-size:800px 100%}@media (prefers-reduced-motion:no-preference){&.p .scene .far,&.p .scene .lit{animation:pan 40s linear infinite}&.p .scene .near{animation:pan 3s linear infinite}}`,
    view: (r) => { const far = L(), win = L(); skyline(far, win, r, "modern", 100, [30, 70]); const near = L(); lampPosts(near, 100, 200, 70, 60); near.rect(0, 96, W, 4); return { far, win, winOn: "far", near, vars: "--hf:56%;--hn:56%;" }; },
    windows: (v) => ({ ...windowSet("trap", 1, 1, 1, 10), box: "left:3%;right:3%;top:5%;bottom:26%", wx: "50%", shx: v % 2 ? "52%" : "8%" }),
  },
  {
    id: "theater",
    css: `&.p :is(.scene,.wf){display:none}&.p .wall{background:radial-gradient(50% 60% at 50% 40%,#3a1a14,#0c0505 70%)}&.p .walldim{opacity:0}&.p .ra,&.p .rb{top:0;bottom:0;width:24%;background:repeating-linear-gradient(90deg,#7a1018 0 12px,#3a0408 12px 22px,#9a1820 22px 30px);box-shadow:inset 0 0 30px rgba(0,0,0,.6)}&.p .ra{left:0;border-radius:0 0 60% 0}&.p .rb{right:0;left:auto;border-radius:0 0 0 60%}&.p .rc{left:0;right:0;top:0;height:14%;background:repeating-linear-gradient(90deg,#9a1820 0 30px,#5a0a10 30px 60px);-webkit-mask:radial-gradient(18px 12px at 15px 100%,transparent 98%,#000) 0 0/30px 100%;mask:radial-gradient(18px 12px at 15px 100%,transparent 98%,#000) 0 0/30px 100%;border-bottom:3px solid #c9a45c}&.p .rd{left:20%;right:20%;bottom:16%;height:6px;background:radial-gradient(6px 4px at 10% 50%,#ffe9a0,transparent),radial-gradient(6px 4px at 30% 50%,#ffe9a0,transparent),radial-gradient(6px 4px at 50% 50%,#ffe9a0,transparent),radial-gradient(6px 4px at 70% 50%,#ffe9a0,transparent),radial-gradient(6px 4px at 90% 50%,#ffe9a0,transparent);filter:drop-shadow(0 0 6px #ffcf6a)}&.p .lamp{opacity:1;background:conic-gradient(from 166deg at 50% -10%,transparent 0deg,rgba(255,240,200,.28) 6deg 22deg,transparent 28deg),radial-gradient(30% 22% at 50% 88%,rgba(255,230,170,.35),transparent 70%)}&.p .wain{height:16%;background:linear-gradient(#3a2416,#140a04);border-top:3px solid #5a3a20}`,
    view: () => ({}),
    windows: () => ({ ...windowSet("rect", 1, 1, 1, 4), box: "left:0;width:0" }),
  },
  {
    id: "shrine",
    css: `&.p .wall{background:linear-gradient(90deg,#2a1c10 0 6px,transparent 6px) 0 0/25% 100%,repeating-linear-gradient(0deg,rgba(60,40,20,.55) 0 2px,transparent 2px 25%),repeating-linear-gradient(90deg,rgba(60,40,20,.55) 0 2px,transparent 2px 12.5%),linear-gradient(180deg,#d8c8a0,#a89060);filter:brightness(calc(.35 + (1 - var(--lit)) * .45))}&.p .walldim{opacity:0}&.p .lamp{opacity:1;background:radial-gradient(40% 60% at 50% 40%,rgba(255,200,120,calc(.15 + var(--lit) * .35)),transparent 70%)}&.p .wf{background:#2a1c10}&.p .ra{left:var(--shx);top:10%;width:34px;height:52px;border-radius:40%;transform-origin:50% -40px;background:linear-gradient(90deg,transparent 46%,rgba(0,0,0,.25) 46% 54%,transparent 54%),radial-gradient(circle at 50% 50%,#ffefc0,#e04a2a 60%,#8a1a10);box-shadow:0 0 28px 10px rgba(255,150,80,calc(.2 + var(--lit) * .5))}&.p .wain{height:16%;background:repeating-linear-gradient(90deg,#3a3a1a 0 2px,transparent 2px 50%),linear-gradient(#8a8a4a,#4a4a22);border-top:4px solid #2a1c10}@media (prefers-reduced-motion:no-preference){&.p .ra{animation:swing 6s ease-in-out infinite alternate}}`,
    view: (r) => { const l = L(); skyline(l, l, r, "eastern", 100, [24, 50]); return { far: forest(L(), r, "round", 20, 99, [16, 30]), mid: l, vars: "--hf:40%;--hm:44%;" }; },
    windows: (v) => ({ ...windowSet("circle", 1, 1, 1, 9), box: BOXES[v].box.replace(/width:clamp\([^)]*\)/, "width:clamp(110px,24%,170px)") + ";top:12%;aspect-ratio:1", wx: BOXES[v].wx, shx: v === 3 ? "8%" : BOXES[v].shx }),
  },
  {
    id: "attic",
    css: `&.p .wall{background:repeating-linear-gradient(90deg,rgba(0,0,0,.25) 0 2px,transparent 2px 46px),linear-gradient(180deg,#4a3828,#20160e)}&.p .ra,&.p .rb{top:0;width:52%;height:72%;background:linear-gradient(#2a1c10,#1a1008)}&.p .ra{left:0;clip-path:polygon(0 0,100% 0,0 100%)}&.p .rb{right:0;left:auto;clip-path:polygon(0 0,100% 0,100% 100%)}&.p .rc{left:var(--shx);width:24%;bottom:12%;height:16%;border-radius:8px 8px 2px 2px;background:linear-gradient(90deg,transparent 46%,#6a4a20 46% 54%,transparent 54%),linear-gradient(#4a3020,#20140a);border:2px solid #120a04}&.p .spill{opacity:calc(.25 + (1 - var(--lit)) * .75);background:linear-gradient(180deg,rgba(255,240,200,.18),transparent 80%) 50% 18%/22% 80% no-repeat}&.p .wain{height:12%;background:repeating-linear-gradient(90deg,#1a1008 0 2px,transparent 2px 60px),linear-gradient(#3a2618,#1a1008)}`,
    view: (r) => ({ far: (() => { const l = L(); houses(l, l, r, 100, [20, 34]); return l; })(), vars: "--hf:50%;" }),
    windows: (v) => ({ ...windowSet(v % 2 ? "circle" : "tri", 1, 2, 2, 7), box: "left:50%;right:auto;width:clamp(80px,16%,120px);transform:translateX(-50%);top:4%;aspect-ratio:1", wx: "50%", shx: v % 2 ? "8%" : "66%" }),
  },
  {
    id: "cellar",
    css: `&.p :is(.scene,.wf){display:none}&.p .wall{background:repeating-linear-gradient(0deg,rgba(0,0,0,.35) 0 2px,transparent 2px 16px),repeating-linear-gradient(90deg,rgba(0,0,0,.25) 0 2px,transparent 2px 34px),linear-gradient(180deg,#4a2c20,#1a0e08)}&.p .ra{inset:0;background:radial-gradient(34% 70% at 25% 100%,transparent 60%,#120806 61%),radial-gradient(34% 70% at 75% 100%,transparent 60%,#120806 61%);opacity:.85}&.p .rc{left:0;right:0;bottom:8%;height:30%;-webkit-mask:var(--sh) 0 100%/auto 100% repeat-x;mask:var(--sh) 0 100%/auto 100% repeat-x;background:linear-gradient(90deg,#5a3418,#2a1608)}&.p .lamp{opacity:1;background:radial-gradient(8% 16% at 50% 40%,rgba(255,200,110,.9),transparent 70%),radial-gradient(40% 50% at 50% 40%,rgba(255,170,80,.3),transparent 70%)}&.p .wain{height:10%;background:#120806}`,
    view: () => ({}),
    windows: () => ({ ...windowSet("rect", 1, 1, 1, 4), box: "left:0;width:0" }),
  },
  {
    id: "greenhouse",
    css: `&.p .wall{background:linear-gradient(180deg,#1a2a1c,#0c140c)}&.p .wf{background:linear-gradient(180deg,#e8ece4,#9aa49a)}&.p .scene:after{content:"";position:absolute;inset:0;background:rgba(160,255,190,.1)}&.p .rc{left:0;right:0;bottom:0;height:46%;-webkit-mask:var(--sh) 0 100%/auto 100% repeat-x;mask:var(--sh) 0 100%/auto 100% repeat-x;background:linear-gradient(#2e6a3a,#0e2a14)}&.p .ra{left:0;right:0;top:0;height:30%;-webkit-mask:var(--sh2) 0 0/auto 100% repeat-x;mask:var(--sh2) 0 0/auto 100% repeat-x;background:linear-gradient(#1e4a26,#3e8a4a)}&.p .wain{display:none}&.p .lamp{opacity:calc(var(--lit) * .8);background:radial-gradient(5% 9% at 30% 30%,rgba(255,220,150,.9),transparent 70%),radial-gradient(5% 9% at 70% 30%,rgba(255,220,150,.9),transparent 70%)}`,
    view: (r) => ({ far: forest(L(), r, "round", 30, 99, [20, 40]), vars: "--hf:40%;" }),
    windows: (v) => ({ ...windowSet(v % 2 ? "arch" : "rect", 1, 6 + v, 4, 5), box: "left:3%;right:3%;top:4%;bottom:4%" }),
  },
  {
    id: "shop",
    css: `&.p .wall{background:linear-gradient(180deg,#3a2c22,#1c140e)}&.p .ra{left:var(--shx);width:40%;top:6%;height:60%;background:repeating-linear-gradient(180deg,transparent 0 calc(33% - 5px),#2a1a0e calc(33% - 5px) 33%)}&.p .ra:after{content:"";position:absolute;inset:0;-webkit-mask:var(--sh) 0 100%/auto 33.3% repeat;mask:var(--sh) 0 100%/auto 33.3% repeat;background:linear-gradient(90deg,#4a8a5a,#a8642a 20%,#3a5aa0 40%,#9a2a3a 60%,#c9a45c 80%,#4a8a5a);opacity:.85}&.p .rc{left:0;right:0;bottom:0;height:26%;border-top:6px solid #7a5a3a;background:linear-gradient(#4a3222,#1c120a)}&.p .lamp{background:radial-gradient(30% 40% at calc(var(--shx) + 20%) 30%,rgba(255,210,140,.45),transparent 70%)}&.p .wain{display:none}`,
    view: (r) => ({ far: (() => { const l = L(); houses(l, l, r, 100, [30, 46], { gap: [-2, 4] }); return l; })(), vars: "--hf:66%;" }),
    windows: (v) => ({ ...windowSet(v === 1 ? "arch" : "rect", 1, 2, 3, 8), box: (v % 2 ? "left:6%;right:auto" : "left:auto;right:6%") + ";width:36%;top:10%;bottom:28%", wx: v % 2 ? "24%" : "76%", shx: v % 2 ? "52%" : "6%" }),
  },
  {
    id: "bath",
    css: `&.p .wall{background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 1px,transparent 1px 20px),repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 1px,transparent 1px 20px),linear-gradient(180deg,#9ab0b4,#4a5a5e);filter:brightness(calc(.45 + (1 - var(--lit)) * .4))}&.p .scene{filter:blur(3px) saturate(.7)}&.p .rc{left:var(--shx);width:44%;bottom:8%;height:26%;-webkit-mask:var(--sh) 0 100%/100% 100%;mask:var(--sh) 0 100%/100% 100%;background:linear-gradient(#f4f4f0,#a8aeb0)}&.p .rb{left:calc(var(--shx) - 4%);width:52%;bottom:26%;height:50%;background:radial-gradient(30% 30% at 30% 70%,rgba(255,255,255,.35),transparent 70%),radial-gradient(26% 26% at 60% 50%,rgba(255,255,255,.3),transparent 70%),radial-gradient(30% 24% at 45% 24%,rgba(255,255,255,.22),transparent 70%);filter:blur(6px)}&.p .wain{height:10%;background:linear-gradient(#5a6a6e,#2a3234)}&.p .lamp{background:radial-gradient(30% 40% at 50% 20%,rgba(255,240,220,.3),transparent 70%)}@media (prefers-reduced-motion:no-preference){&.p .rb{animation:steam 9s ease-in-out infinite}}`,
    view: (r) => ({ far: forest(L(), r, "round", 24, 99, [20, 40]), vars: "--hf:46%;" }),
    windows: (v) => { const b = BOXES[v === 3 ? 0 : v]; return { ...windowSet(v === 2 ? "circle" : "rect", 1, 2, 2, 7), box: b.box + ";top:10%;aspect-ratio:1/1.1", wx: b.wx, shx: b.shx }; },
  },
];

/** Room prop silhouettes (mask var --sh; a few rooms also use --sh2). */
function roomProp2(id: string, r: Rng): string {
  const l = L();
  if (id === "greenhouse") {
    for (let x = 10; x < W; x += between(r, 40, 70)) {
      const len = between(r, 30, 80);
      l.line(1, `M${x} 0V${len * 0.5}`);
      for (let k = 0; k < 6; k++) l.ellipse(x + between(r, -14, 14), len * between(r, 0.4, 1), between(r, 4, 8), between(r, 2, 4));
    }
    return l.url();
  }
  return "none";
}
function roomProp(id: string, r: Rng): string {
  const l = L();
  if (id === "kitchen") {
    l.line(2, "M0 6H800");
    for (let x = 30; x < W; x += between(r, 50, 80)) {
      const s = between(r, 0.7, 1.2);
      l.line(1.2, `M${x} 6V${30 * s}`);
      l.ellipse(x, 30 * s + 14 * s, 16 * s, 14 * s);
      l.rect(x + 14 * s, 30 * s + 10 * s, 26 * s, 4 * s);
    }
    return l.url();
  }
  if (id === "office") {
    l.rect(0, 40, 300, 8); l.rect(10, 48, 10, 52); l.rect(280, 48, 10, 52); l.rect(180, 48, 90, 40);
    l.path("M60 100V70Q60 60 70 60H120Q130 60 130 70V100Z"); l.rect(70, 30, 50, 34);
    return l.url(300, 100, true);
  }
  if (id === "classroom") {
    for (let x = 20; x < W; x += 110) { l.rect(x, 50, 70, 8); l.rect(x + 4, 58, 4, 42); l.rect(x + 62, 58, 4, 42); l.path(`M${x + 20} 100V70H${x + 50}V100ZM${x + 20} 70V40H${x + 26}V70Z`); }
    return l.url();
  }
  if (id === "bath") {
    l.path("M10 30H290Q296 30 290 40Q270 90 200 92H100Q30 90 10 40Q4 30 10 30Z");
    l.path("M40 90l-10 10h14l6-8ZM260 90l10 10h-14l-6-8Z");
    return l.url(300, 100, true);
  }
  if (id === "ward") {
    l.rect(10, 40, 280, 30); l.rect(10, 10, 14, 90); l.rect(276, 30, 10, 70); l.path("M30 40Q30 26 50 26H100Q110 26 110 40Z"); l.rect(20, 70, 6, 30); l.rect(270, 70, 6, 30);
    return l.url(300, 100, true);
  }
  if (id === "cellar") {
    for (let x = 10; x < W; x += 64) { l.ellipse(x + 30, 60, 30, 26); l.ellipse(x + 30, 24, 26, 22); }
    l.rect(0, 84, W, 16);
    return l.url();
  }
  if (id === "greenhouse") {
    for (let x = 0; x < W; x += between(r, 30, 60)) {
      const h = between(r, 50, 95);
      for (let k = 0; k < 5; k++) {
        const a = -1 + k * 0.5 + between(r, -0.2, 0.2), len = h * between(r, 0.6, 1);
        l.path(`M${x} 100Q${x + Math.sin(a) * len * 0.5 - 10} ${100 - len * 0.6} ${x + Math.sin(a) * len} ${100 - Math.cos(a) * len}Q${x + Math.sin(a) * len * 0.5 + 10} ${100 - len * 0.4} ${x} 100Z`);
      }
    }
    return l.url();
  }
  if (id === "shop") {
    for (let x = 6; x < W; x += between(r, 14, 26)) {
      const h = between(r, 40, 80), w = between(r, 8, 14);
      if (r() < 0.5) l.path(`M${x} 100V${100 - h + 10}Q${x} ${100 - h} ${x + w / 2} ${100 - h}Q${x + w} ${100 - h} ${x + w} ${100 - h + 10}V100Z`);
      else { l.rect(x, 100 - h * 0.7, w, h * 0.7); l.rect(x + w * 0.3, 100 - h, w * 0.4, h * 0.3); }
    }
    return l.url();
  }

  if (id === "tavern") { l.rect(0, 92, W, 8); for (let x = 20; x < W; x += between(r, 22, 40)) { const h = between(r, 30, 60), w = between(r, 10, 16); l.path(`M${x} 92V${92 - h * 0.6}Q${x} ${92 - h * 0.75} ${x + w * 0.35} ${92 - h * 0.8}V${92 - h}H${x + w * 0.65}V${92 - h * 0.8}Q${x + w} ${92 - h * 0.75} ${x + w} ${92 - h * 0.6}V92Z`); } }
  else if (id === "bedroom") {
    l.path("M6 100V22Q6 6 24 6Q42 6 42 22V100Z");
    l.path("M42 62H292Q298 62 298 70V86H42Z");
    l.path("M60 62Q60 50 74 50H112Q124 50 124 62ZM128 62Q128 52 140 52H170Q180 52 180 62Z");
    l.path("M150 64Q220 58 296 66L298 92Q230 98 150 94Z");
    l.rect(48, 86, 5, 14); l.rect(288, 86, 5, 14);
    return l.url(300, 100, true);
  }
  else if (id === "hall") { l.line(4, "M400 0V40"); l.path("M300 50Q400 90 500 50Q480 66 400 70Q320 66 300 50Z"); for (let i = 0; i < 9; i++) { const x = 300 + i * 25; l.rect(x - 2, 40, 4, 12); l.ellipse(x, 38, 2.5, 5); } }
  else if (id === "home") { for (let i = 0; i < 7; i++) { const a = -1.2 + i * 0.4, len = between(r, 40, 70); l.path(`M400 100Q${400 + Math.sin(a) * len * 0.5 - 14} ${100 - len * 0.6} ${400 + Math.sin(a) * len} ${100 - Math.cos(a) * len}Q${400 + Math.sin(a) * len * 0.5 + 14} ${100 - len * 0.5} 400 100Z`); } l.rect(370, 84, 60, 16); }
  else return "none";
  return l.url();
}

// ── Chunks ──────────────────────────────────────────────────────────────────
function varChunk(sel: string, v: Variant): string {
  let vars = "";
  const set = (name: string, l?: Layer) => { if (l && !l.empty) vars += `--m${name}:${l.url()};`; };
  set("f", v.far); set("m", v.mid); set("n", v.near); set("g", v.fg);
  if (v.win && !v.win.empty) {
    const on = v.winOn ?? "mid", k = on[0] === "f" ? "f" : on[0] === "m" ? "m" : "n";
    vars += `--mw:${v.win.url()};--hw:var(--h${k});--bw:var(--b${k},0px);--kw:var(--k${k});--aw:var(--a${k});`;
  }
  return `${sel}{${vars}${v.vars ?? ""}}`;
}
const scope = (css: string, sel: string) => css.replaceAll("&", sel);

export interface Chunk { key: string; css: string }
export function kindChunks(): Chunk[] {
  const out: Chunk[] = [];
  for (const k of KINDS) {
    k.variants.forEach((make, v) => {
      const key = `${k.id}-${v}`, sel = `[data-k=${key}]`;
      const vr = make(rng(hash(key)));
      out.push({ key, css: `${sel}.p{${k.vars ?? ""}}` + varChunk(`${sel}.p`, vr) + scope((k.css ?? "") + (vr.css ?? ""), sel) });
    });
  }
  for (const room of ROOMS) {
    for (let v = 0; v < 4; v++) {
      const key = `r_${room.id}-${v}`, sel = `[data-k=${key}]`;
      const r = rng(hash(key));
      const view = room.view(r), win = room.windows(v), prop = roomProp(room.id, r), prop2 = roomProp2(room.id, r);
      const wx = win.wx ?? "50%", shx = win.shx ?? "-100%";
      const box = `${sel}.p :is(.scene,.wf){inset:auto;bottom:auto;top:13%;${win.box}}`;
      out.push({
        key,
        css: varChunk(`${sel}.p`, view) + `${sel}.p{--mwin:${win.mask.url(WB, HB, true)};--mfr:${win.frame.url(WB, HB, true)};--sh:${prop};--sh2:${prop2};--wx:${wx};--shx:${shx}}` + box + scope(room.css + (view.css ?? ""), sel),
      });
    }
  }
  return out;
}

// ── Classification ──────────────────────────────────────────────────────────
// Read in order; the first match wins. The last 📍 segment is tried before the
// whole path, so "Ravenhill › the castle walls" is a castle, not a town.
export const ROOM_WORDS: [string, string][] = [
  ["train", "train|carriage|railcar|compartment|sleeper car|dining car|coach car|tram|subway car"],
  ["bridge", "bridge of the|flight deck|helm|cockpit|command deck|starship bridge|shuttle|spacecraft|airship gondola"],
  ["car", "car|truck|van|taxi|cab|limo|limousine|backseat|back seat|driver's seat|passenger seat|jeep|sedan|pickup|motorcar|bus"],
  ["cabin", "ship's cabin|cabin of the ship|stateroom|captain's quarters|captain's cabin|below deck|below decks|berth|galley"],
  ["tent", "tent|pavilion|yurt|marquee"],
  ["shrine", "shrine|dojo|teahouse|tea house|tea room|tatami|ryokan|shoji|zen garden|temple hall"],
  ["chapel", "church|chapel|cathedral|sanctuary|sanctum|nave|monastery|temple interior|mosque|synagogue"],
  ["theater", "theatre|theater|stage|backstage|opera house|auditorium|cinema|concert hall|playhouse|green room"],
  ["library", "library|study|archive|scriptorium|bookshop|bookstore|reading room"],
  ["hall", "throne|ballroom|great hall|banquet|palace|court room|courtroom|audience chamber|grand hall|gallery|museum|manor|mansion|dining hall"],
  ["ward", "hospital|ward|infirmary|clinic|sickbay|sick bay|medbay|emergency room|recovery room|icu|patient room"],
  ["lab", "lab|laboratory|clean room|server room|control room|engine room|operating|morgue|research station"],
  ["club", "nightclub|night club|club|disco|rave|karaoke|casino|dance floor|lounge"],
  ["tavern", "tavern|inn|pub|bar|saloon|taproom|common room|alehouse|brewery|cabin|lodge|forge|smithy|mead hall|speakeasy"],
  ["cafe", "caf[eé]|coffee shop|coffeehouse|coffee house|diner|restaurant|bistro|tea shop|bakery|canteen|cafeteria|food court|ramen"],
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
export const KIND_WORDS: [string, string][] = [
  ["space", "space|orbit|orbital|starship|spaceship|space station|asteroid|deep space|the void|nebula|moon base"],
  ["rooftop", "rooftop|roof|skyline|balcony|terrace|fire escape"],
  ["graveyard", "cemetery|graveyard|churchyard|necropolis|mausoleum|tomb|barrow|burial"],
  ["ruins", "ruin|ruins|ruined|abandoned temple|ziggurat|pyramid|obelisk|monolith|standing stones|henge|temple steps|colosseum|amphitheat"],
  ["castle", "castle|fortress|citadel|keep|rampart|battlement|walls|gatehouse|stronghold|fort\\b"],
  ["deck", "deck|aboard|ship|boat|galleon|vessel|frigate|schooner|ferry|yacht|raft"],
  ["underground", "cave|cavern|tunnel|mine|sewer|crypt|catacomb|dungeon|underground|undercroft|vault|grotto|metro|bunker"],
  ["volcano", "volcano|lava|caldera|crater|magma|ashlands|ash fields"],
  ["canyon", "canyon|gorge|ravine|mesa|butte|badlands|red rock|arroyo"],
  ["swamp", "swamp|marsh|bog|bayou|fen|mire|wetland|everglade"],
  ["jungle", "jungle|rainforest|tropical forest"],
  ["tropic", "island|isle|atoll|lagoon|palm|tropic|reef|cay"],
  ["tundra", "tundra|ice|glacier|arctic|antarctic|frozen|snowfield|icefield|permafrost|polar|taiga"],
  ["bridge", "bridge"],
  ["lake", "lake|pond|loch|mere|reservoir|tarn"],
  ["river", "river|stream|brook|creek|ford|canal|riverbank|riverside|waterfall|rapids"],
  ["harbour", "harbou?r|dock|docks|pier|wharf|port|quay|marina|shipyard"],
  ["camp", "camp|encampment|campsite|bivouac|battlefield|front line|trench|siege"],
  ["garden", "garden|gardens|park|orchard|vineyard|greenhouse|hedge maze|courtyard|cloister"],
  ["forest", "forest|wood|woods|grove|thicket|glade|copse|wildwood|treeline|clearing"],
  ["sea", "sea|ocean|open water|the waves|high seas|strait"],
  ["coast", "beach|coast|cliff|shore|bay|lighthouse|seaside|cove|strand|headland"],
  ["mountain", "mountain|peak|pass|summit|ridge|alps|highlands?|crag|foothills|valley"],
  ["desert", "desert|dunes?|wastes?|wasteland|oasis|sands|steppe|savann?a"],
  ["plains", "plain|plains|field|fields|meadow|farm|ranch|moor|heath|prairie|road|trail|countryside|pasture|hill|hills|downs"],
  ["village", "village|hamlet|farmstead|homestead"],
  ["city", "city|street|square|market|district|avenue|alley|downtown|capital|metropolis|plaza|quarter|borough|lane|boulevard|station|campus|neighbou?rhood|suburb|block"],
];
