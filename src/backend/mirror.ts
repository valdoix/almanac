// Hybrid storage (design 06): extension storage is the source of truth; a
// per-chat world book "ALMANAC · <chat>" is a managed projection of the Codex
// and Chronicle. The WI interceptor decides which mirror entries the host may
// inject each turn (forced picks, everything else disabled), so there is no
// double injection. Edits made to mirror entries in Lumiverse's world-book panel
// flow back as locked user overlays.

import type { WorldBookEntryDTO } from "lumiverse-spindle-types";
import type { CodexRecord } from "../core/codex";
import { renderRecord } from "../core/recall";
import { hash } from "../core/util";
import { unitHeader } from "../core/chronicle";
import { debug, describe, has, host, serial, warn } from "./host";
import { ledgerFor } from "./ledger";
import { loadChat, loadSettings, save } from "./store";
import { isEnabled } from "./turn";

const LABEL: Record<string, string> = {
  person: "Character", place: "Location", object: "Item", group: "Faction", thread: "CURRENT", document: "Document",
  consequence: "CURRENT", fact: "Belief", texture: "Customs", clue: "Clue", forecast: "Upcoming", law: "Rule", history: "History",
  situation: "CURRENT", boundary: "Timeline Boundary", belief: "Belief",
};

function titleFor(r: CodexRecord): string {
  let label = LABEL[r.kind] ?? "Note";
  if (r.kind === "thread" && r.status === "resolved") label = "History";
  const sep = label === "CURRENT" || label === "Timeline Boundary" ? " - " : ": ";
  return `${label}${sep}${r.name}`.slice(0, 120);
}

async function listAll(bookId: string, userId?: string): Promise<WorldBookEntryDTO[]> {
  const out: WorldBookEntryDTO[] = [];
  for (let offset = 0; offset < 5000; offset += 200) {
    const page = await host.world_books.entries.list(bookId, { limit: 200, offset, userId });
    out.push(...page.data);
    if (page.data.length < 200) break;
  }
  return out;
}

async function ensureBook(chatId: string, userId?: string): Promise<string | null> {
  const files = await loadChat(chatId, userId);
  const meta = files.meta;
  if (meta.mirror.bookId) {
    const ok = await host.world_books.get(meta.mirror.bookId, userId).catch(() => null);
    if (ok) return ok.id;
    meta.mirror = { entries: {} };
  }
  const L = ledgerFor(chatId, userId);
  if (!L.names.chatName) await L.loadNames();
  const book = await host.world_books.create({
    name: `ALMANAC · ${L.names.chatName || L.names.char || chatId.slice(0, 8)}`,
    description: "Managed by ALMANAC Ledger: a readable, editable projection of this chat's Codex and Chronicle. Edits you make here are kept (the record becomes locked). The Ledger decides which entries are injected each turn.",
    metadata: { almanac_chat_id: chatId },
  }, userId);
  meta.mirror.bookId = book.id;
  // Attach at chat scope only, so it never leaks into other chats.
  if (has("chats")) {
    const chat = await host.chats.get(chatId, userId).catch(() => null);
    if (chat) {
      const md = (chat.metadata ?? {}) as Record<string, unknown>;
      const ids = Array.isArray(md.chat_world_book_ids) ? (md.chat_world_book_ids as string[]) : [];
      if (!ids.includes(book.id)) await host.chats.update(chatId, { metadata: { ...md, chat_world_book_ids: [...ids, book.id] } }, userId);
    }
  }
  save(chatId, "meta", userId, 0);
  return book.id;
}

export function syncMirror(chatId: string, userId?: string): Promise<void> {
  return serial(`mirror:${chatId}`, () => doSync(chatId, userId));
}

async function doSync(chatId: string, userId?: string): Promise<void> {
  if (!has("world_books")) return;
  const settings = await loadSettings(userId);
  const files = await loadChat(chatId, userId);
  if (settings.mirror === "off" || !isEnabled(files.meta, settings)) return;
  try {
    const L = ledgerFor(chatId, userId);
    if (!L.state) await L.refresh();
    const bookId = await ensureBook(chatId, userId);
    if (!bookId) return;
    const meta = files.meta;
    const present = Object.values(L.state.chars).filter((c) => c.tier === "spot" || c.tier === "peri" || c.isUser).map((c) => c.id);

    // Desired projection
    const desired = new Map<string, { comment: string; content: string; key: string[]; kind: string }>();
    for (const r of L.records) {
      if (r.id === "char:user" || r.kind === "meta") continue;
      if (r.provenance.source === "lore" && !r.id.startsWith("lore:") && !L.state.chars[r.id.slice(5)]) {
        // lore baselines already live in the user's own books; don't duplicate them
        continue;
      }
      const content = settings.mirror === "full" ? renderRecord(r, L.state, present, true, L.names.user) : r.summary;
      desired.set(r.id, { comment: titleFor(r), content, key: [...new Set([r.name, ...r.aliases, ...r.keys])].filter(Boolean).slice(0, 16), kind: r.kind });
    }
    for (const u of files.chronicle.units) {
      if (u.stale) continue;
      desired.set(`chron:${u.id}`, { comment: `History: ${u.level[0].toUpperCase()}${u.level.slice(1)} ${u.no} — ${u.title}`.slice(0, 120), content: `${unitHeader(u)}\n${u.text}`, key: [u.title.toLowerCase()], kind: "history" });
    }

    const existing = await listAll(bookId, userId);
    const byCodex = new Map<string, WorldBookEntryDTO>();
    for (const e of existing) {
      const cid = (e.extensions as any)?.almanac?.codexId;
      if (cid) byCodex.set(cid, e);
    }
    let ops = 0;
    const MAX_OPS = 60;
    // User edits flow back first
    for (const [cid, e] of byCodex) {
      const rec = meta.mirror.entries[cid];
      if (!rec) continue;
      const current = hash(`${e.content}|${e.key.join(",")}|${e.comment}`);
      if (current !== rec.hash) {
        if (cid.startsWith("chron:")) {
          const u = files.chronicle.units.find((x) => `chron:${x.id}` === cid);
          if (u) {
            u.text = e.content.replace(/^\[[^\]]*\]\n?/, "");
            u.locked = true;
            save(chatId, "chronicle", userId);
          }
        } else {
          const ov = (files.codex.overlays[cid] ??= { id: cid });
          ov.summary = e.content;
          ov.userKeys = e.key;
          ov.locked = true;
          save(chatId, "codex", userId);
        }
        rec.hash = current;
        debug(`mirror: imported user edit for ${cid}`);
      }
    }
    const make = (d: { comment: string; content: string; key: string[] }, cid: string) => ({
      comment: d.comment, content: d.content, key: d.key, keysecondary: [], position: settings.recallPlacement === "depth4" ? 4 : 1, depth: 4,
      order_value: 100, priority: 100, constant: false, disabled: false, selective: false, match_whole_words: true, use_probability: true, probability: 100,
      vectorized: settings.mirrorVectorize && !cid.startsWith("chron:"), extensions: { almanac: { codexId: cid, managed: true } },
    });
    for (const [cid, d] of desired) {
      if (ops >= MAX_OPS) break;
      const want = hash(`${d.content}|${d.key.join(",")}|${d.comment}`);
      const e = byCodex.get(cid);
      const rec = meta.mirror.entries[cid];
      if (e && (rec?.wrote ?? rec?.hash) === want) continue;
      if (e && rec && (rec.wrote ?? rec.hash) !== want && files.codex.overlays[cid]?.locked && !cid.startsWith("chron:")) continue; // user-owned
      try {
        const saved = e ? await host.world_books.entries.update(e.id, make(d, cid), userId) : await host.world_books.entries.create(bookId, make(d, cid), userId);
        // Hash what the host actually stored, so normalisation never looks like a user edit.
        meta.mirror.entries[cid] = { entryId: saved.id, hash: hash(`${saved.content}|${saved.key.join(",")}|${saved.comment}`), wrote: want };
        ops++;
      } catch (err) {
        warn(`mirror write ${cid}: ${describe(err)}`);
      }
    }
    // Records that no longer exist on this branch
    for (const [cid, e] of byCodex) {
      if (ops >= MAX_OPS) break;
      if (desired.has(cid)) continue;
      if (files.codex.overlays[cid]?.locked) continue;
      try {
        await host.world_books.entries.delete(e.id, userId);
        delete meta.mirror.entries[cid];
        ops++;
      } catch (err) {
        warn(`mirror delete ${cid}: ${describe(err)}`);
      }
    }
    save(chatId, "meta", userId);
    debug(`mirror ${chatId}: ${ops} writes, ${desired.size} records`);
  } catch (err) {
    warn(`mirror sync: ${describe(err)}`);
  }
}
