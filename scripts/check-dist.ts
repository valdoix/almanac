// Release check: the committed bundles and preset were built from this commit.
// Lumiverse installs straight from the branch, so a stale dist/ ships stale code.
//  - preset/ALMANAC.json must equal a fresh build (its output doesn't depend on the Bun version);
//  - dist/backend.js and dist/frontend.js must carry this version (bundler output can differ
//    between Bun versions, so they are checked by version and by being newer than every source).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildPreset, validate } from "../preset/build";
import { VERSION } from "../src/core/version";

const root = join(import.meta.dir, "..");
const errors: string[] = [];

const preset = buildPreset();
const problems = validate(preset);
if (problems.length) errors.push(...problems.map((p) => `preset: ${p}`));
const fresh = JSON.stringify(preset, null, 2) + "\n";
const committed = readFileSync(join(root, "preset/ALMANAC.json"), "utf8");
if (fresh !== committed) errors.push("preset/ALMANAC.json differs from its sources: run `bun run build:preset`");

const manifest = JSON.parse(readFileSync(join(root, "spindle.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (manifest.version !== VERSION || pkg.version !== VERSION) errors.push(`versions disagree: version.ts ${VERSION}, spindle.json ${manifest.version}, package.json ${pkg.version}`);

const newest = (dir: string): number => {
  let t = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    t = Math.max(t, s.isDirectory() ? newest(p) : s.mtimeMs);
  }
  return t;
};
for (const file of ["dist/backend.js", "dist/frontend.js"]) {
  const text = readFileSync(join(root, file), "utf8");
  if (!text.includes(`"${VERSION}"`)) errors.push(`${file} was not built from ${VERSION}: run \`bun run build\``);
}
if (process.argv.includes("--mtime")) {
  const src = newest(join(root, "src"));
  for (const file of ["dist/backend.js", "dist/frontend.js"]) if (statSync(join(root, file)).mtimeMs < src) errors.push(`${file} is older than src/: run \`bun run build\``);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`dist/ and preset/ALMANAC.json match ${VERSION}`);
