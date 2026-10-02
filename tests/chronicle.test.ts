import { describe, expect, test } from "bun:test";
import { LedgerRuntime, toPath, type RawChatMessage } from "../src/core/branch";
import { coverageGaps, emptyChronicle, makeUnit, pickChronicle, planChronicle, splice, storySoFar, validateUnits, zoomCandidates, type ChronicleUnit } from "../src/core/chronicle";
import { classify, seedOverlays } from "../src/core/lore";
import { codexToLorebook, healthCheck, linkEntries, normalizeEntry, simulateActivation, toLumiverse, validateEntry } from "../src/core/creator";
import { extractOps } from "../src/core/extractor";
import { extractJson } from "../src/core/prompts";
import { buildCodex, emptyCodexStore } from "../src/core/codex";

const OPTS = { userName: "Wren", strictness: "strict" as const, sealed: true };

function longChat(n: number): RawChatMessage[] {
  const msgs: RawChatMessage[] = [{ id: "m0", index_in_chat: 0, is_user: false, content: "🗓️ Day 1 · Monday 🕰️ 08:00 ☀️ clear\n📍 Town › Square\n<ledger>\ncast: Mara@spot\nmode: social\n</ledger>" }];
  const places = ["Square", "Inn", "Docks", "Market", "Chapel", "Bridge", "Gate"];
  for (let i = 1; i < n; i++) {
    if (i % 2) msgs.push({ id: `m${i}`, index_in_chat: i, is_user: true, content: `I keep going (${i}).` });
    else {
      const newScene = i % 6 === 0;
      const at = newScene ? `at: Town › ${places[(i / 6) % places.length]}\n` : "";
      msgs.push({ id: `m${i}`, index_in_chat: i, is_user: false, content: `Prose ${i}. `.repeat(40) + `\n<ledger>\nclock: +10m\n${at}bond Mara>Wren: trust +1 — helped ${i}\nmode: social\n</ledger>` });
    }
  }
  return msgs;
}

describe("chronicle", () => {
  test("plans a chapter from completed scenes before the raw tail", () => {
    const rt = new LedgerRuntime();
    const path = toPath(longChat(60));
    const { state } = rt.fold(path, OPTS);
    expect(state.sceneLog.length).toBeGreaterThan(5);
    const job = planChronicle(path, state, emptyChronicle(), { rawTail: 20, rawTailTokens: 12000, chapterThresholdTokens: 6000, fanIn: 4 });
    expect(job?.level).toBe("chapter");
    expect(job!.startIdx).toBe(0);
    expect(job!.endIdx).toBeLessThan(40);
    expect(job!.scenes).toBe(3);
  });

  test("splice replaces covered turns in place; stale units are ignored", () => {
    const rt = new LedgerRuntime();
    const path = toPath(longChat(60));
    const { state } = rt.fold(path, OPTS);
    const store = emptyChronicle();
    const job = planChronicle(path, state, store, { rawTail: 20, rawTailTokens: 12000, chapterThresholdTokens: 6000, fanIn: 4 })!;
    store.units.push(makeUnit(job, "Title: The Long Morning\nWhat happened: Mara and Wren crossed town.", path, state, store));
    const msgs = [{ role: "system" as const, content: "sys" }, ...path.map((m) => ({ role: (m.isUser ? "user" : "assistant") as "user" | "assistant", content: m.content, __isChatHistory: true, sourceMessageId: m.id, sourceIndexInChat: m.index }))];
    const idx = new Map(path.map((m) => [m.id, m.index]));
    const out = splice(msgs, store, idx, storySoFar(store));
    expect(out.dropped).toBe(job.endIdx - job.startIdx + 1);
    expect(out.messages[1].content).toMatch(/^\[Chapter 1: The Long Morning/);
    expect(out.injected[0].index).toBe(1);
    // Edit a covered message → stale → no splice
    const edited = path.map((m) => (m.index === 2 ? { ...m, content: m.content + " edited" } : m));
    const stale = validateUnits(store, edited);
    expect(stale).toHaveLength(1);
    expect(splice(msgs, store, idx, storySoFar(store)).dropped).toBe(0);
    expect(storySoFar(store)).toEqual([]);
  });

  test("summaries go in even when the covered turns are hidden and never reach the prompt", () => {
    const rt = new LedgerRuntime();
    const path = toPath(longChat(60));
    const { state } = rt.fold(path, OPTS);
    const store = emptyChronicle();
    const job = planChronicle(path, state, store, { rawTail: 20, rawTailTokens: 12000, chapterThresholdTokens: 6000, fanIn: 4 })!;
    store.units.push(makeUnit(job, "Title: The Long Morning\nWhat happened: Mara and Wren crossed town.", path, state, store));
    // The host leaves hidden turns out: only the raw tail arrives.
    const visible = path.filter((m) => m.index > job.endIdx);
    const msgs = [{ role: "system" as const, content: "sys" }, ...visible.map((m) => ({ role: (m.isUser ? "user" : "assistant") as "user" | "assistant", content: m.content, __isChatHistory: true, sourceMessageId: m.id, sourceIndexInChat: m.index })), { role: "system" as const, content: "post-history" }];
    const out = splice(msgs, store, new Map(path.map((m) => [m.id, m.index])), storySoFar(store));
    expect(out.dropped).toBe(0);
    expect(out.messages).toHaveLength(msgs.length + 1);
    expect(out.messages[1].content).toMatch(/^\[Chapter 1: The Long Morning/);
    expect((out.messages[2] as any).sourceIndexInChat).toBe(job.endIdx + 1);
    expect(out.injected).toEqual([{ index: 1, name: "ALMANAC · Chapter 1" }]);
  });

  test("the whole story, or only what the turn touches", () => {
    const store = emptyChronicle();
    const texts = [
      "Buffy and Gabriel walk the cemetery. Buffy stakes a fledgling by the mausoleum.",
      "Buffy and Gabriel share waffles at the diner. Ruth the cat steals a strip of bacon.",
      "Buffy finds the black stone in Willow's basement; the runes on it glow when Gabriel touches it.",
      "Buffy and Gabriel argue on the porch about the promise he made to Valeria.",
      "Buffy and Gabriel patrol again. Buffy is quiet about heaven.",
      "Buffy and Gabriel sleep at the shelter after the fight at the Bronze.",
    ];
    texts.forEach((text, i) => store.units.push({ id: `c${i}`, level: "chapter", no: i + 1, title: `Ch${i + 1}`, startIdx: i * 10, endIdx: i * 10 + 9, msgIds: [], signature: "", text, createdAt: 0 } as ChronicleUnit));
    store.units.push({ id: "a1", level: "arc", no: 1, title: "Arc", startIdx: 0, endIdx: 39, msgIds: [], signature: "", text: "The first nights.", children: ["c0", "c1", "c2", "c3"], createdAt: 0 });
    expect(pickChronicle(store, "all", { player: "", lastReply: "", scene: "" }).map((u) => u.id)).toEqual(["a1", "c4", "c5"]);
    const q = { player: "I take the black stone out and turn the glowing runes toward the light.", lastReply: "Buffy watches you.", scene: "Revello Drive · Buffy · Gabriel" };
    expect(pickChronicle(store, "relevant", q).map((u) => u.id)).toEqual(["c2", "c5"]);
    // Names that run through every chapter pick nothing on their own; the latest always goes.
    expect(pickChronicle(store, "relevant", { player: "Buffy looks at Gabriel.", lastReply: "", scene: "Buffy · Gabriel" }).map((u) => u.id)).toEqual(["c5"]);
  });

  test("arcs roll up chapters; a turn that touches a folded chapter brings it back in full", () => {
    const store = emptyChronicle();
    for (let i = 0; i < 4; i++) store.units.push({ id: `c${i}`, level: "chapter", no: i + 1, title: `Ch${i}`, startIdx: i * 10, endIdx: i * 10 + 9, msgIds: [], signature: "", text: i === 2 ? "The harbourmaster's letter burned in the stove." : "Nothing much.", createdAt: 0 });
    const job = planChronicle(toPath(longChat(60)), { sceneLog: [] } as any, store, { rawTail: 20, rawTailTokens: 99999, chapterThresholdTokens: 6000, fanIn: 4 });
    expect(job?.level).toBe("arc");
    store.units.push({ id: "a1", level: "arc", no: 1, title: "Arc", startIdx: 0, endIdx: 39, msgIds: [], signature: "", text: "A long stretch.", children: ["c0", "c1", "c2", "c3"], createdAt: 0 });
    const q = { player: "What happened to the harbourmaster's letter?", lastReply: "", scene: "" };
    expect(zoomCandidates(store, q)[0]?.id).toBe("c2");
    // The whole story: the arc, with the chapter the turn touches right after it, uncut.
    const picked = pickChronicle(store, "all", q);
    expect(picked.map((u) => u.id)).toEqual(["a1", "c2"]);
    const msgs = [{ role: "user" as const, content: "now", __isChatHistory: true, sourceIndexInChat: 50 }];
    const out = splice(msgs, store, new Map(), picked);
    expect(out.messages.map((m) => m.content)).toEqual(["[Arc 1: Arc]\nA long stretch.", "[Chapter 3: Ch2]\nThe harbourmaster's letter burned in the stove.", "now"]);
  });

  test("coverage gaps list important subjects the summary missed", () => {
    const rt = new LedgerRuntime();
    const path = toPath([{ id: "a", index_in_chat: 0, content: "<ledger>\ncast: Mara@spot · Kael@peri\nitem Locket: Kael → Mara — stolen\nknow Kael: Mara stole it | saw · knows · true\n</ledger>" }]);
    const { state, events } = rt.fold(path, { ...OPTS, strictness: "lenient" });
    const gaps = coverageGaps("Mara walked in the rain.", events, state, 0, 0);
    expect(gaps.join(" ")).toMatch(/Locket/);
    expect(gaps.join(" ")).toMatch(/Kael/);
  });
});

describe("lore bridge", () => {
  test("labels, first sentences and metadata", () => {
    const c1 = classify({ id: "1", world_book_id: "b", comment: "Location: The Bronze", content: "The Bronze is a nightclub in Sunnydale. Open 20:00 to 02:00. It is ten minutes' walk from the Magic Box.", key: ["Bronze", "club"] });
    expect(c1).toMatchObject({ kind: "place", name: "The Bronze", parent: "Sunnydale", hours: "20:00 to 02:00" });
    expect(c1.routes?.[0]).toMatch(/walk from the Magic Box/);
    const c2 = classify({ id: "2", world_book_id: "b", comment: "CURRENT - Scoobies Believe Resurrection Failed", content: "The Scoobies believe the spell failed. Unbeknownst to them, it worked.", key: [] });
    expect(c2).toMatchObject({ kind: "belief", mistaken: true });
    const c3 = classify({ id: "3", world_book_id: "b", comment: "Item: Bloodfang", content: "Bloodfang is a cursed longsword carried by Kael.", key: [] });
    expect(c3.holder).toBe("Kael");
    const c4 = classify({ id: "4", world_book_id: "b", comment: "Upcoming: The Council Meets", content: "The Council will meet at midnight.", key: [] });
    expect(c4.kind).toBe("forecast");
    const c5 = classify({ id: "5", world_book_id: "b", comment: "Whatever", content: "x", key: [], extensions: { vellum3: { kind: "situation", tense: "now", participants: ["Spike"], visibility: "public" } } });
    expect(c5).toMatchObject({ kind: "situation", via: "metadata", participants: ["Spike"] });
    const c6 = classify({ id: "6", world_book_id: "b", comment: "Customs: The Crypt", content: "A tunnel runs from the crypt to the brewery; no one knows it is there. A cold draft rises through the crypt floor.", key: [] });
    expect(c6.secret?.sign).toMatch(/cold draft/);
    const ov = seedOverlays([c1, c2, c3, c6]);
    expect(ov["loc:the_bronze"].body!.hours).toBe("20:00 to 02:00");
    expect(Object.values(ov).find((o) => o.name === "The Crypt")?.scope?.narratorOnly).toBe(true);
  });
});

describe("creator", () => {
  test("validator auto-fixes and re-asks", () => {
    const e = normalizeEntry({ comment: "Character: Mara Voss - Smuggler", content: "{{char}} knows her.", key: ["Mara", "sword"], priority: 10, order: 99, selective: true, vectorized: true }, 0);
    const v = validateEntry(e);
    expect(v.entry.priority).toBe(100);
    expect(v.entry.order).toBe(100);
    expect(v.entry.selective).toBe(false);
    expect(v.entry.vectorized).toBe(false);
    expect(v.entry.extensions.vellum3).toMatchObject({ kind: "person", tense: "timeless" });
    expect(v.reask.join(" | ")).toMatch(/second separator/);
    expect(v.reask.join(" | ")).toMatch(/\{\{char\}\}/);
    expect(v.reask.join(" | ")).toMatch(/generic keywords: sword/);
  });

  test("linker, simulator, writers, health check", () => {
    const es = [
      normalizeEntry({ comment: "Location: The Rusty Flagon", content: "The Rusty Flagon is a tavern in Lowmarket. Patches runs the bar.", key: ["Flagon", "tavern"], priority: 100 }, 0),
      normalizeEntry({ comment: "Character: Patches", content: "Patches is the bartender of the Flagon.", key: ["Patches", "bartender"], priority: 150 }, 1),
      normalizeEntry({ comment: "Rule: Thresholds", content: "Vampires CANNOT enter uninvited.", key: ["vampire"], priority: 300, constant: true }, 2),
    ];
    const link = linkEntries(es);
    expect(link.loops).toEqual([[0, 1]]);
    const sim = simulateActivation(es, "We walk into the tavern.");
    expect(sim.map((s) => s.reason)).toEqual(["constant", "keyword “tavern”", "recursion (pass 1) via “Patches”"]);
    expect(toLumiverse(es[0])).toMatchObject({ order_value: 100, match_whole_words: true });
    const hc = healthCheck([{ id: "x", comment: "Upcoming: Doom", content: "Doom is here.", key: [], priority: 10 }]);
    expect(hc.issues.map((i) => i.severity)).toContain("error");
  });

  test("codex → lorebook export", () => {
    const rt = new LedgerRuntime();
    const { state } = rt.fold(toPath([{ id: "a", index_in_chat: 0, content: "<ledger>\ncast: Mara@spot\nitem Locket: +Mara\nthread Lost locket: new — who took it?\n</ledger>" }]), OPTS);
    const book = codexToLorebook(buildCodex(state, emptyCodexStore()));
    const titles = book.map((b) => b.comment);
    expect(titles).toContain("Character: Mara");
    expect(titles).toContain("Item: Locket");
    expect(titles).toContain("CURRENT - Lost locket");
  });
});

describe("extractor and json", () => {
  test("heuristic extraction", () => {
    const ops = extractOps("Twenty minutes later, Kael walks out into the rain. Mara hands the locket to Wren.", ["Kael", "Mara"], "Wren");
    expect(ops.map((o) => o.op)).toEqual(["clock", "cast", "item"]);
    expect(ops[0].args.minutes).toBe(20);
    expect(ops[2].args).toMatchObject({ from: "Mara", to: "Wren" });
  });
  test("json extraction", () => {
    expect(extractJson<any>('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson<any>('noise [1,2] noise')).toEqual([1, 2]);
    // Brackets in the prose before the JSON don't hide it.
    expect(extractJson<any>('Card [b1] retold: {"beats":[{"card":"b1","text":"x"}]}')).toEqual({ beats: [{ card: "b1", text: "x" }] });
  });
});
