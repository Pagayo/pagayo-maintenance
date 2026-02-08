#!/bin/zsh
# =============================================================================
# Pagayo - Run All Smoke Tests Across Platform
# =============================================================================
# Runt alle smoke tests van alle repo's en genereert een rapport.
#
# Gebruik:
#   ./scripts/run-all-smoke-tests.sh           # Alles
#   ./scripts/run-all-smoke-tests.sh --quick   # Alleen critical
#   ./scripts/run-all-smoke-tests.sh --report  # Genereer rapport
#
# Laatst bijgewerkt: 8 februari 2026
# =============================================================================

set +e  # Continue on errors

# =============================================================================
# Configuration
# =============================================================================

# Kleuren
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Workspace root
WORKSPACE="/Users/sjoerdoverdiep/my-vscode-workspace"

# Results
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "${CYAN}  $1${NC}"
    echo "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

run_test_suite() {
    local name=$1
    local dir=$2
    local command=$3
    
    echo ""
    echo "${BLUE}▸ Running: $name${NC}"
    
    if [[ ! -d "$dir" ]]; then
        echo "  ${YELLOW}⚠ Directory not found: $dir${NC}"
        ((TOTAL_SKIPPED++))
        return
    fi
    
    pushd "$dir" > /dev/null 2>&1
    
    # Run the test command
    eval "$command" 2>&1 | while IFS= read -r line; do
        echo "  $line"
    done
    
    local exit_code=${PIPESTATUS[0]}
    
    popd > /dev/null 2>&1
    
    if [[ $exit_code -eq 0 ]]; then
        echo "  ${GREEN}✓ PASSED${NC}"
        ((TOTAL_PASSED++))
    else
        echo "  ${RED}✗ FAILED${NC}"
        ((TOTAL_FAILED++))
    fi
}

# =============================================================================
# Infrastructure Health Check
# =============================================================================

run_health_check() {
    print_header "Infrastructure Health Check"
    
    "$WORKSPACE/pagayo-maintenance/scripts/health-check.sh" --quick
    
    if [[ $? -eq 0 ]]; then
        ((TOTAL_PASSED++))
    else
        ((TOTAL_FAILED++))
    fi
}

# =============================================================================
# Test Suites
# =============================================================================

run_maintenance_tests() {
    print_header "Central Maintenance Tests"
    
    run_test_suite \
        "Smoke Tests (all services)" \
        "$WORKSPACE/pagayo-maintenance" \
        "npm run test:smoke 2>&1 || true"
    
    run_test_suite \
        "Security Tests" \
        "$WORKSPACE/pagayo-maintenance" \
        "npm run test:security 2>&1 || true"
    
    run_test_suite \
        "Integration Tests" \
        "$WORKSPACE/pagayo-maintenance" \
        "npm run test:integration 2>&1 || true"
    
    run_test_suite \
        "Contract Tests" \
        "$WORKSPACE/pagayo-maintenance" \
        "npm run test:contracts 2>&1 || true"
    
    run_test_suite \
        "Performance Tests" \
        "$WORKSPACE/pagayo-maintenance" \
        "npm run test:performance 2>&1 || true"
}

run_repo_tests() {
    print_header "Repository-Specific Tests"
    
    # Beheer smoke tests
    if [[ -f "$WORKSPACE/pagayo-beheer/package.json" ]]; then
        run_test_suite \
            "Beheer Smoke Tests" \
            "$WORKSPACE/pagayo-beheer" \
            "npm run test:smoke 2>&1 || true"
    fi
    
    # Edge smoke tests (shell scripts)
    if [[ -f "$WORKSPACE/pagayo-edge/scripts/smoke-test-production.sh" ]]; then
        run_test_suite \
            "Edge Smoke Tests" \
            "$WORKSPACE/pagayo-edge" \
            "./scripts/smoke-test-production.sh 2>&1 || true"
    fi
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
    print_header "Test Summary"
    
    echo ""
    echo "  ${GREEN}Passed:${NC}  $TOTAL_PASSED"
    echo "  ${RED}Failed:${NC}  $TOTAL_FAILED"
    echo "  ${YELLOW}Skipped:${NC} $TOTAL_SKIPPED"
    echo ""
    
    local total=$((TOTAL_PASSED + TOTAL_FAILED))
    
    if [[ $TOTAL_FAILED -gt 0 ]]; then
        local pass_rate=$((100 * TOTAL_PASSED / total))
        echo "  ${RED}⚠️  $TOTAL_FAILED test suites failed (${pass_rate}% pass rate)${NC}"
        echo ""
        echo "  Run individual test suites for details:"
        echo "    cd pagayo-maintenance && npm run test:smoke"
        echo "    cd pagayo-beheer && npm run test:smoke"
        return 1
    else
        echo "  ${GREEN}✅ All $total test suites passed!${NC}"
        return 0
    fi
}

# =============================================================================
# Main
# =============================================================================

main() {
    echo ""
    echo "${CYAN}🧪 Pagayo Platform Test Suite${NC}"
    echo "${CYAN}   $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    
    case "${1:-}" in
        --quick)
            run_health_check
            ;;
        --report)
            run_health_check
            run_maintenance_tests
            run_repo_tests
            # Generate report file
            {
                echo "# Pagayo Test Report"
                echo "Generated: $(date)"
                echo ""
                echo "## Results"
                echo "- Passed: $TOTAL_PASSED"
                echo "- Failed: $TOTAL_FAILED"
                echo "- Skipped: $TOTAL_SKIPPED"
            } > "$WORKSPACE/pagayo-maintenance/TEST-REPORT.md"
            echo ""
            echo "Report saved to: pagayo-maintenance/TEST-REPORT.md"
            ;;
        *)
            run_health_check
            run_maintenance_tests
            run_repo_tests
            ;;
    esac
    
    print_summary
}

main "$@"
