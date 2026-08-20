import "server-only";

import {
  BillingCustomerRepository,
  BillingEntitlementRepository,
  BillingInvoiceRepository,
  BillingSubscriptionRepository,
  BillingWebhookEventRepository,
} from "@offer-ai/database";
import type { Database } from "@offer-ai/database";
import { BillingService } from "@offer-ai/billing";
import {
  BillingConflictError,
  BillingNotFoundError,
  BillingValidationError,
} from "@offer-ai/billing";
import type {
  BillingCustomer,
  BillingEntitlement,
  BillingInvoice,
  BillingSubscription,
  BillingWebhookEvent,
  CreateBillingCustomerInput,
  CreateBillingEntitlementInput,
  CreateBillingInvoiceInput,
  CreateBillingSubscriptionInput,
  CreateBillingWebhookEventInput,
} from "@offer-ai/billing";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";

type DbClient = SupabaseClient<Database>;

const billingDomain = new BillingService();

// ── DTO mappers (domain -> API shape) ──────────────────────────────────────

export function toCustomerDto(customer: BillingCustomer) {
  return {
    id: customer.id,
    userId: customer.userId,
    stripeCustomerId: customer.stripeCustomerId,
    createdAt: customer.createdAt.toISOString(),
  };
}

export function toSubscriptionDto(subscription: BillingSubscription) {
  return {
    id: subscription.id,
    customerId: subscription.customerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    planCode: subscription.planCode,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd ? subscription.currentPeriodEnd.toISOString() : null,
    createdAt: subscription.createdAt.toISOString(),
  };
}

export function toEntitlementDto(entitlement: BillingEntitlement) {
  return {
    id: entitlement.id,
    customerId: entitlement.customerId,
    featureCode: entitlement.featureCode,
    grantedAt: entitlement.grantedAt.toISOString(),
    expiresAt: entitlement.expiresAt ? entitlement.expiresAt.toISOString() : null,
  };
}

export function toInvoiceDto(invoice: BillingInvoice) {
  return {
    id: invoice.id,
    customerId: invoice.customerId,
    stripeInvoiceId: invoice.stripeInvoiceId,
    amountDue: invoice.amountDue,
    currencyCode: invoice.currencyCode,
    status: invoice.status,
    createdAt: invoice.createdAt.toISOString(),
  };
}

export function toWebhookEventDto(event: BillingWebhookEvent) {
  return {
    id: event.id,
    stripeEventId: event.stripeEventId,
    type: event.type,
    payload: event.payload,
    processed: event.processed,
    createdAt: event.createdAt.toISOString(),
  };
}

// ── Application service ────────────────────────────────────────────────────

export class BillingApplicationService {
  constructor(private readonly supabase: DbClient) {}

  // ── Customers ──────────────────────────────────────────────────────────

  async getCustomerForUser(userId: string): Promise<BillingCustomer | null> {
    const repo = new BillingCustomerRepository(this.supabase);
    return repo.findByUserId(userId);
  }

  async getCustomerById(customerId: string): Promise<BillingCustomer | null> {
    const repo = new BillingCustomerRepository(this.supabase);
    return repo.findById(customerId);
  }

  async createCustomerForUser(
    userId: string,
    input: { stripeCustomerId?: string | null },
  ): Promise<BillingCustomer> {
    const repo = new BillingCustomerRepository(this.supabase);
    const existing = await repo.findByUserId(userId);
    if (existing) {
      throw new BillingConflictError("Billing customer already exists for this user.");
    }

    const domainInput: CreateBillingCustomerInput = {
      userId,
      stripeCustomerId: input.stripeCustomerId ?? null,
    };

    const customer = billingDomain.createCustomer(domainInput);
    return repo.create(customer);
  }

  async ensureCustomerForUser(userId: string): Promise<BillingCustomer> {
    const existing = await this.getCustomerForUser(userId);
    if (existing) return existing;
    // Use service client for creation if current client is RLS-restricted and lacks insert policy.
    // If this.supabase is already service role, direct create works.
    // Otherwise fallback to service client.
    const repo = new BillingCustomerRepository(this.supabase);
    const domainInput: CreateBillingCustomerInput = {
      userId,
      stripeCustomerId: null,
    };
    const customer = billingDomain.createCustomer(domainInput);
    try {
      return await repo.create(customer);
    } catch {
      // If RLS blocked, retry with service client
      const service = getServiceClient();
      const serviceRepo = new BillingCustomerRepository(service);
      const already = await serviceRepo.findByUserId(userId);
      if (already) return already;
      return serviceRepo.create(customer);
    }
  }

  // ── Subscriptions ──────────────────────────────────────────────────────

  async listSubscriptionsForUser(userId: string): Promise<BillingSubscription[]> {
    const customer = await this.getCustomerForUser(userId);
    if (!customer) return [];
    const repo = new BillingSubscriptionRepository(this.supabase);
    return repo.listByCustomer(customer.id);
  }

  async getActiveSubscriptionForUser(userId: string): Promise<BillingSubscription | null> {
    const customer = await this.getCustomerForUser(userId);
    if (!customer) return null;
    const repo = new BillingSubscriptionRepository(this.supabase);
    return repo.findActiveByCustomer(customer.id);
  }

  async getSubscriptionByIdForUser(
    userId: string,
    subscriptionId: string,
  ): Promise<BillingSubscription> {
    const customer = await this.getCustomerForUser(userId);
    if (!customer) {
      throw new BillingNotFoundError("Billing customer not found.");
    }
    const repo = new BillingSubscriptionRepository(this.supabase);
    const subscription = await repo.findById(subscriptionId);
    if (!subscription) {
      throw new BillingNotFoundError("Subscription not found.");
    }
    if (subscription.customerId !== customer.id) {
      throw new BillingNotFoundError("Subscription not found.");
    }
    return subscription;
  }

  async createSubscriptionForUser(
    userId: string,
    input: {
      customerId: string;
      planCode: CreateBillingSubscriptionInput["planCode"];
      stripeSubscriptionId?: string | null;
      status?: CreateBillingSubscriptionInput["status"];
      currentPeriodEnd?: string | null;
    },
  ): Promise<BillingSubscription> {
    const customerRepo = new BillingCustomerRepository(this.supabase);
    const customer = await customerRepo.findById(input.customerId);
    if (!customer) {
      throw new BillingNotFoundError("Billing customer not found.");
    }
    if (customer.userId !== userId) {
      throw new BillingNotFoundError("Billing customer not found.");
    }

    const currentPeriodEnd = input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : null;
    if (currentPeriodEnd && Number.isNaN(currentPeriodEnd.getTime())) {
      throw new BillingValidationError("currentPeriodEnd must be a valid date.", { field: "currentPeriodEnd" });
    }

    const domainInput: CreateBillingSubscriptionInput = {
      customerId: input.customerId,
      planCode: input.planCode,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      status: input.status ?? "incomplete",
      currentPeriodEnd,
    };

    const subscription = billingDomain.createSubscription(domainInput);
    const repo = new BillingSubscriptionRepository(this.supabase);
    return repo.create(subscription);
  }

  // ── Entitlements ───────────────────────────────────────────────────────

  async listEntitlementsForUser(userId: string): Promise<BillingEntitlement[]> {
    const customer = await this.getCustomerForUser(userId);
    if (!customer) return [];
    const repo = new BillingEntitlementRepository(this.supabase);
    return repo.listByCustomer(customer.id);
  }

  async listActiveEntitlementsForUser(userId: string): Promise<BillingEntitlement[]> {
    const customer = await this.getCustomerForUser(userId);
    if (!customer) return [];
    const repo = new BillingEntitlementRepository(this.supabase);
    return repo.listActiveByCustomer(customer.id);
  }

  async createEntitlementForUser(
    userId: string,
    input: {
      customerId: string;
      featureCode: string;
      expiresAt?: string | null;
    },
  ): Promise<BillingEntitlement> {
    const customerRepo = new BillingCustomerRepository(this.supabase);
    const customer = await customerRepo.findById(input.customerId);
    if (!customer) {
      throw new BillingNotFoundError("Billing customer not found.");
    }
    if (customer.userId !== userId) {
      throw new BillingNotFoundError("Billing customer not found.");
    }

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BillingValidationError("expiresAt must be a valid date.", { field: "expiresAt" });
    }

    const domainInput: CreateBillingEntitlementInput = {
      customerId: input.customerId,
      featureCode: input.featureCode,
      expiresAt,
    };

    const entitlement = billingDomain.createEntitlement(domainInput);
    const repo = new BillingEntitlementRepository(this.supabase);
    return repo.create(entitlement);
  }

  // ── Invoices ───────────────────────────────────────────────────────────

  async listInvoicesForUser(userId: string): Promise<BillingInvoice[]> {
    const customer = await this.getCustomerForUser(userId);
    if (!customer) return [];
    const repo = new BillingInvoiceRepository(this.supabase);
    return repo.listByCustomer(customer.id);
  }

  async getInvoiceByIdForUser(userId: string, invoiceId: string): Promise<BillingInvoice> {
    const customer = await this.getCustomerForUser(userId);
    if (!customer) {
      throw new BillingNotFoundError("Billing customer not found.");
    }
    const repo = new BillingInvoiceRepository(this.supabase);
    const invoice = await repo.findById(invoiceId);
    if (!invoice) {
      throw new BillingNotFoundError("Invoice not found.");
    }
    if (invoice.customerId !== customer.id) {
      throw new BillingNotFoundError("Invoice not found.");
    }
    return invoice;
  }

  async createInvoiceForUser(
    userId: string,
    input: {
      customerId: string;
      stripeInvoiceId?: string | null;
      amountDue: number;
      currencyCode: string;
      status: CreateBillingInvoiceInput["status"];
    },
  ): Promise<BillingInvoice> {
    const customerRepo = new BillingCustomerRepository(this.supabase);
    const customer = await customerRepo.findById(input.customerId);
    if (!customer) {
      throw new BillingNotFoundError("Billing customer not found.");
    }
    if (customer.userId !== userId) {
      throw new BillingNotFoundError("Billing customer not found.");
    }

    const domainInput: CreateBillingInvoiceInput = {
      customerId: input.customerId,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      amountDue: input.amountDue,
      currencyCode: input.currencyCode,
      status: input.status,
    };

    const invoice = billingDomain.createInvoice(domainInput);
    const repo = new BillingInvoiceRepository(this.supabase);
    return repo.create(invoice);
  }

  // ── Webhooks ───────────────────────────────────────────────────────────

  async handleWebhookEvent(input: { stripeEventId: string; type: string; payload: Record<string, unknown> }): Promise<BillingWebhookEvent> {
    const repo = new BillingWebhookEventRepository(this.supabase);
    const existing = await repo.exists(input.stripeEventId);
    const existingSet = existing ? new Set([input.stripeEventId]) : new Set<string>();

    const domainInput: CreateBillingWebhookEventInput = {
      stripeEventId: input.stripeEventId,
      type: input.type,
      payload: input.payload,
    };

    const result = billingDomain.handleWebhookEvent(domainInput, existingSet);
    return repo.create(result.event);
  }

  async listWebhookEvents(limit = 20): Promise<BillingWebhookEvent[]> {
    const repo = new BillingWebhookEventRepository(this.supabase);
    return repo.listUnprocessed(limit);
  }

  async listAllWebhookEvents(): Promise<BillingWebhookEvent[]> {
    // For admin view, list recent unprocessed + processed via raw query
    const { data, error } = await this.supabase
      .from("billing_webhook_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      stripeEventId: row.stripe_event_id,
      type: row.type,
      payload: (row.payload as Record<string, unknown>) ?? {},
      processed: row.processed,
      createdAt: new Date(row.created_at),
    }));
  }

  // ── Overview ───────────────────────────────────────────────────────────

  async getOverviewForUser(userId: string): Promise<{
    customer: BillingCustomer | null;
    subscriptions: BillingSubscription[];
    entitlements: BillingEntitlement[];
    invoices: BillingInvoice[];
  }> {
    const customer = await this.getCustomerForUser(userId);
    if (!customer) {
      return { customer: null, subscriptions: [], entitlements: [], invoices: [] };
    }
    const subRepo = new BillingSubscriptionRepository(this.supabase);
    const entRepo = new BillingEntitlementRepository(this.supabase);
    const invRepo = new BillingInvoiceRepository(this.supabase);

    const [subscriptions, entitlements, invoices] = await Promise.all([
      subRepo.listByCustomer(customer.id),
      entRepo.listByCustomer(customer.id),
      invRepo.listByCustomer(customer.id),
    ]);

    return { customer, subscriptions, entitlements, invoices };
  }
}

// ── Factories ────────────────────────────────────────────────────────────

export async function createBillingService(): Promise<BillingApplicationService> {
  const supabase = await getServerClient();
  return new BillingApplicationService(supabase);
}

export function createBillingServiceWithServiceRole(): BillingApplicationService {
  return new BillingApplicationService(getServiceClient());
}
