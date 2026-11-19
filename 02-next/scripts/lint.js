import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const roots=['packages','tests','scripts'];
const files=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())walk(p);else if(item.isFile()&&p.endsWith('.js'))files.push(p);}}
for(const dir of roots)if(fs.existsSync(dir))walk(dir);
let failed=0;
for(const file of files){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0){failed++;process.stderr.write(`${file}\n${r.stderr||r.stdout}`);}}
if(failed){process.stderr.write(`Syntax check failed for ${failed} file(s).\n`);process.exitCode=1;}else process.stdout.write(`Syntax OK: ${files.length} JavaScript files.\n`);
