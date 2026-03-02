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
