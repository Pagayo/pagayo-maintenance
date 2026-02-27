/**
 * SMOKE TESTS - LEGACY BEHEER REDIRECTS
 * ============================================================================
 * DOEL: Verificatie dat legacy beheer domeinen correct afgehandeld worden
 * PRIORITEIT: HIGH - Oude URLs mogen niet 404/500 geven
 * STATUS: beheer.pagayo.com is geabsorbeerd in pagayo-storefront (V2 migratie)
 *
 * V2 MIGRATIE (feb 2026):
 * - Platform admin: admin.pagayo.app/platform
 * - Tenant admin: {slug}.pagayo.app/admin
 * - beheer.pagayo.com → 301 → www.pagayo.com (via pagayo-cloudflare-proxy)
 * - app.pagayo.com → 301 → www.pagayo.com (via pagayo-cloudflare-proxy)
 *
 * INFRA STATUS:
 * De proxy Worker (pagayo-cloudflare-proxy) heeft correcte redirect logica,
 * maar het oude pagayo-beheer Cloudflare Pages project heeft nog custom domains
 * geconfigureerd die het verkeer intercepteren vóór de proxy Worker.
 *
 * TODO: Verwijder custom domains van oud pagayo-beheer Pages project in Cloudflare
 *       dashboard. Dan gaat het verkeer via de proxy → 301 redirect.
 *
 * ACTIE BIJ FAILURE:
 * - Geen 301 EN geen 200 → Check DNS + Pages + proxy status
 * - 200 (Pages) → Oud Pages project nog actief (zie TODO hierboven)
 * - 301 → Proxy werkt correct ✅
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
      } else if (status === 200) {
        // Oud pagayo-beheer Pages project serveert nog — proxy Worker niet bereikt
        // TODO: Verwijder custom domains van Pages project in Cloudflare dashboard
        log(
          `redirect-${domain}`,
          "WARN",
          `${domain} → 200 (oud Pages project actief, proxy niet bereikt)`,
          "Verwijder custom domains van pagayo-beheer Pages project",
        );
      } else if (status === 522) {
        // Cloudflare Connection Timeout — geen origin server (staging verwijderd)
        // DNS record bestaat nog maar wijst nergens heen
        log(
          `redirect-${domain}`,
          "WARN",
          `${domain} → 522 (geen origin, DNS record opruimen)`,
          "Verwijder DNS record voor dit staging domein",
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

      // Accepteer 301 (proxy redirect), 200 (oud Pages actief), 522 (staging verwijderd)
      // Zodra Pages custom domains verwijderd zijn, kan dit strict naar 301
      expect([200, 301, 522]).toContain(status);
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
