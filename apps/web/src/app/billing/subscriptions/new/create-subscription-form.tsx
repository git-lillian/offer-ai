"use client";

import { useActionState } from "react";
import { Button, Select, TextInput } from "@offer-ai/ui";
import { createSubscriptionAction } from "@/app/billing/actions";

const initialState: { error?: string; ok?: boolean; subscriptionId?: string } = {};

export function CreateSubscriptionForm({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState(createSubscriptionAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="customerId" value={customerId} />

      <Select
        id="planCode"
        label="Plan"
        name="planCode"
        options={[
          { value: "free", label: "Free — £0" },
          { value: "premium", label: "Premium — £9/month" },
          { value: "pro", label: "Pro — £29/month" },
        ]}
        defaultValue="premium"
        required
        hint="Pro includes adviser_access and priority_support."
      />

      <Select
        id="status"
        label="Status"
        name="status"
        options={[
          { value: "incomplete", label: "Incomplete" },
          { value: "active", label: "Active" },
          { value: "past_due", label: "Past due" },
          { value: "cancelled", label: "Cancelled" },
        ]}
        defaultValue="active"
        required
      />

      <TextInput
        id="stripeSubscriptionId"
        label="Stripe subscription ID"
        name="stripeSubscriptionId"
        placeholder="sub_... (optional)"
        hint="Stored as opaque text, validated locally."
      />

      <TextInput
        id="currentPeriodEnd"
        label="Current period end"
        name="currentPeriodEnd"
        type="datetime-local"
        hint="Leave empty for no expiry."
      />

      {state.error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state.ok ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Subscription created — {state.subscriptionId?.slice(0, 8)}
        </div>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create subscription"}
        </Button>
      </div>
    </form>
  );
}
