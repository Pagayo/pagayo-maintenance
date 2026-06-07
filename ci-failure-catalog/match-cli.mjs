#!/usr/bin/env node
/**
 * CLI wrapper for ci-failure-match.sh
 */
import { extractActionableError, loadCatalog, matchCatalog } from "./lib.mjs";

const args = process.argv.slice(2);
let text = "";
let repo = "";
let workflow = "";
let job = "";
let json = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--text") {
    text = args[++i] ?? "";
  } else if (arg === "--repo") {
    repo = args[++i] ?? "";
  } else if (arg === "--workflow") {
    workflow = args[++i] ?? "";
  } else if (arg === "--job") {
    job = args[++i] ?? "";
  } else if (arg === "--json") {
    json = true;
  } else if (arg === "--help" || arg === "-h") {
    console.log("match-cli.mjs --text <text> [--repo] [--workflow] [--job] [--json]");
    process.exit(0);
  }
}

if (!text) {
  console.error("match-cli: --text is required");
  process.exit(2);
}

let catalog;
try {
  catalog = loadCatalog();
} catch (err) {
  console.error(`match-cli: catalog error: ${err instanceof Error ? err.message : err}`);
  process.exit(2);
}

const snippet = extractActionableError(text);
const entry = matchCatalog(text, catalog.entries, { repo, workflow, job })
  ?? matchCatalog(snippet, catalog.entries, { repo, workflow, job });

if (!entry) {
  if (json) {
    console.log(JSON.stringify({ matched: false, snippet }, null, 2));
  } else {
    console.log("ci-failure-match: no catalog match");
    if (snippet) {
      console.log(`  snippet: ${snippet}`);
    }
  }
  process.exit(1);
}

const result = {
  matched: true,
  id: entry.id,
  title: entry.title,
  classification: entry.classification,
  prevention: entry.prevention,
  fix: entry.fix,
  confidence: entry.confidence,
  status: entry.status,
  snippet,
};

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`ci-failure-match: ${entry.id}`);
  console.log(`  title: ${entry.title}`);
  console.log(`  classification: ${entry.classification}`);
  console.log(`  prevention: ${entry.prevention.layer} — ${entry.prevention.ref}`);
  console.log(`  fix: ${entry.fix.summary}`);
  if (entry.fix.playbook) {
    console.log(`  playbook: ${entry.fix.playbook}`);
  }
}

process.exit(0);
