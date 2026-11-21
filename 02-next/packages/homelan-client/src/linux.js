import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {STATE_DIR,ensureState,readConfig} from './config.js';
import {validatePasswordPolicy,PASSWORD_MIN_DEFAULT} from './protocol.js';
const SYSTEMD='/etc/systemd/system';
function run(bin,args=[],opts={}){
 const r=spawnSync(bin,args,{encoding:'utf8',input:opts.input,timeout:opts.timeout??15000,stdio:['pipe','pipe','pipe']});
 if(r.error) throw new Error(`${bin}: ${r.error.message}`);
 if(r.status!==0) throw new Error(`${bin} exited ${r.status}: ${(r.stderr||r.stdout||'').trim()}`);
 return (r.stdout||'').trim();
}
function validUser(user){ if(typeof user!=='string'||!/^[a-z_][a-z0-9_-]{0,31}$/.test(user)) throw new Error('Invalid local username'); return user; }
export function assertLocalUser(user){validUser(user);const uid=Number(run('id',['-u',user]));if(!Number.isInteger(uid)||uid<1000)throw new Error(`Refusing to manage system account '${user}' (UID must be at least 1000)`);return uid;}
function assertManagedUser(user){validUser(user);const c=readConfig();if(!Array.isArray(c.managedUsers)||!c.managedUsers.includes(user))throw new Error(`'${user}' is not in the enrolled managedUsers list`);return assertLocalUser(user);}
function assertRoot(){ if(typeof process.getuid==='function'&&process.getuid()!==0) throw new Error('Client operation requires root (run via sudo)'); }
function userSessions(){
 try { const raw=run('loginctl',['list-sessions','--no-legend']); return raw.split('\n').filter(Boolean).map(line=>{const p=line.trim().split(/\s+/);return {id:p[0],uid:p[1],user:p[2],seat:p[3]&&p[3]!=='-'?p[3]:null};}); }
 catch { return []; }
}
export function status(){
 const c=readConfig(); let hostname='unknown'; try{hostname=run('hostname');}catch{}
 let active=false; try{active=userSessions().some(s=>s.seat && s.user && !['root','gdm'].includes(s.user));}catch{}
 const managedUserStates=(c.managedUsers||[]).map(user=>{let usedSeconds=0;try{usedSeconds=Number(fs.readFileSync(path.join(STATE_DIR,`${user}.use`),'utf8'))||0;}catch{}return {user,usedSeconds,expired:fs.existsSync(path.join(STATE_DIR,`${user}.expired`)),parentLocked:fs.existsSync(path.join(STATE_DIR,`${user}.parent-locked`))};});
 return {clientVersion:'2.1.0',deviceId:c.deviceId,hostname,platform:process.platform,managedUsers:c.managedUsers||[],managedUserStates,activeGraphicalSession:active,units:{arm:unit('homelan-arm.timer'),locker:unit('homelan-locker.timer')}};
}
function unit(name){try{return run('systemctl',['is-active',name]);}catch{return 'inactive';}}
export function diagnose(){
 const checks=[]; const check=(name,fn)=>{try{checks.push({name,ok:true,detail:fn()});}catch(e){checks.push({name,ok:false,detail:e.message});}};
 check('root',()=>String(process.getuid?.()===0)); check('systemd',()=>run('systemctl',['--version']).split('\n')[0]);
 check('loginctl',()=>run('loginctl',['--version']).split('\n')[0]); check('desktop-lock',()=>{if(process.env.XDG_CURRENT_DESKTOP?.toLowerCase().includes('xfce')){try{return run('sh',['-c','command -v light-locker-command || command -v xfce4-screensaver-command']);}catch{return 'no XFCE lock command found';}}return 'not required for logind lock';});
 check('config',()=>JSON.stringify(readConfig())); return {checks,ok:checks.every(x=>x.ok)};
}
export function locknow(user=null){
 assertRoot(); if(user)assertManagedUser(user);
 let sessions=userSessions().filter(s=>s.seat && s.user && !['root','gdm'].includes(s.user) && (!user||s.user===user));
 if(!sessions.length) throw new Error('No active seat session found; refusing to claim the screen was locked');
 const results=[];
 for(const s of sessions){ try{requestSessionLock(s.id);results.push({session:s.id,user:s.user,locked:true});}catch(e){results.push({session:s.id,user:s.user,locked:false,error:e.message});} }
 return {sessions:results,ok:results.every(x=>x.locked)};
}
export function setPassword(user,password,{resetUsage=true,minLength=PASSWORD_MIN_DEFAULT}={}){
 assertRoot(); assertManagedUser(user);
 const policy=validatePasswordPolicy(password,minLength);if(!policy.ok)throw new Error(policy.reason);
 // Secret is sent only over stdin; never placed in argv or logs.
 run('chpasswd',[],{input:`${user}:${password}\n`});
 let usageWindowReset=false;if(resetUsage){try{ensureState(); for(const suffix of ['use','expired','parent-locked']){const f=path.join(STATE_DIR,`${user}.${suffix}`);try{fs.unlinkSync(f);}catch(e){if(e.code!=='ENOENT')throw e;}}usageWindowReset=true;}catch(e){return {user,passwordChanged:true,usageWindowReset:false,partialFailure:true,stateError:e.message};}}
 return {user,passwordChanged:true,usageWindowReset:resetUsage?usageWindowReset:false};
}
export function lock(user,password){
 const screen=(()=>{try{return locknow(user);}catch(e){return {ok:false,error:e.message,sessions:[]};}})();
 if(!screen.ok)return {screen,credential:{passwordChanged:false,skipped:true,reason:'Screen lock did not succeed; password was not changed'},ok:false,partialFailure:true};
 let credential; try{credential=setPassword(user,password,{resetUsage:false});}catch(e){credential={passwordChanged:false,error:e.message};return {screen,credential,ok:false,partialFailure:true};}
 try{ensureState();fs.writeFileSync(path.join(STATE_DIR,`${user}.parent-locked`),new Date().toISOString(),{mode:0o600});credential.parentLockRecorded=true;}catch(e){credential.parentLockRecorded=false;credential.stateError=e.message;}
 return {screen,credential,ok:credential.parentLockRecorded,partialFailure:!credential.parentLockRecorded};
}
export function setAutologin(enabled,user){
 assertRoot(); assertManagedUser(user);
 if(enabled){for(const suffix of ['expired','parent-locked']){if(fs.existsSync(path.join(STATE_DIR,`${user}.${suffix}`)))throw new Error(`Autologin cannot be enabled while ${suffix} state is active; use the parent recovery operation first`);}}
 const dir='/etc/lightdm/lightdm.conf.d'; const file=path.join(dir,'99-homelan-autologin.conf'); fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(file,`[Seat:*]\nautologin-user=${enabled?user:''}\nautologin-user-timeout=0\n`,{mode:0o644});
 return {autologin:enabled,managedUser:user,restartRequired:true};
}
export function setLocker(user,minutes){
 assertRoot();assertManagedUser(user); if(!Number.isInteger(minutes)||minutes<0||minutes>1440)throw new Error('minutes must be 0..1440');
 const file=path.join('/etc/homelan', 'locker.json');fs.mkdirSync('/etc/homelan',{recursive:true});
 const cfg=JSON.parse(fs.existsSync(file)?fs.readFileSync(file,'utf8'):'{}');cfg[user]=minutes;fs.writeFileSync(file,JSON.stringify(cfg,null,2)+'\n',{mode:0o640});
 return {user,idleMinutes:minutes,configured:true,enabled:false,notImplemented:true,limitation:'XFCE/light-locker idle adapter is not implemented in this build'};
}
export function setArm(user,minutes){
 assertRoot();assertManagedUser(user);if(!Number.isInteger(minutes)||minutes<0||minutes>1440)throw new Error('minutes must be 0..1440');
 ensureState();const file=path.join(STATE_DIR,'arm.json');const cfg=JSON.parse(fs.existsSync(file)?fs.readFileSync(file,'utf8'):'{}');cfg[user]=minutes;fs.writeFileSync(file,JSON.stringify(cfg,null,2)+'\n',{mode:0o600});installUnits();const active=Object.values(cfg).some(v=>Number.isInteger(v)&&v>0);if(active)run('systemctl',['enable','--now','homelan-arm.timer']);else{const r=spawnSync('systemctl',['disable','--now','homelan-arm.timer'],{encoding:'utf8'});if(r.error)throw r.error;}return {user,activeMinutes:minutes,enabled:active};
}
export function poweroff(){assertRoot();run('systemctl',['poweroff']);return {requested:true};}
export function installUnits(){
 assertRoot();ensureState();fs.mkdirSync(SYSTEMD,{recursive:true});
 if(!fs.existsSync('/etc/homelan/client.json')){const c=readConfig();writeConfig(c);}
 const units={
 'homelan-arm.service':'[Unit]\nDescription=HomeLAN active-time policy\n[Service]\nType=oneshot\nExecStart=/usr/bin/env homelan-client internal arm-tick\n',
 'homelan-arm.timer':'[Unit]\nDescription=Run HomeLAN active-time policy\n[Timer]\nOnBootSec=1min\nOnUnitActiveSec=1min\n[Install]\nWantedBy=timers.target\n'};
 for(const [name,body] of Object.entries(units))fs.writeFileSync(path.join(SYSTEMD,name),body,{mode:0o644});
 run('systemctl',['daemon-reload']);return {installed:Object.keys(units)};
}
export function internalTick(kind){
 assertRoot();
 if(kind==='arm-tick') return armTick();
 if(kind==='locker-tick') return lockerTick();
 throw new Error(`Unknown internal tick: ${kind}`);
}
function showSession(id){
 const raw=run('loginctl',['show-session',id,'-p','Name','-p','Active','-p','State','-p','IdleHint','-p','LockedHint','-p','Type','-p','Seat']);
 return Object.fromEntries(raw.split('\n').map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
}
function requestSessionLock(id){
 run('loginctl',['lock-session',id]);run('sleep',['1']);const state=showSession(id);if(state.LockedHint!=='yes')throw new Error(`logind did not confirm session ${id} is locked`);return true;
}
function eligibleSessions(){
 return userSessions().flatMap(s=>{try{const p=showSession(s.id);if(!p.Name||!p.Seat||p.Seat==='-'||!['x11','wayland'].includes(p.Type)||!['yes','no'].includes(p.IdleHint)||!['yes','no'].includes(p.LockedHint))return [];return [{id:s.id,user:p.Name,active:p.Active==='yes',state:p.State,idle:p.IdleHint==='yes',locked:p.LockedHint==='yes'}];}catch{return [];}});
}
function armTick(){
 ensureState();const config=JSON.parse(fs.existsSync(path.join(STATE_DIR,'arm.json'))?fs.readFileSync(path.join(STATE_DIR,'arm.json'),'utf8'):'{}');
 const sessions=eligibleSessions();const results=[];
 for(const [user,minutes] of Object.entries(config)){
  if(!Number.isInteger(minutes)||minutes<=0)continue;
  const session=sessions.find(s=>s.user===user&&s.active&&s.state==='active');
  const useFile=path.join(STATE_DIR,`${user}.use`),expiredFile=path.join(STATE_DIR,`${user}.expired`),parentFile=path.join(STATE_DIR,`${user}.parent-locked`);
  if(fs.existsSync(expiredFile)){results.push({user,expired:true,action:'none'});continue;}
  if(fs.existsSync(parentFile)){results.push({user,parentLocked:true,action:'none'});continue;}
  if(!session)continue;
  let used=0;try{used=Number(fs.readFileSync(useFile,'utf8'))||0;}catch{}
  if(session.locked){
   if(used>=minutes*60){try{resetExpiredPassword(user,expiredFile);results.push({user,expired:true,locked:true,passwordReset:true,retriedAfterLock:true});}catch(e){results.push({user,expired:false,error:e.message});}}
   continue;
  }
  if(session.idle)continue;
  used+=60;fs.writeFileSync(useFile,String(used),{mode:0o600});
  if(used>=minutes*60){
   try{requestSessionLock(session.id);resetExpiredPassword(user,expiredFile);results.push({user,expired:true,locked:true,passwordReset:true});}
   catch(e){results.push({user,expired:false,error:e.message});}
  }else results.push({user,usedSeconds:used,limitSeconds:minutes*60});
 }
 return {kind:'arm',results};
}
function resetExpiredPassword(user,expiredFile){
 const generated=crypto.randomBytes(24).toString('base64url');
 run('chpasswd',[],{input:`${user}:${generated}\n`});
 fs.writeFileSync(expiredFile,new Date().toISOString(),{mode:0o600});
}

function lockerTick(){
 // We intentionally do not approximate XFCE idle state from logind's boolean IdleHint:
 // it has no configurable per-user threshold. Existing light-locker remains authoritative.
 const cfg=JSON.parse(fs.existsSync('/etc/homelan/locker.json')?fs.readFileSync('/etc/homelan/locker.json','utf8'):'{}');
 return {kind:'locker',configured:Object.entries(cfg).map(([user,idleMinutes])=>({user,idleMinutes})),executed:false,reason:'XFCE/light-locker idle integration is not yet ported; existing desktop idle-lock settings are left untouched'};
}
