#!/usr/bin/env bash
# =============================================================================
# Pagayo — Lokale periodieke regressie (orchestrator)
# =============================================================================
# Start/verifieert local-dev, draait vitale storefront Playwright E2E lokaal,
# schrijft rapport naar logdir en toont macOS-notificatie bij failure.
#
# Gebruik:
#   ./scripts/run-local-regression-suite.sh              # standaard run
#   ./scripts/run-local-regression-suite.sh --force        # negeer om-de-dag skip
#   ./scripts/run-local-regression-suite.sh --skip-e2e     # alleen health/preflight
#   ./scripts/run-local-regression-suite.sh --with-validate  # + storefront ci:validate
#
# Schedule (om de nacht, om de dag): installeer launchd plist:
#   ./scripts/install-local-regression-schedule.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAINTENANCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="${PAGAYO_WORKSPACE:-/Users/sjoerdoverdiep/my-vscode-workspace}"
STOREFRONT="$WORKSPACE/pagayo-storefront"
LOG_DIR="${PAGAYO_LOCAL_REGRESSION_LOG_DIR:-/tmp/pagayo-local-regression}"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$LOG_DIR/run-$RUN_ID.log"
SUMMARY_FILE="$LOG_DIR/latest-summary.txt"

FORCE_RUN=0
SKIP_E2E=0
WITH_VALIDATE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE_RUN=1 ;;
    --skip-e2e) SKIP_E2E=1 ;;
    --with-validate) WITH_VALIDATE=1 ;;
    *)
      echo "Onbekende optie: $1"
      exit 2
      ;;
  esac
  shift
done

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

# shellcheck source=lib/macos-notify.sh
source "$SCRIPT_DIR/lib/macos-notify.sh"

fail_with_notify() {
  local category="$1"
  local detail="$2"
  echo ""
  echo "❌ FAIL [$category] $detail"
  pagayo_macos_notify_failure "$category" "$detail" "$LOG_FILE"
  {
    echo "status=fail"
    echo "category=$category"
    echo "detail=$detail"
    echo "log=$LOG_FILE"
    echo "finished=$(date -Iseconds)"
  } >"$SUMMARY_FILE"
  exit 1
}

echo "═══════════════════════════════════════════════════════════════"
echo " Pagayo lokale regressie — $RUN_ID"
echo " Log: $LOG_FILE"
echo "═══════════════════════════════════════════════════════════════"

# Om-de-dag gate (even dagen sinds epoch) — tenzij --force of handmatige run via FORCE env
if [[ "$FORCE_RUN" -eq 0 && "${PAGAYO_LOCAL_REGRESSION_FORCE:-0}" != "1" ]]; then
  day_index=$(( $(date +%s) / 86400 ))
  if (( day_index % 2 != 0 )); then
    echo "ℹ️  Skip: geplande run alleen op even dagen (gebruik --force om toch te draaien)."
    exit 0
  fi
fi

echo ""
echo "▸ Workspace status (read-only)"
if ! "$WORKSPACE/pagayo-maintenance/.github/scripts/workspace-status.sh"; then
  fail_with_notify "workspace" "workspace-status rapporteerde blokkerende drift"
fi

echo ""
echo "▸ Local dev health"
if ! "$MAINTENANCE_ROOT/.github/scripts/local-dev-status.sh" >/dev/null 2>&1; then
  echo "   Local dev niet bereikbaar — start stack..."
  if ! "$MAINTENANCE_ROOT/.github/scripts/local-dev-start.sh"; then
    fail_with_notify "local-dev" "local-dev-start mislukt"
  fi
fi

health_ok=1
check_url() {
  local label="$1"
  local url="$2"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" || echo "000")"
  if [[ "$code" == "200" || "$code" == "302" ]]; then
    echo "   ✅ $label ($code)"
  else
    echo "   ❌ $label ($code)"
    health_ok=0
  fi
}

check_url "Storefront (test tenant)" "http://localhost:3000/?tenant=test"
check_url "Storefront demo" "http://demo.localhost:3000/"
check_url "Vite assets" "http://localhost:5173/assets/"
check_url "CSS serve" "http://localhost:5500/design/dist/fresh/webshop.css"

if [[ "$health_ok" -ne 1 ]]; then
  echo "   Probeer local-dev opnieuw te starten..."
  if ! "$MAINTENANCE_ROOT/.github/scripts/local-dev-start.sh"; then
    fail_with_notify "local-dev" "health check faalde na herstart"
  fi
  health_ok=1
  check_url "Storefront demo (retry)" "http://demo.localhost:3000/"
  check_url "Vite assets (retry)" "http://localhost:5173/assets/"
  if [[ "$health_ok" -ne 1 ]]; then
    fail_with_notify "local-dev" "services niet bereikbaar op demo.localhost:3000"
  fi
fi

if [[ "$WITH_VALIDATE" -eq 1 ]]; then
  echo ""
  echo "▸ Storefront ci:validate (optioneel)"
  if ! (cd "$STOREFRONT" && npm run ci:validate); then
    fail_with_notify "validate" "storefront ci:validate gefaald"
  fi
fi

if [[ "$SKIP_E2E" -eq 1 ]]; then
  echo ""
  echo "✅ Preflight/health OK (--skip-e2e)"
  pagayo_macos_notify_success
  {
    echo "status=pass"
    echo "scope=preflight-only"
    echo "log=$LOG_FILE"
    echo "finished=$(date -Iseconds)"
  } >"$SUMMARY_FILE"
  exit 0
fi

echo ""
echo "▸ Storefront lokale E2E regressie (vitale flows)"
if [[ ! -d "$STOREFRONT" ]]; then
  fail_with_notify "storefront" "repo niet gevonden: $STOREFRONT"
fi

export PLAYWRIGHT_LOCAL_BASE_URL="${PLAYWRIGHT_LOCAL_BASE_URL:-http://localhost:3000?tenant=test}"

if ! (cd "$STOREFRONT" && npm run test:e2e:local:regression); then
  first_fail=""
  results_json="$STOREFRONT/playwright-report/local-regression/results.json"
  if [[ -f "$results_json" ]]; then
    first_fail="$(node -e "
      const fs = require('fs');
      const p = process.argv[1];
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        const spec = (data.suites || [])
          .flatMap(function walk(s) { return (s.specs || []).concat((s.suites || []).flatMap(walk)); })
          .flatMap((s) => s.tests || [])
          .find((t) => (t.results || []).some((r) => r.status === 'failed' || r.status === 'timedOut'));
        if (spec && spec.title) process.stdout.write(spec.title);
      } catch (_) { /* ignore parse errors */ }
    " "$results_json" 2>/dev/null || true)"
  fi
  detail="Playwright local regression faalde"
  if [[ -n "$first_fail" ]]; then
    detail="${detail} — ${first_fail}"
  fi
  fail_with_notify "e2e-regression" "$detail"
fi

echo ""
echo "✅ Lokale regressie suite groen"
pagayo_macos_notify_success
{
  echo "status=pass"
  echo "scope=full"
  echo "log=$LOG_FILE"
  echo "finished=$(date -Iseconds)"
} >"$SUMMARY_FILE"
exit 0
