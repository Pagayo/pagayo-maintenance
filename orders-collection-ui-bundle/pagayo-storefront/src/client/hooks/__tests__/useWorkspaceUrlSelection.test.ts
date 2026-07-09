import { act, renderHook } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import {
  parseNonEmptyString,
  parsePositiveInteger,
  useWorkspaceUrlSelection,
} from '../useWorkspaceUrlSelection';

function setUrl(pathAndSearch: string): void {
  window.history.replaceState({}, '', pathAndSearch);
}

describe('useWorkspaceUrlSelection', () => {
  afterEach(() => {
    setUrl('/admin/products');
  });

  it('reads initial integer selection from query', () => {
    setUrl('/admin/products?tenant=demo&selectedProductId=42');

    const { result } = renderHook(() => useWorkspaceUrlSelection<number>({
      queryParam: 'selectedProductId',
      parse: parsePositiveInteger,
      serialize: (value) => String(value),
    }));

    expect(result.current[0]).toBe(42);
  });

  it('updates url while preserving tenant query', () => {
    setUrl('/admin/products?tenant=demo');

    const { result } = renderHook(() => useWorkspaceUrlSelection<number>({
      queryParam: 'selectedProductId',
      parse: parsePositiveInteger,
      serialize: (value) => String(value),
    }));

    act(() => {
      result.current[1](55);
    });

    const search = new URLSearchParams(window.location.search);
    expect(search.get('tenant')).toBe('demo');
    expect(search.get('selectedProductId')).toBe('55');
  });

  it('supports functional updates with latest selection', () => {
    setUrl('/admin/products?tenant=demo&selectedProductId=42');

    const { result } = renderHook(() => useWorkspaceUrlSelection<number>({
      queryParam: 'selectedProductId',
      parse: parsePositiveInteger,
      serialize: (value) => String(value),
    }));

    expect(result.current[0]).toBe(42);

    act(() => {
      result.current[1]((current) => (current === 42 ? 99 : current));
    });

    expect(result.current[0]).toBe(99);
    const search = new URLSearchParams(window.location.search);
    expect(search.get('tenant')).toBe('demo');
    expect(search.get('selectedProductId')).toBe('99');
  });

  it('removes selection query when value becomes null', () => {
    setUrl('/admin/products?tenant=demo&selectedProductId=55');

    const { result } = renderHook(() => useWorkspaceUrlSelection<number>({
      queryParam: 'selectedProductId',
      parse: parsePositiveInteger,
      serialize: (value) => String(value),
    }));

    act(() => {
      result.current[1](null);
    });

    const search = new URLSearchParams(window.location.search);
    expect(search.get('tenant')).toBe('demo');
    expect(search.get('selectedProductId')).toBeNull();
  });

  it('syncs when browser navigation changes query selection', () => {
    setUrl('/admin/products?selectedProductId=1');

    const { result } = renderHook(() => useWorkspaceUrlSelection<number>({
      queryParam: 'selectedProductId',
      parse: parsePositiveInteger,
      serialize: (value) => String(value),
    }));

    expect(result.current[0]).toBe(1);

    act(() => {
      setUrl('/admin/products?selectedProductId=8');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current[0]).toBe(8);
  });

  it('supports string identifiers', () => {
    setUrl('/admin/integrations?selectedIntegration=stripe');

    const { result } = renderHook(() => useWorkspaceUrlSelection<string>({
      queryParam: 'selectedIntegration',
      parse: parseNonEmptyString,
      serialize: (value) => value,
    }));

    expect(result.current[0]).toBe('stripe');

    act(() => {
      result.current[1]('mollie');
    });

    const search = new URLSearchParams(window.location.search);
    expect(search.get('selectedIntegration')).toBe('mollie');
  });

  it('reads and writes path-based selection', () => {
    setUrl('/admin/products/91?tenant=demo');

    const { result } = renderHook(() => useWorkspaceUrlSelection<number>({
      pathPrefix: '/admin/products',
      parse: parsePositiveInteger,
      serialize: (value) => String(value),
      writeMode: 'path',
    }));

    expect(result.current[0]).toBe(91);

    act(() => {
      result.current[1](120);
    });

    expect(window.location.pathname).toBe('/admin/products/120');
    expect(new URLSearchParams(window.location.search).get('tenant')).toBe('demo');
  });

  it('supports legacy query fallback while canonicalizing to path', () => {
    setUrl('/admin/subscriptions?tenant=demo&selectedSubscriptionId=33');

    const { result } = renderHook(() => useWorkspaceUrlSelection<number>({
      pathPrefix: '/admin/subscriptions',
      fallbackQueryParam: 'selectedSubscriptionId',
      parse: parsePositiveInteger,
      serialize: (value) => String(value),
      writeMode: 'path',
    }));

    expect(result.current[0]).toBe(33);

    act(() => {
      result.current[1](33, { historyMode: 'replace' });
    });

    expect(window.location.pathname).toBe('/admin/subscriptions/33');
    expect(new URLSearchParams(window.location.search).get('selectedSubscriptionId')).toBeNull();
    expect(new URLSearchParams(window.location.search).get('tenant')).toBe('demo');
  });

  it('query mode + pathPrefix: reads holder id from legacy /members/:holder path', () => {
    setUrl('/admin/subscriptions/members/mem_2?tenant=demo');

    const { result } = renderHook(() => useWorkspaceUrlSelection<string>({
      queryParam: 'selectedHolderId',
      pathPrefix: '/admin/subscriptions/members',
      parse: parseNonEmptyString,
      serialize: (value) => value,
    }));

    expect(result.current[0]).toBe('mem_2');
  });

  it('query mode + pathPrefix: writes selection as query on base path (strips path segment)', () => {
    setUrl('/admin/subscriptions/members/mem_2');

    const { result } = renderHook(() => useWorkspaceUrlSelection<string>({
      queryParam: 'selectedHolderId',
      pathPrefix: '/admin/subscriptions/members',
      parse: parseNonEmptyString,
      serialize: (value) => value,
    }));

    expect(result.current[0]).toBe('mem_2');

    act(() => {
      result.current[1]('sub_25');
    });

    expect(window.location.pathname).toBe('/admin/subscriptions/members');
    const search = new URLSearchParams(window.location.search);
    expect(search.get('selectedHolderId')).toBe('sub_25');
  });
});
