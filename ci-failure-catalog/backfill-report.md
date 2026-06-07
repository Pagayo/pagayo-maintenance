# CI Failure Backfill Report

Generated: 2026-06-07T12:31:59.142Z
Window: 90 days
Repos: Pagayo/pagayo-storefront, Pagayo/pagayo-api-stack, Pagayo/pagayo-edge, Pagayo/pagayo-workflows, Pagayo/pagayo-maintenance, Pagayo/pagayo-marketing

## Summary

- Failure runs scanned: **1166**
- Top clusters: **19** (report shows top 50)
- Clusters with catalog match: **7**
- Match rate (top 50): **37%**

## ACTION_REQUIRED

- NEW_CLUSTER: pagayo-maintenance Platform Smoke Tests — metadata-only:Platform Smoke Tests:failure (316x)
- NEW_CLUSTER: pagayo-storefront Deploy to Cloudflare Workers — metadata-only:Deploy to Cloudflare Workers:failure (218x)
- NEW_CLUSTER: pagayo-storefront CI — metadata-only:CI:failure (156x)
- UNMATCHED_HIGH_FREQ: pagayo-storefront — metadata-only:CI:failure (156x) — consider catalog entry
- NEW_CLUSTER: pagayo-storefront Dependabot Updates — metadata-only:Dependabot Updates:failure (86x)
- NEW_CLUSTER: pagayo-api-stack Deploy to Cloudflare Workers — metadata-only:Deploy to Cloudflare Workers:failure (57x)
- NEW_CLUSTER: pagayo-api-stack Dependabot Updates — metadata-only:Dependabot Updates:failure (56x)
- UNMATCHED_HIGH_FREQ: pagayo-api-stack — metadata-only:Dependabot Updates:failure (56x) — consider catalog entry
- NEW_CLUSTER: pagayo-workflows CI & Deploy — metadata-only:CI & Deploy:failure (54x)
- UNMATCHED_HIGH_FREQ: pagayo-workflows — metadata-only:CI & Deploy:failure (54x) — consider catalog entry
- NEW_CLUSTER: pagayo-marketing Deploy to Cloudflare Pages — metadata-only:Deploy to Cloudflare Pages:failure (46x)
- UNMATCHED_HIGH_FREQ: pagayo-marketing — metadata-only:Deploy to Cloudflare Pages:failure (46x) — consider catalog entry
- NEW_CLUSTER: pagayo-edge Dependabot Updates — metadata-only:Dependabot Updates:failure (42x)
- NEW_CLUSTER: pagayo-edge CI & Deploy — metadata-only:CI & Deploy:failure (38x)
- UNMATCHED_HIGH_FREQ: pagayo-edge — metadata-only:CI & Deploy:failure (38x) — consider catalog entry
- NEW_CLUSTER: pagayo-api-stack CI — metadata-only:CI:failure (35x)
- UNMATCHED_HIGH_FREQ: pagayo-api-stack — metadata-only:CI:failure (35x) — consider catalog entry
- NEW_CLUSTER: pagayo-storefront Tenant Runtime Monitor — metadata-only:Tenant Runtime Monitor:failure (31x)
- NEW_CLUSTER: pagayo-maintenance Update Release Manifest — metadata-only:Update Release Manifest:failure (7x)
- UNMATCHED_HIGH_FREQ: pagayo-maintenance — metadata-only:Update Release Manifest:failure (7x) — consider catalog entry
- NEW_CLUSTER: pagayo-maintenance Cloudflare Token Monitor — metadata-only:Cloudflare Token Monitor:failure (7x)
- UNMATCHED_HIGH_FREQ: pagayo-maintenance — metadata-only:Cloudflare Token Monitor:failure (7x) — consider catalog entry
- NEW_CLUSTER: pagayo-workflows Dependabot Updates — metadata-only:Dependabot Updates:failure (6x)
- NEW_CLUSTER: pagayo-marketing Dependabot Updates — metadata-only:Dependabot Updates:failure (5x)
- UNMATCHED_HIGH_FREQ: pagayo-marketing — metadata-only:Dependabot Updates:failure (5x) — consider catalog entry
- NEW_CLUSTER: pagayo-storefront Ops — Skicenter variants + KV (7ebzmf) — metadata-only:Ops — Skicenter variants + KV (7ebzmf):failure (4x)

## Top 20 clusters

| Count | Repo | Workflow | Job | Catalog | Fingerprint |
|------:|------|----------|-----|---------|-------------|
| 316 | pagayo-maintenance | Platform Smoke Tests |  | github-permissions-403 | metadata-only:Platform Smoke Tests:failure |
| 218 | pagayo-storefront | Deploy to Cloudflare Workers |  | deploy-workflow-generic-failure | metadata-only:Deploy to Cloudflare Workers:failure |
| 156 | pagayo-storefront | CI |  | — | metadata-only:CI:failure |
| 86 | pagayo-storefront | Dependabot Updates |  | dependabot-private-registry | metadata-only:Dependabot Updates:failure |
| 57 | pagayo-api-stack | Deploy to Cloudflare Workers |  | deploy-workflow-generic-failure | metadata-only:Deploy to Cloudflare Workers:failure |
| 56 | pagayo-api-stack | Dependabot Updates |  | — | metadata-only:Dependabot Updates:failure |
| 54 | pagayo-workflows | CI & Deploy |  | — | metadata-only:CI & Deploy:failure |
| 46 | pagayo-marketing | Deploy to Cloudflare Pages |  | — | metadata-only:Deploy to Cloudflare Pages:failure |
| 42 | pagayo-edge | Dependabot Updates |  | dependabot-private-registry | metadata-only:Dependabot Updates:failure |
| 38 | pagayo-edge | CI & Deploy |  | — | metadata-only:CI & Deploy:failure |
| 35 | pagayo-api-stack | CI |  | — | metadata-only:CI:failure |
| 31 | pagayo-storefront | Tenant Runtime Monitor |  | tenant-runtime-monitor-failure | metadata-only:Tenant Runtime Monitor:failure |
| 7 | pagayo-maintenance | Update Release Manifest |  | — | metadata-only:Update Release Manifest:failure |
| 7 | pagayo-maintenance | Cloudflare Token Monitor |  | — | metadata-only:Cloudflare Token Monitor:failure |
| 6 | pagayo-workflows | Dependabot Updates |  | dependabot-private-registry | metadata-only:Dependabot Updates:failure |
| 5 | pagayo-marketing | Dependabot Updates |  | — | metadata-only:Dependabot Updates:failure |
| 4 | pagayo-storefront | Ops — Skicenter variants + KV (7ebzmf) |  | — | metadata-only:Ops — Skicenter variants + KV (7ebzmf):failure |
| 1 | pagayo-storefront | Publish Product-Help to KV |  | — | metadata-only:Publish Product-Help to KV:failure |
| 1 | pagayo-storefront | Nightly Regression |  | — | metadata-only:Nightly Regression:failure |

## Proposed catalog additions

- **156×** pagayo-storefront / CI / —: `metadata-only:CI:failure`
- **56×** pagayo-api-stack / Dependabot Updates / —: `metadata-only:Dependabot Updates:failure`
- **54×** pagayo-workflows / CI & Deploy / —: `metadata-only:CI & Deploy:failure`
- **46×** pagayo-marketing / Deploy to Cloudflare Pages / —: `metadata-only:Deploy to Cloudflare Pages:failure`
- **38×** pagayo-edge / CI & Deploy / —: `metadata-only:CI & Deploy:failure`
- **35×** pagayo-api-stack / CI / —: `metadata-only:CI:failure`
- **7×** pagayo-maintenance / Update Release Manifest / —: `metadata-only:Update Release Manifest:failure`
- **7×** pagayo-maintenance / Cloudflare Token Monitor / —: `metadata-only:Cloudflare Token Monitor:failure`
- **5×** pagayo-marketing / Dependabot Updates / —: `metadata-only:Dependabot Updates:failure`
- **4×** pagayo-storefront / Ops — Skicenter variants + KV (7ebzmf) / —: `metadata-only:Ops — Skicenter variants + KV (7ebzmf):failure`
