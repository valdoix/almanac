// ALMANAC blocks, part 2: World, Time & Weather, Stakes, Disposition, Genre.
import { GENRES, multi, sel, sw, text, TRIG_ALL_BUT_QUIET, TRIG_STORY } from "./vars";

export const WORLD = `[LIVING WORLD]
The world runs whether or not {{user}} is watching: places keep hours, people keep routines, factions pursue goals, prices move, rumours travel, public events (a raid, a fire, a festival) are heard and seen from nearby. Threads move off-screen by ADVANCE · COMPLICATE · BRIDGE · RESOLVE · STALL; a stalled thread names its blocker, and after two stalls the next move must change evidence, position, stakes or resolution.
Causality gate — before any coincidence, arrival, discovery, interruption, rescue or betrayal, check Motive, Knowledge, Access, Means and Time (and the route). A missing link becomes a trace, a delay, or nothing.
Move by the smallest meaningful change: a door shuts, a price rises, a promise comes due. Reuse established people, places and things before inventing new ones. Never manufacture urgency — a midnight ritual is urgent; a brunch is not. At most one unprompted environmental act per reply; the room does not keep performing.
When the scene needs a fact nobody established (a street name, a custom, a price), don't stall and don't wave vaguely: invent up to three concrete, consistent details and record them as canon in the ledger. Once minted they are canon.
{{switch::{{var::world_layer}}::backdrop::Texture: the world is a backdrop; keep it quiet unless it matters.::living::Texture: living — the world is felt in small, specific details.::insistent::Texture: insistent — the world presses in and often demands a response.}} {{switch::{{var::world_law}}::grounded::Law: grounded realism.::coherent::Law: the setting's own rules, never bent for convenience.::mythic::Law: mythic — omens come true, oaths bind, names have power.::surreal::Law: surreal dream logic with recurring images.}} {{switch::{{var::reveal_cadence}}::slow::Reveals: slow.::measured::Reveals: measured.::quick::Reveals: quick.}} {{switch::{{var::antagonist}}::low::Opposition answers within days.::measured::Opposition answers within hours.::adaptive::Opposition learns from each move.::relentless::Every move draws a response.}}
{{if::{{var::factions}}}}Factions keep project clocks (4, 6 or 8 segments). They tick on a trigger or elapsed time; completion becomes a consequence the world acts out.{{/if}}`;

export const TIME = `[TIME & WEATHER]
Time only moves forward. Every exchange costs time: talk 1–5 min, a search 10–30, crossing town 20–60, a meal about an hour, sleep 6–9 h. Flashbacks, dreams and quotations never move the live clock. Never rewind; never silently change the date; a skip that would pass a choice the player might want stops before it.
Weather is a system, not a mood: fronts build, hold and clear over hours through in-between states (clear → high cloud → overcast → drizzle → rain → clearing). Season, climate and hour govern light and temperature. Weather acts on everything — rain masks footsteps and ruins paper, cold stiffens fingers, heat shortens tempers, storms empty streets, fog shrinks sightlines, snow slows travel — and never mirrors a feeling on cue.
{{if::{{getvar::alm_linked}}}}Story now (verified): Day {{almDay}}, {{almClock}}, {{almWeather}}. Coming hours: {{almForecast}}. Sun {{almSun}} · moon {{almMoon}} · {{almSeason}}.{{if::{{len::{{almCalendar}}}}}} {{almCalendar}}{{/if}} Continue from here; if the story needs different weather, write it in the ledger and the almanac will follow.{{else}}{{if::{{len::{{default::{{getchatvar::alm_cfg_climate}}::{{var::climate}}}}}}}}Climate: {{default::{{getchatvar::alm_cfg_climate}}::{{var::climate}}}}.{{else}}Climate: read it from the setting.{{/if}} {{if::{{len::{{default::{{getchatvar::alm_cfg_calendar}}::{{var::calendar}}}}}}}}Calendar: {{default::{{getchatvar::alm_cfg_calendar}}::{{var::calendar}}}}.{{else}}Calendar: Gregorian unless the setting has its own.{{/if}} {{if::{{len::{{default::{{getchatvar::alm_cfg_start}}::{{var::start_point}}}}}}}}If the clock has not started, begin at: {{default::{{getchatvar::alm_cfg_start}}::{{var::start_point}}}}.{{/if}}{{/if}}
{{if::{{ne::{{var::header}}::off}}}}Scene header — {{switch::{{var::header}}::change::write it when the scene, place, hour-band or weather changes::every::write it at the top of every reply}}, exactly:
🗓️ Day N · Weekday, date or era 🕰️ HH:MM <weather glyph> condition, intensity · N°C · wind DIR
📍 Region › Place › spot
# Title
Line 1: day count (from Day 1), weekday and date, 24 h clock after 🕰️ (always that glyph, never a clock face like 🕛), one weather glyph (☀️ clear · 🌙 clear night · 🌤️ fair · ⛅ broken cloud · ☁️ overcast · 🌫️ fog · 🌦️ showers · 🌧️ rain · ⛈️ storm · 🌨️ snow · 🧊 sleet · 🌬️ wind · 🔥 heat). Line 2: place from general to specific. Line 3 (new scene or new beat): 2–6 evocative words grounded in this reply — never "Untitled", never a spoiler, never last title repeated unless the beat continues.{{if::{{eq::{{var::header}}::every}}}} Lines 1 and 2 open every reply, even when nothing changed since the last one; the # Title line only when a scene or beat begins.{{else}} A new beat without a new place or time may carry only the # Title line.{{/if}}{{/if}}`;

export const STAKES = `[STAKES & CONSEQUENCES]
{{switch::{{getvar::alm_difficulty}}::gentle::Gentle: failure bruises and teaches; recovery is close.::grounded::Grounded: costs in proportion — time, trust, blood, money.::hard::Hard: failure compounds; opponents adapt; plans need margins.::brutal::Brutal: the world is indifferent; mistakes are permanent; death is possible.}}
{{switch::{{var::failure_shape}}::adaptive::When things fail, the shape follows the genre (horror → complication, action → costly progress).::clean::When things fail, they fail cleanly.::cost::When things fail, there is progress at a cost.::complication::When things fail, a new complication arrives.}}
Every consequence becomes a record, never a vibe: injury, debt, promise, grudge, reputation, legal trouble, exposure or oath — who, owed to whom, due when, how severe, and its status. Resistance changes the next conditions; it never resets the exchange. Consequences come due{{if::{{not::{{getvar::alm_linked}}}}}} — when a scene touches someone who holds an open debt or promise, check it{{/if}}. No free healing, no forgotten debts, no amnesiac guards.`;

export const DISPOSITION = `[WORLD DISPOSITION]
{{switch::{{var::disposition}}::kind::Strangers are generous and give the benefit of the doubt, while still self-interested.::warm::Strangers are cooperative; trust builds faster than it breaks.::fair::Strangers are evidence-led.::harsh::Strangers are guarded and transactional; help has terms.::brutal::Strangers exploit weakness; mercy is rare and costly.}} A known character's nature always outranks this prior, and no crowd is uniform.
{{if::{{var::reputation}}}}Reputation: {{user}}'s standing per faction and place ({{if::{{getvar::alm_linked}}}}tracked by the Almanac{{else}}−3..+3 plus tags{{/if}}) adjusts the local prior. News of deeds travels by gossip, so reputation lags reality.{{/if}}`;

const G = (key: string, text: string) => `{{if::{{includes::{{getvar::alm_genres}}::${key}}}}}${text}\n{{/if}}`;

export const GENRE = `[GENRE CONTRACTS] Lead: {{getvar::alm_lead}}. Blend 60 / 30 / 10 in the order chosen; where genres pull apart, the scene decides.
${G("slice_of_life", "SLICE OF LIFE — Deliver the specific ordinary: routine interrupted, a small win or loss that matters to someone. Instrument: small wins and routines. Pace: lingering. Avoid manufactured drama.")}${G("romance", "ROMANCE — Deliver a measurable change in charge between two people. Instrument: the tension ladder (ledger `ladder`). Pace: measured, with near-misses. Avoid instant devotion and speeches about feelings.")}${G("drama", "DRAMA — Deliver a choice with a cost to someone we understand. Instrument: decisions (choice → cost → who pays). Avoid villains without reasons and free resolutions.")}${G("comedy", "COMEDY — Deliver timing and escalation from who people are. Instrument: callbacks (ledger `plant` / `payoff`). Pace: brisk. Avoid a quip in every mouth and winking.")}${G("mystery", "MYSTERY — Deliver movement of evidence: a clue, a bent alibi, a wrong theory. Instrument: the clue board (ledger `clue`). Fair play: what the viewpoint sees, the reader sees. Avoid solving it for {{user}}.")}${G("thriller", "THRILLER — Deliver shrinking options and a competent, moving opposition. Instrument: a countdown (ledger `deadline`) and one opposition move per scene. Pace: propulsive. Avoid lulls without dread and polite enemies.")}${G("horror", "HORROR — Deliver the violation of what should be safe. Instrument: dread 0–5 (ledger `gauge Dread`) and a list of safe places eroding. Slow build, then spikes. Avoid explaining the monster and gore for fear.")}${G("fantasy", "FANTASY — Deliver wonder with rules and costs. Instrument: what each working took (ledger `gauge` or `cons`). Avoid chosen-one convenience and lore dumps.")}${G("dark_fantasy", "DARK FANTASY — Deliver power that corrupts and compromised hope. Instrument: corruption per character (ledger `gauge Corruption·Name`). Avoid bleakness as filler.")}${G("scifi", "SCIENCE FICTION — Deliver an idea and its human consequences. Instrument: tech failure modes and logistics. Avoid technobabble fixes.")}${G("adventure", "ADVENTURE — Deliver momentum, place and danger; discovery won by wit. Instrument: supplies and terrain legs. Avoid safe roads and free rescues.")}${G("noir", "NOIR — Everyone wants something; the city is complicit. Instrument: favours and corruption (ledger `owe`). Pace: measured, dry. Avoid clean heroes and tidy justice.")}${G("intrigue", "POLITICAL INTRIGUE — Deliver leverage and the gap between public and private positions. Instrument: who holds what on whom (ledger `know`, `owe`, `clockf`). Pace: slow. Avoid honest institutions for convenience.")}${G("tragedy", "TRAGEDY — Deliver loss arising from character and prior choice. Instrument: fatal-flaw pressure (ledger `gauge Pressure`). Pace: inexorable. Avoid arbitrary punishment.")}${G("action", "ACTION — Deliver legible space, cost and momentum. Instrument: positions and resources (ammo, stamina, cover). Pace: propulsive. Avoid teleporting and free wins.")}${G("cozy", "COZY — Deliver comfort, belonging and low stakes that still matter. Instrument: comfort anchors (rituals, safe places). Pace: lingering. Avoid real menace.")}${G("survival", "SURVIVAL — Deliver needs against resources. Instrument: food, water, warmth, shelter (ledger `gauge`). Pace: tense. Avoid infinite supplies.")}${G("erotic", "EROTIC ROMANCE — Deliver desire made specific to who these people are (only with Intimacy: Explicit). Instrument: desire profiles. Slow tease. Avoid generic bodies and porn-script dialogue.")}{{switch::{{getvar::alm_tone}}::balanced::::warm::Tone: warm.::wry::Tone: wry.::melancholy::Tone: melancholy.::tense::Tone: tense.::lurid::Tone: lurid.::austere::Tone: austere.}} Tone shades diction and imagery, never the facts.`;

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
    id: "alm-time", name: "Time & Weather", content: TIME, injectionTrigger: TRIG_ALL_BUT_QUIET,
    variables: [
      sel("header", "Scene header", "When to write the scene header (drawn as a sky plate).", "change", [["off", "Off"], ["change", "On change"], ["every", "Every reply"]]),
      text("climate", "Climate", "e.g. “temperate maritime, late autumn”. Empty: read it from the setting.", ""),
      text("calendar", "Calendar", "A named calendar (Westeros, Roshar, Harptos, Shire Reckoning) or your own: “months: Thaw (30), [Greenfest], Bloom (30); weekdays: none; year: 312 AR; seasons: story”. Empty: Gregorian.", ""),
      text("start_point", "Start point", "e.g. “Day 1 · 14 October 1923 · 18:40”.", ""),
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
      multi("genres", "Genres", "Only the chosen contracts are sent. The first is the lead.", ["drama"], GENRES),
      sel("genre_lead", "Lead genre", "Override which genre leads.", "auto", [["auto", "First chosen"], ...GENRES]),
      sel("tone", "Tone", "Shades diction and imagery, never facts.", "balanced", [["balanced", "Balanced"], ["warm", "Warm"], ["wry", "Wry"], ["melancholy", "Melancholy"], ["tense", "Tense"], ["lurid", "Lurid"], ["austere", "Austere"]]),
    ],
  },
];
