// 1.28: the canon cutoff, swipe autopsy, the inbox of facts read from the player's messages,
// belongings and rooms, callbacks when they're due, promises with due dates, secret exposure,
// recurring days, conditions with a course, and character journals. Fixtures are invented;
// their shapes follow the user's chats (Buffy, Cersei, Jackie).
import { describe, expect, test } from "bun:test";
import { LedgerRuntime, sideKey, toPath, type RawChatMessage } from "../src/core/branch";
import type { FoldOptions } from "../src/core/state";
import { promiseWindow, promisesIn, vocative } from "../src/core/promises";
import { activeConditions, conditionWords, conditionsIn, courseOf, drinkFactor } from "../src/core/conditions";
import { allRecurring, dayLine, occurrences, recurringAside, ruleOf } from "../src/core/recurring";
import { buildCalendar, dateFor } from "../src/core/engines/calendar";
import { exposures } from "../src/core/secrets";
import { bitsSeen, dueBits } from "../src/core/callbacks";
import { belongingsOf, keptHere, nextOwner, roomsOf } from "../src/core/belongings";
import { cleanTerms, cutoffHits, cutoffLane, liveTerms, termPattern } from "../src/core/canon";
import { checkReply } from "../src/core/audit";
import { parseMessage } from "../src/core/dsl";
import { addLessons, lessonsLane, modelLessons, rulesLessons, ruleFor } from "../src/core/autopsy";
import { cleanEntry, dayOfMessages, writersFor } from "../src/core/journals";
import { filedKey, filedLine, playerOps } from "../src/core/player";
import { buildLedgerNote } from "../src/core/note";
import { MIN_PER_DAY } from "../src/core/util";

const OPTS: FoldOptions = { userName: "Gabriel", strictness: "strict", sealed: true, romance: "fast", playerFacts: "rules", startTime: { day: 1, minute: 18 * 60 } };
const msg = (i: number, content: string, isUser = false): RawChatMessage => ({ id: `m${i}`, index_in_chat: i, is_user: isUser, content, swipes: [content], swipe_id: 0 });
const reply = (i: number, lines: string, prose = "Prose.") => msg(i, `${prose}\n<ledger>\n${lines}\nmode: social\n</ledger>`);
const fold = (msgs: RawChatMessage[], opts: FoldOptions = OPTS, side = {}) => new LedgerRuntime().fold(toPath(msgs), opts, side);
const D = MIN_PER_DAY;

describe("promises said aloud", () => {
  const now = 1 * D + 18 * 60; // day 2 (abs 0 is day 1 00:00 in absMinutes? see util) — only relative use below
  test("windows for the times people say", () => {
    expect(promiseWindow("I'll call you tomorrow", now)!.when).toBe("tomorrow");
    const nine = promiseWindow("meet me at the Bronze at nine", now)!;
    expect(nine.when).toBe("at 21:00");
    expect(nine.from).toBe(now + 3 * 60 - 30);
    expect(promiseWindow("I'll be back in two hours", now)!.when).toBe("in two hours");
    expect(promiseWindow("I'll be right back", now)).toBeNull();
    expect(promiseWindow("see you tomorrow morning", now)!.when).toBe("tomorrow morning");
    expect(promiseWindow("I'll do it", now)).toBeNull();
  });
  test("promises, not plans, feelings or questions", () => {
    const who = () => "xander";
    const to = () => "buffy";
    const found = (t: string) => promisesIn([{ who: "Xander", text: t }], now, who, to);
    expect(found("I'll call you tomorrow, I promise.")[0]).toMatchObject({ who: "xander", whom: "buffy", kind: "call", what: "call buffy tomorrow" });
    expect(found("Meet me at the Bronze at nine.")[0]).toMatchObject({ kind: "meet" });
    expect(found("Will you call me tomorrow?")).toEqual([]);
    expect(found("I'll miss you tomorrow.")).toEqual([]);
    expect(found("I'll be right back.")).toEqual([]);
    expect(found("I won't call you tomorrow.")).toEqual([]);
  });
  test("a name said with the line is whom it's to", () => {
    expect(vocative("Buffy, I'll call you tomorrow", ["Willow", "Buffy"])).toBe("Buffy");
    expect(vocative("I'll be there at nine, Willow.", ["Willow", "Buffy"])).toBe("Willow");
    expect(vocative("I'll tell Buffy tomorrow", ["Buffy"])).toBeUndefined();
  });
  test("made in the player's message, due, then lapsed when the window closes with nothing said", () => {
    const chat = [
      reply(0, "cast: Xander@spot"),
      msg(1, `"I'll call you tomorrow, Xander. I promise."`, true),
      reply(2, "clock: +2h"),
    ];
    const st = fold(chat, { ...OPTS, sealed: false }).state;
    const p = Object.values(st.cons).find((c) => c.promise)!;
    expect(p).toMatchObject({ who: "user", whom: "xander", status: "open" });
    expect(p.what).toContain("call Xander tomorrow");
    const later = fold([...chat, reply(3, "clock: → Day 2 10:00")], { ...OPTS, sealed: false }).state;
    expect(Object.values(later.cons).find((c) => c.promise)!.status).toBe("due");
    const lapsed = fold([...chat, reply(3, "clock: → Day 3 09:00")], { ...OPTS, sealed: false }).state;
    expect(Object.values(lapsed.cons).find((c) => c.promise)).toMatchObject({ status: "resolved", promise: { lapsed: true } });
    expect(lapsed.bonds["xander>user"]).toBeUndefined();
  });
  test("stood up: the one it was made to waits at the place it named; broken, and the bond cools", () => {
    const st = fold([
      msg(0, `"Hi."`, true),
      reply(1, "cast: Willow@spot", `[spk=Willow#1]"Gabriel, I'll meet you at the library at nine."[/spk]`),
      reply(2, "clock: → Day 1 21:00\nat: Library\ncast: Gabriel@spot"),
      reply(3, "clock: → Day 1 23:30"),
    ], { ...OPTS, sealed: false }).state;
    expect(Object.values(st.cons).find((c) => c.promise)).toMatchObject({ who: "willow", whom: "user", status: "broken" });
    expect(st.bonds["user>willow"].axes).toMatchObject({ trust: -1, resentment: 1 });
  });
  test("plans and deferrals aren't promises", () => {
    const found = (t: string) => promisesIn([{ who: "Gabriel", text: t }], now, () => "user", () => "buffy");
    expect(found("We'll deal with it tomorrow.")).toEqual([]);
    expect(found("I'll make pancakes tomorrow.")).toEqual([]);
    expect(found("I'll make you pancakes tomorrow, I promise.")[0]).toMatchObject({ kind: "do" });
    expect(found("Let's meet at the Bronze tomorrow.")[0]).toMatchObject({ kind: "meet" });
  });
  test("a meeting is kept when both are there inside the window", () => {
    const st = fold([
      reply(0, "cast: Willow@spot", `[spk=Willow#1]"Meet me at the library at nine."[/spk]`),
      reply(1, "clock: → Day 1 20:50\nat: Library\ncast: Willow@spot"),
    ]).state;
    const p = Object.values(st.cons).find((c) => c.promise)!;
    expect(p).toMatchObject({ who: "willow", whom: "user", status: "paid", what: "meet Gabriel at the library at nine" });
    // The sealed persona's feelings are the player's: no bond line for them.
    expect(st.bonds["user>willow"]).toBeUndefined();
  });
  test("a ledger line or the player's word settles one", () => {
    const base = [reply(0, "cast: Xander@spot", `[spk=Xander#2]"I'll call you tomorrow."[/spk]`)];
    const viaLine = fold([...base, reply(1, "promise Xander>Gabriel: call him | kept — he rang at noon")]).state;
    expect(Object.values(viaLine.cons).find((c) => c.promise)!.status).toBe("paid");
    const id = Object.values(fold(base).state.cons)[0].id;
    expect(Object.values(fold(base, { ...OPTS, promiseEdits: { [id]: "broken" } }).state.cons)[0].status).toBe("broken");
    expect(Object.values(fold(base, { ...OPTS, promiseEdits: { [id]: "dropped" } }).state.cons)).toEqual([]);
  });
  test("the note says when a promise is due", () => {
    const st = fold([reply(0, "cast: Xander@spot", `[spk=Xander#2]"I'll call you tomorrow."[/spk]`), reply(1, "clock: → Day 2 10:00")]).state;
    const note = buildLedgerNote({ state: st, almanac: null, records: [], userName: "Gabriel", sealed: true, query: "" }).text;
    expect(note).toContain("PROMISE DUE: Xander promised Gabriel to call Gabriel tomorrow");
    expect(note).toContain("promise A>B: what | kept");
  });
});

describe("conditions with a course", () => {
  test("what a body line names", () => {
    expect(conditionsIn("hungover")).toEqual(["hangover"]);
    expect(conditionsIn("a streaming cold")).toEqual(["cold"]);
    expect(conditionsIn("cold hands")).toEqual([]);
    expect(conditionsIn("sick with fever")).toEqual(["fever"]);
    expect(conditionsIn("sick of waiting")).toEqual([]);
    expect(conditionsIn("cursed")).toEqual(["curse"]);
  });
  test("courses by kind: a vampire doesn't catch cold, a Slayer gets over it sooner", () => {
    const k = (kind: string, heal = 1) => ({ kind, by: "" as const, hunger: 1, thirst: 1, fatigue: 1, sleep: 1, heal });
    expect(courseOf("cold")).toBe(6 * D);
    expect(courseOf("cold", k("vampire", 5))).toBe(0);
    expect(courseOf("cold", k("slayer", 3))!).toBeLessThan(4 * D);
    expect(courseOf("curse")).toBeNull();
    expect(courseOf("hangover", k("construct", 0))).toBe(0);
    expect(drinkFactor(k("vampire", 5))).toBeLessThan(0.5);
  });
  test("a cold runs its course and ends; restating it the next day doesn't bring it back", () => {
    const chat = [reply(0, "cast: Willow@spot\nbody Willow: a streaming cold")];
    const st = fold(chat).state;
    expect(st.chars.willow.conditions?.[0]).toMatchObject({ kind: "cold" });
    expect(conditionWords(st.chars.willow.conditions![0], 18 * 60 + 60)).toMatch(/^a cold \(day 1 of about 6, at its worst\)/);
    const over = fold([...chat, reply(1, "clock: → Day 8 09:00")]).state;
    expect(activeConditions(over.chars.willow, 8 * D + 9 * 60)).toEqual([]);
    expect(over.chars.willow.flags).not.toContain("a streaming cold");
    const restated = fold([...chat, reply(1, "clock: → Day 8 09:00"), reply(2, "body Willow: a streaming cold")]).state;
    expect(restated.chars.willow.flags).not.toContain("a streaming cold");
    const again = fold([...chat, reply(1, "clock: → Day 8 09:00"), reply(2, "body Willow: the cold came back")]).state;
    expect(activeConditions(again.chars.willow, 8 * D + 9 * 60).length).toBe(1);
  });
  test("a drunk night's sleep ends in a hangover", () => {
    const st = fold([reply(0, "cast: Xander@spot\nbody Xander: intox 4"), reply(1, "clock: → Day 2 08:00")]).state;
    expect(st.chars.xander.conditions?.map((c) => c.kind)).toEqual(["hangover"]);
    expect(st.chars.xander.flags).toContain("hungover");
  });
  test("the note says how far along it is", () => {
    const st = fold([reply(0, "cast: Willow@spot\nbody Willow: feverish")]).state;
    const note = buildLedgerNote({ state: st, almanac: null, records: [], userName: "Gabriel", sealed: true, query: "" }).text;
    expect(note).toMatch(/Willow \([^)]*a fever \(day 1 of about 2/);
  });
});

describe("recurring days", () => {
  const cal = buildCalendar({ startPoint: "Friday 17 October 2025" });
  test("asides", () => {
    expect(recurringAside("birthday: Buffy, 19 January")).toEqual({ name: "Buffy's birthday", when: "19 January", who: "Buffy" });
    expect(recurringAside("every Friday: patrol night")).toEqual({ name: "patrol night", when: "every Friday" });
    expect(recurringAside("holiday: Founders' Day, 12 March")).toEqual({ name: "Founders' Day", when: "12 March" });
    const ops = playerOps("((birthday: Buffy, 19 January))", { names: ["Buffy"], day: 1 });
    expect(ops[0]).toMatchObject({ op: "recur", args: { name: "Buffy's birthday" } });
  });
  test("rules land on the calendar's days", () => {
    expect(dateFor(cal, 1).weekday).toBe("Friday");
    const fri = ruleOf("every Friday", cal)!;
    expect([1, 2, 8].map((d) => fri(d, { cal }))).toEqual([true, false, true]);
    const bday = ruleOf("19 October", cal)!;
    expect(bday(3, { cal })).toBe(true);
    expect(bday.kind).toBe("yearly");
    expect(ruleOf("day 12", cal)!(12, { cal })).toBe(true);
    expect(ruleOf("some time", cal)).toBeNull();
    // A full moon falls on the brightest day.
    const lit = (d: number) => Math.round(50 - 50 * Math.cos((2 * Math.PI * (d - 3)) / 29.53));
    const full = ruleOf("full moon", cal)!;
    const days = Array.from({ length: 30 }, (_, i) => i + 1).filter((d) => full(d, { cal, moonLit: lit }));
    expect(days).toEqual([18]);
  });
  test("folded from an aside; occurrences, today's line and death anniversaries", () => {
    const st = fold([msg(0, "((birthday: Buffy, 19 October))", true), reply(1, "cast: Joyce@spot\nbody Joyce: dead")]).state;
    expect(st.recurring?.[0]).toMatchObject({ name: "Buffy's birthday", when: "19 October", by: "user" });
    const occ = occurrences(st, allRecurring(st, [{ id: "rec:patrol", name: "patrol night", when: "every Friday", by: "user" }]), { cal }, 1, 40);
    expect(occ.find((o) => o.name === "Buffy's birthday")!.day).toBe(3);
    expect(occ.find((o) => o.name === "a month since Joyce died")!.day).toBe(31);
    expect(dayLine(occ, 7)).toBe("Tomorrow: patrol night · a week since Joyce died");
  });
});

describe("secret exposure", () => {
  test("suspicion and closeness to someone who knows put a secret near coming out", () => {
    const st = fold([
      reply(0, "cast: Willow@spot · Dawn@spot · Tara@spot\nsecret #heaven: Buffy was in Heaven | kept by Willow, Tara · from Dawn\nbond Dawn>Willow: affection +3, trust +3 — sisters in all but name\nknow Dawn: #heaven Buffy was in Heaven | Willow keeps changing the subject · suspects"),
    ]).state;
    const x = exposures(st, (id) => st.chars[id]?.name ?? id)[0];
    expect(x.key).toBe("heaven");
    expect(x.clock).toBeGreaterThanOrEqual(3);
    expect(x.closest[0]).toMatchObject({ id: "dawn" });
    expect(x.closest[0].why).toContain("suspects it");
  });
});

describe("callbacks when they're due", () => {
  test("seen in the prose; due after three scenes, only when the moment can hold it", () => {
    const seen = bitsSeen([{ index: 3, content: "He poured the oil again, grinning." }, { index: 9, content: "Nothing." }], ["the oil joke"]);
    expect(seen).toEqual({ "the oil joke": 3 });
    const st = fold([
      reply(0, "cast: Oberyn@spot\nmotif: the oil joke | Oberyn"),
      ...Array.from({ length: 16 }, (_, i) => reply(i + 1, i % 4 === 0 ? `at: Room ${i}` : "clock: +5m")),
    ]).state;
    expect(dueBits(st, {})).toEqual([{ text: "the oil joke", who: "Oberyn", scenes: 3 }]);
    expect(dueBits(st, {}, { tier: "pivotal" })).toEqual([]);
    expect(dueBits({ ...st, mode: "conflict" }, {})).toEqual([]);
    expect(dueBits(st, { "the oil joke": 15 })).toEqual([]);
    const note = buildLedgerNote({ state: st, almanac: null, records: [], userName: "Gabriel", sealed: true, query: "", dueBits: dueBits(st, {}) }).text;
    expect(note).toContain("[CALLBACKS] Due for a callback");
    expect(buildLedgerNote({ state: st, almanac: null, records: [], userName: "Gabriel", sealed: true, query: "", dueBits: [] }).text).not.toContain("[CALLBACKS]");
  });
});

describe("belongings and rooms", () => {
  test("whose a thing is", () => {
    const look = (n: string) => (n === "Cersei" ? "cersei" : null);
    expect(nextOwner({ name: "Cersei's locket" }, "jaime", "", look, () => true)).toBe("cersei");
    expect(nextOwner({ name: "locket" }, "jaime", "", look, () => true, "around his neck")).toBe("jaime");
    expect(nextOwner({ name: "glass shard" }, "jaime", "picked it up", look, () => true, "on the counter")).toBeUndefined();
    expect(nextOwner({ name: "locket", owner: "jaime" }, "cersei", "lent it for the night", look, () => true)).toBe("jaime");
    expect(nextOwner({ name: "locket", owner: "jaime" }, "cersei", "gave it to her", look, () => true)).toBe("cersei");
  });
  test("a keepsake in a trunk stays hers, and the note mentions it in her chambers", () => {
    const chat = [
      reply(0, "at: Red Keep › Cersei's former chambers\ncast: Cersei@spot\nitem Locket: → Cersei (in her trunk) — kept from childhood"),
      reply(1, "at: Red Keep › Great Hall\ncast: Cersei@spot"),
    ];
    const st = fold(chat).state;
    const rooms = roomsOf(st, {});
    expect(rooms.cersei).toEqual(["Cersei's former chambers"]);
    expect(belongingsOf(st, "cersei", (id) => id)).toEqual([{ name: "Locket", where: "in her trunk", lastMsg: 0 }]);
    expect(keptHere(st, rooms, (id) => st.chars[id]?.name ?? id)).toEqual([]);
    const back = fold([...chat, reply(2, "at: Red Keep › Cersei's former chambers")]).state;
    expect(keptHere(back, roomsOf(back, {}), (id) => back.chars[id]?.name ?? id)).toEqual(["Locket (Cersei's, in her trunk)"]);
    expect(roomsOf(st, { cersei: { rooms: ["the tower room"] } }).cersei).toContain("the tower room");
  });
});

describe("the canon cutoff", () => {
  const cut = { point: "Buffy, season 3, before Graduation", notYet: ["Glory", "the Initiative", "Dawn"] };
  test("terms the story hasn't reached; the lane; hits on the page", () => {
    expect(termPattern("the Initiative")!.test("an Initiative soldier")).toBe(true);
    expect(termPattern("Glory")!.test("glorious")).toBe(false);
    const live = liveTerms(cut, (re) => re.test("Dawn came home from school."));
    expect(live).toEqual(["Glory", "the Initiative"]);
    expect(cutoffLane(cut, live)).toContain("Not yet happened, not known to anyone, never named or hinted at: Glory, the Initiative.");
    expect(cutoffHits("Riley mentioned the Initiative.", live, "")[0].term).toBe("the Initiative");
    expect(cutoffHits("Riley mentioned the Initiative.", live, "What's the Initiative?")).toEqual([]);
    expect(cleanTerms("Glory, Riley Finn\n- the Initiative\nGlory")).toEqual(["Glory", "Riley Finn", "the Initiative"]);
  });
  test("the check of a reply flags a term from later in the source", () => {
    const st = fold([reply(0, "cast: Spike@spot")]).state;
    const text = `[spk=Spike#3]"Glory's coming for you, Slayer."[/spk]\n<ledger>\nmode: social\n</ledger>`;
    const issues = checkReply({ reply: text, parsed: parseMessage(text), before: st, after: st, events: [], offPage: [], player: "", userName: "Gabriel", cutoff: { point: cut.point, live: ["Glory"] } });
    expect(issues[0]).toMatchObject({ kind: "canon", level: "warn" });
    expect(ruleFor(issues[0])).toBe('"Glory" hasn\'t happened yet in this story');
  });
});

describe("swipe autopsy", () => {
  test("slips only the rejected takes made become lessons; the model's taste notes don't", () => {
    const leak = { kind: "offpage" as const, level: "warn" as const, text: 'names "Heaven": #heaven (Willow) is kept off the page', quote: "…Heaven…" };
    const eyes = { kind: "trait" as const, level: "warn" as const, text: "Daeron's eyes are violet, not grey" };
    const ls = rulesLessons([eyes], [[leak, eyes]], 152);
    expect(ls.map((l) => l.text)).toEqual(['Never name "Heaven" on the page while #heaven is kept off it']);
    const m = modelLessons({ lessons: [{ rule: "Joyce is alive", why: "a rejected take had her funeral" }, { rule: "Keep the prose shorter" }, { rule: 'Never name "Heaven" on the page while #heaven is kept off it' }] }, ls, 152);
    expect(m.map((l) => l.text)).toEqual(["Joyce is alive"]);
    let list = addLessons([], [...ls, ...m]);
    list[0].status = "kept";
    list = addLessons(list, [{ ...m[0], id: "x" }]);
    expect(list.length).toBe(2);
    expect(lessonsLane(list)).toBe('[LESSONS] From takes the player swiped away — hold to these: Never name "Heaven" on the page while #heaven is kept off it');
  });
});

describe("character journals", () => {
  test("the day of each message, who writes, and the entry cleaned", () => {
    expect(dayOfMessages([{ msgIndex: 0, at: { day: 1 } }, { msgIndex: 3, at: { day: 2 } }], 5)).toEqual([1, 1, 1, 2, 2]);
    const st = fold([msg(0, `"Hello."`, true), reply(1, "cast: Willow@spot · Xander@spot")]).state;
    expect(writersFor(st, { willow: 5, xander: 1, user: 9 }, { sealed: true })).toEqual(["willow"]);
    expect(writersFor(st, { willow: 5, user: 9 }, { sealed: false })).toEqual(["user", "willow"]);
    expect(cleanEntry("Day 4 — Tuesday\n\n\"Buffy was quiet today.\"")).toBe("Buffy was quiet today.");
  });
});

describe("the inbox: what was filed from the player's message", () => {
  test("lines in words, and an undone line stays out of the story", () => {
    const text = "THIS IS DAY 26. Daeron has violet eyes.";
    const ops = playerOps(text, { names: ["Daeron"], day: 20 });
    expect(ops.map((o) => filedLine(o))).toEqual(["day 26", "Daeron: violet eyes"]);
    const chat = [reply(0, "cast: Daeron@spot"), msg(1, text, true)];
    const st = fold(chat).state;
    expect(st.time!.day).toBe(26);
    const key = filedKey("m1", 0, ops[0].raw);
    const undone = fold(chat, { ...OPTS, ignoredFacts: [key] }).state;
    expect(undone.time!.day).toBe(1);
    expect(undone.chars.daeron.traits?.[0]).toMatchObject({ kind: "eyes" });
    expect(sideKey("m1", 0)).toBe("m1:0");
  });
});
