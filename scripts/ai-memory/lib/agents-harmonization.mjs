import fs from "node:fs";
import path from "node:path";
import { ACTIVE_REPOS, WORKSPACE_ROOT } from "./paths.mjs";

const WHY_PATTERN = /PAGAYO-WHY\.md/i;
const NIVEAU_PATTERN = /PAGAYO-NIVEAU\.md/i;
const README_PRIMARY_RE = /(?:^|\n)\s*1\.\s*`?\.\/?README\.md`?/i;
const READ_README_FIRST_RE = /read\s+README\s+first/i;

/** Repos with documented intentional reading-order exceptions. */
const AGENTS_ORDER_ALLOWLIST = new Set([
  "pagayo-infra/AGENTS.md",
]);

/**
 * @returns {string[]}
 */
export function listActiveAgentsFiles() {
  /** @type {string[]} */
  const files = [];
  const rootAgents = path.join(WORKSPACE_ROOT, "AGENTS.md");
  if (fs.existsSync(rootAgents)) {
    files.push(rootAgents);
  }
  for (const repo of ACTIVE_REPOS) {
    const agentsPath = path.join(WORKSPACE_ROOT, repo, "AGENTS.md");
    if (fs.existsSync(agentsPath)) {
      files.push(agentsPath);
    }
  }
  return files;
}

/**
 * @param {string} content
 * @returns {{ whyIndex: number, niveauIndex: number } | null}
 */
export function parseReadingOrderIndices(content) {
  const leesvolgordeMatch = content.match(
    /##\s+Leesvolgorde[\s\S]*?(?=\n##\s|$)/i,
  );
  if (!leesvolgordeMatch) {
    return null;
  }
  const block = leesvolgordeMatch[0];
  const lines = block.split("\n");
  let whyIndex = -1;
  let niveauIndex = -1;

  for (const line of lines) {
    const numMatch = line.match(/^\s*(\d+)\.\s+/);
    if (!numMatch) {
      continue;
    }
    const index = Number.parseInt(numMatch[1], 10);
    if (WHY_PATTERN.test(line)) {
      whyIndex = index;
    }
    if (NIVEAU_PATTERN.test(line)) {
      niveauIndex = index;
    }
  }

  if (whyIndex === -1 || niveauIndex === -1) {
    return null;
  }
  return { whyIndex, niveauIndex };
}

/**
 * @param {string} agentsPath absolute
 * @returns {{ ok: boolean, issues: string[] }}
 */
export function checkAgentsFile(agentsPath) {
  const relative = path.relative(WORKSPACE_ROOT, agentsPath);
  /** @type {string[]} */
  const issues = [];
  const content = fs.readFileSync(agentsPath, "utf8");

  if (README_PRIMARY_RE.test(content)) {
    issues.push(`${relative}: README used as primary leesvolgorde item 1`);
  }
  if (
    READ_README_FIRST_RE.test(content) &&
    !WHY_PATTERN.test(content.split(READ_README_FIRST_RE)[0] ?? "")
  ) {
    issues.push(`${relative}: "read README first" without WHY/NIVEAU earlier`);
  }

  if (AGENTS_ORDER_ALLOWLIST.has(relative)) {
    return { ok: issues.length === 0, issues };
  }

  const order = parseReadingOrderIndices(content);
  if (order && order.whyIndex > order.niveauIndex) {
    issues.push(
      `${relative}: PAGAYO-WHY.md (item ${order.whyIndex}) must come before PAGAYO-NIVEAU.md (item ${order.niveauIndex})`,
    );
  }

  if (
    !AGENTS_ORDER_ALLOWLIST.has(relative) &&
    NIVEAU_PATTERN.test(content) &&
    !WHY_PATTERN.test(content)
  ) {
    issues.push(`${relative}: references PAGAYO-NIVEAU.md but not PAGAYO-WHY.md`);
  }

  return { ok: issues.length === 0, issues };
}

/**
 * @returns {{ ok: boolean, issues: string[] }}
 */
export function checkAgentsHarmonization() {
  /** @type {string[]} */
  const issues = [];
  for (const agentsPath of listActiveAgentsFiles()) {
    const result = checkAgentsFile(agentsPath);
    issues.push(...result.issues);
  }
  return { ok: issues.length === 0, issues };
}
