// Soundtrack catalog (design/11 §7): searches, through the player's own session when Pear is
// connected, else YouTube Music's web endpoint; pools cached per query in user storage.

import { parseArtists, parseTracks, SEARCH_PARAMS, type ArtistHit } from "../../core/soundtrack/innertube";
import type { Track } from "../../core/soundtrack/taste";
import { describe, host, serial, warn } from "../host";
import type { PearPlayer } from "./pear";

const POOLS = "soundtrack/pools.json";
const TTL = 7 * 24 * 3600_000;
const MAX_POOLS = 150;
const POOL_SIZE = 25;

interface Pool {
  at: number;
  tracks: Track[];
}

const pools = new Map<string, Record<string, Pool>>();
const coolUntil = new Map<string, number>();
const recentCalls = new Map<string, number[]>();

async function loadPools(userId: string): Promise<Record<string, Pool>> {
  const hit = pools.get(userId);
  if (hit) return hit;
  let p: Record<string, Pool> = {};
  try {
    if (await host.userStorage.exists(POOLS, userId || undefined)) p = (await host.userStorage.getJson<Record<string, Pool>>(POOLS, { fallback: {}, userId: userId || undefined })) ?? {};
  } catch (err) {
    // A cache: a failed read just means searching again, but it is never saved over.
    warn(`soundtrack pools: ${describe(err)}`);
    return {};
  }
  pools.set(userId, p);
  return p;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function savePools(userId: string) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const p = pools.get(userId);
    if (p) host.userStorage.setJson(POOLS, p, { userId: userId || undefined }).catch((err) => warn(`soundtrack pools save: ${describe(err)}`));
  }, 1500);
}

function slim(t: Track): Track {
  return { videoId: t.videoId, title: t.title.slice(0, 160), artists: t.artists.slice(0, 6), album: t.album?.slice(0, 100), durationS: t.durationS, explicit: t.explicit, kind: t.kind, thumb: t.thumb };
}

/** YouTube Music's web client version: the date it was built (a recent one works). */
function clientVersion(): string {
  const d = new Date(Date.now() - 3 * 86400_000);
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `1.${ymd}.01.00`;
}

/** The public web endpoint the music.youtube.com page itself uses. */
async function innertube(query: string, params?: string): Promise<unknown> {
  const version = clientVersion();
  const res: any = await host.cors("https://music.youtube.com/youtubei/v1/search?prettyPrint=false", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://music.youtube.com",
      Referer: "https://music.youtube.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      "X-Youtube-Client-Name": "67",
      "X-Youtube-Client-Version": version,
    },
    body: JSON.stringify({ context: { client: { clientName: "WEB_REMIX", clientVersion: version, hl: "en", gl: "US" } }, query, ...(params ? { params } : {}) }),
  } as any);
  const status = Number(res?.status ?? 0);
  if (status === 429) throw Object.assign(new Error("YouTube Music is limiting searches"), { rate: true });
  if (status >= 400) throw new Error(`YouTube Music search answered ${status}`);
  return typeof res?.body === "string" ? JSON.parse(res.body) : res?.body;
}

async function rawSearch(userId: string, query: string, params: string, player: PearPlayer | null): Promise<unknown> {
  const until = coolUntil.get(userId) ?? 0;
  if (Date.now() < until) throw new Error("searches paused for a few minutes (YouTube Music asked to slow down)");
  // At most 40 searches in ten minutes.
  const now = Date.now();
  const calls = (recentCalls.get(userId) ?? []).filter((t) => now - t < 600_000);
  if (calls.length >= 40) throw new Error("too many searches in the last ten minutes");
  calls.push(now);
  recentCalls.set(userId, calls);
  try {
    if (player?.token) {
      try {
        const r = await player.search(query, params);
        if (r) return r;
      } catch (err) {
        warn(`soundtrack: the player's search failed, using the web search: ${describe(err)}`);
      }
    }
    return await innertube(query, params);
  } catch (err) {
    if ((err as any)?.rate) coolUntil.set(userId, Date.now() + 5 * 60_000);
    throw err;
  }
}

/** Songs for one query: from the cache, else searched (one search at a time per user). */
export async function poolFor(userId: string, key: string, query: string, player: PearPlayer | null, opts: { videos?: boolean } = {}): Promise<Track[]> {
  const p = await loadPools(userId);
  const hit = p[key];
  if (hit && Date.now() - hit.at < TTL && hit.tracks.length) return hit.tracks;
  return serial(`st-search:${userId}`, async () => {
    const again = p[key];
    if (again && Date.now() - again.at < TTL && again.tracks.length) return again.tracks;
    const json = await rawSearch(userId, query, opts.videos ? "" : SEARCH_PARAMS.songs, player);
    const tracks = parseTracks(json).slice(0, POOL_SIZE).map(slim);
    delete p[key];
    p[key] = { at: Date.now(), tracks };
    const keys = Object.keys(p);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_POOLS))) delete p[k];
    savePools(userId);
    return tracks;
  });
}

/** Artists for the editor's autocomplete. */
export async function searchArtists(userId: string, query: string, player: PearPlayer | null): Promise<ArtistHit[]> {
  if (!query.trim()) return [];
  const json = await rawSearch(userId, query.trim(), SEARCH_PARAMS.artists, player);
  return parseArtists(json).slice(0, 8);
}

/** Songs for the "search and play" box. */
export async function searchSongs(userId: string, query: string, player: PearPlayer | null): Promise<Track[]> {
  if (!query.trim()) return [];
  const json = await rawSearch(userId, query.trim(), SEARCH_PARAMS.songs, player);
  return parseTracks(json).slice(0, 12).map(slim);
}

export function forgetPools(userId: string) {
  pools.set(userId, {});
  savePools(userId);
}
