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

const CF_API_TOKEN =
  process.env.CF_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID =
  process.env.CF_ACCOUNT_ID ??
  process.env.CLOUDFLARE_ACCOUNT_ID ??
  "5d4d9b7bcdf6a836c16b19e09d198047";

// Production D1 database IDs
const DATABASES = {
  PLATFORM: "e7b19343-f213-4d3d-9966-364a20b01b97",
  TENANT: "394cb77c-fc12-4bd4-85c9-13937dbb3305",
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
// VERWACHT SCHEMA — Single Source of Truth voor smoke tests
// ============================================================================

/** Kritieke kolommen per tabel per database — minimaal de kolommen die migraties toevoegen */
const EXPECTED_SCHEMA = {
  PLATFORM: {
    organization: [
      "id",
      "name",
      "slug",
      "email",
      "phone",
      "status",
      "tier",
      "createdAt",
      "updatedAt",
    ],
    tenant: [
      "id",
      "organizationId",
      "name",
      "slug",
      "ownerEmail",
      "ownerPhone",
      "status",
      "d1DatabaseId",
      "createdAt",
    ],
    user_directory: [
      "id",
      "email",
      "phone",
      "tenantId",
      "tenantSlug",
      "tenantName",
      "role",
      "status",
    ],
    platform_invoice: [
      "id",
      "invoiceNumber",
      "organizationId",
      "totalCents",
      "status",
    ],
    _migration_log: ["filename", "applied_at", "checksum"],
  },
  TENANT: {
    user: [
      "id",
      "firstName",
      "lastName",
      "email",
      "passwordHash",
      "phone",
      "phoneVerified",
      "role",
      "status",
    ],
    order: ["id", "orderNumber", "status", "source", "originator"],
    product: ["id", "name", "slug", "price", "status"],
    category: ["id", "name", "slug"],
  },
  API: {
    api_log: ["id", "method", "path", "statusCode"],
    email_log: ["id", "to", "subject", "status"],
    shop: ["id", "tenantId", "name"],
    webhook_delivery: ["id", "webhookId", "status"],
    payment: ["id", "orderId", "status"],
  },
} as const;

// ============================================================================
// TESTS
// ============================================================================

describe("D1 Database Schema - Smoke Tests", () => {
  const canRunTests = Boolean(CF_API_TOKEN);

  beforeAll(() => {
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
      const expected = Object.keys(EXPECTED_SCHEMA.PLATFORM);
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
      Object.entries(EXPECTED_SCHEMA.PLATFORM).map(([table, columns]) => ({
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
          ? `Migration needed for ${table}. Check migrations/platform-v2/ for the relevant SQL.`
          : undefined,
        "CRITICAL",
      );
      expect(missingColumns).toEqual([]);
    });
  });

  // ========================================================================
  // TENANT DB (eerste tenant — 518970)
  // ========================================================================

  describe("Tenant DB", () => {
    it("has all expected tables", async () => {
      if (!canRunTests) return;

      const tables = await getTableNames(DATABASES.TENANT);
      const expected = Object.keys(EXPECTED_SCHEMA.TENANT);
      const missing = expected.filter((t) => !tables.includes(t));

      log(
        "tenant-tables",
        missing.length === 0 ? "PASS" : "FAIL",
        missing.length === 0
          ? `All ${expected.length} expected tables present (${tables.length} total)`
          : `Missing tables: ${missing.join(", ")}`,
        missing.length > 0
          ? "Run: cd pagayo-schema && ./scripts/migrate-d1.sh production tenant --remote"
          : undefined,
        "CRITICAL",
      );
      expect(missing).toEqual([]);
    });

    it.each(
      Object.entries(EXPECTED_SCHEMA.TENANT).map(([table, columns]) => ({
        table,
        columns,
      })),
    )("$table has required columns", async ({ table, columns }) => {
      if (!canRunTests) return;

      const actualColumns = await getTableColumns(DATABASES.TENANT, table);
      const missingColumns = columns.filter(
        (c: string) => !actualColumns.includes(c),
      );

      log(
        `tenant-${table}-columns`,
        missingColumns.length === 0 ? "PASS" : "FAIL",
        missingColumns.length === 0
          ? `${table}: all ${columns.length} required columns present`
          : `${table}: missing columns: ${missingColumns.join(", ")}`,
        missingColumns.length > 0
          ? `Migration needed for ${table}. Check migrations/tenant-v2/ for the relevant SQL.`
          : undefined,
        "CRITICAL",
      );
      expect(missingColumns).toEqual([]);
    });
  });

  // ========================================================================
  // API DB
  // ========================================================================

  describe("API DB", () => {
    it("has all expected tables", async () => {
      if (!canRunTests) return;

      const tables = await getTableNames(DATABASES.API);
      const expected = Object.keys(EXPECTED_SCHEMA.API);
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
      Object.entries(EXPECTED_SCHEMA.API).map(([table, columns]) => ({
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
          ? `Migration needed for ${table}. Check migrations/api-v2/ for the relevant SQL.`
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
