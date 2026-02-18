#!/bin/zsh
# =============================================================================
# Pagayo Secrets Sync Script
# =============================================================================
# Synchroniseert secrets naar alle relevante Workers.
# Omdat Cloudflare Secrets Store (Open Beta) niet werkt, gebruiken we
# per-worker secrets. Dit script maakt centrale management mogelijk.
#
# Gebruik:
#   ./sync-secrets.sh DATABASE_URL "postgresql://..."
#   ./sync-secrets.sh EDGE_SECRET "secret_value"
#   ./sync-secrets.sh --list
#
# Laatst bijgewerkt: 7 februari 2026
# =============================================================================

set -e

# Worker configurations
# Format: get_workers_for_secret returns "worker:env worker:env ..."

get_workers_for_secret() {
    local secret=$1
    case $secret in
        DATABASE_URL)
            echo "pagayo-beheer:production pagayo-beheer:staging"
            ;;
        DATABASE_URL_STOREFRONT)
            echo "pagayo-storefront:production pagayo-storefront:staging"
            ;;
        DATABASE_URL_API)
            echo "pagayo-api-stack:production pagayo-api-stack:staging"
            ;;
        EDGE_SECRET)
            echo "pagayo-edge:production pagayo-edge:staging pagayo-workflows:production pagayo-workflows:staging"
            ;;
        ADMIN_SECRET)
            echo "pagayo-beheer:production pagayo-beheer:staging pagayo-workflows:production"
            ;;
        PROVISIONING_API_KEY)
            echo "pagayo-beheer:production pagayo-beheer:staging"
            ;;
        WORKFLOW_API_KEY)
            echo "pagayo-beheer:production pagayo-beheer:staging"
            ;;
        AWS_SES_ACCESS_KEY)
            echo "pagayo-api-stack:production pagayo-api-stack:staging pagayo-storefront:production pagayo-storefront:staging pagayo-beheer:production pagayo-beheer:staging"
            ;;
        AWS_SES_SECRET_KEY)
            echo "pagayo-api-stack:production pagayo-api-stack:staging pagayo-storefront:production pagayo-storefront:staging pagayo-beheer:production pagayo-beheer:staging"
            ;;
        AWS_SES_REGION)
            echo "pagayo-api-stack:production pagayo-api-stack:staging pagayo-storefront:production pagayo-storefront:staging pagayo-beheer:production pagayo-beheer:staging"
            ;;
        *)
            echo ""
            ;;
    esac
}

ALL_SECRETS="DATABASE_URL DATABASE_URL_STOREFRONT DATABASE_URL_API EDGE_SECRET ADMIN_SECRET PROVISIONING_API_KEY WORKFLOW_API_KEY AWS_SES_ACCESS_KEY AWS_SES_SECRET_KEY AWS_SES_REGION"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_usage() {
    echo "Usage:"
    echo "  $0 <SECRET_NAME> <SECRET_VALUE>  - Set secret on all relevant workers"
    echo "  $0 --list                        - List which workers use which secrets"
    echo "  $0 --check <SECRET_NAME>         - Check if secret exists on all workers"
    echo ""
    echo "Available secrets:"
    for secret in ${=ALL_SECRETS}; do
        echo "  - $secret"
    done
}

list_secrets() {
    echo -e "${GREEN}=== Pagayo Secrets Configuration ===${NC}"
    echo ""
    for secret in ${=ALL_SECRETS}; do
        local workers=$(get_workers_for_secret $secret)
        if [[ -n "$workers" ]]; then
            echo -e "${YELLOW}$secret${NC}"
            for worker_env in ${=workers}; do
                local worker=${worker_env%%:*}
                local env=${worker_env##*:}
                echo "  └── $worker ($env)"
            done
            echo ""
        fi
    done
}

sync_secret() {
    local secret_name=$1
    local secret_value=$2
    local workers=$(get_workers_for_secret $secret_name)
    
    if [[ -z "$workers" ]]; then
        echo -e "${RED}Error: Unknown secret '$secret_name'${NC}"
        echo "Use --list to see available secrets"
        exit 1
    fi
    
    echo -e "${GREEN}=== Syncing $secret_name ===${NC}"
    echo ""
    
    local failed=0
    for worker_env in ${=workers}; do
        local worker=${worker_env%%:*}
        local env=${worker_env##*:}
        
        echo -n "Setting on $worker ($env)... "
        
        # Use printf to avoid newline issues
        if printf '%s' "$secret_value" | npx wrangler secret put "$secret_name" --name "$worker" --env "$env" 2>/dev/null; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC}"
            ((failed++))
        fi
    done
    
    echo ""
    if [[ $failed -eq 0 ]]; then
        echo -e "${GREEN}All workers updated successfully!${NC}"
    else
        echo -e "${RED}$failed worker(s) failed to update${NC}"
        exit 1
    fi
}

check_secret() {
    local secret_name=$1
    local workers=$(get_workers_for_secret $secret_name)
    
    if [[ -z "$workers" ]]; then
        echo -e "${RED}Error: Unknown secret '$secret_name'${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}=== Checking $secret_name ===${NC}"
    echo ""
    
    for worker_env in ${=workers}; do
        local worker=${worker_env%%:*}
        local env=${worker_env##*:}
        
        echo -n "$worker ($env): "
        
        # Check if secret exists (wrangler secret list)
        if npx wrangler secret list --name "$worker" --env "$env" 2>/dev/null | grep -q "$secret_name"; then
            echo -e "${GREEN}exists${NC}"
        else
            echo -e "${YELLOW}not set${NC}"
        fi
    done
}

# Main
case "${1:-}" in
    --list)
        list_secrets
        ;;
    --check)
        if [ -z "$2" ]; then
            echo "Usage: $0 --check <SECRET_NAME>"
            exit 1
        fi
        check_secret "$2"
        ;;
    --help|-h)
        print_usage
        ;;
    "")
        print_usage
        exit 1
        ;;
    *)
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Secret value required${NC}"
            echo "Usage: $0 <SECRET_NAME> <SECRET_VALUE>"
            exit 1
        fi
        sync_secret "$1" "$2"
        ;;
esac
