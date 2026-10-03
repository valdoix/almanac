import { describe, expect, test } from "bun:test";
import { cueDistance, placeKey, readCue, sameScene, type Cue } from "../src/core/soundtrack/cue";
import { emptyDirector, step, type Action, type DirectorState, type Event, type NowPlaying } from "../src/core/soundtrack/director";
import { parseArtists, parseDuration, parseTracks } from "../src/core/soundtrack/innertube";
import { isMood, MOODS, MOOD_WORDS, MOOD_VEC, suggestGenres } from "../src/core/soundtrack/moods";
import { draw, emptyHistory, excluded, genresFor, queriesFor, scoreAll, type Candidate } from "../src/core/soundtrack/picker";
import { banReason, cleanTaste, creditsOf, DEFAULT_TASTE, mergeTaste, normName, preferredOf, type Taste, type Track } from "../src/core/soundtrack/taste";
import { emptyState } from "../src/core/state";
import { absMinutes } from "../src/core/util";
import { cleanTags, lookupTitle, retag, tagFit } from "../src/core/soundtrack/tags";
import { learnedFor, moodNear, rate, ratedPool, ratingBonus, ratingSummary, voteOf, type Rating } from "../src/core/soundtrack/ratings";
import type { WorldState } from "../src/core/types";

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

test("every mood has search words and a place on the meter", () => {
  for (const m of MOODS) {
    expect(MOOD_WORDS[m].length).toBeGreaterThan(0);
    expect(MOOD_VEC[m].length).toBe(4);
  }
  expect(isMood("dread")).toBe(true);
  expect(isMood("spooky")).toBe(false);
  expect(suggestGenres(["noir"]).length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// The cue
// ---------------------------------------------------------------------------

function state(over: Partial<WorldState> = {}): WorldState {
  return { ...emptyState(), time: { day: 1, minute: 14 * 60 } as any, sceneNo: 3, place: ["Sunnydale", "Revello Drive", "kitchen"], ...over } as WorldState;
}
const T0 = absMinutes({ day: 1, minute: 14 * 60 } as any);

test("the scene's mode sets the mood", () => {
  expect(readCue({ state: state({ mode: "downtime" }), genres: [] }).mood).toBe("calm");
  expect(readCue({ state: state({ mode: "social" }), genres: [] }).mood).toBe("warm");
  expect(readCue({ state: state({ mode: "investigation" }), genres: [] }).mood).toBe("mysterious");
  expect(readCue({ state: state({ mode: "crisis" }), genres: [] }).mood).toBe("dread");
  expect(readCue({ state: state({ mode: "social" }), genres: ["comedy"] }).mood).toBe("playful");
  expect(readCue({ state: state({ mode: "intimacy" }), genres: ["romance"] }).mood).toBe("romantic");
});

test("night, rain and a fight colour the cue", () => {
  const night = readCue({ state: state({ mode: "downtime", time: { day: 1, minute: 23 * 60 } as any }), genres: [] });
  expect(night.mood).toBe("dreamy");
  expect(night.colour).toContain("night");
  const rain = readCue({ state: state({ mode: "social", weather: { condition: "light rain" } as any }), genres: [] });
  expect(rain.mood).toBe("melancholy");
  expect(rain.colour).toContain("rain");
  const fight = readCue({ state: state({ mode: "conflict" }), genres: [], reply: "Spike lunges, and the knife flashes." });
  expect(fight.mood).toBe("combat");
  expect(fight.sharp).toBe(true);
  expect(fight.tension).toBeGreaterThan(0.8);
});

test("a death the reply filed turns the scene to grief, and it holds for that scene", () => {
  const died = state({ mode: "conflict", lastReply: 12, milestones: [{ at: null, msgIndex: 12, kind: "death", text: "Ben dies" }] } as any);
  const c = readCue({ state: died, genres: [] });
  expect(c.death).toBe(true);
  expect(c.mood).toBe("grief");
  expect(c.sharp).toBe(true);
  const grief = { place: c.place, at: c.at };
  const later = readCue({ state: state({ mode: "social", time: { day: 1, minute: 14 * 60 + 30 } as any }), genres: [], grief });
  expect(later.mood).toBe("grief");
  const elsewhere = readCue({ state: state({ mode: "social", place: ["Sunnydale", "the Bronze"] }), genres: [], grief });
  expect(elsewhere.mood).toBe("warm");
  const hoursOn = readCue({ state: state({ mode: "social", time: { day: 1, minute: 17 * 60 } as any }), genres: [], grief });
  expect(hoursOn.mood).toBe("warm");
});

test("the dead talked about in the prose are not a death", () => {
  const c = readCue({ state: state({ mode: "intimacy", lastReply: 40, milestones: [{ at: null, msgIndex: 12, kind: "death", text: "Ben dies" }] } as any), genres: [], reply: "Buffy has been dead before. She died on a tower, and the girl she was died with her." });
  expect(c.death).toBe(false);
  expect(c.mood).toBe("tender");
});

test("places key the music scene: who is where, where it's headed and the building fall away", () => {
  expect(placeKey(["Winters Residence", "guest room (Buffy) · hallway (Dawn) · kitchen (Gabriel ← returning)"])).toBe("guest room");
  expect(placeKey(["Winters Residence", "living room → hallway (moving toward guest room)"])).toBe("hallway");
  expect(placeKey(["kitchen, in Winters Residence"])).toBe("kitchen");
  expect(placeKey(["The Bronze"])).toBe("bronze");
  expect(placeKey([])).toBe("");
  expect(sameScene({ place: "kitchen", at: 100 }, { place: "kitchen", at: 170 })).toBe(true);
  expect(sameScene({ place: "kitchen", at: 100 }, { place: "kitchen", at: 200 })).toBe(false);
  expect(sameScene({ place: "kitchen", at: 100 }, { place: "hallway", at: 101 })).toBe(false);
  expect(sameScene(null, { place: "kitchen", at: 100 })).toBe(false);
});

test("a cozy story keeps tension low; the model's hint can't calm a fight", () => {
  const cozy = readCue({ state: state({ mode: "crisis" }), genres: ["cozy"] });
  expect(cozy.tension).toBeLessThanOrEqual(0.7);
  const hinted = readCue({ state: state({ mode: "social" }), genres: [], hint: { place: "kitchen", at: T0, mood: "hopeful", colour: ["harbour"] } });
  expect(hinted.mood).toBe("hopeful");
  expect(hinted.colour[0]).toBe("harbour");
  const stale = readCue({ state: state({ mode: "social" }), genres: [], hint: { place: "bronze", at: T0, mood: "hopeful", colour: [] } });
  expect(stale.mood).toBe("warm");
  const fight = readCue({ state: state({ mode: "conflict" }), genres: [], reply: "She draws her sword.", hint: { place: "kitchen", at: T0, mood: "calm", colour: [] } });
  expect(fight.mood).toBe("combat");
});

test("cue distance: same scene ~0, a fight far from a tavern", () => {
  const a = readCue({ state: state({ mode: "social" }), genres: [] });
  const b = readCue({ state: state({ mode: "social" }), genres: [] });
  const c = readCue({ state: state({ mode: "conflict" }), genres: [], reply: "He opens fire." });
  expect(cueDistance(a, b)).toBe(0);
  expect(cueDistance(a, c)).toBeGreaterThan(0.6);
});

// ---------------------------------------------------------------------------
// Taste and bans
// ---------------------------------------------------------------------------

const track = (videoId: string, title: string, artists: string | string[], over: Partial<Track> = {}): Track => ({
  videoId, title, artists: (Array.isArray(artists) ? artists : [artists]).map((name) => ({ name })), durationS: 200, explicit: false, kind: "song", ...over,
});

test("names normalise the way YouTube Music credits them", () => {
  expect(normName("Beyoncé - Topic")).toBe("beyonce");
  expect(normName("TaylorSwiftVEVO")).toBe("taylorswift");
  expect(normName("AC/DC")).toBe("ac dc");
});

test("a ban catches the artist in every credit, never a prefix", () => {
  const taste = { banned: [{ name: "Drake" }], bannedWords: ["nightcore"] };
  expect(banReason(track("a", "Song", "Drake"), taste)).toContain("Drake");
  expect(banReason(track("b", "Song", "Rihanna, Drake & Future"), taste)).toContain("Drake");
  expect(banReason(track("c", "Song (feat. Drake)", "Rihanna"), taste)).toContain("Drake");
  expect(banReason(track("d", "Song", "Nick Drake"), taste)).toBeNull();
  expect(banReason(track("e", "Song", "Drakeo the Ruler"), taste)).toBeNull();
  expect(banReason(track("f", "Song (Nightcore)", "Someone"), taste)).toContain("nightcore");
  // A whole act stays bannable even though "&" splits credits.
  expect(banReason(track("g", "The Boxer", "Simon & Garfunkel"), { banned: [{ name: "Simon & Garfunkel" }], bannedWords: [] })).not.toBeNull();
  // Ids match even when the names differ; names match even when the ids differ.
  expect(banReason({ title: "x", artists: [{ name: "Ye", id: "UC1" }] }, { banned: [{ name: "Kanye West", id: "UC1" }], bannedWords: [] })).not.toBeNull();
  expect(banReason({ title: "x", artists: [{ name: "Drake", id: "UC2" }] }, { banned: [{ name: "Drake", id: "UC9" }], bannedWords: [] })).not.toBeNull();
});

test("credits include the whole line, its parts and feat. in the title", () => {
  const names = creditsOf(track("a", "Song (ft. C)", "A & B")).map((a) => a.name);
  expect(names).toEqual(["A & B", "A", "B", "C"]);
});

test("a story's taste replaces genres and favourites; bans add up", () => {
  const global = cleanTaste({ genres: ["jazz"], preferred: [{ name: "Miles Davis" }], banned: [{ name: "X" }] });
  const m = mergeTaste(global, { genres: ["synthwave"], banned: [{ name: "Y" }] });
  expect(m.genres).toEqual(["synthwave"]);
  expect(m.preferred.map((a) => a.name)).toEqual(["Miles Davis"]);
  expect(m.banned.map((a) => a.name).sort()).toEqual(["X", "Y"]);
  expect(cleanTaste({ variety: "bogus", vocals: "instrumental" }).variety).toBe("balanced");
  expect(cleanTaste({ vocals: "instrumental" }).vocals).toBe("instrumental");
  expect(preferredOf(track("a", "x", "Miles Davis & John Coltrane"), global)?.name).toBe("Miles Davis");
});

// ---------------------------------------------------------------------------
// InnerTube
// ---------------------------------------------------------------------------

const artistRun = (name: string, id: string) => ({ text: name, navigationEndpoint: { browseEndpoint: { browseId: id, browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" } } } } });
const albumRun = (name: string) => ({ text: name, navigationEndpoint: { browseEndpoint: { browseId: "MPRE1", browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ALBUM" } } } } });
const listItem = (videoId: string, title: string, runs: any[], mvt = "MUSIC_VIDEO_TYPE_ATV", explicit = false) => ({
  musicResponsiveListItemRenderer: {
    playlistItemData: { videoId },
    overlay: { musicItemThumbnailOverlayRenderer: { content: { musicPlayButtonRenderer: { playNavigationEndpoint: { watchEndpoint: { videoId, watchEndpointMusicSupportedConfigs: { watchEndpointMusicConfig: { musicVideoType: mvt } } } } } } } },
    flexColumns: [
      { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: title }] } } },
      { musicResponsiveListItemFlexColumnRenderer: { text: { runs } } },
    ],
    ...(explicit ? { badges: [{ musicInlineBadgeRenderer: { icon: { iconType: "MUSIC_EXPLICIT_BADGE" } } }] } : {}),
    thumbnail: { musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url: "s" }, { url: "big" }] } } },
  },
});
const SEARCH = {
  contents: { tabbedSearchResultsRenderer: { tabs: [{ tabRenderer: { content: { sectionListRenderer: { contents: [{ musicShelfRenderer: { contents: [
    listItem("vid00000001", "Nights", [artistRun("Frank Ocean", "UCfo"), { text: " • " }, albumRun("Blonde"), { text: " • " }, { text: "5:07" }], "MUSIC_VIDEO_TYPE_ATV", true),
    listItem("vid00000002", "Midnight City", [{ text: "Song" }, { text: " • " }, artistRun("M83", "UCm83"), { text: " • " }, { text: "4:04" }]),
    listItem("vid00000003", "Some Upload", [{ text: "Video" }, { text: " • " }, { text: "Random Uploader" }, { text: " • " }, { text: "1.2M views" }, { text: " • " }, { text: "3:00" }], "MUSIC_VIDEO_TYPE_UGC"),
    listItem("vid00000001", "Nights (again)", [artistRun("Frank Ocean", "UCfo")]),
  ] } }] } } } }] } },
};

test("search results parse into tracks with credits, album, length and kind", () => {
  const tracks = parseTracks(SEARCH);
  expect(tracks.map((t) => t.videoId)).toEqual(["vid00000001", "vid00000002", "vid00000003"]);
  const [a, b, c] = tracks;
  expect(a.artists).toEqual([{ name: "Frank Ocean", id: "UCfo" }]);
  expect(a.album).toBe("Blonde");
  expect(a.durationS).toBe(307);
  expect(a.explicit).toBe(true);
  expect(a.kind).toBe("song");
  expect(a.thumb).toBe("big");
  expect(b.artists[0].name).toBe("M83");
  expect(c.kind).toBe("video");
  expect(c.artists[0].name).toBe("Random Uploader");
  expect(parseDuration("1:02:03")).toBe(3723);
  expect(parseTracks({ nothing: [1, 2, { here: null }] })).toEqual([]);
});

test("artist search parses names and channel ids", () => {
  const json = { a: [{ musicResponsiveListItemRenderer: {
    navigationEndpoint: { browseEndpoint: { browseId: "UCabc", browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" } } } },
    flexColumns: [{ musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Hozier" }] } } }, { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Artist • 5M subscribers" }] } } }],
  } }] };
  expect(parseArtists(json)).toEqual([{ name: "Hozier", id: "UCabc", thumb: undefined, subtitle: "Artist • 5M subscribers" }]);
});

// ---------------------------------------------------------------------------
// The picker
// ---------------------------------------------------------------------------

/** A cue; `sceneNo` picks the spot ("room1", "room2"…) so tests can move the scene. */
const cueOf = (over: Partial<Cue> = {}): Cue => {
  const sceneNo = over.sceneNo ?? 2;
  return { mood: "tense", energy: 0.7, valence: -0.4, tension: 0.8, intimacy: 0.1, colour: ["rain"], sharp: false, death: false, heat: 0, explicit: false, sceneNo, place: `room${sceneNo}`, at: 1000, why: "tense", ...over };
};

test("genres: strict keeps mine; blend or none fills from the story", () => {
  expect(genresFor({ ...DEFAULT_TASTE, genres: ["jazz"], genreMode: "strict" }, ["noir"])).toEqual(["jazz"]);
  const blend = genresFor({ ...DEFAULT_TASTE, genres: ["jazz"] }, ["noir"]);
  expect(blend[0]).toBe("jazz");
  expect(blend.length).toBeGreaterThan(1);
  expect(genresFor(DEFAULT_TASTE, ["noir"])).toEqual(suggestGenres(["noir"]));
});

test("queries: the lead genre with the mood word, colour in the others, favourites added", () => {
  const taste: Taste = { ...DEFAULT_TASTE, genres: ["synthwave", "darkwave", "industrial", "ambient"], genreMode: "strict", preferred: [{ name: "Perturbator" }] };
  const qs = queriesFor(cueOf(), taste, []);
  expect(qs[0].q.startsWith("synthwave ")).toBe(true);
  expect(qs[0].rank).toBe(0);
  expect(qs.filter((q) => !q.artist).length).toBe(3);
  expect(qs.some((q) => q.q.includes("rain"))).toBe(true);
  expect(qs.some((q) => q.artist === "Perturbator")).toBe(true);
  const inst = queriesFor(cueOf(), { ...taste, vocals: "instrumental" }, []);
  expect(inst.every((q) => q.artist || q.q.endsWith("instrumental"))).toBe(true);
});

test("hard filters: bans, never, explicit, videos, length, repeats, same artist", () => {
  const taste: Taste = { ...DEFAULT_TASTE, banned: [{ name: "Bad" }], explicit: false };
  const h = { ...emptyHistory(), never: ["n"], chat: ["r"], recent: { z: 1000 }, lastArtist: "same" };
  const now = 1000 + 60_000;
  expect(excluded(track("a", "x", "Bad"), taste, h, now)).toContain("banned");
  expect(excluded(track("n", "x", "Ok"), taste, h, now)).toBe("never this song");
  expect(excluded(track("e", "x", "Ok", { explicit: true }), taste, h, now)).toBe("explicit");
  expect(excluded(track("v", "x", "Ok", { kind: "video" }), taste, h, now)).toBe("music video");
  expect(excluded(track("l", "x", "Ok", { durationS: 60 }), taste, h, now)).toBe("length");
  expect(excluded(track("r", "x", "Ok"), taste, h, now)).toContain("this chat");
  expect(excluded(track("z", "x", "Ok"), taste, h, now)).toContain("two hours");
  expect(excluded(track("s", "x", "Same"), taste, h, now)).toContain("same artist");
  expect(excluded(track("s", "x", "Same"), { ...taste, variety: "focused" }, h, now)).toBeNull();
  expect(excluded(track("ok", "x", "Fine"), taste, h, now)).toBeNull();
});

test("scoring: favourites and the lead genre rise, skipped songs sink, the draw is seeded", () => {
  const taste: Taste = { ...DEFAULT_TASTE, preferred: [{ name: "Fav" }] };
  const lead = { q: "a", key: "a", genre: "jazz", rank: 0 };
  const other = { q: "b", key: "b", genre: "funk", rank: 2 };
  const cands: Candidate[] = [
    { track: track("t1", "One", "Someone"), query: other, pos: 0 },
    { track: track("t2", "Two", "Fav"), query: other, pos: 3 },
    { track: track("t3", "Three", "Else"), query: lead, pos: 1 },
    { track: track("t4", "Four", "Skipped"), query: lead, pos: 0 },
  ];
  const h = { ...emptyHistory(), skips: { "tense|t4": 2 } };
  const scored = scoreAll(cands, cueOf(), taste, h, { now: Date.now(), seed: "" });
  const order = scored.map((s) => s.track.videoId);
  expect(order.indexOf("t3")).toBeLessThan(order.indexOf("t4"));
  expect(scored.find((s) => s.track.videoId === "t2")!.reasons.join()).toContain("preferred Fav");
  expect(draw(scored, "seed")!.track.videoId).toBe(draw(scored, "seed")!.track.videoId);
  expect(draw([], "x")).toBeNull();
  const picks = new Set(Array.from({ length: 40 }, (_, i) => draw(scored, `s${i}`)!.track.videoId));
  expect(picks.size).toBeGreaterThan(1);
});

// ---------------------------------------------------------------------------
// The director
// ---------------------------------------------------------------------------

const np = (videoId: string, elapsedS = 10, over: Partial<NowPlaying> = {}): NowPlaying => ({ videoId, title: videoId, artist: "A", isPaused: false, elapsedS, durationS: 200, ...over });
const opts = { cutOnSharp: true, takeBack: true };

function run(events: Event[], s0: DirectorState = emptyDirector()) {
  let s = s0;
  const all: Action[][] = [];
  for (const ev of events) {
    const r = step(s, ev);
    s = r.state;
    all.push(r.actions);
  }
  return { s, all };
}

test("start with nothing playing: the scene's music starts now", () => {
  const cue = cueOf();
  const { s, all } = run([{ type: "cue", cue, now: 0, ...opts }, { type: "start", now: 1 }]);
  expect(all[1]).toEqual([{ type: "pick", when: "now", cue, reason: "start", fade: false }]);
  expect(s.picking).toBe(1);
  // A second request while the pick is out does nothing.
  expect(step(s, { type: "user-skip", now: 2 }).actions.filter((a) => a.type === "pick")).toEqual([]);
});

test("our song arrives as ours; a scene change queues the next; the end of a song plays it", () => {
  const c1 = cueOf({ mood: "calm", energy: 0.2, valence: 0.3, tension: 0.1, intimacy: 0.2, sceneNo: 1 });
  let { s } = run([{ type: "cue", cue: c1, now: 0, ...opts }, { type: "start", now: 1 }, { type: "picked", videoId: "s1", when: "now", cue: c1, now: 2 }, { type: "poll", np: np("s1"), now: 3, banned: null }]);
  expect(s.origin).toBe("ours");
  expect(s.playingCue).toBe(c1);
  // Same scene, mood a little off: nothing.
  const c1b = { ...c1, energy: 0.25 };
  expect(step(s, { type: "cue", cue: c1b, now: 4, ...opts }).actions).toEqual([]);
  // A new scene, a far mood: the next song is picked for it (not cut in).
  const c2 = cueOf({ sceneNo: 2 });
  const r = step(s, { type: "cue", cue: c2, now: 5, ...opts });
  expect(r.actions).toEqual([{ type: "pick", when: "next", cue: c2, reason: "new scene", fade: false }]);
  s = step(r.state, { type: "picked", videoId: "s2", when: "next", cue: c2, now: 6 }).state;
  expect(s.next?.videoId).toBe("s2");
  // s1 ends by itself, s2 plays: ours.
  s = step(s, { type: "poll", np: np("s1", 195), now: 7, banned: null }).state;
  s = step(s, { type: "poll", np: np("s2", 1), now: 8, banned: null }).state;
  expect(s.origin).toBe("ours");
  expect(s.playingCue).toBe(c2);
  expect(s.next).toBeNull();
});

test("a new mood in the same scene waits for a second reply", () => {
  const c1 = cueOf({ mood: "calm", energy: 0.2, valence: 0.3, tension: 0.1, intimacy: 0.2, sceneNo: 1 });
  let { s } = run([{ type: "cue", cue: c1, now: 0, ...opts }, { type: "start", now: 1 }, { type: "picked", videoId: "s1", when: "now", cue: c1, now: 2 }, { type: "poll", np: np("s1"), now: 3, banned: null }]);
  const c2 = cueOf({ mood: "melancholy", energy: 0.25, valence: -0.4, tension: 0.25, intimacy: 0.4, sceneNo: 1 });
  const r1 = step(s, { type: "cue", cue: c2, now: 4, ...opts });
  expect(r1.actions).toEqual([]);
  const r2 = step(r1.state, { type: "cue", cue: c2, now: 5, ...opts });
  expect(r2.actions[0]).toMatchObject({ type: "pick", when: "next", reason: "the mood changed" });
});

test("a sharp turn cuts in with a fade, after the song has had 20 s", () => {
  const c1 = cueOf({ mood: "warm", energy: 0.4, valence: 0.5, tension: 0.15, intimacy: 0.3, sceneNo: 1 });
  let { s } = run([{ type: "cue", cue: c1, now: 0, ...opts }, { type: "start", now: 1 }, { type: "picked", videoId: "s1", when: "now", cue: c1, now: 2 }, { type: "poll", np: np("s1"), now: 3, banned: null }]);
  const fight = cueOf({ mood: "combat", tension: 0.95, sharp: true, sceneNo: 1 });
  expect(step(s, { type: "cue", cue: fight, now: 10_000, ...opts }).actions[0]).toMatchObject({ when: "next" });
  expect(step(s, { type: "cue", cue: fight, now: 30_000, ...opts }).actions).toEqual([{ type: "pick", when: "now", cue: fight, reason: "sharp turn", fade: true }]);
  expect(step(s, { type: "cue", cue: fight, now: 30_000, cutOnSharp: false, takeBack: true }).actions[0]).toMatchObject({ when: "next" });
});

test("the guard: a banned autoplay song is replaced; the user's own pick plays", () => {
  const c1 = cueOf({ sceneNo: 1 });
  let { s } = run([{ type: "cue", cue: c1, now: 0, ...opts }, { type: "start", now: 1 }, { type: "picked", videoId: "s1", when: "now", cue: c1, now: 2 }, { type: "poll", np: np("s1"), now: 3, banned: null }]);
  // s1 ends; autoplay starts a banned song: the scene's music goes in its place (no skip on top).
  const ending = step(s, { type: "poll", np: np("s1", 195), now: 4, banned: null });
  // (The keep-ahead pick near the end found nothing.)
  expect(ending.actions[0]).toMatchObject({ type: "pick", when: "next" });
  s = step(ending.state, { type: "pick-failed", now: 4 }).state;
  const r = step(s, { type: "poll", np: np("bad", 1), now: 5, banned: "banned artist Bad" });
  expect(r.state.origin).toBe("autoplay");
  expect(r.actions).toEqual([{ type: "pick", when: "now", cue: c1, reason: "skipped: banned artist Bad", fade: false }]);
  // With our next song queued, the guard skips onto it instead.
  const queued = { ...s, next: { videoId: "s2", cue: c1 } };
  expect(step(queued, { type: "poll", np: np("bad", 1), now: 5, banned: "banned artist Bad" }).actions).toEqual([{ type: "skip", reason: "banned artist Bad", videoId: "bad" }]);
  // The user jumps to a banned song mid-track: it plays, and the Almanac steps back.
  const u = step(s, { type: "poll", np: np("bad2", 1), now: 6, banned: "banned artist Bad" });
  // (s1 was at 195 of 200, which counts as its end: use a mid-song state for the jump.)
  const mid = step(step(s, { type: "poll", np: np("s1", 60), now: 6, banned: null }).state, { type: "poll", np: np("bad3", 1), now: 7, banned: "banned artist Bad" });
  expect(mid.state.origin).toBe("user");
  expect(mid.state.mode).toBe("yielded");
  expect(mid.actions).toEqual([]);
  expect(u.state.origin).toBe("autoplay");
});

test("yielded: the user's music plays out; a new scene queues the scene's music after it", () => {
  const c1 = cueOf({ sceneNo: 1 });
  let { s } = run([{ type: "cue", cue: c1, now: 0, ...opts }, { type: "start", now: 1 }, { type: "picked", videoId: "s1", when: "now", cue: c1, now: 2 }, { type: "poll", np: np("s1", 30), now: 3, banned: null }, { type: "poll", np: np("mine", 1), now: 4, banned: null }]);
  expect(s.mode).toBe("yielded");
  expect(step(s, { type: "cue", cue: { ...c1, mood: "calm" }, now: 5, ...opts }).actions).toEqual([]);
  const c2 = cueOf({ sceneNo: 2 });
  expect(step(s, { type: "cue", cue: c2, now: 6, ...opts }).actions).toEqual([{ type: "pick", when: "next", cue: c2, reason: "new scene: taking the music back", fade: false }]);
  expect(step(s, { type: "cue", cue: c2, now: 6, cutOnSharp: true, takeBack: false }).actions).toEqual([]);
});

test("the music never stops on its own: a song that ends with nothing after it is followed by another", () => {
  const c1 = cueOf({ sceneNo: 1 });
  const { s } = run([{ type: "cue", cue: c1, now: 0, ...opts }, { type: "start", now: 1 }, { type: "picked", videoId: "s1", when: "now", cue: c1, now: 2 }, { type: "poll", np: np("s1", 30), now: 3, banned: null }]);
  // The queue ran out: the player stopped at the end of the song.
  const end = step(s, { type: "poll", np: np("s1", 199, { isPaused: true }), now: 40_000, banned: null });
  expect(end.actions).toEqual([{ type: "pick", when: "now", cue: c1, reason: "the song ended", fade: false }]);
  // A pause mid-song stays paused.
  expect(step(s, { type: "poll", np: np("s1", 120, { isPaused: true }), now: 40_000, banned: null }).actions).toEqual([]);
  // Nothing loaded at all.
  expect(step(s, { type: "poll", np: null, now: 40_000, banned: null }).actions).toEqual([{ type: "pick", when: "now", cue: c1, reason: "nothing playing", fade: false }]);
  // Stopped: quiet.
  expect(step({ ...s, running: false }, { type: "poll", np: np("s1", 199, { isPaused: true }), now: 40_000, banned: null }).actions).toEqual([]);
  // A pick that found nothing isn't retried every poll.
  const failed = step(step(end.state, { type: "pick-failed", now: 41_000 }).state, { type: "poll", np: np("s1", 199, { isPaused: true }), now: 50_000, banned: null });
  expect(failed.actions).toEqual([]);
  expect(step(failed.state, { type: "poll", np: np("s1", 199, { isPaused: true }), now: 110_000, banned: null }).actions).toHaveLength(1);
  // The user's own song ran out too: the scene's music follows it.
  const mine = step(s, { type: "poll", np: np("mine", 1), now: 30_000, banned: null }).state;
  expect(mine.mode).toBe("yielded");
  const after = step(mine, { type: "poll", np: np("mine", 200, { isPaused: true }), now: 300_000, banned: null });
  expect(after.actions).toEqual([{ type: "pick", when: "now", cue: c1, reason: "the song ended", fade: false }]);
  expect(after.state.mode).toBe("following");
  // A reply while it's stopped at the end starts the music now, not after the dead song.
  const c2 = { ...c1, mood: "calm" as const };
  expect(step({ ...end.state, picking: 0 }, { type: "cue", cue: c2, now: 41_000, ...opts }).actions).toEqual([{ type: "pick", when: "now", cue: c2, reason: "nothing playing", fade: false }]);
});

test("only the Almanac's picks: the user's song plays out, then the scene's music, never YouTube Music's mix", () => {
  const c1 = cueOf({ sceneNo: 1 });
  const { s } = run([{ type: "cue", cue: c1, now: 0, ...opts }, { type: "start", now: 1 }, { type: "picked", videoId: "s1", when: "now", cue: c1, now: 2 }, { type: "poll", np: np("s1", 30), now: 3, banned: null }, { type: "poll", np: np("mine", 1), now: 4, banned: null }]);
  expect(s.mode).toBe("yielded");
  // Near the end of the user's song: by default YouTube Music carries on; with onlyPicks one of ours is queued behind it.
  expect(step(s, { type: "poll", np: np("mine", 180), now: 5, banned: null }).actions).toEqual([]);
  expect(step(s, { type: "poll", np: np("mine", 180), now: 5, banned: null, onlyPicks: true }).actions).toEqual([{ type: "pick", when: "next", cue: c1, reason: "keeping the music going", fade: false }]);
  // The mix got in anyway (the user's song ended naturally): it's replaced at once.
  const ending = step(s, { type: "poll", np: np("mine", 195), now: 6, banned: null }).state;
  expect(step(ending, { type: "poll", np: np("mix", 1), now: 7, banned: null }).actions).toEqual([]);
  const strict = step({ ...ending, picking: 0 }, { type: "poll", np: np("mix", 1), now: 7, banned: null, onlyPicks: true });
  expect(strict.state.origin).toBe("autoplay");
  expect(strict.actions).toEqual([{ type: "pick", when: "now", cue: c1, reason: "your song ended", fade: false }]);
  // A song the user jumps to in YouTube Music still plays.
  const jumped = step(s, { type: "poll", np: np("mine2", 1), now: 8, banned: null, onlyPicks: true });
  expect(jumped.state.origin).toBe("user");
  expect(jumped.actions).toEqual([]);
});

test("skipping our song early counts against it; hold replays until the scene changes", () => {
  const c1 = cueOf({ sceneNo: 1 });
  let { s } = run([{ type: "cue", cue: c1, now: 0, ...opts }, { type: "start", now: 1 }, { type: "picked", videoId: "s1", when: "now", cue: c1, now: 2 }, { type: "poll", np: np("s1", 30), now: 3, banned: null }, { type: "picked", videoId: "s2", when: "next", cue: c1, now: 4 }]);
  const skipped = step(s, { type: "poll", np: np("s2", 1), now: 5, banned: null });
  expect(skipped.state.origin).toBe("ours-skip");
  expect(skipped.actions).toContainEqual({ type: "penalise", videoId: "s1", mood: "tense" });
  // Hold: near the end the same song is queued again.
  s = step(s, { type: "hold", on: true }).state;
  expect(s.mode).toBe("holding");
  const near = step(s, { type: "poll", np: np("s1", 180), now: 6, banned: null });
  expect(near.actions).toContainEqual({ type: "replay-next", videoId: "s1" });
  // A new scene releases it.
  const released = step(s, { type: "cue", cue: cueOf({ sceneNo: 2 }), now: 7, ...opts });
  expect(released.state.mode).toBe("following");
});

test("near the end of a song one more is queued, so autoplay rarely gets a turn", () => {
  const c1 = cueOf({ sceneNo: 1 });
  const { s } = run([{ type: "cue", cue: c1, now: 0, ...opts }, { type: "start", now: 1 }, { type: "picked", videoId: "s1", when: "now", cue: c1, now: 2 }, { type: "poll", np: np("s1", 30), now: 3, banned: null }]);
  expect(step(s, { type: "poll", np: np("s1", 100), now: 4, banned: null }).actions).toEqual([]);
  expect(step(s, { type: "poll", np: np("s1", 175), now: 4, banned: null }).actions).toEqual([{ type: "pick", when: "next", cue: c1, reason: "keeping the music going", fade: false }]);
  expect(step(s, { type: "poll", np: np("s1", 175, { isPaused: true }), now: 4, banned: null }).actions).toEqual([]);
  expect(step({ ...s, running: false }, { type: "poll", np: np("s1", 175), now: 4, banned: null }).actions).toEqual([]);
});

test("stop drops the queued song and picks nothing more", () => {
  const c1 = cueOf({ sceneNo: 1 });
  const { s } = run([{ type: "cue", cue: c1, now: 0, ...opts }, { type: "start", now: 1 }, { type: "picked", videoId: "s1", when: "next", cue: c1, now: 2 }]);
  const r = step(s, { type: "stop" });
  expect(r.actions).toEqual([{ type: "drop-next", videoId: "s1" }]);
  expect(step(r.state, { type: "cue", cue: cueOf({ sceneNo: 5 }), now: 3, ...opts }).actions).toEqual([]);
});

// ---------------------------------------------------------------------------
// Intimate scenes and what the people present feel
// ---------------------------------------------------------------------------

describe("soundtrack heat and feelings", () => {
  const person = (name: string, mood: string, msg: number, over: any = {}) => ({ id: name.toLowerCase(), name, aliases: [], slot: 1, isUser: false, firstSeen: 0, lastSeen: msg, tier: "spot", meters: {}, flags: [], injuries: [], mood: { name: mood, msg }, ...over });
  const withPeople = (mode: string, ...people: any[]) => state({ mode, lastReply: 20, chars: Object.fromEntries(people.map((p) => [p.id, p])) } as any);
  const SEX = "She rides him slowly, his hands on her breasts, and he thrusts up into her until she comes apart.";
  const KISS = "He kisses her, slow. Her breath hitches; she straddles him on the sofa and his hand finds the hem of her shirt.";

  test("a hug is tender, a kiss that builds is sensual, sex on the page is erotic", () => {
    expect(readCue({ state: state({ mode: "intimacy" }), genres: [], reply: "She leans into his shoulder and he holds her while she cries." }).mood).toBe("tender");
    const kiss = readCue({ state: state({ mode: "intimacy" }), genres: [], reply: KISS });
    expect(kiss.mood).toBe("sensual");
    expect(kiss.heat).toBe(1);
    const sex = readCue({ state: state({ mode: "intimacy" }), genres: ["romance"], reply: SEX });
    expect(sex.mood).toBe("erotic");
    expect(sex.heat).toBe(2);
    expect(sex.explicit).toBe(true);
    expect(sex.sharp).toBe(true);
    expect(sex.intimacy).toBe(1);
  });

  test("two explicit words and a character filed as wanting is sex; the player's message counts", () => {
    const st = withPeople("intimacy", person("Buffy", "wanton-brave", 20));
    const msg = `"I want to make you come," he says, thumb on her nipple.`;
    expect(readCue({ state: st, genres: [], playerMsg: msg, reply: "She arches." }).mood).toBe("erotic");
    expect(readCue({ state: state({ mode: "intimacy" }), genres: [], playerMsg: msg, reply: "She arches." }).mood).toBe("sensual");
  });

  test("the plan, the ledger and a running joke about moaning at soup are not the page", () => {
    const plan = "<plan>The kiss is the turn's climax; stop at its threshold. No orgasm, no thrusting.</plan>She smiles at him over the soup.";
    expect(readCue({ state: state({ mode: "intimacy" }), genres: [], reply: plan }).heat).toBe(0);
    const ledger = "He holds her hand.\n<ledger>\nbody Buffy: arousal 4, naked, thrusting\nmode: intimacy\n</ledger>";
    expect(readCue({ state: state({ mode: "intimacy" }), genres: [], reply: ledger }).heat).toBe(0);
    const soup = `Gabriel moans at the eggs. "You moan at everything," Dawn says. "You moaned at soup. You moaned at the mac and cheese." He moans again.`;
    expect(readCue({ state: state({ mode: "social" }), genres: ["comedy"], reply: soup }).mood).toBe("playful");
  });

  test("intimacy off or fading to black gets desire at most, and no explicit songs", () => {
    for (const nsfw of ["off", "fade"]) {
      const c = readCue({ state: state({ mode: "intimacy" }), genres: [], reply: SEX, nsfw });
      expect(c.mood).toBe("sensual");
      expect(c.explicit).toBe(false);
    }
    const sensual = readCue({ state: state({ mode: "intimacy" }), genres: [], reply: SEX, nsfw: "sensual" });
    expect(sensual.mood).toBe("erotic");
    expect(sensual.explicit).toBe(false);
  });

  test("sex filed under another mode counts when the page is unmistakable, never in a fight", () => {
    const strong = "Naked on the couch, she rides him, his cock inside her, thrusting until her orgasm.";
    expect(readCue({ state: state({ mode: "social" }), genres: [], reply: strong }).mood).toBe("erotic");
    expect(readCue({ state: state({ mode: "conflict" }), genres: [], reply: strong }).mood).not.toBe("erotic");
  });

  test("a breath between rounds stays the scene's music; a new scene doesn't", () => {
    const heated = { place: "kitchen", at: T0 };
    expect(readCue({ state: state({ mode: "intimacy" }), genres: [], reply: KISS, heated }).mood).toBe("erotic");
    expect(readCue({ state: state({ mode: "intimacy" }), genres: [], reply: "They lie still and talk about nothing.", heated }).mood).not.toBe("erotic");
    expect(readCue({ state: state({ mode: "intimacy", place: ["Sunnydale", "bedroom"] }), genres: [], reply: KISS, heated }).mood).toBe("sensual");
  });

  test("the model's once-a-scene reading can't hold back a scene that turned to sex", () => {
    const hint = { place: "kitchen", at: T0, mood: "tender" as const, colour: [] };
    expect(readCue({ state: state({ mode: "intimacy" }), genres: [], reply: SEX, hint }).mood).toBe("erotic");
    expect(readCue({ state: state({ mode: "intimacy" }), genres: [], reply: KISS, hint }).mood).toBe("sensual");
    expect(readCue({ state: state({ mode: "intimacy" }), genres: [], reply: "He holds her.", hint }).mood).toBe("tender");
  });

  test("what people feel moves a plain scene: grief at breakfast, giddy in the rain; one flustered word doesn't", () => {
    expect(readCue({ state: withPeople("social", person("Buffy", "guilt-grief", 20)), genres: ["comedy"] }).mood).toBe("melancholy");
    expect(readCue({ state: withPeople("downtime", person("Dawn", "terror", 19), person("Buffy", "afraid-angry", 20)), genres: [] }).mood).toBe("tense");
    expect(readCue({ state: withPeople("social", person("Buffy", "defensive-panicked", 20)), genres: ["comedy"] }).mood).toBe("playful");
    const rain = { condition: "light rain" } as any;
    expect(readCue({ state: { ...withPeople("social", person("Dawn", "giddy", 20)), weather: rain }, genres: [] }).mood).toBe("warm");
    expect(readCue({ state: { ...withPeople("social"), weather: rain }, genres: [] }).mood).toBe("melancholy");
    // A mood filed long ago is not what they feel now.
    expect(readCue({ state: withPeople("social", person("Valeria", "grief", 4)), genres: ["comedy"] }).mood).toBe("playful");
  });

  test("a sex scene searches its own music unless the taste is strict, and explicit songs rise", () => {
    const sex = cueOf({ mood: "erotic", heat: 2, explicit: true, intimacy: 1 });
    const blend = queriesFor(sex, { ...DEFAULT_TASTE, genres: ["film score"] }, ["fantasy"]);
    expect(blend.some((q) => q.rank === 0 && /^(r&b|slow jams|neo soul) /.test(q.q))).toBe(true);
    const strict = queriesFor(sex, { ...DEFAULT_TASTE, genres: ["film score"], genreMode: "strict" }, ["fantasy"]);
    expect(strict.every((q) => q.q.startsWith("film score"))).toBe(true);
    // A taste that already plays R&B isn't searched twice.
    expect(queriesFor(sex, { ...DEFAULT_TASTE, genres: ["r&b"], genreMode: "strict" }, []).length).toBe(1);

    const q = { q: "r&b sexy", key: "k", genre: "r&b", rank: 0 };
    const cands: Candidate[] = [
      { track: track("clean", "Slow Motion", "A"), query: q, pos: 0 },
      { track: track("x", "Slow Motion (Explicit)", "B", { explicit: true }), query: q, pos: 1 },
      { track: track("lull", "Lullaby for You", "C"), query: q, pos: 0 },
    ];
    const order = scoreAll(cands, sex, DEFAULT_TASTE, emptyHistory(), { now: Date.now(), seed: "" }).map((s) => s.track.videoId);
    expect(order[0]).toBe("x");
    expect(order[2]).toBe("lull");
    // Without sex on the page the explicit one gets no help.
    const tender = scoreAll(cands, cueOf({ mood: "tender" }), DEFAULT_TASTE, emptyHistory(), { now: Date.now(), seed: "" }).map((s) => s.track.videoId);
    expect(tender.indexOf("clean")).toBeLessThan(tender.indexOf("x"));
    // ...and a lullaby fits a tender scene.
    expect(tender[0]).toBe("lull");
  });

  test("a scene turning to sex cuts in with a fade, once per music scene", () => {
    const c1 = cueOf({ mood: "romantic", energy: 0.35, valence: 0.6, tension: 0.3, intimacy: 0.85, sceneNo: 1 });
    const { s } = run([{ type: "cue", cue: c1, now: 0, ...opts }, { type: "start", now: 1 }, { type: "picked", videoId: "s1", when: "now", cue: c1, now: 2 }, { type: "poll", np: np("s1"), now: 3, banned: null }]);
    const sex = cueOf({ mood: "erotic", energy: 0.6, valence: 0.5, tension: 0.6, intimacy: 1, sharp: true, heat: 2, sceneNo: 1 });
    const r = step(s, { type: "cue", cue: sex, now: 30_000, ...opts });
    expect(r.actions).toEqual([{ type: "pick", when: "now", cue: sex, reason: "sharp turn", fade: true }]);
    // It cooled to romantic and the song now playing was picked for that; heating up again in the same scene doesn't cut.
    const again = step({ ...r.state, picking: 0, playingCue: c1 }, { type: "cue", cue: sex, now: 90_000, ...opts });
    expect(again.actions.some((a) => a.type === "pick" && a.when === "now")).toBe(false);
  });
});

describe("soundtrack listener tags", () => {
  test("cleanTags drops noise, lower-cases, keeps weights", () => {
    const t = cleanTags([{ name: "Seen Live", count: 100 }, { name: "Sad", count: 90 }, { name: "2010s", count: 50 }, { name: "piano", count: "40" }, { name: "sad", count: 10 }, { name: "zero", count: 0 }]);
    expect(t).toEqual([{ name: "sad", count: 90 }, { name: "piano", count: 40 }]);
  });
  test("tagFit: fitting tags lift, clashing tags sink, no tags change nothing", () => {
    expect(tagFit([], "grief", []).delta).toBe(0);
    const sad = tagFit([{ name: "sad", count: 100 }, { name: "piano", count: 60 }], "grief", ["piano"]);
    const party = tagFit([{ name: "party", count: 100 }, { name: "dance", count: 80 }], "grief", ["piano"]);
    expect(sad.delta).toBeGreaterThan(0.5);
    expect(sad.reasons[0]).toBe("tagged sad");
    expect(party.delta).toBeLessThan(-0.4);
    expect(party.reasons).toContain("but tagged party");
    // "dark" fits inside "dark ambient".
    expect(tagFit([{ name: "dark ambient", count: 100 }], "dread", []).delta).toBeGreaterThan(0.4);
  });
  test("tagFit: strict genres sink a well-tagged song in none of them", () => {
    const tags = ["pop", "dance", "catchy", "female", "2020"].map((name, i) => ({ name, count: 100 - i * 10 }));
    expect(tagFit(tags, "calm", ["dark ambient"], true).reasons).toContain("not tagged with your genres");
    expect(tagFit(tags, "calm", ["dark ambient"], false).reasons).not.toContain("not tagged with your genres");
  });
  test("retag reorders by tags and leaves untagged songs alone", () => {
    const mk = (id: string, score: number) => ({ track: { videoId: id }, score, reasons: [] as string[] });
    const out = retag([mk("a", 1), mk("b", 0.9), mk("c", 0.7)], new Map([["a", [{ name: "party", count: 100 }]], ["b", [{ name: "melancholy", count: 100 }]]]), "melancholy", []);
    expect(out.map((x) => x.track.videoId)).toEqual(["b", "c", "a"]);
    expect(out[0].reasons[0]).toBe("tagged melancholy");
  });
  test("lookupTitle strips video and remaster dressing", () => {
    expect(lookupTitle("Hurt (Official Video) [Remastered 2011]")).toBe("Hurt");
    expect(lookupTitle("Song - 2011 Remaster")).toBe("Song");
    expect(lookupTitle("Duet feat. Someone")).toBe("Duet");
    expect(lookupTitle("(Untitled)")).toBe("(Untitled)");
  });
});

describe("soundtrack mood chosen by the player", () => {
  const FIGHT = "He draws his sword and lunges; steel rings off steel.";

  test("a chosen mood beats the scene, even a fight, and says so; Auto reads the scene", () => {
    const st = state({ mode: "conflict" });
    const auto = readCue({ state: st, genres: [], reply: FIGHT });
    expect(auto.mood).toBe("combat");
    expect(auto.chosen).toBeUndefined();
    const calm = readCue({ state: st, genres: [], reply: FIGHT, chosen: "calm" });
    expect(calm.mood).toBe("calm");
    expect(calm.chosen).toBe(true);
    expect(calm.read).toBe("combat");
    expect(calm.sharp).toBe(false);
    expect(calm.why).toContain("chosen by you");
    expect(calm.why).toContain("the scene reads combat");
    // The numbers follow the choice, mostly.
    expect(calm.tension).toBeLessThan(auto.tension);
    expect(calm.tension).toBeLessThan(0.4);
    expect(readCue({ state: st, genres: [], reply: FIGHT, chosen: null }).mood).toBe("combat");
  });

  test("a chosen erotic is explicit only where the story's intimacy allows it", () => {
    expect(readCue({ state: state({ mode: "social" }), genres: [], chosen: "erotic" }).explicit).toBe(true);
    expect(readCue({ state: state({ mode: "social" }), genres: [], chosen: "erotic", nsfw: "fade" }).explicit).toBe(false);
  });

  test("choosing a mood plays it now with a fade, ends a hold and takes back from the player's song", () => {
    const c1 = cueOf({ sceneNo: 1 });
    const { s } = run([{ type: "cue", cue: c1, now: 0, ...opts }, { type: "start", now: 1 }, { type: "picked", videoId: "s1", when: "now", cue: c1, now: 2 }, { type: "poll", np: np("s1"), now: 3, banned: null }, { type: "hold", on: true }]);
    expect(s.mode).toBe("holding");
    const calm = cueOf({ mood: "calm", energy: 0.2, valence: 0.3, tension: 0.1, sceneNo: 1, chosen: true });
    const r = step(s, { type: "mood", cue: calm, now: 5 });
    expect(r.state.mode).toBe("following");
    expect(r.actions).toEqual([{ type: "pick", when: "now", cue: calm, reason: "you chose the mood", fade: true }]);
    expect(r.state.lastCue).toBe(calm);
    // The player's own song: choosing a mood takes the music back.
    const yielded = step({ ...s, mode: "yielded", origin: "user" }, { type: "mood", cue: calm, now: 5 });
    expect(yielded.actions.some((a) => a.type === "pick" && a.when === "now")).toBe(true);
    // Already that mood: nothing changes.
    const same = step({ ...s, mode: "following", playingCue: calm }, { type: "mood", cue: calm, now: 5 });
    expect(same.actions).toEqual([]);
    // Not running: remembered for Start.
    const off = step({ ...s, running: false }, { type: "mood", cue: calm, now: 5 });
    expect(off.actions).toEqual([]);
    expect(off.state.lastCue).toBe(calm);
  });
});

describe("soundtrack thumbs", () => {
  const r = (id: string, artist: string, mood: any, vote: 1 | -1, genre = "r&b", qkey = "erotic|r&b"): Rating => ({ track: track(id, id, artist), mood, genre, qkey, vote, at: 0 });

  test("a thumb again takes it back, the other thumb replaces it; one vote per song and mood", () => {
    let list = rate([], r("a", "A", "erotic", 1));
    expect(voteOf(list, "a", "erotic")).toBe(1);
    list = rate(list, r("a", "A", "erotic", -1));
    expect(list.length).toBe(1);
    expect(voteOf(list, "a", "erotic")).toBe(-1);
    list = rate(list, r("a", "A", "erotic", -1));
    expect(list.length).toBe(0);
    list = rate(rate([], r("a", "A", "erotic", 1)), r("a", "A", "calm", -1));
    expect(voteOf(list, "a", "erotic")).toBe(1);
    expect(voteOf(list, "a", "calm")).toBe(-1);
    expect(ratingSummary(list).map((x) => x.mood).sort()).toEqual(["calm", "erotic"]);
  });

  test("close moods share half a vote; far ones none", () => {
    expect(moodNear("sensual", "sensual")).toBe(1);
    expect(moodNear("sensual", "romantic")).toBe(0.5);
    expect(moodNear("melancholy", "grief")).toBe(0.5);
    expect(moodNear("erotic", "combat")).toBe(0);
    const L = learnedFor([r("a", "A", "sensual", 1), r("b", "B", "sensual", -1)], "romantic");
    expect(L.track.get("a")).toBe(0.5);
    expect(L.track.get("b")).toBe(-0.25);
    // Down for a nearby mood doesn't rule a song out here.
    expect(L.out.has("b")).toBe(false);
    expect(learnedFor([r("b", "B", "sensual", -1)], "sensual").out.has("b")).toBe(true);
  });

  test("the song, its artist, its genre and its search rise with thumbs up and sink with thumbs down", () => {
    const L = learnedFor([r("a", "Sade", "erotic", 1), r("b", "Sade", "erotic", 1), r("c", "Nickel", "erotic", -1, "rock", "erotic|rock")], "erotic");
    expect(ratingBonus(L, track("a", "x", "Sade"), "r&b", "erotic|r&b").delta).toBeGreaterThan(0.6);
    const sameArtist = ratingBonus(L, track("new", "x", "Sade"), "", "");
    expect(sameArtist.delta).toBeGreaterThan(0.2);
    expect(sameArtist.reasons.join()).toContain("you like this artist");
    expect(ratingBonus(L, track("new2", "x", "Nickel"), "rock", "erotic|rock").delta).toBeLessThan(-0.2);
    expect(ratingBonus(L, track("new3", "x", "Other"), "r&b", "erotic|r&b").delta).toBeGreaterThan(0);
    expect(ratingBonus(undefined, track("a", "x", "Sade"), "", "").delta).toBe(0);
  });

  test("picks learn: a song rated down is out for that mood, rated up comes back, liked artists win", () => {
    const sex = cueOf({ mood: "erotic" });
    const q = { q: "r&b sexy", key: "erotic|r&b", genre: "r&b", rank: 0 };
    const cands: Candidate[] = [
      { track: track("top", "One", "Search Top"), query: q, pos: 0 },
      { track: track("fav", "Two", "Sade"), query: q, pos: 4 },
      { track: track("bad", "Three", "Nope"), query: q, pos: 1 },
    ];
    const rated = [r("bad", "Nope", "erotic", -1), r("old", "Sade", "erotic", 1)];
    const learned = learnedFor(rated, "erotic");
    const order = scoreAll(cands, sex, DEFAULT_TASTE, emptyHistory(), { now: Date.now(), seed: "", learned }).map((x) => x.track.videoId);
    expect(order).not.toContain("bad");
    expect(order[0]).toBe("fav");
    // Rated-up songs are candidates of their own, for that mood and close ones, not for far ones.
    expect(ratedPool(rated, "erotic").map((t) => t.videoId)).toEqual(["old"]);
    expect(ratedPool(rated, "sensual").map((t) => t.videoId)).toEqual(["old"]);
    expect(ratedPool(rated, "combat")).toEqual([]);
  });

  test("a thumbs-down skip carries no skip penalty on top", () => {
    const c1 = cueOf({ sceneNo: 1 });
    const { s } = run([{ type: "cue", cue: c1, now: 0, ...opts }, { type: "start", now: 1 }, { type: "picked", videoId: "s1", when: "now", cue: c1, now: 2 }, { type: "poll", np: np("s1"), now: 3, banned: null }]);
    const quiet = step(s, { type: "user-skip", now: 5, quiet: true }).actions;
    expect(quiet.some((a) => a.type === "penalise")).toBe(false);
    expect(quiet.some((a) => a.type === "pick" && a.when === "now")).toBe(true);
    expect(step(s, { type: "user-skip", now: 5 }).actions.some((a) => a.type === "penalise")).toBe(true);
  });
});
