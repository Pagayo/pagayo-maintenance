---
name: 02-staging
description: Deploy Pagayo Workers repos to staging via GitHub Actions workflow_dispatch with deploy_mode=staging-only. Monitors CI on target SHA with gh, dispatches deploy, watches until success/failure/cancelled. Use when Sjoerd asks for staging deploy, playbook 02, post-push deploy, or gh run monitoring. No git write, no production deploy.
---

# Playbook 02 — Staging (deploy staging-only)

Je bent verantwoordelijk voor **GitHub Actions**, **`gh`**, en **read-only git** (`status`, `log`, `diff`, `fetch`, `branch`). **Geen** `git commit`, `git push`, checkout/switch/rebase/force-push.

## Leesvolgorde

1. `pagayo-vault/.github/release-playbooks/README.md` (index + design-parity invariant)
2. `pagayo-vault/.github/release-playbooks/02-staging.md` (canoniek protocol)
3. Bij stack-aannames: `pagayo-vault/STACK-MANIFEST.md`

Voor uitgebreide referentie in deze skill: [reference.md](reference.md)

## Invariant: staging ≠ productie

- `workflow_dispatch` met **`deploy_mode=staging-only`** zet **alleen staging** om. Productie verandert **niet**.
- **Storefront:** push/merge naar `main` triggert deploy met **effectieve staging-only**; geen impliciete productie-deploy.
- Productie = playbook `04-production.md` alleen, na expliciete goedkeuring Sjoerd in **dezelfde thread**.
- **Staging-URL (SSoT):** `https://demo.staging.pagayo.app` — niet `https://staging.pagayo.app`.

## Voorwaarden vóór dispatch

- CI **success** op exact de uit te rollen **commit-SHA** (deploy-job `verify-ci-sha` wacht ~30 min).
- Push/preflight afgerond via playbook **01** (`deployer-preflight.sh` groen).
- Bij design/CSS-wijzigingen: volledige keten uit README (*Agent: ontbrekende design / CSS voorkomen*) — zie [reference.md](reference.md#design--css-parity).
- Bij **rode CI** of mislukte preflight: **niet** opnieuw deployen; stop-and-sweep (playbook 01).

## Quick protocol

```
Task Progress:
- [ ] 1. Bepaal repo, branch en bedoelde SHA
- [ ] 2. Controleer CI op die SHA (gh run list/view)
- [ ] 3. Dispatch staging-only (pas als CI groen)
- [ ] 4. gh run watch --exit-status tot eindstatus
- [ ] 5. Rapporteer: repo, branch, SHA, run-URL, eindstatus
```

**Eindstatussen:** alleen `success` / `failure` / `cancelled`. Geen "klaar"-melding op `queued` / `in_progress`.

### Stap 1–2: CI op bedoelde SHA

```bash
git fetch origin
git log -1 --oneline origin/feature/batch-staging-YYYYMMDD-...

gh run list --repo Pagayo/<repo> --branch feature/batch-staging-YYYYMMDD-... --limit 5
gh run view <run-id> --repo Pagayo/<repo>
```

### Stap 3: Dispatch staging-only

Workflownaam per repo controleren: `gh workflow list --repo Pagayo/<repo>`.

**Storefront (typisch):**

```bash
gh workflow run "Deploy to Cloudflare Workers" --repo Pagayo/pagayo-storefront \
  --ref feature/batch-staging-YYYYMMDD-... \
  -f deploy_mode=staging-only
```

Alternatief (file-naam):

```bash
gh workflow run deploy-cloudflare.yml --repo Pagayo/pagayo-storefront \
  --ref feature/batch-staging-YYYYMMDD-... \
  -f deploy_mode=staging-only \
  -f target_ref=feature/batch-staging-YYYYMMDD-...
```

Pas `target_ref` aan conform `.github/workflows/deploy-cloudflare.yml` inputs van **die** repo.

### Stap 4: Monitoren

```bash
gh run list --repo Pagayo/<repo> --branch feature/batch-staging-YYYYMMDD-... --limit 3
gh run watch <run-id> --exit-status --repo Pagayo/<repo>
```

## Repo-overzicht

| Repository | Deploy-notitie |
|------------|----------------|
| `pagayo-storefront` | Workers, `deploy-cloudflare.yml`, staging-first |
| `pagayo-api-stack` | Workers |
| `pagayo-edge` | Workers |
| `pagayo-workflows` | Workers |
| `pagayo-marketing` | Pages / eigen pad |
| `pagayo-cloudflare-proxy` | Directe deploy |
| `pagayo-schema`, `pagayo-config`, `pagayo-design` | Publish only — playbook 02 **n.v.t.** voor Workers-deploy |

Documenteer per repo: branch, short-SHA, CI-status, deploy-run-URL.

## Storefront hot-path (na staging deploy)

Alleen bij wijzigingen aan catalogus, bundling, i18n, cache of publieke API:

```bash
cd pagayo-storefront
npm run build:client
npm run check:webshop-boundaries
npm run check:preload-budget
npm run check:first-load-gzip
npm run analyze:webshop-hot-path
npm run check:asset-cache-headers
npm run warm:tenant-routes -- https://demo.staging.pagayo.app / /elektronica /abonnementen
# Verse HAR → npm run perf:har -- ../pagayo-docs/demo.staging.pagayo.app.har
```

Acceptatiecriteria: zie [reference.md](reference.md#performance-mini-waterfall).

## Toegestaan / verboden

**Mag:** read-only git; `gh run list/view/watch`; `gh workflow run` **alleen** staging-only; `gh pr view/list`; `gh issue list/view`; `gh api`.

**Mag niet:** git commit/push/checkout/reset/rebase/force-push; codewijzigingen; PR mergen (→ playbook 03); productie-deploy (→ playbook 04); `deploy_token` in chat.

## Escalatie

| Situatie | Playbook |
|----------|----------|
| Lokaal committen / scope | `00-pre-commit.md` |
| Push, preflight, dirty workspace | `01-commit-push.md` |
| PR/merge-readiness | `03-main-parity.md` |
| Productie | `04-production.md` (alleen expliciete opdracht Sjoerd) |

## Rapportage

Optioneel markdown onder `pagayo-docs/github-ops-agent/` (naam bv. `YYYY-MM-DD-open-prs-overview.md`).

Rapporteer aan Sjoerd: repo, branch, SHA, CI-status vóór dispatch, deploy-run-URL, eindstatus, staging-URL getest.
