// Crossings (design/09 §10): how what happens off the page reaches the scene. A beat leaves an
// arrival with a route: a carrier who'll mention it when next on the page, a signal (a call, a
// letter, a raven), something heard or seen around town, a trace at a place, or an entrance the
// reply may take or leave. Arrivals are offered in the note, confirmed only when the reply uses
// them, and expire when they go stale.

import type { ArcState, WorldState } from "../types";
import { normFact } from "../state";
import { fmtTime, fromAbs } from "../util";
import type { RouteKind } from "./grammar";
import { canAct, hasFact, type Actor, type Roster } from "./roster";
import { newsValue } from "./news";

export interface Arrival {
  id: string;
  msgId: string;
  swipe: number;
  text: string;
  /** Before Elsewhere: the route in words ("via the kitchen radio"). */
  route?: string;
  atAbs?: number;
  place?: string | string[];
  delivered?: boolean;
  kind?: RouteKind;
  arc?: string;
  lead?: string;
  /** The engine's own wording, kept when the model's replaces it. */
  template?: string;
  carrier?: string;
  medium?: string;
  untilAbs?: number;
  status?: "pending" | "offered" | "used" | "expired";
  /** Message counts it was offered at. */
  offered?: number[];
  tick?: string;
  /** Goes in even in a charged scene (a fate left for the page, a crisis). */
  urgent?: boolean;
  why?: string;
}

const STOPW = new Set("the a an and or but of to in on at for with from by as is was were be been it its that this these those he she they them his her their there here then than so not no into onto over under about after before while when what who whom which".split(" "));
const words = (s: string) => normFact(s).split(" ").filter((w) => w.length >= 4 && !STOPW.has(w));

/** How much of an arrival's wording the reply took up (0–1). */
export function coverage(text: string, prose: string): number {
  const a = [...new Set(words(text))];
  if (!a.length) return 0;
  const b = new Set(words(prose));
  return a.filter((w) => b.has(w)).length / a.length;
}

const UNTIL: Record<RouteKind, number> = { carrier: 4320, signal: 720, ambient: 480, trace: 10080, entrance: 1440 };
const MEDIUM_WORD: Record<string, string> = { phone: "a call", letter: "a letter", raven: "a raven" };

/** The next minute someone would reasonably call or write: 08:00–22:00. */
export function decentHour(abs: number): number {
  const m = ((abs % 1440) + 1440) % 1440;
  if (m >= 8 * 60 && m < 22 * 60) return abs;
  return m < 8 * 60 ? abs - m + 8 * 60 : abs - m + 1440 + 8 * 60;
}

const segs = (p?: string | string[]) => (Array.isArray(p) ? p : p ? p.split(/\s*›\s*/) : []).map((x) => x.toLowerCase().trim()).filter(Boolean);

function placeMatch(arrival: string[], scene: string[]): boolean {
  if (!arrival.length) return true;
  const deep = arrival[arrival.length - 1];
  return scene.some((s) => s === deep || (deep.length >= 5 && s.includes(deep)) || (s.length >= 5 && deep.includes(s)));
}

/** A route for a beat (design/09 §10.1). Null: it stays off the page for now. */
export function routeFor(o: {
  arc: ArcState; lead?: Actor; roster: Roster; routes: RouteKind[]; text: string; atAbs: number; place?: string; result: string;
  /** The news in a few words, for a call or a carrier ("good news", "bad news: the trail went cold"). */
  gist?: string;
  /** Places an open thread will take the player (where a trace waits to be found), as paths. */
  tracePlaces?: string[][];
  slip?: boolean; ending?: boolean; lastRoute?: RouteKind; recentKinds: RouteKind[]; town?: string; onstage: Actor[];
}): Omit<Arrival, "id" | "msgId" | "swipe"> | null {
  const { arc, lead, roster: r } = o;
  if (arc.secrecy === "secret" && !o.slip && !o.ending) return null;
  const castActors = arc.cast.map((n) => r.find(n)).filter(Boolean) as Actor[];
  const aboutStage = castActors.some((c) => o.onstage.includes(c)) || o.onstage.some((c) => c.names.some((n) => arc.want.includes(n.split(" ")[0])));
  const toUser = !!lead?.ties.some((t) => t.to === "user" && t.strength >= 2);
  const near = (a?: Actor) => !!a && (a.reach === "town" || a.reach === "house");
  // A carrier: someone local who has been on the page and is tied to the lead (or the lead).
  const carriers = [lead, ...castActors, ...(lead?.ties ?? []).filter((t) => t.strength >= 2).map((t) => r.byKey(t.to))]
    .filter((a): a is Actor => !!a && !a.group && near(a) && canAct(a) && a.ring === "offstage");
  // A trace waits somewhere particular: the beat's own place if it's a spot in town, else a place an open thread will take the player.
  const isTown = (p?: string) => !p || (!!o.town && p.toLowerCase() === o.town.toLowerCase());
  const spot = !isTown(o.place) && r.local.some((x) => x.length >= 4 && (o.place!.toLowerCase().includes(x) || x.includes(o.place!.toLowerCase()))) ? o.place!.split(/\s*›\s*/) : o.tracePlaces?.[0];
  const local = !!spot;
  const feasible = (k: RouteKind): boolean => {
    switch (k) {
      case "carrier": return carriers.length > 0;
      case "signal": return (toUser || aboutStage) && !!lead && !lead.group && lead.reach !== "house";
      case "ambient": return arc.secrecy === "public" && (near(lead) || !!lead?.group);
      case "trace": return !!local && arc.secrecy !== "secret";
      case "entrance": return !!lead && !lead.group && (toUser || aboutStage) && (near(lead) || arc.kind === "return") && (o.ending || arc.clock.cur >= arc.clock.max - 1 || !!arc.bring);
    }
  };
  let options = o.routes.filter(feasible);
  if (o.ending && feasible("entrance") && !options.includes("entrance")) options.push("entrance");
  // Novelty: not the same route twice running for an arc, and not a fourth "heard from afar" in a row.
  if (options.length > 1 && o.lastRoute) options = options.filter((k) => k !== o.lastRoute);
  if (options.length > 1 && o.recentKinds.slice(-3).length === 3 && o.recentKinds.slice(-3).every((k) => k === "ambient")) options = options.filter((k) => k !== "ambient");
  const kind = options[0];
  if (!kind) return null;
  const leadName = lead?.name ?? arc.lead;
  const base = { kind, arc: arc.id, lead: leadName, atAbs: o.atAbs, untilAbs: o.atAbs + UNTIL[kind] };
  switch (kind) {
    case "carrier": {
      const c = carriers.find((a) => a !== lead) ?? carriers[0];
      const t = c === lead ? `${c.name} can tell of it: ${o.text}` : `${c.name} has news of ${leadName}: ${o.gist ?? o.text}`;
      return { ...base, carrier: c.name, text: t, template: t };
    }
    case "signal": {
      const at = decentHour(o.atAbs);
      const t = `${MEDIUM_WORD[r.medium]} from ${leadName}${lead?.where ? ` (${lead.where})` : ""}: ${o.gist ?? o.text}`;
      return { ...base, atAbs: at, untilAbs: at + UNTIL.signal, medium: r.medium, text: t, template: t };
    }
    case "ambient": {
      const t = o.text;
      return { ...base, place: o.town ? [o.town] : [], text: t, template: t };
    }
    case "trace": {
      const t = `At ${spot!.at(-1)}, signs of what happened: ${o.text}`;
      return { ...base, place: spot!, text: t, template: t };
    }
    case "entrance": {
      const travel = lead && (lead.reach === "far" || lead.reach === "region") ? (lead.reach === "far" ? 960 : 240) : 0;
      const t = `${leadName} could turn up (${arc.want.replace(/^to\s+/i, "wanting to ")})`;
      return { ...base, atAbs: o.atAbs + travel, untilAbs: o.atAbs + travel + UNTIL.entrance, text: t, template: t, urgent: !!arc.fate };
    }
  }
}

// ---------------------------------------------------------------------------
// The note lane
// ---------------------------------------------------------------------------

export interface LaneInput {
  state: WorldState;
  arrivals: Arrival[];
  roster: Roster;
  now: number | null;
  /** The message count when planning (an arrival remembers when it was offered). */
  at: number;
  tier: "routine" | "charged" | "pivotal";
  mode: "off" | "quiet" | "living" | "restless";
  onPath: (msgId: string) => boolean;
  /** Beats already shown in a "since you last saw them" line, by person. */
  seen: Record<string, number>;
  lastPlace?: string;
  offPageWords?: string[];
  budget?: number;
}

export interface LaneResult {
  text: string;
  offered: string[];
  expired: { id: string; why: string }[];
  seen: Record<string, number>;
  place: string;
}

const SCENE_CAP: Record<string, number> = { off: 0, quiet: 1, living: 1, restless: 2 };

/** Old arrivals (before Elsewhere) read as ambient news with a half-day shelf life. */
export function upgradeArrival(a: Arrival): Arrival {
  if (a.kind) return a;
  const kind: RouteKind = "ambient";
  return { ...a, kind, status: a.delivered ? "used" : "pending", untilAbs: (a.atAbs ?? 0) + 720, place: segs(a.place), template: a.text, offered: [] };
}

export function expireArrivals(arrivals: Arrival[], now: number | null): { id: string; why: string }[] {
  const out: { id: string; why: string }[] = [];
  if (now == null) return out;
  for (const a of arrivals) {
    if (a.status !== "pending" && a.status !== "offered") continue;
    if (a.untilAbs == null || now <= a.untilAbs) continue;
    if (a.kind === "signal") {
      // An unanswered call is a missed call; a letter waits.
      const missed = a.medium === "phone" ? `A missed call and a message from ${a.lead ?? "someone"}: ${a.text.replace(/^a call from [^:]+:\s*/i, "")}` : a.text;
      Object.assign(a, { kind: "trace", place: [], text: missed, template: missed, untilAbs: now + 2880, why: "the call went unanswered" });
      continue;
    }
    a.why = a.status === "offered" ? "not taken up" : "went stale";
    a.status = "expired";
    out.push({ id: a.id, why: a.why! });
  }
  return out;
}

export function elsewhereLane(inp: LaneInput): LaneResult {
  const { state: st, roster: r } = inp;
  const scene = st.place.map((x) => x.toLowerCase());
  const place = st.place.join(" › ");
  const onstage = r.actors.filter((a) => a.ring === "onstage");
  const present = (name?: string) => !!name && onstage.some((a) => a.names.some((n) => n.toLowerCase() === name.toLowerCase()) || a.name.toLowerCase() === name.toLowerCase());
  for (const a of inp.arrivals) Object.assign(a, upgradeArrival(a));
  const expired = expireArrivals(inp.arrivals, inp.now);
  const sceneStart = st.sceneStartMsg ?? 0;
  const thisScene = inp.arrivals.filter((a) => (a.offered ?? []).some((i) => i >= sceneStart)).length;
  const cap = SCENE_CAP[inp.mode] ?? 1;
  const firstTurn = inp.at - sceneStart <= 2;
  const room = inp.mode === "quiet" ? (firstTurn ? cap - thisScene : 0) : cap - thisScene;
  const ready = inp.arrivals.filter((a) => {
    if (a.status !== "pending" && a.status !== "offered") return false;
    if (!inp.onPath(a.msgId)) return false;
    if (a.atAbs != null && inp.now != null && a.atAbs > inp.now) return false;
    if (inp.tier !== "routine" && !a.urgent) return false;
    switch (a.kind) {
      case "carrier": return present(a.carrier);
      case "entrance": return !present(a.lead);
      case "ambient": return placeMatch(segs(a.place).slice(0, 1), scene);
      case "trace": return placeMatch(segs(a.place), scene);
      default: return true;
    }
  });
  const order: Record<string, number> = { entrance: 0, signal: 1, trace: 2, carrier: 3, ambient: 4 };
  ready.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || (order[a.kind ?? "ambient"] ?? 5) - (order[b.kind ?? "ambient"] ?? 5) || (a.atAbs ?? 0) - (b.atAbs ?? 0));
  const already = ready.filter((a) => (a.offered ?? []).some((i) => i >= sceneStart));
  const fresh = ready.filter((a) => !already.includes(a));
  const pick = [...already, ...fresh.filter((a) => a.urgent), ...fresh.filter((a) => !a.urgent).slice(0, Math.max(0, room))];
  const chosen = [...new Set(pick)].slice(0, 3);

  const now: string[] = [];
  const mayCome: string[] = [];
  const could: string[] = [];
  for (const a of chosen) {
    if (a.kind === "carrier") mayCome.push(a.text);
    else if (a.kind === "entrance") could.push(entranceCapsule(a, inp));
    else now.push(a.kind === "signal" && a.atAbs != null ? (inp.now != null && inp.now - a.atAbs > 60 ? `${a.text} (a message left at ${fmtTime(fromAbs(a.atAbs)).replace(/^Day \d+ /, "")})` : a.text) : a.text);
  }

  // Since you last saw them: people back on the page carry what they did off it.
  const seen = { ...inp.seen };
  const back: string[] = [];
  for (const a of onstage) {
    const isMe = (n: string) => a.names.some((m) => m.toLowerCase() === n.toLowerCase()) || r.find(n) === a;
    const mine = Object.values(st.arcs ?? {}).filter((x) => isMe(x.lead) || (x.secrecy !== "secret" && x.cast.some(isMe)));
    const since = seen[a.key] ?? -1;
    const beats = mine.flatMap((x) => x.beats.filter((b) => b.msgIndex > since && (inp.now == null || b.atAbs <= inp.now) && (inp.now == null || inp.now - b.atAbs <= 4320)).map((b) => ({ b, x }))).sort((p, q) => p.b.atAbs - q.b.atAbs);
    if (beats.length) {
      const secret = beats.some(({ x }) => x.secrecy !== "public");
      back.push(`${a.name}${a.lastPage >= 0 ? "" : " (first time on the page)"}: off the page, ${beats.slice(-2).map(({ b }) => b.text.replace(/\.$/, "")).join("; then ")}.${secret ? " Theirs to tell or hide; nobody here knows unless told." : ""}`);
    }
    seen[a.key] = inp.at;
  }

  // Encounters: who is likely here when the scene moves somewhere new.
  const likely: string[] = [];
  if (place && place !== inp.lastPlace && inp.tier === "routine") {
    for (const a of r.actors) {
      if (a.ring === "onstage" || !canAct(a) || !a.where || likely.length >= 2) continue;
      if (segs(a.where).at(-1) !== scene[0] && placeMatch(segs(a.where), scene.slice(1))) likely.push(`${a.name}${a.routine ? ` (${a.routine.slice(0, 40)})` : ""}`);
    }
    for (const x of Object.values(st.arcs ?? {})) {
      if (likely.length >= 2 || x.status !== "running" || !x.place || present(x.lead)) continue;
      if (segs(x.place).at(-1) !== scene[0] && placeMatch(segs(x.place), scene.slice(1))) likely.push(`${x.lead}, about ${x.premise.slice(0, 80)}`);
    }
  }

  const parts: string[] = [];
  if (now.length) parts.push(`Reaches the scene now: ${now.join(" · ")} — render it; invent no other news from off the page.`);
  if (mayCome.length) parts.push(`May come up, if it fits: ${mayCome.join(" · ")}`);
  if (could.length) parts.push(`Could come in, if the scene opens (optional): ${could.join(" · ")}`);
  if (back.length) parts.push(`Back on the page: ${back.slice(0, 2).join(" · ")}`);
  if (likely.length) parts.push(`Likely here (only if it fits): ${likely.join(" · ")}`);
  let text = parts.length ? `[ELSEWHERE] ${parts.join("\n  ")}` : "[ELSEWHERE] (nothing from off the page reaches this scene; invent no off-screen news)";
  const max = (inp.budget ?? 260) * 4;
  if (text.length > max) text = `${text.slice(0, max - 1)}…`;
  for (const a of chosen) {
    a.status = "offered";
    a.offered = [...new Set([...(a.offered ?? []), inp.at])].slice(-6);
  }
  return { text, offered: chosen.map((a) => a.id), expired, seen, place };
}

/** Who an entering person is, what they want now, and what they know and have no route to. */
function entranceCapsule(a: Arrival, inp: LaneInput): string {
  const r = inp.roster;
  const lead = r.find(a.lead);
  const arc = a.arc ? inp.state.arcs?.[a.arc] : undefined;
  if (!lead) return a.text;
  const knows = lead.knows.slice(-3).map((k) => `#${k.key}`);
  const inPlay = Object.values(inp.state.facts ?? {}).filter((f) => !f.hidden && newsValue(f, inp.state.msgCount) >= 2 && !hasFact(lead, f.key) && Object.entries(f.stances).some(([h]) => r.actors.find((x) => x.charId === h)?.ring === "onstage")).slice(0, 2).map((f) => `#${f.key}`);
  const last = arc?.beats.at(-1)?.text;
  const who = lead.text ? lead.text.split(/(?<=[.!?])\s/)[0].slice(0, 160) : lead.name;
  return [`${a.text}. ${who}`, arc ? `Wants now: ${arc.want.replace(/^to\s+/i, "")}.` : "", knows.length ? `Knows ${knows.join(", ")}.` : "", inPlay.length ? `No route to ${inPlay.join(", ")}: can't act on it until told on the page.` : "", last ? `Latest: ${last}` : ""].filter(Boolean).join(" ");
}

/** How many replies may pass over an arrival before it's gone (a sound passes; a carrier waits). */
const OFFERS: Record<RouteKind, number> = { carrier: 3, signal: 1, ambient: 1, trace: 2, entrance: 2 };

/** After a reply: which offered arrivals it took up. */
export function confirmArrivals(arrivals: Arrival[], o: { prose: string; roster: Roster; at: number }): { used: string[]; dropped: string[] } {
  const used: string[] = [];
  const dropped: string[] = [];
  const present = (name?: string) => !!name && o.roster.actors.some((a) => a.ring === "onstage" && a.names.some((n) => n.toLowerCase() === name.toLowerCase()));
  for (const a of arrivals) {
    if (a.status !== "offered") continue;
    const cov = coverage(a.kind === "entrance" ? a.lead ?? a.text : a.text, o.prose);
    const ok = a.kind === "entrance" ? present(a.lead) : a.kind === "carrier" ? present(a.carrier) && cov >= 0.3 : cov >= 0.4;
    if (ok) {
      a.status = "used";
      used.push(a.id);
    } else if ((a.offered?.length ?? 0) >= OFFERS[a.kind ?? "ambient"]) {
      if (a.kind === "signal") {
        // An unanswered call becomes a message waiting.
        const missed = a.medium === "phone" ? `A missed call from ${a.lead ?? "someone"}, and a message: ${a.text.replace(/^a call from [^:]+:\s*/i, "")}` : a.text;
        Object.assign(a, { kind: "trace", place: [], text: missed, template: missed, status: "pending", offered: [], why: "the call went unanswered" });
        continue;
      }
      a.status = "expired";
      a.why = "not taken up";
      dropped.push(a.id);
    } else a.status = "pending";
  }
  return { used, dropped };
}
