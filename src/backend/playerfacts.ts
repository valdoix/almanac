// The player's own facts, read by a quiet model call after the reply (setting "model"). The rules in
// core/player.ts catch the plain cases (a date, "X has violet eyes", ((truth: …))); this reads the
// rest: where something is kept, a rule of this story that differs from the source, a keepsake.
// What it files is the player's word (source "user"), keyed to the player's message, so swipes,
// edits and deletes stay correct.

import { sideKey } from "../core/branch";
import { parseLine } from "../core/dsl";
import { keepPlayerOp } from "../core/player";
import { SAFETY_DATA } from "../core/prompts";
import type { ParsedOp } from "../core/types";
import { hash } from "../core/util";
import { debug, describe, warn } from "./host";
import { ledgerFor } from "./ledger";
import { quiet, sys, usr } from "./llm";
import { loadChat, loadSettings, save } from "./store";

const ALLOWED = new Set(["trait", "item", "canon", "motif", "look"]);

export function playerFactsPrompt(opts: { message: string; names: string[]; userName: string }): { system: string; user: string } {
  return {
    system: `You read a roleplay player's message for facts they state as true about the story. ${SAFETY_DATA}
The player is ${opts.userName}. Record only what the player states outright, often in an aside or a direction to the writer: someone's looks or age, where a thing is kept or who has it, a rule of this story that differs from the source material, a running joke. Never record what happens in the scene now, what anyone says or feels, or anything the player only suggests.
Name each person plainly, by a name the message or the list gives; never a description or relation in brackets ("Buffy (his sister)"), never two people at once. When the message says only "she" or "he" and doesn't make plain who, leave it out: never guess. Dialogue is what a character says, not a fact: a joke, a pet name or a figure of speech ("that's my daughter" about a cat) records nothing, and neither does one person's opinion of another ("the most beautiful person he's seen"). Use only names the message uses. No notes, guesses or comments after a line.
An item line is for what the player says someone keeps, owns or carries for good; never what someone picks up, uses or puts down in the scene (the story's own lines track that), and never something offered, asked for or that may happen. Name the thing as the message does, owner included ("his mom's therapist" said by Gabriel is Gabriel's mom's).
Write one ledger line per fact, or the single word none:
trait Name: violet eyes; silver hair; 24
item Thing: → Holder (where) — the player said
canon: a rule or fact of this story
motif: a running joke or keepsake | whose
People in the story: ${opts.names.join(", ") || "(none yet)"}.`,
    user: `<source>\n${opts.message}\n</source>`,
  };
}

export async function readPlayerFacts(chatId: string, replyId: string, userId?: string): Promise<number> {
  const settings = await loadSettings(userId);
  if (settings.playerFacts !== "model") return 0;
  try {
    const L = ledgerFor(chatId, userId);
    const i = L.path.findIndex((m) => m.id === replyId);
    const msg = [...L.path.slice(0, i)].reverse().find((m) => m.isUser);
    if (!msg || msg.content.trim().length < 40) return 0;
    const files = await loadChat(chatId, userId);
    const key = sideKey(msg.id, msg.swipe);
    const h = hash(msg.content);
    if (files.meta.playerRead?.[key] === h) return 0;
    const names = Object.values(L.state.chars).filter((c) => !c.isUser).map((c) => c.name).slice(0, 30);
    const p = playerFactsPrompt({ message: msg.content.slice(0, 6000), names, userName: L.names.user });
    const text = await quiet([sys(p.system), usr(p.user)], { userId, reasoningOff: true, timeoutMs: 60_000, connectionId: settings.clerkConnection || settings.summarizerConnection || undefined, label: "player facts" });
    const ops = text.split("\n").map((l) => parseLine(l.replace(/^[-*•]\s*/, "").trim())).filter((o): o is ParsedOp => !!o && ALLOWED.has(o.op))
      .map((o) => keepPlayerOp(o, msg.content, [L.names.user, ...(L.state.chars.user?.aliases ?? [])])).filter((o): o is ParsedOp => !!o).slice(0, 12);
    const fresh = await loadChat(chatId, userId);
    fresh.side[key] = [...(fresh.side[key] ?? []).filter((s) => !s.player), ...(ops.length ? [{ source: "user" as const, ops, player: true, hash: h }] : [])];
    (fresh.meta.playerRead ??= {})[key] = h;
    save(chatId, "side", userId);
    save(chatId, "meta", userId);
    debug(`player facts ${chatId}/${msg.index}: ${ops.length}`);
    return ops.length;
  } catch (err) {
    warn(`player facts: ${describe(err)}`);
    return 0;
  }
}
