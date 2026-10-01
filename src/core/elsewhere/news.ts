// News off the page (design/09 §8): what people learn between scenes, person to person along
// their ties, with delays and distortion. The engine does it without a model call and writes
// ordinary knowledge lines with a route, so the knowledge firewall (07) sees who heard what.

import type { FactState, WorldState } from "../types";
import type { OffPage } from "../offpage";
import { canAct, type Actor, type Roster } from "./roster";

export interface Hop {
  from: Actor;
  to: Actor;
  key: string;
  statement: string;
  status: "knows" | "believes";
  partial: boolean;
  medium?: string;
  line: string;
}

const BIG = /\b(is alive|alive again|alive,|back from the dead|came back|is back|returned|resurrect\w*|is dead|died|killed|murder\w*|pregnan\w*|married|engaged|arrest\w*|betray\w*|attack\w*|is missing|went missing|vanished|disappeared|fled|is (?:really|actually|secretly)|raid\w*|at war|crowned|disinherit\w*|banished|exposed|caught)\b/i;
const GUARDED = /\b(guarded|secretive|reserved|taciturn|discreet|keeps (?:to )?(?:him|her|them)sel(?:f|ves)|spymaster|whisperer)\b/i;
const HAS = new Set(["knows", "believes", "suspects"]);
const SECONDHAND = new Set(["told", "heard", "rumour", "overheard", "read"]);

/** How newsworthy a fact is: big events travel; small talk doesn't. */
export function newsValue(f: FactState, msgCount: number): number {
  if (!BIG.test(f.statement)) return 0;
  let v = 1;
  if (f.out?.length) v += 1;
  if (msgCount - f.lastMsg <= 80) v += 1;
  if (Object.values(f.stances).filter((s) => HAS.has(s.status)).length >= 3) v += 1;
  return v;
}

function contact(a: Actor, b: Actor, strength: number, r: Roster): { c: number; medium?: string } {
  if (a.standing === "captive" || b.standing === "captive") return { c: 0.1, medium: r.medium === "phone" ? "on a visit" : "by letter" };
  const aw = (a.where ?? "").toLowerCase();
  if (aw && aw === (b.where ?? "").toLowerCase()) return { c: 1 };
  const near = (x: Actor) => x.reach === "town" || x.reach === "house";
  if (near(a) && near(b)) return { c: 0.6 };
  if (strength >= 2) return { c: 0.3, medium: r.medium === "phone" ? "by phone" : r.medium === "raven" ? "by raven" : "by letter" };
  return { c: 0 };
}

export function spreadNews(opts: { state: WorldState; roster: Roster; hours: number; rand: () => number; offPage: OffPage[]; max?: number }): Hop[] {
  const { state: st, roster: r, hours, rand } = opts;
  if (hours <= 0) return [];
  const off = new Set(opts.offPage.map((o) => o.key));
  const facts = Object.values(st.facts ?? {})
    .filter((f) => !f.hidden && !off.has(f.key) && f.truth !== "false")
    .map((f) => ({ f, v: newsValue(f, st.msgCount) }))
    .filter((x) => x.v >= 2)
    .sort((a, b) => b.v - a.v || b.f.lastMsg - a.f.lastMsg)
    .slice(0, 12);
  const byChar = new Map(r.actors.filter((a) => a.charId).map((a) => [a.charId!, a]));
  const cands: { from: Actor; to: Actor; f: FactState; rate: number; medium?: string; secondhand: boolean }[] = [];
  for (const { f } of facts) {
    for (const [holder, s] of Object.entries(f.stances)) {
      if (!HAS.has(s.status)) continue;
      const from = byChar.get(holder);
      // People in the scene are the page's to move; the dead, the changed and pets carry nothing.
      if (!from || from.ring === "onstage" || !canAct(from) || from.standing === "construct") continue;
      if (f.keepers?.includes(holder)) continue; // a keeper never spreads it
      for (const t of from.ties) {
        const to = r.byKey(t.to);
        if (!to || to.group || to.ring === "onstage" || !canAct(to) || to.standing === "construct") continue;
        // News about yourself isn't news to you; and people don't go round telling news about themselves.
        if (from.names.some((n) => new RegExp(`\\b${n.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(f.statement))) continue;
        if (to.names.some((n) => new RegExp(`\\b${n.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(f.statement))) continue;
        const theirs = to.charId ? f.stances[to.charId] : undefined;
        if (theirs && (HAS.has(theirs.status) || theirs.set)) continue;
        const { c, medium } = contact(from, to, t.strength, r);
        if (!c) continue;
        const talk = GUARDED.test(from.lore) ? 0.2 : 1;
        cands.push({ from, to, f, rate: 0.1 * t.strength * c * talk, medium, secondhand: !!s.route && SECONDHAND.has(s.route) });
      }
    }
  }
  cands.sort((a, b) => b.rate - a.rate || a.to.name.localeCompare(b.to.name));
  const hops: Hop[] = [];
  const got = new Set<string>();
  const pairs = new Set<string>();
  for (const c of cands) {
    if (hops.length >= (opts.max ?? 4)) break;
    const k = `${c.to.key}:${c.f.key}`;
    const pair = `${c.from.key}>${c.to.key}`;
    if (got.has(k) || pairs.has(pair)) continue;
    const p = 1 - Math.exp(-c.rate * hours);
    if (rand() >= p) continue;
    got.add(k);
    pairs.add(pair);
    const partial = c.secondhand && rand() < 0.25;
    const status = partial ? "believes" : "knows";
    const how = `told by ${c.from.name}${c.medium ? `, ${c.medium}` : ""}`;
    hops.push({
      from: c.from, to: c.to, key: c.f.key, statement: c.f.statement, status, partial, medium: c.medium,
      line: `know ${c.to.name}: #${c.f.key} ${c.f.statement} | ${how} · ${status}${partial ? " · partial" : ""}`,
    });
    // They have it now: it can travel on from them next tick, and the gate sees it this one.
    c.to.knows.push({ key: c.f.key, statement: c.f.statement, status, route: "told", from: c.from.name });
  }
  return hops;
}
