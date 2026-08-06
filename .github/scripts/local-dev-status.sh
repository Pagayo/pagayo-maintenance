#!/usr/bin/env bash
# Pagayo — status lokale dev-stack (poorten + health + achtergrond-PIDs + watchdog)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=local-dev-lib.sh
source "$SCRIPT_DIR/local-dev-lib.sh"

WS="$(local_dev_resolve_workspace "$SCRIPT_DIR")"
RUNTIME="$(local_dev_runtime_dir)"

echo "Pagayo local dev — status"
echo "Workspace: $WS"
echo ""

if [[ -d "$RUNTIME" ]] && compgen -G "$RUNTIME/*.pid" >/dev/null; then
  echo "Achtergrond-processen ($RUNTIME):"
  for pidfile in "$RUNTIME"/*.pid; do
    [[ -f "$pidfile" ]] || continue
    name="$(basename "$pidfile" .pid)"
    pid="$(cat "$pidfile" 2>/dev/null)" || pid="?"
    if [[ -n "$pid" && "$pid" != "?" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "  $name: PID $pid (actief)"
    else
      echo "  $name: PID $pid (niet actief)"
    fi
  done
  echo ""
fi

echo "Processen (wrangler/vite/serve/astro):"
pgrep -fl "wrangler dev|serve public|/vite|astro dev" 2>/dev/null | head -10 || echo "  (geen matches)"
echo ""

echo "Poorten + health:"
check_port() {
  local port="$1"
  local url="$2"
  local pid code mark
  pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1)" || true
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$url" 2>/dev/null || echo 000)"
  if [[ -n "$pid" && "$code" != "000" ]]; then
    mark="✅"
  elif [[ -n "$pid" ]]; then
    mark="⚠️  pid maar geen health"
  else
    mark="❌"
  fi
  echo "  $port: ${pid:-vrij}  HTTP $code  $mark"
}

check_port 3000 "http://demo.localhost:3000/"
check_port 5173 "http://localhost:5173/assets/"
check_port 5500 "http://localhost:5500/design/dist/fresh/webshop.css"
check_port 8787 "http://localhost:8787/"
check_port 4321 "http://localhost:4321/"
echo ""

if [[ -f "$RUNTIME/storefront.pid" ]]; then
  sf_pid="$(cat "$RUNTIME/storefront.pid" 2>/dev/null || true)"
  if [[ -n "$sf_pid" ]] && kill -0 "$sf_pid" 2>/dev/null; then
    if ! lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
      echo "⚠️  Zombie: storefront-PID leeft, poort 3000 vrij — watchdog zou moeten herstarten."
      echo ""
    fi
  fi
fi

local_dev_wait_for_health 5 || true
