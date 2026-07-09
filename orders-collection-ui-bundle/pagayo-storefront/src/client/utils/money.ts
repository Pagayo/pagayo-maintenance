/**
 * Money formatting utilities — SSoT voor geld-weergave.
 *
 * BUSINESS CONTEXT:
 * Alle API money values zijn integer cents met `Cents` suffix.
 * Deze util converteert cents → display string voor de UI.
 *
 * @module client/utils/money
 */

/**
 * Format integer cents to a localized currency string.
 *
 * @param cents - Integer cents (e.g., 1495 = €14,95)
 * @param locale - BCP 47 locale (default: 'nl-NL')
 * @param currency - ISO 4217 currency code (default: 'EUR')
 * @returns Formatted string (e.g., "€ 14,95")
 *
 * @example
 * ```ts
 * formatCents(1495)           // "€ 14,95"
 * formatCents(0)              // "€ 0,00"
 * formatCents(1495, 'en-US', 'USD') // "$14.95"
 * formatCents(undefined)      // "€ 0,00"
 * ```
 */
const LOCALE_MAP: Record<string, string> = {
  nl: "nl-NL",
  en: "en-US",
  de: "de-DE",
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const normalized =
    typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function normalizeCurrencyCode(currency: string | null | undefined): string {
  const normalized = (currency || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "EUR";
}

function normalizeCurrencyLocale(locale: string): string {
  const trimmedLocale = locale.trim();

  if (!trimmedLocale) {
    return "nl-NL";
  }

  if (trimmedLocale.includes("-")) {
    return trimmedLocale;
  }

  return LOCALE_MAP[trimmedLocale.toLowerCase()] ?? trimmedLocale;
}

export function resolveCurrencyLocale(locale?: string | null): string {
  if (locale) {
    return normalizeCurrencyLocale(locale);
  }

  if (typeof window !== "undefined") {
    const tenantLocale = (
      window as Window & { __TENANT__?: { locale?: string | null } }
    ).__TENANT__?.locale;

    if (tenantLocale) {
      return normalizeCurrencyLocale(tenantLocale);
    }
  }

  if (typeof document !== "undefined" && document.documentElement.lang) {
    return normalizeCurrencyLocale(document.documentElement.lang);
  }

  if (typeof navigator !== "undefined" && navigator.language) {
    return normalizeCurrencyLocale(navigator.language);
  }

  return "nl-NL";
}

export function formatCents(
  cents: number | null | undefined,
  locale?: string,
  currency: string = "EUR",
): string {
  const value = toFiniteNumber(cents, 0) / 100;
  const normalizedCurrency = normalizeCurrencyCode(currency);
  const normalizedLocale = resolveCurrencyLocale(locale);

  try {
    return new Intl.NumberFormat(normalizedLocale, {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}

/**
 * Format integer cents for form input (plain number string without currency symbol).
 *
 * @param cents - Integer cents (e.g., 1495 = "14.95")
 * @returns Plain decimal string for input fields
 *
 * @example
 * ```ts
 * formatCentsForInput(1495)   // "14.95"
 * formatCentsForInput(0)      // "0.00"
 * formatCentsForInput(undefined) // "0.00"
 * ```
 */
export function formatCentsForInput(cents: number | null | undefined): string {
  return (toFiniteNumber(cents, 0) / 100).toFixed(2);
}

/**
 * Parse a decimal euro string to integer cents.
 *
 * @param euroString - Decimal string (e.g., "14.95" or "14,95")
 * @returns Integer cents (e.g., 1495)
 *
 * @example
 * ```ts
 * parseToCents("14.95")  // 1495
 * parseToCents("14,95")  // 1495
 * parseToCents("")        // 0
 * ```
 */
export function parseToCents(euroString: string): number {
  const normalized = String(euroString || "").replace(",", ".");
  const parsed = parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}
