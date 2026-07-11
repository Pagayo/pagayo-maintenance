#!/usr/bin/env bash
set -euo pipefail

: "${PAGAYO_STOREFRONT_STAGING_URL:?required}"
: "${PAGAYO_API_STACK_STAGING_URL:?required}"

curl --fail --silent --show-error "${PAGAYO_API_STACK_STAGING_URL}/api/health" >/dev/null
curl --fail --silent --show-error "${PAGAYO_STOREFRONT_STAGING_URL}/health" >/dev/null

admin_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  "${PAGAYO_STOREFRONT_STAGING_URL}/api/admin/payments/reconciliation/runs")"
if [[ "$admin_status" != "401" && "$admin_status" != "403" ]]; then
  echo "Expected protected payments operations endpoint, got HTTP ${admin_status}" >&2
  exit 1
fi

internal_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --request POST --header 'Content-Type: application/json' --data '{}' \
  "${PAGAYO_STOREFRONT_STAGING_URL}/api/internal/payments/status")"
if [[ "$internal_status" != "401" ]]; then
  echo "Expected protected internal payment relay, got HTTP ${internal_status}" >&2
  exit 1
fi

echo "Payments V1 boundaries reachable; admin and internal mutation surfaces remain protected"
