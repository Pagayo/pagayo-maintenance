# 🔒 Pagayo Security & Maintenance Status

**Laatst bijgewerkt:** 31 januari 2026

---

## ✅ Actieve Beschermingen

| Wat | Status | Werkt sinds |
|-----|--------|-------------|
| Pre-commit hooks (TypeScript, ESLint, tests) | ✅ Actief | 31 jan 2026 |
| Strikte CI (`|| true` verwijderd) | ✅ Actief | 31 jan 2026 |
| Dependabot alerts | ✅ Actief | 31 jan 2026 |
| Dependabot security updates | ✅ Actief | 31 jan 2026 |
| Secret scanning | ⚠️ Aanzetten in GitHub UI | - |

---

## 📦 Dependency Status per Repo

### pagayo-beheer
- **Vulnerabilities:** 8 moderate (nested in `chevrotain` via `@mrleebo/prisma-ast`)
- **Laatste update:** 31 jan 2026

### pagayo-storefront  
- **Vulnerabilities:** 6 (1 high, 5 moderate)
- **Laatste update:** 31 jan 2026

### pagayo-api-stack
- **Vulnerabilities:** ~15 (meeste moderate)
- **Laatste update:** 31 jan 2026

### pagayo-edge
- **Vulnerabilities:** 0 ✅
- **Laatste update:** 31 jan 2026

---

## ⏸️ Bewust Uitgestelde Updates

Deze updates zijn **niet** gemerged vanwege risico's. Herbeoordeel bij volgende maintenance window.

| Repo | Package | Van → Naar | Reden | PR # | Actie |
|------|---------|-----------|-------|------|-------|
| beheer | vitest | 3.2.4 → 4.0.18 | Major version, breaking peer deps met @vitest/* | #18 (merged, reverted) | Wacht op vitest ecosystem |
| beheer | production-deps bundle | diverse | Merge conflicts | #14 | Close, doe lokaal |
| beheer | react-router | - | - | #10 | Evalueer |
| storefront | @types/node | 22 → 25 | Major version sprong | #12 | Skip |
| storefront | @types/marked | 5 → 6 | Major version | #13 | Test lokaal eerst |
| storefront | production-deps bundle | diverse | Merge conflicts | #9 | Close, doe lokaal |
| api-stack | @types/node | 20 → 25 | Major version sprong | #11 | Skip |
| api-stack | production-deps bundle | diverse | Merge conflicts | #10 | Close, doe lokaal |
| api-stack | qs | 6.14.0 → 6.14.1 | Patch | #3 | ✅ Kan gemerged |
| edge | vitest | 3.2.4 → 4.0.18 | Zelfde als beheer | #8 | Skip |
| edge | undici + wrangler | - | - | #2 | ✅ Kan gemerged |

---

## 🔧 Volgende Maintenance Acties

### Nu te doen (veilig):
```bash
# Merge de veilige patches
gh pr merge 10 --repo Pagayo/pagayo-beheer --squash   # react-router
gh pr merge 3 --repo Pagayo/pagayo-api-stack --squash  # qs patch
gh pr merge 2 --repo Pagayo/pagayo-edge --squash       # undici/wrangler
```

### Te sluiten (conflicts/handled locally):
```bash
gh pr close 14 --repo Pagayo/pagayo-beheer --comment "Handled via npm update locally"
gh pr close 9 --repo Pagayo/pagayo-storefront --comment "Handled via npm update locally"
gh pr close 10 --repo Pagayo/pagayo-api-stack --comment "Handled via npm update locally"
```

### Te skippen (major versions):
```bash
gh pr close 12 --repo Pagayo/pagayo-storefront --comment "Skip: @types/node major version too risky"
gh pr close 13 --repo Pagayo/pagayo-storefront --comment "Skip: @types/marked major version - needs testing"
gh pr close 11 --repo Pagayo/pagayo-api-stack --comment "Skip: @types/node major version too risky"
gh pr close 8 --repo Pagayo/pagayo-edge --comment "Skip: vitest 4.0 has breaking peer dependencies"
```

---

## 📅 Maintenance Schedule

| Frequentie | Wat | Commando |
|------------|-----|----------|
| Wekelijks | Dependabot PRs reviewen | Vraag Copilot: "Merge de Dependabot PRs" |
| Maandelijks | `npm audit` check | `npm audit` in elke repo |
| Kwartaal | Major version updates evalueren | Handmatig testen |

---

## 🚨 Bekende Onoplosbare Vulnerabilities

Deze kunnen we niet fixen zonder breaking changes:

| Package | Vulnerability | Waarom niet te fixen |
|---------|--------------|---------------------|
| chevrotain (via @mrleebo/prisma-ast) | lodash prototype pollution | Nested dependency, wacht op upstream fix |

---

## 📝 Changelog

### 31 januari 2026
- ✅ Pre-commit hooks geïnstalleerd (alle 4 repos)
- ✅ `|| true` verwijderd uit CI workflows
- ✅ Dependabot geconfigureerd
- ✅ ~20 Dependabot PRs gemerged
- ⏸️ Major version updates uitgesteld (vitest 4, @types/node 25)
- 📝 Dit rapport aangemaakt

---

*Dit bestand wordt bijgehouden door Copilot. Vraag "Update het security rapport" om te refreshen.*
