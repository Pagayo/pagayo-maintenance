#!/usr/bin/env bash
# Gedeelde functies voor persistente lokale Pagayo dev (macOS Terminal + migraties).
# Afgeleid van pagayo-vault/Start Wrangler Lokaal.command en Wrangler refresh.command

# shellcheck disable=SC2034
local_dev_lib_loaded=true

local_dev_resolve_workspace() {
  local script_dir="$1"
  if [[ -n "${PAGAYO_WORKSPACE:-}" && -d "$PAGAYO_WORKSPACE/pagayo-storefront" ]]; then
    echo "$PAGAYO_WORKSPACE"
    return 0
  fi
  # pagayo-maintenance/.github/scripts -> workspace root
  cd "$script_dir/../../.." && pwd
}

local_dev_export_wrangler_env() {
  export CI=true
  export WRANGLER_SEND_METRICS=false
}

local_dev_stop_wrangler_and_ports() {
  local existing
  existing="$(pgrep -f "wrangler" 2>/dev/null | wc -l | tr -d ' ')" || existing=0
  if [[ "${existing:-0}" -gt 0 ]]; then
    echo "⚠️  $existing wrangler-process(en) — stoppen (SQLite lock voorkomen)..."
    pkill -f "wrangler" 2>/dev/null || true
    sleep 2
    local remaining
    remaining="$(pgrep -f "wrangler" 2>/dev/null | wc -l | tr -d ' ')" || remaining=0
    if [[ "${remaining:-0}" -gt 0 ]]; then
      pkill -9 -f "wrangler" 2>/dev/null || true
      sleep 1
    fi
  fi

  for PORT in 3000 5173 5500 8787 4321 9229 9230; do
    local pid=""
    pid="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)" || true
    if [[ -n "$pid" ]]; then
      echo "⚠️  Poort $PORT bezet (PID $pid) — vrijmaken..."
      kill "$pid" 2>/dev/null || true
      sleep 1
    fi
  done
}

local_dev_apply_tenant_migrations() {
  local ws="$1"
  echo "🧩 Storefront lokale tenant migraties..."
  (
    cd "$ws/pagayo-storefront" || exit 1
    local_dev_export_wrangler_env
    npx tsx ./scripts/apply-local-tenant-migrations.ts
  )
  echo ""
}

local_dev_apply_api_migrations() {
  local ws="$1"
  echo "🧱 API Stack lokale D1 migraties..."
  (
    cd "$ws/pagayo-api-stack" || exit 1
    local_dev_export_wrangler_env

    local api_migration_dir="node_modules/@pagayo/schema/migrations/api-v2"
    local api_db_name="pagayo-api"

    if [[ ! -d "$api_migration_dir" ]]; then
      echo "⚠️  Geen API migratie directory: $api_migration_dir"
      return 0
    fi

    npx wrangler d1 execute "$api_db_name" \
      --local \
      --yes \
      --command="CREATE TABLE IF NOT EXISTS _migration_log (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')), checksum TEXT NOT NULL);" >/dev/null

    local applied=0 skipped=0
    local sql_file filename checksum result output apply_ok

    while IFS= read -r sql_file; do
      filename="$(basename "$sql_file")"
      checksum="$(shasum -a 256 "$sql_file" | awk '{print $1}')"

      result="$(npx wrangler d1 execute "$api_db_name" \
        --local \
        --yes \
        --command="SELECT filename FROM _migration_log WHERE filename='$filename';" 2>&1)" || true

      if echo "$result" | grep -q "$filename"; then
        skipped=$((skipped + 1))
        continue
      fi

      apply_ok=false
      if output="$(npx wrangler d1 execute "$api_db_name" \
        --local \
        --yes \
        --file="$sql_file" 2>&1)"; then
        apply_ok=true
      fi

      if [[ "$apply_ok" == true ]]; then
        npx wrangler d1 execute "$api_db_name" \
          --local \
          --yes \
          --command="INSERT OR REPLACE INTO _migration_log (filename, checksum) VALUES ('$filename', '$checksum');" >/dev/null || true
        applied=$((applied + 1))
      elif echo "$output" | grep -qiE "already exists|duplicate column|UNIQUE constraint.*_migration_log|SQLITE_CONSTRAINT.*_migration_log"; then
        npx wrangler d1 execute "$api_db_name" \
          --local \
          --yes \
          --command="INSERT OR REPLACE INTO _migration_log (filename, checksum) VALUES ('$filename', '$checksum');" >/dev/null || true
        applied=$((applied + 1))
      else
        echo "❌ API migratie geblokkeerd: $filename"
        echo "$output"
        return 1
      fi
    done < <(find "$api_migration_dir" -maxdepth 1 -name "*.sql" -type f | sort)

    echo "   ✅ API D1: $applied toegepast, $skipped overgeslagen"
  )
  echo ""
}

local_dev_bootstrap_preserve() {
  local ws="$1"
  local wrangler_state_dir="$ws/.wrangler-shared/v3/d1"

  if [[ -d "$wrangler_state_dir" ]]; then
    echo "💾 Bestaande lokale D1 state — tenantdata blijft behouden."
    echo "   Geen fresh reset."
  else
    echo "🗑️  Geen lokale D1 state — fresh bootstrap..."
    (
      cd "$ws/pagayo-storefront" || exit 1
      local_dev_export_wrangler_env
      ./scripts/setup-local-d1.sh --fresh
    )
  fi
  echo ""
}

local_dev_bootstrap_fresh() {
  local ws="$1"
  echo "🗑️  Fresh D1 databases..."
  (
    cd "$ws/pagayo-storefront" || exit 1
    local_dev_export_wrangler_env
    ./scripts/setup-local-d1.sh --fresh
  )
  echo ""
}

# Start services in macOS Terminal.app — blijft draaien na sluiten Cursor/agent.
local_dev_runtime_dir() {
  echo "/tmp/pagayo-local-dev"
}

local_dev_spawn_background() {
  local name="$1"
  local workdir="$2"
  shift 2
  local dir log pidfile daemon pid prev_dir

  dir="$(local_dev_runtime_dir)"
  log="$dir/$name.log"
  pidfile="$dir/$name.pid"
  daemon="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/local-dev-daemon.py"
  mkdir -p "$dir"

  if [[ ! -f "$daemon" ]]; then
    echo "❌ Daemon helper ontbreekt: $daemon"
    return 1
  fi

  prev_dir="$(pwd)"
  python3 "$daemon" "$workdir" "$log" "$pidfile" "$@"
  cd "$prev_dir" || true

  if [[ -f "$pidfile" ]]; then
    pid="$(cat "$pidfile")"
    echo "   ▶ $name (PID $pid)"
  else
    echo "   ▶ $name (gestart)"
  fi
}

local_dev_start_background_services() {
  local ws="$1"

  echo "🚀 Services starten op achtergrond (geen Terminal-vensters)..."
  echo "   Logs: $(local_dev_runtime_dir)/"

  # --restart-tries: wrangler/vite hiccups (design sync, hot reload) auto-recover.
  # Daemon supervisor (local-dev-daemon.py) restarts the whole service on crash.
  local_dev_spawn_background "storefront" "$ws/pagayo-storefront" \
    bash -lc "npm run copy-design && exec npx concurrently --restart-tries 999999 --restart-after 3000 --names wrangler,static -c cyan,magenta 'wrangler dev --persist-to ../.wrangler-shared' 'npm run serve:public'"

  sleep 2

  local_dev_spawn_background "vite" "$ws/pagayo-storefront" \
    bash -lc "npm run copy-design && exec npx vite"
  sleep 1
  local_dev_spawn_background "api-stack" "$ws/pagayo-api-stack" \
    bash -lc "exec npm run dev"
  local_dev_spawn_background "marketing" "$ws/pagayo-marketing" \
    bash -lc "exec npm run dev"
}

local_dev_stop_background_pids() {
  local dir pidfile pid

  dir="$(local_dev_runtime_dir)"
  [[ -d "$dir" ]] || return 0

  for pidfile in "$dir"/*.pid; do
    [[ -f "$pidfile" ]] || continue
    pid="$(cat "$pidfile" 2>/dev/null)" || continue
    [[ -n "$pid" ]] || continue
    kill "$pid" 2>/dev/null || true
  done
}

local_dev_start_terminal_services() {
  local ws="$1"

  if ! command -v osascript >/dev/null 2>&1; then
    echo "❌ osascript niet beschikbaar — Terminal-start vereist macOS."
    return 1
  fi

  echo "🚀 Services openen in Terminal.app (blijven draaien)..."

  osascript -e "tell application \"Terminal\"
    do script \"cd '$ws/pagayo-storefront' && npm run copy-design && npx concurrently --names 'wrangler,static' -c 'cyan,magenta' 'wrangler dev --persist-to ../.wrangler-shared' 'npm run serve:public'\"
end tell"

  sleep 2

  osascript -e "tell application \"Terminal\"
    do script \"cd '$ws/pagayo-storefront' && npm run dev:client\"
end tell"

  sleep 2

  osascript -e "tell application \"Terminal\"
    do script \"cd '$ws/pagayo-api-stack' && npm run dev\"
end tell"

  osascript -e "tell application \"Terminal\"
    do script \"cd '$ws/pagayo-marketing' && npm run dev\"
end tell"
}

local_dev_print_urls() {
  local fresh_note="${1:-}"
  local mode="${2:-background}"
  echo ""
  if [[ "$mode" == "terminal" ]]; then
    echo "✅ Alle services worden gestart in Terminal.app!"
  else
    echo "✅ Alle services draaien op de achtergrond."
  fi
  echo ""
  echo "📍 URLs:"
  echo "   Platform Admin:   http://admin.localhost:3000/platform"
  echo "   Tenant Admin:     http://demo.localhost:3000/admin"
  echo "   Webshop:          http://demo.localhost:3000"
  echo "   Vite:             http://localhost:5173/assets/"
  echo "   Design CSS:       http://localhost:5500/design/dist/fresh/webshop.css"
  echo "   API Stack:        http://localhost:8787"
  echo "   Marketing:        http://localhost:4321"
  echo ""
  echo "👤 Admin: dev@pagayo.com / admin123"
  echo "🌱 Tenants: demo, test"
  if [[ -n "$fresh_note" ]]; then
    echo ""
    echo "$fresh_note"
  fi
  echo ""
  if [[ "$mode" == "terminal" ]]; then
    echo "Terminal-vensters open laten. Stop: pagayo-maintenance/.github/scripts/local-dev-stop.sh"
  else
    echo "Logs: $(local_dev_runtime_dir)/   Stop: pagayo-maintenance/.github/scripts/local-dev-stop.sh"
  fi
}

local_dev_wait_for_health() {
  local max_seconds="${1:-45}"
  local deadline=$((SECONDS + max_seconds))
  echo "⏳ Wachten op poorten (max ${max_seconds}s)..."
  while (( SECONDS < deadline )); do
    if curl -sf --max-time 2 http://demo.localhost:3000/ >/dev/null 2>&1 \
      && curl -sf --max-time 2 http://localhost:5173/assets/ >/dev/null 2>&1 \
      && curl -sf --max-time 2 http://localhost:5500/design/dist/fresh/webshop.css >/dev/null 2>&1 \
      && curl -sf --max-time 2 http://localhost:8787/ >/dev/null 2>&1; then
      echo "✅ Health check OK"
      return 0
    fi
    sleep 2
  done
  echo "⚠️  Nog niet alle poorten reageerden — services hebben mogelijk meer tijd nodig."
  return 1
}
