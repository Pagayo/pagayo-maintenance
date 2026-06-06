#!/usr/bin/env bash
# =============================================================================
# RELEASE DOCTOR — read-only release diagnose voor agents + Sjoerd
# =============================================================================
# Vat release-playbooks 00-03 samen naar compacte output en JSON.
#
# Gebruik:
#   release-doctor.sh [repo-path] [--phase 00|01|02|03|auto] [--json-out path]
#
# Exit codes:
#   0 = ok
#   1 = waarschuwingen / actie nodig
#   2 = harde blokkade
# =============================================================================

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
WORKSPACE_ROOT="${PAGAYO_WORKSPACE_ROOT:-$DEFAULT_WORKSPACE_ROOT}"

REPO_PATH=""
REQUESTED_PHASE="auto"
JSON_OUT=""

usage() {
  cat <<'EOF'
Gebruik: release-doctor.sh [repo-path] [--phase 00|01|02|03|auto] [--json-out path]

Read-only diagnose. Voert geen commit, push, merge, checkout, deploy of workflow_dispatch uit.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase)
      if [[ $# -lt 2 ]]; then
        echo "release-doctor: --phase mist waarde" >&2
        exit 2
      fi
      REQUESTED_PHASE="$2"
      shift 2
      ;;
    --json-out)
      if [[ $# -lt 2 ]]; then
        echo "release-doctor: --json-out mist pad" >&2
        exit 2
      fi
      JSON_OUT="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    -*)
      echo "release-doctor: onbekende optie: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [[ -n "$REPO_PATH" ]]; then
        echo "release-doctor: meerdere repo-paden opgegeven" >&2
        exit 2
      fi
      REPO_PATH="$1"
      shift
      ;;
  esac
done

case "$REQUESTED_PHASE" in
  00|01|02|03|auto) ;;
  *)
    echo "release-doctor: ongeldige phase '$REQUESTED_PHASE' (verwacht 00|01|02|03|auto)" >&2
    exit 2
    ;;
esac

if [[ -z "$REPO_PATH" ]]; then
  REPO_PATH="."
fi

if ! REPO_PATH="$(cd "$REPO_PATH" 2>/dev/null && pwd)"; then
  echo "release-doctor: repo-pad bestaat niet of is niet toegankelijk" >&2
  exit 2
fi

BLOCKERS=()
WARNINGS=()
NEXT_ACTIONS=()
GUARDS=(
  "Geen push naar main zonder expliciete toestemming van Sjoerd."
  "Geen productie-deploy vanuit release-doctor; playbook 04 blijft menselijk mandaat."
  "Geen secrets, deploy tokens of destructive git-acties in output of rapportage."
)

add_blocker() {
  BLOCKERS+=("$1")
}

add_warning() {
  WARNINGS+=("$1")
}

add_action() {
  NEXT_ACTIONS+=("$1")
}

json_array_env() {
  local IFS=$'\n'
  printf '%s' "$*"
}

read_json_value() {
  local file="$1"
  local expression="$2"
  node -e "
    const fs = require('fs');
    try {
      const json = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      const value = (${expression})(json);
      if (value !== undefined && value !== null) process.stdout.write(String(value));
    } catch {}
  " "$file" 2>/dev/null
}

if ! git -C "$REPO_PATH" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  REPO_BASENAME="$(basename "$REPO_PATH")"
  add_blocker "Geen git-repository: $REPO_PATH"
  add_action "Geef een geldig Pagayo repo-pad op, bijvoorbeeld pagayo-storefront of pagayo-maintenance."

  STATUS="blocked"
  REPO="$REPO_BASENAME"
  BRANCH=""
  SHA=""
  UPSTREAM=""
  AHEAD="0"
  BEHIND="0"
  DIRTY_COUNT="0"
  RECOMMENDED_PHASE="$REQUESTED_PHASE"
  [[ "$RECOMMENDED_PHASE" == "auto" ]] && RECOMMENDED_PHASE="00"
  CI_STATUS="not_checked"
  CI_CONCLUSION=""
  CI_RUN_ID=""
  CI_HEAD_SHA=""
  CI_WORKFLOW=""
  DESIGN_LOCAL_VERSION=""
  DESIGN_LOCK_VERSION=""
  DESIGN_ASSET_VERSION=""
  DESIGN_LOCAL_DIRTY="0"
  DESIGN_STATUS="not_checked"
  MIGRATION_TOUCHED="false"
  MIGRATION_STATUS="not_checked"
else
  GIT_ROOT="$(git -C "$REPO_PATH" rev-parse --show-toplevel)"
  REPO="$(basename "$GIT_ROOT")"
  BRANCH="$(git -C "$GIT_ROOT" branch --show-current 2>/dev/null || true)"
  SHA="$(git -C "$GIT_ROOT" rev-parse --short HEAD 2>/dev/null || true)"
  UPSTREAM="$(git -C "$GIT_ROOT" rev-parse --abbrev-ref '@{u}' 2>/dev/null || true)"
  DIRTY_COUNT="$(git -C "$GIT_ROOT" status --porcelain --untracked-files=no 2>/dev/null | wc -l | tr -d ' ')"

  AHEAD="0"
  BEHIND="0"
  if [[ -n "$UPSTREAM" ]]; then
    AHEAD="$(git -C "$GIT_ROOT" rev-list --count "$UPSTREAM..HEAD" 2>/dev/null || echo 0)"
    BEHIND="$(git -C "$GIT_ROOT" rev-list --count "HEAD..$UPSTREAM" 2>/dev/null || echo 0)"
  else
    if [[ "$REQUESTED_PHASE" == "01" || "$REQUESTED_PHASE" == "02" || "$REQUESTED_PHASE" == "03" ]]; then
      add_warning "Geen upstream ingesteld voor branch '$BRANCH'."
      add_action "Push de branch met upstream zodra playbook 01 aan de beurt is."
    fi
  fi

  if [[ -z "$BRANCH" ]]; then
    add_blocker "Detached HEAD; release-playbooks verwachten een normale branch."
    add_action "Vraag Sjoerd welke branch gebruikt moet worden voordat je verdergaat."
  fi

  TODAY="$(date +%Y%m%d)"
  EXPECTED_PREFIX="feature/batch-staging-${TODAY}"
  if [[ "$BRANCH" != feature/batch-staging-* && "$BRANCH" != "main" ]]; then
    add_warning "Branch volgt niet de batch-staging conventie: '$BRANCH'."
    add_action "Gewenste branch voor nieuw werk: $EXPECTED_PREFIX."
  fi

  if [[ "$BRANCH" == "main" ]]; then
    add_warning "Je staat op main; push/merge/productie blijven hard-stop zonder expliciete toestemming."
  fi

  if [[ "$DIRTY_COUNT" -gt 0 ]]; then
    if [[ "$REQUESTED_PHASE" == "01" || "$REQUESTED_PHASE" == "02" || "$REQUESTED_PHASE" == "03" ]]; then
      add_blocker "Tracked uncommitted changes aanwezig ($DIRTY_COUNT bestand(en)); niet pushen/deployen."
    else
      add_warning "Tracked uncommitted changes aanwezig ($DIRTY_COUNT bestand(en)); playbook 00 nodig."
    fi
    add_action "Volg playbook 00: scope review, tests/checks, daarna logisch committen of expliciet parkeren."
  fi

  if [[ "$BEHIND" -gt 0 ]]; then
    add_blocker "Branch loopt $BEHIND commit(s) achter op upstream '$UPSTREAM'."
    add_action "Los remote-sync op volgens playbook 01; bij twijfel Sjoerd vragen vóór pull/rebase/merge."
  fi

  if [[ -n "$UPSTREAM" && "$AHEAD" -gt 0 ]]; then
    add_warning "Branch staat $AHEAD commit(s) voor op upstream '$UPSTREAM'."
    add_action "Playbook 01 is nodig om preflight en push voor te bereiden."
  fi

  # ---------------------------------------------------------------------------
  # Design parity — storefront/design sibling checks
  # ---------------------------------------------------------------------------
  DESIGN_LOCAL="$WORKSPACE_ROOT/pagayo-design"
  STOREFRONT="$WORKSPACE_ROOT/pagayo-storefront"
  DESIGN_LOCAL_VERSION=""
  DESIGN_LOCK_VERSION=""
  DESIGN_ASSET_VERSION=""
  DESIGN_LOCAL_DIRTY="0"
  DESIGN_STATUS="not_applicable"

  if [[ -f "$DESIGN_LOCAL/package.json" ]]; then
    DESIGN_LOCAL_VERSION="$(read_json_value "$DESIGN_LOCAL/package.json" "json => json.version")"
    if git -C "$DESIGN_LOCAL" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      DESIGN_LOCAL_DIRTY="$(git -C "$DESIGN_LOCAL" status --porcelain --untracked-files=no 2>/dev/null | wc -l | tr -d ' ')"
    fi
  fi

  if [[ -f "$STOREFRONT/package-lock.json" ]]; then
    DESIGN_LOCK_VERSION="$(read_json_value "$STOREFRONT/package-lock.json" "json => json.packages?.['node_modules/@pagayo/design']?.version")"
  fi

  ASSET_FILE="$STOREFRONT/src/workers/generated/design-asset-version.ts"
  if [[ -f "$ASSET_FILE" ]]; then
    DESIGN_ASSET_VERSION="$(grep -Eo 'DESIGN_ASSET_VERSION[[:space:]]*=[[:space:]]*\"[^\"]+\"' "$ASSET_FILE" | head -1 | sed 's/.*"\([^"]*\)".*/\1/' || true)"
  fi

  if [[ "$REPO" == "pagayo-storefront" || "$REPO" == "pagayo-design" ]]; then
    DESIGN_STATUS="ok"
    if [[ "$DESIGN_LOCAL_DIRTY" -gt 0 ]]; then
      DESIGN_STATUS="blocked"
      add_blocker "pagayo-design heeft $DESIGN_LOCAL_DIRTY uncommitted tracked wijziging(en); staging gebruikt npm/lockfile, niet lokale dist."
      add_action "Rond pagayo-design af: build, versie/publish waar nodig, daarna storefront lockfile bump + copy-design."
    fi
    if [[ -n "$DESIGN_LOCAL_VERSION" && -n "$DESIGN_LOCK_VERSION" && "$DESIGN_LOCAL_VERSION" != "$DESIGN_LOCK_VERSION" ]]; then
      DESIGN_STATUS="blocked"
      add_blocker "@pagayo/design drift: lokaal $DESIGN_LOCAL_VERSION ≠ storefront lockfile $DESIGN_LOCK_VERSION."
      add_action "Publiceer/bump @pagayo/design of update storefront naar de bedoelde gepubliceerde versie."
    fi
    if [[ -n "$DESIGN_LOCK_VERSION" && -n "$DESIGN_ASSET_VERSION" && "$DESIGN_LOCK_VERSION" != "$DESIGN_ASSET_VERSION" ]]; then
      DESIGN_STATUS="blocked"
      add_blocker "DESIGN_ASSET_VERSION drift: $DESIGN_ASSET_VERSION ≠ lockfile $DESIGN_LOCK_VERSION."
      add_action "Run in pagayo-storefront: PAGAYO_DESIGN_SOURCE=node_modules npm run copy-design en commit generated output."
    fi
  fi

  # ---------------------------------------------------------------------------
  # Migration/schema signalen
  # ---------------------------------------------------------------------------
  CHANGED_FILES="$(
    {
      git -C "$GIT_ROOT" diff --name-only 2>/dev/null
      git -C "$GIT_ROOT" diff --cached --name-only 2>/dev/null
      if [[ -n "$UPSTREAM" ]]; then
        git -C "$GIT_ROOT" diff --name-only "$UPSTREAM..HEAD" 2>/dev/null
      fi
    } | sort -u
  )"

  MIGRATION_TOUCHED="false"
  MIGRATION_STATUS="not_applicable"
  if printf '%s\n' "$CHANGED_FILES" | grep -Eq '(^|/)(schema|schemas|migrations|migration-logs)(/|$)|src/features/tenant-migrations/|drizzle|@pagayo/schema|package-lock\.json|package\.json'; then
    MIGRATION_TOUCHED="true"
    MIGRATION_STATUS="needs_check"
    add_warning "Schema/migration/dependency-signaal gevonden in gewijzigde bestanden."
    add_action "Run vóór afronding: pagayo-maintenance/.github/scripts/copilot-migration-check.sh."
  fi

  # ---------------------------------------------------------------------------
  # CI via gh — read-only
  # ---------------------------------------------------------------------------
  CI_STATUS="not_checked"
  CI_CONCLUSION=""
  CI_RUN_ID=""
  CI_HEAD_SHA=""
  CI_WORKFLOW=""
  NEEDS_CI="false"
  if [[ "$REQUESTED_PHASE" == "02" || "$REQUESTED_PHASE" == "03" ]]; then
    NEEDS_CI="true"
  fi

  if [[ "$NEEDS_CI" != "true" ]]; then
    CI_STATUS="not_required"
  elif command -v gh >/dev/null 2>&1; then
    CI_JSON="$(gh run list --branch "$BRANCH" --limit 20 --json databaseId,status,conclusion,headSha,workflowName 2>/dev/null || true)"
    if [[ -n "$CI_JSON" && "$CI_JSON" != "[]" ]]; then
      CI_LINE="$(RUNS_JSON="$CI_JSON" FULL_SHA="$(git -C "$GIT_ROOT" rev-parse HEAD 2>/dev/null || true)" node -e '
        const runs = JSON.parse(process.env.RUNS_JSON || "[]");
        const fullSha = process.env.FULL_SHA || "";
        const run = runs.find((item) => item.headSha === fullSha) || runs[0];
        if (run) {
          process.stdout.write([
            run.status || "",
            run.conclusion || "",
            run.databaseId || "",
            run.headSha || "",
            run.workflowName || ""
          ].join("\t"));
        }
      ' 2>/dev/null || true)"
      IFS=$'\t' read -r CI_STATUS CI_CONCLUSION CI_RUN_ID CI_HEAD_SHA CI_WORKFLOW <<< "$CI_LINE"
      if [[ "$CI_HEAD_SHA" != "$(git -C "$GIT_ROOT" rev-parse HEAD 2>/dev/null || true)" ]]; then
        add_warning "Geen GitHub Actions run gevonden op exacte HEAD; laatste branch-run is gebruikt."
      fi
    else
      CI_STATUS="unknown"
      add_warning "Geen GitHub Actions runs gevonden voor branch '$BRANCH'."
    fi
  else
    CI_STATUS="gh_missing"
    add_blocker "gh CLI ontbreekt; CI-status is verplicht voor playbook $REQUESTED_PHASE."
  fi

  # ---------------------------------------------------------------------------
  # Phase advies
  # ---------------------------------------------------------------------------
  if [[ "$REQUESTED_PHASE" == "auto" ]]; then
    if [[ "$DIRTY_COUNT" -gt 0 ]]; then
      RECOMMENDED_PHASE="00"
    elif [[ -n "$UPSTREAM" && "$AHEAD" -gt 0 ]]; then
      RECOMMENDED_PHASE="01"
    elif [[ "$CI_CONCLUSION" == "success" && "$BRANCH" != "main" ]]; then
      RECOMMENDED_PHASE="02"
    elif [[ "$BRANCH" == "main" ]]; then
      RECOMMENDED_PHASE="03"
    else
      RECOMMENDED_PHASE="01"
    fi
  else
    RECOMMENDED_PHASE="$REQUESTED_PHASE"
  fi

  if [[ ${#BLOCKERS[@]} -gt 0 ]]; then
    STATUS="blocked"
  elif [[ ${#WARNINGS[@]} -gt 0 || ${#NEXT_ACTIONS[@]} -gt 0 ]]; then
    STATUS="warning"
  else
    STATUS="ok"
  fi
fi

JSON="$(
  STATUS="$STATUS" \
  REPO="$REPO" \
  BRANCH="$BRANCH" \
  SHA="$SHA" \
  UPSTREAM="$UPSTREAM" \
  AHEAD="$AHEAD" \
  BEHIND="$BEHIND" \
  DIRTY_COUNT="$DIRTY_COUNT" \
  RECOMMENDED_PHASE="$RECOMMENDED_PHASE" \
  REQUESTED_PHASE="$REQUESTED_PHASE" \
  BLOCKERS_TEXT="$(json_array_env "${BLOCKERS[@]}")" \
  WARNINGS_TEXT="$(json_array_env "${WARNINGS[@]}")" \
  ACTIONS_TEXT="$(json_array_env "${NEXT_ACTIONS[@]}")" \
  GUARDS_TEXT="$(json_array_env "${GUARDS[@]}")" \
  DESIGN_STATUS="$DESIGN_STATUS" \
  DESIGN_LOCAL_VERSION="$DESIGN_LOCAL_VERSION" \
  DESIGN_LOCK_VERSION="$DESIGN_LOCK_VERSION" \
  DESIGN_ASSET_VERSION="$DESIGN_ASSET_VERSION" \
  DESIGN_LOCAL_DIRTY="$DESIGN_LOCAL_DIRTY" \
  CI_STATUS="$CI_STATUS" \
  CI_CONCLUSION="$CI_CONCLUSION" \
  CI_RUN_ID="$CI_RUN_ID" \
  CI_HEAD_SHA="$CI_HEAD_SHA" \
  CI_WORKFLOW="$CI_WORKFLOW" \
  MIGRATION_TOUCHED="$MIGRATION_TOUCHED" \
  MIGRATION_STATUS="$MIGRATION_STATUS" \
  node <<'NODE'
const splitLines = (value) => (value || "").split("\n").filter(Boolean);
const number = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const payload = {
  repo: process.env.REPO || "",
  branch: process.env.BRANCH || "",
  sha: process.env.SHA || "",
  requestedPhase: process.env.REQUESTED_PHASE || "auto",
  recommendedPhase: process.env.RECOMMENDED_PHASE || "00",
  status: process.env.STATUS || "blocked",
  blockers: splitLines(process.env.BLOCKERS_TEXT),
  warnings: splitLines(process.env.WARNINGS_TEXT),
  nextActions: splitLines(process.env.ACTIONS_TEXT),
  guards: splitLines(process.env.GUARDS_TEXT),
  git: {
    upstream: process.env.UPSTREAM || "",
    ahead: number(process.env.AHEAD),
    behind: number(process.env.BEHIND),
    dirtyTrackedFiles: number(process.env.DIRTY_COUNT),
  },
  design: {
    status: process.env.DESIGN_STATUS || "not_checked",
    localVersion: process.env.DESIGN_LOCAL_VERSION || "",
    storefrontLockVersion: process.env.DESIGN_LOCK_VERSION || "",
    assetVersion: process.env.DESIGN_ASSET_VERSION || "",
    localDirtyTrackedFiles: number(process.env.DESIGN_LOCAL_DIRTY),
  },
  ci: {
    status: process.env.CI_STATUS || "not_checked",
    conclusion: process.env.CI_CONCLUSION || "",
    runId: process.env.CI_RUN_ID || "",
    headSha: process.env.CI_HEAD_SHA || "",
    workflow: process.env.CI_WORKFLOW || "",
  },
  migration: {
    touched: process.env.MIGRATION_TOUCHED === "true",
    status: process.env.MIGRATION_STATUS || "not_checked",
  },
};

process.stdout.write(JSON.stringify(payload, null, 2));
NODE
)"

if [[ -n "$JSON_OUT" ]]; then
  printf '%s\n' "$JSON" > "$JSON_OUT"
fi

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                 RELEASE DOCTOR — read-only diagnose                  ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Repo:              $REPO"
echo "Branch:            ${BRANCH:-n.v.t.}"
echo "SHA:               ${SHA:-n.v.t.}"
echo "Phase:             requested=$REQUESTED_PHASE recommended=$RECOMMENDED_PHASE"
echo "Status:            $STATUS"
echo ""
echo "Git:               upstream=${UPSTREAM:-geen} ahead=$AHEAD behind=$BEHIND dirty=$DIRTY_COUNT"
echo "Design:            status=$DESIGN_STATUS local=${DESIGN_LOCAL_VERSION:-?} lock=${DESIGN_LOCK_VERSION:-?} asset=${DESIGN_ASSET_VERSION:-?}"
echo "CI:                status=$CI_STATUS conclusion=${CI_CONCLUSION:-?} run=${CI_RUN_ID:-?}"
echo "Migration:         touched=$MIGRATION_TOUCHED status=$MIGRATION_STATUS"
echo ""

if [[ ${#BLOCKERS[@]} -gt 0 ]]; then
  echo "Blockers:"
  for item in "${BLOCKERS[@]}"; do
    echo "  - $item"
  done
  echo ""
fi

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo "Warnings:"
  for item in "${WARNINGS[@]}"; do
    echo "  - $item"
  done
  echo ""
fi

if [[ ${#NEXT_ACTIONS[@]} -gt 0 ]]; then
  echo "Next actions:"
  for item in "${NEXT_ACTIONS[@]}"; do
    echo "  - $item"
  done
  echo ""
fi

echo "Hard stops:"
for item in "${GUARDS[@]}"; do
  echo "  - $item"
done
echo ""
echo "JSON:"
printf '%s\n' "$JSON"

case "$STATUS" in
  ok) exit 0 ;;
  warning) exit 1 ;;
  *) exit 2 ;;
esac
