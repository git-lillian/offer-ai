import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type {
  BillingCustomer,
  BillingEntitlement,
  BillingInvoice,
  BillingSubscription,
  BillingWebhookEvent,
  InvoiceStatus,
  PlanCode,
  SubscriptionStatus,
} from "@offer-ai/billing";

type Db = SupabaseClient<Database>;

// ── Mappers ───────────────────────────────────────────────────────────────────

function toBillingCustomer(
  row: Database["public"]["Tables"]["billing_customers"]["Row"],
): BillingCustomer {
  return {
    id: row.id,
    userId: row.user_id,
    stripeCustomerId: row.stripe_customer_id,
    createdAt: new Date(row.created_at),
  };
}

function toBillingSubscription(
  row: Database["public"]["Tables"]["billing_subscriptions"]["Row"],
): BillingSubscription {
  return {
    id: row.id,
    customerId: row.customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    planCode: row.plan_code as PlanCode,
    status: row.status as SubscriptionStatus,
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
    createdAt: new Date(row.created_at),
  };
}

function toBillingEntitlement(
  row: Database["public"]["Tables"]["billing_entitlements"]["Row"],
): BillingEntitlement {
  return {
    id: row.id,
    customerId: row.customer_id,
    featureCode: row.feature_code,
    grantedAt: new Date(row.granted_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  };
}

function toBillingInvoice(
  row: Database["public"]["Tables"]["billing_invoices"]["Row"],
): BillingInvoice {
  return {
    id: row.id,
    customerId: row.customer_id,
    stripeInvoiceId: row.stripe_invoice_id,
    amountDue: Number(row.amount_due),
    currencyCode: row.currency_code,
    status: row.status as InvoiceStatus,
    createdAt: new Date(row.created_at),
  };
}

function toBillingWebhookEvent(
  row: Database["public"]["Tables"]["billing_webhook_events"]["Row"],
): BillingWebhookEvent {
  return {
    id: row.id,
    stripeEventId: row.stripe_event_id,
    type: row.type,
    payload: (row.payload as Record<string, unknown>) ?? {},
    processed: row.processed,
    createdAt: new Date(row.created_at),
  };
}

// ── Customer repository ──────────────────────────────────────────────────────

export class BillingCustomerRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<BillingCustomer | null> {
    const { data, error } = await this.db.from("billing_customers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toBillingCustomer(data);
  }

  async findByUserId(userId: string): Promise<BillingCustomer | null> {
    const { data, error } = await this.db
      .from("billing_customers")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toBillingCustomer(data);
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<BillingCustomer | null> {
    const { data, error } = await this.db
      .from("billing_customers")
      .select("*")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toBillingCustomer(data);
  }

  async create(customer: BillingCustomer): Promise<BillingCustomer> {
    const { data, error } = await this.db
      .from("billing_customers")
      .insert({
        id: customer.id,
        user_id: customer.userId,
        stripe_customer_id: customer.stripeCustomerId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toBillingCustomer(data);
  }

  async upsertStripeCustomerId(id: string, stripeCustomerId: string): Promise<BillingCustomer> {
    const { data, error } = await this.db
      .from("billing_customers")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toBillingCustomer(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("billing_customers").delete().eq("id", id);
    if (error) throw error;
  }
}

// ── Subscription repository ──────────────────────────────────────────────────

export class BillingSubscriptionRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<BillingSubscription | null> {
    const { data, error } = await this.db.from("billing_subscriptions").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toBillingSubscription(data);
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<BillingSubscription | null> {
    const { data, error } = await this.db
      .from("billing_subscriptions")
      .select("*")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toBillingSubscription(data);
  }

  async listByCustomer(customerId: string): Promise<BillingSubscription[]> {
    const { data, error } = await this.db
      .from("billing_subscriptions")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toBillingSubscription);
  }

  async findActiveByCustomer(customerId: string): Promise<BillingSubscription | null> {
    const { data, error } = await this.db
      .from("billing_subscriptions")
      .select("*")
      .eq("customer_id", customerId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toBillingSubscription(data);
  }

  async create(subscription: BillingSubscription): Promise<BillingSubscription> {
    const { data, error } = await this.db
      .from("billing_subscriptions")
      .insert({
        id: subscription.id,
        customer_id: subscription.customerId,
        stripe_subscription_id: subscription.stripeSubscriptionId,
        plan_code: subscription.planCode,
        status: subscription.status,
        current_period_end: subscription.currentPeriodEnd?.toISOString() ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toBillingSubscription(data);
  }

  async update(subscription: BillingSubscription): Promise<BillingSubscription> {
    const { data, error } = await this.db
      .from("billing_subscriptions")
      .update({
        plan_code: subscription.planCode,
        status: subscription.status,
        stripe_subscription_id: subscription.stripeSubscriptionId,
        current_period_end: subscription.currentPeriodEnd?.toISOString() ?? null,
      })
      .eq("id", subscription.id)
      .select("*")
      .single();
    if (error) throw error;
    return toBillingSubscription(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("billing_subscriptions").delete().eq("id", id);
    if (error) throw error;
  }
}

// ── Entitlement repository ───────────────────────────────────────────────────

export class BillingEntitlementRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<BillingEntitlement | null> {
    const { data, error } = await this.db.from("billing_entitlements").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toBillingEntitlement(data);
  }

  async listByCustomer(customerId: string): Promise<BillingEntitlement[]> {
    const { data, error } = await this.db
      .from("billing_entitlements")
      .select("*")
      .eq("customer_id", customerId)
      .order("granted_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toBillingEntitlement);
  }

  async listActiveByCustomer(customerId: string, now: Date = new Date()): Promise<BillingEntitlement[]> {
    const { data, error } = await this.db
      .from("billing_entitlements")
      .select("*")
      .eq("customer_id", customerId)
      .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
      .order("granted_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toBillingEntitlement);
  }

  async hasFeature(customerId: string, featureCode: string, now: Date = new Date()): Promise<boolean> {
    const { data, error } = await this.db
      .from("billing_entitlements")
      .select("id, expires_at")
      .eq("customer_id", customerId)
      .eq("feature_code", featureCode)
      .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }

  async create(entitlement: BillingEntitlement): Promise<BillingEntitlement> {
    const { data, error } = await this.db
      .from("billing_entitlements")
      .insert({
        id: entitlement.id,
        customer_id: entitlement.customerId,
        feature_code: entitlement.featureCode,
        granted_at: entitlement.grantedAt.toISOString(),
        expires_at: entitlement.expiresAt?.toISOString() ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toBillingEntitlement(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("billing_entitlements").delete().eq("id", id);
    if (error) throw error;
  }

  async deleteByCustomerAndFeature(customerId: string, featureCode: string): Promise<void> {
    const { error } = await this.db
      .from("billing_entitlements")
      .delete()
      .eq("customer_id", customerId)
      .eq("feature_code", featureCode);
    if (error) throw error;
  }
}

// ── Invoice repository ───────────────────────────────────────────────────────

export class BillingInvoiceRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<BillingInvoice | null> {
    const { data, error } = await this.db.from("billing_invoices").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toBillingInvoice(data);
  }

  async findByStripeInvoiceId(stripeInvoiceId: string): Promise<BillingInvoice | null> {
    const { data, error } = await this.db
      .from("billing_invoices")
      .select("*")
      .eq("stripe_invoice_id", stripeInvoiceId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toBillingInvoice(data);
  }

  async listByCustomer(customerId: string): Promise<BillingInvoice[]> {
    const { data, error } = await this.db
      .from("billing_invoices")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toBillingInvoice);
  }

  async create(invoice: BillingInvoice): Promise<BillingInvoice> {
    const { data, error } = await this.db
      .from("billing_invoices")
      .insert({
        id: invoice.id,
        customer_id: invoice.customerId,
        stripe_invoice_id: invoice.stripeInvoiceId,
        amount_due: invoice.amountDue,
        currency_code: invoice.currencyCode,
        status: invoice.status,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toBillingInvoice(data);
  }

  async update(invoice: BillingInvoice): Promise<BillingInvoice> {
    const { data, error } = await this.db
      .from("billing_invoices")
      .update({
        status: invoice.status,
        amount_due: invoice.amountDue,
        currency_code: invoice.currencyCode,
        stripe_invoice_id: invoice.stripeInvoiceId,
      })
      .eq("id", invoice.id)
      .select("*")
      .single();
    if (error) throw error;
    return toBillingInvoice(data);
  }
}

// ── Webhook event repository ─────────────────────────────────────────────────

export class BillingWebhookEventRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<BillingWebhookEvent | null> {
    const { data, error } = await this.db.from("billing_webhook_events").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toBillingWebhookEvent(data);
  }

  async findByStripeEventId(stripeEventId: string): Promise<BillingWebhookEvent | null> {
    const { data, error } = await this.db
      .from("billing_webhook_events")
      .select("*")
      .eq("stripe_event_id", stripeEventId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toBillingWebhookEvent(data);
  }

  async exists(stripeEventId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from("billing_webhook_events")
      .select("id")
      .eq("stripe_event_id", stripeEventId)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }

  async listUnprocessed(limit = 20): Promise<BillingWebhookEvent[]> {
    const { data, error } = await this.db
      .from("billing_webhook_events")
      .select("*")
      .eq("processed", false)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toBillingWebhookEvent);
  }

  async create(event: BillingWebhookEvent): Promise<BillingWebhookEvent> {
    const { data, error } = await this.db
      .from("billing_webhook_events")
      .insert({
        id: event.id,
        stripe_event_id: event.stripeEventId,
        type: event.type,
        payload: event.payload as never,
        processed: event.processed,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toBillingWebhookEvent(data);
  }

  async markProcessed(id: string): Promise<BillingWebhookEvent> {
    const { data, error } = await this.db
      .from("billing_webhook_events")
      .update({ processed: true })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toBillingWebhookEvent(data);
  }

  async markProcessedByStripeId(stripeEventId: string): Promise<BillingWebhookEvent | null> {
    const { data, error } = await this.db
      .from("billing_webhook_events")
      .update({ processed: true })
      .eq("stripe_event_id", stripeEventId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toBillingWebhookEvent(data);
  }
}
