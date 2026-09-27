// Host hooks: context handler (plan), WI interceptor (hybrid mirror + lore
// bridge activation), prompt interceptor (splice chapters, inject note/recall,
// sidecar director), and the render processor (time-travel tracker drawer).

import type { InterceptorResultDTO, LlmMessageDTO } from "lumiverse-spindle-types";
import { splice, validateUnits } from "../core/chronicle";
import { extractLedgerBlock, fixSpeakerLabels, rewriteKnowledgeLines } from "../core/dsl";
import { renderDrawer, plateSuffix } from "../core/render";
import { sidecarPrompt } from "../core/prompts";
import { hash, plainProse } from "../core/util";
import { debug, describe, has, host, rememberUser, userFor, warn, within } from "./host";
import { ledgerFor } from "./ledger";
import { loadChat, loadSettings, save, type Detected } from "./store";
import { isEnabled, lastPlan, notePlanError, safePlan } from "./turn";
import { pushMacros } from "./macros";
import { quiet, sys } from "./llm";

// ---------------------------------------------------------------------------
// Context handler: refresh + plan before assembly
// ---------------------------------------------------------------------------

export function registerContextHandler() {
  if (!has("context_handler")) return;
  host.registerContextHandler(async (context: any) => {
    try {
      const chatId: string | undefined = context?.chatId;
      if (!chatId) return context;
      const userId: string | undefined = context?.userId ?? userFor(chatId);
      rememberUser(chatId, userId);
      const genType: string = context?.generationType ?? "normal";
      if (genType === "quiet") return context;
      const plan = await safePlan(chatId, genType, userId, { dryRun: !!context?.dryRun });
      await pushMacros(chatId, userId);
      if (plan && !context?.dryRun) save(chatId, "meta", userId);
    } catch (err) {
      warn(`context handler: ${describe(err)}`);
    }
    return context;
  }, 60, { timeoutMs: 30_000 });
}

// ---------------------------------------------------------------------------
// World-info interceptor: hybrid mirror book + lore bridge modes
// ---------------------------------------------------------------------------

export function registerWorldInfoInterceptor() {
  if (!has("generation")) return;
  host.registerWorldInfoInterceptor(async (ctx) => {
    try {
      const files = await loadChat(ctx.chatId, ctx.userId);
      const settings = await loadSettings(ctx.userId);
      if (!isEnabled(files.meta, settings)) return;
      let plan = lastPlan(ctx.chatId);
      if (!plan) plan = (await within(safePlan(ctx.chatId, "normal", ctx.userId, { dryRun: true }), 7000, null, "wi plan")) ?? undefined;
      const mirrorBook = files.meta.mirror.bookId;
      const disabled: string[] = [];
      const forced: string[] = [];
      const enabled: string[] = [];
      const mutated: { id: string; content: string }[] = [];
      for (const e of ctx.entries) {
        if (mirrorBook && e.world_book_id === mirrorBook) {
          const cid = (e.extensions as any)?.almanac?.codexId as string | undefined;
          if (!cid || cid.startsWith("chron:") || !plan?.mirrorPicks[cid]) {
            disabled.push(e.id);
            continue;
          }
          forced.push(e.id);
          enabled.push(e.id);
          mutated.push({ id: e.id, content: plan.mirrorPicks[cid] });
          continue;
        }
        if (!plan) continue;
        const book = files.meta.lore.books[e.world_book_id];
        if (!book) continue;
        if (plan.divergence[e.id]) mutated.push({ id: e.id, content: `[History — as of now: ${plan.divergence[e.id]}.] ${e.content}` });
        if (book.mode === "native") continue;
        if (plan.lorePicks.has(e.id)) {
          forced.push(e.id);
        } else if (book.mode === "managed" && !e.constant) {
          disabled.push(e.id);
        }
      }
      debug(`wi: disabled ${disabled.length}, forced ${forced.length}, mutated ${mutated.length}`);
      return { disabled, forced, enabled, mutated };
    } catch (err) {
      warn(`wi interceptor: ${describe(err)}`);
    }
  }, 60);
}

// ---------------------------------------------------------------------------
// Prompt interceptor
// ---------------------------------------------------------------------------

const CONFIG_RE = /<almanac-config\b([^>]*)\/?>(?:\s*<\/almanac-config>)?\s*/i;

function parseConfig(attrs: string): Detected {
  const get = (k: string) => new RegExp(`\\b${k}\\s*=\\s*"([^"]*)"`, "i").exec(attrs)?.[1]?.trim();
  const list = (v?: string) => (v ? v.split(/\s*[,;]\s*/).map((x) => x.trim().toLowerCase()).filter(Boolean) : undefined);
  const persona = get("persona");
  return {
    sealed: persona ? persona === "sealed" || persona === "continuity" : undefined,
    personaThoughts: get("thoughts") === "1",
    genres: list(get("genres")),
    lead: get("lead")?.toLowerCase() || undefined,
    nsfw: get("nsfw"),
    romance: get("romance"),
    dialogue: get("dialogue"),
    dialogueStyle: get("style"),
    cot: get("cot"),
    ledger: get("ledger"),
    trackers: list(get("trackers")),
    trackerView: get("view"),
    theme: get("theme"),
    at: Date.now(),
  };
}

function textOf(m: LlmMessageDTO): string {
  return typeof m.content === "string" ? m.content : m.content.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function setText(m: LlmMessageDTO, text: string): LlmMessageDTO {
  if (typeof m.content === "string") return { ...m, content: text };
  let done = false;
  const parts = m.content.map((p) => {
    if (p.type === "text" && !done) {
      done = true;
      return { ...p, text };
    }
    return p.type === "text" ? { ...p, text: "" } : p;
  });
  return { ...m, content: parts };
}

export function registerPromptInterceptor() {
  if (!has("interceptor")) return;
  host.registerInterceptor(async (messages, context) => {
    const chatId = context?.chatId;
    if (!chatId) return messages;
    try {
      const userId = context.userId ?? userFor(chatId);
      rememberUser(chatId, userId);
      const genType = context.generationType ?? "normal";
      if (genType === "quiet") return messages;
      const files = await loadChat(chatId, userId);
      const settings = await loadSettings(userId);
      const meta = files.meta;

      // 1. Handshake + charter detection (strip the handshake before the model sees it).
      let msgs = messages.slice();
      let almanacPrompt = false;
      for (let i = 0; i < msgs.length; i++) {
        const t = textOf(msgs[i]);
        if (msgs[i].role === "system" && /<almanac>/.test(t)) almanacPrompt = true;
        const m = CONFIG_RE.exec(t);
        if (m) {
          meta.detected = { ...meta.detected, ...Object.fromEntries(Object.entries(parseConfig(m[1])).filter(([, v]) => v !== undefined)) };
          msgs[i] = setText(msgs[i], t.replace(CONFIG_RE, ""));
          almanacPrompt = true;
        }
      }
      if (almanacPrompt && settings.enabled === "auto" && !meta.enabled && meta.config.enabledOverride !== false) {
        meta.enabled = true;
        save(chatId, "meta", userId);
      }
      if (!isEnabled(meta, settings)) return msgs;
      // Speech labelled `Name#N|tone:` in earlier replies teaches the model the
      // wrong shape (and outlives the [spk] marks thinned from older turns).
      for (let i = 0; i < msgs.length; i++) {
        if (msgs[i].role !== "assistant") continue;
        const t = textOf(msgs[i]);
        const f = fixSpeakerLabels(t);
        if (f !== t) msgs[i] = setText(msgs[i], f);
      }
      if (genType === "impersonate") return msgs;

      let plan = lastPlan(chatId);
      if (!plan || plan.genType !== genType) plan = (await safePlan(chatId, genType, userId, { dryRun: context.isDryRun })) ?? undefined;
      if (!plan) return msgs;
      const L = ledgerFor(chatId, userId);

      // Knowledge lines in earlier replies, as the Almanac filed them (one fact a line, #keys, no diary):
      // the model writes its next ledger in the shape of the last one it sees.
      const canon = L.state?.knowCanon ?? {};
      const idToIdx = new Map(L.path.map((m) => [m.id, m.index]));
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i] as any;
        if (m.role !== "assistant" || !m.__isChatHistory) continue;
        const idx: number | undefined = m.sourceIndexInChat ?? (m.sourceMessageId ? idToIdx.get(m.sourceMessageId) : undefined);
        if (idx == null || !(idx in canon)) continue;
        const t = textOf(msgs[i]);
        const f = rewriteKnowledgeLines(t, canon[idx]);
        if (f !== t) msgs[i] = setText(msgs[i], f);
      }

      // 2. Chronicle: drop covered turns and splice summaries in place.
      const breakdown: { messageIndex: number; name: string }[] = [];
      if (settings.chronicle && files.chronicle.units.length) {
        validateUnits(files.chronicle, L.path);
        const idToIndex = new Map(L.path.map((m) => [m.id, m.index]));
        const res = splice(msgs as any[], files.chronicle, idToIndex);
        msgs = res.messages as LlmMessageDTO[];
        for (const inj of res.injected) breakdown.push({ messageIndex: inj.index, name: inj.name });
      }

      // 3. Injection points
      const lastUserIdx = (() => {
        for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === "user" && (msgs[i] as any).__isChatHistory) return i;
        for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === "user") return i;
        return msgs.length;
      })();
      const inserts: { at: number; msg: LlmMessageDTO; name: string }[] = [];
      if (plan.recallText) {
        let at = msgs.findIndex((m) => (m as any).__isChatHistory);
        if (settings.recallPlacement === "depth4") at = Math.max(0, lastUserIdx - 3);
        if (at < 0) at = lastUserIdx;
        inserts.push({ at, msg: { role: "system", content: plan.recallText }, name: "ALMANAC · Recall" });
      }
      // Sidecar director (planner connection), only for fresh turns.
      if (meta.detected.cot === "sidecar" && (genType === "normal" || genType === "regenerate" || genType === "swipe") && !context.isDryRun) {
        const planText = await runSidecar(msgs, plan.tier, L.names.user, settings, userId);
        if (planText) inserts.push({ at: lastUserIdx, msg: { role: "system", content: `<director-plan>\n${planText}\n</director-plan>\nFollow this plan. Do not repeat it; write the reply.` }, name: "ALMANAC · Director plan" });
      }
      const noteText = [plan.note, plan.speechFix, plan.formatExample].filter(Boolean).join("\n");
      inserts.push({ at: lastUserIdx, msg: { role: "system", content: noteText }, name: "ALMANAC · Now" });

      // Apply inserts from the end so indices stay valid; then compute breakdown indices.
      inserts.sort((a, b) => a.at - b.at);
      const out: LlmMessageDTO[] = [];
      const names = new Map<LlmMessageDTO, string>();
      let k = 0;
      for (let i = 0; i <= msgs.length; i++) {
        while (k < inserts.length && inserts[k].at === i) {
          out.push(inserts[k].msg);
          names.set(inserts[k].msg, inserts[k].name);
          k++;
        }
        if (i < msgs.length) out.push(msgs[i]);
      }
      const spliced = new Set(breakdown.map((b) => msgs[b.messageIndex]));
      const finalBreakdown: { messageIndex: number; name: string }[] = [];
      out.forEach((m, idx) => {
        const n = names.get(m);
        if (n) finalBreakdown.push({ messageIndex: idx, name: n });
        else if (spliced.has(m)) {
          const b = breakdown.find((x) => msgs[x.messageIndex] === m);
          if (b) finalBreakdown.push({ messageIndex: idx, name: b.name });
        }
      });
      save(chatId, "meta", userId);
      const result: InterceptorResultDTO = { messages: out, breakdown: finalBreakdown };
      return result;
    } catch (err) {
      warn(`prompt interceptor: ${describe(err)}`);
      await notePlanError(chatId, context.userId ?? userFor(chatId), err, "building the prompt", context.generationType ?? "normal");
      return messages;
    }
  }, 80);
}

async function runSidecar(msgs: LlmMessageDTO[], tier: string, userName: string, settings: Awaited<ReturnType<typeof loadSettings>>, userId?: string): Promise<string | null> {
  try {
    const planning: LlmMessageDTO[] = [...msgs.map((m) => ({ role: m.role, content: m.content })), sys(sidecarPrompt({ userName, tier }))];
    const text = await quiet(planning as LlmMessageDTO[], { connectionId: settings.sidecarConnection || undefined, timeoutMs: settings.sidecarTimeout * 1000, userId, label: "sidecar director" });
    return text.replace(/<\/?(director-plan|plan)>/gi, "").trim().slice(0, 4000) || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Render processor: the drawer as of each message (display only, never stored)
// ---------------------------------------------------------------------------

const renderCache = new Map<string, string>();

export function registerRenderProcessor() {
  if (!has("chat_mutation")) return;
  host.registerMessageContentProcessor(async (ctx) => {
    if (ctx.origin !== "render" || ctx.isUser || !ctx.messageId) return;
    const labelled = /#\d/.test(ctx.content);
    if (!labelled && !/<ledger\b|🗓/u.test(ctx.content)) return;
    try {
      const files = await loadChat(ctx.chatId, ctx.userId);
      const settings = await loadSettings(ctx.userId);
      if (!isEnabled(files.meta, settings)) return;
      // `Name#N|tone: "…"` → a proper speaker mark, so the voice card draws.
      const fixed = labelled ? fixSpeakerLabels(ctx.content) : ctx.content;
      if (!/<ledger\b|🗓/u.test(fixed)) return fixed !== ctx.content ? { content: fixed } : undefined;
      const L = ledgerFor(ctx.chatId, ctx.userId);
      const key = `${ctx.chatId}:${ctx.messageId}:${hash(ctx.content)}:${L.stamp}:${hash(JSON.stringify(files.meta.config.colors))}:${files.meta.detected.trackerView ?? ""}`;
      const hit = renderCache.get(key);
      if (hit != null) return { content: hit };
      if (!L.raw.some((m) => m.id === ctx.messageId)) await L.refresh();
      const state = L.stateAt(ctx.messageId, files.meta, settings, files.side);
      if (!state) return;
      const al = L.almanac(files.meta, settings, state);
      let content = fixed;
      // Plate enrichment: exact sun times and moon phase on the header line.
      if (al) content = content.replace(/^([ \t]*🗓[^\n]*?)(\s*⟪[^⟫]*⟫)?[ \t]*$/mu, (_m, line) => `${line}${plateSuffix(al)}`);
      const block = extractLedgerBlock(content);
      if (block) {
        const view = (files.meta.detected.trackerView ?? "drawer").toLowerCase();
        const lastAssistant = [...L.raw].reverse().find((m: any) => !(m.is_user ?? m.role === "user"));
        const msgIdx = L.path.findIndex((m) => m.id === ctx.messageId);
        const html = view === "off" ? "" : renderDrawer({
          state, delta: state.lastDelta, almanac: al, colors: files.meta.config.colors, userName: L.names.user,
          sealed: L.foldOptions(files.meta, settings).sealed, nsfw: !!files.meta.detected.nsfw && files.meta.detected.nsfw !== "off",
          view: view.startsWith("hud") ? "hud" : view.startsWith("inline") ? "inline" : "drawer",
          trackers: files.meta.detected.trackers, latest: lastAssistant?.id === ctx.messageId,
          unverified: state.unverified.includes(L.path[msgIdx]?.index ?? -1),
        });
        content = content.replace(/<ledger\b[^>]*>[\s\S]*?(<\/ledger>|$)/i, `\n\n${html}\n`);
      }
      renderCache.set(key, content);
      if (renderCache.size > 400) renderCache.delete(renderCache.keys().next().value!);
      return { content };
    } catch (err) {
      warn(`render: ${describe(err)}`);
    }
  }, 60);
}

export function clearRenderCache() {
  renderCache.clear();
}

export { plainProse };
