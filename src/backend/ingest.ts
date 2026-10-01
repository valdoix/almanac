// After each reply (and on swipe/edit/delete/fork): refold, repair a missing
// ledger, draw hidden pressures, measure craft, run the chronicle and the
// off-screen simulator in the background, then refresh mirror, macros, chat
// variables and the UI.

import { anchorKey, sideKey, toPath } from "../core/branch";
import { coverageGaps, makeUnit, planChronicle, spanSignature, transcriptFor, validateUnits } from "../core/chronicle";
import { extractLedgerBlock, parseLine } from "../core/dsl";
import { extractOps } from "../core/extractor";
import { drawPressures } from "../core/pressures";
import { archivistPrompt, extractJson, repairPrompt, rollupPrompt, simulatorPrompt, summaryPrompt, summaryPriorChars, summaryWords } from "../core/prompts";
import { craftReport } from "../core/telemetry";
import { absMinutes, fmtTime, fromAbs, hash, plainProse, uid } from "../core/util";
import { levelOf, seedFor } from "../core/engines/weather";
import { offPageFacts, redact } from "../core/offpage";
import { playbookPlayed } from "../core/lore";
import type { ParsedOp } from "../core/types";
import { debounce, debug, describe, has, host, serial, warn } from "./host";
import { ledgerFor } from "./ledger";
import { quiet, sys, usr } from "./llm";
import { mirrorChatVars, pushMacros } from "./macros";
import { syncMirror } from "./mirror";
import { appendEvents, copyChat, loadChat, loadSettings, noteProblem, save } from "./store";
import { isEnabled } from "./turn";
import { pushState } from "./view";
import { clearRenderCache } from "./hooks";
import { scheduleClerk } from "./clerk";
import { runCheck } from "./check";
import { readPlayerFacts } from "./playerfacts";

const busy = new Set<string>();

/** Called when a generation ends. */
export async function onReply(chatId: string, messageId: string | undefined, content: string, genType: string, userId?: string) {
  const files = await loadChat(chatId, userId);
  const settings = await loadSettings(userId);
  const meta = files.meta;
  if (settings.enabled === "auto" && !meta.enabled && meta.config.enabledOverride !== false && /<ledger\b/i.test(content)) {
    meta.enabled = true;
    save(chatId, "meta", userId);
  }
  if (!isEnabled(meta, settings) || genType === "impersonate") return;
  let replyId: string | undefined;
  await serial(`chat:${chatId}`, async () => {
    const L = ledgerFor(chatId, userId);
    await L.refresh({ reloadNames: !L.names.char });
    const msg = messageId ? L.path.find((m) => m.id === messageId) : L.lastAssistant();
    if (msg && !msg.isUser) replyId = msg.id;
    if (msg && !msg.isUser && !extractLedgerBlock(msg.content) && settings.autoRepair && meta.detected.ledger !== "off") {
      await repair(chatId, msg.id, msg.swipe, msg.content, userId).catch((err) => warn(`repair: ${describe(err)}`));
      await L.refresh();
    }
    // Audit log (the chat itself remains the source of truth).
    const last = L.state.lastDelta;
    if (last) appendEvents(chatId, [{ t: Date.now(), msgId: last.msgId, idx: last.msgIndex, n: last.count, rejected: last.rejected, lines: last.lines }], userId);
    // Hidden pressures (seeded; narrator-only)
    if (settings.pressures) {
      const add = drawPressures(L.state, seedFor(chatId), meta.detected.genres ?? meta.config.genres ?? [], meta.pressures);
      if (Object.keys(add).length) Object.assign(meta.pressures, add);
    }
    if (settings.telemetry) meta.telemetry = craftReport(L.recentAssistant(6), { userName: L.names.user, sealed: L.foldOptions(meta, settings).sealed, dialogue: meta.detected.dialogue });
    save(chatId, "meta", userId);
  });
  // The knowledge clerk reads the reply in the background; the next plan waits for it briefly.
  if (replyId && settings.knowledgeClerk !== "off") scheduleClerk(chatId, replyId, userId, () => afterChange(chatId, userId, { background: false }));
  afterChange(chatId, userId, { background: true });
  // Check the reply for slips, and read facts the player stated, in the background.
  if (replyId) {
    const id = replyId;
    runCheck(chatId, id, userId).then((issues) => issues && afterChange(chatId, userId, { background: false })).catch(() => undefined);
    readPlayerFacts(chatId, id, userId).then((n) => n && onMutation(chatId, userId)).catch(() => undefined);
  }
}

/** Swipe navigation, edits, deletes: refold and refresh everything that projects state. */
export function onMutation(chatId: string, userId?: string) {
  debounce(`mut:${chatId}`, 350, async () => {
    const files = await loadChat(chatId, userId);
    const settings = await loadSettings(userId);
    if (!isEnabled(files.meta, settings)) return;
    const L = ledgerFor(chatId, userId);
    await serial(`chat:${chatId}`, () => L.refresh());
    // Chronicle units whose turns changed are dropped (they will be re-summarised), and their turns come back.
    const stale = validateUnits(files.chronicle, toPath(L.raw));
    if (stale.length) {
      files.chronicle.units = files.chronicle.units.filter((u) => !u.stale || u.locked);
      save(chatId, "chronicle", userId);
    }
    await syncHidden(chatId, userId);
    afterChange(chatId, userId, { background: false });
  });
}

function afterChange(chatId: string, userId: string | undefined, opts: { background: boolean }) {
  clearRenderCache();
  pushMacros(chatId, userId);
  mirrorChatVars(chatId, userId);
  pushState(chatId, userId);
  debounce(`mirror:${chatId}`, 2000, () => syncMirror(chatId, userId));
  if (opts.background) {
    debounce(`bg:${chatId}`, 800, async () => {
      await runChronicle(chatId, userId).catch((err) => noteProblem(chatId, userId, "chapter summary", err));
      await runSimulator(chatId, userId).catch((err) => noteProblem(chatId, userId, "off-screen simulator", err));
      pushState(chatId, userId);
    });
  }
}

// ---------------------------------------------------------------------------
// Hidden turns
// ---------------------------------------------------------------------------

/**
 * Make the turns the Almanac hid match what it covers and sends. Turns are hidden only while
 * the chat is on, the Chronicle is on and "Hide covered turns" is on, and only under a live
 * chapter the prompt carries. Anything else it hid comes back: otherwise switching the chat or
 * the Chronicle off would leave those turns out of the prompt with no summary in their place.
 * Only turns the Almanac hid are ever shown again.
 */
export async function syncHidden(chatId: string, userId?: string, opts: { release?: boolean } = {}): Promise<{ hidden: number; shown: number }> {
  if (!has("chat_mutation")) return { hidden: 0, shown: 0 };
  return serial(`hide:${chatId}`, async () => {
    const files = await loadChat(chatId, userId);
    const settings = await loadSettings(userId);
    const keep = !opts.release && isEnabled(files.meta, settings) && settings.chronicle && settings.hideCovered;
    const L = ledgerFor(chatId, userId);
    const exists = new Set(L.raw.map((m) => m.id));
    const want = new Set<string>();
    if (keep) for (const u of files.chronicle.units) if (u.level === "chapter" && !u.stale && !u.ghost) for (const id of u.msgIds) if (!exists.size || exists.has(id)) want.add(id);
    const had = new Set(files.chronicle.hidden);
    const show = [...had].filter((id) => !want.has(id));
    const hide = [...want].filter((id) => !had.has(id));
    let shown = 0;
    let hidden = 0;
    for (let i = 0; i < show.length; i += 500) {
      const batch = show.slice(i, i + 500);
      try {
        await host.chat.setMessagesHidden(chatId, batch, false);
        for (const id of batch) had.delete(id);
        shown += batch.length;
      } catch (err) {
        // Turns that are gone can't be shown; anything else stays listed so the next pass retries.
        if (exists.size && batch.every((id) => !exists.has(id))) for (const id of batch) had.delete(id);
        else await noteProblem(chatId, userId, "showing summarised turns again", err);
      }
    }
    for (let i = 0; i < hide.length; i += 500) {
      const batch = hide.slice(i, i + 500);
      try {
        await host.chat.setMessagesHidden(chatId, batch, true);
        for (const id of batch) had.add(id);
        hidden += batch.length;
      } catch (err) {
        await noteProblem(chatId, userId, "hiding summarised turns", err);
      }
    }
    if (shown || hidden || had.size !== files.chronicle.hidden.length) {
      files.chronicle.hidden = [...had];
      save(chatId, "chronicle", userId);
    }
    if (shown || hidden) debug(`hidden turns ${chatId}: +${hidden} −${shown}`);
    return { hidden, shown };
  });
}

// ---------------------------------------------------------------------------
// Repair: missing or broken ledger → quiet call → extractor fallback
// ---------------------------------------------------------------------------

export async function repair(chatId: string, msgId: string, swipe: number, content: string, userId?: string) {
  const files = await loadChat(chatId, userId);
  const settings = await loadSettings(userId);
  const key = sideKey(msgId, swipe);
  if (files.meta.repaired[key]) return;
  const L = ledgerFor(chatId, userId);
  const before = L.path.filter((m) => m.index < (L.path.find((x) => x.id === msgId)?.index ?? Infinity));
  const prevState = L.runtime.fold(before, L.foldOptions(files.meta, settings), files.side).state;
  const verified = `${fmtTime(prevState.time)} · ${prevState.place.join(" › ")} · present: ${Object.values(prevState.chars).filter((c) => c.tier === "spot" || c.tier === "peri").map((c) => c.name).join(", ")}`;
  let ops: ParsedOp[] = [];
  let source: "repair" | "extractor" = "repair";
  try {
    const p = repairPrompt({ prose: plainProse(content), verified, userName: L.names.user, sealed: L.foldOptions(files.meta, settings).sealed, lang: files.meta.detected.lang });
    let text = await quiet([sys(p.system), usr(p.user)], { userId, reasoningOff: true, timeoutMs: 60_000, connectionId: settings.summarizerConnection || undefined, label: "ledger repair" });
    if (!/<ledger/i.test(text)) text = await quiet([sys(p.system), usr(p.user)], { userId, timeoutMs: 90_000, connectionId: settings.summarizerConnection || undefined, label: "ledger repair (thinking)" });
    const block = extractLedgerBlock(text);
    ops = (block?.body ?? "").split("\n").map((l) => parseLine(l)).filter(Boolean) as ParsedOp[];
  } catch {
    /* fall through to the extractor */
  }
  if (!ops.length) {
    source = "extractor";
    ops = extractOps(content, Object.values(prevState.chars).map((c) => c.name), L.names.user);
  }
  files.side[key] = [...(files.side[key] ?? []).filter((s) => !s.replaces), { source, ops, replaces: true, hash: hash(content) }];
  files.meta.repaired[key] = ops.length ? source : "failed";
  save(chatId, "side", userId);
  save(chatId, "meta", userId);
  debug(`repair ${key}: ${source}, ${ops.length} ops`);
}

// ---------------------------------------------------------------------------
// Chronicle: summarise → coverage check → hide → archivist
// ---------------------------------------------------------------------------

export async function runChronicle(chatId: string, userId?: string, force = false): Promise<number> {
  if (busy.has(`chron:${chatId}`)) return 0;
  busy.add(`chron:${chatId}`);
  let made = 0;
  try {
    const settings = await loadSettings(userId);
    if (!settings.chronicle && !force) return 0;
    const files = await loadChat(chatId, userId);
    const L = ledgerFor(chatId, userId);
    for (let round = 0; round < 3; round++) {
      await L.refresh();
      const path = toPath(L.raw);
      const job = planChronicle(path, L.state, files.chronicle, { rawTail: settings.rawTail, rawTailTokens: settings.rawTailTokens, chapterThresholdTokens: settings.chapterThresholdTokens, fanIn: settings.fanIn });
      if (!job) break;
      let text: string;
      if (job.level === "chapter") {
        const transcript = transcriptFor(path, job, L.names.user, L.names.char, !!files.meta.lore.world);
        const prev = files.chronicle.units.filter((u) => u.level === "chapter" && !u.stale).sort((a, b) => b.endIdx - a.endIdx)[0];
        const detail = settings.summaryDetail;
        const focus = settings.summaryFocus;
        const offPage = offPageFacts(L.state, settings.secretsOffPage !== false);
        const lang = files.meta.detected.lang;
        const p = summaryPrompt("chapter", { userName: L.names.user, transcript, detail, focus, offPage, lang, prior: prev ? `${prev.title}: ${prev.text.slice(0, summaryPriorChars(detail))}` : undefined });
        text = await quiet([sys(p.system), usr(p.user)], { userId, connectionId: settings.summarizerConnection || undefined, timeoutMs: 180_000, label: "chapter summary" });
        const gaps = coverageGaps(text, L.events, L.state, job.startIdx, job.endIdx);
        if (gaps.length) {
          const [lo, hi] = summaryWords("chapter", detail);
          const p2 = summaryPrompt("chapter", { userName: L.names.user, transcript, detail, focus, offPage, lang, words: [lo, hi + 30 + gaps.length * 15], mustInclude: gaps });
          text = await quiet([sys(p2.system), usr(p2.user)], { userId, connectionId: settings.summarizerConnection || undefined, timeoutMs: 180_000, label: "chapter summary (coverage)" }).catch(() => text);
        }
      } else {
        const p = rollupPrompt(job.level, job.children.map((c) => `${c.title}\n${c.text}`), L.names.user, settings.summaryDetail, settings.summaryFocus, offPageFacts(L.state, settings.secretsOffPage !== false), files.meta.detected.lang);
        text = await quiet([sys(p.system), usr(p.user)], { userId, connectionId: settings.summarizerConnection || undefined, timeoutMs: 180_000, label: `${job.level} summary` });
      }
      if (!text || text.length < 40) break;
      // A secret that hasn't come out stays out of the summary, whatever the summariser wrote.
      text = redact(text, offPageFacts(L.state, settings.secretsOffPage !== false));
      const unit = makeUnit(job, text, path, L.state, files.chronicle);
      unit.detail = settings.summaryDetail;
      files.chronicle.units.push(unit);
      made++;
      save(chatId, "chronicle", userId);
      if (job.level === "chapter") await syncHidden(chatId, userId);
      if (job.level === "chapter") {
        // A scripted scene the story has now played is retired: it would read as still to come.
        let retired = 0;
        for (const r of L.records.filter((x) => x.kind === "playbook" && x.status === "active")) {
          if (!playbookPlayed({ name: r.name, keys: r.keys }, unit.text)) continue;
          (files.codex.overlays[r.id] ??= { id: r.id }).status = "resolved";
          retired++;
        }
        if (retired) save(chatId, "codex", userId);
        await runArchivist(chatId, unit.text, job.startIdx, job.endIdx, userId).catch((err) => noteProblem(chatId, userId, "archivist", err));
      }
      host.rpcPool?.sync?.("chapter_created", { chatId, level: unit.level, title: unit.title, text: unit.text, startIdx: unit.startIdx, endIdx: unit.endIdx });
    }
  } finally {
    busy.delete(`chron:${chatId}`);
  }
  if (made) {
    debounce(`mirror:${chatId}`, 500, () => syncMirror(chatId, userId));
    pushState(chatId, userId);
  }
  return made;
}

async function runArchivist(chatId: string, chapterText: string, startIdx: number, endIdx: number, userId?: string) {
  const files = await loadChat(chatId, userId);
  const settings = await loadSettings(userId);
  const L = ledgerFor(chatId, userId);
  // Everyone and everything the chapter names or changed. (A person's provenance holds only their first and
  // last message, so the main cast would never be revisited after the chapter they first appear in.)
  const said = (r: (typeof L.records)[number]) => [r.name, ...r.aliases].filter((n) => n && n.length >= 3).some((n) => new RegExp(`(?<![\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(chapterText));
  const changed = new Set(L.events.filter((e) => e.msgIndex >= startIdx && e.msgIndex <= endIdx && e.verdict !== "rejected").map((e) => (e.op.subject ?? "").toLowerCase()).filter(Boolean));
  const touched = L.records
    .filter((r) => ["person", "place", "object", "group", "thread"].includes(r.kind) && r.id !== "char:user")
    .filter((r) => (r.provenance.msgIndex ?? []).some((i) => i >= startIdx && i <= endIdx) || changed.has(r.name.toLowerCase()) || said(r))
    .sort((a, b) => (a.kind === "person" ? 0 : 1) - (b.kind === "person" ? 0 : 1))
    .slice(0, 24);
  if (!touched.length) return;
  const locked = touched.filter((r) => r.locked).map((r) => r.id);
  const p = archivistPrompt({ chapter: chapterText, records: touched.map((r) => `${r.id} | ${r.kind} | ${r.name} | ${r.summary} | keys: ${r.keys.join(", ")}${r.body.archivist ? ` | notes: ${r.body.archivist}` : ""}`).join("\n"), locked, lang: files.meta.detected.lang });
  const text = await quiet([sys(p.system), usr(p.user)], { userId, connectionId: settings.summarizerConnection || undefined, reasoningOff: true, timeoutMs: 120_000, label: "archivist" });
  const res = extractJson<{ set?: { id: string; summary?: string; keys?: string[]; body?: Record<string, unknown> }[]; drop?: string[] }>(text);
  if (!res) return;
  for (const s of res.set ?? []) {
    if (!s?.id || locked.includes(s.id) || !touched.some((r) => r.id === s.id)) continue;
    const ov = (files.codex.overlays[s.id] ??= { id: s.id });
    if (ov.locked) continue;
    if (s.summary) ov.summary = s.summary;
    ov.at = endIdx;
    if (Array.isArray(s.keys)) ov.keys = s.keys.map(String);
    if (s.body && typeof s.body === "object") ov.body = { ...(ov.body ?? {}), ...s.body };
    ov.provenance = { ...(ov.provenance ?? { source: "archivist" }), source: ov.provenance?.source === "lore" ? "lore" : "archivist" };
  }
  for (const id of res.drop ?? []) {
    const ov = files.codex.overlays[id];
    if (ov && !ov.locked && ov.provenance?.source === "archivist") delete files.codex.overlays[id];
  }
  save(chatId, "codex", userId);
  host.rpcPool?.sync?.("codex_updated", { chatId, count: (res.set ?? []).length });
}

// ---------------------------------------------------------------------------
// Off-screen simulator
// ---------------------------------------------------------------------------

export async function runSimulator(chatId: string, userId?: string, force = false) {
  const settings = await loadSettings(userId);
  if (!settings.simulator && !force) return;
  if (busy.has(`sim:${chatId}`)) return;
  const files = await loadChat(chatId, userId);
  const L = ledgerFor(chatId, userId);
  const st = L.state;
  if (!st?.time) return;
  const now = absMinutes(st.time);
  // The clock moved back (the player said "it's day 12"): count again from here.
  if (files.meta.lastSimAbs != null && now < files.meta.lastSimAbs) {
    files.meta.lastSimAbs = now;
    save(chatId, "meta", userId);
    if (!force) return;
  }
  const last = files.meta.lastSimAbs ?? now;
  if (files.meta.lastSimAbs == null) {
    files.meta.lastSimAbs = now;
    save(chatId, "meta", userId);
    if (!force) return;
  }
  if (!force && now - last < settings.simStep) return;
  busy.add(`sim:${chatId}`);
  try {
    const actors = Object.values(st.chars).filter((c) => !c.isUser && !c.dead && c.tier !== "spot" && c.tier !== "peri").slice(0, 10);
    const threads = Object.values(st.threads).filter((t) => t.status !== "resolved").slice(-8);
    const factions = Object.values(st.factions);
    // A Weaver world with agency pursues its agenda off-screen like any actor.
    const world = files.meta.lore.world;
    const agency = world && (world.agenda || world.holds?.length) ? world : null;
    if (!actors.length && !threads.length && !factions.length && !agency) return;
    const slice = [
      ...(agency
        ? [
            `WORLD ${agency.name}: agenda: ${agency.agenda || "—"}${agency.tension ? `; tension: ${agency.tension}` : ""}`,
            ...(agency.holds?.length ? [`HOLDS (never broken): ${agency.holds.join(" / ")}`] : []),
          ]
        : []),
      ...actors.map((c) => `PERSON ${c.name}: at ${c.place ?? "unknown"}; mood ${c.mood?.name ?? "?"}${c.pressure ? `; hidden pressure: ${c.pressure}` : ""}; knows: ${st.knowledge.filter((k) => k.holder === c.id && !k.supersededBy).slice(-4).map((k) => k.fact).join(" / ") || "—"}`),
      ...threads.map((t) => `THREAD ${t.title}: ${t.status}${t.blocker ? ` (blocked by ${t.blocker})` : ""}; latest: ${t.latest ?? "—"}; stalls: ${t.stalls}`),
      ...factions.map((f) => `FACTION ${f.name}: ${Object.values(f.clocks).map((c) => `${c.name} ${c.cur}/${c.max}`).join("; ")}`),
      `PLAYER is at ${st.place.join(" › ")}.`,
    ].join("\n");
    const p = simulatorPrompt({ slice, from: fmtTime(fromAbs(last)), to: fmtTime(st.time), userName: L.names.user, world: !!agency, lang: files.meta.detected.lang });
    const text = await quiet([sys(p.system), usr(p.user)], { userId, connectionId: settings.simConnection || undefined, reasoningOff: true, timeoutMs: 120_000, label: "simulator" });
    const res = extractJson<{ ops?: string[]; arrivals?: { text: string; route?: string; at?: string; place?: string }[] }>(text);
    const target = L.lastAssistant();
    if (res && target) {
      const ops = (res.ops ?? []).map((l) => parseLine(String(l))).filter((o): o is ParsedOp => !!o && ["bond", "know", "item", "thread", "clockf", "rumor", "owe", "cons", "journal"].includes(o.op));
      if (ops.length) {
        // Anchored to the position, not the swipe: what happened off-screen still happened if the reply is swiped.
        const key = anchorKey(target.index);
        files.side[key] = [...(files.side[key] ?? []).filter((s) => s.source !== "sim"), { source: "sim", ops, at: Date.now() }];
        save(chatId, "side", userId);
      }
      for (const a of res.arrivals ?? []) {
        const d = a.at ? /day\s*(\d+)\D+(\d{1,2})[:.](\d{2})/i.exec(a.at) : null;
        files.meta.arrivals.push({ id: uid("arr"), msgId: target.id, swipe: target.swipe, text: String(a.text).slice(0, 240), route: a.route, place: a.place, atAbs: d ? (parseInt(d[1], 10) - 1) * 1440 + parseInt(d[2], 10) * 60 + parseInt(d[3], 10) : undefined });
      }
      files.meta.arrivals = files.meta.arrivals.slice(-30);
    }
    files.meta.lastSimAbs = now;
    save(chatId, "meta", userId);
  } finally {
    busy.delete(`sim:${chatId}`);
  }
}

// ---------------------------------------------------------------------------
// Forks and rebuilds
// ---------------------------------------------------------------------------

export async function onFork(sourceChatId: string, forkedChatId: string, userId?: string, idMap?: Record<string, string>, atIndex?: number) {
  try {
    await copyChat(sourceChatId, forkedChatId, userId);
    // The fork inherits the source chat's lorebooks, the source's mirror among them: take it off,
    // or the fork would read the source's live (and diverging) story. The fork gets its own mirror.
    await detachForeignMirrors(forkedChatId, userId);
    const map = new Map<string, string>(Object.entries(idMap ?? {}));
    const dst = await host.chat.getMessages(forkedChatId);
    if (!map.size) {
      // Older hosts don't send the id map: match by position and text.
      const src = await host.chat.getMessages(sourceChatId);
      const sig = (m: any) => `${m.index_in_chat}:${hash(String(m.content ?? ""))}`;
      const dstBySig = new Map(dst.map((m: any) => [sig(m), m.id]));
      for (const m of src as any[]) {
        const d = dstBySig.get(sig(m));
        if (d) map.set(m.id, d);
      }
    }
    const last = atIndex ?? Math.max(-1, ...dst.map((m: any) => Number(m.index_in_chat ?? -1)));
    const files = await loadChat(forkedChatId, userId);
    const remap = <T>(rec: Record<string, T> | undefined): Record<string, T> => {
      const out: Record<string, T> = {};
      for (const [k, v] of Object.entries(rec ?? {})) {
        if (k.startsWith("@")) {
          if (Number(k.slice(1)) <= last) out[k] = v; // anchored events: positions carry over up to the branch point
          continue;
        }
        const cut = k.lastIndexOf(":");
        const nid = map.get(k.slice(0, cut));
        if (nid) out[`${nid}${k.slice(cut)}`] = v;
      }
      return out;
    };
    files.side = remap(files.side);
    files.meta.clerked = remap(files.meta.clerked);
    files.meta.checks = remap(files.meta.checks);
    files.meta.repaired = remap(files.meta.repaired);
    files.meta.playerRead = remap(files.meta.playerRead);
    for (const u of files.chronicle.units) u.msgIds = u.msgIds.map((id) => map.get(id)).filter(Boolean) as string[];
    files.chronicle.hidden = files.chronicle.hidden.map((id) => map.get(id)).filter(Boolean) as string[];
    files.meta.arrivals = files.meta.arrivals.filter((a) => map.has(a.msgId)).map((a) => ({ ...a, msgId: map.get(a.msgId)! }));
    const L = ledgerFor(forkedChatId, userId);
    await L.refresh();
    validateUnits(files.chronicle, toPath(L.raw));
    // Re-sign units that still match their (remapped) span.
    const fpath = toPath(L.raw);
    for (const u of files.chronicle.units) {
      const ids = new Set(u.msgIds);
      const span = fpath.filter((m) => ids.has(m.id));
      if (span.length && span.length === u.msgIds.length) {
        u.signature = spanSignature(fpath, u.startIdx, u.endIdx);
        u.stale = false;
      }
    }
    for (const k of ["side", "chronicle", "meta"] as const) save(forkedChatId, k, userId);
  } catch (err) {
    warn(`fork: ${describe(err)}`);
  }
}

/**
 * Rebuild from transcript: re-read every message and refold from scratch. What the Almanac
 * wrote alongside the chat (repairs, knowledge-clerk lines, player facts, corrections, the
 * simulator) is kept: it is keyed to its message, swipe and text, so it is branch-safe, and
 * nothing would redo it for older replies. Only entries for messages that no longer exist go.
 */
export async function rebuild(chatId: string, userId?: string) {
  const files = await loadChat(chatId, userId);
  const L = ledgerFor(chatId, userId);
  L.runtime.invalidate();
  await L.refresh({ reloadNames: true });
  const ids = new Set(L.raw.map((m) => m.id));
  if (ids.size) {
    const live = (k: string) => k.startsWith("@") || ids.has(k.slice(0, k.lastIndexOf(":")));
    for (const k of Object.keys(files.side)) if (!live(k)) delete files.side[k];
    for (const rec of [files.meta.repaired, files.meta.clerked, files.meta.checks, files.meta.playerRead]) {
      if (rec) for (const k of Object.keys(rec)) if (!live(k)) delete (rec as Record<string, unknown>)[k];
    }
    save(chatId, "side", userId);
    save(chatId, "meta", userId);
    await L.refresh();
  }
  await syncHidden(chatId, userId);
  afterChange(chatId, userId, { background: false });
}

/** Take any other chat's mirror book off this chat (a fork inherits its source's). */
async function detachForeignMirrors(chatId: string, userId?: string) {
  if (!has("chats") || !has("world_books")) return;
  const chat = await host.chats.get(chatId, userId).catch(() => null);
  if (!chat) return;
  const md = (chat.metadata ?? {}) as Record<string, unknown>;
  const ids = Array.isArray(md.chat_world_book_ids) ? (md.chat_world_book_ids as string[]) : [];
  const keep: string[] = [];
  for (const id of ids) {
    const book = await host.world_books.get(id, userId).catch(() => null);
    const owner = (book?.metadata as Record<string, unknown> | undefined)?.almanac_chat_id;
    if (typeof owner === "string" && owner !== chatId) continue;
    keep.push(id);
  }
  if (keep.length !== ids.length) await host.chats.update(chatId, { metadata: { ...md, chat_world_book_ids: keep } }, userId);
}

/**
 * A player's correction (the drawer's "Record correction"), as the player's word. It is anchored
 * to the position of the latest reply, not to its swipe, so regenerating or swiping that reply
 * keeps it: players correct state exactly when a reply got it wrong, and that is when they swipe.
 */
export async function addUserOps(chatId: string, lines: string[], userId?: string) {
  const L = ledgerFor(chatId, userId);
  await L.refresh();
  const target = L.lastAssistant();
  if (!target) return 0;
  const ops = lines.map((l) => parseLine(l)).filter(Boolean) as ParsedOp[];
  if (!ops.length) return 0;
  const files = await loadChat(chatId, userId);
  const key = anchorKey(target.index);
  files.side[key] = [...(files.side[key] ?? []), { source: "user", ops, id: uid("fix"), at: Date.now() }];
  save(chatId, "side", userId, 0);
  onMutation(chatId, userId);
  return ops.length;
}

/** Remove one recorded correction. */
export async function removeUserOps(chatId: string, key: string, id: string, userId?: string) {
  const files = await loadChat(chatId, userId);
  const list = files.side[key];
  if (!list) return false;
  const next = list.filter((s) => s.id !== id);
  if (next.length === list.length) return false;
  if (next.length) files.side[key] = next;
  else delete files.side[key];
  save(chatId, "side", userId, 0);
  onMutation(chatId, userId);
  return true;
}

/** The player's recorded corrections, newest first (for the drawer). */
export function corrections(side: Record<string, { source: string; ops: ParsedOp[]; id?: string; at?: number }[]>): { key: string; id: string; at: number; index: number; lines: string[] }[] {
  const out: { key: string; id: string; at: number; index: number; lines: string[] }[] = [];
  for (const [key, list] of Object.entries(side)) {
    if (!key.startsWith("@")) continue;
    for (const s of list) if (s.source === "user" && s.id) out.push({ key, id: s.id, at: s.at ?? 0, index: Number(key.slice(1)), lines: s.ops.map((o) => o.raw) });
  }
  return out.sort((a, b) => b.at - a.at);
}

/** Schedule weather ("a storm on Day 5 evening") as a forecast record the engine honours. */
export async function scheduleWeather(chatId: string, spec: { day: number; hour: number; hours: number; condition: string }, userId?: string) {
  const files = await loadChat(chatId, userId);
  const id = `forecast:wx_${spec.day}_${spec.hour}`;
  const fromAbs = (spec.day - 1) * 1440 + spec.hour * 60;
  files.codex.overlays[id] = {
    id, standalone: true, kind: "forecast", tense: "future", name: `${spec.condition} on Day ${spec.day} ${String(spec.hour).padStart(2, "0")}:00`,
    summary: `Upcoming weather: ${spec.condition} from Day ${spec.day} ${String(spec.hour).padStart(2, "0")}:00 for about ${spec.hours} h.`,
    body: { weatherLevel: levelOf(spec.condition).level, fromAbs, toAbs: fromAbs + spec.hours * 60 }, provenance: { source: "user" },
  };
  save(chatId, "codex", userId);
  onMutation(chatId, userId);
}
