/**
 * ProductPicker Component
 * Search and add products to an order with quantity management
 * Used in the orders workspace (manual order creation) and related admin flows.
 */
import { FunctionalComponent } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { Plus, Minus, X, Package, AlertTriangle } from 'lucide-react';
import { Spinner } from '../../components';
import { formatCents, formatCentsForInput, parseToCents } from '../../utils/money';
import { unwrapList } from '../../utils/unwrapApi';
import { buildR2ImageVariantSrcSet } from '../../utils/image-variants';
import { useI18n } from '../../i18n';
import { WorkspaceSearchInput } from './shared/WorkspaceSearchInput';
import { isSubscriptionProductType } from '../../../lib/subscription-scope';
import { productTracksInventory } from '../../../lib/product/storefront-stock';

export interface Product {
  id: number;
  title: string;
  slug: string;
  sku: string | null;
  priceCents: number;
  stock: number;
  img: string | null;
  isActive: boolean;
  /** Van GET /api/admin/products (`p.productType`); nodig om abonnementen niet op voorraad te blokkeren. */
  productType?: string | null;
}

/** Alleen voorraad-trackende producten blokkeren bij 0 voorraad. */
function isInventoryStockEnforced(product: Product): boolean {
  return productTracksInventory(product.productType);
}

export interface OrderItem {
  productId: number;
  productTitle: string;
  productSku: string | null;
  quantity: number;
  unitPrice: number; // in cents
  totalPrice: number; // in cents
  /** Catalog price at add-time; UI hint only, not sent to API */
  catalogUnitPriceCents?: number;
}

interface ProductPickerProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
}

/**
 * Get tenant parameter from URL
 */
function getTenantParam(): string {
  return new URLSearchParams(window.location.search).get('tenant') || '';
}

const ADMIN_PRODUCTS_PAGE_LIMIT = 100;

/**
 * Admin productlijst is gepagineerd (default 25, max 100). Eerste pagina alleen is onvoldoende
 * voor handmatige orders in grote catalogi — anders ontbreken o.a. abonnementen in client-side zoeken.
 */
async function fetchAllAdminProducts(tenantParam: string): Promise<Product[]> {
  const base = new URLSearchParams();
  if (tenantParam) {
    base.set('tenant', tenantParam);
  }
  base.set('limit', String(ADMIN_PRODUCTS_PAGE_LIMIT));

  const firstParams = new URLSearchParams(base);
  firstParams.set('page', '1');
  const firstUrl = `/api/admin/products?${firstParams.toString()}`;
  const firstRes = await fetch(firstUrl, { credentials: 'include' });
  if (!firstRes.ok) {
    return [];
  }
  const firstJson = await firstRes.json();
  const first = unwrapList<Product>(firstJson);
  const { total, limit } = first;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (totalPages <= 1) {
    return first.items;
  }

  const merged: Product[] = [...first.items];
  for (let page = 2; page <= totalPages; page += 1) {
    const params = new URLSearchParams(base);
    params.set('page', String(page));
    const response = await fetch(`/api/admin/products?${params.toString()}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      break;
    }
    const json = await response.json();
    merged.push(...unwrapList<Product>(json).items);
  }

  return merged;
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
 * ProductPicker Component
 */
export const ProductPicker: FunctionalComponent<ProductPickerProps> = ({
  items,
  onItemsChange,
}) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
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

  // Volledige catalogus (alle pagina's) — nodig voor client-side zoeken in grote tenants
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const tenantParam = getTenantParam();
        const merged = await fetchAllAdminProducts(tenantParam);
        setAllProducts(merged);
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setInitialLoading(false);
      }
    };

    void fetchProducts();
  }, []);

  // Filter products when search query changes
  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    const query = debouncedSearch.toLowerCase();
    const filtered = allProducts.filter(
      (p) =>
        p.isActive &&
        (p.title.toLowerCase().includes(query) ||
          (p.sku && p.sku.toLowerCase().includes(query)))
    );
    setSearchResults(filtered.slice(0, 10)); // Limit to 10 results
    setLoading(false);
  }, [debouncedSearch, allProducts]);

  // Add product to items
  const handleAddProduct = useCallback((product: Product) => {
    const existingIndex = items.findIndex((item) => item.productId === product.id);
    
    if (existingIndex >= 0) {
      // Increase quantity if already in list
      const updated = [...items];
      const newQty = updated[existingIndex].quantity + 1;
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        totalPrice: updated[existingIndex].unitPrice * newQty,
      };
      onItemsChange(updated);
    } else {
      // Add new item
      const newItem: OrderItem = {
        productId: product.id,
        productTitle: product.title,
        productSku: product.sku,
        quantity: 1,
        unitPrice: product.priceCents,
        totalPrice: product.priceCents,
        catalogUnitPriceCents: product.priceCents,
      };
      onItemsChange([...items, newItem]);
    }
    
    setShowDropdown(false);
    setSearchQuery('');
  }, [items, onItemsChange]);

  // Update item quantity
  const handleQuantityChange = useCallback((productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      // Remove item
      onItemsChange(items.filter((item) => item.productId !== productId));
    } else {
      // Update quantity
      const updated = items.map((item) => {
        if (item.productId === productId) {
          return {
            ...item,
            quantity: newQuantity,
            totalPrice: item.unitPrice * newQuantity,
          };
        }
        return item;
      });
      onItemsChange(updated);
    }
  }, [items, onItemsChange]);

  // Remove item
  const handleRemoveItem = useCallback((productId: number) => {
    onItemsChange(items.filter((item) => item.productId !== productId));
  }, [items, onItemsChange]);

  const handleUnitPriceChange = useCallback(
    (productId: number, euroInput: string) => {
      const unitPrice = Math.max(0, parseToCents(euroInput));
      const updated = items.map((item) => {
        if (item.productId !== productId) {
          return item;
        }
        return {
          ...item,
          unitPrice,
          totalPrice: unitPrice * item.quantity,
        };
      });
      onItemsChange(updated);
    },
    [items, onItemsChange],
  );

  // Calculate subtotal
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

  // Get product stock info (alleen relevant als voorraad voor dit producttype geldt)
  const getProductStock = (productId: number): number => {
    const product = allProducts.find((p) => p.id === productId);
    return product?.stock ?? 0;
  };

  const getCatalogProduct = (productId: number): Product | undefined =>
    allProducts.find((p) => p.id === productId);

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-5">
        <Spinner size="md" />
        <p className="mt-2 text-secondary">Producten laden...</p>
      </div>
    );
  }

  return (
    <div className="product-picker">
      {/* Search bar */}
      <div ref={wrapperRef} className="product-search-section mb-4">
        <WorkspaceSearchInput
          id="product-picker-search"
          value={searchQuery}
          placeholder={t('orders.create.productSearchPlaceholder')}
          onInput={(value) => {
            setSearchQuery(value);
            setShowDropdown(true);
          }}
          onFocus={() => searchQuery.length > 0 && setShowDropdown(true)}
        />

        {/* Search results dropdown */}
        {showDropdown && searchQuery.length > 0 && (
          <div className="product-search-results">
            {loading ? (
              <div className="flex justify-center p-5">
                <Spinner size="sm" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-5 text-center text-secondary">
                Geen producten gevonden
              </div>
            ) : (
              searchResults.map((product) => {
                const alreadyAdded = items.some((item) => item.productId === product.id);
                const enforceStock = isInventoryStockEnforced(product);
                const isOutOfStock = enforceStock && product.stock <= 0;

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => !isOutOfStock && handleAddProduct(product)}
                    className={`product-search-result${isOutOfStock ? ' opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isOutOfStock}
                  >
                    <div className="flex items-center gap-075">
                      {product.img ? (
                        <img 
                          src={buildR2ImageVariantSrcSet(product.img, [40, 80, 120, 240]).src}
                          srcset={buildR2ImageVariantSrcSet(product.img, [40, 80, 120, 240]).srcSet}
                          sizes="40px"
                          loading="lazy"
                          alt={product.title}
                          className="product-thumbnail"
                          decoding="async"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            if (img.dataset.variantFallbackDone === 'true') return;
                            img.dataset.variantFallbackDone = 'true';
                            img.src = product.img || '';
                            img.removeAttribute('srcset');
                            img.removeAttribute('sizes');
                          }}
                        />
                      ) : (
                        <div className="product-thumbnail-placeholder">
                          <Package size={20} className="text-secondary" />
                        </div>
                      )}
                      <div>
                        <div className="product-search-result-title">{product.title}</div>
                        <div className="product-search-result-meta">
                          {product.sku && <span>{product.sku} • </span>}
                          <span className={isOutOfStock ? 'text-error' : ''}>
                            {isSubscriptionProductType(product.productType)
                              ? t('orders.create.productMetaSubscription')
                              : t('orders.create.stockCount', { count: String(product.stock) })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCents(product.priceCents)}</div>
                      {alreadyAdded && (
                        <div className="text-xs text-success">✓ Toegevoegd</div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Selected items list */}
      {items.length === 0 ? (
        <div className="order-items-empty">
          <Package size={20} className="text-secondary mb-2" />
          <p className="m-0 text-secondary">
            Zoek en selecteer producten om toe te voegen
          </p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-center col-small">Aantal</th>
                <th className="text-right col-line-price">{t('orders.create.linePrice.label')}</th>
                <th className="text-right col-small">Totaal</th>
                <th className="col-narrow"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const catalog = getCatalogProduct(item.productId);
                const enforceStock = catalog ? isInventoryStockEnforced(catalog) : true;
                const stock = getProductStock(item.productId);
                const isOverStock = enforceStock && item.quantity > stock;

                return (
                  <tr key={item.productId}>
                    <td>
                      <div className="font-medium">{item.productTitle}</div>
                      {item.productSku && (
                        <div className="text-sm text-secondary">SKU: {item.productSku}</div>
                      )}
                      {isOverStock && (
                        <div className="text-xs text-warning flex items-center gap-025 mt-1">
                          <AlertTriangle size={12} />
                          Voorraad: {stock}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="quantity-controls justify-center">
                        <button
                          type="button"
                          className="qty-btn"
                          title="Aantal verlagen"
                          aria-label="Aantal verlagen"
                          onClick={() => handleQuantityChange(item.productId, item.quantity - 1)}
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          className="quantity-input"
                          value={item.quantity}
                          title="Aantal"
                          aria-label="Aantal"
                          placeholder="1"
                          onChange={(e) => {
                            const val = parseInt((e.target as HTMLInputElement).value) || 0;
                            handleQuantityChange(item.productId, val);
                          }}
                          min="1"
                        />
                        <button
                          type="button"
                          className="qty-btn"
                          title="Aantal verhogen"
                          aria-label="Aantal verhogen"
                          onClick={() => handleQuantityChange(item.productId, item.quantity + 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="text-right col-line-price">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="form-input order-line-price-input"
                        value={formatCentsForInput(item.unitPrice)}
                        title={t('orders.create.linePrice.label')}
                        aria-label={t('orders.create.linePrice.ariaLabel', {
                          product: item.productTitle,
                        })}
                        onChange={(e) =>
                          handleUnitPriceChange(
                            item.productId,
                            (e.target as HTMLInputElement).value,
                          )
                        }
                      />
                    </td>
                    <td className="text-right font-semibold">
                      {formatCents(item.totalPrice)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-icon text-error"
                        onClick={() => handleRemoveItem(item.productId)}
                        title="Verwijderen"
                      >
                        <X size={20} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="admin-table-footer">
                <td colSpan={3} className="text-right font-semibold">Subtotaal:</td>
                <td className="text-right font-bold text-lg">{formatCents(subtotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProductPicker;
