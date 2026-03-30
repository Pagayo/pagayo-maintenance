/**
 * SMOKE TESTS - MARKETING WEBSITE
 * ============================================================================
 * DOEL: Verificatie dat www.pagayo.com operationeel is
 * PRIORITEIT: HIGH - Publiek gezicht van Pagayo
 * SERVICE: www.pagayo.com (Cloudflare Pages)
 *
 * ACTIE BIJ FAILURE:
 * - 404 op pages → Check Cloudflare Pages deployment
 * - Redirect issues → Check CF DNS / Page Rules
 * - Missing sitemap/robots → Rebuild Astro site
 * ============================================================================
 */

import { logTestResult, type TestResult } from "../utils/test-reporter";

const MARKETING_URL = "https://www.pagayo.com";

function log(
  test: string,
  status: TestResult["status"],
  details: string,
  action?: string,
  priority?: TestResult["priority"],
) {
  logTestResult({
    category: "SMOKE",
    service: "marketing",
    test,
    status,
    details,
    action,
    priority,
  });
}

describe("Marketing Website - Smoke Tests", () => {
  describe("Core Pages", () => {
    it("Homepage returns 200", async () => {
      const response = await fetch(MARKETING_URL);

      if (response.status === 200) {
        log("homepage", "PASS", "Homepage accessible");
      } else {
        log(
          "homepage",
          "FAIL",
          `HTTP ${response.status}`,
          "Check Cloudflare Pages deployment",
          "CRITICAL",
        );
      }

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    // NOTE: /nl, /nl/prijzen, /nl/over-ons verwijderd uit tests — marketing site
    // is omgebouwd naar single-page portal. Oude i18n routes bestaan niet meer.
  });

  describe("SEO & Performance", () => {
    it("robots.txt exists", async () => {
      const response = await fetch(`${MARKETING_URL}/robots.txt`);

      if (response.status === 200) {
        log("robots", "PASS", "robots.txt exists");
      } else {
        log(
          "robots",
          "FAIL",
          `HTTP ${response.status}`,
          "Add robots.txt to Astro public/",
          "MEDIUM",
        );
      }

      expect(response.status).toBe(200);
    });

    it("sitemap exists", async () => {
      // Astro genereert sitemap-index.xml (zie robots.txt)
      const indexResp = await fetch(`${MARKETING_URL}/sitemap-index.xml`);
      const xmlResp = await fetch(`${MARKETING_URL}/sitemap.xml`);

      const found =
        [200, 301, 302].includes(indexResp.status) ||
        [200, 301, 302].includes(xmlResp.status);

      if (found) {
        log(
          "sitemap",
          "PASS",
          `Sitemap gevonden (index: ${indexResp.status}, xml: ${xmlResp.status})`,
        );
      } else {
        log(
          "sitemap",
          "WARN",
          `Geen sitemap gevonden (index: ${indexResp.status}, xml: ${xmlResp.status})`,
          "Check sitemap generation in Astro config",
        );
      }

      expect(found).toBe(true);
    });

    it("Cache headers present", async () => {
      const response = await fetch(MARKETING_URL);
      const cacheControl = response.headers.get("cache-control");
      const cfCacheStatus = response.headers.get("cf-cache-status");
      const hasCache = !!(cacheControl || cfCacheStatus);

      if (hasCache) {
        log(
          "cache",
          "PASS",
          `Cache-Control: ${cacheControl ?? "none"}, CF-Cache: ${cfCacheStatus ?? "none"}`,
        );
      } else {
        log(
          "cache",
          "WARN",
          "No cache headers detected",
          "Configure cache in Cloudflare Pages",
        );
      }

      // Cloudflare Pages SSR kan zonder cache-control header draaien,
      // maar CF-Cache-Status of cache-control zou aanwezig moeten zijn
      expect(hasCache).toBe(true);
    });
  });

  describe("Redirects", () => {
    it("pagayo.com redirects or serves correctly", async () => {
      const response = await fetch("https://pagayo.com", {
        redirect: "manual",
      });

      if ([200, 301, 302, 308].includes(response.status)) {
        log("apex-redirect", "PASS", `HTTP ${response.status}`);
      } else {
        log(
          "apex-redirect",
          "FAIL",
          `HTTP ${response.status}`,
          "Check CF DNS for apex domain",
          "MEDIUM",
        );
      }

      expect([200, 301, 302, 308]).toContain(response.status);
    });
  });

  describe("Registration Links", () => {
    it("start.pagayo.app/register works", async () => {
      const response = await fetch("https://start.pagayo.app/register", {
        redirect: "manual",
      });
      const ok = [200, 301, 302, 307, 308].includes(response.status);

      if (ok) {
        log("register-link", "PASS", `HTTP ${response.status}`);
      } else {
        log(
          "register-link",
          "FAIL",
          `HTTP ${response.status}`,
          "Check start.pagayo.app onboarding deployment",
          "CRITICAL",
        );
      }

      expect(ok).toBe(true);
    });
  });
});
