/**
 * Stripe Tier-1 key-feature probe (machine auth, no admin session).
 * GET /api/internal/key-features/stripe with X-Internal-Secret.
 * @module tests/smoke/key-features/features/stripe
 */

import {
  fail,
  pass,
  skip,
  type FeatureResult,
} from "./_contract.js";

/** Storefront contract path — see docs/key-features/stripe-internal-probe.md */
export const STRIPE_KEY_FEATURE_PATH = "/api/internal/key-features/stripe";
export const INTERNAL_SECRET_HEADER = "X-Internal-Secret";

export interface StripeProbeDeps {
  baseUrl: string;
  /** Long-lived storefront internal secret (not a session cookie). */
  internalSecret: string | null;
  fetchImpl?: typeof fetch;
}

type ApiEnvelope = {
  success?: boolean;
  data?: {
    feature?: string;
    mode?: string;
    accountId?: string;
    balanceOk?: boolean;
    message?: string;
  };
  error?: { code?: string; message?: string };
};

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

  if (!deps.internalSecret) {
    return skip(
      feature,
      "AUTH_REQUIRED",
      "SMOKE_INTERNAL_SERVICE_KEY ontbreekt (machine-auth voor key-feature probe)",
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(`${base}${STRIPE_KEY_FEATURE_PATH}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        [INTERNAL_SECRET_HEADER]: deps.internalSecret,
      },
    });
  } catch (error) {
    return fail(
      feature,
      "NETWORK_ERROR",
      error instanceof Error ? error.message : String(error),
    );
  }

  if (response.status === 404) {
    return fail(
      feature,
      "ENDPOINT_MISSING",
      "Storefront mist GET /api/internal/key-features/stripe — implementeer contract",
      { status: 404 },
    );
  }

  if (response.status === 401 || response.status === 403) {
    return fail(
      feature,
      "AUTH_FAILED",
      "Internal secret geweigerd op key-features/stripe",
      { status: response.status },
    );
  }

  const body = await readJson(response);

  if (!response.ok || body?.success !== true) {
    const code =
      body?.error?.code ??
      (response.status === 400
        ? "CONFIGURATION_OR_STRIPE_ERROR"
        : "HTTP_ERROR");
    return fail(
      feature,
      code,
      body?.error?.message ??
        `GET ${STRIPE_KEY_FEATURE_PATH} HTTP ${response.status}`,
      { status: response.status, body },
    );
  }

  const mode = body?.data?.mode;
  if (mode !== "TEST") {
    return fail(
      feature,
      "MODE_NOT_TEST",
      `Verwacht stripeMode TEST, kreeg ${String(mode)}`,
      { mode, accountId: body?.data?.accountId },
    );
  }

  if (body?.data?.balanceOk !== true) {
    return fail(
      feature,
      "BALANCE_NOT_OK",
      "Stripe balance check faalde (balanceOk !== true)",
      { accountId: body?.data?.accountId },
    );
  }

  return pass(feature, "STRIPE_OK", "Stripe TEST + balance bereikbaar (machine auth)", {
    mode,
    accountId: body?.data?.accountId,
  });
}
