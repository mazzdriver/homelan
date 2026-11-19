$ErrorActionPreference = 'Stop'
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
