#!/usr/bin/env node
import {main} from '../src/commands.js';
main(process.argv.slice(2)).catch(e=>{process.stderr.write(`homelan: ${e.message}\n`);process.exitCode=1;});
