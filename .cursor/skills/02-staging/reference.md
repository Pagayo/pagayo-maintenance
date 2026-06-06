# Playbook 02 — Referentie (staging-only)

Canonieke bron: `pagayo-vault/.github/release-playbooks/02-staging.md`

## Pipeline (Workers-repos)

| Laag | Workflow | Inhoud |
|------|----------|--------|
| CI | `ci.yml` | lint, typecheck, workers-tests, client-tests (storefront o.a. **8 shards**), admin critical gate |
| Deploy | `deploy-cloudflare.yml` | preflight, **verify-ci-sha**, validate, migrate, deploy, smoke |

- Deploy draait **niet** opnieuw de volledige testmatrix; die zit in CI.
- `verify-ci-sha` wacht tot geslaagde CI op **dezelfde commit-SHA** (timeout ~30 min).

## Design / CSS parity

**Oorzaak:** storefront kan lokaal `../pagayo-design/dist` gebruiken; CI/Workers gebruiken **`node_modules/@pagayo/design`** uit de lockfile.

**Checklist (storefront):**

1. `pagayo-design`: tag `vX.Y.Z` op npm consistent met `origin/main`?
2. Storefront: lockfile-bump `@pagayo/design` na publish.
3. **`PAGAYO_DESIGN_SOURCE=node_modules npm run copy-design`** + commit **`src/workers/generated/design-asset-version.ts`** (en `public/design/**` indien gewijzigd).
4. Optioneel: `PAGAYO_DESIGN_READ_TOKEN=… npm run verify:design-npm-vs-git-tag`
5. **CI success** op exact de uit te rollen SHA.
6. Daarna pas `workflow_dispatch` staging-only.

Volledige keten: release-playbook README — secties *Agent: ontbrekende design / CSS voorkomen* en *Lokale pagayo-design/dist vs registry*.

## Performance mini-waterfall

Acceptatie voor catalogus-hot-path op staging:

- Geen `i18n-admin` chunk op webshop catalogus.
- Max één initial `/api/products` of `/api/products/first-paint`.
- Max één `/api/products/facets` en één `/api/products/featured-blog` per eerste filter-state.
- First product request start onder 1,5s op staging.
- Max één `/api/analytics/vitals` beacon.
- Geen tegenstrijdige `Cache-Control` op assets; hashed chunks immutable, vaste entrypoints revalideren.
- Publieke HTML toont `X-Response-Cache`, `X-Response-Cache-Version` en op miss `X-Origin-Latency`.

Maak op staging een **verse HAR** in schone browsercontext; hergebruik geen HAR met oude chunkhashes.

## DEPLOY_TOKEN audit (read-only)

```bash
for repo in pagayo-storefront pagayo-api-stack pagayo-edge pagayo-workflows; do
  echo "=== $repo ==="
  gh secret list --repo Pagayo/$repo | grep DEPLOY_TOKEN || true
done
```

`deploy_token` gebruik is **alleen** playbook 04 (productie), nooit in chat.

## Niet-lineair

- **02 vóór 03:** staging op `feature/batch-staging-…` terwijl PR naar `main` open staat is normaal.
- **Meerdere repo's:** herhaal stappen per repo.
- **Packages** (`pagayo-schema`, `pagayo-config`, `pagayo-design`): noteer `n.v.t.` + reden.

## Feature + D1-migratie op staging

Zie release-playbook README — sectie *Handmatige feature-test op staging (keten)* (o.a. `@pagayo/schema@latest` vóór migrate).
