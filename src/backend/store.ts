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
import { debounce, describe, host, warn } from "./host";

export interface Detected {
  sealed?: boolean;
  personaThoughts?: boolean;
  genres?: string[];
  lead?: string;
  nsfw?: string;
  dialogue?: string;
  romance?: string;
  cot?: string;
  trackers?: string[];
  trackerView?: string;
  theme?: string;
  ledger?: string;
  dialogueStyle?: string;
  at?: number;
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

export interface Arrival {
  id: string;
  msgId: string;
  swipe: number;
  text: string;
  route?: string;
  atAbs?: number;
  place?: string;
  delivered?: boolean;
}

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
}

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
  }[];
  mirror: { bookId?: string; entries: Record<string, { entryId: string; hash: string; wrote?: string }> };
  lore: { books: Record<string, LoreBookState>; review: { entryId: string; bookId: string; title: string; kind: string; confidence: number }[]; lastScan?: number; world?: WeaverWorld };
  arrivals: Arrival[];
  lastSimAbs?: number;
  repaired: Record<string, "repair" | "extractor" | "failed">;
  /** Replies the knowledge clerk has read (msgId:swipe → the text's hash and the outcome). */
  clerked?: Record<string, { hash: string; result: "ok" | "none" | "failed" | "clean" }>;
  /** The last time a turn went to the model without the note (cleared by the next good plan). */
  planError?: PlanError | null;
  /** Chronicle unit ids the last prompt carried. */
  chronicleShown?: string[];
  telemetry?: CraftReport | null;
  greetedReturn?: number;
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
  if (hit) return hit;
  const pending = loading.get(chatId);
  if (pending) return pending;
  const p = (async () => {
    try {
      const [meta, side, codex, chronicle] = await Promise.all([
        readJson<ChatMeta>(path(chatId, "meta"), emptyMeta(), userId),
        readJson<SideEventStore>(path(chatId, "side"), {}, userId),
        readJson<CodexStore>(path(chatId, "codex"), emptyCodexStore(), userId),
        readJson<ChronicleStore>(path(chatId, "chronicle"), emptyChronicle(), userId),
      ]);
      const files: ChatFiles = { meta: { ...emptyMeta(), ...meta, config: { ...DEFAULT_CHAT_CONFIG, ...(meta.config ?? {}), colors: { ...(meta.config?.colors ?? {}) } } }, side, codex, chronicle };
      cache.set(chatId, files);
      return files;
    } finally {
      // A failed read caches nothing, so the next call (with a user) reads the real files.
      loading.delete(chatId);
    }
  })();
  loading.set(chatId, p);
  return p;
}

export function save(chatId: string, kind: FileKind, userId?: string, delay = 400) {
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
  cache.set(toChat, clone);
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
  settingsCache.set(userId ?? "", out);
  return out;
}

/** Merge a change into the settings file as it is on disk, never into defaults read in its place. */
export async function saveSettings(patch: Partial<Settings>, userId?: string): Promise<Settings> {
  const onDisk = await readJson<Partial<Settings>>("settings.json", {}, userId); // throws rather than guess
  const next = { ...DEFAULT_SETTINGS, ...onDisk, ...patch };
  await host.userStorage.setJson("settings.json", next, { indent: 2, userId });
  settingsCache.set(userId ?? "", next);
  return next;
}
