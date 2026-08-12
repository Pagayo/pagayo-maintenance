import { describe, expect, it, vi } from "vitest";
import { probeStripe } from "./stripe.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("probeStripe", () => {
  it("skips when admin cookie missing", async () => {
    const result = await probeStripe({
      baseUrl: "https://demo.staging.pagayo.app",
      sessionCookie: null,
    });
    expect(result.status).toBe("skip");
    expect(result.code).toBe("AUTH_REQUIRED");
  });

  it("passes when test+balance succeed in TEST mode", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/stripe/test")) {
        return jsonResponse(200, {
          success: true,
          data: { mode: "TEST", accountId: "acct_test_123", message: "ok" },
        });
      }
      if (url.endsWith("/stripe/balance")) {
        return jsonResponse(200, {
          success: true,
          data: { balance: { available: [] } },
        });
      }
      return jsonResponse(404, { success: false });
    });

    const result = await probeStripe({
      baseUrl: "https://demo.staging.pagayo.app",
      sessionCookie: "sess",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.status).toBe("pass");
    expect(result.code).toBe("STRIPE_OK");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("fails on CONFIGURATION_ERROR from /stripe/test", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(400, {
        success: false,
        error: { code: "CONFIGURATION_ERROR", message: "Stripe is niet geconfigureerd" },
      }),
    );

    const result = await probeStripe({
      baseUrl: "https://demo.staging.pagayo.app",
      sessionCookie: "sess",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.status).toBe("fail");
    expect(result.code).toBe("CONFIGURATION_ERROR");
  });

  it("fails on STRIPE_CONNECTION_FAILED", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(400, {
        success: false,
        error: {
          code: "STRIPE_CONNECTION_FAILED",
          message: "Stripe account niet bereikbaar",
        },
      }),
    );

    const result = await probeStripe({
      baseUrl: "https://demo.staging.pagayo.app",
      sessionCookie: "sess",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.status).toBe("fail");
    expect(result.code).toBe("STRIPE_CONNECTION_FAILED");
  });

  it("fails on network error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("fetch failed");
    });

    const result = await probeStripe({
      baseUrl: "https://demo.staging.pagayo.app",
      sessionCookie: "sess",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.status).toBe("fail");
    expect(result.code).toBe("NETWORK_ERROR");
  });

  it("fails when mode is not TEST", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/stripe/test")) {
        return jsonResponse(200, {
          success: true,
          data: { mode: "LIVE", accountId: "acct_live" },
        });
      }
      return jsonResponse(200, { success: true, data: {} });
    });

    const result = await probeStripe({
      baseUrl: "https://demo.staging.pagayo.app",
      sessionCookie: "sess",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.status).toBe("fail");
    expect(result.code).toBe("MODE_NOT_TEST");
  });
});
