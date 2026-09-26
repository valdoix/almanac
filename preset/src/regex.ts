import { R } from "./vars";
// The ALMANAC regex suite: response repair, prompt thinning, persistence,
// the scene-mode router, and every display renderer. Display regex emits the
// alm-* class names the Ledger's stylesheet paints (with !important), plus a
// "Lite" inline style so the preset still looks good on its own.
import { PLATE_FIND, PLATE_REPLACE } from "./plate";
import { SCENE_MODES } from "./blocks-turn";
import vtkTessera from "./vtk-tessera.json";

type Target = "prompt" | "response" | "display";
type Placement = "user_input" | "ai_output" | "world_info" | "reasoning" | "memory";
type Macros = "none" | "find" | "raw" | "escaped" | "after";

export interface RegexDef {
  id: string;
  name: string;
  find: string;
  rep: string;
  flags?: string;
  target: Target[];
  placement?: Placement[];
  min?: number | null;
  max?: number | null;
  macros?: Macros;
  order: number;
  description?: string;
  layer: string;
  actions?: any[];
  activation?: any;
  disabled?: boolean;
}

export const SUITE = "ALMANAC";

export function toScript(r: RegexDef) {
  return {
    script_id: r.id,
    name: `ALMANAC · ${r.name}`,
    folder: SUITE,
    description: r.description ?? "",
    find_regex: r.find,
    replace_string: r.rep,
    flags: r.flags ?? "g",
    placement: r.placement ?? ["ai_output"],
    scope: "global",
    scope_id: null,
    target: r.target,
    min_depth: r.min ?? null,
    max_depth: r.max ?? null,
    trim_strings: [],
    run_on_edit: true,
    substitute_macros: r.macros ?? "none",
    disabled: !!r.disabled,
    sort_order: r.order,
    actions: r.actions ?? [],
    metadata: { suite: SUITE, schema: "lumiverse-regex-v1", layer: r.layer, ...(r.activation ? { prompt_activation: r.activation } : {}) },
  };
}

// ── Shared pieces ───────────────────────────────────────────────────────────
export const SLOTS = ["#9b6a0e", "#c02f52", "#6b45c6", "#0a7d6d", "#1f6fb2", "#b0521c", "#8a3f9e", "#2f7d4f", "#b3871a", "#4f5fbf", "#a8406f", "#51741a", "#1b7e93"];
const NEUTRAL = "#7a6f63";
/** Voice-slot colour for capture `$n` (raw macro mode). */
const pal = (cap: string) => `{{switch::${cap}::${SLOTS.map((c, i) => `${i}::${c}`).join("::")}::${NEUTRAL}}}`;
const initial = (cap: string) => `{{upper::{{substr::${cap}::0::1}}}}`;
/** A find-pattern gate: the script matches only when the condition macro is truthy. */
const gate = (cond: string) => `{{if::${cond}}}{{else}}(?!){{/if}}`;
const COLOR_ON = `{{ne::{{getchatvar::alm_ui_color}}::0}}`;
const STYLE = `{{default::{{getchatvar::alm_ui_style}}::blocks}}`;
const styleIs = (...s: string[]) => `{{and::${COLOR_ON}::{{or::${s.map((x) => `{{eq::${STYLE}::${x}}}`).join("::")}${s.length === 1 ? "::0" : ""}}}}}`;
/** Only inside a block whose closing tag comes before any new opening tag. */
const inside = (open: string, close: string) => `(?=(?:(?!${open})[\\s\\S])*?${close})`;

const TONE_LINE = (c: string, p: string) => `{{switch::${c}::whisper::font-style:italic;opacity:.8::breathless::font-style:italic;opacity:.85::murmur::font-style:italic::shout::font-weight:700;font-size:1.13em::sob::font-style:italic::cold::letter-spacing:.04em::sly::font-style:italic::sing::font-style:italic;text-decoration:underline wavy color-mix(in oklab,${p} 55%,transparent);text-underline-offset:5px::flat::opacity:.85::}}`;
const TONE_BUBBLE = (c: string, p: string) => `{{switch::${c}::whisper::border-style:dashed;background:transparent::breathless::border-style:dashed;background:transparent::shout::border-width:2.5px;border-color:${p};box-shadow:4px 4px 0 color-mix(in oklab,${p} 35%,transparent);transform:rotate(-.5deg)::tender::box-shadow:0 0 22px -6px ${p}::sob::box-shadow:0 0 22px -6px ${p}::cold::background:color-mix(in oklab,#9fd3ff 14%,transparent);border-color:color-mix(in oklab,#9fd3ff 55%,transparent)::flat::background:color-mix(in oklab,${p} 5%,transparent)::}}`;

// Speaker mark: [spk=Name#N|tone]"…"[/spk]  (closing tag optional up to the next mark/blank line)
const SPK = R`\[spk=([^\]#|\n]{1,60}?)\s*(?:#(\d{1,2}))?\s*(?:\|\s*([a-z]+))?\]`;
const SPK_BODY = R`([\s\S]*?)(?:\[\/spk\]|(?=\[(?:spk|thk)=)|(?=\n[ \t]*\n)|$)`;
const SPK_BODY_LINE = R`([^\n]*?)(?:\[\/spk\]|(?=\[(?:spk|thk)=)|(?=\n)|$)`;

const LEDGER_ICON = `{{switch::$1::clock::🕰::wx::🌦::at::📍::cast::👥::mood::🎭::body::🩹::look::👗::bond::🕸::ladder::💞::know::👁::item::🎒::thread::🧵::owe::⚖::cons::⚖::clockf::⏳::rumor::🗣::rep::🏛::journal::📓::keys::🔑::canon::📜::artifact::✉::gauge::📈::clue::🔎::plant::🌱::deadline::⌛::status::🪪::mode::🎬::•}}`;
const LEDGER_PANEL = `{{switch::$1::clock::scene::wx::scene::at::scene::cast::scene::mode::scene::mood::cast::body::cast::look::cast::status::cast::bond::bonds::ladder::bonds::item::inventory::thread::threads::clockf::threads::deadline::threads::gauge::threads::know::knowledge::rumor::knowledge::clue::knowledge::owe::consequences::cons::consequences::rep::consequences::world}}`;

const DESK_BTN = (id: string, label: string, primary = false) =>
  `<span class="alm-btn${primary ? " alm-btn--primary" : ""}" data-regex-action="${id}" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:10px;border:1px solid rgba(127,127,127,.35);border-bottom-width:3px;background:${primary ? "#b5602a;color:#fff" : "rgba(127,127,127,.08)"};font:500 12.5px/1 ui-monospace,Menlo,monospace;cursor:pointer">${label}</span>`;

const send = (id: string, title: string, content: string, subtitle = "") => ({ id, type: "send", multi_select: false, cost: "1", limit: "", title, subtitle, content });

// ── The suite ───────────────────────────────────────────────────────────────
export const REGEX: RegexDef[] = [
  // Response repair (runs once on the stored reply)
  {
    id: "alm-ledger-unfence", name: "Ledger · unwrap a fenced ledger", layer: "response", target: ["response"], order: 5, flags: "gi",
    find: R`\x60{3,}[a-z]*[ \t]*\n?\s*(<ledger>[\s\S]*?<\/ledger>)\s*\n?\x60{3,}`, rep: "$1",
    description: "Some models put the ledger in a code fence; the Ledger and the router need it bare.",
  },
  {
    id: "alm-ledger-unescape", name: "Ledger · unescape an HTML-escaped ledger", layer: "response", target: ["response"], order: 6, flags: "gi",
    find: R`&lt;(\/?)(ledger|unspoken|plan)&gt;`, rep: "<$1$2>",
  },
  {
    id: "alm-plan-last", name: "Director's notes move after the prose", layer: "response", target: ["response"], order: 10, flags: "",
    find: R`^\s*(<plan>[\s\S]*?<\/plan>)\s*([\s\S]*?)(\s*<ledger>[\s\S]*<\/ledger>\s*)?$`, rep: "$2\n\n$1$3",
    description: "A visible plan written first is moved after the reply (and before the ledger), so the header stays first and the ledger stays last.",
  },
  {
    id: "alm-ledger-last", name: "Ledger moves to the very end", layer: "response", target: ["response"], order: 12, flags: "",
    find: R`(<ledger>[\s\S]*?<\/ledger>)\s*(?=\S)([\s\S]+?)\s*$`, rep: "$2\n\n$1",
    description: "The router reads the mode line at the end of the message, so anything written after the ledger moves above it.",
  },
  {
    id: "alm-spk-before", name: "Speaker tags · name before the quote", layer: "response", target: ["response"], order: 20, macros: "find",
    find: gate(COLOR_ON) + R`(^|[.!?]\s+|\n)((?!(?:She|He|They|It|We|I|You|The|A|An|This|That|Then|But|And|When|Her|His|Their)\b)[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*(?:[ \t]+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*){0,2})([ \t]+(?:said|says|asked|asks|replied|replies|answered|answers|whispered|whispers|murmured|murmurs|muttered|mutters|called|calls|shouted|shouts|snapped|snaps|breathed|breathes|added|adds|warned|warns|insisted|insists|admitted|admits|offered|offers|continued|continues|laughed|laughs|sighed|sighs)(?:[ \t]+[a-z]+ly)?[ \t]*[,:][ \t]*)(?!\[spk)(["“][^"“”\n]{1,1200}["”])`,
    rep: "$1$2$3[spk=$2]$4[/spk]",
    description: "Adds a speaker tag only when the speaker is named right next to the quote. It never guesses.",
  },
  {
    id: "alm-spk-after", name: "Speaker tags · name after the quote", layer: "response", target: ["response"], order: 21, macros: "find",
    find: gate(COLOR_ON) + R`(?<!\])(["“][^"“”\n]{1,1200}["”])([ \t]*,?[ \t]*)((?!(?:she|he|they|it|we|I|you|She|He|They|It|We|You)\b)[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*(?:[ \t]+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]*){0,2})([ \t]+(?:said|says|asked|asks|replied|replies|answered|answers|whispered|whispers|murmured|murmurs|muttered|mutters|called|calls|shouted|shouts|snapped|snaps|breathed|breathes|added|adds|warned|warns|insisted|insists|admitted|admits|offered|offers|continued|continues|laughed|laughs|sighed|sighs)\b)`,
    rep: "[spk=$3]$1[/spk]$2$3$4",
  },
  {
    id: "alm-spk-prefix", name: "Speaker tags · drop a duplicate name label", layer: "response", target: ["response"], order: 22,
    find: R`(^|\n)[ \t]*(?:\*\*|__)?([^\n\[\]*_:]{1,60}?)(?:\*\*|__)?[ \t]*[:—–-][ \t]*(?=\[spk=\2(?:#\d{1,2})?(?:\|[a-z]+)?\])`, rep: "$1",
  },

  // Prompt: what never returns, and what thins out with depth
  { id: "alm-prompt-plan", name: "Director's notes never return", layer: "prompt", target: ["prompt"], placement: ["ai_output", "memory"], order: 10, find: R`\s*<plan>[\s\S]*?<\/plan>\s*`, rep: "\n" },
  { id: "alm-prompt-unspoken", name: "Unspoken register never returns", layer: "prompt", target: ["prompt"], placement: ["ai_output", "memory"], order: 11, find: R`\s*<unspoken>[\s\S]*?<\/unspoken>\s*`, rep: "\n" },
  {
    id: "alm-session-zero", name: "Session Zero (without the Ledger) · save the answers", layer: "persistence", target: ["prompt"], placement: ["ai_output"], order: 15, macros: "after", flags: "gi",
    find: R`<session-zero\b(?=[^>]*\bgenres="([^"]*)")?(?=[^>]*\btone="([^"]*)")?(?=[^>]*\bpersona="([^"]*)")?(?=[^>]*\bromance="([^"]*)")?(?=[^>]*\bdifficulty="([^"]*)")?(?=[^>]*\bnsfw="([^"]*)")?(?=[^>]*\blimits="([^"]*)")?(?=[^>]*\bclimate="([^"]*)")?(?=[^>]*\bcalendar="([^"]*)")?(?=[^>]*\bstart="([^"]*)")?[^>]*>`,
    rep: "(Session Zero settings saved.){{if::{{len::$1}}}}{{setchatvar::alm_cfg_genres::{{lower::$1}}}}{{/if}}{{if::{{len::$2}}}}{{setchatvar::alm_cfg_tone::{{lower::$2}}}}{{/if}}{{if::{{len::$3}}}}{{setchatvar::alm_cfg_persona::{{lower::$3}}}}{{/if}}{{if::{{len::$4}}}}{{setchatvar::alm_cfg_romance::{{lower::$4}}}}{{/if}}{{if::{{len::$5}}}}{{setchatvar::alm_cfg_difficulty::{{lower::$5}}}}{{/if}}{{if::{{len::$6}}}}{{setchatvar::alm_cfg_nsfw::{{lower::$6}}}}{{/if}}{{if::{{len::$7}}}}{{setchatvar::alm_cfg_limits::$7}}{{/if}}{{if::{{len::$8}}}}{{setchatvar::alm_cfg_climate::$8}}{{/if}}{{if::{{len::$9}}}}{{setchatvar::alm_cfg_calendar::$9}}{{/if}}{{if::{{len::$10}}}}{{setchatvar::alm_cfg_start::$10}}{{/if}}{{setchatvar::alm_sz_done::1}}",
    description: "When the model finishes an OOC Session Zero (/session0) it writes a <session-zero …/> tag; this stores the answers as this chat's settings. With the Ledger installed, its Session Zero window writes the same settings.",
  },
  {
    id: "alm-persist", name: "Scene state · remember place, weather and mode (standalone)", layer: "persistence", target: ["prompt"], placement: ["ai_output"], order: 20, macros: "after", max: 2, flags: "",
    find: R`<ledger>(?=(?:(?!<\/ledger>)[\s\S])*?\n[ \t]*at:[ \t]*([^\n]+))?(?=(?:(?!<\/ledger>)[\s\S])*?\n[ \t]*wx:[ \t]*(?:[^\n→]*→[ \t]*)?([^\n]+))?(?=(?:(?!<\/ledger>)[\s\S])*?\n[ \t]*cast:[ \t]*([^\n]+))?(?=(?:(?!<\/ledger>)[\s\S])*?\n[ \t]*mode:[ \t]*([a-z]+))?`,
    rep: "<ledger>{{if::{{len::$1}}}}{{setchatvar::alm_place::$1}}{{/if}}{{if::{{len::$2}}}}{{setchatvar::alm_wx::$2}}{{/if}}{{if::{{len::$3}}}}{{setchatvar::alm_present::$3}}{{/if}}{{if::{{len::$4}}}}{{setchatvar::alm_mode::$4}}{{/if}}",
    description: "Copies the latest ledger's place, weather, cast and scene mode into chat variables, so the preset keeps its bearings without the Ledger extension.",
  },
  { id: "alm-prompt-ledger", name: "Older ledgers drop (the latest stays as an example)", layer: "prompt", target: ["prompt"], placement: ["ai_output", "memory"], order: 30, min: 2, find: R`\s*<ledger>[\s\S]*?<\/ledger>\s*`, rep: "\n" },
  { id: "alm-prompt-folio", name: "Older folios and OOC answers drop", layer: "prompt", target: ["prompt"], placement: ["ai_output", "memory"], order: 31, min: 4, find: R`\s*<(folio|ooc)\b[^>]*>[\s\S]*?<\/\1>\s*`, rep: "\n" },
  { id: "alm-prompt-marks", name: "Older speaker and thought marks thin out", layer: "prompt", target: ["prompt"], placement: ["ai_output", "memory"], order: 32, min: 4, find: R`\[(?:spk|thk|txt)=[^\]\n]*\]|\[\/(?:spk|thk|txt)\]`, rep: "" },
  { id: "alm-prompt-vtk-open", name: "Older artifacts keep their words", layer: "prompt", target: ["prompt"], placement: ["ai_output", "memory"], order: 33, min: 6, find: R`\[vtk=([a-z]+)(?:\|([^|\]\n]*))?(?:\|[^\]\n]*)?\]`, rep: "[$1: $2]" },
  { id: "alm-prompt-vtk-close", name: "Older artifacts drop their closing mark", layer: "prompt", target: ["prompt"], placement: ["ai_output", "memory"], order: 34, min: 6, find: R`\[\/vtk\]`, rep: "" },
  { id: "alm-prompt-meters", name: "Older meters drop", layer: "prompt", target: ["prompt"], placement: ["ai_output", "memory"], order: 35, min: 2, flags: "gm", find: R`^[ \t]*\[meter=[^\]\n]*\][ \t]*\n?`, rep: "" },
  { id: "alm-prompt-headers", name: "Older headers drop", layer: "prompt", target: ["prompt"], placement: ["ai_output", "memory"], order: 36, min: 6, flags: "gm", find: R`^[ \t]*(?:\*\*)?🗓[^\n]*\n(?:[ \t]*(?:\*\*)?📍[^\n]*\n)?`, rep: "" },
  {
    id: "alm-memory-strip", name: "Keep bookkeeping out of memory", layer: "memory", target: ["prompt"], placement: ["memory"], order: 40, flags: "gm",
    find: R`<(ledger|plan|unspoken|folio|ooc)\b[^>]*>[\s\S]*?<\/\1>|<session-zero\b[^>]*>|^[ \t]*(?:\*\*)?(?:🗓|📍)[^\n]*$|\[(?:spk|thk|txt)=[^\]\n]*\]|\[\/(?:spk|thk|txt)\]`, rep: "",
  },

  // The scene-mode router: the last ledger line enables one Scene Module
  {
    id: "alm-router", name: "Scene-mode router", layer: "activation", target: ["prompt"], placement: ["ai_output"], order: 50, flags: "i",
    find: R`\n[ \t]*mode:[ \t]*(?<mode>[a-z]+)[ \t]*\n?[ \t]*<\/ledger>\s*$`, rep: "$&",
    activation: {
      source: "ai_output", lifetime: "chat",
      mappings: [
        ...SCENE_MODES.filter((m) => m !== "social").map((m) => ({ capture: "mode", value: [m], block_ids: [`alm-scene-${m}`], enabled: true })),
        { capture: "mode", value: ["social"], block_ids: SCENE_MODES.filter((m) => m !== "social").map((m) => `alm-scene-${m}`), enabled: false },
      ],
    },
    description: "Reads `mode:` from the end of the latest reply and turns on exactly one Scene Module until the mode changes. Each module also checks the mode itself, so a stale activation stays silent.",
  },

  // Display: session zero, director's notes, register
  {
    id: "alm-show-session-zero", name: "Session Zero · saved chip", layer: "display", target: ["display"], order: 5, flags: "gi",
    find: R`<session-zero\b[^>]*>`, rep: `<span class="alm-pill" style="display:inline-flex;gap:6px;padding:5px 10px;border-radius:999px;border:1px solid rgba(127,127,127,.3);font:500 12px/1 ui-monospace,Menlo,monospace">✓ Session Zero saved to this chat</span>`,
  },
  {
    id: "alm-show-plan-rows", name: "Director's notes · rows", layer: "display", target: ["display"], order: 9, flags: "gmi", macros: "raw",
    find: R`^[ \t]*[-*•]?[ \t]*\**(ROUTE|TIER|ANCHOR|SEAL|GNOSIS|MINDS|WEB|WORLD|MOVE|PREMORTEM|VOICE|LEDGER)\**[ \t]*(?:[—:–]|-{1,2})+[ \t]*([^\n]*)\n?` + inside("<plan>", "<\\/plan>"),
    rep: `<dt class="{{switch::{{upper::$1}}::ROUTE::g1::TIER::g1::ANCHOR::g1::SEAL::g1::GNOSIS::g2::MINDS::g2::WEB::g2::WORLD::g3::MOVE::g3::g4}}" style="font:500 10px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;padding:5px 8px;border-radius:6px;color:#fff;background:{{switch::{{upper::$1}}::ROUTE::#35587e::TIER::#35587e::ANCHOR::#35587e::SEAL::#35587e::GNOSIS::#7b5bd6::MINDS::#7b5bd6::WEB::#7b5bd6::WORLD::#b5602a::MOVE::#b5602a::#2f7d4f}};text-align:center;align-self:start">{{upper::$1}}</dt><dd style="margin:0{{if::{{eq::{{upper::$1}}::PREMORTEM}}}};color:#e46a6a;font-weight:600{{/if}}"{{if::{{eq::{{upper::$1}}::PREMORTEM}}}} class="risk"{{/if}}>$2</dd>`,
  },
  {
    id: "alm-show-plan", name: "Director's notes · call-sheet drawer", layer: "display", target: ["display"], order: 11,
    find: R`<plan>\s*([\s\S]*?)\s*<\/plan>`,
    rep: `<details class="alm-drawer alm-notes" style="margin:14px 0 0;border:1px dashed rgba(127,127,127,.35);border-radius:12px;overflow:hidden"><summary style="cursor:pointer;padding:9px 12px;font:500 12.5px/1.2 ui-monospace,Menlo,monospace;opacity:.8">🎬 Director's notes<span class="alm-caret"></span></summary><div class="alm-drawer__body" style="padding:12px 14px"><div class="alm-clap"></div><dl class="alm-cs" style="display:grid;grid-template-columns:auto 1fr;gap:7px 12px;margin:0;font-size:14px;line-height:1.45">$1</dl></div></details>`,
  },
  {
    id: "alm-show-unspoken-rows", name: "Unspoken register · sealed envelopes", layer: "display", target: ["display"], order: 20, macros: "raw",
    find: R`<t\s+who="([^"#]*?)(?:#(\d{1,2}))?"(?:\s+cue="([^"]*)")?\s*>([\s\S]*?)<\/t>`,
    rep: `<details class="alm-env alm-v" data-spk="$1" style="--c:${pal("$2")};border:1px solid color-mix(in oklab,${pal("$2")} 35%,transparent);border-radius:10px;background:color-mix(in oklab,${pal("$2")} 7%,transparent);overflow:hidden"><summary style="cursor:pointer;list-style:none;padding:12px 14px;text-align:center"><span class="alm-env__flap"></span><span class="alm-env__wax" style="display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:${pal("$2")};color:#fff;font:700 13px/1 Georgia,serif;box-shadow:0 2px 6px rgba(0,0,0,.3)">${initial("$1")}</span><b style="display:block;margin-top:6px;font:600 12px/1.2 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${pal("$2")}">$1</b><span class="alm-env__cue" style="display:block;margin-top:6px;font:500 10.5px/1.45 ui-monospace,Menlo,monospace;letter-spacing:.05em;text-transform:uppercase;opacity:.75">$3</span><span class="alm-env__hint" style="display:block;margin-top:4px;font:italic 12px/1 Georgia,serif;color:${pal("$2")}">break the seal</span></summary><div class="alm-env__inner" style="margin:0 12px 12px;padding:10px 12px;border-radius:6px;border:1px solid rgba(127,127,127,.25);font-style:italic">$4<span style="display:block;text-align:right;margin-top:6px;font-style:normal;color:${pal("$2")}">— $1</span></div></details>`,
  },
  {
    id: "alm-show-unspoken", name: "Unspoken register · drawer", layer: "display", target: ["display"], order: 21,
    find: R`<unspoken>\s*([\s\S]*?)\s*<\/unspoken>`,
    rep: `<details class="alm-drawer alm-unspoken" style="margin:14px 0 0;border:1px solid rgba(127,127,127,.3);border-radius:12px;overflow:hidden"><summary style="cursor:pointer;padding:9px 12px;font:500 12.5px/1.2 ui-monospace,Menlo,monospace;opacity:.85">✉ Unspoken thoughts<span class="alm-caret"></span></summary><div class="alm-drawer__body" style="padding:12px"><div class="alm-envs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">$1</div><div class="alm-lockcap" style="margin-top:10px;font:12px/1.4 ui-monospace,Menlo,monospace;opacity:.7">🔒 No one else in the story knows these.</div></div></details>`,
  },

  // Display: artifacts (Tessera's VTK, unchanged apart from the prefix), plus new sub-syntax
  ...(vtkTessera as any[]).map((v) => ({
    id: v.id, name: v.name.replace(/^ALMANAC · /, ""), layer: "display", target: ["display"] as Target[], order: v.order, flags: v.flags, find: v.find,
    rep: v.id === "alm-vtk" ? String(v.rep).replace("</style>", `.alm-vtk[data-kind="song"] .ico::before{content:"♪"}.alm-vtk[data-kind=song] .card{background:linear-gradient(160deg,#241a33,#141020);color:#f1e9ff;border-color:rgba(190,150,255,.3)}.alm-vtk[data-kind=song] .ico,.alm-vtk[data-kind=song] .meta{color:#c9a8ff}.alm-vtk[data-kind=song] .body{font:italic 15px/1.7 "Iowan Old Style",Georgia,serif;text-align:center}</style>`) : v.rep,
    description: v.description,
  })),
  {
    id: "alm-vtk-sig", name: "Artifacts · signature", layer: "display", target: ["display"], order: 36, flags: "gi",
    find: R`\[sig=([^\]\n]{1,60})\]`, rep: `<span style="display:block;margin-top:.6em;text-align:right;font:italic 600 1.25em/1 'Caveat','Segoe Print','Bradley Hand',cursive;opacity:.9">$1</span>`,
  },
  {
    id: "alm-vtk-stamp", name: "Artifacts · stamp", layer: "display", target: ["display"], order: 36, flags: "gi",
    find: R`\[stamp=([^\]\n]{1,40})\]`, rep: `<span style="display:inline-block;margin:.3em 0;padding:3px 10px;border:3px double #b83a3a;border-radius:6px;color:#b83a3a;font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;transform:rotate(-6deg);opacity:.85">$1</span>`,
  },
  {
    id: "alm-vtk-card", name: "Artifacts · omen card", layer: "display", target: ["display"], order: 36, flags: "gi",
    find: R`\[card=([^|\]\n]{1,40})(?:\|(upright|reversed))?\]`, rep: `<span data-orient="$2" style="display:inline-flex;flex-direction:column;align-items:center;gap:4px;margin:.3em .4em .3em 0;padding:10px 12px;min-width:84px;border:1px solid rgba(201,164,92,.6);border-radius:8px;background:linear-gradient(160deg,rgba(201,164,92,.16),transparent);font:600 12px/1.2 Georgia,serif;letter-spacing:.06em;text-align:center"><span style="font-size:18px">✧</span>$1<small style="font:italic 11px/1 Georgia,serif;opacity:.75">$2</small></span>`,
  },
  {
    id: "alm-vtk-headline", name: "Artifacts · news headline", layer: "display", target: ["display"], order: 37, flags: "gm",
    find: R`^[ \t]*##[ \t]+([^\n]+)$` + inside("\\[vtk=", "\\[\\/vtk\\]"), rep: `<span style="display:block;margin:.2em 0 .4em;font:800 1.45em/1.1 'Playfair Display','Didot',Georgia,serif;letter-spacing:-.01em">$1</span>`,
  },
  {
    id: "alm-vtk-command", name: "Artifacts · screen command", layer: "display", target: ["display"], order: 37, flags: "gm",
    find: R`^[ \t]*>[ \t]*([^\n]+)$` + inside("\\[vtk=", "\\[\\/vtk\\]"), rep: `<span style="display:block;font:13.5px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#6ef0b0"><span style="opacity:.6">❯ </span>$1</span>`,
  },
  {
    id: "alm-vtk-lyric", name: "Artifacts · song lyric", layer: "display", target: ["display"], order: 37, flags: "gm",
    find: R`^[ \t]*♪[ \t]*([^\n]+)$` + inside("\\[vtk=", "\\[\\/vtk\\]"), rep: `<span style="display:block;margin:.15em 0"><span style="opacity:.55">♪ </span>$1</span>`,
  },

  // Display: the scene plate and the title card
  {
    id: "alm-show-plate", name: "Scene header · living plate", layer: "display", target: ["display"], order: 50, flags: "", macros: "raw",
    find: PLATE_FIND, rep: PLATE_REPLACE,
    description: "Draws the header as a sky that follows the hour, weather, season and place. With the Ledger it also shows exact sunrise, sunset and the moon phase.",
  },
  {
    id: "alm-show-title", name: "Scene header · title card", layer: "display", target: ["display"], order: 51, flags: "", macros: "raw",
    find: R`(^|\n)[ \t]*#{1,3}[ \t]+([^\n]+)`,
    rep: `$1<div class="alm-chapter" style="display:flex;flex-direction:column;align-items:center;gap:6px;margin:1.4em 0 1.1em;text-align:center"><small style="font:500 10.5px/1 ui-monospace,Menlo,monospace;letter-spacing:.3em;text-transform:uppercase;opacity:.75">✦ {{default::{{replace::_:: ::{{getchatvar::alm_ui_lead}}}}::scene}} ✦</small><b style="font:600 italic 1.6em/1.15 'Fraunces','Iowan Old Style',Palatino,Georgia,serif">$2</b></div>`,
  },

  // Display: dialogue (one style is live, chosen by the Dialogue style setting)
  {
    id: "alm-show-speech-block", name: "Dialogue · voice cards (paragraph start)", layer: "display", target: ["display"], order: 60, macros: "raw",
    find: gate(styleIs("blocks")) + R`(^|\n)[ \t]*` + SPK + SPK_BODY_LINE + R`[ \t]*([^\n]*)`,
    rep: `$1<div class="alm-say alm-v{{if::{{and::{{eq::$3::0}}::{{eq::{{getchatvar::alm_ui_align}}::chat}}}}}} alm-say--user{{/if}}" data-spk="$2" data-slot="$3" data-tone="$4" style="--c:${pal("$3")};display:grid;grid-template-columns:40px minmax(0,1fr);gap:0 12px;margin:20px 0 14px;align-items:start"><span class="alm-say__medal" aria-hidden="true" style="width:40px;height:40px;border-radius:50%;display:grid;place-items:center;margin-top:4px;background:radial-gradient(circle at 35% 30%,color-mix(in oklab,${pal("$3")} 55%,#fff),${pal("$3")} 72%);color:#fff;font:700 16px/1 Georgia,serif;box-shadow:0 0 0 3px color-mix(in oklab,${pal("$3")} 22%,transparent)">${initial("$2")}</span><div class="alm-say__bubble" style="position:relative;padding:17px 16px 10px;border-radius:6px 16px 16px 16px;background:color-mix(in oklab,${pal("$3")} 10%,transparent);border:1px solid color-mix(in oklab,${pal("$3")} 30%,transparent);${TONE_BUBBLE("$4", pal("$3"))}"><span class="alm-say__who" style="position:absolute;top:-11px;left:14px;display:inline-flex;gap:7px;padding:3px 10px;border-radius:999px;background:${pal("$3")};color:#fff;font:600 11px/1.3 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase">$2{{if::$4}}<em class="alm-say__tone" style="font:italic 500 11px/1.3 Georgia,serif;letter-spacing:.02em;text-transform:none;padding-left:7px;border-left:1px solid rgba(255,255,255,.5)">$4</em>{{/if}}</span><span class="alm-sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">$2: </span><span class="alm-say__line" style="display:block;font-size:1.04em;line-height:1.5;${TONE_LINE("$4", pal("$3"))}">$5</span><span class="alm-say__beat" style="display:block;margin-top:7px;padding-top:6px;border-top:1px dashed color-mix(in oklab,${pal("$3")} 25%,transparent);opacity:.8;font-style:italic;font-size:.92em">$6</span></div></div>`,
  },
  {
    id: "alm-show-speech-script", name: "Dialogue · script (paragraph start)", layer: "display", target: ["display"], order: 61, macros: "raw",
    find: gate(styleIs("script")) + R`(^|\n)[ \t]*` + SPK + SPK_BODY_LINE + R`[ \t]*([^\n]*)`,
    rep: `$1<div class="alm-script alm-v" data-spk="$2" data-tone="$4" style="--c:${pal("$3")};display:grid;grid-template-columns:minmax(64px,auto) 1fr;gap:4px 12px;margin:10px 0"><span class="alm-script__n" style="font:500 11px/1.9 ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;text-align:right;color:${pal("$3")};border-right:2px solid color-mix(in oklab,${pal("$3")} 35%,transparent);padding-right:8px">$2</span><span>{{if::$4}}<span class="alm-script__par" style="font-style:italic;opacity:.7">($4)</span> {{/if}}$5 <span class="alm-script__par alm-say__beat" style="font-style:italic;opacity:.7;font-size:.92em">$6</span></span></div>`,
  },
  {
    id: "alm-show-speech-chip", name: "Dialogue · chips (inside narration)", layer: "display", target: ["display"], order: 62, macros: "raw",
    find: gate(styleIs("blocks", "chips")) + SPK + SPK_BODY,
    rep: `<span class="alm-chip alm-v" data-spk="$1" data-tone="$3" style="--c:${pal("$2")};padding:1px 8px 2px 2px;border-radius:999px;background:color-mix(in oklab,${pal("$2")} 13%,transparent);${TONE_LINE("$3", pal("$2"))}"><span class="alm-chip__dot" aria-hidden="true" style="display:inline-grid;place-items:center;width:18px;height:18px;margin-right:5px;border-radius:50%;background:${pal("$2")};color:#fff;font:700 10px/1 system-ui,sans-serif;font-style:normal;vertical-align:-3px">${initial("$1")}</span><span class="alm-sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">$1: </span>$4</span>`,
  },
  {
    id: "alm-show-speech-tint", name: "Dialogue · tint", layer: "display", target: ["display"], order: 63, macros: "raw",
    find: gate(styleIs("tint", "script")) + SPK + SPK_BODY,
    rep: `<span class="alm-tint alm-v" data-spk="$1" data-tone="$3" style="--c:${pal("$2")};color:color-mix(in oklab,${pal("$2")} 75%,currentColor);text-decoration:underline;text-decoration-color:color-mix(in oklab,${pal("$2")} 35%,transparent);text-underline-offset:4px;text-decoration-thickness:2px;${TONE_LINE("$3", pal("$2"))}">$4</span>`,
  },
  { id: "alm-show-speech-clean", name: "Dialogue · tidy empty beats", layer: "display", target: ["display"], order: 64, find: R`<span class="(?:alm-script__par )?alm-say__beat"[^>]*>\s*<\/span>`, rep: "" },
  {
    id: "alm-show-speech-off", name: "Dialogue · plain (dialogue blocks off)", layer: "display", target: ["display"], order: 65, macros: "find",
    find: gate(`{{eq::{{getchatvar::alm_ui_color}}::0}}`) + R`\[spk=[^\]\n]*\]|\[\/spk\]`, rep: "",
  },
  {
    id: "alm-show-thought", name: "Inline thoughts", layer: "display", target: ["display"], order: 66, macros: "raw",
    find: R`\[thk=([^\]#|\n]{1,60}?)\s*(?:#(\d{1,2}))?\s*(?:\|\s*([a-z]+))?\]([\s\S]*?)(?:\[\/thk\]|(?=\[(?:spk|thk)=)|(?=\n[ \t]*\n)|$)`,
    rep: `<span class="alm-thk alm-v" data-spk="$1" style="--c:${pal("$2")};display:block;width:fit-content;max-width:88%;margin:12px 0 16px 40px;padding:9px 18px 11px;border-radius:26px;border:1.5px dashed color-mix(in oklab,${pal("$2")} 45%,transparent);background:color-mix(in oklab,${pal("$2")} 6%,transparent);font:500 1.12em/1.35 'Caveat','Segoe Print','Bradley Hand',cursive;color:color-mix(in oklab,${pal("$2")} 70%,currentColor)"><span class="alm-thk__lab" style="display:block;font:500 9.5px/1.6 ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:${pal("$2")}">$1 · thinking</span>$4</span>`,
  },
  {
    id: "alm-show-text", name: "In-world lettering", layer: "display", target: ["display"], order: 67,
    find: R`\[txt(?:=([a-z]+))?\]([\s\S]*?)\[\/txt\]`,
    rep: `<span class="alm-txt" data-kind="$1" style="display:inline-block;padding:2px 12px;border-radius:5px;border:1.5px solid color-mix(in oklab,currentColor 35%,transparent);background:color-mix(in oklab,currentColor 7%,transparent);font-variant:small-caps;letter-spacing:.08em;font-weight:600">$2</span>`,
  },
  {
    id: "alm-show-persona-speech", name: "Dialogue · the player's own messages", layer: "display", target: ["display"], placement: ["user_input"], order: 68, macros: "raw",
    find: gate(COLOR_ON) + R`(^|[\s(>—–-])(["“])([^"“”\n]{1,800})(["”])`,
    rep: `$1<span class="alm-tint alm-v" data-spk="{{user}}" style="--c:${SLOTS[0]};color:color-mix(in oklab,${SLOTS[0]} 75%,currentColor);text-decoration:underline;text-decoration-color:color-mix(in oklab,${SLOTS[0]} 35%,transparent);text-underline-offset:4px">$2$3$4</span>`,
  },

  // Display: OOC and folios
  {
    id: "alm-show-ooc", name: "OOC answer card", layer: "display", target: ["display"], order: 70,
    find: R`<ooc>\s*([\s\S]*?)\s*<\/ooc>`,
    rep: `<div class="alm-ooc" style="position:relative;margin:14px 0;padding:14px 16px 12px;border:1.5px dashed rgba(127,127,127,.4);border-radius:12px;opacity:.85;font-size:.95em"><span style="position:absolute;top:-9px;left:14px;padding:1px 8px;border-radius:6px;background:rgba(127,127,127,.85);color:#fff;font:500 10px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.16em">OOC</span>$1</div>`,
  },
  {
    id: "alm-show-folio", name: "Campaign folio (recap, reports, audit)", layer: "display", target: ["display"], order: 71,
    find: R`<folio(?:\s+title="([^"]*)")?\s*>\s*([\s\S]*?)\s*<\/folio>`,
    rep: `<div class="alm-folio" style="margin:14px 0;border:1px solid rgba(127,127,127,.3);border-radius:12px;overflow:hidden"><div class="alm-folio__hd" style="padding:9px 14px;background:linear-gradient(90deg,#b5602a,#35587e);color:#fff;font:600 12px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase">📜 $1</div><div class="alm-folio__bd" style="padding:12px 16px">$2</div></div>`,
  },

  // Display: the standalone Ledger drawer (with the Ledger installed, the extension renders it instead)
  { id: "alm-show-ledger-off", name: "Ledger · hidden (tracker view: off)", layer: "display", target: ["display"], order: 78, macros: "find", find: gate(`{{eq::{{getchatvar::alm_ui_view}}::off}}`) + R`\s*<ledger>[\s\S]*?(?:<\/ledger>|$)`, rep: "" },
  {
    id: "alm-show-ledger-bond", name: "Ledger · bond deltas", layer: "display", target: ["display"], order: 79, flags: "gm",
    find: R`^([ \t]*(?:bond|ladder|rep)\b[^\n]*?)([+−-]\d)\b` + inside("<ledger>", "<\\/ledger>"),
    rep: `$1<span style="display:inline-block;padding:0 6px;border-radius:999px;font:600 11px/1.5 ui-monospace,Menlo,monospace;background:rgba(127,127,127,.15)">$2</span>`,
  },
  {
    id: "alm-show-ledger-rows", name: "Ledger · rows", layer: "display", target: ["display"], order: 80, flags: "gm", macros: "raw",
    find: R`^[ \t]*([a-z]+)(?:[ \t]+([^:\n]{1,60}?))?[ \t]*:[ \t]*([^\n]*)\n?` + inside("<ledger>", "<\\/ledger>"),
    rep: `{{if::{{or::{{empty::{{getchatvar::alm_ui_panels}}}}::{{includes::{{getchatvar::alm_ui_panels}}::${LEDGER_PANEL}}}}}}}<div class="alm-lr" data-op="$1" style="display:flex;gap:8px;align-items:baseline;padding:5px 2px;border-bottom:1px dashed rgba(127,127,127,.2);font-size:.92em"><span style="flex:none;width:1.4em;text-align:center">${LEDGER_ICON}</span><span style="flex:none;min-width:5.5em;font:500 10.5px/1.6 ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;opacity:.7">$1</span><span><b>$2</b>{{if::{{len::$2}}}} · {{/if}}$3</span></div>{{/if}}`,
  },
  {
    id: "alm-show-ledger", name: "Ledger · tracker drawer", layer: "display", target: ["display"], order: 81, macros: "raw",
    find: R`<ledger>\s*([\s\S]*?)\s*<\/ledger>`,
    rep: `<details class="alm-drawer alm-ledger"{{if::{{eq::{{getchatvar::alm_ui_view}}::inline}}}} open{{/if}} style="margin:16px 0 0;border:1px solid rgba(127,127,127,.3);border-radius:12px;overflow:hidden"><summary style="cursor:pointer;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:9px 12px;font:500 12.5px/1.2 ui-monospace,Menlo,monospace;opacity:.9">{{if::{{len::{{getchatvar::alm_place}}}}}}<span class="alm-pill">📍 {{getchatvar::alm_place}}</span>{{/if}}{{if::{{len::{{getchatvar::alm_wx}}}}}}<span class="alm-pill">🌦 {{getchatvar::alm_wx}}</span>{{/if}}<span class="alm-pill">📒 Ledger</span><span class="alm-caret"></span></summary>{{if::{{ne::{{getchatvar::alm_ui_view}}::hud}}}}<div class="alm-drawer__body" style="padding:10px 14px">$1[[alm-desk]]</div>{{/if}}</details>`,
    description: "Draws the ledger as a tracker drawer. With the Ledger extension the ledger is replaced by a full state snapshot before this runs, so this stays out of the way.",
  },

  // Display: the Director's Desk (latest reply only)
  {
    id: "alm-show-desk", name: "Director's Desk · one-click actions", layer: "display", target: ["display"], order: 90, max: 0,
    find: R`\[\[alm-desk\]\]`,
    rep: `<div class="alm-desk" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding-top:12px;border-top:1px dashed rgba(127,127,127,.3)">${DESK_BTN("skip15", "⏩ 15 min")}${DESK_BTN("skip1h", "⏩ 1 hour")}${DESK_BTN("skipeve", "⏩ Evening")}${DESK_BTN("skipmorn", "⏩ Morning")}${DESK_BTN("recap", "📜 Recap", true)}${DESK_BTN("bonds", "🕸 Bonds")}${DESK_BTN("threads", "🧵 Threads")}${DESK_BTN("audit", "🔎 Audit")}${DESK_BTN("forecast", "🌦 Forecast")}</div>`,
    actions: [
      send("skip15", "Skip 15 minutes", "/skip 15m"),
      send("skip1h", "Skip an hour", "/skip 1h"),
      send("skipeve", "Skip until evening", "/skip until evening"),
      send("skipmorn", "Skip to the next morning", "/skip until morning"),
      send("recap", "Recap", "/recap", "Previously on…"),
      send("bonds", "Report: bonds", "/report bonds"),
      send("threads", "Report: threads", "/report threads"),
      send("audit", "Audit continuity", "/audit"),
      { id: "forecast", type: "append", multi_select: false, cost: "1", limit: "", title: "Forecast", subtitle: "Adds the weather outlook to your next message", content: "(OOC: work the weather outlook for the next few hours into the next reply, as the characters would notice it.)" },
    ],
    description: "Keycap buttons in the latest reply's ledger drawer: skip time, recap, reports, audit and forecast. Each button works once.",
  },
  { id: "alm-show-desk-old", name: "Director's Desk · only on the latest reply", layer: "display", target: ["display"], order: 91, min: 1, find: R`\[\[alm-desk\]\]`, rep: "" },
];
