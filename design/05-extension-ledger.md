# 05 — ALMANAC Ledger: Extension Design

> **Status (1.13):** this is the design as first written. Built as described: branch-safe folding, the chronicle, the Codex, recall's candidate stages (keys, graph links from the cast and place, debts and routines due, mirror vectors, chronicle zoom-in, lore), the note, the mirror and lore bridge, the knowledge clerk, the reply check, the simulator and the sidecar. **Not built:** the LLM *controller* (Recall stage 3), *predictive prefetch*, the per-book *overlay* and *read + write* permissions (the Ledger only reads your lorebooks), and the Memory Cortex signal. Where this document and the [root README](../README.md) disagree, the README describes the shipped behaviour.

> **ALMANAC Ledger** (`almanac_ledger`): a Lumiverse Spindle extension that combines **LumiBooks**' tiered summarise-and-hide memory and Codex, **Lore Recall**'s reasoning-driven retrieval, and **VELLUM**'s event-sourced state. It adds tracker-driven retrieval keys, a Lore Bridge that seeds from attached lorebooks, a built-in Lorebook Creator, and computed world engines.

---

## 1. Responsibilities

| # | Module | One-line job |
|---|---|---|
| 1 | **Ingest** | Read each reply's `<ledger>`, validate it, repair it if missing, and append events keyed to message + swipe |
| 2 | **State Engine** | Event-sourced projections: scene, cast, bonds, knowledge, inventory, threads, consequences, world |
| 3 | **Chronicle** | Summarise scenes → chapters → arcs → volumes; hide covered turns; splice summaries in place |
| 4 | **Codex** | The story bible: typed records with history, keys, scopes and provenance |
| 5 | **Keys** | Turn tracker `keys` (and names/aliases) into a live retrieval index |
| 6 | **Recall** | Hybrid, knowledge-aware retrieval into a budgeted prompt layout |
| 7 | **Lore Bridge** | Read attached lorebooks (character / persona / chat / global) into the Codex; take over or assist their activation |
| 8 | **Lorebook Creator** | The VELLUM III creator as a wizard with a validator, linker and writer |
| 9 | **Almanac Engines** | Calendar, astronomy, weather; off-screen simulator; rumour propagation |
| 10 | **Craft Telemetry** | Repetition and slop metrics, genre-delivery tracking, agency-violation flags |
| 11 | **Render** | Speaker/theme stylesheet; per-message tracker snapshots; plate enrichment |
| 12 | **Surface** | Macros, tools, RPC endpoints, drawer UI, HUD widget, Session Zero |

---

## 2. Manifest

```json
{
  "identifier": "almanac_ledger",
  "name": "ALMANAC Ledger",
  "version": "0.1.0",
  "description": "Event-sourced story memory, tiered chronicle, knowledge-aware recall, lore bridge and lorebook creator for the ALMANAC preset.",
  "permissions": [
    "interceptor", "context_handler", "generation", "chats", "chat_mutation",
    "world_books", "characters", "personas", "presets", "regex_scripts",
    "memories", "tools", "ui_panels", "generation_parameters"
  ],
  "interceptorTimeoutMs": 120000,
  "entry_backend": "dist/backend.js",
  "entry_frontend": "dist/frontend.js",
  "minimum_lumiverse_version": "1.1.6"
}
```

Every gated feature **degrades** if its permission is denied:
- no `memories`: no Cortex/chat-memory candidates;
- no `tools`: no self-retrieval tools;
- no `ui_panels`: no floating HUD (drawer tabs are free);
- no `generation_parameters`: structured output falls back to tolerant parsing;
- no `regex_scripts`: the user imports the preset's regex manually.

---

## 3. Architecture

```
                 ┌──────────────────────── ALMANAC Ledger (backend worker) ────────────────────────┐
 user sends ───► │ Context Handler (≤120 s)                                                        │
                 │   ├─ Query builder ─► Recall stages 1–4 (keys, graph, time, semantic, controller)│
                 │   ├─ Sidecar Director (optional)                                                │
                 │   └─ stages a RecallPlan for this generation                                    │
                 │ WI Interceptor (≤10 s): apply the plan to lorebook entries                      │
                 │   (forced / disabled / mutated.content for moved-past lore)                     │
 assembly ─────► │ Interceptor (after assembly):                                                   │
                 │   ├─ drop covered history turns, splice chapter/arc/volume summaries in place   │
                 │   ├─ inject <ledger-note> (Now, cast, constraints, Knowledge Brief, Craft Brief)│
                 │   ├─ inject <recall> (Codex details + lore) and <director-plan>                 │
                 │   └─ breakdown entries for every injection                                      │
 LLM reply ────► │ GENERATION_ENDED / MESSAGE_* events → Ingest                                    │
                 │   ├─ parse <ledger> → validate → (repair) → events[msgId, swipe]                │
                 │   ├─ State Engine: fold → projections → snapshot                                │
                 │   ├─ Codex: deterministic update; Keys: re-index                                │
                 │   ├─ Engines: weather/calendar advance; off-screen sim (async)                  │
                 │   ├─ Chronicle: scene-boundary check → summarise (async) → hide                 │
                 │   ├─ Telemetry: craft metrics                                                   │
                 │   ├─ Recall prefetch for the next turn                                          │
                 │   └─ push macros, chat vars, RPC snapshot, frontend state                       │
                 └──────────────────────────────────────────────────────────────────────────────────┘
 frontend:  stylesheet (speaker colours, theme tokens) · render processor (snapshots) · drawer · HUD
 storage:   userStorage/chats/<chatId>/{events.jsonl, snapshots/, codex.json, chronicle.json, keys.json, meta.json}
 mirror:    optional per-chat "ALMANAC · <chat>" world book (projection, see 06)
```

---

## 4. Turn lifecycle and branch correctness

### 4.1 Event model
```ts
interface LedgerEvent {
  id: string;                      // ULID
  msgId: string; swipe: number;    // provenance = the branch key
  seq: number;                     // order within the message
  source: 'model' | 'repair' | 'extractor' | 'archivist' | 'user' | 'lore' | 'engine' | 'sim';
  op: LedgerOp;                    // clock | wx | at | cast | mood | body | look | bond | ladder | know | item
                                   // | thread | owe | cons | clockf | rumor | rep | journal | keys | canon
                                   // | artifact | mode | entity | relate | fact | forecast | diverge
  subject: string;                 // record id, e.g. "char:mara"
  object?: string;                 // e.g. bond target "char:kael"
  payload: Record<string, unknown>;
  cause?: string;
  at: { day: number; minute: number };   // story time after this op
  confidence: number;              // user 1.0 · model 0.9 · repair 0.75 · extractor 0.6 · sim 0.7
  verdict: 'accepted' | 'rejected';
  reason?: string;                 // why rejected (time rewind, teleport, dead actor, no cause…)
}
```

### 4.2 The active path
**Accepted state = events whose `(msgId, swipe)` lies on the chat's active path**: every message in order with its current `swipe_id`. So:

| User action | Ledger response |
|---|---|
| **New reply** | Parse, validate, append, fold |
| **Swipe (add)** | New events under `swipe = n`; the old swipe's events stay stored but inactive |
| **Swipe (navigate)** | Recompute projections from the nearest snapshot before that message using the chosen swipe's events (usually < 50 ms) |
| **Regenerate** | Same as a new swipe |
| **Edit message** | Re-parse that message's ledger (the player may have fixed it by hand); recompute forward |
| **Delete message** | Tombstone its events; recompute forward; unhide turns its chapter covered, if any |
| **Fork chat** | The new chat inherits the log up to the fork point (messages matched by index + content signature, as LumiBooks' `fork.ts` does) |
| **Continue** | The continuation's ledger merges into the same message's events (no duplicate clock time) |

This is CHRONICON's "atomic turn semantics" enforced in code rather than requested in prose.

### 4.3 Validation rules (Strict mode)
- Clock is monotonic; a `clock` that would go backwards is rejected.
- **Teleport:** an actor changing place without elapsed time ≥ the route minutes (when the route is known) is flagged. Rejected in Strict; accepted-with-warning in Lenient.
- **Dead or absent actors** can't speak, move items or change bonds.
- **Custody:** an item can't be given by someone who doesn't hold it.
- `bond`, `know`, `item` and `thread` without a cause are rejected in Strict.
- In Sealed mode, **{{user}} inner-state ops are dropped** (except `persona_thoughts`).
- Magnitude caps: a `bond` of ±4 or more needs a pivotal cause keyword; otherwise it is clamped to ±2.

Rejections appear in the Recall Feed. The *next* turn's `<ledger-note>` restates the verified state, so the story self-corrects without scolding the model.

### 4.4 Repair (when the ledger is missing or broken)
1. **Normalise:** strip reasoning tags and code fences; unescape HTML; accept JSON-shaped blocks (VELLUM II compatible) and DSL.
2. **Repair call:** a quiet generation with the reply's prose, the verified T0, and the DSL spec → a ledger. Thinking off first; if empty, retry once with thinking on (VELLUM beta.7's lesson).
3. **Extractor:** heuristic mining (clock phrases, arrivals and departures, named-speaker mood words, "gave", "took", "told") at confidence 0.6.
4. The turn is marked **unverified** in the UI until a later turn or the user confirms it.
5. **Format aid** (optional): include the previous turn's actual ledger as a worked example at the end of the injection (VELLUM's "⟦⟧ Block example"), for models that drift from the format.

---

## 5. Chronicle: summarise, hide, splice

### 5.1 Units and triggers

| Tier | Trigger (whichever first) | Content |
|---|---|---|
| **Scene** | Place change (`at`); clock jump ≥ 60 min; a new header title; mode → downtime; `/scene` | 80–200 words |
| **Chapter** | ≥ 3 scenes, **or** the covered raw span exceeds the chapter token threshold | 150–350 words |
| **Arc** | ≥ 4 chapters, or a thread resolution / genre climax | 150–300 words |
| **Volume** | ≥ 4 arcs | 150–300 words |

Scene boundaries are **narrative**, not message counts. LumiBooks chunks by count; ALMANAC knows from the ledger when a scene ends, so chapters don't cut a conversation in half.

**Raw tail:** the last `rawTail` messages (default 20, or 12k tokens, whichever is smaller) are **never** summarised. Compression happens only as far back as the context budget requires (`{{maxContext}}` aware).

### 5.2 Summary format (structured prose)
```
[Chapter 7 · Day 3 14:00 – Day 4 09:10 · The Rusty Flagon, Lowmarket docks]
What happened: {{user}} returned the silver locket to Mara in the Flagon's back room; Kael watched from the bar…
Changed: Mara → {{user}} trust +2 · Kael now suspects {{user}} of theft (false) · locket: {{user}} → Mara.
Said (verbatim): Mara: "Thieves don't give things back."
Still open: Mara owes {{user}} a favour · Who took the locket from Kael? · The river is rising.
```
- Past tense, story dates, **no display markup**, one to two load-bearing verbatim quotes.
- **Coverage check:** every accepted event in the span with salience ≥ 0.5 must have its subject mentioned. If not, a second pass adds the missing facts ("include: …"). The summariser cannot silently drop a betrayal.

### 5.3 Hiding and splicing
1. When a chapter is accepted, its messages are flagged `hidden` via `spindle.chat.setMessagesHidden` (UI dimming and exclusion from vector memory).
2. Lumiverse leaves `hidden` messages out of prompt assembly, so the covered turns usually never reach the interceptor. The interceptor therefore does not wait to find them: it puts the summaries chosen for the turn before the first visible turn that comes after them, in story order, and drops any covered turn that does reach it (when hiding is off). An earlier version only put a summary where a covered turn still stood, so with hiding on no summary ever reached the model.
3. Arcs supersede chapters and volumes supersede arcs. Only the highest active tier is injected for any span.
4. **Which summaries (setting `chronicleInject`):**
   - **all** (default): the whole story so far on every turn, once, at the coarsest level that covers each stretch (volumes, then arcs, then leftover chapters). When the turn touches a chapter folded into an arc or volume, up to two such chapters also go in, whole, right after their arc. Compression never loses reachability.
   - **relevant**: the latest summary (it leads into the raw tail) plus up to three earlier chapters the turn touches.
   - "Touches" means sharing a name the story tracks (a person, a group, an object, or a place with a proper name) with the player's message, the last reply or the scene; or sharing two rare words with the player's message ("rare" meaning rare in the summaries and in the chat). A name or word that more than half the summaries use counts for nothing.
5. Editing or deleting a covered message invalidates that summary (signature divergence, like LumiBooks' cursor). It is re-summarised in the background; until then the raw messages are unhidden.

### 5.4 Chronicle UI
- A list of volumes, arcs and chapters.
- Actions on each: edit, lock, regenerate, **unhide span**, merge, split, "ghost" (keep coverage for dedup without injecting).
- Coverage bar: raw · chapter · arc · volume share of the chat.

---

## 6. Codex: the story bible

### 6.1 Record
```ts
interface CodexRecord {
  id: string;            // char:mara · loc:rusty_flagon · item:locket · fac:syndicate · rule:thresholds
                         // thread:lost_locket · doc:letter_harbourmaster · cons:c12 · fact:f31 · custom:flagon
  kind: 'person' | 'place' | 'object' | 'group' | 'law' | 'history' | 'situation' | 'belief'
      | 'texture' | 'boundary' | 'meta' | 'thread' | 'document' | 'forecast' | 'consequence';
  tense: 'now' | 'past' | 'future' | 'timeless';     // VELLUM III compatible
  name: string; aliases: string[];
  keys: string[];                                   // retrieval keys (§7)
  summary: string;                                  // first-sentence formula: "Mara is a smuggler in Lowmarket."
  body: Record<string, unknown>;                    // typed fields per kind (below)
  links: { rel: string; to: string; since?: StoryTime }[];
  scope: { knownBy?: string[]; hiddenFrom?: string[]; narratorOnly?: boolean; public?: boolean };
  provenance: { msgIds: string[]; loreEntryId?: string; source: 'story' | 'lore' | 'user' | 'sim' };
  salience: number;                                 // 0–1, reinforced by use, decays slowly
  lastSeen: { day: number; minute: number; msgIdx: number };
  status: 'active' | 'dormant' | 'resolved' | 'dead' | 'destroyed' | 'diverged';
  locked?: boolean;                                 // user-owned: never rewritten by the archivist
}
```

### 6.2 Typed bodies (examples)

| Kind | Body fields |
|---|---|
| person | role, appearance, traits, voice fingerprint, want / fear / need, hidden pressure (narrator-only), routine[], agenda, desire profile (NSFW-gated), state (live projection), journal[] |
| place | parent, type (interior / biome), hours, routes[{to, mode, minutes}], customs[], secrets[{fact, sign}], occupants (by routine), price band |
| object | holder, location, condition, quantity, custody[], description, significance |
| group | members[], goal, assets, public stance, private stance (scoped), project clocks[], relations to groups |
| thread | status, actors, latest, history (3), unresolved, stakes, next eligible, re-entry route, links |
| document | full text, kind (letter / contract / sign…), author, recipient, holder, date |
| consequence | type, who, owed to, due, severity, status |
| forecast | expected[], participants, place, due, status (pending / met / diverged) |
| belief | holder, fact, status, truth, source, since (supersedes) |

### 6.3 Three feeds into the Codex
1. **Deterministic (every turn, free):** ledger events → records (the first `cast` creates a person; `item` moves custody; `know` writes a belief; `artifact` files a document). Instant, so the Codex is always current.
2. **Archivist (at chapter boundaries, one LLM call):** LumiBooks' **UPDATE → SWEEP → COMPRESS** over the chapter span plus *only the records it touches*. It uses the patch protocol (`set` complete rows / `drop` ids), respects `locked`, and follows LumiBooks' quality rules: one fact in one place; describe the present with no "was X, now Y" residue; keep additions and deletions balanced; keywords 1–2 words, 4–12, never the record's own name.
3. **Lore Bridge (at attach and on book change):** baseline records from lorebooks (§9).

### 6.4 History without bloat
The **event log** is the full history. The Codex holds the current snapshot plus a compact `history[]` of pivotal shifts. Any "as of" question ("what did Mara believe on Day 3?", "who held the locket before?") is answered by **projecting the log to that point**. This fixes LumiBooks' snapshot-only limitation.

---

## 7. Tracker integration and real retrieval keys

This is where "retrieval keys in the tracker become real retrieval keys" is implemented.

### 7.1 Where keys come from
1. **Model-provided:** `keys Record: k1, k2, …` ledger lines. The preset asks for keys whenever a record is created or its meaning shifts.
2. **Automatic:** name plus aliases (always matched; never stored as keys); capitalised aliases from lore titles (VELLUM III rule); concrete nouns from `know` facts, `item` names, `thread` titles and document titles.
3. **Archivist:** refreshes stale keys at chapter boundaries.
4. **User:** editable in the Codex UI (locked keys survive archivist passes).

### 7.2 Key hygiene (enforced)
- 1–2 words each, at most 12 per record. Concrete nouns only: no abstract themes (love, betrayal), no filler verbs.
- Never other cast members' names (those records retrieve themselves).
- Stop-list for generic words (sword, house, door, night).
- A **key heat** score per key: fires versus contributes. A key that fires three times without its record being used in the reply is demoted (Lore Recall's stale-injection feedback applied to keys).

### 7.3 Every tracker becomes retrievable

| Tracker | Record | Example keys | What gets injected when a key hits |
|---|---|---|---|
| Inventory | `item:locket` | locket, silver, engraving | "Locket: silver, engraved 'E.'; held by Mara since Day 3 (returned by {{user}}); Kael believes {{user}} stole it (false)." |
| Knowledge | `fact:f31` | cargo, manifest | "Fact: the cargo was never Vance's to sell. Known by: Mara (saw). Hidden from: Kael. Kael wrongly believes: bandits took it." |
| Threads | `thread:lost_locket` | locket, favour | "Thread (advancing): Mara owes {{user}} a favour; unresolved: who took it from Kael." |
| Consequences | `cons:c12` | debt, favour | "Open: Mara → {{user}} favour (since Day 3)." |
| Documents | `doc:letter_harbourmaster` | harbourmaster, letter, wax | The letter's **exact text** |
| Bonds | edge `mara>kael` | (the two names) | "Kael → Mara: affection +3, resentment 2 ('saw her laugh with {{user}}', Day 3)." |
| Places | `loc:rusty_flagon` | flagon, back room | Place card: hours, customs, who is usually here now, routes |
| Journals | `char:mara.journal` | locket, thief | Mara's own slant: "He gave it back. Thieves don't give things back." |

### 7.4 Matching
Keys and aliases are compiled into an Aho-Corasick automaton per chat, with whole-word, case-folded and possessive-tolerant matching. Weighted by where the hit occurs:

| Segment | Weight |
|---|---|
| The player's new message | ×3 |
| The last assistant reply | ×2 |
| The rest of the recent window (last K) | ×1 |
| The scene frame (place path, present names, open-thread titles) | ×1.5 |

---

## 8. Recall: hybrid, knowledge-aware retrieval

### 8.1 Stages

| Stage | What | Where it runs | Budget |
|---|---|---|---|
| 0 · Query | Segments (§7.4), entities resolved via the alias index, scene mode, genre, CoT tier guess | Context handler | ~10 ms |
| 1 · Reserved lanes | Now note, present-cast capsules, constraints due, Knowledge Brief, Craft Brief, genre state | Context handler | Always on |
| 2 · Candidates | (a) key/alias hits · (b) **graph expansion**: 1 hop from present cast and place (2 hops on pivotal beats) · (c) **temporal**: consequences, forecasts and deadlines due; routines ("who's expected here now") · (d) **semantic**: `world_books.getActivated()` vector hits on the mirror book and bridged books (with scores), optional `memories.chatMemory.get()` for verbatim chunks · (e) **zoom-in**: finer chapters or raw excerpts under coarse arcs · (f) **lore**: bridged lorebook entries | Context handler, parallel | ≤ 1.5 s |
| 3 · Scoring | Formula below; protected minimum per lane | Context handler | ~5 ms |
| 4 · Controller *(optional)* | **Collapsed**: one call picks from a top-40 manifest. **Traversal**: navigate a Codex tree (Characters / Places / Objects / Groups / Threads / Documents / History / Lore books) and search, then a final **selective manifest** (Lore Recall's design) | Prefetched after the previous reply; rescored on send | ≤ 8 s, deterministic fallback |
| 5 · Rendering | Per-kind templates, **knowledge-perspective** phrasing, firewall labels, dedup, tiered compression to budget | Interceptor | ~10 ms |
| 6 · Placement | §8.5 | Interceptor | — |

**Predictive prefetch:** after each reply the Ledger already knows the new state, so it runs stages 0–4 speculatively. On send, only the player's new message is rescored (fast, deterministic), and the controller is re-asked only if new high-weight entities appeared. Typical added latency before the first token: **< 400 ms**.

### 8.2 Scoring
```
score = 10·hit_player + 6·hit_last_reply + 3·hit_recent + 5·linked_present_cast + 4·linked_place
      + 8·consequence_due + 6·thread_due + 6·semantic(1 − distance) + 4·salience
      + 3·involves_secret_held_by_present_npc + 2·genre_instrument
      + feedback(+2 used last turn · −3 after 3 unused injections)
      − recency_penalty(injected in each of the last 2 turns and unchanged)
```
Lanes carry minimum slots so that, for example, one Knowledge row always survives when a present NPC holds a secret about the topic.

### 8.3 Knowledge-perspective rendering
The same fact renders differently depending on who's present:

```
Fact: The cargo was never Vance's to sell.
  Present: Mara (knows · saw), Kael (wrong · believes bandits took it).
  Absent holders: Vance (knows).   Hidden from: the harbour guard.
  → Do not let Kael act on the truth. Mara may hint; she won't say it in front of Kael.
```
Narrator-only content (hidden pressures, off-screen events that haven't reached the scene, place secrets) is labelled `[narrator-only]`. The Charter already tells the model that such content never enters a character's mouth.

### 8.4 The `<ledger-note>` (verified state, placed just before the player's message)
```
<ledger-note>
[NOW] Day 3 · Thu 14 Frostmoon · 14:32 · heavy rain, 9°C, wind NW (easing by 17:00) · The Rusty Flagon › back room
[PRESENT] Mara (spotlight; by the fire; wary-curious V-1 A2 D0; soaked; fatigue 3) · Kael (periphery; at the bar; jealous; wiping one glass)
[CONSTRAINTS] Mara owes {{user}} a favour · the locket is with Mara · the Flagon closes at 02:00 · the river is rising (flood at the back room likely by night)
[KNOWLEDGE] Mara — knows {{user}} returned the locket; does NOT know it was Kael's. Kael — wrongly believes {{user}} stole it.
[ARRIVED] (none from off-screen this turn)
[CRAFT] Avoid: "for a long moment" (2× in last 5), opening on weather (3/5), Mara's "narrowed eyes" (4×). Try: open mid-action.
[GENRE] Mystery: no clue has moved for 3 turns.
</ledger-note>
```

### 8.5 Prompt layout (interceptor output)
```
[system blocks …]
[world info before]                    ← bridged lore (host-placed via WI interceptor decisions)
[<recall> … Codex details, documents, zoom-ins …]   (placement setting: before history | depth 4)
[chat history with spliced Volume/Arc/Chapter summaries in place]
[<director-plan> (sidecar only)]
[<ledger-note>]                        ← depth 1, immediately before the latest user message
[latest user message]
[post-history blocks: Player's Seal, Turn Frame, Director's Pass, Output]
```
Every injected message gets a **Prompt Breakdown** entry (`ALMANAC · Now`, `ALMANAC · Recall`, `ALMANAC · Chapter 7`…) so users can see exactly what was added and why.

### 8.6 Budgets
Default total **2,400 tokens** of injection. It scales with `{{maxContext}}` and the CoT tier guess (pivotal beats get +40%).

| Lane | Default | Min |
|---|---|---|
| Now + present capsules | 450 | 250 |
| Constraints / due | 150 | 60 |
| Knowledge Brief | 250 | 80 |
| Craft + Genre | 110 | 40 |
| Recall details (Codex, documents, zoom-ins) | 1,100 | 300 |
| Bridged lore | 340 | 120 |

When over budget, records render in compressed tiers (full body → summary + key facts → summary only), and the lowest scores drop first.

---

## 9. Lore Bridge: attached lorebooks seed the Codex

### 9.1 Sources
All scopes Lumiverse activates for the chat: the **character's** books (`character.extensions.world_book_ids`), the **persona's** attached book, the **chat's** books (`chat.metadata.chat_world_book_ids`) and **global** books.

### 9.2 Classification pipeline (per entry)
1. `extensions.almanac` / `extensions.vellum3` metadata: exact kind, tense, participants, place, visibility, expected, members.
2. **Title label** (the VELLUM III table): `Character:` → person, `Location:` → place, `CURRENT -` → situation or belief (belief words: believe, think, assume, unaware), `Upcoming:` / `Prophecy:` → forecast, `Timeline Boundary -` → boundary, `Customs:` → texture, `Rule:` → law, `History:` → history, `OOC:` → meta (never a fact).
3. **First-sentence rules:** "X is a/an role in Parent" → role and parent place; the item holder is the first person named; `open 20:00 to 02:00` → hours; "twenty minutes' walk from Y" → route; climate phrases → the weather engine's profile; "unbeknownst", "in truth" → a mistaken belief; secret words plus a sign sentence → narrator-only secret plus a perceivable sign.
4. **LLM classifier** (batched, structured output) for unlabelled or ambiguous entries.
5. **Review queue** in the Lore tab for low-confidence classifications.

### 9.3 Seeding
- Each classified entry becomes a Codex record with `provenance.loreEntryId`, `source: 'lore'` and **baseline** status ("true as the story begins").
- `Timeline Boundary` sets the era or calendar anchor.
- `Upcoming` becomes a tracked **forecast**, marked *diverged* when a participant dies, a group disbands or a place is destroyed (VELLUM III semantics).
- `CURRENT` situations become threads; beliefs become knowledge rows.
- Places build the location graph and the weather engine's climate.
- **Result: the Codex starts populated.** Characters, places, factions, laws, customs and open situations exist from turn one, and the Knowledge Brief can already protect secrets that are only in the lore.

### 9.4 Divergence: lore that the story has moved past
When events contradict a baseline record (the Magic Box is destroyed; Joyce is dead; the prophecy failed), the Codex marks it `diverged`. At prompt time the **WI interceptor** either:
- **mutates** the entry for this prompt only: `mutated.content = "[History — as of Day 5: destroyed in the raid.] " + original`; or
- **disables** it and lets Recall inject the updated Codex version.

**The user's book is never edited** unless its per-book permission allows it.

### 9.5 Activation modes (per book)

| Mode | Native WI activation | Ledger role | Use when |
|---|---|---|---|
| **Native** | Unchanged | Only annotates moved-past entries | You like your book's keyword setup |
| **Assisted** *(default)* | Unchanged + **forced** entries Recall picks (vote `forced`) | Adds what keywords missed | Most books |
| **Managed** | Book's entries **disabled** each turn except Recall's picks | Sole retrieval owner (no double injection) | Large books; the Lore Recall use case |

Per-book permission: **Read-only** *(default)* · **Overlay** (writes go to a chat-scoped overlay book) · **Read + write** (the Ledger may update entries, e.g. "Save to lorebook").

---

## 10. Lorebook Creator (VELLUM III-compatible)

### 10.1 Wizard flow
1. **Mode:** ⚡ Quick (JSON only) · 🤝 Guided (Analysis → Generation → Optimization with checkpoints) · 📋 Entry generator (Option A: suggest a list from a premise · B: parse raw lore · C: example entries for a category).
2. **Source:** premise text · pasted lore · an uploaded document · **this character card** · **this chat's Codex** ("harvest the story so far") · an existing lorebook ("upgrade to VELLUM III conventions").
3. **Analysis:** a categorised plan showing each entry's **final title** (`Character: Willow Rosenberg`, `CURRENT - Hellion Biker Raid`), a one-line description and a configuration preview (N constants at position 4, N character entries at position 1, N world entries at position 0, N CURRENT/Upcoming).
4. **Edit plan:** add, remove or rename; set priority tier (the 300 → 80 ladder); toggle constant; merge or split concepts.
5. **Generate:** batches of 8–12 entries via `generate.quiet/raw` with **structured output** (JSON schema for the SillyTavern `{"entries": {...}}` format, including `extensions.vellum3` and `extensions.almanac`). The system prompt is the VELLUM III creator prompt (Auto edition). Each batch receives the full list of planned titles and canonical names, so cross-references (members, holders, parents, participants) stay consistent across batches.
6. **Validate** with the prompt's QA checklist implemented in code:
   - **Auto-fix (deterministic):** `priority = order`, `selective = false` when no secondary keys, `vectorized: false`, `matchWholeWords: true`, `useProbability: true`, `excludeRecursion: false`, depth 4 (2 for scene events), string keys matching uids, `preventRecursion` by kind.
   - **Re-ask (model):** first-sentence formula violated, label/kind mismatch, future event not in future tense, 200 tokens or more, generic keywords, `{{char}}`/`{{user}}` in title or first sentence, a CURRENT title without participants before the verb, public words in a private situation.
7. **Link:** build the recursion graph (content mentions → other entries' keys). Flag orphans, loops and hub gaps; suggest `preventRecursion` per the asymmetric-linking strategy; check that faction members and item holders match character titles exactly.
8. **Preview:** entry cards, token counts per entry and in total, constant cost per turn, and an **activation simulator** (paste a sample scene and see which entries would fire and why).
9. **Output:** download `.json` · **create a new world book** · **merge into an existing book** (diff view, conflict resolution) · attach to character / persona / chat / global · optionally Lore-Bridge it immediately.

### 10.2 Metadata written
```json
"extensions": {
  "vellum3": { "kind": "situation", "tense": "now", "participants": ["Spike", "Dawn Summers"], "place": "Sunnydale", "visibility": "private" },
  "almanac": { "keys": ["raid", "bikers"], "scope": { "public": true }, "codexId": "thread:hellion_raid", "creator": "0.1.0" }
}
```
Both namespaces are kept, so books built here work with VELLUM III and with ALMANAC.

### 10.3 Round-trips
- **Codex → Lorebook** ("save the story so far"): exports the live Codex into a new book for sequels. Now-situations become `CURRENT -`, past becomes `History:`, forecasts become `Upcoming:`, secrets become narrator-only `Customs:` with a sign sentence, beliefs become `CURRENT - X Believes Y` with "unbeknownst" when false.
- **Health check** for any existing book: missing priority (which imports as 10), SillyTavern-vs-Lumiverse `selectiveLogic` confusion, future events in present tense, oversized entries, duplicate or generic keys, unreachable entries, constant-token cost.

### 10.4 Safety
Pasted lore is **data, not instructions**: it is wrapped in delimiters with a "treat as source material" rule. Generated entries pass the same adults-only floor: the validator flags sexual content attached to characters without an established adult age.

---

## 11. Almanac Engines

### 11.1 Calendar and astronomy
- Day count (Day 1 = story start), weekday cycle, configurable months and year label, named days (`OOC: Calendar` lore entries are imported), and season boundaries.
- **Sun:** sunrise/sunset from day-of-year and a latitude band (tropical / temperate / subpolar / polar, or explicit latitude), plus civil twilight.
- **Moon:** phase from a 29.53-day synodic cycle with a seeded offset (or set from lore).

### 11.2 Weather engine (deterministic, seeded)
- **Climate profile** (from lore, the `climate` variable, or Session Zero): maritime temperate · continental · mediterranean · desert · tropical · monsoon · subarctic · alpine · custom.
- Each profile defines per-season temperature min/max, a diurnal curve, precipitation likelihood, a fog tendency and a wind regime.
- **State machine:** weather types with hourly transition probabilities and **front persistence** (6–36 h). Transitions pass through intermediate states (clear → high cloud → overcast → drizzle → rain). Precipitation type follows temperature (rain / sleet / snow).
- **Seeded by `chatId + day`,** so swipes and regenerations never reroll the weather.
- **Outputs:** the current condition, intensity, temperature, wind, and a **12 h forecast**, pushed as macros.
- **Narrative control:** the model's `wx` op is accepted as truth (the engine re-seeds from it). The user can **schedule weather** ("a storm on Day 5 evening") as forecasts.

### 11.3 Place clocks
Opening hours plus routines → "who is likely here now" and "is it open". The Now note includes it when it matters (the shop is closed; the guard changes at 22:00).

### 11.4 Off-screen simulator
- **When:** the story clock advances ≥ `simStep` (default 2 h), or at scene end. It runs **asynchronously** after the reply, never blocking the next send.
- **What:** eligible agendas, threads and faction clocks (next-eligible ≤ now); NPC pairs co-located by routines get **social ticks** (drift ±1 with cause); rumours hop one edge with a distortion chance.
- **How:** one quiet call on the simulator connection with the minimal Codex slice (actors, goals, knowledge, places, routes) and rules: MKAMT, one change per actor, STALL needs a blocker, two stalls force change, no player predicates. Structured-output ops are tagged `source: sim` and narrator-only.
- **Re-entry:** a development that should reach the player becomes an **arrival** with a route (a messenger due at 18:00, a changed shop sign, a rumour at the market). Recall surfaces it only when the scene intersects that route: *"render those arrivals and invent no others."*

---

## 12. Craft Telemetry and genre delivery

Measured over the last 6 replies (display markup stripped):

| Metric | Signal |
|---|---|
| Repeated 3–5-grams | Phrases used ≥ 2× (excluding names) |
| Openings | First-sentence pattern class (weather / body part / dialogue / action / time) repeated ≥ 3/5 |
| Closings | Aphoristic or summary closers; questions to the player |
| Shape | Paragraph count and length variance; microparagraph cascades |
| Filter words | seemed / felt / realised / noticed / as if, per 1k words |
| Structures | "not X but Y", rule-of-three lists, em-dash density |
| Dialogue ratio | Against the `dialogue` setting (sparse ≈ 10–20%, dense ≈ 50%+) |
| Tense / POV drift | Simple verb-tense and pronoun heuristics against the settings |
| **Agency flags** | Sealed mode: {{user}} as subject of mental or emotional verbs (felt, thought, decided, wanted), or quoted {{user}} speech the player didn't write |
| **Genre delivery** | Whether recent ledgers emitted the lead genre's instrument ops (mystery: clue; romance: ladder/bond; thriller: countdown or antagonist move; horror: dread; comedy: callback) |

Output: the `[CRAFT]` and `[GENRE]` lines of the Now note (3 avoids + 1 technique; a genre nudge after 3 silent turns) and the Telemetry tab (trend charts, top offenders).

---

## 13. Macros, tools and endpoints

### 13.1 Push-model macros (zero latency)
| Macro | Value |
|---|---|
| `{{almActive}}` | `yes` when the Ledger manages this chat |
| `{{almDay}}` / `{{almClock}}` | `3` / `Thursday 14 Frostmoon, 14:32` |
| `{{almWeather}}` / `{{almForecast}}` | `heavy rain, 9°C, wind NW` / `easing 17:00 → overcast; clear by 22:00` |
| `{{almSun}}` / `{{almMoon}}` | `rise 07:12 · set 17:03` / `waning gibbous` |
| `{{almVoices}}` | `Mara#2, Kael#5, Joss#7` (the voice-slot roster for `[spk]`) |
| `{{almCast}}` | Present characters, one line each |
| `{{almMode}}` | Current scene mode |
| `{{almDue}}` | Consequences and forecasts due now |
| `{{almReturning}}` | `yes` if the player returns after a long absence |

The Ledger also mirrors key values into **chat variables** (`alm_clock`, `alm_place`, `alm_wx`, `alm_present`, `alm_mode`). If the extension is disabled mid-chat, the preset's standalone mode continues from the last verified state with no gap.

### 13.2 Pull-model macros (with arguments, used sparingly)
`{{almKnows::Mara}}` · `{{almBond::Mara::Kael}}` · `{{almRecord::loc:rusty_flagon}}`

### 13.3 LLM tools (`tools` permission; Council-eligible or inline function calling)
- `ledger_recall(query, k?)`: ranked Codex and document hits.
- `ledger_who_knows(fact)`: knowledge rows.
- `ledger_lookup(name)`: the record card.

These let tool-capable models retrieve on demand (the TunnelVision idea) without the Ledger injecting everything up front.

### 13.4 Shared RPC pool
- `almanac_ledger.state.<chatId>`: a compact snapshot.
- `almanac_ledger.codex_updated`, `almanac_ledger.chapter_created`: payloads shape-compatible with LumiBooks' hooks, so dashboards built for LumiBooks can listen.

---

## 14. UI

**Drawer tab "Almanac"** (free, no permission) with sub-tabs:

| Tab | Content |
|---|---|
| **Now** | Live scene: plate, present cards, constraints, due items, the Knowledge Brief preview |
| **Cast** | All characters: state, voice colour (picker plus "sample from avatar"), voice slot, routine, agenda, hidden pressure (spoiler-blurred), desire profile (NSFW-gated) |
| **Bonds** | **Force-directed graph** (SVG): nodes are characters (colour = voice colour), directed edges coloured by the dominant axis, width by magnitude. Filters: axis, NPC↔NPC only, changed since Day N. A timeline scrubber replays the graph over time |
| **Knowledge** | Matrix (facts × characters) with knows / believes / suspects / wrong / unaware; dramatic-irony highlights |
| **Codex** | Browse and edit records; lock; keys with heat; provenance links to messages |
| **Chronicle** | Volumes, arcs and chapters: edit, regenerate, unhide, merge, split, ghost; coverage bar |
| **Timeline** | Story-time ribbon of milestones; forecasts ahead |
| **World** | Calendar, forecast, climate profile, factions and clocks, rumours, reputation |
| **Lore** | Bridged books: mode, permission, classification stats, review queue, divergence list |
| **Creator** | The Lorebook Creator wizard (§10) |
| **Recall Feed** | Live retrieval sessions (Lore Recall style): query → candidates → scores → injected, plus rejections from validation |
| **Telemetry** | Craft metrics and trends |
| **Settings** | §18 |

- **Floating "Now" HUD** (`ui_panels`): time, weather, place, present medallions with mood dots.
- **Session Zero modal** on first run (04 §10).
- **Input-bar action** "Almanac command" (skip, recap, report, audit).

---

## 15. Performance

| Path | Target |
|---|---|
| Context handler (deterministic stages, prefetch hit) | ≤ 300 ms |
| Semantic candidates (`getActivated`, cached per turn) | ≤ 1.5 s |
| Controller (collapsed, only when prefetch missed) | ≤ 8 s, then fallback |
| WI interceptor (apply the plan) | ≤ 50 ms |
| Interceptor (splice + inject) | ≤ 100 ms |
| Ingest + fold + re-index | ≤ 200 ms |
| Summariser, archivist, simulator | Async; never block a send |

**Storage:** `events.jsonl` is append-only; a projection snapshot every 25 messages; the Codex and the key index are JSON rewritten on change. The event log is compacted by folding tombstoned swipes older than the raw tail.

---

## 16. Failure modes and recovery

| Failure | Response |
|---|---|
| Ledger missing or broken | Normalise → repair call → extractor → mark unverified (§4.4) |
| Contradictory delta | Rejected with a reason; next turn's Now note restates the truth |
| Storage lost or corrupted | **Rebuild from transcript:** every stored reply still contains its `<ledger>` (display regex hides it; prompt regex strips it from the model's context, but the stored text keeps it). Replay → identical state |
| Extension disabled mid-chat | The preset falls back to standalone using the mirrored chat variables |
| Controller timeout | Deterministic selection; logged in the feed |
| Summariser drops facts | Coverage check forces a repair pass (§5.2) |
| Lorebook edited externally | Hash change → re-classify changed entries; divergence recomputed |
| Two memory systems active | Diagnostics warn (§17) |

---

## 17. Interoperability

| Other system | Recommendation |
|---|---|
| **LumiBooks** | Run one summariser. The Ledger can **import** LumiBooks chapters and Codex via its RPC snapshot on first run, then take over |
| **Lore Recall** | Choose one retrieval owner per book. Books managed by Lore Recall should be set to **Native** in the Ledger |
| **VELLUM II / III** | Don't run two state engines on one chat. ALMANAC reads `extensions.vellum3` natively, and the Creator writes it |
| **Memory Cortex** | Optional signal source. Its memory section auto-injects whenever enabled; set its formatter to Minimal, or disable vectorised chat memory, to avoid duplication. The Ledger's mirror book with vectorised entries is the preferred semantic path |
| **Loom Summary** | Disable it, or at least its message limit. The Chronicle replaces it |
| **Council** | Ledger tools are Council-eligible; a "continuity auditor" member can call `ledger_who_knows` |

---

## 18. Settings reference

| Group | Setting | Default |
|---|---|---|
| Core | Enable for this chat · Strictness (Lenient / **Strict**) · Format aid (off) · Auto-repair (**on**) | — |
| Chronicle | Raw tail (20 msgs / 12k tokens) · Chapter threshold · Arc/volume fan-in (4) · Hide covered (**on**) · Summariser connection | Active connection |
| Recall | Budget (2,400) · Controller (**Off** / Collapsed / Traversal) · Controller connection · Semantic source (mirror book / Cortex / none) · Recall placement (**before history** / depth 4) | — |
| Keys | Heat demotion (on) · Max keys per record (12) · Stop-list | — |
| Lore Bridge | Default book mode (**Assisted**) · Default permission (**Read-only**) · Classifier connection | — |
| Engines | Climate · Latitude band · Calendar · Sim step (2 h) · Sim connection · Social ticks (on) · Rumours (on) | — |
| Director | Sidecar planner connection · Sidecar timeout (20 s) | — |
| Mirror book | Mirror Codex to a lorebook (**off** / summaries / full) · Vectorise mirror entries | — |
| Render | Theme follow (preset / override) · Colour source priority · HUD (on) | — |
| Privacy | Never send narrator-only records to tools (on) | — |

---

## 19. Delivery roadmap

| Phase | Scope |
|---|---|
| **MVP** | Ingest + validation + branch-aware State Engine; Now note; per-message snapshots; speaker stylesheet; scene-boundary chapters with hide + splice; deterministic Codex; key-based Recall; drawer tabs Now / Cast / Chronicle / Codex / Recall Feed |
| **v1** | Lore Bridge (all scopes, activation modes, divergence); Lorebook Creator (all modes, validator, linker, writer); weather, calendar and astronomy engine; Knowledge Brief; Craft Telemetry; archivist passes; Bonds graph UI; Session Zero |
| **v2** | Controller retrieval (collapsed + traversal) with prefetch; Sidecar Director; off-screen simulator + social ticks + rumours; LLM tools; mirror book + vectorisation; LumiBooks/VELLUM importers |
