// The scene plate's places: what the 📍 path is classified as, and for each kind
// four drawn variants. A variant is a CSS chunk scoped to .p[data-k=kind-v] that
// hands the plate its silhouettes (as mask URLs) and layer heights; the regex
// emits only the chunk it picked, so a message carries one place's art.
import {
  Layer, W, H, rng, hills, ridge, mesas, forest, pine, roundTree, deadTree, palm, willow, bush, cypress, skyline, houses, castle, ruins, graves, fence, tents, ship, sailboat,
  lighthouse, windmill, barn, waterTower, pyramid, cactus, camel, reeds, ferns, vines, canopy, stalactites, crystals, topiary, fountain, lampPosts, archBridge, suspension,
  volcano, station, asteroids, smoothPath, profile, type Rng, type Skyline, svgUrl,
} from "./art";
import { roomChunks } from "./rooms";
export { ROOM_WORDS } from "./rooms";

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

// ── Chunks ──────────────────────────────────────────────────────────────────
export function varChunk(sel: string, v: Variant): string {
  let vars = "";
  const set = (name: string, l?: Layer) => { if (l && !l.empty) vars += `--m${name}:${l.url()};`; };
  set("f", v.far); set("m", v.mid); set("n", v.near); set("g", v.fg);
  if (v.win && !v.win.empty) {
    const on = v.winOn ?? "mid", k = on[0] === "f" ? "f" : on[0] === "m" ? "m" : "n";
    vars += `--mw:${v.win.url()};--hw:var(--h${k});--bw:var(--b${k},0px);--kw:var(--k${k});--aw:var(--a${k});`;
  }
  return `${sel}{${vars}${v.vars ?? ""}}`;
}
export const scope = (css: string, sel: string) => css.replaceAll("&", sel);

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
  out.push(...roomChunks());
  return out;
}

// ── Classification ──────────────────────────────────────────────────────────
// Read in order; the first match wins. The last 📍 segment is tried before the
// whole path, so "Ravenhill › the castle walls" is a castle, not a town.
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
