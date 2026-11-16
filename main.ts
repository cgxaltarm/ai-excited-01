// ai-excited-01 entry program - whale breaching out of a teacup
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

// ponytail: sync copy assumes destination exists; add mkdir when unmanaged
copyFileSync(join(import.meta.dirname, 'entry.png'), join(process.env.MAKEFUN_OUTPUT_DIR || '/output', 'entry.png'));
