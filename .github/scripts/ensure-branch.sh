#!/usr/bin/env bash
# =============================================================================
# ENSURE-BRANCH — zet repo op de juiste feature/batch-staging branch
# =============================================================================
# Gebruik: ensure-branch.sh [repo-pad] [optionele-suffix]
#
# Controleert of de huidige branch voldoet aan de Pagayo-conventie:
#   feature/batch-staging-YYYYMMDD (optioneel: -suffix)
#
# Gedrag:
#   1. Als de branch al feature/batch-staging-YYYYMMDD* is → niets doen (✅)
#   2. Als main/develop/feature/* met ANDERE naam → aanbevolen branch tonen
#      en bij --auto (of geen uncommitted work) automatisch aanmaken/switchen
#   3. Als uncommitted work aanwezig is → STOP met instructie
#
# Exit codes:
#   0 — branch is ok of succesvol aangemaakt/geswitcht
#   1 — fout (uncommitted work, dirty tree, git-probleem)
# =============================================================================

set -euo pipefail

REPO_PATH="${1:-.}"
SUFFIX="${2:-}"
AUTO="${AUTO_BRANCH:-}"  # AUTO_BRANCH=1 voor niet-interactieve agents

TODAY=$(date +%Y%m%d)
EXPECTED_PREFIX="feature/batch-staging-${TODAY}"

# Kleuren (alleen als terminal)
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

print_header() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🌿 ENSURE-BRANCH — $(basename "$REPO_PATH")"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Valideer repo
if [[ ! -d "$REPO_PATH/.git" ]]; then
  echo -e "${RED}✗ Geen git-repo gevonden in: $REPO_PATH${NC}"
  exit 1
fi

print_header

CURRENT=$(git -C "$REPO_PATH" branch --show-current 2>/dev/null || echo "")

if [[ -z "$CURRENT" ]]; then
  echo -e "${RED}✗ Niet op een branch (detached HEAD?). Handmatige actie vereist.${NC}"
  exit 1
fi

# Bouw doel-branchnaam
if [[ -n "$SUFFIX" ]]; then
  TARGET="${EXPECTED_PREFIX}-${SUFFIX}"
else
  TARGET="${EXPECTED_PREFIX}"
fi

echo "  Repo:    $REPO_PATH"
echo "  Nu:      $CURRENT"
echo "  Gewenst: $TARGET (prefix)"
echo ""

# --- Geval 1: al op de juiste branch ---
if [[ "$CURRENT" == ${EXPECTED_PREFIX}* ]]; then
  echo -e "${GREEN}✅ Al op correcte branch: $CURRENT${NC}"
  echo ""
  exit 0
fi

# --- Geval 2: dirty tree → stop ---
DIRTY=$(git -C "$REPO_PATH" status --porcelain --untracked-files=no 2>/dev/null | wc -l | tr -d ' ')
if [[ "$DIRTY" -gt 0 ]]; then
  echo -e "${RED}✗ Uncommitted wijzigingen aanwezig ($DIRTY bestanden). Commit of stash eerst.${NC}"
  echo ""
  echo "  Commit: volg playbook 00-pre-commit.md"
  echo "  Stash:  git -C \"$REPO_PATH\" stash push -m \"wip: voor branch-switch\""
  echo ""
  exit 1
fi

# --- Geval 3: clean tree, verkeerde branch → aanmaken of switchen ---
# Kijk of target al bestaat (lokaal of remote)
LOCAL_EXISTS=$(git -C "$REPO_PATH" branch --list "$TARGET" | wc -l | tr -d ' ')
REMOTE_EXISTS=$(git -C "$REPO_PATH" branch -r --list "origin/$TARGET" | wc -l | tr -d ' ')

if [[ "$LOCAL_EXISTS" -gt 0 ]]; then
  echo -e "${YELLOW}⚠️  Branch $TARGET bestaat al lokaal. Switchen...${NC}"
  git -C "$REPO_PATH" checkout "$TARGET"
  echo -e "${GREEN}✅ Geswitcht naar: $TARGET${NC}"
elif [[ "$REMOTE_EXISTS" -gt 0 ]]; then
  echo -e "${YELLOW}⚠️  Branch $TARGET bestaat op remote. Track en switch...${NC}"
  git -C "$REPO_PATH" checkout -b "$TARGET" "origin/$TARGET"
  echo -e "${GREEN}✅ Geswitcht naar (remote tracked): $TARGET${NC}"
else
  # Nieuwe branch aanmaken vanuit huidige HEAD
  echo -e "${BLUE}→ Branch $TARGET bestaat nog niet. Aanmaken vanuit $CURRENT...${NC}"
  git -C "$REPO_PATH" checkout -b "$TARGET"
  echo -e "${GREEN}✅ Nieuwe branch aangemaakt: $TARGET${NC}"
fi

echo ""
echo "  Volgende stap: commit je werk via playbook 00-pre-commit.md"
echo ""
exit 0
