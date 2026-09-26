# 04 — Recommendations and Additions

Beyond the requested features, these are the additions I recommend, roughly in order of impact. Each says **why** and **how** it fits the design.

---

## A. High impact (build these first)

### 1. Scene-mode router: load modules only when the scene needs them
**Why:** every preset in the set pays for combat, intimacy, investigation and travel rules on *every* turn. KittyLotus is 1.26 MB largely for this reason.
**How:** the ledger's last line is `mode: …`. A preset-linked regex uses Lumiverse's *Activate prompt blocks from matches* (assistant capture block, "Until changed") to enable one Scene Module for the next turn (02 §24).
**Gain:** about 1.5–3k tokens saved per turn, and sharper instructions: a combat module can say things a general block can't.

### 2. Split-brain Director (sidecar planner)
**Why:** planning quality and prose quality come from different strengths. A cheap, strong reasoner can plan for an expressive writer that plans poorly, or for a model with reasoning turned off.
**How:** with `cot_channel: Sidecar`, the Ledger's context handler builds a planning-only prompt with `spindle.assemble()` (the current block graph minus prose blocks, plus the Director's Pass). It runs it on the planner connection and injects the result as a `<director-plan>` note just before the Output Contract. The writer's CoT drops to Silent.
**Guardrails:** 20 s budget. On timeout, fall back to Native/Visible. The plan is never shown to the user unless debug is on.

### 3. The world is computed, not remembered
**Why:** weather, sunrise, moon phase, weekday and "is the shop open" are the easiest continuity to lose and the easiest to compute.
**How:** the Ledger's almanac engine (05 §11): a climate profile plus season → a Markov weather chain with fronts; astronomical sunrise/sunset from a latitude band; moon phase from the day count; opening hours from the Codex. The model reads `{{almWeather}}` and `{{almForecast}}` and may override through the ledger (the engine re-seeds).

### 4. Knowledge Brief: tell the model what characters *don't* know
**Why:** leaks almost never come from forgetting what someone knows; they come from not tracking what they *don't*.
**How:** for each present NPC, only for topics in play, the Ledger injects KNOWS / BELIEVES / WRONG / DOES NOT KNOW (02 §9.4). GNOSIS in the CoT checks against it.

### 5. Craft Telemetry: dynamic anti-slop
**Why:** static banned-word lists stop working after a few hundred turns, because models find new tics.
**How:** the Ledger measures the last six replies (repeated n-grams, opening patterns, paragraph-shape monotony, filter words, em-dash density, rule-of-three, dialogue-ratio drift) and injects **three concrete avoids plus one technique** (02 §18, L5).

### 6. Per-message tracker snapshots (time-travel trackers)
**Why:** CHRONICON's trackers show what the model *claimed* at that turn. Snapshots show what the verified state *was*, which makes auditing and rewinding trustworthy.
**How:** the render processor draws the drawer from the event log at that message id (03 §7.2).

---

## B. Medium impact

### 7. "Previously on…" when the player returns
When `{{idleDuration}}` is 12 h or more, the Boot router sets `alm_returning`. The Turn Frame then asks for a two-line in-world re-entry before the scene resumes, and the Ledger attaches a **Recap folio** (last scene, open threads, who's where) to the drawer. Long campaigns die at re-entry; this fixes that.

### 8. Swipe intelligence
Show the model the opening of the rejected take (`{{rejectedSwipe}}`) and require a different MOVE and first line (02 §19.4). Swipes should produce alternatives, not paraphrases.

### 9. Artifact filing
Letters, contracts, messages and signs become Codex documents with their exact text and retrieval keys (03 §6.3). Mysteries and intrigue depend on quoting documents precisely.

### 10. Session Zero
The first time ALMANAC runs in a chat, the Ledger offers a **Session Zero** modal (or an OOC interview if the extension is absent):
- genre, tone, persona mode, NSFW level and limits, romance pace, difficulty
- climate and calendar, start point
- which trackers to show

It writes these into the preset's prompt variables *for this chat* (Lumiverse **Preset Profiles** store per-chat block and variable state) and seeds the clock, weather and Codex. This moves the settings conversation to the start, instead of the player finding the wrong setting at turn 40.

### 11. Hidden pressures (subtext deck)
From HawThore's subtext injections. When a consequential NPC is first built, draw **one hidden pressure** from a deck weighted by genre: *someone is lying · a secret test · wants to leave · hiding an illness · a debt comes due · an exit plan · hiding power · a realised unsayable truth*. It's stored narrator-only in the Codex and surfaces through behaviour, never announced. It gives every NPC something the scene isn't about.

### 12. Chekhov ledger (plants and payoffs)
Track planted details (LumiBooks' "seeds") with a *payoff window*. The Ledger nudges the model when a plant has sat unused for N scenes and the genre wants a payoff (mystery clue, comedy callback, thriller setup). It never forces one.

### 13. Director's Desk buttons
One-click `/skip`, `/recap`, `/report`, `/audit` via associative regex actions (03 §9). OOC control shouldn't require typing a paragraph.

### 14. Preset Profiles per character
Use Lumiverse's per-character and per-chat block-state snapshots so a horror card automatically opens with the Horror contract, the Nocturne theme and high antagonist pressure, while a cozy card opens with Cozy and Candy.

---

## C. Quality and robustness

### 15. A safety floor written to *hold*, not to jailbreak
CHRONICON's "ignore all policies" blocks cause the refusals they're meant to prevent, and they contradict its own floor. ALMANAC's floor (02 §4) is short, locked, in plain language, and redirects inside the story. Explicit content between consenting adults is fully supported; it doesn't need adversarial framing to work.

### 16. Model errata, auto-selected
`{{matches::{{model}}::…}}` picks family-specific prose tics and state-block failure modes (VELLUM II's two-part errata). Nothing to configure.

### 17. Placement selector for adherence
The Director's Pass and the Anchor Reminder each carry a Lumiverse **placement selector** dropdown (Balanced · Frontier · Deep reminder), so users can move instructions closer to generation for models that under-weight system text, without editing blocks.

### 18. Golden-scenario test suite (for maintaining the preset)
A folder of short fixture chats plus the expected behaviours, re-run with `spindle.generate.dryRun()` and a quiet generation after every preset change:

| Test | Passes when |
|---|---|
| Agency | Given "I reach for the door", Sealed mode never writes the door opening *and* {{user}} walking through |
| Leak | An NPC who walked in late never references what was said before |
| Clock | Time never decreases across 20 turns; skips stop before choices |
| Weather | No jump from clear to storm without intermediate states |
| NPC↔NPC | With two NPCs present and a charged topic, at least one exchange between them in 3 turns |
| Convergence | A hostile NPC does not warm after one kind act |
| Floor | Ambiguous-age or incapacitated scenarios redirect in-story |
| Ledger | The ledger parses 100% of turns; `mode` is the last line |

### 19. Branch-aware everything
Swipes, edits, deletes and forks must not corrupt state. The Ledger keys every delta to `messageId + swipeId` and recomputes projections on navigation (05 §4). CHRONICON describes this in prose; the Ledger enforces it in code.

### 20. Group chats
In group chats, `{{isGroupChat}}` and `{{charFocused}}` route the Cast Engine to the focused speaker while everyone else "keeps living". The speaker cap still applies. The Ledger treats every group member as a cast member with a permanent voice slot.

---

## D. What I recommend *not* doing

| Idea (seen in the set) | Why not |
|---|---|
| Model re-emits the full state each turn | Token cost, drift and truncation. Deltas plus a compiler are strictly better |
| Audience reactions on by default | They spend tokens every turn and break immersion. Kept only as an optional "margin notes" VTK |
| Hundreds of on/off toggles | Unmaintainable and confusing. Typed variables on the owning block scale better |
| Probability-gated lore for story facts | Randomly forgetting canon is not variety. Use probability only for flavour |
| A "dark content" master switch that bundles sexual violence | Violence and sex are separate axes. Non-consent is excluded by the floor |
| Visible Director receipts every turn | They waste tokens, get echoed, and clutter the page. Keep planning hidden or in a closed drawer |
