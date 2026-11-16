// ai-excited-01 — write the winning image to /output/entry.png
//
// The artwork is a giant humpback whale breaching out of a tiny porcelain
// teacup ("ENGLAND" on the saucer) on a rustic wooden table — water
// exploding, dramatic window light, photorealistic. It is bundled in this
// repo as entry.png. This program copies those exact bytes to the output
// path, so every run produces the identical file (deterministic).
//
// Usage: `npx tsx main.ts` (or `node --experimental-strip-types main.ts`).
// The output directory can be overridden with MAKEFUN_OUTPUT_DIR.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bundled = join(here, "entry.png");

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const outPath = join(outDir, "entry.png");

const bytes = readFileSync(bundled);
mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, bytes);
