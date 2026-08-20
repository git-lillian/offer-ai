/**
 * Marketplace domain — human adviser/reviewer marketplace where students buy
 * services (personal statement review, strategy, mentoring) and the platform
 * takes a commission.
 *
 * Framework-free: no Next/React/Supabase/Stripe imports. Validation uses
 * typed DomainError subclasses so delivery layers can map to HTTP responses.
 *
 * Mirrors docs/architecture/marketplace.md. Deterministic: commission
 * calculation is pure; status machines are explicit.
 */

import { StateTransitionError, ValidationError } from "./errors";

// ── Provider verification status ─────────────────────────────────────────────

export const PROVIDER_VERIFICATION_STATUSES = ["pending", "verified", "rejected"] as const;

export type ProviderVerificationStatus =
  (typeof PROVIDER_VERIFICATION_STATUSES)[number];

export function isProviderVerificationStatus(
  value: string,
): value is ProviderVerificationStatus {
  return (PROVIDER_VERIFICATION_STATUSES as readonly string[]).includes(value);
}

// ── Service type ─────────────────────────────────────────────────────────────

export const SERVICE_TYPES = [
  "personal_statement",
  "strategy",
  "mentoring",
  "cv_review",
  "interview_prep",
  "other",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export function isServiceType(value: string): value is ServiceType {
  return (SERVICE_TYPES as readonly string[]).includes(value);
}

// ── Booking status ───────────────────────────────────────────────────────────

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value);
}

// ── Order status ─────────────────────────────────────────────────────────────

export const ORDER_STATUSES = ["pending", "paid", "completed", "disputed"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

// ── Entities ─────────────────────────────────────────────────────────────────

export interface ProviderProfile {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  verificationStatus: ProviderVerificationStatus;
  specialisms: string[];
  countryScope: string[];
  languageScope: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceListing {
  id: string;
  providerId: string;
  title: string;
  description: string;
  serviceType: ServiceType;
  price: number;
  currencyCode: string;
  turnaroundDays: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  studentId: string;
  serviceListingId: string;
  providerId: string;
  status: BookingStatus;
  scheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceOrder {
  id: string;
  bookingId: string;
  studentId: string;
  providerId: string;
  amount: number;
  platformFee: number;
  total: number;
  currencyCode: string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Review {
  id: string;
  orderId: string;
  studentId: string;
  providerId: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface Commission {
  id: string;
  orderId: string;
  providerId: string;
  amount: number;
  rate: number;
  currencyCode: string;
  createdAt: Date;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function assertUuid(value: string, field: string): void {
  if (!isUuid(value)) {
    throw new ValidationError(`${field} must be a valid UUID.`, { field });
  }
}

function assertTrimmedLength(
  value: string,
  field: string,
  min: number,
  max: number,
): string {
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new ValidationError(`${field} is required.`, { field });
  }
  if (trimmed.length > max) {
    throw new ValidationError(`${field} must be ${max} characters or fewer.`, {
      field,
    });
  }
  return trimmed;
}

function assertCurrencyCode(value: string, field: string): void {
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new ValidationError(`${field} must be an ISO 4217 currency code.`, {
      field,
    });
  }
}

function assertCountryCode(value: string, field: string): void {
  if (!/^[A-Z]{2}$/.test(value)) {
    throw new ValidationError(`${field} must be an ISO 3166-1 alpha-2 code.`, {
      field,
    });
  }
}

function assertLanguageCode(value: string, field: string): void {
  if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(value)) {
    throw new ValidationError(`${field} must be a language code (e.g. en or en-GB).`, {
      field,
    });
  }
}

function assertArrayOfStrings(
  value: unknown,
  field: string,
  maxItems: number,
  maxItemLength: number,
  itemValidator?: (item: string, field: string) => void,
): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} must be an array.`, { field });
  }
  if (value.length > maxItems) {
    throw new ValidationError(`${field} must have at most ${maxItems} items.`, {
      field,
    });
  }
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      throw new ValidationError(`${field} entries must be strings.`, { field });
    }
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      throw new ValidationError(`${field} entries must be non-empty strings.`, {
        field,
      });
    }
    if (trimmed.length > maxItemLength) {
      throw new ValidationError(
        `${field} entries must be ${maxItemLength} characters or fewer.`,
        { field },
      );
    }
    if (itemValidator) itemValidator(trimmed, field);
    result.push(trimmed);
  }
  return result;
}

// ── Provider profile validation ─────────────────────────────────────────────

export interface CreateProviderProfileInput {
  userId: string;
  displayName: string;
  bio?: string;
  verificationStatus?: ProviderVerificationStatus;
  specialisms?: string[];
  countryScope?: string[];
  languageScope?: string[];
}

export function validateCreateProviderProfileInput(
  input: CreateProviderProfileInput,
): void {
  assertUuid(input.userId, "userId");
  assertTrimmedLength(input.displayName, "displayName", 1, 120);
  if (input.bio !== undefined) {
    if (typeof input.bio !== "string") {
      throw new ValidationError("bio must be a string.", { field: "bio" });
    }
    if (input.bio.length > 2000) {
      throw new ValidationError("bio must be 2000 characters or fewer.", {
        field: "bio",
      });
    }
  }
  if (
    input.verificationStatus !== undefined &&
    !isProviderVerificationStatus(input.verificationStatus)
  ) {
    throw new ValidationError(
      `Invalid verification status "${input.verificationStatus}".`,
      { field: "verificationStatus" },
    );
  }
  if (input.specialisms !== undefined) {
    assertArrayOfStrings(input.specialisms, "specialisms", 20, 80);
  }
  if (input.countryScope !== undefined) {
    assertArrayOfStrings(
      input.countryScope,
      "countryScope",
      20,
      2,
      assertCountryCode,
    );
  }
  if (input.languageScope !== undefined) {
    assertArrayOfStrings(
      input.languageScope,
      "languageScope",
      20,
      5,
      assertLanguageCode,
    );
  }
}

export function createProviderProfile(
  input: CreateProviderProfileInput,
): ProviderProfile {
  validateCreateProviderProfileInput(input);
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    userId: input.userId,
    displayName: input.displayName.trim(),
    bio: (input.bio ?? "").trim(),
    verificationStatus: input.verificationStatus ?? "pending",
    specialisms: input.specialisms ? [...input.specialisms].map((s) => s.trim()) : [],
    countryScope: input.countryScope
      ? [...input.countryScope].map((c) => c.trim())
      : [],
    languageScope: input.languageScope
      ? [...input.languageScope].map((l) => l.trim())
      : [],
    createdAt: now,
    updatedAt: now,
  };
}

export function validateProviderProfile(value: ProviderProfile): void {
  assertUuid(value.id, "id");
  assertUuid(value.userId, "userId");
  assertTrimmedLength(value.displayName, "displayName", 1, 120);
  if (value.bio.length > 2000) {
    throw new ValidationError("bio must be 2000 characters or fewer.", {
      field: "bio",
    });
  }
  if (!isProviderVerificationStatus(value.verificationStatus)) {
    throw new ValidationError(
      `Invalid verification status "${value.verificationStatus}".`,
      { field: "verificationStatus" },
    );
  }
  assertArrayOfStrings(value.specialisms, "specialisms", 20, 80);
  assertArrayOfStrings(value.countryScope, "countryScope", 20, 2);
  // language codes validated loosely on read
  for (const lang of value.languageScope) {
    assertLanguageCode(lang, "languageScope");
  }
  if (!(value.createdAt instanceof Date) || Number.isNaN(value.createdAt.getTime())) {
    throw new ValidationError("createdAt must be a valid Date.", {
      field: "createdAt",
    });
  }
  if (!(value.updatedAt instanceof Date) || Number.isNaN(value.updatedAt.getTime())) {
    throw new ValidationError("updatedAt must be a valid Date.", {
      field: "updatedAt",
    });
  }
}

// ── Service listing validation ───────────────────────────────────────────────

export interface CreateServiceListingInput {
  providerId: string;
  title: string;
  description?: string;
  serviceType: ServiceType;
  price: number;
  currencyCode: string;
  turnaroundDays: number;
  isActive?: boolean;
}

export function validateCreateServiceListingInput(
  input: CreateServiceListingInput,
): void {
  assertUuid(input.providerId, "providerId");
  assertTrimmedLength(input.title, "title", 1, 200);
  if (input.description !== undefined) {
    if (typeof input.description !== "string") {
      throw new ValidationError("description must be a string.", {
        field: "description",
      });
    }
    if (input.description.length > 5000) {
      throw new ValidationError("description must be 5000 characters or fewer.", {
        field: "description",
      });
    }
  }
  if (!isServiceType(input.serviceType)) {
    throw new ValidationError(`Invalid service type "${input.serviceType}".`, {
      field: "serviceType",
    });
  }
  if (typeof input.price !== "number" || Number.isNaN(input.price) || input.price < 0) {
    throw new ValidationError("price must be a number >= 0.", { field: "price" });
  }
  if (input.price > 100_000) {
    throw new ValidationError("price must be <= 100000.", { field: "price" });
  }
  // Two decimal places at most
  if (!Number.isFinite(input.price) || Math.round(input.price * 100) !== input.price * 100) {
    // Allow any finite; but enforce precision loosely: round to 2 decimals later.
    // For strict validation, check decimal places.
    const decimalPart = input.price.toString().split(".")[1];
    if (decimalPart && decimalPart.length > 2) {
      throw new ValidationError("price must have at most 2 decimal places.", {
        field: "price",
      });
    }
  }
  assertCurrencyCode(input.currencyCode, "currencyCode");
  if (
    !Number.isInteger(input.turnaroundDays) ||
    input.turnaroundDays < 1 ||
    input.turnaroundDays > 90
  ) {
    throw new ValidationError("turnaroundDays must be an integer between 1 and 90.", {
      field: "turnaroundDays",
    });
  }
  if (input.isActive !== undefined && typeof input.isActive !== "boolean") {
    throw new ValidationError("isActive must be a boolean.", { field: "isActive" });
  }
}

export function createServiceListing(
  input: CreateServiceListingInput,
): ServiceListing {
  validateCreateServiceListingInput(input);
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    providerId: input.providerId,
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    serviceType: input.serviceType,
    price: Math.round(input.price * 100) / 100,
    currencyCode: input.currencyCode,
    turnaroundDays: input.turnaroundDays,
    isActive: input.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateServiceListing(value: ServiceListing): void {
  assertUuid(value.id, "id");
  assertUuid(value.providerId, "providerId");
  assertTrimmedLength(value.title, "title", 1, 200);
  if (value.description.length > 5000) {
    throw new ValidationError("description must be 5000 characters or fewer.", {
      field: "description",
    });
  }
  if (!isServiceType(value.serviceType)) {
    throw new ValidationError(`Invalid service type "${value.serviceType}".`, {
      field: "serviceType",
    });
  }
  if (typeof value.price !== "number" || Number.isNaN(value.price) || value.price < 0) {
    throw new ValidationError("price must be >= 0.", { field: "price" });
  }
  assertCurrencyCode(value.currencyCode, "currencyCode");
  if (!Number.isInteger(value.turnaroundDays) || value.turnaroundDays < 1 || value.turnaroundDays > 90) {
    throw new ValidationError("turnaroundDays must be 1-90.", { field: "turnaroundDays" });
  }
  if (typeof value.isActive !== "boolean") {
    throw new ValidationError("isActive must be a boolean.", { field: "isActive" });
  }
  if (!(value.createdAt instanceof Date) || Number.isNaN(value.createdAt.getTime())) {
    throw new ValidationError("createdAt must be a valid Date.", { field: "createdAt" });
  }
  if (!(value.updatedAt instanceof Date) || Number.isNaN(value.updatedAt.getTime())) {
    throw new ValidationError("updatedAt must be a valid Date.", { field: "updatedAt" });
  }
}

// ── Booking validation + state machine ───────────────────────────────────────

const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionBooking(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  if (from === to) return true;
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface CreateBookingInput {
  studentId: string;
  serviceListingId: string;
  providerId: string;
  scheduledAt?: Date | null;
  status?: BookingStatus;
}

export function validateCreateBookingInput(input: CreateBookingInput): void {
  assertUuid(input.studentId, "studentId");
  assertUuid(input.serviceListingId, "serviceListingId");
  assertUuid(input.providerId, "providerId");
  if (input.status !== undefined && !isBookingStatus(input.status)) {
    throw new ValidationError(`Invalid booking status "${input.status}".`, {
      field: "status",
    });
  }
  if (
    input.scheduledAt !== undefined &&
    input.scheduledAt !== null &&
    !(input.scheduledAt instanceof Date)
  ) {
    throw new ValidationError("scheduledAt must be a Date or null.", {
      field: "scheduledAt",
    });
  }
  if (input.scheduledAt instanceof Date && Number.isNaN(input.scheduledAt.getTime())) {
    throw new ValidationError("scheduledAt must be a valid date.", {
      field: "scheduledAt",
    });
  }
}

export function createBooking(input: CreateBookingInput): Booking {
  validateCreateBookingInput(input);
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    studentId: input.studentId,
    serviceListingId: input.serviceListingId,
    providerId: input.providerId,
    status: input.status ?? "pending",
    scheduledAt: input.scheduledAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function transitionBooking(
  booking: Booking,
  toStatus: BookingStatus,
): Booking {
  if (!isBookingStatus(toStatus)) {
    throw new ValidationError(`Invalid booking status "${toStatus}".`, {
      field: "status",
    });
  }
  if (!canTransitionBooking(booking.status, toStatus)) {
    throw new StateTransitionError(
      `Cannot transition booking from "${booking.status}" to "${toStatus}".`,
    );
  }
  return {
    ...booking,
    status: toStatus,
    updatedAt: new Date(),
  };
}

export function validateBooking(value: Booking): void {
  assertUuid(value.id, "id");
  assertUuid(value.studentId, "studentId");
  assertUuid(value.serviceListingId, "serviceListingId");
  assertUuid(value.providerId, "providerId");
  if (!isBookingStatus(value.status)) {
    throw new ValidationError(`Invalid booking status "${value.status}".`, {
      field: "status",
    });
  }
  if (value.scheduledAt !== null && !(value.scheduledAt instanceof Date)) {
    throw new ValidationError("scheduledAt must be Date or null.", {
      field: "scheduledAt",
    });
  }
  if (value.scheduledAt instanceof Date && Number.isNaN(value.scheduledAt.getTime())) {
    throw new ValidationError("scheduledAt must be valid date.", {
      field: "scheduledAt",
    });
  }
  if (!(value.createdAt instanceof Date) || Number.isNaN(value.createdAt.getTime())) {
    throw new ValidationError("createdAt must be valid Date.", { field: "createdAt" });
  }
  if (!(value.updatedAt instanceof Date) || Number.isNaN(value.updatedAt.getTime())) {
    throw new ValidationError("updatedAt must be valid Date.", { field: "updatedAt" });
  }
}

// ── Service order validation + state machine ─────────────────────────────────

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["paid", "disputed", "completed"],
  paid: ["completed", "disputed"],
  completed: [],
  disputed: ["completed", "paid"],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface CreateServiceOrderInput {
  bookingId: string;
  studentId: string;
  providerId: string;
  amount: number;
  platformFee: number;
  currencyCode?: string;
  status?: OrderStatus;
}

export function calculateTotal(amount: number, platformFee: number): number {
  return Math.round((amount + platformFee) * 100) / 100;
}

export function calculatePlatformFee(amount: number, rate: number): number {
  if (typeof amount !== "number" || Number.isNaN(amount) || amount < 0) {
    throw new ValidationError("amount must be >= 0.", { field: "amount" });
  }
  if (typeof rate !== "number" || Number.isNaN(rate) || rate < 0 || rate > 1) {
    throw new ValidationError("rate must be between 0 and 1.", { field: "rate" });
  }
  return Math.round(amount * rate * 100) / 100;
}

export function validateCreateServiceOrderInput(
  input: CreateServiceOrderInput,
): void {
  assertUuid(input.bookingId, "bookingId");
  assertUuid(input.studentId, "studentId");
  assertUuid(input.providerId, "providerId");
  if (typeof input.amount !== "number" || Number.isNaN(input.amount) || input.amount < 0) {
    throw new ValidationError("amount must be >= 0.", { field: "amount" });
  }
  if (input.amount > 100_000) {
    throw new ValidationError("amount must be <= 100000.", { field: "amount" });
  }
  if (
    typeof input.platformFee !== "number" ||
    Number.isNaN(input.platformFee) ||
    input.platformFee < 0
  ) {
    throw new ValidationError("platformFee must be >= 0.", { field: "platformFee" });
  }
  if (input.platformFee > input.amount) {
    throw new ValidationError("platformFee must not exceed amount.", {
      field: "platformFee",
    });
  }
  if (input.currencyCode !== undefined) {
    assertCurrencyCode(input.currencyCode, "currencyCode");
  }
  if (input.status !== undefined && !isOrderStatus(input.status)) {
    throw new ValidationError(`Invalid order status "${input.status}".`, {
      field: "status",
    });
  }
}

export function createServiceOrder(input: CreateServiceOrderInput): ServiceOrder {
  validateCreateServiceOrderInput(input);
  const now = new Date();
  const total = calculateTotal(input.amount, input.platformFee);
  return {
    id: crypto.randomUUID(),
    bookingId: input.bookingId,
    studentId: input.studentId,
    providerId: input.providerId,
    amount: Math.round(input.amount * 100) / 100,
    platformFee: Math.round(input.platformFee * 100) / 100,
    total,
    currencyCode: input.currencyCode ?? "GBP",
    status: input.status ?? "pending",
    createdAt: now,
    updatedAt: now,
  };
}

export function transitionServiceOrder(
  order: ServiceOrder,
  toStatus: OrderStatus,
): ServiceOrder {
  if (!isOrderStatus(toStatus)) {
    throw new ValidationError(`Invalid order status "${toStatus}".`, {
      field: "status",
    });
  }
  if (!canTransitionOrder(order.status, toStatus)) {
    throw new StateTransitionError(
      `Cannot transition order from "${order.status}" to "${toStatus}".`,
    );
  }
  return {
    ...order,
    status: toStatus,
    updatedAt: new Date(),
  };
}

export function validateServiceOrder(value: ServiceOrder): void {
  assertUuid(value.id, "id");
  assertUuid(value.bookingId, "bookingId");
  assertUuid(value.studentId, "studentId");
  assertUuid(value.providerId, "providerId");
  if (typeof value.amount !== "number" || Number.isNaN(value.amount) || value.amount < 0) {
    throw new ValidationError("amount must be >= 0.", { field: "amount" });
  }
  if (
    typeof value.platformFee !== "number" ||
    Number.isNaN(value.platformFee) ||
    value.platformFee < 0
  ) {
    throw new ValidationError("platformFee must be >= 0.", { field: "platformFee" });
  }
  if (typeof value.total !== "number" || Number.isNaN(value.total) || value.total < 0) {
    throw new ValidationError("total must be >= 0.", { field: "total" });
  }
  const expectedTotal = calculateTotal(value.amount, value.platformFee);
  if (Math.abs(value.total - expectedTotal) > 0.01) {
    throw new ValidationError("total must equal amount + platformFee.", {
      field: "total",
    });
  }
  assertCurrencyCode(value.currencyCode, "currencyCode");
  if (!isOrderStatus(value.status)) {
    throw new ValidationError(`Invalid order status "${value.status}".`, {
      field: "status",
    });
  }
  if (!(value.createdAt instanceof Date) || Number.isNaN(value.createdAt.getTime())) {
    throw new ValidationError("createdAt must be valid Date.", { field: "createdAt" });
  }
  if (!(value.updatedAt instanceof Date) || Number.isNaN(value.updatedAt.getTime())) {
    throw new ValidationError("updatedAt must be valid Date.", { field: "updatedAt" });
  }
}

// ── Review ───────────────────────────────────────────────────────────────────

export interface CreateReviewInput {
  orderId: string;
  studentId: string;
  providerId: string;
  rating: number;
  comment?: string;
}

export function validateCreateReviewInput(input: CreateReviewInput): void {
  assertUuid(input.orderId, "orderId");
  assertUuid(input.studentId, "studentId");
  assertUuid(input.providerId, "providerId");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new ValidationError("rating must be an integer between 1 and 5.", {
      field: "rating",
    });
  }
  if (input.comment !== undefined) {
    if (typeof input.comment !== "string") {
      throw new ValidationError("comment must be a string.", { field: "comment" });
    }
    if (input.comment.length > 2000) {
      throw new ValidationError("comment must be 2000 characters or fewer.", {
        field: "comment",
      });
    }
  }
}

export function createReview(input: CreateReviewInput): Review {
  validateCreateReviewInput(input);
  return {
    id: crypto.randomUUID(),
    orderId: input.orderId,
    studentId: input.studentId,
    providerId: input.providerId,
    rating: input.rating,
    comment: (input.comment ?? "").trim(),
    createdAt: new Date(),
  };
}

export function validateReview(value: Review): void {
  assertUuid(value.id, "id");
  assertUuid(value.orderId, "orderId");
  assertUuid(value.studentId, "studentId");
  assertUuid(value.providerId, "providerId");
  if (!Number.isInteger(value.rating) || value.rating < 1 || value.rating > 5) {
    throw new ValidationError("rating must be 1-5.", { field: "rating" });
  }
  if (value.comment.length > 2000) {
    throw new ValidationError("comment must be 2000 or fewer.", { field: "comment" });
  }
  if (!(value.createdAt instanceof Date) || Number.isNaN(value.createdAt.getTime())) {
    throw new ValidationError("createdAt must be valid Date.", { field: "createdAt" });
  }
}

// ── Commission ───────────────────────────────────────────────────────────────

export interface CreateCommissionInput {
  orderId: string;
  providerId: string;
  amount: number;
  rate: number;
  currencyCode?: string;
}

export function validateCreateCommissionInput(input: CreateCommissionInput): void {
  assertUuid(input.orderId, "orderId");
  assertUuid(input.providerId, "providerId");
  if (typeof input.amount !== "number" || Number.isNaN(input.amount) || input.amount < 0) {
    throw new ValidationError("amount must be >= 0.", { field: "amount" });
  }
  if (typeof input.rate !== "number" || Number.isNaN(input.rate) || input.rate < 0 || input.rate > 1) {
    throw new ValidationError("rate must be between 0 and 1.", { field: "rate" });
  }
  if (input.currencyCode !== undefined) {
    assertCurrencyCode(input.currencyCode, "currencyCode");
  }
}

export function createCommission(input: CreateCommissionInput): Commission {
  validateCreateCommissionInput(input);
  return {
    id: crypto.randomUUID(),
    orderId: input.orderId,
    providerId: input.providerId,
    amount: Math.round(input.amount * 100) / 100,
    rate: input.rate,
    currencyCode: input.currencyCode ?? "GBP",
    createdAt: new Date(),
  };
}

export function validateCommission(value: Commission): void {
  assertUuid(value.id, "id");
  assertUuid(value.orderId, "orderId");
  assertUuid(value.providerId, "providerId");
  if (typeof value.amount !== "number" || Number.isNaN(value.amount) || value.amount < 0) {
    throw new ValidationError("amount must be >= 0.", { field: "amount" });
  }
  if (typeof value.rate !== "number" || Number.isNaN(value.rate) || value.rate < 0 || value.rate > 1) {
    throw new ValidationError("rate must be 0-1.", { field: "rate" });
  }
  assertCurrencyCode(value.currencyCode, "currencyCode");
  if (!(value.createdAt instanceof Date) || Number.isNaN(value.createdAt.getTime())) {
    throw new ValidationError("createdAt must be valid Date.", { field: "createdAt" });
  }
}
