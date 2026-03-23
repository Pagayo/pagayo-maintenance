#!/bin/bash
#
# run-all-unit-tests.sh
# Draait unit tests in alle Pagayo repos en geeft gecombineerd overzicht.
#
# Gebruik:
#   ./scripts/run-all-unit-tests.sh          # Alle repos
#   ./scripts/run-all-unit-tests.sh beheer   # Alleen beheer
#

set -euo pipefail

WORKSPACE_ROOT="/Users/sjoerdoverdiep/my-vscode-workspace"

# Kleuren
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Repo configuratie: naam|commando
declare -a REPOS=(
  "pagayo-storefront|npx vitest run"
  "pagayo-api-stack|npx vitest run"
  "pagayo-edge|npx vitest run"
  "pagayo-workflows|npm run test:unit"
  "pagayo-config|npx vitest run"
  "pagayo-schema|npx vitest run"
)

# Filter op specifieke repo als argument meegegeven
FILTER="${1:-}"

TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_REPOS=0
FAILED_REPOS=()

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  Pagayo Platform — Unit Tests                       ║${NC}"
echo -e "${BOLD}║  $(date '+%Y-%m-%d %H:%M')                                     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

for entry in "${REPOS[@]}"; do
  IFS='|' read -r repo command <<< "$entry"

  # Filter check
  if [[ -n "$FILTER" && "$repo" != *"$FILTER"* ]]; then
    continue
  fi

  repo_path="$WORKSPACE_ROOT/$repo"

  if [[ ! -d "$repo_path" ]]; then
    echo -e "  ${YELLOW}○${NC} $repo — niet gevonden"
    continue
  fi

  TOTAL_REPOS=$((TOTAL_REPOS + 1))

  # Run tests (NO_COLOR om ANSI codes te voorkomen)
  echo -ne "  ⏳ $repo..."
  set +e
  output=$(cd "$repo_path" && NO_COLOR=1 eval "$command" 2>&1)
  exit_code=${PIPESTATUS[0]:-$?}
  set -e

  # Parse output (nu zonder ANSI codes)
  passed=$(echo "$output" | grep -E 'Tests\s+[0-9]+\s+passed' | grep -oE '[0-9]+' | head -1 || echo "0")
  total=$(echo "$output" | grep -E 'Tests\s+.*\([0-9]+\)' | grep -oE '\([0-9]+\)' | tr -d '()' | head -1 || echo "0")
  actual_failed=$(echo "$output" | grep -oE '[0-9]+\s+failed' | grep -oE '[0-9]+' | head -1 || echo "0")

  if [[ -z "$passed" ]]; then passed=0; fi
  if [[ -z "$total" ]]; then total=0; fi
  if [[ -z "$actual_failed" ]]; then actual_failed=0; fi

  # Als exit code non-zero maar geen explicit failed count → markeer als gefaald
  if [[ "$exit_code" -ne 0 && "$actual_failed" -eq 0 ]]; then
    actual_failed=1
  fi

  if [[ "$actual_failed" -gt 0 ]]; then
    echo -e "\r  ${RED}✗${NC} $repo — ${RED}${actual_failed}/${total} gefaald${NC}"
    TOTAL_FAILED=$((TOTAL_FAILED + actual_failed))
    FAILED_REPOS+=("$repo")
  elif [[ "$total" -eq 0 ]]; then
    echo -e "\r  ${YELLOW}○${NC} $repo — ${YELLOW}geen tests gevonden${NC}"
  else
    echo -e "\r  ${GREEN}✓${NC} $repo — ${GREEN}${passed}/${total} geslaagd${NC}"
  fi

  TOTAL_PASSED=$((TOTAL_PASSED + passed))
done

# Samenvatting
echo ""
echo -e "${BOLD}─────────────────────────────────────────────────────${NC}"

TOTAL_ALL=$((TOTAL_PASSED + TOTAL_FAILED))
if [[ ${#FAILED_REPOS[@]} -gt 0 ]]; then
  echo -e "  ${RED}FAIL${NC} — ${TOTAL_PASSED}/${TOTAL_ALL} tests geslaagd over ${TOTAL_REPOS} repos"
  echo ""
  echo -e "  ${RED}Gefaalde repos:${NC}"
  for r in "${FAILED_REPOS[@]}"; do
    echo -e "    ${RED}✗${NC} $r"
  done
  echo ""
  exit 1
else
  echo -e "  ${GREEN}PASS${NC} — ${TOTAL_PASSED} tests geslaagd over ${TOTAL_REPOS} repos"
fi

echo ""
