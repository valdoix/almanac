// ALMANAC Ledger — frontend entry. Injects the stylesheet (with live speaker
// colours and the active skin), registers the "Almanac" drawer tab, the floating
// Now widget, a command button in the input bar, and Session Zero.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { AlmanacApp } from "./frontend/app";
import { MESSAGE_CSS, PANEL_CSS, TOKENS } from "./frontend/styles";
import { SKIN_CSS, customCss, fontCss, fontsFor, pickedFontImports } from "./frontend/skins";
import type { SkinFonts } from "./core/types";
import { openSessionZero } from "./frontend/sessionzero";
import { HUD_SIZE, hasThoughtsTab, hudCard, hudPill, hudTab, measure, type HudUi } from "./frontend/hud";
import { HUD_CSS } from "./frontend/hudstyles";
import { DRAWER_CSS } from "./frontend/drawerstyles";
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
  let fontKey = "";
  let fontPicks: SkinFonts = {};
  // Web fonts: the base set, the active skin's and the ones the player picked for it; swapped when any changes.
  const setFonts = (on: boolean) => {
    const css = fontsFor(skin) + "\n" + pickedFontImports(skin, fontPicks);
    if (fontStyle && (!on || fontKey !== css)) {
      fontStyle();
      fontStyle = null;
    }
    if (on && !fontStyle) {
      fontStyle = ctx.dom.addStyle(css);
      fontKey = css;
    }
    fontsOn = on;
  };
  setFonts(true);
  removers.push(ctx.dom.addStyle(TOKENS + SKIN_CSS + MESSAGE_CSS + PANEL_CSS + DRAWER_CSS + HUD_CSS));
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
  // The player's fonts and sizes, likewise.
  let pickStyle: (() => void) | null = null;
  let lastPicks = "";
  const applyFontPicks = (picks: unknown) => {
    fontPicks = picks && typeof picks === "object" ? (picks as SkinFonts) : {};
    const css = fontCss(fontPicks);
    if (css !== lastPicks) {
      pickStyle?.();
      pickStyle = css ? ctx.dom.addStyle(css) : null;
      lastPicks = css;
    }
    if (fontsOn) setFonts(true);
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
    // The Soundtrack's view too, for the HUD's song line and Session Zero's music row.
    if (attempt === 0) app.soundtrack.send("get");
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
  const loadJson = (k: string) => {
    try {
      return JSON.parse(load(k) || "null");
    } catch {
      return null;
    }
  };
  hudOpen = load("alm-hud-open") === "1";
  hudUi.tab = load("alm-hud-tab") || "changed";
  const sz = loadJson("alm-hud-size");
  if (sz && Number.isFinite(sz.w) && Number.isFinite(sz.h)) hudUi.size = { w: sz.w, h: sz.h };
  // Lumiverse lays widgets out in its zoom layer: screen pixels divided by the UI scale.
  const uiScale = () => {
    try {
      const s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--lumiverse-ui-scale"));
      return Number.isFinite(s) && s > 0 ? s : 1;
    } catch {
      return 1;
    }
  };
  const viewport = () => {
    const s = uiScale();
    return { w: (typeof innerWidth === "number" && innerWidth > 0 ? innerWidth : 1440) / s, h: (typeof innerHeight === "number" && innerHeight > 0 ? innerHeight : 900) / s };
  };
  // The window never outgrows the screen (the host keeps 12px clear on each side), whatever size was saved on a bigger one.
  const fitSize = (w: number, h: number) => {
    const vp = viewport();
    const vw = vp.w - 24;
    const vh = vp.h - 24;
    const clamp = (x: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, x)));
    return { w: clamp(w, Math.min(HUD_SIZE.minW, vw), Math.min(HUD_SIZE.maxW, vw)), h: clamp(h, Math.min(HUD_SIZE.minH, vh), Math.min(HUD_SIZE.maxH, vh)) };
  };
  seen = loadJson("alm-hud-seen") ?? {};
  const markSeen = (v: any) => {
    const msg = v?.changes?.msg ?? -1;
    if (!v?.chatId || msg < 0 || seen[v.chatId] === msg) return;
    seen[v.chatId] = msg;
    const keys = Object.keys(seen);
    if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete seen[k];
    save("alm-hud-seen", JSON.stringify(seen));
  };
  // Which reply's thoughts the player has looked at, and which seals they broke, per chat:
  // a reload or a chat switch doesn't reseal them or bring the Unspoken dot back.
  const thoughtsRead: Record<string, { m: number; v?: 1; o?: number[] }> = loadJson("alm-hud-thoughts") ?? {};
  let thoughtsKey = "";
  const syncThoughts = (chatId: string, v: any) => {
    const m = v.thoughts?.msg ?? -1;
    const rec = thoughtsRead[chatId]?.m === m ? thoughtsRead[chatId] : null;
    if (`${chatId}|${m}` !== thoughtsKey) {
      thoughtsKey = `${chatId}|${m}`;
      hudUi.opened = new Set((rec?.o ?? []).map((i) => `${m}:${i}`));
    }
    hudUi.thoughtsSeen = !!rec?.v;
  };
  const saveThoughts = (chatId: string, v: any, viewed: boolean) => {
    const m = v?.thoughts?.msg ?? -1;
    if (!chatId || m < 0) return;
    const was = thoughtsRead[chatId]?.m === m ? thoughtsRead[chatId] : null;
    const o = [...hudUi.opened].filter((k) => k.startsWith(`${m}:`)).map((k) => +k.slice(k.indexOf(":") + 1));
    const next = { m, ...(viewed || was?.v ? { v: 1 as const } : {}), ...(o.length ? { o } : {}) };
    if (JSON.stringify(next) === JSON.stringify(was)) return;
    delete thoughtsRead[chatId];
    thoughtsRead[chatId] = next;
    const keys = Object.keys(thoughtsRead);
    if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete thoughtsRead[k];
    save("alm-hud-thoughts", JSON.stringify(thoughtsRead));
    hudUi.thoughtsSeen = !!next.v;
  };

  // Docking: the widget can sit against the left or right edge of the screen. Closed,
  // it is a slim tab there; drag the tab along the edge to move it, across the
  // screen to the other edge, or away from the edges to float the widget again.
  // Opened, the window opens against that edge. Remembered in this browser.
  type Dock = { edge: "left" | "right"; y: number; from?: { x: number; y: number } };
  let dock: Dock | null = null;
  const d0 = loadJson("alm-hud-dock");
  if (d0 && (d0.edge === "left" || d0.edge === "right") && Number.isFinite(d0.y)) {
    dock = { edge: d0.edge, y: d0.y, ...(d0.from && Number.isFinite(d0.from.x) && Number.isFinite(d0.from.y) ? { from: { x: d0.from.x, y: d0.from.y } } : {}) };
  }
  const saveDock = () => save("alm-hud-dock", JSON.stringify(dock));
  const DOCK_ZONE = 96;
  let hudBox = { w: 260, h: 40 };
  let hudMode = "";
  const sizeHud = (w: number, h: number) => {
    hudBox = { w, h };
    hud?.setSize(w, h);
  };
  // Against its edge, at the tab's height (the host clamps it onto the screen).
  const placeDock = () => {
    if (!hud || !dock) return;
    const vp = viewport();
    const x = dock.edge === "left" ? 0 : Math.max(0, Math.round(vp.w - hudBox.w));
    const y = Math.max(0, Math.round(Math.min(dock.y, vp.h - hudBox.h - 12)));
    const p = hud.getPosition?.();
    if (!p || p.x !== x || p.y !== y) hud.moveTo(x, y);
  };
  const toggleDock = () => {
    if (!hud) return;
    const p = hud.getPosition?.() ?? { x: 24, y: 88 };
    if (dock) {
      const back = dock.from ?? { x: dock.edge === "left" ? 24 : Math.max(12, viewport().w - hudBox.w - 36), y: dock.y };
      dock = null;
      saveDock();
      hud.moveTo(back.x, back.y);
      lastHud = "";
      renderHud(app.view);
      return;
    }
    const vp = viewport();
    dock = { edge: p.x + hudBox.w / 2 < vp.w / 2 ? "left" : "right", y: p.y, from: { x: p.x, y: p.y } };
    saveDock();
    setHudOpen(false);
  };
  const setHudOpen = (open: boolean) => {
    // Opening after a reply changed things starts on what changed.
    if (open && hudUi.unseen) hudUi.tab = "changed";
    hudOpen = open;
    save("alm-hud-open", open ? "1" : "0");
    renderHud(app.view);
  };
  let swallowClick = false;
  const onHudAction = (target: EventTarget | null) => {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    const el = (target as HTMLElement | null)?.closest?.("[data-hud]") as HTMLElement | null;
    if (!el) return;
    const v = app.view;
    const live = v && v.chatId === ctx.getActiveChat().chatId && v.enabled;
    const act = el.dataset.hud;
    if (act === "dock") return toggleDock();
    if (act === "music") {
      const m = el.dataset.m;
      if (m === "open") {
        tab.activate();
        app.go("soundtrack");
      } else if (m === "pause" || m === "play" || m === "skip" || m === "start" || m === "stop") app.soundtrack.send(m);
      else if (m === "hold" || m === "release") app.soundtrack.send("hold", { on: m === "hold" });
      else if (m === "never") app.soundtrack.send("never", { videoId: app.soundtrack.view?.np?.videoId });
      else if (m === "up" || m === "down") {
        app.soundtrack.rate(m === "up" ? 1 : -1);
        renderHud(app.view);
      } else if (m === "moods") {
        app.soundtrack.moodMenu = !app.soundtrack.moodMenu;
        renderHud(app.view);
      } else if (m === "mood") {
        const pick = el.dataset.mood || null;
        app.soundtrack.moodMenu = false;
        app.soundtrack.send("mood", { mood: pick });
        if (app.soundtrack.view) app.soundtrack.view.moodPick = pick;
        renderHud(app.view);
      }
      return;
    }
    if (act === "toggle" && el.dataset.hudTab != null) return setHudOpen(true);
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
      saveThoughts(v.chatId, v, true);
    } else if (act === "toggle") return setHudOpen(!hudOpen);
    renderHud(v);
  };
  // The docked tab moves itself: along the edge, across to the other edge, or (let go
  // away from the edges) floating again. Lumiverse leaves a defaultPrevented press alone.
  const dragTab = (pe: PointerEvent, el: HTMLElement) => {
    if (!hud || !dock) return;
    pe.preventDefault();
    pe.stopPropagation();
    const s = uiScale();
    const start = { x: pe.clientX, y: pe.clientY, top: Math.max(0, Math.min(dock.y, viewport().h - hudBox.h - 12)) };
    let moved = false;
    let frame = 0;
    let at = { free: false, edge: dock.edge, x: 0, y: start.top };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pe.pointerId) return;
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 4) return;
      if (!moved) {
        moved = true;
        el.classList.add("is-dragging");
      }
      const vp = viewport();
      const px = e.clientX / s;
      const y = Math.max(0, Math.min(vp.h - hudBox.h - 12, start.top + (e.clientY - start.y) / s));
      const free = px > DOCK_ZONE && px < vp.w - DOCK_ZONE;
      at = { free, edge: px < vp.w / 2 ? "left" : "right", x: Math.round(px - hudBox.w / 2), y: Math.round(y) };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        el.classList.toggle("is-free", at.free);
        el.classList.toggle("alm-hudt--left", at.edge === "left");
        el.classList.toggle("alm-hudt--right", at.edge === "right");
        hud?.moveTo(at.free ? at.x : at.edge === "left" ? 0 : Math.round(viewport().w - hudBox.w), at.y);
      });
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pe.pointerId) return;
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onUp);
      if (frame) cancelAnimationFrame(frame);
      el.classList.remove("is-dragging");
      if (!moved) return;
      // The click that ends a drag doesn't open the window.
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 0);
      if (at.free) {
        dock = null;
        hud?.moveTo(Math.max(0, at.x), at.y);
      } else dock = { ...dock!, edge: at.edge, y: at.y };
      saveDock();
      lastHud = "";
      hudMode = "";
      renderHud(app.view);
    };
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
    addEventListener("pointercancel", onUp);
  };
  const onResize = () => {
    if (!hud) return;
    lastHud = "";
    hudMode = "";
    renderHud(app.view);
  };
  addEventListener("resize", onResize);
  removers.push(() => removeEventListener("resize", onResize));
  const ensureHud = (on: boolean) => {
    hudOn = on;
    try {
      if (on && !hud) {
        hud = ctx.ui.createFloatWidget({ width: 260, height: 40, initialPosition: { x: 24, y: 88 }, snapToEdge: true, chromeless: true });
        hudMode = "";
        lastHud = "";
        hud.root.addEventListener("click", (ev) => onHudAction(ev.target));
        // The corner grip resizes the window. Lumiverse leaves a press alone when it's
        // defaultPrevented, so the grip doesn't also drag the widget.
        hud.root.addEventListener("pointerdown", (ev) => {
          const pe = ev as PointerEvent;
          if (pe.button !== 0) return;
          const tabEl = (pe.target as HTMLElement | null)?.closest?.("[data-hud-tab]") as HTMLElement | null;
          if (tabEl && dock) return dragTab(pe, tabEl);
          const grip = (pe.target as HTMLElement | null)?.closest?.("[data-hud-grip]");
          const card = hud?.root.querySelector(".alm-hudc") as HTMLElement | null;
          if (!grip || !card) return;
          pe.preventDefault();
          pe.stopPropagation();
          const s = uiScale();
          const start = { x: pe.clientX, y: pe.clientY, ...fitSize(hudUi.size?.w ?? HUD_SIZE.w, hudUi.size?.h ?? HUD_SIZE.h) };
          let next = { w: start.w, h: start.h };
          let frame = 0;
          const onMove = (e: PointerEvent) => {
            next = fitSize(start.w + (e.clientX - start.x) / s, start.h + (e.clientY - start.y) / s);
            if (frame) return;
            frame = requestAnimationFrame(() => {
              frame = 0;
              card.style.width = `${next.w}px`;
              card.style.height = `${next.h}px`;
              sizeHud(next.w, next.h);
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
          const target = ev.target as HTMLElement;
          if (k === "Escape" && hudOpen) setHudOpen(false);
          else if ((k === "ArrowUp" || k === "ArrowDown") && dock && target.matches?.("[data-hud-tab]")) {
            // The docked tab moves along its edge from the keyboard too.
            ev.preventDefault();
            dock = { ...dock, y: Math.max(0, Math.min(viewport().h - hudBox.h - 12, dock.y + (k === "ArrowUp" ? -24 : 24))) };
            saveDock();
            placeDock();
          } else if ((k === "Enter" || k === " ") && target.matches?.('[role="button"]')) {
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
      // A new reply's thoughts arrive sealed; ones already read stay read.
      syncThoughts(chatId, v);
    }
    hudUi.dock = dock?.edge ?? null;
    hudUi.music = app.soundtrack.hudMusic();
    const note = !live ? (app.status === "stalled" ? "no answer yet" : "connecting…") : !v.enabled ? "off in this chat" : "";
    let mode: string;
    let size: { w: number; h: number };
    if (!note && hudOpen) {
      size = fitSize(hudUi.size?.w ?? HUD_SIZE.w, hudUi.size?.h ?? HUD_SIZE.h);
      if (hudUi.tab === "unspoken" && hasThoughtsTab(v)) saveThoughts(chatId, v, true);
      html = hudCard(v, { ...hudUi, size });
      markSeen(v);
      mode = "card";
    } else if (dock) {
      html = note ? hudTab(null, dock.edge, note) : hudTab(v, dock.edge, undefined, hudUi);
      mode = "tab";
    } else {
      html = note ? hudPill(null, note) : hudPill(v, undefined, hudUi);
      mode = "pill";
    }
    if (html === lastHud) return;
    lastHud = html;
    hud.root.innerHTML = html;
    if (mode !== "card") {
      const m = measure(html);
      const maxW = Math.max(120, viewport().w - 24);
      size = mode === "tab" ? { w: 46, h: Math.max(80, Math.min(400, m.h || 160)) } : { w: Math.min(480, maxW, Math.max(120, m.w || 260)), h: Math.max(44, Math.min(640, m.h || 44)) };
    }
    sizeHud(size!.w, size!.h);
    // Docked, the tab and the window sit against the edge; placed again only when
    // that changes, so a window the player drags aside stays where they put it.
    const placeKey = dock ? `${mode}|${dock.edge}|${dock.y}|${mode === "card" ? "" : `${size!.w}x${size!.h}`}` : "";
    if (dock && placeKey !== hudMode) placeDock();
    hudMode = placeKey;
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
      if (fontsOn) setFonts(true);
      const pref = v.settings?.skinMode ?? "auto";
      if (pref !== modePref) {
        modePref = pref;
        applyMode();
      }
      applyCustom(v.settings?.skinColors);
      applyFontPicks(v.settings?.skinFonts);
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
      if (app.soundtrack.handle(m)) {
        if (m.type === "soundtrack") renderHud(app.view);
        return;
      }
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
          openSessionZero(ctx, m.chatId, cfg, app.soundtrack.viewFor(m.chatId));
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
    if (chatId) openSessionZero(ctx, chatId, app.view?.chatId === chatId ? app.view?.config : null, app.soundtrack.viewFor(chatId));
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
  // A font or size in Settings › Look, live while a slider is dragged.
  removers.push(ctx.events.on("almanac:skinFonts", (p: any) => applyFontPicks(p)));

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
