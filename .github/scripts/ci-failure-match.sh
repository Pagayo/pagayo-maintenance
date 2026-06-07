#!/usr/bin/env bash
# =============================================================================
# CI FAILURE MATCH — lookup known patterns in ci-failure-catalog
# =============================================================================
# Usage:
#   ci-failure-match.sh --text "error message..."
#   ci-failure-match.sh --run RUN_ID --repo Pagayo/pagayo-storefront
#   ci-failure-match.sh --text "..." --repo pagayo-storefront --json
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAINTENANCE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MATCH_CLI="$MAINTENANCE_ROOT/ci-failure-catalog/match-cli.mjs"

TEXT=""
RUN_ID=""
REPO=""
WORKFLOW=""
JOB=""
JSON_OUT=false

usage() {
  cat <<'EOF'
Usage: ci-failure-match.sh (--text TEXT | --run RUN_ID) [options]

Options:
  --repo REPO       Filter by repo slug (e.g. pagayo-storefront or Pagayo/pagayo-storefront)
  --workflow NAME   Filter by workflow name
  --job NAME        Filter by job name
  --json            Emit JSON result
  -h, --help        Show help

Exit codes:
  0 = match found
  1 = no match
  2 = invalid usage or catalog error
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --text)
      TEXT="${2:-}"
      shift 2
      ;;
    --run)
      RUN_ID="${2:-}"
      shift 2
      ;;
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --workflow)
      WORKFLOW="${2:-}"
      shift 2
      ;;
    --job)
      JOB="${2:-}"
      shift 2
      ;;
    --json)
      JSON_OUT=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ci-failure-match: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$TEXT" && -z "$RUN_ID" ]]; then
  echo "ci-failure-match: --text or --run is required" >&2
  exit 2
fi

if [[ -n "$RUN_ID" ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "ci-failure-match: gh CLI required for --run" >&2
    exit 2
  fi

  GH_ARGS=(run view "$RUN_ID" --log-failed)
  if [[ -n "$REPO" ]]; then
    GH_ARGS+=(--repo "$REPO")
  fi

  TEXT="$(gh "${GH_ARGS[@]}" 2>/dev/null | tail -n 200 || true)"
  if [[ -z "$TEXT" ]]; then
    echo "ci-failure-match: could not fetch logs for run $RUN_ID" >&2
    exit 2
  fi

  if [[ -z "$WORKFLOW" ]]; then
    WORKFLOW="$(gh run view "$RUN_ID" --json workflowName -q '.workflowName' ${REPO:+--repo "$REPO"} 2>/dev/null || true)"
  fi
fi

# Normalize repo slug to pagayo-* form
REPO_SLUG="$REPO"
if [[ "$REPO_SLUG" == Pagayo/* ]]; then
  REPO_SLUG="${REPO_SLUG#Pagayo/}"
fi

ARGS=(--text "$TEXT")
[[ -n "$REPO_SLUG" ]] && ARGS+=(--repo "$REPO_SLUG")
[[ -n "$WORKFLOW" ]] && ARGS+=(--workflow "$WORKFLOW")
[[ -n "$JOB" ]] && ARGS+=(--job "$JOB")
[[ "$JSON_OUT" == "true" ]] && ARGS+=(--json)

node "$MATCH_CLI" "${ARGS[@]}"
