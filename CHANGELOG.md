# Changelog

Extension versions (`spindle.json`), with the preset version where it changed. Update the
extension with **Update** in Lumiverse's Extensions panel; re-import `preset/ALMANAC.json` when
the preset version moves.

## 1.15.1 (2026-10-01)

**Elsewhere: your own stories move, and make sense.** In the Buffy chat, two stories written on the Elsewhere page sat still through three "Move the world a step now" presses and a nudge. The one step that happened was told in the engine's words ("Valeria leaned on it a little"), even with the model telling.
- **A story you write starts at once.** Its first step happens when you press Start it. With the model telling, the model first reads your words once: the kind of story, what the lead is after, what they fear, who is in it, and how secret it is.
- **The kind comes from what the lead does.** "Valeria tells the Witches' Circle about Willow's dark magic; the Circle holds an investigation" is now an Investigation, not Valeria's Decline. What someone talks *about* is the topic, and a decline belongs to whoever has it. Groups a story names (the Witches' Circle) join its cast and grounds. Your stories can reach the scene unless your words keep them secret.
- **Nudge makes the next step happen now**, even out of the lead's hours, at a disadvantage (a vampire by day). **Move the world a step now** counts the whole step, and moves something if anything can, your stories first. Both say in a toast what moved, or why nothing did.
- **Each subplot says when its next step can come, and why it waits** ("Spike keeps night hours; not before 19:00").
- **Edit** can now change a subplot's kind and how secret it is.
- **The model's telling is kept when it only labels the outcome differently** (a win told as "cost"). Only an opposite outcome falls back to the engine's words, and the log keeps what the model wrote. Each card now gives the model the subplot's last steps, what its grounds say, and "this is its first step", so a telling continues its story.
- **The engine's own words read as one step:** "and it went well" instead of "this time it worked out", and a decline names what is leaned on ("dark magic").
- **Fixed: Bring in, Accept · Soften · Keep it for the page, premise edits, twist cast additions and secrets slipping never took effect.** The first field of an `arc set` line was read as a label and dropped.
- Fixed: stems like "investigat", "conspir", "attract" and "obsess" never matched ("investigation" didn't suggest an Investigation). A Vampire Slayer no longer keeps vampire hours. Bonds are no longer read as lore situations that seed subplots, and wants copied from archivist notes ("…suggests she wants forgiveness") read as wants.
- With none of the world's own subplots running (only yours), the world seeds at once. A step seeds at most one new subplot of each kind.

## 1.15.0 — preset 1.0.13 (2026-10-01)

**Intimate scenes: more explicit, and Extended means extended.** In a replayed chat (Explicit · Crude · Extended), the model read "Length: extended" as the length of one reply and took each act from its start to orgasm and afterglow in a single reply, with half the prose spent on metaphor and memory.
- **Explicit** now asks for the act in full on the page: bodies and acts named outright, and the mechanics shown (positions, rhythm, depth, wetness, taste, sound, mess). Metaphor and inner monologue add flavour but never replace the act. No refrain carries over from one reply to the next. Each Vocabulary setting now says what it means (Tasteful still names things; Plain uses the everyday words; Crude is filthy and welcomes dirty talk).
- **Scene length** now counts replies, not reply length, and each setting sets a pace. Brief: the act may peak in one reply. Standard: one phase per reply. Extended: one beat per reply, a few minutes of story time, ending mid-act. Climaxes are held back until the player's message brings them or asks. A climax doesn't end the scene; it goes on until the player moves the story elsewhere, and a reply never closes in afterglow the player didn't write. The Director's Pass names the beat, and the ledger keeps `mode: intimacy` until the player ends the scene.
- Phases are now a ladder climbed across replies, with undressing and foreplay as their own rungs. Under Explicit, a single minute of the act can fill a reply.
- Pace lines appear only under Sensual or Explicit, so Fade to black is unchanged.

**Scene plates: every place drawn, and the Ledger draws them.**
- The Ledger's render step now draws the scene header itself, before the display regex, so the preset carries no place art (it stays about 350 KB) and no macro parsing happens per header.
- **32 outdoor kinds** (forest, jungle, marsh, garden, plains, mountain, tundra, desert, canyon, volcano, sea, ship's deck, coast, harbour, lake, river, bridge, tropical island, four eras of city, town, village, two eras of rooftop, castle, ruins, graveyard, camp, underground, space) and **26 rooms** (tavern, library, bedroom, chapel, great hall, lab, train, home, tent, kitchen, office, café, nightclub, classroom, hospital ward, cell, ship's cabin, starship bridge, car, theatre, shrine or dojo, attic, cellar, greenhouse, shop, bathhouse). Each has four drawn variants: procedural SVG silhouettes, lit windows, water with reflections, and room props.
- A seed from the 📍 path picks the variant, a mirror, a tint, a frame and an offset, so one place always looks the same and two places of a kind differ. A seed from the title and the hour picks one of five title layouts and a sky accent (birds, bats, god rays, balloons, cirrus, petals or leaves, mist, the evening star, shooting stars, aurora, the Milky Way, fireflies, sky lanterns, a comet). Storms bring lightning, and sun showers bring a rainbow.
- Era from the date's year (else the genre) picks skylines and the default room. Genres add atmosphere: a blood moon and a gnarled branch for horror, a ringed planet for sci-fi, a floating isle for fantasy, embers, bokeh, grain and grades.
- Motion: a slow Ken Burns drift, lighthouse beams, volcano plumes, a waterfall, panning views from trains and cars, a ship that sways, swinging lanterns, club lights. All of it stops under reduced motion.
- Without the Ledger, the preset's plate keeps the new sky, weather, accents and genre styling over one town or one room.

## 1.14.0 — preset 1.0.12 (2026-10-01)

**Elsewhere: the world off the page** ([design/09](design/09-elsewhere.md)). It replaces the off-screen simulator.
- **The whole cast lives.** Everyone the story knows has a life off the page, including people from the card, the persona and the lorebooks who have never appeared. Each has a standing (here, away, captive, changed, dead, a pet), a whereabouts, a reach and ties to others.
- **Subplots** in 15 kinds (return, scheme, decline, threat, rift, courtship, investigation…). Each grows from what the story or lore already holds, and names its grounds.
- **Seeded dice** decide when a subplot moves and how it turns out, with twists drawn from what exists. A Motive · Knowledge · Access · Means · Time gate means nobody acts on news they haven't heard, at an hour they're asleep, or from a country away.
- **News travels person to person** along ties, sometimes garbled, never from a secret's keeper.
- **The engine writes the mechanics.** A model call (optional) only tells them, and a validator checks every sentence.
- **Off-page events reach the scene by a route:** a carrier, a call, a sound, a trace, an entrance. The note's `[ELSEWHERE]` lane replaces `[ARRIVED]`. People back on the page carry what they did off it.
- **A new Elsewhere page** (Story group), with Director and Surprise views. You can hold, nudge, bring in, edit or drop a subplot, give someone a story, leave someone out or wake them, and decide irreversible endings.
- **Settings:** Elsewhere mode (off · quiet · living · restless; the old simulator switch carries over as living), Telling (model or engine), Canon gravity, and Irreversible endings.

**Fixes found by replaying a real chat** (these broke the old simulator):
- Arrivals at a nested place ("Winters Residence › kitchen") never reached the scene (11 of 12). Old arrivals now expire instead of all arriving at once.
- Clock lines written with arrows (`2/6 → 3/6`, `Hellions 3/6 → 4/6:`) set the clock backwards or made a second clock. They now read as the count reached, on the same clock.
- A thread restated with nothing new ("no change overnight", "open; latest: …; stalls: 0") counted as an advance and reset the stall rule.
- Lines from the simulator and the player's corrections at the same anchor each keep their own source. Off-page lines stay out of the reply's change list and out of the model's "your ledger was corrected" note.

## 1.13.1 (2026-10-01)

- Settings: the Summariser, Clerk, Check, Simulator and Planner connections are picked by name from your Lumiverse connections (name, model, default marked) instead of typed as ids Lumiverse never shows. Saved ids carry over; one whose connection is gone shows as missing. If the list can't be read, the id box comes back.

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
