/**
 * Admin workspace master-detail list pagination (client + worker).
 *
 * Mirror of `@pagayo/config/pagination` `ADMIN_WORKSPACE_LIST_*` until the
 * storefront lockfile includes a published @pagayo/config with those exports.
 */
export const ADMIN_WORKSPACE_LIST_PAGE_SIZE = 25;

/** Max items per bulk fetch for client-side list pagination */
export const ADMIN_WORKSPACE_LIST_MAX_LIMIT = 500;

export const ADMIN_WORKSPACE_LIST_PAGINATION = {
  defaultLimit: ADMIN_WORKSPACE_LIST_PAGE_SIZE,
  maxLimit: ADMIN_WORKSPACE_LIST_MAX_LIMIT,
} as const;
