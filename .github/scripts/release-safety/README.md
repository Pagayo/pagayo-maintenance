# Shared Artifact Release Safety Scripts

Mechanical publish gates for `@pagayo/config`, `@pagayo/schema`, and `@pagayo/design`.

## Scripts

| Script | Purpose |
|--------|---------|
| `verify-publish-provenance.sh` | Block publish unless `GITHUB_SHA` is ancestor of `origin/main` |
| `verify-contract-vs-latest.mjs` | Tarball-tot-tarball contract regression vs `@latest` |
| `verify-published-artifact.mjs` | Post-publish registry install + smoke (detectie, geen rollback) |

## Reusable workflows

Pin consumer package workflows to `@release-safety-v1`:

- `reusable-release-safety-contract.yml`
- `reusable-consumer-smoke.yml`
- `reusable-published-artifact-verify.yml`

## Breaking changes

Only via `workflow_dispatch` with `ALLOW_BREAKING_CONTRACT=true` and `BREAKING_CHANGE_REASON`.
