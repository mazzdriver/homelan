import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {invoke} from '../packages/homelan-admin/src/ssh.js';

test('SSH transport sends RPC and secret only through stdin, with strict host-key checking',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'homelan-ssh-test-'));
 const capture=path.join(dir,'args.json');
 const fake=path.join(dir,'fake-ssh');
 fs.writeFileSync(fake,`#!/usr/bin/env node\nconst fs=require('node:fs');let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify(process.argv.slice(2)));const req=JSON.parse(input);process.stdout.write(JSON.stringify({protocol:req.protocol,version:req.version,id:req.id,ok:true,result:{accepted:true}})+'\\n');});\n`);
 fs.chmodSync(fake,0o755);
 const secret='very-secret-not-in-argv';
 const response=await invoke({id:'testbox',address:'example.invalid',sshUser:'tester'},
  {ssh:{binary:fake,connectTimeout:3,serverAliveInterval:5}},'newpass',{user:'child',password:secret});
 assert.equal(response.ok,true);
 const args=JSON.parse(fs.readFileSync(capture,'utf8')).join(' ');
 assert.match(args,/StrictHostKeyChecking=yes/);
 assert.match(args,/sudo -n homelan-client rpc --stdio/);
 assert.equal(args.includes(secret),false);
 fs.rmSync(dir,{recursive:true,force:true});
});
