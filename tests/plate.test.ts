import { describe, expect, test } from "bun:test";
import { drawPlate, drawPlates, kindChunks, placeKind, eraOf, PLACE_ORDER } from "../src/core/plate";

const head = (place: string, title = "A Title", time = "21:40", wx = "🌧️ rain, heavy · 9°C · wind SW") =>
  `🗓️ Day 3 · Tuesday, 14 October 1923 🕰️ ${time} ${wx}\n📍 ${place}\n# ${title}`;

describe("scene plate: places", () => {
  const cases: [string, string, string][] = [
    ["Lowmarket › The Rusty Flagon › back room", "deco", "r_tavern"],
    ["Sunnydale › Winters Residence › guest bedroom", "modern", "r_bedroom"],
    ["Ashford › Market Square", "old", "city_old"],
    ["Neo Kyoto › Shinjuku district alley", "future", "city_future"],
    ["Kessel Pass › mountain road", "old", "mountain"],
    ["Orbital Station Kepler › observation ring", "future", "space"],
    ["the open sea › deck of the Marigold", "old", "deck"],
    ["Northreach › the frozen highlands", "old", "tundra"],
    ["Ravenhill › the castle walls", "old", "castle"],
    ["Isla Verde › palm beach", "modern", "tropic"],
    ["the jungle › temple steps", "modern", "ruins"],
    ["Kingsbridge › royal gardens", "modern", "garden"],
    ["Riverside › the old stone bridge", "modern", "bridge"],
    ["Mara's apartment › kitchen", "modern", "r_kitchen"],
    ["Sunnydale High › library", "modern", "r_library"],
    ["Sunnydale High › Mr. Flutie's office", "modern", "r_office"],
    ["The Bronze › dance floor", "modern", "r_club"],
    ["Sunnydale Hospital › recovery room", "modern", "r_ward"],
    ["Night train to Vienna › dining carriage", "deco", "r_train"],
    ["Xander's car › backseat", "modern", "r_car"],
    ["USS Valiant › bridge of the ship", "future", "r_bridge"],
    ["The Marigold › captain's quarters", "old", "r_cabin"],
    ["Kyoto › the old dojo", "modern", "r_shrine"],
    ["The Espresso Pump › counter", "modern", "town"],
    ["The Espresso Pump café", "modern", "r_cafe"],
    ["Wolfram & Hart › holding cell", "modern", "r_cell"],
    ["the Winters house › attic", "modern", "r_attic"],
    ["Harrow Manor › wine cellar", "old", "r_cellar"],
    ["Orangery", "old", "r_greenhouse"],
    ["Sunnydale › the Magic Box shop", "modern", "r_shop"],
    ["Royal Theatre › backstage", "deco", "r_theater"],
    ["Ryokan › hot spring", "modern", "r_bath"],
    ["the war camp › command tent", "old", "r_tent"],
    ["somewhere › a room", "future", "r_lab"],
    ["Mount Wilson › the observatory dome", "modern", "r_observatory"],
    ["Monterey Bay Aquarium › the kelp tank", "modern", "r_aquarium"],
    ["Galaxy Arcade › back row", "modern", "r_arcade"],
    ["Suds & Duds laundromat", "modern", "r_laundromat"],
    ["Route 66 › Rosie's Diner", "modern", "r_diner"],
    ["Ironvale › the old forge", "old", "r_forge"],
    ["The Golden Nugget › casino floor", "modern", "r_casino"],
    ["Ravenhill › the wizard's tower study", "old", "r_alchemy"],
    ["The Louvre › Denon wing gallery", "modern", "r_gallery"],
    ["Flight 815 › first class", "modern", "r_plane"],
    ["The Nautilus › submarine control room", "old", "r_submarine"],
    ["Miller farm › the stables", "old", "r_stable"],
    ["Backyard › the treehouse", "modern", "r_treehouse"],
    ["KXLU › recording studio", "modern", "r_studio"],
    ["The Plaza › market stall", "modern", "r_shop"],
    ["Hargreave Manor › the flight of stairs", "old", "r_hall"],
  ];
  for (const [place, era, kind] of cases) test(`${place} → ${kind}`, () => expect(placeKind(place, era)).toBe(kind));

  test("the era comes from a year in the date, else from the genre", () => {
    expect(eraOf("Tuesday, 14 October 1923", "fantasy")).toBe("deco");
    expect(eraOf("14 March 1702", "")).toBe("old");
    expect(eraOf("Year 2387", "")).toBe("future");
    expect(eraOf("Day 4", "dark_fantasy")).toBe("old");
    expect(eraOf("Day 4", "romance")).toBe("modern");
  });

  test("every kind the classifier can name has four drawn variants", () => {
    const keys = new Set(kindChunks().map((c) => c.key));
    const kinds = new Set<string>();
    for (const [k] of PLACE_ORDER) for (const era of ["old", "deco", "modern", "future"]) kinds.add(placeKind(`x › ${k === "r_default" ? "room" : PLACE_ORDER.find(([kk]) => kk === k)![1].split("|")[0].replace(/[\\[\]?]/g, "")}`, era));
    kinds.add("town");
    for (const k of kinds) for (let v = 0; v < 4; v++) expect(keys.has(`${k}-${v}`)).toBe(true);
  });

  test("art chunks are self-contained CSS (no macro or replacement syntax)", () => {
    for (const c of kindChunks()) {
      expect(c.css).not.toContain("{{");
      expect(c.css).not.toContain("::");
      expect(c.css).not.toMatch(/\$\d/);
    }
  });
});

describe("scene plate: drawing", () => {
  test("a header becomes one plate with the place's own art; the raw header is gone", () => {
    const out = drawPlates(`---\n\n${head("Lowmarket › The Rusty Flagon › back room", "Salt in the Wound")}\n\nThe rain came in sideways.`, "mystery");
    expect(out.match(/<div class="p" /g)?.length).toBe(1);
    expect(out).toContain('data-place="r_tavern"');
    expect(out).toContain('data-genre="mystery"');
    expect(out).toContain('<h3 class="ttl">Salt in the Wound</h3>');
    expect(out).toContain("[data-k=r_tavern-");
    expect(out).not.toMatch(/^[ \t]*🗓/mu);
    expect(out.endsWith("The rain came in sideways.")).toBe(true);
    // Drawing again changes nothing.
    expect(drawPlates(out, "mystery")).toBe(out);
  });

  test("one place always looks the same; places differ", () => {
    const k = (p: string) => /data-k="([^"]+)"/.exec(drawPlates(head(p)))![1];
    expect(k("Greywood › the old forest")).toBe(k("Greywood › the old forest"));
    const forests = ["Greywood › the old forest", "the Whispering Wood", "Elderglen › pine forest", "Darkhollow forest", "the forest road › clearing", "Mirkwood"].map(k);
    expect(new Set(forests).size).toBeGreaterThan(1);
  });

  test("model text is escaped", () => {
    const out = drawPlates(head(`<b>Hall</b> › "quoted"`, `<script>x</script>`));
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  test("sun times and moon from the Ledger's suffix reach the plate", () => {
    const out = drawPlates("🗓️ Day 3 · Tuesday 🕰️ 07:05 ☀️ clear ⟪06:42|18:10|🌖 waning gibbous⟫\n📍 Coast");
    expect(out).toContain("--rise:calc(06 + 42 / 60);--set:calc(18 + 10 / 60)");
    expect(out).toContain("☀ 06:42 – 18:10");
    expect(out).toContain("--ph:-8px");
  });

  test("a room plate stays light and fits the plate's slots", () => {
    for (const c of kindChunks().filter((c) => c.key.startsWith("r_"))) {
      const out = drawPlate({ date: "Day 1", hour: 21, minute: "00", glyph: "🌧", cond: "rain", place: "x", title: "T" }, "drama", c.key);
      expect(out.length).toBeLessThan(80_000);
      expect(new Set(out.match(/\[data-k=[a-z_]+-\d\]/g)).size).toBe(1);
      expect(out).toContain('<div class="room set"><i></i>');
    }
  });

  test("outdoor plates carry no room markup", () => {
    const out = drawPlate({ date: "Day 1", hour: 12, minute: "00", glyph: "☀", cond: "clear", place: "Greywood › the old forest", title: "T" }, "drama");
    expect(out).not.toContain("room set");
  });

  test("the day number reaches the title (for the numeral layout)", () => {
    const out = drawPlate({ date: "Day 12 · 3 October 1888", hour: 12, minute: "00", glyph: "☀", cond: "clear", place: "x", title: "T" }, "drama");
    expect(out).toContain('<div class="title" data-n="12">');
  });

  test("a plate stays light: one place's art, not every place's", () => {
    const out = drawPlate({ date: "Day 1", hour: 12, minute: "00", glyph: "☀", cond: "clear", place: "Greywood › the old forest", title: "T" }, "horror");
    expect(out.length).toBeLessThan(60_000);
    expect(out.match(/\[data-k=/g)!.every((m) => m === "[data-k=")).toBe(true);
    expect(new Set(out.match(/\[data-k=[a-z_]+-\d\]/g)).size).toBe(1);
  });
});

