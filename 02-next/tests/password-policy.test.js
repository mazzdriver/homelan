import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validatePasswordPolicy,PASSWORD_MIN_DEFAULT,PASSWORD_MAX} from '../packages/homelan-protocol/src/index.js';
import {resolveMinLength,weaknessWarning} from '../packages/homelan-admin/src/password-policy.js';
import {POSIX_ONLY} from './helpers/platform.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const cli=path.resolve(here,'../packages/homelan-admin/bin/homelan.js');
const protocolUrl=new URL('../packages/homelan-protocol/src/index.js',import.meta.url).href;

test('default policy is unchanged: 12-256 characters, same message as before',()=>{
 assert.equal(PASSWORD_MIN_DEFAULT,12);
 assert.deepEqual(validatePasswordPolicy('a'.repeat(12)),{ok:true});
 const r=validatePasswordPolicy('a'.repeat(11));
 assert.equal(r.ok,false);assert.equal(r.reason,'Password must be 12-256 characters and contain no colon or newline');
 assert.equal(validatePasswordPolicy('a'.repeat(PASSWORD_MAX)).ok,true);
 assert.equal(validatePasswordPolicy('a'.repeat(PASSWORD_MAX+1)).ok,false);
});

test('a lower minimum accepts short passwords down to a single character',()=>{
 assert.equal(validatePasswordPolicy('7',1).ok,true);
 assert.equal(validatePasswordPolicy('42',2).ok,true);
 assert.equal(validatePasswordPolicy('7',2).ok,false);
 assert.match(validatePasswordPolicy('7',2).reason,/2-256 characters/);
});

test('whatever the minimum, an empty password and forbidden characters are refused',()=>{
 for(const min of [1,2,12]){
  assert.equal(validatePasswordPolicy('',min).ok,false);
  for(const bad of ['a:b','a\nb','a\0b'])assert.equal(validatePasswordPolicy(bad+'x'.repeat(12),min).ok,false,JSON.stringify(bad));
 }
 for(const notString of [null,undefined,1234,[],{}])assert.equal(validatePasswordPolicy(notString,1).ok,false);
});

test('an invalid minimum is rejected instead of silently weakening the check',()=>{
 for(const min of [0,-1,257,1.5,NaN,'4',null,Infinity]){
  const r=validatePasswordPolicy('long enough password',min===null?null:min);
  assert.equal(r.ok,false,String(min));assert.match(r.reason,/Minimum password length/);
 }
});

test('admin resolves the minimum: flag, then config, then strict default; garbage is an error',()=>{
 assert.equal(resolveMinLength({}),12);
 assert.equal(resolveMinLength({configured:4}),4);
 assert.equal(resolveMinLength({configured:4,flag:'2'}),2);
 assert.equal(resolveMinLength({flag:1}),1);
 for(const bad of ['abc','0','257','3.5','',-2,{},[]])assert.throws(()=>resolveMinLength({flag:bad}),/--min-length must be an integer/,String(bad));
 assert.throws(()=>resolveMinLength({configured:'x'}),/passwordMinLength in config/);
});

test('a warning appears only for minimums below 8',()=>{
 assert.equal(weaknessWarning(12),null);assert.equal(weaknessWarning(8),null);
 assert.match(weaknessWarning(2),/minimum password length is 2/);
});

// --- end to end through the real CLI with a fake ssh executable ---
function lab(config={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'homelan-pw-'));
 const log=path.join(dir,'requests.jsonl');
 const fake=path.join(dir,'fake-ssh');
 fs.writeFileSync(fake,`#!${process.execPath}
import fs from 'node:fs';
import {success} from '${protocolUrl}';
const req=JSON.parse(fs.readFileSync(0,'utf8').trim());
fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({operation:req.operation,params:req.params,argv:process.argv.slice(2)})+'\\n');
const caps={discovery:true,rpc:true,sessionLock:true,accountManagement:true,lightdmAutologin:true,arm:true,locker:false,timer:false,poweroff:true};
const result=req.operation==='ping'?{clientVersion:'2.1.0',protocolVersion:1,supportedProtocolVersions:[1],adapter:'linux-systemd',ready:true,capabilities:caps}:{ok:true,passwordChanged:true};
process.stdout.write(JSON.stringify(success(req,result))+'\\n');
`,{mode:0o755});
 fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify({schema:1,...config,ssh:{binary:fake,connectTimeout:4,serverAliveInterval:6},devices:[{id:'box1',name:'box1',address:'192.0.2.10',sshUser:'admin',port:22,managedUsers:['child1']}]}));
 const run=(args,input)=>{const r=spawnSync(process.execPath,[cli,...args],{input,encoding:'utf8',env:{...process.env,HOMELAN_HOME:dir},timeout:15000});
  const sent=fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)):[];return {...r,sent};};
 return {dir,run,cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};
}

test('CLI newpass: default policy refuses a short password before anything is sent',{skip:POSIX_ONLY},()=>{
 const l=lab();try{
  const r=l.run(['newpass','box1','--user','child1','--password-stdin'],'42\n');
  assert.notEqual(r.status,0);assert.match(r.stderr,/Password must be 12-256 characters/);assert.deepEqual(r.sent,[]);
 }finally{l.cleanup();}
});

test('CLI newpass: --min-length allows a short password, warns, and sends minLength',{skip:POSIX_ONLY},()=>{
 const l=lab();try{
  const r=l.run(['newpass','box1','--user','child1','--password-stdin','--min-length','2'],'42\n');
  assert.equal(r.status,0,r.stderr);assert.match(r.stderr,/WARNING: minimum password length is 2/);
  assert.deepEqual(r.sent.map(x=>x.operation),['ping','newpass']);
  assert.deepEqual(r.sent[1].params,{user:'child1',password:'42',minLength:2});
  assert.equal(r.sent.some(x=>JSON.stringify(x.argv).includes('42')),false,'password must never be in argv');
 }finally{l.cleanup();}
});

test('CLI newpass: config passwordMinLength applies without a flag',{skip:POSIX_ONLY},()=>{
 const l=lab({passwordMinLength:1});try{
  const r=l.run(['newpass','box1','--user','child1','--password-stdin'],'7\n');
  assert.equal(r.status,0,r.stderr);assert.deepEqual(r.sent[1].params,{user:'child1',password:'7',minLength:1});
 }finally{l.cleanup();}
});

test('CLI newpass: with the strict default the request is identical to the old protocol (no minLength)',{skip:POSIX_ONLY},()=>{
 const l=lab();try{
  const r=l.run(['newpass','box1','--user','child1','--password-stdin'],'a-long-enough-pass\n');
  assert.equal(r.status,0,r.stderr);assert.equal(r.stderr.includes('WARNING'),false);
  assert.deepEqual(r.sent[1].params,{user:'child1',password:'a-long-enough-pass'});
 }finally{l.cleanup();}
});

test('CLI newpass: an invalid --min-length is an error and nothing is sent',{skip:POSIX_ONLY},()=>{
 const l=lab();try{
  for(const bad of ['0','abc','999']){
   const r=l.run(['newpass','box1','--user','child1','--password-stdin','--min-length',bad],'pass\n');
   assert.notEqual(r.status,0,bad);assert.match(r.stderr,/--min-length must be an integer/);assert.deepEqual(r.sent,[],bad);
  }
 }finally{l.cleanup();}
});
