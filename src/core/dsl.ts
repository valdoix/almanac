// Parser for the ALMANAC <ledger> delta language, the scene header, the Unspoken
// register and filed artifacts. Tolerant by design: models fence, escape,
// bullet and misspell; we normalise first and keep what we can't read.

import type { OpName, ParsedLedger, ParsedOp, SceneHeader } from "./types";
import { unescapeHtml } from "./util";

const OP_ALIASES: Record<string, OpName> = {
  clock: "clock", time: "clock", elapsed: "clock",
  wx: "wx", weather: "wx",
  at: "at", place: "at", location: "at", loc: "at", where: "at",
  cast: "cast", present: "cast", who: "cast",
  mood: "mood", emotion: "mood", feel: "mood",
  body: "body", state: "body", condition: "body",
  look: "look", appearance: "look", outfit: "look",
  bond: "bond", rel: "bond", relationship: "bond", regard: "bond",
  ladder: "ladder", romance: "ladder",
  know: "know", knows: "know", knowledge: "know", belief: "know",
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
};

/** Ops whose name sits before the colon: `mood Mara: …`. */
const SUBJECT_OPS = new Set<OpName>([
  "mood", "body", "look", "bond", "ladder", "know", "item", "thread", "owe", "cons",
  "clockf", "rep", "journal", "keys", "artifact", "status", "gauge", "deadline",
]);

export const SCENE_MODES = ["social", "intimacy", "conflict", "investigation", "travel", "stealth", "downtime", "crisis"] as const;

const AXIS_ALIASES: Record<string, string> = {
  trust: "trust", distrust: "trust",
  affection: "affection", fondness: "affection", love: "affection", warmth: "affection",
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

export function parseLine(rawLine: string): ParsedOp | null {
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
    return PARSERS[op](base, subject, rest) ?? null;
  } catch {
    return null;
  }
}

type LineParser = (p: ParsedOp, subject: string, rest: string) => ParsedOp | null;

function parseClockSpec(s: string): Record<string, any> | null {
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
    const now = arrow ? arrow[1] : rest;
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
    const [emo, vad] = rest.split("|").map((x) => x.trim());
    const arrow = splitArrow(emo);
    p.args = { name: (arrow ? arrow[1] : emo).trim(), prev: arrow?.[0] };
    if (vad) {
      const v = /V\s*([+-]?\d)/i.exec(vad);
      const a = /A\s*([+-]?\d)/i.exec(vad);
      const d = /D\s*([+-]?\d)/i.exec(vad);
      if (v) p.args.v = parseInt(v[1], 10);
      if (a) p.args.a = parseInt(a[1], 10);
      if (d) p.args.d = parseInt(d[1], 10);
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
    for (const seg0 of main.split(/\s*;\s*/)) {
      const seg = seg0.trim();
      if (!seg) continue;
      const inj = /^(?:injury|injured|wound|hurt)\s*:?\s*(.+)$/i.exec(seg);
      if (inj) {
        const parts = inj[1].split(/\s*,\s*/);
        const where = parts[0] ?? "body";
        let severity: 1 | 2 | 3 | 4 = 2;
        let treated = false;
        for (const x of parts.slice(1)) {
          const k = x.toLowerCase().trim();
          if (SEVERITY[k]) severity = SEVERITY[k];
          if (/bandag|treat|stitch|splint|dress|clean/.test(k)) treated = true;
        }
        injuries.push({ where, severity, treated, note: parts.slice(1).join(", ") });
        continue;
      }
      const heal = /^(?:heal(?:ed)?|healed)\s*:?\s*(.+)$/i.exec(seg);
      if (heal) {
        heals.push(heal[1].trim());
        continue;
      }
      const mm = /^([a-zA-Z]+)\s*[:=]?\s*([+-]?\d+)(?:\s*\/\s*5)?$/.exec(seg);
      if (mm && METER_ALIASES[mm[1].toLowerCase()]) {
        meters[METER_ALIASES[mm[1].toLowerCase()]] = { v: parseInt(mm[2], 10), rel: /^[+-]/.test(mm[2]) };
        continue;
      }
      for (const f of seg.split(/\s*,\s*/)) {
        const ff = f.trim();
        if (!ff) continue;
        if (ff.startsWith("-") || ff.startsWith("no longer ")) unflags.push(ff.replace(/^-|^no longer /, "").trim().toLowerCase());
        else if (/^(dead|died|killed)$/i.test(ff)) flags.push("dead");
        else flags.push(ff.replace(/^\+/, "").toLowerCase());
      }
    }
    p.args = { meters, flags, unflags, injuries, heals };
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
    const re = /([a-zA-Z]+)\s*([+\-−]\s*\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(main))) {
      const axis = AXIS_ALIASES[m[1].toLowerCase()];
      if (!axis) continue;
      changes.push({ axis, delta: parseInt(m[2].replace(/\s|−/g, (c) => (c === "−" ? "-" : "")), 10) });
    }
    const label = /label\s*[:=]\s*["“]?([^"”]+)["”]?/i.exec(main)?.[1];
    const tags = /tags?\s*[:=]\s*([\w ,-]+)/i.exec(main)?.[1]?.split(/\s*,\s*/).filter(Boolean);
    if (!changes.length && !label && !tags) {
      if (main && !/\d/.test(main)) p.args = { label: main.replace(/^["“]|["”]$/g, "") };
      else return null;
    } else p.args = { changes, label, tags };
    return p;
  },
  ladder(p, s, rest) {
    const pair = splitArrow(s);
    if (!pair) return null;
    p.subject = pair[0];
    p.object = pair[1];
    const { main, cause } = splitCause(rest);
    p.cause = cause;
    const t = /(?:tier|step|rung)?\s*([+-]?\d)/i.exec(main);
    if (!t) return null;
    p.args = { tier: parseInt(t[1], 10), rel: /^[+-]/.test(t[1]) };
    return p;
  },
  know(p, s, rest) {
    if (!s) return null;
    p.subject = s;
    const [fact, meta = ""] = rest.split(/\s*\|\s*/);
    if (!fact) return null;
    const bits = meta.split(/\s*[·,;]\s*/).map((x) => x.trim()).filter(Boolean);
    let status = "knows";
    let truth = "unknown";
    let source: string | undefined;
    const norm = (w: string) => {
      const st = w.replace(/s$/, "").replace(/^know$/, "knows").replace(/^believe$/, "believes").replace(/^suspect$/, "suspects").replace(/^doubt$/, "doubts").replace(/^denie$/, "doubts");
      return ["knows", "believes", "suspects", "wrong", "unaware", "doubts"].includes(st) ? st : "believes";
    };
    const note = (x: string) => (source = source ? `${source}, ${x}` : x);
    for (const raw of bits) {
      const b = raw.toLowerCase();
      const lead = /^(knows?|believes?|suspects?|doubts?)\s+(?:that\s+)?(.+)$/i.exec(raw);
      if (/^(knows?|believes?|suspects?|wrong|unaware|doubts?|denies)$/.test(b)) status = norm(b);
      else if (/^(true|false|partial|unknown|half-true|mixed)$/.test(b)) truth = b === "half-true" || b === "mixed" ? "partial" : b;
      else if (lead) {
        // "suspects it was Kael" → status suspects, note "it was Kael"
        status = norm(lead[1].toLowerCase());
        note(lead[2]);
      } else note(raw); // free text is a note (keeps its case)
    }
    if (status === "wrong" && truth === "unknown") truth = "false";
    p.args = { fact: fact.trim(), status, truth, source };
    p.cause = source;
    return p;
  },
  item(p, s, rest) {
    if (!s) return null;
    const q = /\s*[x×]\s*(\d+)\s*$/.exec(s);
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
    const m = /^(new|open|advance[sd]?|complicate[sd]?|bridge[sd]?|resolve[sd]?|close[sd]?|stall(?:ed|s)?)\s*(?:\((.*)\))?\s*(.*)$/i.exec(main);
    if (!m) {
      p.args = { op: "advance", detail: main || cause };
      p.cause = cause ?? main;
      return p;
    }
    let op = m[1].toLowerCase().replace(/(ed|s|d)$/, "");
    if (op === "open") op = "new";
    if (op === "close") op = "resolve";
    if (op === "advanc") op = "advance";
    if (op === "complicat") op = "complicate";
    if (op === "resolv") op = "resolve";
    if (op === "stal") op = "stall";
    if (!["new", "advance", "complicate", "bridge", "resolve", "stall"].includes(op)) op = "advance";
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
  forecast: () => null,
  pressure: () => null,
  diverge: () => null,
  entity: () => null,
  lock: () => null,
};

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

function parseHeaderLine(l: string): SceneHeader {
  const h: SceneHeader = {};
  const day = /Day\s*(\d+)/i.exec(l);
  if (day) h.day = parseInt(day[1], 10);
  const time = /🕰️?\s*(\d{1,2})[:.](\d{2})\s*(AM|PM)?/iu.exec(l) || /\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i.exec(l);
  if (time) {
    let hh = parseInt(time[1], 10);
    if (time[3]?.toUpperCase() === "PM" && hh < 12) hh += 12;
    if (time[3]?.toUpperCase() === "AM" && hh === 12) hh = 0;
    h.time = (hh % 24) * 60 + parseInt(time[2], 10);
  }
  const dl = /🗓️?\s*([^🕰]*)/u.exec(l)?.[1]?.replace(/Day\s*\d+\s*·?\s*/i, "").trim();
  if (dl) h.dateLabel = dl.replace(/\s*·\s*$/, "");
  const g = new RegExp(`(${GLYPHS})\\s*([^\\n]*)$`, "u").exec(l.replace(/🕰️?\s*\d{1,2}[:.]\d{2}(\s*[AP]M)?/iu, ""));
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

export function parseThoughts(text: string): { who: string; slot?: number; cue?: string; text: string }[] {
  const out: { who: string; slot?: number; cue?: string; text: string }[] = [];
  const block = /<unspoken>([\s\S]*?)(<\/unspoken>|$)/i.exec(text);
  if (!block) return out;
  const re = /<t\s+([^>]*)>([\s\S]*?)<\/t>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block[1]))) {
    const attrs = m[1];
    const who = /who\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? "?";
    const cue = /cue\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
    const [name, slot] = who.split("#");
    out.push({ who: name.trim(), slot: slot ? parseInt(slot, 10) : undefined, cue, text: m[2].trim() });
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
    thoughts: parseThoughts(text ?? ""),
    vtks: parseVtks(text ?? ""),
    speakers: parseSpeakers(text ?? ""),
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

/** Serialise ops back into DSL (used for repair output, examples and exports). */
export function formatOp(op: ParsedOp): string {
  return op.raw || `${op.op}${op.subject ? " " + op.subject : ""}: …`;
}
