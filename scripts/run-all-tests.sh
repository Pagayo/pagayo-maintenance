#!/bin/bash
# ============================================================================
# PAGAYO PLATFORM - COMPLETE TEST SUITE
# ============================================================================
# Dit script draait alle tests en genereert een AI-leesbaar rapport
# 
# USAGE: ./scripts/run-all-tests.sh [--quick]
#   --quick: Skip performance tests (sneller)
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================================================"
echo "PAGAYO PLATFORM - COMPLETE TEST SUITE"
echo "============================================================================"
echo "Started: $(date)"
echo ""

# Parse arguments
QUICK=false
for arg in "$@"; do
  case $arg in
    --quick)
      QUICK=true
      shift
      ;;
  esac
done

cd "$(dirname "$0")/.."

echo "📋 TEST PLAN:"
echo "  1. Smoke Tests - Core services health"
echo "  2. Security Tests - Auth, access control"
echo "  3. Integration Tests - Cross-service flows"
echo "  4. Contract Tests - API response schemas"
if [ "$QUICK" = false ]; then
  echo "  5. Performance Tests - Response times"
fi
echo ""

# Run tests and capture output
echo "============================================================================"
echo "RUNNING TESTS..."
echo "============================================================================"

if [ "$QUICK" = true ]; then
  npm run test -- --reporter=verbose --exclude="**/performance/**" 2>&1 | tee /tmp/pagayo-test-output.txt
else
  npm run test -- --reporter=verbose 2>&1 | tee /tmp/pagayo-test-output.txt
fi

# Parse results
PASSED=$(grep -c "✓" /tmp/pagayo-test-output.txt 2>/dev/null || echo "0")
FAILED=$(grep -c "✗\|FAIL" /tmp/pagayo-test-output.txt 2>/dev/null || echo "0")
WARNINGS=$(grep -c "⚠" /tmp/pagayo-test-output.txt 2>/dev/null || echo "0")

echo ""
echo "============================================================================"
echo "RAPPORT VOOR AI AGENT"
echo "============================================================================"
echo ""
echo "SAMENVATTING:"
echo "  Tests Passed: $PASSED"
echo "  Tests Failed: $FAILED"
echo "  Warnings:     $WARNINGS"
echo ""

# Extract and show failures
if [ "$FAILED" != "0" ]; then
  echo -e "${RED}🚨 FAILURES DETECTED:${NC}"
  grep -A3 "FAIL\|✗" /tmp/pagayo-test-output.txt | head -50
  echo ""
fi

# Extract warnings
if [ "$WARNINGS" != "0" ]; then
  echo -e "${YELLOW}⚠️  WARNINGS:${NC}"
  grep "⚠\|WARN\|KNOWN ISSUE" /tmp/pagayo-test-output.txt | head -20
  echo ""
fi

# Show service status summary from logs
echo "SERVICE STATUS:"
grep "\[SMOKE\] ✓" /tmp/pagayo-test-output.txt | sed 's/\[SMOKE\] ✓/  ✓/' | head -20

echo ""
echo "============================================================================"
echo "ACTIE ITEMS VOOR AI AGENT:"
echo "============================================================================"

if [ "$FAILED" != "0" ]; then
  echo "1. FIX FAILURES: Zie bovenstaande failures en actie instructies"
fi

if grep -q "KNOWN ISSUE" /tmp/pagayo-test-output.txt; then
  echo "2. KNOWN ISSUES: Products/categories endpoint 500 errors (storefront)"
fi

if grep -q "Cloudflare Access" /tmp/pagayo-test-output.txt; then
  echo "3. CF ACCESS: Sommige endpoints achter Cloudflare Access (verwacht)"
fi

echo ""
echo "Completed: $(date)"
echo "============================================================================"

# Exit with appropriate code
if [ "$FAILED" != "0" ]; then
  exit 1
else
  exit 0
fi
