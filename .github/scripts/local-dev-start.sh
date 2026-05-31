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

local_dev_stop_wrangler_and_ports
local_dev_stop_background_pids
echo ""

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
