import { describe, expect, test } from "bun:test";
import { parseMessage, parseLine, extractLedgerBlock, parseHeader, parseThoughts, parseVtks } from "../src/core/dsl";

const SAMPLE = `🗓️ Day 3 · Thursday, 14 Frostmoon 🕰️ 14:20 🌧️ rain, moderate · 11°C · wind NW
📍 Lowmarket › The Rusty Flagon › back room
# Salt in the Wound

[spk=Mara#2|whisper]"You gave it back."[/spk] She doesn't look up.

<unspoken>
<t who="Mara#2" cue="her thumb keeps finding the locket's clasp">He gave it back. Why would a thief give it back?</t>
</unspoken>

<ledger>
clock: +12m
wx: rain → heavy rain
at: The Rusty Flagon › back room
cast: Mara@spot(by the fire) · Kael@peri(at the bar) · Joss@left(→ street)
mood Mara: guarded → wary-curious | V-1 A2 D0
body Mara: soaked; fatigue 3
look Mara: coat off, hair dripping
bond Mara>Wren: trust +1 — he gave the locket back
bond Kael>Mara: resent +1 — saw her laugh with Wren
know Mara: Wren is a courier | told · believes · true
know Kael: Wren stole the locket | overheard half · suspects · false
item Locket: Wren → Mara — returned
thread Lost locket: advance — Mara owes Wren a favour
owe Mara → Wren: favour | open
journal Mara: "He gave it back. Thieves don't give things back."
keys Mara: locket, courier, favour
canon: The Flagon's back room floods when the river rises
mode: social
</ledger>`;

describe("ledger parser", () => {
  test("parses the full design sample", () => {
    const r = parseMessage(SAMPLE);
    expect(r.format).toBe("dsl");
    expect(r.unknown).toEqual([]);
    expect(r.ops.map((o) => o.op)).toEqual([
      "clock", "wx", "at", "cast", "mood", "body", "look", "bond", "bond", "know", "know",
      "item", "thread", "owe", "journal", "keys", "canon", "mode",
    ]);
    const [clock, wx, at, cast, mood, body] = r.ops;
    expect(clock.args).toEqual({ kind: "rel", minutes: 12 });
    expect(wx.args.condition).toBe("heavy rain");
    expect(wx.args.intensity).toBe("heavy");
    expect(at.args.path).toEqual(["The Rusty Flagon", "back room"]);
    expect(cast.args.entries).toEqual([
      { name: "Mara", tier: "spot", activity: "by the fire" },
      { name: "Kael", tier: "peri", activity: "at the bar" },
      { name: "Joss", tier: "left", activity: "→ street" },
    ]);
    expect(mood.subject).toBe("Mara");
    expect(mood.args).toMatchObject({ name: "wary-curious", prev: "guarded", v: -1, a: 2, d: 0 });
    expect(body.args.meters.fatigue).toEqual({ v: 3, rel: false });
    expect(body.args.flags).toEqual(["soaked"]);
    const bond = r.ops[7];
    expect(bond.subject).toBe("Mara");
    expect(bond.object).toBe("Wren");
    expect(bond.args.changes).toEqual([{ axis: "trust", delta: 1 }]);
    expect(bond.cause).toBe("he gave the locket back");
    expect(r.ops[8].args.changes).toEqual([{ axis: "resentment", delta: 1 }]);
    const know2 = r.ops[10];
    expect(know2.args).toMatchObject({ status: "suspects", truth: "false", fact: "Wren stole the locket" });
    const item = r.ops[11];
    expect(item.args).toMatchObject({ from: "Wren", to: "Mara" });
    expect(item.cause).toBe("returned");
    expect(r.ops[12].args.op).toBe("advance");
    expect(r.ops[13].args).toMatchObject({ kind: "owe", what: "favour", status: "open" });
    expect(r.ops[15].args.keys).toEqual(["locket", "courier", "favour"]);
    expect(r.ops[17].args.mode).toBe("social");
  });

  test("header, title, thoughts", () => {
    const { header, title } = parseHeader(SAMPLE);
    expect(header?.day).toBe(3);
    expect(header?.time).toBe(14 * 60 + 20);
    expect(header?.tempC).toBe(11);
    expect(header?.wind).toBe("NW");
    expect(header?.place).toEqual(["Lowmarket", "The Rusty Flagon", "back room"]);
    expect(title).toBe("Salt in the Wound");
    const th = parseThoughts(SAMPLE);
    expect(th).toHaveLength(1);
    expect(th[0]).toMatchObject({ who: "Mara", slot: 2 });
  });

  test("tolerates fences, escapes, truncation", () => {
    const fenced = "prose\n```xml\n<ledger>\nclock: +5m\nmode: travel\n</ledger>\n```";
    expect(parseMessage(fenced).ops.map((o) => o.op)).toEqual(["clock", "mode"]);
    const escaped = "prose &lt;ledger&gt;\nclock: +1h\n&lt;/ledger&gt;";
    expect(parseMessage(escaped).ops[0].args.minutes).toBe(60);
    const trunc = extractLedgerBlock("prose <ledger>\nclock: +2h\nwx: fog");
    expect(trunc?.truncated).toBe(true);
    const r = parseMessage("prose <ledger>\n- clock: +1h30m\n* mode: downtime");
    expect(r.ops[0].args.minutes).toBe(90);
    expect(r.truncated).toBe(true);
  });

  test("absolute clock and odd lines", () => {
    expect(parseLine("clock: Day 4 07:10")?.args).toEqual({ kind: "abs", day: 4, minute: 430 });
    expect(parseLine("time: 9:05 pm")?.args).toEqual({ kind: "abs", day: undefined, minute: 21 * 60 + 5 });
    expect(parseLine("bond Kael → Mara: trust -2, fear +1 — she lied")?.args.changes).toEqual([
      { axis: "trust", delta: -2 }, { axis: "fear", delta: 1 },
    ]);
    expect(parseLine("item Knife: → gone — thrown in the river")?.args.to).toBe("gone");
    expect(parseLine("thread The Heist: stall(no crew) — waiting")?.args).toMatchObject({ op: "stall", blocker: "no crew" });
    expect(parseLine("clockf The Syndicate: seize the docks +1 (3/6)")?.args).toMatchObject({ project: "seize the docks", cur: 3, max: 6 });
    expect(parseLine("body Kael: injury: left arm, serious, bandaged; pain 3")?.args.injuries[0]).toMatchObject({ where: "left arm", severity: 3, treated: true });
    expect(parseLine("rep Wren @ Dock Guild: -1 — caught stealing")?.args.delta).toBe(-1);
    expect(parseLine("gauge Dread: 3/5 — the lights failed")?.args).toEqual({ cur: 3, max: 5 });
    expect(parseLine("deadline The Tide: +6h")?.args).toEqual({ kind: "rel", minutes: 360 });
    expect(parseLine("nonsense line")).toBeNull();
    expect(parseLine("mood: Mara: calm")?.subject).toBe("Mara");
  });

  test("json ledger (VELLUM-style) is accepted", () => {
    const r = parseMessage('<ledger>{"ops":["clock: +3m",{"op":"mood","subject":"Mara","value":"calm"}]}</ledger>');
    expect(r.format).toBe("json");
    expect(r.ops.map((o) => o.op)).toEqual(["clock", "mood"]);
  });

  test("vtk extraction", () => {
    const v = parseVtks("[vtk=letter|To the Harbourmaster|sealed · red wax]\nSir —\n» The cargo was never ours.\n[sig=E. Vance]\n[/vtk]");
    expect(v[0]).toMatchObject({ kind: "letter", title: "To the Harbourmaster" });
    expect(v[0].body).toContain("cargo");
  });
});

describe("know lines with free-text notes", () => {
  test("a long note stays a note (with its case) and doesn't become the status", () => {
    const p = parseLine("know Bea: a stranger pulled her out of the river | does not know his name, that he is a slayer, or that 5 months passed")!;
    expect(p.args.status).toBe("knows");
    expect(p.args.source).toBe("does not know his name, that he is a slayer, or that 5 months passed");
    expect(parseLine("know Kael: the ledger was burned | Overheard from Mara · suspects")!.args.source).toBe("Overheard from Mara");
  });
  test("a leading status word sets the status and keeps the rest as the note", () => {
    const p = parseLine("know Joss: the cargo is gone | Suspects it was Kael")!;
    expect(p.args.status).toBe("suspects");
    expect(p.args.source).toBe("it was Kael");
  });
});

describe("knowledge table in the tracker drawer", () => {
  test("pills show the status; notes wrap under them; the table scrolls instead of crushing the fact column", async () => {
    const { renderDrawer } = await import("../src/core/render");
    const { LedgerRuntime, toPath } = await import("../src/core/branch");
    const reply = `The river was cold.\n\n<ledger>\ncast: Bea@spot(on the bank) · Gale@peri(by the fire)\nknow Bea: a stranger pulled her out of the river | does not know his name, that he is a slayer, or that 5 months passed\nmode: social\n</ledger>`;
    const raw = [{ id: "m0", index_in_chat: 0, is_user: false, content: reply, swipes: [reply], swipe_id: 0 }];
    const { state } = new LedgerRuntime().fold(toPath(raw as any), { userName: "Wren", strictness: "lenient", sealed: true, romance: "slow" });
    const html = renderDrawer({ state, colors: {}, userName: "Wren", view: "drawer", trackers: ["knowledge"], latest: false } as any);
    expect(html).toContain('class="alm-km-wrap"');
    expect(html).toContain("✓ knows</span>");
    expect(html).toMatch(/<small class="alm-kp__n" title="does not know his name[^"]*">does not know his name/);
    expect(html).not.toMatch(/alm-kp knows">✓ does not know/);
  });
});
