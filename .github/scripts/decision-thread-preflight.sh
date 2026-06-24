#!/usr/bin/env bash
# =============================================================================
# DECISION THREAD PRE-FLIGHT — blokkeer cross-thread vermenging vóór push
# =============================================================================
# Leest optioneel `.pagayo/decision-thread.json` (repo of workspace-root).
# Zonder manifest: faalt bij gemengde thread-signalen in staged/unstaged diff.
# Met manifest: faalt bij excludes in diff + branch-naam zonder slug/thread hint.
#
# Gebruik:
#   decision-thread-preflight.sh [repo-path]
#   decision-thread-preflight.sh --init --thread thread-admin-capability \
#     --slug today-surface-specification-v1 --repos pagayo-config,pagayo-storefront
#
# Exit 0 = OK · Exit 1 = blokkerend · Exit 2 = usage error
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

REPO_PATH="."
MODE="check"
THREAD_ID=""
SLUG=""
REPOS_CSV=""

usage() {
  cat <<'EOF'
Usage:
  decision-thread-preflight.sh [repo-path]
  decision-thread-preflight.sh --init --thread <thread_id> --slug <slug> [--repos a,b]

Manifest: .pagayo/decision-thread.json (repo eerst, anders workspace-root)
EOF
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --init)
      MODE="init"
      shift
      ;;
    --thread)
      THREAD_ID="${2:-}"
      shift 2
      ;;
    --slug)
      SLUG="${2:-}"
      shift 2
      ;;
    --repos)
      REPOS_CSV="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      if [[ "$MODE" == "check" && "$REPO_PATH" == "." ]]; then
        REPO_PATH="$1"
      else
        usage
      fi
      shift
      ;;
  esac
done

resolve_manifest() {
  local repo_root="$1"
  if [[ -f "$repo_root/.pagayo/decision-thread.json" ]]; then
    echo "$repo_root/.pagayo/decision-thread.json"
    return 0
  fi
  if [[ -f "$WORKSPACE_ROOT/.pagayo/decision-thread.json" ]]; then
    echo "$WORKSPACE_ROOT/.pagayo/decision-thread.json"
    return 0
  fi
  return 1
}

thread_for_exclude() {
  case "$1" in
    thread-revenue-today) echo "revenue" ;;
    thread-admin-capability) echo "admin" ;;
    *) echo "$1" ;;
  esac
}

# Returns 0 if path matches any pattern in array name passed as $1
path_matches_patterns() {
  local path="$1"
  shift
  local pattern
  for pattern in "$@"; do
    if [[ "$path" == *"$pattern"* ]]; then
      return 0
    fi
  done
  return 1
}

ADMIN_CAPABILITY_PATTERNS=(
  "src/today/v1"
  "today/v1"
  "TODAY_V1"
  "capability-first-read"
  "CAPABILITY_FIRST_READ"
  "policy/capabilities"
  "apply-capability-first-read"
  "resolve-capability-first-read"
  "capability-menu-mapping"
  "capability-today-mapping"
)

REVENUE_TODAY_PATTERNS=(
  "pages/admin/revenue"
  "admin/revenue"
  "REVENUE_TODAY"
  "menuRevenueToday"
  "RevenueToday"
  "RevenueIntelligence"
  "RevenueCustomers"
  "revenue.css"
  "repeat-revenue"
  "REPEAT_REVENUE"
  "admin.revenue."
)

classify_path() {
  local path="$1"
  local admin=0 revenue=0
  if path_matches_patterns "$path" "${ADMIN_CAPABILITY_PATTERNS[@]}"; then
    admin=1
  fi
  if path_matches_patterns "$path" "${REVENUE_TODAY_PATTERNS[@]}"; then
    revenue=1
  fi
  if [[ "$admin" -eq 1 && "$revenue" -eq 1 ]]; then
    echo "both"
  elif [[ "$admin" -eq 1 ]]; then
    echo "thread-admin-capability"
  elif [[ "$revenue" -eq 1 ]]; then
    echo "thread-revenue-today"
  else
    echo "neutral"
  fi
}

collect_changed_paths() {
  local repo_root="$1"
  (
    cd "$repo_root"
    {
      git diff --name-only
      git diff --cached --name-only
    } | sort -u
  )
}

run_init() {
  if [[ -z "$THREAD_ID" || -z "$SLUG" ]]; then
    echo "❌ --init vereist --thread en --slug"
    exit 2
  fi

  local exclude=""
  case "$THREAD_ID" in
    thread-admin-capability)
      exclude="thread-revenue-today"
      ;;
    thread-revenue-today)
      exclude="thread-admin-capability"
      ;;
    *)
      exclude=""
      ;;
  esac

  local repos_json="[]"
  if [[ -n "$REPOS_CSV" ]]; then
    repos_json=$(printf '%s' "$REPOS_CSV" | node -e "
      const s = require('fs').readFileSync(0,'utf8').trim();
      const arr = s.split(',').map(x => x.trim()).filter(Boolean);
      process.stdout.write(JSON.stringify(arr));
    ")
  fi

  local target_dir="$WORKSPACE_ROOT/.pagayo"
  mkdir -p "$target_dir"
  local manifest="$target_dir/decision-thread.json"

  node -e "
    const fs = require('fs');
    const doc = {
      version: 1,
      thread_id: process.argv[1],
      slug: process.argv[2],
      excludes: process.argv[3] ? [process.argv[3]] : [],
      repos: JSON.parse(process.argv[4]),
      created: new Date().toISOString().slice(0, 10),
      branch_hint: 'feature/batch-staging-YYYYMMDD-' + process.argv[2],
    };
    fs.writeFileSync(process.argv[5], JSON.stringify(doc, null, 2) + '\n');
  " "$THREAD_ID" "$SLUG" "$exclude" "$repos_json" "$manifest"

  echo "✅ Manifest geschreven: $manifest"
  echo "   Thread: $THREAD_ID"
  echo "   Slug:   $SLUG"
  if [[ -n "$exclude" ]]; then
    echo "   Excludes: $exclude"
  fi
  echo ""
  echo "Kopieer naar repos indien nodig:"
  echo "  mkdir -p REPO/.pagayo && cp $manifest REPO/.pagayo/"
  exit 0
}

run_check() {
  local repo_root
  repo_root="$(cd "$REPO_PATH" && git rev-parse --show-toplevel 2>/dev/null)" || {
    echo "❌ Geen git repo: $REPO_PATH"
    exit 1
  }

  local repo_name
  repo_name="$(basename "$repo_root")"
  local manifest=""
  manifest="$(resolve_manifest "$repo_root" 2>/dev/null)" || true

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 Decision thread check — $repo_name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local branch
  branch="$(git -C "$repo_root" branch --show-current)"

  local admin_files=()
  local revenue_files=()
  local neutral_count=0

  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    case "$(classify_path "$path")" in
      thread-admin-capability) admin_files+=("$path") ;;
      thread-revenue-today) revenue_files+=("$path") ;;
      both)
        admin_files+=("$path")
        revenue_files+=("$path")
        ;;
      neutral) neutral_count=$((neutral_count + 1)) ;;
    esac
  done < <(collect_changed_paths "$repo_root")

  local fail=false
  local warn=false

  # Repository placement — Revenue mock routes belong in pagayo-solutions only
  if [[ "$repo_name" == "pagayo-storefront" ]]; then
    local legacy_routes="$repo_root/src/features/revenue-today/routes.ts"
    if [[ -f "$legacy_routes" ]]; then
      echo "❌ Revenue placement: verwijder $legacy_routes (gebruik proxy.routes.ts → pagayo-solutions)"
      fail=true
    fi
  fi

  if [[ ${#admin_files[@]} -gt 0 && ${#revenue_files[@]} -gt 0 ]]; then
    echo "❌ Cross-thread mix gedetecteerd (admin-capability × revenue-today)"
    echo ""
    echo "   Admin/capability/Today v1 signalen:"
    printf '   - %s\n' "${admin_files[@]}" | head -12
    [[ ${#admin_files[@]} -gt 12 ]] && echo "   … (+$((${#admin_files[@]} - 12)) meer)"
    echo ""
    echo "   Revenue Today signalen:"
    printf '   - %s\n' "${revenue_files[@]}" | head -12
    [[ ${#revenue_files[@]} -gt 12 ]] && echo "   … (+$((${#revenue_files[@]} - 12)) meer)"
    echo ""
    echo "   FIX: split commits/branches per thread, of run:"
    echo "   pagayo-maintenance/.github/scripts/decision-thread-preflight.sh --init \\"
    echo "     --thread thread-admin-capability --slug <slug> --repos pagayo-config,pagayo-storefront"
    fail=true
  elif [[ ${#admin_files[@]} -eq 0 && ${#revenue_files[@]} -eq 0 ]]; then
    echo "ℹ️  Geen bekende thread-signalen in diff ($neutral_count andere bestanden)"
  else
    local active_thread=""
    if [[ ${#admin_files[@]} -gt 0 ]]; then
      active_thread="thread-admin-capability"
      echo "ℹ️  Diff matcht: thread-admin-capability (${#admin_files[@]} bestand(en))"
    else
      active_thread="thread-revenue-today"
      echo "ℹ️  Diff matcht: thread-revenue-today (${#revenue_files[@]} bestand(en))"
    fi

    if [[ -z "$manifest" ]]; then
      echo "⚠️  Geen .pagayo/decision-thread.json — overweeg manifest vóór push"
      warn=true
    fi
  fi

  if [[ -n "$manifest" ]]; then
    echo ""
    echo "📄 Manifest: $manifest"
    local declared_thread declared_slug
    declared_thread="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).thread_id)" "$manifest")"
    declared_slug="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).slug)" "$manifest")"

    echo "   Declared thread: $declared_thread"
    echo "   Declared slug:   $declared_slug"

    local branch_ok=false
    if [[ "$branch" == *"$declared_slug"* ]]; then
      branch_ok=true
    fi
    case "$declared_thread" in
      thread-admin-capability)
        [[ "$branch" == *"admin-capability"* || "$branch" == *"capability-first"* || "$branch" == *"today-v1"* || "$branch" == *"$declared_slug"* ]] && branch_ok=true
        ;;
      thread-revenue-today)
        [[ "$branch" == *"revenue-today"* || "$branch" == *"revenue"* || "$branch" == *"$declared_slug"* ]] && branch_ok=true
        ;;
    esac

    if [[ "$branch_ok" != "true" ]]; then
      echo "❌ Branch '$branch' bevat slug/thread hint niet (verwacht *$declared_slug* of thread-alias)"
      echo "   Voorbeeld: feature/batch-staging-$(date +%Y%m%d)-$declared_slug"
      fail=true
    else
      echo "✅ Branch bevat thread/slug hint"
    fi

    # Excluded thread files while manifest active
    local excludes_json
    excludes_json="$(node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).excludes||[]))" "$manifest")"
    local exclude_count
    exclude_count="$(node -e "console.log(JSON.parse(process.argv[1]).length)" "$excludes_json")"

    if [[ "$exclude_count" -gt 0 ]]; then
      local ex
      for ex in $(node -e "JSON.parse(process.argv[1]).forEach(x=>console.log(x))" "$excludes_json"); do
        case "$ex" in
          thread-revenue-today)
            if [[ ${#revenue_files[@]} -gt 0 && "$declared_thread" != "thread-revenue-today" ]]; then
              echo "❌ Manifest exclude '$ex' maar Revenue-signalen in diff"
              fail=true
            fi
            ;;
          thread-admin-capability)
            if [[ ${#admin_files[@]} -gt 0 && "$declared_thread" != "thread-admin-capability" ]]; then
              echo "❌ Manifest exclude '$ex' maar admin/capability-signalen in diff"
              fail=true
            fi
            ;;
        esac
      done
    fi
  fi

  echo ""
  if [[ "$fail" == "true" ]]; then
    echo "🛑 Decision thread check GEFAALD"
    exit 1
  fi
  if [[ "$warn" == "true" ]]; then
    echo "⚠️  Decision thread check OK met waarschuwing (manifest aanbevolen)"
    exit 0
  fi
  echo "✅ Decision thread check OK"
  exit 0
}

if [[ "$MODE" == "init" ]]; then
  run_init
else
  run_check
fi
