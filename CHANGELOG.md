# Changelog

Extension versions (`spindle.json`), with the preset version where it changed. Update the
extension with **Update** in Lumiverse's Extensions panel; re-import `preset/ALMANAC.json` when
the preset version moves.

## 1.13.0 — preset 1.0.11 (2026-10-01)

Release audit fixes ([design/08](design/08-release-audit.md)).

**Story safety**
- Turns hidden under summaries come back whenever the Almanac can't put their summaries in the prompt: the chat switched off (or disarmed), the Chronicle off, *Hide covered turns* off. Previously the model lost those turns entirely. New command **ALMANAC: Release hidden turns**, also in Settings › This chat; run it before uninstalling.
- A chat disarms after two turns without the ALMANAC charter, so moving a chat to another preset no longer leaves the Almanac running in it.
- Mirror lorebook entries are stored switched off; the Almanac switches on each turn's picks. The book stays quiet when the chat is off or the extension is gone. Existing entries are rewritten once, a few dozen per sync.
- A fork no longer reads its source chat's mirror book (Lumiverse copies the chat's lorebooks on a fork). No chat's mirror book is ever read as lore. Fork bookkeeping (clerk, checks, repairs, player facts) follows the host's message-id map.
- **Rebuild from transcript** keeps repairs, knowledge-clerk lines, player facts, corrections and simulator events, instead of discarding them with nothing to redo them.
- **Record correction** holds when the reply is regenerated or swiped, and corrections can be listed and removed. Off-screen simulator events survive a swipe too.

**Prompt correctness**
- New **ceiling** on everything the Almanac adds to a prompt (Settings › Prompt size; default 24,000 tokens, 0 for none). Over it, the summaries narrow to the relevant ones, then the oldest go, then the lowest-ranked recall. The Recall page shows the cost and what was cut.
- The preset's macros (`almActive`, `almPlace`, `almVoices`…) are kept per chat. Two chats, or two users of an operator install, can no longer read each other's.
- A previous turn's plan is never reused when planning times out, and a preview's plan never reaches a real generation.
- The returning-player re-entry works while linked (it measured the absence from the message just sent).
- `thread X: closed` resolves the thread; `bridged` and `opened — …` read right.
- A romance ladder's new direction starts where the other direction stands (after mutual "I love you" the note no longer says "Interested (2/7)"). A sealed persona's side stays out of the note.
- Summaries, Codex cards, knowledge lines and simulator events are written in the story's language (the preset's Language setting, now in the handshake).
- Speech in « », „ “, 「」 and British single quotes is recognised.
- VAD values are clamped to their ranges, `(×2)` is a quantity, and a flag restated as "(unchanged)" is one flag.
- Routines with a time ("06:00–09:00 docks") are recognised as schedules again.
- LLM tools reword secrets kept off the page, like recall does.
- The handshake isn't sent when the interceptor permission is missing (nothing would strip it).

**Robustness**
- Background failures (summaries, archivist, clerk, reply check, simulator, mirror lorebook, hiding turns) show in the drawer instead of only in the server log; host toasts fall back to the drawer.
- Saves are written sooner (Lumiverse stops the worker without warning on an update). Two quick settings changes no longer lose one; unknown or mistyped settings are refused.
- Command-palette actions report their errors. The drawer only acts on the user's own chats.
- A failed message read keeps the last good state instead of folding an empty chat.
- Group chats read every member's card (fixed looks) and lorebooks.
- Long chats: faster hashing (renders about a third faster), fewer snapshots (less memory), bounded caches.
- Lorebook Creator: asks before replacing same-titled entries or a persona's lorebook, and refuses to merge into a mirror or Dream Weaver rules book.
- A full mirror card you rewrote stays as you wrote it.

**Interface**
- Settings › Prompt size (ceiling), *Words never used as keys*, and a warning when the chat's preset is older than the extension expects. The Lore tab's unused *permission* control is gone (the Ledger only reads your lorebooks).
- The input-bar command menu no longer types into other text boxes.
- Skins' Google Fonts are off by default for new installs.

**Preset 1.0.11**
- Sampler overrides off: newer models reject temperature and top P sent together.
- Planning channel **Auto** (the new default): native reasoning for thinking models, a silent checklist for others.
- Signal weather: Soft and Cruel now differ from Balanced.
- The handshake carries the story language and the preset version. A typo in the ledger rules is fixed.

**Development**
- CI (typecheck, tests, `check:dist`), a harness that runs on Windows, minified frontend bundle, pinned types, `minimum_lumiverse_version` 1.2.4.

## Earlier releases

| Version | Date | Changes |
|---|---|---|
| 1.12.4 (preset 1.0.10) | 2026-10-01 | A speech mark whose tone carries a stage note still becomes a dialogue block |
| 1.12.3 (preset 1.0.9) | 2026-10-01 | A reply that drops its `[spk]` marks gets a nudge on the next turn; the handshake carries the Dialogue blocks switch |
| 1.12.2 | 2026-10-01 | The reply check looks a flagged past event up in the whole chat, persona, card and lore first |
| 1.12.1 | 2026-09-30 | Bond and item cards wrap; places show by name |
| 1.12.0 | 2026-09-30 | Your own colours for each skin's light and dark palette |
| 1.11.3 | 2026-09-30 | The header's place moves the scene before the cast is read |
| 1.11.2 | 2026-09-30 | Care named in notes treats wounds; one place named two ways is one wound |
| 1.11.1 (preset 1.0.8) | 2026-09-30 | People the roster stops listing leave the scene |
| 1.11.0 (preset 1.0.7) | 2026-09-30 | Playbooks, secrets off the page, reply check, fixed looks, player facts, callbacks |
| 1.10.0–1.10.4 (preset 1.0.6) | 2026-09-29 | The Now widget as an orrery; per-chat persona; notification counts |
| 1.9.0–1.9.3 (preset 1.0.5) | 2026-09-28 | Dream Weaver books and world cards; settings survive restarts; scene header fixes |
| 1.8.0–1.8.2 (preset 1.0.4) | 2026-09-27 | Chapters, arcs and volumes in the prompt; one card per person |
| 1.7.0–1.7.2 | 2026-09-27 | Knowledge fixes and player edits; plan errors shown |
| 1.6.0 (preset 1.0.3) | 2026-09-27 | Witnesses, secrets, gaps and the knowledge clerk |
| 1.5.0 | 2026-09-27 | Knowledge as facts |
| 1.4.0–1.4.2 | 2026-09-27 | Eleven skins; chronicle hierarchy; ladder falls need a cause |
| 1.3.0 | 2026-09-27 | Fantasy and custom calendars |
| 1.2.0–1.2.1 (preset 1.0.2) | 2026-09-27 | Items never become characters; summary detail levels; persona recognition |
| 1.1.0–1.1.2 (preset 1.0.1) | 2026-09-26 | Speech label repair; knowledge matrix; updating from the installed branch |
| 1.0 | 2026-09-26 | First release: preset, Ledger backend and frontend |
