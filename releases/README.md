# Release Manifest

`current.json` tracks which commit per Pagayo-repo last succeeded through the **GitHub Actions** staging pipeline (including smoke).

**PDC-012 note:** For the PDC durable promote path, **PDC `environment_heads` is the SSoT** for “what artifact is active on staging/production”. This file remains a **generated mirror / fallback input** for:

- GitHub Actions `reusable-preprod-guard.yml` (playbook 04 fallback)
- Wave 1 `deploy:production:direct` pending-migration check (`staging_sha`)
- `workspace-status.sh` local reads

Do not treat this file as the sole production truth once Wave 2 environment heads are in use.

Productie-deploys via **GitHub fallback** valideren de deploy-SHA tegen dit manifest via de `reusable-preprod-guard.yml` workflow. Zonder match wordt die fallback-deploy geweigerd.

## Structuur (v1 + v2 velden)

```json
{
  "version": 1,
  "updated_at": "<ISO-8601 UTC>",
  "updated_by": "<actor of script>",
  "repos": {
    "<repo-name>": {
      "staging_sha": "<full git sha of null>",
      "verified_at": "<ISO-8601 UTC of null>",
      "development_staging_sha": "<full git sha of null — v2, optioneel>"
    }
  }
}
```

- `version`: bump bij elke breaking structuurwijziging.
- `staging_sha`: full 40-char git SHA die groen door **RC** staging-smoke kwam (`staging_lane=rc`).
- `development_staging_sha` (v2, optioneel): laatste geslaagde **development-staging** deploy; geen preprod-guard input.
- `verified_at`: tijdstip van de succesvolle staging-smoke.

## Update-flow (alleen via automation)

1. Repo's staging-deploy job draait smoke tests.
2. Bij success triggert de job (via `gh workflow run`) de `update-release-manifest.yml` workflow in **pagayo-maintenance** met `repo` + `sha`.
3. Die workflow draait `scripts/update-release-manifest.sh`, opent of ververst een manifest-PR en zet auto-merge aan zodat `main` alleen via branch protection wordt bijgewerkt.

**Handmatige edits zijn verboden** behalve voor rollback/hotfix (zie `RUNBOOK-release-manifest.md`).

## Rollback

Zie [`../RUNBOOK-release-manifest.md`](../RUNBOOK-release-manifest.md) voor de stappen om de `staging_sha` terug te draaien naar een eerdere known-good commit.

## Waarom in pagayo-maintenance en niet in pagayo-vault?

`pagayo-vault` is geen git-repo. Het manifest moet via een ruwe HTTPS-URL leesbaar zijn vanuit private consumer-workflows. `pagayo-maintenance` is de logische eigenaar van platform-kwaliteitscontract en is bereikbaar via `raw.githubusercontent.com`.
