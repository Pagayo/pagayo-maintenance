/**
 * Admin handmatige order — betaalmethode-codes op order_payment.method.
 * Provider is altijd `admin` (zie admin-orders.routes).
 */
export const ADMIN_ORDER_PAYMENT_METHODS = [
  "admin_invoice",
  "admin_cash",
  "admin_comp",
] as const;
const ADMIN_ORDER_PAYMENT_METHODS_SET = new Set<string>(ADMIN_ORDER_PAYMENT_METHODS);

export type AdminOrderPaymentMethod =
  (typeof ADMIN_ORDER_PAYMENT_METHODS)[number];

export const ADMIN_ORDER_PAYMENT_PROVIDER = "admin" as const;

/**
 * UI stuurt o.a. `invoice` (factuur achteraf) — dat is geen tenant paymentStatus.
 */
export function normalizeAdminManualOrderTenantPaymentStatus(
  uiPaymentStatus: unknown,
): "pending" | "paid" {
  if (uiPaymentStatus === "paid") {
    return "paid";
  }
  return "pending";
}

export function parseAdminOrderPaymentMethodInput(
  raw: unknown,
): { ok: true; method: AdminOrderPaymentMethod } | { ok: false } {
  if (raw === undefined || raw === null) {
    return { ok: true, method: "admin_invoice" };
  }
  if (
    typeof raw === "string" &&
    ADMIN_ORDER_PAYMENT_METHODS_SET.has(raw)
  ) {
    return { ok: true, method: raw as AdminOrderPaymentMethod };
  }
  return { ok: false };
}
