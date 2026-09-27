// Knowledge lines, read tolerantly. Models write `know` as a diary ("saw his abs;
// heard the offer — all this beat"), bundle several facts on one line, and tuck
// what someone *doesn't* know into a "DOES NOT KNOW: …" tail. This module turns
// any of that into clean items: one fact each, with its route, plus the gaps.
//
//   know Name: #key fact | how · status · truth
//   reveal #key: fact | Source → listeners, how · truth
//   secret #key: fact | kept by A · from B, C
//   unaware Name: thing · thing

import type { KnowStatus, KnowTruth } from "./types";

export interface KnowItem {
  statement: string;
  key?: string;
  status: KnowStatus;
  truth: KnowTruth;
  /** How they came to it, as written. */
  how?: string;
  /** Who it came from, as written ("Valeria", "the letter"). */
  from?: string;
  /** Evidence and asides lifted out of the statement. */
  note?: string;
  /** The line says it happened in the scene just now ("this beat", "direct"). */
  now?: boolean;
}

export interface KnowArgs {
  items: KnowItem[];
  /** What the holder doesn't know, as written: things, or people (resolved by the engine). */
  negations: string[];
  /** The line needed repair: bundled items, a "does not know" tail, diary noise, a perception verb. */
  repaired: boolean;
  // The first item, for callers that read a single fact.
  fact: string;
  key?: string;
  status: KnowStatus;
  truth: KnowTruth;
  source?: string;
}

const STATUSES: KnowStatus[] = ["knows", "believes", "suspects", "wrong", "unaware", "doubts"];

export function normStatus(w: string): KnowStatus {
  const st = w.toLowerCase().replace(/s$/, "").replace(/^know$/, "knows").replace(/^believe$/, "believes").replace(/^suspect$/, "suspects").replace(/^doubt$/, "doubts").replace(/^denie$/, "doubts");
  return (STATUSES as string[]).includes(st) ? (st as KnowStatus) : "believes";
}

const STATUS_WORD = /^(knows?|believes?|suspects?|wrong|unaware|doubts?|denies)$/i;
const TRUTH_WORD = /^(true|false|partial|unknown|half-true|mixed|partly true)$/i;
const normTruth = (b: string): KnowTruth => (/half|mixed|partly|partial/i.test(b) ? "partial" : (b.toLowerCase() as KnowTruth));

// "does NOT know", "doesn't know yet", "unaware of", "hasn't been told"…
const NEG = /\b(?:still\s+)?(?:does\s*n[o']?t\s+(?:yet\s+)?know|doesn['’]?t\s+(?:yet\s+)?know|did\s*n[o']?t\s+know|not\s+yet\s+known(?:\s+to\s+(?:her|him|them))?|unaware\s+(?:of|that)|has\s*n[o']?t\s+(?:yet\s+)?been\s+told|hasn['’]t\s+(?:yet\s+)?been\s+told|has\s+no\s+idea|no\s+idea)\b\s*(?:yet\b)?\s*:?\s*/gi;

// Words that only describe the moment of writing, never the fact.
const NOISE_PAREN = /^(?:(?:all\s+)?this\s+beat|this\s+turn|per\s+existing\s+record|no\s+new\s+info(?:rmation)?|no\s+change|unchanged|same\s+as\s+before|cumulative|new|again|still)$/i;
const NOISE_TAIL = /\s*(?:[—–-]{1,2}\s*)?\b(?:all\s+)?this\s+beat\b(?:\s*\([^)]*\))?\s*\.?\s*$/i;
const BEAT = /\s*\b(?:all\s+)?this\s+(?:beat|turn)\b\s*/gi;

// A parenthetical that says how they came to it, not what it is.
export const ROUTE_HINT = /\b(heard|hear|told|tell|said|say|saw|seen|observ\w*|direct\w*|sensory|sens(?:ed|es|ing)|deduc\w*|infer\w*|guess\w*|confirm\w*|read|overheard|lived|recogni\w*|shown|physical\w*|clinical\w*|professional\w*|ooc|narrator\w*|unspoken|privat\w*|self-knowledge|witness\w*|notic\w*|felt|smell\w*|touch\w*|palpable|assessment|speech|voice|from|via|rumou?r\w*|gossip\w*|lived it|experienced)\b/i;

// The item opens with how they came to it: "saw his abs", "heard the offer", "deduced she was in Heaven".
const LEAD_PERCEPTION = /^(?:(?:she|he|they)\s+)?(saw|heard|noticed|observed|overheard|watched|felt|smelled|sensed|read|learned|learnt|was told|were told|got told|found out|realized|realised|recognized|recognised|deduced|inferred|guessed|figured out|worked out|pieced together)\s+(?:that\s+|how\s+)?(.+)$/i;
const LEAD_STANCE = /^(?:still\s+)?(knows?|believes?|suspects?|doubts?)\s+(?:that\s+)?(.+)$/i;
const BARE_NAME = /^(?:\{\{user\}\}|[A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,2})$/u;

/** Split on a separator at the top level: not inside (), [], or quotes. */
export function splitTop(s: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if ((quote === '"' && ch === '"') || (quote === "“" && ch === "”")) quote = "";
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "“") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "(" || ch === "[") depth++;
    if ((ch === ")" || ch === "]") && depth > 0) depth--;
    if (depth === 0) {
      sep.lastIndex = 0;
      const m = sep.exec(s.slice(i));
      if (m && m.index === 0) {
        out.push(cur);
        cur = "";
        i += m[0].length - 1;
        continue;
      }
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s.;:,·—–-]+|[\s.;:,·—–-]+$/g, "").trim();

/** Pull every "does not know …" run out of the text: the rest, and the things listed. */
export function pullNegations(text: string): { rest: string; negations: string[] } {
  const negations: string[] = [];
  const hits: { start: number; end: number }[] = [];
  NEG.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NEG.exec(text))) hits.push({ start: m.index, end: m.index + m[0].length });
  if (!hits.length) return { rest: text, negations };
  let rest = "";
  let last = 0;
  for (let h = 0; h < hits.length; h++) {
    const { start, end } = hits[h];
    // "Gabriel unaware of his scrape" on Valeria's line is something she knows about him, not her gap.
    if (/\b[A-Z][\p{L}'’-]+\s+(?:is\s+|remains\s+|still\s+|was\s+)?$/u.test(text.slice(last, start)) && !/\b(?:DOES|DOESN)/.test(text.slice(start, end))) continue;
    // The run ends at the next negation, or the next top-level break (· | ;).
    const nextNeg = h + 1 < hits.length ? hits[h + 1].start : text.length;
    let stop = nextNeg;
    const brk = /\s[·•|]\s|;\s|\s\|\s?/g;
    brk.lastIndex = end;
    const b = brk.exec(text);
    if (b && b.index < stop) stop = b.index;
    // Drop a lead-in ("· does NOT know", ", does not know", "— still").
    let head = text.slice(last, start);
    head = head.replace(/(?:[\s,;·•—–-]|\bbut\b|\band\b|\bstill\b|\bshe\b|\bhe\b|\bthey\b)*$/i, "");
    rest += head;
    const run = text.slice(end, stop);
    for (const part of splitTop(run, /,\s*(?:or\s+|and\s+)?|\s+or\s+|\s+nor\s+/g)) {
      const p = clean(part.replace(/^(?:that|who|what|about|of|the fact that)\s+(?=\S)/i, (w) => (/^(who|what)/i.test(w) ? w : "")));
      if (p && !/^(yet|either|why|how|what|who|when|where|any of (?:this|it))$/i.test(p)) negations.push(p);
    }
    last = stop;
  }
  rest += text.slice(last);
  return { rest, negations };
}

/** One item: its key, statement, route words, status lead-in and evidence. */
export function readItem(raw: string): { item: Omit<KnowItem, "status" | "truth"> & { status?: KnowStatus }; noisy: boolean; perception: boolean } | null {
  let text = raw.trim();
  let noisy = false;
  if (/^cumulative\s*:/i.test(text)) return null;
  const now = /\bthis\s+(?:beat|turn)\b|\bdirect(?:ly)?\b|\bjust now\b/i.test(text);
  // "… — this beat (direct observation). Cumulative: glasses, contacts, …" restates old lines.
  const cum = /[.;,]?\s*\bcumulative\s*:/i.exec(text);
  if (cum) {
    text = text.slice(0, cum.index);
    noisy = true;
  }
  let key: string | undefined;
  const km = /(?:^|\s)#([\p{L}\p{N}_-]{2,40})/u.exec(text);
  if (km) {
    key = km[1].toLowerCase();
    text = text.replace(km[0], " ").trim();
  }
  const hows: string[] = [];
  const notes: string[] = [];
  let from: string | undefined;
  // Parentheticals: route words become the how, noise goes, the rest stays in the fact.
  text = text.replace(/\s*\(([^()]*)\)/g, (all, x: string) => {
    const t = x.trim();
    if (!t) return "";
    const parts = t.split(/\s*[,;]\s*/).filter(Boolean);
    const kept = parts.map((p) => p.replace(BEAT, "").trim()).filter((p) => p && !NOISE_PAREN.test(p));
    if (kept.length < parts.length || parts.some((p) => /\bthis\s+(?:beat|turn)\b/i.test(p))) noisy = true;
    if (!kept.length) return "";
    const joined = kept.join(", ");
    if (ROUTE_HINT.test(joined) && joined.length <= 80) {
      hows.push(joined);
      return "";
    }
    return all.replace(x, joined);
  });
  const before = text;
  text = text.replace(NOISE_TAIL, "");
  if (text !== before) noisy = true;
  // " — evidence" after the fact: kept as a note (it often describes someone else: "— he guessed it").
  const dash = /\s[—–]\s|\s--\s/.exec(text);
  if (dash) {
    const tail = clean(text.slice(dash.index + dash[0].length));
    if (tail) notes.push(tail);
    text = text.slice(0, dash.index);
  }
  // "told by Valeria", "from the letter" inside the how.
  for (const h of hows) {
    const fm = /\b(?:told by|heard from|from|via|shown by|read in)\s+([^,;]+)/i.exec(h);
    if (fm && !from) from = clean(fm[1]);
  }
  let status: KnowStatus | undefined;
  let perception = false;
  text = clean(text);
  const lead = LEAD_STANCE.exec(text);
  if (lead) {
    status = normStatus(lead[1]);
    text = clean(lead[2]);
    // "suspects Willow but has not named her": the suspicion, and an aside about keeping it.
    const but = /^(.+?)\s+but\s+(.+)$/i.exec(text);
    if (but) {
      text = clean(but[1]);
      notes.push(clean(but[2]));
    }
    // "suspects Kael" → "it was Kael".
    if (BARE_NAME.test(text)) text = `it was ${text}`;
  } else {
    const per = LEAD_PERCEPTION.exec(text);
    if (per && per[2].trim().split(/\s+/).length >= 1) {
      hows.unshift(per[1].toLowerCase());
      text = clean(per[2]);
      perception = true;
    }
  }
  if (!text && !key) return null;
  return {
    item: { statement: text, key, how: hows.length ? hows.join("; ") : undefined, from, note: notes.length ? notes.join("; ") : undefined, status, ...(now ? { now } : {}) },
    noisy,
    perception,
  };
}

/** Status, truth and how from the part after `|` (or a status word written in the fact part). */
function readMeta(meta: string): { status?: KnowStatus; truth?: KnowTruth; how?: string } {
  let status: KnowStatus | undefined;
  let truth: KnowTruth | undefined;
  const how: string[] = [];
  for (const raw of meta.split(/\s*[·;]\s*|\s*,\s*(?=(?:knows?|believes?|suspects?|doubts?|wrong|unaware|true|false|partial|unknown)\b)/i).map((x) => x.trim()).filter(Boolean)) {
    const b = raw.toLowerCase();
    const lead = LEAD_STANCE.exec(raw);
    if (STATUS_WORD.test(b)) status = normStatus(b);
    else if (TRUTH_WORD.test(b)) truth = normTruth(b);
    else if (lead) {
      // "suspects it was Kael" → status suspects, how "it was Kael"
      status = normStatus(lead[1]);
      how.push(lead[2]);
    } else how.push(raw); // free text is how they came to it (keeps its case)
  }
  return { status, truth, how: how.length ? how.join("; ") : undefined };
}

/** `know Holder: …` → items and negations. */
export function parseKnowRest(rest: string): KnowArgs | null {
  const neg = pullNegations(rest);
  const negations = neg.negations;
  const bar = splitTop(neg.rest, /\s*\|\s*/g);
  const factPart = bar[0] ?? "";
  const meta = readMeta(bar.slice(1).join(" · "));
  const pieces = splitTop(factPart, /\s+[·•]\s+|;\s+|\s+\/\/\s+/g);
  // On a bundled line, free text after `|` that isn't a route is one more thing they know
  // ("… · offered his home | cannot go home yet — Joyce's death, Dawn").
  if (pieces.length > 1 && meta.how) {
    const bits = meta.how.split(/;\s*/).map((b) => b.trim()).filter(Boolean);
    const extra = bits.filter((b) => !ROUTE_HINT.test(b) && b.split(/\s+/).length >= 3);
    if (extra.length) {
      pieces.push(...extra);
      meta.how = bits.filter((b) => !extra.includes(b)).join("; ") || undefined;
    }
  }
  const items: KnowItem[] = [];
  let noisy = false;
  let perception = false;
  // "— all this beat" at the end of a bundle speaks for every item on it.
  const lineNow = /\bthis\s+(?:beat|turn)\b|\bdirect(?:ly)?\b|\bjust now\b/i.test(rest);
  for (const p of pieces) {
    const r = readItem(p);
    if (!r) {
      noisy = true;
      continue;
    }
    noisy ||= r.noisy;
    perception ||= r.perception;
    const status = r.item.status ?? meta.status ?? "knows";
    let truth = meta.truth ?? "unknown";
    if (status === "wrong" && truth === "unknown") truth = "false";
    const how = [r.item.how, meta.how].filter(Boolean).join("; ") || undefined;
    items.push({ ...r.item, status, truth, how, ...(r.item.now || lineNow ? { now: true } : {}) });
  }
  // A line that only lists what they don't know still counts.
  if (!items.length && !negations.length) return null;
  const first = items[0];
  return {
    items,
    negations,
    repaired: items.length > 1 || negations.length > 0 || noisy || perception,
    fact: first?.statement ?? "",
    key: first?.key,
    status: first?.status ?? meta.status ?? "knows",
    truth: first?.truth ?? meta.truth ?? "unknown",
    source: first?.how ?? meta.how,
  };
}

// How a reveal travels.
const PUBLIC_CHANNEL = /^(aloud|out loud|openly|in front of|to (?:everyone|the room|all)|announced|shouted|shown|showed|showing|seen|visible|in plain sight)/i;
const EVERYONE = /^(everyone|everybody|all|all present|everyone here|the room|the table|them all|the group|all of them)$/i;

export function isPublicChannel(channel: string): boolean {
  return PUBLIC_CHANNEL.test(channel);
}

export interface RevealArgs {
  statement: string;
  key?: string;
  truth: KnowTruth;
  source?: string;
  /** Named listeners; empty with a public channel means everyone who can hear. */
  listeners: string[];
  everyone: boolean;
  channel: string;
  how?: string;
}

/** `reveal #key: fact | Source → listeners, how · truth` (tolerates `reveal: #key fact | …` and `reveal Source: …`). */
export function parseRevealRest(subject: string, rest: string): RevealArgs | null {
  let head = rest;
  let named = subject.trim();
  const bar = splitTop(rest, /\s*\|\s*/g);
  head = bar[0] ?? "";
  const meta = bar.slice(1).join(" · ");
  let key: string | undefined;
  const sk = /^#([\p{L}\p{N}_-]{2,40})$/u.exec(named);
  if (sk) {
    key = sk[1].toLowerCase();
    named = "";
  }
  const r = readItem(head);
  if (!r) return null;
  key ??= r.item.key;
  let truth: KnowTruth = "unknown";
  let source: string | undefined = named || undefined;
  const listeners: string[] = [];
  let channel = "";
  let everyone = false;
  const how: string[] = [];
  // Channel words anywhere in a bit ("said aloud by Gabriel", "Mara (whispered)").
  const takeChannel = (p: string): string => {
    const m = CHANNEL_ANY.exec(p);
    if (m) channel ||= m[1].toLowerCase().replace(/^out loud$/, "aloud");
    return clean(p.replace(CHANNEL_ANY_G, " ").replace(/[()]/g, " ").replace(/\b(?:said|spoken|told|shown|written|revealed|announced|it)\b/gi, " "));
  };
  const addListener = (w: string) => {
    const who = clean(w.replace(/^to\s+/i, ""));
    if (!who) return;
    if (EVERYONE.test(who)) everyone = true;
    else listeners.push(who);
  };
  for (const bit of splitTop(meta, /\s*[·;]\s*/g)) {
    if (TRUTH_WORD.test(bit)) {
      truth = normTruth(bit);
      continue;
    }
    const arrow = /^(.*?)\s*(?:→|->|=>|\s>\s)\s*(.*)$/.exec(bit);
    if (arrow) {
      const src = takeChannel(arrow[1]).replace(/^(?:by|from)\s+/i, "");
      if (src) source = src;
      for (const p of splitTop(arrow[2], /\s*,\s*|\s+and\s+/g)) {
        if (TRUTH_WORD.test(p)) truth = normTruth(p);
        else addListener(takeChannel(p));
      }
      continue;
    }
    for (const p of splitTop(bit, /\s*,\s*|\s+and\s+(?=to\b)/g)) {
      if (TRUTH_WORD.test(p)) {
        truth = normTruth(p);
        continue;
      }
      const rest = takeChannel(p);
      if (!rest) continue;
      const by = /^(?:by|from)\s+(.+)$/i.exec(rest);
      const to = /^to\s+(.+)$/i.exec(rest);
      const pair = /^(.+?)\s+to\s+(.+)$/i.exec(rest);
      if (by) source = by[1];
      else if (to) splitTop(to[1], /\s*,\s*|\s+and\s+/g).forEach(addListener);
      else if (pair && looksLikeName(pair[1])) {
        source = pair[1];
        splitTop(pair[2], /\s*,\s*|\s+and\s+/g).forEach(addListener);
      } else if (EVERYONE.test(rest)) everyone = true;
      else if (looksLikeName(rest) && !source) source = rest;
      else if (looksLikeName(rest)) addListener(rest);
      else how.push(p);
    }
  }
  if (r.item.how) how.unshift(r.item.how);
  if (!channel) channel = "aloud";
  if (!listeners.length && isPublicChannel(channel)) everyone = true;
  return { statement: r.item.statement, key, truth, source, listeners, everyone, channel, how: how.length ? how.join("; ") : undefined };
}

const CHANNEL_WORDS = "aloud|out loud|openly|announced|shouted|whisper(?:ed|s|ing)?|murmured|quietly|privately|in private|in secret|aside|in a letter|letter|written|wrote|a note|text(?:ed)?|message|shown|showed|showing|in plain sight|overheard|signed|mouthed|telepathically";
const CHANNEL_ANY = new RegExp(`\\b(${CHANNEL_WORDS})\\b`, "i");
const CHANNEL_ANY_G = new RegExp(`\\b(?:${CHANNEL_WORDS})\\b`, "gi");
const looksLikeName = (s: string) => /^(?:\{\{user\}\}|the\s+[a-z]+|[A-ZÀ-Þ])/.test(s) && s.split(/\s+/).length <= 4;

export interface SecretArgs {
  statement: string;
  key?: string;
  truth: KnowTruth;
  keepers: string[];
  from: string[];
}

const names = (s: string) => splitTop(s, /\s*,\s*|\s+and\s+|\s*&\s*/g).map(clean).filter(Boolean);

/** `secret #key: fact | kept by A · from B, C` (also `A keeps it from B`, `hidden from B`). */
export function parseSecretRest(subject: string, rest: string): SecretArgs | null {
  let named = subject.trim();
  const bar = splitTop(rest, /\s*\|\s*/g);
  const meta = bar.slice(1).join(" · ");
  let key: string | undefined;
  const sk = /^#([\p{L}\p{N}_-]{2,40})$/u.exec(named);
  if (sk) {
    key = sk[1].toLowerCase();
    named = "";
  }
  const r = readItem(bar[0] ?? "");
  if (!r) return null;
  key ??= r.item.key;
  const keepers: string[] = named ? [named] : [];
  const from: string[] = [];
  let truth: KnowTruth = "true";
  for (const bit of splitTop(meta, /\s*[·;]\s*/g)) {
    if (TRUTH_WORD.test(bit)) {
      truth = normTruth(bit);
      continue;
    }
    const keeps = /^(.+?)\s+(?:keeps?|hides?|is hiding|are hiding|conceals?)\s+(?:it\s+)?from\s+(.+)$/i.exec(bit);
    if (keeps) {
      keepers.push(...names(keeps[1]));
      from.push(...names(keeps[2]));
      continue;
    }
    const kb = /^(?:kept|known|held|guarded)\s+by\s+(.+)$/i.exec(bit);
    if (kb) {
      keepers.push(...names(kb[1]));
      continue;
    }
    const fr = /^(?:(?:kept|hidden|secret)\s+)?from\s+(.+)$/i.exec(bit);
    if (fr) {
      from.push(...names(fr[1]));
      continue;
    }
    const kf = /^kept\s+by\s+(.+?)\s+from\s+(.+)$/i.exec(bit);
    if (kf) {
      keepers.push(...names(kf[1]));
      from.push(...names(kf[2]));
    }
  }
  return { statement: r.item.statement, key, truth, keepers, from };
}

/** `unaware Name: thing · thing` → the things (a #key names a tracked fact). */
export function parseUnawareRest(rest: string): string[] {
  const text = rest.replace(/^\s*(?:of|that)\s+/i, "");
  return splitTop(text, /\s+[·•]\s+|;\s+|,\s*(?:or\s+|and\s+)?|\s+or\s+/g)
    .map((p) => clean(p.replace(/^(?:that|about|of)\s+/i, "")))
    .filter(Boolean);
}
