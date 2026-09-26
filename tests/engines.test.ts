import { describe, expect, test } from "bun:test";
import { buildCalendar, dateFor, fmtDate } from "../src/core/engines/calendar";
import { latitudeFrom, moonFor, skyBand, sunFor } from "../src/core/engines/astro";
import { CLIMATES, climateFrom, levelOf, simulate } from "../src/core/engines/weather";
import { almanacFor, isOpen, parseHours, parseRoutine, routineAt } from "../src/core/engines/almanac";
import { emptyState } from "../src/core/state";

describe("calendar", () => {
  test("gregorian start point with weekday", () => {
    const cal = buildCalendar({ startPoint: "Day 1 · 14 October 1923 · 18:40" });
    const d1 = dateFor(cal, 1);
    expect(d1).toMatchObject({ dayOfMonth: 14, month: "October", year: 1923, weekday: "Sunday", season: "autumn" });
    expect(fmtDate(cal, 19)).toBe("Thursday 1 November 1923");
    expect(dateFor(cal, 80).year).toBe(1924);
  });
  test("custom story calendar", () => {
    const cal = buildCalendar({ headerDate: "Thursday, 14 Frostmoon" });
    expect(dateFor(cal, 1)).toMatchObject({ month: "Frostmoon", dayOfMonth: 14, weekday: "Thursday" });
    expect(dateFor(cal, 2).weekday).toBe("Friday");
    const c2 = buildCalendar({ calendar: "weekdays: Moonday, Tirsday, Wodday, Thorday, Freeday, Starday, Sunday; months: Hammer (30), Alturiak (30), Ches (30)" });
    expect(dateFor(c2, 32)).toMatchObject({ month: "Alturiak", dayOfMonth: 2, weekday: "Thorday" });
  });
  test("season words set the opening when there is no date", () => {
    expect(dateFor(buildCalendar({ climate: "temperate maritime, late autumn" }), 1).season).toBe("autumn");
    expect(dateFor(buildCalendar({ climate: "desert, midsummer" }), 1).season).toBe("summer");
    expect(dateFor(buildCalendar({ climate: "midsummer", latitude: "southern temperate" }), 1).season).toBe("winter");
  });
});

describe("sun and moon", () => {
  test("day length follows season and latitude", () => {
    const summer = sunFor(172, 51);
    const winter = sunFor(355, 51);
    expect(summer.daylightMin).toBeGreaterThan(16 * 60);
    expect(winter.daylightMin).toBeLessThan(8 * 60 + 30);
    expect(sunFor(172, 78).polar).toBe("day");
    expect(sunFor(355, 78).polar).toBe("night");
    expect(latitudeFrom("subarctic")).toBe(64);
    expect(latitudeFrom("34 S")).toBe(-34);
  });
  test("moon cycles through phases", () => {
    const names = new Set<string>();
    for (let d = 1; d <= 30; d++) names.add(moonFor(d, 0, 0).name);
    expect(names.size).toBe(8);
    expect(moonFor(1, 0, 14.76).name).toBe("full moon");
  });
  test("sky bands", () => {
    const sun = sunFor(285, 45);
    expect(skyBand(2 * 60, sun)).toBe("deep night");
    expect(skyBand(12 * 60, sun)).toBe("midday");
    expect(skyBand((sun.sunset ?? 1080) - 30, sun)).toBe("golden hour");
  });
});

describe("weather", () => {
  test("deterministic and gradual", () => {
    const input = { seed: "chat-1", climate: CLIMATES.maritime, season: "autumn" as const };
    const a = simulate(input, 0, 24 * 60 * 10);
    const b = simulate(input, 0, 24 * 60 * 10);
    expect(a).toEqual(b);
    for (let i = 1; i < a.length; i++) expect(Math.abs(a[i].level - a[i - 1].level)).toBeLessThanOrEqual(1);
    const levels = new Set(a.map((h) => h.level));
    expect(levels.size).toBeGreaterThan(2);
  });
  test("anchored walk starts from the model's weather", () => {
    const anchor = { abs: 5000, level: 7 as const, tempC: 9 };
    const h = simulate({ seed: "x", climate: CLIMATES.maritime, season: "autumn", anchor }, 5000, 5000 + 12 * 60);
    expect(h[0].level).toBe(7);
    expect(h[0].tempC).toBeCloseTo(9, 0);
  });
  test("snow in the cold", () => {
    const h = simulate({ seed: "cold", climate: CLIMATES.subarctic, season: "winter", anchor: { abs: 0, level: 5, tempC: -15 } }, 0, 60);
    expect(h[0].condition).toMatch(/snow|blizzard/);
  });
  test("climate and level parsing", () => {
    expect(climateFrom("hot desert").id).toBe("desert");
    expect(climateFrom("").id).toBe("maritime");
    expect(levelOf("heavy rain").level).toBe(6);
    expect(levelOf("thunderstorm").level).toBe(7);
    expect(levelOf("clear night").level).toBe(0);
    expect(levelOf("thick fog").fog).toBe(true);
  });
});

describe("almanac facade", () => {
  test("report from state", () => {
    const s = emptyState();
    s.time = { day: 3, minute: 14 * 60 + 32 };
    s.weather = { condition: "heavy rain", intensity: "heavy", tempC: 9, wind: "NW", setAt: { day: 3, minute: 14 * 60 + 20 }, source: "model" };
    const r = almanacFor(s, { chatId: "c1", climate: "temperate maritime", startPoint: "14 October 1923" })!;
    expect(r.clock).toBe("Tuesday 16 October 1923, 14:32");
    expect(r.weather.condition).toBe("heavy rain");
    expect(r.sun.text).toMatch(/^rise \d\d:\d\d · set \d\d:\d\d$/);
    expect(r.forecast.length).toBeGreaterThan(5);
  });
  test("hours and routines", () => {
    expect(parseHours("open 20:00 to 02:00")).toEqual([1200, 120]);
    expect(isOpen([1200, 120], 60)).toBe(true);
    expect(isOpen([1200, 120], 600)).toBe(false);
    const r = parseRoutine("06:00–09:00 docks (unloading); 09:00–18:00 harbour office");
    expect(routineAt(r, 7 * 60)).toMatchObject({ place: "docks", activity: "unloading" });
    expect(routineAt(r, 12 * 60)?.place).toBe("harbour office");
  });
});

describe("calendar anchoring", () => {
  test("a date read from a Day 3 header belongs to Day 3", () => {
    const cal = buildCalendar({ headerDate: "Tuesday, 14 October 1923", anchorDay: 3 });
    const d3 = dateFor(cal, 3);
    expect([d3.weekday, d3.dayOfMonth, d3.month, d3.year]).toEqual(["Tuesday", 14, "October", 1923]);
    expect(dateFor(cal, 1).dayOfMonth).toBe(12);
  });
  test("a start point's own date is not shifted", () => {
    const cal = buildCalendar({ startPoint: "Day 1 · 14 October 1923 · 18:40", headerDate: "Thursday, 16 October 1923", anchorDay: 3 });
    expect(dateFor(cal, 1).dayOfMonth).toBe(14);
  });
});
