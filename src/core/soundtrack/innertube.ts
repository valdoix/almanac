// Soundtrack (design/11 §7): YouTube Music's InnerTube JSON → tracks and artists. The same shapes
// come back from music.youtube.com directly and from Pear Desktop's /api/v1/search, so the parser
// walks the whole response for the renderers it knows and ignores everything else: a layout change
// around them doesn't break it.

import type { Track, TrackArtist } from "./taste";

/** ytmusicapi's search filters ("EgWKAQ" + filter + no-spelling-fix flags). */
export const SEARCH_PARAMS = {
  songs: "EgWKAQIIAWoMEA4QChADEAQQCRAF",
  videos: "EgWKAQIQAWoMEA4QChADEAQQCRAF",
  artists: "EgWKAQIgAWoMEA4QChADEAQQCRAF",
  playlists: "EgWKAQIoAWoMEA4QChADEAQQCRAF",
} as const;

type J = any;
const runsText = (x: J): string => (Array.isArray(x?.runs) ? x.runs.map((r: J) => r?.text ?? "").join("") : typeof x?.simpleText === "string" ? x.simpleText : "");
const DURATION = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export function parseDuration(s: string): number {
  const m = DURATION.exec(s.trim());
  if (!m) return 0;
  return m[3] ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2]);
}

/** Visit every object in a JSON tree (iteratively: responses are deep). */
function walk(root: J, visit: (key: string, value: J) => void) {
  const stack: [string, J][] = [["", root]];
  let guard = 0;
  while (stack.length && guard++ < 400_000) {
    const [k, v] = stack.pop()!;
    if (!v || typeof v !== "object") continue;
    if (k) visit(k, v);
    if (Array.isArray(v)) for (let i = v.length - 1; i >= 0; i--) stack.push(["", v[i]]);
    else for (const key of Object.keys(v).reverse()) stack.push([key, v[key]]);
  }
}

const pageType = (r: J): string => r?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType ?? "";
const browseId = (r: J): string | undefined => r?.navigationEndpoint?.browseEndpoint?.browseId;
const SEP = /^\s*[•·]\s*$/;
const KIND_LABEL = /^(song|video|episode|single|ep|album|playlist|artist|podcast|profile|station)$/i;

/** Artist runs of a byline ("A & B • Album • 3:45"): runs that link to artist pages, else the text before the first "•". */
function bylineArtists(runs: J[]): { artists: TrackArtist[]; album?: string; duration: number } {
  const artists: TrackArtist[] = [];
  let album: string | undefined;
  let duration = 0;
  for (const r of runs) {
    const pt = pageType(r);
    const text = String(r?.text ?? "").trim();
    if (pt === "MUSIC_PAGE_TYPE_ARTIST" || pt === "MUSIC_PAGE_TYPE_USER_CHANNEL") artists.push({ name: text, id: browseId(r) });
    else if (pt === "MUSIC_PAGE_TYPE_ALBUM") album = text;
    else if (DURATION.test(text)) duration = parseDuration(text);
  }
  if (!artists.length) {
    // No links (some videos and uploads): the first segment that isn't a type label.
    const segs: string[] = [];
    let cur = "";
    for (const r of runs) {
      const t = String(r?.text ?? "");
      if (SEP.test(t)) {
        segs.push(cur.trim());
        cur = "";
      } else cur += t;
    }
    segs.push(cur.trim());
    const first = segs.find((s) => s && !KIND_LABEL.test(s) && !DURATION.test(s) && !/\b(views?|plays?)\b/i.test(s));
    if (first) artists.push({ name: first });
  }
  return { artists, album, duration };
}

function musicVideoType(x: J): string {
  let found = "";
  walk(x, (k, v) => {
    if (!found && k === "watchEndpointMusicConfig" && typeof v?.musicVideoType === "string") found = v.musicVideoType;
  });
  return found;
}
function isExplicit(x: J): boolean {
  return (x?.badges ?? x?.subtitleBadges ?? []).some((b: J) => /EXPLICIT/.test(b?.musicInlineBadgeRenderer?.icon?.iconType ?? ""));
}
function thumbOf(x: J): string | undefined {
  const list = x?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? x?.thumbnail?.thumbnails ?? [];
  const best = list[list.length - 1]?.url;
  return typeof best === "string" ? best : undefined;
}
const kindOf = (mvt: string): Track["kind"] => (mvt === "MUSIC_VIDEO_TYPE_ATV" ? "song" : "video");

function fromListItem(x: J): Track | null {
  const cols: J[] = (x?.flexColumns ?? []).map((c: J) => c?.musicResponsiveListItemFlexColumnRenderer?.text);
  const title = runsText(cols[0]).trim();
  let videoId: string | undefined = x?.playlistItemData?.videoId;
  if (!videoId) walk(x?.overlay ?? x?.flexColumns?.[0] ?? {}, (k, v) => {
    if (!videoId && k === "watchEndpoint" && typeof v?.videoId === "string") videoId = v.videoId;
  });
  if (!videoId || !title) return null;
  const runs: J[] = cols.slice(1).flatMap((c: J, i: number) => (i > 0 ? [{ text: " • " }, ...(c?.runs ?? [])] : c?.runs ?? []));
  const { artists, album, duration } = bylineArtists(runs);
  let durationS = duration;
  if (!durationS) for (const c of x?.fixedColumns ?? []) durationS ||= parseDuration(runsText(c?.musicResponsiveListItemFixedColumnRenderer?.text));
  const mvt = musicVideoType(x);
  return { videoId, title, artists, album, durationS, explicit: isExplicit(x), kind: mvt ? kindOf(mvt) : runs.some((r) => /^video$/i.test(String(r?.text ?? "").trim())) ? "video" : "song", thumb: thumbOf(x) };
}

function fromPanelVideo(x: J): Track | null {
  const videoId = x?.videoId;
  const title = runsText(x?.title).trim();
  if (!videoId || !title) return null;
  const { artists, album } = bylineArtists(x?.longBylineText?.runs ?? x?.shortBylineText?.runs ?? []);
  const mvt = musicVideoType(x);
  return { videoId, title, artists, album, durationS: parseDuration(runsText(x?.lengthText)), explicit: isExplicit(x), kind: mvt ? kindOf(mvt) : "song", thumb: thumbOf(x) };
}

function fromTwoRow(x: J): Track | null {
  let videoId: string | undefined;
  walk(x?.navigationEndpoint ?? {}, (k, v) => {
    if (!videoId && k === "watchEndpoint" && typeof v?.videoId === "string") videoId = v.videoId;
  });
  const title = runsText(x?.title).trim();
  if (!videoId || !title) return null;
  const { artists } = bylineArtists(x?.subtitle?.runs ?? []);
  const mvt = musicVideoType(x);
  return { videoId, title, artists, durationS: 0, explicit: isExplicit(x), kind: mvt ? kindOf(mvt) : "song", thumb: thumbOf(x) };
}

/** Every playable track in a response (search, playlist, watch queue, home shelves), first seen first. */
export function parseTracks(json: J): Track[] {
  const out: Track[] = [];
  const seen = new Set<string>();
  const add = (t: Track | null) => {
    if (t && !seen.has(t.videoId)) {
      seen.add(t.videoId);
      out.push(t);
    }
  };
  walk(json, (k, v) => {
    if (k === "musicResponsiveListItemRenderer") add(fromListItem(v));
    else if (k === "playlistPanelVideoRenderer") add(fromPanelVideo(v));
    else if (k === "musicTwoRowItemRenderer") add(fromTwoRow(v));
  });
  return out;
}

export interface ArtistHit {
  name: string;
  id: string;
  thumb?: string;
  subtitle?: string;
}

/** Artists in a response (an artist search, or the top result card). */
export function parseArtists(json: J): ArtistHit[] {
  const out: ArtistHit[] = [];
  const seen = new Set<string>();
  const add = (name: string, id: string | undefined, thumb?: string, subtitle?: string) => {
    if (name && id && /^UC|^MP/.test(id) && !seen.has(id)) {
      seen.add(id);
      out.push({ name, id, thumb, subtitle });
    }
  };
  walk(json, (k, v) => {
    if (k === "musicResponsiveListItemRenderer" && pageType(v) === "MUSIC_PAGE_TYPE_ARTIST") {
      const cols: J[] = (v.flexColumns ?? []).map((c: J) => c?.musicResponsiveListItemFlexColumnRenderer?.text);
      add(runsText(cols[0]).trim(), browseId(v), thumbOf(v), runsText(cols[1]).trim());
    } else if (k === "musicCardShelfRenderer") {
      const r = v?.title?.runs?.[0];
      if (pageType(r) === "MUSIC_PAGE_TYPE_ARTIST") add(String(r.text ?? "").trim(), browseId(r), thumbOf(v), runsText(v?.subtitle).trim());
    }
  });
  return out;
}

/** Playlist ids in a response (a playlist search, a moods page). */
export function parsePlaylistIds(json: J): string[] {
  const out: string[] = [];
  walk(json, (k, v) => {
    if (k === "browseEndpoint" && typeof v?.browseId === "string" && /^VL/.test(v.browseId) && !out.includes(v.browseId)) out.push(v.browseId);
  });
  return out;
}
