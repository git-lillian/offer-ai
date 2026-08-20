import { z } from "zod";

/**
 * Marketplace contracts — validates every marketplace boundary with zod.
 *
 * Covers provider profiles, service listings, bookings, orders, reviews and
 * commissions. The marketplace remains separate from SaaS billing (see
 * docs/architecture/marketplace.md).
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export const verificationStatusSchema = z.enum(["pending", "verified", "rejected"]);

export const serviceTypeSchema = z.enum([
  "personal_statement",
  "strategy",
  "mentoring",
  "cv_review",
  "interview_prep",
  "other",
]);

export const bookingStatusSchema = z.enum([
  "pending",
  "confirmed",
  "completed",
  "cancelled",
]);

export const orderStatusSchema = z.enum(["pending", "paid", "completed", "disputed"]);

// ── Helpers ──────────────────────────────────────────────────────────────────

const currencyCodeRegex = /^[A-Z]{3}$/;
const countryCodeRegex = /^[A-Z]{2}$/;
const languageCodeRegex = /^[a-z]{2}(-[A-Z]{2})?$/;

// ── Provider profile ─────────────────────────────────────────────────────────

export const providerProfileDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string().min(1).max(120),
  bio: z.string().max(2000),
  verificationStatus: verificationStatusSchema,
  specialisms: z.array(z.string().trim().min(1).max(80)).max(20),
  countryScope: z.array(z.string().regex(countryCodeRegex)).max(20),
  languageScope: z.array(z.string().regex(languageCodeRegex)).max(20),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProviderProfileDto = z.infer<typeof providerProfileDtoSchema>;

export const createProviderProfileSchema = z.object({
  displayName: z.string().trim().min(1, "displayName is required.").max(120),
  bio: z.string().trim().max(2000).default(""),
  specialisms: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  countryScope: z.array(z.string().regex(countryCodeRegex, "countryScope must be ISO 3166-1 alpha-2")).max(20).default([]),
  languageScope: z.array(z.string().regex(languageCodeRegex, "languageScope must be a language code")).max(20).default([]),
});

export type CreateProviderProfileInput = z.infer<typeof createProviderProfileSchema>;

export const updateProviderProfileSchema = z.object({
  providerId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  specialisms: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  countryScope: z.array(z.string().regex(countryCodeRegex)).max(20).optional(),
  languageScope: z.array(z.string().regex(languageCodeRegex)).max(20).optional(),
});

export type UpdateProviderProfileInput = z.infer<typeof updateProviderProfileSchema>;

// ── Service listing ──────────────────────────────────────────────────────────

export const serviceListingDtoSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  serviceType: serviceTypeSchema,
  price: z.number().min(0).max(100_000),
  currencyCode: z.string().regex(currencyCodeRegex),
  turnaroundDays: z.number().int().min(1).max(90),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ServiceListingDto = z.infer<typeof serviceListingDtoSchema>;

export const createServiceListingSchema = z.object({
  providerId: z.string().uuid("providerId must be a valid UUID."),
  title: z.string().trim().min(1, "title is required.").max(200),
  description: z.string().trim().max(5000).default(""),
  serviceType: serviceTypeSchema,
  price: z.number().min(0).max(100_000),
  currencyCode: z.string().regex(currencyCodeRegex, "currencyCode must be ISO 4217"),
  turnaroundDays: z.number().int().min(1).max(90),
  isActive: z.boolean().default(true),
});

export type CreateServiceListingInput = z.infer<typeof createServiceListingSchema>;

export const updateServiceListingSchema = z.object({
  listingId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  serviceType: serviceTypeSchema.optional(),
  price: z.number().min(0).max(100_000).optional(),
  currencyCode: z.string().regex(currencyCodeRegex).optional(),
  turnaroundDays: z.number().int().min(1).max(90).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateServiceListingInput = z.infer<typeof updateServiceListingSchema>;

export const listServiceListingsSchema = z.object({
  providerId: z.string().uuid().optional(),
  serviceType: serviceTypeSchema.optional(),
  isActive: z.boolean().optional(),
  query: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListServiceListingsInput = z.infer<typeof listServiceListingsSchema>;

export const listServiceListingsResponseSchema = z.object({
  listings: z.array(serviceListingDtoSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type ListServiceListingsResponse = z.infer<typeof listServiceListingsResponseSchema>;

// ── Booking ──────────────────────────────────────────────────────────────────

export const bookingDtoSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  serviceListingId: z.string().uuid(),
  providerId: z.string().uuid(),
  status: bookingStatusSchema,
  scheduledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BookingDto = z.infer<typeof bookingDtoSchema>;

export const createBookingSchema = z.object({
  serviceListingId: z.string().uuid("serviceListingId must be a valid UUID."),
  providerId: z.string().uuid("providerId must be a valid UUID."),
  studentId: z.string().uuid("studentId must be a valid UUID.").optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const transitionBookingSchema = z.object({
  bookingId: z.string().uuid(),
  toStatus: bookingStatusSchema,
});

export type TransitionBookingInput = z.infer<typeof transitionBookingSchema>;

export const listBookingsSchema = z.object({
  studentId: z.string().uuid().optional(),
  providerId: z.string().uuid().optional(),
  serviceListingId: z.string().uuid().optional(),
  status: bookingStatusSchema.optional(),
});

export type ListBookingsInput = z.infer<typeof listBookingsSchema>;

export const listBookingsResponseSchema = z.object({
  bookings: z.array(bookingDtoSchema),
});

export type ListBookingsResponse = z.infer<typeof listBookingsResponseSchema>;

// ── Service order ────────────────────────────────────────────────────────────

export const serviceOrderDtoSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  studentId: z.string().uuid(),
  providerId: z.string().uuid(),
  amount: z.number().min(0),
  platformFee: z.number().min(0),
  total: z.number().min(0),
  currencyCode: z.string().regex(currencyCodeRegex),
  status: orderStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ServiceOrderDto = z.infer<typeof serviceOrderDtoSchema>;

export const createServiceOrderSchema = z.object({
  bookingId: z.string().uuid("bookingId must be a valid UUID."),
  studentId: z.string().uuid("studentId must be a valid UUID.").optional(),
  providerId: z.string().uuid("providerId must be a valid UUID.").optional(),
  amount: z.number().min(0).max(100_000),
  platformFee: z.number().min(0),
  currencyCode: z.string().regex(currencyCodeRegex).default("GBP"),
}).refine((value) => value.platformFee <= value.amount, {
  message: "platformFee must not exceed amount.",
  path: ["platformFee"],
});

export type CreateServiceOrderInput = z.infer<typeof createServiceOrderSchema>;

export const createOrderWithRateSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().min(0).max(100_000),
  rate: z.number().min(0).max(1),
  currencyCode: z.string().regex(currencyCodeRegex).default("GBP"),
});

export type CreateOrderWithRateInput = z.infer<typeof createOrderWithRateSchema>;

export const transitionOrderSchema = z.object({
  orderId: z.string().uuid(),
  toStatus: orderStatusSchema,
});

export type TransitionOrderInput = z.infer<typeof transitionOrderSchema>;

// ── Review ───────────────────────────────────────────────────────────────────

export const reviewDtoSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  studentId: z.string().uuid(),
  providerId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000),
  createdAt: z.string().datetime(),
});

export type ReviewDto = z.infer<typeof reviewDtoSchema>;

export const createReviewSchema = z.object({
  orderId: z.string().uuid("orderId must be a valid UUID."),
  providerId: z.string().uuid("providerId must be a valid UUID."),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).default(""),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

// ── Commission ───────────────────────────────────────────────────────────────

export const commissionDtoSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  providerId: z.string().uuid(),
  amount: z.number().min(0),
  rate: z.number().min(0).max(1),
  currencyCode: z.string().regex(currencyCodeRegex),
  createdAt: z.string().datetime(),
});

export type CommissionDto = z.infer<typeof commissionDtoSchema>;

export const createCommissionSchema = z.object({
  orderId: z.string().uuid(),
  providerId: z.string().uuid(),
  amount: z.number().min(0),
  rate: z.number().min(0).max(1),
  currencyCode: z.string().regex(currencyCodeRegex).default("GBP"),
});

export type CreateCommissionInput = z.infer<typeof createCommissionSchema>;
