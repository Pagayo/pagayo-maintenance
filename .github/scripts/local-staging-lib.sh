#!/usr/bin/env bash
# Local Staging v1 (core) — gedeelde functies. Bron: local-dev-lib.sh, geen marketing/edge/workflows.

# shellcheck disable=SC2034
local_staging_lib_loaded=true

SCRIPT_DIR_LS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=local-dev-lib.sh
source "$SCRIPT_DIR_LS/local-dev-lib.sh"

local_staging_runtime_dir() {
  echo "/tmp/pagayo-local-staging"
}

local_staging_state_file() {
  echo "$(local_staging_runtime_dir)/state.env"
}

local_staging_smoke_result_file() {
  echo "$(local_staging_runtime_dir)/smoke-last.env"
}

local_staging_core_ports() {
  echo "3000 5173 5500 8787 8789"
}

local_staging_require_workspace() {
  local ws="$1"
  local missing=()

  [[ -d "$ws/pagayo-storefront" ]] || missing+=("pagayo-storefront")
  [[ -d "$ws/pagayo-api-stack" ]] || missing+=("pagayo-api-stack")

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "❌ Local Staging core mist: ${missing[*]}"
    return 1
  fi

  if [[ ! -d "$ws/pagayo-solutions" ]]; then
    echo "ℹ️  pagayo-solutions niet gevonden — overgeslagen (optioneel)"
    export LOCAL_STAGING_SOLUTIONS=0
  else
    export LOCAL_STAGING_SOLUTIONS=1
  fi

  return 0
}

local_staging_pid_alive() {
  local pidfile="$1"
  local pid=""

  [[ -f "$pidfile" ]] || return 1
  pid="$(cat "$pidfile" 2>/dev/null)" || return 1
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

local_staging_any_running() {
  local dir pidfile
  dir="$(local_staging_runtime_dir)"
  [[ -d "$dir" ]] || return 1

  for pidfile in "$dir"/*.pid; do
    [[ -f "$pidfile" ]] || continue
    if local_staging_pid_alive "$pidfile"; then
      return 0
    fi
  done
  return 1
}

local_staging_stop_background_pids() {
  local dir pidfile pid name

  dir="$(local_staging_runtime_dir)"
  [[ -d "$dir" ]] || return 0

  for pidfile in "$dir"/*.pid; do
    [[ -f "$pidfile" ]] || continue
    name="$(basename "$pidfile" .pid)"
    pid="$(cat "$pidfile" 2>/dev/null)" || continue
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "   ■ stop $name (PID $pid)"
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  done
}

local_staging_spawn_background() {
  local name="$1"
  local workdir="$2"
  shift 2
  local dir log pidfile daemon

  dir="$(local_staging_runtime_dir)"
  log="$dir/$name.log"
  pidfile="$dir/$name.pid"
  daemon="$SCRIPT_DIR_LS/local-dev-daemon.py"
  mkdir -p "$dir"

  if [[ ! -f "$daemon" ]]; then
    echo "❌ Daemon helper ontbreekt: $daemon"
    return 1
  fi

  python3 "$daemon" "$workdir" "$log" "$pidfile" "$@"
  if [[ -f "$pidfile" ]]; then
    echo "   ▶ $name (PID $(cat "$pidfile"))"
  else
    echo "   ▶ $name (gestart)"
  fi
}

local_staging_check_ports_free() {
  local port pid staging_dir

  staging_dir="$(local_staging_runtime_dir)"
  for port in $(local_staging_core_ports); do
    pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1)" || true
    [[ -n "$pid" ]] || continue

    # Poort bezet door onze eigen staging-PID → ok
    local owned=false
    if [[ -d "$staging_dir" ]]; then
      local pidfile staging_pid
      for pidfile in "$staging_dir"/*.pid; do
        [[ -f "$pidfile" ]] || continue
        staging_pid="$(cat "$pidfile" 2>/dev/null)" || continue
        if [[ "$staging_pid" == "$pid" ]]; then
          owned=true
          break
        fi
      done
    fi

    if [[ "$owned" == false ]]; then
      echo "❌ Poort $port bezet door ander proces (PID $pid)."
      echo "   Stop local-dev of het andere proces vóór Local Staging start."
      return 1
    fi
  done
  return 0
}

local_staging_start_core_services() {
  local ws="$1"

  echo "🚀 Local Staging core — achtergrond (npm-only design)"
  echo "   Logs: $(local_staging_runtime_dir)/"
  echo "   Buiten scope: edge, workflows, queues, marketing"

  export PAGAYO_DESIGN_SOURCE=node_modules

  local_staging_spawn_background "storefront" "$ws/pagayo-storefront" \
    bash -lc "export PAGAYO_DESIGN_SOURCE=node_modules CI=true WRANGLER_SEND_METRICS=false; npm run copy-design && exec npx concurrently --names wrangler,static -c cyan,magenta 'wrangler dev --persist-to ../.wrangler-shared' 'npm run serve:public'"

  sleep 2

  local_staging_spawn_background "vite" "$ws/pagayo-storefront" \
    bash -lc "export PAGAYO_DESIGN_SOURCE=node_modules CI=true WRANGLER_SEND_METRICS=false; npm run dev:client"

  sleep 1
  local_staging_spawn_background "api-stack" "$ws/pagayo-api-stack" npm run dev

  if [[ "${LOCAL_STAGING_SOLUTIONS:-0}" == "1" ]]; then
    local_staging_spawn_background "solutions" "$ws/pagayo-solutions" npm run dev
  fi

  cat >"$(local_staging_state_file)" <<EOF
started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
workspace=$ws
solutions=${LOCAL_STAGING_SOLUTIONS:-0}
design_source=node_modules
tier=core
EOF
}

local_staging_curl_ok() {
  local url="$1"
  curl -sf --max-time 3 "$url" >/dev/null 2>&1
}

local_staging_check_storefront() {
  local_staging_curl_ok "http://demo.localhost:3000/" \
    && local_staging_curl_ok "http://demo.localhost:3000/api/health"
}

local_staging_check_api() {
  local_staging_curl_ok "http://localhost:8787/api/health" \
    || local_staging_curl_ok "http://localhost:8787/"
}

local_staging_check_solutions() {
  if [[ "${LOCAL_STAGING_SOLUTIONS:-0}" != "1" ]]; then
    return 0
  fi
  local_staging_curl_ok "http://localhost:8789/"
}

local_staging_wait_for_health() {
  local max_seconds="${1:-60}"
  local deadline=$((SECONDS + max_seconds))
  echo "⏳ Wachten op core health (max ${max_seconds}s)..."

  while (( SECONDS < deadline )); do
    if local_staging_check_storefront \
      && local_staging_curl_ok "http://localhost:5173/assets/" \
      && local_staging_check_api \
      && local_staging_check_solutions; then
      echo "✅ Local Staging core health OK"
      return 0
    fi
    sleep 2
  done

  echo "❌ Local Staging core health timeout"
  return 1
}

local_staging_data_label() {
  local ws="$1"
  local wrangler_state_dir="$ws/.wrangler-shared/v3/d1"
  if [[ -d "$wrangler_state_dir" ]]; then
    echo "gedeeld (.wrangler-shared) — tenantdata behouden"
  else
    echo "geen lokale D1 state — eerste start maakt data aan"
  fi
}

local_staging_write_smoke_result() {
  local status="$1"
  local detail="$2"
  mkdir -p "$(local_staging_runtime_dir)"
  detail="${detail//[$'\n\r']/; }"
  cat >"$(local_staging_smoke_result_file)" <<EOF
status=$status
at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
detail=$detail
EOF
}

local_staging_read_smoke_label() {
  local file status at detail
  file="$(local_staging_smoke_result_file)"
  if [[ ! -f "$file" ]]; then
    echo "nog niet gedraaid"
    return 0
  fi
  status="$(grep '^status=' "$file" | head -1 | cut -d= -f2-)"
  at="$(grep '^at=' "$file" | head -1 | cut -d= -f2-)"
  detail="$(grep '^detail=' "$file" | head -1 | cut -d= -f2-)"
  if [[ -n "$detail" ]]; then
    echo "${status:-onbekend} (${at:-?}) — $detail"
  else
    echo "${status:-onbekend} (${at:-?})"
  fi
}
