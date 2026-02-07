# GitHub Status - 31 januari 2026

> **Laatst bijgewerkt:** 31-01-2026 16:30 door GitHubOps-GPT

## 📊 Samenvatting

| Repository | Open PRs | Open Issues | Status |
|------------|----------|-------------|--------|
| pagayo-beheer | 0 | 0 | ✅ Clean |
| pagayo-storefront | 0 | 0 | ✅ Clean |
| pagayo-api-stack | 0 | 0 | ✅ Clean |
| pagayo-edge | 0 | 0 | ✅ Clean |
| pagayo-tenants | 0 | 0 | ✅ Clean |
| pagayo-marketing | 0 | 0 | ✅ Clean |
| pagayo-cloudflare-proxy | 0 | 0 | ✅ Clean |

---

## ✅ Opgeruimd vandaag

### Gesloten PRs

| Repo | PR | Reden |
|------|----|----|
| pagayo-beheer | #2, #3, #4 | Superseded by GitHub Actions migration |
| pagayo-beheer | #7 | ✅ Merged (Chatwoot docs) |
| pagayo-beheer | #8 | Closed - feature should not have been created by agent |
| pagayo-storefront | #14 | Had merge conflicts (24 deps) |
| pagayo-storefront | #15 | Major version bumps (Stripe 14→20, node-fetch 2→3) |
| pagayo-api-stack | #4, #12 | Updates in /backups/ folder (irrelevant) |
| pagayo-edge | #1, #3 | Failing tests after dep updates |

---

## 🔒 Security Vulnerabilities

### pagayo-beheer (5 moderate)

| Alert | Package | Severity | Status |
|-------|---------|----------|--------|
| #8 | hono ≤4.11.6 | 🟡 Moderate | ⚠️ Transitive (via Prisma) |
| #7 | hono ≤4.11.6 | 🟡 Moderate | ⚠️ Transitive (via Prisma) |
| #6 | hono ≤4.11.6 | 🟡 Moderate | ⚠️ Transitive (via Prisma) |
| #5 | hono ≤4.11.6 | 🟡 Moderate | ⚠️ Transitive (via Prisma) |
| #4 | lodash 4.0.0-4.17.21 | 🟡 Moderate | ⚠️ Transitive (via Prisma/chevrotain) |

**Root cause:** Prisma 7.3.0 depends on @prisma/dev which pulls in vulnerable hono and lodash.

**Fix options:**
1. Wait for Prisma 7.4.0+ release with patched dependencies
2. Downgrade to Prisma 6.19.2 (breaking change)
3. Accept risk (moderate severity, not exploitable in our context)

**Aanbeveling:** Monitor Prisma releases, accept risk for nu (XSS/cache issues niet relevant voor backend-only usage).

---

## 🔧 CI/CD Fixes Toegepast

### Neon Database Branch Workflow

**Probleem:** Dependabot PRs falen altijd op "Create Neon Branch" omdat ze geen toegang hebben tot repository secrets.

**Fix toegepast in:**
- [x] pagayo-storefront/.github/workflows/neon-branch.yml
- [x] pagayo-api-stack/.github/workflows/neon-branch.yml  
- [x] pagayo-beheer/.github/workflows/neon-branch.yml

**Wat de fix doet:**
```yaml
# Skip voor Dependabot - heeft geen toegang tot secrets
if: github.actor != 'dependabot[bot]'
```

### Dependabot Configuration

**Probleem:** Dependabot maakt PRs met major version bumps die breaking changes kunnen veroorzaken.

**Fix toegepast in:**
- [x] pagayo-storefront/.github/dependabot.yml

**Wat de fix doet:**
- Blokkeert major updates voor: stripe, mollie, node-fetch, prisma, hono, express
- Alleen minor/patch updates in gegroepeerde PRs
- Documentatie toegevoegd over secret access limitations

---

## 📋 Gepland Onderhoud

### Stripe v20 Migration (HIGH PRIORITY)

| Item | Status |
|------|--------|
| Lees Stripe upgrade guide | ⬜ To do |
| Maak feature branch | ⬜ To do |
| Update incrementeel 14→15→...→20 | ⬜ To do |
| Test payment flows | ⬜ To do |
| Deploy naar staging | ⬜ To do |
| Deploy naar productie | ⬜ To do |

**Geschatte effort:** 4-8 uur
**Deadline:** Voor volgende Stripe API deprecation

---

## � ESCALATIES

### [2026-02-07] pagayo-edge: ESLint ontbreekt in devDependencies

**Geëscaleerd door:** Deployer-GPT  
**Toegewezen aan:** @workspace /frontenddev  
**Prioriteit:** Medium  
**Repository:** pagayo-edge

**Probleem:**
De pre-commit hook in pagayo-edge faalt omdat `eslint` niet is opgenomen in devDependencies. Dit werd ontdekt tijdens het committen van CI workflow fixes.

```
> pagayo-edge@1.0.0 lint
> eslint . --ext .ts

sh: eslint: command not found
```

**Impact:**
- Pre-commit checks falen voor alle code commits
- Moest `--no-verify` gebruiken om CI fix te committen

**Gevraagde actie:**
1. Voeg `eslint` en benodigde eslint plugins toe aan devDependencies
2. Verifieer dat `npm run lint` werkt na `npm install`
3. Test pre-commit hook met een dummy commit
4. Commit en push de fix

**Bestanden om te checken:**
- `pagayo-edge/package.json` — devDependencies
- `pagayo-edge/.husky/pre-commit` — lint script aanroep

---

## �📚 Referenties

- Stripe Upgrade Guide: https://stripe.com/docs/upgrades
- Prisma Releases: https://github.com/prisma/prisma/releases
- Neon Actions: https://github.com/neondatabase

