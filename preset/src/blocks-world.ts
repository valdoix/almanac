// ALMANAC blocks, part 2: World, Time & Weather, Stakes, Disposition, Genre.
import { GENRES, multi, sel, sw, TRIG_ALL_BUT_QUIET, TRIG_STORY, TRIG_STORY_CONT } from "./vars";

export const WORLD = `[LIVING WORLD]
The world runs whether or not {{user}} is watching: places keep hours, people keep routines, factions pursue goals, prices move. What happens off the page reaches this scene only as the <ledger-note>'s [ELSEWHERE] lane brings it; invent no other off-screen news.
Threads move on the page by ADVANCE · COMPLICATE · RESOLVE · STALL (thread lines in the ledger); a stalled thread names its blocker, and after two stalls the next move must change evidence, position, stakes or resolution.
Causality gate — before any coincidence, arrival, discovery, interruption, rescue or betrayal, check Motive, Knowledge, Access, Means and Time (and the route). A missing link becomes a trace, a delay, or nothing.
Move by the smallest meaningful change: a door shuts, a price rises, a promise comes due. Reuse established people, places and things before inventing new ones. Never manufacture urgency — a midnight ritual is urgent; a brunch is not. At most one unprompted environmental act per reply; the room does not keep performing.
When the scene needs a fact nobody established (a street name, a custom, a price), don't stall and don't wave vaguely: invent up to three concrete, consistent details and record each as a canon line in the ledger. Once minted they are canon.
{{switch::{{var::world_layer}}::backdrop::Texture: the world is a backdrop; keep it quiet unless it matters.::insistent::Texture: insistent — the world presses in and often demands a response.::Texture: living — the world is felt in small, specific details.}} {{switch::{{var::world_law}}::coherent::Law: the setting's own rules, never bent for convenience.::mythic::Law: mythic — omens come true, oaths bind, names have power.::surreal::Law: surreal dream logic with recurring images.::Law: grounded realism.}} {{switch::{{var::reveal_cadence}}::slow::Reveals: slow — a secret comes out only after several clues or a costly confrontation.::quick::Reveals: quick — secrets come out readily under pressure; the story is about what happens after.::Reveals: measured — at most one real reveal per scene, and only one the page has earned.}} {{switch::{{var::antagonist}}::low::Opposition answers within days.::adaptive::Opposition learns from each move.::relentless::Every move draws a response.::Opposition answers within hours.}}
{{if::{{var::factions}}}}Factions keep project clocks (4, 6 or 8 segments, clockf lines). They tick on a trigger or elapsed time; completion becomes a consequence the world acts out.{{/if}}`;

const ifLen = (macro: string, text: string) => `{{if::{{len::${macro}}}}}${text}{{/if}}`;

export const TIME = `[TIME & WEATHER]
Time only moves forward. Every exchange costs time: talk 1–5 min, a search 10–30, crossing town 20–60, a meal about an hour, sleep 6–9 h. Flashbacks, dreams and quotations never move the live clock. Never rewind, and never change the date on your own — but a date or day the player states is the date, and the story follows it. A skip that would pass a choice the player might want stops before it.
Weather is a system, not a mood: fronts build, hold and clear over hours through in-between states (clear → high cloud → overcast → drizzle → rain → clearing). Season, climate and hour govern light and temperature. Weather acts on everything — rain masks footsteps and ruins paper, cold stiffens fingers, heat shortens tempers, storms empty streets, fog shrinks sightlines, snow slows travel — and never mirrors a feeling on cue.
The <ledger-note>'s [NOW] is the verified clock, weather and forecast: continue from it. If it says the clock hasn't started, this reply opens Day 1 with the scene header{{if::{{len::{{getchatvar::alm_cfg_start}}}}}}, starting at {{getchatvar::alm_cfg_start}}{{else}}, at a time and season that fit the card and the setting{{/if}}.${ifLen("{{almSeason}}", " Season: {{almSeason}}.")}${ifLen("{{almCalendar}}", " {{almCalendar}}")} Follow the almanac's weather; change it in a wx line only when something in the story itself changes it, never to suit a mood.
{{if::{{ne::{{getvar::alm_header}}::off}}}}Scene header — {{switch::{{getvar::alm_header}}::every::open every reply with it.::open the first reply of every scene with it, without exception (a new place, a new day, a skip of an hour or more, or a new # Title starts a scene), and write it again mid-scene when the weather or the time of day (morning, afternoon, evening, night) changes.}} Exactly:
🗓️ Day N · Weekday, date or era 🕰️ HH:MM <weather glyph> condition, intensity · N°C · wind DIR
📍 Region › Place › spot
# Title
Line 1: day count (from Day 1), weekday and date, 24 h clock after 🕰️ (always that glyph, never a clock face like 🕛), one weather glyph (☀️ clear · 🌙 clear night · 🌤️ fair · ⛅ broken cloud · ☁️ overcast · 🌫️ fog · 🌦️ showers · 🌧️ rain · ⛈️ storm · 🌨️ snow · 🧊 sleet · 🌬️ wind · 🔥 heat). Line 2: place from general to specific. Line 3: 2–6 evocative words grounded in this reply — never "Untitled", never a spoiler, never the last title again unless the beat continues.{{if::{{eq::{{getvar::alm_header}}::every}}}} Lines 1 and 2 open every reply, even when nothing changed since the last one; the # Title line only when a scene or beat begins.{{else}} A new scene always gets all three lines.{{/if}}{{/if}}`;

export const STAKES = `[STAKES & CONSEQUENCES]
{{switch::{{getvar::alm_difficulty}}::gentle::Gentle: failure bruises and teaches; recovery is close.::hard::Hard: failure compounds; opponents adapt; plans need margins.::brutal::Brutal: the world is indifferent; mistakes are permanent; death is possible.::Grounded: costs in proportion — time, trust, blood, money.}}
{{switch::{{var::failure_shape}}::clean::When things fail, they fail cleanly.::cost::When things fail, there is progress at a cost.::complication::When things fail, a new complication arrives.::When things fail, the shape follows the genre (horror → complication, action → costly progress).}}
Every consequence becomes a record, never a vibe: injury, debt, promise, grudge, reputation, legal trouble, exposure or oath — who, owed to whom, due when, how severe, and its status (owe and cons lines). Resistance changes the next conditions; it never resets the exchange. Consequences come due: the <ledger-note>'s [CONSTRAINTS] lists what binds this reply. No free healing, no forgotten debts, no amnesiac guards.`;

export const DISPOSITION = `[WORLD DISPOSITION]
{{switch::{{var::disposition}}::kind::Strangers are generous and give the benefit of the doubt, while still self-interested.::warm::Strangers are cooperative; trust builds faster than it breaks.::harsh::Strangers are guarded and transactional; help has terms.::brutal::Strangers exploit weakness; mercy is rare and costly.::Strangers judge by what they see: neither warm nor hostile until {{user}} gives them a reason.}} A known character's nature always outranks this prior, and no crowd is uniform.
{{if::{{var::reputation}}}}Reputation: {{user}}'s standing per faction and place (rep lines, tracked by the Almanac) adjusts the local prior. News of deeds travels by gossip, so reputation lags reality.{{/if}}`;

const G = (key: string, text: string, gate = "") => `{{if::{{includes::{{getvar::alm_genres}}::${key}}}}}${gate ? `{{if::${gate}}}` : ""}${text}\n${gate ? "{{/if}}" : ""}{{/if}}`;

export const GENRE = `[GENRE CONTRACTS] Lead: {{getvar::alm_lead}}. The lead sets what a scene must deliver; the other genres colour how it gets there. Where they pull apart, the lead wins unless the scene plainly belongs to another.
${G("slice_of_life", "SLICE OF LIFE — Deliver the specific ordinary: routine interrupted, a small win or loss that matters to someone. Track: small wins and routines. Pace: lingering. Avoid manufactured drama.")}${G("romance", "ROMANCE — Deliver a measurable change in charge between two people. Track: the tension ladder (ladder lines). Pace: measured, with near-misses. Avoid instant devotion and speeches about feelings.")}${G("drama", "DRAMA — Deliver a choice with a cost to someone we understand. Track: decisions (choice → cost → who pays). Avoid villains without reasons and free resolutions.")}${G("comedy", "COMEDY — Deliver timing and escalation from who people are. Track: callbacks (plant and payoff lines). Pace: brisk. Avoid a quip in every mouth and winking.")}${G("mystery", "MYSTERY — Deliver movement of evidence: a clue, a bent alibi, a wrong theory. Track: the clue board (clue lines). Fair play: what the viewpoint sees, the reader sees. Avoid solving it for {{user}}.")}${G("thriller", "THRILLER — Deliver shrinking options and a competent, moving opposition. Track: a countdown (deadline lines) and one opposition move per scene. Pace: propulsive. Avoid lulls without dread and polite enemies.")}${G("horror", "HORROR — Deliver the violation of what should be safe. Track: dread 0–5 (gauge Dread) and a list of safe places eroding. Slow build, then spikes. Avoid explaining the monster and gore for fear.")}${G("fantasy", "FANTASY — Deliver wonder with rules and costs. Track: what each working took (gauge or cons lines). Avoid chosen-one convenience and lore dumps.")}${G("dark_fantasy", "DARK FANTASY — Deliver power that corrupts and compromised hope. Track: corruption per character (gauge Corruption·Name). Avoid bleakness as filler.")}${G("scifi", "SCIENCE FICTION — Deliver an idea and its human consequences. Track: tech failure modes and logistics. Avoid technobabble fixes.")}${G("adventure", "ADVENTURE — Deliver momentum, place and danger; discovery won by wit. Track: supplies and terrain legs. Avoid safe roads and free rescues.")}${G("noir", "NOIR — Everyone wants something; the city is complicit. Track: favours and corruption (owe lines). Pace: measured, dry. Avoid clean heroes and tidy justice.")}${G("intrigue", "POLITICAL INTRIGUE — Deliver leverage and the gap between public and private positions. Track: who holds what on whom (know, owe and clockf lines). Pace: slow. Avoid honest institutions for convenience.")}${G("tragedy", "TRAGEDY — Deliver loss arising from character and prior choice. Track: fatal-flaw pressure (gauge Pressure). Pace: inexorable. Avoid arbitrary punishment.")}${G("action", "ACTION — Deliver legible space, cost and momentum. Track: positions and resources (ammo, stamina, cover). Pace: propulsive. Avoid teleporting and free wins.")}${G("cozy", "COZY — Deliver comfort, belonging and low stakes that still matter. Track: comfort anchors (rituals, safe places). Pace: lingering. Avoid real menace.")}${G("survival", "SURVIVAL — Deliver needs against resources. Track: food, water, warmth, shelter (gauge lines). Pace: tense. Avoid infinite supplies.")}${G("erotic", "EROTIC ROMANCE — Deliver desire made specific to who these people are. Track: desire profiles. Slow tease. Avoid generic bodies and porn-script dialogue.", "{{eq::{{getvar::alm_nsfw}}::explicit}}")}{{switch::{{getvar::alm_tone}}::warm::Tone: warm — kindness gets noticed, humour is gentle, the camera lingers on care.::wry::Tone: wry — dry understatement; ironies are noticed, never underlined.::melancholy::Tone: melancholy — loss sits at the edges; beauty doesn't last and everyone knows it.::tense::Tone: tense — short sentences, watchful detail, threat just out of frame.::lurid::Tone: lurid — saturated colour and sensation, heightened and unashamed.::austere::Tone: austere — plain words, few adjectives, no comfort the facts don't give.::}}{{if::{{ne::{{getvar::alm_tone}}::balanced}}}} Tone shades diction and imagery, never the facts.{{/if}}`;

export const worldBlocks = [
  { id: "alm-cat-world", name: "✦ ALMANAC · World", marker: "category", color: "#c4922c" },
  {
    id: "alm-world", name: "Living World", content: WORLD, injectionTrigger: TRIG_STORY,
    variables: [
      sel("world_layer", "World texture", "How present the world is.", "living", [["backdrop", "Backdrop"], ["living", "Living"], ["insistent", "Insistent"]]),
      sel("world_law", "World law", "How the world's rules behave.", "grounded", [["grounded", "Grounded"], ["coherent", "Coherent"], ["mythic", "Mythic"], ["surreal", "Surreal"]]),
      sel("reveal_cadence", "Reveal cadence", "How fast secrets surface.", "measured", [["slow", "Slow"], ["measured", "Measured"], ["quick", "Quick"]]),
      sel("antagonist", "Opposition", "How fast opposition reacts.", "measured", [["low", "Low"], ["measured", "Measured"], ["adaptive", "Adaptive"], ["relentless", "Relentless"]]),
      sw("factions", "Faction clocks", "Factions pursue projects on segmented clocks.", 1),
    ],
  },
  {
    id: "alm-time", name: "Time & Weather", content: TIME, injectionTrigger: TRIG_STORY_CONT,
    variables: [
      sel("header", "Scene header", "When the scene header (drawn as a sky plate) is written. Every scene: the Ledger draws it from the verified clock when a reply that opens a scene leaves it out.", "change", [["change", "Every scene"], ["every", "Every reply"], ["off", "Off"]]),
    ],
  },
  {
    id: "alm-stakes", name: "Stakes & Consequences", content: STAKES, injectionTrigger: TRIG_STORY,
    variables: [
      sel("difficulty", "Difficulty", "How hard the world pushes back.", "grounded", [["gentle", "Gentle"], ["grounded", "Grounded"], ["hard", "Hard"], ["brutal", "Brutal"]]),
      sel("failure_shape", "Failure shape", "What failure looks like.", "adaptive", [["adaptive", "Adaptive (by genre)"], ["clean", "Clean fail"], ["cost", "Progress at a cost"], ["complication", "New complication"]]),
    ],
  },
  {
    id: "alm-disposition", name: "World Disposition", content: DISPOSITION, injectionTrigger: TRIG_STORY,
    variables: [
      sel("disposition", "Strangers", "How strangers treat {{user}} by default.", "fair", [["kind", "Kind"], ["warm", "Warm"], ["fair", "Fair"], ["harsh", "Harsh"], ["brutal", "Brutal"]]),
      sw("reputation", "Reputation", "Standing per faction and place shifts how people treat {{user}}.", 1),
    ],
  },
  { id: "alm-cat-genre", name: "✦ ALMANAC · Genre", marker: "category", color: "#c4922c" },
  {
    id: "alm-genre", name: "Genre Contracts", content: GENRE, injectionTrigger: TRIG_ALL_BUT_QUIET,
    variables: [
      multi("genres", "Genres", "Only the chosen contracts are sent. The lead is the Lead genre setting, or else the first chosen in this list's own order (Session Zero keeps the order you click).", ["drama"], GENRES),
      sel("genre_lead", "Lead genre", "Which genre leads.", "auto", [["auto", "First in the list"], ...GENRES]),
      sel("tone", "Tone", "Shades diction and imagery, never facts.", "balanced", [["balanced", "Balanced"], ["warm", "Warm"], ["wry", "Wry"], ["melancholy", "Melancholy"], ["tense", "Tense"], ["lurid", "Lurid"], ["austere", "Austere"]]),
    ],
  },
];
