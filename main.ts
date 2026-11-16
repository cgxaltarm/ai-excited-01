// ai-excited-01 entry program - whale breaching out of a teacup
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = join(import.meta.dirname, 'entry.png');
const destDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const dest = join(destDir, 'entry.png');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
