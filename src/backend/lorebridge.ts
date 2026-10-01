// Lore Bridge service: gather the books Lumiverse activates for the chat
// (character, persona, chat, global), classify each entry with VELLUM III rules,
// and seed Codex baselines. Books are read-only unless the user allows more.

import type { WorldBookEntryDTO } from "lumiverse-spindle-types";
import { classify, seedOverlays, weaverBook, weaverWorldCard, type Classified } from "../core/lore";
import { classifierPrompt, extractJson } from "../core/prompts";
import { hash } from "../core/util";
import { debug, describe, has, host, serial, warn } from "./host";
import { chatCharacterIds, chatPersonaId, ledgerFor } from "./ledger";
import { quiet, sys, usr } from "./llm";
import { loadChat, loadSettings, save } from "./store";

async function entriesOf(bookId: string, userId?: string): Promise<WorldBookEntryDTO[]> {
  const out: WorldBookEntryDTO[] = [];
  for (let offset = 0; offset < 10000; offset += 200) {
    const page = await host.world_books.entries.list(bookId, { limit: 200, offset, userId });
    out.push(...page.data);
    if (page.data.length < 200) break;
  }
  return out;
}

export async function attachedBooks(chatId: string, userId?: string, cards?: { name?: string; extensions?: Record<string, any> }[]): Promise<{ id: string; scope: string }[]> {
  const out: { id: string; scope: string }[] = [];
  const files = await loadChat(chatId, userId);
  const mirror = files.meta.mirror.bookId;
  try {
    const chat = has("chats") ? await host.chats.get(chatId, userId) : null;
    if (chat) {
      if (has("characters")) {
        // A group chat carries every member's card and books, the focused card first.
        for (const cid of chatCharacterIds(chat)) {
          const ch = await host.characters.get(cid, userId).catch(() => null);
          if (ch) cards?.push(ch);
          for (const id of ch?.world_book_ids ?? []) out.push({ id, scope: "character" });
        }
      }
      for (const id of ((chat.metadata as any)?.chat_world_book_ids ?? []) as string[]) out.push({ id, scope: "chat" });
    }
    if (has("personas")) {
      const pid = chatPersonaId(chat);
      const p = pid ? await host.personas.get(pid, userId).catch(() => null) : await host.personas.getActive(userId).catch(() => null);
      if (p?.attached_world_book_id) out.push({ id: p.attached_world_book_id, scope: "persona" });
    }
    if (has("world_books")) for (const id of await host.world_books.getGlobal(userId).catch(() => [] as string[])) out.push({ id, scope: "global" });
  } catch (err) {
    warn(`attached books: ${describe(err)}`);
  }
  const seen = new Set<string>();
  return out.filter((b) => b.id !== mirror && !seen.has(b.id) && seen.add(b.id));
}

/** A book the Ledger made as some chat's mirror (a fork inherits its source's). Never read as lore. */
export function isMirrorBook(book: { metadata?: unknown } | null | undefined): boolean {
  const md = (book?.metadata ?? {}) as Record<string, unknown>;
  return typeof md.almanac_chat_id === "string";
}

export function scanLore(chatId: string, userId?: string, force = false): Promise<{ books: number; entries: number; review: number }> {
  return serial(`lore:${chatId}`, async () => {
    if (!has("world_books")) return { books: 0, entries: 0, review: 0 };
    const files = await loadChat(chatId, userId);
    const settings = await loadSettings(userId);
    const meta = files.meta;
    if (!force && meta.lore.lastScan && Date.now() - meta.lore.lastScan < 60_000) return { books: Object.keys(meta.lore.books).length, entries: 0, review: meta.lore.review.length };
    const cards: { name?: string; extensions?: Record<string, any> }[] = [];
    const books = await attachedBooks(chatId, userId, cards);
    const worldCard = weaverWorldCard(cards[0]);
    const L = ledgerFor(chatId, userId);
    if (!L.names.user || L.names.user === "You") await L.loadNames();
    let entryCount = 0;
    const classified: Classified[] = [];
    const liveBooks = new Set<string>();
    for (const b of books) {
      const book = await host.world_books.get(b.id, userId).catch(() => null);
      if (!book || isMirrorBook(book)) continue;
      liveBooks.add(b.id);
      const entries = await entriesOf(b.id, userId).catch(() => [] as WorldBookEntryDTO[]);
      const wv = weaverBook(book, entries);
      // The narrator card of a Weaver world: its rules book speaks to a narrator even when nothing in it says so.
      if (wv?.role === "governance" && worldCard) wv.world = true;
      // A Weaver rules book is always-on by design: its keywords (none) and constants decide.
      const mode = wv?.role === "governance" ? "native" : settings.loreDefaultMode;
      const state = (meta.lore.books[b.id] ??= { name: book.name, scope: b.scope, mode, permission: "read", entryHashes: {}, count: 0 });
      state.name = book.name;
      state.scope = b.scope;
      if (wv?.role === "governance" && !state.weaver) state.mode = "native";
      state.weaver = wv?.role;
      state.count = entries.length;
      state.kinds = {};
      state.pinned = [];
      state.playbooks = [];
      for (const e of entries) {
        if (e.disabled) continue;
        entryCount++;
        const h = hash(`${e.comment}|${e.content}|${e.key.join(",")}|${JSON.stringify(e.extensions ?? {})}`);
        const c = classify({ id: e.id, world_book_id: b.id, comment: e.comment, content: e.content, key: e.key, disabled: e.disabled, constant: e.constant, extensions: e.extensions as any }, wv);
        classified.push(c);
        state.entryHashes[e.id] = h;
        state.kinds[c.kind] = (state.kinds[c.kind] ?? 0) + 1;
        if (c.pinned) state.pinned.push(e.id);
        if (c.kind === "playbook") state.playbooks.push(e.id);
      }
    }
    for (const id of Object.keys(meta.lore.books)) if (!liveBooks.has(id)) delete meta.lore.books[id];
    // A Weaver world: the card is a narrator and its anchor the place it runs (the card holds the
    // full premise and tension; the anchor only a cut-down line). Agency counts only while its entry is on.
    const worldAnchor = classified.find((c) => c.weaver?.part === "anchor" && c.kind === "place");
    const agency = classified.find((c) => c.weaver?.part === "agenda");
    if (worldAnchor && worldCard) {
      if (worldCard.name) worldAnchor.name = worldCard.name;
      if (worldCard.premise) worldAnchor.summary = worldCard.premise.slice(0, 600);
      if (worldCard.tension) worldAnchor.tension = worldCard.tension.slice(0, 400);
    }
    meta.lore.world = worldCard || worldAnchor
      ? {
          name: worldCard?.name || worldAnchor!.name,
          premise: worldCard?.premise ?? worldAnchor?.summary,
          tension: worldCard?.tension ?? worldAnchor?.tension,
          ...(agency?.agenda || agency?.holds?.length ? { agenda: agency.agenda, holds: agency.holds } : {}),
        }
      : undefined;
    // Seed overlays (never over locked user edits, never over story-derived fields)
    const seeded = seedOverlays(classified, { userName: L.names.user });
    const liveEntryIds = new Set(classified.map((c) => c.entryId));
    // An entry now read under a different record (a depth scene once filed as a custom, now a playbook): drop the old reading.
    const seededFor = new Map(Object.values(seeded).map((o) => [o.provenance?.loreEntryId, o.id]));
    // Entries now read as instructions, or read exactly (Weaver rules and re-anchors), whose older
    // readings are stale: an earlier scan or the model filed them as story texture or a person "Weaver".
    const rules = new Set(classified.filter((c) => c.kind === "directive" || c.kind === "meta" || c.pinned).map((c) => c.entryId));
    for (const [id, ov] of Object.entries(files.codex.overlays)) {
      if (ov.provenance?.source !== "lore" || !ov.provenance.loreEntryId || ov.locked || seeded[id]) continue;
      if (!liveEntryIds.has(ov.provenance.loreEntryId) || rules.has(ov.provenance.loreEntryId)) delete files.codex.overlays[id];
      else if (seededFor.has(ov.provenance.loreEntryId) && seededFor.get(ov.provenance.loreEntryId) !== id && ov.standalone) delete files.codex.overlays[id];
    }
    for (const [id, ov] of Object.entries(seeded)) {
      const cur = files.codex.overlays[id];
      if (cur?.locked) continue;
      if (cur && cur.provenance?.source && cur.provenance.source !== "lore") {
        // A story/archivist overlay exists: keep it, but remember the lore link and baseline body.
        cur.provenance = { ...cur.provenance, loreEntryId: ov.provenance?.loreEntryId, loreBookId: ov.provenance?.loreBookId };
        cur.body = { ...(ov.body ?? {}), ...(cur.body ?? {}) };
        continue;
      }
      // A playbook already played keeps its status across rescans.
      files.codex.overlays[id] = { ...ov, keys: ov.keys ?? cur?.keys, userKeys: cur?.userKeys, ...(ov.kind === "playbook" && cur?.status ? { status: cur.status } : {}) };
    }
    meta.lore.review = classified.filter((c) => c.confidence < 0.5).map((c) => ({ entryId: c.entryId, bookId: c.bookId, title: c.name, kind: c.kind, confidence: c.confidence })).slice(0, 200);
    meta.lore.lastScan = Date.now();
    save(chatId, "meta", userId);
    save(chatId, "codex", userId);
    debug(`lore scan ${chatId}: ${books.length} books, ${entryCount} entries, ${meta.lore.review.length} to review`);
    return { books: books.length, entries: entryCount, review: meta.lore.review.length };
  });
}

/** LLM classifier for the review queue (batched). */
export async function classifyReview(chatId: string, userId?: string): Promise<number> {
  const files = await loadChat(chatId, userId);
  const settings = await loadSettings(userId);
  const queue = files.meta.lore.review.slice(0, 24);
  if (!queue.length) return 0;
  const entries: { id: string; title: string; content: string }[] = [];
  for (const q of queue) {
    const e = await host.world_books.entries.get(q.entryId, userId).catch(() => null);
    if (e) entries.push({ id: e.id, title: e.comment, content: e.content });
  }
  const p = classifierPrompt(entries);
  const text = await quiet([sys(p.system), usr(p.user)], { connectionId: settings.summarizerConnection || undefined, userId, reasoningOff: true, label: "lore classifier" });
  const arr = extractJson<any[]>(text) ?? [];
  let n = 0;
  for (const r of arr) {
    const q = queue.find((x) => x.entryId === r.id);
    if (!q || !r.kind) continue;
    const e = entries.find((x) => x.id === r.id)!;
    const c = classify({ id: e.id, world_book_id: q.bookId, comment: e.title, content: e.content, key: [], extensions: { vellum3: { kind: r.kind === "forecast" ? "situation" : r.kind, tense: r.kind === "forecast" ? "future" : r.tense, participants: r.participants, members: r.members, place: r.place, visibility: r.visibility } } });
    if (r.name) c.name = r.name;
    Object.assign(files.codex.overlays, seedOverlays([c]));
    files.meta.lore.review = files.meta.lore.review.filter((x) => x.entryId !== r.id);
    n++;
  }
  save(chatId, "meta", userId);
  save(chatId, "codex", userId);
  return n;
}
