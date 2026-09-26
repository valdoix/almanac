import { describe, expect, test } from "bun:test";
import { LedgerRuntime, toPath, type RawChatMessage } from "../src/core/branch";
import { buildCodex, emptyCodexStore, detectDivergence } from "../src/core/codex";
import { cleanKeys, KeyIndex, updateHeat } from "../src/core/keys";
import { recall, tierGuess } from "../src/core/recall";
import { buildLedgerNote, knowledgeBrief } from "../src/core/note";
import { craftReport, genreNudge } from "../src/core/telemetry";
import { chekhovNudges, drawPressures } from "../src/core/pressures";
import { almanacFor } from "../src/core/engines/almanac";

const OPTS = { userName: "Wren", strictness: "strict" as const, sealed: true };
const m = (i: number, c: string, u = false): RawChatMessage => ({ id: `m${i}`, index_in_chat: i, is_user: u, content: c });

const R1 = `🗓️ Day 1 · Monday 🕰️ 18:40 🌧️ rain, light · 11°C
📍 Lowmarket › The Rusty Flagon
<ledger>
cast: Mara@spot(by the fire) · Kael@peri(at the bar)
mood Mara: guarded | V-1 A2 D1
item Silver Locket: +Wren
keys Silver Locket: engraving, clasp
know Mara: the cargo was never Vance's to sell | saw · knows · true
know Kael: bandits took the cargo | told · believes · false
owe Mara → Wren: a favour | open [due Day 1 20:00]
plant: a cracked bell above the door | rings when the river rises
mode: social
</ledger>`;

function world() {
  const rt = new LedgerRuntime();
  const { state } = rt.fold(toPath([m(0, R1)]), OPTS);
  return state;
}

describe("codex and keys", () => {
  test("derives records from state", () => {
    const state = world();
    const recs = buildCodex(state, emptyCodexStore());
    const ids = recs.map((r) => r.id);
    expect(ids).toContain("char:mara");
    expect(ids).toContain("item:silver_locket");
    expect(ids.some((i) => i.startsWith("fact:"))).toBe(true);
    const locket = recs.find((r) => r.id === "item:silver_locket")!;
    expect(locket.summary).toContain("held by Wren");
    expect(locket.keys).toContain("engraving");
  });

  test("overlay adds lore baselines and locked edits", () => {
    const state = world();
    const store = emptyCodexStore();
    store.overlays["char:vance"] = { id: "char:vance", standalone: true, kind: "person", name: "Vance", summary: "Vance is a harbour broker.", provenance: { source: "lore" } };
    store.overlays["char:mara"] = { id: "char:mara", summary: "Mara is a smuggler.", locked: true, userKeys: ["smuggling"] };
    const recs = buildCodex(state, store);
    expect(recs.find((r) => r.id === "char:vance")?.summary).toBe("Vance is a harbour broker.");
    const mara = recs.find((r) => r.id === "char:mara")!;
    expect(mara.summary).toBe("Mara is a smuggler.");
    expect(mara.keys).toContain("smuggling");
  });

  test("key hygiene", () => {
    expect(cleanKeys(["Locket", "love", "the old sword", "door", "Mara", "engraving", "silver chain"], { name: "Silver Locket", castNames: ["Mara"] })).toEqual(["locket", "engraving", "silver chain"]);
  });

  test("aho-corasick whole-word, possessive, plural", () => {
    const state = world();
    const idx = new KeyIndex(buildCodex(state, emptyCodexStore()));
    const hits = idx.match("She turns the lockets over; Mara's engraving glints. Engravings everywhere. Kaelan waves.");
    const ids = hits.map((h) => h.recordId);
    expect(ids).toContain("char:mara");
    expect(ids).toContain("item:silver_locket");
    expect(ids).not.toContain("char:kael");
  });

  test("key heat demotes idle keys", () => {
    let heat = {};
    for (let i = 0; i < 4; i++) heat = updateHeat(heat, ["item:x|shiny"], new Set());
    expect((heat as any)["item:x|shiny"].demoted).toBe(true);
  });
});

describe("recall and note", () => {
  test("recall ranks what the player mentions and what is due", () => {
    const state = world();
    const recs = buildCodex(state, emptyCodexStore());
    const r = recall({
      state, records: recs, index: new KeyIndex(recs), playerMsg: "I show her the engraving on the locket.", lastReply: "", recent: [],
      tier: "routine", budget: 800, allowNarratorOnly: true, userName: "Wren",
    });
    expect(r.items[0].record.id).toBe("item:silver_locket");
    expect(r.text).toContain("<recall>");
    expect(r.feed.find((f) => f.id.startsWith("cons:"))?.reasons.join(" ")).toMatch(/due/);
  });

  test("knowledge-perspective fact rendering", () => {
    const state = world();
    const recs = buildCodex(state, emptyCodexStore());
    const r = recall({ state, records: recs, index: new KeyIndex(recs), playerMsg: "What happened to the cargo?", lastReply: "", recent: [], tier: "charged", budget: 1200, allowNarratorOnly: true, userName: "Wren" });
    const facts = r.items.filter((i) => i.record.kind === "fact").map((i) => i.text).join("\n");
    expect(facts).toContain("Present: Mara (knows");
    expect(facts).toMatch(/Do not let Kael act on the truth/);
  });

  test("knowledge brief lists what NPCs don't know", () => {
    const state = world();
    const kb = knowledgeBrief(state, "the cargo Vance sold", "Wren");
    expect(kb.join("\n")).toContain("Kael — ");
    expect(kb.join("\n")).toMatch(/WRONG: bandits took the cargo/);
    expect(kb.join("\n")).toMatch(/DOES NOT KNOW: the cargo was never Vance's to sell/);
  });

  test("ledger note lanes", () => {
    const state = world();
    const recs = buildCodex(state, emptyCodexStore());
    const al = almanacFor(state, { chatId: "c", startPoint: "14 October 1923" });
    const note = buildLedgerNote({ state, almanac: al, records: recs, userName: "Wren", sealed: true, query: "cargo" });
    expect(note.text).toMatch(/^<ledger-note>\n\[NOW\] Day 1 · Sunday 14 October 1923, 18:40/);
    expect(note.text).toContain("[PRESENT] Mara (spotlight; by the fire; guarded V-1 A2 D+1");
    expect(note.text).toContain("Mara → Wren: a favour (due in 1 h 20 min)");
    expect(note.text).toContain("[KNOWLEDGE]");
    expect(note.text).toContain("[ARRIVED] (none");
    expect(tierGuess("I draw my sword", state)).toBe("pivotal");
  });
});

describe("telemetry and pressures", () => {
  test("craft report finds repeats, openings and agency slips", () => {
    const reps = [
      "The rain hammered the glass. For a long moment nobody spoke.",
      "The rain kept on. For a long moment she said nothing, not angry but tired.",
      "Rain again, softer. For a long moment the room held still, not cold but careful. Wren felt the weight of it.",
    ];
    const r = craftReport(reps, { userName: "Wren", sealed: true });
    expect(r.avoids.join(" ")).toMatch(/for a long moment/);
    expect(r.agency[0]).toMatch(/Wren's inner state/);
    expect(r.openings.filter((o) => o === "weather").length).toBe(3);
  });

  test("genre nudge after three silent turns", () => {
    const state = world();
    expect(genreNudge(state, "mystery", [2, 4])).toBeNull();
    expect(genreNudge(state, "mystery", [2, 4, 6])).toMatch(/Mystery: no clue has moved for 3 turns/);
  });

  test("pressures are seeded; chekhov waits for scenes", () => {
    const state = world();
    const a = drawPressures(state, "seed", ["noir"], {});
    const b = drawPressures(state, "seed", ["noir"], {});
    expect(a).toEqual(b);
    expect(Object.keys(a)).toContain("mara");
    expect(chekhovNudges(state, ["comedy"])).toEqual([]);
    state.sceneNo += 5;
    expect(chekhovNudges(state, ["comedy"])[0]).toMatch(/cracked bell/);
  });

  test("divergence of lore baselines", () => {
    const state = world();
    state.chars.kael.dead = true;
    const store = emptyCodexStore();
    store.overlays["lore:kael"] = { id: "lore:kael", standalone: true, kind: "person", name: "Kael", provenance: { source: "lore" } };
    const d = detectDivergence(state, buildCodex(state, store));
    expect(d[0]).toMatchObject({ id: "lore:kael" });
  });
});
