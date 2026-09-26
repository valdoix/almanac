// ALMANAC Ledger — frontend entry. Injects the stylesheet (with live speaker
// colours and the active skin), registers the "Almanac" drawer tab, the floating
// Now widget, a command button in the input bar, and Session Zero.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { AlmanacApp } from "./frontend/app";
import { FONTS_IMPORT, MESSAGE_CSS, PANEL_CSS, TOKENS } from "./frontend/styles";
import { openSessionZero } from "./frontend/sessionzero";
import { hudCard, hudPill, measure } from "./frontend/hud";
import { VERSION } from "./core/version";

const ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><circle cx="12" cy="10" r="3.2"/><path d="M12 4.5v1.3M12 14.2v1.3M6.5 10h1.3M16.2 10h1.3"/></svg>`;

const COMMANDS: [string, string][] = [
  ["/skip 15m", "⏩ Skip 15 minutes"], ["/skip 1h", "⏩ Skip an hour"], ["/skip until evening", "⏩ Skip until evening"], ["/skip until morning", "⏩ Skip to next morning"],
  ["/recap", "📜 Recap (Previously on…)"], ["/report bonds", "🕸 Report: bonds"], ["/report threads", "🧵 Report: threads"], ["/audit", "🔎 Audit continuity"],
];

export function setup(ctx: SpindleFrontendContext) {
  const removers: (() => void)[] = [];
  let fontsOn = true;
  let fontStyle: (() => void) | null = null;
  const setFonts = (on: boolean) => {
    if (on && !fontStyle) fontStyle = ctx.dom.addStyle(FONTS_IMPORT);
    if (!on && fontStyle) {
      fontStyle();
      fontStyle = null;
    }
    fontsOn = on;
  };
  setFonts(true);
  removers.push(ctx.dom.addStyle(TOKENS + MESSAGE_CSS + PANEL_CSS));
  let speakerStyle: (() => void) | null = null;
  let lastSpeakerCss = "";

  const tab = ctx.ui.registerDrawerTab({
    id: "almanac",
    title: "ALMANAC Ledger",
    shortName: "Almanac",
    description: "Story state, Codex, chapters, bonds, knowledge, lore bridge and lorebook creator",
    keywords: ["almanac", "ledger", "codex", "tracker", "chronicle", "lorebook", "bonds", "weather"],
    headerTitle: "Almanac",
    iconSvg: ICON,
  });
  const app = new AlmanacApp(ctx, tab.root);
  app.render();

  // Lumiverse caches each message's rendered display by its raw text, not by
  // extension version or story state. Ask it to redraw after this extension
  // (re)loads and whenever something that changes the trackers' look changes,
  // so an update or a settings change shows without a page reload.
  const refreshDisplay = () => {
    try {
      ctx.display?.invalidate(["*"]);
    } catch {
      /* older host */
    }
  };
  let displaySig: string | undefined;
  setTimeout(refreshDisplay, 0);

  // Asking for the chat's state. The first "hello" can be lost when the drawer
  // loads before the backend worker is up, so keep asking (with backoff) until a
  // view for the active chat arrives.
  let gotStateFor: string | null | undefined;
  let retry: ReturnType<typeof setTimeout> | null = null;
  const requestState = (attempt = 0) => {
    if (retry) clearTimeout(retry);
    retry = null;
    const chatId = ctx.getActiveChat().chatId;
    app.setStatus(chatId ? (attempt >= 4 ? "stalled" : "waiting") : "nochat");
    renderHud(app.view);
    if (!chatId) return;
    ctx.sendToBackend({ type: attempt === 0 ? "hello" : "getState", chatId });
    const delays = [900, 2000, 4000, 8000, 15000, 30000];
    retry = setTimeout(() => {
      if (gotStateFor !== ctx.getActiveChat().chatId) requestState(attempt + 1);
    }, delays[Math.min(attempt, delays.length - 1)]);
  };

  // Floating "Now" widget (ui_panels). Shown whenever a chat is open and the
  // widget is switched on. The pill opens into a small Now window; the window's
  // button opens the full drawer. It sizes itself to what it shows.
  let hud: ReturnType<SpindleFrontendContext["ui"]["createFloatWidget"]> | null = null;
  let hudOn = true;
  let hudOpen = false;
  try {
    hudOpen = localStorage.getItem("alm-hud-open") === "1";
  } catch {
    /* private mode */
  }
  const setHudOpen = (open: boolean) => {
    hudOpen = open;
    try {
      localStorage.setItem("alm-hud-open", open ? "1" : "0");
    } catch {
      /* ignore */
    }
    renderHud(app.view);
  };
  const onHudAction = (target: EventTarget | null) => {
    const el = (target as HTMLElement | null)?.closest?.("[data-hud]") as HTMLElement | null;
    if (!el) return;
    const v = app.view;
    const live = v && v.chatId === ctx.getActiveChat().chatId && v.enabled;
    if (el.dataset.hud === "open" || !live) {
      tab.activate();
      return;
    }
    setHudOpen(!hudOpen);
  };
  const ensureHud = (on: boolean) => {
    hudOn = on;
    try {
      if (on && !hud) {
        hud = ctx.ui.createFloatWidget({ width: 260, height: 40, initialPosition: { x: 24, y: 88 }, snapToEdge: true, tooltip: "ALMANAC · Now", chromeless: true });
        hud.root.addEventListener("click", (ev) => onHudAction(ev.target));
        hud.root.addEventListener("keydown", (ev) => {
          const k = (ev as KeyboardEvent).key;
          if (k === "Escape" && hudOpen) setHudOpen(false);
          else if ((k === "Enter" || k === " ") && (ev.target as HTMLElement).matches?.('[role="button"]')) {
            ev.preventDefault();
            onHudAction(ev.target);
          }
        });
        app.hudProblem = "";
      } else if (!on && hud) {
        hud.destroy();
        hud = null;
      }
    } catch (err) {
      hud = null;
      app.hudProblem = /PERMISSION/i.test(String(err)) ? "permission" : String((err as Error)?.message ?? err);
      app.render();
    }
    renderHud(app.view);
  };

  let lastHud = "";
  const renderHud = (v: any) => {
    if (!hud) return;
    const chatId = ctx.getActiveChat().chatId;
    if (!chatId || !hudOn) {
      hud.setVisible(false);
      return;
    }
    hud.setVisible(true);
    let html: string;
    let width: number | undefined;
    if (!v || v.chatId !== chatId) html = hudPill(null, app.status === "stalled" ? "no answer yet" : "connecting…");
    else if (!v.enabled) html = hudPill(null, "off in this chat");
    else if (hudOpen) {
      html = hudCard(v);
      width = 300;
    } else html = hudPill(v);
    if (html === lastHud) return;
    lastHud = html;
    hud.root.innerHTML = html;
    const size = measure(html, width);
    hud.setSize(Math.min(width ?? 440, Math.max(120, size.w || 260)), Math.max(40, Math.min(560, size.h || 40)));
  };

  const applyView = (v: any) => {
    gotStateFor = v ? v.chatId : null;
    if (retry && v) {
      clearTimeout(retry);
      retry = null;
    }
    app.setStatus(v ? "ok" : ctx.getActiveChat().chatId ? "waiting" : "nochat");
    app.versionWarning = v && v.version !== VERSION ? String(v.version ?? "an older version") : "";
    app.setView(v);
    if (v) {
      const sig = JSON.stringify([v.chatId, v.version, v.enabled, v.theme, v.config?.colors, v.detected?.trackerView, v.detected?.trackers, v.detected?.nsfw]);
      if (sig !== displaySig) {
        if (displaySig !== undefined || v.version !== VERSION) refreshDisplay();
        displaySig = sig;
      }
      document.documentElement.setAttribute("data-alm-skin", v.theme || "almanac");
      if (v.speakerCss !== lastSpeakerCss) {
        speakerStyle?.();
        speakerStyle = v.speakerCss ? ctx.dom.addStyle(v.speakerCss) : null;
        lastSpeakerCss = v.speakerCss;
      }
      if (v.settings && v.settings.fonts !== fontsOn) setFonts(!!v.settings.fonts);
      if (v.settings && !!v.settings.hud !== hudOn) ensureHud(!!v.settings.hud);
      tab.setBadge(v.counts?.unverified ? String(v.counts.unverified) : null);
    }
    renderHud(v);
  };
  ensureHud(true);

  removers.push(
    ctx.onBackendMessage((raw) => {
      const m = raw as any;
      if (!m || typeof m.type !== "string") return;
      if (app.creator.handle(m)) return;
      switch (m.type) {
        case "state":
          applyView(m.view);
          break;
        case "open":
          tab.activate();
          break;
        case "sessionZero": {
          const active = ctx.getActiveChat().chatId;
          if (m.chatId && active && m.chatId !== active) return;
          const cfg = app.view?.chatId === m.chatId ? app.view?.config : null;
          if (cfg?.sessionZeroDone && !m.force) return;
          openSessionZero(ctx, m.chatId, cfg);
          break;
        }
        case "toast":
          console.info(`[ALMANAC] ${m.text}`);
          break;
      }
    }),
  );

  removers.push(ctx.events.on("almanac:sessionZero", (p: any) => {
    const chatId = p?.chatId ?? ctx.getActiveChat().chatId;
    if (chatId) openSessionZero(ctx, chatId, app.view?.chatId === chatId ? app.view?.config : null);
  }));
  removers.push(ctx.events.on("almanac:retryState", () => requestState()));
  removers.push(ctx.events.on("almanac:grantPanels", async () => {
    try {
      await ctx.permissions.request(["ui_panels"], { reason: "Show the floating Now widget (time, weather, place and who is present)." } as any);
      ensureHud(true);
    } catch {
      /* declined */
    }
  }));
  removers.push(ctx.events.on("almanac:settings", (p: any) => {
    setTimeout(refreshDisplay, 400);
    if (p && "hud" in p) ensureHud(!!p.hud);
    if (p && "fonts" in p) setFonts(!!p.fonts);
  }));

  // Command button in the input bar's Extras popover.
  try {
    const action = ctx.ui.registerInputBarAction({ id: "almanac-command", label: "Almanac command…", iconSvg: ICON.replace(/20/g, "14") });
    removers.push(action.onClick(async () => {
      try {
        const res = await ctx.ui.showContextMenu({ items: COMMANDS.map(([key, label]) => ({ key, label })), position: { x: Math.round(window.innerWidth / 2), y: window.innerHeight - 120 } });
        const key = res?.selectedKey;
        if (key) insertIntoComposer(key);
      } catch {
        insertIntoComposer("/recap");
      }
    }));
    removers.push(() => action.destroy());
  } catch {
    /* optional */
  }

  tab.onActivate(() => requestState(gotStateFor === ctx.getActiveChat().chatId ? 1 : 0));
  removers.push(ctx.events.on("CHAT_SWITCHED", () => setTimeout(() => {
    gotStateFor = undefined;
    requestState();
  }, 150)));
  // getActiveChat() can be empty for a moment on a fresh page load.
  let boots = 0;
  const boot = () => {
    if (ctx.getActiveChat().chatId || ++boots > 10) requestState();
    else setTimeout(boot, 500);
  };
  boot();

  return () => {
    for (const r of removers) {
      try {
        r();
      } catch {
        /* ignore */
      }
    }
    speakerStyle?.();
    fontStyle?.();
    if (retry) clearTimeout(retry);
    hud?.destroy();
    tab.destroy();
    document.documentElement.removeAttribute("data-alm-skin");
    ctx.dom.cleanup();
  };
}

/** Best effort: put a command in the chat composer (there is no official composer API). */
function insertIntoComposer(text: string) {
  const ta = document.querySelector<HTMLTextAreaElement>("textarea[data-chat-input], .chat-input textarea, form textarea, textarea");
  if (!ta) {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    return;
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(ta, text);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  ta.focus();
}
