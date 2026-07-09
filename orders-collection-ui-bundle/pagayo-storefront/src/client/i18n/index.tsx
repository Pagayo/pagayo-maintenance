/**
 * Pagayo Storefront — Client-Side i18n System
 *
 * Provides internationalization for the Preact-based storefront & admin UI.
 * English is the master/fallback language. All keys are defined in EN first,
 * then translated via Copilot to all supported locales.
 *
 * ## Architecture
 * - JSON files per namespace per locale (e.g. `locales/en/common.json`)
 * - Flat dot-notation keys within each namespace file
 * - Merged at import time via `locales/{lang}/index.ts`
 * - Preact context provides current locale to all components
 * - `useI18n()` hook for accessing `t()` in components
 *
 * ## Usage
 * ```tsx
 * import { useI18n } from '../../i18n';
 *
 * const MyComponent = () => {
 *   const { t } = useI18n();
 *   return <button>{t('common.save')}</button>;
 * };
 * ```
 *
 * ## Adding a new language
 * 1. Create `locales/{code}/` directory
 * 2. Copy all JSON files from `locales/en/`
 * 3. Translate all values (keys stay the same)
 * 4. Add import + export in `locales/{code}/index.ts`
 * 5. Add to `SUPPORTED_LOCALES` and `allTranslations` below
 *
 * @module client/i18n
 */

import { createContext } from 'preact';
import { useState, useContext, useMemo } from 'preact/hooks';
import type { FunctionalComponent, ComponentChildren } from 'preact';

import en from './locales/en/index';
import nl from './locales/nl/index';
import de from './locales/de/index';

// =============================================================================
// TYPES
// =============================================================================

/** Supported locale codes (same as worker-side i18n) */
export type Locale = 'en' | 'nl' | 'de';

/** All supported locales */
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'nl', 'de'] as const;

/** Translation key — any key that exists in the EN master */
export type TranslationKey = keyof typeof en;

// =============================================================================
// TRANSLATIONS MAP
// =============================================================================

const allTranslations: Record<Locale, Record<string, string>> = {
  en,
  nl,
  de,
};

// =============================================================================
// CORE TRANSLATION FUNCTION
// =============================================================================

/**
 * Get a translated string by key.
 *
 * Falls back to English if the key is not found in the given locale.
 * Returns the key itself if not found in any locale (for debugging).
 *
 * @param locale - The locale to use
 * @param key - The translation key (e.g. 'common.save')
 * @param params - Optional parameters to replace {placeholders}
 * @returns The translated string
 */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const localeStrings = allTranslations[locale];
  let text = localeStrings?.[key] ?? allTranslations.en[key] ?? key;

  // Replace {placeholder} patterns
  if (params) {
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(`{${param}}`, String(value));
    }
  }

  return text;
}

// =============================================================================
// LOCALE DETECTION
// =============================================================================

/**
 * Detect the best locale for the current page.
 *
 * Priority:
 * 1. `?lang=` URL parameter (user override)
 * 2. `window.__TENANT__.locale` (SSoT from tenant settings, server-injected)
 * 3. `navigator.language` browser preference
 * 4. `<html lang="...">` attribute (set server-side, may be fallback 'en')
 * 5. Default: 'en'
 */
export function detectClientLocale(): Locale {
  // 1. URL parameter (user override)
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang');
  if (langParam && isValidLocale(langParam)) return langParam;

  // 2. Tenant's configured locale (SSoT from server)
  const tenantData = (window as Window & { __TENANT__?: { locale?: string | null } }).__TENANT__;
  if (tenantData?.locale) {
    const tenantLang = tenantData.locale.substring(0, 2).toLowerCase();
    if (isValidLocale(tenantLang)) return tenantLang;
  }

  // 3. Browser preference (before html lang — html lang may be server fallback 'en')
  const browserLang = navigator.language?.substring(0, 2).toLowerCase();
  if (browserLang && isValidLocale(browserLang)) return browserLang;

  // 4. <html lang="...">
  const htmlLang = document.documentElement.lang?.substring(0, 2).toLowerCase();
  if (htmlLang && isValidLocale(htmlLang)) return htmlLang;

  // 5. Default
  return 'en';
}

function isValidLocale(lang: string): lang is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(lang);
}

// =============================================================================
// PREACT CONTEXT + HOOK
// =============================================================================

interface I18nContextValue {
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  t: (key) => allTranslations.en[key] ?? key,
  setLocale: () => {},
});

/**
 * i18n Provider — wraps app to provide locale context.
 *
 * @example
 * ```tsx
 * import { I18nProvider } from './i18n';
 *
 * const App = () => (
 *   <I18nProvider>
 *     <MyComponent />
 *   </I18nProvider>
 * );
 * ```
 */
export const I18nProvider: FunctionalComponent<{
  initialLocale?: Locale;
  children: ComponentChildren;
}> = ({ initialLocale, children }) => {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? detectClientLocale());

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    t: (key: string, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    setLocale,
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

/**
 * Hook to access the i18n system in any component.
 *
 * @returns `{ locale, t, setLocale }`
 *
 * @example
 * ```tsx
 * const { t, locale } = useI18n();
 * return <h1>{t('admin.nav.dashboard')}</h1>;
 * ```
 */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

/**
 * Standalone t() for use outside React/Preact components.
 * Uses the detected client locale.
 *
 * @example
 * ```ts
 * import { t } from './i18n';
 * console.log(t('common.save')); // "Save" or "Opslaan" etc.
 * ```
 */
let _cachedLocale: Locale | null = null;
export function t(key: string, params?: Record<string, string | number>): string {
  if (!_cachedLocale) {
    _cachedLocale = detectClientLocale();
  }
  return translate(_cachedLocale, key, params);
}

/**
 * Get all translation keys for a given namespace prefix.
 * Useful for debugging or building translation status reports.
 */
export function getKeysForNamespace(namespace: string): string[] {
  return Object.keys(allTranslations.en).filter((key) =>
    key.startsWith(`${namespace}.`),
  );
}

/**
 * Check translation coverage for a locale vs English master.
 * Returns percentage of keys that are translated (not falling back to EN).
 */
export function getTranslationCoverage(locale: Locale): {
  total: number;
  translated: number;
  missing: string[];
  percentage: number;
} {
  const enKeys = Object.keys(allTranslations.en);
  const localeStrings = allTranslations[locale] ?? {};
  const missing = enKeys.filter((key) => !(key in localeStrings));

  return {
    total: enKeys.length,
    translated: enKeys.length - missing.length,
    missing,
    percentage: Math.round(((enKeys.length - missing.length) / enKeys.length) * 100),
  };
}
