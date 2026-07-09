/** Scroll container for admin workspace detail panes (see DESIGN.md / ADMIN-UI Scroll Contract). */
export const ADMIN_WORKSPACE_DETAIL_SCROLL_SELECTOR = '.products-detail-card';

/** @deprecated Use ADMIN_WORKSPACE_DETAIL_SCROLL_SELECTOR */
export const ADMIN_PRODUCT_DETAIL_SCROLL_SELECTOR = ADMIN_WORKSPACE_DETAIL_SCROLL_SELECTOR;

export function getWorkspaceDetailScrollElement(
  selector: string = ADMIN_WORKSPACE_DETAIL_SCROLL_SELECTOR,
): HTMLElement | null {
  return document.querySelector<HTMLElement>(selector);
}

/** @deprecated Use getWorkspaceDetailScrollElement */
export function getAdminProductDetailScrollElement(): HTMLElement | null {
  return getWorkspaceDetailScrollElement();
}

export function captureWorkspaceDetailScrollTop(
  selector: string = ADMIN_WORKSPACE_DETAIL_SCROLL_SELECTOR,
): number {
  return getWorkspaceDetailScrollElement(selector)?.scrollTop ?? 0;
}

/** @deprecated Use captureWorkspaceDetailScrollTop */
export function captureAdminProductDetailScrollTop(): number {
  return captureWorkspaceDetailScrollTop();
}

export function restoreWorkspaceDetailScrollTop(
  scrollTop: number,
  selector: string = ADMIN_WORKSPACE_DETAIL_SCROLL_SELECTOR,
): void {
  requestAnimationFrame(() => {
    const el = getWorkspaceDetailScrollElement(selector);
    if (el) {
      el.scrollTop = scrollTop;
    }
  });
}

/** @deprecated Use restoreWorkspaceDetailScrollTop */
export function restoreAdminProductDetailScrollTop(scrollTop: number): void {
  restoreWorkspaceDetailScrollTop(scrollTop);
}

/** Run an async mutation and restore detail-pane scroll after state updates. */
export async function withPreservedWorkspaceDetailScroll<T>(
  action: () => Promise<T>,
  selector: string = ADMIN_WORKSPACE_DETAIL_SCROLL_SELECTOR,
): Promise<T> {
  const scrollTop = captureWorkspaceDetailScrollTop(selector);
  try {
    return await action();
  } finally {
    restoreWorkspaceDetailScrollTop(scrollTop, selector);
  }
}

/** @deprecated Use withPreservedWorkspaceDetailScroll */
export async function withPreservedAdminProductDetailScroll<T>(
  action: () => Promise<T>,
): Promise<T> {
  return withPreservedWorkspaceDetailScroll(action);
}
