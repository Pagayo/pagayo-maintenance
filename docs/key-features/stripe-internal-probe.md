# Key-feature Stripe — internal probe contract

Canon smoke: `npm run smoke:key-features` in `pagayo-maintenance`.

## Why

Admin session cookies (`SMOKE_ADMIN_SESSION_COOKIE`) expire and produce hourly
false alarms (`AUTH_FAILED`) before Stripe is reached. Key-feature probes use
**machine auth** with a long-lived internal secret instead.

## Storefront endpoint (implement in pagayo-storefront)

```
GET /api/internal/key-features/stripe
Header: X-Internal-Secret: <same value as Worker INTERNAL secret>
```

### Auth

- Missing/wrong secret → **401** (fail-closed), same middleware family as other
  `/api/internal/*` routes (`X-Internal-Secret`).
- No admin/session cookie required.
- Read-only: no Stripe writes, refunds, checkout, or payouts.

### Success `200`

```json
{
  "success": true,
  "data": {
    "feature": "stripe",
    "mode": "TEST",
    "accountId": "acct_...",
    "balanceOk": true
  }
}
```

Semantics (must match current admin `/api/payments/stripe/test` + `/balance`):

| Field | Rule |
|-------|------|
| `mode` | Must be `"TEST"` on staging demo |
| `accountId` | Connected/platform account id used by tenant |
| `balanceOk` | `true` only if Stripe balance retrieve succeeded |

### Error shapes

```json
{
  "success": false,
  "error": { "code": "CONFIGURATION_ERROR", "message": "..." }
}
```

Recommended `error.code` values (probe surfaces them as-is):

- `CONFIGURATION_ERROR` — Stripe not configured for tenant
- `STRIPE_CONNECTION_FAILED` — account unreachable
- `UNAUTHORIZED` — bad/missing secret (HTTP 401)

## Maintenance probe

| Env | Role |
|-----|------|
| `SMOKE_INTERNAL_SERVICE_KEY` | Value for `X-Internal-Secret` (Cursor secret) |
| `SMOKE_STOREFRONT_URL` | Optional; default `https://demo.staging.pagayo.app` |

Probe codes:

| status | code | meaning |
|--------|------|---------|
| skip | `AUTH_REQUIRED` | Secret not set in automation |
| fail | `AUTH_FAILED` | Secret rejected (rotate/mismatch) |
| fail | `ENDPOINT_MISSING` | Storefront route not deployed yet |
| fail | `MODE_NOT_TEST` / Stripe codes | Real product/config issue |
| pass | `STRIPE_OK` | TEST mode + balance OK |

## Rollout

1. Implement + deploy endpoint on **staging** storefront.
2. Set Cursor secret `SMOKE_INTERNAL_SERVICE_KEY` (same as storefront internal secret for staging).
3. Remove reliance on `SMOKE_ADMIN_SESSION_COOKIE` for this automation.
4. Confirm `npm run smoke:key-features` → `STRIPE_OK`.
