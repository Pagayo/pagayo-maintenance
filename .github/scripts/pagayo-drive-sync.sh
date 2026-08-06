#!/usr/bin/env bash
# Pagayo Drive sync: local workspace → encrypted R2 mirror (rclone sync deletes remotely).
# Disaster-recovery only. Not a deploy path.
set -euo pipefail

VAULT_BACKUP="${PAGAYO_VAULT_BACKUP:-/Users/sjoerdoverdiep/my-vscode-workspace/pagayo-vault/backup}"
ENV_FILE="${VAULT_BACKUP}/pagayo-drive.env"
FILTER_FILE="${VAULT_BACKUP}/pagayo-drive.excludes"
LOG_DIR="${HOME}/Library/Logs/pagayo"
LOG_FILE="${LOG_DIR}/pagayo-drive-sync.log"
LOCK_DIR="${TMPDIR:-/tmp}/pagayo-drive-sync.lock"
DRY_RUN="${PAGAYO_DRIVE_DRY_RUN:-0}"

mkdir -p "$LOG_DIR"

log() {
  local line
  line="$(date '+%Y-%m-%dT%H:%M:%S%z') $*"
  printf '%s\n' "$line" | tee -a "$LOG_FILE"
}

die() { log "ERROR: $*"; exit 1; }

[[ -f "$ENV_FILE" ]] || die "Missing $ENV_FILE — run pagayo-drive-setup.sh first"
[[ -f "$FILTER_FILE" ]] || die "Missing $FILTER_FILE"

# Load only non-crypt values. Never export RCLONE_CRYPT_PASSWORD* — rclone
# treats RCLONE_* as overrides and fails obscure-reveal on plaintext secrets.
eval "$(
  ENV_FILE="$ENV_FILE" python3 <<'PY'
import os, re, shlex
from pathlib import Path
vals = {}
for line in Path(os.environ["ENV_FILE"]).read_text().splitlines():
    m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line.strip())
    if not m:
        continue
    k, v = m.group(1), m.group(2)
    if (len(v) >= 2) and ((v[0] == v[-1] == '"') or (v[0] == v[-1] == "'")):
        v = v[1:-1]
    if k.startswith("RCLONE_CRYPT_"):
        continue
    if k in ("SOURCE_ROOT", "R2_BUCKET", "CLOUDFLARE_ACCOUNT_ID", "R2_ENDPOINT"):
        print(f"export {k}={shlex.quote(v)}")
PY
)"

SOURCE_ROOT="${SOURCE_ROOT:-/Users/sjoerdoverdiep/my-vscode-workspace}"
[[ -d "$SOURCE_ROOT" ]] || die "SOURCE_ROOT missing: $SOURCE_ROOT"
[[ "$(basename "$SOURCE_ROOT")" == "my-vscode-workspace" ]] || die "Refusing unexpected SOURCE_ROOT: $SOURCE_ROOT"

# launchd has a minimal PATH — Homebrew rclone is not on it by default.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
RCLONE_BIN="${RCLONE_BIN:-}"
if [[ -z "$RCLONE_BIN" ]]; then
  if [[ -x /opt/homebrew/bin/rclone ]]; then
    RCLONE_BIN=/opt/homebrew/bin/rclone
  elif [[ -x /usr/local/bin/rclone ]]; then
    RCLONE_BIN=/usr/local/bin/rclone
  else
    RCLONE_BIN="$(command -v rclone 2>/dev/null || true)"
  fi
fi
[[ -n "$RCLONE_BIN" && -x "$RCLONE_BIN" ]] || die "rclone not installed — run pagayo-drive-setup.sh"
unset RCLONE_CRYPT_PASSWORD RCLONE_CRYPT_PASSWORD2 2>/dev/null || true

# Single-flight lock
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  log "Another sync holds lock ($LOCK_DIR) — exit"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

log "START mirror sync SOURCE_ROOT=$SOURCE_ROOT → pagayo-drive: (encrypted R2)"

# rclone sync = Drive-like: remote matches local; deletes on R2 when removed locally.
# Build argv without empty-array expansion under `set -u`.
RCLONE_ARGS=(
  sync "$SOURCE_ROOT" "pagayo-drive:"
  --filter-from "$FILTER_FILE"
  --create-empty-src-dirs
  --delete-during
  --fast-list
  --transfers 8
  --checkers 16
  --retries 3
  --low-level-retries 10
  --stats 1m
  --stats-log-level NOTICE
  --log-file "$LOG_FILE"
  --log-level INFO
)
if [[ "$DRY_RUN" == "1" ]]; then
  RCLONE_ARGS+=(--dry-run)
  log "DRY RUN enabled"
fi

"$RCLONE_BIN" "${RCLONE_ARGS[@]}"

log "DONE mirror sync OK"
