// Soundtrack (design/11 §22): the player's thumbs. A rating says whether a song fits the mood it
// played for. What's learned from them is derived each pick from the ratings themselves, so
// changing a vote or taking it back undoes exactly what it taught.
//
// What a rating teaches, for that mood (and at half weight for moods close to it):
//  - the song: up brings it back (it joins the candidates even when no search finds it); down
//    keeps it out of that mood for good;
//  - its artists, the genre it was found under and the search that found it: up rises, down sinks.

import { MOOD_VEC, isMood, type Mood } from "./moods";
import { creditsOf, normName, type Track } from "./taste";

export interface Rating {
  /** The song (enough of it to be a candidate again). */
  track: Track;
  /** The mood it played for. */
  mood: Mood;
  /** The genre and search that found it ("" when the player or autoplay started it). */
  genre: string;
  qkey: string;
  vote: 1 | -1;
  at: number;
}

const MAX = 600;

/** Add a rating: the same vote again takes it back, the other vote replaces it. */
export function rate(list: Rating[], r: Rating): Rating[] {
  const same = list.find((x) => x.track.videoId === r.track.videoId && x.mood === r.mood);
  const rest = list.filter((x) => x !== same);
  if (same && same.vote === r.vote) return rest;
  return [...rest, r].slice(-MAX);
}

/** The vote a song has for a mood (0 when none). */
export function voteOf(list: Rating[], videoId: string, mood: string): 1 | -1 | 0 {
  return list.find((x) => x.track.videoId === videoId && x.mood === mood)?.vote ?? 0;
}

/** How much a rating for mood `a` says about mood `b`: 1 the same, .5 close by, 0 otherwise. */
export function moodNear(a: Mood, b: Mood): number {
  if (a === b) return 1;
  const [e1, v1, t1, i1] = MOOD_VEC[a];
  const [e2, v2, t2, i2] = MOOD_VEC[b];
  return Math.hypot(e1 - e2, (v1 - v2) / 2, t1 - t2, i1 - i2) < 0.3 ? 0.5 : 0;
}

export interface Learned {
  mood: Mood;
  /** videoId → weighted votes (down counts more than up: a wrong song hurts more than a right one helps). */
  track: Map<string, number>;
  /** Songs voted down for this very mood: never for it again. */
  out: Set<string>;
  artist: Map<string, number>;
  genre: Map<string, number>;
  query: Map<string, number>;
}

const add = (m: Map<string, number>, k: string, x: number) => k && m.set(k, (m.get(k) ?? 0) + x);

/** What the ratings say about one mood. */
export function learnedFor(list: Rating[], mood: Mood): Learned {
  const L: Learned = { mood, track: new Map(), out: new Set(), artist: new Map(), genre: new Map(), query: new Map() };
  for (const r of list) {
    if (!isMood(r.mood)) continue;
    const w = moodNear(r.mood, mood);
    if (!w) continue;
    // A song wrong for a nearby mood may still be right for this one: down votes carry less sideways.
    const x = r.vote > 0 ? w : w === 1 ? -1 : -0.25;
    if (r.vote < 0 && w === 1) L.out.add(r.track.videoId);
    add(L.track, r.track.videoId, x);
    for (const a of creditsOf(r.track)) add(L.artist, normName(a.name), x);
    add(L.genre, r.genre, x);
    if (w === 1) add(L.query, r.qkey, x);
  }
  return L;
}

const cap = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** The score a track's ratings add for the mood, and the reason to show. */
export function ratingBonus(L: Learned | undefined, t: Track, genre: string, qkey: string): { delta: number; reasons: string[] } {
  if (!L) return { delta: 0, reasons: [] };
  const reasons: string[] = [];
  let delta = 0;
  const tv = L.track.get(t.videoId) ?? 0;
  if (tv) {
    delta += cap(tv * 0.6, -1.2, 1);
    reasons.push(tv > 0 ? `you rated it up for ${L.mood}` : `you rated it down near ${L.mood}`);
  }
  // The credited artist the ratings say most about, either way.
  const av = creditsOf(t).map((a) => L.artist.get(normName(a.name)) ?? 0).reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0);
  if (av && !tv) {
    delta += cap(av * 0.25, -0.75, 0.6);
    reasons.push(av > 0 ? `you like this artist for ${L.mood}` : `this artist missed for ${L.mood}`);
  }
  const gv = genre ? L.genre.get(genre) ?? 0 : 0;
  if (gv) {
    delta += cap(gv * 0.06, -0.3, 0.3);
    if (Math.abs(gv) >= 2) reasons.push(gv > 0 ? `${genre} works for ${L.mood}` : `${genre} misses for ${L.mood}`);
  }
  const qv = qkey ? L.query.get(qkey) ?? 0 : 0;
  if (qv) delta += cap(qv * 0.08, -0.3, 0.3);
  return { delta, reasons };
}

/** Songs rated up for the mood (or close to it), best first: candidates whatever the searches find. */
export function ratedPool(list: Rating[], mood: Mood, max = 12): Track[] {
  const L = learnedFor(list, mood);
  const seen = new Map<string, Track>();
  for (const r of list) if (r.vote > 0) seen.set(r.track.videoId, r.track);
  return [...seen.values()]
    .filter((t) => (L.track.get(t.videoId) ?? 0) > 0)
    .sort((a, b) => (L.track.get(b.videoId) ?? 0) - (L.track.get(a.videoId) ?? 0))
    .slice(0, max);
}

/** A summary for the page: per mood, how many up and down. */
export function ratingSummary(list: Rating[]): { mood: Mood; up: number; down: number }[] {
  const by = new Map<Mood, { mood: Mood; up: number; down: number }>();
  for (const r of list) {
    const x = by.get(r.mood) ?? { mood: r.mood, up: 0, down: 0 };
    if (r.vote > 0) x.up++;
    else x.down++;
    by.set(r.mood, x);
  }
  return [...by.values()].sort((a, b) => b.up + b.down - (a.up + a.down));
}
