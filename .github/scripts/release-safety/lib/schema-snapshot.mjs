import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const META_KEYS = new Set(["_generated", "_source", "_version", "_note"]);

function normalizeColumn(col) {
  if (typeof col === "string") return { name: col, type: col, nullable: true };
  return {
    name: col.name,
    type: col.type ?? col.dataType ?? "unknown",
    nullable: col.nullable !== false,
    pk: Boolean(col.pk ?? col.primaryKey),
    unique: Boolean(col.unique),
  };
}

function normalizeTable(table) {
  if (!table || typeof table !== "object") return null;
  const columns = (table.columns ?? table.columnNames ?? []).map(normalizeColumn);
  const indexes = [...(table.indexes ?? table.indexNames ?? [])].map(String).sort();
  return {
    columns: columns
      .map((c) => JSON.stringify(c))
      .sort()
      .map((s) => JSON.parse(s)),
    indexes,
  };
}

export function loadExpectedSchema(packageRoot, domain) {
  const path = join(packageRoot, "migrations", domain, "expected-schema.json");
  if (!existsSync(path)) return {};
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const tables = raw.tables ?? raw;
  const snapshot = {};
  for (const [name, table] of Object.entries(tables)) {
    if (META_KEYS.has(name) || name.startsWith("_")) continue;
    const normalized = normalizeTable(table);
    if (normalized) snapshot[name] = normalized;
  }
  return snapshot;
}

export function normalizeExpectedSchemaSnapshot(packageRoot) {
  return {
    platform: loadExpectedSchema(packageRoot, "platform"),
    tenant: loadExpectedSchema(packageRoot, "tenant"),
    api: loadExpectedSchema(packageRoot, "api"),
  };
}

export function listMigrationFiles(packageRoot, domain) {
  const dir = join(packageRoot, "migrations", domain);
  if (!existsSync(dir)) return [];
  return execFileSync("find", [dir, "-maxdepth", "3", "-name", "*.sql", "-type", "f"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .map((p) => p.slice(dir.length + 1))
    .sort();
}
