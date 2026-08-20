import { describe, expect, it } from "vitest";
import {
  canTransitionBooking,
  canTransitionOrder,
  createBooking,
  createCommission,
  createProviderProfile,
  createReview,
  createServiceListing,
  createServiceOrder,
  calculatePlatformFee,
  calculateTotal,
  isBookingStatus,
  isOrderStatus,
  isServiceType,
  isProviderVerificationStatus,
  transitionBooking,
  transitionServiceOrder,
  validateBooking,
  validateCommission,
  validateProviderProfile,
  validateReview,
  validateServiceListing,
  validateServiceOrder,
} from "./marketplace";
import {
  createBooking as svcCreateBooking,
  createListing,
  createOrder,
  createOrderWithRate,
  transitionBooking as svcTransitionBooking,
} from "./marketplace-service";
import { StateTransitionError, ValidationError } from "./errors";

const USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const STUDENT_ID = "550e8400-e29b-41d4-a716-446655440002";
const PROVIDER_ID = "550e8400-e29b-41d4-a716-446655440010";
const LISTING_ID = "550e8400-e29b-41d4-a716-446655440011";
const BOOKING_ID = "550e8400-e29b-41d4-a716-446655440012";
const ORDER_ID = "550e8400-e29b-41d4-a716-446655440013";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProvider(overrides?: Partial<ReturnType<typeof createProviderProfile>>) {
  return createProviderProfile({
    userId: USER_ID,
    displayName: "Dr Jane",
    bio: "Experienced adviser",
    specialisms: ["personal statement"],
    countryScope: ["GB"],
    languageScope: ["en"],
    ...overrides,
  });
}

function makeListing(overrides?: Partial<ReturnType<typeof createServiceListing>>) {
  return createServiceListing({
    providerId: PROVIDER_ID,
    title: "Personal Statement Review",
    description: "Thorough review with feedback",
    serviceType: "personal_statement",
    price: 99.99,
    currencyCode: "GBP",
    turnaroundDays: 5,
    ...overrides,
  });
}

function makeBooking(overrides?: Partial<ReturnType<typeof createBooking>>) {
  return createBooking({
    studentId: STUDENT_ID,
    serviceListingId: LISTING_ID,
    providerId: PROVIDER_ID,
    ...overrides,
  });
}

function makeOrder(overrides?: Partial<ReturnType<typeof createServiceOrder>>) {
  return createServiceOrder({
    bookingId: BOOKING_ID,
    studentId: STUDENT_ID,
    providerId: PROVIDER_ID,
    amount: 100,
    platformFee: 15,
    ...overrides,
  });
}

// ── Provider profile ─────────────────────────────────────────────────────────

describe("provider profile", () => {
  it("creates a provider profile with defaults", () => {
    const p = makeProvider();
    expect(p.displayName).toBe("Dr Jane");
    expect(p.verificationStatus).toBe("pending");
    expect(p.specialisms).toEqual(["personal statement"]);
    expect(p.countryScope).toEqual(["GB"]);
    expect(p.languageScope).toEqual(["en"]);
    expect(p.id).toBeDefined();
  });

  it("trims displayName and bio", () => {
    const p = makeProvider({ displayName: "  Dr Jane  ", bio: "  hello  " });
    expect(p.displayName).toBe("Dr Jane");
    expect(p.bio).toBe("hello");
  });

  it("throws ValidationError for invalid userId", () => {
    expect(() => makeProvider({ userId: "bad" })).toThrow(ValidationError);
  });

  it("throws ValidationError for empty displayName", () => {
    expect(() => makeProvider({ displayName: "   " })).toThrow(ValidationError);
  });

  it("throws ValidationError for too many specialisms", () => {
    expect(() =>
      makeProvider({ specialisms: Array(21).fill("x") }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid countryScope", () => {
    expect(() => makeProvider({ countryScope: ["gb"] })).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid languageScope", () => {
    expect(() => makeProvider({ languageScope: ["en_gb"] })).toThrow(ValidationError);
  });

  it("validates via validateProviderProfile", () => {
    const p = makeProvider();
    expect(() => validateProviderProfile(p)).not.toThrow();
  });

  it("isProviderVerificationStatus type guard", () => {
    expect(isProviderVerificationStatus("verified")).toBe(true);
    expect(isProviderVerificationStatus("unknown")).toBe(false);
  });
});

// ── Service listing ──────────────────────────────────────────────────────────

describe("service listing", () => {
  it("creates a listing with defaults", () => {
    const l = makeListing();
    expect(l.title).toBe("Personal Statement Review");
    expect(l.serviceType).toBe("personal_statement");
    expect(l.price).toBe(99.99);
    expect(l.currencyCode).toBe("GBP");
    expect(l.turnaroundDays).toBe(5);
    expect(l.isActive).toBe(true);
  });

  it("trims title and description", () => {
    const l = makeListing({ title: "  title  ", description: "  desc  " });
    expect(l.title).toBe("title");
    expect(l.description).toBe("desc");
  });

  it("throws ValidationError for invalid providerId", () => {
    expect(() => makeListing({ providerId: "bad" })).toThrow(ValidationError);
  });

  it("throws ValidationError for empty title", () => {
    expect(() => makeListing({ title: "   " })).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid serviceType", () => {
    expect(() =>
      makeListing({ serviceType: "bad" as never }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for negative price", () => {
    expect(() => makeListing({ price: -1 })).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid currencyCode", () => {
    expect(() => makeListing({ currencyCode: "gbp" })).toThrow(ValidationError);
  });

  it("throws ValidationError for turnaroundDays out of range", () => {
    expect(() => makeListing({ turnaroundDays: 0 })).toThrow(ValidationError);
    expect(() => makeListing({ turnaroundDays: 91 })).toThrow(ValidationError);
  });

  it("validates via validateServiceListing", () => {
    const l = makeListing();
    expect(() => validateServiceListing(l)).not.toThrow();
  });

  it("isServiceType guard", () => {
    expect(isServiceType("strategy")).toBe(true);
    expect(isServiceType("unknown")).toBe(false);
  });

  it("service marketplace-service createListing mirrors domain", () => {
    const l = createListing({
      providerId: PROVIDER_ID,
      title: "Strategy Session",
      serviceType: "strategy",
      price: 50,
      currencyCode: "USD",
      turnaroundDays: 3,
    });
    expect(l.serviceType).toBe("strategy");
    expect(l.currencyCode).toBe("USD");
  });
});

// ── Booking ──────────────────────────────────────────────────────────────────

describe("booking", () => {
  it("creates a booking with defaults", () => {
    const b = makeBooking();
    expect(b.studentId).toBe(STUDENT_ID);
    expect(b.serviceListingId).toBe(LISTING_ID);
    expect(b.providerId).toBe(PROVIDER_ID);
    expect(b.status).toBe("pending");
    expect(b.scheduledAt).toBeNull();
  });

  it("respects scheduledAt", () => {
    const date = new Date("2026-09-01T10:00:00Z");
    const b = makeBooking({ scheduledAt: date });
    expect(b.scheduledAt).toEqual(date);
  });

  it("throws ValidationError for invalid studentId", () => {
    expect(() =>
      makeBooking({ studentId: "bad" }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid scheduledAt", () => {
    expect(() =>
      // @ts-expect-error testing invalid type
      makeBooking({ scheduledAt: "not-a-date" }),
    ).toThrow(ValidationError);
  });

  it("validates via validateBooking", () => {
    const b = makeBooking();
    expect(() => validateBooking(b)).not.toThrow();
  });

  it("isBookingStatus guard", () => {
    expect(isBookingStatus("confirmed")).toBe(true);
    expect(isBookingStatus("bad")).toBe(false);
  });

  it("canTransitionBooking matrix", () => {
    expect(canTransitionBooking("pending", "confirmed")).toBe(true);
    expect(canTransitionBooking("pending", "completed")).toBe(false);
    expect(canTransitionBooking("confirmed", "completed")).toBe(true);
    expect(canTransitionBooking("confirmed", "cancelled")).toBe(true);
    expect(canTransitionBooking("completed", "cancelled")).toBe(false);
    expect(canTransitionBooking("cancelled", "pending")).toBe(false);
    expect(canTransitionBooking("pending", "pending")).toBe(true);
  });

  it("transitionBooking succeeds for valid transition", () => {
    const b = makeBooking();
    const next = transitionBooking(b, "confirmed");
    expect(next.status).toBe("confirmed");
    expect(next.updatedAt.getTime()).toBeGreaterThanOrEqual(b.updatedAt.getTime());
  });

  it("transitionBooking throws StateTransitionError for invalid", () => {
    const b = makeBooking();
    expect(() => transitionBooking(b, "completed")).toThrow(StateTransitionError);
  });

  it("transitionBooking throws ValidationError for unknown status", () => {
    const b = makeBooking();
    expect(() => transitionBooking(b, "bad" as never)).toThrow(ValidationError);
  });

  it("marketplace-service createBooking and transitionBooking", () => {
    const b = svcCreateBooking({
      studentId: STUDENT_ID,
      serviceListingId: LISTING_ID,
      providerId: PROVIDER_ID,
    });
    const confirmed = svcTransitionBooking(b, "confirmed");
    expect(confirmed.status).toBe("confirmed");
  });
});

// ── Service order ────────────────────────────────────────────────────────────

describe("service order", () => {
  it("creates an order with calculated total", () => {
    const o = makeOrder();
    expect(o.amount).toBe(100);
    expect(o.platformFee).toBe(15);
    expect(o.total).toBe(115);
    expect(o.status).toBe("pending");
    expect(o.currencyCode).toBe("GBP");
  });

  it("throws ValidationError for platformFee > amount", () => {
    expect(() =>
      makeOrder({ amount: 10, platformFee: 20 }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for negative amount", () => {
    expect(() => makeOrder({ amount: -1, platformFee: 0 })).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid currencyCode", () => {
    expect(() => makeOrder({ currencyCode: "gbp" as never })).toThrow(ValidationError);
  });

  it("validates total = amount + platformFee", () => {
    const o = makeOrder();
    // Tamper total
    const tampered = { ...o, total: 999 };
    expect(() => validateServiceOrder(tampered)).toThrow(ValidationError);
  });

  it("validates via validateServiceOrder", () => {
    const o = makeOrder();
    expect(() => validateServiceOrder(o)).not.toThrow();
  });

  it("isOrderStatus guard", () => {
    expect(isOrderStatus("paid")).toBe(true);
    expect(isOrderStatus("bad")).toBe(false);
  });

  it("canTransitionOrder matrix", () => {
    expect(canTransitionOrder("pending", "paid")).toBe(true);
    expect(canTransitionOrder("pending", "completed")).toBe(true);
    expect(canTransitionOrder("paid", "completed")).toBe(true);
    expect(canTransitionOrder("paid", "disputed")).toBe(true);
    expect(canTransitionOrder("completed", "disputed")).toBe(false);
    expect(canTransitionOrder("disputed", "completed")).toBe(true);
  });

  it("transitionServiceOrder succeeds", () => {
    const o = makeOrder();
    const paid = transitionServiceOrder(o, "paid");
    expect(paid.status).toBe("paid");
  });

  it("transitionServiceOrder throws for invalid", () => {
    const o = makeOrder({ status: "completed" });
    expect(() => transitionServiceOrder(o, "pending")).toThrow(StateTransitionError);
  });

  it("calculatePlatformFee and calculateTotal helpers", () => {
    expect(calculatePlatformFee(100, 0.15)).toBe(15);
    expect(calculatePlatformFee(100, 0)).toBe(0);
    expect(calculateTotal(100, 15)).toBe(115);
    expect(() => calculatePlatformFee(100, 1.5)).toThrow(ValidationError);
  });

  it("marketplace-service createOrder and createOrderWithRate", () => {
    const o1 = createOrder({
      bookingId: BOOKING_ID,
      studentId: STUDENT_ID,
      providerId: PROVIDER_ID,
      amount: 200,
      platformFee: 30,
      currencyCode: "GBP",
    });
    expect(o1.total).toBe(230);

    const o2 = createOrderWithRate({
      bookingId: BOOKING_ID,
      studentId: STUDENT_ID,
      providerId: PROVIDER_ID,
      amount: 200,
      rate: 0.15,
    });
    expect(o2.platformFee).toBe(30);
    expect(o2.total).toBe(230);
  });
});

// ── Review ───────────────────────────────────────────────────────────────────

describe("review", () => {
  it("creates a review", () => {
    const r = createReview({
      orderId: ORDER_ID,
      studentId: STUDENT_ID,
      providerId: PROVIDER_ID,
      rating: 5,
      comment: "Excellent!",
    });
    expect(r.rating).toBe(5);
    expect(r.comment).toBe("Excellent!");
  });

  it("trims comment", () => {
    const r = createReview({
      orderId: ORDER_ID,
      studentId: STUDENT_ID,
      providerId: PROVIDER_ID,
      rating: 4,
      comment: "  great  ",
    });
    expect(r.comment).toBe("great");
  });

  it("throws ValidationError for rating out of bounds", () => {
    expect(() =>
      createReview({ orderId: ORDER_ID, studentId: STUDENT_ID, providerId: PROVIDER_ID, rating: 0 }),
    ).toThrow(ValidationError);
    expect(() =>
      createReview({ orderId: ORDER_ID, studentId: STUDENT_ID, providerId: PROVIDER_ID, rating: 6 }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for non-integer rating", () => {
    expect(() =>
      createReview({ orderId: ORDER_ID, studentId: STUDENT_ID, providerId: PROVIDER_ID, rating: 4.5 }),
    ).toThrow(ValidationError);
  });

  it("validates via validateReview", () => {
    const r = createReview({ orderId: ORDER_ID, studentId: STUDENT_ID, providerId: PROVIDER_ID, rating: 3 });
    expect(() => validateReview(r)).not.toThrow();
  });
});

// ── Commission ───────────────────────────────────────────────────────────────

describe("commission", () => {
  it("creates a commission", () => {
    const c = createCommission({
      orderId: ORDER_ID,
      providerId: PROVIDER_ID,
      amount: 15,
      rate: 0.15,
    });
    expect(c.amount).toBe(15);
    expect(c.rate).toBe(0.15);
    expect(c.currencyCode).toBe("GBP");
  });

  it("throws ValidationError for rate > 1", () => {
    expect(() =>
      createCommission({ orderId: ORDER_ID, providerId: PROVIDER_ID, amount: 10, rate: 1.5 }),
    ).toThrow(ValidationError);
  });

  it("validates via validateCommission", () => {
    const c = createCommission({ orderId: ORDER_ID, providerId: PROVIDER_ID, amount: 10, rate: 0.1 });
    expect(() => validateCommission(c)).not.toThrow();
  });
});
