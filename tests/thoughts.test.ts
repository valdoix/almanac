// Thoughts and the last reply's changes, as the Now widget reads them.
import { expect, test } from "bun:test";
import { LedgerRuntime, toPath, type RawChatMessage } from "../src/core/branch";
import { parseInlineThoughts, parseMessage } from "../src/core/dsl";
import type { FoldOptions } from "../src/core/state";
import { replyChanges } from "../src/core/changes";
import { hasThoughtsTab, hudCard, hudPill, hudTab } from "../src/frontend/hud";

const OPTS: FoldOptions = { userName: "Wren", strictness: "strict", sealed: true, romance: "slow" };
const msg = (i: number, content: string, isUser = false): RawChatMessage => ({ id: `m${i}`, index_in_chat: i, is_user: isUser, content, swipes: [content], swipe_id: 0 });

const R1 = `🗓️ Day 1 · Monday 🕰️ 18:40 🌧️ rain, light · 11°C
📍 Lowmarket › The Rusty Flagon
[spk=Mara#1]"You covered for him."[/spk]
<unspoken>
<t who="Mara#1" cue="her thumb keeps finding the locket's clasp">If he opens that letter he'll know I read it first.</t>
<t who="Wren" cue="a hand on the key">Too easy.</t>
</unspoken>
<ledger>
cast: Mara@spot(by the fire)
mood Mara: wary
mode: social
</ledger>`;

const R2 = `Prose. [thk=Mara#1]Let the rain take the blame for the wax.[/thk]

More prose.
<ledger>
mood Mara: warm
bond Mara>Wren: trust +1 — he covered for her with the watch
owe Wren → Mara: a favour | due
mode: social
</ledger>`;

test("inline thought marks parse like the display regex ends them", () => {
  expect(parseInlineThoughts(`a [thk=Mara#1|sly]one[/thk] b [thk=Kael]two\n\nnext`)).toEqual([
    { who: "Mara", slot: 1, text: "one", kind: "inline" },
    { who: "Kael", slot: undefined, text: "two", kind: "inline" },
  ]);
  const p = parseMessage(R2);
  expect(p.thoughts?.map((t) => t.kind)).toEqual(["inline"]);
});

test("the last reply's thoughts are kept; a sealed persona's are dropped unless asked for", () => {
  const rt = new LedgerRuntime();
  const { state } = rt.fold(toPath([msg(0, R1)]), OPTS);
  expect(state.thoughts?.msgIndex).toBe(0);
  expect(state.thoughts?.list.map((t) => [t.name, t.kind, t.cue])).toEqual([["Mara", "register", "her thumb keeps finding the locket's clasp"]]);
  const withPersona = new LedgerRuntime().fold(toPath([msg(0, R1)]), { ...OPTS, personaThoughts: true }).state;
  expect(withPersona.thoughts?.list.map((t) => t.who)).toEqual([expect.any(String), "user"]);
  // The player's message doesn't clear them; the next reply replaces them.
  const later = new LedgerRuntime().fold(toPath([msg(0, R1), msg(1, "I nod.", true), msg(2, R2)]), OPTS).state;
  expect(later.thoughts?.msgIndex).toBe(2);
  expect(later.thoughts?.list[0]).toMatchObject({ name: "Mara", kind: "inline", text: "Let the rain take the blame for the wax." });
  expect(new LedgerRuntime().fold(toPath([msg(0, R1), msg(1, "I nod.", true)]), OPTS).state.thoughts?.msgIndex).toBe(0);
  // A long thought is kept whole (chat 5b751a70 had ones of 900+ characters cut at 600).
  const long = "I keep counting the exits. ".repeat(40).trim();
  const kept = new LedgerRuntime().fold(toPath([msg(0, R1.replace("Too easy.", long).replace('who="Mara#1" cue="her thumb keeps finding the locket\'s clasp">If he opens that letter he\'ll know I read it first.', `who="Mara#1" cue="exits">${long}`))]), OPTS).state;
  expect(kept.thoughts?.list[0].text).toBe(long);
});

test("what the last reply changed: bond moves with old and new value, mood, a due debt", () => {
  const { state } = new LedgerRuntime().fold(toPath([msg(0, R1), msg(1, "I nod.", true), msg(2, R2)]), OPTS);
  const nm = (id: string) => (id === "user" ? "Wren" : state.chars[id]?.name ?? id);
  const ch = replyChanges(state, nm, () => "#c33");
  expect(ch.msg).toBe(2);
  const bond = ch.rows.find((r) => r.kind === "bond");
  expect(bond).toMatchObject({ text: "Mara → Wren · trust", tone: "up", bond: { from: 0, to: 1, delta: 1 } });
  expect(ch.rows.find((r) => r.kind === "mood")?.text).toBe("Mara: wary → warm");
  expect(ch.rows.find((r) => r.kind === "debt")?.tone).toBe("due");
  const mara = Object.values(state.chars).find((c) => c.name === "Mara")!;
  expect(mara.mood?.msg).toBe(2);
});

test("the widget: a change badge, the Unspoken tab only when inner voice isn't off", () => {
  const v: any = {
    now: { time: "18:52", band: "dusk", place: ["Lowmarket"] }, cast: [], world: { cons: [], deadlines: [] },
    changes: { msg: 2, rows: [{ icon: "🎭", kind: "mood", text: "Mara: wary → warm" }] },
    thoughts: { msg: 2, innerVoice: "register", list: [{ name: "Mara", color: "#c33", isUser: false, cue: "her thumb", text: "secret", kind: "register" }] },
  };
  expect(hudPill(v, undefined, { tab: "changed", narr: false, unseen: 1, opened: new Set() })).toContain("alm-hudw__badge");
  const ui = { tab: "unspoken", narr: false, unseen: 0, opened: new Set<string>() };
  const sealed = hudCard(v, ui);
  expect(sealed).toContain("break the seal");
  expect(sealed).not.toContain("secret<");
  ui.opened.add("2:0");
  expect(hudCard(v, ui)).toContain("secret<em>");
  expect(hasThoughtsTab({ ...v, thoughts: { ...v.thoughts, innerVoice: "off" } })).toBe(false);
  expect(hasThoughtsTab({ ...v, thoughts: { msg: -1, innerVoice: "", list: [] } })).toBe(false);
  // Off: the tab is gone and the window falls back to what changed.
  expect(hudCard({ ...v, thoughts: { ...v.thoughts, innerVoice: "off" } }, ui)).toContain('data-tab="changed"');
  // The Unspoken dot means unread: gone once the player has looked at the tab, earlier reply or not.
  const dot = (u: any) => hudCard(v, { narr: false, unseen: 0, opened: new Set(), ...u }).includes('class="dot soft"');
  expect(dot({ tab: "changed" })).toBe(true);
  expect(dot({ tab: "changed", thoughtsSeen: true })).toBe(false);
  expect(dot({ tab: "unspoken" })).toBe(false);
  expect(hudCard({ ...v, changes: { msg: 4, rows: [] } }, { tab: "changed", narr: false, unseen: 0, opened: new Set() })).toContain('class="dot soft"');
});

test("the widget docks: a tab against its edge, and the window offers to float again", () => {
  const v: any = { now: { time: "15:37", band: "afternoon", place: ["Sunnydale", "living room"], weather: { glyph: "⛅", tempC: 12, condition: "fair" } }, cast: [{ name: "Buffy Summers", tier: "spot", color: "#c33" }], world: {}, changes: { msg: 1, rows: [] } };
  const tab = hudTab(v, "right", undefined, { tab: "changed", narr: false, unseen: 3, opened: new Set() });
  expect(tab).toContain("alm-hudt--right");
  expect(tab).toContain("data-hud-tab");
  expect(tab).toContain("15:37");
  expect(tab).toContain("alm-hudw__badge");
  expect(hudTab(null, "left", "connecting…")).toContain("connecting");
  expect(hudCard(v, { tab: "changed", narr: false, unseen: 0, opened: new Set(), dock: "left" })).toContain("Float the widget again");
  expect(hudCard(v)).toContain("Dock to the screen edge");
  // The place chip keeps every part, so the last one can stay readable when it narrows.
  expect(hudCard(v)).toContain('<b class="last">living room</b>');
});

test("what the real chat wrote: restated weather, a line about two people, a mood with its reason", () => {
  expect(parseMessage("<ledger>\nwx: unchanged\n</ledger>").ops.filter((o) => o.op === "wx")).toEqual([]);
  expect(parseMessage("<ledger>\nwx: unchanged — heavy rain, 12°C, wind NW\n</ledger>").ops[0].args).toMatchObject({ condition: "heavy rain", tempC: 12 });
  const mood = parseMessage("<ledger>\nmood Buffy: flustered-wrecked → tender-open (V+3 A4 D-2) — the song broke her open\n</ledger>").ops[0];
  expect(mood.args).toMatchObject({ name: "tender-open", prev: "flustered-wrecked", v: 3, a: 4, d: -2 });
  expect(mood.cause).toBe("the song broke her open");
  const R = `<ledger>\ncast: Buffy@spot(by the TV)\nknow: Buffy → Gabriel: she almost said it — Gabriel heard the attempt\nmode: social\n</ledger>`;
  const { state } = new LedgerRuntime().fold(toPath([msg(0, R1), msg(1, "…", true), msg(2, R.replace("Buffy", "Mara").replace("Buffy", "Mara"))]), OPTS);
  expect(Object.values(state.chars).map((c) => c.name)).not.toContain("Mara → Gabriel");
  expect(Object.values(state.chars).find((c) => c.id.startsWith("mara"))?.name).toBe("Mara");
});
