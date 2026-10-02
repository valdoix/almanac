// Preset harness: renders every block through Lumiverse's real macro engine in
// several scenarios (a managed chat's turns, OOC, commands, swipe, continue, full
// cast, the first turn while the Ledger arms, and the gate without the Ledger),
// checks the ledger example parses, and runs the display regex suite over a sample reply.
//
//   LUMIVERSE_SRC=/path/to/Lumiverse bun run preset/harness.ts [--html out.html]
//
// Fails (exit 1) if any rendered block leaves macro syntax behind or a display
// regex throws. Token counts are rough (chars / 4).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildPreset } from "./build";
import { OPENING, SAMPLE_REPLY, SAMPLE_USER } from "./fixtures";
import { LedgerRuntime, toPath } from "../src/core/branch";
import { almanacFor } from "../src/core/engines/almanac";
import { plateSuffix, renderDrawer, speakerCss } from "../src/core/render";
import { parseMessage } from "../src/core/dsl";
import { drawPlates } from "../src/core/plate";

const SRC = process.env.LUMIVERSE_SRC;
if (!SRC) {
  console.error("Set LUMIVERSE_SRC to a Lumiverse checkout (the macro engine lives in src/macros).");
  process.exit(2);
}
// One module URL per file: on Windows a forward-slash path and the engine's own relative imports
// load two copies of a module, so macros would register into a registry `evaluate` never reads.
const engine = (file: string) => import(pathToFileURL(join(SRC, "src", "macros", file)).href);
const { evaluate } = await engine("MacroEvaluator.ts");
const { registry } = await engine("MacroRegistry.ts");
const { initMacros } = await engine("index.ts");
initMacros();

const preset = buildPreset();

// The Ledger's push macros, as it would register them when installed.
const LINKED: Record<string, string> = {
  almActive: "yes", almDay: "3", almClock: "21:40", almTime: "Day 3 · 21:40", almWeather: "🌧️ rain, moderate · 9°C · wind SW", almForecast: "rain easing to drizzle by 01:00; clearing before dawn",
  almSun: "rise 07:12 · set 17:41", almMoon: "🌖 waning gibbous", almSeason: "late autumn", almPlace: "Lowmarket › The Rusty Flagon › back room", almVoices: "Mara#2 · Kael#5 · Joss#3 · Wren#0",
  almCast: "Mara (spot), Kael (peri)", almMode: "conflict", almDue: "Mara owes Wren a favour", almReturning: "no", almCalendar: "", almDie: "14",
};
/** The first prompt of a chat the Ledger is about to arm: it reports "arming" and has no state yet. */
const ARMING: Record<string, string> = Object.fromEntries(Object.keys(LINKED).map((k) => [k, k === "almActive" ? "arming" : ""]));
function setExt(values: Record<string, string> | null) {
  for (const name of Object.keys(LINKED)) {
    registry.unregisterMacro?.(name);
    if (values) registry.registerMacro({ name, category: "extension:almanac_ledger", description: name, handler: () => values[name] ?? "" });
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
  /** The Ledger's macros; null = the extension isn't installed. Default: a managed chat. */
  ext?: Record<string, string> | null;
  lastUser?: string;
  /** The chat's last message, when it isn't the player's (an empty send). */
  lastMessage?: string;
  lastChar?: string;
  rejected?: string;
  count?: number;
  model?: string;
  vars?: Record<string, string>;
  chatVars?: Record<string, string>;
}

const SCENARIOS: Scenario[] = [
  { name: "scene", gen: "normal" },
  { name: "first turn · Ledger arming", gen: "normal", ext: ARMING, count: 2 },
  { name: "sidecar planner", gen: "normal", vars: { cot_channel: "sidecar" } },
  { name: "swipe", gen: "swipe", rejected: "🗓️ Day 3 · Tuesday 🕰️ 21:40 🌧️ rain\n📍 Lowmarket › Flagon\n# Salt\n\nMara set the glass down so hard the stem cracked, and the room went quiet around her." },
  { name: "continue", gen: "continue" },
  { name: "OOC", gen: "normal", lastUser: "((quick question: is Kael armed?))" },
  { name: "OOC · single parentheses", gen: "normal", lastUser: "(OOC: it's Day 26, not Day 3)" },
  { name: "/recap", gen: "normal", lastUser: "/recap" },
  { name: "/skip", gen: "normal", lastUser: "/skip until morning" },
  { name: "/session0", gen: "normal", lastUser: "/session0" },
  { name: "unknown command", gen: "normal", lastUser: "/recpa" },
  { name: "empty send after a command", gen: "normal", lastUser: "/recap", lastMessage: "<folio title=\"Previously on…\">Mara kept the locket.</folio>" },
  { name: "swipe of a command reply", gen: "swipe", lastUser: "/recap" },
  { name: "full cast · explicit · visible · deep", gen: "normal", model: "deepseek-r1", vars: { persona_mode: "full_cast", nsfw: "explicit", cot_channel: "visible", cot: "deep", outcomes: "fair_roll", inner_voice: "register", persona_thoughts: "1" } },
  { name: "native · deepseek (reasoning prefill)", gen: "normal", model: "deepseek-reasoner", vars: { cot: "lean" } },
  { name: "intimacy · explicit · extended", gen: "normal", vars: { nsfw: "explicit", vocab: "crude", intimacy_length: "extended" }, ext: { ...LINKED, almMode: "intimacy" } },
  { name: "intimacy · fade", gen: "normal", vars: { nsfw: "fade", intimacy_length: "extended" }, ext: { ...LINKED, almMode: "intimacy" } },
  { name: "intimacy · sensual · brief", gen: "normal", vars: { nsfw: "sensual", vocab: "tasteful", intimacy_length: "brief" }, ext: { ...LINKED, almMode: "intimacy" } },
  { name: "session-zero overrides", gen: "normal", chatVars: { alm_cfg_genres: "horror, mystery", alm_cfg_persona: "director", alm_cfg_nsfw: "off", alm_cfg_romance: "off", alm_cfg_limits: "gore > 3" }, ext: { ...LINKED, almMode: "investigation" } },
  { name: "unknown setting values fall back", gen: "normal", chatVars: { alm_cfg_persona: "full cast", alm_cfg_nsfw: "none", alm_cfg_romance: "slow burn" } },
  { name: "lite ledger · header every reply", gen: "normal", vars: { ledger: "lite", header: "every" } },
  { name: "insistent world · world-led", gen: "normal", vars: { world_layer: "insistent", initiative: "world_led" } },
  { name: "backdrop world · player-led", gen: "normal", vars: { world_layer: "backdrop", initiative: "player_led" } },
  { name: "impersonate", gen: "impersonate" },
  { name: "auto planning · non-reasoning model", gen: "normal", model: "mistral-large-latest" },
  { name: "gate · Ledger not installed", gen: "normal", ext: null },
  { name: "gate · Ledger switched off here", gen: "normal", ext: { almActive: "no" } },
  { name: "gate · no interceptor permission", gen: "normal", ext: { almActive: "off" } },
];

const LEFTOVER = /\{\{[^}]*\}\}|\{\{|\}\}/;
let failures = 0;

async function renderScenario(sc: Scenario) {
  setExt(sc.ext === undefined ? LINKED : sc.ext);
  const { values, selections } = defaults();
  Object.assign(values, sc.vars ?? {});
  const env: any = {
    commit: true,
    names: { user: "Wren", char: "Mara", isGroupChat: "no", charGroupFocused: "", group: "", groupNotMuted: "", notChar: "Wren", groupOthers: "" },
    character: { name: "Mara" },
    chat: { id: "c1", messageCount: sc.count ?? 24, lastUserMessage: sc.lastUser ?? SAMPLE_USER, lastCharMessage: sc.lastChar ?? SAMPLE_REPLY, lastMessage: sc.lastMessage ?? sc.lastUser ?? SAMPLE_USER, rejectedSwipe: sc.rejected ?? "", lastMessageName: "Wren" },
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
  // The reasoning prefill (DeepSeek and Kimi connections) is evaluated after the blocks, in the same environment.
  const prefill = String((await evaluate(preset.completionSettings.reasoningPrefill, env, registry)).text);
  return { out, prefill, chatVars: Object.fromEntries(env.variables.chat), local: env.variables.local };
}

const tokens = (s: string) => Math.round(s.length / 4);
const verbose = process.argv.includes("--verbose");
const expect = (ok: boolean, what: string) => {
  if (ok) return;
  failures++;
  console.log(`  ✗ ${what}`);
};
for (const sc of SCENARIOS) {
  const { out, prefill, chatVars, local } = await renderScenario(sc);
  const total = out.reduce((n, o) => n + tokens(o.text), 0);
  const get = (k: string) => String(local.get(k) ?? "");
  console.log(`\n■ ${sc.name} — ${out.length} blocks, ≈${total} tokens · route=${get("alm_route")} linked=${get("alm_linked")} mode=${get("alm_mode")} genres=${get("alm_genres")} persona=${get("alm_persona")} nsfw=${get("alm_nsfw")}`);
  if (verbose) for (const o of out) console.log(`--- ${o.id} (≈${tokens(o.text)})\n${o.text}`);
  else console.log("  " + out.map((o) => `${o.id.replace(/^alm-/, "")}:${tokens(o.text)}`).join(" · "));
  if (prefill.trim()) console.log(`  reasoning prefill: ${prefill}`);
  if (sc.name === "scene") console.log("  ui chat vars:", JSON.stringify(chatVars));
  const all = out.map((o) => o.text).join("\n");
  const ids = out.map((o) => o.id);
  // What each scenario must (and must not) send.
  if (sc.name.startsWith("gate")) {
    expect(ids.join() === "alm-floor,alm-gate", `${sc.name}: only the boundaries and the gate go out (got ${ids.join(", ")})`);
    expect(/<ooc>/.test(all) && !/<ledger>/.test(all), `${sc.name}: the gate asks for one OOC line`);
  } else expect(!ids.includes("alm-gate") && ids.includes("alm-charter"), `${sc.name}: a managed chat gets the preset, not the gate`);
  if (sc.name === "first turn · Ledger arming") expect(/If it says the clock hasn't started/.test(all) && !/Season: \./.test(all) && !/roster: \./.test(all), "arming: no empty verified state, no empty roster");
  if (sc.name === "OOC · single parentheses") expect(get("alm_route") === "ooc", "(OOC: …) routes as out of character");
  if (sc.name === "unknown command") expect(/isn't a command/.test(all), "an unknown /command answers with the list");
  if (sc.name === "empty send after a command") expect(get("alm_route") === "scene", "an empty send doesn't re-run the last /command");
  if (sc.name === "swipe of a command reply") expect(get("alm_route") === "command", "a new take on a command reply is the command again");
  if (sc.name === "unknown setting values fall back") expect(get("alm_persona") === "sealed" && get("alm_nsfw") === "fade" && get("alm_romance") === "slow" && /\[AGENCY\]\nWren belongs to the player/.test(all), "unknown setting values fall back to the defaults");
  if (sc.name === "scene") expect(/Texture: living/.test(all) && /At most one unprompted environmental act/.test(all) && /Initiative: shared/.test(all) && /world="living" initiative="collaborative"/.test(all), "default: a living world, shared initiative, both in the handshake");
  if (sc.name === "insistent world · world-led") expect(/Texture: insistent/.test(all) && /Up to two unprompted environmental acts/.test(all) && !/At most one unprompted environmental act/.test(all) && /Initiative: the world leads\. Don't wait/.test(all) && /world="insistent" initiative="world_led"/.test(all), "insistent and world-led change the budgets and reach the Ledger");
  if (sc.name === "backdrop world · player-led") expect(/Texture: backdrop/.test(all) && /Initiative: the player leads/.test(all) && /world="backdrop" initiative="player_led"/.test(all), "backdrop and player-led render");
  if (sc.name === "intimacy · fade") expect(!/Baseline vocabulary/.test(all), "fade sends no explicit vocabulary");
  if (sc.name === "impersonate") expect(!ids.includes("alm-agency") && !ids.includes("alm-prose") && /This one message, you write Wren's next line/.test(all), "impersonation drops the agency and POV rules");
  if (sc.name === "native · deepseek (reasoning prefill)") expect(/^Director's Pass — ROUTE, ANCHOR, SEAL, MINDS, MOVE, VOICE, LEDGER\./.test(prefill), "native planning on DeepSeek gets a lean prefill");
  const wantPrefill = get("alm_linked") === "1" && get("alm_cotch") === "native" && ["scene", "variant"].includes(get("alm_route"));
  expect(!!prefill.trim() === wantPrefill, `${sc.name}: the reasoning prefill goes out on native story turns only`);
  if (sc.name === "lite ledger · header every reply") expect(!/reveal #key/.test(all) && /Lite ledger/.test(all) && /open every reply with it/.test(all), "lite ledger sends only its lines; header every reply");
  if (sc.name === "scene") {
    expect(/open the first reply of every scene with it, without exception/.test(all), "the header opens every scene");
    // The ledger example must be one the Ledger reads cleanly.
    const example = /<ledger>[\s\S]*?<\/ledger>/.exec(out.find((o) => o.id === "alm-ledger")!.text)![0];
    const parsed = parseMessage(example);
    expect(!parsed.unknown.length && parsed.ops.length >= 12 && parsed.ops.at(-1)?.op === "mode", `the ledger example parses (unknown: ${parsed.unknown.join(" | ")})`);
  }
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

/** The reply as the Ledger's render processor hands it to display regex: the plate drawn, the ledger compiled into its drawer. */
function linkedReply(): { html: string; css: string } {
  const rt = new LedgerRuntime();
  const raw = [OPENING, SAMPLE_USER, SAMPLE_REPLY].map((content, i) => ({ id: `m${i}`, index_in_chat: i, is_user: i === 1, content, swipes: [content], swipe_id: 0 }));
  const { state } = rt.fold(toPath(raw), { userName: "Wren", strictness: "strict", sealed: true, romance: "slow" });
  const al = almanacFor(state, { chatId: "c1", climate: "temperate maritime" });
  const drawer = renderDrawer({ state, delta: state.lastDelta, almanac: al, colors: {}, userName: "Wren", sealed: true, nsfw: false, view: "drawer", latest: true });
  let html = SAMPLE_REPLY;
  if (al) html = html.replace(/^([ \t]*🗓[^\n]*?)[ \t]*$/mu, (_m, line) => `${line}${plateSuffix(al)}`);
  html = drawPlates(html, "mystery");
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
const uiVars = { alm_ui_style: "blocks", alm_ui_color: "1", alm_ui_align: "stage", alm_ui_lead: "mystery" };
const sections: string[] = [];
const rendered = linkedReply();
for (const style of ["blocks", "chips", "tint", "script"]) {
  const html = await display(rendered.html, false, 0, { ...uiVars, alm_ui_style: style });
  // A header line left raw (the Ledger draws it as the plate), or any mark the display regex should have drawn.
  const RAW = /\[spk=|\[\/spk\]|<ledger>|<unspoken>|<plan>|\[vtk=|(?:^|\n)[ \t]*🗓|\[txt|\[thk|\[\[alm-desk/u;
  const bare = html.replace(/<style>[\s\S]*?<\/style>/g, "");
  const raw = RAW.exec(bare);
  if (raw) {
    failures++;
    console.log(`  ✗ display (${style}): raw marks survived: ${JSON.stringify(bare.slice(Math.max(0, raw.index - 80), raw.index + 80))}`);
  }
  if (LEFTOVER.test(html.replace(/<style>[\s\S]*?<\/style>/g, ""))) {
    failures++;
    console.log(`  ✗ display (${style}): leftover macro syntax: ${JSON.stringify(html.match(/.{0,60}(\{\{|\}\}).{0,60}/)?.[0])}`);
  }
  sections.push(`<section data-style="${style}"><h2>${style}</h2><div class="msg">${html}</div></section>`);
}
sections.push(`<section><h2>older reply (depth 3)</h2><div class="msg">${await display(drawPlates(SAMPLE_REPLY.split("\n\n").slice(0, 3).join("\n\n"), "romance"), false, 3, { ...uiVars, alm_ui_lead: "romance" })}</div></section>`);
const linked = linkedReply();
sections.push(`<section class="linked"><h2>linked (extension rendered the drawer)</h2><div class="msg">${await display(linked.html, false, 0, { ...uiVars, alm_ui_lead: "fantasy" })}</div></section>`);
sections.push(`<section><h2>player</h2><div class="msg user">${await display(SAMPLE_USER, true, 1, uiVars)}</div></section>`);
// Notes written as one paragraph, with a quoted phrase: every step gets its own row, the preface stays text.
const ONE_LINE_PLAN = `She laughs.\n\n<plan>\nRoutine beat: banter escalation. ROUTE/ANCHOR as above. SEAL: Gabriel's lines rendered as given; Buffy reacts; end before any invite decision. GNOSIS: #dawn-crush becomes fully aloud this beat — drop the "never say" tag; no other leaks. MINDS: Buffy gleeful payback over guardian worry. PREMORTEM: avoid repeated tell-images. VOICE: Buffy POV, present, dialogue-dense, ~350w.\n</plan>`;
const oneLine = await display(ONE_LINE_PLAN, false, 0, uiVars);
const rows = (oneLine.match(/class="alm-cs__r"/g) ?? []).length;
if (rows !== 6 || !/>ROUTE\/ANCHOR</.test(oneLine) || !/Routine beat: banter escalation\./.test(oneLine)) {
  failures++;
  console.log(`  ✗ display: a one-paragraph plan made ${rows} rows (want 6, ROUTE/ANCHOR first, the preface kept)`);
}
sections.push(`<section><h2>one-paragraph Director's notes</h2><div class="msg">${oneLine}</div></section>`);
if (htmlArg > 0) {
  const out = process.argv[htmlArg + 1];
  const ext = process.argv.includes("--ext") ? await import("../src/frontend/styles") : null;
  writeFileSync(out, `<!doctype html>${ext ? `<style>${ext.TOKENS}${ext.MESSAGE_CSS}${linked.css}</style>` : ""}<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ALMANAC preview</title><style>body{margin:0;padding:18px;background:#16171c;color:#e6e2da;font:17px/1.6 Georgia,serif}section{max-width:760px;margin:0 auto 40px}h2{font:600 12px/1 ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;color:#c9a45c}.msg{padding:14px 18px;border-radius:14px;background:#1d1e24;white-space:pre-wrap}.msg.user{background:#23242b}</style>${sections.join("\n")}`);
  console.log(`\npreview → ${out}`);
}

console.log(failures ? `\n${failures} problem(s)` : "\nall scenarios rendered cleanly");
process.exit(failures ? 1 : 0);
