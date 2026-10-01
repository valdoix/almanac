// The storyteller (design/09 §6): one tick of the world off the page. Deterministic for a chat
// and a stretch of story time, and entirely the engine's: who is awake, what news travels,
// which subplots move or begin, how the dice fall, what twists, what ends, and how each beat
// could reach the scene. The model only tells the result afterwards (telling.ts).

import type { CodexRecord } from "../codex";
import type { WeaverWorld } from "../lore";
import type { OffPage } from "../offpage";
import type { ArcKind, ArcStage, ArcState, BeatResult, ElsewhereConfig, WorldState } from "../types";
import { rng, slug } from "../util";
import { arcNewLine, awakeAt, beatLine, cleanVal, gate, isLight, namesIn, seedCandidates, type SeedCand } from "./arcs";
import { routeFor, type Arrival } from "./crossings";
import { beatTemplate, endTemplate, SPECS, stageOf, type RouteKind } from "./grammar";
import { spreadNews, type Hop } from "./news";
import { awakeSet, buildRoster, canAct, type Actor, type Profile, type Roster } from "./roster";

export type Mode = "quiet" | "living" | "restless";

export const MODES: Record<Mode, { awake: number; arcs: number; perTick: number; factor: number; twist: number; seeds: number; incidentsPerDay: number; arrivalChance: number }> = {
  quiet: { awake: 6, arcs: 3, perTick: 2, factor: 0.5, twist: 1 / 12, seeds: 1, incidentsPerDay: 0, arrivalChance: 0.5 },
  living: { awake: 10, arcs: 6, perTick: 4, factor: 1, twist: 1 / 6, seeds: 2, incidentsPerDay: 0.6, arrivalChance: 0.75 },
  restless: { awake: 16, arcs: 10, perTick: 6, factor: 2, twist: 1 / 4, seeds: 3, incidentsPerDay: 1.2, arrivalChance: 0.9 },
};

export interface TickInput {
  chatId: string;
  tickId: string;
  state: WorldState;
  records: CodexRecord[];
  userName: string;
  mode: Mode;
  canonGravity: "off" | "light" | "strong";
  fates: "page" | "ask" | "allow";
  genres: string[];
  from: number;
  now: number;
  anchorIndex: number;
  people?: ElsewhereConfig["people"];
  profiles?: Record<string, Profile>;
  notPeople?: string[];
  offPage: OffPage[];
  world?: WeaverWorld | null;
  pressures?: Record<string, string>;
  recentArrivals: Arrival[];
  /** Text of the last forty messages (who has been named lately). */
  recentText?: string;
  /** A named day today, if the calendar has one. */
  namedDay?: string | null;
  truths?: string[];
  /** The tick before this one (its leads wait a turn: spotlight rotation). */
  prevTick?: string;
}

export interface BeatCard {
  id: string;
  arcId: string;
  kind: ArcKind;
  lead: string;
  cast: string[];
  result: BeatResult | "met" | "price" | "lost" | "softened";
  roll: [number, number];
  mod: number;
  twist?: string;
  price?: string;
  worse?: string;
  stage: ArcStage;
  clock: string;
  atAbs: number;
  where?: string;
  premise: string;
  want: string;
  fear: string;
  leadText: string;
  knows: string[];
  noRoute: string[];
  grounds: string[];
  template: string;
  /** Index of the line the telling rewrites (the beat, or the arc's opening for a seed). */
  line: number;
  arrival?: string;
  arrivalKind?: RouteKind;
  ending?: boolean;
  seed?: boolean;
  /** Irreversible outcomes may be told (the player accepted the fate). */
  fateOk?: boolean;
}

export interface TickResult {
  tickId: string;
  hours: number;
  lines: string[];
  cards: BeatCard[];
  arrivals: Omit<Arrival, "msgId" | "swipe">[];
  awake: string[];
  hops: Hop[];
  seeded: string[];
  log: string[];
  roster: Roster;
}

const d6 = (rand: () => number) => 1 + Math.floor(rand() * 6);
const pickOf = <T,>(rand: () => number, xs: T[]): T => xs[Math.floor(rand() * xs.length) % Math.max(1, xs.length)];
const STAGE_F: Record<ArcStage, number> = { setup: 0.8, rising: 1, crisis: 1.4, aftermath: 0 };
const TWISTS = ["tie", "weather", "calendar", "object", "slip", "collide"] as const;
type Twist = (typeof TWISTS)[number];

export function tick(inp: TickInput): TickResult {
  const st = inp.state;
  const M = MODES[inp.mode];
  const rand = rng(`${inp.chatId}:${inp.tickId}`);
  const hours = Math.max(0, (inp.now - inp.from) / 60);
  const lines: string[] = [];
  const cards: BeatCard[] = [];
  const arrivals: Omit<Arrival, "msgId" | "swipe">[] = [];
  const log: string[] = [];
  const roster = buildRoster({ state: st, records: inp.records, userName: inp.userName, notPeople: inp.notPeople, people: inp.people, profiles: inp.profiles });
  const arcs = Object.values(st.arcs ?? {});
  const onstage = roster.actors.filter((a) => a.ring === "onstage");
  const leadOf = (arc: ArcState): Actor | undefined => roster.find(arc.lead) ?? (arc.faction ? roster.groups.find((g) => g.name.toLowerCase() === arc.faction!.name.toLowerCase()) : undefined);
  const town = roster.town ?? st.place[0];
  const recentKinds = inp.recentArrivals.filter((a) => a.kind).slice(-6).map((a) => a.kind!) as RouteKind[];
  const lastRouteOf = (arcId: string) => [...inp.recentArrivals].reverse().find((a) => a.arc === arcId)?.kind;
  const id = (s: string) => `${inp.tickId}-${s}`;
  // Places open threads will take the player: where a trace can wait to be found.
  const inScene = (n: string) => st.place.some((x) => x.toLowerCase() === n || x.toLowerCase().includes(n));
  const tracePlaces: string[][] = [];
  for (const t of Object.values(st.threads)) {
    if (t.status === "resolved") continue;
    const text = `${t.title} ${t.latest ?? ""}`.toLowerCase();
    for (const p of Object.values(st.places)) {
      const n = p.name.toLowerCase();
      if (n.length >= 5 && /^\p{Lu}/u.test(p.name) && !inScene(n) && text.includes(n) && !tracePlaces.some((x) => x.at(-1)?.toLowerCase() === n)) tracePlaces.push(p.path.length ? p.path : [p.name]);
    }
  }

  // 0. A lead now in the player's scene: the subplot has crossed into the story.
  for (const arc of arcs) {
    if (arc.status !== "running" || arc.crossed) continue;
    const lead = leadOf(arc);
    if (lead?.ring === "onstage") {
      lines.push(`arc cross #${arc.id}: thread: ${arc.id}`);
      log.push(`${arc.lead} came onto the page: ${arc.id} crossed`);
    }
  }

  // 1. Who is awake.
  const recentNames = new Set<string>();
  if (inp.recentText) for (const a of roster.actors) if (a.names.some((n) => n.length >= 3 && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(inp.recentText!))) recentNames.add(a.key);
  const lastBeat = new Map<string, number>();
  for (const arc of arcs) {
    const k = leadOf(arc)?.key;
    if (k && arc.lastBeatAbs != null) lastBeat.set(k, Math.max(lastBeat.get(k) ?? 0, arc.lastBeatAbs));
  }
  const leadsWithArcs = new Set(arcs.filter((a) => a.status === "running" || a.status === "held").map((a) => leadOf(a)?.key).filter(Boolean) as string[]);
  const jr = rng(`${inp.chatId}:${inp.tickId}:awake`);
  const jit = new Map<string, number>();
  const awake = awakeSet(roster, { cap: M.awake, leadsWithArcs, lastBeat, now: inp.now, recentNames, jitter: (k) => (jit.has(k) ? jit.get(k)! : (jit.set(k, jr()), jit.get(k)!)) });

  // 2. News travels.
  const hops = spreadNews({ state: st, roster, hours, rand: rng(`${inp.chatId}:${inp.tickId}:news`), offPage: inp.offPage });
  for (const h of hops) {
    lines.push(h.line);
    if (!awake.includes(h.to) && canAct(h.to)) awake.push(h.to);
    log.push(`news: ${h.from.name} → ${h.to.name} (#${h.key}${h.partial ? ", garbled" : ""})`);
  }

  // 3. Fates the player decided, and fates left for the page.
  for (const arc of arcs) {
    if (arc.status !== "running" || !arc.fate?.decision || arc.ending) continue;
    const lead = leadOf(arc);
    const d = arc.fate.decision;
    if (d === "page") {
      lines.push(`arc end #${arc.id}: left for the page | text: ${cleanVal(`What ${arc.lead} feared is left for a scene on the page.`)}`);
      const r = routeFor({ arc: { ...arc, bring: true }, lead, roster, routes: ["entrance", "signal", "carrier"], text: arc.fate.text, atAbs: inp.now, result: "lost", ending: true, recentKinds, town, onstage });
      if (r) arrivals.push({ ...r, id: id(`fate-${arc.id}`), urgent: true, tick: inp.tickId });
      continue;
    }
    const result = d === "accept" ? "lost" : "softened";
    const text = endTemplate({ lead: arc.lead, want: arc.want, fear: arc.fear, result });
    lines.push(`arc end #${arc.id}: ${result} | text: ${cleanVal(text)}`);
    cards.push(cardFor(arc, lead, roster, st, { result, roll: [0, 0], mod: 0, stage: "aftermath", atAbs: inp.now, template: text, line: lines.length - 1, ending: true, fateOk: d === "accept", offPage: inp.offPage }));
  }

  // 4. Idle subplots end; leads who can no longer act drop out.
  for (const arc of arcs) {
    if (arc.status !== "running") continue;
    const lead = leadOf(arc);
    const last = arc.lastBeatAbs ?? arc.startedAbs;
    if (inp.now - last > 3 * 1440 && !arc.locked) lines.push(`arc drop #${arc.id}: reason: ${cleanVal(`nothing moved for three story days`)}`);
    else if (lead && !lead.group && !canAct(lead)) lines.push(`arc drop #${arc.id}: reason: ${cleanVal(`${lead.name} can no longer act (${lead.standing})`)}`);
  }

  // 5. Which running subplots move this tick (a hazard per story hour).
  type Cand = { arc: ArcState; lead?: Actor; fresh?: SeedCand; prio: number; r?: number };
  const cands: Cand[] = [];
  const running = arcs.filter((a) => a.status === "running" && !lines.some((l) => l.startsWith(`arc drop #${a.id}:`) || l.startsWith(`arc end #${a.id}:`)));
  for (const arc of running) {
    const lead = leadOf(arc);
    if (lead?.ring === "onstage" || arc.clock.cur >= arc.clock.max || arc.fate) continue;
    if (arc.bring) {
      cands.push({ arc, lead, prio: 3 });
      continue;
    }
    const spec = SPECS[arc.kind];
    const lambda = spec.base * (1 + arc.heat / 2) * STAGE_F[arc.stage] * M.factor;
    const span = Math.max(0, (inp.now - Math.max(inp.from, arc.nextAbs)) / 60);
    const p = 1 - Math.exp(-lambda * span);
    if (rand() < p) cands.push({ arc, lead, prio: 1 + Math.min(1, (inp.now - (arc.lastBeatAbs ?? arc.startedAbs)) / 1440) });
  }

  // 6. New subplots, while there is room.
  const seeded: string[] = [];
  const live = running.length + arcs.filter((a) => a.status === "held" || a.status === "fate").length;
  const room = M.arcs - live;
  const seedP = live === 0 ? 1 : 1 - Math.exp(-0.06 * M.factor * Math.max(hours, 1));
  if (room > 0 && (hours > 0 || inp.tickId.includes("f")) && rand() < seedP) {
    const pool = seedCandidates({ state: st, roster, records: inp.records, awake, arcs, canonGravity: inp.canonGravity, genres: inp.genres, world: inp.world, pressures: inp.pressures, now: inp.now });
    const n = Math.min(room, M.seeds);
    for (let i = 0; i < n && pool.length; i++) {
      // A faction's clock or the world's agenda goes first; the rest by weight.
      const sure = pool.findIndex((c) => c.faction || c.kind === "world");
      let k = sure;
      if (k < 0) {
        const total = pool.reduce((s, c) => s + c.weight, 0);
        let x = rand() * total;
        k = pool.findIndex((c) => (x -= c.weight) <= 0);
      }
      const c = pool.splice(k < 0 ? 0 : k, 1)[0];
      const light = arcs.find((a) => isLight(a) && a.lead.toLowerCase() === c.lead.name.toLowerCase());
      if (light) {
        lines.push(`arc drop #${light.id}: reason: ${cleanVal(`gave way to a better grounded story (${c.kind})`)}`);
        log.push(`${light.id} gave way to ${c.id}`);
      }
      const at = inp.from + Math.round(rand() * Math.max(0, inp.now - inp.from));
      lines.push(arcNewLine({ id: c.id, kind: c.kind, lead: c.lead.name, cast: c.cast.map((a) => a.name), secrecy: c.secrecy, clock: c.clock, cur: c.cur, heat: c.heat, at, premise: c.premise, want: c.want, fear: c.fear, grounds: c.grounds, place: c.place, by: c.by, faction: c.faction }));
      const arc: ArcState = {
        id: c.id, kind: c.kind, lead: c.lead.name, cast: c.cast.map((a) => a.name), premise: c.premise, want: c.want, fear: c.fear, grounds: c.grounds, secrecy: c.secrecy,
        clock: { cur: c.cur ?? 0, max: c.clock }, tally: { win: 0, cost: 0, loss: 0 }, heat: c.heat, stage: "setup", beats: [], nextAbs: at, status: "running", by: c.by, place: c.place,
        startedAbs: at, startedMsg: inp.anchorIndex, faction: c.faction,
      };
      seeded.push(c.id);
      log.push(`seeded ${c.id} (${c.kind}, ${c.lead.name}) from ${c.why}`);
      cards.push(cardFor(arc, c.lead, roster, st, { result: "cost", roll: [0, 0], mod: 0, stage: "setup", atAbs: at, template: c.premise, line: lines.length - 1, seed: true, offPage: inp.offPage }));
      // A new subplot may take its first step at once.
      if (rand() < 0.6 * M.factor || c.lead.flags.wake) cands.push({ arc, lead: c.lead, fresh: c, prio: 1.5 });
      // Pull its cast awake.
      for (const a of c.cast) if (!awake.includes(a) && canAct(a) && a.ring !== "onstage") awake.push(a);
    }
  }

  // 7. Choose: the player's requests first; spotlight rotation (a lead who moved last tick waits); spread across kinds.
  for (const c of cands) c.r = rand();
  cands.sort((a, b) => b.prio - a.prio || a.r! - b.r!);
  const lastTickLeads = new Set(arcs.filter((a) => inp.prevTick && a.beats.at(-1)?.tick === inp.prevTick).map((a) => a.lead));
  const chosen: Cand[] = [];
  const perKind = new Map<ArcKind, number>();
  const kindCap = Math.max(1, Math.ceil(M.perTick / 2));
  for (const pass of [0, 1]) {
    for (const c of cands) {
      if (chosen.length >= M.perTick) break;
      if (chosen.includes(c) || chosen.some((x) => x.arc.id === c.arc.id)) continue;
      if (pass === 0 && lastTickLeads.has(c.arc.lead) && !c.arc.bring) continue;
      if ((perKind.get(c.arc.kind) ?? 0) >= kindCap && c.prio < 3) continue;
      chosen.push(c);
      perKind.set(c.arc.kind, (perKind.get(c.arc.kind) ?? 0) + 1);
    }
  }

  // 8. The beats: gate, dice, twist, clock, ending, route.
  const collided = new Set<string>();
  const doBeat = (arc: ArcState, lead: Actor | undefined, forced?: { atAbs: number; place?: string; twist?: string }) => {
    const g = forced ? { ok: true, mod: 0, atAbs: forced.atAbs, why: ["collision"] } : gate(arc, lead, roster, { from: inp.from, now: inp.now, rand });
    if (!g.ok) {
      if (g.drop) lines.push(`arc drop #${arc.id}: reason: ${cleanVal(g.drop)}`);
      else if (g.deferTo != null) lines.push(`arc set #${arc.id}: next: ${g.deferTo}`);
      log.push(`${arc.id}: held back (${g.drop ?? g.why.join(", ")})`);
      return;
    }
    const spec = SPECS[arc.kind];
    const roll: [number, number] = [d6(rand), d6(rand)];
    const total = roll[0] + roll[1] + g.mod;
    const result: BeatResult = total >= 10 ? "win" : total >= 7 ? "cost" : "loss";
    const price = result === "cost" ? pickOf(rand, spec.prices) : undefined;
    const worse = result === "loss" ? pickOf(rand, spec.worse) : undefined;
    const atAbs = g.atAbs ?? inp.now;
    let place = forced?.place ?? arc.place ?? (lead && !lead.group ? lead.where : undefined);
    // The twist die: something that already exists gets in the way, or helps.
    let twistText = forced?.twist;
    let slip = false;
    if (!forced && rand() < M.twist) {
      const order = [...TWISTS] as Twist[];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      for (const t of order) {
        const tw = twist(t, arc, lead, { roster, st, rand, running, collided, namedDay: inp.namedDay, atAbs });
        if (!tw) continue;
        twistText = tw.text;
        if (tw.castAdd) lines.push(`arc set #${arc.id}: cast: ${cleanVal(tw.castAdd)}`);
        if (tw.slip) {
          slip = true;
          lines.push(`arc set #${arc.id}: secrecy: ${arc.secrecy === "secret" ? "private" : "public"}`);
        }
        if (tw.collide) {
          collided.add(tw.collide.id);
          place = place ?? tw.collide.place;
          if (!chosen.some((c) => c.arc.id === tw.collide!.id)) doBeat(tw.collide, leadOf(tw.collide), { atAbs, place, twist: `collided with ${arc.lead}'s story` });
        }
        break;
      }
    }
    const cur = Math.min(arc.clock.max, arc.clock.cur + 1);
    const stage = stageOf(cur, arc.clock.max);
    const shownPlace = place && place.toLowerCase() !== (town ?? "").toLowerCase() && !arc.want.toLowerCase().includes(place.toLowerCase()) ? place : undefined;
    const text = beatTemplate({ kind: arc.kind, lead: arc.lead, want: arc.want, stage: stage === "aftermath" ? "crisis" : stage, result, price, worse, place: shownPlace });
    const next = atAbs + Math.round(120 + rand() * 240 / M.factor);
    lines.push(beatLine(arc.id, { result, roll, mod: g.mod, at: atAbs, text: twistText ? `${text} (${twistText})` : text, told: "template", twist: twistText, place, tick: inp.tickId, next }));
    const beatIdx = lines.length - 1;
    if (stage !== arc.stage && stage !== "aftermath") lines.push(`arc stage #${arc.id}: ${stage}`);
    log.push(`${arc.id}: ${roll[0]}+${roll[1]}${g.mod ? (g.mod > 0 ? "+" : "") + g.mod : ""} = ${total} → ${result}${twistText ? ` (twist: ${twistText})` : ""}`);
    // A faction's clock is the subplot's clock.
    if (arc.faction) lines.push(`clockf ${arc.faction.name}: ${arc.faction.project} ${cur}/${arc.clock.max} — ${cleanVal(text.slice(0, 80))}`);
    // Whereabouts: someone coming back is on the way, then here.
    if (arc.kind === "return" && lead && town) {
      if (stage === "rising" && result !== "loss") lines.push(`whereabouts ${lead.name}: on the way to ${town} | since: ${atAbs}`);
      if (stage === "crisis" && result !== "loss") lines.push(`whereabouts ${lead.name}: ${town} | since: ${atAbs}`);
    } else if (lead && !lead.group && place && place !== lead.where) lines.push(`whereabouts ${lead.name}: ${cleanVal(place)} | since: ${atAbs}`);

    const card = cardFor(arc, lead, roster, st, { result, roll, mod: g.mod, stage, atAbs, template: text, line: beatIdx, twist: twistText, price, worse, place, offPage: inp.offPage });
    // The ending, when the clock fills.
    let ending = false;
    if (cur >= arc.clock.max) {
      ending = true;
      const tally = { ...arc.tally, [result]: arc.tally[result] + 1 };
      const final = d6(rand) + d6(rand) + tally.win - tally.loss;
      const end: "met" | "price" | "lost" = final >= 10 ? "met" : final >= 7 ? "price" : "lost";
      const irreversible = end === "lost" && spec.irreversible && !!lead?.protected;
      const endText = endTemplate({ lead: arc.lead, want: arc.want, fear: arc.fear, result: end, price: pickOf(rand, spec.prices) });
      if (irreversible && inp.fates !== "allow") {
        lines.push(`arc set #${arc.id}: status: ${inp.fates === "ask" ? "fate" : "running"} | pending: ${cleanVal(endText)}${inp.fates === "page" ? " | fate: page" : ""}`);
        log.push(`${arc.id}: an irreversible ending waits on the player (${inp.fates})`);
      } else {
        lines.push(`arc end #${arc.id}: ${end} | text: ${cleanVal(endText)} | at: ${atAbs}`);
        cards.push(cardFor(arc, lead, roster, st, { result: end, roll: [0, 0], mod: final - tally.win + tally.loss, stage: "aftermath", atAbs, template: endText, line: lines.length - 1, ending: true, fateOk: inp.fates === "allow", offPage: inp.offPage }));
        for (const l of consequences(arc, end, roster)) lines.push(l);
        log.push(`${arc.id}: ends (${end})`);
      }
    }
    cards.push(card);
    // How it could reach the scene.
    if (ending || slip || arc.bring || rand() < M.arrivalChance * (arc.kind === "life" ? (result === "cost" ? 0.2 : 0.5) : 1)) {
      const gist = arc.kind === "life"
        ? (result === "loss" ? `a bad stretch (${worse})` : "nothing urgent; keeping in touch")
        : result === "win" ? `good news (${arc.want.replace(/^to\s+/i, "").slice(0, 60)})` : result === "cost" ? `news, with a catch: ${price}` : `bad news: ${worse}`;
      const r = routeFor({ arc, lead, roster, routes: SPECS[arc.kind].routes, text, atAbs, place, result, slip, ending, lastRoute: lastRouteOf(arc.id) as RouteKind | undefined, recentKinds, town, onstage, gist: ending ? undefined : gist, tracePlaces });
      if (r) {
        const aid = id(arc.id);
        if (!arrivals.some((a) => a.arc && collided.has(a.arc) && a.kind === "trace" && r.kind === "trace" && a.place?.toString() === r.place?.toString())) {
          arrivals.push({ ...r, id: aid, tick: inp.tickId, status: "pending", offered: [] });
          recentKinds.push(r.kind!);
          card.arrival = r.text;
          card.arrivalKind = r.kind;
        }
      }
    }
  };
  for (const c of chosen) if (!collided.has(c.arc.id)) doBeat(c.arc, c.lead);

  // 9. A bring-in with no beat this tick still offers its entrance.
  for (const arc of running) {
    if (!arc.bring || chosen.some((c) => c.arc.id === arc.id) || arrivals.some((a) => a.arc === arc.id)) continue;
    const r = routeFor({ arc, lead: leadOf(arc), roster, routes: ["entrance", "signal", "carrier"], text: arc.beats.at(-1)?.text ?? arc.premise, atAbs: inp.now, result: "cost", recentKinds, town, onstage });
    if (r) arrivals.push({ ...r, id: id(`bring-${arc.id}`), tick: inp.tickId, status: "pending", offered: [] });
  }

  // 10. Incidents: texture from the weather and the calendar, nobody's subplot.
  const inc = incident(inp, rand, hours, M.incidentsPerDay);
  if (inc) {
    arrivals.push({ id: id("incident"), kind: "ambient", text: inc, template: inc, place: town ? [town] : [], atAbs: inp.now, untilAbs: inp.now + 480, tick: inp.tickId, status: "pending", offered: [] });
    log.push(`incident: ${inc}`);
  }

  return { tickId: inp.tickId, hours, lines, cards, arrivals, awake: awake.map((a) => a.name), hops, seeded, log, roster };
}

function cardFor(arc: ArcState, lead: Actor | undefined, r: Roster, st: WorldState, o: { result: BeatCard["result"]; roll: [number, number]; mod: number; stage: ArcStage; atAbs: number; template: string; line: number; twist?: string; price?: string; worse?: string; place?: string; ending?: boolean; seed?: boolean; fateOk?: boolean; offPage: OffPage[] }): BeatCard {
  const off = new Set(o.offPage.map((x) => x.key));
  const knows = (lead?.knows ?? []).filter((k) => !off.has(k.key)).slice(-4).map((k) => `#${k.key} (${k.statement.slice(0, 80)})`);
  const noRoute = Object.values(st.facts ?? {}).filter((f) => !f.hidden && f.keepers?.length && lead && !(lead.charId && f.stances[lead.charId])).slice(0, 2).map((f) => `#${f.key}`);
  return {
    id: `b${o.line}`, arcId: arc.id, kind: arc.kind, lead: arc.lead, cast: arc.cast, result: o.result, roll: o.roll, mod: o.mod, twist: o.twist, price: o.price, worse: o.worse, stage: o.stage,
    clock: `${Math.min(arc.clock.max, arc.clock.cur + (o.seed || o.ending ? 0 : 1))}/${arc.clock.max}`, atAbs: o.atAbs, where: o.place ?? lead?.where, premise: arc.premise, want: arc.want, fear: arc.fear,
    leadText: lead?.text ?? "", knows, noRoute, grounds: arc.grounds, template: o.template, line: o.line, ending: o.ending, seed: o.seed, fateOk: o.fateOk,
  };
}

function twist(t: Twist, arc: ArcState, lead: Actor | undefined, c: { roster: Roster; st: WorldState; rand: () => number; running: ArcState[]; collided: Set<string>; namedDay?: string | null; atAbs: number }): { text: string; castAdd?: string; slip?: boolean; collide?: ArcState } | null {
  switch (t) {
    case "tie": {
      const ties = (lead?.ties ?? []).map((x) => c.roster.byKey(x.to)).filter((a): a is Actor => !!a && !a.group && canAct(a) && a.ring !== "onstage" && !arc.cast.includes(a.name) && a.name !== arc.lead);
      const a = ties.length ? ties[Math.floor(c.rand() * ties.length)] : undefined;
      return a ? { text: `${a.name} got involved`, castAdd: a.name } : null;
    }
    case "weather": {
      const w = c.st.weather?.condition ?? "";
      return /storm|rain|snow|fog|mist|wind|gale|blizzard|hail|sleet|heat/i.test(w) ? { text: `the ${w.toLowerCase()} got in the way` } : null;
    }
    case "calendar": {
      if (c.namedDay) return { text: `${c.namedDay} changed the day's plans` };
      const m = ((c.atAbs % 1440) + 1440) % 1440;
      return m >= 21 * 60 || m < 5 * 60 ? { text: "it happened in the dark, which mattered" } : null;
    }
    case "object": {
      const holders = new Set([lead?.charId, ...arc.cast.map((n) => c.roster.find(n)?.charId)].filter(Boolean));
      const items = Object.values(c.st.items).filter((i) => !i.gone && i.holder && holders.has(i.holder));
      const it = items.length ? items[Math.floor(c.rand() * items.length)] : undefined;
      return it ? { text: `${it.name} mattered` } : null;
    }
    case "slip":
      return arc.secrecy !== "public" ? { text: "word of it slipped out", slip: true } : null;
    case "collide": {
      const other = c.running.filter((o) => o.id !== arc.id && !c.collided.has(o.id) && o.clock.cur < o.clock.max && ((arc.place && o.place && arc.place.toLowerCase() === o.place.toLowerCase()) || o.cast.includes(arc.lead) || arc.cast.includes(o.lead) || (o.faction && arc.place && o.place && arc.place === o.place)));
      const o = other.length ? other[Math.floor(c.rand() * other.length)] : undefined;
      return o ? { text: `ran into ${o.lead}'s business`, collide: o } : null;
    }
  }
}

/** What an ending leaves behind: bonds among the cast. */
function consequences(arc: ArcState, end: "met" | "price" | "lost", r: Roster): string[] {
  const other = arc.cast.map((n) => r.find(n)).find((a) => a && !a.group);
  const lead = r.find(arc.lead);
  if (!other || !lead || lead.group) return [];
  const cause = cleanVal(arc.premise.slice(0, 60));
  switch (arc.kind) {
    case "rift": return [end === "lost" ? `bond ${lead.name}>${other.name}: trust -1, affection -1 — ${cause}` : `bond ${lead.name}>${other.name}: trust +1 — ${cause}`];
    case "rivalry": return [end === "lost" ? `bond ${lead.name}>${other.name}: resentment +1 — ${cause}` : `bond ${other.name}>${lead.name}: respect +1 — ${cause}`];
    case "courtship": return end === "lost" ? [`bond ${lead.name}>${other.name}: affection -1 — ${cause}`] : [`bond ${lead.name}>${other.name}: affection +1, trust +1 — ${cause}`, `bond ${other.name}>${lead.name}: affection +1 — ${cause}`];
    case "investigation":
    case "pursuit": return end === "lost" ? [] : lead.ties.some((t) => t.to === other.key) ? [`bond ${lead.name}>${other.name}: familiarity +1 — ${cause}`] : [];
    default: return [];
  }
}

function incident(inp: TickInput, rand: () => number, hours: number, perDay: number): string | null {
  if (!perDay || hours <= 0) return null;
  if (rand() >= 1 - Math.exp(-(perDay * hours) / 24)) return null;
  const town = inp.state.place[0] ?? "town";
  const w = inp.state.weather?.condition ?? "";
  const options: string[] = [];
  if (/storm|thunder|gale|blizzard|heavy/i.test(w)) options.push(`The ${w.toLowerCase()} brought down branches and lines across parts of ${town}.`);
  if (/snow|sleet|ice/i.test(w)) options.push(`The ${w.toLowerCase()} closed roads around ${town} for a while.`);
  if (/fog|mist/i.test(w)) options.push(`Fog lay over ${town}; people kept indoors.`);
  if (inp.namedDay) options.push(`${inp.namedDay} drew people out across ${town}.`);
  const recent = new Set(inp.recentArrivals.map((a) => a.text));
  const fresh = options.filter((o) => !recent.has(o));
  return fresh.length ? fresh[Math.floor(rand() * fresh.length)] : null;
}

/** A player's story for someone: the kind from their words, grounded on the person's record. */
export function authorArc(o: { roster: Roster; name: string; premise: string; now: number; arcs: ArcState[] }): string | null {
  const lead = o.roster.find(o.name);
  if (!lead) return null;
  const kind = (Object.values(SPECS).find((s) => s.kind !== "world" && s.kind !== "pursuit" && s.words.test(o.premise))?.kind ?? "pursuit") as ArcKind;
  const spec = SPECS[kind];
  const cast = namesIn(o.premise, o.roster).filter((a) => a !== lead && !a.group).map((a) => a.name);
  let id = slug(`${lead.name.split(/\s+/)[0]}-${kind}`);
  for (let i = 2; o.arcs.some((a) => a.id === id && (a.status === "running" || a.status === "held")); i++) id = `${slug(`${lead.name.split(/\s+/)[0]}-${kind}`)}-${i}`;
  return arcNewLine({ id, kind, lead: lead.name, cast, secrecy: spec.secrecy, clock: spec.clock, heat: 1, at: o.now, premise: o.premise, want: spec.want, fear: spec.fear, grounds: [lead.recordId ?? `char:${lead.key}`, "player"], by: "player" });
}

export { awakeAt };
