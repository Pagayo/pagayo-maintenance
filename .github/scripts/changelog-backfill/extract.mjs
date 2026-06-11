#!/usr/bin/env node
/**
 * Extract raw changelog candidates from GitHub PRs, releases, and local CHANGELOG files.
 * Output: output/raw-changelog.json
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_START_DATE, REPOS } from './lib/constants.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const WORKSPACE_ROOT = join(__dirname, '../../../..');

mkdirSync(OUTPUT_DIR, { recursive: true });

function ghJson(args) {
  try {
    const out = execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    return JSON.parse(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`gh failed: ${args.join(' ')} — ${message}`);
    return null;
  }
}

function toDateOnly(iso) {
  if (!iso) return null;
  return iso.slice(0, 10);
}

function extractPrs() {
  const records = [];
  const startMs = Date.parse(`${PROJECT_START_DATE}T00:00:00Z`);

  for (const repo of REPOS) {
    console.log(`Fetching merged PRs: Pagayo/${repo}`);
    const prs = ghJson([
      'pr',
      'list',
      '--repo',
      `Pagayo/${repo}`,
      '--state',
      'merged',
      '--base',
      'main',
      '--limit',
      '1000',
      '--json',
      'number,title,body,mergedAt,labels,author',
    ]);

    if (!Array.isArray(prs)) {
      console.error(`Skipping ${repo}: no PR data`);
      continue;
    }

    for (const pr of prs) {
      const date = toDateOnly(pr.mergedAt);
      if (!date || Date.parse(`${date}T00:00:00Z`) < startMs) continue;

      records.push({
        repo,
        date,
        title: pr.title ?? '',
        body: pr.body ?? '',
        pr: pr.number,
        labels: (pr.labels ?? []).map((l) => l.name),
        author: pr.author?.login ?? '',
        source: 'github-pr',
      });
    }

    console.log(`  → ${records.filter((r) => r.repo === repo).length} PRs since ${PROJECT_START_DATE}`);
  }

  return records;
}

function parseKeepAChangelog(markdown, repoName) {
  const records = [];
  const startMs = Date.parse(`${PROJECT_START_DATE}T00:00:00Z`);
  const sectionRe = /^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})\s*$/gm;
  let match;

  while ((match = sectionRe.exec(markdown)) !== null) {
    const version = match[1];
    const date = match[2];
    if (Date.parse(`${date}T00:00:00Z`) < startMs) continue;

    const nextIdx = markdown.indexOf('\n## ', match.index + match[0].length);
    const block = markdown.slice(match.index + match[0].length, nextIdx === -1 ? undefined : nextIdx);
    const lines = block.split('\n').filter((l) => l.startsWith('- '));

    for (const line of lines) {
      const text = line.replace(/^-\s+(\*\*[^*]+\*\*\s*-?\s*)?/, '').trim();
      if (!text || /technical details|deprecated|breaking change/i.test(text)) continue;
      records.push({
        repo: repoName,
        date,
        title: text.slice(0, 120),
        body: text,
        pr: null,
        labels: [version],
        author: '',
        source: 'legacy-changelog',
      });
    }
  }

  return records;
}

function extractLocalChangelogs() {
  const paths = [
    { path: join(WORKSPACE_ROOT, 'pagayo-config/CHANGELOG.md'), repo: 'pagayo-config' },
    { path: join(WORKSPACE_ROOT, 'pagayo-storefront/CHANGELOG.md'), repo: 'pagayo-storefront' },
  ];

  const records = [];
  for (const { path, repo } of paths) {
    try {
      const md = readFileSync(path, 'utf8');
      if (/HISTORISCH|legacy/i.test(md.slice(0, 500)) && repo === 'pagayo-storefront') {
        console.log(`Parsing storefront CHANGELOG (filtered by date >= ${PROJECT_START_DATE})`);
      }
      records.push(...parseKeepAChangelog(md, repo));
    } catch {
      console.warn(`No CHANGELOG at ${path}`);
    }
  }
  return records;
}

function extractReleases() {
  const records = [];
  const packageRepos = ['pagayo-schema', 'pagayo-design', 'pagayo-config'];
  const startMs = Date.parse(`${PROJECT_START_DATE}T00:00:00Z`);

  for (const repo of packageRepos) {
    const releases = ghJson([
      'release',
      'list',
      '--repo',
      `Pagayo/${repo}`,
      '--limit',
      '100',
      '--json',
      'tagName,publishedAt,name',
    ]);
    if (!Array.isArray(releases)) continue;

    for (const rel of releases) {
      const date = toDateOnly(rel.publishedAt);
      if (!date || Date.parse(`${date}T00:00:00Z`) < startMs) continue;
      const summary = (rel.name ?? rel.tagName ?? '').trim();
      if (!summary) continue;
      records.push({
        repo,
        date,
        title: `${rel.tagName}: ${summary}`.slice(0, 160),
        body: summary,
        pr: null,
        labels: [rel.tagName],
        author: '',
        source: 'github-release',
      });
    }
  }

  return records;
}

const prRecords = extractPrs();
const changelogRecords = extractLocalChangelogs();
const releaseRecords = extractReleases();

const raw = {
  meta: {
    projectStartDate: PROJECT_START_DATE,
    extractedAt: new Date().toISOString(),
    counts: {
      prs: prRecords.length,
      changelogs: changelogRecords.length,
      releases: releaseRecords.length,
    },
  },
  records: [...prRecords, ...changelogRecords, ...releaseRecords],
};

writeFileSync(join(OUTPUT_DIR, 'raw-changelog.json'), JSON.stringify(raw, null, 2));
console.log(`Wrote ${raw.records.length} raw records to output/raw-changelog.json`);
