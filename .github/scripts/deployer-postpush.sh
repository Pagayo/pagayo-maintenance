#!/bin/bash
# =============================================================================
# DEPLOYER AGENT POST-PUSH CHECK
# =============================================================================
# Dit script MOET gedraaid worden NA elke git push naar main.
# Het wacht op de CI/Deploy workflow en toont logs bij failure.
#
# Gebruik: ./deployer-postpush.sh [repo-path] [commit-sha]
#
# Aangemaakt: 12 februari 2026
# Aanleiding: 5 pushes naar storefront main die allemaal faalden in CI,
#             maar niet ontdekt werden omdat niemand op het resultaat wachtte.
# =============================================================================

set -e

REPO_PATH="${1:-.}"
COMMIT_SHA="${2:-}"
cd "$REPO_PATH"

REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")

# Als geen commit meegegeven, pak HEAD
if [[ -z "$COMMIT_SHA" ]]; then
    COMMIT_SHA=$(git rev-parse HEAD)
fi
COMMIT_SHORT="${COMMIT_SHA:0:7}"

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║              📡 DEPLOYER POST-PUSH CHECK                               ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📁 Repository: $REPO_NAME"
echo "📦 Commit:     $COMMIT_SHORT"
echo ""

# Check of gh CLI beschikbaar is
if ! command -v gh &> /dev/null; then
    echo "❌ gh CLI niet beschikbaar — kan CI niet monitoren!"
    echo "   Installeer met: brew install gh"
    exit 1
fi

# =============================================================================
# STAP 1: Wacht tot CI runs verschijnen voor dit commit
# =============================================================================
echo "⏳ Wachten op CI runs voor commit $COMMIT_SHORT..."

MAX_WAIT=60
WAITED=0
RUNS_FOUND=false

while [[ $WAITED -lt $MAX_WAIT ]]; do
    RUN_COUNT=$(gh run list --commit "$COMMIT_SHA" --json databaseId --jq 'length' 2>/dev/null || echo "0")
    if [[ "$RUN_COUNT" -gt 0 ]]; then
        RUNS_FOUND=true
        break
    fi
    sleep 5
    WAITED=$((WAITED + 5))
    echo "   ... ${WAITED}s/${MAX_WAIT}s gewacht"
done

if [[ "$RUNS_FOUND" != "true" ]]; then
    echo "❌ Geen CI runs gevonden na ${MAX_WAIT}s!"
    echo "   Controleer of GitHub Actions workflows correct geconfigureerd zijn."
    exit 1
fi

echo "✅ ${RUN_COUNT} CI run(s) gevonden"
echo ""

# =============================================================================
# STAP 2: Verzamel alle run IDs
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Wachten op alle workflows..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Haal alle run IDs op voor dit commit
ALL_RUN_IDS=$(gh run list --commit "$COMMIT_SHA" --json databaseId --jq '.[].databaseId' 2>/dev/null)

ALL_PASSED=true
FAILED_RUNS=""

# =============================================================================
# STAP 3: Wacht op elke workflow en check resultaat
# =============================================================================
for RUN_ID in $ALL_RUN_IDS; do
    if [[ -z "$RUN_ID" ]]; then continue; fi

    RUN_NAME=$(gh run view "$RUN_ID" --json name --jq '.name' 2>/dev/null || echo "unknown")
    echo ""
    echo "🔄 Wachten op: $RUN_NAME (run $RUN_ID)..."

    # gh run watch wacht tot de run klaar is
    if gh run watch "$RUN_ID" --exit-status > /dev/null 2>&1; then
        echo "✅ $RUN_NAME: GESLAAGD"
    else
        echo "❌ $RUN_NAME: GEFAALD"
        ALL_PASSED=false
        FAILED_RUNS="$FAILED_RUNS $RUN_ID"
    fi
done

echo ""

# =============================================================================
# STAP 4: Bij failure → toon logs
# =============================================================================
if [[ "$ALL_PASSED" != "true" ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔴 CI/DEPLOY GEFAALD — LOGS:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    for RUN_ID in $FAILED_RUNS; do
        RUN_NAME=$(gh run view "$RUN_ID" --json name --jq '.name' 2>/dev/null || echo "unknown")
        echo ""
        echo "═══ $RUN_NAME (run $RUN_ID) ═══"
        echo ""
        gh run view "$RUN_ID" --log-failed 2>&1 | tail -40
        echo ""
    done

    echo "╔════════════════════════════════════════════════════════════════════════╗"
    echo "║  ❌ PRODUCTIE IS NIET GEDEPLOYD!                                      ║"
    echo "║                                                                       ║"
    echo "║  De code is gepusht maar CI/deploy is gefaald.                       ║"
    echo "║  Opties:                                                              ║"
    echo "║  1. Fix de CI errors en push opnieuw                                 ║"
    echo "║  2. Deploy handmatig: npx wrangler deploy --env production           ║"
    echo "║  3. Escaleer naar Sjoerd                                              ║"
    echo "╚════════════════════════════════════════════════════════════════════════╝"
    exit 1
else
    echo "╔════════════════════════════════════════════════════════════════════════╗"
    echo "║  ✅ ALLE WORKFLOWS GESLAAGD — PRODUCTIE IS GEDEPLOYD!                ║"
    echo "╚════════════════════════════════════════════════════════════════════════╝"

    # Health check per bekende service
    case "$REPO_NAME" in
        pagayo-storefront)
            HEALTH_URL="https://demo.pagayo.app/health" ;;

        pagayo-api-stack)
            HEALTH_URL="https://api.pagayo.com/api/health" ;;
        *)
            HEALTH_URL="" ;;
    esac

    if [[ -n "$HEALTH_URL" ]]; then
        echo ""
        echo "🔍 Health check: $HEALTH_URL"
        sleep 10
        HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
        if [[ "$HTTP_CODE" == "200" ]]; then
            echo "✅ Productie health check: OK (HTTP $HTTP_CODE)"
        else
            echo "⚠️  Productie health check: HTTP $HTTP_CODE — controleer handmatig"
        fi
    fi

    exit 0
fi
