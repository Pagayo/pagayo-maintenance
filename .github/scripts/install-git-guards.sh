#!/usr/bin/env bash
# Pagayo — optionele git pre-push guards (opt-in per repo)
# Gebruik: install-git-guards.sh /path/to/repo

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="${1:-}"

if [[ -z "$REPO_PATH" || ! -d "$REPO_PATH/.git" ]]; then
  echo "Gebruik: install-git-guards.sh /path/to/repo"
  exit 1
fi

HOOKS_DIR="$REPO_PATH/.git/hooks"
GUARD_SCRIPT="$SCRIPT_DIR/git-guard.sh"
PRE_PUSH="$HOOKS_DIR/pre-push"

mkdir -p "$HOOKS_DIR"

cat >"$PRE_PUSH" <<EOF
#!/usr/bin/env bash
# Pagayo Release Workflow v2 — pre-push guard (gegenereerd)
set -euo pipefail
"$GUARD_SCRIPT" can-push "\$(git rev-parse --show-toplevel)"
EOF

chmod +x "$PRE_PUSH"
echo "✅ pre-push guard geïnstalleerd in $REPO_PATH"
echo "   Blokkeert push main en local/staging zonder PAGAYO_ALLOW_* flags."
