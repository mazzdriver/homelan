import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {OPERATIONS,OPERATION_CAPABILITIES,compareVersions,negotiate,compatibilityMatrix,request,CLIENT_VERSION,PROTOCOL_VERSION} from '../packages/homelan-protocol/src/index.js';
import {dispatch} from '../packages/homelan-client/src/index.js';
import {inspectSystem} from '../packages/homelan-client/src/system.js';
import {guardedInvoke,preflight,PreflightError} from '../packages/homelan-admin/src/preflight.js';

const fullCaps={discovery:true,rpc:true,sessionLock:true,accountManagement:true,lightdmAutologin:true,arm:true,locker:false,timer:false,poweroff:true};
const modern=(over={})=>({clientVersion:'2.1.0',protocolVersion:1,supportedProtocolVersions:[1],adapter:'linux-systemd',ready:true,capabilities:fullCaps,...over});

test('version comparison is numeric, not lexical, and rejects garbage',()=>{
 assert.equal(compareVersions('2.10.0','2.9.0'),1);
 assert.equal(compareVersions('2.1.0','2.1.0'),0);
 assert.equal(compareVersions('v2.0.0','2.1.0'),-1);
 assert.equal(compareVersions('2.1.0-rc1','2.1.0'),0);
 assert.equal(compareVersions('latest','2.1.0'),null);
 assert.equal(compareVersions(undefined,'2.1.0'),null);
});

test('a current, capable client may receive every operation it supports',()=>{
 for(const op of ['ping','status','diagnose','inspect','plan','lock','locknow','newpass','autologin','arm.set','poweroff','install'])
  assert.equal(negotiate(modern(),op).ok,true,op);
});

test('LOCKER stays inactive: the capability is false so locker.set is refused before sending',()=>{
 const r=negotiate(modern(),'locker.set');
 assert.equal(r.ok,false);assert.equal(r.code,'NOT_SUPPORTED');assert.deepEqual(r.details.missing,['locker']);
});

test('protocol mismatch, too-old client and per-operation minimum versions are refused',()=>{
 assert.equal(negotiate(modern({protocolVersion:2,supportedProtocolVersions:[2]}),'status').code,'UNSUPPORTED_VERSION');
 assert.equal(negotiate(modern({clientVersion:'1.9.0'}),'status').code,'UNSUPPORTED_VERSION');
 const r=negotiate({clientVersion:'2.0.0',protocolVersion:1},'inspect');
 assert.equal(r.ok,false);assert.match(r.reason,/inspect needs client 2\.1\.0/);
});

test('a 2.0 client without reported capabilities is allowed but flagged as client-enforced',()=>{
 const old={clientVersion:'2.0.0',protocolVersion:1};
 assert.deepEqual(negotiate(old,'lock'),{ok:true,capabilityCheck:'client-enforced'});
 assert.equal(negotiate(old,'status').capabilityCheck,'not-required');
});

test('unreadable or missing client data fails closed',()=>{
 for(const bad of [null,undefined,'x',[],{},{clientVersion:'banana',protocolVersion:1}])
  assert.equal(negotiate(bad,'status').ok,false);
 assert.equal(negotiate(modern(),'shell.exec').code,'UNKNOWN_OPERATION');
});

test('compatibility matrix covers every protocol operation',()=>{
 const m=compatibilityMatrix(modern());
 assert.deepEqual(Object.keys(m),[...OPERATIONS]);
 assert.equal(m['locker.set'].ok,false);assert.equal(m.poweroff.ok,true);
});

test('capability map only names operations and capabilities that actually exist',()=>{
 const known=new Set(Object.keys(inspectSystem().capabilities));
 for(const [op,caps] of Object.entries(OPERATION_CAPABILITIES)){
  assert.ok(OPERATIONS.includes(op),op);
  for(const c of caps)assert.ok(known.has(c),`${op} -> ${c}`);
 }
});

test('client ping reports version, protocol, adapter and capabilities that agree with negotiate()',async()=>{
 const report={supported:true,ready:true,adapter:'linux-systemd',facts:{os:'linux'},capabilities:fullCaps};
 const r=await dispatch(request('ping',{},'p'),{systemReport:report});
 assert.equal(r.ok,true);assert.equal(r.result.clientVersion,CLIENT_VERSION);assert.equal(r.result.protocolVersion,PROTOCOL_VERSION);
 assert.deepEqual(r.result.supportedProtocolVersions,[1]);assert.equal(r.result.adapter,'linux-systemd');assert.deepEqual(r.result.capabilities,fullCaps);
 assert.equal(negotiate(r.result,'poweroff').ok,true);assert.equal(negotiate(r.result,'locker.set').ok,false);
});

test('Admin preflight blocks an unsupported operation without ever sending it or its secret',async()=>{
 const sent=[];
 const stub=async(device,cfg,op,params)=>{sent.push({op,params});return {ok:true,result:modern({capabilities:{...fullCaps,accountManagement:false}})};};
 await assert.rejects(()=>guardedInvoke(stub,{id:'box1'},{},'newpass',{user:'kid',password:'hunter2-secret'}),e=>{
  assert.ok(e instanceof PreflightError);assert.equal(e.code,'NOT_SUPPORTED');assert.match(e.message,/box1: newpass not sent/);return true;
 });
 assert.deepEqual(sent.map(x=>x.op),['ping']);
 assert.equal(JSON.stringify(sent).includes('hunter2-secret'),false);
});

test('Admin preflight sends the real operation after a successful check, and does not ping for ping',async()=>{
 const sent=[];
 const stub=async(device,cfg,op,params)=>{sent.push(op);return op==='ping'?{ok:true,result:modern()}:{ok:true,result:{done:true}};};
 const r=await guardedInvoke(stub,{id:'box1'},{},'locknow',{user:'kid'});
 assert.equal(r.ok,true);assert.deepEqual(sent,['ping','locknow']);
 sent.length=0;await preflight(stub,{id:'box1'},{},'ping');assert.deepEqual(sent,[]);
 sent.length=0;await guardedInvoke(stub,{id:'box1'},{},'ping');assert.deepEqual(sent,['ping']);
});

test('Admin preflight surfaces an unreachable or failing ping as a refusal, not a send',async()=>{
 const sent=[];
 const stub=async(d,c,op)=>{sent.push(op);return {ok:false,error:{code:'PERMISSION_DENIED',message:'sudo denied'}};};
 await assert.rejects(()=>guardedInvoke(stub,{id:'box1'},{},'lock',{user:'kid',password:'x'}),/Client ping failed: sudo denied/);
 assert.deepEqual(sent,['ping']);
});

test('the three vendored protocol copies are byte-identical',()=>{
 const root=path.resolve('packages');
 const canonical=fs.readFileSync(path.join(root,'homelan-protocol/src/index.js'),'utf8');
 assert.equal(fs.readFileSync(path.join(root,'homelan-client/src/protocol.js'),'utf8'),canonical);
 assert.equal(fs.readFileSync(path.join(root,'homelan-admin/src/protocol.js'),'utf8'),canonical);
});
