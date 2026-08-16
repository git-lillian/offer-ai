"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, TextInput } from "@offer-ai/ui";
import { loginAction } from "../actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, {});

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <Link href="/" className="text-sm font-bold uppercase tracking-widest text-blue-600">
            Offer.ai
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-600">
            Log in to continue working on your applications.
          </p>
        </div>

        <form action={formAction} className="mt-8 space-y-5">
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
            autoComplete="current-password"
            required
            placeholder="Enter your password"
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
            {pending ? "Logging in…" : "Log in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Do not have an account?{" "}
          <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-700">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
