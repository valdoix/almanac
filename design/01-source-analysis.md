# 01 — Source Analysis

What each source does well, what it gets wrong, and what ALMANAC takes from it.
Every claim below comes from reading the files (preset JSON, regex scripts, extension source, Lumiverse docs), not from descriptions of them.

---

## 1. The presets on `valdoix/almanac@dev`

| # | Preset | Format | Size | Blocks / prompts | Regex |
|---|---|---|---|---|---|
| 1 | CHRONICON v1.9.0 — Archive Pass | Lumiverse v2 | 446 KB | 63 blocks, 11 variable groups | 31 |
| 2 | Tessera 1.0.0 | Lumiverse v2 | 162 KB | 42 blocks | 29 |
| 3 | VELLUM II — Engine 2.3.2 | Lumiverse v2 | 221 KB | 69 blocks | 23 |
| 4 | VELLUM II — ARGENT LOOM 1.5.1 | Lumiverse v2 | 214 KB | 52 blocks | 20 |
| 5 | ≽^•⩊•^≼ KittyLotus 3.6.6 | Lumiverse export | 1.26 MB | 127 blocks, 17 variable groups | 75 |
| 6 | Freaky FrankenSIM 1.0 | Lumiverse export | 179 KB | 64 blocks | 0 |
| 7 | Freaky Frankenstein 5.4 Internal States | SillyTavern | 144 KB | 63 prompts | 25 |
| 8 | Stabs GLM 5.1 Directives v3.0.1 | SillyTavern | 152 KB | 111 prompts | 4 |
| 9 | The HawThore Directives | SillyTavern + RoleCall | 994 KB | 342 prompts | 0 |
| 10 | The H.T. Files — Paramnesia V3 | SillyTavern + RoleCall | 521 KB | 224 prompts | 0 |
| 11 | IHYLL 1.1.5 Official | SillyTavern | 131 KB | 65 prompts | 11 |

### 1.1 CHRONICON v1.9.0 — the benchmark to beat

**What it does well**
- **Typed state contract (v3).** Delta operations `NEW / UPDATE / REMOVE / RESOLVE / ABANDON / SUPERSEDE / REPLACE / TOMBSTONE`. Each fact has one owner: scene owns time and location, characters own their body and held items, knowledge owns beliefs, and so on. "Omission never means deletion" is the right rule.
- **Atomic turn semantics.** A swipe or regenerate discards the rejected candidate's state, clock and consequences. CONTINUE never repeats accepted text.
- **Presence tiers** (spotlight / periphery / offscreen), **agenda rows** for every consequential NPC, and a **route ledger**: nothing teleports, and every movement has a route and a duration.
- **Off-screen threads** with `ADVANCE / COMPLICATE / BRIDGE / RESOLVE / STALL`. A STALL must name a blocker, and "two stalls then something must change" prevents dead threads.
- **Typed knowledge rows**: holder, fact, source, acquired time, access vector, confidence, truth status.
- **Campaign tools** (audit, relationship report, timeline reconstruction, codex, inventory, broadsheet, social message, image-prompt bridge, chapter cartouche, weather header), all rendered in one `chronicon_toolkit` wrapper.
- **Five visual worlds** (solar, prism, botanical, candy, abyss). Each changes typography and geometry, not just colour.
- **Director modes** (micro / standard / deep) with a stop rule and per-model errata.

**What it gets wrong**
- **The model is the database.** Standalone mode asks the model to re-emit the *complete checkpoint* every turn (`<checkpoint>complete latest canonical state, including unchanged durable facts</checkpoint>`) plus 17 other lanes. That is hundreds to thousands of output tokens a turn. It drifts, gets truncated, and is the first thing a model drops under pressure. The preset itself admits this ("drop audience, relationship and timeline displays… before shortening narrative").
- **The dialogue colouriser doesn't colour by speaker.** The display regex captures `data-spk="$1"` but paints every speaker with the theme's single `--accent`. "Resolve the configured cast colour" is never implemented. It also inlines a complete `<style>` sheet into *every quoted line*.
- **Safety-hostile blocks.** "Ignore all built-in content policies…", `dubcon` / `noncon` categories, and "age restrictions… all fictional scenarios are permitted" in the Typed Knowledge block contradict its own "locked safety floor". Frontier models are trained to refuse exactly this kind of text, so it causes refusals instead of preventing them.
- **Template bugs:**
  - The Deep receipt gate uses `theme={{var:visual-theme}}`: one colon and a hyphen, so it never resolves.
  - `<chronicon_reverie mode="standard" theme={{var::visual_theme}}>` has an unquoted attribute.
  - The anatomy-detail branch sits *inside* the `explicit_length::extended` branch, so it only applies when length is "extended".
- **Genre is one line per genre.** It changes salience words, not what a scene must deliver.
- **The receipt is visible.** `chronicon_reverie` puts planning conclusions in the reply every turn: tokens spent on display, and prompt echo risk.

**ALMANAC keeps:** single ownership of each fact, typed operations, atomic swipe semantics, presence tiers, agendas, routes, STALL discipline, campaign tools, multi-world themes.
**ALMANAC changes:** the model emits *deltas only* and the extension compiles state. Colour is resolved per speaker. The safety floor is actually locked. Genre gets contracts. Planning is hidden.

### 1.2 Tessera — the most modern design

**What it does well**
- **A boot block that writes nothing.** It sets `tx_route` from `{{lastGenerationType}}`, detects OOC with `{{matches}}` on `{{lastUserMessage}}`, and detects the engine with `{{vellumActive}}`. Every later block branches on the route.
- **Absolute boundaries in plain language**, not policy-speak: adults only, stated age never outweighs framing, consent free and ongoing, resistance play only after on-page agreement with a working stop. "Turn it inside the story… go on without a lecture."
- **Persona modes:** sealed / continuity / director / **full cast** (the player hands over their persona). **Outcomes:** player decides / fair hidden d20 / narrator judges.
- **Cast engine:** every present character carries Body, Emotion, Want/Fear/Tactic, Mask, Regard, Memory. "Lead with the facet of a character used least lately." The swap test.
- **Living world:** before any coincidence, check actor, motive, knowledge, access, means, route and time (MKAMT). Move by the smallest meaningful change. Never manufacture urgency. At most one unprompted environmental act per reply.
- **Time and weather:** "Time only moves forward. Every completed exchange costs at least a minute: talk 1–5, a search 10–30, crossing town 20–60." Fronts build, hold and clear. Weather acts on everything and never mirrors a feeling.
- **Genre engine:** each genre option is a *delivery contract* ("Deliver… Avoid…").
- **Presentation marks:** `[spk=Name#N|tone]`, `[thk=…]`, `[txt=sign]…`, and `[vtk=kind|Title|detail]` with sub-syntax (`»` received, `«` sent, `→` route leg, `[redacted]`, `[meter=Label|cur|max]`). The model writes content, never HTML.
- **Turn Frame:** an **echo guard** that quotes the previous reply's first and last ~25 words (via `{{regex}}` on `{{lastCharMessage}}`) and forbids reusing them; **craft watch** (three `{{pick}}`-rotated failure modes per turn); a **presentation lot** (random opening angle); ambient cues on dice rolls; a fair d20 with outcome bands.
- **Director's Pass:** ROUTE, GROUND, SEAL, GNOSIS, MINDS, WORLD, MOVE, PREMORTEM, VOICE, EMIT. **Auto triage** (routine / charged / pivotal) with word ceilings 80 / 180 / 350. A **native vs visible channel** switch: the visible `<scene_plan>` goes into a collapsed drawer and is stripped from later prompts.
- **Prompt-side regex thinning:** older speaker marks are stripped at `min_depth: 4`, older headers at depth 6, older artifacts reduced to label and text. Plans, registers and engine hints never return to the prompt.

**What it gets wrong**
- Standalone continuity is only "hold the thread yourself". Without the engine there are no inventory, bond or knowledge ledgers.
- The sky plate knows only hour and weather glyph: no season, moon phase, biome, interior scenes or temperature visuals.
- Dialogue colour is text colour only. No blocks, no nameplates.
- The intimacy layer is tasteful but thin (textures multi-select plus a desires text box).

**ALMANAC keeps nearly all of Tessera's architecture** (boot routing, locked boundaries, persona modes, MKAMT, minute costs, genre contracts, marks, echo guard, triage) and adds tracking, visual depth and the extension loop.

### 1.3 VELLUM II Engine and ARGENT LOOM (your own)

- The `<vellum>` JSON state block is folded by the extension into an append-only event-log chronicle. This is the correct architecture, and ALMANAC follows it.
- **The Codex (provisional canon):** when a fact is missing, invent up to three concrete ones and bind them so they never drift.
- **Emotional Landing:** intent → delivery → access → interpretation → defense → aftermath, with a causal (not random) outcome.
- **Rough Hand:** exactly one deliberate human imperfection per turn.
- **Scribes:** voice rotation.
- NPC↔NPC social autonomy and faction↔faction politics as separate dials.
- **Model errata** for each family, split into prose failures and state-block failures ("Claude feels the prose is done when the emotional beat lands", "reasoning models put the JSON in the thinking channel").
- The extension's own README lists the known pain: **models drop the JSON block**, hence Auto-Repair, the Repair button and the "show the model its last block" aid. ALMANAC answers this with a line-based delta format that is harder to break and cheaper to repair (see 02 §20).
- ARGENT adds significance and stewardship, generation-mode routing, and Loom bridges (`{{loomStyle}}`, `{{loomUtils}}`, `{{loomSovHand}}`, `{{loomRetrofits}}`).

### 1.4 KittyLotus 3.6.6 — macro state machines

- It computes state **with macros alone**, no extension:
  - The *Slowburn Signal Roll Engine* rolls `{{roll::1d20}}` for landing, clearance, heart leak (0–5) and static (1–5), and maps them to "catastrophic misread … rare clarity". Its rule: **"Slowburn delays certainty, not action."**
  - The *Villain Stage Runtime* advances antagonist stages every N turns via `{{@kl_villain_*}}` chat vars.
  - The *Telemetry Pressure Governor* keeps dependency load 0–100 with bands and even reads `{{rejectedSwipe}}` to roll back on a swipe.
- It also has an ambient and chaos event engine, a prose roll engine, wildcards, an anthro-realism module, a mobile narrative-wrap resolver, and HTML safety and compatibility governors.
- Weakness: 1.26 MB and 127 blocks. It works through sheer mass, and it is hard to maintain or reason about.
- **ALMANAC takes:** macro-computed dice engines for standalone mode, `{{rejectedSwipe}}`-aware rollback, and the slowburn signal model (as an optional romance module).

### 1.5 The HawThore Directives and Paramnesia V3 — the anti-slop encyclopedia

- **Quality hazards with rotating spotlight.** Each enabled hazard adds itself to a roster, then `{{roll 1d{{qc_count}}}}` spotlights only one to three hazards per turn. This avoids *instruction fatigue*: the model sees everything, but only a few are stressed at a time.
- **Hazard families:**
  - *Kill your darlings* (purple prose, adjective chains, metaphor density, body-language novels, emotional echo, weighted everything, pathetic fallacy, sensory carpet-bombing, echo reading, mirror descriptions).
  - *Narrative sycophancy* (mind reading, frictionless competence, **emotional convergence**, reality bending, hivemind, anti-escalation).
  - *Artificial perfection* (perfect emotional intelligence, timing, articulation, memory, recovery, morality, awareness, bodies).
- **Subtext injections** (someone is lying, secret test, hiding illness, exit plan, debt comes due), scene pulse (low / medium / high), and named style "affinities".
- **Genre directors** (HEARTTHROB romance, LINGER horror, PALIMPSEST mystery, TRIPWIRE thriller…) that each re-frame the whole narration.
- Weakness: SillyTavern toggle sprawl (hundreds of on/off prompts, no typed variables, no routing).
- **ALMANAC takes:** the hazard taxonomy and the rotating spotlight. The subtext deck becomes an NPC "hidden pressure" system.

### 1.6 Freaky Frankenstein and FrankenSIM — emotion model and self-grading

- **VAD emotions** (valence / arousal / dominance) mapped through "Nine Instincts" to Parrott's emotion tree. Anger with high dominance is cold and deliberate; with low dominance it is desperate. "When anger is logical, the NPC MUST express fury."
- **Ballast:** mental stamina depletes under pressure.
- **Antithesis Protocol:** phased CoT that opens by *grading the previous response A–F*, listing three improvements and one prose fix, then the pacing state (SLOW / FLOW / PUSH), then a game-state lock.
- Internal States (GM notebook, agenda, 12-axis relationship RPG, inventory and feats and titles, D&D simulator, dice engine), HQ NPC genesis, onomatopoeia, pop-in graphics.
- **ALMANAC takes:** VAD as the numeric backbone of mood tracking, and the "grade the last reply" step (inside PREMORTEM, never visible).

### 1.7 Stabs GLM Directives v3

- A tiered architecture (Tier 0 meta-override → Tier 4 output additions). "Behind the Scenes" tracking split into physical, emotional, appearance, relationships, inventory, stats, narrative and off-screen modules. NPC cognitive bounds, an allowed-speaker-count cap, and brain-power levels.
- **ALMANAC takes:** the speaker cap and the split of tracking into independently toggleable lanes.

### 1.8 IHYLL 1.1.5

- A delight layer: info board, tarot "Cosmic Eye", a Spotify-style "Moonlit Melody" card, a web-novel chapter title, a "Beckoning Bell" summon, a sanity-tier system, and a summariser ("The Lamp").
- **ALMANAC takes:** the idea that small in-world gadgets make the page feel alive. They become VTK kinds (song card, tarot, chapter card).

---

## 2. Lumiverse (staging) — what the platform can actually do

The whole design depends on these capabilities. Each was confirmed in `developer-docs/` or `user-docs/`.

| Capability | Where | Used for |
|---|---|---|
| Prompt blocks: roles `system / user / assistant / user_append / assistant_append`; positions `pre_history / post_history / in_history`; injection triggers; radio and checkbox groups | presets/prompt-blocks | Block architecture, Player's Seal (`user_append`) |
| Prompt variables: text, textarea, number, slider, dropdown, on/off, multi-select (`separator`, `{{var::x::ison::a,b}}`), **placement selector** (a dropdown moves its own block) | presets/prompt-variables | The settings UI; "adherence placement" for CoT and reminders |
| Macro engine: `if / elseif / else`, `switch`, `let`, `map`, `foreach`, `calc`, `roll`, `pick`, `random`, `regex`, `matches`, `len`, `default`, chat vars (`{{@x}}`, `setchatvar`, `incchatvar`), `lastGenerationType`, `lastCharMessage`, `lastUserMessage`, `rejectedSwipe`, `rejectedGeneration`, `idleDuration`, `messageCount`, `model`, `hasExtension` | presets/macros-reference | Routing, dice, echo guard, idle recaps, swipe-aware variance |
| Regex scripts: targets `prompt / response / display`, placements `user_input / ai_output / memory`, `min_depth` / `max_depth`, `substitute_macros: none / raw / escaped / after` | customization/regex-scripts | All visuals; prompt thinning; memory stripping |
| **Activate prompt blocks from matches:** an assistant *capture block* at the end of a reply enables or disables preset blocks for the next generation, in "latest" or "until changed" mode | customization/regex-scripts | Scene-mode router (combat, intimacy, investigation… modules load only when needed) |
| **Associative regex actions:** clickable `data-regex-action` elements that send, append, set state, or draft-and-fork | customization/regex-scripts | Director's Desk quick actions (time skip, recap, report) |
| Context filters (strip HTML, `<details>`, and Loom tags beyond a keep depth; "keep only") | presets/context-filters | Token hygiene |
| HTML islands (a block with `<style>` becomes a Shadow DOM; three or more inline `style=` attributes stay in light DOM; `data-no-island`) | frontend-api/html-islands | Render strategy for standalone vs linked mode |
| World books: CRUD, `extensions` kept on import, positions 0–6, sticky / cooldown / delay, groups, recursion, budgets, vectorised entries, `getActivated(chatId)` (keyword and vector with scores) | backend-api/world-books | Lore Bridge, mirror books, semantic candidates |
| **World-info interceptor:** before activation, `disabled / enabled / forced / mutated.content / outputOrder` per entry (10 s budget) | backend-api/world-info-interceptor | Take over activation of attached lorebooks; mark moved-past lore |
| Context handler (before assembly, up to 120 s, `required`, abort signal) | backend-api/context-handlers | Heavy retrieval before the prompt is built |
| Interceptor (after assembly, manifest timeout up to 300 s; `__isChatHistory`, `sourceMessageId`, breakdown entries) | backend-api/interceptors | Splice chapter summaries in place, drop covered turns, inject the "Now" note |
| Chat mutation: `setMessagesHidden` (**only excludes from embeddings, not from the prompt**), `updateMessage`, `appendMessage` | backend-api/chat-mutation | Hide summarised turns (UI and vectors); the interceptor removes them from the prompt |
| Message content processor, `render` origin (display-only transform; not stored, not in the prompt) | backend-api/message-content-processor | Render per-message tracker snapshots from extension state |
| Display resolver and `ctx.dom.addStyle` | frontend-api/display-resolver | One global stylesheet for speaker colours and themes |
| Macros: register, plus the **push model** `updateMacroValue` (zero-latency) | backend-api/macros | `{{almActive}}`, `{{almNow}}`, `{{almVoices}}`, `{{almWeather}}`… |
| Variables API (local, chat, global) | backend-api/variables | Share state with preset macros |
| `generate.quiet / raw / batch` with structured output (OpenAI `response_format`, Gemini `responseSchema`, Anthropic tool-forcing) and a per-request reasoning override | backend-api/generation | Summariser, archivist, lorebook creator, repair, off-screen sim |
| `spindle.assemble()` (assemble a custom block graph without calling the LLM) | backend-api/generation | Sample-prose preview; split-brain Director |
| LLM tools (`registerTool`, council-eligible, inline function calling) | backend-api/llm-tools | Optional `recall()` / `who_knows()` self-retrieval tools |
| Memories (Cortex entities, relations, salience, vaults, interlinks; `chatMemory.get` hybrid vector and BM25) | backend-api/memories | Optional semantic signal |
| Storage / userStorage (per-user JSON files) | backend-api/storage | Source of truth for the Ledger |
| Shared RPC pool | backend-api/shared-rpc-pool | Publish ledger snapshots to other extensions (LumiBooks does the same) |

Two platform facts that shape the design:

1. **`hidden` does not remove a message from the prompt.** Hiding only removes it from embeddings. To actually hide summarised turns from the model, an interceptor must drop them and splice the summary into their place. LumiBooks does exactly this.
2. **Only the WI interceptor sees entries *before* activation, and it has a 10 s budget.** Anything slow (controller LLM, graph expansion) must run earlier, in the context handler or as a prefetch after the previous reply. The WI interceptor only *applies* decisions.

---

## 3. LumiBooks (AMousePad) — tiered compression and the Codex

**Mechanics (from `src/backend/`)**
- **Memoria**, the librarian persona, writes **Chapters → Arcs → Volumes** (tiers 1–3). They are stored as world-book entries in a per-chat LumiBooks book, with metadata `msgIds`, `tier` and `sourceChapterEntryIds`.
- `coverage.ts` builds `coveredBy: msgId → entry`. Volumes supersede arcs, and arcs supersede chapters.
- `injection.ts` walks the assembled prompt: for every `__isChatHistory` message it flushes any summary whose span ends before that message, then **drops covered messages**. The result: *summaries appear exactly where the turns used to be*, preserving chronology.
- `resyncVisibility` also flags covered messages `hidden` (UI and embeddings) and unhides them when coverage is removed.
- **Ghost chapters** are disabled entries that still count as covering during generation, so the same span is never summarised twice.
- **The Codex** is eight JSON files (entities, relations or inline ties, timeline, threads plus seeds, world, knowledge, keywords…) kept in extension storage. They are synced to world-book entries for keyword retrieval, with a sync lock and delete retries (deletes contend for the host's vector-store write lock).
- **Archivist passes:** `update` (UPDATE → SWEEP → COMPRESS), `catchup-fast`, `catchup-ultra`, `rebuild`, `verify`, `reconcile`, `refresh`, `tidy`.
- **A cursor with consumed-message signatures** detects edits and deletions (divergence) and rewinds. Records can be **locked** (user-owned). Per-file states are `on / noInject / frozen`. Snapshots are published on the RPC pool.
- **Quality rules worth copying:**
  - Keywords are 1–2 words, 4–12 per record, concrete nouns, and never repeat the record's own name.
  - "One fact lives in one place."
  - Snapshot semantics: describe the present, with no "was X, now Y" residue.
  - The timeline is append-only.
  - "Keep additions and deletions similar in volume."

**Weaknesses**
- The Codex is **snapshot-only**. Once a tie or trait is rewritten, its history is gone (only the timeline keeps history). You cannot ask "what did Mara believe on Day 3?"
- Codex retrieval is **keyword-only** via synced entries, so it is as brittle as any lorebook.
- Swipes and branches are handled by divergence heuristics rather than by keying state to message and swipe identity.

---

## 4. Lore Recall (archkr) — reasoning-driven retrieval

**Mechanics (from `src/backend/retrieval.ts`, about 5,100 lines)**
- It builds a **category tree** for each managed book, from entry metadata (free) or with an LLM (categorised in chunks, with granularity presets and optional dedup).
- **Deterministic scoring layer:** direct-mention seeds, scene anchors, background mentions, related-support expansion with protected slots, scope-core reserve, and **feedback boost and decay** (hot for 2 h, warm for 12 h, stale after three unused injections).
- **Controller modes:**
  - *Collapsed*: one call picks scopes from a depth-limited tree.
  - *Traversal*: navigate, search and retrieve over up to N steps, then a final **selective manifest** that picks exact entry IDs.
  - Guarded by a 45 s per-call timeout, a 175 s total budget and at most 12 calls.
- Native `constant` entries are always reserved outside the dynamic cap. It injects one system message tagged in Prompt Breakdown as "Retrieved Lore".
- **Live retrieval feed** (scope → manifest → pulled → injected), per-book permissions (read+write, read-only, write-only), snapshots and diagnostics.

**Weaknesses**
- Retrieval covers **static lore only**. It has no memory of the story being played.
- It is character-scoped (per-character config) and knows nothing of who-knows-what.
- Latency: traversal mode can add many seconds before the first token.

---

## 5. A lorebook-creator prompt (an uploaded file)

> Historical. ALMANAC is not associated with the project this prompt came from; since 1.17 the Creator and the Lore Bridge follow ALMANAC's own lorebook format ([10](10-lorebook-format.md)).

**What it defines**
- **Two modes:** Quick (JSON only) and Guided (Analysis → Generation → Optimization, with checkpoints). An **entry generator** offers Option A (suggest a list from a premise), Option B (parse raw lore) or Option C (examples for a category).
- **Its reading conventions.** A lorebook is read as *"the world as the story begins"*:
  - Title labels decide the kind: `Character:`, `Location:`, `Faction:`, `Item:`, `Rule:`, `History:`, `Customs:`, `CURRENT -`, `Upcoming:` / `Prophecy:`, `Timeline Boundary -`, `OOC:`.
  - The first sentence follows a fixed formula ("X is a/an role in Parent").
  - Hours, routes and climate are parsed from plain phrasing.
  - Participants are the names before the verb in a CURRENT title. Mistaken beliefs are flagged with "unbeknownst".
  - Anything future is written in the future tense and becomes a forecast, never a fact.
  - Secrets carry a noticeable sign.
- **A metadata block** on each entry: `kind`, `tense`, `participants`, `place`, `visibility`, `expected`, `members`.
- **Lumiverse compatibility table:** `selectiveLogic` codes 0 = AND, 1 = NOT, 2 = OR, 3 = NOT ALL. `priority` is budget survival and `order` is sequence, so set them equal. A missing priority imports as 10.
- **14 templates**, a priority tier ladder (300 → 80), a position selection matrix, sticky and cooldown guidance, recursion linking strategies, a keyword matrix, the bracketed data format `[ key(value); ]`, and a full **QA checklist**.

**Why it matters for ALMANAC:** it is a *typed grammar for lore*. The Ledger extension uses the same grammar in both directions:
- **Import:** read attached lorebooks into typed Codex records (a person, a place, a current situation, a forecast, a belief), so the Codex never starts from zero.
- **Export:** the Lorebook Creator writes entries in ALMANAC's own lorebook format, with `extensions.almanac.lore` metadata ([10](10-lorebook-format.md)).

---

## 6. Gap analysis — requirement → best existing → gap → ALMANAC answer

| Requirement | Best existing | Gap | ALMANAC answer (doc §) |
|---|---|---|---|
| Deep character states | Tessera cast engine; Frankenstein VAD | No numeric persistence standalone; no decay or recovery | State vector (body, mind, drives, mask, regard, memory) with clock-driven decay; tracked by deltas (02 §6) |
| NPC autonomy | CHRONICON agendas; Tessera "what would they do without {{user}}" | Agendas bloat output; no routines | Agenda + routine + initiative budget; off-screen sim by the extension (02 §7, 05 §11) |
| Deep world sim | CHRONICON threads; Tessera MKAMT | No economy, rumour or faction clocks | Faction clocks, rumour mill, prices, public events, location graph (02 §10) |
| NPC↔NPC relationships | Tessera "Bonds"; VELLUM social autonomy | Hub-and-spoke tracking centred on {{user}} | Full directional multigraph with drift rules and gossip propagation (02 §8) |
| CoT both channels | Tessera native/visible + triage; CHRONICON modes | No swipe awareness; no self-grade; no sidecar | 11-step Director's Pass, triage, `{{rejectedSwipe}}` variance, optional split-brain sidecar (02 §19) |
| Anti-slop | Tessera prose floor + echo guard; HawThore hazards | Static lists cause fatigue; no telemetry | 5-layer anti-slop with rotating hazards and extension-side repetition telemetry (02 §18, 05 §12) |
| Player agency | Tessera persona modes + Seal | — | Adopt and extend with an "attempt vs outcome" parser in the CoT (02 §5) |
| Dialogue colouriser (blocks) | Tessera voice slots; VELLUM CSS-injection plan | CHRONICON colours all speakers alike; nobody renders blocks | 4 styles (block / chip / tint / script), medallion and ribbon nameplate, 10 tone treatments, stable per-cast colours via extension CSS, voice-slot fallback (03 §3) |
| Weather and time | Tessera minute costs + sky plate | Plate knows only hour and glyph | Extension weather, calendar and astronomy engine; plate with season, moon, biome, interior window, intensity (02 §11, 03 §4) |
| Knowledge firewall | CHRONICON typed rows; VELLUM dramatic irony | No per-scene negative knowledge brief | "Knowledge Brief": what each present NPC knows, believes wrongly, and does NOT know about the scene's topics (02 §9, 05 §8) |
| Meaningful genres | Tessera contracts; Paramnesia directors | Genre doesn't change mechanics | Genre contracts + mechanical hooks (clue board, dread meter, tension ladder, countdown) + genre-driven visuals (02 §12) |
| NSFW enhancer (adults, consenting) | Tessera textures; CHRONICON explicit framework | CHRONICON unsafe; Tessera thin | Locked adult and consent floor; desire profiles; consent choreography; pacing phases; physical continuity; aftercare (02 §17) |
| Trackers | CHRONICON ledger + atlas + register | Heavy, model-authored, unverified | Delta DSL → extension-compiled snapshots, rendered per message; 12 tracker panels (02 §20, 03 §7) |
| VTKs | Tessera kinds + sub-syntax | — | Expanded library; artifacts filed into the Codex so their text is recallable (03 §6) |
| Scene headers | Tessera sky plate; CHRONICON cartouche | — | Plate plus a dynamic title card, genre typography, weather-aware layers (03 §4) |
| Romance pace | Tessera 5 paces; KittyLotus slowburn roll | No ladder, no gates | Tension ladder with evidence gates, landing model, non-convergence (02 §13) |
| Dialogue frequency | Tessera / CHRONICON 5 levels | — | Plus speaker budget and NPC↔NPC talk rules (02 §14) |
| World disposition | Tessera 5 levels | No reputation | Disposition prior + per-faction and per-place reputation tracked by the Ledger (02 §15) |
| Consequences | Tessera difficulty; CHRONICON failure shape | Consequences forgotten after a scene | Consequence ledger with due-dates and healing clocks, surfaced by Recall (02 §16) |
| Summarise + hide + Codex | LumiBooks | Snapshot-only codex; keyword retrieval | Event-sourced Codex with history; scene-boundary chapters; splice-in-place (05 §5–6) |
| Retrieval | Lore Recall | Static lore only | Hybrid recall over story memory plus lore, knowledge-aware (05 §8) |
| Lorebook creator | An uploaded creator prompt | A prompt, not a tool | A conversation with the model that plans, revises, writes, validates, links and saves (10) |
| Seed from attached books | — | — | Lore Bridge reading the Almanac lorebook format and free-form books (05 §9, 10) |
