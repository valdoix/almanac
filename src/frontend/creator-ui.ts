// Lorebook Creator (Library › Creator): a conversation with the model. The Almanac asks what to
// make, proposes a plan, revises it with the player until they accept, writes the entries, and
// saves them. The conversation lives in the backend (and the player's storage); this page draws
// the latest session it was sent and turns clicks and typing into requests.

import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import { escapeHtml as e } from "../core/util";
import { CATEGORIES } from "../core/loreformat";
import { ask } from "./confirm";

const TASKS: [string, string, string][] = [
  ["new", "Create a new lorebook", "from a premise, a canon, your notes or this chat's character card"],
  ["update", "Update a lorebook", "add entries, change what's changed, retire what no longer holds"],
  ["convert", "Make a lorebook Almanac-compatible", "retitle, tag and tier every entry so the Almanac reads it exactly"],
  ["story", "Save this story as a lorebook", "the people, places, threads and beliefs this chat has built"],
  ["check", "Check a lorebook", "how the Almanac reads it, and what Lumiverse will do with it"],
];
const OP_LABEL: Record<string, string> = { create: "new", update: "rewrite", convert: "convert", retire: "switch off", keep: "keep" };
const CAT_LABEL = new Map(CATEGORIES.map((c) => [c.id, c.label]));

/** Plain text to HTML: paragraphs, line breaks and **bold**, nothing else. */
function prose(s: string): string {
  return e(s).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")}</p>`).join("");
}

export class CreatorUI {
  ctx: SpindleFrontendContext;
  getView: () => any;
  rerender: () => void;
  session: any = null;
  list: { id: string; title: string; updatedAt: number; task?: string }[] = [];
  books: { id: string; name: string; kind?: string }[] | null = null;
  bookFilter = "";
  composer = "";
  /** Plan filter: a category id, or "" for all; and whether kept entries show. */
  planCat = "";
  showKept = false;
  activation: any[] | null = null;
  scene = "";
  error = "";
  opening = false;
  showHistory = false;
  /** After a save, the save panel comes back only when asked (a second "new book" would be a copy). */
  saveAgain = false;
  private seen = 0;
  private rid = 0;
  private pending = new Map<number, (m: any) => void>();
  private composerFocus: { start: number; end: number } | null = null;
  private logAtBottom = true;

  constructor(ctx: SpindleFrontendContext, getView: () => any, rerender: () => void) {
    this.ctx = ctx;
    this.getView = getView;
    this.rerender = rerender;
  }

  handle(m: any): boolean {
    if (m?.type === "creatorSession") {
      this.session = m.session;
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
          resolve({ error: "the Almanac didn't answer in time" });
        }
      }, 20 * 60_000);
    });
  }

  /** A creator request; the session itself comes back as a push. */
  private async act(action: string, req: Record<string, unknown> = {}): Promise<any> {
    this.error = "";
    const r = await this.call({ type: "creator", action, req: { id: this.session?.id, ...req } });
    if (r?.error) {
      this.error = String(r.error);
      this.rerender();
    }
    if (r?.session !== undefined) this.session = r.session;
    if (r?.list) this.list = r.list;
    if (r?.session !== undefined || r?.list) this.rerender();
    return r;
  }

  private ensureOpen() {
    if (this.session || this.opening) return;
    this.opening = true;
    this.act("open").finally(() => {
      this.opening = false;
    });
  }

  private async loadBooks() {
    const r = await this.call({ type: "books" });
    this.books = r.books ?? [];
    this.rerender();
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  render(v: any): string {
    this.ensureOpen();
    const s = this.session;
    const head = this.renderHead(v);
    if (!s) return `${head}<div class="empty">Opening the creator…</div>`;
    const latestPlan = [...s.messages].reverse().find((m: any) => m.card === "proposal")?.id;
    const latestResult = [...s.messages].reverse().find((m: any) => m.card === "result")?.id;
    const lastBooks = [...s.messages].reverse().find((m: any) => m.card === "books" || m.card === "tasks")?.id;
    const lastAlmanac = [...s.messages].reverse().find((m: any) => m.role === "almanac")?.id;
    const log = s.messages.map((m: any) => this.renderMessage(m, s, { latestPlan, latestResult, lastBooks, lastAlmanac })).join("");
    const busy = s.busy ? `<div class="almcr-msg almanac busy"><div class="almcr-who">Almanac</div><div class="almcr-bubble"><span class="almcr-dots"><i></i><i></i><i></i></span> ${e(s.busy)}${s.progress ? ` <small class="muted">${s.progress.done}/${s.progress.total}</small>` : ""}</div></div>` : "";
    const err = this.error ? `<div class="alm-tag warn">${e(this.error)}</div>` : "";
    return `${head}<div class="almcr"><div class="almcr-log" id="almCrLog">${log}${busy}</div>${err}${this.renderComposer(s)}</div>`;
  }

  private renderHead(v: any): string {
    const s = this.session;
    const list: any[] | null = v?.connections ?? null;
    const cur = String(v?.settings?.creatorConnection ?? "");
    const conn = list
      ? `<select data-setting="creatorConnection" title="The model the creator talks and writes with"><option value=""${cur ? "" : " selected"}>the summariser's connection</option>${list.map((c: any) => `<option value="${e(c.id)}"${c.id === cur ? " selected" : ""}>${e(c.name)}${c.model ? ` — ${e(c.model)}` : ""}</option>`).join("")}</select>`
      : "";
    const hist = this.showHistory
      ? `<div class="card flat almcr-hist">${this.list.length ? this.list.map((x) => `<div class="row"><button class="btn${x.id === s?.id ? " primary" : ""} grow" data-cr-act="switch" data-id="${e(x.id)}">${e(x.title)}</button><small class="muted">${e(new Date(x.updatedAt).toLocaleDateString())}</small><button class="btn danger" data-cr-act="delete" data-id="${e(x.id)}" title="Delete this conversation (your lorebooks are untouched)">✕</button></div>`).join("") : `<div class="muted">No earlier conversations.</div>`}</div>`
      : "";
    return `<div class="almcr-head"><div class="grow"><b>${e(s?.title ?? "Lorebook Creator")}</b><div class="muted"><small>Talk it through; nothing is written until you accept a plan, and nothing is saved until you say where.</small></div></div>${conn ? `<label class="almcr-model">Model ${conn}</label>` : ""}<button class="btn" data-cr-act="history">${this.showHistory ? "Hide" : "Conversations"}</button><button class="btn" data-cr-act="new">New conversation</button></div>${hist}`;
  }

  private renderMessage(m: any, s: any, latest: { latestPlan?: string; latestResult?: string; lastBooks?: string; lastAlmanac?: string }): string {
    if (m.role === "user") return `<div class="almcr-msg user"><div class="almcr-bubble">${prose(m.text)}</div></div>`;
    const live = !s.busy;
    let card = "";
    if (m.card === "tasks" && m.id === latest.lastBooks && !s.task) card = this.renderTasks();
    else if (m.card === "books" && m.id === latest.lastBooks && !s.book) card = this.renderBooks();
    else if (m.card === "proposal" && s.proposal) card = m.id === latest.latestPlan ? this.renderProposal(s, live) : `<div class="muted almcr-old"><small>Plan version ${m.version ?? "?"}: superseded below.</small></div>`;
    else if (m.card === "result" && s.draft) card = m.id === latest.latestResult ? this.renderDraft(s, live) : `<div class="muted almcr-old"><small>Earlier draft, written again below.</small></div>`;
    else if (m.card === "report" && s.report) card = this.renderReport(s.report);
    // Offered replies only on the latest message: older ones answered a question that has moved on.
    const opts = m.options?.length && live && m.id === latest.lastAlmanac ? `<div class="almcr-opts">${m.options.map((o: string) => `<button class="pill" data-cr-act="say" data-text="${e(o)}">${e(o)}</button>`).join("")}</div>` : "";
    return `<div class="almcr-msg almanac${m.card === "error" ? " error" : ""}"><div class="almcr-who">Almanac</div><div class="almcr-bubble">${prose(m.text)}${card}${opts}</div></div>`;
  }

  private renderTasks(): string {
    return `<div class="almcr-tasks">${TASKS.map(([id, label, blurb]) => `<button class="almcr-task" data-cr-act="task" data-task="${id}"><b>${e(label)}</b><small>${e(blurb)}</small></button>`).join("")}</div>`;
  }

  private renderBooks(): string {
    if (!this.books) {
      queueMicrotask(() => this.loadBooks());
      return `<div class="muted">Loading your lorebooks…</div>`;
    }
    const f = this.bookFilter.toLowerCase();
    const mine = this.books.filter((b) => !b.kind && (!f || b.name.toLowerCase().includes(f)));
    const other = this.books.filter((b) => b.kind && (!f || b.name.toLowerCase().includes(f)));
    const btn = (b: any) => `<button class="almcr-book" data-cr-act="book" data-id="${e(b.id)}">${e(b.name)}${b.kind === "weaver" ? ` <small class="muted">Dream Weaver</small>` : ""}</button>`;
    return `<div class="almcr-books"><input type="text" data-cr="bookFilter" value="${e(this.bookFilter)}" placeholder="Find a lorebook…">
<div class="almcr-booklist">${mine.map(btn).join("") || `<div class="muted">No lorebooks match.</div>`}</div>
${other.length ? `<details><summary class="muted"><small>${other.length} more: Dream Weaver books, and books other memory extensions write for their chats</small></summary><div class="almcr-booklist">${other.map(btn).join("")}</div></details>` : ""}</div>`;
  }

  private renderProposal(s: any, live: boolean): string {
    const p = s.proposal;
    const counts: Record<string, number> = {};
    for (const it of p.items) counts[it.op] = (counts[it.op] ?? 0) + 1;
    const cats = [...new Set(p.items.map((i: any) => i.category))] as string[];
    const shown = p.items.filter((i: any) => (!this.planCat || i.category === this.planCat) && (this.showKept || i.op !== "keep"));
    const fresh = (it: any) => (it.v ?? 0) >= p.version && p.version > 1;
    const catSel = (it: any) => `<select data-cr-item="${e(it.id)}" data-field="category" ${live ? "" : "disabled"}>${CATEGORIES.map((c) => `<option value="${c.id}"${c.id === it.category ? " selected" : ""}>${e(c.label)}</option>`).join("")}</select>`;
    // A conversion that keeps the book's titles changes only metadata and tiers: show the titles as they stay.
    const keepTitles = s.task === "convert" && p.options.titles === "keep";
    const row = (it: any) => `<div class="almcr-item op-${e(it.op)}${fresh(it) ? " fresh" : ""}">
<div class="row"><span class="pill op">${e(OP_LABEL[it.op] ?? it.op)}</span>${it.op === "keep" || it.op === "retire" ? `<b class="grow">${e(it.title)}</b>` : keepTitles && it.was ? `${catSel(it)}<b class="grow">${e(it.was)}</b>` : `${catSel(it)}<input type="text" class="grow" data-cr-item="${e(it.id)}" data-field="title" value="${e(it.title)}"${live ? "" : " disabled"}>`}${it.confidence != null && it.confidence < 0.55 ? `<span class="pill warn" title="The reading was a weak guess: check the category">check</span>` : ""}${live ? (it.op === "keep" ? `<button class="btn" data-cr-act="itemOp" data-id="${e(it.id)}" data-op="${it.entryId && s.task === "convert" ? "convert" : "create"}" title="Change it after all">↺</button>` : `<button class="btn" data-cr-act="drop" data-id="${e(it.id)}" title="${it.entryId ? "Leave this entry as it is" : "Remove from the plan"}">✕</button>`) : ""}</div>
${it.was && it.was !== it.title && !keepTitles ? `<div class="muted"><small>was: ${e(it.was)}</small></div>` : ""}${it.about ? `<div class="almcr-about"><small>${e(it.about)}</small></div>` : ""}${it.changes?.length ? `<div class="muted"><small>changes: ${e((keepTitles ? it.changes.filter((c: string) => c !== "title") : it.changes).join(" · "))}</small></div>` : ""}${it.reason ? `<label class="chk"><input type="checkbox" data-cr-item="${e(it.id)}" data-field="rewrite"${it.rewrite ? " checked" : ""}${live ? "" : " disabled"}> rewrite its opening <small class="muted">(${e(it.reason)})</small></label>` : ""}</div>`;
    const optsRow = s.task === "convert"
      ? `<div class="row almcr-planopts"><label class="chk"><input type="checkbox" data-cr-opt="titles"${p.options.titles === "label" ? " checked" : ""}${live ? "" : " disabled"}> category labels in titles</label><label class="chk"><input type="checkbox" data-cr-opt="tiers"${p.options.tiers ? " checked" : ""}${live ? "" : " disabled"}> real tiers for priority-10 entries</label></div>`
      : "";
    const writes = p.items.filter((i: any) => i.op !== "keep").length;
    return `<div class="almcr-plan"><div class="almcr-planhead"><b>Plan · version ${p.version}</b> <span class="muted">${Object.entries(counts).map(([k, n]) => `${n} ${e(OP_LABEL[k] ?? k)}`).join(" · ")}</span></div>
${p.summary ? `<div class="muted">${e(p.summary)}</div>` : ""}
<label class="f">Book name<input type="text" data-cr-plan="bookName" value="${e(p.bookName)}"${live ? "" : " disabled"}></label>${optsRow}
<div class="almcr-filter"><button class="pill${this.planCat ? "" : " on"}" data-cr-act="planCat" data-cat="">all</button>${cats.map((c) => `<button class="pill${this.planCat === c ? " on" : ""}" data-cr-act="planCat" data-cat="${e(c)}">${e(CAT_LABEL.get(c) ?? c)} ${p.items.filter((i: any) => i.category === c).length}</button>`).join("")}${counts.keep ? `<label class="chk"><input type="checkbox" data-cr="showKept"${this.showKept ? " checked" : ""}> show the ${counts.keep} kept as they are</label>` : ""}</div>
<div class="almcr-items">${shown.map(row).join("") || `<div class="muted">Nothing here.</div>`}</div>
${p.dropped?.length ? `<details><summary class="muted"><small>Removed: ${p.dropped.length}</small></summary>${p.dropped.map((d: any) => `<div class="almcr-item dropped"><s>${e(d.title)}</s></div>`).join("")}</details>` : ""}
${live && s.phase !== "generating" ? `<div class="row almcr-planbtns"><button class="btn primary" data-cr-act="accept"${writes ? "" : " disabled"}>${s.draft && s.draft.forVersion < p.version ? `Write the changes (v${p.version})` : s.draft ? "Write again" : `Accept and ${s.task === "convert" ? "convert" : "write"} ${writes} entr${writes === 1 ? "y" : "ies"}`}</button><button class="btn" data-cr-act="revise">Ask for changes…</button></div>` : ""}</div>`;
  }

  private renderReport(r: any): string {
    const sev = (x: string) => (x === "error" ? "due" : "");
    return `<div class="almcr-report"><div class="kv"><b>Read exactly</b><span>${r.reading.exact}</span><b>By shape</b><span>${r.reading.read}</span><b>Unsure</b><span>${r.reading.unsure}</span><b>Constant</b><span>${r.constantTokens} tokens a turn</span></div>
<ul class="alm-list">${r.issues.slice(0, 40).map((i: any) => `<li class="${sev(i.severity)}">${e(i.entry)}: ${e(i.issue)}</li>`).join("") || "<li>No issues found.</li>"}</ul></div>`;
  }

  private renderDraft(s: any, live: boolean): string {
    const d = s.draft;
    const rep = d.report;
    const stale = s.proposal && d.forVersion < s.proposal.version;
    const same = !!s.book && (s.task === "update" || s.task === "convert");
    const entry = (en: any) => `<details class="almcr-entry${d.issues[en.uid] ? " flagged" : ""}${en.op === "retire" ? " retired" : ""}"><summary><b>${e(en.comment)}</b> <span class="pill">${en.op === "retire" ? "switch off" : en.entryId ? (s.task === "convert" ? "converted" : "rewritten") : "new"}</span> <span class="pill">P${en.priority}</span> <span class="pill">pos ${en.position}${en.position === 4 ? "@" + en.depth : ""}</span>${en.constant ? `<span class="pill">const</span>` : ""}${d.issues[en.uid] ? `<span class="pill warn">${d.issues[en.uid].length} note${d.issues[en.uid].length === 1 ? "" : "s"}</span>` : ""}</summary>
${en.op === "retire" ? `<div class="muted">This entry will be switched off (kept in the book, disabled).</div>` : `<label class="f">Title<input type="text" data-cr-entry="${en.uid}" data-field="comment" value="${e(en.comment)}"${live ? "" : " disabled"}></label><textarea data-cr-entry="${en.uid}" data-field="content"${live ? "" : " disabled"}>${e(en.content)}</textarea><label class="f">Keys<input type="text" data-cr-entry="${en.uid}" data-field="key" value="${e(en.key.join(", "))}"${live ? "" : " disabled"}></label>`}
${d.issues[en.uid] ? `<div class="alm-tag warn">${e(d.issues[en.uid].join(" · "))}</div>` : ""}${d.fixes[en.uid] ? `<div class="muted"><small>fixed: ${e(d.fixes[en.uid].join(" · "))}</small></div>` : ""}
${live && en.op !== "retire" ? `<div class="row"><input type="text" class="grow" id="almCrNote${en.uid}" placeholder="What should change? (blank: fix its notes)"><button class="btn" data-cr-act="rewrite" data-uid="${en.uid}">Rewrite</button><button class="btn danger" data-cr-act="dropEntry" data-uid="${en.uid}">Remove</button></div>` : ""}</details>`;
    return `<div class="almcr-draft">${stale ? `<div class="alm-tag warn">The plan changed since these were written (v${d.forVersion} → v${s.proposal.version}). Accept the plan again to write the changes.</div>` : ""}
<div class="kv"><b>Entries</b><span>${d.entries.length}</span><b>Tokens</b><span>${rep.totalTokens} total · ${rep.constantTokens} constant per turn</span><b>Positions</b><span>${Object.entries(rep.positions).map(([k, n]) => `${e(k)}: ${n}`).join(" · ")}</span><b>Links</b><span>${rep.link.edges.length} recursion links · ${rep.link.orphans.length} orphans · ${rep.link.loops.length} loops</span></div>
${rep.link.mismatches.length ? `<div class="alm-tag warn">${e(rep.link.mismatches.slice(0, 3).join(" · "))}</div>` : ""}${rep.link.suggestions.slice(0, 4).map((x: string) => `<div class="muted"><small>• ${e(x)}</small></div>`).join("")}
<div class="almcr-entries">${d.entries.map(entry).join("")}</div>
<details class="almcr-sim"><summary class="muted">Activation check: paste a scene to see what fires</summary><textarea data-cr="scene" placeholder="A sample scene…">${e(this.scene)}</textarea><button class="btn" data-cr-act="simulate">Check</button>${this.activation ? `<ul class="alm-list">${this.activation.map((a: any) => `<li>${e(a.comment)} — <small class="muted">${e(a.reason)}</small></li>`).join("") || "<li>Nothing fires.</li>"}</ul>` : ""}</details>
${live && s.phase === "saved" && !this.saveAgain ? `<div class="row"><span class="grow muted"><small>Saved to ${e(s.saved?.bookName ?? "the book")}.</small></span><button class="btn" data-cr-act="saveAgain">Save again…</button></div>` : ""}
${live && (s.phase !== "saved" || this.saveAgain) ? `<div class="almcr-save"><h4>Save</h4>
<div class="row">${same ? `<label class="chk"><input type="radio" name="almCrTarget" value="same" checked> into ${e(s.book.name)}</label><label class="chk"><input type="radio" name="almCrTarget" value="new"> as a new book (a copy)</label>` : ""}</div>
<div class="row"><input type="text" id="almCrName" class="grow" value="${e(s.proposal?.bookName ?? "")}" placeholder="New lorebook name" title="The name for a new book"${same ? " disabled" : ""}><select id="almCrAttach"><option value="none">don't attach</option><option value="character">attach to the character</option><option value="persona">attach to the persona</option><option value="chat">attach to this chat</option><option value="global">attach globally</option></select></div>
<label class="chk"><input type="checkbox" id="almCrBridge" checked> Read it into this chat's Codex now (Lore Bridge)</label>
<div class="row"><button class="btn primary" data-cr-act="save">Save</button><button class="btn" data-cr-act="export">Download JSON</button></div></div>` : ""}</div>`;
  }

  private renderComposer(s: any): string {
    const ph = !s.task ? "Tell the Almanac what you'd like to make…" : s.phase === "review" ? "Ask about the entries, or ask for a different plan…" : s.proposal ? "Ask for changes to the plan, or say it's right…" : "Answer, or paste notes and lore (long text is kept as a source)…";
    const src = s.sources?.length ? `<div class="almcr-sources">${s.sources.map((x: any) => `<span class="pill" title="${e(x.text.slice(0, 300))}">📎 ${e(x.label)} <small>${Math.round(x.text.length / 100) / 10}k</small><button class="almcr-x" data-cr-act="dropSource" data-id="${e(x.id)}" title="Remove this source">✕</button></span>`).join("")}</div>` : "";
    return `<div class="almcr-compose">${src}<textarea id="almCrInput" data-cr-compose="1" placeholder="${e(ph)}"${s.busy ? " disabled" : ""}>${e(this.composer)}</textarea><div class="row"><button class="btn" data-cr-act="source" data-src="card" title="Add this chat's character card as a source">+ character card</button><button class="btn" data-cr-act="source" data-src="persona" title="Add your persona as a source">+ persona</button><span class="grow muted"><small>Enter sends · Shift+Enter for a new line</small></span><button class="btn primary" data-cr-act="send"${s.busy ? " disabled" : ""}>Send</button></div></div>`;
  }

  /** After the page is drawn: keep the composer's text, focus and caret, and follow the conversation down. */
  afterRender(root: HTMLElement) {
    const log = root.querySelector("#almCrLog") as HTMLElement | null;
    const count = this.session?.messages?.length ?? 0;
    if (log && (count !== this.seen || this.logAtBottom)) log.scrollTop = log.scrollHeight;
    // A new message: bring the message box into view too (the page may have scrolled above it).
    if (count !== this.seen && this.seen) (root.querySelector(".almcr-compose") as HTMLElement | null)?.scrollIntoView?.({ block: "nearest" });
    this.seen = count;
    log?.addEventListener("scroll", () => {
      this.logAtBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    });
    const input = root.querySelector("#almCrInput") as HTMLTextAreaElement | null;
    if (input && this.composerFocus && !input.disabled) {
      input.focus();
      input.setSelectionRange(this.composerFocus.start, this.composerFocus.end);
    }
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  onInput(t: HTMLInputElement): boolean {
    if (t.dataset?.crCompose) {
      this.composer = t.value;
      this.composerFocus = { start: t.selectionStart ?? t.value.length, end: t.selectionEnd ?? t.value.length };
      return true;
    }
    if (t.dataset?.cr === "bookFilter") {
      this.bookFilter = t.value;
      const list = t.closest(".almcr-books")?.querySelectorAll(".almcr-book") ?? [];
      const f = t.value.toLowerCase();
      list.forEach((b) => ((b as HTMLElement).style.display = !f || (b.textContent ?? "").toLowerCase().includes(f) ? "" : "none"));
      return true;
    }
    return false;
  }

  onFocus(t: HTMLElement, focused: boolean) {
    if ((t as HTMLTextAreaElement).dataset?.crCompose) {
      const ta = t as HTMLTextAreaElement;
      this.composerFocus = focused ? { start: ta.selectionStart ?? 0, end: ta.selectionEnd ?? 0 } : null;
    }
  }

  onKeydown(ev: KeyboardEvent): boolean {
    const t = ev.target as HTMLTextAreaElement;
    if (!t?.dataset?.crCompose) return false;
    if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) {
      ev.preventDefault();
      this.send();
      return true;
    }
    return false;
  }

  private send(text?: string) {
    const msg = (text ?? this.composer).trim();
    if (!msg || this.session?.busy) return;
    if (text == null) this.composer = "";
    this.act("send", { text: msg });
  }

  onChange(t: HTMLInputElement): boolean {
    const d = t.dataset;
    if (t.name === "almCrTarget") {
      // The name is for a new book only.
      const name = t.closest(".almcr-save")?.querySelector("#almCrName") as HTMLInputElement | null;
      if (name) name.disabled = t.value === "same";
      return true;
    }
    if (d.cr === "showKept") {
      this.showKept = t.checked;
      this.rerender();
      return true;
    }
    if (d.cr === "scene") {
      this.scene = t.value;
      return true;
    }
    if (d.cr === "bookFilter") return true;
    if (d.crItem) {
      const field = d.field!;
      const value = field === "rewrite" ? t.checked : t.value;
      this.act("edit", { revision: { change: [{ id: d.crItem, [field]: value }] } });
      return true;
    }
    if (d.crOpt) {
      const opt = d.crOpt === "titles" ? { titles: t.checked ? "label" : "keep" } : { tiers: t.checked };
      this.act("edit", { revision: { options: opt } });
      return true;
    }
    if (d.crPlan === "bookName") {
      this.act("edit", { revision: { bookName: t.value } });
      return true;
    }
    if (d.crEntry != null) {
      const field = d.field!;
      const value = field === "key" ? t.value.split(",").map((x) => x.trim()).filter(Boolean) : t.value;
      this.act("entry", { uid: Number(d.crEntry), patch: { [field]: value } });
      return true;
    }
    return false;
  }

  onClick(t: HTMLElement): boolean {
    const el = t.closest("[data-cr-act]") as HTMLElement | null;
    if (!el) return false;
    const act = el.dataset.crAct;
    const root = el.closest(".almp") as HTMLElement;
    switch (act) {
      case "new":
        this.activation = null;
        this.saveAgain = false;
        this.planCat = "";
        this.act("new");
        break;
      case "history":
        this.showHistory = !this.showHistory;
        if (this.showHistory) this.act("list");
        else this.rerender();
        break;
      case "switch":
        this.showHistory = false;
        this.activation = null;
        this.saveAgain = false;
        this.act("open", { id: el.dataset.id });
        break;
      case "delete":
        ask(this.ctx, { title: "Delete this conversation?", message: "Its plan and draft go; lorebooks you saved from it stay.", confirmLabel: "Delete", cancelLabel: "Keep", danger: true }).then((ok) => {
          if (ok) this.act("delete", { id: el.dataset.id });
        });
        break;
      case "task":
        this.act("task", { task: el.dataset.task });
        break;
      case "book":
        this.act("book", { bookId: el.dataset.id });
        break;
      case "say":
        this.send(el.dataset.text ?? "");
        break;
      case "send":
        this.send();
        break;
      case "source":
        this.act("source", { source: el.dataset.src });
        break;
      case "dropSource":
        this.act("dropSource", { sourceId: el.dataset.id });
        break;
      case "planCat":
        this.planCat = el.dataset.cat ?? "";
        this.rerender();
        break;
      case "drop": {
        const it = this.session?.proposal?.items.find((i: any) => i.id === el.dataset.id);
        // An existing entry is left as it is; a new one leaves the plan.
        this.act("edit", { revision: it?.entryId && this.session?.task === "convert" ? { change: [{ id: el.dataset.id, op: "keep" }] } : { drop: [el.dataset.id] } });
        break;
      }
      case "itemOp":
        this.act("edit", { revision: { change: [{ id: el.dataset.id, op: el.dataset.op }] } });
        break;
      case "accept":
        this.act("accept");
        break;
      case "revise": {
        const input = root?.querySelector("#almCrInput") as HTMLTextAreaElement | null;
        input?.focus();
        break;
      }
      case "rewrite": {
        const note = (root?.querySelector(`#almCrNote${el.dataset.uid}`) as HTMLInputElement | null)?.value ?? "";
        this.act("rewrite", { uid: Number(el.dataset.uid), note });
        break;
      }
      case "dropEntry":
        this.act("dropEntry", { uid: Number(el.dataset.uid) });
        break;
      case "simulate":
        this.act("simulate", { scene: this.scene }).then((r) => {
          this.activation = r?.activation ?? [];
          this.rerender();
        });
        break;
      case "saveAgain":
        this.saveAgain = true;
        this.rerender();
        break;
      case "export":
        this.act("export").then((r) => {
          if (!r?.json) return;
          const blob = new Blob([JSON.stringify(r.json, null, 2)], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `${String(r.name || "almanac-lorebook").replace(/[^\w .-]+/g, "_")}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        });
        break;
      case "save": {
        const s = this.session;
        const target = ((root?.querySelector('input[name="almCrTarget"]:checked') as HTMLInputElement | null)?.value ?? "new") as "new" | "same";
        const name = (root?.querySelector("#almCrName") as HTMLInputElement | null)?.value || s?.proposal?.bookName || "ALMANAC lorebook";
        const attach = (root?.querySelector("#almCrAttach") as HTMLSelectElement | null)?.value || "none";
        const bridge = !!(root?.querySelector("#almCrBridge") as HTMLInputElement | null)?.checked;
        (async () => {
          if (target === "same") {
            const n = s?.draft?.entries.length ?? 0;
            const ok = await ask(this.ctx, { title: `Write ${n} change${n === 1 ? "" : "s"} into ${s?.book?.name}?`, message: "Entries are changed in place (entries you retire are switched off, not deleted). Lumiverse keeps no copy of the old text; save as a new book instead to keep the original untouched.", confirmLabel: "Write them", cancelLabel: "Not yet", danger: true });
            if (!ok) return;
          }
          const replacePersonaBook = attach === "persona"
            ? await ask(this.ctx, { title: "Replace your persona's lorebook?", message: "A persona holds one lorebook. If yours already has one, attaching this book takes its place. Choose Keep to leave the current one attached.", confirmLabel: "Replace it", cancelLabel: "Keep it", danger: true })
            : false;
          this.saveAgain = false;
          this.act("save", { save: { target, name, attach, bridge, replacePersonaBook } });
        })();
        break;
      }
    }
    return true;
  }
}
