import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type {
  Booking,
  BookingStatus,
  Commission,
  OrderStatus,
  ProviderProfile,
  ProviderVerificationStatus,
  Review,
  ServiceListing,
  ServiceOrder,
  ServiceType,
} from "@offer-ai/domain";

type Db = SupabaseClient<Database>;

// ── Mappers ───────────────────────────────────────────────────────────────────

function toProviderProfile(
  row: Database["public"]["Tables"]["provider_profiles"]["Row"],
): ProviderProfile {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio,
    verificationStatus: row.verification_status as ProviderVerificationStatus,
    specialisms: [...(row.specialisms ?? [])],
    countryScope: [...(row.country_scope ?? [])],
    languageScope: [...(row.language_scope ?? [])],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toServiceListing(
  row: Database["public"]["Tables"]["service_listings"]["Row"],
): ServiceListing {
  return {
    id: row.id,
    providerId: row.provider_id,
    title: row.title,
    description: row.description,
    serviceType: row.service_type as ServiceType,
    price: Number(row.price),
    currencyCode: row.currency_code,
    turnaroundDays: row.turnaround_days,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toBooking(
  row: Database["public"]["Tables"]["bookings"]["Row"],
): Booking {
  return {
    id: row.id,
    studentId: row.student_id,
    serviceListingId: row.service_listing_id,
    providerId: row.provider_id,
    status: row.status as BookingStatus,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toServiceOrder(
  row: Database["public"]["Tables"]["service_orders"]["Row"],
): ServiceOrder {
  return {
    id: row.id,
    bookingId: row.booking_id,
    studentId: row.student_id,
    providerId: row.provider_id,
    amount: Number(row.amount),
    platformFee: Number(row.platform_fee),
    total: Number(row.total),
    currencyCode: row.currency_code,
    status: row.status as OrderStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toReview(
  row: Database["public"]["Tables"]["service_reviews"]["Row"],
): Review {
  return {
    id: row.id,
    orderId: row.order_id,
    studentId: row.student_id,
    providerId: row.provider_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: new Date(row.created_at),
  };
}

function toCommission(
  row: Database["public"]["Tables"]["marketplace_commissions"]["Row"],
): Commission {
  return {
    id: row.id,
    orderId: row.order_id,
    providerId: row.provider_id,
    amount: Number(row.amount),
    rate: Number(row.rate),
    currencyCode: row.currency_code,
    createdAt: new Date(row.created_at),
  };
}

// ── Provider profile repository ──────────────────────────────────────────────

export class ProviderProfileRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<ProviderProfile | null> {
    const { data, error } = await this.db
      .from("provider_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toProviderProfile(data);
  }

  async findByUserId(userId: string): Promise<ProviderProfile | null> {
    const { data, error } = await this.db
      .from("provider_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toProviderProfile(data);
  }

  async listVerified(limit = 50): Promise<ProviderProfile[]> {
    const { data, error } = await this.db
      .from("provider_profiles")
      .select("*")
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toProviderProfile);
  }

  async listAll(limit = 50): Promise<ProviderProfile[]> {
    const { data, error } = await this.db
      .from("provider_profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toProviderProfile);
  }

  async create(profile: ProviderProfile): Promise<ProviderProfile> {
    const { data, error } = await this.db
      .from("provider_profiles")
      .insert({
        id: profile.id,
        user_id: profile.userId,
        display_name: profile.displayName,
        bio: profile.bio,
        verification_status: profile.verificationStatus,
        specialisms: profile.specialisms,
        country_scope: profile.countryScope,
        language_scope: profile.languageScope,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toProviderProfile(data);
  }

  async update(profile: ProviderProfile): Promise<ProviderProfile> {
    const { data, error } = await this.db
      .from("provider_profiles")
      .update({
        display_name: profile.displayName,
        bio: profile.bio,
        verification_status: profile.verificationStatus,
        specialisms: profile.specialisms,
        country_scope: profile.countryScope,
        language_scope: profile.languageScope,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)
      .select("*")
      .single();
    if (error) throw error;
    return toProviderProfile(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("provider_profiles").delete().eq("id", id);
    if (error) throw error;
  }
}

// ── Service listing repository ───────────────────────────────────────────────

export class ServiceListingRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<ServiceListing | null> {
    const { data, error } = await this.db
      .from("service_listings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toServiceListing(data);
  }

  async listByProvider(
    providerId: string,
    onlyActive = false,
  ): Promise<ServiceListing[]> {
    let query = this.db
      .from("service_listings")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });
    if (onlyActive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toServiceListing);
  }

  async listActive(limit = 50): Promise<ServiceListing[]> {
    const { data, error } = await this.db
      .from("service_listings")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toServiceListing);
  }

  async listAll(filter?: {
    serviceType?: ServiceType;
    isActive?: boolean;
    providerId?: string;
    limit?: number;
  }): Promise<ServiceListing[]> {
    let query = this.db
      .from("service_listings")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter?.serviceType) query = query.eq("service_type", filter.serviceType);
    if (filter?.isActive !== undefined) query = query.eq("is_active", filter.isActive);
    if (filter?.providerId) query = query.eq("provider_id", filter.providerId);
    if (filter?.limit) query = query.limit(filter.limit);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toServiceListing);
  }

  async create(listing: ServiceListing): Promise<ServiceListing> {
    const { data, error } = await this.db
      .from("service_listings")
      .insert({
        id: listing.id,
        provider_id: listing.providerId,
        title: listing.title,
        description: listing.description,
        service_type: listing.serviceType,
        price: listing.price,
        currency_code: listing.currencyCode,
        turnaround_days: listing.turnaroundDays,
        is_active: listing.isActive,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toServiceListing(data);
  }

  async update(listing: ServiceListing): Promise<ServiceListing> {
    const { data, error } = await this.db
      .from("service_listings")
      .update({
        title: listing.title,
        description: listing.description,
        service_type: listing.serviceType,
        price: listing.price,
        currency_code: listing.currencyCode,
        turnaround_days: listing.turnaroundDays,
        is_active: listing.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id)
      .select("*")
      .single();
    if (error) throw error;
    return toServiceListing(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("service_listings").delete().eq("id", id);
    if (error) throw error;
  }
}

// ── Booking repository ───────────────────────────────────────────────────────

export class BookingRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Booking | null> {
    const { data, error } = await this.db
      .from("bookings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toBooking(data);
  }

  async listByStudent(studentId: string): Promise<Booking[]> {
    const { data, error } = await this.db
      .from("bookings")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toBooking);
  }

  async listByProvider(providerId: string): Promise<Booking[]> {
    const { data, error } = await this.db
      .from("bookings")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toBooking);
  }

  async listByListing(serviceListingId: string): Promise<Booking[]> {
    const { data, error } = await this.db
      .from("bookings")
      .select("*")
      .eq("service_listing_id", serviceListingId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toBooking);
  }

  async create(booking: Booking): Promise<Booking> {
    const { data, error } = await this.db
      .from("bookings")
      .insert({
        id: booking.id,
        student_id: booking.studentId,
        service_listing_id: booking.serviceListingId,
        provider_id: booking.providerId,
        status: booking.status,
        scheduled_at: booking.scheduledAt?.toISOString() ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toBooking(data);
  }

  async update(booking: Booking): Promise<Booking> {
    const { data, error } = await this.db
      .from("bookings")
      .update({
        status: booking.status,
        scheduled_at: booking.scheduledAt?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .select("*")
      .single();
    if (error) throw error;
    return toBooking(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("bookings").delete().eq("id", id);
    if (error) throw error;
  }
}

// ── Service order repository ─────────────────────────────────────────────────

export class ServiceOrderRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<ServiceOrder | null> {
    const { data, error } = await this.db
      .from("service_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toServiceOrder(data);
  }

  async findByBooking(bookingId: string): Promise<ServiceOrder | null> {
    const { data, error } = await this.db
      .from("service_orders")
      .select("*")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toServiceOrder(data);
  }

  async listByStudent(studentId: string): Promise<ServiceOrder[]> {
    const { data, error } = await this.db
      .from("service_orders")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toServiceOrder);
  }

  async listByProvider(providerId: string): Promise<ServiceOrder[]> {
    const { data, error } = await this.db
      .from("service_orders")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toServiceOrder);
  }

  async create(order: ServiceOrder): Promise<ServiceOrder> {
    const { data, error } = await this.db
      .from("service_orders")
      .insert({
        id: order.id,
        booking_id: order.bookingId,
        student_id: order.studentId,
        provider_id: order.providerId,
        amount: order.amount,
        platform_fee: order.platformFee,
        total: order.total,
        currency_code: order.currencyCode,
        status: order.status,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toServiceOrder(data);
  }

  async update(order: ServiceOrder): Promise<ServiceOrder> {
    const { data, error } = await this.db
      .from("service_orders")
      .update({
        status: order.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .select("*")
      .single();
    if (error) throw error;
    return toServiceOrder(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("service_orders").delete().eq("id", id);
    if (error) throw error;
  }
}

// ── Review repository ────────────────────────────────────────────────────────

export class ReviewRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Review | null> {
    const { data, error } = await this.db
      .from("service_reviews")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toReview(data);
  }

  async findByOrder(orderId: string): Promise<Review | null> {
    const { data, error } = await this.db
      .from("service_reviews")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toReview(data);
  }

  async listByProvider(providerId: string, limit = 50): Promise<Review[]> {
    const { data, error } = await this.db
      .from("service_reviews")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toReview);
  }

  async listByStudent(studentId: string): Promise<Review[]> {
    const { data, error } = await this.db
      .from("service_reviews")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toReview);
  }

  async create(review: Review): Promise<Review> {
    const { data, error } = await this.db
      .from("service_reviews")
      .insert({
        id: review.id,
        order_id: review.orderId,
        student_id: review.studentId,
        provider_id: review.providerId,
        rating: review.rating,
        comment: review.comment,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toReview(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("service_reviews").delete().eq("id", id);
    if (error) throw error;
  }
}

// ── Commission repository (read-mostly; service_role writes) ─────────────────

export class CommissionRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Commission | null> {
    const { data, error } = await this.db
      .from("marketplace_commissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toCommission(data);
  }

  async findByOrder(orderId: string): Promise<Commission | null> {
    const { data, error } = await this.db
      .from("marketplace_commissions")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toCommission(data);
  }

  async listByProvider(providerId: string): Promise<Commission[]> {
    const { data, error } = await this.db
      .from("marketplace_commissions")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toCommission);
  }

  async create(commission: Commission): Promise<Commission> {
    const { data, error } = await this.db
      .from("marketplace_commissions")
      .insert({
        id: commission.id,
        order_id: commission.orderId,
        provider_id: commission.providerId,
        amount: commission.amount,
        rate: commission.rate,
        currency_code: commission.currencyCode,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toCommission(data);
  }
}
