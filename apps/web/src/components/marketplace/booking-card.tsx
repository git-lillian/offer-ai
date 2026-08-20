import Link from "next/link";
import type { Booking, ServiceOrder, ServiceListing } from "@offer-ai/domain";

const BOOKING_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

const ORDER_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  disputed: "bg-red-50 text-red-700 border-red-200",
};

export function BookingCard({
  booking,
  listing,
  order,
}: {
  booking: Booking;
  listing?: ServiceListing | null;
  order?: ServiceOrder | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900">
            {listing ? (
              <Link href={`/marketplace/listings/${listing.id}`} className="hover:text-blue-700">
                {listing.title}
              </Link>
            ) : (
              `Booking ${booking.id.slice(0, 8)}`
            )}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Booking {booking.id.slice(0, 8)} · Service {booking.serviceListingId.slice(0, 8)} ·
            Provider {booking.providerId.slice(0, 8)}
          </p>
          {listing?.description ? (
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{listing.description}</p>
          ) : null}
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${BOOKING_STYLES[booking.status] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
        >
          {booking.status}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Scheduled</dt>
          <dd className="mt-0.5 font-medium text-slate-900">
            {booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString() : "Not scheduled"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Created</dt>
          <dd className="mt-0.5 font-medium text-slate-900">
            {new Date(booking.createdAt).toLocaleDateString()}
          </dd>
        </div>
      </dl>

      {order ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-slate-900">Order {order.id.slice(0, 8)}</h4>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${ORDER_STYLES[order.status] ?? "bg-white text-slate-700 border-slate-200"}`}
            >
              {order.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {order.currencyCode} {order.amount.toFixed(2)} + fee {order.platformFee.toFixed(2)} ={" "}
            <span className="font-semibold text-slate-900">
              {order.currencyCode} {order.total.toFixed(2)}
            </span>
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Link
          href={`/marketplace/listings/${booking.serviceListingId}`}
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          View listing →
        </Link>
        <span className="text-slate-300">·</span>
        <Link
          href={`/marketplace/providers/${booking.providerId}`}
          className="font-medium text-slate-600 hover:text-slate-900"
        >
          Provider
        </Link>
      </div>
    </div>
  );
}
