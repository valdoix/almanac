// ALMANAC blocks, part 4: Story Sources, the in-history reminders and Scene
// Modules (one per scene mode), and the Turn: Seal, Turn Frame, Impersonation,
// Director's Pass, Model Errata, Loom hooks, the Output Contract and the gate.
import { sel, TRIG_STORY, TRIG_STORY_CONT, R } from "./vars";
import { GATE } from "./blocks-core";

const IS_STORY = `{{or::{{eq::{{getvar::alm_route}}::scene}}::{{eq::{{getvar::alm_route}}::variant}}}}`;
const SEALED = "{{getvar::alm_sealed}}";
const HEADER_ON = `{{ne::{{getvar::alm_header}}::off}}`;

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
export const ANCHOR = `{{if::{{gte::{{messageCount}}::16}}}}(ALMANAC · {{if::${SEALED}}}{{user}} is the player's.{{else}}{{user}} is in your hands, true to the persona.{{/if}} Every voice its own. Knowledge needs a route. The clock only moves forward. The <ledger-note> is the truth of now.{{if::{{gte::{{messageCount}}::150}}}} Long story: reread the cards, not your habits.{{/if}}){{/if}}`;

const PLACEMENTS = {
  balanced: { role: "system", position: "in_history", depth: 4 },
  frontier: { role: "user", position: "in_history", depth: 1 },
  deep: { role: "system", position: "in_history", depth: 2 },
} as const;

// ── Scene Modules (one per scene mode; each speaks only while the Almanac's scene mode is its own) ──
const mode = (m: string, body: string) => `{{if::{{eq::{{getvar::alm_mode}}::${m}}}}}[SCENE · ${m.toUpperCase()} — while it lasts; if the player's message ends or changes the scene, write the new scene and set mode: to it]\n${body}{{/if}}`;

export const MODULES: Record<string, string> = {
  intimacy: mode("intimacy", `{{if::{{eq::{{getvar::alm_nsfw}}::off}}}}This is a close, charged scene, and sexual content stays off the page: let tension, touch and what goes unsaid carry it, and cut away before anything sexual.{{else}}Desire is personal: each person keeps their voice, history, hang-ups, humour and tells here; what they want, what embarrasses them and what they won't say aloud come from who they are.
Consent lives in the scene: eagerness, a question asked in voice, a checked-in pause, a charged "yes". It can change at any moment, and a change is honoured at once.
Phases are a ladder climbed across replies, never a checklist for one: charge → approach → consent beat → undressing → foreplay → escalation → peak → afterglow → aftermath. The next morning is part of the story.
Bodies stay in a specific room: clothing layers and where they went, positions and furniture, protection, stamina and recovery, temperature, mess. No teleporting hands, no identical bodies.{{if::${SEALED}}}
{{user}}'s body, words, pleasure and consent are the player's: write what the others do and how their bodies answer; {{user}}'s part only as the player wrote it.{{/if}}{{if::{{eq::{{getvar::alm_nsfw}}::explicit}}}}
Slow time down inside a reply: a minute of the act can fill it — the exact touch, how the body answers, the sound it pulls out, the next touch. Write what the player's message starts as it happens, at length, before anything new begins.{{/if}}
Under intensity, syntax fractures before vocabulary does; dialogue stays in character, never porn-script. Never: "pupils blown", "ministrations", "her core" or "his core", "bruising kiss", "a moan escaped", "sinful".{{if::{{or::{{eq::{{getvar::alm_nsfw}}::explicit}}::{{eq::{{getvar::alm_nsfw}}::sensual}}}}}}
{{switch::{{var::intimacy_length}}::brief::Pace: brief — the act may run to its peak in one reply.::extended::Pace: extended — the player sets the pace. One beat per reply, a few minutes of story time, ending mid-act on a live moment: a touch begun, a question asked, a body on the edge. Stay on the current rung for as long as the player does; when the player begins an act, write that act, not its finish. Fill the time with what bodies do — slow undressing, teasing, edging and pulling back, mouths and hands in new places, talk, a change of position. No one comes unless the player's message brings them there or asks; after a climax the scene goes on — recovery, more, round two — until the player ends it. Never close a reply in afterglow the player didn't write. In the Director's Pass, MOVE names the rung and the one beat this reply covers, and VOICE's length is this reply's, not the scene's.::Pace: standard — one phase per reply; the reply ends inside the phase, not past it.}}{{/if}}{{/if}}
Ledger: ladder and bond lines when they move; body (fatigue{{if::{{ne::{{getvar::alm_nsfw}}::off}}}}, arousal{{/if}}) and look (clothing) as they change; a journal line for each participant{{if::${SEALED}}} other than {{user}}{{/if}}. Keep mode: intimacy while the scene goes on.
`),
  conflict: mode("conflict", `Spatial clarity: who stands where, what is between them, what each can reach. One exchange per reply — an action, its resistance, the new position — then stop at the moment {{user}} must answer or defend. Nobody auto-wins: skill, reach, numbers, footing, fatigue and fear decide. Wounds stay (body lines, injuries in words). Enemies adapt, retreat, surrender, call for help or fight dirty — never stand and wait. The scene ends when someone breaks, flees or yields, not when the prose runs out.
`),
  investigation: mode("investigation", `Clues are fair: everything the solution needs is findable on the page, and each clue has a physical form (clue lines). Evidence obeys physics — rain washes, fire destroys, people tidy, time degrades. Witnesses have self-interest: they misremember, protect someone, trade what they know, or lie with a tell. A deduction needs two facts the player has actually seen. Never solve it for {{user}}.
`),
  travel: mode("travel", `Travel moves in legs: each leg costs real time, supplies and strength, and the terrain and weather act on it (mud, heat, snow, fog, a flooded ford). Encounters need a reason to be there (Motive, Knowledge, Access, Means, Time); most legs pass in a paragraph. Show where the party is at the end of the reply, what the next leg looks like, and how much light is left.
`),
  stealth: mode("stealth", `Perception runs on senses and conditions: light, distance, noise, rain, crowds, attention. Every move has a sound and a sightline. Discovery climbs a ladder — unaware → a sense that something is off → searching → spotted → alarm — one rung per mistake or bad luck, and guards talk, get bored, change shifts and follow routines. Stop at each point where {{user}} must choose the next move.
`),
  downtime: mode("downtime", `A quiet stretch. Time may pass quickly — a meal, an evening, a night's sleep — but stop before any choice the player might want to make. Routines resume; bodies recover (sleep, food, wounds tended); relationships drift in small, specific ways; off-screen life catches up only as [ELSEWHERE] brings it (a note under the door, a visitor, news in the market). Small pleasures and friction make it feel lived in.
`),
  crisis: mode("crisis", `Stakes are explicit and immediate: what will be lost, by when. Options shrink each reply; one decisive pressure dominates, and anything that doesn't serve it falls away. People under pressure reveal who they are. End on the choice or the cost, never on relief the story hasn't paid for.
`),
};

export const SCENE_MODES = ["social", "intimacy", "conflict", "investigation", "travel", "stealth", "downtime", "crisis"];

// ── The Turn ────────────────────────────────────────────────────────────────
export const SEAL = `{{if::{{and::${IS_STORY}::${SEALED}}}}}
(Write the world. {{user}} is mine — stop before you would speak, feel or choose for {{user}}.){{/if}}`;

/** The last reply's prose: no bookkeeping, no artifacts or lettering, no header. */
const ECHO = R`{{setvar::alm_prev::{{regex::^\s+|\s+$::::{{regex::\s+:: ::{{regex::<(plan|unspoken|ledger|folio|ooc)\b[^>]*>[\s\S]*?</\1>|\[vtk=[^\]\n]*\][\s\S]*?\[/vtk\]|\[txt(?:=[^\]\n]*)?\][\s\S]*?\[/txt\]|\[/?[a-z]+(?:=[^\]\n]*)?\]|^(?:🗓|📍|#).*$::::{{lastCharMessage}}::gm}}::g}}::g}}}}{{if::{{gte::{{len::{{getvar::alm_prev}}}}::200}}}}Echo guard — the last reply opened «{{regex::^((?:\S+\s+){0,14}\S+)[\s\S]*$::$1::{{getvar::alm_prev}}::}}…» and closed «…{{regex::^[\s\S]*?((?:\S+\s+){0,14}\S+)$::$1::{{getvar::alm_prev}}::}}». Open and close differently: another subject, another sentence shape, no reused image.
{{/if}}`;

export const FRAME = R`[TURN {{messageCount}}] {{switch::{{getvar::alm_route}}::ooc::The player is speaking out of character. Answer inside <ooc>…</ooc>, plainly and briefly. If they ask for a change — a time skip, a retcon, a correction, a new direction — make it, then carry the story on from there after the </ooc>.::continue::Continue the last reply from its exact final word. No header, no recap, no restart; end with the ledger only if the reply doesn't have one yet.::variant::A fresh take on the same moment: a different first line and shape. Keep what these people would truly do; change the decision only where another is just as true to them.{{if::{{rejectedSwipe}}}} The rejected take opened «{{regex::^\s*(?:🗓[^\n]*\n)?(?:📍[^\n]*\n)?(?:#[^\n]*\n)?\s*((?:\S+\s+){0,18}\S+)[\s\S]*$::$1::{{rejectedSwipe}}::}}…» — don't open the same way or reuse its images.{{/if}}::command::{{getvar::alm_cmd}}::scene::}}
{{if::${IS_STORY}}}{{if::{{lte::{{messageCount}}::2}}}}The opening message came from the card, not from you. Do not inherit its habits.
{{/if}}{{if::{{eq::{{var::tense}}::present}}}}Tense: present, whatever tense earlier replies used.
{{/if}}${ECHO}{{if::{{eq::{{var::outcomes}}::fair_roll}}}}Fair die for any contested attempt by {{user}} this turn: {{default::{{almDie}}::{{roll::1d20}}}} — 1–5 fails and costs · 6–10 fails · 11–15 succeeds at a cost · 16–19 succeeds · 20 exceeds.
{{/if}}{{if::{{eq::{{var::variance}}::lively}}}}Presentation lot (form only; it cannot create facts): open {{pick::mid-gesture::on an object that matters::on a sound::on the distance between people::with speech already underway::on what someone avoids looking at}}; favour {{pick::hands and held things::sound and interruption::doors, thresholds and distance::temperature and breath::work already in progress::the least powerful person's view}}.
{{/if}}{{/if}}`;

const SESSION_ZERO = "Session Zero is a window, not a conversation: the Almanac opens it for the player now. Reply with only this line, inside <ooc>…</ooc>: Session Zero is open in the Almanac window; your settings apply from your next message.";

/** Command palette text (Boot sets alm_route=command; the Turn Frame reads alm_cmd). */
export const COMMANDS = R`{{trim}}{{if::{{eq::{{getvar::alm_route}}::command}}}}
{{setvar::alm_cmdname::{{lower::{{regex::^\s*/([a-z0-9]+)[\s\S]*$::$1::{{lastUserMessage}}::i}}}}}}
{{setvar::alm_cmdarg::{{regex::^\s*/[a-z0-9]+\s*([^\n]*)[\s\S]*$::$1::{{lastUserMessage}}::i}}}}
{{setvar::alm_cmd::{{switch::{{getvar::alm_cmdname}}::skip::The player skips ahead: {{default::{{getvar::alm_cmdarg}}::a short while}}. Advance the clock by that span (or to that time){{if::${HEADER_ON}}}, write the scene header (a skip starts a new scene){{/if}}, and give one or two paragraphs of what passes — routines, the weather turning through its in-between states, and only the off-screen news the <ledger-note>'s [ELSEWHERE] lane brings. Stop early, before anything the player might want to choose, and say nothing for {{user}}. End with a ledger whose clock line matches the skip.::recap::Write a "Previously on…" recap inside <folio title="Previously on…">…</folio>: three to six sentences, in-world tone, past tense — the last scene, what is unresolved, who is where. No narrator-only secrets, nothing {{user}} didn't witness framed as theirs. Nothing after the folio; no ledger.::report::Write a report on {{default::{{getvar::alm_cmdarg}}::the cast}} inside <folio title="Report · {{default::{{getvar::alm_cmdarg}}::cast}}">…</folio>: one line per item, factual, taken from the <ledger-note> and <recall>. Bonds: who → whom, the feeling and why. Threads: status and next step. Nothing after the folio; no ledger.::audit::Audit continuity inside <folio title="Continuity audit">…</folio>: list up to six contradictions or loose ends — a clock that ran backward, an object in two hands, knowledge without a route, a promise forgotten, a wound that vanished — each with one line proposing the fix. If all is sound, say so in one line. Nothing after the folio; no ledger.::session0::${SESSION_ZERO}::setup::${SESSION_ZERO}::"/{{getvar::alm_cmdname}}" isn't a command. Answer inside <ooc>…</ooc> in one line with the commands available: /skip 30m · /skip until morning · /recap · /report bonds · /report threads · /audit · /session0. No story, no ledger.}}}}
{{/if}}{{/trim}}`;

export const IMPERSONATE = `[IMPERSONATION] This one message is the exception to the persona rules: write {{user}}'s next message for the player, as the player would — in {{user}}'s voice from the persona and their past messages, in the player's usual person, tense, form and length. Only {{user}} acts or speaks, and {{user}} knows only what has reached them. No header, marks, ledger or artifacts.`;

const LABELS_ROUTINE = "ROUTE · ANCHOR · SEAL · MINDS · MOVE (one line each) · VOICE · LEDGER — 90 words at most";
const LABELS_CHARGED = "every label; WEB and WORLD one line each — 220 words at most";
const LABELS_PIVOTAL = "every label in full — 400 words at most";
const MOVE_ONE = "Routine: the one move and why.";
const MOVE_THREE = `three candidates — (a) the obvious, (b) the one only this cast would choose, (c) the sideways consequence — each gated by Motive, Knowledge, Access, Means, Time; choose one{{if::{{eq::{{getvar::alm_route}}::variant}}}}, not a copy of the rejected take{{/if}}.`;
const CHECKLIST = "{{user}}'s boundary · who knows what · the clock only moves forward · every voice its own · the spotlight hazards · the ledger matches the prose";

export const DIRECTOR = `{{if::${IS_STORY}}}{{if::{{eq::{{getvar::alm_cotch}}::sidecar}}}}[DIRECTOR'S PLAN] A planner runs the Director's Pass for this beat: its notes are in <director-plan>, just before the player's message. Follow its MOVE, its boundaries and its ledger plan; don't plan again, and never quote it. If the Almanac says the planner didn't answer, check silently instead: ${CHECKLIST}.{{else}}{{if::{{ne::{{getvar::alm_cotch}}::silent}}}}[DIRECTOR'S PASS] {{if::{{eq::{{getvar::alm_cotch}}::visible}}}}Before the story, write the pass inside <plan>…</plan> at the very start of the reply, then the reply itself.{{else}}Run this pass in your reasoning before you answer. If you have no separate reasoning, don't write the pass at all: check silently (${CHECKLIST}) and write only the reply.{{/if}}
Tier: {{switch::{{var::cot}}::lean::routine — ${LABELS_ROUTINE}.::standard::charged — ${LABELS_CHARGED}.::deep::pivotal — ${LABELS_PIVOTAL}.::classify the beat first. Routine (small talk, simple action, travel with nothing at stake): ${LABELS_ROUTINE}. Charged (conflict, negotiation, intimacy, lies in play, three or more speakers, a romance-ladder test): ${LABELS_CHARGED}. Pivotal (a reveal, betrayal, violence, death, a skip over an hour, a deadline, an off-screen arrival, intimacy escalating, a genre climax): ${LABELS_PIVOTAL}.}}
ROUTE — {{getvar::alm_route}}; the tier and why; the scene mode from [NOW], and whether the player's message changes it.
ANCHOR — From the <ledger-note> [NOW] and [PRESENT]: the time now → the time when this reply ends; place; who is present (spotlight / periphery); does the weather turn; any meter at 4+ that must show; a new scene (it opens with the header)?
SEAL — The player's words, sorted: SAID / DID / ATTEMPTED / INTENDS / STATED / ASKED-OOC. SAID, DID and STATED (a fact about the story's record) are true; ATTEMPTED gets the world's answer under the contested-attempts rule; INTENDS is not yet an action. The boundary for {{user}}. Where this reply stops.
GNOSIS — Each fact this beat touches → who holds it and how, or UNKNOWN. What comes out this beat, and who is in earshot. The single most tempting leak right now, and how to avoid it.
MINDS — Spotlight: want · fear · tactic · named emotion (VAD) · mask vs feeling · a side not shown lately · what they misread · what they'd do without {{user}}. Periphery: one line each.
WEB — An exchange between others that changes information, leverage, a bond or a plan — or none. Bond deltas (who → whom, axis, ±, cause).
WORLD — Ambient pressure or none · consequence due ([CONSTRAINTS]) · an off-screen arrival only as [ELSEWHERE] brings it (an offered entrance is yours to take or leave) · faction clock tick?
MOVE — {{switch::{{var::cot}}::lean::${MOVE_ONE}::standard::${MOVE_THREE}::deep::${MOVE_THREE}::${MOVE_ONE} Charged and pivotal: ${MOVE_THREE}}} What the lead genre ({{getvar::alm_lead}}) needs now. The pressure the reply ends on.
PREMORTEM — The likeliest way this reply fails (voicing {{user}}, a leak, an echo, a softened enemy, a spotlight hazard, a clock running backward) → the prevention.
VOICE — POV, viewpoint and tense · length · dialogue density and speaker cap · how the opening differs from the last reply's (subject and sentence shape — named, not written) · the spotlight hazards.
LEDGER — Lines to write (only real changes, each with its cause) · header? title? · artifacts to file? · register entries? · mode as this reply leaves the scene.
STOP RULE: after LEDGER, planning is over — no review, no restart, no rehearsal. Never draft: no sentence of the reply, no line of dialogue, no opening line and no paragraph outline inside the pass.{{/if}}{{/if}}{{/if}}`;

export const ERRATA = `{{if::{{matches::{{model}}::claude|anthropic::i}}}}[MODEL] Extended thinking, when it's on, is the Director's Pass: its labels and ceiling, then stop. Every story reply ends with the ledger. Follow the output order literally.{{/if}}{{if::{{matches::{{model}}::deepseek|\\br1\\b::i}}}}[MODEL] Reason once in fragments and stop at LEDGER. Anything drafted in reasoning is wasted, and your thinking is not output: write the ledger again in the reply itself.{{/if}}{{if::{{matches::{{model}}::gemini|gemma::i}}}}[MODEL] Do not restate these instructions or the ledger note while reasoning; the plan is bullet fragments. No markdown headings except the scene title.{{/if}}{{if::{{matches::{{model}}::glm|zhipu::i}}}}[MODEL] Reason in telegraphic fragments within the ceiling. No self-talk, no rechecking, no drafting.{{/if}}{{if::{{matches::{{model}}::kimi|moonshot::i}}}}[MODEL] No workspace before the reply: no "Let me plan", no self-correction, no paragraph-by-paragraph rehearsal.{{/if}}{{if::{{matches::{{model}}::gpt|\\bo[1345]\\b|openai::i}}}}[MODEL] Keep the output order exact and the marks precise; no commentary around the story.{{/if}}{{if::{{matches::{{model}}::mistral|mixtral|llama|qwen|hermes|command-r::i}}}}[MODEL] Write the ledger as plain lines inside <ledger>…</ledger> — never in a code fence, never as JSON, never skipped. Keep names spelled exactly as before.{{/if}}`;

export const LOOM = `{{if::{{eq::{{loomSovHandActive}}::yes}}}}{{loomSovHand}}
{{/if}}{{loomRetrofits}}`;

export const OUTPUT = `[OUTPUT]
{{switch::{{getvar::alm_route}}::ooc::<ooc>a brief, plain out-of-character answer</ooc> — or, for a requested change, the story carried on from it after the </ooc>, ending with the ledger as usual.::command::Carry out the command exactly as the Turn Frame says, then stop.::continue::Continue seamlessly from the last word. Nothing comes before it: no header, no recap. The ledger comes at the end only if the reply doesn't have one yet.::{{if::{{eq::{{getvar::alm_cotch}}::visible}}}}<plan> first · {{/if}}{{if::${HEADER_ON}}}header {{if::{{eq::{{getvar::alm_header}}::every}}}}first{{else}}first in every new scene{{/if}} · # title for a new scene · {{/if}}prose with marks{{if::{{ne::{{var::vtk}}::off}}}} · artifacts{{/if}}{{if::{{eq::{{var::inner_voice}}::register}}}} · <unspoken>{{/if}} · <ledger> last, with mode: as its final line.
Nothing else: no commentary, no summary, no options, and no headings outside artifacts except the title. Budget the reply so the ledger always fits: in a long reply, keep the register and artifacts short.}}
{{if::{{and::${IS_STORY}::{{eq::{{getvar::alm_cotch}}::silent}}}}}}Before writing, check silently: ${CHECKLIST}.
{{/if}}The absolute boundaries hold{{if::{{len::{{getvar::alm_limits}}}}}}, and so do the player's hard limits: {{getvar::alm_limits}}{{/if}}.`;

export const turnBlocks = [
  {
    id: "alm-anchor", name: "Anchor Reminder (in history)", content: ANCHOR, position: "in_history", depth: 4, injectionTrigger: TRIG_STORY,
    variables: [sel("anchor_placement", "Reminder placement", "Where the short reminder sits. Frontier suits models that under-weight system text.", "balanced", [["balanced", "Balanced — system, depth 4"], ["frontier", "Frontier — user, depth 1"], ["deep", "Deep reminder — system, depth 2"]])],
    placementBinding: { variableId: "alm-var-anchor_placement", options: PLACEMENTS },
  },
  { id: "alm-cat-scenes", name: "✦ ALMANAC · Scene Modules", marker: "category", color: "#7a8fb8", position: "in_history", depth: 1 },
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
      sel("cot", "Planning depth", "How much the model plans before writing. Auto sizes it to the beat; Silent skips the pass for a short checklist.", "auto", [["silent", "Silent"], ["lean", "Lean"], ["auto", "Auto"], ["standard", "Standard"], ["deep", "Deep"]]),
      sel("cot_channel", "Planning channel", "Where the plan is written. Auto: native reasoning for thinking models, a silent checklist for others (a pass written into a reply is moved to the Director's notes). Sidecar needs a planner connection in the Ledger's settings.", "auto", [["auto", "Auto (by model)"], ["native", "Native reasoning"], ["visible", "Visible (Director's notes drawer)"], ["silent", "Silent checklist"], ["sidecar", "Sidecar planner (Ledger)"]]),
      sel("cot_placement", "Pass placement", "Where the Director's Pass sits. Frontier suits models that under-weight system text.", "balanced", [["balanced", "Balanced — system, after history"], ["frontier", "Frontier — user, depth 0"], ["deep", "Deep reminder — system, depth 2"]]),
    ],
    placementBinding: {
      variableId: "alm-var-cot_placement",
      options: { balanced: { role: "system", position: "post_history", depth: 0 }, frontier: { role: "user", position: "in_history", depth: 0 }, deep: { role: "system", position: "in_history", depth: 2 } },
    },
  },
  { id: "alm-errata", name: "Model Errata (automatic)", content: ERRATA, position: "post_history", injectionTrigger: TRIG_STORY },
  { id: "alm-loom", name: "Loom hooks (Sovereign Hand, Retrofits)", content: LOOM, position: "post_history", injectionTrigger: TRIG_STORY },
  { id: "alm-output", name: "Output Contract", content: OUTPUT, position: "post_history", injectionTrigger: TRIG_STORY_CONT, isLocked: true },
  { id: "alm-gate", name: "Ledger gate (only without the Ledger)", content: GATE, position: "post_history", injectionTrigger: TRIG_STORY_CONT, isLocked: true },
];
