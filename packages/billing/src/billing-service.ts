/**
 * BillingService — pure domain operations for platform subscriptions.
 *
 * Framework-free: no Next/React/Supabase/Stripe imports. All functions are
 * deterministic and validate inputs with typed BillingError subclasses.
 * Persistence (Supabase) is the caller's concern; the service returns new
 * immutable objects.
 *
 * Marketplace transactions remain separate — this service never touches
 * marketplace service_orders or commissions. The platform-fee concept lives
 * in `packages/domain` marketplace.
 */

import {
  BillingValidationError,
  BillingConflictError,
} from "./errors";
import {
  type BillingCustomer,
  type BillingEntitlement,
  type BillingInvoice,
  type BillingSubscription,
  type BillingWebhookEvent,
  type CreateBillingCustomerInput,
  type CreateBillingEntitlementInput,
  type CreateBillingInvoiceInput,
  type CreateBillingSubscriptionInput,
  type CreateBillingWebhookEventInput,
  type InvoiceStatus,
  type PlanCode,
  type SubscriptionStatus,
  createBillingCustomer,
  createBillingEntitlement,
  createBillingInvoice,
  createBillingSubscription,
  createBillingWebhookEvent,
  isInvoiceStatus,
  isPlanCode,
  isSubscriptionStatus,
  validateBillingCustomer,
  validateBillingEntitlement,
  validateBillingInvoice,
  validateBillingSubscription,
  validateBillingWebhookEvent,
} from "./types";

// ── Plan entitlements ────────────────────────────────────────────────────────

const PLAN_ENTITLEMENTS: Record<PlanCode, readonly string[]> = {
  free: ["basic_search"],
  premium: ["basic_search", "premium_articles", "ai_assistance"],
  pro: [
    "basic_search",
    "premium_articles",
    "ai_assistance",
    "adviser_access",
    "priority_support",
  ],
};

export function getPlanEntitlements(planCode: PlanCode): readonly string[] {
  if (!isPlanCode(planCode)) {
    throw new BillingValidationError(`Invalid plan code "${planCode}".`, {
      field: "planCode",
    });
  }
  return PLAN_ENTITLEMENTS[planCode];
}

// ── Customer ─────────────────────────────────────────────────────────────────

export function createCustomer(input: CreateBillingCustomerInput): BillingCustomer {
  return createBillingCustomer(input);
}

export function validateCustomer(value: BillingCustomer): void {
  validateBillingCustomer(value);
}

// ── Subscription ─────────────────────────────────────────────────────────────

export function createSubscription(input: CreateBillingSubscriptionInput): BillingSubscription {
  return createBillingSubscription(input);
}

export function validateSubscription(value: BillingSubscription): void {
  validateBillingSubscription(value);
}

export function isSubscriptionActive(
  subscription: BillingSubscription,
  now: Date = new Date(),
): boolean {
  validateBillingSubscription(subscription);
  if (subscription.status !== "active") return false;
  if (subscription.currentPeriodEnd !== null && subscription.currentPeriodEnd.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

export function canTransitionSubscription(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): boolean {
  if (!isSubscriptionStatus(from) || !isSubscriptionStatus(to)) return false;
  if (from === to) return true;
  const transitions: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
    incomplete: ["active", "cancelled"],
    active: ["past_due", "cancelled"],
    past_due: ["active", "cancelled"],
    cancelled: [],
  };
  return transitions[from]?.includes(to) ?? false;
}

export function transitionSubscription(
  subscription: BillingSubscription,
  toStatus: SubscriptionStatus,
): BillingSubscription {
  if (!isSubscriptionStatus(toStatus)) {
    throw new BillingValidationError(`Invalid subscription status "${toStatus}".`, { field: "status" });
  }
  if (!canTransitionSubscription(subscription.status, toStatus)) {
    throw new BillingValidationError(
      `Cannot transition subscription from "${subscription.status}" to "${toStatus}".`,
      { from: subscription.status, to: toStatus },
    );
  }
  return {
    ...subscription,
    status: toStatus,
  };
}

// ── Entitlement ──────────────────────────────────────────────────────────────

export function createEntitlement(input: CreateBillingEntitlementInput): BillingEntitlement {
  return createBillingEntitlement(input);
}

export function validateEntitlement(value: BillingEntitlement): void {
  validateBillingEntitlement(value);
}

/**
 * Pure: checks whether a set of entitlements grants access to a feature.
 * An entitlement is valid when its featureCode matches and it has not expired.
 * No database or Stripe lookup — caller supplies the entitlements.
 */
export function canAccessFeature(
  entitlements: readonly BillingEntitlement[],
  featureCode: string,
  now: Date = new Date(),
): boolean {
  if (typeof featureCode !== "string" || featureCode.trim().length === 0) {
    throw new BillingValidationError("featureCode is required.", { field: "featureCode" });
  }
  const normalized = featureCode.trim();
  for (const entitlement of entitlements) {
    validateBillingEntitlement(entitlement);
    if (entitlement.featureCode !== normalized) continue;
    if (entitlement.expiresAt !== null && entitlement.expiresAt.getTime() <= now.getTime()) {
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Pure: derives entitlements implied by a subscription's plan.
 * Used when materialising entitlements after a subscription activation
 * or renewal. Caller decides persistence.
 */
export function deriveEntitlementsForSubscription(
  subscription: BillingSubscription,
  grantedAt: Date = new Date(),
): BillingEntitlement[] {
  validateBillingSubscription(subscription);
  if (!(grantedAt instanceof Date) || Number.isNaN(grantedAt.getTime())) {
    throw new BillingValidationError("grantedAt must be a valid Date.", { field: "grantedAt" });
  }
  const features = getPlanEntitlements(subscription.planCode);
  const expiresAt = subscription.currentPeriodEnd;
  return features.map((featureCode) =>
    createBillingEntitlement({
      customerId: subscription.customerId,
      featureCode,
      grantedAt,
      expiresAt,
    }),
  );
}

// ── Invoice ──────────────────────────────────────────────────────────────────

export function createInvoice(input: CreateBillingInvoiceInput): BillingInvoice {
  return createBillingInvoice(input);
}

export function validateInvoice(value: BillingInvoice): void {
  validateBillingInvoice(value);
}

export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (!isInvoiceStatus(from) || !isInvoiceStatus(to)) return false;
  if (from === to) return true;
  const transitions: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
    draft: ["open", "void"],
    open: ["paid", "void"],
    paid: [],
    void: [],
  };
  return transitions[from]?.includes(to) ?? false;
}

export function transitionInvoice(invoice: BillingInvoice, toStatus: InvoiceStatus): BillingInvoice {
  if (!isInvoiceStatus(toStatus)) {
    throw new BillingValidationError(`Invalid invoice status "${toStatus}".`, { field: "status" });
  }
  if (!canTransitionInvoice(invoice.status, toStatus)) {
    throw new BillingValidationError(
      `Cannot transition invoice from "${invoice.status}" to "${toStatus}".`,
      { from: invoice.status, to: toStatus },
    );
  }
  return { ...invoice, status: toStatus };
}

// ── Proration ────────────────────────────────────────────────────────────────

/**
 * Calculates a prorated amount for the remaining period.
 *
 * `amount` is the full-period price. `daysRemaining` / `totalDays` defines
 * the unused slice. Result is rounded to 2 decimals.
 *
 * Pure arithmetic — no side effects.
 */
export function calculateProration(input: {
  amount: number;
  daysRemaining: number;
  totalDays: number;
}): number {
  const { amount, daysRemaining, totalDays } = input;
  if (typeof amount !== "number" || Number.isNaN(amount) || amount < 0) {
    throw new BillingValidationError("amount must be a number >= 0.", { field: "amount" });
  }
  if (!Number.isFinite(amount)) {
    throw new BillingValidationError("amount must be finite.", { field: "amount" });
  }
  if (!Number.isInteger(daysRemaining) || daysRemaining < 0) {
    throw new BillingValidationError("daysRemaining must be a non-negative integer.", {
      field: "daysRemaining",
    });
  }
  if (!Number.isInteger(totalDays) || totalDays <= 0) {
    throw new BillingValidationError("totalDays must be a positive integer.", { field: "totalDays" });
  }
  if (daysRemaining > totalDays) {
    throw new BillingValidationError("daysRemaining must not exceed totalDays.", {
      field: "daysRemaining",
    });
  }
  const prorated = (amount * daysRemaining) / totalDays;
  return Math.round(prorated * 100) / 100;
}

/**
 * Calculates the net proration when changing plans mid-cycle.
 * Positive means the customer owes, negative means they are credited.
 */
export function calculatePlanChangeProration(input: {
  oldAmount: number;
  newAmount: number;
  daysRemaining: number;
  totalDays: number;
}): number {
  const oldProrated = calculateProration({
    amount: input.oldAmount,
    daysRemaining: input.daysRemaining,
    totalDays: input.totalDays,
  });
  const newProrated = calculateProration({
    amount: input.newAmount,
    daysRemaining: input.daysRemaining,
    totalDays: input.totalDays,
  });
  return Math.round((newProrated - oldProrated) * 100) / 100;
}

// ── Webhook event ────────────────────────────────────────────────────────────

export interface HandleWebhookEventResult {
  event: BillingWebhookEvent;
  shouldProcess: boolean;
  reason?: string;
}

/**
 * Pure webhook handler: deduplicates by stripeEventId and validates shape.
 * The caller supplies the set of already-seen stripe event ids (from the
 * idempotency ledger) and the incoming payload. Stripe signature validation
 * is performed at the delivery layer (route handler) — this function only
 * validates the zod shape and idempotency.
 */
export function handleWebhookEvent(
  input: CreateBillingWebhookEventInput,
  existingStripeEventIds: ReadonlySet<string>,
): HandleWebhookEventResult {
  if (existingStripeEventIds.has(input.stripeEventId.trim())) {
    throw new BillingConflictError(`Webhook event "${input.stripeEventId}" already processed.`);
  }
  // Validate shape before creation
  const event = createBillingWebhookEvent(input);
  return {
    event,
    shouldProcess: true,
  };
}

export function validateWebhookEvent(value: BillingWebhookEvent): void {
  validateBillingWebhookEvent(value);
}

export function markWebhookProcessed(event: BillingWebhookEvent): BillingWebhookEvent {
  validateBillingWebhookEvent(event);
  if (event.processed) return event;
  return { ...event, processed: true };
}

// ── Class façade ─────────────────────────────────────────────────────────────

export class BillingService {
  createCustomer(input: CreateBillingCustomerInput): BillingCustomer {
    return createCustomer(input);
  }

  createSubscription(input: CreateBillingSubscriptionInput): BillingSubscription {
    return createSubscription(input);
  }

  isSubscriptionActive(subscription: BillingSubscription, now?: Date): boolean {
    return isSubscriptionActive(subscription, now);
  }

  transitionSubscription(subscription: BillingSubscription, toStatus: SubscriptionStatus): BillingSubscription {
    return transitionSubscription(subscription, toStatus);
  }

  createEntitlement(input: CreateBillingEntitlementInput): BillingEntitlement {
    return createEntitlement(input);
  }

  canAccessFeature(
    entitlements: readonly BillingEntitlement[],
    featureCode: string,
    now?: Date,
  ): boolean {
    return canAccessFeature(entitlements, featureCode, now);
  }

  deriveEntitlementsForSubscription(subscription: BillingSubscription, grantedAt?: Date): BillingEntitlement[] {
    return deriveEntitlementsForSubscription(subscription, grantedAt);
  }

  createInvoice(input: CreateBillingInvoiceInput): BillingInvoice {
    return createInvoice(input);
  }

  transitionInvoice(invoice: BillingInvoice, toStatus: InvoiceStatus): BillingInvoice {
    return transitionInvoice(invoice, toStatus);
  }

  calculateProration(input: { amount: number; daysRemaining: number; totalDays: number }): number {
    return calculateProration(input);
  }

  calculatePlanChangeProration(input: {
    oldAmount: number;
    newAmount: number;
    daysRemaining: number;
    totalDays: number;
  }): number {
    return calculatePlanChangeProration(input);
  }

  handleWebhookEvent(
    input: CreateBillingWebhookEventInput,
    existingStripeEventIds: ReadonlySet<string>,
  ): HandleWebhookEventResult {
    return handleWebhookEvent(input, existingStripeEventIds);
  }

  markWebhookProcessed(event: BillingWebhookEvent): BillingWebhookEvent {
    return markWebhookProcessed(event);
  }

  getPlanEntitlements(planCode: PlanCode): readonly string[] {
    return getPlanEntitlements(planCode);
  }

  canTransitionSubscription(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
    return canTransitionSubscription(from, to);
  }

  canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
    return canTransitionInvoice(from, to);
  }
}
