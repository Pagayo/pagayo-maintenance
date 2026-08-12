/**
 * Key-feature smoke runner — script-first, no Playwright.
 * Output: one JSON line per feature. Exit 1 if any status=fail.
 *
 * @module tests/smoke/key-features/runner
 */

import { probeStripe } from "./features/stripe.js";
import { runFeature, type FeatureResult } from "./features/_contract.js";
import { SMOKE_ADMIN_SESSION_COOKIE } from "../../utils/test-config.js";
import { isLocalEnvironment, loginAsAdmin } from "../../utils/auth-helper.js";

const DEFAULT_STAGING_URL = "https://demo.staging.pagayo.app";

export function resolveKeyFeatureBaseUrl(): string {
  return (
    process.env.SMOKE_STOREFRONT_URL?.trim() ||
    process.env.STOREFRONT_TEST_URL?.trim() ||
    DEFAULT_STAGING_URL
  );
}

async function resolveAdminCookie(baseUrl: string): Promise<string | null> {
  if (SMOKE_ADMIN_SESSION_COOKIE) {
    return SMOKE_ADMIN_SESSION_COOKIE;
  }

  // loginAsAdmin uses STOREFRONT_URL from test-config — only safe for localhost.
  const local =
    baseUrl.includes("localhost") ||
    baseUrl.includes("127.0.0.1") ||
    isLocalEnvironment();
  if (!local) {
    return null;
  }

  const login = await loginAsAdmin();
  return login.success ? login.sessionCookie : null;
}

export async function runKeyFeatures(options?: {
  baseUrl?: string;
  sessionCookie?: string | null;
}): Promise<FeatureResult[]> {
  const baseUrl = options?.baseUrl ?? resolveKeyFeatureBaseUrl();
  const sessionCookie =
    options?.sessionCookie !== undefined
      ? options.sessionCookie
      : await resolveAdminCookie(baseUrl);

  const results: FeatureResult[] = [];

  results.push(
    await runFeature("stripe", () =>
      probeStripe({ baseUrl, sessionCookie }),
    ),
  );

  // Future: email, shipping, mollie — register here or auto-discover.

  return results;
}

function printResults(results: FeatureResult[]): number {
  let exitCode = 0;
  for (const result of results) {
    console.log(JSON.stringify(result));
    if (result.status === "fail") {
      exitCode = 1;
    }
  }
  return exitCode;
}

async function main(): Promise<void> {
  const results = await runKeyFeatures();
  const code = printResults(results);
  process.exit(code);
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("runner.ts") ||
    process.argv[1].endsWith("runner.js"));

if (isDirectRun) {
  main().catch((error) => {
    console.log(
      JSON.stringify({
        feature: "runner",
        status: "fail",
        code: "RUNNER_CRASH",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exit(1);
  });
}
