/**
 * Shared clustering logic for backfill + weekly scripts.
 */
import { execFileSync } from "child_process";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  extractActionableError,
  loadCatalog,
  matchCatalog,
  normalizeFingerprint,
} from "./lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} repo Full name Pagayo/pagayo-storefront
 * @param {number} days
 * @param {boolean} failuresOnly
 */
export async function listRuns(repo, days, failuresOnly) {
  if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
    // gh CLI uses its own auth
  }

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceDate = since.toISOString().slice(0, 10);

  const args = [
    "run",
    "list",
    "--repo",
    repo,
    "--limit",
    "1000",
    "--created",
    `>=${sinceDate}`,
    "--json",
    "databaseId,conclusion,workflowName,headBranch,createdAt,event",
  ];
  if (failuresOnly) {
    args.push("--status", "failure");
  }

  const json = execFileSync("gh", args, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  /** @type {Array<Record<string, unknown>>} */
  const batch = JSON.parse(json);
  return batch.filter((run) => {
    if (failuresOnly && run.conclusion !== "failure") return false;
    return true;
  });
}

/**
 * @param {string} repo
 * @param {number} runId
 */
export function fetchFailedJobs(repo, runId) {
  try {
    const json = execFileSync(
      "gh",
      [
        "run",
        "view",
        String(runId),
        "--repo",
        repo,
        "--json",
        "jobs",
      ],
      { encoding: "utf-8" },
    );
    /** @type {{ jobs: Array<{ name: string, conclusion: string }> }} */
    const data = JSON.parse(json);
    return data.jobs.filter((j) => j.conclusion === "failure").map((j) => j.name);
  } catch {
    return [];
  }
}

/**
 * @param {string} repo
 * @param {number} runId
 */
export async function fetchRunLogSnippet(repo, runId) {
  try {
    const log = execFileSync(
      "gh",
      ["run", "view", String(runId), "--repo", repo, "--log-failed"],
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
    );
    return extractActionableError(log.slice(-8000));
  } catch {
    return "";
  }
}

/**
 * @typedef {object} Cluster
 * @property {string} fingerprint
 * @property {number} count
 * @property {string} [workflowName]
 * @property {string} [jobName]
 * @property {string|null} [catalogId]
 * @property {string} [repo]
 * @property {number[]} [sampleRunIds]
 */

/**
 * @param {Array<{ repo: string, run: Record<string, unknown>, jobName?: string, fingerprint: string, catalogId: string|null }>} events
 * @returns {Cluster[]}
 */
export function buildClusters(events) {
  /** @type {Map<string, Cluster>} */
  const map = new Map();

  for (const ev of events) {
    const key = `${ev.repo}|${ev.run.workflowName}|${ev.jobName ?? ""}|${ev.fingerprint}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (existing.sampleRunIds && existing.sampleRunIds.length < 5) {
        existing.sampleRunIds.push(Number(ev.run.databaseId));
      }
    } else {
      map.set(key, {
        fingerprint: ev.fingerprint,
        count: 1,
        workflowName: String(ev.run.workflowName ?? ""),
        jobName: ev.jobName,
        catalogId: ev.catalogId,
        repo: ev.repo.replace(/^Pagayo\//, ""),
        sampleRunIds: [Number(ev.run.databaseId)],
      });
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count);
}

/**
 * @param {Cluster[]} clusters
 * @param {Cluster[]} [previousClusters]
 */
export function computeAlerts(clusters, previousClusters = []) {
  /** @type {string[]} */
  const alerts = [];
  const prevMap = new Map(
    previousClusters.map((c) => [
      `${c.repo}|${c.workflowName}|${c.jobName ?? ""}|${c.fingerprint}`,
      c.count,
    ]),
  );

  for (const cluster of clusters) {
    const key = `${cluster.repo}|${cluster.workflowName}|${cluster.jobName ?? ""}|${cluster.fingerprint}`;
    const prev = prevMap.get(key) ?? 0;
    if (prev === 0 && cluster.count >= 2) {
      alerts.push(
        `NEW_CLUSTER: ${cluster.repo} ${cluster.workflowName} — ${cluster.fingerprint.slice(0, 80)} (${cluster.count}x)`,
      );
    } else if (prev > 0 && cluster.count >= prev * 1.5 && cluster.count >= 3) {
      alerts.push(
        `SPIKE: ${cluster.repo} ${cluster.workflowName} — ${cluster.fingerprint.slice(0, 80)} (${prev}→${cluster.count})`,
      );
    }
    if (!cluster.catalogId && cluster.count >= 5) {
      alerts.push(
        `UNMATCHED_HIGH_FREQ: ${cluster.repo} — ${cluster.fingerprint.slice(0, 80)} (${cluster.count}x) — consider catalog entry`,
      );
    }
  }

  return alerts;
}

/**
 * @param {object} opts
 * @param {string[]} opts.repos
 * @param {number} opts.days
 * @param {boolean} [opts.sampleLogs]
 * @param {boolean} [opts.metadataOnly]
 * @param {number} [opts.maxLogSamples]
 * @param {number} [opts.maxRuns] Cap per-repo run detail fetches (API budget)
 */
export async function runMining(opts) {
  const catalog = loadCatalog();
  const repoSlug = (r) => r.replace(/^Pagayo\//, "");

  /** @type {Array<{ repo: string, run: Record<string, unknown>, jobName?: string, fingerprint: string, catalogId: string|null }>} */
  const events = [];
  /** @type {Record<string, { failures: number, matched: number }>} */
  const repoStats = {};

  for (const repo of opts.repos) {
    const slug = repoSlug(repo);
    repoStats[slug] = { failures: 0, matched: 0 };

    const runs = await listRuns(repo, opts.days, true);
    repoStats[slug].failures = runs.length;

    if (opts.metadataOnly) {
      for (const run of runs) {
        const wf = String(run.workflowName ?? "unknown");
        const fingerprint = normalizeFingerprint(`metadata-only:${wf}:failure`);
        const entry = matchCatalog(fingerprint, catalog.entries, {
          repo: slug,
          workflow: wf,
        });
        if (entry) repoStats[slug].matched += 1;
        events.push({
          repo,
          run,
          fingerprint,
          catalogId: entry ? String(entry.id) : null,
        });
      }
      continue;
    }

    let logSamples = 0;
    const maxSamples = opts.maxLogSamples ?? 5;
    const maxRuns = opts.maxRuns ?? (opts.sampleLogs ? 200 : runs.length);
    const runsToProcess = runs.slice(0, maxRuns);

    for (const run of runsToProcess) {
      const runId = Number(run.databaseId);
      const failedJobs = fetchFailedJobs(repo, runId);

      if (failedJobs.length === 0) {
        events.push({
          repo,
          run,
          fingerprint: `no-failed-job-metadata:${run.workflowName}`,
          catalogId: null,
        });
        continue;
      }

      for (const jobName of failedJobs) {
        let fingerprint = `${jobName}:unknown`;
        let catalogId = null;

        if (opts.sampleLogs && logSamples < maxSamples * failedJobs.length) {
          const snippet = await fetchRunLogSnippet(repo, runId);
          if (snippet) {
            fingerprint = snippet;
            logSamples += 1;
            const entry = matchCatalog(snippet, catalog.entries, {
              repo: slug,
              workflow: String(run.workflowName ?? ""),
              job: jobName,
            });
            if (entry) {
              catalogId = String(entry.id);
              repoStats[slug].matched += 1;
            }
          } else {
            fingerprint = normalizeFingerprint(`${jobName}:log-unavailable`);
          }
        } else {
          fingerprint = normalizeFingerprint(`${jobName}:${run.workflowName}`);
          const entry = matchCatalog(fingerprint, catalog.entries, {
            repo: slug,
            workflow: String(run.workflowName ?? ""),
            job: jobName,
          });
          if (entry) catalogId = String(entry.id);
        }

        events.push({
          repo,
          run,
          jobName,
          fingerprint,
          catalogId,
        });
      }
    }

    if (runs.length > runsToProcess.length) {
      for (const run of runs.slice(runsToProcess.length)) {
        events.push({
          repo,
          run,
          fingerprint: normalizeFingerprint(
            `metadata-only:${run.workflowName}:failure`,
          ),
          catalogId: null,
        });
      }
    }
  }

  const clusters = buildClusters(events);
  return { clusters, repoStats, events };
}

/**
 * @param {object} stats
 * @param {string} [outPath]
 */
export function writeStats(stats, outPath) {
  const path = outPath ?? join(__dirname, "stats.json");
  writeFileSync(path, `${JSON.stringify(stats, null, 2)}\n`, "utf-8");
}
