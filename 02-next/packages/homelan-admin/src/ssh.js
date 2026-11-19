import {spawn} from 'node:child_process';
import {request} from './protocol.js';
export class SshError extends Error{constructor(message,code='SSH_FAILED'){super(message);this.code=code;}}
export function sshArgs(device,cfg){
 const args=['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o',`ConnectTimeout=${cfg.ssh.connectTimeout??8}`,'-o',`ServerAliveInterval=${cfg.ssh.serverAliveInterval??15}`];
 if(device.port)args.push('-p',String(device.port));if(device.identityFile)args.push('-i',device.identityFile);
 args.push(`${device.sshUser}@${device.address}`,'sudo -n homelan-client rpc --stdio');return args;
}
export function invoke(device,cfg,operation,params={},options={}){
 const req=request(operation,params);const bin=cfg.ssh?.binary||'ssh';const args=sshArgs(device,cfg);
 return new Promise((resolve,reject)=>{
  const child=(options.spawnImpl||spawn)(bin,args,{stdio:['pipe','pipe','pipe'],windowsHide:true});let stdout='',stderr='',settled=false;
  const timer=setTimeout(()=>{child.kill();finish(new SshError('SSH operation timed out','TIMEOUT'));},options.timeout??30000);
  const finish=(err,val)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):resolve(val);};
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
  child.on('error',e=>finish(new SshError(e.message,'SSH_SPAWN')));
  child.on('close',code=>{if(code!==0)return finish(new SshError((stderr||`ssh exited ${code}`).trim(),code===255?'SSH_CONNECTION':'REMOTE_FAILED'));
   try{const response=JSON.parse(stdout.trim().split('\n').filter(Boolean).at(-1));if(response.id!==req.id)throw new Error('Response ID mismatch');finish(null,response);}catch(e){finish(new SshError(`Invalid client response: ${e.message}; stderr: ${stderr.trim()}`,'BAD_RESPONSE'));}
  });
  // JSON goes through stdin; secrets never enter command-line arguments.
  child.stdin.end(JSON.stringify(req)+'\n');
 });
}
