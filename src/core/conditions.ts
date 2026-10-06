// Conditions with a course: a cold, flu, a fever, a stomach bug, a migraine, a hangover, a
// concussion run for so long and end; a curse or a poison lasts until the story ends it. The
// story names them in body lines ("hungover", "has a streaming cold"); the clock runs the course,
// faster for fast healers. A vampire, an angel or an android doesn't catch cold, and a vampire
// needs a great deal more than beer to get drunk.

import type { CharacterState, Condition } from "./types";
import type { ResolvedStamina } from "./stamina";
import { MIN_PER_DAY } from "./util";

interface Course {
  label: string;
  re: RegExp;
  /** Minutes it runs for an ordinary person; null: until the story ends it. */
  span: number | null;
  /** An illness: the kinds that don't fall ill never catch it. */
  ill?: boolean;
  /** Drink's doing: scaled by how much drink touches them. */
  drink?: boolean;
}

const H = 60;
const D = MIN_PER_DAY;

export const COURSES: Record<string, Course> = {
  hangover: { label: "hangover", re: /\bhung\s?over\b|\bhangover\b/i, span: 10 * H, drink: true },
  flu: { label: "flu", re: /\bflu\b|\binfluenza\b/i, span: 7 * D, ill: true },
  cold: { label: "a cold", re: /\b(?:a|the|her|his|their|head|chest|common|streaming|bad|nasty|summer|winter|stinking)\s+cold\b(?!\s+(?:air|water|wind|night|stone|floor|shoulder|sweat|fury|blood|hands?|feet|eyes|voice|steel|light|fire))|\bsniffl\w*|\brunny nose\b|\bstuffed[- ]up\b|\bcongest\w*/i, span: 6 * D, ill: true },
  fever: { label: "a fever", re: /\bfever\w*|\bfebrile\b|\bburning up\b/i, span: 2 * D, ill: true },
  stomach: { label: "a stomach bug", re: /\bfood poisoning\b|\bstomach (?:bug|flu)\b|\bvomiting\b|\bthrowing up\b|\bnause\w*/i, span: 1 * D, ill: true },
  migraine: { label: "a migraine", re: /\bmigraine\b|\bsplitting headache\b/i, span: 8 * H },
  concussion: { label: "a concussion", re: /\bconcuss\w*/i, span: 7 * D },
  sick: { label: "sick", re: /\b(?:sick|ill|unwell|poorly|under the weather|bedridden)\b(?!\s+(?:of|with (?:worry|fear|guilt|grief|jealousy|longing)|to (?:her|his|their) stomach))/i, span: 3 * D, ill: true },
  curse: { label: "a curse", re: /\bcursed\b|\bhexed\b|\bunder a (?:curse|spell|hex)\b|\bensorcell?ed\b|\bspellbound\b/i, span: null },
  poison: { label: "poisoned", re: /\bpoison(?:ed|ing)\b|\benvenom\w*|\bvenom in\b/i, span: null },
};

/** Words that end a condition: "over her cold", "fever broke", "curse lifted", "antidote". */
const ENDS = /\b(?:recovered|recovering from|over (?:it|the|her|his|their|a)|cured|lifted|broke|broken|gone|cleared|better now|shook off|shaken off|antidote|purged|healed of|no longer)\b/i;
/** Words that bring one back after it ended: "the cold came back", "sick again", "relapse". */
const AGAIN = /\b(?:again|relapse\w*|came back|returned|worse|caught (?:another|a new))\b/i;

/** The conditions a line of body text names (kinds). */
export function conditionsIn(text: string): string[] {
  return Object.entries(COURSES).filter(([k, c]) => c.re.test(text) && !(k === "sick" && Object.entries(COURSES).some(([o, x]) => o !== "sick" && x.ill && x.re.test(text)))).map(([k]) => k);
}

export function endsCondition(text: string): boolean {
  return ENDS.test(text);
}

/** How much drink touches someone: a vampire needs a lot, an android none. */
export function drinkFactor(s?: ResolvedStamina): number {
  const k = s?.kind ?? "ordinary";
  return k === "construct" ? 0 : k === "vampire" || k === "immortal" ? 0.3 : k === "slayer" || k === "werewolf" || k === "superhuman" ? 0.6 : 1;
}

/** Minutes the course runs for this person; null: until the story ends it; 0: it can't touch them. */
export function courseOf(kind: string, s?: ResolvedStamina): number | null {
  const c = COURSES[kind];
  if (!c) return null;
  const k = s?.kind ?? "ordinary";
  if (c.ill && (k === "vampire" || k === "immortal" || k === "construct")) return 0;
  if (c.span == null) return null;
  if (c.drink) {
    const f = drinkFactor(s);
    return f ? Math.round(c.span * f) : 0;
  }
  const heal = s?.heal ?? 1;
  if (heal <= 0) return c.ill ? 0 : c.span;
  return Math.round(c.span / Math.max(0.5, Math.sqrt(heal)));
}

/**
 * The body line's flags and unflags, read for conditions: a new one starts its course, a
 * restated one changes nothing, one that ended in the last two days stays ended unless the
 * line says it's back. Returns lines for the change list.
 */
export function noteConditions(c: CharacterState, flags: string[], unflags: string[], now: number): string[] {
  const out: string[] = [];
  const list = (c.conditions ??= []);
  for (const f of flags) {
    if (endsCondition(f) && conditionsIn(f).length) {
      for (const kind of conditionsIn(f)) for (const x of list) if (x.kind === kind && (x.until == null || x.until > now)) end(c, x, now);
      c.flags = c.flags.filter((x) => x !== f);
      continue;
    }
    for (const kind of conditionsIn(f)) {
      if (list.some((x) => x.kind === kind && (x.until == null || x.until > now))) continue;
      const lately = list.find((x) => x.kind === kind && x.until != null && x.until <= now && now - x.until < 2 * D);
      if (lately && !AGAIN.test(f)) {
        c.flags = c.flags.filter((x) => x !== f);
        continue;
      }
      const span = courseOf(kind, c.stamina);
      if (span === 0) {
        c.flags = c.flags.filter((x) => x !== f);
        continue;
      }
      c.conditions = list.filter((x) => x.kind !== kind);
      c.conditions.push({ kind, text: f, since: now, until: span == null ? null : now + span });
      out.push(f);
    }
  }
  for (const u of unflags) for (const kind of conditionsIn(u)) for (const x of c.conditions ?? []) if (x.kind === kind && (x.until == null || x.until > now)) end(c, x, now);
  if (c.conditions && !c.conditions.length) delete c.conditions;
  return out;
}

function end(c: CharacterState, x: Condition, now: number) {
  x.until = now;
  const re = COURSES[x.kind]?.re;
  if (re) c.flags = c.flags.filter((f) => !re.test(f));
}

/** Run the courses up to `now`: what's over is over (its flags go). Ended ones are remembered two days. */
export function runCourse(c: CharacterState, now: number): string[] {
  if (!c.conditions?.length) return [];
  const ended: string[] = [];
  for (const x of c.conditions) {
    if (x.until == null || x.until > now) continue;
    const re = COURSES[x.kind]?.re;
    if (re && c.flags.some((f) => re.test(f))) {
      c.flags = c.flags.filter((f) => !re.test(f));
      ended.push(x.kind);
    }
  }
  c.conditions = c.conditions.filter((x) => x.until == null || now - x.until < 2 * D);
  if (!c.conditions.length) delete c.conditions;
  return ended;
}

/** A hangover after a drunk night's sleep, for those drink touches. */
export function hangover(c: CharacterState, wake: number): boolean {
  const span = courseOf("hangover", c.stamina);
  if (!span || (c.conditions ?? []).some((x) => x.kind === "hangover" && (x.until == null || x.until > wake))) return false;
  (c.conditions ??= []).push({ kind: "hangover", text: "hungover", since: wake, until: wake + span });
  if (!c.flags.includes("hungover")) c.flags.push("hungover");
  return true;
}

/** The ones running now. */
export function activeConditions(c: CharacterState, now: number | null): Condition[] {
  return (c.conditions ?? []).filter((x) => x.until == null || now == null || x.until > now);
}

/** "a cold (day 2 of about 6, easing)", "hangover (till about 14:00)", "a curse (until it's lifted)". */
export function conditionWords(x: Condition, now: number | null): string {
  const c = COURSES[x.kind];
  const label = c?.label ?? x.kind;
  if (x.until == null) return `${label} (until the story ends it)`;
  if (now == null) return label;
  const total = x.until - x.since;
  const done = now - x.since;
  const eased = done >= total * 0.55;
  if (total >= D) {
    const day = Math.floor(done / D) + 1;
    const of = Math.max(day, Math.round(total / D));
    return `${label} (day ${day} of about ${of}${eased ? ", easing" : done < total * 0.3 ? ", at its worst" : ""})`;
  }
  const end = x.until % D;
  return `${label} (${eased ? "easing, " : ""}till about ${String(Math.floor(end / 60)).padStart(2, "0")}:${String(Math.floor((end % 60) / 15) * 15).padStart(2, "0")})`;
}
