#!/bin/bash
# =============================================================================
# DEPLOYER AGENT PRE-FLIGHT CHECK
# =============================================================================
# Dit script MOET gedraaid worden VOORDAT de Deployer agent:
# - git push uitvoert
# - Een PR merget
# - Een branch wisselt
#
# Gebruik: ./deployer-preflight.sh [repo-path]
# =============================================================================

set -e

REPO_PATH="${1:-.}"
cd "$REPO_PATH"

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║              🚀 DEPLOYER PRE-FLIGHT CHECK                              ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# Get repo name
REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")
echo "📁 Repository: $REPO_NAME"
echo ""

# =============================================================================
# CHECK 1: Uncommitted changes
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 CHECK 1: Uncommitted Changes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# In CI (GitHub Actions), untracked files zoals .maintenance/ zijn normaal — negeer die.
# Controleer alleen tracked modified/staged files.
if [[ -n $(git status --porcelain --untracked-files=no) ]]; then
    echo "⚠️  WAARSCHUWING: Er zijn uncommitted changes!"
    echo ""
    git status --short --untracked-files=no
    echo ""
    echo "❌ ACTIE VEREIST: Commit of stash deze changes eerst!"
    UNCOMMITTED=true
else
    echo "✅ Working directory is clean"
    UNCOMMITTED=false
fi
echo ""

# =============================================================================
# CHECK 2: Local vs Remote sync
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 CHECK 2: Local vs Remote Sync"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Fetch latest from remote
git fetch origin --quiet

CURRENT_BRANCH=$(git branch --show-current)
echo "🌿 Current branch: $CURRENT_BRANCH"

# Check if branch exists on remote
if git show-ref --verify --quiet "refs/remotes/origin/$CURRENT_BRANCH"; then
    LOCAL_COMMIT=$(git rev-parse HEAD)
    REMOTE_COMMIT=$(git rev-parse "origin/$CURRENT_BRANCH")
    
    if [[ "$LOCAL_COMMIT" == "$REMOTE_COMMIT" ]]; then
        echo "✅ Local en remote zijn in sync"
        DIVERGED=false
    else
        # Check divergence
        AHEAD=$(git rev-list --count "origin/$CURRENT_BRANCH..HEAD")
        BEHIND=$(git rev-list --count "HEAD..origin/$CURRENT_BRANCH")
        
        if [[ $BEHIND -gt 0 && $AHEAD -gt 0 ]]; then
            echo "⚠️  WAARSCHUWING: Branches zijn GEDIVERGEERD!"
            echo "   Local is $AHEAD commits VOOR"
            echo "   Local is $BEHIND commits ACHTER"
            echo ""
            echo "❌ ACTIE VEREIST: Dit moet opgelost worden voor push/merge!"
            echo "   Optie A: git pull --rebase (lokale commits bovenop remote)"
            echo "   Optie B: git push --force-with-lease (lokale versie forceren)"
            DIVERGED=true
        elif [[ $AHEAD -gt 0 ]]; then
            echo "📤 Local is $AHEAD commits VOOR op remote"
            echo "   → Push nodig om te synchroniseren"
            DIVERGED=false
        elif [[ $BEHIND -gt 0 ]]; then
            echo "📥 Local is $BEHIND commits ACHTER op remote"
            echo "   → Pull nodig om te synchroniseren"
            DIVERGED=false
        fi
    fi
else
    echo "ℹ️  Branch '$CURRENT_BRANCH' bestaat niet op remote"
    DIVERGED=false
fi
echo ""

# =============================================================================
# CHECK 3: Other branches status
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 CHECK 3: Alle Branches Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "Local branches vs remote:"
git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads | while read branch track; do
    if [[ -n "$track" ]]; then
        echo "  $branch $track"
    else
        echo "  $branch (no upstream)"
    fi
done
echo ""

# =============================================================================
# CHECK 4: GitHub CI Status
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 CHECK 4: GitHub CI Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v gh &> /dev/null; then
    CI_STATUS=$(gh run list --branch main --limit 1 --json conclusion -q '.[0].conclusion' 2>/dev/null || echo "unknown")
    if [[ "$CI_STATUS" == "success" ]]; then
        echo "✅ Main branch CI: SUCCESS"
    elif [[ "$CI_STATUS" == "failure" ]]; then
        echo "❌ Main branch CI: FAILED"
        echo "   → Check CI logs voordat je merget!"
    elif [[ "$CI_STATUS" == "null" || "$CI_STATUS" == "" ]]; then
        echo "🔄 Main branch CI: RUNNING"
    else
        echo "❓ Main branch CI: $CI_STATUS"
    fi
else
    echo "⚠️  gh CLI niet beschikbaar - CI status niet gecontroleerd"
fi
echo ""

# =============================================================================
# CHECK 5: Branch Freshness vs main (hard blokkade)
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 CHECK 5: Branch Freshness vs main"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MAIN_BEHIND=false

if git show-ref --verify --quiet "refs/remotes/origin/main"; then
    if [[ "$CURRENT_BRANCH" == "main" ]]; then
        echo "✅ Huidige branch is main"
    else
        BEHIND_MAIN=$(git rev-list --count "HEAD..origin/main")
        AHEAD_MAIN=$(git rev-list --count "origin/main..HEAD")

        if [[ "$BEHIND_MAIN" -gt 0 ]]; then
            echo "❌ Branch is $BEHIND_MAIN commits ACHTER origin/main"
            echo "   Local branch: $CURRENT_BRANCH"
            echo "   Ahead of main: $AHEAD_MAIN"
            echo ""
            echo "   Laatste commits op main die ontbreken:"
            git log --oneline HEAD..origin/main --max-count=3 | sed 's/^/   - /'
            echo ""
            echo "   ACTIE: merge/rebase origin/main in deze branch vóór deploy/push"
            MAIN_BEHIND=true
        else
            echo "✅ Branch is up-to-date met origin/main (ahead=$AHEAD_MAIN, behind=0)"
        fi
    fi
else
    echo "⚠️  origin/main niet gevonden - freshness check overgeslagen"
fi
echo ""

# =============================================================================
# CHECK 6: Cross-Repo Dependency Sync (wrangler, drizzle-orm)
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 CHECK 6: Dependency Sync (kritieke packages)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

WORKSPACE_ROOT="$(cd "$REPO_PATH/.." && pwd)"
DEP_DRIFT=false

# Check een dependency across repos. Args: package_name repo1 repo2 ...
check_dep_sync() {
    local pkg="$1"
    shift
    local repos=("$@")
    local versions=()
    local labels=()

    for repo in "${repos[@]}"; do
        local pkg_json="$WORKSPACE_ROOT/$repo/package.json"
        if [[ -f "$pkg_json" ]]; then
            local ver
            ver=$(grep -o "\"$pkg\": *\"[^\"]*\"" "$pkg_json" 2>/dev/null | head -1 | sed 's/.*: *"\(.*\)"/\1/')
            if [[ -n "$ver" ]]; then
                versions+=("$ver")
                labels+=("$repo=$ver")
            fi
        fi
    done

    if [[ ${#versions[@]} -lt 2 ]]; then
        return
    fi

    # Check of alle versies identiek zijn
    local unique
    unique=$(printf '%s\n' "${versions[@]}" | sort -u | wc -l | tr -d ' ')

    if [[ "$unique" -eq 1 ]]; then
        echo "  ✅ $pkg: alle ${#versions[@]} repos op ${versions[0]}"
    else
        echo "  ⚠️  $pkg: DRIFT GEDETECTEERD"
        for label in "${labels[@]}"; do
            echo "      ${label}"
        done
        DEP_DRIFT=true
    fi
}

check_dep_sync "wrangler" \
    pagayo-storefront pagayo-api-stack \
    pagayo-edge pagayo-workflows pagayo-marketing

check_dep_sync "drizzle-orm" \
    pagayo-storefront pagayo-api-stack pagayo-schema

echo ""

if [[ "$DEP_DRIFT" == "true" ]]; then
    echo "  ⚠️  Dependency drift gevonden — niet blokkerend, maar fix dit snel."
fi
echo ""

# =============================================================================
# CHECK 7: @pagayo/design Local vs NPM Sync
# =============================================================================
# Dit detecteert het scenario waarbij lokale CSS werkt maar CI/productie niet,
# omdat de npm-gepubliceerde @pagayo/design versie achterloopt op de lokale build.
# Root cause: copy-design script prefereert ../pagayo-design/dist lokaal,
# maar CI valt terug op node_modules/@pagayo/design/dist (npm versie).
# =============================================================================
DESIGN_DRIFT=false

# Alleen checken als pagayo-design lokaal bestaat
DESIGN_LOCAL="$WORKSPACE_ROOT/pagayo-design"
if [[ -d "$DESIGN_LOCAL" ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 CHECK 7: @pagayo/design Local vs NPM Sync"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Haal lokale versie op
    LOCAL_DESIGN_VERSION=$(grep -o '"version": *"[^"]*"' "$DESIGN_LOCAL/package.json" | head -1 | sed 's/.*: *"\(.*\)"/\1/')

    # Check in alle repos die @pagayo/design gebruiken
    DESIGN_CONSUMERS=(pagayo-storefront)
    for consumer in "${DESIGN_CONSUMERS[@]}"; do
        CONSUMER_PATH="$WORKSPACE_ROOT/$consumer"
        NPM_DESIGN_PKG="$CONSUMER_PATH/node_modules/@pagayo/design/package.json"

        if [[ ! -f "$NPM_DESIGN_PKG" ]]; then
            continue
        fi

        NPM_DESIGN_VERSION=$(grep -o '"version": *"[^"]*"' "$NPM_DESIGN_PKG" | head -1 | sed 's/.*: *"\(.*\)"/\1/')

        if [[ "$LOCAL_DESIGN_VERSION" != "$NPM_DESIGN_VERSION" ]]; then
            echo "  ⚠️  $consumer: npm heeft @pagayo/design@$NPM_DESIGN_VERSION, lokaal is @$LOCAL_DESIGN_VERSION"
            DESIGN_DRIFT=true
        else
            echo "  ✅ $consumer: @pagayo/design@$NPM_DESIGN_VERSION (in sync)"
        fi

        # Extra: vergelijk CSS bestandsgroottes voor de zekerheid
        LOCAL_CSS="$DESIGN_LOCAL/dist/revolutionary/webshop.css"
        NPM_CSS="$CONSUMER_PATH/node_modules/@pagayo/design/dist/revolutionary/webshop.css"

        if [[ -f "$LOCAL_CSS" && -f "$NPM_CSS" ]]; then
            LOCAL_SIZE=$(wc -c < "$LOCAL_CSS" | tr -d ' ')
            NPM_SIZE=$(wc -c < "$NPM_CSS" | tr -d ' ')

            if [[ "$LOCAL_SIZE" != "$NPM_SIZE" ]]; then
                echo "  ⚠️  CSS mismatch in $consumer: lokaal=${LOCAL_SIZE}B vs npm=${NPM_SIZE}B"
                echo "     → npm publish nodig vanuit pagayo-design!"
                echo "     → Daarna: cd $consumer && npm install @pagayo/design@$LOCAL_DESIGN_VERSION"
                DESIGN_DRIFT=true
            fi
        fi
    done

    if [[ "$DESIGN_DRIFT" == "true" ]]; then
        echo ""
        echo "  🚨 @pagayo/design is NIET in sync tussen lokaal en npm!"
        echo "     Lokaal werkt CSS correct, maar CI/productie gebruikt de npm versie."
        echo "     FIX: cd pagayo-design && npm publish && cd ../pagayo-storefront && npm install @pagayo/design@$LOCAL_DESIGN_VERSION"
    else
        echo "  ✅ @pagayo/design: lokaal en npm zijn in sync"
    fi
    echo ""
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                          📊 SAMENVATTING                               ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

if [[ "$UNCOMMITTED" == "true" || "$DIVERGED" == "true" || "$MAIN_BEHIND" == "true" || "$DESIGN_DRIFT" == "true" ]]; then
    echo "❌ PRE-FLIGHT CHECK GEFAALD"
    echo ""
    if [[ "$UNCOMMITTED" == "true" ]]; then
        echo "   • Uncommitted changes moeten eerst gecommit worden"
    fi
    if [[ "$DIVERGED" == "true" ]]; then
        echo "   • Branches zijn gedivergeerd - vraag Sjoerd wat te doen"
    fi
    if [[ "$MAIN_BEHIND" == "true" ]]; then
        echo "   • Branch loopt achter op origin/main - merge/rebase eerst"
    fi
    if [[ "$DESIGN_DRIFT" == "true" ]]; then
        echo "   • @pagayo/design lokaal ≠ npm — publiceer eerst!"
        echo "     FIX: cd pagayo-design && npm version patch && npm publish"
        echo "     DAN: cd pagayo-storefront && npm install @pagayo/design@<nieuwe-versie>"
    fi
    echo ""
    echo "🛑 STOP: Los bovenstaande issues op voordat je doorgaat!"
    exit 1
else
    echo "✅ PRE-FLIGHT CHECK GESLAAGD"
    if [[ "$DEP_DRIFT" == "true" ]]; then
        echo "   ⚠️  Dependency drift gedetecteerd (niet blokkerend)"
    fi
    echo ""
    echo "🚀 Je mag doorgaan met git operaties."
    exit 0
fi
