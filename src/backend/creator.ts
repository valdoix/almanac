// Lorebook Creator service: a conversation with the model about the book the player wants.
// The Almanac asks what to make (a new book, an update, a book made Almanac-compatible, the story
// saved as a book, a check), proposes a plan, revises it with the player until they accept, then
// writes the entries (batched, validated, re-asked once), and saves them where the player says.
// Each conversation is kept in the player's extension storage, so it survives reloads.

import type { WorldBookEntryDTO } from "lumiverse-spindle-types";
import {
  bookIndex, codexToLorebook, conversionUpdate, CREATOR_VERSION, DEFAULT_OPTIONS, draftText, healthCheck, linkEntries, makeProposal, normalizeEntry,
  openingPrompt, parseReply, planConversion, reaskPrompt, reviseProposal, simulateActivation, storyProposal, TASKS, toLumiverse, toSillyTavern,
  validateEntry, writePrompt, writerSystem, chatSystem, type BookEntry, type ChatContext, type CreatorEntry, type CreatorTask, type Proposal,
  type ProposalItem, type Revision,
} from "../core/creator";
import { category, categoryOfKind, titleOf } from "../core/loreformat";
import { classifierPrompt, extractJson } from "../core/prompts";
import { estTokens } from "../core/util";
import { weaverBook } from "../core/lore";
import { describe, has, host, serial, warn } from "./host";
import { chatPersonaId, ledgerFor } from "./ledger";
import { asst, quiet, sys, usr } from "./llm";
import { loadChat, loadSettings } from "./store";
import { isMirrorBook, scanLore } from "./lorebridge";

type Phase = "intake" | "discuss" | "generating" | "review" | "saved";

export interface CreatorSource {
  id: string;
  kind: "text" | "card" | "persona" | "story";
  label: string;
  text: string;
}

export interface CreatorMessage {
  id: string;
  role: "almanac" | "user";
  text: string;
  at: number;
  options?: string[];
  /** What the message carries besides its text: the task choices, the book picker, a plan, the written entries, the saved book, an error. */
  card?: "tasks" | "books" | "proposal" | "result" | "saved" | "error" | "report";
  version?: number;
}

export interface CreatorDraft {
  entries: CreatorEntry[];
  issues: Record<number, string[]>;
  fixes: Record<number, string[]>;
  report: ReturnType<typeof creatorReport>;
  /** The plan version these entries were written from. */
  forVersion: number;
}

export interface CreatorSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  task?: CreatorTask;
  phase: Phase;
  chatId?: string;
  book?: { id: string; name: string; count: number };
  /** Short ids the model uses for the chosen book's entries: e1 is ids[0]. */
  ids?: string[];
  sources: CreatorSource[];
  messages: CreatorMessage[];
  proposal?: Proposal;
  draft?: CreatorDraft;
  saved?: { bookId: string; bookName: string; created: number; updated: number; retired: number; skipped: number; personaKept?: string };
  busy?: string;
  progress?: { done: number; total: number };
  /** The health report for the chosen book (check task). */
  report?: ReturnType<typeof healthCheck>;
}

interface SessionIndex {
  current?: string;
  list: { id: string; title: string; updatedAt: number; task?: CreatorTask }[];
}

const MAX_SESSIONS = 12;
const indexPath = "creator/index.json";
const sessionPath = (id: string) => `creator/${id}.json`;

// ---------------------------------------------------------------------------
// Storage (per user; nothing is cached from a failed read).
// ---------------------------------------------------------------------------

const sessions = new Map<string, CreatorSession>();
const indexes = new Map<string, SessionIndex>();
const key = (userId: string | undefined, id: string) => `${userId ?? ""}:${id}`;

async function loadIndex(userId?: string): Promise<SessionIndex> {
  const hit = indexes.get(userId ?? "");
  if (hit) return hit;
  const exists = await host.userStorage.exists(indexPath, userId);
  const idx: SessionIndex = exists ? await host.userStorage.getJson<SessionIndex>(indexPath, { fallback: { list: [] }, userId }) : { list: [] };
  idx.list ??= [];
  indexes.set(userId ?? "", idx);
  return idx;
}

async function saveIndex(idx: SessionIndex, userId?: string) {
  await host.userStorage.setJson(indexPath, idx, { userId });
}

async function loadSession(id: string, userId?: string): Promise<CreatorSession | null> {
  const hit = sessions.get(key(userId, id));
  if (hit) return hit;
  if (!(await host.userStorage.exists(sessionPath(id), userId))) return null;
  const s = await host.userStorage.getJson<CreatorSession>(sessionPath(id), { userId });
  if (!s?.id) return null;
  // A conversation left mid-write (the worker restarted) can be picked up again.
  if (s.busy) {
    s.busy = undefined;
    s.progress = undefined;
    if (s.phase === "generating") s.phase = s.draft ? "review" : "discuss";
  }
  sessions.set(key(userId, id), s);
  return s;
}

async function persist(s: CreatorSession, userId?: string) {
  s.updatedAt = Date.now();
  await host.userStorage.setJson(sessionPath(s.id), s, { userId });
  const idx = await loadIndex(userId);
  idx.list = [{ id: s.id, title: s.title, updatedAt: s.updatedAt, task: s.task }, ...idx.list.filter((x) => x.id !== s.id)];
  idx.current = s.id;
  for (const old of idx.list.slice(MAX_SESSIONS)) {
    sessions.delete(key(userId, old.id));
    await host.userStorage.delete(sessionPath(old.id), userId).catch(() => {});
  }
  idx.list = idx.list.slice(0, MAX_SESSIONS);
  await saveIndex(idx, userId);
}

function push(s: CreatorSession, userId?: string) {
  host.sendToFrontend({ type: "creatorSession", session: s }, userId);
}

let seq = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${(seq++ % 1296).toString(36).padStart(2, "0")}`;

function say(s: CreatorSession, text: string, extra: Partial<CreatorMessage> = {}): CreatorMessage {
  const m: CreatorMessage = { id: newId("m"), role: "almanac", text, at: Date.now(), ...extra };
  s.messages.push(m);
  return m;
}

const OPENING = "What would you like to make? I can write a new lorebook with you, update one you have, make an existing book Almanac-compatible (so every entry is read exactly), save this story as a lorebook, or check how a book reads. Pick one, or just tell me what you have in mind.";

function newSession(chatId?: string): CreatorSession {
  const now = Date.now();
  const s: CreatorSession = { id: newId("c"), createdAt: now, updatedAt: now, title: "New conversation", phase: "intake", chatId, sources: [], messages: [] };
  say(s, OPENING, { card: "tasks" });
  return s;
}

// ---------------------------------------------------------------------------
// Books.
// ---------------------------------------------------------------------------

async function entriesOf(bookId: string, userId?: string): Promise<WorldBookEntryDTO[]> {
  const out: WorldBookEntryDTO[] = [];
  for (let offset = 0; offset < 5000; offset += 200) {
    const page = await host.world_books.entries.list(bookId, { limit: 200, offset, userId });
    out.push(...page.data);
    if (page.data.length < 200) break;
  }
  return out;
}

export async function listBooks(userId?: string): Promise<{ id: string; name: string; kind?: string }[]> {
  if (!has("world_books")) return [];
  const out: { id: string; name: string; kind?: string }[] = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const page = await host.world_books.list({ limit: 100, offset, userId });
    for (const b of page.data) {
      // Books the Almanac or another memory extension rewrites on its own aren't anyone's to edit here.
      if (isMirrorBook(b)) continue;
      const md = (b.metadata ?? {}) as Record<string, unknown>;
      const kind = md.lumibooks_chat_id || md.lumibooks_codex_chat_id ? "memory" : md.vellumRole === "summary" ? "memory" : weaverBook(b, [])?.role ? "weaver" : undefined;
      out.push({ id: b.id, name: b.name, ...(kind ? { kind } : {}) });
    }
    if (page.data.length < 100) break;
  }
  return out;
}

export async function bookHealth(bookId: string, userId?: string) {
  const book = await host.world_books.get(bookId, userId).catch(() => null);
  const entries = await entriesOf(bookId, userId);
  return healthCheck(entries as BookEntry[], book ? weaverBook(book, entries) : null);
}

/** Never write into a chat's mirror (rewritten every sync) or a Dream Weaver rules book (instructions). */
async function writableBook(bookId: string, userId?: string) {
  const book = await host.world_books.get(bookId, userId).catch(() => null);
  if (!book) throw new Error("that lorebook no longer exists");
  if (isMirrorBook(book)) throw new Error("that is a chat's mirror lorebook, which the Ledger rewrites on every sync; save as a new lorebook instead");
  if (weaverBook(book, [])?.role === "governance") throw new Error("that is a Dream Weaver rules book; save as a new lorebook instead");
  return book;
}

// ---------------------------------------------------------------------------
// Sources: what the player pasted, the chat's card, their persona, the story.
// ---------------------------------------------------------------------------

async function cardSource(chatId: string | undefined, userId?: string): Promise<CreatorSource | null> {
  if (!chatId) return null;
  const L = ledgerFor(chatId, userId);
  await L.loadNames();
  const ch = L.names.characterId ? await host.characters.get(L.names.characterId, userId).catch(() => null) : null;
  if (!ch) return null;
  const text = [`Name: ${ch.name}`, ch.description, ch.personality && `Personality: ${ch.personality}`, ch.scenario && `Scenario: ${ch.scenario}`, ch.first_mes && `Opening: ${ch.first_mes}`].filter(Boolean).join("\n\n");
  return { id: newId("s"), kind: "card", label: `${ch.name}'s character card`, text };
}

async function personaSource(chatId: string | undefined, userId?: string): Promise<CreatorSource | null> {
  if (!has("personas")) return null;
  const chat = chatId && has("chats") ? await host.chats.get(chatId, userId).catch(() => null) : null;
  const pid = chatPersonaId(chat);
  const p = pid ? await host.personas.get(pid, userId).catch(() => null) : await host.personas.getActive(userId).catch(() => null);
  if (!p) return null;
  return { id: newId("s"), kind: "persona", label: `your persona, ${p.name}`, text: `Name: ${p.name}${p.title ? ` (${p.title})` : ""}\n\n${p.description ?? ""}` };
}

/** What the model sees of the sources in the conversation (long ones cut; the writer gets more). */
function sourcesFor(s: CreatorSession, budget: number): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [];
  let left = budget;
  for (const src of s.sources) {
    if (left <= 500) break;
    const text = src.text.length > left ? `${src.text.slice(0, left)}\n[… cut; the full text is used when the entries are written]` : src.text;
    left -= text.length;
    out.push({ label: src.label, text });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The conversation turn.
// ---------------------------------------------------------------------------

async function connection(userId?: string): Promise<string | undefined> {
  const st = await loadSettings(userId);
  return st.creatorConnection || st.summarizerConnection || undefined;
}

async function bookContext(s: CreatorSession, userId?: string): Promise<ChatContext["book"]> {
  if (!s.book) return undefined;
  const book = await host.world_books.get(s.book.id, userId).catch(() => null);
  if (!book) return { name: s.book.name, count: s.book.count };
  const entries = (await entriesOf(s.book.id, userId)) as BookEntry[];
  const wv = weaverBook(book, entries);
  const idx = bookIndex(entries, wv);
  s.ids = idx.ids;
  const ctx: ChatContext["book"] = { name: book.name, count: entries.length };
  // The plan already lists every entry of a conversion; the index is for updates and checks.
  if (s.task !== "convert") ctx.index = idx.text;
  if (s.task === "check" && s.report) ctx.report = reportText(s.report);
  return ctx;
}

async function modelTurn(s: CreatorSession, userId?: string) {
  const ctx: ChatContext = {
    task: s.task,
    phase: s.phase,
    book: await bookContext(s, userId),
    sources: sourcesFor(s, 24_000),
    proposal: s.proposal,
    draft: s.phase === "review" && s.draft ? draftText(s.draft.entries, s.draft.issues).slice(0, 8000) : undefined,
    history: [],
  };
  const turns = s.messages.filter((m) => m.card !== "error").slice(-18);
  const msgs = [sys(chatSystem(ctx))];
  for (const m of turns) msgs.push(m.role === "user" ? usr(m.text) : asst(m.text));
  // The last turn must be the player's; remind the model of the shape there.
  if (msgs[msgs.length - 1].role !== "user") msgs.push(usr("(Go on.)"));
  const last = msgs[msgs.length - 1];
  last.content = `${last.content}\n\n(Answer with the JSON object only.)`;
  const out = await quiet(msgs, { userId, connectionId: await connection(userId), timeoutMs: 240_000, label: "creator chat" });
  const reply = parseReply(out, extractJson);
  if (!reply.say && !reply.proposal && !reply.revise) throw new Error(`the model's reply had nothing in it${out ? ` (it began: “${out.slice(0, 80)}”)` : ""}`);

  if (reply.task && reply.task !== s.task) await setTask(s, reply.task, userId, true);
  let changed = false;
  if (reply.proposal) {
    const p = makeProposal(reply.proposal, s.task ?? "new", s.proposal, s.ids);
    if (p) {
      s.proposal = p;
      changed = true;
    }
  } else if (reply.revise && s.proposal) {
    s.proposal = reviseProposal(s.proposal, reply.revise as Revision, s.ids);
    changed = true;
  }
  if (changed && s.phase === "intake") s.phase = "discuss";
  // A conversation is named for its book once there's a plan (until then, for its task).
  if (s.proposal && (s.title === "New conversation" || TASKS.some((t) => t.label === s.title))) s.title = s.proposal.bookName;
  const needsBook = reply.needs === "book" || (s.task && TASKS.find((t) => t.id === s.task)?.needsBook && !s.book);
  say(s, reply.say || (changed ? `Here is the plan (version ${s.proposal!.version}).` : "…"), {
    ...(reply.options?.length ? { options: reply.options } : {}),
    ...(changed ? { card: "proposal" as const, version: s.proposal!.version } : needsBook ? { card: "books" as const } : {}),
  });
}

/** Run one step under the conversation's lock, report it, save it, and push it. */
async function step(s: CreatorSession, userId: string | undefined, label: string, fn: () => Promise<void>) {
  if (s.busy) throw new Error(`still ${s.busy.toLowerCase()}`);
  s.busy = label;
  push(s, userId);
  try {
    await fn();
  } catch (err) {
    warn(`creator: ${describe(err)}`);
    say(s, `That didn't work: ${describe(err)}. You can try again, or choose another connection for the creator above.`, { card: "error", options: ["Try again"] });
  } finally {
    s.busy = undefined;
    s.progress = undefined;
    await persist(s, userId).catch((err) => warn(`creator save: ${describe(err)}`));
    push(s, userId);
  }
}

// ---------------------------------------------------------------------------
// Tasks and books, chosen by click or by the model.
// ---------------------------------------------------------------------------

async function setTask(s: CreatorSession, task: CreatorTask, userId?: string, quietly = false) {
  s.task = task;
  const t = TASKS.find((x) => x.id === task)!;
  if (s.title === "New conversation") s.title = t.label;
  if (task === "story") {
    if (!s.chatId) {
      say(s, "Open the chat whose story you want to save, then ask me again from its Almanac drawer.");
      return;
    }
    const L = ledgerFor(s.chatId, userId);
    await L.refresh();
    await L.loadNames();
    const entries = codexToLorebook(L.records);
    if (!entries.length) {
      say(s, "This chat's Codex is empty so far: there's no story to save yet.");
      return;
    }
    s.proposal = storyProposal(entries, L.names.chatName || L.names.char);
    s.phase = "discuss";
    s.title = s.proposal.bookName;
    say(s, `This chat's Codex holds ${entries.length} records a lorebook can carry. Here's the plan: drop what you don't want (or tell me, "only people and places"), then accept.`, { card: "proposal", version: 1 });
    return;
  }
  if (t.needsBook && !s.book) {
    if (!quietly) say(s, task === "convert" ? "Which lorebook should I make Almanac-compatible? I'll read every entry and show you what each becomes before anything changes." : task === "update" ? "Which lorebook should I update?" : "Which lorebook should I check?", { card: "books" });
    return;
  }
  if (t.needsBook && s.book) {
    await onBook(s, userId);
    return;
  }
  if (task === "new" && !quietly) {
    say(s, "Tell me what the book is for: the world or canon, where the story starts, who it's about, and anything that differs from canon. Paste notes or lore if you have them (long text is kept as a source), or use this chat's character card.", { options: ["Use this chat's character card", "Use my persona too", "Start from a premise I'll type"] });
  }
}

async function chooseBook(s: CreatorSession, bookId: string, userId?: string) {
  const book = await host.world_books.get(bookId, userId).catch(() => null);
  if (!book) throw new Error("that lorebook no longer exists");
  const entries = await entriesOf(bookId, userId);
  s.book = { id: book.id, name: book.name, count: entries.length };
  s.proposal = undefined;
  s.draft = undefined;
  s.report = undefined;
  s.messages.push({ id: newId("m"), role: "user", text: `The book: ${book.name}`, at: Date.now() });
  if (!s.task) s.task = "update";
  await onBook(s, userId);
}

/** A book was chosen: convert reads it now, check reports, update asks what should change. */
async function onBook(s: CreatorSession, userId?: string) {
  const book = await host.world_books.get(s.book!.id, userId).catch(() => null);
  if (!book) throw new Error("that lorebook no longer exists");
  const entries = (await entriesOf(book.id, userId)) as BookEntry[];
  const wv = weaverBook(book, entries);
  s.book = { id: book.id, name: book.name, count: entries.length };
  if (s.title === "New conversation" || TASKS.some((t) => s.title === t.label || s.title.startsWith(`${t.label}: `))) s.title = `${TASKS.find((t) => t.id === s.task)?.label ?? "Lorebook"}: ${book.name}`;
  if (s.task === "check") {
    s.report = healthCheck(entries, wv);
    const r = s.report.reading;
    const look = s.report.issues.filter((i) => i.severity !== "info").length;
    say(s, `${book.name}: ${entries.length} entries. ${r.exact} ${r.exact === 1 ? "is" : "are"} read exactly (a category label or metadata), ${r.read} by ${r.read === 1 ? "its" : "their"} shape and wording${r.unsure ? `, and ${r.unsure} can't be told apart (${r.unsure === 1 ? "it goes" : "they go"} to the review queue)` : ""}. ${s.report.constantTokens} tokens are constant every turn.${look ? ` ${look === 1 ? "One thing" : `${look} things`} to look at ${look === 1 ? "is" : "are"} listed below.` : " Nothing needs fixing."}`, { card: "report", options: ["Make it Almanac-compatible", "Update it", "What should I fix first?"] });
    return;
  }
  if (s.task === "convert") {
    if (wv?.role === "governance") {
      say(s, "That is a Dream Weaver rules book: the Almanac already reads it exactly, and its entries are instructions Dream Weaver manages. Nothing to convert.");
      return;
    }
    const plan = planConversion(entries, DEFAULT_OPTIONS, wv);
    await refineUnsure(s, plan.items, entries, userId);
    const st = plan.stats;
    s.proposal = {
      version: 1, task: "convert", bookName: book.name, target: "same", options: { ...DEFAULT_OPTIONS }, items: plan.items,
      summary: `Every entry gets a category label in its title and metadata naming what it is${st.lowPriority ? `, and the ${st.lowPriority} at priority 10 (Lumiverse's import default) get a real tier` : ""}. Contents stay as they are${st.rewrites ? `, except ${st.rewrites} opening${st.rewrites === 1 ? "" : "s"} that would mislead the model` : ""}.`,
    };
    s.phase = "discuss";
    const cats = Object.entries(plan.byCategory).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${n} ${category(c)?.label.toLowerCase() ?? c}`).join(", ");
    say(s, `I read all ${st.total} entries of ${book.name}: ${cats}. ${st.exact ? `${st.exact} already read exactly and stay as they are. ` : ""}${st.convert} would change.${st.unsure ? ` ${st.unsure} were hard to tell; I asked the model about them, so check their categories.` : ""} Look over the plan: change any category, keep entries as they are, or tell me in words ("keep my titles", "leave the Theme entries alone"). Nothing is written until you accept and then save.`, { card: "proposal", version: 1, options: ["Keep my titles, add metadata only", "Don't change priorities", "Accept"] });
    return;
  }
  // update
  s.phase = s.phase === "intake" ? "discuss" : s.phase;
  say(s, `${book.name} has ${entries.length} entries. What should change? New people or places, things that are different now, entries that no longer hold: tell me, and I'll propose the edits.`, { options: ["Bring it up to where my story is now", "Add what's missing", "Fix the entries the check flags"] });
}

/** Unsure readings in a conversion get one model pass, as the review queue's classifier does. */
async function refineUnsure(s: CreatorSession, items: ProposalItem[], entries: BookEntry[], userId?: string) {
  const unsure = items.filter((i) => i.op === "convert" && (i.confidence ?? 1) < 0.5).slice(0, 40);
  if (!unsure.length || !has("generation")) return;
  const byId = new Map(entries.map((e) => [e.id, e]));
  try {
    const p = classifierPrompt(unsure.map((i) => ({ id: i.id, title: byId.get(i.entryId!)?.comment ?? i.was ?? "", content: byId.get(i.entryId!)?.content ?? "" })));
    const out = await quiet([sys(p.system), usr(p.user)], { userId, connectionId: await connection(userId), reasoningOff: true, label: "creator classify" });
    const arr = extractJson<any[]>(out) ?? [];
    for (const r of arr) {
      const it = unsure.find((i) => i.id === r?.id);
      const cat = r?.kind ? (r.kind === "forecast" ? category("upcoming") : categoryOfKind(String(r.kind))) : undefined;
      if (!it || !cat) continue;
      it.category = cat.id;
      it.title = titleOf(cat, String(r.name || (it.was ?? it.title)).replace(/\s*:\s+/g, " — "));
      it.about = `${cat.label}, read by the model.`;
      it.confidence = 0.6;
    }
  } catch (err) {
    warn(`creator classify: ${describe(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Writing the entries from an accepted plan.
// ---------------------------------------------------------------------------

export function creatorReport(entries: CreatorEntry[]) {
  const live = entries.filter((e) => e.op !== "retire");
  const link = linkEntries(live);
  const totalTokens = live.reduce((a, e) => a + estTokens(e.content), 0);
  const constantTokens = live.filter((e) => e.constant).reduce((a, e) => a + estTokens(e.content), 0);
  const positions = live.reduce<Record<string, number>>((m, e) => {
    const k = `${e.position}${e.position === 4 ? `@${e.depth}` : ""}`;
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});
  return { link, totalTokens, constantTokens, positions };
}

async function write(s: CreatorSession, userId?: string) {
  const p = s.proposal!;
  const old = s.draft;
  // Entries already written for items unchanged since are kept; the rest are written now.
  const keep = new Map<string, CreatorEntry>();
  if (old) for (const e of old.entries) if (e.item && (p.items.find((i) => i.id === e.item)?.v ?? Infinity) <= old.forVersion) keep.set(e.item, e);
  const entries: CreatorEntry[] = [];
  const issues: Record<number, string[]> = {};
  const fixes: Record<number, string[]> = {};
  const add = (e: CreatorEntry, iss: string[] = [], fx: string[] = []) => {
    e.uid = entries.length;
    entries.push(e);
    if (iss.length) issues[e.uid] = iss;
    if (fx.length) fixes[e.uid] = fx;
  };
  for (const [, e] of keep) add({ ...e }, old?.issues[e.uid] ?? [], old?.fixes[e.uid] ?? []);
  const todo = p.items.filter((i) => !keep.has(i.id) && i.op !== "keep");
  const bookEntries = s.book ? ((await entriesOf(s.book.id, userId)) as BookEntry[]) : [];
  const byId = new Map(bookEntries.map((e) => [e.id, e]));

  if (s.task === "story") {
    const L = ledgerFor(s.chatId!, userId);
    await L.refresh();
    const all = codexToLorebook(L.records);
    for (const it of todo) {
      const e = all.find((x) => x.comment === it.title) ?? all.find((x) => x.comment.toLowerCase() === it.title.toLowerCase());
      if (e) add({ ...e, item: it.id, op: "create" });
    }
  } else if (s.task === "convert") {
    const book = s.book ? await host.world_books.get(s.book.id, userId).catch(() => null) : null;
    const wv = book ? weaverBook(book, bookEntries) : null;
    const rewrites: { it: ProposalItem; e: BookEntry }[] = [];
    for (const it of todo) {
      const e = it.entryId ? byId.get(it.entryId) : undefined;
      if (!e || it.op !== "convert") continue;
      if (it.rewrite) rewrites.push({ it, e });
    }
    // Openings that mislead are rewritten (only the first sentence).
    const newContent = new Map<string, string>();
    for (let i = 0; i < rewrites.length; i += 10) {
      const batch = rewrites.slice(i, i + 10);
      try {
        const out = await quiet([sys(writerSystem()), usr(openingPrompt(batch.map(({ it, e }) => ({ title: it.title, content: e.content, reason: it.reason ?? "its opening misleads", category: it.category }))))], { userId, connectionId: await connection(userId), timeoutMs: 240_000, label: "creator openings" });
        const got = extractJson<{ entries?: any[] }>(out)?.entries ?? [];
        batch.forEach(({ it }, k) => {
          const c = got[k]?.content;
          if (typeof c === "string" && c.trim().length > 20) newContent.set(it.id, c.trim());
        });
      } catch (err) {
        warn(`creator openings: ${describe(err)}`);
      }
      s.progress = { done: Math.min(rewrites.length, i + 10), total: rewrites.length };
      push(s, userId);
    }
    for (const it of todo) {
      const e = it.entryId ? byId.get(it.entryId) : undefined;
      if (!e) continue;
      if (it.op === "retire") {
        add({ ...normalizeEntry({ ...e, order: e.order_value }, 0), entryId: e.id, item: it.id, op: "retire", disable: true });
        continue;
      }
      const upd = conversionUpdate(e, it, p.options, wv, newContent.get(it.id));
      if (!upd) continue;
      const merged = normalizeEntry({ ...e, order: e.order_value, ...upd, priority: upd.priority ?? e.priority }, 0);
      add({ ...merged, entryId: e.id, item: it.id, op: "update" }, it.rewrite && !newContent.has(it.id) ? ["its opening could not be rewritten; it is kept as it was"] : [], upd.comment ? [`title: ${e.comment} → ${upd.comment}`] : []);
    }
  } else {
    // new / update: the model writes, in batches.
    const writeItems = todo.filter((i) => i.op === "create" || i.op === "update");
    for (const it of todo.filter((i) => i.op === "retire")) {
      const e = it.entryId ? byId.get(it.entryId) : undefined;
      if (e) add({ ...normalizeEntry({ ...e, order: e.order_value }, 0), entryId: e.id, item: it.id, op: "retire", disable: true });
    }
    const titles = p.items.filter((i) => i.op !== "retire").map((i) => i.title);
    const sources = s.sources.map((x) => `[${x.label}]\n${x.text}`).join("\n\n").slice(0, 40_000);
    const asked = s.messages.filter((m) => m.role === "user").map((m) => m.text).join(" / ").slice(-1500);
    const size = 8;
    for (let i = 0; i < writeItems.length; i += size) {
      const batch = writeItems.slice(i, i + size);
      let raw: any[] = [];
      try {
        const prompt = writePrompt(batch.map((it) => {
          const e = it.entryId ? byId.get(it.entryId) : undefined;
          return { title: it.title, category: it.category, about: it.about, priority: it.priority, constant: it.constant, ...(e ? { existing: { comment: e.comment, content: e.content, key: e.key ?? [] }, note: it.about } : {}) };
        }), titles, sources, asked);
        const out = await quiet([sys(writerSystem()), usr(prompt)], { userId, connectionId: await connection(userId), timeoutMs: 300_000, label: "creator write" });
        raw = extractJson<{ entries?: any[] }>(out)?.entries ?? [];
      } catch (err) {
        warn(`creator write: ${describe(err)}`);
      }
      const used = new Set<number>();
      batch.forEach((it, k) => {
        // Match by title, else by position in the batch.
        let ri = raw.findIndex((r, j) => !used.has(j) && String(r?.comment ?? r?.title ?? "").trim().toLowerCase() === it.title.toLowerCase());
        if (ri < 0 && raw[k] && !used.has(k)) ri = k;
        if (ri < 0) {
          add(normalizeEntry({ comment: it.title, content: "", key: [], item: it.id, op: it.entryId ? "update" : "create", entryId: it.entryId }, 0), ["the model didn't write this one; rewrite it, or remove it"]);
          return;
        }
        used.add(ri);
        const r = raw[ri];
        const e = it.entryId ? byId.get(it.entryId) : undefined;
        const cat = category(it.category);
        // An update keeps the book's own fields; a new entry takes the format's.
        const base = e
          ? normalizeEntry({ ...e, order: e.order_value, comment: r.comment ?? it.title, content: r.content ?? e.content, key: Array.isArray(r.key) && r.key.length ? r.key : e.key, extensions: { ...(e.extensions ?? {}), ...(r.extensions ?? {}) }, ...(it.priority ? { priority: it.priority } : {}) }, 0)
          : normalizeEntry({ ...r, priority: r.priority ?? it.priority ?? cat?.tier, constant: r.constant ?? it.constant, position: r.position ?? it.position ?? cat?.position, depth: r.depth ?? cat?.depth }, 0);
        const v = validateEntry(base, { keepFields: !!e });
        add({ ...v.entry, item: it.id, op: e ? "update" : "create", ...(e ? { entryId: e.id } : {}) }, v.reask, v.fixes);
      });
      s.progress = { done: Math.min(writeItems.length, i + size), total: writeItems.length };
      push(s, userId);
    }
    // One round for what the model can fix.
    const redo = entries.filter((e) => issues[e.uid]?.length && e.content && e.op !== "retire").slice(0, 20);
    if (redo.length) {
      try {
        const out = await quiet([sys(writerSystem()), usr(reaskPrompt(redo.map((e) => ({ entry: e, problems: issues[e.uid] }))))], { userId, connectionId: await connection(userId), timeoutMs: 240_000, label: "creator re-ask" });
        const fixed = extractJson<{ entries?: any[] }>(out)?.entries ?? [];
        fixed.forEach((r, i) => {
          const orig = redo[i];
          if (!orig || !r) return;
          const v = validateEntry(normalizeEntry({ ...orig, ...r, priority: orig.priority, order: orig.order, position: orig.position, depth: orig.depth }, orig.uid), { keepFields: !!orig.entryId });
          entries[orig.uid] = { ...v.entry, uid: orig.uid, item: orig.item, op: orig.op, ...(orig.entryId ? { entryId: orig.entryId } : {}) };
          if (v.reask.length) issues[orig.uid] = v.reask;
          else delete issues[orig.uid];
        });
      } catch (err) {
        warn(`creator re-ask: ${describe(err)}`);
      }
    }
  }
  // Plan order, then uids in that order.
  const order = new Map(p.items.map((i, k) => [i.id, k]));
  const sorted = entries.map((e) => ({ e, iss: issues[e.uid], fx: fixes[e.uid] })).sort((a, b) => (order.get(a.e.item ?? "") ?? 1e9) - (order.get(b.e.item ?? "") ?? 1e9));
  const outIssues: Record<number, string[]> = {};
  const outFixes: Record<number, string[]> = {};
  const outEntries = sorted.map((x, i) => {
    if (x.iss) outIssues[i] = x.iss;
    if (x.fx) outFixes[i] = x.fx;
    return { ...x.e, uid: i };
  });
  s.draft = { entries: outEntries, issues: outIssues, fixes: outFixes, report: creatorReport(outEntries), forVersion: p.version };
  // Items edited by hand since the last write (marked between versions) are written now.
  for (const it of p.items) if ((it.v ?? 0) > p.version) it.v = p.version;
}

/** Only what changed, so a field Lumiverse left at "use the default" isn't pinned by a save. */
function changedFields(e: CreatorEntry, was: BookEntry | undefined): Record<string, any> {
  const full = toLumiverse(e);
  if (!was) return full;
  const out: Record<string, any> = {};
  const before: Record<string, any> = { ...was, keysecondary: was.keysecondary ?? [] };
  for (const k of ["comment", "content", "key", "keysecondary", "priority", "order_value", "position", "depth", "constant", "selective", "disabled", "extensions"]) {
    if (JSON.stringify(full[k]) !== JSON.stringify(before[k])) out[k] = full[k];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Saving.
// ---------------------------------------------------------------------------

interface SaveReq {
  target: "new" | "same";
  name?: string;
  attach?: "character" | "persona" | "chat" | "global" | "none";
  bridge?: boolean;
  replacePersonaBook?: boolean;
}

async function save(s: CreatorSession, req: SaveReq, userId?: string) {
  if (!has("world_books")) throw new Error("the world_books permission is not granted");
  const d = s.draft!;
  const p = s.proposal!;
  let created = 0;
  let updated = 0;
  let retired = 0;
  let skipped = 0;
  let bookId: string;
  let bookName: string;
  if (req.target === "same" && s.book) {
    const book = await writableBook(s.book.id, userId);
    bookId = book.id;
    bookName = book.name;
    const current = new Map(((await entriesOf(book.id, userId)) as BookEntry[]).map((e) => [e.id, e]));
    for (const e of d.entries) {
      try {
        if (e.op === "retire" && e.entryId) {
          await host.world_books.entries.update(e.entryId, { disabled: true } as any, userId);
          retired++;
        } else if (e.entryId) {
          const patch = changedFields(e, current.get(e.entryId));
          if (!Object.keys(patch).length) continue;
          await host.world_books.entries.update(e.entryId, patch as any, userId);
          updated++;
        } else {
          await host.world_books.entries.create(bookId, toLumiverse(e) as any, userId);
          created++;
        }
      } catch (err) {
        warn(`creator save ${e.comment}: ${describe(err)}`);
        skipped++;
      }
    }
  } else {
    bookName = (req.name || p.bookName || "ALMANAC lorebook").trim();
    const book = await host.world_books.create({ name: bookName, description: "Made with the ALMANAC Lorebook Creator, in the Almanac lorebook format.", metadata: { almanac_creator: CREATOR_VERSION } }, userId);
    bookId = book.id;
    // A converted or updated copy carries the rest of the source book unchanged.
    const carried: CreatorEntry[] = [];
    if (s.book && (s.task === "convert" || s.task === "update")) {
      const touched = new Set(d.entries.map((e) => e.entryId).filter(Boolean));
      for (const e of (await entriesOf(s.book.id, userId)) as BookEntry[]) if (!touched.has(e.id)) carried.push(normalizeEntry({ ...e, order: e.order_value }, 0));
    }
    for (const e of [...d.entries.filter((x) => x.op !== "retire"), ...carried]) {
      try {
        await host.world_books.entries.create(bookId, toLumiverse(e) as any, userId);
        created++;
      } catch (err) {
        warn(`creator save ${e.comment}: ${describe(err)}`);
        skipped++;
      }
    }
  }
  const personaKept = req.attach && req.attach !== "none" ? await attachBook(bookId, req.attach, s.chatId, userId, !!req.replacePersonaBook) : undefined;
  // The Lore Bridge reads the books attached to the chat (its character, persona, chat or global books).
  let bridge = "";
  if (req.bridge && s.chatId) {
    try {
      await scanLore(s.chatId, userId, true);
      const read = !!(await loadChat(s.chatId, userId)).meta.lore.books[bookId];
      bridge = read ? " The Lore Bridge has read it into this chat's Codex." : " It isn't attached to this chat (or its character, persona or global books), so the Lore Bridge doesn't read it here.";
    } catch (err) {
      warn(`creator bridge: ${describe(err)}`);
      bridge = " The Lore Bridge couldn't read the books again; use Re-read lorebooks on the Lore page.";
    }
  }
  s.saved = { bookId, bookName, created, updated, retired, skipped, ...(personaKept ? { personaKept } : {}) };
  s.phase = "saved";
  const parts = [created && `${created} created`, updated && `${updated} updated`, retired && `${retired} switched off`, skipped && `${skipped} failed (see the server log)`].filter(Boolean).join(", ");
  say(s, `Saved to ${bookName}: ${parts || "nothing to write"}.${personaKept ? ` Your persona keeps ${personaKept}; the book wasn't attached to it.` : ""}${bridge} Anything else?`, { card: "saved", options: s.task === "convert" ? ["Check it again", "Update it"] : ["Check it", "Make another"] });
}

/** Attach the book. A persona holds one lorebook: an existing one is kept unless `replace`, and its name returned. */
async function attachBook(bookId: string, where: string, chatId?: string, userId?: string, replace = false): Promise<string | undefined> {
  try {
    if (where === "global") await host.world_books.activateGlobal(bookId, userId);
    else if (where === "chat" && chatId) {
      const chat = await host.chats.get(chatId, userId);
      const md = (chat?.metadata ?? {}) as Record<string, unknown>;
      const ids = Array.isArray(md.chat_world_book_ids) ? (md.chat_world_book_ids as string[]) : [];
      if (!ids.includes(bookId)) await host.chats.update(chatId, { metadata: { ...md, chat_world_book_ids: [...ids, bookId] } }, userId);
    } else if (where === "character" && chatId) {
      const L = ledgerFor(chatId, userId);
      await L.loadNames();
      if (L.names.characterId) {
        const ch = await host.characters.get(L.names.characterId, userId);
        if (ch && !ch.world_book_ids.includes(bookId)) await host.characters.update(ch.id, { world_book_ids: [...ch.world_book_ids, bookId] } as any, userId);
      }
    } else if (where === "persona") {
      const chat = chatId && has("chats") ? await host.chats.get(chatId, userId).catch(() => null) : null;
      const pid = chatPersonaId(chat);
      const pr = pid ? await host.personas.get(pid, userId) : await host.personas.getActive(userId);
      if (pr) {
        const cur = pr.attached_world_book_id;
        if (cur && cur !== bookId && !replace) {
          const old = await host.world_books.get(cur, userId).catch(() => null);
          return old?.name ?? "its current lorebook";
        }
        await host.personas.update(pr.id, { attached_world_book_id: bookId } as any, userId);
      }
    }
  } catch (err) {
    warn(`attach book: ${describe(err)}`);
  }
  return undefined;
}

function reportText(r: ReturnType<typeof healthCheck>): string {
  const cats = Object.entries(r.reading.byCategory).map(([c, n]) => `${n} ${c}`).join(", ");
  return `Reading: ${r.reading.exact} exact, ${r.reading.read} by shape, ${r.reading.unsure} unsure (${cats}). Constant: ${r.constantTokens} tokens a turn.\nIssues:\n${r.issues.slice(0, 30).map((i) => `- ${i.entry}: ${i.issue}`).join("\n")}`;
}

// ---------------------------------------------------------------------------
// The frontend's requests.
// ---------------------------------------------------------------------------

export interface CreatorRequest {
  action: string;
  id?: string;
  text?: string;
  task?: CreatorTask;
  bookId?: string;
  source?: "card" | "persona";
  sourceId?: string;
  revision?: Revision;
  uid?: number;
  note?: string;
  patch?: { comment?: string; content?: string; key?: string[] };
  scene?: string;
  save?: SaveReq;
  chatId?: string;
}

/** Handle one request; returns what the caller needs right away (the session is also pushed). */
export async function creatorAction(req: CreatorRequest, userId?: string): Promise<Record<string, unknown>> {
  const idx = await loadIndex(userId);
  if (req.action === "list") return { list: idx.list };
  if (req.action === "new") {
    const s = newSession(req.chatId);
    sessions.set(key(userId, s.id), s);
    await persist(s, userId);
    return { session: s, list: (await loadIndex(userId)).list };
  }
  if (req.action === "delete" && req.id) {
    sessions.delete(key(userId, req.id));
    await host.userStorage.delete(sessionPath(req.id), userId).catch(() => {});
    idx.list = idx.list.filter((x) => x.id !== req.id);
    if (idx.current === req.id) idx.current = idx.list[0]?.id;
    await saveIndex(idx, userId);
    const next = idx.current ? await loadSession(idx.current, userId) : null;
    return { session: next, list: idx.list };
  }
  const id = req.id ?? idx.current;
  let s = id ? await loadSession(id, userId) : null;
  if (req.action === "open" || !s) {
    if (!s) {
      s = newSession(req.chatId);
      sessions.set(key(userId, s.id), s);
      await persist(s, userId);
    } else if (idx.current !== s.id) {
      idx.current = s.id;
      await saveIndex(idx, userId);
    }
    if (req.chatId && !s.chatId) s.chatId = req.chatId;
    if (req.action === "open") return { session: s, list: idx.list };
  }
  const S = s;
  if (req.chatId) S.chatId = req.chatId;
  return serial(`creator:${userId ?? ""}:${S.id}`, async () => {
    const accept = async () => {
      if (!S.proposal) throw new Error("there is no plan to accept yet");
      if (!S.proposal.items.some((i) => i.op !== "keep")) {
        say(S, "Every entry in the plan is kept as it is, so there's nothing to write.");
        await persist(S, userId);
        push(S, userId);
        return;
      }
      S.messages.push({ id: newId("m"), role: "user", text: `Accept the plan (version ${S.proposal.version}).`, at: Date.now() });
      S.phase = "generating";
      await step(S, userId, S.task === "convert" ? "Converting the entries" : "Writing the entries", async () => {
        await write(S, userId);
        S.phase = "review";
        const d = S.draft!;
        const flagged = Object.keys(d.issues).length;
        say(S, `${S.task === "convert" ? "Converted" : "Written"}: ${d.entries.length} entr${d.entries.length === 1 ? "y" : "ies"}, about ${d.report.totalTokens.toLocaleString("en")} tokens${d.report.constantTokens ? ` (${d.report.constantTokens} constant every turn)` : ""}. ${flagged ? `${flagged} still ha${flagged === 1 ? "s" : "ve"} notes; rewrite or edit ${flagged === 1 ? "it" : "them"} below. ` : ""}Look them over, try the activation check, then save.`, { card: "result", version: S.proposal!.version });
      });
      if (S.phase === "generating") {
        S.phase = S.draft ? "review" : "discuss";
        await persist(S, userId);
        push(S, userId);
      }
    };
    switch (req.action) {
      case "send": {
        const text = String(req.text ?? "").trim();
        if (!text) return {};
        // "Try again" after an error: the same turn once more, not a new message.
        if (/^try again$/i.test(text) && S.messages[S.messages.length - 1]?.card === "error") {
          await step(S, userId, "Thinking", () => modelTurn(S, userId));
          return {};
        }
        if (/^accept$/i.test(text) && S.proposal && S.phase !== "generating") {
          await accept();
          return {};
        }
        // Long pastes are kept as sources; the conversation holds a pointer.
        if (text.length > 1500) {
          const src: CreatorSource = { id: newId("s"), kind: "text", label: `pasted text ${S.sources.filter((x) => x.kind === "text").length + 1}`, text };
          S.sources.push(src);
          const lead = text.split(/\n/)[0].slice(0, 120);
          S.messages.push({ id: newId("m"), role: "user", text: `[Pasted ${text.length.toLocaleString("en")} characters, kept as “${src.label}”: ${lead}…]`, at: Date.now() });
        } else {
          S.messages.push({ id: newId("m"), role: "user", text, at: Date.now() });
        }
        // A click on an offered reply that the Almanac handles itself.
        if (/^use this chat'?s character card$/i.test(text)) {
          await step(S, userId, "Reading the card", async () => {
            const c = await cardSource(S.chatId, userId);
            if (c) {
              S.sources.push(c);
              if (!S.task) S.task = "new";
            }
            await modelTurn(S, userId);
          });
          return {};
        }
        if (/^use my persona( too)?$/i.test(text)) {
          await step(S, userId, "Reading your persona", async () => {
            const c = await personaSource(S.chatId, userId);
            if (c) S.sources.push(c);
            await modelTurn(S, userId);
          });
          return {};
        }
        if (/^make it almanac-compatible$/i.test(text) && S.book) {
          await step(S, userId, "Reading the book", () => setTask(S, "convert", userId));
          return {};
        }
        if (/^check it( again)?$/i.test(text) && (S.book || S.saved)) {
          if (!S.book && S.saved) S.book = { id: S.saved.bookId, name: S.saved.bookName, count: 0 };
          await step(S, userId, "Checking the book", () => setTask(S, "check", userId));
          return {};
        }
        await step(S, userId, "Thinking", () => modelTurn(S, userId));
        return {};
      }
      case "task": {
        const t = TASKS.find((x) => x.id === req.task);
        if (!t) throw new Error("unknown task");
        S.messages.push({ id: newId("m"), role: "user", text: t.label, at: Date.now() });
        await step(S, userId, t.id === "convert" ? "Reading the book" : "Getting ready", () => setTask(S, t.id, userId));
        return {};
      }
      case "book": {
        if (!req.bookId) throw new Error("no book chosen");
        await step(S, userId, S.task === "convert" ? "Reading every entry" : "Reading the book", () => chooseBook(S, req.bookId!, userId));
        return {};
      }
      case "source": {
        await step(S, userId, "Adding the source", async () => {
          const c = req.source === "persona" ? await personaSource(S.chatId, userId) : await cardSource(S.chatId, userId);
          if (!c) {
            say(S, req.source === "persona" ? "I couldn't find your persona." : "This chat has no character card I can read.");
            return;
          }
          S.sources.push(c);
          say(S, `Added ${c.label} as a source (${c.text.length.toLocaleString("en")} characters).`);
        });
        return {};
      }
      case "dropSource": {
        S.sources = S.sources.filter((x) => x.id !== req.sourceId);
        await persist(S, userId);
        push(S, userId);
        return {};
      }
      case "edit": {
        // The player's own edits to the plan: applied in place (no new version, no model call).
        if (!S.proposal || !req.revision) return {};
        const next = reviseProposal(S.proposal, req.revision, S.ids);
        next.version = S.proposal.version;
        next.items = next.items.map((i) => ({ ...i, v: S.proposal!.items.find((o) => o.id === i.id)?.v ?? i.v }));
        // A changed item is written again even when the version stays.
        for (const ch of req.revision.change ?? []) {
          const it = next.items.find((i) => i.id === ch.id);
          if (it) it.v = S.proposal.version + 0.5;
        }
        next.dropped = [...(S.proposal.dropped ?? []), ...(next.dropped ?? [])];
        S.proposal = next;
        await persist(S, userId);
        push(S, userId);
        return {};
      }
      case "accept":
        await accept();
        return {};
      case "rewrite": {
        const d = S.draft;
        const e = d?.entries.find((x) => x.uid === req.uid);
        if (!d || !e) throw new Error("that entry is gone");
        await step(S, userId, "Rewriting", async () => {
          const it = S.proposal?.items.find((i) => i.id === e.item);
          const prompt = writePrompt([{ title: e.comment, category: it?.category, existing: { comment: e.comment, content: e.content, key: e.key }, note: req.note || (d.issues[e.uid] ?? []).join("; ") || "make it better" }], d.entries.map((x) => x.comment), S.sources.map((x) => x.text).join("\n\n").slice(0, 20_000));
          const out = await quiet([sys(writerSystem()), usr(prompt)], { userId, connectionId: await connection(userId), timeoutMs: 180_000, label: "creator rewrite" });
          const r = extractJson<{ entries?: any[] }>(out)?.entries?.[0];
          if (!r) throw new Error("the model gave nothing usable");
          const v = validateEntry(normalizeEntry({ ...e, ...r, priority: e.priority, order: e.order, position: e.position, depth: e.depth }, e.uid), { keepFields: true });
          d.entries[d.entries.indexOf(e)] = { ...v.entry, uid: e.uid, item: e.item, op: e.op, ...(e.entryId ? { entryId: e.entryId } : {}) };
          if (v.reask.length) d.issues[e.uid] = v.reask;
          else delete d.issues[e.uid];
          d.report = creatorReport(d.entries);
        });
        return {};
      }
      case "entry": {
        const d = S.draft;
        const e = d?.entries.find((x) => x.uid === req.uid);
        if (!d || !e || !req.patch) return {};
        const v = validateEntry(normalizeEntry({ ...e, ...req.patch }, e.uid), { keepFields: true });
        d.entries[d.entries.indexOf(e)] = { ...v.entry, uid: e.uid, item: e.item, op: e.op, ...(e.entryId ? { entryId: e.entryId } : {}) };
        if (v.reask.length) d.issues[e.uid] = v.reask;
        else delete d.issues[e.uid];
        d.report = creatorReport(d.entries);
        await persist(S, userId);
        push(S, userId);
        return {};
      }
      case "dropEntry": {
        const d = S.draft;
        if (!d) return {};
        d.entries = d.entries.filter((x) => x.uid !== req.uid);
        delete d.issues[req.uid!];
        d.report = creatorReport(d.entries);
        await persist(S, userId);
        push(S, userId);
        return {};
      }
      case "simulate":
        return { activation: simulateActivation(S.draft?.entries ?? [], req.scene ?? "") };
      case "export":
        return { json: toSillyTavern(S.draft?.entries ?? []), name: S.proposal?.bookName ?? "almanac-lorebook" };
      case "save": {
        if (!S.draft) throw new Error("nothing is written yet");
        await step(S, userId, "Saving", () => save(S, req.save ?? { target: "new" }, userId));
        return {};
      }
      case "retry": {
        // The last thing the player said, once more.
        await step(S, userId, "Thinking", () => modelTurn(S, userId));
        return {};
      }
      default:
        throw new Error(`unknown creator action ${req.action}`);
    }
  });
}
