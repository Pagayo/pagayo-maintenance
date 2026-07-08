#!/usr/bin/env python3
"""Detach and supervise a long-running local dev process (survives Cursor/shell exit)."""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time

INITIAL_BACKOFF_SECONDS = 2
MAX_BACKOFF_SECONDS = 30


def main() -> None:
    if len(sys.argv) < 5:
        print("usage: local-dev-daemon.py WORKDIR LOG PIDFILE CMD...", file=sys.stderr)
        sys.exit(2)

    workdir = sys.argv[1]
    log_path = sys.argv[2]
    pidfile = sys.argv[3]
    cmd = sys.argv[4:]

    if os.fork() > 0:
        sys.exit(0)

    os.setsid()

    if os.fork() > 0:
        sys.exit(0)

    with open(pidfile, "w", encoding="utf-8") as handle:
        handle.write(str(os.getpid()))

    os.chdir(workdir)
    os.environ["CI"] = "true"
    os.environ["WRANGLER_SEND_METRICS"] = "false"

    shutting_down = False
    child: subprocess.Popen[str] | None = None

    def log_line(message: str) -> None:
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")
        with open(log_path, "a", encoding="utf-8", buffering=1) as log:
            log.write(f"[daemon {timestamp}] {message}\n")

    def terminate_child() -> None:
        nonlocal child
        if child is None or child.poll() is not None:
            return
        try:
            os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError:
            return
        try:
            child.wait(timeout=8)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            child.wait(timeout=3)

    def handle_shutdown(signum: int, _frame: object) -> None:
        nonlocal shutting_down
        shutting_down = True
        log_line(f"shutdown signal {signum} — stopping supervised process")
        terminate_child()

    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)

    backoff = INITIAL_BACKOFF_SECONDS

    with open(log_path, "a", encoding="utf-8", buffering=1) as log:
        while not shutting_down:
            log.write(f"[daemon] starting: {' '.join(cmd)}\n")
            log.flush()

            child = subprocess.Popen(
                cmd,
                stdout=log,
                stderr=subprocess.STDOUT,
                cwd=workdir,
                env=os.environ.copy(),
                start_new_session=True,
            )

            exit_code = child.wait()
            child = None

            if shutting_down:
                break

            if exit_code == 0:
                log.write("[daemon] process exited cleanly — stopping supervisor\n")
                break

            log.write(
                f"[daemon] process exited with code {exit_code} — "
                f"restart in {backoff}s\n"
            )
            log.flush()
            time.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)


if __name__ == "__main__":
    main()
