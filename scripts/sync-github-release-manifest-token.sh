#!/usr/bin/env bash
# =============================================================================
# Zet GitHub-repo-secret RELEASE_MANIFEST_TOKEN op alle consumer-repos.
# Vereist een PAT die workflow_dispatch mag doen op Pagayo/pagayo-maintenance.
# Aanbevolen: fine-grained PAT (zie RUNBOOK-release-manifest.md §3.1).
# =============================================================================
set -euo pipefail

CONSUMER_REPOS=(
  Pagayo/pagayo-storefront
  Pagayo/pagayo-api-stack
  Pagayo/pagayo-edge
  Pagayo/pagayo-workflows
)

usage() {
  echo "Gebruik:" >&2
  echo "  RELEASE_MANIFEST_PAT=<token> $0" >&2
  echo "" >&2
  echo "Maak eerst een fine-grained PAT (resource owner Pagayo, alleen repo" >&2
  echo "pagayo-maintenance, Actions: Read and write). Zie RUNBOOK-release-manifest.md §3.1." >&2
  exit 1
}

if [[ -z "${RELEASE_MANIFEST_PAT:-}" ]]; then
  usage
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "error: gh is niet ingelogd (gh auth login)." >&2
  exit 1
fi

for repo in "${CONSUMER_REPOS[@]}"; do
  echo "→ RELEASE_MANIFEST_TOKEN op ${repo} …"
  printf '%s' "${RELEASE_MANIFEST_PAT}" | gh secret set RELEASE_MANIFEST_TOKEN -R "${repo}" --body -
done

echo "Klaar: ${#CONSUMER_REPOS[@]} repo's bijgewerkt."
