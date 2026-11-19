import fs from 'node:fs';
import path from 'node:path';
export const CONFIG_DIR='/etc/homelan';
export const STATE_DIR='/var/lib/homelan';
export const CONFIG_FILE=path.join(CONFIG_DIR,'client.json');
export function readConfig(){
 try { return JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8')); }
 catch(e){ if(e.code==='ENOENT') return {schema:1,deviceId:null,platform:'linux',managedUsers:[],adminFingerprint:null}; throw e; }
}
export function writeConfig(config){ fs.mkdirSync(CONFIG_DIR,{recursive:true,mode:0o750}); const tmp=CONFIG_FILE+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(config,null,2)+'\n',{mode:0o640}); fs.renameSync(tmp,CONFIG_FILE); }
export function ensureState(){ fs.mkdirSync(STATE_DIR,{recursive:true,mode:0o700}); }
