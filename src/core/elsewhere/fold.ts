// Folding Elsewhere's own lines into the world state. The engine (and the player's controls)
// write `arc` and `whereabouts` lines as anchored side events; folding them here keeps the
// subplots branch-correct like everything else: swipes, forks and rebuilds see the same arcs.
//
//   arc new #giles-return: return | lead: Giles | cast: Willow | secrecy: private | clock: 6 | …
//   arc beat #giles-return: cost | roll: 4+5+0 | at: 3880 | text: … | next: 4600
//   arc stage #giles-return: rising          arc cross #giles-return: thread: Giles comes back
//   arc end #giles-return: met | text: …      arc drop #giles-return: reason: idle three days
//   arc set #giles-return: status: held | next: 4000 | bring: yes | push: yes | wait: asleep | kind: duty | premise: … | fate: accept
//   whereabouts Giles: England | since: 3830

import type { ArcKind, ArcStage, ArcState, BeatResult, ParsedOp, WorldState } from "../types";

const KINDS: ArcKind[] = ["pursuit", "scheme", "rivalry", "courtship", "rift", "debt", "secret", "decline", "investigation", "threat", "return", "duty", "life", "loss", "world"];
const STAGES: ArcStage[] = ["setup", "rising", "crisis", "aftermath"];

const list = (s?: string) => (s ? s.split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean) : []);
const int = (s: string | undefined, d: number) => {
  const n = s != null ? parseInt(s, 10) : NaN;
  return Number.isFinite(n) ? n : d;
};
const clean = (s?: string) => (s ?? "").trim();

/** Beats kept per arc; older ones fold into one line. */
export const BEATS_KEPT = 12;

export function applyArcOp(st: WorldState, op: ParsedOp, mi: number): boolean {
  const a = op.args as { verb: string; id: string; head: string; fields: Record<string, string> };
  if (!a?.id) return false;
  const arcs = (st.arcs ??= {});
  const f = a.fields ?? {};
  const now = st.time ? (st.time.day - 1) * 1440 + st.time.minute : 0;
  const arc = arcs[a.id];
  switch (a.verb) {
    case "new": {
      // A live arc isn't seeded twice; one that ended may begin again.
      if (arc && (arc.status === "running" || arc.status === "held" || arc.status === "fate")) {
        if (f.by === "player") Object.assign(arc, { premise: f.premise || arc.premise, want: f.want || arc.want, fear: f.fear || arc.fear, locked: true });
        return true;
      }
      const kind = (KINDS as string[]).includes(a.head) ? (a.head as ArcKind) : "pursuit";
      const max = int(f.clock, 6);
      const at = int(f.at, now);
      arcs[a.id] = {
        id: a.id, kind, lead: clean(f.lead) || "someone", cast: list(f.cast), premise: clean(f.premise), want: clean(f.want), fear: clean(f.fear),
        grounds: list(f.grounds), secrecy: f.secrecy === "public" || f.secrecy === "secret" ? f.secrecy : "private",
        clock: { cur: Math.min(int(f.cur, 0), max), max }, tally: { win: 0, cost: 0, loss: 0 }, heat: int(f.heat, 1), stage: "setup",
        beats: [], nextAbs: int(f.next, at), status: "running", by: f.by === "player" ? "player" : f.by === "lore" ? "lore" : "engine",
        locked: f.by === "player" || undefined, place: clean(f.place) || undefined, startedAbs: at, startedMsg: mi, push: f.push === "yes" || undefined,
        faction: f.faction ? { name: f.faction.split("/")[0].trim(), project: (f.faction.split("/")[1] ?? "").trim() } : undefined,
      };
      return true;
    }
    case "beat": {
      if (!arc) return false;
      const result: BeatResult = a.head === "win" || a.head === "loss" ? a.head : "cost";
      const roll = /(\d+)\s*\+\s*(\d+)(?:\s*([+-]\s*\d+))?/.exec(f.roll ?? "");
      const at = int(f.at, now);
      arc.beats.push({
        atAbs: at, roll: roll ? [parseInt(roll[1], 10), parseInt(roll[2], 10)] : [0, 0], mod: roll?.[3] ? parseInt(roll[3].replace(/\s/g, ""), 10) : 0,
        result, twist: clean(f.twist) || undefined, forced: f.forced === "yes" || undefined, text: clean(f.text), told: f.told === "model" ? "model" : "template", msgIndex: mi, tick: clean(f.tick) || undefined, place: clean(f.place) || undefined,
        note: clean(f.note) || undefined,
      });
      if (arc.beats.length > BEATS_KEPT) {
        const old = arc.beats.splice(0, arc.beats.length - BEATS_KEPT);
        arc.earlier = [arc.earlier, ...old.map((b) => b.text)].filter(Boolean).join(" ").slice(-600);
      }
      arc.tally[result]++;
      arc.clock.cur = Math.min(arc.clock.max, arc.clock.cur + int(f.inc, 1));
      arc.lastBeatAbs = at;
      arc.nextAbs = int(f.next, at + 60);
      if (f.place) arc.place = clean(f.place);
      arc.bring = undefined;
      arc.push = undefined;
      arc.force = undefined;
      arc.wait = undefined;
      return true;
    }
    case "stage": {
      if (!arc || !(STAGES as string[]).includes(a.head)) return false;
      arc.stage = a.head as ArcStage;
      return true;
    }
    case "cross": {
      if (!arc) return false;
      arc.crossed = true;
      arc.thread = clean(f.thread || a.head) || arc.thread;
      arc.bring = undefined;
      return true;
    }
    case "end": {
      if (!arc) return false;
      arc.status = "resolved";
      arc.stage = "aftermath";
      arc.fate = undefined;
      arc.ending = { result: a.head || "ended", text: clean(f.text), atAbs: int(f.at, now) };
      return true;
    }
    case "drop": {
      if (!arc) return false;
      arc.status = "dropped";
      arc.note = clean(f.reason || a.head) || undefined;
      return true;
    }
    case "set": {
      if (!arc) return false;
      const status = f.status || a.head;
      if (status === "held" || status === "running" || status === "fate") arc.status = status;
      if (f.next) arc.nextAbs = int(f.next, arc.nextAbs);
      if (f.bring) arc.bring = f.bring === "yes" || undefined;
      if (f.push) arc.push = f.push === "yes" || undefined;
      if (f.force) arc.force = ["win", "cost", "loss", "twist"].includes(f.force) ? (f.force as ArcState["force"]) : undefined;
      if ("wait" in f) arc.wait = clean(f.wait) || undefined;
      if ((KINDS as string[]).includes(f.kind ?? "") && f.kind !== "world") arc.kind = f.kind as ArcKind;
      if (f.kind) arc.locked = true;
      if (f.heat) arc.heat = int(f.heat, arc.heat);
      if (f.cast) arc.cast = [...new Set([...arc.cast, ...list(f.cast)])];
      if (f.secrecy === "public" || f.secrecy === "private" || f.secrecy === "secret") arc.secrecy = f.secrecy;
      if (f.premise) arc.premise = clean(f.premise);
      if (f.want) arc.want = clean(f.want);
      if (f.fear) arc.fear = clean(f.fear);
      if (f.premise || f.want || f.fear) arc.locked = true;
      if (f.pending) arc.fate = { text: clean(f.pending) };
      if (f.fate === "accept" || f.fate === "soften" || f.fate === "page") {
        arc.fate = { text: arc.fate?.text ?? "", decision: f.fate };
        if (arc.status === "fate") arc.status = "running";
      }
      return true;
    }
  }
  return false;
}

export function applyWhereabouts(st: WorldState, op: ParsedOp, mi: number): boolean {
  const name = op.subject?.trim();
  const place = String(op.args?.place ?? "").trim();
  if (!name || !place) return false;
  (st.whereabouts ??= {})[name.toLowerCase()] = { name, place, since: op.args.since ?? null, msgIndex: mi };
  return true;
}
