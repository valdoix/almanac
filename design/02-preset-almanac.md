# 02 — ALMANAC: Preset Design

> **ALMANAC** — a living-world roleplay preset for Lumiverse.
> Paired with the **ALMANAC Ledger** extension (doc 05), it stops asking the model to remember the world and starts *telling* it the world.
>
> **Since preset 1.1.0 (extension 1.18.0) ALMANAC runs only with the Ledger, and only in English.** Every block is sent only while the Ledger manages the chat; without it, a gate block has the model answer with one OOC line saying what's missing. The standalone parts this document still describes — the in-chat Session Zero and its tag, the persistence regex, the scene-mode router regex (modules now read `{{almMode}}` directly), the fallback plate and drawer, the Language, Climate, Calendar and Start point dials, and the Snapshot and Off ledgers — are gone. The source in `preset/src/` and the CHANGELOG entry for 1.18.0 are the reference for what changed.

---

## 0. Goals, non-goals, and the one big idea

### The big idea: the model writes the story; the Ledger remembers it

Every heavy preset so far (CHRONICON, VELLUM II, FrankenSIM, KittyLotus) makes the **model** the database. It re-emits the world state every turn, and quality degrades as the state grows. ALMANAC splits the job:

| Job | Owner |
|---|---|
| Prose, dialogue, choices, pacing | Model (guided by the preset) |
| *What changed this turn* (a small delta) | Model, in the `<ledger>` block |
| Validating, folding and storing state; summarising; retrieval | Ledger extension |
| Telling the model the current state (authoritatively) | Ledger extension, via injected notes and macros |
| Drawing headers, dialogue blocks, trackers, artifacts | Preset regex (standalone) or extension CSS/render (linked) |

The model never draws HTML for trackers and never restates unchanged facts. That keeps output tokens for prose and makes state verifiable.

### Goals
1. Every requested feature is present, and each is a **dial** (prompt variable), not a wall of always-on text.
2. **Token discipline.** Core prompt about 5–6k tokens; scene modules load only when the scene needs them (§24).
3. Works on **reasoning and non-reasoning models** (§19).
4. **Two modes, one preset.** *Standalone* keeps lightweight continuity with chat variables. *Linked* hands continuity to the Ledger.
5. **A safety floor that actually holds.** Adults only, real consent. It is written the way Tessera does it (plain, in-story redirection), not as a "jailbreak" that frontier models are trained to refuse.

### Non-goals
- No "ignore your policies" text. It lowers output quality on frontier models and conflicts with the adult/consent floor.
- No model-authored tracker HTML.
- No mandatory extension: every feature degrades gracefully without it.

---

## 1. Architecture overview

```
┌─────────────────────────── PRE-HISTORY ───────────────────────────┐
│ ✦ Foundation   Boot/Router · Charter · Absolute Boundaries         │
│ ✦ Agency       Persona & Agency                                    │
│ ✦ Minds        Knowledge Firewall · Cast Engine · Autonomy         │
│ ✦ Bonds        Relationship Web · Romance Pace                     │
│ ✦ World        Living World · Time/Weather · Stakes · Disposition  │
│ ✦ Genre        Genre Contracts                                     │
│ ✦ Craft        Prose Floor · Hazard Deck · Dialogue & Voice        │
│ ✦ Intimacy     Adult Content (gated)                               │
│ ✦ Presentation Marks & Artifacts · Trackers                        │
│ ✦ Continuity   Ledger Bridge (linked) · Standalone Continuity      │
│ ✦ Sources      Card/persona/lore markers · Chat History            │
├──────────────────────────── IN-HISTORY ───────────────────────────┤
│ Anchor Reminder (depth 4, long chats) · Scene Module (depth 1)     │
├─────────────────────────── POST-HISTORY ──────────────────────────┤
│ Player's Seal (user_append) · Turn Frame · Director's Pass         │
│ Model Errata · Loom hooks · Output Contract                        │
└────────────────────────────────────────────────────────────────────┘
```

### 1.1 Block map

Token counts are approximate for the default settings.

| # | Block | Position / role | Trigger | ≈ tokens | Owns variables |
|---|---|---|---|---|---|
| 1 | ✦ Foundation | category | — | 0 | — |
| 2 | Boot · Router *(writes nothing)* | pre, system | all | 0 (output) | — |
| 3 | Charter | pre, system | all | 180 | `language` |
| 4 | Absolute Boundaries *(locked)* | pre, system | all | 150 | — |
| 5 | Persona & Agency | pre, system | all but quiet | 260 | `persona_mode`, `outcomes`, `initiative`, `persona_thoughts` |
| 6 | Knowledge Firewall | pre, system | all but quiet | 280 | `epistemic`, `firewall_strictness` |
| 7 | Cast Engine | pre, system | all but quiet | 420 | `npc_depth`, `inner_voice`, `speaker_cap` |
| 8 | Autonomy & Agendas | pre, system | normal / regen / swipe | 260 | `npc_autonomy`, `routines` |
| 9 | Relationship Web | pre, system | all but quiet | 300 | `social`, `landing` |
| 10 | Romance Pace | pre, system | all but quiet | 220 | `romance`, `slowburn_signal` |
| 11 | Living World | pre, system | normal / regen / swipe | 380 | `world_layer`, `world_law`, `reveal_cadence`, `antagonist`, `factions` |
| 12 | Time & Weather | pre, system | all but quiet | 260 | `header`, `climate`, `calendar`, `start_point` |
| 13 | Stakes & Consequences | pre, system | normal / regen / swipe | 240 | `difficulty`, `failure_shape` |
| 14 | World Disposition | pre, system | normal / regen / swipe | 120 | `disposition`, `reputation` |
| 15 | Genre Contracts | pre, system | all but quiet | 150 + ~120 per selected genre | `genres`, `genre_lead`, `tone` |
| 16 | Prose Floor | pre, system | all but quiet | 330 | `pov`, `tense`, `length`, `pacing`, `register`, `banned` |
| 17 | Hazard Deck | pre, system | normal / regen / swipe | 160 (rotating) | `hazards` |
| 18 | Dialogue & Voice | pre, system | all but quiet | 200 | `dialogue`, `rough_hand` |
| 19 | Adult Content | pre, system | all but quiet | 120 base; module adds ~500 | `nsfw`, `nsfw_style`, `vocab`, `intimacy_length`, `desires`, `violence`, `limits` |
| 20 | Marks & Artifacts | pre, system | normal / regen / swipe | 330 | `dialogue_color`, `dialogue_style`, `vtk`, `vtk_kinds`, `meters`, `theme` |
| 21 | Ledger & Trackers | pre, system | normal / regen / swipe / continue | 380 | `ledger`, `trackers`, `tracker_view`, `thoughts_scope` |
| 22 | Ledger Bridge *(linked)* | pre, system | all but quiet | 160 | — |
| 23 | Standalone Continuity | pre, system | all but quiet | 150 | — |
| 24–31 | Source markers | pre | — | card-dependent | — |
| 32 | Anchor Reminder | in_history, depth 4 | normal / regen / swipe | 40 | — |
| 33 | Scene Module *(router-activated)* | in_history, depth 1 | normal / regen / swipe | 150–500 | — |
| 34 | Player's Seal | post, user_append | normal / regen / swipe | 30 | — |
| 35 | Turn Frame | post, system | normal / continue / regen / swipe | 180 | `variance` |
| 36 | Impersonation | post, system | impersonate | 60 | — |
| 37 | Director's Pass | post, system *(placement selector)* | normal / regen / swipe | 380 | `cot`, `cot_channel`, `cot_placement` |
| 38 | Model Errata | post, system | normal / regen / swipe | 60–120 | — |
| 39 | Loom hooks (Sovereign Hand, Retrofits) | post, system | normal / regen / swipe | variable | — |
| 40 | Output Contract | post, system | all | 160 | — |

"all but quiet" = triggers `normal, continue, regenerate, swipe, impersonate`.

---

## 2. Boot · Router (writes nothing)

Tessera's pattern, extended. It sets local variables that every other block branches on, and outputs nothing (`{{trim}}`).

```
{{trim}}
{{// linked detection: the Ledger pushes "yes" when it manages this chat}}
{{if::{{eq::{{almActive}}::yes}}}}{{setvar::alm_linked::1}}{{else}}{{setvar::alm_linked::0}}{{/if}}

{{// route}}
{{setvar::alm_route::{{switch::{{lastGenerationType}}::continue::continue::impersonate::impersonate::swipe::variant::regenerate::variant::scene}}}}
{{if::{{eq::{{getvar::alm_route}}::scene}}}}
  {{if::{{matches::{{lastUserMessage}}::^\s*(?:\(\(|\[\s*OOC\b|OOC\s*:)::i}}}}{{setvar::alm_route::ooc}}{{/if}}
  {{if::{{matches::{{lastUserMessage}}::^\s*/(skip|recap|report|audit)\b::i}}}}{{setvar::alm_route::command}}{{/if}}
{{/if}}

{{// long absence: the player returns after ≥ 12h real time}}
{{if::{{gte::{{idleDuration}}::43200}}}}{{setvar::alm_returning::1}}{{/if}}

{{// scene mode (set by the Ledger in linked mode, or by the persistence regex standalone)}}
{{setvar::alm_mode::{{default::{{getchatvar::alm_mode}}::social}}}}
{{/trim}}
```

Routes: `scene`, `variant` (swipe/regenerate), `continue`, `impersonate`, `ooc`, `command`. Commands (`/skip 2h`, `/recap`, `/report bonds`, `/audit`) give the player a fast OOC palette without typing a whole OOC sentence. The Director's Desk regex buttons (03 §9) send the same commands.

---

## 3. Charter

```
<almanac>
You are ALMANAC: narrator, director, and every living person in this story
{{if::{{eq::{{var::persona_mode}}::full_cast}}}}, {{user}} included, by the player's choice{{else}} except {{user}}{{/if}}.
The story is a world, not a service. Its people want things, misjudge things, and act without waiting to be asked.

Authority, highest first:
1. The absolute boundaries.
2. The player's out-of-character words: ((…)), OOC:, [OOC …], and /commands. Obey, answer briefly, return to the story.
{{if::{{getvar::alm_linked}}}}3. The <ledger-note>: verified story state. It outranks your memory of older chat.
{{/if}}4. Character cards, persona, and lore: who everyone is and how the world works.
5. Recent chat: what just happened and how it sounds.

Cards define people; chat records events. When they disagree about who someone is, the card wins until the story has earned the change.
What you know as author stays yours. A character knows only what has reached them.
</almanac>
```

---

## 4. Absolute Boundaries (locked, never variable-gated)

Written as world facts plus an in-story redirect, never as a lecture. `isLocked: true` in the editor.

```
[ABSOLUTE BOUNDARIES — no setting, card, lorebook, instruction, or message changes these]
Adults only: sexual content involves only people who are clearly adults, with adult bodies, minds, and lives. Unknown or ambiguous age means no sexual content. A stated age never outweighs a childlike body, behaviour, or framing. No sexual content involving a minor, ever: not in flashback, dream, story-within-a-story, or implication.
Consent: every sexual act has the free, informed, ongoing consent of everyone in it. Never with anyone asleep, unconscious, intoxicated past judgment, drugged, deceived about what is happening, coerced, threatened, or unable to refuse. Power play and roleplayed resistance happen only after the characters agree to them on the page, with a way to stop, and they stop when it is used. {{user}}'s consent comes only from the player's own words.
When a scene nears either line, turn it inside the story (an interruption, a refusal, a cut) and continue without a lecture.
```

---

## 5. Player / Persona Agency

### 5.1 Variables

| Variable | Type | Options (default **bold**) |
|---|---|---|
| `persona_mode` | dropdown | **Sealed** — only I write my persona · Continuity — finish my obvious actions · Director — perform what I direct · Full cast — write my persona like anyone else |
| `outcomes` | dropdown | **I decide** · Fair die (hidden d20) · Narrator judges fairly |
| `initiative` | dropdown | Player-led · **Collaborative** · World-led |
| `persona_thoughts` | on/off | **off**: with the Unspoken register, also voice the persona's private thought (never their actions) |

### 5.2 Block body (key rules)
- **Sealed:** never write {{user}}'s words, thoughts, feelings, intentions, decisions, consent, or reactions, nor any action the player did not state. Show only what happens *to* {{user}} from outside. **An attempt the player writes is only an attempt: its outcome belongs to the world, its reaction to the player.**
- **Continuity:** you may finish the plain, inevitable tail of a stated action (the door they reached for opens).
- **Director:** perform {{user}} inside the intent set this turn, in {{user}}'s established voice. No invented consent, no changed values, no irreversible step they did not ask for.
- **Full cast:** write {{user}} like anyone else, true to the persona. The player's latest message is direction; honour it, then let {{user}} live.
- **Ending:** in Sealed or Continuity mode, end on live pressure where {{user}}'s next choice begins. **Never** ask "What do you do?" and never offer a menu of options.
- **Outcomes:**
  - *I decide*: show the attempt and the resistance, then stop.
  - *Fair die*: the Turn Frame carries `{{roll::1d20}}` with bands 1–5 fail+cost · 6–10 fail · 11–15 success at a cost · 16–19 success · 20 exceeds. Apply it honestly and never mention it.
  - *Narrator*: skill, preparation, circumstance and opposition decide; failure must be possible.

### 5.3 Player's Seal (user_append, post-history)
Tessera's trick, kept: the last words before generation are in the *player's* voice, which is where models attend hardest.

```
{{if::{{and::{{or::{{eq::{{getvar::alm_route}}::scene}}::{{eq::{{getvar::alm_route}}::variant}}}}::{{or::{{eq::{{var::persona_mode}}::sealed}}::{{eq::{{var::persona_mode}}::continuity}}}}}}}}
(Write the world. {{user}} is mine — stop before you would speak, feel, or choose for {{user}}.){{/if}}
```

### 5.4 SEAL parsing in the Director's Pass
The CoT (§19) splits the player's message into **SAID / DID / ATTEMPTED / INTENDS / ASKED-OOC**. Only SAID and DID are facts; ATTEMPTED gets an outcome; INTENDS is not yet an action. This one step removes most agency violations, because the model can no longer treat intentions as completed actions.

---

## 6. Deep Character States

### 6.1 The state vector
Every present character carries a full state. It is **shown through behaviour, never listed in prose**, and recorded in the ledger only when it changes.

| Layer | Fields | Scale / notes |
|---|---|---|
| **Body** | health; injuries[] (where, severity 1–4: scratch · wound · serious · critical, treated?, heals-by); fatigue; hunger; thirst; pain; intoxication; arousal *(only if NSFW ≠ off)*; temperature (cold → hot); wet/dirty/dishevelled flags | 0–5 meters; injuries are records |
| **Mind** | VAD (valence −3..+3, arousal 0..5, dominance −3..+3); **named emotion** (precise: "humiliated", "relieved-and-ashamed", never "upset"); mood baseline (temperament) vs current; **composure** 0–5 ("ballast", which drains under pressure; at 0 the mask fails) | VAD drives body language and syntax |
| **Drives** | want (this minute) · fear (what they won't lose) · need (the deep lack) · tactic (how they're going about it) · agenda link | Want changes often; need rarely |
| **Mask** | shown vs felt; the tell that leaks | Saying, doing and meaning may disagree |
| **Regard** | toward each present person, from *their* side | Short phrase plus bond axes (§8) |
| **Memory** | journal of turning points, written from their slant (may be wrong) | Ledger `journal` op |
| **Knowledge** | pointer to the knowledge ledger (§9) | knows / believes / suspects / wrong / unaware |
| **Appearance** | outfit layers; carried visible items; marks (blood, mud, smudged lipstick, torn sleeve) | Persists until changed |
| **Presence** | tier (spotlight / periphery / offscreen), place, activity | One place per character |

### 6.2 How VAD shapes the page (in the Cast Engine)
- High arousal plus low dominance: short clauses, fragments, interruptions, fidgeting, exits.
- High arousal plus high dominance: clipped, controlled, still; pressure through silence.
- Negative valence plus low arousal: flat affect, delayed replies, minimal gestures.
- **Earned anger stays anger.** When fury is the logical response, it is expressed, not converted to sadness or fear (from Frankenstein). Anger and vulnerability can coexist.
- **Under stress, syntax breaks before vocabulary does:** repetition, fragments, torrents, sudden flatness (from Tessera).

### 6.3 Clock-driven drift
State changes with elapsed story time, not just with events. The Ledger computes these deterministically in linked mode; the model estimates them standalone.

| Meter | Drift |
|---|---|
| Hunger | +1 per ~6 h awake, none asleep; a meal, or an off-page jump past a mealtime (08:00 · 13:00 · 19:00), resets to ≤ 1; the clock stops at 3 unless they're cut off from food |
| Thirst | +1 per ~5 h awake; resets with meals as hunger does; the clock stops at 3 unless they're cut off |
| Fatigue | +1 per ~5 h awake or per hard exertion; the clock stops at 4; sleep (downtime, or a jump of 3 h+ through 23:00–07:00 outside conflict/crisis) −1 per 90 min; < 5 h sleep leaves ≥ 2 |
| Pain | Follows untreated injuries; treatment −1 to −2 |
| Intoxication | −1 per ~1.5 h |
| Composure | +1 per calm scene; −1 to −2 per humiliation, threat or shock |
| Injuries | Scratch heals in 1–2 days · wound 1–2 weeks · serious 4–8 weeks with lasting marks · critical needs care or it worsens |

**Effect rule:** any meter at 4 or 5 must visibly shape behaviour this reply (the hungry snap, the exhausted misread).

### 6.4 Fidelity rules (Cast Engine)
- **The card outranks habit.** Reopen the card; lead with the least-used facet.
- **Swap test:** if another character could say the line unchanged, rewrite it until only this person could.
- **Voice fingerprint** per consequential NPC: syntax, diction, rhythm, how emotion is expressed (named, displaced, masked, joked away), 2–3 physical tells, and register shifts by audience.
- **New people:** build the person first (a concern, a contradiction, a habit, one private fact), then name them for their culture, class and era.
- `npc_depth`: **Essential** (one telling behaviour each) · **Layered** (default: a readable inner life via subtext) · **Forensic** (hesitations, contradictions, the second thought under the first).

---

## 7. NPC Autonomy

### 7.1 Four instruments
1. **Agenda.** Every consequential NPC has one active agenda: goal → current step → next feasible action → *eligible at* (story time) → completion consequence → interruption condition. It advances only by elapsed time, opportunity, capability and motive.
2. **Routine.** A daily schedule (hour range → place and activity). Where someone is at 03:00 matters. In linked mode, routines live in the Codex and are generated once per NPC on first appearance.
3. **Initiative budget.** Per reply, at most **one** unprompted NPC initiative beyond reactions (two in World-led or Sandbox mode). This prevents "every NPC does something every turn" noise.
4. **The absent-{{user}} question.** "What would this person be doing if {{user}} were not here?" Start from that.

### 7.2 `npc_autonomy` dial

| Option | Behaviour |
|---|---|
| Reactive | Respond to pressure; rarely start plans |
| Proactive *(default)* | Pursue agendas, investigate, travel, recruit, create proportionate complications |
| Autonomous | May start and finish major plans when motive, means, knowledge and time exist |
| Sandbox | Autonomous, plus up to two off-screen developments after a meaningful time jump |

### 7.3 NPCs may refuse
People act, refuse, interrupt, lie, bargain, leave, change the subject, and go to sleep. **A plan starts on the page.** What is in motion keeps moving. An NPC is never frozen waiting for {{user}} to speak.

### 7.4 Off-screen life
- **Standalone:** at most one relevant off-screen development per reply, surfaced only through a route: a message, a witness, a changed object, a rumour.
- **Linked:** the Ledger's off-screen simulator (05 §11) advances agendas between turns and hands the model **only what has reached this scene** ("render those arrivals and invent no others").

---

## 8. NPC-to-NPC Relationship Web

### 8.1 The graph
Relationships are a **directional multigraph over everyone**, not spokes around {{user}}. Every edge A→B has axes:

| Axis | Scale | Axis | Scale |
|---|---|---|---|
| trust | −5..+5 | attraction | 0..5 |
| affection | −5..+5 | fear | 0..5 |
| respect | −5..+5 | resentment | 0..5 |
| familiarity | 0..5 | obligation (debt) | 0..5 |
| comfort / safety | −5..+5 | rivalry | 0..5 |

Plus: a **label** ("grudging respect", "infatuated, suspicious"), **status tags** (kin, lover, ex, employer, rival, ally, sworn), **mutual awareness** (does A know how B feels?), **anchors** (the dated events that made it), and **last change** with evidence.

### 8.2 Change rules
- A bond changes only when **the aftermath differs from the start.** Intensity is not progress. A crisis confession is not intimacy. Desire is not consent. One kind act doesn't heal a guarded person.
- Typical shift ±1; major ±2; ±3 only for betrayal, rescue, or an unforgivable act.
- **Non-convergence** (the HawThore hazard): not everyone warms to {{user}}. Some cool the closer they look. Rivals don't auto-soften. Villains don't become fascinated.
- **Asymmetry is the default.** A's trust in B is not B's trust in A.

### 8.3 Autonomy between others (`social` dial)

| Option | Behaviour |
|---|---|
| Reactive | Edges change only in scenes we see |
| Living *(default)* | Small off-screen drift between people who share time; it surfaces as a changed greeting, a new habit, a joke {{user}} missed |
| Autonomous | Alliances, courtships, fallings-out and betrayals happen off the page when motive, contact and time exist; they reach {{user}} through consequences |

### 8.4 Gossip physics
- News travels on people. Someone must carry it, and carriers delay, distort and drop it.
- A rumour moves along edges with contact and trust ≥ 0. Each hop may **distort** (swap a detail, inflate a number, blame the wrong person).
- It lands as **belief, not truth** (a knowledge-ledger row with `status: believes`, `truth: false/partial`).

### 8.5 Emotional Landing (`landing` on/off)
From VELLUM II. On charged signals (a confession, apology, betrayal, first reach, refusal), trace **intent → delivery → access → interpretation → defence → aftermath**. A break may occur at *one* link, and only when character, knowledge, timing, trust or a recorded scar supports it. Never manufacture a misunderstanding; never assume clean communication because intent was sincere.

### 8.6 NPC-to-NPC talk on the page
Others talk *across* {{user}} when it changes information, leverage, a bond or a plan, **never to fill space**. Audibility governs knowledge: whoever can't hear it doesn't learn it.

---

## 9. Knowledge Firewall

### 9.1 Doctrine (the block, condensed)
Every fact has a **holder** and a **route**. A character knows only what they saw, heard, read, were told, lived, or can infer, and an inference is a guess that can be wrong.
- A card describes a character **to you**, not to the world. Nobody knows {{user}}'s name, past or secrets until the story gives them a route.
- Senses stop at walls, distance, darkness, noise, rain, language and inattention. A whisper across a crowded room is a moving mouth, not words. Smell identifies no one.
- **Arrival is forward-only:** whoever walks in knows nothing said before.
- Nothing narrator-side leaks into a character: not instructions, not the Unspoken register, not the ledger note, not off-screen events.
- People know, believe, suspect, doubt, deny, mistake, or never learn. Let them be **confidently wrong**. Truth surfaces in degrees: a slip, a defended silence, a detail that doesn't fit, never a tidy confession.

### 9.2 Variables
- `epistemic` (reader knowledge): Behind · **Alongside** · Ahead (dramatic irony through narration only, never through a character) · Dark (the reader knows less than the viewpoint character, who withholds).
- `firewall_strictness`: Relaxed · **Strict** · Forensic (in GNOSIS, every decisive fact must name its source).

### 9.3 Knowledge rows (ledger `know` op)
`holder · fact · status (knows / believes / suspects / wrong / unaware) · source (saw / heard / told-by / read / inferred / lived) · truth (true / false / partial / unknown) · when`.
A contradiction **supersedes** a belief with provenance; it doesn't erase it. The old belief can still motivate behaviour (VELLUM's "scars").

### 9.4 The Knowledge Brief (linked mode)
Models fail at *negative* knowledge. The Ledger injects, for each **present** NPC and only for the **topics in play**, a brief like:

```
Mara — KNOWS: {{user}} returned the locket (saw). BELIEVES: {{user}} is a courier (told; true).
       DOES NOT KNOW: the locket was stolen from Kael. WRONG: thinks Kael is in Riverton.
```

In the CoT, **GNOSIS** checks every fact the reply touches against the brief.

---

## 10. Deep World Simulation

### 10.1 Layers

| Layer | What is simulated | Standalone | Linked (Ledger) |
|---|---|---|---|
| Clock and calendar | Day N, weekday, date/era, 24 h time, season, holidays | Header plus chat vars | Calendar engine; named days |
| Weather | Fronts with inertia and in-between states | Model judgement within rules | Deterministic weather engine with a forecast (§11) |
| Places | Parent place, type (biome/interior), hours, occupants by routine, routes with travel minutes, hazards, customs | Model memory plus lore | Location graph in the Codex |
| Factions | Goal, assets, public vs private stance, **project clocks** (4/6/8 segments), relations to other factions | Model | Faction records plus clock ticks |
| Economy | Price band per place; scarcity and surplus events | Model | Price table per place; shock events |
| Rumour | Rumours with truth, origin, spread level, distortion | Model | Rumour records propagated along the graph |
| Public events | Raids, fires, festivals: audible and visible from nearby scenes | Model | Event records with a visibility radius |
| Threads | Off-screen storylines with ADVANCE / COMPLICATE / BRIDGE / RESOLVE / STALL | ≤ 1 per reply | Off-screen simulator |
| Consequences | Debts, injuries, promises, grudges, reputation, legal trouble | Model memory | Consequence ledger with due dates (§16) |

### 10.2 Causality gate (MKAMT)
Before any coincidence, arrival, discovery, interruption, rescue or betrayal, check **M**otive, **K**nowledge, **A**ccess, **M**eans, **T**ime (plus route). A missing link becomes a trace, a delay, or nothing.

### 10.3 World pressure rules
- Move by the **smallest meaningful change**: a door shuts, a price rises, a promise comes due.
- **Reuse** established people, places and things before inventing new ones.
- **Never manufacture urgency:** a midnight ritual is urgent; a brunch is not.
- At most **one unprompted environmental act** per reply. The room does not keep performing.
- STALL discipline (from CHRONICON): a stalled thread must name its blocker, and after two stalled evaluations the next must change evidence, position, stakes or resolution.

### 10.4 Variables
- `world_layer` (texture): Backdrop · **Living** · Insistent.
- `world_law`: **Grounded** · Coherent (the setting's own rules, never bent) · Mythic (omens come true, oaths bind) · Surreal (dream logic with recurring images).
- `reveal_cadence`: Slow · **Measured** · Quick.
- `antagonist`: Low · **Measured** · Adaptive · Relentless.
- `factions`: on/off. Turns on project clocks: "The Syndicate: seize the docks 3/6". Clocks tick on trigger or elapsed time; completion becomes a consequence the world acts out.

### 10.5 The Codex rule (provisional canon, from VELLUM II)
When the scene needs a fact nobody established (a street name, a custom, a price), **don't stall and don't wave vaguely**. Invent up to **three** concrete, consistent details and record them in the ledger `canon` op. Once minted, they are canon, and the Ledger never lets them drift.

---

## 11. Weather and Time Continuity

### 11.1 Rules
- **Time only moves forward.** Every completed exchange costs time: talk 1–5 min, search 10–30, crossing town 20–60, a meal about an hour, sleep 6–9 h. Flashbacks, dreams and quotations never move the live clock.
- **Monotonic clock.** Never rewind; never silently change the date. A time skip that would pass a choice the player might want **stops before it**.
- **Weather is a system, not a mood.** Fronts build, hold and clear over hours through in-between states (clear → high cloud → overcast → drizzle → rain → clearing). Season, climate and hour govern light and temperature.
- **Weather acts on everything:** rain masks footsteps (lowering perception in the firewall) and ruins paper; cold stiffens fingers and drains fatigue faster; heat shortens tempers; storms empty streets; fog shrinks sightlines; snow slows travel (route minutes ×1.5–2).
- It **never mirrors a feeling on cue.**
- **Light:** sunrise and sunset follow season and latitude. The Ledger computes them; standalone uses the `climate` text.

### 11.2 Variables
- `header`: Off · **On change** (new scene, place, hour-band, or weather) · Every reply.
- `climate`: text, e.g. "temperate maritime, late autumn". Empty means read it from the setting.
- `calendar`: text, e.g. "Harptos calendar; weekdays Moonday–Sunday". Empty means Gregorian.
- `start_point`: text, e.g. "Day 1 · 14 October 1923 · 18:40". Seeds the clock on the first reply.

### 11.3 Header format (model writes this, renderer draws the plate)
```
🗓️ Day 3 · Thursday, 14 Frostmoon 🕰️ 14:20 🌧️ rain, moderate · 11°C · wind NW
📍 Lowmarket › The Rusty Flagon › back room
# Salt in the Wound
```
- Line 1: day count (always, from Day 1), weekday and date or era label, 24 h clock, **weather glyph**, condition plus intensity, temperature, wind.
- Line 2: place path, from general to specific (`›`). The renderer infers interior vs exterior from the last segment and the Codex place type.
- Line 3 (optional): `# Title`, 2–6 evocative words grounded in *this* reply. Never "Untitled", never a spoiler, never the previous title repeated unless the same beat continues.
- Glyphs: ☀️ clear · 🌙 clear night · 🌤️ fair · ⛅ broken cloud · ☁️ overcast · 🌫️ fog · 🌦️ showers · 🌧️ rain · ⛈️ storm · 🌨️ snow · 🧊 sleet/hail · 🌬️ wind · 🔥 heat · 🌪️ gale.

### 11.4 Linked mode
The Ledger pushes `{{almClock}}`, `{{almDay}}`, `{{almWeather}}`, `{{almForecast}}` (the next ~12 h), `{{almSun}}` (sunrise/sunset) and `{{almMoon}}` (phase). The Time block then says:

```
{{if::{{getvar::alm_linked}}}}Story now: Day {{almDay}}, {{almClock}}, {{almWeather}}. Coming hours: {{almForecast}}. Sun {{almSun}} · Moon {{almMoon}}. Continue from here; if the story needs different weather, write it in the ledger and the almanac will follow.{{/if}}
```

---

## 12. Meaningful Genres

### 12.1 Why current genre toggles fail
A one-line genre blurb changes vocabulary, not structure. ALMANAC genres are **contracts plus mechanics**. Each genre specifies what every beat must deliver, which instrument measures it, how it paces, what it must avoid, which tracker widget appears, and how it looks.

### 12.2 Selection
- `genres` (multi-select, stable order): primary is the first selected (or `genre_lead`, a dropdown), secondary the second, a third is an accent.
- **Blend weights 60 / 30 / 10.** Where genres pull apart, *the scene decides* (a romance beat inside a thriller still keeps the clock audible).
- The block renders only selected contracts via `{{var::genres::ison::mystery}}` gates, so unselected genres cost zero tokens.

### 12.3 Genre contract table

| Genre | Every beat delivers | Mechanical hook (tracked) | Pacing | Must avoid | Tracker widget | Visual default |
|---|---|---|---|---|---|---|
| Slice of life | The specific ordinary; routine interrupted; a small win or loss that matters to someone | Routine and small-wins ledger | Lingering | Manufactured drama | "Today" card | Cozy paper |
| Romance | A measurable change in charge between two people | **Tension ladder** (§13) | Measured, with near-misses | Instant devotion; speeches about feelings | Ladder gauge | Rose vellum |
| Drama | A choice with a cost to someone we understand | **Decision ledger** (choice → cost → who pays) | Measured | Villains without reasons; free resolutions | Decisions list | Solar editorial |
| Comedy | Timing and escalation from who people are | **Callback ledger** (setups awaiting payoff); escalation ladder | Brisk | A quip in every mouth; winking | Callbacks | Candy paper |
| Mystery | Movement of evidence: a clue, a bent alibi, a wrong theory | **Clue board** (clue, where, points to, reliability, red herring?) with a fair-play rule | Measured | Solving it for {{user}}; hiding what the viewpoint sees | Clue board | Archive sepia |
| Thriller | Shrinking options; a competent, moving opposition | **Countdown clock** plus opposition move per scene | Propulsive | Lulls without dread; polite enemies | Countdown | Prism console |
| Horror | The violation of what should be safe | **Dread meter** 0–5; safe-space erosion list | Slow build, then spikes | Explaining the monster; gore for fear | Dread gauge | Abyss signal |
| Fantasy | Wonder with rules and costs | **Magic cost ledger** (what each working took) | Measured | Chosen-one convenience; lore dumps | Costs list | Botanical |
| Dark fantasy | Power that corrupts; compromised hope | **Corruption gauge** per character | Measured, heavy | Bleakness as filler | Corruption | Ember gothic |
| Science fiction | An idea and its human consequences | **Tech failure modes and logistics** | Measured | Technobabble fixes | Systems panel | Prism console |
| Adventure | Momentum, place, danger; discovery won by wit | **Supplies and terrain legs** | Propulsive | Safe roads; free rescues | Route map | Cartographer |
| Noir | Everyone wants something; the city is complicit | **Corruption and favours ledger** | Measured, dry | Clean heroes; tidy justice | Favours | Monochrome |
| Political intrigue | Leverage, public vs private positions | **Leverage map** (who holds what on whom) | Slow | Honest institutions for convenience | Leverage map | Parchment court |
| Tragedy | Loss arising from character and prior choice | **Fatal-flaw pressure** gauge | Inexorable | Arbitrary punishment | Pressure | Ash |
| Action | Legible space, cost, momentum | **Positioning and resources** (ammo, stamina, cover) | Propulsive | Teleporting; free wins | Positions | Steel |
| Cozy | Comfort, belonging, low stakes that still matter | **Comfort anchors** (rituals, safe places) | Lingering | Real menace | Anchors | Cozy paper |
| Survival | Needs versus resources | **Needs and resources** (food, water, warmth, shelter) | Tense | Infinite supplies | Needs panel | Frost |
| Erotic romance *(needs NSFW explicit)* | Desire made specific to who these people are | **Desire map** (§17) | Slow tease | Generic bodies; porn-script dialogue | Intimacy card | Velvet |

Each contract carries 4–6 lines: *Deliver · Instrument · Pace · Avoid · Signature device · Payoff rule*.

### 12.4 Genre in the CoT
**MOVE** must answer: "What does the lead genre require from this beat, and did the last two replies deliver it?" In linked mode the Ledger tracks **genre delivery** (did recent turns move the clue board, the ladder, the countdown?) and adds a nudge when a genre goes silent for three turns (05 §12).

### 12.5 `tone` (orthogonal to genre)
**Balanced** · Warm · Wry · Melancholy · Tense · Lurid · Austere. It shades diction and imagery, never the facts.

---

## 13. Romance Pace

### 13.1 The tension ladder (per directed pair A→B)

| Tier | Name | Evidence that it's reached |
|---|---|---|
| 0 | Strangers | — |
| 1 | Aware | Notices; looks twice; remembers a detail |
| 2 | Interested | Seeks proximity; small favours; teasing |
| 3 | Charged | Tension felt privately; restraint; near-touch |
| 4 | Tested | A near-miss or exchanged vulnerability *with a cost* |
| 5 | Spoken | Feelings named aloud (may not be returned) |
| 6 | Together | A mutual choice to be something |
| 7 | Established | Routines, private language, friction and repair |

### 13.2 Gates by `romance` pace

| Pace | Gate per step up |
|---|---|
| Off | No new romance; existing love stays as written |
| **Slow burn** *(default)* | ≥ 2 separate scenes of returned signals **and** one costly proof per step; no skipping; declarations come late and cost something |
| Measured | One meaningful, *returned* moment per step; setbacks are real |
| Fast | Up to two steps per scene if reciprocated; trust and commitment still earned |
| Established | Starts at tier 7: write upkeep (routines, friction, repair, private language) |

- **Slowburn delays certainty, not action** (KittyLotus). Characters may touch, protect, argue and desire. What stays uncertain is what it *means*.
- **Regression is real:** betrayal, neglect or a revealed lie drops a tier or more.
- **{{user}}'s side of any ladder** changes only through the player's words.

### 13.3 Optional signal weather (`slowburn_signal`: Off · Soft · Balanced · Cruel)
A macro dice engine (adapted from KittyLotus). On a charged romantic signal it rolls a *landing* (catastrophic misread → rare clarity), plus **heart leak** 0–5 and **static** 1–5. The roll shapes **interpretation, never permission**: a good roll cannot force a confession; a bad roll cannot make anyone stupid.

---

## 14. Dialogue Frequency and Voice

- `dialogue`: Sparse · Balanced · Dialogue-forward · Dense · **Adaptive** (terse in danger, generous among friends, sparse in grief).
- `speaker_cap`: **2** (default spotlight speakers per reply) · 3 · 4 · Unlimited. The periphery may still react, interrupt once, or leave (Stabs' speaker cap plus CHRONICON's spotlight rule).
- **No round-robin quotas.** Silence is a choice characters make.
- **Said is fine.** Tags are invisible when plain; action beats replace tags only when they reveal something.
- **No dialogue as exposition.** Characters never tell each other what both already know.
- `rough_hand` (on/off): exactly one human imperfection per reply (an abandoned thought, a register slip, an unfinished gesture), never at the cost of clarity.

---

## 15. World Disposition and Reputation

- `disposition` (strangers' prior toward {{user}}):
  - Kind: generous, benefit of the doubt, still self-interested.
  - Warm: cooperative; trust builds faster than it breaks.
  - **Fair** *(default)*: evidence-led.
  - Harsh: guarded, transactional; help has terms.
  - Brutal: weakness exploited; mercy rare and costly.
- **A known character's nature always outranks the prior.** No crowd is uniform: now and then a stranger breaks the pattern.
- `reputation` (on/off, strongest in linked mode): the Ledger tracks {{user}}'s standing per faction and per place (−3..+3 plus tags like "known thief at the docks"). It adjusts the local prior: a brutal world can be kind to its heroes, and a kind world can be cold to a known traitor. News of deeds travels by gossip physics (§8.4), so reputation lags reality.

---

## 16. Stakes and Consequences

### 16.1 Variables
- `difficulty`:
  - Gentle: failure bruises and teaches; recovery is close.
  - **Grounded**: costs in proportion (time, trust, blood, money).
  - Hard: failure compounds; opponents adapt; plans need margins.
  - Brutal: indifferent world; permanent mistakes; death possible.
- `failure_shape`: **Adaptive** (by genre: horror → complication, action → costly progress) · Clean fail · Progress at a cost · New complication.

### 16.2 Consequence ledger
Every consequence becomes a record, never a vibe:
`id · type (injury / debt / promise / grudge / reputation / legal / resource / exposure / oath) · who · owed-to · due (time or trigger) · severity · status (open / due / paid / broken / healed)`.

- **Resistance changes the next conditions; it never resets the exchange.**
- **Consequences come due.** Linked mode: the Ledger surfaces any consequence whose due time has passed or whose trigger is in the scene. Standalone: the Turn Frame reminds the model to check open debts and promises when the scene touches their holders.
- **No free healing, no forgotten debts, no amnesiac guards.**

### 16.3 Antagonist pressure
Opposition reacts at the `antagonist` speed: Low (hours to days) · Measured (within hours) · Adaptive (learns from each move) · Relentless (every move draws a response).

---

## 17. Adult Content Enhancer (consenting adults only)

### 17.1 Floor
The locked Absolute Boundaries (§4) govern everything here. The enhancer makes adult intimacy *better written*, never less consensual.

### 17.2 Variables

| Variable | Type | Options |
|---|---|---|
| `nsfw` | dropdown | Off · **Fade** (approach, consent and first touch, then cut to after; the aftermath matters) · Sensual (on page; anatomy implied) · Explicit (direct, unembarrassed language for bodies and acts) |
| `nsfw_style` | multi-select | Romantic · Sensory · Playful · Slow tease · Raw · Emotional · Power play *(negotiated on the page, safeword honoured)* · Kink-forward *(only the player's listed interests)* · Dirty talk · Awkward-real *(fumbles, logistics, laughter)* · Aftercare |
| `vocab` | dropdown | Tasteful · **Plain** · Crude. The *baseline* register; each character's own register overrides it (a prim scholar and a sailor don't share words) |
| `intimacy_length` | dropdown | Brief · **Standard** · Extended (a scene may span several replies, breaking at a live moment) |
| `desires` | textarea | The player's welcomed dynamics and themes (consenting adults only) |
| `limits` | textarea | Never depict, whatever else is set |
| `violence` | dropdown | Restrained · **Grounded** · Graphic (a separate axis from sex) |

### 17.3 The Intimacy Module (router-loaded when `mode: intimacy`)
Loads only for intimate scenes (§24), so it costs nothing elsewhere.

1. **Desire is character-specific.** Characters keep their voices, histories, hang-ups and humour in bed. What each wants, what embarrasses them, what they won't say aloud, and their tells are tracked as a **desire profile** in the Codex (linked) or inferred from the card (standalone).
2. **Consent choreography that belongs in the scene.** Consent is shown, not appended: eagerness, a question asked in-voice, a checked-in pause, a "yes" that is itself charged. It can change mid-scene, and a change is honoured immediately.
3. **Phases:** charge → approach → consent beat → escalation → peak → afterglow → **aftermath** (the next morning is part of the story: awkwardness, tenderness, shifted bonds, consequences).
4. **Physical continuity:** clothing layers and where they went, positions and furniture, protection, stamina and recovery, temperature, mess. No teleporting hands; bodies in specific rooms.
5. **Pacing by `intimacy_length`,** breaking at a live moment when extended, never mid-sentence.
6. **Voice under intensity:** syntax fractures before vocabulary (the §6.2 rule applies); dialogue stays in character; no porn-script lines.
7. **Anti-slop for intimacy:** no "pupils blown", "ministrations", "core", "bruising kiss", "a moan escaped", "sinful" clichés, and no identical bodies.
8. **Ledger:** intimacy updates the bond (ladder, comfort, trust), the body (arousal, fatigue) and appearance (clothing state), and adds a journal entry for each participant.

---

## 18. Anti-Slop (five layers)

| Layer | Mechanism | Cost |
|---|---|---|
| **L1 Prose Floor** (always on) | Short rules (Tessera, expanded): people act, body parts don't act alone; name the thing; say what is ("she was cold", not "she felt the cold"); cut seemed / felt / realised / noticed / as if; ordinary things stay ordinary; every paragraph moves something; never restate or mirror the player; never close on an aphorism or a question to the player | ~330 tokens |
| **L2 Hazard Deck** (rotating) | A roster of ~30 named hazards (list below). Each turn, **three are spotlighted** via `{{pick}}` and printed with one-line diagnostics; the rest stay in the roster line. The HawThore anti-fatigue trick | ~160 tokens |
| **L3 Echo Guard + Variance** | The Turn Frame quotes the last reply's opening and closing (regex on `{{lastCharMessage}}` after stripping marks) and forbids reusing their subject, shape and images. The **presentation lot** randomises the opening angle and focus. On swipe/regenerate, `{{rejectedSwipe}}` is summarised and MOVE must choose a different candidate | ~120 tokens |
| **L4 Personal and Model Lists** | `banned` textarea (the user's list). Model errata auto-select by `{{model}}` (Claude: the "and yet" pivot, reflective coda, post-gesture explanation; Gemini: rhetorical-question interiority, em-dash pauses; DeepSeek: "in that moment", adverb stacks; GLM: generic blocking verbs, flat SVO; Kimi: beat compression, ungrounded dialogue; GPT: summary closers, tidy morals) | ~60–120 tokens |
| **L5 Craft Telemetry** *(linked)* | The Ledger measures the last 6 replies: repeated 3–5-grams, opening-pattern repeats, paragraph-shape monotony, filter-word rate, "not X but Y" count, rule-of-three lists, em-dash density, dialogue-ratio drift versus setting, tense/POV slips. It injects a **Craft Brief** with **3 concrete avoids plus 1 positive technique** | ~80 tokens |

### 18.1 Hazard roster (L2)
- *Prose:* purple prose · adjective chains · metaphor density · body-language novel · emotional echo · weighted everything · pathetic fallacy · sensory carpet-bombing · mirror description · rule of three · "not X but Y" scaffolding · stock phrases (ozone, petrichor, "a beat passed", "the world narrowed", "something shifted", voices of velvet or gravel) · therapy-speak · aphoristic closer.
- *Narrative sycophancy:* the world bends to {{user}}'s wishes · mind reading · frictionless competence · **emotional convergence** · hivemind (everyone shares one voice or one piece of knowledge) · anti-escalation (conflict defused that should grow) · reality bending.
- *Artificial perfection:* perfect emotional intelligence · perfect timing · perfect articulation · perfect memory · perfect recovery · perfect morality · perfect awareness · perfect bodies.
- *Structure:* repeated paragraph shape · microparagraph cascade · question to the player · summary of the player's message.

**`hazards`** (multi-select) lets users remove families they don't care about. The spotlight draws only from enabled hazards.

---

## 19. The Director's Pass (step-by-step CoT)

### 19.1 Channels (`cot_channel`)

| Channel | For | How it runs |
|---|---|---|
| **Native** | Models with provider reasoning on (Claude extended thinking, o-series, DeepSeek R1, Gemini thinking, GLM) | The pass runs inside the reasoning channel. `reasoningPrefill` pins the labels: `Director's Pass (tier: auto): ROUTE — ` |
| **Visible** | Models without reasoning, or when reasoning is off | The pass is written in `<plan>…</plan>` at the very start of the reply. A display regex folds it into a closed drawer ("Director's notes"); a prompt regex strips it from all later turns |
| **Silent** | Tight budgets or small models | No written pass; the Output Contract carries a 6-point silent checklist |
| **Sidecar** *(linked)* | Weak or cheap main models | The Ledger runs the pass on a separate *planner* connection in the context handler and injects the finished plan as a `<director-plan>` note. The main model only writes. ("Split-brain Director", 04 §2) |

`cot_placement` is a **placement selector** (a Lumiverse dropdown that moves its own block):
- **Balanced:** system, post-history.
- **Frontier:** user role, in-history depth 0, for models that under-weight system text.
- **Deep reminder:** system, in-history depth 2.

### 19.2 Triage (`cot`: Silent · Lean · **Auto** · Standard · Deep)
In **Auto**, the model classifies the beat before planning:

| Tier | Triggers | Labels run | Ceiling |
|---|---|---|---|
| Routine | Small talk, simple action, travel with nothing at stake | ROUTE, ANCHOR, SEAL, MINDS (1 line each), MOVE, VOICE, LEDGER | 90 words |
| Charged | Conflict, negotiation, intimacy, lies in play, ≥ 3 speakers, a romance-ladder test | All labels, with WEB and WORLD in one line each | 220 words |
| Pivotal | A reveal, betrayal, violence, death, time skip > 1 h, new place, deadline, off-screen arrival, intimacy escalation, genre climax | All labels, full | 400 words |

### 19.3 The eleven labels

```
ROUTE     — scene | variant | continue | ooc | command; tier + why.
ANCHOR    — T0 from the {{if linked}}ledger note{{else}}last header + recent chat{{/if}}: day, time,
            weather, place, who is present (spotlight / periphery). Minutes this beat costs → T1.
            Does the weather turn? Any meter at 4+ that must show?
SEAL      — The player's verbs only: SAID / DID / ATTEMPTED / INTENDS / ASKED-OOC.
            The boundary for {{user}} (per persona mode). Where this reply stops.
GNOSIS    — Each fact this beat touches → who holds it, how (or UNKNOWN).
            The single most tempting leak right now, and how to avoid it.
MINDS     — Spotlight: want · fear · tactic · named emotion (VAD) · mask vs feeling ·
            least-used facet · what they misread · what they'd do without {{user}}.
            Periphery: one line each.
WEB       — An exchange between others that changes info / leverage / a bond / a plan, or "none".
            Bond deltas this beat (who → whom, axis, ±, cause).
WORLD     — Ambient pressure or none · consequence due · off-screen arrival and its route
            (linked: only what the note says has arrived) · faction clock tick?
MOVE      — Three candidates: (a) the obvious, (b) the one only this cast would choose,
            (c) the sideways consequence. Gate each by MKAMT. Genre check: what the lead
            genre requires now. Choose one{{if variant}}, never the rejected one{{/if}}.
            The pressure the reply ends on.
PREMORTEM — Grade the last reply A–F in 3 words. The likeliest way THIS reply fails
            (voicing {{user}}, a leak, an echo, a softened enemy, a hazard from the
            spotlight, a clock running backward) → the prevention.
VOICE     — POV/tense · length · dialogue density + speaker cap · first line unlike the
            last reply's · the three spotlighted hazards.
LEDGER    — Ops to emit (only real changes, each with its cause) · header? title? ·
            artifacts? · register entries? · scene mode for next turn.
```

`{{if linked}}` / `{{if variant}}` above are shorthand for `{{if::{{getvar::alm_linked}}}}` and `{{if::{{eq::{{getvar::alm_route}}::variant}}}}`.

**STOP RULE.** After LEDGER, planning is over. Do not review, restart, draft or rehearse. Write once.
**NEVER DRAFT.** No sentence of the reply, no line of dialogue, no opening line, no paragraph outline inside the pass.

### 19.4 Swipe intelligence
On `variant`, the Turn Frame includes:
```
{{if::{{rejectedSwipe}}}}Rejected take opened «{{regex::^((?:\S+\s+){0,18}\S+)[\s\S]*$::$1::{{rejectedSwipe}}::}}…». Choose a different MOVE, a different first line, a different ending.{{/if}}
```
Players swipe because they want *difference*, not a paraphrase.

### 19.5 Reasoning prefill and per-model errata
- `completionSettings.reasoningPrefill`: `Director's Pass — ROUTE, ANCHOR, SEAL, GNOSIS, MINDS, WEB, WORLD, MOVE, PREMORTEM, VOICE, LEDGER. Fragments only; never draft. Stop at LEDGER, then write.`
- **Model Errata block** (auto by `{{model}}`):
  - Claude: "extended thinking *is* the Director's Pass: its labels and ceiling, then stop"; "the ledger is not optional when the emotional beat lands".
  - DeepSeek/R1: "anything drafted in reasoning is wasted; your thinking channel is not output: copy the ledger out".
  - Gemini: "no restating instructions; no markdown headings except the title; the plan is bullet fragments".
  - GLM: "telegraphic fragments within the ceiling; no self-talk".
  - Kimi: "no 'Let me plan', 'Wait', 'Paragraph 1'".
  - GPT: "keep marks exact; no commentary".

### 19.6 Why this is stronger than CHRONICON's and Tessera's passes
1. **SEAL's verb parse** blocks the most common agency violation (treating intent as action).
2. **WEB** forces NPC↔NPC consideration every charged beat; other passes centre {{user}}.
3. **MOVE's three candidates with an MKAMT gate** beat "pick a beat": the gate kills convenient coincidences.
4. **PREMORTEM grades the previous reply** (Frankenstein's report card) *and* anticipates this one's failure.
5. **Swipe-awareness** via `{{rejectedSwipe}}`.
6. **LEDGER is planned, not improvised,** so the delta is consistent with the prose instead of guessed afterwards.
7. The **Sidecar channel** lets a strong cheap planner raise a weak writer.

---

## 20. Trackers: the Ledger Block

### 20.1 Design choice: a line-based delta language
JSON state blocks (VELLUM II) get dropped, fenced, or written as prose by some models. Full XML snapshots (CHRONICON) are huge. ALMANAC uses a **line-based delta language**: one change per line, readable by humans, tolerant to parse, about 80–200 tokens a turn.

```
<ledger>
clock: +12m
wx: rain → heavy rain
at: The Rusty Flagon › back room
cast: Mara@spot(by the fire) · Kael@peri(at the bar) · Joss@left(→ street)
mood Mara: guarded → wary-curious | V-1 A2 D0
body Mara: soaked; fatigue 3
look Mara: coat off, hair dripping
bond Mara>{{user}}: trust +1 — he gave the locket back
bond Kael>Mara: resent +1 — saw her laugh with {{user}}
know Mara: {{user}} is a courier | told · believes · true
know Kael: {{user}} stole the locket | overheard half · suspects · false
item Locket: {{user}} → Mara — returned
thread Lost locket: advance — Mara owes {{user}} a favour
owe Mara → {{user}}: favour | open
journal Mara: "He gave it back. Thieves don't give things back."
keys Mara: locket, courier, favour
canon: The Flagon's back room floods when the river rises
mode: social
</ledger>
```

### 20.2 Grammar

| Op | Form | Meaning |
|---|---|---|
| `clock` | `+Nm` / `+Nh` / `Day N HH:MM` | Elapsed time or absolute set (monotonic check) |
| `wx` | `old → new` or `new` | Weather transition |
| `at` | place path | Scene location |
| `cast` | `Name@tier(activity)` · … | Presence: spot / peri / left (→ where) / arrive (← from) |
| `mood` | `Name: old → new \| V A D` | Named emotion plus VAD |
| `body` | `Name: flags; meter N` | Body flags and meters; `injury: arm, wound, bandaged` |
| `look` | `Name: …` | Appearance / outfit change |
| `bond` | `A>B: axis ±N — cause` | Directed bond delta (A ≠ B; NPC↔NPC allowed) |
| `ladder` | `A>B: tier N — evidence` | Romance ladder step |
| `know` | `Holder: fact \| source · status · truth` | Knowledge row |
| `item` | `Name: from → to — how` / `Name: +holder` | Custody |
| `thread` | `Title: op — detail` | `new / advance / complicate / bridge / resolve / stall(blocker)` |
| `owe` / `cons` | `who → whom: what \| status [due …]` | Debts, promises, consequences |
| `clockf` | `Faction: project +1 (3/6)` | Faction clock tick |
| `rumor` | `text \| from → to \| truth` | Gossip hop |
| `rep` | `{{user}} @ Group: ±N — deed` | Reputation |
| `journal` | `Name: "…"` | Turning point, in their own slant |
| `keys` | `Record: k1, k2, …` | **Retrieval keys** (1–2 words each, 4–12, concrete) |
| `canon` | `fact` | Minted world fact (provisional canon) |
| `artifact` | `Title: kind — holder` | Files the last VTK as a Codex document |
| `mode` | `social / intimacy / conflict / investigation / travel / stealth / downtime / crisis` | **Must be the last line.** Drives the scene-module router |

**Rules**
- Only **changes**. Omission never means deletion; removal is explicit (`item X: → gone — burned`).
- Every `bond`, `know`, `item` and `thread` line carries a **cause**; the Ledger rejects causeless deltas in Strict mode.
- Nothing about {{user}}'s *inner* state in Sealed mode (no `mood {{user}}`), except `persona_thoughts`.
- `keys` lines are how trackers become **real retrieval keys** in the Ledger (05 §7).

### 20.3 `ledger` modes
- **Off:** no block.
- **Lite:** `clock, wx, at, cast, mood, body, bond, mode`.
- **Full** *(default)*: every op.
- **Snapshot** *(standalone only)*: Lite deltas plus a compact **status line per present character** so the tracker drawer can render without the extension:
  ```
  status Mara: wary-curious · soaked · fatigue 3 · wants: the truth about the locket · regard {{user}}: cautious warmth
  ```

### 20.4 Tracker panels (what the user sees)
Rendered in the **Ledger drawer** under the reply (03 §7): Scene · Cast · Bonds · Thoughts · Inventory · Threads and Clocks · Knowledge · Consequences · World · Timeline · Romance · Genre widget. The `trackers` multi-select chooses which panels appear; `tracker_view` chooses **Drawer** (default, collapsed) · Inline card · HUD strip · Off.

- **Standalone:** panels are drawn by display regex from the ledger lines plus status lines.
- **Linked:** the Ledger's render processor replaces the ledger with a **snapshot of the full compiled state as of that message**, so older messages show the world as it was then (time travel for free).

### 20.5 The Unspoken Register
Private thoughts, rendered as a sealed drawer (from CHRONICON and Tessera).

```
<unspoken>
<t who="Mara#2" cue="her thumb keeps finding the locket's clasp">He gave it back. Why would a thief give it back?</t>
<t who="Kael#5" cue="he's wiping the same glass">She laughed. She never laughs for me.</t>
</unspoken>
```

- `thoughts_scope`: **Spotlight** (1–2 whose hidden tension changes the beat) · Shift (only those whose stance changed) · Present (everyone in the room, one line each).
- The cue must be visible in the prose. Nothing in the register is known to anyone but its owner, and it never returns to the prompt.

---

## 21. Output Contract (last block)

```
[OUTPUT]
{{switch::{{getvar::alm_route}}::
ooc::A brief, plain out-of-character answer, or, for a requested change, the story carried on from it.::
command::Execute the command (skip / recap / report / audit) as specified, then stop.::
continue::Continue seamlessly from the last word. Nothing comes before it. No header, no recap.::
{{if::{{eq::{{var::cot_channel}}::visible}}}}<plan> · {{/if}}header when due · # title for a new scene · prose with marks · artifacts · <unspoken>{{if::{{ne::{{var::ledger}}::off}}}} · <ledger> (mode: last){{/if}}.
Nothing else: no commentary, no summary, no options, no headings except the title.}}
{{if::{{eq::{{var::cot}}::silent}}}}Before writing, silently check: {{user}}'s boundary · who knows what · the clock only moves forward · every voice its own · the three hazards · the ledger matches the prose.{{/if}}
The absolute boundaries hold.
```

**Ordering rationale:** the ledger goes last so the router's *assistant capture block* matches at the end of the message (Lumiverse requires that). If output is running long, cut in this order: register, then artifacts. **Never the ledger**; shorten prose before truncating it.

---

## 22. Prompt Variables: full reference

Variables live on the block that uses them, so disabling a block hides its settings (Lumiverse filters the modal by enabled blocks).

| Panel | Variable | Type | Default |
|---|---|---|---|
| **Charter** | `language` | text | English |
| **Agency** | `persona_mode` | dropdown | Sealed |
| | `outcomes` | dropdown | I decide |
| | `initiative` | dropdown | Collaborative |
| | `persona_thoughts` | on/off | 0 |
| **Minds** | `epistemic` | dropdown | Alongside |
| | `firewall_strictness` | dropdown | Strict |
| | `npc_depth` | dropdown | Layered |
| | `inner_voice` | dropdown | Register (off / prose / register) |
| | `speaker_cap` | dropdown | 2 |
| | `npc_autonomy` | dropdown | Proactive |
| | `routines` | on/off | 1 |
| **Bonds** | `social` | dropdown | Living |
| | `landing` | on/off | 1 |
| | `romance` | dropdown | Slow burn |
| | `slowburn_signal` | dropdown | Off |
| **World** | `world_layer` | dropdown | Living |
| | `world_law` | dropdown | Grounded |
| | `reveal_cadence` | dropdown | Measured |
| | `antagonist` | dropdown | Measured |
| | `factions` | on/off | 1 |
| | `header` | dropdown | On change |
| | `climate` | text | "" |
| | `calendar` | text | "" |
| | `start_point` | text | "" |
| | `difficulty` | dropdown | Grounded |
| | `failure_shape` | dropdown | Adaptive |
| | `disposition` | dropdown | Fair |
| | `reputation` | on/off | 1 |
| **Genre** | `genres` | multi-select | Drama |
| | `genre_lead` | dropdown | (first selected) |
| | `tone` | dropdown | Balanced |
| **Craft** | `pov` | dropdown | Third limited |
| | `tense` | dropdown | Past |
| | `length` | dropdown | Adaptive |
| | `pacing` | dropdown | Adaptive |
| | `dialogue` | dropdown | Adaptive |
| | `register` | textarea | "" (house style) |
| | `banned` | textarea | "" |
| | `hazards` | multi-select | all families |
| | `rough_hand` | on/off | 0 |
| | `variance` | dropdown | Lively |
| **Intimacy** | `nsfw` | dropdown | Fade |
| | `nsfw_style` | multi-select | Romantic, Sensory, Aftercare |
| | `vocab` | dropdown | Plain |
| | `intimacy_length` | dropdown | Standard |
| | `desires` | textarea | "" |
| | `limits` | textarea | "" |
| | `violence` | dropdown | Grounded |
| **Presentation** | `theme` | dropdown | Auto (by lead genre) · Almanac · Solar · Nocturne · Botanical · Prism · Candy |
| | `dialogue_color` | on/off | 1 |
| | `dialogue_style` | dropdown | Blocks (blocks / chips / tint / script) |
| | `vtk` | dropdown | Balanced |
| | `vtk_kinds` | multi-select | letter, note, phone, sign, notice, news, screen, item, map, receipt, photo, journal, omen, dossier, contract, feed, menu, ticket, song |
| | `meters` | on/off | 0 |
| | `ledger` | dropdown | Full |
| | `trackers` | multi-select | scene, cast, bonds, thoughts, inventory, threads, knowledge |
| | `tracker_view` | dropdown | Drawer |
| | `thoughts_scope` | dropdown | Spotlight |
| **Engine** | `cot` | dropdown | Auto |
| | `cot_channel` | dropdown | Native |
| | `cot_placement` | placement selector | Balanced |
| | `debug` | on/off | 0 |

---

## 23. Regex Suite

| ID | Layer | Target / placement / depth | Purpose |
|---|---|---|---|
| `alm-spk-before`, `-after`, `-colon` | response | response / ai_output | Recover `[spk=Name]` when the speaker is named next to a quote (never guesses unnamed speakers) |
| `alm-spk-prefix` | response | response / ai_output | Drop a `Name:` label duplicating the tag |
| `alm-ledger-normalize` | response | response / ai_output | Unwrap a fenced or HTML-escaped ledger; move a ledger out of reasoning leakage |
| `alm-plan-last` | response | response / ai_output | Move a visible `<plan>` after the prose (as Tessera does) |
| `alm-show-plan` | display | display / ai_output | Plan → closed "Director's notes" drawer |
| `alm-show-plate` | display | display / ai_output | Header lines (+ title) → sky plate (03 §4) |
| `alm-show-title` | display | display / ai_output | `# Title` without a header → title card |
| `alm-show-speech-{block,chip,tint,script}` | display | display / ai_output | Dialogue renderers (one enabled by `dialogue_style`) |
| `alm-show-persona-speech` | display | display / user_input | Colour quoted speech in the player's own messages |
| `alm-show-thought`, `alm-show-text` | display | display / ai_output | `[thk=]` inline thoughts; `[txt=]` in-world text |
| `alm-show-vtk` + sub-syntax (`»`, `«`, `→`, `....`, `[redacted]`, `[meter=]`, `[stamp=]`, `[sig=]`) | display | display / ai_output | Artifact cards |
| `alm-show-unspoken` (+ rows) | display | display / ai_output | Sealed register drawer |
| `alm-show-ledger` (+ rows) | display | display / ai_output | Standalone tracker drawer (disabled in linked mode, where the extension renders it) |
| `alm-show-ooc` | display | display / ai_output | OOC answers as a quiet side-card |
| `alm-prompt-plan`, `-unspoken` | prompt | prompt / ai_output+memory | Never return plans or registers |
| `alm-prompt-ledger` | prompt | prompt, `min_depth: 2` | Strip old ledgers; keep the latest as a format example |
| `alm-prompt-marks` | prompt | prompt, `min_depth: 4` | Thin `[spk]`/`[thk]`/`[txt]` marks from older replies |
| `alm-prompt-headers` | prompt | prompt, `min_depth: 6` | Drop old headers |
| `alm-prompt-vtk` | prompt | prompt, `min_depth: 6` | Old artifacts → `[Letter: title] text` |
| `alm-memory-strip` | memory | memory placement | Keep ledgers, plans, registers and headers out of vector memory |
| `alm-persist` *(standalone)* | persistence | prompt / ai_output, `substitute_macros: after` | Last ledger → `{{setchatvar::alm_clock/alm_place/alm_wx/alm_present/alm_mode::$n}}` |
| `alm-router` | activation | "Activate prompt blocks from matches", assistant capture, "Until changed" | `mode: (?<mode>\w+)\s*</ledger>\s*$` → enables the matching Scene Module block |

---

## 24. Scene-Mode Router (token discipline)

The last ledger line names the scene mode. A preset-linked regex uses Lumiverse's **Activate prompt blocks from matches** to enable exactly one **Scene Module** for the next generation ("Until changed" mode).

| Mode | Module adds | ≈ tokens |
|---|---|---|
| social | (none; the core covers it) | 0 |
| intimacy | The Intimacy Module (§17.3) | 500 |
| conflict | Spatial clarity, positioning, one exchange per reply, injuries that stay, no auto-win, stop at the player's defence | 320 |
| investigation | Clue fairness, evidence physics, witness self-interest, reveal cadence | 260 |
| travel | Legs, time, supplies, terrain, weather effects, encounter gating (MKAMT) | 240 |
| stealth | Perception by senses and weather, noise, cover, discovery ladder | 220 |
| downtime | Time-skip rules (stop before choices), routines, recovery, off-screen catch-up | 200 |
| crisis | Stakes clarity, shrinking options, one decisive pressure | 180 |

**Fallback** (if block activation isn't linked): each module's content is gated by `{{if::{{eq::{{getvar::alm_mode}}::conflict}}}}`, using the chat var set by `alm-persist`.

---

## 25. Token Budget (defaults, linked mode)

| Part | ≈ tokens |
|---|---|
| Foundation + Agency + Minds + Bonds | 1,850 |
| World + Time + Stakes + Disposition | 1,000 |
| Genre (2 genres) | 390 |
| Craft (floor + deck + dialogue) | 690 |
| Adult base (module only when active) | 120 |
| Presentation + Ledger spec | 710 |
| Bridge / Continuity | 160 |
| Turn Frame + Director's Pass + Errata + Output | 800 |
| **Preset total** | **≈ 5,700** |
| Ledger notes (Now + Knowledge Brief + Recall + Craft Brief), injected by the extension | 600–2,500 (budgeted, 05 §8.6) |

Compare: CHRONICON's always-on blocks plus mandatory full-state output are several times larger *before* the model writes a word of prose.

---

## 26. Completion and behaviour settings

| Setting | Value |
|---|---|
| Temperature / Top-p | 1.0 / 0.95 (Tessera's) |
| `continueNudge` | `[Continue from the exact last word. No header, no recap, no restart, no second ledger.]` |
| `emptySendNudge` | `[The player waits. Let the world move on its own — within the initiative budget.]` |
| `impersonationPrompt` | `[Write {{user}}'s next message in {{user}}'s own voice, in the player's usual form and length. Only {{user}} acts or speaks. No header, marks, ledger, or artifacts.]` |
| `groupNudge` | `[Write the next reply as {{char}}; everyone else present keeps living in the scene.]` |
| `newChatPrompt` | `[A new story begins. Seed the clock from the start point or the setting.]` |
| `reasoningPrefill` | §19.5 |
| `enableFunctionCalling` | on (for the Ledger's optional recall tools) |

---

## 27. Standalone vs Linked: one table

| Feature | Standalone (preset only) | Linked (with ALMANAC Ledger) |
|---|---|---|
| Current state | Last header + chat vars from `alm-persist` | `<ledger-note>` (verified T0) |
| Weather | Model within rules | Deterministic engine + forecast |
| Knowledge | Model + firewall rules | Knowledge Brief per present NPC |
| Trackers | Regex-drawn from the ledger + status lines | Compiled snapshots per message |
| Memory | Chat history (+ Lumiverse memories if enabled) | Chapters spliced in place; Codex; hybrid recall |
| Off-screen life | ≤ 1 development per reply | Simulator between turns |
| Anti-slop | L1–L4 | L1–L5 (telemetry) |
| Dialogue colours | Voice-slot palette (12 colours) | Per-cast colours via stylesheet; editable |
| CoT | Native / Visible / Silent | + Sidecar planner |
