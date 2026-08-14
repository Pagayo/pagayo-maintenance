/**
 * Pins the storefront machine-auth contract used by smoke:key-features.
 * @see docs/key-features/stripe-internal-probe.md
 */
import { describe, expect, it } from "vitest";
import {
  INTERNAL_SECRET_HEADER,
  STRIPE_KEY_FEATURE_PATH,
} from "../smoke/key-features/features/stripe.js";

describe("key-features stripe probe contract", () => {
  it("uses internal path and X-Internal-Secret header", () => {
    expect(STRIPE_KEY_FEATURE_PATH).toBe("/api/internal/key-features/stripe");
    expect(INTERNAL_SECRET_HEADER).toBe("X-Internal-Secret");
  });
});
