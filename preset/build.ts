// Builds preset/ALMANAC.json (a Lumiverse Loom preset, schema v2) from the block
// and regex sources, and validates it: unique ids, router and placement bindings,
// every regex compiles, and no block leaves a macro unbalanced.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { coreBlocks } from "./src/blocks-core";
import { worldBlocks } from "./src/blocks-world";
import { craftBlocks } from "./src/blocks-craft";
import { sourceBlocks, turnBlocks } from "./src/blocks-turn";
import { REGEX, toScript } from "./src/regex";

export const VERSION = "1.0.9";

const DEFAULTS = {
  role: "system", enabled: true, position: "pre_history", depth: 0, marker: null, isLocked: false, color: null,
  injectionTrigger: [] as string[], characterTagTrigger: [] as string[], group: null, categoryMode: null, content: "",
};

export function buildBlocks() {
  const raw: any[] = [...coreBlocks, ...worldBlocks, ...craftBlocks, ...sourceBlocks, ...turnBlocks];
  return raw.map((b) => {
    const block: any = { ...DEFAULTS, ...b };
    if (block.id.startsWith("alm-scene-")) block.enabled = false; // the router opens them
    return block;
  });
}

export function buildPreset() {
  const blocks = buildBlocks();
  const regex_scripts = REGEX.map(toScript);
  return {
    name: "ALMANAC",
    description: "A living-world roleplay preset: deep characters with private minds, autonomous NPCs who relate to each other, a knowledge firewall, real time and weather, genre contracts that change the story, a sealed persona, and a line-based ledger that drives trackers and memory. Works alone; pairs with the ALMANAC Ledger extension for verified state, chapters, recall and a deterministic almanac.",
    coverUrl: null,
    presetVersion: VERSION,
    schemaVersion: 2,
    samplerOverrides: { enabled: true, maxTokens: null, contextSize: null, temperature: 1, topP: 0.95, minP: null, topK: null, frequencyPenalty: null, presencePenalty: null, repetitionPenalty: null, streaming: true },
    customBody: { enabled: false, rawJson: "{}" },
    promptBehavior: {
      continueNudge: "[Continue from the exact last word. No header, no recap, no restart, no second ledger.]",
      emptySendNudge: "[The player waits. Let the world move on its own — within the initiative budget.]",
      impersonationPrompt: "[Write {{user}}'s next message in {{user}}'s own voice, in the player's usual form and length. Only {{user}} acts or speaks. No header, marks, ledger or artifacts.]",
      groupNudge: "[Write the next reply as {{char}}; everyone else present keeps living in the scene.]",
      newChatPrompt: "[A new story begins. Seed the clock from the start point or the setting.]",
      newGroupChatPrompt: "[A new story begins. Present: {{group}}. Seed the clock from the start point or the setting.]",
      sendIfEmpty: "",
    },
    completionSettings: {
      assistantPrefill: "",
      reasoningPrefill: "Director's Pass — ROUTE, ANCHOR, SEAL, GNOSIS, MINDS, WEB, WORLD, MOVE, PREMORTEM, VOICE, LEDGER. Fragments only; never draft. Stop at LEDGER, then write.",
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
    metadata: { almanac: { version: VERSION, companion: "almanac_ledger", design: "design/02-preset-almanac.md" } },
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
    const bal = macroBalance(b.content) ?? scopedBalance(b.content);
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
