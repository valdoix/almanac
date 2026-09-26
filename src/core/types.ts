import type { StoryTime } from "./util";

export type OpName =
  | "clock" | "wx" | "at" | "cast" | "mood" | "body" | "look" | "bond" | "ladder" | "know"
  | "item" | "thread" | "owe" | "cons" | "clockf" | "rumor" | "rep" | "journal" | "keys"
  | "canon" | "artifact" | "mode" | "status" | "gauge" | "clue" | "plant" | "payoff"
  | "deadline" | "title"
  // extension-only ops (never written by the model)
  | "forecast" | "pressure" | "diverge" | "entity" | "lock";

export type EventSource = "model" | "repair" | "extractor" | "archivist" | "user" | "lore" | "engine" | "sim";

/** One parsed ledger line, before validation. */
export interface ParsedOp {
  op: OpName;
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
  thoughts?: { who: string; slot?: number; cue?: string; text: string }[];
  /** Filed artifacts ([vtk=…]) found in the same message. */
  vtks?: { kind: string; title: string; meta: string; body: string }[];
  /** Speakers named in [spk=Name#N] marks, first occurrence each. */
  speakers?: { name: string; slot?: number }[];
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
  mood?: { name: string; v?: number; a?: number; d?: number; prev?: string; at?: StoryTime | null };
  meters: Meters;
  flags: string[];
  injuries: Injury[];
  look?: string;
  status?: string;
  journal: { text: string; at: StoryTime | null; msgIndex: number }[];
  dead?: boolean;
  lastDriftAbs?: number;
  pressure?: string; // hidden pressure (narrator-only)
}

export type BondAxis =
  | "trust" | "affection" | "respect" | "familiarity" | "comfort"
  | "attraction" | "fear" | "resentment" | "obligation" | "rivalry";

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
}

export interface ItemState {
  id: string;
  name: string;
  holder?: string; // character id, or "place:..." / "gone"
  condition?: string;
  quantity?: number;
  custody: { from?: string; to?: string; how?: string; at: StoryTime | null; msgIndex: number }[];
  gone?: boolean;
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

export interface WorldState {
  time: StoryTime | null;
  weather: WeatherState | null;
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
  items: Record<string, ItemState>;
  threads: Record<string, ThreadState>;
  cons: Record<string, ConsState>;
  factions: Record<string, FactionState>;
  rumors: RumorState[];
  rep: Record<string, RepState>;
  canon: { text: string; at: StoryTime | null; msgIndex: number }[];
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
  genreHits: Record<string, number>; // instrument -> last msg index
  msgCount: number;
  ledgerCount: number;
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
  summarizerConnection: string;
  recallBudget: number;
  recallPlacement: "before_history" | "depth4";
  controller: "off" | "collapsed";
  controllerConnection: string;
  semanticSource: "mirror" | "none";
  keyHeat: boolean;
  maxKeys: number;
  stopList: string[];
  loreDefaultMode: "native" | "assisted" | "managed";
  lorePermission: "read" | "overlay" | "write";
  climate: string;
  latitude: string;
  calendar: string;
  simStep: number; // minutes
  simulator: boolean;
  simConnection: string;
  socialTicks: boolean;
  rumors: boolean;
  sidecar: boolean;
  sidecarConnection: string;
  sidecarTimeout: number;
  mirror: "off" | "summaries" | "full";
  mirrorVectorize: boolean;
  hud: boolean;
  theme: "preset" | "almanac" | "solar" | "nocturne" | "botanical" | "prism" | "candy";
  fonts: boolean;
  narratorOnlyToTools: boolean;
  telemetry: boolean;
  pressures: boolean;
  chekhov: boolean;
  debug: boolean;
}

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
  summarizerConnection: "",
  recallBudget: 2400,
  recallPlacement: "before_history",
  controller: "off",
  controllerConnection: "",
  semanticSource: "mirror",
  keyHeat: true,
  maxKeys: 12,
  stopList: [],
  loreDefaultMode: "assisted",
  lorePermission: "read",
  climate: "",
  latitude: "temperate",
  calendar: "",
  simStep: 120,
  simulator: false,
  simConnection: "",
  socialTicks: true,
  rumors: true,
  sidecar: false,
  sidecarConnection: "",
  sidecarTimeout: 20,
  mirror: "summaries",
  mirrorVectorize: false,
  hud: true,
  theme: "preset",
  fonts: true,
  narratorOnlyToTools: false,
  telemetry: true,
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
  enabledOverride?: boolean;
}

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  sessionZeroDone: false,
  genres: [],
  colors: {},
};
