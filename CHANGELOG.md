# Changelog

Extension versions (`spindle.json`), with the preset version where it changed. Update the
extension with **Update** in Lumiverse's Extensions panel; re-import `preset/ALMANAC.json` when
the preset version moves.

## 1.29.1 (2026-10-06)

**What they're wearing is editable too.** The Cast editor's *How they are now* has **Wearing, how they look now**. What you write there is your word, as if you'd said "she's wearing…" in a message: the next reply can't swap it, and a later reply that changes clothes still does. Empty it to take it away.

## 1.29.0 (2026-10-06)

**Needs, mood and wounds are editable.** The Cast page's **Edit** now has *How they are now*: the mood's name, its Mood, Energy and Control dots (1–5), and hunger, thirst, fatigue, pain, arousal, intox and any other meter the story keeps (0–5, or — for not tracked). Below them, each wound can be renamed, made worse or better, marked treated, given a note or taken away (✕), and **Add a wound** adds one. Only what you change is saved, and it holds from the latest message on: the story moves it on from there, so hunger still builds and wounds still heal. A wound you take away counts as healed, so an old line restating it doesn't bring it back, and one you make better isn't pushed back up by the story repeating how bad it was. An edit made on the last reply holds for its regenerated takes too.

## 1.28.1 (2026-10-06)

**Long thoughts show in full.** Thoughts in the Now window's Unspoken tab were cut off at 600 characters, so long ones stopped mid-sentence. They are now kept up to 4,000 characters. In chat 5b751a70, Graham's 910-character thought and Shauna's 965-character thought now show in full.

## 1.28.0 (2026-10-06)

**Continuity you used to keep by hand.** Ten additions, each aimed at something corrected in long chats: day counts, eye colours, AU rules against canon, keepsakes, running jokes, and regenerations for spoilers and invented events.

- **Canon cutoff** (Settings › This chat). Say where the story stands in its source ("Buffy, season 3, before Graduation"). Then list the names, events and reveals from later in the source, or press **Suggest** to have the model list them. The note says where the story stands every turn (`[CANON]`). The check of each reply flags any of those words that the story hasn't reached; a term already in the chat or on the card counts as reached. With the model read on, the check also looks for later canon the words don't catch.
- **Swipe autopsy** (Settings › Knowledge › *When you swipe past a reply*). Once you answer the take you kept, the takes you swiped away are compared with it. The rules keep the slips only the rejected takes made: a secret named, the dead speaking, the wrong eyes, a term from past the cutoff. A quiet model read compares the takes for invented events, spoilers and characters knowing too much, and ignores taste. Each finding waits on the Recall page as a lesson to **Keep** or **Dismiss**. Kept lessons go to the model every turn (`[LESSONS]`) and into the model check. You can edit them, and add your own.
- **Filed from your message.** What the Almanac reads from your own messages ("THIS IS DAY 26", "Cersei has green eyes", what someone wears, `((truth: …))`) shows in a notice and on the Now page, each line with **Undo**. The Recall page lists everything read from your messages; undone lines can be restored. An undone line stays out of the story through swipes and rebuilds.
- **Belongings and rooms.** Things have an owner: the name's owner ("Cersei's locket"), the first person to keep, wear or buy it, or whoever it's given to; lending doesn't count, and a shard picked up off the floor isn't anyone's. Each person has rooms, read from the story's places ("Cersei's former chambers") or set on the Cast page. In someone's room, the note mentions what they keep there ("Kept here: Locket (Cersei's, in her trunk)"). Cast cards show **Rooms** and **Belongings**; the World page's Things show whose each thing is.
- **Callbacks when they're due.** A running bit is offered once it hasn't come up in three scenes and a dozen messages. It's offered only when the moment can hold it (company, downtime, travel, a tender scene; never a fight or a pivotal turn), two at most. When a bit last came up is read from the prose too, so a joke the reply simply makes counts as used. The World page marks bits that are due ⟳.
- **Promises with due dates.** Promises are read from what people say: "I'll call you tomorrow", "meet me at the Bronze at nine", "I'll be back in two hours", "I promise I'll make you pancakes tomorrow". Each needs a time to keep it by. Wishes ("can't wait to see you tomorrow"), habits ("every morning"), deferrals ("we'll deal with it tomorrow"), questions and cut-off lines don't count. A promise is *due* when its window opens. A meeting is *kept* when both people are in the scene inside the window. It's *broken* when the one it was made to waits at the named place and the other never comes, when a ledger line says so (`promise Xander>Buffy: call her | kept`), or when you mark it on the Now page. If the story never says, it lapses quietly. Keeping one raises trust in the person it was made to; breaking one lowers trust and adds resentment (never for a sealed persona). A broken promise can seed a rift in Elsewhere.
- **Secret exposure** (Knowledge page). Each secret kept from someone gets a clock from 0 to 6. It fills with how far the secret has spread, who suspects it, rumours that echo it, and who is in the room with someone who knows. Each secret also lists who is closest to finding out and why ("suspects it", "close to Willow, who knows"). A secret at 4 or more, kept from someone present, goes in the note as close to coming out.
- **Days that come round** (Timeline page, or `((birthday: Buffy, 19 January))` and `((every Friday: patrol night))` in a message). Birthdays, feasts, weekdays, the full or new moon, a day of each month, or one story day. Dates follow the story's own calendar ("Second Moon 7"). Deaths bring their own week, month and year anniversaries. The Timeline shows the next six weeks. The note says what today and tomorrow hold, Elsewhere's subplots learn the day (a feast fills the town; a birthday stands for the steps that have that person in them), and the Now page shows it.
- **Conditions with a course.** A cold, flu, a fever, a stomach bug, a migraine, a concussion or a hangover runs for its time and ends; a curse or a poison lasts until the story ends it. How long depends on the person's kind: a vampire, an angel or an android doesn't fall ill, and a Slayer gets over it sooner. Drink touches a Slayer less and a vampire hardly; an android not at all. A drunk night's sleep ends in a hangover. The note says "a cold (day 2 of about 6, easing)", and a cold restated the day after it ended doesn't come back unless the story says it did.
- **Character journals** (Settings › Knowledge). After a night's sleep, the one or two people who carried the day write a short diary entry in their own voice, from what they saw and their unspoken thoughts. Each entry is a quiet model call. Read them on their Cast card; **Write now** writes one on demand. They never go in the prompt, never cover what the character didn't see, and never name a secret kept from them. A sealed persona doesn't keep one.

Validated by replay of 6170f171 (Buffy), 5b751a70 (Jackie) and 9bd7a38d (Cersei, 2,645 messages). The inbox shows every date and eye colour the player stated, and it shows misreads ("Daeron wears at court") that can now be undone. Promises went from 13 false finds in the Cersei chat to three real ones, and "We'll deal with it tomorrow" no longer cools Buffy's trust. A restated death no longer makes ten anniversaries.

## 1.27.3 (2026-10-05)

**Wounds tended in plain words count as treated.** "palms (tended, taped, his ointment)" left the palms untreated: care was only bandages, stitches, sutures, splints, gauze or "treated".
- Care now includes tended, taped, ointment, salve, antiseptic, disinfected, iodine, band-aid, first aid, patched up and cauterised. "Tending the fire" and "taped the window" don't count.
- Care in brackets after a body part is for that part only. Before, "taped" inside "palms (…)" would have counted for every wound, ribs included.
- Forehead and hairline are places on the body: "cut (hairline)" is a head wound.

## 1.27.2 (2026-10-05)

**"To review" stays sorted.**
- **The model's sorting is kept.** Every time the lorebooks were read again (each chat open, **Read them again**), the review list was rebuilt from scratch and the entries the model had sorted came back. Its reading is now kept with the entry and used until you change the entry. Sorting and a rescan no longer run at the same time, and a sort where the model gave no usable answer says so instead of "Classified 0 entries".
- **Rules-and-depth books are read as the Weaver's.** A card's own book with the rules and the depth together ("Jackie Taylor — rules & depth", entries "Re-anchor", "Governance · …", "Depth · …") was guessed at as story texture. The re-anchor and rules are now pinned for the host, as in a rules book. The depth entries are read like a depth book's: scenes ("When James Comes Out Into the Snow") wait as playbooks, dated memories ("The Dock, Fourth of July 1994") are history, and the rest is about the character. The book is no longer forced to Native, so its depth entries don't fire on everyday words like "Shauna" every turn.

## 1.27.1 (2026-10-05)

**Injuries recover on their own.** Wounds used to sit at full strength until a fixed day, and only healed while the person was in the scene.
- **A step at a time:** critical → serious → wound → scratch → gone. A treated wound is a scratch after three days and gone after five; a scratch or bruise clears in two; a serious wound is a plain wound again after a week. Untreated takes half as long again, broken bones three times as long, and a Slayer, vampire or anyone else who heals fast is quicker, as before. A critical wound nobody treats doesn't mend. A serious wound leaves a scar.
- **Off the page too:** someone who has left the scene keeps healing.
- **The story can't undo it by repeating itself.** A body line restating "left arm, wound" doesn't push a mending wound back up, and doesn't bring back one that healed in the last week. Only a wound worse than it ever was, or words like "reopened", "infected" or "worse", sets it back.
- The note and the cast tags say **healing** while a wound is mending.

## 1.27.0 (2026-10-04)

**The Soundtrack picks songs whose lyrics fit the scene.** A mood search finds songs that sound right; now their words count too.
- **What the scene is about.** Each scene is read for its themes as well as its mood: comfort, love, desire, heartbreak, missing someone, loss, loneliness, fear, fighting, winning, partying, hope, secrets, regret, getting away, night, family, magic, the past, self-doubt. They come from the mood (a tender scene is about comfort and love), from the last exchange (a lie and a secret said twice make it about secrets), from what the people present feel, and with **Engine + model** from the model's reading of the scene. What the page says can't pull a scene against its mood: a sex scene with a burial dress on the floor is still about desire. The Now card shows **About …**.
- **What a song is about.** The best twelve songs a pick finds have their lyrics read (from LRCLIB, free, no key) into how much of the song is about each theme. Songs about the scene rise; songs about what works against it sink: a breakup song or a club anthem in a tender evening, a victory lap at a graveside. A song that names the scene's rain or smoke rises a little. A song with no lyrics found, or an instrumental, is left where it was. The **Why** line says what it heard ("lyrics about comfort", "but lyrics about heartbreak").
- **Searches ask for it too:** the lead genre with the scene's main theme ("pop missing you"), and every other favourite artist with it.
- Only what a song is about is kept (half a year; two weeks for a song with none found), never the words. A pick waits at most six seconds on lyrics; songs it didn't reach are read for the next one. Off with **Songs whose lyrics fit the scene** under How it plays, and never for an instrumental taste.

## 1.26.0 (2026-10-03)

**Subplots bear on each other.** Two subplots in Elsewhere are tied when one is about someone the other has in it.
- **What is taken stays taken.** A step that takes something from someone ("took Willow's magic", "Willow's magic is gone", "stripped of her powers") holds for every subplot with that person in it, until a step gives it back. What is only meant or nearly done ("sent to take away", "stopped short") doesn't count.
- **The telling keeps in step.** Each step is told knowing what the tied subplots did last and what stands about its people, and follows from anything new since its own last step. A telling where someone uses magic that was taken is set aside.
- **Subplots pull on each other's dice**, by one at most: one working against someone makes that person's next step harder when it goes its way; one on their side helps when it goes well, and suffers with that person's own setbacks.
- **An ending shakes the subplots tied to it:** their next step comes sooner, with the stakes raised.
- **The engine's own words follow:** a decline whose means were taken is the want of them ("Willow went looking for a way to get the magic back").
- **Tied to** on each subplot card in Elsewhere: what stands, each tied subplot (which side it's on, its latest step) and what it does to the next roll.

## 1.25.0 (2026-10-03)

**Factions are yours to edit, like the cast.**
- **Groups are never people.** A group named where a person goes ("bond Valeria>The Witches' Circle", "journal Council") no longer adds a character. The line is set aside and the group is kept as a faction. A group is a name ending in Council, Circle, Coven, Order, Guild, Cult, Society, Brotherhood and the like ("the Order of Aurelius" too; "Master of the Order" is still a person), or any faction's name.
- **"Council back-pay" is the Council's back-pay.** A faction name with its business run on after it is split: the faction is the Council, its clock is "back-pay", and the old name still finds it (an Elsewhere subplot led by "Council back-pay" included).
- **Factions on the World page** (in place of Clocks): add a faction, rename it, give or take away other names, merge it into another (**Same faction as…**, undone with ✕), or delete it (its clocks go and lines about it are dropped; **Deleted factions** brings it back). Lines naming it any way it's known go to it, and none of its names is ever taken for a person.
- **A faction** on a cast card turns someone the story mistook for a person into a faction.
- Reputation with a faction goes under the faction's name, whatever the line calls it.

## 1.24.1 (2026-10-03)

**The Soundtrack keeps playing.**
- **It never stops on its own.** While the Almanac is choosing, a song that ends with nothing after it (the queue ran out, or nothing is loaded) is followed by another for the scene. That includes a song you played yourself. A pause mid-song stays paused, and Stop choosing stays quiet. The player is checked just after a song is due to end, so the gap is short. A search that finds nothing waits a minute before it tries again.
- **Only the Almanac's picks** (How it plays). YouTube Music's autoplay and its auto-made mixes never get a turn. A song you choose in YouTube Music still plays to its end. Then the scene's music follows it: it's queued behind your song, and replaced at once if the mix gets in first. Without the option, your song's mix plays on until the next scene, as before.
- After a restart, a song the Almanac picked in this story counts as its own again, not as yours.

## 1.24.0 (2026-10-03) · preset 1.1.5

**Stamina: needs follow what someone is.** Hunger, thirst and tiredness build at each person's own speed, and wounds heal at their own pace too.
- **Read from the sources.** The card, the persona, the lorebooks' person entries and the story's own trait lines say what someone is. In the Buffy chats, Buffy (card) and Gabriel (persona) come out as Slayers, Angel as a vampire, and Valeria, Willow and Tara as witches. Someone the card only mentions ("Angel, a vampire", "fighting vampires") doesn't change the card's own person.
- **Kinds:**
  - **Slayer:** tires at 0.4× speed, sleep restores 1.5× faster, wounds heal 3× faster; eats like anyone.
  - **Hardy** (soldier, athlete), **Superhuman** (superhero, mutant, Kryptonian), **Werewolf / shifter** (eats more, heals fast).
  - **Vampire:** hungers for blood, not food; no thirst; heals 5× faster.
  - **Immortal / divine:** no food or drink, rarely tires. **Construct / ghost:** no needs, no healing on its own.
  - **Witch / wizard:** an ordinary body.
- **Adjustable.** Edit someone on the Cast page: **Stamina** has a Kind (Auto shows what the sources say) and four speeds of your own: Hunger, Thirst, Tiredness (never, ¼ speed … twice as fast) and Wounds heal (not on its own … five times as fast). Your choice beats the sources.
- **The model is told.** The note carries a short line with each person who isn't ordinary ("Slayer: tires slowly, recovers fast, heals fast"). The preset (1.1.5) tells the model to keep its own body lines to it.
- **Potions and stimulants.** A body line like "drank a Pepper-Up potion", "stamina potion" or "stimpack" brings tiredness down to 1 and holds it off for six hours. Nourishing and hydrating potions do the same for hunger and thirst. "Drank a … potion" no longer counts as a drink of water.
- Replay of 6170f171: Gabriel ends at tiredness 2 rather than 4, and Buffy's treated wounds close days sooner.

## 1.23.0 (2026-10-03)

**Thumbs up and down teach the Soundtrack.** Every song has 👍 and 👎: on the Soundtrack page, in the Now window, and next to each song in "Played in this story". A thumb says whether the song fits the mood it played for, and later picks learn from it:
- **The song:**
  - A 👍 song comes back for that mood (and moods close to it, such as sensual and erotic or melancholy and grief), even when no search finds it.
  - A 👎 song never plays for that mood again, and it's skipped at once (without the usual skip penalty).
- **Its artist, its genre and the search that found it** rise or sink for that mood. One 👍 for an artist in erotic scenes is enough to lift a new song of theirs over the top search result there.
- **Close moods:** they share half a 👍. A 👎 counts for only a quarter there, since a song wrong for erotic may still suit romantic.
- **Why a pick was made:** the "Why" line says "you rated it up for erotic" or "you like this artist for erotic" when your thumbs chose it.
- **Changing your mind:** the same thumb again takes the rating back, and the other thumb replaces it. "What your thumbs taught it" lists your ratings by mood and lets you forget one or all.
- **Ratings count in every story.** Songs you played yourself or that autoplay started can be rated too: they're filed under the scene's mood at the time.

## 1.22.2 (2026-10-03)

**Choose the music's mood yourself.** The Soundtrack page has a new **Mood** row under the scene: **Auto** (the scene decides, as before) or any of the 18 moods.
- **How a chosen mood works:**
  - It holds in that story through every scene until you choose Auto again, fights and deaths included.
  - The song changes at once with a fade. Choosing a mood also ends a Hold and takes the music back from a song you picked yourself.
  - The page shows "Your mood: …" and what the scene itself reads as.
  - A chosen erotic plays explicit songs only where the story's Intimacy setting allows them.
  - With "Engine + model", no model call is made while you've chosen the mood.
- **In the Now window:** the line under the song opens the same moods ("· yours" when you chose one).

## 1.22.1 (2026-10-03)

**The Soundtrack knows a sex scene from a hug.** Every intimate scene used to get the same "romantic" search. In the Buffy chat that was 83 of 193 replies, whether it was a hug on the floor or two hours in bed.
- **Two new moods:**
  - **Sensual** is for kissing and building desire. It's searched as "sensual", "seductive" and "sultry".
  - **Erotic** is for sex on the page. It's searched as "sexy" and "erotic", in R&B, slow jams or neo soul as well as your genres (not under "Only mine").
  - In an erotic scene, explicit songs come first when the story's Intimacy setting is Explicit (or the preset's). Titles that clash with the mood drop, like "Lullaby" in a sex scene or "Party" at a funeral, and titles that fit rise a little.
- **How the scene is read:**
  - The mood comes from what the latest exchange shows, your message included: distinct explicit terms, signs of desire, and characters the Ledger just filed as *wanting*.
  - The model's plans, the ledger block and asides don't count. Neither does a running joke ("you moan at everything") in a breakfast scene.
  - Intimacy Off or Fade to black gets sensual at most.
  - Sex filed under another mode counts only when the page is unmistakable, and never in a fight.
- **When it changes:** a scene turning to sex cuts in with a fade, once per music scene. The scene keeps that music between rounds while desire is still on the page. The once-a-scene model reading can't hold a scene back at "tender" after it has moved on.
- **Feelings colour other scenes too:** the moods filed for the people present in the last two replies count. Guilt and grief at breakfast play melancholy, not playful. Real terror in a quiet room plays tense. Everyone giddy on a rainy afternoon no longer plays melancholy. One flustered word ("defensive-panicked") isn't enough to turn a scene tense.

## 1.22.0 (2026-10-03)

**Soundtrack: YouTube Music that follows the scene.** A new page under Story › Soundtrack plays music through **Pear Desktop** (the YouTube Music desktop app) and picks it to fit the scene. It reads the mood from what the Ledger has filed: the scene's mode, the hour, the weather, the place, wounds, deadlines, and fights or deaths in the latest reply. A tavern gets something warm, a fight gets something urgent, a dark hallway in the rain gets something low. Nothing about the story the player hasn't seen goes in, so the music can't give away what's coming.
- **Setup:** install Pear Desktop, turn on Plugins → API Server, then press Connect on the page and choose Allow in the app. The Ledger asks for the new `cors_proxy` permission so it can reach the app and search YouTube Music.
- **When it changes:** once per scene (a new spot, or an hour and a half later), when a new mood holds for two replies, or right away with a fade on a sharp turn (a fight breaks out, a death the reply filed). One song is kept queued, so YouTube Music's autoplay rarely gets a turn. **Hold** keeps a song going for the rest of the scene. **Skip** picks another song for the same mood, and the skipped song counts against itself next time.
- **Your taste:** genres (chips suggested from the story's genres, or your own), with "Only mine" or "Blend with the story". Preferred artists are searched first. Also: banned artists, banned words, vocals (any, quiet under dialogue, instrumental only), variety, explicit songs and music videos. A story can have its own taste; its bans add to your global ones.
- **Bans:** a banned artist is never chosen. If YouTube Music's autoplay plays one, it's skipped, and in a duet or a "feat." too. A song you choose yourself always plays, even a banned one, and the Almanac steps back until the next scene ("Take the music back" can turn that off). "Ban artist" and "Never this song" work on whatever is playing.
- **Reading the scene:** the engine on its own (free), or the engine plus a short model call at each new scene. The model's reading can rename the mood, but it can't calm a fight or a death.
- Played songs are listed per story, with why each one was picked. Searches are cached for a week and rate-limited.
- **In the Now widget:** the open window has a song strip: cover, title, artist, and the mood or who chose the song. It has Pause/Play, Skip, Hold, Never this song, and Start/Stop. Tap the cover to open the Soundtrack page. While a song plays, the pill shows ♪ and the title, and the docked tab shows ♪.
- **Session Zero** has a Soundtrack row: your usual taste, the story's own genres (suggested from the genres you tick), or no music in this story. If the Soundtrack isn't set up, the row says where to set it up.
- **Listener tags (optional, Last.fm):** paste a free Last.fm API key; you don't need to scrobble or use Last.fm otherwise. Each pick then checks its best ten songs against how listeners tag them. A song tagged "sad" or "piano" moves up in a grief scene, and one tagged "party" moves down. Under "Only mine", well-tagged songs outside your genres drop too. The key is kept in the vault. Lookups are cached for a month and never hold a pick up for more than five seconds. A key Last.fm refuses turns the lookups off until you save a new one.

## 1.21.4 (2026-10-03) · preset 1.1.4

**World texture and Initiative now change the story.** Before, each setting only swapped one sentence, and fixed rules elsewhere in the preset ("at most one unprompted environmental act", "invent no off-screen news") overrode it. World-led even read weaker than Collaborative.
- **Insistent:** every reply, the place makes at least one demand that someone present has to answer, such as weather, a crowd, a closing time, a bill, a knock or something boiling over. Up to two unprompted environmental acts per reply. **Living** keeps one per reply. **Backdrop** stays quiet unless the scene can't go on without the world.
- **World-led:** when your message brings no new pressure, someone present or the place itself brings one, drawn from established people, threads, debts and clocks. It also allows one more unprompted initiative per reply than Autonomy does.
- "Invent no off-screen news" now says it's about news from elsewhere. What the place does and what the people in it start belong to the scene.
- The preset tells the Ledger both settings. With Insistent or World-led, news, traces and people from Elsewhere can reach a charged scene (not a pivotal or intimate one), with one more item per scene. Under World-led, Elsewhere steps twice as often in story time.
- Three or more people at ease (downtime, social, travel) no longer make a scene charged, so a family breakfast lets the world in under every setting.

## 1.21.3 (2026-10-03) · preset 1.1.3

**Your character speaks only in Director and Full cast.** With Persona set to Sealed or Continuity, the story no longer gives your character lines of dialogue. That includes repeating your own line back to you.
- The preset says so in both modes, and it stops giving your character a voice number in Sealed and Continuity.
- If a reply still has a line for your character, the Ledger takes it out of the message, along with its tag ("Gabriel says solemnly,", "— mumbled against her"). Everything else in the reply stays as written. Lines the model left unmarked are checked too: the speaker reader names your character only when the narration plainly gives the line to them.
- Your character's lines in earlier replies are left out of what the model sees, so it doesn't copy them.
- Director and Full cast work as before.

## 1.21.2 (2026-10-03)

**Looks stay with the right person and wear off.**
- When the model writes two looks on one line ("look Buffy: … · look Gabriel: …"), each person now gets their own. Before, Buffy's look also held Gabriel's.
- What you say someone is wearing in your own message ("He's wearing green pajamas. She's wearing blue pajamas.") now sets their look. "He" and "she" go to the one person present the story calls that; if two people fit, nothing is filed. "I'm wearing" is your character. "Puts on glasses" adds to the outfit instead of replacing it.
- Your outfit stands for the reply that answers your message, so a model that swaps who wears what can't overwrite it. Later replies can still change it.
- Passing details wear off with the clock. Poses ("sitting on the counter", "over her") go after half an hour. Damp hair, sweat and flushed skin go after two hours. The clothes stay.

## 1.21.1 (2026-10-03) · preset 1.1.2

**Hunger, thirst and tiredness come less often.** Characters were hungry, thirsty or tired most of the time. Needs now build slowly: about 13 hours without a meal before someone is a little hungry, 10 hours without a drink before they are a little thirsty, and 15 hours awake before they are a little tired. The clock alone stops there. "Starving" or "desperate for water" needs a cause in the story, like a body line or someone trapped, captive, stranded or without food.

Ordinary life happens off the page:
- A jump in the clock past breakfast, lunch or dinner (08:00, 13:00, 19:00) means they ate and drank.
- A jump through the night means they slept, whatever the scene mode, unless it was a fight or a crisis. Sleep no longer makes anyone hungry, and a short night still leaves them tired.

Needs written in words now count. "Fed", "ate", "drank", "thirst easing", "rested", "hungry", "parched" and "exhausted" in a body line move the meters. Before, they were kept only as notes, so a character who "drained a full glass" stayed "desperate for water" for hours.

The note calls the mild level "a little hungry", "a little thirsty" and "a little tired". The preset asks for a need only when it changes, and says that ordinary meals and sleep reset needs.

## 1.20.0 (2026-10-02)

**Five new skins, and your own fonts and sizes.** Pick them in Settings › Look or in Session Zero. Each has a light and a dark palette:
- **Airmail**: a postcard. Red-and-blue airmail stripes round the ledger, postmarks for speakers, ruled bubbles, perforated stamps, and thoughts as a handwritten P.S.
- **Lido**: Art Deco. Stepped corners with brass rules, octagon medals, sunburst rays behind chapter titles, and thoughts engraved between two lines.
- **Riso**: a two-ink zine. A second ink just off register, halftone medals, marker highlights for thoughts, chapter titles on a cut-out label, and two staples on the ledger.
- **Neon**: signs at night. Speakers glow in their colours and the chapter title flickers in a neon script (still when reduced motion is on). In light mode the signs are switched off: the same tubes, unlit.
- **Splash Page**: a comic book. White balloons with tails, thought clouds, yellow caption boxes for chapters, and panel borders. Balloons stay white in dark mode.

**Fonts and sizes** (Settings › Look, under Colours). Every skin sets four faces: headings, text, labels and handwriting. Each can be changed to one of about sixty fonts, or to any Google Fonts family or installed font typed by name. Two sliders, from 80% to 150%, scale what the Almanac draws in messages (voice cards, thoughts, chapters, the ledger) and the drawer. The floating widget keeps its size. Choices can apply to the skin on screen or to every skin, and a skin's own choice wins over one for every skin. Menu fonts load from Google Fonts while "Load the skins' web fonts" is on.

Chapter headings draw on one line between their rules again. The scene line and the title had been split into two columns.

## 1.19.3 (2026-10-02)

**The extension marks who speaks when the model doesn't.** Some models, GLM among them, drop the speaker marks for most of a reply even though the prompt asks for them. Without marks the page draws no voice cards. After each reply, any spoken lines left without a mark go to a quiet model call (the clerk's connection, or the summariser's). The call works out who speaks each line from the narration around it ("she says", "Dawn points her fork"), the lines that are already marked, and the flow of the conversation. The marks are then written into the message, in the reply's own names and voice numbers, and the reply redraws with voice cards. It also adds the voice number to the reply's own marks that left it out (`[spk=Dawn]`), so their colours match.
- Only marks are added. The rewrite is refused if any other part of the text would change, or if the message was swiped or edited while the call ran.
- A line the reader can't place, and quoted words nobody says aloud (a sign, a text message), are left as they are.
- The latest reply of a chat is also read when it is shown, so a reply written before this update gets its marks.
- Switch: Settings › Core › "Mark who speaks the lines a reply left without speaker marks".

## 1.19.2 — preset 1.1.1 (2026-10-02)

**Voice cards draw when the model misplaces the speaker mark.** Some replies put the mark after the words (`"Words."[spk=Dawn#2][/spk]`), which drew an empty badge after a line in the plain text colour. Others garbled the closer (`[/spkbuffy]`, `[/spspk]`, `[/sp]`) or left a `Buffy#1:` label partway through a line. The extension now repairs these when the reply is shown, in the prompt history, and when it reads who said what:
- A mark after its line moves to the front. Other unmarked lines in the same paragraph get the same speaker.
- A garbled closer that names someone ("buffy") takes that person's voice. A closer with no name goes to the paragraph's only speaker, or is dropped.
- A second mark right after a line that is already marked is removed.

The next turn tells the model what went wrong. It also points out a line left without a mark between voice cards ("Shut up. I'm cold."), including the player's own words when the reply repeats them. The preset's speech rule now says that short replies get marks too, and that the mark comes first and `[/spk]` closes the line. In the Buffy chat this repairs replies #90, #112, #160, #164, #306, #308, #342, #350, #362 and #364.

## 1.19.1 (2026-10-02)

**Bonds: cards fit the drawer.** A long label ("possessive attachment") wraps under the names instead of pushing the card wider than the drawer, which had hidden the right half of every bar and the numbers. Changes of 0 are no longer listed as a bond's last changes. Long stickers wrap everywhere in the drawer.

## 1.19.0 (2026-10-02)

**The drawer, redesigned ("Night Almanac").** Every page of the Almanac drawer has a new look that is easier to read at a glance:
- **The sky** carries the story day beside the clock ("DAY 26"), a skyline along its foot, and icons on the place and scene chips. The group's pages switch with bigger buttons in the group's colour.
- **Each page opens with a heading**: the group, a large title, a one-line count, and a badge in the group's colour. Section headings are larger, with a count beside them.
- **Status is a sticker**, a word on a colour: secret, belief, true, off the page, due, in prompt, spotlight, crossed, diverged.
- **Now**: tiles for where, the day, sun, moon and scene; the forecast as bars; the people in the room as cards with Mood, Energy and Control (in place of V, A and D); what is owed with who owes it; the note with its size in tokens; three large buttons.
- **Cast**: the people in the scene as trading cards (voice-colour band, large medal, quote, hidden pressure, actions at the foot); everyone else in a list that opens a card on a tap.
- **Bonds**: the axes to colour by as buttons; every bond with both medals and a bar per axis, around zero, with its last changes.
- **Knowledge, Chronicle, Codex, Recall**: filters as toggles; who knows a fact as a grid of people; the tokens the chronicle saves set large; Codex kinds as buttons; Recall scores as tiles, with the prompt's size against its ceiling.
- **Timeline** groups milestones by day with an icon for each kind; **World** shows clocks as rings, things as cards, rumours as speech bubbles and running bits as stickers; **Elsewhere** shows the dice of each beat, wants and fears side by side, and what reached you and what is on its way.
- **Lore**: each book as a card with its size, what its entries were read as, and how they fire as a three-way toggle. **Creator**: chat bubbles in the Library's colour.
- **Settings**: this chat's switch as a toggle; story truths as a note; each section folds to one line that says how it's set; skins as swatches; checkboxes as switches.

**A new skin, Night Almanac** (Settings › Look), with its own light and dark palettes: deep indigo, Bricolage Grotesque headings and Atkinson Hyperlegible text, made for reading. Every other skin draws the new drawer in its own colours and fonts.

## 1.18.0 — preset 1.1.0 (2026-10-02)

**ALMANAC runs only with the Ledger, in English.** The preset no longer has a standalone mode: every block goes out only while the ALMANAC Ledger manages the chat, so the model always works from the verified `<ledger-note>` instead of guessing the clock from old headers (which the history thinning had already dropped) and renumbering voices whose marks were gone. A chat's first ALMANAC prompt runs in full: the Ledger reports *arming* and switches itself on as that prompt goes out. Without the extension, with the Ledger switched off in a chat, or without its Prompt interceptor permission, the model answers with one out-of-character line saying what to fix. Gone with the standalone mode: the preset's own Session Zero interview and its tag, the place/weather/mode chat variables, the scene-mode router regex (the scene modules now read the Almanac's scene mode directly), the fallback scene plate and tracker drawer (the Ledger draws both), and the Climate, Calendar and Start point dials (Session Zero sets them). The **Language** setting is gone too: the story, summaries, Codex cards, knowledge lines and Elsewhere's telling are all English. Re-import `preset/ALMANAC.json`.

**The scene header opens every scene.** The default header setting is now *Every scene*: the first reply of a scene (a new place, a new day, a skip of an hour or more, a new title) always carries the full header, and when the model leaves it out the Ledger draws it from the verified clock, weather and place. *Every reply* and *Off* are still there.

**The preset, audited and rewritten where models ignored or misread it:**
- **Agency.** Who decides a contested attempt no longer contradicts itself: the world answers an attempt, "I decide" stops at the moment it would land, and attempts nothing resists simply happen. Impersonation is now an explicit exception to the persona rules and no longer carries the narrator's point of view, tense or agency rules. With a sealed persona the viewpoint is never inside your character's head (third limited names the viewpoint; second person sees and is touched, never "you feel"). The intimacy module keeps your character's body, words and consent yours, and no longer asks for a journal line for you.
- **Your facts win.** Facts you state about the story's record — the day, someone's eye colour, a rule of your AU — are true, and the date rule no longer resists your corrections. A relationship the card, persona or lore sets up counts as a route: your character's sister knows your name.
- **Off-screen news comes only through [ELSEWHERE].** The living world, relationships between others, downtime and `/skip` no longer invite news of their own.
- **The ledger spec** is a short realistic example plus one line per op, and the example now follows its own rules (no one in another room marked *peri*, a reveal written as `reveal`, four keys, no pronoun for your character). `reveal`, `unaware`, `cons` and `payoff` are shown at last; *Lite* gets only its own lines; *Off* and *Snapshot* are gone (the Ledger needs the ledger). The Bridge explains every lane the note sends, [ROMANCE], [PLANTS], [RETURNING] and [NOT PEOPLE] included.
- **The Director's Pass.** VOICE names how the opening differs instead of asking for an opening line the pass forbids; MOVE's three candidates are for charged and pivotal beats only, so a routine pass fits its 90 words; PREMORTEM no longer grades the last reply; SEAL sorts stated facts. *Auto* still picks native reasoning by model name, but a model with no reasoning is told not to write the pass, and a pass it writes into the reply anyway is moved into the Director's notes. The reasoning prefill (DeepSeek, Kimi) goes out only on story turns with native planning, at the tier's own labels. A sidecar planner that doesn't answer is reported to the model instead of leaving a promised plan missing.
- **Settings that do something.** Reveals, the firewall's strictness, pacing, fair strangers, tone and Signal weather's dice now say what they mean; "60/30/10" and other unmeasurable wording is gone. Fade to black no longer carries the explicit vocabulary list; the Erotic contract goes out only with Explicit; hard limits are repeated at the end of every prompt. Session Zero values the preset doesn't know fall back to the defaults instead of dropping whole blocks.
- **Routing.** `(OOC: …)` counts as out of character; an empty send no longer re-runs your last command; a new take on a command or OOC reply redoes the command; any unknown `/command` gets the list. The hidden d20 is the same on every swipe of a turn.
- **Smaller fixes:** the hazard deck says "avoid" (its roster read as "in force") and sits after the chat history with the other per-turn text, so the long front of the prompt stays cacheable; the Claude note no longer implies the ledger is optional; "arousal" in the mood axes is now *activation*; the echo guard quotes prose, not artifacts; continue writes the ledger only if the reply has none. The build now catches stray braces.

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
