# 10 · The Almanac lorebook format, and the Creator as a conversation

The Almanac reads the lorebooks attached to a chat into its Codex (the Lore Bridge, [05 §9](05-extension-ledger.md)), and its Lorebook Creator writes books. Until 1.17 both followed another project's conventions: a fixed set of title labels and an `extensions.vellum3` metadata block. That project isn't part of ALMANAC. This document replaces those conventions with ALMANAC's own **lorebook format**, built from the books players actually bring, and turns the Creator from a one-shot wizard into a conversation with the model.

**Status:** built in extension 1.17.0. The format is `src/core/loreformat.ts`; the reader is `classify` in `src/core/lore.ts`; the Creator is `src/core/creator.ts` (format, converter, plan, prompts), `src/backend/creator.ts` (the conversation) and `src/frontend/creator-ui.ts` (the page).

## 1. What the books look like

Twelve hand-made or imported books in the user's Lumiverse database (1,061 entries) were read with the 1.16 reader. They fall into two families.

**Structured books** (5 books, 437 entries): every title has a label (`Character: Buffy Summers`, `CURRENT - Hellions Raid Sunnydale`, `Upcoming: The Trio Targets the Slayer`) and every entry carries a metadata block naming its kind. The reader read all of them exactly.

**Free-form books** (7 books, 624 entries): titles are written for people, not parsers. The 1.16 reader guessed at 70–95% of each:

| Book | Entries | Read only by guessing (1.16) | (1.17) |
|---|---|---|---|
| Buffy_the_Vampire_Slayer_PreS6 | 132 | 91 | 0 |
| BTVS | 152 | 110 | 0 |
| BTVS (1) | 156 | 113 | 0 |
| R+R (Rhaenyra and Rhaegel) | 105 | 99 | 9 |
| Aelor + Cersei | 60 | 44 | 1 |
| Rhaenyra + Rhaegel | 13 | 13 | 0 |
| Cersei Lore | 6 | 5 | 0 |

A guess files the entry as "texture" with low confidence: Buffy Summers became a custom called "The Slayer", and the review queue filled with people, places and history.

The shapes those books use, in order of how often:

| Shape | Examples | What it is |
|---|---|---|
| `Name - Descriptor` | `Buffy Summers - The Slayer`, `Ser Harbert Rivers - Castellan` | A person; the descriptor is their role. 1.16 read "Buffy Summers" as a label and "The Slayer" as the name |
| A rank before the name | `Princess Rhaenyra Targaryen`, `Lord Lyonel Strong`, `Grand Maester Mellos` | A person |
| `A & B - Descriptor`, `A and B` | `Buffy & Spike - Hostility, Truce, Unwanted Devotion`, `Viserys and Rhaegel` | What lies between two people (often selective, with B's names as secondary keys) |
| `Name - Speech and Manner` | `Rhaenyra - Speech and Manner` (position 2) | How someone talks |
| `What X Knows`, `What X Does Not Know`, `What the Realm Believes` | | Who has which information, and who doesn't |
| A date before or after | `109 AC - Daemon Begins the Assassination Campaign`, `The Wildfire Nameday - 5 Third Moon 281 AC`, `Season Two Arc - …` | History |
| A title that tells an event | `Faith Kills Allan Finch`, `Angel Loses His Soul`, `Dawn Is Created from the Key` | History |
| A content tag | `RULE:`, `MYTHOLOGY:`, `THEME:`, `STORY ARC:`, `CURRENT SCENE:`, `CUTOFF EVENT:`, `META-RULE:`, `AI DIRECTIVE:` | Rule, history, instruction, situation, canon boundary |
| `Theme - …`, `… Tone`, `Role Assignment - …` | | An instruction to the model, not a fact |
| `AU Canon - …`, `Story Start - …`, `Canon and Spoiler Exclusion Protocol` | | Where the story sits in canon, and what it changes |
| Possessive titles | `Rhaenyra's Denial`, `Spike's Crypt`, `Olaf's Hammer`, `Mayor Wilkins's Ascension` | More about that person, or their place, item or event |
| An attribute block | `[ age(18); appearance(…); relationships(…) ]` | Structured detail after the prose |

Field habits: all 624 entries of the free-form books have **priority 10** (Lumiverse's import default), with the author's real tier in `order_value` (300 for canon rules down to 85 for flavour). Lumiverse ranks budget fights by priority, so under a tight budget those entries are dropped in no useful order. People sit at position 1, voices at 2, current scenes at 3 or 4@2, hard rules constant at 4@4.

## 2. The format

Sixteen categories. Each has a title label, the Codex kind it files as, a tense, a default tier (priority and order), a position, how its content opens, and the metadata it carries.

| Label | Kind | Tier · position | Opens with | Metadata adds |
|---|---|---|---|---|
| `Timeline Boundary - …` | boundary | 300 · 4@4, may be constant | the moment the story begins; what canon it changes | |
| `Rule:` | law | 280 · 4@4 | the rule itself; MUST / CANNOT for hard limits | |
| `OOC:` | meta | 275 · 4@4 | an instruction to the narrator | |
| `Character:` | person | 200 (main cast 250, minor 150) · 1 | "Name is …", with eye and hair colour and age | |
| `Relationship: A & B` | bond *(new)* | 180 · 1 | "A and B are …" | participants |
| `Voice: Name` | texture → the person's voice | 160 · 2 | "When Name speaks, …" | participants |
| `CURRENT - Who Does What` | situation | 150 · 4@2 | participants first; public events use public words | participants, place, visibility, expected |
| `Belief:` | belief | 150 · 1 | "X believes / does not know …"; "Unbeknownst to them" when wrong | participants |
| `Secret:` | texture, narrator-only | 150 · 0 | that it's secret, who keeps it from whom, then the sign someone might notice | participants |
| `Faction:` | group | 130 · 0 | what it is, who leads it, members by their exact names | members |
| `Upcoming:` | forecast | 120 · 0 | future tense only | participants, place |
| `Item:` | object | 120 · 0 | the holder | holder |
| `Location:` | place | 110 · 0 | the parent place; hours; routes; who is found there | parent |
| `History:` | history | 100 · 0 | the event, in the past tense, dated | |
| `Customs:` | texture | 90 · 0 | concrete texture of a named place or people | |
| `Scene:` | playbook | 90 · 0 | the trigger ("When Buffy learns …") | participants |

The labels each category also answers to (`NPC`, `Place`, `House`, `Prophecy`, `AU Canon`, `Theme`, `Speech and Manner`, `X System`, `Season One Arc`, …) are in `loreformat.ts`.

**New categories.** *Relationship* files as a Codex `bond` linked to both people, so Recall brings it in when either is present. *Voice* joins the person's card as their voice instead of making a second record. *Belief* gets its own label (the mirror already wrote `Belief:` titles that nothing read). *Secret* is kept narrator-only. *Scene* is a playbook from any book, not only Dream Weaver depth books: kept from keyword activation and sent as "not history" only when a turn comes close (as depth-book scenes have been since 1.10).

**Metadata.** `extensions.almanac.lore = { category, kind, tense, participants?, members?, place?, visibility?, expected?, holder?, parent?, subject?, name? }`. `name` is written when the title alone wouldn't give the record's name back (`Location: Harrenhal — The Five Towers` keeps the name "Harrenhal: The Five Towers"), so a converted entry keeps its Codex id. Blocks other tools wrote (`extensions.vellum3`) are still read, so existing books keep reading exactly; the Creator never removes them.

## 3. The reader

`classify` reads an entry in this order, and stops at the first that's sure:

1. **Metadata** (confidence 1).
2. **A known label** (0.85). Only labels the format knows are labels: `Buffy Summers - The Slayer` is about Buffy Summers. A label that names its own subject (`Watcher System - Training…`, `Season One Arc - …`) stays in the name.
3. **A content tag** (0.8): `RULE:`, `STORY ARC:`, `AI DIRECTIVE:` and the rest.
4. **The title's shape** (0.6–0.8): a date; `What X Knows`; a pair of names (not two places, not an event); a voice descriptor; a title that tells an event; `House X` / `Order of X`; a rank before a name; a name the content opens with ("Lord Lyonel Strong, Hand of the King…").
5. **The first sentence** (0.6): "X is a/an/the ROLE", "X is Sunnydale's ROLE", "X, called Glory, was an ROLE". The role's head noun decides the kind ("a senior Watchers Council **authority**" is a person; "a covert military research **program**" a group); a thing's title outranks a sentence read as a person.
6. **Weaker hints** (0.5–0.55): a place, group or object noun in the title (the last word first: "Spike's Initiative **Chip**"), a past-tense opening, a rule or custom word, a possessive owner.
7. Otherwise a guess (0.3), for the review queue and the model classifier.

Dream Weaver books keep their own rules ([05 §9](05-extension-ledger.md), 1.9–1.10): only metadata, labels and a plain "X is a …" sentence are read before the book's role decides.

**Checked against the books in §1:** low-confidence entries fell from 475 to 10. Every reading was audited by hand on BTVS (1), R+R and Aelor + Cersei; the remaining misses are titles a person would also have to open (`Possible Flashpoints`, `Rumor Without the Truth`).

## 4. The Creator: a conversation

The Creator page (Library › Creator) is a chat with the model, on its own connection (Settings › Lore bridge › *Lorebook Creator connection*, or the selector at the top of the page; empty means the summariser's).

1. **What to make.** The Almanac opens with the five tasks: *create a new lorebook*, *update a lorebook*, *make a lorebook Almanac-compatible*, *save this story as a lorebook*, *check a lorebook*. The player can click one or just say what they want; the model works out the task. Tasks that need a book show a picker (memory books other extensions write, and Dream Weaver books, are tucked away).
2. **Sources.** Anything typed or pasted; long pastes (over 1,500 characters) are kept as sources and shown as chips, as are the chat's character card and the player's persona when added. The conversation shows the model up to 24,000 characters of sources; the writer gets up to 40,000.
3. **The plan.** The model proposes a plan: a list of items, each `create`, `update` (an existing entry, by its short id `e12`), `retire` (switch off, never delete), `convert` or `keep`, with a category, a final title and a line on what it will say or what changes. The page shows it as a card: categories as filters, each title and category editable, items removable, the book's name, and for conversions two switches (labels in titles; real tiers for priority-10 entries).
4. **Revising.** The player asks for changes in words; the model answers with a `revise` (add, drop, change by item id, options) for long plans or a whole new `proposal` for short ones. Each revision is a new version: the items it changed are highlighted, removed ones listed. Edits made by hand on the card apply in place.
5. **Accepting** writes the entries. New and updated entries are written in batches of eight, every title in the plan given for cross-references, then validated: deterministic fixes (tiers, metadata, depth, keys) and a list of what the model must redo, sent back once. An update keeps the entry's own fields (priority, position, match settings) and takes only the text. A conversion is code, not the model: each entry gets its new title (or keeps its own), metadata that makes it read exactly as it was read, and its tier; only an opening that would mislead (an *Upcoming* entry told as fact) is rewritten, and only its first sentence. Entries already written for items unchanged since are kept when the plan changes and is accepted again.
6. **Review.** The written entries, with tokens, positions, recursion links (orphans, loops, people a faction names who have no entry), an activation check, and per entry: edit, *Rewrite* with a note, remove.
7. **Saving.** Into the chosen book (only the fields that changed are sent, so a setting left at Lumiverse's default isn't pinned; retired entries are switched off) or as a new book (a converted or updated copy carries the rest of the source book). It may attach the book to the character, persona, chat or globally, and have the Lore Bridge read it at once. The page asks before writing into an existing book. A chat's mirror book and Dream Weaver rules books are refused.

Each conversation is saved in the player's extension storage (`creator/index.json`, `creator/<id>.json`, the last twelve), so it survives reloads and restarts; a step cut off by a restart resumes in a usable state. A failed model call is shown in the conversation with *Try again*, which runs the same turn.

## 5. The model's side

One system prompt per turn: who the Creator is and the five steps; the task's rules; the phase (intake, discuss, review, saved); the sixteen categories by id; the reply shape; then the chosen book's index (one line per entry: `e12 | character | title | keys | first 110 characters`), the sources and the current plan. The reply is one JSON object: `say` (prose for the player, never entry text), `options` (up to four quick replies), and optionally `task`, `needs`, `proposal` or `revise`. A reply with no JSON is shown as what it says.

The writer has its own system prompt built from the format table, so what it writes is what the reader reads.
