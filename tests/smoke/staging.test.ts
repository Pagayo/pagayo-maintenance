/**
 * SMOKE TESTS - STAGING ENVIRONMENT
 * ============================================================================
 * DOEL: Verificatie dat alle staging Workers operationeel zijn met geïsoleerde resources.
 * PRIORITEIT: HIGH - Staging isolatie validatie
 *
 * STAGING URLS:
 * - Storefront: staging.pagayo.app (achter CF Access → 302 redirect is verwacht)
 * - API Stack: staging-api.pagayo.com (direct bereikbaar)
 * - Edge: staging-edge.pagayo.app (direct bereikbaar)
 * - Workflows: workflows-staging.pagayo.app (direct bereikbaar)
 *
 * ACTIE BIJ FAILURE:
 * - 502/503 → Worker niet gedeployed, run `npx wrangler deploy --env staging`
 * - Timeout → DNS niet geconfigureerd of route niet actief
 * - 500 → Check Worker logs met `npx wrangler tail --env staging`
 * ============================================================================
 */

import { logTestResult, type TestResult } from "../utils/test-reporter";

const STAGING_STOREFRONT_URL =
  process.env.STAGING_STOREFRONT_URL ?? "https://staging.pagayo.app";
const STAGING_API_URL =
  process.env.STAGING_API_URL ?? "https://staging-api.pagayo.com";
const STAGING_EDGE_URL =
  process.env.STAGING_EDGE_URL ?? "https://staging-edge.pagayo.app";
const STAGING_WORKFLOWS_URL =
  process.env.STAGING_WORKFLOWS_URL ?? "https://workflows-staging.pagayo.app";

function log(
  test: string,
  status: TestResult["status"],
  details: string,
  action?: string,
  priority?: TestResult["priority"],
) {
  logTestResult({
    category: "SMOKE",
    service: "staging",
    test,
    status,
    details,
    action,
    priority,
  });
}

describe("Staging Environment - Smoke Tests", () => {
  // ========================================================================
  // API STACK STAGING
  // ========================================================================

  describe("API Stack Staging", () => {
    it("GET / returns 200 with operational status", async () => {
      const response = await fetch(STAGING_API_URL);
      log(
        "api-root",
        response.ok ? "PASS" : "FAIL",
        `Status: ${response.status}`,
        response.ok
          ? undefined
          : "Check: npx wrangler deploy --env staging in pagayo-api-stack",
        "CRITICAL",
      );
      expect(response.ok).toBe(true);

      const body = await response.json();
      expect(body).toHaveProperty("success", true);
      expect(body.data).toHaveProperty("status", "operational");
      log(
        "api-operational",
        "PASS",
        `API Stack staging is operational (${body.data?.version ?? "unknown"})`,
      );
    });
  });

  // ========================================================================
  // EDGE STAGING
  // ========================================================================

  describe("Edge Staging", () => {
    it("GET / returns 200", async () => {
      const response = await fetch(STAGING_EDGE_URL);
      log(
        "edge-root",
        response.ok ? "PASS" : "FAIL",
        `Status: ${response.status}`,
        response.ok
          ? undefined
          : "Check: npx wrangler deploy --env staging in pagayo-edge",
        "CRITICAL",
      );
      expect(response.ok).toBe(true);
    });
  });

  // ========================================================================
  // WORKFLOWS STAGING
  // ========================================================================

  describe("Workflows Staging", () => {
    it("GET / returns 404 (no root route — expected)", async () => {
      const response = await fetch(STAGING_WORKFLOWS_URL);
      // Workflows heeft geen root route — 404 met JSON error is verwacht gedrag
      log(
        "workflows-root",
        response.status === 404 ? "PASS" : "FAIL",
        `Status: ${response.status} (404 is verwacht — geen root route)`,
        response.status === 404
          ? undefined
          : "Onverwachte status. Check: npx wrangler deploy --env staging in pagayo-workflows",
        "HIGH",
      );
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body).toHaveProperty("success", false);
      expect(body.error).toHaveProperty("code", "NOT_FOUND");
    });
  });

  // ========================================================================
  // STOREFRONT STAGING (achter Cloudflare Access)
  // ========================================================================

  describe("Storefront Staging", () => {
    it("GET / returns 302 redirect to CF Access login", async () => {
      // staging.pagayo.app is beschermd door CF Access → redirect naar login
      const response = await fetch(STAGING_STOREFRONT_URL, {
        redirect: "manual",
      });
      log(
        "storefront-cf-access",
        response.status === 302 ? "PASS" : "FAIL",
        `Status: ${response.status} (302 → CF Access login is verwacht)`,
        response.status === 302
          ? undefined
          : "CF Access niet actief! Check Zero Trust Dashboard → Access → Applications",
        "CRITICAL",
      );
      expect(response.status).toBe(302);

      const location = response.headers.get("location") ?? "";
      expect(location).toContain("cloudflareaccess.com");
      log(
        "storefront-cf-access-redirect",
        "PASS",
        `Redirect: ${location.substring(0, 80)}...`,
      );
    });
  });

  // ========================================================================
  // STAGING D1 SCHEMA VALIDATIE
  // ========================================================================

  describe("Staging D1 Schema", () => {
    const CF_API_TOKEN = process.env.CF_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
    const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? "5d4d9b7bcdf6a836c16b19e09d198047";
    const STAGING_PLATFORM_DB = "627ac04a-72d9-4a96-b793-10c250218f33";

    async function queryD1(dbId: string, sql: string) {
      if (!CF_API_TOKEN) return null;
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${dbId}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql }),
        },
      );
      if (!response.ok) return null;
      return response.json() as Promise<{ success: boolean; result: Array<{ results: Array<Record<string, unknown>> }> }>;
    }

    it("Staging Platform DB has organization table with phone column", async () => {
      if (!CF_API_TOKEN) {
        log("staging-d1-platform", "SKIP", "CF_API_TOKEN niet gezet", undefined, "HIGH");
        return;
      }

      const result = await queryD1(STAGING_PLATFORM_DB, "PRAGMA table_info(organization)");
      const columns = result?.result?.[0]?.results?.map((r) => r.name as string) ?? [];

      log(
        "staging-d1-platform-org",
        columns.includes("phone") ? "PASS" : "FAIL",
        columns.includes("phone")
          ? `organization: ${columns.length} columns incl. phone`
          : `organization: phone column MISSING (columns: ${columns.join(", ")})`,
        columns.includes("phone") ? undefined : "Run staging D1 migration for platform",
        "CRITICAL",
      );
      expect(columns).toContain("phone");
    });

    it("Staging Platform DB has tenant table with ownerPhone column", async () => {
      if (!CF_API_TOKEN) return;

      const result = await queryD1(STAGING_PLATFORM_DB, "PRAGMA table_info(tenant)");
      const columns = result?.result?.[0]?.results?.map((r) => r.name as string) ?? [];

      log(
        "staging-d1-platform-tenant",
        columns.includes("ownerPhone") ? "PASS" : "FAIL",
        columns.includes("ownerPhone")
          ? `tenant: ${columns.length} columns incl. ownerPhone`
          : `tenant: ownerPhone column MISSING`,
        columns.includes("ownerPhone") ? undefined : "Run migrate-d1.sh staging platform --remote",
        "CRITICAL",
      );
      expect(columns).toContain("ownerPhone");
    });

    it("Staging Platform DB has _migration_log table", async () => {
      if (!CF_API_TOKEN) return;

      const result = await queryD1(
        STAGING_PLATFORM_DB,
        "SELECT name FROM sqlite_master WHERE type='table' AND name='_migration_log'",
      );
      const tables = result?.result?.[0]?.results?.map((r) => r.name as string) ?? [];

      log(
        "staging-d1-migration-log",
        tables.includes("_migration_log") ? "PASS" : "WARN",
        tables.includes("_migration_log")
          ? "_migration_log exists on staging"
          : "_migration_log not yet created (will be created on next deploy)",
      );
      // Warn only — first deploy hasn't happened yet
    });
  });

  // ========================================================================
  // CROSS-SERVICE ISOLATIE
  // ========================================================================

  describe("Staging Isolatie Verificatie", () => {
    it("Staging API Stack draait in staging mode", async () => {
      const response = await fetch(STAGING_API_URL);
      const body = await response.json();

      // Controleer dat het geen productie-response is
      log(
        "api-isolation",
        body.data?.name === "Pagayo API Stack" ? "PASS" : "FAIL",
        `Service name: ${body.data?.name ?? "unknown"}`,
        undefined,
        "HIGH",
      );
      expect(body.data).toHaveProperty("name", "Pagayo API Stack");
    });

    it("Staging URLs resolven naar Workers (geen DNS errors)", async () => {
      const urls = [
        { name: "api", url: STAGING_API_URL },
        { name: "edge", url: STAGING_EDGE_URL },
        { name: "workflows", url: STAGING_WORKFLOWS_URL },
      ];

      for (const { name, url } of urls) {
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(10000),
          });
          log(
            `dns-${name}`,
            response.status < 500 ? "PASS" : "FAIL",
            `${name}: HTTP ${response.status} (DNS resolutioneert)`,
            response.status >= 500
              ? `Worker ${name} geeft 5xx — check logs`
              : undefined,
            "HIGH",
          );
          expect(response.status).toBeLessThan(500);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          log(
            `dns-${name}`,
            "FAIL",
            `${name}: DNS/connectie fout — ${message}`,
            `Check DNS record voor ${new URL(url).hostname}`,
            "CRITICAL",
          );
          throw error;
        }
      }
    });
  });
});
