// Prompt-variable helpers (Lumiverse Loom variable schema). Option values are
// short keys; blocks branch on them with {{switch}} / {{eq}} / ison.

export type Opt = [value: string, label: string];

export function sel(name: string, label: string, description: string, defaultValue: string, options: Opt[]) {
  return { id: `alm-var-${name}`, name, label, description, type: "select", defaultValue, options: options.map(([value, l]) => ({ id: value, label: l, value })) };
}
export function sw(name: string, label: string, description: string, defaultValue: 0 | 1) {
  return { id: `alm-var-${name}`, name, label, description, type: "switch", defaultValue };
}
export function multi(name: string, label: string, description: string, defaultValue: string[], options: Opt[], separator = ", ") {
  return { id: `alm-var-${name}`, name, label, description, type: "multiselect", defaultValue, separator, options: options.map(([value, l]) => ({ id: value, label: l, value })) };
}
export function text(name: string, label: string, description: string, defaultValue = "") {
  return { id: `alm-var-${name}`, name, label, description, type: "text", defaultValue };
}
export function area(name: string, label: string, description: string, defaultValue = "", rows = 3) {
  return { id: `alm-var-${name}`, name, label, description, type: "textarea", defaultValue, rows };
}

export const GENRES: Opt[] = [
  ["slice_of_life", "Slice of life"], ["romance", "Romance"], ["drama", "Drama"], ["comedy", "Comedy"], ["mystery", "Mystery"],
  ["thriller", "Thriller"], ["horror", "Horror"], ["fantasy", "Fantasy"], ["dark_fantasy", "Dark fantasy"], ["scifi", "Science fiction"],
  ["adventure", "Adventure"], ["noir", "Noir"], ["intrigue", "Political intrigue"], ["tragedy", "Tragedy"], ["action", "Action"],
  ["cozy", "Cozy"], ["survival", "Survival"], ["erotic", "Erotic romance (needs Intimacy: Explicit)"],
];

export const TRIG_ALL_BUT_QUIET = ["normal", "continue", "regenerate", "swipe", "impersonate"];
export const TRIG_STORY = ["normal", "regenerate", "swipe"];
export const TRIG_STORY_CONT = ["normal", "continue", "regenerate", "swipe"];

/**
 * String.raw, but safe under Bun: Bun (1.3) hands tags a `raw` array in which
 * every non-ASCII character is rewritten as a \uXXXX / \u{…} escape. The preset
 * sources never contain a deliberate \u escape, so decoding them is lossless.
 */
export function R(strings: TemplateStringsArray, ...values: unknown[]): string {
  const fix = (s: string) => s.replace(/\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})/g, (_m, a, b) => String.fromCodePoint(parseInt(a ?? b, 16)));
  return String.raw({ raw: strings.raw.map(fix) }, ...values);
}
