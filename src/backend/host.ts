// Thin, typed access to the Spindle host plus small shared helpers.

import type { SpindleAPI } from "lumiverse-spindle-types";

declare const spindle: SpindleAPI;
export const host: SpindleAPI = spindle;

export const EXT_ID = "almanac_ledger";

let debugOn = false;
export function setDebug(v: boolean) {
  debugOn = v;
}

export function log(...a: unknown[]) {
  try {
    host.log?.info?.(`[ALMANAC] ${a.map(String).join(" ")}`);
  } catch {
    console.log("[ALMANAC]", ...a);
  }
}
export function warn(...a: unknown[]) {
  try {
    host.log?.warn?.(`[ALMANAC] ${a.map(String).join(" ")}`);
  } catch {
    console.warn("[ALMANAC]", ...a);
  }
}
export function debug(...a: unknown[]) {
  if (debugOn) log("(debug)", ...a);
}

export function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function has(permission: string): boolean {
  try {
    return host.permissions.has(permission);
  } catch {
    return false;
  }
}

/** Run a promise with a timeout; resolves to `fallback` on timeout or error. */
export async function within<T>(p: Promise<T>, ms: number, fallback: T, label = "task"): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((resolve) => {
        t = setTimeout(() => {
          debug(`${label} timed out after ${ms} ms`);
          resolve(fallback);
        }, ms);
      }),
    ]);
  } catch (err) {
    warn(`${label} failed: ${describe(err)}`);
    return fallback;
  } finally {
    if (t) clearTimeout(t);
  }
}

/** Remember which user owns which chat (user-scoped extensions can omit it). */
const chatUsers = new Map<string, string>();
export function rememberUser(chatId: string, userId?: string | null) {
  if (chatId && userId) chatUsers.set(chatId, userId);
}
export function userFor(chatId: string): string | undefined {
  return chatUsers.get(chatId);
}

/** Debounce by key. */
const timers = new Map<string, { t: ReturnType<typeof setTimeout>; fn: () => void | Promise<void> }>();
export function debounce(key: string, ms: number, fn: () => void | Promise<void>) {
  const prev = timers.get(key);
  if (prev) clearTimeout(prev.t);
  const run = () => {
    timers.delete(key);
    return Promise.resolve(fn()).catch((err) => warn(`debounced ${key}: ${describe(err)}`));
  };
  timers.set(key, { t: setTimeout(run, ms), fn });
}

/** Whether work is waiting under a key prefix (a save not yet written). */
export function pending(prefix: string): boolean {
  for (const k of timers.keys()) if (k.startsWith(prefix)) return true;
  return false;
}

/** Run every waiting debounce now (under a key prefix, or all), and wait for them. */
export async function flushPending(prefix = ""): Promise<void> {
  const due = [...timers.entries()].filter(([k]) => k.startsWith(prefix));
  for (const [k, { t }] of due) {
    clearTimeout(t);
    timers.delete(k);
  }
  await Promise.all(due.map(([k, { fn }]) => Promise.resolve(fn()).catch((err) => warn(`flush ${k}: ${describe(err)}`))));
}

/** Serialise async work per key (no two refreshes of one chat at once). */
const chains = new Map<string, Promise<unknown>>();
export function serial<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  chains.set(key, next.catch(() => undefined));
  return next;
}
