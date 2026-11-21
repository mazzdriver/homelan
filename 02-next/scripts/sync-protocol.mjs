// Copies the canonical protocol module into the Admin and Client packages.
// Edit packages/homelan-protocol/src/index.js ONLY, then run: npm run sync:protocol
// `--check` exits 1 instead of writing when a copy differs (used by CI and tests).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonical = path.join(root, 'packages/homelan-protocol/src/index.js');
const copies = [
  path.join(root, 'packages/homelan-admin/src/protocol.js'),
  path.join(root, 'packages/homelan-client/src/protocol.js')
];
const check = process.argv.includes('--check');
const source = fs.readFileSync(canonical, 'utf8');
let drift = 0;
for (const file of copies) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (current === source) continue;
  drift++;
  if (check) console.error(`DRIFT: ${path.relative(root, file)} differs from the canonical protocol module`);
  else { fs.writeFileSync(file, source); console.log(`updated ${path.relative(root, file)}`); }
}
if (check && drift) { console.error('Run: npm run sync:protocol'); process.exit(1); }
if (!drift) console.log('protocol copies are in sync');
