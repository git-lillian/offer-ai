"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

const QUESTIONNAIRE_STORAGE_KEY =
  "offer-ai-personal-statement-draft";

const GENERATED_DRAFT_STORAGE_KEY =
  "offer-ai-generated-personal-statement";

type PersonalStatementAnswers = {
  fullName: string;
  course: string;
  university: string;
  motivation: string;
  experience: string;
  careerGoals: string;
};

type SavedQuestionnaire = {
  currentStep?: number;
  answers?: Partial<PersonalStatementAnswers>;
};

type InitialPageData = {
  answers: PersonalStatementAnswers;
  draft: string;
};

type GenerateResponse = {
  statement?: string;
  error?: string;
};

const emptyAnswers: PersonalStatementAnswers = {
  fullName: "",
  course: "",
  university: "",
  motivation: "",
  experience: "",
  careerGoals: "",
};

const emptyPageData: InitialPageData = {
  answers: emptyAnswers,
  draft: "",
};

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function loadInitialPageData(): InitialPageData {
  if (typeof window === "undefined") {
    return emptyPageData;
  }

  let answers = { ...emptyAnswers };
  let draft = "";

  try {
    const savedQuestionnaire =
      window.localStorage.getItem(
        QUESTIONNAIRE_STORAGE_KEY,
      );

    if (savedQuestionnaire) {
      const parsedQuestionnaire = JSON.parse(
        savedQuestionnaire,
      ) as SavedQuestionnaire;

      answers = {
        ...emptyAnswers,
        ...parsedQuestionnaire.answers,
      };
    }
  } catch (error) {
    console.error(
      "Unable to load questionnaire answers:",
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
      "Unable to load generated personal statement:",
      error,
    );
  }

  return {
    answers,
    draft,
  };
}

function hasRequiredAnswers(
  answers: PersonalStatementAnswers,
) {
  return Boolean(
    answers.course.trim() &&
      answers.university.trim() &&
      answers.motivation.trim() &&
      answers.experience.trim() &&
      answers.careerGoals.trim(),
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to generate your personal statement.";
}

export default function PersonalStatementResultPage() {
  const isClient = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  const [initialPageData] =
    useState<InitialPageData>(loadInitialPageData);

  const [answers] = useState<PersonalStatementAnswers>(
    initialPageData.answers,
  );

  const [draft, setDraft] = useState(
    initialPageData.draft,
  );

  const [isGenerating, setIsGenerating] = useState(
    () =>
      !initialPageData.draft &&
      hasRequiredAnswers(initialPageData.answers),
  );

  const [errorMessage, setErrorMessage] =
    useState("");

  const [copied, setCopied] = useState(false);

  const hasAnyContent = useMemo(
    () =>
      Boolean(
        draft.trim() ||
          answers.fullName.trim() ||
          answers.course.trim() ||
          answers.university.trim() ||
          answers.motivation.trim() ||
          answers.experience.trim() ||
          answers.careerGoals.trim(),
      ),
    [answers, draft],
  );

  const wordCount = useMemo(() => {
    const trimmedDraft = draft.trim();

    if (!trimmedDraft) {
      return 0;
    }

    return trimmedDraft.split(/\s+/).length;
  }, [draft]);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    try {
      if (draft.trim()) {
        window.localStorage.setItem(
          GENERATED_DRAFT_STORAGE_KEY,
          draft,
        );
      } else {
        window.localStorage.removeItem(
          GENERATED_DRAFT_STORAGE_KEY,
        );
      }
    } catch (error) {
      console.error(
        "Unable to save generated draft:",
        error,
      );
    }
  }, [draft, isClient]);

  useEffect(() => {
    if (
      !isClient ||
      initialPageData.draft ||
      !hasRequiredAnswers(answers)
    ) {
      return;
    }

    const controller = new AbortController();

    async function generateInitialDraft() {
      try {
        const response = await fetch(
          "/api/generate-personal-statement",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              answers,
            }),
            signal: controller.signal,
          },
        );

        const result =
          (await response.json()) as GenerateResponse;

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Unable to generate your personal statement.",
          );
        }

        if (!result.statement?.trim()) {
          throw new Error(
            "The AI returned an empty personal statement.",
          );
        }

        if (!controller.signal.aborted) {
          setDraft(result.statement.trim());
          setErrorMessage("");
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        if (!controller.signal.aborted) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsGenerating(false);
        }
      }
    }

    void generateInitialDraft();

    return () => {
      controller.abort();
    };
  }, [answers, initialPageData.draft, isClient]);

  async function generateStatement() {
    if (!hasRequiredAnswers(answers)) {
      setErrorMessage(
        "Please complete every questionnaire section before generating your personal statement.",
      );

      return;
    }

    setIsGenerating(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/generate-personal-statement",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answers,
          }),
        },
      );

      const result =
        (await response.json()) as GenerateResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to generate your personal statement.",
        );
      }

      if (!result.statement?.trim()) {
        throw new Error(
          "The AI returned an empty personal statement.",
        );
      }

      setDraft(result.statement.trim());
    } catch (error) {
      console.error(
        "Personal statement generation failed:",
        error,
      );

      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (!draft.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(draft);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        "Unable to copy personal statement:",
        error,
      );

      setErrorMessage(
        "The draft could not be copied automatically.",
      );
    }
  }

  function handleClearDraft() {
    const shouldClear = window.confirm(
      "Are you sure you want to clear the current generated draft?",
    );

    if (!shouldClear) {
      return;
    }

    setDraft("");
    setErrorMessage("");
  }

  if (!isClient) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <p className="text-slate-600">
          Loading your personal statement...
        </p>
      </main>
    );
  }

  if (!hasAnyContent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            No questionnaire answers found
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
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
      <section className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Offer.ai
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Your personal statement draft
          </h1>

          <p className="mt-2 max-w-3xl leading-7 text-slate-600">
            Review and edit this draft carefully. Only include
            information that is accurate and genuinely reflects your
            experience.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {isGenerating ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-6 text-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />

                <h2 className="mt-5 text-xl font-bold text-slate-900">
                  Generating your personal statement
                </h2>

                <p className="mt-2 max-w-md leading-7 text-slate-600">
                  DeepSeek is using your questionnaire answers to
                  create a personalised first draft.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label
                    htmlFor="generatedStatement"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Editable draft
                  </label>

                  <button
                    type="button"
                    onClick={generateStatement}
                    disabled={isGenerating}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Regenerate with AI
                  </button>
                </div>

                {errorMessage && (
                  <div
                    role="alert"
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
                  >
                    <p>{errorMessage}</p>

                    <button
                      type="button"
                      onClick={generateStatement}
                      className="mt-2 font-semibold underline"
                    >
                      Try again
                    </button>
                  </div>
                )}

                <textarea
                  id="generatedStatement"
                  value={draft}
                  onChange={(event) =>
                    setDraft(event.target.value)
                  }
                  rows={22}
                  placeholder="Your generated personal statement will appear here."
                  className="mt-4 w-full resize-y rounded-xl border border-slate-300 px-5 py-4 leading-8 text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />

                <div className="mt-3 flex items-center justify-between gap-4 text-sm text-slate-500">
                  <p>
                    Your edits are saved automatically on this
                    device.
                  </p>

                  <p className="shrink-0">
                    {wordCount} words
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/application/personal-statement"
                      className="rounded-lg border border-slate-300 px-5 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit questionnaire
                    </Link>

                    <button
                      type="button"
                      onClick={handleClearDraft}
                      disabled={!draft.trim()}
                      className="rounded-lg border border-red-200 px-5 py-3 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Clear draft
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!draft.trim()}
                    className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {copied ? "Copied" : "Copy draft"}
                  </button>
                </div>
              </>
            )}
          </section>

          <aside className="space-y-5">
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">
                Optional add-on
              </p>

              <h2 className="mt-2 text-lg font-bold text-slate-900">
                Human expert review
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Get detailed feedback on structure, clarity,
                relevance and writing quality from a human reviewer.
              </p>

              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li>✓ Grammar and clarity review</li>
                <li>✓ Structure and content feedback</li>
                <li>✓ One professionally reviewed version</li>
                <li>✓ Delivery within 3 working days</li>
              </ul>

              <div className="mt-5">
                <p className="text-xs text-slate-500">
                  One-time payment
                </p>

                <p className="text-2xl font-bold text-slate-900">
                  £29.99
                </p>
              </div>

              <Link
                href="/application/personal-statement/human-review"
                className="mt-5 flex w-full justify-center rounded-lg bg-violet-600 px-4 py-3 text-center font-semibold text-white hover:bg-violet-700"
              >
                Request human review
              </Link>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Human review improves presentation but does not
                guarantee admission or an offer.
              </p>
            </div>

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
                Check the course requirements, word limit, grammar
                and every factual claim before using this draft.
              </p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <h2 className="font-semibold text-blue-900">
                AI-generated content
              </h2>

              <p className="mt-2 text-sm leading-6 text-blue-800">
                The AI should only use the information you provided.
                Remove or correct anything that is inaccurate.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}