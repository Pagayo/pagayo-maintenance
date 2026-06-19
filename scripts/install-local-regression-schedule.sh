#!/usr/bin/env bash
# Installeert LaunchAgent voor om-de-nacht lokale regressie (om de dag).
# Draait run-local-regression-suite.sh op de Mac van Sjoerd.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAINTENANCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="${PAGAYO_WORKSPACE:-/Users/sjoerdoverdiep/my-vscode-workspace}"
PLIST_LABEL="com.pagayo.local-regression"
PLIST_DEST="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
LOG_DIR="/tmp/pagayo-local-regression"

mkdir -p "$LOG_DIR"

cat >"$PLIST_DEST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${MAINTENANCE_ROOT}/scripts/run-local-regression-suite.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PAGAYO_WORKSPACE</key>
    <string>${WORKSPACE}</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>3</integer>
    <key>Minute</key>
    <integer>15</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/launchd-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/launchd-stderr.log</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"
launchctl enable "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || true

echo "✅ LaunchAgent geïnstalleerd: $PLIST_DEST"
echo "   Schema: dagelijks 03:15 (script skipt oneven dagen = om de nacht effectief om de dag)"
echo "   Handmatig nu draaien: ${MAINTENANCE_ROOT}/scripts/run-local-regression-suite.sh --force"
echo "   Logs: $LOG_DIR"
