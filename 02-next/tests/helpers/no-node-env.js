// Builds a hermetic environment whose PATH has the system's shell utilities
// but no Node.js/npm. Tests that must observe a "Node.js is missing" machine
// use this instead of guessing that /usr/bin and /bin lack Node, which is
// false on many machines and would let installer scripts run for real.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BLOCKED = new Set(['node', 'nodejs', 'npm', 'npx', 'corepack', 'pnpm', 'yarn']);
const SOURCES = ['/usr/bin', '/bin', '/usr/sbin', '/sbin'];

export function makeNoNodeEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'homelan-nonode-'));
  const seen = new Set();
  for (const src of SOURCES) {
    let names;
    try { names = fs.readdirSync(src); } catch { continue; }
    for (const name of names) {
      if (BLOCKED.has(name) || seen.has(name)) continue;
      try { fs.symlinkSync(path.join(src, name), path.join(dir, name)); seen.add(name); } catch { /* ignore */ }
    }
  }
  for (const tool of BLOCKED) {
    if (fs.existsSync(path.join(dir, tool))) throw new Error(`hermetic PATH leaked ${tool}`);
  }
  return {
    dir,
    env: { PATH: dir, HOME: dir, LANG: 'C' },
    cleanup() { fs.rmSync(dir, { recursive: true, force: true }); }
  };
}
