// Writes or verifies MANIFEST.sha256 at the repository root.
//   node scripts/manifest.mjs --write   regenerate
//   node scripts/manifest.mjs --check   verify (exit 1 on any mismatch, missing or unlisted file)
// Run --check on Linux only: Windows checkouts may rewrite line endings and change hashes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = path.join(repo, 'MANIFEST.sha256');
const SKIP_DIRS = new Set(['.git', 'node_modules']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out); }
    else if (entry.isFile() && !(dir === repo && entry.name === 'MANIFEST.sha256')) out.push(path.join(dir, entry.name));
  }
  return out;
}
function lines() {
  const rels = walk(repo).map((f) => './' + path.relative(repo, f).split(path.sep).join('/'));
  rels.sort((a, b) => (Buffer.compare(Buffer.from(a), Buffer.from(b))));
  return rels.map((rel) => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, rel))).digest('hex')}  ${rel}`);
}
const expected = lines().join('\n') + '\n';
if (process.argv.includes('--write')) { fs.writeFileSync(manifest, expected); console.log(`wrote ${expected.split('\n').length - 1} entries`); }
else if (process.argv.includes('--check')) {
  const actual = fs.existsSync(manifest) ? fs.readFileSync(manifest, 'utf8') : '';
  if (actual === expected) console.log('MANIFEST.sha256 is up to date');
  else {
    const a = new Set(actual.split('\n').filter(Boolean)), e = new Set(expected.split('\n').filter(Boolean));
    for (const l of e) if (!a.has(l)) console.error(`CHANGED OR NEW: ${l.split('  ')[1]}`);
    for (const l of a) if (!e.has(l)) console.error(`STALE OR REMOVED: ${l.split('  ')[1]}`);
    console.error('Run: npm run manifest:write'); process.exit(1);
  }
} else { console.error('usage: manifest.mjs --write | --check'); process.exit(2); }
