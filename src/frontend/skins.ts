// Skins: eleven fixed palettes, each with a light and a dark mode, plus
// "lumiverse", which follows the host theme (the base tokens in styles.ts).
// The frontend sets data-alm-skin and data-alm-mode on <html>; the tokens and a
// few signature overrides per skin live here. Mockups: design/mockups/skins.html.

export const SKIN_LIST: [string, string][] = [
  ["almanac", "Almanac"], ["solar", "Solar Editorial"], ["nocturne", "Nocturne"], ["botanical", "Botanical"], ["prism", "Prism"], ["candy", "Candy"],
  ["dossier", "Dossier"], ["scriptorium", "Scriptorium"], ["arcana", "Arcana"], ["orbital", "Orbital"], ["posy", "Posy"],
  ["lumiverse", "Follow Lumiverse"],
];

type Pal = Record<string, string>;
interface Skin {
  /** Fonts and shapes shared by both modes. */
  shared: Pal;
  light: Pal;
  dark: Pal;
  /** Google Fonts families (css2 syntax) this skin needs beyond the base set. */
  fonts: string[];
}

const FLOWERS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Cg transform='translate(24 26)'%3E%3Cg fill='%23f2a9bf'%3E%3Ccircle cx='0' cy='-6' r='5'/%3E%3Ccircle cx='5.7' cy='-1.9' r='5'/%3E%3Ccircle cx='3.5' cy='4.9' r='5'/%3E%3Ccircle cx='-3.5' cy='4.9' r='5'/%3E%3Ccircle cx='-5.7' cy='-1.9' r='5'/%3E%3C/g%3E%3Ccircle r='2.6' fill='%23e8b25c'/%3E%3C/g%3E%3Cpath d='M66 70c6-10 16-12 22-10-4 8-14 12-22 10z' fill='%2396c4a0'/%3E%3Cpath d='M66 70c-2-9 2-18 8-22 2 8-2 17-8 22z' fill='%23acd3b3'/%3E%3Ccircle cx='78' cy='22' r='2.4' fill='%23f2a9bf'/%3E%3Ccircle cx='14' cy='76' r='2' fill='%23acd3b3'/%3E%3C/svg%3E")`;
const SPRIG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cpath d='M20 110C40 80 60 60 100 40' stroke='%234f8a5c' stroke-width='2' fill='none'/%3E%3Cpath d='M45 80c-10-8-12-20-8-26 9 4 13 16 8 26z' fill='%237fb08a'/%3E%3Cpath d='M70 58c2-12 12-20 20-20-1 10-10 18-20 20z' fill='%239cc5a5'/%3E%3Cg transform='translate(96 30)'%3E%3Cg fill='%23f0a3b9'%3E%3Cellipse rx='7' ry='11' transform='translate(0 -9)'/%3E%3Cellipse rx='7' ry='11' transform='rotate(72) translate(0 -9)'/%3E%3Cellipse rx='7' ry='11' transform='rotate(144) translate(0 -9)'/%3E%3Cellipse rx='7' ry='11' transform='rotate(216) translate(0 -9)'/%3E%3Cellipse rx='7' ry='11' transform='rotate(288) translate(0 -9)'/%3E%3C/g%3E%3Ccircle r='5' fill='%23e8b25c'/%3E%3C/g%3E%3C/svg%3E")`;

const SKINS: Record<string, Skin> = {
  almanac: {
    shared: { "font-display": `"Fraunces",Georgia,serif`, "font-body": `"Newsreader",Georgia,serif`, "font-mono": `"DM Mono",ui-monospace,monospace`, "font-hand": `"Caveat",cursive`, radius: "14px", "r-sm": "10px" },
    light: { panel: "#fbf5e8", "panel-2": "#f0e4cc", ink: "#2b2118", muted: "#78674f", line: "#dfcca8", accent: "#b8501f", "accent-2": "#2f5d7c", gold: "#c4922c", good: "#3a7f50", warn: "#b27a14", danger: "#b8332a", "on-accent": "#fff",
      shadow: "0 18px 36px -26px rgba(70,40,10,.55),0 2px 6px -3px rgba(70,40,10,.18)", lift: "0 10px 22px -18px rgba(70,40,10,.55)", texture: "radial-gradient(rgba(43,33,24,.08) 1px,transparent 1.3px) 0 0/15px 15px" },
    dark: { panel: "#241c14", "panel-2": "#19130d", ink: "#f1e6d3", muted: "#b3a189", line: "#3e3226", accent: "#ee8a55", "accent-2": "#86b6d8", gold: "#e2b456", good: "#86cf98", warn: "#e9bd60", danger: "#f28072", "on-accent": "#19130d",
      shadow: "0 20px 40px -26px rgba(0,0,0,.85)", lift: "0 10px 24px -18px rgba(0,0,0,.9)", texture: "radial-gradient(rgba(241,230,211,.06) 1px,transparent 1.3px) 0 0/15px 15px" },
    fonts: [],
  },
  solar: {
    shared: { "font-display": `"Playfair Display",Georgia,serif`, "font-body": `"Libre Franklin","Segoe UI",system-ui,sans-serif`, "font-mono": `"Libre Franklin",system-ui,sans-serif`, "font-hand": `"Playfair Display",Georgia,serif`, radius: "0px", "r-sm": "0px", shadow: "none", lift: "none", texture: "none" },
    light: { panel: "#ffffff", "panel-2": "#f1efe8", ink: "#111111", muted: "#595959", line: "#d9d6cd", accent: "#ffd21f", "accent-2": "#e23d28", gold: "#ffd21f", good: "#1f7a45", warn: "#a86d00", danger: "#d42f1c", "on-accent": "#111", rule: "#111111" },
    dark: { panel: "#121212", "panel-2": "#050505", ink: "#f6f3ea", muted: "#a6a39b", line: "#2f2f2f", accent: "#ffd21f", "accent-2": "#ff6e57", gold: "#ffd21f", good: "#6fd39a", warn: "#ffc246", danger: "#ff6e57", "on-accent": "#111", rule: "#f6f3ea" },
    fonts: ["Playfair+Display:ital,wght@0,700;0,900;1,700", "Libre+Franklin:wght@400;500;700"],
  },
  nocturne: {
    shared: { "font-display": `"Cormorant Garamond",Georgia,serif`, "font-body": `"Crimson Pro",Georgia,serif`, "font-mono": `"Cormorant Garamond",Georgia,serif`, "font-hand": `"Cormorant Garamond",Georgia,serif`, radius: "10px", "r-sm": "6px" },
    light: { panel: "#f7f1ec", "panel-2": "#eadcd5", ink: "#28131a", muted: "#7a5d64", line: "#d9c2c3", accent: "#8e1b2e", "accent-2": "#3f2c55", gold: "#9c7a3c", good: "#3f6d4e", warn: "#9a6a1a", danger: "#8e1b2e", "on-accent": "#fff",
      shadow: "0 22px 40px -28px rgba(60,10,25,.55)", lift: "0 10px 22px -18px rgba(60,10,25,.45)", texture: "radial-gradient(60% 50% at 50% 0%,rgba(142,27,46,.07),transparent 70%),repeating-linear-gradient(45deg,rgba(40,19,26,.025) 0 1px,transparent 1px 9px)" },
    dark: { panel: "#150c10", "panel-2": "#0b0609", ink: "#f0e2df", muted: "#a88c91", line: "#3b2229", accent: "#e4495f", "accent-2": "#bea6d4", gold: "#d4b27a", good: "#8ccaa0", warn: "#e3b465", danger: "#ff7a86", "on-accent": "#0b0609",
      shadow: "0 26px 50px -28px rgba(0,0,0,.95)", lift: "0 14px 30px -18px rgba(0,0,0,.95)", texture: "radial-gradient(60% 50% at 50% 0%,rgba(228,73,95,.09),transparent 70%),repeating-linear-gradient(45deg,rgba(240,226,223,.02) 0 1px,transparent 1px 9px)" },
    fonts: ["Crimson+Pro:ital,wght@0,400;0,600;1,400"],
  },
  botanical: {
    shared: { "font-display": `"Young Serif",Georgia,serif`, "font-body": `"Source Serif 4",Georgia,serif`, "font-mono": `"Courier Prime","Courier New",monospace`, "font-hand": `"Caveat",cursive`, radius: "4px", "r-sm": "3px" },
    light: { panel: "#f6f1e3", "panel-2": "#dcceab", ink: "#2a291d", muted: "#6c6750", line: "#c9bb95", accent: "#5f7222", "accent-2": "#a65a1a", gold: "#b3862a", good: "#4f7a2a", warn: "#a4701c", danger: "#a8401e", "on-accent": "#fff",
      shadow: "0 1px 0 #cdbf98,0 18px 30px -24px rgba(60,50,20,.55)", lift: "0 1px 0 #d8cca8", texture: "radial-gradient(rgba(90,70,30,.10) .8px,transparent 1.2px) 0 0/5px 5px" },
    dark: { panel: "#1c1d15", "panel-2": "#12130d", ink: "#ece7d2", muted: "#aaa68c", line: "#37382b", accent: "#b7c86b", "accent-2": "#e59c57", gold: "#dab65e", good: "#a3cf73", warn: "#e6b85e", danger: "#ee8266", "on-accent": "#12130d",
      shadow: "0 20px 36px -26px rgba(0,0,0,.9)", lift: "none", texture: "radial-gradient(rgba(236,231,210,.05) .8px,transparent 1.2px) 0 0/5px 5px" },
    fonts: ["Young+Serif", "Source+Serif+4:ital,opsz,wght@0,8..60,400;1,8..60,400", "Courier+Prime:ital@0;1"],
  },
  prism: {
    shared: { "font-display": `"Syne","Segoe UI",system-ui,sans-serif`, "font-body": `"Space Grotesk","Segoe UI",system-ui,sans-serif`, "font-mono": `"Space Mono",ui-monospace,monospace`, "font-hand": `"Space Grotesk",system-ui,sans-serif`, radius: "16px", "r-sm": "12px" },
    light: { panel: "#fcfcff", "panel-2": "#eef0fa", ink: "#15152c", muted: "#5c5f80", line: "#dcdff0", accent: "#6d2fff", "accent-2": "#0096ab", gold: "#e0a800", good: "#0f9d6a", warn: "#c98600", danger: "#e0245e", "on-accent": "#fff",
      holo: "linear-gradient(115deg,#ff7ac6,#ffd86b 25%,#7df3e1 50%,#8fa8ff 75%,#d78bff)", shadow: "0 22px 44px -28px rgba(80,60,180,.45)", lift: "0 10px 24px -18px rgba(80,60,180,.4)",
      texture: "radial-gradient(40% 50% at 10% 0%,rgba(255,122,198,.14),transparent 70%),radial-gradient(40% 50% at 90% 100%,rgba(125,243,225,.16),transparent 70%)" },
    dark: { panel: "#0c0c16", "panel-2": "#05050b", ink: "#eef0ff", muted: "#9296b8", line: "#24253c", accent: "#b28cff", "accent-2": "#3ef2ff", gold: "#ffe45e", good: "#4be39a", warn: "#ffc15e", danger: "#ff6b9a", "on-accent": "#05050b",
      holo: "linear-gradient(115deg,#ff4fae,#ffe45e 25%,#3ef2ff 50%,#7a8cff 75%,#c86bff)", shadow: "0 26px 50px -28px rgba(0,0,0,.95),0 0 36px -20px rgba(178,140,255,.5)", lift: "0 12px 28px -18px rgba(0,0,0,.95)",
      texture: "radial-gradient(40% 50% at 10% 0%,rgba(255,79,174,.10),transparent 70%),radial-gradient(40% 50% at 90% 100%,rgba(62,242,255,.10),transparent 70%)" },
    fonts: ["Space+Grotesk:wght@400;500;700", "Space+Mono"],
  },
  candy: {
    shared: { "font-display": `"Fredoka","Segoe UI Rounded",system-ui,sans-serif`, "font-body": `"Fredoka","Segoe UI Rounded",system-ui,sans-serif`, "font-mono": `"Fredoka",system-ui,sans-serif`, "font-hand": `"Fredoka",system-ui,sans-serif`, radius: "22px", "r-sm": "16px" },
    light: { panel: "#fffdf4", "panel-2": "#fff1c2", ink: "#1d1033", muted: "#6a5e80", line: "#ead9a6", accent: "#ff4fa3", "accent-2": "#28c994", gold: "#ffc933", good: "#12a978", warn: "#d98a00", danger: "#ff3b5c", "on-accent": "#fff",
      pop: "#1d1033", shadow: "5px 5px 0 #1d1033", lift: "3px 3px 0 #1d1033",
      texture: "radial-gradient(circle at 25% 25%,#ff9fcf 0 3px,transparent 3.5px) 0 0/60px 60px,radial-gradient(circle at 75% 60%,#7fe3c1 0 3px,transparent 3.5px) 0 0/60px 60px,radial-gradient(circle at 50% 90%,#b7a6ff 0 2.5px,transparent 3px) 0 0/60px 60px" },
    dark: { panel: "#241a40", "panel-2": "#160f2b", ink: "#fff4fb", muted: "#c1b3df", line: "#44376b", accent: "#ff78bd", "accent-2": "#5ef2c0", gold: "#ffd84d", good: "#5ef2c0", warn: "#ffc04d", danger: "#ff6b86", "on-accent": "#160f2b",
      pop: "#fff4fb", shadow: "5px 5px 0 #ff78bd", lift: "3px 3px 0 #7a5cff",
      texture: "radial-gradient(circle at 25% 25%,#ff78bd 0 3px,transparent 3.5px) 0 0/60px 60px,radial-gradient(circle at 75% 60%,#5ef2c0 0 3px,transparent 3.5px) 0 0/60px 60px,radial-gradient(circle at 50% 90%,#ffd84d 0 2.5px,transparent 3px) 0 0/60px 60px" },
    fonts: ["Fredoka:wght@400;500;600;700"],
  },
  dossier: {
    shared: { "font-display": `"IBM Plex Serif",Georgia,serif`, "font-body": `"IBM Plex Sans","Segoe UI",system-ui,sans-serif`, "font-mono": `"IBM Plex Mono",ui-monospace,monospace`, "font-hand": `"Reenie Beanie",cursive`, radius: "4px", "r-sm": "3px" },
    light: { panel: "#fbfaf7", "panel-2": "#ecebe5", ink: "#17191c", muted: "#5a5f67", line: "#d4d1c9", accent: "#8c1d1d", "accent-2": "#34506a", gold: "#8a7a5a", good: "#2f6b4a", warn: "#946412", danger: "#a32020", "on-accent": "#fff",
      shadow: "0 1px 0 rgba(0,0,0,.04),0 12px 26px -22px rgba(0,0,0,.45)", lift: "0 1px 2px rgba(0,0,0,.06)", texture: "linear-gradient(transparent 31px,rgba(23,25,28,.05) 32px) 0 0/100% 32px" },
    dark: { panel: "#17191c", "panel-2": "#0e0f11", ink: "#e8e6e1", muted: "#9aa0a8", line: "#2d3137", accent: "#e0534f", "accent-2": "#90b1cd", gold: "#b9a67e", good: "#7fc3a0", warn: "#dcae57", danger: "#ff6e68", "on-accent": "#0e0f11",
      shadow: "0 14px 30px -22px rgba(0,0,0,.9)", lift: "none", texture: "linear-gradient(transparent 31px,rgba(232,230,225,.04) 32px) 0 0/100% 32px" },
    fonts: ["IBM+Plex+Mono:wght@400;500", "IBM+Plex+Sans:wght@400;500;600", "IBM+Plex+Serif:ital,wght@0,500;0,600;1,500", "Reenie+Beanie"],
  },
  scriptorium: {
    shared: { "font-display": `"IM Fell English",Georgia,serif`, "font-body": `"IM Fell English",Georgia,serif`, "font-mono": `"IM Fell English SC",Georgia,serif`, "font-hand": `"IM Fell English",Georgia,serif`, radius: "3px", "r-sm": "2px", lift: "none" },
    light: { panel: "#f3e7cb", "panel-2": "#e3cfa3", ink: "#2a1c10", muted: "#6c573b", line: "#c4a770", accent: "#a8261c", "accent-2": "#1f3f86", gold: "#b5892a", good: "#3d6b2e", warn: "#a8741a", danger: "#a8261c", "on-accent": "#f7ecd2",
      shadow: "0 2px 0 #c7ab77,0 22px 36px -26px rgba(60,35,10,.7)", texture: "radial-gradient(40% 50% at 18% 22%,rgba(150,100,40,.10),transparent 70%),radial-gradient(35% 40% at 82% 70%,rgba(120,80,30,.09),transparent 70%),radial-gradient(rgba(90,60,20,.07) 1px,transparent 1.4px) 0 0/9px 9px" },
    dark: { panel: "#221810", "panel-2": "#150e08", ink: "#efdfbf", muted: "#b19a75", line: "#4c3a24", accent: "#e6614a", "accent-2": "#86a3e6", gold: "#e2b34f", good: "#93c46f", warn: "#e2b34f", danger: "#ff735c", "on-accent": "#150e08",
      shadow: "0 2px 0 #3a2a18,0 26px 40px -26px rgba(0,0,0,.9)", texture: "radial-gradient(40% 50% at 70% 10%,rgba(255,180,80,.10),transparent 70%),radial-gradient(rgba(239,223,191,.04) 1px,transparent 1.4px) 0 0/9px 9px" },
    fonts: ["IM+Fell+English:ital@0;1", "IM+Fell+English+SC", "UnifrakturMaguntia"],
  },
  arcana: {
    shared: { "font-display": `"Cinzel",Georgia,serif`, "font-body": `"Alegreya",Georgia,serif`, "font-mono": `"Cinzel",Georgia,serif`, "font-hand": `"Alegreya",Georgia,serif`, radius: "16px", "r-sm": "10px" },
    light: { panel: "#f8f5ff", "panel-2": "#e9e2fb", ink: "#211848", muted: "#655b8c", line: "#d5cbf0", accent: "#8a5c0a", "accent-2": "#0d8578", gold: "#c28f2c", good: "#1f8a58", warn: "#9a6a12", danger: "#c42d52", "on-accent": "#fff",
      shadow: "0 0 0 1px rgba(194,143,44,.14),0 24px 44px -30px rgba(60,40,140,.5)", lift: "0 10px 22px -18px rgba(60,40,140,.4)",
      texture: "radial-gradient(1px 1px at 20% 30%,rgba(194,143,44,.6),transparent) 0 0/140px 140px,radial-gradient(1px 1px at 70% 80%,rgba(106,69,214,.45),transparent) 0 0/190px 190px" },
    dark: { panel: "#1a1533", "panel-2": "#0f0c22", ink: "#ece6ff", muted: "#a79fcb", line: "#372d62", accent: "#e7b75a", "accent-2": "#63d9c6", gold: "#e7b75a", good: "#7fe0a8", warn: "#f0c46a", danger: "#ff7d93", "on-accent": "#140f28",
      shadow: "0 0 0 1px rgba(231,183,90,.12),0 28px 60px -30px rgba(0,0,0,.95),0 0 40px -18px rgba(123,97,255,.45)", lift: "0 10px 26px -16px rgba(0,0,0,.9)",
      texture: "radial-gradient(1px 1px at 20% 30%,rgba(255,240,200,.5),transparent) 0 0/140px 140px,radial-gradient(1px 1px at 70% 80%,rgba(200,220,255,.45),transparent) 0 0/190px 190px" },
    fonts: ["Alegreya:ital,wght@0,400;0,600;1,400", "Cinzel:wght@500;700", "Cinzel+Decorative:wght@700"],
  },
  orbital: {
    shared: { "font-display": `"Chakra Petch","Segoe UI",system-ui,sans-serif`, "font-body": `"Inter","Segoe UI",system-ui,sans-serif`, "font-mono": `"JetBrains Mono",ui-monospace,monospace`, "font-hand": `"JetBrains Mono",ui-monospace,monospace`, radius: "2px", "r-sm": "2px", lift: "none" },
    light: { panel: "#f7f8fa", "panel-2": "#e5e8ed", ink: "#0b0f14", muted: "#566170", line: "#cdd3db", accent: "#e8430a", "accent-2": "#2742ff", gold: "#e8430a", good: "#00925f", warn: "#c77800", danger: "#d61f35", "on-accent": "#fff",
      shadow: "0 0 0 1px rgba(11,15,20,.04),0 24px 40px -30px rgba(11,15,20,.5)", texture: "linear-gradient(90deg,rgba(11,15,20,.05) 1px,transparent 1px) 0 0/48px 100%,linear-gradient(rgba(11,15,20,.05) 1px,transparent 1px) 0 0/100% 48px" },
    dark: { panel: "#11151b", "panel-2": "#090c10", ink: "#e8edf3", muted: "#8a96a5", line: "#27303b", accent: "#ff6a2b", "accent-2": "#7289ff", gold: "#ff6a2b", good: "#2fd39a", warn: "#ffb13d", danger: "#ff5468", "on-accent": "#090c10",
      shadow: "0 0 0 1px rgba(255,255,255,.03),0 24px 40px -30px rgba(0,0,0,.9)", texture: "linear-gradient(90deg,rgba(232,237,243,.04) 1px,transparent 1px) 0 0/48px 100%,linear-gradient(rgba(232,237,243,.04) 1px,transparent 1px) 0 0/100% 48px" },
    fonts: ["Chakra+Petch:wght@500;600;700", "Inter:wght@400;500;600", "JetBrains+Mono:wght@400;500"],
  },
  posy: {
    shared: { "font-display": `"DM Serif Display",Georgia,serif`, "font-body": `"Nunito","Segoe UI",system-ui,sans-serif`, "font-mono": `"DM Mono",ui-monospace,monospace`, "font-hand": `"Dancing Script",cursive`, radius: "24px", "r-sm": "16px", sprig: SPRIG },
    light: { panel: "#fff7f7", "panel-2": "#f9e1e6", ink: "#1f3a2b", muted: "#627566", line: "#eec5cf", accent: "#c93d70", "accent-2": "#3f7f4d", gold: "#d99a4e", good: "#3a8551", warn: "#b87624", danger: "#c43a5c", "on-accent": "#fff",
      shadow: "0 20px 40px -28px rgba(120,40,70,.45),0 2px 6px -3px rgba(31,58,43,.15)", lift: "0 10px 22px -18px rgba(120,40,70,.5)", texture: `linear-gradient(rgba(255,247,247,.45),rgba(255,247,247,.45)),${FLOWERS} 0 0/96px 96px` },
    dark: { panel: "#172a20", "panel-2": "#0f1f17", ink: "#fbe9ee", muted: "#b5c8b9", line: "#2f4a3b", accent: "#ff8fb1", "accent-2": "#8fd19e", gold: "#f0c07a", good: "#8fd19e", warn: "#f0c07a", danger: "#ff7f98", "on-accent": "#0f1f17",
      shadow: "0 22px 44px -28px rgba(0,0,0,.9)", lift: "0 10px 22px -18px rgba(0,0,0,.9)", texture: `linear-gradient(rgba(15,31,23,.62),rgba(15,31,23,.62)),${FLOWERS} 0 0/96px 96px` },
    fonts: ["DM+Serif+Display:ital@0;1", "Nunito:wght@400;600;700", "Dancing+Script:wght@600"],
  },
};

/** Fonts every skin shares: the orrery (Syne), Almanac's faces, the hand and mono defaults. */
const BASE_FONTS = ["Caveat:wght@500;700", "DM+Mono:wght@400;500", "Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400..800", "Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600", "Syne:wght@600;700;800", "Cormorant+Garamond:ital,wght@0,500;0,700;1,500;1,600", "Oswald:wght@500;600"];

/** The @import for the base fonts plus the active skin's. */
export function fontsFor(skin: string): string {
  const fams = [...BASE_FONTS, ...(SKINS[skin]?.fonts ?? [])];
  return `@import url("https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f}`).join("&")}&display=swap");`;
}

export function isSkin(id: string): boolean {
  return id in SKINS || id === "lumiverse";
}

const decl = (p: Pal) => Object.entries(p).map(([k, v]) => `--alm-${k}:${v};`).join("");

function tokens(): string {
  const out: string[] = [];
  for (const [id, s] of Object.entries(SKINS)) {
    const at = `:root[data-alm-skin="${id}"]`;
    out.push(`${at}{${decl(s.shared)}--alm-on-voice:#fff}`);
    out.push(`${at},${at}[data-alm-mode="light"]{${decl(s.light)}}`);
    out.push(`${at}[data-alm-mode="dark"]{${decl(s.dark)}}`);
  }
  return out.join("\n");
}

// Signature details. Base rules in styles.ts carry !important (they override the
// preset's inline styles), so these do too, with the skin selector for weight.
const S = (id: string) => `:root[data-alm-skin="${id}"]`;
const FLAT_BUBBLE = (id: string) => `
${S(id)} .alm-say__bubble::before,${S(id)} .alm-say__bubble::after{content:none!important}
${S(id)} .alm-thk::before,${S(id)} .alm-thk::after{display:none!important}
${S(id)} .alm-thk{animation:none!important}
${S(id)} .alm-chapter b::before,${S(id)} .alm-chapter b::after{content:none!important}`;

const SIGNATURES = `
/* Almanac: the sun marks each chapter */
${S("almanac")} .alm-chapter small::before{content:"☉  ";color:var(--alm-gold);letter-spacing:0}

/* Solar: pull quotes, ruled sections, highlighter */
${FLAT_BUBBLE("solar")}
${S("solar")} .alm-say__medal{border-radius:0!important;box-shadow:none!important;font-family:var(--alm-font-body)!important}
${S("solar")} .alm-say__bubble{background:none!important;border:0!important;border-top:2px solid var(--c)!important;border-radius:0!important;box-shadow:none!important;padding:10px 0 4px!important}
${S("solar")} .alm-say__who{position:static!important;display:flex!important;background:none!important;box-shadow:none!important;color:var(--c)!important;padding:0 0 6px!important;font-weight:700!important}
${S("solar")} .alm-say--user .alm-say__who{justify-content:flex-end}
${S("solar")} .alm-say__tone{color:var(--alm-muted)!important;border-left-color:var(--alm-line)!important}
${S("solar")} .alm-say__line{font:italic 700 1.3em/1.28 var(--alm-font-display)!important}
${S("solar")} .alm-thk{border:0!important;border-left:6px solid var(--alm-accent)!important;border-radius:0!important;background:none!important;padding:2px 0 2px 14px!important;font:italic 700 19px/1.3 var(--alm-font-hand)!important}
${S("solar")} .alm-chapter{grid-template-columns:1fr!important;text-align:left!important;border-top:2px solid var(--alm-rule);padding-top:10px!important}
${S("solar")} .alm-chapter::before,${S("solar")} .alm-chapter::after{display:none}
${S("solar")} .alm-chapter b{font-style:normal!important;font-weight:900!important;background:linear-gradient(transparent 58%,var(--alm-accent) 58% 92%,transparent 92%);display:inline!important}
${S("solar")}[data-alm-mode="dark"] .alm-chapter b{background:linear-gradient(transparent 86%,var(--alm-accent) 86% 97%,transparent 97%)}
${S("solar")} .alm-chapter small{color:var(--alm-accent-2)!important;font-weight:700}
${S("solar")} details.alm-drawer{border:0!important;border-top:3px solid var(--alm-rule)!important}
${S("solar")} .alm-btn{border:2px solid var(--alm-rule)!important;box-shadow:none!important;text-transform:uppercase;letter-spacing:.06em;font-weight:700!important}
${S("solar")} .almp .card{border:0;border-top:3px solid var(--alm-rule);box-shadow:none}
${S("solar")} .almp .btn{border:2px solid var(--alm-rule);text-transform:uppercase;letter-spacing:.06em;font-weight:700}

/* Nocturne: arched portraits, whispered thoughts, filigree frames */
${S("nocturne")} .alm-say__medal{border-radius:50% 50% 4px 4px!important;font-style:italic!important;font-weight:600!important;font-size:22px!important}
${S("nocturne")} .alm-say__who{text-transform:none!important;font-style:italic;letter-spacing:.06em!important;font-size:13px!important}
${S("nocturne")} .alm-say__line{font-size:1.14em!important}
${S("nocturne")} .alm-thk{border:0!important;border-left:1px solid var(--c)!important;border-radius:0!important;background:none!important;padding:0 0 0 18px!important;font:italic 500 21px/1.3 var(--alm-font-hand)!important;animation:none!important}
${S("nocturne")} .alm-thk::before{content:"⸙";width:auto;height:auto;left:-7px;top:-4px;border:0;border-radius:0;background:var(--alm-panel);color:var(--c);font:14px/1 serif}
${S("nocturne")} .alm-thk::after{display:none}
${S("nocturne")} .alm-chapter::before,${S("nocturne")} .alm-chapter::after{background:linear-gradient(90deg,transparent,var(--alm-accent) 50%,transparent) center/100% 1px no-repeat}
${S("nocturne")} details.alm-drawer,${S("nocturne")} .almp .card{box-shadow:inset 0 0 0 4px var(--alm-panel),inset 0 0 0 5px var(--alm-line),var(--alm-lift)!important}

/* Botanical: specimen labels, tape, typewriter */
${FLAT_BUBBLE("botanical")}
${S("botanical")} .alm-say__medal{border-radius:4px!important;box-shadow:none!important;border:1px solid var(--alm-ink);font-family:var(--alm-font-mono)!important;font-weight:400!important}
${S("botanical")} .alm-say__bubble{border-radius:2px!important;background:var(--alm-panel)!important;box-shadow:none!important;border-left:3px solid var(--c)!important}
${S("botanical")} .alm-say--user .alm-say__bubble{border-left-width:1px!important;border-right:3px solid var(--c)!important}
${S("botanical")} .alm-say__who{border-radius:0!important;background:var(--alm-panel)!important;color:var(--c)!important;border:1px solid var(--c)}
${S("botanical")} .alm-say__tone{border-left-color:var(--alm-line)!important}
${S("botanical")} .alm-thk{border:0!important;border-radius:0!important;background:none!important;color:color-mix(in oklab,var(--alm-ink) 72%,var(--alm-panel))!important}
${S("botanical")} .alm-chapter::before,${S("botanical")} .alm-chapter::after{background:linear-gradient(var(--alm-ink),var(--alm-ink)) center/100% 1px no-repeat}
${S("botanical")} .alm-chapter b{font-style:normal!important}
${S("botanical")} details.alm-drawer{position:relative;overflow:visible!important;border-color:var(--alm-ink)!important}
${S("botanical")} details.alm-drawer::before{content:"";position:absolute;top:-9px;left:22px;width:74px;height:18px;background:color-mix(in oklab,var(--alm-gold) 38%,transparent);transform:rotate(-4deg);pointer-events:none}
${S("botanical")} .almp .card{border-color:var(--alm-ink);box-shadow:inset 0 0 0 3px var(--alm-panel),inset 0 0 0 4px var(--alm-line)}

/* Prism: holographic foil */
${S("prism")} details.alm-drawer,${S("prism")} details.alm-sub,${S("prism")} .almp .card{border:1.5px solid transparent!important;background:linear-gradient(var(--alm-panel),var(--alm-panel)) padding-box,var(--alm-holo) border-box!important}
${S("prism")} .alm-say__medal{box-shadow:0 0 0 2.5px var(--alm-panel),0 0 0 4.5px var(--alm-accent-2),0 0 16px -2px var(--alm-accent)!important}
${S("prism")} .alm-say__who{border-radius:99px!important}
${S("prism")} .alm-thk{border-style:solid!important;border-radius:14px!important;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font:italic 500 16px/1.4 var(--alm-font-hand)!important}
${S("prism")} .alm-chapter::before,${S("prism")} .alm-chapter::after{background:var(--alm-holo) center/100% 2px no-repeat}
${S("prism")} .alm-chapter b{font-style:normal!important;font-weight:800!important;background:var(--alm-holo);-webkit-background-clip:text;background-clip:text;color:transparent!important}
${S("prism")} .alm-chapter b::before,${S("prism")} .alm-chapter b::after{content:none!important}
${S("prism")} .alm-caret,${S("prism")} .alm-btn--primary,${S("prism")} .almp .btn.primary{background:var(--alm-holo)!important;color:#15152c!important;border-color:transparent!important}

/* Candy: stickers with hard shadows */
${S("candy")} details.alm-drawer,${S("candy")} details.alm-sub,${S("candy")} .almp .card{border:2.5px solid var(--alm-pop)!important;box-shadow:var(--alm-lift)!important}
${S("candy")} .alm-say__medal{border:2.5px solid var(--alm-pop);box-shadow:3px 3px 0 var(--alm-pop)!important;transform:rotate(-6deg)}
${S("candy")} .alm-say--user .alm-say__medal{transform:rotate(6deg)}
${S("candy")} .alm-say__bubble{border:2.5px solid var(--alm-pop)!important;box-shadow:4px 4px 0 var(--c)!important;background:color-mix(in oklab,var(--c) 14%,var(--alm-panel))!important}
${S("candy")} .alm-say__bubble::before{content:none!important}
${S("candy")} .alm-say__who{border:2px solid var(--alm-pop);border-radius:99px!important;transform:rotate(-2deg);font-weight:600!important}
${S("candy")} .alm-say--user .alm-say__who{transform:rotate(2deg)}
${S("candy")} .alm-thk{border:2.5px solid var(--alm-pop)!important;box-shadow:3px 3px 0 var(--c);font-weight:500!important;font-size:17px!important}
${S("candy")} .alm-chapter::before,${S("candy")} .alm-chapter::after{height:12px;background:radial-gradient(circle at 6px -2px,transparent 6px,var(--alm-accent) 6.5px 8.5px,transparent 9px) 0 0/12px 12px repeat-x}
${S("candy")} .alm-chapter b{font-style:normal!important;font-weight:700!important}
${S("candy")} .alm-btn,${S("candy")} .almp .btn{border:2.5px solid var(--alm-pop)!important;border-radius:99px!important;box-shadow:3px 3px 0 var(--alm-pop)!important}

/* Dossier: transcript speech, margin notes, stamps */
${FLAT_BUBBLE("dossier")}
${S("dossier")} .alm-say__medal{border-radius:3px!important;box-shadow:none!important}
${S("dossier")} .alm-say__bubble{background:var(--alm-panel)!important;border:1px solid var(--alm-line)!important;border-left:3px solid var(--c)!important;border-radius:2px!important;box-shadow:none!important}
${S("dossier")} .alm-say--user .alm-say__bubble{border-left-width:1px!important;border-right:3px solid var(--c)!important}
${S("dossier")} .alm-say__who{position:static!important;display:flex!important;background:none!important;box-shadow:none!important;color:var(--c)!important;padding:0 0 8px!important}
${S("dossier")} .alm-say--user .alm-say__who{justify-content:flex-end}
${S("dossier")} .alm-say__tone{color:var(--alm-muted)!important;border-left-color:var(--alm-line)!important}
${S("dossier")} .alm-thk{border:0!important;border-left:2px solid var(--c)!important;border-radius:0!important;background:none!important;padding:4px 0 4px 14px!important;font-size:25px!important}
${S("dossier")} .alm-chapter::before,${S("dossier")} .alm-chapter::after{background:linear-gradient(var(--alm-ink),var(--alm-ink)) center/100% 1px no-repeat}
${S("dossier")} .alm-chapter b{font-style:normal!important;font-size:19px!important;text-transform:uppercase;letter-spacing:.12em}
${S("dossier")} .alm-list li.due::after{content:"due";display:inline-block;margin-left:8px;padding:1px 6px;border:1.5px solid var(--alm-accent);color:var(--alm-accent);font:600 9.5px/1.4 var(--alm-font-mono);letter-spacing:.2em;text-transform:uppercase;transform:rotate(-3deg)}

/* Scriptorium: seals, ribbons, blackletter initials */
${S("scriptorium")} .alm-say__medal{border-radius:50% 50% 8px 8px!important;font:400 24px/1 "UnifrakturMaguntia",serif!important;box-shadow:0 0 0 2px var(--alm-panel),0 0 0 3.5px var(--alm-gold)!important}
${S("scriptorium")} .alm-say__bubble{background:color-mix(in oklab,var(--c) 8%,var(--alm-panel))!important;box-shadow:none!important}
${S("scriptorium")} .alm-say__who{border-radius:0!important;clip-path:polygon(0 0,100% 0,calc(100% - 7px) 50%,100% 100%,0 100%);padding-right:16px!important;letter-spacing:.06em!important;font-size:12px!important}
${S("scriptorium")} .alm-say--user .alm-say__who{clip-path:polygon(0 0,100% 0,100% 100%,0 100%,7px 50%);padding-left:16px!important;padding-right:9px!important}
${S("scriptorium")} .alm-say__line{font-size:1.14em!important}
${S("scriptorium")} .alm-thk{border-style:dotted!important;font:italic 400 19px/1.3 var(--alm-font-hand)!important}
${S("scriptorium")} .alm-chapter::before,${S("scriptorium")} .alm-chapter::after{background:linear-gradient(var(--alm-accent),var(--alm-accent)) center 3px/100% 1px no-repeat,linear-gradient(var(--alm-accent),var(--alm-accent)) center 6px/100% 1px no-repeat}
${S("scriptorium")} .alm-chapter b{font-weight:400!important}
${S("scriptorium")} .alm-chapter+p::first-letter{float:left;font:400 3.6em/.82 "UnifrakturMaguntia",serif;color:var(--alm-accent);padding:.08em .12em 0 0;text-shadow:1px 1px 0 var(--alm-gold)}
${S("scriptorium")} details.alm-drawer{outline:1px solid var(--alm-line);outline-offset:-5px}
${S("scriptorium")} .almp .card{box-shadow:inset 0 0 0 3px var(--alm-panel),inset 0 0 0 4px var(--alm-line)}

/* Arcana: glowing voices, gold frames */
${S("arcana")} .alm-say__medal{box-shadow:0 0 0 2px var(--alm-panel),0 0 0 3.5px color-mix(in oklab,var(--c) 70%,transparent),0 0 20px -2px var(--c)!important}
${S("arcana")} .alm-say__who{border-radius:99px!important;letter-spacing:.2em!important;font-size:10px!important}
${S("arcana")} .alm-say__tone{font-family:var(--alm-font-body)!important}
${S("arcana")} .alm-thk{border-style:solid!important;border-color:color-mix(in oklab,var(--c) 40%,transparent)!important;box-shadow:0 0 24px -8px var(--c);font:italic 400 18px/1.35 var(--alm-font-hand)!important}
${S("arcana")} .alm-chapter::before,${S("arcana")} .alm-chapter::after{background:linear-gradient(90deg,transparent,var(--alm-gold) 40%,transparent) center/100% 1px no-repeat,radial-gradient(circle,var(--alm-gold) 0 2px,transparent 2.5px) center/8px 8px no-repeat}
${S("arcana")} .alm-chapter b{font-family:"Cinzel Decorative",serif!important;font-style:normal!important;font-size:22px!important;color:var(--alm-accent)!important}
${S("arcana")} details.alm-drawer,${S("arcana")} .almp .card{box-shadow:inset 0 0 0 5px var(--alm-panel),inset 0 0 0 6px color-mix(in oklab,var(--alm-gold) 30%,transparent),var(--alm-lift)!important}
@media (prefers-reduced-motion:no-preference){${S("arcana")} .alm-say__medal{animation:alm-glow 4s ease-in-out infinite alternate}}
@keyframes alm-glow{to{box-shadow:0 0 0 2px var(--alm-panel),0 0 0 3.5px color-mix(in oklab,var(--c) 90%,transparent),0 0 28px 0 var(--c)}}

/* Orbital: clipped corners, terminal thoughts */
${FLAT_BUBBLE("orbital")}
${S("orbital")} details.alm-drawer,${S("orbital")} .almp .card{clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
${S("orbital")} details.alm-drawer{border-top:3px solid var(--alm-accent)!important}
${S("orbital")} .alm-say__medal{border-radius:0!important;clip-path:polygon(0 0,70% 0,100% 30%,100% 100%,30% 100%,0 70%);box-shadow:none!important;font-family:var(--alm-font-mono)!important;font-weight:500!important}
${S("orbital")} .alm-say__bubble{border-radius:0!important;background:var(--alm-panel)!important;border:1px solid var(--alm-line)!important;border-left:3px solid var(--c)!important;box-shadow:none!important}
${S("orbital")} .alm-say--user .alm-say__bubble{border-left-width:1px!important;border-right:3px solid var(--c)!important}
${S("orbital")} .alm-say__who{border-radius:0!important;letter-spacing:.14em!important}
${S("orbital")} .alm-say__tone{font:500 10px/1 var(--alm-font-mono)!important;font-style:normal!important;text-transform:uppercase!important;letter-spacing:.1em!important}
${S("orbital")} .alm-thk{border-radius:0!important;border:1px dashed var(--c)!important;font:400 13.5px/1.5 var(--alm-font-hand)!important;padding:8px 14px!important}
${S("orbital")} .alm-thk__lab::before{content:"> ";letter-spacing:0}
${S("orbital")} .alm-chapter::before,${S("orbital")} .alm-chapter::after{background:repeating-linear-gradient(90deg,var(--alm-ink) 0 6px,transparent 6px 10px) center/100% 2px no-repeat}
${S("orbital")} .alm-chapter b{font-style:normal!important;font-weight:700!important;text-transform:uppercase;letter-spacing:.06em}
${S("orbital")} .alm-pill,${S("orbital")} .alm-caret,${S("orbital")} .alm-btn,${S("orbital")} .alm-tag,${S("orbital")} .alm-seg i,${S("orbital")} .almp .btn,${S("orbital")} .almp .pill{border-radius:0!important}
${S("orbital")} .alm-btn{text-transform:uppercase;letter-spacing:.08em}

/* Posy: floral print, a sprig of roses, round pills */
${S("posy")} .alm-say__who{border-radius:99px!important;padding:5px 11px!important}
${S("posy")} .alm-say__medal{box-shadow:0 0 0 3px var(--alm-panel),0 0 0 5px color-mix(in oklab,var(--c) 35%,transparent)!important}
${S("posy")} .alm-thk{border-style:dotted!important;border-width:2px!important;font-size:25px!important}
${S("posy")} .alm-thk__lab::after{content:" ✿";color:var(--alm-accent)}
${S("posy")} .alm-chapter::before,${S("posy")} .alm-chapter::after{background:radial-gradient(circle,var(--alm-accent) 0 3px,transparent 3.5px) center/12px 12px no-repeat,linear-gradient(var(--alm-accent-2),var(--alm-accent-2)) center/100% 1px no-repeat}
${S("posy")} .alm-chapter b{font-style:normal!important;font-weight:400!important}
${S("posy")} .alm-drawer__body{position:relative}
${S("posy")} .alm-drawer__body::after{content:"";position:absolute;right:-6px;bottom:-6px;width:84px;height:84px;background:var(--alm-sprig) center/contain no-repeat;opacity:.6;pointer-events:none}
${S("posy")} .alm-btn,${S("posy")} .almp .btn,${S("posy")} .alm-caret{border-radius:99px!important}
${S("posy")} .alm-btn--primary,${S("posy")} .almp .btn.primary{background:var(--alm-accent-2)!important;border-color:color-mix(in oklab,var(--alm-accent-2) 70%,#000)!important}
`;

export const SKIN_CSS = tokens() + "\n" + SIGNATURES;
