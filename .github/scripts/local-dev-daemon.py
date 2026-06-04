#!/usr/bin/env python3
"""Detach a long-running local dev process (survives Cursor/shell exit)."""
from __future__ import annotations

import os
import sys


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

    with open(log_path, "a", encoding="utf-8", buffering=1) as log:
        os.dup2(log.fileno(), 1)
        os.dup2(log.fileno(), 2)

    os.execvp(cmd[0], cmd)


if __name__ == "__main__":
    main()
