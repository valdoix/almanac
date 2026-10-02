// The "Almanac" drawer tab, with Orrery navigation (see orrery.ts): Now, and
// People (Cast · Bonds · Knowledge), Story (Chronicle · Timeline · World),
// Library (Codex · Lore · Creator) and Engine (Recall · Craft · Settings).

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { escapeHtml as e, initials, kpNote } from "../core/util";
import { PRESET_VERSION, olderThan } from "../core/version";
import { renderGraph, type GEdge, type GNode } from "./graph";
import { CreatorUI } from "./creator-ui";
import { VERSION } from "../core/version";
import { SKIN_COLORS, SKIN_LIST, skinPalette } from "./skins";
import { NOT_A_PERSON } from "../core/state";
import { PAGES, dock, emptySky, engineKeys, groupOf, pageTitle, skyHeader, type Page } from "./orrery";

type Tab = Page;
const TABS = PAGES;
const RANK: Record<string, number> = { chapter: 1, arc: 2, volume: 3 };
// Chronicle levels, matching the coverage bar.
const LEVEL_COLOR: Record<string, string> = { volume: "#7b5bd6", arc: "var(--alm-accent-2)", chapter: "var(--alm-accent)" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const KIND_HELP: Record<string, string> = {
  secret: "Someone keeps it, or someone lacks it while someone else has it",
  belief: "Someone suspects, believes, doubts or is wrong about it",
  shared: "Two or more people have it",
  noted: "One person noticed it; no one is known to lack it (never sent to the model)",
};

// Lumiverse's Dream Weaver book roles: [label, what the book does].
const WEAVER_BOOK: Record<string, [string, string]> = {
  governance: ["rules book", "Always-on rules and the re-anchor that keep the character on spec. Left to Lumiverse: the Ledger never folds, forces or switches these entries off."],
  lore: ["lore book", "The world's deep lore, surfacing when relevant."],
  npc: ["NPC book", "The people the narrator can voice, one entry per person."],
  depth: ["depth book", "More about the card's character. Entries that script a scene (\"When she learns…\", \"It happens in the kitchen…\") are read as playbooks: never sent as lore, and sent as \"not history\" only when a turn comes close."],
  persona: ["persona depth", "More about your persona, surfacing when relevant."],
};
// How each category reads in the Lore tab, in display order.
const LORE_KINDS: [string, string, string][] = [
  ["directive", "always-on rule", "always-on rules"], ["person", "person", "people"], ["place", "place", "places"], ["group", "group", "groups"],
  ["object", "object", "objects"], ["bond", "relationship", "relationships"], ["law", "world rule", "world rules"], ["history", "history", "history"], ["situation", "situation", "situations"],
  ["belief", "belief", "beliefs"], ["forecast", "upcoming event", "upcoming events"], ["boundary", "canon point", "canon points"],
  ["texture", "custom or detail", "customs & detail"], ["playbook", "scripted scene", "scripted scenes"], ["meta", "instruction", "instructions"],
];
/** A Dream Weaver world card: the narrator runs this place, and an agency world moves on its own. */
function worldPanel(w: any, simulator: boolean): string {
  if (!w) return "";
  const agency = w.agenda || w.holds?.length;
  return `<div class="rec" style="margin-bottom:10px"><div class="hd"><b class="grow">${e(w.name)}</b><span class="pill" title="A world built in Lumiverse's Dream Weaver: you chat with a narrator that runs this place and voices its people">Dream Weaver · world</span><span class="pill">${agency ? "agency on" : "cozy"}</span></div>
${w.premise ? `<div class="alm-cc__row"><b>premise</b>${e(w.premise)}</div>` : ""}${w.tension ? `<div class="alm-cc__row"><b>tension</b>${e(w.tension)}</div>` : ""}${w.agenda ? `<div class="alm-cc__row"><b>agenda</b>${e(w.agenda)}</div>` : ""}${w.holds?.length ? `<div class="alm-cc__row"><b>holds</b>${w.holds.map((h: string) => e(h)).join("<br>")}</div>` : ""}
<p class="muted">The card is the narrator, and the place is a Codex record. Chapters call its replies the Narrator's.${agency ? (simulator ? " Between scenes, the off-screen simulator moves the world's agenda and never breaks its holds." : " Turn on the off-screen simulator (Settings) to have the world's agenda move between scenes.") : ""}</p></div>`;
}

function loreKinds(kinds?: Record<string, number>): string {
  if (!kinds) return "";
  const known = new Map(LORE_KINDS.map(([k, one, many]) => [k, [one, many]]));
  const label = (k: string) => known.get(k)?.[kinds[k] === 1 ? 0 : 1] ?? k;
  const parts = [...LORE_KINDS.map(([k]) => k), ...Object.keys(kinds).filter((k) => !known.has(k))].filter((k) => kinds[k]).map((k) => `${kinds[k]} ${label(k)}`);
  return parts.length ? `<div class="muted" style="margin:4px 0">Read as: ${e(parts.join(" · "))}</div>` : "";
}

const PERSON_OPTS: [string, string][] = [["", "as the story says"], ["knows", "knows it"], ["believes", "believes it"], ["suspects", "suspects it"], ["doubts", "doubts it"], ["wrong", "has it wrong"], ["unaware", "doesn't know"], ["none", "no record either way"]];

export class AlmanacApp {
  ctx: SpindleFrontendContext;
  root: HTMLElement;
  view: any = null;
  tab: Tab = "now";
  asOf = Infinity;
  graphAxis = "";
  npcOnly = false;
  /** Knowledge page: search text, which facts to list, one person, the fact being edited, open histories, clerk progress. */
  factQuery = "";
  factKind: "play" | "shared" | "noted" | "all" = "play";
  factPerson = "";
  editingFact: string | null = null;
  /** Cast page: the character being edited ("__new": adding someone). */
  editingChar: string | null = null;
  openFacts = new Set<string>();
  clerkProgress = "";
  /** Chronicle page: which level to list, and which units show their folded children. */
  chronFilter: "all" | "volume" | "arc" | "chapter" = "all";
  chronOpen = new Set<string>();
  codexFilter = "";
  codexKind = "";
  editing: string | null = null;
  orbit = "";
  creator: CreatorUI;
  status: "nochat" | "waiting" | "stalled" | "ok" = "nochat";
  hudProblem = "";
  versionWarning = "";
  /** A message from the background process (shown at the top until dismissed). */
  notice: { tone: string; text: string; at: number } | null = null;
  /** Per chat, the Engine findings the player has already looked at (kept in this browser). */
  engineSeen: Record<string, string[]> = {};
  /** Called when the Engine's unseen count may have changed (the drawer tab's badge follows it). */
  onSeen: () => void = () => {};

  constructor(ctx: SpindleFrontendContext, root: HTMLElement) {
    this.ctx = ctx;
    this.root = root;
    this.root.classList.add("almp");
    this.creator = new CreatorUI(ctx, () => this.view, () => this.render());
    try {
      const t = localStorage.getItem("alm-tab") as Tab | null;
      if (t && (TABS as readonly string[]).includes(t)) this.tab = t;
    } catch {
      /* private mode */
    }
    try {
      this.engineSeen = JSON.parse(localStorage.getItem("alm-engine-seen") || "{}") ?? {};
    } catch {
      this.engineSeen = {};
    }
    this.root.addEventListener("click", (ev) => this.onClick(ev));
    this.root.addEventListener("change", (ev) => this.onChange(ev));
    // A colour picker repaints the skin while it's dragged; letting go saves it (onChange).
    this.root.addEventListener("input", (ev) => {
      const t = ev.target as HTMLInputElement;
      if (this.creator.onInput(t)) return;
      if (t?.dataset?.skinColor) this.ctx.events.emit("almanac:skinColors", this.withSkinColor(t.dataset.skinColor, t.value));
    });
    // The creator's message box keeps its focus and caret across redraws.
    this.root.addEventListener("focusin", (ev) => this.creator.onFocus(ev.target as HTMLElement, true));
    this.root.addEventListener("focusout", (ev) => this.creator.onFocus(ev.target as HTMLElement, false));
    this.root.addEventListener("keydown", (ev) => {
      if (this.creator.onKeydown(ev as KeyboardEvent)) return;
      if ((ev as KeyboardEvent).key === "Escape" && this.orbit) {
        this.orbit = "";
        this.render();
      }
    });
  }

  send(msg: Record<string, unknown>) {
    this.ctx.sendToBackend({ chatId: this.view?.chatId, ...msg });
  }

  setStatus(s: AlmanacApp["status"]) {
    if (s === this.status) return;
    this.status = s;
    if (!this.view || s === "nochat") this.render();
  }

  setView(v: any) {
    this.view = v;
    this.render();
  }

  seenSet(): Set<string> {
    return new Set(this.view?.chatId ? this.engineSeen[this.view.chatId] ?? [] : []);
  }

  /** Opening the Engine counts as looking at what it found. */
  markEngineSeen() {
    const v = this.view;
    if (!v?.chatId) return;
    const keys = engineKeys(v);
    const had = this.engineSeen[v.chatId] ?? [];
    if (keys.every((k) => had.includes(k))) return;
    delete this.engineSeen[v.chatId];
    this.engineSeen[v.chatId] = keys;
    const chats = Object.keys(this.engineSeen);
    if (chats.length > 60) for (const c of chats.slice(0, chats.length - 60)) delete this.engineSeen[c];
    try {
      localStorage.setItem("alm-engine-seen", JSON.stringify(this.engineSeen));
    } catch {
      /* private mode */
    }
    this.onSeen();
  }

  render() {
    const v = this.view;
    if (!v) {
      this.root.innerHTML = `<div class="almo">${emptySky(this.status)}</div>`;
      return;
    }
    let body = "";
    try {
      body = (this as any)[`tab_${this.tab}`]?.(v) ?? "";
    } catch (err) {
      body = `<div class="empty">Could not draw this page: ${e(String(err))}</div>`;
    }
    const stale = this.versionWarning
      ? `<div class="card flat alm-warnbox"><b>The Ledger's background process is running ${e(this.versionWarning)}, but this page loaded ${VERSION}.</b><p class="muted">In Extensions, turn ALMANAC Ledger off and on again (or press Update), then reload the page. If this stays, check Extensions for a second copy of ALMANAC Ledger and remove the older one.</p></div>`
      : "";
    const pe = v.enabled ? v.planError : null;
    const planErr = pe
      ? `<div class="card flat alm-warnbox"><b>The last ${pe.genType === "normal" ? "turn" : e(pe.genType)} went to the model without the Almanac.</b><p class="muted">At ${e(new Date(pe.at).toLocaleString())}, ${e(pe.where)} failed, so the reply was written without the ledger note, recall or mirror entries. This clears itself on the next turn that works. If it keeps coming back, update the extension, and report the error below if an update doesn't fix it.</p><p><code>${e(pe.message)}</code></p>${pe.stack ? `<details><summary class="muted">Details for a bug report</summary><pre>ALMANAC Ledger ${e(v.version)}\n${e(pe.stack)}</pre></details>` : ""}</div>`
      : "";
    const banner = !v.enabled
      ? `<div class="card flat"><b>The Ledger is not active in this chat.</b><p class="muted">It switches on by itself when the ALMANAC preset is in use (or a reply contains a &lt;ledger&gt; block), and off again when the chat moves to another preset. You can also turn it on here.</p><button class="btn primary" data-act="enable">Turn on for this chat</button>${v.hiddenTurns ? `<p class="muted">${v.hiddenTurns} turn${v.hiddenTurns === 1 ? " is" : "s are"} still hidden under summaries. <button class="btn" data-act="releaseHidden">Show them again</button></p>` : ""}</div>`
      : "";
    const pv = v.detected?.presetVersion;
    const presetOld = v.enabled && pv && olderThan(String(pv), PRESET_VERSION)
      ? `<div class="card flat alm-warnbox"><b>This chat uses ALMANAC preset ${e(pv)}; the extension expects ${PRESET_VERSION} or newer.</b><p class="muted">Import <code>preset/ALMANAC.json</code> from the repository again (Presets → Import) so both halves speak the same version.</p></div>`
      : "";
    const probs = v.enabled ? (v.problems ?? []).slice(0, 3) : [];
    const problems = probs.length
      ? `<div class="card flat alm-warnbox"><div class="row"><b class="grow">Something in the background didn't work</b><button class="btn" data-act="clearProblems">Clear</button></div><ul class="alm-list">${probs.map((p: any) => `<li><b>${e(p.where)}</b> <small class="muted">${e(new Date(p.at).toLocaleString())}</small><br><small>${e(p.message)}</small></li>`).join("")}</ul><p class="muted"><small>The story still goes on; this is what didn't happen. If it repeats, check the connection set for that job in Settings.</small></p></div>`
      : "";
    const note = this.notice && Date.now() - this.notice.at < 60_000
      ? `<div class="card flat${this.notice.tone === "error" || this.notice.tone === "warning" ? " alm-warnbox" : ""}"><div class="row"><span class="grow">${e(this.notice.text)}</span><button class="btn" data-act="dismissNotice">OK</button></div></div>`
      : "";
    const scroll = this.root.scrollTop;
    this.root.innerHTML = `<div class="almo${this.orbit ? " orbiting" : ""}">${skyHeader(v, this.tab)}<main class="almo-body">${pageTitle(v, this.tab)}${note}${stale}${presetOld}${planErr}${problems}${banner}${body}</main>${dock(v, this.tab, this.orbit, this.seenSet())}</div>`;
    this.root.scrollTop = scroll;
    if (this.tab === "creator") this.creator.afterRender(this.root);
  }

  go(page: Tab) {
    const changed = page !== this.tab;
    this.tab = page;
    this.orbit = "";
    if (groupOf(page as Page)?.id === "engine") this.markEngineSeen();
    try {
      localStorage.setItem("alm-tab", this.tab);
    } catch {
      /* ignore */
    }
    this.render();
    if (changed) this.root.scrollTop = 0;
  }

  // -------------------------------------------------------------------------
  // Tabs
  // -------------------------------------------------------------------------

  tab_now(v: any): string {
    const n = v.now;
    const present = v.cast.filter((c: any) => c.tier === "spot" || c.tier === "peri");
    const fc = (n.forecastHours ?? []).filter((_: any, i: number) => i % 2 === 0).slice(0, 6);
    const facts = [
      n.place.length ? `<b>Where</b><span>${e(n.place.join(" › "))}</span>` : "",
      n.sun ? `<b>Sun</b><span>${e(n.sun.text)}</span>` : "",
      n.moon ? `<b>Moon</b><span>${e(n.moon.glyph)} ${e(n.moon.name)}</span>` : "",
      n.season ? `<b>Season</b><span>${e(n.season)}</span>` : "",
      `<b>Scene</b><span>${n.scene} · ${e(n.mode)}</span>`,
    ].join("");
    return `<div class="card flat almo-facts"><div class="kv">${facts}</div></div>
${fc.length ? `<div class="card flat"><h4>Next hours</h4><div class="alm-fc" style="grid-template-columns:repeat(${fc.length},1fr)">${fc.map((h: any) => `<div><small>${e(h.t)}</small><span>${e(h.glyph)}</span><b>${h.temp}°</b></div>`).join("")}</div><div class="muted">${e(n.forecast)}</div></div>` : ""}
<h4>Present</h4>
${present.length ? `<div class="alm-cast">${present.map((c: any) => this.castCard(c, true)).join("")}</div>` : `<div class="empty">No one else is here.</div>`}
${v.world.cons.filter((c: any) => c.status === "open" || c.status === "due").length ? `<h4>Owed and due</h4><div class="card flat"><ul class="alm-list">${v.world.cons.filter((c: any) => c.status === "open" || c.status === "due").slice(-8).map((c: any) => `<li>${e(c.whoName)}${c.whomName ? ` → ${e(c.whomName)}` : ""}: ${e(c.what)}${c.dueText ? ` <small class="muted">due ${e(c.dueText)}</small>` : ""}</li>`).join("")}</ul></div>` : ""}
<h4>What the model will be told next</h4>
${v.note ? `<pre>${e(v.note)}</pre>` : `<div class="empty">The note appears after the next generation starts.</div>`}
${v.recall ? `<details><summary class="muted">Recall block</summary><pre>${e(v.recall)}</pre></details>` : ""}
<div class="row" style="margin-top:10px"><button class="btn" data-act="sessionZero">🎲 Session Zero</button><button class="btn" data-act="repairLast">🩹 Repair last ledger</button><button class="btn" data-act="rebuild">↻ Rebuild from transcript</button></div>
<p class="muted" style="margin-top:8px">${v.counts.messages} messages · ${v.counts.ledgers} ledgers · ${v.counts.chapters} chapters${v.counts.unverified ? ` · ${v.counts.unverified} unverified turns` : ""}</p>`;
  }

  castCard(c: any, compact = false): string {
    const meters = Object.entries(c.meters ?? {}).filter(([, x]) => x != null);
    const seg = (x: number) => `<span class="alm-seg">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= x ? "on" : ""}"></i>`).join("")}</span>`;
    const vad = c.mood && (c.mood.v != null || c.mood.a != null)
      ? `<div class="alm-vad">${c.mood.v != null ? `<span>V</span><div class="alm-slider"><i style="--v:${((c.mood.v + 3) / 6).toFixed(2)}"></i></div>` : ""}${c.mood.a != null ? `<span>A</span><div class="alm-slider"><i style="--v:${(c.mood.a / 5).toFixed(2)}"></i></div>` : ""}${c.mood.d != null ? `<span>D</span><div class="alm-slider"><i style="--v:${((c.mood.d + 3) / 6).toFixed(2)}"></i></div>` : ""}</div>` : "";
    return `<article class="alm-cc" style="--c:${e(c.color)}"><div class="alm-cc__band"><span class="alm-cc__tier">${c.dead ? "dead" : c.isUser ? "you" : e(c.tier === "spot" ? "spotlight" : c.tier === "peri" ? "periphery" : "away")}</span></div><span class="alm-say__medal alm-cc__medal" style="--c:${e(c.color)}">${e(initials(c.name))}</span>
<div class="alm-cc__bd"><div class="alm-cc__nm">${e(c.name)}</div>${c.mood?.name ? `<div class="alm-cc__em">${e(c.mood.name)}</div>` : ""}${vad}
${meters.length ? `<div class="alm-meters">${meters.map(([k, x]) => `<span>${e(k)}</span>${seg(x as number)}`).join("")}</div>` : ""}
<div class="alm-tags">${(c.flags ?? []).slice(-4).map((f: string) => `<span class="alm-tag">${e(f)}</span>`).join("")}${(c.injuries ?? []).map((i: any) => `<span class="alm-tag warn">${e(i.where)}</span>`).join("")}${(c.held ?? []).slice(0, 3).map((h: string) => `<span class="alm-tag">holds: ${e(h)}</span>`).join("")}</div>
${c.fixed ? `<div class="alm-cc__row" title="Sent to the model every turn while they're present. Edit them to change it"><b>always</b>${e(c.fixed)}</div>` : ""}${c.activity ? `<div class="alm-cc__row"><b>doing</b>${e(c.activity)}</div>` : ""}${!compact && c.age ? `<div class="alm-cc__row"><b>age</b>${e(c.age)}${c.ageSet ? "" : ` <small class="muted" title="From the lore">(lore)</small>`}</div>` : ""}${!compact && c.appearance ? `<div class="alm-cc__row"><b>appearance</b>${e(c.appearance)}</div>` : ""}${!compact && c.look ? `<div class="alm-cc__row"><b>wearing</b>${e(c.look)}</div>` : ""}${!compact && c.place ? `<div class="alm-cc__row"><b>where</b>${e(c.place)}</div>` : ""}
</div></article>`;
  }

  tab_cast(v: any): string {
    const add = this.editingChar === "__new"
      ? this.charEditor(null)
      : `<div class="row" style="margin-bottom:8px"><span class="grow"></span><button class="btn" data-act="charAdd" title="Add someone the story hasn't named yet, or who should be tracked from now on">+ Add a person</button></div>`;
    return `${add}<div class="list">${v.cast.map((c: any) => `<div class="card">
<div class="row"><span class="alm-mini" style="--c:${e(c.color)}">${e(initials(c.name))}</span><b class="grow">${e(c.name)}${c.aliases?.length ? ` <small class="muted">(${e(c.aliases.join(", "))})</small>` : ""}</b><span class="pill">slot ${c.slot}</span><button class="btn" data-act="charEdit" data-id="${e(c.id)}" title="${c.isUser ? "Age and appearance" : "Name, age and appearance"}">edit</button><input type="color" class="swatch" data-color="${e(c.id)}" value="${e(toHex(c.color))}" title="${c.isUser ? "Your persona's colour" : "Voice colour"}" aria-label="${e(c.isUser ? "Your persona's colour" : `${c.name}'s colour`)}"></div>
${this.editingChar === c.id ? this.charEditor(c) : this.castCard(c)}
${c.journal?.length ? `<h4>In their own words</h4>${c.journal.map((j: any) => `<div class="muted">“${e(j.text)}”</div>`).join("")}` : ""}
${c.isUser ? "" : `<h4>Hidden pressure (narrator-only)</h4><div class="row"><span class="spoiler grow" tabindex="0">${e(c.pressure || "— none drawn yet —")}</span><button class="btn" data-act="editPressure" data-id="${e(c.id)}">edit</button></div>`}
${this.mergeRow(v, c)}
${c.isUser ? "" : `<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn danger" data-act="notPerson" data-name="${e(c.name)}" title="For a force, spell, place or thing the story mistook for a character. Lines about it stop creating a character; you can restore it below.">Not a person — remove</button></div>`}
</div>`).join("") || `<div class="empty">No one has appeared yet.</div>`}</div>${this.removedRow(v)}`;
  }

  /** Name, age and appearance (a new person when `c` is null). The persona's name comes from Lumiverse. */
  charEditor(c: any | null): string {
    const id = c?.id ?? "__new";
    const name = c?.isUser ? `<p class="muted"><small>Your persona's name comes from Lumiverse.</small></p>` : `<label class="f">Name<input type="text" id="almCharName" value="${e(c?.name ?? "")}" placeholder="${c ? "" : "Walter Hale"}"></label>${c ? `<p class="muted"><small>The old name keeps working in the story's lines.</small></p>` : ""}`;
    return `<div class="card almk--edit">${name}
<label class="f">Age<input type="text" id="almCharAge" value="${e(c?.ageSet ? c.age : "")}" placeholder="${e(c?.age && !c.ageSet ? `${c.age} (from the lore)` : "e.g. 24, early fifties, ageless")}"></label>
<label class="f">Also called<input type="text" id="almCharAliases" value="${e((c?.aliases ?? []).join("; "))}" placeholder="Other names they go by, separated by ;"></label>
<label class="f">Always<textarea id="almCharAlways" placeholder="Eyes, hair, build, what people notice first">${e(c?.fixed ?? "")}</textarea></label>
<p class="muted"><small>Always is sent with them every turn while they're present, and holds whatever the story writes. Change or delete anything in it; empty it to go back to what the card, the lore and the story say.</small></p>
<div class="row"><button class="btn primary" data-act="charSave" data-id="${e(id)}">${c ? "Save" : "Add"}</button><button class="btn" data-act="charCancel">Cancel</button></div></div>`;
  }

  /** Names taken out of the cast, with a way back. */
  removedRow(v: any): string {
    const gone = Object.entries(v.config?.merges ?? {}).filter(([, to]) => to === NOT_A_PERSON).map(([n]) => n);
    if (!gone.length) return "";
    return `<h4>Removed from the cast</h4><div class="card flat"><p class="muted" style="margin:0 0 8px"><small>Not characters: the story's lines about them as people are ignored, and the model is told to leave them out.</small></p><div class="row">${gone.map((n) => `<span class="pill">${e(n)} <button class="btn" data-act="restorePerson" data-name="${e(n)}" title="Put it back in the cast" style="padding:0 6px;margin-left:4px">restore</button></span>`).join("")}</div></div>`;
  }

  /** "Same person as…" for duplicates the model invented, and the names already merged into this one. */
  mergeRow(v: any, c: any): string {
    const merges: Record<string, string> = v.config?.merges ?? {};
    const mine = Object.entries(merges).filter(([, to]) => (c.isUser ? to === "user" : to.toLowerCase() === c.name.toLowerCase())).map(([from]) => from);
    const chips = mine.map((n) => `<span class="pill">${e(n)} <button class="btn" data-act="unmerge" data-name="${e(n)}" title="Split this name off again" style="padding:0 6px;margin-left:4px">✕</button></span>`).join("");
    const pick = c.isUser ? "" : `<label class="f">Same person as…<select data-merge="${e(c.name)}"><option value="">— no, a different person —</option><option value="user">${e(v.names?.user || "You")} (you)</option>${v.cast.filter((o: any) => !o.isUser && o.id !== c.id).map((o: any) => `<option value="${e(o.name)}">${e(o.name)}</option>`).join("")}</select></label>`;
    return pick || chips ? `<div class="alm-merge">${chips ? `<div class="row"><small class="muted">Also written as:</small>${chips}</div>` : ""}${pick}</div>` : "";
  }

  tab_bonds(v: any): string {
    const nodes: GNode[] = v.cast.filter((c: any) => !c.dead || v.bonds.some((b: any) => b.from === c.id || b.to === c.id)).map((c: any) => ({ id: c.id, name: c.isUser ? (v.names.user || "You") : c.name, color: c.color, spot: c.tier === "spot", user: c.isUser }));
    const lastIdx = Math.max(0, ...v.bonds.map((b: any) => b.lastMsg));
    const edges: GEdge[] = v.bonds.map((b: any) => ({ from: b.from, to: b.to, axes: b.axes, label: b.label, changedAt: b.lastMsg, changedNow: b.lastMsg === lastIdx, history: b.history }));
    const maxIdx = Math.max(1, ...v.bonds.flatMap((b: any) => b.history.map((h: any) => h.msgIndex)));
    const axes = ["", "trust", "affection", "respect", "attraction", "fear", "resentment", "rivalry", "obligation"];
    return `<div class="row"><select data-set="graphAxis">${axes.map((a) => `<option value="${a}"${a === this.graphAxis ? " selected" : ""}>${a || "strongest axis"}</option>`).join("")}</select><label class="chk"><input type="checkbox" data-set="npcOnly"${this.npcOnly ? " checked" : ""}> NPC↔NPC only</label></div>
<div style="margin:8px 0">${renderGraph(nodes, edges, { asOf: this.asOf, filterAxis: this.graphAxis || undefined, npcOnly: this.npcOnly })}</div>
<label class="f">Timeline scrubber — ${this.asOf === Infinity ? "now" : `as of message ${this.asOf + 1}`}<input type="range" min="0" max="${maxIdx}" value="${this.asOf === Infinity ? maxIdx : this.asOf}" data-set="asOf"></label>
<h4>All bonds</h4><div class="list">${v.bonds.map((b: any) => `<div class="rec"><div class="hd"><b>${e(b.fromName)} → ${e(b.toName)}</b>${b.label ? `<span class="pill">${e(b.label)}</span>` : ""}${b.ladder ? `<span class="pill">♡ tier ${b.ladder.tier}</span>` : ""}</div><div class="muted">${Object.entries(b.axes).map(([k, x]: any) => `${k} ${x > 0 ? "+" : ""}${x}`).join(" · ")}</div>${b.history.slice(-2).map((h: any) => `<div class="muted"><small>${e(h.axis)} ${h.delta > 0 ? "+" : ""}${h.delta}${h.cause ? ` — ${e(h.cause)}` : ""}</small></div>`).join("")}</div>`).join("") || `<div class="empty">No bonds yet.</div>`}</div>`;
  }

  tab_knowledge(v: any): string {
    const hidden = v.hiddenFacts ?? [];
    const clerk = this.clerkBar(v);
    const adding = this.editingFact === "__new" ? this.factEditor(v, null) : `<div class="row" style="margin-bottom:8px"><span class="grow"></span><button class="btn" data-act="factAdd" title="Add a fact the story hasn't recorded, and say who knows it">+ Add a fact</button></div>`;
    if (!v.knowledge.length && !hidden.length) return `${clerk}${adding}<div class="empty">No facts yet. The model records them with <code>reveal</code>, <code>know</code> and <code>secret</code> lines; each fact collects who has it, how it reached them, and who it's kept from.</div>`;
    const people = new Map<string, any>(v.cast.map((c: any) => [c.id, c]));
    const q = this.factQuery.trim().toLowerCase();
    const who = this.factPerson;
    const kinds: Record<string, (f: any) => boolean> = {
      play: (f) => f.kind === "secret" || f.kind === "belief" || f.inPlay || f.added,
      shared: (f) => f.kind === "shared",
      noted: (f) => f.kind === "noted",
      all: () => true,
    };
    const counts = Object.fromEntries(Object.entries(kinds).map(([k, fn]) => [k, v.knowledge.filter(fn).length]));
    const touches = (f: any) => !who || f.stances.some((s: any) => s.id === who) || f.lacks.some((l: any) => l.id === who) || f.keepers.some((k: any) => k.id === who);
    const shown = v.knowledge.filter((f: any) => kinds[this.factKind](f) && touches(f) && (!q || `${f.key} ${f.statement} ${f.stances.map((s: any) => s.name).join(" ")}`.toLowerCase().includes(q)));
    const mini = (id: string, name: string) => `<span class="alm-mini" style="--c:${e(people.get(id)?.color ?? "#888")}">${e(initials(name))}</span>`;
    const chip = (s: any) => {
      const cls = s.status === "wrong" ? "wrong" : s.status === "knows" ? "knows" : "sus";
      const icon = s.status === "wrong" ? "✗" : s.status === "knows" ? "✓" : "?";
      const label = s.status === "wrong" ? "wrong" : s.verb;
      const worked = s.derived === "witness" ? "was there when it came out" : s.derived === "source" ? "their own words or deed" : s.derived === "secret" ? "keeps it" : "";
      return `<div class="almk-h">${mini(s.id, s.name)}<div class="almk-h__b"><b>${e(s.name)}</b><span class="alm-kp ${cls}"${worked ? ` title="Worked out by the Almanac: ${e(worked)}"` : ""}>${icon} ${e(label)}</span>${s.version ? `<small class="almk-ver">thinks “${e(s.version)}”</small>` : ""}${s.how && !s.derived && !s.verb.includes(s.how) ? kpNote(s.how) : ""}</div></div>`;
    };
    const lackChip = (l: any) => `<div class="almk-h">${mini(l.id, l.name)}<div class="almk-h__b"><b>${e(l.name)}</b><span class="alm-kp un">— ${e(l.text)}</span></div></div>`;
    const KIND: Record<string, string> = { secret: "secret", belief: "belief", shared: "shared", noted: "noted" };
    const cards = shown.map((f: any) => {
      if (this.editingFact === f.key) return this.factEditor(v, f);
      const truth = f.truth !== "unknown" ? `<span class="pill${f.truth === "false" ? " warn" : ""}" title="Whether the fact is true">${f.truth === "true" ? "true" : f.truth === "false" ? "false" : "partly true"}</span>` : "";
      const hist = f.history.map((h: any) => `<li><time>${e(h.when)}</time> <b>${e(h.name)}</b> ${e(h.verb)}${h.version ? `: “${e(h.version)}”` : ""}${h.how && !h.derived && !h.verb.toLowerCase().includes(h.how.toLowerCase()) ? ` <span class="muted">— ${e(h.how)}</span>` : ""}${h.note ? `<small class="almk-note">${e(h.note)}</small>` : ""}</li>`).join("");
      const kept = f.keepers.length ? `<div class="almk-un">🤫 Kept by ${e(f.keepers.map((k: any) => k.name).join(", "))}${f.keptFrom.length ? ` from ${e(f.keptFrom.map((k: any) => k.name).join(", "))}` : ""}</div>` : "";
      return `<div class="card flat almk almk--${e(f.kind)}"><div class="almk-top"><span class="almk-key" title="The model refers to this fact as #${e(f.key)}">#${e(f.key)}</span><span class="pill almk-kind" title="${e(KIND_HELP[f.kind] ?? "")}">${e(KIND[f.kind] ?? f.kind)}</span>${truth}${f.locked ? `<span class="pill" title="You set this statement">✎ yours</span>` : ""}${f.offPage ? `<span class="pill${f.offPage.live ? " warn" : ""}" title="${e(f.offPage.live ? `Kept off the page${f.offPage.words.length ? `: never "${f.offPage.words.join('", "')}"` : ""}${f.offPage.wording ? `; alluded to as "${f.offPage.wording}"` : ""}` : "It has come out; no longer kept off the page")}">${f.offPage.live ? "🔒 off the page" : "off the page · out now"}</span>` : ""}<span class="grow"></span><button class="btn" data-act="factEdit" data-id="${e(f.key)}" title="Rename, set the truth, set who knows it, or merge">edit</button><button class="btn danger" data-act="factDelete" data-id="${e(f.key)}" title="Delete this fact from the page and the model's note (you can restore it below)">delete</button></div>
<b class="almk-stmt">${e(f.statement)}</b>
<div class="almk-st">${f.stances.map(chip).join("") || `<div class="muted">No one has it yet.</div>`}${f.lacks.map(lackChip).join("")}</div>
${kept}
<details class="almk-hist"${this.openFacts.has(f.key) ? " open" : ""} data-fact="${e(f.key)}"><summary>How it came out · ${f.history.length}</summary><ol>${hist}</ol></details></div>`;
    }).join("");
    // Dramatic irony: someone certain of the wrong version.
    const irony = v.knowledge.flatMap((f: any) => f.stances.filter((s: any) => s.status === "wrong" || (s.status !== "unaware" && f.truth === "false")).map((s: any) => ({ f, s }))).slice(0, 3);
    const ironyHtml = irony.map(({ f, s }: any) => `<div class="alm-irony"><span class="i">🎭</span><span><b>Dramatic irony:</b> ${e(s.name)} ${s.version ? `thinks “${e(s.version)}”, but ${e(f.statement)}` : `is certain that “${e(f.statement)}”, which isn't true`}.</span></div>`).join("");
    const seg = (k: string, lab: string) => `<button class="pill${this.factKind === k ? " on" : ""}" data-act="factKind" data-id="${k}" aria-pressed="${this.factKind === k}">${lab} <b>${counts[k]}</b></button>`;
    const filters = `<div class="row almk-filters">${seg("play", "In play")}${seg("shared", "Shared")}${seg("noted", "Noted")}${seg("all", "All")}<span class="grow"></span><select data-set="factPerson" aria-label="Show one person"><option value="">everyone</option>${(v.knowers ?? []).map((p: any) => `<option value="${e(p.id)}"${p.id === who ? " selected" : ""}>${e(p.name)}${p.here ? " · here" : ""}</option>`).join("")}</select></div>`;
    const search = `<div class="row" style="margin-bottom:8px"><input type="text" data-set="factQuery" value="${e(this.factQuery)}" placeholder="Find a fact or a person…" aria-label="Find a fact or a person" class="grow"><span class="muted"><small>${shown.length} of ${v.knowledge.length}</small></span></div>`;
    const person = who ? this.personKnowledge(v, who) : "";
    const hiddenHtml = hidden.length ? `<h4>Deleted facts</h4><div class="row">${hidden.map((h: any) => `<span class="pill">${e(h.statement)} <button class="btn" data-act="factRestore" data-id="${e(h.key)}" style="padding:0 6px;margin-left:4px">restore</button></span>`).join("")}</div>` : "";
    const empty = this.factKind === "play" ? "No secrets or beliefs in play. <b>Shared</b> and <b>Noted</b> hold the rest." : "Nothing matches.";
    return `${clerk}${ironyHtml}${filters}${search}${person}${adding}<div class="list">${cards || `<div class="empty">${empty}</div>`}</div>${hiddenHtml}`;
  }

  /** One person: what they have, what they lack and why, and the gaps in their own words. */
  personKnowledge(v: any, id: string): string {
    const p = (v.knowers ?? []).find((x: any) => x.id === id);
    if (!p) return "";
    const has = v.knowledge.flatMap((f: any) => f.stances.filter((s: any) => s.id === id).map((s: any) => `<li><b>${e(f.statement)}</b> <span class="muted">— ${e(s.status === "wrong" && s.version ? `thinks “${s.version}”` : s.verb)}</span></li>`));
    const lacks = v.knowledge.flatMap((f: any) => f.lacks.filter((l: any) => l.id === id).map((l: any) => `<li><b>${e(f.statement)}</b> <span class="muted">— ${e(l.text)}</span></li>`));
    const gaps = (v.knowGaps ?? []).find((g: any) => g.id === id)?.gaps ?? [];
    return `<div class="card flat almk-person"><h4>${e(p.name)}</h4>
<details open><summary>Has · ${has.length}</summary><ul>${has.slice(0, 40).join("") || "<li class=\"muted\">Nothing recorded.</li>"}</ul></details>
<details${lacks.length ? " open" : ""}><summary>Lacks · ${lacks.length}</summary><ul>${lacks.join("") || "<li class=\"muted\">Nothing recorded as kept from them or missed.</li>"}</ul></details>
<details${gaps.length ? " open" : ""}><summary>Doesn't know, in the story's words · ${gaps.length}</summary><ul>${gaps.map((g: any) => `<li${g.stale ? ' class="muted" title="Not restated in the last 40 messages"' : ""}>${e(g.text)}</li>`).join("") || "<li class=\"muted\">No gaps recorded.</li>"}</ul></details></div>`;
  }

  /** The knowledge clerk: what it does, how much of the chat it has read, and one button to tidy the rest. */
  clerkBar(v: any): string {
    const c = v.clerk ?? {};
    const mode = c.mode === "off" ? "off for new replies" : c.mode === "always" ? "reads every new reply" : "reads new replies whose lines need it";
    const unread = Number(c.unread ?? 0);
    const read = Math.max(0, Number(c.replies ?? 0) - unread);
    const status = c.replies ? ` ${read} of ${c.replies} replies read.` : "";
    const button = c.running
      ? `<span class="pill on">reading…${this.clerkProgress ? ` ${e(this.clerkProgress)}` : ""}</span><button class="btn" data-act="clerkStop" title="Stop after the reply it's reading; tidying again carries on from there">Stop</button>`
      : unread
        ? `<button class="btn" data-act="clerkTidy" title="Read every reply the clerk hasn't read yet, oldest first, and rewrite its knowledge lines cleanly: one quiet generation each. You can stop and carry on later.">Tidy the whole chat · ${unread} to read</button>`
        : c.replies ? `<span class="pill">every reply read</span>` : "";
    return `<div class="card flat almk-clerk"><div class="row"><span class="grow"><b>Knowledge clerk</b> <span class="muted">— ${e(mode)}.${e(status)}</span></span>${button}</div></div>`;
  }

  /** Rename a fact, say whether it's true, set who knows it, fold it into another, or delete it. */
  factEditor(v: any, fact: any | null): string {
    const f = fact ?? { key: "__new", statement: "", stances: [], lacks: [] };
    const others = fact ? v.knowledge.filter((o: any) => o.key !== f.key) : [];
    const truthOpts = [["", fact ? "as the story says" : "not said"], ["true", "true"], ["false", "false"], ["partial", "partly true"], ["unknown", "unknown"]];
    const cur = fact ? v.config?.factEdits?.[f.key] ?? {} : {};
    return `<div class="card almk almk--edit"><label class="f">The fact, in a few words<input type="text" id="almFactStmt" value="${e(f.statement)}" placeholder="${fact ? "" : "Walter is Gabriel's Watcher"}"></label>
<label class="f">Is it true?<select id="almFactTruth">${truthOpts.map(([k, l]) => `<option value="${k}"${(cur.truth ?? "") === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
<fieldset class="almk-off"><legend>Off the page</legend><label class="chk"><input type="checkbox" id="almFactOffOn"${(fact?.offPage && cur.offPage !== null) || cur.offPage ? " checked" : ""}> Keep it out of the narration, thoughts and summaries until it comes out</label>
<label class="f">Words never to use yet<input type="text" id="almFactOffWords" value="${e((cur.offPage?.words ?? fact?.offPage?.words ?? []).join(", "))}" placeholder="Heaven, paradise"></label>
<label class="f">How the story may allude to it<input type="text" id="almFactOffAs" value="${e(cur.offPage?.wording ?? fact?.offPage?.wording ?? "")}" placeholder="somewhere warm and finished"></label></fieldset>
${others.length ? `<label class="f">Same fact as…<select id="almFactInto"><option value="">— a separate fact —</option>${others.map((o: any) => `<option value="${e(o.key)}">#${e(o.key)} ${e(o.statement)}</option>`).join("")}</select></label>` : ""}
<h4>Who knows it</h4><div class="list">${(v.knowers ?? []).map((p: any) => {
      const now = f.stances.find((s: any) => s.id === p.id);
      const lack = f.lacks.find((l: any) => l.id === p.id);
      const said = now ? now.verb : lack ? lack.text : "no record";
      if (!fact) return `<label class="f">${e(p.name)}<select data-person="${e(p.id)}">${PERSON_OPTS.filter(([k]) => k !== "none").map(([k, l]) => `<option value="${k}">${k ? l : "—"}</option>`).join("")}</select></label>`;
      const want = cur.people?.[p.id] ?? "";
      return `<label class="f">${e(p.name)} <small class="muted">— now: ${e(said)}</small><select data-person="${e(p.id)}">${PERSON_OPTS.map(([k, l]) => `<option value="${k}"${want === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>`;
    }).join("")}</div>
<div class="row"><button class="btn primary" data-act="factSave" data-id="${e(f.key)}">${fact ? "Save" : "Add"}</button><button class="btn" data-act="factCancel">Cancel</button><span class="grow"></span>${fact ? `<button class="btn danger" data-act="factHide" data-id="${e(f.key)}" title="Delete it from this page and from the model's note">Delete</button>` : ""}</div></div>`;
  }


  tab_codex(v: any): string {
    const kinds = [...new Set(v.codex.map((r: any) => r.kind))] as string[];
    const q = this.codexFilter.toLowerCase();
    const recs = v.codex.filter((r: any) => (!this.codexKind || r.kind === this.codexKind) && (!q || `${r.name} ${r.summary} ${r.keys.join(" ")}`.toLowerCase().includes(q)));
    return `<div class="row"><input type="text" placeholder="Search the Codex…" data-set="codexFilter" value="${e(this.codexFilter)}" class="grow"><select data-set="codexKind"><option value="">all kinds</option>${kinds.map((k) => `<option${k === this.codexKind ? " selected" : ""}>${e(k)}</option>`).join("")}</select></div>
<p class="muted">${recs.length} of ${v.codex.length} records. Edits lock a record so the archivist never overwrites it. Keys are real retrieval keys.</p>
<div class="list">${recs.slice(0, 200).map((r: any) => this.editing === r.id ? this.codexEditor(r) : `<div class="rec"><div class="hd"><span class="kind">${e(r.kind)}</span><b class="grow">${e(r.name)}</b>${r.locked ? `<span class="pill">🔒 locked</span>` : ""}${r.narratorOnly ? `<span class="pill">narrator-only</span>` : ""}<span class="pill">${e(r.source)}</span><button class="btn" data-act="edit" data-id="${e(r.id)}">edit</button></div><div>${e(r.summary)}</div>${r.keys.length ? `<div>${r.keys.map((k: string) => `<span class="pill">${e(k)}</span>`).join("")}</div>` : ""}${r.body?.divergedNote ? `<div class="alm-tag warn">moved past: ${e(r.body.divergedNote)}</div>` : ""}</div>`).join("")}</div>
<details><summary class="muted">Add a record or a correction</summary><div class="card flat"><label class="f">New record name<input type="text" id="almNewName"></label><label class="f">Kind<select id="almNewKind">${["person", "place", "object", "group", "law", "texture", "history", "situation"].map((k) => `<option>${k}</option>`).join("")}</select></label><label class="f">Summary<textarea id="almNewSummary"></textarea></label><button class="btn primary" data-act="newRecord">Add record</button>
<h4>Correct the state with ledger lines</h4><textarea id="almOps" placeholder="bond Mara>Kael: trust -1 — she caught him lying&#10;item Locket: Mara → Kael — stolen back"></textarea><button class="btn" data-act="userOps">Record correction</button><p class="muted"><small>A correction applies from the latest reply on, and holds if you regenerate or swipe it.</small></p>
${v.corrections?.length ? `<h4>Your corrections</h4><div class="list">${v.corrections.slice(0, 40).map((c: any) => `<div class="rec"><div class="hd"><small class="muted grow">from message ${c.index + 1}${c.at ? ` · ${e(new Date(c.at).toLocaleString())}` : ""}</small><button class="btn" data-act="userOpsRemove" data-key="${e(c.key)}" data-id="${e(c.id)}">remove</button></div>${c.lines.map((l: string) => `<code>${e(l)}</code>`).join("<br>")}</div>`).join("")}</div>` : ""}</div></details>`;
  }

  codexEditor(r: any): string {
    return `<div class="rec"><div class="hd"><span class="kind">${e(r.kind)}</span><b class="grow">${e(r.name)}</b></div>
<label class="f">Summary<textarea id="almEdSummary">${e(r.summary)}</textarea></label>
<label class="f">Keys (comma-separated)<input type="text" id="almEdKeys" value="${e(r.keys.join(", "))}"></label>
${r.kind === "person" ? `<label class="f">Routine (e.g. 06:00–09:00 docks (unloading); 09:00–18:00 harbour office)<input type="text" id="almEdRoutine" value="${e(r.body?.routine ?? "")}"></label>` : ""}
${r.kind === "place" ? `<label class="f">Hours (e.g. open 20:00 to 02:00)<input type="text" id="almEdHours" value="${e(r.body?.hours ?? "")}"></label>` : ""}
<label class="chk"><input type="checkbox" id="almEdNarr"${r.narratorOnly ? " checked" : ""}> narrator-only (characters cannot know it)</label>
<div class="row"><button class="btn primary" data-act="saveRecord" data-id="${e(r.id)}">Save &amp; lock</button><button class="btn" data-act="unlock" data-id="${e(r.id)}">Unlock</button><button class="btn" data-act="cancelEdit">Cancel</button>${r.source !== "story" ? `<button class="btn danger" data-act="deleteRecord" data-id="${e(r.id)}">Delete</button>` : ""}</div></div>`;
  }

  tab_chronicle(v: any): string {
    const ch = v.chronicle;
    const cov = ch.coverage;
    const tok = ch.tokens ?? {};
    const cnt = ch.counts ?? {};
    const all: any[] = ch.units;
    const byId = new Map(all.map((u: any) => [u.id, u]));
    const newest = (a: any, b: any) => b.startIdx - a.startIdx || RANK[b.level] - RANK[a.level];
    const t = (n: number) => `~${Math.round(n || 0).toLocaleString()}`;
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
    const label = (u: any) => `${cap(u.level)} ${u.no}`;
    const block = (u: any, depth: number): string => {
      const kids = u.children.map((id: string) => byId.get(id)).filter(Boolean).sort(newest);
      const parent = u.parent ? byId.get(u.parent) : null;
      const open = this.chronOpen.has(u.id);
      const relevant = v.chronicle.mode === "relevant";
      const status = u.stale ? `<span class="pill">stale</span>` : u.ghost ? `<span class="pill">ghost</span>`
        : v.chronicle.mode === "off" ? `<span class="pill" title="Summaries are switched off in Settings">not in prompt</span>`
        : u.inPrompt ? `<span class="pill on-prompt" title="${relevant ? "The last prompt carried this summary" : "This summary is in every prompt"}">in prompt</span>`
        : relevant && u.folded ? `<span class="pill" title="Only when relevant: the prompt reads the chapters, not the ${e(u.level)}">chapters used instead</span>`
        : relevant ? `<span class="pill" title="Goes in the prompt when a turn touches it">when relevant</span>`
        : `<span class="pill" title="The prompt uses ${e(parent ? label(parent) : "a coarser summary")} for these turns instead (a turn that touches this chapter can still bring it back through recall)">folded${parent ? ` into ${e(label(parent))}` : ""}</span>`;
      const nested = this.chronFilter === "all" && kids.length
        ? `<button class="chron-kids-t" data-act="chronToggle" data-id="${e(u.id)}" aria-expanded="${open}">${open ? "▾" : "▸"} ${plural(kids.length, kids[0].level)} folded in</button>${open ? `<div class="chron-kids">${kids.map((k: any) => block(k, depth + 1)).join("")}</div>` : ""}`
        : "";
      return `<div class="rec chron chron--${u.level}${u.folded || u.stale || u.ghost ? " chron--folded" : ""}" style="--lv:${LEVEL_COLOR[u.level]}"><div class="hd"><span class="kind">${e(label(u))}</span><b class="grow">${e(u.title)}</b>${u.locked ? `<span class="pill" title="Locked">🔒</span>` : ""}</div>
<div class="muted"><small>messages ${u.startIdx + 1}–${u.endIdx + 1}${u.storyStart ? ` · ${e(u.storyStart)}${u.storyEnd && u.storyEnd !== u.storyStart ? ` – ${e(u.storyEnd)}` : ""}` : ""}</small></div>
<div class="chron-tags">${status}<span class="pill tok" title="Estimated tokens in this summary">${t(u.tokens)} tokens</span>${u.detail ? `<span class="pill">${e(u.detail)}</span>` : ""}</div>
<details><summary class="muted">read / edit</summary><textarea data-unit="${e(u.id)}" style="min-height:140px">${e(u.text)}</textarea><div class="row"><button class="btn" data-act="unitSave" data-id="${e(u.id)}">Save</button><button class="btn" data-act="unitLock" data-id="${e(u.id)}">${u.locked ? "Unlock" : "Lock"}</button><button class="btn" data-act="unitGhost" data-id="${e(u.id)}">${u.ghost ? "Unghost" : "Ghost"}</button><button class="btn" data-act="unitRegen" data-id="${e(u.id)}">Regenerate</button><button class="btn danger" data-act="unitUnhide" data-id="${e(u.id)}">Unhide span</button></div></details>${nested}</div>`;
    };
    const f = this.chronFilter;
    // All: the hierarchy, with each unit's children folded inside it. One level: a flat list of that level.
    const shown = f === "all" ? all.filter((u: any) => !u.parent || !byId.has(u.parent)).sort(newest) : all.filter((u: any) => u.level === f).sort(newest);
    const prompt = (tok.chapter ?? 0) + (tok.arc ?? 0) + (tok.volume ?? 0);
    const saved = (tok.replaced ?? 0) - prompt;
    const seg = (k: string, lab: string, n?: number) => `<button class="pill${f === k ? " on" : ""}" data-act="chronFilter" data-id="${k}" aria-pressed="${f === k}">${lab}${n != null ? ` <b>${n}</b>` : ""}</button>`;
    const legend = (lv: string, lab: string, n: number) => `<div class="chron-lg"><i style="background:${lv === "raw" ? "var(--alm-line)" : LEVEL_COLOR[lv]}"></i><span class="grow">${lab}</span><span>${cov[lv] ?? 0}%</span><span class="muted">${t(tok[lv])} tok</span>${lv === "raw" ? "<span></span>" : `<span class="muted">${n}</span>`}</div>`;
    return `<div class="card flat"><h4>Coverage</h4><div class="bar"><i style="width:${cov.volume}%;background:${LEVEL_COLOR.volume}"></i><i style="width:${cov.arc}%;background:${LEVEL_COLOR.arc}"></i><i style="width:${cov.chapter}%;background:${LEVEL_COLOR.chapter}"></i><i style="width:${cov.raw}%;background:var(--alm-line)"></i></div>
<div class="chron-legend">${legend("volume", "Volumes", cnt.volume ?? 0)}${legend("arc", "Arcs", cnt.arc ?? 0)}${legend("chapter", "Chapters", cnt.chapter ?? 0)}${legend("raw", "Raw turns", 0)}</div>
<p class="muted" style="margin:8px 0"><small>In the ${v.chronicle.mode === "relevant" ? "last " : ""}prompt: <b>${t(prompt)}</b> tokens of summaries and <b>${t(tok.raw)}</b> of raw turns.${tok.replaced ? ` The summaries stand in for ${t(tok.replaced)} tokens of old turns${saved > 0 ? `, saving ${t(saved)}` : ""}.` : ""}</small></p>
<p class="muted">Old turns are summarised at scene boundaries, hidden, and replaced in the prompt by their summaries. Chapters fold into arcs and arcs into volumes as the story grows. The last ${v.settings.rawTail} messages stay raw, or fewer if they pass ~${Number(v.settings.rawTailTokens ?? 12000).toLocaleString()} tokens (never fewer than 6); raise the raw tail cap in Settings to keep more.</p>
<div class="row"><span class="muted grow"><small>Detail: <b>${e(v.settings.summaryDetail ?? "detailed")}</b> · In the prompt: <b>${v.chronicle.mode === "relevant" ? "only when relevant" : v.chronicle.mode === "off" ? "off" : "the whole story"}</b> (change them in Settings)</small></span><button class="btn" data-act="chronicleRewrite" title="Redo every unlocked chapter, arc and volume at the current detail">Rewrite all</button><button class="btn primary" data-act="chronicleRun">Summarise now</button></div></div>
<div class="row chron-filter" role="group" aria-label="Show">${seg("all", "All")}${seg("volume", "Volumes", cnt.volume ?? 0)}${seg("arc", "Arcs", cnt.arc ?? 0)}${seg("chapter", "Chapters", cnt.chapter ?? 0)}</div>
<div class="list">${shown.map((u: any) => block(u, 0)).join("") || `<div class="empty">${all.length ? `No ${f}s yet.` : "No chapters yet. They appear once enough scenes have scrolled past the raw tail."}</div>`}</div>`;
  }

  tab_timeline(v: any): string {
    const ev = [...v.timeline].reverse();
    const forecasts = v.codex.filter((r: any) => r.kind === "forecast");
    return `${forecasts.length ? `<h4>Ahead</h4><div class="list">${forecasts.map((f: any) => `<div class="rec">🔮 ${e(f.summary)}${f.status === "diverged" ? ` <span class="alm-tag warn">diverged</span>` : ""}</div>`).join("")}</div>` : ""}
<h4>Milestones</h4><div class="timeline">${ev.map((m: any) => `<div class="ev"><small>${e(m.at || `message ${m.msgIndex + 1}`)} · ${e(m.kind)}</small>${e(m.text)}</div>`).join("") || `<div class="empty">Nothing yet.</div>`}</div>`;
  }

  tab_world(v: any): string {
    const w = v.world;
    const ring = (n: number, of: number, c: string) => `<div class="alm-clock__face"><div class="alm-ring" style="--n:${n};--of:${Math.max(1, of)};--rc:${c}"></div><b>${n}/${of}</b></div>`;
    return `<div class="card flat"><div class="kv"><b>Calendar</b><span>${e(w.calendar ? `${w.calendar.date} · ${w.calendar.season}` : "not started")}</span><b>Climate</b><span>${e(w.climate)}</span></div>
<details><summary class="muted">Schedule weather</summary><div class="row"><input type="number" id="almWxDay" placeholder="day" style="width:70px"><input type="number" id="almWxHour" placeholder="hour" style="width:70px"><input type="number" id="almWxLen" placeholder="hours" style="width:70px"><input type="text" id="almWxCond" placeholder="thunderstorm" class="grow"><button class="btn" data-act="scheduleWx">Schedule</button></div></details></div>
${w.factions.length ? `<h4>Factions</h4><div class="alm-clocks">${w.factions.flatMap((f: any) => f.clocks.map((c: any) => `<div class="alm-clock">${ring(c.cur, c.max, "var(--alm-danger)")}<div><strong>${e(f.name)}: ${e(c.name)}</strong></div></div>`)).join("")}</div>` : ""}
${w.deadlines.length ? `<h4>Deadlines</h4><ul class="alm-list">${w.deadlines.map((d: any) => `<li class="${d.passed && !d.done ? "due" : ""}">${e(d.title)} — ${e(d.at)}${d.done ? " (done)" : d.passed ? " (passed)" : ` · ${e(d.left)} left`}</li>`).join("")}</ul>` : ""}
${w.threads.length ? `<h4>Threads</h4><div class="list">${w.threads.map((t: any) => `<div class="rec"><div class="hd"><b class="grow">${e(t.title)}</b><span class="pill">${e(t.status)}</span></div>${t.latest ? `<div class="muted">${e(t.latest)}</div>` : ""}${t.blocker ? `<div class="alm-tag warn">blocked: ${e(t.blocker)}</div>` : ""}</div>`).join("")}</div>` : ""}
${w.items.length ? `<h4>Items</h4><div class="alm-inv">${w.items.map((i: any) => `<div class="alm-it"><span class="alm-it__ic">${i.gone ? "✗" : "✦"}</span><div><b>${e(i.name)}</b><span class="alm-it__h">${e(i.gone ? "gone" : i.holder || "?")}${i.where && !i.gone ? ` · ${e(i.where)}` : ""}</span>${i.custody.map((c: any) => `<small class="muted">${e(c.from || "?")} → ${e(c.to || "?")}${c.how ? ` (${e(c.how)})` : ""}</small>`).join("<br>")}</div></div>`).join("")}</div>` : ""}
${w.rumors.length ? `<h4>Rumours</h4><ul class="alm-list">${w.rumors.map((r: any) => `<li>🗣 ${e(r.text)} <small class="muted">(${r.hops} hop${r.hops === 1 ? "" : "s"})</small></li>`).join("")}</ul>` : ""}
${w.rep.length ? `<h4>Reputation</h4>${w.rep.map((r: any) => `<span class="pill">${e(r.group)} ${r.score > 0 ? "+" : ""}${r.score}${r.tags.length ? ` · ${e(r.tags.join(", "))}` : ""}</span>`).join("")}` : ""}
${w.gauges.length ? `<h4>Gauges</h4><div class="alm-clocks">${w.gauges.map((g: any) => `<div class="alm-clock">${ring(g.cur, g.max, "var(--alm-accent)")}<div><strong>${e(g.name)}</strong><span>${e(g.cause ?? "")}</span></div></div>`).join("")}</div>` : ""}
${w.clues.length ? `<h4>Clue board</h4><ul class="alm-list">${w.clues.map((c: any) => `<li>🔎 ${e(c.text)}${c.pointsTo ? ` → ${e(c.pointsTo)}` : ""}${c.reliability ? ` <small class="muted">(${e(c.reliability)})</small>` : ""}</li>`).join("")}</ul>` : ""}
${w.plants.length ? `<h4>Plants &amp; payoffs</h4><ul class="alm-list">${w.plants.map((p: any) => `<li>${p.paidAt != null ? "✓" : "○"} ${e(p.text)}${p.payoff ? ` <small class="muted">(${e(p.payoff)})</small>` : ""}</li>`).join("")}</ul>` : ""}
${(v.bits ?? []).length ? `<h4>Running bits</h4><p class="muted">Jokes, pet names, catchphrases and keepsakes. The note offers a few not used lately as callbacks.</p><ul class="alm-list">${v.bits.map((b: any) => `<li>🔁 ${e(b.text)}${b.who ? ` <small class="muted">(${e(b.who)})</small>` : ""}${b.uses > 1 ? ` <small class="muted">×${b.uses}</small>` : ""}${b.by === "chronicle" ? ` <small class="muted" title="From a chapter summary">· chronicle</small>` : ""}</li>`).join("")}</ul>` : ""}
${w.canon.length ? `<h4>Minted canon</h4><ul class="alm-list">${w.canon.map((c: any) => `<li>${e(c.text)}</li>`).join("")}</ul>` : ""}
<div class="row" style="margin-top:10px"><button class="btn" data-act="simulate">⏭ Run the off-screen world now</button></div>`;
  }

  tab_elsewhere(v: any): string {
    const x = v.elsewhere;
    if (!x) return `<div class="empty">Elsewhere starts after the next reply.</div>`;
    const director = x.view !== "surprise";
    const KIND: Record<string, string> = { pursuit: "Pursuit", scheme: "Scheme", rivalry: "Rivalry", courtship: "Courtship", rift: "Rift", debt: "Debt", secret: "Secret", decline: "Decline", investigation: "Investigation", threat: "Threat", return: "Return", duty: "Duty", life: "Life", loss: "Loss", world: "World" };
    const ROUTE: Record<string, string> = { carrier: "🗣", signal: "☎", ambient: "📻", trace: "⌂", entrance: "🚪" };
    const RES: Record<string, string> = { win: "win", cost: "cost", loss: "loss" };
    const ring = (n: number, of: number, c: string) => `<div class="alm-clock__face"><div class="alm-ring" style="--n:${n};--of:${Math.max(1, of)};--rc:${c}"></div><b>${n}/${of}</b></div>`;
    const modeBtn = (m: string, lab: string) => `<button class="btn${(x.chatMode ?? "") === m ? " primary" : ""}" data-act="ewMode" data-id="${m}">${lab}</button>`;
    const head = `<div class="card flat"><div>The world off the page: <b>${e(x.mode)}</b>${x.chatMode ? " (this chat)" : " (from Settings)"}${x.town ? ` · ${e(x.town)}` : ""}</div>
<div class="muted" style="margin-top:10px"><small>Show</small></div>
<div class="row" style="margin-top:4px"><button class="btn${director ? " primary" : ""}" data-act="ewView" data-id="director" title="Everything: subplots, dice, grounds">Director</button><button class="btn${director ? "" : " primary"}" data-act="ewView" data-id="surprise" title="Only what has reached your story">Surprise me</button></div>
<div class="muted" style="margin-top:10px"><small>In this chat</small></div>
<div class="row" style="margin-top:4px">${modeBtn("", "as Settings")}${modeBtn("off", "off")}${modeBtn("quiet", "quiet")}${modeBtn("living", "living")}${modeBtn("restless", "restless")}</div>
${x.ticks[0] ? `<p class="muted"><small>Last step: ${e(x.ticks[0].from)} → ${e(x.ticks[0].to)} (${x.ticks[0].hours} h) · ${x.ticks[0].beats} beat${x.ticks[0].beats === 1 ? "" : "s"} · ${x.ticks[0].seeds} new${x.ticks[0].proposed ? ` · ${x.ticks[0].proposed} proposed` : ""} · ${x.ticks[0].hops} news · ${e(x.ticks[0].status)}${x.ticks[0].tokens ? ` · ${Math.round(x.ticks[0].tokens / 100) / 10}K tokens` : ""}</small></p>` : `<p class="muted"><small>Nothing has moved yet: the world steps forward when story time moves ${x.step} minutes or more.</small></p>`}
<div class="row"><button class="btn" data-act="simulate">⏭ Move the world a step now</button></div></div>`;
    if (!director) {
      const reached = x.arrivals.filter((a: any) => a.status === "used");
      const waiting = (x.proposals ?? []).length;
      return `${head}${waiting ? `<p class="muted">${waiting} proposed subplot${waiting === 1 ? " is" : "s are"} waiting on you. Switch to Director to accept or decline ${waiting === 1 ? "it" : "them"}.</p>` : ""}<h4>What has reached you</h4>${reached.length ? `<ul class="alm-list">${reached.map((a: any) => `<li>${ROUTE[a.kind] ?? "•"} ${e(a.text)} <small class="muted">${e(a.at)}</small></li>`).join("")}</ul>` : `<div class="empty">Nothing from off the page has reached the story yet.</div>`}
<p class="muted"><small>${x.arcs.filter((a: any) => a.status === "running").length} subplots are moving where you can't see them. Switch to Director to look.</small></p>`;
    }
    const fates = x.arcs.filter((a: any) => a.status === "fate");
    const arcCard = (a: any) => {
      const live = a.status === "running" || a.status === "held";
      const editing = this.editing === `ew:${a.id}`;
      return `<div class="rec"><div class="hd">${ring(a.clock.cur, a.clock.max, a.kind === "threat" ? "var(--alm-danger)" : "var(--alm-accent)")}<b class="grow">${e(a.lead)} · ${KIND[a.kind] ?? e(a.kind)}</b><span class="pill">${e(a.status === "running" ? a.stage : a.status)}</span><span class="pill" title="Who could learn of it">${e(a.secrecy)}</span>${a.crossed ? `<span class="pill" title="It has reached the story">crossed</span>` : ""}${a.by === "player" ? `<span class="pill">yours</span>` : ""}</div>
<div class="muted">${e(a.premise)}</div>
<div class="alm-cc__row"><b>wants</b>${e(a.want)}</div><div class="alm-cc__row"><b>fears</b>${e(a.fear)}</div>${a.cast.length ? `<div class="alm-cc__row"><b>with</b>${e(a.cast.join(", "))}</div>` : ""}
${a.beats.length ? `<ul class="alm-list">${a.beats.map((b: any) => `<li><small class="muted">${e(b.at)} · ${b.roll[0]}+${b.roll[1]}${b.mod ? (b.mod > 0 ? "+" : "") + b.mod : ""} ${RES[b.result] ?? e(b.result)}${b.twist ? ` · twist` : ""}${b.telling ? " · the model is telling it…" : b.told === "template" ? `<span${b.note ? ` title="${e(b.note)}"` : ""}> · engine's words${b.note && x.telling !== "engine" ? " (the model's version was set aside)" : ""}</span>` : ""}${b.retell ? ` <button class="btn" data-act="ewRetell" data-id="${e(a.id)}" data-tick="${e(b.tick)}" data-at="${b.atAbs}" title="Ask the model to tell this step again (same outcome, new words)">retell</button>` : ""}</small><br>${e(b.text)}</li>`).join("")}</ul>` : ""}
${live && a.status === "running" && (a.wait || a.next) ? `<div class="alm-cc__row"><b>next</b><span>${a.wait ? `${e(a.wait)}; ` : ""}${a.next ? `not before ${e(a.next)}` : "any time now"}${a.wait ? `. <small class="muted">Nudge to make it happen now.</small>` : ""}</span></div>` : ""}
${(a.reached ?? []).length ? `<div class="alm-cc__row" title="Taken up by a reply: it happened on the page"><b>reached you</b><span>${a.reached.map((r: any) => `${ROUTE[r.kind] ?? ""} ${e(r.text)}${r.at ? ` <small class="muted">(${e(r.at)})</small>` : ""}`).join("<br>")}</span></div>` : ""}
${a.reaches.length ? `<div class="alm-cc__row" title="Not in the story yet: it goes to the model when the scene has room, and only counts once a reply shows it"><b>on its way</b><span>${a.reaches.map((r: any) => `${ROUTE[r.kind] ?? ""} ${e(r.text)}${r.at ? ` <small class="muted">(${e(r.at)})</small>` : ""}`).join("<br>")}<br><small class="muted">Not in the story yet.</small></span></div>` : ""}
${a.ending ? `<div class="alm-cc__row"><b>ended</b>${e(a.ending.text)} <small class="muted">${e(a.ending.at)}</small></div>` : ""}${a.note ? `<div class="alm-cc__row"><b>note</b>${e(a.note)}</div>` : ""}
<div class="muted"><small>grounds: ${a.grounds.map((g: any) => e(g.name)).join(" · ")}</small></div>
${editing ? `<label class="f">Premise<input type="text" id="almEwPremise" value="${e(a.premise)}"></label><label class="f">Wants<input type="text" id="almEwWant" value="${e(a.want)}"></label><label class="f">Fears<input type="text" id="almEwFear" value="${e(a.fear)}"></label><div class="row"><label class="f grow">Kind<select id="almEwKind">${Object.entries(KIND).filter(([k]) => k !== "world").map(([k, lab]) => `<option value="${k}"${k === a.kind ? " selected" : ""}>${lab}</option>`).join("")}</select></label><label class="f grow">Who could hear of it<select id="almEwSecrecy">${[["public", "public: anyone"], ["private", "private: those close to it"], ["secret", "secret: kept hidden"]].map(([k, lab]) => `<option value="${k}"${k === a.secrecy ? " selected" : ""}>${lab}</option>`).join("")}</select></label></div><div class="row"><button class="btn primary" data-act="ewSave" data-id="${e(a.id)}">Save</button><button class="btn" data-act="cancelEdit">Cancel</button></div>`
  : live ? `<div class="row">${a.status === "held" ? `<button class="btn" data-act="ewArc" data-id="${e(a.id)}" data-what="resume">resume</button>` : `<button class="btn" data-act="ewArc" data-id="${e(a.id)}" data-what="hold" title="Freeze it">hold</button><button class="btn" data-act="ewArc" data-id="${e(a.id)}" data-what="nudge" title="Its next step now">nudge</button><button class="btn" data-act="ewArc" data-id="${e(a.id)}" data-what="bring" title="Offer it to the next turn">bring in</button>`}<button class="btn" data-act="edit" data-id="ew:${e(a.id)}">edit</button><button class="btn danger" data-act="ewArc" data-id="${e(a.id)}" data-what="drop">drop</button></div>` : ""}</div>`;
    };
    const proposals = x.proposals ?? [];
    const proposalCard = (p: any) => `<div class="rec"><div class="hd"><b class="grow">${e(p.lead)} · ${KIND[p.kind] ?? e(p.kind)}</b><span class="pill" title="Who could learn of it">${e(p.secrecy)}</span><span class="pill">proposed</span></div>
<div class="muted">${e(p.premise)}${p.telling ? ` <small>(the model is putting it in the story's words…)</small>` : ""}</div>
<div class="alm-cc__row"><b>wants</b>${e(p.want)}</div><div class="alm-cc__row"><b>fears</b>${e(p.fear)}</div>${p.cast.length ? `<div class="alm-cc__row"><b>with</b>${e(p.cast.join(", "))}</div>` : ""}
<div class="alm-cc__row"><b>from</b><span>${e(p.why)} <small class="muted">· grounds: ${p.grounds.map((g: any) => e(g.name)).join(" · ")} · ${e(p.at)}</small></span></div>
${p.replaces ? `<div class="alm-cc__row"><b>replaces</b><span class="muted">${e(p.replaces)}</span></div>` : ""}
<div class="row"><button class="btn primary" data-act="ewPropose" data-id="${e(p.id)}" data-what="accept">Accept</button><button class="btn" data-act="ewPropose" data-id="${e(p.id)}" data-what="decline">Decline</button></div></div>`;
    const live = x.arcs.filter((a: any) => a.status === "running" || a.status === "held");
    const done = x.arcs.filter((a: any) => a.status === "resolved" || a.status === "dropped");
    const grp = (f: (p: any) => boolean) => x.people.filter(f);
    const person = (p: any) => `<span class="pill" title="${e(`${p.ring} · ${p.standing}${p.where ? ` · ${p.where}` : ""} · ${p.reach}`)}">${e(p.name)}${p.arc ? " ✦" : ""}${p.flags.out ? " (out)" : ""}${p.flags.wake ? " (awake)" : ""} <a href="#" data-act="ewPerson" data-name="${e(p.name)}" data-what="${p.flags.out ? "in" : "out"}" title="${p.flags.out ? "Back in the simulation" : "Leave them out of it"}">${p.flags.out ? "＋" : "×"}</a>${!p.flags.out && !p.awake ? ` <a href="#" data-act="ewPerson" data-name="${e(p.name)}" data-what="wake" title="Wake them next step">☀</a>` : ""}</span>`;
    const can = (p: any) => !["dead", "changed", "companion"].includes(p.standing);
    return `${head}
${fates.length ? `<h4>Waiting on you</h4><p class="muted">An ending that can't be undone. Accept it, soften it, or keep it for a scene on the page.</p>${fates.map((a: any) => `<div class="rec alm-warnbox"><b>${e(a.lead)} · ${KIND[a.kind] ?? e(a.kind)}</b><div>${e(a.fate?.text ?? a.fear)}</div><div class="row"><button class="btn primary" data-act="ewFate" data-id="${e(a.id)}" data-what="accept">Accept</button><button class="btn" data-act="ewFate" data-id="${e(a.id)}" data-what="soften">Soften</button><button class="btn" data-act="ewFate" data-id="${e(a.id)}" data-what="page">Keep it for the page</button></div></div>`).join("")}` : ""}
${proposals.length ? `<h4>Proposed</h4><p class="muted">Subplots the world found in the story and the lorebooks. Accept one and it starts at once; decline it and it won't be proposed again.</p><div class="list">${proposals.map(proposalCard).join("")}</div>` : ""}
<h4>Subplots</h4>${live.length ? `<div class="list">${live.map(arcCard).join("")}</div>` : `<div class="empty">${x.seeding === "off" ? "No subplots. New ones aren't made from the story (Settings → New subplots); give someone a story below." : x.seeding === "ask" ? "No subplots yet. When story time moves, the world proposes some from threads, debts, secrets, the lorebooks and what drives people." : "No subplots yet. They begin when story time moves, from threads, debts, secrets, the lorebooks and what drives people."}</div>`}
<h4>Give someone a story</h4><div class="card flat"><div class="row"><select id="almEwWho">${x.people.filter((p: any) => can(p) && p.ring !== "onstage").map((p: any) => `<option>${e(p.name)}</option>`).join("")}</select><input type="text" id="almEwText" class="grow" placeholder="Spike wants the chip out and is asking the wrong people"></div><div class="row"><span class="grow muted"><small>Your words stand; the engine moves it with the same dice, and its first step comes at once.${x.telling !== "engine" ? " The model reads your words first for the kind of story and what they're after." : ""}</small></span><button class="btn" data-act="ewAuthor">Start it</button></div></div>
<h4>In the wings</h4><div class="card flat">
<div><small class="muted">awake</small> ${grp((p: any) => p.awake).map(person).join(" ") || "—"}</div>
<div><small class="muted">on the page</small> ${grp((p: any) => p.ring === "onstage").map((p: any) => `<span class="pill">${e(p.name)}</span>`).join(" ") || "—"}</div>
<div><small class="muted">asleep</small> ${grp((p: any) => !p.awake && p.ring !== "onstage" && can(p)).map(person).join(" ") || "—"}</div>
<div><small class="muted">can't act</small> ${grp((p: any) => !can(p)).map((p: any) => `<span class="pill">${e(p.name)} · ${e(p.standing)}</span>`).join(" ") || "—"}</div>
<p class="muted"><small>✦ has a subplot. Hover a name for where they are; × leaves someone out of it, ☀ wakes them for the next step.</small></p></div>
${x.arrivals.length ? `<h4>On the way, and arrived</h4><ul class="alm-list">${x.arrivals.map((a: any) => `<li>${ROUTE[a.kind] ?? "•"} <small class="muted">${e(a.status)}${a.at ? ` · ${e(a.at)}` : ""}${a.carrier ? ` · via ${e(a.carrier)}` : ""}${a.why ? ` · ${e(a.why)}` : ""}</small><br>${e(a.text)}</li>`).join("")}</ul>` : ""}
${done.length ? `<details><summary class="muted">Ended (${done.length})</summary><div class="list">${done.map(arcCard).join("")}</div></details>` : ""}
${x.ticks.length ? `<details><summary class="muted">The engine's log</summary>${x.ticks.map((t: any) => `<div class="rec"><b>${e(t.from)} → ${e(t.to)}</b> <small class="muted">${e(t.status)}${t.rejected.length ? ` · ${t.rejected.length} told by the engine instead` : ""}</small><ul class="alm-list">${t.log.map((l: string) => `<li><small>${e(l)}</small></li>`).join("")}${t.rejected.map((l: string) => `<li><small class="muted">kept to the engine's words: ${e(l)}</small></li>`).join("")}</ul></div>`).join("")}</details>` : ""}`;
  }

  tab_lore(v: any): string {
    const books = Object.entries(v.lore.books ?? {});
    return `<p class="muted">The Lore Bridge reads the character, persona, chat and global lorebooks into the Codex. Your books are never edited unless you allow it.</p>
${worldPanel(v.lore.world, !!v.settings?.simulator)}
<div class="row"><button class="btn primary" data-act="loreScan">Re-read lorebooks</button>${v.lore.review?.length ? `<button class="btn" data-act="loreClassify">Classify ${v.lore.review.length} unclear entries with the model</button>` : ""}<button class="btn" data-act="mirrorSync">Sync mirror book</button></div>
<div class="list" style="margin-top:10px">${books.map(([id, b]: any) => `<div class="rec"><div class="hd"><b class="grow">${e(b.name)}</b>${b.weaver ? `<span class="pill" title="${e(WEAVER_BOOK[b.weaver]?.[1] ?? "")}">Dream Weaver · ${e(WEAVER_BOOK[b.weaver]?.[0] ?? b.weaver)}</span>` : ""}<span class="pill">${e(b.scope)}</span><span class="pill">${b.count} entries</span></div>
${loreKinds(b.kinds)}
<div class="row"><label class="f grow">Activation<select data-lore-mode="${e(id)}">${["native", "assisted", "managed"].map((m) => `<option value="${m}"${m === b.mode ? " selected" : ""}>${m}</option>`).join("")}</select></label></div></div>`).join("") || `<div class="empty">No lorebooks are attached to this chat.</div>`}</div>
<p class="muted"><b>Native</b>: your keywords decide; the Ledger only annotates lore the story has moved past. <b>Assisted</b>: plus the entries Recall picks. <b>Managed</b>: the Ledger is the only retrieval owner for that book. The Ledger reads these books and never writes to them.</p>
${(v.playbooks ?? []).length ? `<h4>Playbooks</h4><p class="muted">Scripted scenes from depth books: how someone would act if the story reaches a moment. They are never sent as lore, because the model took them for things that had happened. When a turn comes close to one, it goes in once, marked "not history". Mark one played once the story has had that scene.</p><div class="list">${v.playbooks.map((p: any) => `<div class="rec"><div class="hd"><b class="grow">${e(p.name)}</b>${p.subject ? `<span class="pill">${e(p.subject)}</span>` : ""}<button class="btn" data-act="playbookPlayed" data-id="${e(p.id)}" data-played="${p.played ? "1" : ""}">${p.played ? "✓ played · undo" : "mark played"}</button></div><details><summary class="muted">The scene</summary><div class="muted">${e(p.summary)}</div></details></div>`).join("")}</div>` : ""}
${v.lore.review?.length ? `<h4>Review queue</h4><ul class="alm-list">${v.lore.review.slice(0, 40).map((r: any) => `<li>${e(r.title)} — read as <b>${e(r.kind)}</b> (${Math.round(r.confidence * 100)}%)</li>`).join("")}</ul>` : ""}`;
  }

  tab_creator(v: any): string {
    return this.creator.render(v);
  }

  tab_recall(v: any): string {
    const f = v.feed?.[0];
    const via = (i: any) => (!i.injected ? "" : i.via === "mirror" ? ` <span class="pill" title="Sent as a forced entry of the chat's mirror lorebook: the Prompt Breakdown lists it under World Info, not under ALMANAC · Recall">lorebook</span>` : i.via === "recall" ? ` <span class="pill" title="Sent inside the ALMANAC · Recall block">recall</span>` : "");
    const ck = v.checks?.issues ?? [];
    const checkCard = `<div class="card flat"><div class="row"><b class="grow">Check of the latest reply</b><button class="btn" data-act="recheck" title="Run the check again on the latest reply">Check again</button></div>${ck.length ? `<ul class="alm-list">${ck.map((i: any) => `<li class="${i.level === "warn" ? "due" : ""}">${i.level === "warn" ? "⚠" : "ⓘ"} ${e(i.text)}${i.quote && !i.text.includes(i.quote) ? ` <small class="muted">«${e(i.quote)}»</small>` : ""}</li>`).join("")}</ul><p class="muted"><small>The next turn's note tells the model about the ⚠ ones. If a slip matters, swipe for a new take.</small></p>` : `<p class="muted">${v.settings?.replyCheck === "off" ? "The reply check is off (Settings › Knowledge)." : "Nothing found."}</p>`}</div>`;
    return `${checkCard}<p class="muted">What Recall considered for the latest generation, with scores and reasons. Green = injected. Records the chat's mirror lorebook holds go in as its entries (the Prompt Breakdown shows them under World Info); the rest go in the ALMANAC · Recall block.</p>
${f ? `<div class="card flat"><div class="row"><span class="pill">tier: ${e(f.tier)}</span><span class="pill">≈ ${f.tokens} tokens injected</span><span class="pill">${new Date(f.at).toLocaleTimeString()}</span></div>
${f.chronicle?.length ? `<p class="muted"><small>Story so far in this prompt: ${f.chronicle.map((c: any) => e(c.name)).join(" · ")}</small></p>` : ""}
${f.ceiling ? `<p class="muted"><small>Ceiling ${f.ceiling.limit} tokens: this turn ≈${f.ceiling.after}${f.ceiling.trimmed?.length ? ` (≈${f.ceiling.before} before trimming; ${f.ceiling.trimmed.map((t: string) => e(t)).join("; ")})` : ""}.</small></p>` : ""}
<div class="feed">${f.items.map((i: any) => `<div class="it${i.injected ? " in" : ""}"><span class="sc">${i.score}</span><div><b>${e(i.name)}</b>${via(i)} <small class="muted">${e(i.id)}</small><br><small class="muted">${e(i.reasons.join(" · "))}</small></div></div>`).join("")}</div></div>` : `<div class="empty">No retrieval yet.</div>`}
${v.rejected.length ? `<h4>Rejected or corrected ledger lines</h4><div class="list">${v.rejected.slice().reverse().map((r: any) => `<div class="rec"><code>${e(r.raw)}</code><div class="muted"><small>message ${r.msgIndex + 1} · ${e(r.verdict)} — ${e(r.reason ?? "")}</small></div></div>`).join("")}</div>` : ""}`;
  }

  tab_craft(v: any): string {
    const t = v.telemetry;
    if (!t) return `<div class="empty">Craft telemetry appears after a few replies.</div>`;
    return `<div class="card flat"><h4>Next reply is told</h4><div>Avoid: ${t.avoids.map((a: string) => `<span class="pill">${e(a)}</span>`).join("") || "—"}</div><div style="margin-top:6px">Try: <b>${e(t.technique)}</b></div>${t.agency.length ? `<div class="alm-tag warn" style="margin-top:8px">${e(t.agency.join("; "))}</div>` : ""}</div>
<div class="card flat"><h4>Last six replies</h4><div class="kv">${Object.entries(t.metrics).map(([k, x]) => `<b>${e(k)}</b><span>${e(String(x))}</span>`).join("")}</div></div>
${t.repeated.length ? `<div class="card flat"><h4>Repeated phrases</h4>${t.repeated.map((r: any) => `<span class="pill">“${e(r.phrase)}” ×${r.count}</span>`).join("")}</div>` : ""}
<div class="card flat"><h4>Openings</h4>${t.openings.map((o: string) => `<span class="pill">${e(o)}</span>`).join("")}</div>`;
  }

  tab_settings(v: any): string {
    const s = v.settings;
    const sel = (k: string, opts: [string, string][]) => `<select data-setting="${k}">${opts.map(([val, lab]) => `<option value="${val}"${String(s[k]) === val ? " selected" : ""}>${lab}</option>`).join("")}</select>`;
    const num = (k: string, min = 0, max = 99999) => `<input type="number" data-setting="${k}" value="${s[k]}" min="${min}" max="${max}">`;
    const chk = (k: string, lab: string) => `<label class="chk"><input type="checkbox" data-setting="${k}"${s[k] ? " checked" : ""}> ${lab}</label>`;
    const txt = (k: string, ph = "") => `<input type="text" data-setting="${k}" value="${e(s[k] ?? "")}" placeholder="${e(ph)}">`;
    // A Lumiverse connection profile, picked by name; "" falls back as the empty label says.
    const conn = (k: string, empty: string) => {
      const list: { id: string; name: string; model: string; isDefault: boolean }[] | null = v.connections;
      if (!list) return txt(k, "connection id");
      const cur = String(s[k] ?? "");
      const opts = [`<option value=""${cur ? "" : " selected"}>${e(empty)}</option>`,
        ...list.map((c) => `<option value="${e(c.id)}"${c.id === cur ? " selected" : ""}>${e(c.name)}${c.model ? ` — ${e(c.model)}` : ""}${c.isDefault ? " (default)" : ""}</option>`)];
      if (cur && !list.some((c) => c.id === cur)) opts.push(`<option value="${e(cur)}" selected>missing connection (${e(cur.slice(0, 8))}…)</option>`);
      return `<select data-setting="${k}">${opts.join("")}</select>`;
    };
    return `<h3>This chat</h3><div class="card flat"><div class="row"><span class="grow">Ledger in this chat: <b>${v.enabled ? "on" : "off"}</b>${v.config.enabledOverride == null ? " (automatic)" : ""}</span><button class="btn" data-act="enable">On</button><button class="btn" data-act="disable">Off</button><button class="btn" data-act="auto">Automatic</button></div>${v.hiddenTurns ? `<div class="row"><span class="grow muted"><small>${v.hiddenTurns} turn${v.hiddenTurns === 1 ? " is" : "s are"} hidden under summaries. Switching the chat off shows them again; so does this button (do it before uninstalling).</small></span><button class="btn" data-act="releaseHidden">Show hidden turns</button></div>` : ""}
<label class="f">Story truths <small class="muted">— one a line; sent every turn and held over the source material and older chat</small><textarea id="almTruths" rows="3" placeholder="Jaime and Cersei are strictly family.&#10;Rhaegar is bald and wears a wig.">${e((v.config.truths ?? []).join("\n"))}</textarea></label><div class="row"><span class="grow muted"><small>You can also pin one from a message: <code>((truth: …))</code>.</small></span><button class="btn" data-act="saveTruths">Save truths</button></div></div>
<h3>Core</h3><div class="card flat"><label class="f">Enable<select data-setting="enabled"><option value="auto"${s.enabled === "auto" ? " selected" : ""}>automatic (ALMANAC chats)</option><option value="on"${s.enabled === "on" ? " selected" : ""}>every chat</option><option value="off"${s.enabled === "off" ? " selected" : ""}>off</option></select></label>
<label class="f">Validation${sel("strictness", [["strict", "strict — reject impossible changes"], ["lenient", "lenient — warn only"]])}</label>${chk("autoRepair", "Repair missing ledgers automatically")}${chk("formatAid", "Show the model last turn's ledger as a format example")}${chk("debug", "Debug logging")}</div>
<h3>Chronicle</h3><div class="card flat">${chk("chronicle", "Summarise old turns into chapters, arcs and volumes")}${chk("hideCovered", "Hide covered turns")}<label class="f">Summaries in the prompt${sel("chronicleInject", [["all", "the whole story, every turn"], ["relevant", "only when relevant"]])}</label><p class="muted"><b>The whole story</b> puts every stretch before the raw tail in each prompt, once, at its most compact level (volumes, then arcs, then chapters), and brings back a folded chapter in full when a turn touches it. <b>Only when relevant</b> sends the latest chapter, which leads into the turns the model sees, and up to three earlier chapters that share names, places or other distinctive words with the turn. It costs fewer tokens, but the model forgets what isn't picked.</p><label class="f">Raw tail (messages)${num("rawTail", 6, 400)}</label><label class="f">Raw tail cap (tokens)${num("rawTailTokens", 1000)}</label><label class="f">Chapter size (tokens)${num("chapterThresholdTokens", 1000)}</label><label class="f">Fan-in (chapters per arc, arcs per volume)${num("fanIn", 2, 12)}</label><label class="f">Summary detail${sel("summaryDetail", [["brief", "brief — the essentials (≈100–200 words a chapter)"], ["standard", "standard — facts and changes (≈150–350)"], ["detailed", "detailed — scene by scene, where things stand (≈350–650)"], ["exhaustive", "exhaustive — beats, texture, voices (≈700–1200)"]])}</label><label class="f">Always keep in summaries (optional)${txt("summaryFocus", "outfits, injuries, Buffy's lies, pet names…")}</label><p class="muted">More detail keeps more of the story in memory, at the cost of prompt tokens. New chapters use the new setting; <b>Rewrite all</b> on the Chronicle page redoes the old ones.</p><label class="f">Summariser connection${conn("summarizerConnection", "your default connection")}</label></div>
<h3>Knowledge</h3><div class="card flat"><label class="f">Knowledge clerk${sel("knowledgeClerk", [["auto", "when a reply's lines need it (bundled, untagged, diary-like)"], ["always", "every reply"], ["off", "off"]])}</label><p class="muted">After a reply, a quiet call rewrites its knowledge lines cleanly: one fact a line, the #keys in play, information rather than what someone noticed. It runs in the background; the next turn waits for it up to 8 seconds.</p><label class="f">Clerk connection${conn("clerkConnection", "same as the summariser")}</label>
${chk("secretsOffPage", "Keep secrets off the page when the model names words to avoid (<code>secret … | never say: …</code>)")}<p class="muted">A secret you mark on the Knowledge page is always kept off the page until it comes out.</p>
<label class="f">Check each reply${sel("replyCheck", [["rules", "rules: secrets named, leaks, the dead or absent speaking, looks contradicted"], ["model", "rules, plus a quiet model read for past events the record doesn't hold"], ["off", "off"]])}</label><label class="f">Check connection${conn("replyCheckConnection", "same as the summariser")}</label>
<label class="f">Facts in your own messages${sel("playerFacts", [["rules", "rules: dates (\"it's day 12\"), looks (\"X has violet eyes\"), ((truth: …))"], ["model", "rules, plus a quiet model read of what you state"], ["off", "off"]])}</label><p class="muted">What you state is your word: the story can't overwrite a look you set, and a date you give moves the clock, even backwards.</p></div>
<h3>Prompt size</h3><div class="card flat"><label class="f">Ceiling for everything the Almanac adds to a prompt (tokens; 0 = no ceiling)${num("injectCeiling", 0, 1000000)}</label><div class="row">${[["8000", "8K"], ["16000", "16K"], ["24000", "24K"], ["48000", "48K"], ["0", "none"]].map(([n, lab]) => `<button class="btn${String(s.injectCeiling) === n ? " primary" : ""}" data-act="ceiling" data-id="${n}">${lab}</button>`).join("")}</div><p class="muted">The note, recall, the mirror lorebook's cards and the chapter summaries together. Over the ceiling, the summaries narrow to the ones this turn touches, then the oldest of those are left out, then the lowest-ranked recall records. The note and the latest chapter always go in. Lumiverse fits the rest of the prompt to your model's context before the Almanac adds its part, so leave room: with a 32K model, try 8K. The Recall page shows what the last turn cost and what was cut.${v.feed?.[0]?.ceiling ? ` Last turn: ≈${v.feed[0].ceiling.after} tokens${v.feed[0].ceiling.before > v.feed[0].ceiling.after ? ` (≈${v.feed[0].ceiling.before} before trimming)` : ""}.` : v.feed?.[0] ? ` Last turn: ≈${v.feed[0].tokens} tokens.` : ""}</p></div>
<h3>Recall</h3><div class="card flat"><label class="f">Note and recall budget (tokens)${num("recallBudget", 400, 20000)}</label><label class="f">Recall placement${sel("recallPlacement", [["before_history", "before chat history"], ["depth4", "4 messages from the end"]])}</label>${chk("keyHeat", "Demote keys that fire without being used")}<label class="f">Max keys per record${num("maxKeys", 4, 24)}</label><label class="f">Words never used as keys <small class="muted">— comma-separated</small><input type="text" data-list-setting="stopList" value="${e((s.stopList ?? []).join(", "))}" placeholder="house, door, tea"></label></div>
<h3>Storage (hybrid)</h3><div class="card flat"><p class="muted">The extension's storage is the source of truth (branch-safe, rebuildable). The mirror lorebook is a readable, editable projection attached to this chat only.</p><label class="f">Mirror lorebook${sel("mirror", [["off", "off"], ["summaries", "summaries"], ["full", "full records"]])}</label>${chk("mirrorVectorize", "Vectorise mirror entries (semantic recall; needs an embedding provider)")}</div>
<h3>Lore bridge</h3><div class="card flat"><label class="f">Default activation for new books${sel("loreDefaultMode", [["native", "native"], ["assisted", "assisted"], ["managed", "managed"]])}</label><p class="muted">Your lorebooks are only read, never written to (only the Lorebook Creator writes, and only where you tell it to).</p><label class="f">Lorebook Creator connection${conn("creatorConnection", "same as the summariser")}</label><p class="muted">The model the Creator talks with and writes entries with. A capable model plans and writes better books; the conversation sends your sources and the chosen book's index with each turn.</p></div>
<h3>World engines</h3><div class="card flat"><label class="f">Climate (default for new chats)${txt("climate", "temperate maritime")}</label><label class="f">Latitude${txt("latitude", "temperate / 51 N / southern subpolar")}</label><label class="f">Calendar${txt("calendar", "Westeros · Roshar · Harptos · Shire Reckoning · or months: Name (30), …; weekdays: …")}</label><label class="f">Elsewhere: the world off the page${sel("elsewhere", [["off", "off"], ["quiet", "quiet: a little, mostly on time jumps"], ["living", "living: subplots move, one crossing a scene"], ["restless", "restless: more subplots, more crossings"]])}</label><label class="f">New subplots from the story and lorebooks${sel("elsewhereSeeding", [["ask", "propose them: I accept or decline each"], ["auto", "start them on their own"], ["off", "off: only stories I write"]])}</label><label class="f">Telling${sel("elsewhereTelling", [["model", "the model tells each step (one quiet call)"], ["engine", "the engine's own words (no model calls)"]])}</label><label class="f">Canon gravity${sel("canonGravity", [["light", "light: a lore forecast may ground a subplot"], ["strong", "strong: forecasts run toward canon unless the story diverged"], ["off", "off: only the chat and the lore"]])}</label><label class="f">Irreversible endings off the page${sel("fates", [["ask", "ask me first"], ["page", "only on the page"], ["allow", "allow"]])}</label><label class="f">Step (minutes of story time)${num("simStep", 30, 10000)}</label><label class="f">Elsewhere connection${conn("simConnection", "your default connection")}</label>${chk("pressures", "Hidden pressures for new characters")}${chk("chekhov", "Chekhov nudges for unused plants")}${chk("telemetry", "Craft telemetry")}</div>
<h3>Director</h3><div class="card flat"><p class="muted">Used when the preset's Director's Pass channel is set to Sidecar.</p><label class="f">Planner connection${conn("sidecarConnection", "your default connection")}</label><label class="f">Planner timeout (seconds)${num("sidecarTimeout", 5, 90)}</label></div>
<p class="muted" style="margin:14px 0 0">ALMANAC Ledger ${VERSION}${v.version && v.version !== VERSION ? ` · background process ${e(v.version)}` : ""}</p><h3>Look</h3><div class="card flat"><label class="f">Skin${sel("theme", [["preset", "follow the preset (Auto by genre)"], ...SKIN_LIST])}</label><label class="f">Light or dark${sel("skinMode", [["auto", "Auto (follow Lumiverse)"], ["light", "Light"], ["dark", "Dark"]])}</label>${this.skinColors(v)}${chk("fonts", "Load the skins' web fonts from Google Fonts (your browser contacts Google)")}${chk("hud", "Floating Now widget")}${this.hudProblem === "permission" ? `<div class="row"><span class="muted grow">The floating widget needs the <b>ui_panels</b> permission.</span><button class="btn" data-act="grantPanels">Grant</button></div>` : this.hudProblem ? `<p class="muted">The floating widget could not open: ${e(this.hudProblem)}</p>` : ""}${chk("narratorOnlyToTools", "Let LLM tools see narrator-only records")}</div>`;
  }

  /** The skin and palette on screen: the ones the colour pickers change. */
  lookTarget(): { skin: string; mode: "light" | "dark" } {
    const mode = document.documentElement.getAttribute?.("data-alm-mode") === "dark" ? "dark" : "light";
    return { skin: this.view?.theme || "almanac", mode };
  }

  /** The player's colours with one changed (null: back to the skin's own; no token: the whole palette). */
  withSkinColor(token: string | null, value: string | null): Record<string, any> {
    const { skin, mode } = this.lookTarget();
    const all = { ...(this.view?.settings?.skinColors ?? {}) };
    const pal = token ? { ...(all[skin]?.[mode] ?? {}) } : {};
    if (token && value) pal[token] = value;
    else if (token) delete pal[token];
    all[skin] = { ...(all[skin] ?? {}), [mode]: pal };
    if (!Object.keys(pal).length) delete all[skin][mode];
    if (!Object.keys(all[skin]).length) delete all[skin];
    return all;
  }

  saveSkinColors(colors: Record<string, any>) {
    this.send({ type: "settings", patch: { skinColors: colors } });
    if (this.view?.settings) this.view.settings.skinColors = colors;
    this.ctx.events.emit("almanac:skinColors", colors);
    this.render();
  }

  /** Settings › Look: a picker for each colour of the skin and palette on screen. */
  skinColors(v: any): string {
    const { skin, mode } = this.lookTarget();
    const mine: Record<string, string> = v.settings?.skinColors?.[skin]?.[mode] ?? {};
    const own = skinPalette(skin, mode);
    const name = SKIN_LIST.find(([id]) => id === skin)?.[1] ?? skin;
    const rows = SKIN_COLORS.map(([k, lab, what]) => `<div class="almc-row"><label><input type="color" class="swatch" data-skin-color="${k}" value="${e(toHex(mine[k] ?? own?.[k] ?? liveHex(k)))}"><span>${lab}${what ? ` <small class="muted">${what}</small>` : ""}</span></label>${mine[k] ? `<button class="btn" data-act="skinColorReset" data-id="${k}" title="Back to the skin's own colour" aria-label="Reset ${e(lab)}">reset</button>` : ""}</div>`).join("");
    return `<div class="almc"><div class="row"><span class="grow"><b>Colours</b> <span class="muted">— ${e(skin === "lumiverse" ? "Lumiverse's theme" : name)}, ${mode}</span></span>${Object.keys(mine).length ? `<button class="btn" data-act="skinColorsReset" title="Put back every colour of this palette">Reset all</button>` : ""}</div>
<div class="almc-grid">${rows}</div>
<p class="muted" style="margin:0"><small>Your colours are kept for each skin, and for its light and its dark palette separately. To change the other palette, switch <b>Light or dark</b> above.</small></p></div>`;
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  onClick(ev: Event) {
    const t = ev.target as HTMLElement;
    // A fact's history stays open or closed across refreshes (the click lands before the toggle).
    const hist = t.closest("summary")?.parentElement as HTMLDetailsElement | null;
    if (hist?.dataset.fact) {
      if (hist.open) this.openFacts.delete(hist.dataset.fact);
      else this.openFacts.add(hist.dataset.fact);
    }
    const pageBtn = t.closest("[data-page]") as HTMLElement | null;
    if (pageBtn) {
      this.go(pageBtn.dataset.page as Tab);
      return;
    }
    const planet = t.closest("[data-orbit]") as HTMLElement | null;
    if (planet) {
      this.orbit = this.orbit === planet.dataset.orbit ? "" : planet.dataset.orbit!;
      if (this.orbit === "engine") this.markEngineSeen();
      this.render();
      (this.root.querySelector(".almo-moonb") as HTMLElement | null)?.focus();
      return;
    }
    if (this.orbit && !t.closest(".almo-orbit")) {
      this.orbit = "";
      this.render();
      return;
    }
    if (this.creator.onClick(t)) return;
    const act = (t.closest("[data-act]") as HTMLElement | null)?.dataset;
    if (!act) return;
    const id = act.id;
    const val = (sel: string) => (this.root.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "";
    switch (act.act) {
      case "enable": this.send({ type: "enable", value: true }); break;
      case "disable": this.send({ type: "enable", value: false }); break;
      case "releaseHidden": this.send({ type: "releaseHidden" }); break;
      case "clearProblems": this.send({ type: "clearProblems" }); if (this.view) this.view.problems = []; this.render(); break;
      case "dismissNotice": this.notice = null; this.render(); break;
      case "userOpsRemove": this.send({ type: "userOpsRemove", key: (t.closest("[data-key]") as HTMLElement | null)?.dataset.key, id }); break;
      case "ceiling": {
        const n = Number(id ?? 0);
        this.send({ type: "settings", patch: { injectCeiling: n } });
        if (this.view) this.view.settings.injectCeiling = n;
        this.render();
        break;
      }
      case "auto": this.send({ type: "enable", value: null }); break;
      case "sessionZero": this.ctx.events.emit("almanac:sessionZero", { chatId: this.view?.chatId }); break;
      case "repairLast": this.send({ type: "repairLast" }); break;
      case "rebuild": this.send({ type: "rebuild" }); break;
      case "retryState": this.ctx.events.emit("almanac:retryState", {}); break;
      case "grantPanels": this.ctx.events.emit("almanac:grantPanels", {}); break;
      case "edit": this.editing = id ?? null; this.render(); break;
      case "cancelEdit": this.editing = null; this.render(); break;
      case "chronFilter": this.chronFilter = (id as any) || "all"; this.render(); break;
      case "factKind": this.factKind = (id as any) || "play"; this.render(); break;
      case "clerkTidy": this.clerkProgress = ""; this.send({ type: "clerkTidy" }); if (this.view) this.view.clerk = { ...this.view.clerk, running: true }; this.render(); break;
      case "clerkStop": this.send({ type: "clerkStop" }); this.clerkProgress = "stopping…"; this.render(); break;
      case "chronToggle": if (!id) break; if (this.chronOpen.has(id)) this.chronOpen.delete(id); else this.chronOpen.add(id); this.render(); break;
      case "saveRecord": {
        const body: Record<string, string> = {};
        if (this.root.querySelector("#almEdRoutine")) body.routine = val("#almEdRoutine");
        if (this.root.querySelector("#almEdHours")) body.hours = val("#almEdHours");
        this.send({ type: "codexEdit", id, patch: { summary: val("#almEdSummary"), keys: val("#almEdKeys").split(",").map((s) => s.trim()).filter(Boolean), locked: true, body, narratorOnly: (this.root.querySelector("#almEdNarr") as HTMLInputElement)?.checked } });
        this.editing = null;
        break;
      }
      case "unlock": this.send({ type: "codexEdit", id, patch: { locked: false } }); this.editing = null; break;
      case "deleteRecord": this.send({ type: "codexEdit", id, patch: { delete: true } }); this.editing = null; break;
      case "newRecord": {
        const name = val("#almNewName").trim();
        if (!name) return;
        const kind = val("#almNewKind");
        const prefix: Record<string, string> = { person: "char:", place: "loc:", object: "item:", group: "fac:" };
        this.send({ type: "codexEdit", id: `${prefix[kind] ?? "custom:"}${name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_")}`, patch: { create: true, kind, name, summary: val("#almNewSummary"), locked: true } });
        break;
      }
      case "userOps": this.send({ type: "userOps", lines: val("#almOps").split("\n").filter((l) => l.trim()) }); break;
      case "editPressure": {
        const cur = this.view?.cast.find((c: any) => c.id === id)?.pressure ?? "";
        const text = window.prompt("Hidden pressure (narrator-only). Empty to clear.", cur);
        if (text !== null) this.send({ type: "pressure", charId: id, text });
        break;
      }
      case "chronicleRun": this.send({ type: "chronicle", action: "run" }); break;
      case "factEdit": this.editingFact = id ?? null; this.render(); break;
      case "factAdd": this.editingFact = "__new"; this.render(); break;
      case "charAdd": this.editingChar = "__new"; this.render(); break;
      case "charEdit": this.editingChar = this.editingChar === id ? null : id ?? null; this.render(); break;
      case "charCancel": this.editingChar = null; this.render(); break;
      case "charSave": {
        if (!id) break;
        const val = (sel: string) => (this.root.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null)?.value?.trim();
        const name = val("#almCharName");
        const age = val("#almCharAge") ?? "";
        const always = val("#almCharAlways") ?? "";
        const aliases = (val("#almCharAliases") ?? "").split(/\s*[;\n]\s*/).map((a) => a.trim()).filter(Boolean);
        const low = (a: string) => a.toLowerCase();
        const edits = { ...(this.view?.config?.castEdits ?? {}) };
        const cast: any[] = this.view?.cast ?? [];
        if (id === "__new") {
          if (!name) break;
          const low = name.toLowerCase();
          const taken = cast.find((c) => c.name.toLowerCase() === low || c.aliases?.some((a: string) => a.toLowerCase() === low));
          if (taken) {
            window.alert(`${taken.name} is already in the cast.`);
            break;
          }
          let key = low.normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "person";
          while (cast.some((c) => c.id === key) || edits[key]) key += "_";
          edits[key] = { name, ...(age ? { age } : {}), ...(always ? { always } : {}), ...(aliases.length ? { addAliases: aliases } : {}), added: Math.max(0, (this.view?.counts?.messages ?? 1) - 1) };
        } else {
          const c = cast.find((x) => x.id === id);
          const next: any = { ...(edits[id] ?? {}) };
          if (name && !c?.isUser && name !== c?.name) next.name = name;
          next.age = age;
          // Aliases taken away stay away; ones given are kept, and giving one back undoes taking it.
          const before: string[] = c?.aliases ?? [];
          const removed = before.filter((a) => !aliases.some((x) => low(x) === low(a)));
          const added = aliases.filter((x) => !before.some((a) => low(a) === low(x)));
          const drop = [...((next.dropAliases ?? []) as string[]).filter((a) => !added.some((x) => low(x) === low(a))), ...removed];
          const add = [...((next.addAliases ?? []) as string[]).filter((a) => !removed.some((x) => low(x) === low(a))), ...added];
          if (drop.length) next.dropAliases = drop;
          else delete next.dropAliases;
          if (add.length) next.addAliases = add;
          else delete next.addAliases;
          // The line as written replaces what the sources say; untouched, nothing changes; emptied, the sources speak again.
          if (always !== (c?.fixed ?? "")) {
            next.always = always;
            next.appearance = "";
          }
          edits[id] = next;
        }
        this.editingChar = null;
        this.send({ type: "config", patch: { castEdits: edits } });
        break;
      }
      case "factCancel": this.editingFact = null; this.render(); break;
      case "factSave": {
        if (!id) break;
        const val = (sel: string) => (this.root.querySelector(sel) as HTMLInputElement | HTMLSelectElement | null)?.value?.trim() ?? "";
        const f = this.view?.knowledge.find((x: any) => x.key === id);
        const edits = { ...(this.view?.config?.factEdits ?? {}) };
        let key = id;
        if (id === "__new") {
          const words = val("#almFactStmt");
          if (!words) break;
          const taken = new Set([...(this.view?.knowledge ?? []).map((x: any) => x.key), ...(this.view?.hiddenFacts ?? []).map((x: any) => x.key), ...Object.keys(edits)]);
          const base = words.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter((w) => w.length > 2 && !/^(the|and|that|was|his|her|their|with|from|has|have|who|for)$/.test(w)).slice(0, 3).join("-") || "fact";
          key = base;
          for (let i = 2; taken.has(key); i++) key = `${base}-${i}`;
          edits[key] = { added: Math.max(0, (this.view?.counts?.messages ?? 1) - 1) };
        }
        const next: any = { ...(edits[key] ?? {}) };
        const stmt = val("#almFactStmt");
        if (stmt && stmt !== f?.statement) next.statement = stmt;
        const truth = val("#almFactTruth");
        if (truth) next.truth = truth;
        else delete next.truth;
        const into = val("#almFactInto");
        if (into) next.into = into;
        const people: Record<string, string> = {};
        this.root.querySelectorAll<HTMLSelectElement>("select[data-person]").forEach((sel) => {
          if (sel.value) people[sel.dataset.person!] = sel.value;
        });
        if (Object.keys(people).length) next.people = people;
        else delete next.people;
        const offOn = (this.root.querySelector("#almFactOffOn") as HTMLInputElement | null)?.checked;
        const offWords = val("#almFactOffWords").split(/\s*,\s*/).filter(Boolean);
        const offAs = val("#almFactOffAs");
        if (offOn) next.offPage = { words: offWords, ...(offAs ? { wording: offAs } : {}) };
        else if (f?.offPage || next.offPage) next.offPage = null;
        if (id === "__new") next.statement = stmt;
        edits[key] = next;
        this.editingFact = null;
        this.send({ type: "config", patch: { factEdits: edits } });
        break;
      }
      case "factDelete": {
        const b = t.closest("button") as HTMLButtonElement | null;
        if (b && b.dataset.armed !== "1") {
          b.dataset.armed = "1";
          b.textContent = "Click again to delete";
          setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "delete"; } }, 4000);
          break;
        }
      }
      // falls through
      case "factHide":
      case "factRestore": {
        if (!id) break;
        const edits = { ...(this.view?.config?.factEdits ?? {}) };
        const next: any = { ...(edits[id] ?? {}) };
        if (act.act !== "factRestore") next.hidden = true;
        else delete next.hidden;
        edits[id] = next;
        this.editingFact = null;
        this.send({ type: "config", patch: { factEdits: edits } });
        break;
      }
      case "notPerson": {
        const b = t.closest("button") as HTMLButtonElement | null;
        if (b && b.dataset.armed !== "1") {
          b.dataset.armed = "1";
          b.textContent = "Click again to remove";
          setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Not a person — remove"; } }, 4000);
          break;
        }
        const c = this.view?.cast.find((x: any) => x.name === act.name);
        const merges = { ...(this.view?.config?.merges ?? {}) };
        for (const n of [act.name, ...(c?.aliases ?? [])]) if (n) merges[String(n).toLowerCase()] = NOT_A_PERSON;
        this.send({ type: "config", patch: { merges } });
        break;
      }
      case "restorePerson": {
        const merges = { ...(this.view?.config?.merges ?? {}) };
        delete merges[String(act.name ?? "").toLowerCase()];
        this.send({ type: "config", patch: { merges } });
        break;
      }
      case "unmerge": {
        const merges = { ...(this.view?.config?.merges ?? {}) };
        delete merges[String(act.name ?? "").toLowerCase()];
        this.send({ type: "config", patch: { merges } });
        break;
      }
      case "chronicleRewrite": {
        // Two clicks: the first arms the button (no browser dialogs inside the host).
        const b = t.closest("button") as HTMLButtonElement | null;
        if (b && b.dataset.armed !== "1") {
          b.dataset.armed = "1";
          b.textContent = "Click again to rewrite";
          setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Rewrite all"; } }, 4000);
          break;
        }
        this.send({ type: "chronicle", action: "rewriteAll" });
        break;
      }
      case "unitSave": this.send({ type: "chronicle", action: "edit", unitId: id, text: (this.root.querySelector(`textarea[data-unit="${id}"]`) as HTMLTextAreaElement)?.value }); break;
      case "unitLock": this.send({ type: "chronicle", action: "lock", unitId: id }); break;
      case "unitGhost": this.send({ type: "chronicle", action: "ghost", unitId: id }); break;
      case "unitRegen": this.send({ type: "chronicle", action: "regenerate", unitId: id }); break;
      case "unitUnhide": this.send({ type: "chronicle", action: "unhide", unitId: id }); break;
      case "loreScan": this.send({ type: "lore", action: "scan" }); break;
      case "playbookPlayed": this.send({ type: "codexEdit", id, patch: { status: (t.closest("button") as HTMLElement | null)?.dataset.played ? "active" : "resolved" } }); break;
      case "recheck": this.send({ type: "recheck" }); break;
      case "skinColorReset": if (id) this.saveSkinColors(this.withSkinColor(id, null)); break;
      case "skinColorsReset": this.saveSkinColors(this.withSkinColor(null, null)); break;
      case "saveTruths": this.send({ type: "config", patch: { truths: val("#almTruths").split("\n").map((s) => s.trim()).filter(Boolean) } }); break;
      case "loreClassify": this.send({ type: "lore", action: "classify" }); break;
      case "mirrorSync": this.send({ type: "mirrorSync" }); break;
      case "simulate": this.send({ type: "simulate" }); break;
      case "ewView": this.send({ type: "settings", patch: { elsewhereView: id === "surprise" ? "surprise" : "director" } }); if (this.view?.elsewhere) this.view.elsewhere.view = id; this.render(); break;
      case "ewMode": this.send({ type: "elsewhere", action: "mode", value: id || null }); break;
      case "ewArc": this.send({ type: "elsewhere", action: (t.closest("[data-what]") as HTMLElement | null)?.dataset.what, id }); break;
      case "ewRetell": {
        const d = (t.closest("[data-tick]") as HTMLElement | null)?.dataset;
        if (d) this.send({ type: "elsewhere", action: "retell", id, tick: d.tick, at: Number(d.at) });
        break;
      }
      case "ewPropose": this.send({ type: "elsewhere", action: (t.closest("[data-what]") as HTMLElement | null)?.dataset.what === "accept" ? "accept" : "decline", id }); break;
      case "ewFate": this.send({ type: "elsewhere", action: "fate", id, decision: (t.closest("[data-what]") as HTMLElement | null)?.dataset.what }); break;
      case "ewSave": this.send({ type: "elsewhere", action: "edit", id, premise: val("#almEwPremise"), want: val("#almEwWant"), fear: val("#almEwFear"), kind: val("#almEwKind"), secrecy: val("#almEwSecrecy") }); this.editing = null; break;
      case "ewAuthor": {
        const who = (this.root.querySelector("#almEwWho") as HTMLSelectElement | null)?.value ?? "";
        const text = val("#almEwText").trim();
        if (who && text) this.send({ type: "elsewhere", action: "author", name: who, premise: text });
        break;
      }
      case "ewPerson": {
        ev.preventDefault();
        const d = (t.closest("[data-what]") as HTMLElement | null)?.dataset;
        const what = d?.what;
        this.send({ type: "elsewhere", action: "person", name: d?.name, patch: what === "out" ? { out: true } : what === "in" ? { out: false } : { wake: true } });
        break;
      }
      case "scheduleWx": {
        const day = parseInt(val("#almWxDay"), 10);
        const hour = parseInt(val("#almWxHour"), 10);
        const hours = parseInt(val("#almWxLen"), 10) || 6;
        const condition = val("#almWxCond").trim();
        if (day > 0 && hour >= 0 && hour < 24 && condition) this.send({ type: "schedule", spec: { day, hour, hours, condition } });
        break;
      }
    }
  }

  onChange(ev: Event) {
    const t = ev.target as HTMLInputElement;
    if (this.creator.onChange(t)) return;
    const d = t.dataset;
    if (d.setting) {
      const cur = this.view?.settings?.[d.setting];
      const value = t.type === "checkbox" ? t.checked : typeof cur === "number" ? Number(t.value) : t.value;
      this.send({ type: "settings", patch: { [d.setting]: value } });
      if (this.view) this.view.settings[d.setting] = value;
      this.ctx.events.emit("almanac:settings", { [d.setting]: value });
      return;
    }
    if (d.listSetting) {
      const list = t.value.split(",").map((x) => x.trim()).filter(Boolean);
      this.send({ type: "settings", patch: { [d.listSetting]: list } });
      if (this.view) this.view.settings[d.listSetting] = list;
      return;
    }
    if (d.skinColor) {
      this.saveSkinColors(this.withSkinColor(d.skinColor, t.value));
      return;
    }
    if (d.set) {
      if (d.set === "asOf") {
        const max = Number(t.max);
        this.asOf = Number(t.value) >= max ? Infinity : Number(t.value);
      } else if (d.set === "npcOnly") this.npcOnly = t.checked;
      else (this as any)[d.set] = t.value;
      this.render();
      return;
    }
    if (d.color) {
      this.send({ type: "color", charId: d.color, color: t.value });
      return;
    }
    if (d.merge != null && t.value) {
      // Every name this character went by now resolves to the chosen one; the story refolds.
      const c = this.view?.cast.find((x: any) => x.name === d.merge);
      const merges = { ...(this.view?.config?.merges ?? {}) };
      for (const n of [d.merge, ...(c?.aliases ?? [])]) merges[String(n).toLowerCase()] = t.value;
      this.send({ type: "config", patch: { merges } });
      return;
    }
    if (d.loreMode) this.send({ type: "lore", action: "mode", bookId: d.loreMode, value: t.value });
  }
}

function toHex(c: string): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? c : "#888888";
}

/** What a colour token paints right now, as #rrggbb (Follow Lumiverse takes its colours from the host). */
function liveHex(token: string): string {
  try {
    const probe = document.createElement("span");
    probe.style.color = `var(--alm-${token})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    const g = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d")!;
    g.fillStyle = color;
    g.fillRect(0, 0, 1, 1);
    const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
    return `#${[r, gr, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return "";
  }
}
