#!/usr/bin/env python3
"""Health watchdog for Pagayo local-dev.

Keeps the stack up when Wrangler/Vite die after hot-reload crashes or mid-build
package races. Survives Cursor/shell exit (double-fork).

Checks every INTERVAL_SEC:
  - If a service PID is dead → respawn from its .cmd file
  - If PID is alive but health URL fails FAIL_THRESHOLD times → kill PID so the
    service restart-loop (or next respawn) recovers a zombie parent
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

RUNTIME = Path(os.environ.get("PAGAYO_LOCAL_DEV_RUNTIME", "/tmp/pagayo-local-dev"))
INTERVAL_SEC = int(os.environ.get("PAGAYO_LOCAL_DEV_WATCHDOG_INTERVAL", "8"))
FAIL_THRESHOLD = int(os.environ.get("PAGAYO_LOCAL_DEV_WATCHDOG_FAILS", "2"))
DAEMON = Path(__file__).with_name("local-dev-daemon.py")

# name → health URL
SERVICES: dict[str, str] = {
    "storefront": "http://demo.localhost:3000/",
    "vite": "http://localhost:5173/assets/",
    "api-stack": "http://localhost:8787/",
    "marketing": "http://localhost:4321/",
}

# Cursor mcp-process often steals 8787 and answers 404 — treat as unhealthy.
API_PORT = 8787


def log(msg: str) -> None:
    stamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[watchdog {stamp}] {msg}\n"
    try:
        with open(RUNTIME / "watchdog.log", "a", encoding="utf-8") as handle:
            handle.write(line)
    except OSError:
        pass
    sys.stderr.write(line)
    sys.stderr.flush()


def read_pid(name: str) -> int | None:
    path = RUNTIME / f"{name}.pid"
    try:
        text = path.read_text(encoding="utf-8").strip()
        return int(text) if text else None
    except (OSError, ValueError):
        return None


def pid_alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def health_ok(name: str, url: str) -> bool:
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            status = getattr(resp, "status", 200)
            if name == "api-stack":
                body = resp.read(512).decode("utf-8", errors="ignore")
                # Real api-stack root is JSON operational; Cursor MCP returns plain 404.
                return status == 200 and ("operational" in body or '"success":true' in body.replace(" ", ""))
            if name == "storefront":
                return status == 200
            if name == "vite":
                return status == 200
            return 200 <= status < 500
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def free_port_intruders(port: int) -> None:
    """Kill non-workerd listeners on port (e.g. Cursor mcp-process on 8787)."""
    try:
        out = subprocess.check_output(
            ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        return
    for pid_s in out.split():
        try:
            pid = int(pid_s.strip())
        except ValueError:
            continue
        try:
            comm = subprocess.check_output(["ps", "-p", str(pid), "-o", "comm="], text=True).strip()
        except (subprocess.CalledProcessError, OSError):
            comm = ""
        # Never kill the main Cursor app binary — only helpers / strangers.
        if comm == "Cursor":
            continue
        if "workerd" in comm or "wrangler" in comm:
            continue
        log(f"port {port}: freeing intruder PID {pid} ({comm or '?'})")
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            continue
        time.sleep(0.5)
        if pid_alive(pid):
            try:
                os.kill(pid, signal.SIGKILL)
            except OSError:
                pass


def kill_tree(pid: int) -> None:
    try:
        os.killpg(pid, signal.SIGTERM)
    except OSError:
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            return
    time.sleep(2)
    if pid_alive(pid):
        try:
            os.killpg(pid, signal.SIGKILL)
        except OSError:
            try:
                os.kill(pid, signal.SIGKILL)
            except OSError:
                pass


def respawn(name: str) -> None:
    meta = RUNTIME / f"{name}.meta"
    cmdfile = RUNTIME / f"{name}.cmd"
    if not meta.is_file() or not cmdfile.is_file():
        log(f"{name}: cannot respawn — missing meta/cmd")
        return
    if not DAEMON.is_file():
        log(f"{name}: cannot respawn — daemon missing: {DAEMON}")
        return

    workdir = ""
    for line in meta.read_text(encoding="utf-8").splitlines():
        if line.startswith("workdir="):
            workdir = line[len("workdir=") :]
            break
    if not workdir:
        log(f"{name}: cannot respawn — no workdir in meta")
        return

    cmd = cmdfile.read_text(encoding="utf-8").strip()
    if not cmd:
        log(f"{name}: cannot respawn — empty cmd")
        return

    if name == "api-stack":
        free_port_intruders(API_PORT)

    log_path = str(RUNTIME / f"{name}.log")
    pidfile = str(RUNTIME / f"{name}.pid")
    log(f"{name}: respawning…")
    # Re-enter via daemon: workdir log pidfile bash -lc '<cmd>'
    subprocess.Popen(
        [sys.executable, str(DAEMON), workdir, log_path, pidfile, "bash", "-lc", cmd],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def double_fork() -> None:
    if os.fork() > 0:
        sys.exit(0)
    os.setsid()
    if os.fork() > 0:
        sys.exit(0)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    (RUNTIME / "watchdog.pid").write_text(str(os.getpid()), encoding="utf-8")


def main() -> None:
    # --foreground: run in-process (for restart-loop wrapper). Default: double-fork daemon.
    if "--foreground" not in sys.argv:
        double_fork()
    else:
        RUNTIME.mkdir(parents=True, exist_ok=True)

    fails: dict[str, int] = {name: 0 for name in SERVICES}
    log(f"started (interval={INTERVAL_SEC}s fail_threshold={FAIL_THRESHOLD})")

    while True:
        for name, url in SERVICES.items():
            pid = read_pid(name)
            alive = pid_alive(pid)
            ok = health_ok(name, url)

            if ok:
                fails[name] = 0
                continue

            fails[name] += 1
            log(f"{name}: health FAIL ({fails[name]}/{FAIL_THRESHOLD}) pid={'alive' if alive else 'dead'} url={url}")

            if name == "api-stack" and fails[name] >= 1:
                free_port_intruders(API_PORT)

            if not alive:
                if fails[name] >= 2:
                    respawn(name)
                    fails[name] = 0
                continue

            if fails[name] >= FAIL_THRESHOLD and pid is not None:
                log(f"{name}: zombie (pid {pid} alive, health down) — killing for restart-loop")
                kill_tree(pid)
                time.sleep(1)
                if not pid_alive(pid):
                    respawn(name)
                fails[name] = 0

        time.sleep(INTERVAL_SEC)


if __name__ == "__main__":
    main()
