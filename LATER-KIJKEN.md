# 📋 Later Kijken

> ⚠️ HISTORISCH DOCUMENT
> Deze inhoud beschrijft legacy Cloud Run / GCP / PostgreSQL / Neon / Hyperdrive / Prisma architectuur.
> Pagayo draait 100% op Cloudflare. Leidend: `pagayo-vault/STACK-MANIFEST.md` en `pagayo-vault/PAGAYO-NIVEAU.md`.

**Doel:** Dingen die we in de gaten moeten houden, maar nu geen prioriteit hebben.

> Dit is geen bug-lijst of todo-lijst. Dit zijn punten die we **bewust parkeren** omdat ze nu geen probleem vormen, maar waar we af en toe naar moeten kijken.

---

## 🔐 Security Dependencies (geaccepteerd risico)

**Laatst gecontroleerd:** 2 februari 2026

### Waarom staan deze hier?

Dit zijn beveiligingsproblemen in **packages van packages** (transitive dependencies). Wij kunnen ze niet zelf fixen — we moeten wachten tot de makers van die packages een update uitbrengen.

**Belangrijk:** Deze zitten allemaal in **dev dependencies** (ontwikkel-tools), niet in productie code. Klanten worden hier niet door geraakt.

### Actieve items:

| Package | Zit in | Probleem | Waarom acceptabel |
|---------|--------|----------|-------------------|
| `fast-xml-parser` | artillery | DoS mogelijk | Artillery = test tool, niet productie |
| `hono` (oud) | @prisma/dev | XSS + cache | Prisma dev tools, niet productie |
| `lodash` | chevrotain → prisma | Prototype pollution | Dev dependency, niet productie |

### Wanneer checken?

- [ ] **Maandelijks:** Run `npm audit` in api-stack en storefront
- [ ] **Bij Prisma update:** Check of hono/lodash issues opgelost zijn
- [ ] **Bij Artillery update:** Check of fast-xml-parser opgelost is

---

## 🧹 Code Quality (technische schuld)

**Laatst gecontroleerd:** 2 februari 2026

### ESLint warnings in storefront

**Status:** 150 warnings, 0 errors (deployment niet geblokkeerd)

| Type Warning | Aantal | Prioriteit | Actie |
|--------------|--------|------------|-------|
| `@typescript-eslint/no-unused-vars` | ~120 | Laag | Opruimen bij refactoring |
| `@typescript-eslint/no-explicit-any` | ~25 | Medium | Type safety verbeteren |
| `Unused eslint-disable directive` | ~5 | Laag | Cleanup |

**Meest getroffen bestanden:**
- `src/client/` — veel unused imports in React components
- `src/workers/routes/` — `any` types in API handlers
- `test-scope-guards.js` — test utility file

**Waarom niet nu fixen:**
- Code werkt correct
- Geen impact op functionaliteit of performance
- Kan in batches per directory opgepakt worden

**Wanneer oppakken:** 
- Bij refactoring van betreffende bestanden
- Of als dedicated "code quality sprint"

---

## 📝 Hoe dit document gebruiken

### Nieuw item toevoegen:

1. Zet het onder de juiste categorie (of maak nieuwe aan)
2. Noteer **datum** van ontdekking
3. Leg uit **waarom** het nu geen prioriteit heeft
4. Geef aan **wanneer** we het moeten checken

### Item verwijderen:

Wanneer het opgelost is (bijv. upstream fix), verwijder het item en noteer kort in een "Opgelost" sectie onderaan.

---

## ✅ Opgelost (archief)

*Nog geen items opgelost.*

---

**Laatst bijgewerkt:** 2 februari 2026
