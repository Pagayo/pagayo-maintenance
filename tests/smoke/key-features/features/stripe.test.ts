import { describe, expect, it, vi } from "vitest";
import {
  INTERNAL_SECRET_HEADER,
  STRIPE_KEY_FEATURE_PATH,
  probeStripe,
} from "./stripe.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("probeStripe", () => {
  it("skips when internal secret missing", async () => {
    const result = await probeStripe({
      baseUrl: "https://demo.staging.pagayo.app",
      internalSecret: null,
    });
    expect(result.status).toBe("skip");
    expect(result.code).toBe("AUTH_REQUIRED");
  });

  it("passes when internal probe succeeds in TEST mode with balanceOk", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain(STRIPE_KEY_FEATURE_PATH);
      expect(init?.method ?? "GET").toBe("GET");
      const headers = new Headers(init?.headers);
      expect(headers.get(INTERNAL_SECRET_HEADER)).toBe("secret");
      return jsonResponse(200, {
        success: true,
        data: {
          feature: "stripe",
          mode: "TEST",
          accountId: "acct_test_123",
          balanceOk: true,
        },
      });
    });

    const result = await probeStripe({
      baseUrl: "https://demo.staging.pagayo.app",
      internalSecret: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.status).toBe("pass");
    expect(result.code).toBe("STRIPE_OK");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails on ENDPOINT_MISSING (404)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(404, { success: false }));

    const result = await probeStripe({
      baseUrl: "https://demo.staging.pagayo.app",
      internalSecret: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.status).toBe("fail");
    expect(result.code).toBe("ENDPOINT_MISSING");
  });

  it("fails on AUTH_FAILED", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(401, {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid secret" },
      }),
    );

    const result = await probeStripe({
      baseUrl: "https://demo.staging.pagayo.app",
      internalSecret: "bad",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.status).toBe("fail");
    expect(result.code).toBe("AUTH_FAILED");
  });

  it("fails on CONFIGURATION_ERROR", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(400, {
        success: false,
        error: {
          code: "CONFIGURATION_ERROR",
          message: "Stripe is niet geconfigureerd",
        },
      }),
    );

    const result = await probeStripe({
      baseUrl: "https://demo.staging.pagayo.app",
      internalSecret: "secret",
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
      internalSecret: "secret",
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
      internalSecret: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.status).toBe("fail");
    expect(result.code).toBe("NETWORK_ERROR");
  });

  it("fails when mode is not TEST", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        success: true,
        data: {
          feature: "stripe",
          mode: "LIVE",
          accountId: "acct_live",
          balanceOk: true,
        },
      }),
    );

    const result = await probeStripe({
      baseUrl: "https://demo.staging.pagayo.app",
      internalSecret: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.status).toBe("fail");
    expect(result.code).toBe("MODE_NOT_TEST");
  });

  it("fails when balanceOk is false", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        success: true,
        data: {
          feature: "stripe",
          mode: "TEST",
          accountId: "acct_test",
          balanceOk: false,
        },
      }),
    );

    const result = await probeStripe({
      baseUrl: "https://demo.staging.pagayo.app",
      internalSecret: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.status).toBe("fail");
    expect(result.code).toBe("BALANCE_NOT_OK");
  });
});
