#!/usr/bin/env bash
# =============================================================================
# CI FAILURE BACKFILL — mine historical GitHub Actions failures
# =============================================================================
# Usage:
#   ci-failure-backfill.sh [--repo Pagayo/pagayo-storefront] [--days 90]
#   ci-failure-backfill.sh --phase A|B|C [--metadata-only]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAINTENANCE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo|--days|--phase)
      ARGS+=("$1" "${2:-}")
      shift 2
      ;;
    --metadata-only)
      ARGS+=("$1")
      shift
      ;;
    -h|--help)
      echo "Usage: ci-failure-backfill.sh [--repo Pagayo/...] [--days 90] [--phase A|B|C] [--metadata-only]"
      exit 0
      ;;
    *)
      echo "ci-failure-backfill: unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

node "$MAINTENANCE_ROOT/ci-failure-catalog/backfill-cli.mjs" "${ARGS[@]}"
