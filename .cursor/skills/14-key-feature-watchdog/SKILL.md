---
name: 14-key-feature-watchdog
description: Diagnoses and prepares fixes when hourly key-feature smoke fails (Stripe first; later email/shipping/Mollie). Trigger phrases: key-feature smoke rood, Stripe alarm, smoke:key-features failed, key feature watchdog. No deploy, no Stripe writes, no push without explicit Sjoerd ask.
---

# Skill 14 — Key-feature watchdog

Canon: `pagayo-maintenance` `npm run smoke:key-features`  
Staging URL: `https://demo.staging.pagayo.app`  
MCP: Cloudflare Observability (read) · Stripe MCP **read-first** (test mode)

**Invariant:** geen `git push`, geen staging/prod deploy, geen Stripe writes (refunds/cancel/payouts), geen secrets in chat. Productie-herstel alleen via skill **04** na expliciete `go`.

## Harde regels

- Script-first: eerst `npm run smoke:key-features` (of parse meegeleverde JSON-regels).
- Alarm = diagnose + fix-branch klaarzetten — **niet** zelf deployen.
- Stripe MCP: alleen read (`stripe_api_read` / search / docs). Geen `stripe_api_write` / `create_refund`.
- Push alleen op expliciete Sjoerd-vraag (playbook 01).

## Trigger → actie

| Sjoerd / automation zegt | Agent doet |
|--------------------------|------------|
| key-feature smoke rood / Stripe alarm / smoke:key-features failed | Standaardflow hieronder |
| alleen opnieuw smoke draaien | `npm run smoke:key-features` → rapport JSON |
| prod herstel nodig | Stop; vraag `go` → skill 04 |
| staging fix deployen | Alleen na Sjoerd-vraag → skill 02 |

## Standaardflow

```
Task Progress:
- [ ] 1. Parse JSON-regels (stdout) of her-run `npm run smoke:key-features` in pagayo-maintenance
- [ ] 2. Per status=fail: diagnose (Observability + Stripe read-first)
- [ ] 3. Korte oorzaak-analyse (één alinea)
- [ ] 4. Fix-branch + tests in de juiste repo (geen deploy)
- [ ] 5. Rapport: feature · code · oorzaak · branch · voorgestelde actie voor Sjoerd
```

### Stap 1 — Parse resultaten

Elke stdout-regel is JSON:

```json
{ "feature": "stripe", "status": "pass|fail|skip", "code": "STRIPE_OK", "message": "..." }
```

- `fail` → diagnose
- `skip` (bijv. `AUTH_REQUIRED`) → alarm op secrets/cookie, geen productbug
- `pass` → negeer

### Stap 2 — Diagnose per feature

**stripe**

1. Cloudflare Observability MCP — filter `$metadata.service` ≈ `pagayo-storefront-staging` / `pagayo-api-stack-staging`; timeframe laatste uur; zoek `requestId` / `STRIPE_*` / `CONFIGURATION_ERROR`.
2. Stripe MCP read-first (test mode) — account retrieve, recente events, webhook delivery indien relevant.
3. Check tenant setting `stripeAccountId` / `stripeMode=TEST` op staging demo (niet secrets dumpen).

**latere features** (email / shipping / mollie): zelfde patroon — Observability + feature-specifieke read MCP/API.

### Stap 3 — Fix-branch

- Juiste repo (meestal `pagayo-storefront` of `pagayo-api-stack`).
- Kleine, geteste wijziging; commit lokaal alleen als Sjoerd commit vraagt.
- **Geen** `deploy:staging` / productie zonder expliciete opdracht.

### Stap 4 — Rapport (manager-taal)

```
Key-feature: ❌/✅
Feature: stripe (of …)
Code: …
Oorzaak: …
Branch: … (of geen code-fix — config/secret)
Voorstel: …
```

## Escalatie

| Situatie | Skill |
|----------|-------|
| Staging deploy van fix | `02-staging` (expliciete vraag) |
| Productie | `04-production` + `go` |
| Commit only | `00-01-commit-push` |
| Lokale stack | `13-local-dev` |

## Secrets (automation)

Cursor-dashboard (niet in repo): `SMOKE_ADMIN_SESSION_COOKIE`, `SMOKE_STOREFRONT_URL` (default staging demo), later `API_INTERNAL_SERVICE_KEY`.
