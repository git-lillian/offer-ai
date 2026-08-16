"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, TextInput } from "@offer-ai/ui";
import { registerAction } from "../actions";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, {});

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold text-slate-900">
            Offer.ai
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-slate-900">Create your account</h1>
          <p className="mt-2 text-sm text-slate-600">
            Start building stronger application documents.
          </p>
        </div>

        <form action={formAction} className="space-y-5">
          <TextInput
            id="fullName"
            label="Full name"
            autoComplete="name"
            required
            placeholder="Alex Li"
          />
          <TextInput
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
          <TextInput
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
          />

          {state.error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
            >
              {state.error}
            </div>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}
