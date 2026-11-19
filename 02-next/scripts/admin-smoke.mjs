#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'packages', 'homelan-admin', 'bin', 'homelan.js');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'homelan-admin-smoke-'));
let failed = false;
function check(label, args, expected = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
    env: {...process.env, HOMELAN_HOME: home}
  });
  const ok = result.status === expected;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${label}\n`);
  if (!ok) {
    failed = true;
    process.stdout.write(`      exit: ${result.status}\n      stdout: ${result.stdout || ''}\n      stderr: ${result.stderr || ''}\n`);
  }
  return result;
}

try {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) {
    console.error(`Node.js 20+ required; found ${process.version}`);
    process.exitCode = 2;
  } else {
    check('CLI help', ['--help']);
    const inspect = check('local system inspection (read-only)', ['system', 'inspect']);
    if (inspect.status === 0) {
      try {
        const report = JSON.parse(inspect.stdout);
        const ok = Boolean(report.facts?.os && report.adapter && report.capabilities);
        process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  inspection JSON shape\n`);
        if (!ok) failed = true;
      } catch (error) {
        failed = true;
        process.stdout.write(`FAIL  inspection JSON parse: ${error.message}\n`);
      }
    }
    check('initialize isolated admin config', ['init']);
    check('list empty registry', ['device', 'list']);
    check('add synthetic TEST-NET device (no network)', ['device', 'add', 'smokebox', '--address', '192.0.2.10', '--user', 'tester', '--managed-users', 'kidtest']);
    const list = check('read synthetic device registry', ['device', 'list']);
    if (list.status === 0 && !list.stdout.includes('smokebox')) failed = true;
    check('reject unconfirmed poweroff before any SSH call', ['poweroff', 'smokebox'], 1);
    if (failed) process.exitCode = 1;
  }
} finally {
  fs.rmSync(home, {recursive:true, force:true});
}

if (!process.exitCode) console.log('\nAdmin smoke checks passed. No network connection or target-side command was made.');
