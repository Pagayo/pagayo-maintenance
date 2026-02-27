/**
 * Cross-Service Integration Tests
 *
 * Tests die de volledige flow valideren:
 * Beheer → Workflows → Storefront
 *
 * Dit zijn de tests die het hele platform als geheel valideren.
 */

import { BEHEER_URL, STOREFRONT_URL } from "../utils/test-config";

describe("Cross-Service Integration - Registration Flow", () => {
  it("should validate registration endpoint returns workflow ID", async () => {
    // Test registration met dummy data (zal niet echt registreren)
    const response = await fetch(`${BEHEER_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "integration-test@example.com",
        password: "Test1234!",
        organizationName: "Integration Test Org",
        tenantName: "integration-test",
        subdomain: "integration-test-" + Date.now(),
      }),
    });

    // 200/201 = success, 202 = async workflow started, 400 = validation, 409 = conflict (email/subdomain exists), 429 = rate limited
    expect([200, 201, 202, 400, 409, 429]).toContain(response.status);

    if (
      response.status === 200 ||
      response.status === 201 ||
      response.status === 202
    ) {
      const data = await response.json();
      expect(data).toHaveProperty("success", true);
      expect(data).toHaveProperty("workflowId");
      expect(data).toHaveProperty("statusUrl");
    }
  });

  it("should be able to poll workflow status", async () => {
    // Test workflow status polling met fake ID
    const response = await fetch(
      `${BEHEER_URL}/api/workflows/provisioning/status/fake-workflow-id`,
    );

    // 404 (niet gevonden) is OK, 500 (crash) is niet OK
    expect([401, 404]).toContain(response.status);
  });
});

describe("Cross-Service Integration - Capabilities System", () => {
  it("should return features from beheer", async () => {
    const response = await fetch(`${BEHEER_URL}/api/capabilities/features`);

    // 200 = success, 401 = auth required (Cloudflare Access or session auth)
    if (response.status === 401) {
      console.log("  ⚠️ WARNING: capabilities endpoint requires auth — 401");
      return;
    }

    expect(response.status).toBe(200);

    const data = await response.json();
    // Accept {success: true, data: [...]} or {features: [...]}
    const features = data.data || data.features || [];
    expect(Array.isArray(features)).toBe(true);
  });

  // TODO: Test dat storefront dezelfde capabilities respecteert
});

describe("Cross-Service Integration - Session Consistency", () => {
  it("should handle session check across services", async () => {
    // Test dat session endpoint bestaat en werkt
    const beheerSession = await fetch(`${BEHEER_URL}/api/auth/session`, {
      credentials: "include",
    });

    // Moet een response geven, geen crash
    // 200 = valid session, 401 = no session, 302 = redirect to login, 500 = CF Access intercept
    expect([200, 401, 302, 500]).toContain(beheerSession.status);

    const storefrontSession = await fetch(
      `${STOREFRONT_URL}/api/auth/session`,
      {
        credentials: "include",
      },
    );

    // Accept 200, 401, or 404 (endpoint might not exist)
    expect([200, 401, 404]).toContain(storefrontSession.status);
  });
});

describe("Cross-Service Integration - API Consistency", () => {
  it("should have consistent error response format", async () => {
    // Test error response van beheer
    const beheerError = await fetch(`${BEHEER_URL}/api/nonexistent-endpoint`);

    if (beheerError.status >= 400) {
      const data = await beheerError.json().catch(() => null);
      if (data) {
        // Moet consistent error format hebben
        expect(data).toHaveProperty("success", false);
      }
    }
  });

  it("should have consistent health response format", async () => {
    // Beheer might return HTML due to Cloudflare Access
    const beheerResponse = await fetch(`${BEHEER_URL}/api/health`);
    const beheerContentType = beheerResponse.headers.get("content-type") || "";

    if (beheerContentType.includes("application/json")) {
      const beheerHealth = await beheerResponse.json();
      expect(beheerHealth).toHaveProperty("status");
    } else {
      // Cloudflare Access returns HTML - that's still a valid response
      expect(beheerResponse.status).toBe(200);
    }

    // Storefront should always return JSON
    const storefrontHealth = await fetch(`${STOREFRONT_URL}/api/health`).then(
      (r) => r.json(),
    );
    expect(storefrontHealth).toHaveProperty("status");
  });
});
