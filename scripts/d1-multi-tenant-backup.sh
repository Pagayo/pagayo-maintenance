#!/usr/bin/env bash
# =============================================================================
# Multi-tenant D1 backup (Mission 7 — CPR-006)
# =============================================================================
# Lists active tenants from PLATFORM_DB, exports each tenant D1 with wrangler,
# writes a SHA-256 run manifest, optionally uploads to R2 recovery bucket.
#
# Usage (from workspace root or pagayo-maintenance):
#   ./pagayo-maintenance/scripts/d1-multi-tenant-backup.sh
#   ./pagayo-maintenance/scripts/d1-multi-tenant-backup.sh --tenant-slug=y0d7wl
#   ./pagayo-maintenance/scripts/d1-multi-tenant-backup.sh --dry-run
#   ./pagayo-maintenance/scripts/d1-multi-tenant-backup.sh --local-only
#
# Env:
#   PLATFORM_DB              default: pagayo-platform
#   STOREFRONT_DIR           default: <workspace>/pagayo-storefront
#   D1_BACKUP_DIR            default: <workspace>/pagayo-docs/backups/d1/runs/<run-id>
#   D1_BACKUP_R2_BUCKET      optional; when set + not --local-only, upload via wrangler r2
#   D1_BACKUP_TRIGGER        scheduled | manual (default: manual) — retention class
#   CLOUDFLARE_API_TOKEN     required for remote wrangler when not already logged in
#
# Exit: 0 = all requested tenants backed up; 1 = partial/total failure (see manifest).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAINTENANCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_ROOT="$(cd "$MAINTENANCE_DIR/.." && pwd)"

PLATFORM_DB="${PLATFORM_DB:-pagayo-platform}"
STOREFRONT_DIR="${STOREFRONT_DIR:-$WORKSPACE_ROOT/pagayo-storefront}"
D1_BACKUP_TRIGGER="${D1_BACKUP_TRIGGER:-manual}"
D1_BACKUP_R2_BUCKET="${D1_BACKUP_R2_BUCKET:-}"

TENANT_FILTER=""
DRY_RUN=0
LOCAL_ONLY=0

usage() {
  sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --local-only) LOCAL_ONLY=1 ;;
    --tenant-slug=*) TENANT_FILTER="${arg#--tenant-slug=}" ;;
    -h|--help) usage ;;
    *)
      echo "Unknown argument: $arg" >&2
      sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//' >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$STOREFRONT_DIR" ]]; then
  echo "STOREFRONT_DIR not found: $STOREFRONT_DIR" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

TS="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_ID="d1-backup-${TS}"
BACKUP_ROOT="${D1_BACKUP_DIR:-$WORKSPACE_ROOT/pagayo-docs/backups/d1/runs/$RUN_ID}"
mkdir -p "$BACKUP_ROOT"

MANIFEST_FILE="$BACKUP_ROOT/manifest.json"
FAILURES=0
SUCCESSES=0
SKIPPED=0

echo "=========================================="
echo "[D1 Backup] run_id=$RUN_ID trigger=$D1_BACKUP_TRIGGER"
echo "[D1 Backup] output=$BACKUP_ROOT"
echo "=========================================="

echo ""
echo "[D1 Backup] Listing active tenants from $PLATFORM_DB..."

TENANTS_JSON="$(
  cd "$STOREFRONT_DIR"
  npx wrangler d1 execute "$PLATFORM_DB" --remote --json --command \
    "SELECT id, slug, name, d1DatabaseId FROM tenant WHERE isActive = 1 ORDER BY slug;"
)"

TENANT_COUNT="$(echo "$TENANTS_JSON" | jq -r '.[0].results | length')"
echo "[D1 Backup] Found ${TENANT_COUNT} active tenants"

if [[ "$TENANT_COUNT" -eq 0 ]]; then
  echo "[D1 Backup] No active tenants — writing empty success manifest"
  jq -n \
    --arg runId "$RUN_ID" \
    --arg ts "$TS" \
    --arg trigger "$D1_BACKUP_TRIGGER" \
    '{
      runId: $runId,
      createdAt: $ts,
      trigger: $trigger,
      success: true,
      tenantCount: 0,
      successes: 0,
      failures: 0,
      skipped: 0,
      tenants: []
    }' > "$MANIFEST_FILE"
  exit 0
fi

TENANTS_TMP="$(mktemp)"
echo "$TENANTS_JSON" | jq -c '.[0].results[]' > "$TENANTS_TMP"

MANIFEST_ENTRIES="[]"

while IFS= read -r row; do
  TENANT_ID="$(echo "$row" | jq -r '.id')"
  TENANT_SLUG="$(echo "$row" | jq -r '.slug')"
  TENANT_NAME="$(echo "$row" | jq -r '.name')"
  D1_DB_ID="$(echo "$row" | jq -r '.d1DatabaseId // empty')"

  if [[ -n "$TENANT_FILTER" && "$TENANT_SLUG" != "$TENANT_FILTER" ]]; then
    continue
  fi

  echo ""
  echo "--- Tenant: $TENANT_SLUG ($TENANT_NAME) ---"

  if [[ -z "$D1_DB_ID" || "$D1_DB_ID" == "null" ]]; then
    echo "  SKIP: no d1DatabaseId"
    SKIPPED=$((SKIPPED + 1))
    MANIFEST_ENTRIES="$(echo "$MANIFEST_ENTRIES" | jq \
      --arg id "$TENANT_ID" \
      --arg slug "$TENANT_SLUG" \
      --arg status "skipped" \
      --arg reason "missing_d1DatabaseId" \
      '. + [{ tenantId: $id, slug: $slug, status: $status, reason: $reason }]')"
    continue
  fi

  TENANT_DB_NAME="tenant-${TENANT_SLUG}"
  BACKUP_FILE="$BACKUP_ROOT/${TENANT_DB_NAME}-${TS}.sql"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  DRY-RUN: would export $TENANT_DB_NAME → $BACKUP_FILE"
    SUCCESSES=$((SUCCESSES + 1))
    MANIFEST_ENTRIES="$(echo "$MANIFEST_ENTRIES" | jq \
      --arg id "$TENANT_ID" \
      --arg slug "$TENANT_SLUG" \
      --arg db "$TENANT_DB_NAME" \
      --arg status "dry_run" \
      '. + [{ tenantId: $id, slug: $slug, databaseName: $db, status: $status }]')"
    continue
  fi

  set +e
  (
    cd "$STOREFRONT_DIR"
    npx wrangler d1 export "$TENANT_DB_NAME" --remote --output "$BACKUP_FILE"
  )
  EXPORT_RC=$?
  set -e

  if [[ "$EXPORT_RC" -ne 0 || ! -s "$BACKUP_FILE" ]]; then
    echo "  FAIL: export failed or empty (rc=$EXPORT_RC)"
    FAILURES=$((FAILURES + 1))
    MANIFEST_ENTRIES="$(echo "$MANIFEST_ENTRIES" | jq \
      --arg id "$TENANT_ID" \
      --arg slug "$TENANT_SLUG" \
      --arg db "$TENANT_DB_NAME" \
      --arg status "failed" \
      --arg reason "export_failed" \
      '. + [{ tenantId: $id, slug: $slug, databaseName: $db, status: $status, reason: $reason }]')"
    continue
  fi

  BACKUP_BYTES="$(wc -c < "$BACKUP_FILE" | tr -d ' ')"
  BACKUP_SHA256="$(shasum -a 256 "$BACKUP_FILE" | awk '{print $1}')"
  R2_KEY=""
  R2_STATUS="skipped"

  if [[ "$LOCAL_ONLY" -eq 0 && -n "$D1_BACKUP_R2_BUCKET" ]]; then
    R2_KEY="${D1_BACKUP_TRIGGER}/${RUN_ID}/${TENANT_DB_NAME}-${TS}.sql"
    set +e
    (
      cd "$STOREFRONT_DIR"
      npx wrangler r2 object put "${D1_BACKUP_R2_BUCKET}/${R2_KEY}" --file "$BACKUP_FILE" --remote
    )
    R2_RC=$?
    set -e
    if [[ "$R2_RC" -eq 0 ]]; then
      R2_STATUS="uploaded"
      echo "  R2: ${D1_BACKUP_R2_BUCKET}/${R2_KEY}"
    else
      R2_STATUS="upload_failed"
      echo "  WARN: R2 upload failed (rc=$R2_RC) — local file retained"
      FAILURES=$((FAILURES + 1))
    fi
  fi

  if [[ "$R2_STATUS" != "upload_failed" ]]; then
    SUCCESSES=$((SUCCESSES + 1))
    ENTRY_STATUS="ok"
  else
    ENTRY_STATUS="partial"
  fi

  echo "  OK bytes=$BACKUP_BYTES sha256=$BACKUP_SHA256"

  MANIFEST_ENTRIES="$(echo "$MANIFEST_ENTRIES" | jq \
    --arg id "$TENANT_ID" \
    --arg slug "$TENANT_SLUG" \
    --arg db "$TENANT_DB_NAME" \
    --arg file "$BACKUP_FILE" \
    --arg bytes "$BACKUP_BYTES" \
    --arg sha "$BACKUP_SHA256" \
    --arg status "$ENTRY_STATUS" \
    --arg r2Key "$R2_KEY" \
    --arg r2Status "$R2_STATUS" \
    --arg bucket "$D1_BACKUP_R2_BUCKET" \
    '. + [{
      tenantId: $id,
      slug: $slug,
      databaseName: $db,
      status: $status,
      file: $file,
      bytes: ($bytes | tonumber),
      sha256: $sha,
      r2Bucket: $bucket,
      r2Key: $r2Key,
      r2Status: $r2Status
    }]')"
done < "$TENANTS_TMP"

rm -f "$TENANTS_TMP"

OVERALL_SUCCESS=false
if [[ "$FAILURES" -eq 0 ]]; then
  OVERALL_SUCCESS=true
fi

jq -n \
  --arg runId "$RUN_ID" \
  --arg ts "$TS" \
  --arg trigger "$D1_BACKUP_TRIGGER" \
  --argjson success "$OVERALL_SUCCESS" \
  --argjson tenantCount "$TENANT_COUNT" \
  --argjson successes "$SUCCESSES" \
  --argjson failures "$FAILURES" \
  --argjson skipped "$SKIPPED" \
  --argjson tenants "$MANIFEST_ENTRIES" \
  --arg rpoDefault "24h" \
  --arg retentionScheduledDays "30" \
  --arg retentionManualDays "90" \
  '{
    runId: $runId,
    createdAt: $ts,
    trigger: $trigger,
    success: $success,
    tenantCount: $tenantCount,
    successes: $successes,
    failures: $failures,
    skipped: $skipped,
    rpoDefault: $rpoDefault,
    retention: {
      scheduledDays: ($retentionScheduledDays | tonumber),
      manualDays: ($retentionManualDays | tonumber),
      minimumDays: 7
    },
    tenants: $tenants
  }' > "$MANIFEST_FILE"

if [[ "$LOCAL_ONLY" -eq 0 && -n "$D1_BACKUP_R2_BUCKET" && "$DRY_RUN" -eq 0 ]]; then
  MANIFEST_R2_KEY="${D1_BACKUP_TRIGGER}/${RUN_ID}/manifest.json"
  set +e
  (
    cd "$STOREFRONT_DIR"
    npx wrangler r2 object put "${D1_BACKUP_R2_BUCKET}/${MANIFEST_R2_KEY}" --file "$MANIFEST_FILE" --remote
  )
  set -e
fi

echo ""
echo "=========================================="
echo "[D1 Backup] Done run_id=$RUN_ID"
echo "[D1 Backup] successes=$SUCCESSES failures=$FAILURES skipped=$SKIPPED"
echo "[D1 Backup] manifest=$MANIFEST_FILE"
echo "=========================================="

if [[ "$FAILURES" -gt 0 ]]; then
  exit 1
fi
exit 0
