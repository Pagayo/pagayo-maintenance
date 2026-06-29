#!/usr/bin/env bash
# Pagayo — gedeelde branch guards (Release Workflow v2)
# Source in integrate, ensure-branch, deployer-preflight, git-guard hooks.

# shellcheck disable=SC2034
branch_guard_lib_loaded=true

INTEGRATE_BRANCH="local/staging"

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
    echo "❌ Commit op main geblokkeerd — gebruik een lane-branch of zet PAGAYO_ALLOW_MAIN=1 met expliciete opdracht."
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
    hotfix/*|rc/*)
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
    echo "❌ Branch '$branch' is geen erkende lane (feature/*, hotfix/*, feature/batch-staging-*)."
    return 1
  fi

  echo "⚠️  Branch '$branch' is geen standaard lane — doorgaan op eigen risico."
  return 0
}

branch_guard_resolve_base_ref() {
  if git show-ref --verify --quiet refs/remotes/origin/main; then
    echo "origin/main"
  elif git show-ref --verify --quiet refs/heads/main; then
    echo "main"
  else
    echo ""
  fi
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
