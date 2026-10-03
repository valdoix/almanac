# 11 · Soundtrack: YouTube Music scored by the scene

The Almanac already knows what kind of moment the story is in: the scene mode, how charged it is, the hour, the weather, the room, the story's genres. Soundtrack turns that into music. It picks songs from YouTube Music that fit the scene, in the genres the player chose, with their preferred artists brought forward and their banned artists never played. It changes the music on story beats, not on every reply.

**Status:** design only, nothing built. Target: extension 1.22.0. No preset change.

It borrows from [Lumiverse-SpotifyControls](https://github.com/prolix-oc/Lumiverse-SpotifyControls) (§2) and builds on the scene state ([05](05-extension-ledger.md)), Session Zero, and the seeded-dice idea from Elsewhere ([09 §2](09-elsewhere.md)).

## 1. What the platform allows (checked against Lumiverse source)

Where the music actually plays decides the whole design, so this comes first.

| Fact | Where | Consequence |
|---|---|---|
| Extensions can't create `iframe`, `frame`, `object` or `embed` | `frontend/src/lib/spindle/dom-helper.ts` `FORBIDDEN_CREATE_TAGS`, `FORBID_TAGS` | No YouTube player in a drawer tab, float widget or HUD |
| Sandbox frames run with `frame-src 'none'; connect-src 'none'; media-src data: blob:` | `frontend/src/lib/spindle/sandbox-frame.ts` | No embedded player in a sandbox either |
| The host draws YouTube embeds that appear in message text, but only `youtube-nocookie.com` with `autoplay, controls, loop, mute, playsinline, rel, start, end, si` | `MessageContent.tsx` `sanitizeTrustedYouTubeEmbedSrc` | No `enablejsapi`, so the extension can't pause it, skip it, or tell when a song ends. It's lazy-loaded and unmounts as the chat scrolls. It works as a link preview, not as a player |
| Playing YouTube audio through `spindle.cors` → blob means decoding googlevideo stream URLs | none | This breaks YouTube's terms and stops working within weeks. **Rejected** |
| YouTube Music has no official API. YouTube Data API v3 search costs 100 of 10,000 daily units, has no music metadata and can't control playback | Google docs | Not a usable catalog or player |
| `spindle.cors` reaches private and loopback hosts | `src/spindle/worker-host.ts` → `safeFetch(..., { allowPrivate: true })` | **The backend can drive a YouTube Music desktop app running on the same machine** |

So the extension is the **conductor** and an external app is the **player**. The Spotify extension works the same way: Spotify plays on the user's own device and the extension sends it commands.

## 2. What to take from the Spotify extension

| Take | Leave |
|---|---|
| All network calls through `spindle.cors`, polled every 5 s while playing and 15 s while paused (`backend.ts` `POLL_ACTIVE_MS`) | **The model choosing music through a tool call inside the main reply** (`spotify_play_music`, `spotify_mood_discover`). It spends reply tokens, the model only acts when it decides to call, and it re-reads raw text for a mood the Ledger already holds |
| Secrets in `spindle.enclave`, settings in `userStorage` | Mood keywords guessed from the chat text (`MOOD_KEYWORDS`, `extractMoodFromContext`). ALMANAC has mode, tier, time, weather and place as data |
| Last.fm mood tags as an optional way to score how well a track fits | A single 2,800-line backend file |
| A record of which song was playing at each message (`SongSnapshot` per swipe) | |
| Normalising artist and track names before matching them | |

## 3. Principles

1. **The Ledger chooses the music.** The mood comes from filed state and adds nothing to the prompt. Picking a song is engine work and takes milliseconds.
2. **The player belongs to the user.** A pause stays paused. A song the user picked plays to the end. The extension doesn't fight the user over their own speakers.
3. **Bans are absolute.** They're checked when a song is picked and again when it plays, because YouTube Music's autoplay and radio can bring a banned artist in afterwards.
4. **The music changes on story beats.** A new scene, a sharp turn or a song ending changes it. An ordinary reply, a swipe or a regenerate doesn't.
5. **No spoilers.** The cue reads only what the page has shown. Elsewhere's arcs, hidden secrets and the Director's plan never reach it. Music that turns ominous before the raid arrives gives the raid away.
6. **Cheap.** No model calls by default. Search results are cached, so a session usually makes only a handful of searches.
7. **It degrades.** Without a player it shows what it would play, with a link. Without the `cors_proxy` permission the feature stays hidden.

## 4. Overview

```
 reply filed (GENERATION_ENDED → onReply → L.refresh)                    every 5 s / 15 s
        │                                                                      │
        ▼              ── core: pure, deterministic, unit-tested ──            ▼
 ┌─ CUE ─────────┐  ┌─ DIRECTOR ──────┐  ┌─ BRIEF ─────┐  ┌─ PICKER ───────┐  ┌─ GUARD ───────────┐
 │ WorldState +  │─►│ change now,     │─►│ search      │─►│ taste filters, │─►│ watches the player│
 │ ChatConfig →  │  │ at track end,   │  │ queries per │  │ score, seeded  │  │ bans, foreign     │
 │ mood vector   │  │ or nothing      │  │ genre × mood│  │ draw, history  │  │ songs, refill     │
 └───────────────┘  └─────────────────┘  └──────┬──────┘  └───────┬────────┘  └─────────┬─────────┘
                                                │ CATALOG          │ PLAYER adapter        │
                                                ▼ (cached)         ▼                       ▼
                                   player search / InnerTube   Pear Desktop API · YTMDesktop · link
```

The core files (`cue`, `director`, `picker`, `taste`, parsers) take data and return data. The backend connects them to events, storage and the network.

## 5. The cue: what the scene sounds like

### 5.1 Inputs (all already in the state)

| Input | Source | Example |
|---|---|---|
| Scene mode | `state.mode` (`SCENE_MODES`) | `conflict` |
| Charge | `tierGuess` on the last player message plus the reply's delta | `pivotal` |
| Hour | `state.time` → dawn, day, dusk, night or late night | `night` |
| Weather | `state.weather.condition`, `intensity` | `rain, heavy` |
| Place | `state.place` → plate room kind (`KIND_WORDS`) | `tavern`, `forest`, `car` |
| Story genres and tone | `ChatConfig.genres` (first one leads), `tone` | `dark_fantasy`, `melancholy` |
| Pressure | deadlines and gauges close to due, injuries in the scene | `+tension` |
| Loss | a `death` milestone filed by this reply (never words in the prose: see §19) | `grief` |
| Closeness | bond heat between the people present, for `intimacy` | `+intimacy` |

### 5.2 Output

```ts
interface Cue {
  mood: Mood;              // one of 16 labels, the search vocabulary
  energy: number;          // 0..1
  valence: number;         // -1..1
  tension: number;         // 0..1
  intimacy: number;        // 0..1
  colour: string[];        // ≤3 texture words: "rain", "night", "tavern", "neon"
  sharp: boolean;          // a sharp turn this reply (fight starts, a death)
  sceneNo: number;         // the Ledger's, for display only
  place: string;           // placeKey(): the music scene's spot (§19)
  at: number | null;       // absolute minutes
  why: string;             // "conflict · night · rain" for the Now playing card
}
type Mood = "calm" | "warm" | "playful" | "tender" | "romantic" | "hopeful" | "triumphant" | "adventurous"
          | "mysterious" | "eerie" | "tense" | "dread" | "combat" | "melancholy" | "grief" | "dreamy";
```

### 5.3 Rules (first draft, tuned by replay in §15)

| Mode | Base mood | energy | valence | tension |
|---|---|---|---|---|
| downtime | calm | .25 | +.3 | .1 |
| social | warm, or playful with comedy | .45 | +.5 | .2 |
| intimacy | tender, or romantic with romance or erotic | .30 | +.6 | .3 |
| conflict | tense; combat once blows land | .80 | −.4 | .8 |
| investigation | mysterious | .40 | −.1 | .5 |
| travel | adventurous | .55 | +.3 | .3 |
| stealth | tense, low | .35 | −.3 | .7 |
| crisis | dread; combat once it's a fight | .90 | −.6 | .95 |

Modifiers move the numbers and can change the label: night lowers energy (−.15) and moves calm towards dreamy; rain and fog move it towards melancholy; a storm raises tension; horror turns warm and calm into eerie after dark; cozy caps tension at .4; a melancholy or tragedy tone lowers valence by .2; a death in the reply means grief for the rest of that scene. These are tables in `core/soundtrack/moods.ts`, not code.

### 5.4 Model help (optional, off by default)

Setting `soundtrack.director: "engine" | "model"`. With `model`, one quiet call ([llm.ts](../src/backend/llm.ts) `quiet`, on the summariser's connection, reasoning off, 80 tokens) runs **at scene boundaries only**. It gets the scene header and the last reply's opening lines, and returns `{"mood": "<one of the 16>", "colour": ["…","…"]}`. Anything outside the list is discarded and the engine's cue stands. The model never picks genres or artists, because those are the player's.

## 6. Taste: genres, preferred and banned artists

### 6.1 Shape

```ts
interface Taste {
  genres: string[];               // "film score", "dark ambient", "synthwave", "lo-fi", "j-rock", free text allowed
  genreMode: "strict" | "blend";  // strict: only these; blend: these first, the story's genre fills gaps
  preferred: ArtistRef[];         // come first, and seed searches
  banned: ArtistRef[];            // never played
  bannedWords: string[];          // title words: "nightcore", "sped up", "live", "remix"
  vocals: "any" | "quiet-in-dialogue" | "instrumental";
  explicit: boolean;
  variety: "focused" | "balanced" | "wide"; // how often preferred artists come up
}
interface ArtistRef { name: string; id?: string } // id: YouTube Music channel/browse id (UC…), set by autocomplete
```

- **Global taste** lives in Settings (`settings.soundtrack.taste`).
- **Per-chat taste** goes in `ChatConfig.soundtrack` as a partial override. Genres and preferred artists **replace** the global ones; banned artists and words are **added** to the global lists, so a ban always holds. A medieval chat can be "film score, celtic folk" while the rest stays "synthwave".
- **Session Zero** gets one more row, *Soundtrack*, with genre suggestions taken from the story's genres:

| Story genre | Suggested music genres |
|---|---|
| fantasy, adventure | film score, celtic folk, orchestral |
| dark_fantasy, tragedy | dark ambient, neoclassical, dark folk |
| horror | dark ambient, drone, horror score |
| scifi | synthwave, ambient electronic, film score |
| noir, mystery | jazz, noir jazz, trip-hop |
| thriller, action, survival | film score, industrial, post-rock |
| romance, erotic, drama | indie, neo-soul, piano |
| slice_of_life, cozy, comedy | lo-fi, acoustic, city pop |
| intrigue | neoclassical, baroque, film score |

### 6.2 Matching an artist

YouTube Music credits are messy: "A, B & C", "A feat. B", uploads under "Artist - Topic", "ArtistVEVO", the same artist in two scripts. So:

1. When an artist is added in the editor, autocomplete runs a catalog search for artists and saves the channel id with the name. **Id match is exact and comes first.**
2. Names are normalised: NFKD, accents and case removed, `- topic`, `vevo` and `official` stripped, then split on `, & x × feat. ft. with`.
3. A track is banned if **any** credited artist matches by id or by normalised name, or if the title holds `(feat. <banned>)` or a banned word as a whole word. "Halsey" doesn't ban "Halsey Taylor".

## 7. Catalog: where songs come from

```ts
interface Track {
  videoId: string; title: string;
  artists: { name: string; id?: string }[];
  album?: string; durationS: number; explicit: boolean;
  kind: "song" | "video";        // song = audio track (ATV); video = music video (OMV/UGC)
}
```

| Source | Used when | Notes |
|---|---|---|
| The player's own search (Pear `POST /api/v1/search`) | Pear is connected | Uses the user's own YouTube Music session and region, with no quota. Returns raw InnerTube JSON, read by the same parser as below |
| InnerTube `music.youtube.com/youtubei/v1/search` (WEB_REMIX client) through `spindle.cors` | Any other player | No key needed but unofficial. The parser is isolated in `core/soundtrack/innertube.ts` and tested against saved fixtures |
| YouTube Music *Moods & genres* playlists (`FEmusic_moods_and_genres`: Chill, Romance, Sad, Focus, Energy boosters, Feel good, Sleep…) | A cue whose searches come back thin | Curated playlists that fill a pool |
| Last.fm tags (optional key, in enclave) | Scoring fit for preferred artists' tracks | Tags cached per artist with no expiry. Same approach as the Spotify extension |
| YouTube Data API v3 | **Not used** | 100 units per search and no song metadata |

**Queries.** For each cue, up to 3 of the taste's genres (rotated across scenes) × the mood word, plus up to 2 colour words: `"dark ambient tense"`, `"film score mysterious night"`. With the songs filter. With `vocals: instrumental`, "instrumental" is added to the query. Preferred artists add `"<artist> <mood word>"` queries.

**Cache.** Pools of about 40 tracks per `(mood, genre, colour)`, kept in user storage under `soundtrack/pools.json`, LRU of 200 pools with a 7-day TTL. A search runs only on a cache miss, at most one every 10 s, with backoff after 429s.

## 8. Picker

**Hard filters, in order:** banned artist or word → not `explicit` when explicit is off → `kind: "video"` unless the setting allows music videos (they can open with skits and talking) → duration between 1:30 and 8:00 → played in this chat in the last 25 tracks, or anywhere in the last 2 hours → the same artist as the previous track, except under `focused`.

**Score:**

```
score = fit        // pool rank for this cue (0..1), plus Last.fm tag overlap when available
      + genre      // +.3 for the taste's lead genre, +.15 for the others
      + preferred  // focused +.5 · balanced +.25 · wide +.1
      + liked      // +.15 if the user liked it in YouTube Music
      − skipped    // −.4 if the user skipped this track under the same mood, −.2 for its artist
```

**Draw:** a weighted draw among the top 5, seeded by `hash(chatId, sceneNo, playIndex)`. A regenerate or rebuild that keeps the same cue gets the same song, and different scenes still vary. The weather engine and Elsewhere use the same kind of dice.

## 9. Director: when the music changes

Four states: **off** (disabled or no player), **following** (the current song was ours), **holding** (the player pinned the song), **yielded** (the player paused or started something of their own).

| Event | following | holding / yielded |
|---|---|---|
| Reply filed, same mood, small move | Nothing. Keep one song queued | Nothing |
| Reply filed, distance ≥ .35 or new scene | Queue a new song after the current one (`INSERT_AFTER_CURRENT_VIDEO`). The current one finishes | Yielded: take back at the scene change if `takeBack` is on |
| Sharp turn (`cue.sharp` and tension up ≥ .4) | With `cutOnSharpTurns`: fade volume out over 2 s, play the new song, fade back in | Nothing |
| Swipe, regenerate, edit, delete | Wait 3 s, re-read the cue, and cancel a queued change if the mood went back | Nothing |
| Song ended or queue empty | Refill from the current cue | Nothing |
| The player pauses | → yielded (paused) | |
| The player skips our song | Skip penalty, then pick another for the same cue | |
| A song we didn't queue starts | → yielded. **Guard** still applies bans to autoplay (§10) | |
| Chat switched | New cue; change at the end of the current song | Nothing |
| Generation started or streaming | Nothing (no flips mid-reply) | Nothing |

**Distance** is the Euclidean distance over (energy, valence, tension, intimacy), plus .3 when the mood label changes. **Hysteresis:** a new mood has to hold for one filed reply before it changes the music, unless the turn is sharp. **Minimum time on a song:** 60 s.

So music stays steady through a long scene and changes when the story turns. When the queue is kept one song ahead, YouTube Music's own autoplay rarely gets a turn.

## 10. Players

```ts
interface MusicPlayer {
  readonly id: "pear" | "ytmd" | "link";
  connect(userId: string): Promise<PlayerStatus>;        // handshake, saves the token in enclave
  nowPlaying(): Promise<NowPlaying | null>;              // polled 5 s while playing / 15 s while paused
  playNow(videoId: string): Promise<void>;
  enqueueNext(videoId: string): Promise<void>;
  skip(): Promise<void>; pause(): Promise<void>; resume(): Promise<void>;
  setVolume?(pct: number): Promise<void>;                // for fades
  search?(query: string): Promise<Track[]>;              // a catalog source, if the player has one
  liked?(videoId: string): Promise<boolean>;
}
```

| Adapter | How | Search | Notes |
|---|---|---|---|
| **Pear Desktop** ([pear-devs/pear-desktop](https://github.com/pear-devs/pear-desktop), the "YouTube Music" desktop app), API Server plugin. **The first one to build** | REST on `127.0.0.1:26538`. `POST /auth/{clientId}` opens an *Allow / Deny* dialog in the app and returns a JWT. Then `GET /api/v1/song`, `POST /api/v1/queue {videoId, insertPosition}`, `/next`, `/pause`, `/play`, `/volume`, `/like-state`. Swagger at `/swagger` | `POST /api/v1/search` | Plays with the user's own account: Premium means no ads. No "play this id" call exists, so `playNow` is `queue AFTER_CURRENT` + `next`. A WebSocket at `/api/v1/ws` could replace polling if the worker can open one (checked in the spike) |
| **YTMDesktop v2** Companion Server | REST on `127.0.0.1:9863`, auth code shown in the app, `changeVideo` command | none, so InnerTube | Endpoint names need confirming in the spike |
| **Link** | The Now playing card opens `music.youtube.com/watch?v=…` and the player clicks | InnerTube | For phones and for Lumiverse hosted somewhere else, where the backend can't reach the user's machine |

The Lumiverse **server** makes these calls, not the browser. Loopback only works when Lumiverse and the player run on the same machine (the user's setup). A player on another machine on the LAN works if its API server listens on the LAN (Pear's default host is `0.0.0.0`).

**Guard.** Every poll compares what's playing with what we queued. A banned artist is skipped straight away, whoever queued it (autoplay, a radio), unless the player pinned it with *Hold*. A song the user chose themselves sends the director to *yielded* and is left alone. A track whose title or artist fails to parse is never treated as banned.

## 11. Storage

| What | Where | Notes |
|---|---|---|
| On/off, running, player URL, client id, director, connection, cut on sharp turns, take back, fade, global taste | user storage `soundtrack/config.json` (§19) | |
| Player token, Last.fm key | `spindle.enclave` | Never in a settings file |
| Per-chat taste override, on/off for the chat, grief and model-hint marks | the chat's `soundtrack.json` (§19) | |
| Play history per chat (last 50: time, msgId, videoId, title, artists, mood, why, `ours`/`foreign`, skipped) | the chat's files, `soundtrack.json` | Drives the no-repeat rule and the history list |
| Pools, artist tags, skip penalties | user storage `soundtrack/` | LRU and TTL as in §7 |

Every read and write carries a `userId`, and a failed read is never cached as a default (operator-scope install).

## 12. Interface

- **Soundtrack page** in the drawer:
  - **Now playing:** cover, title, artist, and *why* ("Tense · night · rain, from 'dark ambient tense'").
  - **Controls:** play/pause, skip, *Hold* (pin the song to the scene), *Ban artist*, *Never this song*.
  - A small mood meter (energy, tension) and *Up next*.
  - Recent history for the chat.
- **Taste editor:**
  - Genre chips with the §6.1 suggestions plus free text, and a strict/blend switch.
  - Preferred and banned artist lists with autocomplete.
  - Banned words, vocals, variety, explicit.
  - A *Use a different taste for this story* toggle that shows the per-chat override.
- **Connection:** pick the player, *Connect* (then press Allow in the app), and a status pill (connected / app not running / not allowed).
- **HUD:** one line, "♪ Title · Artist", that opens the page.
- **Session Zero:** the *Soundtrack* row (§6.1).

Built with `ui.ts` and `drawerstyles.ts`, in the drawer's own skins.

## 13. Permissions

Add `cors_proxy` to `spindle.json`. Lumiverse asks for new permissions on update. Until it's granted, the Soundtrack page explains why it's off, and nothing else changes. No `oauth` permission is needed: Pear and YTMDesktop have their own handshakes.

## 14. Code layout

```
src/core/soundtrack/
  moods.ts       mood list, mode table, modifiers, genre suggestions (data)
  cue.ts         (WorldState, ChatConfig, delta) → Cue; distance()
  taste.ts       merge global + chat taste, normalise names, isBanned()
  innertube.ts   InnerTube JSON → Track[] (search results, playlists, artist pages)
  picker.ts      filters, score, seeded draw
  director.ts    (DirectorState, Event) → { state, actions[] }   pure state machine
src/backend/soundtrack/
  index.ts       events (GENERATION_ENDED after refile, swipes, CHAT_SWITCHED), polling, wiring
  catalog.ts     sources, pools cache, rate limit
  players/pear.ts · players/ytmd.ts · players/link.ts
  store.ts       history, pools, taste in user storage
src/frontend/soundtrack.ts   drawer page, taste editor, HUD line
```

The trigger is the end of `onReply` in [ingest.ts](../src/backend/ingest.ts), after `L.refresh()`. The state is filed by then, and the director gets the new cue.

## 15. Validation

Following the replay rule, unit tests alone aren't enough:

1. **Cue timeline over real chats.** Run `cue()` over every filed state of `6170f171` (Buffy, 269 messages) and `7a49f564` (Targaryen). Print one line per change: message, mood, why. Targets: about one change per scene and no more than three per story hour; no change on the regenerated messages; grief after a death; calm at the family breakfast.
2. **Ban tests.** Fixtures with "feat.", "& ", "- Topic", VEVO, the same name in two scripts, and near-names ("Halsey" vs "Halsey Taylor").
3. **Director tests.** Event sequences (scene change mid-song, sharp turn, swipe and back, user pause, foreign song, autoplay ban) → expected actions.
4. **InnerTube fixtures.** Saved search, playlist and artist responses, so a format change fails a test and doesn't slip through at runtime.
5. **Live spike with Pear** (Phase 0) before the adapter is written.

## 16. Build order

| Phase | Work | Result |
|---|---|---|
| 0 · Spike (½ day) | Pear: auth dialog, the search JSON shape, queue + next as "play now", volume fade timing, whether WebSocket works in the worker | Notes added to this document |
| 1 · Cue | `moods.ts`, `cue.ts`, replay timeline | A mood timeline for the real chats, no audio yet |
| 2 · Catalog and taste | `innertube.ts`, `catalog.ts`, `taste.ts`, `picker.ts` | Picks printed for the timeline |
| 3 · Player and director | `pear.ts`, `director.ts`, guard, polling | Music in the real app |
| 4 · Interface | Soundtrack page, taste editor, Session Zero row, HUD line | 1.22.0 |
| 5 · Later | Model director, Last.fm tags, YTMDesktop adapter, a "what played here" badge per message, saving a chat's soundtrack as a playlist | |

## 17. Risks

| Risk | Answer |
|---|---|
| InnerTube is unofficial and its shape changes | The parser is isolated and covered by fixtures; Pear's search is preferred when available; the Moods & genres playlists are a fallback |
| Terms of service | Nothing is downloaded or decoded. Playback happens in the user's own YouTube Music client; searches use the same public endpoints the web app uses |
| The user has to install Pear and turn on its API Server plugin | Link mode works without it; the Connect panel explains the steps |
| Free accounts get ads, and a cut can land on one | Cuts happen only on sharp turns, and can be turned off |
| Without tags, mood fit is only as good as the search | Mood-worded queries and the curated mood playlists carry it; Last.fm tags are the upgrade |
| Lumiverse used from a phone or hosted elsewhere | Loopback needs the player on the server's machine; otherwise link mode |

## 18. Not in scope

- Music in the prompt, or characters reacting to the song. The soundtrack is for the player, not the story.
- Lyrics and synced lyrics.
- Spotify (the existing extension covers it).
- Anything that needs a Google OAuth app (writing playlists to the account). Revisit in Phase 5.

## 19. As built (1.22.0)

Where the code differs from the plan above, and why.

- **Music scenes aren't the Ledger's scenes.** `state.sceneNo` turns over at every new title, sub-place and downtime: in the Buffy chat (`6170f171`) it went up almost every reply, and following it changed the song 79 times in 193 replies. The music uses `placeKey(place)` (the innermost spot without who-is-where, destination or building: "guest room (Buffy) · hallway (Dawn)" → `guest room`, "living room → hallway" → `hallway`, "kitchen, in Winters Residence" → `kitchen`) and `sameScene(a, b)`: the same spot within 90 minutes. The director numbers music scenes itself (`sceneId`); hold, take-back and the per-scene model call follow them. After this change the Buffy chat has 30 changes in 193 replies.
- **A death is a filed milestone, not a word.** The prose regex fired on 77 of 193 replies in the Buffy chat ("the Slayer who died", "since Mom died", "the quip dies"). `cue.death` is now only a `death` milestone at `state.lastReply`. Grief holds while the music scene lasts, and only while the reply that filed the death is still on the path (a swipe away ends it).
- **Storage.** Config and global taste are in `soundtrack/config.json`, not `settings.json`, so the Soundtrack works without touching the Settings schema. Per-chat taste, off, plays, grief and hint are in `chats/<id>/soundtrack.json`, not `ChatConfig`. History (recent plays, skip penalties, "never") is in `soundtrack/history.json`. Pools are in `soundtrack/pools.json` (7-day TTL, 150 pools of 25). The token is in the enclave as `soundtrack_pear_token`.
- **Search limits.** At most 40 searches per 10 minutes per user. A 429 pauses searching for 5 minutes. Searches go through Pear's `/api/v1/search` (the user's own session) first, and through the public WEB_REMIX endpoint if that fails.
- **Play now** = `POST /queue` (after current), find it in `GET /queue`, `PATCH /queue {index}`, then `/play`, falling back to `/next`. The fade steps volume to 10% over about 1.4 s and back over 0.75 s.
- **Ban matching** counts a name match even when both sides have ids, because an artist's Topic channel and main channel have different ids. The whole credit ("Simon & Garfunkel") counts as well as its parts.
- **Known limit.** A banned song the user queued inside YouTube Music, if it starts right after a song ends naturally, looks like autoplay and is skipped. A song started from the Soundtrack page, or jumped to mid-song, is always the user's.
- **Built since:** the HUD strip (`musicStrip` in hud.ts: open window controls, ♪ on the pill and the docked tab; fed by `SoundtrackUI.hudMusic()`; the frontend sends a `get` at each chat's first state request so the widget knows the song without opening the page). The Session Zero row (`musicRow` in sessionzero.ts: usual / own genres / off, sent as `taste` scope chat and `chatOff`). Last.fm tags (`core/soundtrack/tags.ts`: `MOOD_TAGS` fit/clash, `tagFit`, `retag`; `backend/soundtrack/lastfm.ts`: track tags, artist tags at 0.7 weight when the track has fewer than five, 30-day cache in `soundtrack/tags.json`, at most 4 calls a second, a 5 s budget per pick, the key in the enclave as `soundtrack_lastfm_key`). Tags only reorder the top ten that survive the filters; they never add a song.
- **Not built yet:** YTMDesktop and link mode.
- **Validation.** `tests/soundtrack.test.ts` covers cue, place keys, bans, InnerTube fixtures, filters and scoring, and director sequences. `tests/hooks.test.ts` "soundtrack with Pear Desktop" runs the backend against a fake API Server with the real routes: connect, start, keep-ahead, guard skip, the user's own banned pick, artist search and disconnect. The cue timeline was replayed over `6170f171` and `7124f750`.

## 20. Heat and feelings (1.22.1)

Every `intimacy` scene used to read as `tender`, or as `romantic` in a romance or erotic story. In `6170f171` that was 83 of 193 replies, and it covered a night of bandaged hands and two hours of sex alike.

- **18 moods:** `sensual` and `erotic` were added after `romantic`. `Cue.heat` (0 close, 1 desire, 2 sex) and `Cue.explicit` were added too.
- **Heat** is read from the player's message and the reply, with the off-page blocks stripped (`ledger`, `unspoken`, `plan`, `think`, `ooc`, `folio`). The model's planning text says "no climax" and "the kiss is the turn's climax". Stripping also stops a `<plan>` that says "she attacks" from counting as a fight.
  - `EXPLICIT` and `SENSUAL` are lists of patterns, and each counts once however often it matches. "moan" isn't one of them, because it's the chat's running joke about Gabriel and soup (#46, #148, #268 have 16 to 18 each).
  - In `intimacy`, the scene is erotic with 3 explicit terms, or with 2 when someone present was just filed with a desire mood ("wanton-brave"). It's sensual with 1 explicit term, 3 sensual ones, or a fresh desire mood.
  - Outside `intimacy`, it takes 4 explicit terms, and never in conflict, crisis, investigation or stealth.
  - Session Zero's Intimacy set to `off` or `fade` caps the scene at sensual. `explicit` means the story is erotic and its setting is `explicit` or unset (the preset's).
- **Heated scenes:** like grief, the chat's `soundtrack.json` keeps `heated`, the place and time of the last erotic cue. A sensual reply in the same music scene stays erotic, so a breath between rounds doesn't change the song.
- **Director:** a scene's first turn to erotic is a jump, so with cut-on-sharp it cuts in with a fade (`eroticScene` remembers the scene). Turning erotic again in the same music scene changes the song the usual way.
- **Model hint:** it can't override `erotic`, and it can override `sensual` only with `erotic`. It's read once per scene, and scenes heat up after that.
- **Picker:**
  - `MOOD_GENRES` gives sensual R&B, neo soul and trip hop, and erotic R&B, slow jams and neo soul. These are searched as an extra rank-0 query unless the taste is strict or already plays one of them.
  - `cue.explicit` and an explicit track give +0.2.
  - `titleFit` scores titles against `MOOD_TAGS` (a fit word +0.1, a clash word −0.3).
- **Feelings:** the moods of present characters filed in the last two replies (`mood.msg ≥ lastReply − 2`) are sorted into fear, anger, sad, desire, joy and warm. A character's first word counts 1 and the rest count 0.4. VAD numbers nudge valence and energy.
  - Sad (≥ 1) turns a plain mood melancholy.
  - Fear or anger (≥ 1.4) turns it tense, except in travel.
  - Joy or warmth keeps rain from making a scene melancholy.
  - A meter isn't used: Buffy's `arousal 5` stayed through a day of family scenes.
- **Replay** (`6170f171`, Intimacy explicit, genres erotic, comedy and cozy): romantic 37, sensual 18, erotic 28.
  - The sex scene #218–258 is erotic throughout, with one cut at #218. The build-ups at #80 ("Devoured"), #328 (the pool) and #378 ("The Experiment") each cut in once.
  - The night-1 comfort scene (#18–40) is romantic.
  - #152 "The Empty Shelf" (guilt-grief) is melancholy, and the giddy kitchen scenes in the rain are playful.
  - The chat has 44 song changes, up from 31. The new changes are intimate scenes moving between romantic, sensual and erotic.
  - In `7124f750` the sex scene #98–104 is erotic, with sensual before it.

## 21. The player's mood (1.22.2)

- **Storage:** the chat's `soundtrack.json` keeps `mood` (null or absent is Auto). The page sends `{action: "mood", mood}`.
- **Cue:** `readCue` takes `chosen`. The scene is still read (`read` keeps its mood, and grief and heat are still filed), then the chosen mood replaces the label.
  - The numbers blend 80% toward `MOOD_VEC` instead of 50%.
  - `sharp` is false: the scene can't cut in over the player's choice.
  - `why` is "‹mood› · chosen by you (the scene reads ‹read›)".
  - With the model director, `directorHint` isn't called while a mood is chosen.
- **Director:** a `mood` event sets `lastCue` and, when running, ends a hold or a yield and picks now with a fade, unless the song playing was already picked for that mood. After that every cue has the chosen mood, so the song changes only when the numbers drift past `CHANGE_AT` at a new scene, which rarely happens.
- **UI:** the Soundtrack page's Mood chips (Auto plus `MOODS`, with hints) and the Now window's mood menu (`SoundtrackUI.moodMenu`, opened from the line under the song).
