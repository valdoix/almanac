// ALMANAC blocks, part 4: Story Sources, the in-history reminders and Scene
// Modules (router-activated), and the Turn: Seal, Turn Frame, Impersonation,
// Director's Pass, Model Errata, Loom hooks and the Output Contract.
import { sel, TRIG_ALL_BUT_QUIET, TRIG_STORY, TRIG_STORY_CONT, R } from "./vars";

const IS_STORY = `{{or::{{eq::{{getvar::alm_route}}::scene}}::{{eq::{{getvar::alm_route}}::variant}}}}`;

// ── Story sources (markers) ─────────────────────────────────────────────────
const marker = (id: string, name: string, m: string) => ({ id, name, marker: m, content: "" });
export const sourceBlocks = [
  { id: "alm-cat-sources", name: "✦ ALMANAC · Story Sources", marker: "category", color: "#a79987" },
  marker("alm-system-prompt", "Character System Prompt", "system_prompt"),
  marker("alm-wi-before", "World Info · Before", "world_info_before"),
  marker("alm-char-description", "Character Description", "char_description"),
  marker("alm-char-personality", "Character Personality", "char_personality"),
  marker("alm-scenario", "Scenario", "scenario"),
  marker("alm-persona", "Persona", "persona"),
  marker("alm-wi-after", "World Info · After", "world_info_after"),
  marker("alm-mes-examples", "Example Messages", "mes_examples"),
  marker("alm-chat-history", "Chat History", "chat_history"),
];

// ── Anchor Reminder (in history; placement selector) ────────────────────────
export const ANCHOR = `{{if::{{gte::{{messageCount}}::16}}}}(ALMANAC · {{if::{{getvar::alm_sealed}}}}{{user}} is the player's.{{else}}{{user}} is in your hands, true to the persona.{{/if}} Every voice its own. Knowledge needs a route. The clock only moves forward.{{if::{{getvar::alm_linked}}}} The <ledger-note> is the truth of now.{{/if}}{{if::{{gte::{{messageCount}}::150}}}} Long story: reread the cards, not your habits.{{/if}}){{/if}}`;

const PLACEMENTS = {
  balanced: { role: "system", position: "in_history", depth: 4 },
  frontier: { role: "user", position: "in_history", depth: 1 },
  deep: { role: "system", position: "in_history", depth: 2 },
} as const;

// ── Scene Modules (one per scene mode; the router regex activates them) ─────
const mode = (m: string, body: string) => `{{if::{{eq::{{getvar::alm_mode}}::${m}}}}}[SCENE · ${m.toUpperCase()}]\n${body}{{/if}}`;

export const MODULES: Record<string, string> = {
  intimacy: mode("intimacy", `{{if::{{eq::{{getvar::alm_nsfw}}::off}}}}This is a close, charged scene, and sexual content stays off the page: let tension, touch and what goes unsaid carry it, and cut away before anything sexual.{{else}}Desire is personal: each person keeps their voice, history, hang-ups, humour and tells here; what they want, what embarrasses them and what they won't say aloud come from who they are.
Consent lives in the scene: eagerness, a question asked in voice, a checked-in pause, a charged "yes". It can change at any moment, and a change is honoured at once.
Phases: charge → approach → consent beat → escalation → peak → afterglow → aftermath. The next morning is part of the story.
Bodies stay in a specific room: clothing layers and where they went, positions and furniture, protection, stamina and recovery, temperature, mess. No teleporting hands, no identical bodies.
Under intensity, syntax fractures before vocabulary does; dialogue stays in character, never porn-script. Never: "pupils blown", "ministrations", "core", "bruising kiss", "a moan escaped", "sinful".
{{switch::{{var::intimacy_length}}::brief::Keep it brief.::standard::Give it a full scene.::extended::It may span replies; break at a live moment, never mid-sentence.}}{{/if}}
Ledger: update ladder, comfort and trust, body (fatigue{{if::{{ne::{{getvar::alm_nsfw}}::off}}}}, arousal{{/if}}), look (clothing state), and a journal line for each participant.
`),
  conflict: mode("conflict", `Spatial clarity: who stands where, what is between them, what each can reach. One exchange per reply — an action, its resistance, the new position — then stop at the moment {{user}} must answer or defend. Nobody auto-wins: skill, reach, numbers, footing, fatigue and fear decide. Wounds stay (ledger body, injury). Enemies adapt, retreat, surrender, call for help or fight dirty — never stand and wait. The scene ends when someone breaks, flees or yields, not when the prose runs out.
`),
  investigation: mode("investigation", `Clues are fair: everything the solution needs is findable on the page, and each clue has a physical form (ledger clue). Evidence obeys physics — rain washes, fire destroys, people tidy, time degrades. Witnesses have self-interest: they misremember, protect someone, trade what they know, or lie with a tell. Reveals follow the cadence ({{default::{{var::reveal_cadence}}::measured}}): a deduction needs two facts the player has actually seen. Never solve it for {{user}}.
`),
  travel: mode("travel", `Travel moves in legs: each leg costs real time, supplies and strength, and the terrain and weather act on it (mud, heat, snow, fog, a flooded ford). Encounters need a reason to be there (Motive, Knowledge, Access, Means, Time); most legs pass in a paragraph. Show where the party is at the end of the reply, what the next leg looks like, and how much light is left.
`),
  stealth: mode("stealth", `Perception runs on senses and conditions: light, distance, noise, rain, crowds, attention. Every move has a sound and a sightline. Discovery climbs a ladder — unaware → a sense that something is off → searching → spotted → alarm — one rung per mistake or bad luck, and guards talk, get bored, change shifts and follow routines. Stop at each point where {{user}} must choose the next move.
`),
  downtime: mode("downtime", `A quiet stretch. Time may pass quickly — a meal, an evening, a night's sleep — but stop before any choice the player might want to make. Routines resume; bodies recover (sleep, food, wounds tended); relationships drift in small, specific ways; off-screen life catches up through a route (a note under the door, a visitor, news in the market). Small pleasures and friction make it feel lived in.
`),
  crisis: mode("crisis", `Stakes are explicit and immediate: what will be lost, by when. Options shrink each reply; one decisive pressure dominates, and anything that doesn't serve it falls away. People under pressure reveal who they are. End on the choice or the cost, never on relief the story hasn't paid for.
`),
};

export const SCENE_MODES = ["social", "intimacy", "conflict", "investigation", "travel", "stealth", "downtime", "crisis"];

// ── The Turn ────────────────────────────────────────────────────────────────
export const SEAL = `{{if::{{and::${IS_STORY}::{{getvar::alm_sealed}}}}}}
(Write the world. {{user}} is mine — stop before you would speak, feel or choose for {{user}}.){{/if}}`;

const ECHO = R`{{setvar::alm_prev::{{regex::^\s+|\s+$::::{{regex::\s+:: ::{{regex::<(plan|unspoken|ledger|folio|ooc)\b[^>]*>[\s\S]*?</\1>|\[/?[a-z]+(?:=[^\]\n]*)?\]|^(?:🗓|📍|#).*$::::{{lastCharMessage}}::gm}}::g}}::g}}}}{{if::{{gte::{{len::{{getvar::alm_prev}}}}::200}}}}Echo guard — the last reply opened «{{regex::^((?:\S+\s+){0,20}\S+)[\s\S]*$::$1::{{getvar::alm_prev}}::}}…» and closed «…{{regex::^[\s\S]*?((?:\S+\s+){0,20}\S+)$::$1::{{getvar::alm_prev}}::}}». Open and close differently: another subject, another sentence shape, no reused image.
{{/if}}`;

export const FRAME = R`[TURN {{messageCount}}] {{switch::{{getvar::alm_route}}::ooc::The player is speaking out of character. Answer inside <ooc>…</ooc>, plainly and briefly. If they ask for a change — a time skip, a retcon, a new direction — make it, then carry the story on from there after the </ooc>.::continue::Continue the last reply from its exact final word. No header, no recap, no restart, no second ledger.::variant::A new take on the same moment: a different decision, a different first line and a different ending from the obvious one.{{if::{{rejectedSwipe}}}} The rejected take opened «{{regex::^\s*(?:🗓[^\n]*\n)?(?:📍[^\n]*\n)?(?:#[^\n]*\n)?\s*((?:\S+\s+){0,18}\S+)[\s\S]*$::$1::{{rejectedSwipe}}::}}…» — choose a different MOVE, a different first line, a different ending.{{/if}}::command::{{getvar::alm_cmd}}::scene::}}
{{if::${IS_STORY}}}{{if::{{lte::{{messageCount}}::2}}}}The opening message came from the card, not from you. Do not inherit its habits.
{{/if}}{{if::{{getvar::alm_returning}}}}{{if::{{not::{{getvar::alm_linked}}}}}}The player is back after {{idleDuration}} away. Open with a brief in-world re-entry — two lines at most: where we are and what is pressing — then continue.
{{/if}}{{/if}}{{if::{{eq::{{var::tense}}::present}}}}Tense: present, whatever tense earlier replies used.
{{/if}}${ECHO}{{if::{{and::{{not::{{getvar::alm_linked}}}}::{{matches::{{lastCharMessage}}::🗓}}}}}}Last header: {{regex::^[\s\S]*?(🗓[^\n]*(?:\n📍[^\n]*)?)[\s\S]*$::$1::{{lastCharMessage}}::}}
{{/if}}{{if::{{eq::{{var::outcomes}}::fair_roll}}}}Fair die for any contested attempt by {{user}} this turn: {{roll::1d20}} — 1–5 fails and costs · 6–10 fails · 11–15 succeeds at a cost · 16–19 succeeds · 20 exceeds.
{{/if}}{{if::{{not::{{getvar::alm_linked}}}}}}{{if::{{or::{{and::{{eq::{{var::world_layer}}::living}}::{{lte::{{roll::1d4}}::1}}}}::{{and::{{eq::{{var::world_layer}}::insistent}}::{{lte::{{roll::1d2}}::1}}}}}}}}Ambient cue, if it fits: {{pick::a sound from beyond the room::the light changing::people passing or arriving::a smell on the air::a scrap of rumour::an animal going about its business::something closing, breaking or falling}}.
{{/if}}{{/if}}{{if::{{eq::{{var::variance}}::lively}}}}Presentation lot (form only; it cannot create facts): open {{pick::mid-gesture::on an object that matters::on a sound::on the distance between people::with speech already underway::on what someone avoids looking at}}; favour {{pick::hands and held things::sound and interruption::doors, thresholds and distance::temperature and breath::work already in progress::the least powerful person's view}}.
{{/if}}{{/if}}`;

/** Command palette text (Boot sets alm_route=command; the Turn Frame reads alm_cmd). */
export const COMMANDS = R`{{trim}}{{if::{{eq::{{getvar::alm_route}}::command}}}}
{{setvar::alm_cmdname::{{regex::^\s*/([a-z0-9]+)[\s\S]*$::$1::{{lastUserMessage}}::i}}}}
{{setvar::alm_cmdarg::{{regex::^\s*/[a-z0-9]+\s*([^\n]*)[\s\S]*$::$1::{{lastUserMessage}}::i}}}}
{{setvar::alm_cmd::{{switch::{{lower::{{getvar::alm_cmdname}}}}::skip::The player skips ahead: {{default::{{getvar::alm_cmdarg}}::a short while}}. Advance the clock by that span (or to that time), write the scene header, and give one or two paragraphs of what passes — routines, weather turning through its in-between states, off-screen life reaching the scene only by a route. Stop early, before anything the player might want to choose, and say nothing for {{user}}. End with a ledger whose clock line matches the skip.::recap::Write a "Previously on…" recap inside <folio title="Previously on…">…</folio>: three to six sentences, in-world tone, past tense — the last scene, what is unresolved, who is where. No narrator-only secrets, nothing {{user}} didn't witness framed as theirs. Nothing after the folio; no ledger.::report::Write a report on {{default::{{getvar::alm_cmdarg}}::the cast}} inside <folio title="Report · {{default::{{getvar::alm_cmdarg}}::cast}}">…</folio>: one line per item, factual, {{if::{{getvar::alm_linked}}}}taken from the <ledger-note> and <recall>{{else}}taken from the story so far{{/if}}. Bonds: who → whom, the feeling and why. Threads: status and next step. Nothing after the folio; no ledger.::audit::Audit continuity inside <folio title="Continuity audit">…</folio>: list up to six contradictions or loose ends — a clock that ran backward, an object in two hands, knowledge without a route, a promise forgotten, a wound that vanished — each with one line proposing the fix. If all is sound, say so in one line. Nothing after the folio; no ledger.::session0::Run Session Zero out of character inside <ooc>…</ooc>: ask the player, in one compact list, for genres (up to three), tone, who writes {{user}} (sealed · continuity · director · full cast), romance pace, difficulty, intimacy level and hard limits, climate and calendar, and where and when the story starts. When the player answers, confirm in one line and end with exactly one tag: <session-zero genres="a, b" tone="…" persona="…" romance="…" difficulty="…" nsfw="…" limits="…" climate="…" calendar="…" start="…"/>::setup::Run Session Zero out of character inside <ooc>…</ooc>: ask the player, in one compact list, for genres (up to three), tone, who writes {{user}} (sealed · continuity · director · full cast), romance pace, difficulty, intimacy level and hard limits, climate and calendar, and where and when the story starts. When the player answers, confirm in one line and end with exactly one tag: <session-zero genres="a, b" tone="…" persona="…" romance="…" difficulty="…" nsfw="…" limits="…" climate="…" calendar="…" start="…"/>::Unknown command. Answer inside <ooc>…</ooc> with the commands available: /skip 30m · /skip until morning · /recap · /report bonds · /report threads · /audit · /session0.}}}}
{{/if}}{{/trim}}`;

export const IMPERSONATE = `Write {{user}}'s next message as the player would: in {{user}}'s voice from the persona and their past messages, in the player's usual form and length. Only {{user}} acts or speaks. No header, marks, ledger or artifacts.`;

const LABELS_ROUTINE = "ROUTE · ANCHOR · SEAL · MINDS (one line each) · MOVE · VOICE · LEDGER — 90 words at most";
const LABELS_CHARGED = "every label; WEB and WORLD one line each — 220 words at most";
const LABELS_PIVOTAL = "every label in full — 400 words at most";

export const DIRECTOR = `{{if::${IS_STORY}}}{{if::{{and::{{eq::{{getvar::alm_cotch}}::sidecar}}::{{getvar::alm_linked}}}}}}[DIRECTOR'S PLAN] A planner has already run the Director's Pass for this beat: it is in <director-plan>. Follow its MOVE, its boundaries and its LEDGER plan; do not plan again, and never quote it.{{else}}{{if::{{and::{{ne::{{var::cot}}::silent}}::{{ne::{{getvar::alm_cotch}}::silent}}}}}}[DIRECTOR'S PASS] {{if::{{eq::{{getvar::alm_cotch}}::visible}}}}Before the story, write the pass inside <plan>…</plan> at the very start of the reply, then the reply itself.{{else}}Run this pass in your reasoning, then write the reply.{{/if}}
Tier: {{switch::{{var::cot}}::lean::routine — ${LABELS_ROUTINE}.::standard::charged — ${LABELS_CHARGED}.::deep::pivotal — ${LABELS_PIVOTAL}.::auto::classify the beat first. Routine (small talk, simple action, travel with nothing at stake): ${LABELS_ROUTINE}. Charged (conflict, negotiation, intimacy, lies in play, three or more speakers, a romance-ladder test): ${LABELS_CHARGED}. Pivotal (a reveal, betrayal, violence, death, a skip over an hour, a new place, a deadline, an off-screen arrival, intimacy escalating, a genre climax): ${LABELS_PIVOTAL}.}}
ROUTE — {{getvar::alm_route}}; tier and why.
ANCHOR — T0 from the {{if::{{getvar::alm_linked}}}}<ledger-note>{{else}}last header and recent chat{{/if}}: day, time, weather, place, who is present (spotlight / periphery). Minutes this beat costs → T1. Does the weather turn? Any meter at 4+ that must show?
SEAL — The player's verbs only: SAID / DID / ATTEMPTED / INTENDS / ASKED-OOC. Only SAID and DID are facts; ATTEMPTED gets an outcome; INTENDS is not yet an action. The boundary for {{user}}. Where this reply stops.
GNOSIS — Each fact this beat touches → who holds it and how, or UNKNOWN. What comes out this beat, and who is in earshot. The single most tempting leak right now, and how to avoid it.
MINDS — Spotlight: want · fear · tactic · named emotion (VAD) · mask vs feeling · least-used facet · what they misread · what they'd do without {{user}}. Periphery: one line each.
WEB — An exchange between others that changes information, leverage, a bond or a plan — or none. Bond deltas (who → whom, axis, ±, cause).
WORLD — Ambient pressure or none · consequence due · off-screen arrival and its route{{if::{{getvar::alm_linked}}}} (only what [ELSEWHERE] says; an offered entrance is yours to take or leave){{/if}} · faction clock tick?
MOVE — Three candidates: (a) the obvious, (b) the one only this cast would choose, (c) the sideways consequence. Gate each by Motive, Knowledge, Access, Means, Time. What the lead genre ({{getvar::alm_lead}}) needs now. Choose one{{if::{{eq::{{getvar::alm_route}}::variant}}}} — never the rejected take's{{/if}}. The pressure the reply ends on.
PREMORTEM — Grade the last reply A–F in three words. The likeliest way THIS reply fails (voicing {{user}}, a leak, an echo, a softened enemy, a spotlight hazard, a clock running backward) → the prevention.
VOICE — POV and tense · length · dialogue density and speaker cap · a first line unlike the last reply's · the spotlight hazards.
LEDGER — Ops to emit (only real changes, each with its cause) · header? title? · artifacts to file? · register entries? · scene mode for the next reply.
STOP RULE: after LEDGER, planning is over — no review, no restart, no rehearsal. NEVER DRAFT: no sentence of the reply, no line of dialogue, no opening line and no paragraph outline inside the pass.{{/if}}{{/if}}{{/if}}`;

export const ERRATA = `{{if::{{matches::{{model}}::claude|anthropic::i}}}}[MODEL] Extended thinking is the Director's Pass: its labels and ceiling, then stop. The ledger is not optional when an emotional beat lands. Follow the output order literally.{{/if}}{{if::{{matches::{{model}}::deepseek|\\br1\\b::i}}}}[MODEL] Reason once in fragments and stop at LEDGER. Anything drafted in reasoning is wasted, and your thinking is not output: write the ledger again in the reply itself.{{/if}}{{if::{{matches::{{model}}::gemini|gemma::i}}}}[MODEL] Do not restate these instructions or the ledger note while reasoning; the plan is bullet fragments. No markdown headings except the scene title.{{/if}}{{if::{{matches::{{model}}::glm|zhipu::i}}}}[MODEL] Reason in telegraphic fragments within the ceiling. No self-talk, no rechecking, no drafting.{{/if}}{{if::{{matches::{{model}}::kimi|moonshot::i}}}}[MODEL] No workspace before the reply: never write "Let me plan", "Actually", "Wait", "Paragraph 1" or any rehearsal.{{/if}}{{if::{{matches::{{model}}::gpt|\\bo[1345]\\b|openai::i}}}}[MODEL] Keep the output order exact and the marks precise; no commentary around the story.{{/if}}{{if::{{matches::{{model}}::mistral|mixtral|llama|qwen|hermes|command-r::i}}}}[MODEL] Write the ledger as plain lines inside <ledger>…</ledger> — never in a code fence, never as JSON, never skipped. Keep names spelled exactly as before.{{/if}}`;

export const LOOM = `{{if::{{eq::{{loomSovHandActive}}::yes}}}}{{loomSovHand}}
{{/if}}{{loomRetrofits}}`;

export const OUTPUT = `[OUTPUT]
{{switch::{{getvar::alm_route}}::ooc::<ooc>a brief, plain out-of-character answer</ooc> — or, for a requested change, the story carried on from it after the </ooc>, ending with the ledger as usual.::command::Carry out the command exactly as the Turn Frame says, then stop.::continue::Continue seamlessly from the last word. Nothing comes before it. No header, no recap.::{{if::{{and::{{eq::{{getvar::alm_cotch}}::visible}}::{{ne::{{var::cot}}::silent}}}}}}<plan> first · {{/if}}{{if::{{ne::{{var::header}}::off}}}}header when due · # title for a new scene · {{/if}}prose with marks{{if::{{ne::{{var::vtk}}::off}}}} · artifacts{{/if}}{{if::{{eq::{{var::inner_voice}}::register}}}} · <unspoken>{{/if}}{{if::{{ne::{{var::ledger}}::off}}}} · <ledger> last, with mode: as its final line{{/if}}.
Nothing else: no commentary, no summary, no options, no headings except the title. If the reply runs long, cut the register first, then artifacts — never the ledger; shorten the prose before you truncate it.}}
{{if::{{or::{{eq::{{var::cot}}::silent}}::{{eq::{{getvar::alm_cotch}}::silent}}}}}}Before writing, check silently: {{user}}'s boundary · who knows what · the clock only moves forward · every voice its own · the spotlight hazards · the ledger matches the prose.
{{/if}}The absolute boundaries hold.`;

export const turnBlocks = [
  {
    id: "alm-anchor", name: "Anchor Reminder (in history)", content: ANCHOR, position: "in_history", depth: 4, injectionTrigger: TRIG_STORY,
    variables: [sel("anchor_placement", "Reminder placement", "Where the short reminder sits. Frontier suits models that under-weight system text.", "balanced", [["balanced", "Balanced — system, depth 4"], ["frontier", "Frontier — user, depth 1"], ["deep", "Deep reminder — system, depth 2"]])],
    placementBinding: { variableId: "alm-var-anchor_placement", options: PLACEMENTS },
  },
  { id: "alm-cat-scenes", name: "✦ ALMANAC · Scene Modules (router)", marker: "category", categoryMode: "radio", color: "#7a8fb8", position: "in_history", depth: 1 },
  ...SCENE_MODES.filter((m) => m !== "social").map((m) => ({ id: `alm-scene-${m}`, name: `Scene · ${m[0].toUpperCase()}${m.slice(1)}`, content: MODULES[m], position: "in_history", depth: 1, injectionTrigger: TRIG_STORY })),
  { id: "alm-cat-turn", name: "✦ ALMANAC · The Turn", marker: "category", color: "#c4922c", position: "post_history" },
  { id: "alm-commands", name: "Command palette (writes nothing)", content: COMMANDS, position: "post_history", injectionTrigger: TRIG_STORY },
  { id: "alm-post-history", name: "Character Post-History Instructions", marker: "post_history_instructions", content: "", position: "post_history" },
  { id: "alm-seal", name: "Player's Seal", content: SEAL, role: "user_append", position: "post_history", injectionTrigger: TRIG_STORY },
  {
    id: "alm-frame", name: "Turn Frame", content: FRAME, position: "post_history", injectionTrigger: TRIG_STORY_CONT,
    variables: [sel("variance", "Variance", "A small random nudge to openings and focus (form only, never facts).", "lively", [["steady", "Steady"], ["lively", "Lively"]])],
  },
  { id: "alm-impersonate", name: "Impersonation", content: IMPERSONATE, position: "post_history", injectionTrigger: ["impersonate"] },
  {
    id: "alm-director", name: "Director's Pass", content: DIRECTOR, position: "post_history", injectionTrigger: TRIG_STORY,
    variables: [
      sel("cot", "Planning depth", "How much the model plans before writing. Auto sizes it to the beat.", "auto", [["silent", "Silent"], ["lean", "Lean"], ["auto", "Auto"], ["standard", "Standard"], ["deep", "Deep"]]),
      sel("cot_channel", "Planning channel", "Where the plan is written. Auto: native reasoning for thinking models, a silent checklist for others. Sidecar needs the ALMANAC Ledger and a planner connection.", "auto", [["auto", "Auto (by model)"], ["native", "Native reasoning"], ["visible", "Visible (Director's notes drawer)"], ["silent", "Silent checklist"], ["sidecar", "Sidecar planner (Ledger)"]]),
      sel("cot_placement", "Pass placement", "Where the Director's Pass sits. Frontier suits models that under-weight system text.", "balanced", [["balanced", "Balanced — system, after history"], ["frontier", "Frontier — user, depth 0"], ["deep", "Deep reminder — system, depth 2"]]),
    ],
    placementBinding: {
      variableId: "alm-var-cot_placement",
      options: { balanced: { role: "system", position: "post_history", depth: 0 }, frontier: { role: "user", position: "in_history", depth: 0 }, deep: { role: "system", position: "in_history", depth: 2 } },
    },
  },
  { id: "alm-errata", name: "Model Errata (automatic)", content: ERRATA, position: "post_history", injectionTrigger: TRIG_STORY },
  { id: "alm-loom", name: "Loom hooks (Sovereign Hand, Retrofits)", content: LOOM, position: "post_history", injectionTrigger: TRIG_STORY },
  { id: "alm-output", name: "Output Contract", content: OUTPUT, position: "post_history", injectionTrigger: [...TRIG_ALL_BUT_QUIET.filter((t) => t !== "impersonate")], isLocked: true },
];
