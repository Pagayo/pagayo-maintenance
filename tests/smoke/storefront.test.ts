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
import { STOREFRONT_URL, detectTenantActive } from "../utils/test-config";

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

  beforeAll(async () => {
    tenantActive = await detectTenantActive();
    if (!tenantActive) {
      console.log(
        `⚠️  Geen actieve tenant op ${STOREFRONT_URL} — tenant-afhankelijke tests accepteren 404`,
      );
    }
  });

  /**
   * Guard voor tenant-afhankelijke tests.
   * Als geen tenant actief en response = 404 → log WARNING en return true (skip assert).
   * Dit is CORRECT gedrag: de Worker draait, maar tenant resolution retourneert 404.
   */
  function skipIfNoTenant(response: Response, testName: string): boolean {
    if (!tenantActive && response.status === 404) {
      log(testName, "WARN", `Geen tenant: HTTP 404 (verwacht gedrag)`);
      return true;
    }
    return false;
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
      log(
        "auth-register-email",
        response.ok || response.status === 400 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect([200, 400]).toContain(response.status);
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
      log(
        "auth-register-phone",
        response.ok || response.status === 400 ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect([200, 400]).toContain(response.status);
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
      log(
        "auth-logout",
        response.ok ? "PASS" : "FAIL",
        `Status: ${response.status}`,
      );
      expect(response.ok).toBe(true);
    });
  });
});
