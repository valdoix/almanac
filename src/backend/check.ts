// The check of each reply, in the background after it's written (see core/audit.ts). What it
// finds shows on the reply's drawer, in the Now widget and on the Recall page, and the next
// turn's note tells the model, so a slip isn't carried forward.

import { AGREES, checkPrompt, checkRecord, checkReply, passageIndex, saidBefore, supported, supportOf, verifyPrompt, type CheckIssue, type Passage } from "../core/audit";
import { sideKey } from "../core/branch";
import { storySoFar } from "../core/chronicle";
import { offPageFacts, redact } from "../core/offpage";
import { extractJson } from "../core/prompts";
import { hash, plainProse } from "../core/util";
import { liveTerms } from "../core/canon";
import { debug, describe, serial, warn } from "./host";
import { ledgerFor } from "./ledger";
import { quiet, sys, usr } from "./llm";
import { loadChat, loadSettings, noteProblem, save } from "./store";
import { seedTraitsFor } from "./traitseed";

const running = new Set<string>();

export async function runCheck(chatId: string, msgId: string, userId?: string): Promise<CheckIssue[] | null> {
  const settings = await loadSettings(userId);
  if (settings.replyCheck === "off") return null;
  const key = `${chatId}:${msgId}`;
  if (running.has(key)) return null;
  running.add(key);
  try {
    const files = await loadChat(chatId, userId);
    const meta = files.meta;
    const L = ledgerFor(chatId, userId);
    const found = await serial(`chat:${chatId}`, async () => {
      await L.refresh();
      const i = L.path.findIndex((m) => m.id === msgId);
      const m = L.path[i];
      if (!m || m.isUser) return null;
      const opts = L.foldOptions(meta, settings);
      const before = L.runtime.fold(L.path, opts, files.side, i).state;
      const res = L.runtime.fold(L.path, opts, files.side, i + 1);
      const player = [...L.path.slice(0, i)].reverse().find((x) => x.isUser)?.content ?? "";
      const offPage = offPageFacts(before, settings.secretsOffPage !== false);
      // Where the story stands in its source: terms from later that the chat (before this reply) or the card hasn't reached.
      const cut = meta.config.canonCutoff;
      const corpus = cut?.notYet?.length ? [L.names.charText ?? "", L.names.personaText ?? "", ...L.path.slice(0, i).map((x) => x.content)].join("\n") : "";
      const cutoff = cut?.point?.trim() ? { point: cut.point.trim(), live: liveTerms(cut, (re) => re.test(corpus)) } : undefined;
      const issues = checkReply({
        cutoff,
        reply: m.content, parsed: L.runtime.parse(m.content), before, after: res.state, events: res.events.filter((e) => e.msgIndex === m.index),
        offPage, player, userName: L.names.user, seed: seedTraitsFor(L, meta), visiblePlan: meta.detected.cot === "visible",
      });
      // Everything said before this reply, for checking the model's claims against (it only sees a summary).
      const sources: Passage[] = [
        ...(L.names.personaText ? [{ from: "persona", text: L.names.personaText }] : []),
        ...(L.names.charText ? [{ from: "card", text: L.names.charText }] : []),
        ...L.records.filter((r) => r.provenance.source === "lore").map((r) => ({ from: `lore: ${r.name}`, text: [r.summary, ...Object.values(r.body).filter((v) => typeof v === "string")].join(". ") })),
        ...L.path.slice(0, i).map((x) => ({ from: `#${x.index}`, text: plainProse(x.content) })),
      ];
      return { m, before, offPage, issues, sources, recent: L.path.slice(Math.max(0, i - 10), i).map((x) => `${x.isUser ? L.names.user : x.name || L.names.char}: ${plainProse(x.content)}`).join("\n\n") };
    });
    if (!found) return null;
    const { m, before, offPage, issues, sources, recent } = found;
    let model = false;
    if (settings.replyCheck === "model") {
      try {
        const summaries = storySoFar(files.chronicle).map((u) => redact(`${u.title}: ${u.text}`, offPage));
        const sheets = redact([L.names.personaText && `${L.names.user} (the player's persona):\n${L.names.personaText.slice(0, 2500)}`, L.names.charText && `${L.names.char} (the card):\n${L.names.charText.slice(0, 2500)}`].filter(Boolean).join("\n\n"), offPage);
        const record = `${sheets ? `${sheets}\n\n` : ""}${checkRecord(before, summaries, L.names.user, 7000)}\n\nRecent turns:\n${recent.slice(-8000)}`;
        const lessons = (meta.lessons ?? []).filter((l) => l.status === "kept").map((l) => l.text).slice(-10);
        const p = checkPrompt({ record, reply: plainProse(m.content).slice(0, 12000), userName: L.names.user, cutoff: meta.config.canonCutoff?.point?.trim() || undefined, lessons });
        const conn = settings.replyCheckConnection || settings.summarizerConnection || undefined;
        const text = await quiet([sys(p.system), usr(p.user)], { userId, reasoningOff: true, timeoutMs: 90_000, connectionId: conn, label: "reply check" });
        const res = extractJson<{ issues?: { quote?: string; why?: string }[] }>(text);
        // The model reads a summary, so it calls things invented that the story said fifty turns
        // ago or the persona states. Look each claim up in everything said before; what's found goes.
        const index = passageIndex(sources);
        const doubt: { quote: string; why: string; passages: Passage[]; ok?: boolean }[] = [];
        for (const x of res?.issues ?? []) {
          if (!x?.quote || !x.why) continue;
          const quote = String(x.quote), why = String(x.why);
          if (AGREES.test(why)) continue;
          const near = supportOf(quote, index, 3);
          const said = saidBefore(quote, index);
          if (said || supported(near[0])) {
            debug(`check ${chatId}/${m.index}: "${quote.slice(0, 60)}" is in ${said?.from ?? near[0].from}`);
            continue;
          }
          doubt.push({ quote, why, passages: near.filter((s) => s.cover >= 0.3).map((s) => ({ from: s.from, text: redact(s.text, offPage) })) });
        }
        // Close but not plain (a paraphrase, a retelling): ask once more, with the passages in hand.
        const ask = doubt.filter((d) => d.passages.length);
        if (ask.length) {
          try {
            const v = verifyPrompt(ask);
            const ok = extractJson<{ supported?: unknown[] }>(await quiet([sys(v.system), usr(v.user)], { userId, reasoningOff: true, timeoutMs: 60_000, connectionId: conn, label: "reply check (verify)" }))?.supported ?? [];
            ask.forEach((d, j) => (d.ok = ok[j] === true));
          } catch (err) {
            warn(`reply check (verify): ${describe(err)}`);
          }
        }
        for (const d of doubt) {
          if (d.ok) continue;
          issues.push({ kind: "unsupported", level: "warn", text: `"${d.quote.slice(0, 80)}": ${d.why.slice(0, 160)}`, quote: d.quote.slice(0, 120) });
        }
        model = true;
      } catch (err) {
        await noteProblem(chatId, userId, "reply check (model read)", err);
      }
    }
    const fresh = await loadChat(chatId, userId);
    const checks = (fresh.meta.checks ??= {});
    checks[sideKey(m.id, m.swipe)] = { at: Date.now(), hash: hash(m.content), issues: issues.slice(0, 10), ...(model ? { model } : {}) };
    for (const k of Object.keys(checks).sort((a, b) => checks[b].at - checks[a].at).slice(16)) delete checks[k];
    save(chatId, "meta", userId);
    debug(`check ${chatId}/${m.index}: ${issues.length} issue(s)`);
    return issues;
  } catch (err) {
    warn(`reply check: ${describe(err)}`);
    return null;
  } finally {
    running.delete(key);
  }
}

/** The issues found for a message's current swipe, if its text hasn't changed since. */
export function checksFor(meta: { checks?: Record<string, { hash: string; issues: CheckIssue[] }> }, msgId: string, swipe: number, content: string): CheckIssue[] {
  const c = meta.checks?.[sideKey(msgId, swipe)];
  return c && c.hash === hash(content) ? c.issues : [];
}
