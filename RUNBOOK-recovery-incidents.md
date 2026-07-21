# RUNBOOK — Recovery Incidents (Mission 7 × Mission 6)

Maps backup/restore, Gate H, and migration failures to **existing** Mission 6 ops surfaces. Goal: no normalized ad-hoc DB repair.

## 1. Surfaces to use first

| Symptom | First surface | Then |
| ------- | ------------- | ---- |
| Tenant unhealthy / mismatch | Admin ops health diagnostics (Mission 6) | Permissioned dry-run repair if applicable |
| Backup job red | GitHub Actions `D1 Multi-Tenant Backup` summary + manifest | Re-run `--tenant-slug=`; check token monitor |
| Restore needed | `d1-multi-tenant-restore-runbook.md` | Isolated C-18 before any prod restore |
| Infra drift | `Terraform Drift Check` / `plan.yml` | `CONTROLLED-EXCEPTIONS.md` or intentional apply |
| Gate H blocked | `GATE-H-FOUNDER-CHECKLIST.md` | Founder decisions — no dashboard improvisation |
| Migration fan-out stuck | `RUNBOOK-migration-rollback.md` | Forward-fix; Mission 6 readiness |
| Secret expiry | `SECRET-INVENTORY.md` + token monitor | Rotation drill / dual-publish |

## 2. Severity → action

| Severity | Examples | Action |
| -------- | -------- | ------ |
| P0 | Live tenant data loss risk, payment truth mismatch after bad migrate | Tenant isolate (read-only/suspend) → founder → restore drill path |
| P1 | Nightly backup failed for all tenants; TF drift on WAF/Access | Fix within RPO window; do not skip next backup |
| P2 | Single tenant export skip (missing d1DatabaseId) | Ticket; provisioning repair |

## 3. Forbidden defaults

- Direct production SQL “just this once” without backup + audit
- Stripe write/refund as recovery without founder go
- Skipping checksum verify on restore
- Treating catalog KV snapshot as full tenant backup

## 4. Evidence

Every P0/P1 recovery action records: actor, reason, correlation id, backup sha256 (if any), start/end, link to Mission 6 audit where available.
