#!/usr/bin/env node
/**
 * CI failure backfill CLI
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  buildClusters,
  computeAlerts,
  runMining,
  writeStats,
} from "./backfill-lib.mjs";
import { loadCatalog } from "./lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_RUNTIME_REPOS = [
  "Pagayo/pagayo-storefront",
  "Pagayo/pagayo-api-stack",
  "Pagayo/pagayo-edge",
  "Pagayo/pagayo-workflows",
  "Pagayo/pagayo-maintenance",
  "Pagayo/pagayo-marketing",
];

let repos = [];
let days = 90;
let metadataOnly = false;
let phase = "A";

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === "--repo") {
    repos.push(process.argv[++i]);
  } else if (arg === "--days") {
    days = Number(process.argv[++i]);
  } else if (arg === "--metadata-only") {
    metadataOnly = true;
  } else if (arg === "--phase") {
    phase = process.argv[++i];
  } else if (arg === "--help") {
    console.log(`Usage: backfill-cli.mjs [--repo Pagayo/...] [--days 90] [--metadata-only] [--phase A|B|C]`);
    process.exit(0);
  }
}

if (repos.length === 0) {
  if (phase === "A") {
    repos = ["Pagayo/pagayo-storefront"];
  } else if (phase === "C") {
    repos = DEFAULT_RUNTIME_REPOS;
  } else {
    repos = DEFAULT_RUNTIME_REPOS;
  }
}

import { execFileSync } from "child_process";
try {
  execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
} catch {
  console.error("backfill: gh CLI not authenticated — run gh auth login");
  process.exit(2);
}

console.log(`backfill: repos=${repos.join(", ")} days=${days} metadataOnly=${metadataOnly}`);

const { clusters, repoStats } = await runMining({
  repos,
  days,
  metadataOnly,
  sampleLogs: !metadataOnly,
  maxLogSamples: metadataOnly ? 0 : 5,
});

const catalog = loadCatalog();
const matchedCount = clusters.filter((c) => c.catalogId).length;
const totalFailures = Object.values(repoStats).reduce((s, r) => s + r.failures, 0);

const stats = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: metadataOnly ? "backfill-metadata" : "backfill",
  windowDays: days,
  repos: repoStats,
  clusters: clusters.slice(0, 50).map((c) => ({
    fingerprint: c.fingerprint,
    count: c.count,
    workflowName: c.workflowName,
    jobName: c.jobName,
    catalogId: c.catalogId ?? null,
    repo: c.repo,
    sampleRunIds: c.sampleRunIds,
  })),
  alerts: computeAlerts(clusters.slice(0, 50)),
  summary: {
    totalFailureRuns: totalFailures,
    topClusters: clusters.length,
    catalogMatchedClusters: matchedCount,
    catalogEntries: catalog.entries.length,
    matchRatePct:
      clusters.length > 0
        ? Math.round((matchedCount / Math.min(clusters.length, 50)) * 100)
        : 0,
  },
};

writeStats(stats);

const reportPath = join(__dirname, "backfill-report.md");
const lines = [
  "# CI Failure Backfill Report",
  "",
  `Generated: ${stats.generatedAt}`,
  `Window: ${days} days`,
  `Repos: ${repos.join(", ")}`,
  "",
  "## Summary",
  "",
  `- Failure runs scanned: **${totalFailures}**`,
  `- Top clusters: **${clusters.length}** (report shows top 50)`,
  `- Clusters with catalog match: **${matchedCount}**`,
  `- Match rate (top 50): **${stats.summary.matchRatePct}%**`,
  "",
];

if (stats.alerts.length > 0) {
  lines.push("## ACTION_REQUIRED", "");
  for (const a of stats.alerts) {
    lines.push(`- ${a}`);
  }
  lines.push("");
}

lines.push("## Top 20 clusters", "", "| Count | Repo | Workflow | Job | Catalog | Fingerprint |", "|------:|------|----------|-----|---------|-------------|");

for (const c of clusters.slice(0, 20)) {
  const fp = c.fingerprint.replace(/\|/g, "/").slice(0, 60);
  lines.push(
    `| ${c.count} | ${c.repo ?? ""} | ${c.workflowName ?? ""} | ${c.jobName ?? ""} | ${c.catalogId ?? "—"} | ${fp} |`,
  );
}

lines.push("", "## Proposed catalog additions", "");
const unmatched = clusters.filter((c) => !c.catalogId && c.count >= 3).slice(0, 10);
if (unmatched.length === 0) {
  lines.push("_No high-frequency unmatched clusters (threshold ≥3)._");
} else {
  for (const c of unmatched) {
    lines.push(`- **${c.count}×** ${c.repo} / ${c.workflowName} / ${c.jobName ?? "—"}: \`${c.fingerprint.slice(0, 100)}\``);
  }
}

writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf-8");
console.log(`backfill: wrote ${join(__dirname, "stats.json")}`);
console.log(`backfill: wrote ${reportPath}`);
console.log(`backfill: match rate ${stats.summary.matchRatePct}% on top clusters`);
