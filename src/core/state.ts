// Event-sourced world state. `Folder` applies parsed ledger ops for one message
// at a time, validating each against the state so far, and records every op as
// an accepted / warned / rejected event. Branch correctness comes from the
// caller: only messages on the active path (current swipes) are folded.

import type {
  BondAxis, BondState, CastEdit, CharacterState, EventSource, FactEdit, KnowRow, LedgerEvent, MessageDelta,
  ParsedLedger, ParsedOp, WorldState,
} from "./types";
import { KNOW_OPS } from "./types";
import { applyFactEdits, canHear, closeMetGaps, fileKnow, fileReveal, fileSecret, fileUnaware, type KnowCtx } from "./facts";
import { parseLine } from "./dsl";
import type { KnowArgs } from "./knowparse";
import { ALL_AXES, BIPOLAR_AXES } from "./types";
import { absMinutes, addMinutes, clamp, fmtSpan, fromAbs, MIN_PER_DAY, slug, type StoryTime } from "./util";

export interface FoldOptions {
  userName: string;
  userAliases?: string[];
  strictness: "strict" | "lenient";
  /** Sealed / Continuity persona modes: drop the player's inner-state ops. */
  sealed: boolean;
  personaThoughts?: boolean;
  romance?: string; // off | slow | measured | fast | established
  startTime?: StoryTime | null;
  /** Names the player merged by hand: lower-case name → "user" or the name it belongs to. */
  merges?: Record<string, string>;
  /** Player edits to facts (rename, truth, merge, hide, who knows it, added facts). */
  factEdits?: Record<string, FactEdit>;
  /** Player edits to the cast (names, age, appearance, people added by hand). */
  castEdits?: Record<string, CastEdit>;
}

/** "Gabriel#0|flat", "“Mara”", "Kael's" → the bare lower-case name. */
function bareName(name: string): string {
  return name.replace(/\|[^|]*$/, "").replace(/#\d+\s*$/, "").replace(/^["“'‘]|["”'’]$/g, "").replace(/['’]s$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Optimal string alignment distance, stopping early past `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/**
 * A misspelling of a known name ("Gabuel" for "Gabriel", "Bufy" for "Buffy").
 * Deliberately narrow: single words, same first letter, six letters or more,
 * and never a longer form of the name ("Gabriela" is someone else).
 */
export function isTypoOf(n: string, known: string): boolean {
  if (!n || !known || n === known || n.includes(" ") || known.includes(" ")) return false;
  if (n[0] !== known[0] || Math.abs(n.length - known.length) > 1) return false;
  const long = Math.max(n.length, known.length);
  if (Math.min(n.length, known.length) < 5 || long < 6) return false;
  if (n.startsWith(known) || known.startsWith(n)) return false;
  const max = long >= 7 ? 2 : 1;
  return editDistance(n, known, max) <= max;
}

export const CONFIDENCE: Record<EventSource, number> = {
  user: 1, model: 0.9, lore: 0.85, archivist: 0.8, clerk: 0.85, repair: 0.75, engine: 0.95, sim: 0.7, extractor: 0.6,
};

const PIVOTAL = /betray|rescu|saved|save[sd]? (her|his|their|my) life|kill|murder|unforgiv|sacrific|confess|abandon|attack|lied about|revealed|died|death|oath|marri|propos/i;

const MODE_INSTRUMENTS: Record<string, string> = {
  clue: "mystery", ladder: "romance", deadline: "thriller", clockf: "intrigue", payoff: "comedy", plant: "comedy",
};

export function emptyState(): WorldState {
  return {
    time: null,
    weather: null,
    season: null,
    place: [],
    mode: "social",
    title: undefined,
    sceneNo: 0,
    sceneLog: [],
    sceneStartMsg: 0,
    sceneStartAbs: null,
    chars: {},
    bonds: {},
    ladders: {},
    knowledge: [],
    facts: {},
    items: {},
    threads: {},
    cons: {},
    factions: {},
    rumors: [],
    rep: {},
    canon: [],
    artifacts: {},
    keys: {},
    gauges: {},
    clues: [],
    plants: [],
    deadlines: {},
    milestones: [],
    places: {},
    voices: {},
    nextSlot: 1,
    lastDelta: null,
    genreHits: {},
    msgCount: 0,
    ledgerCount: 0,
    unverified: [],
  };
}

export class Folder {
  state: WorldState;
  opts: FoldOptions;
  private userKeys: Set<string>;
  private userFirst: string[];

  constructor(opts: FoldOptions, state?: WorldState) {
    this.opts = opts;
    this.state = state ?? emptyState();
    const merged = Object.entries(opts.merges ?? {}).filter(([, to]) => to === "user").map(([from]) => from);
    this.userKeys = new Set(
      [opts.userName, ...(opts.userAliases ?? []), ...merged, "{{user}}", "user", "you", "player"]
        .filter(Boolean)
        .map((s) => s.toLowerCase().trim()),
    );
    // "Gabriel" for the persona "Gabriel Winters"
    this.userFirst = [opts.userName, ...(opts.userAliases ?? [])]
      .map((s) => (s ?? "").toLowerCase().trim().split(/\s+/)[0])
      .filter((f) => f && f.length >= 3 && !["the", "mr", "mrs", "ms", "dr", "sir", "lady", "lord"].includes(f.replace(/\.$/, "")));
    if (!this.state.time && opts.startTime) this.state.time = { ...opts.startTime };
  }

  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  /**
   * The player's character, however the model writes it: the full persona
   * name, an alias, the first name alone, a slot-0 speaker mark, a name the
   * player merged by hand, or a small misspelling of the name.
   */
  isUser(name: string): boolean {
    if (/#0\s*(?:\|[^|]*)?$/.test(name.trim())) return true;
    const n = bareName(name);
    if (!n) return false;
    if (this.userKeys.has(n) || this.userKeys.has(name.toLowerCase().trim())) return true;
    if (this.state.chars.user?.aliases.some((a) => a.toLowerCase() === n)) return true;
    if (n.includes(" ")) return false;
    if (this.npcNamed(n)) return false;
    const full = (this.opts.userName ?? "").toLowerCase().trim();
    if (this.userFirst.includes(n)) return true;
    return [...this.userFirst, full].some((k) => isTypoOf(n, k));
  }

  /** A character other than the player already goes by this exact name. */
  private npcNamed(low: string): boolean {
    return Object.values(this.state.chars).some((c) => !c.isUser && (c.name.toLowerCase() === low || c.aliases.some((a) => a.toLowerCase() === low)));
  }

  /** Resolve a written name to a character id, creating the character on first sight. */
  charId(name: string, msgIndex: number, create = true): string | null {
    let n = name.replace(/#\d+$/, "").replace(/^["“]|["”]$/g, "").trim();
    if (!n) return null;
    const mergedTo = this.opts.merges?.[n.toLowerCase()];
    if (mergedTo === NOT_A_PERSON) return null;
    if (mergedTo && mergedTo !== "user") n = mergedTo;
    if (this.isUser(name) || this.isUser(n)) {
      this.ensureChar("user", this.opts.userName || "You", msgIndex, true);
      return "user";
    }
    const low = n.toLowerCase();
    for (const c of Object.values(this.state.chars)) {
      if (c.name.toLowerCase() === low || c.aliases.some((a) => a.toLowerCase() === low)) return c.id;
    }
    // "Mara Voss" vs "Mara": match on first name when unambiguous
    const first = low.split(/\s+/)[0];
    const byFirst = Object.values(this.state.chars).filter((c) => c.name.toLowerCase().split(/\s+/)[0] === first);
    if (byFirst.length === 1 && first.length > 2) {
      const c = byFirst[0];
      if (n.length > c.name.length) {
        c.aliases.push(c.name);
        c.name = n;
      } else if (!c.aliases.includes(n)) c.aliases.push(n);
      return c.id;
    }
    // A misspelling of someone already here ("Bufy") is them, not a newcomer.
    const typo = Object.values(this.state.chars).filter((c) => !c.isUser && [c.name, ...c.aliases].some((a) => isTypoOf(low, a.toLowerCase())));
    if (typo.length === 1) {
      if (!typo[0].aliases.includes(n)) typo[0].aliases.push(n);
      return typo[0].id;
    }
    if (!create) return null;
    let id = slug(n);
    if (id === "user") id = "user_npc";
    while (this.state.chars[id] && this.state.chars[id].name.toLowerCase() !== low) id += "_";
    this.ensureChar(id, n, msgIndex, false);
    return id;
  }

  /** The player's say on the cast: names, age, appearance, and people added by hand. Applied after every message. */
  private applyCastEdits(mi: number): void {
    for (const [id, e] of Object.entries(this.opts.castEdits ?? {})) {
      let c = this.state.chars[id];
      if (!c && e.added !== undefined && mi >= e.added && e.name) {
        c = this.ensureChar(id, e.name, mi, false);
        c.voiced = true;
        c.tier ??= "off";
      }
      if (!c) continue;
      const name = e.name?.trim();
      if (name && c.name !== name && !c.isUser) {
        if (!c.aliases.some((a) => a.toLowerCase() === c.name.toLowerCase())) c.aliases.push(c.name);
        c.aliases = c.aliases.filter((a) => a.toLowerCase() !== name.toLowerCase());
        c.name = name;
      }
      if (e.age !== undefined) c.age = e.age.trim() || undefined;
      if (e.appearance !== undefined) c.appearance = e.appearance.trim() || undefined;
    }
  }

  private ensureChar(id: string, name: string, msgIndex: number, isUser: boolean): CharacterState {
    let c = this.state.chars[id];
    if (!c) {
      c = {
        id, name, aliases: [], slot: isUser ? 0 : this.assignSlot(id), isUser,
        firstSeen: msgIndex, lastSeen: msgIndex, meters: {}, flags: [], injuries: [], journal: [],
      };
      this.state.chars[id] = c;
      if (!isUser) this.milestone(msgIndex, "meet", `${name} enters the story`);
    }
    c.lastSeen = Math.max(c.lastSeen, msgIndex);
    return c;
  }

  private assignSlot(id: string): number {
    if (this.state.voices[id] != null) return this.state.voices[id];
    const used = new Set(Object.values(this.state.voices));
    let slot = this.state.nextSlot;
    for (let i = 0; i < 12 && used.has(slot); i++) slot = (slot % 12) + 1;
    this.state.voices[id] = slot;
    this.state.nextSlot = (slot % 12) + 1;
    return slot;
  }

  /** Adopt voice slots the model already used in [spk=Name#N] marks. */
  adoptSpeakers(speakers: { name: string; slot?: number }[], msgIndex: number): void {
    for (const s of speakers) {
      // Slot 0 is the player's voice: whatever name the mark uses is theirs.
      if (s.slot === 0) {
        const nm = s.name.replace(/#\d+$/, "").trim();
        const low = bareName(nm);
        if (low && !this.npcNamed(low) && !this.isUser(nm)) {
          const u = this.ensureChar("user", this.opts.userName || "You", msgIndex, true);
          if (!u.aliases.some((a) => a.toLowerCase() === low)) u.aliases.push(nm);
        }
        continue;
      }
      if (this.isUser(s.name) || this.notAPerson(s.name)) continue;
      const existing = this.charId(s.name, msgIndex, false);
      // Whoever speaks is a person who can know things.
      if (existing) {
        this.state.chars[existing].voiced = true;
        continue;
      }
      const id = this.charId(s.name, msgIndex, true)!;
      this.state.chars[id].voiced = true;
      if (s.slot && s.slot >= 1 && s.slot <= 12) {
        this.state.voices[id] = s.slot;
        this.state.chars[id].slot = s.slot;
      }
    }
  }

  private milestone(msgIndex: number, kind: string, text: string) {
    this.state.milestones.push({ at: this.state.time ? { ...this.state.time } : null, msgIndex, kind, text });
    if (this.state.milestones.length > 400) this.state.milestones.splice(0, this.state.milestones.length - 400);
  }

  // -------------------------------------------------------------------------
  // Message application
  // -------------------------------------------------------------------------

  applyMessage(
    msgIndex: number,
    msgId: string,
    swipe: number,
    parsed: ParsedLedger,
    source: EventSource = "model",
    extra: ParsedOp[] = [],
    extraSource: EventSource = "user",
  ): LedgerEvent[] {
    const st = this.state;
    st.msgCount = Math.max(st.msgCount, msgIndex + 1);
    const startAbs = st.time ? absMinutes(st.time) : null;
    const events: LedgerEvent[] = [];
    const delta: MessageDelta = { msgIndex, msgId, count: 0, elapsed: 0, lines: [], rejected: [] };
    const hadPlace = st.place.join(" › ");
    const hadMode = st.mode;
    const hadTitle = st.title;

    if (parsed.speakers?.length) this.adoptSpeakers(parsed.speakers, msgIndex);

    // Header is a fallback source of time/place/weather when the ledger omits them.
    const ops = [...parsed.ops];
    if (parsed.header) this.applyHeader(parsed, ops, msgIndex);
    if (parsed.title) st.title = parsed.title;
    if (parsed.ops.length) st.ledgerCount++;

    const castOp = ops.some((o) => o.op === "cast");
    // Knowledge: what was said aloud since the last reply. (Thoughts don't make someone
    // a person who can know things — models give the cat thoughts too; speech does.)
    const fromUser = !!parsed.fromUser;
    if (!fromUser) st.speechSince = (st.lastReply ?? -1) + 1;
    if (parsed.speech?.length) {
      const present = Object.values(st.chars).filter(canHear).map((c) => c.id);
      st.speech = [...(st.speech ?? []).filter((e) => e.msgIndex !== msgIndex), { msgIndex, lines: parsed.speech.slice(0, 60), present, ...(fromUser ? { fromUser } : {}) }].slice(-4);
    }
    this.kctx = this.knowCtx(msgIndex);
    let seq = 0;
    const run = (op: ParsedOp, src: EventSource) => {
      const ev: LedgerEvent = {
        id: `${msgId}:${swipe}:${seq}`,
        msgId, swipe, msgIndex, seq: seq++, source: src, op,
        confidence: CONFIDENCE[src], verdict: "accepted",
      };
      try {
        const res = this.applyOp(op, msgIndex, src, castOp);
        if (res && res.verdict !== "accepted") {
          ev.verdict = res.verdict;
          ev.reason = res.reason;
        }
        if (res?.line && ev.verdict !== "rejected") delta.lines.push(res.line);
      } catch (e) {
        ev.verdict = "rejected";
        ev.reason = `error: ${(e as Error).message}`;
      }
      if (ev.verdict === "rejected") delta.rejected.push({ raw: op.raw, reason: ev.reason ?? "rejected" });
      else delta.count++;
      ev.at = st.time ? { ...st.time } : null;
      events.push(ev);
    };
    for (const op of ops) run(op, source);
    for (const op of extra) run(op, extraSource);

    // Thoughts and artifacts in the prose.
    for (const t of parsed.thoughts ?? []) {
      const id = this.charId(t.who, msgIndex);
      if (id && id !== "user") this.state.chars[id].lastSeen = msgIndex;
    }
    for (const v of parsed.vtks ?? []) {
      const aid = `doc:${slug(v.title || v.kind)}`;
      const existing = st.artifacts[aid];
      st.artifacts[aid] = {
        id: aid, title: v.title || v.kind, kind: v.kind, text: v.body, meta: v.meta,
        holder: existing?.holder, keys: existing?.keys ?? [], msgIndex,
      };
    }

    const endAbs = st.time ? absMinutes(st.time) : null;
    delta.elapsed = startAbs != null && endAbs != null ? endAbs - startAbs : 0;

    // Scene boundary: place change, ≥60 min jump, new title, downtime.
    const newPlace = st.place.join(" › ");
    const boundary =
      (hadPlace && newPlace && hadPlace !== newPlace) ||
      delta.elapsed >= 60 ||
      (parsed.title && parsed.title !== hadTitle && st.sceneStartMsg !== msgIndex) ||
      (st.mode === "downtime" && hadMode !== "downtime");
    if (boundary || st.sceneNo === 0) {
      st.sceneNo++;
      st.sceneStartMsg = msgIndex;
      st.sceneStartAbs = endAbs;
      st.sceneLog.push({ no: st.sceneNo, startMsg: msgIndex, startAbs: endAbs, place: newPlace, title: parsed.title ?? undefined });
      if (st.sceneLog.length > 2000) st.sceneLog.splice(0, st.sceneLog.length - 2000);
    } else if (parsed.title && st.sceneLog.length) st.sceneLog[st.sceneLog.length - 1].title ??= parsed.title;

    if (source !== "model" && parsed.ops.length) st.unverified.push(msgIndex);
    // Knowledge lines as filed (the model reads its own last ledger in this shape), and whether they needed repair.
    const kc = this.kctx!;
    const canon = (st.knowCanon ??= {});
    delete canon[msgIndex];
    if (kc.canon.length) canon[msgIndex] = kc.canon.slice(0, 16);
    for (const k of Object.keys(canon)) if (+k < msgIndex - 40) delete canon[+k];
    st.knowRepair = (st.knowRepair ?? []).filter((i) => i !== msgIndex && i >= msgIndex - 200);
    if (kc.repaired && ops.some((o) => KNOW_OPS.includes(o.op))) st.knowRepair.push(msgIndex);
    this.applyCastEdits(msgIndex);
    applyFactEdits(st, msgIndex, this.opts.factEdits ?? {});
    closeMetGaps(st);
    if (!fromUser) st.lastReply = msgIndex;
    this.kctx = null;
    st.lastDelta = delta;
    return events;
  }

  private kctx: KnowCtx | null = null;

  /** The knowledge engine's view of this message: names, listeners, edits, and what it files. */
  private knowCtx(mi: number): KnowCtx {
    const st = this.state;
    return {
      st, mi, edits: this.opts.factEdits ?? {}, canon: [], repaired: false,
      // The clock may move earlier in the same ledger: read it when a line is filed.
      get at() { return st.time ? { ...st.time } : null; },
      who: (name: string, create: boolean) => this.whoFor(name, mi, create),
      nm: (id: string) => this.nm(id),
      listeners: () => Object.values(st.chars).filter((c) => canHear(c) && c.arrivedMsg !== mi).map((c) => c.id),
    };
  }

  /**
   * A person named on a knowledge line. Things ("the letter", "the stone"),
   * phrases ("Buffy suspects Willow") and names removed from the cast are not
   * people. Looking up never renames anyone; only a holder named on a line may
   * enter the story.
   */
  private whoFor(name: string, mi: number, create: boolean): string | null {
    const n = name.replace(/^["“]|["”]$/g, "").replace(/#\d+$/, "").trim();
    if (!n || this.notAPerson(n)) return null;
    const known = this.lookup(n);
    if (known) return known;
    if (!/^(?:\{\{user\}\}|[A-ZÀ-Þ][\p{L}'’.-]*(?:\s+(?:(?:of|the|de|van|von|da|del|al|bin|ibn)\s+)?[A-ZÀ-Þ][\p{L}'’.-]*){0,3})$/u.test(n)) return null;
    return create ? this.charId(n, mi, true) : null;
  }

  /** A character by name, alias or unique first name, without changing anyone. */
  lookup(name: string): string | null {
    const n = bareName(name);
    if (!n) return null;
    if (this.isUser(name)) return this.state.chars.user ? "user" : null;
    const chars = Object.values(this.state.chars);
    const exact = chars.find((c) => c.name.toLowerCase() === n || c.aliases.some((a) => a.toLowerCase() === n));
    if (exact) return exact.id;
    const first = n.split(/\s+/)[0];
    if (first.length < 3) return null;
    // "Mara" for "Mara Voss", or "Mara Voss" for "Mara" — the other words must be a surname, not a phrase.
    if (n.includes(" ") && !/^[A-Z][^\s]*(?:\s+[A-Z][^\s]*)+$/.test(name.trim())) return null;
    const byFirst = chars.filter((c) => c.name.toLowerCase().split(/\s+/)[0] === first);
    return byFirst.length === 1 ? byFirst[0].id : null;
  }

  private applyHeader(parsed: ParsedLedger, ops: ParsedOp[], _msgIndex: number) {
    const h = parsed.header!;
    const has = (o: string) => ops.some((x) => x.op === o);
    if (!has("clock") && h.time != null) {
      ops.unshift({ op: "clock", args: { kind: "abs", day: h.day, minute: h.time, fromHeader: true }, raw: "(header) time" });
    } else if (h.time != null && !this.state.time) {
      // The first reply: "clock: +10m" has nothing to count from, so the header's time starts the clock.
      const i = ops.findIndex((x) => x.op === "clock" && x.args.kind === "rel");
      if (i >= 0) ops[i] = { ...ops[i], args: { kind: "abs", day: h.day, minute: h.time, fromHeader: true } };
    }
    if (!has("wx") && h.condition) {
      ops.push({ op: "wx", args: { condition: h.condition, intensity: h.intensity, tempC: h.tempC, wind: h.wind, glyph: h.glyph, fromHeader: true }, raw: "(header) weather" });
    } else if (h.glyph) {
      const wx = ops.find((x) => x.op === "wx");
      if (wx) wx.args.glyph = h.glyph;
    }
    if (!has("at") && h.place?.length) {
      ops.push({ op: "at", args: { path: h.place, fromHeader: true }, raw: "(header) place" });
    }
  }

  private applyOp(
    op: ParsedOp,
    mi: number,
    src: EventSource,
    castOp: boolean,
  ): { verdict: "accepted" | "rejected" | "warned"; reason?: string; line?: string } | void {
    const st = this.state;
    const strict = this.opts.strictness === "strict" && src !== "user";
    const a = op.args;
    const reject = (reason: string) => ({ verdict: "rejected" as const, reason });

    // The player's inner state is theirs in Sealed / Continuity modes.
    const innerOps = new Set(["mood", "journal", "status"]);
    if (innerOps.has(op.op) && op.subject && this.isUser(op.subject) && this.opts.sealed && !this.opts.personaThoughts && src !== "user") {
      return reject("the player's inner state belongs to the player (sealed persona)");
    }

    // Names the player removed from the cast (a force, a spell, a place): lines about them as people are dropped.
    if (CHAR_OPS.has(op.op) && (this.notAPerson(op.subject) || this.notAPerson(op.object))) {
      return reject(`${this.notAPerson(op.subject) ? op.subject : op.object} is not a person (removed from the cast)`);
    }

    switch (op.op) {
      case "clock": {
        const cur = st.time;
        if (a.kind === "rel") {
          if (a.minutes < 0) return reject("time cannot run backwards");
          if (!cur) {
            st.time = { day: 1, minute: 8 * 60 };
            return { verdict: "warned", reason: "no start time yet; assumed Day 1 08:00", line: `clock ${fmtSpan(a.minutes)}` };
          }
          const next = addMinutes(cur, a.minutes);
          this.drift(absMinutes(cur), absMinutes(next));
          st.time = next;
          return { verdict: "accepted", line: `🕰 +${fmtSpan(a.minutes)}` };
        }
        // absolute
        if (!cur) {
          st.time = { day: a.day ?? 1, minute: a.minute };
          return { verdict: "accepted", line: `🕰 Day ${st.time.day} ${fmtClock(a.minute)}` };
        }
        let day = a.day ?? cur.day;
        if (a.day == null && a.minute < cur.minute) day = cur.day + 1; // passed midnight
        const target = { day, minute: a.minute };
        const diff = absMinutes(target) - absMinutes(cur);
        // "+5m → 22:10" when the clock says 22:15: a target a little behind the clock is
        // the model's arithmetic slipping, not a night passing, so the span wins. (An
        // overnight skip, "+4m → 09:25" at 23:40, keeps its target.)
        const slipped = a.day == null && a.minute < cur.minute && cur.minute - a.minute <= 180;
        if (a.orRel != null && a.orRel >= 0 && (diff < 0 || slipped)) {
          st.time = addMinutes(cur, a.orRel);
          this.drift(absMinutes(cur), absMinutes(st.time));
          return { verdict: "warned", reason: `${fmtClock(a.minute)} doesn't fit the verified clock; moved it +${fmtSpan(a.orRel)} instead`, line: `🕰 +${fmtSpan(a.orRel)}` };
        }
        if (diff < 0) {
          if (a.fromHeader) return { verdict: "warned", reason: "header time is behind the verified clock; kept the clock" };
          return reject(`time cannot run backwards (${fmtClock(a.minute)} Day ${day} is before the current clock)`);
        }
        if (diff > 0) this.drift(absMinutes(cur), absMinutes(target));
        st.time = target;
        return diff > 18 * 60 && a.day == null
          ? { verdict: "warned", reason: "large implicit jump; assumed the next day", line: `🕰 → Day ${day} ${fmtClock(a.minute)}` }
          : { verdict: "accepted", line: diff ? `🕰 +${fmtSpan(diff)}` : undefined };
      }
      case "wx": {
        const prev = st.weather?.condition;
        st.weather = {
          condition: a.condition, intensity: a.intensity, tempC: a.tempC ?? st.weather?.tempC, wind: a.wind ?? st.weather?.wind,
          glyph: a.glyph ?? st.weather?.glyph, setAt: st.time ? { ...st.time } : null, source: a.fromHeader ? "header" : "model",
        };
        if (prev === a.condition) return { verdict: "accepted" };
        return { verdict: "accepted", line: `🌦 ${prev ? prev + " → " : ""}${a.condition}` };
      }
      case "at": {
        const path: string[] = a.path;
        const prev = st.place.join(" › ");
        // Relative paths ("back room") extend the current place when the root is unknown.
        let full = path;
        if (path.length === 1 && st.place.length && !st.places[slug(path[0])]) {
          const idx = st.place.findIndex((p) => p.toLowerCase() === path[0].toLowerCase());
          full = idx >= 0 ? st.place.slice(0, idx + 1) : st.place.length > 1 ? [...st.place.slice(0, -1), path[0]] : path;
        } else if (path.length < st.place.length && path.length > 1) {
          const root = st.place.findIndex((p) => p.toLowerCase() === path[0].toLowerCase());
          if (root > 0) full = [...st.place.slice(0, root), ...path];
        }
        st.place = full;
        for (let i = 0; i < full.length; i++) {
          const pid = `loc:${slug(full[i])}`;
          const pl = st.places[pid] ?? { id: pid, name: full[i], path: full.slice(0, i + 1), visits: 0, lastMsg: mi };
          if (i === full.length - 1 && prev !== full.join(" › ")) pl.visits++;
          pl.lastMsg = mi;
          st.places[pid] = pl;
        }
        const now = full.join(" › ");
        if (prev === now) return { verdict: "accepted" };
        // Moving without a cast update: whoever was present stays with the player.
        if (prev && !castOp) {
          for (const c of Object.values(st.chars)) if (c.tier === "spot" || c.tier === "peri") c.place = full[full.length - 1];
        }
        return { verdict: "accepted", line: `📍 ${now}` };
      }
      case "cast": {
        const lines: string[] = [];
        const listed = new Set<string>();
        const here = st.place[st.place.length - 1];
        for (const e of a.entries as { name: string; tier: string; activity?: string }[]) {
          const id = this.charId(e.name, mi);
          if (!id) continue;
          listed.add(id);
          const c = st.chars[id];
          if (c.dead && e.tier !== "left" && e.tier !== "dead") {
            if (strict) return reject(`${c.name} is dead and cannot appear`);
          }
          const before = c.tier;
          if (e.tier === "left") {
            c.tier = "off";
            c.place = e.activity?.replace(/^→\s*/, "").trim() || undefined;
            c.activity = undefined;
            lines.push(`${c.name} leaves`);
          } else if (e.tier === "dead") {
            c.dead = true;
            c.tier = "off";
            this.milestone(mi, "death", `${c.name} dies`);
            lines.push(`${c.name} dies`);
          } else if (e.tier === "off") {
            c.tier = "off";
          } else {
            // An arrival hears nothing said before it came in.
            if (e.tier === "arrive" || before === "off") c.arrivedMsg = mi;
            c.castSeen = (c.castSeen ?? 0) + 1;
            c.tier = e.tier === "arrive" ? "peri" : (e.tier as "spot" | "peri");
            c.place = here;
            if (e.activity) c.activity = e.activity.replace(/^←\s*/, "");
            if (before !== "spot" && before !== "peri") lines.push(`${c.name} ${e.tier === "arrive" ? "arrives" : "is here"}`);
          }
          c.lastSeen = mi;
        }
        return { verdict: "accepted", line: lines.length ? `👥 ${lines.join(" · ")}` : undefined };
      }
      case "mood": {
        const id = this.charId(op.subject!, mi)!;
        const c = st.chars[id];
        if (c.dead) return reject(`${c.name} is dead`);
        const prev = c.mood?.name;
        c.mood = { name: a.name, v: a.v ?? c.mood?.v, a: a.a ?? c.mood?.a, d: a.d ?? c.mood?.d, prev, at: st.time ? { ...st.time } : null };
        return { verdict: "accepted", line: `🎭 ${c.name}: ${prev ? prev + " → " : ""}${a.name}` };
      }
      case "body": {
        const id = this.charId(op.subject!, mi)!;
        const c = st.chars[id];
        const bits: string[] = [];
        for (const [k, v] of Object.entries(a.meters as Record<string, { v: number; rel: boolean }>)) {
          const before = c.meters[k] ?? 0;
          c.meters[k] = clamp(v.rel ? before + v.v : v.v, 0, 5);
          bits.push(`${k} ${c.meters[k]}`);
        }
        for (const f of a.flags as string[]) {
          if (f === "dead") {
            c.dead = true;
            this.milestone(mi, "death", `${c.name} dies`);
            bits.push("dead");
            continue;
          }
          if (/^(asleep|sleeping)$/.test(f)) c.flags = c.flags.filter((x) => x !== "awake");
          if (/^(awake|woke)$/.test(f)) c.flags = c.flags.filter((x) => !/asleep|sleeping/.test(x));
          if (!c.flags.includes(f)) c.flags.push(f);
          bits.push(f);
        }
        for (const f of a.unflags as string[]) c.flags = c.flags.filter((x) => x !== f && !x.startsWith(f));
        for (const inj of a.injuries as any[]) {
          const ex = c.injuries.find((i) => i.where.toLowerCase() === inj.where.toLowerCase());
          if (ex) Object.assign(ex, inj, { since: ex.since });
          else c.injuries.push({ ...inj, since: st.time ? { ...st.time } : null });
          bits.push(`injury: ${inj.where}`);
          if (inj.severity >= 3) this.milestone(mi, "injury", `${c.name}: ${inj.where} (${["", "scratch", "wound", "serious", "critical"][inj.severity]})`);
        }
        for (const h of a.heals as string[]) c.injuries = c.injuries.filter((i) => !i.where.toLowerCase().includes(h.toLowerCase()));
        if (c.flags.length > 12) c.flags = c.flags.slice(-12);
        return { verdict: "accepted", line: bits.length ? `🩹 ${c.name}: ${bits.join(", ")}` : undefined };
      }
      case "look": {
        const id = this.charId(op.subject!, mi)!;
        st.chars[id].look = a.text;
        return { verdict: "accepted", line: `👗 ${st.chars[id].name}: ${a.text}` };
      }
      case "status": {
        const id = this.charId(op.subject!, mi)!;
        st.chars[id].status = a.text;
        return { verdict: "accepted" };
      }
      case "bond": {
        const from = this.charId(op.subject!, mi)!;
        const to = this.charId(op.object!, mi)!;
        if (from === to) return reject("a bond needs two different people");
        if (from === "user" && this.opts.sealed && src !== "user") return reject("the player's feelings belong to the player (sealed persona)");
        if (st.chars[from]?.dead) return reject(`${st.chars[from].name} is dead`);
        const key = `${from}>${to}`;
        const b: BondState = st.bonds[key] ?? { from, to, axes: {}, tags: [], history: [] };
        st.bonds[key] = b;
        if (a.label) b.label = a.label;
        if (a.tags) b.tags = [...new Set([...b.tags, ...a.tags])];
        if (!a.changes?.length) return { verdict: "accepted", line: a.label ? `🕸 ${this.nm(from)} → ${this.nm(to)}: “${a.label}”` : undefined };
        if (strict && !op.cause) return reject("bond change without a cause");
        const lines: string[] = [];
        let warned: string | undefined;
        for (const ch of a.changes as { axis: BondAxis; delta: number }[]) {
          let d = ch.delta;
          if (Math.abs(d) >= 4 && !PIVOTAL.test(op.cause ?? "")) {
            d = Math.sign(d) * 2;
            warned = `a shift of ${ch.delta} needs a pivotal cause; clamped to ${d > 0 ? "+" : ""}${d}`;
          }
          const lo = BIPOLAR_AXES.includes(ch.axis) ? -5 : 0;
          const before = b.axes[ch.axis] ?? 0;
          const after = clamp(before + d, lo, 5);
          b.axes[ch.axis] = after;
          b.history.push({ axis: ch.axis, delta: after - before, from: before, to: after, cause: op.cause, at: st.time ? { ...st.time } : null, msgIndex: mi });
          lines.push(`${ch.axis} ${d > 0 ? "+" : ""}${d}`);
          if (Math.abs(d) >= 2) this.milestone(mi, "bond", `${this.nm(from)} → ${this.nm(to)}: ${ch.axis} ${d > 0 ? "+" : ""}${d}${op.cause ? ` (${op.cause})` : ""}`);
        }
        if (b.history.length > 60) b.history = b.history.slice(-60);
        const line = `🕸 ${this.nm(from)} → ${this.nm(to)}: ${lines.join(", ")}`;
        return warned ? { verdict: "warned", reason: warned, line } : { verdict: "accepted", line };
      }
      case "ladder": {
        const from = this.charId(op.subject!, mi)!;
        const to = this.charId(op.object!, mi)!;
        if (from === "user" && this.opts.sealed && src !== "user") return reject("the player's side of a ladder moves only by the player's words");
        const key = `${from}>${to}`;
        const cur = st.ladders[key]?.tier ?? (this.opts.romance === "established" ? 7 : 0);
        let tier = clamp(a.rel ? cur + a.tier : a.tier, 0, 7);
        const maxStep = this.opts.romance === "fast" ? 2 : 1;
        let warned: string | undefined;
        // A fall needs a reason. Models often write "tier 1" after a warm beat meaning
        // "up one"; that is read as a step up, and a fall with no hurt in its cause is held.
        if (tier < cur && src !== "user") {
          const why = op.cause ?? "";
          if (!LADDER_FALL.test(why)) {
            if (!a.rel && a.tier > 0 && LADDER_WARM.test(why)) {
              warned = `"tier ${a.tier}" after a warm beat read as a step up (+${a.tier}), not a fall from ${LADDER_NAMES[cur]}`;
              tier = clamp(cur + a.tier, 0, 7);
            } else {
              return reject(`a fall from ${LADDER_NAMES[cur]} to ${LADDER_NAMES[tier]} needs a cause (betrayal, a lie, neglect, cruelty); write the rung it reaches, or +1`);
            }
          } else if (cur - tier > 1 && !LADDER_FALL_HARD.test(why)) {
            warned = `fell ${cur - tier} rungs at once; only betrayal or the unforgivable drops more than one`;
            tier = cur - 1;
          }
        }
        if (this.opts.romance === "off" && tier > cur) return reject("romance pace is off");
        if (tier - cur > maxStep && src !== "user") {
          const skipped = tier - cur;
          warned = `${warned ? `${warned}; ` : ""}skipped ${skipped} rungs at once; the pace allows ${maxStep}`;
          tier = cur + maxStep;
          if (strict && this.opts.romance !== "measured") warned += " (clamped)";
        }
        const changed = !st.ladders[key] || st.ladders[key].tier !== tier;
        const l = st.ladders[key] ?? { from, to, tier: cur, at: null, msgIndex: mi, history: [] };
        l.tier = tier;
        l.evidence = op.cause;
        l.at = st.time ? { ...st.time } : null;
        l.msgIndex = mi;
        l.history.push({ tier, evidence: op.cause, msgIndex: mi });
        st.ladders[key] = l;
        st.genreHits.romance = mi;
        // Restating the same rung is not a milestone.
        if (changed) this.milestone(mi, "ladder", `${this.nm(from)} → ${this.nm(to)}: ${LADDER_NAMES[tier]}`);
        const line = changed ? `♡ ${this.nm(from)} → ${this.nm(to)}: ${LADDER_NAMES[tier]}` : undefined;
        return warned ? { verdict: "warned", reason: warned, line } : { verdict: "accepted", line };
      }
      case "know": {
        const holder = this.charId(op.subject!, mi);
        if (!holder) return reject(`${op.subject} is not a person`);
        st.chars[holder].voiced = true;
        // Lines stored by older versions (side events) carry a single fact: read them again.
        const k = a.items ? a : parseLine(op.raw)?.args ?? { items: [{ statement: a.fact ?? "", key: a.key, status: a.status ?? "knows", truth: a.truth ?? "unknown", how: a.source }], negations: [] };
        // Each item filed under its fact (by #key, else by wording); a holder's newer line on a fact replaces the older one.
        const keys = fileKnow(this.kctx!, holder, k as KnowArgs);
        keys.forEach((key, i) => {
          const it = k.items[i];
          const row: KnowRow = {
            id: `k${mi}_${st.knowledge.length}`, holder, fact: st.facts![key].statement, status: it.status, source: it.how, truth: it.truth,
            at: st.time ? { ...st.time } : null, msgIndex: mi, factKey: key,
          };
          for (const old of st.knowledge) if (old.holder === holder && !old.supersededBy && old.factKey === key) old.supersededBy = row.id;
          st.knowledge.push(row);
        });
        if (st.knowledge.length > 800) st.knowledge.splice(0, st.knowledge.length - 800);
        const first = keys[0] ? st.facts![keys[0]] : undefined;
        const more = keys.length > 1 ? ` (+${keys.length - 1})` : "";
        const gaps = k.negations?.length ? `${first ? "; " : ""}doesn't know: ${k.negations.slice(0, 3).join(", ")}` : "";
        const line = `🧠 ${this.nm(holder)}${first ? ` ${k.items[0].status}: ${first.statement}${k.items[0].truth === "false" ? " (false)" : ""}${more}` : ""}${gaps}`;
        return { verdict: "accepted", line };
      }
      case "reveal": {
        const key = fileReveal(this.kctx!, a as any);
        const f = st.facts![key];
        const by = a.source ? `${a.source}: ` : "";
        return { verdict: "accepted", line: `🗣 ${by}${f.statement} (${a.channel})` };
      }
      case "secret": {
        const key = fileSecret(this.kctx!, a as any);
        const f = st.facts![key];
        return { verdict: "accepted", line: `🤫 ${f.statement}${f.keptFrom?.length ? ` — kept from ${f.keptFrom.map((x) => this.nm(x)).join(", ")}` : ""}` };
      }
      case "unaware": {
        const holder = this.charId(op.subject!, mi);
        if (!holder) return reject(`${op.subject} is not a person`);
        st.chars[holder].voiced = true;
        fileUnaware(this.kctx!, holder, a.things);
        return { verdict: "accepted", line: `🧠 ${this.nm(holder)} doesn't know: ${a.things.slice(0, 3).join(", ")}` };
      }
      case "item": {
        const iid = `item:${slug(op.subject!)}`;
        const it = st.items[iid] ?? { id: iid, name: op.subject!, custody: [] };
        st.items[iid] = it;
        if (a.condition) {
          it.condition = a.condition;
          return { verdict: "accepted", line: `🎒 ${it.name}: ${a.condition}` };
        }
        const toRaw: string | undefined = a.to;
        const fromId = a.from ? this.holderId(a.from, mi) : it.holder;
        if (a.from && it.holder && fromId !== it.holder && !it.gone) {
          if (strict) return reject(`${this.nm(fromId!)} does not hold ${it.name} (${this.nm(it.holder)} does)`);
        }
        if (fromId && fromId !== "user" && st.chars[fromId]?.dead && strict) return reject(`${this.nm(fromId)} is dead`);
        if (strict && a.from && !op.cause) return reject("item transfer without a cause");
        if (toRaw === "gone") {
          it.gone = true;
          it.custody.push({ from: it.holder, to: "gone", how: op.cause, at: st.time ? { ...st.time } : null, msgIndex: mi });
          it.holder = "gone";
          this.milestone(mi, "item", `${it.name} is gone${op.cause ? ` (${op.cause})` : ""}`);
          return { verdict: "accepted", line: `🎒 ${it.name} → gone` };
        }
        const to = toRaw ? this.parseHolder(toRaw, mi) : {};
        if (to.same) {
          if (to.where) it.where = to.where;
          if (a.quantity != null) it.quantity = a.quantity;
          return { verdict: "accepted", line: `🎒 ${it.name}: ${this.nm(it.holder)}${it.where ? ` (${it.where})` : ""}` };
        }
        const toId = to.id;
        if (toId !== it.holder || to.where !== it.where) {
          it.custody.push({ from: it.holder, to: toId, how: op.cause, at: st.time ? { ...st.time } : null, msgIndex: mi });
          if (it.custody.length > 20) it.custody = it.custody.slice(-20);
        }
        it.holder = toId;
        it.where = to.where;
        it.gone = false;
        if (a.quantity != null) it.quantity = a.quantity;
        return { verdict: "accepted", line: `🎒 ${it.name}: ${a.from ? this.nm(fromId!) + " → " : ""}${this.nm(toId)}${to.where ? ` (${to.where})` : ""}` };
      }
      case "thread": {
        const tid = `thread:${slug(op.subject!)}`;
        const t = st.threads[tid] ?? { id: tid, title: op.subject!, status: "open" as const, stalls: 0, history: [], lastMsg: mi };
        const isNew = !st.threads[tid];
        st.threads[tid] = t;
        const tOp = a.op as ThreadOpName;
        t.history.push({ op: tOp, detail: a.detail, at: st.time ? { ...st.time } : null, msgIndex: mi });
        if (t.history.length > 12) t.history = t.history.slice(-12);
        t.lastMsg = mi;
        if (a.detail) t.latest = a.detail;
        let warned: string | undefined;
        if (tOp === "stall") {
          if (!a.blocker && strict) warned = "a stalled thread must name its blocker";
          t.status = "stalled";
          t.blocker = a.blocker;
          t.stalls++;
        } else if (tOp === "resolve") {
          t.status = "resolved";
          this.milestone(mi, "thread", `Resolved: ${t.title}`);
        } else {
          t.status = "open";
          t.stalls = 0;
          t.blocker = undefined;
          if (isNew || tOp === "new") this.milestone(mi, "thread", `New thread: ${t.title}`);
        }
        const line = `🧵 ${t.title}: ${tOp}${a.detail ? ` — ${a.detail}` : ""}`;
        if (!warned && strict && !a.detail && tOp !== "new" && tOp !== "resolve") warned = "thread change without a detail";
        return warned ? { verdict: "warned", reason: warned, line } : { verdict: "accepted", line };
      }
      case "owe":
      case "cons": {
        const who = this.partyId(op.subject!, mi)!;
        const whom = op.object ? this.partyId(op.object, mi) : undefined;
        const cid = `cons:${slug(`${who}_${whom ?? ""}_${a.what}`)}`;
        const existing = st.cons[cid] ?? Object.values(st.cons).find((c) => c.who === who && c.whom === whom && overlap(normFact(c.what), normFact(a.what)) > 0.6);
        const c = existing ?? { id: cid, kind: a.kind, who, whom, what: a.what, status: "open" as const, since: st.time ? { ...st.time } : null, msgIndex: mi };
        c.status = a.status;
        if (a.due) c.due = parseDue(a.due, st.time);
        st.cons[c.id] = c;
        if (!existing) this.milestone(mi, "cons", `${this.nm(who)} ${a.kind === "owe" ? "owes" : "→"} ${whom ? this.nm(whom) + ": " : ""}${a.what}`);
        return { verdict: "accepted", line: `⚖ ${this.nm(who)}${whom ? " → " + this.nm(whom) : ""}: ${a.what} (${c.status})` };
      }
      case "clockf": {
        const fid = `fac:${slug(op.subject!)}`;
        const f = st.factions[fid] ?? { id: fid, name: op.subject!, clocks: {} };
        st.factions[fid] = f;
        const pk = slug(a.project);
        const clk = f.clocks[pk] ?? { name: a.project, cur: 0, max: a.max ?? 6, history: [] };
        if (a.max) clk.max = a.max;
        clk.cur = clamp(a.cur != null ? a.cur : clk.cur + (a.inc ?? 1), 0, clk.max);
        clk.history.push(clk.cur);
        f.clocks[pk] = clk;
        st.genreHits.intrigue = mi;
        st.genreHits.thriller = mi;
        if (clk.cur >= clk.max) this.milestone(mi, "faction", `${f.name}: ${clk.name} complete`);
        return { verdict: "accepted", line: `⏳ ${f.name}: ${clk.name} ${clk.cur}/${clk.max}` };
      }
      case "rumor": {
        const text: string = a.text;
        const ex = st.rumors.find((r) => overlap(normFact(r.text), normFact(text)) > 0.6);
        if (ex) {
          ex.hops++;
          ex.to = a.to ?? ex.to;
          ex.msgIndex = mi;
        } else st.rumors.push({ id: `r${mi}_${st.rumors.length}`, text, from: a.from, to: a.to, truth: a.truth, hops: 1, msgIndex: mi });
        if (st.rumors.length > 60) st.rumors.splice(0, st.rumors.length - 60);
        return { verdict: "accepted", line: `🗣 ${text}` };
      }
      case "rep": {
        const gid = slug(op.object!);
        const r = st.rep[gid] ?? { group: op.object!, score: 0, tags: [], history: [] };
        r.score = clamp(r.score + (a.delta ?? 0), -3, 3);
        if (a.tag && !r.tags.includes(a.tag)) r.tags.push(a.tag);
        r.history.push({ delta: a.delta ?? 0, deed: op.cause, msgIndex: mi });
        st.rep[gid] = r;
        return { verdict: "accepted", line: `🏷 ${r.group}: ${r.score > 0 ? "+" : ""}${r.score}` };
      }
      case "journal": {
        const id = this.charId(op.subject!, mi)!;
        const c = st.chars[id];
        c.journal.push({ text: a.text, at: st.time ? { ...st.time } : null, msgIndex: mi });
        if (c.journal.length > 30) c.journal = c.journal.slice(-30);
        return { verdict: "accepted", line: `📓 ${c.name}: “${a.text}”` };
      }
      case "keys": {
        const rid = this.recordIdFor(op.subject!, mi);
        const cur = st.keys[rid] ?? [];
        st.keys[rid] = [...new Set([...cur, ...(a.keys as string[])])].slice(-16);
        return { verdict: "accepted" };
      }
      case "canon": {
        if (st.canon.some((c) => normFact(c.text) === normFact(a.text))) return { verdict: "accepted" };
        st.canon.push({ text: a.text, at: st.time ? { ...st.time } : null, msgIndex: mi });
        return { verdict: "accepted", line: `📜 ${a.text}` };
      }
      case "artifact": {
        const aid = `doc:${slug(op.subject!)}`;
        const ex = st.artifacts[aid];
        const holder = a.holder ? this.holderId(a.holder, mi) : ex?.holder;
        st.artifacts[aid] = { id: aid, title: op.subject!, kind: a.kind ?? ex?.kind ?? "document", holder, text: ex?.text, meta: ex?.meta, keys: ex?.keys ?? [], msgIndex: ex?.msgIndex ?? mi };
        this.milestone(mi, "artifact", `Filed: ${op.subject}`);
        return { verdict: "accepted", line: `📄 filed: ${op.subject}` };
      }
      case "mode": {
        st.mode = a.mode;
        return { verdict: "accepted" };
      }
      case "gauge": {
        const gid = slug(op.subject!);
        const g = st.gauges[gid] ?? { name: op.subject!, cur: 0, max: a.max ?? 5, history: [] };
        if (a.max) g.max = a.max;
        g.cur = clamp(a.cur != null ? a.cur : g.cur + (a.inc ?? 0), 0, g.max);
        g.cause = op.cause;
        g.history.push({ v: g.cur, msgIndex: mi });
        if (g.history.length > 30) g.history = g.history.slice(-30);
        st.gauges[gid] = g;
        const gn = g.name.toLowerCase();
        if (/dread|fear|terror/.test(gn)) st.genreHits.horror = mi;
        if (/corrupt/.test(gn)) st.genreHits.dark_fantasy = mi;
        if (/pressure|flaw/.test(gn)) st.genreHits.tragedy = mi;
        if (/supplies|water|food|warmth|needs/.test(gn)) st.genreHits.survival = mi;
        if (/tension|heat|charge/.test(gn)) st.genreHits.romance = mi;
        return { verdict: "accepted", line: `📊 ${g.name} ${g.cur}/${g.max}` };
      }
      case "clue": {
        st.clues.push({ id: `clue${mi}_${st.clues.length}`, text: a.text, pointsTo: a.pointsTo, reliability: a.reliability, msgIndex: mi });
        st.genreHits.mystery = mi;
        return { verdict: "accepted", line: `🔎 ${a.text}${a.pointsTo ? ` → ${a.pointsTo}` : ""}` };
      }
      case "plant": {
        st.plants.push({ id: `plant${mi}_${st.plants.length}`, text: a.text, payoff: a.payoff, plantedAt: mi, plantedScene: st.sceneNo });
        st.genreHits.comedy = mi;
        return { verdict: "accepted" };
      }
      case "payoff": {
        const t = normFact(a.text);
        const best = st.plants.filter((p) => p.paidAt == null).map((p) => ({ p, s: overlap(normFact(p.text), t) })).sort((x, y) => y.s - x.s)[0];
        if (best && best.s > 0.25) best.p.paidAt = mi;
        st.genreHits.comedy = mi;
        return { verdict: "accepted", line: `🎯 payoff: ${a.text}` };
      }
      case "deadline": {
        const did = `dl:${slug(op.subject!)}`;
        if (a.done) {
          if (st.deadlines[did]) st.deadlines[did].done = true;
          return { verdict: "accepted" };
        }
        const base = st.time ?? { day: 1, minute: 480 };
        const at = a.kind === "rel" ? addMinutes(base, a.minutes) : { day: a.day ?? (a.minute < base.minute ? base.day + 1 : base.day), minute: a.minute };
        st.deadlines[did] = { id: did, title: op.subject!, at, msgIndex: mi };
        st.genreHits.thriller = mi;
        return { verdict: "accepted", line: `⏰ ${op.subject}: Day ${at.day} ${fmtClock(at.minute)}` };
      }
      case "title": {
        st.title = a.text;
        return { verdict: "accepted" };
      }
      case "season": {
        const prev = st.season?.name;
        st.season = { name: a.name, setAt: st.time ? { ...st.time } : null };
        return prev === a.name ? { verdict: "accepted" } : { verdict: "accepted", line: `🍂 ${prev ? prev + " → " : ""}${a.name}` };
      }
      case "pressure": {
        const id = this.charId(op.subject!, mi, false);
        if (id) st.chars[id].pressure = a.text;
        return { verdict: "accepted" };
      }
      default:
        return { verdict: "accepted" };
    }
  }

  private nm(id: string | undefined): string {
    if (!id) return "nobody";
    if (id === "gone") return "gone";
    if (id.startsWith("loc:")) return this.state.places[id]?.name ?? id.slice(4);
    return this.state.chars[id]?.name ?? id;
  }

  /** Parties to a debt or consequence: a known place, else a character; a name removed from the cast stays as written. */
  private partyId(name: string, mi: number): string | undefined {
    const pid = `loc:${slug(name.trim())}`;
    if (this.state.places[pid]) return pid;
    return this.charId(name, mi) ?? (this.notAPerson(name) ? name.trim() : undefined);
  }

  private notAPerson(name?: string): boolean {
    if (!name) return false;
    return this.opts.merges?.[name.replace(/#\d+$/, "").replace(/^["“]|["”]$/g, "").trim().toLowerCase()] === NOT_A_PERSON;
  }

  /** Holders are characters, or places for items left somewhere. */
  holderId(name: string, mi: number): string | undefined {
    const n = name.trim();
    if (!n) return undefined;
    if (/^(the )?(floor|ground|table|room|here)$/i.test(n) || n.startsWith("loc:")) return `loc:${slug(this.state.place[this.state.place.length - 1] ?? n)}`;
    return this.parseHolder(n, mi).id;
  }

  /**
   * Reads where an item ended up. Models write this loosely — "held by Buffy in
   * jacket pocket (visible)", "in Buffy's jacket pocket (no change)", "on the
   * table" — so only a bare name, or a name found inside the phrase, makes a
   * holder; the rest is kept as the spot (`where`), never as a new character.
   */
  parseHolder(raw: string, mi: number): { id?: string; where?: string; same?: boolean } {
    let s = raw;
    for (let i = 0; i < 4 && /\([^()]*\)/.test(s); i++) s = s.replace(/\s*\([^()]*\)/g, "");
    s = s.replace(/\s+/g, " ").replace(/[.;,]+$/, "").trim();
    if (!s || /^(no change|unchanged|same|still|as before)$/i.test(s)) return { same: true };
    const known = (n: string) => this.charId(n.replace(/^(the|a)\s+/i, ""), mi, false) ?? undefined;
    const spot = (w?: string) => w?.replace(/^(?:in|on|at|inside|under|in the|on the)\s+/i, "").trim() || undefined;
    const tail = (w?: string) => spot(w?.replace(/^(?:in|on|at|inside|under|within|tucked in|hidden in)\s+/i, ""));
    // "held by Buffy in jacket pocket", "with Mara", "given to Kael"
    const by = /^(?:held|carried|kept|worn|owned|taken|pocketed|hidden|stashed)?\s*(?:by|with|to)\s+(.+?)(?:\s+(?:in|on|at|inside|under|around|behind)\s+(.+))?$/i.exec(s);
    if (by) {
      const id = known(by[1]) ?? (this.looksLikeName(by[1]) ? this.charId(by[1], mi) ?? undefined : undefined);
      if (id) return { id, where: tail(by[2]) };
    }
    // "in Buffy's jacket pocket", "Mara's satchel", "your coat"
    const pos = /^(?:(?:in|on|at|inside|under|around|behind|tucked in|hidden in)\s+)?(?:the\s+)?([A-Z\u00C0-\u00DE][\w\u00C0-\u024F'’-]*(?:\s+[A-Z\u00C0-\u00DE][\w\u00C0-\u024F'’-]*){0,3})['’]s?\s+(.+)$/.exec(s);
    if (pos) {
      const id = known(pos[1]) ?? (this.looksLikeName(pos[1]) ? this.charId(pos[1], mi) ?? undefined : undefined);
      if (id) return { id, where: pos[2].trim() };
    }
    const mine = /^(?:(?:in|on|at|inside|under)\s+)?(?:your|my)\s+(.+)$/i.exec(s);
    if (mine) return { id: this.charId("user", mi) ?? undefined, where: mine[1].trim() };
    const exact = known(s);
    if (exact) return { id: exact };
    const pid = `loc:${slug(s)}`;
    if (this.state.places[pid]) return { id: pid };
    if (this.looksLikeName(s)) return { id: this.charId(s, mi) ?? undefined };
    // A spot, not a person: left here, at the current place.
    const here = this.state.place[this.state.place.length - 1];
    return { id: here ? `loc:${slug(here)}` : undefined, where: s };
  }

  /** A short capitalised name ("Mara", "Captain Voss"), not a phrase. */
  private looksLikeName(s: string): boolean {
    const t = s.trim();
    if (!t || t.length > 40 || /[()\d:]/.test(t) || !/^[A-Z\u00C0-\u00DE]/.test(t)) return false;
    const words = t.split(/\s+/);
    if (words.length > 4) return false;
    const filler = /^(in|on|at|by|the|a|an|from|with|under|inside|near|behind|held|carried|no|change|pocket|bag|hand|table|floor)$/i;
    return !words.some((w, i) => filler.test(w) && !(i > 0 && /^(of|the)$/i.test(w) && /^[A-Z]/.test(words[i + 1] ?? "")));
  }

  /** `keys Name:` can target a character, item, thread, place, faction or document. */
  recordIdFor(name: string, mi: number): string {
    const s = slug(name);
    const st = this.state;
    if (this.isUser(name)) return "char:user";
    const cid = this.charId(name, mi, false);
    if (cid) return `char:${cid}`;
    for (const prefix of ["item:", "thread:", "loc:", "fac:", "doc:"]) {
      const id = prefix + s;
      if ((st as any)[{ "item:": "items", "thread:": "threads", "loc:": "places", "fac:": "factions", "doc:": "artifacts" }[prefix]!][id]) return id;
    }
    return `custom:${s}`;
  }

  /** Clock-driven drift for meters that are being tracked (§6.3). */
  private drift(fromAbs0: number, toAbs: number) {
    const span = toAbs - fromAbs0;
    if (span <= 0) return;
    const sleeping = this.state.mode === "downtime" && span >= 360;
    for (const c of Object.values(this.state.chars)) {
      if (c.dead) continue;
      const present = c.tier === "spot" || c.tier === "peri" || c.isUser;
      if (!present) continue;
      const m = c.meters;
      const acc = ((c as any)._acc ??= { hunger: 0, thirst: 0, fatigue: 0, intox: 0 });
      const bump = (k: "hunger" | "thirst" | "fatigue", rate: number) => {
        if (m[k] == null) return;
        acc[k] += span;
        const n = Math.floor(acc[k] / rate);
        if (n > 0) {
          m[k] = clamp((m[k] ?? 0) + n, 0, 5);
          acc[k] -= n * rate;
        }
      };
      bump("hunger", 300);
      bump("thirst", 180);
      if (sleeping && m.fatigue != null) {
        m.fatigue = clamp(m.fatigue - (span >= 420 ? 4 : 3), span < 240 ? 2 : 0, 5);
        acc.fatigue = 0;
      } else bump("fatigue", 240);
      if (m.intox != null && m.intox > 0) {
        acc.intox += span;
        const n = Math.floor(acc.intox / 90);
        if (n > 0) {
          m.intox = clamp(m.intox - n, 0, 5);
          acc.intox -= n * 90;
        }
      }
      // Healing by elapsed time.
      c.injuries = c.injuries.filter((inj) => {
        if (!inj.since) return true;
        const age = toAbs - absMinutes(inj.since);
        const heal = [0, 2 * MIN_PER_DAY, 14 * MIN_PER_DAY, 42 * MIN_PER_DAY, Infinity][inj.severity];
        if (age >= heal * (inj.treated ? 1 : 1.5)) {
          if (inj.severity >= 3 && !c.flags.includes(`scar: ${inj.where}`)) c.flags.push(`scar: ${inj.where}`);
          return false;
        }
        return true;
      });
    }
  }
}

type ThreadOpName = "new" | "advance" | "complicate" | "bridge" | "resolve" | "stall";

/** Causes that can bring a romance ladder down, and the ones that can drop it more than a rung. */
const LADDER_FALL = /betray|\blie[sd]?\b|\blying\b|decei|neglect|abandon|cruel|cheat|reject|humiliat|contempt|disgust|resent|jealous|furious|\bangry\b|\banger\b|\bfight\b|argument|insult|threat|hurt (him|her|them)|\bhit\b|struck|walked (away|out)|left (him|her|them)|\bbroke\b|lost (her |his |their )?trust|distrust|suspicio|went cold|pulled away|shut (him|her|them) out|\bgrudge\b|regress|drops? a rung/i;
const LADDER_FALL_HARD = /betray|cheat|abandon|\bhit\b|struck|violen|unforgivable|\bmurder|\bkill/i;
/** Causes that read as a warm beat: a lower rung here is almost always a mis-written step up. */
const LADDER_WARM = /\bheld\b|\bhold|hug|embrac|kiss|smil|laugh|comfort|warm|tender|gentle|\bsafe\b|protect|saved|rescued|confess|\bstayed\b|didn't (pull|let) (away|go)|leaned|touch|\bhand\b|close|trust|open(ed)? up|let (him|her|them) (in|hold)|blush|flirt|charm|spark|linger/i;

export const LADDER_NAMES = ["Strangers", "Aware", "Interested", "Charged", "Tested", "Spoken", "Together", "Established"];

export function fmtClock(minute: number): string {
  const m = ((minute % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** The merge target that marks a name as not a person (removed from the cast). */
export const NOT_A_PERSON = "-";
/** Ops whose subject or object must be a person. */
const CHAR_OPS = new Set(["mood", "body", "look", "bond", "ladder", "know", "unaware", "status", "journal"]);

export function normFact(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
}

const STOP = new Set("the a an of to in on at is was be and or for with by from that this it its his her their he she they".split(" "));

export function overlap(a: string, b: string): number {
  const A = new Set(a.split(" ").filter((w) => w && !STOP.has(w)));
  const B = new Set(b.split(" ").filter((w) => w && !STOP.has(w)));
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}

function parseDue(raw: string, now: StoryTime | null): { at?: StoryTime; trigger?: string; raw: string } {
  const d = /day\s*(\d+)(?:\D+(\d{1,2})[:.](\d{2}))?/i.exec(raw);
  if (d) return { at: { day: parseInt(d[1], 10), minute: d[2] ? parseInt(d[2], 10) * 60 + parseInt(d[3], 10) : 12 * 60 }, raw };
  const rel = /\+?\s*(\d+)\s*(d|h|day|days|hours?)/i.exec(raw);
  if (rel && now) {
    const n = parseInt(rel[1], 10);
    return { at: addMinutes(now, rel[2].startsWith("d") ? n * MIN_PER_DAY : n * 60), raw };
  }
  if (/tomorrow/i.test(raw) && now) return { at: { day: now.day + 1, minute: 9 * 60 }, raw };
  if (/tonight/i.test(raw) && now) return { at: { day: now.day, minute: 21 * 60 }, raw };
  return { trigger: raw, raw };
}

export { fromAbs };
export const _test = { parseDue, ALL_AXES };
