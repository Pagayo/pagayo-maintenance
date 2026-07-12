import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadProfile(name) {
  const path = join(__dirname, "..", "contracts", `${name}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

export function diffRemoved(previous, candidate, label) {
  const removed = [...previous].filter((item) => !candidate.has(item));
  if (removed.length === 0) return [];
  return removed.map((item) => `${label}: removed ${item}`);
}

export function assertSuperset(previousSet, candidateSet, label, allowBreaking) {
  const violations = diffRemoved(previousSet, candidateSet, label);
  if (violations.length && !allowBreaking) {
    throw new Error(
      `Contract regression detected (${label}):\n${violations.join("\n")}\nUse workflow_dispatch with ALLOW_BREAKING_CONTRACT=true for intentional breaking changes.`,
    );
  }
  return violations;
}

export function compareExportMaps(previousPkg, candidatePkg) {
  const prevKeys = new Set(Object.keys(previousPkg.exports ?? {}));
  const candKeys = new Set(Object.keys(candidatePkg.exports ?? {}));
  assertSuperset(prevKeys, candKeys, "package.json exports");

  for (const key of prevKeys) {
    const prev = JSON.stringify(previousPkg.exports[key]);
    const cand = JSON.stringify(candidatePkg.exports[key]);
    if (prev !== cand) {
      throw new Error(`Export mapping changed for ${key}: ${prev} -> ${cand}`);
    }
  }
}

export function compareFileSets(previousFiles, candidateFiles, label, allowBreaking = false) {
  const prev = new Set(previousFiles);
  const cand = new Set(candidateFiles);
  assertSuperset(prev, cand, label, allowBreaking);
}

export function compareSchemaSnapshots(previous, candidate, allowBreaking) {
  for (const domain of ["platform", "tenant", "api"]) {
    const prevTables = new Set(Object.keys(previous[domain] ?? {}));
    const candTables = new Set(Object.keys(candidate[domain] ?? {}));
    assertSuperset(prevTables, candTables, `expected-schema ${domain} tables`, allowBreaking);

    for (const table of prevTables) {
      const prev = previous[domain][table];
      const cand = candidate[domain][table];
      if (!cand) continue;
      const prevCols = new Set(prev.columns.map((c) => JSON.stringify(c)));
      const candCols = new Set(cand.columns.map((c) => JSON.stringify(c)));
      assertSuperset(prevCols, candCols, `expected-schema ${domain}.${table} columns`, allowBreaking);
      const prevIdx = new Set(prev.indexes);
      const candIdx = new Set(cand.indexes);
      assertSuperset(prevIdx, candIdx, `expected-schema ${domain}.${table} indexes`, allowBreaking);
    }
  }
}
