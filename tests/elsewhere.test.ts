// Elsewhere (design/09): the world off the page.
import { describe, expect, test } from "bun:test";
import { parseLine } from "../src/core/dsl";
import { emptyState, Folder } from "../src/core/state";
import type { CodexRecord } from "../src/core/codex";
import type { CharacterState, FactState, WorldState } from "../src/core/types";
import { buildRoster, readStanding, storyTown } from "../src/core/elsewhere/roster";
import { spreadNews } from "../src/core/elsewhere/news";
import { gate, seedCandidates } from "../src/core/elsewhere/arcs";
import { tick } from "../src/core/elsewhere/storyteller";
import { confirmArrivals, coverage, elsewhereLane, expireArrivals, routeFor, upgradeArrival, type Arrival } from "../src/core/elsewhere/crossings";
import { validateTold } from "../src/core/elsewhere/telling";
import { kindFromText, stageOf } from "../src/core/elsewhere/grammar";
import { rng } from "../src/core/util";

const DAY = 1440;

function char(id: string, name: string, extra: Partial<CharacterState> = {}): CharacterState {
  return { id, name, aliases: [], slot: 0, isUser: false, firstSeen: 0, lastSeen: 10, meters: {}, flags: [], injuries: [], journal: [], voiced: true, castSeen: 3, ...extra };
}
function person(id: string, name: string, summary: string, body: Record<string, any> = {}): CodexRecord {
  return { id, kind: "person", tense: "now", name, aliases: [], keys: [], summary, body, links: [], scope: {}, provenance: { source: "lore" }, salience: 0.3, lastSeen: 0, status: "active" };
}
function lore(id: string, kind: any, name: string, summary: string, body: Record<string, any> = {}): CodexRecord {
  return { ...person(id, name, summary, body), kind };
}
function fact(key: string, statement: string, stances: Record<string, any>, extra: Partial<FactState> = {}): FactState {
  const s: FactState["stances"] = {};
  for (const [h, st] of Object.entries(stances)) s[h] = { holder: h, status: st, msgIndex: 5, at: null };
  return { key, statement, truth: "true", aliases: [], stances: s, history: [], firstMsg: 5, lastMsg: 8, out: [{ msgIndex: 5, at: null, channel: "aloud", present: Object.keys(stances) }], ...extra };
}

/** Sunnydale, a little: Buffy and Dawn on the page; Willow off it; Giles in England; Joyce dead; Ruth a cat. */
function world(): { st: WorldState; records: CodexRecord[] } {
  const st = emptyState();
  st.time = { day: 3, minute: 22 * 60 };
  st.place = ["Sunnydale", "Winters Residence", "kitchen"];
  st.places = {
    "loc:winters": { id: "loc:winters", name: "Winters Residence", path: ["Sunnydale", "Winters Residence"], visits: 5, lastMsg: 9 },
    "loc:revello": { id: "loc:revello", name: "Revello Drive", path: ["Sunnydale", "Revello Drive"], visits: 1, lastMsg: 3 },
  };
  st.msgCount = 12;
  st.chars = {
    buffy: char("buffy", "Buffy", { tier: "spot" }),
    dawn: char("dawn", "Dawn", { tier: "spot" }),
    willow: char("willow", "Willow", { tier: "off", place: "Sunnydale" }),
    user: { ...char("user", "Gabriel"), isUser: true },
  };
  st.facts = {
    "buffy-alive": fact("buffy-alive", "Buffy is alive again, back from the dead", { buffy: "knows", dawn: "knows", willow: "knows" }),
    "heaven": fact("heaven", "Buffy was in Heaven", { buffy: "knows" }, { keepers: ["buffy"], keptFrom: ["dawn", "willow"] }),
  };
  const records: CodexRecord[] = [
    { ...person("char:buffy", "Buffy", "Buffy Summers is the Slayer.", { role: "Vampire Slayer" }), provenance: { source: "story" } },
    { ...person("char:dawn", "Dawn", "Dawn is Buffy's sister.", { lore: "Dawn Summers is Buffy's fifteen-year-old sister." }), provenance: { source: "story" } },
    { ...person("char:willow", "Willow", "", { lore: "Willow Rosenberg is a witch and Buffy's best friend.", role: "witch" }), provenance: { source: "story" } },
    person("char:rupert_giles", "Rupert Giles", "Rupert Giles is a human Watcher and Buffy's mentor, who has just left for England."),
    person("char:joyce", "Joyce Summers", "Joyce Summers died of a brain aneurysm in February 2001."),
    person("char:ruth", "Ruth", "Ruth is a fat, orange tabby cat who belongs to Gabriel."),
    person("char:faith", "Faith Lehane", "Faith Lehane is a Vampire Slayer, Called when Kendra died in 1998, now serving a prison sentence in California."),
    person("char:clem", "Clem", "Clem is a loose-skinned, floppy-eared demon in Sunnydale who plays kitten poker with Spike."),
    lore("lore:giles_returns", "forecast", "Giles returns", "Upcoming (not yet true): Rupert Giles will likely fly back to Sunnydale within days once Willow tells him Buffy is alive.", { participants: ["Rupert Giles", "Willow"] }),
  ];
  return { st, records };
}

describe("the ledger lines Elsewhere writes", () => {
  test("arc lines parse and fold into subplots", () => {
    const st = emptyState();
    st.time = { day: 2, minute: 600 };
    const f = new Folder({ userName: "Gabriel", strictness: "strict", sealed: false }, st);
    const lines = [
      "arc new #giles-return: return | lead: Giles | cast: Willow | secrecy: private | clock: 6 | heat: 1 | at: 2000 | premise: Giles hears Buffy is back | want: to see Buffy | fear: they took a terrible risk | grounds: char:rupert_giles, #buffy-alive | by: engine",
      "arc beat #giles-return: cost | roll: 4+5-1 | at: 2040 | tick: w17 | next: 2300 | told: template | text: He booked the first flight he could get.",
      "arc stage #giles-return: rising",
      "whereabouts Giles: on the way to Sunnydale | since: 2040",
    ];
    f.applyMessage(3, "m3", 0, { ops: [], unknown: [], format: "none", truncated: false }, "model", lines.map((l) => ({ ...parseLine(l)!, src: "sim" as const })));
    const arc = f.state.arcs!["giles-return"];
    expect(arc).toMatchObject({ kind: "return", lead: "Giles", cast: ["Willow"], clock: { cur: 1, max: 6 }, stage: "rising", tally: { win: 0, cost: 1, loss: 0 }, nextAbs: 2300 });
    expect(arc.beats[0]).toMatchObject({ roll: [4, 5], mod: -1, text: "He booked the first flight he could get.", tick: "w17" });
    expect(arc.grounds).toEqual(["char:rupert_giles", "#buffy-alive"]);
    expect(f.state.whereabouts!["giles"].place).toBe("on the way to Sunnydale");
    // Off the page isn't news in the reply's own change list.
    expect(f.state.lastDelta!.lines).toEqual([]);
  });

  test("the old simulator's clock arrows read as the count reached, on the same clock", () => {
    expect(parseLine("clockf Hellions: raid Sunnydale 2/6 → 3/6 — looting spreads")!.args).toMatchObject({ project: "raid Sunnydale", cur: 3, max: 6 });
    const p = parseLine("clockf Hellions 3/6 → 4/6: daylight scouting")!;
    expect(p.subject).toBe("Hellions");
    expect(p.args).toMatchObject({ cur: 4, max: 6 });
    const st = emptyState();
    const f = new Folder({ userName: "U", strictness: "lenient", sealed: false }, st);
    for (const [i, l] of ["clockf Hellions: raid Sunnydale 2/6", "clockf Hellions: raid Sunnydale → 3/6", "clockf Hellions 3/6 → 4/6: daylight scouting"].entries()) f.applyMessage(i, `m${i}`, 0, { ops: [parseLine(l)!], unknown: [], format: "dsl", truncated: false });
    const clocks = Object.values(f.state.factions["fac:hellions"].clocks);
    expect(clocks.length).toBe(1);
    expect(clocks[0].cur).toBe(4);
  });

  test("a thread restated with nothing new doesn't count as an advance", () => {
    expect(parseLine("thread Scoobies: Buffy hasn't contacted them; no change overnight")!.args.op).toBe("note");
    expect(parseLine("thread Hellions raid: open; latest: raid intensified downtown; stalls: 0")!.args).toMatchObject({ op: "advance", detail: "raid intensified downtown" });
    expect(parseLine("thread Lost meals: closed; latest: the fridge is full")!.args.op).toBe("resolve");
  });
});

describe("the roster", () => {
  test("reads standing and whereabouts from the lore", () => {
    expect(readStanding("Joyce Summers died of a brain aneurysm in February 2001.").standing).toBe("dead");
    expect(readStanding("Faith Lehane is a Vampire Slayer, Called when Kendra died in 1998, now serving a prison sentence in California.").standing).toBe("captive");
    expect(readStanding("Rupert Giles is a Watcher, who has just left for England.")).toMatchObject({ standing: "away", where: "England" });
    expect(readStanding("Ruth is a fat, orange tabby cat who belongs to Gabriel Winters.")).toMatchObject({ standing: "companion", owner: "Gabriel Winters" });
    expect(readStanding("Seasmoke is Laenor Velaryon's young pale silver-grey dragon.")).toMatchObject({ standing: "companion", owner: "Laenor Velaryon" });
    expect(readStanding("Clem is a loose-skinned, floppy-eared demon in Sunnydale who plays kitten poker with Spike.").standing).toBeUndefined();
    expect(readStanding("Amy Madison is a witch who has been trapped as a rat since 1998.").standing).toBe("changed");
  });

  test("rings, reach, ties and the town", () => {
    const { st, records } = world();
    const r = buildRoster({ state: st, records, userName: "Gabriel" });
    const by = (n: string) => r.find(n)!;
    expect(by("Buffy").ring).toBe("onstage");
    expect(by("Willow").ring).toBe("offstage");
    expect(by("Giles")).toMatchObject({ ring: "unmet", standing: "away", reach: "far" });
    expect(by("Clem").reach).toBe("town");
    expect(by("Ruth").standing).toBe("companion");
    expect(by("Faith Lehane").standing).toBe("captive");
    expect(by("Giles").ties.find((t) => t.to === "buffy")?.strength).toBe(3);
    expect(by("Giles").ties.find((t) => t.to === "willow")?.strength).toBe(2);
    expect(r.town).toBe("Sunnydale");
    expect(storyTown(st)).toBe("Sunnydale");
  });
});

describe("news off the page", () => {
  test("travels along ties, never from a secret's keeper, never about the listener", () => {
    const { st, records } = world();
    const r = buildRoster({ state: st, records, userName: "Gabriel" });
    const hops = spreadNews({ state: st, roster: r, hours: 48, rand: () => 0, offPage: [] });
    expect(hops.some((h) => h.to.name === "Rupert Giles" && h.key === "buffy-alive" && /told by Willow, by letter/.test(h.line))).toBe(true);
    expect(hops.some((h) => h.key === "heaven")).toBe(false);
    // Buffy is in the scene: the page decides what she tells.
    expect(hops.some((h) => h.from.name === "Buffy")).toBe(false);
  });
});

describe("the gate", () => {
  const { st, records } = world();
  const r = buildRoster({ state: st, records, userName: "Gabriel" });
  const arc = (o: any) => ({ id: "a", kind: "return", lead: "Giles", cast: [], premise: "", want: "to come back", fear: "", grounds: ["char:rupert_giles"], secrecy: "private", clock: { cur: 0, max: 6 }, tally: { win: 0, cost: 0, loss: 0 }, heat: 1, stage: "setup", beats: [], nextAbs: 0, status: "running", by: "engine", startedAbs: 0, startedMsg: 0, ...o }) as any;
  test("the dead never act; news not yet heard holds a beat back", () => {
    expect(gate(arc({ lead: "Joyce Summers" }), r.find("Joyce Summers"), r, { from: 0, now: 3 * DAY, rand: rng("x") }).drop).toContain("can no longer act");
    const g = gate(arc({ grounds: ["#buffy-alive"] }), r.find("Giles"), r, { from: 0, now: 3 * DAY, rand: rng("x") });
    expect(g.ok).toBe(false);
    expect(g.why[0]).toContain("waits for news");
  });
  test("people act when they're up", () => {
    const g = gate(arc({}), r.find("Giles"), r, { from: 2 * DAY + 60, now: 2 * DAY + 120, rand: rng("x") });
    expect(g.ok).toBe(false);
    expect(g.why).toContain("asleep");
    const ok = gate(arc({}), r.find("Giles"), r, { from: 2 * DAY + 600, now: 2 * DAY + 700, rand: rng("x") });
    expect(ok.ok).toBe(true);
    expect(ok.atAbs! % DAY).toBeGreaterThanOrEqual(600);
  });
});

describe("seeding and the tick", () => {
  test("a conditional forecast waits until the news has reached its lead", () => {
    const { st, records } = world();
    const r = buildRoster({ state: st, records, userName: "Gabriel" });
    const ctx = { state: st, roster: r, records, awake: r.actors.filter((a) => a.ring !== "onstage"), arcs: [], canonGravity: "light" as const, genres: [], now: 3 * DAY };
    expect(seedCandidates(ctx).some((c) => c.kind === "return")).toBe(false);
    // The news reached him (the story's record for Giles now carries his lore, as the Codex joins it).
    st.chars.giles = char("giles", "Giles", { castSeen: 0, voiced: false });
    st.facts!["buffy-alive"].stances.giles = { holder: "giles", status: "knows", route: "told", msgIndex: 11, at: null };
    const joined = records.map((x) => (x.id === "char:rupert_giles" ? { ...x, id: "char:giles", name: "Giles", aliases: ["Rupert Giles"], provenance: { source: "story" as const }, body: { lore: x.summary } } : x));
    const r2 = buildRoster({ state: st, records: joined, userName: "Gabriel" });
    const ret = seedCandidates({ ...ctx, roster: r2, awake: r2.actors.filter((a) => a.ring !== "onstage") }).find((c) => c.kind === "return");
    expect(ret?.lead.name).toBe("Giles");
    expect(ret?.grounds).toEqual(["lore:giles_returns", "#buffy-alive"]);
    // Someone's lore alone doesn't make a demon a threat, or a mention of a death a grief.
    const kinds = seedCandidates({ ...ctx, roster: r2, awake: r2.actors.filter((a) => a.ring !== "onstage") }).map((c) => `${c.lead.name}:${c.kind}`);
    expect(kinds).not.toContain("Clem:threat");
    expect(kinds).not.toContain("Faith Lehane:loss");
    expect(seedCandidates({ ...ctx, roster: r2, canonGravity: "off" }).some((c) => c.kind === "return")).toBe(false);
  });

  test("the same stretch of story time rolls the same world", () => {
    const { st, records } = world();
    st.factions = { "fac:hellions": { id: "fac:hellions", name: "Hellions", clocks: { raid: { name: "raid Sunnydale", cur: 2, max: 6, history: [] } } } };
    const inp = { chatId: "c", tickId: "w30", state: st, records, userName: "Gabriel", mode: "living" as const, canonGravity: "light" as const, fates: "ask" as const, genres: [], from: 2 * DAY + 600, now: 3 * DAY + 300, anchorIndex: 11, offPage: [], recentArrivals: [] };
    const a = tick(inp);
    const b = tick(inp);
    expect(a.lines).toEqual(b.lines);
    expect(a.lines.some((l) => l.startsWith("arc new #hellions-threat") || l.startsWith("arc new #hellions_threat"))).toBe(true);
    // The engine writes clean clock lines, never the arrow forms.
    for (const l of a.lines.filter((x) => x.startsWith("clockf"))) expect(l).toMatch(/^clockf Hellions: raid Sunnydale \d\/6 — /);
    expect(tick({ ...inp, tickId: "w31" }).lines).not.toEqual(a.lines);
  });

  test("a stage follows the clock", () => {
    expect([0, 1, 2, 4, 5, 6].map((c) => stageOf(c, 6))).toEqual(["setup", "setup", "rising", "rising", "crisis", "aftermath"]);
    expect(kindFromText("Willow may be drawn deeper into dark magic")).toBe("decline");
    expect(kindFromText("Giles will fly back to Sunnydale")).toBe("return");
  });
});

describe("crossings", () => {
  const base = (o: Partial<Arrival>): Arrival => ({ id: "x", msgId: "m1", swipe: 0, text: "Sirens two streets over", kind: "ambient", status: "pending", offered: [], atAbs: 3 * DAY + 600, untilAbs: 3 * DAY + 1200, ...o });
  const lane = (arrivals: Arrival[], over: Partial<WorldState> = {}) => {
    const { st, records } = world();
    Object.assign(st, over);
    return elsewhereLane({ state: st, arrivals, roster: buildRoster({ state: st, records, userName: "Gabriel" }), now: 3 * DAY + 700, at: 12, tier: "routine", mode: "living", onPath: () => true, seen: {} });
  };
  test("a nested place matches the scene by segment (the 11-of-12 bug)", () => {
    const t = base({ kind: "trace", text: "At the Winters kitchen, a note under the door", place: ["Sunnydale", "Winters Residence", "kitchen"] });
    expect(lane([t]).offered).toEqual(["x"]);
    const away = base({ kind: "trace", text: "Broken windows", place: ["Sunnydale", "Revello Drive"] });
    expect(lane([away]).offered).toEqual([]);
  });
  test("stale news expires; an unanswered call becomes a message", () => {
    const old = upgradeArrival({ id: "o", msgId: "m1", swipe: 0, text: "Day 1 sirens", atAbs: 600, place: "Winters Residence › kitchen" });
    const call = base({ id: "c", kind: "signal", medium: "phone", lead: "Eleanor", text: "a call from Eleanor: keeping in touch", untilAbs: 3 * DAY + 650 });
    const out = expireArrivals([old, call], 3 * DAY + 700);
    expect(out.map((x) => x.id)).toEqual(["o"]);
    expect(call.kind).toBe("trace");
    expect(call.text).toContain("missed call");
  });
  test("charged scenes wait; a carrier needs to be in the scene", () => {
    const { st, records } = world();
    const r = buildRoster({ state: st, records, userName: "Gabriel" });
    const carrier = base({ id: "k", kind: "carrier", carrier: "Willow", text: "Willow knows: Giles is coming" });
    expect(elsewhereLane({ state: st, arrivals: [carrier], roster: r, now: 3 * DAY + 700, at: 12, tier: "routine", mode: "living", onPath: () => true, seen: {} }).offered).toEqual([]);
    st.chars.willow.tier = "peri";
    const r2 = buildRoster({ state: st, records, userName: "Gabriel" });
    expect(elsewhereLane({ state: st, arrivals: [carrier], roster: r2, now: 3 * DAY + 700, at: 12, tier: "charged", mode: "living", onPath: () => true, seen: {} }).offered).toEqual([]);
    const l = elsewhereLane({ state: st, arrivals: [carrier], roster: r2, now: 3 * DAY + 700, at: 12, tier: "routine", mode: "living", onPath: () => true, seen: {} });
    expect(l.text).toContain("May come up, if it fits: Willow knows: Giles is coming");
  });
  test("an arrival counts as delivered only when the reply takes it up", () => {
    const { st, records } = world();
    const r = buildRoster({ state: st, records, userName: "Gabriel" });
    const a = base({ status: "offered", offered: [12], text: "Police sirens wail two streets over, heading toward Revello Drive" });
    confirmArrivals([a], { prose: "Buffy stirred her tea.", roster: r, at: 13 });
    expect(a.status).toBe("expired");
    const b = base({ status: "offered", offered: [12], kind: "trace", text: "Police sirens wail two streets over, heading toward Revello Drive" });
    confirmArrivals([b], { prose: "Somewhere toward Revello Drive, police sirens began to wail, two streets over.", roster: r, at: 13 });
    expect(b.status).toBe("used");
    expect(coverage("sirens over Revello", "nothing here")).toBe(0);
  });
  test("a secret stays off the page unless it slips", () => {
    const { st, records } = world();
    const r = buildRoster({ state: st, records, userName: "Gabriel" });
    const arc = { id: "w", kind: "decline", lead: "Willow", cast: [], premise: "", want: "to stay in control", fear: "", grounds: ["x"], secrecy: "secret", clock: { cur: 1, max: 6 }, tally: { win: 0, cost: 0, loss: 0 }, heat: 1, stage: "setup", beats: [], nextAbs: 0, status: "running", by: "engine", startedAbs: 0, startedMsg: 0 } as any;
    const o = { arc, lead: r.find("Willow"), roster: r, routes: ["carrier", "signal"] as any, text: "Willow leaned on it", atAbs: 3 * DAY, result: "loss", recentKinds: [], onstage: r.actors.filter((a) => a.ring === "onstage") };
    expect(routeFor(o)).toBeNull();
    expect(routeFor({ ...o, slip: true })?.kind).toBeDefined();
  });
});

describe("the telling's validator", () => {
  const { st, records } = world();
  const r = buildRoster({ state: st, records, userName: "Gabriel Winters" });
  const ctx = { userName: "Gabriel Winters", roster: r, offPage: [{ key: "heaven", statement: "Buffy was in Heaven", words: ["Heaven"], keepers: ["buffy"], by: "user" as const }], truths: [], recent: [], places: ["Sunnydale", "Revello Drive"], objects: [] };
  const card = { id: "b1", arcId: "giles", kind: "return" as const, lead: "Giles", cast: ["Willow"], result: "cost" as const, roll: [4, 5] as [number, number], mod: 0, stage: "setup" as const, clock: "1/6", atAbs: 0, premise: "Giles hears Buffy is back", want: "to see Buffy", fear: "", leadText: "", knows: [], noRoute: [], grounds: [], template: "t", line: 0 };
  test("keeps an honest beat", () => {
    const v = validateTold(card, { result: "cost", text: "After Willow's call, Giles booked the first flight to Sunnydale; it doesn't leave until tomorrow.", lines: ["know Giles: #buffy-alive Buffy is alive | told by Willow, by phone · knows", "know Dawn: #x y | told by Giles · knows"] }, ctx);
    expect(v.rejected).toBeUndefined();
    expect(v.lines).toEqual(["know Giles: #buffy-alive Buffy is alive | told by Willow, by phone · knows"]);
  });
  test("rejects a new name, a decision for the player, a secret, a changed outcome, an irreversible end", () => {
    expect(validateTold(card, { result: "cost", text: "Giles called his old friend Ethan for help." }, ctx).rejected).toContain("Ethan");
    expect(validateTold(card, { result: "cost", text: "Giles phoned, and Gabriel agreed to meet him." }, ctx).rejected).toContain("decides for");
    expect(validateTold(card, { result: "cost", text: "Giles learned where she had been: Heaven." }, ctx).rejected).toContain("off-page");
    expect(validateTold(card, { result: "win", text: "Giles booked a flight." }, ctx).rejected).toContain("decided cost");
    expect(validateTold(card, { result: "cost", text: "Giles booked a flight, and Willow died that night." }, ctx).rejected).toContain("irreversible");
  });
});
