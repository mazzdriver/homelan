import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {invoke, sshArgs, SshError} from '../packages/homelan-admin/src/ssh.js';

const device = {id:'testbox', address:'192.0.2.10', sshUser:'tester', port:2222, identityFile:'/tmp/test-key'};
const config = {ssh:{binary:'ssh', connectTimeout:4, serverAliveInterval:6}};

function mockSpawn({exitCode=0, stderr='', response, delay=0}={}) {
  const calls = [];
  const spawnImpl = (binary, args, options) => {
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => { child.killed = true; return true; };
    child.stdin.on('data', chunk => { child.input = (child.input || '') + chunk.toString(); });
    child.stdin.on('end', () => {
      calls.push({binary,args,options,input:child.input || '',child});
      setTimeout(() => {
        if (stderr) child.stderr.write(stderr);
        if (response !== undefined) child.stdout.write(typeof response === 'function' ? response(child.input) : response);
        child.stdout.end(); child.stderr.end(); child.emit('close', exitCode);
      }, delay);
    });
    return child;
  };
  return {spawnImpl,calls};
}

test('SSH arguments pin host keys and preserve configured port and identity', () => {
  const args = sshArgs(device, config);
  assert.ok(args.includes('StrictHostKeyChecking=yes'));
  assert.ok(args.includes('BatchMode=yes'));
  assert.ok(args.includes('2222'));
  assert.ok(args.includes('/tmp/test-key'));
  assert.ok(args.includes('tester@192.0.2.10'));
});

test('SSH transport sends a versioned RPC request over stdin', async () => {
  const mock = mockSpawn({response: input => {
    const req = JSON.parse(input);
    return JSON.stringify({id:req.id, ok:true, result:{accepted:true}}) + '\n';
  }});
  const result = await invoke(device, config, 'ping', {}, {spawnImpl:mock.spawnImpl});
  assert.equal(result.ok, true);
  assert.equal(JSON.parse(mock.calls[0].input).operation, 'ping');
  assert.ok(mock.calls[0].args.includes('StrictHostKeyChecking=yes'));
});

test('SSH transport reports connection failures distinctly', async () => {
  const mock = mockSpawn({exitCode:255, stderr:'host key verification failed'});
  await assert.rejects(invoke(device, config, 'ping', {}, {spawnImpl:mock.spawnImpl}),
    error => error instanceof SshError && error.code === 'SSH_CONNECTION' && /host key verification failed/.test(error.message));
});

test('SSH transport rejects malformed and mismatched RPC responses', async () => {
  const malformed = mockSpawn({response:'not-json\n'});
  await assert.rejects(invoke(device, config, 'ping', {}, {spawnImpl:malformed.spawnImpl}), e => e.code === 'BAD_RESPONSE');
  const mismatch = mockSpawn({response:'{"id":"wrong-id","ok":true}\n'});
  await assert.rejects(invoke(device, config, 'ping', {}, {spawnImpl:mismatch.spawnImpl}), e => e.code === 'BAD_RESPONSE' && /ID mismatch/.test(e.message));
});

test('SSH transport rejects a non-zero remote command exit', async () => {
  const mock = mockSpawn({exitCode:42, stderr:'client unavailable'});
  await assert.rejects(invoke(device, config, 'status', {}, {spawnImpl:mock.spawnImpl}), e => e.code === 'REMOTE_FAILED' && /client unavailable/.test(e.message));
});

test('SSH transport times out and terminates a stuck process', async () => {
  const mock = mockSpawn({delay:500});
  await assert.rejects(invoke(device, config, 'status', {}, {spawnImpl:mock.spawnImpl, timeout:20}), e => e.code === 'TIMEOUT');
  assert.equal(mock.calls[0].child.killed, true);
});
