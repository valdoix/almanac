// Soundtrack (design/11 §6): the player's taste, and matching artists the way YouTube Music credits
// them ("A, B & C", "A feat. B", "Artist - Topic", "ArtistVEVO").

export interface ArtistRef {
  name: string;
  /** YouTube Music channel / browse id (UC…), set when the artist was picked from a search. */
  id?: string;
}

export interface Taste {
  genres: string[];
  /** strict: only these genres; blend: these first, the story's suggestions fill in. */
  genreMode: "strict" | "blend";
  preferred: ArtistRef[];
  banned: ArtistRef[];
  /** Whole words in a title that rule a track out ("nightcore", "sped up", "live"). */
  bannedWords: string[];
  vocals: "any" | "quiet-in-dialogue" | "instrumental";
  explicit: boolean;
  variety: "focused" | "balanced" | "wide";
  /** Music videos (OMV/UGC) as well as audio tracks; videos can open with skits and talking. */
  videos: boolean;
}

export const DEFAULT_TASTE: Taste = {
  genres: [],
  genreMode: "blend",
  preferred: [],
  banned: [],
  bannedWords: ["nightcore", "sped up", "slowed", "8d audio", "karaoke"],
  vocals: "any",
  explicit: true,
  variety: "balanced",
  videos: false,
};

export interface TrackArtist {
  name: string;
  id?: string;
}

export interface Track {
  videoId: string;
  title: string;
  artists: TrackArtist[];
  album?: string;
  durationS: number;
  explicit: boolean;
  kind: "song" | "video";
  thumb?: string;
}

const str = (x: unknown) => (typeof x === "string" ? x : "");
function refs(x: unknown): ArtistRef[] {
  if (!Array.isArray(x)) return [];
  const out: ArtistRef[] = [];
  for (const r of x) {
    const name = typeof r === "string" ? r.trim() : str((r as any)?.name).trim();
    const id = typeof r === "string" ? undefined : str((r as any)?.id).trim() || undefined;
    if (name && !out.some((o) => (id && o.id === id) || normName(o.name) === normName(name))) out.push(id ? { name, id } : { name });
  }
  return out.slice(0, 200);
}
const words = (x: unknown) => (Array.isArray(x) ? [...new Set(x.map((w) => str(w).trim()).filter(Boolean))].slice(0, 60) : []);

/** A taste from stored or sent data: anything malformed falls back to the default. */
export function cleanTaste(x: unknown, base: Taste = DEFAULT_TASTE): Taste {
  const t = (x ?? {}) as Record<string, unknown>;
  const pick = <K extends keyof Taste>(k: K, ok: readonly unknown[]): Taste[K] => (ok.includes(t[k]) ? (t[k] as Taste[K]) : base[k]);
  return {
    genres: "genres" in t ? words(t.genres).slice(0, 12) : base.genres,
    genreMode: pick("genreMode", ["strict", "blend"]),
    preferred: "preferred" in t ? refs(t.preferred) : base.preferred,
    banned: "banned" in t ? refs(t.banned) : base.banned,
    bannedWords: "bannedWords" in t ? words(t.bannedWords) : base.bannedWords,
    vocals: pick("vocals", ["any", "quiet-in-dialogue", "instrumental"]),
    explicit: typeof t.explicit === "boolean" ? t.explicit : base.explicit,
    variety: pick("variety", ["focused", "balanced", "wide"]),
    videos: typeof t.videos === "boolean" ? t.videos : base.videos,
  };
}

/**
 * The taste a chat plays with: a story's own genres and preferred artists replace the global ones;
 * its bans are added to the global bans, so a ban always holds.
 */
export function mergeTaste(global: Taste, chat?: Partial<Taste> | null): Taste {
  if (!chat) return global;
  const c = cleanTaste(chat, global);
  return {
    ...c,
    genres: chat.genres?.length ? c.genres : global.genres,
    preferred: chat.preferred?.length ? c.preferred : global.preferred,
    banned: refs([...global.banned, ...(chat.banned ?? [])]),
    bannedWords: [...new Set([...global.bannedWords, ...(chat.bannedWords ?? [])])],
  };
}

/** Lower case, accents off, "- Topic" / "VEVO" / "Official" off, punctuation to spaces. */
export function normName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*-\s*topic\s*$/, "")
    .replace(/vevo\s*$/, "")
    .replace(/\bofficial\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** "A, B & C feat. D" → ["A", "B", "C", "D"]. */
export function splitArtists(s: string): string[] {
  return s
    .split(/\s*(?:,|&|\+|\/|;|\bx\b|×|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bvs\.?)\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Does a credited artist match a reference? The same id, or the same whole name (never a prefix).
 * Names count even when both have ids: an artist's "Topic" channel and main channel differ.
 */
export function artistMatches(ref: ArtistRef, a: TrackArtist): boolean {
  if (ref.id && a.id && ref.id === a.id) return true;
  const r = normName(ref.name);
  return !!r && r === normName(a.name);
}

/** Every artist a track credits: the artist runs, split, and anyone "feat." in the title. */
export function creditsOf(t: Pick<Track, "artists" | "title">): TrackArtist[] {
  const out: TrackArtist[] = [];
  for (const a of t.artists) {
    // The whole credit counts as well as its parts: "Simon & Garfunkel" is one act.
    out.push(a);
    const parts = splitArtists(a.name);
    if (parts.length > 1) for (const p of parts) out.push({ name: p });
  }
  const feat = /[([]\s*(?:feat\.?|ft\.?|featuring|with)\s+([^)\]]+)[)\]]/i.exec(t.title)?.[1];
  if (feat) for (const p of splitArtists(feat)) out.push({ name: p });
  return out;
}

const wordRe = (w: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${w.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^\\p{L}\\p{N}])`, "u");

/** Why a track may never play under this taste, or null. */
export function banReason(t: Pick<Track, "artists" | "title">, taste: Pick<Taste, "banned" | "bannedWords">): string | null {
  const credits = creditsOf(t);
  for (const ref of taste.banned) if (credits.some((a) => artistMatches(ref, a))) return `banned artist ${ref.name}`;
  const title = t.title.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const w of taste.bannedWords) if (w.trim() && wordRe(w.trim()).test(title)) return `banned word "${w}"`;
  return null;
}

/** The preferred artist a track credits, if any. */
export function preferredOf(t: Pick<Track, "artists" | "title">, taste: Pick<Taste, "preferred">): ArtistRef | null {
  const credits = creditsOf(t);
  return taste.preferred.find((ref) => credits.some((a) => artistMatches(ref, a))) ?? null;
}

/** "Artist A, Artist B" for display. */
export const artistLine = (t: Pick<Track, "artists">) => t.artists.map((a) => a.name).join(", ");
