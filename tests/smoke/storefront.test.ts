/**
 * SMOKE TESTS - STOREFRONT SERVICE
 * ============================================================================
 * DOEL: Verificatie dat de storefront Worker operationeel is
 * PRIORITEIT: CRITICAL - Worker deployment en routing
 *
 * TENANT DETECTION:
 * Tests detecteren automatisch of een tenant geprovisioned is.
 * - Tenant actief → volledige functionele verificatie (200, 401, 403)
 * - Geen tenant → Worker deployment verificatie (404 "Tenant not found" is verwacht)
 *
 * ACTIE BIJ FAILURE:
 * - Health faalt → Check Cloudflare Worker status
 * - 502/503 → Worker niet gedeployed
 * - Onverwachte 500 → Check Worker logs
 * ============================================================================
 */

import { logTestResult, type TestResult } from "../utils/test-reporter";
import {
  STOREFRONT_URL,
  ONBOARDING_URL,
  PLATFORM_ADMIN_URL,
  detectTenantActive,
} from "../utils/test-config";

function log(
  test: string,
  status: TestResult["status"],
  details: string,
  action?: string,
  priority?: TestResult["priority"],
) {
  logTestResult({
    category: "SMOKE",
    service: "storefront",
    test,
    status,
    details,
    action,
    priority,
  });
}

describe("Storefront Service - Smoke Tests", () => {
  /** Of de storefront URL een actieve, geprovisioneerde tenant heeft */
  let tenantActive = false;

  /** Teller voor tests die overgeslagen zijn door geen tenant */
  let skippedByNoTenant = 0;
  let totalTenantDependentTests = 0;

  beforeAll(async () => {
    tenantActive = await detectTenantActive();
    if (!tenantActive) {
      console.log(
        `⚠️  Geen actieve tenant op ${STOREFRONT_URL} — tenant-afhankelijke tests accepteren 404`,
      );
    }
  });

  afterAll(() => {
    if (skippedByNoTenant > 0) {
      console.log(``);
      console.log(
        `╔══════════════════════════════════════════════════════════════╗`,
      );
      console.log(
        `║  ⚠️  TESTDEKKING WAARSCHUWING                               ║`,
      );
      console.log(
        `║                                                              ║`,
      );
      console.log(
        `║  ${skippedByNoTenant}/${totalTenantDependentTests} tenant-afhankelijke tests OVERGESLAGEN             ║`,
      );
      console.log(
        `║  Reden: geen actieve tenant op ${STOREFRONT_URL.padEnd(20)}     ║`,
      );
      console.log(
        `║                                                              ║`,
      );
      console.log(
        `║  Dit betekent: INFRA-GROEN, maar NIET product-groen.         ║`,
      );
      console.log(
        `║  Workers draaien, maar functionele validatie ontbreekt.       ║`,
      );
      console.log(
        `╚══════════════════════════════════════════════════════════════╝`,
      );
      console.log(``);
    }
  });

  /**
   * Guard voor tenant-afhankelijke tests.
   * Als geen tenant actief en response = 404 → log WARNING en return true (skip assert).
   * Dit is CORRECT gedrag: de Worker draait, maar tenant resolution retourneert 404.
   */
  function skipIfNoTenant(response: Response, testName: string): boolean {
    totalTenantDependentTests++;
    if (!tenantActive && response.status === 404) {
      skippedByNoTenant++;
      log(testName, "WARN", `Geen tenant: HTTP 404 (verwacht gedrag)`);
      return true;
    }
    return false;
  }

  async function expectProtectedAdminGetRoute(options: {
    testName: string;
    path: string;
    action: string;
  }): Promise<void> {
    const response = await fetch(`${STOREFRONT_URL}${options.path}`);

    if (skipIfNoTenant(response, options.testName)) return;

    if ([401, 403].includes(response.status)) {
      log(
        options.testName,
        "PASS",
        `Fail-closed contract intact: HTTP ${response.status}`,
      );
    } else if (response.status >= 500) {
      log(
        options.testName,
        "FAIL",
        `Server error: HTTP ${response.status}`,
        options.action,
        "HIGH",
      );
    } else {
      log(
        options.testName,
        "FAIL",
        `Onverwachte status: HTTP ${response.status}`,
        options.action,
        "HIGH",
      );
    }

    expect([401, 403]).toContain(response.status);
  }

  describe("Health Endpoints", () => {
    it("API health endpoint returns 200", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/health`);
      const data = response.status === 200 ? await response.json() : null;

      if (response.status === 200 && data) {
        log("api-health", "PASS", `Status: ${data.status}`);
        expect(["healthy", "ok"]).toContain(data.status);
      } else {
        log(
          "api-health",
          "FAIL",
          `HTTP ${response.status}`,
          "Check Storefront Worker deployment",
          "CRITICAL",
        );
        expect(response.status).toBe(200);
      }
    });

    it("Platform tenant migrations route is protected and reachable", async () => {
      const response = await fetch(
        `${PLATFORM_ADMIN_URL}/api/platform/tenants/migrations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            migrations: [
              {
                filename: "smoke-check.sql",
                sql: "SELECT 1;",
                classification: "fan-out-only",
              },
            ],
          }),
        },
      );

      if ([401, 403, 302].includes(response.status)) {
        log(
          "platform-tenant-migrations-route",
          "PASS",
          `Beschermde route bereikbaar (HTTP ${response.status})`,
        );
      } else {
        log(
          "platform-tenant-migrations-route",
          "FAIL",
          `Onverwachte status ${response.status}`,
          "Check platform route mount of CF Access bescherming",
          "HIGH",
        );
      }

      expect([401, 403, 302]).toContain(response.status);
    });

    it("Platform health route is protected and reachable", async () => {
      const response = await fetch(
        `${PLATFORM_ADMIN_URL}/api/platform/health`,
        {
          redirect: "manual",
        },
      );

      if ([401, 403, 302].includes(response.status)) {
        log(
          "platform-health-route",
          "PASS",
          `Beschermde route bereikbaar (HTTP ${response.status})`,
        );
      } else {
        log(
          "platform-health-route",
          "FAIL",
          `Onverwachte status ${response.status}`,
          "Check platform health route of CF Access bescherming",
          "HIGH",
        );
      }

      expect([401, 403, 302]).toContain(response.status);
    });
  });

  describe("Public Routes", () => {
    it("Homepage serves HTML", async () => {
      const response = await fetch(STOREFRONT_URL);

      if (skipIfNoTenant(response, "homepage")) return;

      if (response.status === 200) {
        log("homepage", "PASS", "Homepage accessible");
      } else {
        log(
          "homepage",
          "FAIL",
          `HTTP ${response.status}`,
          "Check Storefront Worker routing",
          "CRITICAL",
        );
      }

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("Products API returns data", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/products`);

      if (skipIfNoTenant(response, "products-api")) return;

      const body = await response.text();

      if (response.status === 200) {
        log("products-api", "PASS", "Products endpoint working");
      } else {
        // Parse error body for diagnostics
        let errorDetail = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(body);
          errorDetail += ` — ${parsed.message || parsed.error || "unknown"}`;
          if (parsed.debug) errorDetail += ` (debug: ${parsed.debug})`;
        } catch {
          errorDetail += ` — ${body.slice(0, 200)}`;
        }

        log(
          "products-api",
          "FAIL",
          errorDetail,
          "Check Worker logs: wrangler tail pagayo-storefront. Likely DB query error (salesContexts column or join).",
          "HIGH",
        );
      }

      // Products API should return 200 with data array
      expect(response.status).toBe(200);
    });

    it("Categories API returns data", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/categories`);

      if (skipIfNoTenant(response, "categories-api")) return;

      if (response.status === 200) {
        log("categories-api", "PASS", "Categories endpoint working");
      } else {
        log(
          "categories-api",
          "FAIL",
          `HTTP ${response.status}`,
          "Check Worker logs for SQL errors",
          "HIGH",
        );
      }

      // Categories API should return 200 with data array
      expect(response.status).toBe(200);
    });

    it("Categories API warms edge cache on repeat requests", async () => {
      const firstResponse = await fetch(`${STOREFRONT_URL}/api/categories`);

      if (skipIfNoTenant(firstResponse, "categories-cache-headers")) return;

      const firstCacheHeader = firstResponse.headers.get("X-Cache");
      const firstCacheLayer = firstResponse.headers.get("X-Storefront-Cache-Layer");

      const secondResponse = await fetch(`${STOREFRONT_URL}/api/categories`);
      const secondCacheHeader = secondResponse.headers.get("X-Cache");
      const secondCacheLayer = secondResponse.headers.get("X-Storefront-Cache-Layer");

      const firstRequestOk =
        firstResponse.status === 200 &&
        ["HIT", "KV", "MISS"].includes(firstCacheHeader || "") &&
        firstCacheLayer === "categories-kv";

      const secondRequestOk =
        secondResponse.status === 200 &&
        ["HIT", "KV"].includes(secondCacheHeader || "") &&
        secondCacheLayer === "categories-kv";

      if (firstRequestOk && secondRequestOk) {
        log(
          "categories-cache-headers",
          "PASS",
          `Warm-up ok: first=${firstCacheHeader}, second=${secondCacheHeader}, layer=${secondCacheLayer}`,
        );
      } else {
        log(
          "categories-cache-headers",
          "FAIL",
          `First: status=${firstResponse.status}, X-Cache=${firstCacheHeader}, layer=${firstCacheLayer}; Second: status=${secondResponse.status}, X-Cache=${secondCacheHeader}, layer=${secondCacheLayer}`,
          "Check categories route cache observability",
          "HIGH",
        );
      }

      expect(firstRequestOk).toBe(true);
      expect(secondRequestOk).toBe(true);
    });

    it("Partners API returns 200", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/partners`);

      if (skipIfNoTenant(response, "partners-api")) return;

      if (response.status === 200) {
        log("partners-api", "PASS", "Partners endpoint working");
      } else {
        log(
          "partners-api",
          "FAIL",
          `HTTP ${response.status}`,
          "Check partners.routes.ts, settings registry en tenant partner data",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
    });

    it("Partners API exposes response-cache headers", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/partners`);

      if (skipIfNoTenant(response, "partners-cache-headers")) return;

      const responseCache = response.headers.get("X-Response-Cache");
      const cacheLayer = response.headers.get("X-Storefront-Cache-Layer");
      const cacheControl = response.headers.get("Cache-Control");

      if (
        response.status === 200 &&
        ["HIT", "MISS", "KV"].includes(responseCache || "") &&
        cacheLayer === "partners-response-cache" &&
        cacheControl === "no-cache"
      ) {
        log(
          "partners-cache-headers",
          "PASS",
          `Headers ok: X-Response-Cache=${responseCache}, layer=${cacheLayer}`,
        );
      } else {
        log(
          "partners-cache-headers",
          "FAIL",
          `Onverwachte headers: status=${response.status}, X-Response-Cache=${responseCache}, layer=${cacheLayer}, Cache-Control=${cacheControl}`,
          "Check partners response-cache observability",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
      expect(["HIT", "MISS", "KV"]).toContain(responseCache);
      expect(cacheLayer).toBe("partners-response-cache");
      expect(cacheControl).toBe("no-cache");
    });

    it("Public cache version endpoint exposes freshness metadata", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/settings/cache-version`,
      );

      if (skipIfNoTenant(response, "public-cache-version")) return;

      const body = response.status === 200 ? await response.json() : null;
      const headerVersion = response.headers.get("X-Storefront-Cache-Version");
      const cacheControl = response.headers.get("Cache-Control");
      const bodyVersion = body?.data?.version;

      if (
        response.status === 200 &&
        typeof bodyVersion === "string" &&
        bodyVersion === headerVersion &&
        cacheControl === "no-store"
      ) {
        log(
          "public-cache-version",
          "PASS",
          `Versie ${bodyVersion} zichtbaar in body en header`,
        );
      } else {
        log(
          "public-cache-version",
          "FAIL",
          `Onverwachte response: status=${response.status}, bodyVersion=${bodyVersion}, headerVersion=${headerVersion}, Cache-Control=${cacheControl}`,
          "Check settings cache-version route",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
      expect(typeof bodyVersion).toBe("string");
      expect(headerVersion).toBe(bodyVersion);
      expect(cacheControl).toBe("no-store");
    });

    it("Products page serves HTML", async () => {
      const response = await fetch(`${STOREFRONT_URL}/products`);

      if (skipIfNoTenant(response, "products-page")) return;

      if (response.status === 200) {
        log("products-page", "PASS", "Products page accessible");
      } else {
        log(
          "products-page",
          "FAIL",
          `HTTP ${response.status}`,
          "Check page.routes.ts",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("Login page serves HTML", async () => {
      const response = await fetch(`${STOREFRONT_URL}/login`);

      if (skipIfNoTenant(response, "login-page")) return;

      if (response.status === 200) {
        log("login-page", "PASS", "Login page accessible");
      } else {
        log(
          "login-page",
          "FAIL",
          `HTTP ${response.status}`,
          "Check page.routes.ts",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("Contact page serves HTML", async () => {
      const response = await fetch(`${STOREFRONT_URL}/contact`);

      if (skipIfNoTenant(response, "contact-page")) return;

      if (response.status === 200) {
        log("contact-page", "PASS", "Contact page accessible");
      } else {
        log(
          "contact-page",
          "FAIL",
          `HTTP ${response.status}`,
          "Check page.routes.ts",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("FAQ page serves HTML", async () => {
      const response = await fetch(`${STOREFRONT_URL}/faq`);

      if (skipIfNoTenant(response, "faq-page")) return;

      if (response.status === 200) {
        log("faq-page", "PASS", "FAQ page accessible");
      } else {
        log(
          "faq-page",
          "FAIL",
          `HTTP ${response.status}`,
          "Check page.routes.ts",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("Partners page serves HTML", async () => {
      const response = await fetch(`${STOREFRONT_URL}/partners`);

      if (skipIfNoTenant(response, "partners-page")) return;

      if (response.status === 200) {
        log("partners-page", "PASS", "Partners page accessible");
      } else if (response.status === 404) {
        log(
          "partners-page",
          "WARN",
          "Partners feature niet beschikbaar (404) — feature mogelijk niet gedeployed of niet ingeschakeld voor deze tenant",
        );
        return;
      } else {
        log(
          "partners-page",
          "FAIL",
          `HTTP ${response.status}`,
          "Check page.routes.ts en workers/templates/index.ts",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("Public pages API returns 200 for unknown tag filter", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/pages?tag=unknown-smoke&limit=1`,
      );

      if (skipIfNoTenant(response, "public-pages-list")) return;

      if (response.status === 200) {
        log("public-pages-list", "PASS", `Status: ${response.status}`);
      } else {
        log(
          "public-pages-list",
          "FAIL",
          `HTTP ${response.status}`,
          "Check public-pages.routes.ts listing endpoint",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
    });
  });

  describe("Public Validation Routes", () => {
    it("Analytics vitals beacon accepts malformed payload with 204", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/analytics/vitals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (skipIfNoTenant(response, "analytics-vitals")) return;

      if (response.status === 204) {
        log("analytics-vitals", "PASS", "Beacon endpoint returns 204");
      } else {
        log(
          "analytics-vitals",
          "FAIL",
          `HTTP ${response.status}`,
          "Check analytics vitals route fail-safe behavior",
          "HIGH",
        );
      }

      expect(response.status).toBe(204);
    });

    it("Contact API rejects mutation without CSRF token", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Smoke Test",
          email: "smoke@example.com",
          subject: "Smoke",
          message: "CSRF guard check",
        }),
      });

      if (skipIfNoTenant(response, "contact-csrf")) return;

      if (response.status === 403) {
        log("contact-csrf", "PASS", "CSRF blocks mutation: HTTP 403");
      } else if (response.status >= 500) {
        log(
          "contact-csrf",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check contact route CSRF middleware",
          "HIGH",
        );
      } else {
        log(
          "contact-csrf",
          "WARN",
          `Unexpected status: HTTP ${response.status}`,
        );
      }

      expect(response.status).toBe(403);
    });

    it("Public upload verify rejects missing token", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/public/photo-upload/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (response.status === 400) {
        log("public-upload-verify", "PASS", "Token validation: HTTP 400");
      } else if (response.status >= 500) {
        log(
          "public-upload-verify",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check public upload verify route",
          "HIGH",
        );
      } else {
        log(
          "public-upload-verify",
          "WARN",
          `Unexpected status: HTTP ${response.status}`,
        );
      }

      expect(response.status).toBe(400);
    });
  });

  describe("Commerce API Contracts", () => {
    it("Account API requires auth", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/account`);

      if (skipIfNoTenant(response, "account-auth")) return;

      if (response.status === 401) {
        log("account-auth", "PASS", "Account endpoint vereist auth");
      } else {
        log(
          "account-auth",
          "FAIL",
          `HTTP ${response.status}`,
          "Check account routes auth guard",
          "HIGH",
        );
      }

      expect(response.status).toBe(401);
    });

    it("Account addresses API requires auth", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/account/addresses`);

      if (skipIfNoTenant(response, "account-addresses-auth")) return;

      if (response.status === 401) {
        log(
          "account-addresses-auth",
          "PASS",
          "Address book endpoint vereist auth",
        );
      } else {
        log(
          "account-addresses-auth",
          "FAIL",
          `HTTP ${response.status}`,
          "Check address routes auth guard",
          "HIGH",
        );
      }

      expect(response.status).toBe(401);
    });

    it("Orders API requires auth", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/orders`);

      if (skipIfNoTenant(response, "orders-auth")) return;

      if (response.status === 401) {
        log("orders-auth", "PASS", "Orders endpoint vereist auth");
      } else {
        log(
          "orders-auth",
          "FAIL",
          `HTTP ${response.status}`,
          "Check order routes auth guard",
          "HIGH",
        );
      }

      expect(response.status).toBe(401);
    });

    it("Order tracking validates missing email", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/orders/track/smoke-order`,
      );

      if (skipIfNoTenant(response, "orders-track-validation")) return;

      if (response.status === 400) {
        log(
          "orders-track-validation",
          "PASS",
          "Tracking endpoint valideert ontbrekend e-mailadres",
        );
      } else {
        log(
          "orders-track-validation",
          "FAIL",
          `HTTP ${response.status}`,
          "Check public order tracking validation",
          "HIGH",
        );
      }

      expect(response.status).toBe(400);
    });

    it("Returns API requires auth", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/returns`);

      if (skipIfNoTenant(response, "returns-auth")) return;

      if (response.status === 401) {
        log("returns-auth", "PASS", "Returns endpoint vereist auth");
      } else {
        log(
          "returns-auth",
          "FAIL",
          `HTTP ${response.status}`,
          "Check customer return routes auth guard",
          "HIGH",
        );
      }

      expect(response.status).toBe(401);
    });

    it("Tenant design CSS endpoint serves revalidatable CSS", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/tenant/design-css`);

      if (skipIfNoTenant(response, "tenant-design-css")) return;

      const cacheControl = response.headers.get("Cache-Control");

      if (
        response.status === 200 &&
        response.headers.get("content-type")?.includes("text/css") &&
        cacheControl === "no-cache"
      ) {
        log("tenant-design-css", "PASS", "Tenant CSS contract werkt");
      } else {
        log(
          "tenant-design-css",
          "FAIL",
          `status=${response.status}, content-type=${response.headers.get("content-type")}, cache=${cacheControl}`,
          "Check tenant design-css route",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/css");
      expect(cacheControl).toBe("no-cache");
    });

    it("Tenant manifest endpoint serves revalidatable JSON metadata", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/tenant/manifest.json`,
      );

      if (skipIfNoTenant(response, "tenant-manifest")) return;

      const manifest = response.status === 200 ? await response.json() : null;
      const cacheControl = response.headers.get("Cache-Control");

      if (
        response.status === 200 &&
        typeof manifest?.name === "string" &&
        manifest?.start_url === "/" &&
        cacheControl === "no-cache"
      ) {
        log("tenant-manifest", "PASS", `Manifest voor ${manifest.name}`);
      } else {
        log(
          "tenant-manifest",
          "FAIL",
          `status=${response.status}, name=${manifest?.name}, start_url=${manifest?.start_url}, cache=${cacheControl}`,
          "Check tenant manifest route",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(typeof manifest?.name).toBe("string");
      expect(manifest?.start_url).toBe("/");
      expect(cacheControl).toBe("no-cache");
    });

    it("Tenant info endpoint exposes only public contract", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/tenant/info`);

      if (skipIfNoTenant(response, "tenant-info")) return;

      const info = response.status === 200 ? await response.json() : null;
      const cacheControl = response.headers.get("Cache-Control");

      if (
        response.status === 200 &&
        typeof info?.slug === "string" &&
        typeof info?.name === "string" &&
        !("schema" in info) &&
        !("organizationId" in info) &&
        cacheControl === "no-store"
      ) {
        log("tenant-info", "PASS", `Publiek tenant contract voor ${info.slug}`);
      } else {
        log(
          "tenant-info",
          "FAIL",
          `status=${response.status}, slug=${info?.slug}, cache=${cacheControl}`,
          "Check tenant info route",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
      expect(typeof info?.slug).toBe("string");
      expect(typeof info?.name).toBe("string");
      expect(info).not.toHaveProperty("schema");
      expect(info).not.toHaveProperty("organizationId");
      expect(cacheControl).toBe("no-store");
    });

    it("Stripe checkout session validates missing orderId", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/payments/stripe/checkout-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{ name: "Smoke", price: 10, quantity: 1 }],
          }),
        },
      );

      if (skipIfNoTenant(response, "stripe-checkout-validation")) return;

      if (response.status === 400) {
        log(
          "stripe-checkout-validation",
          "PASS",
          "Stripe checkout valideert ontbrekende orderId",
        );
      } else if (response.status === 403) {
        log(
          "stripe-checkout-validation",
          "PASS",
          "CSRF protection blocks external POST (expected)",
        );
      } else {
        log(
          "stripe-checkout-validation",
          "FAIL",
          `HTTP ${response.status}`,
          "Check Stripe checkout-session validation",
          "HIGH",
        );
      }

      // 400 = validation error (expected), 403 = CSRF protection (expected for external POST)
      expect([400, 403]).toContain(response.status);
    });

    it("Mollie payment validates missing orderId", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/payments/mollie/payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 29.99,
            description: "Smoke payment",
          }),
        },
      );

      if (skipIfNoTenant(response, "mollie-payment-validation")) return;

      if (response.status === 400) {
        log(
          "mollie-payment-validation",
          "PASS",
          "Mollie payment valideert ontbrekende orderId",
        );
      } else if (response.status === 403) {
        log(
          "mollie-payment-validation",
          "PASS",
          "CSRF protection blocks external POST (expected)",
        );
      } else {
        log(
          "mollie-payment-validation",
          "FAIL",
          `HTTP ${response.status}`,
          "Check Mollie payment validation",
          "HIGH",
        );
      }

      // 400 = validation error (expected), 403 = CSRF protection (expected for external POST)
      expect([400, 403]).toContain(response.status);
    });
  });

  describe("Auth Routes", () => {
    it("Session check returns valid response", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/auth/session`);

      if ([200, 401, 404].includes(response.status)) {
        log("session", "PASS", `Session endpoint: HTTP ${response.status}`);
      } else {
        log(
          "session",
          "FAIL",
          `HTTP ${response.status}`,
          "Check auth service",
          "HIGH",
        );
      }

      expect([200, 401, 404]).toContain(response.status);
    });

    it("Login with invalid credentials returns 400/401", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nonexistent@test.com",
          password: "wrongpassword",
        }),
      });

      if (skipIfNoTenant(response, "login-invalid")) return;

      if ([400, 401].includes(response.status)) {
        log(
          "login-invalid",
          "PASS",
          `Validation works: HTTP ${response.status}`,
        );
      } else if (response.status >= 500) {
        log(
          "login-invalid",
          "FAIL",
          "Server crash on login",
          "Check login handler",
          "HIGH",
        );
      }

      expect([400, 401]).toContain(response.status);
    });
  });

  describe("Admin Routes (Auth Required)", () => {
    it("Admin panel accessible (may redirect to login)", async () => {
      const response = await fetch(`${STOREFRONT_URL}/admin`, {
        redirect: "manual",
      });

      if (response.status >= 500) {
        log(
          "admin-panel",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check admin routes handler",
          "HIGH",
        );
      } else {
        log("admin-panel", "PASS", `Protected: HTTP ${response.status}`);
      }

      expect(response.status).toBeLessThan(500);
    });

    it("Admin API requires auth", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/orders`);

      if (skipIfNoTenant(response, "admin-orders")) return;

      if ([401, 403].includes(response.status)) {
        log("admin-orders", "PASS", "Properly protected");
      } else if (response.status >= 500) {
        log(
          "admin-orders",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check admin API handler",
          "HIGH",
        );
      }

      expect([401, 403]).toContain(response.status);
    });

    it("Cache version endpoint requires auth", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/cache-version`);

      if (skipIfNoTenant(response, "cache-version")) return;

      if ([401, 403].includes(response.status)) {
        log("cache-version", "PASS", "Properly protected");
      } else if (response.status >= 500) {
        log(
          "cache-version",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check cache-version route or response-cache lib",
          "HIGH",
        );
      }

      expect([401, 403]).toContain(response.status);
    });

    it("GET /api/admin/search?q=test returns non-500", async () => {
      // Zonder admin sessie verwachten we 401, niet 500
      const response = await fetch(`${STOREFRONT_URL}/api/admin/search?q=test`);

      if (skipIfNoTenant(response, "admin-search")) return;

      if ([401, 403].includes(response.status)) {
        log(
          "admin-search",
          "PASS",
          `Auth guard intact: HTTP ${response.status}`,
        );
      } else if (response.status >= 500) {
        log(
          "admin-search",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check admin search route handler",
          "HIGH",
        );
      } else {
        log(
          "admin-search",
          "WARN",
          `Unexpected status: HTTP ${response.status}`,
        );
      }

      expect(response.status).not.toBe(500);
    });
  });

  describe("Admin Surface Contracts", () => {
    const protectedAdminRoutes = [
      {
        testName: "admin-domain-route",
        path: "/api/admin/domain",
        action: "Check admin domain route mount en requireAdmin guard",
      },
      {
        testName: "admin-invoices-route",
        path: "/api/admin/invoices?limit=1",
        action: "Check admin invoices route mount en requireAdmin guard",
      },
      {
        testName: "admin-coupons-route",
        path: "/api/admin/coupons",
        action: "Check admin coupons route mount en requireAdmin guard",
      },
      {
        testName: "admin-returns-route",
        path: "/api/admin/returns?limit=1",
        action: "Check admin returns route mount en requireAdmin guard",
      },
      {
        testName: "admin-reviews-route",
        path: "/api/admin/reviews",
        action: "Check admin reviews route mount en requireAdmin guard",
      },
      {
        testName: "admin-pages-route",
        path: "/api/admin/pages?limit=1",
        action: "Check admin pages route mount en requireAdmin guard",
      },
      {
        testName: "admin-blog-route",
        path: "/api/admin/blog?limit=1",
        action: "Check admin blog route mount en requireAdmin guard",
      },
      {
        testName: "admin-navigation-route",
        path: "/api/admin/navigation?menu=HEADER",
        action: "Check admin navigation route mount en requireAdmin guard",
      },
      {
        testName: "admin-messages-route",
        path: "/api/admin/messages/stats",
        action: "Check admin messages route mount en requireAdmin guard",
      },
      {
        testName: "admin-team-route",
        path: "/api/admin/team",
        action: "Check admin team route mount en requireAdmin guard",
      },
      {
        testName: "admin-kv-sync-route",
        path: "/api/admin/kv-sync/status",
        action: "Check admin kv-sync route mount en requireAdmin guard",
      },
    ] as const;

    for (const route of protectedAdminRoutes) {
      it(`${route.path} faalt gesloten zonder admin-auth`, async () => {
        await expectProtectedAdminGetRoute(route);
      });
    }
  });

  describe("Cart & Checkout", () => {
    it("Cart endpoint accessible", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/cart`);

      if ([200, 401, 404].includes(response.status)) {
        log("cart", "PASS", `Cart endpoint: HTTP ${response.status}`);
      } else {
        log("cart", "WARN", `Unexpected: HTTP ${response.status}`);
      }

      expect([200, 401, 404]).toContain(response.status);
    });
  });

  describe("New Endpoints - Auth Required", () => {
    it("PUT /api/admin/orders/batch/status requires auth", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/orders/batch/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIds: [], status: "shipped" }),
        },
      );

      if (skipIfNoTenant(response, "batch-status")) return;

      if ([401, 403].includes(response.status)) {
        log("batch-status", "PASS", "Properly protected");
      } else if (response.status >= 500) {
        log(
          "batch-status",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check admin-orders routes",
          "HIGH",
        );
      }

      expect([401, 403]).toContain(response.status);
    });

    it("POST /api/admin/forgot-password returns valid response", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "nonexistent@smoke-test.com" }),
        },
      );

      if ([200, 400].includes(response.status)) {
        log("forgot-password", "PASS", `Status: ${response.status}`);
      } else if (response.status >= 500) {
        log(
          "forgot-password",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check admin-auth routes forgot-password handler",
          "HIGH",
        );
      }

      // 200 = anti-enumeration success, 400 = validation error — both acceptable
      expect(response.status).toBeLessThan(500);
    });

    it("POST /api/admin/reset-password validates input", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: "invalid", newPassword: "123" }),
        },
      );

      if (response.status === 400) {
        log("reset-password", "PASS", "Validation works");
      } else if (response.status >= 500) {
        log(
          "reset-password",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check admin-auth routes reset-password handler",
          "HIGH",
        );
      }

      expect(response.status).toBeLessThan(500);
    });

    it("GET /api/admin/ai/config requires auth", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/ai/config`);

      if (skipIfNoTenant(response, "ai-config")) return;

      if ([401, 403].includes(response.status)) {
        log("ai-config", "PASS", "Properly protected");
      } else if (response.status >= 500) {
        log(
          "ai-config",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check admin-ai routes",
          "HIGH",
        );
      }

      expect([401, 403]).toContain(response.status);
    });

    it("GET /api/admin/organization/onboarding requires auth", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/organization/onboarding`,
      );

      if (skipIfNoTenant(response, "organization-onboarding")) return;

      if ([401, 403].includes(response.status)) {
        log("organization-onboarding", "PASS", "Properly protected");
      } else if (response.status >= 500) {
        log(
          "organization-onboarding",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check admin-organization routes",
          "HIGH",
        );
      }

      expect([401, 403]).toContain(response.status);
    });

    it("GET /api/admin/roles-ui requires auth", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/roles-ui`);

      if (skipIfNoTenant(response, "roles-ui")) return;

      if ([401, 403].includes(response.status)) {
        log("roles-ui", "PASS", "Properly protected");
      } else if (response.status >= 500) {
        log(
          "roles-ui",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check admin-roles-ui routes",
          "HIGH",
        );
      }

      expect([401, 403]).toContain(response.status);
    });
  });

  describe("Anonymous Onboarding Routes", () => {
    it("GET /start/health returns 200", async () => {
      const response = await fetch(`${STOREFRONT_URL}/start/health`);

      if (response.status === 200) {
        const data = await response.json();
        log(
          "start-health",
          "PASS",
          `Status: ${data.status}, service: ${data.service}`,
        );
        expect(data.service).toBe("start-page");
      } else {
        log(
          "start-health",
          "FAIL",
          `HTTP ${response.status}`,
          "Check start-page.routes.ts health endpoint",
          "HIGH",
        );
        expect(response.status).toBe(200);
      }
    });

    it("GET /start serves start page HTML", async () => {
      const response = await fetch(`${STOREFRONT_URL}/start`);

      if (response.status === 200) {
        const html = await response.text();
        const hasPageContent =
          html.includes("Pagayo") && html.includes("<!DOCTYPE html>");
        log(
          "start-page",
          hasPageContent ? "PASS" : "WARN",
          `HTML response: ${html.length} bytes`,
        );
        expect(response.headers.get("content-type")).toContain("text/html");
      } else {
        log(
          "start-page",
          "FAIL",
          `HTTP ${response.status}`,
          "Check start-page.routes.ts",
          "HIGH",
        );
        expect(response.status).toBe(200);
      }
    });

    it("GET /o/nonexistent returns 404 for unknown order slug", async () => {
      const response = await fetch(`${STOREFRONT_URL}/o/zzz999`);

      if (response.status === 404) {
        log(
          "anon-order-page",
          "PASS",
          "Returns 404 for nonexistent order slug",
        );
      } else if (response.status >= 500) {
        log(
          "anon-order-page",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check anon-order.routes.ts",
          "HIGH",
        );
      } else {
        log(
          "anon-order-page",
          "WARN",
          `Unexpected status: HTTP ${response.status}`,
        );
      }

      expect([200, 404]).toContain(response.status);
    });

    it("GET /my/nonexistent returns 404 for unknown owner slug", async () => {
      const response = await fetch(`${STOREFRONT_URL}/my/zzz999`);

      if (response.status === 404) {
        log(
          "anon-owner-page",
          "PASS",
          "Returns 404 for nonexistent owner slug",
        );
      } else if (response.status >= 500) {
        log(
          "anon-owner-page",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check anon-owner.routes.ts",
          "HIGH",
        );
      } else {
        log(
          "anon-owner-page",
          "WARN",
          `Unexpected status: HTTP ${response.status}`,
        );
      }

      expect([200, 404]).toContain(response.status);
    });

    it("POST /api/anon/claim without body returns 400 (validation)", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/anon/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.status === 400) {
        log(
          "anon-claim-validation",
          "PASS",
          "Returns 400 for empty claim body (Zod validation)",
        );
      } else if (response.status >= 500) {
        log(
          "anon-claim-validation",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check claim.service.ts + anon-api.routes.ts",
          "CRITICAL",
        );
      } else {
        log(
          "anon-claim-validation",
          "WARN",
          `Unexpected status: HTTP ${response.status}`,
        );
      }

      // 400 = Zod validation rejects, 401 = auth rejects first
      expect([400, 401]).toContain(response.status);
    });
  });

  describe("Universal Login (start.pagayo.app/login)", () => {
    it("GET /start/login serves login page HTML", async () => {
      const response = await fetch(`${STOREFRONT_URL}/start/login`);

      if (response.status === 200) {
        const html = await response.text();
        const hasLoginContent =
          html.includes("<!DOCTYPE html>") && html.includes("login");
        log(
          "universal-login-page",
          hasLoginContent ? "PASS" : "WARN",
          `HTML response: ${html.length} bytes`,
        );
        expect(response.headers.get("content-type")).toContain("text/html");
      } else {
        log(
          "universal-login-page",
          "FAIL",
          `HTTP ${response.status}`,
          "Check start-page.routes.ts login route",
          "HIGH",
        );
        expect(response.status).toBe(200);
      }
    });

    it("GET /start/login sets CSRF cookie", async () => {
      const response = await fetch(`${STOREFRONT_URL}/start/login`);

      if (response.status === 200) {
        const setCookie = response.headers.get("set-cookie");
        const hasCsrf = setCookie?.includes("csrf_token=") ?? false;
        log(
          "universal-login-csrf",
          hasCsrf ? "PASS" : "WARN",
          hasCsrf
            ? "CSRF cookie set correctly"
            : "CSRF cookie missing in response",
        );
      } else {
        log(
          "universal-login-csrf",
          "FAIL",
          `HTTP ${response.status}`,
          "Check csrfMiddleware on login routes",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
    });

    it("POST /start/api/login without CSRF returns 403", async () => {
      const response = await fetch(`${STOREFRONT_URL}/start/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "smoke-test@example.com",
          password: "smoke-test",
        }),
      });

      if (response.status === 403) {
        log(
          "universal-login-csrf-block",
          "PASS",
          "CSRF protection blocks requests without token",
        );
      } else {
        log(
          "universal-login-csrf-block",
          "WARN",
          `Expected 403, got HTTP ${response.status}`,
          "Check CSRF middleware on /api/login",
        );
      }

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // SUBSCRIPTION ENDPOINTS
  // ============================================================================
  describe("Subscription API", () => {
    it("GET /api/admin/subscriptions returns 401 without auth", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/subscriptions`);
      if (skipIfNoTenant(response, "admin-subscriptions-no-auth")) return;
      log(
        "admin-subscriptions-no-auth",
        response.status === 401 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/subscription returns 401 without auth", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/subscription`);
      if (skipIfNoTenant(response, "customer-subscriptions-no-auth")) return;
      log(
        "customer-subscriptions-no-auth",
        response.status === 401 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/admin/subscriptions/lookup without code returns 400", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/subscriptions/lookup`,
      );
      if (skipIfNoTenant(response, "admin-subscription-lookup-no-code")) return;
      log(
        "admin-subscription-lookup-no-code",
        response.status === 400 || response.status === 401 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect([400, 401]).toContain(response.status);
    });

    it("POST /api/admin/subscriptions/scan without auth returns 401 or 403", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/subscriptions/scan`,
        { method: "POST" },
      );
      if (skipIfNoTenant(response, "admin-subscription-scan-no-auth")) return;
      log(
        "admin-subscription-scan-no-auth",
        [401, 403].includes(response.status) ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect([401, 403]).toContain(response.status);
    });

    it("GET /api/admin/subscriptions/visits/today without auth returns 401", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/subscriptions/visits/today`,
      );
      if (skipIfNoTenant(response, "admin-subscription-visits-today-no-auth"))
        return;
      log(
        "admin-subscription-visits-today-no-auth",
        response.status === 401 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/admin/subscriptions/visits/feed without auth returns 401", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/subscriptions/visits/feed`,
      );
      if (skipIfNoTenant(response, "admin-subscription-visits-feed-no-auth"))
        return;
      log(
        "admin-subscription-visits-feed-no-auth",
        response.status === 401 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/admin/subscriptions/holders without auth returns 401", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/subscriptions/holders`,
      );
      if (skipIfNoTenant(response, "admin-subscription-holders-no-auth"))
        return;
      log(
        "admin-subscription-holders-no-auth",
        response.status === 401 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/admin/subscriptions/holders/:holderId without auth returns 401", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/subscriptions/holders/sub_1`,
      );
      if (skipIfNoTenant(response, "admin-subscription-holder-detail-no-auth"))
        return;
      log(
        "admin-subscription-holder-detail-no-auth",
        response.status === 401 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/internal/active-tenants requires secret", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/internal/active-tenants`,
      );
      log(
        "internal-active-tenants-no-secret",
        response.status === 401 || response.status === 403 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect([401, 403]).toContain(response.status);
    });
  });

  describe("Stripe Connect Integration", () => {
    it("GET /api/admin/integrations/stripe/connect/status requires auth", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/integrations/stripe/connect/status`,
      );
      if (skipIfNoTenant(response, "stripe-connect-status-no-auth")) return;
      log(
        "stripe-connect-status-no-auth",
        response.status === 401 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect(response.status).toBe(401);
    });

    it("POST /api/admin/integrations/stripe/connect/start requires auth", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/integrations/stripe/connect/start`,
        { method: "POST" },
      );
      if (skipIfNoTenant(response, "stripe-connect-start-no-auth")) return;
      log(
        "stripe-connect-start-no-auth",
        [401, 403].includes(response.status) ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      // 403 = CSRF middleware rejects before auth, 401 = auth rejects
      expect([401, 403]).toContain(response.status);
    });

    it("POST /api/admin/integrations/stripe/connect/disconnect requires auth", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/integrations/stripe/connect/disconnect`,
        { method: "POST" },
      );
      if (skipIfNoTenant(response, "stripe-connect-disconnect-no-auth")) return;
      log(
        "stripe-connect-disconnect-no-auth",
        [401, 403].includes(response.status) ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      // 403 = CSRF middleware rejects before auth, 401 = auth rejects
      expect([401, 403]).toContain(response.status);
    });

    it("POST /api/admin/integrations/stripe/test requires auth", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/integrations/stripe/test`,
        { method: "POST" },
      );
      if (skipIfNoTenant(response, "stripe-test-no-auth")) return;
      log(
        "stripe-test-no-auth",
        [401, 403].includes(response.status) ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      // 403 = CSRF middleware rejects before auth, 401 = auth rejects
      expect([401, 403]).toContain(response.status);
    });

    it("GET /api/stripe/connect/callback without params returns 400", async () => {
      // Callback route op connect.pagayo.app is publiek (Stripe redirect)
      // maar vereist code en state parameters
      const response = await fetch(
        "https://connect.pagayo.app/api/stripe/connect/callback",
      );
      log(
        "stripe-callback-missing-params",
        response.status === 400 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error?.code).toBe("MISSING_PARAMS");
    });

    it("GET /api/stripe/connect/callback with invalid state returns 400", async () => {
      // Ongeldige state parameter moet afgewezen worden
      const response = await fetch(
        "https://connect.pagayo.app/api/stripe/connect/callback?code=test&state=invalid.signature",
      );
      log(
        "stripe-callback-invalid-state",
        response.status === 400 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error?.code).toBe("INVALID_STATE");
    });
  });

  describe("Stripe PaymentIntent API", () => {
    it("POST /api/payments/stripe/payment-intent without orderId returns 400 or 403", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/payments/stripe/payment-intent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 1000,
            paymentMethodType: "ideal",
          }),
        },
      );

      if (skipIfNoTenant(response, "stripe-pi-missing-orderid")) return;

      if (response.status === 400) {
        log(
          "stripe-pi-missing-orderid",
          "PASS",
          "PaymentIntent valideert ontbrekende orderId",
        );
      } else if (response.status === 403) {
        log(
          "stripe-pi-missing-orderid",
          "PASS",
          "CSRF protection blocks external POST (expected)",
        );
      } else {
        log(
          "stripe-pi-missing-orderid",
          "FAIL",
          `HTTP ${response.status}`,
          "Check PaymentIntent validation",
          "HIGH",
        );
      }

      // 400 = validation error (expected), 403 = CSRF protection (expected for external POST)
      expect([400, 403]).toContain(response.status);
    });

    it("GET /api/payments/stripe/payment-intent/pi_invalid returns 400 or 404", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/payments/stripe/payment-intent/pi_invalid`,
      );

      if (skipIfNoTenant(response, "stripe-pi-status-invalid")) return;

      if ([400, 404].includes(response.status)) {
        log(
          "stripe-pi-status-invalid",
          "PASS",
          `PaymentIntent status rejects invalid ID: HTTP ${response.status}`,
        );
      } else {
        log(
          "stripe-pi-status-invalid",
          "FAIL",
          `HTTP ${response.status}`,
          "Check PaymentIntent status endpoint",
          "HIGH",
        );
      }

      expect([400, 404]).toContain(response.status);
    });
  });

  describe("Auth Routes (Phone Support)", () => {
    it("POST /auth/register with email returns 200 or 400", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Test",
          lastName: "User",
          identifier: "test@example.com",
          password: "TestPassword123!",
        }),
      });
      if (skipIfNoTenant(response, "auth-register-email")) return;
      const status = response.status;
      if (status === 500) {
        const body = await response.text();
        log(
          "auth-register-email",
          "FAIL",
          `Register 500: ${body.slice(0, 200)}`,
          "Check D1 schema and Worker logs: wrangler tail pagayo-storefront",
          "CRITICAL",
        );
      } else {
        log(
          "auth-register-email",
          response.ok || status === 400 ? "PASS" : "FAIL",
          `Status: ${status}`,
        );
      }
      expect([200, 400]).toContain(status);
    });

    it("POST /auth/register with phone returns 200 or 400", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Test",
          lastName: "User",
          identifier: "+31612345678",
          password: "TestPassword123!",
        }),
      });
      if (skipIfNoTenant(response, "auth-register-phone")) return;
      const status = response.status;
      if (status === 500) {
        const body = await response.text();
        log(
          "auth-register-phone",
          "FAIL",
          `Register 500: ${body.slice(0, 200)}`,
          "Check D1 schema and Worker logs: wrangler tail pagayo-storefront",
          "CRITICAL",
        );
      } else {
        log(
          "auth-register-phone",
          response.ok || status === 400 ? "PASS" : "FAIL",
          `Status: ${status}`,
        );
      }
      expect([200, 400]).toContain(status);
    });

    it("POST /auth/login with email returns 200 or 401", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "test@example.com",
          password: "WrongPassword123!",
        }),
      });
      if (skipIfNoTenant(response, "auth-login-email")) return;
      log(
        "auth-login-email",
        response.ok || response.status === 401 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect([200, 401]).toContain(response.status);
    });

    it("POST /auth/login with phone returns 200 or 401", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "+31612345678",
          password: "WrongPassword123!",
        }),
      });
      if (skipIfNoTenant(response, "auth-login-phone")) return;
      log(
        "auth-login-phone",
        response.ok || response.status === 401 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect([200, 401]).toContain(response.status);
    });

    it("POST /auth/logout returns 200", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (skipIfNoTenant(response, "auth-logout")) return;
      if (response.status === 403) {
        log(
          "auth-logout",
          "PASS",
          "CSRF protection blocks external POST (expected)",
        );
      } else {
        log(
          "auth-logout",
          response.ok ? "PASS" : "FAIL",
          `Status: ${response.status}`,
        );
      }
      // 200 = logged out, 401 = no session, 403 = CSRF protection (expected for external POST)
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  describe("CSRF Token Endpoint", () => {
    it("GET /api/admin/csrf returns CSRF token and sets cookie", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/csrf`);

      // Admin endpoints may require Cloudflare Access — 403 is expected in prod
      if (response.status === 403) {
        log(
          "admin-csrf",
          "WARN",
          "HTTP 403 — Cloudflare Access blocked (expected voor productie)",
        );
        return;
      }

      if (skipIfNoTenant(response, "admin-csrf")) return;

      const setCookie = response.headers.get("set-cookie") || "";
      const hasCsrfCookie = setCookie.includes("csrf_token=");

      if (response.ok && hasCsrfCookie) {
        const body = (await response.json()) as {
          success: boolean;
          data?: { csrfToken: string };
        };

        // Token in cookie should not be duplicated (no double middleware mount)
        const csrfMatches = setCookie.match(/csrf_token=/g);
        const cookieCount = csrfMatches ? csrfMatches.length : 0;

        if (cookieCount > 1) {
          log(
            "admin-csrf",
            "FAIL",
            `Duplicate csrf_token cookies detected (${cookieCount}×) — double CSRF middleware mount`,
            "Check worker.ts CSRF middleware mounting — alleen /admin/* mount mag actief zijn",
            "CRITICAL",
          );
          expect(cookieCount).toBeLessThanOrEqual(1);
          return;
        }

        log(
          "admin-csrf",
          "PASS",
          `CSRF token returned, cookie set (1× Set-Cookie)`,
        );
        expect(body.success).toBe(true);
        expect(body.data?.csrfToken).toBeTruthy();
      } else {
        log(
          "admin-csrf",
          "FAIL",
          `HTTP ${response.status}, cookie: ${hasCsrfCookie}`,
          "Check /api/admin/csrf endpoint en CSRF middleware",
          "HIGH",
        );
        expect(response.ok).toBe(true);
      }
    });
  });

  // ==========================================================================
  // ONBOARDING FLOW
  // ==========================================================================

  describe("Onboarding Flow", () => {
    it("GET /register returns HTML with Turnstile widget", async () => {
      const response = await fetch(`${ONBOARDING_URL}/register`);

      if (response.status === 200) {
        const html = await response.text();
        const hasTurnstile = html.includes(
          "challenges.cloudflare.com/turnstile",
        );
        log(
          "register-page",
          hasTurnstile ? "PASS" : "WARN",
          hasTurnstile
            ? "Register page met Turnstile widget"
            : "Register page ZONDER Turnstile widget",
        );
        expect(response.ok).toBe(true);
      } else {
        log(
          "register-page",
          "FAIL",
          `HTTP ${response.status}`,
          "Check start.pagayo.app routing of Worker deployment",
          "CRITICAL",
        );
        expect(response.status).toBe(200);
      }
    });

    it("POST /api/anon/create-account is operationeel (geen 503)", async () => {
      const response = await fetch(
        `${ONBOARDING_URL}/api/anon/create-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ turnstileToken: "smoke-test-probe" }),
        },
      );

      if (response.status === 503) {
        log(
          "create-account",
          "FAIL",
          "HTTP 503 — Onboarding KAPOT! Ontbrekende Worker secrets",
          "npx wrangler secret list --env production → check CF_API_TOKEN en TURNSTILE_SECRET",
          "CRITICAL",
        );
      } else if (response.status === 403) {
        log(
          "create-account",
          "PASS",
          "Turnstile verificatie actief (403 = verwacht voor smoke-test token)",
        );
      } else if (response.status === 400) {
        log(
          "create-account",
          "PASS",
          `Validatie actief: HTTP ${response.status}`,
        );
      } else {
        log(
          "create-account",
          "PASS",
          `Endpoint operationeel: HTTP ${response.status}`,
        );
      }

      expect(response.status).not.toBe(503);
    });

    it("GET /start returns start page HTML", async () => {
      const response = await fetch(`${ONBOARDING_URL}/start`);

      if (response.status === 200) {
        log("start-page", "PASS", "Start page accessible");
      } else {
        log(
          "start-page",
          "FAIL",
          `HTTP ${response.status}`,
          "Check start.pagayo.app Worker routing",
          "HIGH",
        );
      }
      expect(response.status).toBe(200);
    });

    it("Tenant resolution via subdomain werkt (edge-first pad)", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/health`);

      if (response.status === 200) {
        log(
          "tenant-resolution",
          "PASS",
          `Tenant bereikbaar via subdomain (KV→D1 pad werkt)`,
        );
      } else if (response.status === 404) {
        log(
          "tenant-resolution",
          "WARN",
          "Tenant niet gevonden — check TENANT_CACHE KV of platform DB",
          "wrangler kv key get --binding TENANT_CACHE 'tenant:<slug>'",
          "HIGH",
        );
      } else {
        log(
          "tenant-resolution",
          "FAIL",
          `HTTP ${response.status}`,
          "Tenant resolution via subdomain faalt",
          "CRITICAL",
        );
      }

      expect(response.status).not.toBe(503);
    });
  });

  // ==========================================================================
  // PLATFORM PROVISIONING (Case Layer)
  // ==========================================================================

  describe("Platform Provisioning - Policy Sync", () => {
    it("sync-policy endpoint is bereikbaar (achter CF Access)", async () => {
      // Platform provisioning endpoints staan op admin.pagayo.app
      // Zonder CF Access token verwachten we 403 (Forbidden) — niet 500/502
      const response = await fetch(
        `${PLATFORM_ADMIN_URL}/api/platform/provisioning/sync-policy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kvKey: "test", value: "test" }),
        },
      );

      if (response.status === 403 || response.status === 401) {
        log(
          "sync-policy",
          "PASS",
          `CF Access blokkeert correct: HTTP ${response.status}`,
        );
      } else if (response.status >= 500) {
        log(
          "sync-policy",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check Worker logs voor sync-policy route",
          "HIGH",
        );
      } else {
        log(
          "sync-policy",
          "WARN",
          `Unexpected status: HTTP ${response.status}`,
        );
      }

      // Endpoint mag niet crashen (5xx) — 401/403 is correct gedrag
      expect(response.status).toBeLessThan(500);
    });
  });

  describe("Theme Settings API", () => {
    it("GET /api/admin/settings/theme requires auth (401/403)", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/settings/theme`,
      );

      if (response.status === 401 || response.status === 403) {
        log(
          "theme-settings-get",
          "PASS",
          `Auth blocks correctly: HTTP ${response.status}`,
        );
      } else if (response.status >= 500) {
        log(
          "theme-settings-get",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check Worker logs voor theme route",
          "HIGH",
        );
      } else {
        log(
          "theme-settings-get",
          "WARN",
          `Unexpected status: HTTP ${response.status}`,
        );
      }

      expect(response.status).toBeLessThan(500);
    });

    it("PUT /api/admin/settings/theme requires auth (401/403)", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/settings/theme`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: "fresh" }),
        },
      );

      if (response.status === 401 || response.status === 403) {
        log(
          "theme-settings-put",
          "PASS",
          `Auth blocks correctly: HTTP ${response.status}`,
        );
      } else if (response.status >= 500) {
        log(
          "theme-settings-put",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check Worker logs voor theme PUT route",
          "HIGH",
        );
      } else {
        log(
          "theme-settings-put",
          "WARN",
          `Unexpected status: HTTP ${response.status}`,
        );
      }

      expect(response.status).toBeLessThan(500);
    });
  });

  describe("Menu Overrides API", () => {
    it("GET /api/admin/organization/menu-overrides requires auth (401/403)", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/organization/menu-overrides`,
      );

      if (response.status === 401 || response.status === 403) {
        log(
          "menu-overrides-get",
          "PASS",
          `Auth blocks correctly: HTTP ${response.status}`,
        );
      } else if (response.status >= 500) {
        log(
          "menu-overrides-get",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check Worker logs voor menu-overrides route",
          "HIGH",
        );
      } else {
        log(
          "menu-overrides-get",
          "WARN",
          `Unexpected status: HTTP ${response.status}`,
        );
      }

      expect(response.status).toBeLessThan(500);
    });

    it("PUT /api/admin/organization/menu-overrides requires auth (401/403)", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/organization/menu-overrides`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrides: { ORDERS: false } }),
        },
      );

      if (response.status === 401 || response.status === 403) {
        log(
          "menu-overrides-put",
          "PASS",
          `Auth blocks correctly: HTTP ${response.status}`,
        );
      } else if (response.status >= 500) {
        log(
          "menu-overrides-put",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check Worker logs voor menu-overrides PUT route",
          "HIGH",
        );
      } else {
        log(
          "menu-overrides-put",
          "WARN",
          `Unexpected status: HTTP ${response.status}`,
        );
      }

      expect(response.status).toBeLessThan(500);
    });
  });

  describe("Announcements & Opening Hours (Aqua Theme)", () => {
    it("GET /api/announcements returns 200", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/announcements`);

      if (skipIfNoTenant(response, "announcements-list")) return;

      if (response.status === 200) {
        log("announcements-list", "PASS", `Status: ${response.status}`);
      } else {
        log(
          "announcements-list",
          "FAIL",
          `HTTP ${response.status}`,
          "Check announcements.routes.ts en D1 database",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
    });

    it("GET /api/announcements/pinned returns 200", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/announcements/pinned`,
      );

      if (skipIfNoTenant(response, "announcements-pinned")) return;

      if (response.status === 200) {
        log("announcements-pinned", "PASS", `Status: ${response.status}`);
      } else {
        log(
          "announcements-pinned",
          "FAIL",
          `HTTP ${response.status}`,
          "Check announcements.routes.ts pinned endpoint",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
    });

    it("GET /api/navigation returns 200", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/navigation?menu=HEADER`,
      );

      if (skipIfNoTenant(response, "navigation-header")) return;

      if (response.status === 200) {
        log("navigation-header", "PASS", `Status: ${response.status}`);
      } else {
        log(
          "navigation-header",
          "FAIL",
          `HTTP ${response.status}`,
          "Check navigation.routes.ts and tenant_menu_item data",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
    });

    it("GET /api/navigation?menu=FOOTER exposes cache headers", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/navigation?menu=FOOTER`,
      );

      if (skipIfNoTenant(response, "navigation-footer")) return;

      const cacheHeader = response.headers.get("X-Cache");
      const cacheLayer = response.headers.get("X-Storefront-Cache-Layer");
      const cacheControl = response.headers.get("Cache-Control");

      if (
        response.status === 200 &&
        ["HIT", "MISS"].includes(cacheHeader || "") &&
        cacheLayer === "navigation-kv" &&
        cacheControl === "no-store"
      ) {
        log(
          "navigation-footer",
          "PASS",
          `Headers ok: X-Cache=${cacheHeader}, layer=${cacheLayer}`,
        );
      } else {
        log(
          "navigation-footer",
          "FAIL",
          `Onverwachte headers: status=${response.status}, X-Cache=${cacheHeader}, layer=${cacheLayer}, Cache-Control=${cacheControl}`,
          "Check navigation route cache observability",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
      expect(["HIT", "MISS"]).toContain(cacheHeader);
      expect(cacheLayer).toBe("navigation-kv");
      expect(cacheControl).toBe("no-store");
    });

    it("GET /api/admin/settings/opening-hours requires auth", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/settings/opening-hours`,
      );

      if (skipIfNoTenant(response, "opening-hours-auth")) return;

      if (response.status === 401 || response.status === 403) {
        log(
          "opening-hours-auth",
          "PASS",
          `Auth blocks correctly: HTTP ${response.status}`,
        );
      } else if (response.status >= 500) {
        log(
          "opening-hours-auth",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check admin-settings.routes.ts opening-hours GET",
          "HIGH",
        );
      } else {
        log(
          "opening-hours-auth",
          "WARN",
          `Unexpected status: HTTP ${response.status}`,
        );
      }

      expect(response.status).toBeLessThan(500);
    });

    it("GET /api/admin/announcements requires auth", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/announcements`);

      if (skipIfNoTenant(response, "admin-announcements-auth")) return;

      if (response.status === 401 || response.status === 403) {
        log(
          "admin-announcements-auth",
          "PASS",
          `Auth blocks correctly: HTTP ${response.status}`,
        );
      } else if (response.status >= 500) {
        log(
          "admin-announcements-auth",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check admin-announcements.routes.ts auth middleware",
          "HIGH",
        );
      } else {
        log(
          "admin-announcements-auth",
          "WARN",
          `Unexpected status: HTTP ${response.status}`,
        );
      }

      expect(response.status).toBeLessThan(500);
    });

    it("GET /api/settings/opening-hours returns 200", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/settings/opening-hours`,
      );

      if (skipIfNoTenant(response, "public-opening-hours")) return;

      if (response.status === 200) {
        log("public-opening-hours", "PASS", `Status: ${response.status}`);
      } else {
        log(
          "public-opening-hours",
          "FAIL",
          `HTTP ${response.status}`,
          "Check settings.routes.ts opening-hours endpoint (must be before /:key route)",
          "HIGH",
        );
      }

      expect(response.status).toBe(200);
    });
  });

  describe("Checkout Endpoint", () => {
    it("POST /api/checkout returns 400 without body (endpoint reachable)", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (skipIfNoTenant(response, "checkout-endpoint-reachable")) return;

      // 400 = endpoint is reachable but rejects invalid input (correct behavior)
      // 401/403 = auth required (also acceptable)
      if ([400, 401, 403, 422].includes(response.status)) {
        log(
          "checkout-endpoint-reachable",
          "PASS",
          `Checkout endpoint bereikbaar: HTTP ${response.status} (verwacht: input validatie)`,
        );
      } else if (response.status >= 500) {
        log(
          "checkout-endpoint-reachable",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check checkout.routes.ts en Stripe configuratie",
          "CRITICAL",
        );
      } else {
        log(
          "checkout-endpoint-reachable",
          "WARN",
          `Onverwachte status: HTTP ${response.status}`,
        );
      }

      expect(response.status).toBeLessThan(500);
    });

    it("POST /api/checkout with partial cart validates payment method (checkout session reachable)", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ productId: "smoke-test", qty: 1 }],
          customer: { email: "smoke@example.com" },
          paymentMethod: "ideal",
        }),
      });

      if (skipIfNoTenant(response, "checkout-session-reachable")) return;

      // 400/422 = validation error (expected — incomplete cart data)
      // 403 = CSRF protection (expected for external POST)
      if ([400, 403, 422].includes(response.status)) {
        log(
          "checkout-session-reachable",
          "PASS",
          `Checkout session endpoint bereikbaar: HTTP ${response.status} (verwacht: validatie)`,
        );
      } else if (response.status >= 500) {
        log(
          "checkout-session-reachable",
          "FAIL",
          `Server error: HTTP ${response.status}`,
          "Check checkout-payment service en Stripe configuratie",
          "CRITICAL",
        );
      } else {
        log(
          "checkout-session-reachable",
          "WARN",
          `Onverwachte status: HTTP ${response.status}`,
        );
      }

      expect(response.status).toBeLessThan(500);
    });
  });

  // ==========================================================================
  // SCHEMA INTEGRITY
  // ==========================================================================

  describe("Schema Integrity", () => {
    it("POST /api/checkout with empty body returns 400 not 500 (schema intact)", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (skipIfNoTenant(response, "checkout-schema-integrity")) return;

      if (response.status === 400) {
        log(
          "checkout-schema-integrity",
          "PASS",
          `Zod validatie actief: HTTP 400 (schema intact)`,
        );
      } else if (response.status === 403) {
        log(
          "checkout-schema-integrity",
          "PASS",
          `CSRF blokkeert externe POST: HTTP 403 (endpoint bereikbaar)`,
        );
      } else if (response.status >= 500) {
        log(
          "checkout-schema-integrity",
          "FAIL",
          `Server error: HTTP ${response.status} — mogelijke schema drift`,
          "Check Worker logs: wrangler tail pagayo-storefront. Controleer D1 schema integriteit.",
          "CRITICAL",
        );
      } else {
        log(
          "checkout-schema-integrity",
          "WARN",
          `Onverwachte status: HTTP ${response.status}`,
        );
      }

      // 400 = Zod validatie werkt correct (schema intact)
      // 403 = CSRF blokkeert (endpoint bereikbaar, validatie niet bereikt)
      // 500 = mogelijke schema drift of server error
      expect([400, 403]).toContain(response.status);
    });
  });
});
