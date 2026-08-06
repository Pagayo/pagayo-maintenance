# RUNBOOK — Migration Rollback / Forward-Fix

**Mission 7** (CPR-003 slice). Ties schema fan-out to release identity without ad-hoc DB edits.

Related:

- `pagayo-maintenance/RUNBOOK-release-manifest.md` — code SHA gate
- `pagayo-maintenance/.github/scripts/copilot-migration-check.sh` — manifest/version/consumer parity
- Mission 6 tenant health / readiness — traffic block on incompatible schema
- Mission brief 07 — recovery scope

## 1. Concept

| Term | Meaning |
| ---- | ------- |
| Forward-fix | Ship a corrective migration / code path that repairs bad state while keeping schema moving forward |
| Rollback | Revert **application** deploy to last known-good release-manifest SHA; schema rollback only when explicitly safe and rehearsed |
| Fan-out | Applying tenant migrations across all `tenant-*` D1s; must be resumable |
| Readiness | Tenant must not serve incompatible traffic while mid-migration |

**Default preference:** forward-fix. Schema down-migrations are rare and founder-gated.

## 2. Decision tree

```text
Migration or deploy issue detected
        │
        ▼
Is data corrupted / money-path wrong?
        │
   yes ─┼─ no
        │    │
        ▼    ▼
Isolate     Prefer forward-fix
tenant      (patch + migration + resume fan-out)
(Mission 6
 read-only/
 suspend)
        │
        ▼
Do we have a rehearsed schema down-path?
        │
   yes ─┼─ no
        │    │
        ▼    ▼
Founder go  Forward-fix only
+ restore   (+ optional D1 restore
from D1     from Mission 7 backup
backup if   if data loss)
needed
```

## 3. Pre-migration checklist

1. `copilot-migration-check.sh` exit 0 (or follow its instructions).
2. Release-manifest knows the code SHA that embeds the migration.
3. Fresh D1 backup for canary tenant (`d1-multi-tenant-backup.sh --tenant-slug=...`).
4. Canary tenant selected; fan-out plan documents resume cursor.

## 4. During fan-out failure

1. Stop widening the blast radius (pause scheduler / workflow).
2. Capture: tenant slug, migration version, error `code`/`message`, requestId.
3. Use Mission 6 health diagnostics — not raw SQL improvisation.
4. Resume from last successful tenant after fix; do not re-apply blindly.

## 5. Application rollback (safe default)

1. Identify last good SHA in `pagayo-maintenance/releases/current.json`.
2. Redeploy consumer with that SHA via normal workflows (staging first if environment-dependent).
3. Confirm tenant readiness / smoke.
4. Schema: leave forward if already applied unless founder authorizes restore.

## 6. Schema / data rollback (exceptional)

1. Explicit founder go in the same thread.
2. Isolated restore drill on the backup (C-18) before production restore.
3. Follow `pagayo-docs/cloudflare-ops-agent/d1-multi-tenant-restore-runbook.md` §4.
4. Provider reconciliation after restore.

## 7. Drill (Definition of Complete)

Record a short evidence note:

```text
Migration rollback/forward-fix drill
Date:
Scenario: forward-fix | app-rollback | schema-restore
Canary tenant:
Backup runId:
Outcome: ACCEPTED | REJECTED
Notes:
```

## 8. Out of scope

- Redesigning Order / fulfillment product (Missions 3–5)
- Team permission product (Mission 6)
- Gate H Terraform apply (infra checklist)
