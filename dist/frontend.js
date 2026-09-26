// src/core/util.ts
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function initials(name) {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/);
  if (!parts[0])
    return "?";
  return (parts[0][0] ?? "?").toUpperCase();
}

// src/frontend/graph.ts
var DOMINANT_COLORS = {
  trust: "#3f9a62",
  affection: "#e05a8a",
  respect: "#4f7ab0",
  familiarity: "#8a8a8a",
  comfort: "#6bb3a0",
  attraction: "#ff6fa8",
  fear: "#7b5bd6",
  resentment: "#cc4a4a",
  obligation: "#c58a22",
  rivalry: "#e07b30"
};
function edgeAsOf(edge, msgIndex) {
  if (msgIndex === Infinity)
    return edge.axes;
  const out = {};
  for (const h of edge.history)
    if (h.msgIndex <= msgIndex)
      out[h.axis] = h.to;
  return out;
}
function layout(nodes, edges, w = 640, h = 360) {
  const pos = {};
  nodes.forEach((n, i) => {
    const a = i / Math.max(1, nodes.length) * Math.PI * 2;
    pos[n.id] = { x: w / 2 + Math.cos(a) * w * 0.3, y: h / 2 + Math.sin(a) * h * 0.3, vx: 0, vy: 0 };
  });
  for (let it = 0;it < 260; it++) {
    for (const a of nodes)
      for (const b of nodes) {
        if (a.id >= b.id)
          continue;
        const pa = pos[a.id], pb = pos[b.id];
        let dx = pa.x - pb.x, dy = pa.y - pb.y;
        const d2 = Math.max(80, dx * dx + dy * dy);
        const f = 26000 / d2;
        const d = Math.sqrt(d2);
        dx /= d;
        dy /= d;
        pa.vx += dx * f;
        pa.vy += dy * f;
        pb.vx -= dx * f;
        pb.vy -= dy * f;
      }
    for (const ed of edges) {
      const pa = pos[ed.from], pb = pos[ed.to];
      if (!pa || !pb)
        continue;
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = (d - 190) * 0.012;
      pa.vx += dx / d * f;
      pa.vy += dy / d * f;
      pb.vx -= dx / d * f;
      pb.vy -= dy / d * f;
    }
    for (const n of nodes) {
      const p = pos[n.id];
      p.vx += (w / 2 - p.x) * 0.004;
      p.vy += (h / 2 - p.y) * 0.006;
      p.x += Math.max(-12, Math.min(12, p.vx));
      p.y += Math.max(-12, Math.min(12, p.vy));
      p.vx *= 0.55;
      p.vy *= 0.55;
      p.x = Math.max(44, Math.min(w - 44, p.x));
      p.y = Math.max(40, Math.min(h - 46, p.y));
    }
  }
  return Object.fromEntries(Object.entries(pos).map(([k, v]) => [k, { x: v.x, y: v.y }]));
}
function renderGraph(nodes, edges, opts) {
  const w = 640, h = 360;
  const es = edges.map((ed) => ({ ...ed, cur: edgeAsOf(ed, opts.asOf) })).filter((ed) => Object.keys(ed.cur).length).filter((ed) => !opts.npcOnly || ed.from !== "user" && ed.to !== "user").filter((ed) => !opts.filterAxis || ed.cur[opts.filterAxis] != null);
  const used = new Set(es.flatMap((x) => [x.from, x.to]));
  const ns = nodes.filter((n) => used.has(n.id) || n.spot);
  if (!ns.length)
    return `<div class="empty">No relationships recorded${opts.asOf !== Infinity ? " yet at this point" : ""}.</div>`;
  const pos = layout(ns, es, w, h);
  const defs = [`<marker id="almar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker>`];
  const paths = [];
  const labels = [];
  es.forEach((ed, i) => {
    const a = pos[ed.from], b = pos[ed.to];
    if (!a || !b)
      return;
    const axis = opts.filterAxis ?? Object.entries(ed.cur).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0]?.[0] ?? "trust";
    const mag = Math.abs(ed.cur[axis] ?? 0);
    const color = DOMINANT_COLORS[axis] ?? "#888";
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len, ny = dx / len;
    const bend = 26;
    const sx = a.x + dx / len * 30, sy = a.y + dy / len * 30;
    const ex = b.x - dx / len * 32, ey = b.y - dy / len * 32;
    const cx = (a.x + b.x) / 2 + nx * bend, cy = (a.y + b.y) / 2 + ny * bend;
    const d = `M${sx.toFixed(1)},${sy.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
    const neg = (ed.cur[axis] ?? 0) < 0;
    paths.push(`<path d="${d}" stroke="${color}" stroke-width="${(1.4 + mag * 0.55).toFixed(1)}" fill="none" stroke-linecap="round" marker-end="url(#almar)"${neg ? ' stroke-dasharray="6 5"' : ""} opacity=".9"><title>${escapeHtml(ed.from)} → ${escapeHtml(ed.to)}</title></path>`);
    if (ed.changedNow && opts.asOf === Infinity)
      paths.push(`<path class="spark" d="${d}" fill="none"/>`);
    const txt = Object.entries(ed.cur).filter(([, v]) => v).slice(0, 2).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(" · ") + (ed.label ? ` · ${ed.label}` : "");
    labels.push(`<text class="lbl" x="${cx.toFixed(0)}" y="${(cy + (i % 2 ? 12 : -6)).toFixed(0)}" text-anchor="middle">${escapeHtml(txt.slice(0, 42))}</text>`);
  });
  const circles = ns.map((n, i) => {
    const p = pos[n.id];
    defs.push(`<radialGradient id="almn${i}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${n.color}" stop-opacity=".55"/><stop offset=".6" stop-color="${n.color}"/></radialGradient>`);
    return `${n.spot ? `<circle cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="34" fill="${n.color}" opacity=".16"/>` : ""}<circle cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="24" fill="url(#almn${i})" stroke="var(--alm-panel)" stroke-width="3"/><text class="ini" x="${p.x.toFixed(0)}" y="${(p.y + 5).toFixed(0)}" text-anchor="middle">${escapeHtml(initials(n.name))}</text><text class="nm" x="${p.x.toFixed(0)}" y="${(p.y + 42).toFixed(0)}" text-anchor="middle">${escapeHtml(n.name)}</text>`;
  });
  return `<svg class="graph" viewBox="0 0 ${w} ${h}" role="img" aria-label="Relationship graph"><defs>${defs.join("")}</defs><g>${paths.join("")}</g><g>${labels.join("")}</g><g>${circles.join("")}</g></svg>
<div class="row" style="margin-top:6px">${Object.entries(DOMINANT_COLORS).map(([k, c]) => `<span class="pill"><i style="display:inline-block;width:10px;height:3px;background:${c}"></i>${k}</span>`).join("")}<span class="pill">┄ negative</span><span class="pill">✦ changed now</span></div>`;
}

// src/frontend/creator-ui.ts
class CreatorUI {
  ctx;
  getView;
  rerender;
  step = "source";
  mode = "quick";
  sourceKind = "text";
  sourceText = "";
  bookId = "";
  notes = "";
  plan = [];
  entries = [];
  issues = {};
  fixes = {};
  report = null;
  activation = null;
  scene = "";
  busy = "";
  progress = "";
  books = [];
  error = "";
  written = null;
  health = null;
  rid = 0;
  pending = new Map;
  constructor(ctx, getView, rerender) {
    this.ctx = ctx;
    this.getView = getView;
    this.rerender = rerender;
  }
  handle(m) {
    if (m?.type === "creatorProgress") {
      this.progress = `${m.done}/${m.total}`;
      this.rerender();
      return true;
    }
    if ((m?.type === "creator" || m?.type === "books" || m?.type === "bookHealth") && this.pending.has(m.rid)) {
      this.pending.get(m.rid)(m);
      this.pending.delete(m.rid);
      return true;
    }
    return false;
  }
  call(payload) {
    const rid = ++this.rid;
    return new Promise((resolve) => {
      this.pending.set(rid, resolve);
      this.ctx.sendToBackend({ ...payload, rid, chatId: this.getView()?.chatId });
      setTimeout(() => {
        if (this.pending.has(rid)) {
          this.pending.delete(rid);
          resolve({ error: "timed out" });
        }
      }, 15 * 60000);
    });
  }
  source() {
    return { kind: this.sourceKind, text: this.sourceText, chatId: this.getView()?.chatId, bookId: this.bookId };
  }
  render(_v) {
    const busy = this.busy ? `<div class="card flat">⏳ ${escapeHtml(this.busy)} ${escapeHtml(this.progress)}</div>` : "";
    const err = this.error ? `<div class="alm-tag warn">${escapeHtml(this.error)}</div>` : "";
    if (this.step === "source") {
      return `${busy}${err}<p class="muted">Build a lorebook that follows VELLUM III conventions (labelled titles, first-sentence formulas, metadata), so the Ledger — and VELLUM III — read it exactly.</p>
<label class="f">Mode<select data-cr="mode">${[["quick", "⚡ Quick — plan and write"], ["guided", "\uD83E\uDD1D Guided — review the plan first"], ["suggest", "\uD83D\uDCCB Suggest entries from a premise"], ["parse", "\uD83D\uDCCB Parse raw lore"], ["category", "\uD83D\uDCCB Example entries for a category"]].map(([k, l]) => `<option value="${k}"${k === this.mode ? " selected" : ""}>${l}</option>`).join("")}</select></label>
<label class="f">Source<select data-cr="sourceKind">${[["text", "Text I paste"], ["character", "This chat's character card"], ["codex", "This chat's Codex (save the story so far)"], ["book", "An existing lorebook (upgrade)"]].map(([k, l]) => `<option value="${k}"${k === this.sourceKind ? " selected" : ""}>${l}</option>`).join("")}</select></label>
${this.sourceKind === "text" ? `<label class="f">Premise or lore<textarea data-cr="sourceText" style="min-height:140px">${escapeHtml(this.sourceText)}</textarea></label>` : ""}
${this.sourceKind === "book" ? `<label class="f">Lorebook<select data-cr="bookId"><option value="">choose…</option>${this.books.map((b) => `<option value="${escapeHtml(b.id)}"${b.id === this.bookId ? " selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}</select></label><div class="row"><button class="btn" data-cr-act="loadBooks">Load books</button>${this.bookId ? `<button class="btn" data-cr-act="health">Health check</button>` : ""}</div>${this.health ? this.renderHealth() : ""}` : ""}
<label class="f">Notes (optional)<input type="text" data-cr="notes" value="${escapeHtml(this.notes)}" placeholder="tone, era, what to emphasise"></label>
<button class="btn primary" data-cr-act="plan"${this.busy ? " disabled" : ""}>Plan the lorebook</button>`;
    }
    if (this.step === "plan") {
      return `${busy}${err}<h4>Plan · ${this.plan.length} entries</h4><p class="muted">Rename, remove or add entries. Titles use VELLUM III labels (Character:, Location:, CURRENT - …, Upcoming: …).</p>
<div class="list">${this.plan.map((p, i) => `<div class="rec"><div class="row"><input type="text" data-plan-title="${i}" value="${escapeHtml(p.title)}" class="grow"><input type="number" data-plan-pri="${i}" value="${p.priority ?? 100}" style="width:78px" title="priority"><label class="chk"><input type="checkbox" data-plan-const="${i}"${p.constant ? " checked" : ""}> const</label><button class="btn danger" data-cr-act="planDel" data-i="${i}">✕</button></div>${p.description ? `<div class="muted"><small>${escapeHtml(p.description)}</small></div>` : ""}</div>`).join("")}</div>
<div class="row" style="margin-top:8px"><button class="btn" data-cr-act="planAdd">+ Add entry</button><button class="btn" data-cr-act="back">Back</button><button class="btn primary" data-cr-act="generate"${this.busy ? " disabled" : ""}>Write ${this.plan.length} entries</button></div>`;
    }
    if (this.step === "entries" || this.step === "done") {
      const rep = this.report;
      return `${busy}${err}<h4>${this.entries.length} entries</h4>
${rep ? `<div class="card flat"><div class="kv"><b>Tokens</b><span>${rep.totalTokens} total · ${rep.constantTokens} constant per turn</span><b>Positions</b><span>${Object.entries(rep.positions).map(([k, n]) => `${k}: ${n}`).join(" · ")}</span><b>Links</b><span>${rep.link.edges.length} recursion links · ${rep.link.orphans.length} orphans · ${rep.link.loops.length} loops</span></div>${rep.link.mismatches.length ? `<div class="alm-tag warn">${escapeHtml(rep.link.mismatches.slice(0, 3).join(" · "))}</div>` : ""}${rep.link.suggestions.slice(0, 4).map((s) => `<div class="muted"><small>• ${escapeHtml(s)}</small></div>`).join("")}</div>` : ""}
<div class="list">${this.entries.map((en) => `<details class="rec"><summary><b>${escapeHtml(en.comment)}</b> <span class="pill">P${en.priority}</span> <span class="pill">pos ${en.position}${en.position === 4 ? "@" + en.depth : ""}</span>${en.constant ? `<span class="pill">const</span>` : ""}${this.issues[en.uid] ? `<span class="pill" style="color:var(--alm-danger)">${this.issues[en.uid].length} issue(s)</span>` : ""}</summary>
<textarea data-en-content="${en.uid}" style="min-height:90px">${escapeHtml(en.content)}</textarea><label class="f">Keys<input type="text" data-en-keys="${en.uid}" value="${escapeHtml(en.key.join(", "))}"></label>
${this.issues[en.uid] ? `<div class="alm-tag warn">${escapeHtml(this.issues[en.uid].join(" · "))}</div>` : ""}${this.fixes[en.uid] ? `<div class="muted"><small>auto-fixed: ${escapeHtml(this.fixes[en.uid].join(" · "))}</small></div>` : ""}
<div class="row"><button class="btn danger" data-cr-act="entryDel" data-uid="${en.uid}">Remove</button></div></details>`).join("")}</div>
<h4>Activation simulator</h4><textarea data-cr="scene" placeholder="Paste a sample scene to see which entries would fire…">${escapeHtml(this.scene)}</textarea><button class="btn" data-cr-act="simulate">Simulate</button>
${this.activation ? `<ul class="alm-list">${this.activation.map((a) => `<li>${escapeHtml(a.comment)} — <small class="muted">${escapeHtml(a.reason)}</small></li>`).join("") || "<li>Nothing fires.</li>"}</ul>` : ""}
<h4>Save</h4><div class="row"><input type="text" id="almCrName" placeholder="New lorebook name" class="grow"><select id="almCrAttach"><option value="none">don't attach</option><option value="character">attach to character</option><option value="persona">attach to persona</option><option value="chat">attach to this chat</option><option value="global">attach globally</option></select></div>
<label class="chk"><input type="checkbox" id="almCrBridge" checked> Read it into this chat's Codex now (Lore Bridge)</label>
<div class="row"><button class="btn primary" data-cr-act="writeNew">Create lorebook</button>${this.bookId ? `<button class="btn" data-cr-act="writeMerge">Merge into the source book</button>` : ""}<button class="btn" data-cr-act="export">Download JSON</button><button class="btn" data-cr-act="restart">Start over</button></div>
${this.written ? `<div class="card flat">✓ Saved: ${this.written.created} created, ${this.written.updated} updated.</div>` : ""}`;
    }
    return "";
  }
  renderHealth() {
    const h = this.health;
    return `<div class="card flat"><h4>Health check</h4><div class="muted">${h.constantTokens} constant tokens per turn</div><ul class="alm-list">${h.issues.slice(0, 40).map((i) => `<li class="${i.severity === "error" ? "due" : ""}">${escapeHtml(i.entry)}: ${escapeHtml(i.issue)}</li>`).join("") || "<li>No issues found.</li>"}</ul></div>`;
  }
  onChange(t) {
    const d = t.dataset;
    if (d.cr) {
      this[d.cr] = t.value;
      if (d.cr === "sourceKind" || d.cr === "bookId")
        this.rerender();
      return true;
    }
    if (d.planTitle != null) {
      this.plan[+d.planTitle].title = t.value;
      return true;
    }
    if (d.planPri != null) {
      this.plan[+d.planPri].priority = Number(t.value);
      return true;
    }
    if (d.planConst != null) {
      this.plan[+d.planConst].constant = t.checked;
      return true;
    }
    if (d.enContent != null) {
      const en = this.entries.find((x) => x.uid === +d.enContent);
      if (en)
        en.content = t.value;
      return true;
    }
    if (d.enKeys != null) {
      const en = this.entries.find((x) => x.uid === +d.enKeys);
      if (en)
        en.key = t.value.split(",").map((s) => s.trim()).filter(Boolean);
      return true;
    }
    return false;
  }
  onClick(t) {
    const el = t.closest("[data-cr-act]");
    if (!el)
      return false;
    const act = el.dataset.crAct;
    const root = el.closest(".almp");
    const run = async (label, fn) => {
      this.busy = label;
      this.progress = "";
      this.error = "";
      this.rerender();
      try {
        await fn();
      } catch (err) {
        this.error = String(err);
      }
      this.busy = "";
      this.rerender();
    };
    switch (act) {
      case "loadBooks":
        run("Loading books", async () => {
          this.books = (await this.call({ type: "books" })).books ?? [];
        });
        break;
      case "health":
        run("Checking", async () => {
          this.health = (await this.call({ type: "bookHealth", bookId: this.bookId })).result;
        });
        break;
      case "plan":
        run("Planning", async () => {
          const r = await this.call({ type: "creator", action: "plan", req: { mode: this.mode, source: this.source(), notes: this.notes } });
          if (r.error)
            throw new Error(r.error);
          this.plan = r.plan ?? [];
          if (this.mode === "quick" && this.plan.length) {
            this.busy = "Writing entries";
            this.rerender();
            await this.generate();
          } else
            this.step = "plan";
        });
        break;
      case "planDel":
        this.plan.splice(Number(el.dataset.i), 1);
        this.rerender();
        break;
      case "planAdd":
        this.plan.push({ title: "Character: New Name", priority: 150 });
        this.rerender();
        break;
      case "back":
        this.step = "source";
        this.rerender();
        break;
      case "generate":
        run("Writing entries", () => this.generate());
        break;
      case "entryDel":
        this.entries = this.entries.filter((x) => x.uid !== Number(el.dataset.uid));
        run("Relinking", async () => {
          this.report = (await this.call({ type: "creator", action: "report", entries: this.entries })).report;
        });
        break;
      case "simulate":
        run("Simulating", async () => {
          this.activation = (await this.call({ type: "creator", action: "simulate", entries: this.entries, scene: this.scene })).activation ?? [];
        });
        break;
      case "writeNew":
      case "writeMerge": {
        const name = root.querySelector("#almCrName")?.value || "ALMANAC lorebook";
        const attach = root.querySelector("#almCrAttach")?.value || "none";
        const bridge = root.querySelector("#almCrBridge")?.checked;
        run("Saving", async () => {
          const target = act === "writeMerge" ? { kind: "merge", bookId: this.bookId } : { kind: "new", name };
          const r = await this.call({ type: "creator", action: "write", req: { entries: this.entries, target, attach, chatId: this.getView()?.chatId, bridge } });
          if (r.error)
            throw new Error(r.error);
          this.written = r.written;
          this.step = "done";
        });
        break;
      }
      case "export":
        run("Exporting", async () => {
          const r = await this.call({ type: "creator", action: "export", entries: this.entries });
          const blob = new Blob([JSON.stringify(r.json, null, 2)], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "almanac-lorebook.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        });
        break;
      case "restart":
        Object.assign(this, { step: "source", plan: [], entries: [], issues: {}, fixes: {}, report: null, activation: null, written: null });
        this.rerender();
        break;
    }
    return true;
  }
  async generate() {
    const r = await this.call({ type: "creator", action: "generate", req: { plan: this.plan, source: this.source() } });
    if (r.error)
      throw new Error(r.error);
    this.entries = r.entries ?? [];
    this.issues = r.issues ?? {};
    this.fixes = r.fixes ?? {};
    this.report = r.report ?? null;
    this.step = "entries";
  }
}

// src/frontend/app.ts
var TABS = ["now", "cast", "bonds", "knowledge", "codex", "chronicle", "timeline", "world", "lore", "creator", "recall", "craft", "settings"];
var TAB_LABEL = {
  now: "Now",
  cast: "Cast",
  bonds: "Bonds",
  knowledge: "Knowledge",
  codex: "Codex",
  chronicle: "Chronicle",
  timeline: "Timeline",
  world: "World",
  lore: "Lore",
  creator: "Creator",
  recall: "Recall",
  craft: "Craft",
  settings: "Settings"
};
var BAND_SKY = {
  "deep night": "linear-gradient(#070a1c,#161c3e)",
  "small hours": "linear-gradient(#0c1230,#252b58)",
  "pre-dawn": "linear-gradient(#1d2352,#5a4a78)",
  dawn: "linear-gradient(#3a3570,#e58b72)",
  sunrise: "linear-gradient(#6f7fb8,#ffc48a)",
  morning: "linear-gradient(#6fa6de,#cfe6f5)",
  midday: "linear-gradient(#4d97e0,#a8d4f5)",
  afternoon: "linear-gradient(#5e9bd6,#d9e4ee)",
  "golden hour": "linear-gradient(#6d8fc2,#ffcf7a)",
  sunset: "linear-gradient(#5b4b8a,#ff8a5c)",
  dusk: "linear-gradient(#2e2d62,#a0588a)",
  evening: "linear-gradient(#10163a,#3b3566)"
};

class AlmanacApp {
  ctx;
  root;
  view = null;
  tab = "now";
  asOf = Infinity;
  graphAxis = "";
  npcOnly = false;
  codexFilter = "";
  codexKind = "";
  editing = null;
  creator;
  status = "nochat";
  hudProblem = "";
  constructor(ctx, root) {
    this.ctx = ctx;
    this.root = root;
    this.root.classList.add("almp");
    this.creator = new CreatorUI(ctx, () => this.view, () => this.render());
    try {
      const t = localStorage.getItem("alm-tab");
      if (t && TABS.includes(t))
        this.tab = t;
    } catch {}
    this.root.addEventListener("click", (ev) => this.onClick(ev));
    this.root.addEventListener("change", (ev) => this.onChange(ev));
  }
  send(msg) {
    this.ctx.sendToBackend({ chatId: this.view?.chatId, ...msg });
  }
  setStatus(s) {
    if (s === this.status)
      return;
    this.status = s;
    if (!this.view || s === "nochat")
      this.render();
  }
  setView(v) {
    this.view = v;
    this.render();
  }
  render() {
    const v = this.view;
    const tabs = `<div class="tabs" role="tablist">${TABS.map((t) => `<button role="tab" data-tab="${t}" aria-selected="${t === this.tab}">${TAB_LABEL[t]}</button>`).join("")}</div>`;
    if (!v) {
      const msg = this.status === "nochat" ? `Open a chat to see its Almanac.` : this.status === "stalled" ? `The Ledger hasn't answered yet. Check that ALMANAC Ledger is enabled in Extensions and has its permissions, then retry.<div class="row" style="justify-content:center;margin-top:10px"><button class="btn primary" data-act="retryState">Retry</button></div>` : `Reading this chat…`;
      this.root.innerHTML = `${tabs}<div class="empty">${msg}</div>`;
      return;
    }
    let body = "";
    try {
      body = this[`tab_${this.tab}`]?.(v) ?? "";
    } catch (err) {
      body = `<div class="empty">Could not draw this tab: ${escapeHtml(String(err))}</div>`;
    }
    const banner = !v.enabled ? `<div class="card flat"><b>The Ledger is not active in this chat.</b><p class="muted">It switches on by itself when the ALMANAC preset is in use (or a reply contains a &lt;ledger&gt; block). You can also turn it on here.</p><button class="btn primary" data-act="enable">Turn on for this chat</button></div>` : "";
    const scroll = this.root.scrollTop;
    this.root.innerHTML = tabs + banner + body;
    this.root.scrollTop = scroll;
  }
  tab_now(v) {
    const n = v.now;
    const sky = BAND_SKY[n.band] ?? BAND_SKY.afternoon;
    const present = v.cast.filter((c) => c.tier === "spot" || c.tier === "peri");
    const fc = (n.forecastHours ?? []).filter((_, i) => i % 2 === 0).slice(0, 6);
    return `<div class="hero" style="background:${sky}">
  <div class="row"><span class="gl">\uD83D\uDDD3 ${escapeHtml(n.clock)}</span>${n.weather ? `<span class="gl">${escapeHtml(n.weather.glyph)} ${escapeHtml(n.weather.text)}</span>` : ""}${n.moon ? `<span class="gl">${escapeHtml(n.moon.glyph)} ${escapeHtml(n.moon.name)}</span>` : ""}</div>
  <div class="t">${escapeHtml(n.title || (n.place.length ? n.place[n.place.length - 1] : "The story so far"))}</div>
  <div class="row"><span class="gl">\uD83D\uDCCD ${escapeHtml(n.place.join(" › ") || "—")}</span>${n.sun ? `<span class="gl">☀ ${escapeHtml(n.sun.text)}</span>` : ""}<span class="gl">${escapeHtml(n.season || "")}</span><span class="gl">scene ${n.scene} · ${escapeHtml(n.mode)}</span></div>
</div>
${fc.length ? `<div class="card flat"><h4>Next hours</h4><div class="alm-fc" style="grid-template-columns:repeat(${fc.length},1fr)">${fc.map((h) => `<div><small>${escapeHtml(h.t)}</small><span>${escapeHtml(h.glyph)}</span><b>${h.temp}°</b></div>`).join("")}</div><div class="muted">${escapeHtml(n.forecast)}</div></div>` : ""}
<h4>Present</h4>
${present.length ? `<div class="alm-cast">${present.map((c) => this.castCard(c, true)).join("")}</div>` : `<div class="empty">No one else is here.</div>`}
${v.world.cons.filter((c) => c.status === "open" || c.status === "due").length ? `<h4>Owed and due</h4><div class="card flat"><ul class="alm-list">${v.world.cons.filter((c) => c.status === "open" || c.status === "due").slice(-8).map((c) => `<li>${escapeHtml(c.whoName)}${c.whomName ? ` → ${escapeHtml(c.whomName)}` : ""}: ${escapeHtml(c.what)}${c.dueText ? ` <small class="muted">due ${escapeHtml(c.dueText)}</small>` : ""}</li>`).join("")}</ul></div>` : ""}
<h4>What the model will be told next</h4>
${v.note ? `<pre>${escapeHtml(v.note)}</pre>` : `<div class="empty">The note appears after the next generation starts.</div>`}
${v.recall ? `<details><summary class="muted">Recall block</summary><pre>${escapeHtml(v.recall)}</pre></details>` : ""}
<div class="row" style="margin-top:10px"><button class="btn" data-act="sessionZero">\uD83C\uDFB2 Session Zero</button><button class="btn" data-act="repairLast">\uD83E\uDE79 Repair last ledger</button><button class="btn" data-act="rebuild">↻ Rebuild from transcript</button></div>
<p class="muted" style="margin-top:8px">${v.counts.messages} messages · ${v.counts.ledgers} ledgers · ${v.counts.chapters} chapters${v.counts.unverified ? ` · ${v.counts.unverified} unverified turns` : ""}</p>`;
  }
  castCard(c, compact = false) {
    const meters = Object.entries(c.meters ?? {}).filter(([, x]) => x != null);
    const seg = (x) => `<span class="alm-seg">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= x ? "on" : ""}"></i>`).join("")}</span>`;
    const vad = c.mood && (c.mood.v != null || c.mood.a != null) ? `<div class="alm-vad">${c.mood.v != null ? `<span>V</span><div class="alm-slider"><i style="--v:${((c.mood.v + 3) / 6).toFixed(2)}"></i></div>` : ""}${c.mood.a != null ? `<span>A</span><div class="alm-slider"><i style="--v:${(c.mood.a / 5).toFixed(2)}"></i></div>` : ""}${c.mood.d != null ? `<span>D</span><div class="alm-slider"><i style="--v:${((c.mood.d + 3) / 6).toFixed(2)}"></i></div>` : ""}</div>` : "";
    return `<article class="alm-cc" style="--c:${escapeHtml(c.color)}"><div class="alm-cc__band"><span class="alm-cc__tier">${c.dead ? "dead" : c.isUser ? "you" : escapeHtml(c.tier === "spot" ? "spotlight" : c.tier === "peri" ? "periphery" : "away")}</span></div><span class="alm-say__medal alm-cc__medal" style="--c:${escapeHtml(c.color)}">${escapeHtml(initials(c.name))}</span>
<div class="alm-cc__bd"><div class="alm-cc__nm">${escapeHtml(c.name)}</div>${c.mood?.name ? `<div class="alm-cc__em">${escapeHtml(c.mood.name)}</div>` : ""}${vad}
${meters.length ? `<div class="alm-meters">${meters.map(([k, x]) => `<span>${escapeHtml(k)}</span>${seg(x)}`).join("")}</div>` : ""}
<div class="alm-tags">${(c.flags ?? []).slice(-4).map((f) => `<span class="alm-tag">${escapeHtml(f)}</span>`).join("")}${(c.injuries ?? []).map((i) => `<span class="alm-tag warn">${escapeHtml(i.where)}</span>`).join("")}${(c.held ?? []).slice(0, 3).map((h) => `<span class="alm-tag">holds: ${escapeHtml(h)}</span>`).join("")}</div>
${c.activity ? `<div class="alm-cc__row"><b>doing</b>${escapeHtml(c.activity)}</div>` : ""}${!compact && c.look ? `<div class="alm-cc__row"><b>look</b>${escapeHtml(c.look)}</div>` : ""}${!compact && c.place ? `<div class="alm-cc__row"><b>where</b>${escapeHtml(c.place)}</div>` : ""}
</div></article>`;
  }
  tab_cast(v) {
    return `<div class="list">${v.cast.map((c) => `<div class="card">
<div class="row"><span class="alm-mini" style="--c:${escapeHtml(c.color)}">${escapeHtml(initials(c.name))}</span><b class="grow">${escapeHtml(c.name)}${c.aliases?.length ? ` <small class="muted">(${escapeHtml(c.aliases.join(", "))})</small>` : ""}</b><span class="pill">slot ${c.slot}</span>${c.isUser ? "" : `<input type="color" class="swatch" data-color="${escapeHtml(c.id)}" value="${escapeHtml(toHex(c.color))}" title="Voice colour">`}</div>
${this.castCard(c)}
${c.journal?.length ? `<h4>In their own words</h4>${c.journal.map((j) => `<div class="muted">“${escapeHtml(j.text)}”</div>`).join("")}` : ""}
${c.isUser ? "" : `<h4>Hidden pressure (narrator-only)</h4><div class="row"><span class="spoiler grow" tabindex="0">${escapeHtml(c.pressure || "— none drawn yet —")}</span><button class="btn" data-act="editPressure" data-id="${escapeHtml(c.id)}">edit</button></div>`}
</div>`).join("") || `<div class="empty">No one has appeared yet.</div>`}</div>`;
  }
  tab_bonds(v) {
    const nodes = v.cast.filter((c) => !c.dead || v.bonds.some((b) => b.from === c.id || b.to === c.id)).map((c) => ({ id: c.id, name: c.isUser ? v.names.user || "You" : c.name, color: c.color, spot: c.tier === "spot", user: c.isUser }));
    const lastIdx = Math.max(0, ...v.bonds.map((b) => b.lastMsg));
    const edges = v.bonds.map((b) => ({ from: b.from, to: b.to, axes: b.axes, label: b.label, changedAt: b.lastMsg, changedNow: b.lastMsg === lastIdx, history: b.history }));
    const maxIdx = Math.max(1, ...v.bonds.flatMap((b) => b.history.map((h) => h.msgIndex)));
    const axes = ["", "trust", "affection", "respect", "attraction", "fear", "resentment", "rivalry", "obligation"];
    return `<div class="row"><select data-set="graphAxis">${axes.map((a) => `<option value="${a}"${a === this.graphAxis ? " selected" : ""}>${a || "strongest axis"}</option>`).join("")}</select><label class="chk"><input type="checkbox" data-set="npcOnly"${this.npcOnly ? " checked" : ""}> NPC↔NPC only</label></div>
<div style="margin:8px 0">${renderGraph(nodes, edges, { asOf: this.asOf, filterAxis: this.graphAxis || undefined, npcOnly: this.npcOnly })}</div>
<label class="f">Timeline scrubber — ${this.asOf === Infinity ? "now" : `as of message ${this.asOf + 1}`}<input type="range" min="0" max="${maxIdx}" value="${this.asOf === Infinity ? maxIdx : this.asOf}" data-set="asOf"></label>
<h4>All bonds</h4><div class="list">${v.bonds.map((b) => `<div class="rec"><div class="hd"><b>${escapeHtml(b.fromName)} → ${escapeHtml(b.toName)}</b>${b.label ? `<span class="pill">${escapeHtml(b.label)}</span>` : ""}${b.ladder ? `<span class="pill">♡ tier ${b.ladder.tier}</span>` : ""}</div><div class="muted">${Object.entries(b.axes).map(([k, x]) => `${k} ${x > 0 ? "+" : ""}${x}`).join(" · ")}</div>${b.history.slice(-2).map((h) => `<div class="muted"><small>${escapeHtml(h.axis)} ${h.delta > 0 ? "+" : ""}${h.delta}${h.cause ? ` — ${escapeHtml(h.cause)}` : ""}</small></div>`).join("")}</div>`).join("") || `<div class="empty">No bonds yet.</div>`}</div>`;
  }
  tab_knowledge(v) {
    const people = v.cast.filter((c) => !c.dead).slice(0, 8);
    if (!v.knowledge.length)
      return `<div class="empty">No knowledge recorded yet. The model records it with <code>know</code> lines.</div>`;
    const rows = v.knowledge.map((f) => {
      const cells = people.map((p) => {
        const h = f.holders.find((x) => x.id === p.id);
        if (!h)
          return `<td data-who="${escapeHtml(p.name)}"><span class="alm-kp un">—</span></td>`;
        const wrong = h.status === "wrong" || h.status !== "knows" && f.truth === "false";
        return `<td data-who="${escapeHtml(p.name)}"><span class="alm-kp ${wrong ? "wrong" : h.status === "knows" ? "knows" : "sus"}">${wrong ? "✗" : h.status === "knows" ? "✓" : "?"} ${escapeHtml(h.status)}</span></td>`;
      }).join("");
      return `<tr><td>${escapeHtml(f.fact)}${f.truth !== "unknown" ? ` <small class="muted">(${escapeHtml(f.truth)})</small>` : ""}</td>${cells}</tr>`;
    }).join("");
    const irony = v.knowledge.filter((f) => f.truth === "false" && f.holders.some((h) => h.status !== "unaware")).slice(0, 3);
    return `<table class="alm-km"><tr><th>Fact</th>${people.map((p) => `<th><span class="alm-mini" style="--c:${escapeHtml(p.color)}">${escapeHtml(initials(p.name))}</span></th>`).join("")}</tr>${rows}</table>
${irony.map((f) => `<div class="alm-irony"><span class="i">\uD83C\uDFAD</span><span><b>Dramatic irony:</b> ${escapeHtml(f.holders.filter((h) => h.status !== "unaware").map((h) => h.name).join(", "))} ${f.holders.length > 1 ? "are" : "is"} certain of something false: “${escapeHtml(f.fact)}”.</span></div>`).join("")}`;
  }
  tab_codex(v) {
    const kinds = [...new Set(v.codex.map((r) => r.kind))];
    const q = this.codexFilter.toLowerCase();
    const recs = v.codex.filter((r) => (!this.codexKind || r.kind === this.codexKind) && (!q || `${r.name} ${r.summary} ${r.keys.join(" ")}`.toLowerCase().includes(q)));
    return `<div class="row"><input type="text" placeholder="Search the Codex…" data-set="codexFilter" value="${escapeHtml(this.codexFilter)}" class="grow"><select data-set="codexKind"><option value="">all kinds</option>${kinds.map((k) => `<option${k === this.codexKind ? " selected" : ""}>${escapeHtml(k)}</option>`).join("")}</select></div>
<p class="muted">${recs.length} of ${v.codex.length} records. Edits lock a record so the archivist never overwrites it. Keys are real retrieval keys.</p>
<div class="list">${recs.slice(0, 200).map((r) => this.editing === r.id ? this.codexEditor(r) : `<div class="rec"><div class="hd"><span class="kind">${escapeHtml(r.kind)}</span><b class="grow">${escapeHtml(r.name)}</b>${r.locked ? `<span class="pill">\uD83D\uDD12 locked</span>` : ""}${r.narratorOnly ? `<span class="pill">narrator-only</span>` : ""}<span class="pill">${escapeHtml(r.source)}</span><button class="btn" data-act="edit" data-id="${escapeHtml(r.id)}">edit</button></div><div>${escapeHtml(r.summary)}</div>${r.keys.length ? `<div>${r.keys.map((k) => `<span class="pill">${escapeHtml(k)}</span>`).join("")}</div>` : ""}${r.body?.divergedNote ? `<div class="alm-tag warn">moved past: ${escapeHtml(r.body.divergedNote)}</div>` : ""}</div>`).join("")}</div>
<details><summary class="muted">Add a record or a correction</summary><div class="card flat"><label class="f">New record name<input type="text" id="almNewName"></label><label class="f">Kind<select id="almNewKind">${["person", "place", "object", "group", "law", "texture", "history", "situation"].map((k) => `<option>${k}</option>`).join("")}</select></label><label class="f">Summary<textarea id="almNewSummary"></textarea></label><button class="btn primary" data-act="newRecord">Add record</button>
<h4>Correct the state with ledger lines</h4><textarea id="almOps" placeholder="bond Mara>Kael: trust -1 — she caught him lying&#10;item Locket: Mara → Kael — stolen back"></textarea><button class="btn" data-act="userOps">Record correction</button></div></details>`;
  }
  codexEditor(r) {
    return `<div class="rec"><div class="hd"><span class="kind">${escapeHtml(r.kind)}</span><b class="grow">${escapeHtml(r.name)}</b></div>
<label class="f">Summary<textarea id="almEdSummary">${escapeHtml(r.summary)}</textarea></label>
<label class="f">Keys (comma-separated)<input type="text" id="almEdKeys" value="${escapeHtml(r.keys.join(", "))}"></label>
${r.kind === "person" ? `<label class="f">Routine (e.g. 06:00–09:00 docks (unloading); 09:00–18:00 harbour office)<input type="text" id="almEdRoutine" value="${escapeHtml(r.body?.routine ?? "")}"></label>` : ""}
${r.kind === "place" ? `<label class="f">Hours (e.g. open 20:00 to 02:00)<input type="text" id="almEdHours" value="${escapeHtml(r.body?.hours ?? "")}"></label>` : ""}
<label class="chk"><input type="checkbox" id="almEdNarr"${r.narratorOnly ? " checked" : ""}> narrator-only (characters cannot know it)</label>
<div class="row"><button class="btn primary" data-act="saveRecord" data-id="${escapeHtml(r.id)}">Save &amp; lock</button><button class="btn" data-act="unlock" data-id="${escapeHtml(r.id)}">Unlock</button><button class="btn" data-act="cancelEdit">Cancel</button>${r.source !== "story" ? `<button class="btn danger" data-act="deleteRecord" data-id="${escapeHtml(r.id)}">Delete</button>` : ""}</div></div>`;
  }
  tab_chronicle(v) {
    const cov = v.chronicle.coverage;
    const units = [...v.chronicle.units].sort((a, b) => b.startIdx - a.startIdx);
    return `<div class="card flat"><h4>Coverage</h4><div class="bar"><i style="width:${cov.volume}%;background:#7b5bd6"></i><i style="width:${cov.arc}%;background:var(--alm-accent-2)"></i><i style="width:${cov.chapter}%;background:var(--alm-accent)"></i><i style="width:${cov.raw}%;background:var(--alm-line)"></i></div>
<div class="row muted"><small>volumes ${cov.volume}% · arcs ${cov.arc}% · chapters ${cov.chapter}% · raw ${cov.raw}%</small></div>
<p class="muted">Old turns are summarised at scene boundaries, hidden, and replaced in the prompt by their chapter. The last ${v.settings.rawTail} messages always stay raw.</p>
<button class="btn primary" data-act="chronicleRun">Summarise now</button></div>
<div class="list">${units.map((u) => `<div class="rec"><div class="hd"><span class="kind">${escapeHtml(u.level)} ${u.no}</span><b class="grow">${escapeHtml(u.title)}</b>${u.locked ? `<span class="pill">\uD83D\uDD12</span>` : ""}${u.ghost ? `<span class="pill">ghost</span>` : ""}${u.stale ? `<span class="pill">stale</span>` : ""}</div>
<div class="muted"><small>messages ${u.startIdx + 1}–${u.endIdx + 1}${u.storyStart ? ` · ${escapeHtml(u.storyStart)}${u.storyEnd && u.storyEnd !== u.storyStart ? ` – ${escapeHtml(u.storyEnd)}` : ""}` : ""}</small></div>
<details><summary class="muted">read / edit</summary><textarea data-unit="${escapeHtml(u.id)}" style="min-height:140px">${escapeHtml(u.text)}</textarea><div class="row"><button class="btn" data-act="unitSave" data-id="${escapeHtml(u.id)}">Save</button><button class="btn" data-act="unitLock" data-id="${escapeHtml(u.id)}">${u.locked ? "Unlock" : "Lock"}</button><button class="btn" data-act="unitGhost" data-id="${escapeHtml(u.id)}">${u.ghost ? "Unghost" : "Ghost"}</button><button class="btn" data-act="unitRegen" data-id="${escapeHtml(u.id)}">Regenerate</button><button class="btn danger" data-act="unitUnhide" data-id="${escapeHtml(u.id)}">Unhide span</button></div></details></div>`).join("") || `<div class="empty">No chapters yet. They appear once enough scenes have scrolled past the raw tail.</div>`}</div>`;
  }
  tab_timeline(v) {
    const ev = [...v.timeline].reverse();
    const forecasts = v.codex.filter((r) => r.kind === "forecast");
    return `${forecasts.length ? `<h4>Ahead</h4><div class="list">${forecasts.map((f) => `<div class="rec">\uD83D\uDD2E ${escapeHtml(f.summary)}${f.status === "diverged" ? ` <span class="alm-tag warn">diverged</span>` : ""}</div>`).join("")}</div>` : ""}
<h4>Milestones</h4><div class="timeline">${ev.map((m) => `<div class="ev"><small>${escapeHtml(m.at || `message ${m.msgIndex + 1}`)} · ${escapeHtml(m.kind)}</small>${escapeHtml(m.text)}</div>`).join("") || `<div class="empty">Nothing yet.</div>`}</div>`;
  }
  tab_world(v) {
    const w = v.world;
    const ring = (n, of, c) => `<div class="alm-clock__face"><div class="alm-ring" style="--n:${n};--of:${Math.max(1, of)};--rc:${c}"></div><b>${n}/${of}</b></div>`;
    return `<div class="card flat"><div class="kv"><b>Calendar</b><span>${escapeHtml(w.calendar ? `${w.calendar.date} · ${w.calendar.season}` : "not started")}</span><b>Climate</b><span>${escapeHtml(w.climate)}</span></div>
<details><summary class="muted">Schedule weather</summary><div class="row"><input type="number" id="almWxDay" placeholder="day" style="width:70px"><input type="number" id="almWxHour" placeholder="hour" style="width:70px"><input type="number" id="almWxLen" placeholder="hours" style="width:70px"><input type="text" id="almWxCond" placeholder="thunderstorm" class="grow"><button class="btn" data-act="scheduleWx">Schedule</button></div></details></div>
${w.factions.length ? `<h4>Factions</h4><div class="alm-clocks">${w.factions.flatMap((f) => f.clocks.map((c) => `<div class="alm-clock">${ring(c.cur, c.max, "var(--alm-danger)")}<div><strong>${escapeHtml(f.name)}: ${escapeHtml(c.name)}</strong></div></div>`)).join("")}</div>` : ""}
${w.deadlines.length ? `<h4>Deadlines</h4><ul class="alm-list">${w.deadlines.map((d) => `<li class="${d.passed && !d.done ? "due" : ""}">${escapeHtml(d.title)} — ${escapeHtml(d.at)}${d.done ? " (done)" : d.passed ? " (passed)" : ` · ${escapeHtml(d.left)} left`}</li>`).join("")}</ul>` : ""}
${w.threads.length ? `<h4>Threads</h4><div class="list">${w.threads.map((t) => `<div class="rec"><div class="hd"><b class="grow">${escapeHtml(t.title)}</b><span class="pill">${escapeHtml(t.status)}</span></div>${t.latest ? `<div class="muted">${escapeHtml(t.latest)}</div>` : ""}${t.blocker ? `<div class="alm-tag warn">blocked: ${escapeHtml(t.blocker)}</div>` : ""}</div>`).join("")}</div>` : ""}
${w.items.length ? `<h4>Items</h4><div class="alm-inv">${w.items.map((i) => `<div class="alm-it"><span class="alm-it__ic">${i.gone ? "✗" : "✦"}</span><div><b>${escapeHtml(i.name)}</b><span class="alm-it__h">${escapeHtml(i.gone ? "gone" : i.holder || "?")}</span>${i.custody.map((c) => `<small class="muted">${escapeHtml(c.from || "?")} → ${escapeHtml(c.to || "?")}${c.how ? ` (${escapeHtml(c.how)})` : ""}</small>`).join("<br>")}</div></div>`).join("")}</div>` : ""}
${w.rumors.length ? `<h4>Rumours</h4><ul class="alm-list">${w.rumors.map((r) => `<li>\uD83D\uDDE3 ${escapeHtml(r.text)} <small class="muted">(${r.hops} hop${r.hops === 1 ? "" : "s"})</small></li>`).join("")}</ul>` : ""}
${w.rep.length ? `<h4>Reputation</h4>${w.rep.map((r) => `<span class="pill">${escapeHtml(r.group)} ${r.score > 0 ? "+" : ""}${r.score}${r.tags.length ? ` · ${escapeHtml(r.tags.join(", "))}` : ""}</span>`).join("")}` : ""}
${w.gauges.length ? `<h4>Gauges</h4><div class="alm-clocks">${w.gauges.map((g) => `<div class="alm-clock">${ring(g.cur, g.max, "var(--alm-accent)")}<div><strong>${escapeHtml(g.name)}</strong><span>${escapeHtml(g.cause ?? "")}</span></div></div>`).join("")}</div>` : ""}
${w.clues.length ? `<h4>Clue board</h4><ul class="alm-list">${w.clues.map((c) => `<li>\uD83D\uDD0E ${escapeHtml(c.text)}${c.pointsTo ? ` → ${escapeHtml(c.pointsTo)}` : ""}${c.reliability ? ` <small class="muted">(${escapeHtml(c.reliability)})</small>` : ""}</li>`).join("")}</ul>` : ""}
${w.plants.length ? `<h4>Plants &amp; payoffs</h4><ul class="alm-list">${w.plants.map((p) => `<li>${p.paidAt != null ? "✓" : "○"} ${escapeHtml(p.text)}${p.payoff ? ` <small class="muted">(${escapeHtml(p.payoff)})</small>` : ""}</li>`).join("")}</ul>` : ""}
${w.canon.length ? `<h4>Minted canon</h4><ul class="alm-list">${w.canon.map((c) => `<li>${escapeHtml(c.text)}</li>`).join("")}</ul>` : ""}
<div class="row" style="margin-top:10px"><button class="btn" data-act="simulate">⏭ Run the off-screen world now</button></div>`;
  }
  tab_lore(v) {
    const books = Object.entries(v.lore.books ?? {});
    return `<p class="muted">The Lore Bridge reads the character, persona, chat and global lorebooks into the Codex. Your books are never edited unless you allow it.</p>
<div class="row"><button class="btn primary" data-act="loreScan">Re-read lorebooks</button>${v.lore.review?.length ? `<button class="btn" data-act="loreClassify">Classify ${v.lore.review.length} unclear entries with the model</button>` : ""}<button class="btn" data-act="mirrorSync">Sync mirror book</button></div>
<div class="list" style="margin-top:10px">${books.map(([id, b]) => `<div class="rec"><div class="hd"><b class="grow">${escapeHtml(b.name)}</b><span class="pill">${escapeHtml(b.scope)}</span><span class="pill">${b.count} entries</span></div>
<div class="row"><label class="f grow">Activation<select data-lore-mode="${escapeHtml(id)}">${["native", "assisted", "managed"].map((m) => `<option value="${m}"${m === b.mode ? " selected" : ""}>${m}</option>`).join("")}</select></label><label class="f grow">Permission<select data-lore-perm="${escapeHtml(id)}">${["read", "overlay", "write"].map((m) => `<option value="${m}"${m === b.permission ? " selected" : ""}>${m === "read" ? "read-only" : m}</option>`).join("")}</select></label></div></div>`).join("") || `<div class="empty">No lorebooks are attached to this chat.</div>`}</div>
<p class="muted"><b>Native</b>: your keywords decide; the Ledger only annotates lore the story has moved past. <b>Assisted</b>: plus the entries Recall picks. <b>Managed</b>: the Ledger is the only retrieval owner for that book.</p>
${v.lore.review?.length ? `<h4>Review queue</h4><ul class="alm-list">${v.lore.review.slice(0, 40).map((r) => `<li>${escapeHtml(r.title)} — read as <b>${escapeHtml(r.kind)}</b> (${Math.round(r.confidence * 100)}%)</li>`).join("")}</ul>` : ""}`;
  }
  tab_creator(v) {
    return this.creator.render(v);
  }
  tab_recall(v) {
    const f = v.feed?.[0];
    return `<p class="muted">What Recall considered for the latest generation, with scores and reasons. Green = injected.</p>
${f ? `<div class="card flat"><div class="row"><span class="pill">tier: ${escapeHtml(f.tier)}</span><span class="pill">≈ ${f.tokens} tokens injected</span><span class="pill">${new Date(f.at).toLocaleTimeString()}</span></div>
<div class="feed">${f.items.map((i) => `<div class="it${i.injected ? " in" : ""}"><span class="sc">${i.score}</span><div><b>${escapeHtml(i.name)}</b> <small class="muted">${escapeHtml(i.id)}</small><br><small class="muted">${escapeHtml(i.reasons.join(" · "))}</small></div></div>`).join("")}</div></div>` : `<div class="empty">No retrieval yet.</div>`}
${v.rejected.length ? `<h4>Rejected or corrected ledger lines</h4><div class="list">${v.rejected.slice().reverse().map((r) => `<div class="rec"><code>${escapeHtml(r.raw)}</code><div class="muted"><small>message ${r.msgIndex + 1} · ${escapeHtml(r.verdict)} — ${escapeHtml(r.reason ?? "")}</small></div></div>`).join("")}</div>` : ""}`;
  }
  tab_craft(v) {
    const t = v.telemetry;
    if (!t)
      return `<div class="empty">Craft telemetry appears after a few replies.</div>`;
    return `<div class="card flat"><h4>Next reply is told</h4><div>Avoid: ${t.avoids.map((a) => `<span class="pill">${escapeHtml(a)}</span>`).join("") || "—"}</div><div style="margin-top:6px">Try: <b>${escapeHtml(t.technique)}</b></div>${t.agency.length ? `<div class="alm-tag warn" style="margin-top:8px">${escapeHtml(t.agency.join("; "))}</div>` : ""}</div>
<div class="card flat"><h4>Last six replies</h4><div class="kv">${Object.entries(t.metrics).map(([k, x]) => `<b>${escapeHtml(k)}</b><span>${escapeHtml(String(x))}</span>`).join("")}</div></div>
${t.repeated.length ? `<div class="card flat"><h4>Repeated phrases</h4>${t.repeated.map((r) => `<span class="pill">“${escapeHtml(r.phrase)}” ×${r.count}</span>`).join("")}</div>` : ""}
<div class="card flat"><h4>Openings</h4>${t.openings.map((o) => `<span class="pill">${escapeHtml(o)}</span>`).join("")}</div>`;
  }
  tab_settings(v) {
    const s = v.settings;
    const sel = (k, opts) => `<select data-setting="${k}">${opts.map(([val, lab]) => `<option value="${val}"${String(s[k]) === val ? " selected" : ""}>${lab}</option>`).join("")}</select>`;
    const num = (k, min = 0, max = 99999) => `<input type="number" data-setting="${k}" value="${s[k]}" min="${min}" max="${max}">`;
    const chk = (k, lab) => `<label class="chk"><input type="checkbox" data-setting="${k}"${s[k] ? " checked" : ""}> ${lab}</label>`;
    const txt = (k, ph = "") => `<input type="text" data-setting="${k}" value="${escapeHtml(s[k] ?? "")}" placeholder="${escapeHtml(ph)}">`;
    return `<h3>This chat</h3><div class="card flat"><div class="row"><span class="grow">Ledger in this chat: <b>${v.enabled ? "on" : "off"}</b>${v.config.enabledOverride == null ? " (automatic)" : ""}</span><button class="btn" data-act="enable">On</button><button class="btn" data-act="disable">Off</button><button class="btn" data-act="auto">Automatic</button></div></div>
<h3>Core</h3><div class="card flat"><label class="f">Enable<select data-setting="enabled"><option value="auto"${s.enabled === "auto" ? " selected" : ""}>automatic (ALMANAC chats)</option><option value="on"${s.enabled === "on" ? " selected" : ""}>every chat</option><option value="off"${s.enabled === "off" ? " selected" : ""}>off</option></select></label>
<label class="f">Validation${sel("strictness", [["strict", "strict — reject impossible changes"], ["lenient", "lenient — warn only"]])}</label>${chk("autoRepair", "Repair missing ledgers automatically")}${chk("formatAid", "Show the model last turn's ledger as a format example")}${chk("debug", "Debug logging")}</div>
<h3>Chronicle</h3><div class="card flat">${chk("chronicle", "Summarise old turns into chapters, arcs and volumes")}${chk("hideCovered", "Hide covered turns")}<label class="f">Raw tail (messages)${num("rawTail", 6, 400)}</label><label class="f">Raw tail cap (tokens)${num("rawTailTokens", 1000)}</label><label class="f">Chapter size (tokens)${num("chapterThresholdTokens", 1000)}</label><label class="f">Fan-in (chapters per arc, arcs per volume)${num("fanIn", 2, 12)}</label><label class="f">Summariser connection id (empty = your default)${txt("summarizerConnection")}</label></div>
<h3>Recall</h3><div class="card flat"><label class="f">Injection budget (tokens)${num("recallBudget", 400, 20000)}</label><label class="f">Recall placement${sel("recallPlacement", [["before_history", "before chat history"], ["depth4", "4 messages from the end"]])}</label>${chk("keyHeat", "Demote keys that fire without being used")}<label class="f">Max keys per record${num("maxKeys", 4, 24)}</label></div>
<h3>Storage (hybrid)</h3><div class="card flat"><p class="muted">The extension's storage is the source of truth (branch-safe, rebuildable). The mirror lorebook is a readable, editable projection attached to this chat only.</p><label class="f">Mirror lorebook${sel("mirror", [["off", "off"], ["summaries", "summaries"], ["full", "full records"]])}</label>${chk("mirrorVectorize", "Vectorise mirror entries (semantic recall; needs an embedding provider)")}</div>
<h3>Lore bridge</h3><div class="card flat"><label class="f">Default activation for new books${sel("loreDefaultMode", [["native", "native"], ["assisted", "assisted"], ["managed", "managed"]])}</label><label class="f">Default permission${sel("lorePermission", [["read", "read-only"], ["overlay", "overlay"], ["write", "read + write"]])}</label></div>
<h3>World engines</h3><div class="card flat"><label class="f">Climate (default for new chats)${txt("climate", "temperate maritime")}</label><label class="f">Latitude${txt("latitude", "temperate / 51 N / southern subpolar")}</label><label class="f">Calendar${txt("calendar", "weekdays: …; months: Name (30), …")}</label>${chk("simulator", "Off-screen simulator (one model call when story time advances)")}<label class="f">Simulator step (minutes of story time)${num("simStep", 30, 1e4)}</label><label class="f">Simulator connection id${txt("simConnection")}</label>${chk("pressures", "Hidden pressures for new characters")}${chk("chekhov", "Chekhov nudges for unused plants")}${chk("telemetry", "Craft telemetry")}</div>
<h3>Director</h3><div class="card flat"><p class="muted">Used when the preset's Director's Pass channel is set to Sidecar.</p><label class="f">Planner connection id${txt("sidecarConnection")}</label><label class="f">Planner timeout (seconds)${num("sidecarTimeout", 5, 90)}</label></div>
<h3>Look</h3><div class="card flat"><label class="f">Skin${sel("theme", [["preset", "follow the preset (Auto by genre)"], ["almanac", "Almanac"], ["solar", "Solar Editorial"], ["nocturne", "Nocturne"], ["botanical", "Botanical"], ["prism", "Prism"], ["candy", "Candy"]])}</label>${chk("fonts", "Load the ALMANAC web fonts (Google Fonts)")}${chk("hud", "Floating Now widget")}${this.hudProblem === "permission" ? `<div class="row"><span class="muted grow">The floating widget needs the <b>ui_panels</b> permission.</span><button class="btn" data-act="grantPanels">Grant</button></div>` : this.hudProblem ? `<p class="muted">The floating widget could not open: ${escapeHtml(this.hudProblem)}</p>` : ""}${chk("narratorOnlyToTools", "Let LLM tools see narrator-only records")}</div>`;
  }
  onClick(ev) {
    const t = ev.target;
    const tabBtn = t.closest("[data-tab]");
    if (tabBtn) {
      this.tab = tabBtn.dataset.tab;
      try {
        localStorage.setItem("alm-tab", this.tab);
      } catch {}
      this.render();
      return;
    }
    if (this.creator.onClick(t))
      return;
    const act = t.closest("[data-act]")?.dataset;
    if (!act)
      return;
    const id = act.id;
    const val = (sel) => this.root.querySelector(sel)?.value ?? "";
    switch (act.act) {
      case "enable":
        this.send({ type: "enable", value: true });
        break;
      case "disable":
        this.send({ type: "enable", value: false });
        break;
      case "auto":
        this.send({ type: "enable", value: null });
        break;
      case "sessionZero":
        this.ctx.events.emit("almanac:sessionZero", { chatId: this.view?.chatId });
        break;
      case "repairLast":
        this.send({ type: "repairLast" });
        break;
      case "rebuild":
        this.send({ type: "rebuild" });
        break;
      case "retryState":
        this.ctx.events.emit("almanac:retryState", {});
        break;
      case "grantPanels":
        this.ctx.events.emit("almanac:grantPanels", {});
        break;
      case "edit":
        this.editing = id ?? null;
        this.render();
        break;
      case "cancelEdit":
        this.editing = null;
        this.render();
        break;
      case "saveRecord": {
        const body = {};
        if (this.root.querySelector("#almEdRoutine"))
          body.routine = val("#almEdRoutine");
        if (this.root.querySelector("#almEdHours"))
          body.hours = val("#almEdHours");
        this.send({ type: "codexEdit", id, patch: { summary: val("#almEdSummary"), keys: val("#almEdKeys").split(",").map((s) => s.trim()).filter(Boolean), locked: true, body, narratorOnly: this.root.querySelector("#almEdNarr")?.checked } });
        this.editing = null;
        break;
      }
      case "unlock":
        this.send({ type: "codexEdit", id, patch: { locked: false } });
        this.editing = null;
        break;
      case "deleteRecord":
        this.send({ type: "codexEdit", id, patch: { delete: true } });
        this.editing = null;
        break;
      case "newRecord": {
        const name = val("#almNewName").trim();
        if (!name)
          return;
        const kind = val("#almNewKind");
        const prefix = { person: "char:", place: "loc:", object: "item:", group: "fac:" };
        this.send({ type: "codexEdit", id: `${prefix[kind] ?? "custom:"}${name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_")}`, patch: { create: true, kind, name, summary: val("#almNewSummary"), locked: true } });
        break;
      }
      case "userOps":
        this.send({ type: "userOps", lines: val("#almOps").split(`
`).filter((l) => l.trim()) });
        break;
      case "editPressure": {
        const cur = this.view?.cast.find((c) => c.id === id)?.pressure ?? "";
        const text = window.prompt("Hidden pressure (narrator-only). Empty to clear.", cur);
        if (text !== null)
          this.send({ type: "pressure", charId: id, text });
        break;
      }
      case "chronicleRun":
        this.send({ type: "chronicle", action: "run" });
        break;
      case "unitSave":
        this.send({ type: "chronicle", action: "edit", unitId: id, text: this.root.querySelector(`textarea[data-unit="${id}"]`)?.value });
        break;
      case "unitLock":
        this.send({ type: "chronicle", action: "lock", unitId: id });
        break;
      case "unitGhost":
        this.send({ type: "chronicle", action: "ghost", unitId: id });
        break;
      case "unitRegen":
        this.send({ type: "chronicle", action: "regenerate", unitId: id });
        break;
      case "unitUnhide":
        this.send({ type: "chronicle", action: "unhide", unitId: id });
        break;
      case "loreScan":
        this.send({ type: "lore", action: "scan" });
        break;
      case "loreClassify":
        this.send({ type: "lore", action: "classify" });
        break;
      case "mirrorSync":
        this.send({ type: "mirrorSync" });
        break;
      case "simulate":
        this.send({ type: "simulate" });
        break;
      case "scheduleWx": {
        const day = parseInt(val("#almWxDay"), 10);
        const hour = parseInt(val("#almWxHour"), 10);
        const hours = parseInt(val("#almWxLen"), 10) || 6;
        const condition = val("#almWxCond").trim();
        if (day > 0 && hour >= 0 && hour < 24 && condition)
          this.send({ type: "schedule", spec: { day, hour, hours, condition } });
        break;
      }
    }
  }
  onChange(ev) {
    const t = ev.target;
    if (this.creator.onChange(t))
      return;
    const d = t.dataset;
    if (d.setting) {
      const cur = this.view?.settings?.[d.setting];
      const value = t.type === "checkbox" ? t.checked : typeof cur === "number" ? Number(t.value) : t.value;
      this.send({ type: "settings", patch: { [d.setting]: value } });
      if (this.view)
        this.view.settings[d.setting] = value;
      this.ctx.events.emit("almanac:settings", { [d.setting]: value });
      return;
    }
    if (d.set) {
      if (d.set === "asOf") {
        const max = Number(t.max);
        this.asOf = Number(t.value) >= max ? Infinity : Number(t.value);
      } else if (d.set === "npcOnly")
        this.npcOnly = t.checked;
      else
        this[d.set] = t.value;
      this.render();
      return;
    }
    if (d.color) {
      this.send({ type: "color", charId: d.color, color: t.value });
      return;
    }
    if (d.loreMode)
      this.send({ type: "lore", action: "mode", bookId: d.loreMode, value: t.value });
    if (d.lorePerm)
      this.send({ type: "lore", action: "permission", bookId: d.lorePerm, value: t.value });
  }
}
function toHex(c) {
  return /^#[0-9a-f]{6}$/i.test(c) ? c : "#888888";
}

// src/frontend/styles.ts
var FONTS_IMPORT = `@import url("https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Cormorant+Garamond:ital,wght@0,500;0,700;1,500;1,700&family=DM+Mono:wght@400;500&family=Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400..800&family=Fredoka:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600&family=Oswald:wght@500;600&family=Playfair+Display:ital,wght@0,600;0,800;1,600&family=Space+Grotesk:wght@500;700&display=swap");`;
var TOKENS = `
:root{
  --alm-ink:var(--lumiverse-text,#2a231d);
  --alm-muted:var(--lumiverse-text-muted,#76695a);
  --alm-panel:color-mix(in oklab,var(--lumiverse-fill-subtle,#fffaf1) 94%,#c4922c 6%);
  --alm-panel-2:color-mix(in oklab,var(--alm-panel) 90%,var(--alm-ink) 6%);
  --alm-line:color-mix(in oklab,var(--lumiverse-border,#e3d3b8) 80%,#c4922c 20%);
  --alm-accent:color-mix(in oklab,var(--lumiverse-accent,#b5602a) 55%,#c4702a 45%);
  --alm-accent-2:#4f7ab0; --alm-gold:#c4922c; --alm-good:#3f9a62; --alm-warn:#c58a22; --alm-danger:#cc4a4a;
  --alm-font-display:"Fraunces","Iowan Old Style",Palatino,Georgia,serif;
  --alm-font-body:inherit;
  --alm-font-mono:"DM Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --alm-font-hand:"Caveat","Segoe Print","Bradley Hand",cursive;
  --alm-radius:18px; --alm-r-sm:12px;
  --alm-shadow:0 18px 40px -26px rgba(40,25,10,.55),0 2px 6px -3px rgba(40,25,10,.18);
  --alm-lift:0 12px 24px -18px rgba(40,25,10,.55);
  --alm-texture:radial-gradient(color-mix(in oklab,var(--alm-ink) 7%,transparent) 1px,transparent 1.3px) 0 0/15px 15px;
  --alm-on-voice:#fff;
}
:root[data-alm-skin="solar"]{
  --alm-panel:#fffcf4; --alm-panel-2:#f7efdd; --alm-ink:#1c2a44; --alm-muted:#5e6679; --alm-line:#e6dcc6;
  --alm-accent:#e0664f; --alm-accent-2:#1f3a66; --alm-gold:#c9982c; --alm-good:#2d7a55; --alm-warn:#b77a1c; --alm-danger:#c23b37;
  --alm-font-display:"Playfair Display","Didot","Bodoni 72",Georgia,serif;
  --alm-texture:linear-gradient(90deg,rgba(28,42,68,.03) 1px,transparent 1px) 0 0/28px 28px; --alm-on-voice:#fff;
}
:root[data-alm-skin="nocturne"]{
  --alm-panel:#161116; --alm-panel-2:#1e171d; --alm-ink:#ece0d9; --alm-muted:#a39290; --alm-line:#35262c;
  --alm-accent:#e0566b; --alm-accent-2:#c3c3d4; --alm-gold:#cdb27a; --alm-good:#8fc9a0; --alm-warn:#e2b564; --alm-danger:#ff7a7a;
  --alm-font-display:"Cormorant Garamond","Iowan Old Style",Georgia,serif;
  --alm-shadow:0 26px 50px -28px rgba(0,0,0,.95); --alm-lift:0 14px 30px -18px rgba(0,0,0,.95);
  --alm-texture:radial-gradient(rgba(224,86,107,.06) 1px,transparent 1.5px) 0 0/19px 19px; --alm-on-voice:#140e12;
}
:root[data-alm-skin="botanical"]{
  --alm-panel:#fbfcf5; --alm-panel-2:#f1f5e8; --alm-ink:#20301d; --alm-muted:#5e6c58; --alm-line:#d3dcc4;
  --alm-accent:#3f7a4a; --alm-accent-2:#b24d68; --alm-gold:#a88a2e; --alm-good:#2f7d4f; --alm-warn:#a8761e; --alm-danger:#b23a4a;
  --alm-radius:26px; --alm-r-sm:16px;
  --alm-texture:radial-gradient(60% 60% at 20% 30%,rgba(63,122,74,.05),transparent 60%) 0 0/180px 140px; --alm-on-voice:#fff;
}
:root[data-alm-skin="prism"]{
  --alm-panel:#0d1425; --alm-panel-2:#121c33; --alm-ink:#dbe7ff; --alm-muted:#8397bd; --alm-line:#1f2d4a;
  --alm-accent:#2ee6c5; --alm-accent-2:#7aa2ff; --alm-gold:#ffd166; --alm-good:#4be39a; --alm-warn:#ffc15e; --alm-danger:#ff6b8a;
  --alm-font-display:"Space Grotesk","Segoe UI",system-ui,sans-serif; --alm-font-body:"Space Grotesk","Segoe UI",system-ui,sans-serif;
  --alm-radius:8px; --alm-r-sm:5px;
  --alm-shadow:0 0 0 1px rgba(46,230,197,.08) inset,0 24px 48px -28px rgba(0,0,0,.9); --alm-lift:0 12px 28px -18px rgba(0,0,0,.95);
  --alm-texture:linear-gradient(rgba(122,162,255,.05) 1px,transparent 1px) 0 0/100% 24px,linear-gradient(90deg,rgba(122,162,255,.05) 1px,transparent 1px) 0 0/24px 100%;
  --alm-on-voice:#06101c;
}
:root[data-alm-skin="candy"]{
  --alm-panel:#ffffff; --alm-panel-2:#fff5fa; --alm-ink:#3b2340; --alm-muted:#86698a; --alm-line:#f5cfe1;
  --alm-accent:#ff3f86; --alm-accent-2:#6c5ce7; --alm-gold:#f5a623; --alm-good:#1f9d6b; --alm-warn:#d88a00; --alm-danger:#e53960;
  --alm-font-display:"Fredoka","Nunito","Segoe UI Rounded",system-ui,sans-serif; --alm-font-body:"Fredoka","Nunito",system-ui,sans-serif;
  --alm-radius:24px; --alm-r-sm:16px; --alm-shadow:5px 5px 0 #f5cfe1; --alm-lift:3px 3px 0 #f5cfe1;
  --alm-texture:radial-gradient(rgba(255,63,134,.10) 1.5px,transparent 2px) 0 0/22px 22px; --alm-on-voice:#fff;
}
`;
var MESSAGE_CSS = `
.alm-sr{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important}

/* ── Voice cards (Blocks) ── */
.alm-say{--c:var(--alm-muted);position:relative!important;display:grid!important;grid-template-columns:44px minmax(0,1fr)!important;gap:0 14px!important;margin:22px 0 16px!important;align-items:start!important;font-family:var(--alm-font-body)}
.alm-say__medal{position:relative!important;width:44px!important;height:44px!important;border-radius:50%!important;display:grid!important;place-items:center!important;margin-top:4px!important;
  font:700 19px/1 var(--alm-font-display)!important;color:var(--alm-on-voice)!important;
  background:radial-gradient(circle at 32% 26%,color-mix(in oklab,var(--c) 38%,#fff) 0 14%,var(--c) 56%,color-mix(in oklab,var(--c) 72%,#000) 100%)!important;
  box-shadow:0 0 0 2.5px var(--alm-panel),0 0 0 4.5px color-mix(in oklab,var(--c) 45%,transparent),0 10px 18px -8px color-mix(in oklab,var(--c) 80%,#000)!important}
.alm-say__bubble{position:relative!important;min-width:0!important;padding:18px 18px 12px!important;border-radius:6px var(--alm-radius) var(--alm-radius) var(--alm-radius)!important;
  background:linear-gradient(135deg,color-mix(in oklab,var(--c) 14%,var(--alm-panel)),color-mix(in oklab,var(--c) 4%,var(--alm-panel)) 70%)!important;
  border:1px solid color-mix(in oklab,var(--c) 30%,var(--alm-line))!important;box-shadow:var(--alm-lift)!important;color:var(--alm-ink)}
.alm-say__bubble::before{content:"";position:absolute;left:-7px;top:18px;width:12px;height:12px;transform:rotate(45deg);
  background:color-mix(in oklab,var(--c) 14%,var(--alm-panel));border-left:1px solid color-mix(in oklab,var(--c) 30%,var(--alm-line));border-bottom:1px solid color-mix(in oklab,var(--c) 30%,var(--alm-line))}
.alm-say__bubble::after{content:"\\201C";position:absolute;right:12px;top:-6px;font:700 88px/1 var(--alm-font-display);color:var(--c);opacity:.13;pointer-events:none}
.alm-say__who{position:absolute!important;top:-12px!important;left:16px!important;display:inline-flex!important;align-items:center!important;gap:7px!important;padding:5px 11px!important;border-radius:999px!important;
  background:var(--c)!important;color:var(--alm-on-voice)!important;font:500 10.5px/1 var(--alm-font-mono)!important;letter-spacing:.16em!important;text-transform:uppercase!important;
  box-shadow:0 6px 12px -6px color-mix(in oklab,var(--c) 90%,#000)!important}
.alm-say__tone{font:italic 500 12px/1 var(--alm-font-body)!important;letter-spacing:.02em!important;text-transform:none!important;padding-left:7px!important;border-left:1px solid color-mix(in oklab,var(--alm-on-voice) 45%,transparent)!important;opacity:1!important}
.alm-say__line{display:block!important;font-size:1.06em!important;line-height:1.5!important;color:var(--alm-ink)!important;font-style:normal}
.alm-say__beat{display:block!important;margin-top:8px!important;padding-top:7px!important;border-top:1px dashed color-mix(in oklab,var(--c) 25%,var(--alm-line))!important;color:var(--alm-muted)!important;font-size:.9em!important;font-style:italic!important}
.alm-say--user{grid-template-columns:minmax(0,1fr) 44px!important;margin-left:12%!important}
.alm-say--user .alm-say__medal{grid-column:2;grid-row:1}
.alm-say--user .alm-say__bubble{grid-column:1;grid-row:1;text-align:right;border-radius:var(--alm-radius) 6px var(--alm-radius) var(--alm-radius)!important}
.alm-say--user .alm-say__bubble::before{left:auto;right:-7px;border-left:0;border-bottom:0;border-right:1px solid color-mix(in oklab,var(--c) 30%,var(--alm-line));border-top:1px solid color-mix(in oklab,var(--c) 30%,var(--alm-line))}
.alm-say--user .alm-say__bubble::after{right:auto;left:12px}
.alm-say--user .alm-say__who{left:auto!important;right:16px!important}
.alm-say--follow{margin-top:-10px!important}
.alm-say--follow .alm-say__medal{visibility:hidden!important;height:0!important}
.alm-say--follow .alm-say__who{display:none!important}
.alm-say--follow .alm-say__bubble::before,.alm-say--follow .alm-say__bubble::after{content:none}
/* tones */
.alm-say[data-tone="whisper"] .alm-say__bubble,.alm-say[data-tone="breathless"] .alm-say__bubble{border-style:dashed!important;background:color-mix(in oklab,var(--c) 6%,var(--alm-panel))!important;box-shadow:none!important}
.alm-say[data-tone="whisper"] .alm-say__bubble::before,.alm-say[data-tone="breathless"] .alm-say__bubble::before{background:color-mix(in oklab,var(--c) 6%,var(--alm-panel));border-left-style:dashed;border-bottom-style:dashed}
.alm-say[data-tone="whisper"] .alm-say__line,.alm-say[data-tone="breathless"] .alm-say__line{font-style:italic!important;color:color-mix(in oklab,var(--alm-ink) 78%,var(--alm-panel))!important;letter-spacing:.01em}
.alm-say[data-tone="whisper"] .alm-say__medal::after{content:"";position:absolute;inset:-8px;border-radius:50%;border:2px dotted color-mix(in oklab,var(--c) 55%,transparent)}
.alm-say[data-tone="murmur"] .alm-say__line{font-style:italic!important;opacity:.9}
.alm-say[data-tone="shout"] .alm-say__bubble{transform:rotate(-.7deg);border:2px solid var(--c)!important;box-shadow:5px 5px 0 color-mix(in oklab,var(--c) 28%,transparent)!important}
.alm-say[data-tone="shout"] .alm-say__bubble::before{border-width:2px;border-color:var(--c);left:-8px}
.alm-say[data-tone="shout"] .alm-say__line{font-weight:650!important;font-size:1.16em!important}
.alm-say[data-tone="shout"] .alm-say__medal::before{content:"";position:absolute;inset:-12px;z-index:-1;background:color-mix(in oklab,var(--c) 30%,transparent);
  clip-path:polygon(50% 0,61% 22%,85% 12%,78% 37%,100% 50%,78% 63%,85% 88%,61% 78%,50% 100%,39% 78%,15% 88%,22% 63%,0 50%,22% 37%,15% 12%,39% 22%)}
.alm-say[data-tone="tender"] .alm-say__bubble,.alm-say[data-tone="sob"] .alm-say__bubble{box-shadow:0 0 0 5px color-mix(in oklab,var(--c) 9%,transparent),0 18px 34px -18px color-mix(in oklab,var(--c) 70%,transparent)!important}
.alm-say[data-tone="tender"] .alm-say__bubble::after,.alm-say[data-tone="sob"] .alm-say__bubble::after{content:"♡";font-size:52px;top:6px;opacity:.16}
.alm-say[data-tone="sob"] .alm-say__line{font-style:italic!important}
.alm-say[data-tone="cold"] .alm-say__bubble{background:linear-gradient(135deg,color-mix(in oklab,#7fb3d9 16%,var(--alm-panel)),var(--alm-panel) 75%)!important;border-color:color-mix(in oklab,#7fb3d9 40%,var(--alm-line))!important}
.alm-say[data-tone="cold"] .alm-say__bubble::before{background:color-mix(in oklab,#7fb3d9 16%,var(--alm-panel));border-color:color-mix(in oklab,#7fb3d9 40%,var(--alm-line))}
.alm-say[data-tone="cold"] .alm-say__line{letter-spacing:.025em;color:color-mix(in oklab,var(--alm-ink) 85%,#7fb3d9)!important}
.alm-say[data-tone="cold"] .alm-say__bubble::after{content:"❄";font-size:38px;top:8px;opacity:.2;color:#7fb3d9}
.alm-say[data-tone="sing"] .alm-say__line{text-decoration:underline wavy color-mix(in oklab,var(--c) 45%,transparent);text-underline-offset:6px;text-decoration-thickness:1.5px}
.alm-say[data-tone="sing"] .alm-say__bubble::after{content:"♪ ♫";font-size:28px;top:8px;letter-spacing:.2em}
.alm-say[data-tone="sly"] .alm-say__who{transform:rotate(-3deg)}
.alm-say[data-tone="sly"] .alm-say__bubble{border-radius:6px var(--alm-radius) 6px var(--alm-radius)!important}
.alm-say[data-tone="sly"] .alm-say__line{font-style:italic!important}
.alm-say[data-tone="sly"] .alm-say__bubble::after{content:"✧";font-size:42px;top:6px}
.alm-say[data-tone="flat"] .alm-say__bubble{background:color-mix(in oklab,var(--c) 5%,var(--alm-panel))!important}
.alm-say[data-tone="flat"] .alm-say__bubble::after{content:none}
.alm-say[data-spk="?"]{--c:var(--alm-muted)!important}

/* chips, tint, script */
.alm-chip{--c:var(--alm-muted);padding:2px 9px 3px 3px!important;border-radius:999px!important;background:color-mix(in oklab,var(--c) 13%,transparent)!important;
  box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--c) 30%,transparent)!important;-webkit-box-decoration-break:clone;box-decoration-break:clone;color:inherit!important}
.alm-chip__dot{display:inline-grid!important;place-items:center!important;width:20px!important;height:20px!important;margin-right:6px!important;border-radius:50%!important;vertical-align:-3px!important;
  background:var(--c)!important;color:var(--alm-on-voice)!important;font:700 11px/1 var(--alm-font-display)!important}
.alm-tint{--c:var(--alm-muted);color:color-mix(in oklab,var(--c) 75%,var(--alm-ink))!important;text-decoration:underline;text-decoration-color:color-mix(in oklab,var(--c) 35%,transparent);text-underline-offset:4px;text-decoration-thickness:2px}
.alm-script{--c:var(--alm-muted);display:grid!important;grid-template-columns:auto 1fr!important;gap:4px 12px!important;margin:10px 0!important}
.alm-script__n{font:500 11px/1.9 var(--alm-font-mono)!important;letter-spacing:.1em;color:var(--c)!important;text-align:right;border-right:2px solid color-mix(in oklab,var(--c) 35%,transparent);padding-right:8px;text-transform:uppercase}
.alm-script__par{color:var(--alm-muted);font-style:italic;font-size:.92em}
/* thought bubble */
.alm-thk{--c:var(--alm-muted);position:relative!important;display:block!important;width:fit-content;max-width:88%;margin:16px 0 24px 58px!important;padding:10px 20px 12px!important;border-radius:30px!important;
  background:color-mix(in oklab,var(--c) 8%,var(--alm-panel))!important;border:1.5px dashed color-mix(in oklab,var(--c) 50%,var(--alm-line))!important;
  font:600 22px/1.25 var(--alm-font-hand)!important;color:color-mix(in oklab,var(--c) 62%,var(--alm-ink))!important;font-style:normal!important}
.alm-thk::before,.alm-thk::after{content:"";position:absolute;border-radius:50%;background:inherit;border:inherit}
.alm-thk::before{width:15px;height:15px;left:-22px;top:14px}
.alm-thk::after{width:8px;height:8px;left:-38px;top:6px}
.alm-thk__lab{display:block!important;font:500 9.5px/1.6 var(--alm-font-mono)!important;letter-spacing:.16em!important;text-transform:uppercase!important;color:var(--c)!important}
/* painted sign */
.alm-txt{display:inline-block!important;padding:3px 18px!important;border-radius:6px!important;transform-origin:50% -14px;
  background:radial-gradient(circle at 7px 50%,#c9a24a 0 2px,transparent 2.5px),radial-gradient(circle at calc(100% - 7px) 50%,#c9a24a 0 2px,transparent 2.5px),linear-gradient(#2f4c40,#1d3429)!important;
  color:#f3e4b5!important;border:2px solid #c9a24a!important;box-shadow:inset 0 0 0 2px #17291f,0 6px 10px -5px rgba(0,0,0,.45)!important;
  font:500 .72em/1.5 var(--alm-font-mono)!important;letter-spacing:.16em!important;text-transform:uppercase!important}
.alm-txt[data-kind="screen"]{background:#0b1512!important;color:#7dffb8!important;border-color:#1e3b30!important;box-shadow:0 0 12px rgba(80,255,170,.18)!important}
.alm-txt[data-kind="neon"]{background:#150b1a!important;color:#ff7ad9!important;border-color:#ff7ad9!important;text-shadow:0 0 8px #ff7ad9}
.alm-txt[data-kind="chalk"]{background:#253028!important;color:#eef0e8!important;border-color:#6b5a3a!important;font-family:var(--alm-font-hand)!important;font-size:1em!important;text-transform:none!important;letter-spacing:.02em!important}

/* chapter card, OOC card, folio */
.alm-chapter{display:grid!important;grid-template-columns:1fr auto 1fr!important;align-items:center!important;gap:16px!important;margin:28px 0 22px!important;text-align:center!important}
.alm-chapter::before,.alm-chapter::after{content:"";height:10px;background:radial-gradient(circle,var(--alm-gold) 0 2.5px,transparent 3px) center/10px 10px no-repeat,linear-gradient(var(--alm-gold),var(--alm-gold)) center/100% 1px no-repeat;
  -webkit-mask:linear-gradient(90deg,transparent,#000 60%);mask:linear-gradient(90deg,transparent,#000 60%)}
.alm-chapter::after{transform:scaleX(-1)}
.alm-chapter small{display:block!important;font:500 10.5px/1 var(--alm-font-mono)!important;letter-spacing:.3em!important;text-transform:uppercase!important;color:var(--alm-accent)!important}
.alm-chapter b{display:block!important;margin-top:6px!important;font:600 italic 26px/1.1 var(--alm-font-display)!important;color:var(--alm-ink)!important}
.alm-chapter b::before,.alm-chapter b::after{content:"❦";font-style:normal;font-size:.6em;color:var(--alm-gold);margin:0 .5em;vertical-align:.18em}
.alm-chapter b::before{display:inline-block;transform:scaleX(-1)}
.alm-ooc{position:relative!important;margin:14px 0!important;padding:14px 16px 12px!important;border:1.5px dashed var(--alm-line)!important;border-radius:var(--alm-r-sm)!important;background:var(--alm-panel-2)!important;color:var(--alm-muted)!important;font-size:.95em}
.alm-ooc::before{content:"OOC";position:absolute;top:-10px;left:14px;padding:2px 8px;border-radius:6px;background:var(--alm-muted);color:var(--alm-panel);font:500 10px/1.4 var(--alm-font-mono);letter-spacing:.16em}
.alm-folio{margin:14px 0!important;border:1px solid var(--alm-line)!important;border-radius:var(--alm-r-sm)!important;background:var(--alm-panel)!important;box-shadow:var(--alm-shadow)!important;overflow:hidden}
.alm-folio__hd{padding:10px 14px!important;background:linear-gradient(90deg,var(--alm-accent),color-mix(in oklab,var(--alm-accent) 60%,var(--alm-accent-2)))!important;color:var(--alm-on-voice)!important;font:600 12px/1.2 var(--alm-font-mono)!important;letter-spacing:.16em;text-transform:uppercase}
.alm-folio__bd{padding:12px 16px!important}

/* ── Drawers (unspoken, director's notes, ledger) ── */
details.alm-drawer{margin:16px 0 0!important;background:var(--alm-panel)!important;border:1px solid var(--alm-line)!important;border-radius:var(--alm-r-sm)!important;overflow:hidden!important;color:var(--alm-ink)!important;font-family:var(--alm-font-body)}
details.alm-drawer>summary{list-style:none!important;cursor:pointer;display:flex!important;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px!important;font:500 12.5px/1.2 var(--alm-font-mono)!important;color:var(--alm-muted)!important;background:var(--alm-panel-2)!important}
details.alm-drawer>summary::-webkit-details-marker{display:none}
details.alm-drawer[open]>summary{border-bottom:1px solid var(--alm-line)}
.alm-drawer__body{padding:14px!important}
.alm-pill{display:inline-flex!important;align-items:center;gap:6px;padding:6px 10px!important;border-radius:999px!important;background:var(--alm-panel)!important;border:1px solid var(--alm-line)!important;color:var(--alm-ink)!important}
.alm-pill small{color:var(--alm-muted)}
.alm-pill--warn{color:var(--alm-warn)!important;border-color:color-mix(in oklab,var(--alm-warn) 45%,var(--alm-line))!important}
.alm-stack{display:inline-flex}
.alm-stack .alm-mini{margin-left:-5px;box-shadow:0 0 0 2px var(--alm-panel)}
.alm-stack .alm-mini:first-child{margin-left:0}
.alm-caret{margin-left:auto;display:inline-flex!important;align-items:center;gap:8px;padding:6px 11px!important;border-radius:999px!important;background:var(--alm-accent)!important;color:var(--alm-panel)!important;font-weight:500}
.alm-caret::after{content:"▾";transition:transform .25s}
details[open]>summary .alm-caret::after{transform:rotate(180deg)}
.alm-mini{--c:var(--alm-muted);display:inline-grid!important;place-items:center;flex:none;width:22px!important;height:22px!important;border-radius:50%!important;background:var(--c)!important;color:var(--alm-on-voice)!important;font:700 10.5px/1 var(--alm-font-display)!important}

/* sealed envelopes */
.alm-envs{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important;gap:12px!important;align-items:start}
details.alm-env{--c:var(--alm-muted);position:relative!important;border-radius:10px!important;background:color-mix(in oklab,var(--c) 7%,var(--alm-panel-2))!important;
  border:1px solid color-mix(in oklab,var(--c) 25%,var(--alm-line))!important;box-shadow:var(--alm-lift)!important;overflow:hidden!important;perspective:600px}
details.alm-env>summary{list-style:none!important;cursor:pointer;position:relative;min-height:112px;padding:62px 14px 12px!important;text-align:center}
details.alm-env>summary::-webkit-details-marker{display:none}
.alm-env__flap{position:absolute!important;left:0;right:0;top:0;height:64px;transform-origin:top;transition:transform .5s cubic-bezier(.3,.7,.3,1);
  background:color-mix(in oklab,var(--c) 16%,var(--alm-panel-2))!important;clip-path:polygon(0 0,100% 0,50% 100%);filter:drop-shadow(0 2px 0 rgba(0,0,0,.08))}
.alm-env__wax{position:absolute!important;left:50%;top:40px;width:38px;height:38px;margin-left:-19px;border-radius:50%;display:grid!important;place-items:center;z-index:1;
  background:radial-gradient(circle at 35% 30%,color-mix(in oklab,var(--c) 60%,#fff),var(--c) 60%,color-mix(in oklab,var(--c) 60%,#000))!important;
  color:var(--alm-on-voice)!important;font:700 15px/1 var(--alm-font-display)!important;box-shadow:0 3px 8px rgba(0,0,0,.3),inset 0 0 0 3px rgba(0,0,0,.12);transition:transform .4s,opacity .4s}
.alm-env__cue{display:block!important;margin-top:12px;font:500 10.5px/1.45 var(--alm-font-mono)!important;letter-spacing:.06em;text-transform:uppercase;color:var(--alm-muted)!important}
.alm-env__hint{display:block!important;margin-top:6px;font:italic 12px/1 var(--alm-font-body)!important;color:var(--c)!important}
.alm-env__hint::after{content:"break the seal"}
details.alm-env[open] .alm-env__hint::after{content:"reseal"}
details.alm-env[open] .alm-env__flap{transform:rotateX(180deg)}
details.alm-env[open] .alm-env__wax{transform:translateY(-44px) scale(.7);opacity:0}
.alm-env__inner{margin:0 12px 14px!important;padding:12px 14px!important;border-radius:6px!important;background:var(--alm-panel)!important;border:1px solid var(--alm-line)!important;
  font:600 21px/1.3 var(--alm-font-hand)!important;color:var(--alm-ink)!important;box-shadow:0 -8px 16px -12px rgba(0,0,0,.3)}
.alm-env__inner::after{content:"— " attr(data-who);display:block;text-align:right;font-size:17px;color:var(--c)}
.alm-lockcap{display:flex!important;align-items:center;gap:8px;font:12px/1.4 var(--alm-font-mono)!important;color:var(--alm-muted)!important;margin-top:12px!important}

/* director's call sheet */
.alm-clap{height:14px;margin:-14px -14px 14px;background:repeating-linear-gradient(-45deg,var(--alm-ink) 0 14px,var(--alm-panel) 14px 28px);opacity:.85}
.alm-cs{display:grid!important;grid-template-columns:auto 1fr!important;gap:7px 12px!important;margin:0!important;font-size:14px;line-height:1.45}
.alm-cs dt{align-self:start;font:500 10px/1 var(--alm-font-mono)!important;letter-spacing:.12em;padding:5px 8px!important;border-radius:6px;color:var(--alm-panel)!important;background:var(--g,var(--alm-accent-2))!important;text-align:center}
.alm-cs dd{margin:0!important;padding-top:1px}
.alm-cs .g1{--g:var(--alm-accent-2)} .alm-cs .g2{--g:#7b5bd6} .alm-cs .g3{--g:var(--alm-accent)} .alm-cs .g4{--g:var(--alm-good)}
.alm-cs .risk{color:var(--alm-danger);font-weight:600}

/* ledger drawer sections */
details.alm-sub{margin:0 0 12px!important;border:1px solid var(--alm-line)!important;border-radius:var(--alm-r-sm)!important;background:var(--alm-panel)!important}
details.alm-sub>summary{list-style:none!important;cursor:pointer;display:flex!important;align-items:center;gap:10px;padding:10px 12px!important;font:500 11px/1 var(--alm-font-mono)!important;letter-spacing:.16em;text-transform:uppercase;color:var(--alm-ink)!important}
details.alm-sub>summary::-webkit-details-marker{display:none}
.alm-sub__ico{display:grid!important;place-items:center;width:26px;height:26px;border-radius:8px;background:color-mix(in oklab,var(--alm-accent) 14%,var(--alm-panel));font-size:13px;letter-spacing:0}
.alm-sub__ct{margin-left:auto;color:var(--alm-muted);letter-spacing:.06em;text-transform:none}
.alm-sub__ct::after{content:" ▸";display:inline-block;transition:transform .2s}
details.alm-sub[open]>summary .alm-sub__ct::after{transform:rotate(90deg)}
.alm-sub__in{padding:4px 12px 14px!important}
.alm-deltas{margin:10px 0 0;padding-left:18px;font-size:13.5px;line-height:1.5;color:var(--alm-ink)}
.alm-rejected{margin-top:10px;padding:8px 10px;border-radius:10px;background:color-mix(in oklab,var(--alm-danger) 8%,var(--alm-panel));color:var(--alm-danger);font-size:12.5px}
.alm-rejected code{font:11px var(--alm-font-mono)}
.alm-list{margin:0;padding-left:18px;font-size:13.5px;line-height:1.55}
.alm-list li.due{color:var(--alm-danger);font-weight:600}
.alm-cast{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))!important;gap:12px}
.alm-cc{--c:var(--alm-muted);position:relative;border-radius:var(--alm-r-sm);background:var(--alm-panel);border:1px solid color-mix(in oklab,var(--c) 30%,var(--alm-line));overflow:hidden;box-shadow:var(--alm-lift)}
.alm-cc__band{position:relative;height:50px;background:repeating-linear-gradient(-45deg,rgba(255,255,255,.12) 0 6px,transparent 6px 12px),linear-gradient(120deg,var(--c),color-mix(in oklab,var(--c) 55%,var(--alm-accent-2)))}
.alm-cc__tier{position:absolute;right:10px;top:10px;padding:4px 8px;border-radius:999px;background:rgba(0,0,0,.22);color:#fff;font:500 9.5px/1 var(--alm-font-mono);letter-spacing:.12em;text-transform:uppercase}
.alm-cc .alm-cc__medal{position:absolute!important;left:12px;top:24px;margin:0!important;width:46px!important;height:46px!important}
.alm-cc__bd{padding:28px 12px 12px}
.alm-cc__nm{font:700 17px/1.1 var(--alm-font-display)}
.alm-cc__em{margin-top:2px;font:italic 14px/1.3 var(--alm-font-body);color:var(--c)}
.alm-cc__em small{color:var(--alm-muted);font-style:normal}
.alm-vad{display:grid;grid-template-columns:14px 1fr;gap:6px 8px;align-items:center;margin:12px 0 10px;font:500 10px/1 var(--alm-font-mono);color:var(--alm-muted)}
.alm-slider{position:relative;height:6px;border-radius:3px;background:linear-gradient(90deg,color-mix(in oklab,var(--c) 10%,var(--alm-panel-2)),color-mix(in oklab,var(--c) 45%,var(--alm-panel-2)))}
.alm-slider::before{content:"";position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:var(--alm-line)}
.alm-slider i{position:absolute;left:calc(var(--v)*100%);top:50%;width:13px;height:13px;border-radius:50%;transform:translate(-50%,-50%);background:var(--alm-panel);border:3px solid var(--c);box-shadow:0 2px 5px rgba(0,0,0,.25)}
.alm-meters{display:grid;grid-template-columns:70px 1fr;gap:5px 8px;align-items:center;font:500 10.5px/1.2 var(--alm-font-mono);color:var(--alm-muted)}
.alm-seg{display:grid;grid-template-columns:repeat(5,1fr);gap:3px}
.alm-seg i{height:7px;border-radius:2px;background:var(--alm-panel-2);box-shadow:inset 0 0 0 1px var(--alm-line)}
.alm-seg i.on{background:var(--m,var(--c));box-shadow:none}
.m-hp{--m:#d9534f} .m-fat{--m:#8f6bd6} .m-hun{--m:#d99a2b} .m-cold{--m:#4d9bd6} .m-drink{--m:#c9772b} .m-comp{--m:var(--c)} .m-heart{--m:#e05a8a}
.alm-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
.alm-tag{font:500 10.5px/1 var(--alm-font-mono);padding:5px 8px;border-radius:999px;background:var(--alm-panel-2);border:1px solid var(--alm-line);color:var(--alm-muted)}
.alm-tag.warn{color:var(--alm-danger);border-color:color-mix(in oklab,var(--alm-danger) 40%,var(--alm-line));background:color-mix(in oklab,var(--alm-danger) 8%,var(--alm-panel))}
.alm-cc__row{display:flex;gap:8px;font-size:13.5px;line-height:1.4;margin-top:8px}
.alm-cc__row b{flex:none;width:44px;font:500 9.5px/1.9 var(--alm-font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--alm-muted)}
.alm-bond{padding:12px 0;border-bottom:1px dashed var(--alm-line)}
.alm-bond:last-child{border-bottom:0}
.alm-bond__pair,.alm-ladder{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.alm-bond__link{position:relative;width:52px;height:2px;border-radius:1px;background:linear-gradient(90deg,var(--ca,var(--alm-muted)),var(--cb,var(--alm-muted)))}
.alm-bond__link::after{content:"";position:absolute;right:-2px;top:-4px;border:5px solid transparent;border-left:7px solid var(--cb,var(--alm-muted));border-right:0}
.alm-bond__axis{font:500 10.5px/1 var(--alm-font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--alm-muted);margin-left:4px}
.alm-bond__d{margin-left:auto;padding:4px 9px;border-radius:999px;font:500 11px/1 var(--alm-font-mono)}
.alm-bond__d.up{color:var(--alm-good);background:color-mix(in oklab,var(--alm-good) 12%,var(--alm-panel))}
.alm-bond__d.dn{color:var(--alm-danger);background:color-mix(in oklab,var(--alm-danger) 12%,var(--alm-panel))}
.alm-move{position:relative;height:10px;margin:12px 0 6px;border-radius:5px;background:linear-gradient(90deg,color-mix(in oklab,var(--alm-danger) 16%,var(--alm-panel-2)),var(--alm-panel-2) 50%,color-mix(in oklab,var(--alm-good) 16%,var(--alm-panel-2)))}
.alm-move::before{content:"";position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:var(--alm-muted);opacity:.5}
.alm-move__trail{position:absolute;top:2px;bottom:2px;left:calc(min(var(--from),var(--to))*100%);width:calc(max(var(--from) - var(--to),var(--to) - var(--from))*100%);border-radius:3px;background:var(--ca);opacity:.35}
.alm-move__ghost,.alm-move__now{position:absolute;top:50%;width:14px;height:14px;border-radius:50%;transform:translate(-50%,-50%)}
.alm-move__ghost{left:calc(var(--from)*100%);border:2px dashed var(--ca);background:var(--alm-panel);opacity:.7}
.alm-move__now{left:calc(var(--to)*100%);background:var(--ca);box-shadow:0 0 0 3px var(--alm-panel),0 2px 8px rgba(0,0,0,.3)}
.alm-scale{display:flex;justify-content:space-between;font:500 9px/1 var(--alm-font-mono);color:var(--alm-muted)}
.alm-bond__why{margin-top:6px;color:var(--alm-muted);font-style:italic;font-size:14px}
.alm-ladder{padding:10px 0}
.alm-ladder__steps{display:inline-flex;gap:3px}
.alm-ladder__steps i{width:14px;height:8px;border-radius:2px;background:var(--alm-panel-2);box-shadow:inset 0 0 0 1px var(--alm-line)}
.alm-ladder__steps i.on{background:linear-gradient(90deg,#ff9fb4,#e0566b);box-shadow:none}
.alm-inv{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.alm-it{display:grid;grid-template-columns:40px 1fr;gap:10px;align-items:start;border:1px solid var(--alm-line);border-radius:var(--alm-r-sm);padding:10px;background:var(--alm-panel-2);font-size:13.5px;line-height:1.4}
.alm-it__ic{display:grid;place-items:center;width:40px;height:40px;border-radius:10px;font-size:20px;background:linear-gradient(135deg,color-mix(in oklab,var(--alm-gold) 30%,var(--alm-panel)),var(--alm-panel));box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--alm-gold) 40%,var(--alm-line))}
.alm-it b{display:block;font:700 14.5px/1.25 var(--alm-font-display)}
.alm-it__h{display:flex;align-items:center;gap:5px;margin:3px 0;font:500 10.5px/1.3 var(--alm-font-mono);color:var(--alm-muted)}
.alm-it__h .alm-mini{width:16px!important;height:16px!important;font-size:8.5px!important}
.alm-clocks{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}
.alm-clock{display:flex;gap:12px;align-items:center;font-size:13.5px;line-height:1.35}
.alm-clock__face{position:relative;flex:none;width:58px;height:58px}
.alm-ring{--n:3;--of:6;--rc:var(--alm-accent);position:absolute;inset:0;border-radius:50%;
  background:repeating-conic-gradient(var(--alm-panel) 0 3deg,transparent 3deg calc(360deg / var(--of))),conic-gradient(var(--rc) calc(var(--n) / var(--of) * 360deg),color-mix(in oklab,var(--rc) 12%,var(--alm-panel-2)) 0);
  -webkit-mask:radial-gradient(circle,transparent 54%,#000 55%);mask:radial-gradient(circle,transparent 54%,#000 55%)}
.alm-clock__face b{position:absolute;inset:0;display:grid;place-items:center;font:600 13px/1 var(--alm-font-display)}
.alm-clock strong{display:block;font:700 14px/1.25 var(--alm-font-display)}
.alm-clock span{font:500 10.5px/1.4 var(--alm-font-mono);color:var(--alm-muted)}
.alm-km{width:100%;border-collapse:separate;border-spacing:0 6px;font-size:13.5px}
.alm-km th{font:500 10px/1.2 var(--alm-font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--alm-muted);text-align:left;padding:0 6px}
.alm-km td{padding:8px 6px;background:var(--alm-panel-2);vertical-align:middle}
.alm-km td:first-child{border-radius:10px 0 0 10px;font-weight:600}
.alm-km td:last-child{border-radius:0 10px 10px 0}
.alm-kp{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font:500 11px/1.2 var(--alm-font-mono);white-space:nowrap}
.alm-kp.knows{color:var(--alm-good);background:color-mix(in oklab,var(--alm-good) 13%,var(--alm-panel))}
.alm-kp.sus{color:var(--alm-warn);background:color-mix(in oklab,var(--alm-warn) 14%,var(--alm-panel))}
.alm-kp.wrong{color:var(--alm-danger);background:color-mix(in oklab,var(--alm-danger) 13%,var(--alm-panel));box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--alm-danger) 40%,transparent)}
.alm-kp.un{color:var(--alm-muted);border:1px dashed var(--alm-line)}
.alm-irony{display:flex;gap:12px;align-items:center;margin-top:10px;padding:10px 14px;border-radius:var(--alm-r-sm);font-size:14px;
  background:linear-gradient(var(--alm-panel),var(--alm-panel)) padding-box,linear-gradient(120deg,#7b5bd6,var(--alm-danger),var(--alm-gold)) border-box;border:1.5px solid transparent}
.alm-irony .i{font-size:22px}
.alm-fc{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:8px}
.alm-fc div{display:grid;justify-items:center;gap:3px;padding:8px 4px;border-radius:10px;background:var(--alm-panel-2);font:500 11px/1 var(--alm-font-mono)}
.alm-fc span{font-size:18px}
/* director's desk keycaps (regex actions) */
.alm-desk{display:flex!important;flex-wrap:wrap;gap:9px;margin-top:14px!important;padding-top:14px!important;border-top:1px dashed var(--alm-line)!important}
.alm-btn{display:inline-flex!important;align-items:center;gap:7px;padding:9px 13px!important;border-radius:11px!important;cursor:pointer;
  font:500 12.5px/1 var(--alm-font-mono)!important;color:var(--alm-ink)!important;background:linear-gradient(var(--alm-panel),var(--alm-panel-2))!important;
  border:1px solid var(--alm-line)!important;box-shadow:0 3px 0 var(--alm-line),0 8px 14px -10px rgba(0,0,0,.45)!important;transition:transform .08s,box-shadow .08s}
.alm-btn:active{transform:translateY(2px);box-shadow:0 1px 0 var(--alm-line)!important}
.alm-btn--primary{color:var(--alm-on-voice)!important;background:linear-gradient(color-mix(in oklab,var(--alm-accent) 85%,#fff),var(--alm-accent))!important;border-color:color-mix(in oklab,var(--alm-accent) 70%,#000)!important;box-shadow:0 3px 0 color-mix(in oklab,var(--alm-accent) 60%,#000),0 8px 14px -10px rgba(0,0,0,.45)!important}
.alm-btn[data-lumiverse-regex-action-used="true"]{opacity:.45;transform:none;cursor:default}
/* HUD strip */
.alm-hud{display:flex!important;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:8px 12px 8px 8px!important;border-radius:999px!important;background:linear-gradient(90deg,#1c2146,#3a3060 60%,#6a4a6a)!important;color:#fff!important;
  font:500 12px/1 var(--alm-font-mono)!important;box-shadow:var(--alm-lift);margin:0 0 12px!important}
.alm-dial{--h:12;--rise:6.5;--set:18.5;position:relative;flex:none;width:34px;height:34px;border-radius:50%;
  background:conic-gradient(from 180deg,#1d2250 0deg calc(var(--rise)*15deg - 10deg),#f19a6b calc(var(--rise)*15deg),#ffd978 calc(var(--rise)*15deg + 14deg) calc(var(--set)*15deg - 14deg),#ef7f69 calc(var(--set)*15deg),#1d2250 calc(var(--set)*15deg + 10deg));
  box-shadow:0 0 0 1px rgba(255,255,255,.25)}
.alm-dial::before{content:"";position:absolute;inset:5px;border-radius:50%;background:rgba(8,10,24,.72)}
.alm-dial__mk{position:absolute;inset:0;transform:rotate(calc(180deg + var(--h)*15deg))}
.alm-dial__mk::before{content:"";position:absolute;left:50%;top:-1px;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.35),0 0 10px 3px rgba(255,255,255,.7)}
.alm-hud__who{display:inline-flex;align-items:center;gap:4px}
.alm-hud__dot{width:7px;height:7px;border-radius:50%;background:var(--md);box-shadow:0 0 6px var(--md)}

@media (prefers-reduced-motion: no-preference){
  .alm-say[data-tone="shout"] .alm-say__bubble{animation:alm-jolt .5s cubic-bezier(.3,1.6,.5,1) both}
  .alm-say[data-tone="shout"] .alm-say__medal::before{animation:alm-spin 16s linear infinite}
  .alm-thk{animation:alm-bob 5s ease-in-out infinite}
  .alm-txt{animation:alm-swing 3.6s ease-in-out infinite}
  .alm-dial__mk::before{animation:alm-pulse 2.8s ease-in-out infinite}
}
@keyframes alm-jolt{0%{transform:scale(.94) rotate(1.5deg)}60%{transform:scale(1.02) rotate(-1.2deg)}100%{transform:rotate(-.7deg)}}
@keyframes alm-spin{to{transform:rotate(1turn)}}
@keyframes alm-bob{50%{transform:translateY(-3px)}}
@keyframes alm-swing{0%,100%{transform:rotate(-2.2deg)}50%{transform:rotate(2.2deg)}}
@keyframes alm-pulse{50%{box-shadow:0 0 0 2px rgba(0,0,0,.35),0 0 16px 6px rgba(255,255,255,.9)}}

@media (max-width:560px){
  .alm-say{grid-template-columns:34px minmax(0,1fr)!important;gap:0 12px!important}
  .alm-say__medal{width:34px!important;height:34px!important;font-size:15px!important}
  .alm-say--user{margin-left:0!important;grid-template-columns:minmax(0,1fr) 34px!important}
  .alm-thk{margin-left:40px!important;font-size:20px!important}
  .alm-cs{grid-template-columns:1fr!important;gap:3px!important}
  .alm-cs dt{justify-self:start}
  .alm-cs dd{margin-bottom:8px!important}
  .alm-km,.alm-km tbody,.alm-km tr,.alm-km td{display:block}
  .alm-km tr:first-child{display:none}
  .alm-km tr{margin:0 0 8px;padding:10px 12px;border-radius:12px;background:var(--alm-panel-2)}
  .alm-km td{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:3px 0;background:none;border-radius:0!important}
  .alm-km td[data-who]::before{content:attr(data-who);font:500 10.5px/1 var(--alm-font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--alm-muted)}
}
`;
var PANEL_CSS = `
.almp{--c:var(--alm-accent);color:var(--alm-ink);font-family:var(--alm-font-body);font-size:14px;line-height:1.5;padding:10px 10px 40px}
.almp *{box-sizing:border-box}
.almp h3{margin:14px 0 8px;font:600 17px/1.2 var(--alm-font-display)}
.almp h4{margin:12px 0 6px;font:500 10.5px/1 var(--alm-font-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--alm-muted)}
.almp .muted{color:var(--alm-muted)}
.almp .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.almp .grow{flex:1;min-width:0}
.almp .tabs{position:sticky;top:0;z-index:5;display:flex;gap:2px;padding:4px;margin:0 0 12px;border-radius:12px;background:var(--alm-panel-2);overflow-x:auto;scrollbar-width:none}
.almp .tabs button{all:unset;flex:none;cursor:pointer;font:500 11.5px/1 var(--alm-font-mono);padding:8px 10px;border-radius:9px;color:var(--alm-muted)}
.almp .tabs button[aria-selected="true"]{color:var(--alm-ink);background:var(--alm-panel);box-shadow:0 1px 3px rgba(0,0,0,.15),0 0 0 1px var(--alm-line)}
.almp .card{background:var(--alm-panel);border:1px solid var(--alm-line);border-radius:var(--alm-r-sm);padding:12px;margin:0 0 10px;box-shadow:var(--alm-lift)}
.almp .card.flat{box-shadow:none}
.almp .hero{position:relative;overflow:hidden;border-radius:var(--alm-radius);padding:16px;color:#fff;min-height:120px;background:linear-gradient(180deg,#27295a,#6d4a7d 50%,#e0866b);box-shadow:var(--alm-shadow)}
.almp .hero .t{font:700 22px/1.1 var(--alm-font-display);margin-top:8px;text-shadow:0 2px 14px rgba(0,0,0,.5)}
.almp .hero .gl{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);font:500 11.5px/1 var(--alm-font-mono);margin:6px 6px 0 0}
.almp .btn{all:unset;display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:7px 11px;border-radius:10px;font:500 12px/1 var(--alm-font-mono);background:linear-gradient(var(--alm-panel),var(--alm-panel-2));border:1px solid var(--alm-line);box-shadow:0 2px 0 var(--alm-line)}
.almp .btn:active{transform:translateY(1px);box-shadow:none}
.almp .btn.primary{background:var(--alm-accent);color:var(--alm-on-voice);border-color:color-mix(in oklab,var(--alm-accent) 70%,#000)}
.almp .btn.danger{color:var(--alm-danger)}
.almp .btn[disabled]{opacity:.5;pointer-events:none}
.almp input[type=text],.almp input[type=number],.almp textarea,.almp select{width:100%;padding:7px 9px;border-radius:9px;border:1px solid var(--alm-line);background:var(--alm-panel-2);color:var(--alm-ink);font:inherit}
.almp textarea{min-height:70px;resize:vertical}
.almp label.f{display:grid;gap:4px;margin:0 0 10px;font:500 11px/1.3 var(--alm-font-mono);color:var(--alm-muted)}
.almp label.chk{display:flex;gap:8px;align-items:center;margin:6px 0}
.almp .pill{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:var(--alm-panel-2);border:1px solid var(--alm-line);font:500 11px/1.2 var(--alm-font-mono);color:var(--alm-muted);margin:2px}
.almp .pill.on{color:var(--alm-on-voice);background:var(--alm-accent);border-color:transparent}
.almp .kv{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;font-size:13px}
.almp .kv b{font:500 10.5px/1.7 var(--alm-font-mono);color:var(--alm-muted);text-transform:uppercase;letter-spacing:.08em}
.almp .list{display:grid;gap:8px}
.almp .rec{padding:10px;border-radius:10px;background:var(--alm-panel-2);border:1px solid var(--alm-line)}
.almp .rec .hd{display:flex;gap:8px;align-items:center}
.almp .rec .hd b{font:600 14px/1.2 var(--alm-font-display)}
.almp .kind{font:500 9.5px/1 var(--alm-font-mono);letter-spacing:.1em;text-transform:uppercase;padding:3px 6px;border-radius:5px;background:color-mix(in oklab,var(--alm-accent) 14%,var(--alm-panel));color:var(--alm-accent)}
.almp .bar{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--alm-panel-2)}
.almp .bar i{display:block;height:100%}
.almp .graph{width:100%;height:auto;border-radius:var(--alm-r-sm);background:radial-gradient(circle,color-mix(in oklab,var(--alm-muted) 22%,transparent) 1px,transparent 1.4px) 0 0/18px 18px,var(--alm-panel-2)}
.almp .graph .nm{font:700 12px var(--alm-font-display);fill:var(--alm-ink)}
.almp .graph .ini{font:700 15px var(--alm-font-display);fill:var(--alm-on-voice)}
.almp .graph .lbl{font:500 9.5px var(--alm-font-mono);fill:var(--alm-muted);paint-order:stroke;stroke:var(--alm-panel-2);stroke-width:4px;stroke-linejoin:round}
.almp .graph .spark{stroke:var(--alm-panel);stroke-dasharray:2 22;stroke-width:3.2}
@media (prefers-reduced-motion: no-preference){.almp .graph .spark{animation:alm-spark 1.6s linear infinite}}
@keyframes alm-spark{to{stroke-dashoffset:-24}}
.almp .feed .it{display:grid;grid-template-columns:48px 1fr;gap:8px;padding:6px 0;border-bottom:1px dashed var(--alm-line);font-size:12.5px}
.almp .feed .sc{font:600 12px/1.6 var(--alm-font-mono);text-align:right}
.almp .feed .it.in .sc{color:var(--alm-good)}
.almp pre{white-space:pre-wrap;font:12px/1.5 var(--alm-font-mono);background:var(--alm-panel-2);border:1px solid var(--alm-line);border-radius:10px;padding:10px;max-height:320px;overflow:auto}
.almp .empty{padding:18px;text-align:center;color:var(--alm-muted);border:1px dashed var(--alm-line);border-radius:var(--alm-r-sm)}
.almp .swatch{width:22px;height:22px;border-radius:50%;border:2px solid var(--alm-panel);box-shadow:0 0 0 1px var(--alm-line);padding:0;cursor:pointer}
.almp .spoiler{filter:blur(5px);transition:filter .2s;cursor:pointer}.almp .spoiler:hover,.almp .spoiler:focus{filter:none}
.almp .timeline{position:relative;padding-left:18px}
.almp .timeline::before{content:"";position:absolute;left:5px;top:4px;bottom:4px;width:2px;background:var(--alm-line)}
.almp .timeline .ev{position:relative;margin:0 0 10px;font-size:13px}
.almp .timeline .ev::before{content:"";position:absolute;left:-17px;top:5px;width:10px;height:10px;border-radius:50%;background:var(--alm-accent);box-shadow:0 0 0 3px var(--alm-panel)}
.almp .timeline .ev small{display:block;font:500 10.5px/1.3 var(--alm-font-mono);color:var(--alm-muted)}
.alm-hudw{width:100%;height:100%;display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:linear-gradient(90deg,#1c2146,#3a3060 60%,#6a4a6a);color:#fff;font:500 11.5px/1 var(--alm-font-mono);box-shadow:0 10px 26px -12px rgba(0,0,0,.7);cursor:grab;overflow:hidden;white-space:nowrap}
.alm-hudw__dim{opacity:.7;font-style:italic}
.alm-sz{font-size:14px}
.alm-sz .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}
@media (max-width:560px){.alm-sz .grid{grid-template-columns:1fr}}
`;

// src/frontend/sessionzero.ts
var GENRES = [
  ["slice_of_life", "Slice of life"],
  ["romance", "Romance"],
  ["drama", "Drama"],
  ["comedy", "Comedy"],
  ["mystery", "Mystery"],
  ["thriller", "Thriller"],
  ["horror", "Horror"],
  ["fantasy", "Fantasy"],
  ["dark_fantasy", "Dark fantasy"],
  ["scifi", "Science fiction"],
  ["adventure", "Adventure"],
  ["noir", "Noir"],
  ["intrigue", "Political intrigue"],
  ["tragedy", "Tragedy"],
  ["action", "Action"],
  ["cozy", "Cozy"],
  ["survival", "Survival"],
  ["erotic", "Erotic romance"]
];
var TONES = [["", "(preset setting)"], ["balanced", "Balanced"], ["warm", "Warm"], ["wry", "Wry"], ["melancholy", "Melancholy"], ["tense", "Tense"], ["lurid", "Lurid"], ["austere", "Austere"]];
var PERSONA = [["", "(preset setting)"], ["sealed", "Sealed — only I write my persona"], ["continuity", "Continuity — finish my obvious actions"], ["director", "Director — perform what I direct"], ["full_cast", "Full cast — write my persona too"]];
var NSFW = [["", "(preset setting)"], ["off", "Off"], ["fade", "Fade to black"], ["sensual", "Sensual"], ["explicit", "Explicit (adults only)"]];
var ROMANCE = [["", "(preset setting)"], ["off", "Off"], ["slow", "Slow burn"], ["measured", "Measured"], ["fast", "Fast"], ["established", "Established couple"]];
var DIFFICULTY = [["", "(preset setting)"], ["gentle", "Gentle"], ["grounded", "Grounded"], ["hard", "Hard"], ["brutal", "Brutal"]];
var THEMES = [["", "Auto (by genre)"], ["almanac", "Almanac"], ["solar", "Solar Editorial"], ["nocturne", "Nocturne"], ["botanical", "Botanical"], ["prism", "Prism"], ["candy", "Candy"]];
var TRACKERS = [["scene", "Scene"], ["cast", "Cast"], ["bonds", "Bonds"], ["thoughts", "Thoughts"], ["inventory", "Inventory"], ["threads", "Threads & clocks"], ["knowledge", "Knowledge"], ["consequences", "Consequences"], ["world", "World"]];
function openSessionZero(ctx, chatId, current) {
  let modal;
  try {
    modal = ctx.ui.showModal({ title: "Session Zero · ALMANAC", width: 640, maxHeight: 760 });
  } catch {
    return;
  }
  const cfg = current ?? {};
  const sel = (id, opts, val) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${k}"${(val ?? "") === k ? " selected" : ""}>${escapeHtml(l)}</option>`).join("")}</select>`;
  const genres = new Set(cfg.genres ?? []);
  const trackers = new Set(cfg.trackers ?? ["scene", "cast", "bonds", "thoughts", "inventory", "threads", "knowledge"]);
  modal.root.innerHTML = `<div class="almp alm-sz">
<p class="muted">Set the story up once. These override the preset's settings for this chat only (you can change them any time here or in the Almanac tab).</p>
<h4>Genres (first = lead)</h4><div id="almSzGenres">${GENRES.map(([k, l]) => `<button type="button" class="pill${genres.has(k) ? " on" : ""}" data-g="${k}">${escapeHtml(l)}</button>`).join("")}</div>
<div class="grid" style="margin-top:10px">
<label class="f">Tone${sel("szTone", TONES, cfg.tone)}</label>
<label class="f">Your persona${sel("szPersona", PERSONA, cfg.personaMode)}</label>
<label class="f">Romance pace${sel("szRomance", ROMANCE, cfg.romance)}</label>
<label class="f">Difficulty${sel("szDifficulty", DIFFICULTY, cfg.difficulty)}</label>
<label class="f">Intimacy${sel("szNsfw", NSFW, cfg.nsfw)}</label>
<label class="f">Skin${sel("szTheme", THEMES, cfg.theme)}</label>
</div>
<label class="f">Hard limits (never depict)<input type="text" id="szLimits" value="${escapeHtml(cfg.limits ?? "")}" placeholder="e.g. animal harm, body horror"></label>
<h4>World</h4><div class="grid">
<label class="f">Climate and season<input type="text" id="szClimate" value="${escapeHtml(cfg.climate ?? "")}" placeholder="temperate maritime, late autumn"></label>
<label class="f">Latitude<input type="text" id="szLatitude" value="${escapeHtml(cfg.latitude ?? "")}" placeholder="temperate · 51 N · southern subpolar"></label>
<label class="f">Calendar<input type="text" id="szCalendar" value="${escapeHtml(cfg.calendar ?? "")}" placeholder="Gregorian, or weekdays: …; months: …"></label>
<label class="f">Start point<input type="text" id="szStart" value="${escapeHtml(cfg.startPoint ?? "")}" placeholder="Day 1 · 14 October 1923 · 18:40"></label>
</div>
<h4>Trackers under each reply</h4><div id="almSzTrackers">${TRACKERS.map(([k, l]) => `<button type="button" class="pill${trackers.has(k) ? " on" : ""}" data-t="${k}">${escapeHtml(l)}</button>`).join("")}</div>
<label class="chk" style="margin-top:10px"><input type="checkbox" id="szSaveChar"> Use these as defaults for new chats with this character</label>
<div class="row" style="margin-top:12px"><button class="btn primary" id="szSave">Begin the story</button><button class="btn" id="szSkip">Skip</button></div>
</div>`;
  const order = [...cfg.genres ?? []];
  modal.root.addEventListener("click", (ev) => {
    const t = ev.target;
    const g = t.closest("[data-g]");
    if (g) {
      const k = g.dataset.g;
      const i = order.indexOf(k);
      if (i >= 0)
        order.splice(i, 1);
      else
        order.push(k);
      g.classList.toggle("on", order.includes(k));
      return;
    }
    const tr = t.closest("[data-t]");
    if (tr) {
      const k = tr.dataset.t;
      if (trackers.has(k))
        trackers.delete(k);
      else
        trackers.add(k);
      tr.classList.toggle("on", trackers.has(k));
      return;
    }
    const v = (id) => modal.root.querySelector(`#${id}`)?.value?.trim() || undefined;
    if (t.id === "szSave") {
      ctx.sendToBackend({
        type: "sessionZero",
        chatId,
        saveForCharacter: modal.root.querySelector("#szSaveChar")?.checked,
        config: {
          genres: order,
          tone: v("szTone"),
          personaMode: v("szPersona"),
          romance: v("szRomance"),
          difficulty: v("szDifficulty"),
          nsfw: v("szNsfw"),
          theme: v("szTheme"),
          limits: v("szLimits"),
          climate: v("szClimate"),
          latitude: v("szLatitude"),
          calendar: v("szCalendar"),
          startPoint: v("szStart"),
          trackers: [...trackers]
        }
      });
      modal.dismiss();
    } else if (t.id === "szSkip") {
      ctx.sendToBackend({ type: "config", chatId, patch: { sessionZeroDone: true } });
      modal.dismiss();
    }
  });
}

// src/frontend.ts
var ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><circle cx="12" cy="10" r="3.2"/><path d="M12 4.5v1.3M12 14.2v1.3M6.5 10h1.3M16.2 10h1.3"/></svg>`;
var COMMANDS = [
  ["/skip 15m", "⏩ Skip 15 minutes"],
  ["/skip 1h", "⏩ Skip an hour"],
  ["/skip until evening", "⏩ Skip until evening"],
  ["/skip until morning", "⏩ Skip to next morning"],
  ["/recap", "\uD83D\uDCDC Recap (Previously on…)"],
  ["/report bonds", "\uD83D\uDD78 Report: bonds"],
  ["/report threads", "\uD83E\uDDF5 Report: threads"],
  ["/audit", "\uD83D\uDD0E Audit continuity"]
];
function setup(ctx) {
  const removers = [];
  let fontsOn = true;
  let fontStyle = null;
  const setFonts = (on) => {
    if (on && !fontStyle)
      fontStyle = ctx.dom.addStyle(FONTS_IMPORT);
    if (!on && fontStyle) {
      fontStyle();
      fontStyle = null;
    }
    fontsOn = on;
  };
  setFonts(true);
  removers.push(ctx.dom.addStyle(TOKENS + MESSAGE_CSS + PANEL_CSS));
  let speakerStyle = null;
  let lastSpeakerCss = "";
  const tab = ctx.ui.registerDrawerTab({
    id: "almanac",
    title: "ALMANAC Ledger",
    shortName: "Almanac",
    description: "Story state, Codex, chapters, bonds, knowledge, lore bridge and lorebook creator",
    keywords: ["almanac", "ledger", "codex", "tracker", "chronicle", "lorebook", "bonds", "weather"],
    headerTitle: "Almanac",
    iconSvg: ICON
  });
  const app = new AlmanacApp(ctx, tab.root);
  app.render();
  let gotStateFor;
  let retry = null;
  const requestState = (attempt = 0) => {
    if (retry)
      clearTimeout(retry);
    retry = null;
    const chatId = ctx.getActiveChat().chatId;
    app.setStatus(chatId ? attempt >= 4 ? "stalled" : "waiting" : "nochat");
    renderHud(app.view);
    if (!chatId)
      return;
    ctx.sendToBackend({ type: attempt === 0 ? "hello" : "getState", chatId });
    const delays = [900, 2000, 4000, 8000, 15000, 30000];
    retry = setTimeout(() => {
      if (gotStateFor !== ctx.getActiveChat().chatId)
        requestState(attempt + 1);
    }, delays[Math.min(attempt, delays.length - 1)]);
  };
  let hud = null;
  let hudOn = true;
  const ensureHud = (on) => {
    hudOn = on;
    try {
      if (on && !hud) {
        hud = ctx.ui.createFloatWidget({ width: 300, height: 40, initialPosition: { x: 24, y: 88 }, snapToEdge: true, tooltip: "ALMANAC · Now", chromeless: true });
        hud.root.addEventListener("click", () => tab.activate());
        app.hudProblem = "";
      } else if (!on && hud) {
        hud.destroy();
        hud = null;
      }
    } catch (err) {
      hud = null;
      app.hudProblem = /PERMISSION/i.test(String(err)) ? "permission" : String(err?.message ?? err);
      app.render();
    }
    renderHud(app.view);
  };
  const renderHud = (v) => {
    if (!hud)
      return;
    const chatId = ctx.getActiveChat().chatId;
    if (!chatId || !hudOn) {
      hud.setVisible(false);
      return;
    }
    hud.setVisible(true);
    if (!v || v.chatId !== chatId) {
      hud.setSize(210, 40);
      hud.root.innerHTML = `<div class="alm-hudw" title="Open the Almanac"><span>\uD83D\uDD70 ALMANAC</span><span class="alm-hudw__dim">${app.status === "stalled" ? "no answer yet" : "connecting…"}</span></div>`;
      return;
    }
    if (!v.enabled) {
      hud.setSize(230, 40);
      hud.root.innerHTML = `<div class="alm-hudw" title="Open the Almanac"><span>\uD83D\uDD70 ALMANAC</span><span class="alm-hudw__dim">off in this chat</span></div>`;
      return;
    }
    const n = v.now;
    const present = v.cast.filter((c) => (c.tier === "spot" || c.tier === "peri") && !c.isUser).slice(0, 5);
    hud.setSize(300, 40);
    hud.root.innerHTML = `<div class="alm-hudw" title="Open the Almanac"><span>\uD83D\uDD70 ${escapeHtml(n.time ?? "—")}</span>${n.weather ? `<span>${escapeHtml(n.weather.glyph)} ${escapeHtml(n.weather.condition)}</span>` : ""}<span>\uD83D\uDCCD ${escapeHtml(n.place[n.place.length - 1] ?? "—")}</span>${present.map((c) => `<span class="alm-mini" style="--c:${escapeHtml(c.color)}" title="${escapeHtml(c.name)}${c.mood?.name ? ` · ${escapeHtml(c.mood.name)}` : ""}">${escapeHtml(initials(c.name))}</span>`).join("")}</div>`;
  };
  const applyView = (v) => {
    gotStateFor = v ? v.chatId : null;
    if (retry && v) {
      clearTimeout(retry);
      retry = null;
    }
    app.setStatus(v ? "ok" : ctx.getActiveChat().chatId ? "waiting" : "nochat");
    app.setView(v);
    if (v) {
      document.documentElement.setAttribute("data-alm-skin", v.theme || "almanac");
      if (v.speakerCss !== lastSpeakerCss) {
        speakerStyle?.();
        speakerStyle = v.speakerCss ? ctx.dom.addStyle(v.speakerCss) : null;
        lastSpeakerCss = v.speakerCss;
      }
      if (v.settings && v.settings.fonts !== fontsOn)
        setFonts(!!v.settings.fonts);
      if (v.settings && !!v.settings.hud !== hudOn)
        ensureHud(!!v.settings.hud);
      tab.setBadge(v.counts?.unverified ? String(v.counts.unverified) : null);
    }
    renderHud(v);
  };
  ensureHud(true);
  removers.push(ctx.onBackendMessage((raw) => {
    const m = raw;
    if (!m || typeof m.type !== "string")
      return;
    if (app.creator.handle(m))
      return;
    switch (m.type) {
      case "state":
        applyView(m.view);
        break;
      case "open":
        tab.activate();
        break;
      case "sessionZero": {
        const active = ctx.getActiveChat().chatId;
        if (m.chatId && active && m.chatId !== active)
          return;
        const cfg = app.view?.chatId === m.chatId ? app.view?.config : null;
        if (cfg?.sessionZeroDone && !m.force)
          return;
        openSessionZero(ctx, m.chatId, cfg);
        break;
      }
      case "toast":
        console.info(`[ALMANAC] ${m.text}`);
        break;
    }
  }));
  removers.push(ctx.events.on("almanac:sessionZero", (p) => {
    const chatId = p?.chatId ?? ctx.getActiveChat().chatId;
    if (chatId)
      openSessionZero(ctx, chatId, app.view?.chatId === chatId ? app.view?.config : null);
  }));
  removers.push(ctx.events.on("almanac:retryState", () => requestState()));
  removers.push(ctx.events.on("almanac:grantPanels", async () => {
    try {
      await ctx.permissions.request(["ui_panels"], { reason: "Show the floating Now widget (time, weather, place and who is present)." });
      ensureHud(true);
    } catch {}
  }));
  removers.push(ctx.events.on("almanac:settings", (p) => {
    if (p && "hud" in p)
      ensureHud(!!p.hud);
    if (p && "fonts" in p)
      setFonts(!!p.fonts);
  }));
  try {
    const action = ctx.ui.registerInputBarAction({ id: "almanac-command", label: "Almanac command…", iconSvg: ICON.replace(/20/g, "14") });
    removers.push(action.onClick(async () => {
      try {
        const res = await ctx.ui.showContextMenu({ items: COMMANDS.map(([key2, label]) => ({ key: key2, label })), position: { x: Math.round(window.innerWidth / 2), y: window.innerHeight - 120 } });
        const key = res?.selectedKey;
        if (key)
          insertIntoComposer(key);
      } catch {
        insertIntoComposer("/recap");
      }
    }));
    removers.push(() => action.destroy());
  } catch {}
  tab.onActivate(() => requestState(gotStateFor === ctx.getActiveChat().chatId ? 1 : 0));
  removers.push(ctx.events.on("CHAT_SWITCHED", () => setTimeout(() => {
    gotStateFor = undefined;
    requestState();
  }, 150)));
  let boots = 0;
  const boot = () => {
    if (ctx.getActiveChat().chatId || ++boots > 10)
      requestState();
    else
      setTimeout(boot, 500);
  };
  boot();
  return () => {
    for (const r of removers) {
      try {
        r();
      } catch {}
    }
    speakerStyle?.();
    fontStyle?.();
    if (retry)
      clearTimeout(retry);
    hud?.destroy();
    tab.destroy();
    document.documentElement.removeAttribute("data-alm-skin");
    ctx.dom.cleanup();
  };
}
function insertIntoComposer(text) {
  const ta = document.querySelector("textarea[data-chat-input], .chat-input textarea, form textarea, textarea");
  if (!ta) {
    navigator.clipboard?.writeText(text).catch(() => {
      return;
    });
    return;
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(ta, text);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  ta.focus();
}
export {
  setup
};
