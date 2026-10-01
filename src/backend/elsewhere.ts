// Elsewhere in the backend (design/09): after each reply the engine ticks the world off the page
// (deterministic, milliseconds) and anchors its lines like the simulator before it; the telling
// call dresses the beats in the background; the planner puts what reaches the scene in the note;
// and after the next reply, the arrivals it took up are marked used.

import { anchorKey } from "../core/branch";
import { buildCodex } from "../core/codex";
import { parseLine } from "../core/dsl";
import { offPageFacts } from "../core/offpage";
import { extractJson } from "../core/prompts";
import { NOT_A_PERSON } from "../core/state";
import type { ParsedOp, Settings, WorldState } from "../core/types";
import { absMinutes, estTokens, hash, plainProse } from "../core/util";
import { confirmArrivals, elsewhereLane, upgradeArrival, type Arrival } from "../core/elsewhere/crossings";
import { buildRoster, type Profile } from "../core/elsewhere/roster";
import { authorArc, tick, type BeatCard, type Mode } from "../core/elsewhere/storyteller";
import { tellingPrompt, validateProfile, validateSeed, validateTold, type TellingCtx } from "../core/elsewhere/telling";
import { debug, describe, serial, warn } from "./host";
import { ledgerFor } from "./ledger";
import { quiet, sys, usr } from "./llm";
import { loadChat, loadSettings, noteProblem, save, type ChatMeta } from "./store";

export interface TickRecord {
  id: string;
  at: number;
  anchor: number;
  from: number;
  to: number;
  hours: number;
  beats: number;
  seeds: number;
  hops: number;
  arrivals: number;
  status: "engine" | "telling" | "told" | "failed";
  tokens?: number;
  log: string[];
  awake: string[];
  /** Kept until the telling is done. */
  cards?: BeatCard[];
  lines?: string[];
  rejected?: string[];
}

export interface ElsewhereMeta {
  ticks: Record<string, TickRecord>;
  order: string[];
  profiles: Record<string, Profile>;
  seen: Record<string, number>;
  lastPlace?: string;
  lastTickAbs?: number;
  lastTick?: string;
  forced?: number;
}

export function elsewhereOf(meta: ChatMeta): ElsewhereMeta {
  const m = meta as ChatMeta & { elsewhere?: ElsewhereMeta };
  const e = (m.elsewhere ??= { ticks: {}, order: [], profiles: {}, seen: {} });
  e.ticks ??= {};
  e.order ??= [];
  e.profiles ??= {};
  e.seen ??= {};
  return e;
}

export function modeOf(meta: ChatMeta, settings: Settings): "off" | Mode {
  return meta.config.elsewhere?.mode ?? settings.elsewhere ?? "off";
}

function notPeople(meta: ChatMeta): string[] {
  return Object.entries(meta.config.merges ?? {}).filter(([, to]) => to === NOT_A_PERSON).map(([n]) => n);
}

const SIM_ID = "ew:";
const busy = new Set<string>();

/** The arrivals list, with old (pre-Elsewhere) ones read in the new shape. */
export function arrivalsOf(meta: ChatMeta): Arrival[] {
  meta.arrivals = (meta.arrivals as Arrival[]).map(upgradeArrival);
  return meta.arrivals as Arrival[];
}

function pruneArrivals(list: Arrival[]): Arrival[] {
  if (list.length <= 40) return list;
  const done = list.filter((a) => a.status === "used" || a.status === "expired");
  const drop = new Set(done.slice(0, list.length - 40).map((a) => a.id));
  return list.filter((a) => !drop.has(a.id)).slice(-40);
}

/** Write (or replace) one tick's lines as an anchored simulator entry. */
function putLines(files: Awaited<ReturnType<typeof loadChat>>, index: number, id: string, lines: string[]) {
  const ops = lines.map((l) => parseLine(l)).filter((o): o is ParsedOp => !!o);
  const key = anchorKey(index);
  const rest = (files.side[key] ?? []).filter((s) => s.id !== id);
  if (ops.length) files.side[key] = [...rest, { source: "sim", ops, id, at: Date.now() }];
  else if (rest.length) files.side[key] = rest;
  else delete files.side[key];
}

/**
 * One tick of the world off the page, when story time has moved a step (or the player asked).
 * `force`: advance a step even if the clock hasn't. Decisions the player made (a fate, a bring-in)
 * are acted on at once, without advancing time.
 */
export async function runElsewhere(chatId: string, userId?: string, opts: { force?: boolean } = {}): Promise<TickRecord | null> {
  const settings = await loadSettings(userId);
  const files = await loadChat(chatId, userId);
  const meta = files.meta;
  const mode = modeOf(meta, settings);
  if (mode === "off" && !opts.force) return null;
  if (busy.has(chatId)) return null;
  busy.add(chatId);
  try {
    const rec = await serial(`chat:${chatId}`, async () => {
      const L = ledgerFor(chatId, userId);
      await L.refresh();
      const st = L.state;
      const target = L.lastAssistant();
      if (!st?.time || !target) return null;
      const E = elsewhereOf(meta);
      const now = absMinutes(st.time);
      const step = Math.max(10, settings.simStep);
      let last = E.lastTickAbs ?? meta.lastSimAbs;
      if (last == null) {
        E.lastTickAbs = meta.lastSimAbs = now;
        save(chatId, "meta", userId);
        if (!opts.force) return null;
        last = now;
      }
      // The clock moved back (the player said "it's day 12"): count again from here.
      if (now < last) {
        E.lastTickAbs = meta.lastSimAbs = now;
        save(chatId, "meta", userId);
        if (!opts.force) return null;
        last = now;
      }
      const arcs = Object.values(st.arcs ?? {});
      const decisions = arcs.some((a) => a.status === "running" && (a.fate?.decision || (a.bring && !arrivalsOf(meta).some((x) => x.arc === a.id && (x.status === "pending" || x.status === "offered")))));
      const due = now - last >= step;
      if (!due && !opts.force && !decisions) return null;
      let from = last;
      let tickId = `w${Math.floor(now / step)}`;
      if (opts.force && !due) {
        E.forced = (E.forced ?? 0) + 1;
        from = now - step;
        tickId = `${tickId}f${E.forced}`;
      } else if (!due) {
        from = now;
        tickId = `${tickId}d${arcs.filter((a) => a.fate?.decision || a.bring).length}x${E.order.length}`;
      }
      if (E.ticks[tickId] && !opts.force) tickId = `${tickId}r${E.order.length}`;
      const al = L.almanac(meta, settings);
      const named = al?.calendar?.named?.find((n) => al.date.includes(n.name) || al.clock.includes(n.name))?.name ?? null;
      const res = tick({
        chatId, tickId, state: st, records: L.records, userName: L.names.user, mode: mode === "off" ? "living" : mode,
        canonGravity: settings.canonGravity ?? "light", fates: settings.fates ?? "ask", genres: meta.detected.genres ?? meta.config.genres ?? [],
        from, now, anchorIndex: target.index, people: meta.config.elsewhere?.people, profiles: E.profiles, notPeople: notPeople(meta),
        offPage: offPageFacts(st, settings.secretsOffPage !== false), world: meta.lore.world?.agenda ? meta.lore.world : null,
        pressures: settings.pressures ? meta.pressures : {}, recentArrivals: arrivalsOf(meta), recentText: L.path.slice(-40).map((m) => m.content).join("\n"),
        namedDay: named, truths: meta.config.truths ?? [], prevTick: E.lastTick,
      });
      const id = `${SIM_ID}${tickId}`;
      putLines(files, target.index, id, res.lines);
      const list = arrivalsOf(meta);
      for (const a of res.arrivals) list.push({ ...a, msgId: target.id, swipe: target.swipe } as Arrival);
      meta.arrivals = pruneArrivals(list);
      const telling = settings.elsewhereTelling !== "engine" && res.cards.length > 0;
      const record: TickRecord = {
        id: tickId, at: Date.now(), anchor: target.index, from, to: now, hours: Math.round(res.hours * 10) / 10,
        beats: res.cards.filter((c) => !c.seed && !c.ending).length, seeds: res.seeded.length, hops: res.hops.length, arrivals: res.arrivals.length,
        status: telling ? "telling" : "engine", log: res.log.slice(0, 40), awake: res.awake, ...(telling ? { cards: res.cards, lines: res.lines } : {}),
      };
      E.ticks[tickId] = record;
      E.order = [...E.order.filter((x) => x !== tickId), tickId];
      for (const old of E.order.slice(0, -12)) delete E.ticks[old];
      E.order = E.order.slice(-12);
      if (due || opts.force) {
        E.lastTickAbs = meta.lastSimAbs = now;
        E.lastTick = tickId;
      }
      save(chatId, "side", userId);
      save(chatId, "meta", userId);
      await L.refresh();
      debug(`elsewhere ${chatId} ${tickId}: ${res.lines.length} lines, ${res.cards.length} cards, ${res.arrivals.length} arrivals`);
      return record;
    });
    if (rec?.status === "telling") tell(chatId, rec.id, userId).catch((err) => noteProblem(chatId, userId, "Elsewhere (telling)", err));
    return rec;
  } finally {
    busy.delete(chatId);
  }
}

/** Set (or add) one `key: value` field of an Elsewhere line. */
export function setField(line: string, key: string, value: string): string {
  const v = value.replace(/\s*\|\s*/g, " / ").replace(/\s*\n+\s*/g, " ").trim();
  const parts = line.split(" | ");
  const i = parts.findIndex((p, j) => j > 0 && p.startsWith(`${key}: `));
  if (i >= 0) parts[i] = `${key}: ${v}`;
  else parts.push(`${key}: ${v}`);
  return parts.join(" | ");
}

/** The telling call for one tick: the model dresses the cards; the validator keeps it honest. */
export async function tell(chatId: string, tickId: string, userId?: string): Promise<void> {
  const settings = await loadSettings(userId);
  const files = await loadChat(chatId, userId);
  const meta = files.meta;
  const E = elsewhereOf(meta);
  const rec = E.ticks[tickId];
  if (!rec?.cards?.length || !rec.lines) return;
  const L = ledgerFor(chatId, userId);
  await L.refresh();
  const st = L.state;
  const roster = buildRoster({ state: st, records: L.records, userName: L.names.user, notPeople: notPeople(meta), people: meta.config.elsewhere?.people, profiles: E.profiles });
  const off = offPageFacts(st, settings.secretsOffPage !== false);
  // People awake this tick whose standing and whereabouts only the lore text knows.
  const profile = roster.actors
    .filter((a) => rec.awake.includes(a.name) && a.ring === "unmet" && a.lore && E.profiles[a.key]?.hash !== hash(a.lore))
    .slice(0, 4)
    .map((a) => ({ key: a.key, name: a.name, text: a.lore }));
  const world = meta.lore.world;
  const ctx: TellingCtx = {
    userName: L.names.user, roster, offPage: off,
    truths: [...(meta.config.truths ?? []), ...st.canon.filter((c) => c.pinned).map((c) => c.text)], holds: world?.holds,
    lang: meta.detected.lang, recent: Object.values(st.arcs ?? {}).flatMap((a) => a.beats.map((b) => b.text)).filter((t) => !rec.cards!.some((c) => c.template === t)).slice(-10),
    places: [...Object.values(st.places).flatMap((p) => [p.name, ...p.path]), ...L.records.filter((r) => r.kind === "place" || r.kind === "group").map((r) => r.name)],
    objects: Object.values(st.items).map((i) => i.name), profile,
  };
  const p = tellingPrompt(rec.cards, ctx);
  let text = "";
  try {
    text = await quiet([sys(p.system), usr(p.user)], { userId, connectionId: settings.simConnection || undefined, reasoningOff: true, timeoutMs: 120_000, label: "Elsewhere" });
  } catch (err) {
    rec.status = "failed";
    delete rec.cards;
    delete rec.lines;
    save(chatId, "meta", userId);
    throw err;
  }
  const res = extractJson<{ beats?: any[]; seeds?: any[]; profiles?: any[] }>(text);
  await serial(`chat:${chatId}`, async () => {
    const fresh = await loadChat(chatId, userId);
    const m = fresh.meta;
    const E2 = elsewhereOf(m);
    const r2 = E2.ticks[tickId];
    if (!r2?.lines || !r2.cards) return;
    const lines = [...r2.lines];
    const rejected: string[] = [];
    const extra = new Map<number, string[]>();
    const list = arrivalsOf(m);
    for (const card of r2.cards) {
      if (card.seed) {
        const raw = (res?.seeds ?? []).find((s) => s?.card === card.id);
        if (!raw) continue;
        const v = validateSeed(card, raw, ctx);
        if (v.rejected || !v.seed) {
          rejected.push(`${card.arcId} (seed): ${v.rejected}`);
          continue;
        }
        if (/\| by: player\b/.test(lines[card.line])) continue;
        lines[card.line] = setField(setField(setField(lines[card.line], "premise", v.seed.premise), "want", v.seed.want), "fear", v.seed.fear);
        continue;
      }
      const raw = (res?.beats ?? []).find((b) => b?.card === card.id);
      if (!raw) continue;
      const v = validateTold(card, raw, ctx);
      if (v.rejected || !v.text) {
        rejected.push(`${card.arcId}: ${v.rejected}`);
        continue;
      }
      lines[card.line] = setField(setField(lines[card.line], "told", "model"), "text", v.text);
      if (v.lines.length) extra.set(card.line, v.lines);
      if (v.arrival) for (const a of list) if (a.tick === tickId && a.arc === card.arcId && a.status !== "used") a.text = v.arrival;
      // The beat's own wording rides the carrier and the trace when the model gave no arrival.
      if (!v.arrival) for (const a of list) if (a.tick === tickId && a.arc === card.arcId && a.template && (a.kind === "trace" || a.kind === "ambient")) a.text = a.template.replace(card.template, v.text);
    }
    // Extra lines go right after their card's line (from the end, so the indexes hold).
    for (const i of [...extra.keys()].sort((a, b) => b - a)) lines.splice(i + 1, 0, ...extra.get(i)!);
    for (const pr of res?.profiles ?? []) {
      const who = ctx.profile?.find((x) => x.key === pr?.key);
      const v = who ? validateProfile(pr, hash(who.text)) : null;
      if (who && v) E2.profiles[who.key] = v;
    }
    putLines(fresh, r2.anchor, `${SIM_ID}${tickId}`, lines);
    r2.status = res ? "told" : "failed";
    r2.tokens = estTokens(p.system + p.user) + estTokens(text);
    r2.rejected = res ? rejected : ["the reply wasn't JSON"];
    delete r2.cards;
    delete r2.lines;
    save(chatId, "side", userId);
    save(chatId, "meta", userId);
    await ledgerFor(chatId, userId).refresh();
  });
  const { pushState } = await import("./view");
  pushState(chatId, userId);
}

/**
 * The note's [ELSEWHERE] lane for this turn. Unless it's a dry run, it remembers what it offered,
 * whom it showed returning, and where the scene was.
 */
export function elsewhereNote(o: { state: WorldState; records: ReturnType<typeof buildCodex>; userName: string; meta: ChatMeta; settings: Settings; tier: "routine" | "charged" | "pivotal"; onPath: (msgId: string) => boolean; dryRun?: boolean }): string {
  const mode = modeOf(o.meta, o.settings);
  const E = elsewhereOf(o.meta);
  const list = arrivalsOf(o.meta);
  const roster = buildRoster({ state: o.state, records: o.records, userName: o.userName, notPeople: notPeople(o.meta), people: o.meta.config.elsewhere?.people, profiles: E.profiles });
  const working = o.dryRun ? list.map((a) => ({ ...a, offered: [...(a.offered ?? [])] })) : list;
  const lane = elsewhereLane({
    state: o.state, arrivals: working, roster, now: o.state.time ? absMinutes(o.state.time) : null, at: o.state.msgCount, tier: o.tier,
    mode: mode === "off" ? (list.some((a) => a.status === "pending" || a.status === "offered") ? "quiet" : "off") : mode, onPath: o.onPath, seen: E.seen, lastPlace: E.lastPlace,
  });
  if (!o.dryRun) {
    E.seen = lane.seen;
    E.lastPlace = lane.place;
  }
  return mode === "off" && !lane.offered.length ? "" : lane.text;
}

/** After a reply: which offered arrivals it took up. */
export function confirmElsewhere(meta: ChatMeta, o: { state: WorldState; records: ReturnType<typeof buildCodex>; userName: string; prose: string; settings: Settings }): boolean {
  const list = arrivalsOf(meta);
  if (!list.some((a) => a.status === "offered")) return false;
  const E = elsewhereOf(meta);
  const roster = buildRoster({ state: o.state, records: o.records, userName: o.userName, notPeople: notPeople(meta), people: meta.config.elsewhere?.people, profiles: E.profiles });
  const r = confirmArrivals(list, { prose: plainProse(o.prose), roster, at: o.state.msgCount });
  return r.used.length + r.dropped.length > 0 || list.some((a) => a.status === "pending");
}

/** The player's controls: hold, resume, nudge, bring in, drop, edit, fates, a story of their own. */
export async function elsewhereAction(chatId: string, m: { action: string; id?: string; name?: string; premise?: string; want?: string; fear?: string; decision?: string }, userId?: string): Promise<string | null> {
  const L = ledgerFor(chatId, userId);
  await L.refresh();
  const st = L.state;
  const arc = m.id ? st.arcs?.[m.id] : undefined;
  const now = st.time ? absMinutes(st.time) : 0;
  let line: string | null = null;
  switch (m.action) {
    case "hold": line = arc ? `arc set #${arc.id}: status: held` : null; break;
    case "resume": line = arc ? `arc set #${arc.id}: status: running | next: ${now}` : null; break;
    case "nudge": line = arc ? `arc set #${arc.id}: next: ${now} | heat: ${Math.min(3, arc.heat + 1)}` : null; break;
    case "bring": line = arc ? `arc set #${arc.id}: bring: yes | next: ${now}` : null; break;
    case "drop": line = arc ? `arc drop #${arc.id}: reason: dropped by the player` : null; break;
    case "edit": {
      if (!arc) break;
      const f = [m.premise ? `premise: ${m.premise}` : "", m.want ? `want: ${m.want}` : "", m.fear ? `fear: ${m.fear}` : ""].filter(Boolean);
      line = f.length ? `arc set #${arc.id}: ${f.join(" | ").replace(/\n+/g, " ")}` : null;
      break;
    }
    case "fate": line = arc && ["accept", "soften", "page"].includes(m.decision ?? "") ? `arc set #${arc.id}: fate: ${m.decision}` : null; break;
    case "author": {
      if (!m.name || !m.premise) break;
      const files = await loadChat(chatId, userId);
      const roster = buildRoster({ state: st, records: L.records, userName: L.names.user, notPeople: notPeople(files.meta), people: files.meta.config.elsewhere?.people, profiles: elsewhereOf(files.meta).profiles });
      line = authorArc({ roster, name: m.name, premise: m.premise.replace(/\s*\|\s*/g, " / ").replace(/\n+/g, " ").slice(0, 300), now, arcs: Object.values(st.arcs ?? {}) });
      if (!line) return `No one called “${m.name}” is in the roster.`;
      break;
    }
  }
  if (!line) return "Nothing to change.";
  const target = L.lastAssistant();
  if (!target) return "The chat has no reply to anchor this to yet.";
  const op = parseLine(line);
  if (!op) return "That couldn't be recorded.";
  const files = await loadChat(chatId, userId);
  const key = anchorKey(target.index);
  files.side[key] = [...(files.side[key] ?? []), { source: "user", ops: [op], id: `ewu:${Date.now().toString(36)}`, at: Date.now() }];
  save(chatId, "side", userId, 0);
  await L.refresh();
  // Fates and bring-ins act at once.
  if (m.action === "fate" || m.action === "bring") await runElsewhere(chatId, userId).catch((err) => warn(`elsewhere: ${describe(err)}`));
  return null;
}

/** What the Elsewhere page shows. */
export function elsewhereView(o: { state: WorldState; records: ReturnType<typeof buildCodex>; userName: string; meta: ChatMeta; settings: Settings; fmt: (abs: number) => string }) {
  const { state: st, meta } = o;
  const E = elsewhereOf(meta);
  const list = arrivalsOf(meta);
  const roster = buildRoster({ state: st, records: o.records, userName: o.userName, notPeople: notPeople(meta), people: meta.config.elsewhere?.people, profiles: E.profiles });
  const recName = new Map(o.records.map((r) => [r.id, r.name]));
  const groundName = (g: string) => (g.startsWith("#") ? g : g === "player" ? "your words" : recName.get(g) ?? g.replace(/^(char|lore|loc|thread|fac|cons|bond|pressure):/, "").replace(/_/g, " "));
  const order: Record<string, number> = { fate: 0, running: 1, held: 2, resolved: 3, dropped: 4 };
  const arcs = Object.values(st.arcs ?? {})
    .sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5) || (b.lastBeatAbs ?? b.startedAbs) - (a.lastBeatAbs ?? a.startedAbs))
    .slice(0, 30)
    .map((a) => ({
      id: a.id, kind: a.kind, lead: a.lead, cast: a.cast, premise: a.premise, want: a.want, fear: a.fear, secrecy: a.secrecy, clock: a.clock, tally: a.tally, stage: a.stage,
      status: a.status, crossed: !!a.crossed, by: a.by, locked: !!a.locked, heat: a.heat, note: a.note, ending: a.ending ? { ...a.ending, at: o.fmt(a.ending.atAbs) } : null, fate: a.fate ?? null,
      grounds: a.grounds.map((g) => ({ id: g, name: groundName(g) })), earlier: a.earlier ?? "",
      beats: a.beats.slice(-6).map((b) => ({ at: o.fmt(b.atAbs), result: b.result, roll: b.roll, mod: b.mod, text: b.text, told: b.told, twist: b.twist ?? "" })),
      reaches: list.filter((x) => x.arc === a.id && (x.status === "pending" || x.status === "offered")).map((x) => ({ kind: x.kind, text: x.text, at: x.atAbs != null ? o.fmt(x.atAbs) : "", carrier: x.carrier ?? "" })),
    }));
  const ticks = E.order.map((id) => E.ticks[id]).filter(Boolean).reverse().map((t) => ({ id: t.id, at: t.at, from: o.fmt(t.from), to: o.fmt(t.to), hours: t.hours, beats: t.beats, seeds: t.seeds, hops: t.hops, arrivals: t.arrivals, status: t.status, tokens: t.tokens ?? 0, log: t.log, rejected: t.rejected ?? [], awake: t.awake }));
  const awake = new Set(ticks[0]?.awake ?? []);
  const leads = new Set(Object.values(st.arcs ?? {}).filter((a) => a.status === "running" || a.status === "held" || a.status === "fate").map((a) => a.lead.toLowerCase()));
  const people = roster.actors.map((a) => ({
    name: a.name, ring: a.ring, standing: a.standing, where: a.where ?? "", reach: a.reach, awake: awake.has(a.name), arc: a.names.some((n) => leads.has(n.toLowerCase())),
    flags: meta.config.elsewhere?.people?.[a.name.toLowerCase()] ?? {}, ties: a.ties.filter((t) => t.strength >= 2).length,
  }));
  return {
    mode: modeOf(meta, o.settings), chatMode: meta.config.elsewhere?.mode ?? null, view: o.settings.elsewhereView ?? "director",
    telling: o.settings.elsewhereTelling, canonGravity: o.settings.canonGravity, fates: o.settings.fates, step: o.settings.simStep,
    arcs, ticks: ticks.slice(0, 6), people, town: roster.town ?? "",
    arrivals: list.slice(-20).reverse().map((x) => ({ id: x.id, kind: x.kind, status: x.status, text: x.text, at: x.atAbs != null ? o.fmt(x.atAbs) : "", carrier: x.carrier ?? "", lead: x.lead ?? "", arc: x.arc ?? "", why: x.why ?? "" })),
  };
}
