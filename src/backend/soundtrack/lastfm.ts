// Soundtrack: Last.fm's listener tags for a track (or its artist, when the track has none). Optional:
// it needs the player's own free API key, kept in the vault. Answers are cached for a month; a
// failure is never cached (the next pick asks again), and a bad key turns the lookups off until
// a new key is saved.

import { cleanTags, lookupTitle, type Tag } from "../../core/soundtrack/tags";
import type { Track } from "../../core/soundtrack/taste";
import { describe, host, warn } from "../host";

const TAGS = "soundtrack/tags.json";
const TTL = 30 * 24 * 3600_000;
const MAX = 4000;
export const LASTFM_KEY = "soundtrack_lastfm_key";
const API = "https://ws.audioscrobbler.com/2.0/";

interface Entry {
  at: number;
  tags: Tag[];
}

const caches = new Map<string, Record<string, Entry>>();
const loading = new Map<string, Promise<Record<string, Entry>>>();
/** Last.fm allows about five calls a second per key; stay under it. */
const calls = new Map<string, number[]>();
/** A key Last.fm refused, by user: no lookups until a new one is saved. */
export const badKey = new Map<string, string>();

async function cache(userId: string): Promise<Record<string, Entry>> {
  const hit = caches.get(userId);
  if (hit) return hit;
  const inflight = loading.get(userId);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const exists = await host.userStorage.exists(TAGS, userId || undefined);
      const c = exists ? ((await host.userStorage.getJson<Record<string, Entry>>(TAGS, { fallback: {}, userId: userId || undefined })) ?? {}) : {};
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
    const now = Date.now();
    const keys = Object.keys(c).filter((k) => now - c[k].at < TTL).sort((a, b) => c[b].at - c[a].at).slice(0, MAX);
    const kept: Record<string, Entry> = {};
    for (const k of keys) kept[k] = c[k];
    caches.set(userId, kept);
    host.userStorage.setJson(TAGS, kept, { userId: userId || undefined }).catch((err) => warn(`soundtrack tags save: ${describe(err)}`));
  }, 1500);
}

export class LastfmError extends Error {
  constructor(message: string, readonly badKey = false) {
    super(message);
  }
}

async function call(userId: string, key: string, params: Record<string, string>): Promise<any> {
  const now = Date.now();
  const recent = (calls.get(userId) ?? []).filter((t) => now - t < 1000);
  if (recent.length >= 4) await new Promise((r) => setTimeout(r, 1000 - (now - recent[0]) + 20));
  calls.set(userId, [...recent, Date.now()].slice(-8));
  const qs = new URLSearchParams({ ...params, api_key: key, format: "json", autocorrect: "1" }).toString();
  const res: any = await host.cors(`${API}?${qs}`, { method: "GET", headers: { "User-Agent": "ALMANAC-Lumiverse/1.0" } } as any);
  const status = Number(res?.status ?? 0);
  let body: any;
  try {
    body = typeof res?.body === "string" ? JSON.parse(res.body) : res?.body;
  } catch {
    throw new LastfmError(`Last.fm answered ${status} without JSON`);
  }
  if (body?.error) {
    // 10: invalid key, 26: suspended key. 6: not found (a track Last.fm doesn't know).
    if (body.error === 10 || body.error === 26) throw new LastfmError(String(body.message ?? "Last.fm refused the API key"), true);
    if (body.error === 6) return null;
    throw new LastfmError(String(body.message ?? `Last.fm error ${body.error}`));
  }
  if (status >= 400) throw new LastfmError(`Last.fm answered ${status}`);
  return body;
}

/** Is this key good? One cheap call. */
export async function checkKey(userId: string, key: string): Promise<void> {
  await call(userId, key, { method: "tag.getinfo", tag: "ambient" });
  badKey.delete(userId);
}

const artistKey = (a: string) => `a:${a.toLowerCase().trim()}`;
const trackKey = (a: string, t: string) => `t:${a.toLowerCase().trim()}|${t.toLowerCase().trim()}`;

/**
 * A track's tags: the track's own when Last.fm has five or more, else the artist's (weighted down
 * a little: an artist's tags describe the whole catalogue, not this song).
 */
export async function tagsFor(userId: string, key: string, t: Pick<Track, "title" | "artists">): Promise<Tag[]> {
  const artist = (t.artists[0]?.name ?? "").replace(/\s*-\s*topic\s*$/i, "").replace(/vevo$/i, "").trim();
  if (!artist) return [];
  const title = lookupTitle(t.title);
  const c = await cache(userId);
  const tk = trackKey(artist, title);
  const fresh = (k: string) => (c[k] && Date.now() - c[k].at < TTL ? c[k].tags : null);
  let own = fresh(tk);
  if (!own) {
    const body = await call(userId, key, { method: "track.gettoptags", artist, track: title });
    own = cleanTags(body?.toptags?.tag);
    c[tk] = { at: Date.now(), tags: own };
    save(userId);
  }
  if (own.length >= 5) return own;
  const ak = artistKey(artist);
  let art = fresh(ak);
  if (!art) {
    const body = await call(userId, key, { method: "artist.gettoptags", artist });
    art = cleanTags(body?.toptags?.tag);
    c[ak] = { at: Date.now(), tags: art };
    save(userId);
  }
  const merged = [...own];
  for (const a of art) if (!merged.some((m) => m.name === a.name)) merged.push({ name: a.name, count: Math.round(a.count * 0.7) });
  return merged;
}

/**
 * Tags for several tracks at once, two at a time, within a time budget: a pick never waits more
 * than `budgetMs` on Last.fm. Tracks it didn't reach have no entry (no change to their score).
 */
export async function tagsForMany(userId: string, key: string, tracks: Pick<Track, "videoId" | "title" | "artists">[], budgetMs = 5000): Promise<Map<string, Tag[]>> {
  const out = new Map<string, Tag[]>();
  const deadline = Date.now() + budgetMs;
  const queue = [...tracks];
  const worker = async () => {
    while (queue.length && Date.now() < deadline) {
      const t = queue.shift()!;
      try {
        out.set(t.videoId, await tagsFor(userId, key, t));
      } catch (err) {
        if (err instanceof LastfmError && err.badKey) {
          badKey.set(userId, err.message);
          queue.length = 0;
          return;
        }
        warn(`soundtrack tags "${t.title}": ${describe(err)}`);
      }
    }
  };
  await Promise.race([Promise.all([worker(), worker()]), new Promise((r) => setTimeout(r, budgetMs + 200))]);
  // A copy: a lookup still in flight after the budget mustn't change the pick under it.
  return new Map(out);
}

export function forgetTags(userId: string) {
  caches.delete(userId);
}
