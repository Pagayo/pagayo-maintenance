/**
 * Cross-Service Integration Tests
 *
 * V2: Tests die valideren dat de Pagayo services correct samenwerken.
 * Alle "beheer" functionaliteit is geabsorbeerd in de storefront Worker.
 */

import {
  STOREFRONT_URL,
  PLATFORM_ADMIN_URL,
  API_URL,
  ONBOARDING_URL,
} from "../utils/test-config";

describe("Cross-Service Integration - Health Consistency", () => {
  it("storefront Worker should respond on demo subdomain", async () => {
    const response = await fetch(`${STOREFRONT_URL}/api/health`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status", "ok");
    expect(data).toHaveProperty("service", "pagayo-storefront");
  });

  it("storefront Worker should respond on admin subdomain", async () => {
    const response = await fetch(`${PLATFORM_ADMIN_URL}/api/health`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status", "ok");
    expect(data).toHaveProperty("service", "pagayo-storefront");
  });

  it("storefront Worker should respond on onboarding subdomain", async () => {
    const response = await fetch(`${ONBOARDING_URL}/api/health`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status", "ok");
    expect(data).toHaveProperty("service", "pagayo-storefront");
  });

  it("API Stack should be operational", async () => {
    const response = await fetch(API_URL);

    // API stack returns 200 with operational status
    expect(response.status).toBe(200);
  });
});

describe("Cross-Service Integration - Session Consistency", () => {
  it("should handle session check on storefront", async () => {
    const response = await fetch(`${STOREFRONT_URL}/api/auth/session`, {
      credentials: "include",
    });

    // 200 = valid session, 401 = no session, 404 = endpoint not available
    expect([200, 401, 404]).toContain(response.status);
  });
});

describe("Cross-Service Integration - API Consistency", () => {
  it("should have consistent error response format", async () => {
    const response = await fetch(`${STOREFRONT_URL}/api/nonexistent-endpoint`);

    if (response.status >= 400) {
      const data = await response.json().catch(() => null);
      if (data) {
        // Storefront may return { success: false, ... } or { error: "...", ... }
        const isProtected = data.success === false || data.error !== undefined;
        expect(isProtected).toBe(true);
      }
    }
  });

  it("all storefront subdomains should serve same Worker", async () => {
    const urls = [STOREFRONT_URL, PLATFORM_ADMIN_URL, ONBOARDING_URL];
    const responses = await Promise.all(
      urls.map((url) => fetch(`${url}/api/health`).then((r) => r.json())),
    );

    // All should identify as pagayo-storefront
    for (const data of responses) {
      expect(data.service).toBe("pagayo-storefront");
    }
  });
});
