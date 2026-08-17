#!/usr/bin/env bash
# Harde guard: pagayo-vault blijft lokaal — nooit GitHub/remote/cloud-sync.
# Wordt aangeroepen door setup + dagelijkse VaultGuard-run.
set -euo pipefail

vaultguard_assert_local_only() {
  local vault_dir="${1:?vault-pad ontbreekt}"

  if [[ ! -d "$vault_dir" ]]; then
    echo "❌ pagayo-vault niet gevonden: $vault_dir" >&2
    return 1
  fi

  # Expliciet beleid: geen git-remote, ook niet private.
  if [[ -d "$vault_dir/.git" ]]; then
    local remotes=""
    remotes="$(git -C "$vault_dir" remote 2>/dev/null || true)"
    if [[ -n "$remotes" ]]; then
      echo "❌ BLOCKED: pagayo-vault heeft git-remote(s):" >&2
      git -C "$vault_dir" remote -v >&2 || true
      echo "   Verwijder remotes of .git — vault mag nooit online." >&2
      return 1
    fi
    echo "⚠️  pagayo-vault heeft .git zonder remote (lokaal only). Geen push gebruiken." >&2
  fi

  # Blokkeer bekende sync/cloud-paden in vault (heuristiek).
  local forbidden
  for forbidden in .git/config .github/CODEOWNERS; do
    if [[ -f "$vault_dir/$forbidden" ]] && grep -qiE 'github\.com|gitlab\.com|bitbucket\.org' "$vault_dir/$forbidden" 2>/dev/null; then
      echo "❌ BLOCKED: verdachte remote-URL in $vault_dir/$forbidden" >&2
      return 1
    fi
  done

  if [[ ! -f "$vault_dir/LOCAL-ONLY.policy" ]]; then
    echo "⚠️  LOCAL-ONLY.policy ontbreekt — draai setup-vaultguard-local.sh opnieuw." >&2
  fi

  return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  vaultguard_assert_local_only "${1:-}"
fi
