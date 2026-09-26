// The drawer and the floating widget against a fake frontend host: the first
// requests for state are lost (backend still starting), the frontend keeps
// asking, and the widget shows from setup instead of waiting for a view.
import { expect, test } from "bun:test";

class El {
  innerHTML = "";
  scrollTop = 0;
  classList = { add() {}, remove() {} };
  addEventListener() {}
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
  const ctx: any = {
    dom: { addStyle: () => () => {}, cleanup() {} },
    ui: {
      registerDrawerTab: () => ({ root: tabRoot, activate() {}, setBadge() {}, onActivate() {}, destroy() {} }),
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
  const VIEW = { chatId: "c1", enabled: false, settings: { hud: true, fonts: true }, counts: {}, now: {}, cast: [] };
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
  stop();
}, 10000);
