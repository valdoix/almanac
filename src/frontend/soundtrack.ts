// Soundtrack (Story › Soundtrack, design/11 §12): YouTube Music scored by the scene. The backend
// holds the player, the director and the taste; this page draws the view it pushes and turns
// clicks into requests. Searches (artists for the lists, songs to play yourself) answer by rid.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { escapeHtml as e } from "../core/util";
import { ic, sec, stk, toggle } from "./ui";
import type { HudMusic } from "./hud";

/** The latest now-playing line, for the page's summary and the HUD. */
export const soundtrackNow = { line: "", mood: "" };

const MOOD_LABEL: Record<string, string> = { combat: "a fight", dread: "dread", adventurous: "adventure" };
const MOOD_HINT: Record<string, string> = {
  calm: "quiet, unhurried", warm: "friendly, easy", playful: "light, teasing", tender: "gentle, close", romantic: "love songs",
  sensual: "slow, seductive", erotic: "sexy: R&B, slow jams", hopeful: "uplifting", triumphant: "victory, big",
  adventurous: "on the road, onward", mysterious: "something hidden", eerie: "uncanny", tense: "on edge", dread: "something terrible is coming",
  combat: "the fight", melancholy: "wistful, sad", grief: "mourning", dreamy: "hazy, floating",
};
const moodName = (m: string) => MOOD_LABEL[m] ?? m;

/** Thumbs for a song: does it fit the mood it played for? `vote` is the one given (1, -1 or 0). */
function thumbs(videoId: string, mood: string, vote: number, sm = true): string {
  const fit = moodName(mood);
  const b = (v: 1 | -1, glyph: string, title: string) => `<button class="btn ${sm ? "sm " : ""}${vote === v ? (v > 0 ? "primary" : "danger") : "ghost"}" data-st="rate" data-vote="${v}" data-id="${e(videoId)}" data-mood="${e(mood)}" aria-pressed="${vote === v}" title="${e(vote === v ? "Take the rating back" : title)}">${glyph}</button>`;
  return b(1, "👍", `Fits ${fit}: more like this for ${fit}`) + b(-1, "👎", `Doesn't fit ${fit}: skip it, and less like it for ${fit}`);
}
const STATUS: Record<string, [string, string]> = {
  connected: ["connected", "good"],
  unknown: ["checking…", ""],
  off: ["not connected", "ghost"],
  "not-running": ["YouTube Music isn't answering", "warn"],
  "not-allowed": ["not allowed", "bad"],
  "no-permission": ["needs permission", "bad"],
  error: ["error", "bad"],
};
const HOW: Record<string, string> = { picked: "♪", "banned-skip": "⤼", user: "★", autoplay: "↻" };
const HOW_TITLE: Record<string, string> = { picked: "chosen by the Almanac", "banned-skip": "skipped: a banned artist", user: "your pick", autoplay: "YouTube Music's autoplay" };

type ListKey = "preferred" | "banned";

export class SoundtrackUI {
  ctx: SpindleFrontendContext;
  getChatId: () => string | undefined;
  rerender: () => void;
  view: any = null;
  /** Which taste the editor shows: everywhere, or this story only. */
  scope: "global" | "chat" = "global";
  artistQ: Record<ListKey, string> = { preferred: "", banned: "" };
  artistHits: Record<ListKey, any[]> = { preferred: [], banned: [] };
  songQ = "";
  songs: any[] = [];
  searching = "";
  error = "";
  /** The Last.fm key check's answer ("" while none). */
  lfmMsg = "";
  /** The HUD's mood picker is open. */
  moodMenu = false;
  private rid = 0;
  private pending = new Map<number, (m: any) => void>();
  private timers: Record<string, ReturnType<typeof setTimeout>> = {};
  private asked = false;

  constructor(ctx: SpindleFrontendContext, getChatId: () => string | undefined, rerender: () => void) {
    this.ctx = ctx;
    this.getChatId = getChatId;
    this.rerender = rerender;
  }

  handle(m: any): boolean {
    if (m?.type === "soundtrack") {
      this.view = m.view;
      const np = m.view?.np;
      soundtrackNow.line = np && m.view.enabled ? `${np.title} · ${np.artist}` : "";
      soundtrackNow.mood = m.view?.cue?.mood ?? "";
      this.ctx.events.emit("almanac:soundtrack", { line: soundtrackNow.line, paused: !!np?.isPaused });
      this.rerender();
      return true;
    }
    if (m?.type === "soundtrackResult" && this.pending.has(m.rid)) {
      this.pending.get(m.rid)!(m);
      this.pending.delete(m.rid);
      return true;
    }
    return false;
  }

  /** The view, when it is this chat's (Session Zero's music row); the global part is enough when it isn't. */
  viewFor(chatId: string): any {
    const v = this.view;
    if (!v) return null;
    return v.chatId === chatId ? v : { ...v, chatId: null, chatTaste: null, chatOff: false };
  }

  /** The HUD's song line: only while a song is loaded and the Soundtrack is on. */
  hudMusic(): HudMusic | null {
    const v = this.view;
    const np = v?.np;
    if (!v?.enabled || !v.connected) return null;
    // Connected but YouTube Music isn't answering: nothing to show or control.
    if (!np?.title && v.status !== "connected") return null;
    return {
      title: np?.title ?? "", artist: np?.artist ?? "", thumb: np?.thumb, videoId: np?.videoId, paused: !!np?.isPaused,
      mood: MOOD_LABEL[v.cue?.mood] ?? v.cue?.mood ?? "", running: !!v.running, mode: String(v.mode ?? ""), origin: String(v.origin ?? ""),
      chosen: !!v.moodPick, pick: v.moodPick ?? "", vote: np?.vote ?? 0, rateFor: np?.mood ? moodName(np.mood) : "",
      menu: this.moodMenu && v.chatId ? [["", "Auto"], ...((v.moods ?? []) as string[]).map((m): [string, string] => [m, moodName(m)])] : null,
    };
  }

  /** A thumb: shown at once (the Ledger's view follows), the same thumb again takes it back. */
  rate(vote: number, videoId?: string, mood?: string) {
    const v = this.view;
    const id = videoId || v?.np?.videoId;
    if (!id || (vote !== 1 && vote !== -1)) return;
    this.send("rate", { vote, videoId: id, mood: mood || v?.np?.mood || undefined });
    const flip = (x: any) => x && x.videoId === id && (!mood || x.mood === mood) && (x.vote = x.vote === vote ? 0 : vote);
    flip(v?.np);
    for (const p of v?.plays ?? []) flip(p);
    this.rerender();
  }

  send(action: string, extra: Record<string, unknown> = {}) {
    this.ctx.sendToBackend({ type: "soundtrack", action, chatId: this.getChatId(), ...extra });
  }

  private call(action: string, extra: Record<string, unknown>): Promise<any> {
    const rid = ++this.rid;
    return new Promise((resolve) => {
      this.pending.set(rid, resolve);
      this.send(action, { ...extra, rid });
      setTimeout(() => {
        if (this.pending.has(rid)) {
          this.pending.delete(rid);
          resolve({ error: "no answer from the Ledger" });
        }
      }, 30_000);
    });
  }

  /** The page asks for the view when it's first drawn (and after a chat switch). */
  ensure() {
    if (this.asked && this.view?.chatId === (this.getChatId() ?? null)) return;
    this.asked = true;
    this.send("get");
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  render(): string {
    this.ensure();
    const v = this.view;
    if (!v) return `<div class="empty">Loading the Soundtrack…</div>`;
    const err = this.error ? `<div class="card flat alm-warnbox"><div class="row"><span class="grow">${e(this.error)}</span><button class="btn" data-st="dismiss">OK</button></div></div>` : "";
    if (!v.enabled && !v.connected) return `${err}${this.intro(v)}`;
    return `${err}${this.player(v)}${this.nowCard(v)}${this.tasteCard(v)}${this.playYourself(v)}${this.history(v)}${this.options(v)}`;
  }

  private intro(v: any): string {
    return `<div class="card"><b style="font:800 18px/1.25 var(--almo-font)">Music for the scene</b>
<p class="muted" style="margin:8px 0 0">The Almanac reads each scene (its mode, the hour, the weather, the place, how tense it is) and plays songs in your taste through <b>YouTube Music</b>: calm music in the tavern, something tense when the knives come out, a new track when the scene changes.</p>
<ol class="alm-list" style="margin:12px 0 0;padding-left:18px">
<li>Install <b>Pear Desktop</b> (the YouTube Music desktop app, <code>pear-devs/pear-desktop</code>) and sign in.</li>
<li>In its <b>Plugins</b> menu, turn on <b>API Server</b> (port 26538).</li>
<li>Press <b>Connect</b> below, then <b>Allow</b> in the app.</li></ol>
${v.hasCors ? "" : `<p class="muted" style="margin:10px 0 0"><small>The Ledger needs the <b>cors_proxy</b> permission to talk to the app; you'll be asked.</small></p>`}
<button class="btn primary wide" style="margin-top:14px" data-st="connect">${ic("play", "sm")}Connect to YouTube Music</button>
${v.statusMsg ? `<p class="muted" style="margin:8px 0 0"><small>${e(v.statusMsg)}</small></p>` : ""}</div>`;
  }

  private player(v: any): string {
    const [label, tone] = STATUS[v.status] ?? [v.status, ""];
    const fixes: Record<string, string> = {
      "not-running": "Open Pear Desktop and turn on Plugins → API Server. The Ledger looks again every 30 seconds.",
      "not-allowed": "Press Connect again and choose Allow in the app (or check API Server → Authorized clients).",
      "no-permission": "Grant the cors_proxy permission so the Ledger can reach the app.",
    };
    const running = v.running;
    return `<div class="card"><div class="almx-row"><b class="grow" style="font:800 17px/1.2 var(--almo-font)">YouTube Music</b>${stk(label, tone as any)}</div>
${fixes[v.status] ? `<p class="muted" style="margin:8px 0 0"><small>${e(fixes[v.status])}</small></p>` : ""}${v.statusMsg && v.status !== "connected" ? `<p class="muted" style="margin:6px 0 0"><small>${e(v.statusMsg)}</small></p>` : ""}
<div class="row" style="margin-top:12px;gap:6px">${v.status === "connected"
      ? running
        ? `<button class="btn grow" data-st="stop">${ic("pause", "sm")}Stop choosing</button>`
        : `<button class="btn primary grow" data-st="start" title="The Almanac picks the music from now on">${ic("play", "sm")}Score this story</button>`
      : `<button class="btn primary grow" data-st="${v.status === "no-permission" ? "grant" : "connect"}">${v.status === "no-permission" ? "Grant permission" : "Connect"}</button>`}
${v.chatId ? `<button class="btn${v.chatOff ? " primary" : ""}" data-st="chatOff" data-off="${v.chatOff ? "" : "1"}" title="${v.chatOff ? "Music for this story again" : "No soundtrack in this story"}">${v.chatOff ? "Off in this story · undo" : "Not in this story"}</button>` : ""}</div>
${v.note ? `<p class="muted" style="margin:8px 0 0"><small>${e(v.note)}</small></p>` : ""}</div>`;
  }

  private nowCard(v: any): string {
    const np = v.np;
    const cue = v.cue;
    const meter = (label: string, x: number, color: string) => `<div style="flex:1;min-width:70px"><small class="muted">${label}</small><div class="bar" style="height:6px;margin-top:3px"><i style="display:block;height:100%;border-radius:inherit;width:${Math.round(Math.max(0, Math.min(1, x)) * 100)}%;background:${color}"></i></div></div>`;
    const mode = v.mode === "holding" ? stk("holding this song", "acc") : v.mode === "yielded" ? stk("your music", "acc2", "You chose a song: the Almanac waits (it takes over again at a new scene if “Take back” is on)") : v.running ? stk("following the scene", "g") : stk("not choosing", "ghost");
    const head = cue?.chosen ? `Your mood: ${e(moodName(cue.mood))}` : cue ? `The scene: ${e(moodName(cue.mood))}` : "";
    const cueBlock = (cue
      ? `<div class="almx-inset" style="margin-top:12px"><div class="almx-row"><b class="grow">${head}</b>${cue.place ? `<small class="muted">${e(cue.place)}</small>` : ""}</div><small class="muted">${e(cue.why)}</small>
<div class="row" style="gap:10px;margin-top:8px;flex-wrap:nowrap">${meter("energy", cue.energy, "var(--alm-warn)")}${meter("brightness", (cue.valence + 1) / 2, "var(--alm-good)")}${meter("tension", cue.tension, "var(--alm-danger)")}</div></div>`
      : `<p class="muted" style="margin:10px 0 0"><small>The scene is read after the next reply in an ALMANAC chat.</small></p>`) + this.moodPicker(v);
    if (!np) return `${sec("Now playing")}<div class="card"><div class="almx-row"><span class="grow muted">Nothing is playing.</span>${mode}</div>${cueBlock}</div>`;
    const pct = np.durationS ? Math.round((np.elapsedS / np.durationS) * 100) : 0;
    const t = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    return `${sec("Now playing")}<div class="card"><div class="almx-row" style="align-items:flex-start;gap:12px">${np.thumb ? `<img src="${e(np.thumb)}" alt="" style="width:64px;height:64px;border-radius:8px;object-fit:cover;flex:none">` : ""}<div class="grow" style="min-width:0"><b style="font:800 16px/1.25 var(--almo-font)">${e(np.title)}</b><div>${e(np.artist)}${np.album ? ` <small class="muted">· ${e(np.album)}</small>` : ""}</div><div class="row" style="gap:6px;margin-top:6px">${mode}${v.origin === "user" ? stk("you chose it", "acc") : v.origin === "autoplay" ? stk("autoplay", "ghost") : ""}</div></div></div>
<div class="bar" style="height:4px;margin-top:10px"><i style="display:block;height:100%;border-radius:inherit;width:${pct}%;background:var(--g)"></i></div><div class="row" style="margin-top:2px"><small class="muted grow">${t(np.elapsedS)}</small><small class="muted">${t(np.durationS)}</small></div>
${np.why ? `<p class="muted" style="margin:6px 0 0"><small>Why: ${e(np.why)}</small></p>` : ""}
${v.next ? `<p class="muted" style="margin:4px 0 0"><small>Up next: <b>${e(v.next.title)}</b> · ${e(v.next.artist)}</small></p>` : ""}
${np.mood ? `<div class="row" style="margin-top:12px;gap:6px;align-items:center"><small class="muted grow">Does it fit ${e(moodName(np.mood))}?${np.vote ? ` You said ${np.vote > 0 ? "yes" : "no"}.` : ""}</small>${thumbs(np.videoId, np.mood, np.vote ?? 0)}</div>` : ""}
<div class="row" style="margin-top:8px;gap:6px">${np.isPaused ? `<button class="btn sm" data-st="play">${ic("play", "sm")}Play</button>` : `<button class="btn sm" data-st="pause">${ic("pause", "sm")}Pause</button>`}<button class="btn sm" data-st="skip" title="Another song for this scene; this one counts against itself for this mood">${ic("forward", "sm")}Skip</button><button class="btn sm${v.mode === "holding" ? " primary" : ""}" data-st="hold" data-on="${v.mode === "holding" ? "" : "1"}" title="Keep this song going until the scene changes">${v.mode === "holding" ? "Holding · release" : "Hold"}</button><span class="grow"></span><button class="btn sm ghost" data-st="never" data-id="${e(np.videoId)}" title="Never play this song again">Never this song</button><button class="btn sm danger" data-st="ban" data-name="${e(np.artist.split(/,| & | and | x | feat\.? /i)[0].trim())}" title="Add the artist to your banned list (and skip)">Ban artist</button></div>
${cueBlock}</div>`;
  }

  /** The music's mood: Auto (the scene decides) or one the player holds for this story. */
  private moodPicker(v: any): string {
    if (!v.chatId) return "";
    const pick: string = v.moodPick ?? "";
    const chip = (k: string, label: string, title: string) => `<button type="button" data-st="mood" data-mood="${e(k)}" aria-pressed="${k === pick}" title="${e(title)}">${e(label)}</button>`;
    return `<div class="almx-lbl" style="margin-top:14px">Mood</div><p class="muted" style="margin:2px 0 6px"><small>${pick ? `The music stays ${e(moodName(pick))} in this story, whatever the scene does, until you choose Auto.` : "Auto: the scene decides. Choose a mood to hold it in this story; the song changes at once."}</small></p>
<div class="almx-chips">${chip("", "Auto", "The scene decides")}${((v.moods ?? []) as string[]).map((m) => chip(m, moodName(m), MOOD_HINT[m] ?? "")).join("")}</div>`;
  }

  private tasteCard(v: any): string {
    const chat = this.scope === "chat" && !!v.chatId;
    const own = chat ? v.chatTaste : v.taste;
    const t = { ...v.taste, ...(chat ? { genres: [], preferred: [], banned: [], bannedWords: [] } : {}), ...(own ?? {}) };
    const genres: string[] = t.genres ?? [];
    const chips = [...new Set<string>([...genres, ...(v.suggestions ?? []), ...(v.chips ?? [])])];
    const list = (key: ListKey, title: string, hint: string) => {
      const items: any[] = t[key] ?? [];
      const hits = this.artistHits[key];
      return `<div class="almx-lbl" style="margin-top:14px">${title}</div><p class="muted" style="margin:2px 0 6px"><small>${hint}</small></p>
<div class="row" style="gap:6px">${items.map((a, i) => `<span class="pill${key === "banned" ? "" : " on"}">${e(a.name)} <a href="#" data-st="unlist" data-list="${key}" data-i="${i}" title="Remove" style="color:inherit;text-decoration:none;margin-left:2px">×</a></span>`).join("") || `<span class="muted"><small>none</small></span>`}</div>
<div class="row" style="margin-top:6px;gap:6px"><input type="text" class="grow" data-stq="${key}" value="${e(this.artistQ[key])}" placeholder="Find an artist…" aria-label="${title}"><button class="btn sm" data-st="addArtist" data-list="${key}" title="Add as typed">Add</button></div>
${this.searching === key ? `<small class="muted">searching…</small>` : ""}${hits.length ? `<div class="almx-chips" style="margin-top:6px">${hits.map((h, i) => `<button type="button" data-st="pickArtist" data-list="${key}" data-i="${i}" title="${e(h.subtitle ?? "")}">${e(h.name)}</button>`).join("")}</div>` : ""}`;
    };
    const opt = (k: string, cur: string, opts: [string, string, string?][]) => toggle(`st:${k}`, cur, opts);
    return `${sec("Your taste")}<div class="card">
${v.chatId ? `<div style="margin-bottom:12px">${toggle("st:scope", chat ? "chat" : "global", [["global", "Everywhere"], ["chat", "This story only"]], "Which taste")}</div>${chat ? `<p class="muted" style="margin:-4px 0 10px"><small>${v.chatTaste ? "This story has its own genres and favourites; bans add to your global ones." : "This story uses your global taste. Choosing anything here gives it its own."}${v.chatTaste ? ` <a href="#" data-st="clearChat">Use the global taste</a>` : ""}</small></p>` : ""}` : ""}
<div class="almx-lbl">Genres</div><p class="muted" style="margin:2px 0 6px"><small>${genres.length ? "" : "None chosen: the story's genres pick. "}Now playing from: ${e((v.effectiveGenres ?? []).join(", ") || "—")}</small></p>
<div class="almx-chips">${chips.map((g) => `<button type="button" data-st="genre" data-g="${e(g)}" aria-pressed="${genres.includes(g)}">${e(g)}</button>`).join("")}</div>
<div class="row" style="margin-top:6px;gap:6px"><input type="text" class="grow" id="almStGenre" placeholder="Another genre (city pop, dungeon synth…)"><button class="btn sm" data-st="addGenre">Add</button></div>
<div style="margin-top:10px">${opt("genreMode", t.genreMode, [["blend", "Blend with the story", 'title="Your genres, plus a little of what suits the story"'], ["strict", "Only mine", 'title="Only the genres you chose"']])}</div>
${list("preferred", "Preferred artists", "Searched first and favoured when they fit the scene.")}
${list("banned", "Banned artists", "Never chosen, and skipped when YouTube Music's autoplay plays them. A song you pick yourself always plays.")}
<div class="almx-lbl" style="margin-top:14px">Banned words</div><p class="muted" style="margin:2px 0 6px"><small>Songs with these in the title or credits are left out (comma-separated).</small></p>
<input type="text" id="almStWords" value="${e((t.bannedWords ?? []).join(", "))}" placeholder="live, remix, nightcore" data-stw="1">
<div class="almx-lbl" style="margin-top:14px">Vocals</div><div style="margin-top:6px">${opt("vocals", t.vocals, [["any", "Any"], ["quiet-in-dialogue", "Quiet under dialogue", 'title="Leans to instrumentals while people talk"'], ["instrumental", "Instrumental only"]])}</div>
<div class="almx-lbl" style="margin-top:14px">Variety</div><div style="margin-top:6px">${opt("variety", t.variety, [["focused", "Mostly my artists"], ["balanced", "Balanced"], ["wide", "Wide", 'title="Further from your artists and genres"']])}</div>
<div class="row" style="margin-top:12px;gap:14px"><label class="chk"><input type="checkbox" data-stc="explicit"${t.explicit ? " checked" : ""}> Explicit songs</label><label class="chk"><input type="checkbox" data-stc="videos"${t.videos ? " checked" : ""}> Music videos (not just songs)</label></div></div>`;
  }

  private playYourself(v: any): string {
    if (v.status !== "connected") return "";
    return `${sec("Play something yourself")}<div class="card"><p class="muted" style="margin:0 0 8px"><small>Your pick always plays, even a banned artist. The Almanac steps back until the next scene${v.takeBack ? "" : " (or until you press Score this story)"}.</small></p>
<div class="row" style="gap:6px"><input type="text" class="grow" id="almStSong" value="${e(this.songQ)}" placeholder="Song or artist"><button class="btn" data-st="findSong">${ic("search", "sm")}Find</button></div>
${this.searching === "songs" ? `<small class="muted">searching…</small>` : ""}${this.songs.length ? `<div class="almx-rows" style="margin-top:8px">${this.songs.map((s, i) => `<div class="almx-row">${s.thumb ? `<img src="${e(s.thumb)}" alt="" style="width:36px;height:36px;border-radius:6px;object-fit:cover">` : ""}<div class="grow" style="min-width:0"><b>${e(s.title)}</b><div><small class="muted">${e(s.artist)}${s.durationS ? ` · ${Math.floor(s.durationS / 60)}:${String(s.durationS % 60).padStart(2, "0")}` : ""}${s.banned ? " · banned for the Almanac" : ""}</small></div></div><button class="btn sm" data-st="playSong" data-i="${i}">${ic("play", "sm")}</button></div>`).join("")}</div>` : ""}</div>`;
  }

  private history(v: any): string {
    const plays: any[] = v.plays ?? [];
    if (!plays.length) return "";
    return `${sec("Played in this story", plays.length)}<div class="card almx-rows" style="padding:2px 16px">${plays.map((p) => `<div class="almx-row" style="align-items:flex-start"><span title="${e(HOW_TITLE[p.how] ?? "")}" style="width:16px;text-align:center">${HOW[p.how] ?? "·"}</span><div class="grow" style="min-width:0"><b>${e(p.title)}</b> <small class="muted">· ${e(p.artist)}</small><div><small class="muted">${e(new Date(p.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}${p.mood ? ` · ${e(MOOD_LABEL[p.mood] ?? p.mood)}` : ""}${p.how === "banned-skip" ? ` · skipped: ${e(p.reason ?? "")}` : p.reason ? ` · ${e(p.reason)}` : ""}</small></div></div>${p.mood && p.how !== "banned-skip" ? `<span class="row" style="gap:2px;flex:none">${thumbs(p.videoId, p.mood, p.vote ?? 0)}</span>` : ""}</div>`).join("")}</div>${this.learned(v)}`;
  }

  /** What the thumbs taught: per mood, and the latest ratings (each can be taken back). */
  private learned(v: any): string {
    const r = v.ratings;
    if (!r?.total) return `<p class="muted" style="margin:8px 2px 0"><small>👍 a song that fits the scene and 👎 one that doesn't: the Almanac learns the songs, artists and genres you like for each mood.</small></p>`;
    return `<details class="card tight" style="margin-top:12px"><summary><b>What your thumbs taught it</b> <small class="muted">· ${r.total} rating${r.total === 1 ? "" : "s"}</small></summary><div style="margin-top:10px">
<p class="muted" style="margin:0 0 8px"><small>Songs you rated up come back for that mood (and moods close to it); songs rated down never play for it again. Their artists and genres rise or sink for the mood too. Ratings count in every story.</small></p>
<div class="row" style="gap:6px">${r.summary.map((x: any) => `<span class="pill">${e(moodName(x.mood))} <small class="muted">${x.up ? `👍${x.up}` : ""}${x.up && x.down ? " " : ""}${x.down ? `👎${x.down}` : ""}</small></span>`).join("")}</div>
<div class="almx-rows" style="margin-top:8px">${r.recent.map((x: any) => `<div class="almx-row"><span style="width:18px;text-align:center">${x.vote > 0 ? "👍" : "👎"}</span><div class="grow" style="min-width:0"><b>${e(x.title)}</b> <small class="muted">· ${e(x.artist)} · ${e(moodName(x.mood))}</small></div><button class="btn sm ghost" data-st="unrate" data-id="${e(x.videoId)}" data-mood="${e(x.mood)}" title="Forget this rating">×</button></div>`).join("")}</div>
<div class="row" style="margin-top:8px"><span class="grow"></span><button class="btn sm ghost" data-st="forgetRatings" title="Forget every rating">Forget all ratings</button></div></div></details>`;
  }

  private options(v: any): string {
    return `<details class="card tight" style="margin-top:12px"><summary><b>How it plays</b></summary><div style="margin-top:10px">
<label class="chk"><input type="checkbox" data-sto="cutOnSharp"${v.cutOnSharp ? " checked" : ""}> Cut in at a sharp turn (a fight breaks out, a death): the song changes at once, with a fade</label>
<label class="chk"><input type="checkbox" data-sto="takeBack"${v.takeBack ? " checked" : ""}> Take the music back at a new scene after you played something yourself</label>
<label class="chk"><input type="checkbox" data-sto="fade"${v.fade ? " checked" : ""}> Fade out before changing songs</label>
<div class="almx-lbl" style="margin-top:12px">Reading the scene</div><div style="margin-top:6px">${toggle("st:director", v.director, [["engine", "The engine", 'title="Free: from the filed state alone"'], ["model", "Engine + model", 'title="One short model call at each new scene"']])}</div>
<p class="muted" style="margin:6px 0 0"><small>${v.director === "model" ? "At each new scene a short call asks the model for the mood (it may only judge what's on the page). It uses the summariser's connection." : "The mood comes from the filed state: mode, hour, weather, place, wounds, deadlines, what the people present feel and the words of the last exchange. Intimate scenes are tender, romantic, sensual (kissing, building desire) or erotic (sex on the page); your story's Intimacy setting caps them."}</small></p>
${this.lastfm(v)}
<label class="f" style="margin-top:12px">Player address<input type="text" data-sturl="1" value="${e(v.playerUrl)}"></label>
<div class="row" style="margin-top:10px;gap:6px"><button class="btn sm" data-st="clearCache" title="Forget the cached searches (they refresh on their own after a week)">Forget searches</button><span class="grow"></span>${v.connected ? `<button class="btn sm danger" data-st="disconnect">Disconnect</button>` : ""}<button class="btn sm ghost" data-st="disable">Turn the Soundtrack off</button></div></div></details>`;
  }

  /** Listener tags from Last.fm: an optional check on whether a song fits the mood. */
  private lastfm(v: any): string {
    const head = `<div class="almx-lbl" style="margin-top:12px">Listener tags (Last.fm)</div>`;
    if (v.lastfm) {
      return `${head}<div class="row" style="margin-top:6px;gap:6px">${v.lastfmBad ? stk("key refused", "bad", v.lastfmBad) : stk("on", "good")}<small class="muted grow">Each pick's best ten songs are checked against how listeners tag them (“sad”, “epic”, “chill”). Songs tagged against the mood drop.</small><button class="btn sm ghost" data-st="lfmClear">Remove key</button></div>`;
    }
    return `${head}<p class="muted" style="margin:6px 0 0"><small>Optional. YouTube Music's search matches words; Last.fm's tags say how people hear a song, so a “party” track stops turning up in a grief scene. You don't need to use Last.fm: make a free account, then create an API key at last.fm/api/account/create (any name; the callback can stay empty) and paste the key here. Lookups are cached for a month.</small></p>
<div class="row" style="margin-top:6px;gap:6px"><input type="password" class="grow" id="almStLfm" placeholder="Last.fm API key (32 characters)" autocomplete="off" spellcheck="false"><button class="btn sm" data-st="lfmSave">Check and save</button></div>${this.lfmMsg ? `<small class="muted"${this.lfmMsg.startsWith("✓") || this.lfmMsg.startsWith("checking") ? "" : ' style="color:var(--alm-danger)"'}>${e(this.lfmMsg)}</small>` : ""}`;
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  private tasteNow(): any {
    const v = this.view;
    if (this.scope === "chat" && v?.chatId) return { ...(v.chatTaste ?? { genres: [], preferred: [], banned: [], bannedWords: [], genreMode: v.taste.genreMode, vocals: v.taste.vocals, variety: v.taste.variety, explicit: v.taste.explicit, videos: v.taste.videos }) };
    return { ...v.taste };
  }

  private saveTaste(t: any) {
    const chat = this.scope === "chat" && !!this.view?.chatId;
    if (chat) this.view.chatTaste = t;
    else this.view.taste = t;
    this.send("taste", { scope: chat ? "chat" : "global", taste: t });
    this.rerender();
  }

  private async grant(): Promise<boolean> {
    try {
      await this.ctx.permissions.request(["cors_proxy" as any], { reason: "Reach YouTube Music (Pear Desktop) on this computer, and search YouTube Music for songs that fit the scene." } as any);
      return true;
    } catch {
      return false;
    }
  }

  onClick(t: HTMLElement, ev?: Event): boolean {
    const tg = (t.closest("[data-act^='st:']") as HTMLElement | null)?.dataset;
    if (tg?.act) {
      const k = tg.act.slice(3);
      const id = tg.id ?? "";
      if (k === "scope") {
        this.scope = id === "chat" ? "chat" : "global";
        this.rerender();
      } else if (k === "director") this.send("config", { patch: { director: id } });
      else this.saveTaste({ ...this.tasteNow(), [k]: id });
      return true;
    }
    const el = t.closest("[data-st]") as HTMLElement | null;
    if (!el) return false;
    const d = el.dataset;
    if (el.tagName === "A") ev?.preventDefault();
    switch (d.st) {
      case "dismiss": this.error = ""; this.rerender(); break;
      case "connect":
        void (async () => {
          if (!this.view?.hasCors && !(await this.grant())) {
            this.error = "Without the cors_proxy permission the Ledger can't reach YouTube Music.";
            this.rerender();
            return;
          }
          this.send("config", { patch: { enabled: true } });
          this.send("connect");
        })();
        break;
      case "grant": void this.grant().then((ok) => ok && this.send("connect")); break;
      case "start": case "stop": case "skip": case "pause": case "play": case "clearCache": case "disconnect":
        this.send(d.st);
        break;
      case "hold": this.send("hold", { on: !!d.on }); break;
      case "rate": this.rate(Number(d.vote), d.id, d.mood); break;
      case "unrate": this.send("rateForget", { videoId: d.id, mood: d.mood }); break;
      case "forgetRatings": if (confirm("Forget every song rating? The Almanac stops using what they taught.")) this.send("rateForget", {}); break;
      case "mood":
        this.send("mood", { mood: d.mood || null });
        if (this.view) this.view.moodPick = d.mood || null;
        this.rerender();
        break;
      case "lfmSave": {
        const inp = t.closest(".card")?.querySelector("#almStLfm") as HTMLInputElement | null;
        const key = inp?.value.trim() ?? "";
        if (!key) break;
        this.lfmMsg = "checking the key…";
        this.rerender();
        void this.call("lastfmKey", { key }).then((r) => {
          this.lfmMsg = r?.ok ? "✓ saved" : String(r?.error ?? "no answer");
          this.rerender();
        });
        break;
      }
      case "lfmClear": this.lfmMsg = ""; this.send("lastfmClear"); break;
      case "chatOff": this.send("chatOff", { off: !!d.off }); break;
      case "never": this.send("never", { videoId: d.id }); break;
      case "ban": if (d.name) this.send("ban", { name: d.name }); break;
      case "disable": this.send("config", { patch: { enabled: false } }); break;
      case "clearChat": this.send("taste", { scope: "chat", taste: null }); if (this.view) this.view.chatTaste = null; this.rerender(); break;
      case "genre": {
        const cur = this.tasteNow();
        const g = d.g ?? "";
        const genres: string[] = cur.genres ?? [];
        this.saveTaste({ ...cur, genres: genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g] });
        break;
      }
      case "addGenre": {
        const inp = t.closest(".card")?.querySelector("#almStGenre") as HTMLInputElement | null;
        const g = inp?.value.trim().toLowerCase();
        if (!g) break;
        const cur = this.tasteNow();
        if (!(cur.genres ?? []).includes(g)) this.saveTaste({ ...cur, genres: [...(cur.genres ?? []), g] });
        break;
      }
      case "unlist": {
        const key = d.list as ListKey;
        const cur = this.tasteNow();
        this.saveTaste({ ...cur, [key]: (cur[key] ?? []).filter((_: any, i: number) => i !== Number(d.i)) });
        break;
      }
      case "addArtist": {
        const key = d.list as ListKey;
        const name = this.artistQ[key].trim();
        if (name) this.addArtist(key, { name });
        break;
      }
      case "pickArtist": {
        const key = d.list as ListKey;
        const h = this.artistHits[key][Number(d.i)];
        if (h) this.addArtist(key, { name: h.name, id: h.id });
        break;
      }
      case "findSong": {
        const inp = this.rootOf(t)?.querySelector("#almStSong") as HTMLInputElement | null;
        this.songQ = inp?.value ?? this.songQ;
        void this.findSongs();
        break;
      }
      case "playSong": {
        const s = this.songs[Number(d.i)];
        if (s) this.send("playSong", { videoId: s.videoId });
        break;
      }
      default: return false;
    }
    return true;
  }

  private rootOf(t: HTMLElement): HTMLElement | null {
    return t.closest(".almo-body") as HTMLElement | null;
  }

  private addArtist(key: ListKey, a: { name: string; id?: string }) {
    const cur = this.tasteNow();
    const list: any[] = cur[key] ?? [];
    if (!list.some((x) => x.name.toLowerCase() === a.name.toLowerCase())) this.saveTaste({ ...cur, [key]: [...list, a] });
    this.artistQ[key] = "";
    this.artistHits[key] = [];
    this.rerender();
  }

  private async findSongs() {
    if (!this.songQ.trim()) return;
    this.searching = "songs";
    this.rerender();
    const r = await this.call("searchSongs", { q: this.songQ });
    this.searching = "";
    if (r.error) this.error = String(r.error);
    this.songs = r.songs ?? [];
    this.rerender();
  }

  /** Typing in an artist box: search after a pause. */
  onInput(t: HTMLInputElement): boolean {
    const key = t.dataset?.stq as ListKey | undefined;
    if (!key) return false;
    this.artistQ[key] = t.value;
    clearTimeout(this.timers[key]);
    const q = t.value.trim();
    if (q.length < 2) {
      this.artistHits[key] = [];
      return true;
    }
    this.timers[key] = setTimeout(async () => {
      this.searching = key;
      this.rerender();
      const r = await this.call("searchArtists", { q });
      this.searching = "";
      if (this.artistQ[key].trim() !== q) return;
      if (r.error) this.error = String(r.error);
      this.artistHits[key] = r.hits ?? [];
      this.rerender();
      const box = document.querySelector(`[data-stq="${key}"]`) as HTMLInputElement | null;
      if (box) {
        box.focus();
        box.setSelectionRange(box.value.length, box.value.length);
      }
    }, 450);
    return true;
  }

  onChange(t: HTMLInputElement): boolean {
    const d = t.dataset ?? {};
    if (d.stc) {
      this.saveTaste({ ...this.tasteNow(), [d.stc]: t.checked });
      return true;
    }
    if (d.sto) {
      this.send("config", { patch: { [d.sto]: t.checked } });
      return true;
    }
    if (d.stw) {
      this.saveTaste({ ...this.tasteNow(), bannedWords: t.value.split(",").map((x) => x.trim()).filter(Boolean) });
      return true;
    }
    if (d.sturl) {
      this.send("config", { patch: { playerUrl: t.value.trim() } });
      return true;
    }
    if (t.id === "almStSong") {
      this.songQ = t.value;
      return true;
    }
    return false;
  }

  onKeydown(ev: KeyboardEvent): boolean {
    const t = ev.target as HTMLInputElement;
    if (ev.key !== "Enter" || !t) return false;
    if (t.id === "almStSong") {
      this.songQ = t.value;
      void this.findSongs();
      return true;
    }
    if (t.id === "almStLfm") {
      (t.closest(".card")?.querySelector('[data-st="lfmSave"]') as HTMLElement | null)?.click();
      return true;
    }
    if (t.id === "almStGenre") {
      (t.closest(".card")?.querySelector('[data-st="addGenre"]') as HTMLElement | null)?.click();
      return true;
    }
    const key = t.dataset?.stq as ListKey | undefined;
    if (key) {
      const first = this.artistHits[key][0];
      this.addArtist(key, first && first.name.toLowerCase() === t.value.trim().toLowerCase() ? { name: first.name, id: first.id } : { name: t.value.trim() });
      return true;
    }
    return false;
  }
}
