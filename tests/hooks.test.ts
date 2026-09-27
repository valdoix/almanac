// Integration test against a fake Spindle host: the preset's handshake and
// charter arm the chat, the prompt interceptor strips the handshake and injects
// the ledger note before the player's message, macros report linked state, and
// the render processor swaps the ledger for a compiled drawer with the desk.
import { beforeAll, describe, expect, test } from "bun:test";
import { OPENING, SAMPLE_REPLY, SAMPLE_USER } from "../preset/fixtures";

const files = new Map<string, string>();
const macros = new Map<string, string>();
const chatVars = new Map<string, string>();
const hooks: Record<string, any> = {};
const sent: any[] = [];
const CHAT = "chat-1";
const USER = "user-1";

const messages = [OPENING, SAMPLE_USER, SAMPLE_REPLY].map((content, i) => ({
  id: `m${i}`, chat_id: CHAT, index_in_chat: i, is_user: i === 1, name: i === 1 ? "Wren" : "Mara", content, swipes: [content], swipe_id: 0, extra: {}, send_date: 1_700_000_000 + i * 60, created_at: 1_700_000_000 + i * 60,
}));

/** Any API the test doesn't care about resolves to undefined (or an empty list). */
function loose(path: string): any {
  return new Proxy(function () {}, {
    get: (_t, k) => (k === "then" ? undefined : loose(`${path}.${String(k)}`)),
    apply: () => (/\.(list|getActivated|getGlobal)$/.test(path) ? Promise.resolve([]) : Promise.resolve(undefined)),
  });
}

const spindle: any = new Proxy({
  permissions: { has: () => true, getGranted: () => ["interceptor", "context_handler", "generation", "chats", "chat_mutation", "world_books", "characters", "personas", "tools", "ui_panels"] },
  log: { info: () => {}, warn: () => {}, error: () => {} },
  userStorage: {
    exists: async (p: string) => files.has(p),
    getJson: async (p: string, o: any) => (files.has(p) ? JSON.parse(files.get(p)!) : o?.fallback),
    setJson: async (p: string, v: unknown) => void files.set(p, JSON.stringify(v)),
    read: async (p: string) => files.get(p) ?? "",
    write: async (p: string, t: string) => void files.set(p, t),
  },
  chat: { getMessages: async () => messages, setMessagesHidden: async () => {} },
  chats: { get: async () => ({ id: CHAT, character_id: "char-1", metadata: {} }), getActive: async () => ({ id: CHAT }), update: async () => {} },
  characters: { get: async () => ({ id: "char-1", name: "Mara", description: "A dockside fence with a temper." }), update: async () => {} },
  personas: { getActive: async () => ({ id: "p1", name: "Wren" }), get: async () => ({ id: "p1", name: "Wren" }) },
  variables: { chat: { set: async (_c: string, k: string, v: string) => void chatVars.set(k, v), delete: async (_c: string, k: string) => void chatVars.delete(k) } },
  registerMacro: () => {},
  updateMacroValue: (n: string, v: string) => void macros.set(n, v),
  registerInterceptor: (fn: any) => void (hooks.prompt = fn),
  registerContextHandler: (fn: any) => void (hooks.context = fn),
  registerWorldInfoInterceptor: (fn: any) => void (hooks.wi = fn),
  registerMessageContentProcessor: (fn: any) => void (hooks.render = fn),
  generate: { quiet: async () => { throw new Error("no model in tests"); } },
  on: () => () => {},
  sendToFrontend: (p: unknown) => void sent.push(p),
  onFrontendMessage: (fn: any) => void (hooks.frontend = fn),
}, { get: (t: any, k: string) => (k in t ? t[k] : loose(k)) });

let parse: (s: string) => any;

beforeAll(async () => {
  (globalThis as any).spindle = spindle;
  const h = await import("../src/backend/hooks");
  const m = await import("../src/backend/macros");
  parse = (await import("../src/core/dsl")).parseMessage;
  m.registerMacros();
  h.registerContextHandler();
  h.registerWorldInfoInterceptor();
  h.registerPromptInterceptor();
  h.registerRenderProcessor();
  (await import("../src/backend/bridge")).registerBridge();
});

const CHARTER = "<almanac>\nYou are ALMANAC: narrator, director, and every living person in this story except Wren.\n</almanac>";
const HANDSHAKE = `<almanac-config persona="sealed" thoughts="0" genres="mystery, romance" lead="mystery" nsfw="fade" romance="slow" dialogue="adaptive" style="blocks" cot="native" ledger="full" trackers="scene, cast, bonds, thoughts, inventory, threads, knowledge" view="drawer" theme="auto"/>`;

describe("extension hooks with the preset", () => {
  test("interceptor arms the chat, strips the handshake and injects the ledger note", async () => {
    await hooks.context({ chatId: CHAT, userId: USER, generationType: "normal" });
    const prompt = [
      { role: "system", content: `${CHARTER}\n${HANDSHAKE}` },
      { role: "assistant", content: OPENING },
      { role: "user", content: SAMPLE_USER },
      { role: "assistant", content: SAMPLE_REPLY },
      { role: "user", content: "I tell Kael to put the glass down." },
    ];
    const res = await hooks.prompt(prompt, { chatId: CHAT, userId: USER, generationType: "normal" });
    const out = Array.isArray(res) ? res : res.messages;
    const all = out.map((m: any) => (typeof m.content === "string" ? m.content : "")).join("\n");
    expect(all).not.toContain("<almanac-config");
    expect(all).toContain("<almanac>");
    const noteIdx = out.findIndex((m: any) => m.role === "system" && /\[NOW\]/.test(m.content));
    expect(noteIdx).toBeGreaterThan(0);
    expect(out[noteIdx + 1].role).toBe("user");
    expect(out[noteIdx].content).toMatch(/<ledger-note>/);
    expect(res.breakdown?.some((b: any) => b.name === "ALMANAC · Now")).toBe(true);
    await new Promise((r) => setTimeout(r, 1200)); // saves are debounced
    const metaKey = [...files.keys()].find((k) => k.includes(CHAT) && /meta/.test(k));
    expect(metaKey).toBeDefined();
    const meta = JSON.parse(files.get(metaKey!)!);
    expect(meta.enabled).toBe(true);
    expect(meta.detected.lead).toBe("mystery");
  });

  test("macros report the linked state the preset branches on", async () => {
    await hooks.context({ chatId: CHAT, userId: USER, generationType: "normal" });
    expect(macros.get("almActive")).toBe("yes");
    expect(macros.get("almMode")).toBe("conflict");
    expect(macros.get("almVoices")).toContain("Mara#");
    expect(macros.get("almClock")).toContain("21:40");
    // The header said "Day 3 · Tuesday, 14 October 1923": the almanac agrees on Day 3.
    expect(macros.get("almClock")).toContain("Tuesday 14 October 1923");
  });

  test("render processor swaps the ledger for a drawer as of that message, with the desk on the latest", async () => {
    const latest = await hooks.render({ chatId: CHAT, userId: USER, messageId: "m2", content: SAMPLE_REPLY, isUser: false, origin: "render" });
    expect(latest.content).not.toContain("<ledger>");
    expect(latest.content).toContain("alm-drawer");
    expect(latest.content).toContain("[[alm-desk]]");
    expect(latest.content).toMatch(/🗓[^\n]*⟪\d{2}:\d{2}\|\d{2}:\d{2}\|[^⟫]+⟫/u);
    const older = await hooks.render({ chatId: CHAT, userId: USER, messageId: "m0", content: OPENING, isUser: false, origin: "render" });
    expect(older.content).toContain("alm-drawer");
    expect(older.content).not.toContain("[[alm-desk]]");
    // The older drawer shows the world as it was: Mara still guarded, no locket hand-over yet.
    expect(older.content).toContain("guarded");
    expect(older.content).not.toContain("wary-curious");
  });

  test("the sample reply is a valid ledger with mode last", () => {
    const p = parse(SAMPLE_REPLY);
    expect(p.unknown).toEqual([]);
    expect(p.ops.at(-1).op).toBe("mode");
  });

  test("the drawer's hello gets a state view the host can post (structured-clone safe)", async () => {
    sent.length = 0;
    await hooks.frontend({ type: "hello", chatId: CHAT }, USER);
    const st = sent.find((m) => m?.type === "state");
    expect(st?.view?.chatId).toBe(CHAT);
    expect(() => structuredClone(st)).not.toThrow();
  });

  test("speech labelled Name#N|tone: becomes a speaker mark on display and in the history the model reads", async () => {
    const labelled = SAMPLE_REPLY.replace(`[spk=Joss#3]"I'll just— the cart."[/spk]`, `Joss#3|flat: "I'll just— the cart."`);
    expect(labelled).toContain("Joss#3|flat:");
    const shown = await hooks.render({ chatId: CHAT, userId: USER, messageId: "m2", content: labelled, isUser: false, origin: "render" });
    expect(shown.content).toContain(`[spk=Joss#3|flat]"I'll just— the cart."[/spk]`);
    expect(shown.content).not.toContain("Joss#3|flat:");
    const res = await hooks.prompt([
      { role: "system", content: CHARTER },
      { role: "assistant", content: `Buffy#1|flat: "Great. Another one."` },
      { role: "user", content: "I shrug." },
    ], { chatId: CHAT, userId: USER, generationType: "normal" });
    const out = Array.isArray(res) ? res : res.messages;
    const hist = out.find((m: any) => m.role === "assistant");
    expect(hist.content).toBe(`[spk=Buffy#1|flat]"Great. Another one."[/spk]`);
  });

  test("a turn that went out without the note shows in the drawer until a plan works again", async () => {
    const { notePlanError } = await import("../src/backend/turn");
    const { buildView } = await import("../src/backend/view");
    await notePlanError(CHAT, USER, new TypeError("undefined is not an object"), "planning the turn", "normal");
    const v = await buildView(CHAT, USER);
    expect(v?.planError?.message).toBe("undefined is not an object");
    expect(v?.planError?.where).toBe("planning the turn");
    const { hudPill, hudCard } = await import("../src/frontend/hud");
    expect(hudPill(v)).toContain("alm-hudw__err");
    expect(hudCard(v)).toContain("undefined is not an object");
    await hooks.context({ chatId: CHAT, userId: USER, generationType: "normal" });
    expect((await buildView(CHAT, USER))?.planError).toBeNull();
  });
});

test("tidying a whole chat reads only what the clerk hasn't read in its current text", async () => {
  const { unreadReplies } = await import("../src/backend/clerk");
  const { hash } = await import("../src/core/util");
  const led = (s: string) => `${s}\n<ledger>\nmode: social\n</ledger>`;
  const path = [
    { id: "a", index: 0, isUser: false, content: led("one"), swipe: 0 },
    { id: "b", index: 1, isUser: true, content: "player", swipe: 0 },
    { id: "c", index: 2, isUser: false, content: led("two"), swipe: 0 },
    { id: "d", index: 3, isUser: false, content: led("three"), swipe: 1 },
    { id: "e", index: 4, isUser: false, content: led("four"), swipe: 0 },
    { id: "f", index: 5, isUser: false, content: "no ledger", swipe: 0 },
  ];
  const meta: any = { clerked: {
    "a:0": { hash: hash(led("one")), result: "ok" },
    "c:0": { hash: hash(led("two, before an edit")), result: "ok" },
    "d:0": { hash: hash(led("three")), result: "clean" }, // another swipe
    "e:0": { hash: hash(led("four")), result: "failed" },
  } };
  expect(unreadReplies(path, meta).map((m) => m.id)).toEqual(["c", "d", "e"]);
  expect(unreadReplies(path, { clerked: {} } as any).map((m) => m.id)).toEqual(["a", "c", "d", "e"]);
});
