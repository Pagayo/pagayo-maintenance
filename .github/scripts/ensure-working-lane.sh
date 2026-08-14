#!/usr/bin/env bash
# Pagayo — converge this repo onto pdc/current (one founder, AI-only daily work).
# Never forks from GitHub main. New isolated lanes: PAGAYO_NEW_LANE=1 ensure-branch.sh …
#
# Gebruik: ensure-working-lane.sh /path/to/repo

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=branch-guard-lib.sh
source "$SCRIPT_DIR/branch-guard-lib.sh"

REPO_PATH="${1:-}"
if [[ -z "$REPO_PATH" ]]; then
  echo "Gebruik: ensure-working-lane.sh /path/to/repo"
  exit 1
fi
if [[ ! -d "$REPO_PATH/.git" ]]; then
  echo "❌ Geen git repo: $REPO_PATH"
  exit 1
fi

cd "$REPO_PATH"
REPO_NAME="$(basename "$(git rev-parse --show-toplevel)")"
WORKING="$(branch_guard_working_branch)"
CURRENT="$(branch_guard_current_branch)"
SHA="$(branch_guard_staging_sha || true)"
STASHED=0

echo "🌿 working-lane — $REPO_NAME → $WORKING"

_stash_if_dirty() {
  if branch_guard_is_dirty; then
    git stash push -m "pdc-converge from ${CURRENT:-HEAD}" --quiet
    STASHED=1
    echo "   WIP geparkeerd (stash) — komt mee naar $WORKING"
  fi
}

_restore_stash() {
  if [[ "$STASHED" == "1" ]]; then
    if ! git stash pop --quiet; then
      echo "❌ WIP-stash conflict op $WORKING — los op, stash blijft staan."
      return 1
    fi
    echo "   WIP teruggezet op $WORKING"
  fi
}

_ff_to_tip() {
  local tip="${1:-}"
  [[ -n "$tip" ]] || return 0
  git cat-file -e "${tip}^{commit}" 2>/dev/null || return 0
  if git merge-base --is-ancestor HEAD "$tip" 2>/dev/null; then
    if [[ "$(git rev-parse HEAD)" != "$(git rev-parse "$tip")" ]]; then
      echo "   achter op PDC-tip — fast-forward naar $(git rev-parse --short "$tip")"
      git merge --ff-only "$tip"
    fi
  fi
}

if [[ "$CURRENT" == "$WORKING" ]]; then
  _ff_to_tip "$SHA"
  echo "✅ Al op $WORKING @ $(git rev-parse --short HEAD)"
  exit 0
fi

if ! git show-ref --verify --quiet "refs/heads/$WORKING"; then
  if [[ -n "$CURRENT" && "$CURRENT" != "main" && "$CURRENT" != "$INTEGRATE_BRANCH" ]]; then
    git checkout -B "$WORKING"
    echo "✅ $WORKING aangemaakt vanaf $CURRENT @ $(git rev-parse --short HEAD)"
    exit 0
  fi
  _stash_if_dirty
  BASE="$(branch_guard_resolve_base_ref)"
  if [[ -z "$BASE" ]]; then
    echo "❌ Geen PDC-tip/SHA om $WORKING van te maken — niet van GitHub main starten."
    exit 1
  fi
  git checkout -B "$WORKING" "$BASE"
  _restore_stash
  echo "✅ $WORKING aangemaakt @ $(git rev-parse --short HEAD)"
  exit 0
fi

_stash_if_dirty
git checkout "$WORKING"
_ff_to_tip "$SHA"
_restore_stash
echo "✅ Checkout $WORKING @ $(git rev-parse --short HEAD)"
