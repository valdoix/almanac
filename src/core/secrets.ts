// How close a secret is to coming out, and who is closest to learning it. The Knowledge grid says
// who knows what; this says who could find out next and how: someone who already suspects, someone
// close to a person who knows, someone in the room with one. Each secret gets an exposure clock
// (0–6) from how far it has spread, the suspicions around it, rumours that echo it, and who is
// together now. Plain rules over the record, so the page can say why.

import type { FactState, WorldState } from "./types";
import { normFact, overlap } from "./state";

export interface Closest {
  id: string;
  score: number;
  why: string[];
}

export interface Exposure {
  key: string;
  statement: string;
  keepers: string[];
  keptFrom: string[];
  /** 0–6: how near it is to coming out. */
  clock: number;
  /** What moves the clock, in words. */
  why: string[];
  /** The people it's kept from, closest to learning it first (only those with a reason). */
  closest: Closest[];
}

const here = (st: WorldState, id: string) => {
  const c = st.chars[id];
  return !!c && !c.dead && (c.tier === "spot" || c.tier === "peri" || (c.isUser && c.tier !== "off"));
};

/** How close two people are, 0–5: the warm axes of the bond one way or the other. */
function closeness(st: WorldState, a: string, b: string): number {
  const warm = (k: string) => {
    const x = st.bonds[k]?.axes;
    if (!x) return 0;
    return Math.max(0, x.affection ?? 0) + Math.max(0, x.trust ?? 0) * 0.8 + Math.max(0, x.familiarity ?? 0) * 0.6 + Math.max(0, x.comfort ?? 0) * 0.5;
  };
  return Math.min(5, Math.max(warm(`${a}>${b}`), warm(`${b}>${a}`)) / 2);
}

export function exposureOf(st: WorldState, f: FactState, nm: (id: string) => string): Exposure | null {
  // Whom it was kept from and who still doesn't know it: one who now suspects is still outside it.
  const once = new Set([...(f.keptFrom ?? []), ...f.history.filter((h) => h.route === "hidden").map((h) => h.holder)]);
  const keptFrom = [...once].filter((id) => st.chars[id] && !st.chars[id].dead && f.stances[id]?.status !== "knows" && !(f.keepers ?? []).includes(id));
  if (f.hidden || !keptFrom.length) return null;
  const keepers = f.keepers ?? [];
  const has = Object.values(f.stances).filter((s) => s.status === "knows" || s.status === "believes").map((s) => s.holder).filter((id) => st.chars[id] && !st.chars[id].dead);
  const others = has.filter((id) => !keepers.includes(id));
  const suspect = keptFrom.filter((id) => ["suspects", "doubts", "believes", "wrong"].includes(f.stances[id]?.status ?? ""));
  const echo = st.rumors.filter((r) => overlap(normFact(r.text), normFact(f.statement)) > 0.5).length;
  const together = keptFrom.filter((p) => here(st, p) && has.some((k) => k !== p && here(st, k)));
  const why: string[] = [];
  let clock = 0;
  if (others.length) {
    clock += Math.min(2, others.length);
    why.push(`${others.length === 1 ? `${nm(others[0])} knows` : `${others.length} people know`} besides ${keepers.length ? keepers.map(nm).join(" and ") : "its keeper"}`);
  }
  if (suspect.length) {
    clock += Math.min(3, suspect.length * 2);
    why.push(`${suspect.map(nm).join(" and ")} ${suspect.length === 1 ? "suspects" : "suspect"} something`);
  }
  if (echo) {
    clock += Math.min(2, echo);
    why.push(`${echo === 1 ? "a rumour echoes" : `${echo} rumours echo`} it`);
  }
  if (together.length) {
    clock += 1;
    why.push(`${together.map(nm).join(" and ")} ${together.length === 1 ? "is" : "are"} in the room with someone who knows`);
  }
  const closest: Closest[] = [];
  for (const p of keptFrom) {
    const reasons: string[] = [];
    let score = 0;
    const st0 = f.stances[p]?.status;
    if (st0 === "suspects" || st0 === "doubts") {
      score += 3;
      reasons.push("suspects it");
    } else if (st0 === "wrong" || st0 === "believes") {
      score += 1.5;
      reasons.push("has a version of it");
    }
    const near = has.filter((k) => k !== p).map((k) => ({ k, c: closeness(st, k, p) })).sort((a, b) => b.c - a.c)[0];
    if (near && near.c >= 1.5) {
      score += near.c / 1.5;
      reasons.push(`close to ${nm(near.k)}, who knows`);
    }
    if (together.includes(p)) {
      score += 1;
      const k = has.find((x) => x !== p && here(st, x));
      reasons.push(`here with ${k ? nm(k) : "someone who knows"}`);
    }
    if (score > 0) closest.push({ id: p, score: Math.round(score * 10) / 10, why: reasons });
  }
  closest.sort((a, b) => b.score - a.score);
  return { key: f.key, statement: f.statement, keepers, keptFrom, clock: Math.min(6, clock), why, closest };
}

/** Every secret kept from someone, nearest to coming out first. */
export function exposures(st: WorldState, nm: (id: string) => string): Exposure[] {
  return Object.values(st.facts ?? {}).map((f) => exposureOf(st, f, nm)).filter((x): x is Exposure => !!x).sort((a, b) => b.clock - a.clock || b.closest.length - a.closest.length);
}
