// The almanac facade: one call turns world state + settings into everything the
// Now note, macros, plate and HUD need (date, clock, weather, forecast, sun, moon).

import type { WorldState } from "../types";
import { absMinutes, hhmm } from "../util";
import { buildCalendar, dateFor, fmtDate, yearLength, type CalendarConfig } from "./calendar";
import { latitudeFrom, moonFor, moonOffset, skyBand, sunFor } from "./astro";
import { climateFrom, forecastText, levelOf, seedFor, simulate, weatherText, type Scheduled, type WeatherHour } from "./weather";

export interface AlmanacConfig {
  chatId: string;
  climate?: string;
  latitude?: string;
  calendar?: string;
  startPoint?: string;
  headerDate?: string;
  scheduled?: Scheduled[];
  moonAnchor?: { day: number; phase: string };
}

export interface AlmanacReport {
  day: number;
  minute: number;
  clock: string; // "Thursday 14 October, 14:32"
  date: string;
  weekday: string;
  season: string;
  band: string;
  weather: { condition: string; intensity?: string; tempC?: number; wind?: string; glyph: string; text: string; source: string };
  forecast: string;
  forecastHours: WeatherHour[];
  sun: { rise: string; set: string; text: string; daylight: boolean };
  moon: { name: string; glyph: string; illumination: number };
  calendar: CalendarConfig;
}

const calCache = new Map<string, CalendarConfig>();

export function calendarFor(cfg: AlmanacConfig): CalendarConfig {
  const k = JSON.stringify([cfg.calendar, cfg.startPoint, cfg.climate, cfg.headerDate, cfg.latitude]);
  let c = calCache.get(k);
  if (!c) {
    c = buildCalendar(cfg);
    calCache.set(k, c);
    if (calCache.size > 64) calCache.delete(calCache.keys().next().value!);
  }
  return c;
}

export function almanacFor(state: WorldState, cfg: AlmanacConfig): AlmanacReport | null {
  const t = state.time;
  if (!t) return null;
  const cal = calendarFor(cfg);
  const d = dateFor(cal, t.day);
  const lat = latitudeFrom(cfg.latitude || cfg.climate);
  const sun = sunFor(d.doy, cal.hemisphere === "south" && lat > 0 ? -lat : lat, yearLength(cal));
  const moon = moonFor(t.day, t.minute, moonOffset(cfg.chatId, cfg.moonAnchor));
  const now = absMinutes(t);
  const climate = climateFrom(cfg.climate);
  const w = state.weather;
  const anchor = w?.setAt ? { abs: absMinutes(w.setAt), ...levelOf(w.condition), tempC: w.tempC } : null;
  const input = { seed: seedFor(cfg.chatId), climate, season: d.season, anchor, scheduled: cfg.scheduled };
  const hours = simulate(input, now, now + 12 * 60);
  const cur = hours[0];
  const fresh = w && w.setAt && now - absMinutes(w.setAt) < 90;
  const weather = fresh || (w && !cur)
    ? {
        condition: w!.condition, intensity: w!.intensity, tempC: w!.tempC ?? cur?.tempC, wind: w!.wind ?? (cur ? `${cur.windDir} ${cur.windStrength}` : undefined),
        glyph: w!.glyph ?? cur?.glyph ?? "⛅", source: w!.source,
        text: [w!.condition, (w!.tempC ?? cur?.tempC) != null ? `${Math.round((w!.tempC ?? cur!.tempC)!)}°C` : "", w!.wind ? `wind ${w!.wind}` : cur ? `wind ${cur.windDir}${cur.windStrength === "light" ? "" : " " + cur.windStrength}` : ""].filter(Boolean).join(", "),
      }
    : {
        condition: cur.condition, intensity: cur.intensity, tempC: cur.tempC, wind: `${cur.windDir} ${cur.windStrength}`, glyph: cur.glyph, source: "engine",
        text: weatherText(cur),
      };
  const rise = sun.sunrise != null ? hhmm(sun.sunrise) : "—";
  const set = sun.sunset != null ? hhmm(sun.sunset) : "—";
  return {
    day: t.day,
    minute: t.minute,
    clock: `${fmtDate(cal, t.day)}, ${hhmm(t.minute)}`,
    date: fmtDate(cal, t.day),
    weekday: d.weekday,
    season: d.seasonDetail,
    band: skyBand(t.minute, sun),
    weather,
    forecast: forecastText(hours, hhmm),
    forecastHours: hours,
    sun: {
      rise, set,
      text: sun.polar === "night" ? "polar night (no sunrise)" : sun.polar === "day" ? "midnight sun (no sunset)" : `rise ${rise} · set ${set}`,
      daylight: sun.sunrise != null && sun.sunset != null ? t.minute >= sun.sunrise && t.minute < sun.sunset : sun.polar === "day",
    },
    moon: { name: moon.name, glyph: moon.glyph, illumination: moon.illumination },
    calendar: cal,
  };
}

// ---------------------------------------------------------------------------
// Place clocks: opening hours and routines
// ---------------------------------------------------------------------------

/** "open 20:00 to 02:00", "20:00–02:00", "dawn to dusk" → [start, end] minutes (end may wrap). */
export function parseHours(text: string): [number, number] | null {
  const m = /(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?\s*(?:to|–|-|until|till)\s*(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?/i.exec(text);
  if (!m) {
    if (/dawn to dusk|daylight/i.test(text)) return [6 * 60, 19 * 60];
    if (/always open|all hours|24\s*h/i.test(text)) return [0, 1440];
    return null;
  }
  const conv = (h: string, mi: string | undefined, ap: string | undefined) => {
    let hh = parseInt(h, 10);
    if (ap?.toLowerCase() === "pm" && hh < 12) hh += 12;
    if (ap?.toLowerCase() === "am" && hh === 12) hh = 0;
    return (hh % 24) * 60 + (mi ? parseInt(mi, 10) : 0);
  };
  return [conv(m[1], m[2], m[3]), conv(m[4], m[5], m[6])];
}

export function isOpen(hours: [number, number], minute: number): boolean {
  const [s, e] = hours;
  if (e === 1440 && s === 0) return true;
  return s <= e ? minute >= s && minute < e : minute >= s || minute < e;
}

export interface RoutineSlot {
  from: number;
  to: number;
  place: string;
  activity?: string;
}

/** "06:00–09:00 docks (unloading); 09:00–18:00 office" */
export function parseRoutine(text: string): RoutineSlot[] {
  const out: RoutineSlot[] = [];
  for (const seg of text.split(/\s*[;\n]\s*/)) {
    const h = parseHours(seg);
    if (!h) continue;
    const rest = seg.replace(/^[^a-zA-Z]*(?:\d{1,2}[:.]?\d{0,2}\s*(am|pm)?\s*(?:to|–|-|until)\s*\d{1,2}[:.]?\d{0,2}\s*(am|pm)?)\s*/i, "");
    const act = /\(([^)]*)\)/.exec(rest)?.[1];
    out.push({ from: h[0], to: h[1], place: rest.replace(/\([^)]*\)/, "").replace(/^[:,\s]+/, "").trim(), activity: act });
  }
  return out;
}

export function routineAt(slots: RoutineSlot[], minute: number): RoutineSlot | undefined {
  return slots.find((s) => isOpen([s.from, s.to], minute));
}
