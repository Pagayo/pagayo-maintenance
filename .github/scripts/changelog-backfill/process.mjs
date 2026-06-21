#!/usr/bin/env node
/**
 * Filter, classify, deduplicate raw changelog records; inject build-log milestones;
 * write draft + final changelog.json for marketing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXCLUDE_BODY_TYPES,
  EXCLUDE_TITLE_PATTERNS,
  MAX_WEEK,
  PROJECT_START_DATE,
} from './lib/constants.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const MARKETING_ROOT = join(__dirname, '../../../..', 'pagayo-marketing');
const BUILD_LOG_PATH = join(MARKETING_ROOT, 'src/content/build-log.json');
const CHANGELOG_OUT = join(MARKETING_ROOT, 'src/content/changelog.json');

const JARGON_RE = /\b(drizzle|prisma|neon|hyperdrive|wrangler|hono|kv blob|d1 migration|eslint|typecheck|vitest|github actions|workflow dispatch|semver|lockfile)\b/i;
const LEGACY_STACK_RE = /\b(cloud run|gcp|postgresql|neon|hyperdrive|prisma)\b/i;

function parseWeekNumber(marker) {
  const m = marker.match(/Week\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

function weekToDate(weekNum, startDate, endDate) {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  const ratio = weekNum / MAX_WEEK;
  const ms = startMs + ratio * (endMs - startMs);
  return new Date(ms).toISOString().slice(0, 10);
}

function extractPrType(body) {
  const m = body.match(/Type wijziging:\s*`?(\w+)`?/i);
  return m ? m[1].toLowerCase() : null;
}

function classifyRecord(record) {
  const prType = extractPrType(record.body);
  const title = record.title.toLowerCase();

  if (prType === 'fix') return 'fixed';
  if (prType === 'feature') return 'new';
  if (prType === 'docs') return null;

  if (/^fix\b|^\fix:|bugfix|hotfix|\bfix\b/.test(title)) return 'fixed';
  if (/^feat\b|^feat:|^add\b|introduc|new /.test(title)) return 'new';
  if (/^remove\b|removed|verwijder|deprecat/.test(title)) return 'removed';
  if (/improve|enhance|perf|optim|update|upgrade|better/.test(title)) return 'improved';
  if (/^change|^changed|^gewijzigd/.test(title)) return 'improved';

  if (record.source === 'legacy-changelog') {
    if (/fixed|fix|bug/.test(title)) return 'fixed';
    if (/removed|verwijderd/.test(title)) return 'removed';
    if (/added|toegevoegd|new/.test(title)) return 'new';
    return 'improved';
  }

  return 'improved';
}

function inferArea(text) {
  const t = text.toLowerCase();
  const areas = [
    ['Payments', /payment|stripe|mollie|checkout|bunq|mpesa|flutterwave|paystack|billing/],
    ['POS', /\bpos\b|point.of.sale|terminal/],
    ['Admin', /admin|dashboard|settings/],
    ['Domains', /domain|dns|ssl|custom domain/],
    ['Memberships', /membership|subscription|recurring|gym|visit track/],
    ['Auth', /auth|login|passkey|webauthn|session/],
    ['Orders', /order|checkout|cart/],
    ['Catalog', /product|catalog|category|inventory/],
    ['Import', /import|woocommerce|magento|migration tool/],
    ['Newsletter', /newsletter|announcement|email/],
    ['AI', /\bai\b|insight|forecast/],
    ['Platform', /tenant|provision|edge|worker|multi.tenant/],
  ];
  for (const [area, re] of areas) {
    if (re.test(t)) return area;
  }
  return undefined;
}

function normalizeKey(title) {
  return title
    .toLowerCase()
    .replace(/^(feat|fix|chore|refactor|docs)(\([^)]+\))?:?\s*/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 80);
}

function shouldExclude(record) {
  const title = record.title;
  const author = record.author ?? '';

  if (author.toLowerCase().includes('dependabot')) return true;
  for (const re of EXCLUDE_TITLE_PATTERNS) {
    if (re.test(title)) return true;
  }

  if (/batch staging/i.test(title)) return true;

  if (record.repo === 'pagayo-maintenance' && /workspace-status|copilot worktree|local dev|smoke test/i.test(title)) {
    return true;
  }

  if (/^staging:\s/i.test(title)) return true;

  const prType = extractPrType(record.body);
  if (prType && EXCLUDE_BODY_TYPES.has(prType)) return true;

  if (record.source === 'legacy-changelog') {
    if (LEGACY_STACK_RE.test(record.body)) return true;
    if (/`/.test(record.body) && record.repo === 'pagayo-config') return true;
  }

  if (record.repo === 'pagayo-marketing' && !/blog|pricing|feature page|changelog/i.test(title)) {
    return true;
  }

  return false;
}

function humanizeTitle(title, body) {
  let text = title
    .replace(/^(feat|fix|chore|refactor|docs)(\([^)]+\))?:?\s*/i, '')
    .replace(/\(#\d+\)/g, '')
    .trim();

  if (text.length < 12 && body) {
    const firstLine = body.split('\n').find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('- ['));
    if (firstLine) text = firstLine.replace(/^-\s*/, '').slice(0, 120);
  }

  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (!text.endsWith('.')) text += '.';
  return text;
}

function curateText(text) {
  const dutchMap = [
    [/verbeter/gi, 'Improve'],
    [/herstel/gi, 'Fix'],
    [/toegevoegd/gi, 'Added'],
    [/verwijderd/gi, 'Removed'],
    [/beheer/gi, 'management'],
    [/gearchiveerd/gi, 'archived'],
    [/migratie/gi, 'migration'],
    [/normaliseer/gi, 'Normalize'],
  ];
  let out = text
    .replace(/#\d+/g, '')
    .replace(/\(#[\d,\s]+\)/g, '')
    .replace(/design\s+\d+\.\d+\.\d+/gi, '')
    .replace(/schema\s+\d+\.\d+\.\d+/gi, '')
    .replace(/config\s+\d+\.\d+\.\d+/gi, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\bPR\b/g, 'change')
    .replace(/\bD1\b/g, 'database')
    .replace(/\bKV\b/g, 'cache')
    .replace(/\bWorkers\b/g, 'edge')
    .replace(/Perf\([^)]+\):\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [re, rep] of dutchMap) {
    out = out.replace(re, rep);
  }

  if (/^release:\s*batch staging/i.test(out)) return '';
  if (/batch staging/i.test(out)) return '';
  if (out.length > 0 && out[0] === out[0].toLowerCase()) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  if (out && !out.endsWith('.')) out += '.';
  return out;
}

function milestoneToItem(entry) {
  const text = `${entry.title}: ${entry.body.split('.')[0]}.`;
  return {
    type: 'new',
    text: curateText(text),
    area: inferArea(`${entry.title} ${entry.body}`),
    source: 'build-log-milestone',
  };
}

function loadBuildLogMilestones(today) {
  const buildLog = JSON.parse(readFileSync(BUILD_LOG_PATH, 'utf8'));
  return buildLog.timeline
    .filter((e) => !/^today$/i.test(e.title))
    .map((entry) => {
      const week = parseWeekNumber(entry.marker);
      if (!week) return null;
      return {
        week,
        date: weekToDate(week, PROJECT_START_DATE, today),
        entry,
      };
    })
    .filter(Boolean);
}

function groupByDate(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.date)) map.set(item.date, []);
    map.get(item.date).push(item);
  }
  return map;
}

function capItemsPerDay(items, max = 8) {
  if (items.length <= max) return items;
  const priority = { 'build-log-milestone': 0, 'github-pr': 1, 'legacy-changelog': 2, 'github-release': 3 };
  return [...items]
    .sort((a, b) => (priority[a.source] ?? 9) - (priority[b.source] ?? 9))
    .slice(0, max);
}

function main() {
  const today = new Date().toISOString().slice(0, 10);
  const rawPath = join(OUTPUT_DIR, 'raw-changelog.json');
  const raw = JSON.parse(readFileSync(rawPath, 'utf8'));

  const seen = new Set();
  const candidates = [];

  for (const record of raw.records) {
    if (shouldExclude(record)) continue;

    const type = classifyRecord(record);
    if (!type) continue;

    const key = `${record.date}|${normalizeKey(record.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let text = curateText(humanizeTitle(record.title, record.body));
    if (!text) continue;
    if (JARGON_RE.test(text) && record.source === 'github-pr') {
      const area = inferArea(`${record.title} ${record.body}`);
      if (area) {
        text = `${area}: platform update shipped.`;
      } else if (text.length > 100) {
        continue;
      }
    }

    if (text.length < 8) continue;

    candidates.push({
      date: record.date,
      type,
      text,
      area: inferArea(`${record.title} ${record.body}`),
      source: record.source,
    });
  }

  const milestones = loadBuildLogMilestones(today);

  for (const m of milestones) {
    const item = milestoneToItem(m.entry);
    const key = normalizeKey(item.text);
    const hasSimilar = candidates.some(
      (c) => c.date === m.date && normalizeKey(c.text).includes(key.slice(0, 24)),
    );
    if (!hasSimilar) {
      candidates.push({
        date: m.date,
        ...item,
      });
    }
  }

  const byDate = groupByDate(candidates);
  const releases = [];

  for (const [date, items] of byDate) {
    const capped = capItemsPerDay(items).map(({ type, text, area }) => {
      const out = { type, text };
      if (area) out.area = area;
      return out;
    });
    if (capped.length) releases.push({ date, items: capped });
  }

  releases.sort((a, b) => b.date.localeCompare(a.date));

  const entryCount = releases.reduce((n, r) => n + r.items.length, 0);

  const draft = {
    meta: {
      projectStartDate: PROJECT_START_DATE,
      generatedAt: new Date().toISOString(),
      entryCount,
      releaseCount: releases.length,
    },
    releases,
  };

  writeFileSync(join(OUTPUT_DIR, 'draft-changelog.json'), JSON.stringify(draft, null, 2));
  writeFileSync(CHANGELOG_OUT, JSON.stringify(draft, null, 2));

  console.log(`Draft: ${entryCount} items across ${releases.length} dates`);
  console.log(`Wrote ${CHANGELOG_OUT}`);
}

main();
