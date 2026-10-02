// The scene plate, drawn by the Ledger: the header (🗓 … 🕰 HH:MM ☁ condition ·
// temp · wind / 📍 place / # Title) becomes a living sky over the place it names.
//
// The 📍 path picks a place kind (about thirty outdoors, two dozen rooms); a
// seed taken from the path picks one of four drawn variants, a mirror, a tint,
// a frame and an offset, so two places of one kind still differ while one place
// always looks the same. A seed from the title and the hour picks the title
// layout and a sky accent. The plate is an HTML island (its own <style>, inside
// a shadow root), so each message carries its CSS: the base sheet plus only the
// chosen place, accent and genre.
//
// The preset draws a lighter plate from the same header when the Ledger is not
// installed (preset/src/plate.ts); here the header is replaced before the
// display regex runs, so that regex finds nothing left to draw.
import { kindChunks, KIND_WORDS, ROOM_WORDS } from "./kinds";
import { FX, GENRE_FX, pickFx } from "./fx";
import { PLATE_CSS, PLATE_FIND, minCss } from "./style";
import { SLOTS } from "./rooms";

export { PLATE_FIND, PLATE_CSS, minCss };
export { kindChunks };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const BANDS = ["night", "night", "small", "small", "predawn", "dawn", "sunrise", "morning", "morning", "morning", "morning", "midday", "midday", "midday", "afternoon", "afternoon", "afternoon", "golden", "sunset", "dusk", "evening", "evening", "night", "night"];
const GLYPH_WX: Record<string, string> = { "☀": "clear", "🌙": "clear", "✨": "clear", "🌤": "fair", "⛅": "broken", "🌥": "broken", "☁": "overcast", "🌦": "showers", "🌧": "rain", "⛈": "storm", "🌩": "storm", "🌨": "snow", "❄": "snow", "🧊": "sleet", "🌫": "fog", "🌬": "wind", "🌪": "storm", "🔥": "heat", "🌡": "heat" };
const WIND_DEG: Record<string, number> = { N: 180, NNE: 202, NE: 225, ENE: 247, E: 270, ESE: 292, SE: 315, SSE: 337, S: 0, SSW: 22, SW: 45, WSW: 67, W: 90, WNW: 112, NW: 135, NNW: 157 };

function weather(glyph: string, cond: string): string {
  if (glyph && GLYPH_WX[glyph]) return GLYPH_WX[glyph];
  if (/storm|thunder/i.test(cond)) return "storm";
  if (/snow|blizzard/i.test(cond)) return "snow";
  if (/rain|drizzle|shower/i.test(cond)) return "rain";
  if (/fog|mist/i.test(cond)) return "fog";
  if (/overcast|cloud/i.test(cond)) return "overcast";
  return "clear";
}
const intensity = (c: string) => /torrential|downpour|blizzard|driving/i.test(c) ? "torrential" : /heavy|hard|thick|dense/i.test(c) ? "heavy" : /light|drizzle|thin|fine|patchy/i.test(c) ? "light" : "moderate";
function season(date: string): string {
  if (/spring/i.test(date)) return "spring";
  if (/summer|midsummer/i.test(date)) return "summer";
  if (/autumn|fall\b|harvest/i.test(date)) return "autumn";
  if (/winter|midwinter|yule/i.test(date)) return "winter";
  if (/\b(?:Mar|Apr|May)[a-z]*\b/.test(date)) return "spring";
  if (/\b(?:Jun|Jul|Aug)[a-z]*\b/.test(date)) return "summer";
  if (/\b(?:Sep|Oct|Nov)[a-z]*\b/.test(date)) return "autumn";
  if (/\b(?:Dec|Jan|Feb)[a-z]*\b/.test(date)) return "winter";
  return "";
}
function moonShadow(moon: string): string {
  const m = (re: RegExp) => re.test(moon);
  return m(/🌑|new moon/i) ? "44px" : m(/🌒|waxing crescent/i) ? "26px" : m(/🌓|first quarter/i) ? "18px" : m(/🌔|waxing gibbous/i) ? "8px" : m(/🌖|waning gibbous/i) ? "-8px" : m(/🌗|last quarter|third quarter/i) ? "-18px" : m(/🌘|waning crescent/i) ? "-26px" : "0px";
}
/** Era from a year in the date line, else from the genre: it picks skylines and the default room. */
export function eraOf(date: string, genre: string): string {
  if (/\b1[0-8]\d\d\b/.test(date)) return "old";
  if (/\b19[0-4]\d\b/.test(date)) return "deco";
  if (/\b(?:2[1-9]\d\d|[3-9]\d\d\d)\b/.test(date)) return "future";
  return genre === "fantasy" || genre === "dark_fantasy" ? "old" : genre === "scifi" ? "future" : "modern";
}

const EXT_A = ["space", "rooftop", "graveyard", "ruins", "castle"];
/** Kinds in the order they are tried: a few outdoor words that beat any room, then rooms, then the rest. */
export const PLACE_ORDER: [string, string][] = [
  ...EXT_A.map((k) => KIND_WORDS.find(([w]) => w === k)!),
  ...ROOM_WORDS.map(([k, w]) => [`r_${k}`, w] as [string, string]),
  ["r_default", "room|interior|inside|indoors|hall"],
  ...KIND_WORDS.filter(([k]) => !EXT_A.includes(k)),
];
export const wordRe = (w: string) => new RegExp(String.raw`\b(?:${w})(?:s|es)?(?![a-z])`, "i");
const ORDER_RE = PLACE_ORDER.map(([k, w]) => [k, wordRe(w)] as const);
const firstKind = (text: string) => ORDER_RE.find(([, re]) => re.test(text))?.[0];

/** The place kind for a 📍 path: the last segment decides first, then the whole path. */
export function placeKind(path: string, era: string): string {
  const last = path.replace(/^.*›[ \t]*/, "");
  const k = firstKind(last) ?? firstKind(path) ?? "town";
  if (k === "city") return `city_${era}`;
  if (k === "rooftop") return era === "old" ? "rooftop_old" : "rooftop";
  if (k === "r_default") return era === "old" || era === "deco" ? "r_tavern" : era === "future" ? "r_lab" : "r_home";
  return k;
}

let ART: Map<string, string> | null = null;
const art = (key: string) => (ART ??= new Map(kindChunks().map((c) => [c.key, minCss(c.css)]))).get(key) ?? "";
const BASE = minCss(PLATE_CSS);
const vowels = (s: string, set: RegExp) => s.replace(set, "").length;

export interface PlateHeader {
  date: string; hour: number; minute: string; glyph: string; cond: string;
  rise?: string; set?: string; moon?: string; place: string; title: string;
}

/**
 * The plate's HTML for one header. `genre` is the preset's lead genre (drives
 * fonts and atmosphere); `as` ("kind-v") forces a place drawing, for previews.
 */
export function drawPlate(h: PlateHeader, genre?: string, as?: string): string {
  const lead = genre || "";
  const g = lead || "drama";
  const era = eraOf(h.date, lead);
  const kind = as ? as.replace(/-\d$/, "") : placeKind(h.place, era);
  const last = h.place.replace(/^.*›[ \t]*/, "");
  const sd = h.place.length * 7 + vowels(h.place, /[^aeiouy]/gi) * 13 + last.length * 3 + 1;
  const ss = h.title.length * 5 + vowels(h.title, /[^aeiou]/gi) * 11 + h.hour * 7;
  const v = as ? Number(as.slice(-1)) : sd % 4;
  const band = BANDS[h.hour] ?? "night";
  const wx = weather(h.glyph, h.cond);
  const fx = pickFx(ss, band, wx, kind);
  const wind = /\bwind[ \t]+(N|NNE|NE|ENE|E|ESE|SE|SSE|S|SSW|SW|WSW|W|WNW|NW|NNW)\b/i.exec(h.cond)?.[1]?.toUpperCase();
  const tc = /(-?\d{1,3})[ \t]*°[ \t]*C\b/i.exec(h.cond)?.[1];
  const sun = h.rise && h.set ? `--rise:calc(${h.rise.replace(":", " + ")} / 60);--set:calc(${h.set.replace(":", " + ")} / 60);` : "";
  const style = `--h:calc(${h.hour} + ${h.minute} / 60);${sun}--ph:${moonShadow(h.moon ?? "")};--wd:${wind ? WIND_DEG[wind] : 90};${tc ? `--t:clamp(0,calc((${tc} + 10) / 50),1);` : ""}--ox:${(sd * 37) % 240 - 120}px;--kbo:${(sd * 29) % 100}%`;
  const attrs = {
    k: `${kind}-${v}`, place: kind, era, band, wx, int: intensity(h.cond), season: season(h.date), genre: g,
    flip: last.length % 2, tint: Math.floor(sd / 4) % 5, frame: Math.floor(sd / 3) % 5,
    lay: (h.title.length * 3 + vowels(h.title, /[^aeiou]/gi)) % 8, fx,
  };
  const css = BASE + art(attrs.k)
    + (FX[fx] ? minCss(FX[fx].replaceAll("&", `[data-fx=${fx}]`)) : "")
    + (GENRE_FX[g] ? minCss(GENRE_FX[g].replaceAll("&", `[data-genre=${g}]`)) : "");

  const segs = h.place.split(/[ \t]*›[ \t]*/).filter((s) => s.length).map(esc);
  const crumb = segs.length > 1 ? `${segs.slice(0, -1).join(" <span>›</span> ")} <span>›</span> <b>${segs[segs.length - 1]}</b>` : segs.join("");
  const day = /^\s*((?:Day|Dia|Día|Jour|Tag)\s*\d+)/i.exec(h.date)?.[1] ?? h.date;
  const dayN = /^\s*(?:Day|Dia|Día|Jour|Tag)\s*(\d+)/i.exec(h.date)?.[1] ?? "";
  const kicker = esc(day) + (lead ? ` · ${esc(lead.replace(/_/g, " "))}` : "");
  const dateOnly = h.date.replace(/^\s*(?:(?:Day|Dia|Día|Jour|Tag)\s*\d+\s*[·•|,]\s*)?/i, "");
  const pills = esc(h.cond)
    .replace(/\bwind[ \t]+([NSEW]{1,3})\b/i, `<i class="wind">➤</i> $1`)
    .replace(/(-?\d{1,3})[ \t]*°[ \t]*([CF])\b/i, `<i class="thermo"></i>$1°$2`)
    .replace(/[ \t]*[·•|][ \t]*/g, `</span><span class="gl">`);
  const clock = `${h.hour < 10 ? "0" : ""}${h.hour}:${h.minute}`;

  return `<div class="p" ${Object.entries(attrs).map(([k, x]) => `data-${k}="${x}"`).join(" ")} style="${style}"><style>${css}</style>`
    + `<div class="scene"><div class="l sky"></div><div class="l wash"></div><div class="l glow"></div><div class="l stars"></div><div class="l fx"></div><div class="l fx2"></div><div class="l rays"></div><div class="l sun"></div><div class="l moon"></div><div class="l clouds"></div><div class="l clouds2"></div><div class="l gx"></div><div class="l kx2"></div><div class="l ground"></div>`
    + `<div class="far land"></div><div class="l water"></div><div class="l glint"></div><div class="l mglint"></div><div class="refl land"></div><div class="mid land"></div><div class="lit land"></div><div class="l kx"></div><div class="near land"></div><div class="fg land"></div>`
    + `<div class="l fog"></div><div class="l windl"></div><div class="l heat"></div><div class="l rain"></div><div class="l rain r2"></div><div class="l snow"></div><div class="l snow big"></div><div class="l flash"></div></div>`
    + (kind.startsWith("r_") ? `<div class="l room wall"></div><div class="l room walldim"></div><div class="l room wain"></div><div class="l room lamp"></div><div class="beam"></div><div class="wf"></div><div class="sill"></div><div class="room ra"></div><div class="room rb"></div><div class="room rc"></div><div class="room rd"></div>`
      + `<div class="room set">${"<i></i>".repeat(SLOTS.i)}${"<b></b>".repeat(SLOTS.b)}</div><div class="l room spill"></div><div class="l room motes"></div><div class="l room roomflash"></div><div class="l room vig"></div>` : "")
    + `<div class="l scrim"></div><div class="l grade"></div><div class="l grain"></div><div class="l frame"></div>`
    + `<div class="top"><span class="crumb">${crumb}</span><span class="dial"><i class="mk"></i><span>${clock}</span></span></div>`
    + `<div class="title" data-n="${dayN}"><span class="kicker">${kicker}</span><h3 class="ttl">${esc(h.title)}</h3></div>`
    + `<div class="strip"><span class="gl">🗓 ${esc(dateOnly)}</span><span class="gl">${h.glyph ? `${h.glyph} ` : ""}${pills}</span>${h.rise ? `<span class="gl">☀ ${h.rise} – ${h.set}</span>` : ""}${h.moon ? `<span class="gl"><i class="mo"></i>${esc(h.moon)}</span>` : ""}</div></div>`;
}

/** Replace every scene header in a reply with its drawn plate. */
export function drawPlates(content: string, genre?: string): string {
  return content.replace(new RegExp(PLATE_FIND, "g"), (all, date, hour, minute, glyph, cond, rh, rm, sh, sm, moon, place, title) => {
    const lead = /^\n/.test(all) ? "\n" : "";
    return `${lead}\n${drawPlate({
      date: date ?? "", hour: parseInt(hour, 10), minute, glyph: glyph ?? "", cond: cond ?? "",
      rise: rh ? `${rh}:${rm}` : undefined, set: sh ? `${sh}:${sm}` : undefined, moon: moon || undefined,
      place: (place ?? "").trim(), title: (title ?? "").trim(),
    }, genre)}\n`;
  });
}
