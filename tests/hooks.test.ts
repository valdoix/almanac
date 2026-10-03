// Integration test against a fake Spindle host: the preset's handshake and
// charter arm the chat, the prompt interceptor strips the handshake and injects
// the ledger note before the player's message, macros report linked state, and
// the render processor swaps the ledger for a compiled drawer with the desk.
import { beforeAll, describe, expect, test } from "bun:test";
import { OPENING, SAMPLE_REPLY, SAMPLE_USER } from "../preset/fixtures";
import { MOOD_TAGS } from "../src/core/soundtrack/tags";

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
    delete: async (p: string, u?: string) => (op(u), void files.delete(p)),
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
const HANDSHAKE = `<almanac-config persona="sealed" thoughts="0" inner="register" genres="mystery, romance" lead="mystery" nsfw="fade" romance="slow" dialogue="adaptive" style="blocks" cot="native" ledger="full" trackers="scene, cast, bonds, thoughts, inventory, threads, knowledge" view="drawer" theme="auto" world="insistent" initiative="world_led"/>`;

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
    expect([meta.detected.texture, meta.detected.initiative]).toEqual(["insistent", "world_led"]);
  });

  test("a Sealed persona's lines in earlier replies stay out of the prompt", async () => {
    const reply = SAMPLE_REPLY.replace("[spk=Joss#3]", `[spk=Wren#0]"Stay,"[/spk] Wren says. [spk=Joss#3]`);
    const res = await hooks.prompt([
      { role: "system", content: `${CHARTER}\n${HANDSHAKE}` },
      { role: "assistant", content: OPENING },
      { role: "user", content: SAMPLE_USER },
      { role: "assistant", content: reply },
      { role: "user", content: "I wait." },
    ], { chatId: CHAT, userId: USER, generationType: "normal" });
    const all = (Array.isArray(res) ? res : res.messages).map((m: any) => (typeof m.content === "string" ? m.content : "")).join("\n");
    expect(all).not.toContain("Stay,");
    expect(all).toContain(`[spk=Joss#3]"I'll just— the cart."[/spk]`);
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
    // A chat nothing was pushed for yet reads "arming": the interceptor decides on that prompt.
    expect(macro("almActive", "some-other-chat")).toBe("arming");
    expect(macro("almPlace", "some-other-chat")).toBe("");
    expect(macros.size).toBe(0);
  });

  test("render processor swaps the ledger for a drawer as of that message, with the desk on the latest", async () => {
    const latest = await hooks.render({ chatId: CHAT, userId: USER, messageId: "m2", content: SAMPLE_REPLY, isUser: false, origin: "render" });
    expect(latest.content).not.toContain("<ledger>");
    expect(latest.content).toContain("alm-drawer");
    expect(latest.content).toContain("[[alm-desk]]");
    // The header is drawn here as the plate, with the almanac's exact sun times and moon; no raw header is left for the preset's regex.
    expect(latest.content).toMatch(/<div class="p" data-k="r_[a-z]+-\d"/);
    expect(latest.content).toMatch(/☀ \d{2}:\d{2} – \d{2}:\d{2}/u);
    expect(latest.content).not.toMatch(/^[ \t]*(?:\*\*)?🗓/mu);
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
    files.set("settings.json", JSON.stringify({ ...DEFAULT_SETTINGS, recallBudget: 5000, theme: "candy", simulator: true, elsewhere: undefined }));
    files.set("chats/boot-chat/meta.json", JSON.stringify({ version: 1, config: { genres: ["horror"], sessionZeroDone: true } }));

    // Boot: no user.
    expect((await loadSettings()).recallBudget).toBe(DEFAULT_SETTINGS.recallBudget);
    await expect(loadChat("boot-chat")).rejects.toThrow(/no user yet/);

    // The user arrives: their own values, not the boot defaults.
    const RESTARTED = "user-after-restart"; // nothing cached for them yet, as after an update
    const s = await loadSettings(RESTARTED);
    expect([s.recallBudget, s.theme, s.simulator]).toEqual([5000, "candy", true]);
    // The old simulator switch carries over: on means a living world elsewhere.
    expect(s.elsewhere).toBe("living");
    const chat = await loadChat("boot-chat", RESTARTED);
    expect([chat.meta.config.genres, chat.meta.config.sessionZeroDone]).toEqual([["horror"], true]);

    // Changing one setting keeps every other saved one.
    await saveSettings({ fanIn: 6 }, RESTARTED);
    expect(JSON.parse(files.get("settings.json")!)).toMatchObject({ recallBudget: 5000, theme: "candy", simulator: true, elsewhere: "living", fanIn: 6 });
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

  test("the handshake's preset version is read; the story is English, so a language is ignored", async () => {
    const { loadChat } = await import("../src/backend/store");
    await hooks.prompt([{ role: "system", content: `${CHARTER}\n${HANDSHAKE.replace("/>", ' lang="Español" v="1.0.11"/>')}` }, { role: "user", content: "Hola." }], { chatId: CHAT, userId: USER, generationType: "normal" });
    const detected = (await loadChat(CHAT, USER)).meta.detected as Record<string, unknown>;
    expect(detected.presetVersion).toBe("1.0.11");
    expect(detected.lang).toBeUndefined();
  });

  test("almActive tells the preset whether it may run: arming in automatic mode, no when switched off here", async () => {
    const base = JSON.parse(meta(false));
    files.set("chats/auto-chat/meta.json", JSON.stringify(base));
    files.set("chats/off-chat/meta.json", JSON.stringify({ ...base, config: { ...base.config, enabledOverride: false } }));
    await hooks.context({ chatId: "auto-chat", userId: USER, generationType: "normal" });
    await hooks.context({ chatId: "off-chat", userId: USER, generationType: "normal" });
    expect(macro("almActive", "auto-chat")).toBe("arming");
    expect(macro("almActive", "off-chat")).toBe("no");
  });

  test("the fair die belongs to the player's turn: a swipe gets the same roll", async () => {
    await hooks.context({ chatId: CHAT, userId: USER, generationType: "normal" });
    const first = macro("almDie");
    expect(Number(first)).toBeGreaterThanOrEqual(1);
    expect(Number(first)).toBeLessThanOrEqual(20);
    await hooks.context({ chatId: CHAT, userId: USER, generationType: "swipe" });
    expect(macro("almDie")).toBe(first);
    const { turnDie } = await import("../src/backend/macros");
    const rolls = new Set(Array.from({ length: 200 }, (_, i) => turnDie(CHAT, `u${i}`)));
    expect(rolls.size).toBe(20);
  });

  test("/session0 opens the Session Zero window", async () => {
    sent.length = 0;
    await hooks.prompt([{ role: "system", content: `${CHARTER}\n${HANDSHAKE}` }, { role: "user", content: "/session0" }], { chatId: CHAT, userId: USER, generationType: "normal" });
    expect(sent.some((m) => m?.type === "sessionZero" && m.chatId === CHAT)).toBe(true);
    sent.length = 0;
    await hooks.prompt([{ role: "system", content: `${CHARTER}\n${HANDSHAKE}` }, { role: "user", content: "/session0" }], { chatId: CHAT, userId: USER, generationType: "normal", isDryRun: true });
    expect(sent.some((m) => m?.type === "sessionZero")).toBe(false);
  });

  test("a sidecar planner that doesn't answer is reported, not left as a missing plan", async () => {
    const SC = "sidecar-chat";
    files.set(`chats/${SC}/meta.json`, meta(true));
    const res = await hooks.prompt([{ role: "system", content: `${CHARTER}\n${HANDSHAKE.replace('cot="native"', 'cot="sidecar"')}` }, { role: "user", content: "I wait." }], { chatId: SC, userId: USER, generationType: "normal" });
    const out = (Array.isArray(res) ? res : res.messages).map((m: any) => m.content).join("\n");
    expect(out).toContain("The planner didn't answer this turn");
    expect(out).not.toContain("<director-plan>\n");
  });

  test("a reply that opens a scene without a header gets one drawn; a mid-scene reply doesn't", async () => {
    const bare = (s: string) => s.replace(/^🗓[^\n]*\n📍[^\n]*\n/u, "");
    // m0 opens the story's first scene; m2 is twelve minutes later in the same room.
    const opening = await hooks.render({ chatId: CHAT, userId: USER, messageId: "m0", content: bare(OPENING), isUser: false, origin: "render" });
    expect(opening.content).toMatch(/<div class="p" data-k="/);
    const mid = await hooks.render({ chatId: CHAT, userId: USER, messageId: "m2", content: bare(SAMPLE_REPLY), isUser: false, origin: "render" });
    expect(mid.content).not.toMatch(/<div class="p" data-k="/);
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

describe("Elsewhere against the host (1.14)", () => {
  test("a step of the world off the page anchors its lines; a failed telling keeps the engine's words", async () => {
    const EC = "elsewhere-chat";
    files.set(`chats/${EC}/meta.json`, JSON.stringify({ version: 1, enabled: true, config: { genres: [], sessionZeroDone: true, colors: {} }, detected: {}, pressures: {}, heat: {}, injected: {}, lastInjected: [], feed: [], mirror: { entries: {} }, lore: { books: {}, review: [] }, arrivals: [], repaired: {} }));
    const { runElsewhere } = await import("../src/backend/elsewhere");
    const { loadChat, noteProblem } = await import("../src/backend/store");
    const { ledgerFor } = await import("../src/backend/ledger");
    const rec = await runElsewhere(EC, USER, { force: true });
    expect(rec).not.toBeNull();
    expect(rec!.id).toMatch(/^w\d+f1$/);
    const f = await loadChat(EC, USER);
    const anchored = Object.entries(f.side).find(([k]) => k.startsWith("@"));
    if (rec!.beats + rec!.seeds + rec!.hops > 0) expect(anchored?.[1].some((s) => s.id === `ew:${rec!.id}` && s.source === "sim")).toBe(true);
    // The tests' host has no model: the telling fails, and the beats stand in the engine's words.
    await new Promise((r) => setTimeout(r, 50));
    const after = (f.meta as any).elsewhere.ticks[rec!.id];
    expect(["engine", "failed", "telling"]).toContain(after.status);
    const st = (await ledgerFor(EC, USER).refresh()).state;
    for (const a of Object.values(st.arcs ?? {})) expect(a.grounds.length).toBeGreaterThan(0);
    void noteProblem;
    // The page draws in both views from the real view.
    const { buildView } = await import("../src/backend/view");
    const view: any = await buildView(EC, USER);
    expect(view.elsewhere.ticks[0].id).toBe(rec!.id);
    const { AlmanacApp } = await import("../src/frontend/app");
    const draw = (AlmanacApp.prototype as any).tab_elsewhere;
    const director = draw.call({ editing: null }, view);
    expect(director).toContain("In the wings");
    expect(director).toContain("Move the world a step now");
    const surprise = draw.call({ editing: null }, { ...view, elsewhere: { ...view.elsewhere, view: "surprise" } });
    expect(surprise).toContain("What has reached you");
    expect(surprise).not.toContain("In the wings");
  });

  test("a proposed subplot waits on the page; accepted it starts, declined it never comes back", async () => {
    const EC = "elsewhere-chat";
    const { elsewhereAction, elsewhereOf } = await import("../src/backend/elsewhere");
    const { loadChat, save } = await import("../src/backend/store");
    const { ledgerFor } = await import("../src/backend/ledger");
    const f = await loadChat(EC, USER);
    const E = elsewhereOf(f.meta);
    const now = 5000;
    const mk = (id: string, lead: string) => ({
      id, key: `${lead.toLowerCase()}|investigation|lore:x`, kind: "investigation" as const, lead, cast: [], premise: `${lead} looks into the old case`, want: "to find the answer", fear: "it comes too late",
      secrecy: "private" as const, grounds: ["lore:x"], why: `the forecast "x"`, atAbs: now, status: "pending" as const, tick: "w1",
      line: `arc new #${id}: investigation | lead: ${lead} | secrecy: private | clock: 6 | heat: 1 | at: ${now} | premise: ${lead} looks into the old case | want: to find the answer | fear: it comes too late | grounds: lore:x | by: lore`,
    });
    E.proposals = [mk("p_one", "Willow"), mk("p_two", "Xander")];
    save(EC, "meta", USER, 0);
    const { buildView } = await import("../src/backend/view");
    const { AlmanacApp } = await import("../src/frontend/app");
    const view: any = await buildView(EC, USER);
    expect(view.elsewhere.proposals.map((p: any) => p.id)).toEqual(["p_one", "p_two"]);
    const page = (AlmanacApp.prototype as any).tab_elsewhere.call({ editing: null }, view);
    expect(page).toContain("Proposed");
    expect(page).toContain('data-act="ewPropose" data-id="p_one" data-what="accept"');

    await elsewhereAction(EC, { action: "decline", id: "p_two" }, USER);
    await elsewhereAction(EC, { action: "accept", id: "p_one" }, USER);
    const g = await loadChat(EC, USER);
    const E2 = elsewhereOf(g.meta);
    expect(E2.proposals!.find((p) => p.id === "p_one")!.status).toBe("accepted");
    expect(E2.proposals!.find((p) => p.id === "p_two")!.status).toBe("declined");
    expect(E2.declined).toContain("xander|investigation|lore:x");
    // The accepted one is a subplot now, written by the player's hand and started at once.
    const st = (await ledgerFor(EC, USER).refresh()).state;
    expect(st.arcs?.p_one).toMatchObject({ lead: "Willow", kind: "investigation" });
    expect(st.arcs?.p_two).toBeUndefined();
    const ops = Object.values(g.side).flat().filter((s) => s.source === "user").flatMap((s) => s.ops.map((o) => o.raw ?? ""));
    expect(ops.some((l) => /^arc new #p_one: .*push: yes/.test(l))).toBe(true);
    expect((await elsewhereAction(EC, { action: "accept", id: "p_two" }, USER))?.warn).toContain("no longer waiting");
  });

  test("a step told in the engine's words can be told again by the model", async () => {
    const EC = "elsewhere-chat";
    const { retellBeat, runElsewhere } = await import("../src/backend/elsewhere");
    const { ledgerFor } = await import("../src/backend/ledger");
    const { buildView } = await import("../src/backend/view");
    const { AlmanacApp } = await import("../src/frontend/app");
    let beat: { arc: string; tick: string; atAbs: number; lead: string } | undefined;
    for (let i = 0; i < 6 && !beat; i++) {
      await runElsewhere(EC, USER, { force: true });
      await new Promise((r) => setTimeout(r, 20));
      const st = (await ledgerFor(EC, USER).refresh()).state;
      const a = Object.values(st.arcs ?? {}).find((x) => x.beats.some((b) => b.tick && b.told === "template"));
      const b = a?.beats.find((x) => x.tick && x.told === "template");
      if (a && b) beat = { arc: a.id, tick: b.tick!, atAbs: b.atAbs, lead: a.lead.split(/\s+/)[0] };
    }
    expect(beat).toBeDefined();
    const page = (AlmanacApp.prototype as any).tab_elsewhere.call({ editing: null }, await buildView(EC, USER));
    expect(page).toContain(`data-act="ewRetell" data-id="${beat!.arc}" data-tick="${beat!.tick}"`);
    const saved = spindle.generate;
    let asked = "";
    spindle.generate = { quiet: async (req: any) => ((asked = JSON.stringify(req)), { content: JSON.stringify({ beats: [{ card: "x", result: "cost", text: `${beat!.lead} kept at it through the afternoon. It isn't settled yet.` }] }) }) };
    try {
      const res = await retellBeat(EC, beat!.arc, beat!.atAbs, beat!.tick, USER);
      expect(res.warn).toBeUndefined();
      expect(asked).toContain("TELL AGAIN");
    } finally {
      spindle.generate = saved;
    }
    const after = (await ledgerFor(EC, USER).refresh()).state.arcs![beat!.arc].beats.find((b) => b.tick === beat!.tick && b.atAbs === beat!.atAbs)!;
    expect(after).toMatchObject({ told: "model", text: `${beat!.lead} kept at it through the afternoon. It isn't settled yet.` });
    expect(after.note).toBeUndefined();
    expect((await retellBeat(EC, beat!.arc, beat!.atAbs, "w0", USER)).warn).toBeDefined();

    // A step from before ticks kept their cards: the card is rebuilt, and the reply may come bare after bracketed prose.
    const { loadChat, save } = await import("../src/backend/store");
    const { elsewhereOf } = await import("../src/backend/elsewhere");
    const f = await loadChat(EC, USER);
    const t = elsewhereOf(f.meta).ticks[beat!.tick];
    delete t.cards;
    delete t.lines;
    delete t.extra;
    save(EC, "meta", USER, 0);
    const again = `${beat!.lead} tried another way round. Nothing is settled.`;
    spindle.generate = { quiet: async () => ({ content: `[b0] Here it is: {"card":"b0","result":"cost","text":"${again}"}` }) };
    try {
      expect((await retellBeat(EC, beat!.arc, beat!.atAbs, beat!.tick, USER)).warn).toBeUndefined();
    } finally {
      spindle.generate = saved;
    }
    const st2 = (await ledgerFor(EC, USER).refresh()).state;
    expect(st2.arcs![beat!.arc].beats.find((b) => b.tick === beat!.tick && b.atAbs === beat!.atAbs)).toMatchObject({ told: "model", text: again });
    // Nothing else in the chat moved: one beat for that step, still.
    expect(st2.arcs![beat!.arc].beats.filter((b) => b.tick === beat!.tick && b.atAbs === beat!.atAbs).length).toBe(1);
  });
});

describe("the Lorebook Creator, a conversation (1.17)", () => {
  /** A world-book host: books and entries in memory, every update recorded. */
  function fakeBooks(seed: Record<string, { name: string; metadata?: any; entries: any[] }> = {}) {
    const books: Record<string, any> = {};
    const entries: Record<string, any[]> = {};
    const updates: { id: string; patch: any }[] = [];
    let n = 0;
    for (const [id, b] of Object.entries(seed)) {
      books[id] = { id, name: b.name, metadata: b.metadata ?? {} };
      entries[id] = b.entries.map((e) => ({ keysecondary: [], position: 0, depth: 4, disabled: false, constant: false, selective: false, match_whole_words: null, extensions: {}, world_book_id: id, ...e }));
    }
    const api = {
      list: async () => ({ data: Object.values(books), total: Object.keys(books).length }),
      get: async (id: string) => books[id] ?? null,
      create: async (input: any) => {
        const id = `book${++n}`;
        books[id] = { id, ...input };
        entries[id] = [];
        return books[id];
      },
      getGlobal: async () => [],
      activateGlobal: async () => {},
      entries: {
        list: async (id: string) => ({ data: entries[id] ?? [], total: (entries[id] ?? []).length }),
        get: async (eid: string) => Object.values(entries).flat().find((e) => e.id === eid) ?? null,
        create: async (bookId: string, input: any) => {
          const e = { id: `new${++n}`, world_book_id: bookId, ...input };
          entries[bookId].push(e);
          return e;
        },
        update: async (eid: string, patch: any) => {
          updates.push({ id: eid, patch });
          const e = Object.values(entries).flat().find((x) => x.id === eid);
          Object.assign(e, patch);
          return e;
        },
      },
    };
    return { api, books, entries, updates };
  }

  async function talk(action: string, req: Record<string, unknown> = {}) {
    const before = sent.length;
    await hooks.frontend({ type: "creator", action, req, rid: 77, chatId: CHAT }, USER);
    const out = sent.slice(before);
    return { reply: out.filter((m) => m?.type === "creator" && m.rid === 77).pop(), session: out.filter((m) => m?.type === "creatorSession").pop()?.session };
  }

  test("a new book: the Almanac asks, proposes, revises, writes on acceptance and saves", async () => {
    const saved = { world_books: spindle.world_books, generate: spindle.generate };
    const wb = fakeBooks();
    const replies = [
      JSON.stringify({ say: "Here's a first plan for Sunnydale at the start of season six.", options: ["Add the Trio"], proposal: { bookName: "Sunnydale 2001", summary: "The canon point, Buffy, a hangout.", items: [
        { category: "boundary", title: "Beginning of Season Six", about: "Buffy has just clawed out of her grave", constant: true },
        { category: "character", title: "Buffy Summers", about: "the Slayer, resurrected, in shock" },
        { category: "location", title: "The Bronze", about: "the club" },
      ] } }),
      `Sure. {"say":"Dropped the Bronze and added Spike.","revise":{"drop":["p3"],"add":[{"category":"character","title":"Spike","about":"chipped vampire who kept watch over Dawn"}]}}`,
      JSON.stringify({ entries: [
        { comment: "Timeline Boundary - Beginning of Season Six", content: "The story begins in Sunnydale in October 2001, the night Buffy claws out of her grave after 147 days dead.", key: ["Season Six", "resurrection"], constant: true, priority: 300, position: 4, depth: 4, extensions: { almanac: { lore: { category: "boundary", kind: "boundary", tense: "timeless" } } } },
        { comment: "Character: Buffy Summers", content: "Buffy Summers is the Slayer, twenty, just pulled back from the dead. Hazel-green eyes, blonde hair.", key: ["Buffy", "Slayer", "night"], priority: 250, position: 1 },
        { comment: "Character: Spike", content: "Spike is a chipped vampire who has kept watch over Dawn since Buffy died.", key: ["Spike", "William the Bloody"], priority: 200, position: 1 },
      ] }),
      JSON.stringify({ entries: [{ comment: "Character: Buffy Summers", content: "Buffy Summers is the Slayer, twenty, just pulled back from the dead. Hazel-green eyes, blonde hair.", key: ["Buffy", "Slayer", "Buffy Anne Summers"] }] }),
    ];
    const prompts: any[] = [];
    spindle.world_books = wb.api;
    spindle.generate = { quiet: async (req: any) => (prompts.push(req.messages), { content: replies.shift() ?? "" }) };
    try {
      let r = await talk("new");
      expect(r.reply.session.messages[0]).toMatchObject({ role: "almanac", card: "tasks" });
      r = await talk("task", { task: "new" });
      expect(r.session.messages.at(-1).options).toContain("Use this chat's character card");
      expect(prompts.length).toBe(0); // choosing a task asks no model

      r = await talk("send", { text: "Sunnydale at the very start of season six, Buffy just resurrected." });
      const sys0 = prompts[0][0].content as string;
      expect(sys0).toContain("TASK: Create a new lorebook");
      expect(sys0).not.toMatch(/vellum/i);
      expect(prompts[0].at(-1).content).toMatch(/JSON object only/);
      expect(r.session.proposal).toMatchObject({ version: 1, bookName: "Sunnydale 2001", target: "new" });
      expect(r.session.proposal.items.map((i: any) => i.title)).toEqual(["Timeline Boundary - Beginning of Season Six", "Character: Buffy Summers", "Location: The Bronze"]);
      expect(r.session.messages.at(-1)).toMatchObject({ card: "proposal", version: 1, options: ["Add the Trio"] });

      r = await talk("send", { text: "Drop the Bronze and add Spike." });
      // The model sees the plan it's revising.
      expect(prompts[1][0].content).toContain("p3 create location: Location: The Bronze");
      expect(r.session.proposal.version).toBe(2);
      expect(r.session.proposal.items.map((i: any) => [i.id, i.title])).toEqual([["p1", "Timeline Boundary - Beginning of Season Six"], ["p2", "Character: Buffy Summers"], ["p4", "Character: Spike"]]);

      r = await talk("accept");
      expect(r.session.phase).toBe("review");
      const d = r.session.draft;
      expect(d.entries.map((e: any) => e.comment)).toEqual(["Timeline Boundary - Beginning of Season Six", "Character: Buffy Summers", "Character: Spike"]);
      // "night" was a generic key: the model was asked once more, and fixed it.
      expect(prompts[3][1].content).toMatch(/generic keywords: night/);
      expect(Object.keys(d.issues)).toEqual([]);
      expect(d.entries[2].extensions.almanac.lore).toMatchObject({ category: "character", kind: "person" });
      expect(r.session.messages.at(-1)).toMatchObject({ card: "result" });

      r = await talk("save", { save: { target: "new", name: "Sunnydale 2001", attach: "none", bridge: false } });
      expect(r.session.phase).toBe("saved");
      const [book] = Object.values(wb.books);
      expect(book).toMatchObject({ name: "Sunnydale 2001", metadata: { almanac_creator: "2.0.0" } });
      expect(wb.entries[book.id].map((e) => [e.comment, e.priority, e.order_value])).toEqual([["Timeline Boundary - Beginning of Season Six", 300, 300], ["Character: Buffy Summers", 250, 250], ["Character: Spike", 200, 200]]);
      // The conversation is kept in the player's storage.
      expect(JSON.parse(files.get("creator/index.json")!).list[0]).toMatchObject({ id: r.session.id, title: "Sunnydale 2001" });
      expect(JSON.parse(files.get(`creator/${r.session.id}.json`)!).phase).toBe("saved");
    } finally {
      Object.assign(spindle, saved);
    }
  });

  test("an existing book made Almanac-compatible: read, adjusted in words, written in place with only what changed", async () => {
    const saved = { world_books: spindle.world_books, generate: spindle.generate };
    const wb = fakeBooks({
      btvs: { name: "BTVS", entries: [
        { id: "b1", comment: "Buffy Summers - The Slayer", content: "Buffy Summers is Sunnydale's Slayer: witty and stubborn.", key: ["Buffy"], priority: 10, order_value: 250, position: 1 },
        { id: "b2", comment: "Buffy & Spike - Truce", content: "Buffy and Spike began as enemies and became reluctant allies.", key: ["Spike"], priority: 10, order_value: 230, position: 1 },
        { id: "b3", comment: "Upcoming: The Trio Strikes", content: "The Trio robs the bank.", key: ["Trio"], priority: 10, order_value: 120 },
        { id: "b4", comment: "Location: The Bronze", content: "The Bronze is a nightclub in Sunnydale.", key: ["Bronze"], priority: 110, order_value: 110, extensions: { almanac: { lore: { category: "location", kind: "place", tense: "timeless" } } } },
      ] },
    });
    const replies = [
      JSON.stringify({ say: "Done: your titles stay; only metadata and tiers change.", revise: { options: { titles: "keep" } } }),
      JSON.stringify({ entries: [{ comment: "Upcoming: The Trio Strikes", content: "The Trio will rob the bank." }] }),
    ];
    const prompts: any[] = [];
    spindle.world_books = wb.api;
    spindle.generate = { quiet: async (req: any) => (prompts.push(req.messages), { content: replies.shift() ?? "" }) };
    try {
      await talk("new");
      let r = await talk("task", { task: "convert" });
      expect(r.session.messages.at(-1).card).toBe("books");
      r = await talk("book", { bookId: "btvs" });
      const p = r.session.proposal;
      expect(p).toMatchObject({ task: "convert", target: "same", version: 1 });
      expect(p.items.map((i: any) => [i.op, i.category, i.title])).toEqual([
        ["convert", "character", "Character: Buffy Summers (The Slayer)"],
        ["convert", "relationship", "Relationship: Buffy & Spike (Truce)"],
        ["convert", "upcoming", "Upcoming: The Trio Strikes"],
        ["keep", "location", "Location: The Bronze"],
      ]);
      expect(r.session.messages.at(-1).text).toMatch(/I read all 4 entries of BTVS/);
      expect(prompts.length).toBe(0); // every reading was clear: no model call

      r = await talk("send", { text: "Keep my titles, add metadata only" });
      expect(r.session.proposal).toMatchObject({ version: 2, options: { titles: "keep", tiers: true } });

      r = await talk("accept");
      expect(r.session.draft.entries.map((e: any) => e.comment)).toEqual(["Buffy Summers - The Slayer", "Buffy & Spike - Truce", "Upcoming: The Trio Strikes"]);
      expect(prompts[1][1].content).toMatch(/Rewrite ONLY the first sentence/);

      r = await talk("save", { save: { target: "same", attach: "none", bridge: false } });
      expect(r.session.saved).toMatchObject({ updated: 3, created: 0, bookId: "btvs" });
      const patch = (id: string) => wb.updates.find((u) => u.id === id)!.patch;
      // Only what changed: no title (kept), no fields Lumiverse left at their defaults.
      expect(Object.keys(patch("b1")).sort()).toEqual(["extensions", "priority"]);
      expect(patch("b1").priority).toBe(250);
      expect(patch("b2").extensions.almanac.lore).toMatchObject({ category: "relationship", participants: ["Buffy", "Spike"] });
      expect(patch("b3")).toMatchObject({ content: "The Trio will rob the bank.", priority: 120 });
      expect(wb.updates.some((u) => u.id === "b4")).toBe(false);
    } finally {
      Object.assign(spindle, saved);
    }
  });

  test("a model that fails is reported in the conversation, and Try again runs the same turn", async () => {
    const saved = { world_books: spindle.world_books, generate: spindle.generate };
    let calls = 0;
    spindle.world_books = fakeBooks().api;
    spindle.generate = {
      quiet: async () => {
        if (++calls === 1) throw new Error("connection refused");
        return { content: `{"say":"Back. What should the book cover?"}` };
      },
    };
    try {
      await talk("new");
      let r = await talk("send", { text: "I want a lorebook for my Harrenhal story." });
      expect(r.session.messages.at(-1)).toMatchObject({ card: "error", options: ["Try again"] });
      expect(r.session.messages.at(-1).text).toMatch(/connection refused/);
      const users = r.session.messages.filter((m: any) => m.role === "user").length;
      r = await talk("send", { text: "Try again" });
      expect(r.session.messages.at(-1)).toMatchObject({ role: "almanac", text: "Back. What should the book cover?" });
      expect(r.session.messages.filter((m: any) => m.role === "user").length).toBe(users);
      expect(r.session.busy).toBeUndefined();
    } finally {
      Object.assign(spindle, saved);
    }
  });
});

describe("the Lorebook Creator updates a book (1.17)", () => {
  test("rewrites keep the book's own fields, retired entries are switched off, new ones are added", async () => {
    const saved = { world_books: spindle.world_books, generate: spindle.generate };
    const entries: any[] = [
      { id: "h1", world_book_id: "hb", comment: "Character: Ysilla Grell", content: "Ysilla Grell is the chief steward of Harrenhal.", key: ["Ysilla"], keysecondary: [], priority: 200, order_value: 200, position: 1, depth: 4, constant: false, selective: false, disabled: false, match_whole_words: null, probability: 100, extensions: { almanac: { lore: { category: "character", kind: "person", tense: "timeless" } } } },
      { id: "h2", world_book_id: "hb", comment: "Location: The Kitchens", content: "The kitchens of Harrenhal are domed and enormous.", key: ["kitchens"], keysecondary: [], priority: 110, order_value: 110, position: 0, depth: 4, constant: false, selective: false, disabled: false, extensions: {} },
    ];
    const updates: any[] = [];
    const created: any[] = [];
    spindle.world_books = {
      list: async () => ({ data: [{ id: "hb", name: "Harrenhal", metadata: {} }], total: 1 }),
      get: async (id: string) => (id === "hb" ? { id: "hb", name: "Harrenhal", metadata: {} } : null),
      entries: {
        list: async () => ({ data: entries, total: entries.length }),
        update: async (id: string, patch: any) => (updates.push({ id, patch }), { ...entries.find((e) => e.id === id), ...patch }),
        create: async (_b: string, input: any) => (created.push(input), { id: "x", ...input }),
      },
    };
    const replies = [
      JSON.stringify({ say: "Three changes.", proposal: { bookName: "Harrenhal", items: [
        { op: "update", entry: "e1", category: "character", title: "Character: Ysilla Grell", about: "she now knows Aelor is fireproof" },
        { op: "retire", entry: "e2", title: "Location: The Kitchens", about: "folded into Goodwife Mara" },
        { op: "create", category: "character", title: "Goodwife Mara", about: "mistress of the kitchens" },
      ] } }),
      JSON.stringify({ entries: [
        { comment: "Character: Ysilla Grell", content: "Ysilla Grell is the chief steward of Harrenhal, and since the feast she knows the prince does not burn.", key: ["Ysilla", "steward"] },
        { comment: "Character: Goodwife Mara", content: "Goodwife Mara is the mistress of Harrenhal's kitchens, which she rules like a keep.", key: ["Mara", "kitchens"] },
      ] }),
    ];
    const prompts: any[] = [];
    spindle.generate = { quiet: async (req: any) => (prompts.push(req.messages), { content: replies.shift() ?? "" }) };
    try {
      const talk = async (action: string, req: Record<string, unknown> = {}) => {
        const before = sent.length;
        await hooks.frontend({ type: "creator", action, req, rid: 78, chatId: CHAT }, USER);
        return sent.slice(before).filter((m) => m?.type === "creatorSession").pop()?.session;
      };
      await talk("new");
      await talk("task", { task: "update" });
      let s = await talk("book", { bookId: "hb" });
      expect(s.messages.at(-1).text).toMatch(/Harrenhal has 2 entries\. What should change\?/);
      s = await talk("send", { text: "Ysilla knows about the fire now; fold the kitchens into a Goodwife Mara entry." });
      // The model sees the book by e-numbers.
      expect(prompts[0][0].content).toMatch(/e1 \| character \| Character: Ysilla Grell/);
      expect(s.proposal.items.map((i: any) => [i.op, i.entryId ?? null])).toEqual([["update", "h1"], ["retire", "h2"], ["create", null]]);
      s = await talk("accept");
      // The rewrite was asked with the entry as it is now.
      expect(prompts[1][1].content).toMatch(/Entries to rewrite[\s\S]*Ysilla Grell is the chief steward of Harrenhal\./);
      expect(s.draft.entries.map((e: any) => [e.op, e.comment])).toEqual([["update", "Character: Ysilla Grell"], ["retire", "Location: The Kitchens"], ["create", "Character: Goodwife Mara"]]);
      s = await talk("save", { save: { target: "same", attach: "none", bridge: false } });
      expect(s.saved).toMatchObject({ updated: 1, retired: 1, created: 1 });
      const u1 = updates.find((u) => u.id === "h1")!.patch;
      // Only the text changed: the entry's own priority, position and match setting stay.
      expect(Object.keys(u1).sort()).toEqual(["content", "extensions", "key"]);
      expect(updates.find((u) => u.id === "h2")!.patch).toEqual({ disabled: true });
      expect(created[0]).toMatchObject({ comment: "Character: Goodwife Mara", priority: 200, position: 1 });
    } finally {
      Object.assign(spindle, saved);
    }
  });
});

// ---------------------------------------------------------------------------
// Soundtrack against a fake Pear Desktop (its API Server's routes and shapes)
// ---------------------------------------------------------------------------

describe("soundtrack with Pear Desktop", () => {
  const artist = (name: string, id: string) => ({ text: name, navigationEndpoint: { browseEndpoint: { browseId: id, browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" } } } } });
  const item = (videoId: string, title: string, who: any[]) => ({ musicResponsiveListItemRenderer: {
    playlistItemData: { videoId },
    overlay: { x: { watchEndpoint: { videoId, watchEndpointMusicSupportedConfigs: { watchEndpointMusicConfig: { musicVideoType: "MUSIC_VIDEO_TYPE_ATV" } } } } },
    flexColumns: [{ musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: title }] } } }, { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [...who, { text: " • " }, { text: "3:40" }] } } }],
  } });
  const CATALOG: Record<string, { title: string; artist: string }> = {};
  const results = (q: string) => {
    const k = q.replace(/\W+/g, "").slice(0, 6);
    const rows = [
      [`${k}${pear.gen}aaaa1`, `${q} one`, [artist("Banned Band", "UCbad")]],
      [`${k}${pear.gen}aaaa2`, `${q} two`, [artist("Good Artist", "UCgood")]],
      [`${k}${pear.gen}aaaa3`, `${q} three`, [artist("Other Artist", "UCother"), { text: " & " }, artist("Banned Band", "UCbad")]],
      [`${k}${pear.gen}aaaa4`, `${q} four`, [artist("Fine Artist", "UCfine")]],
    ] as const;
    for (const [id, title, who] of rows) CATALOG[id] = { title, artist: who.map((w: any) => w.text).join("") };
    return { contents: [{ musicShelfRenderer: { contents: rows.map(([id, title, who]) => item(id, title, who as any)) } }] };
  };
  const pear = { gen: "a", queue: [] as string[], at: -1, elapsed: 0, paused: false, volume: 60, searches: 0, auth: 0, nexts: 0 };
  const song = (id: string) => ({ title: CATALOG[id]?.title ?? id, artist: CATALOG[id]?.artist ?? "Someone", videoId: id, isPaused: pear.paused, elapsedSeconds: pear.elapsed, songDuration: 220, imageSrc: "", album: null, mediaType: "AUDIO" });
  const res = (status: number, body?: unknown) => ({ status, statusText: "", headers: {}, body: body === undefined ? "" : JSON.stringify(body) });
  async function cors(url: string, init: any) {
    const u = new URL(url);
    const body = init?.body ? JSON.parse(init.body) : undefined;
    const m = (init?.method ?? "GET").toUpperCase();
    if (u.host === "ws.audioscrobbler.com") return lastfm(u);
    if (u.host !== "127.0.0.1:26538") throw new Error(`unexpected request to ${u.host}`);
    if (u.pathname.startsWith("/auth/")) return pear.auth++, res(200, { accessToken: "jwt-token" });
    if (init?.headers?.Authorization !== "Bearer jwt-token") return res(401);
    const p = u.pathname.replace("/api/v1", "");
    if (p === "/song" && m === "GET") return pear.at < 0 ? res(204) : res(200, song(pear.queue[pear.at]));
    if (p === "/queue" && m === "GET") return res(200, { items: pear.queue.map((videoId, i) => ({ playlistPanelVideoRenderer: { videoId, selected: i === pear.at } })) });
    if (p === "/queue" && m === "POST") return pear.queue.splice(body.insertPosition === "INSERT_AFTER_CURRENT_VIDEO" ? pear.at + 1 : pear.queue.length, 0, body.videoId), res(204);
    if (p === "/queue" && m === "PATCH") return (pear.at = body.index), (pear.elapsed = 0), res(204);
    if (p.startsWith("/queue/") && m === "DELETE") return pear.queue.splice(Number(p.split("/")[2]), 1), res(204);
    if (p === "/next") return pear.nexts++, (pear.at = Math.min(pear.at + 1, pear.queue.length - 1)), (pear.elapsed = 0), res(204);
    if (p === "/play") return (pear.paused = false), res(204);
    if (p === "/pause") return (pear.paused = true), res(204);
    if (p === "/volume") return m === "GET" ? res(200, { state: pear.volume, isMuted: false }) : ((pear.volume = body.volume), res(204));
    if (p === "/like-state") return res(200, { state: "INDIFFERENT" });
    if (p === "/search") return pear.searches++, res(200, results(body.query));
    return res(404);
  }
  // Last.fm: one good key; "Good Artist" is tagged against the current mood, "Fine Artist" with it.
  const LFM_KEY = "0123456789abcdef0123456789abcdef";
  const lfm = { calls: 0, mood: "calm" as keyof typeof MOOD_TAGS };
  function lastfm(u: URL) {
    lfm.calls++;
    const q = u.searchParams;
    if (q.get("api_key") !== LFM_KEY) return res(200, { error: 10, message: "Invalid API key - You must be granted a valid key by last.fm" });
    if (q.get("method") === "tag.getinfo") return res(200, { tag: { name: "ambient" } });
    const who = q.get("artist") ?? "";
    const { fit, clash } = MOOD_TAGS[lfm.mood];
    const tag = who === "Fine Artist" ? [{ name: fit[0], count: 100 }, { name: "darkwave", count: 80 }] : who === "Good Artist" ? [{ name: clash[0], count: 100 }, { name: "seen live", count: 90 }] : [];
    return res(200, { toptags: { tag: [...tag, { name: "x1", count: 5 }, { name: "x2", count: 4 }, { name: "x3", count: 3 }, { name: "x4", count: 2 }] } });
  }
  const vault = new Map<string, string>();
  const st = (action: string, extra: Record<string, unknown> = {}) => hooks.frontend({ type: "soundtrack", action, chatId: CHAT, ...extra }, USER);
  const view = () => sent.filter((m) => m?.type === "soundtrack").pop()?.view;

  test("connect, pick for the scene, skip a banned autoplay song, play the user's own pick", async () => {
    Object.assign(spindle, {
      cors,
      enclave: { put: async (k: string, v: string) => void vault.set(k, v), get: async (k: string) => vault.get(k) ?? null, delete: async (k: string) => vault.delete(k) },
    });
    spindle.permissions.has = () => true;
    await st("taste", { scope: "global", taste: { genres: ["darkwave"], genreMode: "strict", banned: [{ name: "Banned Band", id: "UCbad" }], bannedWords: [], fade: false } });
    await st("config", { patch: { fade: false } });
    await st("connect");
    expect(pear.auth).toBe(1);
    expect(vault.get("soundtrack_pear_token")).toBe("jwt-token");
    expect(view().status).toBe("connected");
    // The stored config never holds the token.
    expect(files.get("soundtrack/config.json")).not.toContain("jwt-token");

    await st("start");
    expect(pear.searches).toBeGreaterThan(0);
    const first = pear.queue[pear.at];
    expect(first).toBeDefined();
    // Never the banned band, alone or in a duet.
    expect(CATALOG[first].artist).not.toContain("Banned Band");
    await st("get");
    expect(view().np.videoId).toBe(first);
    expect(view().np.why).toMatch(/darkwave/);
    expect(view().origin).toBe("ours");

    // Near the end the next song is queued; then autoplay slips in a banned song after ours ends.
    pear.elapsed = 210;
    await st("get");
    const queued = pear.queue[pear.at + 1];
    expect(queued).toBeDefined();
    expect(CATALOG[queued].artist).not.toContain("Banned Band");
    const banned = Object.keys(CATALOG).find((id) => CATALOG[id].artist === "Banned Band")!;
    pear.queue.splice(pear.at + 1, 0, banned);
    pear.at += 1;
    pear.elapsed = 2;
    const nexts = pear.nexts;
    await st("get");
    expect(pear.nexts).toBe(nexts + 1);
    expect(pear.queue[pear.at]).toBe(queued);
    expect(view().plays.some((p: any) => p.how === "banned-skip" && p.videoId === banned)).toBe(true);

    // The user plays the banned band themselves: it plays, and the Almanac steps back.
    pear.elapsed = 40;
    await st("get");
    await st("playSong", { videoId: banned });
    await st("get");
    expect(pear.queue[pear.at]).toBe(banned);
    expect(view().origin).toBe("user");
    expect(view().mode).toBe("yielded");
    const before = pear.nexts;
    await st("get");
    expect(pear.nexts).toBe(before);

    // Artist search answers by rid; disconnect forgets the token.
    await st("searchArtists", { q: "good", rid: 5 });
    expect(sent.filter((m) => m?.type === "soundtrackResult" && m.rid === 5).length).toBe(1);
    await st("disconnect");
    expect(vault.has("soundtrack_pear_token")).toBe(false);
    expect(view().status).toBe("off");
  }, 30_000);

  test("Last.fm tags: a refused key isn't kept; a good one checks the picks and stays in the vault", async () => {
    await st("lastfmKey", { key: "ffffffffffffffffffffffffffffffff", rid: 11 });
    expect(sent.filter((m) => m?.type === "soundtrackResult" && m.rid === 11).pop().error).toMatch(/refused/);
    expect(vault.has("soundtrack_lastfm_key")).toBe(false);
    await st("lastfmKey", { key: "not a key", rid: 12 });
    expect(sent.filter((m) => m?.type === "soundtrackResult" && m.rid === 12).pop().error).toMatch(/32/);

    await st("lastfmKey", { key: LFM_KEY, rid: 13 });
    expect(sent.filter((m) => m?.type === "soundtrackResult" && m.rid === 13).pop().ok).toBe(true);
    expect(vault.get("soundtrack_lastfm_key")).toBe(LFM_KEY);
    expect(view().lastfm).toBe(true);
    expect(files.get("soundtrack/config.json")).not.toContain(LFM_KEY);
    expect(JSON.stringify(view())).not.toContain(LFM_KEY);

    // A fresh catalog: everything the first test found was played lately.
    pear.gen = "b";
    await st("clearCache");
    // Two genres and no same-artist rule: several songs survive the filters, so the tags have something to order.
    await st("taste", { scope: "global", taste: { genres: ["darkwave", "coldwave"], variety: "focused" } });
    await st("connect");
    lfm.mood = (view().cue?.mood ?? "calm") as keyof typeof MOOD_TAGS;
    const calls = lfm.calls;
    await st("start");
    expect(lfm.calls).toBeGreaterThan(calls);
    await st("get");
    const now = view().np;
    // The why says what the tags heard (the order they give is in tests/soundtrack.test.ts).
    expect(now.why).toMatch(CATALOG[now.videoId].artist === "Fine Artist" ? / · tagged / : / · but tagged /);

    await st("lastfmClear");
    expect(vault.has("soundtrack_lastfm_key")).toBe(false);
    expect(view().lastfm).toBe(false);
    await st("disconnect");
  }, 30_000);
});
