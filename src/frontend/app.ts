// The "Almanac" drawer tab, with Orrery navigation (see orrery.ts): Now, and
// People (Cast · Bonds · Knowledge), Story (Chronicle · Timeline · World),
// Library (Codex · Lore · Creator) and Engine (Recall · Craft · Settings).

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { escapeHtml as e, estTokens, initials, kpNote } from "../core/util";
import { PRESET_VERSION, olderThan } from "../core/version";
import { renderGraph, type GEdge, type GNode } from "./graph";
import { CreatorUI } from "./creator-ui";
import { VERSION } from "../core/version";
import { SKIN_COLORS, SKIN_LIST, skinPalette } from "./skins";
import { NOT_A_PERSON } from "../core/state";
import { PAGES, dock, emptySky, engineKeys, groupOf, pageTitle, skyHeader, type Page } from "./orrery";
import { dots, ic, medal, n, ring, sec, stk, toggle, type Tone } from "./ui";

type Tab = Page;
const TABS = PAGES;
const RANK: Record<string, number> = { chapter: 1, arc: 2, volume: 3 };
// Chronicle levels, matching the coverage bar.
const LEVEL_COLOR: Record<string, string> = { volume: "#7b5bd6", arc: "var(--alm-accent-2)", chapter: "var(--alm-accent)" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Codex kinds as sticker tones, and bond axes as bar colours.
const KIND_COLOR: Record<string, Tone> = { person: "acc", place: "acc2", object: "warn", group: "good", law: "ghost", history: "", situation: "g", texture: "ghost", forecast: "acc2" };
const AXIS_COLOR: Record<string, string> = {
  trust: "var(--alm-good)", affection: "#ff8fa3", attraction: "#ff6fa8", respect: "var(--alm-accent-2)", familiarity: "var(--alm-muted)", comfort: "#6bb3a0",
  fear: "var(--alm-danger)", resentment: "var(--alm-danger)", obligation: "var(--alm-warn)", rivalry: "#e07b30",
};
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
  const keys = [...LORE_KINDS.map(([k]) => k), ...Object.keys(kinds).filter((k) => !known.has(k))].filter((k) => kinds[k]);
  return keys.length ? `<div class="almx-lbl">Read as</div><div class="row" style="margin-top:6px;gap:6px">${keys.map((k) => `<span class="pill"><b>${kinds[k]}</b> ${e(label(k))}</span>`).join("")}</div>` : "";
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
  /** Cast page: people away from the scene shown as full cards. Settings: sections left open. */
  castOpen = new Set<string>();
  openSecs = new Set<string>();
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
    this.root.innerHTML = `<div class="almo${this.orbit ? " orbiting" : ""}" style="--g:${groupOf(this.tab)?.color ?? "#ffc46b"}">${skyHeader(v, this.tab)}<main class="almo-body">${pageTitle(v, this.tab)}${note}${stale}${presetOld}${planErr}${problems}${banner}${body}</main>${dock(v, this.tab, this.orbit, this.seenSet())}</div>`;
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
    const tile = (icon: string, label: string, value: string, sub = "") => `<div class="almx-tile"><div class="almx-lbl">${ic(icon, "sm")}${label}</div><div class="almx-val">${e(value)}</div>${sub ? `<small>${e(sub)}</small>` : ""}</div>`;
    const place: string[] = n.place ?? [];
    const tiles = [
      place.length ? tile("pin", "Where", place[place.length - 1], place.slice(0, -1).slice(-2).join(" › ")) : "",
      n.day != null ? tile("cal", "Day", `Day ${n.day}`, n.season ?? "") : n.season ? tile("leaf", "Season", n.season) : "",
      n.sun ? tile("sun", "Sun", n.sun.text) : "",
      n.moon ? tile("moon", "Moon", n.moon.name, n.moon.illumination != null ? `${Math.round(Number(n.moon.illumination) * 100)}% lit` : "") : "",
      tile("film", "Scene", `Scene ${n.scene}`, n.mode ?? ""),
    ].filter(Boolean);
    const temps = fc.map((h: any) => Number(h.temp));
    const lo = Math.min(...temps), hi = Math.max(...temps);
    const tall = (t: number) => Math.round(18 + (hi > lo ? ((t - lo) / (hi - lo)) * 38 : 20));
    const forecast = fc.length
      ? `${sec("Next hours", null, "every 2 hours")}<div class="card"><div class="almx-fc" style="grid-template-columns:repeat(${fc.length},minmax(0,1fr))">${fc.map((h: any) => `<div><small class="muted">${e(h.t)}</small><span>${e(h.glyph)}</span><em><i style="height:${tall(Number(h.temp))}px"></i></em><b>${h.temp}°</b></div>`).join("")}</div>${n.forecast ? `<p class="muted" style="margin:12px 0 0;font-size:13.5px">${e(n.forecast)}</p>` : ""}</div>`
      : "";
    const owed = v.world.cons.filter((c: any) => c.status === "open" || c.status === "due").slice(-8);
    const owedHtml = owed.length
      ? `${sec("Owed and due", owed.length)}<div class="card almx-rows" style="padding:2px 16px">${owed.map((c: any) => `<div class="almx-row">${medal(c.whoName, this.colorOf(v, c.whoName), "sm")}<div class="grow"><b>${e(c.whoName)}${c.whomName ? ` → ${e(c.whomName)}` : ""}</b><div class="muted" style="font-size:13.5px">${e(c.what)}${c.dueText ? ` · by ${e(c.dueText)}` : ""}</div></div>${c.status === "due" ? stk("due", "bad") : stk("open", "ghost")}</div>`).join("")}</div>`
      : "";
    return `<div class="almx-g2">${tiles.join("")}</div>
${forecast}
${sec("In the room", present.length || null, "", `<a href="#" data-page="cast" style="color:inherit">whole cast</a>`)}
${present.length ? `<div class="almx-stack">${present.map((c: any) => this.castCard(c, true)).join("")}</div>` : `<div class="empty">No one else is here.</div>`}
${owedHtml}
${sec("The model hears next", null, v.note ? `≈ ${estTokens(v.note).toLocaleString()} tokens` : "")}
${v.note ? `<div class="card almx-hear"><pre>${e(v.note)}</pre></div>` : `<div class="empty">The note appears after the next generation starts.</div>`}
${v.recall ? `<details class="card tight"><summary class="muted">Recall block</summary><pre>${e(v.recall)}</pre></details>` : ""}
<div class="almx-g3" style="margin-top:16px"><button class="btn tile" data-act="sessionZero">${ic("dice")}Session Zero</button><button class="btn tile" data-act="repairLast">${ic("bandage")}Repair last ledger</button><button class="btn tile" data-act="rebuild">${ic("loop")}Rebuild from chat</button></div>
<div class="almx-stats"><span>${v.counts.messages} messages</span><span>${v.counts.ledgers} ledgers</span><span>${v.counts.chapters} chapters</span>${v.counts.unverified ? `<b style="color:var(--alm-warn)">${v.counts.unverified} unverified turns</b>` : ""}</div>`;
  }

  /** Someone's colour, found by name or alias. */
  colorOf(v: any, name: string): string {
    const low = String(name ?? "").toLowerCase();
    return v.cast.find((c: any) => c.name.toLowerCase() === low || c.aliases?.some((a: string) => a.toLowerCase() === low))?.color ?? "";
  }

  /** A person: compact (Now) or the full trading card (Cast), with `extra` at the end of the full card. */
  castCard(c: any, compact = false, extra = ""): string {
    const tier = c.dead ? "dead" : c.isUser ? "you" : c.tier === "spot" ? "spotlight" : c.tier === "peri" ? "nearby" : "away";
    const tierTone = c.isUser ? "g" : c.tier === "spot" ? "voice" : "ghost";
    const scale = (x: number, lo: number, hi: number) => 1 + Math.round(((x - lo) / (hi - lo)) * 4);
    const mood = c.mood ?? {};
    const meters = [
      mood.v != null ? ["Mood", scale(mood.v, -3, 3)] : null,
      mood.a != null ? ["Energy", scale(mood.a, 0, 5)] : null,
      mood.d != null ? ["Control", scale(mood.d, -3, 3)] : null,
      ...Object.entries(c.meters ?? {}).filter(([, x]) => x != null).map(([k, x]) => [cap(k), Number(x)]),
    ].filter(Boolean) as [string, number][];
    const meterHtml = meters.length ? `<div class="almx-g3" style="margin-top:12px">${meters.map(([k, x]) => `<div class="almx-meter">${e(k)}${dots(x)}</div>`).join("")}</div>` : "";
    const tags = [...(c.flags ?? []).slice(-4).map((f: string) => `<span class="alm-tag">${e(f)}</span>`), ...(c.injuries ?? []).map((i: any) => `<span class="alm-tag warn">${e(i.where)}</span>`), ...(c.held ?? []).slice(0, 3).map((h: string) => `<span class="alm-tag">holds: ${e(h)}</span>`)];
    const rows = [
      c.fixed ? `<b title="Sent to the model every turn while they're present. Edit them to change it">Always</b><span>${e(c.fixed)} ${ic("lock", "sm")}</span>` : "",
      c.activity ? `<b>Doing</b><span>${e(c.activity)}</span>` : "",
      !compact && c.age ? `<b>Age</b><span>${e(c.age)}${c.ageSet ? "" : ` <small class="muted" title="From the lore">from the lore</small>`}</span>` : "",
      !compact && c.appearance ? `<b>Looks</b><span>${e(c.appearance)}</span>` : "",
      !compact && c.look ? `<b>Wearing</b><span>${e(c.look)}</span>` : "",
      !compact && c.place ? `<b>Where</b><span>${e(c.place)}</span>` : "",
    ].filter(Boolean).join("");
    const kv = rows ? `<div class="kv" style="margin-top:12px">${rows}</div>` : "";
    const tagHtml = tags.length ? `<div class="alm-tags">${tags.join("")}</div>` : "";
    if (compact) {
      return `<article class="card almx-pcs" style="--c:${e(c.color)}"><div class="almx-row">${medal(c.name, c.color)}<div class="grow"><div class="almx-row" style="gap:8px;flex-wrap:wrap"><b class="almx-pc__nm">${e(c.name)}</b>${stk(tier, tierTone as any)}</div>${mood.name ? `<div class="almx-em">${e(mood.name)}</div>` : ""}</div></div>${kv}${meterHtml}${tagHtml}</article>`;
    }
    return `<article class="card almx-pc" style="--c:${e(c.color)}"><div class="almx-pc__band">${stk(tier)}${c.slot != null ? `<span class="almx-pc__slot">slot ${e(String(c.slot))}</span>` : ""}</div>
<div class="almx-pc__bd"><div class="almx-pc__who">${medal(c.name, c.color, "lg")}<div class="grow" style="min-width:0"><div class="almx-pc__nm">${e(c.isUser ? `${c.name}` : c.name)}</div>${c.aliases?.length ? `<small class="muted">also ${e(c.aliases.join(" · "))}</small>` : ""}</div></div>
${mood.name ? `<div class="almx-em" style="margin-top:10px">${e(mood.name)}</div>` : ""}${meterHtml}${tagHtml}${kv}${extra}</div></article>`;
  }

  tab_cast(v: any): string {
    const add = this.editingChar === "__new"
      ? this.charEditor(null)
      : `<div class="row" style="justify-content:flex-end;margin-bottom:12px"><button class="btn" data-act="charAdd" title="Add someone the story hasn't named yet, or who should be tracked from now on">${ic("plus", "sm")}Add a person</button></div>`;
    const here = v.cast.filter((c: any) => c.isUser || c.tier === "spot" || c.tier === "peri");
    const away = v.cast.filter((c: any) => !here.includes(c));
    const arcs = new Set<string>((v.elsewhere?.people ?? []).filter((p: any) => p.arc).map((p: any) => String(p.name).toLowerCase()));
    const full = (c: any, closable: boolean) => {
      if (this.editingChar === c.id) return `<div class="card almx-pcs"><div class="almx-row" style="margin-bottom:10px">${medal(c.name, c.color, "sm")}<b class="grow">${e(c.name)}</b></div>${this.charEditor(c)}</div>`;
      const journal = c.journal?.length ? `<div class="almx-quote" style="margin-top:14px"><div class="almx-lbl">In their own words</div>${c.journal.slice(-2).map((j: any) => `<p>“${e(j.text)}”</p>`).join("")}</div>` : "";
      const pressure = c.isUser ? "" : `<div style="margin-top:14px"><div class="almx-lbl">Hidden pressure · narrator only</div><div class="row" style="margin-top:6px;flex-wrap:nowrap"><span class="spoiler grow almx-inset" tabindex="0">${e(c.pressure || "none drawn yet")}</span><button class="btn sm" data-act="editPressure" data-id="${e(c.id)}">Edit</button></div></div>`;
      const actions = `<div class="row" style="margin-top:14px"><button class="btn sm" data-act="charEdit" data-id="${e(c.id)}" title="${c.isUser ? "Age and appearance" : "Name, age and appearance"}">${ic("pencil", "sm")}Edit</button><label class="btn sm" title="${c.isUser ? "Your persona's colour" : "Voice colour"}"><input type="color" class="swatch" data-color="${e(c.id)}" value="${e(toHex(c.color))}" aria-label="${e(c.isUser ? "Your persona's colour" : `${c.name}'s colour`)}" style="width:18px;height:18px">Colour</label><span class="grow"></span>${closable ? `<button class="btn sm ghost" data-act="castOpen" data-id="${e(c.id)}">Close</button>` : ""}${c.isUser ? "" : `<button class="btn sm danger" data-act="notPerson" data-name="${e(c.name)}" title="For a force, spell, place or thing the story mistook for a character. Lines about it stop creating a character; you can restore it below.">Not a person — remove</button>`}</div>`;
      return this.castCard(c, false, `${journal}${pressure}${this.mergeRow(v, c)}${actions}`);
    };
    const open = away.filter((c: any) => this.castOpen.has(c.id) || this.editingChar === c.id);
    const rows = away.filter((c: any) => !open.includes(c)).map((c: any) => `<button type="button" class="almx-away" data-act="castOpen" data-id="${e(c.id)}">${medal(c.name, c.color, "sm", !!c.dead)}<span class="grow"><b>${e(c.name)}</b><small>${e([c.dead ? "dead" : c.place, c.mood?.name].filter(Boolean).join(" · ") || "away")}</small></span>${arcs.has(c.name.toLowerCase()) ? stk("subplot", "acc2") : ""}${ic("right", "sm")}</button>`).join("");
    return `${add}${here.length ? `<div class="almx-stack">${here.map((c: any) => full(c, false)).join("")}</div>` : ""}
${away.length ? `${sec("Away", away.length, "tap to open")}${open.map((c: any) => full(c, true)).join("")}${rows ? `<div class="card" style="padding:2px 14px">${rows}</div>` : ""}` : ""}
${v.cast.length ? "" : `<div class="empty">No one has appeared yet.</div>`}${this.removedRow(v)}`;
  }

  /** Name, age and appearance (a new person when `c` is null). The persona's name comes from Lumiverse. */
  charEditor(c: any | null): string {
    const id = c?.id ?? "__new";
    const name = c?.isUser ? `<p class="muted"><small>Your persona's name comes from Lumiverse.</small></p>` : `<label class="f">Name<input type="text" id="almCharName" value="${e(c?.name ?? "")}" placeholder="${c ? "" : "Walter Hale"}"></label>${c ? `<p class="muted"><small>The old name keeps working in the story's lines.</small></p>` : ""}`;
    return `<div class="card hl almk--edit">${name}
<label class="f">Age<input type="text" id="almCharAge" value="${e(c?.ageSet ? c.age : "")}" placeholder="${e(c?.age && !c.ageSet ? `${c.age} (from the lore)` : "e.g. 24, early fifties, ageless")}"></label>
<label class="f">Also called<input type="text" id="almCharAliases" value="${e((c?.aliases ?? []).join("; "))}" placeholder="Other names they go by, separated by ;"></label>
<label class="f">Always<textarea id="almCharAlways" placeholder="Eyes, hair, build, what people notice first">${e(c?.fixed ?? "")}</textarea></label>
<p class="muted"><small>Always is sent with them every turn while they're present, and holds whatever the story writes. Change or delete anything in it; empty it to go back to what the card, the lore and the story say.</small></p>
<div class="row" style="margin-top:10px"><button class="btn primary" data-act="charSave" data-id="${e(id)}">${c ? "Save" : "Add"}</button><button class="btn" data-act="charCancel">Cancel</button></div></div>`;
  }

  /** Names taken out of the cast, with a way back. */
  removedRow(v: any): string {
    const gone = Object.entries(v.config?.merges ?? {}).filter(([, to]) => to === NOT_A_PERSON).map(([n]) => n);
    if (!gone.length) return "";
    return `${sec("Not people", gone.length, "the story mistook these")}<p class="muted" style="margin:0 0 8px"><small>Their lines as people are ignored, and the model is told to leave them out.</small></p><div class="row">${gone.map((n) => `<span class="pill">${e(n)} <button class="btn sm ghost" data-act="restorePerson" data-name="${e(n)}" title="Put it back in the cast" style="min-height:24px;padding:0 6px">restore</button></span>`).join("")}</div>`;
  }

  /** "Same person as…" for duplicates the model invented, and the names already merged into this one. */
  mergeRow(v: any, c: any): string {
    const merges: Record<string, string> = v.config?.merges ?? {};
    const mine = Object.entries(merges).filter(([, to]) => (c.isUser ? to === "user" : to.toLowerCase() === c.name.toLowerCase())).map(([from]) => from);
    const chips = mine.map((n) => `<span class="pill">${e(n)} <button class="btn sm ghost" data-act="unmerge" data-name="${e(n)}" title="Split this name off again" style="min-height:24px;padding:0 6px">✕</button></span>`).join("");
    const pick = c.isUser ? "" : `<label class="f">Same person as…<select data-merge="${e(c.name)}"><option value="">No, a different person</option><option value="user">${e(v.names?.user || "You")} (you)</option>${v.cast.filter((o: any) => !o.isUser && o.id !== c.id).map((o: any) => `<option value="${e(o.name)}">${e(o.name)}</option>`).join("")}</select></label>`;
    return pick || chips ? `<div class="almx-merge">${chips ? `<div class="row" style="margin-bottom:8px"><small class="muted">Also written as:</small>${chips}</div>` : ""}${pick}</div>` : "";
  }

  tab_bonds(v: any): string {
    const nodes: GNode[] = v.cast.filter((c: any) => !c.dead || v.bonds.some((b: any) => b.from === c.id || b.to === c.id)).map((c: any) => ({ id: c.id, name: c.isUser ? (v.names.user || "You") : c.name, color: c.color, spot: c.tier === "spot", user: c.isUser }));
    const lastIdx = Math.max(0, ...v.bonds.map((b: any) => b.lastMsg));
    const edges: GEdge[] = v.bonds.map((b: any) => ({ from: b.from, to: b.to, axes: b.axes, label: b.label, changedAt: b.lastMsg, changedNow: b.lastMsg === lastIdx, history: b.history }));
    const maxIdx = Math.max(1, ...v.bonds.flatMap((b: any) => b.history.map((h: any) => h.msgIndex)));
    const axes = ["", "trust", "affection", "respect", "attraction", "fear", "resentment", "rivalry", "obligation"];
    const people = new Map<string, any>(v.cast.map((c: any) => [c.id, c]));
    const fresh = v.bonds.filter((b: any) => b.lastMsg === lastIdx && v.bonds.length > 1).length;
    const row = (k: string, x: number) => {
      const w = Math.min(50, (Math.abs(x) / 5) * 50);
      const col = AXIS_COLOR[k] ?? "var(--alm-accent)";
      return `<div class="almx-dvrow"><span>${e(cap(k))}</span><div class="almx-dv"><i style="${x < 0 ? `right:50%;border-radius:999px 0 0 999px` : `left:50%;border-radius:0 999px 999px 0`};width:${w}%;background:${x < 0 ? "var(--alm-danger)" : col}"></i></div><b>${x > 0 ? "+" : ""}${x}</b></div>`;
    };
    const card = (b: any) => `<article class="card almx-bond"><div class="almx-row"><span class="almx-pair">${medal(b.fromName, people.get(b.from)?.color, "sm")}${medal(b.toName, people.get(b.to)?.color, "sm")}</span><div class="grow"><b class="almx-bond__nm">${e(b.fromName)} → ${e(b.toName)}</b>${b.label || b.ladder ? `<div class="row" style="gap:6px;margin-top:6px">${b.label ? stk(b.label, "g") : ""}${b.ladder ? `<span class="pill" title="Romance tier">♡ ${b.ladder.tier}</span>` : ""}</div>` : ""}</div></div>
<div class="almx-dvs">${Object.entries(b.axes).map(([k, x]: any) => row(k, x)).join("")}</div>
${b.history.some((h: any) => h.delta) ? `<div class="almx-inset" style="margin-top:12px">${b.history.filter((h: any) => h.delta).slice(-2).reverse().map((h: any) => `<div><b style="color:${h.delta < 0 ? "var(--alm-danger)" : "var(--alm-good)"}">${h.delta > 0 ? "+" : ""}${h.delta} ${e(h.axis)}</b>${h.cause ? ` ${e(h.cause)}` : ""} <small class="muted">· message ${h.msgIndex + 1}</small></div>`).join("")}</div>` : ""}</article>`;
    return `<div class="almx-chips" role="group" aria-label="Colour the lines by">${axes.map((a) => `<button type="button" data-act="graphAxis" data-id="${a}" aria-pressed="${a === this.graphAxis}">${a ? cap(a) : "Strongest"}</button>`).join("")}</div>
<label class="chk"><input type="checkbox" data-set="npcOnly"${this.npcOnly ? " checked" : ""}> Only bonds between other people</label>
<div style="margin:6px 0 12px;position:relative">${renderGraph(nodes, edges, { asOf: this.asOf, filterAxis: this.graphAxis || undefined, npcOnly: this.npcOnly })}${fresh ? `<span class="almx-stk g" style="position:absolute;right:10px;top:10px">${fresh} changed last</span>` : ""}</div>
<div class="card tight"><div class="almx-row">${ic("clock")}<b class="grow">Rewind the web</b>${stk(this.asOf === Infinity ? "now" : `message ${this.asOf + 1}`, "g")}</div><input type="range" min="0" max="${maxIdx}" value="${this.asOf === Infinity ? maxIdx : this.asOf}" data-set="asOf" aria-label="Show the bonds as of a message" style="margin-top:8px"><div class="row" style="justify-content:space-between"><small class="muted">message 1</small><small class="muted">message ${maxIdx + 1}</small></div></div>
${sec("Every bond", v.bonds.length)}<div class="almx-stack">${v.bonds.map(card).join("") || `<div class="empty">No bonds yet.</div>`}</div>`;
  }

  tab_knowledge(v: any): string {
    const hidden = v.hiddenFacts ?? [];
    const clerk = this.clerkBar(v);
    const adding = this.editingFact === "__new" ? this.factEditor(v, null) : `<button class="btn wide" data-act="factAdd" style="margin:4px 0 12px" title="Add a fact the story hasn't recorded, and say who knows it">${ic("plus", "sm")}Add a fact</button>`;
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
      const label = s.status === "wrong" ? "has it wrong" : s.verb;
      const worked = s.derived === "witness" ? "was there when it came out" : s.derived === "source" ? "their own words or deed" : s.derived === "secret" ? "keeps it" : "";
      return `<div class="almk-h">${mini(s.id, s.name)}<div class="almk-h__b"><b>${e(s.name)}</b><span class="alm-kp ${cls}"${worked ? ` title="Worked out by the Almanac: ${e(worked)}"` : ""}>${icon} ${e(label)}</span>${s.version ? `<small class="almk-ver">thinks “${e(s.version)}”</small>` : ""}${s.how && !s.derived && !s.verb.includes(s.how) ? kpNote(s.how) : ""}</div></div>`;
    };
    const lackChip = (l: any) => `<div class="almk-h">${mini(l.id, l.name)}<div class="almk-h__b"><b>${e(l.name)}</b><span class="alm-kp un">— ${e(l.text)}</span></div></div>`;
    const KIND_TONE: Record<string, Tone> = { secret: "bad", belief: "warn", shared: "acc2", noted: "ghost" };
    const cards = shown.map((f: any) => {
      if (this.editingFact === f.key) return this.factEditor(v, f);
      const truth = f.truth !== "unknown" ? stk(f.truth === "true" ? "true" : f.truth === "false" ? "false" : "partly true", f.truth === "true" ? "good" : f.truth === "false" ? "bad" : "warn", "Whether the fact is true") : "";
      const off = f.offPage ? stk(f.offPage.live ? "off the page" : "out now", f.offPage.live ? "acc" : "ghost", f.offPage.live ? `Kept off the page${f.offPage.words.length ? `: never "${f.offPage.words.join('", "')}"` : ""}${f.offPage.wording ? `; alluded to as "${f.offPage.wording}"` : ""}` : "It has come out; no longer kept off the page") : "";
      const hist = f.history.map((h: any) => `<li><time>${e(h.when)}</time> <b>${e(h.name)}</b> ${e(h.verb)}${h.version ? `: “${e(h.version)}”` : ""}${h.how && !h.derived && !h.verb.toLowerCase().includes(h.how.toLowerCase()) ? ` <span class="muted">— ${e(h.how)}</span>` : ""}${h.note ? `<small class="almk-note">${e(h.note)}</small>` : ""}</li>`).join("");
      const kept = f.keepers.length || (f.offPage?.live && (f.offPage.words.length || f.offPage.wording))
        ? `<div class="almk-un">${f.keepers.length ? `<div>${ic("lock", "sm")} <b>Kept by ${e(f.keepers.map((k: any) => k.name).join(", "))}</b>${f.keptFrom.length ? ` <span class="muted">from ${e(f.keptFrom.map((k: any) => k.name).join(", "))}</span>` : ""}</div>` : ""}${f.offPage?.live && (f.offPage.words.length || f.offPage.wording) ? `<div class="muted" style="margin-top:4px">${f.offPage.words.length ? `Never say ${f.offPage.words.map((w: string) => `<span class="pill">${e(w)}</span>`).join(" ")}` : ""}${f.offPage.wording ? ` · hint at it as <i>“${e(f.offPage.wording)}”</i>` : ""}</div>` : ""}</div>`
        : "";
      return `<div class="card almk almk--${e(f.kind)}"><div class="almk-top"><span class="almk-key" title="The model refers to this fact as #${e(f.key)}">#${e(f.key)}</span>${stk(f.kind, KIND_TONE[f.kind] ?? "", KIND_HELP[f.kind] ?? "")}${truth}${f.locked ? stk("yours", "g", "You set this statement") : ""}${off}<span class="grow"></span><button class="btn sm ghost" data-act="factEdit" data-id="${e(f.key)}" title="Rename, set the truth, set who knows it, or merge" aria-label="Edit this fact">${ic("pencil", "sm")}</button><button class="btn sm danger" data-act="factDelete" data-id="${e(f.key)}" title="Delete this fact from the page and the model's note (you can restore it below)">delete</button></div>
<b class="almk-stmt">${e(f.statement)}</b>
<div class="almk-st">${f.stances.map(chip).join("") || `<div class="muted">No one has it yet.</div>`}${f.lacks.map(lackChip).join("")}</div>
${kept}
<details class="almk-hist"${this.openFacts.has(f.key) ? " open" : ""} data-fact="${e(f.key)}"><summary>How it came out · ${f.history.length}</summary><ol>${hist}</ol></details></div>`;
    }).join("");
    // Dramatic irony: someone certain of the wrong version.
    const irony = v.knowledge.flatMap((f: any) => f.stances.filter((s: any) => s.status === "wrong" || (s.status !== "unaware" && f.truth === "false")).map((s: any) => ({ f, s }))).slice(0, 3);
    const ironyHtml = irony.map(({ f, s }: any) => `<div class="almx-callout warn">${ic("masks")}<div><div class="almx-lbl">Dramatic irony</div><b>${e(s.name)}</b> ${s.version ? `thinks “${e(s.version)}”, but ${e(String(f.statement).replace(/[.!?]+$/, ""))}` : `is certain that “${e(String(f.statement).replace(/[.!?]+$/, ""))}”, which isn't true`}.</div></div>`).join("");
    const filters = toggle("factKind", this.factKind, [["play", `In play <b>${counts.play}</b>`], ["shared", `Shared <b>${counts.shared}</b>`], ["noted", `Noted <b>${counts.noted}</b>`], ["all", `All <b>${counts.all}</b>`]], "Which facts");
    const search = `<div class="row" style="margin:10px 0 12px;flex-wrap:nowrap"><span class="almx-search">${ic("search", "sm")}<input type="text" data-set="factQuery" value="${e(this.factQuery)}" placeholder="Find a fact or a person…" aria-label="Find a fact or a person"></span><select data-set="factPerson" aria-label="Show one person" style="width:auto;max-width:42%"><option value="">Everyone</option>${(v.knowers ?? []).map((p: any) => `<option value="${e(p.id)}"${p.id === who ? " selected" : ""}>${e(p.name)}${p.here ? " · here" : ""}</option>`).join("")}</select></div><p class="muted" style="margin:-4px 0 10px"><small>${shown.length} of ${v.knowledge.length} facts</small></p>`;
    const person = who ? this.personKnowledge(v, who) : "";
    const hiddenHtml = hidden.length ? `${sec("Deleted", hidden.length, "gone from the page and the note")}<div class="row">${hidden.map((h: any) => `<span class="pill">${e(h.statement)} <button class="btn sm ghost" data-act="factRestore" data-id="${e(h.key)}" style="min-height:24px;padding:0 6px">restore</button></span>`).join("")}</div>` : "";
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
    return `<div class="card almk-person"><div class="almx-row" style="margin-bottom:6px">${medal(p.name, this.colorOf(v, p.name), "sm")}<b class="grow" style="font:700 17px/1.2 var(--almo-font)">${e(p.name)}</b></div>
<details open><summary>Has · ${has.length}</summary><ul>${has.slice(0, 40).join("") || "<li class=\"muted\">Nothing recorded.</li>"}</ul></details>
<details${lacks.length ? " open" : ""}><summary>Lacks · ${lacks.length}</summary><ul>${lacks.join("") || "<li class=\"muted\">Nothing recorded as kept from them or missed.</li>"}</ul></details>
<details${gaps.length ? " open" : ""}><summary>Doesn't know, in the story's words · ${gaps.length}</summary><ul>${gaps.map((g: any) => `<li${g.stale ? ' class="muted" title="Not restated in the last 40 messages"' : ""}>${e(g.text)}</li>`).join("") || "<li class=\"muted\">No gaps recorded.</li>"}</ul></details></div>`;
  }

  /** The knowledge clerk: what it does, how much of the chat it has read, and one button to tidy the rest. */
  clerkBar(v: any): string {
    const c = v.clerk ?? {};
    const mode = c.mode === "off" ? "Off for new replies." : c.mode === "always" ? "Reads every new reply." : "Reads new replies whose lines need it.";
    const unread = Number(c.unread ?? 0);
    const total = Number(c.replies ?? 0);
    const read = Math.max(0, total - unread);
    const button = c.running
      ? `${stk(`reading…${this.clerkProgress ? ` ${this.clerkProgress}` : ""}`, "g")}<button class="btn sm" data-act="clerkStop" title="Stop after the reply it's reading; tidying again carries on from there">Stop</button>`
      : unread
        ? `<button class="btn sm primary" data-act="clerkTidy" title="Read every reply the clerk hasn't read yet, oldest first, and rewrite its knowledge lines cleanly: one quiet generation each. You can stop and carry on later.">Tidy the rest · ${unread}</button>`
        : total ? stk("all read", "good") : "";
    return `<div class="card tight almk-clerk"><div class="almx-row"><b class="grow">Knowledge clerk</b>${total ? `<small class="muted">${read} of ${total} replies read</small>` : ""}</div>${total ? `<div class="bar"><i style="width:${Math.round((read / Math.max(1, total)) * 100)}%;background:var(--g)"></i></div>` : ""}<div class="almx-row"><small class="muted grow">${e(mode)}</small>${button}</div></div>`;
  }

  /** Rename a fact, say whether it's true, set who knows it, fold it into another, or delete it. */
  factEditor(v: any, fact: any | null): string {
    const f = fact ?? { key: "__new", statement: "", stances: [], lacks: [] };
    const others = fact ? v.knowledge.filter((o: any) => o.key !== f.key) : [];
    const truthOpts = [["", fact ? "as the story says" : "not said"], ["true", "true"], ["false", "false"], ["partial", "partly true"], ["unknown", "unknown"]];
    const cur = fact ? v.config?.factEdits?.[f.key] ?? {} : {};
    return `<div class="card hl almk almk--edit"><label class="f">The fact, in a few words<input type="text" id="almFactStmt" value="${e(f.statement)}" placeholder="${fact ? "" : "Walter is Gabriel's Watcher"}"></label>
<label class="f">Is it true?<select id="almFactTruth">${truthOpts.map(([k, l]) => `<option value="${k}"${(cur.truth ?? "") === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
<fieldset class="almk-off almx-note"><legend class="almx-lbl">Off the page</legend><label class="chk"><input type="checkbox" id="almFactOffOn"${(fact?.offPage && cur.offPage !== null) || cur.offPage ? " checked" : ""}> Keep it out of the narration, thoughts and summaries until it comes out</label>
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
<div class="row" style="margin-top:10px"><button class="btn primary" data-act="factSave" data-id="${e(f.key)}">${fact ? "Save" : "Add"}</button><button class="btn" data-act="factCancel">Cancel</button><span class="grow"></span>${fact ? `<button class="btn danger" data-act="factHide" data-id="${e(f.key)}" title="Delete it from this page and from the model's note">Delete</button>` : ""}</div></div>`;
  }

  tab_codex(v: any): string {
    const kinds = [...new Set(v.codex.map((r: any) => r.kind))] as string[];
    const q = this.codexFilter.toLowerCase();
    const recs = v.codex.filter((r: any) => (!this.codexKind || r.kind === this.codexKind) && (!q || `${r.name} ${r.summary} ${r.keys.join(" ")}`.toLowerCase().includes(q)));
    const count = (k: string) => v.codex.filter((r: any) => r.kind === k).length;
    const rec = (r: any) => this.editing === r.id ? this.codexEditor(r) : `<article class="card almx-rec"><div class="almx-row" style="flex-wrap:wrap;gap:6px">${stk(r.kind, KIND_COLOR[r.kind] ?? "")}${r.narratorOnly ? stk("narrator only", "ghost") : ""}${r.locked ? `<span class="muted" title="Locked: the archivist won't overwrite it">${ic("lock", "sm")}</span>` : ""}<span class="grow"></span><span class="pill">${e(r.source)}</span><button class="btn sm ghost" data-act="edit" data-id="${e(r.id)}" aria-label="Edit ${e(r.name)}">${ic("pencil", "sm")}</button></div>
<b class="almx-nm">${e(r.name)}</b><div style="font-size:14px">${e(r.summary)}</div>${r.keys.length ? `<div class="row" style="margin-top:10px;gap:6px">${r.keys.map((k: string) => `<span class="pill k">${e(k)}</span>`).join("")}</div>` : ""}${r.body?.divergedNote ? `<div class="almx-callout warn" style="margin:10px 0 0">${ic("arrow")}<div>The story moved past it: ${e(r.body.divergedNote)}</div></div>` : ""}</article>`;
    return `<div class="row" style="flex-wrap:nowrap"><span class="almx-search">${ic("search", "sm")}<input type="text" placeholder="Search names, summaries, keys…" data-set="codexFilter" value="${e(this.codexFilter)}" aria-label="Search the Codex"></span></div>
<div class="almx-chips" style="margin:10px 0" role="group" aria-label="Kind">${[["", `All ${v.codex.length}`], ...kinds.map((k) => [k, `${cap(k)} ${count(k)}`])].map(([k, lab]) => `<button type="button" data-act="codexKind" data-id="${e(k)}" aria-pressed="${k === this.codexKind}">${e(lab)}</button>`).join("")}</div>
<p class="muted" style="margin:0 0 12px"><small>${recs.length} of ${v.codex.length} records. Your edits lock a record so the archivist leaves it alone. Keys are real retrieval keys.</small></p>
<div class="almx-stack">${recs.slice(0, 200).map(rec).join("") || `<div class="empty">Nothing matches.</div>`}</div>
<details class="card" style="margin-top:14px"><summary><b>Add a record, or fix the state</b></summary><div style="margin-top:12px"><label class="f">New record name<input type="text" id="almNewName"></label><label class="f">Kind<select id="almNewKind">${["person", "place", "object", "group", "law", "texture", "history", "situation"].map((k) => `<option>${k}</option>`).join("")}</select></label><label class="f">Summary<textarea id="almNewSummary"></textarea></label><button class="btn primary" data-act="newRecord">Add record</button>
<h4>Fix it with ledger lines</h4><textarea id="almOps" placeholder="bond Mara>Kael: trust -1 — she caught him lying&#10;item Locket: Mara → Kael — stolen back"></textarea><div class="row" style="margin-top:8px"><button class="btn" data-act="userOps">Record the fix</button></div><p class="muted"><small>A fix applies from the latest reply on, and holds if you regenerate or swipe it.</small></p>
${v.corrections?.length ? `<h4>Your fixes</h4><div class="list">${v.corrections.slice(0, 40).map((c: any) => `<div class="rec"><div class="hd"><small class="muted grow">from message ${c.index + 1}${c.at ? ` · ${e(new Date(c.at).toLocaleString())}` : ""}</small><button class="btn sm" data-act="userOpsRemove" data-key="${e(c.key)}" data-id="${e(c.id)}">remove</button></div>${c.lines.map((l: string) => `<code class="almx-code">${e(l)}</code>`).join("<br>")}</div>`).join("")}</div>` : ""}</div></details>`;
  }

  codexEditor(r: any): string {
    return `<div class="card hl almx-rec"><div class="almx-row">${stk(r.kind, KIND_COLOR[r.kind] ?? "")}${stk("editing", "g")}</div><b class="almx-nm">${e(r.name)}</b>
<label class="f">Summary<textarea id="almEdSummary">${e(r.summary)}</textarea></label>
<label class="f">Keys (comma-separated)<input type="text" id="almEdKeys" value="${e(r.keys.join(", "))}"></label>
${r.kind === "person" ? `<label class="f">Routine (e.g. 06:00–09:00 docks (unloading); 09:00–18:00 harbour office)<input type="text" id="almEdRoutine" value="${e(r.body?.routine ?? "")}"></label>` : ""}
${r.kind === "place" ? `<label class="f">Hours (e.g. open 20:00 to 02:00)<input type="text" id="almEdHours" value="${e(r.body?.hours ?? "")}"></label>` : ""}
<label class="chk"><input type="checkbox" id="almEdNarr"${r.narratorOnly ? " checked" : ""}> Narrator only: characters can't know it</label>
<div class="row" style="margin-top:6px"><button class="btn primary" data-act="saveRecord" data-id="${e(r.id)}">${ic("lock", "sm")}Save and lock</button><button class="btn" data-act="unlock" data-id="${e(r.id)}">Unlock</button><button class="btn" data-act="cancelEdit">Cancel</button>${r.source !== "story" ? `<button class="btn danger" data-act="deleteRecord" data-id="${e(r.id)}">Delete</button>` : ""}</div></div>`;
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
        : u.inPrompt ? stk("in prompt", "good", relevant ? "The last prompt carried this summary" : "This summary is in every prompt")
        : relevant && u.folded ? `<span class="pill" title="Only when relevant: the prompt reads the chapters, not the ${e(u.level)}">chapters used instead</span>`
        : relevant ? `<span class="pill" title="Goes in the prompt when a turn touches it">when relevant</span>`
        : `<span class="pill" title="The prompt uses ${e(parent ? label(parent) : "a coarser summary")} for these turns instead (a turn that touches this chapter can still bring it back through recall)">folded${parent ? ` into ${e(label(parent))}` : ""}</span>`;
      const nested = this.chronFilter === "all" && kids.length
        ? `<button class="chron-kids-t" data-act="chronToggle" data-id="${e(u.id)}" aria-expanded="${open}">${ic(open ? "down" : "right", "sm")} ${plural(kids.length, kids[0].level)} folded in</button>${open ? `<div class="chron-kids">${kids.map((k: any) => block(k, depth + 1)).join("")}</div>` : ""}`
        : "";
      return `<div class="rec chron chron--${u.level}${u.folded || u.stale || u.ghost ? " chron--folded" : ""}" style="--lv:${LEVEL_COLOR[u.level]}"><div class="hd"><span class="kind">${e(label(u))}</span><b class="grow">${e(u.title)}</b>${u.locked ? `<span title="Locked">${ic("lock", "sm")}</span>` : ""}</div>
<div class="chron-body"><div class="muted"><small>messages ${u.startIdx + 1}–${u.endIdx + 1}${u.storyStart ? ` · ${e(u.storyStart)}${u.storyEnd && u.storyEnd !== u.storyStart ? ` – ${e(u.storyEnd)}` : ""}` : ""}</small></div>
<div class="chron-tags">${status}<span class="pill tok" title="Estimated tokens in this summary">${t(u.tokens)} tokens</span>${u.detail ? `<span class="pill">${e(u.detail)}</span>` : ""}</div>
<details><summary class="muted">Read or edit</summary><textarea data-unit="${e(u.id)}" style="min-height:140px;margin-top:8px">${e(u.text)}</textarea><div class="row" style="margin-top:8px"><button class="btn sm" data-act="unitSave" data-id="${e(u.id)}">Save</button><button class="btn sm" data-act="unitLock" data-id="${e(u.id)}">${u.locked ? "Unlock" : "Lock"}</button><button class="btn sm" data-act="unitGhost" data-id="${e(u.id)}">${u.ghost ? "Unghost" : "Ghost"}</button><button class="btn sm" data-act="unitRegen" data-id="${e(u.id)}">Redo</button><button class="btn sm danger" data-act="unitUnhide" data-id="${e(u.id)}">Unhide span</button></div></details>${nested}</div></div>`;
    };
    const f = this.chronFilter;
    // All: the hierarchy, with each unit's children folded inside it. One level: a flat list of that level.
    const shown = f === "all" ? all.filter((u: any) => !u.parent || !byId.has(u.parent)).sort(newest) : all.filter((u: any) => u.level === f).sort(newest);
    const prompt = (tok.chapter ?? 0) + (tok.arc ?? 0) + (tok.volume ?? 0);
    const saved = (tok.replaced ?? 0) - prompt;
    const legend = (lv: string, lab: string, n: number) => `<div class="chron-lg"><i style="background:${lv === "raw" ? "var(--alm-line)" : LEVEL_COLOR[lv]}"></i><span>${lv === "raw" ? lab : `${n} ${lab}`}</span><span class="muted">${cov[lv] ?? 0}%</span></div>`;
    const headline = saved > 0
      ? `<div class="almx-lbl">Saved in the ${v.chronicle.mode === "relevant" ? "last " : ""}prompt</div><div class="almx-big" style="color:var(--alm-good)">−${Math.round(saved).toLocaleString()}</div><small class="muted">tokens of old turns, told in ${t(prompt)}</small>`
      : `<div class="almx-lbl">Summaries in the prompt</div><div class="almx-big">${t(prompt)}</div><small class="muted">tokens, beside ${t(tok.raw)} of raw turns</small>`;
    return `<div class="card"><div class="almx-row" style="align-items:flex-end"><div class="grow">${headline}</div>${ic("sparkle", "lg")}</div>
<div class="bar thick" style="margin-top:14px"><i style="width:${cov.volume}%;background:${LEVEL_COLOR.volume}"></i><i style="width:${cov.arc}%;background:${LEVEL_COLOR.arc}"></i><i style="width:${cov.chapter}%;background:${LEVEL_COLOR.chapter}"></i><i style="width:${cov.raw}%;background:var(--alm-line)"></i></div>
<div class="chron-legend">${legend("volume", (cnt.volume ?? 0) === 1 ? "volume" : "volumes", cnt.volume ?? 0)}${legend("arc", (cnt.arc ?? 0) === 1 ? "arc" : "arcs", cnt.arc ?? 0)}${legend("chapter", (cnt.chapter ?? 0) === 1 ? "chapter" : "chapters", cnt.chapter ?? 0)}${legend("raw", "Raw turns", 0)}</div>
<p class="muted" style="margin:12px 0 0;font-size:13.5px">The last <b style="color:var(--alm-ink)">${v.settings.rawTail} messages</b> stay word for word (fewer past ~${Number(v.settings.rawTailTokens ?? 12000).toLocaleString()} tokens). Older scenes fold into chapters, chapters into arcs, arcs into volumes.</p>
<div class="row" style="margin-top:10px;gap:6px"><span class="pill">Detail: ${e(v.settings.summaryDetail ?? "detailed")}</span><span class="pill">In the prompt: ${v.chronicle.mode === "relevant" ? "only when relevant" : v.chronicle.mode === "off" ? "off" : "the whole story"}</span></div>
<div class="row" style="margin-top:12px"><button class="btn grow" data-act="chronicleRewrite" title="Redo every unlocked chapter, arc and volume at the current detail">Rewrite all</button><button class="btn primary grow" data-act="chronicleRun">Summarise now</button></div></div>
${toggle("chronFilter", f, [["all", "All"], ["volume", `Volumes <b>${cnt.volume ?? 0}</b>`], ["arc", `Arcs <b>${cnt.arc ?? 0}</b>`], ["chapter", `Chapters <b>${cnt.chapter ?? 0}</b>`]], "Show")}
<div class="list" style="margin-top:12px">${shown.map((u: any) => block(u, 0)).join("") || `<div class="empty">${all.length ? `No ${f}s yet.` : "No chapters yet. They appear once enough scenes have scrolled past the raw tail."}</div>`}
${shown.length ? `<div class="card almx-soft tight"><div class="almx-row">${stk("raw", "ghost")}<b class="grow">The newest turns</b><small class="muted">${cov.raw ?? 0}% · ${t(tok.raw)} tokens</small></div><small class="muted">Word for word. The next chapter folds once a scene ends past the raw tail.</small></div>` : ""}</div>`;
  }

  tab_timeline(v: any): string {
    const ev = [...v.timeline].reverse();
    const forecasts = v.codex.filter((r: any) => r.kind === "forecast");
    const kindOf = (k: string): [string, string] => {
      const s = String(k ?? "").toLowerCase();
      if (/bond|romance|love|kiss|ally/.test(s)) return ["heart", "#ff8fa3"];
      if (/reveal|secret|discover|learn|clue|know/.test(s)) return ["key", "#ffc46b"];
      if (/death|die|kill|loss/.test(s)) return ["x", "var(--alm-danger)"];
      if (/world|faction|war|politic|threat/.test(s)) return ["flag", "#ff7a7a"];
      if (/return|arriv|begin|start/.test(s)) return ["up", "#86e3a6"];
      return ["sparkle", "#a99bff"];
    };
    let lastDay: any = undefined;
    let first = true;
    const items = ev.map((m: any) => {
      const [icon, col] = kindOf(m.kind);
      const head = m.day != null && m.day !== lastDay ? `<div class="almx-tl__day">${stk(`Day ${m.day}`, first ? "g" : "")}</div>` : "";
      if (m.day != null) lastDay = m.day;
      first = false;
      const when = m.at ? String(m.at).replace(/^Day\s+\d+\s*/, "") : `message ${m.msgIndex + 1}`;
      return `${head}<div class="almx-tl__ev" style="--k:${col}"><span class="almx-tl__dot">${ic(icon)}</span><div class="card tight"><small class="muted">${e(when || `message ${m.msgIndex + 1}`)} · ${e(m.kind)}</small><div><b>${e(m.text)}</b></div></div></div>`;
    }).join("");
    return `${forecasts.length ? `${sec("Ahead", forecasts.length, "from the lore's forecasts")}<div class="almx-stack">${forecasts.map((f: any) => `<div class="card tight almx-row"${f.status === "diverged" ? ' style="opacity:.8"' : ""}><span class="almx-set__ic" style="--k:${f.status === "diverged" ? "var(--alm-muted)" : "var(--g)"}">${ic("crystal")}</span><span class="grow"${f.status === "diverged" ? ' style="text-decoration:line-through;text-decoration-color:var(--alm-warn)"' : ""}>${e(f.summary)}</span>${f.status === "diverged" ? stk("diverged", "warn") : ""}</div>`).join("")}</div>` : ""}
${sec("Milestones", ev.length || null, "newest first")}${ev.length ? `<div class="almx-tl">${items}</div>` : `<div class="empty">Nothing yet.</div>`}`;
  }

  tab_world(v: any): string {
    const w = v.world;
    const cal = w.calendar;
    const STATUS: Record<string, Tone> = { open: "acc2", active: "acc2", rising: "warn", urgent: "bad", stalled: "ghost", blocked: "ghost", resolved: "good", closed: "good", done: "good" };
    const bitTones: Tone[] = ["g", "acc", "acc2", "good", "warn"];
    return `<div class="almx-g2"><div class="almx-tile"><div class="almx-lbl">${ic("cal", "sm")}Calendar</div><div class="almx-val">${e(cal ? cal.date : "not started")}</div>${cal ? `<small>${e([cal.weekday, cal.season].filter(Boolean).join(" · "))}</small>` : ""}</div><div class="almx-tile"><div class="almx-lbl">${ic("leaf", "sm")}Climate</div><div class="almx-val">${e(w.climate || "—")}</div></div></div>
<details class="card tight" style="margin-top:10px"><summary class="muted">Schedule weather</summary><div class="row" style="margin-top:8px"><input type="number" id="almWxDay" placeholder="day" style="width:72px"><input type="number" id="almWxHour" placeholder="hour" style="width:72px"><input type="number" id="almWxLen" placeholder="hours" style="width:72px"><input type="text" id="almWxCond" placeholder="thunderstorm" class="grow"><button class="btn" data-act="scheduleWx">Schedule</button></div></details>
${w.factions.length ? `${sec("Clocks", null, "they fill, then something happens")}<div class="alm-clocks">${w.factions.flatMap((f: any) => f.clocks.map((c: any) => `<div class="card tight almx-row">${ring(c.cur, c.max, "var(--alm-danger)")}<div class="grow"><b style="font-size:14px">${e(f.name)}</b><small class="muted" style="display:block">${e(c.name)}</small></div></div>`)).join("")}</div>` : ""}
${w.gauges.length ? `${sec("Gauges")}<div class="alm-clocks">${w.gauges.map((g: any) => `<div class="card tight almx-row">${ring(g.cur, g.max, "var(--alm-accent-2)")}<div class="grow"><b style="font-size:14px">${e(g.name)}</b>${g.cause ? `<small class="muted" style="display:block">${e(g.cause)}</small>` : ""}</div></div>`).join("")}</div>` : ""}
${w.deadlines.length ? `${sec("Deadlines", w.deadlines.length)}<div class="almx-stack">${w.deadlines.map((d: any) => `<div class="card tight almx-row${d.passed && !d.done ? " almx-bad" : ""}">${ic("clock")}<div class="grow"><b>${e(d.title)}</b><small class="muted" style="display:block">${e(d.at)}</small></div>${d.done ? stk("done", "good") : d.passed ? stk("passed", "bad") : stk(`${d.left} left`, "warn")}</div>`).join("")}</div>` : ""}
${w.threads.length ? `${sec("Threads", w.threads.length)}<div class="card almx-rows" style="padding:2px 16px">${w.threads.map((t: any) => `<div><div class="almx-row"><b class="grow">${e(t.title)}</b>${stk(t.status, STATUS[String(t.status).toLowerCase()] ?? "g")}</div>${t.latest ? `<div class="muted" style="font-size:13.5px;margin-top:2px">${e(t.latest)}</div>` : ""}${t.blocker ? `<div style="font-size:13.5px;margin-top:4px;color:var(--alm-danger)">Blocked: ${e(t.blocker)}</div>` : ""}</div>`).join("")}</div>` : ""}
${w.items.length ? `${sec("Things", w.items.length, "who has what")}<div class="alm-inv">${w.items.map((i: any) => `<div class="alm-it${i.gone ? " gone" : ""}"><span class="alm-it__ic">${i.gone ? "✗" : "✦"}</span><div><b>${e(i.name)}</b><span class="alm-it__h">${e(i.gone ? "gone" : i.holder || "?")}${i.where && !i.gone ? ` · ${e(i.where)}` : ""}</span>${i.custody.slice(-2).map((c: any) => `<small class="muted" style="display:block">${e(c.from || "?")} → ${e(c.to || "?")}${c.how ? ` (${e(c.how)})` : ""}</small>`).join("")}</div></div>`).join("")}</div>` : ""}
${w.rumors.length ? `${sec("Rumours", w.rumors.length)}<div class="almx-stack">${w.rumors.map((r: any) => `<div class="almx-row" style="align-items:flex-start"><div class="almx-bubble">${e(r.text)}</div>${stk(`${r.hops} hop${r.hops === 1 ? "" : "s"}`, r.hops > 1 ? "g" : "ghost")}</div>`).join("")}</div>` : ""}
${w.rep.length ? `${sec("Reputation")}<div class="card almx-stack">${w.rep.map((r: any) => `<div><div class="almx-row" style="font-size:14px"><b class="grow">${e(r.group)}</b><b style="color:${r.score < 0 ? "var(--alm-danger)" : "var(--alm-good)"}">${r.score > 0 ? "+" : ""}${r.score}${r.tags.length ? ` · ${e(r.tags.join(", "))}` : ""}</b></div><div class="bar" style="margin-top:6px"><i style="width:${Math.round(((r.score + 3) / 6) * 100)}%;background:${r.score < 0 ? "var(--alm-danger)" : "var(--alm-good)"}"></i></div></div>`).join("")}</div>` : ""}
${w.clues.length || w.plants.length ? `${sec("Clues, plants and payoffs")}<div class="card almx-rows" style="padding:2px 16px">${w.clues.map((c: any) => `<div class="almx-row" style="align-items:flex-start;font-size:14px">${ic("search", "sm")}<span class="grow">${e(c.text)}${c.pointsTo ? ` → <b>${e(c.pointsTo)}</b>` : ""}</span>${c.reliability ? `<small class="muted">${e(c.reliability)}</small>` : ""}</div>`).join("")}${w.plants.map((p: any) => `<div class="almx-row" style="align-items:flex-start;font-size:14px">${p.paidAt != null ? `<span style="color:var(--alm-good)">${ic("check", "sm")}</span>` : ic("sparkle", "sm")}<span class="grow"${p.paidAt != null ? ' style="color:var(--alm-muted)"' : ""}>${e(p.text)}</span>${p.payoff ? `<small class="muted">${e(p.payoff)}</small>` : stk(p.paidAt != null ? "paid off" : "planted", p.paidAt != null ? "good" : "ghost")}</div>`).join("")}</div>` : ""}
${(v.bits ?? []).length ? `${sec("Running bits", v.bits.length, "offered as callbacks")}<div class="almx-bits">${v.bits.map((b: any, i: number) => stk(`${b.text}${b.uses > 1 ? ` ×${b.uses}` : ""}`, bitTones[i % bitTones.length], [b.who, b.by === "chronicle" ? "from a chapter summary" : ""].filter(Boolean).join(" · "))).join("")}</div>` : ""}
${w.canon.length ? `${sec("Minted canon", w.canon.length)}<div class="card"><ul class="alm-list">${w.canon.map((c: any) => `<li>${e(c.text)}</li>`).join("")}</ul></div>` : ""}
<button class="btn wide" style="margin-top:16px" data-act="simulate">${ic("forward", "sm")}Move the world off the page now</button>`;
  }

  tab_elsewhere(v: any): string {
    const x = v.elsewhere;
    if (!x) return `<div class="empty">Elsewhere starts after the next reply.</div>`;
    const director = x.view !== "surprise";
    const KIND: Record<string, string> = { pursuit: "Pursuit", scheme: "Scheme", rivalry: "Rivalry", courtship: "Courtship", rift: "Rift", debt: "Debt", secret: "Secret", decline: "Decline", investigation: "Investigation", threat: "Threat", return: "Return", duty: "Duty", life: "Life", loss: "Loss", world: "World" };
    const ROUTE: Record<string, string> = { carrier: "speech", signal: "phone", ambient: "radio", trace: "house", entrance: "door" };
    const route = (k: string) => ic(ROUTE[k] ?? "arrow", "sm");
    const RES: Record<string, [string, Tone]> = { win: ["win", "good"], cost: ["cost", "warn"], loss: ["loss", "bad"] };
    const wf = (want: string, fear: string) => `<div class="almx-wf"><div class="w"><div class="almx-lbl">Wants</div>${e(want)}</div><div class="f"><div class="almx-lbl">Fears</div>${e(fear)}</div></div>`;
    const tick = x.ticks[0];
    const head = `<div class="card"><div class="almx-lbl">How busy the world is · ${x.chatMode ? "this chat" : "from Settings"}</div><div style="margin-top:8px">${toggle("ewMode", x.chatMode ?? "", [["", "Settings"], ["off", "Off"], ["quiet", "Quiet"], ["living", "Living"], ["restless", "Restless"]], "How busy the world is")}</div>
<div class="almx-lbl" style="margin-top:14px">What you see</div><div style="margin-top:8px">${toggle("ewView", director ? "director" : "surprise", [["director", "Director: everything", 'title="Everything: subplots, dice, grounds"'], ["surprise", "Surprise me", 'title="Only what has reached your story"']], "What you see")}</div>
<div class="almx-inset almx-row" style="margin-top:14px">${ic("clock", "sm")}<span class="grow">${tick ? `Last step ${e(tick.from)} → ${e(tick.to)} (${tick.hours} h) · ${n(tick.beats, "beat")} · ${tick.seeds} new${tick.proposed ? ` · ${tick.proposed} proposed` : ""} · ${tick.hops} news${tick.tokens ? ` · ${Math.round(tick.tokens / 100) / 10}K tokens` : ""}` : `Nothing has moved yet: the world steps forward when story time moves ${x.step} minutes or more.`}</span></div>
<p class="muted" style="margin:8px 0 0"><small>The world is <b>${e(x.mode)}</b>${x.town ? ` · ${e(x.town)}` : ""}</small></p>
<button class="btn wide" style="margin-top:12px" data-act="simulate">${ic("forward", "sm")}Move the world a step now</button></div>`;
    if (!director) {
      const reached = x.arrivals.filter((a: any) => a.status === "used");
      const waiting = (x.proposals ?? []).length;
      return `${head}${waiting ? `<div class="almx-callout">${ic("info")}<div>${waiting} proposed subplot${waiting === 1 ? " is" : "s are"} waiting on you. Switch to Director to accept or decline ${waiting === 1 ? "it" : "them"}.</div></div>` : ""}${sec("What has reached you", reached.length || null)}${reached.length ? `<div class="card almx-rows" style="padding:2px 16px">${reached.map((a: any) => `<div class="almx-row" style="align-items:flex-start">${route(a.kind)}<span class="grow">${e(a.text)} <small class="muted">${e(a.at)}</small></span></div>`).join("")}</div>` : `<div class="empty">Nothing from off the page has reached the story yet.</div>`}
<p class="muted"><small>${n(x.arcs.filter((a: any) => a.status === "running").length, "subplot")} moving where you can't see. Switch to Director to look.</small></p>`;
    }
    const fates = x.arcs.filter((a: any) => a.status === "fate");
    const arcCard = (a: any) => {
      const live = a.status === "running" || a.status === "held";
      const editing = this.editing === `ew:${a.id}`;
      const beats = a.beats.length ? `<div class="almx-lbl" style="margin-top:14px">Beats</div><div class="almx-stack" style="margin-top:8px;gap:8px">${a.beats.map((b: any) => {
        const [res, tone] = RES[b.result] ?? [String(b.result), "" as Tone];
        const told = b.telling ? " · the model is telling it…" : b.told === "template" ? ` · engine's words${b.note && x.telling !== "engine" ? " (the model's version was set aside)" : ""}` : "";
        return `<div class="almx-beat"><span class="row" style="gap:4px;flex-wrap:nowrap"><span class="almx-die">${b.roll[0]}</span><span class="almx-die">${b.roll[1]}</span></span><div class="grow" style="min-width:0"><div class="row" style="gap:6px">${stk(res, tone)}${b.mod ? `<small class="muted">${b.mod > 0 ? "+" : ""}${b.mod}</small>` : ""}${b.twist ? stk("twist", "acc") : ""}<small class="muted"${b.note ? ` title="${e(b.note)}"` : ""}>${e(b.at)}${e(told)}</small><span class="grow"></span>${b.retell ? `<button class="btn sm ghost" data-act="ewRetell" data-id="${e(a.id)}" data-tick="${e(b.tick)}" data-at="${b.atAbs}" title="Ask the model to tell this step again (same outcome, new words)">retell</button>` : ""}</div><div style="margin-top:4px">${e(b.text)}</div></div></div>`;
      }).join("")}</div>` : "";
      const reach = (a.reached ?? []).length || a.reaches.length
        ? `<div class="almx-reach">${(a.reached ?? []).length ? `<div class="almx-lbl" style="color:var(--alm-good)" title="Taken up by a reply: it happened on the page">${ic("check", "sm")}Reached you</div>${a.reached.map((r: any) => `<div class="almx-row" style="align-items:flex-start">${route(r.kind)}<span>${e(r.text)}${r.at ? ` <small class="muted">${e(r.at)}</small>` : ""}</span></div>`).join("")}` : ""}${a.reaches.length ? `<div class="almx-lbl" style="color:var(--alm-warn)" title="Not in the story yet: it goes to the model when the scene has room, and only counts once a reply shows it">${ic("arrow", "sm")}On its way</div>${a.reaches.map((r: any) => `<div class="almx-row" style="align-items:flex-start">${route(r.kind)}<span>${e(r.text)}${r.at ? ` <small class="muted">${e(r.at)}</small>` : ""}</span></div>`).join("")}<small class="muted">Not in the story yet.</small>` : ""}</div>`
        : "";
      const color = a.kind === "threat" || a.kind === "decline" || a.kind === "loss" ? "var(--alm-danger)" : "var(--g)";
      return `<article class="card"><div class="almx-row" style="align-items:flex-start">${ring(a.clock.cur, a.clock.max, color)}<div class="grow"><b style="font:800 17px/1.2 var(--almo-font)">${e(a.lead)} · ${KIND[a.kind] ?? e(a.kind)}</b><div class="row" style="gap:6px;margin-top:6px">${stk(a.status === "running" ? a.stage : a.status, a.status === "running" ? "g" : "")}${stk(a.secrecy, "ghost", "Who could learn of it")}${a.crossed ? stk("crossed", "warn", "It has reached the story") : ""}${a.by === "player" ? stk("yours", "acc") : ""}</div></div></div>
<p style="margin:12px 0 0">${e(a.premise)}</p>${wf(a.want, a.fear)}${a.cast.length ? `<p class="muted" style="margin:8px 0 0"><small>With ${e(a.cast.join(", "))}</small></p>` : ""}
${beats}
${live && a.status === "running" && (a.wait || a.next) ? `<div class="almx-inset" style="margin-top:10px"><b>Next:</b> ${a.wait ? `${e(a.wait)}; ` : ""}${a.next ? `not before ${e(a.next)}` : "any time now"}${a.wait ? ` <small class="muted">Nudge to make it happen now.</small>` : ""}</div>` : ""}
${reach}
${a.ending ? `<div class="almx-inset" style="margin-top:10px"><b>Ended:</b> ${e(a.ending.text)} <small class="muted">${e(a.ending.at)}</small></div>` : ""}${a.note ? `<p class="muted" style="margin:8px 0 0"><small>${e(a.note)}</small></p>` : ""}
<p class="muted" style="margin:10px 0 0"><small>Grounds: ${a.grounds.map((g: any) => e(g.name)).join(" · ")}</small></p>
${editing ? `<div style="margin-top:10px"><label class="f">Premise<input type="text" id="almEwPremise" value="${e(a.premise)}"></label><label class="f">Wants<input type="text" id="almEwWant" value="${e(a.want)}"></label><label class="f">Fears<input type="text" id="almEwFear" value="${e(a.fear)}"></label><div class="row"><label class="f grow">Kind<select id="almEwKind">${Object.entries(KIND).filter(([k]) => k !== "world").map(([k, lab]) => `<option value="${k}"${k === a.kind ? " selected" : ""}>${lab}</option>`).join("")}</select></label><label class="f grow">Who could hear of it<select id="almEwSecrecy">${[["public", "public: anyone"], ["private", "private: those close to it"], ["secret", "secret: kept hidden"]].map(([k, lab]) => `<option value="${k}"${k === a.secrecy ? " selected" : ""}>${lab}</option>`).join("")}</select></label></div><div class="row"><button class="btn primary" data-act="ewSave" data-id="${e(a.id)}">Save</button><button class="btn" data-act="cancelEdit">Cancel</button></div></div>`
  : live ? `<div class="row" style="margin-top:12px;gap:6px">${a.status === "held" ? `<button class="btn sm" data-act="ewArc" data-id="${e(a.id)}" data-what="resume">${ic("play", "sm")}Resume</button>` : `<button class="btn sm" data-act="ewArc" data-id="${e(a.id)}" data-what="hold" title="Freeze it">${ic("pause", "sm")}Hold</button><button class="btn sm" data-act="ewArc" data-id="${e(a.id)}" data-what="nudge" title="Its next step now">Nudge</button><button class="btn sm primary" data-act="ewArc" data-id="${e(a.id)}" data-what="bring" title="Offer it to the next turn">Bring in</button>`}<span class="grow"></span><button class="btn sm ghost" data-act="edit" data-id="ew:${e(a.id)}">Edit</button><button class="btn sm danger" data-act="ewArc" data-id="${e(a.id)}" data-what="drop">Drop</button></div>` : ""}</article>`;
    };
    const proposals = x.proposals ?? [];
    const proposalCard = (p: any) => `<article class="card almx-dash"><div class="almx-row"><b class="grow" style="font:800 17px/1.2 var(--almo-font)">${e(p.lead)} · ${KIND[p.kind] ?? e(p.kind)}</b>${stk(p.secrecy, "ghost", "Who could learn of it")}</div>
<p style="margin:10px 0 0">${e(p.premise)}${p.telling ? ` <small class="muted">(the model is putting it in the story's words…)</small>` : ""}</p>${wf(p.want, p.fear)}${p.cast.length ? `<p class="muted" style="margin:8px 0 0"><small>With ${e(p.cast.join(", "))}</small></p>` : ""}
<p class="muted" style="margin:8px 0 0"><small>From ${e(p.why)} · grounds: ${p.grounds.map((g: any) => e(g.name)).join(" · ")} · ${e(p.at)}</small></p>
${p.replaces ? `<p class="muted" style="margin:6px 0 0"><small>Replaces ${e(p.replaces)}</small></p>` : ""}
<div class="row" style="margin-top:12px"><button class="btn primary grow" data-act="ewPropose" data-id="${e(p.id)}" data-what="accept">Start it</button><button class="btn grow" data-act="ewPropose" data-id="${e(p.id)}" data-what="decline">No thanks</button></div></article>`;
    const live = x.arcs.filter((a: any) => a.status === "running" || a.status === "held");
    const done = x.arcs.filter((a: any) => a.status === "resolved" || a.status === "dropped");
    const grp = (f: (p: any) => boolean) => x.people.filter(f);
    const person = (p: any) => `<span class="pill" title="${e(`${p.ring} · ${p.standing}${p.where ? ` · ${p.where}` : ""} · ${p.reach}`)}">${e(p.name)}${p.arc ? " ✦" : ""}${p.flags.out ? " (out)" : ""}${p.flags.wake ? " (awake)" : ""} <a href="#" data-act="ewPerson" data-name="${e(p.name)}" data-what="${p.flags.out ? "in" : "out"}" title="${p.flags.out ? "Back in the simulation" : "Leave them out of it"}">${p.flags.out ? "＋" : "×"}</a>${!p.flags.out && !p.awake ? ` <a href="#" data-act="ewPerson" data-name="${e(p.name)}" data-what="wake" title="Wake them next step">☀</a>` : ""}</span>`;
    const can = (p: any) => !["dead", "changed", "companion"].includes(p.standing);
    const wing = (label: string, color: string, list: string) => `<div><div class="almx-lbl"${color ? ` style="color:${color}"` : ""}>${label}</div><div class="row" style="margin-top:6px;gap:6px">${list || `<span class="muted">—</span>`}</div></div>`;
    return `${head}
${fates.length ? `${sec("Waiting on you", fates.length)}${fates.map((a: any) => `<article class="card almx-bad"><div class="almx-row">${medal(a.lead, this.colorOf(v, a.lead), "sm")}<b class="grow">${e(a.lead)} · ${KIND[a.kind] ?? e(a.kind)}</b>${stk("can't be undone", "bad")}</div><p style="margin:10px 0 0;font:700 17px/1.3 var(--almo-font)">${e(a.fate?.text ?? a.fear)}</p><div class="almx-g3" style="margin-top:12px"><button class="btn sm primary" data-act="ewFate" data-id="${e(a.id)}" data-what="accept">Accept</button><button class="btn sm" data-act="ewFate" data-id="${e(a.id)}" data-what="soften">Soften</button><button class="btn sm" data-act="ewFate" data-id="${e(a.id)}" data-what="page" title="Keep it for a scene on the page">On the page</button></div></article>`).join("")}` : ""}
${proposals.length ? `${sec("Proposed", proposals.length, "found in your story")}<div class="almx-stack">${proposals.map(proposalCard).join("")}</div>` : ""}
${sec("Subplots", live.length || null)}${live.length ? `<div class="almx-stack">${live.map(arcCard).join("")}</div>` : `<div class="empty">${x.seeding === "off" ? "No subplots. New ones aren't made from the story (Settings → New subplots); give someone a story below." : x.seeding === "ask" ? "No subplots yet. When story time moves, the world proposes some from threads, debts, secrets, the lorebooks and what drives people." : "No subplots yet. They begin when story time moves, from threads, debts, secrets, the lorebooks and what drives people."}</div>`}
${sec("Give someone a story")}<div class="card almx-stack"><select id="almEwWho" aria-label="Who">${x.people.filter((p: any) => can(p) && p.ring !== "onstage").map((p: any) => `<option>${e(p.name)}</option>`).join("")}</select><input type="text" id="almEwText" placeholder="Spike wants the chip out and is asking the wrong people" aria-label="Their story"><div class="almx-row"><small class="muted grow">Your words stand; the engine moves it with the same dice, and its first step comes at once.${x.telling !== "engine" ? " The model reads your words first for the kind of story and what they're after." : ""}</small><button class="btn primary" data-act="ewAuthor">Start it</button></div></div>
${sec("In the wings", null, "hover a name for where they are")}<div class="card almx-wings">
${wing("Awake", "var(--alm-warn)", grp((p: any) => p.awake).map(person).join(" "))}
${wing("On the page", "var(--alm-good)", grp((p: any) => p.ring === "onstage").map((p: any) => `<span class="pill">${e(p.name)}</span>`).join(" "))}
${wing("Asleep", "", grp((p: any) => !p.awake && p.ring !== "onstage" && can(p)).map(person).join(" "))}
${wing("Can't act", "", grp((p: any) => !can(p)).map((p: any) => `<span class="pill">${e(p.name)} · ${e(p.standing)}</span>`).join(" "))}
<small class="muted">✦ has a subplot. × leaves someone out of it, ☀ wakes them for the next step.</small></div>
${x.arrivals.length ? `${sec("On the way, and arrived", x.arrivals.length)}<div class="card almx-rows" style="padding:2px 16px">${x.arrivals.map((a: any) => `<div class="almx-row" style="align-items:flex-start">${route(a.kind)}<div class="grow"><small class="muted">${e(a.status)}${a.at ? ` · ${e(a.at)}` : ""}${a.carrier ? ` · via ${e(a.carrier)}` : ""}${a.why ? ` · ${e(a.why)}` : ""}</small><div style="font-size:14px">${e(a.text)}</div></div></div>`).join("")}</div>` : ""}
${done.length ? `<details class="card tight" style="margin-top:12px"><summary><b>Ended · ${done.length}</b></summary><div class="almx-stack" style="margin-top:10px">${done.map(arcCard).join("")}</div></details>` : ""}
${x.ticks.length ? `<details class="card tight"><summary><b>The engine's log</b></summary>${x.ticks.map((t: any) => `<div class="rec" style="margin-top:8px"><b>${e(t.from)} → ${e(t.to)}</b> <small class="muted">${e(t.status)}${t.rejected.length ? ` · ${t.rejected.length} told by the engine instead` : ""}</small><ul class="alm-list">${t.log.map((l: string) => `<li><small>${e(l)}</small></li>`).join("")}${t.rejected.map((l: string) => `<li><small class="muted">kept to the engine's words: ${e(l)}</small></li>`).join("")}</ul></div>`).join("")}</details>` : ""}`;
  }

  tab_lore(v: any): string {
    const books = Object.entries(v.lore.books ?? {});
    const MODE_HELP: Record<string, string> = { native: "Your keywords decide; the Almanac only marks lore the story moved past.", assisted: "Your keywords, plus the entries Recall picks.", managed: "The Almanac is the only one that picks this book's entries." };
    const book = ([id, b]: any) => `<article class="card almx-book"><div class="almx-book__hd"><div class="almx-row"><span class="row" style="gap:6px">${b.weaver ? `<span class="pill" title="${e(WEAVER_BOOK[b.weaver]?.[1] ?? "")}">Dream Weaver · ${e(WEAVER_BOOK[b.weaver]?.[0] ?? b.weaver)}</span>` : ""}<span class="pill">${e(b.scope)}</span></span><span class="grow"></span><span class="almx-big" style="font-size:28px">${b.count}</span></div><b>${e(b.name)}</b></div>
<div class="almx-book__bd">${loreKinds(b.kinds)}<div class="almx-lbl" style="margin-top:12px">How entries fire</div><div style="margin-top:6px">${toggle("loreMode", b.mode, [["native", "Native"], ["assisted", "Assisted"], ["managed", "Managed"]].map(([k, l]) => [k, l, `data-book="${e(id)}"`]) as any, "How entries fire")}</div><p class="muted" style="margin:6px 0 0"><small>${e(MODE_HELP[b.mode] ?? "")}</small></p></div></article>`;
    return `<p class="muted" style="margin:0 0 10px">The Almanac reads your lorebooks into the Codex. It never writes to them unless you allow it.</p>
<div class="row" style="margin-bottom:12px"><button class="btn primary grow" data-act="loreScan">${ic("loop", "sm")}Read them again</button><button class="btn grow" data-act="mirrorSync">Sync mirror</button></div>
${worldPanel(v.lore.world, !!v.settings?.simulator)}
<div class="almx-stack">${books.map(book).join("") || `<div class="empty">No lorebooks are attached to this chat.</div>`}</div>
${(v.playbooks ?? []).length ? `${sec("Playbooks", v.playbooks.length, "scenes that haven't happened")}<p class="muted" style="margin:0 0 10px"><small>Scripted scenes from depth books. They're never sent as lore; when a turn comes close to one it goes in once, marked "not history". Mark one played once the story has had that scene.</small></p><div class="almx-stack">${v.playbooks.map((p: any) => `<div class="card tight"${p.played ? ' style="opacity:.75"' : ""}><div class="almx-row"><div class="grow"><b${p.played ? ' style="text-decoration:line-through"' : ""}>${e(p.name)}</b>${p.subject ? `<small class="muted" style="display:block">${e(p.subject)}</small>` : ""}</div><button class="btn sm${p.played ? " ghost" : ""}" data-act="playbookPlayed" data-id="${e(p.id)}" data-played="${p.played ? "1" : ""}">${p.played ? "✓ played · undo" : "Mark played"}</button></div><details><summary class="muted"><small>The scene</small></summary><div class="muted" style="font-size:13.5px;margin-top:6px">${e(p.summary)}</div></details></div>`).join("")}</div>` : ""}
${v.lore.review?.length ? `${sec("To review", v.lore.review.length)}<div class="card" style="padding:2px 16px">${v.lore.review.slice(0, 40).map((r: any) => `<div class="almx-conf"><div class="almx-row" style="font-size:14px"><b class="grow">${e(r.title)}</b><span class="muted">${e(r.kind)}?</span><b>${Math.round(r.confidence * 100)}%</b></div><div class="bar"><i style="width:${Math.round(r.confidence * 100)}%;background:${r.confidence < 0.5 ? "var(--alm-danger)" : "var(--alm-warn)"}"></i></div></div>`).join("")}</div><button class="btn wide" style="margin-top:10px" data-act="loreClassify">${ic("sparkle", "sm")}Let the model sort ${n(v.lore.review.length, "entry", "entries")}</button>` : ""}`;
  }

  tab_creator(v: any): string {
    return this.creator.render(v);
  }

  tab_recall(v: any): string {
    const f = v.feed?.[0];
    const via = (i: any) => (!i.injected ? "" : i.via === "mirror" ? `<span class="pill" title="Sent as a forced entry of the chat's mirror lorebook: the Prompt Breakdown lists it under World Info, not under ALMANAC · Recall">lorebook</span>` : i.via === "recall" ? `<span class="pill" title="Sent inside the ALMANAC · Recall block">recall</span>` : "");
    const ck = v.checks?.issues ?? [];
    const checkCard = `<div class="card"><div class="almx-row"><b class="grow" style="font:700 17px/1.2 var(--almo-font)">Check of the last reply</b><button class="btn sm" data-act="recheck" title="Run the check again on the latest reply">Check again</button></div>${ck.length ? `<div class="almx-stack" style="margin-top:12px;gap:8px">${ck.map((i: any) => `<div class="almx-callout ${i.level === "warn" ? "warn" : ""}" style="margin:0">${ic(i.level === "warn" ? "warn" : "info")}<div>${e(i.text)}${i.quote && !i.text.includes(i.quote) ? `<div class="almx-code" style="margin-top:4px;opacity:.85">«${e(i.quote)}»</div>` : ""}</div></div>`).join("")}</div><p class="muted" style="margin:10px 0 0"><small>The next turn tells the model about the warnings. If one matters now, swipe for a new take.</small></p>` : `<p class="muted" style="margin:8px 0 0">${v.settings?.replyCheck === "off" ? "The reply check is off (Settings › Knowledge)." : "Nothing found."}</p>`}</div>`;
    if (!f) return `${checkCard}<div class="empty">No retrieval yet. It appears after the next reply.</div>${this.rejectedHtml(v)}`;
    const ceil = f.ceiling;
    const used = ceil ? ceil.after : f.tokens;
    const pct = ceil?.limit ? Math.round((used / ceil.limit) * 100) : null;
    const budget = `<div class="card"><div class="almx-row" style="align-items:flex-end"><div class="grow"><div class="almx-lbl">Added to the prompt</div><div class="almx-big">≈${Number(used).toLocaleString()}${ceil?.limit ? ` <span style="font-size:16px;color:var(--alm-muted)">/ ${Number(ceil.limit).toLocaleString()}</span>` : ""}</div></div>${pct != null ? stk(`${pct}%`, pct > 95 ? "bad" : pct > 80 ? "warn" : "good") : ""}</div>
${ceil?.limit ? `<div class="bar thick" style="margin-top:12px"><i style="width:${Math.min(100, pct ?? 0)}%;background:var(--g)"></i></div>` : ""}
<div class="row" style="margin-top:10px;gap:6px"><span class="pill">tier: ${e(f.tier)}</span><span class="pill">${f.items.filter((i: any) => i.injected).length} of ${f.items.length} sent</span><span class="pill">${new Date(f.at).toLocaleTimeString()}</span></div>
${ceil?.trimmed?.length ? `<p class="muted" style="margin:10px 0 0"><small>Trimmed to fit (≈${ceil.before} before): ${ceil.trimmed.map((t: string) => e(t)).join("; ")}.</small></p>` : ""}
${f.chronicle?.length ? `<p class="muted" style="margin:8px 0 0"><small>Story so far in this prompt: ${f.chronicle.map((c: any) => e(c.name)).join(" · ")}</small></p>` : ""}</div>`;
    return `${checkCard}${budget}
${sec("Considered", f.items.length, "green went in")}<p class="muted" style="margin:0 0 10px"><small>Records the chat's mirror lorebook holds go in as its entries (the Prompt Breakdown shows them under World Info); the rest go in the ALMANAC · Recall block.</small></p>
<div class="almx-stack almx-feed" style="gap:8px">${f.items.map((i: any) => `<div class="card tight almx-row${i.injected ? " in" : ""}" style="margin:0"><span class="almx-score">${i.score}</span><div class="grow" style="min-width:0"><div class="row" style="gap:6px"><b>${e(i.name)}</b>${via(i)}</div><small class="muted" style="display:block;overflow-wrap:anywhere">${e(i.reasons.join(" · "))}</small></div>${i.injected ? `<span style="color:var(--alm-good)">${ic("check")}</span>` : ""}</div>`).join("")}</div>
${this.rejectedHtml(v)}`;
  }

  rejectedHtml(v: any): string {
    if (!v.rejected.length) return "";
    return `${sec("Lines the Almanac fixed", v.rejected.length)}<div class="almx-stack" style="gap:8px">${v.rejected.slice().reverse().map((r: any) => `<div class="card tight" style="margin:0"><div class="almx-code" style="color:${/reject/i.test(r.verdict) ? "var(--alm-danger)" : "var(--alm-warn)"}">${e(r.raw)}</div><div class="row" style="margin-top:6px;gap:6px">${stk(r.verdict, /reject/i.test(r.verdict) ? "bad" : "warn")}<small class="muted">message ${r.msgIndex + 1}${r.reason ? ` · ${e(r.reason)}` : ""}</small></div></div>`).join("")}</div>`;
  }

  tab_craft(v: any): string {
    const t = v.telemetry;
    if (!t) return `<div class="empty">Craft notes appear after a few replies.</div>`;
    return `<div class="card almx-try"><div class="almx-try__hd"><div class="almx-lbl">Next reply, try</div><div class="almx-big">${e(t.technique)}</div>${ic("sparkle")}</div>
<div class="almx-try__bd"><div class="almx-lbl">And avoid</div><div class="row" style="margin-top:8px;gap:6px">${t.avoids.map((a: string) => `<span class="pill almx-avoid">${e(a)}</span>`).join("") || `<span class="muted">nothing in particular</span>`}</div>
${t.agency.length ? `<div class="almx-callout warn" style="margin:12px 0 0">${ic("warn")}<div>${e(t.agency.join("; "))}</div></div>` : ""}</div></div>
${sec("Last six replies")}<div class="almx-g2">${Object.entries(t.metrics).map(([k, x]) => `<div class="almx-tile"><div class="almx-lbl">${e(k)}</div><div class="almx-val" style="font-size:20px">${e(String(x))}</div></div>`).join("")}</div>
${t.repeated.length ? `${sec("Said too often", t.repeated.length)}<div class="row" style="gap:10px">${t.repeated.map((r: any) => `<span class="pill" style="padding:7px 12px;font-size:13.5px">“${e(r.phrase)}” ${stk(`×${r.count}`, r.count > 3 ? "bad" : "warn")}</span>`).join("")}</div>` : ""}
${t.openings.length ? `${sec("How replies open")}<div class="card almx-rows" style="padding:2px 16px">${t.openings.map((o: string) => `<div style="font-size:14px">${e(o)}</div>`).join("")}</div>` : ""}`;
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
    const set = (id: string, icon: string, color: string, title: string, summary: string, body: string) =>
      `<details class="almx-set" data-sec="${id}"${this.openSecs.has(id) ? " open" : ""}><summary><span class="almx-set__ic" style="--k:${color}">${ic(icon)}</span><span class="grow"><b>${e(title)}</b><small>${e(summary)}</small></span>${ic("down", "sm")}</summary><div class="almx-set__bd">${body}</div></details>`;
    const auto = v.config.enabledOverride == null;
    const pressed = (on: boolean) => `aria-pressed="${on}"`;
    const look = SKIN_LIST.map(([id, name]) => {
      const pal = skinPalette(id, this.lookTarget().mode);
      const sw = pal ? [pal["panel-2"], pal.accent, pal["accent-2"]] : ["var(--alm-panel-2)", "var(--alm-accent)", "var(--alm-accent-2)"];
      return `<button type="button" data-act="setting" data-key="theme" data-id="${id}" aria-pressed="${s.theme === id}"><span>${sw.map((c) => `<i style="background:${c}"></i>`).join("")}</span>${e(name)}</button>`;
    }).join("");
    const elsewhereLab: Record<string, string> = { off: "off", quiet: "quiet", living: "living", restless: "restless" };
    return `<div class="card hl"><div class="almx-row"><b class="grow" style="font:700 17px/1.2 var(--almo-font)">This chat</b>${stk(v.enabled ? "on" : "off", v.enabled ? "good" : "ghost")}</div>
<div class="almx-tgl" style="margin-top:12px" role="group" aria-label="Ledger in this chat"><button type="button" data-act="enable" ${pressed(!auto && v.enabled)}>On</button><button type="button" data-act="disable" ${pressed(!auto && !v.enabled)}>Off</button><button type="button" data-act="auto" ${pressed(auto)}>Automatic</button></div>
<p class="muted" style="margin:8px 0 0"><small>Automatic: on while the chat uses the ALMANAC preset.</small></p>
${v.hiddenTurns ? `<div class="almx-inset almx-row" style="margin-top:12px"><span class="grow">${v.hiddenTurns} turn${v.hiddenTurns === 1 ? " is" : "s are"} hidden under summaries. Switching the chat off shows them again; so does this (do it before uninstalling).</span><button class="btn sm" data-act="releaseHidden">Show them</button></div>` : ""}</div>
${sec("Story truths", (v.config.truths ?? []).length || null, "sent every turn, above canon")}<div class="almx-truths"><textarea id="almTruths" rows="3" placeholder="Jaime and Cersei are strictly family.&#10;Rhaegar is bald and wears a wig." aria-label="Story truths, one a line">${e((v.config.truths ?? []).join("\n"))}</textarea><div class="almx-row" style="margin-top:8px"><small class="muted grow">One a line. Or pin one from a message: <code>((truth: …))</code></small><button class="btn primary" data-act="saveTruths">Save truths</button></div></div>
${sec("How it works")}
${set("core", "cog", "#c2c9de", "Core", `${s.enabled === "auto" ? "automatic" : s.enabled === "on" ? "every chat" : "off"} · ${s.strictness} · repairs ${s.autoRepair ? "on" : "off"}`, `<label class="f">Enable<select data-setting="enabled"><option value="auto"${s.enabled === "auto" ? " selected" : ""}>automatic (ALMANAC chats)</option><option value="on"${s.enabled === "on" ? " selected" : ""}>every chat</option><option value="off"${s.enabled === "off" ? " selected" : ""}>off</option></select></label>
<label class="f">Validation${sel("strictness", [["strict", "strict — reject impossible changes"], ["lenient", "lenient — warn only"]])}</label>${chk("autoRepair", "Repair missing ledgers automatically")}${chk("speakerRead", "Mark who speaks the lines a reply left without speaker marks (a quiet model call after the reply)")}${chk("formatAid", "Show the model last turn's ledger as a format example")}${chk("debug", "Debug logging")}`)}
${set("chronicle", "book", "#5fcfc0", "Chronicle", `${s.chronicle ? `${s.summaryDetail ?? "detailed"} · ${s.chronicleInject === "relevant" ? "only when relevant" : "the whole story"} · ${s.rawTail} raw` : "off"}`, `${chk("chronicle", "Summarise old turns into chapters, arcs and volumes")}${chk("hideCovered", "Hide covered turns")}<label class="f">Summaries in the prompt${sel("chronicleInject", [["all", "the whole story, every turn"], ["relevant", "only when relevant"]])}</label><p class="muted"><small><b>The whole story</b> puts every stretch before the raw tail in each prompt, once, at its most compact level, and brings back a folded chapter in full when a turn touches it. <b>Only when relevant</b> sends the latest chapter and up to three earlier ones that share names, places or other distinctive words with the turn: fewer tokens, but the model forgets what isn't picked.</small></p><div class="almx-g2"><label class="f">Raw tail (messages)${num("rawTail", 6, 400)}</label><label class="f">Raw tail cap (tokens)${num("rawTailTokens", 1000)}</label><label class="f">Chapter size (tokens)${num("chapterThresholdTokens", 1000)}</label><label class="f">Fan-in${num("fanIn", 2, 12)}</label></div><label class="f">Summary detail${sel("summaryDetail", [["brief", "brief — the essentials (≈100–200 words a chapter)"], ["standard", "standard — facts and changes (≈150–350)"], ["detailed", "detailed — scene by scene, where things stand (≈350–650)"], ["exhaustive", "exhaustive — beats, texture, voices (≈700–1200)"]])}</label><label class="f">Always keep in summaries (optional)${txt("summaryFocus", "outfits, injuries, Buffy's lies, pet names…")}</label><p class="muted"><small>More detail keeps more of the story in memory, at the cost of prompt tokens. New chapters use the new setting; <b>Rewrite all</b> on the Chronicle page redoes the old ones.</small></p><label class="f">Summariser connection${conn("summarizerConnection", "your default connection")}</label>`)}
${set("knowledge", "eye", "#ff8fa3", "Knowledge", `clerk ${s.knowledgeClerk === "off" ? "off" : s.knowledgeClerk === "always" ? "every reply" : "when needed"} · check ${s.replyCheck ?? "rules"}`, `<label class="f">Knowledge clerk${sel("knowledgeClerk", [["auto", "when a reply's lines need it (bundled, untagged, diary-like)"], ["always", "every reply"], ["off", "off"]])}</label><p class="muted"><small>After a reply, a quiet call rewrites its knowledge lines cleanly: one fact a line, the #keys in play, information rather than what someone noticed. It runs in the background; the next turn waits for it up to 8 seconds.</small></p><label class="f">Clerk connection${conn("clerkConnection", "same as the summariser")}</label>
${chk("secretsOffPage", "Keep secrets off the page when the model names words to avoid (<code>secret … | never say: …</code>)")}<p class="muted"><small>A secret you mark on the Knowledge page is always kept off the page until it comes out.</small></p>
<label class="f">Check each reply${sel("replyCheck", [["rules", "rules: secrets named, leaks, the dead or absent speaking, looks contradicted"], ["model", "rules, plus a quiet model read for past events the record doesn't hold"], ["off", "off"]])}</label><label class="f">Check connection${conn("replyCheckConnection", "same as the summariser")}</label>
<label class="f">Facts in your own messages${sel("playerFacts", [["rules", "rules: dates (\"it's day 12\"), looks (\"X has violet eyes\"), ((truth: …))"], ["model", "rules, plus a quiet model read of what you state"], ["off", "off"]])}</label><p class="muted"><small>What you state is your word: the story can't overwrite a look you set, and a date you give moves the clock, even backwards.</small></p>`)}
${set("size", "bars", "#ffc46b", "Prompt size", s.injectCeiling ? `ceiling ${Math.round(s.injectCeiling / 1000)}K tokens` : "no ceiling", `<p class="muted" style="margin:0 0 10px"><small>A ceiling for everything the Almanac adds: the note, recall, the mirror lorebook's cards and the chapter summaries. Over it, summaries narrow to the ones this turn touches, then the oldest go, then the lowest-ranked recall. The note and the latest chapter always go in. With a 32K model, try 8K.</small></p><div class="row" style="gap:6px">${[["8000", "8K"], ["16000", "16K"], ["24000", "24K"], ["48000", "48K"], ["0", "None"]].map(([n, lab]) => `<button class="btn sm grow${String(s.injectCeiling) === n ? " primary" : ""}" data-act="ceiling" data-id="${n}">${lab}</button>`).join("")}</div><label class="f" style="margin-top:10px">Exact ceiling (tokens; 0 = none)${num("injectCeiling", 0, 1000000)}</label>${v.feed?.[0]?.ceiling ? `<p class="muted"><small>Last turn: ≈${v.feed[0].ceiling.after} tokens${v.feed[0].ceiling.before > v.feed[0].ceiling.after ? ` (≈${v.feed[0].ceiling.before} before trimming)` : ""}.</small></p>` : v.feed?.[0] ? `<p class="muted"><small>Last turn: ≈${v.feed[0].tokens} tokens.</small></p>` : ""}`)}
${set("recall", "search", "#ffc46b", "Recall", `${Number(s.recallBudget).toLocaleString()} tokens · ${s.recallPlacement === "depth4" ? "4 messages from the end" : "before the chat"}`, `<label class="f">Note and recall budget (tokens)${num("recallBudget", 400, 20000)}</label><label class="f">Recall placement${sel("recallPlacement", [["before_history", "before chat history"], ["depth4", "4 messages from the end"]])}</label>${chk("keyHeat", "Demote keys that fire without being used")}<label class="f">Max keys per record${num("maxKeys", 4, 24)}</label><label class="f">Words never used as keys <small class="muted">— comma-separated</small><input type="text" data-list-setting="stopList" value="${e((s.stopList ?? []).join(", "))}" placeholder="house, door, tea"></label>`)}
${set("lore", "book", "#a99bff", "Lorebooks and mirror", `${s.loreDefaultMode} by default · mirror ${s.mirror}`, `<p class="muted" style="margin:0 0 10px"><small>The extension's storage is the source of truth (branch-safe, rebuildable). The mirror lorebook is a readable, editable projection attached to this chat only.</small></p><label class="f">Mirror lorebook${sel("mirror", [["off", "off"], ["summaries", "summaries"], ["full", "full records"]])}</label>${chk("mirrorVectorize", "Vectorise mirror entries (semantic recall; needs an embedding provider)")}<label class="f">Default activation for new books${sel("loreDefaultMode", [["native", "native"], ["assisted", "assisted"], ["managed", "managed"]])}</label><p class="muted"><small>Your lorebooks are only read, never written to (only the Lorebook Creator writes, and only where you tell it to).</small></p><label class="f">Lorebook Creator connection${conn("creatorConnection", "same as the summariser")}</label><p class="muted"><small>The model the Creator talks with and writes entries with. A capable model plans and writes better books.</small></p>`)}
${set("world", "moon", "#5fcfc0", "World and Elsewhere", `${elsewhereLab[s.elsewhere] ?? s.elsewhere} · ${s.elsewhereSeeding === "ask" ? "asks before new subplots" : s.elsewhereSeeding === "auto" ? "starts subplots itself" : "only your stories"}`, `<label class="f">Climate (default for new chats)${txt("climate", "temperate maritime")}</label><label class="f">Latitude${txt("latitude", "temperate / 51 N / southern subpolar")}</label><label class="f">Calendar${txt("calendar", "Westeros · Roshar · Harptos · Shire Reckoning · or months: Name (30), …; weekdays: …")}</label><label class="f">Elsewhere: the world off the page${sel("elsewhere", [["off", "off"], ["quiet", "quiet: a little, mostly on time jumps"], ["living", "living: subplots move, one crossing a scene"], ["restless", "restless: more subplots, more crossings"]])}</label><label class="f">New subplots from the story and lorebooks${sel("elsewhereSeeding", [["ask", "propose them: I accept or decline each"], ["auto", "start them on their own"], ["off", "off: only stories I write"]])}</label><label class="f">Telling${sel("elsewhereTelling", [["model", "the model tells each step (one quiet call)"], ["engine", "the engine's own words (no model calls)"]])}</label><label class="f">Canon gravity${sel("canonGravity", [["light", "light: a lore forecast may ground a subplot"], ["strong", "strong: forecasts run toward canon unless the story diverged"], ["off", "off: only the chat and the lore"]])}</label><label class="f">Irreversible endings off the page${sel("fates", [["ask", "ask me first"], ["page", "only on the page"], ["allow", "allow"]])}</label><label class="f">Step (minutes of story time)${num("simStep", 30, 10000)}</label><label class="f">Elsewhere connection${conn("simConnection", "your default connection")}</label>${chk("pressures", "Hidden pressures for new characters")}${chk("chekhov", "Chekhov nudges for unused plants")}${chk("telemetry", "Craft notes")}`)}
${set("director", "film", "#c2c9de", "Director", `planner timeout ${s.sidecarTimeout} s`, `<p class="muted" style="margin:0 0 10px"><small>Used when the preset's Director's Pass channel is set to Sidecar.</small></p><label class="f">Planner connection${conn("sidecarConnection", "your default connection")}</label><label class="f">Planner timeout (seconds)${num("sidecarTimeout", 5, 90)}</label>`)}
${sec("Look")}<div class="card"><div class="almx-skins">${`<button type="button" data-act="setting" data-key="theme" data-id="preset" aria-pressed="${s.theme === "preset"}"><span><i style="background:conic-gradient(#ff8fa3,#ffc46b,#5fcfc0,#a99bff,#ff8fa3)"></i></span>By genre</button>`}${look}</div>
<div class="almx-lbl" style="margin-top:14px">Light or dark</div><div style="margin-top:6px">${toggle("setting", s.skinMode ?? "auto", [["auto", "Follow Lumiverse", 'data-key="skinMode"'], ["light", "Light", 'data-key="skinMode"'], ["dark", "Dark", 'data-key="skinMode"']], "Light or dark")}</div>
${this.skinColors(v)}${chk("fonts", "Load the skins' web fonts from Google Fonts (your browser contacts Google)")}${chk("hud", "Floating Now widget")}${this.hudProblem === "permission" ? `<div class="almx-row"><span class="muted grow">The floating widget needs the <b>ui_panels</b> permission.</span><button class="btn sm" data-act="grantPanels">Grant</button></div>` : this.hudProblem ? `<p class="muted">The floating widget could not open: ${e(this.hudProblem)}</p>` : ""}${chk("narratorOnlyToTools", "Let LLM tools see narrator-only records")}</div>
<p class="muted" style="margin:14px 0 0;text-align:center"><small>ALMANAC Ledger ${VERSION}${v.version && v.version !== VERSION ? ` · background process ${e(v.version)}` : ""}</small></p>`;
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
    if (hist?.dataset.sec) {
      if (hist.open) this.openSecs.delete(hist.dataset.sec);
      else this.openSecs.add(hist.dataset.sec);
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
      case "castOpen": if (!id) break; if (this.castOpen.has(id)) this.castOpen.delete(id); else this.castOpen.add(id); this.render(); break;
      case "graphAxis": this.graphAxis = id ?? ""; this.render(); break;
      case "codexKind": this.codexKind = id ?? ""; this.render(); break;
      case "loreMode": {
        const book = (t.closest("[data-book]") as HTMLElement | null)?.dataset.book;
        if (book && id) {
          this.send({ type: "lore", action: "mode", bookId: book, value: id });
          if (this.view?.lore?.books?.[book]) this.view.lore.books[book].mode = id;
          this.render();
        }
        break;
      }
      case "setting": {
        const key = (t.closest("[data-key]") as HTMLElement | null)?.dataset.key;
        if (!key || id == null) break;
        this.send({ type: "settings", patch: { [key]: id } });
        if (this.view) this.view.settings[key] = id;
        this.ctx.events.emit("almanac:settings", { [key]: id });
        this.render();
        break;
      }
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
