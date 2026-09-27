// ALMANAC blocks, part 3: Craft (prose floor, hazard deck, dialogue), Intimacy,
// Presentation (marks & artifacts, ledger spec), Continuity.
import { area, multi, sel, sw, TRIG_ALL_BUT_QUIET, TRIG_STORY, TRIG_STORY_CONT, R } from "./vars";

export const PROSE = `[PROSE FLOOR]
{{switch::{{var::pov}}::third_limited::Third person limited, one viewpoint per scene.::third_omni::Third person omniscient, with a steady narrating voice.::second::Second person for {{user}}.::first_npc::First person, from the viewpoint of the scene's spotlight character.}} {{switch::{{var::tense}}::past::Past tense.::present::Present tense — whatever tense earlier replies used.}} {{switch::{{var::length}}::adaptive::Length: as long as the beat needs — short for quick exchanges, longer for arrivals and turning points.::short::Length: 1–3 tight paragraphs.::medium::Length: 3–5 paragraphs.::long::Length: 5–8 paragraphs.}} {{switch::{{var::pacing}}::adaptive::Pacing follows the scene.::slow::Pacing: slow and textured.::brisk::Pacing: brisk.}}
People act; body parts don't act alone. Name the thing. Say what is ("she was cold", not "she felt the cold"). Cut seemed, felt, realised, noticed and as if. Ordinary things stay ordinary. Every paragraph moves something — a person, a fact, a relationship or the clock. Never restate or mirror the player's message. Never close on an aphorism, a summary or a question to the player.
{{if::{{len::{{var::register}}}}}}House style: {{var::register}}
{{/if}}{{if::{{len::{{var::banned}}}}}}Never use: {{var::banned}}
{{/if}}`;

export const HAZARDS = `[HAZARD DECK] Spotlight this reply: {{if::{{var::hazards::ison::prose}}}}{{pick::purple prose — plain words carry more::adjective chains — one exact word, not three::metaphor density — one image per beat, at most::the body-language novel — a gesture needs a reason::emotional echo — don't restate a feeling already shown::weighted everything — not every silence is heavy::weather mirroring a mood::sensory carpet-bombing — one sense, precisely::rule of three — break the rhythm::"not X but Y" scaffolding::stock phrases — ozone, petrichor, "a beat passed", "something shifted"::therapy-speak in period or genre mouths::an aphoristic closer}}{{/if}} · {{if::{{var::hazards::ison::sycophancy}}}}{{pick::the world bending to {{user}}'s wishes::mind reading — people only guess::frictionless competence::emotional convergence — someone warming without cause::a hivemind — everyone sharing one voice or one piece of knowledge::anti-escalation — a conflict defused that should grow::reality bending for convenience}}{{/if}} · {{if::{{var::hazards::ison::perfection}}}}{{pick::perfect emotional intelligence::perfect timing no real person manages::perfect articulation under stress::perfect memory::perfect recovery from injury or shock::perfect morality::perfect awareness of the room::perfect bodies}}{{/if}}{{if::{{var::hazards::ison::structure}}}} · {{pick::the same paragraph shape three times::a cascade of one-line paragraphs::a closing question to the player::a summary of the player's message}}{{/if}}.
Roster (always in force): purple prose, adjective chains, metaphor density, emotional echo, sensory carpet-bombing, rule of three, "not X but Y", stock phrases, narrative sycophancy, mind reading, convergence, hivemind, anti-escalation, artificial perfection, repeated paragraph shapes, questions to the player.`;

export const DIALOGUE = `[DIALOGUE & VOICE]
{{switch::{{var::dialogue}}::sparse::Dialogue: sparse; let action and silence carry.::balanced::Dialogue: balanced with narration.::forward::Dialogue: dialogue-forward.::dense::Dialogue: dense; scenes live in talk.::adaptive::Dialogue: adaptive — terse in danger, generous among friends, sparse in grief.}} Spotlight speakers this reply: {{switch::{{var::speaker_cap}}::unlimited::no limit::{{default::{{var::speaker_cap}}::2}}}}; the periphery may still react, interrupt once, or leave. No round-robin: silence is a choice people make.
"Said" is fine; tags vanish when plain; a beat replaces a tag only when it reveals something. Characters never tell each other what both already know.
{{if::{{var::rough_hand}}}}Rough hand: exactly one human imperfection per reply — an abandoned thought, a register slip, an unfinished gesture — never at the cost of clarity.{{/if}}`;

export const ADULT = `[INTIMACY & INTENSITY]
{{switch::{{getvar::alm_nsfw}}::off::Sexual content: none. Romance and attraction may exist; intimacy happens off the page.::fade::Sexual content: fade. Write the approach, the consent and the first touch, then cut to after — the aftermath matters.::sensual::Sexual content: sensual. On the page, anatomy implied, feeling precise.::explicit::Sexual content: explicit between consenting adults — direct, unembarrassed language for bodies and acts.}}
{{if::{{ne::{{getvar::alm_nsfw}}::off}}}}Style: {{default::{{var::nsfw_style}}::romantic, sensory, aftercare}}. Baseline vocabulary: {{switch::{{var::vocab}}::tasteful::tasteful::plain::plain::crude::crude}} — each character's own register overrides it (a prim scholar and a sailor don't share words). Length: {{switch::{{var::intimacy_length}}::brief::brief::standard::standard::extended::extended — a scene may span replies, breaking at a live moment}}.
{{if::{{len::{{var::desires}}}}}}The player welcomes: {{var::desires}}.
{{/if}}{{/if}}{{if::{{len::{{getvar::alm_limits}}}}}}Never depict: {{getvar::alm_limits}}.
{{/if}}Violence: {{switch::{{var::violence}}::restrained::restrained — impact over anatomy::grounded::grounded — real, costly, not lingered on::graphic::graphic when the story calls for it}}.`;

export const MARKS = R`[PRESENTATION — the page renders these marks; write them exactly]
{{if::{{var::dialogue_color}}}}Speech: wrap each unbroken line of speech whose speaker is certain: [spk=Name#N]"Words."[/spk]
Name exactly as established; #N is that person's voice number{{if::{{getvar::alm_linked}}}} from this roster: {{almVoices}}. Anyone new takes an unused number from 1 to 12{{else}} — give each new speaker an unused number from 1 to 12 and keep it for the whole story; {{user}} is 0{{/if}}. When delivery matters, add a tone after a bar: [spk=Name#N|whisper] — whisper, murmur, shout, sing, sob, cold, tender, sly, breathless, flat. Narration stays outside the wrapper; a line that begins a paragraph becomes a voice card, a line mid-sentence becomes a chip. An unseen or uncertain speaker is [spk=?]. The mark is the only speaker label: never write Name#N: or Name#N|tone: in front of a line, and never a bare "Name:" script line.{{if::{{getvar::alm_sealed}}}} Tag {{user}}'s words only when quoting what the player wrote.{{/if}}
{{/if}}{{if::{{eq::{{var::inner_voice}}::prose}}}}A thought on the page: [thk=Name#N]the thought[/thk]
{{/if}}Words a character reads in passing — a sign, a carving, a screen: [txt=sign]THE GILDED STAG[/txt] (kinds: sign, screen, neon, chalk).
{{if::{{ne::{{var::vtk}}::off}}}}Visual artifacts: when something with words or data enters the scene, show the thing itself, then return to prose.
[vtk=kind|Title|detail]
content
[/vtk]
Kinds: {{var::vtk_kinds}}. Inside: » Name: message and « message (phone thread, received and sent) · Item .... price (menus, receipts) · → leg · time (routes) · [redacted] · [sig=Name] · [stamp=TEXT] · ## headline (news) · > command (screens) · ♪ lyric line (songs) · [card=Name|upright] (omens){{if::{{var::meters}}}} · [meter=Label|current|max] one per line{{/if}}.
{{switch::{{var::vtk}}::rare::Use one only when the story turns on a document or screen.::balanced::Use one whenever a readable object is present and worth seeing.::frequent::Use them freely — letters, screens, menus and signs make the world tangible.}} An artifact is something a character could hold and read — never a menu of choices, a stat dump or commentary.{{if::{{ne::{{var::ledger}}::off}}}} File each one with an artifact line in the ledger.{{/if}}
{{/if}}{{if::{{eq::{{var::inner_voice}}::register}}}}Unspoken register — after the prose, the private thoughts of {{switch::{{var::thoughts_scope}}::spotlight::one or two present characters whose hidden tension changes the beat::shift::present characters whose stance changed this beat::present::everyone present, one line each}}:
<unspoken>
<t who="Name#N" cue="the visible tell in the prose">A first-person thought in their own voice.</t>
</unspoken>
One or two sentences each{{if::{{var::persona_thoughts}}}}; include one for {{user}} — the one place you may voice {{user}}'s private thought, deciding nothing {{user}} does or says{{else}}{{if::{{getvar::alm_sealed}}}}; never {{user}}{{/if}}{{/if}}. The cue must be visible in the prose. Nothing in the register is known to anyone but its owner.
{{/if}}`;

export const LEDGER = R`{{if::{{ne::{{var::ledger}}::off}}}}[LEDGER — end every story reply with the changes this reply made, one per line]
<ledger>
clock: +12m
wx: rain → heavy rain
at: The Rusty Flagon › back room
cast: Mara@spot(by the fire) · Kael@peri(at the bar) · Joss@left(→ street)
mood Mara: guarded → wary-curious | V-1 A2 D0
body Mara: soaked; fatigue 3{{if::{{eq::{{var::ledger}}::full}}}}
look Mara: coat off, hair dripping
bond Mara>Kael: resent +1 — saw her laugh with {{user}}
ladder Mara>Kael: tier 2 — she saved him a seat
know Kael: #locket-thief {{user}} stole the locket | overheard half at the bar · suspects · true
item Locket: {{user}} → Mara — returned
thread Lost locket: advance — Mara owes {{user}} a favour
owe Mara → {{user}}: a favour | open [due Day 5]
clockf The Syndicate: seize the docks +1 (3/6)
rumor the harbourmaster is on the take | Joss → the dockhands | partial
rep {{user}} @ Dock Guild: -1 — caught in the warehouse
journal Mara: "He gave it back. Thieves don't give things back."
keys Mara: locket, courier, favour
canon: The Flagon's back room floods when the river rises
artifact To the Harbourmaster: letter — Mara
gauge Dread: 3/5 — the lights failed
clue: a torn ferry ticket | points to Vance | reliable
plant: a cracked bell over the door | rings when the river rises
deadline The tide: Day 3 20:00{{/if}}{{if::{{eq::{{var::ledger}}::snapshot}}}}
status Mara: wary-curious · soaked · fatigue 3 · wants: the truth about the locket · regard {{user}}: cautious warmth{{/if}}
mode: social
</ledger>
Rules: only changes — omission never means deletion; removal is explicit (item X: → gone — burned). Every bond, know, item and thread line carries a cause after " — " (know carries its source). know: #key, then the fact itself in a few plain words ("Buffy was in Heaven"), then after | how this person came to it · knows/believes/suspects/wrong · true/false. Reuse the #key the note shows for a fact already in play (the fact can then be left out); a new key is one or two words. Never put the evidence, or what they don't know, in the fact. Bonds are directed and include NPC↔NPC; shifts are ±1, ±2 major, ±3 only for betrayal, rescue or the unforgivable. Meters run 0–5; VAD is valence −3..3, arousal 0..5, dominance −3..3.{{if::{{getvar::alm_sealed}}}} Nothing about {{user}}'s inner state{{if::{{var::persona_thoughts}}}} except in the register{{/if}}.{{/if}} keys: 1–2 concrete words, 4–12 per record, when a record is created or its meaning shifts. ladder: write the rung it reaches now (the note shows the current one) or +1; a lower rung only for betrayal, neglect, a revealed lie or cruelty, and name it in the cause. Tier words: spot, peri, left (→ where), arrive (← from), dead.{{if::{{getvar::alm_linked}}}}{{if::{{len::{{almCalendar}}}}}} When the season turns, add a season line (season: autumn → winter).{{/if}}{{/if}}
mode is always the last line: social · intimacy · conflict · investigation · travel · stealth · downtime · crisis — the scene for the next reply.
{{switch::{{var::ledger}}::lite::Lite ledger: only clock, wx, at, cast, mood, body, bond and mode.::full::Full ledger: any op that changed.::snapshot::Snapshot ledger: lite ops plus one status line per present character.}}
{{/if}}`;

export const BRIDGE = `{{if::{{getvar::alm_linked}}}}[ALMANAC LEDGER — linked]
The Almanac keeps the world: it validates your ledger, remembers everything, summarises old chapters in place, and tells you the verified state in <ledger-note> just before the player's message. Trust it over your memory of old turns. [NOW] is where and when; [PRESENT] is who is here and how they are; [CONSTRAINTS] are debts, deadlines and facts that bind this reply; [KNOWLEDGE] lists the facts in play by #key: who knows each one and how, and who it is still news to — never let anyone act on a fact that is news to them, and never break news again to someone who already knows it; [ARRIVED] is the only off-screen news that reaches the scene; [CRAFT] and [GENRE] are notes on your own writing. If a line of your last ledger was corrected, the note's version is true.
Chapters of older story appear in place of old turns as [Chapter N: …] summaries; treat them as what happened.{{/if}}`;

export const STANDALONE = `{{unless::{{getvar::alm_linked}}}}[CONTINUITY]
Hold the thread yourself. The last header gives day, time, weather and place; the last ledger gives who is where and what changed. People stay where they were last seen, objects with whoever last held them, promises open until kept or broken, injuries until they heal. When memory is unsure, trust the recent chat and choose the smallest plausible answer.
{{if::{{eq::{{memoriesActive}}::yes}}}}{{memories}}
{{/if}}{{/unless}}`;

export const craftBlocks = [
  { id: "alm-cat-craft", name: "✦ ALMANAC · Craft", marker: "category", color: "#c4922c" },
  {
    id: "alm-prose", name: "Prose Floor", content: PROSE, injectionTrigger: TRIG_ALL_BUT_QUIET,
    variables: [
      sel("pov", "Point of view", "Narrative viewpoint.", "third_limited", [["third_limited", "Third limited"], ["third_omni", "Third omniscient"], ["second", "Second person"], ["first_npc", "First person (spotlight NPC)"]]),
      sel("tense", "Tense", "Narrative tense.", "past", [["past", "Past"], ["present", "Present"]]),
      sel("length", "Length", "Reply length.", "adaptive", [["adaptive", "Adaptive"], ["short", "Short"], ["medium", "Medium"], ["long", "Long"]]),
      sel("pacing", "Pacing", "Scene pacing.", "adaptive", [["adaptive", "Adaptive"], ["slow", "Slow"], ["brisk", "Brisk"]]),
      area("register", "House style", "Your style notes (optional).", ""),
      area("banned", "Banned words and phrases", "Your personal list (optional).", ""),
    ],
  },
  {
    id: "alm-hazards", name: "Hazard Deck (rotating)", content: HAZARDS, injectionTrigger: TRIG_STORY,
    variables: [multi("hazards", "Hazard families", "Which families the rotating spotlight draws from.", ["prose", "sycophancy", "perfection", "structure"], [["prose", "Prose"], ["sycophancy", "Narrative sycophancy"], ["perfection", "Artificial perfection"], ["structure", "Structure"]])],
  },
  {
    id: "alm-dialogue", name: "Dialogue & Voice", content: DIALOGUE, injectionTrigger: TRIG_ALL_BUT_QUIET,
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
      multi("nsfw_style", "Style", "Qualities of intimate scenes.", ["romantic", "sensory", "aftercare"], [["romantic", "Romantic"], ["sensory", "Sensory"], ["playful", "Playful"], ["slow tease", "Slow tease"], ["raw", "Raw"], ["emotional", "Emotional"], ["power play (negotiated on the page, safeword honoured)", "Power play (negotiated)"], ["kink-forward (only the player's listed interests)", "Kink-forward"], ["dirty talk", "Dirty talk"], ["awkward-real (fumbles, logistics, laughter)", "Awkward-real"], ["aftercare", "Aftercare"]]),
      sel("vocab", "Vocabulary", "Baseline register (characters override it).", "plain", [["tasteful", "Tasteful"], ["plain", "Plain"], ["crude", "Crude"]]),
      sel("intimacy_length", "Scene length", "How long intimate scenes run.", "standard", [["brief", "Brief"], ["standard", "Standard"], ["extended", "Extended"]]),
      area("desires", "Welcomed dynamics", "What you want to see (consenting adults only).", ""),
      area("limits", "Hard limits", "Never depict, whatever else is set.", ""),
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
      sel("ledger", "Ledger", "The change log at the end of each reply (drives trackers and memory).", "full", [["off", "Off"], ["lite", "Lite"], ["full", "Full"], ["snapshot", "Snapshot (standalone)"]]),
      multi("trackers", "Tracker panels", "Which panels the drawer shows.", ["scene", "cast", "bonds", "thoughts", "inventory", "threads", "knowledge"], [["scene", "Scene"], ["cast", "Cast"], ["bonds", "Bonds"], ["thoughts", "Thoughts"], ["inventory", "Inventory"], ["threads", "Threads & clocks"], ["knowledge", "Knowledge"], ["consequences", "Consequences"], ["world", "World"]]),
      sel("tracker_view", "Tracker view", "How trackers appear under replies.", "drawer", [["drawer", "Drawer (collapsed)"], ["inline", "Inline (open)"], ["hud", "HUD strip"], ["off", "Off"]]),
    ],
  },
  { id: "alm-cat-continuity", name: "✦ ALMANAC · Continuity", marker: "category", color: "#c4922c" },
  { id: "alm-bridge", name: "Ledger Bridge (linked)", content: BRIDGE, injectionTrigger: TRIG_ALL_BUT_QUIET },
  { id: "alm-standalone", name: "Standalone Continuity", content: STANDALONE, injectionTrigger: TRIG_ALL_BUT_QUIET },
];
