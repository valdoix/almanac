// Heuristic extractor: the last resort when a reply has no ledger and the repair
// call fails. Mines clock phrases, arrivals/departures, and gives/takes. Every
// op it emits is low confidence (0.6) and the turn is marked unverified.

import type { ParsedOp } from "./types";
import { parseLine } from "./dsl";
import { plainProse } from "./util";

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, several: 3, few: 3 };

export function extractOps(reply: string, knownNames: string[], userName: string): ParsedOp[] {
  const text = plainProse(reply);
  const ops: ParsedOp[] = [];
  const add = (line: string) => {
    const op = parseLine(line);
    if (op) ops.push(op);
  };
  // Time passing
  const t = /\b(a|an|one|two|three|four|five|six|ten|fifteen|twenty|thirty|forty|several|few|\d+)\s+(minutes?|hours?)\s+(later|pass(?:es|ed)?|go by|went by)\b/i.exec(text);
  if (t) {
    const n = NUM[t[1].toLowerCase()] ?? parseInt(t[1], 10);
    add(`clock: +${n}${t[2].startsWith("h") ? "h" : "m"}`);
  } else if (/\b(the next morning|by morning|at dawn the next day)\b/i.test(text)) add("clock: +8h");
  else if (/\b(that evening|by evening|as night fell)\b/i.test(text)) add("clock: +3h");
  else add("clock: +5m");

  const names = knownNames.filter((n) => n && n.toLowerCase() !== userName.toLowerCase());
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cast: string[] = [];
  for (const n of names) {
    const re = new RegExp(`\\b${esc(n)}\\b[^.]{0,40}\\b(leaves|left|walks out|storms out|slips out|goes out|departs)\\b`, "i");
    const re2 = new RegExp(`\\b${esc(n)}\\b[^.]{0,40}\\b(arrives|walks in|comes in|enters|steps in|appears)\\b`, "i");
    if (re.test(text)) cast.push(`${n}@left`);
    else if (re2.test(text)) cast.push(`${n}@arrive`);
  }
  if (cast.length) add(`cast: ${cast.join(" · ")}`);
  for (const n of [...names, userName]) {
    const give = new RegExp(`\\b${esc(n)}\\b\\s+(?:hands|gives|passes|slides|tosses)\\s+(?:\\w+\\s+){0,2}?(?:the|a|an|her|his|their)\\s+([a-z][a-z -]{2,30}?)\\s+(?:to|over to)\\s+([A-Z][\\p{L}'-]+)`, "iu");
    const g = give.exec(text);
    if (g) add(`item ${g[1].trim()}: ${n} → ${g[2]} — handed over`);
  }
  return ops;
}
