import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'..','release','offline');
const packages=path.join(out,'packages');
const npmRelease=path.join(root,'..','release','npm');
fs.mkdirSync(npmRelease,{recursive:true});
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(packages,{recursive:true});
for(const name of ['homelan-protocol','homelan-client','homelan-admin']){
 const dir=path.join(root,'packages',name);
 const r=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['pack',dir,'--pack-destination',packages],{cwd:root,encoding:'utf8',shell:process.platform==='win32'});
 if(r.status!==0)throw new Error(`npm pack ${name} failed: ${r.stderr||r.stdout}`);
 const archive=path.join(packages,`${name}-2.1.0.tgz`);fs.copyFileSync(archive,path.join(npmRelease,`${name}-2.1.0.tgz`));
}
const ps=`$ErrorActionPreference = 'Stop'
$packages = Join-Path $PSScriptRoot 'packages'
$osInfo = Get-CimInstance Win32_OperatingSystem
$arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Node.js 20+ is required. Install it first; no changes were made.' }
$nodeVersion = (& node.exe -p 'process.versions.node').Trim()
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 20) { throw "Node.js 20+ is required; found $nodeVersion. No changes were made." }
$npmCommand = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCommand) { throw 'npm is required. Install/repair Node.js npm first; no changes were made.' }
Write-Host ("Detected: {0}; {1}; Node.js {2}" -f $osInfo.Caption, $arch, $nodeVersion)
foreach ($name in @('homelan-protocol','homelan-client','homelan-admin')) {
  $archive = Get-ChildItem -LiteralPath $packages -Filter ($name + '-2.1.0.tgz') | Select-Object -First 1
  if (-not $archive) { throw "Missing package archive: $name" }
  npm install --global $archive.FullName
}
Write-Host 'HomeLAN 2.1.0 installed from the offline bundle.'
Write-Host 'Run: homelan system inspect; homelan --help'
`;
const sh=`#!/usr/bin/env sh
set -eu
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OS=$(uname -s 2>/dev/null || echo unknown)
ARCH=$(uname -m 2>/dev/null || echo unknown)
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Node.js 20+ is required. Install it first; no changes were made.' >&2
  exit 2
fi
NODE_VERSION=$(node -p 'process.versions.node' 2>/dev/null || echo unknown)
NODE_MAJOR=\${NODE_VERSION%%.*}
case "$NODE_MAJOR" in ''|*[!0-9]*) NODE_MAJOR=0 ;; esac
if [ "$NODE_MAJOR" -lt 20 ]; then
  printf 'Node.js 20+ is required; found %s. No changes were made.\n' "$NODE_VERSION" >&2
  exit 2
fi
if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' 'npm is required. Repair the Node.js installation first; no changes were made.' >&2
  exit 2
fi
printf 'Detected: %s / %s / Node.js %s\n' "$OS" "$ARCH" "$NODE_VERSION"
for name in homelan-protocol homelan-client homelan-admin; do
  npm install --global "$DIR/packages/$name-2.1.0.tgz"
done
printf '%s\n' 'HomeLAN 2.1.0 installed from the offline bundle.' 'Run: homelan system inspect; homelan --help'
`;
fs.writeFileSync(path.join(out,'install-offline.ps1'),ps);
fs.writeFileSync(path.join(out,'install-offline.sh'),sh,{mode:0o755});
const readme=[
 '# HomeLAN 2.1.0 — offline distribution','',
 'This bundle contains the three npm package tarballs and installers. It does not contact the npm registry.','',
 'The installer first inspects the administrator OS, architecture, Node.js and npm. It makes no changes if Node.js 20+ or npm is missing. Runtime installation is intentionally a separate prerequisite.','',
 '- Windows: run PowerShell and execute ./install-offline.ps1.',
 '- Linux/macOS/Termux: execute ./install-offline.sh.','',
 'The target Client package is installed separately by Admin over SSH. Keep packages/homelan-client-2.1.0.tgz available for offline target deployment.',''
].join('\n');
fs.writeFileSync(path.join(out,'README.md'),readme);
const sums=fs.readdirSync(packages).sort().map(name=>`${crypto.createHash('sha256').update(fs.readFileSync(path.join(packages,name))).digest('hex')}  packages/${name}`).join('\n')+'\n';
fs.writeFileSync(path.join(out,'SHA256SUMS'),sums);
const npmSums=fs.readdirSync(npmRelease).filter(x=>x.endsWith('-2.1.0.tgz')).sort().map(name=>`${crypto.createHash('sha256').update(fs.readFileSync(path.join(npmRelease,name))).digest('hex')}  ${name}`).join('\n')+'\n';
fs.writeFileSync(path.join(npmRelease,'SHA256SUMS-2.1.0'),npmSums);
console.log(`Offline packages created in ${out}`);
