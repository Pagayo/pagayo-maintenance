# E2E playbooks — referentie

| # | Bestand | Doel |
|---|---------|------|
| Index | `pagayo-vault/.github/cursor-e2e-playbooks/README.md` | Startpunt, coverage matrix |
| 01 | `01-preflight.md` | Staging, env vars, storageState |
| 02 | `02-run-suites.md` | Run-profielen, flakiness-protocol |
| 03 | `03-triage-reporting.md` | Failure-analyse, rapporttemplate |
| 04 | `04-gates-followup.md` | GO/NO-GO, escalatie naar release-playbooks |

Gerelateerd:

- Release discipline: `pagayo-vault/.github/release-playbooks/README.md`
- Workspace policy: workspace-root `AGENTS.md`
- Auth env (lokaal, niet committen): `cursor-e2e-playbooks/staging-auth.local.env`

Escalatie bij deployment (niet vanuit E2E-skill):

- `release-playbooks/02-staging.md` — CI/workflow
- `release-playbooks/03-main-parity.md` — merge-readiness
- `release-playbooks/04-production.md` — productie (alleen expliciete opdracht)
