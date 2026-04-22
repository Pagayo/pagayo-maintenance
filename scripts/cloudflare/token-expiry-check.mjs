#!/usr/bin/env node

import { pathToFileURL } from "node:url";

/**
 * Cloudflare API Token Expiry Monitor
 *
 * Usage:
 *   node scripts/cloudflare/token-expiry-check.mjs
 *   node scripts/cloudflare/token-expiry-check.mjs --json
 *   node scripts/cloudflare/token-expiry-check.mjs --dry-run --json
 *   node scripts/cloudflare/token-expiry-check.mjs --warn-days 30,14,7,3,1 --critical-days 3
 */

const VERIFY_URL = "https://api.cloudflare.com/client/v4/user/tokens/verify";
const DEFAULT_WARN_DAYS = [30, 14, 7, 3, 1];
const DEFAULT_CRITICAL_DAYS = 3;
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Exit codes:
 * 0 = OK / NOTICE / WARNING
 * 2 = HIGH
 * 3 = CRITICAL / EMERGENCY
 * 4 = API/config/parsing error
 */
const EXIT_CODES = {
  OK: 0,
  HIGH: 2,
  CRITICAL: 3,
  FAILURE: 4,
};

function parseArgs(argv) {
  const args = {
    json: false,
    dryRun: false,
    warnDays: DEFAULT_WARN_DAYS,
    criticalDays: Number.parseInt(
      process.env.CF_TOKEN_EXPIRY_CRITICAL_DAYS || "",
      10,
    ),
    timeoutMs: Number.parseInt(
      process.env.CF_TOKEN_EXPIRY_TIMEOUT_MS || "",
      10,
    ),
  };

  if (!Number.isFinite(args.criticalDays)) {
    args.criticalDays = DEFAULT_CRITICAL_DAYS;
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    args.timeoutMs = DEFAULT_TIMEOUT_MS;
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--json") {
      args.json = true;
      continue;
    }

    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (arg === "--warn-days") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --warn-days");
      }
      i += 1;
      args.warnDays = parseWarnDays(next);
      continue;
    }

    if (arg === "--critical-days") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --critical-days");
      }
      i += 1;
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error("--critical-days must be a positive integer");
      }
      args.criticalDays = parsed;
      continue;
    }

    if (arg === "--timeout-ms") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --timeout-ms");
      }
      i += 1;
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error("--timeout-ms must be a positive integer");
      }
      args.timeoutMs = parsed;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function parseWarnDays(input) {
  const values = input
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isFinite(entry) && entry >= 0);

  if (values.length === 0) {
    throw new Error("--warn-days must contain at least one integer");
  }

  const uniqueSorted = Array.from(new Set(values)).sort((a, b) => b - a);
  return uniqueSorted;
}

function getTokenFromEnv() {
  return process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
}

function daysUntil(expiryIso, nowDate = new Date()) {
  const expiryDate = new Date(expiryIso);
  const expiryMs = expiryDate.getTime();

  if (!Number.isFinite(expiryMs)) {
    return null;
  }

  const diffMs = expiryMs - nowDate.getTime();
  return Math.ceil(diffMs / 86_400_000);
}

function evaluateSeverity({
  tokenStatus,
  expiresOn,
  daysRemaining,
  criticalDays,
}) {
  if (tokenStatus !== "active") {
    return {
      severity: "critical",
      reason: `token status is ${tokenStatus}`,
      exitCode: EXIT_CODES.CRITICAL,
    };
  }

  if (!expiresOn) {
    return {
      severity: "critical",
      reason: "expires_on is null (non-expiring token policy violation)",
      exitCode: EXIT_CODES.CRITICAL,
    };
  }

  if (!Number.isFinite(daysRemaining)) {
    return {
      severity: "critical",
      reason: "could not parse expires_on",
      exitCode: EXIT_CODES.FAILURE,
    };
  }

  if (daysRemaining < 0) {
    return {
      severity: "emergency",
      reason: `token expired ${Math.abs(daysRemaining)} day(s) ago`,
      exitCode: EXIT_CODES.CRITICAL,
    };
  }

  if (daysRemaining <= 1) {
    return {
      severity: "emergency",
      reason: `token expires in ${daysRemaining} day(s)`,
      exitCode: EXIT_CODES.CRITICAL,
    };
  }

  if (daysRemaining <= criticalDays) {
    return {
      severity: "critical",
      reason: `token expires in ${daysRemaining} day(s)`,
      exitCode: EXIT_CODES.CRITICAL,
    };
  }

  if (daysRemaining <= 7) {
    return {
      severity: "high",
      reason: `token expires in ${daysRemaining} day(s)`,
      exitCode: EXIT_CODES.HIGH,
    };
  }

  if (daysRemaining <= 14) {
    return {
      severity: "warning",
      reason: `token expires in ${daysRemaining} day(s)`,
      exitCode: EXIT_CODES.OK,
    };
  }

  if (daysRemaining <= 30) {
    return {
      severity: "notice",
      reason: `token expires in ${daysRemaining} day(s)`,
      exitCode: EXIT_CODES.OK,
    };
  }

  return {
    severity: "ok",
    reason: `token healthy (${daysRemaining} day(s) remaining)`,
    exitCode: EXIT_CODES.OK,
  };
}

async function verifyToken({ token, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Cloudflare verify response is not valid JSON (HTTP ${response.status})`,
      );
    }

    if (!response.ok) {
      const firstError = data?.errors?.[0]?.message || "unknown API error";
      throw new Error(
        `Cloudflare verify failed (HTTP ${response.status}): ${firstError}`,
      );
    }

    if (!data?.result) {
      throw new Error("Cloudflare verify payload missing result field");
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function formatHuman(result) {
  const lines = [];

  lines.push("Cloudflare API token status");
  lines.push(`- Severity: ${result.severity.toUpperCase()}`);
  lines.push(`- Token status: ${result.tokenStatus}`);
  lines.push(`- Expires on: ${result.expiresOn ?? "null"}`);
  lines.push(`- Days remaining: ${result.daysUntilExpiry ?? "unknown"}`);
  lines.push(`- Reason: ${result.reason}`);

  if (result.severity === "critical" || result.severity === "emergency") {
    lines.push("- Action: rotate token now and verify CI secrets immediately");
  } else if (result.severity === "high") {
    lines.push("- Action: schedule rotation today and verify fallback token");
  } else if (result.severity === "warning" || result.severity === "notice") {
    lines.push("- Action: plan rotation before threshold breach");
  } else {
    lines.push("- Action: no immediate action required");
  }

  return lines.join("\n");
}

function printResult({ json, payload }) {
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(formatHuman(payload));
}

function mapWarnMatches(daysRemaining, warnDays) {
  if (!Number.isFinite(daysRemaining)) {
    return [];
  }

  return warnDays.filter((threshold) => daysRemaining <= threshold);
}

async function main() {
  let args;

  try {
    args = parseArgs(process.argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const payload = {
      success: false,
      checkedAt: new Date().toISOString(),
      severity: "critical",
      error: {
        code: "CLI_ARGS_INVALID",
        message,
      },
    };
    printResult({ json: true, payload });
    process.exit(EXIT_CODES.FAILURE);
  }

  if (args.dryRun) {
    const payload = {
      success: true,
      checkedAt: new Date().toISOString(),
      simulated: true,
      severity: "ok",
      tokenStatus: "active",
      expiresOn: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      daysUntilExpiry: 90,
      reason: "dry run mode",
      matchedThresholds: [],
    };
    printResult({ json: args.json, payload });
    process.exit(EXIT_CODES.OK);
  }

  const token = getTokenFromEnv();

  if (!token) {
    const payload = {
      success: false,
      checkedAt: new Date().toISOString(),
      severity: "critical",
      error: {
        code: "TOKEN_MISSING",
        message: "Set CLOUDFLARE_API_TOKEN or CF_API_TOKEN",
      },
    };
    printResult({ json: args.json, payload });
    process.exit(EXIT_CODES.FAILURE);
  }

  try {
    const verifyData = await verifyToken({ token, timeoutMs: args.timeoutMs });

    const tokenStatus = verifyData.result.status || "unknown";
    const expiresOn = verifyData.result.expires_on ?? null;
    const daysUntilExpiry = expiresOn ? daysUntil(expiresOn) : null;

    const evaluation = evaluateSeverity({
      tokenStatus,
      expiresOn,
      daysRemaining: daysUntilExpiry,
      criticalDays: args.criticalDays,
    });

    const payload = {
      success: true,
      checkedAt: new Date().toISOString(),
      severity: evaluation.severity,
      reason: evaluation.reason,
      tokenStatus,
      expiresOn,
      daysUntilExpiry,
      matchedThresholds: mapWarnMatches(daysUntilExpiry, args.warnDays),
      policy: {
        warnDays: args.warnDays,
        criticalDays: args.criticalDays,
      },
    };

    printResult({ json: args.json, payload });
    process.exit(evaluation.exitCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const payload = {
      success: false,
      checkedAt: new Date().toISOString(),
      severity: "critical",
      error: {
        code: "TOKEN_VERIFY_FAILED",
        message,
      },
    };
    printResult({ json: args.json, payload });
    process.exit(EXIT_CODES.FAILURE);
  }
}

export {
  DEFAULT_WARN_DAYS,
  DEFAULT_CRITICAL_DAYS,
  EXIT_CODES,
  parseWarnDays,
  daysUntil,
  evaluateSeverity,
  mapWarnMatches,
};

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main();
}
