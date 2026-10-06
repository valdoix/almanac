// Swipe autopsy: when the player swipes past takes of a reply and keeps one, what was wrong with the
// ones set aside? The rules check each take and keep the slips only the rejected ones made (a secret
// named, a dead man speaking, the wrong eyes, a term from later in the source); an optional model
// read compares the takes for the rest (an invented event, a spoiler, someone knowing too much).
// Each finding is offered as a lesson for this story; the player keeps or dismisses it. Kept
// lessons go to the model every turn and into the model check of each reply.

import type { CheckIssue } from "./audit";
import { SAFETY_DATA } from "./prompts";
import { normFact, overlap } from "./state";

export interface Lesson {
  id: string;
  /** The rule, for the model: "Spike doesn't know about the Initiative yet". */
  text: string;
  /** What the rejected take did. */
  why?: string;
  /** The rejected take's words. */
  quote?: string;
  /** The reply it came from (message index). */
  msgIndex: number;
  status: "pending" | "kept" | "dismissed";
  by: "rules" | "model" | "user";
  at: number;
}

/** A rule from a slip the rules found: what the story should hold to from now on. */
export function ruleFor(i: CheckIssue): string | null {
  switch (i.kind) {
    case "offpage": {
      const m = /^names "([^"]+)": #(\S+)/.exec(i.text);
      return m ? `Never name "${m[1]}" on the page while #${m[2]} is kept off it` : null;
    }
    case "leak": {
      const m = /^(.+?) speaks of #(\S+) \("(.+)"\), which was kept from them/.exec(i.text);
      return m ? `${m[1]} doesn't know "${m[3]}" (#${m[2]}) and can't speak of it` : null;
    }
    case "dead": {
      const m = /^(.+?) speaks, but died/.exec(i.text);
      return m ? `${m[1]} is dead and doesn't speak` : null;
    }
    case "trait": {
      const m = /^(.+?)'s (eyes|hair) are (.+?), not /.exec(i.text);
      return m ? `${m[1]}'s ${m[2]} are ${m[3]}` : null;
    }
    case "canon": {
      const m = /^names "([^"]+)"/.exec(i.text);
      return m ? `"${m[1]}" hasn't happened yet in this story` : null;
    }
    default:
      return null;
  }
}

/**
 * The slips the rejected takes made that the kept one didn't, as lessons. A slip the kept take
 * made too isn't why the player swiped.
 */
export function rulesLessons(kept: CheckIssue[], rejected: CheckIssue[][], msgIndex: number): Lesson[] {
  const keptRules = new Set(kept.map(ruleFor).filter(Boolean));
  const out: Lesson[] = [];
  for (const issues of rejected) {
    for (const i of issues) {
      if (i.level !== "warn") continue;
      const rule = ruleFor(i);
      if (!rule || keptRules.has(rule) || out.some((l) => l.text === rule)) continue;
      out.push({ id: `l${msgIndex}_${out.length}`, text: rule, why: i.text, ...(i.quote ? { quote: i.quote } : {}), msgIndex, status: "pending", by: "rules", at: Date.now() });
    }
  }
  return out;
}

/** The model read: what the rejected takes got wrong that the kept one got right. */
export function autopsyPrompt(o: { kept: string; rejected: string[]; record: string; userName: string }): { system: string; user: string } {
  return {
    system: `You help keep a long roleplay consistent. ${SAFETY_DATA}
The player had several takes of one reply written and kept one; the others they swiped away. Compare them. List only what the rejected takes got WRONG that the kept take got right, and only concrete errors that matter for the rest of the story: a spoiler or knowledge from later in the source material, an event that never happened, a wrong fact about a person (looks, age, family, history, what they are), someone knowing or saying what they couldn't know, ${o.userName} (the player's character) made to speak, act or feel, a broken rule of this story. Never taste, length, style, pacing or word choice: if the takes only differ in those, return an empty list.
Phrase each as a short rule for this story from now on, naming people plainly ("Spike doesn't know about the Initiative yet", "Never mention Heaven before Buffy tells anyone", "Joyce is alive"). At most three.
Output JSON only: {"lessons":[{"rule":"…","quote":"the rejected take's words","why":"what it got wrong"}]}`,
    user: `<story>\n${o.record}\n</story>\n\n<source>\nKEPT TAKE:\n${o.kept}\n\n${o.rejected.map((r, i) => `REJECTED TAKE ${i + 1}:\n${r}`).join("\n\n")}\n</source>`,
  };
}

/** The model's lessons, checked: a rule worth keeping, not one already held. */
export function modelLessons(raw: { lessons?: { rule?: unknown; quote?: unknown; why?: unknown }[] } | null, have: Lesson[], msgIndex: number): Lesson[] {
  const out: Lesson[] = [];
  for (const x of raw?.lessons ?? []) {
    const rule = typeof x?.rule === "string" ? x.rule.replace(/\s+/g, " ").trim().slice(0, 200) : "";
    if (rule.length < 8 || /\b(?:style|tone|length|pacing|prose|wording|shorter|longer)\b/i.test(rule)) continue;
    if ([...have, ...out].some((l) => overlap(normFact(l.text), normFact(rule)) > 0.7)) continue;
    out.push({
      id: `l${msgIndex}_m${out.length}`, text: rule, ...(typeof x.why === "string" ? { why: x.why.slice(0, 200) } : {}), ...(typeof x.quote === "string" ? { quote: x.quote.slice(0, 160) } : {}),
      msgIndex, status: "pending", by: "model", at: Date.now(),
    });
    if (out.length >= 3) break;
  }
  return out;
}

/** New lessons added to the list: one of each rule, pending ones after kept ones, a limit on the whole. */
export function addLessons(list: Lesson[], add: Lesson[]): Lesson[] {
  const out = [...list];
  for (const l of add) if (!out.some((x) => x.text === l.text || overlap(normFact(x.text), normFact(l.text)) > 0.7)) out.push(l);
  const kept = out.filter((l) => l.status === "kept");
  const pending = out.filter((l) => l.status === "pending").slice(-12);
  const dismissed = out.filter((l) => l.status === "dismissed").slice(-30);
  return [...kept, ...pending, ...dismissed];
}

/** The [LESSONS] lane: rules the player kept from swipes they set aside. */
export function lessonsLane(list: Lesson[] | undefined): string {
  const kept = (list ?? []).filter((l) => l.status === "kept").map((l) => l.text);
  return kept.length ? `[LESSONS] From takes the player swiped away — hold to these: ${kept.slice(-10).join(" · ")}` : "";
}
