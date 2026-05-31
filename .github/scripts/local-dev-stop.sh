#!/usr/bin/env bash
# Pagayo — lokale dev-stack stoppen (wrangler, vite, serve, astro, poorten)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=local-dev-lib.sh
source "$SCRIPT_DIR/local-dev-lib.sh"

echo "🛑 Pagayo Local Dev — stoppen"
local_dev_stop_background_pids
local_dev_stop_wrangler_and_ports

pkill -f "serve public" 2>/dev/null || true
pkill -f "pagayo-storefront/node_modules/.bin/vite" 2>/dev/null || true
pkill -f "astro dev" 2>/dev/null || true
pkill -f "concurrently" 2>/dev/null || true

echo "✅ Local dev stack gestopt"
