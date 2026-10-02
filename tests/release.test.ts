// Release fixes (1.13): the parser cases models write, ladders that agree with themselves, speech
// in other quote styles, corrections and off-screen events that survive a swipe, repairs that stop
// applying after an edit, language in background prompts, and the small helpers they rely on.
import { describe, expect, test } from "bun:test";
import { anchorKey, LedgerRuntime, sideKey, toPath, type RawChatMessage, type SideEventStore } from "../src/core/branch";
import { parseLine, parseSpeech } from "../src/core/dsl";
import type { FoldOptions } from "../src/core/state";
import { buildLedgerNote } from "../src/core/note";
import { isSchedule } from "../src/core/codex";
import { summaryPrompt, archivistPrompt } from "../src/core/prompts";
import { clerkPrompt } from "../src/core/clerk";
import { olderThan, PRESET_VERSION, VERSION } from "../src/core/version";
import { fastHash, hash, plainProse } from "../src/core/util";
import { emptyState } from "../src/core/state";

const OPTS: FoldOptions = { userName: "Wren", strictness: "strict", sealed: true, romance: "fast", playerFacts: "rules" };
const msg = (i: number, content: string, isUser = false): RawChatMessage => ({ id: `m${i}`, index_in_chat: i, is_user: isUser, content, swipes: [content], swipe_id: 0 });
const reply = (i: number, lines: string, prose = "Prose.") => msg(i, `${prose}\n<ledger>\n${lines}\nmode: social\n</ledger>`);
const fold = (msgs: RawChatMessage[], opts: FoldOptions = OPTS, side: SideEventStore = {}) => new LedgerRuntime().fold(toPath(msgs), opts, side);

describe("thread verbs", () => {
  test("closed resolves, bridged bridges, opened opens with its detail", () => {
    expect(parseLine("thread Locket: closed — found it")!.args).toMatchObject({ op: "resolve", detail: "found it" });
    expect(parseLine("thread Locket: bridged — via Joss")!.args).toMatchObject({ op: "bridge", detail: "via Joss" });
    expect(parseLine("thread Locket: opened — a new lead")!.args).toMatchObject({ op: "new", detail: "a new lead" });
    expect(parseLine("thread Locket: closes")!.args.op).toBe("resolve");
    expect(parseLine("thread Locket: stalled (no witness)")!.args).toMatchObject({ op: "stall", blocker: "no witness" });
  });
  test("a closed thread is no longer open in the state", () => {
    const st = fold([reply(0, "thread Locket: new — lost"), reply(1, "thread Locket: closed — found it")]).state;
    expect(Object.values(st.threads)[0].status).toBe("resolved");
  });
});

describe("what models write, read within range", () => {
  test("VAD outside the documented ranges is clamped", () => {
    expect(parseLine("mood Dawn: quiet-gleeful | V-3 A7 D-1")!.args).toMatchObject({ v: -3, a: 5, d: -1 });
    expect(parseLine("mood Dawn: furious (V-5 A9 D4)")!.args).toMatchObject({ v: -3, a: 5, d: 3 });
  });
  test("a bracketed quantity is a quantity, not part of the name", () => {
    expect(parseLine("item Candles (×2): → Mara")).toMatchObject({ subject: "Candles", args: { quantity: 2 } });
    expect(parseLine("item Candles x3: → Mara")).toMatchObject({ subject: "Candles", args: { quantity: 3 } });
  });
  test("a restated flag is one flag", () => {
    const st = fold([reply(0, "cast: Dawn@spot\nbody Dawn: malnourished; tired"), reply(1, "body Dawn: malnourished (unchanged), tired")]).state;
    const dawn = Object.values(st.chars).find((c) => c.name === "Dawn")!;
    expect(dawn.flags.filter((f) => f.startsWith("malnourished"))).toEqual(["malnourished"]);
  });
});

describe("ladders that agree with themselves", () => {
  const story = (second: string) => [reply(0, "cast: Buffy@spot · Kael@spot"), reply(1, "ladder Buffy>Kael: 3 Charged — she kissed him"), reply(2, "ladder Buffy>Kael: +1 — tested"), reply(3, second)];
  test("a new direction starts where the other one stands, not at Strangers", () => {
    const st = fold(story(`ladder Kael>Buffy: 5 Spoken — "I love you" said back`)).state;
    expect(st.ladders["kael>buffy"].tier).toBe(5);
  });
  test("a new direction may sit lower than the other: asymmetry is not a fall", () => {
    const r = fold(story("ladder Kael>Buffy: 2 Interested — he's only starting to notice"));
    expect(r.state.ladders["kael>buffy"].tier).toBe(2);
    expect(r.events.filter((e) => e.op.op === "ladder" && e.verdict === "rejected")).toEqual([]);
  });
  test("a sealed persona's side stays out of the note", () => {
    const st = fold([reply(0, "cast: Mara@spot · Wren@spot"), reply(1, "ladder Mara>Wren: 3 Charged — close")], { ...OPTS, sealed: false }).state;
    st.ladders["user>mara"] = { from: "user", to: "mara", tier: 2, at: null, msgIndex: 1, history: [] } as any;
    const sealed = buildLedgerNote({ state: st, almanac: null, records: [], userName: "Wren", sealed: true, query: "" }).text;
    expect(sealed).toContain("Mara → Wren");
    expect(sealed).not.toContain("Wren → Mara");
    const open = buildLedgerNote({ state: st, almanac: null, records: [], userName: "Wren", sealed: false, query: "" }).text;
    expect(open).toContain("Wren → Mara");
  });
});

describe("speech in other quote styles", () => {
  test("British single quotes, when the reply has no double quotes", () => {
    const lines = parseSpeech("Mara looked up. 'You came back,' she said. The dogs' bowls were empty. 'Sit.'");
    expect(lines.map((l) => l.text)).toEqual(["You came back,", "Sit."]);
  });
  test("apostrophes are never speech", () => {
    expect(parseSpeech("It's late and the cats' toys are everywhere; Kael's coat hangs by the door.")).toEqual([]);
  });
  test("guillemets, German and CJK quotes", () => {
    expect(parseSpeech("Elle dit : « Reste ici. »").map((l) => l.text)).toEqual(["Reste ici."]);
    expect(parseSpeech("Er sagte: „Bleib hier.“").map((l) => l.text)).toEqual(["Bleib hier."]);
    expect(parseSpeech("彼女は「ここにいて」と言った。").map((l) => l.text)).toEqual(["ここにいて"]);
  });
  test("double quotes still win when both appear", () => {
    expect(parseSpeech(`"Go," she said, and the 'safe' house waited.`).map((l) => l.text)).toEqual(["Go,"]);
  });
});

describe("events that survive a swipe", () => {
  const base = [reply(0, "cast: Mara@spot\nitem Locket: → Mara — found"), msg(1, "I ask for it.", true), reply(2, "item Locket: Mara → Kael — handed over")];
  test("a correction anchored to the position holds on another swipe of that reply", () => {
    const side: SideEventStore = { [anchorKey(2)]: [{ source: "user", ops: [parseLine("item Locket: Kael → Mara — she kept it")!], id: "fix1", at: 1 }] };
    const first = fold(base, OPTS, side).state;
    expect(first.items["item:locket"].holder).toBe("mara");
    const swiped = [...base.slice(0, 2), { ...reply(2, "item Locket: Mara → Joss — tossed it"), swipes: ["a", "b"], swipe_id: 1 }];
    swiped[2].swipes = [base[2].content!, swiped[2].content!];
    const second = fold(swiped, OPTS, side).state;
    expect(second.items["item:locket"].holder).toBe("mara");
  });
  test("a swipe-keyed event still vanishes with its swipe (the old behaviour for model lines)", () => {
    const side: SideEventStore = { [sideKey("m2", 0)]: [{ source: "user", ops: [parseLine("item Locket: Kael → Mara — kept")!] }] };
    const swiped = [...base.slice(0, 2), { ...msg(2, "x"), content: "", swipes: [base[2].content!, "Prose.\n<ledger>\nitem Locket: Mara → Joss — tossed\nmode: social\n</ledger>"], swipe_id: 1 }];
    expect(fold(swiped, OPTS, side).state.items["item:locket"].holder).toBe("joss");
  });
  test("an anchored event changes the fold's chain, so cached snapshots don't hide it", () => {
    const rt = new LedgerRuntime();
    const path = toPath(base);
    const a = rt.fold(path, OPTS, {});
    const b = rt.fold(path, OPTS, { [anchorKey(2)]: [{ source: "user", ops: [parseLine("item Locket: Kael → Mara — kept")!], id: "x" }] });
    expect(a.chain.at(-1)).not.toBe(b.chain.at(-1));
    expect(b.state.items["item:locket"].holder).toBe("mara");
  });
});

describe("repairs follow the text they were written for", () => {
  test("a repair stops standing in for the ledger once the reply is edited", () => {
    const bare = msg(0, "Mara walks into the Flagon.");
    const side: SideEventStore = { [sideKey("m0", 0)]: [{ source: "repair", ops: [parseLine("at: Town › Flagon")!], replaces: true, hash: hash(bare.content!) }] };
    expect(fold([bare], OPTS, side).state.place).toEqual(["Town", "Flagon"]);
    const edited = { ...bare, content: "Mara walks into the market.\n<ledger>\nat: Town › Market\nmode: social\n</ledger>", swipes: undefined };
    expect(fold([edited], OPTS, side).state.place).toEqual(["Town", "Market"]);
  });
});

describe("background prompts are English", () => {
  test("no language rule in summaries, the archivist or the clerk", () => {
    const p = summaryPrompt("chapter", { userName: "Wren", transcript: "…" });
    expect(p.system).not.toContain("Write in ");
    expect(p.user).toContain("Title:");
    expect(archivistPrompt({ chapter: "…", records: "…", locked: [] }).system).not.toContain("the story's language");
    expect(clerkPrompt({ state: emptyState(), userName: "Wren", sealed: true, player: "", reply: "", query: "" }).system).not.toContain("the story's language");
  });
});

describe("helpers", () => {
  test("schedules are recognised (the old regex had control characters in it)", () => {
    expect(isSchedule("06:00–09:00 docks")).toBe(true);
    expect(isSchedule("mornings at the market")).toBe(true);
    expect(isSchedule("asleep in the guest room")).toBe(false);
  });
  test("preset versions compare by number", () => {
    expect(olderThan("1.0.9", "1.0.11")).toBe(true);
    expect(olderThan("1.0.11", "1.0.11")).toBe(false);
    expect(olderThan("1.1.0", "1.0.11")).toBe(false);
    expect(PRESET_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
  test("fastHash separates texts and is stable within a run", () => {
    expect(fastHash("a")).toBe(fastHash("a"));
    expect(fastHash("teh cat")).not.toBe(fastHash("the cat"));
  });
  test("plainProse strips ledgers with attributes and an unclosed think block", () => {
    expect(plainProse(`Hi.\n<ledger v="2">\nat: X\n</ledger>`)).toBe("Hi.");
    expect(plainProse("Hello.<think>planning the reply")).toBe("Hello.");
  });
});
