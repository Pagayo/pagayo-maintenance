#!/usr/bin/env bash
# Pagayo — git guard CLI (pre-push / agent checks)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=branch-guard-lib.sh
source "$SCRIPT_DIR/branch-guard-lib.sh"

usage() {
  cat <<'EOF'
Gebruik: git-guard.sh <command> [repo-path]

Commands:
  can-commit     Blokkeer commit op main zonder PAGAYO_ALLOW_MAIN
  can-push       Blokkeer push main / local/staging zonder expliciete flags
  can-switch     Blokkeer checkout/merge bij dirty tree
  check-all      can-switch + can-commit op huidige repo
EOF
}

REPO_PATH="${2:-.}"
if [[ -d "$REPO_PATH/.git" ]]; then
  cd "$REPO_PATH"
elif [[ -d "$REPO_PATH" ]]; then
  cd "$REPO_PATH"
fi

CMD="${1:-}"
shift || true

case "$CMD" in
  can-commit)
    guard_commit_branch
    ;;
  can-push)
    guard_push_branch
    ;;
  can-switch)
    guard_clean_tree "checkout/merge/rebase"
    ;;
  check-all)
    guard_clean_tree "git-operatie"
    guard_commit_branch
    guard_lane_branch
    ;;
  -h|--help|help|"")
    usage
    exit 0
    ;;
  *)
    echo "Onbekend commando: $CMD" >&2
    usage
    exit 1
    ;;
esac
