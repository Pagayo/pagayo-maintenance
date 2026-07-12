import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { describe, expect, it } from "vitest";
import {
  SMOKE_ADMIN_SESSION_COOKIE,
  STOREFRONT_URL,
} from "../utils/test-config";

const REQUEST_TIMEOUT_MS = 10_000;
const CONSISTENCY_PATH = "/api/admin/bookings/consistency?limit=25";
const REPAIR_PATH = "/api/admin/bookings/consistency/repair";
const CSRF_PATH = "/api/admin/csrf";
const SESSION_COOKIE_NAME = "pagayo_session";
const CSRF_COOKIE_NAME = "csrf_token";

interface HttpResult {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

function normalizeSessionCookie(rawCookie: string): string {
  return rawCookie.includes("=")
    ? rawCookie
    : `${SESSION_COOKIE_NAME}=${rawCookie}`;
}

function extractCookie(
  setCookieHeader: string | string[] | undefined,
  cookieName: string,
): string | null {
  const values = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];

  for (const value of values) {
    const match = value.match(new RegExp(`(?:^|[,;]\\s*)${cookieName}=([^;,\\s]+)`));
    if (match?.[1]) return match[1];
  }

  return null;
}

async function request(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<HttpResult> {
  const url = new URL(path, STOREFRONT_URL);
  const transport = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<HttpResult>((resolve, reject) => {
    const req = transport(
      url,
      {
        method: options.method ?? "GET",
        headers: options.headers,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.on("error", reject);

    if (options.body) req.write(options.body);
    req.end();
  });
}

function parseJson<T>(result: HttpResult): T {
  try {
    return JSON.parse(result.body) as T;
  } catch {
    throw new Error(
      `Expected JSON response for HTTP ${result.status}, received: ${result.body.slice(0, 300)}`,
    );
  }
}

async function bootstrapCsrf(sessionCookie: string): Promise<{
  csrfToken: string;
  csrfCookie: string;
}> {
  const response = await request(CSRF_PATH, {
    headers: { Cookie: sessionCookie },
  });
  expect(response.status).toBe(200);

  const body = parseJson<{
    data?: { csrfToken?: unknown };
    csrfToken?: unknown;
  }>(response);
  const csrfToken =
    typeof body.data?.csrfToken === "string"
      ? body.data.csrfToken
      : typeof body.csrfToken === "string"
        ? body.csrfToken
        : null;
  const csrfCookie = extractCookie(
    response.headers["set-cookie"],
    CSRF_COOKIE_NAME,
  );

  expect(csrfToken).toBeTruthy();
  expect(csrfCookie).toBeTruthy();

  return {
    csrfToken: csrfToken as string,
    csrfCookie: csrfCookie as string,
  };
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
      const sessionCookie = normalizeSessionCookie(
        SMOKE_ADMIN_SESSION_COOKIE as string,
      );
      const response = await request(CONSISTENCY_PATH, {
        headers: { Cookie: sessionCookie },
      });
      expect(response.status).toBe(200);

      const body = parseJson<{
        success?: boolean;
        data?: { scanned?: unknown; exceptions?: unknown };
      }>(response);
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
      const sessionCookie = normalizeSessionCookie(
        SMOKE_ADMIN_SESSION_COOKIE as string,
      );
      const { csrfToken, csrfCookie } = await bootstrapCsrf(sessionCookie);
      const response = await request(REPAIR_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
          Cookie: `${sessionCookie}; ${CSRF_COOKIE_NAME}=${csrfCookie}`,
        },
        body: JSON.stringify({ limit: 1 }),
      });
      expect(response.status).toBe(400);

      const body = parseJson<{
        success?: boolean;
        error?: { code?: string } | string;
        code?: string;
      }>(response);
      const code = typeof body.error === "object" ? body.error?.code : body.code;
      expect(body.success).toBe(false);
      expect(code).toBe("BOOKING_REPAIR_CONFIRMATION_REQUIRED");
    },
  );
});
