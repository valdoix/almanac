// The drawer and the floating widget against a fake frontend host: the first
// requests for state are lost (backend still starting), the frontend keeps
// asking, and the widget shows from setup instead of waiting for a view.
import { expect, test } from "bun:test";

class El {
  innerHTML = "";
  scrollTop = 0;
  listeners: Record<string, ((ev: any) => void)[]> = {};
  classList = { add() {}, remove() {} };
  addEventListener(t: string, fn: (ev: any) => void) { (this.listeners[t] ??= []).push(fn); }
  fire(t: string, target: any) { for (const fn of this.listeners[t] ?? []) fn({ target, key: "", preventDefault() {} }); }
  querySelector() { return null; }
  setAttribute() {}
  removeAttribute() {}
}
(globalThis as any).document = { documentElement: new El() };
(globalThis as any).localStorage = { getItem: () => null, setItem() {} };

test("frontend keeps asking for state and shows the widget meanwhile", async () => {
  const { setup } = await import("../src/frontend");
  const sent: any[] = [];
  const onBackend: ((m: unknown) => void)[] = [];
  const hud = { root: new El(), visible: false, size: [0, 0], setVisible(v: boolean) { this.visible = v; }, setSize(w: number, h: number) { this.size = [w, h]; }, destroy() {} };
  const tabRoot = new El();
  let opened = 0;
  const ctx: any = {
    dom: { addStyle: () => () => {}, cleanup() {} },
    ui: {
      registerDrawerTab: () => ({ root: tabRoot, activate() { opened++; }, setBadge() {}, onActivate() {}, destroy() {} }),
      createFloatWidget: () => hud,
      registerInputBarAction: () => { throw new Error("n/a"); },
    },
    events: { on: () => () => {}, emit() {} },
    getActiveChat: () => ({ chatId: "c1", characterId: null }),
    sendToBackend: (m: any) => {
      sent.push(m);
      if (sent.length >= 3) setTimeout(() => onBackend.forEach((h) => h({ type: "state", view: VIEW })), 0);
    },
    onBackendMessage: (h: any) => { onBackend.push(h); return () => {}; },
    permissions: { request: async () => [] },
  };
  let VIEW: any = { chatId: "c1", enabled: false, settings: { hud: true, fonts: true }, counts: {}, now: {}, cast: [] };
  const stop = setup(ctx);
  expect(hud.visible).toBe(true);
  expect(hud.root.innerHTML).toContain("connecting");
  expect(tabRoot.innerHTML).toContain("Reading this chat");
  await new Promise((r) => setTimeout(r, 3300));
  expect(sent.length).toBeGreaterThanOrEqual(3);
  expect(sent[0].type).toBe("hello");
  expect(hud.root.innerHTML).toContain("off in this chat");
  expect(tabRoot.innerHTML).toContain("not active in this chat");
  const before = sent.length;
  await new Promise((r) => setTimeout(r, 2500));
  expect(sent.length).toBe(before); // stops asking once answered

  // Clicking the "off" pill opens the drawer.
  const hit = (sel: string) => ({ closest: (q: string) => (q === "[data-hud]" ? { dataset: { hud: sel } } : null) });
  hud.root.fire("click", hit("toggle"));
  expect(opened).toBe(1);

  // Live: the pill opens the Now window, whose button opens the drawer.
  VIEW = { ...VIEW, enabled: true, now: { time: "21:49", clock: "Tuesday 14 October, 21:49", weather: { glyph: "☁", condition: "overcast" }, place: ["Forest", "wooded section"], band: "evening" }, cast: [{ name: "Bea", tier: "spot", color: "#c33", mood: { name: "wary" } }], world: { cons: [] } };
  onBackend.forEach((h) => h({ type: "state", view: VIEW }));
  expect(hud.root.innerHTML).toContain("wooded section");
  expect(hud.size[0]).toBeGreaterThan(200); // sized to its content, not a fixed 300 that clips
  hud.root.fire("click", hit("toggle"));
  expect(hud.root.innerHTML).toContain("alm-hudc");
  expect(hud.root.innerHTML).toContain("Open the Almanac");
  hud.root.fire("click", hit("open"));
  expect(opened).toBe(2);
  hud.root.fire("click", hit("toggle"));
  expect(hud.root.innerHTML).toContain("alm-hudw");
  stop();
}, 10000);

test("the player's colours repaint one skin and mode, and nothing unsafe gets through", async () => {
  const { customCss } = await import("../src/frontend/skins");
  expect(customCss(undefined)).toBe("");
  const css = customCss({
    candy: { light: { accent: "#FFD21F", ink: "#102030", panel: "red;} body{display:none", bogus: "#000000" } },
    nocturne: { dark: { accent: "#301020" }, light: {} },
    "x]{}": { light: { ink: "#000000" } },
  });
  expect(css.split("\n")).toEqual([
    `html:root[data-alm-skin="candy"][data-alm-mode="light"]{--alm-ink:#102030;--alm-accent:#ffd21f;--alm-on-accent:#15120f;--alm-pop:#102030;}`,
    `html:root[data-alm-skin="nocturne"][data-alm-mode="dark"]{--alm-accent:#301020;--alm-on-accent:#fff;}`,
  ]);
});
