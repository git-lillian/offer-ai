/**
 * Billing domain types.
 *
 * Two independent money concepts — never merged into one `payments`
 * boolean or a `premium` column:
 *
 * 1. Platform subscriptions (premium Offer.ai features).
 * 2. Marketplace transactions (payments to human advisers where Offer.ai
 *    takes a platform fee).
 *
 * Foundation status: types only. Stripe integration comes after the domain
 * is stable.
 */

export interface Plan {
  id: string;
  code: string;
  name: string;
  billingInterval: "monthly" | "yearly" | "one_time";
  priceMinorUnits: number;
  currencyCode: string;
  entitlements: string[];
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: "active" | "past_due" | "cancelled" | "expired";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt: Date | null;
  createdAt: Date;
}

export interface Entitlement {
  id: string;
  userId: string;
  entitlementCode: string;
  source: "plan" | "grant" | "admin";
  expiresAt: Date | null;
}

export interface UsageEvent {
  id: string;
  userId: string;
  metricCode: string;
  quantity: number;
  occurredAt: Date;
}

export interface MarketplaceServiceOrder {
  id: string;
  studentId: string;
  providerUserId: string;
  serviceListingId: string;
  status: "pending_payment" | "paid" | "in_progress" | "delivered" | "completed" | "cancelled" | "disputed";
  priceMinorUnits: number;
  currencyCode: string;
  platformFeeMinorUnits: number;
  createdAt: Date;
}

export interface Payment {
  id: string;
  orderId: string | null;
  subscriptionId: string | null;
  userId: string;
  amountMinorUnits: number;
  currencyCode: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  provider: string | null;
  providerReference: string | null;
  createdAt: Date;
}

export interface Refund {
  id: string;
  paymentId: string;
  amountMinorUnits: number;
  reason: string;
  status: "pending" | "succeeded" | "failed";
  createdAt: Date;
}

export interface Commission {
  id: string;
  serviceOrderId: string;
  amountMinorUnits: number;
  currencyCode: string;
  status: "earned" | "paid" | "reversed";
  createdAt: Date;
}

export interface PayoutAccount {
  id: string;
  providerUserId: string;
  provider: string;
  status: "pending_verification" | "verified" | "disabled";
  updatedAt: Date;
}
