"use client";

import { useActionState } from "react";
import { Button, Select, TextInput } from "@offer-ai/ui";
import { createArtifactAction } from "@/app/artifacts/actions";

const ARTIFACT_TYPE_OPTIONS = [
  { value: "cv", label: "CV" },
  { value: "personal_statement", label: "Personal statement" },
  { value: "statement_of_purpose", label: "Statement of purpose" },
  { value: "supplementary_answer", label: "Supplementary answer" },
  { value: "reference_draft", label: "Reference draft" },
  { value: "portfolio_text", label: "Portfolio text" },
  { value: "application_note", label: "Application note" },
];

export function CreateArtifactForm() {
  const [state, formAction, pending] = useActionState(createArtifactAction, {});

  return (
    <form
      action={formAction}
      className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
    >
      <Select
        id="artifactType"
        label="Artifact type"
        required
        name="artifactType"
        options={ARTIFACT_TYPE_OPTIONS}
        placeholder="Select a type"
      />

      <TextInput
        id="title"
        label="Title"
        required
        name="title"
        placeholder="e.g. Personal statement - Computer Science"
        maxLength={200}
      />

      <TextInput
        id="caseId"
        label="Linked case (optional)"
        hint="Leave blank to create a standalone document, or paste an application case ID to link it."
        name="caseId"
        placeholder="00000000-0000-0000-0000-000000000000"
      />

      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          {state.error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create artifact"}
        </Button>
      </div>
    </form>
  );
}
