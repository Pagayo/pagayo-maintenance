#!/usr/bin/env bash
# =============================================================================
# update-release-manifest.sh
# -----------------------------------------------------------------------------
# Werkt releases/current.json bij met een nieuwe verified-staging SHA voor
# een specifieke repo. Gebruikt door .github/workflows/update-release-manifest.yml.
#
# Lokaal (dry-run):
#   scripts/update-release-manifest.sh pagayo-storefront abc123... --dry-run
#
# Lokaal of in CI (alleen bestand bijwerken, geen git side effects):
#   scripts/update-release-manifest.sh pagayo-storefront abc123... --write-only
# =============================================================================
set -euo pipefail

REPO="${1:-}"
SHA="${2:-}"
MODE="${3:---write-only}"

if [[ -z "$REPO" || -z "$SHA" ]]; then
  echo "Usage: $0 <repo-name> <full-sha> [--dry-run|--write-only]" >&2
  exit 2
fi

if [[ "$MODE" != "--dry-run" && "$MODE" != "--write-only" ]]; then
  echo "::error::Ongeldige mode '$MODE'. Gebruik --dry-run of --write-only." >&2
  exit 2
fi

if ! [[ "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "::error::SHA moet een full 40-char git SHA zijn (gekregen: '$SHA')" >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "::error::jq is niet beschikbaar" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$REPO_ROOT/releases/current.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "::error::Manifest niet gevonden: $MANIFEST" >&2
  exit 1
fi

# Valideer dat de repo-key bestaat in het manifest (geen silent no-op)
if ! jq -e --arg repo "$REPO" '.repos[$repo]' "$MANIFEST" >/dev/null; then
  echo "::error::Onbekende repo-key '$REPO' in manifest. Voeg deze eerst toe aan releases/current.json." >&2
  exit 1
fi

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ACTOR="${GITHUB_ACTOR:-github-actions[bot]}"
SHORT_SHA="${SHA:0:12}"
COMMIT_MESSAGE="chore(releases): verify $REPO@$SHORT_SHA in staging"
PR_BRANCH="automation/release-manifest-$REPO"

TMP="$(mktemp)"
jq \
  --arg repo "$REPO" \
  --arg sha "$SHA" \
  --arg now "$NOW" \
  --arg actor "$ACTOR" \
  '.updated_at = $now
   | .updated_by = $actor
   | .repos[$repo].staging_sha = $sha
   | .repos[$repo].verified_at = $now' \
  "$MANIFEST" > "$TMP"

if cmp -s "$TMP" "$MANIFEST"; then
  rm -f "$TMP"
  echo "ℹ️  Geen manifest-wijziging nodig: $REPO staat al op $SHA."

  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    {
      echo "changed=false"
      echo "commit_message=$COMMIT_MESSAGE"
      echo "pr_branch=$PR_BRANCH"
      echo "pr_title=$COMMIT_MESSAGE"
    } >> "$GITHUB_OUTPUT"
  fi

  if [[ "$MODE" == "--dry-run" ]]; then
    jq --arg repo "$REPO" '.repos[$repo]' "$MANIFEST"
  fi

  exit 0
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "changed=true"
    echo "commit_message=$COMMIT_MESSAGE"
    echo "pr_branch=$PR_BRANCH"
    echo "pr_title=$COMMIT_MESSAGE"
  } >> "$GITHUB_OUTPUT"
fi

if [[ "$MODE" == "--dry-run" ]]; then
  echo "ℹ️  --dry-run: geen bestandsschrijfactie of git-actie."
  jq --arg repo "$REPO" '.repos[$repo]' "$TMP"
  rm -f "$TMP"
  exit 0
fi

mv "$TMP" "$MANIFEST"
echo "✅ Manifest bijgewerkt: $REPO -> $SHA ($NOW)"
echo "ℹ️  Geen git side effects: open een PR vanaf $PR_BRANCH om deze wijziging naar main te brengen."
