#!/usr/bin/env bash
# Pagayo — status lokale dev-stack (poorten + health + achtergrond-PIDs)

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

echo "Poorten:"
for PORT in 3000 5173 5500 8787 4321; do
  pid="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)" || true
  echo "  $PORT: ${pid:-vrij}"
done
echo ""

local_dev_wait_for_health 5 || true
