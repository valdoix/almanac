// Facts: who has what information, and how it reached them (design/07).
//
// A fact is one plain statement with a #key. Each person stands somewhere on it
// (knows · believes · suspects · doubts · wrong · unaware) with a route (said it,
// heard it, was told, worked it out…). Three rules keep it honest:
//   · knowledge travels by events: what is said aloud reaches everyone in earshot,
//     and whoever said it has it — the engine spreads it, the model needn't list them;
//   · no record is not ignorance: someone only "lacks" a fact with evidence
//     (it's kept from them, they weren't there when it came out, or the story said so);
//   · only people know things: someone who has spoken, thought or been named on a
//     knowledge line (or the player) — never a cat, a force, or anyone asleep.

import type {
  CharacterState, FactEdit, FactOut, FactStance, FactState, KnowGap, KnowRoute, KnowStatus, KnowTruth, SpokenLine, WorldState,
} from "./types";
import type { StoryTime } from "./util";
import type { KnowArgs, KnowItem, RevealArgs, SecretArgs } from "./knowparse";
import { isPublicChannel } from "./knowparse";
import { normFact, overlap } from "./state";

const STOP = new Set(("the a an of to in on at is was be and or for with by from that this it its his her their he she they him them has had have not no " +
  "you your yours i me my we our us are were been being do does did don doesn didn isn wasn can will would could should just so too very as up out").split(" "));

// A light stem, so "died" meets "death" and "called" meets "Calling".
const IRREGULAR: Record<string, string> = { died: "die", dies: "die", dead: "die", death: "die", dying: "die", killed: "kill", killing: "kill", lives: "live", lived: "live", alive: "live" };
function stem(w: string): string {
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length >= 6 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length >= 5 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length >= 5 && w.endsWith("es") && !w.endsWith("ses")) return w.slice(0, -2);
  if (w.length >= 4 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Content words of a wording (stemmed). */
export function words(s: string): string[] {
  return normFact(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
}

/**
 * How alike two wordings are, over the larger of the two: strict, so a short
 * line inside a long one doesn't count ("Buffy was in Heaven" is not "Buffy has
 * not said Heaven aloud").
 */
export function sameFact(a: string, b: string): number {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  if (Math.min(A.size, B.size) < 2) return n === A.size && n === B.size ? 1 : 0;
  return n / Math.max(A.size, B.size);
}

const MATCH = 0.7;

const slugKey = (s: string) => s.toLowerCase().replace(/^#/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** A key for a new fact: its first few content words, as written. */
function newKey(facts: Record<string, FactState>, statement: string): string {
  const raw = normFact(statement).split(" ").filter((w) => w.length > 1 && !STOP.has(w));
  const base = slugKey(raw.slice(0, 3).join("-")) || "fact";
  let k = base;
  for (let i = 2; facts[k]; i++) k = `${base}-${i}`;
  return k;
}

/** An existing fact the wording belongs to, if any. */
export function findFact(facts: Record<string, FactState>, statement: string): string | undefined {
  // The same words quoted: the same line said (`someone said "…"` is `Gabriel said "…"`).
  const q = /["“]([^"“”]{2,200})["”]/.exec(statement)?.[1];
  if (q && statement.replace(/["“][^"“”]*["”]/, "").split(/\s+/).filter(Boolean).length <= 3) {
    const nq = normFact(q);
    const quoted = (s: string) => [...s.matchAll(/["“]([^"“”]+)["”]/g)].map((m) => normFact(m[1]));
    const hit = Object.values(facts).find((f) => quoted(f.statement).some((x) => x === nq || (nq.split(" ").length >= 2 && x.includes(nq))));
    if (hit) return hit.key;
  }
  if (words(statement).length < 2) return undefined;
  let best: { key: string; s: number } | undefined;
  for (const f of Object.values(facts)) {
    const s = Math.max(sameFact(statement, f.statement), ...f.aliases.map((a) => sameFact(statement, a)));
    if (s >= MATCH && (!best || s > best.s)) best = { key: f.key, s };
  }
  return best?.key;
}

// Words that describe how someone came to know, rather than the fact itself.
const EVIDENCE = /\b(confirm|because|silence|observ|deduc|guess|noticed|said it|told (him|her|them)|didn't correct|from her|from his|from their|this beat)/i;

/** Is `a` a cleaner statement of the fact than `b`? Plain and short wins. */
function cleaner(a: string, b: string): boolean {
  const wa = words(a).length;
  const wb = words(b).length;
  if (wa < 2) return false;
  const ea = EVIDENCE.test(a);
  const eb = EVIDENCE.test(b);
  if (ea !== eb) return !ea;
  return wa < wb;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const ROUTES: [RegExp, KnowRoute][] = [
  [/\bkeeps?\b|kept by/i, "kept"],
  [/deduc|infer|worked (it )?out|figured|pieced|reason|put (it )?together|narrator-only|unspoken|timing/i, "deduced"],
  [/overheard|eavesdrop/i, "overheard"],
  [/told|heard from|explained|informed|confess|admitted|from (him|her|them)\b|player ooc/i, "told"],
  [/\bread\b|letter|\bnote\b|diary|journal|document|\btext(ed)?\b/i, "read"],
  [/heard|direct speech|said it|spoken|aloud|in (her|his|their) voice/i, "heard"],
  [/\bsaw\b|seen|watch|witness|observ|noticed|shown|visible|direct/i, "saw"],
  [/guess|hunch|intuit|sens|felt|instinct|smell|clinical|physical|palpable|magic/i, "sensed"],
  [/rumou?r|gossip|word is/i, "rumour"],
  [/lived|experienc|remember|always knew|own secret|was there|herself|himself|themsel|self-knowledge|professional/i, "lived"],
];

export function routeOf(how?: string): KnowRoute | undefined {
  if (!how) return undefined;
  for (const [re, r] of ROUTES) if (re.test(how)) return r;
  return undefined;
}

const HAS: KnowStatus[] = ["knows", "believes", "suspects", "doubts", "wrong"];
export const hasIt = (s?: FactStance) => !!s && s.status === "knows";
export const standsOn = (s?: FactStance) => !!s && s.status !== "unaware";

/** "said it", "heard it said", "was told by Valeria", "suspects it"… */
export function stanceVerb(s: Pick<FactStance, "status" | "route" | "from" | "version" | "how">, nm: (id: string) => string = (x) => x): string {
  switch (s.status) {
    case "wrong":
      return s.version ? `wrongly believes "${s.version}"` : "believes otherwise";
    case "believes":
      return "believes it";
    case "suspects":
      return "suspects it";
    case "doubts":
      return "doubts it";
    case "unaware":
      return s.route === "hidden" ? "doesn't know (kept from them)" : s.route === "missed" ? "wasn't there when it came out" : "doesn't know";
  }
  const from = s.from ? ` by ${nm(s.from)}` : "";
  switch (s.route) {
    case "said": return "said it";
    case "lived": return "lived it";
    case "heard": return s.from ? `heard it from ${nm(s.from)}` : "heard it said";
    case "told": return `was told${from}`;
    case "overheard": return "overheard it";
    case "read": return "read it";
    case "saw": return "saw it";
    case "deduced": return "worked it out";
    case "sensed": return "sensed it";
    case "rumour": return "heard it as rumour";
    case "kept": return "keeps it";
  }
  return "knows it";
}

/** Kept for callers that only have a status and the written how. */
export function howVerb(status: KnowStatus, how?: string): string {
  return stanceVerb({ status, route: routeOf(how) });
}

// ---------------------------------------------------------------------------
// People who can know
// ---------------------------------------------------------------------------

const ASLEEP = /\b(asleep|sleeping|unconscious|passed out|knocked out|out cold|comatose|dozing|sedated|fainted)\b/i;

/** In the scene: spotlight or periphery (the player unless a cast line sent them off). */
export const isHere = (c: CharacterState) => (c.tier === "spot" || c.tier === "peri" || (c.isUser && c.tier !== "off")) && !c.dead;

/**
 * A person who can know things: the player; anyone who has spoken or been named on a
 * knowledge line; and anyone who has just entered a scene. Someone who has been in
 * four or more replies without ever saying a word is taken for a pet, a force or a
 * thing (a cat given thoughts in the register is still a cat), and a name that only
 * turns up in a debt or an item line was never in a scene at all; a knowledge line
 * about them, or a line of speech, makes them a person.
 */
export const isKnower = (c?: CharacterState) => !!c && !c.dead && (c.isUser || !!c.voiced || ((c.castSeen ?? 0) >= 1 && (c.castSeen ?? 0) < 4));

/** Present, a person, and awake: someone who takes in what is said aloud. */
export function canHear(c: CharacterState): boolean {
  return isHere(c) && isKnower(c) && !ASLEEP.test(c.activity ?? "");
}

/** People here now (knowers only), the player included. */
export function peopleHere(st: WorldState): string[] {
  return Object.values(st.chars).filter((c) => isHere(c) && isKnower(c)).map((c) => c.id);
}

// ---------------------------------------------------------------------------
// Filing
// ---------------------------------------------------------------------------

export interface KnowCtx {
  st: WorldState;
  mi: number;
  at: StoryTime | null;
  edits: Record<string, FactEdit>;
  /** A written name → character id, or null for a thing / someone removed from the cast. */
  who(name: string, create: boolean): string | null;
  nm(id: string): string;
  /** Who takes in what is said aloud right now (arrivals this message excluded). */
  listeners(): string[];
  /** Lines as filed, for the model's own history. */
  canon: string[];
  /** Set when a line needed repair (for the clerk). */
  repaired: boolean;
}

/**
 * The holder restating their own earlier line, grown or trimmed ("the woman … has a
 * pulse" → "… has a pulse, she watched him fight"): the same fact, in its newest words.
 */
function restated(ctx: KnowCtx, stmt: string, holder: string): FactState | undefined {
  const nw = new Set(words(stmt));
  if (nw.size < 2) return undefined;
  for (const f of Object.values(ctx.st.facts ?? {})) {
    if (!f.autoKey || !f.stances[holder] || ctx.edits[f.key] || ctx.mi - f.lastMsg > 20) continue;
    const fw = new Set(words(f.statement));
    if (fw.size < 2) continue;
    const oldIn = [...fw].filter((w) => nw.has(w)).length / fw.size;
    const newIn = [...nw].filter((w) => fw.has(w)).length / nw.size;
    if (oldIn >= 0.85 || newIn >= 0.85) {
      // Grown: the fuller list. Trimmed: the cleaner fact ("Buffy was in Heaven" over "her silence confirmed it was Heaven").
      const next = oldIn >= 0.85 && nw.size > fw.size ? stmt : newIn >= 0.85 && cleaner(stmt, f.statement) ? stmt : null;
      return next && !f.locked ? reword(ctx, f, next) : f;
    }
  }
  return undefined;
}

/** A fact with an automatic key takes new words; its key follows them (the old one still resolves). */
function reword(ctx: KnowCtx, f: FactState, stmt: string): FactState {
  f.statement = stmt;
  if (!f.autoKey) return f;
  const facts = ctx.st.facts!;
  const old = f.key;
  delete facts[old];
  const k = newKey(facts, stmt);
  facts[old] = f;
  if (k === old || ctx.edits[old]) return f;
  delete facts[old];
  f.key = k;
  f.altKeys = [...(f.altKeys ?? []), old];
  facts[k] = f;
  for (const r of ctx.st.knowledge) if (r.factKey === old) r.factKey = k;
  return f;
}

function resolveFact(ctx: KnowCtx, key: string | undefined, stmt: string, holder?: string): { f: FactState; keyed: boolean } {
  const st = ctx.st;
  const facts = (st.facts ??= {});
  let k: string | undefined;
  let keyed = false;
  if (key) {
    const s = slugKey(key);
    k = facts[s] ? s : Object.values(facts).find((f) => f.altKeys?.includes(s))?.key;
    keyed = true;
    if (!k) {
      // A fact filed under an automatic key takes the model's key the first time it gives one.
      const same = stmt ? findFact(facts, stmt) : undefined;
      if (same && facts[same].autoKey && !ctx.edits[same]) {
        const f = facts[same];
        delete facts[same];
        facts[s] = { ...f, key: s, autoKey: false, altKeys: [...(f.altKeys ?? []), same] };
        for (const r of st.knowledge) if (r.factKey === same) r.factKey = s;
      }
      k = s;
    }
  } else if (stmt) k = findFact(facts, stmt) ?? (holder ? restated(ctx, stmt, holder)?.key : undefined);
  let auto = false;
  if (!k) {
    k = newKey(facts, stmt || "fact");
    auto = true;
    ctx.repaired = true;
  }
  for (let i = 0; i < 6 && ctx.edits[k]?.into; i++) k = slugKey(ctx.edits[k].into!);
  let f = facts[k];
  if (!f) {
    f = facts[k] = {
      key: k, statement: stmt || k.replace(/-/g, " "), truth: "unknown", aliases: [], stances: {}, history: [],
      firstMsg: ctx.mi, lastMsg: ctx.mi, ...(auto ? { autoKey: true } : {}),
    };
  }
  const e = ctx.edits[k];
  if (e?.statement) {
    f.statement = e.statement;
    f.locked = true;
  }
  if (e?.truth) f.truth = e.truth;
  if (e?.hidden) f.hidden = true;
  return { f, keyed };
}

/** Take a wording for the fact: remember it, and use it as the statement when it is cleaner (keyed lines only). */
function takeWording(f: FactState, stmt: string, keyed: boolean) {
  if (!stmt) return;
  const n = normFact(stmt);
  if (!f.aliases.includes(n)) f.aliases = [...f.aliases, n].slice(-12);
  if (f.locked) return;
  const placeholder = f.statement === f.key.replace(/-/g, " ");
  if (placeholder || (keyed && cleaner(stmt, f.statement) && sameFact(stmt, f.statement) >= 0.34)) f.statement = stmt;
}

/**
 * Where a person stands. A line written for them always sets it; a stance the
 * engine worked out (`derived`) only fills an empty place or ends an "unaware" —
 * it never overrides a belief, a suspicion or a wrong belief.
 */
function setStance(
  ctx: KnowCtx, f: FactState, holder: string,
  s: { status: KnowStatus; how?: string; route?: KnowRoute; from?: string; version?: string; derived?: FactStance["derived"] },
  note?: string,
): boolean {
  const cur = f.stances[holder];
  if (cur?.set || f.cleared?.includes(holder)) return false;
  if (s.derived && cur && cur.status !== "unaware") return false;
  const route = s.route ?? routeOf(s.how);
  f.stances[holder] = compact({ holder, status: s.status, how: s.how, route, from: s.from, version: s.version, derived: s.derived, msgIndex: ctx.mi, at: ctx.at });
  f.history.push(compact({ holder, status: s.status, how: s.how, route, from: s.from, version: s.version, note, derived: s.derived, msgIndex: ctx.mi, at: ctx.at }));
  if (f.history.length > 60) f.history.splice(0, f.history.length - 60);
  f.lastMsg = Math.max(f.lastMsg, ctx.mi);
  if (s.status !== "unaware") {
    if (f.keptFrom?.includes(holder)) f.keptFrom = f.keptFrom.filter((x) => x !== holder);
    if (s.status !== "wrong") closeGaps(ctx.st, holder, f);
  }
  return true;
}

/**
 * The fact came out in the open: whoever said it has it, and everyone who can
 * hear takes it in. Private channels reach only the named listeners.
 */
function comeOut(ctx: KnowCtx, f: FactState, opts: { by?: string; channel: string; named: string[]; everyone: boolean; room?: string[] }) {
  const pub = opts.everyone || isPublicChannel(opts.channel);
  const room = opts.room ?? ctx.listeners();
  const reached = new Set<string>(opts.named);
  if (pub) for (const id of room) reached.add(id);
  const seen = /shown|showed|showing|seen|visible|plain sight/.test(opts.channel);
  const read = /letter|note|written|wrote|text|message/.test(opts.channel);
  if (opts.by) {
    reached.delete(opts.by);
    if (isKnower(ctx.st.chars[opts.by])) setStance(ctx, f, opts.by, { status: "knows", route: "said", how: seen ? "showed it" : read ? "wrote it" : "said it", derived: "source" });
  }
  for (const id of reached) {
    const named = opts.named.includes(id);
    setStance(ctx, f, id, {
      status: "knows",
      route: seen ? "saw" : read ? "read" : "heard",
      how: `${seen ? "saw it" : read ? "read it" : "heard it"}${pub ? "" : ` (${opts.channel})`}`,
      from: opts.by,
      ...(named ? {} : { derived: "witness" as const }),
    });
  }
  const out: FactOut = { msgIndex: ctx.mi, at: ctx.at, by: opts.by, channel: opts.channel, present: [...reached, ...(opts.by ? [opts.by] : [])] };
  if (!pub) (out as any).room = room;
  f.out = [...(f.out ?? []), out].slice(-8);
}

// Said aloud, from the words describing how someone came to it.
const SPOKEN = /\bsaid\b|\bsays\b|\bsay\b|\btold\b|\btells\b|announc|reveal|confess|admit|declar|shout|explain|stated|mention|\basked\b|aloud|out loud|in front of|to everyone|to the room|\bheard\b|\bspoke\b|direct speech|named it/i;
// Spoken in the open, by the line's own words.
const PUBLIC_HOW = /aloud|out loud|in front of|to everyone|to the room|to all|announc|shout|declar|in the room|direct speech/i;
const PRIVATE = /whisper|private|in secret|secretly|\balone\b|aside|letter|\bnote\b|message|text(ed)?\b|thought|dream|vision|\bread\b|overheard|eavesdrop|spied|diary|journal|confided|under (her|his|their) breath|deduc|infer|sens|unspoken|narrator|guess|hunch|sensory|palpable|physical|clinical/i;

// "Gabriel calls himself Gabe-o", "Buffy said no": a person's own words or deed — they have it.
const ACT = /^(.+?)(?:['’]s)?\s+(?:said|says|told|tells|asked|asks|calls?\s+(?:him|her|them)sel(?:f|ves)|called\s+(?:him|her|them)sel(?:f|ves)|named|offered|offers|admitted|admits|confessed|confesses|refused|refuses|joked|jokes|laughed|promised|promises|lied|lies|whispered|shouted|confirmed|denied|denies|agreed|agrees|accepted|accepts|gave|gives|showed|shows|revealed|reveals|announced|introduced|explained|explains|apologi[sz]ed|swore|threatened|begged|kissed|chose|decided|made a joke|made)\b/i;

/** The person whose own words or deed the fact is, if the statement opens with them. */
function actorOf(ctx: KnowCtx, stmt: string): string | null {
  const m = ACT.exec(stmt.trim());
  if (!m || m[1].split(/\s+/).length > 3) return null;
  const id = ctx.who(m[1], false);
  return id && isKnower(ctx.st.chars[id]) ? id : null;
}

// Words too common in speech to show that a fact was said.
const SPEECH_STOP = new Set("said says told tells asked calls called named know knows like just really very yes yeah okay ok well now then here there what who how why when where".split(" "));

/**
 * Who said a spoken line: its [spk] mark, else the last person named at the start
 * of a sentence in the narration before it ("Valeria stops. Her eyes widen. "…""),
 * else — in the player's message — the player's character ("He grins. "…"").
 */
function speakerOf(ctx: KnowCtx, line: SpokenLine, fromUser: boolean): string | undefined {
  if (line.who) return ctx.who(line.who, false) ?? undefined;
  const sentences = (line.lead ?? "").split(/(?<=[.!?…"”])\s+/).filter(Boolean).reverse().slice(0, 4);
  for (const s of sentences) {
    const m = /^\s*(?:\*|_)?([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)?)/u.exec(s);
    // A pronoun or a plain word: look one sentence further back for who it is.
    if (!m || /^(?:He|She|They|His|Her|Their|It|Its|The|A|An|Then|And|But|So)$/.test(m[1].split(/\s+/)[0])) continue;
    const id = ctx.who(m[1], false) ?? ctx.who(m[1].split(/\s+/)[0], false);
    if (id) return id;
  }
  return fromUser ? ctx.who("{{user}}", true) ?? undefined : undefined;
}

/** "Valeria named it", "told by Valeria", "Gabriel said it" in the evidence: who it came from. */
function sourceIn(ctx: KnowCtx, text?: string): string | null {
  if (!text) return null;
  const m = /\b(?:told by|heard from|from|by)\s+([A-Z][\p{L}'’-]+)/u.exec(text) ?? /\b([A-Z][\p{L}'’-]+)\s+(?:named|said|told|explained|revealed|confirmed|called)\s+(?:it|her|him|them|so)\b/u.exec(text);
  return m ? ctx.who(m[1], false) : null;
}

/** The person a statement opens with ("Gabriel is a Slayer", "Gabriel's house…"), if present. */
function subjectOf(ctx: KnowCtx, stmt: string): string | null {
  const m = /^([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)?)(?:['’]s)?\b/u.exec(stmt.trim());
  if (!m) return null;
  const id = ctx.who(m[1], false) ?? ctx.who(m[1].split(/\s+/)[0], false);
  return id && isKnower(ctx.st.chars[id]) ? id : null;
}

/**
 * Was this said aloud in the scene (this reply, or the player's message before it)?
 * A quoted phrase, a distinctive hyphenated word ("Gabe-o"), or most of the
 * fact's content words in one spoken line.
 */
function heardAloud(ctx: KnowCtx, text: string): { by?: string; room?: string[] } | null {
  const recent = (ctx.st.speech ?? []).filter((e) => e.msgIndex <= ctx.mi && e.msgIndex >= (ctx.st.speechSince ?? 0));
  if (!recent.length) return null;
  const names = new Set<string>();
  for (const c of Object.values(ctx.st.chars)) for (const n of [c.name, ...c.aliases]) for (const w of normFact(n).split(" ")) names.add(w);
  const quotes = [...text.matchAll(/["“]([^"“”]{4,200})["”]/g)].map((m) => normFact(m[1])).filter((q) => q.length >= 4);
  const distinct = [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)+/gu) ?? [])].filter((t) => t.length >= 4 && !names.has(t));
  const content = words(text).filter((w) => !names.has(w) && !SPEECH_STOP.has(w));
  // Exact words first (a quote, "Gabe-o"), then most of the content words in one line (three or more).
  // Within each, oldest first: whoever said it first is its source (the player's line, then the reply echoing it).
  const tests: ((line: SpokenLine) => boolean)[] = [
    (line) => quotes.some((q) => normFact(line.text).includes(q)) || distinct.some((d) => line.text.toLowerCase().includes(d)),
    (line) => {
      if (content.length < 3) return false;
      const LW = new Set(words(line.text));
      return content.filter((w) => LW.has(w)).length / content.length >= 0.75;
    },
  ];
  for (const test of tests) {
    for (const e of recent) {
      for (const line of e.lines) {
        if (line.quiet || !test(line)) continue;
        return { by: speakerOf(ctx, line, e.fromUser ?? false), room: e.msgIndex === ctx.mi ? undefined : e.present.filter((id) => isKnower(ctx.st.chars[id])) };
      }
    }
  }
  return null;
}

const shortHow = (s?: string) => (s ? s.replace(/\s+/g, " ").slice(0, 60) : "");

// Kept to themselves: the model says so in the how or the evidence.
const KEPT = /unspoken|narrator-only|keeps? (?:it )?(?:to (?:her|him|them)sel\w*|secret|quiet|hidden)|has\s*n[o']?t (?:said|told)|hasn['’]t (?:said|told)|won['’]?t (?:say|tell|name)|can['’]?t (?:say|tell)|\bsecret(?:ly)?\b|hiding|conceal|not (?:said|spoken) aloud|kept (?:it )?(?:to|from)/i;

// "has not said "Heaven" aloud", "still hasn't named Willow to Valeria", "never mentioned the letter".
const NOT_SAID = /^(?:[A-Z][\p{L}'’-]+\s+)?(?:still\s+)?(?:has\s*n[o']?t|has\s+not|hasn['’]t|did\s*n[o']?t|didn['’]t|never)\s+(?:yet\s+)?(?:said|named|told|mentioned|confirmed|admitted|revealed|spoken of|brought up|voiced)\s+(?:anyone\s+|them\s+)?(?:about\s+|of\s+|the word\s+)?(.+?)(?:\s+(?:aloud|out loud|to anyone|yet))?(?:\s+to\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)?))?\s*$/u;

/** The holder keeps the fact from these people: they lack it (kept from them) until a route reaches them. */
function keep(ctx: KnowCtx, f: FactState, holder: string, from: string[]) {
  if (!f.keepers?.includes(holder)) f.keepers = [...(f.keepers ?? []), holder];
  for (const p of from) {
    if (standsOn(f.stances[p])) continue;
    setStance(ctx, f, p, { status: "unaware", route: "hidden", how: `${ctx.nm(holder)} keeps it from them` });
    if (!f.keptFrom?.includes(p)) f.keptFrom = [...(f.keptFrom ?? []), p];
  }
}

/** The tracked fact a few words name ("Heaven" → "Buffy was in Heaven"): all the words in it, and the least else. */
function factNamed(ctx: KnowCtx, thing: string, exclude?: string): FactState | undefined {
  const tw = words(thing.replace(/["“”]/g, ""));
  if (!tw.length) return undefined;
  return Object.values(ctx.st.facts ?? {})
    .filter((f) => f.key !== exclude && !f.hidden)
    .filter((f) => {
      const fw = new Set([...words(f.statement), ...f.aliases.flatMap((a) => words(a))]);
      return tw.every((w) => fw.has(w));
    })
    .sort((a, b) => words(a.statement).length - words(b.statement).length)[0];
}

/** "has not named Heaven to Valeria": the holder keeps that fact from Valeria (or from everyone here without it). */
function keepQuiet(ctx: KnowCtx, holder: string, thing: string, to?: string): string | null {
  const f = factNamed(ctx, thing);
  if (!f) return null;
  const toId = to ? ctx.who(to, false) : null;
  const from = toId ? [toId] : ctx.listeners().filter((id) => id !== holder && !standsOn(f.stances[id]));
  setStance(ctx, f, holder, { status: "knows", route: "kept", how: "keeps it to themselves", derived: "secret" });
  keep(ctx, f, holder, from);
  ctx.canon.push(`secret #${f.key}: ${f.statement} | kept by ${ctx.nm(holder)}${from.length ? ` · from ${from.map(ctx.nm).join(", ")}` : ""}`);
  return f.key;
}

/** Someone's gap names this fact: they lack it (the story said so). */
function linkGaps(ctx: KnowCtx, f: FactState) {
  for (const [id, gaps] of Object.entries(ctx.st.gaps ?? {})) {
    if (standsOn(f.stances[id])) continue;
    const hit = gaps.find((g) => gapNames(ctx, g.text, f));
    if (!hit) continue;
    setStance(ctx, f, id, { status: "unaware", route: "stated", how: `doesn't know ${hit.text}` });
    ctx.st.gaps![id] = gaps.filter((g) => g !== hit);
  }
}

/**
 * Does this gap name that fact? All the gap's words are in it, and they make up
 * most of what the fact says beyond names ("Heaven" names "Buffy was in Heaven";
 * "died 5 months ago" does not name "he was Called 5 months ago, a week after her death").
 */
function gapNames(ctx: KnowCtx, gap: string, f: FactState): boolean {
  const g = gapWords(gap);
  if (!g.length || (g.length < 2 && !/[A-Z]/.test(gap))) return false;
  if (!Object.values(f.stances).some((s) => s.status !== "unaware")) return false;
  const names = new Set<string>();
  for (const c of Object.values(ctx.st.chars)) for (const n of [c.name, ...c.aliases]) for (const w of words(n)) names.add(w);
  const fw = [...new Set(words(f.statement))].filter((w) => !names.has(w));
  if (!fw.length || !g.every((w) => fw.includes(w) || names.has(w))) return false;
  return g.filter((w) => fw.includes(w)).length / fw.length >= 0.6 && factNamed(ctx, g.join(" "))?.key === f.key;
}

/** Drop undefined fields (state is stored and compared as JSON). */
function compact<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

/** `know Holder: …` — each item filed under its fact; "does not know …" becomes stances or gaps. */
export function fileKnow(ctx: KnowCtx, holder: string, a: KnowArgs): string[] {
  const keys: string[] = [];
  const nmH = ctx.nm(holder);
  if (a.repaired) ctx.repaired = true;
  const people: string[] = [];
  const gaps: string[] = [];
  for (const n of a.negations ?? []) {
    if (n.startsWith("#")) {
      const k = slugKey(n);
      const f = ctx.st.facts?.[k];
      if (f) {
        setStance(ctx, f, holder, { status: "unaware", route: "stated", how: "the story says they don't know" });
        ctx.canon.push(`unaware ${nmH}: #${f.key}`);
        continue;
      }
    }
    const id = /^[A-Z{]/.test(n) && n.split(/\s+/).length <= 3 ? ctx.who(n, false) : null;
    if (id && id !== holder) people.push(id);
    else gaps.push(n);
  }
  for (const it of a.items ?? []) {
    let stmt = it.statement.trim();
    // "said "I can't go home"", "gave Gabriel a partial truth": the holder's own words or deed.
    if (/^(?:said|asked|told|gave|admitted|confessed|confirmed|accepted|refused|laughed|joked|named|promised|lied|whispered|shouted|attempted|crossed)\b/i.test(stmt)) stmt = `${nmH} ${stmt}`;
    // "has not said Heaven aloud", "still has not named Willow to Valeria": a tracked fact they keep to themselves.
    const notSaid = NOT_SAID.exec(stmt);
    const quietKey = notSaid ? keepQuiet(ctx, holder, notSaid[1], notSaid[2]) : null;
    if (quietKey) {
      keys.push(quietKey);
      continue;
    }
    // Said aloud in the scene? (Asked before filing: a bare quote becomes "Gabriel said "…"".)
    let aloud: { by?: string; room?: string[] } | null = null;
    const how = it.how ?? "";
    const evidence = `${how} ${it.note ?? ""}`;
    let teller: string | null = null;
    let tellTo: { to: string; channel: string } | null = null;
    if ((it.status === "knows" || it.status === "believes") && !PRIVATE.test(how) && !KEPT.test(evidence)) {
      // "Gabriel Winters, aloud": the how opens with who said it.
      const lead = /^([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,2})\s*(?:,|→|->|\baloud\b)/u.exec(how);
      const from0 = (it.from ? ctx.who(it.from, false) : null) ?? sourceIn(ctx, it.note) ?? (lead ? ctx.who(lead[1], false) : null);
      // "Gabriel is a Slayer (heard him say it)": most likely from the person it's about.
      const subj = subjectOf(ctx, stmt);
      const said = how && SPOKEN.test(how) ? from0 ?? (subj && subj !== holder ? subj : null) : from0;
      // Out in the open: the words were spoken this turn, or the line says so ("aloud", "to everyone", "this beat").
      aloud = heardAloud(ctx, `${stmt} ${it.note ?? ""}`);
      if (aloud && from0) aloud.by = from0;
      if (!aloud && how && SPOKEN.test(how) && (PUBLIC_HOW.test(how) || it.now)) aloud = { by: said ?? undefined };
      // "told Giles", "said it to Mara": the holder told them.
      const to = !aloud ? /\b(?:told|tells|tell|said it to|explained it to|confided in|whispered (?:it )?to)\s+([A-Z][\p{L}'’-]+)/u.exec(how) : null;
      const toId = to ? ctx.who(to[1], false) : null;
      if (toId && toId !== holder) tellTo = { to: toId, channel: /whisper|confid/i.test(how) ? "whispered" : "told" };
      // "told · believes" with nothing to place it in the scene: only the teller is known to have it.
      else if (!aloud && said && said !== holder) teller = said;
    }
    // A whole fact in quotes ("Gabriel is the first male Slayer") is the fact; a bare phrase ("Gabe-o") is words said.
    if (/^["“][^"“”]+["”]$/.test(stmt) && stmt.split(/\s+/).length >= 5) stmt = stmt.slice(1, -1).trim();
    else if (/^["“][^"“”]+["”]$/.test(stmt)) stmt = aloud?.by ? `${ctx.nm(aloud.by)} said ${stmt}` : `someone said ${stmt}`;
    const { f, keyed } = resolveFact(ctx, it.key, stmt, holder);
    keys.push(f.key);
    // A different wording marked wrong/false is this holder's own version.
    const differs = !!stmt && sameFact(stmt, f.statement) < 0.5 && !f.aliases.includes(normFact(stmt));
    const falseVersion = differs && (it.status === "wrong" || it.truth === "false");
    if (!falseVersion) takeWording(f, stmt, keyed);
    if (it.truth !== "unknown" && !falseVersion) f.truth = it.truth as KnowTruth;
    const status: KnowStatus = falseVersion && it.status !== "unaware" ? "wrong" : it.status;
    // "Buffy said …", "Gabriel calls himself …": the person whose own words or deed it is said it.
    const actor = status === "knows" || status === "believes" ? actorOf(ctx, stmt) : null;
    if (aloud && actor) aloud.by = actor;
    const from = (it.from ? ctx.who(it.from, false) ?? it.from : undefined) ?? (aloud?.by && aloud.by !== holder ? aloud.by : undefined);
    // Said aloud in the room: they heard it, whatever the line called it ("observed").
    const route = aloud && aloud.by !== holder && (!routeOf(it.how) || routeOf(it.how) === "saw") ? "heard" : undefined;
    setStance(ctx, f, holder, { status, how: it.how, route, from, version: falseVersion ? stmt : undefined }, it.note);
    for (const p of people) setStance(ctx, f, p, { status: "unaware", route: "stated", how: `${nmH}'s line says they don't know` });
    if (status !== "knows" && status !== "believes") aloud = null;
    // "(deduced, unspoken)", "won't say it": they keep it from everyone here who doesn't have it.
    if (!aloud && status !== "unaware" && KEPT.test(evidence)) keep(ctx, f, holder, ctx.listeners().filter((id) => id !== holder && !standsOn(f.stances[id])));
    linkGaps(ctx, f);
    // Said aloud: the speaker has it and everyone in earshot heard it. (The status gate above cleared `aloud` for guesses.)
    if (aloud) comeOut(ctx, f, { by: aloud.by ?? actor ?? undefined, channel: "aloud", named: [], everyone: true, room: aloud.room });
    else if (actor && actor !== holder) setStance(ctx, f, actor, { status: "knows", route: "said", how: "their own words or deed", derived: "source" });
    if (!aloud && teller && isKnower(ctx.st.chars[teller])) setStance(ctx, f, teller, { status: "knows", route: "said", how: `told ${nmH}`, derived: "source" });
    // The holder told someone: they have it now, and whoever else was in the room didn't hear it.
    if (!aloud && tellTo) comeOut(ctx, f, { by: holder, channel: tellTo.channel, named: [tellTo.to], everyone: false });
    // The line as filed.
    if (aloud) ctx.canon.push(`reveal #${f.key}: ${f.statement} | ${aloud.by ?? actor ? `${ctx.nm((aloud.by ?? actor)!)}, ` : ""}aloud`);
    else ctx.canon.push(`know ${nmH}: #${f.key} ${falseVersion ? stmt : f.statement} | ${[shortHow(it.how), status, it.truth !== "unknown" ? it.truth : ""].filter(Boolean).join(" · ")}`);
  }
  for (const g of gaps) addGap(ctx, holder, g);
  if (gaps.length) ctx.canon.push(`unaware ${nmH}: ${gaps.join(" · ")}`);
  for (const p of people) for (const k of keys) ctx.canon.push(`unaware ${ctx.nm(p)}: #${k}`);
  return keys;
}

/** `reveal #key: fact | Source → listeners, how`. */
export function fileReveal(ctx: KnowCtx, a: RevealArgs): string {
  const { f, keyed } = resolveFact(ctx, a.key, a.statement);
  takeWording(f, a.statement, keyed);
  if (a.truth !== "unknown") f.truth = a.truth;
  const by = a.source ? ctx.who(a.source, true) ?? undefined : undefined;
  if (by && ctx.st.chars[by]) ctx.st.chars[by].voiced = true;
  const named: string[] = [];
  for (const n of a.listeners) {
    const id = ctx.who(n, true);
    if (id && id !== by) {
      named.push(id);
      if (ctx.st.chars[id]) ctx.st.chars[id].voiced = true;
    }
  }
  // "Buffy, privately observed": nothing came out to anyone. It's the source's own.
  if (by && !named.length && !a.everyone && !isPublicChannel(a.channel) && !/letter|note|written|wrote|text|message/.test(a.channel)) {
    const how = [a.channel, a.how].filter(Boolean).join(" ");
    setStance(ctx, f, by, { status: "knows", how: how || undefined });
    linkGaps(ctx, f);
    ctx.canon.push(`know ${ctx.nm(by)}: #${f.key} ${f.statement}${how ? ` | ${how}` : ""}`);
    return f.key;
  }
  comeOut(ctx, f, { by, channel: a.channel, named, everyone: a.everyone });
  linkGaps(ctx, f);
  if (a.how && by) {
    const s = f.stances[by];
    if (s && s.derived === "source") s.how = a.how;
  }
  const to = a.everyone || isPublicChannel(a.channel) ? "" : ` → ${named.map(ctx.nm).join(", ")}`;
  ctx.canon.push(`reveal #${f.key}: ${f.statement} | ${by ? ctx.nm(by) : ""}${to}${by || to ? ", " : ""}${a.channel}${f.truth !== "unknown" ? ` · ${f.truth}` : ""}`);
  return f.key;
}

/** `secret #key: fact | kept by A · from B, C`. */
export function fileSecret(ctx: KnowCtx, a: SecretArgs): string {
  const { f, keyed } = resolveFact(ctx, a.key, a.statement);
  takeWording(f, a.statement, keyed);
  if (a.truth !== "unknown") f.truth = a.truth;
  const keepers = a.keepers.map((n) => ctx.who(n, true)).filter(Boolean) as string[];
  const from = a.from.map((n) => ctx.who(n, false)).filter(Boolean) as string[];
  const others = a.from.filter((n) => !ctx.who(n, false));
  for (const k of keepers) {
    if (ctx.st.chars[k]) ctx.st.chars[k].voiced = true;
    setStance(ctx, f, k, { status: "knows", route: "kept", how: "keeps it", derived: "secret" });
    if (!f.keepers?.includes(k)) f.keepers = [...(f.keepers ?? []), k];
  }
  for (const p of from) {
    if (keepers.includes(p)) continue;
    setStance(ctx, f, p, { status: "unaware", route: "hidden", how: "kept from them" }, others.length ? `also kept from ${others.join(", ")}` : undefined);
    if (!f.keptFrom?.includes(p)) f.keptFrom = [...(f.keptFrom ?? []), p];
  }
  if (!from.length && others.length) f.history.push({ holder: keepers[0] ?? "", status: "knows", route: "kept", note: `kept from ${others.join(", ")}`, msgIndex: ctx.mi, at: ctx.at });
  f.lastMsg = Math.max(f.lastMsg, ctx.mi);
  linkGaps(ctx, f);
  ctx.canon.push(`secret #${f.key}: ${f.statement} | ${keepers.length ? `kept by ${keepers.map(ctx.nm).join(", ")}` : ""}${keepers.length && a.from.length ? " · " : ""}${a.from.length ? `from ${[...from.map(ctx.nm), ...others].join(", ")}` : ""}`);
  return f.key;
}

/** `unaware Name: thing · thing` — a tracked fact they lack, or a gap in words. */
export function fileUnaware(ctx: KnowCtx, holder: string, things: string[]): void {
  const gaps: string[] = [];
  const keyed: string[] = [];
  const facts = ctx.st.facts ?? {};
  for (const t of things) {
    // "#heaven", or "#heaven Buffy was in Heaven": the key, and the words if it isn't tracked.
    const km = /^#([\p{L}\p{N}_-]+)\s*(.*)$/u.exec(t);
    const text = km ? km[2].trim() : t;
    let k: string | undefined;
    if (km) {
      const s = slugKey(km[1]);
      k = facts[s] ? s : Object.values(facts).find((f) => f.altKeys?.includes(s))?.key;
    }
    k ??= text ? findFact(facts, text) : undefined;
    const f = k ? facts[k] : undefined;
    if (f) {
      if (!standsOn(f.stances[holder]) || f.stances[holder].derived) setStance(ctx, f, holder, { status: "unaware", route: "stated", how: "the story says they don't know" });
      keyed.push(`#${f.key}`);
    } else if (text) gaps.push(text);
  }
  for (const g of gaps) addGap(ctx, holder, g);
  ctx.canon.push(`unaware ${ctx.nm(holder)}: ${[...keyed, ...gaps].join(" · ")}`);
}

/**
 * The player's say: facts they added, and where they put people. Applied after every
 * message, so it holds whatever the story writes later.
 */
export function applyFactEdits(st: WorldState, mi: number, edits: Record<string, FactEdit>): void {
  for (const [key, e] of Object.entries(edits)) {
    if (e.into || (!e.people && e.added === undefined)) continue;
    const facts = (st.facts ??= {});
    let f = facts[key] ?? Object.values(facts).find((x) => x.altKeys?.includes(key));
    if (!f && e.added !== undefined && mi >= e.added) {
      f = facts[key] = { key, statement: e.statement || key.replace(/-/g, " "), truth: e.truth ?? "unknown", aliases: [normFact(e.statement || key)], stances: {}, history: [], firstMsg: mi, lastMsg: mi, added: true, locked: true };
    }
    if (!f) continue;
    if (e.statement) {
      f.statement = e.statement;
      f.locked = true;
    }
    if (e.truth) f.truth = e.truth;
    if (e.hidden) f.hidden = true;
    for (const [id, want] of Object.entries(e.people ?? {})) {
      if (!st.chars[id]) continue;
      const cur = f.stances[id];
      if (want === "none") {
        if (cur) delete f.stances[id];
        if (f.keptFrom?.includes(id)) f.keptFrom = f.keptFrom.filter((x) => x !== id);
        if (!f.cleared?.includes(id)) f.cleared = [...(f.cleared ?? []), id];
        continue;
      }
      if (cur?.set && cur.status === want) continue;
      const route: KnowRoute | undefined = want === "unaware" ? "stated" : cur?.route;
      f.stances[id] = compact({ holder: id, status: want, how: "you set this", route, from: want === "unaware" ? undefined : cur?.from, set: true, msgIndex: cur?.msgIndex ?? mi, at: cur?.at ?? (st.time ? { ...st.time } : null) });
      f.history.push(compact({ holder: id, status: want, how: "you set this", route, msgIndex: mi, at: st.time ? { ...st.time } : null }));
      if (want !== "unaware") {
        if (f.keptFrom?.includes(id)) f.keptFrom = f.keptFrom.filter((x) => x !== id);
        if (want !== "wrong") closeGaps(st, id, f);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Gaps: what someone doesn't know, in words
// ---------------------------------------------------------------------------

const WH = new Set("who whom whose what which why how when where whether if".split(" "));
const gapWords = (s: string) => words(s).filter((w) => !WH.has(w));

function addGap(ctx: KnowCtx, holder: string, raw: string) {
  // "own scrape (clinical)", "for certain — she hasn't confirmed it": keep the thing itself.
  const text = raw.replace(/\s*\([^)]*\)/g, "").replace(/\s[—–]\s.*$|\s--\s.*$/, "").replace(/^(?:for certain|for sure|yet|exactly|specifically)\b\s*/i, "").replace(/[\s.;:,]+$/, "").trim().slice(0, 90);
  if (gapWords(text).length < 2 && !/[A-Z]/.test(text) && text.split(/\s+/).length < 2) return;
  const gaps = ((ctx.st.gaps ??= {})[holder] ??= []);
  // Already knows it? Then it isn't a gap.
  const known = Object.values(ctx.st.facts ?? {}).some((f) => hasIt(f.stances[holder]) && closes(text, f));
  if (known) return;
  // It names a fact someone else has ("Heaven" → "Buffy was in Heaven"): they lack that fact.
  const named = factNamed(ctx, gapWords(text).join(" "));
  if (named && !standsOn(named.stances[holder]) && gapNames(ctx, text, named)) {
    setStance(ctx, named, holder, { status: "unaware", route: "stated", how: `doesn't know ${text}` });
    return;
  }
  const same = gaps.find((g) => sameFact(g.text, text) >= 0.6 || normFact(g.text) === normFact(text));
  if (same) same.lastMsg = ctx.mi;
  else gaps.push({ text, since: ctx.mi, lastMsg: ctx.mi });
  if (gaps.length > 16) gaps.splice(0, gaps.length - 16);
}

/** Does learning this fact close the gap? Most of the gap's own words appear in it. */
function closes(gap: string, f: FactState): boolean {
  const g = gapWords(gap);
  if (!g.length) return false;
  const fw = new Set([...words(f.statement), ...f.aliases.flatMap((a) => a.split(" "))]);
  const hit = g.filter((w) => fw.has(w)).length;
  return hit >= Math.min(2, g.length) && hit / g.length >= 0.6;
}

/** Gaps that only name people ("Walter/Valeria/Ruth") close once the holder has been in a room with all of them. */
export function closeMetGaps(st: WorldState): void {
  const byName = new Map<string, CharacterState>();
  for (const c of Object.values(st.chars)) for (const n of [c.name, ...c.aliases, c.name.split(/\s+/)[0]]) byName.set(n.toLowerCase(), c);
  for (const [id, gaps] of Object.entries(st.gaps ?? {})) {
    const me = st.chars[id];
    if (!me || !isHere(me)) continue;
    st.gaps![id] = gaps.filter((g) => {
      const parts = g.text.replace(/^(?:about|who)\s+/i, "").split(/\s*(?:\/|,|&|\band\b|\bor\b)\s*/).map((p) => p.trim().toLowerCase()).filter(Boolean);
      const people = parts.map((p) => byName.get(p));
      if (!parts.length || people.some((c) => !c)) return true;
      return !people.every((c) => isHere(c!));
    });
  }
}

function closeGaps(st: WorldState, holder: string, f: FactState) {
  const gaps = st.gaps?.[holder];
  if (!gaps?.length) return;
  st.gaps![holder] = gaps.filter((g) => !closes(g.text, f));
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type LackReason = "hidden" | "missed" | "unheard" | "stated";

/**
 * Does this person lack the fact, with evidence? Kept from them, not there when
 * it came out (while already in the story), out of earshot of a private telling,
 * or the story said so. No record is not ignorance: null.
 */
export function lackOf(st: WorldState, f: FactState, id: string): LackReason | null {
  const s = f.stances[id];
  if (s) return s.status === "unaware" ? (s.route === "hidden" ? "hidden" : s.route === "missed" ? "missed" : "stated") : null;
  if (f.keptFrom?.includes(id)) return "hidden";
  const c = st.chars[id];
  if (!f.out?.length || !isKnower(c) || f.cleared?.includes(id)) return null;
  const first = f.out[0].msgIndex;
  // Someone new to the story may have known it all along — unless they walked into the
  // very scene where it came out, after it did (an arrival hears nothing said before).
  if (c.firstSeen >= first && sceneOf(st, c.firstSeen) !== sceneOf(st, first)) return null;
  if (f.out.some((o) => (o as any).room?.includes(id))) return "unheard";
  // Not there when it came out only means something if it was news then. Gabriel telling
  // Buffy he's a Slayer says nothing about whether Walter, his Watcher, knows.
  return isNews(f) ? "missed" : null;
}

const FOUND: KnowRoute[] = ["deduced", "sensed", "saw", "read", "overheard", "heard", "told", "rumour"];

/**
 * Was the fact news when it first came out? Its teller found it out in the story first
 * (read it off the stone, worked it out, was told), or it is something that happened in
 * the story (an offer, a joke, a fight). Something the teller simply already knew (who
 * they are, their cat's name) may be known to anyone who wasn't there.
 */
export function isNews(f: FactState): boolean {
  const out = f.out?.[0];
  if (!out) return false;
  if (f.history.some((h) => (!out.by || h.holder === out.by) && h.msgIndex <= out.msgIndex && !h.derived && h.route && FOUND.includes(h.route) && h.status !== "unaware")) return true;
  return DEED.test(f.statement);
}

// A statement that is something happening in the story, not a standing fact.
const DEED = /\b(?:said|told|asked|offered|admitted|confessed|refused|joked|made a joke|laughed|promised|lied|whispered|shouted|agreed|accepted|kissed|hugged|killed|fought|attacked|saved|pulled|dug|arrived|left|cried|wept|broke down|slapped|chose|decided|threatened|begged|swore|called (?:him|her|them)sel(?:f|ves))\b/i;

function sceneOf(st: WorldState, mi: number): number {
  let no = 0;
  for (const s of st.sceneLog) {
    if (s.startMsg > mi) break;
    no = s.no;
  }
  return no;
}

export function lackText(r: LackReason): string {
  return r === "hidden" ? "doesn't know (kept from them)" : r === "missed" ? "wasn't there when it came out" : r === "unheard" ? "didn't hear it (told privately)" : "doesn't know";
}

export type FactKind = "secret" | "belief" | "shared" | "noted";

export function factKind(f: FactState): FactKind {
  const ss = Object.values(f.stances);
  const someone = ss.some((s) => s.status !== "unaware");
  if (someone && ((f.keptFrom?.length ?? 0) > 0 || (f.keepers?.length ?? 0) > 0 || ss.some((s) => s.status === "unaware"))) return "secret";
  if (ss.some((s) => s.status === "believes" || s.status === "suspects" || s.status === "doubts" || s.status === "wrong") || f.truth === "false" || f.truth === "partial") return "belief";
  if (ss.filter((s) => s.status === "knows").length >= 2) return "shared";
  return "noted";
}

/**
 * How much of a wording is being talked about: the share of its own words (not
 * names) found in the talk. Measured on the fact's side, so a short fact inside a
 * long reply doesn't count as "talked about" just by being in it.
 */
export function talkOf(st: WorldState, text: string, talk: string): number {
  if (!talk) return 0;
  // Its own distinctive words said again ("Gabe-o", a quoted phrase): it's the topic.
  const low = talk.toLowerCase();
  const marks = [...(text.toLowerCase().match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)+/gu) ?? []), ...[...text.matchAll(/["“]([^"“”]{4,80})["”]/g)].map((m) => m[1].toLowerCase())];
  if (marks.some((m) => m.length >= 4 && low.includes(m))) return 1;
  const names = new Set<string>();
  for (const c of Object.values(st.chars)) for (const n of [c.name, ...c.aliases]) for (const w of words(n)) names.add(w);
  const fw = [...new Set(words(text))].filter((w) => !names.has(w) && !WH.has(w));
  if (fw.length < 2) return 0;
  const tw = new Set(words(talk));
  return fw.filter((w) => tw.has(w)).length / fw.length;
}

/**
 * Facts in play for the note and the drawer, ranked by how much a slip would cost.
 * `focus` is what's being said now (the player's message); `query` adds the last reply.
 * A passing observation (one person, no one known to lack it) never goes in: it
 * guards nothing. Something everyone here shares goes in only when the talk turns to
 * it, as a "don't explain it again".
 */
export function factsInPlay(st: WorldState, query: string, limit = 5, focus = ""): FactState[] {
  const here = peopleHere(st);
  const hereSet = new Set(here);
  return Object.values(st.facts ?? {})
    .filter((f) => !f.hidden)
    .map((f) => {
      const texts = [f.statement, ...f.aliases];
      const talkNow = Math.max(...texts.map((t) => talkOf(st, t, focus)));
      const talkAny = Math.max(talkNow, ...texts.map((t) => talkOf(st, t, query)));
      const has = here.filter((id) => standsOn(f.stances[id]));
      const lacks = here.filter((id) => lackOf(st, f, id));
      const wrong = here.some((id) => f.stances[id]?.status === "wrong" || (f.truth === "false" && ["believes", "suspects"].includes(f.stances[id]?.status ?? "")));
      const kind = factKind(f);
      const keeperHere = (f.keepers ?? []).some((k) => hereSet.has(k));
      if (!has.length && !lacks.length && !keeperHere) return { f, score: 0 };
      if (kind === "noted") return { f, score: 0 };
      const recent = st.msgCount - f.lastMsg <= 8;
      let score = 0;
      if (has.length && lacks.length) score += 3;
      if (wrong) score += 3;
      if (kind === "secret" && keeperHere) score += 1;
      if (kind === "belief" && has.length) score += 1;
      if (talkNow >= 0.6) score += 3 + talkNow;
      else if (talkAny >= 0.75) score += 1 + talkAny;
      if (recent) score += 0.5 + f.lastMsg / Math.max(1, st.msgCount);
      // Everyone here shares it: only worth a "don't explain it again" when the player brings it up.
      if (kind === "shared" && !lacks.length && talkNow < 0.6) score = 0;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}

/**
 * Gaps worth showing in the note: the ones the talk touches (at most two a person).
 * A gap no one is talking about is on the Knowledge page, not in the model's way.
 */
export function gapsOf(st: WorldState, id: string, query = "", window = 40, max = 2): KnowGap[] {
  return (st.gaps?.[id] ?? [])
    .filter((g) => st.msgCount - g.lastMsg <= window)
    .map((g) => ({ g, s: talkOf(st, g.text, query) }))
    .filter((x) => x.s >= 0.6)
    .sort((a, b) => b.s - a.s || b.g.lastMsg - a.g.lastMsg)
    .slice(0, max)
    .map((x) => x.g);
}

export const storyStamp = (at: StoryTime | null): string => (at ? `Day ${at.day} ${String(Math.floor(at.minute / 60)).padStart(2, "0")}:${String(at.minute % 60).padStart(2, "0")}` : "");

export type { KnowItem };
