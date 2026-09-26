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
const timers = new Map<string, ReturnType<typeof setTimeout>>();
export function debounce(key: string, ms: number, fn: () => void | Promise<void>) {
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      Promise.resolve(fn()).catch((err) => warn(`debounced ${key}: ${describe(err)}`));
    }, ms),
  );
}

/** Serialise async work per key (no two refreshes of one chat at once). */
const chains = new Map<string, Promise<unknown>>();
export function serial<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  chains.set(key, next.catch(() => undefined));
  return next;
}
