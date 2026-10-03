// Soundtrack (design/11): the tables the cue is read from. Data, not code: tune these by replay.

export const MOODS = [
  "calm", "warm", "playful", "tender", "romantic", "hopeful", "triumphant", "adventurous",
  "mysterious", "eerie", "tense", "dread", "combat", "melancholy", "grief", "dreamy",
] as const;
export type Mood = (typeof MOODS)[number];
export const isMood = (x: unknown): x is Mood => typeof x === "string" && (MOODS as readonly string[]).includes(x);

/** The words a mood is searched with (the first is the main one; the others rotate in). */
export const MOOD_WORDS: Record<Mood, string[]> = {
  calm: ["calm", "peaceful", "relaxing"],
  warm: ["warm", "feel good", "cozy"],
  playful: ["playful", "upbeat", "fun"],
  tender: ["tender", "gentle", "soft"],
  romantic: ["romantic", "love", "sensual"],
  hopeful: ["hopeful", "uplifting", "inspiring"],
  triumphant: ["triumphant", "epic", "victory"],
  adventurous: ["adventure", "journey", "uplifting"],
  mysterious: ["mysterious", "mystery", "enigmatic"],
  eerie: ["eerie", "haunting", "unsettling"],
  tense: ["tense", "suspense", "tension"],
  dread: ["dark", "ominous", "dread"],
  combat: ["battle", "intense", "action"],
  melancholy: ["melancholy", "sad", "wistful"],
  grief: ["grief", "mourning", "sorrow"],
  dreamy: ["dreamy", "ethereal", "night"],
};

/** Where each mood sits, for the meter and for distances: energy 0..1, valence -1..1, tension 0..1, intimacy 0..1. */
export const MOOD_VEC: Record<Mood, [number, number, number, number]> = {
  calm: [0.2, 0.3, 0.1, 0.2],
  warm: [0.4, 0.5, 0.15, 0.3],
  playful: [0.6, 0.6, 0.15, 0.2],
  tender: [0.25, 0.5, 0.2, 0.7],
  romantic: [0.35, 0.6, 0.3, 0.85],
  hopeful: [0.5, 0.6, 0.2, 0.3],
  triumphant: [0.85, 0.7, 0.3, 0.2],
  adventurous: [0.6, 0.4, 0.3, 0.1],
  mysterious: [0.35, -0.1, 0.5, 0.1],
  eerie: [0.25, -0.5, 0.65, 0.05],
  tense: [0.6, -0.35, 0.8, 0.1],
  dread: [0.5, -0.7, 0.9, 0.05],
  combat: [0.95, -0.4, 0.9, 0.05],
  melancholy: [0.25, -0.4, 0.25, 0.4],
  grief: [0.2, -0.8, 0.3, 0.5],
  dreamy: [0.2, 0.2, 0.1, 0.4],
};

/** Scene mode → base mood and numbers (design/11 §5.3). */
export const MODE_BASE: Record<string, { mood: Mood; energy: number; valence: number; tension: number; intimacy: number }> = {
  downtime: { mood: "calm", energy: 0.25, valence: 0.3, tension: 0.1, intimacy: 0.2 },
  social: { mood: "warm", energy: 0.45, valence: 0.5, tension: 0.2, intimacy: 0.3 },
  intimacy: { mood: "tender", energy: 0.3, valence: 0.6, tension: 0.3, intimacy: 0.8 },
  conflict: { mood: "tense", energy: 0.8, valence: -0.4, tension: 0.8, intimacy: 0.1 },
  investigation: { mood: "mysterious", energy: 0.4, valence: -0.1, tension: 0.5, intimacy: 0.1 },
  travel: { mood: "adventurous", energy: 0.55, valence: 0.3, tension: 0.3, intimacy: 0.1 },
  stealth: { mood: "tense", energy: 0.35, valence: -0.3, tension: 0.7, intimacy: 0.05 },
  crisis: { mood: "dread", energy: 0.9, valence: -0.6, tension: 0.95, intimacy: 0.05 },
};

/** Story genre (Session Zero) → music genres to suggest. */
export const GENRE_SUGGEST: Record<string, string[]> = {
  fantasy: ["film score", "celtic folk", "orchestral"],
  adventure: ["film score", "orchestral", "folk"],
  dark_fantasy: ["dark ambient", "neoclassical", "dark folk"],
  tragedy: ["neoclassical", "piano", "dark ambient"],
  horror: ["dark ambient", "drone", "horror soundtrack"],
  scifi: ["synthwave", "ambient electronic", "film score"],
  noir: ["jazz", "noir jazz", "trip hop"],
  mystery: ["jazz", "trip hop", "film score"],
  thriller: ["film score", "industrial", "post-rock"],
  action: ["film score", "post-rock", "industrial"],
  survival: ["post-rock", "film score", "dark ambient"],
  romance: ["indie", "neo soul", "piano"],
  erotic: ["neo soul", "r&b", "downtempo"],
  drama: ["indie", "piano", "post-rock"],
  slice_of_life: ["lo-fi", "acoustic", "city pop"],
  cozy: ["lo-fi", "acoustic", "folk"],
  comedy: ["city pop", "indie pop", "lo-fi"],
  intrigue: ["neoclassical", "baroque", "film score"],
};

/** Music genres suggested for a story, from its genres (lead first), without repeats. */
export function suggestGenres(storyGenres: string[]): string[] {
  const out: string[] = [];
  for (const g of storyGenres.length ? storyGenres : ["drama"]) for (const m of GENRE_SUGGEST[g] ?? []) if (!out.includes(m)) out.push(m);
  return out.slice(0, 6);
}

/** Every music genre the editor offers as a chip. */
export const GENRE_CHIPS = [...new Set(Object.values(GENRE_SUGGEST).flat().concat(["ambient", "classical", "rock", "metal", "pop", "hip hop", "electronic", "j-rock", "k-pop", "video game soundtrack", "anime soundtrack", "blues", "country", "chiptune"]))];

/** Plate place kind → a texture word worth searching with ("" for none). */
export const PLACE_COLOUR: Record<string, string> = {
  space: "space", graveyard: "gothic", ruins: "ancient", castle: "medieval", deck: "sea", underground: "underground",
  swamp: "swamp", jungle: "jungle", tundra: "winter", sea: "ocean", coast: "ocean", forest: "forest", mountain: "mountain",
  desert: "desert", harbour: "harbor", camp: "campfire", village: "village", r_tavern: "tavern", r_club: "club", r_cafe: "cafe",
  r_diner: "diner", r_casino: "casino", r_arcade: "arcade", r_chapel: "cathedral", r_shrine: "temple", r_lab: "laboratory",
  r_hall: "royal", r_theater: "theater", r_library: "library", r_car: "night drive", r_train: "train", r_observatory: "stars",
  r_forge: "forge", r_alchemy: "alchemy", r_cell: "prison", r_cellar: "dark", r_submarine: "deep sea", r_aquarium: "underwater",
};

/** Words for the hour band. */
export function hourBand(minute: number): "late" | "dawn" | "day" | "dusk" | "night" {
  const h = Math.floor(minute / 60);
  if (h < 5) return "late";
  if (h < 7) return "dawn";
  if (h < 18) return "day";
  if (h < 20) return "dusk";
  return "night";
}
