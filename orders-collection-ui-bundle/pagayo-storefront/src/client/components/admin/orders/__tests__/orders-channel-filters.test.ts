import { describe, expect, it } from 'vitest';
import {
  buildOrdersChannelApiParams,
  parseOrdersChannelFilterFromSearchParams,
  serializeOrdersChannelFilterForCache,
  serializeOrdersChannelFilterToSearchParams,
} from '../orders-channel-filters';

describe('orders-channel-filters', () => {
  it('parse/serialize roundtrip voor POS terminal', () => {
    const parsed = parseOrdersChannelFilterFromSearchParams(
      new URLSearchParams('source=POS&posTerminalId=3'),
    );
    expect(parsed).toEqual({ kind: 'pos', terminalId: 3 });

    const params = new URLSearchParams('tenant=demo');
    serializeOrdersChannelFilterToSearchParams(parsed, params);
    expect(params.get('source')).toBe('POS');
    expect(params.get('posTerminalId')).toBe('3');
    expect(params.get('tenant')).toBe('demo');
  });

  it('buildOrdersChannelApiParams voor webshop', () => {
    expect(buildOrdersChannelApiParams({ kind: 'webshop', webshopId: 'demo' })).toEqual({
      source: 'WEB',
      webshopId: 'demo',
    });
    expect(serializeOrdersChannelFilterForCache({ kind: 'webshop', webshopId: 'all' })).toBe('WEB');
  });
});
