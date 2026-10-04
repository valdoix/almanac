// Soundtrack (design/11 §5): what the scene sounds like, read from filed state only. Nothing from
// Elsewhere's arcs, hidden secrets or the Director's plan goes in: music that turns ominous before
// the raid arrives gives the raid away.

import type { WorldState } from "../types";
import { absMinutes } from "../util";
import { eraOf, placeKind } from "../plate";
import { tierGuess } from "../recall";
import { sceneImages, sceneThemes, type SceneTheme, type Theme } from "./lyrics";
import { hourBand, isMood, MODE_BASE, MOOD_VEC, PLACE_COLOUR, type Mood } from "./moods";

export interface Cue {
  mood: Mood;
  energy: number;
  valence: number;
  tension: number;
  intimacy: number;
  /** ≤3 texture words: the hour, the weather, the place. */
  colour: string[];
  /** A sharp turn this reply: a fight starts, a death. */
  sharp: boolean;
  /** Someone died in the reply (the rest of the scene mourns). */
  death: boolean;
  /** How far an intimate scene has gone: 0 close, 1 desire (kissing, undressing), 2 sex on the page. */
  heat: 0 | 1 | 2;
  /** Explicit songs fit: sex on the page in a story whose intimacy setting is explicit (or the preset's). */
  explicit: boolean;
  /** The player chose the mood (Soundtrack page): `read` is what the scene itself reads as. */
  chosen?: boolean;
  read?: Mood;
  /** What the scene is about, for songs whose words fit it (lyrics.ts), strongest first. */
  themes?: SceneTheme[];
  /** Concrete images the scene has (rain, candle, blood) that a song's words may share. */
  images?: string[];
  /** The Ledger's scene number (display only: it turns over at every sub-place and title). */
  sceneNo: number;
  /** The room or spot the scene is in, as a key ("kitchen"), and when (absolute minutes): see sameScene. */
  place: string;
  at: number | null;
  why: string;
}

/** A moment the music remembers: a death, a model's reading. */
export interface SceneMark {
  place: string;
  at: number | null;
}

export interface CueInput {
  state: WorldState;
  /** Story genres, lead first (Session Zero). */
  genres: string[];
  tone?: string;
  /** The player's last message and the reply after it. */
  playerMsg?: string;
  reply?: string;
  /** Where and when someone died (grief holds for the rest of that scene). */
  grief?: SceneMark | null;
  /** Where and when the scene was last sex on the page: it stays that while desire does. */
  heated?: SceneMark | null;
  /** A model's reading for this scene (design §5.4), already validated. */
  hint?: (SceneMark & { mood: Mood; colour: string[]; themes?: Theme[] }) | null;
  /** Session Zero's intimacy setting: "off", "fade", "sensual", "explicit" or "" (the preset's). */
  nsfw?: string;
  /** The mood the player chose on the Soundtrack page; null or absent is Auto (the scene decides). */
  chosen?: Mood | null;
}

const FIGHT = /\b(attacks?|attacked|strikes?|struck|stabs?|stabbed|shoots?|shot|slash(?:es|ed)?|punch(?:es|ed)?|swings? (?:at|his|her|the)|lunges?|parr(?:y|ies|ied)|gunfire|blades? (?:clash|meet)|fight(?:s|ing)? (?:back|breaks out)|draws? (?:a |his |her |my )?(?:sword|gun|knife|blade|pistol)|opens? fire|charges? at)\b/i;
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

// Sex on the page, and desire short of it. Terms are counted once each, however often they come
// up, and "moan" isn't one: in the Buffy chat it's a running joke about Gabriel and soup.
const EXPLICIT: RegExp[] = [
  /\b(cock|dick|shaft|his length)\b/i, /\b(pussy|clit|clitoris|cunt)\b/i, /\b(cum|cumming|orgasm\w*|climax(?:es|ed|ing)?)\b/i,
  /\b(make|made|let) (you|her|him|me) come\b|\bcom(?:e|es|ing) (for|on|inside|apart) (me|you|him|her)\b/i, /\bthrust(s|ing|ed)?\b/i,
  /\b(erection|hard against)\b/i, /\binside (her|him|me|you)\b(?! (chest|head|ribs|mind|skull|sternum|throat|the))/i, /\bnipples?\b/i,
  /\b(breasts?|tits)\b/i, /\b(naked|nude|undress\w*|strips? (her|him|me|off)|bare (skin|chest|breasts?))\b/i,
  /\bbetween (her|his|my|your) (legs|thighs)\b/i, /\b(rid(?:es|ing) (him|her|me)|on top of (him|her))\b/i,
  /\bgrind(s|ing|ed)? (against|into|down)\b/i, /\bfuck(s|ing|ed)? (her|him|me|you)\b|\bfucks\b/i, /\b(condom|lube)\b/i,
  /\b(post-orgasm|making love|made love|make love|has sex|having sex)\b/i, /\b(hips? (buck|roll|rock|snap)\w*|buck(s|ing) (into|up))\b/i,
];
const SENSUAL: RegExp[] = [
  /\bkiss(es|ed|ing)?\b/i, /\b(tongue|open-mouthed|mouth (on|against) (his|hers?|my))\b/i,
  /\b(kiss\w*|mouth\w*|lips?) (along |down |on |against )?(her|his) (neck|throat|collarbone|jaw)\b/i, /\bstraddl\w*|\bin (his|her) lap\b/i,
  /\b(unbutton\w*|shirt off|bra|hem of)\b/i, /\b(her|his) thighs?\b/i, /\b(want(s|ing|ed)? (you|him|her)|desire|aroused|arousal|lust)\b/i,
  /\b(breath|breathing) (hitch|catch|stutter)\w*/i, /\b(caress\w*|trails? (his|her) (fingers|hand|mouth))\b/i, /\bbites? (her|his) (lip|lower lip)\b/i,
  /\b(pulls? (her|him) (closer|against|onto)|presses? (herself|himself) against)\b/i, /\bmoans? (into|against) (his|her|my) (mouth|lips|neck)\b/i,
];
// What isn't the page: the ledger, the model's plans and thoughts, out-of-character asides.
const OFF_PAGE = /<(ledger|unspoken|plan|think|thinking|ooc|folio)\b[^>]*>[\s\S]*?(<\/\1>|$)/gi;
const termsIn = (text: string, terms: RegExp[]) => terms.filter((t) => t.test(text)).length;

/** What the people present feel, from the moods filed in the last two replies ("guilt-grief", "giddy-tender"). */
type Feeling = "fear" | "anger" | "sad" | "desire" | "joy" | "warm";
const FEELING_WORDS: [Feeling, RegExp][] = [
  ["fear", /^(terrif\w*|terror|afraid|scared|fear\w*|panic\w*|dread|trapped|horror|horrified|frighten\w*|alarmed|anxious)$/],
  ["anger", /^(fury|furious|rage|raging|angry|anger|livid|seething|hostile|wrath\w*)$/],
  ["sad", /^(grief|griev\w*|sorrow\w*|crying|tears|devastat\w*|heartbroken|hollow|guilt\w*|mourning|shattered|despair\w*|sad|loss|bereft|desolate)$/],
  ["desire", /^(want|wanting|wanton|burning|aroused|desire|desirous|lust\w*|heated|needy|yearning)$/],
  ["joy", /^(giddy|glee\w*|delight\w*|elated|triumphant|playful|smug|laughing|amused|vindicated|bliss\w*|joyful|euphoric)$/],
  ["warm", /^(tender|warm|soft|settled|content|safe|fond|adored|grateful|relief|relieved|sated|peaceful|cozy)$/],
];

function feelings(state: WorldState): { top: Feeling | null; score: number; v: number | null; a: number | null } {
  const last = state.lastReply ?? -1;
  const fresh = Object.values(state.chars ?? {}).filter((c) => (c.tier === "spot" || c.tier === "peri") && !c.dead && c.mood?.name && c.mood.msg != null && c.mood.msg >= last - 2);
  const score: Partial<Record<Feeling, number>> = {};
  const vs: number[] = [];
  const as: number[] = [];
  for (const c of fresh) {
    // The first word leads: "warm-and-terrified" is warm with fear under it.
    const words = c.mood!.name.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    words.forEach((w, i) => {
      const f = FEELING_WORDS.find(([, re]) => re.test(w))?.[0];
      if (f) score[f] = (score[f] ?? 0) + (i === 0 ? 1 : 0.4);
    });
    if (typeof c.mood!.v === "number") vs.push(c.mood!.v);
    if (typeof c.mood!.a === "number") as.push(c.mood!.a);
  }
  // Ties go to the stronger feeling (the order of FEELING_WORDS).
  let top: Feeling | null = null;
  for (const [f] of FEELING_WORDS) if ((score[f] ?? 0) > (top ? score[top] ?? 0 : 0)) top = f;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return { top, score: top ? score[top] ?? 0 : 0, v: avg(vs), a: avg(as) };
}

function weatherWord(cond: string): "storm" | "rain" | "snow" | "fog" | "" {
  const c = cond.toLowerCase();
  if (/thunder|storm|gale|blizzard|hurricane|tempest/.test(c)) return "storm";
  if (/snow|sleet|flurr/.test(c)) return "snow";
  if (/rain|drizzle|shower|downpour/.test(c)) return "rain";
  if (/fog|mist|haze/.test(c)) return "fog";
  return "";
}

export function readCue(inp: CueInput): Cue {
  const { state } = inp;
  const genres = inp.genres ?? [];
  const has = (...g: string[]) => g.some((x) => genres.includes(x));
  const mode = MODE_BASE[state.mode] ? state.mode : "social";
  const base = MODE_BASE[mode];
  let { mood } = base;
  let { energy, valence, tension, intimacy } = base;
  const why: string[] = [mode];
  const recent = `${inp.playerMsg ?? ""}\n${inp.reply ?? ""}`.replace(OFF_PAGE, " ");
  const fight = FIGHT.test(recent);
  // A death is what the reply filed, never a word in the prose: stories talk about their dead all the time.
  const death = (state.milestones ?? []).some((m) => m.kind === "death" && m.msgIndex === state.lastReply);

  if (mode === "social" && has("comedy")) mood = "playful";
  if (mode === "intimacy" && has("romance", "erotic")) mood = "romantic";

  // How far an intimate scene has gone. Sex filed under another mode still counts when the page
  // is unmistakable; a story with intimacy off or fading to black gets desire at most.
  const feel = feelings(state);
  const x = termsIn(recent, EXPLICIT);
  const sx = termsIn(recent, SENSUAL);
  let heat: 0 | 1 | 2 = 0;
  const quiet = mode === "conflict" || mode === "crisis" || mode === "investigation" || mode === "stealth";
  if (mode === "intimacy") {
    if (x >= 3 || (x >= 2 && feel.top === "desire")) heat = 2;
    else if (x >= 1 || sx >= 3 || feel.top === "desire") heat = 1;
  } else if (!quiet && x >= 4) heat = 2;
  // A breath between rounds, a word about condoms: the same scene, still that scene's music.
  const now = state.time ? absMinutes(state.time) : null;
  const here: SceneMark = { place: placeKey(state.place ?? []), at: now };
  if (heat === 1 && mode === "intimacy" && inp.heated && sameScene(inp.heated, here)) heat = 2;
  const nsfw = (inp.nsfw ?? "").toLowerCase();
  if (heat === 2 && (nsfw === "off" || nsfw === "fade")) heat = 1;
  if (heat === 2) {
    mood = "erotic";
    intimacy = 1;
    energy = Math.max(energy, 0.5);
    why.push("sex");
  } else if (heat === 1 && mode === "intimacy") {
    mood = "sensual";
    why.push("desire");
  }

  // What the people present feel moves a scene its mode only names: guilt and grief at the
  // breakfast table, terror in the living room, everyone giddy on a rainy afternoon.
  const plain = mood === "calm" || mood === "warm" || mood === "playful" || mood === "dreamy" || mood === "adventurous";
  // Fear and anger need more than one flustered word: "defensive-panicked" over a kind gesture is no thriller.
  if (feel.top && mode !== "intimacy") {
    if (feel.top === "sad" && feel.score >= 1 && plain) mood = "melancholy";
    else if ((feel.top === "fear" || feel.top === "anger") && feel.score >= 1.4 && (plain || mood === "mysterious") && mode !== "travel") mood = "tense";
    if (feel.top !== "warm" && feel.top !== "desire") why.push(feel.top);
  }
  if (feel.v != null) valence += clamp(feel.v / 3, -1, 1) * 0.2;
  if (feel.a != null) energy += (clamp(feel.a / 5) - 0.4) * 0.2;
  if ((mode === "conflict" || mode === "crisis") && fight) {
    mood = "combat";
    energy = Math.max(energy, 0.9);
    why.push("fight");
  }
  if (mode === "travel" && has("horror")) mood = "mysterious";

  // The hour.
  const band = state.time ? hourBand(state.time.minute) : "day";
  const colour: string[] = [];
  if (band === "night" || band === "late") {
    energy -= 0.15;
    colour.push("night");
    why.push("night");
    if (mood === "calm") mood = has("horror") ? "eerie" : "dreamy";
    if (has("horror") && (mood === "warm" || mood === "mysterious")) mood = "eerie";
  } else if (band === "dawn" || band === "dusk") {
    colour.push(band);
    why.push(band);
  }

  // The weather.
  const wx = weatherWord(state.weather?.condition ?? "");
  if (wx) {
    colour.push(wx);
    why.push(wx);
    if (wx === "storm") tension += 0.15;
    if ((wx === "rain" || wx === "fog") && (mood === "calm" || mood === "warm") && feel.top !== "joy" && feel.top !== "warm") mood = "melancholy";
    if (wx === "snow" && mood === "calm") mood = "dreamy";
  }

  // The place.
  const path = (state.place ?? []).join(" › ");
  if (path) {
    const kind = placeKind(path, eraOf("", genres[0] ?? ""));
    const word = PLACE_COLOUR[kind];
    if (word && !colour.includes(word)) colour.push(word);
  }

  // Pressure: a deadline due within two hours, or someone present is hurt.
  if (now != null && Object.values(state.deadlines ?? {}).some((d) => !d.done && d.at && absMinutes(d.at) - now >= 0 && absMinutes(d.at) - now <= 120)) {
    tension += 0.15;
    why.push("deadline");
  }
  const present = Object.values(state.chars ?? {}).filter((c) => c.tier === "spot" || c.tier === "peri");
  if (present.some((c) => !c.dead && (c.injuries ?? []).some((i) => !i.treated && i.severity >= 2))) tension += 0.1;

  // The story's tone and genre.
  if (inp.tone === "melancholy" || has("tragedy")) valence -= 0.2;
  if (inp.tone === "tense") tension += 0.1;
  if (inp.tone === "warm") valence += 0.1;
  if (has("cozy")) tension = Math.min(tension, 0.4);
  if (has("cozy") && (mood === "dread" || mood === "eerie")) mood = "tense";

  // Grief holds for the rest of the scene.
  const sceneNo = state.sceneNo ?? 0;
  if (death || (inp.grief && sameScene(inp.grief, here))) {
    mood = "grief";
    why.push("loss");
  }

  // A model's reading for this scene overrides the label, not the danger: it can't calm a fight.
  // It's read once a scene, so it can't hold back a scene that has since turned to sex either.
  const hintHere = !!inp.hint && sameScene(inp.hint, here);
  if (inp.hint && hintHere && isMood(inp.hint.mood) && mood !== "grief" && mood !== "combat" && mood !== "erotic" && !(mood === "sensual" && inp.hint.mood !== "erotic")) {
    mood = inp.hint.mood;
    for (const c of inp.hint.colour) if (c && !colour.includes(c)) colour.unshift(c);
    why.push("director");
  }

  // The player's choice beats everything, a fight and a death included: it's their music.
  const read = mood;
  const chosen = inp.chosen && isMood(inp.chosen) ? inp.chosen : null;
  if (chosen) mood = chosen;

  // Blend the numbers toward the label, so the meter and distances agree with the name
  // (mostly the label's, when the player chose it: the scene only shades it).
  const [e, v, t, i] = MOOD_VEC[mood];
  const w = chosen ? 0.8 : 0.5;
  energy = clamp(energy * (1 - w) + e * w);
  valence = clamp(valence * (1 - w) + v * w, -1, 1);
  tension = clamp(tension * (1 - w) + t * w);
  intimacy = clamp(intimacy * (1 - w) + i * w);

  const tier = inp.playerMsg ? tierGuess(inp.playerMsg, state) : "routine";
  // Sex starting is a turn: the music shouldn't wait out the song that played over the talking.
  const sharp = death || (fight && (mode === "conflict" || mode === "crisis")) || (tier === "pivotal" && tension >= 0.7) || mood === "erotic";
  const explicit = mood === "erotic" && (nsfw === "" || nsfw === "explicit");
  // What the scene is about, for the lyrics: the mood's own themes, the last exchange's, what the
  // people present feel, and the model's reading of this scene.
  const themes = sceneThemes({ mood, text: recent, feeling: feel, hint: hintHere ? inp.hint!.themes : undefined });
  const images = sceneImages(recent, colour);
  if (chosen) {
    return {
      mood, energy, valence, tension, intimacy, colour: colour.slice(0, 3), sharp: false, death, heat, explicit, chosen: true, read, themes, images, sceneNo, place: here.place, at: here.at,
      why: `${mood} · chosen by you${read !== mood ? ` (the scene reads ${read})` : ""}`,
    };
  }
  return { mood, energy, valence, tension, intimacy, colour: colour.slice(0, 3), sharp, death, heat, explicit, themes, images, sceneNo, place: here.place, at: here.at, why: `${mood} · ${why.join(" · ")}` };
}

/** How far apart two cues are: the four numbers, plus .3 when the mood's name changed. */
export function cueDistance(a: Cue | null | undefined, b: Cue | null | undefined): number {
  if (!a || !b) return 1;
  const d = Math.hypot(a.energy - b.energy, (a.valence - b.valence) / 2, a.tension - b.tension, a.intimacy - b.intimacy);
  return d + (a.mood === b.mood ? 0 : 0.3);
}

/**
 * The spot a scene is in, as a key: the innermost place, without who is where ("guest room
 * (Buffy) · hallway (Dawn)"), where it's headed ("living room → hallway" is the hallway) or the
 * building around it ("kitchen, in Winters Residence").
 */
export function placeKey(place: string[]): string {
  let p = place[place.length - 1] ?? "";
  p = p.split(/\s+·\s+/)[0].replace(/\([^)]*\)/g, " ");
  const legs = p.split(/\s*(?:→|->)\s*/).filter((x) => x.trim());
  p = (legs[legs.length - 1] ?? p).split(",")[0];
  return p.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/^(?:the|a|an) /, "");
}

/**
 * One scene for the music: the same spot, within an hour and a half. Looser than the Ledger's
 * scenes, which turn over at every new title and sub-place.
 */
export function sameScene(a: SceneMark | null | undefined, b: SceneMark | null | undefined): boolean {
  if (!a || !b || a.place !== b.place) return false;
  return a.at == null || b.at == null || Math.abs(b.at - a.at) < 90;
}
