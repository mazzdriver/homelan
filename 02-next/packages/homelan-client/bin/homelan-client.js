#!/usr/bin/env node
import fs from 'node:fs';
import readline from 'node:readline';
import {handleLine,enroll} from '../src/index.js';
import * as linux from '../src/linux.js';
import {inspectSystem,buildInstallPlan} from '../src/system.js';
const [cmd,...args]=process.argv.slice(2);
function out(v){process.stdout.write(JSON.stringify(v,null,2)+'\n');}
async function main(){
 if(cmd==='rpc'&&args.includes('--stdio')){const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});for await(const line of rl){if(!line.trim())continue;process.stdout.write(await handleLine(line)+'\n');}return;}
 if(cmd==='enroll'){const [deviceId,users='']=args;out(enroll({deviceId,managedUsers:users?users.split(','):[]}));return;}
 if(cmd==='inspect'){out(inspectSystem());return;}
 if(cmd==='plan'){out(buildInstallPlan(inspectSystem()));return;}
 if(cmd==='inspect'){out(inspectSystem());return;}
 if(cmd==='plan'){out(buildInstallPlan(inspectSystem()));return;}
 if(cmd==='install'){const report=inspectSystem();if(!report.supported)throw new Error(`Unsupported platform: ${report.facts.os}`);out(linux.installUnits());return;}
 if(cmd==='status'){out(linux.status());return;}
 if(cmd==='diagnose'){out(linux.diagnose());return;}
 if(cmd==='internal'){out(linux.internalTick(args[0]));return;}
 process.stdout.write('HomeLAN Client 2.1.0\nUsage: homelan-client <rpc --stdio|inspect|plan|enroll|install|status|diagnose>\n');
}
main().catch(e=>{process.stderr.write(`homelan-client: ${e.message}\n`);process.exitCode=1;});
