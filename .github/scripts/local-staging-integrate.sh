#!/usr/bin/env bash
# Pagayo — integreer afgeronde lane naar local/staging (geen push)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=branch-guard-lib.sh
source "$SCRIPT_DIR/branch-guard-lib.sh"

REPO_PATH=""
FROM_BRANCH=""
DRY_RUN=0

usage() {
  cat <<'EOF'
Gebruik: local-staging-integrate.sh /path/to/repo [--from <lane-branch>] [--dry-run]

Integreert een afgeronde lane naar local/staging (lokaal, geen push).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)
      FROM_BRANCH="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$REPO_PATH" ]]; then
        REPO_PATH="$1"
      else
        echo "Onbekend argument: $1" >&2
        usage
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$REPO_PATH" ]]; then
  usage
  exit 1
fi

if [[ ! -d "$REPO_PATH/.git" ]]; then
  echo "❌ Geen git repo: $REPO_PATH"
  exit 1
fi

cd "$REPO_PATH"
REPO_NAME="$(basename "$(git rev-parse --show-toplevel)")"

echo "🔀 Local Staging integrate — $REPO_NAME"

if ! guard_clean_tree "integratie"; then
  exit 1
fi

LANE_BRANCH="${FROM_BRANCH:-$(branch_guard_current_branch)}"

if [[ "$LANE_BRANCH" == "main" && "${PAGAYO_ALLOW_MAIN:-}" != "1" ]]; then
  echo "❌ Bronbranch main niet toegestaan — gebruik feature/* of hotfix/*."
  exit 1
fi

if [[ "$LANE_BRANCH" == "$INTEGRATE_BRANCH" ]]; then
  echo "❌ Al op $INTEGRATE_BRANCH — geef --from <lane-branch> of switch naar je lane."
  exit 1
fi

if ! branch_guard_is_lane_branch "$LANE_BRANCH"; then
  echo "⚠️  '$LANE_BRANCH' is geen standaard lane — integratie op eigen risico."
fi

LANE_SHA="$(git rev-parse --short "$LANE_BRANCH")"
echo "   Lane: $LANE_BRANCH @ $LANE_SHA"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "   [dry-run] zou mergen naar $INTEGRATE_BRANCH (geen wijzigingen)"
  exit 0
fi

git fetch origin --quiet 2>/dev/null || true

BASE_REF="$(branch_guard_resolve_base_ref)"
if [[ -z "$BASE_REF" ]]; then
  echo "❌ Geen main ref voor $INTEGRATE_BRANCH bootstrap."
  exit 1
fi

SAVED_BRANCH="$(branch_guard_current_branch)"

if ! git show-ref --verify --quiet "refs/heads/$INTEGRATE_BRANCH"; then
  git branch "$INTEGRATE_BRANCH" "$BASE_REF"
  echo "✅ $INTEGRATE_BRANCH aangemaakt vanaf $BASE_REF"
fi

if ! guard_clean_tree "checkout $INTEGRATE_BRANCH"; then
  exit 1
fi

git checkout "$INTEGRATE_BRANCH"

if git merge-base --is-ancestor "$LANE_BRANCH" HEAD 2>/dev/null; then
  echo "ℹ️  Lane $LANE_SHA al opgenomen in $INTEGRATE_BRANCH"
else
  if ! git merge --no-ff "$LANE_BRANCH" -m "local-staging: integrate $LANE_BRANCH @ $LANE_SHA"; then
    echo "❌ Merge conflict — los handmatig op. Geen reset/clean."
    git merge --abort 2>/dev/null || true
    git checkout "$SAVED_BRANCH" 2>/dev/null || true
    exit 1
  fi
  echo "✅ Gemerged: $LANE_BRANCH → $INTEGRATE_BRANCH"
fi

INTEGRATE_SHA="$(git rev-parse --short HEAD)"
echo ""
echo "Local Staging integrate: groen"
echo "Repo: $REPO_NAME"
echo "Lane: $LANE_BRANCH @ $LANE_SHA"
echo "Integrate: $INTEGRATE_BRANCH @ $INTEGRATE_SHA"
echo "Push/deploy: niet gedaan"
