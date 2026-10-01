// Parser for the ALMANAC <ledger> delta language, the scene header, the Unspoken
// register and filed artifacts. Tolerant by design: models fence, escape,
// bullet and misspell; we normalise first and keep what we can't read.

import type { OpName, ParsedLedger, ParsedOp, SceneHeader, SpokenLine } from "./types";
import { LADDER_NAMES, LADDER_WORDS } from "./types";
import { splitTraits } from "./traits";
import { unescapeHtml } from "./util";
import { parseKnowRest, parseRevealRest, parseSecretRest, parseUnawareRest } from "./knowparse";

const OP_ALIASES: Record<string, OpName> = {
  clock: "clock", time: "clock", elapsed: "clock",
  wx: "wx", weather: "wx",
  at: "at", place: "at", location: "at", loc: "at", where: "at",
  cast: "cast", present: "cast", who: "cast",
  mood: "mood", emotion: "mood", feel: "mood",
  body: "body", state: "body", condition: "body",
  look: "look", outfit: "look", clothes: "look", wearing: "look",
  trait: "trait", traits: "trait", appearance: "trait", features: "trait", physical: "trait",
  motif: "motif", motifs: "motif", bit: "motif", running: "motif", catchphrase: "motif", keepsake: "motif",
  bond: "bond", rel: "bond", relationship: "bond", regard: "bond",
  ladder: "ladder", romance: "ladder",
  know: "know", knows: "know", knowledge: "know", belief: "know",
  reveal: "reveal", reveals: "reveal", revealed: "reveal", tell: "reveal", told: "reveal", disclose: "reveal",
  secret: "secret", secrets: "secret", hidden: "secret",
  unaware: "unaware", lacks: "unaware", ignorant: "unaware",
  item: "item", inv: "item", inventory: "item", object: "item",
  thread: "thread", plot: "thread",
  owe: "owe", debt: "owe", promise: "owe", favour: "owe", favor: "owe",
  cons: "cons", consequence: "cons",
  clockf: "clockf", faction: "clockf", project: "clockf",
  rumor: "rumor", rumour: "rumor", gossip: "rumor",
  rep: "rep", reputation: "rep",
  journal: "journal", memory: "journal", diary: "journal",
  keys: "keys", key: "keys", keywords: "keys",
  canon: "canon", fact: "canon", lore: "canon",
  artifact: "artifact", artefact: "artifact", doc: "artifact", document: "artifact",
  mode: "mode", scene: "mode",
  status: "status",
  gauge: "gauge", meter: "gauge",
  clue: "clue", evidence: "clue",
  plant: "plant", setup: "plant",
  payoff: "payoff", callback: "payoff",
  deadline: "deadline", countdown: "deadline",
  title: "title",
  season: "season",
};

/** Ops whose name sits before the colon: `mood Mara: …`. */
const SUBJECT_OPS = new Set<OpName>([
  "mood", "body", "look", "bond", "ladder", "know", "unaware", "item", "thread", "owe", "cons",
  "clockf", "rep", "journal", "keys", "artifact", "status", "gauge", "deadline", "trait",
]);

/** The op a line starts with, when it is one ("hunger 4→2" is not; "ladder A>B: …" is). */
export function opWordOf(line: string): OpName | undefined {
  const m = /^\s*(?:[-*•]\s+|\d+[.)]\s+)?([A-Za-z_]+)\b[^:\n]*:/.exec(line);
  return m ? OP_ALIASES[m[1].toLowerCase()] : undefined;
}

export const SCENE_MODES = ["social", "intimacy", "conflict", "investigation", "travel", "stealth", "downtime", "crisis"] as const;

const AXIS_ALIASES: Record<string, string> = {
  trust: "trust", distrust: "trust",
  affection: "affection", fondness: "affection", love: "affection", warmth: "affection", warm: "affection",
  respect: "respect", esteem: "respect",
  familiarity: "familiarity", familiar: "familiarity", closeness: "familiarity",
  comfort: "comfort", safety: "comfort", ease: "comfort",
  attraction: "attraction", attract: "attraction", desire: "attraction",
  fear: "fear", dread: "fear",
  resentment: "resentment", resent: "resentment", grudge: "resentment", jealousy: "resentment",
  obligation: "obligation", debt: "obligation", owes: "obligation",
  rivalry: "rivalry", rival: "rivalry", competition: "rivalry",
};

const METER_ALIASES: Record<string, string> = {
  health: "health", hp: "health",
  fatigue: "fatigue", tired: "fatigue", exhaustion: "fatigue",
  hunger: "hunger", hungry: "hunger",
  thirst: "thirst", thirsty: "thirst",
  pain: "pain",
  intox: "intox", intoxication: "intox", drunk: "intox", tipsy: "intox",
  arousal: "arousal",
  composure: "composure", ballast: "composure",
};

const SEVERITY: Record<string, 1 | 2 | 3 | 4> = {
  scratch: 1, bruise: 1, minor: 1, graze: 1, cut: 1,
  wound: 2, moderate: 2, sprain: 2,
  serious: 3, severe: 3, broken: 3, fracture: 3,
  critical: 4, mortal: 4, grave: 4,
};

const TIER_ALIASES: Record<string, string> = {
  spot: "spot", spotlight: "spot", s: "spot", focus: "spot",
  peri: "peri", periphery: "peri", p: "peri", bg: "peri", background: "peri",
  left: "left", leave: "left", leaves: "left", exit: "left", exits: "left", gone: "left", out: "left",
  arrive: "arrive", arrives: "arrive", arrived: "arrive", enter: "arrive", enters: "arrive", in: "arrive",
  off: "off", offscreen: "off", away: "off",
  dead: "dead", died: "dead",
};

const CAUSE_SPLIT = /\s(?:—|–|--|-(?=\s))\s*/;

function splitCause(s: string): { main: string; cause?: string } {
  const m = CAUSE_SPLIT.exec(s);
  if (!m) return { main: s.trim() };
  return { main: s.slice(0, m.index).trim(), cause: s.slice(m.index + m[0].length).trim() || undefined };
}

function splitArrow(s: string): [string, string] | null {
  const m = /\s*(?:→|->|=>|⟶|>)\s*/.exec(s);
  if (!m) return null;
  return [s.slice(0, m.index).trim(), s.slice(m.index + m[0].length).trim()];
}

function num(s: string | undefined): number | undefined {
  if (s == null) return undefined;
  const n = parseFloat(String(s).replace(/[^\d.+-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

// ---------------------------------------------------------------------------
// Block extraction
// ---------------------------------------------------------------------------

export interface LedgerBlock {
  body: string;
  truncated: boolean;
  format: "dsl" | "json";
}

/** Normalise model output so the block can be found: unescape, unfence, pull out of reasoning. */
export function normalizeForLedger(text: string): string {
  let t = text ?? "";
  if (/&lt;\/?ledger&gt;/i.test(t)) t = unescapeHtml(t);
  // Fenced ledgers: ```ledger … ``` or ```xml <ledger>…</ledger> ```
  t = t.replace(/```[a-z]*\s*(<ledger>[\s\S]*?<\/ledger>)\s*```/gi, "$1");
  t = t.replace(/```ledger\s*\n([\s\S]*?)```/gi, "<ledger>\n$1</ledger>");
  return t;
}

export function extractLedgerBlock(text: string): LedgerBlock | null {
  const t = normalizeForLedger(text);
  const re = /<ledger\b[^>]*>([\s\S]*?)(<\/ledger>|$)/gi;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    last = m;
    if (!m[2]) break;
  }
  if (!last) return null;
  const body = last[1].trim();
  const truncated = !last[2];
  const format = /^[[{]/.test(body) ? "json" : "dsl";
  return { body, truncated, format };
}

export function stripLedger(text: string): string {
  return text.replace(/\s*<ledger\b[^>]*>[\s\S]*?(<\/ledger>|$)\s*/gi, "\n").trim();
}

// ---------------------------------------------------------------------------
// Line parsing
// ---------------------------------------------------------------------------

/** One ledger line. `oneFact`: a knowledge line holds a single fact (the clerk's lines). */
export function parseLine(rawLine: string, oneFact = false): ParsedOp | null {
  let line = rawLine.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
  if (!line || line.startsWith("//") || line.startsWith("#")) return null;
  const m = /^([A-Za-z_]+)\b\s*([^:]*?)\s*:\s*([\s\S]*)$/.exec(line);
  if (!m) return null;
  const op = OP_ALIASES[m[1].toLowerCase()];
  if (!op) return null;
  let subject = m[2].trim();
  let rest = m[3].trim();
  // "mood: Mara: …" (subject after the first colon) — tolerate.
  if (SUBJECT_OPS.has(op) && !subject) {
    const mm = /^([^:|]{1,80}?)\s*:\s*([\s\S]*)$/.exec(rest);
    if (mm && op !== "bond") {
      subject = mm[1].trim();
      rest = mm[2].trim();
    } else if (mm && op === "bond" && /[>→]/.test(mm[1])) {
      subject = mm[1].trim();
      rest = mm[2].trim();
    }
  }
  const base: ParsedOp = { op, args: {}, raw: rawLine.trim() };
  try {
    return PARSERS[op](base, subject, rest, oneFact) ?? null;
  } catch {
    return null;
  }
}

type LineParser = (p: ParsedOp, subject: string, rest: string, oneFact?: boolean) => ParsedOp | null;

function parseClockSpec(s: string): Record<string, any> | null {
  // "+5m → 22:18": the time it reaches, with the span as a fallback if that would run backwards.
  const arrow = /^(.*?)\s*(?:→|->|=>)\s*(.+)$/.exec(s.trim());
  if (arrow) {
    const to = parseClockSpec(arrow[2]);
    const by = arrow[1] ? parseClockSpec(arrow[1]) : null;
    if (to?.kind === "abs") return by?.kind === "rel" ? { ...to, orRel: by.minutes } : to;
    return by ?? to;
  }
  const t = s.trim().toLowerCase();
  const abs = /^(?:day\s*(\d+)\D*?)?(\d{1,2})[:.h](\d{2})\s*(am|pm)?/.exec(t);
  if (/^day\s*\d+/.test(t) || (/^\d{1,2}[:.]\d{2}/.test(t) && !t.startsWith("+"))) {
    if (abs) {
      let h = parseInt(abs[2], 10);
      const mi = parseInt(abs[3], 10);
      if (abs[4] === "pm" && h < 12) h += 12;
      if (abs[4] === "am" && h === 12) h = 0;
      return { kind: "abs", day: abs[1] ? parseInt(abs[1], 10) : undefined, minute: (h % 24) * 60 + (mi % 60) };
    }
  }
  let total = 0;
  let found = false;
  const re = /([+-]?\d+(?:\.\d+)?)\s*(days|day|d|hours|hour|hrs|hr|h|minutes|minute|mins|min|m)(?![a-z])/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(t))) {
    found = true;
    const v = parseFloat(mm[1]);
    const u = mm[2][0];
    total += u === "d" ? v * 1440 : u === "h" ? v * 60 : v;
  }
  if (!found) {
    const bare = /^\+?(\d+)$/.exec(t);
    if (bare) return { kind: "rel", minutes: parseInt(bare[1], 10) };
    return null;
  }
  return { kind: "rel", minutes: Math.round(total) };
}

export function parseWeatherText(s: string): { condition: string; intensity?: string; tempC?: number; wind?: string } {
  let text = s.trim();
  const out: { condition: string; intensity?: string; tempC?: number; wind?: string } = { condition: "" };
  const c = /(-?\d+(?:\.\d+)?)\s*°?\s*C\b/i.exec(text);
  const f = /(-?\d+(?:\.\d+)?)\s*°?\s*F\b/i.exec(text);
  if (c) out.tempC = parseFloat(c[1]);
  else if (f) out.tempC = Math.round(((parseFloat(f[1]) - 32) * 5) / 9);
  const w = /\bwind\s+([NSEW]{1,3}|calm|still|gusting|strong|light)\b|\b([NSEW]{1,3})\s+wind\b/i.exec(text);
  if (w) out.wind = (w[1] || w[2]).toUpperCase().replace("CALM", "calm").replace("STILL", "calm");
  const parts = text.split(/\s*[·,|;]\s*/).filter(Boolean);
  const cond = parts.find((p) => !/°|\bwind\b|^\s*[NSEW]{1,3}\s*$/i.test(p)) ?? parts[0] ?? "";
  const im = /\b(light|moderate|heavy|torrential|driving|thin|thick|dense|gentle|steady|patchy|blizzard|violent|severe)\b/i.exec(cond);
  if (im) out.intensity = im[1].toLowerCase();
  out.condition = cond.replace(/[\p{Extended_Pictographic}️]/gu, "").trim().toLowerCase();
  return out;
}

const PARSERS: Record<OpName, LineParser> = {
  clock(p, _s, rest) {
    const spec = parseClockSpec(rest);
    if (!spec) return null;
    p.args = spec;
    return p;
  },
  wx(p, _s, rest) {
    const arrow = splitArrow(rest);
    // "unchanged — heavy rain" restates the weather; a bare "unchanged" files nothing.
    const now = (arrow ? arrow[1] : rest).replace(/^\s*(?:unchanged|no change|same(?: as before)?|holds|holding|steady)\b\s*[—–:,-]*\s*/i, "");
    if (!now.trim()) return null;
    p.args = { ...parseWeatherText(now), from: arrow ? arrow[0] : undefined, raw: now };
    if (!p.args.condition) return null;
    return p;
  },
  at(p, _s, rest) {
    const path = rest.split(/\s*(?:›|»|>|\/|\|)\s*/).map((x) => x.trim()).filter(Boolean);
    if (!path.length) return null;
    p.args = { path };
    return p;
  },
  cast(p, _s, rest) {
    const chunks = rest.includes("·") || rest.includes(";") ? rest.split(/\s*[·;]\s*/) : rest.split(/\s*,\s*(?![^()]*\))/);
    const entries: { name: string; tier: string; activity?: string }[] = [];
    for (const raw of chunks) {
      const c = raw.trim();
      if (!c) continue;
      const m = /^(.+?)\s*@\s*([a-zA-Z]+)\s*(?:\((.*)\))?\s*$/.exec(c) || /^(.+?)\s*\((.*)\)\s*$/.exec(c);
      if (m && m.length === 4 && m[2] !== undefined && /@/.test(c)) {
        entries.push({ name: m[1].trim(), tier: TIER_ALIASES[m[2].toLowerCase()] ?? "peri", activity: m[3]?.trim() });
      } else if (m && !/@/.test(c)) {
        entries.push({ name: m[1].trim(), tier: "peri", activity: m[2]?.trim() });
      } else {
        entries.push({ name: c.replace(/@.*/, "").trim(), tier: "peri" });
      }
    }
    if (!entries.length) return null;
    p.args = { entries };
    return p;
  },
  mood(p, s, rest) {
    if (!s) return null;
    p.subject = s;
    // "flustered → tender-open (V+3 A4 D-2) — the song broke her open": the reason and a
    // parenthesised V/A/D aren't part of the mood's name.
    const { main, cause } = splitCause(rest);
    if (cause) p.cause = cause;
    let [emo, vad] = main.split("|").map((x) => x.trim());
    const paren = /\s*\(([^)]*\b[VAD]\s*[+-]?\d[^)]*)\)\s*/i.exec(emo);
    if (paren) {
      vad ??= paren[1];
      emo = emo.replace(paren[0], " ").trim();
    }
    const arrow = splitArrow(emo);
    p.args = { name: (arrow ? arrow[1] : emo).trim(), prev: arrow?.[0] };
    if (vad) {
      const v = /V\s*([+-]?\d)/i.exec(vad);
      const a = /A\s*([+-]?\d)/i.exec(vad);
      const d = /D\s*([+-]?\d)/i.exec(vad);
      // The documented ranges: valence and dominance −3..3, arousal 0..5.
      if (v) p.args.v = Math.max(-3, Math.min(3, parseInt(v[1], 10)));
      if (a) p.args.a = Math.max(0, Math.min(5, parseInt(a[1], 10)));
      if (d) p.args.d = Math.max(-3, Math.min(3, parseInt(d[1], 10)));
    }
    if (!p.args.name) return null;
    return p;
  },
  body(p, s, rest) {
    if (!s) return null;
    p.subject = s;
    const { main, cause } = splitCause(rest);
    p.cause = cause;
    const meters: Record<string, { v: number; rel: boolean }> = {};
    const flags: string[] = [];
    const unflags: string[] = [];
    const injuries: any[] = [];
    const heals: string[] = [];
    // Split on ";" outside brackets: "hunger 4→2 (fed; real food)" is one meter.
    for (const seg0 of main.split(/\s*;\s*(?![^()]*\))/)) {
      const seg = seg0.trim();
      if (!seg) continue;
      // "injury: left arm, serious, bandaged". Without the colon ("wound stable") it is a note about one.
      const inj = /^(?:injur(?:y|ies|ed)|wounds?|hurt)\s*:\s*(.+)$/i.exec(seg);
      if (inj && !/^(?:unchanged|no change|as before|same|none)\b/i.test(inj[1])) {
        const parts = inj[1].split(/\s*,\s*/);
        const where = parts[0] ?? "body";
        let severity: 1 | 2 | 3 | 4 = 2;
        let treated = false;
        for (const x of parts.slice(1)) {
          const k = x.toLowerCase().trim();
          if (SEVERITY[k]) severity = SEVERITY[k];
          if (TENDED.test(k)) treated = true;
        }
        injuries.push({ where, severity, treated, note: parts.slice(1).join(", ") });
        continue;
      }
      const heal = /^(?:heal(?:ed)?|healed)\s*:?\s*(.+)$/i.exec(seg);
      if (heal) {
        heals.push(heal[1].trim());
        continue;
      }
      if (readMeter(seg, meters)) continue;
      for (const f of seg.split(/\s*,\s*(?![^()]*\))/)) {
        const ff = f.trim();
        if (!ff) continue;
        if (readMeter(ff, meters)) continue;
        if (ff.startsWith("-") || ff.startsWith("no longer ")) unflags.push(ff.replace(/^-|^no longer /, "").trim().toLowerCase());
        else if (/^(dead|died|killed)$/i.test(ff)) flags.push("dead");
        else {
          // "concussion + scalp laceration", "self-stitched wound closed": injuries written as words.
          const hurt = injuriesIn(ff);
          if (hurt.length) injuries.push(...hurt);
          // "malnourished (unchanged)" restates "malnourished": one flag, not two.
          else flags.push(ff.replace(/^\+/, "").replace(/\s*\((?:unchanged|no change|still|same|as before|ongoing|continues?)\)\s*$/i, "").toLowerCase());
        }
      }
    }
    p.args = { meters, flags, unflags, injuries, heals, care: careIn(rest) };
    return p;
  },
  look(p, s, rest) {
    if (!s || !rest) return null;
    p.subject = s;
    p.args = { text: rest };
    return p;
  },
  bond(p, s, rest) {
    const pair = splitArrow(s);
    if (!pair || !pair[0] || !pair[1]) return null;
    p.subject = pair[0];
    p.object = pair[1];
    const { main, cause } = splitCause(rest);
    p.cause = cause;
    const changes: { axis: string; delta: number }[] = [];
    const unknownAxes: string[] = [];
    // Whole words only: "self-resentment +2" is not resentment of the other person.
    const re = /(?<![\w-])([a-zA-Z][a-zA-Z-]*)\s*([+\-−]\s*\d+)/g;
    let m: RegExpExecArray | null;
    let pairs = 0;
    while ((m = re.exec(main))) {
      pairs++;
      const axis = AXIS_ALIASES[m[1].toLowerCase()];
      if (!axis) {
        unknownAxes.push(m[1].toLowerCase());
        continue;
      }
      changes.push({ axis, delta: parseInt(m[2].replace(/\s|−/g, (c) => (c === "−" ? "-" : "")), 10) });
    }
    // "bond A>B: +1 — cause" or "wary → steady | +1 — cause", with no axis (models write
    // it this way often): the delta still counts, on an axis named as a word of its own
    // before the cause, else affection ("fear-of-loss" in a cause is not fear of them);
    // a "from → to" before it becomes the label.
    let moved: string | undefined;
    if (!pairs) {
      const bare = /(^|[\s|(])([+\-−]\s*\d)(?!\d)/.exec(main);
      if (bare) {
        const named = main.toLowerCase().split(/[\s|,;()]+/).map((w) => AXIS_ALIASES[w]).find(Boolean);
        changes.push({ axis: named ?? "affection", delta: parseInt(bare[2].replace(/\s/g, "").replace("−", "-"), 10) });
        const before = main.slice(0, bare.index).replace(/[|,;]+\s*$/, "").trim();
        const to = before.split(/\s*(?:→|->|=>)\s*/).pop()!.trim();
        if (to && !/\d/.test(to)) moved = to;
      }
    }
    const label = /label\s*[:=]\s*["“]?([^"”]+)["”]?/i.exec(main)?.[1] ?? moved;
    const tags = /tags?\s*[:=]\s*([\w ,-]+)/i.exec(main)?.[1]?.split(/\s*,\s*/).filter(Boolean);
    if (!changes.length && !label && !tags) {
      if (unknownAxes.length) p.args = { changes: [], unknownAxes };
      else if (main && !/\d/.test(main)) p.args = { label: main.replace(/^["“]|["”]$/g, "") };
      else return null;
    } else p.args = { changes, label, tags, ...(unknownAxes.length ? { unknownAxes } : {}) };
    return p;
  },
  ladder(p, s, rest) {
    const pair = splitArrow(s);
    if (!pair) return null;
    p.subject = pair[0];
    p.object = pair[1];
    const { main, cause } = splitCause(rest);
    p.cause = cause;
    p.args = readRung(main, cause);
    return p;
  },
  know(p, s, rest, oneFact) {
    if (!s) return null;
    p.subject = s;
    // One fact per item: bundles split, routes lifted, "does not know …" pulled out (knowparse).
    const k = parseKnowRest(rest, oneFact);
    if (!k) return null;
    p.args = k;
    p.cause = k.source;
    return p;
  },
  reveal(p, s, rest) {
    const r = parseRevealRest(s, rest);
    if (!r || (!r.statement && !r.key)) return null;
    p.subject = r.source;
    p.args = r;
    p.cause = r.how ?? r.channel;
    return p;
  },
  secret(p, s, rest) {
    const r = parseSecretRest(s, rest);
    if (!r || (!r.statement && !r.key)) return null;
    p.args = r;
    p.cause = r.keepers.length ? `kept by ${r.keepers.join(", ")}` : undefined;
    return p;
  },
  unaware(p, s, rest) {
    if (!s) return null;
    p.subject = s;
    const things = parseUnawareRest(rest);
    if (!things.length) return null;
    p.args = { things };
    return p;
  },
  item(p, s, rest) {
    if (!s) return null;
    const q = /\s*\(?\s*[x×]\s*(\d+)\s*\)?\s*$/.exec(s);
    p.subject = q ? s.slice(0, q.index).trim() : s;
    const { main, cause } = splitCause(rest);
    p.cause = cause;
    const arrow = splitArrow(main);
    if (arrow) {
      const to = arrow[1].trim();
      p.args = { from: arrow[0] || undefined, to: /^(gone|lost|destroyed|burned|used|consumed|broken|nothing|none)$/i.test(to) ? "gone" : to, quantity: q ? parseInt(q[1], 10) : undefined };
    } else if (/^\+/.test(main)) {
      p.args = { to: main.replace(/^\+\s*/, ""), quantity: q ? parseInt(q[1], 10) : undefined };
    } else if (/^condition\s*[:=]?\s*/i.test(main)) {
      p.args = { condition: main.replace(/^condition\s*[:=]?\s*/i, "") };
    } else if (main) {
      p.args = { to: main, quantity: q ? parseInt(q[1], 10) : undefined };
    } else return null;
    return p;
  },
  thread(p, s, rest) {
    if (!s) return null;
    p.subject = s;
    const { main, cause } = splitCause(rest);
    const m = /^(new|open(?:s|ed)?|advanc(?:e|es|ed)|complicat(?:e|es|ed)|bridg(?:e|es|ed)|resolv(?:e|es|ed)|clos(?:e|es|ed)|stall(?:s|ed)?)\b\s*(?:\((.*)\))?\s*(.*)$/i.exec(main);
    if (!m) {
      p.args = { op: "advance", detail: main || cause };
      p.cause = cause ?? main;
      return p;
    }
    const VERB: [RegExp, string][] = [[/^(new|open)/, "new"], [/^advanc/, "advance"], [/^complicat/, "complicate"], [/^bridg/, "bridge"], [/^(resolv|clos)/, "resolve"], [/^stall/, "stall"]];
    const op = VERB.find(([re]) => re.test(m[1].toLowerCase()))?.[1] ?? "advance";
    p.args = { op, blocker: m[2]?.trim(), detail: (m[3] || cause || "").trim() || undefined };
    p.cause = cause ?? (m[3]?.trim() || undefined);
    return p;
  },
  owe(p, s, rest) {
    return parseCons(p, s, rest, "owe");
  },
  cons(p, s, rest) {
    return parseCons(p, s, rest, "cons");
  },
  clockf(p, s, rest) {
    if (!s) return null;
    p.subject = s;
    const { main, cause } = splitCause(rest);
    p.cause = cause;
    const frac = /(\d+)\s*\/\s*(\d+)/.exec(main);
    const inc = /(^|\s)([+-]\d+)(\s|$)/.exec(main);
    const project = main.replace(/\(?\d+\s*\/\s*\d+\)?/, "").replace(/(^|\s)[+-]\d+(\s|$)/, " ").trim() || "project";
    p.args = { project, cur: frac ? parseInt(frac[1], 10) : undefined, max: frac ? parseInt(frac[2], 10) : undefined, inc: inc ? parseInt(inc[2], 10) : undefined };
    if (p.args.cur == null && p.args.inc == null) p.args.inc = 1;
    return p;
  },
  rumor(p, _s, rest) {
    const [text, route = "", truth = "unknown"] = rest.split(/\s*\|\s*/);
    if (!text) return null;
    const arrow = splitArrow(route);
    p.args = { text: text.trim(), from: arrow?.[0] || route || undefined, to: arrow?.[1], truth: /false/i.test(truth) ? "false" : /true/i.test(truth) ? "true" : /partial|half/i.test(truth) ? "partial" : "unknown" };
    return p;
  },
  rep(p, s, rest) {
    const at = s.split(/\s*@\s*/);
    const group = (at[1] ?? at[0] ?? "").trim();
    if (!group) return null;
    p.subject = at.length > 1 ? at[0].trim() : undefined;
    p.object = group;
    const { main, cause } = splitCause(rest);
    p.cause = cause;
    const d = /([+-]\d+)/.exec(main);
    const tag = main.replace(/[+-]\d+/, "").trim();
    p.args = { delta: d ? parseInt(d[1], 10) : 0, tag: tag || undefined };
    return p;
  },
  journal(p, s, rest) {
    if (!s || !rest) return null;
    p.subject = s;
    p.args = { text: rest.replace(/^["“]|["”]$/g, "").trim() };
    return p;
  },
  keys(p, s, rest) {
    if (!s) return null;
    p.subject = s;
    p.args = { keys: rest.split(/\s*[,;·]\s*/).map((k) => k.trim().toLowerCase()).filter(Boolean) };
    return p.args.keys.length ? p : null;
  },
  canon(p, _s, rest) {
    if (!rest) return null;
    p.args = { text: rest };
    return p;
  },
  artifact(p, s, rest) {
    if (!s) return null;
    p.subject = s;
    const { main, cause } = splitCause(rest);
    p.args = { kind: (main || "document").toLowerCase().split(/\s+/)[0], holder: cause };
    return p;
  },
  mode(p, _s, rest) {
    const m = rest.trim().toLowerCase().split(/\s+/)[0];
    if (!m) return null;
    p.args = { mode: (SCENE_MODES as readonly string[]).includes(m) ? m : "social", rawMode: m };
    return p;
  },
  status(p, s, rest) {
    if (!s || !rest) return null;
    p.subject = s;
    p.args = { text: rest };
    return p;
  },
  gauge(p, s, rest) {
    if (!s) return null;
    p.subject = s;
    const { main, cause } = splitCause(rest);
    p.cause = cause;
    const frac = /(\d+)\s*\/\s*(\d+)/.exec(main);
    const rel = /^([+-]\d+)/.exec(main.trim());
    const abs = /^(\d+)/.exec(main.trim());
    const args = frac ? { cur: parseInt(frac[1], 10), max: parseInt(frac[2], 10) } : rel ? { inc: parseInt(rel[1], 10) } : abs ? { cur: parseInt(abs[1], 10) } : null;
    if (!args) return null;
    p.args = args;
    return p;
  },
  clue(p, _s, rest) {
    const [text, points, rel] = rest.split(/\s*\|\s*/);
    if (!text) return null;
    p.args = { text: text.trim(), pointsTo: points?.replace(/^points?\s*to\s*/i, "").trim(), reliability: rel?.trim() };
    return p;
  },
  plant(p, _s, rest) {
    const [text, payoff] = rest.split(/\s*\|\s*/);
    if (!text) return null;
    p.args = { text: text.trim(), payoff: payoff?.trim() };
    return p;
  },
  payoff(p, _s, rest) {
    if (!rest) return null;
    p.args = { text: rest.trim() };
    return p;
  },
  deadline(p, s, rest) {
    if (!s) return null;
    p.subject = s;
    const spec = parseClockSpec(rest);
    if (/^(done|met|missed|passed|cancel)/i.test(rest.trim())) p.args = { done: true };
    else if (spec) p.args = spec;
    else return null;
    return p;
  },
  title(p, _s, rest) {
    if (!rest) return null;
    p.args = { text: rest.trim() };
    return p;
  },
  season(p, _s, rest) {
    const arrow = splitArrow(rest);
    const now = splitCause(arrow ? arrow[1] : rest).main.replace(/[.!]+$/, "").trim();
    if (!/spring|summer|autumn|fall|winter/i.test(now)) return null;
    p.args = { name: now.toLowerCase() };
    return p;
  },
  trait(p, s, rest) {
    if (!s || !rest) return null;
    p.subject = s;
    const traits = splitTraits(rest.replace(/\s[—–]\s.*$/, ""));
    if (!traits.length) return null;
    p.args = { traits };
    return p;
  },
  motif(p, s, rest) {
    // "motif: the oil joke | Oberyn" or "motif Oberyn: the oil joke"
    const [text, who] = rest.split(/\s*\|\s*/);
    if (!text?.trim()) return null;
    p.subject = s || who?.trim() || undefined;
    p.args = { text: text.replace(/^["“]|["”]$/g, "").trim().slice(0, 140), who: s || who?.trim() || undefined };
    return p;
  },
  forecast: () => null,
  pressure: () => null,
  diverge: () => null,
  entity: () => null,
  lock: () => null,
};

/**
 * The rung a ladder line reaches: "+1", "tier 3", "tier 2 → tier 3" (the right side), "Spoken",
 * "Charged → Tested (…)", or a rung named at the start of the cause ("tier 2 — Charged — …": the
 * name the note shows wins over a miscounted number). "hold" keeps the rung. Anything else is
 * returned as `unknown` so the Almanac can say which rungs exist.
 */
function readRung(main: string, cause?: string): Record<string, any> {
  const plain = main.replace(/\([^)]*\)/g, " ").trim();
  const arrow = splitArrow(plain);
  // A bracket the cause split open ("Consent (she said yes") is not part of the rung.
  const target = (arrow ? arrow[1] : plain).replace(/\s*\(.*$/, "").trim();
  const rel = /^([+-]\d)\b/.exec(target);
  if (rel) return { tier: parseInt(rel[1], 10), rel: true };
  if (/\b(hold|holds|holding|held|same|unchanged|no change|steady)\b/i.test(target)) return { hold: true };
  const num = /(?:\b(?:tier|step|rung)\s*)?\b([0-7])\b/i.exec(target);
  const named = (s: string) => {
    for (const x of s.toLowerCase().match(/[a-z]+/g) ?? []) {
      const i = LADDER_NAMES.findIndex((n) => n.toLowerCase() === x);
      if (i >= 0) return i;
      if (LADDER_WORDS[x] != null) return LADDER_WORDS[x];
    }
    return -1;
  };
  let name = named(target);
  // "tier 2 — Charged — …": only a rung's own name opening the cause counts, never a word inside it.
  if (name < 0 && cause) name = LADDER_NAMES.findIndex((n) => n.toLowerCase() === (/^[A-Za-z]+/.exec(cause.trim())?.[0] ?? "").toLowerCase());
  if (name >= 0) return { tier: name, named: true };
  if (num) return { tier: parseInt(num[1], 10), rel: false };
  if (/\b(hold|holds|holding|same|unchanged|no change|steady)\b/i.test(target)) return { hold: true };
  return { unknown: target.slice(0, 40) };
}

const INJURY = /\b(wound(?:ed|s)?|cuts?|gash(?:es)?|lacerations?|concussion|stitch(?:es|ed)?|burns?|burned|bruis\w*|fractur\w*|broken\s+(?:arm|leg|ribs?|wrist|nose|hand|fingers?|ankle|jaw|collarbone)|sprain\w*|bites?|stab(?:bed)?|bullet|graze[sd]?|scrapes?|scraped|blisters?|welts?|slash(?:ed)?|puncture[sd]?|split lip|black eye)\b/i;
const NOT_HURT = /^(no|not|healed|without|free of)\b|\bwound (?:up|tight)\b|\bhealed\b/i;
const PART = /\b((?:left|right|lower|upper)\s+)?(head|scalp|temples?|brows?|face|cheeks?|lips?|mouth|jaw|nose|eyes?|ears?|neck|throat|shoulders?|arms?|forearms?|elbows?|wrists?|hands?|palms?|knuckles?|fingers?|thumbs?|chest|ribs?|side|flank|back|spine|stomach|belly|abdomen|hips?|legs?|thighs?|knees?|shins?|calf|calves|ankles?|foot|feet|soles?|arch(?:es)?|heels?|toes?)\b/i;
const MILD = /\b(bruis|scrape|graze|blister|welt|scratch|split lip|minor|small|shallow|superficial|nick)/i;
const BAD = /\b(fractur|broken(?!\s+(?:glass|skin|nail))|stab|bullet|puncture)/i;
/** Care inside a line about a wound ("untreated" is not "treated"). */
const TENDED = /(?<!un)(?:stitch|bandag|treated|dressed|splint|closed|sutur|cleaned|gauze|wrapped)/i;
/** "needs stitches", "not yet bandaged": care that hasn't happened. */
const NOT_YET = /\b(?:no|not|needs?|without|refus\w*|yet to be)\b[^,;]*$/i;
/** Care named anywhere in a body, look or cast note: narrower, since "dressed" and "closed" mean other things there. */
const CARE = /(?<!un)(?:bandag|treat(?:ed|ing)\b|stitch|sutur|splint|gauze|re-?wrapped)/i;

const REGION: Record<string, string> = { feet: "foot", calves: "calf", arch: "foot", arche: "foot", sole: "foot", heel: "foot", toe: "foot", palm: "hand", knuckle: "hand", scalp: "head", temple: "head", brow: "head" };

/** The body part a wound is on and its side: "right arch" and "feet" are both the foot. Null for a bare "wound". */
function spot(where: string): { part: string; side: string } | null {
  const m = PART.exec(where);
  if (!m) return null;
  const word = m[2].toLowerCase();
  const one = word === "feet" || word === "calves" ? word : word.replace(/s$/, "");
  return { part: REGION[one] ?? one, side: (/\b(left|right)\b/i.exec(where)?.[1] ?? "").toLowerCase() };
}

/** Two ways of naming one place on the body ("feet", "right foot"). */
export function sameSpot(a: string, b: string): boolean {
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const x = spot(a), y = spot(b);
  return !!x && !!y && x.part === y.part && (!x.side || !y.side || x.side === y.side);
}

/** True when the wound is filed under a body part, not just its kind ("cut", "bruise"). */
export const hasPart = (where: string) => PART.test(where);

/** A wound with no place on the body: "wound", "stitches". */
export const isBareWound = (where: string) => /^wound$/i.test(where.trim());

const METER = /^([a-zA-Z]+)\s*[:=]?\s*(?:[+-]?\d+\s*(?:→|->|=>|to)\s*)?([+-]?\d+)\s*\+?\s*(?:\/\s*5)?\s*(?:\([^)]*\))?(?:\s+(?:from|after|because|due to|—|-)\s.*)?[.]?$/;

/** "hunger 3", "fatigue +1", "hunger 4→2 (fed)", "fatigue 4+", "pain 3/5": the value it reaches. */
function readMeter(seg: string, meters: Record<string, { v: number; rel: boolean }>): boolean {
  const mm = METER.exec(seg.trim());
  const k = mm ? METER_ALIASES[mm[1].toLowerCase()] : undefined;
  if (!mm || !k) {
    // "arousal low", "fatigue high": words for the level.
    const w = /^([a-zA-Z]+)\s*[:=]?\s*(none|low|mild|moderate|medium|high|very high|max(?:imum)?)\b/i.exec(seg.trim());
    const wk = w ? METER_ALIASES[w[1].toLowerCase()] : undefined;
    if (!w || !wk) return false;
    meters[wk] = { v: ({ none: 0, low: 1, mild: 1, moderate: 2, medium: 2, high: 4, "very high": 5, max: 5, maximum: 5 } as Record<string, number>)[w[2].toLowerCase()] ?? 2, rel: false };
    return true;
  }
  const arrow = /→|->|=>|\bto\b/.test(seg);
  meters[k] = { v: parseInt(mm[2], 10), rel: !arrow && /^[+-]/.test(mm[2]) };
  return true;
}

/** Injuries named in plain words inside a body flag. */
const NOUN: [RegExp, string][] = [[/^(wound|stitch)/, "wound"], [/^bruis/, "bruise"], [/^burn/, "burn"], [/^scrap/, "scrape"], [/^graz/, "graze"], [/^stab/, "stab wound"], [/^slash/, "slash"], [/^fractur/, "fracture"], [/^sprain/, "sprain"], [/^bite/, "bite"], [/^cut/, "cut"], [/^gash/, "gash"], [/^lacerat/, "laceration"], [/^blister/, "blister"], [/^welt/, "welt"], [/^punctur/, "puncture"]];

export function injuriesIn(flag: string): { where: string; severity: 1 | 2 | 3 | 4; treated: boolean; note: string }[] {
  // "injuries unchanged (…)" restates, it doesn't add.
  if (NOT_HURT.test(flag.trim()) || /\bunchanged\b|\bno change\b|\bas before\b/i.test(flag)) return [];
  const out: { where: string; severity: 1 | 2 | 3 | 4; treated: boolean; note: string }[] = [];
  for (const part of flag.split(/\s*(?:\+|&|\band\b)\s*/)) {
    const m = INJURY.exec(part);
    if (!m) continue;
    // "hand pressed over his wound", "blood from his wound on her fingers": someone else's wound.
    const lead = part.slice(0, m.index);
    if (/\b(?:his|their|its|[A-Z][\p{L}'’-]+['’]s)\s+(?:[\p{L}-]+\s+)?$/u.test(lead) || /\b(?:over|on|to|at|against|from|near|around|beside|into|onto|across)\s+(?:the\s+|a\s+|his\s+|her\s+|their\s+)?(?:[\p{L}-]+\s+)?$/iu.test(lead)) continue;
    // "bruises fading under his mouth": a part that belongs to someone else is not where the wound is.
    const at = PART.exec(part);
    const p = at && /\b(?:his|their|[A-Z][\p{L}'’-]+['’]s)\s+$/u.test(part.slice(0, at.index)) ? null : at;
    const raw = m[1].toLowerCase();
    const noun = NOUN.find(([re]) => re.test(raw))?.[1] ?? raw.replace(/s$/, "");
    const where = p ? `${(p[1] ?? "").toLowerCase()}${p[2].toLowerCase()}` : noun === "concussion" ? "head" : noun;
    const severity = BAD.test(part) ? 3 : MILD.test(part) ? 1 : 2;
    const care = TENDED.exec(part);
    const treated = !!care && !NOT_YET.test(part.slice(0, care.index));
    out.push({ where, severity, treated, note: part.trim().toLowerCase() });
  }
  return out;
}

/**
 * Care named in a note: "hands bandaged" (that part), "bruises treated" (those), "bandaged" or
 * "Valeria treating" (every wound). Someone else's bandage, or care still needed, is not care.
 */
export function careIn(text: string): { where?: string }[] {
  const out: { where?: string }[] = [];
  for (const part of text.split(/\s*(?:[,;+&·]|\band\b|→|—)\s*/)) {
    const m = CARE.exec(part);
    if (!m) continue;
    const lead = part.slice(0, m.index);
    if (NOT_YET.test(lead)) continue;
    // "hand on his bandaged head", "Gabriel's gauze", "treating Gabriel's head": someone else's.
    if (/[A-Z][\p{L}'’-]+['’]s\s+(?:[\p{L}-]+\s+)?$/u.test(lead) || /\b(?:over|on|to|at|against|from|near|around|beside|into|onto|across)\s+(?:the\s+|a\s+|his\s+|her\s+|their\s+)?(?:[\p{L}-]+\s+)?$/iu.test(lead) || /^\S*\s+(?:him|her|them|[A-Z])/.test(part.slice(m.index))) continue;
    const p = PART.exec(part);
    const noun = INJURY.exec(part)?.[1].toLowerCase();
    const named = noun ? NOUN.find(([re]) => re.test(noun))?.[1] : undefined;
    out.push({ where: p ? `${(p[1] ?? "").toLowerCase()}${p[2].toLowerCase()}` : named && named !== "wound" ? named : undefined });
  }
  return out;
}

function parseCons(p: ParsedOp, s: string, rest: string, kind: "owe" | "cons"): ParsedOp | null {
  if (!s) return null;
  const arrow = splitArrow(s);
  p.subject = arrow ? arrow[0] : s;
  p.object = arrow ? arrow[1] : undefined;
  const { main, cause } = splitCause(rest);
  p.cause = cause;
  const [what, meta = ""] = main.split(/\s*\|\s*/);
  const status = /\b(open|due|paid|broken|healed|resolved|kept|settled)\b/i.exec(meta)?.[1]?.toLowerCase();
  const due = /\bdue\s+([^\]\)]+)/i.exec(meta)?.[1]?.trim() ?? /\[due\s+([^\]]+)\]/i.exec(main)?.[1]?.trim();
  p.args = {
    kind,
    what: what.replace(/\[due[^\]]*\]/i, "").trim(),
    status: status === "kept" || status === "settled" ? "paid" : status ?? "open",
    due,
  };
  return p.args.what ? p : null;
}

// ---------------------------------------------------------------------------
// Scene header, register, artifacts
// ---------------------------------------------------------------------------

const GLYPHS = "☀️|☀|🌙|✨|🌤️|🌤|⛅️|⛅|🌥️|🌥|☁️|☁|🌦️|🌦|🌧️|🌧|⛈️|⛈|🌩️|🌩|🌨️|🌨|❄️|❄|🌫️|🌫|🌬️|🌬|🌪️|🌪|🔥|🧊|🌡️|🌡";

export function parseHeader(text: string): { header: SceneHeader | null; title: string | null } {
  const lines = text.split("\n");
  let header: SceneHeader | null = null;
  let title: string | null = null;
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const l = lines[i].trim();
    if (/^🗓/u.test(l)) {
      header = parseHeaderLine(l);
      const next = lines[i + 1]?.trim() ?? "";
      if (/^📍/u.test(next)) {
        header.place = next.replace(/^📍️?\s*/u, "").split(/\s*(?:›|»|>)\s*/).map((x) => x.trim()).filter(Boolean);
        const t = lines[i + 2]?.trim() ?? "";
        const t2 = lines[i + 3]?.trim() ?? "";
        const tm = /^#{1,3}\s+(.+)$/.exec(t) || (!t ? /^#{1,3}\s+(.+)$/.exec(t2) : null);
        if (tm) title = tm[1].trim();
      }
      break;
    }
    if (!header && /^#{1,3}\s+\S/.test(l) && i < 4) {
      title = l.replace(/^#{1,3}\s+/, "").trim();
      break;
    }
  }
  return { header, title };
}

// The time's glyph: 🕰, or the clock faces and watches models drift to.
const CLOCK = "(?:🕰|[\\u{1F550}-\\u{1F567}]|⏰|⌚|⏱|⏲)\\uFE0F?";

function parseHeaderLine(l: string): SceneHeader {
  const h: SceneHeader = {};
  const day = /Day\s*(\d+)/i.exec(l);
  if (day) h.day = parseInt(day[1], 10);
  const time = new RegExp(`${CLOCK}\\s*(\\d{1,2})[:.](\\d{2})\\s*(AM|PM)?`, "iu").exec(l) || /\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i.exec(l);
  if (time) {
    let hh = parseInt(time[1], 10);
    if (time[3]?.toUpperCase() === "PM" && hh < 12) hh += 12;
    if (time[3]?.toUpperCase() === "AM" && hh === 12) hh = 0;
    h.time = (hh % 24) * 60 + parseInt(time[2], 10);
  }
  const dl = new RegExp(`🗓️?\\s*((?:(?!${CLOCK}).)*)`, "u").exec(l)?.[1]?.replace(/Day\s*\d+\s*·?\s*/i, "").trim();
  if (dl) h.dateLabel = dl.replace(/\s*·\s*$/, "");
  const g = new RegExp(`(${GLYPHS})\\s*([^\\n]*)$`, "u").exec(l.replace(new RegExp(`${CLOCK}\\s*\\d{1,2}[:.]\\d{2}(\\s*[AP]M)?`, "iu"), ""));
  if (g) {
    h.glyph = g[1];
    const w = parseWeatherText(g[2]);
    h.condition = w.condition;
    h.intensity = w.intensity;
    h.tempC = w.tempC;
    h.wind = w.wind;
  }
  return h;
}

export function parseThoughts(text: string): { who: string; slot?: number; cue?: string; text: string; kind?: "register" }[] {
  const out: { who: string; slot?: number; cue?: string; text: string; kind?: "register" }[] = [];
  const block = /<unspoken>([\s\S]*?)(<\/unspoken>|$)/i.exec(text);
  if (!block) return out;
  const re = /<t\s+([^>]*)>([\s\S]*?)<\/t>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block[1]))) {
    const attrs = m[1];
    const who = /who\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? "?";
    const cue = /cue\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
    const [name, slot] = who.split("#");
    out.push({ who: name.trim(), slot: slot ? parseInt(slot, 10) : undefined, cue, text: m[2].trim(), kind: "register" });
  }
  return out;
}

/** Thoughts written inline in the prose (inner voice "prose"): `[thk=Name#N]the thought[/thk]`, ending like the display regex does. */
export function parseInlineThoughts(text: string): { who: string; slot?: number; text: string; kind: "inline" }[] {
  const out: { who: string; slot?: number; text: string; kind: "inline" }[] = [];
  const re = /\[thk=([^\]#|\n]{1,60}?)\s*(?:#(\d{1,2}))?\s*(?:\|\s*[a-z]+[^\]\n]*)?\]([\s\S]*?)(?:\[\/thk\]|(?=\[(?:spk|thk)=)|(?=\n[ \t]*\n)|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const body = m[3].replace(/\[\/?(?:spk|txt)[^\]]*\]/g, "").trim();
    if (body) out.push({ who: m[1].trim(), slot: m[2] ? parseInt(m[2], 10) : undefined, text: body, kind: "inline" });
  }
  return out;
}

export function parseVtks(text: string): { kind: string; title: string; meta: string; body: string }[] {
  const out: { kind: string; title: string; meta: string; body: string }[] = [];
  const re = /\[vtk=([a-z]+)(?:\|([^|\]\n]*))?(?:\|([^\]\n]*))?\]\s*([\s\S]*?)\s*\[\/vtk\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ kind: m[1].toLowerCase(), title: (m[2] ?? "").trim(), meta: (m[3] ?? "").trim(), body: m[4].trim() });
  return out;
}

/**
 * Speech written as a script label — `Buffy#1|flat: "Words."` (also bold,
 * bracketed or without a tone) — instead of the mark `[spk=Buffy#1|flat]"Words."[/spk]`.
 * Matches at the start of a line only; `$3` name, `$4` slot, `$5` tone, `$6` the rest.
 */
export const SPEAKER_LABEL = /(^|\n)([ \t]*)(?:\*\*|__)?\[?([A-Z\u00C0-\u00D6\u00D8-\u00DE?][^\n\[\]#|:*_"\u201C=<>]{0,59}?)[ \t]*#(\d{1,2})[ \t]*(?:\|[ \t]*([a-z]+)[ \t]*)?\]?(?:\*\*|__)?[ \t]*:(?:\*\*|__)?[ \t]*([^\n]*)/g;

/** Rewrites script-label speech into [spk] marks: the quoted line is wrapped (narration before it stays), or the whole rest of the line when it has no quotes. */
export function fixSpeakerLabels(text: string): string {
  if (!/#\d/.test(text)) return text;
  return text.replace(SPEAKER_LABEL, (all, lead: string, ws: string, name: string, slot: string, tone: string | undefined, rest: string) => {
    const mark = `[spk=${name.trim()}#${slot}${tone ? `|${tone}` : ""}]`;
    const q = /(["\u201C][^"\u201C\u201D\n]{1,1200}["\u201D])/.exec(rest);
    if (q) return `${lead}${ws}${rest.slice(0, q.index)}${mark}${q[1]}[/spk]${rest.slice(q.index + q[1].length)}`;
    const words = rest.trim();
    if (!words || /["\u201C\u201D]/.test(words)) return all;
    return `${lead}${ws}${mark}"${words}"[/spk]`;
  });
}

/** True when a reply labels speech as `Name#N|tone:` instead of using [spk] marks. */
export function hasSpeakerLabels(text: string): boolean {
  SPEAKER_LABEL.lastIndex = 0;
  const hit = SPEAKER_LABEL.test(text);
  SPEAKER_LABEL.lastIndex = 0;
  return hit;
}

const QUIET_TONE = /whisper|murmur|breath|hush|sotto|mouth|under/i;

/**
 * Everything said aloud in a message: [spk] lines with their speaker, then
 * plain quotes (the player's messages) with the narration just before each,
 * so the engine can tell who spoke. Out-of-character asides, plans, thoughts,
 * ledgers and filed documents are not speech.
 */
export function parseSpeech(text: string): SpokenLine[] {
  let t = fixSpeakerLabels(text ?? "")
    .replace(/<(ledger|unspoken|plan|think|thinking|ooc|folio)\b[^>]*>[\s\S]*?(<\/\1>|$)/gi, " ")
    .replace(/\[vtk=[^\]]*\][\s\S]*?\[\/vtk\]/gi, " ")
    .replace(/\(\([\s\S]*?\)\)|\[OOC[^\]]*\]|^\s*OOC:.*$/gim, " ");
  const out: SpokenLine[] = [];
  t = t.replace(/\[spk=([^\]#|\n]{1,60}?)\s*(?:#\d{1,2})?\s*(?:\|([^\]]*))?\]([\s\S]*?)\[\/spk\]/g, (_, who: string, tone: string | undefined, body: string) => {
    const words = body.replace(/^\s*["“]|["”]\s*$/g, "").replace(/[*_]/g, "").trim();
    if (words) out.push({ who: who.trim(), text: words, ...(tone && QUIET_TONE.test(tone) ? { quiet: true } : {}) });
    return " ";
  });
  // Double quotes, guillemets, German and CJK quotes; single quotes (British style) only when
  // the text has no double-quoted speech, and only where a quote can't be an apostrophe.
  const DOUBLE = /["“„]([^"“”„\n]{1,600})["”“]|«\s*([^«»\n]{1,600}?)\s*»|»\s*([^«»\n]{1,600}?)\s*«|「([^「」\n]{1,600})」|『([^『』\n]{1,600})』/g;
  const SINGLE = /(?<![\p{L}\p{N}])['‘](?=\S)([^'‘’\n]{1,600}?[^\s'‘’])['’](?![\p{L}\p{N}])/gu;
  const re = DOUBLE.test(t) ? DOUBLE : SINGLE;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(t))) {
    const lead = t.slice(Math.max(last, m.index - 160), m.index);
    const tail = t.slice(m.index + m[0].length, m.index + m[0].length + 60);
    const words = (m.slice(1).find((g) => g != null) ?? "").replace(/[*_]/g, "").trim();
    last = m.index + m[0].length;
    if (!words) continue;
    const quiet = QUIET_TONE.test(`${lead.slice(-40)} ${tail.slice(0, 40)}`);
    out.push({ text: words, lead: lead.split(/\n\s*\n/).pop()!.trim().slice(-120), ...(quiet ? { quiet: true } : {}) });
  }
  return out;
}

/**
 * True when a reply speaks in plain quotes instead of [spk] marks: at least two
 * unmarked lines and more of them than marked ones (a stray scare quote in a
 * marked reply doesn't count). Once one reply drops the marks the next copies it.
 */
export function hasUnmarkedSpeech(text: string): boolean {
  const lines = parseSpeech(text);
  const marked = lines.filter((l) => l.who).length;
  const plain = lines.length - marked;
  return plain >= 2 && plain > marked;
}

export function parseSpeakers(text: string): { name: string; slot?: number }[] {
  text = fixSpeakerLabels(text);
  const seen = new Map<string, { name: string; slot?: number }>();
  const re = /\[(?:spk|thk)=([^\]#|\n]{1,60}?)\s*(?:#(\d{1,2}))?\s*(?:\|[^\]]*)?\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const name = m[1].trim();
    if (!name || name === "?") continue;
    const k = name.toLowerCase();
    if (!seen.has(k)) seen.set(k, { name, slot: m[2] ? parseInt(m[2], 10) : undefined });
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// Whole message
// ---------------------------------------------------------------------------

function parseJsonLedger(body: string): { ops: ParsedOp[]; unknown: string[] } {
  const ops: ParsedOp[] = [];
  const unknown: string[] = [];
  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    return { ops, unknown: [body.slice(0, 200)] };
  }
  const lines: string[] = [];
  const walk = (v: any) => {
    if (typeof v === "string") lines.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      if (typeof v.op === "string") {
        const subj = [v.subject ?? v.name ?? v.who, v.object ? `>${v.object}` : ""].filter(Boolean).join("");
        lines.push(`${v.op}${subj ? " " + subj : ""}: ${v.value ?? v.text ?? v.detail ?? ""}${v.cause ? " — " + v.cause : ""}`);
      } else {
        for (const [k, val] of Object.entries(v)) {
          if (OP_ALIASES[k.toLowerCase()] && (typeof val === "string" || typeof val === "number")) lines.push(`${k}: ${val}`);
          else walk(val);
        }
      }
    }
  };
  walk(data);
  for (const l of lines) {
    const op = parseLine(l);
    if (op) ops.push(op);
    else unknown.push(l);
  }
  return { ops, unknown };
}

export function parseMessage(text: string): ParsedLedger {
  const block = extractLedgerBlock(text ?? "");
  const { header, title } = parseHeader(text ?? "");
  const result: ParsedLedger = {
    ops: [],
    unknown: [],
    format: block ? block.format : "none",
    truncated: block?.truncated ?? false,
    header,
    title,
    thoughts: [...parseThoughts(text ?? ""), ...parseInlineThoughts(text ?? "")],
    vtks: parseVtks(text ?? ""),
    speakers: parseSpeakers(text ?? ""),
    speech: parseSpeech(text ?? ""),
  };
  if (!block) return result;
  if (block.format === "json") {
    const j = parseJsonLedger(block.body);
    result.ops = j.ops;
    result.unknown = j.unknown;
  } else {
    for (const line of block.body.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const op = parseLine(line);
      if (op) result.ops.push(op);
      else result.unknown.push(line.trim());
    }
  }
  return result;
}

const KNOW_LINE = /^[ \t]*(?:[-*•]\s+)?(?:know|knows|knowledge|belief|reveal|reveals|revealed|tell|told|disclose|secret|secrets|hidden|unaware|lacks|ignorant)\b[^:\n]*:[^\n]*\n?/gim;

/**
 * Replace the knowledge lines of a reply's ledger with the lines as the Almanac
 * filed them. The model copies the last ledger it sees, so a diary-style `know`
 * line left in the history teaches the next reply to write another one.
 */
export function rewriteKnowledgeLines(text: string, filed: string[] | undefined): string {
  const block = /<ledger>([\s\S]*?)<\/ledger>/i.exec(text);
  if (!block) return text;
  const body = block[1];
  KNOW_LINE.lastIndex = 0;
  const first = KNOW_LINE.exec(body);
  if (!first) return text;
  KNOW_LINE.lastIndex = 0;
  const rest = body.replace(KNOW_LINE, "");
  const insert = (filed ?? []).map((l) => `${l}\n`).join("");
  const at = first.index;
  const next = `${rest.slice(0, at)}${insert}${rest.slice(at)}`;
  return text.slice(0, block.index) + `<ledger>${next}</ledger>` + text.slice(block.index + block[0].length);
}

/** Serialise ops back into DSL (used for repair output, examples and exports). */
export function formatOp(op: ParsedOp): string {
  return op.raw || `${op.op}${op.subject ? " " + op.subject : ""}: …`;
}
