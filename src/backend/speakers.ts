// The speaker reader: when a reply leaves spoken lines without [spk] marks, a quiet call says who
// speaks each one and the marks are written into the message, so the page draws voice cards and
// the engine knows who said what. Only marks are added: the rewrite is refused if anything else in
// the text would change, or if the message changed while the call ran.

import { sideKey } from "../core/branch";
import { applySpeakers, bareLines, parseSpeakerAnswer, speakerPrompt, withoutSpeakerMarks, type Voice } from "../core/speakers";
import { hash } from "../core/util";
import { debug, describe, has, host, warn } from "./host";
import { ledgerFor } from "./ledger";
import { quiet, sys, usr } from "./llm";
import { loadChat, loadSettings, save } from "./store";

const running = new Set<string>();

/** Returns true when the reply was rewritten with marks (false too when a read of it is already running). */
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
  if (settings.speakerRead === false || !has("chat_mutation") || !has("generation")) return false;
  const files = await loadChat(chatId, userId);
  if (files.meta.detected.dialogueMarks === false) return false;
  try {
    const L = ledgerFor(chatId, userId);
    const msg = L.path.find((m) => m.id === replyId);
    if (!msg || msg.isUser) return false;
    const key = sideKey(msg.id, msg.swipe);
    const h = hash(msg.content);
    if (files.meta.speakersRead?.[key]?.includes(h)) return false;
    const lines = bareLines(msg.content);
    const done = async (after?: string) => {
      const fresh = await loadChat(chatId, userId);
      const read = (fresh.meta.speakersRead ??= {});
      read[key] = after ? [h, hash(after)] : [h];
      for (const k of Object.keys(read).slice(0, -24)) delete read[k];
      save(chatId, "meta", userId);
    };
    if (!lines.length) return false;
    const voices: Voice[] = Object.values(L.state.chars).filter((c) => !c.dead)
      .sort((a, b) => Number(b.tier === "spot" || b.tier === "peri") - Number(a.tier === "spot" || a.tier === "peri") || b.lastSeen - a.lastSeen)
      .slice(0, 24).map((c) => ({ name: c.name, slot: c.slot, aliases: c.aliases, isUser: c.isUser }));
    if (!voices.some((v) => v.isUser)) voices.push({ name: L.names.user, slot: 0, isUser: true });
    const p = speakerPrompt({ text: msg.content, lines, voices, userName: L.names.user });
    const text = await quiet([sys(p.system), usr(p.user)], { userId, reasoningOff: true, timeoutMs: 45_000, maxTokens: 400, connectionId: settings.clerkConnection || settings.summarizerConnection || undefined, label: "speaker marks" });
    const answer = parseSpeakerAnswer(text, lines.length);
    const marked = applySpeakers(msg.content, lines, answer, voices);
    if (marked === msg.content || withoutSpeakerMarks(marked) !== withoutSpeakerMarks(msg.content)) {
      await done();
      return false;
    }
    // The message must still be what was read (no swipe, edit or regeneration since).
    const now = (await host.chat.getMessages(chatId)).find((m: any) => m.id === msg.id) as any;
    if (!now || now.content !== msg.content) return false;
    await done(marked);
    await host.chat.updateMessage(chatId, msg.id, { content: marked });
    debug(`speaker marks ${chatId}/${msg.index}: ${answer.filter(Boolean).length} of ${lines.length}`);
    return true;
  } catch (err) {
    warn(`speaker marks: ${describe(err)}`);
    return false;
  }
}
