// Calendar: day count → weekday, date, year and season. Gregorian by default;
// custom calendars come from the `calendar` setting, lore (`OOC: Calendar`) or
// the first header the model writes ("Thursday, 14 Frostmoon").

export interface CalendarConfig {
  months: { name: string; days: number }[];
  weekdays: string[];
  /** 0-based day-of-year of Day 1. */
  startDoy: number;
  startYear?: number;
  yearLabel?: string;
  /** Index into weekdays for Day 1. */
  startWeekday: number;
  hemisphere: "north" | "south";
  custom: boolean;
  named: { month: number; day: number; name: string }[];
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
  };
}

export function yearLength(cal: CalendarConfig): number {
  return cal.months.reduce((s, m) => s + m.days, 0) || 365;
}

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
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

/** Build a calendar from free text settings + start point + an optional first header date label. */
export function buildCalendar(opts: { calendar?: string; startPoint?: string; climate?: string; headerDate?: string; latitude?: string }): CalendarConfig {
  const cal = defaultCalendar();
  if (/\bsouth(ern)?\b|-\d/.test(opts.latitude ?? "")) cal.hemisphere = "south";
  const text = opts.calendar ?? "";
  // Custom weekdays: "weekdays Moonday–Sunday" or "weekdays: A, B, C"
  const wd = /weekdays?\s*[:=]?\s*([^;\n]+)/i.exec(text);
  if (wd) {
    const list = wd[1].split(/\s*[,/·]\s*/).filter(Boolean);
    if (list.length >= 3) {
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
  if (mo) {
    const list = mo[1].split(/\s*,\s*/).map((s) => {
      const m = /^(.+?)\s*\((\d+)\)$/.exec(s.trim());
      return m ? { name: m[1], days: parseInt(m[2], 10) } : { name: s.trim(), days: 30 };
    }).filter((m) => m.name);
    if (list.length >= 2) {
      cal.months = list;
      cal.custom = true;
    }
  }
  const yl = /year\s*(?:label)?\s*[:=]?\s*([^;\n]+)/i.exec(text);
  if (yl) cal.yearLabel = yl[1].trim();

  // Start point: "Day 1 · 14 October 1923 · 18:40"
  const sp = `${opts.startPoint ?? ""} ${opts.headerDate ?? ""}`;
  const dm = /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Z][a-zA-Z]+)(?:,?\s+(\d{1,5}))?/.exec(sp) || /([A-Z][a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{1,5}))?/.exec(sp);
  let placed = false;
  if (dm) {
    const [dStr, mStr] = /^\d/.test(dm[1]) ? [dm[1], dm[2]] : [dm[2], dm[1]];
    const mi = cal.months.findIndex((m) => m.name.toLowerCase().startsWith(mStr.toLowerCase().slice(0, 3)));
    if (mi >= 0) {
      const day = parseInt(dStr, 10);
      cal.startDoy = cal.months.slice(0, mi).reduce((s, m) => s + m.days, 0) + day - 1;
      if (dm[3]) cal.startYear = parseInt(dm[3], 10);
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
  if (!placed && cal.custom && mo) cal.startDoy = 0;
  if (!placed) {
    const txt = `${opts.climate ?? ""} ${opts.startPoint ?? ""}`;
    for (const [re, doy] of SEASON_DOY) if (re.test(txt)) {
      cal.startDoy = doy;
      break;
    }
  }
  // Weekday name in the start point / header pins the weekday cycle.
  const wname = cal.weekdays.findIndex((w) => new RegExp(`\\b${w}\\b`, "i").test(sp));
  if (wname >= 0) cal.startWeekday = wname;
  const named = /holidays?\s*[:=]\s*([^;\n]+)/i.exec(text);
  if (named) {
    for (const h of named[1].split(/\s*,\s*/)) {
      const m = /^(.+?)\s*\(?\s*(\d{1,2})\s+([A-Za-z]+)\s*\)?$/.exec(h.trim());
      if (m) {
        const mi = cal.months.findIndex((x) => x.name.toLowerCase().startsWith(m[3].toLowerCase().slice(0, 3)));
        if (mi >= 0) cal.named.push({ name: m[1].trim(), month: mi, day: parseInt(m[2], 10) });
      }
    }
  }
  return cal;
}

export interface DateInfo {
  day: number;
  weekday: string;
  dayOfMonth: number;
  month: string;
  monthIndex: number;
  year?: number;
  doy: number;
  season: "spring" | "summer" | "autumn" | "winter";
  seasonDetail: string;
  holiday?: string;
}

export function dateFor(cal: CalendarConfig, day: number): DateInfo {
  const offset = day - 1;
  let yl = yearLength(cal);
  let doy = cal.startDoy + offset;
  let year = cal.startYear;
  const leapAware = !cal.custom && year != null;
  while (true) {
    yl = leapAware && isLeap(year!) ? 366 : yearLength(cal);
    if (doy < yl) break;
    doy -= yl;
    if (year != null) year++;
  }
  let rem = doy;
  let mi = 0;
  for (; mi < cal.months.length; mi++) {
    const days = cal.months[mi].days + (leapAware && mi === 1 && isLeap(year!) ? 1 : 0);
    if (rem < days) break;
    rem -= days;
  }
  if (mi >= cal.months.length) mi = cal.months.length - 1;
  const frac = doy / yearLength(cal);
  const northSeason = frac < 0.214 || frac >= 0.97 ? "winter" : frac < 0.47 ? "spring" : frac < 0.72 ? "summer" : "autumn";
  const flip: Record<string, DateInfo["season"]> = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };
  const season = (cal.hemisphere === "south" ? flip[northSeason] : northSeason) as DateInfo["season"];
  const phase = seasonPhase(frac);
  const holiday = cal.named.find((h) => h.month === mi && h.day === rem + 1)?.name;
  return {
    day,
    weekday: cal.weekdays[(((cal.startWeekday + offset) % cal.weekdays.length) + cal.weekdays.length) % cal.weekdays.length],
    dayOfMonth: rem + 1,
    month: cal.months[mi].name,
    monthIndex: mi,
    year,
    doy,
    season,
    seasonDetail: `${phase} ${season}`,
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

export function fmtDate(cal: CalendarConfig, day: number): string {
  const d = dateFor(cal, day);
  const y = d.year != null ? ` ${d.year}${cal.yearLabel ? " " + cal.yearLabel : ""}` : "";
  return `${d.weekday} ${d.dayOfMonth} ${d.month}${y}${d.holiday ? ` (${d.holiday})` : ""}`;
}
