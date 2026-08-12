/**
 * Stripe Tier-1 key-feature probe (admin session required).
 * GET /api/payments/stripe/test + /api/payments/stripe/balance
 * @module tests/smoke/key-features/features/stripe
 */

import {
  fail,
  pass,
  skip,
  type FeatureResult,
} from "./_contract.js";

export interface StripeProbeDeps {
  baseUrl: string;
  sessionCookie: string | null;
  fetchImpl?: typeof fetch;
}

type ApiEnvelope = {
  success?: boolean;
  data?: {
    mode?: string;
    accountId?: string;
    message?: string;
    balance?: unknown;
  };
  error?: { code?: string; message?: string };
};

function cookieHeader(sessionCookie: string): string {
  return `pagayo_session=${sessionCookie}`;
}

async function readJson(response: Response): Promise<ApiEnvelope | null> {
  try {
    return (await response.json()) as ApiEnvelope;
  } catch {
    return null;
  }
}

/**
 * Pure probe — injectable fetch for unit tests.
 */
export async function probeStripe(
  deps: StripeProbeDeps,
): Promise<FeatureResult> {
  const feature = "stripe";
  const fetchImpl = deps.fetchImpl ?? fetch;
  const base = deps.baseUrl.replace(/\/$/, "");

  if (!deps.sessionCookie) {
    return skip(
      feature,
      "AUTH_REQUIRED",
      "SMOKE_ADMIN_SESSION_COOKIE ontbreekt (of lokale loginAsAdmin faalde)",
    );
  }

  const headers = {
    Cookie: cookieHeader(deps.sessionCookie),
    Accept: "application/json",
  };

  let testResponse: Response;
  try {
    testResponse = await fetchImpl(`${base}/api/payments/stripe/test`, {
      headers,
    });
  } catch (error) {
    return fail(
      feature,
      "NETWORK_ERROR",
      error instanceof Error ? error.message : String(error),
      { step: "test" },
    );
  }

  const testBody = await readJson(testResponse);
  if (testResponse.status === 401 || testResponse.status === 403) {
    return fail(feature, "AUTH_FAILED", "Admin sessie geweigerd op /stripe/test", {
      status: testResponse.status,
    });
  }

  if (!testResponse.ok || testBody?.success !== true) {
    const code =
      testBody?.error?.code ??
      (testResponse.status === 400 ? "CONFIGURATION_OR_STRIPE_ERROR" : "HTTP_ERROR");
    return fail(
      feature,
      code,
      testBody?.error?.message ??
        `GET /stripe/test HTTP ${testResponse.status}`,
      { status: testResponse.status, body: testBody },
    );
  }

  const mode = testBody?.data?.mode;
  if (mode !== "TEST") {
    return fail(
      feature,
      "MODE_NOT_TEST",
      `Verwacht stripeMode TEST, kreeg ${String(mode)}`,
      { mode, accountId: testBody?.data?.accountId },
    );
  }

  let balanceResponse: Response;
  try {
    balanceResponse = await fetchImpl(`${base}/api/payments/stripe/balance`, {
      headers,
    });
  } catch (error) {
    return fail(
      feature,
      "NETWORK_ERROR",
      error instanceof Error ? error.message : String(error),
      { step: "balance" },
    );
  }

  const balanceBody = await readJson(balanceResponse);
  if (!balanceResponse.ok || balanceBody?.success !== true) {
    return fail(
      feature,
      balanceBody?.error?.code ?? "BALANCE_HTTP_ERROR",
      balanceBody?.error?.message ??
        `GET /stripe/balance HTTP ${balanceResponse.status}`,
      { status: balanceResponse.status, body: balanceBody },
    );
  }

  return pass(
    feature,
    "STRIPE_OK",
    "Stripe test+balance bereikbaar",
    {
      mode,
      accountId: testBody?.data?.accountId,
    },
  );
}
