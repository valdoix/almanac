// Branch-correct folding. The chat itself is the event log: every stored reply
// keeps its <ledger>, so the accepted state is simply "fold the ledgers on the
// active path" (each message with its current swipe). Swipes, edits, deletes and
// forks are correct by construction. Extension-authored events (repairs, user
// edits, engine/sim ops) are stored separately, keyed to msgId + swipe, and are
// folded only when their message+swipe is on the path.

import { parseMessage } from "./dsl";
import { Folder, type FoldOptions } from "./state";
import type { EventSource, LedgerEvent, OpName, ParsedLedger, ParsedOp, WorldState } from "./types";
import { deepClone, hash } from "./util";

export interface PathMessage {
  id: string;
  index: number;
  isUser: boolean;
  name?: string;
  content: string;
  swipe: number;
  hidden?: boolean;
}

/** Events the extension authored for a message+swipe. */
export interface SideEvents {
  source: EventSource;
  ops: ParsedOp[];
  /** When set, these ops replace the message's own ledger (repair of a missing/broken block). */
  replaces?: boolean;
  /** When set, these ops replace only the message's own lines of these kinds (the knowledge clerk). */
  replacesOps?: OpName[];
  /** The message text they were written for; after an edit they no longer apply. */
  hash?: string;
}

export type SideEventStore = Record<string, SideEvents[]>; // key: `${msgId}:${swipe}`

export function sideKey(msgId: string, swipe: number): string {
  return `${msgId}:${swipe}`;
}

export interface RawChatMessage {
  id: string;
  index_in_chat?: number;
  is_user?: boolean;
  role?: string;
  name?: string;
  content?: string;
  swipe_id?: number;
  swipes?: string[];
  extra?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function toPath(messages: RawChatMessage[]): PathMessage[] {
  return messages
    .map((m, i) => {
      const swipe = typeof m.swipe_id === "number" ? m.swipe_id : 0;
      const content = Array.isArray(m.swipes) && m.swipes[swipe] != null ? String(m.swipes[swipe]) : String(m.content ?? "");
      const isUser = m.is_user ?? m.role === "user";
      const hidden = !!(m.extra && ((m.extra as any).hidden || (m.extra as any).is_hidden));
      return { id: m.id, index: typeof m.index_in_chat === "number" ? m.index_in_chat : i, isUser: !!isUser, name: m.name, content, swipe, hidden };
    })
    .sort((a, b) => a.index - b.index);
}

interface Snapshot {
  chain: string;
  pos: number; // number of messages folded
  state: WorldState;
}

export interface FoldResult {
  state: WorldState;
  events: LedgerEvent[];
  /** chain hash after each message, aligned with the path */
  chain: string[];
}

/**
 * Keeps parse results and prefix snapshots so a swipe or edit near the end of
 * a long chat re-folds only the tail.
 */
export class LedgerRuntime {
  private parseCache = new Map<string, ParsedLedger>();
  private snapshots: Snapshot[] = [];
  static SNAP_EVERY = 25;

  parse(content: string): ParsedLedger {
    const k = hash(content) + ":" + content.length;
    let p = this.parseCache.get(k);
    if (!p) {
      p = parseMessage(content);
      this.parseCache.set(k, p);
      if (this.parseCache.size > 4000) this.parseCache.delete(this.parseCache.keys().next().value!);
    }
    return p;
  }

  invalidate() {
    this.snapshots = [];
  }

  /**
   * Fold the path. `upTo` (exclusive) limits folding to a prefix — used to
   * render the state *as of* an older message.
   */
  fold(path: PathMessage[], opts: FoldOptions, side: SideEventStore = {}, upTo = path.length): FoldResult {
    const optsKey = hash(JSON.stringify(opts));
    const chain: string[] = [];
    let acc = optsKey;
    for (let i = 0; i < upTo; i++) {
      const m = path[i];
      const sk = sideKey(m.id, m.swipe);
      acc = hash(`${acc}|${m.id}:${m.swipe}:${hash(m.content)}:${side[sk] ? hash(JSON.stringify(side[sk])) : ""}`);
      chain.push(acc);
    }
    // Find the deepest valid snapshot.
    let start = 0;
    let state: WorldState | undefined;
    for (let s = this.snapshots.length - 1; s >= 0; s--) {
      const snap = this.snapshots[s];
      if (snap.pos <= upTo && snap.pos > 0 && chain[snap.pos - 1] === snap.chain) {
        start = snap.pos;
        state = deepClone(snap.state);
        break;
      }
    }
    const folder = new Folder(opts, state);
    const events: LedgerEvent[] = [];
    for (let i = start; i < upTo; i++) {
      const m = path[i];
      const sides = side[sideKey(m.id, m.swipe)] ?? [];
      if (!m.isUser) {
        const replacing = sides.find((s) => s.replaces);
        const parsed = this.parse(m.content);
        let base: ParsedLedger = replacing ? { ...parsed, ops: replacing.ops, format: "dsl" } : parsed;
        // The knowledge clerk's lines stand in for the reply's own lines of those kinds, in their place.
        const clerk = sides.filter((s) => s.replacesOps?.length && (!s.hash || s.hash === hash(m.content))).at(-1);
        if (clerk) {
          const kinds = new Set(clerk.replacesOps);
          const kept = base.ops.filter((o) => !kinds.has(o.op));
          const at = base.ops.findIndex((o) => kinds.has(o.op));
          const pos = at < 0 ? kept.findIndex((o) => o.op === "mode") : base.ops.slice(0, at).filter((o) => !kinds.has(o.op)).length;
          const cut = pos < 0 ? kept.length : pos;
          base = { ...base, ops: [...kept.slice(0, cut), ...clerk.ops, ...kept.slice(cut)] };
        }
        const extras = sides.filter((s) => !s.replaces && !s.replacesOps?.length);
        const extraOps = extras.flatMap((s) => s.ops);
        const src: EventSource = replacing ? replacing.source : "model";
        events.push(...folder.applyMessage(m.index, m.id, m.swipe, base, src, extraOps, extras[0]?.source ?? "user"));
      } else {
        const extraOps = sides.flatMap((s) => s.ops);
        const parsed = this.parse(m.content);
        // Player messages only contribute speaker marks, what was said aloud, and extension-authored ops.
        events.push(...folder.applyMessage(m.index, m.id, m.swipe, { ops: [], unknown: [], format: "none", truncated: false, speakers: parsed.speakers, speech: parsed.speech, fromUser: true }, "user", extraOps, sides[0]?.source ?? "user"));
      }
      const pos = i + 1;
      if (pos % LedgerRuntime.SNAP_EVERY === 0) {
        this.snapshots = this.snapshots.filter((s) => s.pos !== pos);
        this.snapshots.push({ chain: chain[i], pos, state: deepClone(folder.state) });
        this.snapshots.sort((a, b) => a.pos - b.pos);
        if (this.snapshots.length > 80) this.snapshots.shift();
      }
    }
    return { state: folder.state, events, chain };
  }

  /** State as it was right after message `msgId` (for time-travel trackers). */
  stateAt(path: PathMessage[], msgId: string, opts: FoldOptions, side: SideEventStore = {}): WorldState | null {
    const i = path.findIndex((m) => m.id === msgId);
    if (i < 0) return null;
    return this.fold(path, opts, side, i + 1).state;
  }
}
