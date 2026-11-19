import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const cli=path.resolve('packages/homelan-admin/bin/homelan.js');
function run(args,home){return spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env:{...process.env,HOMELAN_HOME:home}});}
test('init and device registry work without network access',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'homelan-admin-test-'));
 assert.equal(run(['init'],home).status,0);
 assert.equal(run(['device','add','labbox','--address','192.0.2.5','--user','tester','--managed-users','kid1'],home).status,0);
 const list=run(['device','list'],home);assert.equal(list.status,0);assert.match(list.stdout,/labbox/);assert.match(list.stdout,/kid1/);
 fs.rmSync(home,{recursive:true,force:true});
});
test('poweroff requires an explicit confirmation flag',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'homelan-poweroff-test-'));
 const r=run(['poweroff','labbox'],home);assert.notEqual(r.status,0);assert.match(r.stderr,/Re-run with --confirm/);
 fs.rmSync(home,{recursive:true,force:true});
});
test('invalid device identifiers and unsafe SSH usernames are rejected',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'homelan-validation-test-'));
 run(['init'],home);
 assert.notEqual(run(['device','add','x','--address','host','--user','tester'],home).status,0);
 assert.notEqual(run(['device','add','labbox','--address','host'],home).status,0);
 assert.match(run(['device','add','labbox','--address','host'],home).stderr,/Missing --user/);
 assert.notEqual(run(['device','add','labbox','--address','host','--user','bad;user'],home).status,0);
 fs.rmSync(home,{recursive:true,force:true});
});
