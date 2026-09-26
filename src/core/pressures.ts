// Hidden pressures (subtext deck) and the Chekhov ledger (plants and payoffs).

import type { WorldState } from "./types";
import { rng } from "./util";

const DECK: { text: string; genres: string[] }[] = [
  { text: "is lying about something small that would lead to something large", genres: ["mystery", "noir", "thriller", "intrigue"] },
  { text: "is quietly testing the player's character", genres: ["intrigue", "romance", "fantasy", "drama"] },
  { text: "wants to leave — this place, this job, this life — and is ashamed of it", genres: ["drama", "slice of life", "tragedy", "cozy"] },
  { text: "is hiding an illness or injury", genres: ["drama", "survival", "tragedy", "horror"] },
  { text: "has a debt coming due soon", genres: ["noir", "thriller", "drama", "adventure"] },
  { text: "has an exit plan ready and is watching for the moment", genres: ["thriller", "noir", "intrigue"] },
  { text: "is hiding real power or skill", genres: ["fantasy", "action", "adventure", "dark fantasy"] },
  { text: "has realised a truth they cannot say aloud", genres: ["drama", "romance", "tragedy", "mystery"] },
  { text: "is protecting someone who does not deserve it", genres: ["noir", "drama", "crime", "mystery"] },
  { text: "is grieving and has told no one", genres: ["drama", "romance", "cozy", "slice of life"] },
  { text: "owes loyalty to someone the player's character opposes", genres: ["intrigue", "thriller", "fantasy"] },
  { text: "is jealous of someone present", genres: ["romance", "comedy", "drama"] },
  { text: "is desperate for money and hides it badly", genres: ["noir", "comedy", "slice of life"] },
  { text: "believes something false about the player's character", genres: ["mystery", "romance", "drama", "comedy"] },
  { text: "is being watched or followed", genres: ["horror", "thriller", "noir"] },
  { text: "made a promise they cannot keep", genres: ["romance", "fantasy", "tragedy"] },
];

/** Draw a hidden pressure for new consequential NPCs (seeded, so swipes agree). */
export function drawPressures(state: WorldState, seed: string, genres: string[], existing: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const gs = genres.map((g) => g.toLowerCase());
  for (const c of Object.values(state.chars)) {
    if (c.isUser || c.dead || existing[c.id]) continue;
    const consequential = c.tier === "spot" || !!c.mood || c.journal.length > 0 || Object.values(state.bonds).some((b) => b.from === c.id);
    if (!consequential) continue;
    const r = rng(`${seed}:pressure:${c.id}`);
    const weighted = DECK.flatMap((d) => (d.genres.some((g) => gs.includes(g)) ? [d, d, d] : [d]));
    out[c.id] = weighted[Math.floor(r() * weighted.length)].text;
  }
  return out;
}

const PAYOFF_GENRES = new Set(["mystery", "comedy", "thriller", "noir", "adventure", "fantasy", "horror"]);

/** Plants that have sat unused for `scenes` scenes, when the genre wants payoffs. Never forces one. */
export function chekhovNudges(state: WorldState, genres: string[], scenes = 4): string[] {
  if (!genres.some((g) => PAYOFF_GENRES.has(g.toLowerCase()))) return [];
  return state.plants
    .filter((p) => p.paidAt == null && state.sceneNo - p.plantedScene >= scenes)
    .slice(0, 2)
    .map((p) => `“${p.text}” was planted ${state.sceneNo - p.plantedScene} scenes ago${p.payoff ? ` (payoff: ${p.payoff})` : ""} — it may pay off when it fits; never force it.`);
}
