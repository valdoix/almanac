import type { StoryTime } from "./util";

export type OpName =
  | "clock" | "wx" | "at" | "cast" | "mood" | "body" | "look" | "bond" | "ladder" | "know"
  | "item" | "thread" | "owe" | "cons" | "clockf" | "rumor" | "rep" | "journal" | "keys"
  | "canon" | "artifact" | "mode" | "status" | "gauge" | "clue" | "plant" | "payoff"
  | "deadline" | "title" | "season" | "reveal" | "secret" | "unaware" | "trait" | "motif"
  // extension-only ops (never written by the model)
  | "forecast" | "pressure" | "diverge" | "entity" | "lock"
  // Elsewhere (the world off the page): written by the engine or the player's controls
  | "arc" | "whereabouts";

/** The ops that carry knowledge (the clerk replaces these for a message). */
export const KNOW_OPS: OpName[] = ["know", "reveal", "secret", "unaware"];

export type EventSource = "model" | "repair" | "extractor" | "archivist" | "user" | "lore" | "engine" | "sim" | "clerk";

/** One parsed ledger line, before validation. */
export interface ParsedOp {
  op: OpName;
  /** Who wrote it, when an anchored entry mixes sources (set while folding). */
  src?: EventSource;
  /** Primary name as written (character, item, thread, faction…). */
  subject?: string;
  /** Secondary name (bond target, item receiver…). */
  object?: string;
  args: Record<string, any>;
  cause?: string;
  raw: string;
}

export interface ParsedLedger {
  ops: ParsedOp[];
  /** Lines we could not understand (kept for the Recall Feed). */
  unknown: string[];
  /** Where the block came from: "dsl" | "json" | "none". */
  format: "dsl" | "json" | "none";
  /** true when the block had no closing tag (truncated output). */
  truncated: boolean;
  header?: SceneHeader | null;
  title?: string | null;
  /** Unspoken register entries found in the same message. */
  thoughts?: { who: string; slot?: number; cue?: string; text: string; kind?: "register" | "inline" }[];
  /** Filed artifacts ([vtk=…]) found in the same message. */
  vtks?: { kind: string; title: string; meta: string; body: string }[];
  /** Speakers named in [spk=Name#N] marks, first occurrence each. */
  speakers?: { name: string; slot?: number }[];
  /** Everything said aloud in the message: [spk] lines and plain quotes (whispers marked). */
  speech?: SpokenLine[];
  /** The player's message (it carries speech and speaker marks, never ledger ops). */
  fromUser?: boolean;
}

export interface SpokenLine {
  who?: string;
  text: string;
  /** For a plain quote: the narration just before it ("Valeria sighs."), to tell who spoke. */
  lead?: string;
  /** Said under the breath: it reaches only whoever is close. */
  quiet?: boolean;
}

export interface SceneHeader {
  day?: number;
  dateLabel?: string;
  time?: number; // minute of day
  glyph?: string;
  condition?: string;
  intensity?: string;
  tempC?: number;
  wind?: string;
  place?: string[];
}

export interface LedgerEvent {
  id: string;
  msgId: string;
  swipe: number;
  msgIndex: number;
  seq: number;
  source: EventSource;
  op: ParsedOp;
  at?: StoryTime | null;
  confidence: number;
  verdict: "accepted" | "rejected" | "warned";
  reason?: string;
}

export interface Meters {
  health?: number;
  fatigue?: number;
  hunger?: number;
  thirst?: number;
  pain?: number;
  intox?: number;
  arousal?: number;
  composure?: number;
  [k: string]: number | undefined;
}

export interface Injury {
  where: string;
  severity: 1 | 2 | 3 | 4;
  treated: boolean;
  since: StoryTime | null;
  note?: string;
}

export interface CharacterState {
  id: string;
  name: string;
  aliases: string[];
  slot: number;
  isUser: boolean;
  firstSeen: number; // msg index
  lastSeen: number;
  place?: string;
  tier?: "spot" | "peri" | "off";
  activity?: string;
  mood?: { name: string; v?: number; a?: number; d?: number; prev?: string; at?: StoryTime | null; msg?: number };
  meters: Meters;
  flags: string[];
  injuries: Injury[];
  look?: string;
  /** Set by the player on the Cast page. */
  age?: string;
  appearance?: string;
  /** The player's own "always" line: replaces what the card, lore and story say. */
  always?: string;
  status?: string;
  journal: { text: string; at: StoryTime | null; msgIndex: number }[];
  dead?: boolean;
  /** Has spoken, thought, or been named on a knowledge line: a person who can know things. */
  voiced?: boolean;
  /** The message they arrived in (an arrival hears nothing said before it). */
  arrivedMsg?: number;
  /** Replies whose cast line had them present (four or more without a word: not a person). */
  castSeen?: number;
  lastDriftAbs?: number;
  pressure?: string; // hidden pressure (narrator-only)
  /**
   * What doesn't change from scene to scene: eyes, hair, build, scars, voice, age. One entry per
   * kind (a newer "eyes" replaces the older one). `by: "user"` marks the player's word, which the
   * story can't overwrite.
   */
  traits?: Trait[];
}

export type TraitKind = "eyes" | "hair" | "height" | "build" | "skin" | "face" | "scar" | "mark" | "voice" | "age" | "other";

export interface Trait {
  kind: TraitKind;
  text: string;
  by: "user" | "model" | "card" | "lore";
  msgIndex: number;
}

/** A running bit the story can call back: a joke, a pet name, a catchphrase, a keepsake. */
export interface MotifState {
  id: string;
  text: string;
  /** Who it belongs to or who started it, as written. */
  who?: string;
  firstMsg: number;
  lastMsg: number;
  uses: number;
  by: "model" | "user";
}

export type BondAxis =
  | "trust" | "affection" | "respect" | "familiarity" | "comfort"
  | "attraction" | "fear" | "resentment" | "obligation" | "rivalry";

/** The romance ladder's rungs, 0–7. */
export const LADDER_NAMES = ["Strangers", "Aware", "Interested", "Charged", "Tested", "Spoken", "Together", "Established"];

/** Words models use for a rung, besides its name. */
export const LADDER_WORDS: Record<string, number> = {
  stranger: 0, strangers: 0, aware: 1, noticed: 1, interested: 2, curious: 2, drawn: 2, charged: 3, tension: 3, spark: 3,
  tested: 4, test: 4, trial: 4, spoken: 5, confessed: 5, confession: 5, declared: 5, together: 6, committed: 6, promised: 6,
  couple: 6, lovers: 6, dating: 6, established: 7, settled: 7, married: 7, bonded: 7,
};

export const BIPOLAR_AXES: BondAxis[] = ["trust", "affection", "respect", "comfort"];
export const ALL_AXES: BondAxis[] = [
  "trust", "affection", "respect", "familiarity", "comfort",
  "attraction", "fear", "resentment", "obligation", "rivalry",
];

export interface BondChange {
  axis: BondAxis;
  delta: number;
  from: number;
  to: number;
  cause?: string;
  at: StoryTime | null;
  msgIndex: number;
}

export interface BondState {
  from: string;
  to: string;
  axes: Partial<Record<BondAxis, number>>;
  label?: string;
  tags: string[];
  history: BondChange[];
}

export interface LadderState {
  from: string;
  to: string;
  tier: number;
  evidence?: string;
  at: StoryTime | null;
  msgIndex: number;
  history: { tier: number; evidence?: string; msgIndex: number }[];
}

export type KnowStatus = "knows" | "believes" | "suspects" | "wrong" | "unaware" | "doubts";
export type KnowTruth = "true" | "false" | "partial" | "unknown";

export interface KnowRow {
  id: string;
  holder: string;
  fact: string;
  status: KnowStatus;
  source?: string;
  truth: KnowTruth;
  at: StoryTime | null;
  msgIndex: number;
  supersededBy?: string;
  /** The fact this row is about (FactState.key). */
  factKey?: string;
}

/**
 * How someone came to stand where they do on a fact.
 * Having it: said (they said, wrote or did it) · lived · heard · told · overheard · read · saw · deduced · sensed · rumour · kept (a secret's keeper).
 * Lacking it: hidden (kept from them) · missed (not there when it came out) · stated (the story said they don't know).
 */
export type KnowRoute =
  | "said" | "lived" | "heard" | "told" | "overheard" | "read" | "saw" | "deduced" | "sensed" | "rumour" | "kept"
  | "hidden" | "missed" | "stated";

/** Where one person stands on a fact. */
export interface FactStance {
  holder: string;
  status: KnowStatus;
  /** How they came to it, as written: "deduced from her unfinished sentence". */
  how?: string;
  /** The route, normalised. */
  route?: KnowRoute;
  /** Who they had it from (a character id, or a thing: "the letter"). */
  from?: string;
  /** Their own (different, usually wrong) version of it. */
  version?: string;
  /** Not written for this person; the engine worked it out: the source, a witness, or a secret's keeping. */
  derived?: "source" | "witness" | "secret";
  /** Set by the player; the story doesn't change it. */
  set?: boolean;
  msgIndex: number;
  at: StoryTime | null;
}

/** One step in how a fact came out. */
export interface FactEntry {
  holder: string;
  status: KnowStatus;
  how?: string;
  route?: KnowRoute;
  from?: string;
  version?: string;
  /** Anything else the line carried: the evidence. */
  note?: string;
  derived?: FactStance["derived"];
  msgIndex: number;
  at: StoryTime | null;
}

/** A moment a fact came out in the open, and who was there to take it in. */
export interface FactOut {
  msgIndex: number;
  at: StoryTime | null;
  by?: string;
  channel: string;
  present: string[];
}

/** A fact the story tracks: one statement, who stands where on it, and how it came out. */
export interface FactState {
  key: string;
  statement: string;
  truth: KnowTruth;
  /** Statement set by the player; the story no longer rewrites it. */
  locked?: boolean;
  hidden?: boolean;
  /** Normalised phrasings seen for it, for matching lines without a key. */
  aliases: string[];
  /**
   * Kept off the page: not named in narration, thoughts or summaries until it comes out.
   * `words` never appear; `wording` is how the story may allude to it.
   */
  offPage?: { words: string[]; wording?: string; by: "user" | "auto"; off?: boolean };
  /** Other keys it has had (an automatic key replaced by the model's own). */
  altKeys?: string[];
  /** The key was made up from the wording, not written by the model. */
  autoKey?: boolean;
  stances: Record<string, FactStance>;
  history: FactEntry[];
  /** Each time it came out in the open (said aloud, shown). */
  out?: FactOut[];
  /** A secret: who keeps it, and from whom (those still without it). */
  keepers?: string[];
  keptFrom?: string[];
  /** People the player said have no record either way (no "wasn't there" guess). */
  cleared?: string[];
  /** Added by the player, not the story. */
  added?: boolean;
  firstMsg: number;
  lastMsg: number;
}

/** Something a person doesn't know, in words ("who raised her"); closes when they learn it. */
export interface KnowGap {
  text: string;
  since: number;
  lastMsg: number;
}

export interface ItemState {
  id: string;
  name: string;
  holder?: string; // character id, or "place:..." / "gone"
  condition?: string;
  /** The spot within the holder or place: "jacket pocket", "on the table". */
  where?: string;
  quantity?: number;
  custody: { from?: string; to?: string; how?: string; at: StoryTime | null; msgIndex: number }[];
  gone?: boolean;
  /** The last message a line named it (moved or not): whether it's in someone's hands this scene. */
  lastMsg?: number;
}

export type ThreadOp = "new" | "advance" | "complicate" | "bridge" | "resolve" | "stall";

export interface ThreadState {
  id: string;
  title: string;
  status: "open" | "stalled" | "resolved";
  latest?: string;
  blocker?: string;
  stalls: number;
  history: { op: ThreadOp; detail?: string; at: StoryTime | null; msgIndex: number }[];
  lastMsg: number;
}

export interface ConsState {
  id: string;
  kind: "owe" | "cons";
  who: string;
  whom?: string;
  what: string;
  status: "open" | "due" | "paid" | "broken" | "healed" | "resolved";
  due?: { at?: StoryTime; trigger?: string; raw: string };
  since: StoryTime | null;
  msgIndex: number;
}

export interface FactionState {
  id: string;
  name: string;
  clocks: Record<string, { name: string; cur: number; max: number; history: number[] }>;
}

export interface RumorState {
  id: string;
  text: string;
  from?: string;
  to?: string;
  truth: KnowTruth;
  hops: number;
  msgIndex: number;
}

export interface RepState {
  group: string;
  score: number;
  tags: string[];
  history: { delta: number; deed?: string; msgIndex: number }[];
}

export interface ArtifactState {
  id: string;
  title: string;
  kind: string;
  holder?: string;
  text?: string;
  meta?: string;
  keys: string[];
  msgIndex: number;
}

export interface GaugeState {
  name: string;
  cur: number;
  max: number;
  cause?: string;
  history: { v: number; msgIndex: number }[];
}

export interface ClueState {
  id: string;
  text: string;
  pointsTo?: string;
  reliability?: string;
  msgIndex: number;
}

export interface PlantState {
  id: string;
  text: string;
  payoff?: string;
  plantedAt: number; // msg index
  plantedScene: number;
  paidAt?: number;
}

export interface DeadlineState {
  id: string;
  title: string;
  at: StoryTime;
  msgIndex: number;
  done?: boolean;
}

export interface Milestone {
  at: StoryTime | null;
  msgIndex: number;
  kind: string;
  text: string;
}

export interface WeatherState {
  condition: string;
  intensity?: string;
  tempC?: number;
  wind?: string;
  glyph?: string;
  setAt: StoryTime | null;
  source: "model" | "engine" | "header";
}

/** Changes made by one message, for the drawer's "Δ" badge and deltas list. */
export interface MessageDelta {
  msgIndex: number;
  msgId: string;
  count: number;
  elapsed: number;
  lines: string[];
  rejected: { raw: string; reason: string }[];
}

export interface ThoughtState {
  /** Character id ("user" for the persona), or the name as written when it matched no one. */
  who: string;
  name: string;
  cue?: string;
  text: string;
  kind: "register" | "inline";
}

export interface WorldState {
  time: StoryTime | null;
  weather: WeatherState | null;
  /** The season as the story last set it, for calendars whose seasons the story keeps (Westeros, Roshar). */
  season?: { name: string; setAt: StoryTime | null } | null;
  place: string[];
  mode: string;
  title?: string;
  sceneNo: number;
  sceneLog: { no: number; startMsg: number; startAbs: number | null; place: string; title?: string }[];
  sceneStartMsg: number;
  sceneStartAbs: number | null;
  chars: Record<string, CharacterState>;
  bonds: Record<string, BondState>;
  ladders: Record<string, LadderState>;
  knowledge: KnowRow[];
  /** Knowledge compiled into facts (key → fact). */
  facts?: Record<string, FactState>;
  /** What each person doesn't know, in words (holder id → gaps). */
  gaps?: Record<string, KnowGap[]>;
  /** Speech from the latest messages, to tell what was said aloud, with who was there to hear it. */
  speech?: { msgIndex: number; lines: SpokenLine[]; present: string[]; fromUser?: boolean }[];
  /** The first message whose speech counts for the reply being filed (the one after the previous reply). */
  speechSince?: number;
  /** The last reply filed. */
  lastReply?: number;
  /** Knowledge lines as the Almanac filed them, per message (for the model's own history). */
  knowCanon?: Record<number, string[]>;
  /** Messages whose knowledge lines needed repair (bundled, untagged, diary-like). */
  knowRepair?: number[];
  items: Record<string, ItemState>;
  threads: Record<string, ThreadState>;
  cons: Record<string, ConsState>;
  factions: Record<string, FactionState>;
  rumors: RumorState[];
  rep: Record<string, RepState>;
  canon: { text: string; at: StoryTime | null; msgIndex: number; by?: "user" | "model"; pinned?: boolean }[];
  /** Running bits: jokes, pet names, catchphrases, keepsakes. */
  motifs?: MotifState[];
  artifacts: Record<string, ArtifactState>;
  keys: Record<string, string[]>;
  gauges: Record<string, GaugeState>;
  clues: ClueState[];
  plants: PlantState[];
  deadlines: Record<string, DeadlineState>;
  milestones: Milestone[];
  places: Record<string, { id: string; name: string; path: string[]; visits: number; lastMsg: number }>;
  voices: Record<string, number>; // char id -> slot
  nextSlot: number;
  lastDelta: MessageDelta | null;
  /** What the last reply changed (lastDelta can be the player's message). */
  replyDelta?: MessageDelta | null;
  /** The private thoughts the last reply voiced (Unspoken register or inline thought marks). */
  thoughts?: { msgIndex: number; list: ThoughtState[] } | null;
  genreHits: Record<string, number>; // instrument -> last msg index
  msgCount: number;
  ledgerCount: number;
  /** Elsewhere: the subplots running off the page (see core/elsewhere). */
  arcs?: Record<string, ArcState>;
  /** Elsewhere: where people off the page are (lower-case name → place). */
  whereabouts?: Record<string, { name: string; place: string; since: number | null; msgIndex: number }>;
  unverified: number[]; // msg indexes whose ledger came from repair/extractor
}

export interface Settings {
  enabled: "auto" | "on" | "off";
  strictness: "strict" | "lenient";
  autoRepair: boolean;
  formatAid: boolean;
  rawTail: number;
  rawTailTokens: number;
  chapterThresholdTokens: number;
  fanIn: number;
  hideCovered: boolean;
  chronicle: boolean;
  /** Which summaries go in the prompt: the whole story every turn, or only the ones this turn touches. */
  chronicleInject: "all" | "relevant";
  summarizerConnection: string;
  /** The Lorebook Creator's conversation and writing ("" = the summariser's connection). */
  creatorConnection: string;
  /** How much the chronicle keeps: brief, standard, detailed or exhaustive. */
  summaryDetail: "brief" | "standard" | "detailed" | "exhaustive";
  /** Free text the summariser always keeps ("outfits", "Buffy's lies"). */
  summaryFocus: string;
  recallBudget: number;
  recallPlacement: "before_history" | "depth4";
  /**
   * Ceiling on everything the Almanac adds to one prompt (note, recall, mirror cards, chapter
   * summaries), in tokens. Over it, the summaries narrow to the relevant ones, then the
   * lowest-ranked recall goes. 0: no ceiling.
   */
  injectCeiling: number;
  keyHeat: boolean;
  maxKeys: number;
  stopList: string[];
  loreDefaultMode: "native" | "assisted" | "managed";
  climate: string;
  latitude: string;
  calendar: string;
  simStep: number; // minutes
  /** Legacy switch (before Elsewhere); read once to set `elsewhere`. */
  simulator: boolean;
  /** Elsewhere: how lively the world off the page is. */
  elsewhere: "off" | "quiet" | "living" | "restless";
  /** Elsewhere: the model tells the beats, or the engine's own sentences do (no model calls). */
  elsewhereTelling: "model" | "engine";
  /** Elsewhere: new subplots grounded in the story and lorebooks are proposed to the player (ask), start on their own (auto), or aren't made (off). */
  elsewhereSeeding: "ask" | "auto" | "off";
  /** How much the source canon may pull: forecasts as grounds (light) or as a course (strong). */
  canonGravity: "off" | "light" | "strong";
  /** Irreversible outcomes off the page: only on the page, ask first, or allow. */
  fates: "page" | "ask" | "allow";
  /** The Elsewhere page shows everything (director) or only what has reached the story (surprise). */
  elsewhereView: "director" | "surprise";
  simConnection: string;
  sidecarConnection: string;
  sidecarTimeout: number;
  /** The knowledge clerk: a quiet pass that rewrites a reply's knowledge lines cleanly. */
  knowledgeClerk: "off" | "auto" | "always";
  clerkConnection: string;
  mirror: "off" | "summaries" | "full";
  mirrorVectorize: boolean;
  hud: boolean;
  theme: "preset" | "almanac" | "night" | "solar" | "nocturne" | "botanical" | "prism" | "candy" | "dossier" | "scriptorium" | "arcana" | "orbital" | "posy" | "lumiverse";
  /** Light or dark palette for the skin; auto follows Lumiverse. */
  skinMode: "auto" | "light" | "dark";
  /** The player's own colours, laid over a skin's palette. */
  skinColors: SkinColors;
  fonts: boolean;
  narratorOnlyToTools: boolean;
  telemetry: boolean;
  /** Check each reply after it is written: rules only, rules plus a quiet model read, or off. */
  replyCheck: "off" | "rules" | "model";
  replyCheckConnection: string;
  /** Read facts the player states in their own messages (dates, looks, where things are). */
  playerFacts: "off" | "rules" | "model";
  /** Mark who speaks the lines a reply left without [spk] marks (a quiet call after the reply). */
  speakerRead: boolean;
  /** Secrets stay off the page (narration, thoughts, summaries) until they come out. */
  secretsOffPage: boolean;
  pressures: boolean;
  chekhov: boolean;
  debug: boolean;
}

/** Colours changed by the player: skin id → mode → token ("panel", "accent"…) → #rrggbb. */
export type SkinColors = Record<string, { light?: Record<string, string>; dark?: Record<string, string> }>;

export const DEFAULT_SETTINGS: Settings = {
  enabled: "auto",
  strictness: "strict",
  autoRepair: true,
  formatAid: false,
  rawTail: 20,
  rawTailTokens: 12000,
  chapterThresholdTokens: 6000,
  fanIn: 4,
  hideCovered: true,
  chronicle: true,
  chronicleInject: "all",
  summarizerConnection: "",
  creatorConnection: "",
  summaryDetail: "detailed",
  summaryFocus: "",
  recallBudget: 2400,
  recallPlacement: "before_history",
  injectCeiling: 24000,
  keyHeat: true,
  maxKeys: 12,
  stopList: [],
  loreDefaultMode: "assisted",
  climate: "",
  latitude: "temperate",
  calendar: "",
  simStep: 120,
  simulator: false,
  elsewhere: "off",
  elsewhereTelling: "model",
  elsewhereSeeding: "ask",
  canonGravity: "light",
  fates: "ask",
  elsewhereView: "director",
  simConnection: "",
  sidecarConnection: "",
  sidecarTimeout: 20,
  knowledgeClerk: "auto",
  clerkConnection: "",
  mirror: "summaries",
  mirrorVectorize: false,
  hud: true,
  theme: "preset",
  skinMode: "auto",
  skinColors: {},
  fonts: false,
  narratorOnlyToTools: false,
  telemetry: true,
  replyCheck: "rules",
  replyCheckConnection: "",
  playerFacts: "rules",
  speakerRead: true,
  secretsOffPage: true,
  pressures: true,
  chekhov: true,
  debug: false,
};

/** Per-chat configuration chosen in Session Zero (also mirrored to chat variables). */
export interface ChatConfig {
  sessionZeroDone: boolean;
  genres: string[];
  tone?: string;
  romance?: string;
  difficulty?: string;
  nsfw?: string;
  limits?: string;
  climate?: string;
  latitude?: string;
  calendar?: string;
  startPoint?: string;
  personaMode?: string;
  trackers?: string[];
  theme?: string;
  colors: Record<string, string>; // char id -> css colour
  /** Names merged by hand: lower-case name → "user" or the character's name ("-": not a person). */
  merges?: Record<string, string>;
  /** Player edits to facts: rename, set truth, merge into another fact, hide. */
  factEdits?: Record<string, FactEdit>;
  /** Player edits to the cast, by character id: a new name, age and appearance, or someone added by hand. */
  castEdits?: Record<string, CastEdit>;
  enabledOverride?: boolean;
  /** Story truths the player pinned, always in the note ("Jaime and Cersei are strictly family"). */
  truths?: string[];
  /** Elsewhere, per chat: a mode of its own, and the player's word on people. */
  elsewhere?: ElsewhereConfig;
}

export interface CastEdit {
  name?: string;
  age?: string;
  appearance?: string;
  /** The "always" line as the player wrote it (empty: back to what the card, lore and story say). */
  always?: string;
  /** Aliases the player took away, and ones they gave. */
  dropAliases?: string[];
  addAliases?: string[];
  /** Added by the player: the message they join the story at. */
  added?: number;
}

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  sessionZeroDone: false,
  genres: [],
  colors: {},
};

export interface FactEdit {
  statement?: string;
  truth?: KnowTruth;
  /** Merge this fact into another key. */
  into?: string;
  hidden?: boolean;
  /** Where people stand, set by the player: a stance, "unaware", or "none" (no record either way). */
  people?: Record<string, KnowStatus | "none">;
  /** A fact the player added: the message it was added at. */
  added?: number;
  /** Keep it off the page: words never to use, and how the story may allude to it. null: the player turned it off. */
  offPage?: { words: string[]; wording?: string } | null;
}

// ---------------------------------------------------------------------------
// Elsewhere: the world off the page (design/09)
// ---------------------------------------------------------------------------

export type ArcKind =
  | "pursuit" | "scheme" | "rivalry" | "courtship" | "rift" | "debt" | "secret" | "decline"
  | "investigation" | "threat" | "return" | "duty" | "life" | "loss" | "world";
export type ArcStage = "setup" | "rising" | "crisis" | "aftermath";
export type BeatResult = "win" | "cost" | "loss";
export type ArcStatus = "running" | "held" | "fate" | "resolved" | "dropped";

export interface ArcBeat {
  atAbs: number;
  roll: [number, number];
  mod: number;
  result: BeatResult;
  twist?: string;
  text: string;
  told: "model" | "template";
  msgIndex: number;
  tick?: string;
  place?: string;
  /** Why the engine's words stand when the model was asked to tell it. */
  note?: string;
}

export interface ArcState {
  id: string;
  kind: ArcKind;
  /** The lead's name (a person, a group, or "the world"). */
  lead: string;
  cast: string[];
  premise: string;
  want: string;
  fear: string;
  /** Record ids, #fact keys and thread ids it rests on: never empty. */
  grounds: string[];
  secrecy: "public" | "private" | "secret";
  clock: { cur: number; max: number };
  tally: { win: number; cost: number; loss: number };
  heat: number;
  stage: ArcStage;
  beats: ArcBeat[];
  /** Older beats, folded into a line. */
  earlier?: string;
  nextAbs: number;
  status: ArcStatus;
  /** It has reached the player's story (an entrance used, a carrier's news taken up). */
  crossed?: boolean;
  thread?: string;
  by: "engine" | "player" | "lore";
  /** The player's own words; the engine never rewrites them. */
  locked?: boolean;
  place?: string;
  startedAbs: number;
  startedMsg: number;
  lastBeatAbs?: number;
  /** The player asked for a crossing next turn. */
  bring?: boolean;
  /** The player asked for its next step now (nudge, or a story they just wrote). */
  push?: boolean;
  /** Why its next step waits (asleep, news not yet heard), shown on the Elsewhere page. */
  wait?: string;
  /** A faction clock it moves (the Hellions' raid). */
  faction?: { name: string; project: string };
  /** An irreversible outcome waiting on the player, and their word on it. */
  fate?: { text: string; decision?: "accept" | "soften" | "page" };
  ending?: { result: string; text: string; atAbs: number };
  note?: string;
}

export type Standing = "here" | "away" | "captive" | "changed" | "dead" | "companion" | "construct";

export interface ElsewhereConfig {
  mode?: Settings["elsewhere"];
  /** The player's word on people, by lower-case name. */
  people?: Record<string, { out?: boolean; wake?: boolean; offPage?: boolean; standing?: Standing; where?: string }>;
}
