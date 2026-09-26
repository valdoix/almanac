// Session Zero: the settings conversation at the start of a story, not turn 40.
// Values are written as per-chat overrides the preset reads (alm_cfg_* chat
// variables), and can be saved as this character's defaults for new chats.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { escapeHtml as e } from "../core/util";

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
const THEMES: [string, string][] = [["", "Auto (by genre)"], ["almanac", "Almanac"], ["solar", "Solar Editorial"], ["nocturne", "Nocturne"], ["botanical", "Botanical"], ["prism", "Prism"], ["candy", "Candy"]];
const TRACKERS: [string, string][] = [["scene", "Scene"], ["cast", "Cast"], ["bonds", "Bonds"], ["thoughts", "Thoughts"], ["inventory", "Inventory"], ["threads", "Threads & clocks"], ["knowledge", "Knowledge"], ["consequences", "Consequences"], ["world", "World"]];

export function openSessionZero(ctx: SpindleFrontendContext, chatId: string, current: any) {
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
<label class="f">Calendar<input type="text" id="szCalendar" value="${e(cfg.calendar ?? "")}" placeholder="Gregorian, or weekdays: …; months: …"></label>
<label class="f">Start point<input type="text" id="szStart" value="${e(cfg.startPoint ?? "")}" placeholder="Day 1 · 14 October 1923 · 18:40"></label>
</div>
<h4>Trackers under each reply</h4><div id="almSzTrackers">${TRACKERS.map(([k, l]) => `<button type="button" class="pill${trackers.has(k) ? " on" : ""}" data-t="${k}">${e(l)}</button>`).join("")}</div>
<label class="chk" style="margin-top:10px"><input type="checkbox" id="szSaveChar"> Use these as defaults for new chats with this character</label>
<div class="row" style="margin-top:12px"><button class="btn primary" id="szSave">Begin the story</button><button class="btn" id="szSkip">Skip</button></div>
</div>`;
  const order: string[] = [...(cfg.genres ?? [])];
  modal.root.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    const g = t.closest("[data-g]") as HTMLElement | null;
    if (g) {
      const k = g.dataset.g!;
      const i = order.indexOf(k);
      if (i >= 0) order.splice(i, 1);
      else order.push(k);
      g.classList.toggle("on", order.includes(k));
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
      modal.dismiss();
    } else if (t.id === "szSkip") {
      ctx.sendToBackend({ type: "config", chatId, patch: { sessionZeroDone: true } });
      modal.dismiss();
    }
  });
}
