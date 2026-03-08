/**
 * Gedeelde test configuratie — Single Source of Truth
 *
 * Alle service URLs op één plek. Override via environment variables
 * voor lokale tests of alternatieve test tenants.
 *
 * @module tests/utils/test-config
 */

/** Storefront test URL (geen actieve tenant — Worker deployment verificatie) */
export const STOREFRONT_URL =
  process.env.STOREFRONT_TEST_URL ?? "https://demo.pagayo.app";

/**
 * @deprecated V2: beheer is geabsorbeerd in storefront. Deze URL redirect naar www.pagayo.com.
 * Wordt nog gebruikt door legacy test suites die gemigreerd moeten worden.
 */
export const BEHEER_URL =
  process.env.BEHEER_TEST_URL ?? "https://beheer.pagayo.com";

/** API Stack URL */
export const API_URL = process.env.API_TEST_URL ?? "https://api.pagayo.com";

/** Marketing site URL */
export const MARKETING_URL =
  process.env.MARKETING_TEST_URL ?? "https://www.pagayo.com";

/** Onboarding URL (start.pagayo.app — account creation flow) */
export const ONBOARDING_URL =
  process.env.ONBOARDING_TEST_URL ?? "https://start.pagayo.app";

/** Service domains for infrastructure tests */
export const SERVICE_DOMAINS = {
  storefront: new URL(STOREFRONT_URL).hostname,
  api: new URL(API_URL).hostname,
  marketing: new URL(MARKETING_URL).hostname,
} as const;

/**
 * Auto-detect of de STOREFRONT_URL een actieve, geprovisioneerde tenant heeft.
 * Probeert de homepage — 200 = tenant actief, 404 "Tenant not found" = geen tenant.
 *
 * Gebruik in `beforeAll()` van test suites voor conditionele expectations.
 * Hiermee werken tests correct in BEIDE scenario's:
 *   - Geen tenant → Worker deployment verificatie (404 is verwacht)
 *   - Tenant actief → Volledige functionele verificatie
 */
export async function detectTenantActive(): Promise<boolean> {
  try {
    const response = await fetch(STOREFRONT_URL);
    return response.status === 200;
  } catch {
    return false;
  }
}
