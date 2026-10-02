import { describe, expect, test } from "bun:test";
import { applySpeakers, bareLines, parseSpeakerAnswer, speakerPrompt, withoutSpeakerMarks } from "../src/core/speakers";

const VOICES = [
  { name: "Buffy Summers", slot: 1 },
  { name: "Dawn Summers", slot: 2 },
  { name: "Gabriel Winters", slot: 4, isUser: true },
];

// Buffy chat #364 (regenerated under 1.19.2): most lines came back without marks.
const REPLY = `🗓️ Day 4 · Thursday, 18 October 2001
📍 Sunnydale › Winters Residence › kitchen

"A *recording.*" Dawn's fork stops halfway to her mouth. "He would. He would actually do that."

"It's caviar."

She eats a bite.

"...Okay," she says, quietly, to the bowl. "That's *unfair* —"

[spk=Dawn]"She's fawning,"[/spk] Dawn says. "She's doing the moan thing."

The label says "Product of Iran" in small print.

[txt=screen]» Callum: "early stuff" is correct[/txt]

<ledger>
journal Dawn: "caviar on risotto"
</ledger>`;

describe("speaker marks for bare lines", () => {
  test("finds spoken lines outside marks, texts, ledgers and headers; skips a short quoted title", () => {
    const lines = bareLines(REPLY).map((l) => l.text);
    expect(lines).toEqual([`"A *recording.*"`, `"He would. He would actually do that."`, `"It's caviar."`, `"...Okay,"`, `"That's *unfair* —"`, `"She's doing the moan thing."`]);
  });
  test("the ask numbers each line in place and leaves the ledger out", () => {
    const lines = bareLines(REPLY);
    const p = speakerPrompt({ text: REPLY, lines, voices: VOICES, userName: "Gabriel Winters" });
    expect(p.user).toContain(`⟦1⟧"A *recording.*" Dawn's fork`);
    expect(p.user).toContain(`⟦6⟧"She's doing the moan thing."`);
    expect(p.user).not.toContain("<ledger>");
    expect(p.system).toContain("Gabriel Winters — the player's character");
  });
  test("reads the answer loosely: names, ?, -, extra words", () => {
    expect(parseSpeakerAnswer("1: Dawn\n2) Dawn Summers\n⟦3⟧: Gabriel — the player\n4: ?\n5: -\n9: Buffy\nnoise", 6)).toEqual(["Dawn", "Dawn Summers", "Gabriel", null, null, null]);
  });
  test("wraps attributed lines with the reply's own name and voice number, and changes nothing else", () => {
    const lines = bareLines(REPLY);
    const out = applySpeakers(REPLY, lines, ["Dawn", "Dawn Summers", "Gabriel", "Buffy", "Buffy", "Dawn"], VOICES);
    expect(out).toContain(`[spk=Dawn#2]"A *recording.*"[/spk] Dawn's fork stops halfway to her mouth. [spk=Dawn#2]"He would.`);
    expect(out).toContain(`[spk=Gabriel#4]"It's caviar."[/spk]`);
    expect(out).toContain(`[spk=Buffy#1]"...Okay,"[/spk] she says, quietly, to the bowl. [spk=Buffy#1]"That's *unfair* —"[/spk]`);
    // the reply's own slotless mark takes the voice number
    expect(out).toContain(`[spk=Dawn#2]"She's fawning,"[/spk] Dawn says. [spk=Dawn#2]"She's doing the moan thing."[/spk]`);
    expect(out).toContain(`The label says "Product of Iran"`);
    expect(withoutSpeakerMarks(out)).toBe(withoutSpeakerMarks(REPLY));
  });
  test("follows a voice number the reply already gave someone; skips unknown and unattributed lines", () => {
    const text = `[spk=Buffy#7]"Hi."[/spk]\n\n"Hey."\n\n"Who's there?"\n\n"Me."`;
    const out = applySpeakers(text, bareLines(text), ["Buffy Summers", null, "Spike"], VOICES);
    expect(out).toBe(`[spk=Buffy#7]"Hi."[/spk]\n\n[spk=Buffy#7]"Hey."[/spk]\n\n"Who's there?"\n\n"Me."`);
    expect(applySpeakers(text, bareLines(text), [null, null, null], VOICES)).toBe(text);
  });
});
