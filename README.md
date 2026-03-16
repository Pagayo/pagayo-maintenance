# 🔧 Pagayo Maintenance

Centrale plek voor alle onderhoud, monitoring en testing van het Pagayo platform.

---

## 🧪 Huidige Status (445 tests)

| Test Type | Count | Status |
|-----------|-------|--------|
| Smoke | 140 | ✅ All Pass |
| Security | 132 | ✅ All Pass |
| Integration | 23 | ✅ All Pass |
| Contracts | 120 | ✅ All Pass |
| Performance | 9 | ✅ All Pass |
| Quality | 21 | ⚠️ 1 fail (wrangler drift) |

**Known Issues:**
- `storefront /api/products` returns 500 (tracked as warning)
- `storefront /api/categories` returns 500 (tracked as warning)
- Wrangler versie-drift: storefront `^4.72.0` vs rest `^4.69.0`

---

## 📁 Structuur

```
pagayo-maintenance/
├── scripts/
│   ├── health-check.sh           # Quick infrastructure check
│   ├── run-all-tests.sh          # Master test suite met rapport
│   ├── run-all-smoke-tests.sh    # Smoke tests alle repos
│   ├── run-all-unit-tests.sh     # Unit tests alle repos
│   ├── sync-secrets.sh           # Secrets naar Workers
│   └── api-health-scan.ts        # Admin endpoint scanner
├── tests/
│   ├── smoke/                    # Productie endpoint tests (140)
│   │   ├── header-compliance.test.ts  # ⚠️ POST-DEPLOY: CORS, CORP, Cache, middleware leaks
│   │   ├── beheer.test.ts        # Legacy redirect verificatie (→ www.pagayo.com)
│   │   ├── storefront.test.ts    # demo.pagayo.app
│   │   ├── api-stack.test.ts     # api.pagayo.com
│   │   ├── marketing.test.ts     # www.pagayo.com
│   │   ├── infrastructure.test.ts # DNS, SSL, routing
│   │   ├── d1-schema.test.ts     # D1 database schema validatie
│   │   └── staging.test.ts       # Staging environment checks
│   ├── security/                 # Security validatie (132)
│   ├── integration/              # Cross-service + RPC tests (23)
│   ├── contracts/                # API schema + RPC + policy tests (120)
│   ├── quality/                  # ESLint, TypeScript, unit tests, deps (21)
│   └── performance/              # Response time tests (9)
└── utils/
    ├── test-config.ts            # Gedeelde URL configuratie
    └── test-reporter.ts          # AI-readable output
```

---

## 🧪 Tests Runnen

### Quick Health Check (30 sec)
```bash
./scripts/health-check.sh
```

### Complete Test Suite met Rapport
```bash
./scripts/run-all-tests.sh          # Alle tests
./scripts/run-all-tests.sh --quick  # Skip performance
```

### Alle Tests via npm
```bash
npm run test        # Alle tests
```

### Per Categorie
```bash
npm run test:smoke          # Smoke tests (140 tests)
npm run test:smoke:headers  # Post-deploy header compliance (21 tests)
npm run test:security       # Security tests (132 tests)
npm run test:integration    # Cross-service + RPC tests (23 tests)
npm run test:contracts      # API + RPC + policy schema tests (120 tests)
npm run test:performance    # Response time tests (9 tests)
npm run test:quality        # ESLint + TypeScript + unit tests + deps (21 tests)
npm run test:quality:units  # Unit tests alle repos
```

---

## 🤖 AI-Readable Output

Alle tests genereren gestructureerde output voor AI agents:

```
[SMOKE] ✓ infrastructure/ssl-storefront: SSL valid for 81 days
[SMOKE] ⚠ storefront/products-api: KNOWN ISSUE: Returns 500
[SECURITY] ✓ auth/register-bypass: Not blocked by CF Access
```

### Output Format
```
[CATEGORY] STATUS SERVICE/TEST: DETAILS
```

- **CATEGORY**: SMOKE, SECURITY, CONTRACT, INTEGRATION, PERFORMANCE
- **STATUS**: ✓ (pass), ⚠ (warning), ✗ (fail)
- **SERVICE**: storefront, api-stack, marketing, infrastructure
- **DETAILS**: Readable description + actie bij failure

---

## 🧪 Test Coverage

| Test Type | Wat het test | Detecteert |
|-----------|--------------|------------|
| **Smoke** | Productie endpoints | Worker crashes, 500 errors |
| **Header Compliance** | HTTP headers op productie | CORS dubbel, CORP blocking, cache mis, auth leaks, asset failures |
| **Security** | Auth, CSRF, tenant isolation | Auth bypass, CSRF, fuzz, rate limiting |
| **Integration** | Cross-service + RPC flows | Service bindings, RPC contracts |
| **Contracts** | API schemas, RPC, policy engine | Breaking changes |
| **Quality** | ESLint, TypeScript, unit tests, deps | Code kwaliteit platform-breed |
| **Performance** | Response times | Slow endpoints, cold starts |

---

## 📊 Services Getest

| Service | URL | Tests |
|---------|-----|-------|
| Storefront | demo.pagayo.app | smoke, security, contracts |
| Platform Admin | admin.pagayo.app | smoke (CF Access) |
| API Stack | api.pagayo.com | smoke, contracts |
| Marketing | www.pagayo.com | smoke, performance |
| Staging | staging.pagayo.app / staging-api.pagayo.com | smoke |
| Infrastructure | alle domeinen | DNS, SSL, routing |
| Legacy redirects | beheer.pagayo.com, app.pagayo.com | smoke (301 check) |

---

## 📅 Schedule

| Frequentie | Actie | Commando |
|------------|-------|----------|
| **Dagelijks** | Quick health check | `./scripts/health-check.sh --quick` |
| **Na elke deploy** | Header compliance check | `npm run test:smoke:headers` |
| **Wekelijks** | Volledige test suite | `npm run test:all` |
| **Wekelijks** | Dependabot PRs reviewen | Vraag Copilot |
| **Maandelijks** | Security audit | `npm run test:security` |
| **Maandelijks** | Cloudflare Access review | Check dashboard |
| **Kwartaal** | Performance baseline | `npm run test:performance` |

---

## 🔧 Scripts

| Script | Functie | Gebruik |
|--------|---------|---------|
| `health-check.sh` | Quick infra check | `./scripts/health-check.sh` |
| `sync-secrets.sh` | Secrets naar Workers | `./scripts/sync-secrets.sh DATABASE_URL "value"` |
| `run-all-smoke-tests.sh` | Smoke tests alle repos | `./scripts/run-all-smoke-tests.sh` |
| `run-all-unit-tests.sh` | Unit tests alle repos | `./scripts/run-all-unit-tests.sh` |
| `api-health-scan.ts` | Admin endpoint scanner | `npx tsx scripts/api-health-scan.ts` |

---

## 📝 Documentatie

| Bestand | Inhoud |
|---------|--------|
| [SECURITY-MAINTENANCE.md](SECURITY-MAINTENANCE.md) | Vulnerability tracking, Dependabot status |
| [INFRASTRUCTURE-MAINTENANCE.md](INFRASTRUCTURE-MAINTENANCE.md) | Cloudflare config, known issues |
| [LATER-KIJKEN.md](LATER-KIJKEN.md) | Geparkeerde items |
| [GITHUB-BACKLOG.md](GITHUB-BACKLOG.md) | Open PRs/Issues per repo |

---

## 🚨 Bij Problemen

Als tests falen:

1. **Smoke test faalt** → Worker is down of crasht
   ```bash
   npx wrangler tail pagayo-storefront --format pretty
   ```

2. **Security test 403** → Cloudflare Access blokkeert
   ```bash
   # Check Cloudflare Access policies in dashboard
   ```

3. **Integration test faalt** → Service binding issue
   ```bash
   # Check wrangler.toml service bindings
   ```

4. **Performance test faalt** → Cold start of DB issue
   ```bash
   # Check D1 dashboard, Worker metrics
   ```

---

*Aangemaakt: 31 januari 2026*  
*Laatst bijgewerkt: 15 maart 2026*
