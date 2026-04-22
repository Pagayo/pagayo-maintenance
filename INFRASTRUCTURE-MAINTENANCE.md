# 🏗️ Pagayo Infrastructure Maintenance

**Laatst bijgewerkt:** 29 maart 2026

---

## 🌐 Infrastructure Componenten

### Cloudflare Workers

| Worker | Domein | Functie | Status Check |
|--------|--------|---------|--------------|
| pagayo-storefront (platform routes) | admin.pagayo.app | Platform admin | `/api/platform/health` (achter CF Access) |
| pagayo-storefront | *.pagayo.app | Tenant shops | `/api/health` |
| pagayo-api-stack | api.pagayo.com | REST API | `/api/health` |
| pagayo-edge | edge.pagayo.app | Edge functions | `/api/rate-limit/health` |
| pagayo-workflows | workflows.pagayo.app | Workflow API | `/health` (plus trusted `/api/workflows/*`) |
| pagayo-cloudflare-proxy | beheer/app/edge → Workers | Route proxy | Status 200 |

### Cloudflare Services

| Service | Functie | Check methode |
|---------|---------|---------------|
| Cloudflare Pages | pagayo-marketing | www.pagayo.com status |
| Cloudflare Access (Zero Trust) | Authenticatie | Access bypass validation |
| Cloudflare DNS | Domein routing | DNS lookup |
| Cloudflare Cache | Static assets | Cache headers |

### Databases

| Database | Locatie | Project | Status Check |
|----------|---------|---------|--------------|
| Neon Beheer | eu-central-1 | pagayo-production | Via Worker health |
| Neon Storefront | eu-central-1 | pagayo-storefront-prod | Via Worker health |
| Neon API | eu-central-1 | pagayo-api-prod | Via Worker health |

---

## ✅ Cloudflare Access & Trusted-Caller Policies

**KRITIEK:** Auth contracts moeten expliciet blijven per routegroep (CF Access, API key, X-Edge-Secret).

| Path | Application ID | Reden | Aangemaakt |
|------|---------------|-------|------------|
| `/api/platform/*` | n.v.t. (CF Access app) | Platform admin achter Access | Actief |
| `/api/provisioning/*` | n.v.t. (API key) | Provisioning alleen API key/service binding | Actief |
| `/api/rate-limit/*` (edge) | n.v.t. (trusted caller) | Alleen `X-Edge-Secret` of admin bearer | Actief |
| `/api/workflows/*` | n.v.t. (trusted caller) | Alleen `X-Edge-Secret` | Actief |
| `/api/capabilities/features` | `567818a4-...` | Legacy (archived beheer) | Historisch |

### Source of Truth

De definitieve configuratie staat in:
```
pagayo-beheer/cloudflare/access-policies.json
```
Voor huidige runtime-contracten zijn `pagayo-storefront`, `pagayo-edge` en `pagayo-workflows` leidend.

### Nieuwe bypass toevoegen

1. Voeg toe aan `access-policies.json`
2. Run: `npx tsx scripts/sync-access-policies.ts`
3. Of maak handmatig in Cloudflare Dashboard → Zero Trust → Access → Applications

---

## 🧪 Smoke Tests

### Waar staan de tests?

`pagayo-maintenance/tests/smoke/`

### Hoe runnen?

```bash
# In pagayo-maintenance directory:
npm run test:smoke

# Of specifieke test:
npx vitest run tests/smoke/edge-provisioning-contracts.test.ts
```

### Wat checken de tests?

| Test Suite | Checks |
|------------|--------|
| Health Endpoints | Alle /health en /api/health endpoints |
| Cloudflare Access & Trusted caller | Protected routes fail-closed zonder juiste auth |
| Worker Routes | Correcte routing via proxy |
| DNS | Alle domeinen resolven |
| SSL | Certificaten geldig |
| Registration Flow | Complete flow e2e |

---

## 🚨 Bekende Issues en Workarounds

### Issue: RPC calls falen met "Service binding not found"

**Symptoom:** `TenantService.startProvisioning()` failed: binding 'WORKFLOWS' undefined

**Oorzaak:** Service bindings in wrangler.toml missen of verkeerde naam.

**Fix:** Controleer `wrangler.toml`:
```toml
[[services]]
binding = "WORKFLOWS"
service = "pagayo-workflows"
entrypoint = "ProvisioningHandler"
```

### Issue: 401 op endpoint dat intern/trusted moet zijn

**Symptoom:** 401 "Unauthorized" op edge/workflow calls vanuit interne services.

**Oorzaak:** Cloudflare Access (Zero Trust) blokkeert de request VOORDAT de Worker bereikt wordt.

**Fix:**
1. Controleer of caller de juiste auth meestuurt (`X-Edge-Secret` of admin bearer)
2. Controleer secrets/config in worker environment
3. Run smoke tests: `npm run test:smoke`

### Issue: app.pagayo.com geeft 404

**Symptoom:** app.pagayo.com/registreer werkt niet, 404 error.

**Oorzaak:** pagayo-cloudflare-proxy routeert niet naar Cloudflare Pages.

**Fix:** Voeg app.pagayo.com toe in `pagayo-cloudflare-proxy/src/index.js`

---

## 📅 Maintenance Schedule

| Frequentie | Taak | Commando/Actie |
|------------|------|----------------|
| **Dagelijks** | (Automated) Health checks | GitHub Actions workflow |
| **Dagelijks** | (Automated) Cloudflare token expiry monitor | GitHub Actions `cloudflare-token-monitor.yml` |
| **Wekelijks** | Smoke tests handmatig | `npm run test:smoke` in beheer |
| **Maandelijks** | Cloudflare Access policies review | Check dashboard vs access-policies.json |
| **Kwartaal** | SSL certificaten check | Cloudflare auto-renews, maar controleer |

---

## 🔧 Maintenance Scripts

| Script | Locatie | Functie |
|--------|---------|---------|
| `sync-secrets.sh` | `pagayo-maintenance/scripts/` | Secrets naar Workers |
| `token-expiry-check.mjs` | `pagayo-maintenance/scripts/cloudflare/` | Cloudflare API token status + expiry thresholds |
| `sync-access-policies.ts` | `pagayo-beheer/scripts/` | Access policies naar Cloudflare |
| `health-check.sh` | `pagayo-maintenance/scripts/` | Quick health check alle domeinen |

### Cloudflare Token Monitor (handmatig)

```bash
cd /Users/sjoerdoverdiep/my-vscode-workspace/pagayo-maintenance
npm run cloudflare:token:check:json
```

Escalatiebeleid:
- `severity=critical` of `severity=emergency`: direct rotatie starten.
- `severity=high`: zelfde dag rotatie plannen.

---

## 📝 Incident Log

### 8 februari 2026 - Registratie flow broken (historisch)

**Symptoom:** "Provisioning is mislukt" error bij registreren op beheer.pagayo.com

**Root cause:** Meerdere lagen:
1. ~~auth.routes.ts gebruikte legacy HTTP provisioning ipv RPC~~ (fixed)
2. ~~Workflow routes stonden NA authMiddleware~~ (fixed)
3. **Cloudflare Access blokkeerde /api/workflows** (ROOT CAUSE)
4. **Cloudflare Access blokkeerde /api/capabilities/features**

**Fix:** Access bypass apps aangemaakt voor beide routes.

**Prevention:** Smoke tests toegevoegd die productie endpoints valideren.

---

## 📊 Monitoring Dashboard

### Quick Status Check (copy-paste in terminal)

```bash
# Health checks
curl -s -o /dev/null -w "%{http_code}" https://admin.pagayo.app/api/platform/health
curl -s -o /dev/null -w "%{http_code}" https://api.pagayo.com/api/health
curl -s -o /dev/null -w "%{http_code}" https://test-3.pagayo.app/api/health
curl -s -o /dev/null -w "%{http_code}" https://www.pagayo.com

# Fail-closed checks (moeten 401 geven zonder trusted auth)
curl -s -o /dev/null -w "%{http_code}" -X POST https://edge.pagayo.app/api/rate-limit/check -H "content-type: application/json" -d '{"identifier":"smoke","type":"ip"}'
curl -s -o /dev/null -w "%{http_code}" https://workflows.pagayo.app/api/workflows/order/create
```

---

**Laatst bijgewerkt:** 29 maart 2026

*Dit bestand wordt bijgehouden door Copilot. Vraag "Infrastructure health check" om status te krijgen.*
