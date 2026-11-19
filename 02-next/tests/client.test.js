import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {dispatch,handleLine} from '../packages/homelan-client/src/index.js';
import {request} from '../packages/homelan-protocol/src/index.js';
import {makeNoNodeEnv} from './helpers/no-node-env.js';
import {POSIX_ONLY,LINUX_ONLY} from './helpers/platform.js';

test('client ping is available without privileged system changes',async()=>{
 const r=await dispatch(request('ping',{},'p1'));
 assert.equal(r.ok,true);assert.equal(r.id,'p1');assert.equal(r.result.clientVersion,'2.1.0');
});
test('client rejects invalid protocol version',async()=>{
 const r=await dispatch({...request('ping'),version:2});assert.equal(r.ok,false);assert.equal(r.error.code,'UNSUPPORTED_VERSION');
});
test('stdio handler returns one JSON response per request',async()=>{
 const r=JSON.parse(await handleLine(JSON.stringify(request('ping',{},'line-1'))));
 assert.equal(r.id,'line-1');assert.equal(r.ok,true);
});
test('malformed JSON is a protocol error, not a crash',async()=>{
 const r=JSON.parse(await handleLine('{oops'));assert.equal(r.ok,false);assert.equal(r.error.code,'INVALID_REQUEST');
});

test('client wire contract matches the standalone protocol package',async()=>{
 const clientProtocol=await import('../packages/homelan-client/src/protocol.js');
 const adminProtocol=await import('../packages/homelan-admin/src/protocol.js');
 const canonical=await import('../packages/homelan-protocol/src/index.js');
 for(const copy of [clientProtocol,adminProtocol]){assert.deepEqual(copy.OPERATIONS,canonical.OPERATIONS);assert.equal(copy.PROTOCOL,canonical.PROTOCOL);assert.equal(copy.PROTOCOL_VERSION,canonical.PROTOCOL_VERSION);}
});

test('client refuses poweroff unless the RPC itself carries explicit confirmation',async()=>{
 const r=await dispatch(request('poweroff',{},'no-confirm'),{systemReport:{supported:true,ready:true,adapter:'linux-systemd',facts:{os:'linux',desktop:'xfce',commands:{}},capabilities:{poweroff:true}}});
 assert.equal(r.ok,false);assert.equal(r.error.code,'PRECONDITION_FAILED');
});

test('client rejects non-boolean autologin values',async()=>{
 const r=await dispatch(request('autologin',{enabled:'false',user:'child'},'bad-bool'),{systemReport:{supported:true,ready:true,adapter:'linux-systemd',facts:{os:'linux',desktop:'xfce',commands:{}},capabilities:{lightdmAutologin:true}}});
 assert.equal(r.ok,false);assert.match(r.error.message,/boolean/);
});

test('client exposes system discovery and a declarative platform install plan',async()=>{
 const inspect=await dispatch(request('inspect',{},'inspect-1'));
 assert.equal(inspect.ok,true);assert.equal(inspect.result.schema,1);assert.equal(typeof inspect.result.ready,'boolean');assert.ok(inspect.result.facts.os);assert.ok(inspect.result.adapter);
 const plan=await dispatch(request('plan',{},'plan-1'));
 assert.equal(plan.ok,true);assert.equal(plan.result.schema,1);assert.ok(Array.isArray(plan.result.steps));
});

test('unsupported platform operations fail closed with a plan instead of running Linux commands',async()=>{
 const system=await import('../packages/homelan-client/src/system.js');
 const report=system.inspectSystem();
 assert.ok(['linux-systemd','windows-pending','unsupported'].includes(report.adapter));
 if(report.adapter!=='linux-systemd')assert.equal(report.supported,false);
});

test('client refuses platform-specific operations when the detected adapter is unsupported',async()=>{
 const systemReport={supported:false,adapter:'windows-pending',capabilities:{},facts:{os:'windows',desktop:'windows-shell',commands:{},nodeVersion:'v22'}};
 const r=await dispatch(request('locknow',{user:'kid'},'windows-lock'),{systemReport});
 assert.equal(r.ok,false);assert.equal(r.error.code,'NOT_SUPPORTED');assert.equal(r.error.details.adapter,'windows-pending');
});

test('pre-Node Linux bootstrap emits a valid read-only system report',{skip:LINUX_ONLY},()=>{
 const script=path.resolve('packages/homelan-client/bootstrap/linux.sh');
 const r=spawnSync('sh',[script],{encoding:'utf8',timeout:5000});
 assert.equal(r.status,0,r.stderr);const report=JSON.parse(r.stdout);
 assert.equal(report.source,'homelan-client-bootstrap');assert.equal(report.facts.os,'linux');
 assert.equal(typeof report.supported,'boolean');assert.equal(typeof report.ready,'boolean');
 assert.ok(Array.isArray(report.steps));
});

test('pre-Node bootstrap identifies a missing Node runtime without installing anything',{skip:POSIX_ONLY},()=>{
 const script=path.resolve('packages/homelan-client/bootstrap/linux.sh');
 const hermetic=makeNoNodeEnv();
 try{
  const r=spawnSync('sh',[script],{encoding:'utf8',timeout:5000,env:hermetic.env});
  assert.equal(r.status,0,r.stderr);const report=JSON.parse(r.stdout);
  assert.equal(report.runtimeReady,false);assert.equal(report.ready,false);
  assert.equal(report.steps.find(x=>x.id==='runtime').action,'install');
 }finally{hermetic.cleanup();}
});
