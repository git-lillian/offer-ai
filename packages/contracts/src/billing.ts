import { z } from "zod";

/**
 * Billing contracts — validates every billing boundary with zod.
 *
 * Covers platform subscriptions (SaaS) which remain separate from
 * marketplace service-order payments (see docs/architecture/marketplace.md).
 * Never merged into a single `payments` boolean.
 *
 * Stripe signature validation (stripe.webhooks.constructEvent) is planned
 * at the route handler layer but not implemented in this foundation;
 * these schemas only validate the JSON shape after the raw body has been
 * verified.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export const planCodeSchema = z.enum(["free", "premium", "pro"]);
export type PlanCodeInput = z.infer<typeof planCodeSchema>;

export const subscriptionStatusSchema = z.enum(["active", "past_due", "cancelled", "incomplete"]);
export type SubscriptionStatusInput = z.infer<typeof subscriptionStatusSchema>;

export const invoiceStatusSchema = z.enum(["draft", "open", "paid", "void"]);
export type InvoiceStatusInput = z.infer<typeof invoiceStatusSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

const currencyCodeRegex = /^[A-Z]{3}$/;

// ── Billing customer ─────────────────────────────────────────────────────────

export const billingCustomerDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  stripeCustomerId: z.string().min(1).max(120).nullable(),
  createdAt: z.string().datetime(),
});

export type BillingCustomerDto = z.infer<typeof billingCustomerDtoSchema>;

export const createBillingCustomerSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID."),
  stripeCustomerId: z.string().trim().min(1).max(120).nullable().optional(),
});

export type CreateBillingCustomerInput = z.infer<typeof createBillingCustomerSchema>;

// ── Billing subscription ─────────────────────────────────────────────────────

export const billingSubscriptionDtoSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  stripeSubscriptionId: z.string().min(1).max(120).nullable(),
  planCode: planCodeSchema,
  status: subscriptionStatusSchema,
  currentPeriodEnd: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type BillingSubscriptionDto = z.infer<typeof billingSubscriptionDtoSchema>;

export const createSubscriptionSchema = z.object({
  customerId: z.string().uuid("customerId must be a valid UUID."),
  planCode: planCodeSchema,
  stripeSubscriptionId: z.string().trim().min(1).max(120).nullable().optional(),
  status: subscriptionStatusSchema.default("incomplete"),
  currentPeriodEnd: z.string().datetime().nullable().optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const updateSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  planCode: planCodeSchema.optional(),
  status: subscriptionStatusSchema.optional(),
  currentPeriodEnd: z.string().datetime().nullable().optional(),
});

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

export const listSubscriptionsSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: subscriptionStatusSchema.optional(),
});

export type ListSubscriptionsInput = z.infer<typeof listSubscriptionsSchema>;

export const listSubscriptionsResponseSchema = z.object({
  subscriptions: z.array(billingSubscriptionDtoSchema),
});

export type ListSubscriptionsResponse = z.infer<typeof listSubscriptionsResponseSchema>;

// ── Billing entitlement ──────────────────────────────────────────────────────

export const billingEntitlementDtoSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  featureCode: z.string().min(1).max(120),
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
});

export type BillingEntitlementDto = z.infer<typeof billingEntitlementDtoSchema>;

export const createEntitlementSchema = z.object({
  customerId: z.string().uuid("customerId must be a valid UUID."),
  featureCode: z.string().trim().min(1, "featureCode is required.").max(120),
  expiresAt: z.string().datetime().nullable().optional(),
});

export type CreateEntitlementInput = z.infer<typeof createEntitlementSchema>;

export const canAccessFeatureSchema = z.object({
  customerId: z.string().uuid().optional(),
  featureCode: z.string().trim().min(1, "featureCode is required.").max(120),
});

export type CanAccessFeatureInput = z.infer<typeof canAccessFeatureSchema>;

export const canAccessFeatureResponseSchema = z.object({
  hasAccess: z.boolean(),
  featureCode: z.string(),
});

export type CanAccessFeatureResponse = z.infer<typeof canAccessFeatureResponseSchema>;

// ── Billing invoice ──────────────────────────────────────────────────────────

export const billingInvoiceDtoSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  stripeInvoiceId: z.string().min(1).max(120).nullable(),
  amountDue: z.number().min(0),
  currencyCode: z.string().regex(currencyCodeRegex, "currencyCode must be ISO 4217"),
  status: invoiceStatusSchema,
  createdAt: z.string().datetime(),
});

export type BillingInvoiceDto = z.infer<typeof billingInvoiceDtoSchema>;

export const createInvoiceSchema = z.object({
  customerId: z.string().uuid("customerId must be a valid UUID."),
  stripeInvoiceId: z.string().trim().min(1).max(120).nullable().optional(),
  amountDue: z.number().min(0).max(1000000),
  currencyCode: z.string().regex(currencyCodeRegex, "currencyCode must be ISO 4217"),
  status: invoiceStatusSchema.default("draft"),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const listInvoicesSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: invoiceStatusSchema.optional(),
});

export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;

export const listInvoicesResponseSchema = z.object({
  invoices: z.array(billingInvoiceDtoSchema),
});

export type ListInvoicesResponse = z.infer<typeof listInvoicesResponseSchema>;

// ── Billing webhook event ────────────────────────────────────────────────────

/**
 * Shape for incoming Stripe webhook payloads.
 * The raw body signature is verified at the route handler before this schema
 * runs (planned: stripe.webhooks.constructEvent). This schema validates the
 * parsed JSON shape.
 */
export const stripeWebhookPayloadSchema = z.object({
  id: z.string().min(1, "Stripe event id is required.").max(120),
  type: z.string().min(1, "Stripe event type is required.").max(120),
  data: z.object({
    object: z.record(z.unknown()),
    previous_attributes: z.record(z.unknown()).optional(),
  }),
  created: z.number().optional(),
  livemode: z.boolean().optional(),
  api_version: z.string().optional(),
  request: z
    .object({
      id: z.string().nullable().optional(),
      idempotency_key: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type StripeWebhookPayload = z.infer<typeof stripeWebhookPayloadSchema>;

export const billingWebhookEventDtoSchema = z.object({
  id: z.string().uuid(),
  stripeEventId: z.string().min(1).max(120),
  type: z.string().min(1).max(120),
  payload: z.record(z.unknown()),
  processed: z.boolean(),
  createdAt: z.string().datetime(),
});

export type BillingWebhookEventDto = z.infer<typeof billingWebhookEventDtoSchema>;

export const handleWebhookEventSchema = z.object({
  stripeEventId: z.string().trim().min(1, "stripeEventId is required.").max(120),
  type: z.string().trim().min(1, "type is required.").max(120),
  payload: z.record(z.unknown()),
});

export type HandleWebhookEventInput = z.infer<typeof handleWebhookEventSchema>;

// ── Proration ────────────────────────────────────────────────────────────────

export const calculateProrationSchema = z.object({
  amount: z.number().min(0).max(1000000),
  daysRemaining: z.number().int().min(0).max(366),
  totalDays: z.number().int().min(1).max(366),
});

export type CalculateProrationInput = z.infer<typeof calculateProrationSchema>;

export const calculatePlanChangeProrationSchema = z.object({
  oldAmount: z.number().min(0).max(1000000),
  newAmount: z.number().min(0).max(1000000),
  daysRemaining: z.number().int().min(0).max(366),
  totalDays: z.number().int().min(1).max(366),
});

export type CalculatePlanChangeProrationInput = z.infer<typeof calculatePlanChangeProrationSchema>;
