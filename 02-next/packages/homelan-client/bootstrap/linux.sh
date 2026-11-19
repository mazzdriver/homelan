#!/bin/sh
# Read-only pre-Node bootstrap discovery. No package installation or system changes.
set -eu

json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r/\\r/g; s/\n/\\n/g'; }
has() { command -v "$1" >/dev/null 2>&1; }

os_id=unknown
os_version=unknown
pretty=unknown
if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  os_id=${ID:-unknown}
  os_version=${VERSION_ID:-unknown}
  pretty=${PRETTY_NAME:-unknown}
fi
arch=$(uname -m 2>/dev/null || echo unknown)
hostname=$(hostname 2>/dev/null || echo unknown)
desktop_raw=${XDG_CURRENT_DESKTOP:-${DESKTOP_SESSION:-}}
desktop=$(printf '%s' "$desktop_raw" | tr '[:upper:]' '[:lower:]')
case "$desktop" in
  *xfce*) desktop=xfce ;;
  *gnome*) desktop=gnome ;;
  *kde*|*plasma*) desktop=kde ;;
  '')
    if has xfce4-session; then desktop=xfce
    elif has gnome-session; then desktop=gnome
    elif has startplasma-x11 || has plasmashell; then desktop=kde
    else desktop=unknown; fi
    ;;
esac
session_type=${XDG_SESSION_TYPE:-unknown}
init=unknown
if has systemctl && [ -d /run/systemd/system ]; then init=systemd; fi
package_manager=unknown
for candidate in apt-get dnf zypper pacman; do
  if has "$candidate"; then package_manager=$candidate; break; fi
done
node_version=missing
node_major=0
if has node; then
  node_version=$(node -p 'process.versions.node' 2>/dev/null || echo unknown)
  case "$node_version" in
    [0-9]*.*) node_major=${node_version%%.*} ;;
    *) node_major=0 ;;
  esac
fi
npm_available=false
if has npm; then npm_available=true; fi
systemd_ok=false
if [ "$init" = systemd ]; then systemd_ok=true; fi
loginctl_ok=false; if has loginctl; then loginctl_ok=true; fi
chpasswd_ok=false; if has chpasswd; then chpasswd_ok=true; fi
lightdm_ok=false; if [ -d /etc/lightdm ]; then lightdm_ok=true; fi
supported=false
if [ "$systemd_ok" = true ] && [ "$loginctl_ok" = true ]; then supported=true; fi
ready=false
if [ "$supported" = true ] && [ "$node_major" -ge 20 ] && [ "$npm_available" = true ] && [ "$chpasswd_ok" = true ]; then ready=true; fi

node_json=$(json_escape "$node_version")
distro_json=$(json_escape "$os_id")
pretty_json=$(json_escape "$pretty")
version_json=$(json_escape "$os_version")
host_json=$(json_escape "$hostname")
desktop_json=$(json_escape "$desktop")
arch_json=$(json_escape "$arch")
manager_json=$(json_escape "$package_manager")
session_json=$(json_escape "$session_type")

runtime_action=verify
runtime_reason='Node.js 20+ and npm are available'
if [ "$node_major" -lt 20 ] || [ "$npm_available" != true ]; then runtime_action=install; runtime_reason='Install Node.js 20+ and npm before client activation; automatic runtime provisioning is not enabled in 2.1'; fi

runtime_ready=false
if [ "$runtime_action" = verify ]; then runtime_ready=true; fi
printf '{"schema":1,"source":"homelan-client-bootstrap","adapter":"linux-systemd","supported":%s,"ready":%s,"runtimeReady":%s,' "$supported" "$ready" "$runtime_ready"
printf '"facts":{"os":"linux","kernel":"%s","arch":"%s","hostname":"%s","distro":"%s","distroVersion":"%s","distroName":"%s","desktop":"%s","sessionType":"%s","init":"%s","lightdmInstalled":%s,"packageManager":"%s","nodeVersion":"%s","npmAvailable":%s},' \
  "$(json_escape "$(uname -r 2>/dev/null || echo unknown)")" "$arch_json" "$host_json" "$distro_json" "$version_json" "$pretty_json" "$desktop_json" "$session_json" "$init" "$lightdm_ok" "$manager_json" "$node_json" "$npm_available"
session_lock_cap=false; account_cap=false; lightdm_cap=false
if [ "$supported" = true ] && [ "$loginctl_ok" = true ]; then session_lock_cap=true; fi
if [ "$supported" = true ] && [ "$chpasswd_ok" = true ]; then account_cap=true; fi
if [ "$supported" = true ] && [ "$lightdm_ok" = true ]; then lightdm_cap=true; fi
printf '"capabilities":{"discovery":true,"rpc":%s,"sessionLock":%s,"accountManagement":%s,"lightdmAutologin":%s,"arm":%s,"locker":false,"timer":false,"poweroff":%s},' "$ready" "$session_lock_cap" "$account_cap" "$lightdm_cap" "$ready" "$ready"
printf '"steps":[{"id":"runtime","action":"%s","target":"Node.js >=20 + npm","required":true,"reason":"%s"},' "$runtime_action" "$runtime_reason"
printf '{"id":"client-package","action":"install","target":"@homelan/client@2.1.0","required":true},'
printf '{"id":"systemd","action":"verify","target":"systemd + loginctl","required":true},'
printf '{"id":"account-tools","action":"verify","target":"chpasswd","required":true},'
printf '{"id":"state","action":"create","target":"/var/lib/homelan","mode":"0700","required":true},'
printf '{"id":"config","action":"create","target":"/etc/homelan/client.json","mode":"0640","required":true},'
if [ "$lightdm_ok" = true ] && [ "$supported" = true ]; then printf '{"id":"lightdm","action":"available","target":"LightDM autologin adapter","required":false},'; fi
printf '{"id":"units","action":"install","target":"homelan-arm.service + homelan-arm.timer","required":false,"when":"ARM is configured"}'
if [ "$desktop" = xfce ]; then printf ',{"id":"xfce-locker","action":"defer","target":"XFCE idle adapter","required":false,"reason":"Not implemented in 2.1"}'; fi
required='"discovery"'
if [ "$ready" = true ]; then required='"discovery","rpc","sessionLock","accountManagement","arm","poweroff"'; fi
printf '],"requiredCapabilities":[%s]}' "$required"
printf '\n'
