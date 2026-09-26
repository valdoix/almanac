// Preset harness: renders every block through Lumiverse's real macro engine in
// several scenarios (standalone, linked, OOC, command, swipe, continue, full cast)
// and runs the display regex suite over a sample reply.
//
//   LUMIVERSE_SRC=/path/to/Lumiverse bun run preset/harness.ts [--html out.html]
//
// Fails (exit 1) if any rendered block leaves macro syntax behind or a display
// regex throws. Token counts are rough (chars / 4).
import { writeFileSync } from "node:fs";
import { buildPreset } from "./build";
import { OPENING, SAMPLE_REPLY, SAMPLE_USER } from "./fixtures";
import { LedgerRuntime, toPath } from "../src/core/branch";
import { almanacFor } from "../src/core/engines/almanac";
import { plateSuffix, renderDrawer, speakerCss } from "../src/core/render";

const SRC = process.env.LUMIVERSE_SRC;
if (!SRC) {
  console.error("Set LUMIVERSE_SRC to a Lumiverse checkout (the macro engine lives in src/macros).");
  process.exit(2);
}
const { evaluate } = await import(`${SRC}/src/macros/MacroEvaluator`);
const { registry } = await import(`${SRC}/src/macros/MacroRegistry`);
const { initMacros } = await import(`${SRC}/src/macros/index`);
initMacros();

const preset = buildPreset();

// The Ledger's push macros, as it would register them when installed.
const LINKED: Record<string, string> = {
  almActive: "yes", almDay: "3", almClock: "21:40", almTime: "Day 3 · 21:40", almWeather: "🌧️ rain, moderate · 9°C · wind SW", almForecast: "rain easing to drizzle by 01:00; clearing before dawn",
  almSun: "rise 07:12 · set 17:41", almMoon: "🌖 waning gibbous", almSeason: "late autumn", almPlace: "Lowmarket › The Rusty Flagon › back room", almVoices: "Mara#2 · Kael#5 · Joss#3 · Wren#0",
  almCast: "Mara (spot), Kael (peri)", almMode: "conflict", almDue: "Mara owes Wren a favour", almReturning: "no",
};
function setLinked(on: boolean) {
  for (const [name, value] of Object.entries(LINKED)) {
    if (on) registry.registerMacro({ name, category: "extension:almanac_ledger", description: name, handler: () => value });
    else registry.unregisterMacro?.(name);
  }
}

function defaults() {
  const values: Record<string, string> = {};
  const selections: Record<string, string[]> = {};
  for (const b of preset.blocks) for (const v of b.variables ?? []) {
    if (v.type === "multiselect") {
      selections[v.name] = v.defaultValue;
      values[v.name] = v.defaultValue.map((id: string) => v.options.find((o: any) => o.id === id)?.value ?? id).join(v.separator ?? "\n\n");
    } else values[v.name] = String(v.defaultValue);
  }
  return { values, selections };
}

interface Scenario {
  name: string;
  gen: string;
  linked?: boolean;
  lastUser?: string;
  lastChar?: string;
  rejected?: string;
  count?: number;
  model?: string;
  vars?: Record<string, string>;
  chatVars?: Record<string, string>;
}

const SCENARIOS: Scenario[] = [
  { name: "standalone · scene", gen: "normal" },
  { name: "linked · scene", gen: "normal", linked: true },
  { name: "linked · sidecar + visible off", gen: "normal", linked: true, vars: { cot_channel: "sidecar" } },
  { name: "standalone · swipe", gen: "swipe", rejected: "🗓️ Day 3 · Tuesday 🕰️ 21:40 🌧️ rain\n📍 Lowmarket › Flagon\n# Salt\n\nMara set the glass down so hard the stem cracked, and the room went quiet around her." },
  { name: "standalone · continue", gen: "continue" },
  { name: "standalone · OOC", gen: "normal", lastUser: "((quick question: is Kael armed?))" },
  { name: "standalone · /recap", gen: "normal", lastUser: "/recap" },
  { name: "standalone · /skip", gen: "normal", lastUser: "/skip until morning" },
  { name: "standalone · /session0", gen: "normal", lastUser: "/session0" },
  { name: "full cast · explicit · visible · deep", gen: "normal", model: "deepseek-r1", vars: { persona_mode: "full_cast", nsfw: "explicit", cot_channel: "visible", cot: "deep", outcomes: "fair_roll", inner_voice: "register", persona_thoughts: "1", ledger: "snapshot" } },
  { name: "session-zero overrides", gen: "normal", chatVars: { alm_cfg_genres: "horror, mystery", alm_cfg_persona: "director", alm_cfg_nsfw: "off", alm_cfg_romance: "off", alm_cfg_limits: "gore > 3", alm_mode: "investigation" } },
  { name: "impersonate", gen: "impersonate" },
];

const LEFTOVER = /\{\{[^}]*\}\}|\{\{|\}\}/;
let failures = 0;

async function renderScenario(sc: Scenario) {
  setLinked(!!sc.linked);
  const { values, selections } = defaults();
  Object.assign(values, sc.vars ?? {});
  const env: any = {
    commit: true,
    names: { user: "Wren", char: "Mara", isGroupChat: "no", charGroupFocused: "", group: "", groupNotMuted: "", notChar: "Wren", groupOthers: "" },
    character: { name: "Mara" },
    chat: { id: "c1", messageCount: sc.count ?? 24, lastUserMessage: sc.lastUser ?? SAMPLE_USER, lastCharMessage: sc.lastChar ?? SAMPLE_REPLY, lastMessage: sc.lastUser ?? SAMPLE_USER, rejectedSwipe: sc.rejected ?? "", lastMessageName: "Wren" },
    system: { model: sc.model ?? "claude-opus", lastGenerationType: sc.gen },
    variables: { local: new Map(Object.entries(values)), global: new Map(), chat: new Map(Object.entries(sc.chatVars ?? {})) },
    dynamicMacros: {},
    extra: { messages: [], promptVariables: values, promptVariableSelections: selections, lastMessageTime: Date.now() - 3 * 3600_000, memory: { enabled: false, count: 0 }, loom: {}, sovereignHand: {} },
  };
  const out: { id: string; text: string }[] = [];
  for (const b of preset.blocks) {
    if (b.marker || !b.enabled && !b.id.startsWith("alm-scene-")) continue;
    if (b.injectionTrigger.length && !b.injectionTrigger.includes(sc.gen)) continue;
    env.promptBlock = { id: b.id, name: b.name, role: b.role, position: b.position, depth: b.depth };
    const text = String((await evaluate(b.content, env, registry)).text);
    const bad = text.match(LEFTOVER);
    if (bad) {
      failures++;
      console.log(`  ✗ ${b.id}: leftover macro syntax ${JSON.stringify(bad[0])} … ${JSON.stringify(text.slice(Math.max(0, (bad.index ?? 0) - 60), (bad.index ?? 0) + 60))}`);
    }
    if (text.trim()) out.push({ id: b.id, text });
  }
  return { out, chatVars: Object.fromEntries(env.variables.chat), local: env.variables.local };
}

const tokens = (s: string) => Math.round(s.length / 4);
const verbose = process.argv.includes("--verbose");
for (const sc of SCENARIOS) {
  const { out, chatVars, local } = await renderScenario(sc);
  const total = out.reduce((n, o) => n + tokens(o.text), 0);
  console.log(`\n■ ${sc.name} — ${out.length} blocks, ≈${total} tokens · route=${local.get("alm_route")} linked=${local.get("alm_linked")} mode=${local.get("alm_mode")} genres=${local.get("alm_genres")}`);
  if (verbose) for (const o of out) console.log(`--- ${o.id} (≈${tokens(o.text)})\n${o.text}`);
  else console.log("  " + out.map((o) => `${o.id.replace(/^alm-/, "")}:${tokens(o.text)}`).join(" · "));
  if (sc.name === "standalone · scene") console.log("  ui chat vars:", JSON.stringify(chatVars));
}

// ── Display regex over a sample reply ───────────────────────────────────────
/** JS String.replace template expansion for one match ($$, $&, $1…$99, $<name>). */
function expand(tpl: string, m: RegExpMatchArray): string {
  return tpl.replace(/\$(\$|&|<([^>]*)>|(\d{1,2}))/g, (all, what, name, num) => {
    if (what === "$") return "$";
    if (what === "&") return m[0];
    if (name !== undefined) return m.groups?.[name] ?? "";
    let n = parseInt(num, 10);
    if (n >= m.length && num.length === 2) return (m[parseInt(num[0], 10)] ?? "") + num[1];
    return n < m.length ? m[n] ?? "" : all;
  });
}

/** The reply as the Ledger's render processor hands it to display regex: plate suffix + compiled drawer. */
function linkedReply(): { html: string; css: string } {
  const rt = new LedgerRuntime();
  const raw = [OPENING, SAMPLE_USER, SAMPLE_REPLY].map((content, i) => ({ id: `m${i}`, index_in_chat: i, is_user: i === 1, content, swipes: [content], swipe_id: 0 }));
  const { state } = rt.fold(toPath(raw), { userName: "Wren", strictness: "strict", sealed: true, romance: "slow" });
  const al = almanacFor(state, { chatId: "c1", climate: "temperate maritime" });
  const drawer = renderDrawer({ state, delta: state.lastDelta, almanac: al, colors: {}, userName: "Wren", sealed: true, nsfw: false, view: "drawer", latest: true });
  let html = SAMPLE_REPLY;
  if (al) html = html.replace(/^([ \t]*🗓[^\n]*?)[ \t]*$/mu, (_m, line) => `${line}${plateSuffix(al)}`);
  html = html.replace(/<ledger\b[^>]*>[\s\S]*?<\/ledger>/i, `\n\n${drawer}\n`);
  return { html, css: speakerCss(state, {}) };
}
async function display(content: string, isUser: boolean, depth: number, chatVars: Record<string, string>) {
  const env: any = {
    commit: false, names: { user: "Wren", char: "Mara", isGroupChat: "no" }, character: { name: "Mara" },
    chat: { id: "c1", messageCount: 24 }, system: { model: "x", lastGenerationType: "normal" },
    variables: { local: new Map(), global: new Map(), chat: new Map(Object.entries(chatVars)) }, dynamicMacros: {}, extra: {},
  };
  const scripts = preset.extensions.regex_scripts
    .filter((s: any) => s.target.includes("display") && s.placement.includes(isUser ? "user_input" : "ai_output") && !s.disabled)
    .filter((s: any) => (s.min_depth == null || depth >= s.min_depth) && (s.max_depth == null || depth <= s.max_depth))
    .sort((a: any, b: any) => a.sort_order - b.sort_order);
  let text = content;
  for (const s of scripts) {
    try {
      const find = s.substitute_macros === "none" ? s.find_regex : String((await evaluate(s.find_regex, env, registry)).text);
      const re = new RegExp(find, s.flags);
      if (s.substitute_macros === "raw") {
        const parts: string[] = [];
        let last = 0;
        const all = s.flags.includes("g") ? [...text.matchAll(re)] : [text.match(re)].filter(Boolean) as RegExpMatchArray[];
        for (const m of all) {
          const tpl = expand(s.replace_string, m);
          parts.push(text.slice(last, m.index), String((await evaluate(tpl, env, registry)).text));
          last = (m.index ?? 0) + m[0].length;
        }
        parts.push(text.slice(last));
        text = parts.join("");
      } else text = text.replace(re, s.replace_string);
    } catch (e) {
      failures++;
      console.log(`  ✗ display ${s.script_id}: ${(e as Error).message}`);
    }
  }
  return text;
}

const htmlArg = process.argv.indexOf("--html");
const uiVars = { alm_ui_style: "blocks", alm_ui_color: "1", alm_ui_align: "stage", alm_ui_view: "drawer", alm_ui_panels: "scene, cast, bonds, thoughts, inventory, threads, knowledge", alm_ui_lead: "mystery", alm_place: "The Rusty Flagon › back room", alm_wx: "heavy rain" };
const sections: string[] = [];
for (const style of ["blocks", "chips", "tint", "script"]) {
  const html = await display(SAMPLE_REPLY, false, 0, { ...uiVars, alm_ui_style: style });
  if (/\[spk=|\[\/spk\]|<ledger>|<unspoken>|<plan>|\[vtk=|🕰️?\s*\d{1,2}:\d\d|\[txt|\[thk|\[\[alm-desk/.test(html)) {
    failures++;
    console.log(`  ✗ display (${style}): raw marks survived`);
  }
  if (LEFTOVER.test(html.replace(/<style>[\s\S]*?<\/style>/g, ""))) {
    failures++;
    console.log(`  ✗ display (${style}): leftover macro syntax: ${JSON.stringify(html.match(/.{0,60}(\{\{|\}\}).{0,60}/)?.[0])}`);
  }
  sections.push(`<section data-style="${style}"><h2>${style}</h2><div class="msg">${html}</div></section>`);
}
sections.push(`<section><h2>older reply (depth 3)</h2><div class="msg">${await display(SAMPLE_REPLY.split("\n\n").slice(0, 3).join("\n\n"), false, 3, { ...uiVars, alm_ui_lead: "romance" })}</div></section>`);
const linked = linkedReply();
sections.push(`<section class="linked"><h2>linked (extension rendered the drawer)</h2><div class="msg">${await display(linked.html, false, 0, { ...uiVars, alm_ui_lead: "fantasy" })}</div></section>`);
sections.push(`<section><h2>player</h2><div class="msg user">${await display(SAMPLE_USER, true, 1, uiVars)}</div></section>`);
if (htmlArg > 0) {
  const out = process.argv[htmlArg + 1];
  const ext = process.argv.includes("--ext") ? await import("../src/frontend/styles") : null;
  writeFileSync(out, `<!doctype html>${ext ? `<style>${ext.TOKENS}${ext.MESSAGE_CSS}${linked.css}</style>` : ""}<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ALMANAC preview</title><style>body{margin:0;padding:18px;background:#16171c;color:#e6e2da;font:17px/1.6 Georgia,serif}section{max-width:760px;margin:0 auto 40px}h2{font:600 12px/1 ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;color:#c9a45c}.msg{padding:14px 18px;border-radius:14px;background:#1d1e24;white-space:pre-wrap}.msg.user{background:#23242b}</style>${sections.join("\n")}`);
  console.log(`\npreview → ${out}`);
}

console.log(failures ? `\n${failures} problem(s)` : "\nall scenarios rendered cleanly");
process.exit(failures ? 1 : 0);
