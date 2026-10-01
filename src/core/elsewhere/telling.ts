// Telling (design/09 §9): one quiet call dresses the tick's beat cards in the story's own words.
// The engine has already decided who, where, when and how it turned out; the model writes a
// sentence and a few knowledge lines inside the card, and a validator checks every one. A card
// that fails is told by the engine's template instead: the mechanics stand either way.

import { parseLine } from "../dsl";
import { offPageHits, type OffPage } from "../offpage";
import { normFact, overlap } from "../state";
import { SAFETY_DATA } from "../prompts";
import { fmtTime, fromAbs } from "../util";
import type { BeatCard } from "./storyteller";
import type { Profile, Roster, Reach } from "./roster";
import type { Standing } from "../types";

export interface TellingCtx {
  userName: string;
  roster: Roster;
  offPage: OffPage[];
  truths: string[];
  lang?: string;
  /** The last few beats' wording (novelty). */
  recent: string[];
  /** Known places and objects (names a beat may use). */
  places: string[];
  objects: string[];
  /** A Dream Weaver world's holds: lines nothing breaks. */
  holds?: string[];
  /** People to profile (standing, whereabouts) while we're asking anyway. */
  profile?: { key: string; name: string; text: string }[];
}

const RESULT_WORD: Record<string, string> = {
  win: "WIN (they got what they were after this time)", cost: "COST (they got it, and paid)", loss: "LOSS (it didn't work, and something got worse)",
  met: "ENDING: MET (the want is met)", price: "ENDING: AT A PRICE (met, but it cost)", lost: "ENDING: LOST (the fear came true)", softened: "ENDING: SOFTENED (it nearly went badly, but not quite)",
};

function cardText(c: BeatCard, ctx: TellingCtx): string {
  if (c.seed) {
    return `SEED ${c.id} · new subplot · ${c.kind} · lead ${c.lead}${c.cast.length ? ` · with ${c.cast.join(", ")}` : ""}
  WHO ${c.lead}: ${c.leadText.slice(0, 220) || "—"}
  GROUNDS ${c.grounds.join(" · ")}
  DRAFT premise: ${c.premise} | want: ${c.want} | fear: ${c.fear}
  WRITE a premise (≤ 30 words) from the grounds only, a want ("to …", ≤ 12 words) and a fear (≤ 12 words).`;
  }
  return `CARD ${c.id} · ${c.kind} · ${c.ending ? "ending" : `beat ${c.clock} · ${c.stage}`} · roll ${c.roll[0]}+${c.roll[1]}${c.mod ? ` ${c.mod > 0 ? "+" : "-"}${Math.abs(c.mod)}` : ""} → ${RESULT_WORD[c.result]}${c.price ? ` (price: ${c.price})` : ""}${c.worse ? ` (worse: ${c.worse})` : ""}${c.twist ? ` · twist: ${c.twist}` : ""}
  LEAD ${c.lead}: ${c.leadText.slice(0, 200) || "—"}
  SUBPLOT ${c.premise} · wants ${c.want} · fears ${c.fear}
  CAST ${c.cast.join(", ") || "—"} · WHERE ${c.where ?? "—"} · WHEN ${fmtTime(fromAbs(c.atAbs))}
  KNOWS ${c.knows.join("; ") || "—"}${c.noRoute.length ? ` · NO ROUTE TO ${c.noRoute.join(", ")} (can't act on it)` : ""}
  ENGINE DRAFT ${c.template}${c.arrival ? `\n  REACHES THE SCENE AS (${c.arrivalKind}) ${c.arrival}` : ""}`;
}

export function tellingPrompt(cards: BeatCard[], ctx: TellingCtx): { system: string; user: string } {
  const never = [...new Set(ctx.offPage.flatMap((o) => o.words))];
  const prof = ctx.profile?.length
    ? `\nAlso PROFILE each person listed under PROFILES from their text only: {"key","standing":"here|away|captive|changed|dead|companion|construct","where":"the place they are now, or empty","reach":"town|region|far","want":"to …","fear":"…","nocturnal":true|false}.`
    : "";
  return {
    system: `You tell what happened off the page in a roleplay, between two story times. ${SAFETY_DATA}
Each CARD is already decided: who, where, when, and how it turned out. Tell it as ONE plain past-tense sentence (at most 40 words) of what happened, in the story's language. Keep the outcome exactly. Use only what the card gives; add no events, no past history, no new named people (anyone else is unnamed: "a clerk", "a neighbour"). Name only the card's LEAD and CAST, and places it names. Never decide anything ${ctx.userName} does, says, thinks or knows; ${ctx.userName} may only receive something (a call, a letter). Nothing irreversible (a death, a permanent departure, a marriage, a child, a lasting injury) unless the card is an ENDING marked "may be told".${never.length ? ` Never write these words: ${never.join(", ")}.` : ""}
For a card with REACHES THE SCENE, also write "arrival": how it reaches the scene, at most 30 words, in-world.
You may add up to two ledger "lines" per card for the LEAD and CAST only: "know Name: #key fact | how they learned it · knows/believes", "bond A>B: trust +1 — cause", "journal Name: their own words".
Each SEED asks for a premise, want and fear for a new subplot, from its GROUNDS only.${cards.some((c) => c.kind === "world") ? `\nA "world" card is the setting's own agenda, an actor too: tell it through consequences in the world (a move, a cost, a changed place), never by announcing it. Lines under HOLDS never break; pressure may strain them, nothing breaks them.${ctx.holds?.length ? ` HOLDS: ${ctx.holds.join(" / ")}` : ""}` : ""}${prof}
Output JSON only: {"beats":[{"card":"b3","result":"cost","text":"…","arrival":"…","lines":["…"]}],"seeds":[{"card":"b2","premise":"…","want":"to …","fear":"…"}]${ctx.profile?.length ? `,"profiles":[{"key":"…","standing":"…","where":"…","reach":"…","want":"…","fear":"…","nocturnal":false}]` : ""}}${ctx.lang && !/^en/i.test(ctx.lang) ? `\nWrite the text in ${ctx.lang}; keep the JSON field names, op names and card ids in English.` : ""}`,
    user: `${ctx.truths.length ? `[TRUTHS] (the player's rules; they bind off the page too) ${ctx.truths.join(" · ")}\n\n` : ""}${cards.map((c) => cardText({ ...c, result: c.result }, ctx) + (c.ending && c.fateOk ? "\n  (may be told: the player allowed this ending)" : "")).join("\n\n")}${ctx.profile?.length ? `\n\nPROFILES\n${ctx.profile.map((p) => `[${p.key}] ${p.name}: ${p.text.slice(0, 400)}`).join("\n")}` : ""}`,
  };
}

export interface Told {
  text?: string;
  arrival?: string;
  lines: string[];
  seed?: { premise: string; want: string; fear: string };
  rejected?: string;
}

const IRREVERSIBLE = /\b(died|dies|killed|dead|murdered|suicide|overdosed|married|wedding vows|pregnan\w*|gave birth|left (?:town|for good) forever|maimed|paralys\w*|lost (?:an? )?(?:arm|leg|eye|hand))\b/i;
const VERBISH = /^(?:\w+ly\s+)?(?:said|says|did|does|went|goes|decided|decides|felt|feels|thought|thinks|knew|knows|asked|asks|told|tells|agreed|agrees|refused|refuses|took|takes|gave|gives|kissed|kisses|walked|walks|ran|runs|looked|looks|smiled|smiles|called|calls|answered|answers|replied|replies|promised|promises|wanted|wants|chose|chooses|left|leaves|came|comes|met|meets|found|finds|saw|sees|heard|hears|realized|realised|learned|learnt|was|is|had|has|would|will|could|can|should|must|might)\b/i;

/** The capitalised names a sentence uses (not its first word). */
function capNames(text: string): string[] {
  const out: string[] = [];
  for (const s of text.split(/(?<=[.!?;:—])\s+|\s+[—–-]\s+|["“”(]/)) {
    const toks = s.trim().split(/\s+/);
    for (let i = 1; i < toks.length; i++) {
      const w = toks[i].replace(/^[^\p{L}]+|[^\p{L}'’-]+$/gu, "").replace(/['’]s$/, "");
      if (/^\p{Lu}[\p{L}'’-]+$/u.test(w) && !/^(I|I'm|I'd|A|An|The|He|She|They|It|We|You|His|Her|Their|Its|God|Day|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|Mr|Mrs|Ms|Dr|Sir|Ser|Lady|Lord|King|Queen|Prince|Princess)$/.test(w)) out.push(w);
    }
  }
  return out;
}

export function validateTold(c: BeatCard, raw: { text?: string; result?: string; arrival?: string; lines?: unknown }, ctx: TellingCtx): Told {
  const fail = (why: string): Told => ({ lines: [], rejected: why });
  const text = String(raw.text ?? "").trim();
  if (!text) return fail("no text");
  if (raw.result && String(raw.result).toLowerCase() !== String(c.result)) return fail(`told as ${raw.result}, decided ${c.result}`);
  const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
  if (wc(text) > 55) return fail("too long");
  const arrival = raw.arrival ? String(raw.arrival).trim() : undefined;
  if (arrival && wc(arrival) > 45) return fail("arrival too long");
  // People: only the card's lead and cast; places and objects the story knows.
  const allowed = new Set<string>();
  const addNames = (n: string) => n.split(/\s+/).forEach((w) => allowed.add(w.toLowerCase().replace(/['’]s$/, "")));
  for (const n of [c.lead, ...c.cast]) {
    addNames(n);
    const a = ctx.roster.find(n);
    if (a) a.names.forEach(addNames);
  }
  addNames(ctx.userName);
  for (const p of [...ctx.places, ...ctx.objects, c.where ?? "", c.premise, c.want, c.fear, c.template, c.twist ?? ""]) addNames(p);
  const others = new Set(ctx.roster.actors.flatMap((a) => a.names.flatMap((n) => n.split(/\s+/))).map((w) => w.toLowerCase()));
  for (const w of capNames(`${text} ${arrival ?? ""}`)) {
    const l = w.toLowerCase();
    if (allowed.has(l)) continue;
    return fail(others.has(l) ? `names ${w}, who isn't on the card` : `a new name: ${w}`);
  }
  // The player's character only receives.
  const user = ctx.userName.split(/\s+/)[0];
  for (const s of `${text} ${arrival ?? ""}`.split(/(?<=[.!?;])\s+|,\s+(?:and|but|then)\s+/)) {
    const m = new RegExp(`(?:^|\\band\\s+)(?:${ctx.userName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${user})\\s+(\\S+(?:\\s+\\S+)?)`, "i").exec(s.trim());
    if (m && VERBISH.test(m[1])) return fail(`decides for ${ctx.userName}`);
  }
  if (!c.fateOk && IRREVERSIBLE.test(`${text} ${arrival ?? ""}`)) return fail("an irreversible outcome");
  const hits = offPageHits(`${text} ${arrival ?? ""}`, ctx.offPage);
  if (hits.length) return fail(`names an off-page secret (${hits[0].word})`);
  const n = normFact(text);
  if (ctx.recent.some((r) => overlap(n, normFact(r)) > 0.6)) return fail("repeats an earlier beat");
  // Lines: knowledge with a route, bonds within ±2, journals; card people only.
  const lines: string[] = [];
  const cardPeople = new Set([c.lead, ...c.cast].map((x) => x.toLowerCase()));
  const isCard = (name?: string) => !!name && ([...cardPeople].some((p) => p === name.toLowerCase() || p.split(/\s+/)[0] === name.toLowerCase().split(/\s+/)[0]));
  for (const l of Array.isArray(raw.lines) ? raw.lines.slice(0, 2).map(String) : []) {
    const op = parseLine(l);
    if (!op) continue;
    if (op.op === "know" && isCard(op.subject) && /\|/.test(l) && /\b(told|heard|saw|read|overheard|learned|found|deduced|guessed|letter|phone|call|raven)\b/i.test(l.split("|")[1] ?? "")) lines.push(l);
    else if (op.op === "bond" && isCard(op.subject) && isCard(op.object) && (op.args.changes ?? []).every((ch: { delta: number }) => Math.abs(ch.delta) <= 2)) lines.push(l);
    else if (op.op === "journal" && isCard(op.subject) && op.subject?.toLowerCase() !== ctx.userName.toLowerCase()) lines.push(l);
  }
  if (lines.some((l) => offPageHits(l, ctx.offPage).length)) return { text, arrival, lines: [] };
  return { text, arrival, lines };
}

export function validateSeed(c: BeatCard, raw: { premise?: string; want?: string; fear?: string }, ctx: TellingCtx): Told {
  const premise = String(raw.premise ?? "").trim();
  const want = String(raw.want ?? "").trim();
  const fear = String(raw.fear ?? "").trim();
  if (!premise || !want || !fear) return { lines: [], rejected: "incomplete" };
  if (premise.split(/\s+/).length > 45 || want.split(/\s+/).length > 18 || fear.split(/\s+/).length > 18) return { lines: [], rejected: "too long" };
  const probe = validateTold({ ...c, result: "cost" }, { text: `${premise} ${want}. ${fear}.`, result: "cost" }, { ...ctx, recent: [] });
  if (probe.rejected) return probe;
  return { lines: [], seed: { premise, want: /^to\s/i.test(want) ? want : `to ${want}`, fear } };
}

const STANDINGS: Standing[] = ["here", "away", "captive", "changed", "dead", "companion", "construct"];
const REACHES: Reach[] = ["house", "town", "region", "far"];

export function validateProfile(raw: any, hash: string): Profile | null {
  if (!raw || typeof raw !== "object") return null;
  const p: Profile = { hash };
  if (STANDINGS.includes(raw.standing)) p.standing = raw.standing;
  if (typeof raw.where === "string" && raw.where.trim() && raw.where.length < 60) p.where = raw.where.trim();
  if (REACHES.includes(raw.reach)) p.reach = raw.reach;
  if (typeof raw.want === "string" && raw.want.trim() && raw.want.length < 120) p.want = raw.want.trim().replace(/^to\s+/i, "");
  if (typeof raw.fear === "string" && raw.fear.trim() && raw.fear.length < 120) p.fear = raw.fear.trim();
  if (typeof raw.nocturnal === "boolean") p.nocturnal = raw.nocturnal;
  return p;
}
