#!/usr/bin/env bash
# Pagayo — Staging RC smoke (narrow, demo-targeted)
# verifyMode=rc | production companion — NOT for every Path A deploy.
#
# Checks HTTPS reachability + basic contracts on demo.staging.
# Full platform matrix = npm run test:smoke (production / explicit).

set -euo pipefail

STOREFRONT_URL="${STAGING_STOREFRONT_URL:-https://demo.staging.pagayo.app}"
TIMEOUT="${STAGING_RC_SMOKE_TIMEOUT:-15}"

FAIL=0
DETAIL_PARTS=()

note_fail() {
  DETAIL_PARTS+=("$1")
  FAIL=1
}

http_code() {
  local url="$1"
  curl -sS -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" || echo "000"
}

echo "🧪 Staging RC smoke (narrow)"
echo "   Target: $STOREFRONT_URL"
echo ""

# Tenant home
CODE="$(http_code "$STOREFRONT_URL/")"
if [[ "$CODE" == "200" ]]; then
  echo "✅ storefront tenant home (HTTP $CODE)"
else
  echo "❌ storefront tenant home (HTTP $CODE)"
  note_fail "tenant home $CODE"
fi

# Health (if present — 200 preferred; 404 tolerated only when endpoint absent)
HEALTH_CODE="$(http_code "$STOREFRONT_URL/api/health")"
if [[ "$HEALTH_CODE" == "200" ]]; then
  echo "✅ /api/health (HTTP $HEALTH_CODE)"
elif [[ "$HEALTH_CODE" == "404" ]]; then
  echo "⚠️  /api/health (HTTP 404 — endpoint absent; continue)"
else
  echo "❌ /api/health (HTTP $HEALTH_CODE)"
  note_fail "health $HEALTH_CODE"
fi

# Public products contract (must not 5xx)
PRODUCTS_CODE="$(http_code "$STOREFRONT_URL/api/products")"
if [[ "$PRODUCTS_CODE" =~ ^[23] ]]; then
  echo "✅ /api/products (HTTP $PRODUCTS_CODE)"
elif [[ "$PRODUCTS_CODE" == "404" ]]; then
  echo "⚠️  /api/products (HTTP 404 — tenant/path; continue)"
else
  echo "❌ /api/products (HTTP $PRODUCTS_CODE)"
  note_fail "products $PRODUCTS_CODE"
fi

# Admin reachable (200 or redirect to login)
ADMIN_CODE="$(http_code "$STOREFRONT_URL/admin")"
if [[ "$ADMIN_CODE" == "200" || "$ADMIN_CODE" == "302" || "$ADMIN_CODE" == "307" || "$ADMIN_CODE" == "301" ]]; then
  echo "✅ /admin bereikbaar (HTTP $ADMIN_CODE)"
else
  echo "❌ /admin bereikbaar (HTTP $ADMIN_CODE)"
  note_fail "admin $ADMIN_CODE"
fi

# Public settings (must not 5xx)
SETTINGS_CODE="$(http_code "$STOREFRONT_URL/api/settings/public")"
if [[ "$SETTINGS_CODE" =~ ^[23] ]]; then
  echo "✅ /api/settings/public (HTTP $SETTINGS_CODE)"
elif [[ "$SETTINGS_CODE" == "404" ]]; then
  echo "⚠️  /api/settings/public (HTTP 404 — continue)"
else
  echo "❌ /api/settings/public (HTTP $SETTINGS_CODE)"
  note_fail "settings/public $SETTINGS_CODE"
fi

echo ""
echo "VERIFY_MODE_HINT=rc"
echo "STAGING_RC_SMOKE_TARGET=$STOREFRONT_URL"

if [[ "$FAIL" -eq 0 ]]; then
  echo "✅ Staging RC smoke: groen"
  exit 0
fi

DETAIL="$(IFS='; echo "${DETAIL_PARTS[*]}")"
echo "❌ Staging RC smoke: rood — $DETAIL"
exit 1
