"use client";

import Link from "next/link";
import {
  FormEvent,
  useState,
  useSyncExternalStore,
} from "react";
import { createClient } from "@/lib/supabase/client";

const QUESTIONNAIRE_STORAGE_KEY =
  "offer-ai-personal-statement-draft";

const GENERATED_DRAFT_STORAGE_KEY =
  "offer-ai-generated-personal-statement";

type QuestionnaireAnswers = {
  fullName: string;
  course: string;
  university: string;
};

type SavedQuestionnaire = {
  answers?: Partial<QuestionnaireAnswers>;
};

type HumanReviewForm = {
  email: string;
  applicantName: string;
  course: string;
  university: string;
  draft: string;
  instructions: string;
};

const emptyForm: HumanReviewForm = {
  email: "",
  applicantName: "",
  course: "",
  university: "",
  draft: "",
  instructions: "",
};

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function loadInitialForm(): HumanReviewForm {
  if (typeof window === "undefined") {
    return emptyForm;
  }

  let applicantName = "";
  let course = "";
  let university = "";
  let draft = "";

  try {
    const questionnaireValue =
      window.localStorage.getItem(
        QUESTIONNAIRE_STORAGE_KEY,
      );

    if (questionnaireValue) {
      const savedQuestionnaire = JSON.parse(
        questionnaireValue,
      ) as SavedQuestionnaire;

      applicantName =
        savedQuestionnaire.answers?.fullName ?? "";

      course =
        savedQuestionnaire.answers?.course ?? "";

      university =
        savedQuestionnaire.answers?.university ?? "";
    }
  } catch (error) {
    console.error(
      "Unable to load questionnaire details:",
      error,
    );
  }

  try {
    draft =
      window.localStorage.getItem(
        GENERATED_DRAFT_STORAGE_KEY,
      ) ?? "";
  } catch (error) {
    console.error(
      "Unable to load generated draft:",
      error,
    );
  }

  return {
    email: "",
    applicantName,
    course,
    university,
    draft,
    instructions: "",
  };
}

export default function HumanReviewPage() {
  const isClient = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  const [form, setForm] =
    useState<HumanReviewForm>(loadInitialForm);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [orderId, setOrderId] =
    useState("");

  function updateField(
    field: keyof HumanReviewForm,
    value: string,
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage("");
    setOrderId("");

    const email = form.email.trim();
    const applicantName =
      form.applicantName.trim();
    const course = form.course.trim();
    const university =
      form.university.trim();
    const draft = form.draft.trim();
    const instructions =
      form.instructions.trim();

    if (
      !email ||
      !applicantName ||
      !course ||
      !university ||
      !draft
    ) {
      setErrorMessage(
        "Please complete all required fields.",
      );

      return;
    }

    if (draft.length < 50) {
      setErrorMessage(
        "The personal statement draft must contain at least 50 characters.",
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setErrorMessage(
          "Please log in before submitting a human review order.",
        );

        return;
      }

      const { data, error } = await supabase
        .from("review_orders")
        .insert({
          user_id: user.id,
          email,
          applicant_name: applicantName,
          course,
          university,
          draft,
          instructions,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      setOrderId(data.id);
    } catch (error) {
      console.error(
        "Unable to create human review order:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit your review request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isClient) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <p className="text-slate-600">
          Loading review form...
        </p>
      </main>
    );
  }

  if (orderId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
        <section className="w-full max-w-xl rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
            ✓
          </div>

          <p className="mt-5 text-sm font-semibold uppercase tracking-widest text-green-700">
            Request received
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Your review order has been created
          </h1>

          <p className="mt-4 leading-7 text-slate-600">
            Your application details and current draft have
            been saved. Payment has not been taken yet.
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Order reference
            </p>

            <p className="mt-2 break-all font-mono text-sm text-slate-800">
              {orderId}
            </p>

            <p className="mt-4 text-sm text-slate-600">
              Status: Awaiting payment
            </p>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/application/personal-statement/result"
              className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Return to draft
            </Link>

            <button
              type="button"
              onClick={() =>
                window.alert(
                  "Stripe payment will be connected in the next step.",
                )
              }
              className="rounded-lg bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
            >
              Continue to payment
            </button>
          </div>
        </section>
      </main>
    );
  }

  const wordCount = form.draft.trim()
    ? form.draft.trim().split(/\s+/).length
    : 0;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Link
            href="/application/personal-statement/result"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            ← Return to your draft
          </Link>

          <p className="mt-7 text-sm font-semibold uppercase tracking-widest text-violet-700">
            Optional add-on
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Human expert review
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Submit your current personal statement for
            detailed feedback on structure, clarity,
            relevance and writing quality.
          </p>
        </div>

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <TextInput
                id="email"
                label="Contact email"
                type="email"
                value={form.email}
                placeholder="you@example.com"
                onChange={(value) =>
                  updateField("email", value)
                }
              />

              <TextInput
                id="applicantName"
                label="Applicant name"
                value={form.applicantName}
                placeholder="Alex Li"
                onChange={(value) =>
                  updateField(
                    "applicantName",
                    value,
                  )
                }
              />

              <TextInput
                id="course"
                label="Target course"
                value={form.course}
                placeholder="MSc Computer Science"
                onChange={(value) =>
                  updateField("course", value)
                }
              />

              <TextInput
                id="university"
                label="Target university"
                value={form.university}
                placeholder="University of Edinburgh"
                onChange={(value) =>
                  updateField(
                    "university",
                    value,
                  )
                }
              />
            </div>

            <div>
              <label
                htmlFor="draft"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Personal statement draft
              </label>

              <textarea
                id="draft"
                name="draft"
                required
                rows={18}
                value={form.draft}
                onChange={(event) =>
                  updateField(
                    "draft",
                    event.target.value,
                  )
                }
                placeholder="Your personal statement should appear here automatically. You can also paste it manually."
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
              />

              <p className="mt-2 text-right text-sm text-slate-500">
                {wordCount} words
              </p>
            </div>

            <div>
              <label
                htmlFor="instructions"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                What should the reviewer focus on?
              </label>

              <textarea
                id="instructions"
                name="instructions"
                rows={5}
                maxLength={3000}
                value={form.instructions}
                onChange={(event) =>
                  updateField(
                    "instructions",
                    event.target.value,
                  )
                }
                placeholder="For example: Please focus on the opening paragraph, course motivation and overall structure."
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-lg bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
            >
              {isSubmitting
                ? "Creating review order..."
                : "Submit review request"}
            </button>

            <p className="text-center text-xs leading-5 text-slate-500">
              Submitting this form does not take payment.
              You will review the order before proceeding
              to secure payment.
            </p>
          </form>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">
                Human expert review
              </p>

              <p className="mt-3 text-3xl font-bold text-slate-900">
                £29.99
              </p>

              <p className="mt-1 text-sm text-slate-600">
                One-time payment
              </p>

              <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-700">
                <li>✓ Grammar and clarity review</li>
                <li>✓ Structure and content feedback</li>
                <li>✓ One professionally reviewed version</li>
                <li>✓ Delivery within 3 working days</li>
              </ul>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-semibold text-amber-900">
                Important
              </h2>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Human review improves the presentation and
                clarity of your application, but it cannot
                guarantee admission or an offer.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">
                Your information
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Only include accurate information that
                genuinely reflects your qualifications and
                experience.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

type TextInputProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  type?: "text" | "email";
  onChange: (value: string) => void;
};

function TextInput({
  id,
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: TextInputProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      <input
        id={id}
        name={id}
        type={type}
        required
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
      />
    </div>
  );
}