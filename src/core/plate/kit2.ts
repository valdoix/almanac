// Set dressing for particular rooms: church pews to arcade cabinets. Same
// conventions as ./kit.ts (one unit ≈ one pixel of a 258px plate, light from
// the upper left; marks name the points overlays attach to).
import type { Rng } from "./art";
import { Pic, dk, lt, al, mix, BOOKS } from "./kit";

const between = (r: Rng, a: number, b: number) => a + (b - a) * r();
const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const f1 = (v: number) => String(Math.round(v * 10) / 10);
const GOLD = "#d9b45a", BRASS = "#c39a4a", IRON = "#2a2a2e", STEEL = "#9aa0aa", GLASS = "#cfe6ee", CHROME = "#d4d8de";

// ── Worship and state ────────────────────────────────────────────────────────
export function pews(wood: string, w = 300, rows = 2) {
  const p = new Pic(w, 40 + rows * 26);
  for (let j = 0; j < rows; j++) {
    const y = j * 26, s = 1 + j * 0.12;
    p.rect(0, y + 4, w, 26 * s, dk(wood, 0.08 - j * 0.04), 3);
    p.rect(0, y + 4, w, 4, lt(wood, 0.18), 2);
    for (let x = 30; x < w; x += 60) p.rect(x, y + 10, 2, 18 * s, dk(wood, 0.3));
    p.rect(0, y + 4, 12, 36 * s, dk(wood, 0.2), 3); p.ell(6, y + 4, 7, 5, dk(wood, 0.1));
    p.rect(w - 12, y + 4, 12, 36 * s, dk(wood, 0.3), 3); p.ell(w - 6, y + 4, 7, 5, dk(wood, 0.2));
  }
  return p;
}
export function altar(cloth = "#f4efe4", trim = "#8a1a2a") {
  const p = new Pic(160, 120);
  p.rect(10, 60, 140, 60, "#d8d0c0"); p.rect(10, 60, 140, 4, "#efe8da"); p.rect(140, 60, 10, 60, "#b8b0a0");
  p.path("M4 56H156V96L140 90L124 96L80 88L36 96L20 90L4 96Z", cloth); p.rect(4, 56, 152, 6, trim);
  p.path("M66 56V100H94V56Z", trim); p.text(80, 84, 18, GOLD, "✠");
  for (const x of [30, 130]) { p.rect(x - 5, 52, 10, 4, GOLD); p.rect(x - 3, 22, 6, 30, "#f2ead6"); p.ell(x, 18, 2.4, 4.5, "#ffd27a"); p.mark("glow", x, 18); }
  p.rect(70, 40, 20, 16, GOLD, 2); p.path("M72 40q8 -14 16 0z", GOLD); p.rect(78, 18, 4, 14, GOLD); p.rect(73, 22, 14, 4, GOLD);
  return p;
}
export function organ() {
  const p = new Pic(170, 160);
  p.rect(0, 90, 170, 70, "#5a3418"); p.rect(0, 90, 170, 5, "#7a4a24");
  for (let i = 0; i < 13; i++) { const x = 8 + i * 12.4, h = 40 + Math.abs(6 - i) * -5 + 50; p.rect(x, 92 - h, 9, h, p.lin(["#e8e0c8", "#a8a090", "#d8d0b8"], true)); p.path(`M${x} ${92 - h * 0.3}h9l-4.5 4z`, "#3a3020"); }
  for (let k = 0; k < 14; k++) p.rect(20 + k * 9.4, 120, 8, 14, "#f4efe4"); for (let k = 0; k < 9; k++) p.rect(26 + k * 14, 120, 5, 8, "#1a1a1a");
  return p;
}
export function throne(velvet = "#8a1a2a") {
  const p = new Pic(110, 170);
  p.path("M20 170V40Q20 8 55 4Q90 8 90 40V170Z", GOLD);
  p.path("M30 120V44Q30 18 55 14Q80 18 80 44V120Z", velvet);
  for (const [x, y] of [[44, 40], [66, 40], [55, 62], [44, 84], [66, 84]]) p.circ(x, y, 2, dk(velvet, 0.3));
  p.path("M40 4l5 -10l5 6l5 -10l5 10l5 -6l5 10z", GOLD); p.circ(55, -2, 3, "#d82a3a");
  p.rect(8, 110, 94, 18, velvet, 6); p.rect(8, 110, 94, 4, lt(velvet, 0.2), 3);
  p.rect(2, 96, 18, 60, GOLD, 6); p.rect(90, 96, 18, 60, dk(GOLD, 0.2), 6); p.ell(11, 96, 10, 6, lt(GOLD, 0.2)); p.ell(99, 96, 10, 6, GOLD);
  p.rect(14, 128, 82, 36, dk(GOLD, 0.15)); p.text(55, 154, 22, dk(GOLD, 0.45), "♛");
  return p;
}
export function armour() {
  const p = new Pic(56, 160), s = "#b8bcc4", d = "#7a7e88";
  p.rect(10, 150, 36, 10, "#3a2a1a");
  p.path("M18 150V104h8V150ZM30 150V104h8V150Z", d); p.ell(22, 128, 6, 4, s); p.ell(34, 128, 6, 4, s);
  p.path("M14 104Q12 60 28 56Q44 60 42 104Z", s); p.path("M28 56Q44 60 42 104H34Q38 70 28 58Z", d);
  p.path("M14 64Q4 70 6 100h6V72ZM42 64Q52 70 50 100h-6V72Z", d); p.ell(10, 64, 7, 6, s); p.ell(46, 64, 7, 6, s);
  p.path("M18 54Q16 30 28 26Q40 30 38 54Z", s); p.rect(20, 40, 16, 3, "#1a1a1a"); p.line("M28 26V18", "#c82a2a", 3); p.path("M28 18q8 -6 10 4q-6 -2 -10 0z", "#c82a2a");
  p.line("M52 150V10", "#5a3a20", 2.5); p.path("M48 14l4 -14l4 14z", s);
  return p;
}

// ── Science, work and study ──────────────────────────────────────────────────
export function labBench(r: Rng, w = 240) {
  const p = new Pic(w, 120), T = 70;
  p.rect(0, T, w, 50, "#d8dce0"); p.rect(0, T - 6, w, 8, "#2a2e34", 2);
  for (let x = 8; x < w - 30; x += 58) { p.rect(x, T + 8, 50, 38, "#c4c8ce", 2); p.rect(x + 20, T + 14, 10, 2.5, "#7a7e86", 1); }
  let x = 16;
  while (x < w - 30) {
    const c = pick(r, ["#5aff9a", "#ff5ad8", "#5ad0ff", "#ffd84a", "#ff7a4a"]), k = Math.floor(r() * 4);
    if (k === 0) { p.path(`M${x} ${T - 6}l8 -22v-14h8v14l8 22z`, al(GLASS, 0.5)); p.path(`M${x + 2} ${T - 6}l5 -13h14l5 13z`, c); p.rect(x + 7, T - 46, 10, 3, "#8a8a8a"); p.mark("bubble", x + 12, T - 22); x += 36; }
    else if (k === 1) { p.rect(x, T - 30, 18, 24, al(GLASS, 0.45), 2); p.rect(x + 1, T - 20, 16, 14, c, 2); p.rect(x - 2, T - 32, 22, 3, al(GLASS, 0.6)); x += 26; }
    else if (k === 2) { for (let t = 0; t < 4; t++) { p.rect(x + t * 7, T - 28, 5, 22, al(GLASS, 0.5), 2.5); p.rect(x + t * 7, T - 16 + t * 2, 5, 10 - t * 2, pick(r, ["#5aff9a", "#ff5ad8", "#5ad0ff", "#ffd84a"]), 2.5); } p.rect(x - 2, T - 14, 32, 3, "#6a6e76"); x += 38; }
    else { p.rect(x + 4, T - 40, 4, 34, "#5a5e66"); p.rect(x, T - 8, 26, 4, "#5a5e66"); p.rect(x + 6, T - 42, 18, 6, "#3a3e46", 2); p.circ(x + 18, T - 28, 9, al(GLASS, 0.45)); p.circ(x + 18, T - 26, 7, c); p.mark("bubble", x + 18, T - 32); x += 36; }
  }
  return p;
}
export function monitors(w = 150, kind: "graph" | "code" | "map" = "graph") {
  const p = new Pic(w, 70);
  const scr = (x: number, y: number, sw: number, sh: number, k: string) => {
    p.rect(x, y, sw, sh, "#14181e", 3); p.rect(x + 3, y + 3, sw - 6, sh - 6, "#0a2a2a");
    if (k === "graph") { p.line(`M${x + 6} ${y + sh - 10}l${sw * 0.15} -${sh * 0.3}l${sw * 0.12} ${sh * 0.15}l${sw * 0.2} -${sh * 0.4}l${sw * 0.15} ${sh * 0.2}l${sw * 0.15} -${sh * 0.1}`, "#5affb0", 1.5); for (let k2 = 0; k2 < 5; k2++) p.rect(x + 6 + k2 * (sw - 12) / 5, y + sh - 7 - k2 * 2, (sw - 12) / 7, 3 + k2 * 2, "#3ac0ff"); }
    else if (k === "code") for (let l = 0; l < 6; l++) p.rect(x + 6 + (l % 3) * 5, y + 7 + l * (sh - 14) / 6, sw * 0.3 + ((l * 13) % 20), 2, l % 2 ? "#5affb0" : "#5ad0ff");
    else { p.circ(x + sw / 2, y + sh / 2, sh * 0.34, "none"); p.raw(`<circle cx='${x + sw / 2}' cy='${y + sh / 2}' r='${sh * 0.34}' fill='none' stroke='#5affb0' stroke-width='1'/><circle cx='${x + sw / 2}' cy='${y + sh / 2}' r='${sh * 0.18}' fill='none' stroke='#5affb066' stroke-width='1'/>`); p.line(`M${x + sw / 2} ${y + sh / 2}l${sh * 0.3} -${sh * 0.16}`, "#5affb0", 1.5); p.circ(x + sw * 0.62, y + sh * 0.36, 2, "#ff5a5a"); }
    p.mark("screen", x + sw / 2, y + sh / 2);
  };
  scr(0, 6, w * 0.48, 50, kind); scr(w * 0.52, 0, w * 0.48, 56, kind === "graph" ? "code" : "graph");
  return p;
}
export function specimenTank() {
  const p = new Pic(70, 170);
  p.rect(8, 150, 54, 20, "#3a3e46", 3); p.rect(8, 6, 54, 10, "#3a3e46", 3);
  p.rect(12, 16, 46, 134, al("#5affb0", 0.35)); p.rect(12, 16, 46, 134, p.lin([al("#9affd0", 0.3), al("#2a8a6a", 0.6)]));
  p.path("M35 50q-10 0 -10 14q0 10 6 14l-4 30l8 -2l0 20h4l0 -20l8 2l-4 -30q6 -4 6 -14q0 -14 -10 -14z", "#1a4a3a");
  p.rect(16, 18, 4, 128, "#ffffff33");
  for (let k = 0; k < 6; k++) p.circ(20 + k * 6, 140 - k * 18, 1.8, "#d8fff0aa");
  p.mark("glow", 35, 80);
  return p;
}
export function filingCabinet(c = "#7a8088") {
  const p = new Pic(56, 120);
  p.box(0, 0, 56, 120, c, 2);
  for (let k = 0; k < 4; k++) { p.rect(4, 6 + k * 28, 48, 24, lt(c, 0.06), 1); p.rect(20, 14 + k * 28, 16, 4, CHROME, 2); p.rect(22, 20 + k * 28, 12, 5, "#f4efe4"); }
  p.path("M10 0q8 -14 30 -8l4 8z", "#f4efe4"); p.path("M14 -2l26 -6", "none");
  return p;
}
export function waterCooler() {
  const p = new Pic(50, 150);
  p.path("M10 60V18q0 -10 15 -10q15 0 15 10V60Z", al("#7ac8f0", 0.65)); p.rect(18, 2, 14, 8, "#2a6ab0", 2); p.rect(14, 22, 4, 34, "#ffffff55");
  p.box(6, 60, 38, 90, "#e8ecef", 2); p.rect(12, 76, 8, 6, "#3a6ab0", 1); p.rect(30, 76, 8, 6, "#c83a3a", 1); p.rect(10, 92, 30, 4, "#b8bcc4");
  p.mark("bubble", 25, 50);
  return p;
}
export function officeChair(c = "#1e2228") {
  const p = new Pic(70, 120);
  p.path("M16 60V14q0 -12 19 -12q19 0 19 12V60Z", c); p.path("M20 54V16q0 -8 15 -8", "none"); p.line("M22 52V16q0 -8 13 -9", lt(c, 0.2), 2);
  p.rect(10, 62, 50, 12, c, 5); p.rect(33, 74, 4, 26, CHROME);
  p.line("M35 100L10 110M35 100L60 110M35 100L22 114M35 100L48 114", CHROME, 3); for (const x of [10, 60, 22, 48]) p.circ(x, x === 22 || x === 48 ? 116 : 112, 3.5, "#1a1a1a");
  p.rect(4, 52, 8, 16, c, 3); p.rect(58, 52, 8, 16, dk(c, 0.2), 3);
  return p;
}
export function schoolDesks(r: Rng, n = 3, wood = "#c8a06a") {
  const p = new Pic(n * 110, 100);
  for (let i = 0; i < n; i++) {
    const x = i * 110 + 6;
    p.rect(x + 14, 38, 76, 7, wood, 2); p.rect(x + 14, 38, 76, 2, lt(wood, 0.3)); p.rect(x + 20, 45, 64, 16, STEEL);
    p.rect(x + 20, 61, 4, 39, "#5a5e66"); p.rect(x + 80, 61, 4, 39, "#4a4e56");
    p.rect(x, 50, 8, 50, "#4a6a9a", 2); p.rect(x - 2, 64, 30, 6, "#4a6a9a", 2);
    if (r() < 0.6) { const c = pick(r, BOOKS); p.rect(x + 30, 32, 28, 6, c, 1); p.rect(x + 31, 33, 25, 1.4, "#efe6cf"); }
    if (r() < 0.4) { p.circ(x + 72, 32, 6, "#d83a2a"); p.line(`M${x + 72} 26l1 -4`, "#5a3a1a", 1.5); p.leaf(x + 76, 23, 3.5, 1.6, -20, "#5a9a3a"); }
  }
  return p;
}
export function globeStand() {
  const p = new Pic(70, 100);
  p.path("M20 100l15 -20l15 20z", "#5a3a20"); p.rect(33, 66, 4, 16, "#5a3a20");
  p.circ(35, 36, 26, "#3a7ab0"); p.path("M18 24q8 -10 18 -4q4 8 -4 12q-6 8 -12 2zM40 40q10 -4 14 6q-2 10 -10 8q-6 -6 -4 -14zM30 50q4 6 0 10q-6 -2 -4 -8z", "#8ab05a");
  p.path("M14 22a26 26 0 0 1 18 -12", "none"); p.line("M16 20Q24 12 34 11", "#ffffff66", 2);
  p.raw(`<path d='M6 44a30 30 0 0 0 58 -16' fill='none' stroke='${BRASS}' stroke-width='3'/>`);
  return p;
}

// ── Healing and holding ──────────────────────────────────────────────────────
export function hospitalBed(blanket = "#8ab8d8") {
  const p = new Pic(240, 110);
  p.rect(6, 20, 8, 80, STEEL, 3); p.rect(226, 44, 8, 56, STEEL, 3); p.rect(10, 24, 2, 40, "#ffffff66");
  p.rect(10, 60, 222, 22, "#f2f4f4", 4); p.rect(10, 80, 222, 6, STEEL);
  p.path("M20 60Q18 44 32 42H72Q84 44 82 60Z", "#ffffff");
  p.path("M80 54Q160 48 232 58V84H80Z", blanket); for (let x = 96; x < 228; x += 18) p.line(`M${x} 56V84`, lt(blanket, 0.2), 1.5);
  p.rect(60, 64, 60, 3, "#c8ccd0");
  for (const x of [26, 214]) { p.rect(x - 2, 86, 4, 14, STEEL); p.circ(x, 104, 5, "#2a2a2a"); }
  return p;
}
export function ivStand() {
  const p = new Pic(50, 190);
  p.line("M25 20V184M10 186H40", STEEL, 3); p.line("M14 20H36", STEEL, 2.5);
  p.path("M18 22h14v32q0 6 -7 6q-7 0 -7 -6z", al("#e8f4ff", 0.75)); p.rect(19, 36, 12, 18, al("#cfe8ff", 0.9), 3); p.line("M25 60Q30 120 40 150", al("#cfe8ff", 0.9), 1.4);
  return p;
}
export function balloon(c = "#ff5a7a", text = "♥") {
  const p = new Pic(50, 120);
  p.line("M25 56Q20 80 28 100T24 120", "#888", 1);
  p.path("M25 2C42 2 48 20 44 32C40 46 30 52 25 56C20 52 10 46 6 32C2 20 8 2 25 2Z", c);
  p.ell(17, 16, 5, 8, "#ffffff55"); p.text(25, 36, 16, "#ffffffdd", text); p.path("M22 56h6l-3 4z", dk(c, 0.2));
  return p;
}
export function cot(blanket = "#6a6a5a", frame = "#5a5e66") {
  const p = new Pic(220, 70);
  p.rect(4, 30, 212, 20, "#d8d2c4", 3); p.path("M70 28Q140 22 216 30V50H70Z", blanket); p.path("M10 30Q8 20 22 18H56Q66 20 64 30Z", "#efeae0");
  p.rect(0, 48, 220, 6, frame); for (const x of [8, 206]) p.rect(x, 54, 6, 16, frame);
  return p;
}
export function tally(n = 23) {
  const p = new Pic(110, 60), c = "#e8e2d4bb";
  let x = 4, y = 4;
  for (let i = 0; i < n; i++) {
    if (i % 5 === 4) p.line(`M${x - 22} ${y + 18}L${x - 2} ${y + 2}`, c, 1.6);
    else p.line(`M${x} ${y}l${(i * 7) % 3 - 1} 20`, c, 1.6);
    x += i % 5 === 4 ? 10 : 5;
    if (x > 100) { x = 4; y += 30; }
  }
  return p;
}
export function cellBars(w = 260, h = 258) {
  const p = new Pic(w, h);
  p.rect(0, 30, w, 8, "#3a3c42"); p.rect(0, h - 40, w, 8, "#3a3c42");
  for (let x = 10; x < w; x += 26) { p.rect(x, 0, 7, h, "#4a4c54"); p.rect(x + 1.5, 0, 2, h, "#6a6c74"); }
  p.rect(w - 50, h * 0.5, 24, 30, "#3a3c42", 3); p.circ(w - 38, h * 0.5 + 14, 4, "#1a1a1a");
  return p;
}
export function bucket() { const p = new Pic(40, 40); p.path("M4 8L8 40H32L36 8Z", "#7a7e86"); p.ell(20, 8, 16, 4, "#5a5e66"); p.raw("<path d='M4 8Q20 -10 36 8' fill='none' stroke='#5a5e66' stroke-width='1.6'/>"); p.rect(4, 18, 32, 2, "#5a5e66"); return p; }
export function chains() { const p = new Pic(60, 90); p.rect(20, 0, 20, 8, IRON, 2); for (let k = 0; k < 7; k++) p.raw(`<ellipse cx='${30 + (k % 2) * 0}' cy='${12 + k * 10}' rx='${k % 2 ? 2.5 : 4.5}' ry='6' fill='none' stroke='#5a5c64' stroke-width='2.4'/>`); p.raw("<circle cx='30' cy='86' r='5' fill='none' stroke='#5a5c64' stroke-width='3'/>"); return p; }

// ── Ships and vehicles ───────────────────────────────────────────────────────
export function hammock(c = "#d8c8a0") {
  const p = new Pic(220, 80);
  p.line("M0 4L30 30M220 4L190 30", "#8a6a4a", 1.6);
  p.path("M30 30Q110 90 190 30Q110 70 30 30Z", c); for (let k = 1; k < 6; k++) p.line(`M${30 + k * 26} ${30 + Math.sin((k / 6) * Math.PI) * 26}Q${30 + k * 26} ${40} ${30 + k * 26} ${30 + Math.sin((k / 6) * Math.PI) * 34}`, dk(c, 0.15), 1);
  p.path("M60 40Q110 64 160 40Q120 56 60 40Z", "#6a4a8a");
  return p;
}
export function seaChest(wood = "#6a3a1e") {
  const p = new Pic(110, 70);
  p.path("M4 30Q4 4 55 4Q106 4 106 30Z", lt(wood, 0.08)); p.rect(4, 30, 102, 40, wood);
  for (const x of [20, 86]) p.rect(x - 4, 4, 8, 66, BRASS);
  p.rect(4, 28, 102, 4, BRASS); p.rect(48, 32, 14, 16, BRASS, 2); p.rect(53, 38, 4, 6, "#1a1a1a");
  p.rect(100, 30, 6, 40, dk(wood, 0.25));
  return p;
}
export function shipInBottle() {
  const p = new Pic(110, 60);
  p.rect(0, 50, 110, 6, "#6a4a2a"); p.rect(16, 44, 8, 6, "#5a3a20"); p.rect(84, 44, 8, 6, "#5a3a20");
  p.path("M10 30Q10 16 24 16H74L84 22H96V34H84L74 40H24Q10 40 10 30Z", al(GLASS, 0.35)); p.rect(96, 22, 8, 12, "#8a5a32", 2);
  p.path("M28 34h40l-6 4h-28z", "#5a3a20"); p.line("M40 34V18M54 34V20", "#3a2a1a", 1); p.path("M40 20l10 12h-10zM54 22l8 10h-8z", "#f4efe4");
  p.path("M14 38q30 -6 64 0", "#3a7ab0"); p.line("M16 22q20 -4 50 -2", "#ffffff88", 1.5);
  return p;
}
export function captainChair(c = "#2a2e38") {
  const p = new Pic(120, 130);
  p.path("M26 80V16Q26 2 60 2Q94 2 94 16V80Z", c); p.path("M34 76V18Q34 10 60 10Q86 10 86 18V76Z", lt(c, 0.08));
  p.rect(14, 64, 92, 18, c, 6); p.rect(4, 56, 22, 12, lt(c, 0.12), 4); p.rect(94, 56, 22, 12, c, 4);
  p.rect(6, 58, 6, 4, "#ff4a4a"); p.rect(14, 58, 6, 4, "#4aff9a"); p.rect(98, 58, 6, 4, "#4ad0ff"); p.rect(106, 58, 6, 4, "#ffd24a");
  p.rect(54, 82, 12, 30, "#3a3e48"); p.path("M30 130l30 -18l30 18z", "#3a3e48");
  return p;
}
export function consoles(r: Rng, w = 300) {
  const p = new Pic(w, 80);
  p.path(`M0 80V36L20 20H${w - 20}L${w} 36V80Z`, "#1e232c"); p.path(`M20 20H${w - 20}L${w} 36H0Z`, "#2c3440");
  for (let x = 16; x < w - 16; x += 9) for (let y = 26; y < 34; y += 5) if (r() < 0.6) p.rect(x, y, 5, 2.5, pick(r, ["#ff5a5a", "#5aff9a", "#5ad0ff", "#ffd25a", "#5ad0ff"]));
  for (let k = 0; k < 3; k++) { const x = 30 + k * (w - 60) / 3; p.rect(x, 44, (w - 120) / 3, 24, "#0a2a3a", 2); p.line(`M${x + 4} 60l10 -8l8 4l12 -10l10 6`, "#5ad0ff", 1.2); p.mark("screen", x + (w - 120) / 6, 56); }
  return p;
}
export function fuzzyDice() {
  const p = new Pic(50, 80);
  p.line("M25 0V30M25 30L14 46M25 30L36 50", "#e8e0d0", 1);
  const die = (x: number, y: number, deg: number, c: string) => { p.raw(`<g transform='rotate(${deg} ${x} ${y})'>`); p.rect(x - 9, y - 9, 18, 18, c, 5); for (const [dx, dy] of [[-4, -4], [4, 4], [0, 0]]) p.circ(x + dx, y + dy, 1.8, "#ffffff"); p.raw("</g>"); };
  die(14, 54, -14, "#e83a6a"); die(36, 60, 18, "#3a8ae8");
  return p;
}
export function airFreshener() {
  const p = new Pic(30, 60); p.line("M15 0V14", "#e8e0d0", 1);
  p.path("M15 14l-8 12h4l-7 10h5l-6 12h24l-6 -12h5l-7 -10h4z", "#2ac05a"); p.rect(13, 48, 4, 6, "#2a8a4a");
  return p;
}
export function wiper() { const p = new Pic(300, 20); p.rect(0, 8, 300, 4, "#0a0a0c", 2); p.rect(0, 6, 300, 2, "#1a1a1e"); return p; }
export function trainSeat(c = "#6a2a2a", face: "l" | "r" = "l") {
  const p = new Pic(90, 150);
  const m = (x: number) => (face === "l" ? x : 90 - x);
  p.path(`M${m(10)} 150V30Q${m(10)} 10 ${m(30)} 10H${m(60)}Q${m(80)} 10 ${m(80)} 30V150Z`, c);
  p.path(`M${m(16)} 140V34Q${m(16)} 18 ${m(32)} 18H${m(58)}Q${m(74)} 18 ${m(74)} 34V140Z`, lt(c, 0.08));
  for (let y = 30; y < 140; y += 14) p.line(`M${m(18)} ${y}H${m(72)}`, dk(c, 0.15), 1.2);
  p.rect(face === "l" ? 30 : 30, 18, 30, 16, "#efe6d6", 2);
  return p;
}
export function luggageRack(r: Rng, w = 360) {
  const p = new Pic(w, 70);
  p.rect(0, 44, w, 4, BRASS); p.rect(0, 60, w, 3, BRASS); for (let x = 6; x < w; x += 14) p.rect(x, 48, 1.5, 12, BRASS);
  for (let k = 0; k < 4; k++) { const x = 20 + k * (w / 4) + between(r, -10, 10), c = pick(r, ["#7a4a2a", "#3a4a6a", "#8a2a2a", "#c8a46a", "#2a4a3a"]), bw = between(r, 50, 70), bh = between(r, 24, 40); p.box(x, 44 - bh, bw, bh, c, 4); p.rect(x + bw * 0.3, 44 - bh - 5, bw * 0.4, 5, dk(c, 0.3), 2); p.rect(x + 6, 44 - bh, 4, bh, lt(c, 0.25)); p.rect(x + bw - 12, 44 - bh, 4, bh, lt(c, 0.25)); if (r() < 0.5) p.rect(x + bw * 0.6, 44 - bh * 0.7, 12, 8, "#f4efe4", 1); }
  return p;
}
export function tv(on = true) {
  const p = new Pic(160, 120);
  p.rect(10, 0, 140, 82, "#141418", 4); p.rect(14, 4, 132, 74, on ? p.lin(["#5a8ad8", "#3a5aa8", "#2a2a5a"]) : "#1a1c22");
  if (on) { p.circ(110, 30, 12, "#ffe08a"); p.path("M14 78L50 44L76 62L104 38L146 70V78Z", "#3a7a5a"); p.rect(20, 66, 50, 6, "#ffffffaa", 2); }
  p.path("M18 8L60 8L26 40Z", "#ffffff14");
  p.rect(0, 96, 160, 8, "#5a3a22", 2); p.rect(4, 104, 152, 16, "#4a2e1a"); p.rect(10, 108, 66, 9, "#3a2414"); p.rect(84, 108, 66, 9, "#3a2414");
  p.rect(70, 82, 20, 14, "#141418");
  p.mark("screen", 80, 40);
  return p;
}
export function speaker(h = 150) {
  const p = new Pic(70, h);
  p.box(0, 0, 70, h, "#1a1a1e", 3);
  for (let y = 12; y < h - 20; y += 60) { p.circ(35, y + 22, 22, "#2a2a30"); p.circ(35, y + 22, 18, "#0a0a0c"); p.circ(35, y + 22, 7, "#3a3a42"); }
  p.circ(35, h - 14, 6, "#2a2a30");
  return p;
}
export function djBooth(r: Rng) {
  const p = new Pic(220, 100);
  p.path("M0 100V40H220V100Z", "#14141a"); p.rect(0, 36, 220, 8, "#2a2a34");
  for (let x = 6; x < 214; x += 10) p.rect(x, 50, 6, 2, pick(r, ["#ff4fd8", "#4ff0ff", "#ffd24a"]));
  for (const x of [50, 170]) { p.ell(x, 32, 30, 7, "#2a2a30"); p.ell(x, 31, 24, 5.5, "#0a0a0c"); p.ell(x, 31, 6, 1.5, "#d83a3a"); }
  p.rect(92, 22, 36, 14, "#2a2a30", 2); for (let k = 0; k < 5; k++) p.rect(96 + k * 6, 26, 2, 7, "#9aa0aa");
  p.text(110, 82, 18, "#ff4fd8", "♫");
  return p;
}
export function neon(text: string, c = "#ff4fd8", w = 140, h = 50, font = "Arial,Helvetica,sans-serif", italic = false) {
  const p = new Pic(w, h);
  p.rect(2, 2, w - 4, h - 4, "#0a0a10cc", 8);
  p.raw(`<text x='${w / 2}' y='${h * 0.7}' font-size='${h * 0.55}' text-anchor='middle' font-family='${font}' font-weight='700'${italic ? " font-style='italic'" : ""} fill='none' stroke='${c}' stroke-width='5' stroke-opacity='.35'>${text}</text>`);
  p.raw(`<text x='${w / 2}' y='${h * 0.7}' font-size='${h * 0.55}' text-anchor='middle' font-family='${font}' font-weight='700'${italic ? " font-style='italic'" : ""} fill='none' stroke='${lt(c, 0.55)}' stroke-width='2'>${text}</text>`);
  return p;
}

// ── Food and drink ───────────────────────────────────────────────────────────
export function fridge(r: Rng, c = "#e8ecef") {
  const p = new Pic(80, 190);
  p.box(0, 0, 80, 190, c, 6); p.rect(2, 66, 76, 3, dk(c, 0.15)); p.rect(66, 30, 4, 28, "#9aa0aa", 2); p.rect(66, 80, 4, 40, "#9aa0aa", 2);
  for (let k = 0; k < 6; k++) { const x = 8 + r() * 48, y = 76 + r() * 90; if (r() < 0.5) { p.raw(`<g transform='rotate(${f1(between(r, -8, 8))} ${f1(x)} ${f1(y)})'>`); p.rect(x, y, 22, 26, pick(r, ["#f4efe4", "#fff4a0", "#cde8ff"])); p.line(`M${x + 4} ${y + 18}l4 -8l4 4l6 -6`, pick(r, ["#e83a3a", "#3a7ae8", "#2a9a4a"]), 1.4); p.raw("</g>"); } else p.circ(x, y, 4, pick(r, ["#e83a3a", "#3a7ae8", "#f4c42a", "#2a9a4a"])); }
  return p;
}
export function espresso() {
  const p = new Pic(110, 100);
  p.rect(6, 20, 98, 70, "#c8ccd4", 6); p.rect(6, 20, 98, 6, "#e8ecf0", 4); p.rect(94, 20, 10, 70, "#a8acb4", 4);
  p.rect(14, 30, 82, 16, "#2a2c32", 3); p.circ(30, 38, 5, "#d8dade"); p.circ(80, 38, 5, "#d8dade"); p.circ(55, 38, 4, "#ff6a3a");
  for (const x of [32, 76]) { p.rect(x - 9, 48, 18, 7, "#2a2c32", 2); p.rect(x - 3, 55, 6, 6, "#4a4c52"); p.rect(x - 7, 70, 14, 12, "#f4efe4", 2); p.mark("steam", x, 68); }
  p.rect(10, 84, 90, 6, "#5a5e66", 2); p.path("M30 20V6q0 -4 4 -4h42q4 0 4 4v14z", "#2a2c32");
  for (let k = 0; k < 5; k++) p.rect(36 + k * 8, 8, 4, 10, ["#c84a3a", "#f4efe4", "#3a6a9a", "#f4efe4", "#e8b84a"][k], 1);
  return p;
}
export function pastryCase(r: Rng, w = 160) {
  const p = new Pic(w, 90);
  p.rect(0, 30, w, 60, "#5a3a22"); p.rect(0, 30, w, 4, "#7a5232");
  p.path(`M6 30V8Q6 2 14 2H${w - 14}Q${w - 6} 2 ${w - 6} 8V30Z`, al(GLASS, 0.3)); p.rect(10, 4, 3, 24, "#ffffff66");
  for (const y of [16, 28]) { p.rect(8, y, w - 16, 2, "#d8dade"); for (let x = 14; x < w - 20; x += 22) { const k = Math.floor(r() * 4); if (k === 0) { p.ell(x + 8, y - 4, 9, 4, "#d8a05a"); p.ell(x + 8, y - 6, 7, 2.5, "#e8b86a"); } else if (k === 1) { p.path(`M${x} ${y}q8 -14 16 0z`, "#e8c48a"); p.circ(x + 8, y - 5, 2, "#c82a3a"); } else if (k === 2) { p.rect(x, y - 8, 16, 8, "#f0d8b8", 2); p.rect(x, y - 8, 16, 3, "#a85a3a", 1); } else { p.path(`M${x} ${y}q4 -10 8 -6q4 -4 8 6z`, "#d8a05a"); } } }
  for (let x = 12; x < w - 10; x += 30) p.rect(x, 44, 20, 3, "#7a5232");
  return p;
}
export function booth(c = "#c8283a") {
  const p = new Pic(180, 110);
  p.path("M0 110V24Q0 6 18 6H40Q50 6 50 24V70H130V24Q130 6 140 6H162Q180 6 180 24V110Z", c);
  for (const x of [8, 22, 36, 138, 152, 166]) p.line(`M${x} 14V66`, dk(c, 0.18), 1.5);
  p.rect(0, 66, 180, 14, lt(c, 0.12), 4); p.rect(0, 80, 180, 30, dk(c, 0.25));
  p.rect(56, 44, 68, 8, "#e8e4dc", 2); p.rect(56, 44, 68, 2, CHROME); p.rect(86, 52, 8, 58, CHROME);
  p.rect(64, 30, 10, 14, "#f4efe4", 1); p.rect(65, 26, 8, 4, "#d83a2a", 1); p.path("M98 44v-12q0 -4 6 -4h4q6 0 6 4v12z", "#e8d8a8"); p.rect(102, 30, 2, 4, "#5a3a1a");
  return p;
}
export function jukebox() {
  const p = new Pic(90, 150);
  p.path("M4 150V50Q4 4 45 4Q86 4 86 50V150Z", "#6a2a1a");
  p.path("M12 150V52Q12 14 45 14Q78 14 78 52V150Z", p.lin(["#ff5a3a", "#ffd24a", "#5affb0", "#4ad0ff", "#d84aff"], true));
  p.path("M20 150V56Q20 24 45 24Q70 24 70 56V150Z", "#2a1410");
  p.rect(24, 50, 42, 30, "#f4e8c8", 4); for (let k = 0; k < 5; k++) p.rect(28, 54 + k * 5, 34, 2, "#c84a3a");
  p.rect(24, 88, 42, 40, "#c8ccd4", 3); for (let y = 92; y < 126; y += 6) p.rect(28, y, 34, 2, "#8a8e96");
  p.circ(45, 140, 5, "#ffd24a");
  p.mark("glow", 45, 40);
  return p;
}
export function pie() { const p = new Pic(60, 50); p.rect(4, 44, 52, 4, CHROME, 2); p.path("M6 44Q6 8 30 6Q54 8 54 44Z", al(GLASS, 0.35)); p.path("M10 44l3 -10h34l3 10z", "#d8a05a"); p.path("M10 34h40l-20 8z", "#c84a5a"); p.rect(28, 2, 4, 6, CHROME, 2); return p; }

// ── Theatre and music ────────────────────────────────────────────────────────
export function ghostLight() {
  const p = new Pic(50, 160);
  p.path("M10 160l15 -22l15 22z", "#1a1a1e"); p.rect(23, 30, 4, 110, "#2a2a2e");
  p.raw("<path d='M14 30Q14 6 25 6Q36 6 36 30Z' fill='none' stroke='#3a3a40' stroke-width='2'/>");
  p.path("M19 18h12q4 10 -1 16h-10q-5 -6 -1 -16z", "#fff4cc"); p.ell(25, 24, 4, 6, "#ffffff");
  p.mark("glow", 25, 24);
  return p;
}
export function micStand() {
  const p = new Pic(80, 200);
  p.line("M40 200l-24 -6M40 200l24 -6M40 200V70M40 70L58 40", "#2a2a2e", 3);
  p.rect(52, 22, 16, 28, "#3a3a40", 7); p.rect(54, 24, 12, 18, "#8a8e96", 5); for (let k = 0; k < 4; k++) p.rect(55, 26 + k * 4, 10, 1, "#5a5e66");
  p.raw("<circle cx='30' cy='34' r='16' fill='#1a1a1a55' stroke='#2a2a2e' stroke-width='2'/>"); p.line("M42 46Q44 40 38 40", "#2a2a2e", 1.5);
  return p;
}
export function mixingDesk(r: Rng, w = 260) {
  const p = new Pic(w, 70);
  p.path(`M0 70V30L16 10H${w - 16}L${w} 30V70Z`, "#2a2c32"); p.path(`M16 10H${w - 16}L${w} 30H0Z`, "#3a3e46");
  for (let x = 20; x < w - 20; x += 12) { p.rect(x, 14, 2, 14, "#1a1a1a"); p.rect(x - 3, 14 + r() * 10, 8, 4, "#d8dade", 1); p.circ(x + 1, 36, 2.6, pick(r, ["#e83a3a", "#3a8ae8", "#e8c43a", "#9aa0aa"])); for (let k = 0; k < 4; k++) p.rect(x - 1, 46 + k * 4, 4, 2, k === 0 && r() < 0.3 ? "#ff3a3a" : k < 2 ? "#ffd24a" : "#4aff7a"); }
  for (let x = 20; x < w - 20; x += 12) p.mark("led", x + 1, 50);
  return p;
}
export function guitar(c = "#c86a2a") {
  const p = new Pic(60, 170);
  p.path("M20 170l10 -10l10 10z", "#2a2a2e");
  p.rect(27, 6, 6, 80, "#3a2414"); p.rect(24, 0, 12, 14, "#2a1a10", 2); for (let k = 0; k < 6; k++) p.circ(k % 2 ? 37 : 23, 3 + Math.floor(k / 2) * 4, 1.5, CHROME);
  p.path("M30 76C14 76 12 92 18 102C8 110 6 140 30 150C54 140 52 110 42 102C48 92 46 76 30 76Z", c);
  p.path("M30 76C46 76 48 92 42 102C52 110 54 140 30 150Z", dk(c, 0.18));
  p.circ(30, 104, 7, "#1a1010"); p.rect(22, 128, 16, 4, "#2a1a10"); p.line("M28 10V130M30 10V130M32 10V130", "#e8e8e8aa", 0.5);
  return p;
}
export function onAir() {
  const p = new Pic(100, 40);
  p.rect(0, 0, 100, 40, "#1a1a1e", 6); p.rect(4, 4, 92, 32, "#e8283a", 4); p.rect(4, 4, 92, 14, "#ff5a6a", 4);
  p.text(50, 28, 18, "#fff4f0", "ON AIR");
  return p;
}

// ── Old houses ───────────────────────────────────────────────────────────────
export function trunk(c = "#5a3a5a") {
  const p = new Pic(130, 80);
  p.path("M4 34Q4 6 65 6Q126 6 126 34Z", lt(c, 0.08)); p.rect(4, 34, 122, 46, c);
  for (const x of [24, 106]) p.rect(x - 5, 6, 10, 74, "#8a6a3a"); p.rect(4, 32, 122, 5, "#8a6a3a");
  p.rect(58, 36, 14, 16, BRASS, 2); p.circ(65, 44, 2.5, "#1a1a1a");
  p.rect(120, 34, 6, 46, dk(c, 0.25)); p.path("M60 6q4 -6 10 0", "none");
  p.path("M30 34q4 -6 20 -4l-2 6z", "#f4efe4");
  return p;
}
export function dressForm(c = "#c8a8a0") {
  const p = new Pic(70, 190);
  p.path("M20 190l15 -14l15 14zM35 176V120", "#3a2a1a"); p.line("M35 176V116", "#3a2a1a", 4);
  p.path("M18 116Q10 90 16 70Q14 46 20 30Q26 22 35 22Q44 22 50 30Q56 46 54 70Q60 90 52 116Z", c);
  p.path("M35 22Q44 22 50 30Q56 46 54 70Q60 90 52 116H44Q52 80 44 30Z", dk(c, 0.15));
  p.rect(31, 12, 8, 10, "#3a2a1a", 2); p.circ(35, 10, 4, "#5a3a2a");
  p.line("M20 64Q35 70 52 64", "#8a5a6a", 1.5); for (let k = 0; k < 4; k++) p.circ(26 + k * 7, 52 + k * 3, 1.5, "#d8d0c0");
  p.path("M14 70q-6 30 -2 60q10 -6 8 -40z", "#8a3a5a");
  return p;
}
export function rockingHorse(c = "#e8e0d0") {
  const p = new Pic(130, 110);
  p.path("M4 92Q65 120 126 92", "none"); p.raw("<path d='M4 96Q65 118 126 96' fill='none' stroke='#8a3a2a' stroke-width='6' stroke-linecap='round'/>");
  for (const x of [30, 46, 84, 100]) p.line(`M${x} 70L${x + (x < 65 ? -6 : 6)} 102`, c, 6);
  p.ell(65, 62, 42, 14, c); p.path("M96 54Q110 30 104 16Q112 10 120 18Q126 28 116 34Q112 50 104 64Z", c);
  p.circ(112, 22, 2, "#1a1a1a"); p.path("M100 14Q90 30 92 52L98 50Q96 34 104 20Z", "#8a3a2a");
  p.path("M24 56Q10 52 8 70Q16 64 26 66Z", "#8a3a2a"); p.rect(50, 46, 30, 8, "#c83a3a", 3); for (const x of [40, 60, 80]) p.circ(x, 66, 3, "#3a6ab0");
  return p;
}
export function cobweb(corner: "l" | "r" = "l") {
  const p = new Pic(90, 90), m = (x: number) => (corner === "l" ? x : 90 - x), c = "#e8e8f088";
  for (const a of [0, 22, 45, 68, 90]) { const rad = (a * Math.PI) / 180; p.line(`M${m(0)} 0L${m(Math.cos(rad) * 88)} ${Math.sin(rad) * 88}`, c, 0.8); }
  for (const R of [18, 34, 52, 70]) { let d = ""; for (let k = 0; k < 5; k++) { const a1 = (k * 22.5 * Math.PI) / 180, a2 = ((k + 1) * 22.5 * Math.PI) / 180; if (k === 4) break; d += `M${m(Math.cos(a1) * R)} ${Math.sin(a1) * R}Q${m(Math.cos((a1 + a2) / 2) * R * 0.85)} ${Math.sin((a1 + a2) / 2) * R * 0.85} ${m(Math.cos(a2) * R)} ${Math.sin(a2) * R}`; } p.line(d, c, 0.7); }
  p.circ(m(48), 40, 3, "#1a1a1a"); p.line(`M${m(48)} 40l${corner === "l" ? 4 : -4} 4M${m(48)} 40l${corner === "l" ? -4 : 4} 4`, "#1a1a1a", 0.8);
  return p;
}
export function sheetMirror() {
  const p = new Pic(80, 150);
  p.path("M10 150L14 20Q16 2 40 2Q64 2 66 20L70 150Q56 140 40 146Q24 140 10 150Z", "#e8e2d6");
  p.line("M30 20Q26 80 22 146M50 20Q54 90 56 144", "#c8c0b0", 1.5); p.path("M46 4q14 2 18 16l4 40q-8 -30 -22 -56z", "#f8f4ec");
  return p;
}
export function wineRack(r: Rng, cols = 6, rows = 5) {
  const p = new Pic(cols * 22 + 8, rows * 22 + 8);
  p.rect(0, 0, cols * 22 + 8, rows * 22 + 8, "#4a2e18");
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = 4 + i * 22, y = 4 + j * 22;
    p.rect(x, y, 20, 20, "#1a0e06");
    if (r() < 0.8) { const c = pick(r, ["#2a4a1a", "#3a1a1a", "#1a2a1a", "#4a3a12"]); p.circ(x + 10, y + 10, 8, c); p.circ(x + 10, y + 10, 3.5, pick(r, ["#c83a3a", "#d8b44a", "#1a1a1a"])); p.circ(x + 7, y + 7, 2, "#ffffff44"); }
  }
  return p;
}

// ── Gardens indoors ──────────────────────────────────────────────────────────
export function plantBench(r: Rng, w = 260) {
  const p = new Pic(w, 110), T = 60;
  p.rect(0, T, w, 6, "#8a6a42"); p.rect(0, T + 26, w, 4, "#7a5a36"); for (const x of [6, w - 12]) p.rect(x, T, 6, 50, "#6a4a2a");
  let x = 10;
  while (x < w - 30) {
    const pc = pick(r, ["#c06a3a", "#d8835a", "#b85a32"]), s = between(r, 0.7, 1.1);
    p.path(`M${x} ${T}l3 -${16 * s}h${20 * s}l3 ${16 * s}z`, pc); p.rect(x - 1, T - 16 * s - 3, 28 * s, 4, lt(pc, 0.15), 1.5);
    const cx = x + 13 * s, k = Math.floor(r() * 3);
    if (k === 0) for (let j = 0; j < 7; j++) p.leaf(cx + between(r, -12, 12), T - 16 * s - between(r, 6, 26), 8, 3, between(r, -70, 70), j % 2 ? "#4a8a46" : "#3a7a3e");
    else if (k === 1) { for (let j = 0; j < 5; j++) p.line(`M${cx} ${T - 16 * s}q${between(r, -10, 10)} -10 ${between(r, -14, 14)} -${between(r, 18, 32)}`, "#4a7a3a", 1.3); for (let j = 0; j < 5; j++) p.circ(cx + between(r, -12, 12), T - 16 * s - between(r, 16, 30), 4, pick(r, ["#f46a7a", "#f4c84a", "#f4f0e8", "#b46ad8"])); }
    else { p.path(`M${cx - 6} ${T - 16 * s}q-2 -26 6 -30q8 4 6 30z`, "#5a9a5a"); for (let j = 0; j < 4; j++) p.circ(cx - 4 + j * 2.5, T - 16 * s - 8 - j * 5, 0.8, "#f4f0e8"); }
    x += 32 * s + between(r, 2, 8);
  }
  p.path(`M${w - 70} ${T + 26}l4 -18h22l4 18z`, "#c06a3a"); p.path(`M${w - 46} ${T + 26}h18l2 -14h-22z`, "#5a8ab0");
  return p;
}
export function wateringCan(c = "#5a9a8a") {
  const p = new Pic(70, 50);
  p.path("M14 50V22Q14 16 30 16Q46 16 46 22V50Z", c); p.line("M46 40L66 18", c, 4); p.ell(66, 17, 4, 2.5, dk(c, 0.2));
  p.raw(`<path d='M20 16Q30 0 40 16' fill='none' stroke='${dk(c, 0.2)}' stroke-width='3'/>`); p.rect(40, 16, 6, 34, dk(c, 0.2));
  return p;
}
export function butterfly(c = "#ff8a2a") {
  const p = new Pic(30, 22);
  p.ell(9, 8, 8, 7, c); p.ell(21, 8, 8, 7, c); p.ell(10, 16, 5, 5, dk(c, 0.15)); p.ell(20, 16, 5, 5, dk(c, 0.15));
  p.circ(8, 7, 2, "#1a1a1a"); p.circ(22, 7, 2, "#1a1a1a"); p.rect(14, 4, 2, 16, "#1a1a1a", 1);
  return p;
}

// ── Shops, baths, shrines ────────────────────────────────────────────────────
export function shopBell() { const p = new Pic(40, 60); p.line("M20 0V10M8 10H32", "#2a2a2a", 1.6); p.line("M20 10V22", "#2a2a2a", 1.2); p.path("M10 44Q10 24 20 22Q30 24 30 44H34V48H6V44Z", GOLD); p.circ(20, 52, 3.5, dk(GOLD, 0.2)); p.line("M14 30Q16 26 20 25", "#ffffff88", 1.5); return p; }
export function scale() { const p = new Pic(90, 80); p.path("M30 80h30l-4 -6h-22z", BRASS); p.rect(43, 20, 4, 54, BRASS); p.line("M10 22H80", BRASS, 3); p.circ(45, 18, 4, BRASS); for (const x of [16, 74]) { p.line(`M${x} 22L${x - 10} 46M${x} 22L${x + 10} 46`, "#5a5a5a", 0.8); p.path(`M${x - 14} 46h28q-2 6 -14 6q-12 0 -14 -6z`, BRASS); } p.circ(14, 42, 4, "#d83a2a"); p.circ(20, 41, 4, "#6aa03a"); return p; }
export function clawTub(r: Rng) {
  const p = new Pic(230, 110);
  p.path("M10 30H220Q226 30 220 44Q206 96 160 98H70Q24 96 10 44Q4 30 10 30Z", "#f4f2ee");
  p.path("M10 30H220Q226 30 220 44Q210 40 200 38H30Q20 40 10 44Q4 30 10 30Z", "#d8d6d2");
  p.path("M150 36Q206 40 214 50Q200 92 160 96H140Z", "#dcdad6");
  for (let k = 0; k < 16; k++) p.circ(30 + k * 11 + between(r, -4, 4), 28 + between(r, -6, 2), between(r, 5, 11), al("#ffffff", 0.92));
  for (let k = 0; k < 8; k++) p.circ(40 + k * 20, 18 + between(r, -6, 4), between(r, 3, 7), al("#e8f4ff", 0.85));
  p.path("M40 92l-12 18h14l8 -14zM190 92l12 18h-14l-8 -14z", GOLD);
  p.rect(210, 0, 6, 34, CHROME, 2); p.path("M196 2h20v6h-16z", CHROME);
  p.mark("duck", 150, 22);
  return p;
}
export function towelRack(c = "#7ab0c8") {
  const p = new Pic(70, 110);
  p.line("M8 110V10M62 110V10M8 20H62", CHROME, 3);
  p.path("M12 18H58V80Q35 86 12 80Z", c); for (const y of [64, 70]) p.rect(12, y, 46, 3, lt(c, 0.4));
  p.rect(12, 18, 46, 6, lt(c, 0.2));
  return p;
}
export function lowTable(r: Rng) {
  const p = new Pic(170, 70), T = 40;
  p.rect(10, T + 6, 10, 24, "#3a1a10"); p.rect(150, T + 6, 10, 24, "#2a1008"); p.rect(0, T, 170, 8, "#5a2a18", 2); p.rect(0, T, 170, 2, "#7a3a24");
  p.ell(60, T - 9, 14, 10, "#3a4a3a"); p.path(`M74 ${T - 12}l10 -6l1 2l-8 7z`, "#3a4a3a"); p.rect(55, T - 21, 10, 3, "#2a3a2a", 1); p.mark("steam", 84, T - 20);
  for (const x of [96, 116]) { p.path(`M${x - 7} ${T}l1 -10h12l1 10z`, "#e8e0d0"); p.rect(x - 6, T - 9, 12, 2, "#5a8a4a"); }
  p.rect(130, T - 4, 30, 4, "#1a1a1a", 1); p.rect(134, T - 6, 22, 2, "#3a2a20");
  void r;
  return p;
}
export function zabuton(c = "#7a2a3a") { const p = new Pic(90, 24); p.ell(45, 14, 44, 10, dk(c, 0.2)); p.ell(45, 11, 42, 9, c); p.circ(45, 11, 2.5, GOLD); return p; }
export function scroll(r: Rng) {
  const p = new Pic(50, 150);
  p.line("M25 0L10 10M25 0L40 10", "#3a2a1a", 1); p.rect(4, 8, 42, 5, "#3a2a1a", 2);
  p.rect(8, 13, 34, 124, "#6a5a3a"); p.rect(11, 22, 28, 100, "#efe6d0");
  const k = Math.floor(r() * 3);
  if (k === 0) { p.path("M14 110Q22 80 20 60Q30 70 36 110Z", "#3a3a3a"); p.path("M18 74Q26 60 34 70", "none"); p.line("M14 60Q25 50 36 56", "#3a3a3a", 1.5); p.circ(32, 34, 7, "#c83a2a"); }
  else if (k === 1) for (let j = 0; j < 4; j++) p.line(`M25 ${32 + j * 22}q-6 4 0 10q6 4 0 8`, "#1a1a1a", 3);
  else { p.line("M14 118L34 30", "#3a5a3a", 2); for (let j = 0; j < 6; j++) p.leaf(18 + j * 3, 104 - j * 14, 8, 2.4, -50 + (j % 2) * 100, "#3a5a3a"); }
  p.rect(4, 136, 42, 6, "#3a2a1a", 3);
  return p;
}
export function ikebana(r: Rng) {
  const p = new Pic(70, 100);
  p.path("M20 100l4 -18h22l4 18z", "#2a3a4a");
  p.line("M35 82Q30 40 14 20M35 82Q40 50 56 34M35 82Q36 60 34 44", "#5a3a2a", 1.5);
  for (const [x, y] of [[14, 20], [56, 34], [34, 44], [22, 34]] as [number, number][]) { for (let k = 0; k < 5; k++) p.leaf(x + Math.cos(k * 1.26) * 4, y + Math.sin(k * 1.26) * 4, 4, 2.4, k * 72, pick(r, ["#f4b4c4", "#f4f0e8"])); p.circ(x, y, 1.6, "#d84a6a"); }
  return p;
}

// ── New rooms ────────────────────────────────────────────────────────────────
export function telescope() {
  const p = new Pic(200, 200);
  p.line("M100 200L70 120M100 200L130 120M100 200V120", "#3a3a40", 4); p.line("M80 160H120", "#3a3a40", 2);
  p.rect(92, 112, 16, 14, "#2a2a30", 3);
  p.raw("<g transform='rotate(-38 100 110)'>"); p.rect(36, 96, 150, 28, p.lin(["#e8c46a", "#a8822a", "#d8b45a"])); p.rect(180, 92, 18, 36, "#8a6a2a", 3); p.rect(20, 102, 20, 16, "#5a4a2a", 2); p.rect(70, 94, 8, 32, "#8a6a2a"); p.rect(130, 94, 8, 32, "#8a6a2a"); p.rect(60, 88, 50, 6, "#a8822a", 2); p.raw("</g>");
  return p;
}
export function orrery() {
  const p = new Pic(110, 110);
  p.path("M40 110h30l-6 -10h-18z", BRASS); p.rect(53, 56, 4, 46, BRASS);
  p.raw(`<ellipse cx='55' cy='56' rx='50' ry='14' fill='none' stroke='${BRASS}' stroke-width='1.6'/><ellipse cx='55' cy='56' rx='32' ry='9' fill='none' stroke='${BRASS}' stroke-width='1.6'/><ellipse cx='55' cy='56' rx='18' ry='5' fill='none' stroke='${BRASS}' stroke-width='1.6'/>`);
  p.circ(55, 56, 9, "#ffc84a"); p.circ(52, 53, 3, "#fff2c0");
  p.circ(7, 58, 5, "#5a8ad8"); p.circ(86, 61, 4, "#d85a3a"); p.circ(68, 51, 3, "#c8a86a"); p.circ(103, 52, 6, "#d8b87a"); p.raw(`<ellipse cx='103' cy='52' rx='10' ry='2.5' fill='none' stroke='#d8b87a' stroke-width='1.2'/>`);
  p.mark("glow", 55, 56);
  return p;
}
export function starChart() {
  const p = new Pic(110, 110);
  p.circ(55, 55, 54, "#2a2014"); p.circ(55, 55, 50, "#1a2a4a");
  p.raw(`<circle cx='55' cy='55' r='38' fill='none' stroke='${GOLD}' stroke-width='.8'/><circle cx='55' cy='55' r='22' fill='none' stroke='${GOLD}' stroke-width='.8'/>`);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; p.line(`M${55 + Math.cos(a) * 38} ${55 + Math.sin(a) * 38}L${55 + Math.cos(a) * 50} ${55 + Math.sin(a) * 50}`, GOLD, 0.8); }
  const stars: [number, number][] = [[30, 40], [42, 30], [58, 36], [70, 28], [76, 50], [64, 66], [44, 70], [34, 60]];
  p.line(`M${stars.slice(0, 5).map(([x, y]) => `${x} ${y}`).join("L")}M64 66L44 70L34 60`, "#f4e8c8aa", 0.8);
  for (const [x, y] of stars) p.circ(x, y, 2, "#fff4d0");
  return p;
}
export function arcadeCab(r: Rng, c = "#3a2a8a") {
  const p = new Pic(80, 170), scr = pick(r, ["invaders", "maze", "race"]);
  p.path("M6 170V20L14 0H66L74 20V170Z", c); p.path("M66 0L74 20V170H66Z", dk(c, 0.3));
  p.rect(10, 6, 56, 18, pick(r, ["#ff4fd8", "#ffd24a", "#4ff0ff"]), 2); p.text(38, 20, 11, "#1a1a1a", pick(r, ["★ZAP★", "GALAX", "PAC!", "TURBO"]));
  p.path("M10 30H66V94H10Z", "#0a0a14"); p.rect(14, 34, 48, 56, "#06101a");
  if (scr === "invaders") { for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) p.path(`M${20 + i * 11} ${42 + j * 9}h6v2h2v3h-10v-3h2z`, ["#5aff7a", "#ff5ad8", "#5ad0ff"][j]); p.path("M34 84h8v-3h-2v-3h-4v3h-2z", "#ffd24a"); }
  else if (scr === "maze") { p.raw("<path d='M18 40h40v44h-40zM26 48h24M26 58v18h24M38 58v10' fill='none' stroke='#3a5aff' stroke-width='2'/>"); p.path("M22 72a4 4 0 1 0 0.1 0z", "#ffd24a"); p.circ(30, 44, 3, "#ff5a5a"); for (let k = 0; k < 5; k++) p.circ(30 + k * 6, 66, 1, "#f4efe4"); }
  else { p.rect(14, 60, 48, 30, "#2a2a3a"); p.path("M38 60l-14 30h28z", "#5a5a6a"); p.rect(36, 66, 4, 6, "#f4efe4"); p.rect(36, 78, 4, 6, "#f4efe4"); p.rect(32, 82, 12, 6, "#ff3a3a", 2); p.rect(14, 34, 48, 26, "#ff8a5a"); p.circ(38, 54, 8, "#ffd24a"); }
  p.mark("screen", 38, 62);
  p.path("M4 98H72L76 118H0Z", dk(c, 0.15)); p.circ(22, 106, 4, "#ff3a3a"); p.rect(21, 98, 2, 8, "#1a1a1a"); for (const [x, cc] of [[44, "#ffd24a"], [54, "#4ff0ff"], [64, "#ff4fd8"]] as [number, string][]) p.circ(x, 108, 3.4, cc);
  p.rect(26, 130, 24, 20, "#1a1a1e", 2); p.rect(31, 136, 4, 8, "#ff8a2a"); p.rect(41, 136, 4, 8, "#ff8a2a");
  return p;
}
export function washer(c = "#f4f4f2") {
  const p = new Pic(90, 110);
  p.box(0, 0, 90, 110, c, 4); p.rect(0, 0, 90, 18, mix(c, "#c8ccd4", 0.4), 4);
  p.circ(70, 9, 4, "#5a5e66"); p.rect(8, 6, 26, 6, "#1a2a3a", 1); p.rect(10, 7, 10, 4, "#4aff9a");
  p.circ(45, 62, 32, "#c8ccd4"); p.circ(45, 62, 26, "#3a4a5a"); p.circ(45, 62, 26, p.rad(["#8ab8d8", "#2a4a6a"], 0.4, 0.3));
  p.mark("drum", 45, 62);
  p.path("M30 46Q38 40 46 42", "none"); p.line("M30 48Q36 42 44 42", "#ffffff88", 2);
  return p;
}
export function drumClothes(r: Rng) {
  const p = new Pic(90, 110);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + r(); p.leaf(45 + Math.cos(a) * 12, 62 + Math.sin(a) * 12, 12, 6, (a * 180) / Math.PI, pick(r, ["#e83a5a", "#3a7ae8", "#f4c42a", "#f4f0e8", "#5ac06a"])); }
  return p;
}
export function vending(r: Rng) {
  const p = new Pic(90, 180);
  p.box(0, 0, 90, 180, "#c8283a", 4); p.rect(8, 10, 56, 120, "#e8f4ff"); p.rect(8, 10, 56, 120, p.lin(["#f4fbff", "#b8d8ec"]));
  for (let j = 0; j < 5; j++) { p.rect(8, 32 + j * 24, 56, 2, "#8a8e96"); for (let i = 0; i < 4; i++) { const c = pick(r, ["#e83a3a", "#3a7ae8", "#f4c42a", "#5ac06a", "#8a3a2a", "#f47a2a"]); p.rect(12 + i * 13, 16 + j * 24, 10, 16, c, 2); p.rect(12 + i * 13, 22 + j * 24, 10, 4, "#f4efe4"); } }
  p.rect(70, 20, 14, 30, "#2a2a2e", 2); for (let k = 0; k < 9; k++) p.rect(72 + (k % 3) * 4, 24 + Math.floor(k / 3) * 6, 3, 4, "#d8dade"); p.rect(72, 60, 10, 4, "#1a1a1a");
  p.rect(10, 140, 52, 24, "#2a2a2e", 2);
  p.mark("glow", 36, 70);
  return p;
}
export function plasticChairs(n = 3, c = "#f4a02a") {
  const p = new Pic(n * 50, 80);
  for (let i = 0; i < n; i++) { const x = i * 50; p.path(`M${x + 6} 40V10Q${x + 6} 2 ${x + 24} 2Q${x + 42} 2 ${x + 42} 10V40Z`, c); p.rect(x + 2, 40, 44, 8, lt(c, 0.12), 3); p.line(`M${x + 8} 48V80M${x + 40} 48V80`, "#5a5e66", 2.5); }
  p.rect(0, 46, n * 50, 3, "#5a5e66");
  return p;
}
export function laundryBasket(r: Rng) {
  const p = new Pic(80, 60);
  for (let k = 0; k < 5; k++) p.ell(16 + k * 12, 14 + (k % 2) * 3, 12, 8, pick(r, ["#e83a5a", "#3a7ae8", "#f4f0e8", "#f4c42a", "#7a5ab0"]));
  p.path("M4 18H76L70 60H10Z", "#5ab0e8"); for (let k = 0; k < 4; k++) p.rect(12 + k * 16, 26, 8, 26, "#3a8ac8", 3);
  return p;
}
export function forgeHearth() {
  const p = new Pic(200, 200);
  p.path("M30 0H170L190 70H10Z", "#3a2a24"); p.path("M30 0H50L36 70H10Z", "#4a3a32");
  p.rect(0, 70, 200, 130, "#5a3a2e");
  for (let y = 76; y < 196; y += 16) for (let x = (y / 16) % 2 ? 0 : 18; x < 196; x += 36) p.rect(x, y, 34, 14, (x + y) % 3 ? "#6a4434" : "#5e3e2e");
  p.path("M40 200V130Q40 100 100 100Q160 100 160 130V200Z", "#1a0a04");
  p.path("M50 200V136Q50 112 100 112Q150 112 150 136V200Z", p.rad(["#ffe08a", "#ff7a1a", "#8a1a04", "#1a0a04"], 0.5, 1));
  p.rect(30, 150, 140, 10, "#3a2a24");
  p.mark("fire", 100, 170); p.mark("glow", 100, 140);
  return p;
}
export function anvil() {
  const p = new Pic(130, 90);
  p.path("M40 90L46 60H84L90 90Z", "#3a2a1e"); p.path("M30 46H100L94 60H36Z", "#2a2c32");
  p.path("M4 30Q10 26 30 26H118V46H30Q16 40 4 30Z", "#3a3c44"); p.rect(30, 26, 88, 4, "#6a6e78"); p.path("M4 30Q14 28 30 28V32Q16 32 4 30Z", "#5a5e68");
  p.rect(70, 14, 50, 6, "#ff8a2a", 2); p.rect(70, 14, 18, 6, "#ffd24a", 2); p.line("M100 16L126 10", "#3a3c44", 3);
  p.mark("glow", 80, 16);
  return p;
}
export function toolRack(r: Rng) {
  const p = new Pic(170, 100);
  p.rect(0, 4, 170, 8, "#5a3a20");
  for (let x = 16; x < 160; x += 26) {
    const k = Math.floor(r() * 3);
    p.circ(x, 14, 2, "#1a1a1a");
    if (k === 0) { p.rect(x - 2, 14, 4, 60, "#7a5a3a"); p.rect(x - 10, 70, 20, 14, "#3a3c44", 2); }
    else if (k === 1) { p.line(`M${x} 14L${x - 6} 80M${x} 14L${x + 6} 80`, "#3a3c44", 3); p.circ(x, 26, 3, "#3a3c44"); }
    else { p.rect(x - 2, 14, 4, 50, "#7a5a3a"); p.path(`M${x - 12} 64h24l-4 26h-16z`, "#3a3c44"); }
  }
  return p;
}
export function roulette() {
  const p = new Pic(240, 110);
  p.rect(0, 50, 240, 60, "#3a1a10"); p.rect(0, 46, 240, 8, "#5a2a18", 3);
  p.path("M4 50L24 16H216L236 50Z", "#1a6a3a"); p.path("M4 50L24 16H216L236 50Z", p.lin(["#2a8a4a", "#1a5a2a"]));
  for (let k = 0; k < 12; k++) p.path(`M${110 + k * 9} 22l-2 22h8l2 -22z`, k % 2 ? "#c8283a" : "#1a1a1a"); p.raw("<path d='M106 22h112' stroke='#f4efe4' stroke-width='.8'/>");
  p.ell(60, 32, 40, 13, "#5a2a18"); p.ell(60, 31, 34, 10, "#2a1a10"); p.mark("wheel", 60, 31);
  for (const [x, c] of [[160, "#e83a3a"], [176, "#3a7ae8"], [194, "#f4c42a"]] as [number, string][]) for (let k = 0; k < 4; k++) p.ell(x, 40 - k * 3, 7, 2.6, k % 2 ? lt(c, 0.3) : c);
  return p;
}
export function wheelTop() {
  const p = new Pic(240, 110);
  const cs: string[] = []; for (let k = 0; k < 18; k++) cs.push(k === 0 ? "#1a8a3a" : k % 2 ? "#c8283a" : "#1a1a1a");
  for (let k = 0; k < 18; k++) { const a1 = (k / 18) * Math.PI * 2, a2 = ((k + 1) / 18) * Math.PI * 2; p.path(`M60 31L${f1(60 + Math.cos(a1) * 32)} ${f1(31 + Math.sin(a1) * 9.5)}L${f1(60 + Math.cos(a2) * 32)} ${f1(31 + Math.sin(a2) * 9.5)}Z`, cs[k]); }
  p.ell(60, 31, 10, 3, GOLD); p.circ(82, 28, 2, "#ffffff");
  return p;
}
export function slotMachine(r: Rng) {
  const p = new Pic(80, 160);
  p.path("M6 160V30Q6 4 40 4Q74 4 74 30V160Z", "#c8a03a"); p.path("M12 40Q12 12 40 12Q68 12 68 40Z", "#c8283a");
  p.text(40, 34, 12, "#ffe8a0", "777");
  p.rect(12, 50, 56, 34, "#f4efe4", 3); for (let k = 0; k < 3; k++) { const x = 15 + k * 18; p.rect(x, 52, 16, 30, "#ffffff"); p.text(x + 8, 73, 15, pick(r, ["#c8283a", "#2a8a3a", "#e8a02a"]), pick(r, ["7", "♥", "★", "♣", "◆"])); }
  p.rect(78, 50, 2, 1, "#000"); p.line("M74 60h6v-30", "#9aa0aa", 3); p.circ(80, 28, 5, "#c8283a");
  p.rect(12, 92, 56, 14, "#8a6a2a", 2); p.rect(18, 120, 44, 30, "#1a1a1e", 3);
  p.mark("screen", 40, 66);
  return p;
}
export function cauldron() {
  const p = new Pic(140, 120);
  p.path("M30 120l10 -24h60l10 24z", "#1a1a1e");
  p.path("M14 40Q10 100 70 104Q130 100 126 40Z", "#1e1e24"); p.path("M86 44Q120 46 124 44Q126 90 88 102Q110 76 86 44Z", "#121216");
  p.ell(70, 40, 58, 12, "#2a2a30"); p.ell(70, 41, 52, 9, "#3aff7a"); p.ell(70, 41, 52, 9, p.rad(["#aaffc0", "#3aff7a", "#1a8a3a"], 0.5, 0.5));
  p.mark("bubble", 70, 36); p.mark("glow", 70, 38);
  p.line("M60 40L92 0", "#5a3a20", 4);
  return p;
}
export function crystalBall() {
  const p = new Pic(70, 90);
  p.path("M14 90l6 -24h30l6 24z", "#3a2a4a"); p.path("M18 66h34l-4 -6h-26z", GOLD);
  p.circ(35, 36, 28, p.rad(["#f0d8ff", "#a86aff", "#4a1a8a"], 0.4, 0.35)); p.ell(26, 26, 8, 5, "#ffffff88");
  p.mark("glow", 35, 36);
  return p;
}
export function lectern(r: Rng) {
  const p = new Pic(110, 160);
  p.path("M40 160l15 -16l15 16z", "#4a2a14"); p.rect(50, 70, 10, 76, "#5a3418");
  p.path("M10 70L100 70L92 50L18 50Z", "#5a3418");
  p.path("M14 52Q34 40 55 48Q76 40 96 52L92 62Q74 54 55 60Q36 54 18 62Z", "#efe2c4");
  for (let k = 0; k < 4; k++) { p.line(`M${24 + k * 2} ${52 + k * 2}h${18 - k * 2}`, "#8a6a4a", 0.8); p.line(`M${62} ${52 + k * 2}h${18 - k * 2}`, "#8a6a4a", 0.8); }
  p.text(42, 60, 7, "#7a3aff", pick(r, ["ᚱᚢᚾ", "✶✧✶", "ᛟᛉᛞ"])); p.text(72, 60, 7, "#7a3aff", "☽✦☾");
  p.mark("glow", 55, 52);
  return p;
}
export function floatingCandle() { const p = new Pic(14, 44); p.rect(3, 12, 8, 32, "#f2ead6", 1.5); p.path("M3 12q2 6 1 10l1 -10z", "#ddd0b8"); p.ell(7, 6, 2.6, 5, "#ffcf6a"); p.ell(7, 7, 1.2, 2.4, "#fff8e0"); p.mark("glow", 7, 6); return p; }
export function bust() {
  const p = new Pic(70, 190);
  p.rect(10, 80, 50, 110, "#e8e4dc"); p.rect(6, 76, 58, 8, "#f4f2ec"); p.rect(6, 182, 58, 8, "#d8d4cc"); p.rect(52, 84, 8, 98, "#d0ccc4");
  p.path("M14 76Q16 52 35 50Q54 52 56 76Z", "#efebe4"); p.ell(35, 34, 12, 15, "#f4f0e8"); p.path("M23 30Q22 16 35 16Q48 16 47 30Q44 22 35 22Q26 22 23 30Z", "#e0dcd2"); p.path("M42 30q4 6 0 14l-4 -2z", "#dcd8ce");
  p.rect(20, 130, 30, 10, "#c8c0b0", 1); p.rect(23, 133, 24, 1.5, "#8a8478");
  return p;
}
export function stanchions(w = 220) {
  const p = new Pic(w, 70);
  for (const x of [10, w - 10]) { p.rect(x - 2, 14, 4, 50, GOLD); p.ell(x, 66, 10, 3, GOLD); p.circ(x, 12, 4, GOLD); }
  p.raw(`<path d='M10 16Q${w / 2} 44 ${w - 10} 16' fill='none' stroke='#8a1a2a' stroke-width='5'/>`);
  return p;
}
export function planeSeats(r: Rng, w = 800) {
  const p = new Pic(w, 90);
  for (let x = 0; x < w; x += 100) {
    const c = "#2a3a6a";
    p.path(`M${x + 8} 90V22Q${x + 8} 6 ${x + 24} 6H${x + 76}Q${x + 92} 6 ${x + 92} 22V90Z`, c);
    p.rect(x + 26, 4, 48, 14, "#e8eef4", 3);
    p.rect(x + 34, 30, 32, 22, "#0a1420", 2); p.rect(x + 36, 32, 28, 18, p.lin([pick(r, ["#5ab0e8", "#e8905a", "#5ae8a0"]), "#1a2a4a"]));
    p.mark("screen", x + 50, 41);
    p.rect(x + 34, 58, 32, 3, "#1a2a4a"); p.rect(x + 86, 30, 6, 60, dk(c, 0.3));
  }
  return p;
}
export function overheadBins(w = 800) {
  const p = new Pic(w, 50);
  p.rect(0, 0, w, 40, "#e4e8ec"); p.rect(0, 38, w, 6, "#c4c8ce"); p.rect(0, 44, w, 6, "#5a5e66");
  for (let x = 0; x < w; x += 120) { p.rect(x, 0, 2, 40, "#b8bcc4"); p.rect(x + 50, 30, 20, 4, "#9aa0aa", 2); }
  for (let x = 60; x < w; x += 200) { p.rect(x - 14, 46, 28, 4, "#2a2e34"); p.circ(x - 6, 48, 1.5, "#ffd24a"); p.circ(x + 6, 48, 1.5, "#ffd24a"); }
  return p;
}
export function seatbeltSign() { const p = new Pic(60, 30); p.rect(0, 0, 60, 30, "#2a2e34", 4); p.rect(4, 4, 52, 22, "#3a3a2a", 3); p.raw("<circle cx='18' cy='15' r='7' fill='none' stroke='#ffd24a' stroke-width='1.6'/><path d='M13 20L23 10' stroke='#ffd24a' stroke-width='1.6'/>"); p.circ(42, 11, 3, "#ffd24a"); p.path("M37 22q5 -10 10 0z", "#ffd24a"); p.line("M36 17h12", "#ffd24a", 1.5); p.mark("glow", 30, 15); return p; }
export function pipes(r: Rng, w = 800) {
  const p = new Pic(w, 80);
  for (const [y, c, t] of [[10, "#6a6e78", 12], [30, "#8a5a3a", 9], [46, "#5a6a5a", 7]] as [number, string, number][]) { p.rect(0, y, w, t, c); p.rect(0, y + 2, w, 2, lt(c, 0.25)); for (let x = 40; x < w; x += between(r, 90, 160)) p.rect(x, y - 2, 8, t + 4, dk(c, 0.2), 1); }
  for (let x = 80; x < w; x += 260) { p.line(`M${x} 56V80`, "#6a6e78", 8); p.circ(x, 66, 12, "none"); p.raw(`<circle cx='${x}' cy='66' r='11' fill='none' stroke='#c8283a' stroke-width='3.5'/><path d='M${x - 11} 66H${x + 11}M${x} 55V77' stroke='#c8283a' stroke-width='2.5'/>`); }
  return p;
}
export function gauges(n = 3) {
  const p = new Pic(n * 46, 46);
  for (let i = 0; i < n; i++) { const x = 23 + i * 46; p.circ(x, 23, 21, BRASS); p.circ(x, 23, 17, "#f4efe4"); for (let k = 0; k < 7; k++) { const a = Math.PI * (0.8 + (k * 1.4) / 6); p.line(`M${f1(x + Math.cos(a) * 13)} ${f1(23 + Math.sin(a) * 13)}L${f1(x + Math.cos(a) * 16)} ${f1(23 + Math.sin(a) * 16)}`, k > 4 ? "#c8283a" : "#2a2a2a", 1.2); } p.line(`M${x} 23L${x + [8, -6, 10][i % 3]} ${23 - [10, 10, -4][i % 3]}`, "#c8283a", 1.8); p.circ(x, 23, 2, "#2a2a2a"); }
  return p;
}
export function periscope() {
  const p = new Pic(70, 230);
  p.rect(26, 0, 18, 140, "#5a5e66"); p.rect(28, 0, 4, 140, "#7a7e88"); p.rect(20, 40, 30, 8, "#4a4e56");
  p.rect(14, 140, 42, 40, "#4a4e56", 4); p.rect(4, 150, 14, 10, "#3a3e46", 2); p.rect(52, 150, 14, 10, "#3a3e46", 2);
  p.rect(22, 166, 26, 10, "#1a1a1e", 4); p.ell(30, 171, 4, 3, "#3a5a7a"); p.ell(40, 171, 4, 3, "#3a5a7a");
  return p;
}
export function hayBales(r: Rng) {
  const p = new Pic(200, 100), c = "#d8b45a";
  const bale = (x: number, y: number, w: number, h: number) => { p.rect(x, y, w, h, c, 4); p.rect(x, y, w, 4, lt(c, 0.2), 3); for (let k = 0; k < 14; k++) p.line(`M${x + r() * w} ${y + r() * h}l${between(r, -6, 6)} ${between(r, -3, 3)}`, dk(c, 0.18), 1); p.rect(x + w * 0.25, y, 3, h, "#8a6a2a"); p.rect(x + w * 0.7, y, 3, h, "#8a6a2a"); p.rect(x + w - 8, y, 8, h, dk(c, 0.15), 3); };
  bale(0, 54, 96, 46); bale(98, 54, 96, 46); bale(46, 8, 96, 46);
  for (let k = 0; k < 10; k++) p.line(`M${between(r, 0, 200)} 100l${between(r, -8, 8)} -${between(r, 2, 6)}`, c, 1);
  return p;
}
export function stall(wood = "#7a5232") {
  const p = new Pic(200, 150);
  p.rect(0, 0, 10, 150, dk(wood, 0.2)); p.rect(190, 0, 10, 150, dk(wood, 0.3));
  p.rect(10, 70, 180, 80, wood); for (let x = 10; x < 190; x += 20) p.rect(x, 70, 2, 80, dk(wood, 0.25));
  p.line("M14 74L186 146M186 74L14 146", lt(wood, 0.12), 8); p.rect(10, 64, 180, 10, lt(wood, 0.1), 2);
  return p;
}
export function saddle() {
  const p = new Pic(130, 70);
  p.rect(0, 30, 130, 8, "#5a3a20", 2);
  p.path("M20 32Q30 6 56 14Q66 20 76 14Q96 4 110 32Q90 48 64 42Q40 48 20 32Z", "#7a3a1a"); p.path("M56 14Q66 20 76 14L74 24Q66 28 58 24Z", "#5a2a10");
  p.path("M40 38L44 64H52L56 40Z", "#5a2a10"); p.rect(40, 60, 16, 6, "#9aa0aa", 2);
  return p;
}
export function pitchfork() { const p = new Pic(40, 200); p.line("M20 200V40", "#8a6a3a", 4); p.line("M8 40H32M8 40V4M20 40V2M32 40V4", "#6a6e78", 2.5); return p; }
export function ropeLadder() { const p = new Pic(50, 200); p.line("M10 0Q6 100 12 200M40 0Q44 100 38 200", "#c8a46a", 2.5); for (let y = 16; y < 200; y += 24) p.rect(8, y, 34, 5, "#8a5a32", 2); return p; }
export function beanbag(c = "#e85a3a") { const p = new Pic(110, 70); p.path("M6 66Q0 30 30 20Q54 6 80 18Q110 30 104 66Z", c); p.path("M30 30Q50 40 80 26", "none"); p.line("M30 34Q52 46 82 30", dk(c, 0.2), 2); p.path("M60 18Q90 24 100 50L104 66H80Q90 40 60 18Z", dk(c, 0.15)); return p; }
export function fireflyJar() {
  const p = new Pic(40, 56);
  p.rect(6, 12, 28, 42, al(GLASS, 0.4), 8); p.rect(8, 4, 24, 9, "#c8a46a", 2); p.raw("<path d='M10 4l-2 -4M30 4l2 -4' stroke='#8a6a3a'/>");
  for (const [x, y] of [[14, 30], [24, 24], [20, 42], [28, 36]] as [number, number][]) { p.circ(x, y, 5, "#f0ff8a33"); p.circ(x, y, 1.8, "#f4ffaa"); }
  p.mark("glow", 20, 33);
  return p;
}
export function comics(r: Rng) { const p = new Pic(70, 40); for (let k = 0; k < 6; k++) { const c = pick(r, ["#e83a3a", "#3a7ae8", "#f4c42a", "#5ac06a", "#e85ad8"]); p.rect(4 + between(r, -3, 3), 40 - (k + 1) * 4.5, 56, 4.5, c, 1); p.rect(8, 40 - (k + 1) * 4.5 + 1, 20, 1.5, "#f4efe4"); } return p; }
export function keepOut() { const p = new Pic(110, 50); p.raw("<g transform='rotate(-4 55 25)'>"); p.rect(4, 6, 102, 38, "#a8743a", 3); for (let y = 14; y < 42; y += 9) p.rect(4, y, 102, 1, "#7a4a1a"); p.text(55, 33, 18, "#f4efe4", "KEEP OUT!", " font-family='Comic Sans MS,Chalkboard,cursive'"); p.circ(10, 12, 2, "#5a5a5a"); p.circ(100, 12, 2, "#5a5a5a"); p.raw("</g>"); return p; }
export function jellyfish(c = "#ff8ad8") {
  const p = new Pic(40, 70);
  p.path("M4 22Q4 2 20 2Q36 2 36 22Q30 18 26 22Q20 18 14 22Q10 18 4 22Z", al(c, 0.75)); p.ell(16, 10, 6, 4, "#ffffff55");
  for (let k = 0; k < 5; k++) p.line(`M${8 + k * 6} 22q${k % 2 ? 4 : -4} 12 0 22t0 22`, al(c, 0.55), 1.4);
  p.mark("glow", 20, 14);
  return p;
}
export function fish(r: Rng, n = 7) {
  const p = new Pic(160, 60);
  for (let k = 0; k < n; k++) { const x = 10 + r() * 130, y = 8 + r() * 44, s = between(r, 0.6, 1.1), c = pick(r, ["#ffa83a", "#5ad0ff", "#ffd84a", "#ff6a8a"]); p.ell(x, y, 8 * s, 3.6 * s, c); p.path(`M${x + 7 * s} ${y}l${6 * s} -${4 * s}v${8 * s}z`, c); p.circ(x - 4.5 * s, y - 0.8 * s, 0.9, "#1a1a1a"); }
  return p;
}
export function aquariumRock(r: Rng, w = 800) {
  const p = new Pic(w, 80);
  let d = "M0 80V60";
  for (let x = 0; x <= w; x += 40) d += `Q${x + 20} ${between(r, 30, 62)} ${x + 40} ${between(r, 50, 66)}`;
  p.path(d + `V80Z`, "#1a3a4a");
  for (let x = 20; x < w; x += between(r, 30, 70)) { const h = between(r, 30, 76), c = pick(r, ["#2a8a5a", "#3aa06a", "#1a6a4a", "#ff7a8a"]); if (c === "#ff7a8a") { p.line(`M${x} 70l-6 -${h * 0.4}M${x} 70l4 -${h * 0.5}M${x} 70l10 -${h * 0.3}`, c, 3); } else p.line(`M${x} 74Q${x - 10} ${74 - h / 2} ${x + 4} ${74 - h}`, c, 3); }
  return p;
}
