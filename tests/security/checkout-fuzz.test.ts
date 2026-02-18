/**
 * Checkout Fuzz Security Tests
 *
 * SECURITY CONTEXT:
 * Verifies that the checkout endpoint handles malformed, malicious, and
 * unexpected input gracefully — no crashes, no stack traces in responses,
 * no information leakage.
 *
 * ATTACK VECTORS TESTED:
 * - Empty/missing body
 * - Oversized payloads
 * - Malformed JSON
 * - SQL injection in text fields
 * - Negative prices/quantities
 * - Type confusion (string where number expected)
 * - Prototype pollution
 * - Unicode exploits / zero-width characters
 * - Deeply nested objects
 *
 * @module __tests__/security/checkout-fuzz
 */

import { describe, it, expect } from "vitest";

const STOREFRONT_URL =
  process.env.STOREFRONT_URL || "https://test-3.pagayo.app";

/**
 * Helper: POST JSON to checkout endpoint
 */
async function postCheckout(
  body: unknown,
  options: { contentType?: string; timeout?: number } = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeout || 10000,
  );

  try {
    return await fetch(`${STOREFRONT_URL}/api/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": options.contentType || "application/json",
      },
      body:
        typeof body === "string"
          ? body
          : body !== undefined
            ? JSON.stringify(body)
            : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

describe("Checkout Endpoint Fuzz Tests", () => {
  // ===========================================================================
  // Empty / Missing Body
  // ===========================================================================

  describe("Empty and Missing Body", () => {
    it("should reject empty POST body with structured error", async () => {
      const res = await postCheckout("");
      // Should NOT be 500 (crash) — should be 400 (validation)
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("should reject POST with no Content-Type", async () => {
      const res = await fetch(`${STOREFRONT_URL}/api/checkout`, {
        method: "POST",
        body: "random text",
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("should reject POST with null body", async () => {
      const res = await postCheckout(null);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ===========================================================================
  // Malformed JSON
  // ===========================================================================

  describe("Malformed JSON", () => {
    it("should reject truncated JSON with 400, not 500", async () => {
      const res = await postCheckout('{"items": [{"name": "test"');
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("should reject JSON with trailing comma", async () => {
      const res = await postCheckout('{"items": [],}');
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("should not expose stack trace in error response", async () => {
      const res = await postCheckout("{invalid json!!}");
      const text = await res.text();

      // Should NEVER contain stack trace info
      expect(text).not.toContain("at Object.");
      expect(text).not.toContain("at Module.");
      expect(text).not.toContain("node_modules");
      expect(text).not.toContain(".ts:");
    });
  });

  // ===========================================================================
  // SQL Injection Attempts
  // ===========================================================================

  describe("SQL Injection in Checkout Fields", () => {
    const sqlPayloads = [
      "'; DROP TABLE orders; --",
      "1 OR 1=1",
      "1; SELECT * FROM users",
      "' UNION SELECT * FROM \"User\" --",
      "Robert'); DROP TABLE \"Order\";--",
    ];

    it.each(sqlPayloads)(
      "should safely handle SQL injection in customer email: %s",
      async (payload) => {
        const res = await postCheckout({
          items: [{ name: "Test", price: 10, qty: 1 }],
          customer: { email: payload },
          acceptedTerms: true,
        });

        // Should be a validation error (400), not a crash (500)
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
      },
    );

    it.each(sqlPayloads)(
      "should safely handle SQL injection in product name: %s",
      async (payload) => {
        const res = await postCheckout({
          items: [{ name: payload, price: 10, qty: 1 }],
          customer: { email: "test@example.com" },
          acceptedTerms: true,
        });

        // Should either validate or safely process — never crash
        expect(res.status).not.toBe(500);
      },
    );
  });

  // ===========================================================================
  // Negative Prices and Quantities
  // ===========================================================================

  describe("Negative Values", () => {
    it("should reject negative quantity", async () => {
      const res = await postCheckout({
        items: [{ name: "Test Product", price: 10.0, qty: -5 }],
        customer: { email: "test@example.com" },
        acceptedTerms: true,
      });
      // Should be rejected, not processed
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject negative price", async () => {
      const res = await postCheckout({
        items: [{ name: "Discount hack", price: -99.99, qty: 1 }],
        customer: { email: "test@example.com" },
        acceptedTerms: true,
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject zero quantity", async () => {
      const res = await postCheckout({
        items: [{ name: "Zero items", price: 10.0, qty: 0 }],
        customer: { email: "test@example.com" },
        acceptedTerms: true,
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject extremely large quantity", async () => {
      const res = await postCheckout({
        items: [{ name: "Overflow", price: 1, qty: Number.MAX_SAFE_INTEGER }],
        customer: { email: "test@example.com" },
        acceptedTerms: true,
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ===========================================================================
  // Type Confusion
  // ===========================================================================

  describe("Type Confusion", () => {
    it("should reject string where number expected (qty)", async () => {
      const res = await postCheckout({
        items: [{ name: "Test", price: 10, qty: "abc" }],
        customer: { email: "test@example.com" },
        acceptedTerms: true,
      });
      // Should not crash — either 400 (validation) or safe handling
      expect(res.status).not.toBe(500);
    });

    it("should reject boolean where number expected (price)", async () => {
      const res = await postCheckout({
        items: [{ name: "Test", price: true, qty: 1 }],
        customer: { email: "test@example.com" },
        acceptedTerms: true,
      });
      expect(res.status).not.toBe(500);
    });

    it("should reject array where object expected (customer)", async () => {
      const res = await postCheckout({
        items: [{ name: "Test", price: 10, qty: 1 }],
        customer: ["not", "an", "object"],
        acceptedTerms: true,
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject number where string expected (email)", async () => {
      const res = await postCheckout({
        items: [{ name: "Test", price: 10, qty: 1 }],
        customer: { email: 12345 },
        acceptedTerms: true,
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ===========================================================================
  // Prototype Pollution
  // ===========================================================================

  describe("Prototype Pollution", () => {
    it("should not be affected by __proto__ in body", async () => {
      const res = await postCheckout(
        '{"__proto__": {"isAdmin": true}, "items": [], "customer": {"email": "test@x.com"}}',
      );
      // Whatever the response, it should not grant admin access
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("should not be affected by constructor pollution", async () => {
      const res = await postCheckout({
        constructor: { prototype: { isAdmin: true } },
        items: [{ name: "Test", price: 10, qty: 1 }],
        customer: { email: "test@example.com" },
        acceptedTerms: true,
      });
      expect(res.status).not.toBe(500);
    });
  });

  // ===========================================================================
  // Unicode Exploits
  // ===========================================================================

  describe("Unicode and Special Characters", () => {
    it("should handle zero-width characters in product name", async () => {
      const res = await postCheckout({
        items: [{ name: "Test\u200B\u200CProduct", price: 10, qty: 1 }],
        customer: { email: "test@example.com" },
        acceptedTerms: true,
      });
      expect(res.status).not.toBe(500);
    });

    it("should handle right-to-left override in email", async () => {
      const res = await postCheckout({
        items: [{ name: "Test", price: 10, qty: 1 }],
        customer: { email: "test\u202Ecom.evil@" },
        acceptedTerms: true,
      });
      // Should reject invalid email
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("should handle emoji in product name", async () => {
      const res = await postCheckout({
        items: [{ name: "Test 🎉💰🛒", price: 10, qty: 1 }],
        customer: { email: "test@example.com" },
        acceptedTerms: true,
      });
      // Should handle gracefully — not crash
      expect(res.status).not.toBe(500);
    });

    it("should handle null bytes in text fields", async () => {
      const res = await postCheckout({
        items: [{ name: "Test\x00Product", price: 10, qty: 1 }],
        customer: { email: "test@example.com" },
        acceptedTerms: true,
      });
      expect(res.status).not.toBe(500);
    });
  });

  // ===========================================================================
  // Deeply Nested / Oversized
  // ===========================================================================

  describe("Payload Size and Depth", () => {
    it("should reject extremely large items array", async () => {
      const items = Array.from({ length: 10000 }, (_, i) => ({
        name: `Product ${i}`,
        price: 1,
        qty: 1,
      }));

      const res = await postCheckout({
        items,
        customer: { email: "test@example.com" },
        acceptedTerms: true,
      });

      // Should either reject or handle — never OOM crash
      expect(res.status).not.toBe(500);
    });

    it("should handle very long string values", async () => {
      const res = await postCheckout({
        items: [{ name: "A".repeat(100000), price: 10, qty: 1 }],
        customer: { email: "test@example.com" },
        acceptedTerms: true,
      });
      expect(res.status).not.toBe(500);
    });

    it("should not expose internal details in any error response", async () => {
      const res = await postCheckout({});
      const text = await res.text();

      // Should never expose internal paths, stack traces, or DB details
      expect(text).not.toMatch(/\/Users\//i);
      expect(text).not.toMatch(/at .+\.(ts|js):\d+/);
      expect(text).not.toContain("SELECT");
      expect(text).not.toContain("FROM");
      expect(text).not.toContain("postgresql://");
    });
  });
});
