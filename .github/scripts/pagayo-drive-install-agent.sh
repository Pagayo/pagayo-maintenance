#!/usr/bin/env bash
# Install LaunchAgent for daily Pagayo Drive sync (once per night, Mac awake).
set -euo pipefail

SYNC_SCRIPT="/Users/sjoerdoverdiep/my-vscode-workspace/pagayo-maintenance/.github/scripts/pagayo-drive-sync.sh"
PLIST_DIR="${HOME}/Library/LaunchAgents"
PLIST="${PLIST_DIR}/com.pagayo.workspace-r2-sync.plist"
LABEL="com.pagayo.workspace-r2-sync"
# Local time — once per etmaal.
HOUR="${PAGAYO_DRIVE_SYNC_HOUR:-3}"
MINUTE="${PAGAYO_DRIVE_SYNC_MINUTE:-0}"

[[ -x "$SYNC_SCRIPT" ]] || chmod +x "$SYNC_SCRIPT"
mkdir -p "$PLIST_DIR" "${HOME}/Library/Logs/pagayo"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${SYNC_SCRIPT}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${HOUR}</integer>
    <key>Minute</key>
    <integer>${MINUTE}</integer>
  </dict>
  <key>RunAtLoad</key>
  <false/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${HOME}/Library/Logs/pagayo/pagayo-drive-sync.launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/Library/Logs/pagayo/pagayo-drive-sync.launchd.err.log</string>
  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/${LABEL}" 2>/dev/null || true

echo "✅ LaunchAgent installed: $PLIST"
echo "   Daily sync at ${HOUR}:$(printf '%02d' "$MINUTE") local (when Mac is awake)."
echo "   Disable: launchctl bootout gui/$(id -u)/${LABEL}"
