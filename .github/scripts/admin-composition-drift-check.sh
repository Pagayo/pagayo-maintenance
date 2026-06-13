#!/bin/bash
# =============================================================================
# ADMIN COMPOSITION DRIFT CHECK
# =============================================================================
# Validates storefront admin composition claims (code ↔ matrix ↔ L3 docs).
# SSoT claims: pagayo-storefront/docs/admin-composition-claims.json
# Intent: pagayo-storefront/docs/ADMIN-INTERFACE-MATRIX.md § Composition patterns
#
# Gebruik: ./admin-composition-drift-check.sh [workspace-root]
# Exit 0 = ok. Exit 1 = actionable output.
# =============================================================================

set -euo pipefail

WORKSPACE="${1:-/Users/sjoerdoverdiep/my-vscode-workspace}"
STOREFRONT="$WORKSPACE/pagayo-storefront"

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║            🧭 ADMIN COMPOSITION DRIFT CHECK                            ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

if [[ ! -d "$STOREFRONT" ]]; then
  echo "❌ pagayo-storefront niet gevonden: $STOREFRONT"
  exit 1
fi

if [[ ! -f "$STOREFRONT/docs/admin-composition-claims.json" ]]; then
  echo "❌ Claims file ontbreekt: pagayo-storefront/docs/admin-composition-claims.json"
  exit 1
fi

(
  cd "$STOREFRONT"
  npx tsx scripts/validate-admin-composition-claims.ts
)

echo ""
echo "✅ Geen compositie-drift gedetecteerd."
