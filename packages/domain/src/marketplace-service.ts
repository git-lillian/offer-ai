/**
 * MarketplaceService — pure domain operations for the human expert marketplace.
 *
 * All functions are deterministic and framework-free. They validate inputs
 * with typed DomainErrors and enforce state machines for bookings and orders.
 * Persistence (Supabase) is the caller's concern; the service returns new
 * immutable objects.
 *
 * Platform commission is never silently invented: callers compute it via
 * `calculatePlatformFee` and pass the explicit amount + fee to `createOrder`.
 * The service enforces total = amount + platformFee.
 */

import { ValidationError } from "./errors";
import {
  createBooking as domainCreateBooking,
  createCommission,
  createReview,
  createServiceListing as domainCreateListing,
  createServiceOrder as domainCreateOrder,
  transitionBooking as domainTransitionBooking,
  transitionServiceOrder,
  validateCreateBookingInput,
  validateCreateCommissionInput,
  validateCreateReviewInput,
  validateCreateServiceListingInput,
  validateCreateServiceOrderInput,
  validateCreateProviderProfileInput,
  createProviderProfile,
  calculatePlatformFee,
  calculateTotal,
  type Booking,
  type BookingStatus,
  type Commission,
  type CreateBookingInput,
  type CreateCommissionInput,
  type CreateReviewInput,
  type CreateServiceListingInput,
  type CreateServiceOrderInput,
  type CreateProviderProfileInput,
  type OrderStatus,
  type ProviderProfile,
  type Review,
  type ServiceListing,
  type ServiceOrder,
} from "./marketplace";

// ── Provider profile ─────────────────────────────────────────────────────────

export function createListing(input: CreateServiceListingInput): ServiceListing {
  validateCreateServiceListingInput(input);
  return domainCreateListing(input);
}

export function validateListingInput(input: CreateServiceListingInput): void {
  validateCreateServiceListingInput(input);
}

// ── Booking ──────────────────────────────────────────────────────────────────

export function createBooking(input: CreateBookingInput): Booking {
  validateCreateBookingInput(input);
  return domainCreateBooking(input);
}

export function transitionBooking(
  booking: Booking,
  toStatus: BookingStatus,
): Booking {
  return domainTransitionBooking(booking, toStatus);
}

export function validateBookingInput(input: CreateBookingInput): void {
  validateCreateBookingInput(input);
}

// ── Order ────────────────────────────────────────────────────────────────────

export function createOrder(input: CreateServiceOrderInput): ServiceOrder {
  validateCreateServiceOrderInput(input);
  return domainCreateOrder(input);
}

/**
 * Convenience: create an order from an amount + commission rate.
 * Calculates platformFee deterministically and returns the order.
 */
export function createOrderWithRate(input: {
  bookingId: string;
  studentId: string;
  providerId: string;
  amount: number;
  rate: number;
  currencyCode?: string;
  status?: OrderStatus;
}): ServiceOrder {
  const platformFee = calculatePlatformFee(input.amount, input.rate);
  return createOrder({
    bookingId: input.bookingId,
    studentId: input.studentId,
    providerId: input.providerId,
    amount: input.amount,
    platformFee,
    currencyCode: input.currencyCode,
    status: input.status,
  });
}

export function validateOrderInput(input: CreateServiceOrderInput): void {
  validateCreateServiceOrderInput(input);
}

export function transitionOrder(
  order: ServiceOrder,
  toStatus: OrderStatus,
): ServiceOrder {
  return transitionServiceOrder(order, toStatus);
}

// ── Provider profile (exposed for completeness) ──────────────────────────────

export function createProvider(input: CreateProviderProfileInput): ProviderProfile {
  validateCreateProviderProfileInput(input);
  return createProviderProfile(input);
}

export function validateProviderInput(input: CreateProviderProfileInput): void {
  validateCreateProviderProfileInput(input);
}

// ── Review ───────────────────────────────────────────────────────────────────

export function createOrderReview(input: CreateReviewInput): Review {
  validateCreateReviewInput(input);
  return createReview(input);
}

export function validateReviewInput(input: CreateReviewInput): void {
  validateCreateReviewInput(input);
}

// ── Commission ───────────────────────────────────────────────────────────────

export function createOrderCommission(input: CreateCommissionInput): Commission {
  validateCreateCommissionInput(input);
  return createCommission(input);
}

export function validateCommissionInput(input: CreateCommissionInput): void {
  validateCreateCommissionInput(input);
}

// ── Aggregated validation helpers ───────────────────────────────────────────

export { calculatePlatformFee, calculateTotal };

// ── Class façade (optional) ──────────────────────────────────────────────────

export class MarketplaceService {
  createProvider(input: CreateProviderProfileInput): ProviderProfile {
    return createProvider(input);
  }

  createListing(input: CreateServiceListingInput): ServiceListing {
    return createListing(input);
  }

  createBooking(input: CreateBookingInput): Booking {
    return createBooking(input);
  }

  transitionBooking(booking: Booking, toStatus: BookingStatus): Booking {
    return transitionBooking(booking, toStatus);
  }

  createOrder(input: CreateServiceOrderInput): ServiceOrder {
    return createOrder(input);
  }

  createOrderWithRate(input: {
    bookingId: string;
    studentId: string;
    providerId: string;
    amount: number;
    rate: number;
    currencyCode?: string;
    status?: OrderStatus;
  }): ServiceOrder {
    return createOrderWithRate(input);
  }

  transitionOrder(order: ServiceOrder, toStatus: OrderStatus): ServiceOrder {
    return transitionOrder(order, toStatus);
  }

  createReview(input: CreateReviewInput): Review {
    return createOrderReview(input);
  }

  createCommission(input: CreateCommissionInput): Commission {
    return createOrderCommission(input);
  }

  validateProviderInput(input: CreateProviderProfileInput): void {
    validateProviderInput(input);
  }

  validateListingInput(input: CreateServiceListingInput): void {
    validateListingInput(input);
  }

  validateBookingInput(input: CreateBookingInput): void {
    validateBookingInput(input);
  }

  validateOrderInput(input: CreateServiceOrderInput): void {
    validateOrderInput(input);
  }

  validateReviewInput(input: CreateReviewInput): void {
    validateReviewInput(input);
  }

  validateCommissionInput(input: CreateCommissionInput): void {
    validateCommissionInput(input);
  }
}

export function validateMarketplaceInputs(input: {
  provider?: CreateProviderProfileInput;
  listing?: CreateServiceListingInput;
  booking?: CreateBookingInput;
  order?: CreateServiceOrderInput;
}): void {
  if (input.provider) validateProviderInput(input.provider);
  if (input.listing) validateListingInput(input.listing);
  if (input.booking) validateBookingInput(input.booking);
  if (input.order) validateOrderInput(input.order);
  if (!input.provider && !input.listing && !input.booking && !input.order) {
    throw new ValidationError("At least one marketplace input is required.");
  }
}
