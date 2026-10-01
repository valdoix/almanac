// ALMANAC Ledger — frontend entry. Injects the stylesheet (with live speaker
// colours and the active skin), registers the "Almanac" drawer tab, the floating
// Now widget, a command button in the input bar, and Session Zero.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { AlmanacApp } from "./frontend/app";
import { MESSAGE_CSS, PANEL_CSS, TOKENS } from "./frontend/styles";
import { SKIN_CSS, customCss, fontsFor } from "./frontend/skins";
import { openSessionZero } from "./frontend/sessionzero";
import { HUD_SIZE, hudCard, hudPill, measure, type HudUi } from "./frontend/hud";
import { HUD_CSS } from "./frontend/hudstyles";
import { attentionNote, engineNew } from "./frontend/orrery";
import { VERSION } from "./core/version";

const ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><circle cx="12" cy="10" r="3.2"/><path d="M12 4.5v1.3M12 14.2v1.3M6.5 10h1.3M16.2 10h1.3"/></svg>`;

const COMMANDS: [string, string][] = [
  ["/skip 15m", "⏩ Skip 15 minutes"], ["/skip 1h", "⏩ Skip an hour"], ["/skip until evening", "⏩ Skip until evening"], ["/skip until morning", "⏩ Skip to next morning"],
  ["/recap", "📜 Recap (Previously on…)"], ["/report bonds", "🕸 Report: bonds"], ["/report threads", "🧵 Report: threads"], ["/audit", "🔎 Audit continuity"],
];

export function setup(ctx: SpindleFrontendContext) {
  const removers: (() => void)[] = [];
  let fontsOn = true;
  let skin = "almanac";
  let fontStyle: (() => void) | null = null;
  let fontSkin = "";
  // Web fonts: the base set plus the active skin's, swapped when the skin changes.
  const setFonts = (on: boolean) => {
    if (fontStyle && (!on || fontSkin !== skin)) {
      fontStyle();
      fontStyle = null;
    }
    if (on && !fontStyle) {
      fontStyle = ctx.dom.addStyle(fontsFor(skin));
      fontSkin = skin;
    }
    fontsOn = on;
  };
  setFonts(true);
  removers.push(ctx.dom.addStyle(TOKENS + SKIN_CSS + MESSAGE_CSS + PANEL_CSS + HUD_CSS));
  // The player's own colours, laid over the skins' (added later, so it wins).
  let customStyle: (() => void) | null = null;
  let lastCustom = "";
  const applyCustom = (colors: unknown) => {
    const css = customCss(colors as any);
    if (css === lastCustom) return;
    customStyle?.();
    customStyle = css ? ctx.dom.addStyle(css) : null;
    lastCustom = css;
  };

  // Light or dark: the player's choice, or Lumiverse's own mode read from its background.
  let modePref = "auto";
  const systemDark = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const hostMode = (): "light" | "dark" => {
    if (typeof getComputedStyle !== "function") return systemDark() ? "dark" : "light";
    const probe = (el: Element | null) => {
      if (!el) return null;
      const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(getComputedStyle(el).backgroundColor);
      if (!m || (m[4] != null && parseFloat(m[4]) < 0.5)) return null;
      const [r, g, b] = [m[1], m[2], m[3]].map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 ? "dark" : "light";
    };
    const fromVar = getComputedStyle(document.documentElement).getPropertyValue("--lumiverse-bg").trim();
    if (fromVar) {
      const tmp = document.createElement("span");
      tmp.style.cssText = `position:absolute;visibility:hidden;background:${fromVar}`;
      document.body.append(tmp);
      const m = probe(tmp);
      tmp.remove();
      if (m) return m;
    }
    return probe(document.body) ?? probe(document.documentElement) ?? (systemDark() ? "dark" : "light");
  };
  const applyMode = () => {
    let mode: string = modePref;
    if (mode !== "light" && mode !== "dark") {
      try {
        mode = hostMode();
      } catch {
        mode = "light";
      }
    }
    document.documentElement.setAttribute("data-alm-mode", mode);
  };
  applyMode();
  // Follow Lumiverse when it switches between light and dark.
  if (typeof MutationObserver === "function") {
    const modeWatch = new MutationObserver(() => {
      if (modePref === "auto") applyMode();
    });
    modeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-mode", "data-color-scheme"] });
    if (document.body) modeWatch.observe(document.body, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    removers.push(() => modeWatch.disconnect());
  }
  if (typeof matchMedia === "function") {
    const schemeQuery = matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => modePref === "auto" && applyMode();
    schemeQuery.addEventListener?.("change", onScheme);
    removers.push(() => schemeQuery.removeEventListener?.("change", onScheme));
  }
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

  // Floating "Now" widget (ui_panels), drawn as an orrery. Shown whenever a chat
  // is open and the widget is switched on. The pill opens into the Now window
  // (sky, forecast, a rail of tabs); its book button opens the full drawer. It
  // sizes itself to what it shows. The tab, and which replies' changes the player
  // has seen, are remembered in this browser.
  let hud: ReturnType<SpindleFrontendContext["ui"]["createFloatWidget"]> | null = null;
  let hudOn = true;
  let hudOpen = false;
  const hudUi: HudUi = { tab: "changed", narr: false, unseen: 0, opened: new Set() };
  let seen: Record<string, number> = {};
  let thoughtsMsg = -1;
  const load = (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null; /* private mode */
    }
  };
  const save = (k: string, val: string) => {
    try {
      localStorage.setItem(k, val);
    } catch {
      /* ignore */
    }
  };
  hudOpen = load("alm-hud-open") === "1";
  hudUi.tab = load("alm-hud-tab") || "changed";
  try {
    const sz = JSON.parse(load("alm-hud-size") || "null");
    if (sz && Number.isFinite(sz.w) && Number.isFinite(sz.h)) hudUi.size = { w: sz.w, h: sz.h };
  } catch {
    /* default size */
  }
  // The window never outgrows the screen, whatever size was saved on a bigger one.
  const fitSize = (w: number, h: number) => {
    const vw = typeof innerWidth === "number" && innerWidth > 0 ? innerWidth - 16 : HUD_SIZE.maxW;
    const vh = typeof innerHeight === "number" && innerHeight > 0 ? innerHeight - 16 : HUD_SIZE.maxH;
    const clamp = (x: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, x)));
    return { w: clamp(w, Math.min(HUD_SIZE.minW, vw), Math.min(HUD_SIZE.maxW, vw)), h: clamp(h, Math.min(HUD_SIZE.minH, vh), Math.min(HUD_SIZE.maxH, vh)) };
  };
  try {
    seen = JSON.parse(load("alm-hud-seen") || "{}") ?? {};
  } catch {
    seen = {};
  }
  const markSeen = (v: any) => {
    const msg = v?.changes?.msg ?? -1;
    if (!v?.chatId || msg < 0 || seen[v.chatId] === msg) return;
    seen[v.chatId] = msg;
    const keys = Object.keys(seen);
    if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete seen[k];
    save("alm-hud-seen", JSON.stringify(seen));
  };
  const setHudOpen = (open: boolean) => {
    // Opening after a reply changed things starts on what changed.
    if (open && hudUi.unseen) hudUi.tab = "changed";
    hudOpen = open;
    save("alm-hud-open", open ? "1" : "0");
    renderHud(app.view);
  };
  const onHudAction = (target: EventTarget | null) => {
    const el = (target as HTMLElement | null)?.closest?.("[data-hud]") as HTMLElement | null;
    if (!el) return;
    const v = app.view;
    const live = v && v.chatId === ctx.getActiveChat().chatId && v.enabled;
    const act = el.dataset.hud;
    if (act === "open" || !live) {
      tab.activate();
      return;
    }
    if (act === "tab" && el.dataset.tab) {
      hudUi.tab = el.dataset.tab;
      save("alm-hud-tab", hudUi.tab);
    } else if (act === "narr") hudUi.narr = !hudUi.narr;
    else if (act === "env" && el.dataset.key) {
      if (hudUi.opened.has(el.dataset.key)) hudUi.opened.delete(el.dataset.key);
      else hudUi.opened.add(el.dataset.key);
    } else if (act === "toggle") return setHudOpen(!hudOpen);
    renderHud(v);
  };
  const ensureHud = (on: boolean) => {
    hudOn = on;
    try {
      if (on && !hud) {
        hud = ctx.ui.createFloatWidget({ width: 260, height: 40, initialPosition: { x: 24, y: 88 }, snapToEdge: true, chromeless: true });
        hud.root.addEventListener("click", (ev) => onHudAction(ev.target));
        // The corner grip resizes the window. Lumiverse leaves a press alone when it's
        // defaultPrevented, so the grip doesn't also drag the widget.
        hud.root.addEventListener("pointerdown", (ev) => {
          const pe = ev as PointerEvent;
          const grip = (pe.target as HTMLElement | null)?.closest?.("[data-hud-grip]");
          const card = hud?.root.querySelector(".alm-hudc") as HTMLElement | null;
          if (!grip || !card || pe.button !== 0) return;
          pe.preventDefault();
          pe.stopPropagation();
          const start = { x: pe.clientX, y: pe.clientY, ...fitSize(hudUi.size?.w ?? HUD_SIZE.w, hudUi.size?.h ?? HUD_SIZE.h) };
          let next = { w: start.w, h: start.h };
          let frame = 0;
          const onMove = (e: PointerEvent) => {
            next = fitSize(start.w + e.clientX - start.x, start.h + e.clientY - start.y);
            if (frame) return;
            frame = requestAnimationFrame(() => {
              frame = 0;
              card.style.width = `${next.w}px`;
              card.style.height = `${next.h}px`;
              hud?.setSize(next.w, next.h);
            });
          };
          const onUp = () => {
            removeEventListener("pointermove", onMove);
            removeEventListener("pointerup", onUp);
            removeEventListener("pointercancel", onUp);
            if (frame) cancelAnimationFrame(frame);
            hudUi.size = next;
            save("alm-hud-size", JSON.stringify(next));
            renderHud(app.view);
          };
          addEventListener("pointermove", onMove);
          addEventListener("pointerup", onUp);
          addEventListener("pointercancel", onUp);
        });
        hud.root.addEventListener("dblclick", (ev) => {
          if (!(ev.target as HTMLElement | null)?.closest?.("[data-hud-grip]")) return;
          hudUi.size = undefined;
          save("alm-hud-size", "null");
          renderHud(app.view);
        });
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
    const live = v && v.chatId === chatId;
    if (live) {
      const msg = v.changes?.msg ?? -1;
      hudUi.unseen = msg >= 0 && msg !== seen[chatId] ? (v.changes?.rows?.length ?? 0) : 0;
      // A new reply's thoughts arrive sealed.
      if ((v.thoughts?.msg ?? -1) !== thoughtsMsg) {
        thoughtsMsg = v.thoughts?.msg ?? -1;
        hudUi.opened.clear();
      }
    }
    if (!live) html = hudPill(null, app.status === "stalled" ? "no answer yet" : "connecting…");
    else if (!v.enabled) html = hudPill(null, "off in this chat");
    else if (hudOpen) {
      const fit = fitSize(hudUi.size?.w ?? HUD_SIZE.w, hudUi.size?.h ?? HUD_SIZE.h);
      html = hudCard(v, { ...hudUi, size: fit });
      markSeen(v);
      if (html === lastHud) return;
      lastHud = html;
      hud.root.innerHTML = html;
      hud.setSize(fit.w, fit.h);
      return;
    } else html = hudPill(v, undefined, hudUi);
    if (html === lastHud) return;
    lastHud = html;
    hud.root.innerHTML = html;
    const size = measure(html);
    hud.setSize(Math.min(480, Math.max(120, size.w || 260)), Math.max(44, Math.min(640, size.h || 44)));
  };

  // The drawer tab's badge counts only Engine findings not yet looked at, and its
  // tooltip (the tab title) says what they are.
  let badgeSig = "";
  const syncBadge = () => {
    const v = app.view;
    const seen = app.seenSet();
    const count = v ? engineNew(v, seen) : 0;
    const why = count ? attentionNote("engine", v, seen) : "";
    if (`${count}|${why}` === badgeSig) return;
    badgeSig = `${count}|${why}`;
    tab.setBadge(count ? String(count > 9 ? "9+" : count) : null);
    tab.setTitle?.(why ? `ALMANAC Ledger · ${why}` : "ALMANAC Ledger");
  };
  app.onSeen = () => {
    syncBadge();
    app.render();
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
      skin = v.theme || "almanac";
      document.documentElement.setAttribute("data-alm-skin", skin);
      if (fontsOn && fontSkin !== skin) setFonts(true);
      const pref = v.settings?.skinMode ?? "auto";
      if (pref !== modePref) {
        modePref = pref;
        applyMode();
      }
      applyCustom(v.settings?.skinColors);
      if (v.speakerCss !== lastSpeakerCss) {
        speakerStyle?.();
        speakerStyle = v.speakerCss ? ctx.dom.addStyle(v.speakerCss) : null;
        lastSpeakerCss = v.speakerCss;
      }
      if (v.settings && v.settings.fonts !== fontsOn) setFonts(!!v.settings.fonts);
      if (v.settings && !!v.settings.hud !== hudOn) ensureHud(!!v.settings.hud);
    }
    syncBadge();
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
          // The host's toast wasn't available: show it at the top of the drawer instead of only in the console.
          console.info(`[ALMANAC] ${m.text}`);
          app.notice = { tone: String(m.tone ?? "info"), text: String(m.text ?? ""), at: Date.now() };
          app.render();
          break;
        case "clerkProgress":
          if (app.view?.chatId !== m.chatId) return;
          app.clerkProgress = m.done >= m.total ? "" : `${m.done}/${m.total}`;
          app.render();
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
    if (p && "skinMode" in p) {
      modePref = p.skinMode || "auto";
      applyMode();
    }
  }));

  // A colour picker in Settings › Look, live while it's dragged.
  removers.push(ctx.events.on("almanac:skinColors", (p: any) => applyCustom(p)));

  // Command button in the input bar's Extras popover.
  try {
    const action = ctx.ui.registerInputBarAction({ id: "almanac-command", label: "Almanac command…", iconSvg: ICON.replace(/20/g, "14") });
    removers.push(action.onClick(async () => {
      try {
        const res = await ctx.ui.showContextMenu({ items: COMMANDS.map(([key, label]) => ({ key, label })), position: { x: Math.round(window.innerWidth / 2), y: window.innerHeight - 120 } });
        const key = res?.selectedKey;
        if (key) insertIntoComposer(key);
      } catch {
        /* no menu on this host: nothing is inserted */
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
    customStyle?.();
    fontStyle?.();
    if (retry) clearTimeout(retry);
    hud?.destroy();
    tab.destroy();
    document.documentElement.removeAttribute("data-alm-skin");
    document.documentElement.removeAttribute("data-alm-mode");
    ctx.dom.cleanup();
  };
}

/** Best effort: put a command in the chat composer (there is no official composer API). Never another text box. */
function insertIntoComposer(text: string) {
  const ta = document.querySelector<HTMLTextAreaElement>("textarea[data-chat-input], .chat-input textarea, [class*='chat-input'] textarea, [class*='composer'] textarea");
  if (!ta) {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    return;
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(ta, text);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  ta.focus();
}
