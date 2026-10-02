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
import type { ArcState, ParsedOp, Settings, WorldState } from "../core/types";
import { absMinutes, estTokens, hash, plainProse } from "../core/util";
import { callFits, collapseMessages, confirmArrivals, elsewhereLane, retellArrival, upgradeArrival, type Arrival } from "../core/elsewhere/crossings";
import { buildRoster, type Actor, type Profile, type Roster } from "../core/elsewhere/roster";
import { isLight } from "../core/elsewhere/arcs";
import { authorArc, cardForBeat, tick, type BeatCard, type Mode, type Proposal } from "../core/elsewhere/storyteller";
import { shapePrompt, tellingPrompt, validateProfile, validateSeed, validateShape, validateTold, type TellingCtx } from "../core/elsewhere/telling";
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
  /** Subplots proposed to the player this step. */
  proposed?: number;
  hops: number;
  arrivals: number;
  status: "engine" | "telling" | "told" | "failed";
  tokens?: number;
  log: string[];
  awake: string[];
  /** What the step was made of, and its lines as told (before the know/bond lines), so a step can be told again. */
  cards?: BeatCard[];
  lines?: string[];
  /** The telling's extra lines, by the index of the line they follow. */
  extra?: Record<number, string[]>;
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
  /** Subplots the world grounded, for the player to accept or decline. */
  proposals?: ProposalRec[];
  /** Keys of declined proposals: never made again. */
  declined?: string[];
}

export interface ProposalRec extends Proposal {
  status: "pending" | "accepted" | "declined" | "stale";
  tick: string;
  /** The model is still polishing its wording. */
  telling?: boolean;
  /** Why it went stale. */
  staleWhy?: string;
}

/** How long a proposal waits before the story has moved past it (story minutes). */
const PROPOSAL_SHELF = 3 * 1440;

export function elsewhereOf(meta: ChatMeta): ElsewhereMeta {
  const m = meta as ChatMeta & { elsewhere?: ElsewhereMeta };
  const e = (m.elsewhere ??= { ticks: {}, order: [], profiles: {}, seen: {} });
  e.ticks ??= {};
  e.order ??= [];
  e.profiles ??= {};
  e.seen ??= {};
  e.proposals ??= [];
  e.declined ??= [];
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
      const decisions = arcs.some((a) => a.status === "running" && (a.fate?.decision || a.push || (a.bring && !arrivalsOf(meta).some((x) => x.arc === a.id && (x.status === "pending" || x.status === "offered")))));
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
        tickId = `${tickId}d${arcs.filter((a) => a.fate?.decision || a.bring || a.push).length}x${E.order.length}`;
      }
      if (E.ticks[tickId] && !opts.force) tickId = `${tickId}r${E.order.length}`;
      // Proposals the story has moved past (the lead has a story now, or it waited three story days) go stale.
      for (const p of E.proposals!) {
        if (p.status !== "pending") continue;
        const busyLead = arcs.some((a) => (a.status === "running" || a.status === "held" || a.status === "fate") && !isLight(a) && a.lead.toLowerCase() === p.lead.toLowerCase());
        if (busyLead || now - p.atAbs > PROPOSAL_SHELF) Object.assign(p, { status: "stale", staleWhy: busyLead ? `${p.lead} has a story now` : "the story moved on" });
      }
      const waiting = E.proposals!.filter((p) => p.status === "pending");
      const al = L.almanac(meta, settings);
      const named = al?.calendar?.named?.find((n) => al.date.includes(n.name) || al.clock.includes(n.name))?.name ?? null;
      const res = tick({
        chatId, tickId, state: st, records: L.records, userName: L.names.user, mode: mode === "off" ? "living" : mode,
        canonGravity: settings.canonGravity ?? "light", fates: settings.fates ?? "ask", genres: meta.detected.genres ?? meta.config.genres ?? [],
        from, now, anchorIndex: target.index, people: meta.config.elsewhere?.people, profiles: E.profiles, notPeople: notPeople(meta),
        offPage: offPageFacts(st, settings.secretsOffPage !== false), world: meta.lore.world?.agenda ? meta.lore.world : null,
        pressures: settings.pressures ? meta.pressures : {}, recentArrivals: arrivalsOf(meta), recentText: L.path.slice(-40).map((m) => m.content).join("\n"),
        namedDay: named, truths: meta.config.truths ?? [], prevTick: E.lastTick, forced: !!opts.force && !due,
        seeding: settings.elsewhereSeeding ?? "ask", pendingProposals: waiting.length,
        proposalKeys: [...E.declined!, ...waiting.map((p) => `lead:${p.lead.toLowerCase()}`)],
      });
      const id = `${SIM_ID}${tickId}`;
      putLines(files, target.index, id, res.lines);
      const list = arrivalsOf(meta);
      for (const a of res.arrivals) list.push({ ...a, msgId: target.id, swipe: target.swipe } as Arrival);
      collapseMessages(list);
      meta.arrivals = pruneArrivals(list);
      const telling = settings.elsewhereTelling !== "engine" && res.cards.length > 0;
      for (const p of res.proposals) E.proposals!.push({ ...p, status: "pending", tick: tickId, ...(telling ? { telling: true } : {}) });
      E.proposals = E.proposals!.filter((p) => p.status === "pending").concat(E.proposals!.filter((p) => p.status !== "pending").slice(-10));
      const record: TickRecord = {
        id: tickId, at: Date.now(), anchor: target.index, from, to: now, hours: Math.round(res.hours * 10) / 10,
        beats: res.cards.filter((c) => !c.seed && !c.ending).length, seeds: res.seeded.length, proposed: res.proposals.length, hops: res.hops.length, arrivals: res.arrivals.length,
        status: telling ? "telling" : "engine", log: res.log.slice(0, 40), awake: res.awake, cards: res.cards, lines: res.lines,
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

/** Drop one `key: value` field of an Elsewhere line. */
export function dropField(line: string, key: string): string {
  return line.split(" | ").filter((p, j) => j === 0 || !p.startsWith(`${key}: `)).join(" | ");
}

/** A tick's lines with the telling's extra lines after the lines they follow. */
function withExtra(lines: string[], extra: Record<number, string[]> = {}): string[] {
  const out = [...lines];
  for (const i of Object.keys(extra).map(Number).sort((a, b) => b - a)) out.splice(i + 1, 0, ...extra[i]);
  return out;
}

/** What the telling call reads besides the cards: the roster, what's off the page, the story's truths and names. */
function tellingCtx(L: ReturnType<typeof ledgerFor>, meta: ChatMeta, settings: Settings, E: ElsewhereMeta, tickId: string, skip: string[], profile: TellingCtx["profile"]): TellingCtx {
  const st = L.state;
  const roster = buildRoster({ state: st, records: L.records, userName: L.names.user, notPeople: notPeople(meta), people: meta.config.elsewhere?.people, profiles: E.profiles });
  const world = meta.lore.world;
  return {
    userName: L.names.user, roster, offPage: offPageFacts(st, settings.secretsOffPage !== false),
    truths: [...(meta.config.truths ?? []), ...st.canon.filter((c) => c.pinned).map((c) => c.text)], holds: world?.holds,
    lang: meta.detected.lang, // Novelty against other steps: a step's own engine words (with any twist) don't count.
    recent: Object.values(st.arcs ?? {}).flatMap((a) => a.beats.filter((b) => b.tick !== tickId && !skip.includes(b.text)).map((b) => b.text)).slice(-10),
    places: [...Object.values(st.places).flatMap((p) => [p.name, ...p.path]), ...L.records.filter((r) => r.kind === "place" || r.kind === "group").map((r) => r.name)],
    objects: Object.values(st.items).map((i) => i.name), profile,
  };
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
  // People awake this tick whose standing and whereabouts only the lore text knows.
  const profile = roster.actors
    .filter((a) => rec.awake.includes(a.name) && a.ring === "unmet" && a.lore && E.profiles[a.key]?.hash !== hash(a.lore))
    .slice(0, 4)
    .map((a) => ({ key: a.key, name: a.name, text: a.lore }));
  const ctx = tellingCtx(L, meta, settings, E, tickId, rec.cards.map((c) => c.template), profile);
  const p = tellingPrompt(rec.cards, ctx);
  let text = "";
  try {
    text = await quiet([sys(p.system), usr(p.user)], { userId, connectionId: settings.simConnection || undefined, reasoningOff: true, timeoutMs: 120_000, label: "Elsewhere" });
  } catch (err) {
    rec.status = "failed";
    for (const p of E.proposals ?? []) if (p.tick === tickId) delete p.telling;
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
    const extra: Record<number, string[]> = {};
    const list = arrivalsOf(m);
    for (const card of r2.cards) {
      if (card.seed) {
        const raw = (res?.seeds ?? []).find((s) => s?.card === card.id);
        const pr = card.proposal ? E2.proposals?.find((p) => p.id === card.proposal && p.tick === tickId) : undefined;
        if (!raw) continue;
        const v = validateSeed(card, raw, ctx);
        if (v.rejected || !v.seed) {
          rejected.push(`${card.arcId} (seed): ${v.rejected}`);
          continue;
        }
        if (pr) {
          // A proposal waiting on the player reads in the story's words too.
          Object.assign(pr, { premise: v.seed.premise, want: v.seed.want, fear: v.seed.fear });
          pr.line = setField(setField(setField(pr.line, "premise", v.seed.premise), "want", v.seed.want), "fear", v.seed.fear);
          continue;
        }
        if (card.line < 0 || /\| by: player\b/.test(lines[card.line])) continue;
        lines[card.line] = setField(setField(setField(lines[card.line], "premise", v.seed.premise), "want", v.seed.want), "fear", v.seed.fear);
        continue;
      }
      const raw = (res?.beats ?? []).find((b) => b?.card === card.id);
      if (!raw) continue;
      const v = validateTold(card, raw, ctx);
      if (v.rejected || !v.text) {
        // Kept for the Director's log: what the model wrote, and why the engine's words stand.
        rejected.push(`${card.arcId}: ${v.rejected}${raw.text ? ` — “${String(raw.text).replace(/\s+/g, " ").slice(0, 200)}”` : ""}`);
        lines[card.line] = setField(lines[card.line], "note", `the model's telling was set aside: ${v.rejected}`);
        continue;
      }
      lines[card.line] = setField(setField(lines[card.line], "told", "model"), "text", v.text);
      if (v.lines.length) extra[card.line] = v.lines;
      for (const a of list) if (a.tick === tickId && a.arc === card.arcId) retellArrival(a, card.template, v.text, v.arrival);
    }
    for (const pr of res?.profiles ?? []) {
      const who = ctx.profile?.find((x) => x.key === pr?.key);
      const v = who ? validateProfile(pr, hash(who.text), who.text) : null;
      if (who && v) E2.profiles[who.key] = v;
    }
    // Extra lines go right after their card's line; the told lines are kept without them, so the indexes hold.
    putLines(fresh, r2.anchor, `${SIM_ID}${tickId}`, withExtra(lines, extra));
    r2.lines = lines;
    r2.extra = extra;
    for (const p of E2.proposals ?? []) if (p.tick === tickId) delete p.telling;
    r2.status = res ? "told" : "failed";
    r2.tokens = estTokens(p.system + p.user) + estTokens(text);
    r2.rejected = res ? rejected : ["the reply wasn't JSON"];
    save(chatId, "side", userId);
    save(chatId, "meta", userId);
    await ledgerFor(chatId, userId).refresh();
  });
  const { pushState } = await import("./view");
  pushState(chatId, userId);
}

/**
 * Tell one step again with the model, when its words read oddly or the engine's stood. The step's
 * outcome stays; only its telling changes. A recent tick keeps the step's card; an older one's is
 * rebuilt from the beat and its subplot. The step's line is rewritten where its tick anchored it.
 */
export async function retellBeat(chatId: string, arcId: string, atAbs: number, tickId: string, userId?: string): Promise<{ warn?: string; info?: string }> {
  const settings = await loadSettings(userId);
  const L = ledgerFor(chatId, userId);
  await L.refresh();
  const st = L.state;
  const arc = st.arcs?.[arcId];
  const beat = arc?.beats.find((b) => b.tick === tickId && b.atAbs === atAbs);
  if (!arc || !beat?.tick) return { warn: "That step can't be told again." };
  const files = await loadChat(chatId, userId);
  const E = elsewhereOf(files.meta);
  const rec = E.ticks[beat.tick];
  if (rec?.status === "telling") return { warn: "The model is still telling that step." };
  const ctx = { ...tellingCtx(L, files.meta, settings, E, beat.tick, [], []), retry: beat.text };
  const mine = (rec?.cards ?? []).filter((c) => !c.seed && !c.ending && c.arcId === arcId);
  const kept = mine.find((c) => c.atAbs === beat.atAbs) ?? (mine.length === 1 ? mine[0] : undefined);
  const card = kept ?? cardForBeat(arc, beat, ctx.roster, st, ctx.offPage, L.records);
  const p = tellingPrompt([card], ctx);
  let text = "";
  try {
    text = await quiet([sys(p.system), usr(p.user)], { userId, connectionId: settings.simConnection || undefined, reasoningOff: true, timeoutMs: 120_000, label: "Elsewhere" });
  } catch (err) {
    return { warn: `The model couldn't be asked: ${describe(err)}` };
  }
  // {"beats":[…]} as asked, or the one beat bare.
  const res = extractJson<any>(text);
  const beats: any[] = Array.isArray(res) ? res : Array.isArray(res?.beats) ? res.beats : res?.text ? [res] : [];
  const raw = beats.find((b) => b?.card === card.id) ?? beats.find((b) => b?.text);
  if (!raw) {
    warn(`elsewhere: retelling ${arcId} got no telling: ${text.slice(0, 2000)}`);
    return { warn: `The model's reply had no telling in it${text.trim() ? ` (“${text.replace(/\s+/g, " ").trim().slice(0, 140)}…”)` : " (it was empty)"}; the step stands as it was.` };
  }
  const v = validateTold(card, raw, ctx);
  if (v.rejected || !v.text) return { warn: `The new telling was set aside too (${v.rejected}); the step stands as it was.` };
  const told = v.text;
  const id = `${SIM_ID}${beat.tick}`;
  const head = `arc beat #${arcId}:`;
  const ok = await serial(`chat:${chatId}`, async () => {
    const fresh = await loadChat(chatId, userId);
    // The tick's own entry, wherever it was anchored.
    const entry = Object.values(fresh.side).flat().find((s) => s.id === id);
    const at = entry?.ops.findIndex((o) => (o.raw ?? "").startsWith(head) && new RegExp(`\\|\\s*at:\\s*${beat.atAbs}\\s*(?:\\||$)`).test(o.raw ?? "")) ?? -1;
    if (!entry || at < 0) return false;
    const line = dropField(setField(setField(entry.ops[at].raw!, "told", "model"), "text", told), "note");
    const op = parseLine(line);
    if (!op) return false;
    const r2 = elsewhereOf(fresh.meta).ticks[beat.tick!];
    // The last telling's extra lines for this step give way to the new ones.
    const old = new Set(kept && r2?.extra?.[kept.line] ? r2.extra[kept.line] : []);
    const extra = v.lines.map((l) => parseLine(l)).filter((o): o is ParsedOp => !!o);
    const ops = entry.ops.filter((o, i) => i <= at || !old.has(o.raw ?? ""));
    ops.splice(at, 1, op, ...extra);
    entry.ops = ops;
    if (kept && r2?.lines?.[kept.line]) {
      r2.lines[kept.line] = line;
      r2.extra = { ...(r2.extra ?? {}) };
      if (v.lines.length) r2.extra[kept.line] = v.lines;
      else delete r2.extra[kept.line];
    }
    for (const a of arrivalsOf(fresh.meta)) {
      if (a.tick === beat.tick && a.arc === arcId) retellArrival(a, card.template, told, v.arrival);
    }
    save(chatId, "side", userId);
    save(chatId, "meta", userId);
    await ledgerFor(chatId, userId).refresh();
    return true;
  });
  if (!ok) return { warn: "That step's line wasn't found where its tick left it; nothing was told again." };
  const { pushState } = await import("./view");
  pushState(chatId, userId);
  return { info: "Told again by the model." };
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
    mode: mode === "off" ? (list.some((a) => a.status === "pending" || a.status === "offered") ? "quiet" : "off") : mode, onPath: o.onPath, seen: E.seen, lastPlace: E.lastPlace, userName: o.userName,
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
export async function elsewhereAction(chatId: string, m: { action: string; id?: string; name?: string; premise?: string; want?: string; fear?: string; kind?: string; secrecy?: string; decision?: string }, userId?: string): Promise<{ warn?: string; info?: string } | null> {
  const L = ledgerFor(chatId, userId);
  await L.refresh();
  const st = L.state;
  const arc = m.id ? st.arcs?.[m.id] : undefined;
  const now = st.time ? absMinutes(st.time) : 0;
  let line: string | null = null;
  const more: string[] = [];
  if (m.action === "decline" || m.action === "accept") {
    const res = await serial(`chat:${chatId}`, async () => {
      const files = await loadChat(chatId, userId);
      const E = elsewhereOf(files.meta);
      const p = E.proposals!.find((x) => x.id === m.id && x.status === "pending");
      if (!p) return null;
      if (m.action === "decline") {
        p.status = "declined";
        E.declined = [...E.declined!.filter((k) => k !== p.key), p.key].slice(-100);
      } else p.status = "accepted";
      save(chatId, "meta", userId, 0);
      return p;
    });
    if (!res) return { warn: "That proposal is no longer waiting." };
    if (m.action === "decline") return null;
    // Accepted: it begins now, and its first step comes at once.
    let id = res.id;
    for (let i = 2; st.arcs?.[id]; i++) id = `${res.id}-${i}`;
    line = setField(setField(res.line.replace(/^arc new #[^:]+:/, `arc new #${id}:`), "at", String(now)), "push", "yes");
    const light = res.replaces ? st.arcs?.[res.replaces] : undefined;
    if (light && (light.status === "running" || light.status === "held")) more.push(`arc drop #${light.id}: reason: gave way to a story you accepted (${res.kind})`);
  }
  switch (m.action) {
    case "hold": line = arc ? `arc set #${arc.id}: status: held` : null; break;
    case "resume": line = arc ? `arc set #${arc.id}: status: running | next: ${now}` : null; break;
    case "nudge": line = arc ? `arc set #${arc.id}: push: yes | next: ${now} | heat: ${Math.min(3, arc.heat + 1)}` : null; break;
    case "bring": line = arc ? `arc set #${arc.id}: bring: yes | next: ${now}` : null; break;
    case "drop": line = arc ? `arc drop #${arc.id}: reason: dropped by the player` : null; break;
    case "edit": {
      if (!arc) break;
      const f = [
        m.premise ? `premise: ${m.premise}` : "", m.want ? `want: ${m.want}` : "", m.fear ? `fear: ${m.fear}` : "",
        m.kind && m.kind !== arc.kind ? `kind: ${m.kind}` : "", m.secrecy && m.secrecy !== arc.secrecy ? `secrecy: ${m.secrecy}` : "",
      ].filter(Boolean);
      line = f.length ? `arc set #${arc.id}: ${f.join(" | ").replace(/\n+/g, " ")}` : null;
      break;
    }
    case "fate": line = arc && ["accept", "soften", "page"].includes(m.decision ?? "") ? `arc set #${arc.id}: fate: ${m.decision}` : null; break;
    case "author": {
      if (!m.name || !m.premise) break;
      const files = await loadChat(chatId, userId);
      const roster = buildRoster({ state: st, records: L.records, userName: L.names.user, notPeople: notPeople(files.meta), people: files.meta.config.elsewhere?.people, profiles: elsewhereOf(files.meta).profiles });
      const premise = m.premise.replace(/\s*\|\s*/g, " / ").replace(/\n+/g, " ").slice(0, 300);
      const lead = roster.find(m.name);
      if (!lead) return { warn: `No one called “${m.name}” is in the roster.` };
      const settings = await loadSettings(userId);
      // With the model telling, it reads the player's words once: what kind of story, what the lead is after.
      const shape = settings.elsewhereTelling !== "engine" ? await shapeStory(lead, premise, roster, L.names.user, files.meta.detected.lang, settings, userId) : null;
      line = authorArc({ roster, name: m.name, premise, now, arcs: Object.values(st.arcs ?? {}), shape });
      if (!line) return { warn: `No one called “${m.name}” is in the roster.` };
      break;
    }
  }
  if (!line) return { warn: "Nothing to change." };
  const target = L.lastAssistant();
  if (!target) return { warn: "The chat has no reply to anchor this to yet." };
  const ops = [line, ...more].map((l) => parseLine(l)).filter((o): o is ParsedOp => !!o);
  if (!ops.length) return { warn: "That couldn't be recorded." };
  const files = await loadChat(chatId, userId);
  const key = anchorKey(target.index);
  files.side[key] = [...(files.side[key] ?? []), { source: "user", ops, id: `ewu:${Date.now().toString(36)}`, at: Date.now() }];
  save(chatId, "side", userId, 0);
  await L.refresh();
  // Fates, bring-ins, nudges and a new story act at once.
  if (["fate", "bring", "nudge", "author", "accept"].includes(m.action)) {
    const rec = await runElsewhere(chatId, userId).catch((err) => {
      warn(`elsewhere: ${describe(err)}`);
      return null;
    });
    if (m.action === "nudge" || m.action === "author" || m.action === "accept") return { info: tickSummary(rec, L.state.arcs) };
  }
  return null;
}

/** The shaping call for a player's story; null when the model can't be asked or answers nothing usable. */
async function shapeStory(lead: Actor, premise: string, roster: Roster, userName: string, lang: string | undefined, settings: Settings, userId?: string) {
  const p = shapePrompt({
    userName, lead: lead.name, leadText: lead.text, premise, lang,
    people: roster.actors.filter((a) => a !== lead && a.standing !== "dead").map((a) => a.name).slice(0, 60), groups: roster.groups.map((g) => g.name).slice(0, 20),
  });
  try {
    const text = await quiet([sys(p.system), usr(p.user)], { userId, connectionId: settings.simConnection || undefined, reasoningOff: true, timeoutMs: 45_000, label: "Elsewhere (story)" });
    return validateShape(extractJson(text), roster, lead.name);
  } catch (err) {
    warn(`elsewhere: shaping the story failed: ${describe(err)}`);
    return null;
  }
}

/** One line on what a step did, for a toast: what moved, what began, and why the rest waited. */
export function tickSummary(rec: TickRecord | null, arcs: Record<string, ArcState> = {}): string {
  if (!rec) return "Nothing moved: story time hasn't gone a step since the last one, and nothing is waiting on you.";
  const name = (id: string) => (arcs[id] ? `${arcs[id].lead}'s ${arcs[id].kind}` : id);
  const moved = rec.log.filter((l) => /= -?\d+ → (win|cost|loss)/.test(l)).map((l) => `${name(l.split(":")[0])} (${/→ (\w+)/.exec(l)![1]})`);
  const seeded = rec.log.filter((l) => l.startsWith("seeded ")).map((l) => /\(([^)]+)\)/.exec(l)?.[1]?.replace(/^(\w+), (.+)$/, "$2's $1") ?? "");
  const proposed = rec.log.filter((l) => l.startsWith("proposed ")).map((l) => /\(([^)]+)\)/.exec(l)?.[1]?.replace(/^(\w+), (.+)$/, "$2's $1") ?? "");
  const held = rec.log.filter((l) => /held back/.test(l)).map((l) => `${name(l.split(":")[0])} waits (${/held back \((.*)\)$/.exec(l)?.[1] ?? ""})`);
  const parts = [
    moved.length ? `moved: ${moved.join(", ")}` : "",
    seeded.length ? `new: ${seeded.join(", ")}` : "",
    proposed.length ? `proposed: ${proposed.join(", ")} (accept or decline them on the Elsewhere page)` : "",
    rec.hops ? `${rec.hops} piece${rec.hops === 1 ? "" : "s"} of news travelled` : "",
    held.length ? held.join("; ") : "",
  ].filter(Boolean);
  if (!parts.length) return "Nothing moved this step: no subplot came due and none could start.";
  return `Elsewhere ${parts.join(" · ")}${rec.status === "telling" ? " · the model is telling it now" : ""}.`;
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
  const now = st.time ? absMinutes(st.time) : null;
  const telling = new Set(E.order.filter((id) => E.ticks[id]?.status === "telling"));
  const arcs = Object.values(st.arcs ?? {})
    // The player's own stories first, then the liveliest.
    .sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5) || Number(b.by === "player") - Number(a.by === "player") || (b.lastBeatAbs ?? b.startedAbs) - (a.lastBeatAbs ?? a.startedAbs))
    .slice(0, 30)
    .map((a) => ({
      id: a.id, kind: a.kind, lead: a.lead, cast: a.cast, premise: a.premise, want: a.want, fear: a.fear, secrecy: a.secrecy, clock: a.clock, tally: a.tally, stage: a.stage,
      status: a.status, crossed: !!a.crossed, by: a.by, locked: !!a.locked, heat: a.heat, note: a.note, ending: a.ending ? { ...a.ending, at: o.fmt(a.ending.atAbs) } : null, fate: a.fate ?? null,
      grounds: a.grounds.map((g) => ({ id: g, name: groundName(g) })), earlier: a.earlier ?? "",
      beats: a.beats.slice(-6).map((b) => ({ at: o.fmt(b.atAbs), result: b.result, roll: b.roll, mod: b.mod, text: b.text, told: b.told, twist: b.twist ?? "", note: b.note ?? "", telling: b.told === "template" && !!b.tick && telling.has(b.tick),
        tick: b.tick ?? "", atAbs: b.atAbs, retell: !!b.tick && !telling.has(b.tick) })),
      // When its next step can come, and why it waits.
      next: a.status === "running" && now != null && a.nextAbs > now ? o.fmt(a.nextAbs) : "", wait: a.status === "running" ? a.wait ?? "" : "", pushed: !!a.push,
      reached: list.filter((x) => x.arc === a.id && x.status === "used").slice(-3).map((x) => ({ kind: x.kind, text: x.text, at: x.atAbs != null ? o.fmt(x.atAbs) : "" })),
      reaches: list.filter((x) => x.arc === a.id && (x.status === "pending" || x.status === "offered") && callFits(x, st, roster)).map((x) => ({ kind: x.kind, text: x.text, at: x.atAbs != null ? o.fmt(x.atAbs) : "", carrier: x.carrier ?? "" })),
    }));
  const ticks = E.order.map((id) => E.ticks[id]).filter(Boolean).reverse().map((t) => ({ id: t.id, at: t.at, from: o.fmt(t.from), to: o.fmt(t.to), hours: t.hours, beats: t.beats, seeds: t.seeds, proposed: t.proposed ?? 0, hops: t.hops, arrivals: t.arrivals, status: t.status, tokens: t.tokens ?? 0, log: t.log, rejected: t.rejected ?? [], awake: t.awake }));
  const awake = new Set(ticks[0]?.awake ?? []);
  const leads = new Set(Object.values(st.arcs ?? {}).filter((a) => a.status === "running" || a.status === "held" || a.status === "fate").map((a) => a.lead.toLowerCase()));
  const people = roster.actors.map((a) => ({
    name: a.name, ring: a.ring, standing: a.standing, where: a.where ?? "", reach: a.reach, awake: awake.has(a.name), arc: a.names.some((n) => leads.has(n.toLowerCase())),
    flags: meta.config.elsewhere?.people?.[a.name.toLowerCase()] ?? {}, ties: a.ties.filter((t) => t.strength >= 2).length,
  }));
  return {
    mode: modeOf(meta, o.settings), chatMode: meta.config.elsewhere?.mode ?? null, view: o.settings.elsewhereView ?? "director",
    telling: o.settings.elsewhereTelling, canonGravity: o.settings.canonGravity, fates: o.settings.fates, step: o.settings.simStep,
    arcs, ticks: ticks.slice(0, 6), people, town: roster.town ?? "", seeding: o.settings.elsewhereSeeding ?? "ask",
    proposals: (E.proposals ?? []).filter((p) => p.status === "pending").map((p) => ({
      id: p.id, kind: p.kind, lead: p.lead, cast: p.cast, premise: p.premise, want: p.want, fear: p.fear, secrecy: p.secrecy, why: p.why, telling: !!p.telling, at: o.fmt(p.atAbs),
      grounds: p.grounds.map((g) => ({ id: g, name: groundName(g) })), replaces: p.replaces ? st.arcs?.[p.replaces]?.premise ?? "" : "",
    })),
    arrivals: list.slice(-20).reverse().map((x) => ({ id: x.id, kind: x.kind, status: x.status, text: x.text, at: x.atAbs != null ? o.fmt(x.atAbs) : "", carrier: x.carrier ?? "", lead: x.lead ?? "", arc: x.arc ?? "", why: x.why ?? "" })),
  };
}
