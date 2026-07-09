/** @jsxImportSource preact */

import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrdersPage from '../../pages/admin/OrdersPage';

const navigateMock = vi.fn();

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />;
  return {
    Search: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Package: Icon,
    XCircle: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Plus: Icon,
    Minus: Icon,
    CheckCircle: Icon,
    AlertTriangle: Icon,
    Info: Icon,
  };
});

vi.mock('../../components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  Input: (props: { placeholder?: string; value?: string; onChange?: (e: Event) => void; className?: string; error?: string }) => (
    <input
      data-testid="mock-coupon-input"
      type="text"
      placeholder={props.placeholder}
      value={props.value}
      onInput={props.onChange as (e: Event) => void}
      className={props.className}
      aria-invalid={props.error ? 'true' : undefined}
    />
  ),
  Button: (props: { children?: unknown; onClick?: () => void; disabled?: boolean; loading?: boolean; variant?: string }) => (
    <button type="button" onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  ),
  Badge: (props: { children?: unknown; variant?: string }) => <span data-testid="mock-badge">{props.children}</span>,
}));

vi.mock('../../components/admin/Router', () => ({
  navigate: (...args: unknown[]) => navigateMock(...args),
}));

vi.mock('../../components/admin/shared', async () => {
  const [
    { WorkspaceListPanel, WorkspaceFilterToggleButton },
    { WorkspaceRow },
    { WorkspaceToolbar, WorkspaceToolbarLeft, WorkspaceToolbarRight, WorkspaceToolbarActionGroup },
    { WorkspaceToolbarListCount },
    { Pagination, ADMIN_PAGE_SIZE },
  ] = await Promise.all([
    import('../../components/admin/shared/WorkspaceListPanel'),
    import('../../components/admin/shared/WorkspaceRow'),
    import('../../components/admin/shared/WorkspaceToolbar'),
    import('../../components/admin/shared/WorkspaceToolbarListCount'),
    import('../../components/admin/shared/Pagination'),
  ]);

  return {
    Pagination,
    ADMIN_PAGE_SIZE,
    WorkspaceListPanel,
    WorkspaceFilterToggleButton,
    WorkspaceRow,
    WorkspaceToolbar,
    WorkspaceToolbarLeft,
    WorkspaceToolbarRight,
    WorkspaceToolbarActionGroup,
    WorkspaceToolbarListCount,
  };
});

vi.mock('../../components/admin/OrderTimeline', () => ({
  OrderTimeline: ({ orderId }: { orderId: string }) => <div data-testid="order-timeline">timeline-{orderId}</div>,
}));

vi.mock('../../components/orders/OrderShippingLabelActions', () => ({
  OrderShippingLabelActions: () => null,
}));

vi.mock('../../components/orders/StatusFlowCard', () => ({
  StatusFlowCard: ({
    order,
    onUpdate,
  }: {
    order: { orderId: string };
    onUpdate: () => void;
  }) => (
    <div data-testid="status-flow-card">
      <span>status-{order.orderId}</span>
      <button type="button" onClick={() => onUpdate()}>
        refresh-status
      </button>
    </div>
  ),
}));

vi.mock('../../utils/adminCache', () => ({
  getCached: () => null,
  setCache: vi.fn(),
  invalidateResource: vi.fn(),
  buildCacheKey: (path: string, params?: Record<string, string | undefined>) => `${path}:${JSON.stringify(params ?? {})}`,
  checkVersionStale: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      showNavNotification: vi.fn(),
      addToast: vi.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('../../components/admin/orders/OrderCreateWorkspaceDetail', () => ({
  OrderCreateWorkspaceDetail: () => <div data-testid="order-create-workspace-detail" />,
}));

const translations: Record<string, string> = {
  'orders.title': 'Orders',
  'orders.orderCount': '{count} orders',
  'orders.loading': 'Orders laden...',
  'orders.noOrders': 'Geen bestellingen',
  'orders.searchPlaceholder': 'Zoek op bestelnummer of klant...',
  'orders.workspace.filters': 'Filters',
  'orders.workspace.filterCount': '{count} actief',
  'orders.workspace.clearFilters': 'Filters wissen',
  'orders.workspace.loadingDetail': 'Bestelling laden...',
  'orders.workspace.empty': 'Selecteer links een bestelling om details te bekijken.',
  'orders.workspace.process': 'Verwerken',
  'orders.workspace.cancelOrder': 'Annuleer bestelling',
  'orders.workspace.confirmCancelOrder': 'Weet je zeker dat je deze bestelling wilt annuleren?',
  'orders.create.submitting': 'Bezig...',
  'orders.create.submitBtn': 'Bestelling aanmaken',
  'orders.workspace.createSuccess': 'Bestelling aangemaakt',
  'orders.workspace.customerDelivery': 'Klant & bezorging',
  'orders.workspace.general': 'Algemeen',
  'orders.create.sections.customer': 'Klant',
  'orders.create.sections.addresses': 'Adressen',
  'orders.create.sections.payment': 'Betaling',
  'orders.workspace.statusShipping': 'Status & verzending',
  'orders.workspace.flowActivity': 'Flow & activiteit',
  'orders.workspace.goToCustomer': 'Klant',
  'orders.workspace.viewSubscription': 'Bekijk abonnement',
  'orders.workspace.openCustomerAria': 'Ga naar klantprofiel',
  'orders.workspace.overview': 'Overzicht',
  'orders.orderNumber': 'Bestelnummer',
  'orders.packingSlip': 'Pakbon',
  'orders.table.source': 'Bron',
  'orders.detail.paymentStatusLabel': 'Betaalstatus',
  'orders.detail.createdAt': 'Aangemaakt',
  'orders.detail.updatedAt': 'Bijgewerkt',
  'orders.detail.totals': 'Totalen',
  'orders.detail.notApplicable': 'N.v.t.',
  'orders.detail.activityTitle': 'Activiteit',
  'orders.workspace.status.pending': 'Nieuw',
  'orders.update.orderStatus': 'Orderstatus aanpassen',
  'orders.update.paymentStatus': 'Betaalstatus aanpassen',
  'orders.edit.saveError': 'Opslaan mislukt',
  'orders.payment.pending': 'Betaling in afwachting',
  'admin.sidebar.searchShortcut': '⌘K',
  'orders.status.processing': 'In behandeling',
  'orders.status.shipped': 'Verzonden',
  'orders.status.delivered': 'Bezorgd',
  'orders.status.cancelled': 'Geannuleerd',
  'orders.customer': 'Klant',
  'orders.detail.paymentMethod': 'Betaalmethode',
  'orders.detail.shippingAddressTitle': 'Bezorgadres',
  'orders.detail.shippingMethod': 'Verzendmethode',
  'orders.detail.orderItems': 'Orderregels',
  'orders.itemsEditor.openButton': 'Items bewerken',
  'orders.amendment.openButton': 'Bijbestelling / correctie',
  'orders.detail.product': 'Product',
  'orders.detail.seasonLabel': 'Seizoen',
  'orders.detail.quantity': 'Aantal',
  'orders.detail.price': 'Stukprijs',
  'orders.detail.total': 'Totaal',
  'orders.detail.subtotal': 'Subtotaal',
  'orders.detail.shippingCost': 'Verzendkosten',
  'orders.detail.discount': 'Korting',
  'orders.detail.couponCode': 'Kortingscode',
  'orders.detail.couponAdjustTitle': 'Korting aanpassen',
  'orders.detail.couponPlaceholder': 'Code',
  'orders.detail.couponApply': 'Toepassen',
  'orders.detail.couponApplied': 'Toegepast',
  'orders.detail.couponRemove': 'Verwijderen',
  'orders.detail.couponRemoved': 'Verwijderd',
  'orders.detail.couponError': 'Fout',
  'orders.detail.couponDiscount': 'Korting',
  'orders.edit.shippingMethod.free': 'Gratis',
  'orders.fetchError': 'Kon bestellingen niet ophalen',
  'orders.loadError': 'Kon bestellingen niet laden',
  'orders.channel.pos': 'POS',
  'orders.channel.webshop': 'Webshop',
  'orders.channel.allPos': 'Alle POS',
  'orders.channel.allWebshops': 'Alle webshops',
  'orders.channel.terminalOption': 'Terminal {id}',
  'orders.detail.loadError': 'Kon bestelling niet ophalen',
  'orders.detail.orderNotFound': 'Bestelling niet gevonden',
  'orders.detail.unknownError': 'Onbekende fout',
  'orders.unknownError': 'Onbekende fout',
  'orders.csrfError': 'CSRF token niet gevonden',
  'holders.detail.fields.email': 'E-mail',
  'holders.detail.fields.phone': 'Telefoon',
  'admin.social.orders.guest': 'Gast',
  'common.saving': 'Opslaan...',
  'common.search': 'Zoeken...',
};

function t(key: string, params?: Record<string, string>) {
  if (key === 'orders.orderCount') {
    return `${params?.count ?? '0'} orders`;
  }

  if (key === 'orders.workspace.filterCount') {
    return `${params?.count ?? '0'} actief`;
  }

  if (key === 'orders.channel.terminalOption') {
    return `Terminal ${params?.id ?? ''}`;
  }

  return translations[key] ?? key;
}

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t,
    locale: 'nl',
  }),
  t,
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

const orders = [
  {
    id: 1,
    orderId: 'ORD-1',
    status: 'pending',
    paymentStatus: 'paid',
    source: 'WEB',
    totalCents: 18900,
    createdAt: '2026-03-31T09:14:00.000Z',
    user: {
      id: 101,
      email: 'roos@example.com',
      firstName: 'Roos',
      lastName: 'van Dijk',
      phone: '+31 6 98 76 54 32',
    },
    shipping: {
      street: 'Molenstraat',
      houseNumber: '7',
      zipcode: '2512 CM',
      city: 'Den Haag',
      country: 'NL',
      label: 'PostNL Standaard',
      method: 'standard',
    },
  },
  {
    id: 2,
    orderId: 'ORD-2',
    status: 'processing',
    paymentStatus: 'paid',
    source: 'WEB',
    totalCents: 7900,
    createdAt: '2026-03-30T09:14:00.000Z',
    user: {
      id: 202,
      email: 'martijn@example.com',
      firstName: 'Martijn',
      lastName: 'Hoek',
      phone: '+31 6 11 22 33 44',
    },
    shipping: {
      street: 'Lindelaan',
      houseNumber: '8',
      zipcode: '3011 AB',
      city: 'Rotterdam',
      country: 'NL',
      label: 'Afhalen',
      method: 'pickup',
    },
  },
];

const details: Record<string, unknown> = {
  'ORD-1': {
    order: {
      ...orders[0],
      subtotalCents: 15620,
      shippingCostCents: 0,
      discountCents: 0,
      totalCents: 18900,
      payment: { method: 'ideal', status: 'paid' },
      items: [
        {
          id: 10,
          itemType: 'PRODUCT',
          productType: 'PHYSICAL',
          productTitle: 'Inschrijfset',
          productSku: 'INST-001',
          quantity: 1,
          unitPriceCents: 0,
          totalPriceCents: 0,
          vatAmountCents: 0,
        },
        {
          id: 11,
          itemType: 'SUBSCRIPTION',
          productType: 'SUBSCRIPTION',
          productTitle: 'Gezinsabonnement — 1 jaar',
          productSku: 'GEZ-1J-001',
          billingSeasonLabelSnapshot: '2026 / 2027',
          quantity: 1,
          unitPriceCents: 18900,
          totalPriceCents: 18900,
          vatAmountCents: 3274,
          subscriptionId: 42,
        },
      ],
    },
  },
  'ORD-2': {
    order: {
      ...orders[1],
      userId: 202,
      user: {
        ...orders[1].user,
        id: undefined,
      },
      subtotalCents: 7900,
      shippingCostCents: 0,
      discountCents: 0,
      totalCents: 7900,
      payment: { method: 'ideal', status: 'paid' },
      items: [
        {
          id: 21,
          productTitle: 'Zwemabonnement',
          productSku: 'ZWEM-001',
          billingSeasonLabelSnapshot: null,
          quantity: 1,
          unitPriceCents: 7900,
          totalPriceCents: 7900,
          vatAmountCents: 1371,
        },
      ],
    },
  },
};

describe('OrdersPage', () => {
  let ord1DetailRequestCount = 0;
  let activePosTerminals: Array<{ id: number; label: string; status: 'active' }> = [
    { id: 1, label: 'Kassa 1', status: 'active' },
  ];

  beforeEach(() => {
    navigateMock.mockReset();
    window.history.replaceState({}, '', '/admin/orders');
    (window as Window & { __TENANT__?: { slug?: string } }).__TENANT__ = { slug: 'demo' };
    ord1DetailRequestCount = 0;
    activePosTerminals = [{ id: 1, label: 'Kassa 1', status: 'active' }];

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), 'http://localhost');

        if (init?.method === 'PUT' && url.pathname.endsWith('/api/admin/orders/ORD-1')) {
          return Promise.resolve(jsonResponse({ success: true, data: { updated: true } }));
        }

        if (url.pathname === '/api/admin/settings') {
          return Promise.resolve(jsonResponse({
            success: true,
            data: { settings: { vatRate: 21, vatLiable: true, taxLabel: 'BTW' } },
          }));
        }

        if (url.pathname === '/api/admin/pos-terminals') {
          return Promise.resolve(jsonResponse({
            success: true,
            data: { terminals: activePosTerminals },
          }));
        }

        if (url.pathname === '/api/admin/orders') {
          const statuses = url.searchParams.getAll('status');
          const source = url.searchParams.get('source');
          let filteredOrders = statuses.length === 0
            ? orders
            : orders.filter((order) => statuses.includes(order.status));

          if (source === 'POS') {
            filteredOrders = filteredOrders.filter((order) => order.source === 'POS');
          } else if (source === 'WEB') {
            filteredOrders = filteredOrders.filter((order) => order.source === 'WEB');
          }

          return Promise.resolve(jsonResponse({
            success: true,
            total: 99,
            data: { orders: filteredOrders, total: 99 },
          }));
        }

        if (url.pathname === '/api/admin/orders/ORD-1') {
          ord1DetailRequestCount += 1;

          if (ord1DetailRequestCount > 1) {
            return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 500 }));
          }

          return Promise.resolve(jsonResponse({ success: true, data: details['ORD-1'] }));
        }

        if (url.pathname === '/api/admin/orders/ORD-2') {
          return Promise.resolve(jsonResponse({ success: true, data: details['ORD-2'] }));
        }

        return Promise.reject(new Error(`Unexpected fetch: ${url.toString()}`));
      }),
    );
  });

  it('toont orders als master-detail pagina en toont seizoenslabel na selectie van een order', async () => {
    render(<OrdersPage />);

    await waitFor(() => {
      expect(screen.queryByText('#ORD-1')).not.toBeNull();
    });

    expect(screen.getAllByText('Roos van Dijk').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /#ORD-1/i }));

    await waitFor(() => {
      expect(screen.getByTestId('orders-workspace-detail-columns')).toBeInTheDocument();
      expect(screen.getByTestId('orders-workspace-detail-columns').querySelectorAll('.order-create-column')).toHaveLength(2);
    });

    await waitFor(() => {
      expect(screen.queryByText('Seizoen: 2026 / 2027')).not.toBeNull();
    });

    expect(screen.getByText('Seizoen: 2026 / 2027')).toBeInTheDocument();
  });

  it('opent de filter, ondersteunt multiselect en wisselt naar de passende orderdetail', async () => {
    render(<OrdersPage />);

    await waitFor(() => {
      expect(screen.queryByText('#ORD-1')).not.toBeNull();
    });

    const filterButton = screen.getByRole('button', { name: /Zoeken/i });
    expect(filterButton.className.includes('active')).toBe(false);

    fireEvent.click(filterButton);

    expect(filterButton.className.includes('active')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'In behandeling' }));

    await waitFor(() => {
      expect(screen.queryByText('#ORD-2')).not.toBeNull();
    });

    expect(screen.queryByRole('button', { name: /#ORD-1/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /#ORD-2/i })).not.toBeNull();
  });

  it('rendert status-aanpassingsblok bij geladen detail en houdt het zichtbaar bij refresh-fout', async () => {
    render(<OrdersPage />);

    await waitFor(() => {
      expect(screen.queryByText('#ORD-1')).not.toBeNull();
    });

    await waitFor(() => {
      expect(screen.queryByLabelText('Orderstatus aanpassen')).not.toBeNull();
      expect(screen.queryByLabelText('Betaalstatus aanpassen')).not.toBeNull();
      expect(screen.queryByTestId('status-flow-card')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'refresh-status' }));

    await waitFor(() => {
      expect(screen.queryByText('Kon bestelling niet ophalen')).not.toBeNull();
    });

    expect(screen.queryByLabelText('Orderstatus aanpassen')).not.toBeNull();
    expect(screen.queryByLabelText('Betaalstatus aanpassen')).not.toBeNull();
    expect(screen.queryByTestId('status-flow-card')).not.toBeNull();
  });

  it('navigeert naar klant en abonnement vanuit orderdetail', async () => {
    render(<OrdersPage />);

    await waitFor(() => {
      expect(screen.queryByText('#ORD-1')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /#ORD-1/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Klant' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Klant' }));
    expect(navigateMock).toHaveBeenLastCalledWith('/admin/customers/101');

    fireEvent.click(screen.getByRole('button', { name: 'Bekijk abonnement' }));
    expect(navigateMock).toHaveBeenLastCalledWith('/admin/subscriptions/42');
  });



  it('toont de amendment-actie voor een betaalde order', async () => {
    render(<OrdersPage />);

    await waitFor(() => {
      expect(screen.queryByText('#ORD-1')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /#ORD-1/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('order-amend-open')).not.toBeNull();
    });

    expect(screen.queryByTestId('order-edit-items-open')).toBeNull();
  });

  it('toont API total in toolbar count', async () => {
    render(<OrdersPage />);

    await waitFor(() => {
      expect(document.querySelector('.products-count-badge')?.textContent).toBe('99');
    });
  });

  it('activeert POS-kanaalfilter en fetcht met source=POS', async () => {
    const fetchMock = vi.mocked(fetch);

    render(<OrdersPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'POS' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'POS' }));

    await waitFor(() => {
      const ordersCalls = fetchMock.mock.calls.filter(([input]) => {
        const url = new URL(String(input), 'http://localhost');
        return url.pathname === '/api/admin/orders' && url.searchParams.get('source') === 'POS';
      });
      expect(ordersCalls.length).toBeGreaterThan(0);
    });
  });

  it('activeert Webshop-kanaalfilter en fetcht met source=WEB', async () => {
    const fetchMock = vi.mocked(fetch);

    render(<OrdersPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Webshop' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Webshop' }));

    await waitFor(() => {
      const ordersCalls = fetchMock.mock.calls.filter(([input]) => {
        const url = new URL(String(input), 'http://localhost');
        return url.pathname === '/api/admin/orders' && url.searchParams.get('source') === 'WEB';
      });
      expect(ordersCalls.length).toBeGreaterThan(0);
    });
  });

  it('toont POS-dropdown met Alle POS bij meerdere terminals', async () => {
    activePosTerminals = [
      { id: 1, label: 'Kassa 1', status: 'active' },
      { id: 2, label: 'Kassa 2', status: 'active' },
    ];

    render(<OrdersPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /POS/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /POS/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alle POS' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Kassa 2' })).toBeInTheDocument();
    });
  });

  it('hero-klantnaam navigeert naar klantprofiel', async () => {
    render(<OrdersPage />);

    await waitFor(() => {
      expect(screen.queryByText('#ORD-1')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /#ORD-1/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ga naar klantprofiel' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ga naar klantprofiel' }));
    expect(navigateMock).toHaveBeenCalledWith('/admin/customers/101');
  });
});
