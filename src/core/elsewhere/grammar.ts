// The grammar of subplots (design/09 §5.2): each kind says when it fits, how fast it moves,
// how it reaches the player, what a win costs and how a loss makes things worse. The engine's
// own sentences (templates) tell a beat when the model doesn't, so the mechanics never wait.

import type { ArcKind, ArcStage, BeatResult } from "../types";

export type RouteKind = "carrier" | "signal" | "ambient" | "trace" | "entrance";

export interface KindSpec {
  kind: ArcKind;
  /** Words that suggest this kind in a thread, a forecast, a want or a role. */
  words: RegExp;
  clock: 4 | 6 | 8;
  /** Beats per story hour, before heat, stage and mode. */
  base: number;
  secrecy: "public" | "private" | "secret";
  /** How it reaches the player, in order of preference. */
  routes: RouteKind[];
  prices: string[];
  worse: string[];
  /** Default want and fear ("to …", and a plain clause). */
  want: string;
  fear: string;
  /** What the lead does at each stage (setup, rising, crisis). `{want}` is the want. */
  moves: [string, string, string];
  /** An ending that can't be undone when the fear comes true (it waits on the player under "ask"). */
  irreversible?: boolean;
}

export const SPECS: Record<ArcKind, KindSpec> = {
  pursuit: {
    kind: "pursuit", words: /\b(wants?|seeks?|search|looking for|find|get|win|earn|protect|guard|track|hunt for|recover)\b/i, clock: 6, base: 0.08, secrecy: "private",
    routes: ["carrier", "entrance", "signal"], prices: ["time", "money", "a favour owed", "someone noticed", "a tie strained"],
    worse: ["the trail went cold", "someone else got there first", "it drew the wrong attention", "a promise had to be broken"],
    want: "to get what they're after", fear: "it slips away for good", moves: ["set out {want}", "pressed on, still trying {want}", "made a last push {want}"],
  },
  scheme: {
    kind: "scheme", words: /\b(scheme|plot|conspir\w*|usurp|seize|ambition|ambitious|alliance|marry\b.*\bto|influence|power|succession|whisper|spymaster|hand of the king|leverage)\b/i, clock: 8, base: 0.07, secrecy: "secret",
    routes: ["carrier", "signal", "entrance"], prices: ["an ally's doubt", "a debt to a dangerous friend", "a witness", "coin"],
    worse: ["a confidant talked", "the rival moved first", "a letter went astray", "the plan had to change"],
    want: "to gain the upper hand", fear: "the plot comes to light", moves: ["laid the groundwork {want}", "moved a piece {want}", "made the decisive move {want}"],
  },
  rivalry: {
    kind: "rivalry", words: /\b(rival|rivalry|grudge|resent|feud|compet\w*|enemy|enemies|score to settle)\b/i, clock: 6, base: 0.07, secrecy: "private",
    routes: ["carrier", "ambient", "entrance"], prices: ["a public scene", "a friend's patience", "pride"],
    worse: ["the other side struck back", "it turned ugly in public", "someone got hurt"],
    want: "to come out on top", fear: "the other side wins", moves: ["took a swipe, trying {want}", "escalated, trying {want}", "forced a showdown, trying {want}"],
  },
  courtship: {
    kind: "courtship", words: /\b(court|courting|flirt|date|dating|crush|attract\w*|romance|in love|sweetheart|smitten)\b/i, clock: 6, base: 0.07, secrecy: "private",
    routes: ["carrier", "ambient", "entrance"], prices: ["gossip", "a friend's disapproval", "a misunderstanding"],
    worse: ["it went awkwardly wrong", "a rival appeared", "one of them pulled back"],
    want: "to be with the one they want", fear: "it falls apart before it starts", moves: ["found an excuse to be near them, hoping {want}", "risked something real, hoping {want}", "said it plainly, hoping {want}"],
  },
  rift: {
    kind: "rift", words: /\b(confront|argument|argue|fight with|falling[- ]out|estranged|betray|broke up|rift|quarrel|not speaking|trust)\b/i, clock: 4, base: 0.08, secrecy: "private",
    routes: ["carrier", "entrance", "signal"], prices: ["hard words said", "a night apart", "an apology owed"],
    worse: ["it got worse", "someone took sides", "a door was slammed"],
    want: "to mend it, or end it cleanly", fear: "the bond breaks", moves: ["tried to talk, wanting {want}", "had it out, wanting {want}", "made a choice, wanting {want}"],
  },
  debt: {
    kind: "debt", words: /\b(owe|owes|owed|debt|pay|payment|back[- ]pay|bills?|mortgage|loan|rent|collector|favou?r)\b/i, clock: 4, base: 0.06, secrecy: "private",
    routes: ["signal", "carrier", "entrance"], prices: ["interest", "a deadline moved up", "pride"],
    worse: ["the creditor lost patience", "the sum grew", "a threat was made"],
    want: "to settle what's owed", fear: "the debt comes due all at once", moves: ["dealt with the debt, wanting {want}", "scrambled, wanting {want}", "faced the reckoning, wanting {want}"],
  },
  secret: {
    kind: "secret", words: /\b(secret|hid(?:e|es|ing|den)|conceal|lie|lying|cover[- ]up|nobody knows|tell no one)\b/i, clock: 6, base: 0.06, secrecy: "secret",
    routes: ["carrier", "entrance"], prices: ["another lie", "a close call", "someone half-guessed"],
    worse: ["someone saw something", "a lie didn't hold", "a clue was left behind"],
    want: "to keep it hidden", fear: "it comes out", moves: ["covered tracks, trying {want}", "had a close call, trying {want}", "was nearly caught, trying {want}"],
  },
  decline: {
    kind: "decline", words: /\b(addict|spiral|drawn deeper|dark magic|drinking|drunk|illness|sick|dying|overdose|withdraw|craving|hooked|obsess\w*)\b/i, clock: 6, base: 0.07, secrecy: "secret",
    routes: ["carrier", "signal", "entrance"], prices: ["a lie to someone close", "money", "sleep", "a little more of themselves"],
    worse: ["it went further than meant", "someone close was hurt by it", "the cost showed"],
    want: "to stay in control", fear: "they hit bottom", moves: ["leaned on {vice} a little", "leaned on {vice} harder", "leaned on {vice} hard, with everything at stake"], irreversible: true,
  },
  investigation: {
    kind: "investigation", words: /\b(research|investigat\w*|study|studies|cross[- ]referenc\w*|case file|find out|scry|trace|evidence|clue|theory|diagnos\w*|analy\w*)\b/i, clock: 6, base: 0.08, secrecy: "private",
    routes: ["carrier", "entrance", "signal"], prices: ["a sleepless night", "a favour from an archive", "a dangerous contact"],
    worse: ["a dead end", "the lead was false", "someone noticed the questions"],
    want: "to find the answer", fear: "the answer comes too late", moves: ["followed a lead, trying {want}", "dug deeper, trying {want}", "closed in, trying {want}"],
  },
  threat: {
    kind: "threat", words: /\b(raid|attack|hunt|gang|army|war|invade|invasion|monster|demon|loot|siege|threat|danger|predator|killer|bandits?)\b/i, clock: 6, base: 0.09, secrecy: "public",
    routes: ["ambient", "trace", "carrier"], prices: ["they were seen", "one of theirs was hurt", "it took longer"],
    worse: ["someone fought back", "they lost ground", "they were beaten back"],
    want: "to take what they came for", fear: "they're driven off", moves: ["scouted, working {want}", "struck, working {want}", "went all in, working {want}"],
  },
  return: {
    kind: "return", words: /\b(return|come back|coming back|fly back|back to|homecoming|coming home|on (?:the|his|her|their) way)\b/i, clock: 6, base: 0.09, secrecy: "private",
    routes: ["signal", "carrier", "entrance"], prices: ["time", "a missed connection", "money"],
    worse: ["the journey was delayed", "something held them back", "they had second thoughts"],
    want: "to come back", fear: "they come back too late", moves: ["decided {want}", "set off, meaning {want}", "was nearly here, meaning {want}"],
  },
  duty: {
    kind: "duty", words: /\b(council|summons|summoned|orders?|duty|office|court|king|queen|lord|command|watcher|guild|church|police|army|crown)\b/i, clock: 6, base: 0.06, secrecy: "private",
    routes: ["signal", "carrier", "entrance"], prices: ["a superior's displeasure", "a rule bent", "a favour called in"],
    worse: ["the order came down harder", "a rule was broken and noted", "a superior intervened"],
    want: "to do what the post demands", fear: "the institution turns on them", moves: ["answered a summons, meaning {want}", "carried out an order, meaning {want}", "faced the institution, meaning {want}"],
  },
  life: {
    kind: "life", words: /\b(recital|work|job|shift|school|class|birthday|family|wedding|holiday|festival|dinner|rehears\w*|practice|hospital|restaurant|studio)\b/i, clock: 6, base: 0.035, secrecy: "private",
    routes: ["signal", "carrier"], prices: ["a long day", "a forgotten errand", "a small disappointment"],
    worse: ["the day went badly", "plans fell through", "a small worry grew"],
    want: "to get on with an ordinary life", fear: "the ordinary life comes apart", moves: ["went about the ordinary business of life", "had a busy stretch", "reached a small milestone"],
  },
  loss: {
    kind: "loss", words: /\b(death|died|grief|grieving|funeral|mourn|bereave|widow|orphan|buried)\b/i, clock: 4, base: 0.05, secrecy: "private",
    routes: ["carrier", "signal"], prices: ["a hard night", "an old wound reopened"],
    worse: ["the grief turned to anger", "they shut everyone out", "an argument at the grave"],
    want: "to bear it", fear: "they don't come back from it", moves: ["took the first days, trying {want}", "went through the rituals, trying {want}", "found a new shape for life, trying {want}"],
  },
  world: {
    kind: "world", words: /^$/, clock: 8, base: 0.06, secrecy: "public",
    routes: ["ambient", "trace", "signal"], prices: ["a price paid somewhere", "a road closed", "a law tightened"],
    worse: ["the pressure met resistance", "a hold strained but held"],
    want: "to move its agenda", fear: "the agenda stalls", moves: ["shifted, pressing {want}", "pressed harder, pressing {want}", "came to a head, pressing {want}"],
  },
};

const ORDER: ArcKind[] = ["return", "decline", "threat", "scheme", "investigation", "debt", "rift", "rivalry", "courtship", "loss", "secret", "duty", "life", "pursuit"];

/** The kind a piece of text suggests (a forecast, a thread, a want), or null. */
export function kindFromText(text: string): ArcKind | null {
  for (const k of ORDER) if (k !== "pursuit" && SPECS[k].words.test(text)) return k;
  return SPECS.pursuit.words.test(text) ? "pursuit" : null;
}

/** Words that belong to whoever is named nearest before them (a decline, a grief), not to the lead by default. */
const ATTRIBUTE: ArcKind[] = ["decline", "loss"];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The kind a player's own story suggests, read for what the lead does. "Valeria tells the Circle
 * about Willow's dark magic; the Circle opens an investigation" is an investigation, not Valeria's
 * decline: what is said "about" something is its topic, and a decline belongs to whoever has it.
 */
export function kindForStory(premise: string, lead: string[], others: string[]): ArcKind {
  const scores = new Map<ArcKind, number>();
  const names = [...lead.map((n) => ({ n, me: true })), ...others.map((n) => ({ n, me: false }))].filter((x) => x.n.length >= 3);
  for (const k of ORDER) {
    const re = new RegExp(SPECS[k].words.source, "gi");
    for (const m of premise.matchAll(re)) {
      const clause = premise.slice(0, m.index).split(/[.;!?]/).at(-1) ?? "";
      let w = k === "pursuit" ? 0.6 : 1;
      if (/\b(about|regarding|concerning|of how|how)\b/i.test(clause)) w *= 0.4;
      if (ATTRIBUTE.includes(k)) {
        let best = -1;
        let mine = true;
        for (const x of names) {
          const hits = [...clause.matchAll(new RegExp(`\\b${esc(x.n)}\\b`, "gi"))];
          const j = hits.length ? hits[hits.length - 1].index! : -1;
          if (j > best) {
            best = j;
            mine = x.me;
          }
        }
        if (!mine) w *= 0.2;
      }
      scores.set(k, (scores.get(k) ?? 0) + w);
    }
  }
  let kind: ArcKind = "pursuit";
  let top = 0;
  for (const k of ORDER) if ((scores.get(k) ?? 0) > top) [kind, top] = [k, scores.get(k)!];
  return kind;
}

/** A want the player's words state ("is searching for Dawn" → "to find Dawn"), or null. */
export function wantFromStory(premise: string): string | null {
  const cut = (s: string) => s.trim().split(/\s+/).slice(0, 12).join(" ").replace(/[,;:]+$/, "");
  const m = /\b(?:wants?|hopes?|needs?|tries|trying|plans?|means|intends?|is determined|sets? out|vows?|swears?|is going)\s+to\s+([^.;,!?]+)/i.exec(premise);
  if (m) return `to ${cut(m[1])}`;
  const f = /\b(?:search(?:es|ing)? for|look(?:s|ing)? for|hunt(?:s|ing)? for|track(?:s|ing)? down)\s+([^.;,!?]+)/i.exec(premise);
  if (f) return `to find ${cut(f[1])}`;
  return null;
}

/** What someone in decline leans on, from the subplot's words ("dark magic", "the bottle"), or "it". */
export function viceOf(text: string): string {
  const m = /\b(dark magic|black magic|magic|drink(?:ing)?|alcohol|the bottle|drugs?|pills|power|gambling|blood)\b/i.exec(text);
  if (!m) return "it";
  const w = m[1].toLowerCase();
  return /^(drink|drinking|alcohol)$/.test(w) ? "the bottle" : /^drug$/.test(w) ? "drugs" : w;
}

export function stageOf(cur: number, max: number): ArcStage {
  if (cur >= max) return "aftermath";
  if (cur >= max - 1) return "crisis";
  if (cur < Math.max(1, Math.ceil(max / 4))) return "setup";
  return "rising";
}

const bare = (want: string) => want.replace(/[.!]+$/, "").trim();

/** The engine's sentence for a beat. */
export function beatTemplate(opts: { kind: ArcKind; lead: string; want: string; stage: ArcStage; result: BeatResult; price?: string; worse?: string; place?: string; premise?: string }): string {
  const spec = SPECS[opts.kind];
  const i = opts.stage === "setup" ? 0 : opts.stage === "crisis" ? 2 : 1;
  const move = spec.moves[i].replace("{want}", bare(opts.want) || spec.want).replace("{vice}", viceOf(`${opts.premise ?? ""} ${opts.want}`));
  const at = opts.place ? ` (${opts.place})` : "";
  // One step of the story, not the whole of it: a win is headway, never the want met.
  if (opts.result === "win") return `${opts.lead} ${move}${at}, and it went well.`;
  if (opts.result === "cost") return `${opts.lead} ${move}${at}; it got somewhere, at a price: ${opts.price ?? spec.prices[0]}.`;
  return `${opts.lead} ${move}${at}, but it went wrong: ${opts.worse ?? spec.worse[0]}.`;
}

/** The engine's sentence for an ending. */
export function endTemplate(opts: { lead: string; want: string; fear: string; result: "met" | "price" | "lost" | "softened"; price?: string }): string {
  const want = bare(opts.want).replace(/^to\s+/i, "");
  if (opts.result === "met") return `In the end ${opts.lead} managed it: ${want}.`;
  if (opts.result === "price") return `${opts.lead} got there (${want}), but it cost: ${opts.price ?? "more than expected"}.`;
  if (opts.result === "softened") return `It nearly went badly for ${opts.lead} (${bare(opts.fear)}), but not quite.`;
  return `It went badly for ${opts.lead}: ${bare(opts.fear)}.`;
}

/** Genres lean the draw toward kinds that deliver them (02 §12). */
export const GENRE_LEAN: Record<string, ArcKind[]> = {
  horror: ["threat", "decline"], romance: ["courtship", "rift"], intrigue: ["scheme", "secret", "duty"], cozy: ["life"],
  "slice of life": ["life"], mystery: ["investigation", "secret"], noir: ["debt", "secret", "scheme"], thriller: ["threat", "scheme"],
  drama: ["rift", "loss", "decline"], fantasy: ["duty", "threat", "return"], "dark fantasy": ["threat", "decline", "scheme"], tragedy: ["loss", "decline"],
  comedy: ["courtship", "life", "rivalry"], adventure: ["pursuit", "threat"], action: ["threat", "rivalry"], survival: ["threat", "loss"],
};
