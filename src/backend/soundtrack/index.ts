// Soundtrack (design/11): YouTube Music scored by the scene. The Ledger reads a mood from filed
// state, picks songs in the player's taste, and drives Pear Desktop; a guard keeps banned artists
// out of anything the Almanac or YouTube Music's autoplay starts. Nothing here touches the prompt.

import { placeKey, readCue, sameScene, type Cue, type SceneMark } from "../../core/soundtrack/cue";
import { absMinutes } from "../../core/util";
import { emptyDirector, step, type Action, type DirectorState, type Event, type NowPlaying } from "../../core/soundtrack/director";
import { GENRE_CHIPS, isMood, MOODS, suggestGenres, type Mood } from "../../core/soundtrack/moods";
import { draw, emptyHistory, excluded, genresFor, queriesFor, scoreAll, type Candidate, type History, type Scored } from "../../core/soundtrack/picker";
import { artistLine, banReason, cleanTaste, creditsOf, DEFAULT_TASTE, mergeTaste, normName, type ArtistRef, type Taste, type Track } from "../../core/soundtrack/taste";
import { describe, has, host, log, serial, warn } from "../host";
import { ledgerFor } from "../ledger";
import { quiet, sys, usr } from "../llm";
import { loadChat, loadSettings } from "../store";
import { isEnabled } from "../turn";
import { forgetPools, poolFor, searchArtists, searchSongs } from "./catalog";
import { PearPlayer, PlayerError, sleep, type PlayerStatus } from "./pear";
import { badKey, checkKey, forgetTags, LASTFM_KEY, LastfmError, tagsForMany } from "./lastfm";
import { retag } from "../../core/soundtrack/tags";
import { isTheme, relyric, THEME_LABEL, THEMES } from "../../core/soundtrack/lyrics";
import { lyricsForMany } from "./lyrics";
import { learnedFor, rate, ratedPool, ratingSummary, voteOf, type Rating } from "../../core/soundtrack/ratings";

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export interface SoundtrackConfig {
  /** The Soundtrack is on (the page and the polling). */
  enabled: boolean;
  /** Start pressed (and not Stop): the Almanac chooses the music. */
  running: boolean;
  playerUrl: string;
  /** This install's name in Pear's list of allowed clients. */
  clientId: string;
  /** The mood from the engine alone, or with a quiet model read at each new scene. */
  director: "engine" | "model";
  /** The model connection for the director ("" = the summariser's). */
  connection: string;
  cutOnSharp: boolean;
  takeBack: boolean;
  fade: boolean;
  /** Only the Almanac's picks (and songs the player chooses): YouTube Music's autoplay and mixes never play on. */
  onlyPicks: boolean;
  /** Songs whose words fit the scene: the best picks' lyrics are checked against what it's about. */
  lyrics: boolean;
  taste: Taste;
}

const DEFAULT_CONFIG: SoundtrackConfig = {
  enabled: false,
  running: false,
  playerUrl: "http://127.0.0.1:26538",
  clientId: "",
  director: "engine",
  connection: "",
  cutOnSharp: true,
  takeBack: true,
  fade: true,
  onlyPicks: false,
  lyrics: true,
  taste: DEFAULT_TASTE,
};

export interface Play {
  at: number;
  videoId: string;
  title: string;
  artist: string;
  mood: string;
  why: string;
  /** How it came to play: picked by the Almanac, skipped by the guard, chosen by the player. */
  how: "picked" | "banned-skip" | "user" | "autoplay";
  reason?: string;
  msgId?: string;
}

interface ChatSoundtrack {
  /** The story's own taste (genres and preferred replace the global ones; bans add). */
  taste?: Partial<Taste> | null;
  /** No soundtrack in this chat. */
  off?: boolean;
  plays: Play[];
  /** Where and when someone died, and the reply that filed it (a swipe away from it ends the grief). */
  grief?: (SceneMark & { msgId: string; swipe: number }) | null;
  /** Where and when the scene was last sex on the page (it holds while desire does). */
  heated?: SceneMark | null;
  /** The mood the player chose for this story's music; null or absent is Auto. */
  mood?: Mood | null;
  /** The model's reading of the current music scene. */
  hint?: (SceneMark & { mood: string; colour: string[]; themes?: string[] }) | null;
}

const CONFIG = "soundtrack/config.json";
const HISTORY = "soundtrack/history.json";
const chatPath = (chatId: string) => `chats/${chatId.replace(/[^\w-]/g, "_")}/soundtrack.json`;
const TOKEN = "soundtrack_pear_token";

/** Read a stored file: missing gives the fallback, a failed read throws (never cache a guess). */
async function readJson<T>(path: string, fallback: T, userId?: string): Promise<T> {
  if (!(await host.userStorage.exists(path, userId))) return fallback;
  return (await host.userStorage.getJson<T>(path, { fallback, userId })) ?? fallback;
}

// ---------------------------------------------------------------------------
// Sessions (one player per user)
// ---------------------------------------------------------------------------

interface Session {
  key: string;
  userId?: string;
  config: SoundtrackConfig;
  history: History;
  player: PearPlayer | null;
  status: PlayerStatus | "off" | "unknown";
  statusMsg: string;
  dir: DirectorState;
  chatId: string | null;
  np: NowPlaying | null;
  cue: Cue | null;
  cueKey: string;
  /** Songs the Almanac picked, by id (for credits with ids, and the "why"). */
  picked: Map<string, { track: Track; why: string; reason: string; query: string; genre: string; key: string }>;
  timer: ReturnType<typeof setTimeout> | null;
  pollGen: number;
  lastNote: string;
  liked: Set<string>;
  /** The player's Last.fm API key (from the vault), for listener tags: null = no tags. */
  lastfmKey: string | null;
}

const sessions = new Map<string, Session>();
const loadingSession = new Map<string, Promise<Session>>();

async function session(userId?: string): Promise<Session> {
  const key = userId ?? "";
  const hit = sessions.get(key);
  if (hit) return hit;
  const inflight = loadingSession.get(key);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const stored = await readJson<Partial<SoundtrackConfig>>(CONFIG, {}, userId);
      const config: SoundtrackConfig = { ...DEFAULT_CONFIG, ...stored, taste: cleanTaste(stored.taste ?? {}) };
      if (!config.clientId) {
        config.clientId = `almanac-${Math.random().toString(36).slice(2, 10)}`;
        await host.userStorage.setJson(CONFIG, config, { indent: 2, userId });
      }
      const history = { ...emptyHistory(), ...(await readJson<Partial<History>>(HISTORY, {}, userId)) };
      const token = await host.enclave.get(TOKEN, userId).catch(() => null);
      const lastfmKey = await host.enclave.get(LASTFM_KEY, userId).catch(() => null);
      const s: Session = {
        key, userId, config, history,
        player: new PearPlayer(config.playerUrl, token, config.clientId),
        status: token ? "unknown" : "off", statusMsg: "",
        dir: { ...emptyDirector(), running: config.running },
        chatId: null, np: null, cue: null, cueKey: "", picked: new Map(), timer: null, pollGen: 0, lastNote: "", liked: new Set(), lastfmKey: lastfmKey || null,
      };
      sessions.set(key, s);
      return s;
    } finally {
      loadingSession.delete(key);
    }
  })();
  loadingSession.set(key, p);
  return p;
}

async function saveConfig(s: Session) {
  await host.userStorage.setJson(CONFIG, s.config, { indent: 2, userId: s.userId });
}

let historyTimer: ReturnType<typeof setTimeout> | null = null;
function saveHistory(s: Session) {
  if (historyTimer) clearTimeout(historyTimer);
  historyTimer = setTimeout(() => {
    host.userStorage.setJson(HISTORY, s.history, { userId: s.userId }).catch((err) => warn(`soundtrack history: ${describe(err)}`));
  }, 800);
}

const chatCache = new Map<string, ChatSoundtrack>();
async function chatStore(chatId: string, userId?: string): Promise<ChatSoundtrack> {
  const hit = chatCache.get(chatId);
  if (hit) return hit;
  const c = { plays: [], ...(await readJson<Partial<ChatSoundtrack>>(chatPath(chatId), {}, userId)) } as ChatSoundtrack;
  chatCache.set(chatId, c);
  if (chatCache.size > 32) chatCache.delete(chatCache.keys().next().value!);
  return c;
}
function saveChat(chatId: string, userId?: string) {
  const c = chatCache.get(chatId);
  if (c) host.userStorage.setJson(chatPath(chatId), c, { userId }).catch((err) => warn(`soundtrack chat save: ${describe(err)}`));
}

function note(s: Session, text: string) {
  s.lastNote = text;
  log(`soundtrack: ${text}`);
}

// ---------------------------------------------------------------------------
// The cue for a chat
// ---------------------------------------------------------------------------

const VALID_COLOUR = /^[a-z][a-z \-]{1,20}$/;

/** The model's reading of a new scene (design §5.4): one mood from the list and two texture words. */
async function directorHint(s: Session, chatId: string, cs: ChatSoundtrack, reply: string, here: SceneMark): Promise<void> {
  const L = ledgerFor(chatId, s.userId);
  const st = L.state;
  const sceneNo = st.sceneNo ?? 0;
  const settings = await loadSettings(s.userId);
  const files = await loadChat(chatId, s.userId);
  const scene = [
    `Scene ${sceneNo}${st.title ? `: ${st.title}` : ""}`,
    `Mode: ${st.mode}`,
    st.place?.length ? `Place: ${st.place.join(" › ")}` : "",
    st.weather?.condition ? `Weather: ${st.weather.condition}` : "",
    files.meta.config.genres?.length ? `Story genres: ${files.meta.config.genres.join(", ")}` : "",
  ].filter(Boolean).join("\n");
  const text = await quiet(
    [
      sys(`You score scenes for a story's soundtrack. Read the scene and answer with JSON only: {"mood": one of ${MOODS.map((m) => `"${m}"`).join(", ")}, "colour": [up to two plain lower-case texture words for a music search, like "rain", "candlelit", "neon", "desert"], "themes": [one to three of ${THEMES.map((t) => `"${t}"`).join(", ")}: what the scene is about, for songs whose lyrics fit it]}. Tender is closeness and comfort, romantic is love said or shown, sensual is kissing and building desire, erotic is sex on the page. Judge only what has happened on the page; never anticipate what might come next.`),
      usr(`${scene}\n\nThe scene so far (latest reply):\n${reply.slice(0, 1600)}`),
    ],
    { connectionId: s.config.connection || settings.summarizerConnection || undefined, userId: s.userId, reasoningOff: true, maxTokens: 100, timeoutMs: 15_000, label: "soundtrack director" },
  );
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return;
  try {
    const j = JSON.parse(m[0]);
    if (!isMood(j.mood)) return;
    const colour = (Array.isArray(j.colour) ? j.colour : []).map((c: unknown) => String(c).toLowerCase().trim()).filter((c: string) => VALID_COLOUR.test(c)).slice(0, 2);
    const themes = (Array.isArray(j.themes) ? j.themes : []).map((t: unknown) => String(t).toLowerCase().trim()).filter(isTheme).slice(0, 3);
    cs.hint = { ...here, mood: j.mood, colour, themes };
    saveChat(chatId, s.userId);
  } catch {
    /* not JSON: the engine's cue stands */
  }
}

async function cueFor(s: Session, chatId: string): Promise<{ cue: Cue; stamp: string } | null> {
  const files = await loadChat(chatId, s.userId);
  const settings = await loadSettings(s.userId);
  if (!isEnabled(files.meta, settings)) return null;
  const L = ledgerFor(chatId, s.userId);
  if (!L.state || !L.path.length) await L.refresh();
  const st = L.state;
  if (!st) return null;
  const cs = await chatStore(chatId, s.userId);
  if (cs.off) return null;
  const path = L.path;
  const lastReply = [...path].reverse().find((m) => !m.isUser);
  const lastUser = [...path].reverse().find((m) => m.isUser);
  const here: SceneMark = { place: placeKey(st.place ?? []), at: st.time ? absMinutes(st.time) : null };
  const chosen = cs.mood && isMood(cs.mood) ? cs.mood : null;
  // One model call per music scene (the same spot, within an hour and a half), not per reply; none while the player chose the mood.
  if (s.config.director === "model" && !chosen && lastReply && !sameScene(cs.hint, here)) {
    await directorHint(s, chatId, cs, lastReply.content, here).catch((err) => warn(`soundtrack director: ${describe(err)}`));
  }
  const hint = cs.hint && isMood(cs.hint.mood) ? { place: cs.hint.place, at: cs.hint.at, mood: cs.hint.mood, colour: cs.hint.colour ?? [], themes: (cs.hint.themes ?? []).filter(isTheme) } : null;
  // Grief holds only while the reply that filed the death is still the one on the path.
  const g = cs.grief;
  const griefLive = g && path.some((m) => m.id === g.msgId && m.swipe === g.swipe) ? g : null;
  const cue = readCue({
    state: st,
    genres: files.meta.config.genres ?? [],
    tone: files.meta.config.tone,
    playerMsg: lastUser?.content,
    reply: lastReply?.content,
    grief: griefLive,
    heated: cs.heated ?? null,
    hint: s.config.director === "model" ? hint : null,
    nsfw: files.meta.config.nsfw || files.meta.detected.nsfw || "",
    chosen,
  });
  if (cue.death && lastReply && (g?.msgId !== lastReply.id || g?.swipe !== lastReply.swipe)) {
    cs.grief = { place: cue.place, at: cue.at, msgId: lastReply.id, swipe: lastReply.swipe };
    saveChat(chatId, s.userId);
  }
  if (cue.heat === 2 && (cs.heated?.place !== cue.place || cs.heated?.at !== cue.at)) {
    cs.heated = { place: cue.place, at: cue.at };
    saveChat(chatId, s.userId);
  }
  return { cue, stamp: `${lastReply?.id ?? ""}:${lastReply?.swipe ?? 0}:${lastUser?.id ?? ""}` };
}

// ---------------------------------------------------------------------------
// Picking a song
// ---------------------------------------------------------------------------

async function tasteFor(s: Session, chatId: string | null): Promise<{ taste: Taste; storyGenres: string[] }> {
  if (!chatId) return { taste: s.config.taste, storyGenres: [] };
  const cs = await chatStore(chatId, s.userId).catch(() => null);
  const files = await loadChat(chatId, s.userId).catch(() => null);
  return { taste: mergeTaste(s.config.taste, cs?.taste ?? null), storyGenres: files?.meta.config.genres ?? [] };
}

async function choose(s: Session, cue: Cue): Promise<Scored | null> {
  const { taste, storyGenres } = await tasteFor(s, s.chatId);
  const dialogue = (() => {
    const last = s.chatId ? [...ledgerFor(s.chatId, s.userId).path].reverse().find((m) => !m.isUser)?.content ?? "" : "";
    const quoted = (last.match(/["“][^"”]{3,}["”]/g) ?? []).join("").length;
    return last.length > 0 && quoted / last.length > 0.3;
  })();
  const player = s.status === "connected" ? s.player : null;
  const now = Date.now();
  // The player's thumbs for this mood: what they teach, and the songs rated up as candidates of their own.
  const rated = s.history.rated ?? [];
  const learned = rated.length ? learnedFor(rated, cue.mood) : undefined;
  const pool = rated.length ? ratedPool(rated, cue.mood) : [];
  for (const salt of [0, 1, 2]) {
    const qs = queriesFor(cue, taste, storyGenres, salt);
    const cands: Candidate[] = pool.map((track, pos) => ({ track, query: { q: "", key: "rated", genre: "", rank: 1 }, pos: pos + 2 }));
    for (const q of qs) {
      try {
        const tracks = await poolFor(s.userId ?? "", q.key, q.q, player, { videos: taste.videos });
        tracks.forEach((track, pos) => cands.push({ track, query: q, pos }));
      } catch (err) {
        warn(`soundtrack search "${q.q}": ${describe(err)}`);
      }
    }
    const history: History = { ...s.history, chat: (await chatStore(s.chatId ?? "", s.userId).catch(() => ({ plays: [] as Play[] }))).plays.map((p) => p.videoId) };
    let scored = scoreAll(cands, cue, taste, history, { now, seed: "", dialogue, liked: s.liked, learned });
    if (!scored.length && cands.length) {
      // Everything good was played lately: allow repeats from more than a few songs ago, never bans.
      scored = scoreAll(cands, cue, taste, { ...history, chat: history.chat.slice(-5), recent: {}, lastArtist: undefined }, { now, seed: "", dialogue, liked: s.liked, learned });
    }
    // Listener tags (Last.fm), when the player gave a key: the best ten, checked against the mood.
    if (s.lastfmKey && !badKey.has(s.userId ?? "") && scored.length > 1) {
      const top = scored.slice(0, 10);
      const tags = await tagsForMany(s.userId ?? "", s.lastfmKey, top.map((x) => x.track));
      if (tags.size) scored = [...retag(top, tags, cue.mood, genresFor(taste, storyGenres), taste.genreMode === "strict" && taste.genres.length > 0), ...scored.slice(10)];
      if (badKey.has(s.userId ?? "")) note(s, `Last.fm refused the API key: ${badKey.get(s.userId ?? "")}`);
    }
    // Lyrics: the best twelve, checked against what the scene is about (none for an instrumental taste).
    if (s.config.lyrics && taste.vocals !== "instrumental" && cue.themes?.length && scored.length > 1) {
      const top = scored.slice(0, 12);
      const profiles = await lyricsForMany(s.userId ?? "", top.map((x) => x.track));
      if (profiles.size) scored = [...relyric(top, profiles, cue.themes, cue.images ?? []), ...scored.slice(12)].sort((a, b) => b.score - a.score);
    }
    const pick = draw(scored, `${s.chatId}|${cue.place}|${cue.mood}|${history.chat.length}|${salt}`);
    if (pick) return pick;
  }
  return null;
}

async function recordPlay(s: Session, track: Track, how: Play["how"], cue: Cue | null, reason: string) {
  if (!s.chatId) return;
  const cs = await chatStore(s.chatId, s.userId);
  const lastReply = [...ledgerFor(s.chatId, s.userId).path].reverse().find((m) => !m.isUser);
  cs.plays = [...cs.plays, { at: Date.now(), videoId: track.videoId, title: track.title, artist: artistLine(track), mood: cue?.mood ?? "", why: cue?.why ?? "", how, reason, msgId: lastReply?.id }].slice(-50);
  saveChat(s.chatId, s.userId);
}

// ---------------------------------------------------------------------------
// The director's actions
// ---------------------------------------------------------------------------

async function apply(s: Session, ev: Event): Promise<void> {
  const { state, actions } = step(s.dir, ev);
  s.dir = state;
  for (const a of actions) await act(s, a);
}

async function act(s: Session, a: Action): Promise<void> {
  const player = s.player;
  if (!player || s.status !== "connected") {
    if (a.type === "pick") await apply(s, { type: "pick-failed", now: Date.now() });
    return;
  }
  try {
    switch (a.type) {
      case "pick": {
        const best = await choose(s, a.cue);
        if (!best) {
          note(s, `nothing found for "${a.cue.why}"`);
          await apply(s, { type: "pick-failed", now: Date.now() });
          return;
        }
        const t = best.track;
        if (a.when === "now") {
          if (a.fade && s.config.fade && s.np && !s.np.isPaused) await player.fade(() => player.playNow(t.videoId));
          else await player.playNow(t.videoId);
        } else await player.enqueue(t.videoId, true);
        const tagged = best.reasons.find((r) => r.startsWith("tagged ") || r.startsWith("but tagged "));
        const thumbs = best.reasons.find((r) => r.startsWith("you "));
        const words = best.reasons.filter((r) => r.startsWith("lyrics ") || r.startsWith("but lyrics ")).join(" · ");
        const why = `${a.cue.why}${best.query.q ? ` — from "${best.query.q}"` : ""}${words ? ` · ${words}` : ""}${tagged ? ` · ${tagged}` : ""}${thumbs ? ` · ${thumbs}` : ""}`;
        s.picked.set(t.videoId, { track: t, why, reason: a.reason, query: best.query.q, genre: best.query.genre, key: best.query.key });
        if (s.picked.size > 80) s.picked.delete(s.picked.keys().next().value!);
        s.history.recent[t.videoId] = Date.now();
        for (const [id, at] of Object.entries(s.history.recent)) if (Date.now() - at > 6 * 3600_000) delete s.history.recent[id];
        s.history.lastArtist = normName(t.artists[0]?.name ?? "");
        saveHistory(s);
        await recordPlay(s, t, "picked", a.cue, a.reason);
        note(s, `${a.when === "now" ? "playing" : "next up"}: ${t.title} — ${artistLine(t)} (${a.reason}; ${why})`);
        await apply(s, { type: "picked", videoId: t.videoId, when: a.when, cue: a.cue, now: Date.now() });
        if (a.when === "now") schedulePoll(s, 1500);
        break;
      }
      case "drop-next":
        await player.removeNext(a.videoId).catch(() => false);
        break;
      case "skip":
        note(s, `skipped ${s.np?.title ?? a.videoId}: ${a.reason}`);
        if (s.np) await recordPlay(s, { videoId: s.np.videoId, title: s.np.title, artists: [{ name: s.np.artist }], durationS: s.np.durationS, explicit: false, kind: "song" }, "banned-skip", null, a.reason);
        await player.next();
        schedulePoll(s, 1500);
        break;
      case "replay-next":
        await player.enqueue(a.videoId, true);
        break;
      case "replay-now":
        await player.playNow(a.videoId);
        schedulePoll(s, 1500);
        break;
      case "penalise": {
        s.history.skips[`${a.mood}|${a.videoId}`] = (s.history.skips[`${a.mood}|${a.videoId}`] ?? 0) + 1;
        const t = s.picked.get(a.videoId)?.track;
        for (const c of t ? creditsOf(t) : []) {
          const k = `${a.mood}|${normName(c.name)}`;
          s.history.skips[k] = (s.history.skips[k] ?? 0) + 0.5;
        }
        const keys = Object.keys(s.history.skips);
        for (const k of keys.slice(0, Math.max(0, keys.length - 600))) delete s.history.skips[k];
        saveHistory(s);
        break;
      }
    }
  } catch (err) {
    onPlayerError(s, err);
    if (a.type === "pick") await apply(s, { type: "pick-failed", now: Date.now() }).catch(() => undefined);
  }
}

function onPlayerError(s: Session, err: unknown) {
  if (err instanceof PlayerError) {
    s.status = err.status;
    s.statusMsg = err.message;
  } else {
    s.statusMsg = describe(err);
  }
  warn(`soundtrack: ${describe(err)}`);
}

/** One thing at a time per user: a pick and a poll never interleave. */
function run(s: Session, fn: () => Promise<void>): Promise<void> {
  return serial(`soundtrack:${s.key}`, fn).catch((err) => warn(`soundtrack: ${describe(err)}`));
}

// ---------------------------------------------------------------------------
// Polling the player
// ---------------------------------------------------------------------------

function schedulePoll(s: Session, ms?: number) {
  if (s.timer) clearTimeout(s.timer);
  s.timer = null;
  if (!s.config.enabled || !s.player?.token) return;
  const gen = ++s.pollGen;
  // A song about to end is looked at just after it does, so the next one follows with little silence.
  const left = s.np && !s.np.isPaused && s.np.durationS > 0 ? s.np.durationS - s.np.elapsedS : Infinity;
  const delay = ms ?? (s.status === "not-running" || s.status === "error" ? 30_000 : s.status === "not-allowed" ? 60_000 : s.np && !s.np.isPaused ? Math.max(1_000, Math.min(5_000, left * 1000 + 1_200)) : s.dir.running ? 10_000 : 15_000);
  s.timer = setTimeout(() => {
    if (gen !== s.pollGen) return;
    void run(s, () => poll(s)).finally(() => {
      if (gen === s.pollGen) schedulePoll(s);
    });
  }, delay);
}

async function poll(s: Session): Promise<void> {
  if (!s.player?.token) return;
  let np: NowPlaying | null;
  try {
    np = await s.player.nowPlaying();
    if (s.status !== "connected") {
      s.status = "connected";
      s.statusMsg = "";
      push(s);
    }
  } catch (err) {
    const was = s.status;
    onPlayerError(s, err);
    s.np = null;
    if (was !== s.status) push(s);
    return;
  }
  const changed = np?.videoId !== s.np?.videoId || np?.isPaused !== s.np?.isPaused;
  const known = np ? s.picked.get(np.videoId)?.track : undefined;
  if (np && known) {
    np.artists = known.artists;
    np.album ??= known.album;
  }
  let banned: string | null = null;
  if (np && np.videoId !== s.dir.current) {
    const { taste } = await tasteFor(s, s.chatId);
    banned = banReason({ title: np.title, artists: np.artists ?? [{ name: np.artist }] }, taste);
    if (np.durationS) s.liked.delete(np.videoId);
  }
  const prevOrigin = s.dir.origin;
  const prevId = s.dir.current;
  // The first song seen (after a restart, say): one the Almanac picked in this story is still its own.
  if (np && !s.dir.current && !s.dir.ours.includes(np.videoId) && s.chatId) {
    const plays = (await chatStore(s.chatId, s.userId).catch(() => null))?.plays ?? [];
    if (plays.slice(-10).some((p) => p.videoId === np.videoId && p.how === "picked")) s.dir = { ...s.dir, ours: [...s.dir.ours, np.videoId].slice(-40) };
  }
  s.np = np;
  await apply(s, { type: "poll", np, now: Date.now(), banned, onlyPicks: s.config.onlyPicks });
  if (np && np.videoId !== prevId && s.dir.origin && s.dir.origin !== "ours" && s.dir.origin !== "ours-skip" && s.dir.current === np.videoId && !banned) {
    // The scene's mood at the time, so the song can be rated for it later.
    await recordPlay(s, { videoId: np.videoId, title: np.title, artists: np.artists ?? [{ name: np.artist }], durationS: np.durationS, explicit: false, kind: "song", thumb: np.thumb }, s.dir.origin === "user" ? "user" : "autoplay", s.dir.lastCue ? { ...s.dir.lastCue, why: "" } : null, "");
  }
  // A song the player liked in YouTube Music counts in its favour next time.
  if (np && !np.isPaused && np.elapsedS > 20 && !s.liked.has(np.videoId) && prevOrigin !== null) {
    if (await s.player.liked().catch(() => false)) s.liked.add(np.videoId);
  }
  if (changed) push(s);
}

// ---------------------------------------------------------------------------
// Entry points from the rest of the backend
// ---------------------------------------------------------------------------

/** A chat became the one on screen: the music follows it. */
export async function soundtrackSwitch(chatId: string, userId?: string): Promise<void> {
  const s = await session(userId).catch(() => null);
  if (!s) return;
  if (s.chatId !== chatId) {
    s.chatId = chatId;
    s.cueKey = "";
  }
  if (s.config.enabled && s.player?.token && !s.timer) schedulePoll(s, 500);
  await soundtrackChanged(chatId, userId, 0);
}

const cueKeyOf = (chatId: string, r: { cue: Cue; stamp: string }) => `${chatId}|${r.stamp}|${r.cue.mood}|${r.cue.place}|${Math.round(r.cue.tension * 10)}`;

/** The story moved (a reply filed, a swipe, an edit): read the cue and tell the director. */
export async function soundtrackChanged(chatId: string, userId?: string, delay = 1200): Promise<void> {
  const s = sessions.get(userId ?? "") ?? (await session(userId).catch(() => null));
  if (!s || !s.config.enabled) return;
  if (s.chatId && s.chatId !== chatId) return; // another chat is on screen
  s.chatId = chatId;
  if (delay) await sleep(delay);
  await run(s, async () => {
    const r = await cueFor(s, chatId).catch((err) => {
      warn(`soundtrack cue: ${describe(err)}`);
      return null;
    });
    if (!r) return;
    const key = cueKeyOf(chatId, r);
    if (key === s.cueKey) return;
    s.cueKey = key;
    s.cue = r.cue;
    await apply(s, { type: "cue", cue: r.cue, now: Date.now(), cutOnSharp: s.config.cutOnSharp, takeBack: s.config.takeBack });
    push(s);
  });
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

async function viewOf(s: Session): Promise<Record<string, unknown>> {
  const chatId = s.chatId;
  const cs = chatId ? await chatStore(chatId, s.userId).catch(() => null) : null;
  const files = chatId ? await loadChat(chatId, s.userId).catch(() => null) : null;
  const storyGenres = files?.meta.config.genres ?? [];
  const { taste } = await tasteFor(s, chatId);
  const np = s.np;
  const mine = np ? s.picked.get(np.videoId) : undefined;
  const next = s.dir.next ? s.picked.get(s.dir.next.videoId) : undefined;
  const rated = s.history.rated ?? [];
  const npMood = np ? moodPlaying(s) : "";
  return {
    hasCors: has("cors_proxy"),
    enabled: s.config.enabled,
    running: s.dir.running,
    status: s.status,
    statusMsg: s.statusMsg,
    connected: !!s.player?.token,
    playerUrl: s.config.playerUrl,
    director: s.config.director,
    connection: s.config.connection,
    cutOnSharp: s.config.cutOnSharp,
    takeBack: s.config.takeBack,
    fade: s.config.fade,
    onlyPicks: s.config.onlyPicks,
    lyrics: s.config.lyrics,
    taste: s.config.taste,
    lastfm: !!s.lastfmKey,
    lastfmBad: badKey.get(s.userId ?? "") ?? "",
    chatId,
    chatTaste: cs?.taste ?? null,
    chatOff: !!cs?.off,
    moodPick: cs?.mood ?? null,
    moods: MOODS,
    effectiveGenres: genresFor(taste, storyGenres),
    suggestions: suggestGenres(storyGenres),
    chips: GENRE_CHIPS,
    mode: s.dir.mode,
    origin: s.dir.origin,
    np: np ? { videoId: np.videoId, title: np.title, artist: np.artist, thumb: np.thumb, album: np.album, isPaused: np.isPaused, elapsedS: np.elapsedS, durationS: np.durationS, why: mine?.why ?? "", reason: mine?.reason ?? "", mood: npMood, vote: npMood ? voteOf(rated, np.videoId, npMood) : 0 } : null,
    next: next ? { title: next.track.title, artist: artistLine(next.track), why: next.why } : null,
    cue: s.cue ? { mood: s.cue.mood, chosen: !!s.cue.chosen, read: s.cue.read ?? null, why: s.cue.why, energy: s.cue.energy, valence: s.cue.valence, tension: s.cue.tension, colour: s.cue.colour, sceneNo: s.cue.sceneNo, place: s.cue.place, themes: (s.cue.themes ?? []).map((t) => THEME_LABEL[t.t]) } : null,
    plays: (cs?.plays ?? []).slice(-15).reverse().map((p) => ({ ...p, vote: p.mood ? voteOf(rated, p.videoId, p.mood) : 0 })),
    ratings: { summary: ratingSummary(rated), recent: rated.slice(-12).reverse().map((r) => ({ videoId: r.track.videoId, title: r.track.title, artist: artistLine(r.track), mood: r.mood, vote: r.vote })), total: rated.length },
    note: s.lastNote,
  };
}

/** Send the page its view. Views go out in order: a slow one never lands after a newer one. */
let pushChain: Promise<void> = Promise.resolve();
function push(s: Session): Promise<void> {
  pushChain = pushChain.then(() =>
    viewOf(s)
      .then((view) => host.sendToFrontend({ type: "soundtrack", view }, s.userId))
      .catch((err) => warn(`soundtrack view: ${describe(err)}`)),
  );
  return pushChain;
}

function reply(userId: string | undefined, payload: unknown) {
  host.sendToFrontend(payload, userId);
}

const refList = (x: unknown): ArtistRef[] => cleanTaste({ preferred: x }).preferred;

/** Messages from the Soundtrack page. */
export async function soundtrackAction(m: Record<string, any>, userId?: string): Promise<void> {
  const s = await session(userId);
  if (m.chatId && typeof m.chatId === "string" && s.chatId !== m.chatId) {
    s.chatId = m.chatId;
    s.cueKey = "";
  }
  const action = String(m.action ?? "");
  switch (action) {
    case "get":
      // Opening the page shows what's playing now, not as of the last poll.
      if (s.config.enabled && s.player?.token) await run(s, () => poll(s));
      break;
    case "config": {
      const p = m.patch ?? {};
      const was = { enabled: s.config.enabled, url: s.config.playerUrl };
      if (typeof p.enabled === "boolean") s.config.enabled = p.enabled;
      if (typeof p.playerUrl === "string" && /^https?:\/\/[^\s/]+(?::\d+)?\/?$/i.test(p.playerUrl.trim())) s.config.playerUrl = p.playerUrl.trim().replace(/\/+$/, "");
      if (p.director === "engine" || p.director === "model") s.config.director = p.director;
      if (typeof p.connection === "string") s.config.connection = p.connection;
      for (const k of ["cutOnSharp", "takeBack", "fade", "onlyPicks", "lyrics"] as const) if (typeof p[k] === "boolean") s.config[k] = p[k];
      if (was.url !== s.config.playerUrl) s.player = new PearPlayer(s.config.playerUrl, s.player?.token ?? null, s.config.clientId);
      if (!s.config.enabled) {
        s.dir = { ...s.dir, running: false };
        s.config.running = false;
        if (s.timer) clearTimeout(s.timer);
        s.timer = null;
      }
      await saveConfig(s);
      if (s.config.enabled && (!was.enabled || was.url !== s.config.playerUrl)) schedulePoll(s, 200);
      if (s.config.enabled && !was.enabled && s.chatId) void soundtrackChanged(s.chatId, userId, 0);
      break;
    }
    case "taste": {
      const scope = m.scope === "chat" ? "chat" : "global";
      if (scope === "global") {
        s.config.taste = cleanTaste(m.taste ?? {}, s.config.taste);
        await saveConfig(s);
      } else if (s.chatId) {
        const cs = await chatStore(s.chatId, userId);
        cs.taste = m.taste === null ? null : cleanTaste(m.taste ?? {}, { ...s.config.taste, genres: [], preferred: [], banned: [], bannedWords: [] });
        saveChat(s.chatId, userId);
      }
      forgetCueKey(s);
      break;
    }
    case "chatOff": {
      if (!s.chatId) break;
      const cs = await chatStore(s.chatId, userId);
      cs.off = !!m.off;
      saveChat(s.chatId, userId);
      forgetCueKey(s);
      if (!cs.off) void soundtrackChanged(s.chatId, userId, 0);
      break;
    }
    case "mood": {
      // The player's mood for this story's music, or Auto (null): played at once when the Almanac is choosing.
      if (!s.chatId) break;
      const chatId = s.chatId;
      const cs = await chatStore(chatId, userId);
      cs.mood = isMood(m.mood) ? m.mood : null;
      saveChat(chatId, userId);
      await run(s, async () => {
        const r = await cueFor(s, chatId).catch((err) => {
          warn(`soundtrack cue: ${describe(err)}`);
          return null;
        });
        if (!r) return;
        s.cue = r.cue;
        s.cueKey = cueKeyOf(chatId, r);
        await apply(s, { type: "mood", cue: r.cue, now: Date.now() });
      });
      break;
    }
    case "connect": {
      if (!s.player) s.player = new PearPlayer(s.config.playerUrl, null, s.config.clientId);
      try {
        s.statusMsg = "Waiting for you to press Allow in YouTube Music…";
        push(s);
        const token = await s.player.connect();
        await host.enclave.put(TOKEN, token, userId);
        s.status = "unknown";
        s.statusMsg = "";
        if (!s.config.enabled) {
          s.config.enabled = true;
          await saveConfig(s);
        }
        await run(s, () => poll(s));
        schedulePoll(s);
        if (s.chatId) void soundtrackChanged(s.chatId, userId, 0);
      } catch (err) {
        onPlayerError(s, err);
      }
      break;
    }
    case "disconnect":
      await host.enclave.delete(TOKEN, userId).catch(() => false);
      if (s.player) s.player.token = null;
      s.status = "off";
      s.statusMsg = "";
      s.dir = { ...s.dir, running: false };
      s.config.running = false;
      await saveConfig(s);
      if (s.timer) clearTimeout(s.timer);
      s.timer = null;
      break;
    case "start":
    case "stop": {
      s.config.running = action === "start";
      await saveConfig(s);
      await run(s, async () => {
        if (action === "start" && s.chatId) {
          const r = await cueFor(s, s.chatId).catch(() => null);
          if (r) {
            s.cue = r.cue;
            s.cueKey = "";
            await apply(s, { type: "cue", cue: r.cue, now: Date.now(), cutOnSharp: s.config.cutOnSharp, takeBack: s.config.takeBack });
          }
        }
        await apply(s, action === "start" ? { type: "start", now: Date.now() } : { type: "stop" });
      });
      if (action === "start" && !s.cue) note(s, "started: the music begins with the next reply in an ALMANAC chat");
      break;
    }
    case "skip":
      await run(s, () => apply(s, { type: "user-skip", now: Date.now() }));
      break;
    case "hold":
      await run(s, () => apply(s, { type: "hold", on: !!m.on }));
      break;
    case "pause":
    case "play":
      await (action === "pause" ? s.player?.pause() : s.player?.play())?.catch((err) => onPlayerError(s, err));
      schedulePoll(s, 800);
      break;
    case "ban":
    case "prefer": {
      const ref = refList([{ name: String(m.name ?? ""), id: m.id ? String(m.id) : undefined }])[0];
      if (!ref) break;
      const list = action === "ban" ? "banned" : "preferred";
      s.config.taste = cleanTaste({ ...s.config.taste, [list]: [...s.config.taste[list], ref] });
      await saveConfig(s);
      // Banned from the page while it plays: it goes now.
      if (action === "ban" && s.np && creditsOf({ title: s.np.title, artists: s.np.artists ?? [{ name: s.np.artist }] }).some((a) => normName(a.name) === normName(ref.name) || (!!ref.id && a.id === ref.id))) {
        await run(s, () => apply(s, { type: "user-skip", now: Date.now() }));
      }
      break;
    }
    case "rate": {
      // Thumbs up or down: does the song fit the mood it played for? The same thumb again takes it back.
      const vote = m.vote === -1 ? -1 : m.vote === 1 ? 1 : 0;
      const id = String(m.videoId ?? s.np?.videoId ?? "");
      if (!vote || !id) break;
      const playing = s.np?.videoId === id;
      const play = s.chatId ? [...(await chatStore(s.chatId, userId)).plays].reverse().find((p) => p.videoId === id) : undefined;
      const mood = isMood(m.mood) ? m.mood : playing && isMood(moodPlaying(s)) ? (moodPlaying(s) as Mood) : isMood(play?.mood) ? (play!.mood as Mood) : null;
      if (!mood) {
        note(s, "no mood to rate the song for yet");
        break;
      }
      const known = s.picked.get(id);
      const track: Track | null = known?.track ?? (playing && s.np
        ? { videoId: id, title: s.np.title, artists: s.np.artists ?? [{ name: s.np.artist }], album: s.np.album, durationS: s.np.durationS, explicit: false, kind: "song", thumb: s.np.thumb }
        : play ? { videoId: id, title: play.title, artists: play.artist.split(/, | & /).map((name: string) => ({ name })), durationS: 0, explicit: false, kind: "song" } : null);
      if (!track) break;
      const before = voteOf(s.history.rated ?? [], id, mood);
      const r: Rating = { track, mood, genre: known?.genre ?? "", qkey: known?.key && known.key !== "rated" ? known.key : "", vote, at: Date.now() };
      s.history.rated = rate(s.history.rated ?? [], r);
      saveHistory(s);
      const now = voteOf(s.history.rated, id, mood);
      note(s, now === 0 ? `rating taken back: ${track.title}` : `${now > 0 ? "👍" : "👎"} ${track.title} for ${mood}`);
      // A song that doesn't fit goes now (the thumb is the verdict: no skip penalty on top).
      if (now < 0 && before >= 0 && playing) {
        if (s.dir.running) await run(s, () => apply(s, { type: "user-skip", now: Date.now(), quiet: true }));
        else await s.player?.next().catch((err) => onPlayerError(s, err));
      }
      break;
    }
    case "rateForget": {
      if (m.videoId && isMood(m.mood)) s.history.rated = (s.history.rated ?? []).filter((r) => !(r.track.videoId === m.videoId && r.mood === m.mood));
      else s.history.rated = [];
      saveHistory(s);
      break;
    }
    case "never": {
      const id = String(m.videoId ?? s.np?.videoId ?? "");
      if (!id) break;
      s.history.never = [...new Set([...s.history.never, id])].slice(-500);
      saveHistory(s);
      if (s.np?.videoId === id) await run(s, () => apply(s, { type: "user-skip", now: Date.now() }));
      break;
    }
    case "searchArtists": {
      try {
        const hits = await searchArtists(userId ?? "", String(m.q ?? ""), s.status === "connected" ? s.player : null);
        reply(userId, { type: "soundtrackResult", rid: m.rid, hits });
      } catch (err) {
        reply(userId, { type: "soundtrackResult", rid: m.rid, error: describe(err) });
      }
      return;
    }
    case "searchSongs": {
      try {
        const { taste } = await tasteFor(s, s.chatId);
        const songs = (await searchSongs(userId ?? "", String(m.q ?? ""), s.status === "connected" ? s.player : null)).map((t) => ({ ...t, artist: artistLine(t), banned: !!excluded(t, { ...taste, explicit: true, videos: true }, emptyHistory(), Date.now()) }));
        reply(userId, { type: "soundtrackResult", rid: m.rid, songs });
      } catch (err) {
        reply(userId, { type: "soundtrackResult", rid: m.rid, error: describe(err) });
      }
      return;
    }
    case "playSong": {
      // The player's own choice: it plays even if the artist is banned, and the Almanac steps back.
      const id = String(m.videoId ?? "");
      if (!/^[\w-]{6,20}$/.test(id) || !s.player) break;
      await run(s, async () => {
        try {
          await s.player!.playNow(id);
        } catch (err) {
          onPlayerError(s, err);
        }
      });
      schedulePoll(s, 1500);
      break;
    }
    case "lastfmKey": {
      // The player's own key, checked once, kept in the vault (never in the config file or the view).
      const key = String(m.key ?? "").trim();
      if (!/^[0-9a-f]{32}$/i.test(key)) {
        reply(userId, { type: "soundtrackResult", rid: m.rid, error: "A Last.fm API key is 32 letters and digits (0-9, a-f)." });
        return;
      }
      try {
        await checkKey(userId ?? "", key);
        await host.enclave.put(LASTFM_KEY, key, userId);
        s.lastfmKey = key;
        note(s, "Last.fm tags on");
        reply(userId, { type: "soundtrackResult", rid: m.rid, ok: true });
      } catch (err) {
        reply(userId, { type: "soundtrackResult", rid: m.rid, error: err instanceof LastfmError && err.badKey ? `Last.fm refused the key: ${err.message}` : `Couldn't reach Last.fm: ${describe(err)}` });
      }
      await push(s);
      return;
    }
    case "lastfmClear":
      await host.enclave.delete(LASTFM_KEY, userId).catch(() => false);
      s.lastfmKey = null;
      badKey.delete(userId ?? "");
      forgetTags(userId ?? "");
      note(s, "Last.fm tags off");
      break;
    case "clearCache":
      forgetPools(userId ?? "");
      note(s, "search cache cleared");
      break;
  }
  await push(s);
}

/** The mood the song now playing is for: the cue it was picked for, else the scene's. */
function moodPlaying(s: Session): string {
  return s.dir.current === s.np?.videoId && s.dir.playingCue && s.dir.origin !== "user" && s.dir.origin !== "autoplay" ? s.dir.playingCue.mood : s.dir.lastCue?.mood ?? s.cue?.mood ?? "";
}

function forgetCueKey(s: Session) {
  s.cueKey = "";
  if (s.chatId) void soundtrackChanged(s.chatId, s.userId, 0);
}

/** Debugging and tests: the session for a user. */
export const _sessionFor = (userId?: string) => sessions.get(userId ?? "");
