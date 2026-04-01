# AGENTS - pagayo-maintenance

## Scope van deze repo
`pagayo-maintenance` is de centrale kwaliteits- en smoke-suite voor het hele platform.
Wijzigingen in andere repos moeten hier vaak worden gevalideerd.

## Leesvolgorde (verplicht)
1. `../AGENTS.md`
2. `../pagayo-vault/PAGAYO-NIVEAU.md`
3. `./README.md`

## Deploy Policy (Hard)
- NOOIT direct naar `main` pushen.
- ALTIJD eerst werken op `feature/batch-staging-YYYYMMDD`.
- ALTIJD eerst committen en pushen naar die staging-branch.
- Voor deploys: ALTIJD starten met `workflow_dispatch` en `deploy_mode=staging-only` waar ondersteund.
- Productie (`main` merge of `deploy_mode=full/production-only`) ALLEEN na expliciete goedkeuring van Sjoerd in dezelfde thread.
- Bij twijfel: stop en vraag Sjoerd.

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

Volledige suite:
```bash
npm run test:all
```
