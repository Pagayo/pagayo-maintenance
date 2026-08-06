#!/usr/bin/env bash
# Bootstrap Pagayo Drive: encrypted rclone crypt → Cloudflare R2 mirror of SOURCE_ROOT.
# Local-only. Secrets live in pagayo-vault/backup/pagayo-drive.env
set -euo pipefail

VAULT_BACKUP="${PAGAYO_VAULT_BACKUP:-/Users/sjoerdoverdiep/my-vscode-workspace/pagayo-vault/backup}"
ENV_FILE="${VAULT_BACKUP}/pagayo-drive.env"
EXAMPLE_FILE="${VAULT_BACKUP}/pagayo-drive.env.example"
RCLONE_CONF="${RCLONE_CONFIG:-${HOME}/.config/rclone/rclone.conf}"
ACCOUNT_ID_DEFAULT="5d4d9b7bcdf6a836c16b19e09d198047"
BUCKET_DEFAULT="pagayo-workspace-drive"
WRANGLER_BIN="${WRANGLER_BIN:-/Users/sjoerdoverdiep/my-vscode-workspace/pagayo-storefront/node_modules/.bin/wrangler}"

log() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$EXAMPLE_FILE" ]]; then
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    # shellcheck disable=SC1090
    chmod 600 "$ENV_FILE"
    log "Created $ENV_FILE — fill R2 keys + crypt passwords, then re-run setup."
  else
    die "Missing $EXAMPLE_FILE"
  fi
fi

# Parse env with Python only — bash `source` mangles base64 crypt secrets (+, /, =).
# Exports non-secret / needed values for wrangler checks below.
eval "$(
  ENV_FILE="$ENV_FILE" ACCOUNT_ID_DEFAULT="$ACCOUNT_ID_DEFAULT" BUCKET_DEFAULT="$BUCKET_DEFAULT" python3 <<'PY'
import os, re, shlex
from pathlib import Path
path = Path(os.environ["ENV_FILE"])
vals = {}
for line in path.read_text().splitlines():
    m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line.strip())
    if not m:
        continue
    k, v = m.group(1), m.group(2)
    if (len(v) >= 2) and ((v[0] == v[-1] == '"') or (v[0] == v[-1] == "'")):
        v = v[1:-1]
    vals[k] = v
src = vals.get("SOURCE_ROOT") or "/Users/sjoerdoverdiep/my-vscode-workspace"
acct = vals.get("CLOUDFLARE_ACCOUNT_ID") or os.environ["ACCOUNT_ID_DEFAULT"]
bucket = vals.get("R2_BUCKET") or os.environ["BUCKET_DEFAULT"]
endpoint = vals.get("R2_ENDPOINT") or f"https://{acct}.r2.cloudflarestorage.com"
# Never export RCLONE_CRYPT_PASSWORD* into the shell — rclone treats
# RCLONE_* as config overrides and then fails obscure-reveal on plaintext.
crypt_set = "1" if vals.get("RCLONE_CRYPT_PASSWORD") else ""
for k, v in {
    "SOURCE_ROOT": src,
    "CLOUDFLARE_ACCOUNT_ID": acct,
    "R2_BUCKET": bucket,
    "R2_ENDPOINT": endpoint,
    "R2_ACCESS_KEY_ID": vals.get("R2_ACCESS_KEY_ID", ""),
    "R2_SECRET_ACCESS_KEY": vals.get("R2_SECRET_ACCESS_KEY", ""),
    "PAGAYO_DRIVE_CRYPT_SET": crypt_set,
}.items():
    print(f"export {k}={shlex.quote(v)}")
PY
)"

SOURCE_ROOT="${SOURCE_ROOT:-/Users/sjoerdoverdiep/my-vscode-workspace}"
CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-$ACCOUNT_ID_DEFAULT}"
R2_BUCKET="${R2_BUCKET:-$BUCKET_DEFAULT}"
R2_ENDPOINT="${R2_ENDPOINT:-https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com}"

[[ -d "$SOURCE_ROOT" ]] || die "SOURCE_ROOT is not a directory: $SOURCE_ROOT"
[[ "$(basename "$SOURCE_ROOT")" == "my-vscode-workspace" ]] || die "Refusing SOURCE_ROOT that is not my-vscode-workspace (got: $SOURCE_ROOT)"

if ! command -v rclone >/dev/null 2>&1; then
  log "Installing rclone via Homebrew…"
  brew install rclone
fi

# Load Cloudflare API token from vault without printing it.
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  TOKEN_FILE="/Users/sjoerdoverdiep/my-vscode-workspace/pagayo-vault/cloudflare/API-TOKENS.local.md"
  if [[ -f "$TOKEN_FILE" ]]; then
    # Prefer already-exported env; else extract export line safely into env only.
    # shellcheck disable=SC1090
    eval "$(
      grep -E '^export CLOUDFLARE_API_TOKEN=' "$TOKEN_FILE" | head -1
    )"
  fi
fi
[[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] || die "CLOUDFLARE_API_TOKEN not set (vault API-TOKENS.local.md or env)"

# Create bucket if missing (idempotent).
if [[ -x "$WRANGLER_BIN" ]]; then
  log "Ensuring R2 bucket exists: $R2_BUCKET"
  if ! CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
    "$WRANGLER_BIN" r2 bucket list 2>/dev/null | grep -q "$R2_BUCKET"; then
    CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
      "$WRANGLER_BIN" r2 bucket create "$R2_BUCKET" || true
  else
    log "Bucket already listed: $R2_BUCKET"
  fi
else
  log "wrangler not found at $WRANGLER_BIN — create bucket manually if needed: $R2_BUCKET"
fi

# Generate crypt passwords if empty (Python write — never export them into this shell).
if [[ -z "${PAGAYO_DRIVE_CRYPT_SET:-}" ]]; then
  ENV_FILE="$ENV_FILE" python3 <<'PY'
import os, re, secrets, base64
from pathlib import Path
path = Path(os.environ["ENV_FILE"])
p1 = base64.b64encode(secrets.token_bytes(32)).decode()
p2 = base64.b64encode(secrets.token_bytes(32)).decode()
lines = path.read_text().splitlines()
out, done1, done2 = [], False, False
for line in lines:
    if re.match(r"^RCLONE_CRYPT_PASSWORD=", line):
        out.append(f'RCLONE_CRYPT_PASSWORD="{p1}"'); done1 = True
    elif re.match(r"^RCLONE_CRYPT_PASSWORD2=", line):
        out.append(f'RCLONE_CRYPT_PASSWORD2="{p2}"'); done2 = True
    else:
        out.append(line)
if not done1:
    out.append(f'RCLONE_CRYPT_PASSWORD="{p1}"')
if not done2:
    out.append(f'RCLONE_CRYPT_PASSWORD2="{p2}"')
path.write_text("\n".join(out) + "\n")
path.chmod(0o600)
print("Generated rclone crypt passwords into pagayo-drive.env (keep offline copy for restore).")
PY
  export PAGAYO_DRIVE_CRYPT_SET=1
fi

if [[ -z "${R2_ACCESS_KEY_ID:-}" || -z "${R2_SECRET_ACCESS_KEY:-}" ]]; then
  cat >&2 <<EOF

R2 S3 API credentials missing in:
  $ENV_FILE

One-time (Dashboard):
  Cloudflare → R2 → Overview → Manage R2 API Tokens → Create API token
  Permissions: Object Read & Write on bucket ${R2_BUCKET} (or account)
  Paste Access Key ID + Secret Access Key into pagayo-drive.env
  Then re-run: $0

EOF
  exit 2
fi

if [[ "$R2_ACCESS_KEY_ID" == "$CLOUDFLARE_ACCOUNT_ID" ]]; then
  cat >&2 <<EOF

R2_ACCESS_KEY_ID is identical to CLOUDFLARE_ACCOUNT_ID — that is wrong.

Use R2 S3 credentials (not the Account ID, not a Profile API token):
  Cloudflare → R2 → Manage R2 API Tokens → Create API token
  Copy Access Key ID + Secret Access Key into pagayo-drive.env
  Then re-run: $0

EOF
  exit 2
fi

mkdir -p "$(dirname "$RCLONE_CONF")"
chmod 700 "$(dirname "$RCLONE_CONF")" 2>/dev/null || true

# Write rclone.conf entirely from env file via Python (no secret argv / no bash source).
ENV_FILE="$ENV_FILE" RCLONE_CONF="$RCLONE_CONF" python3 <<'PY'
import os
import pathlib
import re
import subprocess

def load_env(path: pathlib.Path) -> dict[str, str]:
    vals: dict[str, str] = {}
    for line in path.read_text().splitlines():
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line.strip())
        if not m:
            continue
        k, v = m.group(1), m.group(2)
        if (len(v) >= 2) and ((v[0] == v[-1] == '"') or (v[0] == v[-1] == "'")):
            v = v[1:-1]
        vals[k] = v
    return vals

env_path = pathlib.Path(os.environ["ENV_FILE"])
conf_path = pathlib.Path(os.environ["RCLONE_CONF"])
vals = load_env(env_path)
acct = vals.get("CLOUDFLARE_ACCOUNT_ID") or "5d4d9b7bcdf6a836c16b19e09d198047"
bucket = vals.get("R2_BUCKET") or "pagayo-workspace-drive"
endpoint = vals.get("R2_ENDPOINT") or f"https://{acct}.r2.cloudflarestorage.com"
access = vals["R2_ACCESS_KEY_ID"]
secret = vals["R2_SECRET_ACCESS_KEY"]
pw = subprocess.check_output(["rclone", "obscure", vals["RCLONE_CRYPT_PASSWORD"]], text=True).strip()
pw2 = subprocess.check_output(["rclone", "obscure", vals["RCLONE_CRYPT_PASSWORD2"]], text=True).strip()

text = conf_path.read_text() if conf_path.exists() else ""
out_lines = []
skip = False
for line in text.splitlines():
    if line.strip() in ("[pagayo-r2]", "[pagayo-drive]"):
        skip = True
        continue
    if skip:
        if line.startswith("[") and line.endswith("]"):
            skip = False
            out_lines.append(line)
        continue
    out_lines.append(line)
block = f"""
[pagayo-r2]
type = s3
provider = Cloudflare
access_key_id = {access}
secret_access_key = {secret}
endpoint = {endpoint}
acl = private
no_check_bucket = true

[pagayo-drive]
type = crypt
remote = pagayo-r2:{bucket}
password = {pw}
password2 = {pw2}
filename_encryption = standard
directory_name_encryption = true
"""
conf_path.write_text("\n".join(out_lines).rstrip() + "\n" + block.lstrip() + "\n")
conf_path.chmod(0o600)
print(f"Wrote rclone remotes pagayo-r2 + pagayo-drive → {conf_path}")
PY

# Plain crypt secrets in the environment break rclone obscure-reveal.
unset RCLONE_CRYPT_PASSWORD RCLONE_CRYPT_PASSWORD2 2>/dev/null || true

log "Testing encrypted remote (lsd)…"
rclone lsd pagayo-drive: >/dev/null
log "✅ Setup OK. Run: pagayo-maintenance/.github/scripts/pagayo-drive-sync.sh"
log "SOURCE_ROOT=$SOURCE_ROOT → crypt → r2:$R2_BUCKET (mirror + deletes)"
