// Frontend ↔ backend messages: settings, Session Zero, Codex edits, chronicle
// actions, lore bridge controls, the creator, rebuilds and corrections.

import { describe, has, host, log, setDebug, warn } from "./host";
import { ledgerFor } from "./ledger";
import { loadChat, loadSettings, save, saveSettings } from "./store";
import { buildView, pushState } from "./view";
import { addUserOps, onMutation, rebuild, removeUserOps, repair, runChronicle, runSimulator, scheduleWeather, syncHidden } from "./ingest";
import { classifyReview, scanLore } from "./lorebridge";
import { syncMirror } from "./mirror";
import { bookHealth, creatorExport, creatorGenerate, creatorPlan, creatorReport, creatorSimulate, creatorWrite, listBooks } from "./creator";
import { pushMacros } from "./macros";
import type { ChatConfig } from "../core/types";
import { clearRenderCache } from "./hooks";
import { clerkWholeChat, stopClerk } from "./clerk";
import { runCheck } from "./check";

type Msg = { type: string; [k: string]: any };

function reply(userId: string, payload: unknown) {
  host.sendToFrontend(payload, userId);
}

/**
 * Whether this user may act on this chat. An operator-scoped install serves every user from one
 * worker, and the host resolves a chat's owner by itself, so a chat id sent by one user's page
 * must belong to that user before the Ledger reads its messages or changes it.
 */
const owned = new Map<string, boolean>();
async function ownsChat(chatId: unknown, userId: string): Promise<boolean> {
  if (typeof chatId !== "string" || !chatId) return false;
  if (!has("chats")) return true;
  const k = `${userId}:${chatId}`;
  const hit = owned.get(k);
  if (hit != null) return hit;
  const ok = !!(await host.chats.get(chatId, userId).catch(() => null));
  owned.set(k, ok);
  if (owned.size > 500) owned.delete(owned.keys().next().value!);
  return ok;
}

/** Run a background job from a button, reporting a failure instead of dropping it. */
function later(userId: string, label: string, fn: () => Promise<unknown>, ms = 200) {
  setTimeout(() => {
    fn().catch((err) => {
      warn(`${label}: ${describe(err)}`);
      toast(userId, "error", `${label}: ${describe(err)}`);
    });
  }, ms);
}

function toast(userId: string, tone: "success" | "info" | "warning" | "error", text: string) {
  try {
    (host.toast as any)[tone](text, { title: "ALMANAC", userId });
  } catch {
    reply(userId, { type: "toast", tone, text });
  }
}

/** Per-chat overrides the preset reads (Session Zero). */
export async function applyChatConfig(chatId: string, patch: Partial<ChatConfig>, userId?: string) {
  const files = await loadChat(chatId, userId);
  files.meta.config = { ...files.meta.config, ...patch, colors: { ...files.meta.config.colors, ...(patch.colors ?? {}) } };
  const c = files.meta.config;
  const vars: Record<string, string | undefined> = {
    alm_cfg_genres: c.genres?.length ? c.genres.join(", ") : undefined,
    alm_cfg_tone: c.tone, alm_cfg_romance: c.romance, alm_cfg_difficulty: c.difficulty, alm_cfg_nsfw: c.nsfw,
    alm_cfg_limits: c.limits, alm_cfg_persona: c.personaMode, alm_cfg_climate: c.climate, alm_cfg_calendar: c.calendar,
    alm_cfg_start: c.startPoint, alm_cfg_theme: c.theme, alm_cfg_trackers: c.trackers?.length ? c.trackers.join(", ") : undefined,
  };
  for (const [k, v] of Object.entries(vars)) {
    try {
      if (v) await host.variables.chat.set(chatId, k, v);
      else await host.variables.chat.delete(chatId, k);
    } catch {
      /* chat may be gone */
    }
  }
  save(chatId, "meta", userId, 0);
  clearRenderCache();
}

export async function characterDefaults(chatId: string, userId?: string): Promise<Partial<ChatConfig> | null> {
  const L = ledgerFor(chatId, userId);
  await L.loadNames();
  if (!L.names.characterId) return null;
  const ch = await host.characters.get(L.names.characterId, userId).catch(() => null);
  return (ch?.extensions as any)?.almanac_ledger?.defaults ?? null;
}

async function saveCharacterDefaults(chatId: string, cfg: Partial<ChatConfig>, userId?: string) {
  const L = ledgerFor(chatId, userId);
  await L.loadNames();
  if (!L.names.characterId) return;
  const ch = await host.characters.get(L.names.characterId, userId).catch(() => null);
  if (!ch) return;
  const ext = { ...(ch.extensions ?? {}) } as any;
  const { colors, sessionZeroDone, enabledOverride, ...rest } = cfg as any;
  void colors;
  void sessionZeroDone;
  void enabledOverride;
  ext.almanac_ledger = { ...(ext.almanac_ledger ?? {}), defaults: rest };
  await host.characters.update(ch.id, { extensions: ext } as any, userId);
}

export function registerBridge() {
  host.onFrontendMessage(async (raw, userId) => {
    const m = raw as Msg;
    if (!m || typeof m.type !== "string") return;
    // Every message about a chat must name one this user owns ("hello"/"getState" may omit it).
    if (m.chatId != null && !(await ownsChat(m.chatId, userId))) {
      warn(`frontend message ${m.type} for a chat this user doesn't own`);
      return;
    }
    if (m.chatId == null && !["hello", "getState", "settings", "books", "bookHealth", "creator"].includes(m.type)) return;
    try {
      switch (m.type) {
        case "hello":
        case "getState": {
          const chatId = m.chatId ?? (await host.chats.getActive(userId).catch(() => null))?.id;
          if (!chatId) return reply(userId, { type: "state", view: null });
          const view = await buildView(chatId, userId);
          reply(userId, { type: "state", view });
          return;
        }
        case "settings": {
          const s = await saveSettings(m.patch ?? {}, userId);
          setDebug(s.debug);
          clearRenderCache();
          if (m.chatId) {
            // Chronicle or hiding switched: the chat's hidden turns follow at once (other chats when next opened).
            if (["chronicle", "hideCovered", "enabled"].some((k) => k in (m.patch ?? {}))) await syncHidden(m.chatId, userId);
            pushState(m.chatId, userId);
            pushMacros(m.chatId, userId);
            if (m.patch?.mirror) syncMirror(m.chatId, userId);
          }
          return;
        }
        case "config": {
          await applyChatConfig(m.chatId, m.patch ?? {}, userId);
          onMutation(m.chatId, userId);
          return;
        }
        case "sessionZero": {
          const cfg: Partial<ChatConfig> = { ...(m.config ?? {}), sessionZeroDone: true };
          await applyChatConfig(m.chatId, cfg, userId);
          if (m.saveForCharacter) await saveCharacterDefaults(m.chatId, cfg, userId);
          const files = await loadChat(m.chatId, userId);
          files.meta.enabled = true;
          save(m.chatId, "meta", userId, 0);
          onMutation(m.chatId, userId);
          toast(userId, "success", "Session Zero saved for this chat.");
          return;
        }
        case "enable": {
          const files = await loadChat(m.chatId, userId);
          files.meta.config.enabledOverride = m.value === null ? undefined : !!m.value;
          if (m.value) files.meta.enabled = true;
          files.meta.charterMiss = 0;
          save(m.chatId, "meta", userId, 0);
          // Off: the turns the Almanac hid come back (the model would otherwise get neither them nor their summaries). On: hidden again.
          const r = await syncHidden(m.chatId, userId);
          if (r.shown) toast(userId, "info", `${r.shown} summarised turn${r.shown === 1 ? " is" : "s are"} back in the prompt.`);
          onMutation(m.chatId, userId);
          pushMacros(m.chatId, userId);
          return;
        }
        case "codexEdit": {
          const files = await loadChat(m.chatId, userId);
          const ov = (files.codex.overlays[m.id] ??= { id: m.id });
          const p = m.patch ?? {};
          if (p.summary != null) ov.summary = String(p.summary);
          if (p.name != null) ov.name = String(p.name);
          if (Array.isArray(p.keys)) ov.userKeys = p.keys.map(String);
          if (p.body && typeof p.body === "object") ov.body = { ...(ov.body ?? {}), ...p.body };
          if (p.locked != null) ov.locked = !!p.locked;
          if (p.status === "active" || p.status === "resolved") ov.status = p.status;
          if (p.narratorOnly != null) ov.scope = { ...(ov.scope ?? {}), narratorOnly: !!p.narratorOnly };
          if (p.delete && ov.standalone) delete files.codex.overlays[m.id];
          if (p.create) Object.assign(ov, { standalone: true, kind: p.kind ?? "texture", name: p.name ?? m.id, provenance: { source: "user" } });
          save(m.chatId, "codex", userId, 0);
          onMutation(m.chatId, userId);
          return;
        }
        case "color": {
          await applyChatConfig(m.chatId, { colors: { [m.charId]: m.color } }, userId);
          pushState(m.chatId, userId);
          return;
        }
        case "pressure": {
          const files = await loadChat(m.chatId, userId);
          if (m.text) files.meta.pressures[m.charId] = String(m.text);
          else delete files.meta.pressures[m.charId];
          save(m.chatId, "meta", userId, 0);
          onMutation(m.chatId, userId);
          return;
        }
        case "chronicle": {
          const files = await loadChat(m.chatId, userId);
          const u = files.chronicle.units.find((x) => x.id === m.unitId);
          switch (m.action) {
            case "run":
              toast(userId, "info", "Summarising…");
              toast(userId, "success", `${await runChronicle(m.chatId, userId, true)} new chronicle entries.`);
              break;
            case "rewriteAll": {
              // Drop every unlocked unit (arcs and volumes too), unhide the turns
              // they covered, and let the chronicle run again at the current detail.
              const drop = files.chronicle.units.filter((x) => !x.locked);
              files.chronicle.units = files.chronicle.units.filter((x) => x.locked);
              save(m.chatId, "chronicle", userId, 0);
              await syncHidden(m.chatId, userId);
              toast(userId, "info", `Rewriting ${drop.length} summaries…`);
              later(userId, "Rewrite all", async () => {
                let total = 0;
                for (let pass = 0; pass < 40; pass++) {
                  const n = await runChronicle(m.chatId, userId, true).catch(() => 0);
                  total += n;
                  if (!n) break;
                }
                toast(userId, "success", `${total} chronicle entries rewritten.`);
                pushState(m.chatId, userId);
                await syncMirror(m.chatId, userId);
              });
              break;
            }
            case "edit":
              if (u) Object.assign(u, { text: String(m.text ?? u.text), title: String(m.title ?? u.title), locked: true });
              break;
            case "lock":
              if (u) u.locked = !u.locked;
              break;
            case "ghost":
              if (u) u.ghost = !u.ghost;
              break;
            case "unhide":
            case "delete":
            case "regenerate":
              if (u) {
                files.chronicle.units = files.chronicle.units.filter((x) => x.id !== u.id);
                if (m.action === "regenerate") later(userId, "Regenerate summary", () => runChronicle(m.chatId, userId, true));
              }
              break;
          }
          save(m.chatId, "chronicle", userId, 0);
          await syncHidden(m.chatId, userId);
          pushState(m.chatId, userId);
          syncMirror(m.chatId, userId);
          return;
        }
        case "lore": {
          const files = await loadChat(m.chatId, userId);
          if (m.action === "scan") {
            const r = await scanLore(m.chatId, userId, true);
            toast(userId, "success", `Lore bridge: ${r.entries} entries from ${r.books} books (${r.review} to review).`);
          } else if (m.action === "mode" && files.meta.lore.books[m.bookId] && ["native", "assisted", "managed"].includes(m.value)) {
            files.meta.lore.books[m.bookId].mode = m.value;
          } else if (m.action === "classify") {
            toast(userId, "success", `Classified ${await classifyReview(m.chatId, userId)} entries.`);
          }
          save(m.chatId, "meta", userId, 0);
          onMutation(m.chatId, userId);
          return;
        }
        case "rebuild":
          await rebuild(m.chatId, userId);
          toast(userId, "success", "Rebuilt the story state from the transcript.");
          return;
        case "recheck": {
          const L = ledgerFor(m.chatId, userId);
          await L.refresh();
          const last = L.lastAssistant();
          if (last) {
            const files = await loadChat(m.chatId, userId);
            delete files.meta.checks?.[`${last.id}:${last.swipe}`];
            await runCheck(m.chatId, last.id, userId);
            clearRenderCache();
            pushState(m.chatId, userId);
          }
          return;
        }
        case "repairLast": {
          const L = ledgerFor(m.chatId, userId);
          await L.refresh();
          const last = L.lastAssistant();
          if (last) {
            const files = await loadChat(m.chatId, userId);
            delete files.meta.repaired[`${last.id}:${last.swipe}`];
            await repair(m.chatId, last.id, last.swipe, last.content, userId);
            onMutation(m.chatId, userId);
          }
          return;
        }
        case "clerkTidy": {
          // Every reply the clerk hasn't read, oldest first: one quiet call each; the page shows progress and can stop it.
          const chatId = m.chatId as string;
          clerkWholeChat(chatId, userId, (done, total) => {
            host.sendToFrontend({ type: "clerkProgress", chatId, done, total }, userId);
            if (done) pushState(chatId, userId);
          })
            .then((r) => {
              onMutation(chatId, userId);
              if (r.error) toast(userId, "error", `Knowledge clerk stopped after ${r.done} of ${r.total}: ${r.error}`);
              else if (r.stopped) toast(userId, "info", `Knowledge clerk paused after ${r.done} of ${r.total} replies. Tidy again to carry on.`);
              else toast(userId, "success", r.total ? `The knowledge clerk read all ${r.total} replies.` : "Every reply has already been read.");
            })
            .catch((err) => toast(userId, "error", `Knowledge clerk: ${describe(err)}`));
          return;
        }
        case "clerkStop":
          stopClerk(m.chatId);
          return;
        case "userOps": {
          const n = await addUserOps(m.chatId, (m.lines ?? []) as string[], userId);
          toast(userId, n ? "success" : "warning", n ? `Recorded ${n} correction(s). They hold if you regenerate or swipe the reply.` : "No valid ledger lines.");
          return;
        }
        case "userOpsRemove": {
          if (await removeUserOps(m.chatId, String(m.key ?? ""), String(m.id ?? ""), userId)) toast(userId, "success", "Correction removed.");
          return;
        }
        case "clearProblems": {
          const files = await loadChat(m.chatId, userId);
          files.meta.problems = [];
          save(m.chatId, "meta", userId, 0);
          pushState(m.chatId, userId);
          return;
        }
        case "releaseHidden": {
          const r = await syncHidden(m.chatId, userId, { release: true });
          toast(userId, "success", r.shown ? `${r.shown} hidden turn${r.shown === 1 ? " is" : "s are"} visible again.` : "No turns were hidden by the Almanac.");
          pushState(m.chatId, userId);
          return;
        }
        case "schedule":
          await scheduleWeather(m.chatId, m.spec, userId);
          return;
        case "simulate":
          await runSimulator(m.chatId, userId, true).catch((err) => toast(userId, "error", `Off-screen simulator: ${describe(err)}`));
          pushState(m.chatId, userId);
          return;
        case "mirrorSync":
          await syncMirror(m.chatId, userId);
          toast(userId, "success", "Mirror book synced.");
          return;
        case "books":
          reply(userId, { type: "books", books: await listBooks(userId), rid: m.rid });
          return;
        case "bookHealth":
          reply(userId, { type: "bookHealth", result: await bookHealth(m.bookId, userId), rid: m.rid });
          return;
        case "creator": {
          const rid = m.rid;
          try {
            const src = m.req?.source?.chatId ?? m.req?.chatId;
            if (src != null && !(await ownsChat(src, userId))) throw new Error("that chat isn't yours");
            if (m.action === "plan") reply(userId, { type: "creator", rid, plan: await creatorPlan(m.req, userId) });
            else if (m.action === "generate") {
              const res = await creatorGenerate(m.req, userId, (done, total) => reply(userId, { type: "creatorProgress", rid, done, total }));
              reply(userId, { type: "creator", rid, ...res, report: creatorReport(res.entries) });
            } else if (m.action === "report") reply(userId, { type: "creator", rid, report: creatorReport(m.entries) });
            else if (m.action === "simulate") reply(userId, { type: "creator", rid, activation: creatorSimulate(m.entries, m.scene ?? "") });
            else if (m.action === "export") reply(userId, { type: "creator", rid, json: creatorExport(m.entries) });
            else if (m.action === "write") {
              const r = await creatorWrite(m.req, userId);
              reply(userId, { type: "creator", rid, written: r });
              toast(userId, "success", `Lorebook saved: ${r.created} created, ${r.updated} updated.`);
            }
          } catch (err) {
            reply(userId, { type: "creator", rid, error: describe(err) });
          }
          return;
        }
        default:
          log(`unknown frontend message ${m.type}`);
      }
    } catch (err) {
      warn(`bridge ${m.type}: ${describe(err)}`);
      toast(userId, "error", `ALMANAC: ${describe(err)}`);
    }
  });
}

export { loadSettings };
