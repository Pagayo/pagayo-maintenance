/**
 * SMOKE TESTS - LEGACY BEHEER REDIRECTS
 * ============================================================================
 * DOEL: Verificatie dat legacy beheer domeinen correct redirecten
 * PRIORITEIT: HIGH - Oude URLs mogen niet 404/500 geven
 * STATUS: beheer.pagayo.com is geabsorbeerd in pagayo-storefront (V2 migratie)
 *
 * V2 MIGRATIE (feb 2026):
 * - Platform admin: admin.pagayo.app/platform
 * - Tenant admin: {slug}.pagayo.app/admin
 * - beheer.pagayo.com → 301 → www.pagayo.com (via pagayo-cloudflare-proxy)
 * - app.pagayo.com → 301 → www.pagayo.com (via pagayo-cloudflare-proxy)
 *
 * ACTIE BIJ FAILURE:
 * - Geen 301 → Check pagayo-cloudflare-proxy Worker deployment
 * - Geen redirect naar www.pagayo.com → Check LEGACY_REDIRECT_HOSTS in proxy
 * - Timeout → Check DNS records in Cloudflare
 * ============================================================================
 */

import { logTestResult, type TestResult } from "../utils/test-reporter";

const LEGACY_DOMAINS = [
  "beheer.pagayo.com",
  "app.pagayo.com",
  "staging-beheer.pagayo.com",
];

function log(
  test: string,
  status: TestResult["status"],
  details: string,
  action?: string,
  priority?: TestResult["priority"],
) {
  logTestResult({
    category: "SMOKE",
    service: "beheer-legacy",
    test,
    status,
    details,
    action,
    priority,
  });
}

describe("Legacy Beheer Domains - Redirect Verification", () => {
  test.each(LEGACY_DOMAINS)(
    "%s redirects to www.pagayo.com (301)",
    async (domain) => {
      const response = await fetch(`https://${domain}`, {
        redirect: "manual",
      });

      const location = response.headers.get("location");
      const status = response.status;

      if (status === 301 && location === "https://www.pagayo.com") {
        log(
          `redirect-${domain}`,
          "PASS",
          `${domain} → 301 → www.pagayo.com`,
        );
      } else {
        log(
          `redirect-${domain}`,
          "FAIL",
          `Expected 301 → www.pagayo.com, got ${status} → ${location ?? "no location"}`,
          "Check pagayo-cloudflare-proxy LEGACY_REDIRECT_HOSTS",
          "HIGH",
        );
      }

      expect(status).toBe(301);
      expect(location).toBe("https://www.pagayo.com");
    },
  );
});

describe("Legacy Beheer API Routes - Redirect Verification", () => {
  const legacyApiPaths = ["/api/health", "/api/auth/register", "/api/tenants"];

  test.each(legacyApiPaths)(
    "beheer.pagayo.com%s redirects (not 500)",
    async (path) => {
      const response = await fetch(`https://beheer.pagayo.com${path}`, {
        redirect: "manual",
      });

      const status = response.status;

      // Na Worker-verwijdering: proxy vangt alles op met 301
      // Zolang Worker nog actief: kan 200/401/403 retourneren (ook acceptabel)
      if (status === 301) {
        log(
          `api-redirect-${path}`,
          "PASS",
          `beheer.pagayo.com${path} → 301 (proxy redirect)`,
        );
      } else if (status < 500) {
        log(
          `api-redirect-${path}`,
          "WARN",
          `beheer.pagayo.com${path} → ${status} (Worker nog actief?)`,
          "Verwacht 301 na Worker-verwijdering",
        );
      } else {
        log(
          `api-redirect-${path}`,
          "FAIL",
          `beheer.pagayo.com${path} → ${status}`,
          "Server error — check Worker/proxy status",
          "HIGH",
        );
      }

      // Mag geen 500+ zijn
      expect(status).toBeLessThan(500);
    },
  );
});
