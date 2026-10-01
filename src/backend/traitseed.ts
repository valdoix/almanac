// Traits the story didn't write but the sources state: the character card, the persona, and the
// lorebooks' person entries (read at scan time). The story's own `trait` lines and the player's
// word win over these (see mergeTraits).

import type { Trait } from "../core/types";
import { traitsFromText } from "../core/traits";
import type { ChatLedger } from "./ledger";
import type { ChatMeta } from "./store";

export function seedTraitsFor(L: ChatLedger, _meta: ChatMeta): Record<string, Trait[]> {
  const out: Record<string, Trait[]> = {};
  const st = L.state;
  if (!st) return out;
  const add = (id: string, list: { kind: Trait["kind"]; text: string }[], by: Trait["by"]) => {
    const cur = (out[id] ??= []);
    for (const t of list) if (!cur.some((x) => x.kind === t.kind)) cur.push({ ...t, by, msgIndex: 0 });
  };
  // The chat's cards (one, or every member of a group) and the player's persona.
  const cards = L.names.cards?.length ? L.names.cards : L.names.char ? [{ id: "", name: L.names.char, text: L.names.charText ?? "" }] : [];
  for (const card of cards) {
    const first = card.name.split(/\s+/)[0];
    const cardId = Object.values(st.chars).find((c) => !c.isUser && (c.name === card.name || c.aliases.includes(card.name) || first === c.name.split(/\s+/)[0]))?.id;
    if (cardId && card.text) add(cardId, traitsFromText(card.text, [card.name, first]), "card");
  }
  if (st.chars.user && L.names.personaText) add("user", traitsFromText(L.names.personaText, [L.names.user, L.names.user.split(/\s+/)[0]]), "card");
  // Lorebook people joined to the story's (their looks were read from the whole entry at scan time).
  for (const r of L.records) {
    if (r.kind !== "person" || !Array.isArray(r.body.looks)) continue;
    const id = r.id === "char:user" ? "user" : r.id.slice(5);
    if (st.chars[id]) add(id, r.body.looks, "lore");
  }
  return out;
}
