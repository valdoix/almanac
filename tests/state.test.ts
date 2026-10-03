import { describe, expect, test } from "bun:test";
import { LedgerRuntime, toPath, type RawChatMessage } from "../src/core/branch";
import type { FoldOptions } from "../src/core/state";

const OPTS: FoldOptions = { userName: "Wren", strictness: "strict", sealed: true, romance: "slow" };

function msg(i: number, content: string, isUser = false, swipes?: string[], swipe = 0): RawChatMessage {
  return { id: `m${i}`, index_in_chat: i, is_user: isUser, content, swipes: swipes ?? [content], swipe_id: swipe };
}

const R1 = `🗓️ Day 1 · Monday 🕰️ 18:40 🌧️ rain, light · 11°C · wind NW
📍 Lowmarket › The Rusty Flagon
# The Wet Door
Prose.
<ledger>
cast: Mara@spot(by the fire) · Kael@peri(at the bar)
mood Mara: guarded | V-1 A2 D1
body Mara: soaked; fatigue 2
item Locket: +Wren
mode: social
</ledger>`;

const R2 = `Prose.
<ledger>
clock: +12m
wx: rain → heavy rain
item Locket: Wren → Mara — returned it
bond Mara>Wren: trust +1 — he gave the locket back
know Kael: Wren stole the locket | overheard half · suspects · false
thread Lost locket: new — Mara owes Wren a favour
owe Mara → Wren: favour | open
mode: social
</ledger>`;

describe("fold", () => {
  test("builds state from header + ledgers", () => {
    const rt = new LedgerRuntime();
    const path = toPath([msg(0, R1), msg(1, "I hand her the locket.", true), msg(2, R2)]);
    const { state } = rt.fold(path, OPTS);
    expect(state.time).toEqual({ day: 1, minute: 18 * 60 + 52 });
    expect(state.weather?.condition).toBe("heavy rain");
    expect(state.place).toEqual(["Lowmarket", "The Rusty Flagon"]);
    expect(state.chars.mara.tier).toBe("spot");
    expect(state.chars.mara.mood?.name).toBe("guarded");
    expect(state.items["item:locket"].holder).toBe("mara");
    expect(state.bonds["mara>user"].axes.trust).toBe(1);
    expect(state.knowledge[0]).toMatchObject({ holder: "kael", status: "suspects", truth: "false" });
    expect(Object.values(state.cons)[0]).toMatchObject({ who: "mara", whom: "user", what: "favour" });
    expect(state.title).toBe("The Wet Door");
    expect(state.chars.mara.slot).toBe(1);
    expect(state.chars.kael.slot).toBe(2);
  });

  test("swipes are branch-correct", () => {
    const rt = new LedgerRuntime();
    const alt = `Prose.\n<ledger>\nclock: +3h\nitem Locket: Wren → Kael — sold it\nmode: downtime\n</ledger>`;
    const a = rt.fold(toPath([msg(0, R1), msg(1, "x", true), msg(2, R2, false, [R2, alt], 0)]), OPTS).state;
    const b = rt.fold(toPath([msg(0, R1), msg(1, "x", true), msg(2, alt, false, [R2, alt], 1)]), OPTS).state;
    expect(a.items["item:locket"].holder).toBe("mara");
    expect(b.items["item:locket"].holder).toBe("kael");
    expect(b.bonds["mara>user"]).toBeUndefined();
    expect(b.time?.minute).toBe(18 * 60 + 40 + 180);
  });

  test("validation rejects rewinds, causeless bonds, bad custody, player's inner state", () => {
    const rt = new LedgerRuntime();
    const bad = `<ledger>
clock: Day 1 07:00
bond Kael>Mara: trust -1
item Locket: Kael → Joss — stole it
mood Wren: furious
bond Mara>Kael: affection +5 — shared a drink
</ledger>`;
    const { events, state } = rt.fold(toPath([msg(0, R1), msg(1, bad)]), OPTS);
    const reasons = events.filter((e) => e.verdict !== "accepted").map((e) => [e.op.op, e.verdict]);
    expect(reasons).toContainEqual(["clock", "rejected"]);
    expect(reasons).toContainEqual(["bond", "rejected"]);
    expect(reasons).toContainEqual(["item", "rejected"]);
    expect(reasons).toContainEqual(["mood", "rejected"]);
    expect(reasons).toContainEqual(["bond", "warned"]);
    expect(state.bonds["mara>kael"].axes.affection).toBe(2); // clamped
    expect(state.items["item:locket"].holder).toBe("user");
  });

  describe("hunger, thirst and fatigue", () => {
    // R1 starts at Day 1 18:40.
    const meters = (...rs: string[]) => new LedgerRuntime().fold(toPath([msg(0, R1), ...rs.map((r, i) => msg(i + 1, `<ledger>\n${r}\n</ledger>`))]), OPTS).state.chars.mara.meters;
    test("build slowly on the page and stop at the mild level", () => {
      // Four hours of scene in small steps: no change yet.
      const steps = Array.from({ length: 24 }, () => "clock: +10m");
      expect(meters("body Mara: hunger 1; thirst 1; fatigue 1", ...steps)).toMatchObject({ hunger: 1, thirst: 1, fatigue: 1 });
      // A whole sleepless night of scene: no further than "a little hungry" / "exhausted".
      const night = Array.from({ length: 30 }, () => "mode: crisis\nclock: +1h");
      const m = meters("body Mara: hunger 1; thirst 1; fatigue 1", ...night);
      expect(m.hunger).toBe(3);
      expect(m.thirst).toBe(3);
      expect(m.fatigue).toBe(4);
    });
    test("a jump past a mealtime means they ate and drank", () => {
      const m = meters("body Mara: hunger 3; thirst 3", "clock: +4h");
      expect(m.hunger).toBe(1);
      expect(m.thirst).toBe(1);
    });
    test("a jump through the night is sleep, in any mode", () => {
      const m = meters("body Mara: hunger 1; fatigue 4", "clock: → Day 2 07:30");
      expect(m.fatigue).toBe(0);
      expect(m.hunger).toBe(1);
    });
    test("a short night leaves them tired; downtime sleep counts by day too", () => {
      expect(meters("body Mara: fatigue 5", "mode: downtime\nclock: +4h").fatigue).toBe(3);
      expect(meters("body Mara: fatigue 5", "mode: downtime\nclock: +8h").fatigue).toBe(0);
    });
    test("someone without food goes past hungry, and a set value isn't pulled down by the clock", () => {
      expect(meters("body Mara: hunger 3; trapped", "mode: crisis\nclock: +12h").hunger).toBe(5);
      expect(meters("body Mara: hunger 5", "clock: +30m").hunger).toBe(5);
    });
    test("needs written as words move the meters", () => {
      const m = meters("body Mara: hunger 5; thirst 5; fatigue 4", "body Mara: fed (steak ×2); thirst easing; rested");
      expect(m).toMatchObject({ hunger: 1, thirst: 3, fatigue: 1 });
      expect(meters("body Mara: hungry, parched, exhausted")).toMatchObject({ hunger: 3, thirst: 4, fatigue: 4 });
    });
  });

  describe("stamina", () => {
    const fold = (opts: Partial<FoldOptions>, ...rs: string[]) => new LedgerRuntime().fold(toPath([msg(0, R1), ...rs.map((r, i) => msg(i + 1, `<ledger>\n${r}\n</ledger>`))]), { ...OPTS, ...opts }).state.chars.mara;
    const night = Array.from({ length: 30 }, () => "mode: crisis\nclock: +1h");
    test("a Slayer from the card tires and hungers slower than anyone", () => {
      const ordinary = fold({}, "body Mara: hunger 1; thirst 1; fatigue 1", ...night.slice(0, 12)).meters;
      const slayer = fold({ stamina: { "mara": { kind: "slayer", by: "card" } } }, "body Mara: hunger 1; thirst 1; fatigue 1", ...night.slice(0, 12));
      expect(slayer.stamina?.kind).toBe("slayer");
      expect(ordinary.fatigue).toBe(3);
      expect(slayer.meters.fatigue).toBe(1);
      expect(slayer.meters.hunger!).toBeLessThanOrEqual(ordinary.hunger!);
    });
    test("a vampire never thirsts and an android never tires; the story's trait line says so too", () => {
      const v = fold({}, "trait Mara: vampire; black hair", "body Mara: hunger 1; thirst 1; fatigue 1", ...night);
      expect(v.stamina?.kind).toBe("vampire");
      expect(v.stamina?.by).toBe("story");
      expect(v.meters.thirst).toBe(1);
      const a = fold({ castEdits: { mara: { stamina: { kind: "construct" } } } }, "body Mara: hunger 1; thirst 1; fatigue 1", ...night).meters;
      expect(a).toMatchObject({ hunger: 1, thirst: 1, fatigue: 1 });
    });
    test("the player's speeds beat the card's kind", () => {
      const m = fold({ stamina: { mara: { kind: "slayer", by: "card" } }, castEdits: { mara: { stamina: { fatigue: 2 } } } }, "body Mara: fatigue 1", ...night.slice(0, 6));
      expect(m.stamina).toMatchObject({ kind: "slayer", fatigue: 2, custom: true });
      expect(m.meters.fatigue).toBe(3);
    });
    test("a stamina potion lifts tiredness and holds it off for hours", () => {
      const m = fold({}, "body Mara: fatigue 4", "body Mara: drank a Pepper-Up potion", ...night.slice(0, 5));
      expect(m.meters.fatigue).toBe(1);
      expect(m.meters.thirst).toBeUndefined();
      expect(fold({}, "body Mara: fatigue 1", "body Mara: drank a Pepper-Up potion", ...night.slice(0, 12)).meters.fatigue).toBe(2);
    });
    test("a Slayer's wounds close sooner", () => {
      const hurt = ["body Mara: injury: left arm, wound, bandaged", "clock: → Day 7 18:00"];
      expect(fold({}, ...hurt).injuries.length).toBe(1);
      expect(fold({ stamina: { mara: { kind: "slayer", by: "card" } } }, ...hurt).injuries.length).toBe(0);
    });
  });

  test("snapshots give identical results", () => {
    const msgs: RawChatMessage[] = [msg(0, R1)];
    for (let i = 1; i < 60; i++) msgs.push(msg(i, i % 2 ? "go on" : `<ledger>\nclock: +5m\nbond Mara>Kael: trust +1 — talk ${i}\n</ledger>`, i % 2 === 1));
    const rt = new LedgerRuntime();
    const first = rt.fold(toPath(msgs), OPTS).state;
    const second = rt.fold(toPath(msgs), OPTS).state;
    expect(second.time).toEqual(first.time);
    expect(second.bonds["mara>kael"].axes.trust).toBe(5);
    const fresh = new LedgerRuntime().fold(toPath(msgs), OPTS).state;
    expect(fresh.time).toEqual(first.time);
    const asOf = rt.stateAt(toPath(msgs), "m10", OPTS)!;
    expect(asOf.time!.minute).toBe(18 * 60 + 40 + 25);
  });

  test("side events repair a missing ledger", () => {
    const rt = new LedgerRuntime();
    const path = toPath([msg(0, R1), msg(1, "Prose without a ledger.")]);
    const { state } = rt.fold(path, OPTS, { "m1:0": [{ source: "repair", replaces: true, ops: [{ op: "clock", args: { kind: "rel", minutes: 30 }, raw: "clock: +30m" }] }] });
    expect(state.time!.minute).toBe(18 * 60 + 40 + 30);
    expect(state.unverified).toContain(1);
  });
});

describe("item holders", () => {
  test("a location phrase is never a new character", () => {
    const rt = new LedgerRuntime();
    const r1 = `Prose.\n<ledger>\ncast: Buffy@spot\nitem Necklace: +Buffy\nmode: social\n</ledger>`;
    const r2 = `Prose.\n<ledger>\nitem Necklace: held by Buffy in jacket pocket (held in Buffy's hand (visible))\nitem Ring: in Buffy's jacket pocket (no change)\nitem Knife: under the loose floorboard\nitem Necklace: no change\nmode: social\n</ledger>`;
    const { state } = rt.fold(toPath([msg(0, r1), msg(1, "Go on.", true), msg(2, r2)]), OPTS);
    expect(Object.values(state.chars).map((c) => c.name).sort()).toEqual(["Buffy"]);
    expect(state.items["item:necklace"].holder).toBe("buffy");
    expect(state.items["item:necklace"].where).toBe("jacket pocket");
    expect(state.items["item:ring"].holder).toBe("buffy");
    expect(state.items["item:knife"].where).toBe("under the loose floorboard");
  });
});

describe("the player's character", () => {
  const P: FoldOptions = { ...OPTS, userName: "Gabriel Winters" };
  const r = (body: string) => `Prose.\n<ledger>\n${body}\nmode: social\n</ledger>`;

  test("first name, a typo and a slot-0 mark are all the persona", () => {
    const rt = new LedgerRuntime();
    const path = toPath([
      msg(0, `[spk=Buffy#1]"Morning."[/spk]\n` + r("cast: Buffy@spot(at the table) · Gabriel@spot(plating waffles, glasses on)")),
      msg(1, "I sit.", true),
      msg(2, r("bond Buffy>Gabuel: trust +1 — he made waffles")),
      msg(3, "More.", true),
      msg(4, `[spk=Gabe#0]"Eat up."[/spk]\n` + r("cast: Buffy@spot · Gabe@spot")),
    ]);
    const { state } = rt.fold(path, P);
    expect(Object.values(state.chars).filter((c) => !c.isUser).map((c) => c.name)).toEqual(["Buffy"]);
    expect(state.chars.user.name).toBe("Gabriel Winters");
    expect(state.chars.user.activity).toBe("plating waffles, glasses on");
    expect(state.chars.user.aliases).toContain("Gabe");
  });

  test("a longer form of the name is someone else, and a hand merge folds a name in", () => {
    const rt = new LedgerRuntime();
    const path = toPath([msg(0, r("cast: Gabriela@spot · Winnie@peri"))]);
    expect(Object.keys(rt.fold(path, P).state.chars).sort()).toEqual(["gabriela", "winnie"]);
    const merged = rt.fold(path, { ...P, merges: { winnie: "user" } }).state;
    expect(Object.keys(merged.chars).sort()).toEqual(["gabriela", "user"]);
  });

  test("a misspelt NPC name joins the NPC", () => {
    const rt = new LedgerRuntime();
    const path = toPath([msg(0, r("cast: Theodora@spot")), msg(1, "Hi.", true), msg(2, r("mood Theodroa: wary"))]);
    const { state } = rt.fold(path, P);
    expect(Object.keys(state.chars)).toEqual(["theodora"]);
    expect(state.chars.theodora.mood?.name).toBe("wary");
  });
});

describe("romance ladder falls", () => {
  const FAST: FoldOptions = { userName: "Gabriel", strictness: "strict", sealed: true, romance: "fast" };
  const turn = (i: number, lines: string) => msg(i, `Prose.\n<ledger>\n${lines}\nmode: social\n</ledger>`);
  const climb = [turn(0, "cast: Buffy@spot\nladder Buffy>Gabriel: tier 2 — she noticed him"), turn(1, "ladder Buffy>Gabriel: tier 3 — his hand stayed")];
  const tierAfter = (line: string, extra: RawChatMessage[] = []) => {
    const { state, events } = new LedgerRuntime().fold(toPath([...climb, turn(2, line), ...extra]), FAST);
    const l = Object.values(state.ladders)[0];
    return { tier: l.tier, state, events };
  };

  test("a low rung written after a warm beat is read as a step up", () => {
    expect(tierAfter("ladder Buffy>Gabriel: tier 1 — he held her through the break; she didn't let go").tier).toBe(4);
  });
  test("a fall with no hurt in its cause is held", () => {
    expect(tierAfter("ladder Buffy>Gabriel: tier 1").tier).toBe(3);
    expect(tierAfter("ladder Buffy>Gabriel: tier 1 — they talked about the weather").tier).toBe(3);
  });
  test("real regressions still fall: one rung, or more for betrayal", () => {
    expect(tierAfter("ladder Buffy>Gabriel: tier 1 — he lied about the prophecy").tier).toBe(2);
    expect(tierAfter("ladder Buffy>Gabriel: tier 0 — he betrayed her to the Council").tier).toBe(0);
    expect(tierAfter("ladder Buffy>Gabriel: tier 2 — he broke her trust").tier).toBe(2);
  });
  test("restating the same rung is not a new milestone", () => {
    const { state } = tierAfter("ladder Buffy>Gabriel: tier 3 — still charged", [turn(3, "ladder Buffy>Gabriel: tier 3 — still charged")]);
    expect(state.milestones.filter((m) => m.kind === "ladder").map((m) => m.text)).toEqual(["Buffy → Gabriel: Interested", "Buffy → Gabriel: Charged"]);
  });
});

describe("the first clock line", () => {
  const H = (t: string, clock: string) => `🗓️ Day 1 · Monday 15 October 2001 🕰️ ${t} ☁️ overcast · 14°C\n📍 Sunnydale › cemetery\n\nProse.\n<ledger>\nclock: ${clock}\n</ledger>`;
  test("a relative first clock starts from the header's time, not 08:00", () => {
    const { state } = new LedgerRuntime().fold(toPath([msg(0, H("22:15", "+10m"))]), OPTS);
    expect(state.time).toEqual({ day: 1, minute: 22 * 60 + 15 });
  });
  test("a target behind the clock falls back to the span", () => {
    const { state } = new LedgerRuntime().fold(toPath([msg(0, H("22:15", "+10m")), msg(1, "ok", true), msg(2, H("22:18", "+5m → 22:10"))]), OPTS);
    expect(state.time).toEqual({ day: 1, minute: 22 * 60 + 20 });
  });
});

describe("who is still in the scene", () => {
  const r = (body: string, prose = "Prose.") => `${prose}\n<ledger>\n${body}\nmode: social\n</ledger>`;
  const here = (path: ReturnType<typeof toPath>) =>
    Object.values(new LedgerRuntime().fold(path, OPTS).state.chars).filter((c) => c.tier === "spot" || c.tier === "peri").map((c) => c.name).sort();
  const crowd = msg(0, r("at: House › living room\ncast: Buffy@spot · Dawn@peri · Willow@peri · Tara@peri · Ruth@peri(sofa)"));

  test("a roster that leaves someone out drops them", () => {
    expect(here(toPath([crowd, msg(1, "ok", true), msg(2, r("cast: Buffy@spot(floor) · Dawn@peri(sofa)"))]))).toEqual(["Buffy", "Dawn"]);
  });

  test("someone with a line in the reply, or named in another's note, stays", () => {
    const path = toPath([crowd, msg(1, "ok", true), msg(2, r("cast: Buffy@spot(floor) · Dawn@peri(sofa, Ruth in lap)", `[spk=Willow#3]"I didn't mean to."[/spk]`))]);
    expect(here(path)).toEqual(["Buffy", "Dawn", "Ruth", "Willow"]);
  });

  test("arrivals and departures alone, or one name in the same place, say nothing about the rest", () => {
    expect(here(toPath([crowd, msg(1, "ok", true), msg(2, r("cast: Tara@left(→ street) · Xander@arrive(← door)"))]))).toEqual(["Buffy", "Dawn", "Ruth", "Willow", "Xander"]);
    expect(here(toPath([crowd, msg(1, "ok", true), msg(2, r("cast: Dawn@spot(standing)"))]))).toEqual(["Buffy", "Dawn", "Ruth", "Tara", "Willow"]);
  });

  test("one name after the scene moved is the roster; no cast line brings everyone along", () => {
    expect(here(toPath([crowd, msg(1, "ok", true), msg(2, r("at: House › bedroom\ncast: Buffy@spot(bed)"))]))).toEqual(["Buffy"]);
    expect(here(toPath([crowd, msg(1, "ok", true), msg(2, r("at: House › kitchen"))]))).toEqual(["Buffy", "Dawn", "Ruth", "Tara", "Willow"]);
  });

  test("the header's place, or an at: line below the cast line, moves the scene before the cast is read", () => {
    const head = (day: number, time: string, place: string, body: string) => `🗓️ Day ${day} · Monday 🕰️ ${time} 🌧️ rain, light · 11°C\n📍 ${place}\n<ledger>\n${body}\nmode: social\n</ledger>`;
    const flagon = msg(0, head(1, "18:40", "Lowmarket › The Rusty Flagon", "cast: Mara@spot · Kael@spot"));
    for (const next of [head(2, "07:30", "Lowmarket › Docks", "cast: Kael@spot"), r("cast: Kael@spot\nat: Lowmarket › Docks")]) {
      const { state } = new LedgerRuntime().fold(toPath([flagon, msg(1, next)]), OPTS);
      expect(state.place).toEqual(["Lowmarket", "Docks"]);
      expect(state.chars.mara.tier).toBe("off");
      expect(state.chars.kael.tier).toBe("spot");
      expect(state.chars.kael.place).toBe("Docks");
    }
    // The same header place again is not a move: one name says nothing about the rest.
    const stay = new LedgerRuntime().fold(toPath([flagon, msg(1, head(1, "18:50", "Lowmarket › The Rusty Flagon", "cast: Kael@spot"))]), OPTS).state;
    expect(stay.chars.mara.tier).toBe("spot");
  });

  test("periphery in another room is away", () => {
    const path = toPath([crowd, msg(1, "ok", true), msg(2, r("cast: Buffy@spot · Dawn@peri(asleep, next room) · Willow@peri · Tara@peri · Ruth@peri"))]);
    expect(here(path)).toEqual(["Buffy", "Ruth", "Tara", "Willow"]);
  });
});
