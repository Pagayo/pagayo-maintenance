---
name: 03-e2e-test-suites
description: Runs Pagayo Playwright E2E staging suites, fixes failures, re-runs until green, then commits. Use when the user asks to run E2E tests, staging E2E, test:e2e:staging, Playwright staging suites, or fix E2E failures.
---

# E2E test-suites (Pagayo)

Canonieke bron: `pagayo-vault/.github/cursor-e2e-playbooks/README.md`  
Werkrepo: `pagayo-storefront`  
Staging URL: `https://demo.staging.pagayo.app`

## Workflow (verplicht — in volgorde)

Doe de volgende 4 punten:

1. **Run suites** — voer playbook 02 uit (zie hieronder).
2. **Fix issues** — ga meteen aan de slag met gevonden failures; geen rapport-only stop.
3. **Herhaal tot groen** — draai de **hele** test-suite opnieuw tot alles groen is.
4. **Commit** — als alles groen is, commit de fixes (alleen wanneer de user commit vraagt of deze skill expliciet stap 4 activeert).

---

## Stap 1 — Run suites (playbook 02)

Lees eerst `pagayo-vault/.github/cursor-e2e-playbooks/02-run-suites.md`.

Werkdirectory:

```bash
cd /Users/sjoerdoverdiep/my-vscode-workspace/pagayo-storefront
```

Auth env (vóór auth-afhankelijke runs):

```bash
set -a && source /Users/sjoerdoverdiep/my-vscode-workspace/pagayo-vault/.github/cursor-e2e-playbooks/staging-auth.local.env && set +a
```

Staging bereikbaarheid (preflight — stop bij ≠ 200):

```bash
curl -sS -o /dev/null -w "%{http_code}" https://demo.staging.pagayo.app
```

**Standaard run (full suite):**

```bash
npm run test:e2e:staging
```

Gerichte profielen (tussentijds debuggen, niet als eindgate):

| Profiel | Commando |
|---------|----------|
| Blockers | `npm run test:e2e:staging:blockers` |
| Regression | `npm run test:e2e:staging:regression` |
| Single spec | `npx playwright test -c playwright.staging.config.ts e2e/staging-<naam>.spec.ts` |
| Flakiness-check | `npx playwright test -c playwright.staging.config.ts e2e/<spec>.ts --repeat-each=3` |

Kritieke contract-checks (minimaal groen vóór commit):

- `/api/orders` — geen 500 in account-flow
- change-password endpoint — geen 404
- passkey register-options — geen 403-regressie

Geen secrets in chat of commits. Geen deploy vanuit dit playbook.

---

## Stap 2 — Fix issues

Lees bij triage: `pagayo-vault/.github/cursor-e2e-playbooks/03-triage-reporting.md`.

Per failure:

1. Classificeer: omgeving | auth-state | product defect | testkwaliteit (flaky).
2. Verzamel artifacts: screenshot, trace, error-context (Playwright output).
3. Fix de **root cause** in code/tests — geen `waitForTimeout` als enige oplossing.
4. Bij flaky kritieke specs: `--repeat-each=3` → stabiel (3/3) / flaky / hard-fail.

Stop-and-sweep (playbook 04): niet blind herhalen; eerst categoriseren, dan gerichte fix, dan full suite.

---

## Stap 3 — Herhaal tot groen

Na elke fix-batch:

```bash
npm run test:e2e:staging
```

Herhaal stap 2–3 tot **full suite** volledig groen is (inclusief kritieke contract-checks).

Gate: `GO` = alles groen, geen hard-fails op kritieke flows. Bij `NO-GO` (staging down, auth ontbreekt terwijl vereist): stop en rapporteer; geen commit.

---

## Stap 4 — Commit

Alleen als full suite groen is.

1. Parallel: `git status`, `git diff`, `git log -1 --format='%s'`.
2. Commit alleen relevante fixes (geen secrets, geen artifacts).
3. Commit message: kort, waarom-georiënteerd; volg recente repo-stijl.
4. Push **niet** tenzij user expliciet vraagt.
5. Deploy policy: geen push naar `main`; werk op `feature/batch-staging-YYYYMMDD` indien van toepassing.

---

## Rapport (kort, na elke full run)

```text
Target: https://demo.staging.pagayo.app
Resultaat: passed / failed / skipped | duur
Kritieke contract-checks: orders / change-password / passkey — OK/FAIL
Failures: <test> — <oorzaak> | artifacts: <pad>
Vervolg: fix / rerun / commit / NO-GO
```

Zie [reference.md](reference.md) voor playbook-paden en escalatie.
