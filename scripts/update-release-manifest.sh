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
# In CI (commit + push direct naar main):
#   scripts/update-release-manifest.sh pagayo-storefront abc123...
# =============================================================================
set -euo pipefail

REPO="${1:-}"
SHA="${2:-}"
MODE="${3:-commit}"

if [[ -z "$REPO" || -z "$SHA" ]]; then
  echo "Usage: $0 <repo-name> <full-sha> [--dry-run]" >&2
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

mv "$TMP" "$MANIFEST"
echo "✅ Manifest updated: $REPO -> $SHA ($NOW)"

if [[ "$MODE" == "--dry-run" ]]; then
  echo "ℹ️  --dry-run: geen commit/push."
  jq --arg repo "$REPO" '.repos[$repo]' "$MANIFEST"
  exit 0
fi

# Commit + push direct naar main (manifest is stabieler dan feature-branch:
# staat voor "verified in staging", niet voor "work in progress").
cd "$REPO_ROOT"
git config user.name  "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

if git diff --quiet -- releases/current.json; then
  echo "ℹ️  Geen wijzigingen aan manifest (identieke SHA). Skip commit."
  exit 0
fi

git add releases/current.json
git commit -m "chore(releases): verify $REPO@${SHA:0:12} in staging"
git push origin HEAD:main
echo "✅ Commit gepusht naar main."
