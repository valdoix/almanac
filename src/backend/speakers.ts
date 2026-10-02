// The speaker reader: when a reply leaves spoken lines without [spk] marks, a quiet call says who
// speaks each one and the marks are written into the message, so the page draws voice cards and
// the engine knows who said what. Only marks are added: the rewrite is refused if anything else in
// the text would change, or if the message changed while the call ran. Under Sealed and Continuity
// the persona's lines (marked by the model or by the reader) are then taken out: only the player
// gives the persona words.

import { sideKey } from "../core/branch";
import { applySpeakers, bareLines, dropUserSpeech, isPersona, parseSpeakerAnswer, speakerPrompt, withoutSpeakerMarks, type Voice } from "../core/speakers";
import { hash } from "../core/util";
import { debug, describe, has, host, warn } from "./host";
import { ledgerFor } from "./ledger";
import { quiet, sys, usr } from "./llm";
import { loadChat, loadSettings, save } from "./store";

const running = new Set<string>();

/** The story's people, the ones on the page first, and the persona. */
function voicesOf(L: ReturnType<typeof ledgerFor>): Voice[] {
  const voices: Voice[] = Object.values(L.state?.chars ?? {}).filter((c) => !c.dead)
    .sort((a, b) => Number(b.tier === "spot" || b.tier === "peri") - Number(a.tier === "spot" || a.tier === "peri") || b.lastSeen - a.lastSeen)
    .slice(0, 24).map((c) => ({ name: c.name, slot: c.slot, aliases: c.aliases, isUser: c.isUser }));
  if (!voices.some((v) => v.isUser)) voices.push({ name: L.names.user, slot: 0, isUser: true });
  return voices;
}

/** Whether a speaker mark's name is the persona's in this chat. */
export function personaTest(chatId: string, userId?: string): (name: string) => boolean {
  const L = ledgerFor(chatId, userId);
  const voices = voicesOf(L);
  return (name) => isPersona(name, voices, L.names.user);
}

/** Returns true when the reply was rewritten (false too when a read of it is already running). */
export async function readSpeakers(chatId: string, replyId: string, userId?: string): Promise<boolean> {
  const job = `${chatId}:${replyId}`;
  if (running.has(job)) return false;
  running.add(job);
  try {
    return await readOnce(chatId, replyId, userId);
  } finally {
    running.delete(job);
  }
}

async function readOnce(chatId: string, replyId: string, userId?: string): Promise<boolean> {
  const settings = await loadSettings(userId);
  if (!has("chat_mutation")) return false;
  const files = await loadChat(chatId, userId);
  const L = ledgerFor(chatId, userId);
  const sealed = L.foldOptions(files.meta, settings).sealed;
  const reading = settings.speakerRead !== false && has("generation") && files.meta.detected.dialogueMarks !== false;
  if (!reading && !sealed) return false;
  try {
    const msg = L.path.find((m) => m.id === replyId);
    if (!msg || msg.isUser) return false;
    const key = sideKey(msg.id, msg.swipe);
    const h = hash(msg.content);
    if (files.meta.speakersRead?.[key]?.includes(h)) return false;
    const lines = reading ? bareLines(msg.content) : [];
    const done = async (after?: string) => {
      const fresh = await loadChat(chatId, userId);
      const read = (fresh.meta.speakersRead ??= {});
      read[key] = after ? [h, hash(after)] : [h];
      for (const k of Object.keys(read).slice(0, -24)) delete read[k];
      save(chatId, "meta", userId);
    };
    const voices = voicesOf(L);
    let marked = msg.content;
    let found = 0;
    if (lines.length) {
      const p = speakerPrompt({ text: msg.content, lines, voices, userName: L.names.user, sealed });
      const text = await quiet([sys(p.system), usr(p.user)], { userId, reasoningOff: true, timeoutMs: 45_000, maxTokens: 400, connectionId: settings.clerkConnection || settings.summarizerConnection || undefined, label: "speaker marks" });
      const answer = parseSpeakerAnswer(text, lines.length);
      const m = applySpeakers(msg.content, lines, answer, voices);
      if (withoutSpeakerMarks(m) === withoutSpeakerMarks(msg.content)) marked = m;
      found = answer.filter(Boolean).length;
    }
    const out = sealed ? dropUserSpeech(marked, (name) => isPersona(name, voices, L.names.user)) : marked;
    if (out === msg.content) {
      if (lines.length) await done();
      return false;
    }
    // The message must still be what was read (no swipe, edit or regeneration since).
    const now = (await host.chat.getMessages(chatId)).find((m: any) => m.id === msg.id) as any;
    if (!now || now.content !== msg.content) return false;
    await done(out);
    await host.chat.updateMessage(chatId, msg.id, { content: out });
    debug(`speaker marks ${chatId}/${msg.index}: ${found} of ${lines.length}${out !== marked ? "; the persona's lines taken out" : ""}`);
    return true;
  } catch (err) {
    warn(`speaker marks: ${describe(err)}`);
    return false;
  }
}
