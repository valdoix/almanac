// Extension storage: the source of truth in the hybrid design (06). Per chat:
//   chats/<chatId>/meta.json       config, detection, feedback, mirror + lore bookkeeping
//   chats/<chatId>/side.json       extension-authored events keyed by msgId:swipe
//   chats/<chatId>/codex.json      Codex overlays (lore baselines, archivist prose, user edits)
//   chats/<chatId>/chronicle.json  chapters, arcs, volumes
//   chats/<chatId>/events.jsonl    append-only audit of ingested ledgers (rebuildable)
// Writes are cached in memory and flushed with a short debounce.

import type { SideEventStore } from "../core/branch";
import type { ChronicleStore } from "../core/chronicle";
import { emptyChronicle } from "../core/chronicle";
import type { CodexStore } from "../core/codex";
import { emptyCodexStore } from "../core/codex";
import type { KeyHeat } from "../core/keys";
import type { WeaverRole, WeaverWorld } from "../core/lore";
import type { CraftReport } from "../core/telemetry";
import type { ChatConfig, Settings } from "../core/types";
import { DEFAULT_CHAT_CONFIG, DEFAULT_SETTINGS } from "../core/types";
import { debounce, describe, host, pending, serial, warn } from "./host";

export interface Detected {
  sealed?: boolean;
  personaThoughts?: boolean;
  /** Inner voice setting: off · prose · register. */
  innerVoice?: string;
  genres?: string[];
  lead?: string;
  nsfw?: string;
  dialogue?: string;
  romance?: string;
  cot?: string;
  trackers?: string[];
  trackerView?: string;
  /** Scene header setting: off · change · every. */
  header?: string;
  theme?: string;
  ledger?: string;
  dialogueStyle?: string;
  /** The preset's Dialogue blocks switch: false when speech is written without [spk] marks. */
  dialogueMarks?: boolean;
  /** World texture (backdrop · living · insistent) and initiative (player_led · collaborative · world_led). */
  texture?: string;
  initiative?: string;
  /** The preset version that sent the handshake. */
  presetVersion?: string;
  at?: number;
}

/** Something that went wrong in the background (a summary, a mirror write, hiding turns). */
export interface Problem {
  at: number;
  where: string;
  message: string;
}

export interface PlanError {
  at: number;
  /** "planning the turn" or "building the prompt". */
  where: string;
  genType: string;
  message: string;
  /** The first lines of the stack, for a bug report. */
  stack: string;
}

export type { Arrival } from "../core/elsewhere/crossings";
import type { Arrival } from "../core/elsewhere/crossings";
import type { ElsewhereMeta } from "./elsewhere";

export interface LoreBookState {
  name: string;
  scope: string;
  mode: "native" | "assisted" | "managed";
  permission: "read" | "overlay" | "write";
  entryHashes: Record<string, string>;
  count: number;
  /** Set when Lumiverse's Dream Weaver made the book. */
  weaver?: WeaverRole;
  /** Entries read as each category, for the Lore tab. */
  kinds?: Record<string, number>;
  /** Always-on entries (Weaver rules and re-anchor) the Ledger never folds, forces or switches off. */
  pinned?: string[];
  /** Scripted scenes (playbooks): kept from the host's keyword activation, framed as "not history" when sent. */
  playbooks?: string[];
}

import type { CheckIssue } from "../core/audit";
export type { CheckIssue };

export interface ChatMeta {
  version: 1;
  enabled?: boolean;
  config: ChatConfig;
  detected: Detected;
  pressures: Record<string, string>;
  heat: Record<string, KeyHeat>;
  injected: Record<string, number[]>;
  lastInjected: string[];
  feed: {
    at: number;
    tier: string;
    /** `via`: an injected record went in the <recall> block or as a forced entry in the mirror lorebook. */
    items: { id: string; name: string; score: number; reasons: string[]; injected: boolean; via?: "recall" | "mirror" }[];
    tokens: number;
    /** Chronicle summaries the prompt carried. */
    chronicle?: { id: string; name: string }[];
    /** The injection ceiling, what the turn would have cost without it, and what was cut to fit. */
    ceiling?: { limit: number; before: number; after: number; trimmed: string[] };
  }[];
  mirror: { bookId?: string; entries: Record<string, { entryId: string; hash: string; wrote?: string }> };
  lore: { books: Record<string, LoreBookState>; review: { entryId: string; bookId: string; title: string; kind: string; confidence: number }[]; lastScan?: number; world?: WeaverWorld };
  arrivals: Arrival[];
  lastSimAbs?: number;
  /** Elsewhere: tick records, profiles, and what the note last showed. */
  elsewhere?: ElsewhereMeta;
  repaired: Record<string, "repair" | "extractor" | "failed">;
  /** Replies the knowledge clerk has read (msgId:swipe → the text's hash and the outcome). */
  clerked?: Record<string, { hash: string; result: "ok" | "none" | "failed" | "clean" }>;
  /** The last time a turn went to the model without the note (cleared by the next good plan). */
  planError?: PlanError | null;
  /** Chronicle unit ids the last prompt carried. */
  chronicleShown?: string[];
  /** What the check of each reply found (msgId:swipe → issues); the latest few replies only. */
  checks?: Record<string, { at: number; hash: string; issues: CheckIssue[]; model?: boolean }>;
  /** Player messages the player-facts reader has read (msgId:swipe → the text's hash). */
  playerRead?: Record<string, string>;
  /** Replies whose bare lines the speaker reader has marked (msgId:swipe → the hash of the text before and after). */
  speakersRead?: Record<string, string[]>;
  telemetry?: CraftReport | null;
  greetedReturn?: number;
  /** Prompts in a row without the ALMANAC charter or handshake (auto mode disarms after a few). */
  charterMiss?: number;
  /** Recent background failures, newest first (shown in the drawer). */
  problems?: Problem[];
}

export function emptyMeta(): ChatMeta {
  return {
    version: 1,
    config: { ...DEFAULT_CHAT_CONFIG, colors: {} },
    detected: {},
    pressures: {},
    heat: {},
    injected: {},
    lastInjected: [],
    feed: [],
    mirror: { entries: {} },
    lore: { books: {}, review: [] },
    arrivals: [],
    repaired: {},
  };
}

type FileKind = "meta" | "side" | "codex" | "chronicle";

interface ChatFiles {
  meta: ChatMeta;
  side: SideEventStore;
  codex: CodexStore;
  chronicle: ChronicleStore;
}

const cache = new Map<string, ChatFiles>();
const loading = new Map<string, Promise<ChatFiles>>();
/** Chats kept in memory; older ones are dropped once their writes are out. */
const CACHE_MAX = 32;

function touch(chatId: string, files: ChatFiles) {
  cache.delete(chatId);
  cache.set(chatId, files);
  if (cache.size <= CACHE_MAX) return;
  for (const id of cache.keys()) {
    if (cache.size <= CACHE_MAX) break;
    if (id === chatId || pending(`save:${id}:`)) continue;
    cache.delete(id);
  }
}

function path(chatId: string, kind: FileKind | "events") {
  const safe = chatId.replace(/[^\w-]/g, "_");
  return `chats/${safe}/${kind}.${kind === "events" ? "jsonl" : "json"}`;
}

/**
 * Read a stored JSON file. A missing file gives the fallback; a failed read throws. The difference
 * matters: an operator-scoped install can't reach user storage without a user id (as at boot), and
 * treating that as "no file" used to cache defaults and then save them over the real files, so
 * settings and chat setup reset after every update or restart.
 */
async function readJson<T>(p: string, fallback: T, userId?: string): Promise<T> {
  let exists: boolean;
  try {
    exists = await host.userStorage.exists(p, userId);
  } catch (err) {
    throw new Error(`storage unavailable for ${p}${userId ? "" : " (no user yet)"}: ${describe(err)}`);
  }
  if (!exists) return fallback;
  try {
    return await host.userStorage.getJson<T>(p, { fallback, userId });
  } catch (err) {
    throw new Error(`read ${p}: ${describe(err)}`);
  }
}

export async function loadChat(chatId: string, userId?: string): Promise<ChatFiles> {
  const hit = cache.get(chatId);
  if (hit) {
    touch(chatId, hit);
    return hit;
  }
  const inFlight = loading.get(chatId);
  if (inFlight) return inFlight;
  const p = (async () => {
    try {
      const [meta, side, codex, chronicle] = await Promise.all([
        readJson<ChatMeta>(path(chatId, "meta"), emptyMeta(), userId),
        readJson<SideEventStore>(path(chatId, "side"), {}, userId),
        readJson<CodexStore>(path(chatId, "codex"), emptyCodexStore(), userId),
        readJson<ChronicleStore>(path(chatId, "chronicle"), emptyChronicle(), userId),
      ]);
      const files: ChatFiles = { meta: { ...emptyMeta(), ...meta, config: { ...DEFAULT_CHAT_CONFIG, ...(meta.config ?? {}), colors: { ...(meta.config?.colors ?? {}) } } }, side, codex, chronicle };
      touch(chatId, files);
      return files;
    } finally {
      // A failed read caches nothing, so the next call (with a user) reads the real files.
      loading.delete(chatId);
    }
  })();
  loading.set(chatId, p);
  return p;
}

/**
 * Write a chat file soon. The delay is short on purpose: Lumiverse stops the worker without
 * warning on an update or restart, so anything still waiting is lost.
 */
export function save(chatId: string, kind: FileKind, userId?: string, delay = 150) {
  debounce(`save:${chatId}:${kind}`, delay, async () => {
    const files = cache.get(chatId);
    if (!files) return;
    await host.userStorage.setJson(path(chatId, kind), files[kind], { userId });
  });
}

export async function appendEvents(chatId: string, lines: unknown[], userId?: string) {
  if (!lines.length) return;
  const p = path(chatId, "events");
  try {
    const prev = (await host.userStorage.exists(p, userId)) ? await host.userStorage.read(p, userId) : "";
    let text = prev + lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
    // Compact: keep the log bounded (it is an audit trail; the chat itself is the source of truth).
    if (text.length > 2_000_000) text = text.slice(text.length - 1_500_000).replace(/^[^\n]*\n/, "");
    await host.userStorage.write(p, text, userId);
  } catch (err) {
    warn(`append events: ${describe(err)}`);
  }
}

export async function resetChat(chatId: string, userId?: string, keep: FileKind[] = ["meta"]) {
  const files = await loadChat(chatId, userId);
  if (!keep.includes("side")) files.side = {};
  if (!keep.includes("chronicle")) files.chronicle = emptyChronicle();
  if (!keep.includes("codex")) files.codex = emptyCodexStore();
  for (const k of ["side", "chronicle", "codex"] as FileKind[]) save(chatId, k, userId, 0);
}

export async function copyChat(fromChat: string, toChat: string, userId?: string) {
  const src = await loadChat(fromChat, userId);
  const clone = JSON.parse(JSON.stringify(src)) as ChatFiles;
  clone.meta.mirror = { entries: {} }; // the fork gets its own mirror book
  touch(toChat, clone);
  for (const k of ["meta", "side", "codex", "chronicle"] as FileKind[]) save(toChat, k, userId, 0);
}

export function forget(chatId: string) {
  cache.delete(chatId);
}

// ---------------------------------------------------------------------------
// Global settings
// ---------------------------------------------------------------------------

// Per user: an operator-scoped install serves every user from one process.
const settingsCache = new Map<string, Settings>();

/** The user's settings. Before a user is known (at boot) this gives the defaults, uncached. */
export async function loadSettings(userId?: string): Promise<Settings> {
  const hit = settingsCache.get(userId ?? "");
  if (hit) return hit;
  let s: Partial<Settings>;
  try {
    s = await readJson<Partial<Settings>>("settings.json", {}, userId);
  } catch (err) {
    if (userId) warn(`settings: ${describe(err)}`);
    return { ...DEFAULT_SETTINGS };
  }
  const out = { ...DEFAULT_SETTINGS, ...s };
  // Before Elsewhere there was one switch: the off-screen simulator on or off.
  if (s.elsewhere === undefined) out.elsewhere = s.simulator ? "living" : "off";
  settingsCache.set(userId ?? "", out);
  return out;
}

/** Merge a change into the settings file as it is on disk, never into defaults read in its place. */
export function saveSettings(patch: Partial<Settings>, userId?: string): Promise<Settings> {
  // One at a time per user: two quick changes would otherwise read the same file and the second write lose the first.
  return serial(`settings:${userId ?? ""}`, async () => {
    const onDisk = await readJson<Partial<Settings>>("settings.json", {}, userId); // throws rather than guess
    const next = { ...DEFAULT_SETTINGS, ...(onDisk.elsewhere === undefined ? { elsewhere: onDisk.simulator ? "living" as const : "off" as const } : {}), ...onDisk, ...cleanSettings(patch) };
    await host.userStorage.setJson("settings.json", next, { indent: 2, userId });
    settingsCache.set(userId ?? "", next);
    return next;
  });
}

/** Keep only known settings whose value has the default's type (a frontend bug can't store junk). */
export function cleanSettings(patch: Record<string, unknown>): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch ?? {})) {
    const def = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[k];
    if (def === undefined) continue;
    if (Array.isArray(def) ? Array.isArray(v) : typeof v === typeof def) out[k] = typeof v === "number" && !Number.isFinite(v) ? def : v;
  }
  return out as Partial<Settings>;
}

// ---------------------------------------------------------------------------
// Background problems
// ---------------------------------------------------------------------------

let problemListener: ((chatId: string, userId?: string) => void) | undefined;
export function onProblem(fn: (chatId: string, userId?: string) => void) {
  problemListener = fn;
}

/** Record a background failure for the drawer to show (and the server log). */
export async function noteProblem(chatId: string, userId: string | undefined, where: string, err: unknown) {
  warn(`${where}: ${describe(err)}`);
  try {
    const files = await loadChat(chatId, userId);
    files.meta.problems = [{ at: Date.now(), where, message: describe(err).slice(0, 400) }, ...(files.meta.problems ?? [])].slice(0, 8);
    save(chatId, "meta", userId);
    problemListener?.(chatId, userId);
  } catch {
    /* storage itself is down: the log line above is all we can do */
  }
}
