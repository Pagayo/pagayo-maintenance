import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

type HistoryMode = 'push' | 'replace';
type WriteMode = 'query' | 'path';

interface UseWorkspaceUrlSelectionOptions<TId> {
  queryParam?: string;
  pathPrefix?: string;
  fallbackQueryParam?: string;
  parse: (raw: string) => TId | null;
  serialize: (value: TId) => string;
  writeMode?: WriteMode;
  historyMode?: HistoryMode;
}

interface SetSelectionOptions {
  historyMode?: HistoryMode;
}

type SelectionUpdate<TId> = TId | null | ((current: TId | null) => TId | null);

function buildUrlWithUpdatedSelection<TId>(
  options: UseWorkspaceUrlSelectionOptions<TId>,
  value: TId | null,
): string {
  const url = new URL(window.location.href);
  const writeMode = options.writeMode ?? 'query';
  const effectiveQueryParam = options.queryParam ?? options.fallbackQueryParam;

  if (writeMode === 'path' && options.pathPrefix) {
    const normalizedPrefix = options.pathPrefix.endsWith('/')
      ? options.pathPrefix.slice(0, -1)
      : options.pathPrefix;

    if (value === null) {
      url.pathname = normalizedPrefix;
    } else {
      url.pathname = `${normalizedPrefix}/${encodeURIComponent(options.serialize(value))}`;
    }

    if (effectiveQueryParam) {
      url.searchParams.delete(effectiveQueryParam);
    }

    return `${url.pathname}${url.search}`;
  }

  /**
   * Query-mode met `pathPrefix`: legacy pad `/base/holderId` normaliseren naar `/base`
   * zodat selectie in de querystring landt (deep links + browser refresh).
   */
  if (
    writeMode !== "path"
    && options.pathPrefix
    && effectiveQueryParam
  ) {
    const normalizedPrefix = options.pathPrefix.endsWith("/")
      ? options.pathPrefix.slice(0, -1)
      : options.pathPrefix;
    const prefixWithSlash = `${normalizedPrefix}/`;
    if (url.pathname.startsWith(prefixWithSlash)) {
      url.pathname = normalizedPrefix;
    }
  }

  if (!effectiveQueryParam) {
    return `${url.pathname}${url.search}`;
  }

  if (value === null) {
    url.searchParams.delete(effectiveQueryParam);
  } else {
    url.searchParams.set(effectiveQueryParam, options.serialize(value));
  }

  return `${url.pathname}${url.search}`;
}

function readSelectionFromLocation<TId>(
  options: UseWorkspaceUrlSelectionOptions<TId>,
): TId | null {
  if (options.pathPrefix) {
    const normalizedPrefix = options.pathPrefix.endsWith('/')
      ? options.pathPrefix.slice(0, -1)
      : options.pathPrefix;
    const prefixWithSlash = `${normalizedPrefix}/`;

    if (window.location.pathname.startsWith(prefixWithSlash)) {
      const rawPathValue = decodeURIComponent(window.location.pathname.slice(prefixWithSlash.length).split('/')[0] || '');
      const parsedPathValue = options.parse(rawPathValue);
      if (parsedPathValue !== null) {
        return parsedPathValue;
      }
    }
  }

  const effectiveQueryParam = options.queryParam ?? options.fallbackQueryParam;
  if (!effectiveQueryParam) {
    return null;
  }

  const rawQueryValue = new URLSearchParams(window.location.search).get(effectiveQueryParam);
  if (!rawQueryValue) {
    return null;
  }

  return options.parse(rawQueryValue);
}

export function parsePositiveInteger(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseNonEmptyString(raw: string): string | null {
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

/** Pad-segment voor `/admin/orders/:id` — `new` is gereserveerd voor create-workspace. */
export function parseOrderIdFromAdminPath(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0) {
    return null;
  }
  if (value.toLowerCase() === 'new') {
    return null;
  }
  return value;
}

export function useWorkspaceUrlSelection<TId>(
  options: UseWorkspaceUrlSelectionOptions<TId>,
): [TId | null, (value: SelectionUpdate<TId>, setOptions?: SetSelectionOptions) => void] {
  const [selectedId, setSelectedId] = useState<TId | null>(() => readSelectionFromLocation(options));
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const syncFromUrl = (): void => {
      setSelectedId(readSelectionFromLocation(options));
    };

    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, [options]);

  useEffect(() => {
    const writeMode = options.writeMode ?? 'query';
    if (writeMode !== 'path') {
      return;
    }

    if (selectedId === null) {
      return;
    }

    const nextUrl = buildUrlWithUpdatedSelection(options, selectedId);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl === currentUrl) {
      return;
    }

    window.history.replaceState({}, '', nextUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [options, selectedId]);

  const setSelection = useCallback((value: SelectionUpdate<TId>, setOptions?: SetSelectionOptions): void => {
    const prev = selectedIdRef.current;
    const nextSelected = typeof value === 'function'
      ? (value as (current: TId | null) => TId | null)(prev)
      : value;
    const nextUrl = buildUrlWithUpdatedSelection(options, nextSelected);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    const activeHistoryMode = setOptions?.historyMode ?? options.historyMode ?? 'push';

    setSelectedId(nextSelected);

    if (nextUrl === currentUrl) {
      return;
    }

    if (activeHistoryMode === 'replace') {
      window.history.replaceState({}, '', nextUrl);
    } else {
      window.history.pushState({}, '', nextUrl);
    }

    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [options]);

  return [selectedId, setSelection];
}
