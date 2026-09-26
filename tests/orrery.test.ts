// Orrery navigation: every page is reachable, the dock never holds more than
// five buttons, the orbit lists the open planet's pages, and planets flag
// what needs a look.
import { expect, test } from "bun:test";
import { GROUPS, PAGES, attention, dock, skyHeader, summary } from "../src/frontend/orrery";

const view = {
  enabled: true,
  now: { day: 3, time: "21:40", clock: "Tuesday 14 October 1923, 21:40", band: "evening", weather: { glyph: "🌧", text: "heavy rain", condition: "rain" }, moon: { name: "waning crescent", illumination: 0.2 }, place: ["Lowmarket", "The Rusty Flagon", "back room"], mode: "conflict", title: "Salt in the Wound" },
  cast: [{ tier: "spot" }, { tier: "off" }], bonds: [{}], knowledge: [], timeline: [], codex: [],
  world: { threads: [{}], cons: [{ status: "due" }], deadlines: [{ passed: true, done: false }] },
  lore: { books: { a: {} }, review: [{}, {}] }, counts: { chapters: 1, unverified: 0 }, chronicle: { coverage: { raw: 70 } }, rejected: [],
};

test("thirteen pages: Now plus four groups of three", () => {
  expect(PAGES.length).toBe(13);
  expect(GROUPS.every((g) => g.pages.length === 3)).toBe(true);
  expect(new Set(PAGES).size).toBe(13);
});

test("the dock has the sun and four planets; the orbit shows the open group", () => {
  const closed = dock(view, "bonds", "");
  expect(closed.match(/data-orbit=/g)?.length).toBe(4);
  expect(closed).toContain('data-page="now"');
  expect(closed).not.toContain("almo-orbit");
  const open = dock(view, "bonds", "story");
  for (const p of ["chronicle", "timeline", "world"]) expect(open).toContain(`data-page="${p}"`);
});

test("the sky header shows the live scene and the current group's pages", () => {
  const h = skyHeader(view, "bonds");
  expect(h).toContain("21:40");
  expect(h).toContain("14 October 1923");
  expect(h).toContain("The Rusty Flagon › back room");
  expect(h).toContain('data-page="knowledge"');
  expect(h).toContain('aria-selected="true"');
  expect(skyHeader(view, "now")).not.toContain("almo-seg");
});

test("summaries and attention", () => {
  expect(summary("cast", view)).toBe("2 people · 1 present");
  expect(summary("world", view)).toBe("1 thread · 2 due");
  expect(attention("story", view)).toBe(2);
  expect(attention("library", view)).toBe(2);
  expect(dock(view, "now", "")).toContain("<b>2</b>");
});
