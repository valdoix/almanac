# ALMANAC

A living-world roleplay setup for [Lumiverse](https://github.com/prolix-oc/Lumiverse), in two parts that work alone and better together:

- **ALMANAC** — a preset (`preset/ALMANAC.json`). People with private minds, NPCs who act and relate to each other without waiting for you, a knowledge firewall, real time and weather, genre contracts that change what happens, a sealed persona, a step-by-step Director's Pass, and a line-based `<ledger>` of what changed each turn. Its display rules draw living scene plates, voice cards, sealed-envelope thoughts, in-world artifacts and a tracker drawer.
- **ALMANAC Ledger** — a Spindle extension (`almanac_ledger`). It reads each ledger, checks it, and keeps the world: branch-safe state (swipes, edits and forks never corrupt it), chapters that replace old turns, a Codex, knowledge-aware recall, a computed calendar/sky/weather, off-screen life, a lore bridge to your lorebooks, and a lorebook creator. It feeds the verified state back to the model as a short `<ledger-note>` before your message.

The full design is in [`design/`](design/README.md).

---

## Install

### The extension
In Lumiverse (1.2.4 or newer), open **Extensions → Install from GitHub** and paste this repository's URL (`https://github.com/valdoix/almanac`). The manifest is `spindle.json` at the repository root, and the built bundles are committed in `dist/`, so no build step is needed. Grant the permissions it asks for:

| Permission | Used for |
|---|---|
| interceptor, context_handler | Planning the turn and injecting the ledger note, recall and chapters |
| generation | Chapter summaries, ledger repair, the knowledge clerk, the off-screen simulator, the sidecar planner (all optional) |
| chats, chat_mutation | Reading the transcript, hiding summarised turns, drawing the tracker drawer as of each message |
| world_books | The per-chat mirror lorebook and the lore bridge |
| characters, personas | Names, per-character defaults, colours |
| tools | Optional recall tools the model can call |
| ui_panels | The floating "Now" widget |

To update later, use **Update** on the extension in the Extensions panel. It pulls the latest commit of the branch you installed from, so if you installed from a different branch, switch to it there first. The version in the Extensions panel (from `spindle.json`) tells you which release you're running. Releases are listed in [CHANGELOG.md](CHANGELOG.md).

After updating the extension, import the preset again when the changelog says the preset changed too. The drawer warns when the chat's preset is older than the extension expects.

### The preset
**Presets → Import** and choose `preset/ALMANAC.json`. It brings its own regex scripts (they are bound to the preset, so they switch on and off with it). Open the preset's **variables** panel to set persona mode, genres, intimacy, planning depth and the rest; each setting lives on the block that uses it.

The two find each other on their own: with the extension installed, the preset sends a hidden handshake that the extension removes before the model sees it, and the extension arms itself for any chat that uses the ALMANAC charter. It disarms again after two turns without it, so a chat moved to another preset goes back to normal (turns it hid come back, and its mirror lorebook goes quiet). **Settings › This chat** can pin it on or off instead.

The preset leaves sampling (temperature, top P) to your connection: newer models reject some combinations. Its **Planning channel** defaults to *Auto*: the Director's Pass runs in native reasoning for models that think before answering, and becomes a silent checklist for models that don't (they would otherwise write the plan into the reply).

---

## First run

1. Start a chat with the ALMANAC preset active.
2. With the extension, the **Session Zero** window opens (or run **ALMANAC: Session Zero** from the command palette): genres, tone, who writes your character, romance pace, difficulty, intimacy and hard limits, climate, calendar, start point, trackers and skin. The answers are stored for this chat only and override the preset's own dials.
3. Without the extension, type `/session0` and the model runs the same interview out of character; its answers are saved to the chat by a regex script.

## Playing

- Write as usual. The model ends each reply with a `<ledger>`; you see it as the tracker drawer under the reply.
- Out of character: `((like this))`, `OOC: …` or `[OOC …]`.
- Commands: `/skip 30m`, `/skip until morning`, `/recap`, `/report bonds`, `/report threads`, `/audit`, `/session0`. The **Director's Desk** keycaps in the latest drawer send them in one click.
- The floating **Now** widget (extension) is a small orrery. The pill shows a sky dial, the time, weather, place, who is present (a mood dot pulses when a mood just changed), the most urgent thing (a deadline, a debt that's due, the sunset) and a badge counting what the last reply changed. Click it to open the Now window: the sky with the sun and moon on their arcs, the next hours' forecast, and tabs for **Changed** (what the last reply did, bond moves shown old → new), **Stakes** (deadlines, faction clocks, gauges, debts, the clue board), **Cast** (moods, what they hold, injuries, where they stand with you; a narrator toggle reveals hidden pressures and dramatic irony), **Threads** (open and stalled threads, Chekhov plants, rumours), **Unspoken** (the last reply's private thoughts, as sealed envelopes or thought bubbles; hidden when the preset's inner voice is off) and **Backstage** (what the Almanac fed the model). The book button opens the full drawer. It takes the active skin's colours, type and shapes. Drag it anywhere, resize the open window from its bottom-right corner (double-click the corner to reset), and right-click to hide or reset it.
- Swipes get a different take, not a paraphrase: the model is shown how the rejected take opened.
- The **Almanac** drawer tab (extension) opens under a live sky: clock, date, moon, weather and place. The dock at the bottom holds everything. The sun goes to **Now**, and each planet opens its pages on an orbit: **People** (Cast · Bonds with a relationship graph and time scrubber · Knowledge), **Story** (Chronicle · Timeline · World), **Library** (Codex · Lore · Creator) and **Engine** (Recall · Craft · Settings). Under the sky, a switcher moves between the current group's pages, and a planet glows with a count when something needs a look (debts due, lorebook entries to review, unverified turns).
- **Knowledge** (People › Knowledge): who has which piece of information and how it reached them. When something is said aloud, whoever said it and everyone in earshot have it. People only count as not knowing something with evidence: it's kept from them, they weren't there when it came out, or the story says so. Anyone with no record either way is left blank, never marked as not knowing. Animals, forces and anyone asleep know nothing. The model writes `reveal` (something came out), `know` (a guess, deduction or wrong belief), `secret` (who keeps it from whom) and `unaware` lines; the old one-line `know` diaries are still read, split into single facts. The page lists **In play** (secrets and beliefs), **Shared** and **Noted** (one person's passing observations, never sent to the model), with a per-person view. You can correct it: **+ Add a fact**, **delete** a fact (restore it at the bottom), and under **edit** set each person to knows, believes, suspects, doubts, has it wrong, doesn't know, or no record either way. What you set holds whatever the story writes later. The **knowledge clerk** (Settings › Knowledge) is a quiet call after each reply that rewrites untidy knowledge lines cleanly. **Tidy the whole chat** reads every reply the clerk has not read yet, oldest first. It is one generation per reply, shows progress, and can be stopped and resumed. Design: [design/07](design/07-knowledge.md).
- **Summaries** (Settings › Chronicle): choose how much each chapter keeps: *brief*, *standard*, *detailed* (the default: scene by scene, plus where everyone stands at the end) or *exhaustive* (adds sensory texture, tells and voices). "Always keep in summaries" lists anything that must never be dropped. **Rewrite all** on the Chronicle page redoes the unlocked summaries at the current level. **Summaries in the prompt** chooses what the model gets of the story before the raw tail:
  - *The whole story* (the default): every stretch, once, at its most compact level (volumes, then arcs, then chapters). A chapter folded into an arc goes back in, whole, when a turn names someone or something from it.
  - *Only when relevant*: the latest chapter, plus up to three earlier chapters that share a name or a rare detail with the turn. It costs fewer tokens, but the model forgets what isn't picked.

  The Chronicle page marks what the last prompt carried, and the Recall page lists it under "Story so far in this prompt".

### Continuity and detail

- **Looks that don't drift.** `look` is what someone wears now; `trait` is what doesn't change by itself: eyes, hair, build, scars, age. The model writes `trait Daeron: violet eyes; silver hair cut short` when someone is first described. Eye and hair colour and age are also read from the character card, your persona and the lorebooks. Every present person's traits go in the note every turn as `always: …`, together with the age and appearance you set on the Cast page. What you set, or say in your own message ("Daeron has violet eyes"), holds: a later `trait` line that contradicts it is refused.
- **Story truths** (Settings › This chat): rules for this story that hold over the source material and older chat ("Jaime and Cersei are strictly family"). They go in every turn as `[TRUTHS]`. You can also pin one from a message with `((truth: …))`.
- **Your own words count.** A date you state ("it's day 12", "THIS IS DAY 26 - FIRST MOON 27", "It's Second Moon 7") moves the clock, even backwards. So do "the next morning" and "three hours later" in an aside. Looks you state are filed as yours. `((bit: …))` adds a running bit. Settings › Knowledge › *Facts in your own messages*: rules only, or rules plus a quiet model read after each reply that files where things are kept and other facts you state.
- **Secrets off the page.** The knowledge firewall stops characters acting on what they don't know. A secret *off the page* is also kept out of the narration, the thoughts, the Unspoken register and the chapter summaries until a scene brings it out. On the Knowledge page, **edit** a fact and tick *Keep it out of the narration…*, with the words never to use yet ("Heaven") and how the story may allude to it ("somewhere warm and finished"). The model can mark one itself: `secret #key: … | kept by A · from B · never say: Heaven`. Summaries, recall and mirror entries that name it are reworded on the way into the prompt, including summaries written before you marked it.
- **Playbooks.** A Dream Weaver depth book is mostly scripted scenes ("When Buffy learns…", "It happens in the kitchen…"). Sent as lore, the model read them as things that had happened, and they spoiled what hadn't. They are now kept from Lumiverse's keyword activation. When a turn comes close to one (two of its own keywords, one of them in your message), it goes in once, marked *not history*, and never when it would give away a secret kept off the page. The Lore page lists them. A scene is retired once a chapter shows it happened, or when you mark it played.
- **The check of each reply** (Settings › Knowledge › *Check each reply*): after each reply, the Almanac looks for the slips you'd otherwise regenerate for:
  - a secret kept off the page named on it;
  - a secret in the mouth of someone it's kept from;
  - the dead speaking, or someone speaking who isn't in the scene;
  - a planning block left in the reply (`<weaver_deliberation>`);
  - the clock run backwards;
  - someone's eyes or hair contradicted.

  Findings show on the reply's drawer, first in the Now widget's *What changed*, and on the Recall page (with **Check again**). The next turn's note tells the model, so the slip isn't carried forward. *Rules plus a model read* also asks a quiet model call for past events the reply claims that the record doesn't hold.
- **Callbacks.** Running jokes, pet names, catchphrases and keepsakes are tracked: the model's `motif:` lines, and a *Running bits* line in every chapter summary, so they survive being folded into arcs and volumes. A few not used lately go in the note as `[CALLBACKS]`. The World page lists them all.
- **What the model writes, read as meant.** `hunger 4→2 (fed; real food)` sets hunger to 2. `fatigue 4+` is 4. `concussion + scalp laceration` is two injuries, not two flags. Bond axes are whole words ("self-resentment" is not resentment of the other person). Ladder rungs can be given by number or name ("tier 2 → tier 3", "Charged → Tested"), and the note shows them as `Charged (3/7)`. A line the Almanac can't read ("ladder A>B: Name Said Bare") is reported with the right shape instead of being dropped. A body line with new states replaces the passing ones (lasting conditions stay), and a new scene clears poses. Parts of a room ("fridge") aren't items, and an item someone is now wearing comes to them.
- **No stale cards.** The archivist records only what lasts about someone (role, traits, wants, fears, voice, looks), and it revisits everyone a chapter names, not only people first seen in it. What it wrote about where someone is or what they were doing is left out of the prompt after 60 messages, and it never overrides the live state.

### Prompt size and cost

- **Ceiling** (Settings › Prompt size): everything the Almanac adds to one prompt (the ledger note, recall, the mirror lorebook's cards and the chapter summaries) stays under this many tokens. The default is 24,000; 0 means no ceiling. Over it, the summaries narrow to the ones the turn touches, then the oldest of those are left out, then the lowest-ranked recall. The note and the latest chapter always go in. Lumiverse fits the rest of the prompt to your model's context *before* the Almanac adds its part, so leave room: with a 32K model, try 8,000. The Recall page shows what the last turn cost and what was cut. On a 250-message chat with *exhaustive* summaries, the whole story runs to about 21,500 tokens; the preset itself is about 6,500.
- **Background calls.** These are quiet model calls on your summariser connection (or the one set for each job): chapter, arc and volume summaries and the archivist (now and then), ledger repair (only when a reply has no ledger), the knowledge clerk (*auto*: only when a reply's lines need it), the reply check's model read, the player-facts read and the off-screen simulator (each only when switched to it). With everything on, expect three to five extra calls per reply. Point them at a cheaper connection in Settings to save cost.

### Privacy

- Everything the extension stores is in Lumiverse's own extension storage for your user (`data/users/<id>/extensions/almanac_ledger/`). Nothing is sent anywhere except to the model connections you configured.
- The skins' web fonts load from Google Fonts only when you switch them on (Settings › Look). Off by default since 1.13; the skins fall back to your system fonts.

### Language

The preset writes the story in its **Language** setting, and the extension's summaries, Codex cards and knowledge lines follow it. Its own readers (the ledger parser, injuries, dates you state, speech detection) are tuned for English; dialogue in « », „ “, 「」 and British single quotes is recognised.

## Skins

Eleven skins, each with a light and a dark palette: **Almanac** (field almanac), **Solar Editorial** (magazine), **Nocturne** (gothic romance), **Botanical** (herbarium), **Prism** (holographic), **Candy** (sticker pop), **Dossier** (case file), **Scriptorium** (illuminated manuscript), **Arcana** (spellbook), **Orbital** (station interface) and **Posy** (florals in pink and green). **Follow Lumiverse** takes its colours from your Lumiverse theme instead.

- Pick one in Session Zero (for this chat) or in **Settings › Look**. Left on Auto, the skin follows the lead genre.
- **Light or dark** (Settings › Look): Auto follows Lumiverse's light/dark mode, or pin either one.
- **Colours** (Settings › Look): a picker for each colour of the skin on screen (paper, shade, text, quiet text, lines, the two accents, gold, good, warning, danger). The skin repaints as you drag. Your colours are kept for each skin, and for its light and dark palettes separately; **reset** puts one back and **Reset all** the whole palette. Follow Lumiverse can be repainted too.
- Only the active skin's web fonts are loaded.
- Every character's colour can be changed on the **People › Cast** page, including your persona's. **edit** on a character sets their name, age and appearance (the old name keeps working in the story's lines; your persona's name comes from Lumiverse), and **+ Add a person** adds someone the story hasn't named. An age the lore mentions in passing is shown until you set one.
- Mockups of every skin in both modes: [design/mockups/skins.html](design/mockups/skins.html).

## Calendars

The calendar setting (Session Zero, Settings › World engines, or the preset's variables) takes Gregorian by default, a named calendar, or your own world's.

- **Named calendars**: `Westeros` (A Song of Ice and Fire: months counted as moons, years AC, seasons that last years), `Roshar` (The Stormlight Archive: ten months of fifty days, the Weeping at the turn of the year, three moons), `Harptos` (Forgotten Realms: festival days and Shieldmeet) and `Shire Reckoning` (Middle-earth: every year starts on Sterday). Add clauses after the name to change one piece: `Westeros; year: 130 AC`.
- **Your own world's calendar**, with clauses separated by `;`:

  ```
  months: Thaw (30), Bloom (30), [Greenfest], Highsun (31), Mid-year's Day (festival, weekless), Harvest (30)
  weekdays: Firstday, Seconday, Midday, Fourthday, Restday      (or: weekdays: none)
  year: 312 AR          leap: Starfall after Harvest every 5 years
  seasons: solar        (or: seasons: story — the story turns them)
  moons: Ilse (18), Varo (41)
  holidays: Lanterns (14 Harvest), the Thaw Fair (1 Thaw, 3 days)
  format: {weekday}, the {ord} of {month}, {year} {era}
  ```

  `[Name]` is a festival day between months, shown without a day number. A `weekless` day belongs to no week, so the weekdays skip it.
- **Story seasons**: with `seasons: story` (built into Westeros and Roshar) the season isn't tied to the date. The model turns it with a `season: winter` ledger line, and the weather and day length follow.
- Session Zero shows what Day 1 will be as you type.
- The clock still runs on 24-hour days, whatever the calendar.

## Storage (hybrid)

The extension's own storage is the source of truth: an event log keyed to message and swipe, so any branch can be rebuilt from the transcript. A **mirror lorebook** named "ALMANAC · ‹chat›" is attached to the chat as a readable, editable projection (summaries or full records, your choice). Edits you make in the mirror are imported back as locked corrections. The mirror's entries are stored switched off, and the extension switches on the ones each turn needs, so the book stays quiet whenever the Almanac isn't running the chat. It never writes to your other lorebooks; only the Lorebook Creator writes, to a book you choose, and it asks before replacing entries or your persona's lorebook. See [design/06](design/06-storage-decision.md).

## Uninstalling or switching off

1. In each chat that used the Almanac, run **ALMANAC: Release hidden turns** from the command palette (or **Settings › This chat › Show hidden turns**). With *Hide covered turns* on, summarised turns are hidden from the prompt; without the extension nothing would put their summaries back. Switching a chat off does this for you.
2. Optionally delete the chat's mirror lorebook ("ALMANAC · ‹chat›"). It is inert without the extension, so leaving it does no harm.
3. Remove the extension in Extensions, and switch the chat to another preset.

## Troubleshooting

- **A warning says the last turn went out without the Almanac.** Planning failed; the error is in the warning. It clears on the next turn that works.
- **"Something in the background didn't work."** A summary, the knowledge clerk, the reply check, the simulator, the mirror lorebook or hiding turns failed. The story carries on. Check the connection set for that job in Settings.
- **The drawer says the background process runs another version.** Turn the extension off and on (or press Update) and reload the page.
- **The chat forgot older story after switching something off.** Run **ALMANAC: Release hidden turns**.
- **Nothing happens in a chat.** Settings › This chat shows whether the Ledger is on there and why. It arms itself only with the ALMANAC preset; press **On** to pin it.
- **Long chats.** The first turn after a restart re-reads the whole chat (about 3 seconds for 2,500 messages). After that, a turn costs a few tens of milliseconds.

---

## Development

```sh
bun install
bun run build        # dist/backend.js, dist/frontend.js and preset/ALMANAC.json
bun run typecheck
bun test             # parser, state engine, engines, recall, chronicle, golden checkers, hooks against a fake host
bun run check:dist   # the committed dist/ and preset match this commit (CI runs it on every push)
```

Lumiverse installs from a branch head, so every push to the branch users install from is a release. Work on another branch and merge to the install branch when `bun run build`, `bun test` and `bun run check:dist` pass; add a CHANGELOG entry and bump `src/core/version.ts` (`VERSION`, and `PRESET_VERSION` when the preset changed), `spindle.json` and `package.json` together.

- `preset/src/` holds the preset source (blocks, variables, regex suite, scene plate); `bun run build:preset` regenerates `preset/ALMANAC.json` and validates ids, placement bindings, router targets, every regex, and macro balance.
- `LUMIVERSE_SRC=/path/to/Lumiverse bun run preset:harness -- --html preview.html` renders every block through Lumiverse's real macro engine in thirteen scenarios (standalone, linked, swipe, continue, OOC, commands, full cast, Session Zero overrides, impersonation, Auto planning on a non-reasoning model; Windows paths work too) and runs the display regex over a sample reply, including one rendered by the extension. Add `--ext` to include the extension stylesheet in the preview.
- `bun run golden` lists the golden scenarios (agency, knowledge leak, clock, weather, NPC↔NPC, convergence, safety floor, ledger). Play each in Lumiverse, save the replies as `{ "agency": "…", … }`, and grade them with `bun run golden replies.json`.

### Notes
- Lumiverse's `{{hasExtension}}` currently always returns `false`, so the preset detects the extension through its own `{{almActive}}` macro instead.
- Bun 1.3 rewrites non-ASCII characters in `String.raw` templates as `\u` escapes; the preset sources use a small `R` tag that undoes this.
- Display regex can't read preset variables, so the Boot block mirrors the display settings (dialogue style, tracker view, lead genre…) into chat variables that the display scripts read.
- Lumiverse caches each message's rendered display by its text. The extension asks it to redraw when the extension loads and when a display setting changes, so an update shows without a page reload. The Settings page shows the running version, and warns if the page and the background process disagree.
- Lumiverse leaves hidden messages out of the prompt, so the summaries are placed before the first visible turn rather than in place of hidden ones. Before 1.8.0 they were only put where a covered turn still stood, so with **Hide covered turns** on, no chapter, arc or volume reached the model.
- Recall delivers records two ways. Records the chat's mirror lorebook holds go in as forced entries of that book, and the Prompt Breakdown lists them under World Info. The rest go in the ALMANAC · Recall block. The Recall page marks each injected record *lorebook* or *recall*.
- A lorebook character the story already tracks (the lore's "Buffy Summers" and the story's Buffy) is one person with one record. They are matched on the full name or an alias, or on the first name when only one lore character and one story character have it. When recall picks that person, the mirror entry carries the lorebook entry's text followed by a `[Now]` line, and the lorebook entry is held back that turn, so the prompt gets one card per person. Books in *native* mode are left alone. Before 1.8.1 the prompt could carry the same character twice, and a lore character's aliases could include other people named in its keys (Buffy's entry listing "Buffybot").
- Books made by Lumiverse's [Dream Weaver](https://lumiverse.chat/guides/weaver/) are recognised and get a *Dream Weaver* badge in the Lore tab. The tab also shows how each book's entries were categorised. The book's metadata names its role, but a plain Lumiverse import drops that metadata and a card export folds the rules into `character_book`. So the Weaver's fixed book names and descriptions, and its fixed entry titles, identify the books too.
  - **Rules book.** The *re-anchor* (Core / Drives / Voice) fills in the card character's role, drives and voice. If another book already has that person, the re-anchor adds to that record instead of making a second card. The `Weaver governance · …` entries are sorted into a new category, **always-on rules** (`directive`). They are instructions for the model rather than story facts, so they get no Codex record. Almanac never folds, forces or switches off anything in a rules book, and the book starts in *native* mode.
  - **NPC book.** Each entry is a person named by its title.
  - **Depth book and persona depth book.** Entries are about the character, or your persona, and are linked to that person.
  - **Lore book.** Entries are sorted by their titles into history, groups, rules, customs, objects and places ("The Founding of Saltmere", "The Harbour Guild", "Collection Night", "The Old Lighthouse"). Titles that fit none of these go to the review queue.
  - **World cards.** A Weaver [world](https://lumiverse.chat/guides/weaver/worlds/) is a narrator card named after the place it runs. Almanac recognises it from the Bible slots the Weaver stores on the card (`extensions.weaver.structured`: premise, central tension…) or from its rules book, whose rules are written for a narrator. For a world:
    - The world's re-anchor becomes the Codex record of the place itself, with the card's full premise and its central tension. If the lore book has an entry about the place, the re-anchor adds to it.
    - Chapter summaries call the card's replies the Narrator's, not a person called "Saltmere".
    - The Lore tab shows the world's premise, tension, and, when it has agency, its agenda and holds.
    - **Agency.** The agenda counts only while the rules book's `Weaver agency · agenda and holds` entry is on (the Weaver hub's on/off switch). While it is on, the off-screen simulator treats the world as an actor: between scenes it moves the agenda through consequences, never by announcing it, and never breaks a hold.
    - The NPC book's people, the Weaver's extras and fully woven profiles alike, are Codex people. A character promoted to their own card carries the world's lore book, which is read as above.
  - Before 1.9.0, rules-book entries were filed as story "customs" (and the model classifier could create a person called "Weaver"). The mirror lorebook then carried those instructions a second time. The next lore scan removes those records, and the next mirror sync removes their copies.
- Settings and each chat's setup survive updates and restarts. When the extension is installed for the whole server (operator scope), Lumiverse only opens its storage with a user id, and there is none at startup. Before 1.9.0 that failed read was taken for "no settings yet": the defaults were cached, shown in Settings, and saved over the real file on the next change. The same went for the open chat's setup. Now a read with no user caches nothing, the real files load as soon as a user is known, and a settings change is merged into the file on disk.
- If planning a turn fails, the prompt still goes out, but without the ledger note, recall or mirror entries. When that happens, every Almanac page shows a warning with the error, and the Now widget shows a `!`. The warning clears on the next turn that plans cleanly.
- The tracker's knowledge matrix is built from grid rows rather than a `<table>`, because Lumiverse's message styles restyle tables.
- If the model starts labelling speech as `Name#N|tone: "…"` instead of `[spk=Name#N|tone]"…"[/spk]`, both halves repair it. The preset's rules rewrite new replies, older ones on display and the history the model reads. The extension does the same on display and in the prompt, and tells the model the correct format on the next turn. Left alone, the slip snowballs: correct marks are thinned from older turns, so a leftover label would be the only example the model sees.
