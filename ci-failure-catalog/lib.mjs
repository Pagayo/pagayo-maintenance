/**
 * CI failure catalog — load, validate, match.
 * ESM module used by match/backfill/weekly scripts and vitest via dynamic import.
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLASSIFICATIONS = new Set([
  "ai-behavioral",
  "deterministic",
  "infra",
  "flake",
]);
const PREVENTION_LAYERS = new Set([
  "preflight",
  "ci-doctor",
  "playbook-trigger",
  "workflow",
  "none",
]);
const STATUSES = new Set(["active", "proposed", "archived"]);
const CONFIDENCE = new Set(["high", "medium", "low"]);

/** @typedef {import('./schema.ts').CatalogEntry} CatalogEntry */
/** @typedef {import('./schema.ts').Catalog} Catalog */

/**
 * @param {string} raw
 */
export function parseCatalogYaml(raw) {
  return parseYaml(raw);
}

/**
 * @param {unknown} entry
 * @returns {string[]}
 */
export function validateEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== "object") {
    return ["entry must be an object"];
  }
  /** @type {Record<string, unknown>} */
  const e = entry;

  const required = [
    "id",
    "title",
    "classification",
    "match",
    "prevention",
    "fix",
    "status",
    "confidence",
  ];
  for (const key of required) {
    if (!(key in e)) errors.push(`missing field: ${key}`);
  }

  if (typeof e.id !== "string" || !e.id) errors.push("id must be non-empty string");
  if (typeof e.title !== "string" || !e.title) errors.push("title must be non-empty string");
  if (!CLASSIFICATIONS.has(String(e.classification))) {
    errors.push(`invalid classification: ${e.classification}`);
  }
  if (!STATUSES.has(String(e.status))) errors.push(`invalid status: ${e.status}`);
  if (!CONFIDENCE.has(String(e.confidence))) {
    errors.push(`invalid confidence: ${e.confidence}`);
  }

  if (e.match && typeof e.match === "object") {
    /** @type {{ patterns?: unknown }} */
    const match = e.match;
    if (!Array.isArray(match.patterns) || match.patterns.length === 0) {
      errors.push("match.patterns must be a non-empty array");
    }
  } else {
    errors.push("match must be an object with patterns");
  }

  if (e.prevention && typeof e.prevention === "object") {
    /** @type {{ layer?: unknown, ref?: unknown }} */
    const prev = e.prevention;
    if (!PREVENTION_LAYERS.has(String(prev.layer))) {
      errors.push(`invalid prevention.layer: ${prev.layer}`);
    }
    if (typeof prev.ref !== "string" || !prev.ref) {
      errors.push("prevention.ref must be non-empty string");
    }
  } else {
    errors.push("prevention must be an object");
  }

  if (e.fix && typeof e.fix === "object") {
    /** @type {{ summary?: unknown }} */
    const fix = e.fix;
    if (typeof fix.summary !== "string" || !fix.summary) {
      errors.push("fix.summary must be non-empty string");
    }
  } else {
    errors.push("fix must be an object with summary");
  }

  for (const listKey of ["repos", "workflows", "jobs"]) {
    if (e[listKey] !== undefined) {
      if (!Array.isArray(e[listKey])) {
        errors.push(`${listKey} must be an array when present`);
      }
    }
  }

  return errors;
}

/**
 * @param {unknown} catalog
 * @returns {string[]}
 */
export function validateCatalog(catalog) {
  const errors = [];
  if (!catalog || typeof catalog !== "object") return ["catalog must be an object"];
  /** @type {{ version?: unknown, entries?: unknown }} */
  const c = catalog;
  if (c.version !== 1) errors.push("version must be 1");
  if (!Array.isArray(c.entries)) return [...errors, "entries must be an array"];
  const ids = new Set();
  for (let i = 0; i < c.entries.length; i++) {
    const entryErrors = validateEntry(c.entries[i]);
    for (const err of entryErrors) {
      errors.push(`entries[${i}]: ${err}`);
    }
    /** @type {{ id?: string }} */
    const entry = c.entries[i];
    if (entry?.id) {
      if (ids.has(entry.id)) errors.push(`duplicate id: ${entry.id}`);
      ids.add(entry.id);
    }
  }
  return errors;
}

/**
 * @param {string} [catalogPath]
 */
export function loadCatalog(catalogPath) {
  const path = catalogPath ?? join(__dirname, "catalog.yaml");
  const raw = readFileSync(path, "utf-8");
  const catalog = parseCatalogYaml(raw);
  const errors = validateCatalog(catalog);
  if (errors.length > 0) {
    throw new Error(`Invalid catalog:\n${errors.join("\n")}`);
  }
  return catalog;
}

/**
 * Normalize text for fingerprinting (backfill).
 * @param {string} text
 */
export function normalizeFingerprint(text) {
  return text
    .replace(/\b[0-9a-f]{7,40}\b/gi, "<sha>")
    .replace(/\b\d{10,}\b/g, "<id>")
    .replace(
      /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\dZ]*/g,
      "<ts>",
    )
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "<ip>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

/**
 * @param {string} text
 * @param {Record<string, unknown>[]} entries
 * @param {{ repo?: string, workflow?: string, job?: string }} [filters]
 */
export function matchCatalog(text, entries, filters = {}) {
  const haystack = text.toLowerCase();
  /** @type {{ entry: Record<string, unknown>, score: number }[]} */
  const matches = [];

  for (const entry of entries) {
    if (entry.status === "archived") continue;

    if (filters.repo && Array.isArray(entry.repos) && entry.repos.length > 0) {
      if (!entry.repos.includes(filters.repo)) continue;
    }
    if (
      filters.workflow &&
      Array.isArray(entry.workflows) &&
      entry.workflows.length > 0
    ) {
      const wf = filters.workflow.toLowerCase();
      const hit = entry.workflows.some(
        (w) =>
          String(w).toLowerCase() === wf ||
          wf.includes(String(w).toLowerCase()),
      );
      if (!hit) continue;
    }
    if (filters.job && Array.isArray(entry.jobs) && entry.jobs.length > 0) {
      const jn = filters.job.toLowerCase();
      const hit = entry.jobs.some(
        (j) =>
          jn.includes(String(j).toLowerCase()) ||
          String(j).toLowerCase().includes(jn),
      );
      if (!hit) continue;
    }

    /** @type {{ patterns?: string[] }} */
    const match = entry.match;
    let score = 0;
    for (const pattern of match.patterns ?? []) {
      try {
        const re = new RegExp(pattern, "i");
        if (re.test(text)) score += 2;
      } catch {
        if (haystack.includes(pattern.toLowerCase())) score += 1;
      }
    }
    if (score > 0) {
      matches.push({ entry, score });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.length > 0 ? matches[0].entry : null;
}

/**
 * Extract first actionable error line from CI log blob.
 * @param {string} log
 */
export function extractActionableError(log) {
  const lines = log.split("\n");
  const priorities = [
    /::error::/i,
    /error TS\d+/i,
    /npm error/i,
    /FAIL\s+/i,
    /AssertionError/i,
    /Error:/i,
    /failed/i,
    /TOKEN_MISSING/i,
  ];

  for (const re of priorities) {
    const hit = lines.find((l) => re.test(l) && l.trim().length > 10);
    if (hit) return normalizeFingerprint(hit);
  }

  const nonEmpty = lines.filter((l) => l.trim().length > 20);
  return nonEmpty.length > 0
    ? normalizeFingerprint(nonEmpty[nonEmpty.length - 1])
    : "";
}

/**
 * @param {string} text
 * @param {{ repo?: string, workflow?: string, job?: string, catalogPath?: string }} [opts]
 */
export function matchText(text, opts = {}) {
  const catalog = loadCatalog(opts.catalogPath);
  /** @type {Record<string, unknown>[]} */
  const entries = catalog.entries;
  const entry = matchCatalog(text, entries, {
    repo: opts.repo,
    workflow: opts.workflow,
    job: opts.job,
  });
  return entry;
}
