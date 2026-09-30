// Calendar: day count → weekday, date, year and season. Gregorian by default;
// custom calendars come from the `calendar` setting, lore (`OOC: Calendar`) or
// the first header the model writes ("Thursday, 14 Frostmoon"). Named fantasy
// calendars ("Westeros", "Roshar", "Harptos", "Shire") live in calendars.ts.
//
// Setting syntax, clauses separated by ";":
//   months: Hammer (30), [Midwinter], Alturiak (30), Mid-year's Day (festival, weekless)
//   weekdays: Moonday, Tirsday, … | weekdays: none
//   year: 299 AC           era: AC          format: {ord} day of the {month}, {year} {era}
//   leap: Shieldmeet after Midsummer every 4 years
//   seasons: story         moons: Salas (19), Nomon (31)
//   holidays: Greenfest (1 Ches), the Weeping (31 Ishi, 40 days)

import { presetFor } from "./calendars";

export type Season = "spring" | "summer" | "autumn" | "winter";

export interface CalMonth {
  name: string;
  days: number;
  /** A named day (or days) between months: shown without a day number. */
  festival?: boolean;
  /** Belongs to no week: the weekday cycle skips it. */
  weekless?: boolean;
}

export interface CalMoon {
  name: string;
  /** Days from new moon to new moon. */
  period: number;
}

export interface CalendarConfig {
  months: CalMonth[];
  /** Empty when the calendar has no named weekdays. */
  weekdays: string[];
  /** 0-based day-of-year of Day 1. */
  startDoy: number;
  startYear?: number;
  yearLabel?: string;
  /** Index into weekdays for Day 1. */
  startWeekday: number;
  /** Perpetual calendars (Shire Reckoning): every year starts on this weekday. */
  yearStartWeekday?: number;
  hemisphere: "north" | "south";
  custom: boolean;
  named: { month: number; day: number; name: string; days?: number }[];
  /** An extra festival day after months[after] in leap years (needs a year). */
  leap?: { after: number; name: string; every: number; skipCentury?: boolean; weekless?: boolean };
  /** "solar": seasons follow the year; "story": the story sets them with `season:` ledger lines. */
  seasons: "solar" | "story";
  /** The opening season when the story sets them. */
  season0?: Season;
  moons?: CalMoon[];
  /** Tokens: {weekday} {day} {ord} {month} {year} {era}. */
  format?: string;
  /** Id of the named calendar this came from. */
  preset?: string;
  /** One line about the calendar for the model. */
  note?: string;
}

const GREG_MONTHS = [
  ["January", 31], ["February", 28], ["March", 31], ["April", 30], ["May", 31], ["June", 30],
  ["July", 31], ["August", 31], ["September", 30], ["October", 31], ["November", 30], ["December", 31],
] as const;
const GREG_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function defaultCalendar(): CalendarConfig {
  return {
    months: GREG_MONTHS.map(([name, days]) => ({ name, days })),
    weekdays: [...GREG_DAYS],
    startDoy: 284, // 12 October: the almanac's default autumn opening
    startWeekday: 0,
    hemisphere: "north",
    custom: false,
    named: [],
    seasons: "solar",
  };
}

/** Length of a common year. */
export function yearLength(cal: CalendarConfig): number {
  return cal.months.reduce((s, m) => s + m.days, 0) || 365;
}

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** The months of one year, leap days included. */
export function monthsFor(cal: CalendarConfig, year: number | undefined): CalMonth[] {
  if (year == null) return cal.months;
  if (!cal.custom) {
    if (!isLeap(year)) return cal.months;
    return cal.months.map((m, i) => (i === 1 ? { ...m, days: m.days + 1 } : m));
  }
  const lp = cal.leap;
  if (!lp || year % lp.every !== 0 || (lp.skipCentury && year % 100 === 0 && year % 400 !== 0)) return cal.months;
  const out = cal.months.slice();
  out.splice(lp.after + 1, 0, { name: lp.name, days: 1, festival: true, ...(lp.weekless ? { weekless: true } : {}) });
  return out;
}

const sumDays = (months: CalMonth[]) => months.reduce((s, m) => s + m.days, 0) || 365;

/** Days in [from, to) of a year that belong to a week. */
function weekedDays(months: CalMonth[], from: number, to: number): number {
  let n = 0;
  let at = 0;
  for (const m of months) {
    const a = Math.max(from, at);
    const b = Math.min(to, at + m.days);
    if (b > a && !m.weekless) n += b - a;
    at += m.days;
  }
  return n;
}

function gregWeekday(y: number, m: number, d: number): number {
  // Sakamoto, Monday = 0
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let yy = y;
  if (m < 3) yy -= 1;
  const sun0 = (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1] + d) % 7;
  return (sun0 + 6) % 7;
}

const SEASON_DOY: [RegExp, number][] = [
  [/\bearly spring\b/i, 75], [/\blate spring\b/i, 150], [/\bspring\b/i, 110],
  [/\bearly summer\b/i, 165], [/\blate summer\b/i, 225], [/\bmidsummer\b/i, 172], [/\bsummer\b/i, 195],
  [/\bearly autumn\b|\bearly fall\b/i, 258], [/\blate autumn\b|\blate fall\b/i, 318], [/\bautumn\b|\bfall\b/i, 288],
  [/\bearly winter\b/i, 345], [/\blate winter\b/i, 50], [/\bmidwinter\b/i, 355], [/\bwinter\b/i, 20],
];

/** "long winter", "Autumn has come" → the season it names. */
export function seasonOf(text: string | undefined): Season | undefined {
  const m = /(spring|summer|autumn|fall|winter)/i.exec(text ?? "");
  if (!m) return undefined;
  const s = m[1].toLowerCase();
  return (s === "fall" ? "autumn" : s) as Season;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");

/** Find a date written with this calendar's month names: "14 Hammer 1492", "14th day of the Fifth Moon, 299", "Midwinter". */
export function findDate(cal: CalendarConfig, text: string): { month: number; day: number; year?: number } | null {
  let best: { at: number; month: number; day: number; year?: number } | null = null;
  const yearTail = `(?:,?\\s+(\\d{1,5})(?![:.]?\\d))?`;
  const consider = (re: RegExp, month: number, dayGroup: number | null, yearGroup: number) => {
    const r = re.exec(text);
    if (!r || (best && best.at <= r.index)) return;
    const day = dayGroup ? parseInt(r[dayGroup], 10) : 1;
    if (day < 1 || day > cal.months[month].days) return;
    best = { at: r.index, month, day, year: r[yearGroup] ? parseInt(r[yearGroup], 10) : undefined };
  };
  cal.months.forEach((mo, i) => {
    const n = esc(mo.name);
    if (mo.festival && mo.days === 1) {
      consider(new RegExp(`(?<![\\w'])${n}(?![\\w'])${yearTail}`, "i"), i, null, 1);
      return;
    }
    consider(new RegExp(`(?<![\\w:])(\\d{1,3})(?:st|nd|rd|th)?\\s+(?:day\\s+)?(?:of\\s+)?(?:the\\s+)?${n}(?![\\w'])${yearTail}`, "i"), i, 1, 2);
    consider(new RegExp(`(?<![\\w'])${n}\\s+(\\d{1,3})(?:st|nd|rd|th)?(?![:.]?\\d)${yearTail}`, "i"), i, 1, 2);
  });
  return best;
}

/** "Name (30)", "[Midwinter]", "Mid-year's Day (festival, weekless)" */
function parseMonth(raw: string): CalMonth | null {
  let s = raw.trim();
  let festival = false;
  let weekless = false;
  let days: number | undefined;
  const br = /^\[(.+)\]$/.exec(s);
  if (br) {
    festival = true;
    s = br[1].trim();
  }
  const pm = /^(.+?)\s*\(([^)]*)\)$/.exec(s);
  if (pm) {
    s = pm[1].trim();
    for (const f of pm[2].split(/\s*,\s*/)) {
      if (/^\d+$/.test(f)) days = parseInt(f, 10);
      else if (/festival|holiday|intercalary/i.test(f)) festival = true;
      else if (/weekless|no week/i.test(f)) weekless = true;
    }
  }
  if (!s) return null;
  return { name: s, days: days ?? (festival ? 1 : 30), ...(festival ? { festival } : {}), ...(weekless ? { weekless } : {}) };
}

/** Split on commas outside brackets. */
const splitList = (s: string) => s.split(/\s*,\s*(?![^()[\]]*[)\]])/).map((x) => x.trim()).filter(Boolean);

/** Build a calendar from free text settings + start point + an optional first header date label. */
export function buildCalendar(opts: { calendar?: string; startPoint?: string; climate?: string; headerDate?: string; latitude?: string; anchorDay?: number }): CalendarConfig {
  let cal = defaultCalendar();
  let text = opts.calendar ?? "";
  const preset = presetFor(text);
  if (preset) {
    cal = { ...cal, startDoy: 0, ...preset.build(), custom: true, preset: preset.id };
    cal.named = cal.named.map((h) => ({ ...h }));
  }
  if (/\bsouth(ern)?\b|-\d/.test(opts.latitude ?? "")) cal.hemisphere = "south";
  // The format holds "{month}" and "{year}": take it out before the other clauses.
  const fm = /\bformat\s*[:=]\s*([^;\n]+)/i.exec(text);
  if (fm) {
    cal.format = fm[1].trim();
    text = text.replace(fm[0], "");
  }
  // Custom weekdays: "weekdays Moonday–Sunday", "weekdays: A, B, C" or "weekdays: none"
  const wd = /weekdays?\s*[:=]?\s*([^;\n]+)/i.exec(text);
  if (wd) {
    const list = wd[1].split(/\s*[,/·]\s*/).filter(Boolean);
    if (/^(none|no names?|unnamed|nameless)\b/i.test(wd[1].trim())) {
      cal.weekdays = [];
      cal.custom = true;
    } else if (list.length >= 3) {
      cal.weekdays = list.map((s) => s.trim());
      cal.custom = true;
    } else {
      const range = /([A-Z][a-z]+)\s*[–-]\s*([A-Z][a-z]+)/.exec(wd[1]);
      if (range && !GREG_DAYS.includes(range[1])) {
        cal.weekdays = [range[1], ...GREG_DAYS.slice(1, 6), range[2]];
        cal.custom = true;
      }
    }
  }
  const mo = /months?\s*[:=]?\s*([^;\n]+)/i.exec(text);
  let monthsSet = false;
  if (mo) {
    const list = splitList(mo[1]).map(parseMonth).filter((x): x is CalMonth => !!x);
    if (list.length >= 2) {
      cal.months = list;
      cal.custom = true;
      monthsSet = true;
      if (cal.leap && cal.leap.after >= list.length) cal.leap = undefined;
      cal.named = [];
    }
  }
  const yl = /(?:^|[;\n,])\s*(?:year(?:\s*label)?|era)\b\s*[:=]?\s*([^;\n]+)/i.exec(text);
  if (yl) {
    const v = yl[1].trim();
    const num = /^(\d{1,5})\b\s*(.*)$/.exec(v);
    if (num) {
      cal.startYear = parseInt(num[1], 10);
      if (num[2].trim()) cal.yearLabel = num[2].trim();
    } else cal.yearLabel = v;
  }
  const lp = /\bleap(?:\s*day)?\s*[:=]?\s*(.+?)\s+after\s+(.+?)\s+every\s+(\d+)/i.exec(text);
  if (lp) {
    const after = cal.months.findIndex((x) => x.name.toLowerCase() === lp[2].trim().toLowerCase());
    if (after >= 0) cal.leap = { after, name: lp[1].trim(), every: parseInt(lp[3], 10), weekless: /weekless|no week/i.test(/[^;\n]*/.exec(text.slice(lp.index))![0]) };
  }
  const se = /\bseasons?\s*[:=]\s*([^;\n]+)/i.exec(text);
  if (se) cal.seasons = /story|irregular|declared|set|years?\b/i.test(se[1]) ? "story" : "solar";
  const mn = /\bmoons?\s*[:=]\s*([^;\n]+)/i.exec(text);
  if (mn) {
    const moons = splitList(mn[1]).map((s) => {
      const x = /^(.+?)\s*\(\s*(\d+(?:\.\d+)?)[^)]*\)$/.exec(s);
      return x ? { name: x[1].trim(), period: parseFloat(x[2]) } : { name: s, period: 29.530588 };
    }).filter((x) => x.name && x.period > 0);
    if (moons.length) cal.moons = moons;
  }
  const named = /holidays?\s*[:=]\s*([^;\n]+)/i.exec(text);
  const namedMonths = !!preset || monthsSet;

  // Start point: "Day 1 · 14 October 1923 · 18:40"
  const sp = `${opts.startPoint ?? ""} ${opts.headerDate ?? ""}`;
  let placed = false;
  if (namedMonths) {
    const f = findDate(cal, sp);
    if (f) {
      if (f.year != null) cal.startYear = f.year;
      const months = monthsFor(cal, cal.startYear);
      const mi = months.findIndex((x) => x.name === cal.months[f.month].name);
      cal.startDoy = months.slice(0, mi).reduce((s, x) => s + x.days, 0) + f.day - 1;
      placed = true;
    }
  } else {
    const dm = /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Z][a-zA-Z]+)(?:,?\s+(\d{1,5}))?/.exec(sp) || /([A-Z][a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{1,5}))?/.exec(sp);
    if (dm) {
      const [dStr, mStr] = /^\d/.test(dm[1]) ? [dm[1], dm[2]] : [dm[2], dm[1]];
      const mi = cal.months.findIndex((m) => m.name.toLowerCase().startsWith(mStr.toLowerCase().slice(0, 3)));
      if (mi >= 0) {
        const day = parseInt(dStr, 10);
        if (dm[3]) cal.startYear = parseInt(dm[3], 10);
        cal.startDoy = monthsFor(cal, cal.startYear).slice(0, mi).reduce((s, m) => s + m.days, 0) + day - 1;
        placed = true;
        if (!cal.custom && cal.startYear) cal.startWeekday = gregWeekday(cal.startYear, mi + 1, day);
      } else if (!GREG_DAYS.some((d) => d.toLowerCase() === mStr.toLowerCase())) {
        // Unknown month name from the story: adopt a 12×30 calendar named after it.
        cal.custom = true;
        cal.months = Array.from({ length: 12 }, (_, i) => ({ name: i === 0 ? mStr : `Month ${i + 1}`, days: 30 }));
        cal.startDoy = parseInt(dStr, 10) - 1;
        placed = true;
      }
    }
  }
  if (!placed && namedMonths) cal.startDoy = 0;
  if (!placed && cal.seasons === "solar") {
    const txt = `${opts.climate ?? ""} ${opts.startPoint ?? ""}`;
    for (const [re, doy] of SEASON_DOY) if (re.test(txt)) {
      cal.startDoy = Math.round((doy / 365) * yearLength(cal));
      break;
    }
  }
  if (cal.seasons === "story") cal.season0 = seasonOf(`${opts.startPoint ?? ""} ${opts.climate ?? ""}`) ?? "summer";
  // Weekday name in the start point / header pins the weekday cycle.
  const wname = cal.weekdays.findIndex((w) => new RegExp(`\\b${w}\\b`, "i").test(sp));
  if (wname >= 0) cal.startWeekday = wname;
  // A date read from a later header ("Day 3 · Tuesday, 14 October") belongs to that
  // day, not to Day 1: walk the calendar back to Day 1. A start point's own date wins.
  const fromHeader = !!opts.headerDate && !/(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?[A-Z][a-zA-Z]+|[A-Z][a-zA-Z]+\s+\d{1,2}\b|day\s*\d+/i.test(opts.startPoint ?? "");
  const shift = fromHeader && opts.anchorDay && opts.anchorDay > 1 ? opts.anchorDay - 1 : 0;
  if (shift && cal.weekdays.length) cal.startWeekday = (((cal.startWeekday - shift) % cal.weekdays.length) + cal.weekdays.length) % cal.weekdays.length;
  if (shift) {
    cal.startDoy -= shift;
    while (cal.startDoy < 0) {
      if (cal.startYear != null) cal.startYear--;
      cal.startDoy += sumDays(monthsFor(cal, cal.startYear));
    }
  }
  if (named) {
    for (const h of splitList(named[1])) {
      const paren = /^(.+?)\s*\((.+)\)$/.exec(h);
      const name = paren ? paren[1] : /^(.+?)\s+(?=\d)/.exec(h)?.[1];
      const when = paren ? paren[2] : h.slice(name?.length ?? 0);
      if (!name) continue;
      const f = findDate(cal, when) ?? (() => {
        // Legacy "Name 14 Hammer" with a three-letter month prefix.
        const x = /(\d{1,2})\s+([A-Za-z]+)/.exec(when);
        const mi = x ? cal.months.findIndex((m) => m.name.toLowerCase().startsWith(x[2].toLowerCase().slice(0, 3))) : -1;
        return x && mi >= 0 ? { month: mi, day: parseInt(x[1], 10) } : null;
      })();
      const span = /(\d+)\s*days?\b/i.exec(when);
      if (f) cal.named.push({ name: name.trim(), month: f.month, day: f.day, ...(span ? { days: parseInt(span[1], 10) } : {}) });
    }
  }
  return cal;
}

export interface DateInfo {
  day: number;
  /** Empty when the calendar has no named weekdays or the day is weekless. */
  weekday: string;
  dayOfMonth: number;
  month: string;
  monthIndex: number;
  festival?: boolean;
  year?: number;
  doy: number;
  season: Season;
  seasonDetail: string;
  holiday?: string;
}

/** storySeason: the season the story last set (`season:` ledger line), for calendars whose seasons the story keeps. */
export function dateFor(cal: CalendarConfig, day: number, storySeason?: string): DateInfo {
  const offset = day - 1;
  let year = cal.startYear;
  let months = monthsFor(cal, year);
  let yl = sumDays(months);
  let doy = cal.startDoy + offset;
  let from = cal.startDoy;
  let weeked = 0;
  while (doy >= yl) {
    weeked += weekedDays(months, from, yl);
    doy -= yl;
    from = 0;
    if (year != null) year++;
    months = monthsFor(cal, year);
    yl = sumDays(months);
  }
  weeked += weekedDays(months, from, doy);
  let rem = doy;
  let mi = 0;
  for (; mi < months.length; mi++) {
    if (rem < months[mi].days) break;
    rem -= months[mi].days;
  }
  if (mi >= months.length) mi = months.length - 1;
  const month = months[mi];
  const n = cal.weekdays.length;
  const wIdx = cal.yearStartWeekday != null ? cal.yearStartWeekday + weekedDays(months, 0, doy) : cal.startWeekday + weeked;
  const weekday = n && !month.weekless ? cal.weekdays[((wIdx % n) + n) % n] : "";

  let season: Season;
  let seasonDetail: string;
  if (cal.seasons === "story") {
    season = seasonOf(storySeason) ?? cal.season0 ?? "summer";
    seasonDetail = storySeason?.trim().toLowerCase() || season;
  } else {
    const frac = doy / yl;
    const northSeason = frac < 0.214 || frac >= 0.97 ? "winter" : frac < 0.47 ? "spring" : frac < 0.72 ? "summer" : "autumn";
    const flip: Record<string, Season> = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };
    season = (cal.hemisphere === "south" ? flip[northSeason] : northSeason) as Season;
    seasonDetail = `${seasonPhase(frac)} ${season}`;
  }
  const holiday = cal.named.find((h) => {
    const hm = months.findIndex((x) => x.name === cal.months[h.month]?.name);
    if (hm < 0) return false;
    const start = months.slice(0, hm).reduce((s, x) => s + x.days, 0) + h.day - 1;
    return (((doy - start) % yl) + yl) % yl < (h.days ?? 1);
  })?.name;
  return {
    day,
    weekday,
    dayOfMonth: rem + 1,
    month: month.name,
    monthIndex: mi,
    ...(month.festival ? { festival: true } : {}),
    year,
    doy,
    season,
    seasonDetail,
    holiday,
  };
}

function seasonPhase(frac: number): string {
  // Season windows as fractions of the year (northern): winter wraps the new year.
  const windows: [number, number][] = [[-0.03, 0.214], [0.214, 0.47], [0.47, 0.72], [0.72, 0.97]];
  const f = frac >= 0.97 ? frac - 1 : frac;
  const w = windows.find(([s, e]) => f >= s && f < e) ?? windows[0];
  const p = (f - w[0]) / (w[1] - w[0]);
  return p < 0.33 ? "early" : p < 0.67 ? "mid" : "late";
}

/**
 * The story day a calendar date names ("Second Moon 7", "the 17th of October", "Day 3 of Thaw"),
 * the one closest to `nearDay`. Null when the text names no date of this calendar.
 */
export function dayOfDate(cal: CalendarConfig, text: string, nearDay: number): number | null {
  const f = findDate(cal, text);
  if (!f) return null;
  const want = cal.months[f.month]?.name;
  let best: number | null = null;
  for (let d = Math.max(1, nearDay - 420); d <= nearDay + 420; d++) {
    const x = dateFor(cal, d);
    if (x.month !== want || x.dayOfMonth !== f.day || (f.year != null && x.year != null && x.year !== f.year)) continue;
    if (best == null || Math.abs(d - nearDay) < Math.abs(best - nearDay)) best = d;
  }
  return best;
}

export function ordinal(n: number): string {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
}

const DEFAULT_FORMAT = "{weekday} {day} {month} {year} {era}";

export function fmtDate(cal: CalendarConfig, day: number): string {
  const d = dateFor(cal, day);
  // A festival day is its own name: "Midwinter 1492 DR", "Sterday 1 Lithe 1418 S.R.".
  const f = d.festival ? "{weekday} {month} {year} {era}" : cal.format ?? DEFAULT_FORMAT;
  const tokens: Record<string, string> = {
    weekday: d.weekday,
    day: String(d.dayOfMonth),
    ord: ordinal(d.dayOfMonth),
    month: d.month,
    year: d.year != null ? String(d.year) : "",
    era: d.year != null ? cal.yearLabel ?? "" : "",
  };
  const out = f.replace(/\{(\w+)\}/g, (_, k: string) => tokens[k] ?? "")
    .replace(/\s+,/g, ",").replace(/,(\s*,)+/g, ",").replace(/\s{2,}/g, " ").replace(/^[\s,]+|[\s,]+$/g, "");
  return `${out}${d.holiday ? ` (${d.holiday})` : ""}`;
}

/** One line for the model about a non-Gregorian calendar; empty for the plain Gregorian one. */
export function describeCalendar(cal: CalendarConfig): string {
  if (!cal.custom && cal.seasons === "solar" && !cal.moons) return "";
  const parts: string[] = [];
  if (cal.note) parts.push(cal.note);
  else {
    const regular = cal.months.filter((m) => !m.festival);
    const fests = cal.months.filter((m) => m.festival).map((m) => m.name);
    parts.push(`Calendar: ${regular.length} months (${regular.map((m) => m.name).join(", ")}), ${yearLength(cal)} days a year${fests.length ? `; festival days ${fests.join(", ")}` : ""}.`);
    parts.push(cal.weekdays.length ? `Weekdays: ${cal.weekdays.join(", ")}.` : "No named weekdays.");
    if (cal.leap) parts.push(`${cal.leap.name} follows ${cal.months[cal.leap.after]?.name} every ${cal.leap.every} years.`);
  }
  if (cal.moons?.length && !cal.note) parts.push(`Moons: ${cal.moons.map((m) => m.name).join(", ")}.`);
  if (cal.seasons === "story") parts.push(`The story sets the season: when it turns, write "season: winter" (or spring, summer, autumn) in the ledger.`);
  return parts.join(" ");
}
