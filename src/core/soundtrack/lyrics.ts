// Soundtrack (design/11 §23): songs whose words fit the scene. A mood search finds songs that sound
// right; the lyrics say what a song is about. A tender scene on the couch shouldn't get a breakup
// song or a club anthem because both happen to be by an artist the player likes. Lyrics are read
// into a theme profile (how much of the song is about comfort, heartbreak, desire…) and only the
// profile is kept, never the words. The scene's themes come from its mood, the last exchange, what
// the people present feel and (with the model director) the model's reading.

import type { Mood } from "./moods";

/** The lexicon's version: bump it when the word lists change, and cached profiles are read again. */
export const LEXICON = 1;

export const THEMES = [
  "love", "desire", "comfort", "heartbreak", "longing", "grief", "lonely", "fear", "fight", "power",
  "party", "hope", "secrets", "regret", "escape", "night", "family", "magic", "nostalgia", "doubt",
] as const;
export type Theme = (typeof THEMES)[number];
export const isTheme = (x: unknown): x is Theme => typeof x === "string" && (THEMES as readonly string[]).includes(x);

/** How a theme reads in the "why" line ("lyrics about comfort"). */
export const THEME_LABEL: Record<Theme, string> = {
  love: "love", desire: "desire", comfort: "comfort", heartbreak: "heartbreak", longing: "missing someone", grief: "loss",
  lonely: "loneliness", fear: "fear", fight: "fighting", power: "winning", party: "partying", hope: "hope", secrets: "secrets",
  regret: "regret", escape: "getting away", night: "night", family: "family", magic: "magic", nostalgia: "the past", doubt: "self-doubt",
};

/** A word or two searched with the lead genre for the scene's main theme. */
export const THEME_SEARCH: Record<Theme, string> = {
  love: "love song", desire: "seductive", comfort: "comfort", heartbreak: "heartbreak", longing: "missing you", grief: "losing someone",
  lonely: "lonely", fear: "scared", fight: "fight", power: "empowerment", party: "party", hope: "hope", secrets: "secrets",
  regret: "sorry", escape: "run away", night: "midnight", family: "family", magic: "witchy", nostalgia: "nostalgia", doubt: "anxiety",
};

/**
 * Words that say a song is about a theme. Each is a regex fragment matched as whole words; a word
 * counts up to three times (a chorus says what a song is about). "baby" and "tonight" are nowhere:
 * every pop song says them.
 */
const LYRIC: Record<Theme, string[]> = {
  love: ["love[sd]?", "lover", "in love", "my heart", "adore", "darling", "forever", "kiss(?:es|ed|ing)?", "together", "sweetheart", "soulmate", "my person", "be mine", "i'm yours", "only you", "fall(?:ing)? for"],
  desire: ["want you", "need you", "body", "skin", "touch(?:ing)?", "lips", "bed", "sheets", "sexy", "naked", "come over", "your hands", "desire", "lust", "sweat(?:y|ing)?", "undress\\w*", "ride", "feel you", "taste", "heat", "moan(?:ing)?", "breathless"],
  comfort: ["home", "safe", "stay", "hold me", "warm(?:th)?", "with you", "gentle", "it's (?:ok|okay|alright|all right)", "i(?:'ve| have)? got you", "shelter", "soft(?:ly)?", "calm", "peace(?:ful)?", "lullaby", "don't worry", "by my side", "you're here", "rest", "cozy"],
  heartbreak: ["goodbye", "it's over", "over now", "break(?:s|ing)? my heart", "broken?", "heartbreak", "heartbroken", "tears?", "cry(?:ing)?", "cried", "without you", "walk(?:ed)? away", "left me", "leave me", "moved? on", "cheat(?:ed|ing|er)?", "you're gone", "let (?:me|you) go", "over you", "the end", "break up", "ex"],
  longing: ["miss(?:ing|ed)? you", "miss", "wish(?:ed)?", "waiting", "far away", "come back", "someday", "distance", "where are you", "think(?:ing)? (?:of|about) you", "long for", "ache", "yearn(?:ing)?", "i'll wait", "one day"],
  grief: ["die[sd]?", "dead", "death", "dying", "grave", "funeral", "heaven", "buried", "mourn(?:ing)?", "rest in peace", "ashes", "gone forever", "lost you", "eulogy", "casket", "coffin", "afterlife", "six feet", "suicid\w*"],
  lonely: ["alone", "lonely", "loneliness", "nobody", "no one", "empty", "on my own", "by myself", "silence", "isolat\\w+", "nowhere", "invisible", "all by myself"],
  fear: ["afraid", "scared", "fear", "terrified", "hide", "hiding", "monsters?", "nightmares?", "panic", "shaking", "trembl\\w+", "danger(?:ous)?", "can't breathe", "creep(?:ing|y)?", "scream(?:ing)?", "run for (?:my|your) life"],
  fight: ["fight(?:ing)?", "war", "rage", "burn it down", "enem(?:y|ies)", "blood", "battle", "revenge", "kill(?:ed|ing)?", "fists?", "hate you", "destroy", "weapons?", "guns?", "knife", "swords?", "bullets?", "attack", "violence", "riot", "bleed(?:ing)?"],
  power: ["win(?:ning)?", "crown", "queen", "king", "champion", "on top", "unstoppable", "rise", "glory", "victory", "strong(?:er)?", "legend", "boss", "power(?:ful)?", "fearless", "invincible", "hall of fame", "the best", "conquer", "fame", "famous", "greatest", "superstar"],
  party: ["party", "dance", "dancing", "drink(?:s|ing)?", "club", "shots?", "celebrate", "fun", "wild", "dj", "champagne", "dance ?floor", "turn (?:it )?up", "let's go", "bottles?", "vodka", "tequila", "drunk"],
  hope: ["hope", "tomorrow", "new day", "begin(?:ning)?", "sunrise", "better days", "believe", "heal(?:ing)?", "start (?:again|over)", "brighter", "shine", "rise up", "keep going", "the sun will", "it gets better"],
  secrets: ["secrets?", "lies", "lied", "lying", "liar", "betray\\w*", "trust", "masks?", "truth", "behind my back", "nobody knows", "hidden", "whisper(?:s|ed)?", "confess\\w*", "pretend(?:ing)?", "two-faced", "don't tell"],
  regret: ["sorry", "regret\\w*", "mistakes?", "forgive(?:n|ness)?", "my fault", "shame", "apolog\\w+", "take it back", "should(?:'ve| have)", "if only", "guilt(?:y)?", "blame"],
  escape: ["run away", "escape", "road", "drive", "driving", "highway", "free(?:dom)?", "fly(?:ing)?", "wings", "get out", "leave this town", "far from here", "train", "miles", "horizon", "wander\\w*"],
  night: ["night", "midnight", "moon(?:light)?", "stars?", "dreams?", "dreaming", "sleep(?:ing|less)?", "3 ?am", "dark", "darkness", "after dark"],
  family: ["mother", "mom(?:ma|my)?", "mama", "father", "dad", "sister", "brother", "family", "kids?", "child(?:hood)?", "daughter", "son", "best friend", "friends?"],
  magic: ["magic(?:al)?", "spells?", "witch(?:es|craft)?", "curse[sd]?", "vampires?", "demons?", "devil", "ghosts?", "haunt\\w*", "angels?", "potion", "sorcer\\w+", "fairy", "supernatural", "enchant\\w*"],
  nostalgia: ["remember when", "used to", "back then", "old days", "growing up", "young(?:er)?", "summer", "school", "years ago", "nostalgi\\w+", "when we were", "memories", "photographs?"],
  doubt: ["who am i", "mirror", "not enough", "anxious", "anxiety", "crazy", "insane", "in my head", "my mind", "overthink\\w*", "insecure", "losing my mind", "what's wrong with me", "fake"],
};

/**
 * Words that say a scene is about a theme. Story prose isn't a song: "home", "dark" and "touch"
 * turn up in every reply, so these are narrower. Themes the mood already carries (desire in a sex
 * scene, fighting in combat) aren't read here.
 */
const SCENE: Partial<Record<Theme, string[]>> = {
  love: ["i love you", "loves? (?:her|him|you|them)", "in love", "fell for", "falling for", "confess(?:es|ed)? (?:his|her|their|my) feelings"],
  comfort: ["hold(?:s|ing)? (?:her|him|me|them) close", "safe", "comfort\\w*", "reassur\\w+", "i(?:'ve| have)? got you", "it's (?:ok|okay)", "you're (?:ok|okay|safe)", "blanket", "cocoa", "curl(?:s|ed)? up", "lean(?:s|ed)? (?:into|against)", "snuggl\\w+", "cuddl\\w+"],
  heartbreak: ["break(?:s|ing)? up", "broke up", "breakup", "dumped", "it's over", "we're done", "cheat(?:s|ed|ing)?", "heartbr\\w+", "leav(?:e|es|ing) (?:you|her|him|me) for"],
  longing: ["miss(?:es|ed)? (?:her|him|you|them)", "homesick", "far away", "wish(?:es|ed)? (?:she|he|they|you|i) (?:were|was|could|had)", "longing"],
  grief: ["funeral", "grave", "mourn\\w*", "died", "death", "buried", "burial", "memorial", "ashes", "the body", "passed away", "grief", "griev\\w+"],
  lonely: ["alone", "lonely", "loneliness", "empty (?:house|room|apartment|bed)", "no one (?:else|left)", "by (?:her|him|my|them)self", "isolat\\w+"],
  fear: ["afraid", "scared", "terrif\\w+", "fear", "nightmares?", "panic\\w*", "trembl\\w+", "monsters?", "danger(?:ous)?"],
  power: ["won", "victory", "triumph\\w*", "champion", "promot\\w+", "crowned", "defeated"],
  party: ["party", "dance", "dancing", "drinks", "bar", "club", "celebrat\\w+", "birthday", "toast", "shots"],
  hope: ["hope\\w*", "fresh start", "new start", "heal\\w*", "start over", "a future"],
  secrets: ["secrets?", "lie", "lied", "lying", "liar", "truth", "hide", "hiding", "hidden", "betray\\w*", "confess\\w*", "don't tell", "pretend\\w*"],
  regret: ["sorry", "apolog\\w+", "forgive\\w*", "my fault", "guilt\\w*", "regret\\w*", "ashamed", "shame", "mistake"],
  escape: ["run away", "ran away", "escap\\w+", "road trip", "leave town", "get out of here", "highway", "drive away"],
  family: ["mom", "mother", "dad", "father", "sister", "brother", "family", "daughter", "parents", "mum"],
  magic: ["magic(?:al|k)?", "spells?", "witch\\w*", "curse[sd]?", "vampires?", "demons?", "slayer", "ritual", "hex(?:es|ed)?", "potion", "sorcer\\w+", "supernatural", "enchant\\w*"],
  nostalgia: ["remember when", "used to", "years ago", "childhood", "back when", "old photos?", "when we were (?:kids|young|little)"],
  doubt: ["not enough", "who am i", "insecur\\w+", "anxious", "anxiety", "overthink\\w*", "worthless", "self-doubt", "good enough"],
};

const compile = (terms: string[]) => terms.map((t) => new RegExp(`(?<![\\p{L}\\p{N}'])(?:${t})(?![\\p{L}\\p{N}])`, "giu"));
const LYRIC_RE = Object.fromEntries(THEMES.map((t) => [t, compile(LYRIC[t])])) as Record<Theme, RegExp[]>;
const SCENE_RE = Object.fromEntries(THEMES.filter((t) => SCENE[t]).map((t) => [t, compile(SCENE[t]!)])) as Partial<Record<Theme, RegExp[]>>;

/**
 * Concrete images a scene and a song can share: rain on the window and a song about rain. Only
 * words that say something; "door", "light" and "hand" are in every reply.
 */
export const IMAGERY = [
  "rain", "storm", "thunder", "lightning", "snow", "fire", "flames", "smoke", "ashes", "moon", "moonlight", "stars", "sunrise", "sunset",
  "midnight", "ocean", "sea", "river", "waves", "beach", "highway", "train", "city", "streets", "rooftop", "bridge", "sheets", "couch",
  "kitchen", "mirror", "candle", "ghost", "blood", "knife", "gun", "sword", "bones", "grave", "cemetery", "church", "heaven", "hell",
  "angel", "devil", "wolf", "crown", "wine", "whiskey", "cigarette", "coffee", "dress", "ring", "wedding", "flowers", "roses", "garden",
  "forest", "woods", "mountain", "desert", "phone", "letter", "car", "bath", "shower", "ice", "gold", "diamond", "cherry", "lipstick",
] as const;
const IMAGERY_RE = IMAGERY.map((w) => [w, new RegExp(`(?<![\\p{L}\\p{N}])${w}(?:s|es)?(?![\\p{L}\\p{N}])`, "giu")] as const);

const count = (re: RegExp, text: string) => {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(text) && n < 50) n++;
  return n;
};

/** Lyrics as plain lower-case words: no timestamps or [Chorus] marks, curly quotes straightened. */
export function plainLyrics(text: string): string {
  return text
    .replace(/^\s*\[[^\]\n]*\]\s*/gm, "")
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .replace(/(\p{L})in'(?![\p{L}])/gu, "$1ing");
}

/** What a song's words are about: kept per song instead of the lyrics. */
export interface LyricProfile {
  /** Theme → hits (each word counted up to three times). */
  themes: Partial<Record<Theme, number>>;
  /** Concrete images the song names. */
  images: string[];
}

export function profileLyrics(text: string): LyricProfile {
  const t = plainLyrics(text);
  const themes: Partial<Record<Theme, number>> = {};
  for (const th of THEMES) {
    let hits = 0;
    for (const re of LYRIC_RE[th]) hits += Math.min(3, count(re, t));
    if (hits) themes[th] = hits;
  }
  const images = IMAGERY_RE.filter(([, re]) => count(re, t) > 0).map(([w]) => w);
  return { themes, images };
}

/** The themes a mood carries on its own (weights sum to 1). */
export const MOOD_THEMES: Record<Mood, Partial<Record<Theme, number>>> = {
  calm: { comfort: 0.6, night: 0.2, hope: 0.2 },
  warm: { comfort: 0.5, family: 0.3, hope: 0.2 },
  playful: { party: 0.5, love: 0.2, hope: 0.3 },
  tender: { comfort: 0.5, love: 0.5 },
  romantic: { love: 0.7, desire: 0.3 },
  sensual: { desire: 0.7, love: 0.3 },
  erotic: { desire: 1 },
  hopeful: { hope: 0.7, escape: 0.3 },
  triumphant: { power: 0.8, hope: 0.2 },
  adventurous: { escape: 0.7, power: 0.3 },
  mysterious: { secrets: 0.6, night: 0.2, magic: 0.2 },
  eerie: { fear: 0.5, magic: 0.3, night: 0.2 },
  tense: { fear: 0.5, fight: 0.3, secrets: 0.2 },
  dread: { fear: 0.7, fight: 0.3 },
  combat: { fight: 0.8, power: 0.2 },
  melancholy: { longing: 0.4, lonely: 0.3, regret: 0.3 },
  grief: { grief: 0.7, longing: 0.3 },
  dreamy: { night: 0.5, comfort: 0.3, love: 0.2 },
};

/**
 * Themes that work against each other: a scene about one sinks songs about the other. A tender
 * evening doesn't want a breakup or a club; a grieving one doesn't want a victory lap.
 */
const OPPOSED: [Theme, Theme][] = [
  ["love", "heartbreak"], ["comfort", "heartbreak"], ["comfort", "fear"], ["comfort", "fight"], ["comfort", "party"],
  ["love", "fight"], ["love", "lonely"], ["party", "grief"], ["party", "lonely"], ["fight", "party"], ["desire", "grief"],
  ["desire", "family"], ["grief", "power"], ["hope", "doubt"],
];
const opposite = (t: Theme): Theme[] => OPPOSED.flatMap(([a, b]) => (a === t ? [b] : b === t ? [a] : []));

export interface SceneTheme {
  t: Theme;
  w: number;
}

export interface SceneThemeInput {
  mood: Mood;
  /** The last exchange, with the off-page blocks already taken out. */
  text: string;
  /** The strongest feeling among the people present ("fear", "sad"…), and how strongly. */
  feeling?: { top: string | null; score: number };
  /** The model's reading of the scene (director: model). */
  hint?: Theme[];
}

/** Moods that are their own subject: a sex scene or a fight takes less from the words around it. */
const OWN_SUBJECT = new Set<Mood>(["sensual", "erotic", "combat"]);

const FEELING_THEME: Record<string, Theme> = { fear: "fear", anger: "fight", sad: "longing", desire: "desire", joy: "party", warm: "comfort" };

/** What the scene is about, strongest first (weights sum to 1, at most four). */
export function sceneThemes(inp: SceneThemeInput): SceneTheme[] {
  const w: Partial<Record<Theme, number>> = {};
  const add = (t: Theme, x: number) => (w[t] = (w[t] ?? 0) + x);
  const own = MOOD_THEMES[inp.mood];
  for (const [t, x] of Object.entries(own)) add(t as Theme, x!);
  // What the page says can't work against what the mood is mostly about: a sex scene with a burial
  // dress on the floor and "your parents are coming" in it is still about desire.
  const against = new Set((Object.entries(own) as [Theme, number][]).filter(([, x]) => x >= 0.5).flatMap(([t]) => opposite(t)));
  // The last exchange: a theme needs two hits (one word in a long reply is chance).
  const text = inp.text.replace(/[‘’]/g, "'").toLowerCase();
  for (const [t, res] of Object.entries(SCENE_RE) as [Theme, RegExp[]][]) {
    if (against.has(t)) continue;
    let hits = 0;
    for (const re of res) hits += Math.min(2, count(re, text));
    if (hits >= 2) add(t, (OWN_SUBJECT.has(inp.mood) ? 0.3 : 0.6) * Math.min(1, hits / 4));
  }
  const f = inp.feeling?.top ? FEELING_THEME[inp.feeling.top] : undefined;
  if (f && !against.has(f)) add(f, 0.3 * Math.min(1, inp.feeling!.score));
  const hint = (inp.hint ?? []).filter(isTheme).slice(0, 3);
  for (const t of hint) add(t, 0.8 / hint.length);
  const list = (Object.entries(w) as [Theme, number][]).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const total = list.reduce((s, [, x]) => s + x, 0) || 1;
  return list.map(([t, x]) => ({ t, w: Math.round((x / total) * 100) / 100 }));
}

/** Images worth matching in the scene: the cue's colour words, and ones the last exchange names twice. */
export function sceneImages(text: string, colour: string[]): string[] {
  const out = new Set<string>();
  const t = text.toLowerCase();
  for (const [w, re] of IMAGERY_RE) if (colour.includes(w) || count(re, t) >= 2) out.add(w);
  return [...out].slice(0, 8);
}

export interface LyricFit {
  /** How well the words fit, before it's weighed against the other songs found (about -0.8..+1.5). */
  fit: number;
  /** The song said enough to tell. */
  known: boolean;
  reasons: string[];
}

/**
 * How well a song's words fit the scene's themes: the share of the song about what the scene is
 * about, less the share about what works against it, trusted as far as the song says enough to
 * tell, plus the images the two share.
 */
export function lyricFit(p: LyricProfile | null | undefined, themes: SceneTheme[], images: string[] = []): LyricFit {
  if (!p || !themes.length) return { fit: 0, known: false, reasons: [] };
  const total = Object.values(p.themes).reduce((s, x) => s + (x ?? 0), 0);
  if (total < 3) return { fit: 0, known: false, reasons: [] };
  const share = (t: Theme) => (p.themes[t] ?? 0) / total;
  const inScene = new Set(themes.filter((x) => x.w >= 0.15).map((x) => x.t));
  let fit = 0;
  let best: Theme | null = null;
  let bestC = 0;
  let clash = 0;
  let worst: Theme | null = null;
  let worstC = 0;
  for (const { t, w } of themes) {
    const c = w * share(t);
    fit += c;
    if (c > bestC) [best, bestC] = [t, c];
    for (const o of opposite(t)) {
      if (inScene.has(o)) continue;
      const k = w * share(o);
      clash += k;
      if (k > worstC) [worst, worstC] = [o, k];
    }
  }
  const conf = Math.min(1, total / 8);
  let score = conf * (1.4 * fit - 0.8 * clash);
  const reasons: string[] = [];
  if (best && bestC >= 0.06) reasons.push(`lyrics about ${THEME_LABEL[best]}`);
  if (worst && worstC >= 0.06) reasons.push(`but lyrics about ${THEME_LABEL[worst]}`);
  const shared = images.filter((i) => p.images.includes(i));
  if (shared.length) {
    score += Math.min(0.15, 0.05 * shared.length);
    reasons.push(`lyrics say ${shared.slice(0, 2).join(", ")}`);
  }
  return { fit: score, known: true, reasons };
}

/**
 * Move picks up or down by their lyrics and sort again. A song is weighed against the others whose
 * words were found (their median is the middle), so a song with no lyrics found, or an
 * instrumental, sits in the middle too: neither helped nor held back. Only songs with a profile
 * change; the first reason leads, so the "why" says what the words are about.
 */
export function relyric<T extends { track: { videoId: string }; score: number; reasons: string[] }>(scored: T[], profiles: Map<string, LyricProfile | null>, themes: SceneTheme[], images: string[] = []): T[] {
  const fits = new Map(scored.map((s) => [s.track.videoId, lyricFit(profiles.get(s.track.videoId), themes, images)] as const));
  const known = [...fits.values()].filter((f) => f.known).map((f) => f.fit).sort((a, b) => a - b);
  const mid = known.length >= 3 ? known[Math.floor(known.length / 2)] : 0;
  const out = scored.map((s) => {
    const f = fits.get(s.track.videoId)!;
    if (!f.known) return s;
    const delta = Math.max(-0.45, Math.min(0.45, f.fit - mid));
    return { ...s, score: s.score + delta, reasons: [...f.reasons, ...s.reasons] };
  });
  return out.sort((a, b) => b.score - a.score);
}
