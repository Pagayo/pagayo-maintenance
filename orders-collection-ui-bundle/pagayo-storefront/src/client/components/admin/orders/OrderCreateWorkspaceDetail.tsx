/**
 * OrderCreateWorkspaceDetail
 * Handmatige order aanmaken in de orders master–detail werkplek (zelfde UX-patroon als producten).
 * @module components/admin/orders/OrderCreateWorkspaceDetail
 */
import { FunctionalComponent } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { CheckCircle, Copy, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components';
import { api, ApiException } from '../../../utils/api';
import { CustomerPicker, type Customer, type NewCustomerData } from '../CustomerPicker';
import { ProductPicker, type OrderItem } from '../ProductPicker';
import { useI18n } from '../../../i18n';
import { formatCents } from '../../../utils/money';
import { unwrapData } from '../../../utils/unwrapApi';
import { invalidateResource } from '../../../utils/adminCache';
import type { AdminOrderPaymentMethod } from '../../../../features/orders/admin-order.constants';
// Address interface
interface Address {
  firstName: string;
  lastName: string;
  street: string;
  houseNumber: string;
  zipcode: string;
  city: string;
  country: string;
  phone?: string;
}

// Shipping method interface
interface ShippingMethod {
  id: string;
  name: string;
  price: number; // in cents
}

// Form state
interface OrderFormState {
  // Customer
  selectedCustomer: Customer | null;
  newCustomerData: NewCustomerData | null;
  
  // Products
  items: OrderItem[];
  
  // Addresses
  billingAddress: Address;
  shippingAddress: Address;
  sameAsShipping: boolean;
  
  // Shipping
  shippingMethod: string;
  
  // Payment
  paymentStatus: 'pending' | 'paid' | 'invoice';
  /** order_payment.method — admin kanaal */
  adminPaymentMethod: AdminOrderPaymentMethod;

  // Admin note
  adminNote: string;

  /** Optionele kortingscode (zelfde validatie als checkout; toegepast bij aanmaken) */
  couponCode: string;
}

export interface OrderCreateWorkspaceDetailProps {
  onCreated: (orderId: string) => void;
  onSavingChange: (saving: boolean) => void;
  registerSubmit: (handler: (() => Promise<void>) | null) => void;
}

/**
 * Get CSRF token from cookie
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Get tenant parameter from URL
 */
function getTenantParam(): string {
  return new URLSearchParams(window.location.search).get('tenant') || '';
}

/**
 * Empty address template
 */
const emptyAddress: Address = {
  firstName: '',
  lastName: '',
  street: '',
  houseNumber: '',
  zipcode: '',
  city: '',
  country: 'Nederland',
  phone: '',
};

/**
 * Default shipping methods - names resolved via i18n in component
 */
function getDefaultShippingMethods(t: (key: string) => string): ShippingMethod[] {
  return [
    { id: 'pickup', name: t('orders.edit.shippingMethod.pickup'), price: 0 },
    { id: 'standard', name: t('orders.edit.shippingMethod.standard'), price: 695 },
    { id: 'express', name: t('orders.edit.shippingMethod.express'), price: 1295 },
  ];
}

/**
 * OrderCreateWorkspaceDetail — formulier voor nieuwe order in rechter workspace-paneel.
 */
export const OrderCreateWorkspaceDetail: FunctionalComponent<OrderCreateWorkspaceDetailProps> = ({
  onCreated,
  onSavingChange,
  registerSubmit,
}) => {
  const { t, locale } = useI18n();

  // Form state
  const [formState, setFormState] = useState<OrderFormState>({
    selectedCustomer: null,
    newCustomerData: null,
    items: [],
    billingAddress: { ...emptyAddress },
    shippingAddress: { ...emptyAddress },
    sameAsShipping: true,
    shippingMethod: 'standard',
    paymentStatus: 'pending',
    adminPaymentMethod: 'admin_invoice',
    adminNote: '',
    couponCode: '',
  });

  // UI state
  const [_saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>(getDefaultShippingMethods(t));
  const [shippingSettings, setShippingSettings] = useState({
    standard: 695,
    express: 1295,
    freeThreshold: 5000, // €50 default
    freeEnabled: true,
  });
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponDiscountCents, setCouponDiscountCents] = useState(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);

  // Load shipping settings
  useEffect(() => {
    const fetchShippingSettings = async () => {
      try {
        const tenantParam = getTenantParam();
        const params = new URLSearchParams();
        if (tenantParam) params.set('tenant', tenantParam);

        // Fetch shipping costs
        const [standardRes, expressRes, freeThresholdRes, freeEnabledRes] = await Promise.all([
          fetch(`/api/admin/settings/shippingStandard?${params.toString()}`, { credentials: 'include' }),
          fetch(`/api/admin/settings/shippingExpress?${params.toString()}`, { credentials: 'include' }),
          fetch(`/api/admin/settings/freeShippingThreshold?${params.toString()}`, { credentials: 'include' }),
          fetch(`/api/admin/settings/freeShippingEnabled?${params.toString()}`, { credentials: 'include' }),
        ]);

        const settings = { ...shippingSettings };
        
        if (standardRes.ok) {
          const data = await standardRes.json();
          settings.standard = parseInt(unwrapData<string>(data)) || 695;
        }
        if (expressRes.ok) {
          const data = await expressRes.json();
          settings.express = parseInt(unwrapData<string>(data)) || 1295;
        }
        if (freeThresholdRes.ok) {
          const data = await freeThresholdRes.json();
          settings.freeThreshold = parseInt(unwrapData<string>(data)) || 5000;
        }
        if (freeEnabledRes.ok) {
          const data = await freeEnabledRes.json();
          const val = unwrapData<string | boolean>(data);
          settings.freeEnabled = val === 'true' || val === true;
        }

        setShippingSettings(settings);
        setShippingMethods([
          { id: 'pickup', name: t('orders.edit.shippingMethod.pickup'), price: 0 },
          { id: 'standard', name: t('orders.edit.shippingMethod.standard'), price: settings.standard },
          { id: 'express', name: t('orders.edit.shippingMethod.express'), price: settings.express },
        ]);
      } catch (err) {
        console.error('Failed to load shipping settings:', err);
      }
    };

    fetchShippingSettings();
  }, []);

  // Update form state helper
  const updateForm = useCallback(<K extends keyof OrderFormState>(
    field: K,
    value: OrderFormState[K]
  ) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  }, []);

  // Handle customer selection
  const handleCustomerSelect = useCallback((customer: Customer | null) => {
    setFormState(prev => {
      const updated = { ...prev, selectedCustomer: customer };
      
      // If customer selected, pre-fill addresses
      if (customer) {
        const address: Address = {
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          street: customer.street || '',
          houseNumber: customer.houseNumber || '',
          zipcode: customer.zipcode || '',
          city: customer.city || '',
          country: customer.country || 'Nederland',
          phone: customer.phone || '',
        };
        updated.billingAddress = address;
        updated.shippingAddress = address;
        updated.newCustomerData = null;
      }
      
      return updated;
    });
  }, []);

  // Handle new customer data change
  const handleNewCustomerDataChange = useCallback((data: NewCustomerData | null) => {
    setFormState(prev => {
      const updated = { ...prev, newCustomerData: data };
      
      // Pre-fill billing address with new customer data
      if (data) {
        updated.billingAddress = {
          ...prev.billingAddress,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phone: data.phone || '',
        };
      }
      
      return updated;
    });
  }, []);

  // Handle address change
  const handleAddressChange = useCallback((
    type: 'billing' | 'shipping',
    field: keyof Address,
    value: string
  ) => {
    setFormState(prev => {
      const addressKey = type === 'billing' ? 'billingAddress' : 'shippingAddress';
      const updated = {
        ...prev,
        [addressKey]: { ...prev[addressKey], [field]: value },
      };
      
      // If same as shipping is checked and billing changed, sync shipping
      if (type === 'billing' && prev.sameAsShipping) {
        updated.shippingAddress = { ...updated.billingAddress };
      }
      
      return updated;
    });
  }, []);

  // Handle same as shipping toggle
  const handleSameAsShippingChange = useCallback((checked: boolean) => {
    setFormState(prev => ({
      ...prev,
      sameAsShipping: checked,
      shippingAddress: checked ? { ...prev.billingAddress } : prev.shippingAddress,
    }));
  }, []);

  // Copy billing to shipping
  const handleCopyBillingToShipping = useCallback(() => {
    setFormState(prev => ({
      ...prev,
      shippingAddress: { ...prev.billingAddress },
    }));
  }, []);

  const previewCouponDiscount = useCallback(async (code: string): Promise<number> => {
    if (formState.items.length === 0) {
      throw new Error(t('orders.create.validation.noItems'));
    }

    const response = await api.post<{
      success: boolean;
      data: { discount: number; couponCode: string; subtotalCents: number };
    }>('/admin/orders/coupon-preview', {
      couponCode: code,
      customerId: formState.selectedCustomer?.id,
      items: formState.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.unitPrice,
      })),
    });

    return unwrapData(response).discount;
  }, [formState.items, formState.selectedCustomer?.id, t]);

  const handleApplyCoupon = useCallback(async () => {
    const trimmed = formState.couponCode.trim().toUpperCase();
    if (!trimmed) {
      setCouponApplied(false);
      setCouponDiscountCents(0);
      setCouponError(null);
      return;
    }

    setCouponApplying(true);
    setCouponError(null);
    try {
      const discount = await previewCouponDiscount(trimmed);
      updateForm('couponCode', trimmed);
      setCouponDiscountCents(discount);
      setCouponApplied(true);
    } catch (err) {
      setCouponApplied(false);
      setCouponDiscountCents(0);
      setCouponError(
        err instanceof ApiException
          ? err.message
          : err instanceof Error
            ? err.message
            : t('orders.detail.couponError'),
      );
    } finally {
      setCouponApplying(false);
    }
  }, [formState.couponCode, previewCouponDiscount, t, updateForm]);

  const handleRemoveCoupon = useCallback(() => {
    updateForm('couponCode', '');
    setCouponApplied(false);
    setCouponDiscountCents(0);
    setCouponError(null);
  }, [updateForm]);

  useEffect(() => {
    if (!couponApplied || !formState.couponCode.trim()) {
      return;
    }

    let cancelled = false;
    const run = async (): Promise<void> => {
      try {
        setCouponError(null);
        const discount = await previewCouponDiscount(
          formState.couponCode.trim().toUpperCase(),
        );
        if (!cancelled) {
          setCouponDiscountCents(discount);
        }
      } catch (err) {
        if (!cancelled) {
          setCouponDiscountCents(0);
          setCouponError(
            err instanceof ApiException
              ? err.message
              : err instanceof Error
                ? err.message
                : t('orders.detail.couponError'),
          );
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    couponApplied,
    formState.couponCode,
    formState.items,
    formState.selectedCustomer?.id,
    previewCouponDiscount,
    t,
  ]);

  // Calculate totals
  const subtotal = formState.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const selectedShipping = shippingMethods.find(m => m.id === formState.shippingMethod);
  const shippingCost = selectedShipping?.price || 0;
  
  // Free shipping check
  const qualifiesForFreeShipping = shippingSettings.freeEnabled && 
    subtotal >= shippingSettings.freeThreshold && 
    formState.shippingMethod !== 'pickup';
  const finalShippingCost = qualifiesForFreeShipping ? 0 : shippingCost;

  const total = Math.max(0, subtotal + finalShippingCost - couponDiscountCents);

  // Validate form
  const validateForm = (): string | null => {
    // Customer validation
    if (!formState.selectedCustomer && !formState.newCustomerData) {
      return t('orders.create.validation.noCustomer');
    }
    
    if (formState.newCustomerData) {
      if (!formState.newCustomerData.firstName || !formState.newCustomerData.lastName) {
        return t('orders.create.validation.customerName');
      }
      if (!formState.newCustomerData.email) {
        return t('orders.create.validation.customerEmail');
      }
    }

    // Items validation
    if (formState.items.length === 0) {
      return t('orders.create.validation.noItems');
    }

    // Address validation
    const { billingAddress, shippingAddress } = formState;
    if (!billingAddress.firstName || !billingAddress.lastName) {
      return t('orders.create.validation.billingName');
    }
    if (!billingAddress.street || !billingAddress.houseNumber) {
      return t('orders.create.validation.billingAddress');
    }
    if (!billingAddress.zipcode || !billingAddress.city) {
      return t('orders.create.validation.billingZipCity');
    }

    // Shipping address validation (if different)
    if (!formState.sameAsShipping && formState.shippingMethod !== 'pickup') {
      if (!shippingAddress.firstName || !shippingAddress.lastName) {
        return t('orders.create.validation.shippingName');
      }
      if (!shippingAddress.street || !shippingAddress.houseNumber) {
        return t('orders.create.validation.shippingAddress');
      }
      if (!shippingAddress.zipcode || !shippingAddress.city) {
        return t('orders.create.validation.shippingZipCity');
      }
    }

    return null;
  };

  const handleSubmit = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    onSavingChange(true);
    setError(null);

    try {
      const tenantParam = getTenantParam();
      const params = new URLSearchParams();
      if (tenantParam) params.set('tenant', tenantParam);

      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        throw new Error(t('orders.create.csrfError'));
      }

      const requestBody = {
        // Customer
        customerId: formState.selectedCustomer?.id || undefined,
        newCustomer: formState.newCustomerData || undefined,

        // Items
        items: formState.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.unitPrice,
        })),

        // Addresses
        billingAddress: formState.billingAddress,
        shippingAddress: formState.sameAsShipping
          ? formState.billingAddress
          : formState.shippingAddress,

        // Shipping & Payment
        shippingMethod: formState.shippingMethod,
        paymentStatus: formState.paymentStatus,
        adminPaymentMethod: formState.adminPaymentMethod,
        adminNote: formState.adminNote || undefined,
        ...(formState.couponCode.trim()
          ? { couponCode: formState.couponCode.trim() }
          : {}),
      };

      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message ?? data.message ?? t('orders.create.submitError'));
      }

      const data = await response.json();

      invalidateResource('orders');
      const created = unwrapData<{ order: { orderId: string } }>(data);
      onCreated(created.order.orderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('orders.create.genericError'));
    } finally {
      setSaving(false);
      onSavingChange(false);
    }
  }, [formState, onCreated, onSavingChange, t]);

  useEffect(() => {
    registerSubmit(handleSubmit);
    return () => registerSubmit(null);
  }, [handleSubmit, registerSubmit]);

  return (
    <div className="orders-workspace-detail-card orders-workspace-detail-card--create">
      {error && (
        <div className="admin-alert admin-alert--error" role="alert">
          <AlertTriangle size={20} strokeWidth={1.5} aria-hidden />
          <p>{error}</p>
        </div>
      )}

      <div className="order-create-columns">
        <section className="products-card order-create-column">
          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.create.sections.customer')}</span>
            </div>
            <div className="products-workspace-module-body">
              <CustomerPicker
                selectedCustomer={formState.selectedCustomer}
                onSelect={handleCustomerSelect}
                newCustomerData={formState.newCustomerData}
                onNewCustomerDataChange={handleNewCustomerDataChange}
              />
            </div>
          </div>

          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.create.sections.products')}</span>
            </div>
            <div className="products-workspace-module-body">
              <ProductPicker
                items={formState.items}
                onItemsChange={(items) => updateForm('items', items)}
              />
            </div>
          </div>

          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.create.sections.addresses')}</span>
            </div>
            <div className="products-workspace-module-body">
              <div className="address-section">
                <div className="products-editor-label orders-workspace-module-label">
                  {t('orders.create.address.billingTitle')}
                </div>
                <div className="products-detail-form">
                  <div className="products-workspace-form-grid">
                    <div className="products-workspace-form-block">
                      <label className="products-editor-label" htmlFor="billing-firstName">{t('orders.create.address.firstName')}</label>
                      <input
                        id="billing-firstName"
                        type="text"
                        className="form-input products-workspace-field"
                        value={formState.billingAddress.firstName}
                        onInput={(e) => handleAddressChange('billing', 'firstName', (e.target as HTMLInputElement).value)}
                        required
                      />
                    </div>
                    <div className="products-workspace-form-block">
                      <label className="products-editor-label" htmlFor="billing-lastName">{t('orders.create.address.lastName')}</label>
                      <input
                        id="billing-lastName"
                        type="text"
                        className="form-input products-workspace-field"
                        value={formState.billingAddress.lastName}
                        onInput={(e) => handleAddressChange('billing', 'lastName', (e.target as HTMLInputElement).value)}
                        required
                      />
                    </div>
                    <div className="products-workspace-form-block">
                      <label className="products-editor-label" htmlFor="billing-street">{t('orders.create.address.street')}</label>
                      <input
                        id="billing-street"
                        type="text"
                        className="form-input products-workspace-field"
                        value={formState.billingAddress.street}
                        onInput={(e) => handleAddressChange('billing', 'street', (e.target as HTMLInputElement).value)}
                        required
                      />
                    </div>
                    <div className="products-workspace-form-block">
                      <label className="products-editor-label" htmlFor="billing-houseNumber">{t('orders.create.address.houseNumber')}</label>
                      <input
                        id="billing-houseNumber"
                        type="text"
                        className="form-input products-workspace-field"
                        value={formState.billingAddress.houseNumber}
                        onInput={(e) => handleAddressChange('billing', 'houseNumber', (e.target as HTMLInputElement).value)}
                        required
                      />
                    </div>
                    <div className="products-workspace-form-block">
                      <label className="products-editor-label" htmlFor="billing-zipcode">{t('orders.create.address.zipcode')}</label>
                      <input
                        id="billing-zipcode"
                        type="text"
                        className="form-input products-workspace-field"
                        value={formState.billingAddress.zipcode}
                        onInput={(e) => handleAddressChange('billing', 'zipcode', (e.target as HTMLInputElement).value)}
                        required
                      />
                    </div>
                    <div className="products-workspace-form-block">
                      <label className="products-editor-label" htmlFor="billing-city">{t('orders.create.address.city')}</label>
                      <input
                        id="billing-city"
                        type="text"
                        className="form-input products-workspace-field"
                        value={formState.billingAddress.city}
                        onInput={(e) => handleAddressChange('billing', 'city', (e.target as HTMLInputElement).value)}
                        required
                      />
                    </div>
                    <div className="products-workspace-form-block">
                      <label className="products-editor-label" htmlFor="billing-country">{t('orders.create.address.country')}</label>
                      <input
                        id="billing-country"
                        type="text"
                        className="form-input products-workspace-field"
                        value={formState.billingAddress.country}
                        onInput={(e) => handleAddressChange('billing', 'country', (e.target as HTMLInputElement).value)}
                      />
                    </div>
                    <div className="products-workspace-form-block">
                      <label className="products-editor-label" htmlFor="billing-phone">{t('orders.create.address.phone')}</label>
                      <input
                        id="billing-phone"
                        type="tel"
                        className="form-input products-workspace-field"
                        value={formState.billingAddress.phone || ''}
                        onInput={(e) => handleAddressChange('billing', 'phone', (e.target as HTMLInputElement).value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {formState.shippingMethod !== 'pickup' && (
                <div className="address-section">
                  <div className="shipping-address-header">
                    <h3 className="shipping-address-title">{t('orders.create.address.shippingTitle')}</h3>
                    {!formState.sameAsShipping && (
                      <button
                        type="button"
                        onClick={handleCopyBillingToShipping}
                        className="address-form-copy-btn"
                      >
                        <Copy size={14} aria-hidden />
                        {t('orders.create.address.copyBilling')}
                      </button>
                    )}
                  </div>

                  <label className="same-as-billing-label">
                    <input
                      type="checkbox"
                      checked={formState.sameAsShipping}
                      onChange={(e) => handleSameAsShippingChange((e.target as HTMLInputElement).checked)}
                    />
                    <span>{t('orders.create.address.sameAsBilling')}</span>
                  </label>

                  {!formState.sameAsShipping && (
                    <div className="products-detail-form">
                      <div className="products-workspace-form-grid">
                        <div className="products-workspace-form-block">
                          <label className="products-editor-label" htmlFor="shipping-firstName">{t('orders.create.address.firstName')}</label>
                          <input
                            id="shipping-firstName"
                            type="text"
                            className="form-input products-workspace-field"
                            value={formState.shippingAddress.firstName}
                            onInput={(e) => handleAddressChange('shipping', 'firstName', (e.target as HTMLInputElement).value)}
                            required
                          />
                        </div>
                        <div className="products-workspace-form-block">
                          <label className="products-editor-label" htmlFor="shipping-lastName">{t('orders.create.address.lastName')}</label>
                          <input
                            id="shipping-lastName"
                            type="text"
                            className="form-input products-workspace-field"
                            value={formState.shippingAddress.lastName}
                            onInput={(e) => handleAddressChange('shipping', 'lastName', (e.target as HTMLInputElement).value)}
                            required
                          />
                        </div>
                        <div className="products-workspace-form-block">
                          <label className="products-editor-label" htmlFor="shipping-street">{t('orders.create.address.street')}</label>
                          <input
                            id="shipping-street"
                            type="text"
                            className="form-input products-workspace-field"
                            value={formState.shippingAddress.street}
                            onInput={(e) => handleAddressChange('shipping', 'street', (e.target as HTMLInputElement).value)}
                            required
                          />
                        </div>
                        <div className="products-workspace-form-block">
                          <label className="products-editor-label" htmlFor="shipping-houseNumber">{t('orders.create.address.houseNumber')}</label>
                          <input
                            id="shipping-houseNumber"
                            type="text"
                            className="form-input products-workspace-field"
                            value={formState.shippingAddress.houseNumber}
                            onInput={(e) => handleAddressChange('shipping', 'houseNumber', (e.target as HTMLInputElement).value)}
                            required
                          />
                        </div>
                        <div className="products-workspace-form-block">
                          <label className="products-editor-label" htmlFor="shipping-zipcode">{t('orders.create.address.zipcode')}</label>
                          <input
                            id="shipping-zipcode"
                            type="text"
                            className="form-input products-workspace-field"
                            value={formState.shippingAddress.zipcode}
                            onInput={(e) => handleAddressChange('shipping', 'zipcode', (e.target as HTMLInputElement).value)}
                            required
                          />
                        </div>
                        <div className="products-workspace-form-block">
                          <label className="products-editor-label" htmlFor="shipping-city">{t('orders.create.address.city')}</label>
                          <input
                            id="shipping-city"
                            type="text"
                            className="form-input products-workspace-field"
                            value={formState.shippingAddress.city}
                            onInput={(e) => handleAddressChange('shipping', 'city', (e.target as HTMLInputElement).value)}
                            required
                          />
                        </div>
                        <div className="products-workspace-form-block">
                          <label className="products-editor-label" htmlFor="shipping-country">{t('orders.create.address.country')}</label>
                          <input
                            id="shipping-country"
                            type="text"
                            className="form-input products-workspace-field"
                            value={formState.shippingAddress.country}
                            onInput={(e) => handleAddressChange('shipping', 'country', (e.target as HTMLInputElement).value)}
                          />
                        </div>
                        <div className="products-workspace-form-block">
                          <label className="products-editor-label" htmlFor="shipping-phone">{t('orders.create.address.phone')}</label>
                          <input
                            id="shipping-phone"
                            type="tel"
                            className="form-input products-workspace-field"
                            value={formState.shippingAddress.phone || ''}
                            onInput={(e) => handleAddressChange('shipping', 'phone', (e.target as HTMLInputElement).value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="products-card order-create-column">
          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.create.sections.shipping')}</span>
            </div>
            <div className="products-workspace-module-body">
              <div className="products-detail-form">
                <div className="products-workspace-form-block">
                  <label className="products-editor-label" htmlFor="order-create-shipping-method">
                    {t('orders.create.shipping.selectMethod')}
                  </label>
                  <select
                    id="order-create-shipping-method"
                    className="form-select products-workspace-field"
                    value={formState.shippingMethod}
                    onChange={(e) => updateForm('shippingMethod', (e.target as HTMLSelectElement).value)}
                    title={t('orders.create.shipping.selectMethod')}
                  >
                    {shippingMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name} - {method.price === 0 ? t('orders.create.shipping.free') : formatCents(method.price, locale)}
                      </option>
                    ))}
                  </select>
                </div>
                {qualifiesForFreeShipping && formState.shippingMethod !== 'pickup' && (
                  <div className="free-shipping-badge">
                    <CheckCircle size={20} strokeWidth={1.5} aria-hidden />
                    <span>
                      {t('orders.create.shipping.freeFrom', { threshold: formatCents(shippingSettings.freeThreshold, locale) })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.create.sections.payment')}</span>
            </div>
            <div className="products-workspace-module-body">
              <div className="products-detail-form">
                <div className="products-workspace-form-grid">
                  <div className="products-workspace-form-block">
                    <label className="products-editor-label" htmlFor="order-create-payment-status">
                      {t('orders.create.payment.selectStatus')}
                    </label>
                    <select
                      id="order-create-payment-status"
                      className="form-select products-workspace-field"
                      value={formState.paymentStatus}
                      onChange={(e) => updateForm('paymentStatus', (e.target as HTMLSelectElement).value as 'pending' | 'paid' | 'invoice')}
                      title={t('orders.create.payment.selectStatus')}
                    >
                      <option value="pending">{t('orders.create.payment.pending')}</option>
                      <option value="paid">{t('orders.create.payment.paid')}</option>
                      <option value="invoice">{t('orders.create.payment.invoice')}</option>
                    </select>
                  </div>
                  <div className="products-workspace-form-block">
                    <label className="products-editor-label" htmlFor="admin-payment-method">
                      {t('orders.create.payment.adminMethodLabel')}
                    </label>
                    <select
                      id="admin-payment-method"
                      className="form-select products-workspace-field"
                      value={formState.adminPaymentMethod}
                      onChange={(e) =>
                        updateForm(
                          'adminPaymentMethod',
                          (e.target as HTMLSelectElement).value as AdminOrderPaymentMethod,
                        )
                      }
                      title={t('orders.create.payment.adminMethodLabel')}
                    >
                      <option value="admin_invoice">{t('orders.create.payment.adminMethodInvoice')}</option>
                      <option value="admin_cash">{t('orders.create.payment.adminMethodCash')}</option>
                      <option value="admin_comp">{t('orders.create.payment.adminMethodComp')}</option>
                    </select>
                  </div>
                </div>
                <p className="products-editor-hint">{t('orders.create.payment.adminMethodHint')}</p>
                <p className="products-editor-hint">
                  {formState.paymentStatus === 'paid' && t('orders.create.payment.hintPaid')}
                  {formState.paymentStatus === 'pending' && t('orders.create.payment.hintPending')}
                  {formState.paymentStatus === 'invoice' && t('orders.create.payment.hintInvoice')}
                </p>
                <div className="products-workspace-form-grid">
                  <div className="products-editor-field products-editor-field--full">
                    <label className="products-editor-label" htmlFor="order-create-coupon-code">
                      {t('orders.create.coupon.label')}
                    </label>
                    {couponApplied && formState.couponCode.trim() ? (
                      <div className="order-create-coupon-applied">
                        <span className="order-create-coupon-applied__code">
                          {formState.couponCode.trim().toUpperCase()}
                        </span>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={handleRemoveCoupon}
                        >
                          {t('orders.detail.couponRemove')}
                        </button>
                      </div>
                    ) : (
                      <div className="order-create-coupon-row">
                        <input
                          id="order-create-coupon-code"
                          type="text"
                          className="form-input products-workspace-field"
                          value={formState.couponCode}
                          onInput={(e) => {
                            setCouponApplied(false);
                            setCouponDiscountCents(0);
                            setCouponError(null);
                            updateForm('couponCode', (e.target as HTMLInputElement).value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyCoupon();
                            }
                          }}
                          placeholder={t('orders.create.coupon.placeholder')}
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <Button
                          variant="success"
                          size="sm"
                          type="button"
                          onClick={() => void handleApplyCoupon()}
                          disabled={couponApplying || !formState.couponCode.trim()}
                          loading={couponApplying}
                        >
                          {t('orders.detail.couponApply')}
                        </Button>
                      </div>
                    )}
                    {couponError && (
                      <p className="products-editor-hint text-error">{couponError}</p>
                    )}
                    <p className="products-editor-hint">{t('orders.create.coupon.hint')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.create.sections.note')}</span>
            </div>
            <div className="products-workspace-module-body">
              <div className="products-detail-form">
                <div className="products-workspace-form-block">
                  <textarea
                    id="order-create-admin-note"
                    className="form-textarea products-workspace-field"
                    aria-label={t('orders.create.sections.note')}
                    value={formState.adminNote}
                    onInput={(e) => updateForm('adminNote', (e.target as HTMLTextAreaElement).value)}
                    placeholder={t('orders.create.note.placeholder')}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="products-workspace-section products-workspace-section--collapsible">
            <div className="products-workspace-collapsible-header">
              <span className="products-workspace-section__title">{t('orders.create.summary.title')}</span>
            </div>
            <div className="products-workspace-module-body orders-workspace-totals-body">
              <div className="order-totals order-totals--right">
                <div className="order-totals-row">
                  <span>
                    {formState.items.length === 1
                      ? t('orders.create.summary.subtotalOne', { count: formState.items.length })
                      : t('orders.create.summary.subtotalOther', { count: formState.items.length })}
                  </span>
                  <strong>{formatCents(subtotal, locale)}</strong>
                </div>
                <div className="order-totals-row">
                  <span>{t('orders.create.summary.shippingCosts')}</span>
                  <strong>
                    {qualifiesForFreeShipping && shippingCost > 0 ? (
                      <>
                        <span className="price-strikethrough">
                          {formatCents(shippingCost, locale)}
                        </span>
                        {' '}
                        <span className="price-free">{t('orders.create.shipping.free')}</span>
                      </>
                    ) : shippingCost === 0 ? (
                      t('orders.create.shipping.free')
                    ) : (
                      formatCents(shippingCost, locale)
                    )}
                  </strong>
                </div>
                {couponDiscountCents > 0 && (
                  <div className="order-totals-row">
                    <span>{t('orders.detail.discount')}</span>
                    <strong>-{formatCents(couponDiscountCents, locale)}</strong>
                  </div>
                )}
                <div className="order-totals-row order-totals-row--total">
                  <span>{t('orders.create.summary.total')}</span>
                  <strong>{formatCents(total, locale)}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default OrderCreateWorkspaceDetail;
