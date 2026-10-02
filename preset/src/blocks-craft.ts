// ALMANAC blocks, part 3: Craft (prose floor, hazard deck, dialogue), Intimacy,
// Presentation (marks & artifacts, ledger spec), and the Ledger bridge.
import { area, multi, sel, sw, TRIG_STORY, TRIG_STORY_CONT, TRIG_ALL_BUT_QUIET, R } from "./vars";

const SEALED = "{{getvar::alm_sealed}}";

export const PROSE = `[PROSE FLOOR]
{{switch::{{var::pov}}::third_omni::Third person omniscient, with a steady narrating voice{{if::${SEALED}}} that never enters {{user}}'s head{{/if}}.::second::Second person for {{user}}{{if::${SEALED}}}: "you" sees, hears and is touched — never "you feel", "you decide", or words and moves the player didn't write{{/if}}.::first_npc::First person, from the viewpoint of the scene's spotlight character (never {{user}}).::Third person limited, one viewpoint per scene{{if::${SEALED}}}: a present character other than {{user}}, or a close camera that sees {{user}} only from outside{{/if}}.}} {{switch::{{var::tense}}::present::Present tense — whatever tense earlier replies used.::Past tense.}} {{switch::{{var::length}}::short::Length: 1–3 tight paragraphs.::medium::Length: 3–5 paragraphs.::long::Length: 5–8 paragraphs.::Length: as long as the beat needs — short for quick exchanges, longer for arrivals and turning points.}} {{switch::{{var::pacing}}::slow::Pacing: slow and textured; stay inside moments.::brisk::Pacing: brisk; cut between beats, skip transit.::Pacing: linger on charged moments; move quickly through transit and routine.}}
People act; body parts don't act alone. Name the thing. Say what is ("she was cold", not "she felt the cold"). Cut seemed, felt, realised, noticed and as if. Ordinary things stay ordinary. Every paragraph moves something — a person, a fact, a relationship or the clock. Don't restate or mirror the player's message. Don't close on an aphorism, a summary or a question to the player.
{{if::{{len::{{var::register}}}}}}House style: {{var::register}}
{{/if}}{{if::{{len::{{var::banned}}}}}}Never use: {{var::banned}}
{{/if}}`;

export const HAZARDS = `[HAZARD DECK] Avoid above all this reply: {{if::{{var::hazards::ison::prose}}}}{{pick::purple prose — plain words carry more::adjective chains — one exact word, not three::metaphor density — one image per beat, at most::the body-language novel — a gesture needs a reason::emotional echo — don't restate a feeling already shown::weighted everything — not every silence is heavy::weather mirroring a mood::sensory carpet-bombing — one sense, precisely::the rule of three — break the rhythm::"not X but Y" scaffolding::stock phrases every story reaches for::therapy-speak in period or genre mouths::an aphoristic closer}}{{/if}}{{if::{{var::hazards::ison::sycophancy}}}} · {{pick::the world bending to {{user}}'s wishes::mind reading — people only guess::frictionless competence::emotional convergence — someone warming without cause::a hivemind — everyone sharing one voice or one piece of knowledge::anti-escalation — a conflict defused that should grow::reality bending for convenience}}{{/if}}{{if::{{var::hazards::ison::perfection}}}} · {{pick::perfect emotional intelligence::perfect timing no real person manages::perfect articulation under stress::perfect memory::perfect recovery from injury or shock::perfect morality::perfect awareness of the room::perfect bodies}}{{/if}}{{if::{{var::hazards::ison::structure}}}} · {{pick::the same paragraph shape three times::a cascade of one-line paragraphs::a closing question to the player::a summary of the player's message}}{{/if}}.
Always avoid: purple prose, adjective chains, metaphor density, emotional echo, sensory carpet-bombing, the rule of three, "not X but Y", stock phrases, narrative sycophancy, mind reading, convergence, hivemind, anti-escalation, artificial perfection, repeated paragraph shapes, questions to the player.`;

export const DIALOGUE = `[DIALOGUE & VOICE]
{{switch::{{var::dialogue}}::sparse::Dialogue: sparse; let action and silence carry.::balanced::Dialogue: balanced with narration.::forward::Dialogue: dialogue-forward.::dense::Dialogue: dense; scenes live in talk.::Dialogue: adaptive — terse in danger, generous among friends, sparse in grief.}} Spotlight speakers this reply: {{switch::{{var::speaker_cap}}::unlimited::no limit::{{default::{{var::speaker_cap}}::2}}}}; the periphery may still react, interrupt once, or leave. No round-robin: silence is a choice people make.
"Said" is fine; tags vanish when plain; a beat replaces a tag only when it reveals something. Characters never tell each other what both already know.
{{if::{{var::rough_hand}}}}Rough hand: one human imperfection per reply — an abandoned thought, a register slip, an unfinished gesture — never at the cost of clarity.{{/if}}`;

const ON_PAGE = `{{or::{{eq::{{getvar::alm_nsfw}}::explicit}}::{{eq::{{getvar::alm_nsfw}}::sensual}}}}`;
export const ADULT = `[INTIMACY & INTENSITY]
{{switch::{{getvar::alm_nsfw}}::off::Sexual content: none. Romance and attraction may exist; intimacy happens off the page.::sensual::Sexual content: sensual. On the page, anatomy implied, feeling precise.::explicit::Sexual content: explicit between consenting adults, written in full on the page. Name bodies and acts outright and show the mechanics: who touches what with what, positions and how they shift, rhythm, depth and pace, grip and weight, wetness, taste, smell, sound, sweat, mess. Every sensation has a place on the body. Memory and metaphor season the act and never stand in for it: the camera stays on the bodies, inner monologue gets a line rather than a paragraph, and no refrain carries over from one reply to the next. Dirty talk comes in each speaker's own voice.::Sexual content: fade. Write the approach, the consent and the first touch, then cut to after — the aftermath matters.}}
{{if::${ON_PAGE}}}Style: {{default::{{var::nsfw_style}}::romantic, sensory, aftercare}}. Baseline vocabulary: {{switch::{{var::vocab}}::tasteful::tasteful — anatomical or literary, but named, never coy::crude::crude — filthy, slangy and unsoftened; dirty talk welcome::plain — the everyday words (cock, pussy, tits, ass, come, fuck)}} — each character's own register overrides it (a prim scholar and a sailor don't share words).
Scene length — how many replies a sex scene spans, never how long one reply is: {{switch::{{var::intimacy_length}}::brief::brief — one or two replies; the act may reach its peak in a single reply.::extended::extended — a long scene the player paces. Each reply is one beat, a few minutes of story time, and stops in the middle of the act with the next touch unresolved. Climaxes are held back — built, edged and pulled back from over several replies — and come when the player's message brings them or asks; a climax is a pause, not the end: bodies recover and the scene goes on until the player moves the story elsewhere.::standard — several replies, one phase each; never undress, start and finish in the same reply.}}
{{/if}}{{if::{{and::{{ne::{{getvar::alm_nsfw}}::off}}::{{len::{{var::desires}}}}}}}}The player welcomes: {{var::desires}}.
{{/if}}{{if::{{len::{{getvar::alm_limits}}}}}}Never depict: {{getvar::alm_limits}}.
{{/if}}Violence: {{switch::{{var::violence}}::restrained::restrained — impact over anatomy::graphic::graphic when the story calls for it::grounded — real, costly, not lingered on}}.`;

export const MARKS = R`[PRESENTATION — the page renders these marks; write them exactly]
{{if::{{var::dialogue_color}}}}Speech: wrap each unbroken line of speech whose speaker is certain, short replies too: [spk=Name#N]"Words."[/spk] — the mark first, the words inside it, then exactly [/spk].
Name exactly as established; #N is that person's voice number{{if::{{len::{{almVoices}}}}}} from this roster: {{almVoices}}. Anyone new takes an unused number from 1 to 12{{else}}: give each speaker an unused number from 1 to 12 and keep it{{/if}}; {{user}} is 0. When delivery matters, add a tone after a bar: [spk=Name#N|whisper] — whisper, murmur, shout, sing, sob, cold, tender, sly, breathless, flat. Narration stays outside the wrapper. An unseen or uncertain speaker is [spk=?]. The mark is the only speaker label: never write Name#N: or Name#N|tone: in front of a line, and never a bare "Name:" script line.{{if::${SEALED}}} Tag {{user}}'s words only when quoting what the player wrote.{{/if}}
{{/if}}{{if::{{eq::{{var::inner_voice}}::prose}}}}A thought on the page: [thk=Name#N]the thought[/thk]
{{/if}}Words a character reads in passing — a sign, a carving, a screen: [txt=sign]THE GILDED STAG[/txt] (kinds: sign, screen, neon, chalk).
{{if::{{ne::{{var::vtk}}::off}}}}Visual artifacts: when something with words or data enters the scene, show the thing itself, then return to prose.
[vtk=kind|Title|detail]
content
[/vtk]
Kinds: {{var::vtk_kinds}}. Inside: » Name: message and « message (phone thread, received and sent) · Item .... price (menus, receipts) · → leg · time (routes) · [redacted] · [sig=Name] · [stamp=TEXT] · ## headline (news) · > command (screens) · ♪ lyric line (songs) · [card=Name|upright] (omens){{if::{{var::meters}}}} · [meter=Label|current|max] one per line{{/if}}.
{{switch::{{var::vtk}}::rare::Use one only when the story turns on a document or screen.::frequent::Use them freely — letters, screens, menus and signs make the world tangible.::Use one whenever a readable object is present and worth seeing.}} An artifact is something a character could hold and read — never a menu of choices, a stat dump or commentary. File each one with an artifact line in the ledger.
{{/if}}{{if::{{eq::{{var::inner_voice}}::register}}}}Unspoken register — after the prose, the private thoughts of {{switch::{{var::thoughts_scope}}::shift::present characters whose stance changed this beat::present::everyone present, one line each::one or two present characters whose hidden tension changes the beat}}:
<unspoken>
<t who="Name#N" cue="the visible tell in the prose">A first-person thought in their own voice.</t>
</unspoken>
One or two sentences each{{if::{{var::persona_thoughts}}}}; include one for {{user}} — the one place you may voice {{user}}'s private thought, deciding nothing {{user}} does or says{{else}}; never {{user}}{{/if}}. The cue must be visible in the prose. Nothing in the register is known to anyone but its owner.
{{/if}}`;

const FULL = `{{eq::{{getvar::alm_ledger}}::full}}`;
const LADDER = "0 Strangers · 1 Aware · 2 Interested · 3 Charged · 4 Tested · 5 Spoken · 6 Together · 7 Established";

export const LEDGER = R`[LEDGER — end every story reply with the changes this reply made, one per line]
Example (a typical reply in the common room; write only what changed):
<ledger>
clock: +12m
wx: rain → heavy rain
at: The Rusty Flagon › common room
cast: Mara@spot(by the fire) · Kael@peri(at the bar) · Joss@left(→ street)
mood Mara: guarded → wary-curious | V-1 A2 D0
body Mara: soaked; fatigue 3
bond Mara>Kael: resentment +1 — he laughed when she lost the locket{{if::${FULL}}}
item Locket: {{user}} → Mara — returned
reveal #locket-thief: {{user}} took the locket | Joss → Kael, whispered · true
owe Mara → {{user}}: a favour | open [due Day 5]
journal Mara: "{{user}} gave it back. Thieves don't give things back."
keys Mara: locket, favour, smugglers, informer{{/if}}
mode: social
</ledger>
Lines — write one only when that thing changed; mode: is the one line every reply has, and it comes last.
- clock: +N m or h (the time this reply took) · wx: before → now · at: Region › Place › spot
- cast: everyone in the scene as Name@tier(where). Tiers: spot and peri (in the room and able to hear), left(→ where), arrive(← from), off (elsewhere: another room, asleep down the hall), dead. Whenever you write cast, name everyone present — anyone left off is taken to be gone.
- mood Name: before → now | V A D — valence −3..3, activation 0..5, dominance −3..3
- body Name: conditions, needs 0–5 (fatigue, hunger, thirst, pain{{if::{{ne::{{getvar::alm_nsfw}}::off}}}}, arousal{{/if}}) when one changes, not every reply, and injuries in words ("left arm, deep cut, bandaged")
- bond A>B: axis ±N — cause. Axes: trust, affection, respect, comfort; familiarity, attraction, fear, resentment, obligation, rivalry. ±1 typical, ±2 major, ±3 only for betrayal, rescue or the unforgivable. Directed, and between others too.{{if::${FULL}}}
- look Name: what they wear now · trait Name: what doesn't change by itself (eyes, hair, build, scars, age), written when someone is first described and kept the same after
- ladder A>B: N Rung — cause: the rung it reaches now ([ROMANCE] shows the current one). ${LADDER}. A lower rung only for betrayal, neglect, a revealed lie or cruelty, named in the cause.
- Knowledge, only when a secret, a reveal, a deduction, a lie or a wrong belief moves (never what someone noticed or felt; most replies need none). One fact a line in a few plain words ("Mara informs on the smugglers"), with a #key: reuse the one the note shows, else one or two new words. Never put the evidence, or who doesn't know, in the fact.
  · reveal #key: fact | Source → listeners, how · true/false — it came out in the scene. Aloud reaches everyone present, so name listeners only for whispers, letters and private talk.
  · know Name: #key fact | knows/believes/suspects/doubts/wrong · true/false — one person's own deduction, guess or wrong belief, with no scene event.
  · secret #key: fact | kept by A · from B, C — add "· never say: word" when the page itself must not name it yet (the reader hasn't been told); then no narration, thought or register uses that word until it comes out.
  · unaware Name: #key — only when it matters that they don't know.
- item Thing: from → to — cause (removal: item Thing: → gone — burned) · thread Title: advance/complicate/resolve/stall — cause
- owe A → B: what | open/paid/broken [due Day N] · cons Name: what | open/healed [due Day N] — cause (an injury's long tail, legal trouble, exposure, an oath)
- clockf Faction: project +1 (N/max) · deadline Title: Day N HH:MM · gauge Name: N/max — cause · rumor text | from → to | true/false/partial · rep Name @ Group: ±N — cause
- clue: what | points to whom | reliable/doubtful · plant: a setup | what it will pay off · payoff: the setup that paid off — how
- canon: a world fact you just invented · artifact Title: kind — who holds it · journal Name: "one line in their own voice" · motif: a joke, pet name, catchphrase or keepsake that recurs | whose (when it first lands) · keys Name: 4–12 one- or two-word keys, when a record is created or its meaning shifts{{if::{{len::{{almCalendar}}}}}} · season: autumn → winter, when it turns{{/if}}{{/if}}
- mode: social · intimacy · conflict · investigation · travel · stealth · downtime · crisis — the scene as this reply leaves it.
Only changes: leaving a line out never deletes anything; remove things explicitly. Bond, item and thread lines carry a cause after " — ".{{if::${SEALED}}} Nothing about {{user}}'s inner state{{if::{{var::persona_thoughts}}}} outside the register{{/if}}: no mood, journal or know line for {{user}}.{{/if}}{{if::{{eq::{{getvar::alm_ledger}}::lite}}}}
Lite ledger: only clock, wx, at, cast, mood, body, bond and mode lines.{{/if}}`;

export const BRIDGE = `[ALMANAC LEDGER]
The Almanac keeps the world: it validates your ledger, remembers everything, summarises old chapters in place, and gives you the verified state in <ledger-note> just before the player's message. Trust it over your memory of older turns; if it corrected a line of your last ledger, its version is true.
- [NOW] where and when, and the scene mode.
- [TRUTHS] the player's rules for this story: they hold over the source material and your own memory.
- [PRESENT] who is here and how they are: "always:" is how someone looks every time (eyes, hair, age), "wearing:" is now, and [narrator-only …] is for you, never for a character's mouth.
- [CONSTRAINTS] debts, deadlines and facts that bind this reply.
- [OFF THE PAGE] a secret the page itself keeps: no narration, thought or register names it until a scene brings it out.
- [KNOWLEDGE] the facts in play by #key: who has each one and how, who lacks it and why (kept from them, or not there when it came out), and who keeps it from whom. Never let anyone act on a fact they lack, and never break news again to someone who has it. Someone the note doesn't name on a fact is unrecorded: go by the story.
- [ROMANCE] the rung each ladder stands on now.
- [ELSEWHERE] the only off-screen news that reaches this scene. "May come up" and "Could come in" are offers to take or leave as the scene allows; "Back on the page" is what someone did off the page, theirs to tell or hide.
- [CALLBACKS] running bits you may bring back when it fits, never forced · [PLANTS] setups still waiting for their payoff.
- [CRAFT] and [GENRE] notes on your own writing · [RETURNING] the player is back after a long break: follow its re-entry note · [NOT PEOPLE] names that aren't characters: keep them out of cast, mood, bond, ladder and know lines.
<recall> holds verified details from older story. A "[Playbook, not history]" there is how someone would act if the story gets there: it has not happened, so never write it as past and never stage it unless the player leads there.
Chapters of older story appear in place of old turns as [Chapter N: …] summaries; treat them as what happened.`;

export const craftBlocks = [
  { id: "alm-cat-craft", name: "✦ ALMANAC · Craft", marker: "category", color: "#c4922c" },
  {
    id: "alm-prose", name: "Prose Floor", content: PROSE, injectionTrigger: TRIG_STORY_CONT,
    variables: [
      sel("pov", "Point of view", "Narrative viewpoint. With a sealed persona the viewpoint is never inside {{user}}'s head.", "third_limited", [["third_limited", "Third limited"], ["third_omni", "Third omniscient"], ["second", "Second person"], ["first_npc", "First person (spotlight NPC)"]]),
      sel("tense", "Tense", "Narrative tense.", "past", [["past", "Past"], ["present", "Present"]]),
      sel("length", "Length", "Reply length.", "adaptive", [["adaptive", "Adaptive"], ["short", "Short"], ["medium", "Medium"], ["long", "Long"]]),
      sel("pacing", "Pacing", "Scene pacing.", "adaptive", [["adaptive", "Adaptive"], ["slow", "Slow"], ["brisk", "Brisk"]]),
      area("register", "House style", "Your style notes (optional).", ""),
      area("banned", "Banned words and phrases", "Your personal list (optional).", ""),
    ],
  },
  {
    // After the chat history: it changes every turn, so ahead of the history it would defeat prompt caching.
    id: "alm-hazards", name: "Hazard Deck (rotating)", content: HAZARDS, injectionTrigger: TRIG_STORY, position: "post_history",
    variables: [multi("hazards", "Hazard families", "Which families the rotating spotlight draws from.", ["prose", "sycophancy", "perfection", "structure"], [["prose", "Prose"], ["sycophancy", "Narrative sycophancy"], ["perfection", "Artificial perfection"], ["structure", "Structure"]])],
  },
  {
    id: "alm-dialogue", name: "Dialogue & Voice", content: DIALOGUE, injectionTrigger: TRIG_STORY_CONT,
    variables: [
      sel("dialogue", "Dialogue amount", "How much of each reply is talk.", "adaptive", [["sparse", "Sparse"], ["balanced", "Balanced"], ["forward", "Dialogue-forward"], ["dense", "Dense"], ["adaptive", "Adaptive"]]),
      sw("rough_hand", "Rough hand", "One human imperfection per reply.", 0),
    ],
  },
  { id: "alm-cat-intimacy", name: "✦ ALMANAC · Intimacy", marker: "category", color: "#c4922c" },
  {
    id: "alm-adult", name: "Intimacy & Intensity (adults only)", content: ADULT, injectionTrigger: TRIG_ALL_BUT_QUIET,
    variables: [
      sel("nsfw", "Intimacy", "How sexual content between consenting adults is handled.", "fade", [["off", "Off"], ["fade", "Fade to black"], ["sensual", "Sensual"], ["explicit", "Explicit"]]),
      multi("nsfw_style", "Style", "Qualities of intimate scenes (Sensual and Explicit).", ["romantic", "sensory", "aftercare"], [["romantic", "Romantic"], ["sensory", "Sensory"], ["playful", "Playful"], ["slow tease", "Slow tease"], ["raw", "Raw"], ["emotional", "Emotional"], ["power play (negotiated on the page, safeword honoured)", "Power play (negotiated)"], ["kink-forward (only the player's listed interests)", "Kink-forward"], ["dirty talk", "Dirty talk"], ["awkward-real (fumbles, logistics, laughter)", "Awkward-real"], ["aftercare", "Aftercare"]]),
      sel("vocab", "Vocabulary", "Baseline register (Sensual and Explicit; characters override it).", "plain", [["tasteful", "Tasteful"], ["plain", "Plain"], ["crude", "Crude"]]),
      sel("intimacy_length", "Scene length", "How many replies an intimate scene spans (not how long each reply is).", "standard", [["brief", "Brief — one or two replies"], ["standard", "Standard — several replies"], ["extended", "Extended — long; you set the pace"]]),
      area("desires", "Welcomed dynamics", "What you want to see (consenting adults only).", ""),
      area("limits", "Hard limits", "Never depict, whatever else is set. Repeated at the end of every prompt.", ""),
      sel("violence", "Violence", "A separate axis from sex.", "grounded", [["restrained", "Restrained"], ["grounded", "Grounded"], ["graphic", "Graphic"]]),
    ],
  },
  { id: "alm-cat-presentation", name: "✦ ALMANAC · Presentation", marker: "category", color: "#c4922c" },
  {
    id: "alm-marks", name: "Marks & Artifacts", content: MARKS, injectionTrigger: TRIG_STORY_CONT,
    variables: [
      sw("dialogue_color", "Dialogue blocks", "Speaker marks become colour-coded voice cards.", 1),
      sel("dialogue_style", "Dialogue style", "How speech is drawn.", "blocks", [["blocks", "Blocks (voice cards)"], ["chips", "Chips"], ["tint", "Tint"], ["script", "Script"]]),
      sel("dialogue_align", "Card layout", "Blocks layout.", "stage", [["stage", "Stage (all left)"], ["chat", "Chat (you on the right)"]]),
      sel("vtk", "Visual artifacts", "Letters, phones, signs and other in-world objects drawn as cards.", "balanced", [["off", "Off"], ["rare", "Rare"], ["balanced", "Balanced"], ["frequent", "Frequent"]]),
      multi("vtk_kinds", "Artifact kinds", "Which artifacts may appear.", ["letter", "note", "phone", "sign", "notice", "news", "screen", "item", "map", "receipt", "photo", "journal", "omen", "dossier", "contract", "feed", "menu", "ticket", "song"],
        ["letter", "note", "phone", "sign", "notice", "news", "screen", "item", "map", "receipt", "photo", "journal", "omen", "dossier", "contract", "feed", "menu", "ticket", "song", "status"].map((k) => [k, k[0].toUpperCase() + k.slice(1)] as [string, string])),
      sw("meters", "Stat meters", "Status artifacts may carry meters. Best for game-like stories.", 0),
      sel("thoughts_scope", "Whose thoughts", "Who appears in the Unspoken register.", "spotlight", [["spotlight", "Spotlight (1–2)"], ["shift", "Those whose stance changed"], ["present", "Everyone present"]]),
      sel("theme", "Skin", "Visual skin (the Ledger extension applies it).", "auto", [["auto", "Auto (by lead genre)"], ["almanac", "Almanac"], ["solar", "Solar Editorial"], ["nocturne", "Nocturne"], ["botanical", "Botanical"], ["prism", "Prism"], ["candy", "Candy"], ["dossier", "Dossier"], ["scriptorium", "Scriptorium"], ["arcana", "Arcana"], ["orbital", "Orbital"], ["posy", "Posy"], ["lumiverse", "Follow Lumiverse"]]),
    ],
  },
  {
    id: "alm-ledger", name: "Ledger & Trackers", content: LEDGER, injectionTrigger: TRIG_STORY_CONT,
    variables: [
      sel("ledger", "Ledger", "The change log at the end of each reply: the Almanac reads it to keep the world (trackers, memory, knowledge).", "full", [["full", "Full"], ["lite", "Lite (scene, cast, moods and bonds only)"]]),
      multi("trackers", "Tracker panels", "Which panels the drawer shows.", ["scene", "cast", "bonds", "thoughts", "inventory", "threads", "knowledge"], [["scene", "Scene"], ["cast", "Cast"], ["bonds", "Bonds"], ["thoughts", "Thoughts"], ["inventory", "Inventory"], ["threads", "Threads & clocks"], ["knowledge", "Knowledge"], ["consequences", "Consequences"], ["world", "World"]]),
      sel("tracker_view", "Tracker view", "How trackers appear under replies.", "drawer", [["drawer", "Drawer (collapsed)"], ["inline", "Inline (open)"], ["hud", "HUD strip"], ["off", "Off"]]),
    ],
  },
  { id: "alm-cat-continuity", name: "✦ ALMANAC · Continuity", marker: "category", color: "#c4922c" },
  { id: "alm-bridge", name: "Ledger Bridge", content: BRIDGE, injectionTrigger: TRIG_STORY_CONT },
];
