#!/usr/bin/env node
/**
 * Weekly CI failure diff — last 7 days vs previous stats.json
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { computeAlerts, runMining, writeStats } from "./backfill-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNTIME_REPOS = [
  "Pagayo/pagayo-storefront",
  "Pagayo/pagayo-api-stack",
  "Pagayo/pagayo-edge",
  "Pagayo/pagayo-workflows",
  "Pagayo/pagayo-maintenance",
  "Pagayo/pagayo-marketing",
];

try {
  execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
} catch {
  console.error("ci-failure-weekly: gh CLI not authenticated");
  process.exit(2);
}

const statsPath = join(__dirname, "stats.json");
/** @type {import('./schema.ts').StatsDocument | null} */
let previous = null;
try {
  previous = JSON.parse(readFileSync(statsPath, "utf-8"));
} catch {
  previous = null;
}

const days = 7;
const { clusters, repoStats } = await runMining({
  repos: RUNTIME_REPOS,
  days,
  metadataOnly: true,
  sampleLogs: false,
  maxLogSamples: 0,
});

const alerts = computeAlerts(clusters.slice(0, 30), previous?.clusters ?? []);

const stats = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: "weekly",
  windowDays: days,
  repos: repoStats,
  clusters: clusters.slice(0, 30).map((c) => ({
    fingerprint: c.fingerprint,
    count: c.count,
    workflowName: c.workflowName,
    jobName: c.jobName,
    catalogId: c.catalogId ?? null,
    repo: c.repo,
    sampleRunIds: c.sampleRunIds,
  })),
  alerts,
};

writeStats(stats);

const date = new Date().toISOString().slice(0, 10);
const reportPath = join(__dirname, `weekly-${date}.md`);
const actionRequired = alerts.length > 0;

const lines = [
  actionRequired ? "# ACTION_REQUIRED — CI Failure Weekly" : "# CI Failure Weekly",
  "",
  `Generated: ${stats.generatedAt}`,
  `Window: last ${days} days`,
  "",
];

if (actionRequired) {
  lines.push("## Alerts", "");
  for (const a of alerts) {
    lines.push(`- ${a}`);
  }
  lines.push("");
} else {
  lines.push("No new clusters or spikes above threshold.", "");
}

lines.push("## Repo summary", "", "| Repo | Failures (7d) |", "|------|--------------:|");
for (const [repo, data] of Object.entries(repoStats)) {
  lines.push(`| ${repo} | ${data.failures} |`);
}

lines.push("", "## Top 10 clusters", "");
for (const c of clusters.slice(0, 10)) {
  lines.push(
    `- **${c.count}×** ${c.repo} / ${c.workflowName} / ${c.jobName ?? "—"} → ${c.catalogId ?? "unmatched"}`,
  );
}

writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf-8");
console.log(`ci-failure-weekly: wrote stats.json and ${reportPath}`);
if (actionRequired) {
  console.log(`ci-failure-weekly: ACTION_REQUIRED (${alerts.length} alert(s))`);
  process.exit(1);
}
