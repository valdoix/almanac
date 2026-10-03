// Elsewhere (design/09): the world off the page.
import { describe, expect, test } from "bun:test";
import { parseLine } from "../src/core/dsl";
import { emptyState, Folder } from "../src/core/state";
import type { CodexRecord } from "../src/core/codex";
import type { CharacterState, FactState, WorldState } from "../src/core/types";
import { buildRoster, readStanding, storyTown } from "../src/core/elsewhere/roster";
import { spreadNews } from "../src/core/elsewhere/news";
import { asWant, gate, seedCandidates, threadLatest } from "../src/core/elsewhere/arcs";
import { authorArc, tick, tieCard } from "../src/core/elsewhere/storyteller";
import { bearingsOn, conditionsFor, settled, webMod } from "../src/core/elsewhere/web";
import { collapseMessages, confirmArrivals, coverage, elsewhereLane, expireArrivals, retellArrival, routeFor, soughtOf, upgradeArrival, type Arrival } from "../src/core/elsewhere/crossings";
import { usesGone, validateProfile, validateTold } from "../src/core/elsewhere/telling";
import { beatTemplate, endTemplate, kindForStory, kindFromText, stageOf, wantFromStory } from "../src/core/elsewhere/grammar";
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

  test("a model profile is a companion only when the lore is an animal, and wants no placeholder", () => {
    const spike = "Spike is a vampire, over a century old, formerly William the Bloody.";
    const p = validateProfile({ key: "spike", standing: "companion", reach: "town", want: "…", fear: "…", nocturnal: true }, "h", spike)!;
    expect(p.standing).toBeUndefined();
    expect(p.want).toBeUndefined();
    expect(p.fear).toBeUndefined();
    expect(p.nocturnal).toBe(true);
    expect(validateProfile({ standing: "companion" }, "h", "Ruth is a fat, orange tabby cat who belongs to Gabriel Winters.")!.standing).toBe("companion");
    expect(validateProfile({ standing: "away", want: "to find Dawn" }, "h", spike)).toMatchObject({ standing: "away", want: "find Dawn" });
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

  test("new subplots can be proposed to the player instead, or not made at all", () => {
    const { st, records } = world();
    st.factions = { "fac:hellions": { id: "fac:hellions", name: "Hellions", clocks: { raid: { name: "raid Sunnydale", cur: 2, max: 6, history: [] } } } };
    const inp = { chatId: "c", tickId: "w30", state: st, records, userName: "Gabriel", mode: "living" as const, canonGravity: "light" as const, fates: "ask" as const, genres: [], from: 2 * DAY + 600, now: 3 * DAY + 300, anchorIndex: 11, offPage: [], recentArrivals: [] };
    const ask = tick({ ...inp, seeding: "ask" });
    // Nothing starts: the seeds wait as proposals, each with its grounds and the line acceptance writes.
    expect(ask.lines.some((l) => l.startsWith("arc new"))).toBe(false);
    expect(ask.seeded).toEqual([]);
    const hell = ask.proposals.find((p) => p.lead === "Hellions")!;
    expect(hell).toMatchObject({ kind: "threat", grounds: ["fac:hellions"], why: "Hellions's clock" });
    expect(parseLine(hell.line)!.op).toBe("arc");
    // The telling still polishes them: a seed card for each, pointing at its proposal.
    expect(ask.cards.filter((c) => c.seed).map((c) => c.proposal)).toEqual(ask.proposals.map((p) => p.id));
    // Declined, it isn't proposed again; a lead with one waiting gets no second.
    const again = tick({ ...inp, seeding: "ask", proposalKeys: [hell.key] });
    expect(again.proposals.some((p) => p.key === hell.key)).toBe(false);
    const waiting = tick({ ...inp, seeding: "ask", proposalKeys: ["lead:hellions"], pendingProposals: 1 });
    expect(waiting.proposals.some((p) => p.lead === "Hellions")).toBe(false);
    // What a proposal shows reads cleanly.
    expect(asWant("shoes for Saturday; to understand her legal options", "")).toBe("to get shoes for Saturday");
    expect(asWant("guide Buffy from afar", "")).toBe("to guide Buffy from afar");
    expect(threadLatest("; latest: unblock; Dawn asleep through the night; stalls: 0")).toBe("unblock; Dawn asleep through the night");
    expect(tick({ ...inp, seeding: "off" }).proposals).toEqual([]);
    expect(tick({ ...inp, seeding: "off" }).lines.some((l) => l.startsWith("arc new"))).toBe(false);
  });

  test("the engine's words name what happened, then where it leaves things", () => {
    expect(beatTemplate({ kind: "return", lead: "Giles", want: "to see Buffy with his own eyes", stage: "setup", result: "win", news: "Buffy is alive again", town: "Sunnydale" }))
      .toBe("Giles heard that Buffy is alive again. Giles is thinking of coming back to Sunnydale.");
    expect(beatTemplate({ kind: "rivalry", lead: "Cordelia", want: "to come out on top", stage: "rising", result: "loss", worse: "the other side struck back", cast: "Harmony" }))
      .toBe("Cordelia raised the stakes with Harmony. The other side struck back.");
    expect(beatTemplate({ kind: "threat", lead: "Hellions", group: true, want: "to raid Sunnydale", stage: "rising", result: "cost", price: "one of theirs was hurt", town: "Sunnydale" }))
      .toBe("The Hellions struck at Sunnydale. One of theirs was hurt.");
    expect(endTemplate({ kind: "investigation", lead: "Witches' Circle", group: true, want: "to judge what Willow did", fear: "", result: "met" }))
      .toBe("The Witches' Circle concluded the investigation. In the end, the Witches' Circle managed to judge what Willow did.");
    expect(endTemplate({ kind: "return", lead: "Giles", want: "to come back", fear: "they come back too late", result: "lost" })).toBe("It went badly for Giles. Giles came back too late.");
    // An archivist's blank is no want.
    expect(asWant("Unknown — last seen at the wall by the window", "to stay in control")).toBe("to stay in control");
  });

  test("a lawsuit isn't a romance, and no romance is seeded with a child or within a family", () => {
    expect(kindFromText("court option (civil/criminal/recovery) to be decided by Buffy and Dawn")).not.toBe("courtship");
    expect(kindFromText("Jonathan supervising audit personally")).toBe("investigation");
    const { st, records } = world();
    st.bonds = { "x": { from: "willow", to: "dawn", axes: { attraction: 3 } } as any };
    records.find((x) => x.id === "char:dawn")!.summary = "Dawn is Buffy's fifteen-year-old sister.";
    const r = buildRoster({ state: st, records, userName: "Gabriel" });
    const dawn = r.find("Dawn")!;
    dawn.ring = "offstage";
    const kinds = seedCandidates({ state: st, roster: r, records, awake: r.actors.filter((a) => a.ring !== "onstage"), arcs: [], canonGravity: "light", genres: [], now: 3 * DAY });
    expect(kinds.some((c) => c.kind === "courtship")).toBe(false);
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
  test("a subplot leaves one message waiting: a later call replaces an unseen missed call", () => {
    const first = base({ id: "a", arc: "jon", kind: "trace", place: [], lead: "Jonathan", why: "the call went unanswered", text: "A missed call from Jonathan, and a message: a dangerous contact", atAbs: 5245 });
    const second = base({ id: "b", arc: "jon", kind: "signal", medium: "phone", lead: "Jonathan", text: "A call from Jonathan: the archive owed him a favour", atAbs: 5252 });
    const news = base({ id: "n", arc: "jon", kind: "trace", place: ["Magic Box"], text: "At Magic Box, there are signs of it" });
    expect(collapseMessages([first, second, news]).map((x) => x.id)).toEqual(["a"]);
    expect(first.status).toBe("expired");
    expect([second.status, news.status]).toEqual(["pending", "pending"]);
  });
  test("a waiting message reaches a charged scene with no room left, and counts once the reply shows it", () => {
    const { st, records } = world();
    const r = buildRoster({ state: st, records, userName: "Gabriel" });
    const news = base({ id: "n", kind: "ambient", text: "Sirens two streets over", place: [], offered: [12], status: "offered" });
    const msg = base({ id: "m", arc: "jon", kind: "trace", place: [], lead: "Willow", why: "the call went unanswered", text: "A missed call from Willow, and a message: she found the archive ledger for the audit" });
    const l = elsewhereLane({ state: st, arrivals: [news, msg], roster: r, now: 3 * DAY + 700, at: 13, tier: "charged", mode: "quiet", onPath: () => true, seen: {}, userName: "Gabriel" });
    expect(l.offered).toContain("m");
    expect(l.text).toContain("Comes in this reply, for Gabriel: A missed call from Willow");
    // Texting someone else isn't the call; the call shown is.
    confirmArrivals([msg], { prose: "Dawn's phone buzzes with Willow's texts again.", roster: r, at: 14 });
    expect(msg.status).toBe("pending");
    msg.status = "offered";
    confirmArrivals([msg], { prose: "Gabriel's phone shows a missed call. Willow's voicemail: she found the ledger in the archive.", roster: r, at: 15 });
    expect(msg.status as string).toBe("used");
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
  test("an insistent or world-led story lets news into a charged scene, with one more a scene; never an intimate or pivotal one", () => {
    const { st, records } = world();
    st.chars.willow.tier = "peri";
    const r = buildRoster({ state: st, records, userName: "Gabriel" });
    const lane = (tier: "charged" | "pivotal", press: { texture?: string; initiative?: string }) => {
      const carrier = base({ id: "k", kind: "carrier", carrier: "Willow", text: "Willow knows: Giles is coming" });
      const news = base({ id: "n", kind: "ambient", place: [], text: "Sirens two streets over" });
      const third = base({ id: "t", kind: "ambient", place: [], text: "The power flickers across the block" });
      return elsewhereLane({ state: st, arrivals: [carrier, news, third], roster: r, now: 3 * DAY + 700, at: 12, tier, mode: "living", onPath: () => true, seen: {}, ...press }).offered;
    };
    expect(lane("charged", {})).toEqual([]);
    expect(lane("charged", { texture: "living", initiative: "player_led" })).toEqual([]);
    expect(lane("charged", { texture: "insistent" })).toEqual(["k", "n"]);
    expect(lane("charged", { initiative: "world_led" })).toEqual(["k", "n"]);
    expect(lane("pivotal", { texture: "insistent" })).toEqual([]);
    st.mode = "intimacy";
    expect(lane("charged", { texture: "insistent" })).toEqual([]);
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
  test("someone the subplot's earlier steps or its own arrival already name may be named again", () => {
    const c = { ...card, lead: "Giles", cast: [], premise: "Giles means to see Buffy okay.", want: "to see Buffy okay", template: "Giles kept at it. It strained a friendship." };
    const told = { result: "cost", text: "Giles pushed Willow for straight answers about Buffy, and Willow pushed back just as hard." };
    expect(validateTold(c, told, ctx).rejected).toBe("names Willow, who isn't on the card");
    expect(validateTold({ ...c, sofar: ["Giles fixed the porch step at dawn. Willow noticed him there."] }, told, ctx).rejected).toBeUndefined();
    expect(validateTold({ ...c, arrival: "Willow has heard from Giles: he kept at it." }, told, ctx).rejected).toBeUndefined();
  });

  test("a street word goes with its name: a known street passes, an invented one still doesn't", () => {
    const c = { ...card, template: "Giles asked a dealer on Seventh about flights." };
    expect(validateTold(c, { result: "cost", text: "Giles bought the ticket from a dealer on Seventh Street, with money he couldn't spare." }, ctx).rejected).toBeUndefined();
    expect(validateTold(c, { result: "cost", text: "Giles bought the ticket from a dealer on Kingman Street." }, ctx).rejected).toBe("a new name: Kingman");
  });

  test("rejects a new name, a decision for the player, a secret, a changed outcome, an irreversible end", () => {
    expect(validateTold(card, { result: "cost", text: "Giles called his old friend Ethan for help." }, ctx).rejected).toContain("Ethan");
    expect(validateTold(card, { result: "cost", text: "Giles phoned, and Gabriel agreed to meet him." }, ctx).rejected).toContain("decides for");
    expect(validateTold(card, { result: "cost", text: "Giles learned where she had been: Heaven." }, ctx).rejected).toContain("off-page");
    // A near miss on the label keeps the words (the model priced a win); the opposite outcome doesn't.
    expect(validateTold(card, { result: "win", text: "Giles booked a flight." }, ctx).rejected).toBeUndefined();
    expect(validateTold({ ...card, result: "win" }, { result: "loss", text: "Giles couldn't get a flight." }, ctx).rejected).toContain("decided win");
    expect(validateTold(card, { result: "cost", text: "Giles booked a flight, and Willow died that night." }, ctx).rejected).toContain("irreversible");
  });
  test("what the lead's own lore names is no new name; the people it names still need the card", () => {
    const lead = { ...card, leadText: "Rupert Giles, a Watcher — Oxford man, ex-Ripper, friend of Ethan Rayne." };
    expect(validateTold(lead, { result: "cost", text: "Giles called in a favour from an Oxford archive." }, ctx).rejected).toBeUndefined();
    expect(validateTold(lead, { result: "cost", text: "Giles called in a favour from a Harvard archive." }, ctx).rejected).toContain("Harvard");
  });
  test("a secret's word the card itself says isn't the secret", () => {
    const own = { ...card, premise: "Giles is reading Heaven's Gate records for Buffy" };
    expect(validateTold(own, { result: "cost", text: "Giles found Heaven's Gate records in an archive." }, ctx).rejected).toBeUndefined();
  });
});

describe("a told step's arrival", () => {
  test("a call and a missed call's message carry the told words, not the draft", () => {
    const call = { id: "c", msgId: "m", swipe: 0, kind: "signal" as const, medium: "phone", lead: "Callum", arc: "x", status: "pending" as const, offered: [], text: "A call from Callum: Callum set out to keep playing. It left a favour owed.", template: "A call from Callum: Callum set out to keep playing. It left a favour owed." };
    retellArrival(call, "Callum set out to keep playing. It left a favour owed.", "Clara interrupted Callum's practice; he owes her a favour.");
    expect(call.text).toBe("A call from Callum: Clara interrupted Callum's practice; he owes her a favour.");
    const missed = { ...call, id: "d", kind: "trace" as const, why: "the call went unanswered", text: "A missed call from Callum, and a message: draft", template: "A missed call from Callum, and a message: draft" };
    retellArrival(missed, "nope", "Clara interrupted Callum's practice.", "Gabriel's phone rings.");
    expect(missed.text).toBe("A missed call from Callum, and a message: Clara interrupted Callum's practice.");
  });
});

describe("the player's own stories", () => {
  test("the kind comes from what the lead does, not from what they talk about", () => {
    const valeria = "Valeria is speaking to the Witches' Circle about Willow Rosenberg and the dark magic she witnessed in Buffy and how Willow threw Gabriel to a wall. The Witches' Circle holds their investigation.";
    expect(kindForStory(valeria, ["Valeria"], ["Willow Rosenberg", "Willow", "Buffy"])).toBe("investigation");
    expect(kindForStory("Spike is searching for Dawn.", ["Spike"], ["Dawn"])).toBe("pursuit");
    expect(kindForStory("Willow is drawn deeper into dark magic and hides it from Tara.", ["Willow"], ["Tara"])).toBe("decline");
    expect(wantFromStory("Spike is searching for Dawn.")).toBe("to find Dawn");
    expect(wantFromStory("Spike wants the chip out and is asking the wrong people")).toBeNull();
  });

  test("every field of an arc set line counts, the first one too", () => {
    expect(parseLine("arc set #a: bring: yes | next: 10")!.args.fields).toEqual({ bring: "yes", next: "10" });
    expect(parseLine("arc set #a: fate: accept")!.args.fields).toEqual({ fate: "accept" });
    expect(parseLine("arc set #a: premise: X | want: to y")!.args.fields).toEqual({ premise: "X", want: "to y" });
    expect(parseLine("arc new #a: decline | lead: Willow")!.args.head).toBe("decline");
  });

  const spikeWorld = () => {
    const w = world();
    w.records.push(person("char:spike", "Spike", "Spike is a vampire in Sunnydale, over a century old."));
    w.st.time = { day: 4, minute: 12 * 60 };
    return w;
  };
  const arc = (o: any) => ({ id: "spike_pursuit", kind: "pursuit", lead: "Spike", cast: ["Dawn"], premise: "Spike is searching for Dawn.", want: "to find Dawn", fear: "he failed her", grounds: ["char:spike", "player"], secrecy: "private", clock: { cur: 0, max: 6 }, tally: { win: 0, cost: 0, loss: 0 }, heat: 2, stage: "setup", beats: [], nextAbs: 3 * DAY + 720, status: "running", by: "player", locked: true, startedAbs: 3 * DAY + 700, startedMsg: 10, ...o }) as any;
  const inp = (st: WorldState, records: CodexRecord[], o: any = {}) => ({ chatId: "c", tickId: "w1", state: st, records, userName: "Gabriel", mode: "restless" as const, canonGravity: "off" as const, fates: "ask" as const, genres: [], from: 3 * DAY + 720, now: 3 * DAY + 720, anchorIndex: 11, offPage: [], recentArrivals: [], ...o });

  test("a story starts pushed, and a push moves it now, even out of the lead's hours", () => {
    const { st, records } = spikeWorld();
    const r = buildRoster({ state: st, records, userName: "Gabriel" });
    expect(r.find("Buffy")!.nocturnal).toBe(false);
    expect(r.find("Spike")!.nocturnal).toBe(true);
    const line = authorArc({ roster: r, name: "Spike", premise: "Spike is searching for Dawn.", now: 3 * DAY + 720, arcs: [] })!;
    expect(line).toMatch(/^arc new #spike_pursuit: pursuit \| lead: Spike \| cast: Dawn \| secrecy: private .*want: to find Dawn .*by: player \| push: yes$/);
    // Unpushed, a vampire waits for dark, and the page is told why.
    const held = gate(arc({}), r.find("Spike"), r, { from: 3 * DAY + 600, now: 3 * DAY + 720, rand: rng("x") });
    expect(held).toMatchObject({ ok: false, wait: "Spike keeps night hours" });
    expect(held.deferTo! % DAY).toBe(19 * 60);
    // Pushed (a nudge, or the story just written), it happens now, by day, at a disadvantage.
    st.arcs = { spike_pursuit: arc({ push: true }) };
    const t = tick(inp(st, records));
    expect(t.lines.some((l) => l.startsWith("arc beat #spike_pursuit:"))).toBe(true);
    const card = t.cards.find((c) => c.arcId === "spike_pursuit")!;
    expect(card.offHours).toContain("keeps night hours");
    expect(card.sofar).toEqual([]);
  });

  test("a forced step comes out as the player chose, now, even while it would wait for news", () => {
    for (const force of ["win", "cost", "loss", "twist"] as const) {
      const { st, records } = spikeWorld();
      st.arcs = { spike_pursuit: arc({ force, push: true, grounds: ["#unheard"] }) };
      const t = tick(inp(st, records));
      const line = t.lines.find((l) => l.startsWith("arc beat #spike_pursuit:"))!;
      expect(line).toContain("forced: yes");
      if (force === "twist") expect(line).toMatch(/\| twist: /);
      else {
        expect(line).toMatch(new RegExp(`^arc beat #spike_pursuit: ${force} \\|`));
        expect(t.cards.find((c) => c.arcId === "spike_pursuit")!.result).toBe(force);
      }
      // Folded, the beat is marked and the choice is spent.
      const f = new Folder({ userName: "Gabriel", strictness: "strict", sealed: false }, st);
      f.applyMessage(12, "m12", 0, { ops: [], unknown: [], format: "none", truncated: false }, "model", t.lines.map((l) => parseLine(l)).filter(Boolean).map((o) => ({ ...o!, src: "sim" as const })));
      const after = f.state.arcs!.spike_pursuit;
      expect(after.force).toBeUndefined();
      expect(after.beats.at(-1)!.forced).toBe(true);
    }
  });

  test("moving the world a step moves something, even a subplot just nudged", () => {
    const { st, records } = spikeWorld();
    st.chars.willow.place = "Sunnydale";
    st.arcs = { willow_x: arc({ id: "willow_x", lead: "Willow", cast: [], nextAbs: 3 * DAY + 720, startedAbs: 3 * DAY + 500 }) };
    // The old window started at the cooldown, so a step "now" had no time in it.
    const forced = tick(inp(st, records, { from: 3 * DAY + 600, forced: true, tickId: "w1f1" }));
    expect(forced.lines.some((l) => l.startsWith("arc beat #willow_x:"))).toBe(true);
  });

  test("a search doesn't call into the scene where its quarry is, from someone who doesn't know the player", () => {
    const { st, records } = spikeWorld();
    const r = buildRoster({ state: st, records, userName: "Gabriel" });
    const spike = r.find("Spike")!;
    const dawn = r.find("Dawn")!;
    spike.ties.push({ to: dawn.key, strength: 2, kind: "situation" });
    dawn.ring = "onstage";
    const a = arc({ clock: { cur: 1, max: 6 } });
    expect(soughtOf(a, r).map((x) => x.name)).toEqual(["Dawn"]);
    const o = { arc: a, lead: spike, roster: r, routes: ["carrier", "entrance", "signal"] as any, text: "Spike worked the phones for word of Dawn", atAbs: 3 * DAY + 720, result: "cost", recentKinds: [], onstage: [dawn] };
    // Before: Dawn on the page made a call from Spike "about the stage"; she can't carry it either.
    expect(routeFor(o)).toBeNull();
    // An ending that finds her may walk in; one that doesn't, can't.
    const end = { ...o, arc: arc({ clock: { cur: 5, max: 6 } }), ending: true };
    expect(routeFor({ ...end, result: "met" })?.kind).toBe("entrance");
    expect(routeFor({ ...end, result: "lost" })).toBeNull();
    // Someone in the scene Spike does know takes the call, and it says so.
    const buffy = r.find("Buffy")!;
    spike.ties.push({ to: buffy.key, strength: 2, kind: "bond" });
    const call = routeFor({ ...o, onstage: [dawn, buffy], routes: ["signal"] as any });
    expect(call).toMatchObject({ kind: "signal", to: "Buffy" });
    expect(call!.text).toBe("a letter from Spike in Sunnydale, for Buffy: Spike worked the phones for word of Dawn");
  });

  test("a call left for the player by someone who doesn't know them is dropped; the quarry isn't credited with the search", () => {
    const { st, records } = spikeWorld();
    st.arcs = { spike_pursuit: arc({ beats: [{ msgIndex: 11, atAbs: 3 * DAY + 700, result: "cost", text: "Spike worked the phones for word of Dawn" }] }) };
    const r = buildRoster({ state: st, records, userName: "Gabriel" });
    const missed: Arrival = { id: "m", msgId: "m1", swipe: 0, kind: "trace", medium: "phone", arc: "spike_pursuit", lead: "Spike", text: "A missed call from Spike, and a message: he had news of Dawn", place: [], status: "pending", offered: [], atAbs: 3 * DAY + 700, untilAbs: 3 * DAY + 3000 };
    const l = elsewhereLane({ state: st, arrivals: [missed], roster: r, now: 3 * DAY + 720, at: 12, tier: "routine", mode: "living", onPath: () => true, seen: {}, userName: "Gabriel" });
    expect(l.offered).toEqual([]);
    expect(missed.status).toBe("expired");
    expect(l.expired[0].why).toBe("Spike doesn't know Gabriel");
    expect(l.text).not.toContain("word of Dawn");
  });

  test("the telling can't find the quarry before the search ends", () => {
    const { st, records } = spikeWorld();
    const r = buildRoster({ state: st, records, userName: "Gabriel Winters" });
    const ctx = { userName: "Gabriel Winters", roster: r, offPage: [], truths: [], recent: [], places: ["Sunnydale"], objects: [] };
    const c = { id: "b1", arcId: "spike_pursuit", kind: "pursuit" as const, lead: "Spike", cast: ["Dawn"], sought: ["Dawn"], result: "win" as const, roll: [5, 5] as [number, number], mod: 0, stage: "rising" as const, clock: "2/6", atAbs: 0, premise: "Spike is searching for Dawn.", want: "to find Dawn", fear: "", leadText: "", knows: [], noRoute: [], grounds: [], template: "t", line: 0 };
    expect(validateTold(c, { result: "win", text: "Spike tracked Dawn down to a big house across town." }, ctx).rejected).toContain("finds Dawn");
    expect(validateTold(c, { result: "win", text: "Spike found no sign of Dawn at the mall, but a snitch swore she'd been seen on the bus." }, ctx).rejected).toBeUndefined();
    expect(validateTold({ ...c, result: "met", ending: true }, { result: "met", text: "Spike found Dawn at last." }, ctx).rejected).toBeUndefined();
  });

  test("a decline's engine words name what is leaned on; a win is headway", () => {
    expect(beatTemplate({ kind: "decline", lead: "Willow", want: "to stay in control", stage: "setup", result: "win", premise: "Willow is drawn deeper into dark magic" })).toBe("Willow leaned on dark magic a little. Nobody has noticed yet.");
  });
});

describe("subplots that share a person bear on each other", () => {
  const witches = () => {
    const { st, records } = world();
    st.chars.tara = char("tara", "Tara", { tier: "off", place: "Sunnydale" });
    st.chars.valeria = char("valeria", "Valeria", { tier: "off", place: "Sunnydale" });
    records.push(person("char:tara", "Tara", "Tara Maclay is a witch and Willow's girlfriend."), person("char:valeria", "Valeria", "Valeria is a witch of the Witches' Circle."));
    return { st, records, r: buildRoster({ state: st, records, userName: "Gabriel" }) };
  };
  const mk = (o: any) => ({ kind: "decline", cast: [], premise: "", want: "to stay in control", fear: "she hits bottom", grounds: ["x"], secrecy: "secret", clock: { cur: 1, max: 6 }, tally: { win: 0, cost: 0, loss: 0 }, heat: 1, stage: "rising", beats: [], nextAbs: 0, status: "running", by: "engine", startedAbs: 2 * DAY, startedMsg: 0, ...o }) as any;
  const beat = (atAbs: number, result: string, text: string) => ({ atAbs, roll: [3, 3], mod: 0, result, text, told: "model", msgIndex: 5 });

  test("what a step takes from someone stands, until a step gives it back; what is only meant or nearly done doesn't", () => {
    const { r } = witches();
    expect(settled("Valeria completed the stripping ritual and took Willow's magic as the Circle commanded.", r).map((s) => [s.person.name, s.thing, s.gone])).toEqual([["Willow", "magic", true]]);
    expect(settled("The ritual held, Willow's magic is gone, and the Circle is satisfied.", r)[0]?.gone).toBe(true);
    expect(settled("Willow is now without her powers.", r)[0]?.thing).toBe("powers");
    expect(settled("The Circle sent Valeria to take away Willow's magic.", r)).toEqual([]);
    expect(settled("Valeria began stripping Willow's magic, but stopped short of finishing.", r)).toEqual([]);
    expect(settled("Willow got her magic back at last.", r)[0]?.gone).toBe(false);
    const ev = (atAbs: number, text: string) => ({ arcId: "v", lead: "Valeria", kind: "duty" as const, result: "met", text, atAbs });
    const willow = [r.find("Willow")!];
    expect(conditionsFor(willow, [ev(100, "Valeria took Willow's magic.")], 200).map((c) => c.text)).toEqual(["Willow's magic is gone"]);
    expect(conditionsFor(willow, [ev(100, "Valeria took Willow's magic."), ev(150, "Willow regained her magic.")], 200)).toEqual([]);
    // Only as of the step's own time.
    expect(conditionsFor(willow, [ev(300, "Valeria took Willow's magic.")], 200)).toEqual([]);
  });

  test("a subplot out against someone turns their next roll by how it went; one on their side, the other way", () => {
    const { r } = witches();
    const duty = mk({ id: "valeria_duty", kind: "duty", lead: "Valeria", cast: ["Willow", "Tara"], want: "to take away Willow's magic as the Circle commanded", beats: [beat(2 * DAY + 600, "win", "Valeria took Willow's magic.")] });
    const decline = mk({ id: "willow_decline", lead: "Willow", cast: ["Tara"], beats: [beat(2 * DAY + 300, "loss", "Willow reached for dark magic again.")] });
    const help = mk({ id: "tara_help", kind: "pursuit", lead: "Tara", cast: ["Willow"], want: "to help Willow without enabling her", beats: [beat(2 * DAY + 100, "cost", "Tara asked Willow to stop.")] });
    const bs = bearingsOn(decline, [duty, decline, help], r, 3 * DAY);
    expect(bs.find((b) => b.arcId === "valeria_duty")).toMatchObject({ stance: "against", dir: "theirs", person: "Willow", fresh: true, mod: -1 });
    // Tara's step came before Willow's last one: it's context, not a pull.
    expect(bs.find((b) => b.arcId === "tara_help")).toMatchObject({ stance: "for", fresh: false, mod: 0 });
    expect(webMod(bs)).toEqual({ mod: -1, why: ["Valeria's duty went against Willow"] });
    // Tara's own subplot is on Willow's side: Willow's setback after Tara's last step is Tara's setback too.
    const tb = bearingsOn(help, [duty, decline, help], r, 3 * DAY);
    expect(tb.find((b) => b.arcId === "willow_decline")).toMatchObject({ stance: "for", dir: "mine", mod: -1 });
    // Someone in two casts is no tie; a dropped subplot no longer moves anyone.
    const other = mk({ id: "x", kind: "pursuit", lead: "Dawn", cast: ["Tara"], beats: [beat(2 * DAY + 900, "win", "Dawn found the book.")] });
    expect(bearingsOn(mk({ id: "y", lead: "Willow", cast: ["Tara"] }), [other], r, 3 * DAY)).toEqual([]);
    expect(bearingsOn(decline, [{ ...duty, status: "dropped" }], r, 3 * DAY)).toEqual([]);
  });

  test("an ending shakes the subplots tied to it; their cards carry what stands and what the others did", () => {
    const { st, records } = witches();
    st.time = { day: 3, minute: 14 * 60 };
    st.arcs = {
      valeria_duty: mk({ id: "valeria_duty", kind: "duty", lead: "Valeria", cast: ["Willow", "Tara"], want: "to take away Willow's magic as the Circle commanded", clock: { cur: 5, max: 6 }, stage: "crisis", force: "win", push: true, beats: [beat(3 * DAY + 300, "cost", "Valeria began the ritual, but stopped short.")] }),
      willow_decline: mk({ id: "willow_decline", lead: "Willow", cast: ["Tara"], premise: "Willow is drawn deeper into dark magic.", nextAbs: 5 * DAY, beats: [beat(3 * DAY + 200, "loss", "Willow reached for dark magic again.")] }),
    };
    const t = tick({ chatId: "c", tickId: "w9", state: st, records, userName: "Gabriel", mode: "living", canonGravity: "light", fates: "allow", genres: [], from: 3 * DAY + 600, now: 3 * DAY + 840, anchorIndex: 11, offPage: [], recentArrivals: [], seeding: "off" });
    expect(t.lines.some((l) => l.startsWith("arc end #valeria_duty:"))).toBe(true);
    // Willow's decline is pulled forward with its stakes raised.
    const shake = t.lines.find((l) => l.startsWith("arc set #willow_decline:"))!;
    expect(shake).toMatch(/next: \d+ \| heat: 2/);
    expect(Number(/next: (\d+)/.exec(shake)![1])).toBeLessThan(5 * DAY);
    // The ending's card knows Willow's own subplot.
    expect(t.cards.find((c) => c.arcId === "valeria_duty" && c.ending)!.meanwhile!.join(" ")).toContain("Willow's decline");
    // A step of Willow's after the stripping gets what stands, as new.
    const taken = { ...st.arcs.valeria_duty, status: "resolved", ending: { result: "met", text: "Valeria completed the stripping ritual and took Willow's magic.", atAbs: 3 * DAY + 700 } } as any;
    const card = tieCard({ arcId: "willow_decline", atAbs: 3 * DAY + 900 } as any, st.arcs.willow_decline, [taken, st.arcs.willow_decline], buildRoster({ state: st, records, userName: "Gabriel" }));
    expect(card.stands).toEqual(["Willow's magic is gone (from Valeria's duty) [new since this subplot's last step: this step follows from it]"]);
    expect(card.meanwhile![0]).toMatch(/^Valeria's duty \(against Willow\), ended: .* \[since this subplot's last step\]$/);
    expect(card.gone).toEqual([{ person: "Willow", thing: "magic" }]);
  });

  test("a telling where someone uses what was taken is set aside; missing it is fine", () => {
    const c = { gone: [{ person: "Willow", thing: "magic" }] };
    expect(usesGone(c, "Willow cast a ward over the house anyway.")).toContain("Willow uses the magic");
    expect(usesGone(c, "Willow tried to cast and nothing came.")).toBeNull();
    expect(usesGone(c, "Willow craved the magic she no longer has.")).toBeNull();
    expect(usesGone(c, "Tara cast a ward over the house.")).toBeNull();
  });

  test("the engine's words for a decline whose means were taken are the want of it", () => {
    const w = { kind: "decline" as const, lead: "Willow", want: "to stay in control", stage: "rising" as const, result: "win" as const, premise: "Willow is drawn into dark magic." };
    expect(beatTemplate({ ...w, without: { person: "Willow", thing: "magic" } })).toBe("Willow went looking for a way to get the magic back. Nobody has seen how bad it is yet.");
    expect(beatTemplate({ ...w, kind: "rift", lead: "Tara", cast: "Willow", without: { person: "Willow", thing: "magic" } })).toMatch(/^With Willow's magic gone, Tara /);
  });
});
