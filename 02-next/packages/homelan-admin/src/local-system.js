import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

function commandExists(name) {
  const dirs=(process.env.PATH||'').split(path.delimiter);
  return dirs.some(dir=>{try{return fs.statSync(path.join(dir,name+(process.platform==='win32'?'.exe':''))).isFile();}catch{return false;}});
}
function readOsRelease(){
  try{return Object.fromEntries(fs.readFileSync('/etc/os-release','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).replace(/^"|"$/g,'')];}));}catch{return {};}
}
function commandOutput(bin,args=[]){const r=spawnSync(bin,args,{encoding:'utf8',timeout:1500,stdio:['ignore','pipe','ignore']});return r.status===0?(r.stdout||'').trim():'';}
function detectLinux(){
 const release=readOsRelease();
 const desktop=(process.env.XDG_CURRENT_DESKTOP||process.env.DESKTOP_SESSION||'').toLowerCase();
 const inferredDesktop=desktop || (commandExists('xfce4-session')?'xfce':commandExists('gnome-session')?'gnome':commandExists('startplasma-x11')||commandExists('plasmashell')?'kde':'');
 let detectedSession=(process.env.XDG_SESSION_TYPE||'').toLowerCase();
 if(!detectedSession&&commandExists('loginctl')){const ids=commandOutput('loginctl',['list-sessions','--no-legend']).split(/\r?\n/).filter(Boolean).map(x=>x.trim().split(/\s+/)[0]);for(const id of ids){const props=commandOutput('loginctl',['show-session',id,'-p','Active','-p','Type','-p','Seat']);const map=Object.fromEntries(props.split(/\r?\n/).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));if(map.Active==='yes'&&map.Seat&&map.Seat!=='-'&&['x11','wayland'].includes(map.Type)){detectedSession=map.Type;break;}}}
 const session=(detectedSession||'unknown').toLowerCase();
 const distro=release.ID||'unknown';
 const packageManager=['apt-get','dnf','zypper','pacman'].find(commandExists)||null;
 const npmAvailable=commandExists('npm');
 const desktopEnv=inferredDesktop.includes('xfce')?'xfce':inferredDesktop.includes('gnome')?'gnome':inferredDesktop.includes('kde')||inferredDesktop.includes('plasma')?'kde':inferredDesktop||'unknown';
 return {os:'linux',kernel:os.release(),arch:os.arch(),hostname:os.hostname(),distro,distroVersion:release.VERSION_ID||null,distroName:release.PRETTY_NAME||null,desktop:desktopEnv,desktopRaw:desktop||null,sessionType:session,init:commandExists('systemctl')&&fs.existsSync('/run/systemd/system')?'systemd':'unknown',lightdmInstalled:fs.existsSync('/etc/lightdm'),packageManager,nodeVersion:process.version,npmAvailable,privileges:typeof process.getuid==='function'&&process.getuid()===0?'root':'user',commands:Object.fromEntries(['systemctl','loginctl','light-locker-command','xfconf-query','xprintidle','xfce4-session','gnome-session','startplasma-x11','chpasswd','npm'].map(x=>[x,commandExists(x)]))};
}
function detectWindows(){const npmAvailable=commandExists('npm')||fs.existsSync(path.join(path.dirname(process.execPath),'npm.cmd'));return {os:'windows',kernel:os.release(),arch:os.arch(),hostname:os.hostname(),edition:process.env.OS||'Windows',desktop:'windows-shell',sessionType:'windows-session',init:'windows-service-control',packageManager:['winget','choco','scoop'].find(commandExists)||null,nodeVersion:process.version,npmAvailable,privileges:process.env.USERNAME||null,commands:Object.fromEntries(['ssh','powershell','winget','sc'].map(x=>[x,commandExists(x)]))};}
export function inspectSystem(){
 const facts=process.platform==='win32'?detectWindows():process.platform==='linux'?detectLinux():{os:process.platform,kernel:os.release(),arch:os.arch(),hostname:os.hostname(),nodeVersion:process.version};
 const adapter=facts.os==='linux'?'linux-systemd':facts.os==='windows'?'windows-pending':'unsupported';
 const supported=adapter==='linux-systemd'&&facts.init==='systemd';
 const nodeMajor=Number(String(facts.nodeVersion||'').replace(/^v/,'').split('.')[0])||0;
 const runtimeReady=nodeMajor>=20&&facts.npmAvailable===true;
 const baseReady=supported&&runtimeReady&&facts.commands?.systemctl&&facts.commands?.loginctl&&facts.commands?.chpasswd;
 const ready=Boolean(baseReady);
 const capabilities={discovery:true,rpc:ready,sessionLock:supported&&Boolean(facts.commands?.loginctl),accountManagement:supported&&Boolean(facts.commands?.chpasswd),lightdmAutologin:supported&&Boolean(facts.lightdmInstalled),arm:ready&&Boolean(facts.commands?.systemctl),locker:false,timer:false,poweroff:ready&&Boolean(facts.commands?.systemctl)};
 return {schema:1,detectedAt:new Date().toISOString(),facts,adapter,supported,ready,runtimeReady,capabilities};
}
export function buildInstallPlan(report){
 const {facts,adapter}=report;
 const steps=[];
 if(adapter==='linux-systemd'){
  steps.push({id:'runtime',action:report.runtimeReady?'verify':'install',target:'Node.js >=20 + npm',required:true,reason:report.runtimeReady?'Runtime available':'Install Node.js 20+ and npm before activation'});
  steps.push({id:'client-package',action:'install',target:'@homelan/client@2.1.0',required:true});
  steps.push({id:'systemd',action:'verify',target:'systemd + loginctl',required:true});
  steps.push({id:'account-tools',action:'verify',target:'chpasswd',required:true});
  steps.push({id:'state',action:'create',target:'/var/lib/homelan',mode:'0700',required:true});
  steps.push({id:'config',action:'create',target:'/etc/homelan/client.json',mode:'0640',required:true});
  steps.push({id:'units',action:'install',target:'homelan-arm.service + homelan-arm.timer',required:false,when:'ARM is configured'});
  if(facts.lightdmInstalled)steps.push({id:'lightdm',action:'available',target:'LightDM autologin adapter',required:false});
  if(facts.desktop==='xfce')steps.push({id:'xfce-locker',action:'defer',target:'XFCE idle adapter',required:false,reason:'No safe per-user D-Bus/XFConf session adapter is installed yet'});
 } else if(adapter==='windows-pending') {
  steps.push({id:'runtime',action:report.runtimeReady?'verify':'install',target:'Node.js >=20 + npm',required:true,reason:report.runtimeReady?'Runtime available':'Install Node.js 20+ and npm before activation'});
  steps.push({id:'windows-service',action:'defer',target:'Windows service + session broker',required:false,reason:'Windows client adapter is not implemented; no Linux commands will be attempted'});
 } else steps.push({id:'platform',action:'reject',target:facts.os,required:true,reason:'No client adapter for this platform'});
 return {schema:1,adapter,platform:facts.os,desktop:facts.desktop||null,supported:report.supported,ready:report.ready,runtimeReady:report.runtimeReady,facts,steps,requiredCapabilities:Object.entries(report.capabilities).filter(([,v])=>v).map(([k])=>k)};
}
