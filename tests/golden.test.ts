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
  test("the preset validates: ids, bindings, router targets, regexes, macro balance", () => {
    const p = buildPreset();
    expect(validate(p)).toEqual([]);
    expect(p.schemaVersion).toBe(2);
    const router = p.extensions.regex_scripts.find((s: any) => s.script_id === "alm-router")!;
    expect(router.metadata.prompt_activation.mappings.length).toBe(8);
    const scenes = p.blocks.filter((b: any) => b.id.startsWith("alm-scene-"));
    expect(scenes.every((b: any) => b.enabled === false && b.position === "in_history")).toBe(true);
    expect(p.blocks.find((b: any) => b.id === "alm-director")!.placementBinding.variableId).toBe("alm-var-cot_placement");
  });
  test("the plate regex reads a header, with and without the Ledger's sun/moon suffix", async () => {
    const { PLATE_FIND } = await import("../preset/src/plate");
    const re = new RegExp(PLATE_FIND);
    const plain = re.exec("🗓️ Day 3 · Tuesday, 14 October 1923 🕰️ 21:40 🌧️ rain, heavy · 9°C · wind SW\n📍 Lowmarket › Flagon\n# Salt in the Wound\n");
    expect(plain?.slice(1, 6)).toEqual(["Day 3 · Tuesday, 14 October 1923", "21", "40", "🌧", "rain, heavy · 9°C · wind SW"]);
    expect(plain?.[11]).toBe("Lowmarket › Flagon");
    expect(plain?.[12]).toBe("Salt in the Wound");
    const linked = re.exec("🗓️ Day 3 · Tuesday 🕰️ 07:05 ☀️ clear ⟪06:42|18:10|🌖 waning gibbous⟫\n📍 Coast");
    expect(linked?.slice(2, 4)).toEqual(["7", "05"]);
    expect(linked?.slice(6, 11)).toEqual(["06", "42", "18", "10", "🌖 waning gibbous"]);
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
});
