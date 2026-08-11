import { PLATFORM_ADMIN_URL } from "../utils/test-config";
import { logTestResult } from "../utils/test-reporter";

const API_STACK_URL = process.env.API_STACK_URL ?? "https://api.pagayo.com";

function record(service: string, test: string, response: Response): void {
  const protectedRoute = [401, 403].includes(response.status);
  logTestResult({
    category: "SMOKE",
    service,
    test,
    status: protectedRoute ? "PASS" : "FAIL",
    details: `Status: ${response.status}`,
    priority: "CRITICAL",
  });
  expect(protectedRoute).toBe(true);
}

describe("Integration Kernel V2 control-plane smoke", () => {
  it("API Stack operation journal is operator-only", async () => {
    const response = await fetch(`${API_STACK_URL}/api/admin/integration-kernel/operations`);
    record("api-stack", "integration-kernel-v2-operation-auth", response);
  });

  it("API Stack provider-neutral replay is operator-only", async () => {
    const response = await fetch(`${API_STACK_URL}/api/admin/webhooks/smoke-event/replay`, {
      method: "POST",
    });
    record("api-stack", "integration-kernel-v2-replay-auth", response);
  });

  it("Storefront Platform Admin kernel view is protected by platform auth", async () => {
    const response = await fetch(`${PLATFORM_ADMIN_URL}/api/platform/integration-kernel/operations`);
    record("storefront", "integration-kernel-v2-platform-auth", response);
  });
});
