/**
 * Gedeelde test configuratie — Single Source of Truth
 *
 * Alle service URLs op één plek. Override via environment variables
 * voor lokale tests of alternatieve test tenants.
 *
 * @module tests/utils/test-config
 */

/** Storefront test URL (actieve productie-tenant: Zwembad het Elderink) */
export const STOREFRONT_URL =
  process.env.STOREFRONT_TEST_URL ?? "https://y0d7wl.pagayo.app";

/** Platform Admin URL (achter CF Access — verwacht 401/302 op beschermde routes) */
export const PLATFORM_ADMIN_URL =
  process.env.PLATFORM_ADMIN_URL ?? "https://admin.pagayo.app";

/** Onboarding URL (start.pagayo.app — account creation flow) */
export const ONBOARDING_URL =
  process.env.ONBOARDING_TEST_URL ?? "https://start.pagayo.app";

/** API Stack URL */
export const API_URL = process.env.API_TEST_URL ?? "https://api.pagayo.com";

/** Edge Worker URL */
export const EDGE_URL = process.env.EDGE_TEST_URL ?? "https://edge.pagayo.app";

/** Workflows Worker URL */
export const WORKFLOWS_URL =
  process.env.WORKFLOWS_TEST_URL ?? "https://workflows.pagayo.app";

/** Marketing site URL */
export const MARKETING_URL =
  process.env.MARKETING_TEST_URL ?? "https://www.pagayo.com";

/** Optionele customer session cookie voor fixture-gedreven storefront smoke tests */
export const SMOKE_SUBSCRIPTION_SESSION_COOKIE =
  process.env.SMOKE_SUBSCRIPTION_SESSION_COOKIE?.trim() || null;

/** Optionele subscription fixture voor max-members limiet test */
export const SMOKE_SUBSCRIPTION_MAX_MEMBERS_ID = Number.parseInt(
  process.env.SMOKE_SUBSCRIPTION_MAX_MEMBERS_ID ?? "",
  10,
);

/** Optionele subscription fixture voor max-adults limiet test */
export const SMOKE_SUBSCRIPTION_ADULT_LIMIT_ID = Number.parseInt(
  process.env.SMOKE_SUBSCRIPTION_ADULT_LIMIT_ID ?? "",
  10,
);

/** Strict host-first tenant resolution check inschakelen voor post-deploy validatie */
export const EXPECT_HOST_FIRST_TENANT_RESOLUTION =
  process.env.EXPECT_HOST_FIRST_TENANT_RESOLUTION === "true";

/**
 * Detecteer of de STOREFRONT_URL een actieve, geprovisioneerde tenant heeft.
 * Gebruikt door storefront smoke tests om tenant-afhankelijke tests te skippen.
 * Checkt de homepage (niet /api/health) — health werkt altijd, ook zonder tenant.
 */
export async function detectTenantActive(): Promise<boolean> {
  try {
    const response = await fetch(STOREFRONT_URL);
    return response.status === 200;
  } catch {
    return false;
  }
}
