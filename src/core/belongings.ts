// Belongings and rooms that last beyond the scene. "Holds" is what someone has on them now; a
// keepsake in a trunk, a ring in a jewellery box, a letter in a desk drawer belongs to them all the
// same, and stays where it was put. Each person also keeps their rooms ("Cersei's former chambers",
// "Giles's flat"), read from the places the story names and the player's word on the Cast page.
// In someone's room, the note mentions what is kept there, so the trunk still has it.

import type { CastEdit, ItemState, WorldState } from "./types";
import { slug } from "./util";

/** Where a thing is put away, not carried: a trunk, a drawer, a box, a shelf, under the bed. */
export const CONTAINER = /\b(?:trunk|chest|drawer|box|case|wardrobe|closet|cupboard|cabinet|shelf|shelves|safe|strongbox|coffer|desk|nightstand|bedside|dresser|vanity|footlocker|locker|vault|hidden|hiding place|under (?:the|her|his|their) (?:bed|pillow|mattress|floorboards?)|room|chambers?|quarters|bedroom|study|flat|apartment|house|home|cabin|tent|saddlebags?)\b/i;
/** A thing given for good ("gave", "a gift", "it's yours"): the owner changes. Lending doesn't. */
export const GIFT = /\b(?:gave|gives|given|gift(?:ed)?|present(?:ed)?|bought (?:it )?for|yours now|hers now|his now|theirs now|keeps? it|to keep|inherit\w*|bequeath\w*)\b/i;
const LENT = /\b(?:lend|lends|lent|borrow\w*|loan\w*|for now|for the night|back later)\b/i;

/** Got for good: bought, given, made, kept. A shard picked up off the floor isn't anyone's. */
const ACQUIRE = /\b(?:bought|buys|purchased|got (?:it|her|him|them)?\s*for|received|receives|won|made (?:it|for)|keeps?|kept|treasur\w*|heirloom|keepsake|own(?:s|ed)?)\b/i;
/** Where a thing goes with someone for good: worn, pocketed, at the wrist or neck. */
const ON_THEM = /\b(?:worn|wearing|pockets?|wrist|neck|necklace|finger|ears?|belt|holster|sheath|scabbard|purse|wallet|keyring)\b/i;

/** Who owns a thing now, given who it went to, why, and where it ended up. Lending isn't giving. */
export function nextOwner(it: Pick<ItemState, "owner" | "name">, to: string | undefined, cause: string, lookup: (name: string) => string | null, isPerson: (id: string) => boolean, where = ""): string | undefined {
  if (!it.owner) {
    const pos = /^(?:the\s+)?(\p{Lu}[\p{L}'’.-]*(?:\s+\p{Lu}[\p{L}'’.-]*)?)['’]s?\s+\S/u.exec(it.name);
    const named = pos ? lookup(pos[1]) : null;
    if (named) return named;
  }
  if (to && isPerson(to)) {
    if (GIFT.test(cause) && !LENT.test(cause)) return to;
    if (!it.owner && !LENT.test(cause) && (ACQUIRE.test(cause) || ON_THEM.test(where) || CONTAINER.test(where))) return to;
  }
  return it.owner;
}

/** Each person's rooms and places: "Cersei's former chambers" from the story's places, and the player's word. */
export function roomsOf(st: WorldState, edits: Record<string, CastEdit> = {}): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (id: string, room: string) => {
    const list = (out[id] ??= []);
    if (!list.some((r) => r.toLowerCase() === room.toLowerCase())) list.push(room);
  };
  const byName = new Map<string, string>();
  for (const c of Object.values(st.chars)) for (const n of [c.name, c.name.split(/\s+/)[0], ...c.aliases]) if (n.length >= 2) byName.set(n.toLowerCase(), c.id);
  for (const p of Object.values(st.places)) {
    // "Gabriel's bedroom → hallway", "Gabriel's BMW (passenger seats)": a move or a spot, not a place of theirs; a grave isn't a room.
    if (/→|->|[()·]|\b(?:grave|tomb|crypt|funeral)\b/i.test(p.name)) continue;
    const m = /^(?:the\s+)?(\p{Lu}[\p{L}'’.-]*(?:\s+\p{Lu}[\p{L}'’.-]*)?)['’]s?\s+(.{2,60})$/u.exec(p.name);
    const id = m ? byName.get(m[1].toLowerCase()) : undefined;
    if (id) add(id, p.name);
  }
  for (const [id, e] of Object.entries(edits)) for (const r of e.rooms ?? []) if (r.trim() && st.chars[id]) add(id, r.trim());
  return out;
}

/** Does a room name fit the place the scene is in ("her former chambers" ~ "Cersei's former chambers")? */
export function sameRoom(room: string, place: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s*\([^)]*\)/g, "").replace(/^(?:the|her|his|their|my)\s+/, "").replace(/^\p{L}+['’]s?\s+/u, "").replace(/\s+/g, " ").trim();
  const a = norm(room), b = norm(place);
  return !!a && !!b && (a === b || slug(room) === slug(place));
}

/** Whose room the scene is in, by the place path (innermost first). */
export function roomOwnerHere(st: WorldState, rooms: Record<string, string[]>): { id: string; room: string } | null {
  for (const p of [...st.place].reverse()) {
    for (const [id, list] of Object.entries(rooms)) if (list.some((x) => sameRoom(x, p))) return { id, room: p };
  }
  return null;
}

/** What someone owns or keeps (not gone), with where it is: a pocket, a trunk, a room. */
export function belongingsOf(st: WorldState, id: string, nm: (id: string) => string): { name: string; where: string; lastMsg: number }[] {
  return Object.values(st.items)
    .filter((i) => !i.gone && (i.owner === id || (!i.owner && i.holder === id && ON_THEM.test(i.where ?? ""))))
    .map((i) => {
      const holder = i.holder && i.holder !== id ? (i.holder.startsWith("loc:") ? st.places[i.holder]?.name ?? i.holder.slice(4) : `with ${nm(i.holder)}`) : "";
      return { name: i.name, where: [i.where, holder].filter(Boolean).join(", "), lastMsg: i.lastMsg ?? i.custody.at(-1)?.msgIndex ?? 0 };
    })
    .sort((a, b) => b.lastMsg - a.lastMsg);
}

/**
 * What's kept in the place the scene is in: things left at this place, and in someone's own room,
 * their things put away there (a trunk, a drawer). For the note: the trunk still has the locket.
 */
export function keptHere(st: WorldState, rooms: Record<string, string[]>, nm: (id: string) => string): string[] {
  const here = st.place.map((p) => `loc:${slug(p)}`);
  const out: string[] = [];
  const owner = roomOwnerHere(st, rooms);
  for (const i of Object.values(st.items)) {
    if (i.gone) continue;
    const whose = i.owner && i.owner !== i.holder ? `${nm(i.owner)}'s, ` : "";
    if (i.holder && here.includes(i.holder)) out.push(`${i.name} (${whose}${i.where ?? "here"})`);
    else if (owner && (i.holder === owner.id || i.owner === owner.id) && i.where && CONTAINER.test(i.where) && !/\b(?:pocket|worn|wrist|neck|hand|bag|purse|belt)\b/i.test(i.where)) out.push(`${i.name} (${nm(owner.id)}'s, ${i.where})`);
  }
  return out.slice(0, 4);
}
