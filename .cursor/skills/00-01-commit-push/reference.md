# Playbook 00 & 01 — Referentie

Canonieke bronnen:
- `pagayo-vault/.github/release-playbooks/00-pre-commit.md`
- `pagayo-vault/.github/release-playbooks/01-commit-push.md`
- `pagayo-vault/.github/release-playbooks/README.md`

## Dirty files — checklist

| Situatie | Actie |
|----------|--------|
| Modified files in scope | `git add` allemaal vóór commit |
| Untracked generated output (schema, design dist, migration SQL) | Toevoegen als repo-policy dat vereist |
| `.pagayo/preflight-attestation.json` gewijzigd | Commit vóór push |
| `@pagayo/design` lockfile bump | + `design-asset-version.ts` + `copy-design` output |
| Open wijzigingen in sibling `pagayo-design` bij storefront push | Eerst design committen (preflight CHECK 7) |
| Ander onderwerp inzelfde tree | Aparte commit of stash |
| Secrets / `.env` | Nooit committen |

## Design / CSS parity

**Triggers — één waar → volledige keten:**

- Wijziging onder `pagayo-design` (`src/**`, `dist/**`, themes, tokens).
- Storefront-UI met nieuwe/gewijzigde design-classes (POS, admin, webshop).
- Bump `@pagayo/design` in storefront-lockfile.

**Verplichte keten (volgorde):**

1. **`pagayo-design`:** `npm ci` → `npm run build` → commit bron + dist + tokens → push → tag `v*` + Publish Package.
2. **`pagayo-storefront`:** `npm install @pagayo/design@<semver>` → `PAGAYO_DESIGN_SOURCE=node_modules npm run copy-design` → commit lockfile + `src/workers/generated/design-asset-version.ts`.
3. **`deployer-preflight.sh`** op storefront: groen (geen lokaal≠npm; geen open sibling design).
4. CI groen op SHA → daarna pas playbook **02**.

## Scripts (paden)

| Script | Wanneer |
|--------|---------|
| `pagayo-maintenance/.github/scripts/workspace-status.sh` | Start 00 |
| `pagayo-maintenance/.github/scripts/ensure-branch.sh <repo>` | Vóór commit 00 |
| `pagayo-maintenance/.github/scripts/copilot-migration-check.sh` | Schema/migration 00 + 01 |
| `pagayo-maintenance/.github/scripts/deployer-preflight.sh <repo>` | Verplicht vóór push 01 |
| `pagayo-maintenance/.github/scripts/deployer-postpush.sh <repo>` | Na push naar `main` |

## Pipeline-waarheid (storefront)

| Laag | Workflow | Rol |
|------|----------|-----|
| CI | `ci.yml` | lint, typecheck, tests, admin gate |
| Deploy | `deploy-cloudflare.yml` | preflight, verify-ci-sha, deploy, smoke |

Deploy vereist geslaagde CI op **dezelfde SHA** (~30 min poll).

## Consumer-packages

`pagayo-schema`, `pagayo-config`, `pagayo-design`: publish-pad, geen Workers-deploy. Noteer `n.v.t.` + reden in rapportage.

## Sync-check (optioneel na push)

```bash
for repo in pagayo-storefront pagayo-api-stack; do
  cd /Users/sjoerdoverdiep/my-vscode-workspace/$repo 2>/dev/null || continue
  LOCAL=$(git rev-parse --short HEAD)
  REMOTE=$(git rev-parse --short origin/main 2>/dev/null || echo "?")
  if [[ "$repo" == "pagayo-storefront" ]]; then
    PROD=$(curl -sf https://demo.pagayo.app/health 2>/dev/null | jq -r '.build.gitCommit // "no-tracking"')
  elif [[ "$repo" == "pagayo-api-stack" ]]; then
    PROD=$(curl -sf https://api.pagayo.com/api/health 2>/dev/null | jq -r '.build.gitCommit // "no-tracking"')
  else
    PROD="n/a"
  fi
  printf "%-20s Local: %s | Remote: %s | Prod: %s\n" "$repo" "$LOCAL" "$REMOTE" "$PROD"
done
```

## Geschiedenis vóór eerste push

Commits nog niet op `origin`: lokaal squashen/reorder mag — **geen force-push** naar gedeelde remote zonder expliciete toestemming Sjoerd.

## Tenant-migraties

Signaleer na relevante commits op `@pagayo/schema/tenant`, `src/features/tenant-migrations/`, provisioning. Rapportage: nodig / niet nodig / onbekend.
