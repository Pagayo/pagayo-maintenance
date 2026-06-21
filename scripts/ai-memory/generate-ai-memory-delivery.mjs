#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { validateSourceAnchors } from "./lib/anchors.mjs";
import { sha256 } from "./lib/hash.mjs";
import {
  assertL1LineBudget,
  buildCursorRuleContent,
  buildMirrorContent,
  readL1OrThrow,
} from "./lib/l1.mjs";
import {
  CURSOR_RULE_PATH,
  CURSOR_RULE_RELATIVE,
  DELIVERY_DIR,
  DELIVERY_DIR_RELATIVE,
  GENERATOR_RELATIVE,
  L1_RELATIVE,
  MANIFEST_PATH,
  MIRROR_FILES,
} from "./lib/paths.mjs";

function detectManualDrift(mirrorPath, expectedContent, manifestEntry) {
  if (!fs.existsSync(mirrorPath)) {
    return null;
  }
  const existing = fs.readFileSync(mirrorPath, "utf8");
  const existingHash = sha256(existing);
  const expectedHash = sha256(expectedContent);
  if (existingHash === expectedHash) {
    return null;
  }
  if (manifestEntry && manifestEntry.sha256 === existingHash) {
    return null;
  }
  return `Manual drift detected in ${path.basename(mirrorPath)} — regenerate required`;
}

function loadExistingManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return null;
  }
}

function main() {
  /** @type {string[]} */
  const errors = [];

  let l1Content;
  try {
    l1Content = readL1OrThrow();
  } catch (error) {
    console.error(`ai-memory:generate: ${error.message}`);
    process.exit(1);
  }

  try {
    const lineCount = assertL1LineBudget(l1Content);
    console.log(`L1 OK (${lineCount} lines)`);
  } catch (error) {
    console.error(`ai-memory:generate: ${error.message}`);
    process.exit(1);
  }

  const anchorResult = validateSourceAnchors(l1Content);
  if (!anchorResult.ok) {
    for (const err of anchorResult.errors) {
      errors.push(err);
    }
  }

  if (errors.length > 0) {
    console.error("ai-memory:generate: source anchor validation failed:");
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  const sourceSha256 = sha256(l1Content);
  const mirrorContent = buildMirrorContent(l1Content);
  const existingManifest = loadExistingManifest();
  const manifestMirrorMap = new Map(
    (existingManifest?.mirrors ?? []).map((entry) => [entry.path, entry]),
  );

  fs.mkdirSync(DELIVERY_DIR, { recursive: true });

  /** @type {Array<{ path: string, sha256: string }>} */
  const mirrors = [];

  for (const fileName of MIRROR_FILES) {
    const mirrorRelative = `${DELIVERY_DIR_RELATIVE}/${fileName}`;
    const mirrorPath = path.join(DELIVERY_DIR, fileName);
    const drift = detectManualDrift(
      mirrorPath,
      mirrorContent,
      manifestMirrorMap.get(mirrorRelative),
    );
    if (drift) {
      console.error(`ai-memory:generate: ${drift}`);
      process.exit(1);
    }
    fs.writeFileSync(mirrorPath, mirrorContent, "utf8");
    mirrors.push({
      path: mirrorRelative,
      sha256: sha256(mirrorContent),
    });
    console.log(`Wrote ${mirrorRelative}`);
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    source_file: L1_RELATIVE,
    source_sha256: sourceSha256,
    mirrors,
    generated_by: GENERATOR_RELATIVE,
    manual_edit_policy:
      "forbidden — regenerate via npm run ai-memory:generate",
  };

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), MANIFEST_PATH)}`);

  const cursorRuleContent = buildCursorRuleContent(l1Content);
  const cursorDrift = detectManualDrift(CURSOR_RULE_PATH, cursorRuleContent, null);
  if (cursorDrift && fs.existsSync(CURSOR_RULE_PATH)) {
    console.error(`ai-memory:generate: ${cursorDrift}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(CURSOR_RULE_PATH), { recursive: true });
  fs.writeFileSync(CURSOR_RULE_PATH, cursorRuleContent, "utf8");
  console.log(`Wrote ${CURSOR_RULE_RELATIVE}`);

  console.log("ai-memory:generate: OK");
}

main();
