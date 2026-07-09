/**
 * Order-First Architecture Types
 * Single source of truth voor alle order-gerelateerde types.
 * @module types/order
 */

// ===========================================
// ORDER SOURCE - waar komt de order vandaan
// ===========================================

export const ORDER_SOURCES = {
  WEB: "WEB",
  POS: "POS",
  WHATSAPP: "WHATSAPP",
  TIKTOK: "TIKTOK",
  FACEBOOK: "FACEBOOK",
  INSTAGRAM: "INSTAGRAM",
  CASH: "CASH",
  INVOICE: "INVOICE",
  RENTAL: "RENTAL",
  MANUAL: "MANUAL",
  MARKETPLACE: "MARKETPLACE",
  SUBSCRIPTION: "SUBSCRIPTION",
} as const;

export type OrderSource = (typeof ORDER_SOURCES)[keyof typeof ORDER_SOURCES];

// ===========================================
// ORDER ORIGINATOR - wie maakte de order aan
// ===========================================

export const ORDER_ORIGINATORS = {
  CUSTOMER: "CUSTOMER",
  SELLER: "SELLER",
  SYSTEM: "SYSTEM",
} as const;

export type OrderOriginator =
  (typeof ORDER_ORIGINATORS)[keyof typeof ORDER_ORIGINATORS];

// ===========================================
// ORDER STATUS
// ===========================================

export const ORDER_STATUSES = {
  PENDING: "pending",
  AWAITING_PAYMENT: "awaiting_payment",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

// ===========================================
// PAYMENT STATUS
// ===========================================

export const PAYMENT_STATUSES = {
  PENDING: "pending",
  AUTHORIZED: "authorized",
  PROCESSING: "processing",
  PAID: "paid",
  FAILED: "failed",
  EXPIRED: "expired",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
  DISPUTED: "disputed",
  CANCELLED: "cancelled",
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];
