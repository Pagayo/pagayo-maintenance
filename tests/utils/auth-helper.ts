/**
 * Auth Helper — Authenticated Test Utilities
 * ============================================================================
 * Biedt login helpers voor smoke tests die authenticated flows testen.
 * Werkt ALLEEN tegen een lokale dev server (localhost) met seeded test data.
 *
 * Sessie cookie: `pagayo_session` (KV-based, set door Hono setCookie)
 *
 * @module tests/utils/auth-helper
 */

import { STOREFRONT_URL } from "./test-config";

/** Session cookie naam (moet matchen met SESSION_COOKIE_NAME in storefront) */
const SESSION_COOKIE = "pagayo_session";

/** Test credentials — moeten overeenkomen met seeded data in local dev */
export const TEST_CUSTOMER = {
  identifier: "test@example.com",
  password: "Test1234!",
} as const;

export const TEST_ADMIN = {
  email: "admin@example.com",
  password: "Admin1234!",
} as const;

interface LoginResult {
  success: boolean;
  sessionCookie: string | null;
  error?: string;
}

/**
 * Detecteer of STOREFRONT_URL naar localhost/lokale dev wijst.
 * Authenticated tests mogen ALLEEN draaien tegen een lokale server,
 * want we kunnen geen test sessions aanmaken op productie.
 */
export function isLocalEnvironment(): boolean {
  return (
    STOREFRONT_URL.includes("localhost") || STOREFRONT_URL.includes("127.0.0.1")
  );
}

/**
 * Extract session cookie waarde uit Set-Cookie header(s).
 * Hono's setCookie zet het als `pagayo_session=<uuid>; Path=/; ...`
 */
function extractSessionCookie(headers: Headers): string | null {
  // fetch() combineert meerdere set-cookie in getSetCookie (Node 20+)
  // maar headers.get("set-cookie") geeft soms alleen de eerste
  const setCookieRaw = headers.get("set-cookie") ?? "";

  // Zoek de pagayo_session cookie
  const match = setCookieRaw.match(new RegExp(`${SESSION_COOKIE}=([^;\\s]+)`));
  return match ? match[1] : null;
}

/**
 * Login als customer via POST /api/auth/login.
 * Retourneert de session cookie waarde bij succes.
 */
export async function loginAsCustomer(
  credentials = TEST_CUSTOMER,
): Promise<LoginResult> {
  try {
    const response = await fetch(`${STOREFRONT_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: credentials.identifier,
        password: credentials.password,
      }),
      redirect: "manual",
    });

    if (response.status !== 200) {
      const body = await response.text();
      return {
        success: false,
        sessionCookie: null,
        error: `Login failed: HTTP ${response.status} — ${body.slice(0, 200)}`,
      };
    }

    const cookie = extractSessionCookie(response.headers);
    if (!cookie) {
      return {
        success: false,
        sessionCookie: null,
        error: "Login returned 200 but no session cookie in response",
      };
    }

    return { success: true, sessionCookie: cookie };
  } catch (err) {
    return {
      success: false,
      sessionCookie: null,
      error: `Login request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Login als admin via POST /api/admin/login.
 * Admin login endpoint kan op een ander pad zitten; dit probeert de bekende paden.
 */
export async function loginAsAdmin(
  credentials = TEST_ADMIN,
): Promise<LoginResult> {
  try {
    const response = await fetch(`${STOREFRONT_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
      redirect: "manual",
    });

    if (response.status !== 200) {
      const body = await response.text();
      return {
        success: false,
        sessionCookie: null,
        error: `Admin login failed: HTTP ${response.status} — ${body.slice(0, 200)}`,
      };
    }

    const cookie = extractSessionCookie(response.headers);
    if (!cookie) {
      return {
        success: false,
        sessionCookie: null,
        error: "Admin login returned 200 but no session cookie",
      };
    }

    return { success: true, sessionCookie: cookie };
  } catch (err) {
    return {
      success: false,
      sessionCookie: null,
      error: `Admin login request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Maak een authenticated fetch functie die de session cookie meestuurt.
 * Gebruik: `const authFetch = createAuthFetch(sessionCookie);`
 */
export function createAuthFetch(
  sessionCookie: string,
): (url: string, init?: RequestInit) => Promise<Response> {
  return (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set("Cookie", `${SESSION_COOKIE}=${sessionCookie}`);
    return fetch(url, { ...init, headers, redirect: "manual" });
  };
}
