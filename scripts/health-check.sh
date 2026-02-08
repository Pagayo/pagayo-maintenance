#!/bin/zsh
# =============================================================================
# Pagayo Infrastructure Health Check
# =============================================================================
# Quick health check voor alle Pagayo infrastructure componenten.
# Detecteert problemen VOORDAT gebruikers ze melden.
#
# Gebruik:
#   ./health-check.sh           # Volledige check
#   ./health-check.sh --quick   # Alleen health endpoints
#   ./health-check.sh --access  # Alleen Cloudflare Access checks
#
# Exit codes:
#   0 = Alles OK
#   1 = Warnings (sommige checks gefaald maar niet kritiek)
#   2 = Critical failure
#
# Laatst bijgewerkt: 8 februari 2026
# =============================================================================

set +e  # Continue on errors - we handle them ourselves

# =============================================================================
# Configuration
# =============================================================================

# Kleuren
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "${BLUE}  $1${NC}"
    echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    local is_critical=${4:-false}
    
    # -L volgt redirects (sommige endpoints redirecten naar finale URL)
    local http_code=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
    
    if [[ "$http_code" == "$expected_status" ]]; then
        echo "${GREEN}  ✓${NC} $name ($http_code)"
        ((PASSED++))
        return 0
    else
        if [[ "$is_critical" == "true" ]]; then
            echo "${RED}  ✗${NC} $name (expected $expected_status, got $http_code) ${RED}[CRITICAL]${NC}"
            ((FAILED++))
        else
            echo "${YELLOW}  ⚠${NC} $name (expected $expected_status, got $http_code)"
            ((WARNINGS++))
        fi
        return 1
    fi
}

check_dns() {
    local domain=$1
    
    if host "$domain" >/dev/null 2>&1; then
        echo "${GREEN}  ✓${NC} $domain resolves"
        ((PASSED++))
        return 0
    else
        echo "${RED}  ✗${NC} $domain DNS failed"
        ((FAILED++))
        return 1
    fi
}

check_ssl() {
    local domain=$1
    
    local expiry=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep "notAfter" | cut -d= -f2)
    
    if [[ -n "$expiry" ]]; then
        local expiry_epoch=$(date -j -f "%b %d %T %Y %Z" "$expiry" +%s 2>/dev/null || echo "0")
        local now_epoch=$(date +%s)
        local days_until_expiry=$(( (expiry_epoch - now_epoch) / 86400 ))
        
        if [[ $days_until_expiry -gt 30 ]]; then
            echo "${GREEN}  ✓${NC} $domain SSL OK (expires in ${days_until_expiry} days)"
            ((PASSED++))
        elif [[ $days_until_expiry -gt 7 ]]; then
            echo "${YELLOW}  ⚠${NC} $domain SSL expiring soon (${days_until_expiry} days)"
            ((WARNINGS++))
        else
            echo "${RED}  ✗${NC} $domain SSL critical (${days_until_expiry} days)"
            ((FAILED++))
        fi
    else
        echo "${YELLOW}  ⚠${NC} $domain SSL check failed (could not parse)"
        ((WARNINGS++))
    fi
}

# =============================================================================
# Health Checks
# =============================================================================

check_health_endpoints() {
    print_header "Health Endpoints"
    
    check_endpoint "beheer.pagayo.com/api/health" "https://beheer.pagayo.com/api/health" 200 true
    check_endpoint "api.pagayo.com/api/health" "https://api.pagayo.com/api/health" 200 true
    check_endpoint "test-3.pagayo.app/api/health" "https://test-3.pagayo.app/api/health" 200 false
    check_endpoint "www.pagayo.com (marketing)" "https://www.pagayo.com" 200 true
}

# =============================================================================
# Access Bypass Checks (KRITIEK!)
# =============================================================================

check_cloudflare_access() {
    print_header "Cloudflare Access Bypass Validation"
    echo "  ${YELLOW}(Moeten 2xx/4xx geven, NIET 403 Access Denied)${NC}"
    echo ""
    
    # Public routes die NIET 403 mogen geven
    # Note: 401 is acceptabel - betekent Cloudflare Access laat het door, Worker vraagt auth
    local workflow_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://beheer.pagayo.com/api/workflows/provisioning/status/nonexistent" 2>/dev/null || echo "000")
    if [[ "$workflow_status" == "403" ]]; then
        echo "${RED}  ✗${NC} /api/workflows blocked by Cloudflare Access! (403)"
        echo "     → Fix: Create Access bypass application for /api/workflows/*"
        ((FAILED++))
    elif [[ "$workflow_status" == "404" || "$workflow_status" == "200" || "$workflow_status" == "401" ]]; then
        echo "${GREEN}  ✓${NC} /api/workflows accessible ($workflow_status)"
        ((PASSED++))
    else
        echo "${YELLOW}  ⚠${NC} /api/workflows unexpected status ($workflow_status)"
        ((WARNINGS++))
    fi
    
    local features_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://beheer.pagayo.com/api/capabilities/features" 2>/dev/null || echo "000")
    if [[ "$features_status" == "403" ]]; then
        echo "${RED}  ✗${NC} /api/capabilities/features blocked by Cloudflare Access! (403)"
        echo "     → Fix: Create Access bypass application"
        ((FAILED++))
    elif [[ "$features_status" == "200" ]]; then
        echo "${GREEN}  ✓${NC} /api/capabilities/features accessible ($features_status)"
        ((PASSED++))
    else
        echo "${YELLOW}  ⚠${NC} /api/capabilities/features unexpected status ($features_status)"
        ((WARNINGS++))
    fi
    
    # Register endpoint: moet bereikbaar zijn (niet 403 geblokt door Cloudflare Access)
    # Stuur minimale body om validation error te krijgen (ipv 500 crash)
    local register_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST --max-time 10 \
        -H "Content-Type: application/json" \
        -d '{}' \
        "https://beheer.pagayo.com/api/auth/register" 2>/dev/null || echo "000")
    if [[ "$register_status" == "403" ]]; then
        echo "${RED}  ✗${NC} /api/auth/register blocked by Cloudflare Access! (403)"
        ((FAILED++))
    elif [[ "$register_status" == "400" || "$register_status" == "200" ]]; then
        echo "${GREEN}  ✓${NC} /api/auth/register accessible ($register_status)"
        ((PASSED++))
    elif [[ "$register_status" == "500" ]]; then
        echo "${YELLOW}  ⚠${NC} /api/auth/register server error ($register_status) - investigate!"
        ((WARNINGS++))
    else
        echo "${GREEN}  ✓${NC} /api/auth/register accessible ($register_status)"
        ((PASSED++))
    fi
}

# =============================================================================
# DNS Checks
# =============================================================================

check_dns_all() {
    print_header "DNS Resolution"
    
    check_dns "beheer.pagayo.com"
    check_dns "app.pagayo.com"
    check_dns "api.pagayo.com"
    check_dns "www.pagayo.com"
    check_dns "test-3.pagayo.app"
}

# =============================================================================
# SSL Checks
# =============================================================================

check_ssl_all() {
    print_header "SSL Certificates"
    
    check_ssl "beheer.pagayo.com"
    check_ssl "api.pagayo.com"
    check_ssl "www.pagayo.com"
    check_ssl "test-3.pagayo.app"
}

# =============================================================================
# Worker Routes
# =============================================================================

check_worker_routes() {
    print_header "Worker Routes"
    
    # app.pagayo.com moet naar Cloudflare Pages routeren
    local app_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://app.pagayo.com" 2>/dev/null || echo "000")
    if [[ "$app_status" == "200" || "$app_status" == "302" ]]; then
        echo "${GREEN}  ✓${NC} app.pagayo.com routing OK ($app_status)"
        ((PASSED++))
    else
        echo "${RED}  ✗${NC} app.pagayo.com routing failed ($app_status)"
        echo "     → Check pagayo-cloudflare-proxy/src/index.js"
        ((FAILED++))
    fi
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
    print_header "Summary"
    
    echo ""
    echo "  ${GREEN}Passed:${NC}   $PASSED"
    echo "  ${YELLOW}Warnings:${NC} $WARNINGS"
    echo "  ${RED}Failed:${NC}   $FAILED"
    echo ""
    
    if [[ $FAILED -gt 0 ]]; then
        echo "${RED}  ⚠️  CRITICAL: $FAILED checks failed!${NC}"
        echo "     Run smoke tests for details: cd pagayo-beheer && npm run test:smoke"
        return 2
    elif [[ $WARNINGS -gt 0 ]]; then
        echo "${YELLOW}  ⚠️  $WARNINGS warnings - review recommended${NC}"
        return 1
    else
        echo "${GREEN}  ✅ All checks passed!${NC}"
        return 0
    fi
}

# =============================================================================
# Main
# =============================================================================

main() {
    echo ""
    echo "${BLUE}🏗️  Pagayo Infrastructure Health Check${NC}"
    echo "${BLUE}   $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    
    case "${1:-}" in
        --quick)
            check_health_endpoints
            ;;
        --access)
            check_cloudflare_access
            ;;
        --dns)
            check_dns_all
            ;;
        --ssl)
            check_ssl_all
            ;;
        *)
            check_health_endpoints
            check_cloudflare_access
            check_dns_all
            check_ssl_all
            check_worker_routes
            ;;
    esac
    
    print_summary
}

main "$@"
