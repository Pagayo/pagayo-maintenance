import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { describe, expect, it } from "vitest";
import { SMOKE_ADMIN_SESSION_COOKIE, STOREFRONT_URL } from "../utils/test-config";

const TIMEOUT = 10_000;
const AUDIT = "/api/admin/subscriptions/consistency?limit=25";
const REPAIR = "/api/admin/subscriptions/consistency/repair";
const CSRF = "/api/admin/csrf";

type Result = { status: number; headers: Record<string, string | string[] | undefined>; body: string };
const sessionCookie = (raw: string) => raw.includes("=") ? raw : `pagayo_session=${raw}`;
function cookie(header: string | string[] | undefined, name: string) { for (const value of Array.isArray(header) ? header : header ? [header] : []) { const m = value.match(new RegExp(`(?:^|[,;]\\s*)${name}=([^;,\\s]+)`)); if (m?.[1]) return m[1]; } return null; }
async function request(path: string, options: { method?: string; headers?: Record<string,string>; body?: string } = {}): Promise<Result> { const url = new URL(path, STOREFRONT_URL); const transport = url.protocol === "https:" ? httpsRequest : httpRequest; return new Promise((resolve,reject) => { const req = transport(url, { method: options.method ?? "GET", headers: options.headers, timeout: TIMEOUT }, (res) => { const chunks: Buffer[] = []; res.on("data", (c: Buffer|string) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))); res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") })); }); req.on("timeout", () => req.destroy(new Error("timeout"))); req.on("error", reject); if (options.body) req.write(options.body); req.end(); }); }
const json = <T>(r: Result) => JSON.parse(r.body) as T;

async function csrf(session: string) { const r = await request(CSRF, { headers: { Cookie: session } }); expect(r.status).toBe(200); const b = json<{ data?: { csrfToken?: string }; csrfToken?: string }>(r); const token = b.data?.csrfToken ?? b.csrfToken; const csrfCookie = cookie(r.headers["set-cookie"], "csrf_token"); expect(token).toBeTruthy(); expect(csrfCookie).toBeTruthy(); return { token: token as string, csrfCookie: csrfCookie as string }; }

describe("Subscriptions Operational Maturity V1", () => {
  it("protects audit from anonymous callers", async () => expect([401,403]).toContain((await request(AUDIT)).status));
  it("protects repair from anonymous callers", async () => expect([401,403]).toContain((await request(REPAIR, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ execute: true, limit: 1 }) })).status));
  it.skipIf(!SMOKE_ADMIN_SESSION_COOKIE)("returns a bounded authenticated audit", async () => { const r = await request(AUDIT, { headers: { Cookie: sessionCookie(SMOKE_ADMIN_SESSION_COOKIE as string) } }); expect(r.status).toBe(200); const b = json<{ success?: boolean; data?: { scannedSubscriptions?: number; scannedOperations?: number; exceptions?: unknown[] } }>(r); expect(b.success).toBe(true); expect(b.data?.scannedSubscriptions).toBeGreaterThanOrEqual(0); expect(b.data?.scannedSubscriptions).toBeLessThanOrEqual(25); expect(b.data?.scannedOperations).toBeLessThanOrEqual(25); expect(Array.isArray(b.data?.exceptions)).toBe(true); });
  it.skipIf(!SMOKE_ADMIN_SESSION_COOKIE)("requires explicit execute and performs no repair", async () => { const s = sessionCookie(SMOKE_ADMIN_SESSION_COOKIE as string); const c = await csrf(s); const r = await request(REPAIR, { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": c.token, Cookie: `${s}; csrf_token=${c.csrfCookie}` }, body: JSON.stringify({ limit: 1 }) }); expect(r.status).toBe(400); const b = json<{ success?: boolean; error?: { code?: string }; code?: string }>(r); expect(b.success).toBe(false); expect(b.error?.code ?? b.code).toBe("SUBSCRIPTION_REPAIR_CONFIRMATION_REQUIRED"); });
});
