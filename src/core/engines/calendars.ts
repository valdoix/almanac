// Named fantasy calendars. Type the name (or a nickname) in the calendar setting
// ("Westeros", "Roshar; year 1174") and any clause after it overrides a piece.
// Pure data: the frontend reads the list for Session Zero's picker.

import type { CalendarConfig, CalMonth } from "./calendar";

export interface CalendarPreset {
  id: string;
  label: string;
  /** What Session Zero writes into the calendar setting. */
  name: string;
  /** An example start point in this calendar. */
  start: string;
  /** Matched against the calendar setting. */
  match: RegExp;
  build(): Partial<CalendarConfig> & { months: CalMonth[] };
}

const m = (name: string, days: number): CalMonth => ({ name, days });
const fest = (name: string, weekless = false): CalMonth => ({ name, days: 1, festival: true, ...(weekless ? { weekless } : {}) });

const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth"];
// Westeros counts months as moons without naming them; lengths follow our own
// months so the year keeps its canonical 365 days.
const MOON_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// Rosharan numerals, which also name the months.
const VORIN = ["Jes", "Nan", "Chach", "Vev", "Palah", "Shash", "Betab", "Kak", "Tanat", "Ishi"];

export const CALENDAR_PRESETS: CalendarPreset[] = [
  {
    id: "westeros",
    label: "Westeros (A Song of Ice and Fire)",
    name: "Westeros",
    start: "Day 1 · 14th day of the Fifth Moon, 299 AC · 18:40",
    match: /\bwesteros|song of ice and fire|\basoiaf\b|game of thrones|after (the )?conquest|\bseven kingdoms\b/i,
    build: () => ({
      months: ORDINALS.map((o, i) => m(`${o} Moon`, MOON_DAYS[i])),
      weekdays: [],
      yearLabel: "AC",
      format: "{ord} day of the {month}, {year} {era}",
      seasons: "story",
      note: "Westerosi reckoning: years After the Conquest (AC), months counted as moons. Seasons last years, not months, and turn only when the Citadel sends its white ravens.",
    }),
  },
  {
    id: "roshar",
    label: "Roshar (The Stormlight Archive)",
    name: "Roshar",
    start: "Day 1 · 23 Tanat 1174 · 18:40",
    match: /\broshar|stormlight|\bvorin\b|\balethkar\b|\burithiru\b/i,
    build: () => ({
      months: VORIN.map((n) => m(n, 50)),
      weekdays: [],
      format: "{day} {month} {year}",
      seasons: "story",
      named: [{ name: "the Weeping", month: 9, day: 31, days: 40 }],
      // The moons are canon; their cycle lengths are play values.
      moons: [{ name: "Salas", period: 19 }, { name: "Nomon", period: 31 }, { name: "Mishim", period: 43 }],
      note: "Rosharan reckoning: ten months of fifty days (five weeks of ten), five hundred days a year. Seasons are irregular and last weeks, not months. The Weeping, four weeks of unbroken rain, straddles the new year; highstorms sweep in from the east every few days, and people plan around them.",
    }),
  },
  {
    id: "harptos",
    label: "Calendar of Harptos (Forgotten Realms)",
    name: "Harptos",
    start: "Day 1 · 14 Marpenoth 1492 DR · 18:40",
    match: /\bharptos|forgotten realms|faer[uû]n|\bdalereckoning\b|\bD\.?R\.?\s*$/i,
    build: () => ({
      months: [
        m("Hammer", 30), fest("Midwinter"), m("Alturiak", 30), m("Ches", 30), m("Tarsakh", 30), fest("Greengrass"),
        m("Mirtul", 30), m("Kythorn", 30), m("Flamerule", 30), fest("Midsummer"), m("Eleasis", 30), m("Eleint", 30),
        fest("Highharvestide"), m("Marpenoth", 30), m("Uktar", 30), fest("Feast of the Moon"), m("Nightal", 30),
      ],
      weekdays: [],
      yearLabel: "DR",
      leap: { after: 9, name: "Shieldmeet", every: 4 },
      note: "Calendar of Harptos: twelve months of thirty days in three tendays each, with five festival days between months and Shieldmeet after Midsummer every fourth year. Years are Dalereckoning (DR).",
    }),
  },
  {
    id: "shire",
    label: "Shire Reckoning (Middle-earth)",
    name: "Shire Reckoning",
    start: "Day 1 · 22 Halimath 1418 S.R. · 18:40",
    match: /\bshire reckoning|\bshire\b|middle[- ]earth|\bS\.?R\.?\s*$/i,
    build: () => ({
      months: [
        fest("2 Yule"), m("Afteryule", 30), m("Solmath", 30), m("Rethe", 30), m("Astron", 30), m("Thrimidge", 30), m("Forelithe", 30),
        fest("1 Lithe"), fest("Mid-year's Day", true), fest("2 Lithe"),
        m("Afterlithe", 30), m("Wedmath", 30), m("Halimath", 30), m("Winterfilth", 30), m("Blotmath", 30), m("Foreyule", 30), fest("1 Yule"),
      ],
      weekdays: ["Sterday", "Sunday", "Monday", "Trewsday", "Hevensday", "Mersday", "Highday"],
      yearStartWeekday: 0,
      yearLabel: "S.R.",
      leap: { after: 8, name: "Overlithe", every: 4, skipCentury: true, weekless: true },
      note: "Shire Reckoning: twelve months of thirty days with the Yule and Lithe days between them. Every year begins on a Sterday, because Mid-year's Day and Overlithe belong to no week.",
    }),
  },
];

export function presetFor(text: string | undefined): CalendarPreset | undefined {
  const t = (text ?? "").split(/[;\n]/)[0];
  return t.trim() ? CALENDAR_PRESETS.find((p) => p.match.test(t)) : undefined;
}
