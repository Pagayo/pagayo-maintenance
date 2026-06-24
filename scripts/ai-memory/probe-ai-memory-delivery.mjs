#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { probeAllMirrors } from "./lib/agent-probes.mjs";
import { extractL1FromMirror } from "./lib/l1.mjs";
import { DELIVERY_DIR, MIRROR_FILES, WORKSPACE_ROOT } from "./lib/paths.mjs";

function main() {
  /** @type {Record<string, string>} */
  const mirrorContents = {};
  /** @type {string[]} */
  const missing = [];

  for (const fileName of MIRROR_FILES) {
    const filePath = path.join(DELIVERY_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      missing.push(fileName);
      continue;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    mirrorContents[fileName] = extractL1FromMirror(raw);
  }

  if (missing.length > 0) {
    console.error("ai-memory:probe: missing mirrors:");
    for (const file of missing) {
      console.error(`  - ${file}`);
    }
    process.exit(1);
  }

  const result = probeAllMirrors(mirrorContents);
  if (result.ok) {
    console.log(
      `ai-memory:probe: OK (${MIRROR_FILES.length} mirrors, ${Object.keys(mirrorContents).length} probed)`,
    );
    console.log(`  workspace: ${WORKSPACE_ROOT}`);
    process.exit(0);
  }

  console.error("ai-memory:probe: FAILED");
  for (const detail of result.details) {
    console.error(`  - ${detail}`);
  }
  process.exit(1);
}

main();
