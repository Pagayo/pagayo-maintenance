#!/usr/bin/env bash
# =============================================================================
# VaultGuard — lokale setup (optie A)
# =============================================================================
# Installeert op JOUW Mac:
#   - multi-root workspace (pagayo.code-workspace) mét pagayo-vault
#   - dagelijks script in pagayo-vault/scripts/ (lokaal, nooit naar git)
#   - launchd job om 07:00 (macOS)
#   - LOCAL-ONLY guards (vault mag NOOIT online, ook niet private GitHub)
#
# Gebruik (eenmalig op Mac):
#   cd my-vscode-workspace/pagayo-maintenance
#   ./scripts/setup-vaultguard-local.sh
#
# Optioneel:
#   PAGAYO_WORKSPACE=/pad/naar/workspace ./scripts/setup-vaultguard-local.sh
#   VAULTGUARD_HOUR=7 VAULTGUARD_MINUTE=0 ./scripts/setup-vaultguard-local.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/vaultguard-assert-local-only.sh
source "$SCRIPT_DIR/vaultguard-assert-local-only.sh"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "❌ Deze setup is voor macOS (launchd). Op Linux/VM alleen handmatige Cursor-agent gebruiken." >&2
  exit 1
fi

resolve_workspace() {
  if [[ -n "${PAGAYO_WORKSPACE:-}" && -d "$PAGAYO_WORKSPACE/pagayo-vault" ]]; then
    echo "$PAGAYO_WORKSPACE"
    return 0
  fi
  # pagayo-maintenance/scripts -> workspace root
  local candidate
  candidate="$(cd "$SCRIPT_DIR/../.." && pwd)"
  if [[ -d "$candidate/pagayo-vault" ]]; then
    echo "$candidate"
    return 0
  fi
  echo "❌ Workspace niet gevonden. Zet PAGAYO_WORKSPACE of plaats pagayo-vault naast pagayo-maintenance." >&2
  exit 1
}

WORKSPACE="$(resolve_workspace)"
VAULT="$WORKSPACE/pagayo-vault"
LAUNCH_LABEL="com.pagayo.vaultguard"
LAUNCH_PLIST="$HOME/Library/LaunchAgents/${LAUNCH_LABEL}.plist"
HOUR="${VAULTGUARD_HOUR:-7}"
MINUTE="${VAULTGUARD_MINUTE:-0}"

REPOS=(
  pagayo-vault
  pagayo-storefront
  pagayo-api-stack
  pagayo-schema
  pagayo-config
  pagayo-design
  pagayo-workflows
  pagayo-edge
  pagayo-infra
  pagayo-maintenance
  pagayo-marketing
  pagayo-cloudflare-proxy
)

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║           VaultGuard — lokale setup (pagayo-vault blijft lokaal)       ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📁 Workspace: $WORKSPACE"
echo "🔒 Vault:     $VAULT"
echo ""

vaultguard_assert_local_only "$VAULT"

AGENT_MD="$VAULT/.github/agents/VaultGuard.agent.md"
if [[ ! -f "$AGENT_MD" ]]; then
  echo "❌ Ontbrekend: $AGENT_MD" >&2
  echo "   Zorg dat pagayo-vault compleet is op deze machine." >&2
  exit 1
fi

mkdir -p "$VAULT/scripts" "$VAULT/vaultguard" "$VAULT/Vault Guard" "$VAULT/.local"

# --- LOCAL-ONLY policy (alleen op schijf, nooit in GitHub-repos) ---
cat > "$VAULT/LOCAL-ONLY.policy" <<'EOF'
# pagayo-vault — LOCAL ONLY (bindend)

Deze map mag **nooit** online komen:
- Geen GitHub (ook niet private)
- Geen GitLab / Bitbucket / cloud-sync van vault-inhoud
- Geen Cursor Cloud Automation met vault als repo

Toegestaan:
- Lokale Cursor-agent met multi-root workspace
- launchd + Cursor CLI op deze Mac
- Scripts gegenereerd door pagayo-maintenance/scripts/setup-vaultguard-local.sh

Bij twijfel: draai scripts/vaultguard-assert-local-only.sh
EOF

cp "$SCRIPT_DIR/vaultguard-assert-local-only.sh" "$VAULT/scripts/vaultguard-assert-local-only.sh"
chmod +x "$VAULT/scripts/vaultguard-assert-local-only.sh"

# --- Dagelijks delta-script (lokaal in vault) ---
cat > "$VAULT/scripts/vaultguard-daily-delta.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="$WORKSPACE"
VAULT="\$WORKSPACE/pagayo-vault"
LOG_DIR="\$VAULT/vaultguard"
STAMP="\$(date +%Y-%m-%d)"
LOG="\$LOG_DIR/\${STAMP}-launchd.log"

mkdir -p "\$LOG_DIR"
exec >>"\$LOG" 2>&1

echo "=== VaultGuard launchd run \$(date -Iseconds) ==="

"\$VAULT/scripts/vaultguard-assert-local-only.sh" "\$VAULT"

# API key: alleen lokaal in vault/.local/ (nooit committen)
ENV_FILE="\$VAULT/.local/cursor-api-key.env"
if [[ -f "\$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a && source "\$ENV_FILE" && set +a
fi
if [[ -z "\${CURSOR_API_KEY:-}" ]]; then
  echo "❌ CURSOR_API_KEY ontbreekt. Maak \$ENV_FILE (zie .example)." >&2
  exit 1
fi

AGENT_BIN=""
for candidate in agent "\$HOME/.cursor/bin/agent" "\$HOME/.local/bin/agent"; do
  if command -v "\$candidate" >/dev/null 2>&1; then
    AGENT_BIN="\$(command -v "\$candidate")"
    break
  fi
  if [[ -x "\$candidate" ]]; then
    AGENT_BIN="\$candidate"
    break
  fi
done
if [[ -z "\$AGENT_BIN" ]]; then
  echo "❌ Cursor CLI 'agent' niet gevonden. Installeer: curl https://cursor.com/install -fsS | bash" >&2
  exit 1
fi

PROMPT_FILE="\$VAULT/.github/agents/VaultGuard.agent.md"
DELTA_PROMPT="\$VAULT/.github/agents/VaultGuard-daily-delta.prompt.md"

cat > "\$DELTA_PROMPT" <<'PROMPT_EOF'
Je bent VaultGuard in dagelijkse delta-modus op de LOKALE Mac-workspace.

## Harde grenzen
- pagayo-vault blijft LOCAL ONLY — nooit naar GitHub/cloud
- NOOIT applicatiecode wijzigen in pagayo-* repos
- NOOIT git commit/push/stash
- NOOIT secrets tonen of loggen
- Alleen wijzigen: pagayo-vault/PAGAYO-NIVEAU.md, vaultguard-rapporten, Vault Guard registers

## Leesvolgorde
1. pagayo-vault/STACK-MANIFEST.md
2. pagayo-vault/Vault Guard/README.md
3. pagayo-vault/Vault Guard/EXECUTION-PROTOCOL.md
4. pagayo-vault/Vault Guard/AUDIT-REGISTER.md
5. pagayo-vault/Vault Guard/DELTA-REVIEW-REGISTER.md
6. pagayo-vault/Vault Guard/FINDINGS-BACKLOG.md
7. pagayo-vault/.github/agents/VaultGuard.agent.md
8. pagayo-vault/PAGAYO-NIVEAU.md (TL;DR + secties 2–4 + Bijlage B + Changelog)

## Scope vandaag
A. SSoT-versies (package.json + lockfiles in repos)
B. Schema-inventaris Bijlage B
C. Infra alleen bij overdue/open delta
D. Registers + cadans

Schrijf rapport: pagayo-vault/vaultguard/YYYY-MM-DD-daily-delta.md
PROMPT_EOF

FULL_PROMPT="$(cat "\$PROMPT_FILE")

\$(cat "\$DELTA_PROMPT")"

cd "\$WORKSPACE"
"\$AGENT_BIN" -p --force "\$FULL_PROMPT"

echo "=== klaar \$(date -Iseconds) ==="
EOF
chmod +x "$VAULT/scripts/vaultguard-daily-delta.sh"

# --- API key placeholder ---
if [[ ! -f "$VAULT/.local/cursor-api-key.env" ]]; then
  cat > "$VAULT/.local/cursor-api-key.env.example" <<'EOF'
# Kopieer naar cursor-api-key.env (alleen lokaal, nooit delen)
# Cursor → Settings → API Keys
CURSOR_API_KEY=
EOF
  echo "ℹ️  Maak $VAULT/.local/cursor-api-key.env aan (zie .example)."
else
  echo "✅ $VAULT/.local/cursor-api-key.env bestaat al."
fi

# --- Multi-root workspace ---
WORKSPACE_FILE="$WORKSPACE/pagayo.code-workspace"
{
  echo '{'
  echo '  "folders": ['
  local first=true
  for repo in "${REPOS[@]}"; do
    if [[ ! -d "$WORKSPACE/$repo" ]]; then
      continue
    fi
    if [[ "$first" == true ]]; then
      first=false
    else
      echo ','
    fi
    printf '    { "path": "%s", "name": "%s" }' "$repo" "$repo"
  done
  echo ''
  echo '  ],'
  echo '  "settings": {'
  echo '    "files.exclude": {'
  echo '      "**/node_modules": true,'
  echo '      "**/.wrangler": true'
  echo '    }'
  echo '  }'
  echo '}'
} > "$WORKSPACE_FILE"
echo "✅ Workspace: $WORKSPACE_FILE"

# --- Dubbelklik-launcher (macOS) ---
cat > "$VAULT/VaultGuard Local.command" <<EOF
#!/usr/bin/env bash
cd "$WORKSPACE"
open -a "Cursor" "$WORKSPACE_FILE" 2>/dev/null || open "$WORKSPACE_FILE"
echo ""
echo "Open Cursor Agent-chat en typ:"
echo "  @pagayo-vault/.github/agents/VaultGuard.agent.md — dagelijkse delta-modus"
echo ""
read -r -p "Druk Enter om te sluiten…"
EOF
chmod +x "$VAULT/VaultGuard Local.command"

# --- launchd ---
cat > "$LAUNCH_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCH_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${VAULT}/scripts/vaultguard-daily-delta.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${HOUR}</integer>
    <key>Minute</key>
    <integer>${MINUTE}</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/vaultguard.launchd.out</string>
  <key>StandardErrorPath</key>
  <string>/tmp/vaultguard.launchd.err</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PAGAYO_WORKSPACE</key>
    <string>${WORKSPACE}</string>
  </dict>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/${LAUNCH_LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$LAUNCH_PLIST"
echo "✅ launchd geladen: ${LAUNCH_LABEL} (${HOUR}:$(printf '%02d' "$MINUTE") daily)"

# --- Lokale runbook in vault (niet in GitHub) ---
cat > "$VAULT/Vault Guard/LOCAL-AUTOMATION.md" <<EOF
# VaultGuard — lokale automation (optie A)

**Beleid:** pagayo-vault blijft **LOCAL ONLY** — zie \`LOCAL-ONLY.policy\`.

## Handmatig (aanbevolen voor eerste test)

1. Open \`pagayo.code-workspace\` in Cursor (of dubbelklik \`VaultGuard Local.command\`).
2. Agent-chat: \`@pagayo-vault/.github/agents/VaultGuard.agent.md — dagelijkse delta-modus\`

## Gepland (launchd 07:00)

- Script: \`pagayo-vault/scripts/vaultguard-daily-delta.sh\`
- Logs: \`pagayo-vault/vaultguard/YYYY-MM-DD-launchd.log\`
- API key: \`pagayo-vault/.local/cursor-api-key.env\` (alleen lokaal)

Test:
\`\`\`bash
${VAULT}/scripts/vaultguard-daily-delta.sh
\`\`\`

## Cloud-automation UIT

Pauzeer de VaultGuard-cron op https://cursor.com/automations — die VM heeft geen pagayo-vault.

## Herinstalleren

\`\`\`bash
cd ${WORKSPACE}/pagayo-maintenance && ./scripts/setup-vaultguard-local.sh
\`\`\`

Geïnstalleerd: $(date -Iseconds)
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Lokale VaultGuard-setup klaar."
echo ""
echo "Volgende stappen:"
echo "  1. cp $VAULT/.local/cursor-api-key.env.example $VAULT/.local/cursor-api-key.env"
echo "     → vul CURSOR_API_KEY in (Cursor Settings → API Keys)"
echo "  2. Test: $VAULT/scripts/vaultguard-daily-delta.sh"
echo "  3. Open workspace: open -a Cursor '$WORKSPACE_FILE'"
echo "  4. Pauzeer Cloud Automation VaultGuard op cursor.com/automations"
echo ""
echo "🔒 pagayo-vault blijft lokaal — geen GitHub, geen remote, geen cloud-sync."
