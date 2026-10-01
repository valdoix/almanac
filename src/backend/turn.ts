// Turn planning: before each generation, decide what the model is told.
// Runs in the context handler (before assembly) so the WI interceptor can apply
// mirror/lore decisions; the prompt interceptor then injects note + recall.

import { detectDivergence } from "../core/codex";
import { pickChronicle } from "../core/chronicle";
import { buildLedgerNote } from "../core/note";
import { chekhovNudges } from "../core/pressures";
import { recall, tierGuess } from "../core/recall";
import { genreNudge } from "../core/telemetry";
import { absMinutes, estTokens, fmtSpan, plainProse } from "../core/util";
import { NOT_A_PERSON } from "../core/state";
import { offPageFacts, redact } from "../core/offpage";
import { chronicleBits, unitHeader } from "../core/chronicle";
import { seedTraitsFor } from "./traitseed";
import { SPEAKER_LABEL, extractLedgerBlock, hasSpeakerLabels, hasUnmarkedSpeech } from "../core/dsl";
import { debug, describe, has, host, warn, within } from "./host";
import { ledgerFor, type ChatLedger } from "./ledger";
import { waitForClerk } from "./clerk";
import { elsewhereNote } from "./elsewhere";
import { loadChat, save, type ChatMeta } from "./store";
import type { Settings } from "../core/types";

export interface TurnPlan {
  chatId: string;
  genType: string;
  createdAt: number;
  enabled: boolean;
  note: string;
  recallText: string;
  /** Chronicle unit ids whose summaries go in this prompt. */
  chronicle: string[];
  mirrorPicks: Record<string, string>; // codexId → rendered text for this prompt
  mirrorChronicle: Set<string>; // mirror entry ids that must never be host-injected
  lorePicks: Set<string>; // lore entry ids to force
  loreFold: Record<string, string>; // lore entry id → mirror codex id whose card carries its text
  loreManagedBooks: Set<string>;
  divergence: Record<string, string>; // lore entry id → note
  tier: "routine" | "charged" | "pivotal";
  feed: ChatMeta["feed"][number] | null;
  firedKeys: string[];
  injectedIds: string[];
  returning: boolean;
  formatExample?: string;
  /** Set when the last reply labelled speech as `Name#N|tone:` instead of using [spk] marks. */
  speechFix?: string;
  /** Scripted scenes (playbook lore entries) kept from the host's keyword activation. */
  playbookEntries: Set<string>;
  /** Off-page secrets' words and wording, for rewording summaries in the prompt. */
  offPage: ReturnType<typeof offPageFacts>;
  /** Made for a preview (tokenize, prompt breakdown): never reused for a real generation. */
  dryRun?: boolean;
  /** A real prompt has used it; the next generation plans afresh. */
  used?: boolean;
}

const plans = new Map<string, TurnPlan>();

/** The latest plan, whatever it was made for (the drawer shows it). */
export function lastPlan(chatId: string): TurnPlan | undefined {
  return plans.get(chatId);
}

/**
 * The plan made for the generation now being assembled: made moments ago by the context
 * handler, not yet used by a prompt, and (for a real generation) not a preview's. A context
 * handler that timed out leaves the previous turn's plan behind; that one must never go out.
 */
export function currentPlan(chatId: string, opts: { genType?: string; dryRun?: boolean } = {}): TurnPlan | undefined {
  const p = plans.get(chatId);
  if (!p || p.used || Date.now() - p.createdAt > 90_000) return undefined;
  if (opts.genType && p.genType !== opts.genType) return undefined;
  if (p.dryRun && !opts.dryRun) return undefined;
  return p;
}

export function isEnabled(meta: ChatMeta, settings: Settings): boolean {
  if (settings.enabled === "off") return false;
  if (meta.config.enabledOverride === false) return false;
  if (settings.enabled === "on" || meta.config.enabledOverride === true) return true;
  return meta.enabled === true;
}

/** Names removed from the cast, as first written (one per group of spellings). */
function notPeople(meta: ChatMeta): string[] {
  return Object.entries(meta.config.merges ?? {}).filter(([, to]) => to === NOT_A_PERSON).map(([n]) => n).slice(0, 8);
}

function leadGenre(meta: ChatMeta): string | undefined {
  return meta.detected.lead || meta.detected.genres?.[0] || meta.config.genres?.[0];
}

export async function planTurn(chatId: string, genType: string, userId?: string, opts: { dryRun?: boolean } = {}): Promise<TurnPlan | null> {
  const L = ledgerFor(chatId, userId);
  const files = await L.files();
  const settings = await L.settings();
  const meta = files.meta;
  if (!isEnabled(meta, settings)) return null;
  // A knowledge clerk still reading the last reply: give it a moment, so the note is built from clean lines.
  if (!opts.dryRun && genType !== "impersonate") await waitForClerk(chatId, 8000);
  // Semantic candidates from the vectorised mirror book (host vectors). Asked before the refresh:
  // from the refresh to the finished plan nothing awaits, so another refresh can't swap the
  // ledger's path or records halfway through (a swipe would see the reply it is replacing).
  let semantic: { recordId: string; score: number }[] = [];
  if (settings.mirror !== "off" && settings.mirrorVectorize && meta.mirror.bookId && has("world_books")) {
    const act = await within(host.world_books.getActivated(chatId, userId), 1500, [], "getActivated");
    const byEntry = new Map(Object.entries(meta.mirror.entries).map(([cid, v]) => [v.entryId, cid]));
    semantic = act.filter((a) => a.source === "vector" && byEntry.has(a.id)).map((a) => ({ recordId: byEntry.get(a.id)!, score: a.score ?? 0.5 }));
  }
  const exclude = genType === "regenerate" || genType === "swipe";
  await L.refresh({ excludeTrailingAssistant: exclude });
  const st = L.state;
  const al = L.almanac(meta, settings);

  const player = plainProse(L.lastUser());
  const lastReplyMsg = L.lastAssistant();
  const lastReply = lastReplyMsg ? plainProse(lastReplyMsg.content) : "";
  const recent = L.path.slice(-8, -1).map((m) => plainProse(m.content));
  const tier = tierGuess(player, st);

  // Chronicle: the summaries of the turns before the raw tail (see pickChronicle).
  const scene = [st.place.join(" › "), ...Object.values(st.chars).filter((c) => (c.tier === "spot" || c.tier === "peri") && !c.isUser).map((c) => c.name), ...Object.values(st.threads).filter((t) => t.status !== "resolved").map((t) => t.title)].join(" · ");
  // Names to match: people, groups, objects, and places with a proper name (not "kitchen").
  const entities = L.records
    .filter((r) => r.kind === "person" || r.kind === "object" || r.kind === "group" || (r.kind === "place" && /^\p{Lu}/u.test(r.name)))
    .map((r) => [r.name, ...(r.aliases ?? [])]);
  const cq = { player, lastReply, scene, entities, background: L.path.map((m) => m.content) };
  const chronMode = settings.chronicleInject === "relevant" ? "relevant" : "all";
  let chronicle = settings.chronicle ? pickChronicle(files.chronicle, chronMode, cq).map((u) => u.id) : [];
  const rc = recall({
    state: st, records: L.records, index: L.index, playerMsg: player, lastReply, recent, semantic,
    heat: settings.keyHeat ? meta.heat : undefined, injectedHistory: meta.injected, usedLastTurn: new Set(meta.lastInjected),
    leadGenre: leadGenre(meta), tier, budget: Math.round(settings.recallBudget * 0.46), allowNarratorOnly: true, userName: L.names.user,
    offPage: offPageFacts(st, settings.secretsOffPage !== false),
  });

  const divergence: Record<string, string> = {};
  for (const d of detectDivergence(st, L.records)) {
    const r = L.records.find((x) => x.id === d.id);
    if (r?.provenance.loreEntryId) divergence[r.provenance.loreEntryId] = d.note;
  }

  // Note lanes
  const assistantIdx = L.path.filter((m) => !m.isUser).map((m) => m.index);
  const genres = meta.detected.genres ?? meta.config.genres ?? [];
  const now = st.time ? absMinutes(st.time) : null;
  const onPath = new Set(L.path.map((m) => m.id));
  const elsewhere = elsewhereNote({ state: st, records: L.records, userName: L.names.user, meta, settings, tier, onPath: (id) => onPath.has(id), dryRun: !!opts.dryRun });
  let returning: string | null = null;
  // Time away is measured from the last message before the player's new one(s): the message
  // they just sent is seconds old, so measuring from it never finds an absence.
  let at = L.raw.length - 1;
  while (at >= 0 && isUserRaw(L.raw[at])) at--;
  const lastMsg = L.raw[at] as any;
  const lastTs = Number(lastMsg?.send_date ?? lastMsg?.created_at ?? 0);
  const lastMs = lastTs > 1e12 ? lastTs : lastTs * 1000;
  const idle = lastMs ? Date.now() - lastMs : 0;
  if (genType === "normal" && idle >= 12 * 3600_000 && meta.greetedReturn !== L.path.length) {
    const lastUnit = [...files.chronicle.units].filter((u) => !u.stale).sort((a, b) => b.endIdx - a.endIdx)[0];
    const open = Object.values(st.threads).filter((t) => t.status !== "resolved").slice(-3).map((t) => t.title);
    returning = `The player returns after ${fmtSpan(idle / 60000)} away. Open with a brief in-world re-entry (two lines at most: where we are and what is pressing), then continue.${lastUnit ? ` Last chapter: ${lastUnit.title}.` : ""}${open.length ? ` Open threads: ${open.join("; ")}.` : ""}`;
  }
  const lastDelta = exclude ? null : st.lastDelta;
  const noteRes = buildLedgerNote({
    state: st, almanac: al, records: L.records, userName: L.names.user, sealed: L.foldOptions(meta, settings).sealed,
    query: `${player} ${lastReply}`, player, craft: settings.telemetry ? meta.telemetry : null, genreNudge: genreNudge(st, leadGenre(meta), assistantIdx),
    plants: settings.chekhov ? chekhovNudges(st, genres) : [], elsewhere,
    returning, lastDelta, pressures: settings.pressures ? meta.pressures : {}, nsfw: !!meta.detected.nsfw && meta.detected.nsfw !== "off",
    budgets: scaleBudgets(settings.recallBudget, tier),
    notPeople: notPeople(meta),
    seedTraits: seedTraitsFor(L, meta),
    truths: meta.config.truths ?? [],
    offPageAuto: settings.secretsOffPage !== false,
    bits: chronicleBits(files.chronicle),
    checks: exclude ? [] : (meta.checks?.[L.lastAssistant() ? `${L.lastAssistant()!.id}:${L.lastAssistant()!.swipe}` : ""]?.issues ?? []).filter((i) => i.level !== "info").map((i) => i.text),
  });
  let formatExample: string | undefined;
  if (settings.formatAid && lastReplyMsg) {
    const b = extractLedgerBlock(lastReplyMsg.content);
    if (b) formatExample = `Format reminder — last turn's ledger, as an example of the shape:\n<ledger>\n${b.body}\n</ledger>`;
  }
  let speechFix: string | undefined;
  if (lastReplyMsg && hasSpeakerLabels(lastReplyMsg.content)) {
    SPEAKER_LABEL.lastIndex = 0;
    const m = SPEAKER_LABEL.exec(lastReplyMsg.content);
    SPEAKER_LABEL.lastIndex = 0;
    const who = m ? `${m[3].trim()}#${m[4]}${m[5] ? `|${m[5]}` : ""}` : "Name#N|tone";
    speechFix = `Speech format: your last reply put a label in front of speech (${who}: "…"). The page can't draw that. Write every spoken line as [spk=${who}]"Words."[/spk], with no label before it.`;
  } else if (lastReplyMsg && lastReplyMsg.index > 0 && meta.detected.dialogueMarks !== false && hasUnmarkedSpeech(lastReplyMsg.content)) {
    const v = Object.values(st.chars).filter((c) => !c.isUser && !c.dead && c.slot != null).sort((a, b) => b.lastSeen - a.lastSeen)[0];
    const who = v ? `${v.name}#${v.slot}` : "Name#N";
    speechFix = `Speech format: your last reply wrote its dialogue as bare quotes, so the page drew no voice cards. Wrap every spoken line again: [spk=${who}]"Words."[/spk] — each speaker with their own voice number.`;
  }

  // The ceiling on what the Almanac adds to this prompt. Over it: the summaries narrow to the
  // relevant ones, then the oldest of those go (never the latest chapter, which leads into the
  // turns the model sees), then the lowest-ranked recall. The note itself always goes in.
  const unitTokens = (ids: string[]) => ids.reduce((n, id) => {
    const u = files.chronicle.units.find((x) => x.id === id);
    return n + (u ? estTokens(`${unitHeader(u)}\n${u.text}`) : 0);
  }, 0);
  const itemTokens = (items: typeof rc.items) => items.reduce((n, it) => n + estTokens(it.text ?? it.record.summary ?? ""), 0);
  const noteTokens = estTokens([noteRes.text, speechFix, formatExample].filter(Boolean).join("\n"));
  const total = (ids: string[], items: typeof rc.items) => noteTokens + unitTokens(ids) + itemTokens(items);
  let kept = rc.items;
  const before = total(chronicle, kept);
  const trimmed: string[] = [];
  const limit = settings.injectCeiling > 0 ? settings.injectCeiling : 0;
  if (limit && before > limit) {
    const name = (id: string) => {
      const u = files.chronicle.units.find((x) => x.id === id);
      return u ? `${u.level[0].toUpperCase()}${u.level.slice(1)} ${u.no}` : id;
    };
    if (chronMode === "all" && settings.chronicle) {
      const relevant = pickChronicle(files.chronicle, "relevant", cq).map((u) => u.id);
      if (unitTokens(relevant) < unitTokens(chronicle)) {
        trimmed.push(`summaries narrowed to the relevant ones (${chronicle.length} → ${relevant.length})`);
        chronicle = relevant;
      }
    }
    const latest = [...chronicle].sort((a, b) => (files.chronicle.units.find((u) => u.id === b)?.endIdx ?? 0) - (files.chronicle.units.find((u) => u.id === a)?.endIdx ?? 0))[0];
    const oldestFirst = chronicle.filter((id) => id !== latest).sort((a, b) => (files.chronicle.units.find((u) => u.id === a)?.startIdx ?? 0) - (files.chronicle.units.find((u) => u.id === b)?.startIdx ?? 0));
    for (const id of oldestFirst) {
      if (total(chronicle, kept) <= limit) break;
      chronicle = chronicle.filter((x) => x !== id);
      trimmed.push(`${name(id)} left out`);
    }
    let cut = 0;
    while (kept.length && total(chronicle, kept) > limit) {
      kept = kept.slice(0, -1);
      cut++;
    }
    if (cut) trimmed.push(`${cut} recall record${cut === 1 ? "" : "s"} left out`);
    const after = total(chronicle, kept);
    if (after > limit) trimmed.push(`still ${after - limit} tokens over: the note and the latest chapter always go in`);
  }
  const keptIds = new Set(kept.map((i) => i.record.id));

  // Hybrid delivery: records that have a mirror entry are delivered by the host (forced + mutated);
  // everything else rides the <recall> block.
  const mirrorPicks: Record<string, string> = {};
  const recallItems: string[] = [];
  const mirrorActive = settings.mirror !== "off" && !!meta.mirror.bookId;
  for (const it of kept) {
    if (mirrorActive && meta.mirror.entries[it.record.id]) mirrorPicks[it.record.id] = it.text ?? it.record.summary;
    else if (it.text) recallItems.push(it.text);
  }
  const recallText = recallItems.length ? `<recall>\n${recallItems.join("\n")}\n</recall>` : "";

  // Lore bridge decisions. A story record that carries a lore baseline (Buffy, joined to her lore
  // entry) goes out as one card: its mirror entry carries the lore text, and the lore entry stays out.
  const lorePicks = new Set<string>();
  const loreFold: Record<string, string> = {};
  const loreManagedBooks = new Set<string>();
  for (const [bookId, b] of Object.entries(meta.lore.books)) if (b.mode === "managed") loreManagedBooks.add(bookId);
  for (const it of kept) {
    const le = it.record.provenance?.loreEntryId;
    const lb = it.record.provenance?.loreBookId;
    if (!le || !lb || !meta.lore.books[lb] || meta.lore.books[lb].mode === "native" || meta.lore.books[lb].pinned?.includes(le)) continue;
    // A playbook goes in the recall block, framed as not history; its own lorebook entry stays out.
    if (it.record.kind === "playbook") continue;
    if (mirrorPicks[it.record.id] && it.record.provenance.source !== "lore") loreFold[le] = it.record.id;
    else lorePicks.add(le);
  }

  // Nothing that names an off-page secret reaches the model: mirror cards are reworded like the recall block.
  const off = offPageFacts(st, settings.secretsOffPage !== false);
  if (off.length) for (const k of Object.keys(mirrorPicks)) mirrorPicks[k] = redact(mirrorPicks[k], off);
  const plan: TurnPlan = {
    chatId, genType, createdAt: Date.now(), enabled: true, note: noteRes.text, recallText, chronicle, mirrorPicks,
    mirrorChronicle: new Set(Object.entries(meta.mirror.entries).filter(([id]) => id.startsWith("chron:")).map(([, v]) => v.entryId)),
    lorePicks, loreFold, loreManagedBooks, divergence, tier,
    feed: {
      at: Date.now(), tier, tokens: total(chronicle, kept),
      // Where each injected record went: the <recall> block, or a forced entry in the mirror lorebook.
      items: rc.feed.map((f) => (!f.injected ? f : !keptIds.has(f.id) ? { ...f, injected: false, reasons: [...f.reasons, "left out to stay under the ceiling"] } : { ...f, via: mirrorPicks[f.id] ? ("mirror" as const) : ("recall" as const) })),
      ...(limit ? { ceiling: { limit, before, after: total(chronicle, kept), trimmed } } : {}),
      chronicle: chronicle.map((id) => files.chronicle.units.find((u) => u.id === id)).filter((u) => !!u).map((u) => ({ id: u.id, name: `${u.level[0].toUpperCase()}${u.level.slice(1)} ${u.no}: ${u.title}` })),
    },
    firedKeys: rc.firedKeys, injectedIds: kept.map((i) => i.record.id), returning: !!returning, formatExample, speechFix,
    playbookEntries: new Set(Object.values(meta.lore.books).filter((b) => b.mode !== "native").flatMap((b) => b.playbooks ?? [])),
    offPage: off,
    dryRun: !!opts.dryRun,
  };
  if (!opts.dryRun) {
    // Feedback bookkeeping for the next turn.
    for (const id of plan.injectedIds) (meta.injected[id] ??= []).push(st.msgCount);
    for (const k of Object.keys(meta.injected)) meta.injected[k] = meta.injected[k].slice(-6);
    meta.lastInjected = plan.injectedIds;
    meta.chronicleShown = chronicle;
    if (plan.feed) meta.feed = [plan.feed, ...meta.feed].slice(0, 4);
    if (returning) meta.greetedReturn = L.path.length;
    // What the note offered from off the page, and whom it showed returning.
    save(chatId, "meta", userId);
  }
  plans.set(chatId, plan);
  debug(`plan ${chatId}: note ${noteRes.tokens}t, recall ${rc.tokens}t, chronicle ${chronicle.length} (${chronMode}), mirror ${Object.keys(mirrorPicks).length}, lore ${lorePicks.size}`);
  return plan;
}

function isUserRaw(m: { is_user?: boolean; role?: string } | undefined): boolean {
  return !!m && (m.is_user ?? m.role === "user");
}

function scaleBudgets(total: number, tier: string) {
  const k = (total / 2400) * (tier === "pivotal" ? 1.25 : 1);
  return { now: Math.round(120 * k), present: Math.round(330 * k), constraints: Math.round(150 * k), knowledge: Math.round(250 * k), craft: Math.round(110 * k) };
}

export async function safePlan(chatId: string, genType: string, userId?: string, opts: { dryRun?: boolean } = {}): Promise<TurnPlan | null> {
  try {
    const plan = await planTurn(chatId, genType, userId, opts);
    if (plan) await notePlanError(chatId, userId, null);
    return plan;
  } catch (err) {
    warn(`plan failed: ${describe(err)}`);
    await notePlanError(chatId, userId, err, "planning the turn", genType);
    return null;
  }
}

/**
 * Record (or, with `err` null, clear) why the last turn reached the model without
 * the note. The prompt still goes out untouched, so without this the only trace is
 * a line in the server console.
 */
export async function notePlanError(chatId: string, userId: string | undefined, err: unknown, where = "", genType = "normal") {
  try {
    const files = await loadChat(chatId, userId);
    const meta = files.meta;
    if (!err) {
      if (!meta.planError) return;
      meta.planError = null;
    } else {
      const stack = err instanceof Error && err.stack ? err.stack.split("\n").slice(1, 4).map((l) => l.trim()).join("\n") : "";
      meta.planError = { at: Date.now(), where, genType, message: describe(err), stack };
    }
    save(chatId, "meta", userId);
    changed?.(chatId, userId);
  } catch (e) {
    warn(`note plan error: ${describe(e)}`);
  }
}

/** Set by the view module (which imports this one) so a new or cleared error reaches the drawer. */
let changed: ((chatId: string, userId?: string) => void) | undefined;
export function onPlanErrorChange(fn: (chatId: string, userId?: string) => void) {
  changed = fn;
}

export type { ChatLedger };
