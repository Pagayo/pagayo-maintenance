# CI Failure Catalog

SSoT for known GitHub Actions failure patterns across Pagayo repos.

## Files

| File | Role |
|------|------|
| `catalog.yaml` | Curated entries (hand-edited or agent-updated after CI fixes) |
| `stats.json` | Generated frequency data (backfill + weekly job) |
| `lib.mjs` | Schema validation and text matching (used by scripts and tests) |

## Entry lifecycle

1. **New failure** — agent fixes CI; if no match, add entry with `confidence: medium`, `status: active`.
2. **Second occurrence** — same root cause: set `status: proposed` and suggest preflight guard (Sjoerd ja/nee).
3. **≥5× in 30d + Sjoerd ja** — implement blocking check in `deployer-preflight.sh` or playbook trigger.
4. **0× in 90d** — weekly report proposes `status: archived`.

## Classifications

| Value | Meaning |
|-------|---------|
| `ai-behavioral` | Prevent via playbook triggers, rules, ci:doctor |
| `deterministic` | Prevent via scripts (preflight, lockfile checks) |
| `infra` | Workflow secrets, permissions, cross-repo checkout |
| `flake` | Document only; optional retry policy in workflow |

## Prevention layers

| Layer | Hook |
|-------|------|
| `preflight` | `deployer-preflight.sh` |
| `ci-doctor` | `npm run ci:doctor` (storefront) |
| `playbook-trigger` | Release-playbook README triggers |
| `workflow` | `.github/workflows/*.yml` change |
| `none` | Catalog lookup only |

## Scripts

```bash
# Match error text or failed run logs
.github/scripts/ci-failure-match.sh --text "design:verify-asset-version"
.github/scripts/ci-failure-match.sh --run 12345 --repo Pagayo/pagayo-storefront

# One-time / manual backfill
.github/scripts/ci-failure-backfill.sh --repo Pagayo/pagayo-storefront --days 90

# Weekly diff (also runs via ci-failure-weekly.yml)
.github/scripts/ci-failure-weekly.sh
```

## Sjoerd involvement

Default: **none**. Only when weekly report or agent flags `ACTION_REQUIRED`, or when a `proposed` entry needs approval for a new blocking preflight check.
