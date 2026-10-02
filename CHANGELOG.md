# Changelog

Extension versions (`spindle.json`), with the preset version where it changed. Update the
extension with **Update** in Lumiverse's Extensions panel; re-import `preset/ALMANAC.json` when
the preset version moves.

## 1.17.4 (2026-10-02)

**Elsewhere: calls say what happened.** A call kept the engine's draft ("Callum set out to keep playing the piano. It left a favour owed.") even after the model told the step, because only news and traces took the told words; a call and the message a missed call leaves now do too, at telling and at a retell, and messages already waiting are repaired from their told step. The telling was also thrown out when it used a word of an off-page secret that the subplot itself says ("Joyce" in "the audit of Joyce Summers' accounts", against the secret about Joyce's letter); a word the card already says no longer counts. Retell a step whose telling was set aside that way to get its words.

## 1.17.3 (2026-10-02)

**Elsewhere: nothing reads as delivered until a reply shows it.** A subplot's card listed waiting calls and messages under "reaches you", so a call the model never rendered (and the "missed call" it turned into) looked like it had happened. Waiting items now sit under **on its way** ("Not in the story yet"), and a separate **reached you** row lists only what a reply took up. One subplot also leaves one message waiting: a later call or message from the same person replaces an older one that hasn't reached the page yet, so they no longer stack.

**Calls and messages reach the story.** A waiting call or a missed call's message used to wait out every charged scene (and the scene's room for news), so it never came. Now one comes in per reply, charged scenes included (not pivotal ones), with a plain ask to show it arriving: the phone buzzing, the name on the screen, the voicemail, and what it says. A missed call's message gets four replies to land instead of two and two days of story time instead of twelve hours. It counts as delivered when the reply names the sender in the same paragraph as the call, voicemail or letter and gives some of what it says, so someone texting in the scene doesn't count as their call.

## 1.17.2 — preset 1.0.14 (2026-10-02)

**Director's notes written as one paragraph** ("SEAL: … GNOSIS: … MINDS: …") are split into their steps, one labelled row each, instead of pouring into the call sheet's two columns, where a quoted phrase became a separate cell squeezed into a narrow column one letter per line. Combined steps ("ROUTE/ANCHOR as above") get one row; any text that isn't a step (a preface like "Routine beat: …") reads as an ordinary line above the rows. Re-import `preset/ALMANAC.json`; existing messages redraw with it.

## 1.17.1 (2026-10-02)

**The Now widget docks.** The window's new dock button tucks it against the nearer screen edge as a slim tab (time, weather, who is here, the change count). Drag the tab along the edge to move it, across to the other edge, or away from the edges to float it again (arrow keys move it too). Opened, the window sits against that edge; the button floats it back where it was. Remembered in this browser.
- **Narrow windows** lay themselves out by their own size: sun and moon join the chips under the sky, the clock scales, the rail scrolls when the window is short, and the window now goes down to 250 px.
- **Nothing is cut off:** the whole place path, the date, the title and the cast's tags wrap instead of ending in "…"; every forecast hour stays. The pill's place and chip no longer have a length cap.
- **The Unspoken dot means unread:** it goes once you have looked at the tab, and which thoughts you read and which seals you broke are remembered per chat, so a reload or a chat switch no longer reseals them or brings the dot back.

## 1.17.0 (2026-10-02)

**The Lorebook Creator is a conversation.** Library › Creator is now a chat with the model. The Almanac asks what you'd like to make (a new lorebook, an update to one you have, an existing book made Almanac-compatible, this story saved as a lorebook, or a check of how a book reads), proposes a plan, revises it with you until you accept, then writes the entries and saves them where you say.
- **The plan** lists every entry it would create, rewrite, convert or switch off, with its category and final title. Change titles and categories on it, remove items, or ask in words ("add the Trio", "keep my titles", "fewer places"). Each revision is a new version, with what changed highlighted and what was removed listed.
- **Sources:** paste notes or lore (long text is kept as a source), or add the chat's character card and your persona.
- **Writing** checks every entry against the format and sends back once what the model must fix. Review shows tokens, recursion links and an activation check; any entry can be edited, rewritten with a note, or removed. Accepting a changed plan again rewrites only what changed.
- **Saving:** into the book or as a new one (a converted or updated copy carries the rest of the book). Updates keep each entry's own settings, retired entries are switched off rather than deleted, only fields that changed are sent, and the page asks before writing into a book you already have.
- **Its own connection:** a selector on the page (and Settings › Lore bridge); empty uses the summariser's.
- Conversations are kept in your extension storage (the last twelve) and survive reloads; a failed model call shows in the conversation with **Try again**.

**Making a book Almanac-compatible** reads every entry and shows what each becomes before anything changes: a category label in its title (or your own title, kept), metadata naming exactly what it is, and a real tier for entries at priority 10, Lumiverse's import default (the book's own `order` is used when it holds a tier). Contents stay as they are, except an *Upcoming* entry told as fact, whose first sentence is rewritten. Every converted entry reads back exactly as before, so chats that use the book keep their Codex records (checked on four real books, 426 entries).

**The Almanac lorebook format** ([design/10](design/10-lorebook-format.md)) replaces the conventions the Creator and the Lore Bridge used to follow, which came from a project ALMANAC isn't part of. Sixteen categories, each with a label, tier, position and opening: the old ones, plus **Relationship** (a Codex bond linked to both people), **Voice** (joins the person's card as their voice), **Belief**, **Secret** (kept off the page) and **Scene** (a playbook from any book: kept from keyword activation, sent as "not history" only when a turn comes close). Metadata is `extensions.almanac.lore`; metadata other tools wrote is still read, and never removed.

**Free-form lorebooks are read properly.** Analysed on the twelve books in the user's Lumiverse, the reader guessed at 475 of 624 free-form entries; now 10. It reads content tags (`RULE:`, `MYTHOLOGY:`, `STORY ARC:`, `THEME:`, `AI DIRECTIVE:`, `CUTOFF EVENT:`), `Name - Role` (Buffy Summers was read as a custom called "The Slayer"), ranks (`Ser Criston Cole`, `Princess Elia Martell`), `A & B - …` relationships, `Name - Speech and Manner`, `What X Knows`, dated titles (`109 AC - …`, `… - 5 Third Moon 281 AC`), titles that tell an event (`Faith Kills Allan Finch`), `House X` and `Order of X`, possessives (`Spike's Crypt`, `Olaf's Hammer`), and first sentences by their head noun ("a senior Watchers Council *authority*" is a person). Only known labels are labels; "Mr." no longer ends a first sentence.
- **The check of a book** now reports how the Almanac reads it (exactly, by shape, or unsure) besides what Lumiverse will do with it, including entries left at priority 10.

## 1.16.4 (2026-10-02)

**Edit a character's aliases and "always" line.** The Cast editor has **Also called** (aliases, separated by `;`; one you take away stays away) and **Always** (the whole line sent every turn; empty it to go back to what the card, lore and story say).
- **What the reader of your messages files, checked.** A trait or item it read stands only as far as your message bears it out: no names the message doesn't use ("Ruth is Xander's daughter"), no one named with a relation in brackets ("Buffy (Gabriel's sister)"), no guesses or notes ("— per Gabriel"), no moments ("recognizes…"), no item without a holder or with an owner the message doesn't give ("Buffy's mom's therapist's contact"). Lines it filed before are checked too.
- **Aliases are names**, never a phrase or a list ("Buffy and Dawn, full, from mall clothing stores").
- **"Holds" is this scene's**: what came to hand now, and what's worn or pocketed. Owning isn't holding; the spot in brackets ("cabinet", "pocket") is kept.
- "Dawn's eyes are wide" is no eye colour; the always line no longer repeats what the appearance says.

## 1.16.3 (2026-10-02)

**Retell any step.** Every beat can be told again, not only the last twelve steps': an older step's card is rebuilt from the beat and its subplot, and its line is rewritten where its step left it.
- **"The model gave nothing usable."** A reply with a bracket before its JSON ("[b1] …") was read as nothing; every model reply is now read past such brackets, and a retelling also takes a bare beat. If a reply still has no telling, the warning quotes its start.

## 1.16.2 (2026-10-02)

**Retell a step.** Each beat on the Elsewhere page has a **retell** button: the model tells that step again, same outcome, new words, through the same checks (if it fails, the step stands and you're told why). It also rewrites the step's unused "reaches you" text. Works for the last twelve steps; steps made before 1.16.2 didn't keep what they were made of.
- **Spike was a "companion".** The model's profile read "companion" as an ally; it now means only an animal, pet or mount, and the model's "companion" or "construct" counts only when the lore agrees. A "…" want or fear is no want. Profiles already saved are read the same way.
- **Tellings set aside for nothing.** A name from the lead's or cast's own lore ("Harvard Law") is no new name. A beat with a twist no longer "repeats" its own engine draft.

## 1.16.1 (2026-10-02)

**The clock follows a time you state.** "When they're finally done, it's 15:15" in your message left the clock at 14:05: only a stated day ("it's day 12") or a calendar date was read, and the reply's `clock: +5m` outranks its own header. Now "it's 15:15", "it's now 3:15 pm" and "the clock reads 15:15" set the clock (not Dawn's "It's 1111").
- A time up to three hours behind the clock corrects it on the same day instead of jumping to tomorrow.
- "The next day. … It is now 7:45" moves the day and keeps 7:45.

## 1.16.0 (2026-10-02)

**Elsewhere: proposed subplots.** The world still finds its own subplots in the story and the lorebooks: open threads, debts, kept secrets, soured or charged bonds, lore forecasts and situations, what drives people, hidden pressures. Now it can ask you first.
- **Settings → New subplots from the story and lorebooks:** *propose them* (the default: each waits for you to accept or decline), *start them on their own* (as before), or *off* (only stories you write).
- **Proposed** subplots appear at the top of the Elsewhere page with what they rest on ("from the forecast …", the grounds) and what they'd replace. **Accept** starts one at once, with its first step. **Decline** and it is never proposed again. A proposal the story moves past (its lead gets a story, or three story days pass) is withdrawn. The sidebar counts proposals as waiting on you.
- With the model telling, proposals are put into the story's words like any new subplot.

**Elsewhere says what happened, specifically.** Beats, endings, proposals and what reaches the scene were written like ledger entries ("Valeria leaned on it a little; this time it worked out", "it got somewhere, at a price: a sleepless night", "Hellions: raid Sunnydale (3/6)"). Now each step is two plain sentences: what happened, naming the real news and people, then where that leaves things.
- **The model** is asked for exactly that, in the register of "Giles heard the news of Buffy's resurrection. He's thinking of going back to Sunnydale." Each card now carries what the story has established about its lead, so the model has the specifics: names, news, what was decided. It never gets anything about your character, or a secret kept from the lead. Arrivals say the news they carry. Premises name what happened and what the lead means to do about it, and a story you write gets wants and fears in natural English.
- **The engine's own words** follow the same shape: "Giles heard that Buffy is alive again. Giles is thinking of coming back to Sunnydale." "Cordelia raised the stakes with Harmony. The other side struck back." "The Witches' Circle concluded the investigation. In the end, the Witches' Circle managed to judge what Willow did." Endings that go badly say what came true ("Giles came back too late"). Proposals lead with the news ("Tara confronted Willow privately after they left…"), and factions read "The Hellions mean to raid Sunnydale, and they're well on the way."
- **Fixed: a lawsuit read as a romance.** "Court option" in a thread made Gabriel's father a *courtship* subplot with Buffy and Dawn. A romance now needs romance words ("dating", "attracted to", "in love"…). A courtship is never seeded with someone whose record calls them a child or a teenager, or between family. "Audit" and "inquiry" now suggest an investigation.
- Fixed: a want made of things read as a verb ("to shoes for Saturday" is now "to get shoes for Saturday"). An archivist's blank ("Unknown — last seen…") became a want. A thread's bookkeeping ("; latest: … stalls: 0") showed in premises. Every proposal's seed card had the same id, so the model's wording reached only one of them.

**Elsewhere: a search doesn't phone the house where its quarry is.** In the Buffy chat, "Spike is searching for Dawn" left Gabriel a missed call from Spike, who has never met him, with news of Dawn, who was in Gabriel's house. A call could reach the scene just because someone in the subplot was in it.
- **A call or a letter is for someone.** It reaches the scene only if the lead knows the player, or knows someone in the scene, and then it says whom it's for ("a call from Spike for Buffy"). A call left for the player by someone who doesn't know them is dropped, and the page says why.
- **Whom a story is looking for stays out of reach until it ends.** "Spike is searching for Dawn": Dawn doesn't carry its news or take its calls, and Spike can't walk into a scene she's in unless the search ends with him finding her (or you bring him in). When Dawn is back on the page, Spike's search is no longer listed as something she did off it.
- **The telling knows it too.** The card tells the model Spike doesn't know where Dawn is, and a step that finds her before the ending falls back to the engine's words.

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
