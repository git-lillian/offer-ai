"use client";

import { useActionState, useState } from "react";
import { Button } from "@offer-ai/ui";
import { createListingAction } from "@/app/marketplace/actions";

const initialState: { error?: string; ok?: boolean } = {};

const SERVICE_TYPES = [
  "personal_statement",
  "strategy",
  "mentoring",
  "cv_review",
  "interview_prep",
  "other",
] as const;

export function CreateListingForm({ providerId }: { providerId: string }) {
  const [state, formAction, pending] = useActionState(createListingAction, initialState);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceType, setServiceType] = useState<(typeof SERVICE_TYPES)[number]>("personal_statement");
  const [price, setPrice] = useState("49");
  const [currencyCode, setCurrencyCode] = useState("GBP");
  const [turnaroundDays, setTurnaroundDays] = useState("5");

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="font-bold text-slate-900">Create a service listing</h3>
        <p className="mt-1 text-sm text-slate-600">Offer a service to students. Price in your chosen currency.</p>
      </div>

      {state.error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Listing created.
        </div>
      ) : null}

      <input type="hidden" name="providerId" value={providerId} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Title *</span>
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="e.g. Personal statement full review + 48h turnaround"
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Description</span>
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          rows={4}
          placeholder="What the student receives, turnaround details, revisions, scope…"
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Service type *</span>
          <select
            name="serviceType"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as never)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Currency *</span>
          <input
            name="currencyCode"
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
            required
            pattern="^[A-Z]{3}$"
            maxLength={3}
            placeholder="GBP"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Price *</span>
          <input
            name="price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            min={0}
            max={100000}
            step="0.01"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Turnaround (days) *</span>
          <input
            name="turnaroundDays"
            type="number"
            value={turnaroundDays}
            onChange={(e) => setTurnaroundDays(e.target.value)}
            required
            min={1}
            max={90}
            step={1}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create listing"}
      </Button>
    </form>
  );
}
