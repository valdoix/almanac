// Character journals (core/journals.ts): when the story day turns over, the people who carried the
// day just ended each write a short diary entry, one quiet call each. Kept in the chat's meta, keyed
// to the day's last message, so a branch or a rewind hides entries for a day that no longer happened.

import { cleanEntry, dayOfMessages, journalPrompt, writersFor, type JournalEntry } from "../core/journals";
import { fixedTraits } from "../core/note";
import { offPageFacts, redact } from "../core/offpage";
import { standsOn } from "../core/facts";
import { plainProse } from "../core/util";
import { fmtDate } from "../core/engines/calendar";
import { debug, describe, warn } from "./host";
import { ledgerFor } from "./ledger";
import { quiet, sys, usr } from "./llm";
import { loadChat, loadSettings, noteProblem, save } from "./store";
import { seedTraitsFor } from "./traitseed";

const running = new Set<string>();

/** Entries for days on the chat's current path, newest first. */
export function journalsOnPath(all: Record<string, JournalEntry[]> | undefined, onPath: (msgId: string) => boolean): Record<string, JournalEntry[]> {
  const out: Record<string, JournalEntry[]> = {};
  for (const [id, list] of Object.entries(all ?? {})) {
    const kept = list.filter((j) => onPath(j.msgId)).sort((a, b) => b.day - a.day);
    if (kept.length) out[id] = kept;
  }
  return out;
}

/**
 * Write the entries for the day that just ended (the last day before today with messages), for the
 * one or two people who spoke most in it. `force`: write now for `only`, whether or not one exists.
 */
export async function runJournals(chatId: string, userId?: string, opts: { force?: boolean; only?: string } = {}): Promise<number> {
  const settings = await loadSettings(userId);
  if ((!settings.journals && !opts.force) || running.has(chatId)) return 0;
  running.add(chatId);
  let wrote = 0;
  try {
    const L = ledgerFor(chatId, userId);
    const st = L.state;
    if (!st?.time) return 0;
    const files = await loadChat(chatId, userId);
    const meta = files.meta;
    const path = L.path;
    const pos = new Map(path.map((m, k) => [m.index, k]));
    const days = dayOfMessages(L.events.map((e) => ({ msgIndex: pos.get(e.msgIndex) ?? -1, at: e.at })).filter((e) => e.msgIndex >= 0), path.length);
    const today = st.time.day;
    // The day just ended: forced, the day of the latest message that isn't today (or today, when nothing came before).
    const ended = [...days].reverse().find((d) => d > 0 && d < today) ?? (opts.force ? today : 0);
    if (!ended) return 0;
    const msgs = path.map((m, k) => ({ m, d: days[k] })).filter((x) => x.d === ended).map((x) => x.m);
    if (msgs.length < (opts.force ? 1 : 3)) return 0;
    const last = msgs[msgs.length - 1];
    const sealed = L.foldOptions(meta, settings).sealed;
    // Who spoke that day, by speech lines.
    const spoke: Record<string, number> = {};
    for (const m of msgs) {
      for (const l of L.runtime.parse(m.content).speech ?? []) {
        const name = l.who ?? (m.isUser ? L.names.user : "");
        const id = name ? (name === L.names.user ? "user" : Object.values(st.chars).find((c) => [c.name, ...c.aliases].some((n) => n.toLowerCase() === name.toLowerCase().replace(/#\d+$/, "").trim()))?.id) : undefined;
        if (id) spoke[id] = (spoke[id] ?? 0) + 1;
      }
    }
    const writers = opts.only ? [opts.only].filter((id) => st.chars[id] && !(id === "user" && sealed)) : writersFor(st, spoke, { sealed, max: 2 });
    const have = meta.journals ?? {};
    const onPath = new Set(path.map((m) => m.id));
    const off = offPageFacts(st, settings.secretsOffPage !== false);
    const seed = seedTraitsFor(L, meta);
    for (const id of writers) {
      if (!opts.force && (have[id] ?? []).some((j) => j.day === ended && onPath.has(j.msgId))) continue;
      const c = st.chars[id];
      const name = id === "user" ? L.names.user : c.name;
      const transcript = redact(msgs.map((m) => `${m.isUser ? L.names.user : m.name || L.names.char}: ${plainProse(m.content)}`).join("\n\n"), off).slice(-9000);
      const thoughts = msgs.flatMap((m) => (L.runtime.parse(m.content).thoughts ?? []).filter((t) => t.who.replace(/#\d+$/, "").trim().toLowerCase() === name.toLowerCase() || c.aliases.some((a) => a.toLowerCase() === t.who.toLowerCase())).map((t) => redact(t.text, off))).slice(-6);
      const card = (L.names.cards ?? []).find((x) => x.name.toLowerCase() === name.toLowerCase())?.text ?? (id === "user" ? L.names.personaText : "");
      const lore = L.records.find((r) => r.kind === "person" && [r.name, ...(r.aliases ?? [])].some((n) => n.toLowerCase() === name.toLowerCase()))?.summary ?? "";
      const about = [fixedTraits(c, seed[id]), card?.slice(0, 700), lore.slice(0, 400)].filter(Boolean).join(" ");
      // Words of secrets they don't hold stay out, as on the page.
      const never = off.filter((o) => !standsOn(st.facts?.[o.key]?.stances[id])).flatMap((o) => o.words).slice(0, 12);
      let date = "";
      try {
        date = fmtDate(L.dayCtx(meta, settings).cal, ended);
      } catch {
        /* no calendar: the day number will do */
      }
      try {
        const p = journalPrompt({ name, day: ended, date, transcript, thoughts, about, userName: L.names.user, never });
        const text = cleanEntry(await quiet([sys(p.system), usr(p.user)], { userId, reasoningOff: true, timeoutMs: 90_000, connectionId: settings.summarizerConnection || undefined, label: `journal (${name})` }));
        if (text.length < 40) continue;
        const fresh = await loadChat(chatId, userId);
        const list = ((fresh.meta.journals ??= {})[id] ??= []).filter((j) => !(j.day === ended && j.msgId === last.id));
        list.push({ day: ended, text, msgId: last.id, msgIndex: last.index, at: Date.now() });
        fresh.meta.journals[id] = list.sort((a, b) => a.day - b.day).slice(-40);
        save(chatId, "meta", userId);
        wrote++;
      } catch (err) {
        await noteProblem(chatId, userId, `journal (${name})`, err);
      }
    }
    if (wrote) debug(`journals ${chatId}: ${wrote} for day ${ended}`);
    return wrote;
  } catch (err) {
    warn(`journals: ${describe(err)}`);
    return wrote;
  } finally {
    running.delete(chatId);
  }
}
