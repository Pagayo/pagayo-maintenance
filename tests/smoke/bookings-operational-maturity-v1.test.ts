import { describe, expect, it } from "vitest";
import {
  SMOKE_ADMIN_SESSION_COOKIE,
  STOREFRONT_URL,
} from "../utils/test-config";

const REQUEST_TIMEOUT_MS = 10_000;
const CONSISTENCY_PATH = "/api/admin/bookings/consistency?limit=25";
const REPAIR_PATH = "/api/admin/bookings/consistency/repair";

async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${STOREFRONT_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function adminHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (SMOKE_ADMIN_SESSION_COOKIE) {
    headers.set("Cookie", SMOKE_ADMIN_SESSION_COOKIE.includes("=")
      ? SMOKE_ADMIN_SESSION_COOKIE
      : `pagayo_session=${SMOKE_ADMIN_SESSION_COOKIE}`);
  }
  return headers;
}

describe("Bookings Operational Maturity V1", () => {
  it("keeps the consistency audit protected for anonymous callers", async () => {
    const response = await request(CONSISTENCY_PATH);
    expect([401, 403]).toContain(response.status);
  });

  it("keeps the repair surface protected for anonymous callers", async () => {
    const response = await request(REPAIR_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execute: true, limit: 1 }),
    });
    expect([401, 403]).toContain(response.status);
  });

  it.skipIf(!SMOKE_ADMIN_SESSION_COOKIE)(
    "returns a bounded read-only consistency diagnostic for an authenticated admin",
    async () => {
      const response = await request(CONSISTENCY_PATH, {
        headers: adminHeaders(),
      });
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        success?: boolean;
        data?: { scanned?: unknown; exceptions?: unknown };
      };
      expect(body.success).toBe(true);
      expect(Number.isInteger(body.data?.scanned)).toBe(true);
      expect(body.data?.scanned).toBeGreaterThanOrEqual(0);
      expect(body.data?.scanned).toBeLessThanOrEqual(25);
      expect(Array.isArray(body.data?.exceptions)).toBe(true);
    },
  );

  it.skipIf(!SMOKE_ADMIN_SESSION_COOKIE)(
    "rejects repair without explicit execute confirmation and performs no mutation",
    async () => {
      const response = await request(REPAIR_PATH, {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ limit: 1 }),
      });
      expect(response.status).toBe(400);

      const body = (await response.json()) as {
        success?: boolean;
        error?: { code?: string } | string;
        code?: string;
      };
      const code = typeof body.error === "object" ? body.error?.code : body.code;
      expect(body.success).toBe(false);
      expect(code).toBe("BOOKING_REPAIR_CONFIRMATION_REQUIRED");
    },
  );
});
