import { describe, it, expect } from "vitest";
import {
  createCustomer,
  createSubscription,
  createEntitlement,
  canAccessFeature,
  deriveEntitlementsForSubscription,
  calculateProration,
  calculatePlanChangeProration,
  handleWebhookEvent,
  markWebhookProcessed,
  isSubscriptionActive,
  transitionSubscription,
  getPlanEntitlements,
} from "./billing-service";
import { BillingValidationError, BillingConflictError } from "./errors";

describe("BillingService", () => {
  describe("createCustomer", () => {
    it("creates a customer with required fields", () => {
      const userId = crypto.randomUUID();
      const customer = createCustomer({ userId });
      expect(customer.userId).toBe(userId);
      expect(customer.stripeCustomerId).toBeNull();
      expect(customer.id).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it("creates with stripeCustomerId", () => {
      const userId = crypto.randomUUID();
      const customer = createCustomer({ userId, stripeCustomerId: "cus_123" });
      expect(customer.stripeCustomerId).toBe("cus_123");
    });

    it("throws on invalid userId", () => {
      expect(() => createCustomer({ userId: "not-uuid" })).toThrow(BillingValidationError);
    });

    it("throws on empty stripeCustomerId", () => {
      const userId = crypto.randomUUID();
      expect(() => createCustomer({ userId, stripeCustomerId: "   " })).toThrow(BillingValidationError);
    });
  });

  describe("createSubscription", () => {
    it("creates subscription with defaults", () => {
      const customerId = crypto.randomUUID();
      const sub = createSubscription({ customerId, planCode: "premium" });
      expect(sub.customerId).toBe(customerId);
      expect(sub.planCode).toBe("premium");
      expect(sub.status).toBe("incomplete");
      expect(sub.currentPeriodEnd).toBeNull();
    });

    it("creates active subscription with period end", () => {
      const customerId = crypto.randomUUID();
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const sub = createSubscription({
        customerId,
        planCode: "pro",
        status: "active",
        currentPeriodEnd: periodEnd,
      });
      expect(sub.status).toBe("active");
      expect(sub.currentPeriodEnd?.toISOString()).toBe(periodEnd.toISOString());
    });

    it("throws on invalid planCode", () => {
      const customerId = crypto.randomUUID();
      expect(() =>
        createSubscription({ customerId, planCode: "enterprise" as unknown as "premium" }),
      ).toThrow(BillingValidationError);
    });

    it("throws on invalid status", () => {
      const customerId = crypto.randomUUID();
      expect(() =>
        createSubscription({
          customerId,
          planCode: "free",
          status: "unknown" as unknown as "active",
        }),
      ).toThrow(BillingValidationError);
    });

    it("throws on invalid customerId", () => {
      expect(() => createSubscription({ customerId: "bad", planCode: "free" })).toThrow(
        BillingValidationError,
      );
    });
  });

  describe("isSubscriptionActive", () => {
    it("returns true for active with future period end", () => {
      const customerId = crypto.randomUUID();
      const sub = createSubscription({
        customerId,
        planCode: "premium",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 60_000),
      });
      expect(isSubscriptionActive(sub)).toBe(true);
    });

    it("returns false for past_due", () => {
      const customerId = crypto.randomUUID();
      const sub = createSubscription({
        customerId,
        planCode: "premium",
        status: "past_due",
        currentPeriodEnd: new Date(Date.now() + 60_000),
      });
      expect(isSubscriptionActive(sub)).toBe(false);
    });

    it("returns false for expired period", () => {
      const customerId = crypto.randomUUID();
      const sub = createSubscription({
        customerId,
        planCode: "premium",
        status: "active",
        currentPeriodEnd: new Date(Date.now() - 60_000),
      });
      expect(isSubscriptionActive(sub, new Date())).toBe(false);
    });

    it("returns true for active with null period end (lifetime)", () => {
      const customerId = crypto.randomUUID();
      const sub = createSubscription({ customerId, planCode: "premium", status: "active" });
      expect(isSubscriptionActive(sub)).toBe(true);
    });
  });

  describe("transitionSubscription", () => {
    it("allows incomplete -> active", () => {
      const customerId = crypto.randomUUID();
      const sub = createSubscription({ customerId, planCode: "free", status: "incomplete" });
      const next = transitionSubscription(sub, "active");
      expect(next.status).toBe("active");
    });

    it("rejects cancelled -> active", () => {
      const customerId = crypto.randomUUID();
      const sub = createSubscription({ customerId, planCode: "free", status: "cancelled" });
      expect(() => transitionSubscription(sub, "active")).toThrow(BillingValidationError);
    });

    it("allows active -> cancelled", () => {
      const customerId = crypto.randomUUID();
      const sub = createSubscription({ customerId, planCode: "pro", status: "active" });
      const next = transitionSubscription(sub, "cancelled");
      expect(next.status).toBe("cancelled");
    });
  });

  describe("canAccessFeature", () => {
    it("returns true when entitlement matches and not expired", () => {
      const customerId = crypto.randomUUID();
      const ent = createEntitlement({ customerId, featureCode: "ai_assistance" });
      expect(canAccessFeature([ent], "ai_assistance")).toBe(true);
    });

    it("returns false when feature not entitled", () => {
      const customerId = crypto.randomUUID();
      const ent = createEntitlement({ customerId, featureCode: "basic_search" });
      expect(canAccessFeature([ent], "ai_assistance")).toBe(false);
    });

    it("returns false when entitlement expired", () => {
      const customerId = crypto.randomUUID();
      const grantedAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const ent = createEntitlement({ customerId, featureCode: "ai_assistance", grantedAt, expiresAt });
      expect(canAccessFeature([ent], "ai_assistance")).toBe(false);
    });

    it("returns true when expiresAt is null (permanent)", () => {
      const customerId = crypto.randomUUID();
      const ent = createEntitlement({ customerId, featureCode: "premium_articles", expiresAt: null });
      expect(canAccessFeature([ent], "premium_articles", new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))).toBe(
        true,
      );
    });

    it("throws on empty featureCode", () => {
      const customerId = crypto.randomUUID();
      const ent = createEntitlement({ customerId, featureCode: "basic_search" });
      expect(() => canAccessFeature([ent], "   ")).toThrow(BillingValidationError);
    });

    it("handles multiple entitlements", () => {
      const customerId = crypto.randomUUID();
      const e1 = createEntitlement({ customerId, featureCode: "basic_search" });
      const e2 = createEntitlement({ customerId, featureCode: "premium_articles" });
      expect(canAccessFeature([e1, e2], "premium_articles")).toBe(true);
      expect(canAccessFeature([e1, e2], "adviser_access")).toBe(false);
    });
  });

  describe("deriveEntitlementsForSubscription", () => {
    it("derives correct entitlements for free plan", () => {
      const customerId = crypto.randomUUID();
      const sub = createSubscription({ customerId, planCode: "free", status: "active" });
      const ents = deriveEntitlementsForSubscription(sub);
      expect(ents.map((e) => e.featureCode)).toEqual(["basic_search"]);
    });

    it("derives correct entitlements for pro plan", () => {
      const customerId = crypto.randomUUID();
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const sub = createSubscription({
        customerId,
        planCode: "pro",
        status: "active",
        currentPeriodEnd: periodEnd,
      });
      const ents = deriveEntitlementsForSubscription(sub);
      expect(ents.map((e) => e.featureCode)).toEqual(
        expect.arrayContaining(["adviser_access", "priority_support"]),
      );
      for (const ent of ents) {
        expect(ent.customerId).toBe(customerId);
        expect(ent.expiresAt?.toISOString()).toBe(periodEnd.toISOString());
      }
    });
  });

  describe("calculateProration", () => {
    it("calculates half period", () => {
      expect(calculateProration({ amount: 100, daysRemaining: 15, totalDays: 30 })).toBe(50);
    });

    it("calculates zero remaining", () => {
      expect(calculateProration({ amount: 100, daysRemaining: 0, totalDays: 30 })).toBe(0);
    });

    it("calculates full period", () => {
      expect(calculateProration({ amount: 120, daysRemaining: 30, totalDays: 30 })).toBe(120);
    });

    it("rounds to 2 decimals", () => {
      expect(calculateProration({ amount: 10, daysRemaining: 10, totalDays: 30 })).toBe(3.33);
    });

    it("throws on negative amount", () => {
      expect(() => calculateProration({ amount: -5, daysRemaining: 10, totalDays: 30 })).toThrow(
        BillingValidationError,
      );
    });

    it("throws when daysRemaining exceeds totalDays", () => {
      expect(() => calculateProration({ amount: 100, daysRemaining: 31, totalDays: 30 })).toThrow(
        BillingValidationError,
      );
    });

    it("throws on zero totalDays", () => {
      expect(() => calculateProration({ amount: 100, daysRemaining: 0, totalDays: 0 })).toThrow(
        BillingValidationError,
      );
    });
  });

  describe("calculatePlanChangeProration", () => {
    it("calculates net proration for upgrade", () => {
      const net = calculatePlanChangeProration({
        oldAmount: 50,
        newAmount: 100,
        daysRemaining: 15,
        totalDays: 30,
      });
      expect(net).toBe(25); // (50 prorated)
    });

    it("calculates negative for downgrade", () => {
      const net = calculatePlanChangeProration({
        oldAmount: 100,
        newAmount: 50,
        daysRemaining: 15,
        totalDays: 30,
      });
      expect(net).toBe(-25);
    });

    it("zero when same amount", () => {
      const net = calculatePlanChangeProration({
        oldAmount: 100,
        newAmount: 100,
        daysRemaining: 15,
        totalDays: 30,
      });
      expect(net).toBe(0);
    });
  });

  describe("handleWebhookEvent", () => {
    it("creates and marks shouldProcess true for new event", () => {
      const existing = new Set<string>();
      const result = handleWebhookEvent(
        { stripeEventId: "evt_123", type: "invoice.paid", payload: { id: "in_123" } },
        existing,
      );
      expect(result.shouldProcess).toBe(true);
      expect(result.event.stripeEventId).toBe("evt_123");
      expect(result.event.processed).toBe(false);
    });

    it("throws BillingConflictError on duplicate", () => {
      const existing = new Set<string>(["evt_dup"]);
      expect(() =>
        handleWebhookEvent(
          { stripeEventId: "evt_dup", type: "customer.subscription.updated", payload: {} },
          existing,
        ),
      ).toThrow(BillingConflictError);
    });

    it("throws validation error on empty stripeEventId", () => {
      const existing = new Set<string>();
      expect(() =>
        handleWebhookEvent({ stripeEventId: "   ", type: "invoice.paid", payload: {} }, existing),
      ).toThrow(BillingValidationError);
    });

    it("validates payload must be object", () => {
      const existing = new Set<string>();
      expect(() =>
        handleWebhookEvent(
          { stripeEventId: "evt_2", type: "invoice.paid", payload: null as unknown as Record<string, unknown> },
          existing,
        ),
      ).toThrow(BillingValidationError);
    });
  });

  describe("markWebhookProcessed", () => {
    it("marks unprocessed as processed", () => {
      const customerId = crypto.randomUUID();
      void customerId; // avoid unused
      const existing = new Set<string>();
      const { event } = handleWebhookEvent(
        { stripeEventId: "evt_mark", type: "customer.subscription.created", payload: { foo: "bar" } },
        existing,
      );
      const marked = markWebhookProcessed(event);
      expect(marked.processed).toBe(true);
      expect(event.processed).toBe(false); // original immutable
    });

    it("returns same when already processed", () => {
      const existing = new Set<string>();
      const { event } = handleWebhookEvent(
        { stripeEventId: "evt_already", type: "invoice.paid", payload: {}, processed: true },
        existing,
      );
      const marked = markWebhookProcessed(event);
      expect(marked.processed).toBe(true);
      expect(marked).toEqual(event);
    });
  });

  describe("getPlanEntitlements", () => {
    it("returns entitlements for each plan", () => {
      expect(getPlanEntitlements("free")).toEqual(["basic_search"]);
      expect(getPlanEntitlements("premium")).toEqual(
        expect.arrayContaining(["ai_assistance", "premium_articles"]),
      );
      expect(getPlanEntitlements("pro").length).toBeGreaterThan(getPlanEntitlements("premium").length);
    });

    it("throws on invalid plan", () => {
      expect(() => getPlanEntitlements("enterprise" as unknown as "free")).toThrow(BillingValidationError);
    });
  });

  describe("billing vs marketplace separation", () => {
    it("keeps subscription plan codes separate from marketplace service types", () => {
      // This test documents the architectural invariant:
      // platform subscriptions (free/premium/pro) must not be conflated
      // with marketplace service types (personal_statement/strategy/...).
      const billingPlans = getPlanEntitlements("premium");
      expect(billingPlans).not.toContain("personal_statement");
      expect(billingPlans).not.toContain("mentoring");
    });
  });
});
