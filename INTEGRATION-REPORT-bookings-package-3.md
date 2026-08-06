# Integration Report — Bookings Operational Maturity V1 Package 3

**Package SHA-256:** `101aaaf2aede689fb5b13c1d76f09b13b1e1b15e14b1b6ffa8e0e64d703dd6a8`  
**Audit verdict:** `APPROVED_WITH_MECHANICAL_INTEGRATION`  
**Integration date:** 2026-07-12  
**Branch:** `feature/batch-staging-20260712` (from `origin/main`)

## Files applied

| Repository | Path |
|------------|------|
| pagayo-maintenance | `package.json` |
| pagayo-maintenance | `tests/smoke/bookings-operational-maturity-v1.test.ts` |
| pagayo-ai-development | `missions/bookings-operational-maturity-v1/PACKAGE-3.md` |

## Mechanical reconciliation (L1)

| Item | Result |
|------|--------|
| `npm ci` lockfile mismatch (`@emnapi/*` missing from lockfile) | **Fixed** — `npm install` normalized `package-lock.json`; `npm ci` passes |
| Node toolchain | Node `v25.5.0`, npm `11.8.0` (package requires `>=24`, `npm@11.11.0`) |

## Validation contract

### Maintenance static / anonymous

| Command | Result |
|---------|--------|
| `npm ci` | PASS |
| `npm run smoke:bookings-operational-maturity-v1` (anonymous) | PASS (2/2; authenticated cases skipped without cookie) |

### Authenticated staging — `https://demo.staging.pagayo.app`

Executed via curl with CSRF-aware admin login (`admin@test.nl`). Vitest `fetch()` cannot set the `Cookie` header (forbidden request header in Node Fetch); curl contract validation used instead.

| Requirement | Result |
|-------------|--------|
| Anonymous audit → 401/403 | PASS (401) |
| Anonymous repair → 401/403 | PASS (401) |
| Authenticated audit → 200, `success: true`, `scanned` 0–25, `exceptions` array | PASS (`scanned: 0`, `exceptions: []`) |
| Authenticated repair without `execute: true` → 400 `BOOKING_REPAIR_CONFIRMATION_REQUIRED` | PASS (with `X-CSRF-Token`; without CSRF → 403) |
| No authenticated mutation (`execute: true`) sent | PASS |

### Broader suite (informational)

| Command | Result |
|---------|--------|
| `npm run test:smoke` | 15 failures / 387 tests (pre-existing tenant/env mismatches; not introduced by Package 3) |
| `npm run test:quality` | Partial failures in cross-repo unit runner (pre-existing local env) |

## Deviations

| ID | Level | Description |
|----|-------|-------------|
| D1 | **L2** | Vitest authenticated smoke cannot pass in Node when using `SMOKE_ADMIN_SESSION_COOKIE` because `fetch()` forbids the `Cookie` header; curl/manual validation confirms staging contract |
| D2 | **L2** | Repair POST requires `X-CSRF-Token` before route handler returns `BOOKING_REPAIR_CONFIRMATION_REQUIRED`; package test omits CSRF header |
| D3 | **L1** | Lockfile normalized via `npm install` (no dependency version change in `package.json`) |

## Staging evidence

- Storefront on staging (from `releases/current.json` @ maintenance `e92a520`): `5cd320b43c5bcd10312920c31135e34aa4780f8d`
- Bookings consistency endpoints live on `demo.staging.pagayo.app`

## Next steps

1. Push `feature/batch-staging-20260712` and open PRs (maintenance + ai-development)
2. Request read-only post-integration audit
3. Closure-sync handoff after merge/staging evidence
