// Days that come round again: birthdays, feast days, patrol nights, the full moon, and the
// anniversaries of what happened in the story ("a month since Joyce died"). The player adds
// them on the Timeline page or in an aside (((birthday: Buffy, 19 January))); the story's
// deaths give their own. Each is matched against the story's calendar, so "Second Moon 7" or
// "every Friday" lands on real story days: the note says what today and tomorrow hold, the
// Timeline shows what's ahead, and Elsewhere's subplots know the day.

import type { RecurringDay, WorldState } from "./types";
import { dateFor, findDate, type CalendarConfig } from "./engines/calendar";
import { slug } from "./util";

export interface Occurrence {
  day: number;
  name: string;
  who?: string;
  /** How it comes round: a date each year, a weekday, a moon, a day each month, once, or a story anniversary. */
  kind: "yearly" | "weekly" | "moon" | "monthly" | "once" | "anniversary";
  id: string;
}

export interface DayCtx {
  cal: CalendarConfig;
  /** The moon's illumination (0–100) at noon of a story day. */
  moonLit?: (day: number) => number;
}

const ORD = /(\d{1,2})(?:st|nd|rd|th)?/;

/** How a day comes round, read from its words. Null when they name no day this calendar knows. */
export function ruleOf(when: string, cal: CalendarConfig): ((day: number, ctx: DayCtx) => boolean) & { kind: Occurrence["kind"] } | null {
  const w = when.trim().toLowerCase();
  const tag = <T extends (day: number, ctx: DayCtx) => boolean>(f: T, kind: Occurrence["kind"]) => Object.assign(f, { kind });
  // A single story day: "day 12".
  const once = /^(?:on\s+)?day\s+(\d{1,5})$/.exec(w);
  if (once) return tag((d) => d === parseInt(once[1], 10), "once");
  // The moon: "full moon", "every new moon".
  const moon = /\b(full|new)\s+moons?\b/.exec(w);
  if (moon) {
    const full = moon[1] === "full";
    return tag((d, ctx) => {
      if (!ctx.moonLit) return false;
      const [a, b, c] = [ctx.moonLit(d - 1), ctx.moonLit(d), ctx.moonLit(d + 1)];
      return full ? b >= 90 && b >= a && b > c : b <= 10 && b <= a && b < c;
    }, "moon");
  }
  // Weekdays: "every Friday", "Tuesdays and Thursdays", "patrol nights: Tue, Thu".
  const days = cal.weekdays.filter((wd) => new RegExp(`\\b${wd.toLowerCase().slice(0, 3)}(?:${wd.toLowerCase().slice(3)})?s?\\b`).test(w));
  if (days.length && !/\d/.test(w)) return tag((d) => days.includes(dateFor(cal, d).weekday), "weekly");
  // A day of every month: "the 1st of every month", "monthly on the 15th".
  const monthly = /\b(?:every|each)\s+month\b|\bmonthly\b/.test(w) ? ORD.exec(w) : null;
  if (monthly) {
    const n = parseInt(monthly[1], 10);
    return tag((d) => dateFor(cal, d).dayOfMonth === n, "monthly");
  }
  // A date of the year: "19 January", "Second Moon 7", "Midwinter".
  const f = findDate(cal, when);
  if (f) {
    const month = cal.months[f.month]?.name;
    return tag((d) => {
      const x = dateFor(cal, d);
      return x.month === month && x.dayOfMonth === f.day;
    }, "yearly");
  }
  return null;
}

/** "((birthday: Buffy, 19 January))", "((every Friday: patrol night))", "((holiday: Founders' Day, 12 March))". */
export function recurringAside(text: string): { name: string; when: string; who?: string } | null {
  const t = text.trim();
  const bday = /^birthday\s*(?:of\s+)?(?::\s*)?([^:,]+?)\s*[:,]\s*(.{3,60})$/i.exec(t);
  if (bday) {
    const who = bday[1].replace(/['’]s$/, "").trim();
    return { name: `${who}'s birthday`, when: bday[2].trim(), who };
  }
  const every = /^(every\s+[^:]{3,40}|(?:mon|tues|wednes|thurs|fri|satur|sun)days?(?:\s+and\s+\w+days?)?)\s*:\s*(.{2,60})$/i.exec(t);
  if (every) return { name: every[2].trim(), when: every[1].trim() };
  const named = /^(holiday|feast|festival|anniversary|recurring|remember)\s*:\s*([^,|]{2,60})\s*[,|]\s*(.{2,60})$/i.exec(t);
  if (named) return { name: named[2].trim(), when: named[3].trim() };
  return null;
}

/**
 * The story's own anniversaries: a week, a month and a year after each death, from the
 * milestones (deaths only: a lost key's anniversary isn't a day anyone marks).
 */
export function storyAnniversaries(st: WorldState, yearDays: number): { day: number; name: string; id: string }[] {
  const out: { day: number; name: string; id: string }[] = [];
  const seen = new Set<string>();
  for (const m of st.milestones) {
    if (m.kind !== "death" || !m.at) continue;
    const who = m.text.replace(/\s+dies$/, "");
    // A death the story restates is still one death: its first telling counts.
    if (seen.has(who)) continue;
    seen.add(who);
    for (const [n, label] of [[7, "a week"], [30, "a month"], [yearDays, "a year"]] as const) out.push({ day: m.at.day + n, name: `${label} since ${who} died`, id: `death:${slug(who)}:${n}` });
  }
  return out;
}

/** Everything falling on story days `from`..`to` (inclusive), earliest first. */
export function occurrences(st: WorldState, list: RecurringDay[], ctx: DayCtx, from: number, to: number): Occurrence[] {
  const out: Occurrence[] = [];
  for (const r of list) {
    const rule = ruleOf(r.when, ctx.cal);
    if (!rule) continue;
    for (let d = Math.max(1, from); d <= to; d++) if (rule(d, ctx)) out.push({ day: d, name: r.name, ...(r.who ? { who: r.who } : {}), kind: rule.kind, id: r.id });
  }
  const year = ctx.cal.months.reduce((n, m) => n + m.days, 0) || 365;
  for (const a of storyAnniversaries(st, year)) if (a.day >= from && a.day <= to) out.push({ day: a.day, name: a.name, kind: "anniversary", id: a.id });
  return out.sort((a, b) => a.day - b.day);
}

/** Every recurring day the story knows: the player's (config), and those read from asides (state). */
export function allRecurring(st: WorldState, config: RecurringDay[] | undefined): RecurringDay[] {
  const seen = new Set<string>();
  return [...(config ?? []), ...(st.recurring ?? [])].filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/** "Today: Buffy's birthday · full moon. Tomorrow: patrol night." for the note; "" when nothing falls. */
export function dayLine(occ: Occurrence[], today: number): string {
  const on = (d: number) => [...new Set(occ.filter((o) => o.day === d).map((o) => o.name))];
  const t = on(today), n = on(today + 1);
  return [t.length ? `Today: ${t.join(" · ")}` : "", n.length ? `Tomorrow: ${n.join(" · ")}` : ""].filter(Boolean).join(". ");
}
