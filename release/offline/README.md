# HomeLAN 2.1.0 — offline distribution

This bundle contains the three npm package tarballs and installers. It does not contact the npm registry.

The installer first inspects the administrator OS, architecture, Node.js and npm. It makes no changes if Node.js 20+ or npm is missing. Runtime installation is intentionally a separate prerequisite.

- Windows: run PowerShell and execute ./install-offline.ps1.
- Linux/macOS/Termux: execute ./install-offline.sh.

The target Client package is installed separately by Admin over SSH. Keep packages/homelan-client-2.1.0.tgz available for offline target deployment.
