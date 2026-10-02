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
import { cleanProfile, readStanding, type Profile, type Roster, type Reach } from "./roster";
import type { ArcKind, Standing } from "../types";

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
  /** Telling one step again: the words it has now, which the player found wanting. */
  retry?: string;
}

const RESULT_WORD: Record<string, string> = {
  win: "WIN (this step went the lead's way: real headway toward the want, not the whole of it)", cost: "COST (this step got somewhere, and the lead paid the price named)", loss: "LOSS (this step failed, and something got worse)",
  met: "ENDING: MET (the want is met)", price: "ENDING: AT A PRICE (met, but it cost)", lost: "ENDING: LOST (the fear came true)", softened: "ENDING: SOFTENED (it nearly went badly, but not quite)",
};

function cardText(c: BeatCard, ctx: TellingCtx): string {
  if (c.seed) {
    return `SEED ${c.id} · new subplot · ${c.kind} · lead ${c.lead}${c.cast.length ? ` · with ${c.cast.join(", ")}` : ""}
  WHO ${c.lead}: ${c.leadText.slice(0, 220) || "—"}
  GROUNDS ${c.grounds.join(" · ")}
  DRAFT premise: ${c.premise} | want: ${c.want} | fear: ${c.fear}
  WRITE a premise (one or two plain, specific sentences, ≤ 45 words) from the grounds only, a want ("to …", ≤ 12 words) and a fear (≤ 12 words).`;
  }
  return `CARD ${c.id} · ${c.kind} · ${c.ending ? "ending" : `beat ${c.clock} · ${c.stage}`} · roll ${c.roll[0]}+${c.roll[1]}${c.mod ? ` ${c.mod > 0 ? "+" : "-"}${Math.abs(c.mod)}` : ""} → ${RESULT_WORD[c.result]}${c.price ? ` (price: ${c.price})` : ""}${c.worse ? ` (worse: ${c.worse})` : ""}${c.twist ? ` · twist: ${c.twist}` : ""}
  LEAD ${c.lead}: ${c.leadText.slice(0, 200) || "—"}
  SUBPLOT ${c.premise} · wants ${c.want} · fears ${c.fear}${c.groundText?.length ? `\n  GROUNDS ${c.groundText.join(" · ")}` : ""}${c.sofar?.length ? `\n  SO FAR ${c.sofar.join(" → ")}` : "\n  SO FAR (this is its first step: begin what the SUBPLOT describes)"}
  CAST ${c.cast.join(", ") || "—"} · WHERE ${c.where ?? "—"} · WHEN ${fmtTime(fromAbs(c.atAbs))}${c.offHours ? ` (${c.offHours}: tell it so that fits)` : ""}
  KNOWS ${c.knows.join("; ") || "—"}${c.noRoute.length ? ` · NO ROUTE TO ${c.noRoute.join(", ")} (can't act on it)` : ""}${c.established?.length ? `\n  ESTABLISHED ${c.established.join(" · ")}` : ""}${c.sought?.length ? `
  SOUGHT ${c.sought.join(", ")}: ${c.lead} doesn't know where they are and doesn't find them${c.ending ? " unless the ending is met" : " in this step (only an ending can)"}; no call, letter or visit reaches them` : ""}
  ENGINE DRAFT ${c.template}${c.arrival ? `\n  REACHES THE SCENE AS (${c.arrivalKind}) ${c.arrival}` : ""}`;
}

export function tellingPrompt(cards: BeatCard[], ctx: TellingCtx): { system: string; user: string } {
  const never = [...new Set(ctx.offPage.flatMap((o) => o.words))];
  const prof = ctx.profile?.length
    ? `\nAlso PROFILE each person listed under PROFILES from their text only: {"key","standing","where","reach","want","fear","nocturnal"}. standing is one of: "here" (about town, free to act), "away" (gone somewhere far), "captive" (imprisoned or held), "changed" (transformed or cursed out of their own shape), "dead", "companion" (only an animal, pet or mount that belongs to someone, never a person who is someone's ally or friend), "construct" (a robot, golem or the like). where is the place they are now, or empty; reach is "town", "region" or "far"; want is what they want now, starting "to", and fear what they fear, both in their own specific words (never empty or "…"); nocturnal is true or false.`
    : "";
  return {
    system: `You tell what happened off the page in a roleplay, between two story times. ${SAFETY_DATA}
Each CARD is already decided: who, where, when, and how it turned out. Tell it in two short, plain sentences (at most 50 words), like news of someone the reader knows. First, what happened, in the past tense: the next concrete step of the SUBPLOT, continuing SO FAR, and specific, naming the actual people, news, places and things from the card (SUBPLOT, GROUNDS, KNOWS, ESTABLISHED). Then where that leaves things now, in the present tense: what the lead is about to do, or what is now set to happen. Write "heard that Buffy is back", never "received news"; "voted to strip her magic", never "reached a decision". The register, from other stories: "Marta heard that the mill had burned down. She's thinking of writing to her brother and going home." / "The guild finished its inquiry into the forged seals. Tomas is set to lose his licence." No scenery for its own sake, no semicolon chains, no vague summary ("made progress", "at a price", "it went well", "things moved along"); a price or a setback is said as the concrete thing it was. Keep the outcome exactly, and echo it in "result". The ENGINE DRAFT is only a fallback; don't copy its wording. Use only what the card gives; add no events, no past history, no new named people (anyone else is unnamed: "a clerk", "a neighbour"). Name only the card's LEAD and CAST, people named in its ESTABLISHED facts, and places it names. The lead acts only on what they KNOW; ESTABLISHED is for getting the names and facts right. Never decide anything ${ctx.userName} does, says, thinks or knows; ${ctx.userName} may only receive something (a call, a letter), and is never the subject of a sentence. Nothing irreversible (a death, a permanent departure, a marriage, a child, a lasting injury) unless the card is an ENDING marked "may be told".${never.length ? ` Never write these words: ${never.join(", ")}.` : ""}
For a card with REACHES THE SCENE, also write "arrival": the moment it reaches the scene as the scene would meet it (what is heard, seen, read or said, and by whom), specific about the news it carries, at most 40 words, in-world.
You may add up to two ledger "lines" per card for the LEAD and CAST only: "know Name: #key fact | how they learned it · knows/believes", "bond A>B: trust +1 — cause", "journal Name: their own words".
Each SEED asks for a premise, want and fear for a new subplot, from its GROUNDS only. The premise is one or two plain, specific sentences: who, what they've learned or what has happened to them (naming the actual news, people and places in the grounds), and what they mean to do about it (at most 45 words, no labels or lists). The want is "to …" and the fear a plain clause, both specific and in natural words.${cards.some((c) => c.kind === "world") ? `\nA "world" card is the setting's own agenda, an actor too: tell it through consequences in the world (a move, a cost, a changed place), never by announcing it. Lines under HOLDS never break; pressure may strain them, nothing breaks them.${ctx.holds?.length ? ` HOLDS: ${ctx.holds.join(" / ")}` : ""}` : ""}${prof}
Output JSON only: {"beats":[{"card":"b3","result":"cost","text":"…","arrival":"…","lines":["…"]}],"seeds":[{"card":"b2","premise":"…","want":"to …","fear":"…"}]${ctx.profile?.length ? `,"profiles":[{"key":"…","standing":"…","where":"…","reach":"…","want":"…","fear":"…","nocturnal":false}]` : ""}}${ctx.lang && !/^en/i.test(ctx.lang) ? `\nWrite the text in ${ctx.lang}; keep the JSON field names, op names and card ids in English.` : ""}`,
    user: `${ctx.truths.length ? `[TRUTHS] (the player's rules; they bind off the page too) ${ctx.truths.join(" · ")}\n\n` : ""}${cards.map((c) => cardText({ ...c, result: c.result }, ctx) + (c.ending && c.fateOk ? "\n  (may be told: the player allowed this ending)" : "")).join("\n\n")}${ctx.retry ? `\n\nTELL AGAIN: the player asked for this step to be told again. It reads now: “${ctx.retry}” Tell the same card afresh, plainly and true to it, in new words.` : ""}${ctx.profile?.length ? `\n\nPROFILES\n${ctx.profile.map((p) => `[${p.key}] ${p.name}: ${p.text.slice(0, 400)}`).join("\n")}` : ""}`,
  };
}

export interface Told {
  text?: string;
  arrival?: string;
  lines: string[];
  seed?: { premise: string; want: string; fear: string };
  rejected?: string;
}

/**
 * Outcomes that contradict each other. A model that labels a WIN "cost" has usually written the
 * same step with a small price: its words stay. One that tells a WIN as a LOSS has told another story.
 */
const OPPOSITE: Record<string, string[]> = {
  win: ["loss", "lost"], loss: ["win", "met"], cost: [],
  met: ["lost", "loss"], lost: ["met", "win", "softened"], price: [], softened: ["lost"],
};

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
  const told = raw.result ? String(raw.result).toLowerCase().trim() : "";
  if (told && told !== String(c.result) && OPPOSITE[String(c.result)]?.includes(told)) return fail(`told as ${told}, decided ${c.result}`);
  const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
  if (wc(text) > 95) return fail("too long");
  const arrival = raw.arrival ? String(raw.arrival).trim() : undefined;
  if (arrival && wc(arrival) > 60) return fail("arrival too long");
  // People: only the card's lead and cast; places and objects the story knows.
  const allowed = new Set<string>();
  const addNames = (n: string) => n.split(/\s+/).forEach((w) => allowed.add(w.toLowerCase().replace(/['’]s$/, "")));
  for (const n of [c.lead, ...c.cast]) {
    addNames(n);
    const a = ctx.roster.find(n);
    if (a) a.names.forEach(addNames);
  }
  addNames(ctx.userName);
  for (const p of [...ctx.places, ...ctx.objects, c.where ?? "", c.premise, c.want, c.fear, c.template, c.twist ?? "", ...(c.established ?? []), ...(c.groundText ?? [])]) addNames(p);
  const others = new Set(ctx.roster.actors.flatMap((a) => a.names.flatMap((n) => n.split(/\s+/))).map((w) => w.toLowerCase()));
  // What the lead's and cast's own lore names ("Harvard Law") is theirs to use; the people it names still need the card.
  const lore = new Set([c.leadText, ...c.cast.map((n) => ctx.roster.find(n)?.text ?? "")].join(" ").match(/\p{Lu}[\p{L}'’-]+/gu)?.map((w) => w.toLowerCase().replace(/['’]s$/, "")) ?? []);
  for (const w of capNames(`${text} ${arrival ?? ""}`)) {
    const l = w.toLowerCase();
    if (allowed.has(l) || (lore.has(l) && !others.has(l))) continue;
    return fail(others.has(l) ? `names ${w}, who isn't on the card` : `a new name: ${w}`);
  }
  // The player's character only receives.
  const user = ctx.userName.split(/\s+/)[0];
  for (const s of `${text} ${arrival ?? ""}`.split(/(?<=[.!?;])\s+|,\s+(?:and|but|then)\s+/)) {
    const m = new RegExp(`(?:^|\\band\\s+)(?:${ctx.userName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${user})\\s+(\\S+(?:\\s+\\S+)?)`, "i").exec(s.trim());
    if (m && VERBISH.test(m[1])) return fail(`decides for ${ctx.userName}`);
  }
  if (!c.fateOk && IRREVERSIBLE.test(`${text} ${arrival ?? ""}`)) return fail("an irreversible outcome");
  // A search doesn't find its quarry before it ends (or at all, if it ends badly).
  const finds = c.result !== "met" && c.result !== "price" && (c.sought ?? []).find((n) => {
    const names = [n, ...(ctx.roster.find(n)?.names ?? [])].map((x) => x.split(/\s+/)[0]).filter((x) => x.length >= 3).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`\\b(?:(?:found|finds)(?! no\\b| nothing\\b| neither\\b| only\\b)|located|locates|tracked (?:\\w+ )?down|caught up with|learned where|found out where|knows where|knew where)\\b[^.;]{0,40}?\\b(?:${names.join("|")})\\b|\\btracked (?:${names.join("|")}) down\\b`, "i").test(`${text} ${arrival ?? ""}`);
  });
  if (finds) return fail(`finds ${finds} before the search ends`);
  // A secret's word the card itself says ("Joyce" in "the audit of Joyce Summers' accounts") isn't the secret.
  const own = [c.premise, c.want, c.fear, c.template, ...(c.established ?? [])].join(" ").toLowerCase();
  const hits = offPageHits(`${text} ${arrival ?? ""}`, ctx.offPage).filter((h) => !new RegExp(`(?<![\\p{L}\\p{N}])${h.word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u").test(own));
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
  if (premise.split(/\s+/).length > 60 || want.split(/\s+/).length > 18 || fear.split(/\s+/).length > 18) return { lines: [], rejected: "too long" };
  const probe = validateTold({ ...c, result: "cost" }, { text: `${premise} ${want}. ${fear}.`, result: "cost" }, { ...ctx, recent: [] });
  if (probe.rejected) return probe;
  return { lines: [], seed: { premise, want: /^to\s/i.test(want) ? want : `to ${want}`, fear } };
}

const STANDINGS: Standing[] = ["here", "away", "captive", "changed", "dead", "companion", "construct"];
const REACHES: Reach[] = ["house", "town", "region", "far"];

export function validateProfile(raw: any, hash: string, lore = ""): Profile | null {
  if (!raw || typeof raw !== "object") return null;
  const p: Profile = { hash };
  if (STANDINGS.includes(raw.standing)) p.standing = raw.standing;
  if (typeof raw.where === "string" && raw.where.trim() && raw.where.length < 60) p.where = raw.where.trim();
  if (REACHES.includes(raw.reach)) p.reach = raw.reach;
  if (typeof raw.want === "string" && raw.want.trim() && raw.want.length < 120) p.want = raw.want.trim().replace(/^to\s+/i, "");
  if (typeof raw.fear === "string" && raw.fear.trim() && raw.fear.length < 120) p.fear = raw.fear.trim();
  if (typeof raw.nocturnal === "boolean") p.nocturnal = raw.nocturnal;
  return cleanProfile(p, readStanding(lore).standing)!;
}

// ---------------------------------------------------------------------------
// Shaping a player's story (design/09 §12): the model reads their words once
// ---------------------------------------------------------------------------

const KIND_MEANING: Record<string, string> = {
  pursuit: "the lead goes after something they want", scheme: "the lead plots for power or advantage", rivalry: "the lead against a rival",
  courtship: "the lead and someone they're drawn to", rift: "the lead and someone they've fallen out with", debt: "the lead owes, or is owed",
  secret: "the lead keeps something hidden", decline: "the LEAD's own addiction, illness or hunger for power gets worse",
  investigation: "the lead (or a body they go to) looks into a question", threat: "the lead is a danger to others", return: "the lead, away, comes back",
  duty: "the lead answers to an institution (a council, a court, a circle)", life: "the lead's ordinary life", loss: "the lead grieves",
};

export interface StoryShapeRaw {
  kind?: string;
  want?: string;
  fear?: string;
  cast?: string[];
  secrecy?: string;
  place?: string;
}

/** The prompt that files a player's premise: its kind, want, fear and who is in it. */
export function shapePrompt(o: { userName: string; lead: string; leadText: string; premise: string; people: string[]; groups: string[]; lang?: string }): { system: string; user: string } {
  return {
    system: `A player wrote a subplot for someone off the page in their roleplay. File it for the engine that will play it out. ${SAFETY_DATA}
Read the premise for what the LEAD does and is after. Use only the premise and who the lead is; add nothing.
- "kind": one of ${Object.entries(KIND_MEANING).map(([k, v]) => `${k} (${v})`).join("; ")}.
- "want": what the LEAD is after, "to …", at most 12 words, in natural English ("to find Dawn before anyone else does").
- "fear": what the LEAD fears if it goes badly, a plain clause of at most 12 words, in natural English ("that he let Dawn down when it mattered").
- "cast": the people and groups from the lists below who take part (not ${o.userName}).
- "secrecy": "public" (anyone could hear of it), "private" (those close to it), or "secret" (hidden on purpose).
- "place": where it happens, if the premise says; else "".
Output JSON only: {"kind":"…","want":"to …","fear":"…","cast":["…"],"secrecy":"…","place":"…"}${o.lang && !/^en/i.test(o.lang) ? `\nWrite want and fear in ${o.lang}; keep the JSON keys and the kind in English.` : ""}`,
    user: `LEAD ${o.lead}: ${o.leadText.slice(0, 240) || "—"}
PREMISE ${o.premise}
PEOPLE ${o.people.join(", ") || "—"}
GROUPS ${o.groups.join(", ") || "—"}`,
  };
}

const KIND_NAMES = Object.keys(KIND_MEANING);

/** What of the shaping reply can be used; names must be the roster's, words short. */
export function validateShape(raw: StoryShapeRaw | null | undefined, roster: Roster, lead: string): { kind?: ArcKind; want?: string; fear?: string; cast?: string[]; secrecy?: "public" | "private" | "secret"; place?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const out: { kind?: ArcKind; want?: string; fear?: string; cast?: string[]; secrecy?: "public" | "private" | "secret"; place?: string } = {};
  const k = String(raw.kind ?? "").toLowerCase().trim();
  if (KIND_NAMES.includes(k)) out.kind = k as ArcKind;
  const short = (v: unknown, n: number) => (typeof v === "string" && v.trim() && v.trim().split(/\s+/).length <= n ? v.trim().replace(/[.]+$/, "") : undefined);
  const want = short(raw.want, 16);
  if (want) out.want = /^to\s/i.test(want) ? want : `to ${want}`;
  const fear = short(raw.fear, 16);
  if (fear) out.fear = fear.replace(/^(?:that|fears? that)\s+/i, "");
  const me = roster.find(lead);
  if (Array.isArray(raw.cast)) {
    const cast = raw.cast.map((n) => roster.find(String(n))).filter((a): a is NonNullable<typeof a> => !!a && a !== me).map((a) => a.name);
    if (cast.length) out.cast = [...new Set(cast)].slice(0, 4);
  }
  if (raw.secrecy === "public" || raw.secrecy === "private" || raw.secrecy === "secret") out.secrecy = raw.secrecy;
  const place = short(raw.place, 6);
  if (place) out.place = place;
  return Object.keys(out).length ? out : null;
}
