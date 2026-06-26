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

# =============================================================================
# Copilot Worktrees (GitHub Copilot CLI sessies)
# =============================================================================
WORKTREE_BASE="$WORKSPACE_ROOT/copilot-worktrees/collections/my-vscode-workspace"

if [[ -d "$WORKTREE_BASE" ]]; then
  COPILOT_LINES=()

  for session_dir in "$WORKTREE_BASE"/*/; do
    session_slug=$(basename "$session_dir")
    for repo in "${REPOS[@]}"; do
      wt_path="$session_dir$repo"
      # Worktrees hebben een .git-bestand (niet een .git-map)
      if [[ ! -e "$wt_path/.git" ]]; then
        continue
      fi

      branch=$(git -C "$wt_path" branch --show-current 2>/dev/null || echo "?")
      dirty_count=$(git -C "$wt_path" status --porcelain --untracked-files=no 2>/dev/null | wc -l | tr -d ' ')

      ahead=0
      if git -C "$wt_path" rev-parse --abbrev-ref '@{u}' &>/dev/null; then
        ahead=$(git -C "$wt_path" rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
      fi

      # Rapporteer alleen als er iets te melden is
      if [[ "$dirty_count" -gt 0 || "$ahead" -gt 0 ]]; then
        label=""
        [[ "$dirty_count" -gt 0 ]] && label+="${dirty_count} dirty"
        [[ "$dirty_count" -gt 0 && "$ahead" -gt 0 ]] && label+=", "
        [[ "$ahead" -gt 0 ]] && label+="ahead ${ahead}"
        COPILOT_LINES+=("  🟡 $repo ($session_slug) — $branch — $label")
        WARNINGS=$((WARNINGS + 1))
      fi
    done
  done

  if [[ "${#COPILOT_LINES[@]}" -gt 0 ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 Copilot Worktrees (actieve sessies met open werk)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    for line in "${COPILOT_LINES[@]}"; do
      echo "$line"
    done
    echo ""
    echo "  → Commit of merge worktree-wijzigingen vóór nieuwe opdracht (zie AGENTS.md § Copilot Worktrees)."
    echo ""
  fi
fi

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

# =============================================================================
# Manager dashboard (ochtend-status) — Fase 0 workflow v2
# Vijf regels proza voor Sjoerd; geen branchnamen.
# =============================================================================

MANIFEST_FILE="$WORKSPACE_ROOT/pagayo-maintenance/releases/current.json"

# Workspace
if [[ "$WARNINGS" -gt 0 || ${#DIRTY_LIST[@]} -gt 0 ]]; then
  DASH_WORKSPACE="rood — eerst opruimen vóór nieuwe lane"
else
  DASH_WORKSPACE="groen — veilig om een nieuwe lane te starten"
fi

# Open lanes (geen registry in Fase 0)
LANE_HINT_COUNT=0
if [[ -d "$WORKTREE_BASE" ]]; then
  for session_dir in "$WORKTREE_BASE"/*/; do
    [[ -d "$session_dir" ]] || continue
    for repo in "${REPOS[@]}"; do
      wt_path="$session_dir$repo"
      if [[ -e "$wt_path/.git" ]]; then
        dirty_count=$(git -C "$wt_path" status --porcelain --untracked-files=no 2>/dev/null | wc -l | tr -d ' ')
        ahead=0
        if git -C "$wt_path" rev-parse --abbrev-ref '@{u}' &>/dev/null; then
          ahead=$(git -C "$wt_path" rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
        fi
        if [[ "$dirty_count" -gt 0 || "$ahead" -gt 0 ]]; then
          LANE_HINT_COUNT=$((LANE_HINT_COUNT + 1))
        fi
      fi
    done
  done
fi
if [[ "$MANIFEST_COUNT" -gt 0 ]]; then
  LANE_HINT_COUNT=$((LANE_HINT_COUNT + MANIFEST_COUNT))
fi
if [[ "$LANE_HINT_COUNT" -gt 3 ]]; then
  DASH_LANES="te veel parallel werk ($LANE_HINT_COUNT signalen) — herprioriteer (max 3 lanes)"
elif [[ "$LANE_HINT_COUNT" -gt 0 ]]; then
  DASH_LANES="$LANE_HINT_COUNT actief signaal — zie lane-chats (geen registry, Fase 0)"
else
  DASH_LANES="geen actieve lane-chats gesignaleerd — max 3 toegestaan"
fi

# Local Staging (Fase 1 tooling; dev-stack detectie alleen informatief)
DEV_PORT_PID="$(lsof -nP -iTCP:3000 -sTCP:LISTEN -t 2>/dev/null | head -1)" || true
LS_STATUS_SCRIPT="$WORKSPACE_ROOT/pagayo-maintenance/.github/scripts/local-staging-status.sh"
if [[ -x "$LS_STATUS_SCRIPT" ]] && "$LS_STATUS_SCRIPT" 2>/dev/null | head -1 | grep -q "aan"; then
  DASH_LOCAL="actief (core) — zie local-staging-status.sh"
elif [[ -n "$DEV_PORT_PID" ]]; then
  DASH_LOCAL="lokaal dev-stack draait — Local Staging integratie via local-staging-start.sh"
else
  DASH_LOCAL="niet actief — start met local-staging-start.sh (Fase 1)"
fi

# RC + Production uit current.json v1 (read-only)
DASH_RC="geen manifest gevonden"
DASH_PROD="onbekend — manifest v1 heeft geen prod SHA"

if [[ -f "$MANIFEST_FILE" ]]; then
  MANIFEST_SUMMARY=$(node -e "
    const fs = require('fs');
    const p = process.argv[1];
    const m = JSON.parse(fs.readFileSync(p, 'utf8'));
    const repos = m.repos || {};
    const withStaging = Object.entries(repos).filter(([, v]) => v && v.staging_sha);
    const storefront = repos['pagayo-storefront'];
    const updated = m.updated_at ? m.updated_at.slice(0, 10) : 'onbekend';
    const rcId = m.rc_id || null;
    const prodSha = m.prod_deployed_sha || null;
    console.log(JSON.stringify({
      rcId,
      updated,
      stagingCount: withStaging.length,
      storefrontShort: storefront && storefront.staging_sha ? storefront.staging_sha.slice(0, 7) : null,
      prodSha: prodSha ? prodSha.slice(0, 7) : null,
    }));
  " "$MANIFEST_FILE" 2>/dev/null || echo '{}')

  RC_ID=$(node -e "const o=JSON.parse(process.argv[1]); console.log(o.rcId||'')" "$MANIFEST_SUMMARY" 2>/dev/null || true)
  STAGING_COUNT=$(node -e "const o=JSON.parse(process.argv[1]); console.log(o.stagingCount||0)" "$MANIFEST_SUMMARY" 2>/dev/null || echo "0")
  MANIFEST_DATE=$(node -e "const o=JSON.parse(process.argv[1]); console.log(o.updated||'onbekend')" "$MANIFEST_SUMMARY" 2>/dev/null || echo "onbekend")
  STOREFRONT_SHORT=$(node -e "const o=JSON.parse(process.argv[1]); console.log(o.storefrontShort||'')" "$MANIFEST_SUMMARY" 2>/dev/null || true)
  PROD_SHORT=$(node -e "const o=JSON.parse(process.argv[1]); console.log(o.prodSha||'')" "$MANIFEST_SUMMARY" 2>/dev/null || true)

  if [[ -n "$RC_ID" ]]; then
    DASH_RC="RC $RC_ID op staging — klaar voor review of akkoord"
  elif [[ "$STAGING_COUNT" -gt 0 ]]; then
    DASH_RC="staging vastgelegd ($STAGING_COUNT repo's, bijgewerkt $MANIFEST_DATE) — geen RC-nummer (Fase 3)"
  else
    DASH_RC="geen staging vastgelegd in manifest"
  fi

  if [[ -n "$PROD_SHORT" ]]; then
    DASH_PROD="live versie vastgelegd — prod-actie alleen na expliciete go"
  else
    DASH_PROD="geen prod SHA in manifest v1 — productie alleen na expliciete go (playbook 04)"
  fi
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Manager dashboard (ochtend-status)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Workspace: $DASH_WORKSPACE"
echo "Open lanes: $DASH_LANES"
echo "Local Staging: $DASH_LOCAL"
echo "RC: $DASH_RC"
echo "Production: $DASH_PROD"
echo ""

exit 0
