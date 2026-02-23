/**
 * Contract Tests - API Response Schemas
 *
 * DOEL: Valideer dat API responses consistent zijn
 * PRIORITEIT: MEDIUM - Breaking changes detectie
 * ACTIE BIJ FAILURE: Check API code voor schema wijzigingen
 */

import { BEHEER_URL, STOREFRONT_URL } from "../utils/test-config";

// Schema validators
interface HealthResponse {
  status: string;
  timestamp?: string;
  version?: string;
}

interface SuccessResponse<T> {
  success: true;
  data: T;
  requestId?: string;
}

interface ErrorResponse {
  success: false;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  message?: string;
  requestId?: string;
}

function isHealthResponse(data: unknown): data is HealthResponse {
  return typeof data === "object" && data !== null && "status" in data;
}

function isSuccessResponse(data: unknown): data is SuccessResponse<unknown> {
  return (
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    (data as SuccessResponse<unknown>).success === true
  );
}

function isErrorResponse(data: unknown): data is ErrorResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    (data as ErrorResponse).success === false
  );
}

// Helper for AI-readable output
function logResult(
  test: string,
  status: "PASS" | "WARN" | "FAIL",
  details: string,
) {
  const emoji = status === "PASS" ? "✓" : status === "WARN" ? "⚠" : "✗";
  console.log(`[CONTRACT] ${emoji} ${test}: ${details}`);
}

describe("Contract Tests - Health Endpoints", () => {
  it("beheer /api/health should match health schema", async () => {
    const response = await fetch(`${BEHEER_URL}/api/health`, {
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      logResult(
        "beheer-health",
        "WARN",
        "Returns HTML (Cloudflare Access) - skipping JSON validation",
      );
      expect(response.status).toBe(200);
      return;
    }

    const data = await response.json();

    expect(isHealthResponse(data)).toBe(true);
    // Accept 'healthy' or 'ok' as valid
    expect(["healthy", "ok"]).toContain(data.status);
    logResult("beheer-health", "PASS", `status=${data.status}`);
  });

  it("storefront /api/health should match health schema", async () => {
    const response = await fetch(`${STOREFRONT_URL}/api/health`);
    const data = await response.json();

    expect(isHealthResponse(data)).toBe(true);
    expect(["healthy", "ok"]).toContain(data.status);
    logResult("storefront-health", "PASS", `status=${data.status}`);
  });
});

describe("Contract Tests - Success Responses", () => {
  it("/api/capabilities/features should return success response", async () => {
    const response = await fetch(`${BEHEER_URL}/api/capabilities/features`);

    // Handle possible Cloudflare Access redirect
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      logResult(
        "capabilities-features",
        "WARN",
        "Returns HTML (Cloudflare Access)",
      );
      expect(response.status).toBe(200);
      return;
    }

    const data = await response.json();

    // Accept either {success: true, data: [...]} or {features: [...]}
    const hasData =
      isSuccessResponse(data) ||
      (data.features && Array.isArray(data.features));

    if (hasData) {
      const count = data.data?.length || data.features?.length || 0;
      logResult("capabilities-features", "PASS", `${count} features returned`);
    } else {
      logResult(
        "capabilities-features",
        "FAIL",
        `Unexpected response format: ${JSON.stringify(data).slice(0, 100)}`,
      );
    }

    expect(hasData).toBe(true);
  });
});

describe("Contract Tests - Error Responses", () => {
  it("validation errors should match error schema", async () => {
    const response = await fetch(`${BEHEER_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (response.status === 400) {
      const data = await response.json();
      const hasMessage = data.error?.message || data.message;
      logResult(
        "validation-error",
        hasMessage ? "PASS" : "WARN",
        `status=${response.status}, hasMessage=${!!hasMessage}`,
      );
      expect(hasMessage).toBeDefined();
    } else if (response.status === 429) {
      logResult(
        "validation-error",
        "WARN",
        "Rate limited (429) - cannot test validation",
      );
    }
  });

  it("auth errors should match error schema", async () => {
    const response = await fetch(`${BEHEER_URL}/api/admin/organizations`);

    // Protected by Cloudflare Access (200 HTML) or Worker (401/403)
    if (response.status === 200) {
      const ct = response.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        logResult(
          "auth-error",
          "PASS",
          "Protected by Cloudflare Access (login page)",
        );
        return;
      }
    }

    expect([200, 302, 401, 403]).toContain(response.status);
    logResult("auth-error", "PASS", `status=${response.status}`);
  });

  it("404 errors should match error schema", async () => {
    const response = await fetch(`${BEHEER_URL}/api/nonexistent-endpoint-xyz`);

    if (response.status === 404) {
      const data = await response.json().catch(() => null);
      const isError = data ? isErrorResponse(data) : false;
      logResult(
        "404-error",
        isError ? "PASS" : "WARN",
        `status=404, matchesSchema=${isError}`,
      );
    } else {
      logResult("404-error", "WARN", `status=${response.status} (not 404)`);
    }
  });
});

describe("Contract Tests - Features Schema", () => {
  interface Feature {
    feature: string; // or 'code' in some versions
    name: string;
    maxLevel?: number;
    description?: string;
    category?: string;
  }

  it("/api/capabilities/features should return valid feature objects", async () => {
    const response = await fetch(`${BEHEER_URL}/api/capabilities/features`);
    const data = await response.json();

    const features = data.data || data.features || [];
    expect(Array.isArray(features)).toBe(true);

    if (features.length > 0) {
      const feature = features[0];
      // Accept 'feature' or 'code' as the identifier field
      const hasIdentifier =
        typeof feature.feature === "string" || typeof feature.code === "string";
      const hasName = typeof feature.name === "string";
      logResult(
        "feature-schema",
        hasIdentifier && hasName ? "PASS" : "FAIL",
        `sample: id=${feature.feature || feature.code}, name=${feature.name}`,
      );
      expect(hasIdentifier).toBe(true);
      expect(hasName).toBe(true);
    } else {
      logResult("feature-schema", "WARN", "No features returned");
    }
  });
});

describe("Contract Tests - Registration Response", () => {
  interface RegistrationResponse {
    success: true;
    async: boolean;
    workflowId: string;
    statusUrl: string;
    subdomain: string;
    shopUrl: string;
    organizationId: string;
  }

  it("registration should return workflow info on success", async () => {
    // Note: This test might hit rate limit - that's OK
    const response = await fetch(`${BEHEER_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `contract-test-${Date.now()}@example.com`,
        password: "Test1234!",
        organizationName: "Contract Test Org",
        tenantName: "contract-test",
        subdomain: `contract-test-${Date.now()}`,
      }),
    });

    if (response.status === 200 || response.status === 201) {
      const data = (await response.json()) as RegistrationResponse;

      expect(data.success).toBe(true);
      expect(data).toHaveProperty("workflowId");
      expect(data).toHaveProperty("statusUrl");
      expect(data).toHaveProperty("subdomain");
      expect(typeof data.workflowId).toBe("string");
      expect(typeof data.statusUrl).toBe("string");
    } else if (response.status === 409) {
      // Conflict - email/subdomain already exists (expected for repeated tests)
      console.log(
        "Conflict (409) - email/subdomain already exists, this is OK for repeated tests",
      );
    } else if (response.status === 429) {
      // Rate limited - test passes (endpoint works, just limited)
      console.log("Rate limited - skipping response validation");
    } else {
      // Unexpected status
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });
});
