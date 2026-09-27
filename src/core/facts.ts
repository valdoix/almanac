// Facts: knowledge compiled into one statement per fact ("Buffy was in Heaven"),
// with where each person stands on it and how it came out, in story order.
//
// The model writes `know Holder: #key Statement | how · status · truth`. The #key
// ties lines about the same fact together (the note shows the keys in play); a
// line without one is matched to an existing fact by wording, else starts a new
// one. Evidence, parentheticals and "DOES NOT KNOW: …" tails are lifted out of the
// statement into the history, so the statement stays the fact itself.

import type { CharacterState, FactEdit, FactState, KnowRow, KnowStatus, KnowTruth, WorldState } from "./types";
import type { StoryTime } from "./util";
import { normFact, overlap } from "./state";

const STOP = new Set("the a an of to in on at is was be and or for with by from that this it its his her their he she they".split(" "));

/** Pull the key, the evidence and any "does not know" tail out of a written fact. */
export function splitFact(raw: string): { statement: string; key?: string; note?: string; unawareOf?: string[] } {
  let text = raw;
  let key: string | undefined;
  const km = /(?:^|\s)#([\p{L}\p{N}_-]{2,40})/u.exec(text);
  if (km) {
    key = km[1].toLowerCase();
    text = text.replace(km[0], " ");
  }
  const notes: string[] = [];
  let unawareOf: string[] | undefined;
  const dnk = /\b(?:DOES NOT KNOW|DOESN'?T KNOW|doesn't know yet|not yet known)\b\s*:?\s*/i.exec(text);
  if (dnk) {
    unawareOf = text.slice(dnk.index + dnk[0].length).split(/\s*[,;]\s*/).map((s) => s.replace(/[.\s]+$/, "").trim()).filter(Boolean);
    text = text.slice(0, dnk.index);
  }
  text = text.replace(/\(([^()]*)\)/g, (_, x: string) => {
    if (x.trim()) notes.push(x.trim());
    return " ";
  });
  const dash = /\s[—–]\s|\s--\s/.exec(text);
  if (dash) {
    const tail = text.slice(dash.index + dash[0].length).trim();
    if (tail) notes.unshift(tail);
    text = text.slice(0, dash.index);
  }
  const statement = text.replace(/\s+/g, " ").replace(/^[\s.;:,]+|[\s.;:,]+$/g, "").trim();
  const note = notes.map((n) => n.replace(/\s+/g, " ").replace(/^[\s.;:,]+|[\s.;:,]+$/g, "")).filter(Boolean).join("; ") || undefined;
  return { statement, key, note, unawareOf };
}

const slugKey = (s: string) => s.toLowerCase().replace(/^#/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function contentWords(s: string): string[] {
  return normFact(s).split(" ").filter((w) => w && !STOP.has(w));
}

/** A key for a new fact: its first few content words. */
function newKey(facts: Record<string, FactState>, statement: string): string {
  const base = slugKey(contentWords(statement).slice(0, 3).join("-")) || "fact";
  let k = base;
  for (let i = 2; facts[k]; i++) k = `${base}-${i}`;
  return k;
}

/** An existing fact the wording belongs to, if any. */
export function findFact(facts: Record<string, FactState>, statement: string): string | undefined {
  const n = normFact(statement);
  if (contentWords(n).length < 2) return undefined;
  let best: { key: string; s: number } | undefined;
  for (const f of Object.values(facts)) {
    const s = Math.max(overlap(n, normFact(f.statement)), ...f.aliases.map((a) => overlap(n, a)));
    if (s >= 0.6 && (!best || s > best.s)) best = { key: f.key, s };
  }
  return best?.key;
}

// Words that describe how someone came to know, rather than the fact itself.
const EVIDENCE = /\b(confirm|because|silence|observ|deduc|guess|noticed|said it|told (him|her|them)|didn't correct|from her|from his|from their|this beat)/i;

/** Is `a` a cleaner statement of the fact than `b`? Plain and short wins. */
function cleaner(a: string, b: string): boolean {
  const wa = contentWords(a).length;
  const wb = contentWords(b).length;
  if (wa < 2) return false;
  const ea = EVIDENCE.test(a);
  const eb = EVIDENCE.test(b);
  if (ea !== eb) return !ea;
  return wa < wb;
}

// How someone came to it, from the words of the source.
const HOW: [RegExp, string][] = [
  [/deduc|infer|worked (it )?out|figured|pieced|reason|put (it )?together/i, "deduced it"],
  [/overheard|eavesdrop/i, "overheard it"],
  [/was there when it was said/i, "was there when it was said"],
  [/\bread\b|letter|\bnote\b|diary|journal|document/i, "read it"],
  [/confirm/i, "confirmed it"],
  [/\btold\b|\bsaid\b|confess|admit|reveal|explain|announc/i, "was told"],
  [/\bsaw\b|watch|witness|observ|noticed|direct observation|seen/i, "saw it"],
  [/guess|hunch|intuit|sens|felt|instinct/i, "sensed it"],
  [/lived|experienc|remember|always knew|own secret|was there/i, "lived it"],
];

/** "deduced it", "was told", "suspects it"… for the history and the note. */
export function howVerb(status: KnowStatus, how?: string): string {
  if (status === "wrong") return "believes otherwise";
  if (status === "unaware") return "doesn't know";
  if (status === "doubts") return "doubts it";
  if (status === "suspects") return "suspects it";
  for (const [re, v] of HOW) if (how && re.test(how)) return status === "believes" ? `believes it (${v.replace(/ it$/, "")})` : v;
  return status === "believes" ? "believes it" : "learned it";
}

const SPOKEN = /\bsaid\b|\bsays\b|\btold\b|\btells\b|announc|reveal|confess|admit|declar|shout|explain|stated|mention|\basked\b|aloud|out loud|in front of|to everyone|to the room|\bheard\b|\bspoke\b/i;
const PRIVATE = /whisper|private|in secret|secretly|\balone\b|aside|letter|\bnote\b|message|text(ed)?\b|thought|dream|vision|\bread\b|overheard|eavesdrop|spied|diary|journal|confided|under (her|his|their) breath/i;

// The persona is in the scene unless a cast line sent them off.
const present = (c: CharacterState) => (c.tier === "spot" || c.tier === "peri" || (c.isUser && c.tier !== "off")) && !c.dead;

/**
 * File one `know` line under its fact. Returns the fact key. Mutates `st.facts`.
 * `args.key` and `args.note` come from splitFact; `row.fact` is the cleaned statement.
 */
export function fileKnow(st: WorldState, row: KnowRow, args: { key?: string; note?: string; unawareOf?: string[] }, edits: Record<string, FactEdit> = {}): string {
  const facts = (st.facts ??= {});
  const stmt = row.fact.trim();
  let key: string | undefined;
  if (args.key) {
    const k = slugKey(args.key);
    // A key seen before (as a key or an alternate); a new key for a fact already filed by wording joins it.
    key = facts[k] ? k : Object.values(facts).find((f) => f.altKeys?.includes(k))?.key;
    if (!key) {
      // A fact filed under an automatic key takes the model's key the first time it gives one.
      const same = stmt ? findFact(facts, stmt) : undefined;
      if (same && facts[same].autoKey && !edits[same]) {
        const f = facts[same];
        delete facts[same];
        facts[k] = { ...f, key: k, autoKey: false, altKeys: [...(f.altKeys ?? []), same] };
        for (const r of st.knowledge) if (r.factKey === same) r.factKey = k;
      }
      key = k;
    }
  } else key = stmt ? findFact(facts, stmt) : undefined;
  let auto = false;
  if (!key) {
    key = newKey(facts, stmt || "fact");
    auto = true;
  }
  for (let i = 0; i < 6 && edits[key]?.into; i++) key = slugKey(edits[key].into!);
  let f = facts[key];
  if (!f) {
    f = facts[key] = { key, statement: stmt || key.replace(/-/g, " "), truth: "unknown", aliases: [], stances: {}, history: [], firstMsg: row.msgIndex, lastMsg: row.msgIndex, ...(auto ? { autoKey: true } : {}) };
  }
  // A row whose wording differs from the fact and is marked wrong/false is that holder's own version.
  const differs = !!stmt && overlap(normFact(stmt), normFact(f.statement)) < 0.6 && !f.aliases.includes(normFact(stmt));
  const falseVersion = differs && (row.status === "wrong" || row.truth === "false");
  if (stmt && !falseVersion) {
    const n = normFact(stmt);
    if (!f.aliases.includes(n)) f.aliases = [...f.aliases, n].slice(-12);
    if (!f.locked && cleaner(stmt, f.statement)) f.statement = stmt;
  }
  if (row.truth !== "unknown" && !falseVersion) f.truth = row.truth as KnowTruth;
  const version = falseVersion ? stmt : undefined;
  const status: KnowStatus = falseVersion && row.status !== "unaware" ? "wrong" : row.status;
  f.stances[row.holder] = { holder: row.holder, status, how: row.source, version, msgIndex: row.msgIndex, at: row.at };
  const note = [args.note, args.unawareOf?.length ? `still doesn't know: ${args.unawareOf.join(", ")}` : ""].filter(Boolean).join("; ") || undefined;
  f.history.push({ holder: row.holder, status, how: row.source, version, note, msgIndex: row.msgIndex, at: row.at });
  f.lastMsg = Math.max(f.lastMsg, row.msgIndex);
  // Said aloud in the scene: everyone present heard it, unless they already stand somewhere on it.
  if (status === "knows" && row.source && SPOKEN.test(row.source) && !PRIVATE.test(row.source)) {
    for (const c of Object.values(st.chars)) {
      if (c.id === row.holder || !present(c) || f.stances[c.id]) continue;
      f.stances[c.id] = { holder: c.id, status: "knows", how: "was there when it was said", derived: true, msgIndex: row.msgIndex, at: row.at };
      f.history.push({ holder: c.id, status: "knows", how: "was there when it was said", derived: true, msgIndex: row.msgIndex, at: row.at });
    }
  }
  const e = edits[key];
  if (e?.statement) {
    f.statement = e.statement;
    f.locked = true;
  }
  if (e?.truth) f.truth = e.truth;
  if (e?.hidden) f.hidden = true;
  return key;
}

/** Facts in play for the note: touched recently by someone here, or matching what is being talked about. */
export function factsInPlay(st: WorldState, query: string, limit = 4): FactState[] {
  const q = normFact(query);
  const here = new Set(Object.values(st.chars).filter(present).map((c) => c.id));
  here.add("user");
  return Object.values(st.facts ?? {})
    .filter((f) => !f.hidden)
    .map((f) => {
      const talk = Math.max(overlap(q, normFact(f.statement)), ...f.aliases.map((a) => overlap(q, a)));
      const recent = st.msgCount - f.lastMsg <= 8 && Object.keys(f.stances).some((h) => here.has(h));
      return { f, score: (talk >= 0.34 ? 2 + talk : 0) + (recent ? 1 + (f.lastMsg / Math.max(1, st.msgCount)) : 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}

/** People it would matter that they don't know: here now, or seen lately, with no stance on it. */
export function unawareOf(st: WorldState, f: FactState, window = 20): string[] {
  return Object.values(st.chars)
    .filter((c) => !c.dead && !f.stances[c.id] && (present(c) || c.isUser || st.msgCount - c.lastSeen <= window))
    .map((c) => c.id);
}

export const storyStamp = (at: StoryTime | null): string => (at ? `Day ${at.day} ${String(Math.floor(at.minute / 60)).padStart(2, "0")}:${String(at.minute % 60).padStart(2, "0")}` : "");
