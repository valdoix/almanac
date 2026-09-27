import { describe, expect, test } from "bun:test";
import { LedgerRuntime, toPath, type RawChatMessage } from "../src/core/branch";
import type { FoldOptions } from "../src/core/state";
import { splitFact } from "../src/core/facts";

const msg = (i: number, content: string): RawChatMessage => ({ id: `m${i}`, index_in_chat: i, is_user: false, content, swipes: [content], swipe_id: 0 });
const turn = (lines: string) => `Prose.\n<ledger>\n${lines}\nmode: social\n</ledger>`;
const OPTS: FoldOptions = { userName: "Gabriel Winters", strictness: "strict", sealed: true };
const fold = (turns: string[], opts: Partial<FoldOptions> = {}) => new LedgerRuntime().fold(toPath(turns.map((t, i) => msg(i, turn(t)))), { ...OPTS, ...opts });

describe("splitting a written fact", () => {
  test("evidence, parentheticals and 'DOES NOT KNOW' come out of the statement", () => {
    const f = splitFact("Buffy was \"somewhere\" before — warm, painless (direct observation). DOES NOT KNOW: heaven, the dream, the meaning of \"finished\"");
    expect(f.statement).toBe("Buffy was \"somewhere\" before");
    expect(f.note).toBe("warm, painless; direct observation");
    expect(f.unawareOf).toEqual(["heaven", "the dream", "the meaning of \"finished\""]);
    expect(splitFact("#heaven Buffy was in Heaven")).toMatchObject({ key: "heaven", statement: "Buffy was in Heaven" });
  });
});

describe("facts", () => {
  const cast = "cast: Buffy@spot · Ruth@peri · Valeria@peri";
  // The lines from the screenshots, then the model settling on a key.
  const heaven = [
    cast,
    "know Gabriel Winters: Buffy's silence and open hand confirmed it was Heaven — he said it, she didn't correct him (direct observation). DOES NOT KNOW: the depth of what she lost | direct observation · knows · true",
    "know Buffy: #heaven Buffy was in Heaven | lived it · knows · true",
    "know Gabriel Winters: #heaven | deduced from her unfinished sentence · knows · true",
    "know Valeria: #heaven Buffy was in hell | rumour · believes · false",
  ];

  test("lines about the same thing compile into one fact with a plain statement", () => {
    const { state } = fold(heaven);
    const facts = Object.values(state.facts!);
    expect(facts.length).toBe(1);
    const f = state.facts!.heaven;
    expect(f.statement).toBe("Buffy was in Heaven");
    expect(f.truth).toBe("true");
    expect(f.altKeys?.length).toBe(1);
  });

  test("each person's stance, their own version, and the history", () => {
    const f = fold(heaven).state.facts!.heaven;
    expect(f.stances.user).toMatchObject({ status: "knows", how: "deduced from her unfinished sentence" });
    expect(f.stances.buffy).toMatchObject({ status: "knows", how: "lived it" });
    expect(f.stances.valeria).toMatchObject({ status: "wrong", version: "Buffy was in hell" });
    expect(f.history.map((h) => h.holder)).toEqual(["user", "buffy", "user", "valeria"]);
    expect(f.history[0].note).toMatch(/still doesn't know: the depth of what she lost/);
  });

  test("the player can rename, merge and hide facts", () => {
    const renamed = fold(heaven, { factEdits: { heaven: { statement: "Buffy had been in Heaven", truth: "true" } } }).state.facts!.heaven;
    expect(renamed).toMatchObject({ statement: "Buffy had been in Heaven", locked: true });
    const { state } = fold([cast, "know Ruth: #prophecy the prophecy names Buffy | read it · knows · true", "know Ruth: #omen a slayer will return | sensed it · suspects"], { factEdits: { omen: { into: "prophecy" } } });
    expect(Object.keys(state.facts!)).toEqual(["prophecy"]);
    expect(state.facts!.prophecy.stances.ruth.status).toBe("suspects");
    const hidden = fold(heaven, { factEdits: { heaven: { hidden: true } } }).state.facts!.heaven;
    expect(hidden.hidden).toBe(true);
  });
});

describe("not a person", () => {
  test("a name removed from the cast stops being a character; debts to it keep its name", () => {
    const opts = { merges: { "osiris forces": "-" } };
    const { state } = fold(["cast: Buffy@spot · Osiris forces@peri", "mood Osiris forces: hungry", "owe Buffy → Osiris forces: her peace | open"], opts);
    expect(Object.values(state.chars).map((c) => c.name)).toEqual(["Buffy"]);
    const debt = Object.values(state.cons)[0];
    expect(debt).toMatchObject({ who: "buffy", whom: "Osiris forces" });
  });
});
