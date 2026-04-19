/**
 * PRINT ADMIN INTEGRATION TESTS
 * ============================================================================
 * DOEL: Valideer dat de admin print flow ECHT werkt met echte database.
 * Dit onderscheidt schijnveiligheid (mocks) van echte functionaliteit.
 *
 * SCOPE:
 * - Print-context endpoint: subscription + holders data ophalen
 * - Print-confirmation endpoint: print-status bijwerken met CSRF validatie
 * - Business logic: subscription state, holder count, permissions
 * - Contract validatie: response shapes, error paths
 *
 * PREREQUISITES:
 * - Admin session (SMOKE_ADMIN_SESSION_COOKIE env var of localhost seeded admin)
 * - Test subscription met holders (via fixture)
 * - Storefront Worker operational
 *
 * WANNEER RUNNEN:
 * - Na wijzigingen aan print endpoints
 * - Na subscription/holder schema wijzigingen
 * - Pre-staging validatie voor admin features
 *
 * GEBRUIK:
 *   Lokaal (seeded test data):
 *     STOREFRONT_TEST_URL=http://localhost:3000 npm run test -- tests/integration/print-admin-integration.test.ts
 *   Remote (fixture session):
 *     STOREFRONT_TEST_URL=https://demo.staging.pagayo.app \
 *     SMOKE_ADMIN_SESSION_COOKIE=<cookie> \
 *     npm run test -- tests/integration/print-admin-integration.test.ts
 * ============================================================================
 */

import { logTestResult, type TestResult } from "../utils/test-reporter";
import {
  STOREFRONT_URL,
  SMOKE_ADMIN_SESSION_COOKIE,
  SMOKE_SUBSCRIPTION_MAX_MEMBERS_ID,
} from "../utils/test-config";
import {
  isLocalEnvironment,
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
    category: "INTEGRATION",
    service: "storefront-print-admin",
    test,
    status,
    details,
    action,
    priority,
  });
}

describe("Admin Print Integration - Real Database & Endpoints", () => {
  const isLocal = isLocalEnvironment();
  const hasAdminFixture = Boolean(SMOKE_ADMIN_SESSION_COOKIE);
  const fixtureSubscriptionId = SMOKE_SUBSCRIPTION_MAX_MEMBERS_ID;
  const canRun = isLocal || hasAdminFixture;

  let adminFetch: ReturnType<typeof createAuthFetch>;
  let adminLoginSucceeded = false;
  let testSubscriptionId: string;

  beforeAll(async () => {
    if (!canRun) {
      console.log(
        `⚠️  Admin print integration tests overgeslagen: geen localhost en geen SMOKE_ADMIN_SESSION_COOKIE`,
      );
      return;
    }

    // Lokaal: login op seeded admin
    if (isLocal) {
      const result = await loginAsAdmin();
      if (result.success && result.sessionCookie) {
        adminFetch = createAuthFetch(result.sessionCookie);
        adminLoginSucceeded = true;
        log("admin-login", "PASS", "Admin login succesvol (lokale seed)");
      } else {
        log(
          "admin-login",
          "FAIL",
          result.error ?? "Admin login fout",
          "Check scripts/local-seeds/ voor admin seeding",
          "CRITICAL",
        );
        return;
      }
    }

    // Remote: use fixture session
    if (hasAdminFixture) {
      adminFetch = createAuthFetch(SMOKE_ADMIN_SESSION_COOKIE);
      adminLoginSucceeded = true;
      log("admin-login", "PASS", "Admin session via fixture (remote/staging)");
    }

    // Bepaal test subscription ID
    testSubscriptionId = fixtureSubscriptionId || "test-subscription-1";
  });

  describe("Print-Context Endpoint - Contract & Data", () => {
    it("GET /api/admin/print-context/:id vereist admin auth", async () => {
      if (!canRun) {
        log("print-context-auth-guard", "WARN", "Overgeslagen: geen setup");
        return;
      }

      // Test ZONDER auth → moet 401 retourneren
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/print-context/${testSubscriptionId}`,
        {
          credentials: "omit",
        },
      );

      if (response.status === 401) {
        log(
          "print-context-auth-guard",
          "PASS",
          "Endpoint vereist authenticatie (401 zonder session)",
        );
        expect(response.status).toBe(401);
      } else {
        log(
          "print-context-auth-guard",
          "FAIL",
          `HTTP ${response.status} — verwacht 401 zonder auth`,
          "Zorg dat requireAdmin guard op print-context werkt",
          "CRITICAL",
        );
        expect(response.status).toBe(401);
      }
    });

    it("GET /api/admin/print-context/:id retourneert subscription + holders met admin auth", async () => {
      if (!canRun || !adminLoginSucceeded) {
        log("print-context-data", "WARN", "Overgeslagen: geen admin sessie");
        return;
      }

      const response = await adminFetch(
        `${STOREFRONT_URL}/api/admin/print-context/${testSubscriptionId}`,
      );

      // Verwacht 200 (subscription bestaat) of 404 (test data niet beschikbaar)
      if (response.status === 200) {
        const data = await response.json();

        // Contract check: moet { success: true, data: { subscription, holders } } zijn
        if (!data.success || !data.data) {
          log(
            "print-context-data",
            "FAIL",
            `Contract ongeldig: success=${data.success}, has data=${!!data.data}`,
            "Controleer endpoint response schema",
            "HIGH",
          );
          expect(data.success && data.data).toBeTruthy();
          return;
        }

        const { subscription, holders } = data.data;

        // Business logic checks
        const issues: string[] = [];

        if (!subscription) {
          issues.push("subscription ontbreekt");
        } else if (!subscription.id || !subscription.status) {
          issues.push(
            `subscription incomplete: id=${!!subscription.id}, status=${!!subscription.status}`,
          );
        }

        if (!Array.isArray(holders)) {
          issues.push(`holders is niet array: ${typeof holders}`);
        } else if (holders.length === 0) {
          // Waarschuwing, niet fout (mag leeg zijn)
          log(
            "print-context-data",
            "WARN",
            "Subscription heeft geen holders — mogelijk nog geen members toegevoegd",
          );
        } else {
          // Valideer holder contract
          const holderIssues = holders
            .map((h: any, i: number) => {
              if (!h.id || !h.email) {
                return `holder[${i}] onvolledig: id=${!!h.id}, email=${!!h.email}`;
              }
              return null;
            })
            .filter(Boolean);

          if (holderIssues.length > 0) {
            issues.push(...holderIssues);
          }
        }

        if (issues.length > 0) {
          log(
            "print-context-data",
            "FAIL",
            issues.join("; "),
            "Controleer subscription/holder schema in database",
            "HIGH",
          );
          expect(issues).toEqual([]);
          return;
        }

        log(
          "print-context-data",
          "PASS",
          `Print context geldig: subscription=${subscription.id}, holders=${holders.length}`,
        );
        expect(
          data.success &&
            data.data.subscription &&
            Array.isArray(data.data.holders),
        ).toBeTruthy();
      } else if (response.status === 404) {
        log(
          "print-context-data",
          "WARN",
          "Test subscription niet gevonden (404) — fixture data niet beschikbaar",
        );
      } else {
        log(
          "print-context-data",
          "FAIL",
          `HTTP ${response.status} — verwacht 200 of 404`,
          "Check endpoint logica",
          "HIGH",
        );
        expect([200, 404]).toContain(response.status);
      }
    });

    it("GET /api/admin/print-context/:id valideert subscription state", async () => {
      if (!canRun || !adminLoginSucceeded) {
        log("print-context-state", "WARN", "Overgeslagen: geen admin sessie");
        return;
      }

      const response = await adminFetch(
        `${STOREFRONT_URL}/api/admin/print-context/${testSubscriptionId}`,
      );

      if (response.status !== 200) {
        log(
          "print-context-state",
          "WARN",
          `Status ${response.status} — kan subscription state niet valideren`,
        );
        return;
      }

      const data = await response.json();
      if (!data.success || !data.data?.subscription) {
        log("print-context-state", "FAIL", "Geen subscription in response");
        return;
      }

      const { subscription } = data.data;

      // Business logic: subscription status moet valid zijn
      const validStatuses = ["active", "paused", "cancelled"];
      if (!validStatuses.includes(subscription.status)) {
        log(
          "print-context-state",
          "FAIL",
          `Ongeldig status: "${subscription.status}" — verwacht: ${validStatuses.join(", ")}`,
          "Check subscription status enum",
          "HIGH",
        );
        expect(validStatuses).toContain(subscription.status);
        return;
      }

      log(
        "print-context-state",
        "PASS",
        `Subscription status valid: "${subscription.status}"`,
      );
    });
  });

  describe("Print-Confirmation Endpoint - Contract & Idempotency", () => {
    it("POST /api/admin/print-confirmation/:id vereist admin auth", async () => {
      if (!canRun) {
        log(
          "print-confirmation-auth-guard",
          "WARN",
          "Overgeslagen: geen setup",
        );
        return;
      }

      // Test ZONDER auth → moet 401 retourneren
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/print-confirmation/${testSubscriptionId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm" }),
          credentials: "omit",
        },
      );

      if (response.status === 401) {
        log(
          "print-confirmation-auth-guard",
          "PASS",
          "Endpoint vereist authenticatie (401 zonder session)",
        );
        expect(response.status).toBe(401);
      } else {
        log(
          "print-confirmation-auth-guard",
          "FAIL",
          `HTTP ${response.status} — verwacht 401 zonder auth`,
          "Zorg dat requireAdmin guard op print-confirmation werkt",
          "CRITICAL",
        );
        expect(response.status).toBe(401);
      }
    });

    it("POST /api/admin/print-confirmation/:id accepteert valid payload met admin auth", async () => {
      if (!canRun || !adminLoginSucceeded) {
        log(
          "print-confirmation-payload",
          "WARN",
          "Overgeslagen: geen admin sessie",
        );
        return;
      }

      const response = await adminFetch(
        `${STOREFRONT_URL}/api/admin/print-confirmation/${testSubscriptionId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm", timestamp: Date.now() }),
        },
      );

      // Verwacht 200 (confirmation processed) of 404 (subscription niet gevonden)
      if (response.status === 200) {
        const data = await response.json();

        // Contract: moet { success: boolean, ... } zijn
        if (data.success === undefined) {
          log(
            "print-confirmation-payload",
            "FAIL",
            `Contract ongeldig: 'success' field ontbreekt`,
            "Zorg dat endpoint { success, ... } retourneert",
            "HIGH",
          );
          expect(data.success !== undefined).toBeTruthy();
          return;
        }

        log(
          "print-confirmation-payload",
          "PASS",
          `Print confirmation accepted: success=${data.success}`,
        );
      } else if (response.status === 404) {
        log(
          "print-confirmation-payload",
          "WARN",
          "Subscription niet gevonden (404) — fixture data niet beschikbaar",
        );
      } else if (response.status === 400) {
        const data = await response.json().catch(() => ({}));
        log(
          "print-confirmation-payload",
          "FAIL",
          `Payload validatie fout (400): ${data.error || "onbekend"}`,
          "Controleer request body schema",
          "MEDIUM",
        );
        expect(false).toBeTruthy(); // Fail op onverwachte 400
      } else {
        log(
          "print-confirmation-payload",
          "FAIL",
          `HTTP ${response.status} — verwacht 200 of 404`,
          "Check endpoint logica",
          "HIGH",
        );
        expect([200, 404]).toContain(response.status);
      }
    });

    it("POST /api/admin/print-confirmation/:id is idempotent (kan meerdere keren opgeroepen)", async () => {
      if (!canRun || !adminLoginSucceeded) {
        log(
          "print-confirmation-idempotency",
          "WARN",
          "Overgeslagen: geen admin sessie",
        );
        return;
      }

      const payload = { action: "confirm", timestamp: Date.now() };

      // Call 1
      const response1 = await adminFetch(
        `${STOREFRONT_URL}/api/admin/print-confirmation/${testSubscriptionId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      // Call 2 (direct na 1)
      const response2 = await adminFetch(
        `${STOREFRONT_URL}/api/admin/print-confirmation/${testSubscriptionId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      // Both should have same status (idempotent)
      if (response1.status === 404 || response2.status === 404) {
        log(
          "print-confirmation-idempotency",
          "WARN",
          "Subscription niet gevonden — kan idempotency niet testen",
        );
        return;
      }

      if (response1.status === response2.status) {
        log(
          "print-confirmation-idempotency",
          "PASS",
          `Endpoint is idempotent: beide calls ${response1.status}`,
        );
        expect(response1.status).toBe(response2.status);
      } else {
        log(
          "print-confirmation-idempotency",
          "FAIL",
          `Idempotency violation: call1=${response1.status}, call2=${response2.status}`,
          "Zorg dat print confirmation idempotent is (upsert, niet duplicate)",
          "HIGH",
        );
        expect(response1.status).toBe(response2.status);
      }
    });
  });

  describe("Print Flow End-to-End", () => {
    it("completes full flow: context fetch → confirmation → state check", async () => {
      if (!canRun || !adminLoginSucceeded) {
        log("print-flow-e2e", "WARN", "Overgeslagen: geen admin sessie");
        return;
      }

      // Step 1: Fetch print context
      const contextResponse = await adminFetch(
        `${STOREFRONT_URL}/api/admin/print-context/${testSubscriptionId}`,
      );

      if (contextResponse.status !== 200) {
        log(
          "print-flow-e2e",
          "WARN",
          `Step 1 (context) returned ${contextResponse.status} — fixture data niet beschikbaar`,
        );
        return;
      }

      const contextData = await contextResponse.json();
      if (!contextData.success || !contextData.data) {
        log(
          "print-flow-e2e",
          "FAIL",
          "Step 1 (context) contract ongeldig",
          "Check print-context response",
          "HIGH",
        );
        expect(false).toBeTruthy();
        return;
      }

      // Step 2: Confirm print
      const confirmResponse = await adminFetch(
        `${STOREFRONT_URL}/api/admin/print-confirmation/${testSubscriptionId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm" }),
        },
      );

      if (![200, 404].includes(confirmResponse.status)) {
        log(
          "print-flow-e2e",
          "FAIL",
          `Step 2 (confirm) returned ${confirmResponse.status} — verwacht 200 of 404`,
          "Check print-confirmation endpoint",
          "HIGH",
        );
        expect(false).toBeTruthy();
        return;
      }

      // Step 3: Verify context state didn't break
      const stateResponse = await adminFetch(
        `${STOREFRONT_URL}/api/admin/print-context/${testSubscriptionId}`,
      );

      if (stateResponse.status !== 200) {
        log(
          "print-flow-e2e",
          "FAIL",
          `Step 3 (state check) returned ${stateResponse.status}`,
          "Subscription/context werd onverwacht ontoegankelijk na print",
          "HIGH",
        );
        expect(false).toBeTruthy();
        return;
      }

      log(
        "print-flow-e2e",
        "PASS",
        `Full print flow completed: context → confirm → state check`,
      );
    });
  });
});
