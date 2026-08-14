#!/usr/bin/env bash
# Pagayo — gedeelde branch guards (Release Workflow v2)
# Source in integrate, ensure-branch, deployer-preflight, git-guard hooks.

# shellcheck disable=SC2034
branch_guard_lib_loaded=true

INTEGRATE_BRANCH="local/staging"
# One founder + AI: all daily work lives here. main = production history. GitHub = backup.
WORKING_BRANCH="pdc/current"

branch_guard_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null
}

branch_guard_current_branch() {
  git branch --show-current 2>/dev/null || echo ""
}

branch_guard_is_dirty() {
  [[ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]]
}

guard_clean_tree() {
  local action="${1:-branchwissel}"
  if branch_guard_is_dirty; then
    echo "❌ Dirty tree — geen $action zonder commit of stash."
    git status --short --untracked-files=no | head -20
    return 1
  fi
  return 0
}

guard_commit_branch() {
  local branch
  branch="$(branch_guard_current_branch)"
  if [[ "$branch" == "main" && "${PAGAYO_ALLOW_MAIN:-}" != "1" ]]; then
    echo "❌ Commit op main geblokkeerd — daily werk hoort op $WORKING_BRANCH."
    return 1
  fi
  return 0
}

guard_push_main() {
  local branch="${1:-$(branch_guard_current_branch)}"
  if [[ "$branch" == "main" && "${PAGAYO_ALLOW_MAIN:-}" != "1" ]]; then
    echo "❌ Push naar main geblokkeerd — expliciete toestemming Sjoerd vereist (PAGAYO_ALLOW_MAIN=1)."
    return 1
  fi
  return 0
}

guard_push_branch() {
  local branch="${1:-$(branch_guard_current_branch)}"
  if [[ "$branch" == "$INTEGRATE_BRANCH" && "${PAGAYO_ALLOW_LOCAL_STAGING_PUSH:-}" != "1" ]]; then
    echo "❌ Push van $INTEGRATE_BRANCH geblokkeerd — lokale integratiebranch, niet standaard naar GitHub."
    echo "   Push de kandidaat-lane (feature/*, hotfix/*) voor RC."
    return 1
  fi
  guard_push_main "$branch"
}

branch_guard_is_lane_branch() {
  local branch="$1"
  case "$branch" in
    pdc/current|hotfix/*|rc/*)
      return 0
      ;;
    feature/batch-staging-*)
      return 0
      ;;
    feature/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

guard_lane_branch() {
  local branch="${1:-$(branch_guard_current_branch)}"
  local strict="${PAGAYO_LANE_STRICT:-0}"

  if [[ "$branch" == "main" || "$branch" == "$INTEGRATE_BRANCH" ]]; then
    return 0
  fi

  if branch_guard_is_lane_branch "$branch"; then
    return 0
  fi

  if [[ "$strict" == "1" ]]; then
    echo "❌ Branch '$branch' is geen erkende lane ($WORKING_BRANCH, feature/*, hotfix/*)."
    return 1
  fi

  echo "⚠️  Branch '$branch' is geen standaard lane — doorgaan op eigen risico."
  return 0
}

branch_guard_tip_path() {
  local root
  root="$(branch_guard_repo_root)" || return 1
  local ws
  ws="$(cd "$root/.." && pwd)"
  echo "$ws/pagayo-maintenance/releases/current.json"
}

branch_guard_repo_name() {
  basename "$(branch_guard_repo_root)"
}

branch_guard_working_branch() {
  local tip repo entry
  tip="$(branch_guard_tip_path)"
  repo="$(branch_guard_repo_name)"
  if [[ -f "$tip" ]]; then
    entry="$(node -e "
      const fs=require('fs');
      const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
      const e=(m.repos||{})[process.argv[2]]||{};
      process.stdout.write(String(e.working_branch||''));
    " "$tip" "$repo" 2>/dev/null || true)"
    if [[ -n "$entry" ]]; then
      echo "$entry"
      return 0
    fi
  fi
  echo "$WORKING_BRANCH"
}

branch_guard_staging_sha() {
  local tip repo
  tip="$(branch_guard_tip_path)"
  repo="$(branch_guard_repo_name)"
  [[ -f "$tip" ]] || return 1
  node -e "
    const fs=require('fs');
    const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
    const e=(m.repos||{})[process.argv[2]]||{};
    process.stdout.write(String(e.staging_sha||''));
  " "$tip" "$repo" 2>/dev/null || true
}

# Daily base = PDC staging tip, never GitHub main.
branch_guard_resolve_base_ref() {
  local sha working
  sha="$(branch_guard_staging_sha || true)"
  if [[ -n "$sha" ]] && git cat-file -e "${sha}^{commit}" 2>/dev/null; then
    git rev-parse "$sha"
    return 0
  fi
  working="$(branch_guard_working_branch)"
  if git show-ref --verify --quiet "refs/heads/$working"; then
    echo "$working"
    return 0
  fi
  local current
  current="$(branch_guard_current_branch)"
  if [[ -n "$current" && "$current" != "main" && "$current" != "$INTEGRATE_BRANCH" ]]; then
    echo "HEAD"
    return 0
  fi
  echo ""
}

branch_guard_lane_name() {
  local suffix="${1:-}"
  if [[ "${PAGAYO_LANE_MODE:-}" == "legacy" ]]; then
    local today
    today="$(date +%Y%m%d)"
    if [[ -n "$suffix" ]]; then
      echo "feature/batch-staging-${today}-${suffix}"
    else
      echo "feature/batch-staging-${today}"
    fi
    return 0
  fi

  if [[ -n "$suffix" ]]; then
    echo "feature/${suffix}"
    return 0
  fi

  echo ""
}
