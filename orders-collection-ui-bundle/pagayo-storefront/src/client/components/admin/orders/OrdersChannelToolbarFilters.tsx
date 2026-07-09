/** @jsxImportSource preact */
/**
 * OrdersChannelToolbarFilters — POS/Webshop kanaalfilters in orders-toolbar.
 */
import { FunctionalComponent } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { WorkspaceFilterToggleButton } from '../shared';
import { useI18n } from '../../../i18n';
import { unwrapData } from '../../../utils/unwrapApi';
import {
  ORDERS_CHANNEL_ALL,
  resolveWebshopChannels,
  type OrdersChannelFilter,
} from './orders-channel-filters';

type PosTerminalOption = {
  id: number;
  label: string;
};

interface OrdersChannelToolbarFiltersProps {
  channelFilter: OrdersChannelFilter;
  tenantSlug: string;
  onChannelFilterChange: (filter: OrdersChannelFilter) => void;
}

type ActiveDropdown = 'pos' | 'webshop' | null;

function getTenantParam(): string {
  return new URLSearchParams(window.location.search).get('tenant') || '';
}

function buildPosTerminalsUrl(): string {
  const params = new URLSearchParams();
  const tenant = getTenantParam();
  if (tenant) {
    params.set('tenant', tenant);
  }
  params.set('status', 'active');
  const query = params.toString();
  return `/api/admin/pos-terminals?${query}`;
}

function isPosFilterActive(filter: OrdersChannelFilter): boolean {
  return filter.kind === 'pos';
}

function isWebshopFilterActive(filter: OrdersChannelFilter): boolean {
  return filter.kind === 'webshop';
}

export const OrdersChannelToolbarFilters: FunctionalComponent<OrdersChannelToolbarFiltersProps> = ({
  channelFilter,
  tenantSlug,
  onChannelFilterChange,
}) => {
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null);
  const [posTerminals, setPosTerminals] = useState<PosTerminalOption[]>([]);
  const [posTerminalsLoading, setPosTerminalsLoading] = useState(true);

  const webshopChannels = useMemo(
    () => resolveWebshopChannels(tenantSlug, t('orders.channel.webshop')),
    [tenantSlug, t],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPosTerminals(): Promise<void> {
      setPosTerminalsLoading(true);
      try {
        const response = await fetch(buildPosTerminalsUrl(), {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('pos-terminals fetch failed');
        }

        const payload = unwrapData<{ terminals?: Array<{ id?: number; label?: string; status?: string }> }>(
          await response.json(),
        );
        const terminals = (payload?.terminals ?? [])
          .filter((terminal) => terminal.status === 'active' || terminal.status === undefined)
          .map((terminal) => ({
            id: Number(terminal.id),
            label: typeof terminal.label === 'string' && terminal.label.trim()
              ? terminal.label.trim()
              : t('orders.channel.terminalOption', { id: String(terminal.id ?? '') }),
          }))
          .filter((terminal) => Number.isInteger(terminal.id) && terminal.id > 0);

        if (!cancelled) {
          setPosTerminals(terminals);
        }
      } catch {
        if (!cancelled) {
          setPosTerminals([]);
        }
      } finally {
        if (!cancelled) {
          setPosTerminalsLoading(false);
        }
      }
    }

    void loadPosTerminals();

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (activeDropdown === null) {
      return;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef.current?.contains(target)) {
        return;
      }
      setActiveDropdown(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [activeDropdown]);

  const applyPosFilter = (terminalId: number | 'all'): void => {
    onChannelFilterChange({ kind: 'pos', terminalId });
    setActiveDropdown(null);
  };

  const applyWebshopFilter = (webshopId: string | 'all'): void => {
    onChannelFilterChange({ kind: 'webshop', webshopId });
    setActiveDropdown(null);
  };

  const togglePosChannel = (): void => {
    if (isPosFilterActive(channelFilter) && channelFilter.terminalId === 'all') {
      onChannelFilterChange(ORDERS_CHANNEL_ALL);
      setActiveDropdown(null);
      return;
    }
    applyPosFilter('all');
  };

  const toggleWebshopChannel = (): void => {
    if (isWebshopFilterActive(channelFilter) && channelFilter.webshopId === 'all') {
      onChannelFilterChange(ORDERS_CHANNEL_ALL);
      setActiveDropdown(null);
      return;
    }
    applyWebshopFilter('all');
  };

  const renderPosDropdownPanel = () => (
    <div className="products-control-dropdown-panel orders-channel-dropdown-panel">
      <div className="products-filter-chips products-filter-chips--panel">
        <button
          type="button"
          className={`workspace-filter-chip${channelFilter.kind === 'pos' && channelFilter.terminalId === 'all' ? ' workspace-filter-chip--active' : ''}`}
          onClick={() => applyPosFilter('all')}
        >
          {t('orders.channel.allPos')}
        </button>
        {posTerminals.map((terminal) => (
          <button
            key={terminal.id}
            type="button"
            className={`workspace-filter-chip${channelFilter.kind === 'pos' && channelFilter.terminalId === terminal.id ? ' workspace-filter-chip--active' : ''}`}
            onClick={() => applyPosFilter(terminal.id)}
          >
            {terminal.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderWebshopDropdownPanel = () => (
    <div className="products-control-dropdown-panel orders-channel-dropdown-panel">
      <div className="products-filter-chips products-filter-chips--panel">
        <button
          type="button"
          className={`workspace-filter-chip${channelFilter.kind === 'webshop' && channelFilter.webshopId === 'all' ? ' workspace-filter-chip--active' : ''}`}
          onClick={() => applyWebshopFilter('all')}
        >
          {t('orders.channel.allWebshops')}
        </button>
        {webshopChannels.map((channel) => (
          <button
            key={channel.id}
            type="button"
            className={`workspace-filter-chip${channelFilter.kind === 'webshop' && channelFilter.webshopId === channel.id ? ' workspace-filter-chip--active' : ''}`}
            onClick={() => applyWebshopFilter(channel.id)}
          >
            {channel.label}
          </button>
        ))}
      </div>
    </div>
  );

  const showPosControl = !posTerminalsLoading && posTerminals.length > 0;
  const showWebshopControl = webshopChannels.length > 0;

  if (!showPosControl && !showWebshopControl) {
    return null;
  }

  return (
    <div className="orders-channel-toolbar-filters products-list-controls-row" ref={rootRef}>
      {showPosControl && (
        <div className="orders-channel-toolbar-filter products-list-controls-row">
          {posTerminals.length <= 1 ? (
            <WorkspaceFilterToggleButton
              intent="pos-channel"
              isActive={isPosFilterActive(channelFilter)}
              onClick={togglePosChannel}
            >
              {t('orders.channel.pos')}
            </WorkspaceFilterToggleButton>
          ) : (
            <>
              <WorkspaceFilterToggleButton
                intent="pos-channel"
                isActive={isPosFilterActive(channelFilter) || activeDropdown === 'pos'}
                aria-expanded={activeDropdown === 'pos' ? 'true' : 'false'}
                onClick={() => setActiveDropdown((current) => (current === 'pos' ? null : 'pos'))}
              >
                {t('orders.channel.pos')}
                {activeDropdown === 'pos'
                  ? <ChevronUp size={16} strokeWidth={1.5} aria-hidden="true" />
                  : <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />}
              </WorkspaceFilterToggleButton>
              {activeDropdown === 'pos' ? renderPosDropdownPanel() : null}
            </>
          )}
        </div>
      )}

      {showWebshopControl && (
        <div className="orders-channel-toolbar-filter products-list-controls-row">
          {webshopChannels.length <= 1 ? (
            <WorkspaceFilterToggleButton
              intent="webshop-channel"
              isActive={isWebshopFilterActive(channelFilter)}
              onClick={toggleWebshopChannel}
            >
              {t('orders.channel.webshop')}
            </WorkspaceFilterToggleButton>
          ) : (
            <>
              <WorkspaceFilterToggleButton
                intent="webshop-channel"
                isActive={isWebshopFilterActive(channelFilter) || activeDropdown === 'webshop'}
                aria-expanded={activeDropdown === 'webshop' ? 'true' : 'false'}
                onClick={() => setActiveDropdown((current) => (current === 'webshop' ? null : 'webshop'))}
              >
                {t('orders.channel.webshop')}
                {activeDropdown === 'webshop'
                  ? <ChevronUp size={16} strokeWidth={1.5} aria-hidden="true" />
                  : <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />}
              </WorkspaceFilterToggleButton>
              {activeDropdown === 'webshop' ? renderWebshopDropdownPanel() : null}
            </>
          )}
        </div>
      )}
    </div>
  );
};
