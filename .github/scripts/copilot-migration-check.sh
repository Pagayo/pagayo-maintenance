#!/bin/bash
# =============================================================================
# COPILOT MIGRATION CHECK
# =============================================================================
# Controleert schema/migratie-gezondheid voor Copilot-sessies en CI.
# Gebruik: ./copilot-migration-check.sh [workspace-root]
#
# Checks:
#   1. Alle .sql-bestanden in migrations/tenant/ hebben een manifest-entry
#   2. Geen ongecommitte generated output (ddl.generated.*, dist/tenant/)
#   3. Consumer lockfile drift: storefront + api-stack verwijzen naar huidige @pagayo/schema-versie
#
# Exit 0 = alles schoon. Exit 1 = actie vereist (volg de instructies).
# =============================================================================

WORKSPACE="${1:-/Users/sjoerdoverdiep/my-vscode-workspace}"
SCHEMA_DIR="$WORKSPACE/pagayo-schema"
MANIFEST="$SCHEMA_DIR/migrations/tenant/manifest.json"

FAIL=0

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║            🔍 COPILOT MIGRATION CHECK                                 ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# CHECK 1: Manifest entries — elk .sql bestand in migrations/tenant/ moet
#          een entry hebben in manifest.json
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 CHECK 1: Manifest entries (migrations/tenant/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ ! -f "$MANIFEST" ]]; then
    echo "❌ manifest.json niet gevonden: $MANIFEST"
    FAIL=1
else
    MISSING_MANIFEST=()
    for sql_file in "$SCHEMA_DIR/migrations/tenant/"*.sql; do
        [[ -f "$sql_file" ]] || continue
        name=$(basename "$sql_file")
        if ! python3 -c "
import json, sys
with open('$MANIFEST') as f:
    m = json.load(f)
sys.exit(0 if '$name' in m.get('migrations', {}) else 1)
" 2>/dev/null; then
            MISSING_MANIFEST+=("$name")
        fi
    done

    if [[ ${#MISSING_MANIFEST[@]} -eq 0 ]]; then
        total=$(python3 -c "import json; m=json.load(open('$MANIFEST')); print(len(m.get('migrations',{})))" 2>/dev/null)
        echo "✅ Alle SQL-migraties hebben een manifest-entry ($total entries)"
    else
        echo "❌ Ontbrekende manifest-entries:"
        for f in "${MISSING_MANIFEST[@]}"; do
            echo "   - $f"
        done
        echo ""
        echo "   → Voeg voor elk bestand een entry toe in migrations/tenant/manifest.json"
        echo "     Verplichte velden: classification (lazy-safe|fan-out-only|operator-only)"
        echo "     Optioneel: ignoreErrorPatterns, includeInAutomatedReplay, description, createdAt"
        FAIL=1
    fi
fi
echo ""

# =============================================================================
# CHECK 2: Ongecommitte generated output
#          src/tenant/ddl.generated.ts en dist/tenant/ moeten schoon zijn
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 CHECK 2: Ongecommitte generated output (pagayo-schema)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ ! -d "$SCHEMA_DIR/.git" ]] && ! git -C "$SCHEMA_DIR" rev-parse --git-dir > /dev/null 2>&1; then
    echo "⚠️  pagayo-schema is geen git-repo — skip check"
else
    DIRTY_GENERATED=$(git -C "$SCHEMA_DIR" status --porcelain \
        -- "src/tenant/ddl.generated.ts" \
           "dist/tenant/" \
           "src/tenant/ddl.generated.d.ts" \
        2>/dev/null)

    if [[ -z "$DIRTY_GENERATED" ]]; then
        echo "✅ Geen ongecommitte generated output"
    else
        echo "❌ Ongecommitte generated bestanden gevonden:"
        echo "$DIRTY_GENERATED" | sed 's/^/   /'
        echo ""
        echo "   → Run 'npm run db:generate:all' in pagayo-schema en commit de uitvoer"
        echo "     (of commit handmatig: git add dist/ src/tenant/ddl.generated.ts)"
        FAIL=1
    fi
fi
echo ""

# =============================================================================
# CHECK 3: Consumer lockfile drift
#          pagayo-storefront en pagayo-api-stack lockfile moeten de huidige
#          @pagayo/schema versie bevatten
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 CHECK 3: Consumer lockfile drift (@pagayo/schema)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ ! -f "$SCHEMA_DIR/package.json" ]]; then
    echo "⚠️  pagayo-schema/package.json niet gevonden — skip check"
else
    SCHEMA_VERSION=$(python3 -c "import json; print(json.load(open('$SCHEMA_DIR/package.json'))['version'])" 2>/dev/null)

    if [[ -z "$SCHEMA_VERSION" ]]; then
        echo "⚠️  Kan schema-versie niet bepalen — skip check"
    else
        echo "  Schema package.json versie: $SCHEMA_VERSION"
        echo ""
        DRIFT_FOUND=false

        for consumer in pagayo-storefront pagayo-api-stack; do
            lockfile="$WORKSPACE/$consumer/package-lock.json"
            pkg_json="$WORKSPACE/$consumer/package.json"

            if [[ ! -f "$lockfile" ]]; then
                echo "  ⚠️  $consumer: package-lock.json niet gevonden — skip"
                continue
            fi

            # Check of consumer @pagayo/schema als dependency heeft
            if ! grep -q '"@pagayo/schema"' "$pkg_json" 2>/dev/null; then
                echo "  ℹ️  $consumer: geen @pagayo/schema dependency — skip"
                continue
            fi

            resolved_version=$(python3 -c "
import json, sys
try:
    l = json.load(open('$lockfile'))
    p = l.get('packages', {}).get('node_modules/@pagayo/schema')
    if p:
        print(p.get('version', 'not-found'))
    else:
        # Fallback: zoek in dependencies (lockfile v1)
        d = l.get('dependencies', {}).get('@pagayo/schema')
        print(d.get('version', 'not-found') if d else 'not-found')
except Exception as e:
    print('error')
" 2>/dev/null)

            if [[ "$resolved_version" == "not-found" || "$resolved_version" == "error" ]]; then
                echo "  ⚠️  $consumer: @pagayo/schema niet in lockfile — voer npm install uit"
                DRIFT_FOUND=true
            elif [[ "$resolved_version" == "$SCHEMA_VERSION" ]]; then
                echo "  ✅ $consumer: @pagayo/schema@$resolved_version (in sync)"
            else
                echo "  ❌ $consumer: DRIFT"
                echo "     Lockfile:      @pagayo/schema@$resolved_version"
                echo "     Schema source: $SCHEMA_VERSION"
                echo "     → Bump @pagayo/schema in $consumer/package.json en run npm install"
                DRIFT_FOUND=true
                FAIL=1
            fi
        done

        if [[ "$DRIFT_FOUND" == "false" ]]; then
            echo ""
        fi
    fi
fi
echo ""

# =============================================================================
# SAMENVATTING
# =============================================================================
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                          📊 SAMENVATTING                               ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

if [[ $FAIL -eq 0 ]]; then
    echo "✅ MIGRATION CHECK GESLAAGD — niets te doen"
    echo ""
    exit 0
else
    echo "❌ MIGRATION CHECK GEFAALD"
    echo ""
    echo "   Volg de instructies hierboven. Niet pushen tot alles groen is."
    echo ""
    exit 1
fi
