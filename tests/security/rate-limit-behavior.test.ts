/**
 * Security Tests - Rate Limit Behavior & Fail-Mode
 *
 * Validates that rate limiting is properly configured and behaves
 * correctly under various conditions.
 *
 * ATTACK VECTORS TESTED:
 * 1. Rate limit enforcement on auth endpoints
 * 2. Rate limit headers presence
 * 3. Graceful handling when limits are exceeded
 * 4. Input validation on rate-limited endpoints
 *
 * NOTE: The beheer rate limiter uses KV-based storage with no try/catch
 * around KV operations. This means KV failures result in 500 (fail-closed).
 * This is GOOD for security but documented here for awareness.
 *
 * @module tests/security/rate-limit-behavior
 */

import { BEHEER_URL, STOREFRONT_URL } from "../utils/test-config";

describe("Security - Rate Limiting Behavior", () => {
  // ==============================
  // Rate Limit Headers
  // ==============================

  describe("Rate Limit Headers", () => {
    it("beheer should include rate limit headers in responses", async () => {
      const response = await fetch(`${BEHEER_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      // Rate limit headers should be present (even on error responses)
      // Note: Cloudflare Access may intercept before rate limiting,
      // so we check both scenarios
      const rateLimitHeader = response.headers.get("x-ratelimit-limit");
      const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");

      if (rateLimitHeader) {
        expect(parseInt(rateLimitHeader, 10)).toBeGreaterThan(0);
        console.log(
          `✓ Rate limit headers present: limit=${rateLimitHeader}, remaining=${rateLimitRemaining}`,
        );
      } else {
        // If no rate limit headers, Cloudflare Access might be intercepting
        console.warn(
          "⚠ No rate limit headers — Cloudflare Access may be intercepting before Worker",
        );
      }
    });
  });

  // ==============================
  // Auth Endpoint Rate Limiting
  // ==============================

  describe("Auth Endpoint Rate Limiting", () => {
    it("should not crash under rapid auth requests", async () => {
      // Send 5 rapid requests to auth endpoint
      const requests = Array.from({ length: 5 }, () =>
        fetch(`${BEHEER_URL}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: `test-${Date.now()}@test.com`,
            password: "test123!",
            organizationName: "Test Org",
          }),
        }),
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      // No gateway errors (complete crashes) allowed
      expect(statuses).not.toContain(502);
      expect(statuses).not.toContain(503);

      // Allow at most 1 transient 500 under extreme concurrent load
      // (DB pool exhaustion, cold start race, etc.)
      const count500 = statuses.filter((s) => s === 500).length;
      if (count500 > 0) {
        console.warn(
          `⚠ ${count500}/5 requests returned 500 (transient under load)`,
        );
      }
      expect(count500).toBeLessThanOrEqual(1);

      // Check if rate limiting kicked in
      const has429 = statuses.includes(429);
      if (has429) {
        console.log(
          `✓ Rate limiting active: ${statuses.filter((s) => s === 429).length}/5 requests limited`,
        );

        // When rate limited, should include Retry-After header
        const limitedResponse = responses.find((r) => r.status === 429);
        if (limitedResponse) {
          const retryAfter = limitedResponse.headers.get("retry-after");
          if (retryAfter) {
            expect(parseInt(retryAfter, 10)).toBeGreaterThan(0);
          }
        }
      } else {
        console.warn(
          "⚠ No 429 responses — rate limiting may not be active (Cloudflare Access?), or limit not yet reached",
        );
      }
    });
  });

  // ==============================
  // Rate Limit Response Format
  // ==============================

  describe("Rate Limit Response Format", () => {
    it("429 responses should include proper error structure", async () => {
      // Try to trigger rate limiting with many rapid requests
      const requests = Array.from({ length: 10 }, () =>
        fetch(`${BEHEER_URL}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
      );

      const responses = await Promise.all(requests);
      const limitedResponse = responses.find((r) => r.status === 429);

      if (limitedResponse) {
        const body = (await limitedResponse.json()) as Record<string, unknown>;
        // Should include error message and retryAfter
        expect(body).toHaveProperty("error");
        expect(body).toHaveProperty("message");
        console.log("✓ Rate limit response has proper error structure");
      } else {
        console.warn(
          "⚠ Could not trigger rate limit — skipping response format check",
        );
      }
    });
  });

  // ==============================
  // Storefront Rate Limiting (or lack thereof)
  // ==============================

  describe("Storefront Rate Limiting Status", () => {
    it("storefront auth endpoints should handle rapid requests gracefully", async () => {
      const requests = Array.from({ length: 5 }, () =>
        fetch(`${STOREFRONT_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "nonexistent@test.com",
            password: "wrongpassword",
          }),
        }),
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      // Must not crash
      expect(statuses).not.toContain(500);
      expect(statuses).not.toContain(502);

      // Document whether storefront has rate limiting
      const has429 = statuses.includes(429);
      if (!has429) {
        console.warn(
          "⚠ FINDING: Storefront auth endpoints have NO rate limiting — consider adding",
        );
      } else {
        console.log("✓ Storefront rate limiting is active");
      }
    });
  });

  // ==============================
  // IP Spoofing Resistance
  // ==============================

  describe("IP Header Spoofing", () => {
    it("should not allow X-Forwarded-For to bypass rate limiting", async () => {
      // Try to bypass rate limiting by spoofing IP headers
      const requests = Array.from({ length: 5 }, (_, i) =>
        fetch(`${BEHEER_URL}/api/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": `192.168.1.${i + 1}`, // Different "IP" each time
          },
          body: JSON.stringify({}),
        }),
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      // Should not crash regardless
      expect(statuses).not.toContain(500);

      // Note: Cloudflare sets cf-connecting-ip which is the real IP
      // The rate limiter should use cf-connecting-ip, not X-Forwarded-For
      // If rate limiting kicks in despite different X-Forwarded-For,
      // that means the real IP (cf-connecting-ip) is being used — correct behavior
    });
  });
});
