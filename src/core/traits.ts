// Traits: what doesn't change from scene to scene (eyes, hair, build, scars, voice, age).
// Kept apart from `look` (what someone is wearing now), so the next outfit never wipes
// out the colour of someone's eyes. Read from the story's `trait` lines, the player's own
// words, the Cast page, the character card and persona, and the lorebooks.

import type { Trait, TraitKind } from "./types";

const KINDS: [TraitKind, RegExp][] = [
  ["age", /^(?:age[ds]?\s*:?\s*\d|\d{1,3}\s*(?:years?|yrs?)(?:[- ]old)?\b|(?:[a-z]+-)?[a-z]+[- ]years?[- ]old\b|(?:in (?:her|his|their) )?(?:early |mid-?|late )?(?:teens|twenties|thirties|forties|fifties|sixties|seventies|eighties)\b|ageless\b)/i],
  ["eyes", /\beyes?\b|\birises\b|\bheterochrom/i],
  ["hair", /\bhair\b|\bcurls\b|\bbraids?\b|\blocks\b|\bbald\b|\bbeard\b|\bmoustache\b|\bmustache\b|\bstubble\b|\bringlets\b|\bponytail\b/i],
  ["scar", /\bscars?\b|\bscarred\b/i],
  ["mark", /\btattoo|\bbirthmark|\bfreckles?\b|\bmoles?\b|\bpiercing|\bbrand(?:ed)?\b|\bdimples?\b/i],
  ["height", /\btall\b|\bshort\b|\bpetite\b|\btowering\b|\b\d\s*(?:ft|foot|feet|')\b|\b\d{3}\s*cm\b|\bheight\b/i],
  ["build", /\bbuild\b|\bbuilt\b|\bslender\b|\bslim\b|\bstocky\b|\bbroad[- ]shouldered|\blean\b|\bmuscular\b|\bwiry\b|\bcurvy\b|\bplump\b|\bheavyset\b|\bgaunt\b/i],
  ["skin", /\bskin\b|\bcomplexion\b|\btanned\b|\bpale\b|\bolive[- ]skinned/i],
  ["voice", /\bvoice\b|\baccent\b|\blisp\b|\bdrawl\b/i],
  ["face", /\bface\b|\bjaw\b|\bcheekbones?\b|\bnose\b|\blips\b|\bsmile\b/i],
];

/** Which kind of trait a phrase describes ("violet eyes" → eyes, "24" → age). */
export function traitKind(text: string): TraitKind {
  const t = text.trim();
  if (/^\d{1,3}$/.test(t)) return "age";
  for (const [k, re] of KINDS) if (re.test(t)) return k;
  return "other";
}

/** Split a trait line into single traits: "violet eyes; silver hair cut short; 24". */
export function splitTraits(text: string): { kind: TraitKind; text: string }[] {
  const parts = /[;·|]/.test(text) ? text.split(/\s*[;·|]\s*/) : text.split(/\s*,\s*(?![^()]*\))/);
  return parts
    .map((p) => p.replace(/^\s*(?:and|with)\s+/i, "").replace(/[.\s]+$/, "").trim())
    .filter((p) => p.length >= 2 && p.length <= 80)
    .map((p) => {
      const age = /^age[ds]?\s*:?\s*(.+)$/i.exec(p);
      return age ? { kind: "age" as const, text: age[1].trim() } : { kind: traitKind(p), text: p };
    });
}

const RANK: Record<Trait["by"], number> = { user: 4, model: 3, card: 2, lore: 1 };

/**
 * Add traits to a list: one per kind (except "other", "scar" and "mark", which collect). The
 * player's word stands: nothing below it replaces it. Returns what was refused.
 */
export function mergeTraits(list: Trait[], add: Trait[]): { list: Trait[]; refused: Trait[] } {
  const out = [...list];
  const refused: Trait[] = [];
  for (const t of add) {
    const many = t.kind === "other" || t.kind === "scar" || t.kind === "mark";
    const same = out.findIndex((x) => x.kind === t.kind && (!many || x.text.toLowerCase() === t.text.toLowerCase()));
    if (same < 0) {
      out.push(t);
      continue;
    }
    if (RANK[out[same].by] > RANK[t.by] && out[same].text.toLowerCase() !== t.text.toLowerCase()) {
      refused.push(t);
      continue;
    }
    out[same] = t;
  }
  // Collecting kinds are capped, keeping the newest.
  for (const k of ["other", "scar", "mark"] as TraitKind[]) {
    const of = out.filter((x) => x.kind === k);
    if (of.length > 4) for (const x of of.slice(0, of.length - 4)) out.splice(out.indexOf(x), 1);
  }
  return { list: out, refused };
}

const COLOUR = "(?:(?:pale|light|dark|deep|bright|clear|cold|warm|steel|ice|storm|sea|ocean|sky|forest|bottle|moss|grey|gray|blue|green|brown|hazel|amber|gold(?:en)?|violet|purple|lilac|indigo|amethyst|black|silver|white|red|auburn|copper|chestnut|honey|ash|platinum|strawberry|dirty|sandy|mousy|jet|raven|emerald|jade|sapphire|blonde|blond|fair|ginger|mahogany|salt-and-pepper)[- ]?){1,3}";
const HAIR_SHAPE = "(?:(?:short|long|cropped|shoulder-length|waist-length|curly|wavy|straight|thick|thin|messy|tousled|braided|close-cropped|shaved|greying|graying|silvering|streaked)[ ,-]*){0,3}";
const EYES = new RegExp(`\\b(${COLOUR})[- ]?eyed\\b|\\b(${COLOUR})\\s+eyes\\b|\\beyes\\s+(?:are|were|of)\\s+(?:a\\s+)?(${COLOUR})\\b`, "i");
const HAIR = new RegExp(`\\b(${HAIR_SHAPE}${COLOUR})[- ]haired\\b|\\b(${HAIR_SHAPE}${COLOUR})\\s+(?:hair|curls|locks|braids?)\\b|\\bhair\\s+(?:is|was)\\s+(${HAIR_SHAPE}${COLOUR})\\b`, "i");
const NUM_WORDS = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(" ");
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** An age given in words or numbers ("seventy-five", "24"). */
export function ageNumber(w: string): string | undefined {
  const x = w.toLowerCase();
  if (/^\d{1,3}$/.test(x)) return x;
  const [a, b] = x.split("-");
  const n = (TENS[a] ?? (NUM_WORDS.indexOf(a) + 1 || 0)) + (b ? NUM_WORDS.indexOf(b) + 1 : 0);
  return n > 0 ? String(n) : undefined;
}

/**
 * Traits a description states outright: eye and hair colour and an age ("the twenty-year-old
 * Slayer, green eyes, blonde hair"). Deliberately narrow: a card's prose says many things, and
 * only these three are worth sending every turn.
 */
export function traitsFromText(text: string, owners: string[] = []): { kind: TraitKind; text: string }[] {
  const t = (text ?? "").replace(/\{\{[^}]+\}\}/g, " ");
  const out: { kind: TraitKind; text: string }[] = [];
  const own = new Set(owners.filter(Boolean).map((o) => o.toLowerCase()));
  // "Gabriel's blue eyes" in Buffy's card are Gabriel's: a match right after someone else's name is skipped.
  const theirs = (at: number) => {
    const before = /([A-Z][\p{L}'’-]+)['’]s\s+(?:[\p{L}-]+\s+){0,3}$/u.exec(t.slice(Math.max(0, at - 40), at));
    return !!before && own.size > 0 && !own.has(before[1].toLowerCase());
  };
  const first = (re: RegExp) => {
    const g = new RegExp(re.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = g.exec(t))) if (!theirs(m.index)) return m;
    return null;
  };
  const e = first(EYES);
  if (e) out.push({ kind: "eyes", text: `${(e[1] || e[2] || e[3]).trim().toLowerCase()} eyes` });
  const h = first(HAIR);
  if (h) out.push({ kind: "hair", text: `${(h[1] || h[2] || h[3]).trim().toLowerCase().replace(/\s+/g, " ")} hair` });
  const a = first(/\b(\d{1,3}|[a-z]+(?:-[a-z]+)?)[- ]years?[- ]old\b|\baged? (\d{1,3})\b|\bage:?\s*(\d{1,3})\b/i);
  if (a) {
    const n = a[2] ?? a[3] ?? ageNumber(a[1]);
    if (n && +n > 0 && +n < 1000) out.push({ kind: "age", text: n });
  }
  return out;
}

/**
 * Traits the player states in their own message about a named person: "Daeron has violet eyes
 * and Cersei has green eyes", "Buffy's eyes are green", "Tyrion is twenty-two".
 */
export function traitsStated(text: string, names: string[]): { who: string; kind: TraitKind; text: string }[] {
  const out: { who: string; kind: TraitKind; text: string }[] = [];
  for (const name of names) {
    if (!name || name.length < 2) continue;
    const n = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const has = new RegExp(`\\b${n}\\s+(?:has|had|with)\\s+([^.;!?\\n]{3,60}?)(?=\\s+and\\s+[A-Z]|[.;!?\\n]|$)`, "g");
    let m: RegExpExecArray | null;
    while ((m = has.exec(text))) for (const x of traitsFromText(m[1])) if (x.kind !== "age") out.push({ who: name, ...x });
    const poss = new RegExp(`\\b${n}['’]s\\s+(eyes|hair)\\s+(?:is|are|was|were)\\s+([^.;!?\\n,]{3,40})`, "gi");
    while ((m = poss.exec(text))) out.push({ who: name, kind: m[1].toLowerCase() as TraitKind, text: `${m[2].trim().toLowerCase()} ${m[1].toLowerCase()}` });
    const age = new RegExp(`\\b${n}\\s+(?:is|was|turned|turns)\\s+(\\d{1,3}|[a-z]+(?:-[a-z]+)?)(?:\\s+years?\\s+old)?\\b(?![\\s-]*(?:minutes?|hours?|days?|feet|foot|inches|times|percent|steps?|men|of))`, "g");
    while ((m = age.exec(text))) {
      const a = ageNumber(m[1]);
      if (a && +a >= 1 && +a <= 150 && (/^\d/.test(m[1]) || /\byears?\s+old\b/.test(m[0]) || ageNumber(m[1]))) out.push({ who: name, kind: "age", text: a });
    }
  }
  return out;
}

/** The short line sent every turn: "violet eyes, silver hair cut short, 24". */
export function traitLine(traits: Trait[] | undefined, extra: { age?: string; appearance?: string } = {}): string {
  const order: TraitKind[] = ["age", "eyes", "hair", "height", "build", "skin", "face", "voice", "scar", "mark", "other"];
  const list = [...(traits ?? [])];
  if (extra.age) list.push({ kind: "age", text: extra.age, by: "user", msgIndex: 0 });
  const bits = order.flatMap((k) => list.filter((t) => t.kind === k && !(k === "age" && extra.age && t.by !== "user")).map((t) => (k === "age" && /^\d{1,3}$/.test(t.text) ? `${t.text} years old` : t.text)));
  const seen = new Set<string>();
  const uniq = bits.filter((b) => (seen.has(b.toLowerCase()) ? false : (seen.add(b.toLowerCase()), true)));
  const app = extra.appearance?.trim();
  return [...(app ? [app] : []), ...uniq].join(", ").slice(0, 220);
}
