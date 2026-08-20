import "server-only";

import {
  BookingRepository,
  ProviderProfileRepository,
  ServiceListingRepository,
  ServiceOrderRepository,
  StudentProfileRepository,
} from "@offer-ai/database";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@offer-ai/domain";
import { MarketplaceService } from "@offer-ai/domain";
import type {
  Booking,
  BookingStatus,
  ProviderProfile,
  ServiceListing,
  ServiceOrder,
  ServiceType,
} from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof getServerClient>>;

const marketplaceDomain = new MarketplaceService();

function toProviderDto(p: ProviderProfile) {
  return {
    id: p.id,
    userId: p.userId,
    displayName: p.displayName,
    bio: p.bio,
    verificationStatus: p.verificationStatus,
    specialisms: p.specialisms,
    countryScope: p.countryScope,
    languageScope: p.languageScope,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toListingDto(l: ServiceListing) {
  return {
    id: l.id,
    providerId: l.providerId,
    title: l.title,
    description: l.description,
    serviceType: l.serviceType,
    price: l.price,
    currencyCode: l.currencyCode,
    turnaroundDays: l.turnaroundDays,
    isActive: l.isActive,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

function toBookingDto(b: Booking) {
  return {
    id: b.id,
    studentId: b.studentId,
    serviceListingId: b.serviceListingId,
    providerId: b.providerId,
    status: b.status,
    scheduledAt: b.scheduledAt ? b.scheduledAt.toISOString() : null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

function toOrderDto(o: ServiceOrder) {
  return {
    id: o.id,
    bookingId: o.bookingId,
    studentId: o.studentId,
    providerId: o.providerId,
    amount: o.amount,
    platformFee: o.platformFee,
    total: o.total,
    currencyCode: o.currencyCode,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

export { toProviderDto, toListingDto, toBookingDto, toOrderDto };

export class MarketplaceApplicationService {
  constructor(private readonly supabase: ServerClient) {}

  // ── Providers ──────────────────────────────────────────────────────────

  async getProviderForUser(userId: string): Promise<ProviderProfile | null> {
    const repo = new ProviderProfileRepository(this.supabase);
    return repo.findByUserId(userId);
  }

  async getProviderById(providerId: string): Promise<ProviderProfile> {
    const repo = new ProviderProfileRepository(this.supabase);
    const provider = await repo.findById(providerId);
    if (!provider) {
      throw new NotFoundError("Provider not found.");
    }
    return provider;
  }

  async listProviders(params: {
    query?: string;
    page?: number;
    pageSize?: number;
    onlyVerified?: boolean;
  }): Promise<{ providers: ProviderProfile[]; total: number }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from("provider_profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (params.onlyVerified) {
      query = query.eq("verification_status", "verified");
    }

    if (params.query) {
      const term = `%${params.query}%`;
      // Search display_name and specialisms via array? Use ilike on display_name + bio
      query = query.or(`display_name.ilike.${term},bio.ilike.${term}`);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    const providers = (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      bio: row.bio,
      verificationStatus: row.verification_status as ProviderProfile["verificationStatus"],
      specialisms: [...(row.specialisms ?? [])],
      countryScope: [...(row.country_scope ?? [])],
      languageScope: [...(row.language_scope ?? [])],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
    return { providers, total: count ?? providers.length };
  }

  async createProviderForUser(
    userId: string,
    input: {
      displayName: string;
      bio?: string;
      specialisms?: string[];
      countryScope?: string[];
      languageScope?: string[];
    },
  ): Promise<ProviderProfile> {
    const repo = new ProviderProfileRepository(this.supabase);
    const existing = await repo.findByUserId(userId);
    if (existing) {
      throw new ConflictError("Provider profile already exists.");
    }

    const provider = marketplaceDomain.createProvider({
      userId,
      displayName: input.displayName,
      bio: input.bio ?? "",
      specialisms: input.specialisms ?? [],
      countryScope: input.countryScope ?? [],
      languageScope: input.languageScope ?? [],
    });

    return repo.create(provider);
  }

  // ── Listings ───────────────────────────────────────────────────────────

  async getListingById(listingId: string): Promise<ServiceListing> {
    const repo = new ServiceListingRepository(this.supabase);
    const listing = await repo.findById(listingId);
    if (!listing) {
      throw new NotFoundError("Listing not found.");
    }
    return listing;
  }

  async listListings(params: {
    query?: string;
    serviceType?: ServiceType;
    providerId?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ listings: ServiceListing[]; total: number }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from("service_listings")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (params.serviceType) {
      query = query.eq("service_type", params.serviceType);
    }
    if (params.providerId) {
      query = query.eq("provider_id", params.providerId);
    }
    if (params.isActive !== undefined) {
      query = query.eq("is_active", params.isActive);
    }
    if (params.query) {
      const term = `%${params.query}%`;
      query = query.or(`title.ilike.${term},description.ilike.${term}`);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    const listings = (data ?? []).map((row) => ({
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
    }));
    return { listings, total: count ?? listings.length };
  }

  async listListingsByProvider(providerId: string): Promise<ServiceListing[]> {
    const repo = new ServiceListingRepository(this.supabase);
    return repo.listByProvider(providerId);
  }

  async createListingForUser(
    userId: string,
    input: {
      providerId: string;
      title: string;
      description?: string;
      serviceType: ServiceType;
      price: number;
      currencyCode: string;
      turnaroundDays: number;
      isActive?: boolean;
    },
  ): Promise<ServiceListing> {
    const providerRepo = new ProviderProfileRepository(this.supabase);
    const provider = await providerRepo.findByUserId(userId);
    if (!provider) {
      throw new NotFoundError("Provider profile not found. Create a provider profile first.");
    }
    if (provider.id !== input.providerId) {
      throw new AuthorizationError("You can only create listings for your own provider profile.");
    }

    const listing = marketplaceDomain.createListing({
      providerId: input.providerId,
      title: input.title,
      description: input.description ?? "",
      serviceType: input.serviceType,
      price: input.price,
      currencyCode: input.currencyCode,
      turnaroundDays: input.turnaroundDays,
      isActive: input.isActive ?? true,
    });

    const repo = new ServiceListingRepository(this.supabase);
    return repo.create(listing);
  }

  // ── Bookings ───────────────────────────────────────────────────────────

  async createBookingForUser(
    userId: string,
    input: {
      serviceListingId: string;
      providerId: string;
      scheduledAt?: string | null;
    },
  ): Promise<Booking> {
    const profileRepo = new StudentProfileRepository(this.supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError("Student profile not found. Complete onboarding first.");
    }

    const listingRepo = new ServiceListingRepository(this.supabase);
    const listing = await listingRepo.findById(input.serviceListingId);
    if (!listing) {
      throw new NotFoundError("Listing not found.");
    }
    if (!listing.isActive) {
      throw new ValidationError("This listing is not currently active.");
    }
    if (listing.providerId !== input.providerId) {
      throw new ValidationError("Provider does not match the listing's provider.");
    }

    // Ensure provider exists
    const providerRepo = new ProviderProfileRepository(this.supabase);
    const provider = await providerRepo.findById(listing.providerId);
    if (!provider) {
      throw new NotFoundError("Provider not found.");
    }

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      throw new ValidationError("scheduledAt must be a valid date.");
    }

    const booking = marketplaceDomain.createBooking({
      studentId: profile.id,
      serviceListingId: listing.id,
      providerId: provider.id,
      scheduledAt,
    });

    const bookingRepo = new BookingRepository(this.supabase);
    return bookingRepo.create(booking);
  }

  async listBookingsForStudent(userId: string): Promise<Booking[]> {
    const profileRepo = new StudentProfileRepository(this.supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) return [];
    const repo = new BookingRepository(this.supabase);
    return repo.listByStudent(profile.id);
  }

  async listBookingsForProviderUser(userId: string): Promise<Booking[]> {
    const providerRepo = new ProviderProfileRepository(this.supabase);
    const provider = await providerRepo.findByUserId(userId);
    if (!provider) return [];
    const repo = new BookingRepository(this.supabase);
    return repo.listByProvider(provider.id);
  }

  async transitionBookingForUser(
    userId: string,
    bookingId: string,
    toStatus: BookingStatus,
  ): Promise<Booking> {
    const profileRepo = new StudentProfileRepository(this.supabase);
    const providerRepo = new ProviderProfileRepository(this.supabase);
    const profile = await profileRepo.findByUserId(userId);
    const provider = await providerRepo.findByUserId(userId);

    const bookingRepo = new BookingRepository(this.supabase);
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError("Booking not found.");
    }

    const isStudentOwner = profile ? booking.studentId === profile.id : false;
    const isProviderOwner = provider ? booking.providerId === provider.id : false;
    if (!isStudentOwner && !isProviderOwner) {
      throw new AuthorizationError("You do not have access to this booking.");
    }

    const transitioned = marketplaceDomain.transitionBooking(booking, toStatus);
    return bookingRepo.update(transitioned);
  }

  // ── Orders ─────────────────────────────────────────────────────────────

  async createOrderForUser(
    userId: string,
    input: {
      bookingId: string;
      amount: number;
      platformFee: number;
      currencyCode?: string;
    },
  ): Promise<ServiceOrder> {
    const profileRepo = new StudentProfileRepository(this.supabase);
    const providerRepo = new ProviderProfileRepository(this.supabase);
    const profile = await profileRepo.findByUserId(userId);
    const provider = await providerRepo.findByUserId(userId);

    const bookingRepo = new BookingRepository(this.supabase);
    const booking = await bookingRepo.findById(input.bookingId);
    if (!booking) {
      throw new NotFoundError("Booking not found.");
    }

    const isStudentOwner = profile ? booking.studentId === profile.id : false;
    const isProviderOwner = provider ? booking.providerId === provider.id : false;
    if (!isStudentOwner && !isProviderOwner) {
      throw new AuthorizationError("You do not have access to this booking.");
    }

    const order = marketplaceDomain.createOrder({
      bookingId: booking.id,
      studentId: booking.studentId,
      providerId: booking.providerId,
      amount: input.amount,
      platformFee: input.platformFee,
      currencyCode: input.currencyCode ?? "GBP",
    });

    const repo = new ServiceOrderRepository(this.supabase);
    return repo.create(order);
  }

  async createOrderWithRateForUser(
    userId: string,
    input: {
      bookingId: string;
      amount: number;
      rate: number;
      currencyCode?: string;
    },
  ): Promise<ServiceOrder> {
    const profileRepo = new StudentProfileRepository(this.supabase);
    const providerRepo = new ProviderProfileRepository(this.supabase);
    const profile = await profileRepo.findByUserId(userId);
    const provider = await providerRepo.findByUserId(userId);

    const bookingRepo = new BookingRepository(this.supabase);
    const booking = await bookingRepo.findById(input.bookingId);
    if (!booking) {
      throw new NotFoundError("Booking not found.");
    }

    const isStudentOwner = profile ? booking.studentId === profile.id : false;
    const isProviderOwner = provider ? booking.providerId === provider.id : false;
    if (!isStudentOwner && !isProviderOwner) {
      throw new AuthorizationError("You do not have access to this booking.");
    }

    const order = marketplaceDomain.createOrderWithRate({
      bookingId: booking.id,
      studentId: booking.studentId,
      providerId: booking.providerId,
      amount: input.amount,
      rate: input.rate,
      currencyCode: input.currencyCode ?? "GBP",
    });

    const repo = new ServiceOrderRepository(this.supabase);
    return repo.create(order);
  }

  async listOrdersForStudent(userId: string): Promise<ServiceOrder[]> {
    const profileRepo = new StudentProfileRepository(this.supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) return [];
    const repo = new ServiceOrderRepository(this.supabase);
    return repo.listByStudent(profile.id);
  }

  async listOrdersForProviderUser(userId: string): Promise<ServiceOrder[]> {
    const providerRepo = new ProviderProfileRepository(this.supabase);
    const provider = await providerRepo.findByUserId(userId);
    if (!provider) return [];
    const repo = new ServiceOrderRepository(this.supabase);
    return repo.listByProvider(provider.id);
  }
}

export async function createMarketplaceService(): Promise<MarketplaceApplicationService> {
  const supabase = await getServerClient();
  return new MarketplaceApplicationService(supabase);
}
