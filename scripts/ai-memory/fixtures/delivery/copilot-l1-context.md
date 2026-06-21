<!-- GENERATED FILE - DO NOT EDIT MANUALLY -->

<!-- source: pagayo-vault/AI-OPERATING-CONTEXT.md -->

# AI Operating Context (L1)

> **DERIVED — DO NOT EDIT DIRECTLY.** Wijzig alleen via Promotion Pipeline.
> Operational SSoT for AI loading. Authoritative canon: WHY → STACK → NIVEAU → ADR → AGENTS.

Compacte operationele projectie voor AI-agents. Geen encyclopedie, geen versieboekhouding, geen chat-geheugen.

## Doel van dit bestand

L1 operational context: voorkom fundamentele fouten (missie, stack, commerce kernel, deploy/security) in elke sessie. Wijzigt alleen via Promotion Pipeline — nooit via mirror-backflow of directe rule-edit.

<!-- source: pagayo-docs/ai-decision-process/reviews/founder/2026-06-21-ai-memory-architecture-finalization.md -->

## Conflict-order

Bij tegenstrijdigheid geldt exact deze volgorde (boven wint):

```text
Code + tests > STACK-MANIFEST.md > PAGAYO-WHY.md > ADR (merged) > PAGAYO-NIVEAU.md > AI-OPERATING-CONTEXT.md (L1) > AGENTS.md > delivery mirrors > README / archive
```

Mirrors zijn transport, geen canon. PR-merge promoteert niet automatisch naar L1.

<!-- source: AGENTS.md -->

## Mission one-liner

```text
Commerce infrastructure for independents and the networks that serve them.
```

Pagayo is infrastructure — geen marketplace, ERP, CRM, generic business suite, social network of marketing automation platform.

<!-- source: pagayo-vault/PAGAYO-WHY.md#mission -->

## WHY stack

```text
Mission → Growth → Distribution → Product → Architecture → Build
```

- **Mission:** commerce infrastructure for independents and networks
- **Growth:** provision businesses; measure orders
- **Distribution:** first order is proof of adoption
- **Product:** Order First — every commercial action → Order
- **Architecture:** Order → Fulfillment on `orderId` / `orderItemId`
- **Build:** consistency, SSoT, testability, error handling, edge-first

<!-- source: pagayo-vault/PAGAYO-WHY.md#mission-stack -->

## Product Pillars

| # | Pijler | Kernregel |
|---|--------|-----------|
| 1 | **Order First** | Elke commerciële actie creëert, wijzigt of verwijst naar een Order |
| 2 | **Order → Fulfillment** | Alles na verkoop is fulfillment; anker op `orderId` / `orderItemId` |
| 3 | **Zero Friction Onboarding** | Nieuwe tenant live zonder assistentie; default path wint |
| 4 | **Two Steps To Create An Order** | Primaire verkoopflow wint boven extra beslissingen |
| 5 | **Make It Stupid Simple** | Minste concepten, schermen, settings en workflows wint |

<!-- source: pagayo-vault/PAGAYO-NIVEAU.md#pagayo-product-pillars--what-we-build -->

## Independent Access Test

Verplichte finish-toets (geen zesde pillar): een volledig blinde ondernemer moet zelfstandig product aanmaken → order ontvangen → order verwerken → betaling ontvangen. Core commerce-operaties moeten zonder zicht independently operabel zijn.

<!-- source: pagayo-vault/PAGAYO-NIVEAU.md#independent-access-test -->

## Build Pillars

| # | Pijler | Kernregel |
|---|--------|-----------|
| 1 | **Consistentie** | Elk component volgt hetzelfde pattern — AI moet kunnen voorspellen |
| 2 | **Testbaarheid** | Tests zijn de documentatie. Als de test slaagt, werkt het |
| 3 | **Foutafhandeling** | Geen stille failures — elk foutpad logt, elke error is zichtbaar |
| 4 | **SSoT** | Gedeelde logica op één plek (`@pagayo/config`, `@pagayo/schema`, `@pagayo/design`) |
| 5 | **Edge-First** | Cache API → KV → DB, nooit andersom |

<!-- source: pagayo-vault/PAGAYO-NIVEAU.md#18-pagayo-niveau--ontwikkelstandaard-build-pillars -->

## Stack Manifest samenvatting

Pagayo draait **100% op Cloudflare**: Workers/Pages, D1, KV, R2, Queues, Workflows, DNS/Access/WAF. GitHub + npm voor CI/packages. AWS SES alleen voor e-mail via `pagayo-api-stack`. Terraform in `pagayo-infra` voor Cloudflare IaC.

<!-- source: pagayo-vault/STACK-MANIFEST.md#kernregel -->

## Verboden stack (excerpt)

Nooit voorstellen als runtime/hosting/architectuur: GCP, Cloud Run, AWS compute (behalve SES), Azure, Vercel, Netlify, Heroku, Railway, Render, Kubernetes, Docker Compose, PostgreSQL, MySQL, MongoDB, Prisma, Neon, Hyperdrive, Redis, RabbitMQ. Drizzle ORM + `@pagayo/schema` zijn de enige DB-abstractions op D1.

<!-- source: pagayo-vault/STACK-MANIFEST.md#verboden-als-runtime-hosting-of-architectuursuggestie -->

## Platform model

```text
Pagayo (platform) → Organization (klant, betaalt factuur) → Tenant (eigen business-dataset, eigen D1)
```

Elke tenant heeft een eigen D1-database (`tenant-{id}`): orders, products, customers geïsoleerd per tenant.

<!-- source: pagayo-vault/PAGAYO-NIVEAU.md#hiërarchie-pagayo--organization--tenant -->

## Tenant isolation

- Platformdata: `PLATFORM_DB` (D1)
- API-data: `API_DB` (D1)
- Tenantdata: per tenant eigen D1 — nooit tenant/platform queries mengen zonder expliciete reden
- Schema: `@pagayo/schema` subpaths (`/platform`, `/tenant`, `/api`, `/shared`)

<!-- source: pagayo-vault/STACK-MANIFEST.md#databasebeleid -->

## Commerce kernel

**Order First:** één universeel Order-model; geen `WebOrder`/`POSOrder` subtypes; gebruik `Order.source` + `Order.originator`.

**Order → Fulfillment:** stock, shipping, subscriptions, bookings, digital delivery, returns, refunds en facturen zijn fulfillment artifacts op `orderId`/`orderItemId` — zie ADR-0005.

<!-- source: pagayo-vault/docs/adr/0005-order-fulfillment-artifacts.md -->

### Integration placement rule

- Storefront owns commerce kernel, tenant/admin UI and Order truth.
- API Stack owns external provider I/O on the Order → Fulfillment path.
- Solutions owns adjacent capabilities outside Pagayo core.
- Workflows orchestrate durable multi-step flows; they are not an integration home.
- Never place provider HTTP in Storefront.
- Never place adjacent ERP/CRM/BI/WMS/helpdesk logic in API Stack.

<!-- source: pagayo-docs/ai-decision-process/reviews/founder/2026-06-21-storefront-api-stack-solutions-boundary.md -->

## Never Build boundaries (excerpt)

Pagayo weigert core: ERP (procurement, WMS), logistics platform, accounting suite (GL, payroll), CRM/helpdesk suite, marketing automation platform, generic business platform. Wel toegestaan: order-afgeleide facturen, verzending, stockreservering, CSV/export naar externe systemen.

<!-- source: pagayo-vault/PAGAYO-NIVEAU.md#19-never-build--architecture-boundaries -->

## SSoT packages

| Package | Centraliseert |
|---------|---------------|
| `@pagayo/schema` | Drizzle D1 schema's (platform, tenant, api, shared) |
| `@pagayo/config` | Shared config, policy matrix, tenant settings parsers |
| `@pagayo/design` | Design tokens, component patterns, shared UI classes |

Versienummers leven in L2 (repo lockfiles) — niet in L1.

<!-- source: pagayo-vault/PAGAYO-NIVEAU.md#single-source-of-truth-ssot -->

## Repo landscape

| Repo | Primair doel |
|------|--------------|
| `pagayo-storefront` | Tenant storefront + platform admin |
| `pagayo-api-stack` | External provider I/O on Order → Fulfillment path |
| `pagayo-edge` | Edge cache/latency |
| `pagayo-workflows` | Durable workflows/orchestratie |
| `pagayo-marketing` | Marketing site (Astro) |
| `pagayo-design` | Shared design system |
| `pagayo-config` | Shared config package |
| `pagayo-schema` | Shared Drizzle D1 schema |
| `pagayo-maintenance` | Platform test- en smoke-suite |
| `pagayo-cloudflare-proxy` | `*.pagayo.com` ingress/redirects |
| `pagayo-vault` | Secrets + architectuurreferenties (local-only) |
| `pagayo-docs` | Werkvoorbereiding en procesdocs |

<!-- source: AGENTS.md -->

## Security rules

- Geen secrets, live keys, `.env`-waarden of PII in chat, commits, logs of samenvattingen
- `pagayo-vault` is local-only — nooit online/publiek behandelen
- MCP read/debug only waar script-first geen veiliger pad heeft
- Vault secrets alleen lezen wanneer taak dat expliciet vereist

<!-- source: pagayo-vault/AGENTS.md -->

## Local-Only Knowledge Boundary

`pagayo-vault` and local-only docs may inform local decisions, but online repos, CI, GitHub Actions, Copilot and Cloud Agent must never depend on reading them directly. Anything needed outside the local workspace must be provided as a secrets-free generated mirror, excerpt or delivery artifact.

Planning rule: every plan that references local-only sources must state whether the target execution context can access them. If not, the plan must use a generated mirror or remove the dependency.

<!-- source: pagayo-vault/STACK-MANIFEST.md#geheimenbeleid -->

## Stripe / payment safety

Stripe MCP: **read-first** (`stripe_api_read`, search, docs) — test mode prefereren. Connect: platform vs connected account expliciet. **Geen writes** (`stripe_api_write`, refunds, cancel, payouts) zonder expliciete opdracht Sjoerd in dezelfde thread + human approval. Nooit live keys in config/chat.

<!-- source: pagayo-docs/docs/MCP-STRATEGY.md -->

## Deploy policy

- NOOIT direct naar `main` pushen
- ALTIJD `feature/batch-staging-YYYYMMDD` (of repo-specifieke feature branch)
- Eerste rollout: `workflow_dispatch` + `deploy_mode=staging-only`
- Productie/main merge ALLEEN na expliciete goedkeuring Sjoerd in dezelfde thread
- Playbooks **00–04**: `pagayo-vault/.github/release-playbooks/`
- Pagayo skills (volgorde): `00-01-commit-push` → `02-staging` → `03-e2e-test-suites` → `04-production` → `05-founder-mode` → `06-red-team` → `07-operator-mode` → `08-steward-mode`
- Staging URL SSoT: `https://demo.staging.pagayo.app`

<!-- source: AGENTS.md -->

## Test policy

- TypeScript strict, geen `any`; geen `.skip`/`xit` voor oplevering
- Structured errors: `{ code, message, details? }`; API envelope `{ success, data?, error?, requestId }`
- Smoke/contract tests in `pagayo-maintenance` zijn leidend voor platformgedrag
- Schema/migratie-werk: `copilot-migration-check.sh` vóór commit

<!-- source: pagayo-maintenance/AGENTS.md -->

## AI Decision modes

Pre-build adversarial besluitvorming in **vier aparte chats** (+ optionele Steward-recurring):

1. **Founder** (`05-founder-mode`) — intentie en opties
2. **Red Team** (`06-red-team`) — adversarial review
3. **Operator** (`07-operator-mode`) — uitvoeringspad
4. **Steward** (`08-steward-mode`) — AI Memory, drift, promotion hygiene

Output is geen deploy-toestemming. Docs: `pagayo-docs/ai-decision-process/README.md`.

<!-- source: pagayo-docs/ai-decision-process/README.md -->

## Promotion rule

PR-merge ≠ learning. Kennis naar L1/L2 alleen via approved promotion candidate. Agents mogen draft candidates maken; **L1-beslissing: Sjoerd alleen**. Default: geen promotie. Wijzig L1 via canon-edit na approval, daarna generate mirrors + verify.

<!-- source: pagayo-docs/ai-decision-process/reviews/founder/2026-06-21-ai-memory-architecture-finalization.md -->

## Delivery layers

```text
CANON (WHY · STACK · NIVEAU · ADR · AGENTS · L1) → generate → DELIVERY MIRRORS (Cursor · Copilot · Cloud Agent)
```

Mirrors staan in `pagayo-docs/ai-memory/delivery/` — generated only, nooit handmatig wijzigen. Regenerate: `npm run ai-memory:generate` in `pagayo-maintenance`.

<!-- source: pagayo-docs/ai-decision-process/reviews/founder/2026-06-21-ai-memory-architecture-finalization.md -->
