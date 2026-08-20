"use server";

import { revalidatePath } from "next/cache";
import {
  createBillingCustomerSchema,
  createEntitlementSchema,
  createInvoiceSchema,
  createSubscriptionSchema,
} from "@offer-ai/contracts";
import { isBillingError } from "@offer-ai/billing";
import { requireUser } from "@/lib/auth";
import { createBillingServiceWithServiceRole } from "@/lib/services/billing";

export type BillingActionState = {
  error?: string;
  ok?: boolean;
  customerId?: string;
  subscriptionId?: string;
  entitlementId?: string;
  invoiceId?: string;
};

export async function createBillingCustomerAction(
  _prevState: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    const user = await requireUser();
    const rawStripe = formData.get("stripeCustomerId");
    const candidate = {
      // userId derived from session, not form
      userId: user.id,
      stripeCustomerId: rawStripe ? String(rawStripe) : null,
    };

    const parsedShape = createBillingCustomerSchema.safeParse(candidate);
    if (!parsedShape.success) {
      return { error: parsedShape.error.issues[0]?.message ?? "Invalid input." };
    }

    const service = createBillingServiceWithServiceRole();
    const customer = await service.createCustomerForUser(user.id, {
      stripeCustomerId: parsedShape.data.stripeCustomerId ?? null,
    });
    revalidatePath("/billing");
    return { ok: true, customerId: customer.id };
  } catch (error) {
    if (isBillingError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to create billing customer." };
  }
}

export async function createSubscriptionAction(
  _prevState: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const customerIdRaw = formData.get("customerId");
  const planCodeRaw = formData.get("planCode");
  const stripeSubscriptionIdRaw = formData.get("stripeSubscriptionId");
  const statusRaw = formData.get("status");
  const currentPeriodEndRaw = formData.get("currentPeriodEnd");

  // If customerId not provided, resolve from current user's customer
  let customerId = customerIdRaw ? String(customerIdRaw) : "";

  try {
    const user = await requireUser();
    const service = createBillingServiceWithServiceRole();

    if (!customerId) {
      const customer = await service.getCustomerForUser(user.id);
      if (!customer) {
        // Auto-create customer if missing
        const created = await service.ensureCustomerForUser(user.id);
        customerId = created.id;
      } else {
        customerId = customer.id;
      }
    }

    const raw = {
      customerId,
      planCode: String(planCodeRaw ?? ""),
      stripeSubscriptionId: stripeSubscriptionIdRaw ? String(stripeSubscriptionIdRaw) : null,
      status: statusRaw ? String(statusRaw) : "incomplete",
      currentPeriodEnd: currentPeriodEndRaw ? String(currentPeriodEndRaw) : null,
    };

    const parsed = createSubscriptionSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const subscription = await service.createSubscriptionForUser(user.id, {
      customerId: parsed.data.customerId,
      planCode: parsed.data.planCode,
      stripeSubscriptionId: parsed.data.stripeSubscriptionId ?? null,
      status: parsed.data.status,
      currentPeriodEnd: parsed.data.currentPeriodEnd ?? null,
    });

    revalidatePath("/billing");
    return { ok: true, subscriptionId: subscription.id };
  } catch (error) {
    if (isBillingError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to create subscription." };
  }
}

export async function createEntitlementAction(
  _prevState: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const customerIdRaw = formData.get("customerId");
  const featureCodeRaw = formData.get("featureCode");
  const expiresAtRaw = formData.get("expiresAt");

  try {
    const user = await requireUser();
    const service = createBillingServiceWithServiceRole();

    let customerId = customerIdRaw ? String(customerIdRaw) : "";
    if (!customerId) {
      const customer = await service.getCustomerForUser(user.id);
      if (!customer) {
        return { error: "Billing customer not found. Create a customer first." };
      }
      customerId = customer.id;
    }

    const raw = {
      customerId,
      featureCode: String(featureCodeRaw ?? ""),
      expiresAt: expiresAtRaw ? String(expiresAtRaw) : null,
    };

    const parsed = createEntitlementSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const entitlement = await service.createEntitlementForUser(user.id, {
      customerId: parsed.data.customerId,
      featureCode: parsed.data.featureCode,
      expiresAt: parsed.data.expiresAt ?? null,
    });

    revalidatePath("/billing");
    return { ok: true, entitlementId: entitlement.id };
  } catch (error) {
    if (isBillingError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to create entitlement." };
  }
}

export async function createInvoiceAction(
  _prevState: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const customerIdRaw = formData.get("customerId");
  const stripeInvoiceIdRaw = formData.get("stripeInvoiceId");
  const amountDueRaw = formData.get("amountDue");
  const currencyCodeRaw = formData.get("currencyCode");
  const statusRaw = formData.get("status");

  try {
    const user = await requireUser();
    const service = createBillingServiceWithServiceRole();

    let customerId = customerIdRaw ? String(customerIdRaw) : "";
    if (!customerId) {
      const customer = await service.getCustomerForUser(user.id);
      if (!customer) {
        return { error: "Billing customer not found. Create a customer first." };
      }
      customerId = customer.id;
    }

    const raw = {
      customerId,
      stripeInvoiceId: stripeInvoiceIdRaw ? String(stripeInvoiceIdRaw) : null,
      amountDue: amountDueRaw !== null && amountDueRaw !== "" ? Number(amountDueRaw) : Number.NaN,
      currencyCode: String(currencyCodeRaw ?? "GBP").toUpperCase(),
      status: String(statusRaw ?? "draft"),
    };

    const parsed = createInvoiceSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const invoice = await service.createInvoiceForUser(user.id, {
      customerId: parsed.data.customerId,
      stripeInvoiceId: parsed.data.stripeInvoiceId ?? null,
      amountDue: parsed.data.amountDue,
      currencyCode: parsed.data.currencyCode,
      status: parsed.data.status,
    });

    revalidatePath("/billing");
    return { ok: true, invoiceId: invoice.id };
  } catch (error) {
    if (isBillingError(error)) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Unable to create invoice." };
  }
}

// Aliases matching task description (createSubscription, etc.)
export const createSubscription = createSubscriptionAction;
export const createEntitlement = createEntitlementAction;
export const createInvoice = createInvoiceAction;
export const createBillingCustomer = createBillingCustomerAction;
