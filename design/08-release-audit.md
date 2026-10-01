# 08 · Release audit (2026-10-01)

Audit of extension 1.12.4 and preset 1.0.10 (commit `95b235f`), against Lumiverse 1.2.4.

How it was checked:
- every backend module and the hot paths of the core engine, the frontend entry and the preset sources were read;
- the code was checked against the Lumiverse source where behaviour depends on the host (forks, command dispatch, quiet generations, getMessages, the Anthropic provider);
- probes were run against the real parser and engine;
- a turn was planned on the real Buffy chat (`6170f171`, 251 messages) with your real storage files, from read-only copies;
- folding was profiled on a 2,510-message chat built by repeating that chat ten times.

## Status after 1.13.0 (preset 1.0.11)

Fixed in 1.13.0, with tests in `tests/release.test.ts` and `tests/hooks.test.ts`: H-1 to H-12, H-15, M-1 to M-18 and the Low list. The details are in [CHANGELOG.md](../CHANGELOG.md). The same pass found and fixed one more bug: `isSchedule` in `src/core/codex.ts` held literal backspace characters where `\b` was meant, so routines with times were never recognised.

Re-measured on the same data:
- **The returning-player note** fires after a three-day gap.
- **The Buffy chat's note** reads *Established (7/7)* in both directions.
- **The ceiling at 12K** trims the Buffy chat's 21.75K to 10.5K by narrowing the summaries from 8 to 4. At the 24K default your current setup passes untouched.
- **Rendering one message** on the 2,510-message chat takes 27 ms (was 41); the warm fold takes 24 ms (was 38). Snapshot memory is about 40 MB after GC.

Still open, because they need the owner or the host:
- **H-13:** a LICENSE needs your choice of licence.
- **H-14:** CI is in `.github/workflows/ci.yml`, but the stable branch (or tags) for users to install from has to be created on GitHub.
- **M-6:** Lumiverse stops the worker with no hook. Saves now wait 150 ms instead of 400 ms, and are flushed if the host ever sends an unload event.
- **M-4:** a cold fold of a 2,500-message chat still takes about 3 s, and a cast or fact edit still refolds from the start. That cost is inherent: those edits apply from the first message.

---

Severity: **High** means data loss, wrong prompt content or something users will hit; **Medium** means a real bug in a narrower path, or a scaling problem; **Low** means polish.

---

## Baseline

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `bun test` | ✅ 223 pass, 0 fail (15,864 expects, 7.4 s) |
| `dist/` and `preset/ALMANAC.json` rebuilt from source | ✅ byte-identical to what's committed |
| `bun run preset:harness` (Windows) | ❌ 371 problems, all false (see H-14). With the import paths fixed: 2, both a missing `almCalendar` in the harness's fake macros |
| Preset footprint (harness, after the fix) | ≈6.3K tokens standalone, ≈6.9K linked, 2.8K impersonate |
| Extension injection, real chat, your settings | note 1,007 + recall 157 + mirror 2,141 + **chronicle 18,232** ≈ **21.5K tokens a turn** |
| Fold, 251 messages | cold 372 ms, warm 8 ms |
| Fold, 2,510 messages | cold 3.2 s, warm 38 ms; **render of one message (`stateAt`) ≈ 41 ms**; about 64 MB of heap for that chat's snapshots |

What's already solid: the branch-safe design (the chat is the event log), operator-scope storage handling, the test suite, reproducible bundles, consistent HTML escaping in the extension's own UI, and the safety floor in the preset.

---

## High

**H-1. Switching ALMANAC off leaves the covered turns hidden, and switching the Chronicle off drops them from the prompt entirely.**
With *Hide covered turns* on (the default), chapters hide their turns through `setMessagesHidden` ([ingest.ts:192](../src/backend/ingest.ts)). Nothing unhides them when:
- the chat is switched off ([bridge.ts:119](../src/backend/bridge.ts));
- the extension is uninstalled or disabled;
- *Hide covered turns* is turned off;
- *Chronicle* is turned off.

In the last case the summaries stop being spliced in too ([hooks.ts:228](../src/backend/hooks.ts), [turn.ts:111](../src/backend/turn.ts)). So the model loses every summarised turn, with no raw turns and no summaries in their place. On a long chat that is most of the story, and nothing says so.
*Fix:* unhide on each of those transitions, or ask first. Add an "ALMANAC: Release hidden turns" command, and an uninstall section in the README.

**H-2. Arming a chat is permanent.**
In `auto` mode, one prompt carrying the `<almanac>` charter sets `meta.enabled = true` for good ([hooks.ts:191](../src/backend/hooks.ts)). Nothing disarms it. If the player tries ALMANAC in a chat and then switches back to another preset, the extension keeps doing all of this under the new preset:
- injecting the ledger note and recall;
- hiding turns;
- syncing the mirror;
- switching off lore entries in *managed* books.

*Fix:* disarm after N prompts without the charter or handshake, or key "armed" to the preset id the interceptor context provides (`context.presetId`).

**H-3. The mirror lorebook turns into an ordinary keyword lorebook whenever ALMANAC isn't steering it.**
Mirror entries are written with `disabled: false` and keywords ([mirror.ts:139](../src/backend/mirror.ts)). The WI interceptor returns early when the chat is off ([hooks.ts:54](../src/backend/hooks.ts)). With the chat off, or the extension disabled or uninstalled, Lumiverse therefore injects mirror entries by keyword: stale state from the old branch, and in *full* mode the `[narrator-only]` lines too.
*Fix:* write mirror entries disabled and let the interceptor's `enabled`/`forced` lists turn the day's picks on. Then the book is inert without the extension. On disable, offer to detach the book.

**H-4. Forks inherit the source chat's mirror book, and with it the source's live state.**
Lumiverse copies the whole chat metadata on a branch, `chat_world_book_ids` included ([Lumiverse chats.service.ts:3336](../../Lumiverse/src/services/chats.service.ts)). `copyChat` gives the fork a fresh mirror of its own, but the source's mirror stays attached. The lore bridge excludes only the fork's own mirror ([lorebridge.ts:48](../src/backend/lorebridge.ts)), so the source mirror is:
- classified as lore (duplicate Codex records);
- keyword-injected in the fork;
- still updated from the *source* chat as that story moves on.

Also:
- The fork's message-id map is rebuilt from index plus content hash, though the `CHAT_FORKED` payload already carries `messageIdMap`.
- `clerked`, `checks`, `repaired` and `playerRead` aren't remapped, so the fork shows no check findings and *Tidy* re-reads everything.

*Fix:* on fork, drop every book whose `metadata.almanac_chat_id` is set from the fork's `chat_world_book_ids`. Exclude any such book from the lore bridge in general. Use `messageIdMap`, and remap all msgId-keyed maps.

**H-5. "Rebuild from transcript" silently throws away knowledge-clerk lines and ledger repairs, and nothing redoes them.**
`rebuild` keeps only `source: "user"` side events ([ingest.ts:368](../src/backend/ingest.ts)). Clerk lines go, but `meta.clerked` still marks those replies as read, so *Tidy the whole chat* skips them ([clerk.ts:102](../src/backend/clerk.ts)). Repairs go and `meta.repaired` is cleared, but repair only ever runs on the newest reply. Every older reply that had no ledger loses its whole contribution to the state.
*Fix:* keep clerk and repair events (they are keyed to message, swipe and hash, so they're branch-safe). Or reset `clerked` and queue a re-repair pass with progress, the way *Tidy* works.

**H-6. "Record correction" disappears on the next regenerate.**
User ops attach to the latest reply's *current swipe* ([ingest.ts:387](../src/backend/ingest.ts)). Regenerate or swipe that reply and the correction is gone. Players correct state precisely when a reply got it wrong, which is when they also regenerate.
*Fix:* attach corrections to a branch-independent overlay that applies from message index N, or to the player's message before the reply.

**H-7. The returning-player re-entry never fires while linked.** *(verified by probe)*
Idle time is measured from the newest raw message ([turn.ts:157](../src/backend/turn.ts)). On a normal turn that is the player's message, sent seconds ago. With a three-day gap before it, `plan.returning` comes out `false`. In linked mode the preset defers to `almReturning`, so the feature is dead there.
*Fix:* measure from the newest message before the trailing player message or messages.

**H-8. Push macros are global, not per chat or per user.**
`updateMacroValue(name, value)` keeps one value per extension ([macros.ts:90](../src/backend/macros.ts)). Two chats, or two users on an operator install, can read each other's `almActive`, `almPlace`, `almVoices`, `almDay` and so on. Any background `afterChange` for chat A between B's context handler and B's assembly overwrites B's values.
*Fix:* make these pull macros keyed by `ctx.chatId` and served from the cached state (no RPC wait), or resolve them in a `registerMacroInterceptor`.

**H-9. A stale plan can be injected.**
The interceptor reuses `lastPlan` when it is under five minutes old and has the same `genType` ([turn.ts:54](../src/backend/turn.ts), [hooks.ts:208](../src/backend/hooks.ts)). If the context handler times out (30 s), the previous turn's note, recall and mirror picks go out as current.
*Fix:* tag plans with the turn they were made for (the last message id plus the path length, or `context.generationId`) and replan on a mismatch.

**H-10. Ledger parser: `thread X: closed` leaves the thread open.** *(verified by probe)*
`replace(/(ed|s|d)$/, "")` ([dsl.ts:496](../src/core/dsl.ts)) misreads three forms:

| Line | Read as |
|---|---|
| `closed` | `clos` → advance (should be resolve) |
| `bridged` | `bridg` → advance (should be bridge) |
| `opened — a new lead` | new, with detail `"ed"` |

*Fix:* map the full words, and add these three cases to `dsl.test.ts`.

**H-11. The romance ladder contradicts itself in the note.** *(verified on the real chat)*
At #194 the model wrote `ladder Gabriel→Buffy: tier 7 — "I love you" spoken`. That direction had never been tracked, so the pace clamp counted up from 0 ([state.ts:845](../src/core/state.ts)) and filed *Interested (2/7)*, while Buffy→Gabriel stands at *Established (7/7)*. Every turn's note now carries `Gabriel Winters → Buffy Summers: Interested (2/7)` after mutual "I love you".
*Fix:* seed a first line in a direction from the reverse direction and the bonds. Treat a large first jump as a statement of where things stand, not a skip. In sealed mode, leave the player's side out of the note.

**H-12. The preset forces both `temperature: 1` and `topP: 0.95`** ([build.ts:37](../preset/build.ts), `samplerOverrides.enabled: true`).
Lumiverse strips sampling parameters only for Opus ≥ 4.7 and `claude-*-5` ([Lumiverse anthropic.ts:78](../../Lumiverse/src/llm/providers/anthropic.ts)). Several newer Claude models reject requests that set both, and OpenAI reasoning models reject `temperature`. Check against the models your users run.
*Fix:* ship with overrides off, or with temperature only.

**H-13. No LICENSE file.** As things stand nobody can legally reuse or fork the code.

**H-14. Every push to `main` is a release to every user.**
Lumiverse installs and updates from the branch HEAD, and there's no CI.
*Fix:* add a `stable` branch (or tags) that users install from. Add a GitHub Action that runs typecheck, tests and the build, then fails if `dist/` or `preset/ALMANAC.json` differ from what's committed.

**H-15. The preset harness is broken on Windows.**
`await import(`${SRC}/src/macros/MacroRegistry`)` loads a second copy of the module, because the forward-slash path doesn't match how Lumiverse's own relative imports resolve. Macros register into one registry and `evaluate` reads the other, so nothing resolves. With `pathToFileURL(join(SRC, "src", "macros", "MacroRegistry.ts"))` the harness runs: 2 problems, both because its `LINKED` fake macros lack `almCalendar`.

---

## Medium

**M-1. Background prompts ignore the story's language.**
Summaries, archivist, clerk, reply check and player-facts prompts are all English ([prompts.ts](../src/core/prompts.ts)), and the handshake doesn't carry the preset's *Language* setting. A Spanish story gets English chapter summaries spliced in where its old turns were, which invites drift into English.
*Fix:* add `lang` to the handshake and "Write in {lang}" to every summarising prompt.

**M-2. Speech detection only knows double quotes** ([dsl.ts:953](../src/core/dsl.ts)).
British single quotes, « », „ “ and 「」 are invisible to:
- knowledge-from-speech (who heard what);
- the unmarked-speech nudge;
- the reply check's "speaking while absent".

**M-3. Injected tokens have no budget.**
On the real chat with your settings, ≈21.5K tokens of chronicle, mirror, note and recall go in each turn. They are added *after* Lumiverse has fitted the prompt to the context, on top of the preset's ≈6.9K. Small-context models will overflow, and cost grows with the story.
*Fix:* a total ceiling (an absolute number, or a share of the connection's context). Roll up into arcs and volumes, or switch to *only when relevant*, when the ceiling is hit, and show the spend.

**M-4. Long chats are slow.** Measured on a 2,510-message synthetic chat built from the real one:
- `fold` re-hashes every message's full text on every call ([branch.ts:117](../src/core/branch.ts)): 26 ms of the 41 ms per drawer render.
- Every snapshot restore deep-clones a ~0.8 MB state.
- Snapshots are invalidated wholesale when the options hash changes ([branch.ts:111](../src/core/branch.ts)), so any cast or fact edit costs a full 3.2 s refold.
- Heap is ~64 MB per long chat's runtime, `ledgerFor` keeps up to 24 chats, and the store cache ([store.ts:148](../src/backend/store.ts)) is never evicted.

*Fix:* memoise content hashes by (id, swipe, length). Restore snapshots copy-on-write, or clone lazily. Bound the store cache.

**M-5. Concurrent refreshes rewrite one shared `ChatLedger`.**
`planTurn` doesn't go through `serial()`. During a swipe, the render processor's `L.refresh()` ([hooks.ts:327](../src/backend/hooks.ts)) can swap `path`, `records` and `index` in the middle of a plan. The excluded trailing reply comes back, so recall can surface records that the rejected swipe created.
*Fix:* make `refresh` return an immutable snapshot that planning reads from.

**M-6. Pending writes are lost on unload or update.**
Saves are debounced (400 ms for meta, [store.ts:202](../src/backend/store.ts)), and the `SPINDLE_EXTENSION_UNLOADED` handler does nothing ([index.ts:137](../src/backend/index.ts)).
*Fix:* flush every pending debounce on unload.

**M-7. Two quick settings changes can lose one.**
`saveSettings` reads, merges and writes without a lock ([store.ts:268](../src/backend/store.ts)).
*Fix:* `serial("settings:" + userId, …)`.

**M-8. Command handlers can throw unhandled rejections.**
The handlers are async with no try/catch ([index.ts:106](../src/backend/index.ts)), and Lumiverse only catches synchronous throws ([Lumiverse worker-runtime.ts:4987](../../Lumiverse/src/spindle/worker-runtime.ts)). On an operator install `userFor(chatId)` can still be empty, and the storage read then throws.

**M-9. Dead controls and settings.**
- Lore book **permission** (read / overlay / write) is stored and shown but never enforced or used, yet the README promises write-back.
- These settings are never read: `controller`, `controllerConnection`, `semanticSource`, `socialTicks`, `rumors`, `sidecar`.
- `stopList` has no UI.

**M-10. The LLM tools bypass two protections** ([tools.ts:55](../src/backend/tools.ts)).
`ledger_recall` and `ledger_lookup` skip the off-page redaction that recall and the mirror apply. `ledger_who_knows` ignores narrator-only scope.

**M-11. The off-screen simulator can lose its work or stop running** ([ingest.ts:260](../src/backend/ingest.ts)).
Its ops are keyed to the latest reply's swipe, so a swipe drops them while `lastSimAbs` has already moved on, and nothing re-simulates that stretch. A clock moved backwards (the player's "it's day 12") stalls the simulator until the story passes the old time.

**M-12. The lorebook Creator overwrites without asking** ([creator.ts:164](../src/backend/creator.ts)).
- *Attach to persona* replaces the persona's existing lorebook.
- *Merge* overwrites entries with the same title, with no backup or confirmation.
- Either can target the mirror or a Weaver rules book.

**M-13. Group chats are only half supported.**
Only `chat.character_id` is read ([ledger.ts:67](../src/backend/ledger.ts)): one card's traits and books. When it's empty, names are reloaded on every refresh.

**M-14. State quality issues seen in the replay.**
- Furniture filed as held items: `Wardrobes (×2)` held by Buffy, from "Buffy and Dawn".
- Duplicate flags: `malnourished, malnourished (unchanged)`.
- VAD outside the documented ranges and never clamped: `quiet-gleeful V-3 A7`.

**M-15. The frontend bridge never checks who owns a chat.**
On operator installs, `getState` with another user's chatId builds a view from that user's messages ([bridge.ts:84](../src/backend/bridge.ts)). Unguessable UUIDs limit the risk.
*Fix:* `host.chats.get(chatId, userId)` before acting.

**M-16. Failures are invisible.**
- There are 64 silent catches.
- When `host.toast` is unavailable, the toast fallback only reaches the browser console ([frontend.ts:413](../src/frontend.ts)).
- A failed `setMessagesHidden` still records the turns as hidden.

**M-17. The view is heavy and is pushed on every change.**
It carries every lore entry's hash ([view.ts:201](../src/backend/view.ts)), 12 feed entries of about 60 items each (156 KB of your real `meta.json`), and full Codex bodies. `meta.json` is rewritten on every prompt.

**M-18. Design docs describe features that don't exist.**
The controller, predictive prefetch, overlay and write permissions, and Memory Cortex integration ([05](05-extension-ledger.md), [06](06-storage-decision.md)) were never built. Mark them as intent, or move them to a roadmap.

---

## Low

- The handshake reaches the model when the *interceptor* permission is denied, because macros still register and `almActive` reads `no`.
- Preset typo: "taken to be gone.look is" ([blocks-craft.ts:77](../preset/src/blocks-craft.ts)).
- *Signal weather*: Soft, Balanced and Cruel produce identical text; only Off differs ([blocks-core.ts:92](../preset/src/blocks-core.ts)).
- The default planning channel, *native*, asks non-reasoning models to "run this pass in your reasoning". They write it into the reply instead.
- `insertIntoComposer` falls back to the first `<textarea>` on the page, and inserts `/recap` when the context menu fails ([frontend.ts:502](../src/frontend.ts)).
- `plainProse` strips only a bare `<ledger>` (not `<ledger …>`), and leaves an unclosed `<think>` in place ([util.ts:154](../src/core/util.ts)).
- Parse-cache and chain keys use a 32-bit FNV hash (the length suffix lowers, but doesn't remove, the collision risk).
- `CHARACTER_EDITED` doesn't reload the card text, so traits from an edited card wait for the next chat switch.
- Importing a user edit to a mirror entry in *full* mode copies the rendered card into `summary`, so the next render duplicates its fields.
- Bundles aren't minified: `frontend.js` (313 KB) loads on every page.
- `@types/bun` is pinned to `latest`.
- `minimum_lumiverse_version: 1.1.6` is untested; the code was only exercised on 1.2.4.
- Google Fonts load by default (`fonts: true`), which sends every visitor's IP to Google.
- `.claude/`, which holds worktrees with full copies of the repo, isn't in `.gitignore`.
- There's no CHANGELOG; the version history lives only in commit subjects.

---

## Proposed additions — extension

1. **Doctor page.** Show the permissions granted, preset handshake seen (with its version), storage reachable with a user id, summariser connection (test call), mirror status, background-process version, the last planning error, and hidden-turn count against covered turns. One button copies a redacted diagnostics bundle for bug reports.
2. **A clean off switch.**
   - Per chat, "Turn ALMANAC off" asks whether to unhide covered turns, detach or disable the mirror, and clear the `alm_*` chat variables.
   - A global "Prepare to uninstall" does the same for every chat.
   - Auto-disarm after N turns without the charter (H-1, H-2, H-3).
3. **Token budget and cost meter.**
   - Each turn: tokens injected by layer, measured against the connection's context.
   - A hard ceiling with automatic roll-up.
   - Background calls per reply (clerk, check, player facts, simulator, chronicle, archivist) with their token use. Your current settings make 3–5 extra model calls per reply.
4. **Backup, export and import** of a chat's Almanac (meta, side, codex, chronicle) as one file, for moving servers, restoring after a bad rebuild, and bug reports.
5. **Undo for destructive actions**: Rewrite all, Rebuild, deleting a fact, a chronicle edit. Keep the last few versions of `chronicle.json` and `codex.json`.
6. **A Rebuild that rebuilds** (H-5): keep or redo repairs and clerk lines, with progress and a stop button.
7. **Corrections that survive swipes** (H-6), and a list of active corrections where each one can be removed.
8. **Per-chat macros** (H-8).
9. **Use what the host already provides**:
   - `context.excludeMessageId` and `generationId` for planning;
   - `context.activatedWorldInfo` instead of a second `getActivated` call;
   - `context.signal` and `interceptorDeadlineAt` to abort or bound the sidecar;
   - `CHAT_FORKED.messageIdMap`;
   - `context.presetId` for arming.
10. **Versioned `meta` and `settings`** with migrations. Validate every frontend patch (the lore `mode` and `permission` values are stored unchecked today).
11. **A language-aware pipeline**, plus a version check between preset and extension: the handshake carries `v` and `lang`, and the drawer warns when the preset is older than the extension expects.
12. **Group chat support**: every member's card traits and lorebooks, and the speaker taken from each message.
13. **"Save to lorebook"** (the write permission), or remove the control.
14. **Mirror entries inert without the extension** (H-3), and fork-safe mirrors (H-4).
15. **Performance work** (M-4). A view that sends diffs, or only the active page's data (M-17).
16. **A Getting started card** in the drawer for a chat with no ledger yet: what to set, which connection to pick for summaries, and what costs extra.

## Proposed additions — preset

1. **Sampler overrides off**, or temperature only (H-12).
2. **A Lite profile** of about 3K tokens: lite ledger, lean pass, a short Cast Engine, no hazard deck. For small-context or cheap models. Also use Lumiverse `modelProfiles` (empty today) for model-specific defaults instead of only the regex-gated Errata block.
3. **The handshake carries `v="1.0.10"` and `lang`** (M-1, extension item 11).
4. **Planning channel *Auto***: native reasoning when the connection reasons, otherwise the silent checklist.
5. **Implement Signal weather's levels** (weighted picks for soft and cruel), and fix the "gone.look" typo.
6. **Single quotes, « » and 「」** in the display regex and the `[spk]` repair scripts (M-2).
7. **Listing polish**: a cover image, and a disabled "Read me first" block with a three-step setup. The preset's `description` should say what the extension adds.
8. **Graded golden scenarios**: `bun run golden` with an LLM judge, run before each release instead of by hand.

## Release checklist

- [ ] LICENSE (H-13)
- [ ] `stable` branch or tags for users; CI with typecheck, tests, build and a dist check (H-14)
- [ ] Fix H-1 through H-12
- [ ] Harness: fix the Windows imports and add `almCalendar` to `LINKED` (H-15)
- [ ] README: Uninstall, Troubleshooting, Privacy (fonts, what is stored where), Costs (background calls), English-first heuristics, screenshots
- [ ] `.gitignore`: `.claude/`
- [ ] Minify `dist/frontend.js`; pin `@types/bun`
- [ ] Test on the minimum Lumiverse version, or raise it to 1.2.4
- [ ] CHANGELOG.md
- [ ] Mark the design docs as intent where they run ahead of the code (M-18)

## Suggested order

1. **Safety and data loss:** H-1, H-3, H-4, H-5, H-6, M-6.
2. **Wrong prompt content:** H-2, H-8, H-9, H-11, H-10, H-12, M-1.
3. **Release infrastructure:** H-13, H-14, H-15, README.
4. **Scale:** M-3, M-4, M-5, M-17.
5. **Features:** Doctor, clean off switch, token and cost meter, backup and export, Lite profile.
