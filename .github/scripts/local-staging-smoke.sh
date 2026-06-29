#!/usr/bin/env bash
# Pagayo — Local Staging v1 smoke (core, geen externe providers)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=local-staging-lib.sh
source "$SCRIPT_DIR/local-staging-lib.sh"

FAIL=0
DETAIL_PARTS=()

note_fail() {
  DETAIL_PARTS+=("$1")
  FAIL=1
}

echo "🧪 Local Staging smoke (core)"
echo ""

if ! local_staging_any_running; then
  echo "❌ Local Staging draait niet — eerst local-staging-start.sh"
  local_staging_write_smoke_result "rood" "stack niet actief"
  echo "LOCAL_STAGING_TIER=core"
  exit 1
fi

# Storefront health
if curl -sf --max-time 5 "http://demo.localhost:3000/api/health" >/dev/null; then
  echo "✅ storefront /api/health"
else
  echo "❌ storefront /api/health"
  note_fail "storefront health"
fi

# Demo tenant home
if curl -sf --max-time 5 "http://demo.localhost:3000/" >/dev/null; then
  echo "✅ demo tenant route"
else
  echo "❌ demo tenant route"
  note_fail "demo route"
fi

# Admin reachable (200 of redirect naar login)
ADMIN_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://demo.localhost:3000/admin" || echo "000")"
if [[ "$ADMIN_CODE" == "200" || "$ADMIN_CODE" == "302" || "$ADMIN_CODE" == "307" ]]; then
  echo "✅ admin bereikbaar (HTTP $ADMIN_CODE)"
else
  echo "❌ admin bereikbaar (HTTP $ADMIN_CODE)"
  note_fail "admin route"
fi

# API stack health
if curl -sf --max-time 5 "http://localhost:8787/api/health" >/dev/null \
  || curl -sf --max-time 5 "http://localhost:8787/" >/dev/null; then
  echo "✅ api-stack health"
else
  echo "❌ api-stack health"
  note_fail "api health"
fi

# Solutions (optioneel)
if [[ -d "$(local_dev_resolve_workspace "$SCRIPT_DIR")/pagayo-solutions" ]]; then
  if curl -sf --max-time 5 "http://localhost:8789/" >/dev/null; then
    echo "✅ solutions bereikbaar"
  else
    echo "❌ solutions bereikbaar"
    note_fail "solutions"
  fi
fi

echo ""
echo "PLATFORM_FIDELITY=core-only"
echo "LOCAL_STAGING_TIER=core"

if [[ "$FAIL" -eq 0 ]]; then
  local_staging_write_smoke_result "groen" "core smoke OK"
  exit 0
fi

DETAIL="$(IFS='; '; echo "${DETAIL_PARTS[*]}")"
local_staging_write_smoke_result "rood" "$DETAIL"
exit 1
