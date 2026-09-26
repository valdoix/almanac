// Sun and moon. Solar times use the standard declination / hour-angle model in
// local solar time (no time zones or equation of time — this is fiction, but
// the day length is right for the season and latitude).

import { hash } from "../util";

const BANDS: Record<string, number> = {
  equatorial: 2, tropical: 15, subtropical: 28, temperate: 45, maritime: 50, continental: 48,
  subpolar: 62, subarctic: 64, polar: 75, arctic: 75,
};

export function latitudeFrom(text: string | undefined): number {
  const t = (text ?? "").toLowerCase();
  const n = /(-?\d+(?:\.\d+)?)\s*°?\s*([ns])?/.exec(t);
  if (n) {
    let v = parseFloat(n[1]);
    if (n[2] === "s") v = -Math.abs(v);
    return Math.max(-89, Math.min(89, v));
  }
  const south = /\bsouth/.test(t);
  for (const [k, v] of Object.entries(BANDS)) if (t.includes(k)) return south ? -v : v;
  return south ? -45 : 45;
}

export interface SunInfo {
  sunrise: number | null; // minute of day; null = no sunrise (polar night / midnight sun)
  sunset: number | null;
  dawn: number | null; // civil twilight start
  dusk: number | null;
  daylightMin: number;
  polar: "none" | "night" | "day";
}

const rad = (d: number) => (d * Math.PI) / 180;

/** doy: 0-based day of the (northern-referenced) year; yearLen for custom calendars. */
export function sunFor(doy: number, latitude: number, yearLen = 365): SunInfo {
  const scaled = (doy / yearLen) * 365;
  const decl = 23.44 * Math.sin(rad((360 / 365) * (scaled - 80)));
  const phi = rad(latitude);
  const d = rad(decl);
  const hourAngle = (altDeg: number) => {
    const c = (Math.sin(rad(altDeg)) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d));
    if (c <= -1) return 180; // always above
    if (c >= 1) return 0; // never above
    return (Math.acos(c) * 180) / Math.PI;
  };
  const h0 = hourAngle(-0.833);
  const hc = hourAngle(-6);
  const noon = 12 * 60;
  const daylightMin = Math.round((2 * h0 * 60) / 15);
  const polar = h0 >= 180 ? "day" : h0 <= 0 ? "night" : "none";
  const mk = (h: number, sign: number) => (h <= 0 || h >= 180 ? null : Math.round(noon + (sign * h * 60) / 15));
  return { sunrise: mk(h0, -1), sunset: mk(h0, 1), dawn: mk(hc, -1), dusk: mk(hc, 1), daylightMin, polar };
}

export const MOON_PHASES = [
  { name: "new moon", glyph: "🌑" },
  { name: "waxing crescent", glyph: "🌒" },
  { name: "first quarter", glyph: "🌓" },
  { name: "waxing gibbous", glyph: "🌔" },
  { name: "full moon", glyph: "🌕" },
  { name: "waning gibbous", glyph: "🌖" },
  { name: "last quarter", glyph: "🌗" },
  { name: "waning crescent", glyph: "🌘" },
];

const SYNODIC = 29.530588;

export function moonOffset(seed: string, anchor?: { day: number; phase: string }): number {
  if (anchor) {
    const idx = MOON_PHASES.findIndex((p) => anchor.phase.toLowerCase().includes(p.name.split(" ")[0]) && anchor.phase.toLowerCase().includes(p.name.split(" ").slice(-1)[0]));
    if (idx >= 0) return ((idx / 8) * SYNODIC - (anchor.day - 1) + SYNODIC * 10) % SYNODIC;
  }
  return (parseInt(hash(seed + ":moon"), 16) % 2953) / 100;
}

export function moonFor(day: number, minute: number, offset: number): { name: string; glyph: string; illumination: number; age: number } {
  const age = (((day - 1 + minute / 1440 + offset) % SYNODIC) + SYNODIC) % SYNODIC;
  const idx = Math.floor(((age / SYNODIC) * 8 + 0.5)) % 8;
  const illumination = Math.round(((1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2) * 100);
  return { ...MOON_PHASES[idx], illumination, age };
}

/** The 12 sky bands the scene plate uses. */
export function skyBand(minute: number, sun: SunInfo): string {
  const h = minute / 60;
  const rise = (sun.sunrise ?? 6 * 60) / 60;
  const set = (sun.sunset ?? 18 * 60) / 60;
  if (sun.polar === "night") return h > 10 && h < 14 ? "dusk" : "deep night";
  if (sun.polar === "day") return h < 3 || h > 22 ? "golden hour" : h < 11 ? "morning" : h < 14 ? "midday" : "afternoon";
  if (h < rise - 3) return h < 3 ? "deep night" : "small hours";
  if (h < rise - 1) return "pre-dawn";
  if (h < rise - 0.25) return "dawn";
  if (h < rise + 0.75) return "sunrise";
  if (h < 11) return "morning";
  if (h < 14) return "midday";
  if (h < set - 1.5) return "afternoon";
  if (h < set - 0.25) return "golden hour";
  if (h < set + 0.5) return "sunset";
  if (h < set + 1.5) return "dusk";
  if (h < 23) return "evening";
  return "deep night";
}
