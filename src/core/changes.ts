// What the last reply changed, as rows for the Now widget: the reply's own ledger
// lines, with bond moves drawn from the bond history (their old and new value).

import { BIPOLAR_AXES, type WorldState } from "./types";

export interface ChangeRow {
  icon: string;
  kind: string;
  text: string;
  sub?: string;
  tone?: "up" | "down" | "due";
  bond?: { axis: string; from: number; to: number; delta: number; lo: number; color: string };
}

// Icons of the reply's change lines (the ledger's own), mapped to a kind.
const CHANGE_KIND: Record<string, string> = {
  "🌦": "weather", "📍": "place", "👥": "cast", "🎭": "mood", "🩹": "body", "👗": "look", "🗣": "knowledge", "🤫": "secret", "🧠": "knowledge",
  "🎒": "item", "⚖": "debt", "⏳": "clock", "🏷": "reputation", "📓": "journal", "📜": "canon", "📄": "artifact", "📊": "gauge", "🔎": "clue",
  "🎯": "payoff", "⏰": "deadline", "🍂": "season", "🕸": "bond",
};

// Most telling first. Appearance is left out: models re-file the whole outfit every reply.
const RANK = ["debt", "deadline", "secret", "knowledge", "bond", "mood", "item", "cast", "clock", "gauge", "clue", "payoff", "reputation", "artifact", "journal", "canon", "place", "season", "weather", "body"];

/** The last reply's changes: its ledger lines, with bond moves drawn from the bond history (old and new value). */
export function replyChanges(st: WorldState, nm: (id: string) => string, color: (id: string) => string): { msg: number; rows: ChangeRow[] } {
  const d = st.replyDelta;
  if (!d) return { msg: -1, rows: [] };
  const rows: ChangeRow[] = [];
  for (const b of Object.values(st.bonds)) {
    for (const h of b.history) {
      if (h.msgIndex !== d.msgIndex || !h.delta) continue;
      rows.push({
        icon: "🕸", kind: "bond", text: `${nm(b.from)} → ${nm(b.to)} · ${h.axis}`, sub: h.cause, tone: h.delta > 0 ? "up" : "down",
        bond: { axis: h.axis, from: h.from, to: h.to, delta: h.delta, lo: BIPOLAR_AXES.includes(h.axis) ? -5 : 0, color: color(b.from) },
      });
    }
  }
  for (const line of d.lines) {
    const m = /^(\S+)\s+([\s\S]*)$/u.exec(line);
    if (!m) continue;
    const icon = m[1].replace(/\uFE0F/g, "");
    const kind = Object.entries(CHANGE_KIND).find(([k]) => k.replace(/\uFE0F/g, "") === icon)?.[1];
    // The clock is in the sky; bond moves are drawn above from the history (a label-only bond line stays).
    if (!kind || !RANK.includes(kind) || (kind === "bond" && !/“/.test(m[2]))) continue;
    const tone = kind === "debt" ? (/\((due|broken)\)$/.test(m[2]) ? "due" : undefined) : kind === "body" ? "down" : undefined;
    rows.push({ icon, kind, text: m[2], tone });
  }
  const rank = (r: ChangeRow) => (r.kind === "debt" && r.tone !== "due" ? RANK.indexOf("item") : RANK.indexOf(r.kind));
  return { msg: d.msgIndex, rows: rows.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map((x) => x.r).slice(0, 16) };
}
