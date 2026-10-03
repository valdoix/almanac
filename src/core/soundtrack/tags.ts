// Soundtrack (design/11 §19): listeners' tags (Last.fm) as a check on what a search found. A YouTube
// search for "film score melancholy" finds titles with the words in them; a track's tags say how
// people hear it ("sad", "epic", "chill"). Tags never add a song, only move it up or down the pick.

import type { Mood } from "./moods";
import { normName } from "./taste";

export interface Tag {
  name: string;
  /** Last.fm's weight, 0..100 (100 = the track's top tag). */
  count: number;
}

/** Tags that fit each mood, and tags that clash with it. */
export const MOOD_TAGS: Record<Mood, { fit: string[]; clash: string[] }> = {
  calm: { fit: ["calm", "chill", "chillout", "relaxing", "peaceful", "mellow", "ambient", "soft", "soothing", "easy listening"], clash: ["aggressive", "energetic", "brutal", "party", "hardcore"] },
  warm: { fit: ["feel good", "happy", "warm", "cozy", "mellow", "sunny", "chill", "summer", "upbeat"], clash: ["dark", "aggressive", "depressing", "creepy", "brutal"] },
  playful: { fit: ["fun", "upbeat", "happy", "quirky", "playful", "catchy", "feel good", "party", "cute"], clash: ["sad", "dark", "depressing", "melancholic", "brutal"] },
  tender: { fit: ["tender", "beautiful", "gentle", "soft", "love", "romantic", "intimate", "sweet", "lullaby"], clash: ["aggressive", "angry", "brutal", "party", "hardcore"] },
  romantic: { fit: ["romantic", "love", "love songs", "beautiful", "intimate", "sweet", "sensual"], clash: ["aggressive", "angry", "brutal", "creepy"] },
  sensual: { fit: ["sensual", "sexy", "seductive", "sultry", "smooth", "intimate", "slow jams", "late night", "desire"], clash: ["aggressive", "brutal", "party", "happy", "fun", "lullaby", "kids", "christmas", "funeral"] },
  erotic: { fit: ["sexy", "sex", "erotic", "sensual", "seductive", "slow jams", "bedroom", "lust", "sultry", "explicit"], clash: ["lullaby", "kids", "children", "christmas", "funeral", "requiem", "sad", "epic", "battle", "creepy", "happy", "fun"] },
  hopeful: { fit: ["hopeful", "uplifting", "inspiring", "inspirational", "optimistic", "beautiful", "feel good"], clash: ["depressing", "dark", "nihilistic", "creepy"] },
  triumphant: { fit: ["epic", "triumphant", "heroic", "powerful", "anthem", "uplifting", "victory", "orchestral"], clash: ["sad", "depressing", "sleepy", "lullaby"] },
  adventurous: { fit: ["epic", "adventure", "journey", "uplifting", "cinematic", "travel", "road trip", "wanderlust"], clash: ["depressing", "sleepy", "lullaby"] },
  mysterious: { fit: ["mysterious", "mystery", "atmospheric", "enigmatic", "dark", "noir", "moody", "ethereal"], clash: ["happy", "party", "fun", "feel good"] },
  eerie: { fit: ["eerie", "creepy", "haunting", "dark", "unsettling", "spooky", "horror", "dark ambient", "disturbing"], clash: ["happy", "party", "fun", "feel good", "upbeat", "love"] },
  tense: { fit: ["tense", "suspense", "intense", "dark", "thriller", "ominous", "driving", "cinematic"], clash: ["happy", "chill", "relaxing", "feel good", "lullaby", "party"] },
  dread: { fit: ["dark", "ominous", "dread", "doom", "menacing", "sinister", "apocalyptic", "dark ambient", "heavy"], clash: ["happy", "fun", "feel good", "party", "love", "cute"] },
  combat: { fit: ["epic", "intense", "aggressive", "battle", "energetic", "heavy", "action", "powerful", "fast"], clash: ["chill", "relaxing", "sleepy", "lullaby", "love", "mellow", "romantic"] },
  melancholy: { fit: ["melancholy", "melancholic", "sad", "wistful", "bittersweet", "nostalgic", "rainy day", "lonely", "longing"], clash: ["party", "happy", "fun", "upbeat", "aggressive"] },
  grief: { fit: ["sad", "grief", "mourning", "heartbreaking", "requiem", "depressing", "sorrow", "elegy", "melancholic", "funeral"], clash: ["party", "happy", "fun", "upbeat", "sexy", "feel good"] },
  dreamy: { fit: ["dreamy", "ethereal", "dream pop", "atmospheric", "night", "spacey", "hazy", "shoegaze", "ambient"], clash: ["aggressive", "angry", "brutal", "hardcore", "party"] },
};

/** Tags that never say anything about the sound ("seen live", "favorites", a year). */
const NOISE = /^(seen live|favou?rites?|favou?rite songs?|my favou?rites?|love at first listen|awesome|amazing|good|best|cool|beautiful voice|\d{2,4}s?|male vocalists?|female vocalists?|spotify|youtube|albums i own|under \d+ listeners)$/;

/** The track's tags, cleaned: lower case, noise out, weights kept. */
export function cleanTags(raw: unknown): Tag[] {
  if (!Array.isArray(raw)) return [];
  const out: Tag[] = [];
  for (const t of raw) {
    const name = String((t as any)?.name ?? "").toLowerCase().trim();
    const count = Number((t as any)?.count ?? 0);
    if (!name || name.length > 40 || NOISE.test(name) || !(count > 0)) continue;
    if (!out.some((o) => o.name === name)) out.push({ name, count: Math.min(100, count) });
  }
  return out.slice(0, 30);
}

const has = (tags: Tag[], words: string[]) => {
  let best = 0;
  let hit = "";
  for (const t of tags) {
    if (words.some((w) => t.name === w || t.name.split(/[\s-]+/).includes(w) || (w.includes(" ") && t.name.includes(w)))) {
      if (t.count > best) {
        best = t.count;
        hit = t.name;
      }
    }
  }
  return { w: best / 100, hit };
};

export interface TagFit {
  /** Added to the pick's score: about -0.5..+0.6. */
  delta: number;
  reasons: string[];
}

/**
 * How well a track's tags fit the mood and the genres being played. A track whose tags say "party"
 * in a grief scene goes down; one tagged "sad, piano" goes up. No tags, no change.
 */
export function tagFit(tags: Tag[], mood: Mood, genres: string[], strict = false): TagFit {
  if (!tags.length) return { delta: 0, reasons: [] };
  const { fit, clash } = MOOD_TAGS[mood];
  const f = has(tags, fit);
  const c = has(tags, clash);
  let delta = 0.45 * f.w - 0.45 * c.w;
  const reasons: string[] = [];
  if (f.hit) reasons.push(`tagged ${f.hit}`);
  if (c.hit && c.w >= 0.2) reasons.push(`but tagged ${c.hit}`);
  if (genres.length) {
    const g = genres.map(normName);
    const gw = Math.max(0, ...tags.filter((t) => g.some((x) => x === normName(t.name) || normName(t.name).includes(x))).map((t) => t.count / 100));
    if (gw > 0) {
      delta += 0.15 * gw;
    } else if (strict && tags.length >= 5) {
      // Plenty of tags and none is a chosen genre: probably the search drifted out of it.
      delta -= 0.15;
      reasons.push("not tagged with your genres");
    }
  }
  return { delta, reasons };
}

/** "Song (Official Video) [Remastered 2011] - Live" → "Song", for looking a track up. */
export function lookupTitle(title: string): string {
  return title
    .replace(/\s*[([][^)\]]*(official|video|audio|lyrics?|visuali[sz]er|remaster|hd|hq|4k|mv|m\/v|feat\.?|ft\.?|with)[^)\]]*[)\]]/gi, "")
    .replace(/\s+-\s+(\d{4}\s+)?remaster(ed)?.*$/i, "")
    .replace(/\s+(feat\.?|ft\.?)\s+.*$/i, "")
    .trim() || title;
}

/**
 * Move picks up or down by their tags and sort again. Only the tracks in `tags` change; the rest
 * keep their score. The first reason a tag gives leads, so the "why" says what the tags heard.
 */
export function retag<T extends { track: { videoId: string }; score: number; reasons: string[] }>(scored: T[], tags: Map<string, Tag[]>, mood: Mood, genres: string[], strict = false): T[] {
  const out = scored.map((s) => {
    const t = tags.get(s.track.videoId);
    if (!t) return s;
    const f = tagFit(t, mood, genres, strict);
    return { ...s, score: s.score + f.delta, reasons: [...f.reasons, ...s.reasons] };
  });
  return out.sort((a, b) => b.score - a.score);
}
