import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./paths.mjs";

const SUBMITTED_STATUS_RE = /^status:\s*submitted\s*$/im;
const DATE_RE = /^date:\s*(\d{4}-\d{2}-\d{2})\s*$/im;

/**
 * @param {string} dir absolute
 * @returns {string[]}
 */
function walkFiles(dir, extension) {
  /** @type {string[]} */
  const results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, extension));
    } else if (entry.name.endsWith(extension)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * @returns {{ ok: boolean, stale: string[] }}
 */
export function checkPromotionQueue(maxAgeDays = 14) {
  const candidatesDir = path.join(
    WORKSPACE_ROOT,
    "pagayo-docs/ai-memory/promotion-candidates",
  );
  /** @type {string[]} */
  const stale = [];
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  for (const filePath of walkFiles(candidatesDir, ".md")) {
    if (path.basename(filePath) === "README.md") {
      continue;
    }
    if (path.basename(filePath) === "TEMPLATE.md") {
      continue;
    }
    const content = fs.readFileSync(filePath, "utf8");
    if (!SUBMITTED_STATUS_RE.test(content)) {
      continue;
    }
    const dateMatch = content.match(DATE_RE);
    if (!dateMatch) {
      stale.push(`${path.relative(WORKSPACE_ROOT, filePath)}: submitted without date field`);
      continue;
    }
    const submittedAt = Date.parse(dateMatch[1]);
    if (Number.isNaN(submittedAt)) {
      stale.push(`${path.relative(WORKSPACE_ROOT, filePath)}: invalid date`);
      continue;
    }
    if (now - submittedAt > maxAgeMs) {
      stale.push(
        `${path.relative(WORKSPACE_ROOT, filePath)}: submitted > ${maxAgeDays} days`,
      );
    }
  }

  return { ok: stale.length === 0, stale };
}

/**
 * Collect paths for legacy lint light scope.
 * @returns {string[]}
 */
export function collectLegacyLintPaths() {
  /** @type {string[]} */
  const files = [];

  const rootAgents = path.join(WORKSPACE_ROOT, "AGENTS.md");
  if (fs.existsSync(rootAgents)) {
    files.push(rootAgents);
  }

  const aiMemoryDir = path.join(WORKSPACE_ROOT, "pagayo-docs/ai-memory");
  files.push(...walkFiles(aiMemoryDir, ".md"));

  const l1 = path.join(WORKSPACE_ROOT, "pagayo-vault/AI-OPERATING-CONTEXT.md");
  if (fs.existsSync(l1)) {
    files.push(l1);
  }

  const cursorRules = path.join(WORKSPACE_ROOT, ".cursor/rules");
  files.push(...walkFiles(cursorRules, ".mdc"));

  for (const entry of fs.readdirSync(WORKSPACE_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (
      entry.name.startsWith(".") ||
      entry.name === "copilot-worktrees" ||
      entry.name === "node_modules" ||
      entry.name.includes("ARCHIVED")
    ) {
      continue;
    }
    const agentsPath = path.join(WORKSPACE_ROOT, entry.name, "AGENTS.md");
    if (fs.existsSync(agentsPath)) {
      files.push(agentsPath);
    }
  }

  return [...new Set(files)];
}

/**
 * Required L1 section markers for agent probe (G9 partial).
 */
export const REQUIRED_L1_MARKERS = [
  "## Mission one-liner",
  "## Product Pillars",
  "## Build Pillars",
  "## Commerce kernel",
  "## Conflict-order",
  "## Deploy policy",
  "## Security rules",
];

/**
 * @param {string} l1Content
 */
export function checkL1GroundingMarkers(l1Content) {
  /** @type {string[]} */
  const missing = [];
  for (const marker of REQUIRED_L1_MARKERS) {
    if (!l1Content.includes(marker)) {
      missing.push(marker);
    }
  }
  return { ok: missing.length === 0, missing };
}
