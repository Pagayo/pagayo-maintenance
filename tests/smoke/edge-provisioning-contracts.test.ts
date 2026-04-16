/**
 * SMOKE TESTS - EDGE + PROVISIONING CONTRACTS
 * ============================================================================
 * DOEL: Valideert fail-closed auth contracten voor edge rate-limit,
 * provisioning routes en workflows API.
 *
 * WAAROM:
 * Deze paden zijn security-kritiek en vielen eerder buiten smoke-dekking.
 *
 * OPMERKING:
 * Positive-path checks met secrets draaien alleen als EDGE_TEST_SECRET is gezet.
 * ============================================================================
 */

import { logTestResult, type TestResult } from "../utils/test-reporter";
import {
  EDGE_URL,
  STOREFRONT_URL,
  PLATFORM_ADMIN_URL,
  WORKFLOWS_URL,
} from "../utils/test-config";

const EDGE_TEST_SECRET = process.env.EDGE_TEST_SECRET;

async function safeFetch(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, init);
  } catch {
    return null;
  }
}

function log(
  test: string,
  status: TestResult["status"],
  details: string,
  action?: string,
  priority?: TestResult["priority"],
) {
  logTestResult({
    category: "SMOKE",
    service: "edge-provisioning-contracts",
    test,
    status,
    details,
    action,
    priority,
  });
}

describe("Edge + Provisioning Contracts - Smoke Tests", () => {
  describe("Edge rate-limit trusted auth", () => {
    it("POST /api/rate-limit/check fails closed without trusted auth", async () => {
      const response = await safeFetch(`${EDGE_URL}/api/rate-limit/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "smoke-edge-auth-check",
          type: "ip",
        }),
      });

      if (!response) {
        log(
          "edge-rate-limit-check-unauthorized",
          "SKIP",
          `Edge endpoint niet bereikbaar (${EDGE_URL})`,
        );
        return;
      }

      if ([401, 403].includes(response.status)) {
        log(
          "edge-rate-limit-check-unauthorized",
          "PASS",
          `Fail-closed: HTTP ${response.status}`,
        );
      } else {
        log(
          "edge-rate-limit-check-unauthorized",
          "FAIL",
          `Onverwachte status: HTTP ${response.status}`,
          "Check edge trusted auth contract op /api/rate-limit/check",
          "CRITICAL",
        );
      }

      expect([401, 403]).toContain(response.status);
    });

    it("GET /api/rate-limit/status fails closed without trusted auth", async () => {
      const response = await safeFetch(
        `${EDGE_URL}/api/rate-limit/status/ip/smoke-edge-auth-status`,
      );

      if (!response) {
        log(
          "edge-rate-limit-status-unauthorized",
          "SKIP",
          `Edge endpoint niet bereikbaar (${EDGE_URL})`,
        );
        return;
      }

      if ([401, 403].includes(response.status)) {
        log(
          "edge-rate-limit-status-unauthorized",
          "PASS",
          `Fail-closed: HTTP ${response.status}`,
        );
      } else {
        log(
          "edge-rate-limit-status-unauthorized",
          "FAIL",
          `Onverwachte status: HTTP ${response.status}`,
          "Check edge trusted auth contract op /api/rate-limit/status/*",
          "CRITICAL",
        );
      }

      expect([401, 403]).toContain(response.status);
    });

    it("trusted caller can access edge rate-limit endpoints (optional)", async () => {
      if (!EDGE_TEST_SECRET) {
        log(
          "edge-rate-limit-trusted-optional",
          "SKIP",
          "EDGE_TEST_SECRET niet gezet; positive-path overgeslagen",
        );
        return;
      }

      const checkResponse = await fetch(`${EDGE_URL}/api/rate-limit/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Edge-Secret": EDGE_TEST_SECRET,
        },
        body: JSON.stringify({
          identifier: "smoke-edge-auth-positive",
          type: "ip",
        }),
      });

      const statusResponse = await fetch(
        `${EDGE_URL}/api/rate-limit/status/ip/smoke-edge-auth-positive`,
        {
          headers: { "X-Edge-Secret": EDGE_TEST_SECRET },
        },
      );

      const checkOk = [200, 429].includes(checkResponse.status);
      const statusOk = statusResponse.status === 200;

      if (checkOk && statusOk) {
        log(
          "edge-rate-limit-trusted-optional",
          "PASS",
          `Trusted path OK: check=${checkResponse.status}, status=${statusResponse.status}`,
        );
      } else {
        log(
          "edge-rate-limit-trusted-optional",
          "FAIL",
          `Trusted path mismatch: check=${checkResponse.status}, status=${statusResponse.status}`,
          "Controleer EDGE secret wiring en edge route contracts",
          "HIGH",
        );
      }

      expect(checkOk).toBe(true);
      expect(statusOk).toBe(true);
    });
  });

  describe("Provisioning contracts", () => {
    it("POST /api/provisioning/tenants requires API key or service binding", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/provisioning/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Smoke Tenant",
          organizationId: "org_smoke_contract",
        }),
      });

      if ([401, 403].includes(response.status)) {
        log(
          "provisioning-tenants-unauthorized",
          "PASS",
          `Fail-closed (expected): HTTP ${response.status}`,
        );
      } else {
        log(
          "provisioning-tenants-unauthorized",
          "FAIL",
          `Onverwachte status: HTTP ${response.status}`,
          "Check provisioning API key middleware op /api/provisioning/tenants",
          "CRITICAL",
        );
      }

      expect([401, 403]).toContain(response.status);
    });

    it("POST /api/platform/tenants/provision remains protected by platform auth", async () => {
      const response = await fetch(
        `${PLATFORM_ADMIN_URL}/api/platform/tenants/provision`,
        {
          method: "POST",
          redirect: "manual",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: "org_smoke_platform",
            name: "Smoke Platform Tenant",
          }),
        },
      );

      if ([401, 403, 302].includes(response.status)) {
        log(
          "platform-provisioning-protected",
          "PASS",
          `Route beschermd: HTTP ${response.status}`,
        );
      } else {
        log(
          "platform-provisioning-protected",
          "FAIL",
          `Onverwachte status: HTTP ${response.status}`,
          "Check CF Access/platform auth bescherming op /api/platform/*",
          "CRITICAL",
        );
      }

      expect([401, 403, 302]).toContain(response.status);
    });
  });

  describe("Workflows API trusted auth", () => {
    it("GET /api/workflows/* fails closed without X-Edge-Secret", async () => {
      const response = await safeFetch(
        `${WORKFLOWS_URL}/api/workflows/order/create`,
      );

      if (!response) {
        log(
          "workflows-api-unauthorized",
          "SKIP",
          `Workflows endpoint niet bereikbaar (${WORKFLOWS_URL})`,
        );
        return;
      }

      if ([401, 403].includes(response.status)) {
        log(
          "workflows-api-unauthorized",
          "PASS",
          `Fail-closed: HTTP ${response.status}`,
        );
      } else {
        log(
          "workflows-api-unauthorized",
          "FAIL",
          `Onverwachte status: HTTP ${response.status}`,
          "Check workflows auth contract op /api/workflows/*",
          "CRITICAL",
        );
      }

      expect([401, 403]).toContain(response.status);
    });

    it("X-Edge-Secret unlocks workflows routing contract (optional)", async () => {
      if (!EDGE_TEST_SECRET) {
        log(
          "workflows-api-trusted-optional",
          "SKIP",
          "EDGE_TEST_SECRET niet gezet; positive-path overgeslagen",
        );
        return;
      }

      const response = await fetch(
        `${WORKFLOWS_URL}/api/workflows/unknown/create`,
        {
          headers: { "X-Edge-Secret": EDGE_TEST_SECRET },
        },
      );

      if (response.status === 400) {
        log(
          "workflows-api-trusted-optional",
          "PASS",
          "Trusted auth geaccepteerd; route bereikt (HTTP 400 unknown workflow type)",
        );
      } else {
        log(
          "workflows-api-trusted-optional",
          "FAIL",
          `Onverwachte status met trusted header: HTTP ${response.status}`,
          "Check workflows EDGE_SECRET validatie en route parsing",
          "HIGH",
        );
      }

      expect(response.status).toBe(400);
    });
  });
});
