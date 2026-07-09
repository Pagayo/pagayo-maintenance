/**
 * Orders workspace channel filters — URL sync + API param builders.
 *
 * SSoT for POS/Webshop toolbar filter state (OPEN-PUNT #94).
 */

export type OrdersChannelFilter =
  | { kind: 'all' }
  | { kind: 'pos'; terminalId: number | 'all' }
  | { kind: 'webshop'; webshopId: string | 'all' };

export const ORDERS_CHANNEL_ALL: OrdersChannelFilter = { kind: 'all' };

export function isOrdersChannelFilterActive(filter: OrdersChannelFilter): boolean {
  return filter.kind !== 'all';
}

/**
 * Stub for single-webshop tenants. Extend when multi-webshop metadata exists.
 */
export function resolveWebshopChannels(
  tenantSlug: string,
  defaultLabel: string,
): Array<{ id: string; label: string }> {
  const normalizedSlug = tenantSlug.trim();
  if (!normalizedSlug) {
    return [];
  }

  return [{ id: normalizedSlug, label: defaultLabel }];
}

export function parseOrdersChannelFilterFromSearchParams(
  searchParams: URLSearchParams,
): OrdersChannelFilter {
  const source = searchParams.get('source');
  if (source === 'POS') {
    const rawTerminalId = searchParams.get('posTerminalId')?.trim();
    if (rawTerminalId) {
      const parsed = Number(rawTerminalId);
      if (Number.isInteger(parsed) && parsed > 0) {
        return { kind: 'pos', terminalId: parsed };
      }
    }
    return { kind: 'pos', terminalId: 'all' };
  }

  if (source === 'WEB') {
    const rawWebshopId = searchParams.get('webshopId')?.trim();
    if (rawWebshopId) {
      return { kind: 'webshop', webshopId: rawWebshopId };
    }
    return { kind: 'webshop', webshopId: 'all' };
  }

  return ORDERS_CHANNEL_ALL;
}

export function serializeOrdersChannelFilterToSearchParams(
  filter: OrdersChannelFilter,
  params: URLSearchParams,
): void {
  params.delete('source');
  params.delete('posTerminalId');
  params.delete('webshopId');

  if (filter.kind === 'pos') {
    params.set('source', 'POS');
    if (filter.terminalId !== 'all') {
      params.set('posTerminalId', String(filter.terminalId));
    }
    return;
  }

  if (filter.kind === 'webshop') {
    params.set('source', 'WEB');
    if (filter.webshopId !== 'all') {
      params.set('webshopId', filter.webshopId);
    }
  }
}

export function buildOrdersChannelApiParams(filter: OrdersChannelFilter): {
  source?: string;
  posTerminalId?: string;
  webshopId?: string;
} {
  if (filter.kind === 'all') {
    return {};
  }

  if (filter.kind === 'pos') {
    if (filter.terminalId === 'all') {
      return { source: 'POS' };
    }
    return {
      source: 'POS',
      posTerminalId: String(filter.terminalId),
    };
  }

  if (filter.webshopId === 'all') {
    return { source: 'WEB' };
  }

  return {
    source: 'WEB',
    webshopId: filter.webshopId,
  };
}

export function serializeOrdersChannelFilterForCache(
  filter: OrdersChannelFilter,
): string | undefined {
  if (filter.kind === 'all') {
    return undefined;
  }

  if (filter.kind === 'pos') {
    return filter.terminalId === 'all' ? 'POS' : `POS:${filter.terminalId}`;
  }

  return filter.webshopId === 'all' ? 'WEB' : `WEB:${filter.webshopId}`;
}

export function syncOrdersWorkspaceUrlParams(options: {
  search: string;
  channelFilter: OrdersChannelFilter;
}): void {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  const trimmedSearch = options.search.trim();
  if (trimmedSearch) {
    params.set('search', trimmedSearch);
  } else {
    params.delete('search');
  }

  serializeOrdersChannelFilterToSearchParams(options.channelFilter, params);

  const query = params.toString();
  const nextUrl = query ? `${url.pathname}?${query}` : url.pathname;
  window.history.replaceState({}, '', nextUrl);
}
