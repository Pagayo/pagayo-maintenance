#!/usr/bin/env bash
# Pagayo — Local Staging v1 start (core stack, npm-only design)
# storefront + api-stack + solutions (optioneel). Geen edge/workflows/queues/marketing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=local-staging-lib.sh
source "$SCRIPT_DIR/local-staging-lib.sh"

WS="$(local_dev_resolve_workspace "$SCRIPT_DIR")"

echo "🚀 Pagayo Local Staging v1 — core start"
echo "   Workspace: $WS"
echo ""

local_staging_require_workspace "$WS"
local_staging_stop_background_pids
echo ""

if ! local_staging_check_ports_free; then
  exit 1
fi

local_dev_bootstrap_preserve "$WS"
local_dev_apply_tenant_migrations "$WS"
local_dev_apply_api_migrations "$WS"

local_staging_start_core_services "$WS"
echo ""

echo "📍 URLs (core):"
echo "   Tenant / admin: http://demo.localhost:3000/admin"
echo "   Webshop:        http://demo.localhost:3000"
echo "   API Stack:      http://localhost:8787"
if [[ "${LOCAL_STAGING_SOLUTIONS:-0}" == "1" ]]; then
  echo "   Solutions:      http://localhost:8789"
fi
echo ""
echo "   PLATFORM_FIDELITY=core-only (edge/workflows/queues → Cloudflare RC)"
echo ""

if local_staging_wait_for_health 60; then
  echo "LOCAL_STAGING_TIER=core"
  exit 0
fi

echo "LOCAL_STAGING_TIER=core"
echo "⚠️  Services gestart maar health niet op tijd — probeer local-staging-status.sh"
exit 1
