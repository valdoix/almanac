// ALMANAC Ledger — frontend entry. Injects the stylesheet (with live speaker
// colours and the active skin), registers the "Almanac" drawer tab, the floating
// Now widget, a command button in the input bar, and Session Zero.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { AlmanacApp } from "./frontend/app";
import { FONTS_IMPORT, MESSAGE_CSS, PANEL_CSS, TOKENS } from "./frontend/styles";
import { openSessionZero } from "./frontend/sessionzero";
import { escapeHtml as e, initials } from "./core/util";

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

  // Floating "Now" HUD (ui_panels)
  let hud: ReturnType<SpindleFrontendContext["ui"]["createFloatWidget"]> | null = null;
  const ensureHud = (on: boolean) => {
    try {
      if (on && !hud) {
        hud = ctx.ui.createFloatWidget({ width: 300, height: 40, initialPosition: { x: 24, y: 88 }, snapToEdge: true, tooltip: "ALMANAC · Now", chromeless: true });
        hud.root.addEventListener("click", () => tab.activate());
      } else if (!on && hud) {
        hud.destroy();
        hud = null;
      }
    } catch {
      hud = null; // no ui_panels permission
    }
  };

  const renderHud = (v: any) => {
    if (!hud) return;
    if (!v || !v.enabled) {
      hud.setVisible(false);
      return;
    }
    hud.setVisible(true);
    const n = v.now;
    const present = v.cast.filter((c: any) => (c.tier === "spot" || c.tier === "peri") && !c.isUser).slice(0, 5);
    hud.root.innerHTML = `<div class="alm-hudw" title="Open the Almanac"><span>🕰 ${e(n.time ?? "—")}</span>${n.weather ? `<span>${e(n.weather.glyph)} ${e(n.weather.condition)}</span>` : ""}<span>📍 ${e(n.place[n.place.length - 1] ?? "—")}</span>${present.map((c: any) => `<span class="alm-mini" style="--c:${e(c.color)}" title="${e(c.name)}${c.mood?.name ? ` · ${e(c.mood.name)}` : ""}">${e(initials(c.name))}</span>`).join("")}</div>`;
  };

  const applyView = (v: any) => {
    app.setView(v);
    if (v) {
      document.documentElement.setAttribute("data-alm-skin", v.theme || "almanac");
      if (v.speakerCss !== lastSpeakerCss) {
        speakerStyle?.();
        speakerStyle = v.speakerCss ? ctx.dom.addStyle(v.speakerCss) : null;
        lastSpeakerCss = v.speakerCss;
      }
      if (v.settings && v.settings.fonts !== fontsOn) setFonts(!!v.settings.fonts);
      ensureHud(!!v.settings?.hud && v.enabled);
      tab.setBadge(v.counts?.unverified ? String(v.counts.unverified) : null);
    }
    renderHud(v);
  };

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
  removers.push(ctx.events.on("almanac:settings", (p: any) => {
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

  tab.onActivate(() => ctx.sendToBackend({ type: "getState", chatId: ctx.getActiveChat().chatId }));
  removers.push(ctx.events.on("CHAT_SWITCHED", () => setTimeout(() => ctx.sendToBackend({ type: "getState", chatId: ctx.getActiveChat().chatId }), 150)));
  ctx.sendToBackend({ type: "hello", chatId: ctx.getActiveChat().chatId });

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
