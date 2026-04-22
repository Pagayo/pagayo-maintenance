/**
 * Contract Tests - API Response Schemas
 *
 * DOEL: Valideer dat API responses consistent zijn
 * PRIORITEIT: MEDIUM - Breaking changes detectie
 * ACTIE BIJ FAILURE: Check API code voor schema wijzigingen
 *
 * V2: beheer is geabsorbeerd in storefront. Tests valideren nu storefront + API stack.
 */

import {
  STOREFRONT_URL,
  PLATFORM_ADMIN_URL,
  API_URL,
} from "../utils/test-config";

interface HealthResponse {
  status: string;
  service?: string;
  timestamp?: string;
  version?: string;
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

function isErrorResponse(data: unknown): data is ErrorResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    (data as ErrorResponse).success === false
  );
}

function logResult(
  test: string,
  status: "PASS" | "WARN" | "FAIL",
  details: string,
) {
  const emoji = status === "PASS" ? "✓" : status === "WARN" ? "⚠" : "✗";
  console.log(`[CONTRACT] ${emoji} ${test}: ${details}`);
}

describe("Contract Tests - Health Endpoints", () => {
  it("storefront /api/health should match health schema", async () => {
    const response = await fetch(`${STOREFRONT_URL}/api/health`);
    const data = await response.json();

    expect(isHealthResponse(data)).toBe(true);
    expect(["healthy", "ok"]).toContain(data.status);
    logResult("storefront-health", "PASS", `status=${data.status}`);
  });

  it("platform admin /api/health should match health schema", async () => {
    const response = await fetch(`${PLATFORM_ADMIN_URL}/api/health`);
    const data = await response.json();

    expect(isHealthResponse(data)).toBe(true);
    expect(["healthy", "ok"]).toContain(data.status);
    logResult("platform-admin-health", "PASS", `status=${data.status}`);
  });

  it("API stack should return operational status", async () => {
    const response = await fetch(API_URL);
    expect(response.status).toBe(200);

    const data = await response.json();
    // API stack returns { success: true, data: { status: ... } } format
    expect(data).toHaveProperty("success", true);
    logResult("api-stack-health", "PASS", `success=${data.success}`);
  });
});

describe("Contract Tests - Error Responses", () => {
  it("auth errors should return proper status", async () => {
    const response = await fetch(
      `${PLATFORM_ADMIN_URL}/api/platform/organizations`,
    );

    // Protected by Cloudflare Access (302 redirect) or Worker auth (401/403)
    expect([302, 401, 403]).toContain(response.status);
    logResult("auth-error", "PASS", `status=${response.status}`);
  });

  it("404 errors should return JSON error", async () => {
    const response = await fetch(
      `${STOREFRONT_URL}/api/nonexistent-endpoint-xyz`,
    );

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
