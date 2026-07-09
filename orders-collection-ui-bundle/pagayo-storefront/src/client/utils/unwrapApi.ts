/**
 * unwrapApi — Centraal unwrapping van de Pagayo API Envelope.
 *
 * ALLE API responses van Pagayo volgen dit format:
 *
 *   SUCCESS:  { success: true,  data: T,                              requestId }
 *   LIST:     { success: true,  data: T[], total, page, limit,        requestId }
 *   ERROR:    { success: false, error: { code, message, details? },   requestId }
 *
 * Sommige legacy endpoints retourneren nog het oude formaat (data direct op root).
 * Deze helpers zijn backward-compatible en werken met beide formaten.
 *
 * @module client/utils/unwrapApi
 * @see @pagayo/config/api-response voor de server-side helpers
 */

// =============================================================================
// TYPES — Mirrors van @pagayo/config/api-response (client-side, geen Hono dep)
// =============================================================================

/** API response envelope (success of error). */
interface ApiEnvelope {
  success?: boolean;
  data?: unknown;
  error?: { code?: string; message?: string; details?: unknown };
  total?: number;
  page?: number;
  limit?: number;
  requestId?: string;
  /** Legacy: sommige endpoints zetten message direct op root */
  message?: string;
}

/** Resultaat van een list endpoint met paginering. */
export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Haal de payload data uit een API response envelope.
 *
 * - Nieuw format: `{ success: true, data: T }` → retourneert `T`
 * - Legacy format: response IS de data → retourneert response zelf
 *
 * @param response - De geparsede JSON response (`await res.json()`)
 * @returns De unwrapped data
 *
 * @example
 * ```ts
 * const json = await res.json();
 * const user = unwrapData<User>(json);
 * // user.email, user.firstName, etc. — niet json.data.email
 * ```
 */
export function unwrapData<T = Record<string, unknown>>(response: unknown): T {
  const envelope = response as ApiEnvelope;

  // Nieuw format: { success: true, data: T }
  if (envelope.success === true && envelope.data !== undefined) {
    return envelope.data as T;
  }

  // Legacy/fallback: response IS de data
  return response as T;
}

/**
 * Haal de paginated lijst uit een API list response.
 *
 * - Nieuw format: `{ success: true, data: T[], total, page, limit }` → retourneert `ListResult<T>`
 * - Legacy format: array direct in data of als response zelf
 *
 * @param response - De geparsede JSON response (`await res.json()`)
 * @returns `{ items, total, page, limit }`
 *
 * @example
 * ```ts
 * const json = await res.json();
 * const { items: orders, total } = unwrapList<Order>(json);
 * ```
 */
export function unwrapList<T = Record<string, unknown>>(
  response: unknown,
): ListResult<T> {
  const envelope = response as ApiEnvelope;

  // Nieuw format: { success: true, data: T[], total, page, limit }
  if (envelope.success === true && Array.isArray(envelope.data)) {
    return {
      items: envelope.data as T[],
      total: envelope.total ?? 0,
      page: envelope.page ?? 1,
      limit: envelope.limit ?? 25,
    };
  }

  // Legacy: { data: T[], total } (geen success veld)
  if (Array.isArray(envelope.data)) {
    return {
      items: envelope.data as T[],
      total: envelope.total ?? 0,
      page: envelope.page ?? 1,
      limit: envelope.limit ?? 25,
    };
  }

  // Fallback: response is direct een array
  if (Array.isArray(response)) {
    return {
      items: response as T[],
      total: (response as T[]).length,
      page: 1,
      limit: 25,
    };
  }

  // Worst case: lege lijst
  return { items: [], total: 0, page: 1, limit: 25 };
}

/**
 * Haal het error message uit een API error response.
 *
 * - Nieuw format: `{ success: false, error: { message } }` → retourneert message
 * - Legacy format: `{ message }` → retourneert message
 * - Fallback: 'Onbekende fout'
 *
 * @param response - De geparsede JSON response
 * @param fallback - Fallback message als geen error gevonden (default: 'Onbekende fout')
 * @returns Het error message als string
 *
 * @example
 * ```ts
 * if (!res.ok) {
 *   const json = await res.json();
 *   throw new Error(unwrapError(json, t('defaultError')));
 * }
 * ```
 */
function appendErrorDetails(
  message: string,
  details: unknown | undefined,
): string {
  if (!details || typeof details !== "object") {
    return message;
  }
  const hint =
    "hint" in details && typeof (details as { hint?: unknown }).hint === "string"
      ? (details as { hint: string }).hint.trim()
      : "";
  const cause =
    "cause" in details && typeof (details as { cause?: unknown }).cause === "string"
      ? (details as { cause: string }).cause.trim()
      : "";
  const extra = hint || cause;
  return extra.length > 0 ? `${message} — ${hint || cause}` : message;
}

export function unwrapErrorCode(response: unknown): string | null {
  const envelope = response as ApiEnvelope;
  const code = envelope.error?.code;
  return typeof code === "string" && code.length > 0 ? code : null;
}

export function unwrapError(
  response: unknown,
  fallback = "Onbekende fout",
): string {
  const envelope = response as ApiEnvelope;

  // Nieuw format: { success: false, error: { message } }
  if (
    envelope.error &&
    typeof envelope.error === "object" &&
    envelope.error.message
  ) {
    return appendErrorDetails(
      envelope.error.message,
      envelope.error.details,
    );
  }

  // Legacy format: { message } direct op root
  if (envelope.message && typeof envelope.message === "string") {
    return envelope.message;
  }

  // String literal (soms geretourneerd als { error: "tekst" })
  if (typeof envelope.error === "string") {
    return envelope.error;
  }

  return fallback;
}

/**
 * Convenience: check of een response succesvol is.
 *
 * @param response - De geparsede JSON response
 * @returns true als success === true of success niet gedefinieerd is (legacy)
 */
export function isApiSuccess(response: unknown): boolean {
  const envelope = response as ApiEnvelope;
  // Expliciet false = error
  if (envelope.success === false) return false;
  // true of niet aanwezig (legacy) = success
  return true;
}
