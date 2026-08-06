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

  local_dev_free_ports
}

# Free local-dev ports. Kills ALL listeners (incl. Cursor mcp-process on 8787).
# Does not target the Cursor app itself — only the specific PIDs holding our ports.
local_dev_free_ports() {
  local PORT pid
  for PORT in 3000 5173 5500 8787 4321 9229 9230; do
    while IFS= read -r pid; do
      [[ -n "$pid" ]] || continue
      # Never kill the main Cursor app binary — only helpers / servers on the port.
      local comm
      comm="$(ps -p "$pid" -o comm= 2>/dev/null || true)"
      if [[ "$comm" == "Cursor" ]]; then
        echo "⚠️  Poort $PORT bezet door Cursor-app (PID $pid) — overslaan"
        continue
      fi
      echo "⚠️  Poort $PORT bezet (PID $pid, $comm) — vrijmaken..."
      kill "$pid" 2>/dev/null || true
      sleep 0.5
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    done < <(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
  done
  sleep 1
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

# Repair Wrangler/workerd alarm metadata schema drift (_cf_ALARM column mismatch).
# Keeps D1 tenant object DBs; only removes miniflare metadata.sqlite* registries.
local_dev_repair_wrangler_alarm_metadata() {
  local ws="$1"
  local count=0
  local f

  echo "🔧 Wrangler alarm-metadata check (_cf_ALARM)…"
  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    # Only touch files that actually have the drifted 3-column alarm table
    if command -v sqlite3 >/dev/null 2>&1; then
      cols="$(sqlite3 "$f" "PRAGMA table_info(_cf_ALARM);" 2>/dev/null | wc -l | tr -d ' ')" || cols=0
      if [[ "${cols:-0}" -lt 1 ]]; then
        continue
      fi
    fi
    rm -f "$f" "${f}-wal" "${f}-shm" 2>/dev/null || true
    count=$((count + 1))
  done < <(find "$ws/.wrangler-shared" \
    "$ws/pagayo-storefront/.wrangler" \
    "$ws/pagayo-api-stack/.wrangler" \
    -name 'metadata.sqlite' 2>/dev/null)

  if [[ "$count" -gt 0 ]]; then
    echo "   ✓ $count metadata.sqlite gerepareerd (D1 tenantdata intact)"
  else
    echo "   ✓ geen alarm-metadata reparatie nodig"
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

# Persist restart command for watchdog respawn (bash -lc body only).
local_dev_write_service_meta() {
  local name="$1"
  local workdir="$2"
  local cmd="$3"
  local dir

  dir="$(local_dev_runtime_dir)"
  mkdir -p "$dir"
  printf 'workdir=%s\n' "$workdir" >"$dir/$name.meta"
  printf '%s\n' "$cmd" >"$dir/$name.cmd"
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

# Restart-loop wrappers: Wrangler exits on ExportedHandler/circular-reload crashes
# and must come back without agent intervention. concurrently --restart-tries -1
# restarts the dead child; outer while covers full-group death.
local_dev_storefront_cmd() {
  cat <<'EOF'
set +e
while true; do
  npm run copy-design || { echo "[storefront] copy-design failed — retry in 5s"; sleep 5; continue; }
  npx concurrently \
    --restart-tries -1 \
    --restart-after 2000 \
    --names wrangler,static \
    -c cyan,magenta \
    "wrangler dev --persist-to ../.wrangler-shared" \
    "npm run serve:public"
  echo "[storefront] concurrently exited — restart in 3s"
  sleep 3
done
EOF
}

local_dev_vite_cmd() {
  cat <<'EOF'
set +e
# macOS 26 / agent edits: reinforce Vite polling (see storefront vite.config.ts server.watch)
export PAGAYO_VITE_WATCH_POLLING=1
export CHOKIDAR_USEPOLLING=true
while true; do
  npm run copy-design || { echo "[vite] copy-design failed — retry in 5s"; sleep 5; continue; }
  echo "[vite] starting with polling watch (macOS FSEvents / agent-edit safety)"
  npx vite
  echo "[vite] exited — restart in 3s"
  sleep 3
done
EOF
}

local_dev_api_stack_cmd() {
  cat <<'EOF'
set +e
while true; do
  npm run dev
  echo "[api-stack] exited — restart in 3s"
  sleep 3
done
EOF
}

local_dev_marketing_cmd() {
  cat <<'EOF'
set +e
while true; do
  npm run dev
  echo "[marketing] exited — restart in 3s"
  sleep 3
done
EOF
}

# Build stale @pagayo packages while stack is down (avoids symlink mid-build races).
local_dev_sync_stale_packages() {
  local ws="$1"
  local stale_config="" stale_schema="" stale_design=""

  echo "📦 Shared packages — stale check…"

  if [[ -f "$ws/pagayo-config/dist/index.js" ]]; then
    stale_config="$(find "$ws/pagayo-config/src" -name "*.ts" -newer "$ws/pagayo-config/dist/index.js" 2>/dev/null | head -1 || true)"
  elif [[ -d "$ws/pagayo-config/src" ]]; then
    stale_config="missing-dist"
  fi
  if [[ -f "$ws/pagayo-schema/dist/index.js" ]]; then
    stale_schema="$(find "$ws/pagayo-schema/src" -name "*.ts" -newer "$ws/pagayo-schema/dist/index.js" 2>/dev/null | head -1 || true)"
  elif [[ -d "$ws/pagayo-schema/src" ]]; then
    stale_schema="missing-dist"
  fi
  if [[ -f "$ws/pagayo-design/dist/fresh/webshop.css" ]]; then
    stale_design="$(find "$ws/pagayo-design/src" -newer "$ws/pagayo-design/dist/fresh/webshop.css" 2>/dev/null | head -1 || true)"
  elif [[ -d "$ws/pagayo-design/src" ]]; then
    stale_design="missing-dist"
  fi

  if [[ -n "$stale_config" ]]; then
    echo "   ▶ build @pagayo/config"
    (cd "$ws/pagayo-config" && npm run build)
    if [[ -d "$ws/pagayo-storefront/node_modules/@pagayo/config/dist" ]]; then
      rsync -a --delete "$ws/pagayo-config/dist/" "$ws/pagayo-storefront/node_modules/@pagayo/config/dist/"
    fi
    if [[ -d "$ws/pagayo-api-stack/node_modules/@pagayo/config/dist" ]] \
      && [[ ! -L "$ws/pagayo-api-stack/node_modules/@pagayo/config" ]]; then
      rsync -a --delete "$ws/pagayo-config/dist/" "$ws/pagayo-api-stack/node_modules/@pagayo/config/dist/"
    fi
  else
    echo "   ✓ @pagayo/config up-to-date"
  fi

  if [[ -n "$stale_schema" ]]; then
    echo "   ▶ build @pagayo/schema (stack must be stopped — api-stack may symlink live package)"
    (cd "$ws/pagayo-schema" && npm run build)
    if [[ -d "$ws/pagayo-storefront/node_modules/@pagayo/schema/dist" ]] \
      && [[ ! -L "$ws/pagayo-storefront/node_modules/@pagayo/schema" ]]; then
      rsync -a --delete "$ws/pagayo-schema/dist/" "$ws/pagayo-storefront/node_modules/@pagayo/schema/dist/"
    fi
  else
    echo "   ✓ @pagayo/schema up-to-date"
  fi

  if [[ -n "$stale_design" ]]; then
    echo "   ▶ build @pagayo/design"
    (cd "$ws/pagayo-design" && npm run build)
    if [[ -d "$ws/pagayo-storefront/node_modules/@pagayo/design/dist" ]]; then
      rsync -a --delete "$ws/pagayo-design/dist/" "$ws/pagayo-storefront/node_modules/@pagayo/design/dist/"
    fi
  else
    echo "   ✓ @pagayo/design up-to-date"
  fi
  echo ""
}

local_dev_start_watchdog() {
  local dir daemon_wd pidfile wd_cmd
  dir="$(local_dev_runtime_dir)"
  daemon_wd="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/local-dev-watchdog.py"
  pidfile="$dir/watchdog.pid"
  mkdir -p "$dir"

  if [[ -f "$pidfile" ]]; then
    local old
    old="$(cat "$pidfile" 2>/dev/null || true)"
    if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then
      echo "   ▶ watchdog al actief (PID $old)"
      return 0
    fi
  fi

  if [[ ! -f "$daemon_wd" ]]; then
    echo "⚠️  Watchdog ontbreekt: $daemon_wd"
    return 0
  fi

  # Outer restart-loop: macOS/sleep can kill the watchdog; bring it back.
  wd_cmd="$(cat <<EOF
set +e
while true; do
  PAGAYO_LOCAL_DEV_RUNTIME=$(printf '%q' "$dir") python3 $(printf '%q' "$daemon_wd") --foreground
  echo "[watchdog-wrapper] exited — restart in 5s"
  sleep 5
done
EOF
)"
  local_dev_write_service_meta "watchdog" "$dir" "$wd_cmd"
  local_dev_spawn_background "watchdog" "$dir" bash -lc "$wd_cmd"
}

local_dev_start_background_services() {
  local ws="$1"
  local sf_cmd vite_cmd api_cmd mkt_cmd

  # Re-free ports after long package builds — Cursor MCP can reclaim 8787 mid-start.
  local_dev_free_ports

  echo "🚀 Services starten op achtergrond (geen Terminal-vensters)…"
  echo "   Logs: $(local_dev_runtime_dir)/"
  echo "   Restart: wrangler/vite/api herstarten automatisch na crash"

  sf_cmd="$(local_dev_storefront_cmd)"
  vite_cmd="$(local_dev_vite_cmd)"
  api_cmd="$(local_dev_api_stack_cmd)"
  mkt_cmd="$(local_dev_marketing_cmd)"

  local_dev_write_service_meta "storefront" "$ws/pagayo-storefront" "$sf_cmd"
  local_dev_spawn_background "storefront" "$ws/pagayo-storefront" bash -lc "$sf_cmd"

  sleep 2

  local_dev_write_service_meta "vite" "$ws/pagayo-storefront" "$vite_cmd"
  local_dev_spawn_background "vite" "$ws/pagayo-storefront" bash -lc "$vite_cmd"
  sleep 1

  local_dev_write_service_meta "api-stack" "$ws/pagayo-api-stack" "$api_cmd"
  local_dev_spawn_background "api-stack" "$ws/pagayo-api-stack" bash -lc "$api_cmd"

  local_dev_write_service_meta "marketing" "$ws/pagayo-marketing" "$mkt_cmd"
  local_dev_spawn_background "marketing" "$ws/pagayo-marketing" bash -lc "$mkt_cmd"

  local_dev_start_watchdog
}

local_dev_stop_background_pids() {
  local dir pidfile pid

  dir="$(local_dev_runtime_dir)"
  [[ -d "$dir" ]] || return 0

  # Watchdog first so it cannot respawn while we tear down.
  if [[ -f "$dir/watchdog.pid" ]]; then
    pid="$(cat "$dir/watchdog.pid" 2>/dev/null)" || true
    if [[ -n "${pid:-}" ]]; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$dir/watchdog.pid"
  fi

  for pidfile in "$dir"/*.pid; do
    [[ -f "$pidfile" ]] || continue
    pid="$(cat "$pidfile" 2>/dev/null)" || continue
    [[ -n "$pid" ]] || continue
    # Kill process group when possible (restart-loop + children).
    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  done
}

local_dev_start_terminal_services() {
  local ws="$1"
  local dir sf_script vite_script api_script mkt_script

  if ! command -v osascript >/dev/null 2>&1; then
    echo "❌ osascript niet beschikbaar — Terminal-start vereist macOS."
    return 1
  fi

  echo "🚀 Services openen in Terminal.app (blijven draaien + auto-restart)..."

  dir="$(local_dev_runtime_dir)"
  mkdir -p "$dir"
  sf_script="$dir/storefront.terminal.sh"
  vite_script="$dir/vite.terminal.sh"
  api_script="$dir/api-stack.terminal.sh"
  mkt_script="$dir/marketing.terminal.sh"

  {
    echo "#!/usr/bin/env bash"
    echo "cd $(printf '%q' "$ws/pagayo-storefront")"
    local_dev_storefront_cmd
  } >"$sf_script"
  {
    echo "#!/usr/bin/env bash"
    echo "cd $(printf '%q' "$ws/pagayo-storefront")"
    local_dev_vite_cmd
  } >"$vite_script"
  {
    echo "#!/usr/bin/env bash"
    echo "cd $(printf '%q' "$ws/pagayo-api-stack")"
    local_dev_api_stack_cmd
  } >"$api_script"
  {
    echo "#!/usr/bin/env bash"
    echo "cd $(printf '%q' "$ws/pagayo-marketing")"
    local_dev_marketing_cmd
  } >"$mkt_script"
  chmod +x "$sf_script" "$vite_script" "$api_script" "$mkt_script"

  local_dev_write_service_meta "storefront" "$ws/pagayo-storefront" "$(local_dev_storefront_cmd)"
  local_dev_write_service_meta "vite" "$ws/pagayo-storefront" "$(local_dev_vite_cmd)"
  local_dev_write_service_meta "api-stack" "$ws/pagayo-api-stack" "$(local_dev_api_stack_cmd)"
  local_dev_write_service_meta "marketing" "$ws/pagayo-marketing" "$(local_dev_marketing_cmd)"

  osascript -e "tell application \"Terminal\"
    do script \"bash $(printf '%q' "$sf_script")\"
end tell"
  sleep 2
  osascript -e "tell application \"Terminal\"
    do script \"bash $(printf '%q' "$vite_script")\"
end tell"
  sleep 2
  osascript -e "tell application \"Terminal\"
    do script \"bash $(printf '%q' "$api_script")\"
end tell"
  osascript -e "tell application \"Terminal\"
    do script \"bash $(printf '%q' "$mkt_script")\"
end tell"

  local_dev_start_watchdog
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
