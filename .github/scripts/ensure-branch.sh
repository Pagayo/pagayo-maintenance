#!/usr/bin/env bash
# Pagayo — lane enforcement (one founder + AI).
# Default: converge onto pdc/current. Isolated extra lane only with PAGAYO_NEW_LANE=1.
#
# Gebruik: ensure-branch.sh /path/to/repo
#          PAGAYO_NEW_LANE=1 ensure-branch.sh /path/to/repo <suffix>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=branch-guard-lib.sh
source "$SCRIPT_DIR/branch-guard-lib.sh"

REPO_PATH="${1:-}"
SUFFIX="${2:-}"

if [[ -z "$REPO_PATH" ]]; then
  echo "Gebruik: ensure-branch.sh /path/to/repo"
  echo "         PAGAYO_NEW_LANE=1 ensure-branch.sh /path/to/repo <suffix>"
  exit 1
fi

if [[ ! -d "$REPO_PATH/.git" ]]; then
  echo "❌ Geen git repo: $REPO_PATH"
  exit 1
fi

if [[ "${PAGAYO_NEW_LANE:-}" != "1" ]]; then
  exec "$SCRIPT_DIR/ensure-working-lane.sh" "$REPO_PATH"
fi

if [[ -z "$SUFFIX" ]]; then
  echo "❌ PAGAYO_NEW_LANE=1 vereist een suffix (expliciete extra lane)."
  exit 1
fi

cd "$REPO_PATH"
REPO_NAME="$(basename "$(git rev-parse --show-toplevel)")"
echo "🌿 ensure-branch — $REPO_NAME (extra lane, expliciet)"

if ! guard_clean_tree "nieuwe lane"; then
  exit 1
fi

TARGET="$(branch_guard_lane_name "$SUFFIX")"
BASE_REF="$(branch_guard_resolve_base_ref)"
if [[ -z "$BASE_REF" ]]; then
  echo "❌ Geen PDC-tip om extra lane van af te takken (niet GitHub main)."
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$TARGET"; then
  git checkout "$TARGET"
  echo "✅ Checkout bestaande extra lane: $TARGET"
else
  git checkout -b "$TARGET" "$BASE_REF"
  echo "✅ Extra lane: $TARGET (vanaf PDC-tip $BASE_REF)"
fi

echo "   @ $(git rev-parse --short HEAD)"
