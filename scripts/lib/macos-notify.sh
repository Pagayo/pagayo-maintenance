#!/usr/bin/env bash
# macOS native notification helper for Pagayo maintenance scripts.
# Usage: source this file, then call pagayo_macos_notify "Title" "Message body"

pagayo_macos_notify() {
  local title="${1:-Pagayo}"
  local message="${2:-}"

  if [[ "$(uname -s)" != "Darwin" ]]; then
    return 0
  fi

  if [[ -z "$message" ]]; then
    return 0
  fi

  # Escape backslashes and double quotes for AppleScript string literals.
  local escaped_title escaped_message
  escaped_title="${title//\\/\\\\}"
  escaped_title="${escaped_title//\"/\\\"}"
  escaped_message="${message//\\/\\\\}"
  escaped_message="${escaped_message//\"/\\\"}"

  osascript -e "display notification \"${escaped_message}\" with title \"${escaped_title}\"" \
    >/dev/null 2>&1 || true
}

pagayo_macos_notify_failure() {
  local category="$1"
  local detail="$2"
  local log_path="${3:-}"

  local body="$category"
  if [[ -n "$detail" ]]; then
    body="${body}: ${detail}"
  fi
  if [[ -n "$log_path" ]]; then
    body="${body} — zie ${log_path}"
  fi

  pagayo_macos_notify "Pagayo regressie" "$body"
}

pagayo_macos_notify_success() {
  if [[ "${PAGAYO_NOTIFY_ON_SUCCESS:-0}" == "1" ]]; then
    pagayo_macos_notify "Pagayo regressie" "Alle vitale lokale checks groen."
  fi
}
