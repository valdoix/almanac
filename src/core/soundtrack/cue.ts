// Soundtrack (design/11 §5): what the scene sounds like, read from filed state only. Nothing from
// Elsewhere's arcs, hidden secrets or the Director's plan goes in: music that turns ominous before
// the raid arrives gives the raid away.

import type { WorldState } from "../types";
import { absMinutes } from "../util";
import { eraOf, placeKind } from "../plate";
import { tierGuess } from "../recall";
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
  /** A model's reading for this scene (design §5.4), already validated. */
  hint?: (SceneMark & { mood: Mood; colour: string[] }) | null;
}

const FIGHT = /\b(attacks?|attacked|strikes?|struck|stabs?|stabbed|shoots?|shot|slash(?:es|ed)?|punch(?:es|ed)?|swings? (?:at|his|her|the)|lunges?|parr(?:y|ies|ied)|gunfire|blades? (?:clash|meet)|fight(?:s|ing)? (?:back|breaks out)|draws? (?:a |his |her |my )?(?:sword|gun|knife|blade|pistol)|opens? fire|charges? at)\b/i;
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

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
  const recent = `${inp.playerMsg ?? ""}\n${inp.reply ?? ""}`;
  const fight = FIGHT.test(recent);
  // A death is what the reply filed, never a word in the prose: stories talk about their dead all the time.
  const death = (state.milestones ?? []).some((m) => m.kind === "death" && m.msgIndex === state.lastReply);

  if (mode === "social" && has("comedy")) mood = "playful";
  if (mode === "intimacy" && has("romance", "erotic")) mood = "romantic";
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
    if ((wx === "rain" || wx === "fog") && (mood === "calm" || mood === "warm")) mood = "melancholy";
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
  const now = state.time ? absMinutes(state.time) : null;
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
  const here: SceneMark = { place: placeKey(state.place ?? []), at: now };
  if (death || (inp.grief && sameScene(inp.grief, here))) {
    mood = "grief";
    why.push("loss");
  }

  // A model's reading for this scene overrides the label, not the danger: it can't calm a fight.
  if (inp.hint && sameScene(inp.hint, here) && isMood(inp.hint.mood) && mood !== "grief" && mood !== "combat") {
    mood = inp.hint.mood;
    for (const c of inp.hint.colour) if (c && !colour.includes(c)) colour.unshift(c);
    why.push("director");
  }

  // Blend the numbers toward the label, so the meter and distances agree with the name.
  const [e, v, t, i] = MOOD_VEC[mood];
  energy = clamp((energy + e) / 2);
  valence = clamp((valence + v) / 2, -1, 1);
  tension = clamp((tension + t) / 2);
  intimacy = clamp((intimacy + i) / 2);

  const tier = inp.playerMsg ? tierGuess(inp.playerMsg, state) : "routine";
  const sharp = death || (fight && (mode === "conflict" || mode === "crisis")) || (tier === "pivotal" && tension >= 0.7);
  return { mood, energy, valence, tension, intimacy, colour: colour.slice(0, 3), sharp, death, sceneNo, place: here.place, at: here.at, why: `${mood} · ${why.join(" · ")}` };
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
