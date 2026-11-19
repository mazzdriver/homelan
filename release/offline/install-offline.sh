#!/usr/bin/env sh
set -eu
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OS=$(uname -s 2>/dev/null || echo unknown)
ARCH=$(uname -m 2>/dev/null || echo unknown)
if ! command -v node >/dev/null 2>&1; then
  printf '%s
' 'Node.js 20+ is required. Install it first; no changes were made.' >&2
  exit 2
fi
NODE_VERSION=$(node -p 'process.versions.node' 2>/dev/null || echo unknown)
NODE_MAJOR=${NODE_VERSION%%.*}
case "$NODE_MAJOR" in ''|*[!0-9]*) NODE_MAJOR=0 ;; esac
if [ "$NODE_MAJOR" -lt 20 ]; then
  printf 'Node.js 20+ is required; found %s. No changes were made.
' "$NODE_VERSION" >&2
  exit 2
fi
if ! command -v npm >/dev/null 2>&1; then
  printf '%s
' 'npm is required. Repair the Node.js installation first; no changes were made.' >&2
  exit 2
fi
printf 'Detected: %s / %s / Node.js %s
' "$OS" "$ARCH" "$NODE_VERSION"
for name in homelan-protocol homelan-client homelan-admin; do
  npm install --global "$DIR/packages/$name-2.1.0.tgz"
done
printf '%s
' 'HomeLAN 2.1.0 installed from the offline bundle.' 'Run: homelan system inspect; homelan --help'
