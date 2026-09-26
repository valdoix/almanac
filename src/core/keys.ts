// Retrieval keys: tracker keys become a real index. Hygiene rules keep keys
// concrete; an Aho-Corasick automaton matches every key and alias in one pass
// (whole-word, case-folded, possessive-tolerant).

import type { CodexRecord } from "./codex";

export const DEFAULT_STOP = new Set(
  ("sword house door night day room man woman people thing time way hand eyes face voice head world life place " +
    "love hate fear betrayal trust hope anger power truth death friend enemy story something nothing everything " +
    "said says went came look looked back still just now then there here this that with from into onto they them")
    .split(/\s+/),
);

const ABSTRACT = /^(love|hate|fear|betrayal|trust|hope|anger|sadness|joy|grief|loyalty|honou?r|revenge|justice|freedom|destiny|fate|power|truth)$/;

export function cleanKeys(keys: string[], opts: { name: string; aliases?: string[]; castNames?: string[]; stop?: Set<string>; max?: number }): string[] {
  const stop = opts.stop ?? DEFAULT_STOP;
  const own = new Set([opts.name, ...(opts.aliases ?? [])].map((s) => s.toLowerCase()));
  const cast = new Set((opts.castNames ?? []).map((s) => s.toLowerCase()));
  const out: string[] = [];
  for (const raw of keys) {
    const k = raw.toLowerCase().replace(/[^\p{L}\p{N}' -]/gu, "").replace(/\s+/g, " ").trim();
    if (!k || k.length < 3) continue;
    if (k.split(" ").length > 2) continue;
    if (stop.has(k) || ABSTRACT.test(k)) continue;
    if (own.has(k) || cast.has(k)) continue;
    if (!out.includes(k)) out.push(k);
  }
  return out.slice(0, opts.max ?? 12);
}

interface Pattern {
  text: string;
  recordId: string;
  isName: boolean;
}

interface Node {
  next: Map<string, number>;
  fail: number;
  out: number[];
}

export interface KeyHit {
  recordId: string;
  key: string;
  isName: boolean;
  segment: string;
  count: number;
}

export class KeyIndex {
  private nodes: Node[] = [{ next: new Map(), fail: 0, out: [] }];
  private patterns: Pattern[] = [];

  constructor(records: CodexRecord[]) {
    for (const r of records) {
      const names = [r.name, ...r.aliases].filter((n) => n && n.length >= 2 && n.length <= 60);
      if (r.kind === "person" || r.kind === "place" || r.kind === "object" || r.kind === "group" || r.kind === "document" || r.kind === "thread") {
        for (const n of names) this.add(n.toLowerCase(), r.id, true);
        // First names retrieve people too ("Mara" for "Mara Voss").
        if ((r.kind === "object" || r.kind === "place" || r.kind === "document") && r.name.includes(" ")) {
          const head = r.name.toLowerCase().replace(/^the\s+/, "").split(/\s+/).pop()!;
          if (head.length > 3 && !DEFAULT_STOP.has(head)) this.add(head, r.id, false);
        }
        if (r.kind === "person") {
          const first = r.name.split(/\s+/)[0];
          if (first && first.length > 2 && first !== r.name) this.add(first.toLowerCase(), r.id, true);
        }
      }
      for (const k of r.keys) this.add(k.toLowerCase(), r.id, false);
    }
    this.build();
  }

  private add(text: string, recordId: string, isName: boolean) {
    const t = text.trim();
    if (!t) return;
    let s = 0;
    for (const ch of t) {
      let nx = this.nodes[s].next.get(ch);
      if (nx == null) {
        nx = this.nodes.length;
        this.nodes.push({ next: new Map(), fail: 0, out: [] });
        this.nodes[s].next.set(ch, nx);
      }
      s = nx;
    }
    this.nodes[s].out.push(this.patterns.length);
    this.patterns.push({ text: t, recordId, isName });
  }

  private build() {
    const q: number[] = [];
    for (const [, n] of this.nodes[0].next) {
      this.nodes[n].fail = 0;
      q.push(n);
    }
    while (q.length) {
      const r = q.shift()!;
      for (const [ch, u] of this.nodes[r].next) {
        q.push(u);
        let f = this.nodes[r].fail;
        while (f && !this.nodes[f].next.has(ch)) f = this.nodes[f].fail;
        const nf = this.nodes[f].next.get(ch);
        this.nodes[u].fail = nf != null && nf !== u ? nf : 0;
        this.nodes[u].out.push(...this.nodes[this.nodes[u].fail].out);
      }
    }
  }

  /** Find every whole-word hit in `text`. */
  match(text: string, segment = "text"): KeyHit[] {
    const lower = text.toLowerCase();
    const chars = [...lower];
    const hits = new Map<string, KeyHit>();
    let s = 0;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      while (s && !this.nodes[s].next.has(ch)) s = this.nodes[s].fail;
      s = this.nodes[s].next.get(ch) ?? 0;
      for (const pi of this.nodes[s].out) {
        const p = this.patterns[pi];
        const len = [...p.text].length;
        const start = i - len + 1;
        const before = start > 0 ? chars[start - 1] : " ";
        // possessive / plural tolerance: "mara's", "lockets"
        let j = i + 1;
        if ((chars[j] === "'" || chars[j] === "’") && chars[j + 1] === "s") j += 2;
        else if (chars[j] === "s" && !/[\p{L}\p{N}]/u.test(chars[j + 1] ?? " ")) j += 1;
        const after = chars[j] ?? " ";
        if (/[\p{L}\p{N}]/u.test(before) || /[\p{L}\p{N}]/u.test(after)) continue;
        const k = `${p.recordId}|${p.text}`;
        const h = hits.get(k);
        if (h) h.count++;
        else hits.set(k, { recordId: p.recordId, key: p.text, isName: p.isName, segment, count: 1 });
      }
    }
    return [...hits.values()];
  }
}

/** Key heat: fires vs. used. A key that fires 3× without its record being used is demoted. */
export interface KeyHeat {
  fires: number;
  used: number;
  demoted?: boolean;
}

export function updateHeat(heat: Record<string, KeyHeat>, fired: string[], used: Set<string>): Record<string, KeyHeat> {
  for (const k of fired) {
    const [rid] = k.split("|");
    const h = (heat[k] ??= { fires: 0, used: 0 });
    h.fires++;
    if (used.has(rid)) h.used++;
    h.demoted = h.fires - h.used >= 3 && h.used / h.fires < 0.25;
  }
  return heat;
}
