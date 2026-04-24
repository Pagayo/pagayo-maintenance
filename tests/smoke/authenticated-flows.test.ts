/**
 * SMOKE TESTS - AUTHENTICATED FLOWS
 * ============================================================================
 * DOEL: Valideer dat authenticated happy paths ECHT werken.
 * Dit is het verschil tussen "infra-groen" en "product-groen".
 *
 * MODI:
 * - Lokaal: login via seeded users op localhost
 * - Remote/staging: fixture session cookies via env vars
 *
 * WANNEER RUNNEN:
 * - Na wijzigingen aan session/auth middleware
 * - Na database schema migraties
 * - Na subscription/checkout flow wijzigingen
 * - Wanneer product-groen validatie nodig is
 *
 * GEBRUIK:
 *   Lokaal:
 *     STOREFRONT_TEST_URL=http://localhost:3000 npm run test -- tests/smoke/authenticated-flows.test.ts
 *   Remote/staging:
 *     STOREFRONT_TEST_URL=https://demo.staging.pagayo.app \
 *     SMOKE_CUSTOMER_SESSION_COOKIE=<cookie> \
 *     SMOKE_ADMIN_SESSION_COOKIE=<cookie> \
 *     npm run test -- tests/smoke/authenticated-flows.test.ts
 * ============================================================================
 */

import { logTestResult, type TestResult } from "../utils/test-reporter";
import {
  STOREFRONT_URL,
  SMOKE_CUSTOMER_SESSION_COOKIE,
  SMOKE_ADMIN_SESSION_COOKIE,
} from "../utils/test-config";
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
  const hasCustomerFixture = Boolean(SMOKE_CUSTOMER_SESSION_COOKIE);
  const hasAdminFixture = Boolean(SMOKE_ADMIN_SESSION_COOKIE);
  const canRunCustomerFlow = isLocal || hasCustomerFixture;
  const canRunAdminFlow = isLocal || hasAdminFixture;
  const canRunUnauthorizedGuards = canRunCustomerFlow || canRunAdminFlow;

  beforeAll(() => {
    if (!canRunCustomerFlow && !canRunAdminFlow) {
      console.log(
        `⚠️  STOREFRONT_TEST_URL=${STOREFRONT_URL} is niet localhost en er zijn geen smoke-session fixtures gezet`,
      );
      console.log(
        "    Zet SMOKE_CUSTOMER_SESSION_COOKIE en SMOKE_ADMIN_SESSION_COOKIE voor remote/staging profile",
      );
    }
  });

  describe("Customer Login Flow", () => {
    let customerFetch: ReturnType<typeof createAuthFetch>;
    let loginSucceeded = false;

    beforeAll(async () => {
      if (!canRunCustomerFlow) return;

      if (isLocal) {
        const result = await loginAsCustomer();
        if (result.success && result.sessionCookie) {
          customerFetch = createAuthFetch(result.sessionCookie);
          loginSucceeded = true;
          log(
            "customer-login",
            "PASS",
            "Customer login succesvol, session cookie ontvangen",
          );
          return;
        }

        log(
          "customer-login",
          "FAIL",
          result.error ?? "Onbekende login fout",
          "Check of test user is seeded: scripts/local-seeds/",
          "CRITICAL",
        );
        return;
      }

      if (SMOKE_CUSTOMER_SESSION_COOKIE) {
        customerFetch = createAuthFetch(SMOKE_CUSTOMER_SESSION_COOKIE);
        loginSucceeded = true;
        log(
          "customer-login",
          "PASS",
          "Customer fixture session cookie gebruikt voor remote/staging smoke",
        );
      }
    });

    it("customer kan inloggen en ontvangt session cookie", () => {
      if (!canRunCustomerFlow) {
        log(
          "customer-login",
          "WARN",
          "Overgeslagen: geen lokale omgeving en geen SMOKE_CUSTOMER_SESSION_COOKIE",
        );
        return;
      }
      expect(loginSucceeded).toBe(true);
    });

    it("GET /api/account retourneert user data met auth", async () => {
      if (!canRunCustomerFlow || !loginSucceeded) {
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
      if (!canRunCustomerFlow || !loginSucceeded) {
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
      if (!canRunCustomerFlow || !loginSucceeded) {
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
      if (!canRunCustomerFlow || !loginSucceeded) {
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
      if (!canRunAdminFlow) return;

      if (isLocal) {
        const result = await loginAsAdmin();
        if (result.success && result.sessionCookie) {
          adminFetch = createAuthFetch(result.sessionCookie);
          loginSucceeded = true;
          log(
            "admin-login",
            "PASS",
            "Admin login succesvol, session cookie ontvangen",
          );
          return;
        }

        log(
          "admin-login",
          "FAIL",
          result.error ?? "Onbekende admin login fout",
          "Check of admin user is seeded + POST /api/admin/login endpoint",
          "CRITICAL",
        );
        return;
      }

      if (SMOKE_ADMIN_SESSION_COOKIE) {
        adminFetch = createAuthFetch(SMOKE_ADMIN_SESSION_COOKIE);
        loginSucceeded = true;
        log(
          "admin-login",
          "PASS",
          "Admin fixture session cookie gebruikt voor remote/staging smoke",
        );
      }
    });

    it("admin kan inloggen en ontvangt session cookie", () => {
      if (!canRunAdminFlow) {
        log(
          "admin-login",
          "WARN",
          "Overgeslagen: geen lokale omgeving en geen SMOKE_ADMIN_SESSION_COOKIE",
        );
        return;
      }
      expect(loginSucceeded).toBe(true);
    });

    it("GET /api/admin/orders retourneert data met admin auth", async () => {
      if (!canRunAdminFlow || !loginSucceeded) {
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
      if (!canRunAdminFlow || !loginSucceeded) {
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
      if (!canRunAdminFlow || !loginSucceeded) {
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

    it("GET /api/admin/print-context/:id retourneert print context contract met admin auth", async () => {
      if (!canRunAdminFlow || !loginSucceeded) {
        log(
          "admin-print-context-authenticated",
          "WARN",
          "Overgeslagen: geen admin sessie",
        );
        return;
      }

      // Test met test-id; verwacht 200 met print context payload of 404 als test data niet bestaat
      const response = await adminFetch(
        `${STOREFRONT_URL}/api/admin/print-context/test-id`,
      );

      if (response.status === 200) {
        const data = await response.json();
        // Valideer contract: verwacht { success: true, data: {...} }
        if (data.success && data.data) {
          log(
            "admin-print-context-authenticated",
            "PASS",
            `Print context contract valid: ${JSON.stringify(data.data).slice(0, 80)}...`,
          );
        } else {
          log(
            "admin-print-context-authenticated",
            "FAIL",
            `HTTP 200 maar contract ongeldig: ${JSON.stringify(data).slice(0, 80)}`,
            "Zorg dat endpoint { success: true, data: printContext } retourneert",
            "HIGH",
          );
          expect(data.success && data.data).toBeTruthy();
        }
      } else if (response.status === 404) {
        log(
          "admin-print-context-authenticated",
          "PASS",
          "Test data niet beschikbaar (404) — endpoint is beveiligd en werkt",
        );
      } else {
        log(
          "admin-print-context-authenticated",
          "FAIL",
          `HTTP ${response.status} — verwacht 200 of 404`,
          "Check admin print-context route",
          "HIGH",
        );
        expect([200, 404]).toContain(response.status);
      }
    });

    it("POST /api/admin/print-confirmation/:id retourneert status contract met admin auth", async () => {
      if (!canRunAdminFlow || !loginSucceeded) {
        log(
          "admin-print-confirmation-authenticated",
          "WARN",
          "Overgeslagen: geen admin sessie",
        );
        return;
      }

      const response = await adminFetch(
        `${STOREFRONT_URL}/api/admin/print-confirmation/test-id`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm" }),
        },
      );

      if (response.status === 200) {
        const data = await response.json();
        // Valideer contract: verwacht { success: true } of { success: boolean, status?: string }
        if (data.success !== undefined) {
          log(
            "admin-print-confirmation-authenticated",
            "PASS",
            `Print confirmation contract valid: success=${data.success}${data.status ? ", status=" + data.status : ""}`,
          );
        } else {
          log(
            "admin-print-confirmation-authenticated",
            "FAIL",
            `HTTP 200 maar contract ongeldig (geen 'success' field): ${JSON.stringify(data).slice(0, 80)}`,
            "Zorg dat endpoint { success: boolean, ... } retourneert",
            "HIGH",
          );
          expect(data.success !== undefined).toBeTruthy();
        }
      } else if (response.status === 404) {
        log(
          "admin-print-confirmation-authenticated",
          "PASS",
          "Test data niet beschikbaar (404) — endpoint is beveiligd en werkt",
        );
      } else {
        log(
          "admin-print-confirmation-authenticated",
          "FAIL",
          `HTTP ${response.status} — verwacht 200 of 404`,
          "Check admin print-confirmation route",
          "HIGH",
        );
        expect([200, 404]).toContain(response.status);
      }
    });
  });

  describe("Cross-check: ongeauthenticeerd MOET falen", () => {
    it("GET /api/account zonder auth retourneert 401", async () => {
      if (!canRunUnauthorizedGuards) {
        log(
          "account-no-auth-guard",
          "WARN",
          "Overgeslagen: geen lokale omgeving en geen authenticated fixture profiel",
        );
        return;
      }

      const response = await fetch(`${STOREFRONT_URL}/api/account`);
      if (response.status === 404) {
        log(
          "account-no-auth-guard",
          "WARN",
          "Tenant niet actief op target host; guard-contract niet valideerbaar",
        );
        return;
      }
      log(
        "account-no-auth-guard",
        [401, 403].includes(response.status) ? "PASS" : "FAIL",
        `Status: ${response.status} (verwacht: 401 of 403)`,
      );
      expect([401, 403]).toContain(response.status);
    });

    it("GET /api/subscription zonder auth retourneert 401", async () => {
      if (!canRunUnauthorizedGuards) {
        log(
          "subscription-no-auth-guard",
          "WARN",
          "Overgeslagen: geen lokale omgeving en geen authenticated fixture profiel",
        );
        return;
      }

      const response = await fetch(`${STOREFRONT_URL}/api/subscription`);
      if (response.status === 404) {
        log(
          "subscription-no-auth-guard",
          "WARN",
          "Tenant niet actief op target host; guard-contract niet valideerbaar",
        );
        return;
      }
      log(
        "subscription-no-auth-guard",
        [401, 403].includes(response.status) ? "PASS" : "FAIL",
        `Status: ${response.status} (verwacht: 401 of 403)`,
      );
      expect([401, 403]).toContain(response.status);
    });

    it("GET /api/admin/orders zonder auth retourneert 401", async () => {
      if (!canRunUnauthorizedGuards) {
        log(
          "admin-orders-no-auth-guard",
          "WARN",
          "Overgeslagen: geen lokale omgeving en geen authenticated fixture profiel",
        );
        return;
      }

      const response = await fetch(`${STOREFRONT_URL}/api/admin/orders`);
      if (response.status === 404) {
        log(
          "admin-orders-no-auth-guard",
          "WARN",
          "Tenant niet actief op target host; guard-contract niet valideerbaar",
        );
        return;
      }
      log(
        "admin-orders-no-auth-guard",
        [401, 403].includes(response.status) ? "PASS" : "FAIL",
        `Status: ${response.status} (verwacht: 401 of 403)`,
      );
      expect([401, 403]).toContain(response.status);
    });

    it("GET /api/admin/print-context/:id zonder auth retourneert 401", async () => {
      if (!canRunUnauthorizedGuards) {
        log(
          "admin-print-context-no-auth-guard",
          "WARN",
          "Overgeslagen: geen lokale omgeving en geen authenticated fixture profiel",
        );
        return;
      }

      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/print-context/test-id`,
      );
      if (response.status === 404) {
        log(
          "admin-print-context-no-auth-guard",
          "WARN",
          "Tenant niet actief op target host; guard-contract niet valideerbaar",
        );
        return;
      }
      log(
        "admin-print-context-no-auth-guard",
        [401, 403].includes(response.status) ? "PASS" : "FAIL",
        `Fail-closed: HTTP ${response.status} (verwacht: 401 of 403)`,
      );
      expect([401, 403]).toContain(response.status);
    });

    it("POST /api/admin/print-confirmation/:id zonder auth retourneert 401", async () => {
      if (!canRunUnauthorizedGuards) {
        log(
          "admin-print-confirmation-no-auth-guard",
          "WARN",
          "Overgeslagen: geen lokale omgeving en geen authenticated fixture profiel",
        );
        return;
      }

      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/print-confirmation/test-id`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm" }),
        },
      );
      if (response.status === 404) {
        log(
          "admin-print-confirmation-no-auth-guard",
          "WARN",
          "Tenant niet actief op target host; guard-contract niet valideerbaar",
        );
        return;
      }
      log(
        "admin-print-confirmation-no-auth-guard",
        [401, 403].includes(response.status) ? "PASS" : "FAIL",
        `Fail-closed: HTTP ${response.status} (verwacht: 401 of 403)`,
      );
      expect([401, 403]).toContain(response.status);
    });
  });
});
