// Running bits when they're due: the oil joke, Daeron's dragon drawing, a pet name. A bit that hasn't
// come up in three scenes (and a dozen messages) is due for a callback, and is offered only when the
// moment can hold it: downtime, company, travel, a tender scene, never a fight or a pivotal turn.
// When a bit was last used is read from the ledger's motif lines and from the prose itself, so a
// joke the reply simply makes counts as used.

import type { WorldState } from "./types";
import { words } from "./facts";

export interface DueBit {
  text: string;
  who?: string;
  /** Scenes since it last came up (null: never seen on the page). */
  scenes: number | null;
}

const LIGHT_MODES = new Set(["social", "downtime", "travel", "intimacy", "investigation"]);

/** The words that make a bit itself ("oil", "joke" → "oil"), longest first. */
function marks(text: string): string[] {
  return [...new Set(words(text).filter((w) => w.length >= 3 && !/^(joke|jokes|running|thing|about|always|again|still|their|there|which|would|could|should)$/.test(w)))].sort((a, b) => b.length - a.length).slice(0, 4);
}

/**
 * The last message each bit came up in, read from the prose (newest first). A bit with two or
 * more marks needs two of them together; one with a single mark needs it.
 */
export function bitsSeen(messages: { index: number; content: string }[], bits: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const want = bits.map((b) => ({ b, m: marks(b) })).filter((x) => x.m.length);
  for (let i = messages.length - 1; i >= 0 && Object.keys(out).length < want.length; i--) {
    const set = new Set(words(messages[i].content));
    for (const { b, m } of want) {
      if (out[b] != null) continue;
      const hit = m.filter((w) => set.has(w)).length;
      if (hit >= Math.min(2, m.length)) out[b] = messages[i].index;
    }
  }
  return out;
}

/** The bits due for a callback now, at most two, when the moment can hold one. */
export function dueBits(st: WorldState, seen: Record<string, number>, opts: { tier?: string; extra?: string[] } = {}): DueBit[] {
  if (opts.tier === "pivotal" || !LIGHT_MODES.has(st.mode)) return [];
  const scenesSince = (msg: number) => st.sceneLog.filter((s) => s.startMsg > msg).length;
  const cands = [
    ...(st.motifs ?? []).map((m) => ({ text: m.text, who: m.who, last: Math.max(m.lastMsg, seen[m.text] ?? -1), uses: m.uses })),
    ...(opts.extra ?? []).map((t) => ({ text: t, who: undefined as string | undefined, last: seen[t] ?? -1, uses: 0 })),
  ];
  const out: (DueBit & { uses: number; last: number })[] = [];
  for (const c of cands) {
    if (out.some((o) => o.text.toLowerCase() === c.text.toLowerCase())) continue;
    const scenes = c.last >= 0 ? scenesSince(c.last) : null;
    if (c.last >= 0 && (scenes! < 3 || st.msgCount - c.last < 12)) continue;
    out.push({ text: c.text, ...(c.who ? { who: c.who } : {}), scenes, uses: c.uses, last: c.last });
  }
  return out.sort((a, b) => b.uses - a.uses || a.last - b.last).slice(0, 2).map(({ uses: _u, last: _l, ...d }) => d);
}

/** Per bit, for the World page: due now, or how many scenes since it came up. */
export function bitStatus(st: WorldState, text: string, lastMsg: number, seen: Record<string, number>): { scenes: number | null; due: boolean } {
  const last = Math.max(lastMsg, seen[text] ?? -1);
  const scenes = last >= 0 ? st.sceneLog.filter((s) => s.startMsg > last).length : null;
  return { scenes, due: scenes == null || (scenes >= 3 && st.msgCount - last >= 12) };
}
