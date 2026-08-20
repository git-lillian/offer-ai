"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createBookingSchema,
  createProviderProfileSchema,
  createServiceListingSchema,
  createServiceOrderSchema,
  createOrderWithRateSchema,
} from "@offer-ai/contracts";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { createMarketplaceService } from "@/lib/services/marketplace";

export type MarketplaceActionState = {
  error?: string;
  ok?: boolean;
  bookingId?: string;
  providerId?: string;
  listingId?: string;
  orderId?: string;
};

function parseCommaList(value: FormDataEntryValue | null): string[] {
  if (value === null || value === "") return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createProviderAction(
  _prevState: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const raw = {
    displayName: String(formData.get("displayName") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    specialisms: parseCommaList(formData.get("specialisms")),
    countryScope: parseCommaList(formData.get("countryScope")).map((s) => s.toUpperCase()),
    languageScope: parseCommaList(formData.get("languageScope")),
  };

  const parsed = createProviderProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const service = await createMarketplaceService();
    const provider = await service.createProviderForUser(user.id, parsed.data);
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/providers/${provider.id}`);
    redirect(`/marketplace/providers/${provider.id}`);
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) {
      throw error;
    }
    return { error: error instanceof Error ? error.message : "Unable to create provider profile." };
  }
}

export async function createListingAction(
  _prevState: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const raw = {
    providerId: String(formData.get("providerId") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    serviceType: String(formData.get("serviceType") ?? ""),
    price: Number(formData.get("price")),
    currencyCode: String(formData.get("currencyCode") ?? "GBP").toUpperCase(),
    turnaroundDays: Number(formData.get("turnaroundDays")),
    isActive: true,
  };

  const parsed = createServiceListingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const service = await createMarketplaceService();
    const listing = await service.createListingForUser(user.id, parsed.data);
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/providers/${listing.providerId}`);
    revalidatePath(`/marketplace/listings/${listing.id}`);
    return { ok: true, listingId: listing.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create listing." };
  }
}

export async function createBookingAction(
  _prevState: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const rawScheduled = formData.get("scheduledAt");
  let scheduledAt: string | null | undefined;
  if (rawScheduled === null || rawScheduled === "") {
    scheduledAt = null;
  } else {
    const raw = String(rawScheduled);
    // datetime-local comes as "2026-08-20T10:00" without timezone; interpret as local and convert to ISO
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      return { error: "scheduledAt must be a valid date." };
    }
    scheduledAt = d.toISOString();
  }

  const rawInput = {
    serviceListingId: String(formData.get("serviceListingId") ?? ""),
    providerId: String(formData.get("providerId") ?? ""),
    scheduledAt,
  };

  const parsed = createBookingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const service = await createMarketplaceService();
    const booking = await service.createBookingForUser(user.id, {
      serviceListingId: parsed.data.serviceListingId,
      providerId: parsed.data.providerId,
      scheduledAt: parsed.data.scheduledAt ?? null,
    });
    revalidatePath("/marketplace/bookings");
    revalidatePath(`/marketplace/listings/${booking.serviceListingId}`);
    return { ok: true, bookingId: booking.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create booking." };
  }
}

export async function createOrderAction(
  _prevState: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const raw = {
    bookingId: String(formData.get("bookingId") ?? ""),
    amount: Number(formData.get("amount")),
    platformFee: Number(formData.get("platformFee")),
    currencyCode: String(formData.get("currencyCode") ?? "GBP").toUpperCase(),
  };

  const parsed = createServiceOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const service = await createMarketplaceService();
    const order = await service.createOrderForUser(user.id, parsed.data);
    revalidatePath("/marketplace/bookings");
    return { ok: true, orderId: order.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create order." };
  }
}

export async function createOrderWithRateAction(
  _prevState: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const raw = {
    bookingId: String(formData.get("bookingId") ?? ""),
    amount: Number(formData.get("amount")),
    rate: Number(formData.get("rate")),
    currencyCode: String(formData.get("currencyCode") ?? "GBP").toUpperCase(),
  };

  const parsed = createOrderWithRateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const user = await requireUser();
    const supabase = await getServerClient();
    void supabase;
    const service = await createMarketplaceService();
    const order = await service.createOrderWithRateForUser(user.id, parsed.data);
    revalidatePath("/marketplace/bookings");
    return { ok: true, orderId: order.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create order." };
  }
}

// Aliases matching spec naming (createProvider / createListing / createBooking / createOrder)
export const createProvider = createProviderAction;
export const createListing = createListingAction;
export const createBooking = createBookingAction;
export const createOrder = createOrderAction;
