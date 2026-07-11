#!/usr/bin/env bash
set -euo pipefail

: "${PAGAYO_STOREFRONT_STAGING_URL:?required}"
: "${PAGAYO_API_STACK_STAGING_URL:?required}"

curl --fail --silent --show-error "${PAGAYO_API_STACK_STAGING_URL}/api/health" >/dev/null
curl --fail --silent --show-error "${PAGAYO_STOREFRONT_STAGING_URL}/health" >/dev/null

webhook_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{}' \
  "${PAGAYO_API_STACK_STAGING_URL}/webhooks/shipping/sendcloud")"
if [[ "$webhook_status" != "503" && "$webhook_status" != "401" ]]; then
  echo "Expected disabled/authenticated Sendcloud webhook boundary, got HTTP ${webhook_status}" >&2
  exit 1
fi

internal_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{}' \
  "${PAGAYO_STOREFRONT_STAGING_URL}/internal/fulfillment/carrier-events")"
if [[ "$internal_status" != "401" ]]; then
  echo "Expected protected Storefront carrier-event relay, got HTTP ${internal_status}" >&2
  exit 1
fi

echo "Fulfillment maturity V2 boundaries reachable and safely gated"
