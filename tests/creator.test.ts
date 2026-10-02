// The Almanac lorebook format, the reader of free-form books, and the creator's core: the
// converter, the proposal the chat agrees on, and the model's replies. Titles and openings here
// are the shapes found in players' own books.
import { describe, expect, test } from "bun:test";
import { classify, seedOverlays, splitTitle } from "../src/core/lore";
import { categoryOfLabel, formatGuide, readLoreMeta, withLoreMeta } from "../src/core/loreformat";
import { bookIndex, conversionUpdate, convertedTitle, makeProposal, normalizeEntry, parseReply, planConversion, proposalText, reviseProposal, validateEntry, type BookEntry } from "../src/core/creator";
import { extractJson } from "../src/core/prompts";

const read = (comment: string, content: string, position = 0, key: string[] = []) => classify({ id: comment, world_book_id: "b", comment, content, key, position });

describe("reading free-form books", () => {
  test("labels the format knows, including ones that carry their subject", () => {
    expect(splitTitle("Character: Buffy Summers")).toMatchObject({ label: "Character", name: "Buffy Summers" });
    // Only known labels are labels: this is about Buffy Summers.
    expect(splitTitle("Buffy Summers - The Slayer")).toMatchObject({ name: "Buffy Summers", descriptor: "The Slayer" });
    expect(splitTitle("Watcher System - Training and Failure").name).toBe("Watcher System: Training and Failure");
    expect(splitTitle("CURRENT - Spike and Dawn Flee the Raid").name).toBe("Spike and Dawn Flee the Raid");
    expect(categoryOfLabel("AU Canon")?.id).toBe("boundary");
    expect(categoryOfLabel("Speech and Manner")?.id).toBe("voice");
    expect(categoryOfLabel("Theme")?.id).toBe("ooc");
  });

  test("content tags", () => {
    expect(read("Vampire Invitation Barrier", "RULE: A vampire CANNOT enter a private home uninvited.")).toMatchObject({ kind: "law", via: "tag" });
    expect(read("Season One Arc - Calling", "STORY ARC: Buffy arrives in Sunnydale.").kind).toBe("history");
    expect(read("Romance and Intrigue Tone", "AI DIRECTIVE: Preserve slow-burn romance.").kind).toBe("meta");
    expect(read("Resurrection Event - Sequence", "CUTOFF EVENT: Willow leads the ritual.").kind).toBe("boundary");
  });

  test("people: by rank, by a name-led opening, by their first sentence", () => {
    expect(read("Princess Rhaenyra Targaryen", "Rhaenyra Targaryen is eighteen, Viserys's firstborn.", 1)).toMatchObject({ kind: "person", name: "Rhaenyra Targaryen" });
    expect(read("Lyonel Strong - Hand of the King", "Lord Lyonel Strong, Hand of the King to Viserys I.")).toMatchObject({ kind: "person", name: "Lyonel Strong" });
    expect(read("Cordelia Chase - Former Scooby", "Cordelia Chase began as Sunnydale High's queen.", 1)).toMatchObject({ kind: "person", name: "Cordelia Chase", role: "Former Scooby" });
    expect(read("Rupert Giles - Watcher", "Rupert Giles is Buffy's Watcher and surrogate father.", 1)).toMatchObject({ kind: "person", role: "Watcher and surrogate father" });
    expect(read("Quentin Travers - Senior Watcher", "Quentin Travers is a senior Watchers Council authority who values tradition.", 1).kind).toBe("person");
    expect(read("Elia Martell", "Elia Martell — Twenty-two years old, Princess of Dorne.").kind).toBe("person");
    expect(read("Joyce Summers - Deceased Matriarch", "Joyce Summers was Buffy's mother.", 1)).toMatchObject({ kind: "person", dead: true });
    // Not people: a stake named like one, a possessive event, a rank that's a place.
    expect(read("Mr. Pointy", "Mr. Pointy is a wooden stake Kendra carried.").kind).toBe("object");
    expect(read("Mayor Wilkins's Ascension", "At graduation Mayor Richard Wilkins completed his plan and Ascended.").kind).toBe("history");
    expect(read("King's Landing", "King's Landing sprawls around Aegon's High Hill.").kind).not.toBe("person");
  });

  test("relationships, voices and beliefs", () => {
    const bond = read("Buffy & Spike - Hostility, Truce, Unwanted Devotion", "Buffy and Spike began as mortal enemies.", 1);
    expect(bond).toMatchObject({ kind: "bond", name: "Buffy & Spike", participants: ["Buffy", "Spike"] });
    expect(read("Viserys and Rhaegel", "Viserys's relationship with Rhaegel is defined by grief.", 1).kind).toBe("bond");
    // Not a pair of people.
    expect(read("Kendra Dies & Acathla Opens", "As Angelus prepared to awaken Acathla, Drusilla killed Kendra.").kind).toBe("history");
    expect(read("Red Keep & Court - 115 AC", "The Red Keep dominates King's Landing.").kind).not.toBe("bond");
    const voice = read("Rhaenyra - Speech and Manner", "When Rhaenyra speaks, her rank is rarely far from the surface.", 2);
    expect(voice).toMatchObject({ kind: "texture", category: "voice", subject: "Rhaenyra" });
    expect(read("What Laenor and Laena Do Not Know", "Laenor and Laena do NOT know the truth.", 1)).toMatchObject({ kind: "belief", participants: ["Laenor", "Laena"] });
    expect(read("What the Realm Believes", "The realm knows Viserys loves Rhaenyra.")).toMatchObject({ kind: "belief", visibility: "public" });
  });

  test("history by date, title verb or past tense; places and groups by their nouns", () => {
    expect(read("109 AC - Daemon Begins the Assassination Campaign", "In 109 AC, Daemon began arranging attempts.")).toMatchObject({ kind: "history", name: "Daemon Begins the Assassination Campaign" });
    expect(read("The Wildfire Nameday - 5 Third Moon 281 AC", "On Aelor's nameday, Aerys threw a feast.")).toMatchObject({ kind: "history", name: "The Wildfire Nameday" });
    expect(read("Faith Kills Allan Finch", "During a fight, Faith accidentally staked Allan Finch.").kind).toBe("history");
    expect(read("Five Months Without Buffy", "Five months passed after Buffy's sacrifice.").kind).toBe("history");
    expect(read("Spike's Crypt", "Spike's crypt is his underground cemetery home.").kind).toBe("place");
    expect(read("Harrenhal - The Five Towers", "Harrenhal's five round black towers were warped by dragonfire.")).toMatchObject({ kind: "place", name: "Harrenhal: The Five Towers", parent: "Harrenhal" });
    expect(read("Harrenhal - Overview", "Harrenhal broods over the Gods Eye, the largest castle in the Seven Kingdoms.")).toMatchObject({ kind: "place", name: "Harrenhal" });
    expect(read("House Velaryon", "House Velaryon is the realm's great naval power.").kind).toBe("group");
    expect(read("Order of Taraka", "The Order of Taraka is an ancient, professional organization of assassins.").kind).toBe("group");
    expect(read("Spike's Initiative Chip", "Spike carries a neural chip implanted by the Initiative.")).toMatchObject({ kind: "object", holder: "Spike" });
  });

  test("seeding: a voice joins its person's card, a relationship links both", () => {
    const person = read("Rhaenyra Targaryen - The Realm's Delight", "Rhaenyra Targaryen is the king's firstborn.", 1);
    const voice = read("Rhaenyra - Speech and Manner", "When Rhaenyra speaks, her rank is rarely far from the surface.", 2);
    const bond = read("Rhaenyra and Rhaegel - Twin Bond", "Rhaenyra and Rhaegel are twins.", 1);
    const ov = seedOverlays([person, voice, bond]);
    expect(ov["char:rhaenyra_targaryen"].body?.voice).toMatch(/rank is rarely far/);
    expect(Object.keys(ov).some((k) => k.startsWith("lore:rhaenyra"))).toBe(false);
    expect(ov["bond:rhaenyra_rhaegel"].links).toEqual([{ rel: "participant", to: "char:rhaenyra" }, { rel: "participant", to: "char:rhaegel" }]);
  });

  test("metadata: Almanac's own, other tools' alike", () => {
    expect(readLoreMeta({ almanac: { lore: { kind: "person", category: "character" } } })?.category).toBe("character");
    expect(readLoreMeta({ vellum3: { kind: "place" } })?.kind).toBe("place");
    const ext = withLoreMeta({ vellum3: { kind: "place" }, other: 1 }, { category: "location", kind: "place", tense: "timeless", participants: [] });
    expect(ext).toEqual({ vellum3: { kind: "place" }, other: 1, almanac: { lore: { category: "location", kind: "place", tense: "timeless" } } });
    const c = classify({ id: "x", world_book_id: "b", comment: "Location: The Five Towers", content: "Black towers.", key: [], extensions: { almanac: { lore: { category: "location", kind: "place", name: "Harrenhal — The Five Towers", parent: "Harrenhal" } } } });
    expect(c).toMatchObject({ kind: "place", via: "metadata", name: "Harrenhal — The Five Towers", parent: "Harrenhal" });
  });

  test("the format guide names every category", () => {
    const g = formatGuide();
    for (const l of ["Timeline Boundary", "Character", "Relationship", "Voice", "CURRENT", "Belief", "Secret", "Faction", "Upcoming", "Item", "Location", "History", "Customs", "Scene", "OOC"]) expect(g).toContain(l);
    expect(g).not.toMatch(/vellum/i);
  });
});

const BOOK: BookEntry[] = [
  { id: "1", comment: "Buffy Summers - The Slayer", content: "Buffy Summers is Sunnydale's Slayer: witty and stubborn.", key: ["Buffy"], priority: 10, order_value: 250, position: 1 },
  { id: "2", comment: "Buffy & Spike - Truce", content: "Buffy and Spike began as enemies.", key: ["Spike"], priority: 10, order_value: 230, position: 1 },
  { id: "3", comment: "109 AC - The First Kiss", content: "In 109 AC, they shared their first kiss.", key: ["kiss"], priority: 10, order_value: 220 },
  { id: "4", comment: "Location: The Bronze", content: "The Bronze is a nightclub in Sunnydale.", key: ["Bronze"], priority: 100, order_value: 100, extensions: { almanac: { lore: { category: "location", kind: "place" } } } },
  { id: "5", comment: "Upcoming: The Trio Strikes", content: "The Trio robs the bank.", key: ["Trio"], priority: 120, order_value: 120 },
  { id: "6", comment: "Harrenhal - The Five Towers", content: "Harrenhal's five round black towers were warped by dragonfire.", key: ["towers"], priority: 10, order_value: 130 },
];

describe("converting a book", () => {
  test("every entry read, retitled, given metadata and a tier", () => {
    const plan = planConversion(BOOK);
    const by = new Map(plan.items.map((i) => [i.entryId, i]));
    expect(by.get("1")).toMatchObject({ op: "convert", category: "character", title: "Character: Buffy Summers (The Slayer)" });
    expect(by.get("1")!.changes).toEqual(["title", "metadata", "priority 10 → 250"]);
    expect(by.get("2")).toMatchObject({ category: "relationship", title: "Relationship: Buffy & Spike (Truce)" });
    expect(by.get("3")).toMatchObject({ category: "history", title: "History: The First Kiss (109 AC)" });
    // Already exact: left alone.
    expect(by.get("4")).toMatchObject({ op: "keep" });
    // A future event told as fact: its opening is offered for a rewrite.
    expect(by.get("5")).toMatchObject({ rewrite: true });
    expect(plan.stats).toMatchObject({ total: 6, exact: 1, convert: 5, lowPriority: 4, rewrites: 1 });
  });

  test("the update keeps the content and reads back exactly", () => {
    const plan = planConversion(BOOK);
    const it = plan.items.find((i) => i.entryId === "6")!;
    expect(it.title).toBe("Location: Harrenhal — The Five Towers");
    const upd = conversionUpdate(BOOK[5], it, plan.items.length ? { titles: "label", tiers: true } : ({} as any))!;
    expect(upd.content).toBeUndefined();
    expect(upd.priority).toBe(130);
    const after = classify({ id: "6", world_book_id: "b", comment: upd.comment, content: BOOK[5].content, key: BOOK[5].key, extensions: upd.extensions });
    expect(after).toMatchObject({ via: "metadata", kind: "place", name: "Harrenhal: The Five Towers", parent: "Harrenhal" });
    // Titles kept: metadata only.
    const keepTitles = conversionUpdate(BOOK[0], plan.items[0], { titles: "keep", tiers: false })!;
    expect(keepTitles.comment).toBeUndefined();
    expect(keepTitles.priority).toBeUndefined();
    expect(keepTitles.extensions.almanac.lore).toMatchObject({ category: "character", kind: "person" });
  });

  test("a player's category change is honoured", () => {
    const plan = planConversion(BOOK);
    const it = { ...plan.items.find((i) => i.entryId === "3")!, category: "customs", title: "Customs: The First Kiss" };
    const upd = conversionUpdate(BOOK[2], it, { titles: "label", tiers: true })!;
    expect(upd.extensions.almanac.lore).toMatchObject({ category: "customs", kind: "texture" });
  });

  test("converted titles", () => {
    const c = read("Rhaenyra - Speech and Manner", "When Rhaenyra speaks, her rank shows.", 2);
    expect(convertedTitle({ id: "v", comment: "Rhaenyra - Speech and Manner", content: "", key: [] }, c, categoryOfLabel("Voice")!)).toBe("Voice: Rhaenyra");
    const t = read("Theme - Chosen Family", "THEME: The Slayer stands with friends.");
    expect(convertedTitle({ id: "t", comment: "Theme - Chosen Family", content: "", key: [] }, t, categoryOfLabel("OOC")!)).toBe("OOC: Chosen Family (Theme)");
  });

  test("the model's index of a book", () => {
    const idx = bookIndex(BOOK);
    expect(idx.ids).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(idx.text.split("\n")[0]).toMatch(/^e1 \| character\? \| Buffy Summers - The Slayer \| keys: Buffy/);
    expect(idx.text.split("\n")[3]).toMatch(/^e4 \| location \| /);
  });
});

describe("the plan and the conversation", () => {
  test("a proposal from the model's reply, and revisions by id", () => {
    const p = makeProposal({ summary: "A Sunnydale book.", bookName: "Sunnydale 2001", items: [
      { op: "create", category: "character", title: "Buffy Summers", about: "the Slayer, just resurrected" },
      { category: "Location", title: "The Bronze" },
      { op: "update", entry: "e2", title: "Relationship: Buffy & Spike", about: "they're allies now" },
      { op: "retire", entry: "e3", title: "History: The First Kiss" },
    ] }, "update", undefined, ["1", "2", "3"])!;
    expect(p.items.map((i) => [i.id, i.op, i.category, i.title, i.entryId])).toEqual([
      ["p1", "create", "character", "Character: Buffy Summers", undefined],
      ["p2", "create", "location", "Location: The Bronze", undefined],
      ["p3", "update", "relationship", "Relationship: Buffy & Spike", "2"],
      ["p4", "retire", "history", "History: The First Kiss", "3"],
    ]);
    expect(p).toMatchObject({ version: 1, target: "same", bookName: "Sunnydale 2001" });
    const r = reviseProposal(p, { drop: ["p2"], change: [{ id: "p1", category: "voice", title: "Buffy" }], add: [{ category: "secret", title: "Heaven", about: "Buffy was in Heaven" }] });
    expect(r.version).toBe(2);
    expect(r.items.map((i) => i.title)).toEqual(["Voice: Buffy", "Relationship: Buffy & Spike", "History: The First Kiss", "Secret: Heaven"]);
    expect(r.items.find((i) => i.title === "Secret: Heaven")?.id).toBe("p5");
    expect(r.dropped?.map((d) => d.id)).toEqual(["p2"]);
    expect(r.items.filter((i) => i.v === 2).map((i) => i.id)).toEqual(["p1", "p5"]);
    expect(proposalText(r)).toMatch(/^Proposal v2 \(/);
  });

  test("replies: JSON, JSON after prose, and plain text", () => {
    expect(parseReply('{"say":"Which canon point?","options":["Season 6","Season 7"],"task":"new"}', extractJson)).toEqual({ say: "Which canon point?", options: ["Season 6", "Season 7"], task: "new" });
    expect(parseReply('Sure! [p1] here:\n```json\n{"say":"Done.","revise":{"drop":["p1"]}}\n```', extractJson)).toMatchObject({ say: "Done.", revise: { drop: ["p1"] } });
    expect(parseReply("I think we should start with the cast.", extractJson)).toEqual({ say: "I think we should start with the cast." });
    expect(parseReply('{"say":"x","task":"bogus"}', extractJson).task).toBeUndefined();
  });

  test("the validator knows each category's opening", () => {
    const rel = validateEntry(normalizeEntry({ comment: "Relationship: Buffy", content: "They fight.", key: ["Buffy", "Spike"] }, 0));
    expect(rel.reask.join(" | ")).toMatch(/name both people/);
    const scene = validateEntry(normalizeEntry({ comment: "Scene: Buffy Learns of Heaven", content: "Buffy cries.", key: ["Heaven", "spell"] }, 0));
    expect(scene.reask.join(" | ")).toMatch(/opens with its trigger/);
    expect(scene.entry.extensions.almanac.lore).toMatchObject({ category: "scene", kind: "playbook", tense: "future" });
    const ok = validateEntry(normalizeEntry({ comment: "Relationship: Buffy & Spike", content: "Buffy and Spike are uneasy allies.", key: ["Buffy", "Spike"] }, 0));
    expect(ok.reask).toEqual([]);
    expect(ok.entry.extensions.almanac.lore.participants).toEqual(["Buffy", "Spike"]);
    // Rewritten from the player's book: their fields stay.
    const kept = validateEntry(normalizeEntry({ comment: "Character: Buffy Summers", content: "Buffy Summers is the Slayer.", key: ["Buffy", "Slayer"], priority: 10, matchWholeWords: false }, 0), { keepFields: true });
    expect(kept.entry).toMatchObject({ priority: 10, matchWholeWords: false });
  });

  test("a Scene entry from any book is a playbook, kept out of keyword activation", () => {
    const e = validateEntry(normalizeEntry({ comment: "Scene: When Buffy Learns of the Spell", content: "When Buffy learns Willow pulled her out of Heaven, she goes quiet.", key: ["spell", "Heaven"] }, 0)).entry;
    const c = classify({ id: "s", world_book_id: "b", comment: e.comment, content: e.content, key: e.key, extensions: e.extensions });
    expect(c).toMatchObject({ kind: "playbook", tense: "future", keys: ["spell", "Heaven"] });
    expect(seedOverlays([c])[Object.keys(seedOverlays([c]))[0]].scope).toEqual({ narratorOnly: true });
  });
});
