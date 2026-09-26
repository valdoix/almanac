// ALMANAC Ledger backend entry: register hooks, macros, tools, commands and
// event listeners. Every feature degrades gracefully when a permission is denied.

import { describe, has, host, log, rememberUser, setDebug, userFor, warn } from "./host";
import { registerContextHandler, registerPromptInterceptor, registerRenderProcessor, registerWorldInfoInterceptor, clearRenderCache } from "./hooks";
import { registerMacros, pushMacros } from "./macros";
import { registerTools } from "./tools";
import { registerBridge, characterDefaults, applyChatConfig } from "./bridge";
import { onFork, onMutation, onReply, rebuild, runChronicle } from "./ingest";
import { scanLore } from "./lorebridge";
import { dropLedger, ledgerFor } from "./ledger";
import { forget, loadChat, loadSettings } from "./store";
import { pushState } from "./view";
import { isEnabled } from "./turn";
import { syncMirror } from "./mirror";

async function boot() {
  const settings = await loadSettings().catch(() => null);
  if (settings) setDebug(settings.debug);
  registerMacros();
  registerContextHandler();
  registerWorldInfoInterceptor();
  registerPromptInterceptor();
  registerRenderProcessor();
  registerTools();
  registerBridge();
  registerCommands();
  log(`ALMANAC Ledger ready (permissions: ${(await host.permissions.getGranted().catch(() => [] as string[])).join(", ")})`);
  const active = await host.chats.getActive().catch(() => null);
  if (active) onSwitch(active.id);
}

async function onSwitch(chatId: string | null, userId?: string) {
  if (!chatId) return;
  rememberUser(chatId, userId);
  try {
    const files = await loadChat(chatId, userId);
    const settings = await loadSettings(userId);
    if (!files.meta.config.sessionZeroDone && !files.meta.config.genres.length) {
      const defaults = await characterDefaults(chatId, userId).catch(() => null);
      if (defaults) await applyChatConfig(chatId, { ...defaults, sessionZeroDone: true }, userId);
    }
    if (isEnabled(files.meta, settings)) {
      const L = ledgerFor(chatId, userId);
      await L.refresh({ reloadNames: true });
      scanLore(chatId, userId).catch((err) => warn(`lore scan: ${describe(err)}`));
      if (!files.meta.config.sessionZeroDone && L.path.length <= 2) host.sendToFrontend({ type: "sessionZero", chatId }, userId);
    }
    await pushMacros(chatId, userId);
    pushState(chatId, userId);
  } catch (err) {
    warn(`switch: ${describe(err)}`);
  }
}

function uid(chatId: string, hostUserId?: string) {
  return hostUserId ?? userFor(chatId);
}

host.on("CHAT_SWITCHED", (p: any, userId) => onSwitch(p?.chatId ?? null, userId));
host.on("GENERATION_ENDED", (p, userId) => {
  if (!p?.chatId || p.error) return;
  rememberUser(p.chatId, userId);
  onReply(p.chatId, p.messageId, p.content ?? "", p.generationType ?? "normal", uid(p.chatId, userId)).catch((err) => warn(`reply: ${describe(err)}`));
});
host.on("GENERATION_STOPPED", (p, userId) => {
  if (p?.chatId) onMutation(p.chatId, uid(p.chatId, userId));
});
host.on("MESSAGE_SWIPED", (p, userId) => {
  if (!p?.chatId) return;
  if (p.action === "added") return; // the generation that fills it will arrive as GENERATION_ENDED
  onMutation(p.chatId, uid(p.chatId, userId));
});
host.on("SWIPE_EDITED", (p, userId) => p?.chatId && onMutation(p.chatId, uid(p.chatId, userId)));
host.on("MESSAGE_EDITED", (p: any, userId) => p?.chatId && onMutation(p.chatId, uid(p.chatId, userId)));
host.on("MESSAGE_DELETED", (p: any, userId) => p?.chatId && onMutation(p.chatId, uid(p.chatId, userId)));
host.on("MESSAGE_SENT", (p: any, userId) => p?.chatId && rememberUser(p.chatId, userId));
host.on("CHAT_FORKED", (p, userId) => {
  if (p?.sourceChatId && p.forkedChatId) onFork(p.sourceChatId, p.forkedChatId, uid(p.sourceChatId, userId));
});
host.on("CHARACTER_EDITED", () => clearRenderCache());
host.on("PERSONA_CHANGED", async (_p, userId) => {
  const active = await host.chats.getActive(userId).catch(() => null);
  if (active) {
    dropLedger(active.id);
    onSwitch(active.id, userId);
  }
});
host.on("CHAT_CHANGED", (p: any, userId) => {
  const id = p?.chat?.id ?? p?.chatId;
  const changed: string[] = p?.changedFields ?? [];
  if (id && changed.some((f) => f.includes("chat_world_book_ids"))) scanLore(id, uid(id, userId), true).catch(() => undefined);
});

function registerCommands() {
  try {
    host.commands.register([
      { id: "open", label: "ALMANAC: Open the Almanac", description: "Open the story Ledger drawer tab", keywords: ["almanac", "ledger", "codex", "trackers"], scope: "chat" } as any,
      { id: "session-zero", label: "ALMANAC: Session Zero", description: "Set genre, tone, pace, limits, climate and start point for this chat", keywords: ["setup", "genre", "session"], scope: "chat" } as any,
      { id: "summarise", label: "ALMANAC: Summarise old turns now", description: "Run the chronicle (chapters, arcs, volumes)", keywords: ["chapter", "summary", "memory"], scope: "chat-idle" } as any,
      { id: "rebuild", label: "ALMANAC: Rebuild from transcript", description: "Re-read every stored ledger and rebuild the story state", keywords: ["repair", "reset", "rebuild"], scope: "chat-idle" } as any,
      { id: "mirror", label: "ALMANAC: Sync mirror lorebook", description: "Project the Codex into this chat's managed lorebook", keywords: ["lorebook", "world book", "mirror"], scope: "chat-idle" } as any,
      { id: "lore", label: "ALMANAC: Re-read attached lorebooks", description: "Run the Lore Bridge over character, persona, chat and global books", keywords: ["lore", "world info"], scope: "chat-idle" } as any,
    ]);
    host.commands.onInvoked(async (id, ctx) => {
      const chatId = ctx.chatId;
      if (!chatId) return;
      const userId = userFor(chatId);
      switch (id) {
        case "open":
          host.sendToFrontend({ type: "open" }, userId);
          break;
        case "session-zero":
          host.sendToFrontend({ type: "sessionZero", chatId, force: true }, userId);
          break;
        case "summarise":
          await runChronicle(chatId, userId, true);
          break;
        case "rebuild":
          await rebuild(chatId, userId);
          break;
        case "mirror":
          await syncMirror(chatId, userId);
          break;
        case "lore":
          await scanLore(chatId, userId, true);
          pushState(chatId, userId);
          break;
      }
    });
  } catch (err) {
    warn(`commands: ${describe(err)}`);
  }
}

host.on("SPINDLE_EXTENSION_UNLOADED", () => undefined);

if (!has("interceptor")) log("interceptor permission missing: notes and chapters will not be injected");
boot().catch((err) => warn(`boot: ${describe(err)}`));

export { forget };
