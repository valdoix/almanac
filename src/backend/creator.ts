// Lorebook Creator service: plan → generate in batches → validate (auto-fix +
// re-ask) → link → preview/simulate → write to Lumiverse (new book / merge) and
// attach, or export JSON.

import { batchPrompt, codexToLorebook, CREATOR_SYSTEM, linkEntries, normalizeEntry, planPrompt, simulateActivation, toLumiverse, toSillyTavern, validateEntry, healthCheck, type CreatorEntry } from "../core/creator";
import { extractJson } from "../core/prompts";
import { estTokens } from "../core/util";
import { describe, has, host, warn } from "./host";
import { chatPersonaId, ledgerFor } from "./ledger";
import { quiet, sys, usr } from "./llm";
import { loadSettings } from "./store";
import { scanLore } from "./lorebridge";
import { weaverBook } from "../core/lore";

export interface CreatorPlanItem {
  title: string;
  description?: string;
  priority?: number;
  constant?: boolean;
  position?: number;
}

async function sourceText(src: { kind: string; text?: string; chatId?: string; bookId?: string }, userId?: string): Promise<string> {
  if (src.kind === "text") return src.text ?? "";
  if (src.kind === "character" && src.chatId) {
    const L = ledgerFor(src.chatId, userId);
    await L.loadNames();
    const ch = L.names.characterId ? await host.characters.get(L.names.characterId, userId).catch(() => null) : null;
    if (!ch) return "";
    return [`Name: ${ch.name}`, ch.description, ch.personality && `Personality: ${ch.personality}`, ch.scenario && `Scenario: ${ch.scenario}`, ch.first_mes && `Opening: ${ch.first_mes}`].filter(Boolean).join("\n\n");
  }
  if (src.kind === "book" && src.bookId) {
    const out: string[] = [];
    for (let offset = 0; offset < 5000; offset += 200) {
      const page = await host.world_books.entries.list(src.bookId, { limit: 200, offset, userId });
      for (const e of page.data) out.push(`[${e.comment}] ${e.content}`);
      if (page.data.length < 200) break;
    }
    return out.join("\n\n");
  }
  return src.text ?? "";
}

export async function creatorPlan(req: { mode: "quick" | "guided" | "suggest" | "parse" | "category"; source: any; notes?: string }, userId?: string): Promise<CreatorPlanItem[]> {
  const settings = await loadSettings(userId);
  const text = await sourceText(req.source, userId);
  if (req.source.kind === "codex" && req.source.chatId) {
    const L = ledgerFor(req.source.chatId, userId);
    await L.refresh();
    return codexToLorebook(L.records).map((e) => ({ title: e.comment, description: e.content.slice(0, 120), priority: e.priority, constant: e.constant, position: e.position }));
  }
  const out = await quiet([sys(CREATOR_SYSTEM), usr(planPrompt(req.mode, text.slice(0, 60_000), req.notes))], { userId, connectionId: settings.summarizerConnection || undefined, timeoutMs: 180_000, label: "creator plan" });
  const j = extractJson<{ entries?: CreatorPlanItem[] }>(out);
  return (j?.entries ?? []).filter((e) => e && e.title).slice(0, 120);
}

export async function creatorGenerate(req: { plan: CreatorPlanItem[]; source: any; batchSize?: number }, userId?: string, onProgress?: (done: number, total: number) => void): Promise<{ entries: CreatorEntry[]; issues: Record<number, string[]>; fixes: Record<number, string[]> }> {
  const settings = await loadSettings(userId);
  if (req.source.kind === "codex" && req.source.chatId) {
    const L = ledgerFor(req.source.chatId, userId);
    await L.refresh();
    const entries = codexToLorebook(L.records);
    return { entries, issues: {}, fixes: {} };
  }
  const text = (await sourceText(req.source, userId)).slice(0, 40_000);
  const titles = req.plan.map((p) => p.title);
  const size = req.batchSize ?? 10;
  const entries: CreatorEntry[] = [];
  const issues: Record<number, string[]> = {};
  const fixes: Record<number, string[]> = {};
  for (let i = 0; i < req.plan.length; i += size) {
    const batch = req.plan.slice(i, i + size);
    let raw: any[] = [];
    try {
      const out = await quiet([sys(CREATOR_SYSTEM), usr(batchPrompt(batch, titles, text))], { userId, connectionId: settings.summarizerConnection || undefined, timeoutMs: 240_000, label: "creator batch" });
      raw = extractJson<{ entries?: any[] }>(out)?.entries ?? [];
    } catch (err) {
      warn(`creator batch: ${describe(err)}`);
    }
    for (const r of raw) {
      const planned = batch.find((b) => b.title.toLowerCase() === String(r.comment ?? "").toLowerCase());
      const e = normalizeEntry({ ...r, priority: r.priority ?? planned?.priority, constant: r.constant ?? planned?.constant, position: r.position ?? planned?.position }, entries.length);
      const v = validateEntry(e);
      entries.push(v.entry);
      if (v.reask.length) issues[v.entry.uid] = v.reask;
      if (v.fixes.length) fixes[v.entry.uid] = v.fixes;
    }
    onProgress?.(Math.min(req.plan.length, i + size), req.plan.length);
  }
  // One re-ask round for entries with model-fixable problems.
  const redo = entries.filter((e) => issues[e.uid]);
  if (redo.length) {
    try {
      const prompt = `Rewrite these lorebook entries to fix the listed problems. Keep everything else. Return {"entries":[…]} in the same order.\n\n${redo.map((e) => `PROBLEMS: ${issues[e.uid].join("; ")}\nENTRY: ${JSON.stringify({ comment: e.comment, content: e.content, key: e.key, extensions: e.extensions })}`).join("\n\n")}`;
      const out = await quiet([sys(CREATOR_SYSTEM), usr(prompt)], { userId, connectionId: settings.summarizerConnection || undefined, timeoutMs: 240_000, label: "creator re-ask" });
      const fixed = extractJson<{ entries?: any[] }>(out)?.entries ?? [];
      fixed.forEach((r, i) => {
        const orig = redo[i];
        if (!orig || !r) return;
        const v = validateEntry(normalizeEntry({ ...orig, ...r, priority: orig.priority, order: orig.order, position: orig.position, depth: orig.depth }, orig.uid));
        entries[entries.findIndex((x) => x.uid === orig.uid)] = v.entry;
        if (v.reask.length) issues[orig.uid] = v.reask;
        else delete issues[orig.uid];
      });
    } catch (err) {
      warn(`creator re-ask: ${describe(err)}`);
    }
  }
  return { entries, issues, fixes };
}

export function creatorReport(entries: CreatorEntry[]) {
  const link = linkEntries(entries);
  const tokens = entries.map((e) => ({ uid: e.uid, tokens: estTokens(e.content) }));
  const constantTokens = entries.filter((e) => e.constant).reduce((a, e) => a + estTokens(e.content), 0);
  const positions = entries.reduce<Record<string, number>>((m, e) => ((m[`${e.position}${e.position === 4 ? `@${e.depth}` : ""}`] = (m[`${e.position}${e.position === 4 ? `@${e.depth}` : ""}`] ?? 0) + 1), m), {});
  return { link, tokens, totalTokens: tokens.reduce((a, t) => a + t.tokens, 0), constantTokens, positions };
}

export function creatorSimulate(entries: CreatorEntry[], scene: string) {
  return simulateActivation(entries, scene);
}

export function creatorExport(entries: CreatorEntry[]) {
  return toSillyTavern(entries);
}

export async function creatorWrite(req: { entries: CreatorEntry[]; target: { kind: "new"; name: string } | { kind: "merge"; bookId: string }; attach?: "character" | "persona" | "chat" | "global" | "none"; chatId?: string; bridge?: boolean; overwrite?: boolean; replacePersonaBook?: boolean }, userId?: string): Promise<{ bookId: string; created: number; updated: number; skipped: number; personaKept?: string }> {
  if (!has("world_books")) throw new Error("the world_books permission is not granted");
  let bookId: string;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  if (req.target.kind === "merge") {
    // Never into a book the Ledger or the Dream Weaver manages: the mirror is rewritten every sync, and a rules book is instructions.
    const book = await host.world_books.get(req.target.bookId, userId).catch(() => null);
    if (!book) throw new Error("that lorebook no longer exists");
    if (typeof (book.metadata as any)?.almanac_chat_id === "string") throw new Error("that is a chat's mirror lorebook, which the Ledger rewrites on every sync; save as a new lorebook instead");
    if (weaverBook(book, [])?.role === "governance") throw new Error("that is a Dream Weaver rules book; save as a new lorebook instead");
  }
  if (req.target.kind === "new") {
    const book = await host.world_books.create({ name: req.target.name || "ALMANAC lorebook", description: "Made with the ALMANAC Lorebook Creator (VELLUM III conventions).", metadata: { almanac_creator: true } }, userId);
    bookId = book.id;
  } else bookId = req.target.bookId;
  const existing = new Map<string, string>();
  if (req.target.kind === "merge") {
    for (let offset = 0; offset < 5000; offset += 200) {
      const page = await host.world_books.entries.list(bookId, { limit: 200, offset, userId });
      for (const e of page.data) existing.set(e.comment.toLowerCase(), e.id);
      if (page.data.length < 200) break;
    }
  }
  for (const e of req.entries) {
    const payload = toLumiverse(e);
    const hit = existing.get(e.comment.toLowerCase());
    // An entry with the same title is replaced only when the player said so.
    if (hit && !req.overwrite) {
      skipped++;
      continue;
    }
    try {
      if (hit) {
        await host.world_books.entries.update(hit, payload, userId);
        updated++;
      } else {
        await host.world_books.entries.create(bookId, payload, userId);
        created++;
      }
    } catch (err) {
      warn(`creator write ${e.comment}: ${describe(err)}`);
    }
  }
  const personaKept = req.attach && req.attach !== "none" ? await attachBook(bookId, req.attach, req.chatId, userId, !!req.replacePersonaBook) : undefined;
  if (req.bridge && req.chatId) await scanLore(req.chatId, userId, true);
  return { bookId, created, updated, skipped, ...(personaKept ? { personaKept } : {}) };
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
      const p = pid ? await host.personas.get(pid, userId) : await host.personas.getActive(userId);
      if (p) {
        const cur = p.attached_world_book_id;
        if (cur && cur !== bookId && !replace) {
          const old = await host.world_books.get(cur, userId).catch(() => null);
          return old?.name ?? "its current lorebook";
        }
        await host.personas.update(p.id, { attached_world_book_id: bookId } as any, userId);
      }
    }
  } catch (err) {
    warn(`attach book: ${describe(err)}`);
  }
  return undefined;
}

export async function bookHealth(bookId: string, userId?: string) {
  const entries: any[] = [];
  for (let offset = 0; offset < 5000; offset += 200) {
    const page = await host.world_books.entries.list(bookId, { limit: 200, offset, userId });
    entries.push(...page.data);
    if (page.data.length < 200) break;
  }
  return healthCheck(entries);
}

export async function listBooks(userId?: string) {
  if (!has("world_books")) return [];
  const out: { id: string; name: string }[] = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const page = await host.world_books.list({ limit: 100, offset, userId });
    out.push(...page.data.map((b) => ({ id: b.id, name: b.name })));
    if (page.data.length < 100) break;
  }
  return out;
}
