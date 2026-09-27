// Turn planning: before each generation, decide what the model is told.
// Runs in the context handler (before assembly) so the WI interceptor can apply
// mirror/lore decisions; the prompt interceptor then injects note + recall.

import { detectDivergence } from "../core/codex";
import { zoomCandidates } from "../core/chronicle";
import { buildLedgerNote } from "../core/note";
import { chekhovNudges } from "../core/pressures";
import { recall, tierGuess } from "../core/recall";
import { genreNudge } from "../core/telemetry";
import { absMinutes, fmtSpan, plainProse } from "../core/util";
import { NOT_A_PERSON } from "../core/state";
import { SPEAKER_LABEL, extractLedgerBlock, hasSpeakerLabels } from "../core/dsl";
import { debug, describe, has, host, warn, within } from "./host";
import { ledgerFor, type ChatLedger } from "./ledger";
import { waitForClerk } from "./clerk";
import type { ChatMeta } from "./store";
import type { Settings } from "../core/types";

export interface TurnPlan {
  chatId: string;
  genType: string;
  createdAt: number;
  enabled: boolean;
  note: string;
  recallText: string;
  mirrorPicks: Record<string, string>; // codexId → rendered text for this prompt
  mirrorChronicle: Set<string>; // mirror entry ids that must never be host-injected
  lorePicks: Set<string>; // lore entry ids to force
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
}

const plans = new Map<string, TurnPlan>();

export function lastPlan(chatId: string): TurnPlan | undefined {
  const p = plans.get(chatId);
  if (p && Date.now() - p.createdAt < 5 * 60_000) return p;
  return undefined;
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
  const exclude = genType === "regenerate" || genType === "swipe";
  await L.refresh({ excludeTrailingAssistant: exclude });
  const st = L.state;
  const al = L.almanac(meta, settings);

  const player = plainProse(L.lastUser());
  const lastReplyMsg = L.lastAssistant();
  const lastReply = lastReplyMsg ? plainProse(lastReplyMsg.content) : "";
  const recent = L.path.slice(-8, -1).map((m) => plainProse(m.content));
  const tier = tierGuess(player, st);

  // Semantic candidates from the vectorised mirror book (host vectors).
  let semantic: { recordId: string; score: number }[] = [];
  if (settings.mirror !== "off" && settings.mirrorVectorize && meta.mirror.bookId && has("world_books")) {
    const act = await within(host.world_books.getActivated(chatId, userId), 1500, [], "getActivated");
    const byEntry = new Map(Object.entries(meta.mirror.entries).map(([cid, v]) => [v.entryId, cid]));
    semantic = act.filter((a) => a.source === "vector" && byEntry.has(a.id)).map((a) => ({ recordId: byEntry.get(a.id)!, score: a.score ?? 0.5 }));
  }

  const zoom = zoomCandidates(files.chronicle, `${player} ${lastReply}`);
  const rc = recall({
    state: st, records: L.records, index: L.index, playerMsg: player, lastReply, recent, semantic, zoom,
    heat: settings.keyHeat ? meta.heat : undefined, injectedHistory: meta.injected, usedLastTurn: new Set(meta.lastInjected),
    leadGenre: leadGenre(meta), tier, budget: Math.round(settings.recallBudget * 0.46), allowNarratorOnly: true, userName: L.names.user,
  });

  // Hybrid delivery: records that have a mirror entry are delivered by the host (forced + mutated);
  // everything else rides the <recall> block.
  const mirrorPicks: Record<string, string> = {};
  const recallItems: string[] = [];
  const mirrorActive = settings.mirror !== "off" && !!meta.mirror.bookId;
  for (const it of rc.items) {
    if (mirrorActive && meta.mirror.entries[it.record.id] && it.lane !== "zoom") mirrorPicks[it.record.id] = it.text ?? it.record.summary;
    else if (it.text) recallItems.push(it.text);
  }
  const recallText = recallItems.length ? `<recall>\n${recallItems.join("\n")}\n</recall>` : "";

  // Lore bridge decisions
  const lorePicks = new Set<string>();
  const loreManagedBooks = new Set<string>();
  for (const [bookId, b] of Object.entries(meta.lore.books)) if (b.mode === "managed") loreManagedBooks.add(bookId);
  for (const it of rc.items) {
    const le = it.record.provenance.loreEntryId;
    const lb = it.record.provenance.loreBookId;
    if (le && lb && meta.lore.books[lb] && meta.lore.books[lb].mode !== "native") lorePicks.add(le);
  }
  const divergence: Record<string, string> = {};
  for (const d of detectDivergence(st, L.records)) {
    const r = L.records.find((x) => x.id === d.id);
    if (r?.provenance.loreEntryId) divergence[r.provenance.loreEntryId] = d.note;
  }

  // Note lanes
  const assistantIdx = L.path.filter((m) => !m.isUser).map((m) => m.index);
  const genres = meta.detected.genres ?? meta.config.genres ?? [];
  const now = st.time ? absMinutes(st.time) : null;
  const arrivals = meta.arrivals.filter((a) => !a.delivered && L.path.some((m) => m.id === a.msgId) && (a.atAbs == null || (now != null && a.atAbs <= now)) && (!a.place || st.place.some((p) => p.toLowerCase().includes(a.place!.toLowerCase()))));
  let returning: string | null = null;
  const lastMsg = L.raw[L.raw.length - (exclude ? 2 : 1)] as any;
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
    plants: settings.chekhov ? chekhovNudges(st, genres) : [], arrivals: arrivals.map((a) => `${a.text}${a.route ? ` (via ${a.route})` : ""}`),
    returning, lastDelta, pressures: settings.pressures ? meta.pressures : {}, nsfw: !!meta.detected.nsfw && meta.detected.nsfw !== "off",
    budgets: scaleBudgets(settings.recallBudget, tier),
    notPeople: notPeople(meta),
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
  }

  const plan: TurnPlan = {
    chatId, genType, createdAt: Date.now(), enabled: true, note: noteRes.text, recallText, mirrorPicks,
    mirrorChronicle: new Set(Object.entries(meta.mirror.entries).filter(([id]) => id.startsWith("chron:")).map(([, v]) => v.entryId)),
    lorePicks, loreManagedBooks, divergence, tier,
    feed: { at: Date.now(), tier, items: rc.feed, tokens: rc.tokens + noteRes.tokens },
    firedKeys: rc.firedKeys, injectedIds: rc.items.map((i) => i.record.id), returning: !!returning, formatExample, speechFix,
  };
  if (!opts.dryRun) {
    // Feedback bookkeeping for the next turn.
    for (const id of plan.injectedIds) (meta.injected[id] ??= []).push(st.msgCount);
    for (const k of Object.keys(meta.injected)) meta.injected[k] = meta.injected[k].slice(-6);
    meta.lastInjected = plan.injectedIds;
    if (plan.feed) meta.feed = [plan.feed, ...meta.feed].slice(0, 12);
    if (returning) meta.greetedReturn = L.path.length;
    for (const a of arrivals) a.delivered = true;
  }
  plans.set(chatId, plan);
  debug(`plan ${chatId}: note ${noteRes.tokens}t, recall ${rc.tokens}t, mirror ${Object.keys(mirrorPicks).length}, lore ${lorePicks.size}`);
  return plan;
}

function scaleBudgets(total: number, tier: string) {
  const k = (total / 2400) * (tier === "pivotal" ? 1.25 : 1);
  return { now: Math.round(120 * k), present: Math.round(330 * k), constraints: Math.round(150 * k), knowledge: Math.round(250 * k), craft: Math.round(110 * k) };
}

export async function safePlan(chatId: string, genType: string, userId?: string, opts: { dryRun?: boolean } = {}): Promise<TurnPlan | null> {
  try {
    return await planTurn(chatId, genType, userId, opts);
  } catch (err) {
    warn(`plan failed: ${describe(err)}`);
    return null;
  }
}

export type { ChatLedger };
