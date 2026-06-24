#!/usr/bin/env bash
# Preflight for tenant-feedback triage (Cursor automation / manual run).
# Exit 0 = API reachable; exit 1 = blocked (routing, secret, or network).
#
# Usage:
#   INTERNAL_API_SECRET='…' pagayo-maintenance/.github/scripts/pagayo-feedback-triage-preflight.sh
#   PAGAYO_FEEDBACK_BASE_URL defaults to https://admin.pagayo.app

set -euo pipefail

BASE_URL="${PAGAYO_FEEDBACK_BASE_URL:-https://admin.pagayo.app}"
SECRET="${INTERNAL_API_SECRET:-}"

if [[ -z "$SECRET" ]]; then
  echo "FAIL: INTERNAL_API_SECRET is not set (productie worker secret, zie pagayo-vault/cloudflare/CLOUDFLARE-CONFIG.md § EDGE_SECRET)." >&2
  exit 1
fi

URL="${BASE_URL%/}/api/internal/pagayo-feedback?status=NEW&limit=1"
HTTP_BODY="$(mktemp)"
HTTP_CODE="$(curl -sS -o "$HTTP_BODY" -w '%{http_code}' \
  -H "X-Internal-Secret: ${SECRET}" \
  "$URL" || echo "000")"

if [[ "$HTTP_CODE" == "200" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY' "$HTTP_BODY"
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
if not data.get("success"):
    print("FAIL: HTTP 200 but success=false:", data.get("error"), file=sys.stderr)
    sys.exit(1)
items = data.get("data", {}).get("items", data.get("items", []))
count = len(items) if isinstance(items, list) else "?"
print(f"OK: GET pagayo-feedback reachable (sample NEW count in response: {count})")
PY
  else
    echo "OK: GET pagayo-feedback returned HTTP 200"
  fi
  rm -f "$HTTP_BODY"
  exit 0
fi

MSG="$(python3 -c "import json; d=json.load(open('$HTTP_BODY')); print(d.get('error',{}).get('message',''))" 2>/dev/null || cat "$HTTP_BODY")"
rm -f "$HTTP_BODY"

echo "FAIL: GET pagayo-feedback → HTTP ${HTTP_CODE} — ${MSG}" >&2
if [[ "$MSG" == "Invalid caller" ]]; then
  echo "Hint: mount internalPagayoFeedbackRoutes vóór internalSubscriptionRoutes in worker.ts (zie internal-pagayo-feedback.mount-order.test.ts)." >&2
fi
exit 1
