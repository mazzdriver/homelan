import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {makeNoNodeEnv} from './helpers/no-node-env.js';
import {POSIX_ONLY} from './helpers/platform.js';
const root=path.resolve('packages');
test('Admin and Client are independently installable packages',()=>{
 for(const name of ['homelan-admin','homelan-client']){
  const pkg=JSON.parse(fs.readFileSync(path.join(root,name,'package.json'),'utf8'));
  assert.equal(pkg.version,'2.1.0');assert.equal(pkg.engines.node,'>=20');
  assert.ok(pkg.bin);assert.equal(pkg.dependencies,undefined);
 }
});
test('each package vendors the canonical RPC protocol source',()=>{
 const canonical=fs.readFileSync(path.join(root,'homelan-protocol/src/index.js'),'utf8');
 for(const name of ['homelan-admin','homelan-client']){
  const vendored=fs.readFileSync(path.join(root,name,'src/protocol.js'),'utf8');
  assert.equal(vendored,canonical,`${name} protocol copy is stale`);
 }
});

test('Admin and Client ship a pre-Node Linux bootstrap helper',()=>{
 for(const name of ['homelan-admin','homelan-client']){
  const file=path.join(root,name,'bootstrap/linux.sh');
  assert.ok(fs.existsSync(file),`${name} bootstrap missing`);
 }
 const client=fs.readFileSync(path.join(root,'homelan-client/bootstrap/linux.sh'),'utf8');
 const admin=fs.readFileSync(path.join(root,'homelan-admin/bootstrap/linux.sh'),'utf8');
 assert.equal(admin,client,'Admin bootstrap must match Client bootstrap');
});

test('offline admin installer inspects prerequisites and fails before changes without Node.js',{skip:POSIX_ONLY},()=>{
 const script=path.resolve('../release/offline/install-offline.sh');
 const hermetic=makeNoNodeEnv();
 try{
  const r=spawnSync('sh',[script],{encoding:'utf8',env:hermetic.env,timeout:5000});
  assert.equal(r.status,2);assert.match(r.stderr,/Node.js 20\+/);
 }finally{hermetic.cleanup();}
 const ps=fs.readFileSync(path.resolve('../release/offline/install-offline.ps1'),'utf8');
 assert.match(ps,/Get-CimInstance/);assert.match(ps,/Node.js 20\+/);
});
