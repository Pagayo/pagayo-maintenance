/**
 * SMOKE TESTS - AUTHENTICATED FLOWS
 * ============================================================================
 * DOEL: Valideer dat authenticated happy paths ECHT werken.
 * Dit is het verschil tussen "infra-groen" en "product-groen".
 *
 * VEREISTEN:
 * - STOREFRONT_TEST_URL moet naar localhost wijzen (lokale dev server)
 * - Seeded test data (users, subscriptions) in lokale D1 database
 * - Wrangler dev server draaiend op de juiste port
 *
 * WANNEER RUNNEN:
 * - Na wijzigingen aan session/auth middleware
 * - Na database schema migraties
 * - Na subscription/checkout flow wijzigingen
 * - Wanneer product-groen validatie nodig is
 *
 * GEBRUIK:
 *   STOREFRONT_TEST_URL=http://localhost:3000 npm run test -- tests/smoke/authenticated-flows.test.ts
 * ============================================================================
 */

import { logTestResult, type TestResult } from "../utils/test-reporter";
import { STOREFRONT_URL } from "../utils/test-config";
import {
  isLocalEnvironment,
  loginAsCustomer,
  loginAsAdmin,
  createAuthFetch,
} from "../utils/auth-helper";

function log(
  test: string,
  status: TestResult["status"],
  details: string,
  action?: string,
  priority?: TestResult["priority"],
) {
  logTestResult({
    category: "SMOKE",
    service: "storefront-auth",
    test,
    status,
    details,
    action,
    priority,
  });
}

describe("Authenticated Flows - Product Validation", () => {
  const isLocal = isLocalEnvironment();

  beforeAll(() => {
    if (!isLocal) {
      console.log(
        `⚠️  STOREFRONT_TEST_URL=${STOREFRONT_URL} is niet localhost — authenticated tests worden overgeslagen`,
      );
      console.log(
        `    Run met: STOREFRONT_TEST_URL=http://localhost:3000 npm run test -- tests/smoke/authenticated-flows.test.ts`,
      );
    }
  });

  describe("Customer Login Flow", () => {
    let customerFetch: ReturnType<typeof createAuthFetch>;
    let loginSucceeded = false;

    beforeAll(async () => {
      if (!isLocal) return;

      const result = await loginAsCustomer();
      if (result.success && result.sessionCookie) {
        customerFetch = createAuthFetch(result.sessionCookie);
        loginSucceeded = true;
        log(
          "customer-login",
          "PASS",
          "Customer login succesvol, session cookie ontvangen",
        );
      } else {
        log(
          "customer-login",
          "FAIL",
          result.error ?? "Onbekende login fout",
          "Check of test user is seeded: scripts/local-seeds/",
          "CRITICAL",
        );
      }
    });

    it("customer kan inloggen en ontvangt session cookie", () => {
      if (!isLocal) {
        log("customer-login", "WARN", "Overgeslagen: niet lokaal");
        return;
      }
      expect(loginSucceeded).toBe(true);
    });

    it("GET /api/account retourneert user data met auth", async () => {
      if (!isLocal || !loginSucceeded) {
        log("account-authenticated", "WARN", "Overgeslagen: geen auth sessie");
        return;
      }

      const response = await customerFetch(`${STOREFRONT_URL}/api/account`);

      if (response.status === 200) {
        const data = await response.json();
        log(
          "account-authenticated",
          "PASS",
          `Account data ontvangen voor user: ${data.email ?? data.data?.email ?? "unknown"}`,
        );
        expect(data).toBeTruthy();
      } else {
        log(
          "account-authenticated",
          "FAIL",
          `HTTP ${response.status} — verwacht 200`,
          "Check session middleware + account routes",
          "HIGH",
        );
        expect(response.status).toBe(200);
      }
    });

    it("GET /api/orders retourneert order lijst met auth", async () => {
      if (!isLocal || !loginSucceeded) {
        log("orders-authenticated", "WARN", "Overgeslagen: geen auth sessie");
        return;
      }

      const response = await customerFetch(`${STOREFRONT_URL}/api/orders`);

      if (response.status === 200) {
        const data = await response.json();
        const orderCount = Array.isArray(data.data) ? data.data.length : "?";
        log(
          "orders-authenticated",
          "PASS",
          `Orders opgehaald: ${orderCount} items`,
        );
      } else {
        log(
          "orders-authenticated",
          "FAIL",
          `HTTP ${response.status} — verwacht 200`,
          "Check order routes + session context",
          "HIGH",
        );
        expect(response.status).toBe(200);
      }
    });

    it("GET /api/subscription retourneert subscription data met auth", async () => {
      if (!isLocal || !loginSucceeded) {
        log(
          "subscription-authenticated",
          "WARN",
          "Overgeslagen: geen auth sessie",
        );
        return;
      }

      const response = await customerFetch(
        `${STOREFRONT_URL}/api/subscription`,
      );

      if (response.status === 200) {
        const data = await response.json();
        log(
          "subscription-authenticated",
          "PASS",
          `Subscription data ontvangen: ${JSON.stringify(data).slice(0, 100)}`,
        );
      } else {
        log(
          "subscription-authenticated",
          "FAIL",
          `HTTP ${response.status} — verwacht 200`,
          "Check subscription.routes.ts + session.userId query",
          "CRITICAL",
        );
        expect(response.status).toBe(200);
      }
    });

    it("GET /api/account/addresses retourneert adresboek met auth", async () => {
      if (!isLocal || !loginSucceeded) {
        log(
          "addresses-authenticated",
          "WARN",
          "Overgeslagen: geen auth sessie",
        );
        return;
      }

      const response = await customerFetch(
        `${STOREFRONT_URL}/api/account/addresses`,
      );

      if (response.status === 200) {
        log("addresses-authenticated", "PASS", "Adresboek opgehaald");
      } else {
        log(
          "addresses-authenticated",
          "FAIL",
          `HTTP ${response.status} — verwacht 200`,
          "Check address routes + auth context",
          "HIGH",
        );
        expect(response.status).toBe(200);
      }
    });
  });

  describe("Admin Login Flow", () => {
    let adminFetch: ReturnType<typeof createAuthFetch>;
    let loginSucceeded = false;

    beforeAll(async () => {
      if (!isLocal) return;

      const result = await loginAsAdmin();
      if (result.success && result.sessionCookie) {
        adminFetch = createAuthFetch(result.sessionCookie);
        loginSucceeded = true;
        log(
          "admin-login",
          "PASS",
          "Admin login succesvol, session cookie ontvangen",
        );
      } else {
        log(
          "admin-login",
          "FAIL",
          result.error ?? "Onbekende admin login fout",
          "Check of admin user is seeded + POST /api/admin/login endpoint",
          "CRITICAL",
        );
      }
    });

    it("admin kan inloggen en ontvangt session cookie", () => {
      if (!isLocal) {
        log("admin-login", "WARN", "Overgeslagen: niet lokaal");
        return;
      }
      expect(loginSucceeded).toBe(true);
    });

    it("GET /api/admin/orders retourneert data met admin auth", async () => {
      if (!isLocal || !loginSucceeded) {
        log(
          "admin-orders-authenticated",
          "WARN",
          "Overgeslagen: geen admin sessie",
        );
        return;
      }

      const response = await adminFetch(`${STOREFRONT_URL}/api/admin/orders`);

      if (response.status === 200) {
        const data = await response.json();
        log(
          "admin-orders-authenticated",
          "PASS",
          `Admin orders opgehaald: ${JSON.stringify(data).slice(0, 100)}`,
        );
      } else {
        log(
          "admin-orders-authenticated",
          "FAIL",
          `HTTP ${response.status} — verwacht 200`,
          "Check admin routes + requireAdmin middleware",
          "HIGH",
        );
        expect(response.status).toBe(200);
      }
    });

    it("GET /api/admin/subscriptions retourneert data met admin auth", async () => {
      if (!isLocal || !loginSucceeded) {
        log(
          "admin-subscriptions-authenticated",
          "WARN",
          "Overgeslagen: geen admin sessie",
        );
        return;
      }

      const response = await adminFetch(
        `${STOREFRONT_URL}/api/admin/subscriptions`,
      );

      if (response.status === 200) {
        const data = await response.json();
        log(
          "admin-subscriptions-authenticated",
          "PASS",
          `Admin subscriptions opgehaald: ${JSON.stringify(data).slice(0, 100)}`,
        );
      } else {
        log(
          "admin-subscriptions-authenticated",
          "FAIL",
          `HTTP ${response.status} — verwacht 200`,
          "Check admin subscription routes",
          "HIGH",
        );
        expect(response.status).toBe(200);
      }
    });

    it("GET /api/admin/team retourneert team data met admin auth", async () => {
      if (!isLocal || !loginSucceeded) {
        log(
          "admin-team-authenticated",
          "WARN",
          "Overgeslagen: geen admin sessie",
        );
        return;
      }

      const response = await adminFetch(`${STOREFRONT_URL}/api/admin/team`);

      if (response.status === 200) {
        log("admin-team-authenticated", "PASS", "Admin team data opgehaald");
      } else {
        log(
          "admin-team-authenticated",
          "FAIL",
          `HTTP ${response.status} — verwacht 200`,
          "Check admin team routes",
          "HIGH",
        );
        expect(response.status).toBe(200);
      }
    });
  });

  describe("Cross-check: ongeauthenticeerd MOET falen", () => {
    it("GET /api/account zonder auth retourneert 401", async () => {
      if (!isLocal) return;

      const response = await fetch(`${STOREFRONT_URL}/api/account`);
      log(
        "account-no-auth-guard",
        response.status === 401 ? "PASS" : "FAIL",
        `Status: ${response.status} (verwacht: 401)`,
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/subscription zonder auth retourneert 401", async () => {
      if (!isLocal) return;

      const response = await fetch(`${STOREFRONT_URL}/api/subscription`);
      log(
        "subscription-no-auth-guard",
        response.status === 401 ? "PASS" : "FAIL",
        `Status: ${response.status} (verwacht: 401)`,
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/admin/orders zonder auth retourneert 401", async () => {
      if (!isLocal) return;

      const response = await fetch(`${STOREFRONT_URL}/api/admin/orders`);
      log(
        "admin-orders-no-auth-guard",
        [401, 403].includes(response.status) ? "PASS" : "FAIL",
        `Status: ${response.status} (verwacht: 401 of 403)`,
      );
      expect([401, 403]).toContain(response.status);
    });
  });
});
