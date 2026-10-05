import { describe, expect, test } from "bun:test";
import { classify, parseAgency, seedOverlays, weaverBook, weaverEntry, weaverWorldCard, type LoreEntry } from "../src/core/lore";
import { transcriptFor } from "../src/core/chronicle";
import { tellingPrompt } from "../src/core/elsewhere/telling";
import { buildRoster } from "../src/core/elsewhere/roster";
import { emptyState } from "../src/core/state";

// Shapes as Lumiverse's Dream Weaver writes them (services/weaver/*).
const ANCHOR = {
  id: "a", comment: "Weaver re-anchor", key: ["Buffy Anne Summers"], constant: true,
  content: "Core: Twenty-year-old woman, the current Slayer, who has spent years fighting the supernatural;…\nDrives: Super-objective: Find Dawn and ensure her safety\nVoice: Contemporary, casual, clever, sarcastic\nNow: baseline",
};
const RULES = [
  { id: "r1", comment: "Weaver governance · deliberation & bind", key: [], constant: true, content: "<weaver_deliberation>\nBefore writing {{char}}'s next reply, work through this silently.\n</weaver_deliberation>" },
  { id: "r2", comment: "Weaver governance · voice & anti-patterns", key: [], constant: true, content: "<weaver_craft>\nNarrate in {{char}}'s own voice.\n</weaver_craft>" },
];
const RULES_BOOK = {
  name: "Buffy Anne Summers rules book",
  description: "How Buffy Anne Summers stays itself in any chat: its anchor line and the always-on rules it plays by. Managed by the Weaver; travels with the card on export.",
  metadata: { source: "weaver", weaver_role: "governance", source_character_id: "c1", auto_managed_by_character: true },
};
const entry = (e: Omit<LoreEntry, "world_book_id">): LoreEntry => ({ world_book_id: "wb", ...e });

describe("Dream Weaver books", () => {
  test("finds the book role from metadata, from name and blurb after a plain import, or from the entries", () => {
    const entries = [ANCHOR, ...RULES];
    expect(weaverBook(RULES_BOOK, entries)).toEqual({ role: "governance", subject: "Buffy Anne Summers" });
    // Lumiverse's plain import replaces the metadata with { source: "import" }.
    expect(weaverBook({ ...RULES_BOOK, metadata: { source: "import" } }, entries)?.role).toBe("governance");
    // A card export merges the rules into character_book: only the entries say so.
    expect(weaverBook({ name: "Imported book", metadata: {} }, entries)).toEqual({ role: "governance", subject: "Buffy Anne Summers" });
    expect(weaverBook({ name: "Sunnydale NPC book", description: "The people of Sunnydale. Entries trigger by name so the narrator can voice them on cue.", metadata: { source: "import" } })?.role).toBe("npc");
    expect(weaverBook({ name: "Hellmouth lore book", metadata: { source: "weaver", weaver_role: "lore" } })?.role).toBe("lore");
    expect(weaverBook({ name: "Narcissa Black depth book", metadata: { weaver_role: "depth" } })).toEqual({ role: "depth", subject: "Narcissa Black" });
    expect(weaverBook({ name: "William Peverell — persona depth", metadata: { source: "weaver", persona_depth: true } })).toEqual({ role: "persona", subject: "William Peverell" });
  });

  test("reads a card's rules-and-depth book: rules pinned, depth as scenes and history", () => {
    const book = { name: "Jackie Taylor — rules & depth", description: "Always-on rules that keep Jackie Taylor on-spec in any preset, plus depth entries that surface when their subject comes up.", metadata: { source: "character", auto_managed_by_character: true } };
    const es = [
      { id: "a", comment: "Re-anchor", key: ["Jackie Taylor"], constant: true, content: "Core: Jackie Taylor, 18, Yellowjackets captain, needs to be adored.\nDrives: She wants to matter." },
      { id: "r", comment: "Governance · voice & anti-patterns", key: [], constant: true, content: "<weaver_craft>\nNarrate in {{char}}'s own voice.\n</weaver_craft>" },
      { id: "d1", comment: "Depth · The Dock, Fourth of July 1994", key: ["dock", "fireworks"], content: "On the Fourth of July in 1994, at the end of the Holloways' dock, sixteen-year-old James leaned in to kiss Jackie and she stepped back." },
      { id: "d2", comment: "Depth · When James Comes Out Into the Snow", key: ["first snow"], content: "When James comes out into the first snow for her, she doesn't turn around. \"Go back inside, Holloway.\"" },
    ];
    const wv = weaverBook(book, es)!;
    expect(wv).toEqual({ role: "depth", subject: "Jackie Taylor" });
    // Imported without the name: the titles still say so.
    expect(weaverBook({ name: "Imported", metadata: {} }, es)?.role).toBe("depth");
    const [a, r, d1, d2] = es.map((e) => classify(entry(e), wv));
    expect(a).toMatchObject({ kind: "person", name: "Jackie Taylor", pinned: true });
    expect(r).toMatchObject({ kind: "directive", name: "voice & anti-patterns", pinned: true });
    expect(d1).toMatchObject({ kind: "history", name: "The Dock, Fourth of July 1994" });
    expect(d2).toMatchObject({ kind: "playbook", name: "When James Comes Out Into the Snow" });
    expect([a, r, d1, d2].every((c) => c.confidence >= 0.5)).toBe(true);
  });

  test("leaves ordinary books alone", () => {
    expect(weaverBook({ name: "Sunnydale lore book", description: "My notes", metadata: {} }, [{ comment: "Location: The Bronze", content: "The Bronze is a nightclub." }])).toBeNull();
    expect(weaverBook({ name: "ALMANAC · 28 Sept", metadata: { almanac_chat_id: "x" } }, RULES)).toBeNull();
    expect(weaverEntry({ comment: "Rule: Magic", content: "RULE: Magic always has a cost." })).toBeNull();
  });

  test("reads the rules book: the re-anchor is the character, the governance entries are always-on rules", () => {
    const wv = weaverBook(RULES_BOOK, [ANCHOR, ...RULES]);
    const [a, r1, r2] = [ANCHOR, ...RULES].map((e) => classify(entry(e), wv));
    expect(a).toMatchObject({ kind: "person", name: "Buffy Anne Summers", role: "Twenty-year-old woman, the current Slayer", via: "weaver", pinned: true });
    expect(a.want).toContain("Find Dawn");
    expect(a.voice).toContain("sarcastic");
    expect(a.summary.endsWith("…")).toBe(false);
    expect(r1).toMatchObject({ kind: "directive", name: "deliberation & bind", pinned: true, confidence: 1 });
    expect(r2.kind).toBe("directive");
    // Rules are instructions, not story: no Codex records for them.
    const ov = seedOverlays([a, r1, r2]);
    expect(Object.keys(ov)).toEqual(["char:buffy_anne_summers"]);
    expect(ov["char:buffy_anne_summers"].body).toMatchObject({ voice: expect.stringContaining("casual"), want: expect.stringContaining("Dawn") });
  });


  test("the re-anchor fills the lore's own card for the character instead of making a second one", () => {
    const lore = classify(entry({ id: "l", comment: "Character: Buffy Summers", key: ["Buffy", "Buffy Anne Summers"], content: "Buffy Summers is a human Vampire Slayer." }));
    const anchor = classify(entry(ANCHOR), weaverBook(RULES_BOOK, [ANCHOR]));
    const ov = seedOverlays([lore, anchor]);
    expect(Object.keys(ov)).toEqual(["char:buffy_summers"]);
    const buffy = ov["char:buffy_summers"];
    expect(buffy.aliases).toEqual(expect.arrayContaining(["Buffy", "Buffy Anne Summers"]));
    expect(buffy.body).toMatchObject({ role: "human Vampire Slayer", voice: expect.stringContaining("casual") });
  });

  test("NPC entries are people; depth entries are about the character (or the persona)", () => {
    const npc = weaverBook({ name: "Sunnydale NPC book", metadata: { weaver_role: "npc" } })!;
    expect(classify(entry({ id: "n", comment: "Principal Snyder", key: ["Snyder"], content: "A small, vindictive man who runs Sunnydale High." }), npc)).toMatchObject({ kind: "person", name: "Principal Snyder", confidence: 0.9 });
    const depth = weaverBook({ name: "Buffy Anne Summers depth book", metadata: { weaver_role: "depth" } })!;
    const past = classify(entry({ id: "d1", comment: "Years in Isolation", key: ["childhood"], content: "She grew up far from all this." }), depth);
    const now = classify(entry({ id: "d2", comment: "What Buffy fears", key: [], content: "She fears being only the Slayer." }), depth);
    expect(past).toMatchObject({ kind: "history", subject: "Buffy Anne Summers" });
    expect(now).toMatchObject({ kind: "texture", confidence: 0.6 });
    expect(seedOverlays([now])["lore:what_buffy_fears"].links).toEqual([{ rel: "about", to: "char:buffy_anne_summers" }]);
    const persona = weaverBook({ name: "William Peverell — persona depth", metadata: { persona_depth: true } })!;
    const p = classify(entry({ id: "p", comment: "The Marriage Contract", key: [], content: "An old contract binds him." }), persona);
    expect(seedOverlays([p], { userName: "William Peverell" })["lore:the_marriage_contract"].links).toEqual([{ rel: "about", to: "char:user" }]);
  });
});

// A Weaver world build (services/weaver/registries/world.ts): a narrator card named after the place,
// a rules book written for a narrator, a lore book and an NPC book.
const WORLD_CARD = {
  name: "Saltmere",
  extensions: {
    weaver: {
      schema: 1, source: "weaver", session_id: "s1",
      structured: {
        premise: { content: "Saltmere is a fishing town that pays a yearly tithe to something under the bay." },
        central_tension: { content: "This year the count came back short, and nobody will say by how much." },
        world_agency: { content: "…", parts: [{ id: "agenda", content: "The tithe will be paid in full before the spring tide." }, { id: "holds", content: "No one who has read the full ledger leaves Saltmere" }] },
      },
    },
  },
};
const WORLD_RULES = [
  { id: "wa", comment: "Weaver re-anchor", key: ["Saltmere"], constant: true, content: "Core: A fishing town that pays a yearly tithe to something under the bay;…\nTension: The count came back short\nStance: Polite, watchful, owed nothing\nVoice: Salt-dry, unhurried\nNow: baseline" },
  { id: "w1", comment: "Weaver governance · lore canon", key: [], constant: true, content: "<weaver_lore>\nLore entries surface alongside this card when they become relevant to the scene.\n</weaver_lore>" },
  { id: "w2", comment: "Weaver governance · narrator craft", key: [], constant: true, content: "<weaver_narrator>\nYou run this place.\n</weaver_narrator>" },
  { id: "w3", comment: "Weaver governance · NPC voicing", key: [], constant: true, content: "<weaver_npcs>\nWhen an NPC entry surfaces, voice that person from their entry.\n</weaver_npcs>" },
  { id: "w4", comment: "Weaver governance · world agency", key: [], constant: true, content: "<weaver_world_agency>\nThis world has its own agenda.\n</weaver_world_agency>" },
  { id: "w5", comment: "Weaver agency · agenda and holds", key: [], constant: true, content: "<weaver_agency>\nAgenda: The tithe will be paid in full before the spring tide, one way or another.\nHard lines that never bend:\n- No one who has read the full ledger leaves Saltmere\n- The thing under the bay is never described, only evidenced\n</weaver_agency>" },
];
const WORLD_BOOK = { name: "Saltmere rules book", metadata: { weaver_role: "governance" } };

describe("Dream Weaver worlds", () => {
  test("knows a world's narrator card by the Bible slots on it, and a character card is not one", () => {
    expect(weaverWorldCard(WORLD_CARD)).toEqual({
      name: "Saltmere",
      premise: "Saltmere is a fishing town that pays a yearly tithe to something under the bay.",
      tension: "This year the count came back short, and nobody will say by how much.",
    });
    expect(weaverWorldCard({ name: "Buffy", extensions: { weaver: { source: "weaver", structured: { archetype: { content: "Chosen hero" } } } } })).toBeNull();
    expect(weaverWorldCard({ name: "Plain", extensions: {} })).toBeNull();
  });

  test("the world's rules book: the anchor is the place, the rules and agenda are always-on rules", () => {
    const wv = weaverBook(WORLD_BOOK, WORLD_RULES);
    expect(wv).toEqual({ role: "governance", subject: "Saltmere", world: true });
    const cs = WORLD_RULES.map((e) => classify(entry(e), wv));
    expect(cs[0]).toMatchObject({ kind: "place", name: "Saltmere", tension: "The count came back short", pinned: true });
    expect(cs.slice(1).map((c) => c.kind)).toEqual(["directive", "directive", "directive", "directive", "directive"]);
    expect(cs[5]).toMatchObject({
      agenda: "The tithe will be paid in full before the spring tide, one way or another.",
      holds: ["No one who has read the full ledger leaves Saltmere", "The thing under the bay is never described, only evidenced"],
    });
    const ov = seedOverlays(cs);
    expect(Object.keys(ov)).toEqual(["loc:saltmere"]);
    expect(ov["loc:saltmere"].body).toEqual({ tension: "The count came back short" });
  });

  test("a world anchor with no tension or stance line is still the place when the book is a world's", () => {
    const anchor = { id: "wa", comment: "Weaver re-anchor", key: ["Saltmere"], content: "Core: A fishing town\nVoice: Salt-dry\nNow: baseline" };
    expect(classify(entry(anchor), weaverBook(WORLD_BOOK, [anchor, WORLD_RULES[2]])).kind).toBe("place");
    // Without the narrator rules or the card to say so, the same lines read as a character.
    expect(classify(entry(anchor), weaverBook(WORLD_BOOK, [anchor])).kind).toBe("person");
    expect(parseAgency("Agenda: Open the rift")).toEqual({ agenda: "Open the rift", holds: [] });
  });

  test("the world's anchor fills the lore book's entry about the place instead of a second record", () => {
    const wv = weaverBook(WORLD_BOOK, WORLD_RULES)!;
    const place = classify(entry({ id: "l", comment: "Location: Saltmere", key: ["Saltmere"], content: "Saltmere is a grey town." }));
    const ov = seedOverlays([place, classify(entry(WORLD_RULES[0]), wv)]);
    expect(Object.keys(ov)).toEqual(["loc:saltmere"]);
    expect(ov["loc:saltmere"]).toMatchObject({ summary: "Saltmere is a grey town.", body: { tension: "The count came back short" } });
  });

  test("lore book entries are sorted by their titles; the unclear ones go to review", () => {
    const lore = weaverBook({ name: "Saltmere lore book", description: "The deep lore of Saltmere. Entries surface on relevance so the narrator consults canon instead of inventing it.", metadata: { source: "import" } })!;
    expect(lore.role).toBe("lore");
    const read = (title: string) => classify(entry({ id: title, comment: title, key: [], content: "Nobody in town says much about it." }), lore);
    expect(read("The Founding of Saltmere").kind).toBe("history");
    expect(read("The Harbour Guild").kind).toBe("group");
    expect(read("Rules of the Tithe Boat").kind).toBe("law");
    expect(read("Collection Night").kind).toBe("texture");
    expect(read("The Tithe Ledger").kind).toBe("object");
    expect(read("The Old Lighthouse").kind).toBe("place");
    expect(read("What the Gulls Know")).toMatchObject({ kind: "texture", confidence: 0.3, via: "guess" });
  });

  test("the chronicle calls a world card's replies the Narrator's", () => {
    const path = [
      { id: "1", index: 0, isUser: false, name: "Saltmere", content: "Fog lies on the bay.", swipe: 0 },
      { id: "2", index: 1, isUser: true, name: "Ada", content: "I walk to the harbour office.", swipe: 0 },
      { id: "3", index: 2, isUser: false, name: "Tam", content: "Tam shrugs.", swipe: 0 },
    ] as any;
    const job = { startIdx: 0, endIdx: 2 } as any;
    expect(transcriptFor(path, job, "Ada", "Saltmere", true)).toBe("Narrator: Fog lies on the bay.\n\nAda: I walk to the harbour office.\n\nTam: Tam shrugs.");
    expect(transcriptFor(path, job, "Ada", "Saltmere").startsWith("Saltmere: Fog")).toBe(true);
  });

  test("the off-screen simulator treats the world's agenda as an actor and its holds as unbreakable", () => {
    const roster = buildRoster({ state: emptyState(), records: [], userName: "Ada" });
    const ctx = { userName: "Ada", roster, offPage: [], truths: [], recent: [], places: [], objects: [], holds: ["the river never floods the old town"] };
    const card = (kind: any) => ({ id: "b1", arcId: "x", kind, lead: "the world", cast: [], result: "win" as const, roll: [5, 6] as [number, number], mod: 0, stage: "rising" as const, clock: "2/8", atAbs: 600, premise: "p", want: "to w", fear: "f", leadText: "", knows: [], noRoute: [], grounds: ["world"], template: "t", line: 0 });
    const withWorld = tellingPrompt([card("world")], ctx).system;
    expect(withWorld).toContain("Lines under HOLDS never break");
    expect(withWorld).toContain("the river never floods the old town");
    expect(tellingPrompt([card("pursuit")], ctx).system).not.toContain("HOLDS");
  });
});
