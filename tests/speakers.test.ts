import { describe, expect, test } from "bun:test";
import { applySpeakers, bareLines, dropUserSpeech, isPersona, parseSpeakerAnswer, speakerPrompt, withoutSpeakerMarks } from "../src/core/speakers";

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

describe("persona speech (Sealed, Continuity)", () => {
  const isGabriel = (n: string) => /^gabriel( winters)?$/i.test(n);
  test("takes out the persona's lines with their tags and keeps everything else", () => {
    // Buffy chat #364 and #368, as a Sealed chat would have them.
    const text = `[spk=Buffy#1]"Who's that for?"[/spk]

[spk=Gabriel#0]"That's for you, best girl."[/spk]

Ruth eats it in two bites. [spk=Gabriel#0]"Best girl,"[/spk] Gabriel says solemnly, [spk=Gabriel#0]"earns her keep."[/spk] Dawn snorts.

[spk=Gabriel#0]"Twenty-one. January."[/spk] His eyes open a slit. [spk=Gabriel#0]"So this year you had a —"[/spk]

[spk=Gabriel Winters#0|murmur]"Close?"[/spk] — mumbled against her, not lifting. Buffy shivers.

He leans in and says, [spk=Gabriel#0]"Hi."[/spk] [spk=Buffy#1]"Hi yourself."[/spk]`;
    expect(dropUserSpeech(text, isGabriel)).toBe(`[spk=Buffy#1]"Who's that for?"[/spk]

Ruth eats it in two bites. Dawn snorts.

His eyes open a slit.

Buffy shivers.

[spk=Buffy#1]"Hi yourself."[/spk]`);
  });
  test("leaves a reply without the persona's lines alone", () => {
    const text = `[spk=Buffy#1]"Hey."[/spk] She grins.\n\n[spk=?]"Who's there?"[/spk]\n`;
    expect(dropUserSpeech(text, isGabriel)).toBe(text);
  });
});

describe("isPersona", () => {
  const voices = [{ name: "Buffy Summers", aliases: ["Buff"] }, { name: "Gabriel Winters", isUser: true, aliases: ["Gabe"] }, { name: "Gabriel Reyes" }];
  test("the persona's name and aliases; a first name only when no one else has it", () => {
    expect(isPersona("Gabriel Winters", voices, "Gabriel Winters")).toBe(true);
    expect(isPersona("gabe", voices, "Gabriel Winters")).toBe(true);
    expect(isPersona("Gabriel", voices, "Gabriel Winters")).toBe(false);
    expect(isPersona("Gabriel", voices.slice(0, 2), "Gabriel Winters")).toBe(true);
    expect(isPersona("Buffy", voices, "Gabriel Winters")).toBe(false);
  });
});
