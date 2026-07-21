#!/usr/bin/env bash
# Pagayo — sync @pagayo/* packages vóór Local Staging (npm lockfile parity)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=local-dev-lib.sh
source "$SCRIPT_DIR/local-dev-lib.sh"

WS="$(local_dev_resolve_workspace "$SCRIPT_DIR")"
STALE_CONFIG=""
STALE_SCHEMA=""
STALE_DESIGN=""

echo "📦 Local Staging — package sync (npm-only design)"
echo "   Workspace: $WS"
echo ""

# Blokkeer dirty pagayo-design (mirror deployer-preflight CHECK 7)
if [[ -d "$WS/pagayo-design/.git" ]]; then
  design_dirty=$(git -C "$WS/pagayo-design" status --porcelain --untracked-files=no 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$design_dirty" -gt 0 ]]; then
    echo "❌ pagayo-design heeft $design_dirty uncommitted wijziging(en) — commit of stash eerst."
    exit 1
  fi
fi

if [[ -f "$WS/pagayo-config/dist/index.js" ]]; then
  STALE_CONFIG=$(find "$WS/pagayo-config/src" -name "*.ts" -newer "$WS/pagayo-config/dist/index.js" 2>/dev/null | head -1 || true)
fi
if [[ -f "$WS/pagayo-schema/dist/index.js" ]]; then
  STALE_SCHEMA=$(find "$WS/pagayo-schema/src" -name "*.ts" -newer "$WS/pagayo-schema/dist/index.js" 2>/dev/null | head -1 || true)
fi
if [[ -f "$WS/pagayo-design/dist/fresh/webshop.css" ]]; then
  STALE_DESIGN=$(find "$WS/pagayo-design/src" -newer "$WS/pagayo-design/dist/fresh/webshop.css" 2>/dev/null | head -1 || true)
fi

build_if_stale() {
  local pkg="$1"
  local stale="$2"
  if [[ -n "$stale" && -d "$WS/$pkg" ]]; then
    echo "   ▶ build $pkg (stale dist)"
    (cd "$WS/$pkg" && npm run build)
  fi
}

build_if_stale "pagayo-config" "$STALE_CONFIG"
build_if_stale "pagayo-schema" "$STALE_SCHEMA"
# Local Staging uses lockfile/node_modules design — never rebuild sibling
# pagayo-design here (that dirties dist/ and blocks the next start).
if [[ -n "$STALE_DESIGN" ]]; then
  echo "   ℹ️  design src newer than sibling dist — skip rebuild (PAGAYO_DESIGN_SOURCE=node_modules)"
  echo "      Publiceer + bump lockfile vóór RC als visuele wijziging online moet."
fi

sync_dist() {
  local from_pkg="$1"
  local consumer="$2"
  local npm_path="$WS/$consumer/node_modules/@pagayo/$from_pkg/dist"
  if [[ -d "$WS/$from_pkg/dist" && -d "$(dirname "$(dirname "$npm_path")")" ]]; then
    mkdir -p "$npm_path"
    cp -R "$WS/$from_pkg/dist/." "$npm_path/"
    echo "   ✓ @pagayo/$from_pkg → $consumer/node_modules"
  fi
}

CONSUMERS=(pagayo-storefront pagayo-api-stack)

for consumer in "${CONSUMERS[@]}"; do
  [[ -d "$WS/$consumer" ]] || continue
  if [[ -n "$STALE_CONFIG" ]]; then
    sync_dist "config" "$consumer"
  fi
  if [[ -n "$STALE_SCHEMA" ]]; then
    sync_dist "schema" "$consumer"
  fi
done

# Optionele migration check als schema lockfiles gewijzigd zijn
MIGRATION_SCRIPT="$SCRIPT_DIR/copilot-migration-check.sh"
if [[ -x "$MIGRATION_SCRIPT" ]]; then
  schema_touched=false
  for consumer in pagayo-storefront pagayo-api-stack pagayo-schema; do
    if [[ -d "$WS/$consumer/.git" ]]; then
      if git -C "$WS/$consumer" status --porcelain -- pagayo-schema 2>/dev/null | grep -q .; then
        schema_touched=true
      fi
    fi
  done
  if git -C "$WS/pagayo-schema" status --porcelain 2>/dev/null | grep -q .; then
    schema_touched=true
  fi
  if [[ "$schema_touched" == "true" ]]; then
    echo ""
    echo "📋 Schema/migratie wijzigingen gedetecteerd — copilot-migration-check"
    if ! "$MIGRATION_SCRIPT"; then
      echo "❌ copilot-migration-check gefaald"
      exit 1
    fi
  fi
fi

echo ""
echo "✅ Package sync voltooid"
