#!/usr/bin/env bash
# Pagayo — lane branch enforcement (Release Workflow v2)
# Gebruik: ensure-branch.sh /path/to/repo [optionele-suffix]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=branch-guard-lib.sh
source "$SCRIPT_DIR/branch-guard-lib.sh"

REPO_PATH="${1:-}"
SUFFIX="${2:-}"

if [[ -z "$REPO_PATH" ]]; then
  echo "Gebruik: ensure-branch.sh /path/to/repo [optionele-suffix]"
  exit 1
fi

if [[ ! -d "$REPO_PATH/.git" ]]; then
  echo "❌ Geen git repo: $REPO_PATH"
  exit 1
fi

cd "$REPO_PATH"
REPO_NAME="$(basename "$(git rev-parse --show-toplevel)")"

echo "🌿 ensure-branch — $REPO_NAME"

if ! guard_clean_tree "branchwissel"; then
  exit 1
fi

CURRENT="$(branch_guard_current_branch)"
TARGET="$(branch_guard_lane_name "$SUFFIX")"

if [[ -z "$TARGET" ]]; then
  echo "❌ Geen lane-suffix opgegeven en PAGAYO_LANE_MODE is niet legacy."
  echo "   Gebruik: ensure-branch.sh $REPO_PATH <kort-onderwerp>"
  exit 1
fi

if [[ "$CURRENT" == "main" ]]; then
  echo "ℹ️  Op main — switch naar lane $TARGET"
elif [[ "$CURRENT" == "$INTEGRATE_BRANCH" ]]; then
  echo "❌ Op $INTEGRATE_BRANCH — switch eerst terug naar je lane vóór nieuw werk."
  exit 1
elif branch_guard_is_lane_branch "$CURRENT"; then
  echo "✅ Al op lane: $CURRENT"
  exit 0
else
  echo "ℹ️  Huidige branch '$CURRENT' — switch naar lane $TARGET"
fi

BASE_REF="$(branch_guard_resolve_base_ref)"
if [[ -z "$BASE_REF" ]]; then
  echo "❌ Geen main branch gevonden om lane van af te takken."
  exit 1
fi

git fetch origin --quiet 2>/dev/null || true

if git show-ref --verify --quiet "refs/heads/$TARGET"; then
  git checkout "$TARGET"
  echo "✅ Checkout bestaande lane: $TARGET"
else
  git checkout -b "$TARGET" "$BASE_REF"
  echo "✅ Nieuwe lane aangemaakt: $TARGET (vanaf $BASE_REF)"
fi

SHORT_SHA="$(git rev-parse --short HEAD)"
echo "   @ $SHORT_SHA"
