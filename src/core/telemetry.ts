// Craft Telemetry (anti-slop layer 5): measure the last replies and turn the
// worst habits into three concrete avoids plus one positive technique. Also
// genre delivery (is the lead genre's instrument moving?) and agency flags.

import type { WorldState } from "./types";
import { plainProse } from "./util";

export interface CraftReport {
  avoids: string[];
  technique: string;
  metrics: Record<string, number | string>;
  repeated: { phrase: string; count: number }[];
  agency: string[];
  openings: string[];
}

const FILTER = /\b(seemed|seems|felt|feels|feel|realized|realised|noticed|notices|as if|as though|couldn't help but|found (her|him|them)self)\b/gi;
const NOT_BUT = /\bnot\s+(?:just\s+|only\s+|merely\s+)?[\w' -]{1,40}?,?\s+but\s+/gi;
const STOCK = [
  "a beat passed", "for a long moment", "the world narrowed", "something shifted", "ozone", "petrichor", "let out a breath",
  "breath (she|he|they) didn't know", "a smile tugged", "eyes darkened", "jaw tightened", "ministrations", "pupils blown",
  "voice like velvet", "gravel", "the air grew thick", "electric", "a mix of", "unreadable expression", "barely above a whisper",
  "sent shivers", "heart hammered", "for what felt like", "the weight of", "hung in the air", "palpable",
];

const TECHNIQUES = [
  "Open mid-action, in the middle of a gesture already under way.",
  "Let one line of dialogue do the work of a paragraph of description.",
  "Give a detail only this place could have, and let a character use it.",
  "End on a concrete object or sound, not a feeling.",
  "Let someone misunderstand something in a way that fits who they are.",
  "Cut the first sentence you wrote; start with the second.",
  "Use one long sentence among short ones where the tension peaks.",
  "Put the subtext in what someone does with their hands, and never explain it.",
  "Let a minor character want something unrelated to the plot.",
  "Replace one adjective with a verb.",
];

function ngrams(words: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + n <= words.length; i++) out.push(words.slice(i, i + n).join(" "));
  return out;
}

function openingClass(p: string): string {
  const s = p.trim().slice(0, 140).toLowerCase();
  if (/^["“]/.test(s)) return "dialogue";
  if (/\b(rain|wind|snow|sun|sky|fog|mist|clouds?|storm|weather|cold|heat)\b/.test(s.split(/[.!?]/)[0])) return "weather";
  if (/^(her|his|their|my) (eyes|hands?|fingers|jaw|lips|mouth|gaze|breath|heart)\b/.test(s)) return "body part";
  if (/^(the|a|an) (morning|night|evening|hour|minutes?|moment|day|silence)\b|^(minutes|hours|moments) later/.test(s)) return "time";
  if (/^(she|he|they|i|[a-z]+) (walk|turn|step|move|reach|push|pull|open|close|slam|pick|set|drop|lean)/.test(s)) return "action";
  return "other";
}

export function craftReport(replies: string[], opts: { userName: string; sealed: boolean; dialogue?: string }): CraftReport {
  const texts = replies.slice(-6).map(plainProse).filter(Boolean);
  const metrics: Record<string, number | string> = {};
  if (!texts.length) return { avoids: [], technique: TECHNIQUES[0], metrics, repeated: [], agency: [], openings: [] };
  const all = texts.join("\n\n");
  const words = all.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, " ").split(/\s+/).filter(Boolean);
  const wc = Math.max(1, words.length);

  // Repeated 3–5-grams across replies (count once per reply)
  const counts = new Map<string, number>();
  for (const t of texts) {
    const w = t.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, " ").split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    for (const n of [5, 4, 3]) for (const g of ngrams(w, n)) {
      if (seen.has(g)) continue;
      if (/^(the|a|and|of|to|in|on|at|it|is|was|he|she|they|i|you)\b.*\b(the|a|and|of|to|in)$/.test(g)) continue;
      if (g.split(" ").filter((x) => x.length > 3).length < 2) continue;
      seen.add(g);
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  let repeated = [...counts.entries()].filter(([, c]) => c >= 2).map(([phrase, count]) => ({ phrase, count }));
  repeated = repeated.filter((r) => !repeated.some((o) => o !== r && o.phrase.includes(r.phrase) && o.count >= r.count));
  repeated.sort((a, b) => b.count - a.count || b.phrase.length - a.phrase.length);

  const openings = texts.map((t) => openingClass(t));
  const openCounts = openings.reduce<Record<string, number>>((m, o) => ((m[o] = (m[o] ?? 0) + 1), m), {});
  const filter = (all.match(FILTER) ?? []).length;
  const notBut = (all.match(NOT_BUT) ?? []).length;
  const dashes = (all.match(/—/g) ?? []).length;
  const threes = (all.match(/\b\w+, \w+(?: \w+)?,? and \w+\b/g) ?? []).length;
  const quoted = (all.match(/["“][^"”]{2,}["”]/g) ?? []).join(" ").split(/\s+/).length;
  const paras = texts.map((t) => t.split(/\n\s*\n/).filter((p) => p.trim()).length);
  const shortParas = texts.map((t) => t.split(/\n\s*\n/).filter((p) => p.trim() && p.trim().split(/\s+/).length < 12).length);
  const stock = STOCK.map((s) => ({ s, n: (all.toLowerCase().match(new RegExp(s, "g")) ?? []).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const closers = texts.filter((t) => {
    const last = t.trim().split(/\n/).pop() ?? "";
    return /\?\s*$/.test(last) || /\b(what (will|would) (you|she|he) do|and yet|somehow|perhaps that was enough|for now, that was enough)\b/i.test(last);
  }).length;

  metrics.words = wc;
  metrics.filterPer1k = Math.round((filter / wc) * 1000 * 10) / 10;
  metrics.notBut = notBut;
  metrics.emDashPer1k = Math.round((dashes / wc) * 1000 * 10) / 10;
  metrics.ruleOfThree = threes;
  metrics.dialogueRatio = Math.round((quoted / wc) * 100);
  metrics.avgParagraphs = Math.round((paras.reduce((a, b) => a + b, 0) / paras.length) * 10) / 10;
  metrics.microParagraphs = shortParas.reduce((a, b) => a + b, 0);
  metrics.questionClosers = closers;

  const avoids: { text: string; weight: number }[] = [];
  for (const r of repeated.slice(0, 3)) avoids.push({ text: `“${r.phrase}” (${r.count}× in the last ${texts.length})`, weight: 3 + r.count });
  const [topOpen, topN] = Object.entries(openCounts).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  if (topOpen && topOpen !== "other" && topN >= 3) avoids.push({ text: `opening on ${topOpen} (${topN}/${texts.length})`, weight: 4 + topN });
  if ((metrics.filterPer1k as number) > 6) avoids.push({ text: `filter words (seemed/felt/noticed: ${filter})`, weight: 4 });
  if (notBut >= 2) avoids.push({ text: `“not X but Y” framing (${notBut}×)`, weight: 3 + notBut });
  if ((metrics.emDashPer1k as number) > 12) avoids.push({ text: "em-dash pauses", weight: 3 });
  if (threes >= 4) avoids.push({ text: "lists of three", weight: 3 });
  if (closers >= 2) avoids.push({ text: "closing on a question or aphorism", weight: 5 });
  if ((metrics.microParagraphs as number) > texts.length * 4) avoids.push({ text: "cascades of one-line paragraphs", weight: 3 });
  for (const s of stock.slice(0, 2)) avoids.push({ text: `“${s.s}”`, weight: 2 + s.n });
  avoids.sort((a, b) => b.weight - a.weight);

  // Agency flags (Sealed / Continuity)
  const agency: string[] = [];
  if (opts.sealed && opts.userName) {
    const u = opts.userName.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const last = texts[texts.length - 1] ?? "";
    const mental = new RegExp(`\\b${u}\\s+(felt|thought|decided|wanted|realized|realised|knew|wondered|hoped|feared|loved|hated|smiled|laughed|agreed|nodded)\\b`, "i");
    if (mental.test(last)) agency.push(`the last reply wrote ${opts.userName}'s inner state or reaction`);
    if (new RegExp(`\\[spk=${u}\\b`, "i").test(replies[replies.length - 1] ?? "")) agency.push(`the last reply gave ${opts.userName} a line of dialogue`);
  }
  const target = opts.dialogue === "sparse" ? [5, 25] : opts.dialogue === "dense" ? [40, 80] : opts.dialogue === "dialogue-forward" ? [30, 70] : null;
  if (target && ((metrics.dialogueRatio as number) < target[0] || (metrics.dialogueRatio as number) > target[1])) {
    avoids.push({ text: `dialogue share ${metrics.dialogueRatio}% (setting wants ${target[0]}–${target[1]}%)`, weight: 2 });
  }

  const technique = TECHNIQUES[(texts.length + wc) % TECHNIQUES.length];
  return { avoids: avoids.slice(0, 3).map((a) => a.text), technique, metrics, repeated: repeated.slice(0, 8), agency, openings };
}

const GENRE_INSTRUMENT: Record<string, { key: string; label: string }> = {
  mystery: { key: "mystery", label: "no clue has moved" },
  romance: { key: "romance", label: "the tension ladder hasn't moved" },
  thriller: { key: "thriller", label: "the countdown and the opposition have been quiet" },
  horror: { key: "horror", label: "dread hasn't risen" },
  comedy: { key: "comedy", label: "no setup or callback has landed" },
  "dark fantasy": { key: "dark_fantasy", label: "corruption hasn't been tested" },
  dark_fantasy: { key: "dark_fantasy", label: "corruption hasn't been tested" },
  "political intrigue": { key: "intrigue", label: "no leverage has changed hands" },
  intrigue: { key: "intrigue", label: "no leverage has changed hands" },
  survival: { key: "survival", label: "needs and resources haven't been pressed" },
  tragedy: { key: "tragedy", label: "the fatal flaw hasn't been pressed" },
};

/** "[GENRE] Mystery: no clue has moved for 3 turns." — only after 3 silent assistant turns. */
export function genreNudge(state: WorldState, leadGenre: string | undefined, assistantIdx: number[]): string | null {
  if (!leadGenre) return null;
  const g = GENRE_INSTRUMENT[leadGenre.toLowerCase()];
  if (!g) return null;
  const last = state.genreHits[g.key] ?? -1;
  const silent = assistantIdx.filter((i) => i > last).length;
  if (silent < 3) return null;
  return `${leadGenre[0].toUpperCase()}${leadGenre.slice(1)}: ${g.label} for ${silent} turns.`;
}
