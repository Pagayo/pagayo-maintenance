#!/usr/bin/env bash
set -euo pipefail

git fetch origin main --depth=1

if ! git merge-base --is-ancestor "${GITHUB_SHA:-HEAD}" origin/main; then
  echo "❌ Publish provenance check failed: ${GITHUB_SHA:-HEAD} is not reachable from origin/main"
  echo "Publish only from commits merged to main."
  exit 1
fi

echo "✅ Publish provenance verified: commit is ancestor of origin/main"
