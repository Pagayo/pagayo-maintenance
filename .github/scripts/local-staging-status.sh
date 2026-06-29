#!/usr/bin/env bash
# Pagayo — Local Staging v1 status (vijf regels manager-output)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=local-staging-lib.sh
source "$SCRIPT_DIR/local-staging-lib.sh"

WS="$(local_dev_resolve_workspace "$SCRIPT_DIR")"

if local_staging_any_running; then
  LS_LINE="aan (core)"
else
  LS_LINE="uit"
fi

if local_staging_check_storefront; then
  SF_LINE="groen — http://demo.localhost:3000"
else
  SF_LINE="rood — http://demo.localhost:3000"
fi

if local_staging_check_api; then
  API_LINE="groen — http://localhost:8787"
else
  API_LINE="rood — http://localhost:8787"
fi

DATA_LINE="$(local_staging_data_label "$WS")"
SMOKE_LINE="$(local_staging_read_smoke_label)"

echo "Local Staging: $LS_LINE"
echo "Storefront: $SF_LINE"
echo "API Stack: $API_LINE"
echo "Data: $DATA_LINE"
echo "Smoke: $SMOKE_LINE"
