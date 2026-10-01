# 06 — Where should turns and Codex entries live: lorebooks or extension storage?

> **Status (1.13):** the hybrid was built. Two details changed: mirror entries are stored switched off and enabled per turn by the WI interceptor (so the book is inert without the extension), and the per-book *overlay* and *write* permissions were not built (the Ledger only reads your lorebooks). The optional controller mentioned below doesn't exist.

**The question:** should the Ledger store summarised turns and Codex entries as **lorebook (world-book) entries**, as LumiBooks does, or in the **extension's own storage**, as VELLUM does?

**Priorities, as requested:** recall accuracy and continuity first.

**Short answer:** **extension storage as the source of truth, with lorebooks as an optional, managed projection.** Neither pure option wins on accuracy and continuity. The hybrid gets the strengths of both and avoids the one failure that matters most: **lorebooks don't branch with swipes and forks.**

---

## 1. The options

| | A · Lorebook-native | B · Extension-only | C · Hybrid (recommended) |
|---|---|---|---|
| Summaries (chapters, arcs, volumes) | World-book entries in a per-chat book | JSON in `userStorage` | JSON in `userStorage`; optional mirror entries |
| Codex records | World-book entries (one per record) | JSON in `userStorage` | JSON in `userStorage`; mirror entries (keys + rendered text) |
| State / history | Overwritten entry text | Append-only event log | Append-only event log |
| Retrieval decides | Host keyword/vector activation | The Ledger | The Ledger, applying decisions through the WI interceptor; host vectors as one signal |
| Placement of summaries | Interceptor splice (native positions can't put text "where the messages were") | Interceptor splice | Interceptor splice |
| Example | LumiBooks (chapters and Codex sync) | VELLUM II's event log | ALMANAC Ledger |

---

## 2. Evaluation

Scores 1–5 (5 = best). Accuracy and continuity criteria are weighted ×3, the rest ×1.

| # | Criterion | Weight | A · Lorebook | B · Extension | C · Hybrid | Why |
|---|---|---|---|---|---|---|
| 1 | **Branch / swipe / fork correctness** | ×3 | 1 | 5 | 5 | Lorebooks are chat- or global-level objects. A swipe, regenerate, edit or fork does **not** fork entries, so the rejected swipe's facts stay "true" unless something reconciles them (LumiBooks relies on divergence heuristics). An event log keyed to `msgId + swipe` is correct by construction |
| 2 | **Deterministic, controllable injection** | ×3 | 2 | 5 | 5 | Native activation is shaped by probability, group competition, sticky/cooldown state, recursion, and the *user's global* Max Activated Entries, Max Token Budget and Min Priority settings. Any of these can silently evict a crucial fact. The Ledger selects exactly, with its own budget lane. The hybrid enforces its picks with `forced`/`disabled` votes |
| 3 | **Relevance beyond keywords** | ×3 | 2 | 4 | 5 | Native relies on keywords, plus vectors if configured. The Ledger adds graph expansion (present cast and place), temporal triggers (debts due, forecasts), knowledge relevance and an optional controller. The hybrid adds host vector scores from the mirror book |
| 4 | **History and "as of" queries** | ×3 | 1 | 5 | 5 | Entry text is overwritten, so history is lost (LumiBooks keeps history only on the timeline). An event log answers "what did Mara believe on Day 3?" |
| 5 | **Structural fidelity** (knowledge asymmetry, custody chains, bond axes, clocks) | ×3 | 2 | 5 | 5 | A world-book entry is text + keys + an `extensions` blob. Querying who-knows-what across hundreds of entries means parsing blobs. JSON records are queryable directly |
| 6 | Write reliability and performance | ×1 | 2 | 5 | 4 | Per-record entry CRUD means many API calls and vector re-index churn. LumiBooks documents deletes contending for the host's vector-store write lock (6 retries, 300 s budget). Local JSON writes are atomic and fast. The hybrid mirror writes are batched, debounced and off the hot path |
| 7 | User visibility and editing in native UI | ×1 | 5 | 2 | 5 | Lorebooks are familiar and editable anywhere. The hybrid mirror gives the same, while edits flow back as locked user events |
| 8 | Portability and sharing | ×1 | 5 | 3 | 5 | Lorebook JSON is the lingua franca. The hybrid exports Codex → Lorebook on demand (05 §10.3) |
| 9 | Survives extension removal | ×1 | 5 | 2 | 4 | Native entries keep working. The hybrid keeps the mirror book, chat-variable mirrors and the `<ledger>` blocks inside stored messages |
| 10 | Semantic search | ×1 | 4 | 1 | 5 | Spindle exposes no general embedding API for extension JSON; host vectors cover world books and chat chunks. The hybrid mirror book *is* vectorised, and `getActivated()` returns vector hits with scores |
| 11 | Budget isolation from the user's own lore | ×1 | 2 | 5 | 5 | Native entries compete with the user's books inside one WI budget. The Ledger injects in its own lane |
| 12 | Rebuildable from transcript | ×1 | 3 | 5 | 5 | Both B and C can replay the `<ledger>` blocks kept in stored messages |
| | **Weighted total** (max 110) | | **50** | **95** | **108** | |

How the totals are computed (rows 1–5 ×3, rows 6–12 ×1):
- **A:** (1+2+2+1+2) × 3 = 24, plus (2+5+5+5+4+2+3) = 26 → **50**
- **B:** (5+5+4+5+5) × 3 = 72, plus (5+2+3+2+1+5+5) = 23 → **95**
- **C:** (5+5+5+5+5) × 3 = 75, plus (4+5+5+4+5+5+5) = 33 → **108**

**Verdict:** pure lorebook storage loses on every accuracy and continuity criterion, mainly because it can't branch and because host activation can't be made deterministic. Pure extension storage wins on accuracy but gives up native editing, portability and host vectors. **The hybrid keeps B's accuracy and recovers A's usability.**

---

## 3. The recommended design in detail

### 3.1 What lives where

| Data | Source of truth | Mirror (optional) | Never stored in |
|---|---|---|---|
| Raw turns | The chat itself (Lumiverse messages) | — | Lorebooks (copying raw turns into lore duplicates tokens and breaks editing) |
| `<ledger>` deltas | The stored message text **and** `events.jsonl` | — | — |
| State projections | Computed from `events.jsonl`, snapshots every 25 messages | Chat variables (`alm_*`) for the standalone fallback | — |
| Chapters, arcs, volumes | `chronicle.json` (text, span, story time, coverage, signatures) | Mirror entries titled `History: Chapter 7 — …` | — |
| Codex records | `codex.json` | Mirror entries (VELLUM III title + first sentence + body; keys; `extensions.almanac.codexId`) | — |
| Key index | `keys.json` (compiled per chat) | The mirror entry's `key` field | — |
| Settings | `userStorage` (global + per chat) | Preset Profile for per-chat variables | — |

### 3.2 The mirror book
- **One book per chat:** `ALMANAC · <chat name>`, attached at **chat scope only** (`chat_world_book_ids`), so it never leaks into other chats.
- **Managed activation:** the Ledger's WI interceptor disables every mirror entry each turn except the ones Recall picked (forced). Result: **no double injection**, but those picks are placed by the host and visible in native WI diagnostics and Dry Run.
- **Vectorised (optional):** mirror entries set `vectorized: true`, so the host embeds them. `getActivated()` then gives the Ledger semantic candidates with scores (Recall stage 2d).
- **Branch-aware:** mirror content is re-projected from the *active path* (debounced ~2 s after swipe navigation, edit or delete), so what the user sees in the book matches the branch they're on.
- **Two-way edits:** each entry stores `extensions.almanac.hash`. When a user edits a mirror entry in Lumiverse's world-book panel, the hash mismatches → the edit is imported as a `source: user` event, and the record becomes `locked` (user wins; the archivist won't overwrite it).

### 3.3 Why the turns themselves stay in the chat
Summarised turns are **hidden** (`setMessagesHidden`, which removes them from embeddings and dims them in the UI) and **dropped from the prompt by the interceptor**, with the summary spliced in their place. The raw text remains in the chat for reading, editing, zoom-in recall of verbatim quotes, and re-summarising after edits. Copying raw turns into lorebooks would duplicate tokens and create two copies that drift apart.

### 3.4 Continuity guarantees that follow from this choice
1. **No phantom facts from rejected swipes:** only the active path's events are accepted.
2. **No silent eviction:** crucial constraints ride the Ledger's reserved lanes, not the user's WI budget.
3. **No lost history:** every change is an event, and the Codex snapshot can be recomputed at any point.
4. **No single point of failure:** the stored messages carry their ledgers. If extension storage is lost, "Rebuild from transcript" replays them into identical state.
5. **Graceful degradation:** with the extension off, the mirror book (if enabled), chat-variable mirrors and the preset's standalone continuity keep the story coherent.

---

## 4. When a lorebook-first workflow is still right

- **Sharing a world** with other players or cards: use **Codex → Lorebook export** (VELLUM III-compatible) at a milestone. The exported book is a clean, portable artifact.
- **Authoring a setting before play:** use the **Lorebook Creator**. The Lore Bridge then seeds the Codex from it.
- **Community lore you don't want touched:** attach it read-only; the Ledger reads it and never writes to it.

In all three, the lorebook is an **input or output format**, not the live memory.
