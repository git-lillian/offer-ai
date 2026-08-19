/**
 * Billing domain types.
 *
 * Two independent money concepts — never merged into a single `payments`
 * boolean or a `premium` column:
 *
 * 1. Platform subscriptions (premium Offer.ai features) — this package.
 * 2. Marketplace transactions (payments to human advisers where Offer.ai
 *    takes a platform fee) — `packages/domain` marketplace domain.
 *
 * Keeping these concepts separate avoids silent coupling between SaaS revenue
 * and marketplace commissions. A student may hold a premium subscription
 * without ever purchasing a marketplace service and vice versa.
 *
 * Foundation status: domain types + pure service. Stripe integration comes
 * after the domain is stable — model names and API keys never appear here.
 */

import { BillingValidationError } from "./errors";

// ── Constants ────────────────────────────────────────────────────────────────

export const PLAN_CODES = ["free", "premium", "pro"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const SUBSCRIPTION_STATUSES = ["active", "past_due", "cancelled", "incomplete"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const INVOICE_STATUSES = ["draft", "open", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// ── Type guards ──────────────────────────────────────────────────────────────

export function isPlanCode(value: string): value is PlanCode {
  return (PLAN_CODES as readonly string[]).includes(value);
}

export function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function assertUuid(value: string, field: string): void {
  if (!isUuid(value)) {
    throw new BillingValidationError(`${field} must be a valid UUID.`, { field });
  }
}

function assertTrimmedLength(value: string, field: string, min: number, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new BillingValidationError(`${field} is required.`, { field });
  }
  if (trimmed.length > max) {
    throw new BillingValidationError(`${field} must be ${max} characters or fewer.`, { field });
  }
  return trimmed;
}

function assertCurrencyCode(value: string, field: string): void {
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new BillingValidationError(`${field} must be an ISO 4217 currency code.`, { field });
  }
}

function assertStripeId(value: string | null | undefined, field: string): void {
  if (value === null || value === undefined) return;
  if (typeof value !== "string") {
    throw new BillingValidationError(`${field} must be a string or null.`, { field });
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new BillingValidationError(`${field} must be non-empty when provided.`, { field });
  }
  if (trimmed.length > 120) {
    throw new BillingValidationError(`${field} must be 120 characters or fewer.`, { field });
  }
}

// ── Billing customer ─────────────────────────────────────────────────────────

export interface BillingCustomer {
  id: string;
  userId: string;
  stripeCustomerId: string | null;
  createdAt: Date;
}

export interface CreateBillingCustomerInput {
  userId: string;
  stripeCustomerId?: string | null;
}

export function validateCreateBillingCustomerInput(input: CreateBillingCustomerInput): void {
  assertUuid(input.userId, "userId");
  assertStripeId(input.stripeCustomerId ?? null, "stripeCustomerId");
}

export function createBillingCustomer(input: CreateBillingCustomerInput): BillingCustomer {
  validateCreateBillingCustomerInput(input);
  return {
    id: crypto.randomUUID(),
    userId: input.userId,
    stripeCustomerId: input.stripeCustomerId?.trim() ?? null,
    createdAt: new Date(),
  };
}

export function validateBillingCustomer(value: BillingCustomer): void {
  assertUuid(value.id, "id");
  assertUuid(value.userId, "userId");
  assertStripeId(value.stripeCustomerId, "stripeCustomerId");
  if (!(value.createdAt instanceof Date) || Number.isNaN(value.createdAt.getTime())) {
    throw new BillingValidationError("createdAt must be a valid Date.", { field: "createdAt" });
  }
}

// ── Billing subscription ─────────────────────────────────────────────────────

export interface BillingSubscription {
  id: string;
  customerId: string;
  stripeSubscriptionId: string | null;
  planCode: PlanCode;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  createdAt: Date;
}

export interface CreateBillingSubscriptionInput {
  customerId: string;
  planCode: PlanCode;
  stripeSubscriptionId?: string | null;
  status?: SubscriptionStatus;
  currentPeriodEnd?: Date | null;
}

export function validateCreateBillingSubscriptionInput(input: CreateBillingSubscriptionInput): void {
  assertUuid(input.customerId, "customerId");
  if (!isPlanCode(input.planCode)) {
    throw new BillingValidationError(`Invalid plan code "${input.planCode}".`, { field: "planCode" });
  }
  if (input.status !== undefined && !isSubscriptionStatus(input.status)) {
    throw new BillingValidationError(`Invalid subscription status "${input.status}".`, { field: "status" });
  }
  assertStripeId(input.stripeSubscriptionId ?? null, "stripeSubscriptionId");
  if (
    input.currentPeriodEnd !== undefined &&
    input.currentPeriodEnd !== null &&
    !(input.currentPeriodEnd instanceof Date)
  ) {
    throw new BillingValidationError("currentPeriodEnd must be a Date or null.", { field: "currentPeriodEnd" });
  }
  if (input.currentPeriodEnd instanceof Date && Number.isNaN(input.currentPeriodEnd.getTime())) {
    throw new BillingValidationError("currentPeriodEnd must be a valid date.", { field: "currentPeriodEnd" });
  }
}

export function createBillingSubscription(input: CreateBillingSubscriptionInput): BillingSubscription {
  validateCreateBillingSubscriptionInput(input);
  return {
    id: crypto.randomUUID(),
    customerId: input.customerId,
    stripeSubscriptionId: input.stripeSubscriptionId?.trim() ?? null,
    planCode: input.planCode,
    status: input.status ?? "incomplete",
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    createdAt: new Date(),
  };
}

export function validateBillingSubscription(value: BillingSubscription): void {
  assertUuid(value.id, "id");
  assertUuid(value.customerId, "customerId");
  assertStripeId(value.stripeSubscriptionId, "stripeSubscriptionId");
  if (!isPlanCode(value.planCode)) {
    throw new BillingValidationError(`Invalid plan code "${value.planCode}".`, { field: "planCode" });
  }
  if (!isSubscriptionStatus(value.status)) {
    throw new BillingValidationError(`Invalid subscription status "${value.status}".`, { field: "status" });
  }
  if (value.currentPeriodEnd !== null && !(value.currentPeriodEnd instanceof Date)) {
    throw new BillingValidationError("currentPeriodEnd must be Date or null.", { field: "currentPeriodEnd" });
  }
  if (value.currentPeriodEnd instanceof Date && Number.isNaN(value.currentPeriodEnd.getTime())) {
    throw new BillingValidationError("currentPeriodEnd must be valid date.", { field: "currentPeriodEnd" });
  }
  if (!(value.createdAt instanceof Date) || Number.isNaN(value.createdAt.getTime())) {
    throw new BillingValidationError("createdAt must be valid Date.", { field: "createdAt" });
  }
}

// ── Billing entitlement ──────────────────────────────────────────────────────

export interface BillingEntitlement {
  id: string;
  customerId: string;
  featureCode: string;
  grantedAt: Date;
  expiresAt: Date | null;
}

export interface CreateBillingEntitlementInput {
  customerId: string;
  featureCode: string;
  expiresAt?: Date | null;
  grantedAt?: Date;
}

export function validateCreateBillingEntitlementInput(input: CreateBillingEntitlementInput): void {
  assertUuid(input.customerId, "customerId");
  assertTrimmedLength(input.featureCode, "featureCode", 1, 120);
  if (input.expiresAt !== undefined && input.expiresAt !== null && !(input.expiresAt instanceof Date)) {
    throw new BillingValidationError("expiresAt must be Date or null.", { field: "expiresAt" });
  }
  if (input.expiresAt instanceof Date && Number.isNaN(input.expiresAt.getTime())) {
    throw new BillingValidationError("expiresAt must be valid date.", { field: "expiresAt" });
  }
  if (input.grantedAt !== undefined && !(input.grantedAt instanceof Date)) {
    throw new BillingValidationError("grantedAt must be Date.", { field: "grantedAt" });
  }
  if (input.grantedAt instanceof Date && Number.isNaN(input.grantedAt.getTime())) {
    throw new BillingValidationError("grantedAt must be valid date.", { field: "grantedAt" });
  }
  if (
    input.expiresAt instanceof Date &&
    input.grantedAt instanceof Date &&
    input.expiresAt.getTime() <= input.grantedAt.getTime()
  ) {
    throw new BillingValidationError("expiresAt must be after grantedAt.", { field: "expiresAt" });
  }
}

export function createBillingEntitlement(input: CreateBillingEntitlementInput): BillingEntitlement {
  validateCreateBillingEntitlementInput(input);
  const grantedAt = input.grantedAt ?? new Date();
  if (input.expiresAt instanceof Date && input.expiresAt.getTime() <= grantedAt.getTime()) {
    throw new BillingValidationError("expiresAt must be after grantedAt.", { field: "expiresAt" });
  }
  return {
    id: crypto.randomUUID(),
    customerId: input.customerId,
    featureCode: input.featureCode.trim(),
    grantedAt,
    expiresAt: input.expiresAt ?? null,
  };
}

export function validateBillingEntitlement(value: BillingEntitlement): void {
  assertUuid(value.id, "id");
  assertUuid(value.customerId, "customerId");
  assertTrimmedLength(value.featureCode, "featureCode", 1, 120);
  if (!(value.grantedAt instanceof Date) || Number.isNaN(value.grantedAt.getTime())) {
    throw new BillingValidationError("grantedAt must be valid Date.", { field: "grantedAt" });
  }
  if (value.expiresAt !== null && !(value.expiresAt instanceof Date)) {
    throw new BillingValidationError("expiresAt must be Date or null.", { field: "expiresAt" });
  }
  if (value.expiresAt instanceof Date && Number.isNaN(value.expiresAt.getTime())) {
    throw new BillingValidationError("expiresAt must be valid date.", { field: "expiresAt" });
  }
  if (value.expiresAt instanceof Date && value.expiresAt.getTime() <= value.grantedAt.getTime()) {
    throw new BillingValidationError("expiresAt must be after grantedAt.", { field: "expiresAt" });
  }
}

// ── Billing invoice ──────────────────────────────────────────────────────────

export interface BillingInvoice {
  id: string;
  customerId: string;
  stripeInvoiceId: string | null;
  amountDue: number;
  currencyCode: string;
  status: InvoiceStatus;
  createdAt: Date;
}

export interface CreateBillingInvoiceInput {
  customerId: string;
  stripeInvoiceId?: string | null;
  amountDue: number;
  currencyCode: string;
  status: InvoiceStatus;
}

export function validateCreateBillingInvoiceInput(input: CreateBillingInvoiceInput): void {
  assertUuid(input.customerId, "customerId");
  assertStripeId(input.stripeInvoiceId ?? null, "stripeInvoiceId");
  if (typeof input.amountDue !== "number" || Number.isNaN(input.amountDue) || input.amountDue < 0) {
    throw new BillingValidationError("amountDue must be a number >= 0.", { field: "amountDue" });
  }
  if (!Number.isFinite(input.amountDue)) {
    throw new BillingValidationError("amountDue must be finite.", { field: "amountDue" });
  }
  // Enforce at most 2 decimal places (currency minor units via numeric)
  const decimalPart = input.amountDue.toString().split(".")[1];
  if (decimalPart && decimalPart.length > 2) {
    throw new BillingValidationError("amountDue must have at most 2 decimal places.", { field: "amountDue" });
  }
  assertCurrencyCode(input.currencyCode, "currencyCode");
  if (!isInvoiceStatus(input.status)) {
    throw new BillingValidationError(`Invalid invoice status "${input.status}".`, { field: "status" });
  }
}

export function createBillingInvoice(input: CreateBillingInvoiceInput): BillingInvoice {
  validateCreateBillingInvoiceInput(input);
  return {
    id: crypto.randomUUID(),
    customerId: input.customerId,
    stripeInvoiceId: input.stripeInvoiceId?.trim() ?? null,
    amountDue: Math.round(input.amountDue * 100) / 100,
    currencyCode: input.currencyCode,
    status: input.status,
    createdAt: new Date(),
  };
}

export function validateBillingInvoice(value: BillingInvoice): void {
  assertUuid(value.id, "id");
  assertUuid(value.customerId, "customerId");
  assertStripeId(value.stripeInvoiceId, "stripeInvoiceId");
  if (typeof value.amountDue !== "number" || Number.isNaN(value.amountDue) || value.amountDue < 0) {
    throw new BillingValidationError("amountDue must be >= 0.", { field: "amountDue" });
  }
  assertCurrencyCode(value.currencyCode, "currencyCode");
  if (!isInvoiceStatus(value.status)) {
    throw new BillingValidationError(`Invalid invoice status "${value.status}".`, { field: "status" });
  }
  if (!(value.createdAt instanceof Date) || Number.isNaN(value.createdAt.getTime())) {
    throw new BillingValidationError("createdAt must be valid Date.", { field: "createdAt" });
  }
}

// ── Billing webhook event ────────────────────────────────────────────────────

export interface BillingWebhookEvent {
  id: string;
  stripeEventId: string;
  type: string;
  payload: Record<string, unknown>;
  processed: boolean;
  createdAt: Date;
}

export interface CreateBillingWebhookEventInput {
  stripeEventId: string;
  type: string;
  payload: Record<string, unknown>;
  processed?: boolean;
}

export function validateCreateBillingWebhookEventInput(input: CreateBillingWebhookEventInput): void {
  assertTrimmedLength(input.stripeEventId, "stripeEventId", 1, 120);
  assertTrimmedLength(input.type, "type", 1, 120);
  if (typeof input.payload !== "object" || input.payload === null || Array.isArray(input.payload)) {
    throw new BillingValidationError("payload must be a non-array object.", { field: "payload" });
  }
  if (input.processed !== undefined && typeof input.processed !== "boolean") {
    throw new BillingValidationError("processed must be a boolean.", { field: "processed" });
  }
}

export function createBillingWebhookEvent(input: CreateBillingWebhookEventInput): BillingWebhookEvent {
  validateCreateBillingWebhookEventInput(input);
  return {
    id: crypto.randomUUID(),
    stripeEventId: input.stripeEventId.trim(),
    type: input.type.trim(),
    payload: { ...input.payload },
    processed: input.processed ?? false,
    createdAt: new Date(),
  };
}

export function validateBillingWebhookEvent(value: BillingWebhookEvent): void {
  assertUuid(value.id, "id");
  assertTrimmedLength(value.stripeEventId, "stripeEventId", 1, 120);
  assertTrimmedLength(value.type, "type", 1, 120);
  if (typeof value.payload !== "object" || value.payload === null || Array.isArray(value.payload)) {
    throw new BillingValidationError("payload must be object.", { field: "payload" });
  }
  if (typeof value.processed !== "boolean") {
    throw new BillingValidationError("processed must be boolean.", { field: "processed" });
  }
  if (!(value.createdAt instanceof Date) || Number.isNaN(value.createdAt.getTime())) {
    throw new BillingValidationError("createdAt must be valid Date.", { field: "createdAt" });
  }
}

// ── Legacy types kept for backward compatibility (deprecated) ───────────────
// The billing package historically exported marketplace-adjacent types such as
// Payment / Commission. They remain for compilation compatibility but are no
// longer the canonical billing model. New code should use the Billing* types
// above and keep marketplace payments in `packages/domain` marketplace.

/** @deprecated use PlanCode instead */
export type LegacyPlanCode = PlanCode;

/** @deprecated marketplace payments live in `packages/domain` — do not reuse for billing */
export interface LegacyPayment {
  id: string;
  orderId: string | null;
  subscriptionId: string | null;
  userId: string;
  amountMinorUnits: number;
  currencyCode: string;
  status: string;
  provider: string | null;
  providerReference: string | null;
  createdAt: Date;
}
