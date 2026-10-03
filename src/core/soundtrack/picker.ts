// Soundtrack (design/11 §7–8): the searches a cue makes, and the pick among what they found.

import { rng } from "../util";
import type { Cue } from "./cue";
import { MOOD_GENRES, MOOD_WORDS, suggestGenres } from "./moods";
import { ratingBonus, type Learned, type Rating } from "./ratings";
import { MOOD_TAGS } from "./tags";
import { banReason, creditsOf, normName, preferredOf, type Taste, type Track } from "./taste";

export interface Query {
  /** What is sent to the search. */
  q: string;
  /** The pool key it fills (mood + genre + colour, or an artist). */
  key: string;
  genre: string;
  /** 0: the lead genre; higher: further down the taste. */
  rank: number;
  artist?: string;
}

/** The genres a chat plays: the taste's, or (blend, or none chosen) filled from the story's genres. */
export function genresFor(taste: Taste, storyGenres: string[]): string[] {
  const own = taste.genres.slice(0, 8);
  if (taste.genreMode === "strict" && own.length) return own;
  const fill = suggestGenres(storyGenres).filter((g) => !own.some((o) => normName(o) === normName(g)));
  return own.length ? [...own, ...fill.slice(0, 2)] : fill;
}

/**
 * The searches for a cue: up to three genres (rotated by scene, the lead one always) × the mood word,
 * with one colour word, plus preferred artists with the mood word.
 */
export function queriesFor(cue: Cue, taste: Taste, storyGenres: string[], salt = 0): Query[] {
  const genres = genresFor(taste, storyGenres);
  const words = MOOD_WORDS[cue.mood];
  const word = words[(cue.sceneNo + salt) % words.length];
  const inst = taste.vocals === "instrumental" ? " instrumental" : "";
  const out: Query[] = [];
  const pickGenres = genres.length <= 3 ? genres : [genres[0], ...rotate(genres.slice(1), cue.sceneNo + salt).slice(0, 2)];
  pickGenres.forEach((g, i) => {
    const colour = i === 0 ? "" : cue.colour[(i - 1) % Math.max(1, cue.colour.length)] ?? "";
    const q = [g, word, colour].filter(Boolean).join(" ") + inst;
    out.push({ q, key: `m:${q.toLowerCase()}`, genre: g, rank: genres.indexOf(g) });
  });
  // A mood with music of its own (a sex scene: R&B, slow jams) is searched in it too, as if it led
  // the taste, unless the taste is strict or already plays it.
  const own = MOOD_GENRES[cue.mood] ?? [];
  if (own.length && !(taste.genreMode === "strict" && taste.genres.length) && !pickGenres.some((g) => own.some((o) => normName(o) === normName(g)))) {
    const g = rotate(own, cue.sceneNo + salt)[0];
    const q = `${g} ${word}${inst}`;
    out.push({ q, key: `m:${q.toLowerCase()}`, genre: g, rank: 0 });
  }
  if (!out.length) out.push({ q: `${word} music${inst}`, key: `m:${word} music${inst}`, genre: "", rank: 9 });
  const prefCount = taste.variety === "focused" ? 3 : taste.variety === "balanced" ? 2 : 1;
  for (const a of rotate(taste.preferred, cue.sceneNo + salt).slice(0, prefCount)) {
    const q = `${a.name} ${words[0]}`;
    out.push({ q, key: `a:${(a.id ?? normName(a.name))}:${words[0]}`, genre: "", rank: 0, artist: a.name });
  }
  return out;
}

function rotate<T>(xs: T[], n: number): T[] {
  if (!xs.length) return xs;
  const k = ((n % xs.length) + xs.length) % xs.length;
  return [...xs.slice(k), ...xs.slice(0, k)];
}

export interface Candidate {
  track: Track;
  /** The query that found it, and its position in those results. */
  query: Query;
  pos: number;
}

export interface History {
  /** videoIds played in this chat, newest last. */
  chat: string[];
  /** videoId → when it last played anywhere (ms). */
  recent: Record<string, number>;
  /** The artist (normalised) of the last track. */
  lastArtist?: string;
  /** Skip penalties: `mood|videoId` and `mood|artist` → count. */
  skips: Record<string, number>;
  /** Tracks the player said never to play again. */
  never: string[];
  /** The player's thumbs: whether a song fitted the mood it played for (see ratings.ts). */
  rated?: Rating[];
}

export interface Scored {
  track: Track;
  score: number;
  reasons: string[];
  query: Query;
}

export interface PickOptions {
  now: number;
  seed: string;
  /** Whether the scene is mostly dialogue (quiet-in-dialogue asks for instrumentals then). */
  dialogue?: boolean;
  /** Liked tracks (from the player). */
  liked?: Set<string>;
  /** What the player's thumbs taught about this cue's mood. */
  learned?: Learned;
}

const TWO_HOURS = 2 * 3600_000;

/** Hard filters (design §8): returns why a track is out, or null. */
export function excluded(t: Track, taste: Taste, h: History, now: number): string | null {
  const ban = banReason(t, taste);
  if (ban) return ban;
  if (h.never.includes(t.videoId)) return "never this song";
  if (!taste.explicit && t.explicit) return "explicit";
  if (!taste.videos && t.kind === "video") return "music video";
  if (t.durationS && (t.durationS < 90 || t.durationS > 480)) return "length";
  if (h.chat.slice(-25).includes(t.videoId)) return "played lately in this chat";
  const last = h.recent[t.videoId];
  if (last && now - last < TWO_HOURS) return "played in the last two hours";
  if (taste.variety !== "focused" && h.lastArtist && creditsOf(t).some((a) => normName(a.name) === h.lastArtist)) return "same artist as the last song";
  return null;
}

const INSTRUMENTAL = /\b(instrumental|ost|score|theme|ambient|piano|orchestral|soundtrack|suite)\b/i;

/** A title that says the mood ("Sultry", "Requiem") or says against it ("Lullaby" in a sex scene). */
export function titleFit(title: string, mood: Cue["mood"]): { delta: number; reason?: string } {
  const t = ` ${title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  const { fit, clash } = MOOD_TAGS[mood];
  const c = clash.find((w) => t.includes(` ${w} `));
  if (c) return { delta: -0.3, reason: `title says ${c}` };
  const f = fit.find((w) => w.length > 3 && t.includes(` ${w} `));
  return f ? { delta: 0.1, reason: `title says ${f}` } : { delta: 0 };
}

/** Score what survived the filters, best first. */
export function scoreAll(cands: Candidate[], cue: Cue, taste: Taste, h: History, o: PickOptions): Scored[] {
  const byId = new Map<string, Scored>();
  for (const c of cands) {
    const t = c.track;
    if (excluded(t, taste, h, o.now) || o.learned?.out.has(t.videoId)) continue;
    const reasons: string[] = [];
    let s = Math.max(0, 1 - c.pos / 20); // search rank carries the mood
    if (c.query.rank === 0 && c.query.genre) {
      s += 0.3;
      reasons.push(`lead genre ${c.query.genre}`);
    } else if (c.query.genre && c.query.rank < 9) s += 0.15;
    const pref = preferredOf(t, taste);
    if (pref) {
      s += taste.variety === "focused" ? 0.5 : taste.variety === "balanced" ? 0.25 : 0.1;
      reasons.push(`preferred ${pref.name}`);
    }
    if (o.liked?.has(t.videoId)) {
      s += 0.15;
      reasons.push("liked");
    }
    const skipT = h.skips[`${cue.mood}|${t.videoId}`] ?? 0;
    const skipA = Math.max(0, ...creditsOf(t).map((a) => h.skips[`${cue.mood}|${normName(a.name)}`] ?? 0));
    if (skipT) s -= 0.4 * skipT;
    if (skipA) s -= 0.2 * skipA;
    if (taste.vocals === "quiet-in-dialogue" && o.dialogue) s += INSTRUMENTAL.test(`${t.title} ${t.album ?? ""}`) ? 0.2 : -0.1;
    if (t.kind === "song") s += 0.05;
    const tf = titleFit(t.title, cue.mood);
    s += tf.delta;
    if (tf.reason) reasons.push(tf.reason);
    const rb = ratingBonus(o.learned, t, c.query.genre, c.query.key);
    s += rb.delta;
    reasons.push(...rb.reasons);
    // Sex on the page in an explicit story: songs that say it out loud come first.
    if (cue.explicit && t.explicit) {
      s += 0.2;
      reasons.push("explicit");
    }
    const prev = byId.get(t.videoId);
    // Found by two searches: it fits twice.
    if (prev) {
      prev.score = Math.max(prev.score, s) + 0.1;
      continue;
    }
    byId.set(t.videoId, { track: t, score: s, reasons, query: c.query });
  }
  return [...byId.values()].sort((a, b) => b.score - a.score);
}

/**
 * A weighted draw among the best five, seeded: a regenerate or rebuild that keeps the same cue
 * gets the same song; another scene gets another draw.
 */
export function draw(scored: Scored[], seed: string): Scored | null {
  const top = scored.slice(0, 5);
  if (!top.length) return null;
  const min = Math.min(...top.map((x) => x.score));
  const w = top.map((x) => x.score - min + 0.25);
  const total = w.reduce((a, b) => a + b, 0);
  let r = rng(seed)() * total;
  for (let i = 0; i < top.length; i++) {
    r -= w[i];
    if (r <= 0) return top[i];
  }
  return top[top.length - 1];
}

export function emptyHistory(): History {
  return { chat: [], recent: {}, skips: {}, never: [] };
}
