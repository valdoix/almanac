import { describe, expect, test } from "bun:test";
import { LedgerRuntime, toPath, type RawChatMessage, type SideEventStore } from "../src/core/branch";
import type { FoldOptions } from "../src/core/state";
import { factKind, lackOf, sameFact } from "../src/core/facts";
import { parseKnowRest } from "../src/core/knowparse";
import { knowledgeBrief } from "../src/core/note";
import { parseLine, rewriteKnowledgeLines } from "../src/core/dsl";
import { parseClerk, clerkPrompt, clerkWanted } from "../src/core/clerk";
import { KNOW_OPS } from "../src/core/types";
import { hash } from "../src/core/util";

const OPTS: FoldOptions = { userName: "Gabriel Winters", strictness: "strict", sealed: true };
const reply = (i: number, content: string): RawChatMessage => ({ id: `m${i}`, index_in_chat: i, is_user: false, content, swipes: [content], swipe_id: 0 });
const player = (i: number, content: string): RawChatMessage => ({ id: `m${i}`, index_in_chat: i, is_user: true, content, swipes: [content], swipe_id: 0 });
const turn = (lines: string, prose = "Prose.") => `${prose}\n<ledger>\n${lines}\nmode: social\n</ledger>`;
/** Replies only (odd indexes left for players). */
const fold = (turns: string[], opts: Partial<FoldOptions> = {}) => new LedgerRuntime().fold(toPath(turns.map((t, i) => reply(i, turn(t)))), { ...OPTS, ...opts });
const foldRaw = (msgs: RawChatMessage[], side: SideEventStore = {}, opts: Partial<FoldOptions> = {}) => new LedgerRuntime().fold(toPath(msgs), { ...OPTS, ...opts }, side);
const factWith = (st: any, word: string) => Object.values(st.facts ?? {}).find((f: any) => f.statement.toLowerCase().includes(word.toLowerCase())) as any;

describe("reading knowledge lines as models write them", () => {
  test("a diary line splits into one fact per item; route words and 'this beat' come out of the fact", () => {
    const k = parseKnowRest(`Gabriel is a Slayer (heard) · his name is Gabriel Winters (heard) · he was Called five months ago, a week after her death | does not know who raised her or why, does not know the Scoobies did it`)!;
    expect(k.items.map((i) => i.statement)).toEqual(["Gabriel is a Slayer", "his name is Gabriel Winters", "he was Called five months ago, a week after her death"]);
    expect(k.items[0].how).toBe("heard");
    expect(k.negations).toEqual(["who raised her", "the Scoobies did it"]);
    expect(k.repaired).toBe(true);
    const beat = parseKnowRest(`Valeria is Gabriel's doctor and a witch (told by Gabriel this beat)`)!.items[0];
    expect(beat).toMatchObject({ statement: "Valeria is Gabriel's doctor and a witch", from: "Gabriel", now: true });
  });

  test("what's part of the fact stays; evidence goes to the note; recaps are dropped", () => {
    expect(parseKnowRest(`Gabriel's name-voice (Gabe-o)`)!.items[0].statement).toBe("Gabriel's name-voice (Gabe-o)");
    expect(parseKnowRest(`Buffy was in Heaven (silence-confirmed)`)!.items[0].statement).toBe("Buffy was in Heaven");
    const r = parseKnowRest(`Gabriel named Ruth after RBG — this beat (direct observation). Cumulative: glasses, contacts, waffles`)!.items;
    expect(r).toHaveLength(1);
    expect(r[0].statement).toBe("Gabriel named Ruth after RBG");
    expect(parseKnowRest(`still suspects Willow but has not named her`)!.items[0]).toMatchObject({ statement: "it was Willow", status: "suspects" });
  });

  test("reveal, secret and unaware lines", () => {
    expect(parseLine(`reveal #gabe-o: Gabriel calls himself "Gabe-o" | Gabriel, aloud`)!.args).toMatchObject({ key: "gabe-o", source: "Gabriel", everyone: true, channel: "aloud" });
    expect(parseLine(`reveal #locket: Wren took the locket | Joss → Mara, whispered · true`)!.args).toMatchObject({ source: "Joss", listeners: ["Mara"], everyone: false, channel: "whispered", truth: "true" });
    expect(parseLine(`reveal: #debt the price is her peace | said aloud by Valeria`)!.args).toMatchObject({ key: "debt", source: "Valeria", everyone: true });
    expect(parseLine(`secret #called: Gabriel was Called when Buffy died | Valeria keeps it from Buffy and Gabriel`)!.args).toMatchObject({ keepers: ["Valeria"], from: ["Buffy", "Gabriel"] });
    expect(parseLine(`unaware Buffy: who raised her · #heaven`)!.args.things).toEqual(["who raised her", "#heaven"]);
  });
});

describe("the Gabe-o scene", () => {
  // Buffy and Valeria speak; Ruth the cat has been in five cast lines without a word and is asleep.
  const cast = "cast: Buffy@spot · Valeria@spot · Ruth@spot(on the counter)";
  const chat = [
    reply(0, turn(cast, `[spk=Buffy#1]"Hi."[/spk] [spk=Valeria#3]"Hello."[/spk]`)),
    reply(1, turn(cast)), reply(2, turn(cast)), reply(3, turn(cast)),
    player(4, `Valeria sighs. "You were more injury-prone before you became a Slayer."\n\nGabriel grins. "That's a-me, Gabe-o."`),
    reply(5, turn(`cast: Buffy@spot · Valeria@spot · Ruth@spot(asleep against Buffy's thigh)\nknow Buffy: Gabriel's name-voice (Gabe-o) · necklace weight against hip · hasn't asked what any of this costs`, `It breaks loose. [spk=Buffy#1]"Gabe-*o*?"[/spk]`)),
  ];
  const { state } = foldRaw(chat);

  test("whoever said it has it, everyone in earshot heard it, and the cat knows nothing", () => {
    const f = factWith(state, "gabe-o");
    expect(f.stances.buffy.status).toBe("knows");
    expect(f.stances.user).toMatchObject({ status: "knows", route: "said", derived: "source" });
    expect(f.stances.valeria).toMatchObject({ status: "knows", route: "heard", derived: "witness", from: "user" });
    expect(f.stances.ruth).toBeUndefined();
    expect(lackOf(state, f, "user")).toBeNull();
    expect(lackOf(state, f, "valeria")).toBeNull();
    expect(factKind(f)).toBe("shared");
  });

  test("a passing observation is kept but claims nothing and never reaches the model", () => {
    const n = factWith(state, "necklace");
    expect(Object.keys(n.stances)).toEqual(["buffy"]);
    expect(factKind(n)).toBe("noted");
    for (const id of ["user", "valeria", "ruth"]) expect(lackOf(state, n, id)).toBeNull();
    const kb = knowledgeBrief(state, "Gabe-o laugh", "Gabriel Winters", 5, "Gabriel says Gabe-o again").join("\n");
    expect(kb).not.toMatch(/news to|necklace|Ruth/);
    const line = kb.split("\n").find((l) => l.includes("Gabe-o")) ?? "";
    for (const name of ["Buffy", "Valeria", "Gabriel Winters"]) expect(line).toContain(name);
    expect(line).toMatch(/all have it: don't explain it again\.$/);
  });

  test("the model's history shows the line as filed: one fact a line, with its key", () => {
    const filed = state.knowCanon![5];
    expect(filed[0]).toMatch(/^reveal #[\w-]+: Gabriel's name-voice \(Gabe-o\) \| Gabriel Winters, aloud$/);
    const rewritten = rewriteKnowledgeLines(chat[5].content!, filed);
    expect(rewritten).not.toContain("· necklace weight");
    expect(rewritten).toContain(filed[0]);
    expect(rewritten).toMatch(/\nmode: social\n<\/ledger>$/);
  });
});

describe("secrets, gaps and who lacks what", () => {
  const cast = `cast: Buffy@spot · Gabriel@spot · Valeria@spot`;
  const speak = `[spk=Buffy#1]"…"[/spk] [spk=Valeria#3]"…"[/spk]`;

  test("no record is not ignorance; a secret line is evidence", () => {
    const { state } = foldRaw([reply(0, turn(`${cast}\nknow Gabriel: #heaven Buffy was in Heaven | deduced it · knows · true`, speak))]);
    const f = state.facts!.heaven;
    expect(lackOf(state, f, "valeria")).toBeNull();
    const kept = foldRaw([reply(0, turn(`${cast}\nknow Gabriel: #heaven Buffy was in Heaven | deduced it · knows · true\nsecret #heaven: Buffy was in Heaven | kept by Buffy · from Valeria`, speak))]).state;
    const g = kept.facts!.heaven;
    expect(lackOf(kept, g, "valeria")).toBe("hidden");
    expect(g.stances.buffy).toMatchObject({ status: "knows", route: "kept" });
    expect(factKind(g)).toBe("secret");
    const kb = knowledgeBrief(kept, "", "Gabriel Winters").join("\n");
    expect(kb).toMatch(/#heaven "Buffy was in Heaven" \(true\) — .*Valeria doesn't know \(kept from them\)/);
  });

  test("'has not said Heaven to Valeria' keeps that fact from her; a deduction kept unspoken is kept from everyone here", () => {
    const { state } = foldRaw([
      reply(0, turn(`${cast}\nknow Gabriel: Buffy was in Heaven (silence-confirmed)`, speak)),
      reply(1, turn(`know Buffy: still has not named Heaven to Valeria\nknow Valeria: Slayer signature + timing = Gabriel Called at Buffy's death (deduced, narrator-only, unspoken)`, speak)),
    ]);
    const heaven = factWith(state, "in heaven");
    expect(heaven.statement).toBe("Buffy was in Heaven");
    expect(heaven.keepers).toEqual(["buffy"]);
    expect(lackOf(state, heaven, "valeria")).toBe("hidden");
    const called = factWith(state, "slayer signature");
    expect(called.keepers).toEqual(["valeria"]);
    expect(lackOf(state, called, "buffy")).toBe("hidden");
    expect(lackOf(state, called, "user")).toBe("hidden");
  });

  test("said aloud in front of someone it was kept from: the secret is out for them", () => {
    const { state } = foldRaw([
      reply(0, turn(`${cast}\nsecret #heaven: Buffy was in Heaven | kept by Buffy · from Valeria`, speak)),
      reply(1, turn(`reveal #heaven: Buffy was in Heaven | Buffy, aloud`, speak)),
    ]);
    const f = state.facts!.heaven;
    expect(f.stances.valeria).toMatchObject({ status: "knows", route: "heard" });
    expect(f.keptFrom ?? []).not.toContain("valeria");
  });

  test("a whisper reaches only the one it's for; the others in the room didn't hear it", () => {
    const { state } = foldRaw([reply(0, turn(`${cast}\nreveal #locket: Gabriel took the locket | Buffy → Valeria, whispered`, speak))]);
    const f = state.facts!.locket;
    expect(f.stances.valeria.status).toBe("knows");
    expect(f.stances.user).toBeUndefined();
    expect(lackOf(state, f, "user")).toBe("unheard");
  });

  test("'does not know' names people or things: people lack the fact, things become gaps that close when learned", () => {
    const { state } = foldRaw([
      reply(0, turn(`${cast}\nknow Buffy: #spell the spell came from the Magic Box | does not know Valeria, who cast it`, speak)),
    ]);
    expect(lackOf(state, state.facts!.spell, "valeria")).toBe("stated");
    expect(state.gaps!.buffy.map((g) => g.text)).toEqual(["who cast it"]);
    const later = foldRaw([
      reply(0, turn(`${cast}\nknow Buffy: #spell the spell came from the Magic Box | does not know who cast the spell`, speak)),
      reply(1, turn(`know Buffy: #caster Willow cast the spell | told by Valeria · knows · true`, speak)),
    ]).state;
    expect(later.gaps?.buffy ?? []).toEqual([]);
  });

  test("a gap that names a tracked fact marks them as lacking it", () => {
    const { state } = foldRaw([
      reply(0, turn(`${cast}\nknow Gabriel: #heaven Buffy was in Heaven | deduced it`, speak)),
      reply(1, turn(`know Valeria: a dark spell is on Buffy | sensed it · does NOT know Heaven`, speak)),
    ]);
    expect(lackOf(state, state.facts!.heaven, "valeria")).toBe("stated");
  });

  test("walking into the scene afterwards: wasn't there; a newcomer in a later scene may have known all along", () => {
    const { state } = foldRaw([
      reply(0, turn(`${cast}\nreveal #debt: the spell left a debt in Buffy | Valeria, aloud`, speak)),
      reply(1, turn(`cast: Walter@arrive(← the hall)`)),
    ]);
    expect(lackOf(state, state.facts!.debt, "walter")).toBe("missed");
    const later = foldRaw([
      reply(0, turn(`${cast}\nat: Kitchen\nreveal #debt: the spell left a debt in Buffy | Valeria, aloud`, speak)),
      reply(1, turn(`at: Magic Box\nclock: +3h\ncast: Walter@spot`)),
    ]).state;
    expect(lackOf(later, later.facts!.debt, "walter")).toBeNull();
  });
});

describe("filing", () => {
  test("a restated, growing line is the same fact; a short line inside a long one is not", () => {
    const { state } = fold([
      "cast: Buffy@spot · Gabriel@spot",
      "know Gabriel: the woman he pulled from a grave has a pulse",
      "know Gabriel: the woman he pulled from a grave has a pulse, she watched him fight",
    ]);
    const grave = Object.values(state.facts!).filter((f) => f.statement.includes("grave"));
    expect(grave).toHaveLength(1);
    expect(grave[0].statement).toBe("the woman he pulled from a grave has a pulse, she watched him fight");
    expect(sameFact("Buffy was in Heaven", "Buffy has not said Heaven aloud")).toBeLessThan(0.7);
  });

  test("the player can rename, merge and hide facts", () => {
    const heaven = ["cast: Buffy@spot · Ruth@peri", "know Buffy: #heaven Buffy was in Heaven | lived it · knows · true"];
    const renamed = fold(heaven, { factEdits: { heaven: { statement: "Buffy had been in Heaven", truth: "true" } } }).state.facts!.heaven;
    expect(renamed).toMatchObject({ statement: "Buffy had been in Heaven", locked: true });
    const { state } = fold(["cast: Buffy@spot · Ruth@peri", "know Ruth: #prophecy the prophecy names Buffy | read it · knows · true", "know Ruth: #omen a slayer will return | sensed it · suspects"], { factEdits: { omen: { into: "prophecy" } } });
    expect(Object.keys(state.facts!)).toEqual(["prophecy"]);
    expect(state.facts!.prophecy.stances.ruth.status).toBe("suspects");
    expect(fold(heaven, { factEdits: { heaven: { hidden: true } } }).state.facts!.heaven.hidden).toBe(true);
  });

  test("a name removed from the cast stops being a character; debts to it keep its name", () => {
    const { state } = fold(["cast: Buffy@spot · Osiris forces@peri", "mood Osiris forces: hungry", "owe Buffy → Osiris forces: her peace | open"], { merges: { "osiris forces": "-" } });
    expect(Object.values(state.chars).map((c) => c.name)).toEqual(["Buffy"]);
    expect(Object.values(state.cons)[0]).toMatchObject({ who: "buffy", whom: "Osiris forces" });
  });

  test("looking a name up never renames anyone", () => {
    const { state } = fold(["cast: Buffy@spot · Ruth@peri", "know Valeria: a spell is on Buffy | sensed it · does NOT know Buffy suspects Willow\nknow Buffy: Ruth gets kissed on the head"]);
    expect(state.chars.buffy.name).toBe("Buffy");
    expect(state.chars.ruth.name).toBe("Ruth");
  });
});

describe("the knowledge clerk", () => {
  const cast = `cast: Buffy@spot · Valeria@spot`;
  const content = turn(`${cast}\nknow Buffy: Gabriel's name-voice (Gabe-o) · necklace weight against hip`, `[spk=Buffy#1]"Gabe-o?"[/spk]`);

  test("its lines stand in for the reply's knowledge lines, for that text only", () => {
    const ops = parseClerk(`<knowledge>\nreveal #gabe-o: Gabriel calls himself "Gabe-o" | Gabriel, aloud\nmood Buffy: happy\n</knowledge>`)!;
    expect(ops.map((o) => o.op)).toEqual(["reveal"]);
    const side: SideEventStore = { "m0:0": [{ source: "clerk", ops, replacesOps: [...KNOW_OPS], hash: hash(content) }] };
    const { state } = foldRaw([reply(0, content)], side);
    expect(Object.keys(state.facts!)).toEqual(["gabe-o"]);
    expect(state.facts!["gabe-o"].statement).toBe('Gabriel calls himself "Gabe-o"');
    expect(state.chars.buffy.mood).toBeUndefined();
    // After an edit the stored lines no longer apply: the reply's own lines are read again.
    const edited = foldRaw([reply(0, content.replace(`"Gabe-o?"`, `"Gabe-o!"`))], side).state;
    expect(Object.keys(edited.facts!).length).toBeGreaterThan(1);
    expect(parseClerk("<knowledge>none</knowledge>")).toEqual([]);
    expect(parseClerk("no block")).toBeNull();
  });

  test("it runs when a reply's lines need it, and its prompt carries the keys in play", () => {
    const { state } = foldRaw([reply(0, content)]);
    expect(clerkWanted("auto", state, 0, content)).toBe(true);
    expect(clerkWanted("off", state, 0, content)).toBe(false);
    const clean = turn(`${cast}\nreveal #gabe-o: Gabriel calls himself "Gabe-o" | Gabriel, aloud`);
    const st2 = foldRaw([reply(0, clean)]).state;
    expect(clerkWanted("auto", st2, 0, clean)).toBe(false);
    const p = clerkPrompt({ state: st2, userName: "Gabriel Winters", sealed: true, player: `"That's a-me, Gabe-o."`, reply: content, query: "Gabe-o" });
    expect(p.user).toContain('#gabe-o "Gabriel calls himself "Gabe-o""');
    expect(p.user).toContain("Buffy: \"Gabe-o?\"");
    expect(p.system).toMatch(/never a belief, suspicion, feeling or thought of Gabriel Winters's/);
  });
});
