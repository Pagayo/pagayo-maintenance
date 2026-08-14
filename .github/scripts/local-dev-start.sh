#!/usr/bin/env bash
# Pagayo — lokale dev starten (data behouden)
# Standaard: achtergrond (geen Terminal-vensters). Optioneel: --terminal

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=local-dev-lib.sh
source "$SCRIPT_DIR/local-dev-lib.sh"

MODE="${PAGAYO_LOCAL_DEV_MODE:-background}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --terminal) MODE=terminal ;;
    --background) MODE=background ;;
    *)
      echo "Onbekende optie: $1 (gebruik --background of --terminal)"
      exit 1
      ;;
  esac
  shift
done

WS="$(local_dev_resolve_workspace "$SCRIPT_DIR")"

echo "🚀 Pagayo Local Dev — start (data behouden, $MODE)"
echo "   Workspace: $WS"
echo ""

# One working lane — never start Wrangler on stale main / a leftover feature branch.
if [[ -x "$SCRIPT_DIR/ensure-working-lane.sh" ]]; then
  "$SCRIPT_DIR/ensure-working-lane.sh" "$WS/pagayo-storefront"
  if [[ -d "$WS/pagayo-api-stack/.git" ]]; then
    "$SCRIPT_DIR/ensure-working-lane.sh" "$WS/pagayo-api-stack" || true
  fi
  echo ""
fi


local_dev_stop_wrangler_and_ports
local_dev_stop_background_pids
echo ""

# Packages terwijl stack down is — voorkomt api-stack schema-symlink mid-build crashes.
local_dev_sync_stale_packages "$WS"

# Fix workerd _cf_ALARM schema drift without wiping tenant D1.
local_dev_repair_wrangler_alarm_metadata "$WS"

local_dev_bootstrap_preserve "$WS"
local_dev_apply_tenant_migrations "$WS"
local_dev_apply_api_migrations "$WS"

if [[ "$MODE" == "terminal" ]]; then
  local_dev_start_terminal_services "$WS"
else
  local_dev_start_background_services "$WS"
fi

local_dev_print_urls "" "$MODE"

local_dev_wait_for_health 45 || true
