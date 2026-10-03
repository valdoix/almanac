// Session Zero: the settings conversation at the start of a story, not turn 40.
// Values are written as per-chat overrides the preset reads (alm_cfg_* chat
// variables), and can be saved as this character's defaults for new chats.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { escapeHtml as e } from "../core/util";
import { buildCalendar, dateFor, fmtDate } from "../core/engines/calendar";
import { CALENDAR_PRESETS, presetFor } from "../core/engines/calendars";
import { SKIN_LIST } from "./skins";
import { suggestGenres } from "../core/soundtrack/moods";

export const GENRES: [string, string][] = [
  ["slice_of_life", "Slice of life"], ["romance", "Romance"], ["drama", "Drama"], ["comedy", "Comedy"], ["mystery", "Mystery"],
  ["thriller", "Thriller"], ["horror", "Horror"], ["fantasy", "Fantasy"], ["dark_fantasy", "Dark fantasy"], ["scifi", "Science fiction"],
  ["adventure", "Adventure"], ["noir", "Noir"], ["intrigue", "Political intrigue"], ["tragedy", "Tragedy"], ["action", "Action"],
  ["cozy", "Cozy"], ["survival", "Survival"], ["erotic", "Erotic romance"],
];
const TONES: [string, string][] = [["", "(preset setting)"], ["balanced", "Balanced"], ["warm", "Warm"], ["wry", "Wry"], ["melancholy", "Melancholy"], ["tense", "Tense"], ["lurid", "Lurid"], ["austere", "Austere"]];
const PERSONA: [string, string][] = [["", "(preset setting)"], ["sealed", "Sealed — only I write my persona"], ["continuity", "Continuity — finish my obvious actions"], ["director", "Director — perform what I direct"], ["full_cast", "Full cast — write my persona too"]];
const NSFW: [string, string][] = [["", "(preset setting)"], ["off", "Off"], ["fade", "Fade to black"], ["sensual", "Sensual"], ["explicit", "Explicit (adults only)"]];
const ROMANCE: [string, string][] = [["", "(preset setting)"], ["off", "Off"], ["slow", "Slow burn"], ["measured", "Measured"], ["fast", "Fast"], ["established", "Established couple"]];
const DIFFICULTY: [string, string][] = [["", "(preset setting)"], ["gentle", "Gentle"], ["grounded", "Grounded"], ["hard", "Hard"], ["brutal", "Brutal"]];
const THEMES: [string, string][] = [["", "Auto (by genre)"], ...SKIN_LIST];
const ORIGINAL_CALENDAR = "months: Thaw (30), Bloom (30), [Greenfest], Highsun (30), Harvest (30), Fade (30), Deepwinter (30); weekdays: Firstday, Seconday, Midday, Fourthday, Restday; year: 1 AR; seasons: solar";
const CAL_START_DEFAULT = "Day 1 · 14 October 1923 · 18:40";

/** Which calendar picker entry a setting belongs to. */
function calendarKind(text: string | undefined): string {
  if (!text?.trim() || /^gregorian\b/i.test(text.trim())) return "";
  return presetFor(text)?.id ?? "original";
}

/** "Day 1 is Sterday 22 Halimath 1418 S.R. · early autumn" */
export function calendarPreview(calendar: string, startPoint: string, climate: string, latitude: string): string {
  try {
    const cal = buildCalendar({ calendar, startPoint, climate, latitude });
    return `Day 1 is ${fmtDate(cal, 1)} · ${dateFor(cal, 1).seasonDetail}`;
  } catch {
    return "";
  }
}

const TRACKERS: [string, string][] = [["scene", "Scene"], ["cast", "Cast"], ["bonds", "Bonds"], ["thoughts", "Thoughts"], ["inventory", "Inventory"], ["threads", "Threads & clocks"], ["knowledge", "Knowledge"], ["consequences", "Consequences"], ["world", "World"]];

/**
 * The Soundtrack's row: the player's usual taste, this story's own genres, or no music. `music` is
 * the Soundtrack page's view (null before it has answered); with the Soundtrack off, a pointer to it.
 */
function musicRow(music: any, storyGenres: string[]): string {
  if (!music?.enabled) return `<h4>Soundtrack</h4><p class="muted">YouTube Music can play music for each scene: set it up in the Almanac under Story › Soundtrack.</p>`;
  const own: string[] = music.chatId && music.chatTaste?.genres?.length ? music.chatTaste.genres : [];
  const mode = music.chatOff ? "off" : own.length ? "own" : "usual";
  const usual = (music.taste?.genres ?? []).join(", ") || "the story's genres";
  return `<h4>Soundtrack</h4><div class="grid">
<label class="f">Music in this story<select id="szMusic"><option value="usual"${mode === "usual" ? " selected" : ""}>${e(`My usual taste (${usual})`)}</option><option value="own"${mode === "own" ? " selected" : ""}>Its own genres</option><option value="off"${mode === "off" ? " selected" : ""}>No music in this story</option></select></label>
<label class="f" id="szMusicGenresF"${mode === "own" ? "" : ' style="display:none"'}>Genres for this story<input type="text" id="szMusicGenres" value="${e((own.length ? own : suggestGenres(storyGenres)).join(", "))}" placeholder="film score, celtic folk"></label>
</div>`;
}

export function openSessionZero(ctx: SpindleFrontendContext, chatId: string, current: any, music: any = null) {
  let modal: ReturnType<SpindleFrontendContext["ui"]["showModal"]>;
  try {
    modal = ctx.ui.showModal({ title: "Session Zero · ALMANAC", width: 640, maxHeight: 760 });
  } catch {
    return;
  }
  const cfg = current ?? {};
  const sel = (id: string, opts: [string, string][], val?: string) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${k}"${(val ?? "") === k ? " selected" : ""}>${e(l)}</option>`).join("")}</select>`;
  const genres = new Set<string>(cfg.genres ?? []);
  const trackers = new Set<string>(cfg.trackers ?? ["scene", "cast", "bonds", "thoughts", "inventory", "threads", "knowledge"]);
  modal.root.innerHTML = `<div class="almp alm-sz">
<p class="muted">Set the story up once. These override the preset's settings for this chat only (you can change them any time here or in the Almanac tab).</p>
<h4>Genres (first = lead)</h4><div id="almSzGenres">${GENRES.map(([k, l]) => `<button type="button" class="pill${genres.has(k) ? " on" : ""}" data-g="${k}">${e(l)}</button>`).join("")}</div>
<div class="grid" style="margin-top:10px">
<label class="f">Tone${sel("szTone", TONES, cfg.tone)}</label>
<label class="f">Your persona${sel("szPersona", PERSONA, cfg.personaMode)}</label>
<label class="f">Romance pace${sel("szRomance", ROMANCE, cfg.romance)}</label>
<label class="f">Difficulty${sel("szDifficulty", DIFFICULTY, cfg.difficulty)}</label>
<label class="f">Intimacy${sel("szNsfw", NSFW, cfg.nsfw)}</label>
<label class="f">Skin${sel("szTheme", THEMES, cfg.theme)}</label>
</div>
<label class="f">Hard limits (never depict)<input type="text" id="szLimits" value="${e(cfg.limits ?? "")}" placeholder="e.g. animal harm, body horror"></label>
<h4>World</h4><div class="grid">
<label class="f">Climate and season<input type="text" id="szClimate" value="${e(cfg.climate ?? "")}" placeholder="temperate maritime, late autumn"></label>
<label class="f">Latitude<input type="text" id="szLatitude" value="${e(cfg.latitude ?? "")}" placeholder="temperate · 51 N · southern subpolar"></label>
<label class="f">Calendar${sel("szCalKind", [["", "Gregorian"], ...CALENDAR_PRESETS.map((p): [string, string] => [p.id, p.label]), ["original", "An original world's calendar"]], calendarKind(cfg.calendar))}</label>
<label class="f">Start point<input type="text" id="szStart" value="${e(cfg.startPoint ?? "")}" placeholder="${e(presetFor(cfg.calendar)?.start ?? CAL_START_DEFAULT)}"></label>
</div>
<label class="f">Calendar details<input type="text" id="szCalendar" value="${e(cfg.calendar ?? "")}" placeholder="months: Name (30), [Festival], …; weekdays: … or none; year: 1 AR; seasons: solar or story; moons: Name (days)"></label>
<p class="muted" id="szCalPreview"></p>
<div id="szMusicRow">${musicRow(music, cfg.genres ?? [])}</div>
<h4>Trackers under each reply</h4><div id="almSzTrackers">${TRACKERS.map(([k, l]) => `<button type="button" class="pill${trackers.has(k) ? " on" : ""}" data-t="${k}">${e(l)}</button>`).join("")}</div>
<label class="chk" style="margin-top:10px"><input type="checkbox" id="szSaveChar"> Use these as defaults for new chats with this character</label>
<div class="row" style="margin-top:12px"><button class="btn primary" id="szSave">Begin the story</button><button class="btn" id="szSkip">Skip</button></div>
</div>`;
  const order: string[] = [...(cfg.genres ?? [])];
  const field = (id: string) => modal.root.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement | null;
  const preview = () => {
    const out = field("szCalPreview") as unknown as HTMLElement | null;
    if (out) out.textContent = calendarPreview(field("szCalendar")?.value ?? "", field("szStart")?.value || (field("szStart") as HTMLInputElement | null)?.placeholder || "", field("szClimate")?.value ?? "", field("szLatitude")?.value ?? "");
  };
  modal.root.addEventListener("input", (ev) => {
    if (/^sz(Calendar|Start|Climate|Latitude)$/.test((ev.target as HTMLElement).id)) preview();
  });
  // The story's genres suggest its music until the player types their own.
  let musicTyped = !!music?.chatTaste?.genres?.length;
  const musicGenres = () => field("szMusicGenres") as HTMLInputElement | null;
  modal.root.addEventListener("input", (ev) => {
    if ((ev.target as HTMLElement).id === "szMusicGenres") musicTyped = true;
  });
  modal.root.addEventListener("change", (ev) => {
    if ((ev.target as HTMLElement).id === "szMusic") {
      const f = modal.root.querySelector("#szMusicGenresF") as HTMLElement | null;
      if (f) f.style.display = (ev.target as HTMLSelectElement).value === "own" ? "" : "none";
      return;
    }
    if ((ev.target as HTMLElement).id !== "szCalKind") return;
    const kind = (ev.target as HTMLSelectElement).value;
    const p = CALENDAR_PRESETS.find((x) => x.id === kind);
    const cal = field("szCalendar") as HTMLInputElement;
    cal.value = p ? p.name : kind === "original" ? ORIGINAL_CALENDAR : "";
    (field("szStart") as HTMLInputElement).placeholder = p?.start ?? (kind === "original" ? "Day 1 · 14 Harvest 312 AR · 18:40" : CAL_START_DEFAULT);
    preview();
  });
  preview();
  modal.root.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    const g = t.closest("[data-g]") as HTMLElement | null;
    if (g) {
      const k = g.dataset.g!;
      const i = order.indexOf(k);
      if (i >= 0) order.splice(i, 1);
      else order.push(k);
      g.classList.toggle("on", order.includes(k));
      const mg = musicGenres();
      if (mg && !musicTyped) mg.value = suggestGenres(order).join(", ");
      return;
    }
    const tr = t.closest("[data-t]") as HTMLElement | null;
    if (tr) {
      const k = tr.dataset.t!;
      if (trackers.has(k)) trackers.delete(k);
      else trackers.add(k);
      tr.classList.toggle("on", trackers.has(k));
      return;
    }
    const v = (id: string) => (modal.root.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement | null)?.value?.trim() || undefined;
    if (t.id === "szSave") {
      ctx.sendToBackend({
        type: "sessionZero", chatId, saveForCharacter: (modal.root.querySelector("#szSaveChar") as HTMLInputElement)?.checked,
        config: {
          genres: order, tone: v("szTone"), personaMode: v("szPersona"), romance: v("szRomance"), difficulty: v("szDifficulty"), nsfw: v("szNsfw"),
          theme: v("szTheme"), limits: v("szLimits"), climate: v("szClimate"), latitude: v("szLatitude"), calendar: v("szCalendar"), startPoint: v("szStart"),
          trackers: [...trackers],
        },
      });
      const mm = v("szMusic");
      if (mm && music?.enabled) {
        const was = music.chatOff ? "off" : music.chatTaste?.genres?.length ? "own" : "usual";
        if ((mm === "off") !== (was === "off")) ctx.sendToBackend({ type: "soundtrack", action: "chatOff", chatId, off: mm === "off" });
        if (mm === "own") {
          const genres = (musicGenres()?.value ?? "").split(",").map((g) => g.trim()).filter(Boolean);
          ctx.sendToBackend({ type: "soundtrack", action: "taste", scope: "chat", chatId, taste: { ...(music.chatTaste ?? {}), genres } });
        } else if (was === "own") ctx.sendToBackend({ type: "soundtrack", action: "taste", scope: "chat", chatId, taste: { ...(music.chatTaste ?? {}), genres: [] } });
      }
      modal.dismiss();
    } else if (t.id === "szSkip") {
      ctx.sendToBackend({ type: "config", chatId, patch: { sessionZeroDone: true } });
      modal.dismiss();
    }
  });
}
