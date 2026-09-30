// Small, dependency-free helpers shared by every core module.

export const MIN_PER_DAY = 1440;

export interface StoryTime {
  day: number; // Day 1 = the story's first day
  minute: number; // 0..1439
}

export function absMinutes(t: StoryTime): number {
  return (t.day - 1) * MIN_PER_DAY + t.minute;
}

export function fromAbs(abs: number): StoryTime {
  const a = Math.max(0, Math.round(abs));
  return { day: Math.floor(a / MIN_PER_DAY) + 1, minute: a % MIN_PER_DAY };
}

export function addMinutes(t: StoryTime, m: number): StoryTime {
  return fromAbs(absMinutes(t) + m);
}

export function hhmm(minute: number): string {
  const m = ((Math.round(minute) % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function fmtTime(t: StoryTime | null | undefined): string {
  if (!t) return "unknown time";
  return `Day ${t.day} ${hhmm(t.minute)}`;
}

export function fmtSpan(minutes: number): string {
  const m = Math.abs(Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h < 48) return r ? `${h} h ${r} min` : `${h} h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d} d ${rh} h` : `${d} d`;
}

/** Lowercase ASCII-ish slug suitable for record ids. Keeps unicode letters. */
export function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "x";
}

/** Display name for a holder or party id: the player, a place ("loc:…"), or a character. */
export function partyName(state: { chars: Record<string, { name: string }>; places: Record<string, { name: string }> }, id: string, userName?: string): string {
  if (id === "user" && userName) return userName;
  if (id.startsWith("loc:")) return state.places[id]?.name ?? id.slice(4).replace(/_/g, " ");
  return state.chars[id]?.name ?? id;
}

/** FNV-1a 32-bit hash, hex. Stable across runtimes. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Deterministic PRNG (mulberry32) seeded from a string. */
export function rng(seed: string): () => number {
  let a = parseInt(hash(seed), 16) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let ulidLast = 0;
let ulidSeq = 0;
/** Sortable unique id (time + counter + random). Not a strict ULID, but monotonic per process. */
export function uid(prefix = ""): string {
  const now = Date.now();
  if (now === ulidLast) ulidSeq++;
  else {
    ulidLast = now;
    ulidSeq = 0;
  }
  const r = Math.floor(Math.random() * 1e9).toString(36);
  return `${prefix}${now.toString(36)}${ulidSeq.toString(36).padStart(2, "0")}${r}`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Rough token estimate (~4 chars per token for English prose). */
export function estTokens(s: string): number {
  if (!s) return 0;
  return Math.ceil(s.length / 3.8);
}

export function truncateTokens(s: string, maxTokens: number): string {
  if (estTokens(s) <= maxTokens) return s;
  const cut = Math.max(0, Math.floor(maxTokens * 3.8) - 1);
  const sub = s.slice(0, cut);
  const lastStop = Math.max(sub.lastIndexOf(". "), sub.lastIndexOf("\n"));
  return (lastStop > cut * 0.6 ? sub.slice(0, lastStop + 1) : sub) + "…";
}

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function unescapeHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function deepClone<T>(v: T): T {
  return typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/);
  if (!parts[0]) return "?";
  return (parts[0][0] ?? "?").toUpperCase();
}

export function titleCase(s: string): string {
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** Strip display marks ([spk=…], [thk=…], [txt], vtk wrappers, html) to get plain prose. */
export function plainProse(text: string): string {
  return text
    .replace(/<ledger>[\s\S]*?(<\/ledger>|$)/gi, "")
    .replace(/<unspoken>[\s\S]*?(<\/unspoken>|$)/gi, "")
    .replace(/<plan>[\s\S]*?(<\/plan>|$)/gi, "")
    .replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/gi, "")
    .replace(/\[(?:spk|thk|txt)(?:=[^\]]*)?\]|\[\/(?:spk|thk|txt)\]/g, "")
    .replace(/\[vtk=[^\]]*\]|\[\/vtk\]/g, "")
    .replace(/^[ \t]*(?:🗓️?|📍)[^\n]*$/gmu, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A knowledge note (how a holder came to know it, or what they don't know yet): short, wrapping, full text on hover. */
export function kpNote(note: string): string {
  const short = note.length > 70 ? `${note.slice(0, 67).trimEnd()}…` : note;
  return `<small class="alm-kp__n" title="${escapeHtml(note)}">${escapeHtml(short)}</small>`;
}
