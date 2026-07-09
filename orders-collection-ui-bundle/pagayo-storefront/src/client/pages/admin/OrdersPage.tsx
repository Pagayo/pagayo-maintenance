/** @jsxImportSource preact */
/**
 * OrdersPage
 * Master-detail admin werkplek voor orders.
 *
 * BUSINESS CONTEXT:
 * Medewerkers handelen orders direct af vanuit één scherm: links de orderlijst,
 * rechts de geselecteerde order met detail, verwerking en activiteit.
 * Een losse orderdetailpagina is niet meer nodig voor de primaire adminflow.
 *
 * CSS: Styling via @pagayo/design (contexts/admin/order-management.css)
 */
import { FunctionalComponent } from 'preact';
import { useEffect, useMemo, useRef, useState, useCallback } from 'preact/hooks';
import { Spinner } from '../../components';
import { navigate } from '../../components/admin/Router';
import {
  Pagination,
  ADMIN_PAGE_SIZE,
  WorkspaceListPanel,
  WorkspaceRow,
  WorkspaceCommandCenter,
  WorkspaceCommandOption,
  WorkspaceCommandField,
  WorkspaceCommandSelect,
} from '../../components/admin/shared';
import { OrderCreateWorkspaceDetail } from '../../components/admin/orders/OrderCreateWorkspaceDetail';
import { OrdersChannelToolbarFilters } from '../../components/admin/orders/OrdersChannelToolbarFilters';
import {
  buildOrdersChannelApiParams,
  parseOrdersChannelFilterFromSearchParams,
  serializeOrdersChannelFilterForCache,
  syncOrdersWorkspaceUrlParams,
  ORDERS_CHANNEL_ALL,
  type OrdersChannelFilter,
} from '../../components/admin/orders/orders-channel-filters';
import { OrderTimeline } from '../../components/admin/OrderTimeline';
import { OrderCouponInput } from '../../features/account/OrderCouponInput';
import { ProductPicker, type OrderItem as PickerOrderItem } from '../../components/admin/ProductPicker';
import { OrderEditModal, type OrderEditUpdates } from '../../components/admin/OrderEditModal';
import { useUIStore } from '../../stores/uiStore';
import { StatusFlowCard } from '../../components/orders/StatusFlowCard';
import { OrderShippingLabelActions } from '../../components/orders/OrderShippingLabelActions';
import { useI18n } from '../../i18n';
import type { OrderSource } from '../../types';
import { getCached, setCache, invalidateResource, buildCacheKey, checkVersionStale } from '../../utils/adminCache';
import { formatCents } from '../../utils/money';
import { unwrapData } from '../../utils/unwrapApi';
import { shouldPresentVatInUi } from '../../utils/vat-settings';
import { parseOrderIdFromAdminPath, useWorkspaceUrlSelection } from '../../hooks/useWorkspaceUrlSelection';
import { withPreservedWorkspaceDetailScroll } from '../../utils/preserve-admin-scroll';

const SEARCH_DEBOUNCE_MS = 250;
const STATUS_AUTOSAVE_DEBOUNCE_MS = 300;

function serializeOrderWorkspaceId(value: string): string {
  return value;
}

type WorkspaceOrderStatus = 'pending' | 'awaiting_payment' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded';
type WorkspacePaymentStatus = string;

interface OrderListItem {
  id: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  total: number;
  status: WorkspaceOrderStatus;
  paymentStatus: string;
  source: OrderSource;
  createdAt: string;
}

interface OrderListFilters {
  search: string;
  statuses: WorkspaceOrderStatus[];
  channelFilter: OrdersChannelFilter;
}

interface WorkspaceOrderItem {
  id: string;
  productId: number | null;
  itemType: string | null;
  productType: string | null;
  productName: string;
  productSku: string | null;
  billingSeasonLabelSnapshot: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  vatAmount: number;
  subscriptionId: number | null;
}

interface WorkspaceAddress {
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

interface WorkspaceOrderDetail {
  id: string;
  orderId: string;
  status: WorkspaceOrderStatus;
  paymentStatus: string;
  source: OrderSource;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  paymentMethod: string | null;
  paymentProvider: string | null;
  paymentPaidAt: string | null;
  stripePaymentId: string | null;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  shippingMethod: string | null;
  trackingCode: string | null;
  trackingCarrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  shippingAddress: WorkspaceAddress | null;
  shippingApplicable: boolean;
  /** Internal user id for admin customer workspace navigation */
  customerUserId: number | null;
  items: WorkspaceOrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  vat: number;
  total: number;
  couponCode?: string | null;
}

type RawOrderUser = {
  id?: string | number | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
} | null;

type RawOrderShipping = {
  street?: string | null;
  houseNumber?: string | null;
  zipcode?: string | null;
  city?: string | null;
  country?: string | null;
  label?: string | null;
  method?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} | null;

type RawOrderPayment = {
  method?: string | null;
  status?: string | null;
  amountCents?: number | null;
  transactionId?: string | null;
  chargeId?: string | null;
  provider?: string | null;
  paidAt?: string | null;
} | null;

function resolveStripePaymentReferences(payment: RawOrderPayment): {
  stripePaymentId: string | null;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
} {
  const transactionId = asText(payment?.transactionId) || null;
  const chargeId = asText(payment?.chargeId) || null;

  const stripePaymentId =
    chargeId?.startsWith('py_') || chargeId?.startsWith('ch_')
      ? chargeId
      : null;
  const stripePaymentIntentId =
    transactionId?.startsWith('pi_')
      ? transactionId
      : chargeId?.startsWith('pi_')
        ? chargeId
        : null;
  const stripeCheckoutSessionId = transactionId?.startsWith('cs_')
    ? transactionId
    : null;

  return {
    stripePaymentId,
    stripePaymentIntentId,
    stripeCheckoutSessionId,
  };
}

type RawOrderItem = {
  id?: string | number;
  productId?: string | number | null;
  itemType?: string | null;
  productType?: string | null;
  productTitle?: string | null;
  productSku?: string | null;
  billingSeasonLabelSnapshot?: string | null;
  quantity?: number | null;
  unitPriceCents?: number | null;
  totalPriceCents?: number | null;
  vatAmountCents?: number | null;
  subscriptionId?: string | number | null;
};

type RawOrderResponse = Record<string, unknown> & {
  user?: RawOrderUser;
  shipping?: RawOrderShipping;
  payment?: RawOrderPayment;
  items?: RawOrderItem[];
};

interface OrdersListResponse {
  orders?: unknown[];
  total?: number;
}

interface OrderDetailResponse {
  order?: RawOrderResponse;
}

interface StatusMeta {
  label: string;
  className: string;
}

const STATUS_OPTIONS: WorkspaceOrderStatus[] = [
  'pending',
  'awaiting_payment',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'refunded',
];

const PAYMENT_STATUS_OPTIONS: WorkspacePaymentStatus[] = [
  'pending',
  'authorized',
  'processing',
  'paid',
  'failed',
  'cancelled',
  'expired',
  'refunded',
  'partially_refunded',
  'disputed',
];

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function numberOr(value: unknown, fallback = 0): number {
  return asNumber(value) ?? fallback;
}

function resolveDefaultVatRate(settings: Record<string, unknown>): number | null {
  const explicitVatRate = asNumber(settings.vatRate);
  if (explicitVatRate !== null && explicitVatRate > 0) {
    return explicitVatRate;
  }

  const vatRates = settings.vatRates;
  if (!Array.isArray(vatRates)) {
    return null;
  }

  const normalizedRates = vatRates
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null;
      }

      const vatRow = row as { rate?: unknown; isDefault?: unknown };
      const rate = asNumber(vatRow.rate);
      if (rate === null) {
        return null;
      }

      return {
        rate,
        isDefault: vatRow.isDefault === true,
      };
    })
    .filter((row): row is { rate: number; isDefault: boolean } => row !== null);

  if (normalizedRates.length === 0) {
    return null;
  }

  return normalizedRates.find((row) => row.isDefault)?.rate ?? normalizedRates[0].rate;
}

function getTenantParam(): string {
  return new URLSearchParams(window.location.search).get('tenant') || '';
}

function getInitialOrderSearchQuery(): string {
  return new URLSearchParams(window.location.search).get('search')?.trim() || '';
}

function getInitialOrdersChannelFilter(): OrdersChannelFilter {
  return parseOrdersChannelFilterFromSearchParams(new URLSearchParams(window.location.search));
}

function getTenantSlug(): string {
  const tenantConfig = (window as Window & { __TENANT__?: { slug?: string | null } }).__TENANT__;
  const slug = tenantConfig?.slug?.trim();
  if (slug) {
    return slug;
  }
  return getTenantParam();
}

function buildApiUrl(path: string, options?: {
  search?: string;
  statuses?: WorkspaceOrderStatus[];
  page?: number;
  channelFilter?: OrdersChannelFilter;
}): string {
  const params = new URLSearchParams();
  const tenant = getTenantParam();

  if (tenant) {
    params.set('tenant', tenant);
  }

  if (options?.page) {
    params.set('page', String(options.page));
    params.set('limit', String(ADMIN_PAGE_SIZE));
  }

  if (options?.search) {
    params.set('search', options.search);
  }

  for (const status of options?.statuses || []) {
    params.append('status', status);
  }

  const channelParams = buildOrdersChannelApiParams(options?.channelFilter ?? { kind: 'all' });
  if (channelParams.source) {
    params.set('source', channelParams.source);
  }
  if (channelParams.posTerminalId) {
    params.set('posTerminalId', channelParams.posTerminalId);
  }
  if (channelParams.webshopId) {
    params.set('webshopId', channelParams.webshopId);
  }

  const query = params.toString();
  return query ? `/api/admin${path}?${query}` : `/api/admin${path}`;
}

function buildAdminPathWithTenant(path: string): string {
  const tenant = getTenantParam();
  return tenant ? `${path}?tenant=${encodeURIComponent(tenant)}` : path;
}

function isOrdersCreatePath(): boolean {
  return window.location.pathname === '/admin/orders/new';
}

function buildCustomerDetailPath(customerId: number): string {
  return buildAdminPathWithTenant(`/admin/customers/${customerId}`);
}

function buildSubscriptionDetailPath(subscriptionId: number): string {
  return buildAdminPathWithTenant(`/admin/subscriptions/${subscriptionId}`);
}

function buildPackingSlipUrl(orderId: string): string {
  const tenant = getTenantParam();
  const encodedOrderId = encodeURIComponent(orderId);
  return tenant
    ? `/api/admin/orders/${encodedOrderId}/packing-slip?tenant=${encodeURIComponent(tenant)}`
    : `/api/admin/orders/${encodedOrderId}/packing-slip`;
}

function getInitials(name: string): string {
  const parts = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return '??';
  }

  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function isWorkspaceOrderStatus(value: string): value is WorkspaceOrderStatus {
  return STATUS_OPTIONS.includes(value as WorkspaceOrderStatus);
}

function getPaymentStatusI18nKey(status: string): string {
  if (status === 'partially_refunded') {
    return 'orders.payment.partiallyRefunded';
  }

  return `orders.payment.${status}`;
}

function getPaymentStatusLabel(
  status: string,
  t: (key: string, params?: Record<string, string>) => string,
): string {
  const key = getPaymentStatusI18nKey(status);
  const translated = t(key);
  return translated === key ? status : translated;
}

function buildCustomerName(user: RawOrderUser, shipping: RawOrderShipping, guestLabel: string): string {
  const directName = asText(user?.name);
  if (directName) {
    return directName;
  }

  const userParts = [asText(user?.firstName), asText(user?.lastName)].filter(Boolean);
  if (userParts.length > 0) {
    return userParts.join(' ');
  }

  const shippingParts = [asText(shipping?.firstName), asText(shipping?.lastName)].filter(Boolean);
  if (shippingParts.length > 0) {
    return shippingParts.join(' ');
  }

  return guestLabel;
}

function normalizeOrder(raw: unknown, guestLabel: string): OrderListItem {
  const row = (raw ?? {}) as RawOrderResponse;
  const customerName = buildCustomerName(row.user ?? null, row.shipping ?? null, guestLabel);
  const rawStatus = asText(row.status);

  return {
    id: String(row.id ?? ''),
    orderId: String(row.orderId ?? row.id ?? ''),
    customerName,
    customerEmail: asText(row.user?.email),
    total: numberOr(row.totalCents ?? row.total, 0),
    status: isWorkspaceOrderStatus(rawStatus) ? rawStatus : 'pending',
    paymentStatus: asText(row.paymentStatus ?? row.payment?.status) || 'pending',
    source: (row.source as OrderSource) || 'WEB',
    createdAt: asText(row.createdAt),
  };
}

function normalizeOrderDetail(
  raw: RawOrderResponse,
  guestLabel: string,
  fallbackVatRate: number | null,
): WorkspaceOrderDetail {
  const customerName = buildCustomerName(raw.user ?? null, raw.shipping ?? null, guestLabel);
  const rawStatus = asText(raw.status);
  const shippingStreet = [asText(raw.shipping?.street), asText(raw.shipping?.houseNumber)].filter(Boolean).join(' ');
  const subtotalCents = numberOr(raw.subtotalCents, 0);
  const discountCents = numberOr(raw.discountCents, 0);
  const shippingCents = numberOr(raw.shippingCostCents, 0);
  const totalCents = numberOr(raw.totalCents, 0);
  const rawUser = raw.user;
  const rawUserId = rawUser && typeof rawUser === 'object' ? rawUser.id : undefined;
  const parsedUserId = asNumber(rawUserId);
  const fallbackUserId = asNumber(raw.userId);
  const resolvedUserId = parsedUserId ?? fallbackUserId;
  const customerUserId = resolvedUserId !== null && resolvedUserId > 0 ? resolvedUserId : null;

  const items = (raw.items || []).map((item) => {
    const subId = asNumber(item.subscriptionId);
    const prodId = asNumber(item.productId);
    return {
      id: String(item.id ?? ''),
      productId: prodId !== null && prodId > 0 ? prodId : null,
      itemType: asText(item.itemType) || null,
      productType: asText(item.productType) || null,
      productName: asText(item.productTitle) || '—',
      productSku: asText(item.productSku) || null,
      billingSeasonLabelSnapshot: asText(item.billingSeasonLabelSnapshot) || null,
      quantity: numberOr(item.quantity, 0),
      unitPrice: numberOr(item.unitPriceCents, 0),
      totalPrice: numberOr(item.totalPriceCents, 0),
      vatAmount: numberOr(item.vatAmountCents, 0),
      subscriptionId: subId !== null && subId > 0 ? subId : null,
    };
  });
  const vatFromItemsCents = items.reduce((sum, item) => sum + item.vatAmount, 0);
  const vatFromTotalsCents = fallbackVatRate && fallbackVatRate > 0
    ? Math.max(
      0,
      Math.round((subtotalCents * fallbackVatRate) / (100 + fallbackVatRate))
        + Math.round((shippingCents * fallbackVatRate) / (100 + fallbackVatRate)),
    )
    : 0;
  const vatCents = vatFromItemsCents >= 0 && vatFromItemsCents <= totalCents
    ? vatFromItemsCents
    : vatFromTotalsCents;
  const containsSubscriptions = raw.containsSubscriptions === true
    || items.some((item) => item.itemType?.toUpperCase() === 'SUBSCRIPTION');
  const containsPhysicalItems = raw.containsPhysicalItems === true
    || items.some((item) => item.itemType?.toUpperCase() === 'PRODUCT' && item.productType?.toUpperCase() === 'PHYSICAL');
  const shippingApplicable = typeof raw.shippingApplicable === 'boolean'
    ? raw.shippingApplicable
    : containsPhysicalItems || !containsSubscriptions;
  const paymentReferences = resolveStripePaymentReferences(raw.payment ?? null);

  return {
    id: String(raw.id ?? ''),
    orderId: String(raw.orderId ?? raw.id ?? ''),
    status: isWorkspaceOrderStatus(rawStatus) ? rawStatus : 'pending',
    paymentStatus: asText(raw.paymentStatus ?? raw.payment?.status) || 'pending',
    source: (raw.source as OrderSource) || 'WEB',
    createdAt: asText(raw.createdAt),
    updatedAt: asText(raw.updatedAt),
    customerName,
    customerEmail: asText(raw.user?.email),
    customerPhone: asText(raw.user?.phone) || null,
    paymentMethod: asText(raw.payment?.method) || null,
    paymentProvider: asText(raw.payment?.provider) || null,
    paymentPaidAt: asText(raw.payment?.paidAt) || null,
    stripePaymentId: paymentReferences.stripePaymentId,
    stripePaymentIntentId: paymentReferences.stripePaymentIntentId,
    stripeCheckoutSessionId: paymentReferences.stripeCheckoutSessionId,
    shippingMethod: asText(raw.shipping?.label) || asText(raw.shipping?.method) || null,
    trackingCode: asText(raw.trackingCode) || null,
    trackingCarrier: asText(raw.trackingCarrier) || null,
    shippedAt: asText(raw.shippedAt) || null,
    deliveredAt: asText(raw.deliveredAt) || null,
    shippingAddress: shippingStreet || asText(raw.shipping?.zipcode) || asText(raw.shipping?.city)
      ? {
          street: shippingStreet,
          postalCode: asText(raw.shipping?.zipcode),
          city: asText(raw.shipping?.city),
          country: asText(raw.shipping?.country),
        }
      : null,
    shippingApplicable,
    customerUserId,
    items,
    subtotal: subtotalCents,
    discount: discountCents,
    shipping: shippingCents,
    vat: vatCents,
    total: totalCents,
    couponCode: asText(raw.couponCode) || null,
  };
}

function formatDateTime(value: string, locale: string): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const localeMap: Record<string, string> = {
    nl: 'nl-NL',
    en: 'en-GB',
    de: 'de-DE',
  };

  return date.toLocaleDateString(localeMap[locale] || 'nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(value: string, locale: string): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }

  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }

  if (Math.abs(diffDays) < 7) {
    return rtf.format(diffDays, 'day');
  }

  return formatDateTime(value, locale);
}

function formatAddress(address: WorkspaceAddress | null): string {
  if (!address) {
    return '—';
  }

  const parts = [address.street, [address.postalCode, address.city].filter(Boolean).join(' ')].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

function formatPaymentMethod(method: string | null): string {
  if (!method) {
    return '—';
  }

  const normalized = method.toLowerCase();
  if (normalized === 'ideal') {
    return 'iDEAL';
  }

  if (normalized === 'bancontact') {
    return 'Bancontact';
  }

  return method;
}

function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

function getStatusMeta(
  status: WorkspaceOrderStatus,
  t: (key: string, params?: Record<string, string>) => string,
): StatusMeta {
  switch (status) {
    case 'pending':
      return { label: t('orders.workspace.status.pending'), className: 'orders-workspace-status--new' };
    case 'awaiting_payment':
      return { label: t('orders.status.awaiting_payment'), className: 'orders-workspace-status--new' };
    case 'confirmed':
      return { label: t('orders.status.confirmed'), className: 'orders-workspace-status--processing' };
    case 'processing':
      return { label: t('orders.status.processing'), className: 'orders-workspace-status--processing' };
    case 'shipped':
      return { label: t('orders.status.shipped'), className: 'orders-workspace-status--processing' };
    case 'delivered':
      return { label: t('orders.status.delivered'), className: 'orders-workspace-status--done' };
    case 'completed':
      return { label: t('orders.status.completed'), className: 'orders-workspace-status--done' };
    case 'refunded':
      return { label: t('orders.status.refunded'), className: 'orders-workspace-status--done' };
    case 'cancelled':
    default:
      return { label: t('orders.status.cancelled'), className: 'orders-workspace-status--cancelled' };
  }
}

function useOrders(filters: OrderListFilters, page: number) {
  const { t } = useI18n();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async (skipCache = false, silent = false) => {
    try {
      const cacheKey = buildCacheKey('/api/admin/orders', {
        tenant: getTenantParam() || undefined,
        page: String(page),
        limit: String(ADMIN_PAGE_SIZE),
        search: filters.search || undefined,
        status: filters.statuses.slice().sort().join(',') || undefined,
        channel: serializeOrdersChannelFilterForCache(filters.channelFilter),
      });

      if (!skipCache) {
        const cached = getCached<{ orders: OrderListItem[]; total: number }>(cacheKey);
        if (cached) {
          setOrders(cached.orders);
          setTotal(cached.total);
          setError(null);
          setLoading(false);

          checkVersionStale('orders').then((stale) => {
            if (stale) {
              invalidateResource('orders');
              fetchOrders(true, true);
            }
          });
          return;
        }
      }

      if (!silent) {
        setLoading(true);
      }

      const response = await fetch(buildApiUrl('/orders', {
        search: filters.search,
        statuses: filters.statuses,
        channelFilter: filters.channelFilter,
        page,
      }), {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(t('orders.fetchError'));
      }

      const data = await response.json() as { total?: number };
      const payload = unwrapData<OrdersListResponse | unknown[]>(data);
      const rawOrders = Array.isArray(payload)
        ? payload
        : payload?.orders || [];
      const guestLabel = t('admin.social.orders.guest');
      const nextOrders = rawOrders.map((row) => normalizeOrder(row, guestLabel));
      const payloadTotal = Array.isArray(payload) ? 0 : payload?.total;
      const nextTotal = numberOr(data.total ?? payloadTotal, 0);

      setOrders(nextOrders);
      setTotal(nextTotal);
      setError(null);
      setCache(cacheKey, { orders: nextOrders, total: nextTotal }, 'orders');
      checkVersionStale('orders');
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : t('orders.unknownError'));
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [
    filters.search,
    filters.statuses.join(','),
    serializeOrdersChannelFilterForCache(filters.channelFilter),
    page,
  ]);

  return {
    orders,
    total,
    loading,
    error,
    refetch: () => {
      invalidateResource('orders');
      fetchOrders(true);
    },
  };
}

function useOrderDetail(selectedOrderId: string | null, fallbackVatRate: number | null) {
  const { t } = useI18n();
  const [detail, setDetail] = useState<WorkspaceOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!selectedOrderId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchDetail(): Promise<void> {
      try {
        const safeSelectedOrderId = selectedOrderId;
        if (!safeSelectedOrderId) {
          return;
        }

        const hasCurrentDetail = detail !== null && detail.orderId === safeSelectedOrderId;
        setLoading(!hasCurrentDetail);
        setError(null);

        const cacheKey = buildCacheKey(`/api/admin/orders/${safeSelectedOrderId}`, {
          tenant: getTenantParam() || undefined,
        });
        const cached = getCached<WorkspaceOrderDetail>(cacheKey);
        if (cached && refreshTrigger === 0) {
          setDetail(cached);
          setLoading(false);

          checkVersionStale('orders').then((stale) => {
            if (stale) {
              invalidateResource('orders');
              setRefreshTrigger((current) => current + 1);
            }
          });
          return;
        }

        const response = await fetch(buildApiUrl(`/orders/${encodeURIComponent(safeSelectedOrderId)}`), {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(t('orders.detail.loadError'));
        }

        const data = await response.json();
        const payload = unwrapData<OrderDetailResponse>(data);
        const order = payload?.order;

        if (!order) {
          throw new Error(t('orders.detail.orderNotFound'));
        }

        const guestLabel = t('admin.social.orders.guest');
        const nextDetail = normalizeOrderDetail(order, guestLabel, fallbackVatRate);

        if (!cancelled) {
          setDetail(nextDetail);
          setCache(cacheKey, nextDetail, 'orders');
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : t('orders.detail.unknownError'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedOrderId, refreshTrigger, fallbackVatRate, t]);

  return {
    detail,
    loading,
    error,
    refresh: () => {
      invalidateResource('orders');
      setRefreshTrigger((current) => current + 1);
    },
  };
}

const OrdersListCard: FunctionalComponent<{
  orders: OrderListItem[];
  loading: boolean;
  error: string | null;
  search: string;
  activeStatusFilters: Set<string>;
  selectedOrderIds: Set<string>;
  selectedOrderId: string | null;
  onSearchChange: (value: string) => void;
  onToggleStatusFilter: (status: string) => void;
  onSelectOrder: (orderId: string, rowIndex: number, shiftKey: boolean) => void;
}> = ({
  orders,
  loading,
  error,
  search,
  activeStatusFilters,
  selectedOrderIds,
  selectedOrderId,
  onSearchChange,
  onToggleStatusFilter,
  onSelectOrder,
}) => {
  const { t, locale } = useI18n();
  const statusFilters = STATUS_OPTIONS.map((status) => ({
    key: status,
    label: getStatusMeta(status, t).label,
  }));

  return (
    <WorkspaceListPanel
      className="orders-workspace-list-card"
      count={orders.length}
      loading={loading}
      loadingText={t('orders.loading')}
      error={error}
      searchValue={search}
      searchLabel={t('common.search')}
      searchPlaceholder={t('orders.searchPlaceholder')}
      searchInputId="orders-workspace-search"
      filterLabel={t('orders.workspace.filters')}
      filterGroupLabel={t('orders.filter.byStatus')}
      filters={statusFilters}
      activeFilterKeys={activeStatusFilters}
      onSearchChange={onSearchChange}
      onToggleFilter={onToggleStatusFilter}
      emptyText={t('orders.noOrders')}
      noResultsText={t('orders.noResults')}
      hasActiveCriteria={search.trim().length > 0 || activeStatusFilters.size > 0}
      controlsVisibility="hidden"
    >
      {orders.map((order, rowIndex) => {
        const isSelected = selectedOrderIds.has(order.orderId);
        const isActive = order.orderId === selectedOrderId;
        const sourceKey = `orders.source.${order.source}`;
        const translatedSource = t(sourceKey);
        const statusMeta = getStatusMeta(order.status, t);

        return (
          <WorkspaceRow
            key={order.id}
            isActive={isActive}
            isSelected={isSelected}
            onClick={(event) => onSelectOrder(order.orderId, rowIndex, event.shiftKey)}
            title={`#${order.orderId}`}
            meta={order.customerName}
            submeta={order.customerEmail || (translatedSource === sourceKey ? order.source : translatedSource)}
            status={<span className={`orders-workspace-status ${statusMeta.className}`}>{statusMeta.label}</span>}
            primaryValue={formatCents(order.total)}
            secondaryValue={formatRelativeTime(order.createdAt, locale)}
          />
        );
      })}
    </WorkspaceListPanel>
  );
};

/**
 * OrderAmendmentModal — maak een amendment-order voor een reeds betaalde order
 * (POST .../amend). Betaalde orders zijn immutabel; de bijbetaling/correctie
 * loopt via een gekoppelde order. Hergebruikt ProductPicker + modal-grammar.
 */
const OrderAmendmentModal: FunctionalComponent<{
  orderId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ orderId, onClose, onSaved }) => {
  const { t } = useI18n();
  const [items, setItems] = useState<PickerOrderItem[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async (): Promise<void> => {
    if (items.length === 0) {
      setErrorMsg(t('orders.amendment.errorNoItems'));
      return;
    }
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      setErrorMsg(t('orders.csrfError'));
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        buildApiUrl(`/orders/${encodeURIComponent(orderId)}/amend`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          credentials: 'include',
          body: JSON.stringify({
            items: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.unitPrice,
            })),
            paymentStatus: 'pending' as const,
            ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
          }),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message ?? t('orders.edit.saveError'));
      }
      invalidateResource('orders');
      onSaved();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('orders.edit.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content order-edit-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header flex justify-between items-center">
          <h2 className="modal-heading--flush">{t('orders.amendment.title')}</h2>
          <button
            className="btn btn--icon btn--ghost"
            onClick={onClose}
            type="button"
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="order-edit-modal-body">
          <p className="products-editor-hint">{t('orders.amendment.hint')}</p>
          <ProductPicker items={items} onItemsChange={setItems} />
          <div className="form-group">
            <label className="form-label" htmlFor="amend-coupon">
              {t('orders.detail.couponCode')}
            </label>
            <input
              id="amend-coupon"
              type="text"
              className="form-input"
              value={couponCode}
              onInput={(e) => setCouponCode((e.target as HTMLInputElement).value)}
              placeholder={t('orders.amendment.couponPlaceholder')}
              disabled={saving}
            />
          </div>
          {errorMsg && (
            <div className="order-edit-error">{errorMsg}</div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : t('orders.amendment.create')}
          </button>
        </div>
      </div>
    </div>
  );
};

const OrderWorkspacePanel: FunctionalComponent<{
  detail: WorkspaceOrderDetail | null;
  vatLabel: string;
  showVatInTotals: boolean;
  loading: boolean;
  error: string | null;
  timelineRefreshNonce: number;
  onRefresh: () => void;
  onUpdateStatuses: (orderId: string, status: WorkspaceOrderStatus, paymentStatus: WorkspacePaymentStatus) => Promise<void>;
}> = ({ detail, vatLabel, showVatInTotals, loading, error, timelineRefreshNonce, onRefresh, onUpdateStatuses }) => {
  const { t, locale } = useI18n();
  const [selectedStatus, setSelectedStatus] = useState<WorkspaceOrderStatus>('pending');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<WorkspacePaymentStatus>('pending');
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [updatingStatuses, setUpdatingStatuses] = useState(false);
  const [editItemsOpen, setEditItemsOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const autoSaveTimerRef = useRef<number | null>(null);

  const handleSaveOrderEdit = useCallback(
    async (updates: OrderEditUpdates): Promise<void> => {
      if (!detail) return;
      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        throw new Error(t('orders.csrfError'));
      }
      const res = await fetch(
        buildApiUrl(`/orders/${encodeURIComponent(detail.orderId)}/edit`),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          credentials: 'include',
          body: JSON.stringify(updates),
        },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message ?? t('orders.edit.saveError'));
      }
      invalidateResource('orders');
      onRefresh();
    },
    [detail, t, onRefresh],
  );

  useEffect(() => {
    if (!detail) {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    setSelectedStatus(detail.status);
    setSelectedPaymentStatus(detail.paymentStatus);
    setStatusUpdateError(null);

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, [detail?.orderId, detail?.status, detail?.paymentStatus]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  if (loading && !detail) {
    return (
      <section className="products-card products-detail-card products-detail-card--state orders-workspace-detail-card">
        <div className="products-pane-state">
          <Spinner size="lg" />
          <p>{t('orders.workspace.loadingDetail')}</p>
        </div>
      </section>
    );
  }

  if (error && !detail) {
    return (
      <section className="products-card products-detail-card products-detail-card--state orders-workspace-detail-card">
        <div className="admin-alert admin-alert--error">{error}</div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="products-card products-detail-card products-detail-card--state orders-workspace-detail-card">
        <div className="products-pane-state">
          <p>{t('orders.workspace.empty')}</p>
        </div>
      </section>
    );
  }

  const statusMeta = getStatusMeta(detail.status, t);
  const packingSlipUrl = detail.shippingApplicable ? buildPackingSlipUrl(detail.orderId) : null;
  const sourceLabel = t(`orders.source.${detail.source}`);
  const paymentStatusLabel = detail.paymentStatus ? getPaymentStatusLabel(detail.paymentStatus, t) : '—';
  const paymentStatusOptions = selectedPaymentStatus && !PAYMENT_STATUS_OPTIONS.includes(selectedPaymentStatus)
    ? [selectedPaymentStatus, ...PAYMENT_STATUS_OPTIONS]
    : PAYMENT_STATUS_OPTIONS;

  const orderStatusOptions = (() => {
    const base = detail.shippingApplicable
      ? STATUS_OPTIONS
      : STATUS_OPTIONS.filter((status) => status !== 'shipped' && status !== 'delivered');
    return selectedStatus && !base.includes(selectedStatus)
      ? [selectedStatus, ...base]
      : base;
  })();

  const canManageAdminCoupon =
    detail.status !== 'cancelled' && detail.paymentStatus !== 'refunded';

  const triggerAutoSave = (nextStatus: WorkspaceOrderStatus, nextPaymentStatus: WorkspacePaymentStatus): void => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    if (nextStatus === detail.status && nextPaymentStatus === detail.paymentStatus) {
      return;
    }

    autoSaveTimerRef.current = window.setTimeout(async () => {
      setStatusUpdateError(null);
      setUpdatingStatuses(true);

      try {
        await onUpdateStatuses(detail.orderId, nextStatus, nextPaymentStatus);
      } catch (updateError) {
        setStatusUpdateError(updateError instanceof Error ? updateError.message : t('orders.edit.saveError'));
      } finally {
        setUpdatingStatuses(false);
      }
    }, STATUS_AUTOSAVE_DEBOUNCE_MS);
  };

  return (
    <section className="products-card products-detail-card orders-workspace-detail-card">
      {error && <div className="admin-alert admin-alert--error">{error}</div>}

      <div className="order-create-columns" data-testid="orders-workspace-detail-columns">
        <section className="products-card order-create-column">
          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.workspace.general')}</span>
            </div>
            <div className="products-workspace-module-body">
              <div className="products-workspace-hero products-workspace-hero--in-section">
                <div className="products-workspace-hero__left order-detail-hero-left">
                  <div className="order-detail-avatar">{getInitials(detail.customerName)}</div>

                  <div className="products-workspace-hero__copy">
                    <div className="products-workspace-hero__title-row">
                      <div className="products-workspace-hero__title">{t('orders.orderNumber')} #{detail.orderId}</div>
                      <span className={`orders-workspace-status ${statusMeta.className}`}>{statusMeta.label}</span>
                    </div>

                    <div className="products-workspace-hero__meta">
                      {detail.customerUserId !== null ? (
                        <button
                          type="button"
                          className="orders-workspace-hero-name-link"
                          onClick={() => navigate(buildCustomerDetailPath(detail.customerUserId))}
                          aria-label={t('orders.workspace.openCustomerAria')}
                        >
                          {detail.customerName}
                        </button>
                      ) : (
                        detail.customerName
                      )}
                      {' · '}
                      {formatDateTime(detail.createdAt, locale)}
                      {' · '}
                      {sourceLabel === `orders.source.${detail.source}` ? detail.source : sourceLabel}
                      {' · '}
                      {t('orders.detail.updatedAt')} {formatDateTime(detail.updatedAt, locale)}
                    </div>
                  </div>
                </div>

                <div className="orders-workspace-hero-actions">
                  {detail.customerUserId !== null && (
                    <button
                      type="button"
                      className="products-workspace-toolbar__action orders-workspace-hero-btn"
                      onClick={() => navigate(buildCustomerDetailPath(detail.customerUserId))}
                    >
                      {t('orders.workspace.goToCustomer')}
                    </button>
                  )}
                  {packingSlipUrl && (
                    <a className="products-workspace-toolbar__action orders-workspace-hero-btn" href={packingSlipUrl} target="_blank" rel="noreferrer">
                      {t('orders.packingSlip')}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.create.sections.customer')}</span>
            </div>
            <div className="products-workspace-module-body">
              <div className="order-detail-info-grid order-detail-info-grid--two-col">
                <div className="order-detail-info-col">
                  <div className="order-info-field">
                    <span>{t('orders.customer')}</span>
                    <strong>{detail.customerName}</strong>
                  </div>
                  <div className="order-info-field">
                    <span>{t('holders.detail.fields.email')}</span>
                    <strong>{detail.customerEmail || '—'}</strong>
                  </div>
                </div>
                <div className="order-detail-info-col">
                  <div className="order-info-field">
                    <span>{t('holders.detail.fields.phone')}</span>
                    <strong>{detail.customerPhone || '—'}</strong>
                  </div>
                  <div className="order-info-field">
                    <span>{t('orders.detail.paymentStatusLabel')}</span>
                    <strong>{paymentStatusLabel}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.detail.orderItems')}</span>
              {detail.status !== 'cancelled' &&
                detail.paymentStatus !== 'refunded' &&
                (detail.paymentStatus === 'paid' ? (
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setAmendOpen(true)}
                    data-testid="order-amend-open"
                  >
                    {t('orders.amendment.openButton')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setEditItemsOpen(true)}
                    data-testid="order-edit-items-open"
                  >
                    {t('orders.itemsEditor.openButton')}
                  </button>
                ))}
            </div>
            <div className="products-workspace-module-body">
              <table className="order-lines-table">
                <thead>
                  <tr>
                    <th>{t('orders.detail.product')}</th>
                    <th>{t('orders.detail.quantity')}</th>
                    <th>{t('orders.detail.price')}</th>
                    <th>{t('orders.detail.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="order-product-cell">
                          <div className="order-product-img">📦</div>
                          <div>
                            <div className="order-product-name">{item.productName}</div>
                            <div className="order-product-sku">
                              {item.productSku ? `SKU: ${item.productSku}` : '—'}
                            </div>
                            {item.billingSeasonLabelSnapshot && (
                              <div className="order-product-sku">
                                {t('orders.detail.seasonLabel')}: {item.billingSeasonLabelSnapshot}
                              </div>
                            )}
                            {item.itemType?.toUpperCase() === 'SUBSCRIPTION' && item.subscriptionId !== null && (
                              <button
                                type="button"
                                className="order-product-subscription-link"
                                onClick={() => navigate(buildSubscriptionDetailPath(item.subscriptionId))}
                              >
                                {t('orders.workspace.viewSubscription')}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{formatCents(item.unitPrice)}</td>
                      <td>{formatCents(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!detail.shippingApplicable ? null : (
          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.create.sections.addresses')}</span>
            </div>
            <div className="products-workspace-module-body">
              <div className="order-detail-info-grid order-detail-info-grid--two-col">
                <div className="order-detail-info-col">
                  <div className="order-info-field">
                    <span>{t('orders.detail.shippingAddressTitle')}</span>
                    <strong>{formatAddress(detail.shippingAddress)}</strong>
                  </div>
                </div>
                <div className="order-detail-info-col">
                  <div className="order-info-field">
                    <span>{t('orders.detail.shippingMethod')}</span>
                    <strong>{detail.shippingMethod || '—'}</strong>
                  </div>
                  {detail.trackingCode ? (
                    <div className="order-info-field">
                      <span>{t('orders.detail.trackTrace')}</span>
                      <strong>{detail.trackingCode}</strong>
                    </div>
                  ) : null}
                  <OrderShippingLabelActions
                    orderId={detail.orderId}
                    trackingCode={detail.trackingCode}
                    onChanged={onRefresh}
                  />
                  {detail.shippedAt ? (
                    <div className="order-info-field">
                      <span>{t('orders.statusFlow.shippedAt')}</span>
                      <strong>{formatDateTime(detail.shippedAt, locale)}</strong>
                    </div>
                  ) : null}
                  {detail.deliveredAt ? (
                    <div className="order-info-field">
                      <span>{t('orders.statusFlow.deliveredAt')}</span>
                      <strong>{formatDateTime(detail.deliveredAt, locale)}</strong>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          )}

          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.workspace.flowActivity')}</span>
            </div>
            <div className="products-workspace-module-body">
              <div className="orders-workspace-timeline-card">
                <OrderTimeline
                  key={`${detail.orderId}-${timelineRefreshNonce}`}
                  orderId={detail.orderId}
                  onNoteAdded={onRefresh}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="products-card order-create-column">
          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('common.status')}</span>
            </div>
            <div className="products-workspace-module-body">
              <div className="products-detail-form">
                <div className="products-workspace-form-grid">
                  <div className="products-workspace-form-block">
                    <label className="products-editor-label" htmlFor="orders-workspace-status-select">
                      {t('orders.update.orderStatus')}
                    </label>
                    <select
                      id="orders-workspace-status-select"
                      className="form-select products-workspace-field"
                      value={selectedStatus}
                      disabled={updatingStatuses}
                      onChange={(event) => {
                        const nextStatus = (event.target as HTMLSelectElement).value;
                        if (!isWorkspaceOrderStatus(nextStatus)) {
                          return;
                        }

                        setSelectedStatus(nextStatus);
                        triggerAutoSave(nextStatus, selectedPaymentStatus);
                      }}
                    >
                      {orderStatusOptions.map((statusOption) => {
                        const optionMeta = getStatusMeta(statusOption, t);
                        return (
                          <option key={statusOption} value={statusOption}>
                            {optionMeta.label}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="products-workspace-form-block">
                    <label className="products-editor-label" htmlFor="orders-workspace-payment-status-select">
                      {t('orders.update.paymentStatus')}
                    </label>
                    <select
                      id="orders-workspace-payment-status-select"
                      className="form-select products-workspace-field"
                      value={selectedPaymentStatus}
                      disabled={updatingStatuses}
                      onChange={(event) => {
                        const nextPaymentStatus = (event.target as HTMLSelectElement).value;
                        setSelectedPaymentStatus(nextPaymentStatus);
                        triggerAutoSave(selectedStatus, nextPaymentStatus);
                      }}
                    >
                      {paymentStatusOptions.map((paymentStatusOption) => (
                        <option key={paymentStatusOption} value={paymentStatusOption}>
                          {getPaymentStatusLabel(paymentStatusOption, t)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {updatingStatuses && (
                  <div className="admin-alert admin-alert--info">{t('common.saving')}</div>
                )}
                {statusUpdateError && (
                  <div className="admin-alert admin-alert--error" role="alert">{statusUpdateError}</div>
                )}
              </div>

              <div className="orders-workspace-module orders-workspace-module--status">
                {detail.shippingApplicable ? (
                  <StatusFlowCard
                    order={{
                      orderId: detail.orderId,
                      status: detail.status,
                      trackingCode: detail.trackingCode || undefined,
                      shippedAt: detail.shippedAt || undefined,
                      deliveredAt: detail.deliveredAt || undefined,
                    }}
                    onUpdate={onRefresh}
                  />
                ) : (
                  <p className="text-secondary">{t('orders.detail.notApplicable')}</p>
                )}
              </div>
            </div>
          </div>

          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.create.sections.payment')}</span>
            </div>
            <div className="products-workspace-module-body">
              <div className="order-detail-info-grid order-detail-info-grid--single-col">
                <div className="order-info-field">
                  <span>{t('orders.detail.paymentMethod')}</span>
                  <strong>{formatPaymentMethod(detail.paymentMethod)}</strong>
                </div>
                {detail.paymentPaidAt ? (
                  <div className="order-info-field">
                    <span>{t('orders.detail.paymentPaidAt')}</span>
                    <strong>{formatDateTime(detail.paymentPaidAt, locale)}</strong>
                  </div>
                ) : null}
                {detail.stripePaymentId ? (
                  <div className="order-info-field">
                    <span>{t('orders.detail.stripePaymentId')}</span>
                    <strong className="font-mono text-sm">{detail.stripePaymentId}</strong>
                  </div>
                ) : null}
                {detail.stripePaymentIntentId ? (
                  <div className="order-info-field">
                    <span>{t('orders.detail.stripePaymentIntentId')}</span>
                    <strong className="font-mono text-sm">{detail.stripePaymentIntentId}</strong>
                  </div>
                ) : null}
                {detail.stripeCheckoutSessionId ? (
                  <div className="order-info-field">
                    <span>{t('orders.detail.stripeCheckoutSessionId')}</span>
                    <strong className="font-mono text-sm">{detail.stripeCheckoutSessionId}</strong>
                  </div>
                ) : null}
              </div>
              {canManageAdminCoupon && (
                <div className="products-detail-form orders-admin-coupon-stack">
                <div className="products-editor-label orders-workspace-module-label">
                  {t('orders.detail.couponAdjustTitle')}
                </div>
                <OrderCouponInput
                    key={`${detail.orderId}-${String(detail.total)}-${String(detail.discount)}-${detail.couponCode ?? ''}`}
                    orderId={detail.orderId}
                    apiBasePath="/api/admin/orders"
                    initialCouponCode={detail.couponCode ?? undefined}
                    initialDiscountCents={detail.discount}
                    onCouponApplied={() => {
                      onRefresh();
                    }}
                    onCouponRemoved={() => {
                      onRefresh();
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.detail.totals')}</span>
            </div>
            <div className="products-workspace-module-body orders-workspace-totals-body">
              <div className="order-totals order-totals--right">
                <div className="order-totals-row">
                  <span>{t('orders.detail.subtotal')}</span>
                  <strong>{formatCents(detail.subtotal)}</strong>
                </div>
                {detail.shippingApplicable && (
                <div className="order-totals-row">
                  <span>{t('orders.detail.shippingCost')}</span>
                  <strong>
                    {detail.shipping === 0 ? t('orders.edit.shippingMethod.free') : formatCents(detail.shipping)}
                  </strong>
                </div>
                )}
                {detail.discount > 0 && (
                  <div className="order-totals-row">
                    <span>{t('orders.detail.discount')}</span>
                    <strong>{formatCents(-detail.discount)}</strong>
                  </div>
                )}
                {detail.couponCode && (
                  <div className="order-totals-row">
                    <span>{t('orders.detail.couponCode')}</span>
                    <strong>{detail.couponCode}</strong>
                  </div>
                )}
                {showVatInTotals && (
                  <div className="order-totals-row">
                    <span>{vatLabel}</span>
                    <strong>{formatCents(detail.vat)}</strong>
                  </div>
                )}
                <div className="order-totals-row order-totals-row--total">
                  <span>{t('orders.detail.total')}</span>
                  <strong>{formatCents(detail.total)}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {editItemsOpen && (
        <OrderEditModal
          order={{
            id: detail.id,
            orderId: detail.orderId,
            status: detail.status,
            paymentStatus: detail.paymentStatus,
            items: detail.items.map((it) => ({
              id: it.id,
              productId: it.productId ?? 0,
              productTitle: it.productName,
              productSku: it.productSku,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              totalPrice: it.totalPrice,
            })),
            shippingAddress: detail.shippingAddress
              ? {
                  street: detail.shippingAddress.street,
                  zipcode: detail.shippingAddress.postalCode,
                  city: detail.shippingAddress.city,
                  country: detail.shippingAddress.country,
                }
              : undefined,
            shippingMethod: detail.shippingMethod ?? undefined,
            subtotal: detail.subtotal,
            shipping: detail.shipping,
            total: detail.total,
          }}
          onClose={() => setEditItemsOpen(false)}
          onSave={handleSaveOrderEdit}
        />
      )}

      {amendOpen && (
        <OrderAmendmentModal
          orderId={detail.orderId}
          onClose={() => setAmendOpen(false)}
          onSaved={onRefresh}
        />
      )}
    </section>
  );
};

/**
 * OrdersPage
 * Toont orders als rustige master-detail werkplek met inline orderafhandeling.
 */
const OrdersPage: FunctionalComponent = () => {
  const { t } = useI18n();
  const showNavNotification = useUIStore((state) => state.showNavNotification);
  const [orderPaneMode, setOrderPaneMode] = useState<'edit' | 'create'>(() => (isOrdersCreatePath() ? 'create' : 'edit'));
  const [createSessionKey, setCreateSessionKey] = useState(0);
  const [orderCreateSaving, setOrderCreateSaving] = useState(false);
  const orderCreateSubmitRef = useRef<(() => Promise<void>) | null>(null);
  const [search, setSearch] = useState<string>(() => getInitialOrderSearchQuery());
  const [debouncedSearch, setDebouncedSearch] = useState<string>(() => getInitialOrderSearchQuery());
  const [channelFilter, setChannelFilter] = useState<OrdersChannelFilter>(() => getInitialOrdersChannelFilter());
  const [selectedStatuses, setSelectedStatuses] = useState<WorkspaceOrderStatus[]>([]);
  const tenantSlug = useMemo(() => getTenantSlug(), []);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [selectionAnchorIndex, setSelectionAnchorIndex] = useState<number | null>(null);
  const orderWorkspaceUrlOptions = useMemo(
    () => ({
      pathPrefix: '/admin/orders',
      parse: parseOrderIdFromAdminPath,
      serialize: serializeOrderWorkspaceId,
      writeMode: 'path' as const,
    }),
    [],
  );
  const [selectedOrderId, setSelectedOrderId] = useWorkspaceUrlSelection<string>(orderWorkspaceUrlOptions);
  const [currentPage, setCurrentPage] = useState(1);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [fallbackVatRate, setFallbackVatRate] = useState<number | null>(null);
  const [vatLabel, setVatLabel] = useState<string>(t('orders.detail.vat'));
  const [tenantVatLiable, setTenantVatLiable] = useState(true);
  const [timelineRefreshNonce, setTimelineRefreshNonce] = useState(0);
  const activeStatusFilters = useMemo(() => new Set<string>(selectedStatuses), [selectedStatuses]);

  useEffect(() => {
    const htmlRoot = document.documentElement;
    const body = document.body;
    const adminShell = document.querySelector('.admin-shell');
    const adminMain = document.querySelector('.admin-main');

    htmlRoot.classList.add('orders-route-lock');
    body.classList.add('orders-route-lock');
    adminShell?.classList.add('orders-shell-lock');
    adminMain?.classList.add('orders-main-lock');

    return () => {
      htmlRoot.classList.remove('orders-route-lock');
      body.classList.remove('orders-route-lock');
      adminShell?.classList.remove('orders-shell-lock');
      adminMain?.classList.remove('orders-main-lock');
    };
  }, []);

  useEffect(() => {
    if (!isOrdersCreatePath()) {
      return;
    }

    setOrderPaneMode('create');
    setSelectedOrderIds(new Set());
  }, [setSelectedOrderId]);

  useEffect(() => {
    const syncCreateModeFromPath = (): void => {
      setOrderPaneMode(isOrdersCreatePath() ? 'create' : 'edit');
    };

    window.addEventListener('popstate', syncCreateModeFromPath);
    return () => window.removeEventListener('popstate', syncCreateModeFromPath);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function fetchTaxDisplaySettings(): Promise<void> {
      try {
        const response = await fetch(buildApiUrl('/settings'), {
          credentials: 'include',
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const payload = unwrapData<{ settings?: Record<string, unknown> }>(data);
        const settings = payload?.settings ?? {};
        const taxLabelValue = asText(settings.taxLabel) || t('orders.detail.vat');
        const defaultVatRate = resolveDefaultVatRate(settings);
        const nextVatLabel = defaultVatRate && defaultVatRate > 0
          ? `${taxLabelValue} (${defaultVatRate}%)`
          : taxLabelValue;
        const rawVl = settings.vatLiable;
        const liable = rawVl !== false && rawVl !== 'false';

        if (!cancelled) {
          setFallbackVatRate(defaultVatRate);
          setVatLabel(nextVatLabel);
          setTenantVatLiable(liable);
        }
      } catch {
        if (!cancelled) {
          setFallbackVatRate(null);
          setVatLabel(t('orders.detail.vat'));
          setTenantVatLiable(true);
        }
      }
    }

    fetchTaxDisplaySettings();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const { orders, total, loading, error, refetch } = useOrders(
    {
      search: debouncedSearch,
      statuses: selectedStatuses,
      channelFilter,
    },
    currentPage,
  );

  const { detail, loading: detailLoading, error: detailError, refresh: refreshDetail } = useOrderDetail(
    selectedOrderId,
    fallbackVatRate,
  );

  const refreshOrderWorkspace = useCallback(async () => {
    await withPreservedWorkspaceDetailScroll(async () => {
      refetch();
      refreshDetail();
      setTimelineRefreshNonce((current) => current + 1);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });
  }, [refetch, refreshDetail]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedStatuses.join(','), serializeOrdersChannelFilterForCache(channelFilter)]);

  useEffect(() => {
    syncOrdersWorkspaceUrlParams({
      search: debouncedSearch,
      channelFilter,
    });
  }, [debouncedSearch, channelFilter]);

  const handleChannelFilterChange = useCallback((next: OrdersChannelFilter) => {
    setChannelFilter(next);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    if (selectedOrderId && selectedOrderIds.size === 0) {
      setSelectedOrderIds(new Set([selectedOrderId]));
    }
  }, [selectedOrderId, selectedOrderIds.size]);

  useEffect(() => {
    if (selectedOrderIds.size === 0) {
      return;
    }

    const visibleIds = new Set(orders.map((order) => order.orderId));
    setSelectedOrderIds((current) => {
      const next = new Set<string>();
      current.forEach((id) => {
        if (visibleIds.has(id)) {
          next.add(id);
        }
      });

      if (next.size === current.size) {
        let unchanged = true;
        current.forEach((id) => {
          if (!next.has(id)) {
            unchanged = false;
          }
        });

        if (unchanged) {
          return current;
        }
      }

      return next;
    });
  }, [orders, selectedOrderIds.size]);

  useEffect(() => {
    if (orderPaneMode === 'create' || isOrdersCreatePath()) {
      return;
    }

    if (orders.length === 0) {
      setSelectedOrderId(null, { historyMode: 'replace' });
      setSelectedOrderIds(new Set());
      setSelectionAnchorIndex(null);
      return;
    }

    const selectedStillVisible = selectedOrderId && orders.some((order) => order.orderId === selectedOrderId);
    if (!selectedStillVisible) {
      const firstOrderId = orders[0].orderId;
      setSelectedOrderId(firstOrderId, { historyMode: 'replace' });
      setSelectedOrderIds(new Set([firstOrderId]));
      setSelectionAnchorIndex(0);
    }
  }, [orders, selectedOrderId, orderPaneMode, setSelectedOrderId]);

  const handleSelectOrder = (orderId: string, rowIndex: number, shiftKey: boolean) => {
    setOrderPaneMode('edit');
    if (shiftKey && selectionAnchorIndex !== null) {
      const start = Math.min(selectionAnchorIndex, rowIndex);
      const end = Math.max(selectionAnchorIndex, rowIndex);
      const rangeIds = orders.slice(start, end + 1).map((order) => order.orderId);
      setSelectedOrderIds(new Set(rangeIds));
    } else {
      setSelectedOrderIds(new Set([orderId]));
      setSelectionAnchorIndex(rowIndex);
    }

    setSelectedOrderId(orderId);
  };

  const toggleStatus = (status: string) => {
    if (!isWorkspaceOrderStatus(status)) {
      return;
    }

    setSelectedStatuses((current) => (
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status]
    ));
  };

  const handleProcessOrder = async () => {
    if (!detail || !selectedOrderId || detail.orderId !== selectedOrderId || detail.status !== 'pending') {
      return;
    }

    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      window.alert(t('orders.csrfError'));
      return;
    }

    try {
      setProcessingOrder(true);

      const response = await fetch(buildApiUrl(`/orders/${encodeURIComponent(detail.orderId)}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ status: 'processing' }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string }; message?: string } | null;
        throw new Error(payload?.error?.message ?? payload?.message ?? t('orders.fetchError'));
      }

      invalidateResource('orders');
      await refreshOrderWorkspace();
    } catch (processError) {
      window.alert(processError instanceof Error ? processError.message : t('orders.unknownError'));
    } finally {
      setProcessingOrder(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!detail || !selectedOrderId || detail.orderId !== selectedOrderId) {
      return;
    }

    if (['cancelled', 'delivered', 'completed'].includes(detail.status)) {
      return;
    }

    if (!window.confirm(t('orders.workspace.confirmCancelOrder'))) {
      return;
    }

    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      window.alert(t('orders.csrfError'));
      return;
    }

    try {
      setCancellingOrder(true);

      const response = await fetch(buildApiUrl(`/orders/${encodeURIComponent(detail.orderId)}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string }; message?: string } | null;
        throw new Error(payload?.error?.message ?? payload?.message ?? t('orders.fetchError'));
      }

      invalidateResource('orders');
      await refreshOrderWorkspace();
    } catch (cancelError) {
      window.alert(cancelError instanceof Error ? cancelError.message : t('orders.unknownError'));
    } finally {
      setCancellingOrder(false);
    }
  };

  const handleUpdateStatuses = async (
    orderId: string,
    status: WorkspaceOrderStatus,
    paymentStatus: WorkspacePaymentStatus,
  ): Promise<void> => {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      throw new Error(t('orders.csrfError'));
    }

    const response = await fetch(buildApiUrl(`/orders/${encodeURIComponent(orderId)}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({ status, paymentStatus }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { message?: string }; message?: string } | null;
      throw new Error(payload?.error?.message ?? payload?.message ?? t('orders.edit.saveError'));
    }

    invalidateResource('orders');
    await refreshOrderWorkspace();
  };

  const registerOrderCreateSubmit = useCallback((handler: (() => Promise<void>) | null) => {
    orderCreateSubmitRef.current = handler;
  }, []);

  const handleToolbarSaveCreate = useCallback(async () => {
    await orderCreateSubmitRef.current?.();
  }, []);

  const handleNewOrder = useCallback(() => {
    setCreateSessionKey((current) => current + 1);
    navigate(buildAdminPathWithTenant('/admin/orders/new'));
    setOrderPaneMode('create');
    setSelectedOrderIds(new Set());
  }, []);

  const handleCancelCreate = useCallback(() => {
    setOrderPaneMode('edit');
    navigate(buildAdminPathWithTenant('/admin/orders'));
    if (orders.length > 0) {
      const firstId = orders[0].orderId;
      setSelectedOrderId(firstId, { historyMode: 'replace' });
      setSelectedOrderIds(new Set([firstId]));
      setSelectionAnchorIndex(0);
    } else {
      setSelectedOrderId(null, { historyMode: 'replace' });
      setSelectedOrderIds(new Set());
      setSelectionAnchorIndex(null);
    }
  }, [orders, setSelectedOrderId]);

  const handleOrderCreated = useCallback((orderId: string) => {
    invalidateResource('orders');
    refetch();
    setOrderPaneMode('edit');
    showNavNotification('success', t('orders.workspace.createSuccess'));
    setSelectedOrderId(orderId, { historyMode: 'replace' });
    setSelectedOrderIds(new Set([orderId]));
  }, [refetch, setSelectedOrderId, showNavNotification, t]);

  const canProcessSelected = Boolean(
    orderPaneMode !== 'create'
    && !detailLoading
    && detail
    && selectedOrderId
    && detail.orderId === selectedOrderId
    && detail.status === 'pending',
  );

  const canCancelSelected = Boolean(
    orderPaneMode !== 'create'
    && !detailLoading
    && detail
    && selectedOrderId
    && detail.orderId === selectedOrderId
    && !['cancelled', 'delivered', 'completed'].includes(detail.status),
  );

  const statusFilterOptions = STATUS_OPTIONS.map((status) => ({
    key: status,
    label: getStatusMeta(status, t).label,
  }));

  const activeWorkspaceChips = [
    ...(search.trim().length > 0
      ? [{
        key: 'search',
        label: `${t('common.search')}: ${search.trim()}`,
        onRemove: () => setSearch(''),
      }]
      : []),
    ...(channelFilter.kind !== 'all'
      ? [{
        key: 'channel',
        label: channelFilter.kind === 'pos' ? t('orders.channel.pos') : t('orders.channel.webshop'),
        onRemove: () => handleChannelFilterChange(ORDERS_CHANNEL_ALL),
      }]
      : []),
    ...selectedStatuses.map((status) => ({
      key: `status-${status}`,
      label: getStatusMeta(status, t).label,
      onRemove: () => toggleStatus(status),
    })),
  ];

  const clearWorkspaceFilters = (): void => {
    setSearch('');
    setSelectedStatuses([]);
    handleChannelFilterChange(ORDERS_CHANNEL_ALL);
  };

  const workspaceSections = [
    {
      id: 'search',
      title: t('common.search'),
      description: t('orders.searchPlaceholder'),
      width: 'lg' as const,
      children: (
        <WorkspaceCommandField
          id="orders-workspace-v3-search"
          type="search"
          value={search}
          placeholder={t('orders.searchPlaceholder')}
          aria-label={t('common.search')}
          onInput={(event) => setSearch((event.currentTarget as HTMLInputElement).value)}
        />
      ),
    },
    {
      id: 'collections',
      title: 'Collecties',
      description: 'Snel naar de belangrijkste orderstromen.',
      width: 'md' as const,
      children: (
        <div className="workspace-command-stack">
          <WorkspaceCommandOption
            label="Alle orders"
            meta={total}
            isActive={channelFilter.kind === 'all' && selectedStatuses.length === 0 && search.trim().length === 0}
            onClick={clearWorkspaceFilters}
          />
          <WorkspaceCommandOption label="Vandaag" meta="soon" disabled />
          <WorkspaceCommandOption label="Ready to pack" meta="soon" disabled />
          <WorkspaceCommandOption label="Pickup" meta="soon" disabled />
          <WorkspaceCommandOption label="Subscriptions" meta="soon" disabled />
          <WorkspaceCommandOption label="Main site" meta="soon" disabled />
        </div>
      ),
    },
    {
      id: 'channel',
      title: 'Kanalen',
      description: 'POS en webshop-context.',
      width: 'md' as const,
      children: (
        <OrdersChannelToolbarFilters
          channelFilter={channelFilter}
          tenantSlug={tenantSlug}
          onChannelFilterChange={handleChannelFilterChange}
        />
      ),
    },
    {
      id: 'status',
      title: t('orders.workspace.filters'),
      description: t('orders.filter.byStatus'),
      width: 'lg' as const,
      children: (
        <div className="workspace-command-check-grid">
          {statusFilterOptions.map((status) => (
            <label key={status.key} className="workspace-command-check">
              <input
                type="checkbox"
                checked={activeStatusFilters.has(status.key)}
                onChange={() => toggleStatus(status.key)}
              />
              <span>{status.label}</span>
            </label>
          ))}
        </div>
      ),
    },
    {
      id: 'date-payment',
      title: 'Datum & betaling',
      description: 'Voorbereid voor datum-, bedrag- en betaalfilters.',
      width: 'md' as const,
      children: (
        <div className="workspace-command-form-grid">
          <WorkspaceCommandSelect aria-label="Datumperiode" disabled>
            <option>Afgelopen 30 dagen</option>
            <option>Vandaag</option>
            <option>Deze maand</option>
          </WorkspaceCommandSelect>
          <WorkspaceCommandField type="date" aria-label="Van" disabled />
          <WorkspaceCommandField type="date" aria-label="Tot" disabled />
          <WorkspaceCommandSelect aria-label="Betaalmethode" disabled>
            <option>Alle betaalmethoden</option>
            <option>Stripe</option>
            <option>POS</option>
          </WorkspaceCommandSelect>
        </div>
      ),
    },
    {
      id: 'view',
      title: 'Weergave',
      description: 'Layout, sortering en kolommen.',
      width: 'md' as const,
      children: (
        <div className="workspace-command-stack">
          <div className="workspace-command-segmented" aria-label="Weergave">
            <button type="button" className="workspace-command-segmented__item workspace-command-segmented__item--active">List</button>
            <button type="button" className="workspace-command-segmented__item" disabled>Grid</button>
          </div>
          <WorkspaceCommandSelect aria-label="Sortering" disabled>
            <option>Nieuwste eerst</option>
            <option>Oudste eerst</option>
            <option>Hoogste bedrag</option>
          </WorkspaceCommandSelect>
          <WorkspaceCommandSelect aria-label="Per pagina" disabled>
            <option>{ADMIN_PAGE_SIZE} per pagina</option>
          </WorkspaceCommandSelect>
        </div>
      ),
    },
    {
      id: 'actions',
      title: 'Acties',
      description: 'Bulk, export, print en scan-acties.',
      width: 'md' as const,
      children: (
        <div className="workspace-command-stack">
          <WorkspaceCommandOption label={t('common.refresh')} onClick={() => void refreshOrderWorkspace()} />
          <WorkspaceCommandOption label="Bulk actions" meta={selectedOrderIds.size > 0 ? selectedOrderIds.size : 'selecteer orders'} disabled={selectedOrderIds.size === 0} />
          <WorkspaceCommandOption label="Export CSV" disabled />
          <WorkspaceCommandOption label="Export PDF" disabled />
          <WorkspaceCommandOption label="Print packing slips" disabled />
          <WorkspaceCommandOption label="Scan barcode" disabled />
        </div>
      ),
    },
  ];

  return (
    <div className="admin-page orders-page">
      <WorkspaceCommandCenter
        className="orders-workspace-command-center"
        title={t('orders.title')}
        subtitle={t('orders.pageDescription')}
        totalLabel={t('orders.orderCount', { count: String(total) })}
        toggleLabel="Filter & functies"
        primaryAction={{
          label: t('orders.newOrder'),
          onClick: handleNewOrder,
          disabled: orderPaneMode === 'create' || cancellingOrder,
          testId: 'toolbar-action-new',
        }}
        secondaryActions={orderPaneMode === 'create'
          ? [
            {
              label: t('common.cancel'),
              onClick: handleCancelCreate,
              disabled: orderCreateSaving,
              testId: 'toolbar-action-cancel',
            },
            {
              label: orderCreateSaving ? t('orders.create.submitting') : t('orders.create.submitBtn'),
              onClick: () => void handleToolbarSaveCreate(),
              disabled: orderCreateSaving,
              tone: 'primary',
              testId: 'toolbar-action-save',
            },
          ]
          : [
            {
              label: cancellingOrder ? t('common.saving') : t('orders.workspace.cancelOrder'),
              onClick: () => void handleCancelOrder(),
              disabled: !canCancelSelected || cancellingOrder || processingOrder,
              tone: 'danger',
              testId: 'toolbar-action-cancel',
            },
            {
              label: processingOrder ? t('common.saving') : t('orders.workspace.process'),
              onClick: () => void handleProcessOrder(),
              disabled: !canProcessSelected || processingOrder || cancellingOrder,
              tone: 'primary',
              testId: 'toolbar-action-save',
            },
          ]}
        sections={workspaceSections}
        activeChips={activeWorkspaceChips}
        onClearAll={clearWorkspaceFilters}
        clearAllLabel={t('orders.workspace.clearFilters')}
        applyLabel="Toepassen filters"
      />

      <div className="products-master-detail orders-workspace-grid">
        <div className="orders-workspace-left-column">
          <OrdersListCard
            orders={orders}
            loading={loading}
            error={error}
            search={search}
            activeStatusFilters={activeStatusFilters}
            selectedOrderIds={selectedOrderIds}
            selectedOrderId={selectedOrderId}
            onSearchChange={setSearch}
            onToggleStatusFilter={toggleStatus}
            onSelectOrder={handleSelectOrder}
          />

          {!loading && !error && total > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={total}
              pageSize={ADMIN_PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          )}
        </div>

        {orderPaneMode === 'create' ? (
          <OrderCreateWorkspaceDetail
            key={createSessionKey}
            onCreated={handleOrderCreated}
            onSavingChange={setOrderCreateSaving}
            registerSubmit={registerOrderCreateSubmit}
          />
        ) : (
          <OrderWorkspacePanel
            detail={detail}
            vatLabel={vatLabel}
            showVatInTotals={shouldPresentVatInUi(tenantVatLiable)}
            loading={detailLoading}
            error={detailError}
            timelineRefreshNonce={timelineRefreshNonce}
            onRefresh={() => {
              void refreshOrderWorkspace();
            }}
            onUpdateStatuses={handleUpdateStatuses}
          />
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
