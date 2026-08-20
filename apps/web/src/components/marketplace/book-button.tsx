"use client";

import { useActionState, useState } from "react";
import { Button } from "@offer-ai/ui";
import { createBookingAction } from "@/app/marketplace/actions";

const initialState: { error?: string; ok?: boolean; bookingId?: string } = {};

export function BookButton({
  serviceListingId,
  providerId,
}: {
  serviceListingId: string;
  providerId: string;
}) {
  const [state, formAction, pending] = useActionState(createBookingAction, initialState);
  const [scheduledAt, setScheduledAt] = useState("");

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="font-bold text-slate-900">Book this service</h3>
      <p className="text-sm text-slate-600">
        Confirm to create a booking. Your student profile is derived from your session.
      </p>

      {state.error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Booking created {state.bookingId ? `· ${state.bookingId.slice(0, 8)}` : ""}. View it in{" "}
          <a href="/marketplace/bookings" className="underline">
            your bookings
          </a>
          .
        </div>
      ) : null}

      <input type="hidden" name="serviceListingId" value={serviceListingId} />
      <input type="hidden" name="providerId" value={providerId} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Preferred date (optional)</span>
        <input
          name="scheduledAt"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
        <span className="mt-1 block text-xs text-slate-500">Leave empty for no fixed schedule.</span>
      </label>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Booking…" : "Confirm booking"}
      </Button>
    </form>
  );
}
