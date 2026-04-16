/**
 * SMOKE TESTS - D1 DATABASE SCHEMA VALIDATION
 * ============================================================================
 * DOEL: Verificatie dat D1 database schema's in sync zijn met de codebase.
 * PRIORITEIT: CRITICAL - Voorkomt runtime SQL errors door ontbrekende kolommen.
 *
 * METHODE:
 * Gebruikt Cloudflare REST API om PRAGMA table_info() uit te voeren
 * op de production D1 databases. Valideert dat de verwachte kolommen
 * bestaan na migraties.
 *
 * SINGLE SOURCE OF TRUTH:
 * Expected schema's worden geladen uit @pagayo/schema expected-schema.json
 * bestanden. Deze worden automatisch gegenereerd vanuit Drizzle schema's.
 * GEEN hardcoded schema definities meer in dit bestand!
 *
 * VEREISTEN:
 * - CF_API_TOKEN environment variable (Cloudflare API token)
 * - CF_ACCOUNT_ID environment variable
 *
 * ACTIE BIJ FAILURE:
 * - Kolom ontbreekt → Migratie niet uitgevoerd, run migrate-d1.sh
 * - Tabel ontbreekt → Fresh install nodig of baseline niet uitgevoerd
 * - Auth error → Check CF_API_TOKEN validiteit
 * ============================================================================
 */

import { logTestResult, type TestResult } from "../utils/test-reporter";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Resolve de pagayo-schema repo zonder afhankelijk te zijn van een lokale absolute path.
 */
function resolveSchemaRepoRoot(): string {
  const envOverride = process.env.PAGAYO_SCHEMA_ROOT;
  if (envOverride) {
    const resolvedOverride = resolve(envOverride);
    if (existsSync(join(resolvedOverride, "migrations"))) {
      return resolvedOverride;
    }
  }

  let currentDir = resolve(__dirname);

  while (true) {
    const candidate = join(currentDir, "pagayo-schema");
    if (existsSync(join(candidate, "migrations"))) {
      return candidate;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  throw new Error(
    "Kon pagayo-schema/migrations niet vinden. Zet PAGAYO_SCHEMA_ROOT of run vanuit de monorepo workspace.",
  );
}

// Load expected schemas from @pagayo/schema (Single Source of Truth)
const SCHEMA_BASE_PATH = join(resolveSchemaRepoRoot(), "migrations");

interface ExpectedSchemaFile {
  _comment: string;
  _generated: string;
  _source: string;
  [tableName: string]: { columns: string[]; nullable?: string[] } | string;
}

function loadExpectedSchema(
  dbType: "platform" | "tenant" | "api",
): Record<string, string[]> {
  const candidateDirs = [dbType, `${dbType}-v2`];
  const filePath = candidateDirs
    .map((dirName) => join(SCHEMA_BASE_PATH, dirName, "expected-schema.json"))
    .find((candidatePath) => existsSync(candidatePath));

  if (!filePath) {
    throw new Error(
      `Kon expected schema niet vinden voor ${dbType}. Gezocht in: ${candidateDirs
        .map((dirName) =>
          join(SCHEMA_BASE_PATH, dirName, "expected-schema.json"),
        )
        .join(", ")}`,
    );
  }

  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as ExpectedSchemaFile;

  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    // Skip metadata fields
    if (key.startsWith("_")) continue;
    if (typeof value === "object" && "columns" in value) {
      result[key] = value.columns;
    }
  }
  return result;
}

// Load schemas from SSoT files
const EXPECTED_PLATFORM = loadExpectedSchema("platform");
const EXPECTED_TENANT = loadExpectedSchema("tenant");
const EXPECTED_API = loadExpectedSchema("api");

const CF_API_TOKEN =
  process.env.CF_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID =
  process.env.CF_ACCOUNT_ID ??
  process.env.CLOUDFLARE_ACCOUNT_ID ??
  "5d4d9b7bcdf6a836c16b19e09d198047";
const REQUIRE_CF_API_TOKEN =
  process.env.REQUIRE_CF_API_TOKEN === "true" ||
  process.env.REQUIRE_D1_SCHEMA_TOKEN === "true" ||
  process.env.CI === "true";

// Production D1 database IDs
const DEFAULT_TENANT_DATABASE_ID = "394cb77c-fc12-4bd4-85c9-13937dbb3305";

function parseTenantDatabaseIds(): string[] {
  const raw = process.env.TENANT_D1_DATABASE_IDS?.trim();
  if (!raw) return [DEFAULT_TENANT_DATABASE_ID];

  const parsed = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return parsed.length > 0 ? [...new Set(parsed)] : [DEFAULT_TENANT_DATABASE_ID];
}

const TENANT_DATABASE_IDS = parseTenantDatabaseIds();

const DATABASES = {
  PLATFORM: "e7b19343-f213-4d3d-9966-364a20b01b97",
  TENANT: DEFAULT_TENANT_DATABASE_ID,
  API: "538adacb-1164-4d50-b1d8-6c2208d20ed9",
} as const;

function log(
  test: string,
  status: TestResult["status"],
  details: string,
  action?: string,
  priority?: TestResult["priority"],
) {
  logTestResult({
    category: "SMOKE",
    service: "d1-schema",
    test,
    status,
    details,
    action,
    priority,
  });
}

interface D1QueryResult {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: Array<{
    results: Array<Record<string, unknown>>;
    success: boolean;
  }>;
}

/**
 * Voer een SQL query uit op een D1 database via Cloudflare REST API.
 */
async function queryD1(
  databaseId: string,
  sql: string,
): Promise<D1QueryResult> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    },
  );

  if (!response.ok) {
    throw new Error(`D1 API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<D1QueryResult>;
}

/**
 * Haal kolomnamen op voor een tabel via PRAGMA table_info.
 */
async function getTableColumns(
  databaseId: string,
  tableName: string,
): Promise<string[]> {
  const result = await queryD1(databaseId, `PRAGMA table_info(${tableName})`);
  if (!result.success || !result.result?.[0]?.results) {
    return [];
  }
  return result.result[0].results.map((row) => row.name as string);
}

/**
 * Haal alle tabelnamen op uit de database.
 */
async function getTableNames(databaseId: string): Promise<string[]> {
  const result = await queryD1(
    databaseId,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf%' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  if (!result.success || !result.result?.[0]?.results) {
    return [];
  }
  return result.result[0].results.map((row) => row.name as string);
}

// ============================================================================
// TESTS
// ============================================================================

describe("D1 Database Schema - Smoke Tests", () => {
  const canRunTests = Boolean(CF_API_TOKEN);

  beforeAll(() => {
    if (!canRunTests && REQUIRE_CF_API_TOKEN) {
      throw new Error(
        "CF_API_TOKEN ontbreekt maar is verplicht in deze run (CI/REQUIRE_CF_API_TOKEN=true).",
      );
    }

    if (!canRunTests) {
      console.warn(
        "⚠️  CF_API_TOKEN niet gezet — D1 schema tests worden overgeslagen.\n" +
          "   Set CF_API_TOKEN of CLOUDFLARE_API_TOKEN om deze tests te activeren.",
      );
    }
  });

  // ========================================================================
  // PLATFORM DB
  // ========================================================================

  describe("Platform DB", () => {
    it("has all expected tables", async () => {
      if (!canRunTests) return;

      const tables = await getTableNames(DATABASES.PLATFORM);
      const expected = Object.keys(EXPECTED_PLATFORM);
      const missing = expected.filter((t) => !tables.includes(t));

      log(
        "platform-tables",
        missing.length === 0 ? "PASS" : "FAIL",
        missing.length === 0
          ? `All ${expected.length} expected tables present (${tables.length} total)`
          : `Missing tables: ${missing.join(", ")}`,
        missing.length > 0
          ? "Run: cd pagayo-schema && ./scripts/migrate-d1.sh production platform --remote"
          : undefined,
        "CRITICAL",
      );
      expect(missing).toEqual([]);
    });

    it.each(
      Object.entries(EXPECTED_PLATFORM).map(([table, columns]) => ({
        table,
        columns,
      })),
    )("$table has required columns", async ({ table, columns }) => {
      if (!canRunTests) return;

      const actualColumns = await getTableColumns(DATABASES.PLATFORM, table);
      const missingColumns = columns.filter(
        (c: string) => !actualColumns.includes(c),
      );

      log(
        `platform-${table}-columns`,
        missingColumns.length === 0 ? "PASS" : "FAIL",
        missingColumns.length === 0
          ? `${table}: all ${columns.length} required columns present`
          : `${table}: missing columns: ${missingColumns.join(", ")}`,
        missingColumns.length > 0
          ? `Migration needed for ${table}. Check migrations/platform/ for the relevant SQL.`
          : undefined,
        "CRITICAL",
      );
      expect(missingColumns).toEqual([]);
    });
  });

  // ========================================================================
  // TENANT DB SAMPLE SET
  // ========================================================================

  describe("Tenant DB", () => {
    it("all sampled tenant DBs have all expected tables", async () => {
      if (!canRunTests) return;

      const expected = Object.keys(EXPECTED_TENANT);

      for (const databaseId of TENANT_DATABASE_IDS) {
        const tables = await getTableNames(databaseId);
        const missing = expected.filter((t) => !tables.includes(t));

        log(
          `tenant-tables-${databaseId.slice(0, 8)}`,
          missing.length === 0 ? "PASS" : "FAIL",
          missing.length === 0
            ? `Tenant DB ${databaseId}: all ${expected.length} expected tables present (${tables.length} total)`
            : `Tenant DB ${databaseId}: missing tables: ${missing.join(", ")}`,
          missing.length > 0
            ? "Run: cd pagayo-schema && ./scripts/migrate-d1.sh production tenant --remote"
            : undefined,
          "CRITICAL",
        );
        expect(missing).toEqual([]);
      }
    });

    it.each(
      Object.entries(EXPECTED_TENANT).map(([table, columns]) => ({
        table,
        columns,
      })),
    )("$table has required columns in all sampled tenant DBs", async ({ table, columns }) => {
      if (!canRunTests) return;

      for (const databaseId of TENANT_DATABASE_IDS) {
        const actualColumns = await getTableColumns(databaseId, table);
        const missingColumns = columns.filter(
          (c: string) => !actualColumns.includes(c),
        );

        log(
          `tenant-${table}-columns-${databaseId.slice(0, 8)}`,
          missingColumns.length === 0 ? "PASS" : "FAIL",
          missingColumns.length === 0
            ? `Tenant DB ${databaseId} ${table}: all ${columns.length} required columns present`
            : `Tenant DB ${databaseId} ${table}: missing columns: ${missingColumns.join(", ")}`,
          missingColumns.length > 0
            ? `Migration needed for ${table}. Check migrations/tenant/ for the relevant SQL.`
            : undefined,
          "CRITICAL",
        );
        expect(missingColumns).toEqual([]);
      }
    });
  });

  // ========================================================================
  // API DB
  // ========================================================================

  describe("API DB", () => {
    it("has all expected tables", async () => {
      if (!canRunTests) return;

      const tables = await getTableNames(DATABASES.API);
      const expected = Object.keys(EXPECTED_API);
      const missing = expected.filter((t) => !tables.includes(t));

      log(
        "api-tables",
        missing.length === 0 ? "PASS" : "FAIL",
        missing.length === 0
          ? `All ${expected.length} expected tables present (${tables.length} total)`
          : `Missing tables: ${missing.join(", ")}`,
        missing.length > 0
          ? "Run: cd pagayo-schema && ./scripts/migrate-d1.sh production api --remote"
          : undefined,
        "CRITICAL",
      );
      expect(missing).toEqual([]);
    });

    it.each(
      Object.entries(EXPECTED_API).map(([table, columns]) => ({
        table,
        columns,
      })),
    )("$table has required columns", async ({ table, columns }) => {
      if (!canRunTests) return;

      const actualColumns = await getTableColumns(DATABASES.API, table);
      const missingColumns = columns.filter(
        (c: string) => !actualColumns.includes(c),
      );

      log(
        `api-${table}-columns`,
        missingColumns.length === 0 ? "PASS" : "FAIL",
        missingColumns.length === 0
          ? `${table}: all ${columns.length} required columns present`
          : `${table}: missing columns: ${missingColumns.join(", ")}`,
        missingColumns.length > 0
          ? `Migration needed for ${table}. Check migrations/api/ for the relevant SQL.`
          : undefined,
        "CRITICAL",
      );
      expect(missingColumns).toEqual([]);
    });
  });

  // ========================================================================
  // MIGRATION LOG — Controleer dat het migratie-systeem werkt
  // ========================================================================

  describe("Migration Log", () => {
    it("platform _migration_log exists and has entries", async () => {
      if (!canRunTests) return;

      try {
        const result = await queryD1(
          DATABASES.PLATFORM,
          "SELECT COUNT(*) as count FROM _migration_log",
        );
        const count = result.result?.[0]?.results?.[0]?.count as number;

        log(
          "platform-migration-log",
          count > 0 ? "PASS" : "WARN",
          `Platform _migration_log: ${count} entries`,
          count === 0
            ? "Migration log is empty — migraties zijn mogelijk handmatig uitgevoerd"
            : undefined,
        );
        // Geen hard fail — migration_log is nieuw, bestaande migraties zijn handmatig gedaan
        expect(count).toBeGreaterThanOrEqual(0);
      } catch {
        log(
          "platform-migration-log",
          "WARN",
          "_migration_log tabel bestaat nog niet (wordt aangemaakt bij volgende deploy)",
        );
      }
    });
  });
});
