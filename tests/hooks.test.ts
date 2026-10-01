// Integration test against a fake Spindle host: the preset's handshake and
// charter arm the chat, the prompt interceptor strips the handshake and injects
// the ledger note before the player's message, macros report linked state, and
// the render processor swaps the ledger for a compiled drawer with the desk.
import { beforeAll, describe, expect, test } from "bun:test";
import { OPENING, SAMPLE_REPLY, SAMPLE_USER } from "../preset/fixtures";

const files = new Map<string, string>();
const macros = new Map<string, string>();
const macroHandlers = new Map<string, (ctx: any) => unknown>();
/** What the host would get for a macro while assembling a prompt for this chat. */
const macro = (name: string, chatId = CHAT) => String(macroHandlers.get(name)?.({ chatId }) ?? "");
const chatVars = new Map<string, string>();
const hooks: Record<string, any> = {};
const sent: any[] = [];
const CHAT = "chat-1";
const USER = "user-1";

const messages = [OPENING, SAMPLE_USER, SAMPLE_REPLY].map((content, i) => ({
  id: `m${i}`, chat_id: CHAT, index_in_chat: i, is_user: i === 1, name: i === 1 ? "Wren" : "Mara", content, swipes: [content], swipe_id: 0, extra: {}, send_date: 1_700_000_000 + i * 60, created_at: 1_700_000_000 + i * 60,
}));

function op(userId?: string) {
  if (!userId) throw new Error("userId is required for operator-scoped extensions");
}

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
  // Like Lumiverse for an operator-scoped install (as the user's is): no user id, no storage.
  userStorage: {
    exists: async (p: string, u?: string) => (op(u), files.has(p)),
    getJson: async (p: string, o: any) => (op(o?.userId), files.has(p) ? JSON.parse(files.get(p)!) : o?.fallback),
    setJson: async (p: string, v: unknown, o: any) => (op(o?.userId), void files.set(p, JSON.stringify(v))),
    read: async (p: string, u?: string) => (op(u), files.get(p) ?? ""),
    write: async (p: string, t: string, u?: string) => (op(u), void files.set(p, t)),
  },
  chat: { getMessages: async () => messages, setMessagesHidden: async () => {} },
  chats: { get: async () => ({ id: CHAT, character_id: "char-1", metadata: {} }), getActive: async () => ({ id: CHAT }), update: async () => {} },
  characters: { get: async () => ({ id: "char-1", name: "Mara", description: "A dockside fence with a temper." }), update: async () => {} },
  personas: { getActive: async () => ({ id: "p1", name: "Wren" }), get: async () => ({ id: "p1", name: "Wren" }) },
  variables: { chat: { set: async (_c: string, k: string, v: string) => void chatVars.set(k, v), delete: async (_c: string, k: string) => void chatVars.delete(k) } },
  registerMacro: (def: any) => void (typeof def.handler === "function" && macroHandlers.set(def.name, def.handler)),
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
const HANDSHAKE = `<almanac-config persona="sealed" thoughts="0" inner="register" genres="mystery, romance" lead="mystery" nsfw="fade" romance="slow" dialogue="adaptive" style="blocks" cot="native" ledger="full" trackers="scene, cast, bonds, thoughts, inventory, threads, knowledge" view="drawer" theme="auto"/>`;

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
    expect(meta.detected.innerVoice).toBe("register");
  });

  test("macros report the linked state the preset branches on", async () => {
    await hooks.context({ chatId: CHAT, userId: USER, generationType: "normal" });
    expect(macro("almActive")).toBe("yes");
    expect(macro("almMode")).toBe("conflict");
    expect(macro("almVoices")).toContain("Mara#");
    expect(macro("almClock")).toContain("21:40");
    // The header said "Day 3 · Tuesday, 14 October 1923": the almanac agrees on Day 3.
    expect(macro("almClock")).toContain("Tuesday 14 October 1923");
    // Per chat: another chat (or another user's) never reads this one's values, and nothing goes in the host's global cache.
    expect(macro("almActive", "some-other-chat")).toBe("no");
    expect(macro("almPlace", "some-other-chat")).toBe("");
    expect(macros.size).toBe(0);
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

  test("chapters go in the prompt although the turns they cover are hidden", async () => {
    const { spanSignature } = await import("../src/core/chronicle");
    const { toPath } = await import("../src/core/branch");
    const path = toPath(messages as any);
    const chronKey = [...files.keys()].find((k) => k.includes(CHAT) && /meta/.test(k))!.replace(/meta\.json$/, "chronicle.json");
    const unit = { id: "ch1", level: "chapter", no: 1, title: "The Dock", startIdx: 0, endIdx: 0, msgIds: ["m0"], signature: spanSignature(path, 0, 0), text: "Mara met Wren on the dock.", createdAt: 0 };
    files.set(chronKey, JSON.stringify({ units: [unit], hidden: ["m0"], version: 1 }));
    const { loadChat } = await import("../src/backend/store");
    (await loadChat(CHAT, USER)).chronicle = JSON.parse(files.get(chronKey)!);
    // The host leaves the hidden opening out of the prompt.
    const prompt = [
      { role: "system", content: CHARTER },
      { role: "user", content: SAMPLE_USER, __isChatHistory: true, sourceMessageId: "m1", sourceIndexInChat: 1 },
      { role: "assistant", content: SAMPLE_REPLY, __isChatHistory: true, sourceMessageId: "m2", sourceIndexInChat: 2 },
      { role: "user", content: "I tell Kael to put the glass down." },
    ];
    await hooks.context({ chatId: CHAT, userId: USER, generationType: "normal" });
    const res = await hooks.prompt(prompt, { chatId: CHAT, userId: USER, generationType: "normal" });
    const i = res.messages.findIndex((m: any) => /^\[Chapter 1: The Dock/.test(m.content));
    expect(i).toBe(1);
    // Before the first raw turn (Recall, when there is any, sits between them).
    expect(res.messages.findIndex((m: any) => m.sourceMessageId === "m1")).toBeGreaterThan(i);
    expect(res.breakdown.some((b: any) => b.name === "ALMANAC · Chapter 1")).toBe(true);
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

describe("settings and chat setup survive a restart or update", () => {
  // At boot an operator-scoped install has no user yet. Before 1.9.0 that read failed, was taken for
  // "no file", and its defaults were cached and then saved over the real settings and chat files.
  test("a read before any user is known caches nothing and overwrites nothing", async () => {
    const { loadSettings, saveSettings, loadChat, forget } = await import("../src/backend/store");
    const { DEFAULT_SETTINGS } = await import("../src/core/types");
    files.set("settings.json", JSON.stringify({ ...DEFAULT_SETTINGS, recallBudget: 5000, theme: "candy", simulator: true }));
    files.set("chats/boot-chat/meta.json", JSON.stringify({ version: 1, config: { genres: ["horror"], sessionZeroDone: true } }));

    // Boot: no user.
    expect((await loadSettings()).recallBudget).toBe(DEFAULT_SETTINGS.recallBudget);
    await expect(loadChat("boot-chat")).rejects.toThrow(/no user yet/);

    // The user arrives: their own values, not the boot defaults.
    const RESTARTED = "user-after-restart"; // nothing cached for them yet, as after an update
    const s = await loadSettings(RESTARTED);
    expect([s.recallBudget, s.theme, s.simulator]).toEqual([5000, "candy", true]);
    const chat = await loadChat("boot-chat", RESTARTED);
    expect([chat.meta.config.genres, chat.meta.config.sessionZeroDone]).toEqual([["horror"], true]);

    // Changing one setting keeps every other saved one.
    await saveSettings({ fanIn: 6 }, RESTARTED);
    expect(JSON.parse(files.get("settings.json")!)).toMatchObject({ recallBudget: 5000, theme: "candy", simulator: true, fanIn: 6 });
    // A save that can't read the file refuses rather than writing defaults.
    await expect(saveSettings({ fanIn: 7 })).rejects.toThrow();
    expect(JSON.parse(files.get("settings.json")!).fanIn).toBe(6);
    forget("boot-chat");
  });
});

describe("a Dream Weaver world card", () => {
  test("the lore scan reads the narrator card, seeds the place and carries the agenda to the simulator", async () => {
    const WORLD_CHAT = "world-chat";
    const saved = { chats: spindle.chats, characters: spindle.characters, world_books: spindle.world_books };
    const books: Record<string, any> = {
      rules: { id: "rules", name: "Saltmere rules book", description: "", metadata: { source: "weaver", weaver_role: "governance" } },
      lore: { id: "lore", name: "Saltmere lore book", description: "", metadata: { source: "weaver", weaver_role: "lore" } },
    };
    const entries: Record<string, any[]> = {
      rules: [
        { id: "r0", comment: "Weaver re-anchor", key: ["Saltmere"], constant: true, content: "Core: A fishing town that pays a tithe;…\nVoice: Salt-dry\nNow: baseline" },
        { id: "r1", comment: "Weaver governance · narrator craft", key: [], constant: true, content: "<weaver_narrator>\nYou run this place.\n</weaver_narrator>" },
        { id: "r2", comment: "Weaver agency · agenda and holds", key: [], constant: true, content: "<weaver_agency>\nAgenda: The tithe will be paid in full before the spring tide.\nHard lines that never bend:\n- No one who has read the full ledger leaves Saltmere\n</weaver_agency>" },
      ],
      lore: [{ id: "l1", comment: "The Harbour Guild", key: ["guild"], content: "Nobody crosses them." }],
    };
    try {
      spindle.chats = { ...saved.chats, get: async () => ({ id: WORLD_CHAT, character_id: "world-1", metadata: {} }) };
      spindle.characters = {
        get: async () => ({
          id: "world-1", name: "Saltmere", world_book_ids: ["rules", "lore"],
          extensions: { weaver: { source: "weaver", structured: { premise: { content: "Saltmere is a fishing town that pays a yearly tithe to something under the bay." }, central_tension: { content: "The count came back short." } } } },
        }),
      };
      spindle.world_books = {
        get: async (id: string) => books[id],
        getGlobal: async () => [],
        entries: { list: async (id: string) => ({ data: entries[id] ?? [] }) },
      };
      const { scanLore } = await import("../src/backend/lorebridge");
      const { loadChat } = await import("../src/backend/store");
      await scanLore(WORLD_CHAT, USER, true);
      const f = await loadChat(WORLD_CHAT, USER);
      expect(f.meta.lore.world).toEqual({
        name: "Saltmere",
        premise: "Saltmere is a fishing town that pays a yearly tithe to something under the bay.",
        tension: "The count came back short.",
        agenda: "The tithe will be paid in full before the spring tide.",
        holds: ["No one who has read the full ledger leaves Saltmere"],
      });
      expect(f.meta.lore.books.rules).toMatchObject({ weaver: "governance", mode: "native", kinds: { place: 1, directive: 2 }, pinned: ["r0", "r1", "r2"] });
      expect(f.meta.lore.books.lore).toMatchObject({ weaver: "lore", kinds: { group: 1 } });
      expect(f.codex.overlays["loc:saltmere"]).toMatchObject({ kind: "place", summary: "Saltmere is a fishing town that pays a yearly tithe to something under the bay.", body: { tension: "The count came back short." } });
      expect(f.codex.overlays["fac:the_harbour_guild"]?.kind).toBe("group");
    } finally {
      Object.assign(spindle, saved);
    }
  });
});

describe("release fixes against the host (1.13)", () => {
  const hiddenCalls: { ids: string[]; hidden: boolean }[] = [];
  const meta = (enabled: boolean) => JSON.stringify({ version: 1, enabled, config: { genres: [], sessionZeroDone: true, colors: {} }, detected: {}, pressures: {}, heat: {}, injected: {}, lastInjected: [], feed: [], mirror: { entries: {} }, lore: { books: {}, review: [] }, arrivals: [], repaired: {} });

  test("hidden turns follow the chat: hidden under a chapter while on, back as soon as it's switched off", async () => {
    const HC = "hide-chat";
    files.set(`chats/${HC}/meta.json`, meta(true));
    files.set(`chats/${HC}/chronicle.json`, JSON.stringify({ version: 1, units: [{ id: "c1", level: "chapter", no: 1, title: "The Dock", startIdx: 0, endIdx: 1, msgIds: ["m0", "m1"], text: "x".repeat(80), signature: "", children: [] }], hidden: [] }));
    const saved = spindle.chat;
    spindle.chat = { ...saved, setMessagesHidden: async (_c: string, ids: string[], hidden: boolean) => void hiddenCalls.push({ ids, hidden }) };
    try {
      const { syncHidden } = await import("../src/backend/ingest");
      const { loadChat } = await import("../src/backend/store");
      await syncHidden(HC, USER);
      expect(hiddenCalls.at(-1)).toEqual({ ids: ["m0", "m1"], hidden: true });
      expect((await loadChat(HC, USER)).chronicle.hidden.sort()).toEqual(["m0", "m1"]);
      // Off for this chat: the turns come back (the model would otherwise get neither them nor the chapter).
      await hooks.frontend({ type: "enable", chatId: HC, value: false }, USER);
      expect(hiddenCalls.at(-1)).toEqual({ ids: ["m0", "m1"], hidden: false });
      expect((await loadChat(HC, USER)).chronicle.hidden).toEqual([]);
      // "Release hidden turns" with the chat on shows them too, and nothing the Almanac didn't hide.
      await hooks.frontend({ type: "enable", chatId: HC, value: true }, USER);
      expect(hiddenCalls.at(-1)).toEqual({ ids: ["m0", "m1"], hidden: true });
      await hooks.frontend({ type: "releaseHidden", chatId: HC }, USER);
      expect(hiddenCalls.at(-1)).toEqual({ ids: ["m0", "m1"], hidden: false });
    } finally {
      spindle.chat = saved;
    }
  });

  test("a chat that leaves the ALMANAC preset disarms after two plain turns without its charter", async () => {
    const AC = "arm-chat";
    files.set(`chats/${AC}/meta.json`, meta(false));
    const turn = (system: string) => hooks.prompt([{ role: "system", content: system }, { role: "user", content: "Hello." }], { chatId: AC, userId: USER, generationType: "normal" });
    const { loadChat } = await import("../src/backend/store");
    await turn(`${CHARTER}\n${HANDSHAKE}`);
    expect((await loadChat(AC, USER)).meta.enabled).toBe(true);
    await turn("You are a helpful narrator.");
    expect((await loadChat(AC, USER)).meta.enabled).toBe(true); // one turn isn't enough
    await turn("You are a helpful narrator.");
    expect((await loadChat(AC, USER)).meta.enabled).toBe(false);
    await turn(`${CHARTER}\n${HANDSHAKE}`);
    expect((await loadChat(AC, USER)).meta.enabled).toBe(true); // and arms again when the preset returns
  });

  test("the handshake's language and preset version are read", async () => {
    const { loadChat } = await import("../src/backend/store");
    await hooks.prompt([{ role: "system", content: `${CHARTER}\n${HANDSHAKE.replace("/>", ' lang="Español" v="1.0.11"/>')}` }, { role: "user", content: "Hola." }], { chatId: CHAT, userId: USER, generationType: "normal" });
    expect((await loadChat(CHAT, USER)).meta.detected).toMatchObject({ lang: "Español", presetVersion: "1.0.11" });
  });

  test("a plan goes out once: the next prompt never reuses it", async () => {
    const { lastPlan, currentPlan } = await import("../src/backend/turn");
    await hooks.context({ chatId: CHAT, userId: USER, generationType: "normal" });
    const made = lastPlan(CHAT)!;
    expect(currentPlan(CHAT, { genType: "normal" })).toBe(made);
    await hooks.prompt([{ role: "system", content: CHARTER }, { role: "user", content: "Go on." }], { chatId: CHAT, userId: USER, generationType: "normal" });
    expect(made.used).toBe(true);
    expect(currentPlan(CHAT, { genType: "normal" })).toBeUndefined();
    // A preview's plan is never used by a real generation.
    await hooks.context({ chatId: CHAT, userId: USER, generationType: "normal", dryRun: true });
    expect(currentPlan(CHAT, { genType: "normal" })).toBeUndefined();
    expect(currentPlan(CHAT, { genType: "normal", dryRun: true })?.dryRun).toBe(true);
  });

  test("the injection ceiling is the player's: what was cut is reported, the note always goes in", async () => {
    const { saveSettings } = await import("../src/backend/store");
    const { planTurn } = await import("../src/backend/turn");
    try {
      await saveSettings({ injectCeiling: 40 }, USER);
      const plan = (await planTurn(CHAT, "normal", USER, { dryRun: true }))!;
      expect(plan.note).toContain("<ledger-note>");
      expect(plan.feed!.ceiling).toMatchObject({ limit: 40 });
      expect(plan.feed!.ceiling!.trimmed.join(" ")).toContain("over");
      await saveSettings({ injectCeiling: 0 }, USER);
      expect((await planTurn(CHAT, "normal", USER, { dryRun: true }))!.feed!.ceiling).toBeUndefined();
    } finally {
      await saveSettings({ injectCeiling: 24000 }, USER);
    }
  });

  test("the drawer acts only on the user's own chats, and settings keep their types", async () => {
    const saved = spindle.chats;
    const before = sent.length;
    spindle.chats = { ...saved, get: async () => null };
    try {
      await hooks.frontend({ type: "getState", chatId: "someone-elses-chat" }, "user-2");
      expect(sent.length).toBe(before);
    } finally {
      spindle.chats = saved;
    }
    const { cleanSettings } = await import("../src/backend/store");
    expect(cleanSettings({ injectCeiling: 9000, fanIn: "6", bogus: 1, stopList: ["a"], chronicle: false } as any)).toEqual({ injectCeiling: 9000, stopList: ["a"], chronicle: false });
  });

  test("a fork drops the source's mirror and carries the Almanac's entries over by the host's id map", async () => {
    const saved = { chats: spindle.chats, world_books: spindle.world_books, chat: spindle.chat };
    const updates: any[] = [];
    try {
      files.set("chats/src-chat/meta.json", JSON.stringify({ ...JSON.parse(meta(true)), clerked: { "m2:0": { hash: "h", result: "ok" } }, mirror: { bookId: "srcmirror", entries: {} } }));
      files.set("chats/src-chat/side.json", JSON.stringify({ "m2:0": [{ source: "clerk", ops: [] }], "@2": [{ source: "user", ops: [], id: "fix" }], "@9": [{ source: "sim", ops: [] }] }));
      spindle.chats = { ...saved.chats, get: async () => ({ id: "fork-2", character_id: "", metadata: { chat_world_book_ids: ["srcmirror", "lore"] } }), update: async (_id: string, patch: any) => void updates.push(patch) };
      spindle.world_books = { get: async (id: string) => (id === "srcmirror" ? { id, metadata: { almanac_chat_id: "src-chat" } } : { id, metadata: {} }) };
      spindle.chat = { ...saved.chat, getMessages: async () => messages.map((m) => ({ ...m, id: `f${m.index_in_chat}` })) };
      const { onFork } = await import("../src/backend/ingest");
      const { loadChat } = await import("../src/backend/store");
      await onFork("src-chat", "fork-2", USER, { m0: "f0", m1: "f1", m2: "f2" }, 2);
      expect(updates.at(-1).metadata.chat_world_book_ids).toEqual(["lore"]);
      const f = await loadChat("fork-2", USER);
      expect(Object.keys(f.side).sort()).toEqual(["@2", "f2:0"]); // @9 is past the branch point
      expect(Object.keys(f.meta.clerked ?? {})).toEqual(["f2:0"]);
      expect(f.meta.mirror.bookId).toBeUndefined();
    } finally {
      Object.assign(spindle, saved);
    }
  });

  test("another chat's mirror book is never read as lore (a fork inherits its source's)", async () => {
    const FC = "fork-chat";
    const saved = { chats: spindle.chats, world_books: spindle.world_books };
    const books: Record<string, any> = {
      theirs: { id: "theirs", name: "ALMANAC · Source chat", metadata: { almanac_chat_id: "source-chat" } },
      lore: { id: "lore", name: "Harbour lore", metadata: {} },
    };
    try {
      spindle.chats = { ...saved.chats, get: async () => ({ id: FC, character_id: "", metadata: { chat_world_book_ids: ["theirs", "lore"] } }) };
      spindle.world_books = { get: async (id: string) => books[id], getGlobal: async () => [], entries: { list: async () => ({ data: [{ id: `${Math.random()}`, comment: "The Harbour Guild", key: ["guild"], content: "Nobody crosses them." }] }) } };
      files.set(`chats/${FC}/meta.json`, meta(true));
      const { scanLore, isMirrorBook } = await import("../src/backend/lorebridge");
      const { loadChat } = await import("../src/backend/store");
      await scanLore(FC, USER, true);
      expect(Object.keys((await loadChat(FC, USER)).meta.lore.books)).toEqual(["lore"]);
      expect(isMirrorBook(books.theirs)).toBe(true);
      expect(isMirrorBook(books.lore)).toBe(false);
    } finally {
      Object.assign(spindle, saved);
    }
  });
});
