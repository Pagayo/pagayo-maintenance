/**
 * Lightweight admin SPA navigation without pulling in Router lazy routes.
 *
 * @module client/lib/admin-navigate
 */
import { normalizeBaliePath } from "../../lib/admin-nav-core";
import { getCheckInScannerIdFromPath } from "../utils/check-in-url";
import { syncPwaManifestFromLocation } from "../lib/sync-pwa-manifest";

/**
 * Navigate programmatically without full page reload.
 * Updates browser history and triggers Router listeners where applicable.
 */
export function navigate(to: string): void {
  const resolved = new URL(to, window.location.origin);

  // Website storefront edit opens via full document navigation (not admin SPA).
  if (
    !resolved.pathname.startsWith("/admin")
    && !resolved.pathname.startsWith("/pos")
    && resolved.pathname !== "/members-desk"
    && resolved.pathname !== "/members-balie"
  ) {
    const target = `${resolved.pathname}${resolved.search}`;
    const currentUrl = window.location.pathname + window.location.search;
    if (target !== currentUrl) {
      window.location.assign(target);
    }
    return;
  }

  if (getCheckInScannerIdFromPath(resolved.pathname) !== null) {
    let search = resolved.search;
    if (!search && window.location.search) {
      search = window.location.search;
    }
    const target = `${resolved.pathname}${search}`;
    const currentUrl = window.location.pathname + window.location.search;
    if (target !== currentUrl) {
      window.location.assign(target);
    }
    return;
  }

  const baliePath = normalizeBaliePath(resolved.pathname);
  if (baliePath) {
    let search = resolved.search;
    if (!search && window.location.search) {
      search = window.location.search;
    }
    const target = `${baliePath}${search}`;
    const currentUrl = window.location.pathname + window.location.search;
    if (target !== currentUrl) {
      window.location.replace(target);
    }
    return;
  }

  const currentUrl = window.location.pathname + window.location.search;
  if (currentUrl !== to) {
    window.history.pushState({}, "", to);
    syncPwaManifestFromLocation();
    window.scrollTo(0, 0);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
