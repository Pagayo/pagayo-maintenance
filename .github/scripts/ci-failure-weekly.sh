#!/usr/bin/env bash
# =============================================================================
# CI FAILURE WEEKLY — 7-day diff vs catalog (local or scheduled workflow)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAINTENANCE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

node "$MAINTENANCE_ROOT/ci-failure-catalog/weekly-cli.mjs" "$@"
