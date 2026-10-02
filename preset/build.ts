// Builds preset/ALMANAC.json (a Lumiverse Loom preset, schema v2) from the block
// and regex sources, and validates it: unique ids, placement bindings, every
// regex compiles, and no block leaves a macro unbalanced.
//
// ALMANAC runs only with the ALMANAC Ledger extension: every content block is
// sent only while the Ledger manages the chat (Boot sets alm_linked from
// {{almActive}}). Boot, the absolute boundaries and the gate (which tells the
// player what's missing) are the only blocks sent without it.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { coreBlocks } from "./src/blocks-core";
import { worldBlocks } from "./src/blocks-world";
import { craftBlocks } from "./src/blocks-craft";
import { sourceBlocks, turnBlocks } from "./src/blocks-turn";
import { REGEX, toScript } from "./src/regex";
import { PRESET_VERSION } from "../src/core/version";

export const VERSION = PRESET_VERSION;

const DEFAULTS = {
  role: "system", enabled: true, position: "pre_history", depth: 0, marker: null, isLocked: false, color: null,
  injectionTrigger: [] as string[], characterTagTrigger: [] as string[], group: null, categoryMode: null, content: "",
};

/** Sent whether or not the Ledger manages the chat. */
const UNGATED = new Set(["alm-boot", "alm-floor", "alm-gate"]);

export function buildBlocks() {
  const raw: any[] = [...coreBlocks, ...worldBlocks, ...craftBlocks, ...sourceBlocks, ...turnBlocks];
  return raw.map((b) => {
    const block: any = { ...DEFAULTS, ...b };
    if (!block.marker && block.content && !UNGATED.has(block.id)) block.content = `{{if::{{getvar::alm_linked}}}}${block.content}{{/if}}`;
    return block;
  });
}

/** The Director's Pass opener for models that continue a reasoning prefix (DeepSeek, Kimi): story turns with native planning only. */
const REASONING_PREFILL = `{{if::{{and::{{getvar::alm_linked}}::{{eq::{{getvar::alm_cotch}}::native}}}}}}{{if::{{or::{{eq::{{getvar::alm_route}}::scene}}::{{eq::{{getvar::alm_route}}::variant}}}}}}Director's Pass — {{switch::{{var::cot}}::lean::ROUTE, ANCHOR, SEAL, MINDS, MOVE, VOICE, LEDGER::ROUTE, ANCHOR, SEAL, GNOSIS, MINDS, WEB, WORLD, MOVE, PREMORTEM, VOICE, LEDGER}}. Fragments only; never draft. Stop at LEDGER, then write.{{/if}}{{/if}}`;

export function buildPreset() {
  const blocks = buildBlocks();
  const regex_scripts = REGEX.map(toScript);
  return {
    name: "ALMANAC",
    description: "A living-world roleplay preset in English: deep characters with private minds, autonomous NPCs who relate to each other, a knowledge firewall, real time and weather, genre contracts that change the story, a sealed persona, and a line-based ledger. Requires the ALMANAC Ledger extension, which keeps the verified state, chapters, recall, the off-screen world and the almanac; without it the preset only tells you so.",
    coverUrl: null,
    presetVersion: VERSION,
    schemaVersion: 2,
    // Off: newer models reject temperature and top_p sent together (and reasoning models reject
    // temperature); the connection's own sampling applies.
    samplerOverrides: { enabled: false, maxTokens: null, contextSize: null, temperature: null, topP: null, minP: null, topK: null, frequencyPenalty: null, presencePenalty: null, repetitionPenalty: null, streaming: true },
    customBody: { enabled: false, rawJson: "{}" },
    promptBehavior: {
      continueNudge: "[Continue from the exact last word. No header, no recap, no restart; the ledger at the end only if the reply has none yet.]",
      emptySendNudge: "[The player waits. Let the world move on its own: at most one unprompted move, then stop where the player can act.]",
      impersonationPrompt: "[Write {{user}}'s next message in {{user}}'s own voice, in the player's usual form and length. Only {{user}} acts or speaks. No header, marks, ledger or artifacts.]",
      groupNudge: "[Write the next reply as {{char}}; everyone else present keeps living in the scene.]",
      newChatPrompt: "[A new story begins. Open Day 1 with the scene header, from the start point or the setting.]",
      newGroupChatPrompt: "[A new story begins. Present: {{group}}. Open Day 1 with the scene header, from the start point or the setting.]",
      sendIfEmpty: "",
    },
    completionSettings: {
      assistantPrefill: "",
      reasoningPrefill: REASONING_PREFILL,
      assistantImpersonation: "",
      continuePrefill: false,
      continuePostfix: " ",
      namesBehavior: 0,
      squashSystemMessages: false,
      useSystemPrompt: true,
      enableWebSearch: false,
      sendInlineMedia: true,
      enableFunctionCalling: true,
      includeUsage: false,
    },
    advancedSettings: { seed: -1, customStopStrings: [], collapseMessages: false, trimIncompleteWords: false },
    modelProfiles: {},
    promptVariables: {},
    blocks,
    extensions: { regex_scripts },
    metadata: { almanac: { version: VERSION, companion: "almanac_ledger", requires: "almanac_ledger", language: "English", design: "design/02-preset-almanac.md" } },
  };
}

// ── Validation ──────────────────────────────────────────────────────────────
/** Remove find-pattern gates so the underlying regex can be compiled. */
export function ungate(find: string): string {
  return find.replace(/^\{\{if::[\s\S]*?\{\{else\}\}\(\?!\)\{\{\/if\}\}/, "");
}

/** Balanced {{ … }} (ignoring single braces), returning the first problem or null. */
export function macroBalance(text: string): string | null {
  let depth = 0;
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth++;
      i++;
    } else if (text[i] === "}" && text[i + 1] === "}") {
      depth--;
      i++;
      if (depth < 0) return `unexpected "}}" near: ${JSON.stringify(text.slice(Math.max(0, i - 40), i + 20))}`;
    }
  }
  return depth === 0 ? null : `${depth} unclosed "{{"`;
}

/** A run of an odd number of braces leaves one in the text the model reads ("}}}" after a macro is one too many). */
export function strayBrace(text: string): string | null {
  text = text.replace(/\{\d+(?:,\d*)?\}/g, "  "); // regex quantifiers inside {{regex::…}}
  const m = /(?<![{}])(?:\{\{)*\{(?![{}])|(?<![{}])(?:\}\})*\}(?![{}])/.exec(text);
  return m ? `stray "${m[0].slice(-1)}" near: ${JSON.stringify(text.slice(Math.max(0, m.index - 40), m.index + 20))}` : null;
}

export function scopedBalance(text: string): string | null {
  const opens = (text.match(/\{\{(if|unless|trim)::|\{\{trim\}\}/g) ?? []).length;
  const closes = (text.match(/\{\{\/(if|unless|trim)\}\}/g) ?? []).length;
  // {{if::cond}}…{{/if}} and {{unless}} are scoped; {{trim}} is scoped.
  return opens === closes ? null : `${opens} scoped opens vs ${closes} closes`;
}

export function validate(preset: ReturnType<typeof buildPreset>): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  const varIds = new Set<string>();
  for (const b of preset.blocks) {
    if (ids.has(b.id)) errs.push(`duplicate block id ${b.id}`);
    ids.add(b.id);
    for (const v of b.variables ?? []) {
      if (varIds.has(v.id)) errs.push(`duplicate variable id ${v.id}`);
      varIds.add(v.id);
    }
    if (b.placementBinding) {
      const sel = (b.variables ?? []).find((v: any) => v.id === b.placementBinding.variableId && v.type === "select");
      if (!sel) errs.push(`${b.id}: placement binding points at a missing select`);
      else for (const o of sel.options) if (!b.placementBinding.options[o.id]) errs.push(`${b.id}: placement option ${o.id} unbound`);
    }
    const bal = macroBalance(b.content) ?? scopedBalance(b.content) ?? strayBrace(b.content);
    if (bal) errs.push(`${b.id}: ${bal}`);
  }
  const scriptIds = new Set<string>();
  for (const s of preset.extensions.regex_scripts) {
    if (scriptIds.has(s.script_id)) errs.push(`duplicate regex id ${s.script_id}`);
    scriptIds.add(s.script_id);
    try {
      new RegExp(ungate(s.find_regex), s.flags);
    } catch (e) {
      errs.push(`${s.script_id}: ${(e as Error).message}`);
    }
    if (s.substitute_macros !== "none") {
      const bal = macroBalance(s.find_regex) ?? macroBalance(s.replace_string);
      if (bal) errs.push(`${s.script_id}: ${bal}`);
    }
    for (const m of s.metadata.prompt_activation?.mappings ?? []) for (const id of m.block_ids) if (!ids.has(id)) errs.push(`${s.script_id}: activation targets missing block ${id}`);
    for (const a of s.actions) if (!s.replace_string.includes(`data-regex-action="${a.id}"`)) errs.push(`${s.script_id}: action ${a.id} has no element`);
  }
  return errs;
}

if (import.meta.main) {
  const preset = buildPreset();
  const errs = validate(preset);
  if (errs.length) {
    console.error(errs.join("\n"));
    process.exit(1);
  }
  const out = join(import.meta.dir, "ALMANAC.json");
  writeFileSync(out, JSON.stringify(preset, null, 2) + "\n");
  const chars = preset.blocks.reduce((n: number, b: any) => n + b.content.length, 0);
  console.log(`ALMANAC ${VERSION}: ${preset.blocks.length} blocks (${chars} chars of source), ${preset.extensions.regex_scripts.length} regex scripts → ${out}`);
}
