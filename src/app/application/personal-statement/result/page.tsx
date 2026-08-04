"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const STORAGE_KEY = "offer-ai-personal-statement-draft";

type PersonalStatementAnswers = {
  fullName: string;
  course: string;
  university: string;
  motivation: string;
  experience: string;
  careerGoals: string;
};

type SavedDraft = {
  currentStep: number;
  answers: PersonalStatementAnswers;
};

const emptyAnswers: PersonalStatementAnswers = {
  fullName: "",
  course: "",
  university: "",
  motivation: "",
  experience: "",
  careerGoals: "",
};

function loadAnswers(): PersonalStatementAnswers {
  if (typeof window === "undefined") {
    return emptyAnswers;
  }

  try {
    const savedValue = window.localStorage.getItem(STORAGE_KEY);

    if (!savedValue) {
      return emptyAnswers;
    }

    const savedDraft = JSON.parse(savedValue) as Partial<SavedDraft>;

    return {
      ...emptyAnswers,
      ...savedDraft.answers,
    };
  } catch (error) {
    console.error("Unable to load questionnaire answers:", error);
    return emptyAnswers;
  }
}

function createPersonalStatement(
  answers: PersonalStatementAnswers,
): string {
  const course = answers.course || "my chosen course";
  const university =
    answers.university || "my chosen university";

  return [
    `I am applying to study ${course} at ${university} because ${answers.motivation || "I have developed a strong interest in this subject and would like to deepen my knowledge."}`,
    "",
    answers.experience
      ? `My relevant experience has helped me prepare for this opportunity. ${answers.experience}`
      : "Through my academic work and personal development, I have built skills that will support me during this course.",
    "",
    answers.careerGoals
      ? `In the future, ${answers.careerGoals}`
      : "In the future, I hope to apply the knowledge and skills gained from this course to build a meaningful career.",
    "",
    `I believe ${course} at ${university} will provide the academic environment, practical knowledge and opportunities I need to achieve these goals. I am ready to contribute my enthusiasm, experience and commitment to the programme.`,
  ].join("\n");
}

export default function PersonalStatementResultPage() {
  const [answers] = useState(loadAnswers);
  const [copied, setCopied] = useState(false);

  const generatedStatement = useMemo(
    () => createPersonalStatement(answers),
    [answers],
  );

  const hasAnswers =
    answers.fullName ||
    answers.course ||
    answers.university ||
    answers.motivation ||
    answers.experience ||
    answers.careerGoals;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generatedStatement);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Unable to copy statement:", error);
    }
  }

  if (!hasAnswers) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            No questionnaire answers found
          </h1>

          <p className="mt-3 text-slate-600">
            Complete the personal statement questionnaire before
            generating a draft.
          </p>

          <Link
            href="/application/personal-statement"
            className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Start questionnaire
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Offer.ai
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Your personal statement draft
          </h1>

          <p className="mt-2 text-slate-600">
            Review and edit this draft carefully. Only include facts
            that are accurate and genuinely reflect your experience.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <textarea
              defaultValue={generatedStatement}
              rows={22}
              className="w-full resize-y rounded-xl border border-slate-300 px-5 py-4 leading-8 text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Link
                href="/application/personal-statement"
                className="rounded-lg border border-slate-300 px-5 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50"
              >
                Edit questionnaire
              </Link>

              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                {copied ? "Copied" : "Copy draft"}
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">
                Application
              </h2>

              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="font-medium text-slate-700">
                    Applicant
                  </dt>
                  <dd className="mt-1 text-slate-600">
                    {answers.fullName || "Not provided"}
                  </dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-700">
                    Course
                  </dt>
                  <dd className="mt-1 text-slate-600">
                    {answers.course || "Not provided"}
                  </dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-700">
                    University
                  </dt>
                  <dd className="mt-1 text-slate-600">
                    {answers.university || "Not provided"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-semibold text-amber-900">
                Before submitting
              </h2>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Check grammar, course requirements, word limits and
                every factual claim.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}