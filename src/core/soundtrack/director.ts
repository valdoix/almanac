// Soundtrack (design/11 §9–10): when the music changes. A pure state machine: events in, the new
// state and a list of actions out; the backend carries the actions out and reports back.
//
// The player belongs to the user. A song the user picked plays to the end; a pause stays paused.
// Bans hold for every song the Almanac or YouTube Music starts on its own (autoplay after a song
// ends), never for a song the user chose themselves.

import { cueDistance, sameScene, type Cue, type SceneMark } from "./cue";
import type { Mood } from "./moods";
import type { TrackArtist } from "./taste";

export interface NowPlaying {
  videoId: string;
  title: string;
  /** The artist line as the player shows it. */
  artist: string;
  artists?: TrackArtist[];
  album?: string;
  thumb?: string;
  isPaused: boolean;
  elapsedS: number;
  durationS: number;
}

export type Origin = "ours" | "ours-skip" | "autoplay" | "user";

export interface DirectorState {
  /** The player pressed Start (and not Stop). */
  running: boolean;
  mode: "following" | "holding" | "yielded";
  /** The cue the music now playing was picked for. */
  playingCue: Cue | null;
  /** The latest cue the story gave. */
  lastCue: Cue | null;
  /** A new mood waiting for a second reply before it changes the music. */
  pending: { mood: Mood; count: number } | null;
  /** Songs the Almanac queued (newest last). */
  ours: string[];
  current: string | null;
  /** Where the current song came from. */
  origin: Origin | null;
  lastElapsed: number;
  lastDuration: number;
  lastPaused: boolean;
  /** What the Almanac queued after the current song. */
  next: { videoId: string; cue: Cue } | null;
  /** A song the Almanac just started: its arrival isn't the user's doing. */
  expect: { videoId: string; cue: Cue; at: number } | null;
  startedAt: number;
  /** Hold lasts while this music scene does. */
  holdScene: number | null;
  /** Where and when the current music scene began (see sameScene), and its number. */
  scene: SceneMark | null;
  sceneId: number;
  /** A "pick" was sent and not answered yet (no second pick on top of it). */
  picking: number;
  /** The music scene that last turned to sex: only the first turn in a scene cuts in. */
  eroticScene?: number | null;
}

export type Action =
  | { type: "pick"; when: "now" | "next"; cue: Cue; reason: string; fade: boolean }
  | { type: "drop-next"; videoId: string }
  | { type: "skip"; reason: string; videoId: string }
  | { type: "replay-next"; videoId: string }
  | { type: "penalise"; videoId: string; mood: Mood };

export interface CueOptions {
  cutOnSharp: boolean;
  takeBack: boolean;
}

export type Event =
  | ({ type: "cue"; cue: Cue; now: number } & CueOptions)
  /** `banned`: why the song now playing may not play (the caller checks it against the taste), or null. */
  | { type: "poll"; np: NowPlaying | null; now: number; banned: string | null }
  | { type: "picked"; videoId: string; when: "now" | "next"; cue: Cue; now: number }
  | { type: "pick-failed"; now: number }
  | { type: "start"; now: number }
  | { type: "stop" }
  | { type: "hold"; on: boolean }
  | { type: "user-skip"; now: number };

export const CHANGE_AT = 0.35;
const TENSION_JUMP = 0.4;
const KEEP_AHEAD_S = 30;
/** A song that stopped within this many seconds of its end ended by itself. */
const END_SLACK_S = 12;
const SHARP_DWELL_MS = 20_000;
const PICK_TIMEOUT_MS = 45_000;

export function emptyDirector(): DirectorState {
  return {
    running: false, mode: "following", playingCue: null, lastCue: null, pending: null, ours: [], current: null, origin: null,
    lastElapsed: 0, lastDuration: 0, lastPaused: false, next: null, expect: null, startedAt: 0, holdScene: null, scene: null, sceneId: 0, picking: 0,
  };
}

const remember = (ours: string[], id: string) => [...ours.filter((x) => x !== id), id].slice(-40);

export function step(prev: DirectorState, ev: Event): { state: DirectorState; actions: Action[] } {
  const s: DirectorState = { ...prev };
  const actions: Action[] = [];
  const busy = (now: number) => s.picking > 0 && now - s.picking < PICK_TIMEOUT_MS;
  const pick = (when: "now" | "next", cue: Cue, reason: string, now: number, fade = false) => {
    if (busy(now)) return;
    if (when === "next" && s.next) actions.push({ type: "drop-next", videoId: s.next.videoId });
    if (when === "next") s.next = null;
    s.picking = now;
    actions.push({ type: "pick", when, cue, reason, fade });
  };

  switch (ev.type) {
    case "start": {
      s.running = true;
      s.mode = "following";
      s.pending = null;
      s.picking = 0;
      if (s.lastCue) pick("now", s.lastCue, "start", ev.now);
      break;
    }
    case "stop":
      s.running = false;
      s.picking = 0;
      if (s.next) actions.push({ type: "drop-next", videoId: s.next.videoId });
      s.next = null;
      break;

    case "hold":
      if (ev.on && s.current) {
        s.mode = "holding";
        s.holdScene = s.sceneId;
        if (s.next) actions.push({ type: "drop-next", videoId: s.next.videoId });
        s.next = null;
        s.ours = remember(s.ours, s.current);
      } else if (!ev.on && s.mode === "holding") {
        s.mode = "following";
        s.holdScene = null;
      }
      break;

    case "user-skip": {
      // Skip pressed on the Almanac's page: the next song for the same mood, and this one counts against itself.
      if (s.current && s.lastCue && s.origin !== "user") actions.push({ type: "penalise", videoId: s.current, mood: s.playingCue?.mood ?? s.lastCue.mood });
      if (s.mode === "holding") s.mode = "following";
      if (s.lastCue) pick("now", s.lastCue, "skipped", ev.now);
      break;
    }

    case "picked":
      s.picking = 0;
      s.ours = remember(s.ours, ev.videoId);
      if (ev.when === "now") s.expect = { videoId: ev.videoId, cue: ev.cue, at: ev.now };
      else s.next = { videoId: ev.videoId, cue: ev.cue };
      if (s.mode !== "holding" && ev.when === "now") s.mode = "following";
      break;

    case "pick-failed":
      s.picking = 0;
      break;

    case "poll": {
      const np = ev.np;
      if (!np || !np.videoId) {
        s.current = null;
        s.origin = null;
        s.lastPaused = false;
        break;
      }
      if (np.videoId !== s.current) {
        const prevOurs = !!s.current && s.origin !== "user" && s.ours.includes(s.current);
        const natural = !!s.current && !s.lastPaused && s.lastDuration > 0 && s.lastElapsed >= s.lastDuration - END_SLACK_S;
        let origin: Origin;
        if (s.expect?.videoId === np.videoId) origin = "ours";
        else if (s.next?.videoId === np.videoId || s.ours.includes(np.videoId)) origin = natural || !s.current ? "ours" : "ours-skip";
        else if (!s.current) origin = "user"; // the first song seen (the player was started by hand)
        else origin = natural ? "autoplay" : "user";

        if (origin === "ours-skip" && prevOurs && s.playingCue) actions.push({ type: "penalise", videoId: s.current!, mood: s.playingCue.mood });
        if (s.expect?.videoId === np.videoId) {
          s.playingCue = s.expect.cue;
          s.expect = null;
        } else if (s.next?.videoId === np.videoId) {
          s.playingCue = s.next.cue;
          s.next = null;
        }
        s.current = np.videoId;
        s.origin = origin;
        s.startedAt = ev.now;
        if (origin === "user") {
          if (s.mode !== "holding" || !s.ours.includes(np.videoId)) s.mode = "yielded";
        } else if (origin === "ours" || origin === "ours-skip") {
          if (s.mode !== "holding") s.mode = "following";
        }

        // The guard: a banned artist goes, unless the user chose the song themselves.
        if (s.running && ev.banned && origin !== "user") {
          // Our next song is queued: skipping lands on it. Otherwise play the scene's music in its place.
          if (!s.next && s.mode === "following" && s.lastCue && !busy(ev.now)) pick("now", s.lastCue, `skipped: ${ev.banned}`, ev.now);
          else actions.push({ type: "skip", reason: ev.banned, videoId: np.videoId });
        } else if (s.running && origin === "autoplay" && s.mode === "following" && !np.isPaused && s.lastCue) {
          // Our queue ran dry and YouTube Music filled it: put the scene's music back.
          pick("now", s.lastCue, "autoplay took over", ev.now);
        }
      }
      s.lastElapsed = np.elapsedS;
      s.lastDuration = np.durationS;
      s.lastPaused = np.isPaused;

      if (!s.running || np.isPaused) break;
      const left = np.durationS > 0 ? np.durationS - np.elapsedS : Infinity;
      if (s.mode === "holding") {
        if (s.holdScene != null && s.sceneId !== s.holdScene) {
          s.mode = "following";
          s.holdScene = null;
        } else if (!s.next && left <= KEEP_AHEAD_S && s.current) {
          actions.push({ type: "replay-next", videoId: s.current });
          s.next = { videoId: s.current, cue: s.playingCue ?? s.lastCue! };
          break;
        }
      }
      // Keep one song ahead, so YouTube Music's autoplay rarely gets a turn.
      if (s.mode === "following" && !s.next && !s.expect && left <= KEEP_AHEAD_S && (s.lastCue ?? s.playingCue)) pick("next", (s.lastCue ?? s.playingCue)!, "keeping the music going", ev.now);
      break;
    }

    case "cue": {
      const cue = ev.cue;
      const newScene = !sameScene(s.scene, cue);
      if (newScene) {
        s.scene = { place: cue.place, at: cue.at };
        s.sceneId++;
      }
      s.lastCue = cue;
      if (!s.running) break;
      if (s.mode === "holding") {
        if (s.sceneId === s.holdScene) break;
        s.mode = "following";
        s.holdScene = null;
      }
      if (s.mode === "yielded") {
        // The user's own music plays out; with "take back", the scene's music follows it at a new scene.
        if (ev.takeBack && newScene && s.sceneId > 1 && !s.next) pick("next", cue, "new scene: taking the music back", ev.now);
        break;
      }
      if (!s.current) {
        if (!s.lastPaused) pick("now", cue, "nothing playing", ev.now);
        break;
      }
      if (!s.playingCue) {
        pick("next", cue, "first cue", ev.now);
        break;
      }
      const d = cueDistance(s.playingCue, cue);
      const sceneChanged = newScene || !sameScene(s.playingCue, cue);
      const turnedOn = cue.mood === "erotic" && s.playingCue.mood !== "erotic" && s.eroticScene !== s.sceneId;
      if (cue.mood === "erotic") s.eroticScene = s.sceneId;
      const jump = cue.tension - s.playingCue.tension >= TENSION_JUMP || (cue.death && s.playingCue.mood !== "grief") || turnedOn;
      if (cue.sharp && jump && ev.cutOnSharp && !s.lastPaused && ev.now - s.startedAt >= SHARP_DWELL_MS) {
        s.pending = null;
        pick("now", cue, "sharp turn", ev.now, true);
        break;
      }
      if (d >= CHANGE_AT) {
        const held = s.pending?.mood === cue.mood && s.pending.count >= 1;
        if (sceneChanged || held || jump) {
          s.pending = null;
          if (!s.next || cueDistance(s.next.cue, cue) >= CHANGE_AT) pick("next", cue, sceneChanged ? "new scene" : "the mood changed", ev.now);
        } else {
          s.pending = { mood: cue.mood, count: s.pending?.mood === cue.mood ? s.pending.count + 1 : 1 };
        }
        break;
      }
      s.pending = null;
      // The mood went back (a swipe, a regenerate): a song queued for the other mood goes.
      if (s.next && cueDistance(s.next.cue, cue) >= CHANGE_AT) pick("next", cue, "the mood went back", ev.now);
      break;
    }
  }
  return { state: s, actions };
}
