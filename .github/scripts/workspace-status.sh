#!/usr/bin/env bash
# =============================================================================
# WORKSPACE STATUS — read-only dashboard voor manager + agents
# =============================================================================
# Toont per Pagayo-repo: branch, dirty/clean, ahead/behind remote.
# Toont @pagayo/design drift (lokaal vs storefront lockfile vs DESIGN_ASSET_VERSION).
#
# Gebruik: workspace-status.sh [workspace-root]
# Exit 0 altijd (informatief); gebruik deployer-preflight.sh vóór push.
# =============================================================================

set -euo pipefail

WORKSPACE_ROOT="${1:-$(cd "$(dirname "$0")/../../.." && pwd)}"

REPOS=(
  pagayo-storefront
  pagayo-design
  pagayo-schema
  pagayo-config
  pagayo-api-stack
  pagayo-edge
  pagayo-workflows
  pagayo-marketing
  pagayo-maintenance
  pagayo-cloudflare-proxy
)

WARNINGS=0

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║              📊 PAGAYO WORKSPACE STATUS (read-only)                    ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📁 Workspace: $WORKSPACE_ROOT"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Repositories"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DIRTY_LIST=()
CLEAN_LIST=()

for repo in "${REPOS[@]}"; do
  repo_path="$WORKSPACE_ROOT/$repo"
  if [[ ! -d "$repo_path/.git" ]]; then
    echo "  ⊘  $repo — geen git repo (overgeslagen)"
    continue
  fi

  branch=$(git -C "$repo_path" branch --show-current 2>/dev/null || echo "?")
  dirty_count=$(git -C "$repo_path" status --porcelain --untracked-files=no 2>/dev/null | wc -l | tr -d ' ')

  ahead_behind=""
  if git -C "$repo_path" rev-parse --abbrev-ref '@{u}' &>/dev/null; then
    ahead=$(git -C "$repo_path" rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
    behind=$(git -C "$repo_path" rev-list --count 'HEAD..@{u}' 2>/dev/null || echo 0)
    if [[ "$ahead" != "0" || "$behind" != "0" ]]; then
      ahead_behind=" (ahead $ahead, behind $behind)"
    fi
  else
    ahead_behind=" (geen upstream)"
  fi

  if [[ "$dirty_count" -gt 0 ]]; then
    echo "  🔴 $repo — $branch — $dirty_count gewijzigde bestand(en)$ahead_behind"
    DIRTY_LIST+=("$repo")
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  🟢 $repo — $branch — schoon$ahead_behind"
    CLEAN_LIST+=("$repo")
  fi
done

echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 @pagayo/design (lokaal vs storefront)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DESIGN_LOCAL="$WORKSPACE_ROOT/pagayo-design"
STOREFRONT="$WORKSPACE_ROOT/pagayo-storefront"

if [[ -f "$DESIGN_LOCAL/package.json" ]]; then
  LOCAL_VER=$(grep -o '"version": *"[^"]*"' "$DESIGN_LOCAL/package.json" | head -1 | sed 's/.*: *"\(.*\)"/\1/')
  echo "  pagayo-design (lokaal package.json): $LOCAL_VER"

  design_dirty=$(git -C "$DESIGN_LOCAL" status --porcelain --untracked-files=no 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$design_dirty" -gt 0 ]]; then
    echo "  ⚠️  pagayo-design heeft $design_dirty uncommitted wijziging(en)"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo "  ⊘  pagayo-design niet gevonden"
  LOCAL_VER=""
fi

if [[ -d "$STOREFRONT" ]]; then
  LOCK_VER=""
  if [[ -f "$STOREFRONT/package-lock.json" ]]; then
    LOCK_VER=$(node -e "
      const lock = require('$STOREFRONT/package-lock.json');
      const p = lock.packages && lock.packages['node_modules/@pagayo/design'];
      console.log(p && p.version ? p.version : '');
    " 2>/dev/null || true)
  fi
  echo "  storefront lockfile @pagayo/design: ${LOCK_VER:-onbekend}"

  ASSET_VER=""
  ASSET_FILE="$STOREFRONT/src/workers/generated/design-asset-version.ts"
  if [[ -f "$ASSET_FILE" ]]; then
    ASSET_VER=$(grep -o 'DESIGN_ASSET_VERSION = "[^"]*"' "$ASSET_FILE" | sed 's/.*"\(.*\)"/\1/' || true)
    echo "  storefront DESIGN_ASSET_VERSION:    ${ASSET_VER:-onbekend}"
  fi

  if [[ -n "$LOCAL_VER" && -n "$LOCK_VER" && "$LOCAL_VER" != "$LOCK_VER" ]]; then
    echo "  🚨 DRIFT: lokaal design $LOCAL_VER ≠ lockfile $LOCK_VER"
    echo "     → Staging/productie gebruiken lockfile/npm, niet je lokale dist."
    WARNINGS=$((WARNINGS + 1))
  elif [[ -n "$LOCAL_VER" && -n "$LOCK_VER" ]]; then
    echo "  ✅ design package.json = lockfile ($LOCK_VER)"
  fi

  if [[ -n "$ASSET_VER" && -n "$LOCK_VER" && "$ASSET_VER" != "$LOCK_VER" ]]; then
    echo "  🚨 DRIFT: DESIGN_ASSET_VERSION ($ASSET_VER) ≠ lockfile ($LOCK_VER)"
    echo "     → Run: PAGAYO_DESIGN_SOURCE=node_modules npm run copy-design (in storefront)"
    WARNINGS=$((WARNINGS + 1))
  elif [[ -n "$ASSET_VER" && -n "$LOCK_VER" ]]; then
    echo "  ✅ DESIGN_ASSET_VERSION = lockfile"
  fi
else
  echo "  ⊘  pagayo-storefront niet gevonden"
fi

echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Advies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ ${#DIRTY_LIST[@]} -gt 0 ]]; then
  echo "  • Dirty repos: ${DIRTY_LIST[*]}"
  echo "    → Laat AI playbook 00 doen (commit per afgeronde opdracht) vóór een nieuwe chat."
fi

if [[ ${#DIRTY_LIST[@]} -eq 0 ]]; then
  echo "  • Alle gescande repos zijn schoon — veilig om een nieuwe opdracht te starten."
fi

if [[ "$WARNINGS" -gt 0 ]]; then
  echo ""
  echo "  ⚠️  $WARNINGS aandachtspunt(en) — los op vóór push (deployer-preflight.sh)."
else
  echo ""
  echo "  ✅ Geen blokkerende aandachtspunten in deze scan."
fi

echo ""
exit 0
