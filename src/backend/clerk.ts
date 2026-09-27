// The knowledge clerk (design/07 §5): after a reply, a quiet call rewrites the
// reply's knowledge lines cleanly. The lines are stored as side events keyed to
// the message and swipe, with a hash of the text, so swipes, branches and edits
// stay correct: an edited message drops back to its own lines.

import { sideKey, type PathMessage } from "../core/branch";
import { clerkPrompt, clerkWanted, parseClerk } from "../core/clerk";
import { KNOW_OPS } from "../core/types";
import { hash } from "../core/util";
import { debug, describe, serial, warn, within } from "./host";
import { ledgerFor } from "./ledger";
import { quiet, sys, usr } from "./llm";
import { loadChat, loadSettings, save, type ChatMeta } from "./store";

const running = new Map<string, Promise<unknown>>();

export function clerkRunning(chatId: string): boolean {
  return running.has(chatId);
}

/** The planner waits briefly for a pass still reading the latest reply, so the note is built from clean lines. */
export async function waitForClerk(chatId: string, ms = 8000): Promise<void> {
  const p = running.get(chatId);
  if (p) await within(p.catch(() => undefined), ms, undefined, "knowledge clerk");
}

function track<T>(chatId: string, p: Promise<T>): Promise<T> {
  const prev = running.get(chatId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(() => p);
  running.set(chatId, next);
  next.finally(() => {
    if (running.get(chatId) === next) running.delete(chatId);
  }).catch(() => undefined);
  return next;
}

/**
 * Read one reply with the clerk. Returns true when its lines were stored.
 * `force` reads it again even if it was read before (or doesn't look like it needs it).
 */
export async function clerkOne(chatId: string, msgId: string, userId?: string, force = false): Promise<boolean> {
  const settings = await loadSettings(userId);
  if (settings.knowledgeClerk === "off" && !force) return false;
  const files = await loadChat(chatId, userId);
  const L = ledgerFor(chatId, userId);
  if (!L.state) await L.refresh();
  const msg = L.path.find((m) => m.id === msgId);
  if (!msg || msg.isUser) return false;
  const key = sideKey(msg.id, msg.swipe);
  const h = hash(msg.content);
  const clerked = (files.meta.clerked ??= {});
  if (!force && clerked[key]?.hash === h) return false;
  if (!force && !clerkWanted(settings.knowledgeClerk, L.state, msg.index, msg.content)) {
    // Its lines were already clean: checked, nothing to read (a whole-chat tidy skips it).
    clerked[key] = { hash: h, result: "clean" };
    save(chatId, "meta", userId);
    return false;
  }
  // The story as it stood before this reply (its facts and keys), and who is here after it.
  const fo = L.foldOptions(files.meta, settings);
  const i = L.path.findIndex((m) => m.id === msgId);
  const before = L.runtime.fold(L.path.slice(0, i), fo, files.side).state;
  const after = L.runtime.fold(L.path.slice(0, i + 1), fo, files.side).state;
  const prevReply = L.path.slice(0, i).map((m, j) => ({ m, j })).filter((x) => !x.m.isUser).at(-1)?.j ?? -1;
  const player = L.path.slice(prevReply + 1, i).filter((m) => m.isUser).map((m) => m.content).join("\n\n");
  const p = clerkPrompt({ state: before, here: after, userName: L.names.user, sealed: fo.sealed, player, reply: msg.content, query: `${player} ${msg.content}`.slice(-3000) });
  let text = "";
  try {
    text = await quiet([sys(p.system), usr(p.user)], {
      userId, reasoningOff: true, timeoutMs: 60_000, maxTokens: 900,
      connectionId: settings.clerkConnection || settings.summarizerConnection || undefined, label: "knowledge clerk",
    });
  } catch (err) {
    clerked[key] = { hash: h, result: "failed" };
    save(chatId, "meta", userId);
    throw err;
  }
  const ops = parseClerk(text);
  if (!ops) {
    clerked[key] = { hash: h, result: "failed" };
    save(chatId, "meta", userId);
    debug(`clerk ${key}: no <knowledge> block`);
    return false;
  }
  await serial(`chat:${chatId}`, async () => {
    files.side[key] = [...(files.side[key] ?? []).filter((s) => !s.replacesOps?.length), { source: "clerk", ops, replacesOps: [...KNOW_OPS], hash: h }];
    clerked[key] = { hash: h, result: ops.length ? "ok" : "none" };
    save(chatId, "side", userId);
    save(chatId, "meta", userId);
    await L.refresh();
  });
  debug(`clerk ${key}: ${ops.length} lines`);
  return true;
}

/** After a reply: read it in the background (tracked, so the planner can wait for it). */
export function scheduleClerk(chatId: string, msgId: string, userId: string | undefined, then: () => void): void {
  track(chatId, clerkOne(chatId, msgId, userId).then((changed) => changed && then())).catch((err) => warn(`knowledge clerk: ${describe(err)}`));
}

/** Replies with a ledger the clerk hasn't read in their current text (or failed on). */
export function unreadReplies(path: PathMessage[], meta: ChatMeta): PathMessage[] {
  return path.filter((m) => {
    if (m.isUser || !/<ledger\b/i.test(m.content)) return false;
    const c = meta.clerked?.[sideKey(m.id, m.swipe)];
    return !c || c.hash !== hash(m.content) || c.result === "failed";
  });
}

const stopping = new Set<string>();

/** Stop a whole-chat tidy after the reply it's reading. */
export function stopClerk(chatId: string): void {
  stopping.add(chatId);
}

/**
 * Tidy a whole chat: every reply the clerk hasn't read, oldest first, so each one
 * sees the keys the earlier ones settled. A second run only picks up what's left
 * (or what was edited since), so stopping and resuming loses nothing.
 */
export function clerkWholeChat(chatId: string, userId: string | undefined, progress: (done: number, total: number) => void): Promise<{ done: number; total: number; stopped: boolean; error?: string }> {
  stopping.delete(chatId);
  return track(chatId, (async () => {
    const L = ledgerFor(chatId, userId);
    await L.refresh();
    const ids = unreadReplies(L.path, (await loadChat(chatId, userId)).meta).map((m) => m.id);
    let done = 0;
    let failures = 0;
    let error: string | undefined;
    progress(0, ids.length);
    for (const id of ids) {
      if (stopping.has(chatId)) break;
      try {
        await clerkOne(chatId, id, userId, true);
        failures = 0;
      } catch (err) {
        warn(`knowledge clerk: ${describe(err)}`);
        // The call itself failing twice in a row (no connection, no permission): stop rather than grind on.
        if (++failures >= 2) {
          error = describe(err);
          break;
        }
      }
      progress(++done, ids.length);
    }
    const stopped = stopping.delete(chatId) && done < ids.length;
    return { done, total: ids.length, stopped, error };
  })());
}
