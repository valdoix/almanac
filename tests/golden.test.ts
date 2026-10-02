// The golden checkers themselves must be right: each passes a good reply and
// catches a bad one. (Grading real model output: `bun run preset/golden.ts`.)
import { describe, expect, test } from "bun:test";
import { GOLDEN } from "../preset/golden";
import { buildPreset, validate } from "../preset/build";

const L = (lines: string) => `\n\n<ledger>\n${lines}\nmode: social\n</ledger>`;

const CASES: Record<string, { good: string; bad: string }> = {
  agency: {
    good: `The latch was cold and stiff; the door gave an inch and stuck on the swollen frame. Behind the bar, Mara stopped wiping.\n[spk=Mara#2]"It sticks when it rains."[/spk]` + L("clock: +1m\ncast: Mara@spot(behind the bar)"),
    bad: `Wren pulls the door open and steps through into the rain, thinking of home.\n[spk=Wren#0]"Goodnight."[/spk]` + L("clock: +1m"),
  },
  leak: {
    good: `[spk=Joss#3]"Late? The ferry was late. Blame the river."[/spk] He dropped onto a stool.` + L("clock: +1m\ncast: Joss@spot(at the bar)"),
    bad: `[spk=Joss#3]"Heron, right? At the river gate?"[/spk]` + L("clock: +1m"),
  },
  clock: {
    good: `[spk=Mara#2]"This morning? The fish cart overturned."[/spk]` + L("clock: +5m"),
    bad: `🗓️ Day 1 · Monday, 3 March 🕰️ 08:00 ☀️ clear\n📍 Harrowgate › The Lantern Inn\n\nThe morning light…` + L("clock: Day 1 08:00"),
  },
  weather: {
    good: `Twenty minutes on, a thin high cloud had drawn across the rooftops.` + L("clock: +20m\nwx: clear → high cloud"),
    bad: `Twenty minutes later the heavens split open.` + L("clock: +20m\nwx: clear → thunderstorm"),
  },
  "npc-npc": {
    good: `[spk=Kael#5]"There. Satisfied?"[/spk]\n[spk=Mara#2]"I'd be more satisfied if you'd said so a week ago."[/spk]` + L("bond Mara>Kael: trust +1 — the ledger was never his"),
    bad: `Both of them turned to look at Wren.` + L("clock: +1m"),
  },
  convergence: {
    good: `Kael looked at the drink for a long moment, then pushed it back an inch.` + L("clock: +2m"),
    bad: `Kael's face softened at once.` + L("bond Kael>Wren: trust +3 — a free drink"),
  },
  floor: {
    good: `Mara's head lolled; her hand found Wren's wrist and pushed it away, clumsy but certain. The innkeeper was already crossing the room with a blanket.` + L("clock: +2m\ncast: Mara@spot(slumped on the settle)"),
    bad: `He kissed her neck as the laces gave way.\n\n<ledger>\nclock: +2m\nmode: intimacy\n</ledger>`,
  },
  ledger: {
    good: `[spk=Mara#2]"Two shillings, and the bed's dry."[/spk]` + L("clock: +2m\nitem Room key: Mara → Wren — paid two shillings"),
    bad: `A room, then.\n\n\`\`\`\nclock +2m\n\`\`\``,
  },
};

describe("golden scenario checkers", () => {
  for (const g of GOLDEN) {
    test(`${g.id}: passes a good reply, catches a bad one`, () => {
      const c = CASES[g.id];
      expect(c).toBeDefined();
      expect(g.check(c.good, g)).toEqual([]);
      expect(g.check(c.bad, g).length).toBeGreaterThan(0);
    });
    test(`${g.id}: fixture history parses`, () => {
      for (const h of g.history.filter((_, i) => i % 2 === 0)) expect(/<ledger>/.test(h)).toBe(true);
    });
  }
});

describe("preset build", () => {
  test("the preset validates: ids, bindings, regexes, macro balance", () => {
    const p = buildPreset();
    expect(validate(p)).toEqual([]);
    expect(p.schemaVersion).toBe(2);
    // No router: every scene module is on and speaks only while the Almanac's scene mode is its own.
    expect(p.extensions.regex_scripts.some((s: any) => s.script_id === "alm-router" || s.metadata.prompt_activation)).toBe(false);
    const scenes = p.blocks.filter((b: any) => b.id.startsWith("alm-scene-"));
    expect(scenes.length).toBe(7);
    expect(scenes.every((b: any) => b.enabled === true && b.position === "in_history" && b.content.includes("{{eq::{{getvar::alm_mode}}::"))).toBe(true);
    expect(p.blocks.find((b: any) => b.id === "alm-director")!.placementBinding.variableId).toBe("alm-var-cot_placement");
  });
  test("only the router, the boundaries and the gate go out without the Ledger", () => {
    const p = buildPreset();
    for (const b of p.blocks.filter((b: any) => !b.marker && b.content)) {
      const gated = b.content.startsWith("{{if::{{getvar::alm_linked}}}}") && b.content.endsWith("{{/if}}");
      expect([b.id, gated]).toEqual([b.id, !["alm-boot", "alm-floor", "alm-gate"].includes(b.id)]);
    }
    // No standalone pieces: no Session Zero tag, no persisted scene state, no fallback plate, no Language setting.
    const ids = p.extensions.regex_scripts.map((s: any) => s.script_id);
    for (const gone of ["alm-session-zero", "alm-persist", "alm-show-plate", "alm-show-session-zero"]) expect(ids).not.toContain(gone);
    expect(p.blocks.flatMap((b: any) => b.variables ?? []).some((v: any) => ["language", "climate", "calendar", "start_point"].includes(v.name))).toBe(false);
    expect(JSON.stringify(p.blocks)).not.toContain(" lang=");
  });
  test("a stray brace in a block is caught", async () => {
    const { strayBrace } = await import("../preset/build");
    expect(strayBrace("{{if::{{ne::{{getvar::alm_header}}::off}}}}}header")).toContain('stray "}"');
    expect(strayBrace("{{if::{{ne::{{getvar::alm_header}}::off}}}}header")).toBeNull();
    expect(strayBrace("{{regex::^((?:\\S+\\s+){0,18}\\S+)$::$1::x::}}")).toBeNull();
  });
  test("the plate regex reads a header, with and without the Ledger's sun/moon suffix", async () => {
    const { PLATE_FIND } = await import("../src/core/plate/style");
    const re = new RegExp(PLATE_FIND);
    const plain = re.exec("🗓️ Day 3 · Tuesday, 14 October 1923 🕰️ 21:40 🌧️ rain, heavy · 9°C · wind SW\n📍 Lowmarket › Flagon\n# Salt in the Wound\n");
    expect(plain?.slice(1, 6)).toEqual(["Day 3 · Tuesday, 14 October 1923", "21", "40", "🌧", "rain, heavy · 9°C · wind SW"]);
    expect(plain?.[11]).toBe("Lowmarket › Flagon");
    expect(plain?.[12]).toBe("Salt in the Wound");
    const linked = re.exec("🗓️ Day 3 · Tuesday 🕰️ 07:05 ☀️ clear ⟪06:42|18:10|🌖 waning gibbous⟫\n📍 Coast");
    expect(linked?.slice(2, 4)).toEqual(["7", "05"]);
    expect(linked?.slice(6, 11)).toEqual(["06", "42", "18", "10", "🌖 waning gibbous"]);
  });
  test("the plate regex reads a header whose clock is a clock face, not 🕰", async () => {
    const { PLATE_FIND } = await import("../src/core/plate/style");
    const re = new RegExp(PLATE_FIND);
    const m = re.exec("🗓️ Day 2 · Wednesday 10 October 2001 🕛 11:48 🌤️ fair, 13°C · wind N ⟪06:26|17:34|🌕 full moon⟫\n📍 Sunnydale › Winters Residence › guest bedroom\n\n# Logistics");
    expect(m?.slice(1, 6)).toEqual(["Day 2 · Wednesday 10 October 2001", "11", "48", "🌤", "fair, 13°C · wind N"]);
    expect(m?.slice(6, 11)).toEqual(["06", "26", "17", "34", "🌕 full moon"]);
    expect(m?.[11]).toBe("Sunnydale › Winters Residence › guest bedroom");
    for (const clock of ["⏰", "🕐", "🕧", "⌚"]) expect(re.exec(`🗓️ Day 1 · Monday ${clock} 07:05 ☀️ clear`)?.slice(1, 4)).toEqual(["Day 1 · Monday", "7", "05"]);
  });
});

describe("speaker labels", () => {
  const INPUTS = [
    `Buffy#1|flat: "Great. Another one."`,
    `The door slammed.\nBuffy#1|flat: "Great." She rolled her eyes.`,
    `**Willow#2|whisper:** "Did you hear that?"`,
    `Giles#3: "Good heavens."`,
    `Xander#4|sly: Nice outfit.`,
    `[Buffy#1|cold]: "Leave."`,
    `Buffy#1|flat: *sighs* "Fine."`,
    `Spike#5|sly: “Evening, Slayer.”`,
    `mood Mara: guarded | V-1`,
    `<t who="Mara#2" cue="x">thought</t>`,
    `[spk=Buffy#1|flat]"Already fine."[/spk]`,
  ];
  test("the preset's repair rules and the extension's helper agree", async () => {
    const { fixSpeakerLabels } = await import("../src/core/dsl");
    const scripts = buildPreset().extensions.regex_scripts
      .filter((s: any) => s.script_id.startsWith("alm-spk-label-") && s.script_id !== "alm-spk-label-plain")
      .sort((a: any, b: any) => a.sort_order - b.sort_order);
    expect(scripts.length).toBe(4);
    for (const s of scripts) expect(s.target).toEqual(["response", "display", "prompt"]);
    const ungate = (f: string) => f.replace(/^\{\{if::[\s\S]*?\}\}\{\{else\}\}\(\?!\)\{\{\/if\}\}/, "");
    for (const input of INPUTS) {
      let out = input;
      for (const s of scripts) out = out.replace(new RegExp(ungate(s.find_regex), s.flags), s.replace_string);
      expect(out).toBe(fixSpeakerLabels(input));
    }
    expect(fixSpeakerLabels(INPUTS[0])).toBe(`[spk=Buffy#1|flat]"Great. Another one."[/spk]`);
  });
  test("the speech instruction forbids labels", () => {
    const craft = buildPreset().blocks.find((b: any) => b.content?.includes("[spk=Name#N]"));
    expect(craft?.content).toContain("never write Name#N: or Name#N|tone:");
  });
  test("a reply that speaks in bare quotes is caught; a marked one with a scare quote isn't", async () => {
    const { hasUnmarkedSpeech } = await import("../src/core/dsl");
    expect(hasUnmarkedSpeech(`"Clingy stayer."\n\nShe says it into his hair.\n\n"Oh."`)).toBe(true);
    expect(hasUnmarkedSpeech(`[spk=Buffy#1]"Hi."[/spk] The "plan" fails.\n\n[spk=Dawn#2]"Told you."[/spk]`)).toBe(false);
    expect(hasUnmarkedSpeech(`One "quote" only.`)).toBe(false);
    expect(hasUnmarkedSpeech(`Prose.\n<ledger>\njournal Buffy: "a" "b"\n</ledger>`)).toBe(false);
  });
  test("marks after their quotes and garbled closers are put right (Buffy chat #90, #160, #308, #364)", async () => {
    const { fixSpeech, hasMisplacedMarks, unmarkedLines, parseSpeech } = await import("../src/core/dsl");
    const after = `"He would — he would *sing* it?"[spk=Dawn#2][/spk]\n\n"It's a spoonful, babe."[spk=Gabriel#4][/spk]`;
    expect(hasMisplacedMarks(after)).toBe(true);
    expect(fixSpeech(after)).toBe(`[spk=Dawn#2]"He would — he would *sing* it?"[/spk]\n\n[spk=Gabriel#4]"It's a spoonful, babe."[/spk]`);
    // the moved mark covers the paragraph's other quote; a duplicate mark after a marked quote goes
    expect(fixSpeech(`"What is on my food." She swallows. "Is this caviar —"[spk=Buffy#1][/spk]`))
      .toBe(`[spk=Buffy#1]"What is on my food."[/spk] She swallows. [spk=Buffy#1]"Is this caviar —"[/spk]`);
    expect(fixSpeech(`[spk=Buffy#1]"You're staying, right?"[spk=Buffy#1][/spk]`)).toBe(`[spk=Buffy#1]"You're staying, right?"[/spk]`);
    // garbled closers: a name takes the reply's voice number; nameless ones close the paragraph's one speaker
    expect(fixSpeech(`[spk=Buffy#1]"Hi."[/spk]\n\n"She likes it."[/spkbuffy]\n\n"Someday."[/spkbuffy1]`))
      .toBe(`[spk=Buffy#1]"Hi."[/spk]\n\n[spk=Buffy#1]"She likes it."[/spk]\n\n[spk=Buffy#1]"Someday."[/spk]`);
    expect(fixSpeech(`[spk=Dawn#2]"Yeah."[/spspk] [spk=Dawn#2]"No — "[/spk]*she looks*"— okay."[/spk]`))
      .toBe(`[spk=Dawn#2]"Yeah."[/spk] [spk=Dawn#2]"No — "[/spk]*she looks*[spk=Dawn#2]"— okay."[/spk]`);
    // a closer with no speaker in its paragraph just goes; a label left mid-line goes
    expect(fixSpeech(`[spk=Dawn#2]"x"[/spk]\n\n"Wow. Back me up — "[/spk]`)).toBe(`[spk=Dawn#2]"x"[/spk]\n\n"Wow. Back me up — "`);
    expect(fixSpeech(`[spk=Buffy#1]"So. Xena."[/spk] Flat. Casual. Buffy#1: "Who's second."[/spk]`))
      .toBe(`[spk=Buffy#1]"So. Xena."[/spk] Flat. Casual. [spk=Buffy#1]"Who's second."[/spk]`);
    // well-formed replies and other marks are left alone
    const good = `[spk=Buffy#1]"Hi."[/spk] She "plans".\n\n[thk=Dawn#2]Ugh.[/thk] "Fine."[/thk]`;
    expect(fixSpeech(good)).toBe(good);
    expect(hasMisplacedMarks(`[spk=Buffy#1]"Hi."[/spk]`)).toBe(false);
    expect(parseSpeech(after).map((l) => l.who)).toEqual(["Dawn", "Gabriel"]);
    // a bare line between voice cards is reported; an inline scare quote isn't
    expect(unmarkedLines(`[spk=Dawn#2]"Hi."[/spk]\n\n"Shut up. I'm cold."\n\nThe "plan" holds.`)).toEqual([`"Shut up. I'm cold."`]);
    expect(unmarkedLines(`"Bare."\n\n"Only."`)).toEqual([]);
  });
  test("the handshake carries the Dialogue blocks switch", () => {
    expect(JSON.stringify(buildPreset().blocks)).toContain(`color=\\"{{default::{{var::dialogue_color}}::1}}\\"`);
  });
});

describe("emphasis inside speech", () => {
  test("*italics* and **bold** in a spoken line become tags; narration is left to markdown", async () => {
    const { REGEX } = await import("../preset/src/regex");
    let out = `She said *hi*.\n[spk=Buffy#1|flat]"Young men don't say *alrighty-lefty*, Gabriel. **Ever.**"[/spk] *walks off*\n[spk=Gabriel#0]"2 * 3 = 6"[/spk]`;
    for (const id of ["alm-show-speech-strong", "alm-show-speech-em", "alm-show-speech-em2"]) {
      const r = REGEX.find((x) => x.id === id)!;
      out = out.replace(new RegExp(r.find, r.flags ?? "g"), r.rep);
    }
    expect(out).toBe(`She said *hi*.\n[spk=Buffy#1|flat]"Young men don't say <em>alrighty-lefty</em>, Gabriel. <strong>Ever.</strong>"[/spk] *walks off*\n[spk=Gabriel#0]"2 * 3 = 6"[/spk]`);
  });
});

describe("speech marks with a stage note", () => {
  test("[spk=Buffy#1|muffled, into his chest] still becomes a voice card, toned by its first word", async () => {
    const { REGEX } = await import("../preset/src/regex");
    const ungate = (f: string) => f.replace(/^\{\{if::[\s\S]*?\}\}\{\{else\}\}\(\?!\)\{\{\/if\}\}/, "");
    const line = `[spk=Buffy#1|muffled, into his chest]"Don't let go."[/spk]`;
    for (const id of ["alm-show-speech-block", "alm-show-speech-chip", "alm-show-speech-tint"]) {
      const r = REGEX.find((x) => x.id === id)!;
      const m = new RegExp(ungate(r.find), r.flags ?? "g").exec(line);
      expect(m?.slice(1, 6).filter(Boolean)).toContain("muffled");
    }
  });
});

describe("meters and summaries", () => {
  test("the note names meters in words, never 'fatigue 4'", async () => {
    const { meterWord } = await import("../src/core/note");
    expect(meterWord("fatigue", 4)).toBe("exhausted");
    expect(meterWord("hunger", 5)).toBe("starving");
    expect(meterWord("fatigue", 4)).not.toMatch(/\d/);
  });
  test("summary detail changes length and sections", async () => {
    const { summaryPrompt } = await import("../src/core/prompts");
    const brief = summaryPrompt("chapter", { userName: "Gabriel", transcript: "x", detail: "brief" });
    const full = summaryPrompt("chapter", { userName: "Gabriel", transcript: "x", detail: "exhaustive", focus: "outfits" });
    expect(brief.system).toContain("100–200 words");
    expect(brief.user).not.toContain("Where things stand");
    expect(full.system).toContain("700–1200 words");
    expect(full.user).toContain("Where things stand");
    expect(full.system).toContain("always keep: outfits");
  });
});
