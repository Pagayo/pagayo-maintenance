#!/usr/bin/env bash
# Pagayo — integreer meerdere repos naar local/staging

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=local-dev-lib.sh
source "$SCRIPT_DIR/local-dev-lib.sh"

WS="$(local_dev_resolve_workspace "$SCRIPT_DIR")"
INTEGRATE_SCRIPT="$SCRIPT_DIR/local-staging-integrate.sh"

DEFAULT_REPOS=(
  pagayo-storefront
  pagayo-api-stack
  pagayo-config
  pagayo-schema
  pagayo-design
  pagayo-maintenance
)

REPOS=()
FROM_BRANCH=""
DRY_RUN=0
FAIL=0

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
    --repo)
      REPOS+=("${2:-}")
      shift 2
      ;;
    -h|--help)
      echo "Gebruik: local-staging-integrate-all.sh [--from <branch>] [--repo <name>]... [--dry-run]"
      echo "Default repos: ${DEFAULT_REPOS[*]}"
      exit 0
      ;;
    *)
      REPOS+=("$1")
      shift
      ;;
  esac
done

if [[ ${#REPOS[@]} -eq 0 ]]; then
  if [[ -n "${PAGAYO_INTEGRATE_REPOS:-}" ]]; then
    # shellcheck disable=SC2206
    REPOS=(${PAGAYO_INTEGRATE_REPOS})
  else
    REPOS=("${DEFAULT_REPOS[@]}")
  fi
fi

ARGS=()
[[ -n "$FROM_BRANCH" ]] && ARGS+=(--from "$FROM_BRANCH")
[[ "$DRY_RUN" == "1" ]] && ARGS+=(--dry-run)

echo "🔀 Local Staging integrate-all"
echo "   Workspace: $WS"
echo ""

for repo in "${REPOS[@]}"; do
  repo_path="$WS/$repo"
  if [[ ! -d "$repo_path/.git" ]]; then
    echo "⊘  $repo — overgeslagen (geen git)"
    continue
  fi
  echo "── $repo ──"
  if ! "$INTEGRATE_SCRIPT" "$repo_path" "${ARGS[@]}"; then
    FAIL=1
  fi
  echo ""
done

if [[ "$FAIL" -ne 0 ]]; then
  echo "❌ Eén of meer repos faalden — integratie afgebroken."
  exit 1
fi

echo "✅ Integrate-all voltooid"
