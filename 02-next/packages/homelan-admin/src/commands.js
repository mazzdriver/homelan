import fs from 'node:fs';import os from 'node:os';import crypto from 'node:crypto';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {loadConfig,saveConfig,findDevice,CONFIG_DIR} from './config.js';
import {invoke} from './ssh.js';
import {guardedInvoke} from './preflight.js';
import {compatibilityMatrix} from './protocol.js';
import {inspectSystem as inspectLocalSystem} from './local-system.js';
const c=loadConfig();
const usage=`HomeLAN 2.1.0

Commands:
  init
  system inspect
  device add <id> --address <host> --user <ssh-user> [--port <port>] [--identity <file>] [--managed-users <csv>]
  device list
  device remove <id>
  device check <id|all>
  client enroll <id>
  client install <id|all>
  client update <id|all>
  client status <id|all>
  client diagnose <id>
  client inspect <id|all>
  client compat <id|all>
  client plan <id|all>
  lock <id> --user <name>
  locknow <id> [--user <name>]
  newpass <id> --user <name> [--password-stdin]
  autologin <id> --user <name> --enable|--disable
  locker <id> --user <name> --time <minutes>
  arm <id> --user <name> --time <minutes>
  poweroff <id> --confirm

Secrets are read from stdin. SSH host keys must already be trusted in known_hosts.
`;
function parse(argv){const positional=[],opts={};for(let i=0;i<argv.length;i++){const a=argv[i];if(a.startsWith('--')){const k=a.slice(2);if(['enable','disable','confirm','password-stdin','yes'].includes(k))opts[k]=true;else{if(i+1>=argv.length)throw new Error(`Missing value for ${a}`);opts[k]=argv[++i];}}else positional.push(a);}return {positional,opts};}
function target(id){const devices=id==='all'?c.devices.map(d=>findDevice(c,d.id)):[findDevice(c,id)];if(!devices.length)throw new Error('No devices configured; add one with homelan device add');return devices;}
function requireOpt(o,k){if(!o[k])throw new Error(`Missing --${k}`);return o[k];}
async function secret(){if(!process.stdin.isTTY){const s=fs.readFileSync(0,'utf8').replace(/\r?\n$/,'');if(!s)throw new Error('Empty secret on stdin');return s;}return await new Promise((resolve,reject)=>{const input=process.stdin;let value='';const finish=(err)=>{input.setRawMode?.(false);input.pause();input.removeListener('data',onData);process.stderr.write('\n');err?reject(err):resolve(value);};const onData=(chunk)=>{for(const ch of chunk.toString('utf8')){if(ch==='\u0003'){finish(new Error('Cancelled'));return;}if(ch==='\r'||ch==='\n'){finish();return;}if(ch==='\u007f'||ch==='\b'){value=value.slice(0,-1);continue;}if(ch>=' '&&ch<='~')value+=ch;}};process.stderr.write('New password (input hidden): ');input.setRawMode(true);input.resume();input.on('data',onData);});}
function result(device,response){if(!response.ok)throw new Error(`${device.id}: ${response.error.code}: ${response.error.message}`);return response.result;}
async function each(id,op,params){const ds=target(id);if(!ds.length)throw new Error('No devices configured');let failed=0;for(const d of ds){try{const r=await guardedInvoke(invoke,d,c,op,typeof params==='function'?params(d):params);console.log(`\n[${d.id}]`);const value=result(d,r);console.log(JSON.stringify(value,null,2));if(value?.partialFailure||value?.ok===false||value?.notImplemented)failed++;}catch(e){failed++;console.error(`\n[${d.id}] ERROR: ${e.message}`);}}if(failed)process.exitCode=1;}
function init(){fs.mkdirSync(CONFIG_DIR,{recursive:true,mode:0o700});if(!fs.existsSync(path.join(CONFIG_DIR,'config.json')))saveConfig(c);console.log(`Initialized ${CONFIG_DIR}`);}
function addDevice(id,o){if(!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(id))throw new Error('Invalid device id');if(c.devices.some(d=>d.id===id))throw new Error(`Device ${id} already exists`);const address=requireOpt(o,'address');if(!/^[A-Za-z0-9][A-Za-z0-9._:%\-\[\]]*$/.test(address))throw new Error('Invalid address');const sshUser=requireOpt(o,'user');if(!/^[A-Za-z_][A-Za-z0-9._-]{0,31}$/.test(sshUser))throw new Error('Invalid SSH username');const port=o.port===undefined?undefined:Number(o.port);if(port!==undefined&&(!Number.isInteger(port)||port<1||port>65535))throw new Error('Invalid SSH port');const managedUsers=o['managed-users']?o['managed-users'].split(','):[];if(managedUsers.some(u=>!/^[a-z_][a-z0-9_-]{0,31}$/.test(u)))throw new Error('Invalid managed username');c.devices.push({id,address,sshUser,...(port?{port}:{}),...(o.identity?{identityFile:path.resolve(o.identity)}:{}),managedUsers});saveConfig(c);console.log(`Added ${id}. No network connection was made.`);}
function removeDevice(id){if(!id)throw new Error('device remove requires an id');const before=c.devices.length;c.devices=c.devices.filter(d=>d.id!==id);if(c.devices.length===before)throw new Error(`Unknown device '${id}'`);saveConfig(c);console.log(`Removed ${id}`);}
async function check(id){const {spawnSync}=await import('node:child_process');for(const d of target(id)){const args=['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o',`ConnectTimeout=${c.ssh.connectTimeout??8}`,...(d.port?['-p',String(d.port)]:[]),...(d.identityFile?['-i',d.identityFile]:[]),`${d.sshUser}@${d.address}`,'true'];const r=spawnSync(c.ssh.binary||'ssh',args,{encoding:'utf8'});console.log(`${d.id}: ${r.status===0?'SSH OK':`FAILED — ${(r.stderr||r.error?.message||'connection error').trim()}`}`);if(r.status!==0)process.exitCode=1;}}
function packClient(){const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../homelan-client');if(fs.existsSync(path.join(dir,'package.json'))){const r=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['pack',dir,'--pack-destination',os.tmpdir()],{encoding:'utf8',shell:process.platform==='win32'});if(r.error)throw new Error(r.error.message);if(r.status!==0)throw new Error(r.stderr||r.stdout);const line=r.stdout.trim().split('\n').find(x=>x.endsWith('.tgz'));if(!line)throw new Error('npm pack did not return archive name');return path.join(os.tmpdir(),line);}const candidates=[process.env.HOMELAN_CLIENT_ARCHIVE?path.resolve(process.env.HOMELAN_CLIENT_ARCHIVE):null,path.resolve(process.cwd(),'packages/homelan-client-2.1.0.tgz'),path.resolve(process.cwd(),'release/offline/packages/homelan-client-2.1.0.tgz'),path.resolve(process.cwd(),'release/npm/homelan-client-2.1.0.tgz')].filter(Boolean);return candidates.find(x=>fs.existsSync(x))||null;}
function bootstrapFile(){const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../bootstrap/linux.sh');if(!fs.existsSync(file))throw new Error('Linux bootstrap helper is missing from the Admin package');return file;}
async function inspectRemote(id,operation){
 const archive=packClient();const helper=archive?null:bootstrapFile();const name=archive?path.basename(archive):'homelan-bootstrap.sh';for(const d of target(id)){try{
  const scpSource=archive||helper;const scpArgs=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o',`ConnectTimeout=${c.ssh.connectTimeout??8}`,'-P',String(d.port||22),...(d.identityFile?['-i',d.identityFile]:[]),scpSource,`${d.sshUser}@${d.address}:/tmp/${name}`];
  const cp=spawnSync('scp',scpArgs,{encoding:'utf8'});if(cp.status!==0)throw new Error(cp.stderr||'scp failed');
  const args=['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o',`ConnectTimeout=${c.ssh.connectTimeout??8}`,...(d.port?['-p',String(d.port)]:[]),...(d.identityFile?['-i',d.identityFile]:[]),`${d.sshUser}@${d.address}`];
  const remote=archive?`mkdir -p /tmp/homelan-bootstrap && tar -xzf /tmp/${name} -C /tmp/homelan-bootstrap && sh /tmp/homelan-bootstrap/package/bootstrap/linux.sh; rc=$?; rm -rf /tmp/homelan-bootstrap /tmp/${name}; exit $rc`:`sh /tmp/${name}; rc=$?; rm -f /tmp/${name}; exit $rc`;
  const r=spawnSync(c.ssh.binary||'ssh',[...args,remote],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||'remote discovery failed');
  const value=JSON.parse(r.stdout.trim().split('\n').at(-1));console.log(`\n[${d.id}]`);console.log(JSON.stringify(value,null,2));
 }catch(e){console.error(`[${d.id}] ${e.message}`);process.exitCode=1;}}
}
async function compat(id){for(const d of target(id)){try{const ping=result(d,await invoke(d,c,'ping'));const matrix=compatibilityMatrix(ping);const blocked=Object.entries(matrix).filter(([,v])=>!v.ok).map(([op,v])=>({operation:op,code:v.code,reason:v.reason}));console.log(`\n[${d.id}]`);console.log(JSON.stringify({clientVersion:ping.clientVersion,protocolVersion:ping.protocolVersion,adapter:ping.adapter??null,capabilities:ping.capabilities??null,allowed:Object.entries(matrix).filter(([,v])=>v.ok).map(([op])=>op),blocked},null,2));}catch(e){console.error(`[${d.id}] ${e.message}`);process.exitCode=1;}}}
async function deploy(id,operation){const archive=packClient();const name=archive?path.basename(archive):null;for(const d of target(id)){try{
 {const source=archive||bootstrapFile();const remoteName=archive?name:'homelan-bootstrap.sh';const scpArgs=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o',`ConnectTimeout=${c.ssh.connectTimeout??8}`,'-P',String(d.port||22),...(d.identityFile?['-i',d.identityFile]:[]),source,`${d.sshUser}@${d.address}:/tmp/${remoteName}`];const cp=spawnSync('scp',scpArgs,{encoding:'utf8'});if(cp.status!==0)throw new Error(cp.stderr||'scp failed');}
 const users=(d.managedUsers||[]).join(',');if((d.managedUsers||[]).some(u=>!/^[a-z_][a-z0-9_-]{0,31}$/.test(u)))throw new Error('Invalid managed username in device registry');
 const bootstrap=archive?`mkdir -p /tmp/homelan-bootstrap && tar -xzf /tmp/${name} -C /tmp/homelan-bootstrap && sh /tmp/homelan-bootstrap/package/bootstrap/linux.sh; rc=$?; rm -rf /tmp/homelan-bootstrap /tmp/${name}; exit $rc`:`sh /tmp/homelan-bootstrap.sh; rc=$?; rm -f /tmp/homelan-bootstrap.sh; exit $rc`;
 const baseArgs=['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o',`ConnectTimeout=${c.ssh.connectTimeout??8}`,...(d.port?['-p',String(d.port)]:[]),...(d.identityFile?['-i',d.identityFile]:[]),`${d.sshUser}@${d.address}`];
 const pre=spawnSync(c.ssh.binary||'ssh',[...baseArgs,bootstrap],{encoding:'utf8'});if(pre.status!==0)throw new Error(`Remote discovery failed: ${pre.stderr||pre.stdout}`);
 let report;try{report=JSON.parse(pre.stdout.trim().split('\n').at(-1));}catch{throw new Error(`Remote discovery returned invalid data: ${pre.stdout}`);}
 console.log(`[${d.id}] detected ${report.facts.distroName||report.facts.os} / ${report.facts.desktop||'no desktop'} / ${report.adapter}`);for(const step of report.steps||[])console.log(`  - ${step.id}: ${step.action} ${step.target}${step.reason?` (${step.reason})`:''}`);
 if(report.supported!==true)throw new Error(`No supported client adapter for ${d.id}: ${report.adapter||report.facts?.os}`);if(report.ready!==true)throw new Error(`Target ${d.id} is not ready for enrollment; resolve required plan steps shown above`);
 const install=archive?`sudo npm install -g /tmp/${name}`:'sudo npm install -g @homelan/client@2.1.0';const enroll=operation==='enroll'?` && sudo homelan-client enroll ${d.id} ${users}`:'';
 const remote=`${install}${enroll} && ${archive?'rm -rf /tmp/homelan-bootstrap /tmp/'+name:'rm -f /tmp/homelan-bootstrap.sh'}`;
 const rr=spawnSync(c.ssh.binary||'ssh',[...baseArgs,remote],{encoding:'utf8'});if(rr.status!==0)throw new Error(rr.stderr||'remote npm install failed');
 if(operation==='install'||operation==='enroll'){const response=await guardedInvoke(invoke,d,c,'install');result(d,response);}
 console.log(`[${d.id}] ${operation} completed; package deployed (${name||'@homelan/client@'+(c.client?.packageVersion||'2.1.0')})`);
 }catch(e){console.error(`[${d.id}] ${e.message}`);process.exitCode=1;}}
}
export async function main(argv){
 if(!argv.length||argv[0]==='--help'||argv[0]==='-h'){console.log(usage);return;}
 const [area,sub,...rest]=argv;const {positional:p,opts:o}=parse(rest);
 if(area==='init'){init();return;}
 if(area==='system'&&sub==='inspect'){console.log(JSON.stringify(inspectLocalSystem(),null,2));return;}
 if(area==='device'){
  if(sub==='add'){if(!p[0])throw new Error('device add requires an id');addDevice(p[0],o);return;}
  if(sub==='list'){console.log(JSON.stringify(c.devices,null,2));return;}
  if(sub==='remove'){removeDevice(p[0]);return;}
  if(sub==='check'){await check(p[0]||'all');return;}
 }
 if(area==='client'){
  const id=p[0]||'all';if(sub==='enroll'){await deploy(id,'enroll');return;}
  if(sub==='install'||sub==='update'){await deploy(id,sub);return;}
  if(sub==='inspect'||sub==='plan'){await inspectRemote(id,sub);return;}
  if(sub==='compat'){await compat(id);return;}
  if(sub==='status'||sub==='diagnose'){await each(id,sub,{});return;}
 }
 if(area==='lock'){const id=sub,user=requireOpt(o,'user'),password=crypto.randomBytes(24).toString('base64url');const ds=target(id);let failures=0;for(const d of ds){try{const r=await guardedInvoke(invoke,d,c,'lock',{user,password});const value=result(d,r);console.log(`[${d.id}] ${JSON.stringify(value)}`);if(!value.ok)failures++;}catch(e){failures++;console.error(`[${d.id}] ERROR: ${e.message}`);}}if(failures===0)console.log(`One-time recovery password for ${user}: ${password}`);else console.error('Lock did not fully succeed on every target; recovery password withheld. Check per-device results and recover access locally if needed.');if(failures)process.exitCode=1;return;}
 if(area==='locknow'){await each(sub,'locknow',{user:o.user||null});return;}
 if(area==='newpass'){const id=sub,user=requireOpt(o,'user');if(!process.stdin.isTTY&&!o['password-stdin'])throw new Error('When piping a password, add --password-stdin');if(process.stdin.isTTY&&o['password-stdin'])throw new Error('--password-stdin requires piped input');const password=await secret();await each(id,'newpass',{user,password});return;}
 if(area==='autologin'){const id=sub,user=requireOpt(o,'user');if(Boolean(o.enable)===Boolean(o.disable))throw new Error('Specify exactly one of --enable or --disable');await each(id,'autologin',{user,enabled:Boolean(o.enable)});return;}
 if(area==='locker'||area==='arm'){const id=sub,user=requireOpt(o,'user'),minutes=Number(requireOpt(o,'time'));if(!Number.isInteger(minutes)||minutes<0)throw new Error('--time must be a non-negative integer');await each(id,area==='locker'?'locker.set':'arm.set',{user,minutes});return;}
 if(area==='poweroff'){const id=sub;if(!o.confirm)throw new Error('Poweroff is destructive. Re-run with --confirm.');await each(id,'poweroff',{confirmed:true});return;}
 throw new Error(`Unknown command. Run homelan --help. (${area} ${sub||''})`);
}
