import { describe, expect, test } from "bun:test";
import { fillHeader } from "../src/core/render";
import { PLATE_FIND } from "../preset/src/plate";
import type { AlmanacReport } from "../src/core/engines/almanac";

const al = {
  day: 2, minute: 9 * 60 + 27, date: "Tuesday 16 October 2001",
  weather: { condition: "overcast", tempC: 14, wind: "NW", glyph: "☁️", text: "", source: "model" },
  sun: { rise: "06:42", set: "17:18", text: "", daylight: true }, moon: { name: "waxing crescent", glyph: "🌒", illumination: 0.2 },
} as unknown as AlmanacReport;

describe("scene header on every reply", () => {
  test("a reply without one gets the verified header, drawn by the plate", () => {
    const out = fillHeader("---\n\n# Pretty Laugh\n\nThe sofa dips.", al, ["Winters Residence", "living room"]);
    expect(out.startsWith("---\n\n🗓️ Day 2 · Tuesday 16 October 2001 🕰️ 09:27 ☁️ overcast · 14°C · wind NW")).toBe(true);
    const m = new RegExp(PLATE_FIND).exec(out)!;
    expect(m[2]).toBe("9");
    expect(m[11]).toBe("Winters Residence › living room");
    expect(m[12]).toBe("Pretty Laugh");
  });
  test("a reply that has one is left alone", () => {
    const has = "🗓️ Day 2 · Tuesday 🕰️ 09:25 ☁️ overcast\n📍 Home\n\nProse.";
    expect(fillHeader(has, al, ["Home"])).toBe(has);
  });
});
