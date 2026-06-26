#!/usr/bin/env bash
# Pagayo — Local Staging v1 stop (alleen /tmp/pagayo-local-staging processen)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=local-staging-lib.sh
source "$SCRIPT_DIR/local-staging-lib.sh"

echo "🛑 Pagayo Local Staging v1 — stoppen (core)"
local_staging_stop_background_pids
rm -f "$(local_staging_state_file)"
echo "✅ Local Staging processen gestopt"
echo "ℹ️  local-dev of andere stacks op dezelfde poorten zijn niet aangeraakt."
