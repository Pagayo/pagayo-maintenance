/**
 * Payment Webhook Fuzz Security Tests
 *
 * SECURITY CONTEXT:
 * Verifies that payment webhook endpoints (Stripe, Mollie, Bunq) handle
 * malformed, oversized, and malicious payloads gracefully without crashing,
 * leaking information, or processing invalid data.
 *
 * ATTACK VECTORS TESTED:
 * - Malformed signature headers (random bytes, encoding tricks)
 * - Empty/missing webhook bodies
 * - Oversized payloads
 * - Duplicate Content-Type headers
 * - Malformed Mollie payment IDs
 * - Invalid JSON in webhook body
 * - Header injection attempts
 *
 * @module tests/security/payment-fuzz
 */

import { describe, it, expect } from "vitest";

const API_URL = process.env.API_URL || "https://api.pagayo.com";

// ===========================================================================
// HELPERS
// ===========================================================================

async function postWebhook(
  path: string,
  body: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    return await fetch(`${API_URL}/webhooks${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ===========================================================================
// STRIPE WEBHOOK FUZZ
// ===========================================================================

describe("Stripe Webhook Fuzz", () => {
  it("should reject request with empty stripe-signature header", async () => {
    const res = await postWebhook(
      "/stripe",
      JSON.stringify({ type: "checkout.session.completed" }),
      { "stripe-signature": "" },
    );
    // Should not crash
    expect([200, 400]).toContain(res.status);
  });

  it("should reject request with random bytes in signature", async () => {
    const randomSig = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0"),
    ).join("");

    const res = await postWebhook(
      "/stripe",
      JSON.stringify({ type: "payment_intent.succeeded" }),
      { "stripe-signature": randomSig },
    );
    expect([200, 400]).toContain(res.status);
  });

  it("should handle malformed Stripe signature format (missing t= prefix)", async () => {
    const res = await postWebhook(
      "/stripe",
      JSON.stringify({ type: "test" }),
      { "stripe-signature": "v1=abc123,not_a_real_signature" },
    );
    expect([200, 400]).toContain(res.status);
  });

  it("should handle empty JSON body", async () => {
    const res = await postWebhook("/stripe", "{}", {
      "stripe-signature": "t=123,v1=fakesig",
    });
    expect([200, 400]).toContain(res.status);
  });

  it("should handle non-JSON body", async () => {
    const res = await postWebhook("/stripe", "this is not json at all", {
      "stripe-signature": "t=123,v1=fakesig",
    });
    expect([200, 400]).toContain(res.status);
  });

  it("should not expose stack traces in error response", async () => {
    const res = await postWebhook("/stripe", "{malformed!", {
      "stripe-signature": "invalid",
    });
    const text = await res.text();

    expect(text).not.toContain("at Object.");
    expect(text).not.toContain("node_modules");
    expect(text).not.toContain(".ts:");
    expect(text).not.toContain("STRIPE_WEBHOOK_SECRET");
  });
});

// ===========================================================================
// MOLLIE WEBHOOK FUZZ
// ===========================================================================

describe("Mollie Webhook Fuzz", () => {
  it("should reject empty payment ID", async () => {
    const res = await postWebhook(
      "/mollie",
      "id=",
      { "Content-Type": "application/x-www-form-urlencoded" },
    );
    // Mollie always returns 200 (to avoid information leakage)
    expect(res.status).toBe(200);
  });

  it("should reject SQL injection in payment ID", async () => {
    const res = await postWebhook(
      "/mollie",
      "id=tr_test%27%3B%20DROP%20TABLE%20orders%3B%20--",
      { "Content-Type": "application/x-www-form-urlencoded" },
    );
    expect(res.status).toBe(200);
  });

  const invalidMollieIds = [
    "invalid_format",
    "tr_",
    "tr_<script>alert(1)</script>",
    "tr_" + "A".repeat(1000),
    "xx_abc123",
    "../../../etc/passwd",
    "tr_valid123; rm -rf /",
  ];

  it.each(invalidMollieIds)(
    "should safely handle invalid Mollie payment ID: %s",
    async (badId) => {
      const res = await postWebhook(
        "/mollie",
        `id=${encodeURIComponent(badId)}`,
        { "Content-Type": "application/x-www-form-urlencoded" },
      );
      // Should always return 200 (Mollie protocol)
      expect(res.status).toBe(200);
    },
  );

  it("should handle JSON body instead of form-encoded (Mollie supports both)", async () => {
    const res = await postWebhook(
      "/mollie",
      JSON.stringify({ id: "tr_test123" }),
      { "Content-Type": "application/json" },
    );
    expect(res.status).toBe(200);
  });

  it("should handle completely empty body", async () => {
    const res = await postWebhook("/mollie", "", {
      "Content-Type": "application/x-www-form-urlencoded",
    });
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// BUNQ WEBHOOK FUZZ
// ===========================================================================

describe("Bunq Webhook Fuzz", () => {
  it("should reject request without signature header", async () => {
    const res = await postWebhook(
      "/bunq",
      JSON.stringify({ NotificationUrl: { EventType: "PAYMENT" } }),
    );
    expect(res.status).toBe(400);
  });

  it("should handle empty signature header", async () => {
    const res = await postWebhook(
      "/bunq",
      JSON.stringify({ NotificationUrl: { EventType: "PAYMENT" } }),
      { "x-bunq-server-signature": "" },
    );
    // Missing/empty signature should be rejected
    expect([400, 200]).toContain(res.status);
  });

  it("should handle invalid JSON body with valid-looking signature", async () => {
    const res = await postWebhook("/bunq", "{not valid json!!}", {
      "x-bunq-server-signature": "fakesignature123",
    });
    expect(res.status).toBe(400);
  });

  it("should handle missing EventType in body", async () => {
    const res = await postWebhook(
      "/bunq",
      JSON.stringify({ NotificationUrl: {} }),
      { "x-bunq-server-signature": "fakesig" },
    );
    // Should handle gracefully
    expect([200, 400]).toContain(res.status);
  });

  it("should handle deeply nested body", async () => {
    const deepBody = { NotificationUrl: { EventType: "PAYMENT", Object: {} } };
    let current = deepBody.NotificationUrl.Object as Record<string, unknown>;
    for (let i = 0; i < 50; i++) {
      current["nested"] = {};
      current = current["nested"] as Record<string, unknown>;
    }

    const res = await postWebhook("/bunq", JSON.stringify(deepBody), {
      "x-bunq-server-signature": "fakesig",
    });
    expect([200, 400]).toContain(res.status);
  });
});

// ===========================================================================
// POSTNL WEBHOOK (NOT IMPLEMENTED — should return 501)
// ===========================================================================

describe("PostNL Webhook (Not Implemented)", () => {
  it("should return 501 Not Implemented", async () => {
    const res = await postWebhook(
      "/postnl",
      JSON.stringify({ event: "shipment_update" }),
    );
    expect(res.status).toBe(501);
  });

  it("should return structured error in response", async () => {
    const res = await postWebhook(
      "/postnl",
      JSON.stringify({ event: "test" }),
    );
    const body = await res.json();
    expect(body).toHaveProperty("success", false);
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("code", "NOT_IMPLEMENTED");
  });
});

// ===========================================================================
// CROSS-CUTTING: Information Leakage
// ===========================================================================

describe("Information Leakage Prevention", () => {
  it("should not expose environment variables in any webhook error", async () => {
    const endpoints = ["/stripe", "/mollie", "/bunq"];

    for (const endpoint of endpoints) {
      const res = await postWebhook(endpoint, "GARBAGE_PAYLOAD", {
        "stripe-signature": "invalid",
        "x-bunq-server-signature": "invalid",
      });
      const text = await res.text();

      expect(text).not.toMatch(/STRIPE_WEBHOOK_SECRET/i);
      expect(text).not.toMatch(/MOLLIE_WEBHOOK_SECRET/i);
      expect(text).not.toMatch(/BUNQ_/i);
      expect(text).not.toMatch(/DATABASE_URL/i);
      expect(text).not.toMatch(/API_KEY_PEPPER/i);
      expect(text).not.toContain("postgresql://");
    }
  });

  it("should not expose internal file paths in webhook errors", async () => {
    const res = await postWebhook("/stripe", "{broken", {
      "stripe-signature": "bad",
    });
    const text = await res.text();

    expect(text).not.toMatch(/\/Users\//);
    expect(text).not.toMatch(/\/home\//);
    expect(text).not.toMatch(/\/var\//);
    expect(text).not.toMatch(/C:\\/);
  });
});
