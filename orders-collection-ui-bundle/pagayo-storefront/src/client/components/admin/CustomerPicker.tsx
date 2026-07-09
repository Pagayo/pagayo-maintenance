/**
 * CustomerPicker Component
 * Search and select existing customers or create new ones inline
 * Used in the orders workspace (manual order creation) and related admin flows.
 */
import { FunctionalComponent } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { X, Plus, User, Mail, Phone, MapPin } from 'lucide-react';
import { Spinner } from '../../components';
import { unwrapData } from '../../utils/unwrapApi';
import { WorkspaceSearchInput } from './shared/WorkspaceSearchInput';
import { useI18n } from '../../i18n';

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  street?: string;
  houseNumber?: string;
  zipcode?: string;
  city?: string;
  country?: string;
}

export interface NewCustomerData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  street?: string;
  houseNumber?: string;
  zipcode?: string;
  city?: string;
  country?: string;
}

interface CustomerPickerProps {
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer | null) => void;
  onNewCustomer?: (data: NewCustomerData) => void;
  newCustomerData?: NewCustomerData | null;
  onNewCustomerDataChange?: (data: NewCustomerData | null) => void;
}

/**
 * Get tenant parameter from URL
 */
function getTenantParam(): string {
  return new URLSearchParams(window.location.search).get('tenant') || '';
}

/**
 * Debounce hook
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * CustomerPicker Component
 */
export const CustomerPicker: FunctionalComponent<CustomerPickerProps> = ({
  selectedCustomer,
  onSelect,
  // onNewCustomer is available for future use but not currently needed
   
  onNewCustomer: _onNewCustomer,
  newCustomerData,
  onNewCustomerDataChange,
}) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [formData, setFormData] = useState<NewCustomerData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    street: '',
    houseNumber: '',
    zipcode: '',
    city: '',
    country: 'Nederland',
  });
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search customers when query changes
  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const searchCustomers = async () => {
      setLoading(true);
      try {
        const tenantParam = getTenantParam();
        const params = new URLSearchParams();
        if (tenantParam) params.set('tenant', tenantParam);
        params.set('search', debouncedSearch);

        const response = await fetch(`/api/admin/customers?${params.toString()}`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setSearchResults(unwrapData<Customer[]>(data));
        }
      } catch (err) {
        console.error('Failed to search customers:', err);
      } finally {
        setLoading(false);
      }
    };

    searchCustomers();
  }, [debouncedSearch]);

  // Handle customer selection
  const handleSelectCustomer = useCallback((customer: Customer) => {
    onSelect(customer);
    setShowDropdown(false);
    setSearchQuery('');
    setShowNewCustomerForm(false);
    if (onNewCustomerDataChange) {
      onNewCustomerDataChange(null);
    }
  }, [onSelect, onNewCustomerDataChange]);

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    onSelect(null);
    setSearchQuery('');
    if (onNewCustomerDataChange) {
      onNewCustomerDataChange(null);
    }
    setShowNewCustomerForm(false);
  }, [onSelect, onNewCustomerDataChange]);

  // Handle new customer form changes
  const handleFormChange = useCallback((field: keyof NewCustomerData, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    if (onNewCustomerDataChange) {
      onNewCustomerDataChange(updated);
    }
  }, [formData, onNewCustomerDataChange]);

  // Toggle new customer form
  const handleToggleNewCustomer = useCallback(() => {
    setShowNewCustomerForm(!showNewCustomerForm);
    setShowDropdown(false);
    onSelect(null);
    if (!showNewCustomerForm) {
      // Opening form - initialize data
      if (onNewCustomerDataChange) {
        onNewCustomerDataChange(formData);
      }
    } else {
      // Closing form - clear data
      if (onNewCustomerDataChange) {
        onNewCustomerDataChange(null);
      }
    }
  }, [showNewCustomerForm, onSelect, onNewCustomerDataChange, formData]);

  // Sync external newCustomerData to formData
  useEffect(() => {
    if (newCustomerData) {
      setFormData(newCustomerData);
      setShowNewCustomerForm(true);
    }
  }, []);

  // If customer is selected, show their info
  if (selectedCustomer) {
    return (
      <div className="customer-selected-card">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-05 mb-2">
              <User size={20} className="text-accent" />
              <strong className="text-lg">
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </strong>
            </div>
            <div className="text-secondary text-sm flex-col gap-025">
              <span className="flex items-center gap-025">
                <Mail size={14} /> {selectedCustomer.email}
              </span>
              {selectedCustomer.phone && (
                <span className="flex items-center gap-025">
                  <Phone size={14} /> {selectedCustomer.phone}
                </span>
              )}
              {selectedCustomer.city && (
                <span className="flex items-center gap-025">
                  <MapPin size={14} /> {selectedCustomer.city}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn-icon text-secondary"
            onClick={handleClearSelection}
            title={t('orders.create.newCustomerForm.selectDifferentCustomer')}
          >
            <X size={20} />
          </button>
        </div>
      </div>
    );
  }

  // If new customer form is shown
  if (showNewCustomerForm) {
    return (
      <div className="customer-new-form-card">
        <div className="flex justify-between items-center mb-4">
          <h4 className="m-0 flex items-center gap-05 font-semibold">
            <Plus size={20} className="text-accent" aria-hidden />
            {t('orders.create.newCustomer')}
          </h4>
          <button
            type="button"
            className="btn-icon text-secondary"
            onClick={handleToggleNewCustomer}
            title={t('orders.create.newCustomerForm.cancelAria')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="products-detail-form">
          <div className="products-workspace-form-grid">
            <div className="products-editor-field">
              <label className="products-editor-label" htmlFor="customer-picker-first-name">
                {t('orders.create.address.firstName')}
              </label>
              <input
                id="customer-picker-first-name"
                type="text"
                className="form-input products-workspace-field"
                value={formData.firstName}
                onInput={(e) => handleFormChange('firstName', (e.target as HTMLInputElement).value)}
                placeholder={t('orders.create.newCustomerForm.firstNamePlaceholder')}
                required
              />
            </div>
            <div className="products-editor-field">
              <label className="products-editor-label" htmlFor="customer-picker-last-name">
                {t('orders.create.address.lastName')}
              </label>
              <input
                id="customer-picker-last-name"
                type="text"
                className="form-input products-workspace-field"
                value={formData.lastName}
                onInput={(e) => handleFormChange('lastName', (e.target as HTMLInputElement).value)}
                placeholder={t('orders.create.newCustomerForm.lastNamePlaceholder')}
                required
              />
            </div>
            <div className="products-editor-field products-editor-field--full">
              <label className="products-editor-label" htmlFor="customer-picker-email">
                {t('orders.create.newCustomerForm.emailLabel')}
              </label>
              <input
                id="customer-picker-email"
                type="email"
                className="form-input products-workspace-field"
                value={formData.email}
                onInput={(e) => handleFormChange('email', (e.target as HTMLInputElement).value)}
                placeholder={t('orders.create.newCustomerForm.emailPlaceholder')}
                required
              />
            </div>
            <div className="products-editor-field products-editor-field--full">
              <label className="products-editor-label" htmlFor="customer-picker-phone">
                {t('orders.create.address.phone')}
              </label>
              <input
                id="customer-picker-phone"
                type="tel"
                className="form-input products-workspace-field"
                value={formData.phone || ''}
                onInput={(e) => handleFormChange('phone', (e.target as HTMLInputElement).value)}
                placeholder={t('orders.create.newCustomerForm.phonePlaceholder')}
              />
            </div>
          </div>
        </div>

        <p className="products-editor-hint">{t('orders.create.newCustomerForm.hintFooter')}</p>
      </div>
    );
  }

  // Default: show search
  return (
    <div className="customer-picker product-search-section" ref={wrapperRef}>
      <div className="flex gap-05">
        <div className="flex-1">
          <WorkspaceSearchInput
            id="customer-picker-search"
            value={searchQuery}
            placeholder={t('orders.create.customerSearchPlaceholder')}
            onInput={(value) => {
              setSearchQuery(value);
              setShowDropdown(true);
            }}
            onFocus={() => searchQuery.length >= 2 && setShowDropdown(true)}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary flex items-center gap-025"
          onClick={handleToggleNewCustomer}
          title={t('orders.create.newCustomer')}
        >
          <Plus size={20} />
          {t('common.create')}
        </button>
      </div>

      {/* Search results dropdown */}
      {showDropdown && (searchQuery.length >= 2 || loading) && (
        <div className="product-search-results">
          {loading ? (
            <div className="flex-col items-center p-5">
              <Spinner size="sm" />
              <p className="mt-2 text-secondary">{t('orders.create.customerSearchLoading')}</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-5 text-center text-secondary">
              <p>{t('orders.create.customerNoResults')}</p>
              <button
                type="button"
                className="btn btn-link mt-2"
                onClick={handleToggleNewCustomer}
              >
                <Plus size={20} className="mr-1" />
                {t('orders.create.customerOpenNewFromEmpty')}
              </button>
            </div>
          ) : (
            searchResults.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className="product-search-result"
                onClick={() => handleSelectCustomer(customer)}
              >
                <div>
                  <div className="font-medium">
                    {customer.firstName} {customer.lastName}
                  </div>
                  <div className="text-sm text-secondary flex gap-075 mt-025">
                    <span>{customer.email}</span>
                    {customer.city && <span>• {customer.city}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerPicker;
