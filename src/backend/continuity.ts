// The drawer's controls for the continuity tools: undo a fact read from the player's message, settle a
// promise, add or remove a recurring day, set the canon cutoff (and have the model suggest its list),
// keep or dismiss a lesson from a swipe, and write a character's journal now.

import { cleanTerms, cutoffPrompt } from "../core/canon";
import { addLessons, type Lesson } from "../core/autopsy";
import { extractJson } from "../core/prompts";
import type { ChatConfig, RecurringDay } from "../core/types";
import { plainProse, slug } from "../core/util";
import { describe, warn } from "./host";
import { ledgerFor } from "./ledger";
import { quiet, sys, usr } from "./llm";
import { loadChat, loadSettings, save } from "./store";
import { runJournals } from "./journals";

export type Say = (tone: "success" | "info" | "warning" | "error", text: string) => void;

async function patchConfig(chatId: string, userId: string | undefined, f: (c: ChatConfig) => void) {
  const files = await loadChat(chatId, userId);
  f(files.meta.config);
  save(chatId, "meta", userId, 0);
}

/** One control's message; true when the chat's state changed and should be refolded. */
export async function continuityAction(chatId: string, m: Record<string, any>, userId: string | undefined, say: Say): Promise<boolean> {
  switch (m.type) {
    case "undoFact": {
      const key = String(m.key ?? "");
      if (!key) return false;
      await patchConfig(chatId, userId, (c) => {
        c.ignoredFacts = [...new Set([...(c.ignoredFacts ?? []), key])].slice(-200);
        c.ignoredLines = { ...(c.ignoredLines ?? {}), [key]: String(m.line ?? "").slice(0, 200) };
      });
      say("info", `Undone: ${String(m.line ?? "that line")}. Restore it on the Recall page.`);
      return true;
    }
    case "restoreFact": {
      const key = String(m.key ?? "");
      await patchConfig(chatId, userId, (c) => {
        c.ignoredFacts = (c.ignoredFacts ?? []).filter((k) => k !== key);
        if (c.ignoredLines) delete c.ignoredLines[key];
      });
      return true;
    }
    case "promise": {
      const id = String(m.id ?? "");
      const v = m.value === "kept" || m.value === "broken" || m.value === "dropped" ? m.value : null;
      if (!id) return false;
      await patchConfig(chatId, userId, (c) => {
        const e = { ...(c.promiseEdits ?? {}) };
        if (v) e[id] = v;
        else delete e[id];
        c.promiseEdits = e;
      });
      return true;
    }
    case "recurring": {
      if (m.action === "add") {
        const name = String(m.name ?? "").trim().slice(0, 80);
        const when = String(m.when ?? "").trim().slice(0, 80);
        if (!name || !when) {
          say("warning", "A recurring day needs a name and when it falls.");
          return false;
        }
        const who = String(m.who ?? "").trim().slice(0, 60);
        const day: RecurringDay = { id: `rec:${slug(name)}`, name, when, ...(who ? { who } : {}), by: "user" };
        await patchConfig(chatId, userId, (c) => {
          c.recurring = [...(c.recurring ?? []).filter((r) => r.id !== day.id), day];
        });
        return true;
      }
      if (m.action === "remove") {
        await patchConfig(chatId, userId, (c) => {
          c.recurring = (c.recurring ?? []).filter((r) => r.id !== m.id);
        });
        return true;
      }
      return false;
    }
    case "cutoff": {
      const point = String(m.point ?? "").trim().slice(0, 200);
      const notYet = cleanTerms(m.notYet ?? []);
      await patchConfig(chatId, userId, (c) => {
        c.canonCutoff = point || notYet.length ? { point, notYet } : undefined;
      });
      say("success", point ? `Canon cutoff saved: ${point}${notYet.length ? ` (${notYet.length} terms held back)` : ""}.` : "Canon cutoff cleared.");
      return true;
    }
    case "cutoffSuggest": {
      const point = String(m.point ?? "").trim().slice(0, 200);
      if (!point) {
        say("warning", "Say where the story stands in its source first (\"Buffy, season 3, before Graduation\").");
        return false;
      }
      const files = await loadChat(chatId, userId);
      files.meta.cutoffBusy = true;
      save(chatId, "meta", userId, 0);
      try {
        const settings = await loadSettings(userId);
        const L = ledgerFor(chatId, userId);
        const context = [L.names.char && `The card: ${L.names.char}. ${(L.names.charText ?? "").slice(0, 1200)}`, ...L.path.slice(-6).map((x) => plainProse(x.content).slice(0, 400))].filter(Boolean).join("\n\n");
        const p = cutoffPrompt(point, context);
        const text = await quiet([sys(p.system), usr(p.user)], { userId, reasoningOff: true, timeoutMs: 90_000, connectionId: settings.summarizerConnection || undefined, label: "canon cutoff" });
        const got = cleanTerms((extractJson<{ notYet?: unknown[] }>(text)?.notYet ?? []).map(String));
        const fresh = await loadChat(chatId, userId);
        const had = fresh.meta.config.canonCutoff?.notYet ?? [];
        const merged = cleanTerms([...had, ...got]);
        fresh.meta.config.canonCutoff = { point, notYet: merged };
        fresh.meta.cutoffBusy = false;
        save(chatId, "meta", userId, 0);
        say(got.length ? "success" : "warning", got.length ? `${merged.length - had.length} terms suggested from later in the source. Check the list and remove anything that has already happened in your story.` : "The model didn't know what comes after that point. Add the names and events yourself.");
      } catch (err) {
        const fresh = await loadChat(chatId, userId);
        fresh.meta.cutoffBusy = false;
        save(chatId, "meta", userId, 0);
        warn(`cutoff suggest: ${describe(err)}`);
        say("error", `Couldn't suggest the list: ${describe(err)}`);
      }
      return true;
    }
    case "lesson": {
      const files = await loadChat(chatId, userId);
      let list: Lesson[] = files.meta.lessons ?? [];
      const l = list.find((x) => x.id === m.id);
      if (m.action === "add") {
        const text = String(m.text ?? "").trim().slice(0, 200);
        if (text) list = addLessons(list, [{ id: `l_user_${Date.now()}`, text, msgIndex: -1, status: "kept", by: "user", at: Date.now() }]);
      } else if (l && (m.action === "keep" || m.action === "dismiss")) l.status = m.action === "keep" ? "kept" : "dismissed";
      else if (l && m.action === "restore") l.status = "pending";
      else if (l && m.action === "edit" && String(m.text ?? "").trim()) l.text = String(m.text).trim().slice(0, 200);
      else if (l && m.action === "delete") list = list.filter((x) => x !== l);
      files.meta.lessons = list;
      save(chatId, "meta", userId, 0);
      return false;
    }
    case "journal": {
      const n = await runJournals(chatId, userId, { force: true, only: String(m.charId ?? "") || undefined });
      say(n ? "success" : "info", n ? "Journal written." : "Nothing to write about yet: the day needs a few messages first.");
      return false;
    }
  }
  return false;
}

export const CONTINUITY_TYPES = new Set(["undoFact", "restoreFact", "promise", "recurring", "cutoff", "cutoffSuggest", "lesson", "journal"]);
