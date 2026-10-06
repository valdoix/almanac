// Swipe autopsy (core/autopsy.ts): once the player answers a reply they swiped through, the takes they
// set aside are compared with the one they kept. The rules check each take; with "model", one quiet
// call compares them for invented events, spoilers and the like. What's found waits on the Recall
// page as a lesson to keep or dismiss.

import { addLessons, autopsyPrompt, modelLessons, rulesLessons } from "../core/autopsy";
import { checkRecord, checkReply, type CheckIssue } from "../core/audit";
import { liveTerms } from "../core/canon";
import { storySoFar } from "../core/chronicle";
import { offPageFacts, redact } from "../core/offpage";
import { extractJson } from "../core/prompts";
import { hash, plainProse } from "../core/util";
import type { PathMessage } from "../core/branch";
import { debug, describe, serial, warn } from "./host";
import { ledgerFor } from "./ledger";
import { quiet, sys, usr } from "./llm";
import { loadChat, loadSettings, noteProblem, save } from "./store";
import { seedTraitsFor } from "./traitseed";

const running = new Set<string>();

/** Replies the player has answered that had more than one take, newest first (at most two). */
function decided(path: PathMessage[], raw: { id: string; swipes?: string[] }[]): { i: number; swipes: string[] }[] {
  const out: { i: number; swipes: string[] }[] = [];
  const byId = new Map(raw.map((r) => [r.id, r]));
  for (let i = path.length - 2; i >= 0 && out.length < 2 && path.length - i < 12; i--) {
    const m = path[i];
    if (m.isUser || !path[i + 1]?.isUser) continue;
    const swipes = (byId.get(m.id)?.swipes ?? []).map(String);
    if (swipes.filter((s) => s.trim()).length > 1) out.push({ i, swipes });
  }
  return out;
}

export async function runAutopsy(chatId: string, userId?: string): Promise<number> {
  const settings = await loadSettings(userId);
  const mode = settings.swipeAutopsy ?? "model";
  if (mode === "off" || running.has(chatId)) return 0;
  running.add(chatId);
  let added = 0;
  try {
    const L = ledgerFor(chatId, userId);
    const files = await loadChat(chatId, userId);
    const meta = files.meta;
    const done = (meta.autopsied ??= {});
    for (const { i, swipes } of decided(L.path, L.raw)) {
      const m = L.path[i];
      const sig = `${m.swipe}:${hash(swipes.join("\u0000"))}`;
      if (done[m.id] === sig) continue;
      const found = await serial(`chat:${chatId}`, async () => {
        const opts = L.foldOptions(meta, settings);
        const path = L.path.slice(0, i + 1);
        const before = L.runtime.fold(path, opts, files.side, i).state;
        const player = [...path.slice(0, i)].reverse().find((x) => x.isUser)?.content ?? "";
        const offPage = offPageFacts(before, settings.secretsOffPage !== false);
        const cut = meta.config.canonCutoff;
        const corpus = cut?.notYet?.length ? [L.names.charText ?? "", L.names.personaText ?? "", ...path.slice(0, i).map((x) => x.content)].join("\n") : "";
        const cutoff = cut?.point?.trim() ? { point: cut.point.trim(), live: liveTerms(cut, (re) => re.test(corpus)) } : undefined;
        const seed = seedTraitsFor(L, meta);
        const check = (content: string, swipe: number): CheckIssue[] => {
          const alt = [...path.slice(0, i), { ...m, content, swipe }];
          const res = L.runtime.fold(alt, opts, files.side, i + 1);
          return checkReply({
            reply: content, parsed: L.runtime.parse(content), before, after: res.state, events: res.events.filter((e) => e.msgIndex === m.index),
            offPage, player, userName: L.names.user, seed, visiblePlan: meta.detected.cot === "visible", cutoff,
          });
        };
        const others = swipes.map((s, j) => ({ s, j })).filter((x) => x.j !== m.swipe && x.s.trim() && x.s !== m.content).slice(-4);
        return { kept: check(m.content, m.swipe), rejected: others.map((x) => check(x.s, x.j)), others, before, offPage };
      });
      const lessons = rulesLessons(found.kept, found.rejected, m.index);
      if (mode === "model" && found.others.length) {
        try {
          const summaries = storySoFar(files.chronicle).map((u) => redact(`${u.title}: ${u.text}`, found.offPage));
          const record = checkRecord(found.before, summaries, L.names.user, 5000);
          const p = autopsyPrompt({ kept: plainProse(m.content).slice(0, 4000), rejected: found.others.slice(-3).map((x) => plainProse(x.s).slice(0, 3000)), record, userName: L.names.user });
          const text = await quiet([sys(p.system), usr(p.user)], { userId, reasoningOff: true, timeoutMs: 90_000, connectionId: settings.replyCheckConnection || settings.summarizerConnection || undefined, label: "swipe autopsy" });
          lessons.push(...modelLessons(extractJson(text), [...(meta.lessons ?? []), ...lessons], m.index));
        } catch (err) {
          await noteProblem(chatId, userId, "swipe autopsy (model read)", err);
        }
      }
      const fresh = await loadChat(chatId, userId);
      const before = (fresh.meta.lessons ?? []).length;
      fresh.meta.lessons = addLessons(fresh.meta.lessons ?? [], lessons);
      added += Math.max(0, fresh.meta.lessons.length - before);
      (fresh.meta.autopsied ??= {})[m.id] = sig;
      const keys = Object.keys(fresh.meta.autopsied);
      for (const k of keys.slice(0, Math.max(0, keys.length - 40))) delete fresh.meta.autopsied[k];
      save(chatId, "meta", userId);
      debug(`autopsy ${chatId}/${m.index}: ${lessons.length} lesson(s) from ${found.others.length} take(s) set aside`);
    }
    return added;
  } catch (err) {
    warn(`swipe autopsy: ${describe(err)}`);
    return added;
  } finally {
    running.delete(chatId);
  }
}
