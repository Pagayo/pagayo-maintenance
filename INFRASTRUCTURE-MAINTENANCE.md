# 🏗️ Pagayo Infrastructure Maintenance

**Laatst bijgewerkt:** 8 februari 2026

---

## 🌐 Infrastructure Componenten

### Cloudflare Workers

| Worker | Domein | Functie | Status Check |
|--------|--------|---------|--------------|
| pagayo-beheer | beheer.pagayo.com | Platform admin | `/api/health` |
| pagayo-storefront | *.pagayo.app | Tenant shops | `/api/health` |
| pagayo-api-stack | api.pagayo.com | REST API | `/health` |
| pagayo-edge | edge.pagayo.com | Edge functions | `/health` |
| pagayo-workflows | N/A (RPC only) | Background jobs | Via RPC |
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

## ✅ Cloudflare Access Bypass Policies

**KRITIEK:** Deze routes moeten PUBLIC zijn. Cloudflare Access blokt anders requests voordat ze de Worker bereiken!

| Path | Application ID | Reden | Aangemaakt |
|------|---------------|-------|------------|
| `/api/auth/register` | `0d1e...` | Registratie flow | Legacy |
| `/api/auth/session` | `0d1e...` | Session check | Legacy |
| `/api/auth/logout` | `0d1e...` | Uitloggen | Legacy |
| `/api/workflows/*` | `9a88691f-c16b-422b-8673-713a232979a6` | Registration polling | 8 feb 2026 |
| `/api/capabilities/features` | `567818a4-607a-4b89-8866-d869269a627f` | Plan features (public) | 8 feb 2026 |

### Source of Truth

De definitieve configuratie staat in:
```
pagayo-beheer/cloudflare/access-policies.json
```

### Nieuwe bypass toevoegen

1. Voeg toe aan `access-policies.json`
2. Run: `npx tsx scripts/sync-access-policies.ts`
3. Of maak handmatig in Cloudflare Dashboard → Zero Trust → Access → Applications

---

## 🧪 Smoke Tests

### Waar staan de tests?

```
pagayo-beheer/src/__tests__/smoke/
├── public-routes.smoke.test.ts    # Public vs protected routes
└── infrastructure.smoke.test.ts   # Full infrastructure check
```

### Hoe runnen?

```bash
# In pagayo-beheer directory:
npm run test:smoke

# Of specifieke test:
SMOKE_TEST=true npx vitest run src/__tests__/smoke/public-routes.smoke.test.ts
```

### Wat checken de tests?

| Test Suite | Checks |
|------------|--------|
| Health Endpoints | Alle /health en /api/health endpoints |
| Cloudflare Access | Public routes geen 403, protected routes wel |
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

### Issue: 401 op public endpoint

**Symptoom:** 401 "Unauthorized" op routes die public moeten zijn (bijv. /api/workflows)

**Oorzaak:** Cloudflare Access (Zero Trust) blokkeert de request VOORDAT de Worker bereikt wordt.

**Fix:**
1. Check of route in `access-policies.json` staat
2. Controleer of bypass Application aangemaakt is in Cloudflare Dashboard
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
| **Wekelijks** | Smoke tests handmatig | `npm run test:smoke` in beheer |
| **Maandelijks** | Cloudflare Access policies review | Check dashboard vs access-policies.json |
| **Kwartaal** | SSL certificaten check | Cloudflare auto-renews, maar controleer |

---

## 🔧 Maintenance Scripts

| Script | Locatie | Functie |
|--------|---------|---------|
| `sync-secrets.sh` | `pagayo-maintenance/scripts/` | Secrets naar Workers |
| `sync-access-policies.ts` | `pagayo-beheer/scripts/` | Access policies naar Cloudflare |
| `health-check.sh` | `pagayo-maintenance/scripts/` | Quick health check alle domeinen |

---

## 📝 Incident Log

### 8 februari 2026 - Registratie flow broken

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
curl -s -o /dev/null -w "%{http_code}" https://beheer.pagayo.com/api/health
curl -s -o /dev/null -w "%{http_code}" https://api.pagayo.com/health
curl -s -o /dev/null -w "%{http_code}" https://test-3.pagayo.app/api/health
curl -s -o /dev/null -w "%{http_code}" https://www.pagayo.com

# Public routes (moeten 200 geven, NIET 403)
curl -s -o /dev/null -w "%{http_code}" https://beheer.pagayo.com/api/workflows/provisioning/status/test
curl -s -o /dev/null -w "%{http_code}" https://beheer.pagayo.com/api/capabilities/features
```

---

**Laatst bijgewerkt:** 8 februari 2026

*Dit bestand wordt bijgehouden door Copilot. Vraag "Infrastructure health check" om status te krijgen.*
