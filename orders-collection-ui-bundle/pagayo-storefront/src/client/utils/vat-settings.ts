/**
 * VAT Settings Hook
 *
 * Reads VAT-related fields from the shared `getPublicSettings()` helper so
 * the storefront makes at most one `/api/settings/public` fetch per session.
 * Used by CartSummary and other storefront components to display dynamic tax
 * rates and respect `vatLiable` exemption.
 *
 * @module utils/vat-settings
 */
import { useEffect, useState } from 'preact/hooks';
import { getPublicSettings } from './public-settings';

export interface VatSettingsPublic {
  /** Is this tenant VAT-liable? false = exempt */
  vatLiable: boolean;
  /** Default VAT rate as percentage (e.g. 21) */
  defaultRate: number;
  /** Localized tax label (BTW, MwSt, VAT, etc.) */
  taxLabel: string;
  /** Are product prices inclusive of VAT? */
  pricesIncludeVat: boolean;
}

const DEFAULT_VAT_SETTINGS: VatSettingsPublic = {
  vatLiable: true,
  defaultRate: 21,
  taxLabel: 'BTW',
  pricesIncludeVat: true,
};

/**
 * Whether VAT/tax should be shown in UI (labels, columns, line items).
 * When the tenant is not VAT-liable, hide all BTW presentation even if
 * legacy order lines still carry vatAmountCents.
 */
export function shouldPresentVatInUi(vatLiable: boolean): boolean {
  return vatLiable;
}

interface VatRate {
  name: string;
  rate: number;
  isDefault: boolean;
}

async function fetchPublicVatSettings(): Promise<VatSettingsPublic> {
  const settings = await getPublicSettings();

  const vatRates = (settings.vatRates as VatRate[] | undefined) ?? [];
  const defaultVatRate = vatRates.find((r) => r.isDefault) ?? vatRates[0];

  return {
    vatLiable: typeof settings.vatLiable === 'boolean' ? settings.vatLiable : true,
    defaultRate: defaultVatRate?.rate ?? 21,
    taxLabel: typeof settings.taxLabel === 'string' ? settings.taxLabel : 'BTW',
    pricesIncludeVat:
      typeof settings.pricesIncludeVat === 'boolean' ? settings.pricesIncludeVat : true,
  };
}

/**
 * Hook that provides VAT settings for storefront display.
 * Returns default settings initially, then fetches from /api/settings/public.
 */
export function useVatSettings(): VatSettingsPublic {
  const [settings, setSettings] = useState<VatSettingsPublic>(DEFAULT_VAT_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    void fetchPublicVatSettings()
      .then((next) => {
        if (!cancelled) {
          setSettings(next);
        }
      })
      .catch(() => {
        // Keep defaults when public settings cannot be loaded.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
