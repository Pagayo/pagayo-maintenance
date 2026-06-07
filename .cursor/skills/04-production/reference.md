# Playbook 04 — Referentie (productie + main-pariteit)

Canonieke bronnen:
- `pagayo-vault/.github/release-playbooks/03-main-parity.md`
- `pagayo-vault/.github/release-playbooks/04-production.md`

## Keten vóór productie

| Stap | Playbook | Doel |
|------|----------|------|
| 00–01 | pre-commit / commit-push | Schone tree, preflight groen, push naar batch-branch |
| 02 | staging | `deploy_mode=staging-only`, CI op SHA, E2E waar relevant |
| 03 | main-pariteit | PR merged, code op `main`, checks groen |
| 04 | productie | `deploy_mode=production-only` + `deploy_token` |

Nummers zijn hulplabels — **02 vóór 03** is normaal (staging op feature-branch terwijl PR open staat).

## Main-pariteit zonder verify-script

Als `verify-feature-merged-to-main.sh` ontbreekt of faalt onverwacht:

```bash
git fetch origin
git merge-base --is-ancestor origin/feature/batch-staging-YYYYMMDD-... origin/main \
  && echo "ancestor OK" || echo "NOT on main yet"

git log -1 --oneline origin/main
gh pr list --repo Pagayo/pagayo-storefront --state merged --limit 5
```

Bij squash-merge: zoek merge-commit op `main` met de PR-titel/nummer; branch-tip hoeft geen ancestor te zijn.

## PR merge checklist

```bash
gh pr view <n> --repo Pagayo/<repo> \
  --json state,mergeable,mergeStateStatus,statusCheckRollup,headRefName,baseRefName

# Alleen na expliciete merge-opdracht Sjoerd + groen:
gh pr merge <n> --repo Pagayo/<repo> --squash
```

## CI op main vóór production-only

```bash
git fetch origin
git log -1 --oneline origin/main

gh run list --repo Pagayo/pagayo-storefront --branch main --limit 5
gh run view <ci-run-id> --repo Pagayo/pagayo-storefront
```

Deploy-workflow `verify-ci-sha` verwacht geslaagde CI op **dezelfde commit-SHA** als `target_ref`.

## Production dispatch (alle repo's)

1. `gh workflow list --repo Pagayo/<repo>`
2. Lees inputs uit `.github/workflows/deploy-cloudflare.yml` (of repo-equivalent).
3. Typisch:

```bash
# DEPLOY_TOKEN uit vault 04-production.md — nooit in chat
gh workflow run deploy-cloudflare.yml --repo Pagayo/<repo> \
  --ref main \
  -f deploy_mode=production-only \
  -f target_ref=main \
  -f deploy_token="$DEPLOY_TOKEN"
```

4. `gh run watch <run-id> --exit-status --repo Pagayo/<repo>`

## deploy_mode keuzes

| Mode | Wanneer |
|------|---------|
| `production-only` | **Standaard** playbook 04 — promote prod na staging bewezen |
| `full` | Alleen als Sjoerd expliciet staging + prod in één run wil |
| `staging-only` | **Niet** playbook 04 → gebruik playbook **02** |

## Design / CSS parity

Productie gebruikt dezelfde `@pagayo/design` lockfile als CI/staging. Zonder publish + storefront bump is visuele parity **niet** aannemelijk. Zie release-playbook README — *Agent: ontbrekende design / CSS voorkomen*.

## DEPLOY_TOKEN audit (read-only)

```bash
for repo in pagayo-storefront pagayo-api-stack pagayo-edge pagayo-workflows; do
  echo "=== $repo ==="
  gh secret list --repo Pagayo/$repo | grep DEPLOY_TOKEN || true
done
```

Secret-waarde ≠ workflow `deploy_token` input; workflow-token staat alleen in vault playbook 04.

## Post-productie verificatie (storefront)

- Production tenant URL(s) uit STACK-MANIFEST / repo-docs.
- Headers-smoke en health volgens playbook **01** waar gedocumenteerd.
- Bij hot-path wijzigingen: overweeg gerichte checks (niet volledige perf-suite tenzij opgedragen).

## Mag niet (herhaling)

- Token roteren of naar andere repo's committen.
- Productie starten zonder expliciete thread-goedkeuring.
- `deploy_token`-waarde in chat, issues, logs of `pagayo-docs`.
