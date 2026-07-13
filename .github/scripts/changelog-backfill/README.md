# Changelog backfill (one-time + re-run)

Generates [pagayo-marketing/src/content/changelog.json](../../../pagayo-marketing/src/content/changelog.json) from GitHub history and build-log milestones.

## Prerequisites

- `gh` CLI authenticated with access to `Pagayo/*` repos

## Run

```bash
node extract.mjs   # → output/raw-changelog.json
node process.mjs     # → output/draft-changelog.json + marketing changelog.json
```

Anchor date (`PROJECT_START_DATE`) = first commit on `pagayo-storefront` (Week 1), currently `2025-12-04`.
