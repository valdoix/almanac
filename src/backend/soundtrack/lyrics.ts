// Soundtrack (design/11 §23): a song's lyrics, read into what the song is about. They come from
// LRCLIB (lrclib.net: free, no key, the lyrics Pear Desktop's own lyrics plugin shows). Only the
// theme profile is kept, never the words. Profiles are cached for half a year, a song with no
// lyrics found for two weeks; a failed lookup is never cached (the next pick asks again).

import { LEXICON, profileLyrics, type LyricProfile } from "../../core/soundtrack/lyrics";
import { lookupTitle } from "../../core/soundtrack/tags";
import { normName, type Track } from "../../core/soundtrack/taste";
import { describe, host, warn } from "../host";

const FILE = "soundtrack/lyrics.json";
const TTL_FOUND = 180 * 24 * 3600_000;
const TTL_MISS = 14 * 24 * 3600_000;
const MAX = 5000;
const API = "https://lrclib.net/api";

interface Entry {
  at: number;
  /** The lexicon the profile was read with: a newer one reads the song again. */
  v: number;
  /** Lyrics found, none found, or an instrumental. */
  st: "ok" | "none" | "inst";
  p?: LyricProfile;
}

const caches = new Map<string, Record<string, Entry>>();
const loading = new Map<string, Promise<Record<string, Entry>>>();

async function cache(userId: string): Promise<Record<string, Entry>> {
  const hit = caches.get(userId);
  if (hit) return hit;
  const inflight = loading.get(userId);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const exists = await host.userStorage.exists(FILE, userId || undefined);
      const c = exists ? ((await host.userStorage.getJson<Record<string, Entry>>(FILE, { fallback: {}, userId: userId || undefined })) ?? {}) : {};
      caches.set(userId, c);
      return c;
    } finally {
      loading.delete(userId);
    }
  })();
  loading.set(userId, p);
  return p;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(userId: string) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const c = caches.get(userId);
    if (!c) return;
    const keys = Object.keys(c).filter((k) => fresh(c[k])).sort((a, b) => c[b].at - c[a].at).slice(0, MAX);
    const kept: Record<string, Entry> = {};
    for (const k of keys) kept[k] = c[k];
    caches.set(userId, kept);
    host.userStorage.setJson(FILE, kept, { userId: userId || undefined }).catch((err) => warn(`soundtrack lyrics save: ${describe(err)}`));
  }, 1500);
}

const fresh = (e: Entry | undefined): e is Entry => !!e && e.v === LEXICON && Date.now() - e.at < (e.st === "none" ? TTL_MISS : TTL_FOUND);

async function get(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const res: any = await host.cors(`${API}/${path}?${qs}`, { method: "GET", headers: { "User-Agent": "ALMANAC-Lumiverse/1.0 (https://github.com/valdoix/almanac)" } } as any);
  const status = Number(res?.status ?? 0);
  if (status === 404) return null;
  if (status >= 400) throw new Error(`LRCLIB answered ${status}`);
  return typeof res?.body === "string" ? JSON.parse(res.body) : res?.body;
}

/** "Is It Over Now? (Taylor's Version) [From The Vault]" → "is it over now", for comparing titles. */
const bare = (title: string) => normName(title.replace(/\s*[([][^)\]]*[)\]]/g, " ").replace(/\s+-\s+.*$/, ""));

/** The artist as LRCLIB knows them: the first credit, without YouTube's channel dressing. */
const artistOf = (t: Pick<Track, "artists">) => (t.artists[0]?.name ?? "").replace(/\s*-\s*topic\s*$/i, "").replace(/vevo$/i, "").trim();

interface Hit {
  trackName?: string;
  artistName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
}

/** The search result that is this song: the same title by the same artist, the closest length first. */
function bestHit(hits: Hit[], t: Pick<Track, "title" | "artists" | "durationS">): Hit | null {
  const title = bare(t.title);
  const artist = normName(artistOf(t));
  const same = hits.filter((h) => {
    const ht = bare(h.trackName ?? "");
    const ha = normName(h.artistName ?? "");
    return ht && (ht === title || ht.startsWith(title) || title.startsWith(ht)) && (!artist || ha.includes(artist) || artist.includes(ha));
  });
  const usable = same.filter((h) => h.instrumental || h.plainLyrics);
  if (!usable.length) return null;
  const off = (h: Hit) => (t.durationS && h.duration ? Math.abs(h.duration - t.durationS) : 30);
  return usable.sort((a, b) => off(a) - off(b))[0];
}

async function lookup(t: Pick<Track, "title" | "artists" | "durationS">): Promise<Entry> {
  const artist = artistOf(t);
  const title = lookupTitle(t.title);
  const now = Date.now();
  const done = (h: Hit | null): Entry | null => {
    if (!h) return null;
    if (h.instrumental) return { at: now, v: LEXICON, st: "inst" };
    if (h.plainLyrics) return { at: now, v: LEXICON, st: "ok", p: profileLyrics(h.plainLyrics) };
    return null;
  };
  if (!artist) return { at: now, v: LEXICON, st: "none" };
  if (t.durationS) {
    const exact = done(await get("get", { artist_name: artist, track_name: title, duration: String(t.durationS) }));
    if (exact) return exact;
  }
  const hits: Hit[] = (await get("search", { track_name: title, artist_name: artist })) ?? [];
  let e = done(bestHit(Array.isArray(hits) ? hits : [], t));
  // "Song (From the Film)" is often filed as "Song".
  if (!e && bare(title) !== normName(title)) {
    const more: Hit[] = (await get("search", { track_name: bare(title), artist_name: artist })) ?? [];
    e = done(bestHit(Array.isArray(more) ? more : [], t));
  }
  return e ?? { at: now, v: LEXICON, st: "none" };
}

/** A song's profile: null when it has no lyrics to read (none found, or an instrumental). */
export async function lyricsFor(userId: string, t: Pick<Track, "videoId" | "title" | "artists" | "durationS">): Promise<LyricProfile | null> {
  const c = await cache(userId);
  let e = c[t.videoId];
  if (!fresh(e)) {
    e = await lookup(t);
    c[t.videoId] = e;
    save(userId);
  }
  return e.st === "ok" ? e.p ?? null : null;
}

/**
 * Profiles for several songs at once, three at a time, within a time budget: a pick never waits
 * more than `budgetMs` on lyrics. Songs it didn't reach have no entry; a lookup still running
 * finishes in the background, so the next pick has it.
 */
export async function lyricsForMany(userId: string, tracks: Pick<Track, "videoId" | "title" | "artists" | "durationS">[], budgetMs = 6000): Promise<Map<string, LyricProfile | null>> {
  const out = new Map<string, LyricProfile | null>();
  const deadline = Date.now() + budgetMs;
  const queue = [...tracks];
  const worker = async () => {
    while (queue.length && Date.now() < deadline) {
      const t = queue.shift()!;
      try {
        out.set(t.videoId, await lyricsFor(userId, t));
      } catch (err) {
        warn(`soundtrack lyrics "${t.title}": ${describe(err)}`);
      }
    }
  };
  await Promise.race([Promise.all([worker(), worker(), worker()]), new Promise((r) => setTimeout(r, budgetMs + 200))]);
  // A copy: a lookup still in flight after the budget mustn't change the pick under it.
  return new Map(out);
}
