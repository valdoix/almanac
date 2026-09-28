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
function kpNote(note) {
  const short = note.length > 70 ? `${note.slice(0, 67).trimEnd()}…` : note;
  return `<small class="alm-kp__n" title="${escapeHtml(note)}">${escapeHtml(short)}</small>`;
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

// src/core/version.ts
var VERSION = "1.9.3";

// src/frontend/skins.ts
var SKIN_LIST = [
  ["almanac", "Almanac"],
  ["solar", "Solar Editorial"],
  ["nocturne", "Nocturne"],
  ["botanical", "Botanical"],
  ["prism", "Prism"],
  ["candy", "Candy"],
  ["dossier", "Dossier"],
  ["scriptorium", "Scriptorium"],
  ["arcana", "Arcana"],
  ["orbital", "Orbital"],
  ["posy", "Posy"],
  ["lumiverse", "Follow Lumiverse"]
];
var FLOWERS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Cg transform='translate(24 26)'%3E%3Cg fill='%23f2a9bf'%3E%3Ccircle cx='0' cy='-6' r='5'/%3E%3Ccircle cx='5.7' cy='-1.9' r='5'/%3E%3Ccircle cx='3.5' cy='4.9' r='5'/%3E%3Ccircle cx='-3.5' cy='4.9' r='5'/%3E%3Ccircle cx='-5.7' cy='-1.9' r='5'/%3E%3C/g%3E%3Ccircle r='2.6' fill='%23e8b25c'/%3E%3C/g%3E%3Cpath d='M66 70c6-10 16-12 22-10-4 8-14 12-22 10z' fill='%2396c4a0'/%3E%3Cpath d='M66 70c-2-9 2-18 8-22 2 8-2 17-8 22z' fill='%23acd3b3'/%3E%3Ccircle cx='78' cy='22' r='2.4' fill='%23f2a9bf'/%3E%3Ccircle cx='14' cy='76' r='2' fill='%23acd3b3'/%3E%3C/svg%3E")`;
var SPRIG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cpath d='M20 110C40 80 60 60 100 40' stroke='%234f8a5c' stroke-width='2' fill='none'/%3E%3Cpath d='M45 80c-10-8-12-20-8-26 9 4 13 16 8 26z' fill='%237fb08a'/%3E%3Cpath d='M70 58c2-12 12-20 20-20-1 10-10 18-20 20z' fill='%239cc5a5'/%3E%3Cg transform='translate(96 30)'%3E%3Cg fill='%23f0a3b9'%3E%3Cellipse rx='7' ry='11' transform='translate(0 -9)'/%3E%3Cellipse rx='7' ry='11' transform='rotate(72) translate(0 -9)'/%3E%3Cellipse rx='7' ry='11' transform='rotate(144) translate(0 -9)'/%3E%3Cellipse rx='7' ry='11' transform='rotate(216) translate(0 -9)'/%3E%3Cellipse rx='7' ry='11' transform='rotate(288) translate(0 -9)'/%3E%3C/g%3E%3Ccircle r='5' fill='%23e8b25c'/%3E%3C/g%3E%3C/svg%3E")`;
var SKINS = {
  almanac: {
    shared: { "font-display": `"Fraunces",Georgia,serif`, "font-body": `"Newsreader",Georgia,serif`, "font-mono": `"DM Mono",ui-monospace,monospace`, "font-hand": `"Caveat",cursive`, radius: "14px", "r-sm": "10px" },
    light: {
      panel: "#fbf5e8",
      "panel-2": "#f0e4cc",
      ink: "#2b2118",
      muted: "#78674f",
      line: "#dfcca8",
      accent: "#b8501f",
      "accent-2": "#2f5d7c",
      gold: "#c4922c",
      good: "#3a7f50",
      warn: "#b27a14",
      danger: "#b8332a",
      "on-accent": "#fff",
      shadow: "0 18px 36px -26px rgba(70,40,10,.55),0 2px 6px -3px rgba(70,40,10,.18)",
      lift: "0 10px 22px -18px rgba(70,40,10,.55)",
      texture: "radial-gradient(rgba(43,33,24,.08) 1px,transparent 1.3px) 0 0/15px 15px"
    },
    dark: {
      panel: "#241c14",
      "panel-2": "#19130d",
      ink: "#f1e6d3",
      muted: "#b3a189",
      line: "#3e3226",
      accent: "#ee8a55",
      "accent-2": "#86b6d8",
      gold: "#e2b456",
      good: "#86cf98",
      warn: "#e9bd60",
      danger: "#f28072",
      "on-accent": "#19130d",
      shadow: "0 20px 40px -26px rgba(0,0,0,.85)",
      lift: "0 10px 24px -18px rgba(0,0,0,.9)",
      texture: "radial-gradient(rgba(241,230,211,.06) 1px,transparent 1.3px) 0 0/15px 15px"
    },
    fonts: []
  },
  solar: {
    shared: { "font-display": `"Playfair Display",Georgia,serif`, "font-body": `"Libre Franklin","Segoe UI",system-ui,sans-serif`, "font-mono": `"Libre Franklin",system-ui,sans-serif`, "font-hand": `"Playfair Display",Georgia,serif`, radius: "0px", "r-sm": "0px", shadow: "none", lift: "none", texture: "none" },
    light: { panel: "#ffffff", "panel-2": "#f1efe8", ink: "#111111", muted: "#595959", line: "#d9d6cd", accent: "#ffd21f", "accent-2": "#e23d28", gold: "#ffd21f", good: "#1f7a45", warn: "#a86d00", danger: "#d42f1c", "on-accent": "#111", rule: "#111111" },
    dark: { panel: "#121212", "panel-2": "#050505", ink: "#f6f3ea", muted: "#a6a39b", line: "#2f2f2f", accent: "#ffd21f", "accent-2": "#ff6e57", gold: "#ffd21f", good: "#6fd39a", warn: "#ffc246", danger: "#ff6e57", "on-accent": "#111", rule: "#f6f3ea" },
    fonts: ["Playfair+Display:ital,wght@0,700;0,900;1,700", "Libre+Franklin:wght@400;500;700"]
  },
  nocturne: {
    shared: { "font-display": `"Cormorant Garamond",Georgia,serif`, "font-body": `"Crimson Pro",Georgia,serif`, "font-mono": `"Cormorant Garamond",Georgia,serif`, "font-hand": `"Cormorant Garamond",Georgia,serif`, radius: "10px", "r-sm": "6px" },
    light: {
      panel: "#f7f1ec",
      "panel-2": "#eadcd5",
      ink: "#28131a",
      muted: "#7a5d64",
      line: "#d9c2c3",
      accent: "#8e1b2e",
      "accent-2": "#3f2c55",
      gold: "#9c7a3c",
      good: "#3f6d4e",
      warn: "#9a6a1a",
      danger: "#8e1b2e",
      "on-accent": "#fff",
      shadow: "0 22px 40px -28px rgba(60,10,25,.55)",
      lift: "0 10px 22px -18px rgba(60,10,25,.45)",
      texture: "radial-gradient(60% 50% at 50% 0%,rgba(142,27,46,.07),transparent 70%),repeating-linear-gradient(45deg,rgba(40,19,26,.025) 0 1px,transparent 1px 9px)"
    },
    dark: {
      panel: "#150c10",
      "panel-2": "#0b0609",
      ink: "#f0e2df",
      muted: "#a88c91",
      line: "#3b2229",
      accent: "#e4495f",
      "accent-2": "#bea6d4",
      gold: "#d4b27a",
      good: "#8ccaa0",
      warn: "#e3b465",
      danger: "#ff7a86",
      "on-accent": "#0b0609",
      shadow: "0 26px 50px -28px rgba(0,0,0,.95)",
      lift: "0 14px 30px -18px rgba(0,0,0,.95)",
      texture: "radial-gradient(60% 50% at 50% 0%,rgba(228,73,95,.09),transparent 70%),repeating-linear-gradient(45deg,rgba(240,226,223,.02) 0 1px,transparent 1px 9px)"
    },
    fonts: ["Crimson+Pro:ital,wght@0,400;0,600;1,400"]
  },
  botanical: {
    shared: { "font-display": `"Young Serif",Georgia,serif`, "font-body": `"Source Serif 4",Georgia,serif`, "font-mono": `"Courier Prime","Courier New",monospace`, "font-hand": `"Caveat",cursive`, radius: "4px", "r-sm": "3px" },
    light: {
      panel: "#f6f1e3",
      "panel-2": "#dcceab",
      ink: "#2a291d",
      muted: "#6c6750",
      line: "#c9bb95",
      accent: "#5f7222",
      "accent-2": "#a65a1a",
      gold: "#b3862a",
      good: "#4f7a2a",
      warn: "#a4701c",
      danger: "#a8401e",
      "on-accent": "#fff",
      shadow: "0 1px 0 #cdbf98,0 18px 30px -24px rgba(60,50,20,.55)",
      lift: "0 1px 0 #d8cca8",
      texture: "radial-gradient(rgba(90,70,30,.10) .8px,transparent 1.2px) 0 0/5px 5px"
    },
    dark: {
      panel: "#1c1d15",
      "panel-2": "#12130d",
      ink: "#ece7d2",
      muted: "#aaa68c",
      line: "#37382b",
      accent: "#b7c86b",
      "accent-2": "#e59c57",
      gold: "#dab65e",
      good: "#a3cf73",
      warn: "#e6b85e",
      danger: "#ee8266",
      "on-accent": "#12130d",
      shadow: "0 20px 36px -26px rgba(0,0,0,.9)",
      lift: "none",
      texture: "radial-gradient(rgba(236,231,210,.05) .8px,transparent 1.2px) 0 0/5px 5px"
    },
    fonts: ["Young+Serif", "Source+Serif+4:ital,opsz,wght@0,8..60,400;1,8..60,400", "Courier+Prime:ital@0;1"]
  },
  prism: {
    shared: { "font-display": `"Syne","Segoe UI",system-ui,sans-serif`, "font-body": `"Space Grotesk","Segoe UI",system-ui,sans-serif`, "font-mono": `"Space Mono",ui-monospace,monospace`, "font-hand": `"Space Grotesk",system-ui,sans-serif`, radius: "16px", "r-sm": "12px" },
    light: {
      panel: "#fcfcff",
      "panel-2": "#eef0fa",
      ink: "#15152c",
      muted: "#5c5f80",
      line: "#dcdff0",
      accent: "#6d2fff",
      "accent-2": "#0096ab",
      gold: "#e0a800",
      good: "#0f9d6a",
      warn: "#c98600",
      danger: "#e0245e",
      "on-accent": "#fff",
      holo: "linear-gradient(115deg,#ff7ac6,#ffd86b 25%,#7df3e1 50%,#8fa8ff 75%,#d78bff)",
      shadow: "0 22px 44px -28px rgba(80,60,180,.45)",
      lift: "0 10px 24px -18px rgba(80,60,180,.4)",
      texture: "radial-gradient(40% 50% at 10% 0%,rgba(255,122,198,.14),transparent 70%),radial-gradient(40% 50% at 90% 100%,rgba(125,243,225,.16),transparent 70%)"
    },
    dark: {
      panel: "#0c0c16",
      "panel-2": "#05050b",
      ink: "#eef0ff",
      muted: "#9296b8",
      line: "#24253c",
      accent: "#b28cff",
      "accent-2": "#3ef2ff",
      gold: "#ffe45e",
      good: "#4be39a",
      warn: "#ffc15e",
      danger: "#ff6b9a",
      "on-accent": "#05050b",
      holo: "linear-gradient(115deg,#ff4fae,#ffe45e 25%,#3ef2ff 50%,#7a8cff 75%,#c86bff)",
      shadow: "0 26px 50px -28px rgba(0,0,0,.95),0 0 36px -20px rgba(178,140,255,.5)",
      lift: "0 12px 28px -18px rgba(0,0,0,.95)",
      texture: "radial-gradient(40% 50% at 10% 0%,rgba(255,79,174,.10),transparent 70%),radial-gradient(40% 50% at 90% 100%,rgba(62,242,255,.10),transparent 70%)"
    },
    fonts: ["Space+Grotesk:wght@400;500;700", "Space+Mono"]
  },
  candy: {
    shared: { "font-display": `"Fredoka","Segoe UI Rounded",system-ui,sans-serif`, "font-body": `"Fredoka","Segoe UI Rounded",system-ui,sans-serif`, "font-mono": `"Fredoka",system-ui,sans-serif`, "font-hand": `"Fredoka",system-ui,sans-serif`, radius: "22px", "r-sm": "16px" },
    light: {
      panel: "#fffdf4",
      "panel-2": "#fff1c2",
      ink: "#1d1033",
      muted: "#6a5e80",
      line: "#ead9a6",
      accent: "#ff4fa3",
      "accent-2": "#28c994",
      gold: "#ffc933",
      good: "#12a978",
      warn: "#d98a00",
      danger: "#ff3b5c",
      "on-accent": "#fff",
      pop: "#1d1033",
      shadow: "5px 5px 0 #1d1033",
      lift: "3px 3px 0 #1d1033",
      texture: "radial-gradient(circle at 25% 25%,#ff9fcf 0 3px,transparent 3.5px) 0 0/60px 60px,radial-gradient(circle at 75% 60%,#7fe3c1 0 3px,transparent 3.5px) 0 0/60px 60px,radial-gradient(circle at 50% 90%,#b7a6ff 0 2.5px,transparent 3px) 0 0/60px 60px"
    },
    dark: {
      panel: "#241a40",
      "panel-2": "#160f2b",
      ink: "#fff4fb",
      muted: "#c1b3df",
      line: "#44376b",
      accent: "#ff78bd",
      "accent-2": "#5ef2c0",
      gold: "#ffd84d",
      good: "#5ef2c0",
      warn: "#ffc04d",
      danger: "#ff6b86",
      "on-accent": "#160f2b",
      pop: "#fff4fb",
      shadow: "5px 5px 0 #ff78bd",
      lift: "3px 3px 0 #7a5cff",
      texture: "radial-gradient(circle at 25% 25%,#ff78bd 0 3px,transparent 3.5px) 0 0/60px 60px,radial-gradient(circle at 75% 60%,#5ef2c0 0 3px,transparent 3.5px) 0 0/60px 60px,radial-gradient(circle at 50% 90%,#ffd84d 0 2.5px,transparent 3px) 0 0/60px 60px"
    },
    fonts: ["Fredoka:wght@400;500;600;700"]
  },
  dossier: {
    shared: { "font-display": `"IBM Plex Serif",Georgia,serif`, "font-body": `"IBM Plex Sans","Segoe UI",system-ui,sans-serif`, "font-mono": `"IBM Plex Mono",ui-monospace,monospace`, "font-hand": `"Reenie Beanie",cursive`, radius: "4px", "r-sm": "3px" },
    light: {
      panel: "#fbfaf7",
      "panel-2": "#ecebe5",
      ink: "#17191c",
      muted: "#5a5f67",
      line: "#d4d1c9",
      accent: "#8c1d1d",
      "accent-2": "#34506a",
      gold: "#8a7a5a",
      good: "#2f6b4a",
      warn: "#946412",
      danger: "#a32020",
      "on-accent": "#fff",
      shadow: "0 1px 0 rgba(0,0,0,.04),0 12px 26px -22px rgba(0,0,0,.45)",
      lift: "0 1px 2px rgba(0,0,0,.06)",
      texture: "linear-gradient(transparent 31px,rgba(23,25,28,.05) 32px) 0 0/100% 32px"
    },
    dark: {
      panel: "#17191c",
      "panel-2": "#0e0f11",
      ink: "#e8e6e1",
      muted: "#9aa0a8",
      line: "#2d3137",
      accent: "#e0534f",
      "accent-2": "#90b1cd",
      gold: "#b9a67e",
      good: "#7fc3a0",
      warn: "#dcae57",
      danger: "#ff6e68",
      "on-accent": "#0e0f11",
      shadow: "0 14px 30px -22px rgba(0,0,0,.9)",
      lift: "none",
      texture: "linear-gradient(transparent 31px,rgba(232,230,225,.04) 32px) 0 0/100% 32px"
    },
    fonts: ["IBM+Plex+Mono:wght@400;500", "IBM+Plex+Sans:wght@400;500;600", "IBM+Plex+Serif:ital,wght@0,500;0,600;1,500", "Reenie+Beanie"]
  },
  scriptorium: {
    shared: { "font-display": `"IM Fell English",Georgia,serif`, "font-body": `"IM Fell English",Georgia,serif`, "font-mono": `"IM Fell English SC",Georgia,serif`, "font-hand": `"IM Fell English",Georgia,serif`, radius: "3px", "r-sm": "2px", lift: "none" },
    light: {
      panel: "#f3e7cb",
      "panel-2": "#e3cfa3",
      ink: "#2a1c10",
      muted: "#6c573b",
      line: "#c4a770",
      accent: "#a8261c",
      "accent-2": "#1f3f86",
      gold: "#b5892a",
      good: "#3d6b2e",
      warn: "#a8741a",
      danger: "#a8261c",
      "on-accent": "#f7ecd2",
      shadow: "0 2px 0 #c7ab77,0 22px 36px -26px rgba(60,35,10,.7)",
      texture: "radial-gradient(40% 50% at 18% 22%,rgba(150,100,40,.10),transparent 70%),radial-gradient(35% 40% at 82% 70%,rgba(120,80,30,.09),transparent 70%),radial-gradient(rgba(90,60,20,.07) 1px,transparent 1.4px) 0 0/9px 9px"
    },
    dark: {
      panel: "#221810",
      "panel-2": "#150e08",
      ink: "#efdfbf",
      muted: "#b19a75",
      line: "#4c3a24",
      accent: "#e6614a",
      "accent-2": "#86a3e6",
      gold: "#e2b34f",
      good: "#93c46f",
      warn: "#e2b34f",
      danger: "#ff735c",
      "on-accent": "#150e08",
      shadow: "0 2px 0 #3a2a18,0 26px 40px -26px rgba(0,0,0,.9)",
      texture: "radial-gradient(40% 50% at 70% 10%,rgba(255,180,80,.10),transparent 70%),radial-gradient(rgba(239,223,191,.04) 1px,transparent 1.4px) 0 0/9px 9px"
    },
    fonts: ["IM+Fell+English:ital@0;1", "IM+Fell+English+SC", "UnifrakturMaguntia"]
  },
  arcana: {
    shared: { "font-display": `"Cinzel",Georgia,serif`, "font-body": `"Alegreya",Georgia,serif`, "font-mono": `"Cinzel",Georgia,serif`, "font-hand": `"Alegreya",Georgia,serif`, radius: "16px", "r-sm": "10px" },
    light: {
      panel: "#f8f5ff",
      "panel-2": "#e9e2fb",
      ink: "#211848",
      muted: "#655b8c",
      line: "#d5cbf0",
      accent: "#8a5c0a",
      "accent-2": "#0d8578",
      gold: "#c28f2c",
      good: "#1f8a58",
      warn: "#9a6a12",
      danger: "#c42d52",
      "on-accent": "#fff",
      shadow: "0 0 0 1px rgba(194,143,44,.14),0 24px 44px -30px rgba(60,40,140,.5)",
      lift: "0 10px 22px -18px rgba(60,40,140,.4)",
      texture: "radial-gradient(1px 1px at 20% 30%,rgba(194,143,44,.6),transparent) 0 0/140px 140px,radial-gradient(1px 1px at 70% 80%,rgba(106,69,214,.45),transparent) 0 0/190px 190px"
    },
    dark: {
      panel: "#1a1533",
      "panel-2": "#0f0c22",
      ink: "#ece6ff",
      muted: "#a79fcb",
      line: "#372d62",
      accent: "#e7b75a",
      "accent-2": "#63d9c6",
      gold: "#e7b75a",
      good: "#7fe0a8",
      warn: "#f0c46a",
      danger: "#ff7d93",
      "on-accent": "#140f28",
      shadow: "0 0 0 1px rgba(231,183,90,.12),0 28px 60px -30px rgba(0,0,0,.95),0 0 40px -18px rgba(123,97,255,.45)",
      lift: "0 10px 26px -16px rgba(0,0,0,.9)",
      texture: "radial-gradient(1px 1px at 20% 30%,rgba(255,240,200,.5),transparent) 0 0/140px 140px,radial-gradient(1px 1px at 70% 80%,rgba(200,220,255,.45),transparent) 0 0/190px 190px"
    },
    fonts: ["Alegreya:ital,wght@0,400;0,600;1,400", "Cinzel:wght@500;700", "Cinzel+Decorative:wght@700"]
  },
  orbital: {
    shared: { "font-display": `"Chakra Petch","Segoe UI",system-ui,sans-serif`, "font-body": `"Inter","Segoe UI",system-ui,sans-serif`, "font-mono": `"JetBrains Mono",ui-monospace,monospace`, "font-hand": `"JetBrains Mono",ui-monospace,monospace`, radius: "2px", "r-sm": "2px", lift: "none" },
    light: {
      panel: "#f7f8fa",
      "panel-2": "#e5e8ed",
      ink: "#0b0f14",
      muted: "#566170",
      line: "#cdd3db",
      accent: "#e8430a",
      "accent-2": "#2742ff",
      gold: "#e8430a",
      good: "#00925f",
      warn: "#c77800",
      danger: "#d61f35",
      "on-accent": "#fff",
      shadow: "0 0 0 1px rgba(11,15,20,.04),0 24px 40px -30px rgba(11,15,20,.5)",
      texture: "linear-gradient(90deg,rgba(11,15,20,.05) 1px,transparent 1px) 0 0/48px 100%,linear-gradient(rgba(11,15,20,.05) 1px,transparent 1px) 0 0/100% 48px"
    },
    dark: {
      panel: "#11151b",
      "panel-2": "#090c10",
      ink: "#e8edf3",
      muted: "#8a96a5",
      line: "#27303b",
      accent: "#ff6a2b",
      "accent-2": "#7289ff",
      gold: "#ff6a2b",
      good: "#2fd39a",
      warn: "#ffb13d",
      danger: "#ff5468",
      "on-accent": "#090c10",
      shadow: "0 0 0 1px rgba(255,255,255,.03),0 24px 40px -30px rgba(0,0,0,.9)",
      texture: "linear-gradient(90deg,rgba(232,237,243,.04) 1px,transparent 1px) 0 0/48px 100%,linear-gradient(rgba(232,237,243,.04) 1px,transparent 1px) 0 0/100% 48px"
    },
    fonts: ["Chakra+Petch:wght@500;600;700", "Inter:wght@400;500;600", "JetBrains+Mono:wght@400;500"]
  },
  posy: {
    shared: { "font-display": `"DM Serif Display",Georgia,serif`, "font-body": `"Nunito","Segoe UI",system-ui,sans-serif`, "font-mono": `"DM Mono",ui-monospace,monospace`, "font-hand": `"Dancing Script",cursive`, radius: "24px", "r-sm": "16px", sprig: SPRIG },
    light: {
      panel: "#fff7f7",
      "panel-2": "#f9e1e6",
      ink: "#1f3a2b",
      muted: "#627566",
      line: "#eec5cf",
      accent: "#c93d70",
      "accent-2": "#3f7f4d",
      gold: "#d99a4e",
      good: "#3a8551",
      warn: "#b87624",
      danger: "#c43a5c",
      "on-accent": "#fff",
      shadow: "0 20px 40px -28px rgba(120,40,70,.45),0 2px 6px -3px rgba(31,58,43,.15)",
      lift: "0 10px 22px -18px rgba(120,40,70,.5)",
      texture: `linear-gradient(rgba(255,247,247,.45),rgba(255,247,247,.45)),${FLOWERS} 0 0/96px 96px`
    },
    dark: {
      panel: "#172a20",
      "panel-2": "#0f1f17",
      ink: "#fbe9ee",
      muted: "#b5c8b9",
      line: "#2f4a3b",
      accent: "#ff8fb1",
      "accent-2": "#8fd19e",
      gold: "#f0c07a",
      good: "#8fd19e",
      warn: "#f0c07a",
      danger: "#ff7f98",
      "on-accent": "#0f1f17",
      shadow: "0 22px 44px -28px rgba(0,0,0,.9)",
      lift: "0 10px 22px -18px rgba(0,0,0,.9)",
      texture: `linear-gradient(rgba(15,31,23,.62),rgba(15,31,23,.62)),${FLOWERS} 0 0/96px 96px`
    },
    fonts: ["DM+Serif+Display:ital@0;1", "Nunito:wght@400;600;700", "Dancing+Script:wght@600"]
  }
};
var BASE_FONTS = ["Caveat:wght@500;700", "DM+Mono:wght@400;500", "Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400..800", "Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600", "Syne:wght@600;700;800", "Cormorant+Garamond:ital,wght@0,500;0,700;1,500;1,600", "Oswald:wght@500;600"];
function fontsFor(skin) {
  const fams = [...BASE_FONTS, ...SKINS[skin]?.fonts ?? []];
  return `@import url("https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f}`).join("&")}&display=swap");`;
}
var decl = (p) => Object.entries(p).map(([k, v]) => `--alm-${k}:${v};`).join("");
function tokens() {
  const out = [];
  for (const [id, s] of Object.entries(SKINS)) {
    const at = `:root[data-alm-skin="${id}"]`;
    out.push(`${at}{${decl(s.shared)}--alm-on-voice:#fff}`);
    out.push(`${at},${at}[data-alm-mode="light"]{${decl(s.light)}}`);
    out.push(`${at}[data-alm-mode="dark"]{${decl(s.dark)}}`);
  }
  return out.join(`
`);
}
var S = (id) => `:root[data-alm-skin="${id}"]`;
var FLAT_BUBBLE = (id) => `
${S(id)} .alm-say__bubble::before,${S(id)} .alm-say__bubble::after{content:none!important}
${S(id)} .alm-thk::before,${S(id)} .alm-thk::after{display:none!important}
${S(id)} .alm-thk{animation:none!important}
${S(id)} .alm-chapter b::before,${S(id)} .alm-chapter b::after{content:none!important}`;
var SIGNATURES = `
/* Almanac: the sun marks each chapter */
${S("almanac")} .alm-chapter small::before{content:"☉  ";color:var(--alm-gold);letter-spacing:0}

/* Solar: pull quotes, ruled sections, highlighter */
${FLAT_BUBBLE("solar")}
${S("solar")} .alm-say__medal{border-radius:0!important;box-shadow:none!important;font-family:var(--alm-font-body)!important}
${S("solar")} .alm-say__bubble{background:none!important;border:0!important;border-top:2px solid var(--c)!important;border-radius:0!important;box-shadow:none!important;padding:10px 0 4px!important}
${S("solar")} .alm-say__who{position:static!important;display:flex!important;background:none!important;box-shadow:none!important;color:var(--c)!important;padding:0 0 6px!important;font-weight:700!important}
${S("solar")} .alm-say--user .alm-say__who{justify-content:flex-end}
${S("solar")} .alm-say__tone{color:var(--alm-muted)!important;border-left-color:var(--alm-line)!important}
${S("solar")} .alm-say__line{font:italic 700 1.3em/1.28 var(--alm-font-display)!important}
${S("solar")} .alm-thk{border:0!important;border-left:6px solid var(--alm-accent)!important;border-radius:0!important;background:none!important;padding:2px 0 2px 14px!important;font:italic 700 19px/1.3 var(--alm-font-hand)!important}
${S("solar")} .alm-chapter{grid-template-columns:1fr!important;text-align:left!important;border-top:2px solid var(--alm-rule);padding-top:10px!important}
${S("solar")} .alm-chapter::before,${S("solar")} .alm-chapter::after{display:none}
${S("solar")} .alm-chapter b{font-style:normal!important;font-weight:900!important;background:linear-gradient(transparent 58%,var(--alm-accent) 58% 92%,transparent 92%);display:inline!important}
${S("solar")}[data-alm-mode="dark"] .alm-chapter b{background:linear-gradient(transparent 86%,var(--alm-accent) 86% 97%,transparent 97%)}
${S("solar")} .alm-chapter small{color:var(--alm-accent-2)!important;font-weight:700}
${S("solar")} details.alm-drawer{border:0!important;border-top:3px solid var(--alm-rule)!important}
${S("solar")} .alm-btn{border:2px solid var(--alm-rule)!important;box-shadow:none!important;text-transform:uppercase;letter-spacing:.06em;font-weight:700!important}
${S("solar")} .almp .card{border:0;border-top:3px solid var(--alm-rule);box-shadow:none}
${S("solar")} .almp .btn{border:2px solid var(--alm-rule);text-transform:uppercase;letter-spacing:.06em;font-weight:700}

/* Nocturne: arched portraits, whispered thoughts, filigree frames */
${S("nocturne")} .alm-say__medal{border-radius:50% 50% 4px 4px!important;font-style:italic!important;font-weight:600!important;font-size:22px!important}
${S("nocturne")} .alm-say__who{text-transform:none!important;font-style:italic;letter-spacing:.06em!important;font-size:13px!important}
${S("nocturne")} .alm-say__line{font-size:1.14em!important}
${S("nocturne")} .alm-thk{border:0!important;border-left:1px solid var(--c)!important;border-radius:0!important;background:none!important;padding:0 0 0 18px!important;font:italic 500 21px/1.3 var(--alm-font-hand)!important;animation:none!important}
${S("nocturne")} .alm-thk::before{content:"⸙";width:auto;height:auto;left:-7px;top:-4px;border:0;border-radius:0;background:var(--alm-panel);color:var(--c);font:14px/1 serif}
${S("nocturne")} .alm-thk::after{display:none}
${S("nocturne")} .alm-chapter::before,${S("nocturne")} .alm-chapter::after{background:linear-gradient(90deg,transparent,var(--alm-accent) 50%,transparent) center/100% 1px no-repeat}
${S("nocturne")} details.alm-drawer,${S("nocturne")} .almp .card{box-shadow:inset 0 0 0 4px var(--alm-panel),inset 0 0 0 5px var(--alm-line),var(--alm-lift)!important}

/* Botanical: specimen labels, tape, typewriter */
${FLAT_BUBBLE("botanical")}
${S("botanical")} .alm-say__medal{border-radius:4px!important;box-shadow:none!important;border:1px solid var(--alm-ink);font-family:var(--alm-font-mono)!important;font-weight:400!important}
${S("botanical")} .alm-say__bubble{border-radius:2px!important;background:var(--alm-panel)!important;box-shadow:none!important;border-left:3px solid var(--c)!important}
${S("botanical")} .alm-say--user .alm-say__bubble{border-left-width:1px!important;border-right:3px solid var(--c)!important}
${S("botanical")} .alm-say__who{border-radius:0!important;background:var(--alm-panel)!important;color:var(--c)!important;border:1px solid var(--c)}
${S("botanical")} .alm-say__tone{border-left-color:var(--alm-line)!important}
${S("botanical")} .alm-thk{border:0!important;border-radius:0!important;background:none!important;color:color-mix(in oklab,var(--alm-ink) 72%,var(--alm-panel))!important}
${S("botanical")} .alm-chapter::before,${S("botanical")} .alm-chapter::after{background:linear-gradient(var(--alm-ink),var(--alm-ink)) center/100% 1px no-repeat}
${S("botanical")} .alm-chapter b{font-style:normal!important}
${S("botanical")} details.alm-drawer{position:relative;overflow:visible!important;border-color:var(--alm-ink)!important}
${S("botanical")} details.alm-drawer::before{content:"";position:absolute;top:-9px;left:22px;width:74px;height:18px;background:color-mix(in oklab,var(--alm-gold) 38%,transparent);transform:rotate(-4deg);pointer-events:none}
${S("botanical")} .almp .card{border-color:var(--alm-ink);box-shadow:inset 0 0 0 3px var(--alm-panel),inset 0 0 0 4px var(--alm-line)}

/* Prism: holographic foil */
${S("prism")} details.alm-drawer,${S("prism")} details.alm-sub,${S("prism")} .almp .card{border:1.5px solid transparent!important;background:linear-gradient(var(--alm-panel),var(--alm-panel)) padding-box,var(--alm-holo) border-box!important}
${S("prism")} .alm-say__medal{box-shadow:0 0 0 2.5px var(--alm-panel),0 0 0 4.5px var(--alm-accent-2),0 0 16px -2px var(--alm-accent)!important}
${S("prism")} .alm-say__who{border-radius:99px!important}
${S("prism")} .alm-thk{border-style:solid!important;border-radius:14px!important;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font:italic 500 16px/1.4 var(--alm-font-hand)!important}
${S("prism")} .alm-chapter::before,${S("prism")} .alm-chapter::after{background:var(--alm-holo) center/100% 2px no-repeat}
${S("prism")} .alm-chapter b{font-style:normal!important;font-weight:800!important;background:var(--alm-holo);-webkit-background-clip:text;background-clip:text;color:transparent!important}
${S("prism")} .alm-chapter b::before,${S("prism")} .alm-chapter b::after{content:none!important}
${S("prism")} .alm-caret,${S("prism")} .alm-btn--primary,${S("prism")} .almp .btn.primary{background:var(--alm-holo)!important;color:#15152c!important;border-color:transparent!important}

/* Candy: stickers with hard shadows */
${S("candy")} details.alm-drawer,${S("candy")} details.alm-sub,${S("candy")} .almp .card{border:2.5px solid var(--alm-pop)!important;box-shadow:var(--alm-lift)!important}
${S("candy")} .alm-say__medal{border:2.5px solid var(--alm-pop);box-shadow:3px 3px 0 var(--alm-pop)!important;transform:rotate(-6deg)}
${S("candy")} .alm-say--user .alm-say__medal{transform:rotate(6deg)}
${S("candy")} .alm-say__bubble{border:2.5px solid var(--alm-pop)!important;box-shadow:4px 4px 0 var(--c)!important;background:color-mix(in oklab,var(--c) 14%,var(--alm-panel))!important}
${S("candy")} .alm-say__bubble::before{content:none!important}
${S("candy")} .alm-say__who{border:2px solid var(--alm-pop);border-radius:99px!important;transform:rotate(-2deg);font-weight:600!important}
${S("candy")} .alm-say--user .alm-say__who{transform:rotate(2deg)}
${S("candy")} .alm-thk{border:2.5px solid var(--alm-pop)!important;box-shadow:3px 3px 0 var(--c);font-weight:500!important;font-size:17px!important}
${S("candy")} .alm-chapter::before,${S("candy")} .alm-chapter::after{height:12px;background:radial-gradient(circle at 6px -2px,transparent 6px,var(--alm-accent) 6.5px 8.5px,transparent 9px) 0 0/12px 12px repeat-x}
${S("candy")} .alm-chapter b{font-style:normal!important;font-weight:700!important}
${S("candy")} .alm-btn,${S("candy")} .almp .btn{border:2.5px solid var(--alm-pop)!important;border-radius:99px!important;box-shadow:3px 3px 0 var(--alm-pop)!important}

/* Dossier: transcript speech, margin notes, stamps */
${FLAT_BUBBLE("dossier")}
${S("dossier")} .alm-say__medal{border-radius:3px!important;box-shadow:none!important}
${S("dossier")} .alm-say__bubble{background:var(--alm-panel)!important;border:1px solid var(--alm-line)!important;border-left:3px solid var(--c)!important;border-radius:2px!important;box-shadow:none!important}
${S("dossier")} .alm-say--user .alm-say__bubble{border-left-width:1px!important;border-right:3px solid var(--c)!important}
${S("dossier")} .alm-say__who{position:static!important;display:flex!important;background:none!important;box-shadow:none!important;color:var(--c)!important;padding:0 0 8px!important}
${S("dossier")} .alm-say--user .alm-say__who{justify-content:flex-end}
${S("dossier")} .alm-say__tone{color:var(--alm-muted)!important;border-left-color:var(--alm-line)!important}
${S("dossier")} .alm-thk{border:0!important;border-left:2px solid var(--c)!important;border-radius:0!important;background:none!important;padding:4px 0 4px 14px!important;font-size:25px!important}
${S("dossier")} .alm-chapter::before,${S("dossier")} .alm-chapter::after{background:linear-gradient(var(--alm-ink),var(--alm-ink)) center/100% 1px no-repeat}
${S("dossier")} .alm-chapter b{font-style:normal!important;font-size:19px!important;text-transform:uppercase;letter-spacing:.12em}
${S("dossier")} .alm-list li.due::after{content:"due";display:inline-block;margin-left:8px;padding:1px 6px;border:1.5px solid var(--alm-accent);color:var(--alm-accent);font:600 9.5px/1.4 var(--alm-font-mono);letter-spacing:.2em;text-transform:uppercase;transform:rotate(-3deg)}

/* Scriptorium: seals, ribbons, blackletter initials */
${S("scriptorium")} .alm-say__medal{border-radius:50% 50% 8px 8px!important;font:400 24px/1 "UnifrakturMaguntia",serif!important;box-shadow:0 0 0 2px var(--alm-panel),0 0 0 3.5px var(--alm-gold)!important}
${S("scriptorium")} .alm-say__bubble{background:color-mix(in oklab,var(--c) 8%,var(--alm-panel))!important;box-shadow:none!important}
${S("scriptorium")} .alm-say__who{border-radius:0!important;clip-path:polygon(0 0,100% 0,calc(100% - 7px) 50%,100% 100%,0 100%);padding-right:16px!important;letter-spacing:.06em!important;font-size:12px!important}
${S("scriptorium")} .alm-say--user .alm-say__who{clip-path:polygon(0 0,100% 0,100% 100%,0 100%,7px 50%);padding-left:16px!important;padding-right:9px!important}
${S("scriptorium")} .alm-say__line{font-size:1.14em!important}
${S("scriptorium")} .alm-thk{border-style:dotted!important;font:italic 400 19px/1.3 var(--alm-font-hand)!important}
${S("scriptorium")} .alm-chapter::before,${S("scriptorium")} .alm-chapter::after{background:linear-gradient(var(--alm-accent),var(--alm-accent)) center 3px/100% 1px no-repeat,linear-gradient(var(--alm-accent),var(--alm-accent)) center 6px/100% 1px no-repeat}
${S("scriptorium")} .alm-chapter b{font-weight:400!important}
${S("scriptorium")} .alm-chapter+p::first-letter{float:left;font:400 3.6em/.82 "UnifrakturMaguntia",serif;color:var(--alm-accent);padding:.08em .12em 0 0;text-shadow:1px 1px 0 var(--alm-gold)}
${S("scriptorium")} details.alm-drawer{outline:1px solid var(--alm-line);outline-offset:-5px}
${S("scriptorium")} .almp .card{box-shadow:inset 0 0 0 3px var(--alm-panel),inset 0 0 0 4px var(--alm-line)}

/* Arcana: glowing voices, gold frames */
${S("arcana")} .alm-say__medal{box-shadow:0 0 0 2px var(--alm-panel),0 0 0 3.5px color-mix(in oklab,var(--c) 70%,transparent),0 0 20px -2px var(--c)!important}
${S("arcana")} .alm-say__who{border-radius:99px!important;letter-spacing:.2em!important;font-size:10px!important}
${S("arcana")} .alm-say__tone{font-family:var(--alm-font-body)!important}
${S("arcana")} .alm-thk{border-style:solid!important;border-color:color-mix(in oklab,var(--c) 40%,transparent)!important;box-shadow:0 0 24px -8px var(--c);font:italic 400 18px/1.35 var(--alm-font-hand)!important}
${S("arcana")} .alm-chapter::before,${S("arcana")} .alm-chapter::after{background:linear-gradient(90deg,transparent,var(--alm-gold) 40%,transparent) center/100% 1px no-repeat,radial-gradient(circle,var(--alm-gold) 0 2px,transparent 2.5px) center/8px 8px no-repeat}
${S("arcana")} .alm-chapter b{font-family:"Cinzel Decorative",serif!important;font-style:normal!important;font-size:22px!important;color:var(--alm-accent)!important}
${S("arcana")} details.alm-drawer,${S("arcana")} .almp .card{box-shadow:inset 0 0 0 5px var(--alm-panel),inset 0 0 0 6px color-mix(in oklab,var(--alm-gold) 30%,transparent),var(--alm-lift)!important}
@media (prefers-reduced-motion:no-preference){${S("arcana")} .alm-say__medal{animation:alm-glow 4s ease-in-out infinite alternate}}
@keyframes alm-glow{to{box-shadow:0 0 0 2px var(--alm-panel),0 0 0 3.5px color-mix(in oklab,var(--c) 90%,transparent),0 0 28px 0 var(--c)}}

/* Orbital: clipped corners, terminal thoughts */
${FLAT_BUBBLE("orbital")}
${S("orbital")} details.alm-drawer,${S("orbital")} .almp .card{clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
${S("orbital")} details.alm-drawer{border-top:3px solid var(--alm-accent)!important}
${S("orbital")} .alm-say__medal{border-radius:0!important;clip-path:polygon(0 0,70% 0,100% 30%,100% 100%,30% 100%,0 70%);box-shadow:none!important;font-family:var(--alm-font-mono)!important;font-weight:500!important}
${S("orbital")} .alm-say__bubble{border-radius:0!important;background:var(--alm-panel)!important;border:1px solid var(--alm-line)!important;border-left:3px solid var(--c)!important;box-shadow:none!important}
${S("orbital")} .alm-say--user .alm-say__bubble{border-left-width:1px!important;border-right:3px solid var(--c)!important}
${S("orbital")} .alm-say__who{border-radius:0!important;letter-spacing:.14em!important}
${S("orbital")} .alm-say__tone{font:500 10px/1 var(--alm-font-mono)!important;font-style:normal!important;text-transform:uppercase!important;letter-spacing:.1em!important}
${S("orbital")} .alm-thk{border-radius:0!important;border:1px dashed var(--c)!important;font:400 13.5px/1.5 var(--alm-font-hand)!important;padding:8px 14px!important}
${S("orbital")} .alm-thk__lab::before{content:"> ";letter-spacing:0}
${S("orbital")} .alm-chapter::before,${S("orbital")} .alm-chapter::after{background:repeating-linear-gradient(90deg,var(--alm-ink) 0 6px,transparent 6px 10px) center/100% 2px no-repeat}
${S("orbital")} .alm-chapter b{font-style:normal!important;font-weight:700!important;text-transform:uppercase;letter-spacing:.06em}
${S("orbital")} .alm-pill,${S("orbital")} .alm-caret,${S("orbital")} .alm-btn,${S("orbital")} .alm-tag,${S("orbital")} .alm-seg i,${S("orbital")} .almp .btn,${S("orbital")} .almp .pill{border-radius:0!important}
${S("orbital")} .alm-btn{text-transform:uppercase;letter-spacing:.08em}

/* Posy: floral print, a sprig of roses, round pills */
${S("posy")} .alm-say__who{border-radius:99px!important;padding:5px 11px!important}
${S("posy")} .alm-say__medal{box-shadow:0 0 0 3px var(--alm-panel),0 0 0 5px color-mix(in oklab,var(--c) 35%,transparent)!important}
${S("posy")} .alm-thk{border-style:dotted!important;border-width:2px!important;font-size:25px!important}
${S("posy")} .alm-thk__lab::after{content:" ✿";color:var(--alm-accent)}
${S("posy")} .alm-chapter::before,${S("posy")} .alm-chapter::after{background:radial-gradient(circle,var(--alm-accent) 0 3px,transparent 3.5px) center/12px 12px no-repeat,linear-gradient(var(--alm-accent-2),var(--alm-accent-2)) center/100% 1px no-repeat}
${S("posy")} .alm-chapter b{font-style:normal!important;font-weight:400!important}
${S("posy")} .alm-drawer__body{position:relative}
${S("posy")} .alm-drawer__body::after{content:"";position:absolute;right:-6px;bottom:-6px;width:84px;height:84px;background:var(--alm-sprig) center/contain no-repeat;opacity:.6;pointer-events:none}
${S("posy")} .alm-btn,${S("posy")} .almp .btn,${S("posy")} .alm-caret{border-radius:99px!important}
${S("posy")} .alm-btn--primary,${S("posy")} .almp .btn.primary{background:var(--alm-accent-2)!important;border-color:color-mix(in oklab,var(--alm-accent-2) 70%,#000)!important}
`;
var SKIN_CSS = tokens() + `
` + SIGNATURES;

// src/core/knowparse.ts
var CHANNEL_WORDS = "aloud|out loud|openly|announced|shouted|whisper(?:ed|s|ing)?|murmured|quietly|privately|in private|in secret|aside|in a letter|letter|written|wrote|a note|text(?:ed)?|message|shown|showed|showing|in plain sight|overheard|signed|mouthed|telepathically";
var CHANNEL_ANY = new RegExp(`\\b(${CHANNEL_WORDS})\\b`, "i");
var CHANNEL_ANY_G = new RegExp(`\\b(?:${CHANNEL_WORDS})\\b`, "gi");

// src/core/facts.ts
var STOP = new Set(("the a an of to in on at is was be and or for with by from that this it its his her their he she they him them has had have not no " + "you your yours i me my we our us are were been being do does did don doesn didn isn wasn can will would could should just so too very as up out").split(" "));
var SPEECH_STOP = new Set("said says told tells asked calls called named know knows like just really very yes yeah okay ok well now then here there what who how why when where".split(" "));
var WH = new Set("who whom whose what which why how when where whether if".split(" "));

// src/core/dsl.ts
var SUBJECT_OPS = new Set([
  "mood",
  "body",
  "look",
  "bond",
  "ladder",
  "know",
  "unaware",
  "item",
  "thread",
  "owe",
  "cons",
  "clockf",
  "rep",
  "journal",
  "keys",
  "artifact",
  "status",
  "gauge",
  "deadline"
]);

// src/core/state.ts
var NOT_A_PERSON = "-";
var CHAR_OPS = new Set(["mood", "body", "look", "bond", "ladder", "know", "unaware", "status", "journal"]);
var STOP2 = new Set("the a an of to in on at is was be and or for with by from that this it its his her their he she they".split(" "));

// src/frontend/orrery.ts
var GROUPS = [
  { id: "people", label: "People", color: "#ff8fa3", icon: "cast", pages: ["cast", "bonds", "knowledge"] },
  { id: "story", label: "Story", color: "#5fcfc0", icon: "chronicle", pages: ["chronicle", "timeline", "world"] },
  { id: "library", label: "Library", color: "#a99bff", icon: "codex", pages: ["codex", "lore", "creator"] },
  { id: "engine", label: "Engine", color: "#ffc46b", icon: "settings", pages: ["recall", "craft", "settings"] }
];
var PAGES = ["now", ...GROUPS.flatMap((g) => g.pages)];
var LABEL = {
  now: "Now",
  cast: "Cast",
  bonds: "Bonds",
  knowledge: "Knowledge",
  chronicle: "Chronicle",
  timeline: "Timeline",
  world: "World",
  codex: "Codex",
  lore: "Lore",
  creator: "Creator",
  recall: "Recall",
  craft: "Craft",
  settings: "Settings"
};
var groupOf = (p) => GROUPS.find((g) => g.pages.includes(p));
var IC = {
  now: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  cast: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.3-.3 4.3 1 5 3.8"/>',
  bonds: '<circle cx="6" cy="7" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.5 7h7M7.2 9.2l3.6 6.6M16.8 9.2l-3.6 6.6"/>',
  knowledge: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  chronicle: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5Z"/><path d="M12 6.5v13"/>',
  timeline: '<path d="M7 3v18"/><circle cx="7" cy="7" r="2"/><circle cx="7" cy="16" r="2"/><path d="M11 7h9M11 16h6"/>',
  world: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5Z"/>',
  codex: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  lore: '<path d="M7 4h11v13a3 3 0 0 1-3 3H6"/><path d="M7 4a2 2 0 0 0-2 2v2h2M6 20a2 2 0 0 0 2-2v-1h10"/><path d="M10 9h5M10 12.5h5"/>',
  creator: '<path d="M20 4c-7 1-12 6-13.5 13.5L5 20"/><path d="M20 4c-.5 5-3.5 9.5-9 11"/><path d="m9 13.5 3 3"/>',
  recall: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/><path d="M10.5 7.5v3l2 1.5"/>',
  craft: '<path d="M4 20 15 9"/><path d="m14 5 1-2 1 2 2 1-2 1-1 2-1-2-2-1Z"/><path d="m19 12 .6 1.4L21 14l-1.4.6L19 16l-.6-1.4L17 14l1.4-.6Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'
};
var icon = (p) => `<svg class="almo-ic" viewBox="0 0 24 24" aria-hidden="true">${IC[p]}</svg>`;
var BAND_SKY = {
  "deep night": "linear-gradient(175deg,#070a1c,#161c3e)",
  "small hours": "linear-gradient(175deg,#0c1230,#252b58)",
  "pre-dawn": "linear-gradient(175deg,#1d2352,#5a4a78)",
  dawn: "linear-gradient(175deg,#3a3570,#e58b72)",
  sunrise: "linear-gradient(175deg,#6f7fb8,#ffc48a)",
  morning: "linear-gradient(175deg,#4f86c4,#9fc9e8)",
  midday: "linear-gradient(175deg,#3f86d0,#8cc3ea)",
  afternoon: "linear-gradient(175deg,#4a86c4,#a9c4dc)",
  "golden hour": "linear-gradient(175deg,#5b7cb4,#f0b865)",
  sunset: "linear-gradient(175deg,#4b3f7c,#e87a52)",
  dusk: "linear-gradient(175deg,#252459,#94507e)",
  evening: "linear-gradient(175deg,#141a44,#3b3566)"
};
var n = (x, one, many = `${one}s`) => `${x} ${x === 1 ? one : many}`;
function summary(p, v) {
  const w = v.world ?? {};
  const present = (v.cast ?? []).filter((c) => c.tier === "spot" || c.tier === "peri").length;
  switch (p) {
    case "now":
      return v.now?.time ? `Day ${v.now.day ?? "?"} · ${v.now.time}` : "not started";
    case "cast":
      return `${n((v.cast ?? []).length, "person", "people")} · ${present} present`;
    case "bonds":
      return n((v.bonds ?? []).length, "bond");
    case "knowledge":
      return n((v.knowledge ?? []).length, "fact");
    case "chronicle": {
      const c = v.chronicle?.counts ?? { chapter: v.counts?.chapters ?? 0 };
      return `${n(c.volume ?? 0, "volume")} · ${n(c.arc ?? 0, "arc")} · ${n(c.chapter ?? 0, "chapter")} · ${v.chronicle?.coverage?.raw ?? 100}% raw`;
    }
    case "timeline":
      return n((v.timeline ?? []).length, "milestone");
    case "world": {
      const due = dueCount(v);
      return `${n((w.threads ?? []).length, "thread")}${due ? ` · ${due} due` : ""}`;
    }
    case "codex":
      return n((v.codex ?? []).length, "record");
    case "lore": {
      const books = Object.keys(v.lore?.books ?? {}).length;
      const review = v.lore?.review?.length ?? 0;
      return `${n(books, "book")}${review ? ` · ${review} to review` : ""}`;
    }
    case "creator":
      return "build a lorebook";
    case "recall": {
      const f = v.feed?.[0];
      return f ? `${f.items.filter((i) => i.injected).length} of ${f.items.length} injected` : "after the next reply";
    }
    case "craft":
      return v.telemetry?.technique ? `try: ${v.telemetry.technique}` : "after a few replies";
    case "settings":
      return v.enabled ? "Ledger on" : "Ledger off";
  }
}
function dueCount(v) {
  const w = v.world ?? {};
  return (w.cons ?? []).filter((c) => c.status === "due").length + (w.deadlines ?? []).filter((d) => d.passed && !d.done).length;
}
function attention(g, v) {
  if (!v)
    return 0;
  if (g === "story")
    return dueCount(v);
  if (g === "library")
    return v.lore?.review?.length ?? 0;
  if (g === "engine")
    return (v.counts?.unverified ?? 0) + (v.rejected?.length ? 1 : 0);
  return 0;
}
function moon(m) {
  if (!m)
    return "";
  const lit = Math.max(0, Math.min(1, Number(m.illumination ?? 0.5)));
  const dir = /wan/i.test(m.name ?? "") ? -1 : 1;
  const shadow = Math.round((1 - lit) * 34) * dir;
  return `<span class="almo-moon" style="--sh:${shadow}px" title="${escapeHtml(m.name ?? "")}" aria-label="${escapeHtml(m.name ?? "")}"></span>`;
}
function skyHeader(v, page) {
  const now = v.now ?? {};
  const sky = BAND_SKY[now.band] ?? BAND_SKY.evening;
  const clock = String(now.clock ?? "");
  const cut = clock.lastIndexOf(", ");
  const date = now.time && cut > 0 ? clock.slice(0, cut) : now.time ? clock : "The clock starts with the first scene";
  const [weekday, ...rest] = date.split(" ");
  const place = now.place ?? [];
  const g = groupOf(page);
  const chips = [
    now.weather ? `${escapeHtml(now.weather.glyph)} ${escapeHtml(now.weather.text ?? now.weather.condition)}` : "",
    place.length ? `\uD83D\uDCCD ${escapeHtml(place.slice(-2).join(" › "))}` : "",
    now.mode ? escapeHtml(now.mode) : ""
  ].filter(Boolean);
  const rain = /rain|storm|drizzle|shower|sleet/i.test(now.weather?.condition ?? "") ? " almo-rain" : /snow/i.test(now.weather?.condition ?? "") ? " almo-snow" : "";
  const night = /night|hours|pre-dawn|evening|dusk/.test(now.band ?? "evening") ? " almo-night" : "";
  return `<header class="almo-sky${rain}${night}" style="background:${sky}">
  <div class="almo-sky__row"><div class="almo-clock">${escapeHtml(now.time ?? "--:--")}</div><div class="almo-date">${rest.length ? `${escapeHtml(weekday)}<br>${escapeHtml(rest.join(" "))}` : escapeHtml(date)}</div>${moon(now.moon)}</div>
  ${page === "now" && now.title ? `<div class="almo-title">${escapeHtml(now.title)}</div>` : ""}
  ${chips.length ? `<div class="almo-chips">${chips.map((c) => `<span>${c}</span>`).join("")}</div>` : ""}
  ${g ? `<div class="almo-seg" role="tablist" aria-label="${escapeHtml(g.label)}" style="--pc:${g.color}">${g.pages.map((p) => `<button role="tab" data-page="${p}" aria-selected="${p === page}">${icon(p)}<span>${LABEL[p]}</span></button>`).join("")}</div>` : ""}
</header>`;
}
function pageTitle(v, page) {
  if (page === "now")
    return "";
  const g = groupOf(page);
  return `<div class="almo-head"><span class="almo-eyebrow" style="color:${g?.color}">${escapeHtml(g?.label ?? "")}</span><h3>${LABEL[page]}</h3><small>${escapeHtml(summary(page, v))}</small></div>`;
}
function dock(v, page, orbit) {
  const cur = groupOf(page);
  const planet = (g) => {
    const a = attention(g.id, v);
    return `<button class="almo-pl${cur === g ? " on" : ""}${a ? " alert" : ""}" style="--pc:${g.color}" data-orbit="${g.id}" aria-expanded="${orbit === g.id}" aria-label="${escapeHtml(g.label)}${a ? ` (${a} need a look)` : ""}"><span class="almo-orb">${icon(g.icon)}${a ? `<b>${a > 9 ? "9+" : a}</b>` : ""}</span><span>${escapeHtml(g.label)}</span></button>`;
  };
  const og = GROUPS.find((g) => g.id === orbit);
  const pos = [[0, 50], [96, 0], [192, 50]];
  const ring = og ? `<div class="almo-orbit" style="--pc:${og.color}" role="menu" aria-label="${escapeHtml(og.label)}">${og.pages.map((p, i) => `<button class="almo-moonb" role="menuitem" style="left:${pos[i][0]}px;top:${pos[i][1]}px;animation-delay:${i * 40}ms" data-page="${p}"><span class="almo-m">${icon(p)}</span><b>${LABEL[p]}</b><small>${escapeHtml(v ? summary(p, v) : "")}</small></button>`).join("")}<div class="almo-orbit__t">${escapeHtml(og.label)}</div></div>` : "";
  return `<div class="almo-dockwrap">${ring}<nav class="almo-dock" aria-label="Almanac pages">${planet(GROUPS[0])}${planet(GROUPS[1])}<button class="almo-sun${page === "now" ? " on" : ""}" data-page="now" aria-label="Now"><span>${icon("now")}<small>NOW</small></span></button>${planet(GROUPS[2])}${planet(GROUPS[3])}</nav></div>`;
}
function emptySky(status) {
  const [title, text] = status === "nochat" ? ["No sky yet", "Open a chat to set the clock turning."] : status === "stalled" ? ["The Ledger hasn't answered", "Check that ALMANAC Ledger is enabled in Extensions and has its permissions, then retry."] : ["Reading this chat…", "Setting up the sky."];
  return `<div class="almo-empty"><div class="almo-dial${status === "waiting" ? " spin" : ""}"></div><h4>${title}</h4><p>${text}</p>${status === "stalled" ? `<button class="btn primary" data-act="retryState">Retry</button>` : ""}</div>`;
}

// src/frontend/app.ts
var TABS = PAGES;
var RANK = { chapter: 1, arc: 2, volume: 3 };
var LEVEL_COLOR = { volume: "#7b5bd6", arc: "var(--alm-accent-2)", chapter: "var(--alm-accent)" };
var cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
var KIND_HELP = {
  secret: "Someone keeps it, or someone lacks it while someone else has it",
  belief: "Someone suspects, believes, doubts or is wrong about it",
  shared: "Two or more people have it",
  noted: "One person noticed it; no one is known to lack it (never sent to the model)"
};
var WEAVER_BOOK = {
  governance: ["rules book", "Always-on rules and the re-anchor that keep the character on spec. Left to Lumiverse: the Ledger never folds, forces or switches these entries off."],
  lore: ["lore book", "The world's deep lore, surfacing when relevant."],
  npc: ["NPC book", "The people the narrator can voice, one entry per person."],
  depth: ["depth book", "More about the card's character, surfacing when relevant."],
  persona: ["persona depth", "More about your persona, surfacing when relevant."]
};
var LORE_KINDS = [
  ["directive", "always-on rule", "always-on rules"],
  ["person", "person", "people"],
  ["place", "place", "places"],
  ["group", "group", "groups"],
  ["object", "object", "objects"],
  ["law", "world rule", "world rules"],
  ["history", "history", "history"],
  ["situation", "situation", "situations"],
  ["belief", "belief", "beliefs"],
  ["forecast", "upcoming event", "upcoming events"],
  ["boundary", "canon point", "canon points"],
  ["texture", "custom or detail", "customs & detail"],
  ["meta", "instruction", "instructions"]
];
function worldPanel(w, simulator) {
  if (!w)
    return "";
  const agency = w.agenda || w.holds?.length;
  return `<div class="rec" style="margin-bottom:10px"><div class="hd"><b class="grow">${escapeHtml(w.name)}</b><span class="pill" title="A world built in Lumiverse's Dream Weaver: you chat with a narrator that runs this place and voices its people">Dream Weaver · world</span><span class="pill">${agency ? "agency on" : "cozy"}</span></div>
${w.premise ? `<div class="alm-cc__row"><b>premise</b>${escapeHtml(w.premise)}</div>` : ""}${w.tension ? `<div class="alm-cc__row"><b>tension</b>${escapeHtml(w.tension)}</div>` : ""}${w.agenda ? `<div class="alm-cc__row"><b>agenda</b>${escapeHtml(w.agenda)}</div>` : ""}${w.holds?.length ? `<div class="alm-cc__row"><b>holds</b>${w.holds.map((h) => escapeHtml(h)).join("<br>")}</div>` : ""}
<p class="muted">The card is the narrator, and the place is a Codex record. Chapters call its replies the Narrator's.${agency ? simulator ? " Between scenes, the off-screen simulator moves the world's agenda and never breaks its holds." : " Turn on the off-screen simulator (Settings) to have the world's agenda move between scenes." : ""}</p></div>`;
}
function loreKinds(kinds) {
  if (!kinds)
    return "";
  const known = new Map(LORE_KINDS.map(([k, one, many]) => [k, [one, many]]));
  const label = (k) => known.get(k)?.[kinds[k] === 1 ? 0 : 1] ?? k;
  const parts = [...LORE_KINDS.map(([k]) => k), ...Object.keys(kinds).filter((k) => !known.has(k))].filter((k) => kinds[k]).map((k) => `${kinds[k]} ${label(k)}`);
  return parts.length ? `<div class="muted" style="margin:4px 0">Read as: ${escapeHtml(parts.join(" · "))}</div>` : "";
}
var PERSON_OPTS = [["", "as the story says"], ["knows", "knows it"], ["believes", "believes it"], ["suspects", "suspects it"], ["doubts", "doubts it"], ["wrong", "has it wrong"], ["unaware", "doesn't know"], ["none", "no record either way"]];

class AlmanacApp {
  ctx;
  root;
  view = null;
  tab = "now";
  asOf = Infinity;
  graphAxis = "";
  npcOnly = false;
  factQuery = "";
  factKind = "play";
  factPerson = "";
  editingFact = null;
  editingChar = null;
  openFacts = new Set;
  clerkProgress = "";
  chronFilter = "all";
  chronOpen = new Set;
  codexFilter = "";
  codexKind = "";
  editing = null;
  orbit = "";
  creator;
  status = "nochat";
  hudProblem = "";
  versionWarning = "";
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
    this.root.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && this.orbit) {
        this.orbit = "";
        this.render();
      }
    });
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
    if (!v) {
      this.root.innerHTML = `<div class="almo">${emptySky(this.status)}</div>`;
      return;
    }
    let body = "";
    try {
      body = this[`tab_${this.tab}`]?.(v) ?? "";
    } catch (err) {
      body = `<div class="empty">Could not draw this page: ${escapeHtml(String(err))}</div>`;
    }
    const stale = this.versionWarning ? `<div class="card flat alm-warnbox"><b>The Ledger's background process is running ${escapeHtml(this.versionWarning)}, but this page loaded ${VERSION}.</b><p class="muted">In Extensions, turn ALMANAC Ledger off and on again (or press Update), then reload the page. If this stays, check Extensions for a second copy of ALMANAC Ledger and remove the older one.</p></div>` : "";
    const pe = v.enabled ? v.planError : null;
    const planErr = pe ? `<div class="card flat alm-warnbox"><b>The last ${pe.genType === "normal" ? "turn" : escapeHtml(pe.genType)} went to the model without the Almanac.</b><p class="muted">At ${escapeHtml(new Date(pe.at).toLocaleString())}, ${escapeHtml(pe.where)} failed, so the reply was written without the ledger note, recall or mirror entries. This clears itself on the next turn that works. If it keeps coming back, update the extension, and report the error below if an update doesn't fix it.</p><p><code>${escapeHtml(pe.message)}</code></p>${pe.stack ? `<details><summary class="muted">Details for a bug report</summary><pre>ALMANAC Ledger ${escapeHtml(v.version)}
${escapeHtml(pe.stack)}</pre></details>` : ""}</div>` : "";
    const banner = !v.enabled ? `<div class="card flat"><b>The Ledger is not active in this chat.</b><p class="muted">It switches on by itself when the ALMANAC preset is in use (or a reply contains a &lt;ledger&gt; block). You can also turn it on here.</p><button class="btn primary" data-act="enable">Turn on for this chat</button></div>` : "";
    const scroll = this.root.scrollTop;
    this.root.innerHTML = `<div class="almo${this.orbit ? " orbiting" : ""}">${skyHeader(v, this.tab)}<main class="almo-body">${pageTitle(v, this.tab)}${stale}${planErr}${banner}${body}</main>${dock(v, this.tab, this.orbit)}</div>`;
    this.root.scrollTop = scroll;
  }
  go(page) {
    const changed = page !== this.tab;
    this.tab = page;
    this.orbit = "";
    try {
      localStorage.setItem("alm-tab", this.tab);
    } catch {}
    this.render();
    if (changed)
      this.root.scrollTop = 0;
  }
  tab_now(v) {
    const n = v.now;
    const present = v.cast.filter((c) => c.tier === "spot" || c.tier === "peri");
    const fc = (n.forecastHours ?? []).filter((_, i) => i % 2 === 0).slice(0, 6);
    const facts = [
      n.place.length ? `<b>Where</b><span>${escapeHtml(n.place.join(" › "))}</span>` : "",
      n.sun ? `<b>Sun</b><span>${escapeHtml(n.sun.text)}</span>` : "",
      n.moon ? `<b>Moon</b><span>${escapeHtml(n.moon.glyph)} ${escapeHtml(n.moon.name)}</span>` : "",
      n.season ? `<b>Season</b><span>${escapeHtml(n.season)}</span>` : "",
      `<b>Scene</b><span>${n.scene} · ${escapeHtml(n.mode)}</span>`
    ].join("");
    return `<div class="card flat almo-facts"><div class="kv">${facts}</div></div>
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
${c.activity ? `<div class="alm-cc__row"><b>doing</b>${escapeHtml(c.activity)}</div>` : ""}${!compact && c.age ? `<div class="alm-cc__row"><b>age</b>${escapeHtml(c.age)}${c.ageSet ? "" : ` <small class="muted" title="From the lore">(lore)</small>`}</div>` : ""}${!compact && c.appearance ? `<div class="alm-cc__row"><b>appearance</b>${escapeHtml(c.appearance)}</div>` : ""}${!compact && c.look ? `<div class="alm-cc__row"><b>look</b>${escapeHtml(c.look)}</div>` : ""}${!compact && c.place ? `<div class="alm-cc__row"><b>where</b>${escapeHtml(c.place)}</div>` : ""}
</div></article>`;
  }
  tab_cast(v) {
    const add = this.editingChar === "__new" ? this.charEditor(null) : `<div class="row" style="margin-bottom:8px"><span class="grow"></span><button class="btn" data-act="charAdd" title="Add someone the story hasn't named yet, or who should be tracked from now on">+ Add a person</button></div>`;
    return `${add}<div class="list">${v.cast.map((c) => `<div class="card">
<div class="row"><span class="alm-mini" style="--c:${escapeHtml(c.color)}">${escapeHtml(initials(c.name))}</span><b class="grow">${escapeHtml(c.name)}${c.aliases?.length ? ` <small class="muted">(${escapeHtml(c.aliases.join(", "))})</small>` : ""}</b><span class="pill">slot ${c.slot}</span><button class="btn" data-act="charEdit" data-id="${escapeHtml(c.id)}" title="${c.isUser ? "Age and appearance" : "Name, age and appearance"}">edit</button><input type="color" class="swatch" data-color="${escapeHtml(c.id)}" value="${escapeHtml(toHex(c.color))}" title="${c.isUser ? "Your persona's colour" : "Voice colour"}" aria-label="${escapeHtml(c.isUser ? "Your persona's colour" : `${c.name}'s colour`)}"></div>
${this.editingChar === c.id ? this.charEditor(c) : this.castCard(c)}
${c.journal?.length ? `<h4>In their own words</h4>${c.journal.map((j) => `<div class="muted">“${escapeHtml(j.text)}”</div>`).join("")}` : ""}
${c.isUser ? "" : `<h4>Hidden pressure (narrator-only)</h4><div class="row"><span class="spoiler grow" tabindex="0">${escapeHtml(c.pressure || "— none drawn yet —")}</span><button class="btn" data-act="editPressure" data-id="${escapeHtml(c.id)}">edit</button></div>`}
${this.mergeRow(v, c)}
${c.isUser ? "" : `<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn danger" data-act="notPerson" data-name="${escapeHtml(c.name)}" title="For a force, spell, place or thing the story mistook for a character. Lines about it stop creating a character; you can restore it below.">Not a person — remove</button></div>`}
</div>`).join("") || `<div class="empty">No one has appeared yet.</div>`}</div>${this.removedRow(v)}`;
  }
  charEditor(c) {
    const id = c?.id ?? "__new";
    const name = c?.isUser ? `<p class="muted"><small>Your persona's name comes from Lumiverse.</small></p>` : `<label class="f">Name<input type="text" id="almCharName" value="${escapeHtml(c?.name ?? "")}" placeholder="${c ? "" : "Walter Hale"}"></label>${c ? `<p class="muted"><small>The old name keeps working in the story's lines.</small></p>` : ""}`;
    return `<div class="card almk--edit">${name}
<label class="f">Age<input type="text" id="almCharAge" value="${escapeHtml(c?.ageSet ? c.age : "")}" placeholder="${escapeHtml(c?.age && !c.ageSet ? `${c.age} (from the lore)` : "e.g. 24, early fifties, ageless")}"></label>
<label class="f">Appearance<textarea id="almCharLook" placeholder="Build, hair, eyes, what people notice first">${escapeHtml(c?.appearance ?? "")}</textarea></label>
<div class="row"><button class="btn primary" data-act="charSave" data-id="${escapeHtml(id)}">${c ? "Save" : "Add"}</button><button class="btn" data-act="charCancel">Cancel</button></div></div>`;
  }
  removedRow(v) {
    const gone = Object.entries(v.config?.merges ?? {}).filter(([, to]) => to === NOT_A_PERSON).map(([n]) => n);
    if (!gone.length)
      return "";
    return `<h4>Removed from the cast</h4><div class="card flat"><p class="muted" style="margin:0 0 8px"><small>Not characters: the story's lines about them as people are ignored, and the model is told to leave them out.</small></p><div class="row">${gone.map((n) => `<span class="pill">${escapeHtml(n)} <button class="btn" data-act="restorePerson" data-name="${escapeHtml(n)}" title="Put it back in the cast" style="padding:0 6px;margin-left:4px">restore</button></span>`).join("")}</div></div>`;
  }
  mergeRow(v, c) {
    const merges = v.config?.merges ?? {};
    const mine = Object.entries(merges).filter(([, to]) => c.isUser ? to === "user" : to.toLowerCase() === c.name.toLowerCase()).map(([from]) => from);
    const chips = mine.map((n) => `<span class="pill">${escapeHtml(n)} <button class="btn" data-act="unmerge" data-name="${escapeHtml(n)}" title="Split this name off again" style="padding:0 6px;margin-left:4px">✕</button></span>`).join("");
    const pick = c.isUser ? "" : `<label class="f">Same person as…<select data-merge="${escapeHtml(c.name)}"><option value="">— no, a different person —</option><option value="user">${escapeHtml(v.names?.user || "You")} (you)</option>${v.cast.filter((o) => !o.isUser && o.id !== c.id).map((o) => `<option value="${escapeHtml(o.name)}">${escapeHtml(o.name)}</option>`).join("")}</select></label>`;
    return pick || chips ? `<div class="alm-merge">${chips ? `<div class="row"><small class="muted">Also written as:</small>${chips}</div>` : ""}${pick}</div>` : "";
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
    const hidden = v.hiddenFacts ?? [];
    const clerk = this.clerkBar(v);
    const adding = this.editingFact === "__new" ? this.factEditor(v, null) : `<div class="row" style="margin-bottom:8px"><span class="grow"></span><button class="btn" data-act="factAdd" title="Add a fact the story hasn't recorded, and say who knows it">+ Add a fact</button></div>`;
    if (!v.knowledge.length && !hidden.length)
      return `${clerk}${adding}<div class="empty">No facts yet. The model records them with <code>reveal</code>, <code>know</code> and <code>secret</code> lines; each fact collects who has it, how it reached them, and who it's kept from.</div>`;
    const people = new Map(v.cast.map((c) => [c.id, c]));
    const q = this.factQuery.trim().toLowerCase();
    const who = this.factPerson;
    const kinds = {
      play: (f) => f.kind === "secret" || f.kind === "belief" || f.inPlay || f.added,
      shared: (f) => f.kind === "shared",
      noted: (f) => f.kind === "noted",
      all: () => true
    };
    const counts = Object.fromEntries(Object.entries(kinds).map(([k, fn]) => [k, v.knowledge.filter(fn).length]));
    const touches = (f) => !who || f.stances.some((s) => s.id === who) || f.lacks.some((l) => l.id === who) || f.keepers.some((k) => k.id === who);
    const shown = v.knowledge.filter((f) => kinds[this.factKind](f) && touches(f) && (!q || `${f.key} ${f.statement} ${f.stances.map((s) => s.name).join(" ")}`.toLowerCase().includes(q)));
    const mini = (id, name) => `<span class="alm-mini" style="--c:${escapeHtml(people.get(id)?.color ?? "#888")}">${escapeHtml(initials(name))}</span>`;
    const chip = (s) => {
      const cls = s.status === "wrong" ? "wrong" : s.status === "knows" ? "knows" : "sus";
      const icon = s.status === "wrong" ? "✗" : s.status === "knows" ? "✓" : "?";
      const label = s.status === "wrong" ? "wrong" : s.verb;
      const worked = s.derived === "witness" ? "was there when it came out" : s.derived === "source" ? "their own words or deed" : s.derived === "secret" ? "keeps it" : "";
      return `<div class="almk-h">${mini(s.id, s.name)}<div class="almk-h__b"><b>${escapeHtml(s.name)}</b><span class="alm-kp ${cls}"${worked ? ` title="Worked out by the Almanac: ${escapeHtml(worked)}"` : ""}>${icon} ${escapeHtml(label)}</span>${s.version ? `<small class="almk-ver">thinks “${escapeHtml(s.version)}”</small>` : ""}${s.how && !s.derived && !s.verb.includes(s.how) ? kpNote(s.how) : ""}</div></div>`;
    };
    const lackChip = (l) => `<div class="almk-h">${mini(l.id, l.name)}<div class="almk-h__b"><b>${escapeHtml(l.name)}</b><span class="alm-kp un">— ${escapeHtml(l.text)}</span></div></div>`;
    const KIND = { secret: "secret", belief: "belief", shared: "shared", noted: "noted" };
    const cards = shown.map((f) => {
      if (this.editingFact === f.key)
        return this.factEditor(v, f);
      const truth = f.truth !== "unknown" ? `<span class="pill${f.truth === "false" ? " warn" : ""}" title="Whether the fact is true">${f.truth === "true" ? "true" : f.truth === "false" ? "false" : "partly true"}</span>` : "";
      const hist = f.history.map((h) => `<li><time>${escapeHtml(h.when)}</time> <b>${escapeHtml(h.name)}</b> ${escapeHtml(h.verb)}${h.version ? `: “${escapeHtml(h.version)}”` : ""}${h.how && !h.derived && !h.verb.toLowerCase().includes(h.how.toLowerCase()) ? ` <span class="muted">— ${escapeHtml(h.how)}</span>` : ""}${h.note ? `<small class="almk-note">${escapeHtml(h.note)}</small>` : ""}</li>`).join("");
      const kept = f.keepers.length ? `<div class="almk-un">\uD83E\uDD2B Kept by ${escapeHtml(f.keepers.map((k) => k.name).join(", "))}${f.keptFrom.length ? ` from ${escapeHtml(f.keptFrom.map((k) => k.name).join(", "))}` : ""}</div>` : "";
      return `<div class="card flat almk almk--${escapeHtml(f.kind)}"><div class="almk-top"><span class="almk-key" title="The model refers to this fact as #${escapeHtml(f.key)}">#${escapeHtml(f.key)}</span><span class="pill almk-kind" title="${escapeHtml(KIND_HELP[f.kind] ?? "")}">${escapeHtml(KIND[f.kind] ?? f.kind)}</span>${truth}${f.locked ? `<span class="pill" title="You set this statement">✎ yours</span>` : ""}<span class="grow"></span><button class="btn" data-act="factEdit" data-id="${escapeHtml(f.key)}" title="Rename, set the truth, set who knows it, or merge">edit</button><button class="btn danger" data-act="factDelete" data-id="${escapeHtml(f.key)}" title="Delete this fact from the page and the model's note (you can restore it below)">delete</button></div>
<b class="almk-stmt">${escapeHtml(f.statement)}</b>
<div class="almk-st">${f.stances.map(chip).join("") || `<div class="muted">No one has it yet.</div>`}${f.lacks.map(lackChip).join("")}</div>
${kept}
<details class="almk-hist"${this.openFacts.has(f.key) ? " open" : ""} data-fact="${escapeHtml(f.key)}"><summary>How it came out · ${f.history.length}</summary><ol>${hist}</ol></details></div>`;
    }).join("");
    const irony = v.knowledge.flatMap((f) => f.stances.filter((s) => s.status === "wrong" || s.status !== "unaware" && f.truth === "false").map((s) => ({ f, s }))).slice(0, 3);
    const ironyHtml = irony.map(({ f, s }) => `<div class="alm-irony"><span class="i">\uD83C\uDFAD</span><span><b>Dramatic irony:</b> ${escapeHtml(s.name)} ${s.version ? `thinks “${escapeHtml(s.version)}”, but ${escapeHtml(f.statement)}` : `is certain that “${escapeHtml(f.statement)}”, which isn't true`}.</span></div>`).join("");
    const seg = (k, lab) => `<button class="pill${this.factKind === k ? " on" : ""}" data-act="factKind" data-id="${k}" aria-pressed="${this.factKind === k}">${lab} <b>${counts[k]}</b></button>`;
    const filters = `<div class="row almk-filters">${seg("play", "In play")}${seg("shared", "Shared")}${seg("noted", "Noted")}${seg("all", "All")}<span class="grow"></span><select data-set="factPerson" aria-label="Show one person"><option value="">everyone</option>${(v.knowers ?? []).map((p) => `<option value="${escapeHtml(p.id)}"${p.id === who ? " selected" : ""}>${escapeHtml(p.name)}${p.here ? " · here" : ""}</option>`).join("")}</select></div>`;
    const search = `<div class="row" style="margin-bottom:8px"><input type="text" data-set="factQuery" value="${escapeHtml(this.factQuery)}" placeholder="Find a fact or a person…" aria-label="Find a fact or a person" class="grow"><span class="muted"><small>${shown.length} of ${v.knowledge.length}</small></span></div>`;
    const person = who ? this.personKnowledge(v, who) : "";
    const hiddenHtml = hidden.length ? `<h4>Deleted facts</h4><div class="row">${hidden.map((h) => `<span class="pill">${escapeHtml(h.statement)} <button class="btn" data-act="factRestore" data-id="${escapeHtml(h.key)}" style="padding:0 6px;margin-left:4px">restore</button></span>`).join("")}</div>` : "";
    const empty = this.factKind === "play" ? "No secrets or beliefs in play. <b>Shared</b> and <b>Noted</b> hold the rest." : "Nothing matches.";
    return `${clerk}${ironyHtml}${filters}${search}${person}${adding}<div class="list">${cards || `<div class="empty">${empty}</div>`}</div>${hiddenHtml}`;
  }
  personKnowledge(v, id) {
    const p = (v.knowers ?? []).find((x) => x.id === id);
    if (!p)
      return "";
    const has = v.knowledge.flatMap((f) => f.stances.filter((s) => s.id === id).map((s) => `<li><b>${escapeHtml(f.statement)}</b> <span class="muted">— ${escapeHtml(s.status === "wrong" && s.version ? `thinks “${s.version}”` : s.verb)}</span></li>`));
    const lacks = v.knowledge.flatMap((f) => f.lacks.filter((l) => l.id === id).map((l) => `<li><b>${escapeHtml(f.statement)}</b> <span class="muted">— ${escapeHtml(l.text)}</span></li>`));
    const gaps = (v.knowGaps ?? []).find((g) => g.id === id)?.gaps ?? [];
    return `<div class="card flat almk-person"><h4>${escapeHtml(p.name)}</h4>
<details open><summary>Has · ${has.length}</summary><ul>${has.slice(0, 40).join("") || '<li class="muted">Nothing recorded.</li>'}</ul></details>
<details${lacks.length ? " open" : ""}><summary>Lacks · ${lacks.length}</summary><ul>${lacks.join("") || '<li class="muted">Nothing recorded as kept from them or missed.</li>'}</ul></details>
<details${gaps.length ? " open" : ""}><summary>Doesn't know, in the story's words · ${gaps.length}</summary><ul>${gaps.map((g) => `<li${g.stale ? ' class="muted" title="Not restated in the last 40 messages"' : ""}>${escapeHtml(g.text)}</li>`).join("") || '<li class="muted">No gaps recorded.</li>'}</ul></details></div>`;
  }
  clerkBar(v) {
    const c = v.clerk ?? {};
    const mode = c.mode === "off" ? "off for new replies" : c.mode === "always" ? "reads every new reply" : "reads new replies whose lines need it";
    const unread = Number(c.unread ?? 0);
    const read = Math.max(0, Number(c.replies ?? 0) - unread);
    const status = c.replies ? ` ${read} of ${c.replies} replies read.` : "";
    const button = c.running ? `<span class="pill on">reading…${this.clerkProgress ? ` ${escapeHtml(this.clerkProgress)}` : ""}</span><button class="btn" data-act="clerkStop" title="Stop after the reply it's reading; tidying again carries on from there">Stop</button>` : unread ? `<button class="btn" data-act="clerkTidy" title="Read every reply the clerk hasn't read yet, oldest first, and rewrite its knowledge lines cleanly: one quiet generation each. You can stop and carry on later.">Tidy the whole chat · ${unread} to read</button>` : c.replies ? `<span class="pill">every reply read</span>` : "";
    return `<div class="card flat almk-clerk"><div class="row"><span class="grow"><b>Knowledge clerk</b> <span class="muted">— ${escapeHtml(mode)}.${escapeHtml(status)}</span></span>${button}</div></div>`;
  }
  factEditor(v, fact) {
    const f = fact ?? { key: "__new", statement: "", stances: [], lacks: [] };
    const others = fact ? v.knowledge.filter((o) => o.key !== f.key) : [];
    const truthOpts = [["", fact ? "as the story says" : "not said"], ["true", "true"], ["false", "false"], ["partial", "partly true"], ["unknown", "unknown"]];
    const cur = fact ? v.config?.factEdits?.[f.key] ?? {} : {};
    return `<div class="card almk almk--edit"><label class="f">The fact, in a few words<input type="text" id="almFactStmt" value="${escapeHtml(f.statement)}" placeholder="${fact ? "" : "Walter is Gabriel's Watcher"}"></label>
<label class="f">Is it true?<select id="almFactTruth">${truthOpts.map(([k, l]) => `<option value="${k}"${(cur.truth ?? "") === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
${others.length ? `<label class="f">Same fact as…<select id="almFactInto"><option value="">— a separate fact —</option>${others.map((o) => `<option value="${escapeHtml(o.key)}">#${escapeHtml(o.key)} ${escapeHtml(o.statement)}</option>`).join("")}</select></label>` : ""}
<h4>Who knows it</h4><div class="list">${(v.knowers ?? []).map((p) => {
      const now = f.stances.find((s) => s.id === p.id);
      const lack = f.lacks.find((l) => l.id === p.id);
      const said = now ? now.verb : lack ? lack.text : "no record";
      if (!fact)
        return `<label class="f">${escapeHtml(p.name)}<select data-person="${escapeHtml(p.id)}">${PERSON_OPTS.filter(([k]) => k !== "none").map(([k, l]) => `<option value="${k}">${k ? l : "—"}</option>`).join("")}</select></label>`;
      const want = cur.people?.[p.id] ?? "";
      return `<label class="f">${escapeHtml(p.name)} <small class="muted">— now: ${escapeHtml(said)}</small><select data-person="${escapeHtml(p.id)}">${PERSON_OPTS.map(([k, l]) => `<option value="${k}"${want === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>`;
    }).join("")}</div>
<div class="row"><button class="btn primary" data-act="factSave" data-id="${escapeHtml(f.key)}">${fact ? "Save" : "Add"}</button><button class="btn" data-act="factCancel">Cancel</button><span class="grow"></span>${fact ? `<button class="btn danger" data-act="factHide" data-id="${escapeHtml(f.key)}" title="Delete it from this page and from the model's note">Delete</button>` : ""}</div></div>`;
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
    const ch = v.chronicle;
    const cov = ch.coverage;
    const tok = ch.tokens ?? {};
    const cnt = ch.counts ?? {};
    const all = ch.units;
    const byId = new Map(all.map((u) => [u.id, u]));
    const newest = (a, b) => b.startIdx - a.startIdx || RANK[b.level] - RANK[a.level];
    const t = (n) => `~${Math.round(n || 0).toLocaleString()}`;
    const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
    const label = (u) => `${cap(u.level)} ${u.no}`;
    const block = (u, depth) => {
      const kids = u.children.map((id) => byId.get(id)).filter(Boolean).sort(newest);
      const parent = u.parent ? byId.get(u.parent) : null;
      const open = this.chronOpen.has(u.id);
      const relevant = v.chronicle.mode === "relevant";
      const status = u.stale ? `<span class="pill">stale</span>` : u.ghost ? `<span class="pill">ghost</span>` : v.chronicle.mode === "off" ? `<span class="pill" title="Summaries are switched off in Settings">not in prompt</span>` : u.inPrompt ? `<span class="pill on-prompt" title="${relevant ? "The last prompt carried this summary" : "This summary is in every prompt"}">in prompt</span>` : relevant && u.folded ? `<span class="pill" title="Only when relevant: the prompt reads the chapters, not the ${escapeHtml(u.level)}">chapters used instead</span>` : relevant ? `<span class="pill" title="Goes in the prompt when a turn touches it">when relevant</span>` : `<span class="pill" title="The prompt uses ${escapeHtml(parent ? label(parent) : "a coarser summary")} for these turns instead (a turn that touches this chapter can still bring it back through recall)">folded${parent ? ` into ${escapeHtml(label(parent))}` : ""}</span>`;
      const nested = this.chronFilter === "all" && kids.length ? `<button class="chron-kids-t" data-act="chronToggle" data-id="${escapeHtml(u.id)}" aria-expanded="${open}">${open ? "▾" : "▸"} ${plural(kids.length, kids[0].level)} folded in</button>${open ? `<div class="chron-kids">${kids.map((k) => block(k, depth + 1)).join("")}</div>` : ""}` : "";
      return `<div class="rec chron chron--${u.level}${u.folded || u.stale || u.ghost ? " chron--folded" : ""}" style="--lv:${LEVEL_COLOR[u.level]}"><div class="hd"><span class="kind">${escapeHtml(label(u))}</span><b class="grow">${escapeHtml(u.title)}</b>${u.locked ? `<span class="pill" title="Locked">\uD83D\uDD12</span>` : ""}</div>
<div class="muted"><small>messages ${u.startIdx + 1}–${u.endIdx + 1}${u.storyStart ? ` · ${escapeHtml(u.storyStart)}${u.storyEnd && u.storyEnd !== u.storyStart ? ` – ${escapeHtml(u.storyEnd)}` : ""}` : ""}</small></div>
<div class="chron-tags">${status}<span class="pill tok" title="Estimated tokens in this summary">${t(u.tokens)} tokens</span>${u.detail ? `<span class="pill">${escapeHtml(u.detail)}</span>` : ""}</div>
<details><summary class="muted">read / edit</summary><textarea data-unit="${escapeHtml(u.id)}" style="min-height:140px">${escapeHtml(u.text)}</textarea><div class="row"><button class="btn" data-act="unitSave" data-id="${escapeHtml(u.id)}">Save</button><button class="btn" data-act="unitLock" data-id="${escapeHtml(u.id)}">${u.locked ? "Unlock" : "Lock"}</button><button class="btn" data-act="unitGhost" data-id="${escapeHtml(u.id)}">${u.ghost ? "Unghost" : "Ghost"}</button><button class="btn" data-act="unitRegen" data-id="${escapeHtml(u.id)}">Regenerate</button><button class="btn danger" data-act="unitUnhide" data-id="${escapeHtml(u.id)}">Unhide span</button></div></details>${nested}</div>`;
    };
    const f = this.chronFilter;
    const shown = f === "all" ? all.filter((u) => !u.parent || !byId.has(u.parent)).sort(newest) : all.filter((u) => u.level === f).sort(newest);
    const prompt = (tok.chapter ?? 0) + (tok.arc ?? 0) + (tok.volume ?? 0);
    const saved = (tok.replaced ?? 0) - prompt;
    const seg = (k, lab, n) => `<button class="pill${f === k ? " on" : ""}" data-act="chronFilter" data-id="${k}" aria-pressed="${f === k}">${lab}${n != null ? ` <b>${n}</b>` : ""}</button>`;
    const legend = (lv, lab, n) => `<div class="chron-lg"><i style="background:${lv === "raw" ? "var(--alm-line)" : LEVEL_COLOR[lv]}"></i><span class="grow">${lab}</span><span>${cov[lv] ?? 0}%</span><span class="muted">${t(tok[lv])} tok</span>${lv === "raw" ? "<span></span>" : `<span class="muted">${n}</span>`}</div>`;
    return `<div class="card flat"><h4>Coverage</h4><div class="bar"><i style="width:${cov.volume}%;background:${LEVEL_COLOR.volume}"></i><i style="width:${cov.arc}%;background:${LEVEL_COLOR.arc}"></i><i style="width:${cov.chapter}%;background:${LEVEL_COLOR.chapter}"></i><i style="width:${cov.raw}%;background:var(--alm-line)"></i></div>
<div class="chron-legend">${legend("volume", "Volumes", cnt.volume ?? 0)}${legend("arc", "Arcs", cnt.arc ?? 0)}${legend("chapter", "Chapters", cnt.chapter ?? 0)}${legend("raw", "Raw turns", 0)}</div>
<p class="muted" style="margin:8px 0"><small>In the ${v.chronicle.mode === "relevant" ? "last " : ""}prompt: <b>${t(prompt)}</b> tokens of summaries and <b>${t(tok.raw)}</b> of raw turns.${tok.replaced ? ` The summaries stand in for ${t(tok.replaced)} tokens of old turns${saved > 0 ? `, saving ${t(saved)}` : ""}.` : ""}</small></p>
<p class="muted">Old turns are summarised at scene boundaries, hidden, and replaced in the prompt by their summaries. Chapters fold into arcs and arcs into volumes as the story grows. The last ${v.settings.rawTail} messages stay raw, or fewer if they pass ~${Number(v.settings.rawTailTokens ?? 12000).toLocaleString()} tokens (never fewer than 6); raise the raw tail cap in Settings to keep more.</p>
<div class="row"><span class="muted grow"><small>Detail: <b>${escapeHtml(v.settings.summaryDetail ?? "detailed")}</b> · In the prompt: <b>${v.chronicle.mode === "relevant" ? "only when relevant" : v.chronicle.mode === "off" ? "off" : "the whole story"}</b> (change them in Settings)</small></span><button class="btn" data-act="chronicleRewrite" title="Redo every unlocked chapter, arc and volume at the current detail">Rewrite all</button><button class="btn primary" data-act="chronicleRun">Summarise now</button></div></div>
<div class="row chron-filter" role="group" aria-label="Show">${seg("all", "All")}${seg("volume", "Volumes", cnt.volume ?? 0)}${seg("arc", "Arcs", cnt.arc ?? 0)}${seg("chapter", "Chapters", cnt.chapter ?? 0)}</div>
<div class="list">${shown.map((u) => block(u, 0)).join("") || `<div class="empty">${all.length ? `No ${f}s yet.` : "No chapters yet. They appear once enough scenes have scrolled past the raw tail."}</div>`}</div>`;
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
${w.items.length ? `<h4>Items</h4><div class="alm-inv">${w.items.map((i) => `<div class="alm-it"><span class="alm-it__ic">${i.gone ? "✗" : "✦"}</span><div><b>${escapeHtml(i.name)}</b><span class="alm-it__h">${escapeHtml(i.gone ? "gone" : i.holder || "?")}${i.where && !i.gone ? ` · ${escapeHtml(i.where)}` : ""}</span>${i.custody.map((c) => `<small class="muted">${escapeHtml(c.from || "?")} → ${escapeHtml(c.to || "?")}${c.how ? ` (${escapeHtml(c.how)})` : ""}</small>`).join("<br>")}</div></div>`).join("")}</div>` : ""}
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
${worldPanel(v.lore.world, !!v.settings?.simulator)}
<div class="row"><button class="btn primary" data-act="loreScan">Re-read lorebooks</button>${v.lore.review?.length ? `<button class="btn" data-act="loreClassify">Classify ${v.lore.review.length} unclear entries with the model</button>` : ""}<button class="btn" data-act="mirrorSync">Sync mirror book</button></div>
<div class="list" style="margin-top:10px">${books.map(([id, b]) => `<div class="rec"><div class="hd"><b class="grow">${escapeHtml(b.name)}</b>${b.weaver ? `<span class="pill" title="${escapeHtml(WEAVER_BOOK[b.weaver]?.[1] ?? "")}">Dream Weaver · ${escapeHtml(WEAVER_BOOK[b.weaver]?.[0] ?? b.weaver)}</span>` : ""}<span class="pill">${escapeHtml(b.scope)}</span><span class="pill">${b.count} entries</span></div>
${loreKinds(b.kinds)}
<div class="row"><label class="f grow">Activation<select data-lore-mode="${escapeHtml(id)}">${["native", "assisted", "managed"].map((m) => `<option value="${m}"${m === b.mode ? " selected" : ""}>${m}</option>`).join("")}</select></label><label class="f grow">Permission<select data-lore-perm="${escapeHtml(id)}">${["read", "overlay", "write"].map((m) => `<option value="${m}"${m === b.permission ? " selected" : ""}>${m === "read" ? "read-only" : m}</option>`).join("")}</select></label></div></div>`).join("") || `<div class="empty">No lorebooks are attached to this chat.</div>`}</div>
<p class="muted"><b>Native</b>: your keywords decide; the Ledger only annotates lore the story has moved past. <b>Assisted</b>: plus the entries Recall picks. <b>Managed</b>: the Ledger is the only retrieval owner for that book.</p>
${v.lore.review?.length ? `<h4>Review queue</h4><ul class="alm-list">${v.lore.review.slice(0, 40).map((r) => `<li>${escapeHtml(r.title)} — read as <b>${escapeHtml(r.kind)}</b> (${Math.round(r.confidence * 100)}%)</li>`).join("")}</ul>` : ""}`;
  }
  tab_creator(v) {
    return this.creator.render(v);
  }
  tab_recall(v) {
    const f = v.feed?.[0];
    const via = (i) => !i.injected ? "" : i.via === "mirror" ? ` <span class="pill" title="Sent as a forced entry of the chat's mirror lorebook: the Prompt Breakdown lists it under World Info, not under ALMANAC · Recall">lorebook</span>` : i.via === "recall" ? ` <span class="pill" title="Sent inside the ALMANAC · Recall block">recall</span>` : "";
    return `<p class="muted">What Recall considered for the latest generation, with scores and reasons. Green = injected. Records the chat's mirror lorebook holds go in as its entries (the Prompt Breakdown shows them under World Info); the rest go in the ALMANAC · Recall block.</p>
${f ? `<div class="card flat"><div class="row"><span class="pill">tier: ${escapeHtml(f.tier)}</span><span class="pill">≈ ${f.tokens} tokens injected</span><span class="pill">${new Date(f.at).toLocaleTimeString()}</span></div>
${f.chronicle?.length ? `<p class="muted"><small>Story so far in this prompt: ${f.chronicle.map((c) => escapeHtml(c.name)).join(" · ")}</small></p>` : ""}
<div class="feed">${f.items.map((i) => `<div class="it${i.injected ? " in" : ""}"><span class="sc">${i.score}</span><div><b>${escapeHtml(i.name)}</b>${via(i)} <small class="muted">${escapeHtml(i.id)}</small><br><small class="muted">${escapeHtml(i.reasons.join(" · "))}</small></div></div>`).join("")}</div></div>` : `<div class="empty">No retrieval yet.</div>`}
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
<h3>Chronicle</h3><div class="card flat">${chk("chronicle", "Summarise old turns into chapters, arcs and volumes")}${chk("hideCovered", "Hide covered turns")}<label class="f">Summaries in the prompt${sel("chronicleInject", [["all", "the whole story, every turn"], ["relevant", "only when relevant"]])}</label><p class="muted"><b>The whole story</b> puts every stretch before the raw tail in each prompt, once, at its most compact level (volumes, then arcs, then chapters), and brings back a folded chapter in full when a turn touches it. <b>Only when relevant</b> sends the latest chapter, which leads into the turns the model sees, and up to three earlier chapters that share names, places or other distinctive words with the turn. It costs fewer tokens, but the model forgets what isn't picked.</p><label class="f">Raw tail (messages)${num("rawTail", 6, 400)}</label><label class="f">Raw tail cap (tokens)${num("rawTailTokens", 1000)}</label><label class="f">Chapter size (tokens)${num("chapterThresholdTokens", 1000)}</label><label class="f">Fan-in (chapters per arc, arcs per volume)${num("fanIn", 2, 12)}</label><label class="f">Summary detail${sel("summaryDetail", [["brief", "brief — the essentials (≈100–200 words a chapter)"], ["standard", "standard — facts and changes (≈150–350)"], ["detailed", "detailed — scene by scene, where things stand (≈350–650)"], ["exhaustive", "exhaustive — beats, texture, voices (≈700–1200)"]])}</label><label class="f">Always keep in summaries (optional)${txt("summaryFocus", "outfits, injuries, Buffy's lies, pet names…")}</label><p class="muted">More detail keeps more of the story in memory, at the cost of prompt tokens. New chapters use the new setting; <b>Rewrite all</b> on the Chronicle page redoes the old ones.</p><label class="f">Summariser connection id (empty = your default)${txt("summarizerConnection")}</label></div>
<h3>Knowledge</h3><div class="card flat"><label class="f">Knowledge clerk${sel("knowledgeClerk", [["auto", "when a reply's lines need it (bundled, untagged, diary-like)"], ["always", "every reply"], ["off", "off"]])}</label><p class="muted">After a reply, a quiet call rewrites its knowledge lines cleanly: one fact a line, the #keys in play, information rather than what someone noticed. It runs in the background; the next turn waits for it up to 8 seconds.</p><label class="f">Clerk connection id (empty = the summariser's)${txt("clerkConnection")}</label></div>
<h3>Recall</h3><div class="card flat"><label class="f">Injection budget (tokens)${num("recallBudget", 400, 20000)}</label><label class="f">Recall placement${sel("recallPlacement", [["before_history", "before chat history"], ["depth4", "4 messages from the end"]])}</label>${chk("keyHeat", "Demote keys that fire without being used")}<label class="f">Max keys per record${num("maxKeys", 4, 24)}</label></div>
<h3>Storage (hybrid)</h3><div class="card flat"><p class="muted">The extension's storage is the source of truth (branch-safe, rebuildable). The mirror lorebook is a readable, editable projection attached to this chat only.</p><label class="f">Mirror lorebook${sel("mirror", [["off", "off"], ["summaries", "summaries"], ["full", "full records"]])}</label>${chk("mirrorVectorize", "Vectorise mirror entries (semantic recall; needs an embedding provider)")}</div>
<h3>Lore bridge</h3><div class="card flat"><label class="f">Default activation for new books${sel("loreDefaultMode", [["native", "native"], ["assisted", "assisted"], ["managed", "managed"]])}</label><label class="f">Default permission${sel("lorePermission", [["read", "read-only"], ["overlay", "overlay"], ["write", "read + write"]])}</label></div>
<h3>World engines</h3><div class="card flat"><label class="f">Climate (default for new chats)${txt("climate", "temperate maritime")}</label><label class="f">Latitude${txt("latitude", "temperate / 51 N / southern subpolar")}</label><label class="f">Calendar${txt("calendar", "Westeros · Roshar · Harptos · Shire Reckoning · or months: Name (30), …; weekdays: …")}</label>${chk("simulator", "Off-screen simulator (one model call when story time advances)")}<label class="f">Simulator step (minutes of story time)${num("simStep", 30, 1e4)}</label><label class="f">Simulator connection id${txt("simConnection")}</label>${chk("pressures", "Hidden pressures for new characters")}${chk("chekhov", "Chekhov nudges for unused plants")}${chk("telemetry", "Craft telemetry")}</div>
<h3>Director</h3><div class="card flat"><p class="muted">Used when the preset's Director's Pass channel is set to Sidecar.</p><label class="f">Planner connection id${txt("sidecarConnection")}</label><label class="f">Planner timeout (seconds)${num("sidecarTimeout", 5, 90)}</label></div>
<p class="muted" style="margin:14px 0 0">ALMANAC Ledger ${VERSION}${v.version && v.version !== VERSION ? ` · background process ${escapeHtml(v.version)}` : ""}</p><h3>Look</h3><div class="card flat"><label class="f">Skin${sel("theme", [["preset", "follow the preset (Auto by genre)"], ...SKIN_LIST])}</label><label class="f">Light or dark${sel("skinMode", [["auto", "Auto (follow Lumiverse)"], ["light", "Light"], ["dark", "Dark"]])}</label>${chk("fonts", "Load the ALMANAC web fonts (Google Fonts)")}${chk("hud", "Floating Now widget")}${this.hudProblem === "permission" ? `<div class="row"><span class="muted grow">The floating widget needs the <b>ui_panels</b> permission.</span><button class="btn" data-act="grantPanels">Grant</button></div>` : this.hudProblem ? `<p class="muted">The floating widget could not open: ${escapeHtml(this.hudProblem)}</p>` : ""}${chk("narratorOnlyToTools", "Let LLM tools see narrator-only records")}</div>`;
  }
  onClick(ev) {
    const t = ev.target;
    const hist = t.closest("summary")?.parentElement;
    if (hist?.dataset.fact) {
      if (hist.open)
        this.openFacts.delete(hist.dataset.fact);
      else
        this.openFacts.add(hist.dataset.fact);
    }
    const pageBtn = t.closest("[data-page]");
    if (pageBtn) {
      this.go(pageBtn.dataset.page);
      return;
    }
    const planet = t.closest("[data-orbit]");
    if (planet) {
      this.orbit = this.orbit === planet.dataset.orbit ? "" : planet.dataset.orbit;
      this.render();
      this.root.querySelector(".almo-moonb")?.focus();
      return;
    }
    if (this.orbit && !t.closest(".almo-orbit")) {
      this.orbit = "";
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
      case "chronFilter":
        this.chronFilter = id || "all";
        this.render();
        break;
      case "factKind":
        this.factKind = id || "play";
        this.render();
        break;
      case "clerkTidy":
        this.clerkProgress = "";
        this.send({ type: "clerkTidy" });
        if (this.view)
          this.view.clerk = { ...this.view.clerk, running: true };
        this.render();
        break;
      case "clerkStop":
        this.send({ type: "clerkStop" });
        this.clerkProgress = "stopping…";
        this.render();
        break;
      case "chronToggle":
        if (!id)
          break;
        if (this.chronOpen.has(id))
          this.chronOpen.delete(id);
        else
          this.chronOpen.add(id);
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
      case "factEdit":
        this.editingFact = id ?? null;
        this.render();
        break;
      case "factAdd":
        this.editingFact = "__new";
        this.render();
        break;
      case "charAdd":
        this.editingChar = "__new";
        this.render();
        break;
      case "charEdit":
        this.editingChar = this.editingChar === id ? null : id ?? null;
        this.render();
        break;
      case "charCancel":
        this.editingChar = null;
        this.render();
        break;
      case "charSave": {
        if (!id)
          break;
        const val = (sel) => this.root.querySelector(sel)?.value?.trim();
        const name = val("#almCharName");
        const age = val("#almCharAge") ?? "";
        const appearance = val("#almCharLook") ?? "";
        const edits = { ...this.view?.config?.castEdits ?? {} };
        const cast = this.view?.cast ?? [];
        if (id === "__new") {
          if (!name)
            break;
          const low = name.toLowerCase();
          const taken = cast.find((c) => c.name.toLowerCase() === low || c.aliases?.some((a) => a.toLowerCase() === low));
          if (taken) {
            window.alert(`${taken.name} is already in the cast.`);
            break;
          }
          let key = low.normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "person";
          while (cast.some((c) => c.id === key) || edits[key])
            key += "_";
          edits[key] = { name, ...age ? { age } : {}, ...appearance ? { appearance } : {}, added: Math.max(0, (this.view?.counts?.messages ?? 1) - 1) };
        } else {
          const c = cast.find((x) => x.id === id);
          const next = { ...edits[id] ?? {} };
          if (name && !c?.isUser && name !== c?.name)
            next.name = name;
          next.age = age;
          next.appearance = appearance;
          edits[id] = next;
        }
        this.editingChar = null;
        this.send({ type: "config", patch: { castEdits: edits } });
        break;
      }
      case "factCancel":
        this.editingFact = null;
        this.render();
        break;
      case "factSave": {
        if (!id)
          break;
        const val = (sel) => this.root.querySelector(sel)?.value?.trim() ?? "";
        const f = this.view?.knowledge.find((x) => x.key === id);
        const edits = { ...this.view?.config?.factEdits ?? {} };
        let key = id;
        if (id === "__new") {
          const words = val("#almFactStmt");
          if (!words)
            break;
          const taken = new Set([...(this.view?.knowledge ?? []).map((x) => x.key), ...(this.view?.hiddenFacts ?? []).map((x) => x.key), ...Object.keys(edits)]);
          const base = words.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter((w) => w.length > 2 && !/^(the|and|that|was|his|her|their|with|from|has|have|who|for)$/.test(w)).slice(0, 3).join("-") || "fact";
          key = base;
          for (let i = 2;taken.has(key); i++)
            key = `${base}-${i}`;
          edits[key] = { added: Math.max(0, (this.view?.counts?.messages ?? 1) - 1) };
        }
        const next = { ...edits[key] ?? {} };
        const stmt = val("#almFactStmt");
        if (stmt && stmt !== f?.statement)
          next.statement = stmt;
        const truth = val("#almFactTruth");
        if (truth)
          next.truth = truth;
        else
          delete next.truth;
        const into = val("#almFactInto");
        if (into)
          next.into = into;
        const people = {};
        this.root.querySelectorAll("select[data-person]").forEach((sel) => {
          if (sel.value)
            people[sel.dataset.person] = sel.value;
        });
        if (Object.keys(people).length)
          next.people = people;
        else
          delete next.people;
        if (id === "__new")
          next.statement = stmt;
        edits[key] = next;
        this.editingFact = null;
        this.send({ type: "config", patch: { factEdits: edits } });
        break;
      }
      case "factDelete": {
        const b = t.closest("button");
        if (b && b.dataset.armed !== "1") {
          b.dataset.armed = "1";
          b.textContent = "Click again to delete";
          setTimeout(() => {
            if (b.isConnected) {
              b.dataset.armed = "";
              b.textContent = "delete";
            }
          }, 4000);
          break;
        }
      }
      case "factHide":
      case "factRestore": {
        if (!id)
          break;
        const edits = { ...this.view?.config?.factEdits ?? {} };
        const next = { ...edits[id] ?? {} };
        if (act.act !== "factRestore")
          next.hidden = true;
        else
          delete next.hidden;
        edits[id] = next;
        this.editingFact = null;
        this.send({ type: "config", patch: { factEdits: edits } });
        break;
      }
      case "notPerson": {
        const b = t.closest("button");
        if (b && b.dataset.armed !== "1") {
          b.dataset.armed = "1";
          b.textContent = "Click again to remove";
          setTimeout(() => {
            if (b.isConnected) {
              b.dataset.armed = "";
              b.textContent = "Not a person — remove";
            }
          }, 4000);
          break;
        }
        const c = this.view?.cast.find((x) => x.name === act.name);
        const merges = { ...this.view?.config?.merges ?? {} };
        for (const n of [act.name, ...c?.aliases ?? []])
          if (n)
            merges[String(n).toLowerCase()] = NOT_A_PERSON;
        this.send({ type: "config", patch: { merges } });
        break;
      }
      case "restorePerson": {
        const merges = { ...this.view?.config?.merges ?? {} };
        delete merges[String(act.name ?? "").toLowerCase()];
        this.send({ type: "config", patch: { merges } });
        break;
      }
      case "unmerge": {
        const merges = { ...this.view?.config?.merges ?? {} };
        delete merges[String(act.name ?? "").toLowerCase()];
        this.send({ type: "config", patch: { merges } });
        break;
      }
      case "chronicleRewrite": {
        const b = t.closest("button");
        if (b && b.dataset.armed !== "1") {
          b.dataset.armed = "1";
          b.textContent = "Click again to rewrite";
          setTimeout(() => {
            if (b.isConnected) {
              b.dataset.armed = "";
              b.textContent = "Rewrite all";
            }
          }, 4000);
          break;
        }
        this.send({ type: "chronicle", action: "rewriteAll" });
        break;
      }
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
    if (d.merge != null && t.value) {
      const c = this.view?.cast.find((x) => x.name === d.merge);
      const merges = { ...this.view?.config?.merges ?? {} };
      for (const n of [d.merge, ...c?.aliases ?? []])
        merges[String(n).toLowerCase()] = t.value;
      this.send({ type: "config", patch: { merges } });
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
  --alm-on-voice:#fff; --alm-on-accent:#fff;
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
.alm-say__tone{font-style:italic!important;font-weight:500!important;font-size:12px!important;line-height:1!important;font-family:var(--alm-font-body)!important;letter-spacing:.02em!important;text-transform:none!important;padding-left:7px!important;border-left:1px solid color-mix(in oklab,var(--alm-on-voice) 45%,transparent)!important;opacity:1!important}
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
.alm-folio__hd{padding:10px 14px!important;background:linear-gradient(90deg,var(--alm-accent),color-mix(in oklab,var(--alm-accent) 60%,var(--alm-accent-2)))!important;color:var(--alm-on-accent)!important;font:600 12px/1.2 var(--alm-font-mono)!important;letter-spacing:.16em;text-transform:uppercase}
.alm-folio__bd{padding:12px 16px!important}

/* ── Drawers (unspoken, director's notes, ledger) ── */
details.alm-drawer{margin:16px 0 0!important;background:var(--alm-panel)!important;border:1px solid var(--alm-line)!important;border-radius:var(--alm-r-sm)!important;overflow:hidden!important;color:var(--alm-ink)!important;font-family:var(--alm-font-body)}
details.alm-drawer>summary{list-style:none!important;cursor:pointer;display:flex!important;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px!important;font:500 12.5px/1.2 var(--alm-font-mono)!important;color:var(--alm-muted)!important;background:var(--alm-panel-2)!important}
details.alm-drawer>summary::-webkit-details-marker{display:none}
details.alm-drawer[open]>summary{border-bottom:1px solid var(--alm-line)}
.alm-drawer__body{padding:14px!important;background-image:var(--alm-texture)}
.alm-pill{display:inline-flex!important;align-items:center;gap:6px;padding:6px 10px!important;border-radius:999px!important;background:var(--alm-panel)!important;border:1px solid var(--alm-line)!important;color:var(--alm-ink)!important}
.alm-pill small{color:var(--alm-muted)}
.alm-pill--warn{color:var(--alm-warn)!important;border-color:color-mix(in oklab,var(--alm-warn) 45%,var(--alm-line))!important}
.alm-stack{display:inline-flex}
.alm-stack .alm-mini{margin-left:-5px;box-shadow:0 0 0 2px var(--alm-panel)}
.alm-stack .alm-mini:first-child{margin-left:0}
.alm-caret{margin-left:auto;display:inline-flex!important;align-items:center;gap:8px;padding:6px 11px!important;border-radius:999px!important;background:var(--alm-accent)!important;color:var(--alm-on-accent)!important;font-weight:500}
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
/* The preset writes "break the seal" into the hint for standalone mode; here the text comes from ::after (so it can say "reseal"). */
.alm-env__hint{display:block!important;margin-top:6px;font-style:italic!important;font-size:0!important;line-height:1!important;font-family:var(--alm-font-body)!important;color:var(--c)!important}
.alm-env__hint::after{content:"break the seal";font-size:12px}
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
.alm-cc__em{margin-top:2px;font-style:italic;font-size:14px;line-height:1.3;font-family:var(--alm-font-body);color:var(--c)}
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
.alm-cc__row b{flex:none;min-width:44px;font:500 9.5px/1.9 var(--alm-font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--alm-muted)}
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
.alm-km-wrap{overflow-x:auto!important;max-width:100%!important;margin:0!important;-webkit-overflow-scrolling:touch}
.alm-km{display:grid!important;gap:6px!important;width:100%;font-size:13.5px!important;text-align:left!important}
.alm-km--1{--alm-km-cols:minmax(10em,1.6fr) minmax(8em,1fr);min-width:calc(10em + 1 * (7.5em + 10px) + 20px)}
.alm-km--2{--alm-km-cols:minmax(10em,1.5fr) repeat(2,minmax(7.5em,1fr));min-width:calc(10em + 2 * (7.5em + 10px) + 20px)}
.alm-km--3{--alm-km-cols:minmax(10em,1.4fr) repeat(3,minmax(7.5em,1fr));min-width:calc(10em + 3 * (7.5em + 10px) + 20px)}
.alm-km--4{--alm-km-cols:minmax(10em,1.3fr) repeat(4,minmax(7.5em,1fr));min-width:calc(10em + 4 * (7.5em + 10px) + 20px)}
.alm-km--5{--alm-km-cols:minmax(10em,1.2fr) repeat(5,minmax(7.5em,1fr));min-width:calc(10em + 5 * (7.5em + 10px) + 20px)}
.alm-km__r{display:grid!important;grid-template-columns:var(--alm-km-cols);align-items:center;gap:0 10px;padding:8px 10px!important;border-radius:10px;background:var(--alm-panel-2)!important;border:0!important}
.alm-km__h{background:none!important;padding:0 10px!important;font:500 10px/1.2 var(--alm-font-mono)!important;letter-spacing:.1em;text-transform:uppercase;color:var(--alm-muted)!important}
.alm-km__f{font-weight:600;line-height:1.35;overflow-wrap:break-word;text-align:left!important;hyphens:auto;min-width:0}
.alm-km__c{min-width:0;align-self:start;text-align:left!important}
.alm-kp{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font:500 11px/1.2 var(--alm-font-mono);white-space:nowrap;max-width:100%}
.alm-kp.knows{color:var(--alm-good);background:color-mix(in oklab,var(--alm-good) 13%,var(--alm-panel))}
.alm-kp.sus{color:var(--alm-warn);background:color-mix(in oklab,var(--alm-warn) 14%,var(--alm-panel))}
.alm-kp.wrong{color:var(--alm-danger);background:color-mix(in oklab,var(--alm-danger) 13%,var(--alm-panel));box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--alm-danger) 40%,transparent)}
.alm-kp.un{color:var(--alm-muted);border:1px dashed var(--alm-line)}
.alm-kp.none{color:var(--alm-muted);opacity:.5;padding:4px 6px}
.alm-kp__n{display:block;margin-top:4px;font-size:11px;line-height:1.35;color:var(--alm-muted);white-space:normal;overflow-wrap:break-word;max-width:22em}
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
.alm-btn--primary{color:var(--alm-on-accent)!important;background:linear-gradient(color-mix(in oklab,var(--alm-accent) 85%,#fff),var(--alm-accent))!important;border-color:color-mix(in oklab,var(--alm-accent) 70%,#000)!important;box-shadow:0 3px 0 color-mix(in oklab,var(--alm-accent) 60%,#000),0 8px 14px -10px rgba(0,0,0,.45)!important}
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
  .alm-km{min-width:0;gap:8px!important}
  .alm-km__h{display:none!important}
  .alm-km__r{grid-template-columns:1fr!important;gap:4px!important;padding:10px 12px!important;border-radius:12px}
  .alm-km__f{margin-bottom:2px}
  .alm-km__c{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px 10px}
  .alm-km__c .alm-kp__n{flex-basis:100%;max-width:none;margin-top:0}
  .alm-km__c[data-who]::before{content:attr(data-who);font:500 10.5px/1 var(--alm-font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--alm-muted)}
}
`;
var PANEL_CSS = `
.almp{--c:var(--alm-accent);color:var(--alm-ink);font-family:var(--alm-font-body);font-size:14px;line-height:1.5;padding:0}
.almp *{box-sizing:border-box}
.almp h3{margin:14px 0 8px;font:600 17px/1.2 var(--alm-font-display)}
.almp h4{margin:12px 0 6px;font:500 10.5px/1 var(--alm-font-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--alm-muted)}
.almp .muted{color:var(--alm-muted)}
.almp .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.almp .grow{flex:1;min-width:0}
.almp .card{background:var(--alm-panel);border:1px solid var(--alm-line);border-radius:var(--alm-r-sm);padding:12px;margin:0 0 10px;box-shadow:var(--alm-lift)}
.almp .card.flat{box-shadow:none}
.almp .hero{position:relative;overflow:hidden;border-radius:var(--alm-radius);padding:16px;color:#fff;min-height:120px;background:linear-gradient(180deg,#27295a,#6d4a7d 50%,#e0866b);box-shadow:var(--alm-shadow)}
.almp .hero .t{font:700 22px/1.1 var(--alm-font-display);margin-top:8px;text-shadow:0 2px 14px rgba(0,0,0,.5)}
.almp .hero .gl{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);font:500 11.5px/1 var(--alm-font-mono);margin:6px 6px 0 0}
.almp .btn{all:unset;display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:7px 11px;border-radius:10px;font:500 12px/1 var(--alm-font-mono);background:linear-gradient(var(--alm-panel),var(--alm-panel-2));border:1px solid var(--alm-line);box-shadow:0 2px 0 var(--alm-line)}
.almp .btn:active{transform:translateY(1px);box-shadow:none}
.almp .btn.primary{background:var(--alm-accent);color:var(--alm-on-accent);border-color:color-mix(in oklab,var(--alm-accent) 70%,#000)}
.almp .btn.danger{color:var(--alm-danger)}
.almp .btn[disabled]{opacity:.5;pointer-events:none}
.almp input[type=text],.almp input[type=number],.almp textarea,.almp select{width:100%;padding:7px 9px;border-radius:9px;border:1px solid var(--alm-line);background:var(--alm-panel-2);color:var(--alm-ink);font:inherit}
.almp textarea{min-height:70px;resize:vertical}
.almp label.f{display:grid;gap:4px;margin:0 0 10px;font:500 11px/1.3 var(--alm-font-mono);color:var(--alm-muted)}
.almp label.chk{display:flex;gap:8px;align-items:center;margin:6px 0}
.almp .pill{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:var(--alm-panel-2);border:1px solid var(--alm-line);font:500 11px/1.2 var(--alm-font-mono);color:var(--alm-muted);margin:2px}
.almp .pill.on{color:var(--alm-on-accent);background:var(--alm-accent);border-color:transparent}
.almp .kv{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;font-size:13px}
.almp .kv b{font:500 10.5px/1.7 var(--alm-font-mono);color:var(--alm-muted);text-transform:uppercase;letter-spacing:.08em}
.almp .list{display:grid;gap:8px}
.almp .rec{padding:10px;border-radius:10px;background:var(--alm-panel-2);border:1px solid var(--alm-line)}
.almp .rec .hd{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center}
.almp .rec .hd b.grow{flex:1 1 12em;overflow-wrap:anywhere}
.almp .rec .hd .pill{white-space:nowrap}
.almp .rec .hd b{font:600 14px/1.2 var(--alm-font-display)}
.almp .kind{font:500 9.5px/1 var(--alm-font-mono);letter-spacing:.1em;text-transform:uppercase;padding:3px 6px;border-radius:5px;background:color-mix(in oklab,var(--alm-accent) 14%,var(--alm-panel));color:var(--alm-accent)}
.almp .bar{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--alm-panel-2)}
.almp .bar i{display:block;height:100%}
/* chronicle: volumes › arcs › chapters */
.almp .chron-legend{display:grid;gap:4px;margin-top:8px;font:500 11px/1.3 var(--alm-font-mono)}
.almp .chron-lg{display:grid;grid-template-columns:10px minmax(0,1fr) auto auto 2ch;gap:10px;align-items:center;font-variant-numeric:tabular-nums}
.almp .chron-lg i{width:10px;height:10px;border-radius:3px}
.almp .chron-lg span:last-child{text-align:right}
.almp .chron-filter{margin:12px 0 8px}
.almp button.pill{cursor:pointer;min-height:28px}
.almp button.pill b{font-weight:600;margin-left:2px}
.almp .rec.chron{border-left:4px solid var(--lv);min-width:0}
.almp .chron-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.almp .chron>.hd{flex-wrap:wrap}
.almp .chron>.hd b{min-width:0;overflow-wrap:anywhere}
.almp .chron .kind{background:color-mix(in oklab,var(--lv) 16%,var(--alm-panel));color:var(--lv)}
.almp .chron--volume{background:color-mix(in oklab,var(--lv) 7%,var(--alm-panel-2));padding:12px}
.almp .chron--volume>.hd b{font-size:16px}
.almp .chron--arc>.hd b{font-size:15px}
.almp .chron .pill.tok{font-variant-numeric:tabular-nums}
.almp .chron .pill.on-prompt{color:var(--alm-good);border-color:color-mix(in oklab,var(--alm-good) 40%,var(--alm-line))}
.almp .rec.chron.chron--folded{background:color-mix(in oklab,var(--alm-muted) 9%,var(--alm-panel-2));border-left-color:color-mix(in oklab,var(--lv) 30%,var(--alm-line));border-style:dashed}
.almp .chron--folded>.hd,.almp .chron--folded>.muted,.almp .chron--folded>.chron-tags,.almp .chron--folded>details>summary{opacity:.62;filter:grayscale(.75)}
.almp .chron-kids-t{all:unset;cursor:pointer;display:inline-flex;gap:6px;align-items:center;margin-top:8px;padding:4px 0;font:500 11px/1 var(--alm-font-mono);color:var(--lv)}
.almp .chron-kids-t:focus-visible{outline:2px solid var(--lv);outline-offset:2px}
.almp .chron-kids{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin:8px 0 0 4px;padding-left:12px;border-left:2px dashed color-mix(in oklab,var(--lv) 40%,var(--alm-line))}
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
.alm-hudw{box-sizing:border-box;width:max-content;max-width:440px;height:40px;display:flex;align-items:center;gap:9px;padding:0 12px 0 7px;border-radius:999px;background:linear-gradient(90deg,#1c2146,#3a3060 60%,#6a4a6a);color:#fff;font:500 12px/1 var(--alm-font-mono);box-shadow:0 10px 26px -12px rgba(0,0,0,.7),inset 0 0 0 1px rgba(255,255,255,.12);cursor:pointer;white-space:nowrap;user-select:none;transition:transform .15s,box-shadow .15s}
.alm-hudw:hover{transform:translateY(-1px);box-shadow:0 14px 30px -12px rgba(0,0,0,.8),inset 0 0 0 1px rgba(255,255,255,.22)}
.alm-hudw:focus-visible{outline:2px solid #ffc46b;outline-offset:2px}
.alm-hudw>*{flex:none}
.alm-hudw b{font-weight:600;letter-spacing:.02em}
.alm-hudw__orb{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(255,255,255,.3),0 0 10px rgba(255,255,255,.15)}
.alm-hudw__orb i{width:10px;height:10px;border-radius:50%}
.alm-hudw__orb i.moon{background:#f7efd9;box-shadow:inset -3px 0 0 rgba(20,24,60,.75),0 0 7px rgba(247,239,217,.55)}
.alm-hudw__orb i.sun{background:#ffd36b;box-shadow:0 0 8px #ffc46b}
.alm-hudw__pl{display:inline-flex;align-items:center;gap:4px;flex:0 1 auto!important;min-width:0;max-width:150px;overflow:hidden;text-overflow:ellipsis}
.alm-hudw__pl svg{flex:none;opacity:.8}
.alm-hudw .alm-stack{display:inline-flex;padding-left:5px}
.alm-hudw .alm-mini{box-shadow:0 0 0 2px #3f3264!important}
.alm-hudw__dim{opacity:.72;font-style:italic}
.alm-hudc{box-sizing:border-box;width:300px;border-radius:18px;overflow:hidden;background:var(--alm-panel);color:var(--alm-ink);font-family:var(--alm-font-body);font-size:13px;line-height:1.45;box-shadow:0 24px 50px -18px rgba(0,0,0,.75),0 0 0 1px var(--alm-line)}
.alm-hudc button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer}
.alm-hudc__sky{position:relative;padding:12px 12px 11px;color:#fff;cursor:grab}
.alm-hudc__row{display:flex;align-items:flex-end;gap:10px}
.alm-hudc__clock{font:800 30px/.9 "Syne",var(--alm-font-display);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.alm-hudc__date{font:500 10.5px/1.3 var(--alm-font-mono);opacity:.85;min-width:0}
.alm-hudc__x{margin-left:auto!important;align-self:flex-start;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14)!important;color:#fff!important;font-size:12px!important}
.alm-hudc__x:hover{background:rgba(255,255,255,.26)!important}
.alm-hudc__title{margin-top:7px;font-weight:700;font-size:15px;font-family:var(--alm-font-display)}
.alm-hudc__chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.alm-hudc__chips span{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.16);font-size:11px}
.alm-hudc__bd{padding:4px 12px 12px}
.alm-hudc h5{margin:10px 0 6px;font:500 9.5px/1 var(--alm-font-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--alm-muted)}
.alm-hudc ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.alm-hudc__who li{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;align-items:start}
.alm-hudc__who b{font-weight:600}
.alm-hudc__mood{color:var(--alm-muted);font-size:12px}
.alm-hudc__who small{display:block;color:var(--alm-muted);font-size:11.5px;overflow-wrap:anywhere}
.alm-hudc__owed li{padding-left:12px;position:relative;font-size:12.5px}
.alm-hudc__owed li::before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:var(--alm-accent)}
.alm-hudc__owed li.due::before{background:var(--alm-warn)}
.alm-hudc__owed small{color:var(--alm-muted)}
.alm-hudc__muted{margin:0;color:var(--alm-muted);font-size:12px}
.alm-hudc__go{display:block;width:100%;margin-top:12px!important;padding:9px 12px!important;border-radius:12px;text-align:center;background:var(--alm-accent)!important;color:var(--alm-on-accent)!important;font-weight:600!important;font-size:12.5px!important}
.alm-hudc__go:hover{filter:brightness(1.08)}
.alm-hudw__err{display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#ffc46b;color:#2a1d00;font-weight:700;font-size:12px}
.alm-hudc__err{margin:0 0 10px;padding:8px 10px;border-radius:10px;font-size:12px;line-height:1.4;border:1px solid color-mix(in oklab,var(--alm-warn) 55%,var(--alm-line));background:color-mix(in oklab,var(--alm-warn) 12%,transparent);overflow-wrap:anywhere}
.alm-sz{font-size:14px}
.alm-sz .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}
@media (max-width:560px){.alm-sz .grid{grid-template-columns:1fr}}
.almk{display:grid;gap:8px}
.almk-q{display:flex;gap:8px;align-items:flex-start;font-weight:600;line-height:1.35;overflow-wrap:anywhere}
.almk-h{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;align-items:start}
.almk-h__b{min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}
.almk-h__b .alm-kp__n{flex-basis:100%;margin-top:0;max-width:none}
.almk-un{font-size:11.5px;color:var(--alm-muted)}
.almk-key{flex:none;font:500 10.5px/1.6 var(--alm-font-mono);padding:1px 7px;border-radius:6px;background:color-mix(in oklab,var(--alm-accent) 12%,var(--alm-panel));color:var(--alm-accent)}
.almk-q b{font-weight:650;font-size:15px;line-height:1.3;min-width:0}
.almk-q .btn{flex:none;padding:4px 9px}
.almk-st{display:grid;gap:6px}
.almk-ver{font-style:italic;color:var(--alm-danger)}
.almk-hist>summary{cursor:pointer;font:500 11px/1.4 var(--alm-font-mono);color:var(--alm-muted);letter-spacing:.04em}
.almk-hist ol{margin:8px 0 0;padding:0 0 0 14px;border-left:2px solid var(--alm-line);list-style:none;display:grid;gap:7px}
.almk-hist li{position:relative;font-size:13px;line-height:1.4}
.almk-hist li::before{content:"";position:absolute;left:-19px;top:6px;width:8px;height:8px;border-radius:50%;background:var(--alm-accent);box-shadow:0 0 0 2px var(--alm-panel)}
.almk-hist time{display:block;font:500 10.5px/1.3 var(--alm-font-mono);color:var(--alm-muted)}
.almk-note{display:block;color:var(--alm-muted);font-size:11.5px;margin-top:2px}
.almk--edit{border-color:var(--alm-accent)}
.almk-top{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-width:0}
.almk-top .almk-key{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.almk-top .btn{flex:none;padding:4px 9px}
.almk-stmt{display:block;font-weight:650;font-size:15px;line-height:1.35;overflow-wrap:anywhere}
.almk-kind{font:500 10px/1.5 var(--alm-font-mono);text-transform:uppercase;letter-spacing:.06em}
.almk--secret{box-shadow:inset 3px 0 0 var(--alm-danger)}
.almk--belief{box-shadow:inset 3px 0 0 var(--alm-warn)}
.almk--noted{opacity:.85}
.almk-filters{flex-wrap:wrap;gap:6px;margin-bottom:8px}
.almk-filters select{max-width:48%}
.almk-clerk{margin-bottom:10px;font-size:13px}
.almk-clerk .row{flex-wrap:wrap;gap:8px;align-items:center}
.almk-person{margin-bottom:10px}
.almk-person h4{margin:0 0 6px}
.almk-person summary{cursor:pointer;font:500 11.5px/1.6 var(--alm-font-mono);color:var(--alm-muted)}
.almk-person ul{margin:6px 0 8px;padding-left:18px;display:grid;gap:4px;font-size:13px;line-height:1.4}
.almp .alm-warnbox{border-color:color-mix(in oklab,var(--alm-warn) 55%,var(--alm-line));background:color-mix(in oklab,var(--alm-warn) 10%,var(--alm-panel))}
/* ── Orrery navigation ── */
.almo{position:relative;display:flex;flex-direction:column;min-height:100%;background:color-mix(in oklab,var(--alm-panel-2) 55%,var(--alm-panel));background-image:var(--alm-texture);--almo-font:"Syne",var(--alm-font-display)}
.almo-ic{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
.almo button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer}
.almo button:focus-visible{outline:2px solid var(--alm-accent);outline-offset:2px}
.almo-sky{flex:none;position:relative;overflow:hidden;padding:14px 14px 12px;color:#fff;isolation:isolate}
.almo-sky::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none}
.almo-sky.almo-night::before{background:radial-gradient(1px 1px at 12% 22%,#fff,transparent),radial-gradient(1px 1px at 78% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 60% 12%,#fff,transparent),radial-gradient(1px 1px at 34% 44%,#fffc,transparent),radial-gradient(1px 1px at 90% 58%,#fffa,transparent)}
.almo-sky.almo-rain::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:repeating-linear-gradient(105deg,transparent 0 11px,rgba(210,222,255,.2) 11px 12px,transparent 12px 26px)}
.almo-sky.almo-snow::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(1.5px 1.5px at 20% 30%,#fff,transparent),radial-gradient(2px 2px at 70% 60%,#fff,transparent),radial-gradient(1.5px 1.5px at 45% 80%,#fff,transparent);background-size:60px 60px}
.almo-sky__row{display:flex;align-items:flex-end;gap:12px}
.almo-clock{font:800 38px/.9 var(--almo-font);letter-spacing:-.02em;font-variant-numeric:tabular-nums;text-shadow:0 2px 16px rgba(0,0,0,.35)}
.almo-date{font:500 11px/1.35 var(--alm-font-mono);color:rgba(255,255,255,.82);min-width:0}
.almo-moon{--sh:0px;margin-left:auto;flex:none;width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 60% 40%,#f7efd9 0 45%,#bdb4a2 75%);box-shadow:inset var(--sh) 0 0 0 rgba(12,16,44,.88),0 0 22px rgba(247,239,217,.3)}
.almo-title{margin-top:8px;font:700 18px/1.15 var(--alm-font-display);text-shadow:0 2px 12px rgba(0,0,0,.4)}
.almo-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
.almo-chips span{padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);font-weight:500;font-size:11px;line-height:1.25;max-width:100%;overflow-wrap:anywhere}
.almo-seg{display:flex;gap:4px;margin-top:12px;padding:4px;border-radius:14px;background:rgba(6,9,26,.42);border:1px solid rgba(255,255,255,.1);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.almo-seg button{flex:1;min-width:0;display:flex;justify-content:center;align-items:center;gap:6px;padding:8px 4px;border-radius:10px;font-weight:600;font-size:12px;line-height:1;color:rgba(255,255,255,.66)}
.almo-seg button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.almo-seg .almo-ic{width:15px;height:15px}
.almo-seg button:hover{color:#fff}
.almo-seg button[aria-selected="true"]{background:rgba(255,255,255,.15);color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),inset 0 -2px 0 var(--pc)}
.almo-body{flex:1 0 auto;padding:6px 12px 12px;min-width:0}
.almo-head{margin:8px 0 10px}
.almo-head h3{margin:3px 0 1px!important;font:800 22px/1.1 var(--almo-font)!important;letter-spacing:-.01em}
.almo-head small{color:var(--alm-muted);font-size:12px}
.almo-eyebrow{font:700 10px/1 var(--alm-font-mono);letter-spacing:.2em;text-transform:uppercase}
.almo-facts{margin-top:10px}
.almo-facts .kv{grid-template-columns:70px 1fr}
.almo-dockwrap{flex:none;position:sticky;bottom:10px;z-index:8;display:flex;justify-content:center;padding:14px 8px 0;pointer-events:none}
.almo-dockwrap>*{pointer-events:auto}
.almo-dock{display:flex;align-items:flex-end;gap:2px;padding:6px 8px;border-radius:26px;max-width:100%;
  background:color-mix(in oklab,var(--alm-panel) 80%,transparent);border:1px solid var(--alm-line);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 18px 40px -14px rgba(0,0,0,.65)}
.almo-pl{flex:1 1 60px;min-width:44px;max-width:64px;display:grid;justify-items:center;gap:4px;padding:6px 0 4px;border-radius:18px;color:var(--alm-muted);font-weight:600!important;font-size:10px!important;line-height:1.1!important;white-space:nowrap}
.almo-pl>span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis}
.almo-pl:hover,.almo-pl.on{color:var(--alm-ink)}
.almo-orb{position:relative;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:#10132e;
  background:radial-gradient(circle at 35% 30%,color-mix(in oklab,var(--pc) 65%,#fff),var(--pc) 60%,color-mix(in oklab,var(--pc) 62%,#000));transition:box-shadow .2s,transform .2s}
.almo-orb .almo-ic{width:16px;height:16px;stroke-width:1.9}
.almo-pl:hover .almo-orb{transform:translateY(-2px)}
.almo-pl.on .almo-orb{box-shadow:0 0 0 3px var(--alm-panel),0 0 0 5px var(--pc),0 0 16px var(--pc)}
.almo-pl.alert .almo-orb{box-shadow:0 0 14px 1px var(--pc)}
.almo-orb b{position:absolute;top:-5px;right:-7px;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:var(--alm-danger);color:#fff;font-weight:700;font-size:9.5px;line-height:16px;box-shadow:0 0 0 2px var(--alm-panel)}
.almo-sun{flex:none;width:56px;height:56px;margin:0 4px 2px!important;border-radius:50%;display:grid;place-items:center;color:#3a1c00!important;transform:translateY(-12px);
  background:radial-gradient(circle at 38% 32%,#fff3c4,#ffc46b 45%,#f08a3c)!important;box-shadow:0 0 0 4px var(--alm-panel),0 0 24px rgba(255,196,107,.55);transition:box-shadow .2s}
.almo-sun span{display:grid;justify-items:center}
.almo-sun small{font:800 8.5px/1 var(--almo-font);letter-spacing:.12em;margin-top:1px}
.almo-sun.on{box-shadow:0 0 0 4px var(--alm-panel),0 0 0 6px #ffc46b,0 0 32px rgba(255,196,107,.85)}
.almo.orbiting .almo-body,.almo.orbiting .almo-sky{filter:blur(2px) brightness(.55);transition:filter .2s}
.almo-orbit{position:absolute;left:50%;bottom:88px;transform:translateX(-50%);width:280px;height:132px}
.almo-orbit::before{content:"";position:absolute;left:8px;right:8px;top:22px;height:240px;border-radius:50%;border:1px dashed color-mix(in oklab,var(--pc) 45%,transparent);pointer-events:none}
.almo-orbit__t{position:absolute;left:0;right:0;bottom:4px;text-align:center;font:700 10px/1 var(--alm-font-mono);letter-spacing:.2em;text-transform:uppercase;color:var(--pc);pointer-events:none}
.almo-moonb{position:absolute;width:88px;display:grid;justify-items:center;gap:4px;text-align:center;animation:almo-rise .22s ease-out both}
.almo-m{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--alm-panel);border:1.5px solid var(--pc);color:var(--pc);box-shadow:0 0 18px -4px var(--pc);transition:background .15s,color .15s}
.almo-moonb:hover .almo-m,.almo-moonb:focus-visible .almo-m{background:var(--pc);color:#10132e}
.almo-moonb b{font-weight:700;font-size:12px;line-height:1.1;color:var(--alm-ink);text-shadow:0 1px 6px var(--alm-panel)}
.almo-moonb small{font:500 9.5px/1.2 var(--alm-font-mono);color:var(--alm-muted)}
@keyframes almo-rise{from{opacity:0;transform:translateY(14px) scale(.9)}}
.almo-empty{flex:1 0 auto;display:grid;justify-items:center;align-content:center;text-align:center;gap:6px;padding:40px 24px}
.almo-empty h4{margin:14px 0 0;font:800 19px/1.2 var(--almo-font);color:var(--alm-ink)}
.almo-empty p{margin:0 0 8px;color:var(--alm-muted);max-width:30ch}
.almo-dial{position:relative;width:110px;height:110px;border-radius:50%;border:1px dashed var(--alm-line);display:grid;place-items:center}
.almo-dial::before{content:"";width:14px;height:14px;border-radius:50%;background:#ffc46b;box-shadow:0 0 22px #ffc46b}
.almo-dial::after{content:"";position:absolute;top:-5px;left:50%;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:#5fcfc0;box-shadow:0 0 12px #5fcfc0;transform-origin:5px 60px}
.almo-dial.spin::after{animation:almo-orbit 3s linear infinite}
@keyframes almo-orbit{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.almo-moonb,.almo-dial.spin::after{animation:none}.almo.orbiting .almo-body,.almo.orbiting .almo-sky{transition:none}}
`;

// src/core/engines/calendars.ts
var m = (name, days) => ({ name, days });
var fest = (name, weekless = false) => ({ name, days: 1, festival: true, ...weekless ? { weekless } : {} });
var ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth"];
var MOON_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var VORIN = ["Jes", "Nan", "Chach", "Vev", "Palah", "Shash", "Betab", "Kak", "Tanat", "Ishi"];
var CALENDAR_PRESETS = [
  {
    id: "westeros",
    label: "Westeros (A Song of Ice and Fire)",
    name: "Westeros",
    start: "Day 1 · 14th day of the Fifth Moon, 299 AC · 18:40",
    match: /\bwesteros|song of ice and fire|\basoiaf\b|game of thrones|after (the )?conquest|\bseven kingdoms\b/i,
    build: () => ({
      months: ORDINALS.map((o, i) => m(`${o} Moon`, MOON_DAYS[i])),
      weekdays: [],
      yearLabel: "AC",
      format: "{ord} day of the {month}, {year} {era}",
      seasons: "story",
      note: "Westerosi reckoning: years After the Conquest (AC), months counted as moons. Seasons last years, not months, and turn only when the Citadel sends its white ravens."
    })
  },
  {
    id: "roshar",
    label: "Roshar (The Stormlight Archive)",
    name: "Roshar",
    start: "Day 1 · 23 Tanat 1174 · 18:40",
    match: /\broshar|stormlight|\bvorin\b|\balethkar\b|\burithiru\b/i,
    build: () => ({
      months: VORIN.map((n) => m(n, 50)),
      weekdays: [],
      format: "{day} {month} {year}",
      seasons: "story",
      named: [{ name: "the Weeping", month: 9, day: 31, days: 40 }],
      moons: [{ name: "Salas", period: 19 }, { name: "Nomon", period: 31 }, { name: "Mishim", period: 43 }],
      note: "Rosharan reckoning: ten months of fifty days (five weeks of ten), five hundred days a year. Seasons are irregular and last weeks, not months. The Weeping, four weeks of unbroken rain, straddles the new year; highstorms sweep in from the east every few days, and people plan around them."
    })
  },
  {
    id: "harptos",
    label: "Calendar of Harptos (Forgotten Realms)",
    name: "Harptos",
    start: "Day 1 · 14 Marpenoth 1492 DR · 18:40",
    match: /\bharptos|forgotten realms|faer[uû]n|\bdalereckoning\b|\bD\.?R\.?\s*$/i,
    build: () => ({
      months: [
        m("Hammer", 30),
        fest("Midwinter"),
        m("Alturiak", 30),
        m("Ches", 30),
        m("Tarsakh", 30),
        fest("Greengrass"),
        m("Mirtul", 30),
        m("Kythorn", 30),
        m("Flamerule", 30),
        fest("Midsummer"),
        m("Eleasis", 30),
        m("Eleint", 30),
        fest("Highharvestide"),
        m("Marpenoth", 30),
        m("Uktar", 30),
        fest("Feast of the Moon"),
        m("Nightal", 30)
      ],
      weekdays: [],
      yearLabel: "DR",
      leap: { after: 9, name: "Shieldmeet", every: 4 },
      note: "Calendar of Harptos: twelve months of thirty days in three tendays each, with five festival days between months and Shieldmeet after Midsummer every fourth year. Years are Dalereckoning (DR)."
    })
  },
  {
    id: "shire",
    label: "Shire Reckoning (Middle-earth)",
    name: "Shire Reckoning",
    start: "Day 1 · 22 Halimath 1418 S.R. · 18:40",
    match: /\bshire reckoning|\bshire\b|middle[- ]earth|\bS\.?R\.?\s*$/i,
    build: () => ({
      months: [
        fest("2 Yule"),
        m("Afteryule", 30),
        m("Solmath", 30),
        m("Rethe", 30),
        m("Astron", 30),
        m("Thrimidge", 30),
        m("Forelithe", 30),
        fest("1 Lithe"),
        fest("Mid-year's Day", true),
        fest("2 Lithe"),
        m("Afterlithe", 30),
        m("Wedmath", 30),
        m("Halimath", 30),
        m("Winterfilth", 30),
        m("Blotmath", 30),
        m("Foreyule", 30),
        fest("1 Yule")
      ],
      weekdays: ["Sterday", "Sunday", "Monday", "Trewsday", "Hevensday", "Mersday", "Highday"],
      yearStartWeekday: 0,
      yearLabel: "S.R.",
      leap: { after: 8, name: "Overlithe", every: 4, skipCentury: true, weekless: true },
      note: "Shire Reckoning: twelve months of thirty days with the Yule and Lithe days between them. Every year begins on a Sterday, because Mid-year's Day and Overlithe belong to no week."
    })
  }
];
function presetFor(text) {
  const t = (text ?? "").split(/[;\n]/)[0];
  return t.trim() ? CALENDAR_PRESETS.find((p) => p.match.test(t)) : undefined;
}

// src/core/engines/calendar.ts
var GREG_MONTHS = [
  ["January", 31],
  ["February", 28],
  ["March", 31],
  ["April", 30],
  ["May", 31],
  ["June", 30],
  ["July", 31],
  ["August", 31],
  ["September", 30],
  ["October", 31],
  ["November", 30],
  ["December", 31]
];
var GREG_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
function defaultCalendar() {
  return {
    months: GREG_MONTHS.map(([name, days]) => ({ name, days })),
    weekdays: [...GREG_DAYS],
    startDoy: 284,
    startWeekday: 0,
    hemisphere: "north",
    custom: false,
    named: [],
    seasons: "solar"
  };
}
function yearLength(cal) {
  return cal.months.reduce((s, m) => s + m.days, 0) || 365;
}
function isLeap(y) {
  return y % 4 === 0 && y % 100 !== 0 || y % 400 === 0;
}
function monthsFor(cal, year) {
  if (year == null)
    return cal.months;
  if (!cal.custom) {
    if (!isLeap(year))
      return cal.months;
    return cal.months.map((m, i) => i === 1 ? { ...m, days: m.days + 1 } : m);
  }
  const lp = cal.leap;
  if (!lp || year % lp.every !== 0 || lp.skipCentury && year % 100 === 0 && year % 400 !== 0)
    return cal.months;
  const out = cal.months.slice();
  out.splice(lp.after + 1, 0, { name: lp.name, days: 1, festival: true, ...lp.weekless ? { weekless: true } : {} });
  return out;
}
var sumDays = (months) => months.reduce((s, m) => s + m.days, 0) || 365;
function weekedDays(months, from, to) {
  let n = 0;
  let at = 0;
  for (const m of months) {
    const a = Math.max(from, at);
    const b = Math.min(to, at + m.days);
    if (b > a && !m.weekless)
      n += b - a;
    at += m.days;
  }
  return n;
}
function gregWeekday(y, m, d) {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let yy = y;
  if (m < 3)
    yy -= 1;
  const sun0 = (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1] + d) % 7;
  return (sun0 + 6) % 7;
}
var SEASON_DOY = [
  [/\bearly spring\b/i, 75],
  [/\blate spring\b/i, 150],
  [/\bspring\b/i, 110],
  [/\bearly summer\b/i, 165],
  [/\blate summer\b/i, 225],
  [/\bmidsummer\b/i, 172],
  [/\bsummer\b/i, 195],
  [/\bearly autumn\b|\bearly fall\b/i, 258],
  [/\blate autumn\b|\blate fall\b/i, 318],
  [/\bautumn\b|\bfall\b/i, 288],
  [/\bearly winter\b/i, 345],
  [/\blate winter\b/i, 50],
  [/\bmidwinter\b/i, 355],
  [/\bwinter\b/i, 20]
];
function seasonOf(text) {
  const m = /(spring|summer|autumn|fall|winter)/i.exec(text ?? "");
  if (!m)
    return;
  const s = m[1].toLowerCase();
  return s === "fall" ? "autumn" : s;
}
var esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
function findDate(cal, text) {
  let best = null;
  const yearTail = `(?:,?\\s+(\\d{1,5})(?![:.]?\\d))?`;
  const consider = (re, month, dayGroup, yearGroup) => {
    const r = re.exec(text);
    if (!r || best && best.at <= r.index)
      return;
    const day = dayGroup ? parseInt(r[dayGroup], 10) : 1;
    if (day < 1 || day > cal.months[month].days)
      return;
    best = { at: r.index, month, day, year: r[yearGroup] ? parseInt(r[yearGroup], 10) : undefined };
  };
  cal.months.forEach((mo, i) => {
    const n = esc(mo.name);
    if (mo.festival && mo.days === 1) {
      consider(new RegExp(`(?<![\\w'])${n}(?![\\w'])${yearTail}`, "i"), i, null, 1);
      return;
    }
    consider(new RegExp(`(?<![\\w:])(\\d{1,3})(?:st|nd|rd|th)?\\s+(?:day\\s+)?(?:of\\s+)?(?:the\\s+)?${n}(?![\\w'])${yearTail}`, "i"), i, 1, 2);
    consider(new RegExp(`(?<![\\w'])${n}\\s+(\\d{1,3})(?:st|nd|rd|th)?(?![:.]?\\d)${yearTail}`, "i"), i, 1, 2);
  });
  return best;
}
function parseMonth(raw) {
  let s = raw.trim();
  let festival = false;
  let weekless = false;
  let days;
  const br = /^\[(.+)\]$/.exec(s);
  if (br) {
    festival = true;
    s = br[1].trim();
  }
  const pm = /^(.+?)\s*\(([^)]*)\)$/.exec(s);
  if (pm) {
    s = pm[1].trim();
    for (const f of pm[2].split(/\s*,\s*/)) {
      if (/^\d+$/.test(f))
        days = parseInt(f, 10);
      else if (/festival|holiday|intercalary/i.test(f))
        festival = true;
      else if (/weekless|no week/i.test(f))
        weekless = true;
    }
  }
  if (!s)
    return null;
  return { name: s, days: days ?? (festival ? 1 : 30), ...festival ? { festival } : {}, ...weekless ? { weekless } : {} };
}
var splitList = (s) => s.split(/\s*,\s*(?![^()[\]]*[)\]])/).map((x) => x.trim()).filter(Boolean);
function buildCalendar(opts) {
  let cal = defaultCalendar();
  let text = opts.calendar ?? "";
  const preset = presetFor(text);
  if (preset) {
    cal = { ...cal, startDoy: 0, ...preset.build(), custom: true, preset: preset.id };
    cal.named = cal.named.map((h) => ({ ...h }));
  }
  if (/\bsouth(ern)?\b|-\d/.test(opts.latitude ?? ""))
    cal.hemisphere = "south";
  const fm = /\bformat\s*[:=]\s*([^;\n]+)/i.exec(text);
  if (fm) {
    cal.format = fm[1].trim();
    text = text.replace(fm[0], "");
  }
  const wd = /weekdays?\s*[:=]?\s*([^;\n]+)/i.exec(text);
  if (wd) {
    const list = wd[1].split(/\s*[,/·]\s*/).filter(Boolean);
    if (/^(none|no names?|unnamed|nameless)\b/i.test(wd[1].trim())) {
      cal.weekdays = [];
      cal.custom = true;
    } else if (list.length >= 3) {
      cal.weekdays = list.map((s) => s.trim());
      cal.custom = true;
    } else {
      const range = /([A-Z][a-z]+)\s*[–-]\s*([A-Z][a-z]+)/.exec(wd[1]);
      if (range && !GREG_DAYS.includes(range[1])) {
        cal.weekdays = [range[1], ...GREG_DAYS.slice(1, 6), range[2]];
        cal.custom = true;
      }
    }
  }
  const mo = /months?\s*[:=]?\s*([^;\n]+)/i.exec(text);
  let monthsSet = false;
  if (mo) {
    const list = splitList(mo[1]).map(parseMonth).filter((x) => !!x);
    if (list.length >= 2) {
      cal.months = list;
      cal.custom = true;
      monthsSet = true;
      if (cal.leap && cal.leap.after >= list.length)
        cal.leap = undefined;
      cal.named = [];
    }
  }
  const yl = /(?:^|[;\n,])\s*(?:year(?:\s*label)?|era)\b\s*[:=]?\s*([^;\n]+)/i.exec(text);
  if (yl) {
    const v = yl[1].trim();
    const num = /^(\d{1,5})\b\s*(.*)$/.exec(v);
    if (num) {
      cal.startYear = parseInt(num[1], 10);
      if (num[2].trim())
        cal.yearLabel = num[2].trim();
    } else
      cal.yearLabel = v;
  }
  const lp = /\bleap(?:\s*day)?\s*[:=]?\s*(.+?)\s+after\s+(.+?)\s+every\s+(\d+)/i.exec(text);
  if (lp) {
    const after = cal.months.findIndex((x) => x.name.toLowerCase() === lp[2].trim().toLowerCase());
    if (after >= 0)
      cal.leap = { after, name: lp[1].trim(), every: parseInt(lp[3], 10), weekless: /weekless|no week/i.test(/[^;\n]*/.exec(text.slice(lp.index))[0]) };
  }
  const se = /\bseasons?\s*[:=]\s*([^;\n]+)/i.exec(text);
  if (se)
    cal.seasons = /story|irregular|declared|set|years?\b/i.test(se[1]) ? "story" : "solar";
  const mn = /\bmoons?\s*[:=]\s*([^;\n]+)/i.exec(text);
  if (mn) {
    const moons = splitList(mn[1]).map((s) => {
      const x = /^(.+?)\s*\(\s*(\d+(?:\.\d+)?)[^)]*\)$/.exec(s);
      return x ? { name: x[1].trim(), period: parseFloat(x[2]) } : { name: s, period: 29.530588 };
    }).filter((x) => x.name && x.period > 0);
    if (moons.length)
      cal.moons = moons;
  }
  const named = /holidays?\s*[:=]\s*([^;\n]+)/i.exec(text);
  const namedMonths = !!preset || monthsSet;
  const sp = `${opts.startPoint ?? ""} ${opts.headerDate ?? ""}`;
  let placed = false;
  if (namedMonths) {
    const f = findDate(cal, sp);
    if (f) {
      if (f.year != null)
        cal.startYear = f.year;
      const months = monthsFor(cal, cal.startYear);
      const mi = months.findIndex((x) => x.name === cal.months[f.month].name);
      cal.startDoy = months.slice(0, mi).reduce((s, x) => s + x.days, 0) + f.day - 1;
      placed = true;
    }
  } else {
    const dm = /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Z][a-zA-Z]+)(?:,?\s+(\d{1,5}))?/.exec(sp) || /([A-Z][a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{1,5}))?/.exec(sp);
    if (dm) {
      const [dStr, mStr] = /^\d/.test(dm[1]) ? [dm[1], dm[2]] : [dm[2], dm[1]];
      const mi = cal.months.findIndex((m) => m.name.toLowerCase().startsWith(mStr.toLowerCase().slice(0, 3)));
      if (mi >= 0) {
        const day = parseInt(dStr, 10);
        if (dm[3])
          cal.startYear = parseInt(dm[3], 10);
        cal.startDoy = monthsFor(cal, cal.startYear).slice(0, mi).reduce((s, m) => s + m.days, 0) + day - 1;
        placed = true;
        if (!cal.custom && cal.startYear)
          cal.startWeekday = gregWeekday(cal.startYear, mi + 1, day);
      } else if (!GREG_DAYS.some((d) => d.toLowerCase() === mStr.toLowerCase())) {
        cal.custom = true;
        cal.months = Array.from({ length: 12 }, (_, i) => ({ name: i === 0 ? mStr : `Month ${i + 1}`, days: 30 }));
        cal.startDoy = parseInt(dStr, 10) - 1;
        placed = true;
      }
    }
  }
  if (!placed && namedMonths)
    cal.startDoy = 0;
  if (!placed && cal.seasons === "solar") {
    const txt = `${opts.climate ?? ""} ${opts.startPoint ?? ""}`;
    for (const [re, doy] of SEASON_DOY)
      if (re.test(txt)) {
        cal.startDoy = Math.round(doy / 365 * yearLength(cal));
        break;
      }
  }
  if (cal.seasons === "story")
    cal.season0 = seasonOf(`${opts.startPoint ?? ""} ${opts.climate ?? ""}`) ?? "summer";
  const wname = cal.weekdays.findIndex((w) => new RegExp(`\\b${w}\\b`, "i").test(sp));
  if (wname >= 0)
    cal.startWeekday = wname;
  const fromHeader = !!opts.headerDate && !/(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?[A-Z][a-zA-Z]+|[A-Z][a-zA-Z]+\s+\d{1,2}\b|day\s*\d+/i.test(opts.startPoint ?? "");
  const shift = fromHeader && opts.anchorDay && opts.anchorDay > 1 ? opts.anchorDay - 1 : 0;
  if (shift && cal.weekdays.length)
    cal.startWeekday = ((cal.startWeekday - shift) % cal.weekdays.length + cal.weekdays.length) % cal.weekdays.length;
  if (shift) {
    cal.startDoy -= shift;
    while (cal.startDoy < 0) {
      if (cal.startYear != null)
        cal.startYear--;
      cal.startDoy += sumDays(monthsFor(cal, cal.startYear));
    }
  }
  if (named) {
    for (const h of splitList(named[1])) {
      const paren = /^(.+?)\s*\((.+)\)$/.exec(h);
      const name = paren ? paren[1] : /^(.+?)\s+(?=\d)/.exec(h)?.[1];
      const when = paren ? paren[2] : h.slice(name?.length ?? 0);
      if (!name)
        continue;
      const f = findDate(cal, when) ?? (() => {
        const x = /(\d{1,2})\s+([A-Za-z]+)/.exec(when);
        const mi = x ? cal.months.findIndex((m) => m.name.toLowerCase().startsWith(x[2].toLowerCase().slice(0, 3))) : -1;
        return x && mi >= 0 ? { month: mi, day: parseInt(x[1], 10) } : null;
      })();
      const span = /(\d+)\s*days?\b/i.exec(when);
      if (f)
        cal.named.push({ name: name.trim(), month: f.month, day: f.day, ...span ? { days: parseInt(span[1], 10) } : {} });
    }
  }
  return cal;
}
function dateFor(cal, day, storySeason) {
  const offset = day - 1;
  let year = cal.startYear;
  let months = monthsFor(cal, year);
  let yl = sumDays(months);
  let doy = cal.startDoy + offset;
  let from = cal.startDoy;
  let weeked = 0;
  while (doy >= yl) {
    weeked += weekedDays(months, from, yl);
    doy -= yl;
    from = 0;
    if (year != null)
      year++;
    months = monthsFor(cal, year);
    yl = sumDays(months);
  }
  weeked += weekedDays(months, from, doy);
  let rem = doy;
  let mi = 0;
  for (;mi < months.length; mi++) {
    if (rem < months[mi].days)
      break;
    rem -= months[mi].days;
  }
  if (mi >= months.length)
    mi = months.length - 1;
  const month = months[mi];
  const n = cal.weekdays.length;
  const wIdx = cal.yearStartWeekday != null ? cal.yearStartWeekday + weekedDays(months, 0, doy) : cal.startWeekday + weeked;
  const weekday = n && !month.weekless ? cal.weekdays[(wIdx % n + n) % n] : "";
  let season;
  let seasonDetail;
  if (cal.seasons === "story") {
    season = seasonOf(storySeason) ?? cal.season0 ?? "summer";
    seasonDetail = storySeason?.trim().toLowerCase() || season;
  } else {
    const frac = doy / yl;
    const northSeason = frac < 0.214 || frac >= 0.97 ? "winter" : frac < 0.47 ? "spring" : frac < 0.72 ? "summer" : "autumn";
    const flip = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };
    season = cal.hemisphere === "south" ? flip[northSeason] : northSeason;
    seasonDetail = `${seasonPhase(frac)} ${season}`;
  }
  const holiday = cal.named.find((h) => {
    const hm = months.findIndex((x) => x.name === cal.months[h.month]?.name);
    if (hm < 0)
      return false;
    const start = months.slice(0, hm).reduce((s, x) => s + x.days, 0) + h.day - 1;
    return ((doy - start) % yl + yl) % yl < (h.days ?? 1);
  })?.name;
  return {
    day,
    weekday,
    dayOfMonth: rem + 1,
    month: month.name,
    monthIndex: mi,
    ...month.festival ? { festival: true } : {},
    year,
    doy,
    season,
    seasonDetail,
    holiday
  };
}
function seasonPhase(frac) {
  const windows = [[-0.03, 0.214], [0.214, 0.47], [0.47, 0.72], [0.72, 0.97]];
  const f = frac >= 0.97 ? frac - 1 : frac;
  const w = windows.find(([s, e]) => f >= s && f < e) ?? windows[0];
  const p = (f - w[0]) / (w[1] - w[0]);
  return p < 0.33 ? "early" : p < 0.67 ? "mid" : "late";
}
function ordinal(n) {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
}
var DEFAULT_FORMAT = "{weekday} {day} {month} {year} {era}";
function fmtDate(cal, day) {
  const d = dateFor(cal, day);
  const f = d.festival ? "{weekday} {month} {year} {era}" : cal.format ?? DEFAULT_FORMAT;
  const tokens = {
    weekday: d.weekday,
    day: String(d.dayOfMonth),
    ord: ordinal(d.dayOfMonth),
    month: d.month,
    year: d.year != null ? String(d.year) : "",
    era: d.year != null ? cal.yearLabel ?? "" : ""
  };
  const out = f.replace(/\{(\w+)\}/g, (_, k) => tokens[k] ?? "").replace(/\s+,/g, ",").replace(/,(\s*,)+/g, ",").replace(/\s{2,}/g, " ").replace(/^[\s,]+|[\s,]+$/g, "");
  return `${out}${d.holiday ? ` (${d.holiday})` : ""}`;
}

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
var THEMES = [["", "Auto (by genre)"], ...SKIN_LIST];
var ORIGINAL_CALENDAR = "months: Thaw (30), Bloom (30), [Greenfest], Highsun (30), Harvest (30), Fade (30), Deepwinter (30); weekdays: Firstday, Seconday, Midday, Fourthday, Restday; year: 1 AR; seasons: solar";
var CAL_START_DEFAULT = "Day 1 · 14 October 1923 · 18:40";
function calendarKind(text) {
  if (!text?.trim() || /^gregorian\b/i.test(text.trim()))
    return "";
  return presetFor(text)?.id ?? "original";
}
function calendarPreview(calendar, startPoint, climate, latitude) {
  try {
    const cal = buildCalendar({ calendar, startPoint, climate, latitude });
    return `Day 1 is ${fmtDate(cal, 1)} · ${dateFor(cal, 1).seasonDetail}`;
  } catch {
    return "";
  }
}
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
<label class="f">Calendar${sel("szCalKind", [["", "Gregorian"], ...CALENDAR_PRESETS.map((p) => [p.id, p.label]), ["original", "An original world's calendar"]], calendarKind(cfg.calendar))}</label>
<label class="f">Start point<input type="text" id="szStart" value="${escapeHtml(cfg.startPoint ?? "")}" placeholder="${escapeHtml(presetFor(cfg.calendar)?.start ?? CAL_START_DEFAULT)}"></label>
</div>
<label class="f">Calendar details<input type="text" id="szCalendar" value="${escapeHtml(cfg.calendar ?? "")}" placeholder="months: Name (30), [Festival], …; weekdays: … or none; year: 1 AR; seasons: solar or story; moons: Name (days)"></label>
<p class="muted" id="szCalPreview"></p>
<h4>Trackers under each reply</h4><div id="almSzTrackers">${TRACKERS.map(([k, l]) => `<button type="button" class="pill${trackers.has(k) ? " on" : ""}" data-t="${k}">${escapeHtml(l)}</button>`).join("")}</div>
<label class="chk" style="margin-top:10px"><input type="checkbox" id="szSaveChar"> Use these as defaults for new chats with this character</label>
<div class="row" style="margin-top:12px"><button class="btn primary" id="szSave">Begin the story</button><button class="btn" id="szSkip">Skip</button></div>
</div>`;
  const order = [...cfg.genres ?? []];
  const field = (id) => modal.root.querySelector(`#${id}`);
  const preview = () => {
    const out = field("szCalPreview");
    if (out)
      out.textContent = calendarPreview(field("szCalendar")?.value ?? "", field("szStart")?.value || field("szStart")?.placeholder || "", field("szClimate")?.value ?? "", field("szLatitude")?.value ?? "");
  };
  modal.root.addEventListener("input", (ev) => {
    if (/^sz(Calendar|Start|Climate|Latitude)$/.test(ev.target.id))
      preview();
  });
  modal.root.addEventListener("change", (ev) => {
    if (ev.target.id !== "szCalKind")
      return;
    const kind = ev.target.value;
    const p = CALENDAR_PRESETS.find((x) => x.id === kind);
    const cal = field("szCalendar");
    cal.value = p ? p.name : kind === "original" ? ORIGINAL_CALENDAR : "";
    field("szStart").placeholder = p?.start ?? (kind === "original" ? "Day 1 · 14 Harvest 312 AR · 18:40" : CAL_START_DEFAULT);
    preview();
  });
  preview();
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

// src/frontend/hud.ts
var PIN = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg>`;
var mini = (c) => `<span class="alm-mini" style="--c:${escapeHtml(c.color)}" title="${escapeHtml(c.name)}${c.mood?.name ? ` · ${escapeHtml(c.mood.name)}` : ""}">${escapeHtml(initials(c.name))}</span>`;
var presentOf = (v) => (v.cast ?? []).filter((c) => (c.tier === "spot" || c.tier === "peri") && !c.isUser && !c.dead);
var skyOf = (v) => BAND_SKY[v?.now?.band] ?? BAND_SKY.evening;
function hudPill(v, note) {
  if (note || !v) {
    return `<div class="alm-hudw" role="button" tabindex="0" data-hud="toggle" title="Open the Almanac"><span class="alm-hudw__orb" style="background:${BAND_SKY.evening}"></span><b>ALMANAC</b><span class="alm-hudw__dim">${escapeHtml(note ?? "connecting…")}</span></div>`;
  }
  const n = v.now ?? {};
  const place = n.place ?? [];
  const present = presentOf(v).slice(0, 4);
  return `<div class="alm-hudw" role="button" tabindex="0" data-hud="toggle" aria-expanded="false" title="Open the Now window">
<span class="alm-hudw__orb" style="background:${skyOf(v)}"><i class="${/night|hours|pre-dawn|evening|dusk/.test(n.band ?? "evening") ? "moon" : "sun"}"></i></span><b class="alm-hudw__t">${escapeHtml(n.time ?? "--:--")}</b>${n.weather ? `<span>${escapeHtml(n.weather.glyph)} ${escapeHtml(n.weather.condition)}</span>` : ""}${place.length ? `<span class="alm-hudw__pl">${PIN}${escapeHtml(place[place.length - 1])}</span>` : ""}${present.length ? `<span class="alm-stack">${present.map(mini).join("")}</span>` : ""}${v.planError ? `<span class="alm-hudw__err" title="The last turn went to the model without the Almanac. Open the Almanac for details.">!</span>` : ""}</div>`;
}
function hudCard(v) {
  const n = v.now ?? {};
  const place = n.place ?? [];
  const clock = String(n.clock ?? "");
  const cut = clock.lastIndexOf(", ");
  const date = n.time && cut > 0 ? clock.slice(0, cut) : "";
  const present = presentOf(v).slice(0, 5);
  const owed = (v.world?.cons ?? []).filter((c) => c.status === "due" || c.status === "open").slice(-2);
  const who = present.map((c) => `<li>${mini(c)}<div><b>${escapeHtml(c.name)}</b>${c.mood?.name ? ` <span class="alm-hudc__mood">${escapeHtml(c.mood.name)}</span>` : ""}${c.activity ? `<small>${escapeHtml(c.activity)}</small>` : ""}</div></li>`).join("");
  return `<div class="alm-hudc" role="dialog" aria-label="ALMANAC · Now">
<div class="alm-hudc__sky" style="background:${skyOf(v)}">
  <div class="alm-hudc__row"><b class="alm-hudc__clock">${escapeHtml(n.time ?? "--:--")}</b><span class="alm-hudc__date">${escapeHtml(date)}</span><button class="alm-hudc__x" data-hud="toggle" aria-label="Close the Now window">✕</button></div>
  ${n.title ? `<div class="alm-hudc__title">${escapeHtml(n.title)}</div>` : ""}
  <div class="alm-hudc__chips">${n.weather ? `<span>${escapeHtml(n.weather.glyph)} ${escapeHtml(n.weather.text ?? n.weather.condition)}</span>` : ""}${place.length ? `<span>${PIN} ${escapeHtml(place.slice(-2).join(" › "))}</span>` : ""}${n.mode ? `<span>${escapeHtml(n.mode)}</span>` : ""}</div>
</div>
<div class="alm-hudc__bd">
  ${v.planError ? `<p class="alm-hudc__err"><b>The last turn went out without the Almanac.</b> ${escapeHtml(v.planError.message)}</p>` : ""}
  <h5>Present</h5>
  ${who ? `<ul class="alm-hudc__who">${who}</ul>` : `<p class="alm-hudc__muted">No one else is here.</p>`}
  ${owed.length ? `<h5>Owed and due</h5><ul class="alm-hudc__owed">${owed.map((c) => `<li class="${c.status === "due" ? "due" : ""}">${escapeHtml(c.whoName)}${c.whomName ? ` → ${escapeHtml(c.whomName)}` : ""}: ${escapeHtml(c.what ?? "")}${c.dueText ? ` <small>due ${escapeHtml(c.dueText)}</small>` : ""}</li>`).join("")}</ul>` : ""}
  ${n.forecast ? `<h5>Ahead</h5><p class="alm-hudc__muted">${escapeHtml(n.forecast)}</p>` : ""}
  <button class="alm-hudc__go" data-hud="open">Open the Almanac →</button>
</div></div>`;
}
function measure(html, width) {
  try {
    const probe = document.createElement("div");
    probe.style.cssText = `position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;${width ? `width:${width}px;` : "width:max-content;"}`;
    probe.innerHTML = html;
    document.body.appendChild(probe);
    const el = probe.firstElementChild;
    const r = el?.getBoundingClientRect();
    probe.remove();
    if (r && r.width > 0)
      return { w: Math.ceil(r.width), h: Math.ceil(r.height) };
  } catch {}
  const text = html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const avatars = (html.match(/class="alm-mini"/g) ?? []).length;
  return width ? { w: width, h: 380 } : { w: Math.ceil(text.length * 7.4 + 56 + avatars * 18), h: 40 };
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
  let skin = "almanac";
  let fontStyle = null;
  let fontSkin = "";
  const setFonts = (on) => {
    if (fontStyle && (!on || fontSkin !== skin)) {
      fontStyle();
      fontStyle = null;
    }
    if (on && !fontStyle) {
      fontStyle = ctx.dom.addStyle(fontsFor(skin));
      fontSkin = skin;
    }
    fontsOn = on;
  };
  setFonts(true);
  removers.push(ctx.dom.addStyle(TOKENS + SKIN_CSS + MESSAGE_CSS + PANEL_CSS));
  let modePref = "auto";
  const systemDark = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const hostMode = () => {
    if (typeof getComputedStyle !== "function")
      return systemDark() ? "dark" : "light";
    const probe = (el) => {
      if (!el)
        return null;
      const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(getComputedStyle(el).backgroundColor);
      if (!m || m[4] != null && parseFloat(m[4]) < 0.5)
        return null;
      const [r, g, b] = [m[1], m[2], m[3]].map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 ? "dark" : "light";
    };
    const fromVar = getComputedStyle(document.documentElement).getPropertyValue("--lumiverse-bg").trim();
    if (fromVar) {
      const tmp = document.createElement("span");
      tmp.style.cssText = `position:absolute;visibility:hidden;background:${fromVar}`;
      document.body.append(tmp);
      const m = probe(tmp);
      tmp.remove();
      if (m)
        return m;
    }
    return probe(document.body) ?? probe(document.documentElement) ?? (systemDark() ? "dark" : "light");
  };
  const applyMode = () => {
    let mode = modePref;
    if (mode !== "light" && mode !== "dark") {
      try {
        mode = hostMode();
      } catch {
        mode = "light";
      }
    }
    document.documentElement.setAttribute("data-alm-mode", mode);
  };
  applyMode();
  if (typeof MutationObserver === "function") {
    const modeWatch = new MutationObserver(() => {
      if (modePref === "auto")
        applyMode();
    });
    modeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-mode", "data-color-scheme"] });
    if (document.body)
      modeWatch.observe(document.body, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    removers.push(() => modeWatch.disconnect());
  }
  if (typeof matchMedia === "function") {
    const schemeQuery = matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => modePref === "auto" && applyMode();
    schemeQuery.addEventListener?.("change", onScheme);
    removers.push(() => schemeQuery.removeEventListener?.("change", onScheme));
  }
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
  const refreshDisplay = () => {
    try {
      ctx.display?.invalidate(["*"]);
    } catch {}
  };
  let displaySig;
  setTimeout(refreshDisplay, 0);
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
  let hudOpen = false;
  try {
    hudOpen = localStorage.getItem("alm-hud-open") === "1";
  } catch {}
  const setHudOpen = (open) => {
    hudOpen = open;
    try {
      localStorage.setItem("alm-hud-open", open ? "1" : "0");
    } catch {}
    renderHud(app.view);
  };
  const onHudAction = (target) => {
    const el = target?.closest?.("[data-hud]");
    if (!el)
      return;
    const v = app.view;
    const live = v && v.chatId === ctx.getActiveChat().chatId && v.enabled;
    if (el.dataset.hud === "open" || !live) {
      tab.activate();
      return;
    }
    setHudOpen(!hudOpen);
  };
  const ensureHud = (on) => {
    hudOn = on;
    try {
      if (on && !hud) {
        hud = ctx.ui.createFloatWidget({ width: 260, height: 40, initialPosition: { x: 24, y: 88 }, snapToEdge: true, tooltip: "ALMANAC · Now", chromeless: true });
        hud.root.addEventListener("click", (ev) => onHudAction(ev.target));
        hud.root.addEventListener("keydown", (ev) => {
          const k = ev.key;
          if (k === "Escape" && hudOpen)
            setHudOpen(false);
          else if ((k === "Enter" || k === " ") && ev.target.matches?.('[role="button"]')) {
            ev.preventDefault();
            onHudAction(ev.target);
          }
        });
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
  let lastHud = "";
  const renderHud = (v) => {
    if (!hud)
      return;
    const chatId = ctx.getActiveChat().chatId;
    if (!chatId || !hudOn) {
      hud.setVisible(false);
      return;
    }
    hud.setVisible(true);
    let html;
    let width;
    if (!v || v.chatId !== chatId)
      html = hudPill(null, app.status === "stalled" ? "no answer yet" : "connecting…");
    else if (!v.enabled)
      html = hudPill(null, "off in this chat");
    else if (hudOpen) {
      html = hudCard(v);
      width = 300;
    } else
      html = hudPill(v);
    if (html === lastHud)
      return;
    lastHud = html;
    hud.root.innerHTML = html;
    const size = measure(html, width);
    hud.setSize(Math.min(width ?? 440, Math.max(120, size.w || 260)), Math.max(40, Math.min(560, size.h || 40)));
  };
  const applyView = (v) => {
    gotStateFor = v ? v.chatId : null;
    if (retry && v) {
      clearTimeout(retry);
      retry = null;
    }
    app.setStatus(v ? "ok" : ctx.getActiveChat().chatId ? "waiting" : "nochat");
    app.versionWarning = v && v.version !== VERSION ? String(v.version ?? "an older version") : "";
    app.setView(v);
    if (v) {
      const sig = JSON.stringify([v.chatId, v.version, v.enabled, v.theme, v.config?.colors, v.detected?.trackerView, v.detected?.trackers, v.detected?.nsfw]);
      if (sig !== displaySig) {
        if (displaySig !== undefined || v.version !== VERSION)
          refreshDisplay();
        displaySig = sig;
      }
      skin = v.theme || "almanac";
      document.documentElement.setAttribute("data-alm-skin", skin);
      if (fontsOn && fontSkin !== skin)
        setFonts(true);
      const pref = v.settings?.skinMode ?? "auto";
      if (pref !== modePref) {
        modePref = pref;
        applyMode();
      }
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
      case "clerkProgress":
        if (app.view?.chatId !== m.chatId)
          return;
        app.clerkProgress = m.done >= m.total ? "" : `${m.done}/${m.total}`;
        app.render();
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
    setTimeout(refreshDisplay, 400);
    if (p && "hud" in p)
      ensureHud(!!p.hud);
    if (p && "fonts" in p)
      setFonts(!!p.fonts);
    if (p && "skinMode" in p) {
      modePref = p.skinMode || "auto";
      applyMode();
    }
  }));
  try {
    const action = ctx.ui.registerInputBarAction({ id: "almanac-command", label: "Almanac command…", iconSvg: ICON.replace(/20/g, "14") });
    removers.push(action.onClick(async () => {
      try {
        const res = await ctx.ui.showContextMenu({ items: COMMANDS.map(([key, label]) => ({ key, label })), position: { x: Math.round(window.innerWidth / 2), y: window.innerHeight - 120 } });
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
    document.documentElement.removeAttribute("data-alm-mode");
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
