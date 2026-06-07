# Proposed preflight guards (wacht op Sjoerd-ja)

Backfill over 6 runtime-repos (90d, 1166 failure runs) — `2026-06-07`.

## Samenvatting voor Sjoerd

**Geen nieuwe blokkende CHECK 8+ geïmplementeerd.** Bestaande guards (CHECK 5/7, migration-check, `ci:doctor`) dekken de seed-catalogus al.

### Top ongematchte clusters (overweeg catalog-entry, geen preflight tenzij ≥5×/30d + herhaald AI-patroon)

| Count (90d) | Repo | Workflow | Voorstel |
|-------------|------|----------|----------|
| 316 | pagayo-maintenance | Platform Smoke Tests | Catalog: `platform-smoke-tests-failure` (toegevoegd) |
| 218 | pagayo-storefront | Deploy to Cloudflare Workers | Catalog: `deploy-workflow-generic-failure` (toegevoegd) |
| 156 | pagayo-storefront | CI (metadata) | Catalog: `ci-workflow-generic-failure` (toegevoegd) |
| 86+ | meerdere | Dependabot Updates | Catalog: `dependabot-private-registry` (bestond) |
| 54 | pagayo-workflows | CI & Deploy | Zelfde `ci-workflow-generic-failure` patroon |
| 46 | pagayo-marketing | Deploy to Cloudflare Pages | Catalog: `marketing-pages-deploy-failure` (toegevoegd) |

### Preflight-regels die **niet** worden voorgesteld (infra/proces, geen lokale script-guard)

- Dependabot-failures → registry credentials in repo settings
- Platform Smoke Tests → workflow/secrets fix
- Deploy workflow aggregate failures → playbook 02 discipline (CI eerst groen)

### Als je wél een nieuwe blokkende guard wilt

Antwoord **ja** op één van deze in dezelfde thread:

1. **CHECK 8 — storefront `ci:doctor` verplicht** vóór push wanneer storefront dirty (nu aanbevolen, niet hard in preflight).
2. **CHECK 8 — block push** wanneer `stats.json` `ACTION_REQUIRED` bevat (nu alleen waarschuwing in `workspace-status`).

Zonder expliciete ja: agents blijven bij lookup + bestaande CHECK 5/7/migration.

## Match rate

- Storefront detail-backfill (200 runs met logs): ~8% op job-fingerprints
- Multi-repo metadata-backfill: **37%** op workflow-clusters na catalog-uitbreiding
- Doel ≥80% vereist meer log-sampling op top-10 clusters (optionele vervolgstap)
