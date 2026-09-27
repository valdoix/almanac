import { describe, expect, test } from "bun:test";
import { buildCalendar, dateFor, describeCalendar, fmtDate, monthsFor } from "../src/core/engines/calendar";
import { CALENDAR_PRESETS } from "../src/core/engines/calendars";
import { almanacFor } from "../src/core/engines/almanac";
import { LedgerRuntime, toPath, type RawChatMessage } from "../src/core/branch";
import { emptyState } from "../src/core/state";
import { parseLine } from "../src/core/dsl";

describe("named fantasy calendars", () => {
  test("Westeros: moons, AC years, seasons set by the story", () => {
    const cal = buildCalendar({ calendar: "Westeros", startPoint: "Day 1 · 14th day of the Fifth Moon, 299 AC · 18:40" });
    expect(cal.preset).toBe("westeros");
    expect(fmtDate(cal, 1)).toBe("14th day of the Fifth Moon, 299 AC");
    expect(fmtDate(cal, 19)).toBe("1st day of the Sixth Moon, 299 AC");
    expect(dateFor(cal, 1).weekday).toBe("");
    // The year turns at 365 days, the season does not.
    expect(dateFor(cal, 400).year).toBe(300);
    expect(dateFor(cal, 400).season).toBe("summer");
    expect(dateFor(cal, 400, "winter (the long night)")).toMatchObject({ season: "winter", seasonDetail: "winter (the long night)" });
    expect(buildCalendar({ calendar: "A Song of Ice and Fire", climate: "autumn" }).season0).toBe("autumn");
    expect(describeCalendar(cal)).toMatch(/season: winter/);
  });

  test("Roshar: ten months of fifty days, the Weeping across the new year", () => {
    const cal = buildCalendar({ calendar: "Stormlight Archive", startPoint: "23 Tanat 1174" });
    expect(monthsFor(cal, 1174).reduce((s, m) => s + m.days, 0)).toBe(500);
    expect(fmtDate(cal, 1)).toBe("23 Tanat 1174");
    // 23 Tanat → 50 Tanat is 28 days, then 50 days of Ishi.
    expect(fmtDate(cal, 78)).toBe("50 Ishi 1174 (the Weeping)");
    expect(fmtDate(cal, 79)).toBe("1 Jes 1175 (the Weeping)");
    expect(dateFor(cal, 100).holiday).toBeUndefined();
    expect(cal.moons?.map((m) => m.name)).toEqual(["Salas", "Nomon", "Mishim"]);
  });

  test("Harptos: festival days between months and Shieldmeet in leap years", () => {
    const cal = buildCalendar({ calendar: "Harptos", startPoint: "30 Hammer 1492 DR" });
    expect(fmtDate(cal, 2)).toBe("Midwinter 1492 DR");
    expect(fmtDate(cal, 3)).toBe("1 Alturiak 1492 DR");
    const leap = buildCalendar({ calendar: "Harptos", startPoint: "Midsummer 1492" });
    expect(fmtDate(leap, 2)).toBe("Shieldmeet 1492 DR");
    const common = buildCalendar({ calendar: "Harptos", startPoint: "Midsummer 1491" });
    expect(fmtDate(common, 2)).toBe("1 Eleasis 1491 DR");
    expect(dateFor(cal, 1).season).toBe("winter");
  });

  test("Shire Reckoning: every year starts on Sterday; Mid-year's Day has no weekday", () => {
    const y = buildCalendar({ calendar: "Shire", startPoint: "2 Yule 1419" });
    expect(fmtDate(y, 1)).toBe("Sterday 2 Yule 1419 S.R.");
    expect(fmtDate(y, 365)).toBe("Highday 1 Yule 1419 S.R.");
    expect(fmtDate(y, 366)).toBe("Sterday 2 Yule 1420 S.R.");
    // 1420 is a leap year (Overlithe), and still ends on Highday.
    expect(fmtDate(y, 366 + 365)).toBe("Highday 1 Yule 1420 S.R.");
    expect(fmtDate(y, 366 + 366)).toBe("Sterday 2 Yule 1421 S.R.");
    const mid = buildCalendar({ calendar: "Shire", startPoint: "1 Lithe 1419" });
    expect(dateFor(mid, 2)).toMatchObject({ month: "Mid-year's Day", weekday: "" });
    expect(dateFor(mid, 1).weekday).toBe("Highday");
    expect(dateFor(mid, 3).weekday).toBe("Sterday");
  });

  test("a clause after the name overrides one piece", () => {
    const cal = buildCalendar({ calendar: "Westeros; year: 130 AC; format: {month}, day {day}, {year} {era}" });
    expect(fmtDate(cal, 1)).toBe("First Moon, day 1, 130 AC");
  });

  test("every preset builds and walks ten years without gaps", () => {
    for (const p of CALENDAR_PRESETS) {
      const cal = buildCalendar({ calendar: p.name, startPoint: p.start });
      expect(cal.preset).toBe(p.id);
      let prev = dateFor(cal, 1);
      for (let d = 2; d < 3700; d++) {
        const cur = dateFor(cal, d);
        if (cur.year !== prev.year) expect(cur.year).toBe(prev.year! + 1);
        else expect(cur.doy).toBe(prev.doy + 1);
        prev = cur;
      }
      expect(fmtDate(cal, 1)).not.toMatch(/\{|\}|undefined/);
    }
  });
});

describe("an original world's calendar", () => {
  const text = "months: Thaw (30), Bloom (30), [Greenfest], Highsun (31), Mid-year's Day (festival, weekless), Harvest (30), Fade (30), Deepwinter (30); weekdays: Firstday, Seconday, Midday, Fourthday, Restday; year: 312 AR; leap: Starfall after Deepwinter every 5 years; moons: Ilse (18), Varo (41); holidays: Lanterns (14 Fade), the Thaw Fair (1 Thaw, 3 days)";

  test("months, festivals, weekless days, leap day, holidays", () => {
    const cal = buildCalendar({ calendar: text, startPoint: "Day 1 · 29 Bloom 312 AR · 08:00" });
    expect(cal.startYear).toBe(312);
    expect(fmtDate(cal, 1)).toBe(`${dateFor(cal, 1).weekday} 29 Bloom 312 AR`);
    expect(fmtDate(cal, 3)).toMatch(/^\w+ Greenfest 312 AR$/);
    const midyear = 2 + 1 + 31 + 1; // Bloom 29–30, Greenfest, Highsun, then Mid-year's Day
    expect(dateFor(cal, midyear)).toMatchObject({ month: "Mid-year's Day", weekday: "" });
    // The week skips the weekless day.
    const before = cal.weekdays.indexOf(dateFor(cal, midyear - 1).weekday);
    expect(dateFor(cal, midyear + 1).weekday).toBe(cal.weekdays[(before + 1) % 5]);
    expect(monthsFor(cal, 315).length).toBe(cal.months.length + 1);
    expect(monthsFor(cal, 312).length).toBe(cal.months.length);
    expect(dateFor(buildCalendar({ calendar: text, startPoint: "14 Fade 312" }), 1).holiday).toBe("Lanterns");
    const fair = buildCalendar({ calendar: text, startPoint: "1 Thaw 313" });
    expect([1, 2, 3, 4].map((d) => dateFor(fair, d).holiday)).toEqual(["the Thaw Fair", "the Thaw Fair", "the Thaw Fair", undefined]);
  });

  test("weekdays: none and story seasons", () => {
    const cal = buildCalendar({ calendar: "months: Ember (40), Ash (40); weekdays: none; seasons: story", climate: "early winter" });
    expect(dateFor(cal, 1).weekday).toBe("");
    expect(dateFor(cal, 1).season).toBe("winter");
    expect(fmtDate(cal, 1)).toBe("1 Ember");
  });

  test("the almanac reports every moon and takes day length from a story season", () => {
    const s = emptyState();
    s.time = { day: 1, minute: 22 * 60 };
    const r = almanacFor(s, { chatId: "c1", calendar: text, startPoint: "29 Bloom 312 AR", latitude: "51 N" })!;
    expect(r.moons.map((m) => m.name)).toEqual(["Ilse", "Varo"]);
    expect(r.moon.name).toMatch(/^Ilse .+ · Varo .+$/);
    expect(r.calendarNote).toMatch(/Thaw, Bloom, Highsun/);

    const w = emptyState();
    w.time = { day: 1, minute: 12 * 60 };
    w.season = { name: "winter", setAt: null };
    const winter = almanacFor(w, { chatId: "c1", calendar: "Westeros", latitude: "51 N" })!;
    w.season = { name: "summer", setAt: null };
    const summer = almanacFor(w, { chatId: "c1", calendar: "Westeros", latitude: "51 N" })!;
    expect(winter.season).toBe("winter");
    expect(winter.sun.rise > summer.sun.rise).toBe(true);
  });
});

describe("season ledger line", () => {
  test("parses and folds into state", () => {
    expect(parseLine("season: autumn → winter — the white raven came")?.args).toEqual({ name: "winter" });
    expect(parseLine("season: soon")).toBeNull();
    const msg = (i: number, content: string): RawChatMessage => ({ id: `m${i}`, index_in_chat: i, is_user: false, content, swipes: [content], swipe_id: 0 });
    const r = `🗓️ Day 1 🕰️ 18:40\nProse.\n<ledger>\nseason: winter\nmode: social\n</ledger>`;
    const { state } = new LedgerRuntime().fold(toPath([msg(0, r)]), { userName: "Wren", strictness: "strict", sealed: true, romance: "slow" });
    expect(state.season?.name).toBe("winter");
  });
});
