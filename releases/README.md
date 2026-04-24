# Release Manifest

`current.json` is de **single source of truth** voor welke commit per Pagayo-repo als laatste succesvol door de staging-pipeline is gekomen (inclusief smoke tests).

Productie-deploys valideren de deploy-SHA tegen dit manifest via de `reusable-preprod-guard.yml` workflow. Zonder match wordt de deploy geweigerd.

## Structuur

```json
{
  "version": 1,
  "updated_at": "<ISO-8601 UTC>",
  "updated_by": "<actor of script>",
  "repos": {
    "<repo-name>": {
      "staging_sha": "<full git sha of null>",
      "verified_at": "<ISO-8601 UTC of null>"
    }
  }
}
```

- `version`: bump bij elke breaking structuurwijziging.
- `staging_sha`: full 40-char git SHA die groen door staging-smoke kwam.
- `verified_at`: tijdstip van de succesvolle staging-smoke.

## Update-flow (alleen via automation)

1. Repo's staging-deploy job draait smoke tests.
2. Bij success triggert de job (via `gh workflow run`) de `update-release-manifest.yml` workflow in **pagayo-maintenance** met `repo` + `sha`.
3. Die workflow draait `scripts/update-release-manifest.sh` en commit de update direct naar `main`.

**Handmatige edits zijn verboden** behalve voor rollback/hotfix (zie `RUNBOOK-release-manifest.md`).

## Rollback

Zie [`../RUNBOOK-release-manifest.md`](../RUNBOOK-release-manifest.md) voor de stappen om de `staging_sha` terug te draaien naar een eerdere known-good commit.

## Waarom in pagayo-maintenance en niet in pagayo-vault?

`pagayo-vault` is geen git-repo. Het manifest moet via een ruwe HTTPS-URL leesbaar zijn vanuit private consumer-workflows. `pagayo-maintenance` is de logische eigenaar van platform-kwaliteitscontract en is bereikbaar via `raw.githubusercontent.com`.
