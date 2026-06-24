#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { probeAllMirrors } from "./lib/agent-probes.mjs";
import { validateSourceAnchors } from "./lib/anchors.mjs";
import { checkAgentsHarmonization } from "./lib/agents-harmonization.mjs";
import { lintForbiddenStackFiles } from "./lib/forbidden-stack.mjs";
import { sha256 } from "./lib/hash.mjs";
import {
  countL1Lines,
  extractL1FromMirror,
  normalizeL1Content,
  resolveL1Content,
} from "./lib/l1.mjs";
import {
  CURSOR_RULE_PATH,
  DELIVERY_DIR,
  DELIVERY_DIR_RELATIVE,
  GENERATED_HEADER,
  IS_CI_MODE,
  L1_PATH,
  L1_RELATIVE,
  MANIFEST_PATH,
  MANIFEST_RELATIVE,
  MAX_L1_LINES,
  MIRROR_FILES,
  WORKSPACE_ROOT,
} from "./lib/paths.mjs";
import {
  checkPromotionQueue,
  collectLegacyLintPaths,
} from "./lib/verify-helpers.mjs";

/** @typedef {{ id: string, name: string, ok: boolean, details: string[] }} CheckResult */

/** @type {CheckResult[]} */
const results = [];

/**
 * @param {string} id
 * @param {string} name
 * @param {() => { ok: boolean, details?: string[] }} fn
 */
function runCheck(id, name, fn) {
  const outcome = fn();
  const check = {
    id,
    name,
    ok: outcome.ok,
    details: outcome.details ?? [],
  };
  results.push(check);
  const icon = check.ok ? "PASS" : "FAIL";
  console.log(`[${icon}] ${id} ${name}`);
  for (const detail of check.details) {
    console.log(`       ${detail}`);
  }
}

const CONFLICT_ORDER_SNIPPET =
  "Code + tests > STACK-MANIFEST.md > PAGAYO-WHY.md > ADR";

const LOCAL_ONLY_BOUNDARY_SNIPPET = "## Local-Only Knowledge Boundary";
const LOCAL_ONLY_PLANNING_RULE_SNIPPET =
  "Planning rule: every plan that references local-only sources";

function main() {
  const resolved = resolveL1Content();
  const l1Exists = resolved !== null;
  const l1Content = resolved?.content ?? "";
  const l1Source = resolved?.source ?? "none";
  const vaultL1Exists = fs.existsSync(L1_PATH);

  if (IS_CI_MODE) {
    console.log(`ai-memory:verify: CI mode (workspace=${WORKSPACE_ROOT})`);
  }

  runCheck("V1", "L1 exists", () => {
    if (!l1Exists) {
      return { ok: false, details: [`Missing ${L1_RELATIVE} and delivery mirrors`] };
    }
    const details =
      l1Source === "mirror"
        ? ["L1 resolved from delivery mirror (vault absent — CI/local fallback)"]
        : [];
    return { ok: true, details };
  });

  runCheck("V2", "L1 line budget", () => {
    if (!l1Exists) {
      return { ok: false, details: ["L1 missing"] };
    }
    const count = countL1Lines(l1Content);
    if (count > MAX_L1_LINES) {
      return {
        ok: false,
        details: [`${count} lines (max ${MAX_L1_LINES})`],
      };
    }
    return { ok: true, details: [`${count} lines`] };
  });

  runCheck("V3", "Source anchors", () => {
    if (!l1Exists) {
      return { ok: false, details: ["L1 missing"] };
    }
    if (!vaultL1Exists && IS_CI_MODE) {
      return {
        ok: true,
        details: ["skipped in CI — requires vault L1 file on disk"],
      };
    }
    if (!vaultL1Exists) {
      return {
        ok: false,
        details: ["source anchor validation requires pagayo-vault/AI-OPERATING-CONTEXT.md"],
      };
    }
    const result = validateSourceAnchors(l1Content);
    return { ok: result.ok, details: result.errors };
  });

  runCheck("V4", "Delivery mirrors exist", () => {
    /** @type {string[]} */
    const missing = [];
    if (!fs.existsSync(MANIFEST_PATH)) {
      missing.push(MANIFEST_RELATIVE);
    }
    for (const file of MIRROR_FILES) {
      const p = path.join(DELIVERY_DIR, file);
      if (!fs.existsSync(p)) {
        missing.push(`${DELIVERY_DIR_RELATIVE}/${file}`);
      }
    }
    return { ok: missing.length === 0, details: missing };
  });

  runCheck("V5", "MANIFEST hashes", () => {
    if (!l1Exists || !fs.existsSync(MANIFEST_PATH)) {
      return { ok: false, details: ["L1 or MANIFEST missing"] };
    }
    /** @type {string[]} */
    const details = [];
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    } catch (error) {
      return { ok: false, details: [`Invalid MANIFEST.json: ${error.message}`] };
    }
    const expectedSource = sha256(l1Content);
    if (manifest.source_sha256 !== expectedSource) {
      details.push("source_sha256 mismatch — run ai-memory:generate");
    }
    for (const entry of manifest.mirrors ?? []) {
      const mirrorPath = path.join(WORKSPACE_ROOT, entry.path);
      if (!fs.existsSync(mirrorPath)) {
        details.push(`Missing mirror: ${entry.path}`);
        continue;
      }
      const hash = sha256(fs.readFileSync(mirrorPath, "utf8"));
      if (hash !== entry.sha256) {
        details.push(`Mirror hash mismatch: ${entry.path}`);
      }
    }
    return { ok: details.length === 0, details };
  });

  runCheck("V6", "Generated header in mirrors", () => {
    /** @type {string[]} */
    const details = [];
    for (const file of MIRROR_FILES) {
      const p = path.join(DELIVERY_DIR, file);
      if (!fs.existsSync(p)) {
        continue;
      }
      const content = fs.readFileSync(p, "utf8");
      if (!content.startsWith(GENERATED_HEADER)) {
        details.push(`${file}: missing generated header`);
      }
    }
    return { ok: details.length === 0, details };
  });

  runCheck("V7", "No manual mirror drift", () => {
    if (!l1Exists) {
      return { ok: false, details: ["L1 missing"] };
    }
    const expectedL1 = normalizeL1Content(l1Content);
    /** @type {string[]} */
    const details = [];
    for (const file of MIRROR_FILES) {
      const p = path.join(DELIVERY_DIR, file);
      if (!fs.existsSync(p)) {
        continue;
      }
      const extracted = normalizeL1Content(
        extractL1FromMirror(fs.readFileSync(p, "utf8")),
      );
      if (extracted !== expectedL1) {
        details.push(`${file}: body differs from L1`);
      }
    }
    return { ok: details.length === 0, details };
  });

  runCheck("V8", "Conflict-order present", () => {
    if (!l1Exists) {
      return { ok: false, details: ["L1 missing"] };
    }
    const ok = l1Content.includes(CONFLICT_ORDER_SNIPPET);
    return {
      ok,
      details: ok ? [] : ["Conflict-order snippet not found in L1"],
    };
  });

  runCheck("V14", "Local-only knowledge boundary present", () => {
    if (!l1Exists) {
      return { ok: false, details: ["L1 missing"] };
    }
    const hasSection = l1Content.includes(LOCAL_ONLY_BOUNDARY_SNIPPET);
    const hasPlanningRule = l1Content.includes(LOCAL_ONLY_PLANNING_RULE_SNIPPET);
    if (hasSection && hasPlanningRule) {
      return { ok: true };
    }
    /** @type {string[]} */
    const details = [];
    if (!hasSection) {
      details.push("Local-Only Knowledge Boundary section not found in L1");
    }
    if (!hasPlanningRule) {
      details.push("Local-only planning rule not found in L1");
    }
    return { ok: false, details };
  });

  runCheck("V9", "Forbidden stack lint (L1 + delivery)", () => {
    /** @type {string[]} */
    const paths = [];
    if (vaultL1Exists) {
      paths.push(L1_PATH);
    }
    for (const file of MIRROR_FILES) {
      paths.push(path.join(DELIVERY_DIR, file));
    }
    const result = lintForbiddenStackFiles(paths, (p) =>
      path.relative(WORKSPACE_ROOT, p),
    );
    return { ok: result.ok, details: result.violations };
  });

  runCheck("V10", "AGENTS harmonization", () => {
    if (IS_CI_MODE) {
      return {
        ok: true,
        details: ["skipped in CI — requires full workspace checkout"],
      };
    }
    const result = checkAgentsHarmonization();
    return { ok: result.ok, details: result.issues };
  });

  runCheck("V11", "Legacy lint light", () => {
    if (IS_CI_MODE) {
      const files = collectLegacyLintPaths().filter((filePath) =>
        filePath.includes(`${path.sep}pagayo-docs${path.sep}ai-memory${path.sep}`),
      );
      const result = lintForbiddenStackFiles(files, (p) =>
        path.relative(WORKSPACE_ROOT, p),
      );
      return { ok: result.ok, details: result.violations };
    }
    const files = collectLegacyLintPaths();
    const result = lintForbiddenStackFiles(files, (p) =>
      path.relative(WORKSPACE_ROOT, p),
    );
    return { ok: result.ok, details: result.violations };
  });

  runCheck("V12", "Dual-agent parity", () => {
    /** @type {string[]} */
    const details = [];
    const bodies = MIRROR_FILES.map((file) => {
      const p = path.join(DELIVERY_DIR, file);
      if (!fs.existsSync(p)) {
        return null;
      }
      return fs.readFileSync(p, "utf8");
    });
    if (bodies.some((b) => b === null)) {
      return { ok: false, details: ["Missing mirror files"] };
    }
    const first = bodies[0];
    for (let i = 1; i < bodies.length; i++) {
      if (bodies[i] !== first) {
        details.push(`${MIRROR_FILES[i]} differs from ${MIRROR_FILES[0]}`);
      }
    }
    return { ok: details.length === 0, details };
  });

  runCheck("V13", "Promotion queue clean", () => {
    const result = checkPromotionQueue(14);
    return { ok: result.ok, details: result.stale };
  });

  runCheck("G9", "Agent delivery probes", () => {
    /** @type {Record<string, string>} */
    const mirrorBodies = {};
    for (const file of MIRROR_FILES) {
      const p = path.join(DELIVERY_DIR, file);
      if (!fs.existsSync(p)) {
        return { ok: false, details: [`Missing ${file}`] };
      }
      mirrorBodies[file] = extractL1FromMirror(fs.readFileSync(p, "utf8"));
    }
    const result = probeAllMirrors(mirrorBodies);
    return { ok: result.ok, details: result.details };
  });

  runCheck("G9b", "Cursor rule installed", () => {
    if (IS_CI_MODE) {
      return {
        ok: true,
        details: ["skipped in CI — cursor rule is workspace-local install target"],
      };
    }
    if (!fs.existsSync(CURSOR_RULE_PATH)) {
      return {
        ok: false,
        details: [`Missing ${path.relative(WORKSPACE_ROOT, CURSOR_RULE_PATH)} — run ai-memory:generate`],
      };
    }
    const content = fs.readFileSync(CURSOR_RULE_PATH, "utf8");
    if (!content.includes("generated: true")) {
      return { ok: false, details: ["Cursor rule missing generated: true frontmatter"] };
    }
    return { ok: true };
  });

  const failed = results.filter((r) => !r.ok);
  console.log("");
  console.log(
    `ai-memory:verify: ${results.length - failed.length}/${results.length} checks passed`,
  );

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
