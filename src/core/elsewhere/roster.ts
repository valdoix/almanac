// The roster (design/09 §4): everyone the story knows, from the page, the card, the persona and
// the lorebooks, each with a standing (alive here, away, captive, dead, a pet…), where they are,
// how far that is from the scene, what drives them, whom they're tied to, and what they know.

import type { CodexRecord } from "../codex";
import type { CharacterState, ElsewhereConfig, KnowStatus, Standing, WorldState } from "../types";
import { slug } from "../util";

export type Ring = "onstage" | "offstage" | "unmet";
export type Reach = "house" | "town" | "region" | "far" | "none";

export interface Tie {
  to: string;
  strength: 1 | 2 | 3;
  kind: string;
}

export interface Known {
  key: string;
  statement: string;
  status: KnowStatus;
  route?: string;
  from?: string;
}

export interface Actor {
  key: string;
  name: string;
  names: string[];
  charId?: string;
  recordId?: string;
  ring: Ring;
  standing: Standing;
  /** Where they are now (whereabouts, last seen, or the lore), and where they live. */
  where?: string;
  base?: string;
  reach: Reach;
  drives: { want?: string; fear?: string; role?: string; tension?: string };
  ties: Tie[];
  routine?: string;
  owner?: string;
  nocturnal: boolean;
  /** The message they were last on the page (-1: never). */
  lastPage: number;
  protected: boolean;
  flags: { out?: boolean; wake?: boolean; offPage?: boolean };
  /** Who they are, in a line (for capsules and cards). */
  text: string;
  /** Lore and Codex text used for matching (not sent). */
  lore: string;
  knows: Known[];
  /** Means: +1 (money, power, magic, office), 0, or −1 (a child, powerless). */
  means: number;
  /** A group the story tracks (a faction, a gang, a council) rather than a person. */
  group?: boolean;
}

export interface Profile {
  standing?: Standing;
  where?: string;
  reach?: Reach;
  want?: string;
  fear?: string;
  nocturnal?: boolean;
  hash: string;
}

export interface RosterInput {
  state: WorldState;
  records: CodexRecord[];
  userName: string;
  notPeople?: string[];
  people?: ElsewhereConfig["people"];
  profiles?: Record<string, Profile>;
}

export interface Roster {
  actors: Actor[];
  groups: Actor[];
  /** The actor a name (or alias, or unique first or last name) belongs to. */
  find(name: string | undefined): Actor | undefined;
  byKey(key: string): Actor | undefined;
  /** Place names the story knows locally (scene, visited places, lore places). */
  local: string[];
  /** How news and calls travel in this setting. */
  medium: "phone" | "letter" | "raven";
  /** The town the story is in (the top of the place paths it visits most). */
  town?: string;
  userName: string;
}

export const TRAVEL: Record<Reach, number> = { house: 0, town: 30, region: 240, far: 960, none: Infinity };
export const REACH_WEIGHT: Record<Reach, number> = { house: 1, town: 0.8, region: 0.5, far: 0.3, none: 0 };

const low = (s: string) => s.toLowerCase().replace(/[’]/g, "'").trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const firstSentence = (t: string) => (/^[\s\S]*?[.!?](?:\s|$)/.exec(t)?.[0] ?? t);

const CLOSE = "mother|father|mum|mom|dad|sister|brother|son|daughter|wife|husband|girlfriend|boyfriend|fianc[eé]e?|lover|partner|mentor|best friend|closest friend|twin|sire|ward|guardian|betrothed|consort|parent|child|children|sibling";
const EXTENDED = "uncle|aunt|cousin|nephew|niece|grandmother|grandfather|grandson|granddaughter|ex-girlfriend|ex-boyfriend|ex|heir|patriarch|matriarch";
const FAMILY = `${CLOSE}|${EXTENDED}`;
const WORK = "watcher|doctor|physician|bodyguard|servant|employer|boss|maid|squire|liege|knight|master|apprentice|assistant|friend|ally|confidante?|handler|teacher|student|lawyer|attorney|captain|rider";
const FAR = /\b(England|London|Bath|Europe|abroad|overseas|Ireland|Scotland|Wales|France|Germany|Italy|Spain|Rome|Paris|Russia|China|Japan|India|Africa|Asia|Australia|Brazil|Mexico|Canada|Essos|Pentos|Braavos|Volantis|Lys|Myr|Tyrosh|Qarth|Dorne|Winterfell|the Wall|Oldtown|Sunspear|across the (?:sea|narrow sea|ocean)|another country|the continent)\b/i;
const ANIMAL = /\b(cat|dog|kitten|puppy|horse|stallion|mare|dragon|wolf|direwolf|hound|pet|familiar|owl|raven|falcon|hawk|bird|snake|mount|steed)\b/i;
const MEANS_UP = /\b(rich|wealthy|heir|lord|lady|king|queen|prince|princess|knight|witch|wizard|mage|sorcer|warlock|powerful|council|gang|leader|leads|doctor|physician|surgeon|lawyer|attorney|police|soldier|vampire|demon|slayer|dragon|rider|hand of the king|master of|commander|director|holdings|baronet|noble)\b/i;
const MEANS_DOWN = /(?<![\w-])(little girl|little boy|toddler|baby|powerless|penniless|destitute|(?:[1-9]|1[0-5])[- ]year[- ]old|(?:seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)[- ]year[- ]old)\b/i;
const NOCTURNAL = /\b(vampire|nocturnal|creature of the night|undead)\b/i;
/** Hunting vampires doesn't make you keep their hours: "a Vampire Slayer" is up by day. */
const SLAYS_THEM = /\b(?:vampire|undead)[- ](?:slayers?|hunters?|killers?)\b|\b(?:slayers?|hunters?|killers?) of (?:vampires|the undead)\b/gi;

/** The standing and whereabouts the lore text gives, if any. */
export function readStanding(text: string): { standing?: Standing; where?: string; owner?: string } {
  const first = firstSentence(text);
  const out: { standing?: Standing; where?: string; owner?: string } = {};
  const dead = /\b(died|was killed|is dead|deceased|was murdered|passed away|was slain|perished)\b/i.exec(first);
  if (dead && !/\b(when|after|whose|who|since|before|until|because|whom)\b/i.test(first.slice(0, dead.index))) return { standing: "dead" };
  if (/\b(robot|android|golem|automaton|construct)\b/i.test(first) && /\bis (?:an? |the )?(?:[\w'’,-]+ ){0,4}?(?:robot|android|golem|automaton|construct)\b/i.test(first)) out.standing = "construct";
  const animal = /\bis (?:an? |the )?(?:(?!(?:who|that|which|in|with|and|of)\b)[\w'’,-]+ ){0,10}?(?:[\w'’]+-)?(cat|dog|kitten|puppy|horse|stallion|mare|dragon|wolf|direwolf|hound|pet|familiar|owl|raven|falcon|hawk|bird|snake|mount|steed)\b/i.exec(first);
  if (!out.standing && animal && ANIMAL.test(animal[1])) {
    out.standing = "companion";
    const owner = /(?:belongs to|ridden by|owned by|companion of|pet of|claimed by|rider is)\s+((?:[A-Z][\w'’-]+\s?){1,3})/.exec(text)?.[1] ?? /\bis ((?:[A-Z][\w'’-]+ ){0,3}[A-Z][\w-]+?)(?:'s|’s|s'|’)\s/.exec(first)?.[1];
    if (owner) out.owner = owner.trim().replace(/^(Princess|Prince|Queen|King|Lady|Lord|Ser|Sir)\s+/, "");
    return out;
  }
  if (!out.standing && /\b(trapped as an?|turned into an?|transformed into an?|cursed (?:into|as) an?|stuck as an?)\b/i.test(text)) out.standing = "changed";
  if (!out.standing && /\b(in prison|imprisoned|in jail|jailed|held captive|a captive|serving a (?:prison )?sentence|locked (?:up|away)|in chains|in the dungeons?|incarcerated|in the black cells)\b/i.test(text)) out.standing = "captive";
  const leftTown = /\bleft ([A-Z][\w'’-]+)\b/.exec(first);
  if (leftTown && !/\bleft (?:for|behind)\b/.test(leftTown[0])) out.standing = out.standing ?? "away";
  const place = /\b(?:left for|has left for|moved to|lives in|living in|based in|is now in|now lives in|stationed (?:in|at)|exiled to|went back to|returned to|serving in)\s+((?:the )?[A-Z][\w'’-]+(?:[ -](?:of |the )?[A-Z][\w'’-]+)*)/.exec(text)
    ?? /\b(?:in|at) ((?:[A-Z][a-z'’-]+)(?: [A-Z][a-z'’-]+)*)(?![\w'’]*['’]s)/.exec(first)
    ?? /\b(?:an? |the )(?:[a-z]+ )?((?:[A-Z][a-z]+)(?: [A-Z][a-z]+)+) (?:hospital|firm|company|office|school|university|restaurant|studio|agency)\b/.exec(first);
  if (place) out.where = place[1].trim();
  if (!out.standing && (/\b(left for|has left|moved away|went back to|exiled|abroad|overseas)\b/i.test(first) || (out.where && FAR.test(out.where)))) out.standing = "away";
  return out;
}

function recordText(r: CodexRecord): string {
  const b = r.body ?? {};
  return [b.lore, r.provenance.source === "story" ? "" : r.summary, b.archivist, typeof b.role === "string" ? b.role : ""].filter(Boolean).join(" ");
}

export function buildRoster(input: RosterInput): Roster {
  const { state: st, records, userName } = input;
  const notPeople = new Set((input.notPeople ?? []).map(low));
  const people = input.people ?? {};
  const actors: Actor[] = [];
  const seenChar = new Set<string>();

  // Places the story knows here: the scene, places visited, places in the lore.
  const local = new Set<string>();
  const townName = storyTown(st, records);
  const town = townName ? low(townName) : undefined;
  for (const p of st.place) local.add(low(p));
  for (const p of Object.values(st.places)) if (!town || low(p.path[0] ?? p.name) === town) for (const seg of [p.name, ...p.path]) local.add(low(seg));
  const placeRecords = records.filter((r) => r.kind === "place");
  for (let pass = 0; pass < 3; pass++) for (const r of placeRecords) {
    const parent = typeof r.body?.parent === "string" ? low(r.body.parent) : "";
    if (!town || local.has(low(r.name)) || (parent && local.has(parent))) local.add(low(r.name));
  }
  const localList = [...local].filter((x) => x.length >= 3);
  const isLocal = (w: string) => {
    const l = low(w);
    return localList.some((x) => l === x || (x.length >= 4 && (l.includes(x) || x.includes(l))));
  };
  const scene = st.place.map(low);
  const placeRecs = records.filter((r) => r.kind === "place");

  const add = (a: Actor) => actors.push(a);
  for (const r of records) {
    if (r.kind !== "person") continue;
    const charId = r.id.startsWith("char:") && st.chars[r.id.slice(5)] ? r.id.slice(5) : undefined;
    const c: CharacterState | undefined = charId ? st.chars[charId] : undefined;
    if (c?.isUser || r.id === "char:user" || low(r.name) === low(userName)) continue;
    if (charId) seenChar.add(charId);
    const names = [...new Set([r.name, ...(r.aliases ?? []), ...(c ? [c.name, ...c.aliases] : [])].filter(Boolean))];
    if (names.some((n) => notPeople.has(low(n)))) continue;
    const loreText = recordText(r);
    // A name the story picked up that was never a person ("house", "Dawn's"): no lore, never spoke, no bonds.
    if (c && !r.body?.lore && r.provenance.source === "story" && !c.voiced && !Object.values(st.bonds).some((b) => b.from === c.id || b.to === c.id)) continue;
    const ring: Ring = c && (c.tier === "spot" || c.tier === "peri") ? "onstage" : c && ((c.castSeen ?? 0) > 0 || c.arrivedMsg != null || c.voiced && c.lastSeen > c.firstSeen) ? "offstage" : "unmet";
    const key = charId ?? slug(r.id.replace(/^char:/, "")) ?? slug(r.name);
    const pref = people[low(r.name)] ?? names.map((n) => people[low(n)]).find(Boolean) ?? {};
    const prof = input.profiles?.[key];
    const read = readStanding(loreText);
    const loreDead = r.status === "dead" && !c && !/\b(when|after|since|before|until)\b[^.]{0,40}\b(died|was killed|perished)\b/i.test(loreText);
    let standing: Standing = pref.standing ?? prof?.standing ?? (c?.dead || (c && r.status === "dead") || loreDead ? "dead" : c && ring !== "unmet" && read.standing === "dead" ? "here" : read.standing ?? "here");
    if (c && ring === "onstage" && standing !== "companion" && standing !== "construct") standing = c.dead ? "dead" : "here";
    const wa = st.whereabouts?.[low(r.name)] ?? names.map((n) => st.whereabouts?.[low(n)]).find(Boolean);
    let base: string | undefined;
    for (const p of placeRecs) {
      const s = `${p.summary} ${p.body?.lore ?? ""}`;
      if (names.some((n) => n.length >= 3 && new RegExp(`\\b${esc(n)}(?:'s|’s)?\\b[^.]*\\b(lives|home|sleeps|works|keeps)\\b|\\bwhere ${esc(n)} (lives|sleeps|works)`, "i").test(s))) base = p.name;
    }
    const lastPlace = c && ring === "offstage" && c.place && /^\p{Lu}/u.test(c.place) && isLocal(c.place) ? c.place : undefined;
    const where = pref.where ?? wa?.place ?? (ring === "onstage" ? c?.place : lastPlace) ?? prof?.where ?? read.where ?? base;
    let reach: Reach;
    if (ring === "onstage") reach = "house";
    else if (standing === "dead" || standing === "changed") reach = "none";
    else if (prof?.reach && !pref.where && !wa) reach = prof.reach;
    else if (where) {
      const w = low(where);
      reach = scene.length >= 2 && scene.slice(1).some((x) => x === w || (w.length >= 5 && x.includes(w))) ? "house" : isLocal(where) ? "town" : FAR.test(where) ? "far" : "region";
    } else if (ring === "offstage") reach = "town";
    else reach = localList.some((x) => x.length >= 4 && low(loreText).includes(x)) ? "town" : "region";
    if (standing === "away" && (reach === "house" || reach === "town") && !wa && !pref.where) reach = "far";
    const b = r.body ?? {};
    const role = typeof b.role === "string" ? b.role : undefined;
    add({
      key, name: c?.name ?? r.name, names, charId, recordId: r.id, ring, standing, where, base, reach,
      drives: { want: prof?.want ?? (typeof b.want === "string" ? b.want : undefined), fear: prof?.fear ?? (typeof b.fear === "string" ? b.fear : undefined), role, tension: typeof b.tension === "string" ? b.tension : undefined },
      ties: [], routine: typeof b.routine === "string" ? b.routine : undefined, owner: read.owner,
      nocturnal: prof?.nocturnal ?? NOCTURNAL.test(`${role ?? ""} ${loreText}`.replace(SLAYS_THEM, "")),
      lastPage: c && ring !== "unmet" ? c.lastSeen : -1,
      protected: !!b.lore || r.provenance.source === "lore" || ring !== "unmet",
      flags: { out: pref.out, wake: pref.wake, offPage: pref.offPage },
      text: (r.provenance.source === "lore" ? r.summary : (b.lore as string) || (b.archivist as string) || r.summary || "").slice(0, 300),
      lore: loreText, knows: [], means: MEANS_DOWN.test(loreText) ? -1 : MEANS_UP.test(`${role ?? ""} ${loreText}`) ? 1 : 0,
    });
  }

  // Groups the story tracks: factions with clocks, and lore groups.
  const groups: Actor[] = [];
  const groupNames = new Set<string>();
  for (const f of Object.values(st.factions)) {
    groupNames.add(low(f.name));
    groups.push(groupActor(f.name, `fac:${slug(f.name)}`, records.find((r) => r.kind === "group" && low(r.name).includes(low(f.name)))?.summary ?? "", isLocal));
  }
  for (const r of records) if (r.kind === "group" && !groupNames.has(low(r.name)) && ![...groupNames].some((g) => low(r.name).includes(g))) groups.push(groupActor(r.name, r.id, `${r.summary} ${r.body?.lore ?? ""}`, isLocal));

  // Name lookup: full names and aliases, then unique first or last names.
  const exact = new Map<string, Actor>();
  for (const a of [...actors, ...groups]) for (const n of a.names) if (!exact.has(low(n))) exact.set(low(n), a);
  // "The Witches' Circle" is also "Witches' Circle" when a sentence names it.
  for (const g of groups) for (const n of g.names) if (/^the\s+/i.test(n) && !exact.has(low(n).replace(/^the\s+/, ""))) exact.set(low(n).replace(/^the\s+/, ""), g);
  const part = new Map<string, Actor | null>();
  for (const a of actors) for (const n of a.names) {
    const t = n.split(/\s+/).filter((w) => w.length >= 3 && /^[A-Z]/.test(w) && !/^(the|of|and|lady|lord|ser|sir|king|queen|prince|princess|mr|mrs|ms|dr)$/i.test(w));
    for (const w of t) {
      const k = low(w);
      if (exact.has(k) && exact.get(k) !== a) continue;
      part.set(k, part.has(k) && part.get(k) !== a ? null : a);
    }
  }
  const find = (name: string | undefined): Actor | undefined => {
    if (!name) return undefined;
    const l = low(name).replace(/^(the)\s+/, "");
    return exact.get(l) ?? part.get(l) ?? undefined;
  };
  const byKey = (key: string) => actors.find((a) => a.key === key) ?? groups.find((g) => g.key === key);

  // Ties: bonds, lore links, family and work words, shared forecasts and situations, mentions.
  const tie = (a: Actor | undefined, b: string | undefined, strength: 1 | 2 | 3, kind: string) => {
    if (!a || !b || a.key === b) return;
    const t = a.ties.find((x) => x.to === b);
    if (!t) a.ties.push({ to: b, strength, kind });
    else if (strength > t.strength) Object.assign(t, { strength, kind });
  };
  const both = (a: Actor | undefined, b: Actor | undefined | "user", strength: 1 | 2 | 3, kind: string) => {
    if (!a || !b) return;
    const bk = b === "user" ? "user" : b.key;
    tie(a, bk, strength, kind);
    if (b !== "user") tie(b, a.key, strength, kind);
  };
  const byChar = new Map(actors.filter((a) => a.charId).map((a) => [a.charId!, a]));
  for (const bd of Object.values(st.bonds)) {
    const from = byChar.get(bd.from);
    const to = bd.to === "user" ? "user" : byChar.get(bd.to);
    const mag = Math.max(0, ...Object.values(bd.axes).map((v) => Math.abs(v ?? 0)));
    both(from, to, mag >= 3 ? 3 : mag >= 1 ? 2 : 1, "bond");
  }
  const userNames = [userName, userName.split(/\s+/)[0]].filter((n) => n && n.length >= 3);
  const named = (a: Actor) => (a.names.length ? [...a.names, ...a.names.flatMap((n) => n.split(/\s+/).filter((w) => w.length >= 3 && part.get(low(w)) === a))] : []);
  const strongRe = (n: string) => new RegExp(`\\b${esc(n)}(?:'s|’s|'|’)\\s+(?:[\\w-]+\\s+){0,3}?(${FAMILY}|${WORK})\\b|\\b(${FAMILY}|${WORK})\\s+(?:of|to)\\s+(?:[\\w-]+\\s+){0,2}?${esc(n)}\\b`, "i");
  for (const a of actors) {
    if (!a.lore) continue;
    const others: (Actor | "user")[] = [...actors.filter((x) => x !== a), "user"];
    for (const o of others) {
      const ns = o === "user" ? userNames : named(o);
      for (const n of ns) {
        if (!new RegExp(`\\b${esc(n)}\\b`).test(a.lore)) continue;
        const m = strongRe(n).exec(a.lore);
        const word = (m?.[1] ?? m?.[2] ?? "").toLowerCase();
        const estranged = /\b(estranged|drifted out of|cut (?:off|ties)|abandoned|walked out on|no contact|disowned|out of (?:his|her|their) (?:\w+['’] )?lives)\b/i.test(a.lore);
        const former = !!word && new RegExp(`\\b(former|ex-|one-time|once)\\s*(?:[\\w-]+\\s+){0,2}(?:and\\s+)?(?:[\\w-]+\\s+)?${word}`, "i").test(a.lore);
        both(a, o, m ? (estranged ? 1 : former ? 2 : new RegExp(`^(${CLOSE})$`, "i").test(word) ? 3 : 2) : 1, m ? (estranged ? `${word}, estranged` : former ? `former ${word}` : word) : "mention");
        break;
      }
    }
  }
  for (const r of records) {
    const list: string[] = [...(Array.isArray(r.body?.participants) ? r.body.participants : []), ...(Array.isArray(r.body?.members) ? r.body.members : [])].map(String);
    if (list.length < 2) continue;
    const who = list.map((n) => (userNames.some((u) => low(u) === low(n)) ? ("user" as const) : find(n))).filter(Boolean) as (Actor | "user")[];
    const s: 1 | 2 = r.kind === "group" ? 1 : 2;
    for (let i = 0; i < who.length; i++) for (let j = i + 1; j < who.length; j++) {
      const x = who[i], y = who[j];
      if (x === "user") both(y as Actor, "user", s, r.kind);
      else both(x, y, s, r.kind);
    }
  }
  for (const a of actors) if (a.owner) both(a, find(a.owner) ?? (userNames.some((u) => low(u) === low(a.owner!)) ? "user" : undefined), 3, "owner");
  // A group's leader and members.
  for (const g of groups) for (const a of actors) {
    if (new RegExp(`\\b(leads?|heads?|runs?|member of|serves?|works for)\\b[^.]*\\b${esc(g.name)}`, "i").test(a.lore)) both(a, g, /\b(leads?|heads?|runs?)\b/i.test(a.lore) ? 3 : 2, "member");
  }

  // What each person knows.
  for (const f of Object.values(st.facts ?? {})) {
    if (f.hidden) continue;
    for (const [holder, s] of Object.entries(f.stances)) {
      const a = byChar.get(holder);
      if (a && (s.status === "knows" || s.status === "believes" || s.status === "suspects")) a.knows.push({ key: f.key, statement: f.statement, status: s.status, route: s.route, from: s.from });
    }
  }

  const all = `${records.map((r) => `${r.summary} ${r.body?.lore ?? ""}`).join(" ")}`;
  const medium = /\b(raven|maester|scroll|messenger bird)\b/i.test(all) ? "raven" : /\b(phone|cell|car|radio|television|TV|computer|internet|e-?mail|police|hospital|motorcycle|helicopter|apartment)\b/i.test(all) ? "phone" : "letter";
  return { actors, groups, find, byKey, local: localList, medium, userName, town: townName };
}

/**
 * The town the story is in: the top of the place paths it visits most, climbed through the
 * lore's parents while the parent is itself a known place (Winters Residence → Sunnydale).
 */
export function storyTown(st: WorldState, records: CodexRecord[] = []): string | undefined {
  const parent = new Map<string, string>();
  const known = new Map<string, string>();
  for (const r of records) if (r.kind === "place") {
    known.set(low(r.name), r.name);
    if (typeof r.body?.parent === "string") parent.set(low(r.name), r.body.parent);
  }
  // Climb only to places the story has been in: the region above the town ("Southern California") it never visits.
  const visited = new Set([...st.place, ...Object.values(st.places).flatMap((p) => [p.name, ...p.path])].map(low));
  let t = topPlace(st);
  for (let i = 0; t && i < 6; i++) {
    const up = parent.get(low(t));
    if (!up || !known.has(low(up)) || !visited.has(low(up))) break;
    t = known.get(low(up));
  }
  return t;
}

function topPlace(st: WorldState): string | undefined {
  const count = new Map<string, { name: string; n: number }>();
  for (const p of Object.values(st.places)) {
    const top = p.path[0] ?? p.name;
    if (!top) continue;
    const k = low(top);
    count.set(k, { name: top, n: (count.get(k)?.n ?? 0) + Math.max(1, p.visits) * (p.path.length > 1 ? 2 : 1) });
  }
  const best = [...count.values()].sort((a, b) => b.n - a.n)[0];
  return best?.name ?? st.place[0];
}

function groupActor(name: string, id: string, text: string, isLocal: (w: string) => boolean): Actor {
  const where = readStanding(text).where;
  return {
    key: id, name, names: [name], recordId: id, ring: "unmet", standing: "here", where, reach: where && !isLocal(where) ? (FAR.test(where) ? "far" : "region") : "town",
    drives: {}, ties: [], nocturnal: /\b(vampire|demon|undead)\b/i.test(text.replace(SLAYS_THEM, "")), lastPage: -1, protected: false, flags: {}, text: text.slice(0, 300), lore: text, knows: [], means: 1, group: true,
  };
}

/** Whether an actor can act off the page at all. */
export function canAct(a: Actor): boolean {
  return a.standing !== "dead" && a.standing !== "changed" && a.standing !== "companion" && !a.flags.out && a.reach !== "none";
}

/** Has this person got a fact (by key)? */
export function hasFact(a: Actor, key: string): Known | undefined {
  return a.knows.find((k) => k.key === key);
}

/**
 * The awake set (design/09 §4.3): who is simulated this tick. People with a running arc stay
 * awake. The rest are ranked; people already in the story fill at most three in five places,
 * so someone the story has never shown always has room. A seeded jitter rotates near-ties.
 */
export function awakeSet(r: Roster, opts: { cap: number; leadsWithArcs: Set<string>; lastBeat: Map<string, number>; now: number; recentNames: Set<string>; jitter?: (key: string) => number }): Actor[] {
  const scored = r.actors
    .filter((a) => a.ring !== "onstage" && canAct(a) && a.standing !== "construct")
    .map((a) => {
      const tieToStory = Math.max(0, ...a.ties.map((t) => (t.to === "user" || r.byKey(t.to)?.ring === "onstage" ? t.strength : r.byKey(t.to)?.ring === "offstage" ? t.strength * 0.6 : 0)));
      const neglect = Math.min(1, (opts.now - (opts.lastBeat.get(a.key) ?? opts.now - 1440)) / 1440);
      const score = tieToStory + REACH_WEIGHT[a.reach] + (opts.recentNames.has(a.key) ? 0.5 : 0) + neglect + (a.ring === "offstage" ? 1.5 : 0) + (opts.jitter?.(a.key) ?? 0) + (a.flags.wake ? 5 : 0);
      return { a, score };
    })
    .sort((x, y) => y.score - x.score || x.a.name.localeCompare(y.a.name));
  const out: Actor[] = scored.filter((x) => opts.leadsWithArcs.has(x.a.key)).map((x) => x.a);
  const rest = scored.filter((x) => !opts.leadsWithArcs.has(x.a.key)).map((x) => x.a);
  const offCap = Math.ceil(opts.cap * 0.6);
  for (const a of rest) {
    if (out.length >= opts.cap) break;
    const off = out.filter((x) => x.ring === "offstage").length;
    if (a.ring === "offstage" && off >= offCap && rest.some((x) => x.ring === "unmet" && !out.includes(x))) continue;
    out.push(a);
  }
  for (const a of rest) if (out.length < opts.cap && !out.includes(a)) out.push(a);
  return out;
}
