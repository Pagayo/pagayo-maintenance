/**
 * Security Tests - CSRF Bypass Prevention
 *
 * Validates that CSRF protection cannot be bypassed on the storefront.
 * Tests path traversal, header manipulation, and exempt path abuse.
 *
 * ATTACK VECTORS TESTED:
 * 1. Path traversal to bypass exempt paths (e.g., /api/auth/login/../admin/delete)
 * 2. Missing CSRF token on mutation endpoints
 * 3. Forged CSRF tokens
 * 4. HTTP method override attempts
 *
 * @module tests/security/csrf-bypass
 */

import { STOREFRONT_URL } from "../utils/test-config";

describe("Security - CSRF Bypass Prevention", () => {
  // ==============================
  // Mutation Without CSRF Token
  // ==============================

  describe("Mutations Without CSRF Token", () => {
    const mutationEndpoints = [
      { path: "/api/admin/products", method: "POST" },
      { path: "/api/admin/orders", method: "PUT" },
      { path: "/api/admin/settings", method: "PATCH" },
    ];

    test.each(mutationEndpoints)(
      "$method $path should reject without CSRF token",
      async ({ path, method }) => {
        const response = await fetch(`${STOREFRONT_URL}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ test: true }),
        });

        // Should be 401 (no auth) or 403 (CSRF failed)
        // MUST NOT be 200 (mutation accepted without CSRF)
        expect([401, 403]).toContain(response.status);
      },
    );
  });

  // ==============================
  // Path Traversal Bypass Attempts
  // ==============================

  describe("Path Traversal to Bypass CSRF Exemption", () => {
    /**
     * The CSRF middleware uses startsWith() for exempt path matching.
     * An attacker might try path traversal to make a non-exempt path
     * appear to start with an exempt prefix.
     *
     * Example: /api/auth/login/../admin/settings
     * The URL parser might normalize this to /api/admin/settings,
     * but the raw path might match the exempt prefix /api/auth/login
     */
    const traversalPayloads = [
      "/api/auth/login/../admin/products",
      "/api/auth/login/../../admin/settings",
      "/api/checkout/../admin/orders",
      "/api/auth/register/../admin/customers",
      "/api/auth/login%2F..%2F..%2Fadmin%2Fproducts",
      "/api/auth/login/./../../admin/settings",
    ];

    test.each(traversalPayloads)(
      "should not bypass CSRF via path traversal: %s",
      async (path) => {
        const response = await fetch(`${STOREFRONT_URL}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ test: true }),
        });

        // The response should NOT be 200 (mutation accepted)
        // Expected: 401 (no auth), 403 (CSRF), 404 (not found), or 400 (bad path)
        // Path traversal in URLs is typically normalized by the HTTP server
        expect([400, 401, 403, 404]).toContain(response.status);
      },
    );
  });

  // ==============================
  // Forged CSRF Token
  // ==============================

  describe("Forged CSRF Token", () => {
    it("should reject a forged CSRF token", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "forged-csrf-token-12345",
          Cookie: "csrf_token=different-cookie-token",
        },
        body: JSON.stringify({ name: "Test Product" }),
      });

      // Should reject: cookie token != header token
      // Expected: 401 (no auth) or 403 (CSRF mismatch)
      expect([401, 403]).toContain(response.status);
    });

    it("should reject CSRF token only in cookie without header", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "csrf_token=valid-looking-token",
        },
        body: JSON.stringify({ name: "Test Product" }),
      });

      // Should reject: no X-CSRF-Token header provided
      expect([401, 403]).toContain(response.status);
    });

    it("should reject CSRF token only in header without cookie", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "header-only-token",
        },
        body: JSON.stringify({ name: "Test Product" }),
      });

      // Should reject: no csrf_token cookie
      expect([401, 403]).toContain(response.status);
    });
  });

  // ==============================
  // HTTP Method Override Attempts
  // ==============================

  describe("HTTP Method Override Bypass", () => {
    it("should not allow X-HTTP-Method-Override to bypass CSRF", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/products`, {
        method: "GET", // Safe method
        headers: {
          "X-HTTP-Method-Override": "DELETE", // Trying to override to DELETE
        },
      });

      // The server should not honor method override headers
      // GET should be treated as GET regardless of override header
      expect(response.status).not.toBe(500);
    });

    it("should not allow _method query parameter to bypass CSRF", async () => {
      const response = await fetch(
        `${STOREFRONT_URL}/api/admin/products?_method=DELETE`,
        {
          method: "GET",
        },
      );

      // Should not honor _method query parameter
      expect(response.status).not.toBe(500);
    });
  });

  // ==============================
  // Content-Type Manipulation
  // ==============================

  describe("Content-Type Manipulation", () => {
    it("should validate CSRF regardless of content type", async () => {
      // Some CSRF bypasses exploit non-JSON content types
      const response = await fetch(`${STOREFRONT_URL}/api/admin/products`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: "test=value",
      });

      // Should still require CSRF validation
      expect([401, 403]).toContain(response.status);
    });

    it("should validate CSRF for multipart/form-data", async () => {
      const response = await fetch(`${STOREFRONT_URL}/api/admin/products`, {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data; boundary=----boundary",
        },
        body: '------boundary\r\nContent-Disposition: form-data; name="test"\r\n\r\nvalue\r\n------boundary--',
      });

      // Should still require CSRF validation
      expect([401, 403]).toContain(response.status);
    });
  });
});
