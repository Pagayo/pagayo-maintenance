# SECRET-INVENTORY — Pagayo (Mission 7 / CPR-034)

**Purpose:** inventory secrets that affect commerce runtime and recovery, with rotation ownership.  
**Rule:** never paste secret values into chat, commits, or evidence packets.

Companion script (partial worker map): `scripts/sync-secrets.sh --list`.

## 1. Inventory

| Secret / credential | Where used | Owner | Blast radius | Rotation notes |
|---------------------|------------|-------|--------------|----------------|
| `CLOUDFLARE_API_TOKEN` | GH Actions (infra, maintenance backup, token monitor), local wrangler | Platform ops | Deploy, D1 export, TF plan/apply | Rotate via CF dashboard; update GH secrets; run token monitor |
| `CLOUDFLARE_ACCOUNT_ID` | TF / scripts (non-secret id) | Platform ops | Low | Not a secret; keep consistent |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Terraform state backend | Platform ops | TF state R/W | Rotate R2 API tokens; update infra secrets |
| `R2_ACCOUNT_ID` | TF backend endpoint | Platform ops | Low | Account id |
| `D1_BACKUP_R2_BUCKET` | Nightly D1 backup workflow | Platform ops | Backup upload target name | Not secret; bucket ACL is |
| `GH_PACKAGES_READ_TOKEN` | Maintenance workflows reading private repos | Platform ops | Checkout siblings | Fine-grained PAT; rotate yearly |
| `RELEASE_MANIFEST_TOKEN` | Consumer → maintenance dispatch | Platform ops | Manifest write | See `RUNBOOK-release-manifest.md` |
| `INTERNAL_API_SECRET` | Storefront/api internal routes | Platform ops | Internal APIs | Rotate workers via wrangler secret; coordinated dual-publish |
| `EDGE_SECRET` | Edge ↔ storefront/workflows | Platform ops | Edge auth | `sync-secrets.sh EDGE_SECRET` |
| Stripe platform keys (test/live) | api-stack / vault | Founder + platform | Payments | Stripe dashboard; **read-first MCP**; live writes founder-only |
| AWS SES keys | api-stack / storefront email | Platform ops | Email send | Rotate IAM; `sync-secrets.sh` |
| `PROVISIONING_API_KEY` / `WORKFLOW_API_KEY` / `ADMIN_SECRET` | Beheer/workflows legacy map | Platform ops | Provisioning | Inventory in `sync-secrets.sh`; prefer least privilege |
| Tenant Stripe Connect | Per connected account | Merchant + platform | That tenant payouts | Never in monorepo; tenant settings encrypted |

## 2. Rotation drill (dry-run)

Execute without changing production values first:

1. Pick one non-live credential class (prefer CF API token **test** scope or staging-only secret).
2. Document current GH secret names and worker bindings (`sync-secrets.sh --list` / `--check`).
3. Create replacement credential in provider UI.
4. Write ordered update list: GH secrets → workers (staging) → smoke → workers (production) → revoke old.
5. Stop before production worker update unless founder go in same thread.
6. Record drill evidence:

```text
Secret rotation drill
Date:
Secret class:
Environments touched:
Dual-publish window:
Outage expected: none | minutes | hours
Outcome: ACCEPTED dry-run | ACCEPTED live | REJECTED
```

## 3. Live rotation gate

Live production rotation requires explicit founder approval in the same thread. Prefer dual-publish (old+new accepted) to avoid undocumented outage (CPR-034).

## 4. Recovery coupling

- D1 backup job fails if `CLOUDFLARE_API_TOKEN` expired → token monitor + backup workflow both alert.
- Terraform drift/plan fails if R2 state keys invalid → infra Actions red.
- Do not embed secrets in Mission 7 evidence packets or SQL dumps committed to git.
