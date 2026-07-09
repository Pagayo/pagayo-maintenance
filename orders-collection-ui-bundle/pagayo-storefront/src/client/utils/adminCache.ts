/**
 * Admin Data Cache
 *
 * In-memory cache for admin data. Survives SPA navigation,
 * cleared on page refresh. Invalidated on mutations.
 *
 * STRATEGY:
 * - Admin-only data (products, categories, pages, blog, settings):
 *   Cache forever, invalidate on own mutation.
 * - Externally-mutated data (orders, customers, dashboard):
 *   Cache forever, background version check via KV.
 *   When version mismatch → auto-refetch.
 *
 * @module utils/adminCache
 */

import { unwrapData } from "./unwrapApi";

/**
 * Resource types that can be cached.
 * Used as prefix for cache key grouping and invalidation.
 */
export type AdminResource =
  | "products"
  | "categories"
  | "orders"
  | "customers"
  | "subscriptions"
  | "blog"
  | "pages"
  | "coupons"
  | "announcements"
  | "team"
  | "roles"
  | "dashboard"
  | "settings"
  | "organization";

/**
 * Resources that can be mutated externally (webshop, POS, etc.)
 * These get a background version check on cache hit.
 */
const EXTERNALLY_MUTATED: ReadonlySet<AdminResource> = new Set([
  "orders",
  "customers",
  "dashboard",
]);

interface CacheEntry<T = unknown> {
  data: T;
  resourceType: AdminResource;
}

/** In-memory cache store — Map<url, entry> */
const cache = new Map<string, CacheEntry>();

/** Known resource versions from server — Map<resourceType, version> */
const knownVersions = new Map<AdminResource, string>();

/**
 * Get cached data for a URL key.
 * Returns null if not cached.
 */
export function getCached<T>(cacheKey: string): T | null {
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  return entry.data as T;
}

/**
 * Store data in cache under a URL key.
 */
export function setCache<T>(
  cacheKey: string,
  data: T,
  resourceType: AdminResource,
): void {
  cache.set(cacheKey, { data, resourceType });
}

/**
 * Remove all cached entries for a resource type.
 * Called after mutations (create/edit/delete).
 */
export function invalidateResource(resourceType: AdminResource): void {
  for (const [key, entry] of cache.entries()) {
    if (entry.resourceType === resourceType) {
      cache.delete(key);
    }
  }
  // Also clear known version so next fetch stores the new one
  knownVersions.delete(resourceType);
}

/**
 * Clear entire cache (e.g., on logout).
 */
export function invalidateAll(): void {
  cache.clear();
  knownVersions.clear();
}

/**
 * Check if a resource type is externally mutated
 * and needs background version checking.
 */
export function isExternallyMutated(resourceType: AdminResource): boolean {
  return EXTERNALLY_MUTATED.has(resourceType);
}

/**
 * Build a deterministic cache key from URL and params.
 */
export function buildCacheKey(
  basePath: string,
  params: Record<string, string | number | undefined | null>,
): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  if (sorted.length === 0) return basePath;
  const qs = sorted.map(([k, v]) => `${k}=${v}`).join("&");
  return `${basePath}?${qs}`;
}

/**
 * Store the known version for a resource type (from server response header).
 */
export function setKnownVersion(
  resourceType: AdminResource,
  version: string,
): void {
  knownVersions.set(resourceType, version);
}

/**
 * Get the known version for a resource type.
 */
export function getKnownVersion(
  resourceType: AdminResource,
): string | undefined {
  return knownVersions.get(resourceType);
}

/**
 * Background version check for externally-mutated resources.
 * Calls a lightweight endpoint to compare versions.
 * Returns true if cache is stale (version mismatch).
 */
export async function checkVersionStale(
  resourceType: AdminResource,
): Promise<boolean> {
  try {
    const tenantParam = new URLSearchParams(window.location.search).get(
      "tenant",
    );
    const params = new URLSearchParams({ resource: resourceType });
    if (tenantParam) params.set("tenant", tenantParam);

    const response = await fetch(
      `/api/admin/cache-version?${params.toString()}`,
      {
        credentials: "include",
      },
    );

    if (!response.ok) return false; // On error, assume not stale

    const raw = await response.json();
    const data = unwrapData<{ version: string }>(raw);
    const known = knownVersions.get(resourceType);

    if (!known) {
      // First time — store version, not stale
      knownVersions.set(resourceType, data.version);
      return false;
    }

    if (data.version !== known) {
      // Version changed — cache is stale
      knownVersions.set(resourceType, data.version);
      return true;
    }

    return false;
  } catch (err) {
    // Network error — assume not stale, but log for observability
    console.warn(
      `[adminCache] checkVersionStale(${resourceType}) failed:`,
      err,
    );
    return false;
  }
}
