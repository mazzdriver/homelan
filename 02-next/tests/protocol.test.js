import test from 'node:test';
import assert from 'node:assert/strict';
import {request,validateRequest,success,failure,ERROR,OPERATIONS} from '../packages/homelan-protocol/src/index.js';

test('request envelope is versioned and validates',()=>{
 const r=request('status',{},'test-1');
 assert.deepEqual(r,{protocol:'homelan.rpc',version:1,id:'test-1',operation:'status',params:{}});
 assert.equal(validateRequest(r),null);
});
test('unknown operations are rejected before dispatch',()=>{
 assert.throws(()=>request('shell.exec'),/Unsupported operation/);
});
test('version mismatch is detected',()=>{
 assert.match(validateRequest({...request('ping'),version:99}),/version/);
});
test('success and failure responses retain request id',()=>{
 const r=request('ping',{},'abc');assert.equal(success(r,{pong:true}).id,'abc');
 assert.equal(failure(r,ERROR.OPERATION_FAILED,'no').error.code,'OPERATION_FAILED');
});
test('operation set does not expose arbitrary command execution',()=>{
 assert.equal(OPERATIONS.includes('shell.exec'),false);
 assert.equal(OPERATIONS.includes('poweroff'),true);
});
