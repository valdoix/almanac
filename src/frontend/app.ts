// The "Almanac" drawer tab, with Orrery navigation (see orrery.ts): Now, and
// People (Cast · Bonds · Knowledge), Story (Chronicle · Timeline · World),
// Library (Codex · Lore · Creator) and Engine (Recall · Craft · Settings).

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { escapeHtml as e, initials, kpNote } from "../core/util";
import { renderGraph, type GEdge, type GNode } from "./graph";
import { CreatorUI } from "./creator-ui";
import { VERSION } from "../core/version";
import { PAGES, dock, emptySky, pageTitle, skyHeader, type Page } from "./orrery";

type Tab = Page;
const TABS = PAGES;

export class AlmanacApp {
  ctx: SpindleFrontendContext;
  root: HTMLElement;
  view: any = null;
  tab: Tab = "now";
  asOf = Infinity;
  graphAxis = "";
  npcOnly = false;
  codexFilter = "";
  codexKind = "";
  editing: string | null = null;
  orbit = "";
  creator: CreatorUI;
  status: "nochat" | "waiting" | "stalled" | "ok" = "nochat";
  hudProblem = "";
  versionWarning = "";

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
    this.root.addEventListener("click", (ev) => this.onClick(ev));
    this.root.addEventListener("change", (ev) => this.onChange(ev));
    this.root.addEventListener("keydown", (ev) => {
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
    const banner = !v.enabled
      ? `<div class="card flat"><b>The Ledger is not active in this chat.</b><p class="muted">It switches on by itself when the ALMANAC preset is in use (or a reply contains a &lt;ledger&gt; block). You can also turn it on here.</p><button class="btn primary" data-act="enable">Turn on for this chat</button></div>`
      : "";
    const scroll = this.root.scrollTop;
    this.root.innerHTML = `<div class="almo${this.orbit ? " orbiting" : ""}">${skyHeader(v, this.tab)}<main class="almo-body">${pageTitle(v, this.tab)}${stale}${banner}${body}</main>${dock(v, this.tab, this.orbit)}</div>`;
    this.root.scrollTop = scroll;
  }

  go(page: Tab) {
    const changed = page !== this.tab;
    this.tab = page;
    this.orbit = "";
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
${c.activity ? `<div class="alm-cc__row"><b>doing</b>${e(c.activity)}</div>` : ""}${!compact && c.look ? `<div class="alm-cc__row"><b>look</b>${e(c.look)}</div>` : ""}${!compact && c.place ? `<div class="alm-cc__row"><b>where</b>${e(c.place)}</div>` : ""}
</div></article>`;
  }

  tab_cast(v: any): string {
    return `<div class="list">${v.cast.map((c: any) => `<div class="card">
<div class="row"><span class="alm-mini" style="--c:${e(c.color)}">${e(initials(c.name))}</span><b class="grow">${e(c.name)}${c.aliases?.length ? ` <small class="muted">(${e(c.aliases.join(", "))})</small>` : ""}</b><span class="pill">slot ${c.slot}</span>${c.isUser ? "" : `<input type="color" class="swatch" data-color="${e(c.id)}" value="${e(toHex(c.color))}" title="Voice colour">`}</div>
${this.castCard(c)}
${c.journal?.length ? `<h4>In their own words</h4>${c.journal.map((j: any) => `<div class="muted">“${e(j.text)}”</div>`).join("")}` : ""}
${c.isUser ? "" : `<h4>Hidden pressure (narrator-only)</h4><div class="row"><span class="spoiler grow" tabindex="0">${e(c.pressure || "— none drawn yet —")}</span><button class="btn" data-act="editPressure" data-id="${e(c.id)}">edit</button></div>`}
${this.mergeRow(v, c)}
</div>`).join("") || `<div class="empty">No one has appeared yet.</div>`}</div>`;
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
    if (!v.knowledge.length) return `<div class="empty">No knowledge recorded yet. The model records it with <code>know</code> lines.</div>`;
    const people = v.cast.filter((c: any) => !c.dead);
    const byId = new Map(people.map((c: any) => [c.id, c]));
    const cards = [...v.knowledge].reverse().map((f: any) => {
      const holders = f.holders.filter((h: any) => h.status !== "unaware");
      const unaware = people.filter((c: any) => !holders.some((h: any) => h.id === c.id)).map((c: any) => (c.isUser ? v.names?.user || c.name : c.name));
      const chips = holders.map((h: any) => {
        const c: any = byId.get(h.id);
        const wrong = h.status === "wrong" || (h.status !== "knows" && f.truth === "false");
        const cls = wrong ? "wrong" : h.status === "knows" ? "knows" : "sus";
        return `<div class="almk-h"><span class="alm-mini" style="--c:${e(c?.color ?? "#888")}">${e(initials(h.name))}</span><div class="almk-h__b"><b>${e(h.name)}</b> <span class="alm-kp ${cls}">${wrong ? "✗ wrong" : h.status === "knows" ? "✓ knows" : `? ${e(h.status)}`}</span>${h.source ? kpNote(h.source) : ""}</div></div>`;
      }).join("");
      const truth = f.truth !== "unknown" ? `<span class="pill${f.truth === "false" ? " warn" : ""}">${e(f.truth)}</span>` : "";
      return `<div class="card flat almk"><div class="almk-q"><span class="grow">${e(f.fact)}</span>${truth}</div>${chips || `<div class="muted">No one knows this yet.</div>`}${unaware.length ? `<div class="almk-un">unaware: ${e(unaware.slice(0, 8).join(", "))}${unaware.length > 8 ? "…" : ""}</div>` : ""}</div>`;
    }).join("");
    const irony = v.knowledge.filter((f: any) => f.truth === "false" && f.holders.some((h: any) => h.status !== "unaware")).slice(0, 3);
    return `${irony.map((f: any) => `<div class="alm-irony"><span class="i">🎭</span><span><b>Dramatic irony:</b> ${e(f.holders.filter((h: any) => h.status !== "unaware").map((h: any) => h.name).join(", "))} ${f.holders.filter((h: any) => h.status !== "unaware").length > 1 ? "are" : "is"} certain that “${e(f.fact)}”, which isn't true.</span></div>`).join("")}<div class="list">${cards}</div>`;
  }

  tab_codex(v: any): string {
    const kinds = [...new Set(v.codex.map((r: any) => r.kind))] as string[];
    const q = this.codexFilter.toLowerCase();
    const recs = v.codex.filter((r: any) => (!this.codexKind || r.kind === this.codexKind) && (!q || `${r.name} ${r.summary} ${r.keys.join(" ")}`.toLowerCase().includes(q)));
    return `<div class="row"><input type="text" placeholder="Search the Codex…" data-set="codexFilter" value="${e(this.codexFilter)}" class="grow"><select data-set="codexKind"><option value="">all kinds</option>${kinds.map((k) => `<option${k === this.codexKind ? " selected" : ""}>${e(k)}</option>`).join("")}</select></div>
<p class="muted">${recs.length} of ${v.codex.length} records. Edits lock a record so the archivist never overwrites it. Keys are real retrieval keys.</p>
<div class="list">${recs.slice(0, 200).map((r: any) => this.editing === r.id ? this.codexEditor(r) : `<div class="rec"><div class="hd"><span class="kind">${e(r.kind)}</span><b class="grow">${e(r.name)}</b>${r.locked ? `<span class="pill">🔒 locked</span>` : ""}${r.narratorOnly ? `<span class="pill">narrator-only</span>` : ""}<span class="pill">${e(r.source)}</span><button class="btn" data-act="edit" data-id="${e(r.id)}">edit</button></div><div>${e(r.summary)}</div>${r.keys.length ? `<div>${r.keys.map((k: string) => `<span class="pill">${e(k)}</span>`).join("")}</div>` : ""}${r.body?.divergedNote ? `<div class="alm-tag warn">moved past: ${e(r.body.divergedNote)}</div>` : ""}</div>`).join("")}</div>
<details><summary class="muted">Add a record or a correction</summary><div class="card flat"><label class="f">New record name<input type="text" id="almNewName"></label><label class="f">Kind<select id="almNewKind">${["person", "place", "object", "group", "law", "texture", "history", "situation"].map((k) => `<option>${k}</option>`).join("")}</select></label><label class="f">Summary<textarea id="almNewSummary"></textarea></label><button class="btn primary" data-act="newRecord">Add record</button>
<h4>Correct the state with ledger lines</h4><textarea id="almOps" placeholder="bond Mara>Kael: trust -1 — she caught him lying&#10;item Locket: Mara → Kael — stolen back"></textarea><button class="btn" data-act="userOps">Record correction</button></div></details>`;
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
    const cov = v.chronicle.coverage;
    const units = [...v.chronicle.units].sort((a: any, b: any) => b.startIdx - a.startIdx);
    return `<div class="card flat"><h4>Coverage</h4><div class="bar"><i style="width:${cov.volume}%;background:#7b5bd6"></i><i style="width:${cov.arc}%;background:var(--alm-accent-2)"></i><i style="width:${cov.chapter}%;background:var(--alm-accent)"></i><i style="width:${cov.raw}%;background:var(--alm-line)"></i></div>
<div class="row muted"><small>volumes ${cov.volume}% · arcs ${cov.arc}% · chapters ${cov.chapter}% · raw ${cov.raw}%</small></div>
<p class="muted">Old turns are summarised at scene boundaries, hidden, and replaced in the prompt by their chapter. The last ${v.settings.rawTail} messages always stay raw.</p>
<div class="row"><span class="muted grow"><small>Detail: <b>${e(v.settings.summaryDetail ?? "detailed")}</b> (change it in Settings)</small></span><button class="btn" data-act="chronicleRewrite" title="Redo every unlocked chapter, arc and volume at the current detail">Rewrite all</button><button class="btn primary" data-act="chronicleRun">Summarise now</button></div></div>
<div class="list">${units.map((u: any) => `<div class="rec"><div class="hd"><span class="kind">${e(u.level)} ${u.no}</span><b class="grow">${e(u.title)}</b>${u.locked ? `<span class="pill">🔒</span>` : ""}${u.ghost ? `<span class="pill">ghost</span>` : ""}${u.stale ? `<span class="pill">stale</span>` : ""}${u.detail ? `<span class="pill">${e(u.detail)}</span>` : ""}</div>
<div class="muted"><small>messages ${u.startIdx + 1}–${u.endIdx + 1}${u.storyStart ? ` · ${e(u.storyStart)}${u.storyEnd && u.storyEnd !== u.storyStart ? ` – ${e(u.storyEnd)}` : ""}` : ""}</small></div>
<details><summary class="muted">read / edit</summary><textarea data-unit="${e(u.id)}" style="min-height:140px">${e(u.text)}</textarea><div class="row"><button class="btn" data-act="unitSave" data-id="${e(u.id)}">Save</button><button class="btn" data-act="unitLock" data-id="${e(u.id)}">${u.locked ? "Unlock" : "Lock"}</button><button class="btn" data-act="unitGhost" data-id="${e(u.id)}">${u.ghost ? "Unghost" : "Ghost"}</button><button class="btn" data-act="unitRegen" data-id="${e(u.id)}">Regenerate</button><button class="btn danger" data-act="unitUnhide" data-id="${e(u.id)}">Unhide span</button></div></details></div>`).join("") || `<div class="empty">No chapters yet. They appear once enough scenes have scrolled past the raw tail.</div>`}</div>`;
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
${w.canon.length ? `<h4>Minted canon</h4><ul class="alm-list">${w.canon.map((c: any) => `<li>${e(c.text)}</li>`).join("")}</ul>` : ""}
<div class="row" style="margin-top:10px"><button class="btn" data-act="simulate">⏭ Run the off-screen world now</button></div>`;
  }

  tab_lore(v: any): string {
    const books = Object.entries(v.lore.books ?? {});
    return `<p class="muted">The Lore Bridge reads the character, persona, chat and global lorebooks into the Codex. Your books are never edited unless you allow it.</p>
<div class="row"><button class="btn primary" data-act="loreScan">Re-read lorebooks</button>${v.lore.review?.length ? `<button class="btn" data-act="loreClassify">Classify ${v.lore.review.length} unclear entries with the model</button>` : ""}<button class="btn" data-act="mirrorSync">Sync mirror book</button></div>
<div class="list" style="margin-top:10px">${books.map(([id, b]: any) => `<div class="rec"><div class="hd"><b class="grow">${e(b.name)}</b><span class="pill">${e(b.scope)}</span><span class="pill">${b.count} entries</span></div>
<div class="row"><label class="f grow">Activation<select data-lore-mode="${e(id)}">${["native", "assisted", "managed"].map((m) => `<option value="${m}"${m === b.mode ? " selected" : ""}>${m}</option>`).join("")}</select></label><label class="f grow">Permission<select data-lore-perm="${e(id)}">${["read", "overlay", "write"].map((m) => `<option value="${m}"${m === b.permission ? " selected" : ""}>${m === "read" ? "read-only" : m}</option>`).join("")}</select></label></div></div>`).join("") || `<div class="empty">No lorebooks are attached to this chat.</div>`}</div>
<p class="muted"><b>Native</b>: your keywords decide; the Ledger only annotates lore the story has moved past. <b>Assisted</b>: plus the entries Recall picks. <b>Managed</b>: the Ledger is the only retrieval owner for that book.</p>
${v.lore.review?.length ? `<h4>Review queue</h4><ul class="alm-list">${v.lore.review.slice(0, 40).map((r: any) => `<li>${e(r.title)} — read as <b>${e(r.kind)}</b> (${Math.round(r.confidence * 100)}%)</li>`).join("")}</ul>` : ""}`;
  }

  tab_creator(v: any): string {
    return this.creator.render(v);
  }

  tab_recall(v: any): string {
    const f = v.feed?.[0];
    return `<p class="muted">What Recall considered for the latest generation, with scores and reasons. Green = injected.</p>
${f ? `<div class="card flat"><div class="row"><span class="pill">tier: ${e(f.tier)}</span><span class="pill">≈ ${f.tokens} tokens injected</span><span class="pill">${new Date(f.at).toLocaleTimeString()}</span></div>
<div class="feed">${f.items.map((i: any) => `<div class="it${i.injected ? " in" : ""}"><span class="sc">${i.score}</span><div><b>${e(i.name)}</b> <small class="muted">${e(i.id)}</small><br><small class="muted">${e(i.reasons.join(" · "))}</small></div></div>`).join("")}</div></div>` : `<div class="empty">No retrieval yet.</div>`}
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
    return `<h3>This chat</h3><div class="card flat"><div class="row"><span class="grow">Ledger in this chat: <b>${v.enabled ? "on" : "off"}</b>${v.config.enabledOverride == null ? " (automatic)" : ""}</span><button class="btn" data-act="enable">On</button><button class="btn" data-act="disable">Off</button><button class="btn" data-act="auto">Automatic</button></div></div>
<h3>Core</h3><div class="card flat"><label class="f">Enable<select data-setting="enabled"><option value="auto"${s.enabled === "auto" ? " selected" : ""}>automatic (ALMANAC chats)</option><option value="on"${s.enabled === "on" ? " selected" : ""}>every chat</option><option value="off"${s.enabled === "off" ? " selected" : ""}>off</option></select></label>
<label class="f">Validation${sel("strictness", [["strict", "strict — reject impossible changes"], ["lenient", "lenient — warn only"]])}</label>${chk("autoRepair", "Repair missing ledgers automatically")}${chk("formatAid", "Show the model last turn's ledger as a format example")}${chk("debug", "Debug logging")}</div>
<h3>Chronicle</h3><div class="card flat">${chk("chronicle", "Summarise old turns into chapters, arcs and volumes")}${chk("hideCovered", "Hide covered turns")}<label class="f">Raw tail (messages)${num("rawTail", 6, 400)}</label><label class="f">Raw tail cap (tokens)${num("rawTailTokens", 1000)}</label><label class="f">Chapter size (tokens)${num("chapterThresholdTokens", 1000)}</label><label class="f">Fan-in (chapters per arc, arcs per volume)${num("fanIn", 2, 12)}</label><label class="f">Summary detail${sel("summaryDetail", [["brief", "brief — the essentials (≈100–200 words a chapter)"], ["standard", "standard — facts and changes (≈150–350)"], ["detailed", "detailed — scene by scene, where things stand (≈350–650)"], ["exhaustive", "exhaustive — beats, texture, voices (≈700–1200)"]])}</label><label class="f">Always keep in summaries (optional)${txt("summaryFocus", "outfits, injuries, Buffy's lies, pet names…")}</label><p class="muted">More detail keeps more of the story in memory, at the cost of prompt tokens. New chapters use the new setting; <b>Rewrite all</b> on the Chronicle page redoes the old ones.</p><label class="f">Summariser connection id (empty = your default)${txt("summarizerConnection")}</label></div>
<h3>Recall</h3><div class="card flat"><label class="f">Injection budget (tokens)${num("recallBudget", 400, 20000)}</label><label class="f">Recall placement${sel("recallPlacement", [["before_history", "before chat history"], ["depth4", "4 messages from the end"]])}</label>${chk("keyHeat", "Demote keys that fire without being used")}<label class="f">Max keys per record${num("maxKeys", 4, 24)}</label></div>
<h3>Storage (hybrid)</h3><div class="card flat"><p class="muted">The extension's storage is the source of truth (branch-safe, rebuildable). The mirror lorebook is a readable, editable projection attached to this chat only.</p><label class="f">Mirror lorebook${sel("mirror", [["off", "off"], ["summaries", "summaries"], ["full", "full records"]])}</label>${chk("mirrorVectorize", "Vectorise mirror entries (semantic recall; needs an embedding provider)")}</div>
<h3>Lore bridge</h3><div class="card flat"><label class="f">Default activation for new books${sel("loreDefaultMode", [["native", "native"], ["assisted", "assisted"], ["managed", "managed"]])}</label><label class="f">Default permission${sel("lorePermission", [["read", "read-only"], ["overlay", "overlay"], ["write", "read + write"]])}</label></div>
<h3>World engines</h3><div class="card flat"><label class="f">Climate (default for new chats)${txt("climate", "temperate maritime")}</label><label class="f">Latitude${txt("latitude", "temperate / 51 N / southern subpolar")}</label><label class="f">Calendar${txt("calendar", "Westeros · Roshar · Harptos · Shire Reckoning · or months: Name (30), …; weekdays: …")}</label>${chk("simulator", "Off-screen simulator (one model call when story time advances)")}<label class="f">Simulator step (minutes of story time)${num("simStep", 30, 10000)}</label><label class="f">Simulator connection id${txt("simConnection")}</label>${chk("pressures", "Hidden pressures for new characters")}${chk("chekhov", "Chekhov nudges for unused plants")}${chk("telemetry", "Craft telemetry")}</div>
<h3>Director</h3><div class="card flat"><p class="muted">Used when the preset's Director's Pass channel is set to Sidecar.</p><label class="f">Planner connection id${txt("sidecarConnection")}</label><label class="f">Planner timeout (seconds)${num("sidecarTimeout", 5, 90)}</label></div>
<p class="muted" style="margin:14px 0 0">ALMANAC Ledger ${VERSION}${v.version && v.version !== VERSION ? ` · background process ${e(v.version)}` : ""}</p><h3>Look</h3><div class="card flat"><label class="f">Skin${sel("theme", [["preset", "follow the preset (Auto by genre)"], ["almanac", "Almanac"], ["solar", "Solar Editorial"], ["nocturne", "Nocturne"], ["botanical", "Botanical"], ["prism", "Prism"], ["candy", "Candy"]])}</label>${chk("fonts", "Load the ALMANAC web fonts (Google Fonts)")}${chk("hud", "Floating Now widget")}${this.hudProblem === "permission" ? `<div class="row"><span class="muted grow">The floating widget needs the <b>ui_panels</b> permission.</span><button class="btn" data-act="grantPanels">Grant</button></div>` : this.hudProblem ? `<p class="muted">The floating widget could not open: ${e(this.hudProblem)}</p>` : ""}${chk("narratorOnlyToTools", "Let LLM tools see narrator-only records")}</div>`;
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  onClick(ev: Event) {
    const t = ev.target as HTMLElement;
    const pageBtn = t.closest("[data-page]") as HTMLElement | null;
    if (pageBtn) {
      this.go(pageBtn.dataset.page as Tab);
      return;
    }
    const planet = t.closest("[data-orbit]") as HTMLElement | null;
    if (planet) {
      this.orbit = this.orbit === planet.dataset.orbit ? "" : planet.dataset.orbit!;
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
      case "auto": this.send({ type: "enable", value: null }); break;
      case "sessionZero": this.ctx.events.emit("almanac:sessionZero", { chatId: this.view?.chatId }); break;
      case "repairLast": this.send({ type: "repairLast" }); break;
      case "rebuild": this.send({ type: "rebuild" }); break;
      case "retryState": this.ctx.events.emit("almanac:retryState", {}); break;
      case "grantPanels": this.ctx.events.emit("almanac:grantPanels", {}); break;
      case "edit": this.editing = id ?? null; this.render(); break;
      case "cancelEdit": this.editing = null; this.render(); break;
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
      case "loreClassify": this.send({ type: "lore", action: "classify" }); break;
      case "mirrorSync": this.send({ type: "mirrorSync" }); break;
      case "simulate": this.send({ type: "simulate" }); break;
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
    if (d.lorePerm) this.send({ type: "lore", action: "permission", bookId: d.lorePerm, value: t.value });
  }
}

function toHex(c: string): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? c : "#888888";
}
