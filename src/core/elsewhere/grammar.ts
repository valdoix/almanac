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
  /** What the lead does at each stage (setup, rising, crisis), after their name. `{want}` is the want ("to …"). */
  moves: [string, string, string];
  /** Where a step that went the lead's way leaves things, in the present tense ("The trail is warm."). */
  state: string;
  /** Who `{cast}` is when the subplot names no one ("the other side"). */
  other?: string;
  /** An ending that can't be undone when the fear comes true (it waits on the player under "ask"). */
  irreversible?: boolean;
}

export const SPECS: Record<ArcKind, KindSpec> = {
  pursuit: {
    kind: "pursuit", words: /\b(wants?|seeks?|search|looking for|find|get|win|earn|protect|guard|track|hunt for|recover)\b/i, clock: 6, base: 0.08, secrecy: "private",
    routes: ["carrier", "entrance", "signal"], prices: ["it ate the whole day", "it cost money that was hard to spare", "it left a favour owed", "someone took notice", "it strained a friendship"],
    worse: ["the trail went cold", "someone else got there first", "it drew the wrong kind of attention", "a promise had to be broken"],
    want: "to get what they're after", fear: "it slips away for good", moves: ["set out {want}", "kept at it, still trying {want}", "made one last push {want}"], state: "The trail is warm.",
  },
  scheme: {
    kind: "scheme", words: /\b(scheme|plot|conspir\w*|usurp|seize|ambition|ambitious|alliance|marry\b.*\bto|influence|power|succession|whisper|spymaster|hand of the king|leverage)\b/i, clock: 8, base: 0.07, secrecy: "secret",
    routes: ["carrier", "signal", "entrance"], prices: ["an ally began to have doubts", "it meant owing a dangerous friend", "someone saw more than they should have", "it cost good coin"],
    worse: ["a confidant talked", "the rival moved first", "a letter went astray", "the plan had to change"],
    want: "to gain the upper hand", fear: "the plot comes to light", moves: ["quietly laid the groundwork {want}", "moved another piece into place, still working {want}", "made the decisive move {want}"], state: "Nobody suspects a thing.",
  },
  rivalry: {
    kind: "rivalry", words: /\b(rival|rivalry|grudge|resent|feud|compet\w*|enemy|enemies|score to settle)\b/i, clock: 6, base: 0.07, secrecy: "private",
    routes: ["carrier", "ambient", "entrance"], prices: ["it ended in a public scene", "a friend's patience wore thin", "pride took a bruising"],
    worse: ["the other side struck back", "it turned ugly in public", "someone got hurt"],
    want: "to come out on top", fear: "the other side wins", moves: ["took a swipe at {cast}", "raised the stakes with {cast}", "forced a showdown with {cast}"], other: "the other side", state: "{Lead} {has} the upper hand, for now.",
  },
  courtship: {
    kind: "courtship", words: /\b(courting|courtship|woo(?:s|ing|ed)?|flirt\w*|on a date|dating|crush on|attracted to|attraction|romance|romantic|in love|sweetheart|smitten)\b/i, clock: 6, base: 0.07, secrecy: "private",
    routes: ["carrier", "ambient", "entrance"], prices: ["people started talking", "a friend made their disapproval plain", "there was a misunderstanding to untangle"],
    worse: ["it went awkwardly wrong", "a rival turned up", "one of them pulled back"],
    want: "to be with the one they want", fear: "it falls apart before it starts", moves: ["found an excuse to be near {cast}", "risked something real with {cast}", "finally told {cast} the truth"], other: "the one who'd caught their eye", state: "{Cast} didn't seem to mind.",
  },
  rift: {
    kind: "rift", words: /\b(confront|argument|argue|fight with|falling[- ]out|estranged|betray|broke up|rift|quarrel|not speaking|trust)\b/i, clock: 4, base: 0.08, secrecy: "private",
    routes: ["carrier", "entrance", "signal"], prices: ["hard words were said", "it ended with a night apart", "now an apology is owed"],
    worse: ["it only got worse", "someone took sides", "a door was slammed"],
    want: "to set things right", fear: "the bond breaks", moves: ["tried to talk things through with {cast}", "had it out with {cast} at last", "made a choice about {cast}"], other: "the other one", state: "Things are a little easier between them.",
  },
  debt: {
    kind: "debt", words: /\b(owe|owes|owed|debt|pay|payment|back[- ]pay|bills?|mortgage|loan|rent|collector|favou?r)\b/i, clock: 4, base: 0.06, secrecy: "private",
    routes: ["signal", "carrier", "entrance"], prices: ["the interest kept climbing", "the deadline moved up", "pride had to be swallowed"],
    worse: ["the creditor lost patience", "the sum grew", "a threat was made"],
    want: "to settle what's owed", fear: "the debt comes due all at once", moves: ["chipped away at the debt to {cast}", "scrambled to pay {cast}", "faced {cast} over the debt"], other: "a creditor", state: "The debt is smaller than it was.",
  },
  secret: {
    kind: "secret", words: /\b(secret|hid(?:e|es|ing|den)|conceal|lie|lying|cover[- ]up|nobody knows|tell no one)\b/i, clock: 6, base: 0.06, secrecy: "secret",
    routes: ["carrier", "entrance"], prices: ["it took another lie", "there was one more lie to keep straight", "someone half-guessed"],
    worse: ["someone saw something", "a lie didn't hold", "a clue was left behind"],
    want: "to keep it hidden", fear: "it comes out", moves: ["covered the tracks, keeping {cast} in the dark", "had a close call with {cast}", "was nearly caught out by {cast}"], other: "everyone", state: "The secret is safe, for now.",
  },
  decline: {
    kind: "decline", words: /\b(addict|spiral|drawn deeper|dark magic|drinking|drunk|illness|sick|dying|overdose|withdraw|craving|hooked|obsess\w*)\b/i, clock: 6, base: 0.07, secrecy: "secret",
    routes: ["carrier", "signal", "entrance"], prices: ["it took a lie to someone close", "it cost money", "it cost a night's sleep", "a little more of them went with it"],
    worse: ["it went further than meant", "someone close was hurt by it", "the cost began to show"],
    want: "to stay in control", fear: "they hit bottom", moves: ["leaned on {vice} a little", "leaned on {vice} harder than before", "leaned on {vice} with everything at stake"], state: "Nobody has noticed yet.", irreversible: true,
  },
  investigation: {
    kind: "investigation", words: /\b(research|investigat\w*|inquiry|audit\w*|study|studies|cross[- ]referenc\w*|case file|find out|scry|trace|evidence|clue|theory|diagnos\w*|analy\w*)\b/i, clock: 6, base: 0.08, secrecy: "private",
    routes: ["carrier", "entrance", "signal"], prices: ["it cost a sleepless night", "it meant calling in a favour from an archive", "it meant talking to a dangerous contact"],
    worse: ["it ran into a dead end", "the lead turned out to be false", "someone noticed the questions"],
    want: "to find the answer", fear: "the answer comes too late", moves: ["followed up a lead, trying {want}", "dug deeper, still trying {want}", "closed in on the answer"], state: "The answer is coming into focus.",
  },
  threat: {
    kind: "threat", words: /\b(raid|attack|hunt|gang|army|war|invade|invasion|monster|demon|loot|siege|threat|danger|predator|killer|bandits?)\b/i, clock: 6, base: 0.09, secrecy: "public",
    routes: ["ambient", "trace", "carrier"], prices: ["they were seen", "one of theirs was hurt", "it took longer than planned"],
    worse: ["someone fought back", "they lost ground", "they were beaten back"],
    want: "to take what they came for", fear: "they're driven off", moves: ["scouted the ground, getting ready {want}", "struck at {town}", "threw everything at {town}"], state: "{Town} is feeling it.",
  },
  return: {
    kind: "return", words: /\b(return|come back|coming back|fly back|back to|homecoming|coming home|on (?:the|his|her|their) way)\b/i, clock: 6, base: 0.09, secrecy: "private",
    routes: ["signal", "carrier", "entrance"], prices: ["it took longer than hoped", "a connection was missed", "it cost more than planned"],
    worse: ["the journey was delayed", "something held them back", "second thoughts crept in"],
    want: "to come back", fear: "they come back too late", moves: ["decided {want}", "set off for {town}", "is nearly back in {town}"], state: "{Lead} {is} on the way.",
  },
  duty: {
    kind: "duty", words: /\b(council|summons|summoned|orders?|duty|office|court|king|queen|lord|command|watcher|guild|church|police|army|crown)\b/i, clock: 6, base: 0.06, secrecy: "private",
    routes: ["signal", "carrier", "entrance"], prices: ["a superior was displeased", "a rule had to bend", "a favour was called in"],
    worse: ["the order came down harder", "a broken rule was noted", "a superior stepped in"],
    want: "to do what the post demands", fear: "the institution turns on them", moves: ["answered a summons, still trying {want}", "carried out an order", "was called to account by the higher-ups"], state: "The higher-ups are satisfied, for now.",
  },
  life: {
    kind: "life", words: /\b(recital|work|job|shift|school|class|birthday|family|wedding|holiday|festival|dinner|rehears\w*|practice|hospital|restaurant|studio)\b/i, clock: 6, base: 0.035, secrecy: "private",
    routes: ["signal", "carrier"], prices: ["it made for a long day", "an errand was forgotten", "there was a small disappointment"],
    worse: ["the day went badly", "plans fell through", "a small worry grew"],
    want: "to get on with an ordinary life", fear: "the ordinary life comes apart", moves: ["went about the ordinary business of life", "had a busy stretch", "reached a small milestone"], state: "",
  },
  loss: {
    kind: "loss", words: /\b(death|died|grief|grieving|funeral|mourn|bereave|widow|orphan|buried)\b/i, clock: 4, base: 0.05, secrecy: "private",
    routes: ["carrier", "signal"], prices: ["it made for a hard night", "an old wound opened again"],
    worse: ["grief turned to anger", "they shut everyone out", "there was an argument at the graveside"],
    want: "to bear it", fear: "they don't come back from it", moves: ["got through the first days", "went through the rituals of grief", "began to find a new shape for life"], state: "The worst days are behind {lead}.",
  },
  world: {
    kind: "world", words: /^$/, clock: 8, base: 0.06, secrecy: "public",
    routes: ["ambient", "trace", "signal"], prices: ["somewhere, a price was paid", "a road was closed", "a law tightened"],
    worse: ["the pressure met resistance", "a hold strained but held"],
    want: "to move its agenda", fear: "the agenda stalls", moves: ["shifted", "pressed harder", "came to a head"], state: "",
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

const ROOMISH = /\b(house|home|crypt|shop|store|library|school|hall|church|chapel|temple|bar|pub|club|office|station|hospital|room|kitchen|caf[eé]|inn|tavern|residence|manor|castle|keep|camp|warehouse|factory|park|cemetery|graveyard|mansion|apartment|flat|motel|hotel|diner|lab|garage|docks?|market)\b/i;
/** "at the Magic Box", "in England": where a beat happened, as a phrase. */
export function atPlace(place: string): string {
  const last = place.split(/\s*›\s*/).at(-1)!.trim();
  return `${ROOMISH.test(last) ? "at" : "in"} ${last}`;
}

const GROUPISH = /\b(council|circle|guild|order|court|coven|brotherhood|sisterhood|army|church|company|society|clan|cult|gang|family|police|crown)\b/i;
/** A group as the subject of a sentence: "the Hellions", "the Watchers Council", "Wolfram & Hart". */
export function groupName(name: string): string {
  if (/^the\s/i.test(name)) return `the ${name.slice(4)}`;
  return (isPluralName(name) || GROUPISH.test(name)) ? `the ${name}` : name;
}
/** "Hellions" takes "are"; "the Watchers Council" and "Wolfram & Hart" take "is". */
const isPluralName = (name: string) => /^[A-Z][\w'’-]*s$/.test(name.split(/\s+/).at(-1)!) && !/&/.test(name);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sentence = (s: string) => {
  const t = s.trim().replace(/[;,:\s]+$/, "");
  return t ? `${cap(t)}${/[.!?…”"]$/.test(t) ? "" : "."}` : "";
};

export interface BeatWords {
  kind: ArcKind; lead: string; want: string; stage: ArcStage; result: BeatResult; price?: string; worse?: string; place?: string; premise?: string; group?: boolean;
  /** The first other person in it (whom the lead courts, owes, fights). */
  cast?: string;
  /** The town the story is in (where a raid lands, where someone returns to). */
  town?: string;
  /** News the lead holds that the subplot rests on ("Buffy is alive again"): what a return begins with. */
  news?: string;
  /** Something another subplot took from someone in this one, that this one is about (Willow's magic). */
  without?: { person: string; thing: string };
}

/**
 * The engine's words for a beat: what happened, specifically, then where it leaves things.
 * "Giles heard that Buffy is alive again. Giles is thinking of coming back to Sunnydale."
 */
export function beatTemplate(o: BeatWords): string {
  const spec = SPECS[o.kind];
  const i = o.stage === "setup" ? 0 : o.stage === "crisis" ? 2 : 1;
  const want = bare(o.want) || spec.want;
  const lead = o.group ? groupName(o.lead) : o.lead;
  const plural = !!o.group && isPluralName(o.lead);
  const town = o.town || "town";
  const cast = o.cast || spec.other || "someone";
  const fill = (t: string) => t.replace(/\{want\}/g, want).replace(/\{vice\}/g, viceOf(`${o.premise ?? ""} ${o.want}`)).replace(/\{cast\}/g, cast).replace(/\{Cast\}/g, cap(cast))
    .replace(/\{town\}/g, town).replace(/\{Town\}/g, cap(town)).replace(/\{lead\}/g, lead).replace(/\{Lead\}/g, cap(lead)).replace(/\{is\}/g, plural ? "are" : "is").replace(/\{has\}/g, plural ? "have" : "has");
  // Where it happened leads the sentence ("At the crypt, Spike…"), so it never reads as where the one sought is.
  const placeWord = o.place ? o.place.split(/\s*›\s*/).at(-1)!.toLowerCase() : "";
  const where = o.place && !want.toLowerCase().includes(placeWord) && placeWord !== town.toLowerCase() ? `${cap(atPlace(o.place))}, ` : "";
  let first = `${where}${where ? lead : cap(lead)} ${fill(spec.moves[i])}.`;
  let state = fill(spec.state);
  // What was taken changes the step: a decline without its means is the want of it; anyone else goes on without it.
  if (o.without) {
    const mine = o.without.person.toLowerCase() === o.lead.toLowerCase();
    if (o.kind === "decline" && mine) {
      const thing = `the ${o.without.thing.replace(/^dark\s+/, "")}`;
      first = `${where}${where ? lead : cap(lead)} ${["felt the loss of " + thing + " and hid how much it hurt", "went looking for a way to get " + thing + " back", "came close to something desperate to get " + thing + " back"][i]}.`;
      state = "Nobody has seen how bad it is yet.";
    } else first = `With ${o.without.person}'s ${o.without.thing} gone, ${where ? `${where.charAt(0).toLowerCase()}${where.slice(1)}` : ""}${lead} ${fill(spec.moves[i])}.`;
  }
  // A return begins with the news that brings them back.
  if (o.kind === "return") {
    if (i === 0) {
      first = o.news ? `${cap(lead)} heard that ${o.news.replace(/[.!]+$/, "")}.` : first;
      state = `${cap(lead)} ${plural ? "are" : "is"} thinking of coming back to ${town}.`;
    } else if (i === 2) first = `${cap(lead)} ${plural ? "are" : "is"} nearly back in ${town}.`;
  }
  // One step, not the whole story: a win is headway, never the want met.
  const then = o.result === "win" ? state : o.result === "cost" ? sentence(o.price ?? spec.prices[0]) : sentence(o.worse ?? spec.worse[0]);
  return then ? `${first} ${then}` : first;
}

/** Endings that say what was concluded, before what it came to. */
const END_FIRST: Partial<Record<ArcKind, (x: { lead: string; cast: string; town: string }) => string>> = {
  investigation: (x) => `${cap(x.lead)} concluded the investigation.`,
  return: (x) => `${cap(x.lead)} came back to ${x.town}.`,
  rivalry: (x) => `It came to a head between ${x.lead} and ${x.cast}.`,
  rift: (x) => `${cap(x.lead)} and ${x.cast} had it out for the last time.`,
  debt: (x) => `The debt to ${x.cast} came due.`,
  scheme: (x) => `${cap(x.lead)} made the final move.`,
  threat: (x) => `${cap(x.lead)} made ${x.lead.startsWith("the ") ? "their" : "a"} last push on ${x.town}.`,
};

const PAST: Record<string, string> = {
  slips: "slipped", comes: "came", come: "came", wins: "won", win: "won", falls: "fell", fall: "fell", breaks: "broke", turns: "turned", stalls: "stalled", fails: "failed", fail: "failed",
  dies: "died", die: "died", loses: "lost", lose: "lost", gets: "got", goes: "went", go: "went", has: "had", have: "had", is: "was", are: "were", "don't": "didn't", "doesn't": "didn't",
  "they're": "they were", "it's": "it was", "he's": "he was", "she's": "she was", ends: "ended", starts: "started", catches: "caught", finds: "found", wears: "wore", grows: "grew",
};
/** A fear as what came true: "they come back too late" → "Giles came back too late". */
function cameTrue(fear: string, lead: string, group: boolean): string {
  let t = fear.replace(/[\w']+/g, (w) => (PAST[w.toLowerCase()] ? (w[0] === w[0].toUpperCase() ? cap(PAST[w.toLowerCase()]) : PAST[w.toLowerCase()]) : w));
  if (!group) t = t.replace(/^they were\b/i, `${lead} was`).replace(/^they\b/i, lead);
  return sentence(t);
}

/** The engine's words for an ending. */
export function endTemplate(o: { kind?: ArcKind; lead: string; want: string; fear: string; result: "met" | "price" | "lost" | "softened"; price?: string; group?: boolean; cast?: string; town?: string }): string {
  const want = bare(o.want);
  const fear = bare(o.fear).replace(/^(?:that|the fear that)\s+/i, "");
  const lead = o.group ? groupName(o.lead) : o.lead;
  const firstLine = o.kind && END_FIRST[o.kind] && !(o.kind === "return" && o.result === "lost") ? `${END_FIRST[o.kind]!({ lead, cast: o.cast || SPECS[o.kind].other || "the other side", town: o.town || "town" })} ` : "";
  if (o.result === "met") return `${firstLine}In the end, ${lead} managed ${want}.`;
  if (o.result === "price") return `${firstLine}In the end, ${lead} managed ${want}. ${sentence(o.price ?? "it cost more than anyone expected")}`;
  if (o.result === "softened") return `${firstLine}${cap(lead)} came close to the worst, but it didn't come to that.`;
  return `${firstLine}It went badly for ${lead}. ${cameTrue(fear, lead, !!o.group)}`;
}

/** Genres lean the draw toward kinds that deliver them (02 §12). */
export const GENRE_LEAN: Record<string, ArcKind[]> = {
  horror: ["threat", "decline"], romance: ["courtship", "rift"], intrigue: ["scheme", "secret", "duty"], cozy: ["life"],
  "slice of life": ["life"], mystery: ["investigation", "secret"], noir: ["debt", "secret", "scheme"], thriller: ["threat", "scheme"],
  drama: ["rift", "loss", "decline"], fantasy: ["duty", "threat", "return"], "dark fantasy": ["threat", "decline", "scheme"], tragedy: ["loss", "decline"],
  comedy: ["courtship", "life", "rivalry"], adventure: ["pursuit", "threat"], action: ["threat", "rivalry"], survival: ["threat", "loss"],
};
