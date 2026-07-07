# Pagayo Slack Development Hub V1

## Doel

Slack wordt in fase 1 een centrale ontwikkel- en operations-cockpit voor Pagayo, niet de bron van waarheid. GitHub, Cloudflare, Stripe, Cursor en tenant-feedback blijven hun eigen waarheid houden. Slack bundelt alleen compacte signalen zodat founder, architect en reviewer sneller zien waar aandacht nodig is.

Fase 1 start bewust klein: alleen GitHub/development events naar Slack, via GitHub Actions en Slack Incoming Webhooks.

## Principes

- Slack is signalering en triage, geen beslissysteem.
- GitHub blijft de waarheid voor PR-status, reviews, checks, merges en deployment runs.
- Cloudflare blijft de waarheid voor runtime/deployment observability.
- Stripe blijft de waarheid voor billing/payment state.
- Geen code, grote diffs, secrets of tenantdata in Slack-meldingen.
- Geen event-bus, database, AI Control Center of Slack bot in fase 1.
- Notificaties moeten kort, scanbaar en actiegericht zijn.
- De reusable workflow blijft volledig generiek: alleen expliciete inputs formatteren en posten.

## Minimale Channel-Structuur

### `#pagayo-founder`

Doel: founder-level overzicht en beslispunten.

Gebruik:
- Samenvattingen van belangrijke release/deployment status.
- Blokkerende risico's die product-, klant- of planningimpact hebben.
- Geen ruwe CI-logs of low-level PR updates.

### `#pagayo-dev`

Doel: dagelijks ontwikkeloverzicht.

Gebruik:
- Korte signalen over actieve branches en work-in-progress.
- Niet-blokkerende technische context.
- Eventueel later Cursor session summaries.

### `#pagayo-github`

Doel: GitHub PR- en repo-signalen.

Gebruik:
- PR opened.
- PR updated.
- PR merged.
- Link altijd terug naar GitHub.

### `#pagayo-reviews`

Doel: reviewpakketten en architectuurreview.

Gebruik:
- AI Review Package summaries.
- Handmatige reviewvragen.
- Geen volledige diffs; alleen links en samenvatting.

### `#pagayo-deployments`

Doel: deployment flow en incidentgevoelige signalen.

Gebruik:
- Deployment started.
- Deployment succeeded.
- Deployment failed.
- Link altijd naar GitHub Actions run of Cloudflare deployment details.

### `#pagayo-feedback`

Doel: tenant/user feedback signalering.

Gebruik:
- In fase 1 alleen kanaalreservering en formatvoorbereiding.
- Nog geen automatische ingest of tenant-feedback routing.

## GitHub Naar Slack Events

| Event | Bron | Kanaal | Trigger | Waarheid |
| --- | --- | --- | --- | --- |
| PR opened | GitHub pull_request | `#pagayo-github` | `opened`, `reopened`, `ready_for_review` | GitHub PR |
| PR updated | GitHub pull_request | `#pagayo-github` | `synchronize`, title/body update, review-ready update | GitHub PR |
| PR merged | GitHub pull_request | `#pagayo-github` | `closed` met `merged == true` | GitHub PR |
| Deployment started | GitHub Actions | `#pagayo-deployments` | start deploy job | GitHub Actions run |
| Deployment succeeded | GitHub Actions | `#pagayo-deployments` | deploy job success | GitHub Actions run + Cloudflare |
| Deployment failed | GitHub Actions | `#pagayo-deployments` | deploy job failure/cancelled | GitHub Actions run + Cloudflare |

Fase 1 gebruikt GitHub Actions caller workflows per repo. Er komt nog geen centrale org-wide listener en geen eigen event ingestion service.

## Compact Slack Message Format

Alle meldingen volgen hetzelfde basiscontract. De caller workflow levert de inhoud expliciet aan; de reusable workflow leidt geen domeinen, risico of beslissingen zelf af.

```text
[{event_type}] {repo}
Branch: {branch}
Link: {pr_or_deployment_link}
Summary: {short_summary}
Domains: {changed_domains_or_unknown}
Tests: {test_status_or_unknown}
Risk: {risk_low_medium_high_or_unknown}
Next: {recommended_next_action}
```

### PR Opened

```text
[PR opened] pagayo-storefront
Branch: feature/admin-print-flow
Link: https://github.com/Pagayo/pagayo-storefront/pull/123
Summary: Adds admin print flow for subscription holders.
Domains: admin, subscriptions, print
Tests: pending
Risk: medium
Next: Wait for CI, then architecture review.
```

### PR Updated

```text
[PR updated] pagayo-api-stack
Branch: fix/d1-migration-guard
Link: https://github.com/Pagayo/pagayo-api-stack/pull/88
Summary: Refines migration guard after review feedback.
Domains: database, deploy
Tests: CI running
Risk: high
Next: Review migration impact before merge.
```

### PR Merged

```text
[PR merged] pagayo-maintenance
Branch: feature/release-manifest-guard
Link: https://github.com/Pagayo/pagayo-maintenance/pull/42
Summary: Adds stricter release-manifest validation.
Domains: deploy, governance
Tests: CI passed
Risk: low
Next: Monitor next staging deploy.
```

### Deployment Started

```text
[deployment started] pagayo-storefront
Branch: main
Link: https://github.com/Pagayo/pagayo-storefront/actions/runs/123456
Summary: Staging deploy started from verified CI SHA.
Domains: storefront, admin
Tests: CI passed
Risk: medium
Next: Wait for staging smoke result.
```

### Deployment Succeeded

```text
[deployment succeeded] pagayo-workflows
Branch: main
Link: https://github.com/Pagayo/pagayo-workflows/actions/runs/123456
Summary: Staging deployment and health check completed.
Domains: workflows
Tests: deploy health check passed
Risk: low
Next: Update release manifest or prepare production gate if needed.
```

### Deployment Failed

```text
[deployment failed] pagayo-api-stack
Branch: main
Link: https://github.com/Pagayo/pagayo-api-stack/actions/runs/123456
Summary: Production deployment blocked during D1 migration.
Domains: api, database, deploy
Tests: migration failed
Risk: high
Next: Inspect workflow logs; do not retry production before root cause is known.
```

## Risico-Indicatie

De risico-indicatie is een expliciete input van de caller of agent. De reusable workflow bepaalt dit niet zelf.

Aanbevolen waarden:
- `low`: documentatie, tests, kleine interne refactor, geen runtime impact.
- `medium`: user-facing wijziging, deploy/config wijziging, beperkte API-impact.
- `high`: database/migratie, auth, billing, tenant isolation, production deploy, rollbackgevoelig.
- `unknown`: onvoldoende context; menselijke review nodig.

## Gewijzigde Domeinen

Ook domeinen zijn expliciete input. Een caller kan ze later afleiden uit labels, changed file paths of een Cursor-generated package, maar die afleiding hoort niet in de reusable Slack workflow.

Aanbevolen domeinwoorden:
- `admin`
- `api`
- `database`
- `deploy`
- `storefront`
- `workflows`
- `tenant-config`
- `billing`
- `auth`
- `feedback`
- `docs`
- `unknown`

## AI Review Package

Cursor kan na een implementatie een AI Review Package genereren voor `#pagayo-reviews`. Dit pakket is bedoeld om naar ChatGPT te kopiëren voor architectuurreview. Het pakket blijft compact en bevat geen volledige diff.

```markdown
# AI Review Package

## Doel Van De Wijziging

<Waarom is deze wijziging gedaan? Welk probleem lost dit op?>

## Gewijzigde Bestanden Per Domein

### <domein>

- `<pad>`: <korte beschrijving>

## Database / Migratie-Impact

- Impact: none | read-only | schema change | data migration | unknown
- Details: <korte toelichting>
- Rollback: <indien relevant>

## API-Impact

- Impact: none | internal only | public contract change | unknown
- Details: <routes, RPC, payloads of contracts>

## Frontend / Admin-Impact

- Impact: none | visible UI | admin workflow | storefront workflow | unknown
- Details: <korte toelichting>

## Tests Uitgevoerd

- `<commando>` -> <resultaat>

## Bekende Risico's

- <risico of `none known`>

## Open Vragen

- <vraag of `none`>

## Advies

ready | needs review | blocked

Korte motivatie: <1-3 zinnen>
```

## Reusable Workflow Contract

De reusable workflow in `pagayo-maintenance` mag alleen dit doen:

1. Inputs valideren op aanwezigheid.
2. Een compacte Slack payload formatteren.
3. Posten naar de meegegeven Slack Incoming Webhook secret.
4. Optioneel een dry-run payload printen zonder webhook-call.

De workflow mag dit niet doen:

- Geen Pagayo-businesslogica.
- Geen tenantlogica.
- Geen AI-beslissingen.
- Geen hardcoded domeinregels.
- Geen branch-, repo- of environment policy afdwingen.
- Geen GitHub API calls om context te verrijken.
- Geen changed-file analyse.
- Geen teststatus afleiden.

Caller workflows zijn verantwoordelijk voor:

- Welk event wordt gemeld.
- Welk webhook secret wordt doorgegeven.
- Welke domeinen, teststatus, risico en volgende actie in de melding komen.
- Of een dry-run of echte post wordt uitgevoerd.

## Pilot-Guidance

Start met een beperkte pilot. Rol nog niets breed uit.

Aanbevolen volgorde:

1. Voeg de generieke reusable workflow toe in `pagayo-maintenance`.
2. Test eerst handmatig met `dry_run: true` via een kleine caller of workflow-dispatch.
3. Voeg daarna in precies één repo een caller job toe voor deployment events.
4. Gebruik daarna pas PR events voor één repo, bij voorkeur `pagayo-maintenance` of `pagayo-storefront`.
5. Breid pas uit naar andere repos als het format nuttig blijkt en niet te veel ruis geeft.

Voorbeeld caller voor een deployment-success event:

```yaml
jobs:
  notify-slack:
    if: success()
    uses: Pagayo/pagayo-maintenance/.github/workflows/reusable-slack-notify.yml@main
    with:
      event_type: deployment succeeded
      repo: ${{ github.event.repository.name }}
      branch: ${{ github.ref_name }}
      link: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
      summary: Staging deployment completed.
      domains: deploy
      test_status: deployment checks passed
      risk: low
      next_action: Monitor staging smoke tests.
      dry_run: false
    secrets:
      slack_webhook_url: ${{ secrets.SLACK_WEBHOOK_PAGAYO_DEPLOYMENTS }}
```

Voorbeeld caller voor een PR-opened event:

```yaml
jobs:
  notify-slack:
    if: github.event.pull_request.draft == false
    uses: Pagayo/pagayo-maintenance/.github/workflows/reusable-slack-notify.yml@main
    with:
      event_type: PR opened
      repo: ${{ github.event.repository.name }}
      branch: ${{ github.head_ref }}
      link: ${{ github.event.pull_request.html_url }}
      summary: ${{ github.event.pull_request.title }}
      domains: unknown
      test_status: pending
      risk: unknown
      next_action: Wait for CI and assign reviewer.
      dry_run: false
    secrets:
      slack_webhook_url: ${{ secrets.SLACK_WEBHOOK_PAGAYO_GITHUB }}
```

## Benodigde Secrets

Minimaal:

- `SLACK_WEBHOOK_PAGAYO_GITHUB`: Slack Incoming Webhook voor GitHub/PR-signalen.
- `SLACK_WEBHOOK_PAGAYO_DEPLOYMENTS`: Slack Incoming Webhook voor deploysignalen.

Optioneel later:

- `SLACK_WEBHOOK_PAGAYO_REVIEWS`: Slack Incoming Webhook voor reviewpakket-samenvattingen.
- `SLACK_WEBHOOK_PAGAYO_FEEDBACK`: Slack Incoming Webhook voor tenant-feedback signalen.

Secret-regels:

- Webhook URLs nooit loggen.
- Webhook URLs alleen als GitHub Actions secrets bewaren.
- Geen Slack webhook hardcoden in YAML, docs of scripts.
- Geen echte test-post zonder expliciete toestemming.

## Wat We Nu Niet Bouwen

- Geen Slack bot.
- Geen slash commands.
- Geen interactieve approvals vanuit Slack.
- Geen AI Control Center.
- Geen centrale event database.
- Geen tenant-feedback pipeline.
- Geen automatische domeinclassificatie in de reusable workflow.
- Geen automatische risico-inschatting in de reusable workflow.
- Geen org-wide GitHub App of webhook receiver.
- Geen Cloudflare Worker voor Slack routing.
- Geen code/diff dumps in Slack.

## Risico's

- Ruis: te veel PR updates kunnen Slack minder bruikbaar maken.
- Secret sprawl: meerdere repos hebben webhook secrets nodig als callers daar direct draaien.
- Format drift: callers kunnen verschillende woorden gebruiken voor risico of domeinen.
- False confidence: Slack-meldingen zijn samenvattingen, niet de waarheid.
- Missing context: teststatus of domeinen kunnen `unknown` zijn als caller ze niet expliciet aanlevert.
- Webhook lifecycle: Slack webhook rotatie moet in GitHub secrets worden bijgehouden.

Mitigaties:

- Start met één repo en één of twee eventtypes.
- Houd risk/domains vocabulary klein en documenteer die hier.
- Link altijd naar GitHub als bron.
- Gebruik `dry_run: true` bij eerste tests.
- Review notificatieruis na de pilot voordat er brede rollout komt.

## V2 — Storefront Development Pilot

V2 maakt Slack expliciet **development-only**. Slack is in deze fase geen operations hub.

### Development-loop

```text
Cursor/GitHub -> Slack -> ChatGPT review -> Cursor
```

### Wat V2 wel doet

- PR opened / updated / merged signalen vanuit `pagayo-storefront`.
- Release/deploy started / succeeded / failed signalen vanuit de bestaande deploy workflow.
- Verplicht AI Review Package in de storefront PR-template.
- Centrale formatting blijft in `pagayo-maintenance` via `reusable-slack-notify.yml`.

### Wat V2 niet doet

- Geen tenant-feedback.
- Geen Stripe-integratie.
- Geen Cloudflare errors of runtime observability.
- Geen production monitoring.
- Geen supportmeldingen.
- Geen business events.
- Geen AI Control Center.
- Geen echte Slack-post zolang callers `dry_run: true` gebruiken.

### Storefront caller workflows

| Workflow | Repo | Events | Webhook secret |
| --- | --- | --- | --- |
| `slack-pr-notify.yml` | `pagayo-storefront` | PR opened, updated, merged | `SLACK_WEBHOOK_PAGAYO_GITHUB` |
| `deploy-cloudflare.yml` jobs | `pagayo-storefront` | deployment started/succeeded/failed | `SLACK_WEBHOOK_PAGAYO_DEPLOYMENTS` |

Alle callers:

- gebruiken `Pagayo/pagayo-maintenance/.github/workflows/reusable-slack-notify.yml@main`;
- leveren expliciete inputs (`domains: unknown`, `risk: unknown` tenzij later handmatig verrijkt);
- hebben `dry_run: true` hardcoded in de eerste pilot.

### Benodigde secrets in `pagayo-storefront`

- `SLACK_WEBHOOK_PAGAYO_GITHUB`
- `SLACK_WEBHOOK_PAGAYO_DEPLOYMENTS`

### Activatie naar echte posts

1. Secrets aanmaken in GitHub voor `pagayo-storefront`.
2. Eén caller tegelijk van `dry_run: true` naar `dry_run: false` zetten.
3. Eén PR-cycle en één deploy-cycle observeren.
4. Pas daarna overwegen om een tweede repo toe te voegen.

### Rollout-criteria

De pilot is pas veilig breder uit te rollen als:

- payloads in dry-run bruikbaar en niet te ruisachtig zijn;
- AI Review Package consequent in PR's staat;
- geen CI-regressie is geïntroduceerd;
- expliciet akkoord is gegeven voor echte Slack-posts.

## Groeipad Naar AI Operations

Fase 1 levert alleen het message contract en een generieke transportstap. Dat kan later doorgroeien zonder nu een groot systeem te bouwen.

Mogelijke vervolgstappen:

1. Herbruikbare caller snippets per eventtype documenteren.
2. Een Cursor-generated AI Review Package standaardiseren in PR descriptions.
3. Labels of CODEOWNERS gebruiken om domeinen consistenter aan te leveren.
4. Deployment summaries koppelen aan release-manifest status.
5. Tenant-feedback later naar `#pagayo-feedback` sturen met privacyfiltering.
6. Een echte AI Operations-laag pas bouwen als er genoeg bewezen signalen en workflows zijn.

Een latere AI Operations-laag mag beslissingen ondersteunen, maar niet stilzwijgend overnemen. GitHub, Cloudflare, Stripe en productdata blijven de autoritatieve systemen.
