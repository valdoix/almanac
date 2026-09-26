// Deterministic weather. A climate profile + season gives temperature ranges
// and wet/dry odds; weather evolves hour by hour as a Markov walk along a
// cloud/precipitation ladder toward the target of the current *front* (fronts
// persist 6–36 h). Everything is seeded from the chat id and the hour, so swipes
// never reroll the sky. The model's `wx` op is truth: it becomes the anchor the
// walk continues from.

import { hash, rng } from "../util";

export const LADDER = ["clear", "fair", "broken cloud", "overcast", "drizzle", "rain", "heavy rain", "storm"] as const;
export type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface SeasonProfile {
  tmin: number;
  tmax: number;
  /** probability that a front is wet (targets drizzle or worse) */
  wet: number;
  /** probability that a wet front is stormy */
  storm: number;
  fog: number; // 0..1 tendency for dawn fog
  wind: number; // 0..1 base windiness
}

export interface ClimateProfile {
  id: string;
  label: string;
  seasons: Record<"spring" | "summer" | "autumn" | "winter", SeasonProfile>;
  diurnal: number; // multiplier on daily swing
}

const P = (tmin: number, tmax: number, wet: number, storm: number, fog: number, wind: number): SeasonProfile => ({ tmin, tmax, wet, storm, fog, wind });

export const CLIMATES: Record<string, ClimateProfile> = {
  maritime: { id: "maritime", label: "temperate maritime", diurnal: 0.8, seasons: { spring: P(5, 13, 0.45, 0.08, 0.3, 0.5), summer: P(12, 21, 0.35, 0.12, 0.15, 0.35), autumn: P(7, 14, 0.55, 0.15, 0.45, 0.6), winter: P(1, 7, 0.55, 0.12, 0.4, 0.65) } },
  continental: { id: "continental", label: "continental", diurnal: 1.2, seasons: { spring: P(2, 15, 0.35, 0.15, 0.2, 0.45), summer: P(15, 28, 0.3, 0.3, 0.1, 0.3), autumn: P(3, 13, 0.35, 0.08, 0.35, 0.45), winter: P(-12, -2, 0.35, 0.05, 0.2, 0.5) } },
  mediterranean: { id: "mediterranean", label: "mediterranean", diurnal: 1, seasons: { spring: P(10, 20, 0.25, 0.1, 0.1, 0.35), summer: P(19, 31, 0.05, 0.2, 0.05, 0.3), autumn: P(14, 23, 0.3, 0.2, 0.15, 0.35), winter: P(6, 14, 0.4, 0.12, 0.2, 0.45) } },
  desert: { id: "desert", label: "desert", diurnal: 1.8, seasons: { spring: P(14, 30, 0.04, 0.3, 0.02, 0.5), summer: P(24, 42, 0.03, 0.4, 0.01, 0.45), autumn: P(15, 31, 0.04, 0.3, 0.02, 0.45), winter: P(4, 19, 0.06, 0.2, 0.05, 0.4) } },
  tropical: { id: "tropical", label: "tropical", diurnal: 0.6, seasons: { spring: P(23, 31, 0.5, 0.4, 0.2, 0.3), summer: P(24, 32, 0.6, 0.45, 0.15, 0.3), autumn: P(23, 31, 0.55, 0.45, 0.2, 0.35), winter: P(22, 30, 0.4, 0.3, 0.2, 0.3) } },
  monsoon: { id: "monsoon", label: "monsoon", diurnal: 0.7, seasons: { spring: P(24, 35, 0.2, 0.3, 0.1, 0.35), summer: P(25, 31, 0.85, 0.5, 0.2, 0.5), autumn: P(22, 30, 0.45, 0.35, 0.25, 0.35), winter: P(14, 26, 0.08, 0.1, 0.3, 0.25) } },
  subarctic: { id: "subarctic", label: "subarctic", diurnal: 0.9, seasons: { spring: P(-6, 4, 0.35, 0.05, 0.2, 0.5), summer: P(8, 18, 0.4, 0.12, 0.2, 0.4), autumn: P(-2, 6, 0.45, 0.08, 0.3, 0.55), winter: P(-24, -12, 0.35, 0.05, 0.15, 0.55) } },
  alpine: { id: "alpine", label: "alpine", diurnal: 1.4, seasons: { spring: P(-3, 8, 0.45, 0.15, 0.3, 0.6), summer: P(5, 17, 0.45, 0.35, 0.3, 0.5), autumn: P(-2, 8, 0.4, 0.1, 0.4, 0.6), winter: P(-14, -4, 0.45, 0.1, 0.25, 0.7) } },
  polar: { id: "polar", label: "polar", diurnal: 0.4, seasons: { spring: P(-25, -12, 0.2, 0.05, 0.1, 0.7), summer: P(-3, 4, 0.3, 0.05, 0.3, 0.6), autumn: P(-20, -8, 0.3, 0.05, 0.2, 0.7), winter: P(-38, -25, 0.2, 0.05, 0.05, 0.75) } },
};

export function climateFrom(text: string | undefined): ClimateProfile {
  const t = (text ?? "").toLowerCase();
  const rules: [RegExp, string][] = [
    [/monsoon/, "monsoon"], [/tropic|jungle|rainforest|equator|humid/, "tropical"], [/desert|arid|dune|sahara/, "desert"],
    [/mediterran|dry summer/, "mediterranean"], [/polar|arctic|antarctic|tundra|ice sheet/, "polar"],
    [/subarctic|boreal|taiga|northern forest/, "subarctic"], [/alpine|mountain|highland/, "alpine"],
    [/continental|steppe|prairie|plains/, "continental"], [/maritime|oceanic|coastal|temperate|island|rain/, "maritime"],
  ];
  for (const [re, id] of rules) if (re.test(t)) return CLIMATES[id];
  return CLIMATES.maritime;
}

/** Map free weather text to a ladder level (plus fog/snow/wind flags). */
export function levelOf(condition: string): { level: Level; fog: boolean; wind: boolean } {
  const c = condition.toLowerCase();
  const fog = /fog|mist|haze|smog/.test(c);
  const wind = /wind|gale|gust|squall/.test(c);
  let level: Level = 1;
  if (/storm|thunder|lightning|tempest|blizzard|hurricane|typhoon|monsoon downpour/.test(c)) level = 7;
  else if (/heavy|downpour|torrential|pouring|driving/.test(c) && /rain|snow|sleet|shower/.test(c)) level = 6;
  else if (/rain|snow|sleet|shower|hail/.test(c)) level = /light|shower|flurr|patchy/.test(c) ? 4 : 5;
  else if (/drizzle|spit|flurr/.test(c)) level = 4;
  else if (/overcast|grey|gray|cloudy|leaden|dull/.test(c)) level = /partly|broken|scattered/.test(c) ? 2 : 3;
  else if (/broken|scattered|partly|patchy cloud/.test(c)) level = 2;
  else if (/fair|high cloud|wisps|hazy sun/.test(c)) level = 1;
  else if (/clear|sunny|cloudless|bright|starry|starlit/.test(c)) level = 0;
  else if (fog) level = 3;
  return { level, fog, wind };
}

export interface Anchor {
  abs: number; // absolute minute
  level: Level;
  fog?: boolean;
  tempC?: number;
}

export interface Scheduled {
  fromAbs: number;
  toAbs: number;
  level: Level;
  label: string;
}

export interface WeatherInput {
  seed: string;
  climate: ClimateProfile;
  season: "spring" | "summer" | "autumn" | "winter";
  anchor?: Anchor | null;
  scheduled?: Scheduled[];
  /** Temperature shift for the place (altitude, sea) — optional. */
  tempShift?: number;
}

export interface WeatherHour {
  abs: number;
  level: Level;
  fog: boolean;
  tempC: number;
  windDir: string;
  windStrength: "calm" | "light" | "moderate" | "strong" | "gale";
  condition: string;
  intensity?: string;
  glyph: string;
}

const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function frontAt(seed: string, hourAbs: number, p: SeasonProfile): { idx: number; target: Level; dir: string; windy: number } {
  // Fronts tile the hour axis with seeded lengths (6–36 h). Blocks of 240 h keep lookup O(1)-ish.
  const block = Math.floor(hourAbs / 240);
  const r = rng(`${seed}:fronts:${block}`);
  let h = block * 240 - Math.floor(r() * 12);
  let idx = block * 100;
  while (true) {
    const len = 6 + Math.floor(r() * 31);
    if (hourAbs < h + len) break;
    h += len;
    idx++;
  }
  const fr = rng(`${seed}:front:${idx}`);
  const wet = fr() < p.wet;
  let target: Level;
  if (!wet) target = ([0, 0, 1, 1, 2, 3] as Level[])[Math.floor(fr() * 6)];
  else if (fr() < p.storm) target = 7;
  else target = ([4, 5, 5, 6] as Level[])[Math.floor(fr() * 4)];
  const dir = DIRS[Math.floor(fr() * 8)];
  return { idx, target, dir, windy: fr() };
}

function tempAt(input: WeatherInput, hourAbs: number, level: Level): number {
  const p = input.climate.seasons[input.season];
  const day = Math.floor(hourAbs / 24);
  const h = hourAbs % 24;
  const r = rng(`${input.seed}:temp:${day}`);
  const dayShift = (r() - 0.5) * 6;
  const swing = ((p.tmax - p.tmin) * input.climate.diurnal) / (level >= 3 ? 1.8 : 1);
  const mid = (p.tmax + p.tmin) / 2 + dayShift - (level >= 5 ? 2 : level >= 3 ? 1 : 0) + (input.tempShift ?? 0);
  // Minimum near 05:00, maximum near 15:00
  const hh = h < 5 ? h + 24 : h;
  const shape = hh <= 15 ? -Math.cos((Math.PI * (hh - 5)) / 10) : Math.cos((Math.PI * (hh - 15)) / 14);
  return Math.round((mid + (shape * swing) / 2) * 10) / 10;
}

export function describe(level: Level, fog: boolean, tempC: number, isNight: boolean): { condition: string; intensity?: string; glyph: string } {
  const snow = tempC <= 0.5;
  const sleet = !snow && tempC <= 2;
  if (fog && level <= 3) return { condition: level <= 1 ? "mist" : "fog", intensity: level <= 1 ? "light" : "thick", glyph: "🌫️" };
  switch (level) {
    case 0: return { condition: "clear", glyph: isNight ? "🌙" : "☀️" };
    case 1: return { condition: "fair", glyph: isNight ? "🌙" : "🌤️" };
    case 2: return { condition: "broken cloud", glyph: "⛅" };
    case 3: return { condition: "overcast", glyph: "☁️" };
    case 4: return snow ? { condition: "light snow", intensity: "light", glyph: "🌨️" } : sleet ? { condition: "sleet", intensity: "light", glyph: "🧊" } : { condition: "drizzle", intensity: "light", glyph: "🌦️" };
    case 5: return snow ? { condition: "snow", intensity: "moderate", glyph: "🌨️" } : sleet ? { condition: "sleet", intensity: "moderate", glyph: "🧊" } : { condition: "rain", intensity: "moderate", glyph: "🌧️" };
    case 6: return snow ? { condition: "heavy snow", intensity: "heavy", glyph: "🌨️" } : { condition: "heavy rain", intensity: "heavy", glyph: "🌧️" };
    default: return snow ? { condition: "blizzard", intensity: "violent", glyph: "🌨️" } : { condition: "thunderstorm", intensity: "violent", glyph: "⛈️" };
  }
}

/** Simulate hours [fromAbs, toAbs] (absolute minutes) and return one record per hour. */
export function simulate(input: WeatherInput, fromAbsMin: number, toAbsMin: number): WeatherHour[] {
  const p = input.climate.seasons[input.season];
  const startHour = Math.floor(fromAbsMin / 60);
  const endHour = Math.floor(toAbsMin / 60);
  // Start from the anchor if we have one (walk forward from it), else from the front's target.
  let hour: number;
  let level: Level;
  let fog = false;
  if (input.anchor && input.anchor.abs <= fromAbsMin + 60) {
    hour = Math.floor(input.anchor.abs / 60);
    level = input.anchor.level;
    fog = !!input.anchor.fog;
  } else {
    hour = Math.max(0, startHour - 24);
    level = frontAt(input.seed, hour, p).target;
  }
  const out: WeatherHour[] = [];
  const anchorTemp = input.anchor?.tempC;
  const anchorHour = input.anchor ? Math.floor(input.anchor.abs / 60) : null;
  for (; hour <= endHour; hour++) {
    const fr = frontAt(input.seed, hour, p);
    let target = fr.target;
    for (const s of input.scheduled ?? []) if (hour * 60 >= s.fromAbs - 180 && hour * 60 <= s.toAbs) target = s.level;
    const r = rng(`${input.seed}:h:${hour}`);
    const isAnchorHour = anchorHour === hour;
    if (!isAnchorHour) {
      if (level < target && r() < 0.5) level = (level + 1) as Level;
      else if (level > target && r() < 0.4) level = (level - 1) as Level;
      else if (level === target && r() < 0.08) level = Math.max(0, Math.min(7, level + (r() < 0.5 ? -1 : 1))) as Level;
      if (level === 7 && target !== 7 && r() < 0.6) level = 6; // storms don't linger past their front
      const hh = hour % 24;
      const dawnish = hh >= 3 && hh <= 9;
      if (fog) fog = dawnish && r() > 0.25;
      else fog = dawnish && level <= 3 && fr.windy < 0.5 && r() < p.fog * 0.35;
    }
    if (hour < startHour) continue;
    let tempC = tempAt(input, hour, level);
    if (anchorTemp != null && anchorHour != null) {
      const gap = hour - anchorHour;
      if (gap >= 0 && gap < 12) {
        const offset = anchorTemp - tempAt(input, anchorHour, input.anchor!.level);
        tempC = Math.round((tempC + offset * (1 - gap / 12)) * 10) / 10;
      }
    }
    const windBase = p.wind * 0.6 + fr.windy * 0.4 + (level >= 6 ? 0.3 : level >= 4 ? 0.1 : 0);
    const windStrength = windBase > 0.95 ? "gale" : windBase > 0.72 ? "strong" : windBase > 0.45 ? "moderate" : windBase > 0.2 ? "light" : "calm";
    const hh = hour % 24;
    const d = describe(level, fog, tempC, hh < 6 || hh >= 20);
    out.push({ abs: hour * 60, level, fog, tempC, windDir: fr.dir, windStrength, ...d });
  }
  return out;
}

export function weatherText(w: { condition: string; intensity?: string; tempC?: number; windDir?: string; windStrength?: string }): string {
  const parts = [w.condition];
  if (w.tempC != null) parts.push(`${Math.round(w.tempC)}°C`);
  if (w.windStrength && w.windStrength !== "calm") parts.push(`wind ${w.windDir ?? ""} ${w.windStrength === "light" ? "" : w.windStrength}`.replace(/\s+/g, " ").trim());
  else if (w.windStrength === "calm") parts.push("still air");
  return parts.join(", ");
}

/** "easing 17:00 → overcast; clear by 22:00" */
export function forecastText(hours: WeatherHour[], hhmm: (m: number) => string): string {
  if (!hours.length) return "";
  const out: string[] = [];
  let prev = hours[0];
  for (const h of hours.slice(1)) {
    if (h.condition !== prev.condition) {
      const verb = h.level < prev.level ? "easing" : h.level > prev.level ? "worsening" : "turning";
      out.push(`${verb} ${hhmm(h.abs % 1440)} → ${h.condition}`);
      prev = h;
      if (out.length >= 3) break;
    }
  }
  if (!out.length) return `${hours[0].condition} holding through ${hhmm(hours[hours.length - 1].abs % 1440)}`;
  const t = hours.map((h) => h.tempC);
  return `${out.join("; ")} (${Math.round(Math.min(...t))}–${Math.round(Math.max(...t))}°C)`;
}

export function seedFor(chatId: string): string {
  return hash(`almanac:${chatId}`);
}
