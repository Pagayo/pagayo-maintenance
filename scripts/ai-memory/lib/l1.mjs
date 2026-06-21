import fs from "node:fs";
import path from "node:path";
import {
  DELIVERY_DIR,
  GENERATED_HEADER,
  GENERATED_SOURCE_POINTER,
  L1_PATH,
  MAX_L1_LINES,
} from "./paths.mjs";

/**
 * @returns {string}
 */
export function readL1OrThrow() {
  if (!fs.existsSync(L1_PATH)) {
    throw new Error(`L1 missing: ${L1_PATH}`);
  }
  return fs.readFileSync(L1_PATH, "utf8");
}

/**
 * Count lines excluding trailing empty lines only at EOF.
 * @param {string} content
 */
export function countL1Lines(content) {
  const lines = content.split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines.length;
}

/**
 * @param {string} content
 */
export function assertL1LineBudget(content) {
  const count = countL1Lines(content);
  if (count > MAX_L1_LINES) {
    throw new Error(`L1 exceeds ${MAX_L1_LINES} lines (found ${count})`);
  }
  return count;
}

/**
 * @param {string} l1Content
 * @returns {string}
 */
export function buildMirrorContent(l1Content) {
  const trimmed = l1Content.replace(/\s+$/, "");
  return `${GENERATED_HEADER}\n\n${GENERATED_SOURCE_POINTER}\n\n${trimmed}\n`;
}

/**
 * Extract L1 body from mirror (strip generated header block).
 * @param {string} mirrorContent
 */
export function extractL1FromMirror(mirrorContent) {
  const lines = mirrorContent.split("\n");
  let i = 0;
  if (lines[i]?.trim() === "<!-- GENERATED FILE - DO NOT EDIT MANUALLY -->") {
    i += 1;
  }
  while (i < lines.length && lines[i].trim() === "") {
    i += 1;
  }
  if (
    lines[i]?.trim() === "<!-- source: pagayo-vault/AI-OPERATING-CONTEXT.md -->"
  ) {
    i += 1;
  }
  while (i < lines.length && lines[i].trim() === "") {
    i += 1;
  }
  return lines.slice(i).join("\n").replace(/\s+$/, "");
}

/**
 * Normalize L1 content for comparison (trim trailing whitespace).
 * @param {string} content
 */
export function normalizeL1Content(content) {
  return content.replace(/\s+$/, "");
}

/**
 * Resolve L1 content from vault or delivery mirror fallback (CI).
 * @returns {{ content: string, source: "vault" | "mirror" } | null}
 */
export function resolveL1Content() {
  if (fs.existsSync(L1_PATH)) {
    return { content: fs.readFileSync(L1_PATH, "utf8"), source: "vault" };
  }
  const cloudAgentPath = path.join(DELIVERY_DIR, "cloud-agent-l1-context.md");
  if (fs.existsSync(cloudAgentPath)) {
    const extracted = extractL1FromMirror(
      fs.readFileSync(cloudAgentPath, "utf8"),
    );
    return { content: extracted, source: "mirror" };
  }
  return null;
}

/**
 * @param {string} l1Body markdown L1 body (no generated header)
 */
export function buildCursorRuleContent(l1Body) {
  const trimmed = l1Body.replace(/\s+$/, "");
  return `---
description: Pagayo L1 operational AI context (generated — do not edit manually)
alwaysApply: true
generated: true
---

<!-- GENERATED FILE - DO NOT EDIT MANUALLY -->
<!-- source: pagayo-vault/AI-OPERATING-CONTEXT.md -->

${trimmed}
`;
}
