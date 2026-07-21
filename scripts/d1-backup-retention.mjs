#!/usr/bin/env node
/**
 * D1 backup retention helper (Mission 7).
 *
 * Mirrors edge catalog snapshot retention defaults:
 * - scheduled: 30 days
 * - manual: 90 days
 * - minimum floor: 7 days
 *
 * Modes:
 *   --policy              print retention policy JSON
 *   --plan --dir <path>   list local run directories that would be deleted
 *   --apply --dir <path>  delete expired local run directories (requires --confirm)
 *
 * Does not delete R2 objects (operator uses wrangler/R2 lifecycle separately).
 */

import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MINIMUM_RETENTION_DAYS = 7;

const POLICY = {
  scheduledDays: 30,
  manualDays: 90,
  minimumDays: MINIMUM_RETENTION_DAYS,
};

/**
 * @param {string} trigger
 * @returns {number}
 */
function retentionDaysForTrigger(trigger) {
  if (trigger === "scheduled") {
    return Math.max(POLICY.scheduledDays, MINIMUM_RETENTION_DAYS);
  }
  // manual and unknown triggers use the longer manual window
  return Math.max(POLICY.manualDays, MINIMUM_RETENTION_DAYS);
}

/**
 * @param {string} createdAtIsoOrTs  ISO or YYYYMMDDTHHMMSSZ
 * @returns {Date | null}
 */
function parseCreatedAt(createdAtIsoOrTs) {
  if (!createdAtIsoOrTs) return null;
  if (/^\d{8}T\d{6}Z$/.test(createdAtIsoOrTs)) {
    const y = createdAtIsoOrTs.slice(0, 4);
    const m = createdAtIsoOrTs.slice(4, 6);
    const d = createdAtIsoOrTs.slice(6, 8);
    const hh = createdAtIsoOrTs.slice(9, 11);
    const mm = createdAtIsoOrTs.slice(11, 13);
    const ss = createdAtIsoOrTs.slice(13, 15);
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
  }
  const d = new Date(createdAtIsoOrTs);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {{ trigger: string, createdAt: string, now?: Date }} args
 * @returns {{ expired: boolean, retentionDays: number, expiresAt: string | null }}
 */
export function evaluateRetention({ trigger, createdAt, now = new Date() }) {
  const retentionDays = retentionDaysForTrigger(trigger);
  const created = parseCreatedAt(createdAt);
  if (!created) {
    return { expired: false, retentionDays, expiresAt: null };
  }
  const expiresAt = new Date(created.getTime() + retentionDays * MS_PER_DAY);
  return {
    expired: now.getTime() >= expiresAt.getTime(),
    retentionDays,
    expiresAt: expiresAt.toISOString(),
  };
}

function printPolicy() {
  console.log(JSON.stringify({ success: true, policy: POLICY }, null, 2));
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ mode: 'policy' | 'plan' | 'apply' | null, dir: string | null, confirm: boolean }} */
  const out = { mode: null, dir: null, confirm: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--policy") out.mode = "policy";
    else if (a === "--plan") out.mode = "plan";
    else if (a === "--apply") out.mode = "apply";
    else if (a === "--dir") out.dir = argv[++i] ?? null;
    else if (a === "--confirm") out.confirm = true;
  }
  return out;
}

/**
 * @param {string} runsDir
 * @param {Date} now
 */
function planDeletions(runsDir, now) {
  const entries = readdirSync(runsDir, { withFileTypes: true });
  /** @type {Array<Record<string, unknown>>} */
  const candidates = [];

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const runPath = join(runsDir, ent.name);
    const manifestPath = join(runPath, "manifest.json");
    let trigger = "manual";
    let createdAt = "";
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      trigger = typeof manifest.trigger === "string" ? manifest.trigger : "manual";
      createdAt =
        typeof manifest.createdAt === "string"
          ? manifest.createdAt
          : ent.name.replace(/^d1-backup-/, "");
    } catch {
      createdAt = ent.name.replace(/^d1-backup-/, "");
      try {
        createdAt = new Date(statSync(runPath).mtimeMs).toISOString();
      } catch {
        /* keep empty */
      }
    }

    const evalResult = evaluateRetention({ trigger, createdAt, now });
    if (evalResult.expired) {
      candidates.push({
        runDir: runPath,
        trigger,
        createdAt,
        retentionDays: evalResult.retentionDays,
        expiresAt: evalResult.expiresAt,
      });
    }
  }

  return candidates;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.mode) {
    console.error(
      "Usage: node d1-backup-retention.mjs --policy | --plan --dir <runsDir> | --apply --dir <runsDir> --confirm",
    );
    process.exit(1);
  }

  if (args.mode === "policy") {
    printPolicy();
    return;
  }

  if (!args.dir) {
    console.error("--dir is required for --plan/--apply");
    process.exit(1);
  }

  const now = new Date();
  const candidates = planDeletions(args.dir, now);

  if (args.mode === "plan") {
    console.log(
      JSON.stringify(
        { success: true, mode: "plan", count: candidates.length, candidates },
        null,
        2,
      ),
    );
    return;
  }

  if (!args.confirm) {
    console.error("--apply requires --confirm");
    process.exit(1);
  }

  for (const c of candidates) {
    rmSync(String(c.runDir), { recursive: true, force: true });
  }

  console.log(
    JSON.stringify(
      { success: true, mode: "apply", deleted: candidates.length, candidates },
      null,
      2,
    ),
  );
}

const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith("d1-backup-retention.mjs") ||
    process.argv[1].endsWith("d1-backup-retention.js"));

if (isDirect) {
  main();
}
