# RUNBOOK — Release Manifest

Dit runbook beschrijft het release-manifest (`releases/current.json`) en de
pre-prod guard die productie-deploys blokkeert als de te deployen SHA niet
gereleased is via staging.

## 1. Concept

| Ding | Betekenis |
| ---- | --------- |
| `releases/current.json` | SSOT voor laatst-verified staging-SHA per Pagayo-repo |
| `scripts/update-release-manifest.sh` | Idempotente updater van de JSON zonder git side effects |
| `.github/workflows/update-release-manifest.yml` | Dispatch-target waar consumer-repo's naar schrijven na groene staging-smoke |
| `.github/workflows/reusable-preprod-guard.yml` | Reusable workflow die caller-SHA vergelijkt met het manifest |

## 2. Flow

```text
[consumer repo]                       [pagayo-maintenance]
  staging deploy + smoke (success)
         │
         ▼
  gh workflow run update-release-manifest.yml
         │                                   ▼
         │                      update-release-manifest.yml
         │                                   │
         │                                   ▼
         │                     scripts/update-release-manifest.sh
         │                                   │
         │                                   ▼
         │                branch + PR + auto-merge → main
         │
         ▼
  productie-deploy (workflow_dispatch, mode=full of production-only)
         │
         ▼
  preprod-guard (reusable-preprod-guard.yml)
         │
         ▼
  fetch raw manifest uit main → vergelijk met caller-SHA
         │
         └─ mismatch ⇒ FAIL
         └─ match    ⇒ deploy-production mag draaien
```

## 3. Handmatige setup (eenmalig door Sjoerd)

### 3.1 Personal Access Token

Maak een fine-grained PAT met:

- **Resource owner**: `Pagayo`
- **Repository access**: alleen `pagayo-maintenance`
- **Permissions**: `Actions: Read and write` (om `update-release-manifest.yml` te dispatchen)
- **Naam**: `RELEASE_MANIFEST_TOKEN`

> Fine-grained is voldoende; een classic PAT met `repo` scope werkt ook.

### 3.2 Secret per consumer-repo

Voeg de PAT toe als repository secret `RELEASE_MANIFEST_TOKEN` in elk van:

- `Pagayo/pagayo-storefront`
- `Pagayo/pagayo-api-stack`
- `Pagayo/pagayo-edge`
- `Pagayo/pagayo-workflows`

De default `GITHUB_TOKEN` kan geen workflows in andere repo's dispatchen, vandaar de PAT.

## 4. Rollback

Scenario: productie draait een nieuwe release en die is kapot. We willen terug naar een eerdere known-good SHA.

1. Bepaal de known-good SHA (bv. uit git history of een vorige run).
2. Dispatch de update-workflow met die SHA:

   ```bash
   gh workflow run update-release-manifest.yml \
     -R Pagayo/pagayo-maintenance \
     --ref main \
     -f repo=pagayo-storefront \
     -f sha=<known-good-full-sha>
   ```

3. Dispatch nu de production-only deploy in de consumer-repo met `target_ref=<known-good-full-sha>`.
4. De preprod-guard vergelijkt `github.sha` / checkout-SHA met manifest → match → deploy mag door.

## 5. Hotfix-deploy (zonder volledige staging-cyclus)

Als een hotfix direct naar productie moet zonder de reguliere staging-flow:

1. Cherry-pick / commit de fix op `main` van de consumer-repo.
2. Draai alsnog staging-deploy op die SHA (sterk aanbevolen) — smoke zal het manifest bijwerken automatisch.
3. **Noodgeval only** — wanneer stap 2 echt niet kan: handmatig dispatchen van `update-release-manifest.yml` met de hotfix-SHA, daarna production-only deploy.

> Handmatige manifest-updates staan op naam van de actor die de dispatch deed. Documenteer de reden in een post-incident note.

## 6. Lokaal testen

```bash
cd pagayo-maintenance
scripts/update-release-manifest.sh pagayo-storefront $(printf '%040d' 1) --dry-run
```

Dit toont de te schrijven entry zonder bestandsschrijfactie of git side effects.

## 7. Versie-bump van het manifest

Bij breaking wijzigingen in de structuur van `current.json`:

1. Bump `version` (bv. `1` → `2`).
2. Update `scripts/update-release-manifest.sh` + `reusable-preprod-guard.yml` om de nieuwe structuur te begrijpen.
3. Consumer-workflows blijven compatibel omdat ze alleen `repo`/`sha` inputs sturen.

## 8. Troubleshooting

### 8.1 `gh api` voor `releases/current.json`

De GitHub **Contents API** is een `GET`. Gebruik **`?ref=main` in de URL**, niet `-f ref=main` als form field op `gh api`:

```bash
gh api 'repos/Pagayo/pagayo-maintenance/contents/releases/current.json?ref=main' --jq .name
```

### 8.2 “Release manifest is niet op tijd bijgewerkt” terwijl deploy groen is

`update-release-manifest.yml` opent/werkt een **PR** op `pagayo-maintenance` met **auto-merge**. Tot die PR op `main` staat (CI op de PR, branch protection, approvals), blijft `staging_sha` in `current.json` op de oude waarde. Consumer-deploys pollen daarom **lang genoeg** op de nieuwe SHA.

Als dit structureel time-out: manifest-PR sneller mergebaar maken (vereiste checks/reviews) of de poll in de consumer-workflow verder verhogen.
