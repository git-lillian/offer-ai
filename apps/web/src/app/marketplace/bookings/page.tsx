import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { BookingCard } from "@/components/marketplace/booking-card";
import { createMarketplaceService } from "@/lib/services/marketplace";
import type { Booking, ServiceListing, ServiceOrder } from "@offer-ai/domain";

export const metadata = {
  title: "My bookings | Offer.ai",
};

export default async function BookingsPage() {
  const user = await requireUser();
  const supabase = await getServerClient();
  const marketplace = await createMarketplaceService();

  let bookings: Booking[] = [];
  let orders: ServiceOrder[] = [];
  let error: string | null = null;
  let providerBookings: Booking[] = [];
  let providerOrders: ServiceOrder[] = [];

  try {
    bookings = await marketplace.listBookingsForStudent(user.id);
    orders = await marketplace.listOrdersForStudent(user.id);
    providerBookings = await marketplace.listBookingsForProviderUser(user.id);
    providerOrders = await marketplace.listOrdersForProviderUser(user.id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load bookings.";
  }

  // Enrich bookings with listings (best effort)
  const allBookings = [...bookings, ...providerBookings];
  const listingIds = [...new Set(allBookings.map((b) => b.serviceListingId))];
  const orderByBooking = new Map<string, ServiceOrder>();
  for (const order of [...orders, ...providerOrders]) {
    orderByBooking.set(order.bookingId, order);
  }

  let listingsMap = new Map<string, ServiceListing>();
  if (listingIds.length > 0) {
    try {
      const { data } = await supabase.from("service_listings").select("*").in("id", listingIds);
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const id = row.id as string;
        listingsMap.set(id, {
          id: row.id as string,
          providerId: row.provider_id as string,
          title: row.title as string,
          description: row.description as string,
          serviceType: row.service_type as ServiceListing["serviceType"],
          price: Number(row.price),
          currencyCode: row.currency_code as string,
          turnaroundDays: row.turnaround_days as number,
          isActive: row.is_active as boolean,
          createdAt: new Date(row.created_at as string),
          updatedAt: new Date(row.updated_at as string),
        });
      }
    } catch {
      listingsMap = new Map();
    }
  }

  const isProvider = providerBookings.length > 0 || providerOrders.length > 0;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Marketplace</p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Your bookings</h1>
              <p className="mt-2 text-slate-600">
                Bookings you made as a student{isProvider ? " and as a provider" : ""}, plus related orders.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/marketplace"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Browse marketplace
              </Link>
              <Link
                href="/marketplace/providers/new"
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Provider area
              </Link>
            </div>
          </div>

          {error ? (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div>
            <h2 className="text-lg font-bold text-slate-900">As student · {bookings.length} bookings</h2>
            {bookings.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <p className="font-semibold text-slate-900">No bookings yet</p>
                <p className="mt-2 text-sm text-slate-600">
                  Browse providers and listings, then book a service. Your student id is derived from your session.
                </p>
                <Link
                  href="/marketplace"
                  className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  Browse marketplace →
                </Link>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {bookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    listing={listingsMap.get(booking.serviceListingId) ?? null}
                    order={orderByBooking.get(booking.id) ?? null}
                  />
                ))}
              </div>
            )}
          </div>

          {orders.length > 0 ? (
            <div>
              <h2 className="text-lg font-bold text-slate-900">Orders · {orders.length}</h2>
              <ul className="mt-4 space-y-3">
                {orders.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        Order {order.id.slice(0, 8)} · Booking {order.bookingId.slice(0, 8)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {order.currencyCode} {order.amount.toFixed(2)} + fee {order.platformFee.toFixed(2)} ={" "}
                        {order.currencyCode} {order.total.toFixed(2)} · {order.status}
                      </p>
                    </div>
                    <Link href={`/marketplace/providers/${order.providerId}`} className="text-xs font-semibold text-blue-600">
                      Provider
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {isProvider ? (
            <div className="rounded-2xl border border-blue-200 bg-white p-6">
              <h2 className="text-lg font-bold text-slate-900">As provider · {providerBookings.length} bookings</h2>
              <p className="mt-1 text-sm text-slate-600">Bookings made against your listings.</p>
              {providerBookings.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                  No bookings on your services yet.
                </p>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {providerBookings.map((booking) => (
                    <BookingCard
                      key={`prov-${booking.id}`}
                      booking={booking}
                      listing={listingsMap.get(booking.serviceListingId) ?? null}
                      order={orderByBooking.get(booking.id) ?? null}
                    />
                  ))}
                </div>
              )}
              {providerOrders.length > 0 ? (
                <div className="mt-6">
                  <h3 className="font-semibold text-slate-900">Provider orders · {providerOrders.length}</h3>
                  <ul className="mt-3 space-y-3">
                    {providerOrders.map((order) => (
                      <li
                        key={`prov-ord-${order.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            Order {order.id.slice(0, 8)} · Student {order.studentId.slice(0, 8)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {order.currencyCode} {order.amount.toFixed(2)} + fee {order.platformFee.toFixed(2)} ={" "}
                            {order.currencyCode} {order.total.toFixed(2)} · {order.status}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">API:</span> POST /api/marketplace/bookings, POST
              /api/marketplace/orders. Both validate with zod and derive identity from your session; user_id is
              never trusted from the browser.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
