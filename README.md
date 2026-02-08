# 🔧 Pagayo Maintenance

Centrale plek voor alle onderhoud, monitoring en testing van het Pagayo platform.

---

## � Huidige Status (102 tests)

| Test Type | Count | Status |
|-----------|-------|--------|
| Smoke | 51 | ✅ All Pass |
| Security | 14 | ✅ All Pass |
| Integration | 6 | ✅ All Pass |
| Contracts | 8 | ✅ All Pass |
| Performance | 23 | ✅ All Pass |

**Known Issues:**
- `storefront /api/products` returns 500 (tracked as warning)
- `storefront /api/categories` returns 500 (tracked as warning)
- `beheer /api/health` soms HTML door Cloudflare Access (OK)

---

## 📁 Structuur

```
pagayo-maintenance/
├── scripts/
│   ├── health-check.sh         # Quick infrastructure check
│   ├── run-all-tests.sh        # Master test suite met rapport
│   └── sync-secrets.sh         # Secrets naar Workers
├── tests/
│   ├── smoke/                  # Productie endpoint tests
│   │   ├── beheer.test.ts      # beheer.pagayo.com
│   │   ├── storefront.test.ts  # test-3.pagayo.app
│   │   ├── api-stack.test.ts   # api.pagayo.com
│   │   ├── marketing.test.ts   # www.pagayo.com
│   │   └── infrastructure.test.ts # DNS, SSL, routing
│   ├── integration/            # Cross-service tests
│   ├── security/               # Security validatie
│   ├── contracts/              # API schema tests
│   └── performance/            # Response time tests
└── utils/
    └── test-reporter.ts        # AI-readable output
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
npm run test:smoke        # Smoke tests (51 tests)
npm run test:security     # Security tests (14 tests)
npm run test:integration  # Cross-service tests (6 tests)
npm run test:contracts    # API schema tests (8 tests)
npm run test:performance  # Response time tests (23 tests)
```

---

## 🤖 AI-Readable Output

Alle tests genereren gestructureerde output voor AI agents:

```
[SMOKE] ✓ beheer/api-health: Status: ok
[SMOKE] ✓ infrastructure/ssl-beheer: SSL valid for 81 days
[SMOKE] ⚠ storefront/products-api: KNOWN ISSUE: Returns 500
[SECURITY] ✓ auth/register-bypass: Not blocked by CF Access
```

### Output Format
```
[CATEGORY] STATUS SERVICE/TEST: DETAILS
```

- **CATEGORY**: SMOKE, SECURITY, CONTRACT, INTEGRATION, PERFORMANCE
- **STATUS**: ✓ (pass), ⚠ (warning), ✗ (fail)
- **SERVICE**: beheer, storefront, api-stack, marketing, infrastructure
- **DETAILS**: Readable description + actie bij failure

---

## 🧪 Test Coverage

| Test Type | Wat het test | Detecteert |
|-----------|--------------|------------|
| **Smoke** | Productie endpoints | Worker crashes, 500 errors |
| **Security** | Auth, Cloudflare Access | 403 blocks, auth bypass |
| **Integration** | Cross-service flows | Service bindings, RPC issues |
| **Contracts** | API response schemas | Breaking changes |
| **Performance** | Response times | Slow endpoints, cold starts |

---

## 📊 Services Getest

| Service | URL | Tests |
|---------|-----|-------|
| Beheer | beheer.pagayo.com | smoke, security, contracts |
| Storefront | test-3.pagayo.app | smoke, security |
| API Stack | api.pagayo.com | smoke, contracts |
| Marketing | www.pagayo.com | smoke, performance |
| Infrastructure | alle domeinen | DNS, SSL, routing |

---

## 📅 Schedule

| Frequentie | Actie | Commando |
|------------|-------|----------|
| **Dagelijks** | Quick health check | `./scripts/health-check.sh --quick` |
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
| `run-all-smoke-tests.sh` | Master test runner | `./scripts/run-all-smoke-tests.sh` |

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
   npx wrangler tail pagayo-beheer --format pretty
   ```

2. **Security test 403** → Cloudflare Access blokkeert
   ```bash
   # Check/update: pagayo-beheer/cloudflare/access-policies.json
   ```

3. **Integration test faalt** → Service binding issue
   ```bash
   # Check wrangler.toml service bindings
   ```

4. **Performance test faalt** → Cold start of DB issue
   ```bash
   # Check Neon dashboard, Worker metrics
   ```

---

*Aangemaakt: 31 januari 2026*  
*Laatst bijgewerkt: 8 februari 2026*
