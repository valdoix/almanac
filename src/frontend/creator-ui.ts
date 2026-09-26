// Lorebook Creator wizard (in the Almanac tab): source → plan → generate →
// validate/link/preview → write or export.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { escapeHtml as e } from "../core/util";

type Step = "source" | "plan" | "entries" | "done";

export class CreatorUI {
  ctx: SpindleFrontendContext;
  getView: () => any;
  rerender: () => void;
  step: Step = "source";
  mode: "quick" | "guided" | "suggest" | "parse" | "category" = "quick";
  sourceKind: "text" | "character" | "codex" | "book" = "text";
  sourceText = "";
  bookId = "";
  notes = "";
  plan: { title: string; description?: string; priority?: number; constant?: boolean; position?: number }[] = [];
  entries: any[] = [];
  issues: Record<number, string[]> = {};
  fixes: Record<number, string[]> = {};
  report: any = null;
  activation: any[] | null = null;
  scene = "";
  busy = "";
  progress = "";
  books: { id: string; name: string }[] = [];
  error = "";
  written: any = null;
  health: any = null;
  private rid = 0;
  private pending = new Map<number, (m: any) => void>();

  constructor(ctx: SpindleFrontendContext, getView: () => any, rerender: () => void) {
    this.ctx = ctx;
    this.getView = getView;
    this.rerender = rerender;
  }

  handle(m: any): boolean {
    if (m?.type === "creatorProgress") {
      this.progress = `${m.done}/${m.total}`;
      this.rerender();
      return true;
    }
    if ((m?.type === "creator" || m?.type === "books" || m?.type === "bookHealth") && this.pending.has(m.rid)) {
      this.pending.get(m.rid)!(m);
      this.pending.delete(m.rid);
      return true;
    }
    return false;
  }

  private call(payload: Record<string, unknown>): Promise<any> {
    const rid = ++this.rid;
    return new Promise((resolve) => {
      this.pending.set(rid, resolve);
      this.ctx.sendToBackend({ ...payload, rid, chatId: this.getView()?.chatId });
      setTimeout(() => {
        if (this.pending.has(rid)) {
          this.pending.delete(rid);
          resolve({ error: "timed out" });
        }
      }, 15 * 60_000);
    });
  }

  private source() {
    return { kind: this.sourceKind, text: this.sourceText, chatId: this.getView()?.chatId, bookId: this.bookId };
  }

  render(_v: any): string {
    const busy = this.busy ? `<div class="card flat">⏳ ${e(this.busy)} ${e(this.progress)}</div>` : "";
    const err = this.error ? `<div class="alm-tag warn">${e(this.error)}</div>` : "";
    if (this.step === "source") {
      return `${busy}${err}<p class="muted">Build a lorebook that follows VELLUM III conventions (labelled titles, first-sentence formulas, metadata), so the Ledger — and VELLUM III — read it exactly.</p>
<label class="f">Mode<select data-cr="mode">${[["quick", "⚡ Quick — plan and write"], ["guided", "🤝 Guided — review the plan first"], ["suggest", "📋 Suggest entries from a premise"], ["parse", "📋 Parse raw lore"], ["category", "📋 Example entries for a category"]].map(([k, l]) => `<option value="${k}"${k === this.mode ? " selected" : ""}>${l}</option>`).join("")}</select></label>
<label class="f">Source<select data-cr="sourceKind">${[["text", "Text I paste"], ["character", "This chat's character card"], ["codex", "This chat's Codex (save the story so far)"], ["book", "An existing lorebook (upgrade)"]].map(([k, l]) => `<option value="${k}"${k === this.sourceKind ? " selected" : ""}>${l}</option>`).join("")}</select></label>
${this.sourceKind === "text" ? `<label class="f">Premise or lore<textarea data-cr="sourceText" style="min-height:140px">${e(this.sourceText)}</textarea></label>` : ""}
${this.sourceKind === "book" ? `<label class="f">Lorebook<select data-cr="bookId"><option value="">choose…</option>${this.books.map((b) => `<option value="${e(b.id)}"${b.id === this.bookId ? " selected" : ""}>${e(b.name)}</option>`).join("")}</select></label><div class="row"><button class="btn" data-cr-act="loadBooks">Load books</button>${this.bookId ? `<button class="btn" data-cr-act="health">Health check</button>` : ""}</div>${this.health ? this.renderHealth() : ""}` : ""}
<label class="f">Notes (optional)<input type="text" data-cr="notes" value="${e(this.notes)}" placeholder="tone, era, what to emphasise"></label>
<button class="btn primary" data-cr-act="plan"${this.busy ? " disabled" : ""}>Plan the lorebook</button>`;
    }
    if (this.step === "plan") {
      return `${busy}${err}<h4>Plan · ${this.plan.length} entries</h4><p class="muted">Rename, remove or add entries. Titles use VELLUM III labels (Character:, Location:, CURRENT - …, Upcoming: …).</p>
<div class="list">${this.plan.map((p, i) => `<div class="rec"><div class="row"><input type="text" data-plan-title="${i}" value="${e(p.title)}" class="grow"><input type="number" data-plan-pri="${i}" value="${p.priority ?? 100}" style="width:78px" title="priority"><label class="chk"><input type="checkbox" data-plan-const="${i}"${p.constant ? " checked" : ""}> const</label><button class="btn danger" data-cr-act="planDel" data-i="${i}">✕</button></div>${p.description ? `<div class="muted"><small>${e(p.description)}</small></div>` : ""}</div>`).join("")}</div>
<div class="row" style="margin-top:8px"><button class="btn" data-cr-act="planAdd">+ Add entry</button><button class="btn" data-cr-act="back">Back</button><button class="btn primary" data-cr-act="generate"${this.busy ? " disabled" : ""}>Write ${this.plan.length} entries</button></div>`;
    }
    if (this.step === "entries" || this.step === "done") {
      const rep = this.report;
      return `${busy}${err}<h4>${this.entries.length} entries</h4>
${rep ? `<div class="card flat"><div class="kv"><b>Tokens</b><span>${rep.totalTokens} total · ${rep.constantTokens} constant per turn</span><b>Positions</b><span>${Object.entries(rep.positions).map(([k, n]) => `${k}: ${n}`).join(" · ")}</span><b>Links</b><span>${rep.link.edges.length} recursion links · ${rep.link.orphans.length} orphans · ${rep.link.loops.length} loops</span></div>${rep.link.mismatches.length ? `<div class="alm-tag warn">${e(rep.link.mismatches.slice(0, 3).join(" · "))}</div>` : ""}${rep.link.suggestions.slice(0, 4).map((s: string) => `<div class="muted"><small>• ${e(s)}</small></div>`).join("")}</div>` : ""}
<div class="list">${this.entries.map((en) => `<details class="rec"><summary><b>${e(en.comment)}</b> <span class="pill">P${en.priority}</span> <span class="pill">pos ${en.position}${en.position === 4 ? "@" + en.depth : ""}</span>${en.constant ? `<span class="pill">const</span>` : ""}${this.issues[en.uid] ? `<span class="pill" style="color:var(--alm-danger)">${this.issues[en.uid].length} issue(s)</span>` : ""}</summary>
<textarea data-en-content="${en.uid}" style="min-height:90px">${e(en.content)}</textarea><label class="f">Keys<input type="text" data-en-keys="${en.uid}" value="${e(en.key.join(", "))}"></label>
${this.issues[en.uid] ? `<div class="alm-tag warn">${e(this.issues[en.uid].join(" · "))}</div>` : ""}${this.fixes[en.uid] ? `<div class="muted"><small>auto-fixed: ${e(this.fixes[en.uid].join(" · "))}</small></div>` : ""}
<div class="row"><button class="btn danger" data-cr-act="entryDel" data-uid="${en.uid}">Remove</button></div></details>`).join("")}</div>
<h4>Activation simulator</h4><textarea data-cr="scene" placeholder="Paste a sample scene to see which entries would fire…">${e(this.scene)}</textarea><button class="btn" data-cr-act="simulate">Simulate</button>
${this.activation ? `<ul class="alm-list">${this.activation.map((a) => `<li>${e(a.comment)} — <small class="muted">${e(a.reason)}</small></li>`).join("") || "<li>Nothing fires.</li>"}</ul>` : ""}
<h4>Save</h4><div class="row"><input type="text" id="almCrName" placeholder="New lorebook name" class="grow"><select id="almCrAttach"><option value="none">don't attach</option><option value="character">attach to character</option><option value="persona">attach to persona</option><option value="chat">attach to this chat</option><option value="global">attach globally</option></select></div>
<label class="chk"><input type="checkbox" id="almCrBridge" checked> Read it into this chat's Codex now (Lore Bridge)</label>
<div class="row"><button class="btn primary" data-cr-act="writeNew">Create lorebook</button>${this.bookId ? `<button class="btn" data-cr-act="writeMerge">Merge into the source book</button>` : ""}<button class="btn" data-cr-act="export">Download JSON</button><button class="btn" data-cr-act="restart">Start over</button></div>
${this.written ? `<div class="card flat">✓ Saved: ${this.written.created} created, ${this.written.updated} updated.</div>` : ""}`;
    }
    return "";
  }

  renderHealth(): string {
    const h = this.health;
    return `<div class="card flat"><h4>Health check</h4><div class="muted">${h.constantTokens} constant tokens per turn</div><ul class="alm-list">${h.issues.slice(0, 40).map((i: any) => `<li class="${i.severity === "error" ? "due" : ""}">${e(i.entry)}: ${e(i.issue)}</li>`).join("") || "<li>No issues found.</li>"}</ul></div>`;
  }

  onChange(t: HTMLInputElement): boolean {
    const d = t.dataset;
    if (d.cr) {
      (this as any)[d.cr] = t.value;
      if (d.cr === "sourceKind" || d.cr === "bookId") this.rerender();
      return true;
    }
    if (d.planTitle != null) { this.plan[+d.planTitle].title = t.value; return true; }
    if (d.planPri != null) { this.plan[+d.planPri].priority = Number(t.value); return true; }
    if (d.planConst != null) { this.plan[+d.planConst].constant = t.checked; return true; }
    if (d.enContent != null) { const en = this.entries.find((x) => x.uid === +d.enContent!); if (en) en.content = t.value; return true; }
    if (d.enKeys != null) { const en = this.entries.find((x) => x.uid === +d.enKeys!); if (en) en.key = t.value.split(",").map((s) => s.trim()).filter(Boolean); return true; }
    return false;
  }

  onClick(t: HTMLElement): boolean {
    const el = t.closest("[data-cr-act]") as HTMLElement | null;
    if (!el) return false;
    const act = el.dataset.crAct;
    const root = el.closest(".almp") as HTMLElement;
    const run = async (label: string, fn: () => Promise<void>) => {
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
        run("Loading books", async () => { this.books = (await this.call({ type: "books" })).books ?? []; });
        break;
      case "health":
        run("Checking", async () => { this.health = (await this.call({ type: "bookHealth", bookId: this.bookId })).result; });
        break;
      case "plan":
        run("Planning", async () => {
          const r = await this.call({ type: "creator", action: "plan", req: { mode: this.mode, source: this.source(), notes: this.notes } });
          if (r.error) throw new Error(r.error);
          this.plan = r.plan ?? [];
          if (this.mode === "quick" && this.plan.length) {
            this.busy = "Writing entries";
            this.rerender();
            await this.generate();
          } else this.step = "plan";
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
        run("Relinking", async () => { this.report = (await this.call({ type: "creator", action: "report", entries: this.entries })).report; });
        break;
      case "simulate":
        run("Simulating", async () => { this.activation = (await this.call({ type: "creator", action: "simulate", entries: this.entries, scene: this.scene })).activation ?? []; });
        break;
      case "writeNew":
      case "writeMerge": {
        const name = (root.querySelector("#almCrName") as HTMLInputElement)?.value || "ALMANAC lorebook";
        const attach = (root.querySelector("#almCrAttach") as HTMLSelectElement)?.value || "none";
        const bridge = (root.querySelector("#almCrBridge") as HTMLInputElement)?.checked;
        run("Saving", async () => {
          const target = act === "writeMerge" ? { kind: "merge", bookId: this.bookId } : { kind: "new", name };
          const r = await this.call({ type: "creator", action: "write", req: { entries: this.entries, target, attach, chatId: this.getView()?.chatId, bridge } });
          if (r.error) throw new Error(r.error);
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

  private async generate() {
    const r = await this.call({ type: "creator", action: "generate", req: { plan: this.plan, source: this.source() } });
    if (r.error) throw new Error(r.error);
    this.entries = r.entries ?? [];
    this.issues = r.issues ?? {};
    this.fixes = r.fixes ?? {};
    this.report = r.report ?? null;
    this.step = "entries";
  }
}
