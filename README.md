# ALMANAC

A living-world roleplay setup for [Lumiverse](https://github.com/prolix-oc/Lumiverse), in two parts that work alone and better together:

- **ALMANAC** — a preset (`preset/ALMANAC.json`). People with private minds, NPCs who act and relate to each other without waiting for you, a knowledge firewall, real time and weather, genre contracts that change what happens, a sealed persona, a step-by-step Director's Pass, and a line-based `<ledger>` of what changed each turn. Its display rules draw living scene plates, voice cards, sealed-envelope thoughts, in-world artifacts and a tracker drawer.
- **ALMANAC Ledger** — a Spindle extension (`almanac_ledger`). It reads each ledger, checks it, and keeps the world: branch-safe state (swipes, edits and forks never corrupt it), chapters that replace old turns, a Codex, knowledge-aware recall, a computed calendar/sky/weather, off-screen life, a lore bridge to your lorebooks, and a lorebook creator. It feeds the verified state back to the model as a short `<ledger-note>` before your message.

The full design is in [`design/`](design/README.md).

---

## Install

### The extension
In Lumiverse, open **Extensions → Install from GitHub** and paste this repository's URL (`https://github.com/valdoix/almanac`). The manifest is `spindle.json` at the repository root, and the built bundles are committed in `dist/`, so no build step is needed. Grant the permissions it asks for:

| Permission | Used for |
|---|---|
| interceptor, context_handler | Planning the turn and injecting the ledger note, recall and chapters |
| generation | Chapter summaries, ledger repair, the knowledge clerk, the off-screen simulator, the sidecar planner (all optional) |
| chats, chat_mutation | Reading the transcript, hiding summarised turns, drawing the tracker drawer as of each message |
| world_books | The per-chat mirror lorebook and the lore bridge |
| characters, personas | Names, per-character defaults, colours |
| tools | Optional recall tools the model can call |
| ui_panels | The floating "Now" widget |

To update later, use **Update** on the extension in the Extensions panel. It pulls the latest commit of the branch you installed from, so if you installed from a different branch, switch to it there first. The version in the Extensions panel (from `spindle.json`) tells you which release you're running.

### The preset
**Presets → Import** and choose `preset/ALMANAC.json`. It brings its own regex scripts (they are bound to the preset, so they switch on and off with it). Open the preset's **variables** panel to set persona mode, genres, intimacy, planning depth and the rest; each setting lives on the block that uses it.

The two find each other on their own: with the extension installed, the preset sends a hidden handshake that the extension removes before the model sees it, and the extension arms itself for any chat that uses the ALMANAC charter.

---

## First run

1. Start a chat with the ALMANAC preset active.
2. With the extension, the **Session Zero** window opens (or run **ALMANAC: Session Zero** from the command palette): genres, tone, who writes your character, romance pace, difficulty, intimacy and hard limits, climate, calendar, start point, trackers and skin. The answers are stored for this chat only and override the preset's own dials.
3. Without the extension, type `/session0` and the model runs the same interview out of character; its answers are saved to the chat by a regex script.

## Playing

- Write as usual. The model ends each reply with a `<ledger>`; you see it as the tracker drawer under the reply.
- Out of character: `((like this))`, `OOC: …` or `[OOC …]`.
- Commands: `/skip 30m`, `/skip until morning`, `/recap`, `/report bonds`, `/report threads`, `/audit`, `/session0`. The **Director's Desk** keycaps in the latest drawer send them in one click.
- The floating **Now** widget (extension) shows the time, weather, place and who is present. Click it to open a small Now window (scene, people and their moods, what is owed, the forecast), and use its button to open the full Almanac drawer. Drag it anywhere; right-click to hide or reset it.
- Swipes get a different take, not a paraphrase: the model is shown how the rejected take opened.
- The **Almanac** drawer tab (extension) opens under a live sky: clock, date, moon, weather and place. The dock at the bottom holds everything. The sun goes to **Now**, and each planet opens its pages on an orbit: **People** (Cast · Bonds with a relationship graph and time scrubber · Knowledge), **Story** (Chronicle · Timeline · World), **Library** (Codex · Lore · Creator) and **Engine** (Recall · Craft · Settings). Under the sky, a switcher moves between the current group's pages, and a planet glows with a count when something needs a look (debts due, lorebook entries to review, unverified turns).
- **Knowledge** (People › Knowledge): who has which piece of information and how it reached them. When something is said aloud, whoever said it and everyone in earshot have it. People only count as not knowing something with evidence: it's kept from them, they weren't there when it came out, or the story says so. Anyone with no record either way is left blank, never marked as not knowing. Animals, forces and anyone asleep know nothing. The model writes `reveal` (something came out), `know` (a guess, deduction or wrong belief), `secret` (who keeps it from whom) and `unaware` lines; the old one-line `know` diaries are still read, split into single facts. The page lists **In play** (secrets and beliefs), **Shared** and **Noted** (one person's passing observations, never sent to the model), with a per-person view. You can correct it: **+ Add a fact**, **delete** a fact (restore it at the bottom), and under **edit** set each person to knows, believes, suspects, doubts, has it wrong, doesn't know, or no record either way. What you set holds whatever the story writes later. The **knowledge clerk** (Settings › Knowledge) is a quiet call after each reply that rewrites untidy knowledge lines cleanly. **Tidy the whole chat** reads every reply the clerk has not read yet, oldest first. It is one generation per reply, shows progress, and can be stopped and resumed. Design: [design/07](design/07-knowledge.md).
- **Summaries** (Settings › Chronicle): choose how much each chapter keeps: *brief*, *standard*, *detailed* (the default: scene by scene, plus where everyone stands at the end) or *exhaustive* (adds sensory texture, tells and voices). "Always keep in summaries" lists anything that must never be dropped. **Rewrite all** on the Chronicle page redoes the unlocked summaries at the current level.

## Skins

Eleven skins, each with a light and a dark palette: **Almanac** (field almanac), **Solar Editorial** (magazine), **Nocturne** (gothic romance), **Botanical** (herbarium), **Prism** (holographic), **Candy** (sticker pop), **Dossier** (case file), **Scriptorium** (illuminated manuscript), **Arcana** (spellbook), **Orbital** (station interface) and **Posy** (florals in pink and green). **Follow Lumiverse** takes its colours from your Lumiverse theme instead.

- Pick one in Session Zero (for this chat) or in **Settings › Look**. Left on Auto, the skin follows the lead genre.
- **Light or dark** (Settings › Look): Auto follows Lumiverse's light/dark mode, or pin either one.
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

The extension's own storage is the source of truth: an event log keyed to message and swipe, so any branch can be rebuilt from the transcript. A **mirror lorebook** named "ALMANAC · ‹chat›" is attached to the chat as a readable, editable projection (summaries or full records, your choice). Edits you make in the mirror are imported back as locked corrections, and the extension never writes to your other lorebooks unless you give a book write permission in the Lore tab. See [design/06](design/06-storage-decision.md).

---

## Development

```sh
bun install
bun run build        # dist/backend.js, dist/frontend.js and preset/ALMANAC.json
bun run typecheck
bun test             # parser, state engine, engines, recall, chronicle, golden checkers, hooks against a fake host
```

- `preset/src/` holds the preset source (blocks, variables, regex suite, scene plate); `bun run build:preset` regenerates `preset/ALMANAC.json` and validates ids, placement bindings, router targets, every regex, and macro balance.
- `LUMIVERSE_SRC=/path/to/Lumiverse bun run preset:harness -- --html preview.html` renders every block through Lumiverse's real macro engine in twelve scenarios (standalone, linked, swipe, continue, OOC, commands, full cast, Session Zero overrides, impersonation) and runs the display regex over a sample reply, including one rendered by the extension. Add `--ext` to include the extension stylesheet in the preview.
- `bun run golden` lists the golden scenarios (agency, knowledge leak, clock, weather, NPC↔NPC, convergence, safety floor, ledger). Play each in Lumiverse, save the replies as `{ "agency": "…", … }`, and grade them with `bun run golden replies.json`.

### Notes
- Lumiverse's `{{hasExtension}}` currently always returns `false`, so the preset detects the extension through its own `{{almActive}}` macro instead.
- Bun 1.3 rewrites non-ASCII characters in `String.raw` templates as `\u` escapes; the preset sources use a small `R` tag that undoes this.
- Display regex can't read preset variables, so the Boot block mirrors the display settings (dialogue style, tracker view, lead genre…) into chat variables that the display scripts read.
- Lumiverse caches each message's rendered display by its text. The extension asks it to redraw when the extension loads and when a display setting changes, so an update shows without a page reload. The Settings page shows the running version, and warns if the page and the background process disagree.
- If planning a turn fails, the prompt still goes out, but without the ledger note, recall or mirror entries. When that happens, every Almanac page shows a warning with the error, and the Now widget shows a `!`. The warning clears on the next turn that plans cleanly.
- The tracker's knowledge matrix is built from grid rows rather than a `<table>`, because Lumiverse's message styles restyle tables.
- If the model starts labelling speech as `Name#N|tone: "…"` instead of `[spk=Name#N|tone]"…"[/spk]`, both halves repair it. The preset's rules rewrite new replies, older ones on display and the history the model reads. The extension does the same on display and in the prompt, and tells the model the correct format on the next turn. Left alone, the slip snowballs: correct marks are thinned from older turns, so a leftover label would be the only example the model sees.
