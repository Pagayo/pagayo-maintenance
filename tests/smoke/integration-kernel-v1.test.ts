import { STOREFRONT_URL } from "../utils/test-config";
import { logTestResult } from "../utils/test-reporter";

const API_STACK_URL = process.env.API_STACK_URL ?? "https://api.pagayo.com";

describe("Integration Kernel V1 smoke", () => {
  it("API Stack health remains reachable", async () => {
    const response = await fetch(`${API_STACK_URL}/api/health`);
    logTestResult({
      category: "SMOKE",
      service: "api-stack",
      test: "integration-kernel-health",
      status: response.ok ? "PASS" : "FAIL",
      details: `Status: ${response.status}`,
      priority: "CRITICAL",
    });
    expect(response.ok).toBe(true);
  });

  it("Storefront connector status fails closed without admin authentication", async () => {
    const response = await fetch(`${STOREFRONT_URL}/api/admin/integrations/status`);
    const failClosed = [401, 403, 404].includes(response.status);
    logTestResult({
      category: "SMOKE",
      service: "storefront",
      test: "integration-kernel-status-auth",
      status: failClosed ? "PASS" : "FAIL",
      details: `Status: ${response.status}`,
      priority: "HIGH",
    });
    expect(failClosed).toBe(true);
  });
});
