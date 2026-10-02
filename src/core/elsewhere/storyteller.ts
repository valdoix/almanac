// The storyteller (design/09 §6): one tick of the world off the page. Deterministic for a chat
// and a stretch of story time, and entirely the engine's: who is awake, what news travels,
// which subplots move or begin, how the dice fall, what twists, what ends, and how each beat
// could reach the scene. The model only tells the result afterwards (telling.ts).

import type { CodexRecord } from "../codex";
import type { WeaverWorld } from "../lore";
import type { OffPage } from "../offpage";
import type { ArcKind, ArcStage, ArcState, BeatResult, ElsewhereConfig, WorldState } from "../types";
import { rng, slug } from "../util";
import { arcNewLine, awakeAt, beatLine, cleanVal, gate, isLight, namesIn, seedCandidates, sentence, threadLatest, type GateResult, type SeedCand } from "./arcs";
import { routeFor, soughtOf, type Arrival } from "./crossings";
import { beatTemplate, endTemplate, groupName, kindForStory, SPECS, stageOf, wantFromStory, type RouteKind } from "./grammar";
import { spreadNews, type Hop } from "./news";
import { awakeSet, buildRoster, canAct, hasFact, type Actor, type Profile, type Roster } from "./roster";

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
  /** The player moved the world a step: the whole step counts, and something moves if anything can. */
  forced?: boolean;
  /** New subplots the world grounds itself: start them (auto), propose them to the player (ask), or none (off). */
  seeding?: "auto" | "ask" | "off";
  /** Declined proposals by `proposalKey` (never proposed again), and `lead:name` for a lead with one waiting. */
  proposalKeys?: string[];
  /** How many proposals are waiting (they take room, like running subplots). */
  pendingProposals?: number;
}

/** A subplot the world grounded, waiting for the player to accept or decline it. */
export interface Proposal {
  id: string;
  /** Lead, kind and grounds: a declined proposal isn't made again. */
  key: string;
  /** The `arc new` line written when it's accepted. */
  line: string;
  kind: ArcKind;
  lead: string;
  cast: string[];
  premise: string;
  want: string;
  fear: string;
  secrecy: "public" | "private" | "secret";
  grounds: string[];
  why: string;
  /** Story time it was proposed at. */
  atAbs: number;
  /** A light subplot of the same lead that gives way if it's accepted. */
  replaces?: string;
}

export const proposalKey = (lead: string, kind: string, grounds: string[]) => `${lead.toLowerCase()}|${kind}|${[...grounds].sort().join(",")}`;

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
  /** What the grounds say (a group, a fact, a thread), so the telling stays on them. */
  groundText?: string[];
  /** The subplot's last beats, so the telling continues it. */
  sofar?: string[];
  /** Pushed through out of the lead's hours. */
  offHours?: string;
  knows: string[];
  noRoute: string[];
  /** Whom the subplot is looking for: the lead doesn't know where they are until it ends. */
  sought?: string[];
  /** Facts the story has established about the lead and cast (names and specifics for the telling; not what the lead knows). */
  established?: string[];
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
  /** A seed card for a proposal (its `id`): the telling rewrites the proposal, not a line. */
  proposal?: string;
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
  proposals: Proposal[];
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
  const offKeys = new Set(inp.offPage.map((x) => x.key));
  // The first other person in a subplot, by name (whom the lead courts, owes, fights).
  const otherOf = (arc: ArcState) => arc.cast.find((n) => { const a = roster.find(n); return !!a && !a.group; });
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
    const text = endTemplate({ kind: arc.kind, lead: arc.lead, want: arc.want, fear: arc.fear, result, group: !!lead?.group, cast: otherOf(arc), town });
    lines.push(`arc end #${arc.id}: ${result} | text: ${cleanVal(text)}`);
    cards.push(cardFor(arc, lead, roster, st, { result, roll: [0, 0], mod: 0, stage: "aftermath", atAbs: inp.now, template: text, line: lines.length - 1, ending: true, fateOk: d === "accept", offPage: inp.offPage, records: inp.records }));
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
  type Cand = { arc: ArcState; lead?: Actor; fresh?: SeedCand; prio: number; r?: number; push?: boolean };
  const cands: Cand[] = [];
  const running = arcs.filter((a) => a.status === "running" && !lines.some((l) => l.startsWith(`arc drop #${a.id}:`) || l.startsWith(`arc end #${a.id}:`)));
  for (const arc of running) {
    const lead = leadOf(arc);
    if (lead?.ring === "onstage" || arc.clock.cur >= arc.clock.max || arc.fate) continue;
    if (arc.bring || arc.push) {
      cands.push({ arc, lead, prio: 3, push: true });
      continue;
    }
    const spec = SPECS[arc.kind];
    const lambda = spec.base * (1 + arc.heat / 2) * STAGE_F[arc.stage] * M.factor;
    // A step the player asked for counts in full, for any subplot whose cooldown ends within it.
    const span = inp.forced ? (arc.nextAbs <= inp.now + (inp.now - inp.from) ? hours : 0) : Math.max(0, (inp.now - Math.max(inp.from, arc.nextAbs)) / 60);
    const p = 1 - Math.exp(-lambda * span);
    if (rand() < p) cands.push({ arc, lead, prio: 1 + Math.min(1, (inp.now - (arc.lastBeatAbs ?? arc.startedAbs)) / 1440) });
  }

  // 6. New subplots, while there is room: started, or proposed to the player.
  const seeded: string[] = [];
  const proposals: Proposal[] = [];
  const seeding = inp.seeding ?? "auto";
  const pending = seeding === "ask" ? inp.pendingProposals ?? 0 : 0;
  const liveArcs = [...running, ...arcs.filter((a) => a.status === "held" || a.status === "fate")];
  const live = liveArcs.length + pending;
  const room = M.arcs - live;
  // The player's own stories don't make the world busy: with none of its own yet, the world seeds at once.
  const own = liveArcs.filter((a) => a.by !== "player").length + pending;
  const seedP = own === 0 ? 1 : 1 - Math.exp(-0.06 * M.factor * (1 + (2 * room) / M.arcs) * Math.max(hours, 1));
  if (seeding !== "off" && room > 0 && (hours > 0 || inp.forced || inp.tickId.includes("f")) && rand() < seedP) {
    const skip = new Set(inp.proposalKeys ?? []);
    const pool = seedCandidates({ state: st, roster, records: inp.records, awake, arcs, canonGravity: inp.canonGravity, genres: inp.genres, world: inp.world, pressures: inp.pressures, now: inp.now })
      .filter((c) => !skip.has(proposalKey(c.lead.name, c.kind, c.grounds)) && !skip.has(`lead:${c.lead.name.toLowerCase()}`));
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
      // Variety: one new subplot of a kind per step (three people's "ordinary life" at once is filler).
      for (let j = pool.length - 1; j >= 0; j--) if (pool[j].kind === c.kind && !pool[j].faction) pool.splice(j, 1);
      const light = arcs.find((a) => isLight(a) && a.lead.toLowerCase() === c.lead.name.toLowerCase());
      if (seeding === "ask") {
        // Proposed: it waits for the player, who sees what it rests on.
        const line = arcNewLine({ id: c.id, kind: c.kind, lead: c.lead.name, cast: c.cast.map((a) => a.name), secrecy: c.secrecy, clock: c.clock, cur: c.cur, heat: c.heat, at: inp.now, premise: c.premise, want: c.want, fear: c.fear, grounds: c.grounds, place: c.place, by: c.by, faction: c.faction });
        const pr: Proposal = {
          id: c.id, key: proposalKey(c.lead.name, c.kind, c.grounds), line, kind: c.kind, lead: c.lead.name, cast: c.cast.map((a) => a.name), premise: c.premise, want: c.want, fear: c.fear,
          secrecy: c.secrecy, grounds: c.grounds, why: c.why, atAbs: inp.now, ...(light ? { replaces: light.id } : {}),
        };
        proposals.push(pr);
        log.push(`proposed ${c.id} (${c.kind}, ${c.lead.name}) from ${c.why}`);
        const arc: ArcState = {
          id: c.id, kind: c.kind, lead: c.lead.name, cast: pr.cast, premise: c.premise, want: c.want, fear: c.fear, grounds: c.grounds, secrecy: c.secrecy,
          clock: { cur: c.cur ?? 0, max: c.clock }, tally: { win: 0, cost: 0, loss: 0 }, heat: c.heat, stage: "setup", beats: [], nextAbs: inp.now, status: "running", by: c.by, place: c.place,
          startedAbs: inp.now, startedMsg: inp.anchorIndex, faction: c.faction,
        };
        cards.push({ ...cardFor(arc, c.lead, roster, st, { result: "cost", roll: [0, 0], mod: 0, stage: "setup", atAbs: inp.now, template: c.premise, line: -1, seed: true, offPage: inp.offPage, records: inp.records }), id: `p${proposals.length}`, proposal: c.id });
        continue;
      }
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
      cards.push(cardFor(arc, c.lead, roster, st, { result: "cost", roll: [0, 0], mod: 0, stage: "setup", atAbs: at, template: c.premise, line: lines.length - 1, seed: true, offPage: inp.offPage, records: inp.records }));
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
      if (pass === 0 && lastTickLeads.has(c.arc.lead) && !c.push) continue;
      if ((perKind.get(c.arc.kind) ?? 0) >= kindCap && c.prio < 3) continue;
      chosen.push(c);
      perKind.set(c.arc.kind, (perKind.get(c.arc.kind) ?? 0) + 1);
    }
  }

  // 8. The beats: gate, dice, twist, clock, ending, route.
  const collided = new Set<string>();
  let moved = 0;
  const tried = new Set<string>();
  const doBeat = (arc: ArcState, lead: Actor | undefined, forced?: { atAbs: number; place?: string; twist?: string }, push?: boolean) => {
    tried.add(arc.id);
    const g: GateResult = forced ? { ok: true, mod: 0, atAbs: forced.atAbs, why: ["collision"] } : gate(arc, lead, roster, { from: inp.from, now: inp.now, rand, push, forced: inp.forced });
    if (!g.ok) {
      if (g.drop) lines.push(`arc drop #${arc.id}: reason: ${cleanVal(g.drop)}`);
      else if (g.deferTo != null) lines.push(`arc set #${arc.id}: next: ${g.deferTo}${g.wait ? ` | wait: ${cleanVal(g.wait)}` : ""}${arc.push ? " | push: no" : ""}`);
      log.push(`${arc.id}: held back (${g.drop ?? g.why.join(", ")})`);
      return;
    }
    moved++;
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
    // The news a subplot rests on, when the lead holds it (what a return begins with).
    const newsKey = arc.grounds.find((x) => x.startsWith("#"))?.slice(1);
    const newsFact = newsKey && !offKeys.has(newsKey) && lead && hasFact(lead, newsKey) ? st.facts?.[newsKey] : undefined;
    const text = beatTemplate({
      kind: arc.kind, lead: arc.lead, want: arc.want, stage: stage === "aftermath" ? "crisis" : stage, result, price, worse, place: shownPlace, premise: arc.premise, group: !!lead?.group,
      cast: otherOf(arc), town, news: newsFact?.statement,
    });
    const next = atAbs + Math.round(120 + rand() * 240 / M.factor);
    const twistLine = twistText ? sentence(/^ran into\b/.test(twistText) ? `${lead?.group ? groupName(arc.lead) : arc.lead} ${twistText}` : twistText) : "";
    lines.push(beatLine(arc.id, { result, roll, mod: g.mod, at: atAbs, text: twistLine ? `${text} ${twistLine}` : text, told: "template", twist: twistText, place, tick: inp.tickId, next }));
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

    const card = cardFor(arc, lead, roster, st, { result, roll, mod: g.mod, stage, atAbs, template: text, line: beatIdx, twist: twistText, price, worse, place, offPage: inp.offPage, records: inp.records, offHours: g.offHours });
    // The ending, when the clock fills.
    let ending = false;
    let endResult: "met" | "price" | "lost" | undefined;
    if (cur >= arc.clock.max) {
      ending = true;
      const tally = { ...arc.tally, [result]: arc.tally[result] + 1 };
      const final = d6(rand) + d6(rand) + tally.win - tally.loss;
      const end: "met" | "price" | "lost" = final >= 10 ? "met" : final >= 7 ? "price" : "lost";
      endResult = end;
      const irreversible = end === "lost" && spec.irreversible && !!lead?.protected;
      const endText = endTemplate({ kind: arc.kind, lead: arc.lead, want: arc.want, fear: arc.fear, result: end, price: pickOf(rand, spec.prices), group: !!lead?.group, cast: otherOf(arc), town });
      if (irreversible && inp.fates !== "allow") {
        lines.push(`arc set #${arc.id}: status: ${inp.fates === "ask" ? "fate" : "running"} | pending: ${cleanVal(endText)}${inp.fates === "page" ? " | fate: page" : ""}`);
        log.push(`${arc.id}: an irreversible ending waits on the player (${inp.fates})`);
      } else {
        lines.push(`arc end #${arc.id}: ${end} | text: ${cleanVal(endText)} | at: ${atAbs}`);
        cards.push(cardFor(arc, lead, roster, st, { result: end, roll: [0, 0], mod: final - tally.win + tally.loss, stage: "aftermath", atAbs, template: endText, line: lines.length - 1, ending: true, fateOk: inp.fates === "allow", offPage: inp.offPage, records: inp.records }));
        for (const l of consequences(arc, end, roster)) lines.push(l);
        log.push(`${arc.id}: ends (${end})`);
      }
    }
    cards.push(card);
    // How it could reach the scene.
    if (ending || slip || arc.bring || rand() < M.arrivalChance * (arc.kind === "life" ? (result === "cost" ? 0.2 : 0.5) : 1)) {
      const r = routeFor({ arc, lead, roster, routes: SPECS[arc.kind].routes, text, atAbs, place, result: endResult ?? result, slip, ending, lastRoute: lastRouteOf(arc.id) as RouteKind | undefined, recentKinds, town, onstage, tracePlaces });
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
  for (const c of chosen) if (!collided.has(c.arc.id)) doBeat(c.arc, c.lead, undefined, c.push);
  // The player moved the world a step: if the dice moved nothing, the most overdue subplot that can move does.
  if (inp.forced && !moved) {
    const waiting = running
      .filter((a) => !tried.has(a.id) && !collided.has(a.id) && !a.fate && a.clock.cur < a.clock.max && leadOf(a)?.ring !== "onstage")
      .sort((a, b) => Number(b.by === "player") - Number(a.by === "player") || a.nextAbs - b.nextAbs);
    for (const arc of waiting) {
      doBeat(arc, leadOf(arc));
      if (moved) break;
    }
  }

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

  return { tickId: inp.tickId, hours, lines, cards, arrivals, awake: awake.map((a) => a.name), hops, seeded, proposals, log, roster };
}

function cardFor(arc: ArcState, lead: Actor | undefined, r: Roster, st: WorldState, o: { result: BeatCard["result"]; roll: [number, number]; mod: number; stage: ArcStage; atAbs: number; template: string; line: number; twist?: string; price?: string; worse?: string; place?: string; ending?: boolean; seed?: boolean; fateOk?: boolean; offPage: OffPage[]; records: CodexRecord[]; offHours?: string }): BeatCard {
  const off = new Set(o.offPage.map((x) => x.key));
  const offWords = o.offPage.flatMap((x) => x.words.map((w) => w.toLowerCase()));
  const clean = (t: string) => (offWords.some((w) => w && t.toLowerCase().includes(w)) ? "" : t);
  // What the grounds say: a group's or a place's record, a fact, a thread (never the lead's own record: LEAD has it).
  const groundText = arc.grounds
    .filter((g) => g !== "player" && g !== lead?.recordId)
    .map((g) => {
      if (g.startsWith("#")) {
        const f = st.facts?.[g.slice(1)];
        return f && !off.has(f.key) && !f.hidden ? `${g}: ${f.statement}` : "";
      }
      const t = st.threads[g];
      if (t) return `${t.title}${threadLatest(t.latest) ? `: ${threadLatest(t.latest)}` : ""}`;
      const rec = o.records.find((x) => x.id === g);
      return rec ? `${rec.name}: ${rec.summary}` : "";
    })
    .map((t) => clean(t.slice(0, 200)))
    .filter(Boolean)
    .slice(0, 3);
  const sofar = arc.beats.slice(-2).map((b) => b.text);
  const knows = (lead?.knows ?? []).filter((k) => !off.has(k.key)).slice(-4).map((k) => `#${k.key} (${k.statement.slice(0, 80)})`);
  const noRoute = Object.values(st.facts ?? {}).filter((f) => !f.hidden && f.keepers?.length && lead && !(lead.charId && f.stances[lead.charId])).slice(0, 2).map((f) => `#${f.key}`);
  // What the story has settled about the people in it, so a telling can be specific: never a secret
  // kept from the lead, nothing off the page, nothing the lead already KNOWS.
  const who = [arc.lead, ...arc.cast].flatMap((n) => [n, ...(r.find(n)?.names ?? [])]).map((n) => n.split(/\s+/)[0]).filter((n) => n.length >= 3);
  const whoRe = who.length ? new RegExp(`\\b(?:${[...new Set(who)].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`) : null;
  const known = new Set((lead?.knows ?? []).map((k) => k.key));
  // About the lead (with whoever else it names); never the player's character.
  const leadRe = new RegExp(`\\b(?:${[arc.lead, ...(lead?.names ?? [])].map((n) => n.split(/\s+/)[0]).filter((n) => n.length >= 3).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") || "\\u0000"})\\b`);
  const userRe = new RegExp(`\\b${r.userName.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const established = whoRe ? Object.values(st.facts ?? {})
    .filter((f) => !f.hidden && !off.has(f.key) && !known.has(f.key) && f.truth !== "false" && (!f.keepers?.length || (lead?.charId && f.stances[lead.charId])) && whoRe.test(f.statement))
    .filter((f) => !userRe.test(f.statement) && leadRe.test(f.statement))
    .sort((a, b) => (b.lastMsg ?? 0) - (a.lastMsg ?? 0)).slice(0, 3).map((f) => clean(f.statement.slice(0, 140))).filter(Boolean) : [];
  return {
    id: `b${o.line}`, arcId: arc.id, kind: arc.kind, lead: arc.lead, cast: arc.cast, result: o.result, roll: o.roll, mod: o.mod, twist: o.twist, price: o.price, worse: o.worse, stage: o.stage,
    clock: `${Math.min(arc.clock.max, arc.clock.cur + (o.seed || o.ending ? 0 : 1))}/${arc.clock.max}`, atAbs: o.atAbs, where: o.place ?? lead?.where, premise: arc.premise, want: arc.want, fear: arc.fear,
    leadText: lead?.text ?? "", groundText, sofar, offHours: o.offHours, knows, noRoute, sought: soughtOf(arc, r).map((a) => a.name), established, grounds: arc.grounds, template: o.template, line: o.line, ending: o.ending, seed: o.seed, fateOk: o.fateOk,
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

/** How the model (or the player) shaped a story before it starts: all optional. */
export interface StoryShape {
  kind?: ArcKind;
  want?: string;
  fear?: string;
  cast?: string[];
  secrecy?: "public" | "private" | "secret";
  place?: string;
}

/**
 * A player's story for someone. The kind comes from what the lead does in their words (or the
 * shaping call), the want from what they say the lead is after; it is grounded on the lead's
 * record, the people and groups it names, and the player's word. It starts pushed: its first
 * step comes at once.
 */
export function authorArc(o: { roster: Roster; name: string; premise: string; now: number; arcs: ArcState[]; shape?: StoryShape | null }): string | null {
  const lead = o.roster.find(o.name);
  if (!lead) return null;
  const named = namesIn(o.premise, o.roster).filter((a) => a !== lead);
  const people = named.filter((a) => !a.group);
  const groups = named.filter((a) => a.group);
  const sh = o.shape ?? {};
  const kind: ArcKind = sh.kind && sh.kind !== "world" ? sh.kind : kindForStory(o.premise, lead.names, people.flatMap((a) => a.names));
  const spec = SPECS[kind];
  const castNames = sh.cast?.length ? sh.cast.map((n) => o.roster.find(n)).filter((a): a is Actor => !!a && a !== lead).map((a) => a.name) : [...people, ...groups].map((a) => a.name);
  // The player wrote it to matter: it can reach the story unless their words keep it secret.
  const secrecy = sh.secrecy ?? (/\b(secret(?:ly)?|in secret|hid(?:e|es|ing)|behind (?:\w+['’]s|her|his|their) back|tells? no one|nobody knows)\b/i.test(o.premise) ? "secret" : kind === "threat" ? "public" : "private");
  const want = sh.want ?? wantFromStory(o.premise) ?? spec.want;
  const fear = sh.fear ?? spec.fear;
  let id = slug(`${lead.name.split(/\s+/)[0]}-${kind}`);
  for (let i = 2; o.arcs.some((a) => a.id === id && (a.status === "running" || a.status === "held")); i++) id = `${slug(`${lead.name.split(/\s+/)[0]}-${kind}`)}-${i}`;
  const grounds = [lead.recordId ?? `char:${lead.key}`, ...groups.map((g) => g.recordId ?? g.key), "player"];
  return arcNewLine({ id, kind, lead: lead.name, cast: [...new Set(castNames)], secrecy, clock: spec.clock, heat: 2, at: o.now, premise: o.premise, want, fear, grounds: [...new Set(grounds)], place: sh.place, by: "player", push: true });
}

export { awakeAt };
