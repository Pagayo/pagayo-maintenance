# AGENTS - pagayo-maintenance

## Scope van deze repo
`pagayo-maintenance` is de centrale kwaliteits- en smoke-suite voor het hele platform.
Wijzigingen in andere repos moeten hier vaak worden gevalideerd.

## Leesvolgorde (verplicht)
1. `../AGENTS.md`
2. `../pagayo-vault/PAGAYO-NIVEAU.md`
3. `./README.md`

## Deploy Policy (Release Workflow v2)

- **Lokaal eerst:** lane-werk → commit (playbook 00) → `local/staging` integratie → Local Staging checks → pas daarna push/RC.
- **Lane-branches:** `feature/<kort>`, `hotfix/<kort>` (transitie: `feature/batch-staging-YYYYMMDD` blijft CI-compatible).
- **`local/staging`:** lokale integratiebranch — **niet** standaard pushen naar GitHub.
- **NOOIT** direct naar `main` pushen zonder expliciete goedkeuring Sjoerd.
- **RC / hotfix-staging:** `workflow_dispatch` + `deploy_mode=staging-only` + `staging_lane=rc` → `demo.staging.pagayo.app`.
- **Development-staging:** `staging_lane=development` → `dev.staging.pagayo.app` (na Fase 3 infra).
- Productie (`main` merge of `deploy_mode=full/production-only`) ALLEEN na expliciete goedkeuring van Sjoerd in dezelfde thread.

Legacy batch-branches: zet `PAGAYO_LANE_MODE=legacy` voor `ensure-branch.sh` gedrag `feature/batch-staging-YYYYMMDD`.

## Harde grenzen
- Geen `.skip` of uitgestelde tests voor productie-kritische paden.
- Contracttests moeten breaking changes snel zichtbaar maken.
- Smoke tests zijn leidend voor productiegedrag.

## Endpoint naar smoke-bestand mapping
- Storefront (`*.pagayo.app`): `tests/smoke/storefront.test.ts`
- API Stack (`api.pagayo.com`): `tests/smoke/api-stack.test.ts`
- Marketing (`www.pagayo.com`): `tests/smoke/marketing.test.ts`
- Edge/Provisioning contracten: `tests/smoke/edge-provisioning-contracts.test.ts`
- Infra/routing/SSL: `tests/smoke/infrastructure.test.ts`

## Verificatiecommando's
```bash
npm run test:smoke
npm run test:contracts
npm run test:quality
```

## Workflow v2 — ochtend-status (Fase 0)

`workspace-status.sh` bevat onderaan **Manager dashboard** — vijf regels proza voor Sjoerd. Details: `pagayo-vault/.github/release-playbooks/05-daily-workflow-v2.md`.

## Local Staging v1 (Fase 1 — core)

Scripts in `.github/scripts/` (npm-only design, geen edge/workflows/queues):

| Script | Doel |
|--------|------|
| `ensure-branch.sh` | Lane-branch afdwingen vóór werk |
| `local-staging-integrate.sh` | Lane → `local/staging` merge (per repo) |
| `local-staging-integrate-all.sh` | Integratie over meerdere repos |
| `local-staging-sync-packages.sh` | @pagayo/* build/sync vóór start |
| `local-staging-start.sh` | Core stack starten |
| `local-staging-stop.sh` | Alleen staging-processen stoppen |
| `local-staging-status.sh` | Vijf regels status voor Sjoerd |
| `local-staging-smoke.sh` | Core smoke; eindigt met `LOCAL_STAGING_TIER=core` |
| `branch-guard-lib.sh` | Gedeelde branch guards |
| `git-guard.sh` | CLI voor hooks (`can-push`, `can-switch`) |
| `install-git-guards.sh` | Optionele pre-push hook per repo |

Gedeelde state: `../.wrangler-shared`. Playbook: `pagayo-vault/.github/local-dev-playbooks/LOCAL-STAGING-v1.md`.

Standaardflow:
```text
ensure-branch → commit → local-staging-integrate → sync-packages → start → smoke → status
```

Volledige suite:
```bash
npm run test:all
```

Admin compositie-drift (storefront matrix ↔ code):
```bash
../pagayo-maintenance/.github/scripts/admin-composition-drift-check.sh
```
