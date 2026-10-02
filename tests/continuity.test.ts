// Continuity and detail accuracy (1.11): scripted scenes kept out of history, secrets kept off the
// page, the check of each reply, the ledger lines models actually write, stale detail, fixed looks,
// the player's own facts, and running bits. Fixtures are invented; shapes follow real replays.
import { describe, expect, test } from "bun:test";
import { LedgerRuntime, sideKey, toPath, type RawChatMessage } from "../src/core/branch";
import { injuriesIn, opWordOf, parseLine, parseMessage } from "../src/core/dsl";
import { carried, type FoldOptions } from "../src/core/state";
import { classify, isScene, playbookPlayed, seedOverlays, weaverBook } from "../src/core/lore";
import { buildCodex, emptyCodexStore } from "../src/core/codex";
import { KeyIndex, cleanKeys, DEFAULT_STOP } from "../src/core/keys";
import { recall } from "../src/core/recall";
import { buildLedgerNote } from "../src/core/note";
import { isOffPage, offPageFacts, redact } from "../src/core/offpage";
import { AGREES, checkReply, passageIndex, saidBefore, supported, supportOf } from "../src/core/audit";
import { keepPlayerOp, playerClock, playerOps } from "../src/core/player";
import { hash } from "../src/core/util";
import { traitsFromText, traitsStated } from "../src/core/traits";
import { buildCalendar, dayOfDate, dateFor } from "../src/core/engines/calendar";
import { runningBits } from "../src/core/chronicle";

const OPTS: FoldOptions = { userName: "Wren", strictness: "strict", sealed: true, romance: "fast", playerFacts: "rules" };
const msg = (i: number, content: string, isUser = false): RawChatMessage => ({ id: `m${i}`, index_in_chat: i, is_user: isUser, content, swipes: [content], swipe_id: 0 });
const reply = (i: number, lines: string, prose = "Prose.") => msg(i, `${prose}\n<ledger>\n${lines}\nmode: social\n</ledger>`);
const fold = (msgs: RawChatMessage[], opts: FoldOptions = OPTS) => new LedgerRuntime().fold(toPath(msgs), opts);

describe("ledger lines as models write them", () => {
  test("a meter reached with an arrow, a plus, words or in a list", () => {
    expect(parseLine("body Mara: hunger 4→2 (fed at breakfast); hands steady")!.args.meters.hunger).toEqual({ v: 2, rel: false });
    expect(parseLine("body Mara: fatigue 4+; wine-numbed")!.args.meters.fatigue).toEqual({ v: 4, rel: false });
    expect(parseLine("body Mara: hunger 3 (eating, fed), arousal low, flushed")!.args.meters).toEqual({ hunger: { v: 3, rel: false }, arousal: { v: 1, rel: false } });
    expect(parseLine("body Mara: fatigue +1")!.args.meters.fatigue).toEqual({ v: 1, rel: true });
  });
  test("injuries written in plain words become injuries, not flags", () => {
    const a = parseLine("body Kael: concussion + scalp laceration; conscious")!.args;
    expect(a.injuries.map((i: any) => i.where)).toEqual(["head", "scalp"]);
    expect(a.flags).toEqual(["conscious"]);
    expect(injuriesIn("self-stitched wound closed")[0]).toMatchObject({ where: "wound", treated: true });
    expect(injuriesIn("no longer bleeding")).toEqual([]);
    expect(injuriesIn("wound up tight")).toEqual([]);
    expect(injuriesIn("right hand pressed to binding cloth over his wound")).toEqual([]);
    expect(injuriesIn("blood from his wound on her fingers")).toEqual([]);
    expect(injuriesIn("her own wound reopened")[0]).toMatchObject({ where: "wound" });
    expect(parseLine("body Mara: hunger 4→2 (fed; real food); ears flushed")!.args.meters.hunger).toEqual({ v: 2, rel: false });
  });
  test("bond axes are whole words; an unknown axis is named, not guessed", () => {
    expect(parseLine("bond A>B: self-resentment +2 — she let him think it")!.args).toEqual({ changes: [], unknownAxes: ["self-resentment"] });
    expect(parseLine("bond A>B: comfort +1 (he leaned in) — fear +2")!.args.changes).toEqual([{ axis: "comfort", delta: 1 }]);
    expect(parseLine("bond A>B: +1 — a kind word")!.args.changes).toEqual([{ axis: "affection", delta: 1 }]);
  });
  test("ladder rungs by number, arrow, name, a name opening the cause, or hold", () => {
    const rung = (l: string) => parseLine(`ladder A>B: ${l}`)!.args;
    expect(rung("tier 2 → tier 3 — touched his jaw")).toEqual({ tier: 3, rel: false });
    expect(rung("Charged → Tested (the lie came out)")).toEqual({ tier: 4, named: true });
    expect(rung("tier 2 — Charged — she heard him")).toEqual({ tier: 3, named: true });
    expect(rung("tier 2 — she noticed him")).toEqual({ tier: 2, rel: false });
    expect(rung("tier 3 holding — interrupted")).toEqual({ hold: true });
    expect(rung("Name Said Bare — the trust gate")).toEqual({ unknown: "Name Said Bare" });
  });
  test("trait, appearance and motif lines", () => {
    expect(parseLine("trait Daeron: violet eyes; silver hair cut short; 24")!.args.traits.map((t: any) => t.kind)).toEqual(["eyes", "hair", "age"]);
    expect(parseLine("appearance Mara: green eyes, red hair")!.op).toBe("trait");
    expect(parseLine("motif: the oil joke | Oberyn")!.args).toEqual({ text: "the oil joke", who: "Oberyn" });
    expect(parseLine("secret #where: she was in Heaven | kept by Buffy · from Dawn · never say: Heaven, paradise")!.args.unsaid).toEqual(["Heaven", "paradise"]);
  });
  test("which lines name an op", () => {
    expect(opWordOf("ladder A>B: Consent")).toBe("ladder");
    expect(opWordOf("hunger went up")).toBeUndefined();
  });
});

describe("state keeps what lasts and lets passing detail go", () => {
  test("a new body line replaces passing states; conditions and the scene change", () => {
    const st = fold([reply(0, "cast: Mara@spot\nbody Mara: dripping, on her back, limp in left leg"), reply(1, "body Mara: breathless")]).state;
    expect(st.chars.mara.flags).toEqual(["limp in left leg", "breathless"]);
    const moved = fold([reply(0, "cast: Mara@spot\nat: Inn\nbody Mara: dripping, blind in one eye"), reply(1, "at: Harbour")]).state;
    expect(moved.chars.mara.flags).toEqual(["blind in one eye"]);
  });
  test("one wound, written two ways, is one injury and stays treated", () => {
    const st = fold([reply(0, "cast: Kael@spot\nbody Kael: self-stitched wound closed"), reply(1, "body Kael: stitches loosening")]).state;
    expect(st.chars.kael.injuries).toHaveLength(1);
    expect(st.chars.kael.injuries[0].treated).toBe(true);
  });
  test("hunger written as an arrow brings the meter down", () => {
    const st = fold([reply(0, "cast: Mara@spot\nbody Mara: hunger 4"), reply(1, "body Mara: hunger 4→1 (ate)")]).state;
    expect(st.chars.mara.meters.hunger).toBe(1);
  });
  test("a line saying nothing changed is not reported", () => {
    expect(fold([reply(0, "cast: Mara@spot\nwx: unchanged")]).state.lastDelta!.rejected).toEqual([]);
  });
  test("a line naming an op the Almanac can't read is reported", () => {
    const { state } = fold([reply(0, "cast: Mara@spot\nladder Mara>Wren: +1 — a look\nladder Mara>Wren: Name Said Bare — the gate")]);
    expect(state.lastDelta!.rejected.some((r) => /no rung called/.test(r.reason))).toBe(true);
  });
  test("a ladder line with no digit (a rung name) still moves the ladder", () => {
    const st = fold([reply(0, "cast: Mara@spot\nladder Mara>Wren: 3 Charged — the dance"), reply(1, "ladder Mara>Wren: Charged → Tested — the lie came out")]).state;
    expect(Object.values(st.ladders)[0].tier).toBe(4);
  });
  test("parts of a room are not items; an item worn comes to its wearer", () => {
    const st = fold([reply(0, "cast: Mara@spot\nat: Market › Cobbler\nitem Fridge: → kitchen — empty\nitem Boots: → Cobbler — on the shelf"), reply(1, "look Mara: new boots, grey coat")]).state;
    expect(st.items["item:fridge"]).toBeUndefined();
    expect(st.items["item:boots"].holder).toBe("mara");
  });
  test("an item on someone is with them", () => {
    const st = fold([reply(0, "cast: Mara@spot · Kael@spot\nitem Jacket: → on Mara, Kael gripping it — lent")]).state;
    expect(st.items["item:jacket"].holder).toBe("mara");
  });
});

describe("fixed looks", () => {
  test("read from prose, skipping someone else's", () => {
    expect(traitsFromText("Buffy, twenty, with bright green eyes and blonde hair.", ["Buffy"])).toEqual([{ kind: "eyes", text: "bright green eyes" }, { kind: "hair", text: "blonde hair" }]);
    expect(traitsFromText("She loves Gabriel's blue eyes. Her own are green eyes.", ["Buffy"])[0]).toEqual({ kind: "eyes", text: "green eyes" });
  });
  test("the player's word holds over the story's", () => {
    const { state, events } = fold([reply(0, "cast: Daeron@spot"), msg(1, "((Daeron has violet eyes.))", true), reply(2, "trait Daeron: grey eyes; tall")]);
    expect(state.chars.daeron.traits!.find((t) => t.kind === "eyes")!.text).toBe("violet eyes");
    expect(state.chars.daeron.traits!.some((t) => t.kind === "height")).toBe(true);
    expect(events.some((e) => e.verdict === "warned" && /player set violet eyes/.test(e.reason ?? ""))).toBe(true);
  });
  test("the note sends them every turn, with age and the appearance set on the Cast page", () => {
    const st = fold([reply(0, "cast: Daeron@spot\ntrait Daeron: violet eyes; silver hair")], { ...OPTS, castEdits: { daeron: { age: "24" } } }).state;
    const note = buildLedgerNote({ state: st, almanac: null, records: [], userName: "Wren", sealed: true, query: "" }).text;
    expect(note).toContain("always: 24 years old, violet eyes, silver hair");
  });
  test("stated by the player about named people", () => {
    expect(traitsStated("Daeron has violet eyes and Cersei has green eyes.", ["Daeron", "Cersei"]).map((t) => `${t.who}:${t.text}`)).toEqual(["Daeron:violet eyes", "Cersei:green eyes"]);
    // How they look this minute isn't their eyes or hair.
    expect(traitsStated(`Dawn's eyes are wide. "This is too much." Dawn's hair is damp from the pool and the shower.`, ["Dawn"])).toEqual([]);
    expect(traitsStated("Dawn's eyes are blue-green. Dawn's hair is long and brown.", ["Dawn"]).map((t) => t.text)).toEqual(["blue-green eyes", "long and brown hair"]);
  });
  test("the player's own line replaces it; what the appearance says isn't said twice", () => {
    const st = fold([reply(0, "cast: Daeron@spot\ntrait Daeron: violet eyes; silver hair")], { ...OPTS, castEdits: { daeron: { always: "violet eyes, a scar through one brow" } } }).state;
    expect(buildLedgerNote({ state: st, almanac: null, records: [], userName: "Wren", sealed: true, query: "" }).text).toContain("always: violet eyes, a scar through one brow)");
    const st2 = fold([reply(0, "cast: Daeron@spot\ntrait Daeron: violet eyes; silver hair")], { ...OPTS, castEdits: { daeron: { appearance: "violet eyes, tall" } } }).state;
    expect(buildLedgerNote({ state: st2, almanac: null, records: [], userName: "Wren", sealed: true, query: "" }).text).toContain("always: violet eyes, tall, silver hair");
  });
  test("holding is this scene's: what came to hand now, and what's worn or pocketed; owning isn't holding", () => {
    const { state } = fold([
      reply(0, "clock: Day 1 09:00\ncast: Mara@spot\nitem Espresso machine: → Mara (counter)\nitem Ring: → Mara (finger)\nitem Locket: → Mara (pocket)"),
      reply(1, "clock: Day 1 13:00\ncast: Mara@spot\nitem Lantern: → Mara (hand)"),
    ]);
    expect(state.sceneStartMsg).toBe(1);
    expect(carried(state, "mara").map((i) => i.name).sort()).toEqual(["Lantern", "Locket", "Ring"]);
  });
  test("aliases: only names, never a phrase or a list; the player can take one away or give one", () => {
    const lines = "cast: Buffy Summers@spot · Dawn@spot\nitem Wardrobes (×2): Buffy and Dawn, full, from mall clothing stores\nmood Buffy (asleep): calm";
    expect(fold([reply(0, lines)]).state.chars.buffy_summers.aliases).toEqual(["Buffy"]);
    const st = fold([reply(0, lines)], { ...OPTS, castEdits: { buffy_summers: { dropAliases: ["Buffy"], addAliases: ["the Slayer"] } } }).state;
    expect(st.chars.buffy_summers.aliases).toEqual(["the Slayer"]);
  });
});

describe("the player's own facts", () => {
  test("a day said outright moves the clock, even backwards", () => {
    const { state } = fold([reply(0, "clock: Day 13 09:00"), msg(1, "THIS IS DAY 12 - FIRST MOON 27", true)]);
    expect(state.time).toEqual({ day: 12, minute: 9 * 60 });
  });
  test("a story's 'day 12 of her captivity' is not a date", () => {
    expect(playerClock("On day 12 of her captivity she sang.", { names: [], day: 3 })).toBeNull();
  });
  test("a calendar date names the nearest story day", () => {
    const cal = buildCalendar({ calendar: "Westeros", startPoint: "1st day of the Second Moon, 115 AC" });
    const d = dayOfDate(cal, "Second Moon 7", 3)!;
    expect(dateFor(cal, d).dayOfMonth).toBe(7);
    expect(d).toBe(7);
  });
  test("a time said in the prose sets the clock", () => {
    const { state } = fold([reply(0, "clock: Day 4 14:05"), msg(1, "When they're finally done, it's 15:15. Dawn is in the living room.", true)]);
    expect(state.time).toEqual({ day: 4, minute: 15 * 60 + 15 });
    expect(playerClock("It's now 3:15 p.m. and raining.", { names: [], day: 2 })!.args).toMatchObject({ minute: 15 * 60 + 15 });
    expect(playerClock("Dawn rolls her eyes. \"Dude. It's 1111.\"", { names: [], day: 2 })).toBeNull();
  });
  test("a time a little behind the clock corrects it, same day", () => {
    const { state } = fold([reply(0, "clock: Day 4 16:00"), msg(1, "((it's 15:15))", true)]);
    expect(state.time).toEqual({ day: 4, minute: 15 * 60 + 15 });
  });
  test("the next day with a stated time keeps both", () => {
    expect(playerClock("The next day. Daeron sits in his study. It is now 7:45 and he waits.", { names: [], day: 4 })!.args).toMatchObject({ day: 5, minute: 7 * 60 + 45 });
  });
  test("the next morning, in an aside", () => {
    expect(playerClock("((The next morning.)) She wakes.", { names: [], day: 4 })!.args).toMatchObject({ day: 5, minute: 480 });
  });
  test("the reader's lines stand only as far as the message bears them out", () => {
    const line = (l: string) => parseLine(l)!;
    const m259 = `He nods, grinning. "Yup. That's my daughter right there." He pours kibble into Ruth's bowl.`;
    expect(keepPlayerOp(line("trait Ruth: is Xander's daughter"), m259)).toBeNull();
    expect(keepPlayerOp(line("trait Ruth: has her own food bowl (kept where) — player-stated, suggests a pet"), m259)).toBeNull();
    const m299 = `"Yeah, she got scholarships. She's the one who insisted I should get a job." "And Buffy - she knows you're my girlfriend already."`;
    expect(keepPlayerOp(line("trait Buffy (Gabriel's sister): got scholarships; insisted Gabriel get a job"), m299)).toBeNull();
    expect(keepPlayerOp(line("trait Buffy: most beautiful person Gabriel has ever seen — per Gabriel"), "Buffy, you're the most beautiful person I've ever seen.")).toBeNull();
    expect(keepPlayerOp(line("trait Dawn: recognizes Buffy and Ruth as a pair"), "Dawn looks at Buffy and Ruth.")).toBeNull();
    // Items: a holder is said, whose it is matches the message, and the player's own names always count.
    const m205 = `"My mom goes to a therapist. The therapist - she's a witch." He looks at Buffy. "I can ask my mom, if you want."`;
    expect(keepPlayerOp(line("item Buffy's mom's therapist's contact: → Gabriel (via his mom) — the player said"), m205, ["Gabriel Winters"])).toBeNull();
    expect(keepPlayerOp(line("item pool: large with jacuzzi, dedicated bathroom"), "The pool is large, with a jacuzzi.")).toBeNull();
    expect(keepPlayerOp(line("item espresso machine: → Gabriel Winters (cabinet)"), "He takes out an espresso machine from the cabinet.", ["Gabriel Winters"])).not.toBeNull();
    // A plain fact the message states stands.
    expect(keepPlayerOp(line("trait Eleanor: warm and kind voice; loves shopping"), `Eleanor's voice comes out from the phone - warm and kind. "She really loves shopping."`)!.args.traits).toHaveLength(2);
    // The fold drops a bad line filed before the check, and keeps the rest of the entry.
    const side = { [sideKey("m1", 0)]: [{ source: "user" as const, player: true, ops: [line("trait Ruth: is Xander's daughter"), line("trait Ruth: orange tabby")], hash: hash("Ruth, the orange tabby, yowls.") }] };
    const st = new LedgerRuntime().fold([{ id: "m0", index: 0, isUser: false, content: "<ledger>\ncast: Ruth@spot\n</ledger>", swipe: 0 }, { id: "m1", index: 1, isUser: true, content: "Ruth, the orange tabby, yowls.", swipe: 0 }], { ...OPTS, playerFacts: "model" }, side).state;
    expect(st.chars.ruth.traits?.map((t) => t.text)).toEqual(["orange tabby"]);
  });
  test("pinned truths and running bits from an aside", () => {
    const ops = playerOps("((truth: Jaime and Cersei are strictly family)) ((bit: the oil joke))", { names: [], day: 1 });
    expect(ops.map((o) => o.op)).toEqual(["canon", "motif"]);
    const st = fold([reply(0, "cast: Mara@spot"), msg(1, "((truth: Jaime and Cersei are strictly family))", true)]).state;
    const note = buildLedgerNote({ state: st, almanac: null, records: [], userName: "Wren", sealed: true, query: "", truths: ["Rhaegar wears a wig"] }).text;
    expect(note).toContain("[TRUTHS] Rhaegar wears a wig · Jaime and Cersei are strictly family");
  });
});

describe("secrets kept off the page", () => {
  const secret = [reply(0, "cast: Buffy@spot · Dawn@spot\nsecret #where-she-was: Buffy was in Heaven | kept by Buffy · from Dawn · never say: Heaven")];
  test("the model's never-say words keep it off the page until it comes out", () => {
    const st = fold(secret).state;
    expect(isOffPage(st.facts!["where-she-was"], true)).toBe(true);
    expect(isOffPage(st.facts!["where-she-was"], false)).toBe(false);
    const note = buildLedgerNote({ state: st, almanac: null, records: [], userName: "Wren", sealed: true, query: "" }).text;
    expect(note).toContain('[OFF THE PAGE] #where-she-was (Buffy\'s secret): not on the page yet');
    const out = fold([...secret, reply(1, 'reveal #where-she-was: Buffy was in Heaven | Buffy, aloud')]).state;
    expect(isOffPage(out.facts!["where-she-was"], true)).toBe(false);
  });
  test("the player sets words and a wording; summaries are reworded", () => {
    const st = fold(secret, { ...OPTS, factEdits: { "where-she-was": { offPage: { words: ["Heaven"], wording: "somewhere warm and finished" } } } }).state;
    const list = offPageFacts(st, false);
    expect(redact("She almost said Heaven, and it burned.", list)).toBe("She almost said somewhere warm and finished, and it burned.");
  });
  test("the check flags the word on the page, but not when the player said it first", () => {
    const before = fold(secret).state;
    const text = "She was in Heaven while the fridge sat empty.\n<ledger>\nmode: social\n</ledger>";
    const base = { reply: text, parsed: parseMessage(text), before, after: before, events: [], offPage: offPageFacts(before, true), userName: "Wren" };
    expect(checkReply({ ...base, player: "Where were you?" }).map((i) => i.kind)).toContain("offpage");
    expect(checkReply({ ...base, player: "Were you in Heaven?" }).map((i) => i.kind)).not.toContain("offpage");
  });
});

describe("the check of a reply", () => {
  test("the dead speaking, a planning block, looks contradicted, a secret in the wrong mouth", () => {
    const before = fold([
      reply(0, "cast: Mara@spot · Kael@spot · Joss@spot\ntrait Kael: violet eyes\nsecret #cargo: the cargo was never Vance's | kept by Mara · from Joss"),
      reply(1, "cast: Mara@dead"),
    ]).state;
    const text = `<weaver_deliberation>BEAT: …</weaver_deliberation>\n[spk=Mara#1]"I'm back."[/spk] Kael's grey eyes narrowed. [spk=Joss#3]"The cargo was never Vance's, was it?"[/spk]\n<ledger>\nmode: social\n</ledger>`;
    const kinds = checkReply({ reply: text, parsed: parseMessage(text), before, after: before, events: [], offPage: [], player: "", userName: "Wren" }).map((i) => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(["dead", "planning", "trait", "leak"]));
  });
});

describe("playbooks: scripted scenes are not history", () => {
  const book = weaverBook({ name: "Buffy Summers depth book", metadata: { source: "weaver", weaver_role: "depth" } })!;
  const scene = { id: "e1", world_book_id: "b1", comment: "The Word 'Heaven' Said Aloud — In Gabriel's Kitchen", content: "It happens in the kitchen, late, over something absurd. 'I was in Heaven, Gabriel.' She goes very still.", key: ["Heaven", "kitchen", "Ruth"] };
  test("scene-shaped depth entries are playbooks; persona backstory is not", () => {
    expect(classify(scene, book).kind).toBe("playbook");
    expect(isScene("Seeing Gabriel Take a Hit", "If Buffy sees Gabriel take a hit, she feels fear.")).toBe(true);
    expect(isScene("The wound: Maria", "He was raised mostly by his nanny Maria.", "persona")).toBe(false);
    expect(isScene("Rhaenyra's Performed Desire", "Rhaenyra forces herself to be attracted to Daemon.")).toBe(false);
    const huddle = { id: "e2", world_book_id: "b1", comment: "Dawn's Questions: The Half-Truth and the Huddle", content: "Dawn's questions hit differently. So Buffy says 'It wasn't Hell' and stops there.", key: ["huddle"] };
    expect(classify(huddle, book).kind).toBe("playbook");
  });
  const setup = () => {
    const st = fold([reply(0, "cast: Buffy@spot · Ruth@peri")]).state;
    const store = emptyCodexStore();
    Object.assign(store.overlays, seedOverlays([classify(scene, book)]));
    const records = buildCodex(st, store);
    const castNames = Object.values(st.chars).map((c) => c.name);
    for (const r of records) r.keys = cleanKeys(r.keys, { name: r.name, aliases: r.aliases, castNames, stop: new Set(DEFAULT_STOP), max: 12 });
    return { st, records, index: new KeyIndex(records) };
  };
  const ask = (playerMsg: string, extra: Partial<Parameters<typeof recall>[0]> = {}) => {
    const { st, records, index } = setup();
    return recall({ state: st, records, index, playerMsg, lastReply: "", recent: [], tier: "routine", budget: 2000, allowNarratorOnly: true, userName: "Wren", ...extra });
  };
  test("not sent for one everyday word; sent framed as not history when the scene is near", () => {
    expect(ask("She fed Ruth in the kitchen.").items.some((i) => i.record.kind === "playbook")).toBe(false);
    const r = ask("In the kitchen she wonders about Heaven.");
    const pb = r.items.find((i) => i.record.kind === "playbook");
    expect(pb?.text).toContain("[Playbook, not history]");
  });
  test("never when it would spoil a secret the player hasn't named", () => {
    const off = [{ key: "where", statement: "Buffy was in Heaven", words: ["Heaven"], keepers: ["buffy"], by: "auto" as const }];
    expect(ask("In the kitchen she wonders about heaven.", { offPage: off, playerMsg: "In the kitchen she stares at the soup." }).items.some((i) => i.record.kind === "playbook")).toBe(false);
  });
  test("retired once a chapter shows it happened", () => {
    expect(playbookPlayed({ name: scene.comment, keys: ["heaven", "kitchen"] }, "In Gabriel's kitchen Buffy said aloud that she had been in Heaven.")).toBe(true);
    expect(playbookPlayed({ name: scene.comment, keys: ["heaven", "kitchen"] }, "Gabriel made soup in the kitchen.")).toBe(false);
  });
});

describe("stale archivist notes", () => {
  test("an old situational note is left out; lasting traits stay; live fields win", () => {
    const st = fold([reply(0, "cast: Dawn@spot\nlook Dawn: new sweater")]).state;
    const store = emptyCodexStore();
    store.overlays["char:dawn"] = { id: "char:dawn", summary: "Dawn sleeps in the next guest room.", body: { role: "Buffy's sister", routine: "asleep in next guest room", look: "Gabriel's jacket", notes: "saw it all" }, provenance: { source: "archivist" } };
    const dawn = buildCodex(st, store).find((r) => r.id === "char:dawn")!;
    expect(dawn.body.archivist).toBeUndefined();
    expect(dawn.body.role).toBe("Buffy's sister");
    expect(dawn.body.routine).toBeUndefined();
    expect(dawn.body.notes).toBeUndefined();
    expect(dawn.body.look).toBe("new sweater");
  });
});

describe("running bits and the romance line", () => {
  test("a summary's running bits are kept", () => {
    expect(runningBits("What happened: …\nRunning bits: \"Gabe-o\" (Gabriel) · alrighty-lefty · Ruth's operatic yowling\n")).toEqual(['"Gabe-o" (Gabriel)', "alrighty-lefty", "Ruth's operatic yowling"]);
    expect(runningBits("Running bits: none")).toEqual([]);
  });
  test("the note offers bits not used lately, and rungs by number", () => {
    const msgs = [reply(0, "cast: Mara@spot\nmotif: thieves don't give things back | Mara\nladder Mara>Wren: 3 Charged — the dance")];
    for (let i = 1; i < 9; i++) msgs.push(msg(i, "…", i % 2 === 1));
    const st = fold(msgs).state;
    const note = buildLedgerNote({ state: st, almanac: null, records: [], userName: "Wren", sealed: true, query: "" }).text;
    expect(note).toContain("[CALLBACKS]");
    expect(note).toContain("thieves don't give things back (Mara)");
    // The fast pace allows two rungs a step: 0 → 2.
    expect(note).toContain("Interested (2/7)");
  });
});

describe("wounds that were treated say so", () => {
  const wounds = (msgs: RawChatMessage[], who = "mara") => fold(msgs).state.chars[who].injuries.map((i) => `${i.where}:${i.severity}:${i.treated ? "treated" : "untreated"}`);
  const hurt = reply(0, "cast: Mara@spot · Kael@peri\nbody Mara: feet cut on broken glass; fatigue 5");

  test("a cut on broken glass is a wound, not a broken bone, and starts untreated", () => {
    expect(wounds([hurt])).toEqual(["feet:2:untreated"]);
  });
  test("a later body line that bandages the part treats the wound, however the part is named", () => {
    expect(wounds([hurt, reply(1, "body Mara: right foot bandaged (glass removed); fatigue 5")])).toEqual(["feet:2:treated"]);
    expect(wounds([hurt, reply(1, "body Mara: right foot — glass removed, bandaged, throbbing dull")])).toEqual(["feet:2:treated"]);
  });
  test("care in a look or a cast note counts, in whatever order the lines come", () => {
    expect(wounds([hurt, reply(1, "look Mara: torn dress, barefoot (bandaged)")])).toEqual(["feet:2:treated"]);
    expect(wounds([reply(0, "cast: Mara@spot(on the floor, Kael treating) · Kael@spot\nbody Mara: concussion + scalp laceration, conscious")])).toEqual(["head:2:treated"]);
    expect(wounds([hurt, reply(1, "cast: Mara@spot(sofa) · Kael@spot(kneeling, bandaging Mara's feet)")])).toEqual(["feet:2:treated"]);
  });
  test("untreated, someone else's bandage and care still needed are not care", () => {
    expect(wounds([hurt, reply(1, "body Mara: glass in right arch (untreated); feet cut")])).toEqual(["feet:2:untreated"]);
    expect(wounds([hurt, reply(1, "body Mara: hand on Kael's bandage; needs stitches")])).toEqual(["feet:2:untreated"]);
    expect(parseLine("body Kael: injury: left arm, serious, untreated")!.args.injuries[0].treated).toBe(false);
  });
  test("a word on the wound without a place is the wound they have, not a new one", () => {
    expect(wounds([hurt, reply(1, "body Mara: wound stable; watchful")])).toEqual(["feet:2:untreated"]);
    expect(wounds([hurt, reply(1, "body Mara: feet clean + medicated (cuts still raw but treated)")])).toEqual(["feet:2:treated"]);
  });
  test("a part that is someone else's is not where the wound is", () => {
    expect(injuriesIn("bruises fading under his mouth")[0].where).toBe("bruise");
    expect(injuriesIn("hands cleaned (wounded but clean)")[0]).toMatchObject({ where: "hands", treated: true });
  });
});

describe("the reply check looks a claim up before calling it invented", () => {
  const index = passageIndex([
    { from: "persona", text: "Spanish (fluent, learned from his nanny Maria). - **Maria** left because she died. - **Amaya**, his best friend and first love, left the relationship at twenty when she came out as a lesbian." },
    { from: "#127", text: `"I'm not going anywhere, Buffy," he says, smiling. "In fact, historically, it's been people leaving me and me staying. I'm a stayer. So."` },
    { from: "#220", text: "She is lying in a blue room in pink pajama pants with the top on the floor. The rain keeps on." },
  ]);
  test("a line said fifty turns back, whatever the framing around it", () => {
    expect(saidBefore("He told her this on the first night — historically, it's been people leaving me and me staying", index)?.from).toBe("#127");
  });
  test("a detail the story wrote, and the persona's history", () => {
    expect(supported(supportOf("pink pajamas", index)[0])).toBe(true);
    expect(supported(supportOf("Maria died", index)[0])).toBe(true);
    expect(supported(supportOf("His first love came out and left", index)[0])).toBe(true);
  });
  test("what nobody said stays flagged", () => {
    expect(supported(supportOf("the bruise on his cheekbone", index)[0])).toBe(false);
    expect(saidBefore("the bruise on her ribs from the coffin lid", index)).toBeNull();
  });
  test("a 'flag' that admits the record agrees is dropped", () => {
    expect(AGREES.test("Consistent with the record — Ruth is on Gabriel's chest. No contradiction.")).toBe(true);
    expect(AGREES.test("the record describes Buffy's clothing as a sage shirt and jeans")).toBe(false);
  });
});

describe("what someone wears", () => {
  const she = '[spk=Mara#1]"Fine."[/spk] she says. [spk=Mara#1]"Go."[/spk] she snaps.';
  const he = '[spk=Kael#2]"Later."[/spk] he says. [spk=Kael#2]"Now."[/spk] he mutters.';
  const start = reply(0, "clock: day 3 19:00\ncast: Mara@spot · Kael@spot\nlook Mara: grey coat\nlook Kael: black shirt", `${she} ${he}`);
  const lookOf = (st: any, name: string) => Object.values(st.chars).find((c: any) => c.name === name) as any;
  test("two looks on one line go to two people", () => {
    const ops = parseMessage("<ledger>\nlook Mara: green pajamas, damp hair · look Kael: blue pajamas\n</ledger>").ops;
    expect(ops.map((o) => [o.subject, o.args.text])).toEqual([["Mara", "green pajamas, damp hair"], ["Kael", "blue pajamas"]]);
    expect(parseMessage("<ledger>\nlook Mara: coat · body language: tense\n</ledger>").ops).toHaveLength(1);
  });
  test("the player's 'she's wearing' wins over the reply that answers it", () => {
    const st = fold([start, msg(1, "He's wearing green pajamas. She's wearing blue pajamas.", true), reply(2, "look Mara: green pajamas (Kael's)\nlook Kael: blue pajamas")]).state;
    expect(lookOf(st, "Mara").look).toBe("blue pajamas");
    expect(lookOf(st, "Kael").look).toBe("green pajamas");
    // A later reply may change it again.
    expect(lookOf(fold([start, msg(1, "She's wearing blue pajamas.", true), reply(2, "clock: +5m"), reply(3, "look Mara: robe")]).state, "Mara").look).toBe("robe");
  });
  test("'puts on' adds; a pronoun two people fit is left alone", () => {
    expect(lookOf(fold([start, msg(1, "He puts on *glasses*.", true)]).state, "Kael").look).toBe("black shirt, glasses");
    const two = reply(0, "clock: day 3 19:00\ncast: Mara@spot · Dawn@spot\nlook Mara: grey coat", `${she} [spk=Dawn#3]"Hi."[/spk] she says. [spk=Dawn#3]"Bye."[/spk] she says.`);
    expect(lookOf(fold([two, msg(1, "She's wearing a red dress.", true)]).state, "Mara").look).toBe("grey coat");
  });
  test("damp hair dries and a pose passes as the clock moves", () => {
    const st = fold([start, reply(1, "look Mara: blue pajamas, damp hair, sitting on the bed"), reply(2, "clock: +40m")]).state;
    expect(lookOf(st, "Mara").look).toBe("blue pajamas, damp hair");
    expect(lookOf(fold([start, reply(1, "look Mara: blue pajamas, damp hair, barefoot"), reply(2, "clock: 07:00")]).state, "Mara").look).toBe("blue pajamas, barefoot");
  });
});
