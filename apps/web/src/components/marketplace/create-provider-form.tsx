"use client";

import { useActionState, useState } from "react";
import { Button } from "@offer-ai/ui";
import { createProviderAction } from "@/app/marketplace/actions";

const initialState: { error?: string; ok?: boolean } = {};

export function CreateProviderForm() {
  const [state, formAction, pending] = useActionState(createProviderAction, initialState);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [specialisms, setSpecialisms] = useState("");
  const [countryScope, setCountryScope] = useState("");
  const [languageScope, setLanguageScope] = useState("");

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Create provider profile</h2>
        <p className="mt-1 text-sm text-slate-600">
          Become a provider to offer services such as personal statement review, strategy and mentoring.
        </p>
      </div>

      {state.error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Provider profile created — redirecting…
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Display name *</span>
        <input
          name="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          maxLength={120}
          placeholder="e.g. Dr. Jane — Oxbridge Admissions"
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Bio</span>
        <textarea
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Your experience, credentials, subjects and how you help students…"
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
        <span className="mt-1 block text-xs text-slate-500">{bio.length}/2000</span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Specialisms (comma separated)</span>
        <input
          name="specialisms"
          value={specialisms}
          onChange={(e) => setSpecialisms(e.target.value)}
          placeholder="e.g. personal statement, strategy, mentoring"
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
        <span className="mt-1 block text-xs text-slate-500">Max 20, each 80 chars</span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Country scope (ISO 3166-1 alpha-2, comma separated)</span>
        <input
          name="countryScope"
          value={countryScope}
          onChange={(e) => setCountryScope(e.target.value)}
          placeholder="e.g. GB, US"
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Language scope (comma separated, e.g. en, en-GB)</span>
        <input
          name="languageScope"
          value={languageScope}
          onChange={(e) => setLanguageScope(e.target.value)}
          placeholder="e.g. en, fr"
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create provider profile"}
      </Button>
    </form>
  );
}
