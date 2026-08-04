"use client";

import {
  FormEvent,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import ProgressBar from "@/components/application/progress-bar";
import WizardNavigation from "@/components/application/wizard-navigation";

const STORAGE_KEY = "offer-ai-personal-statement-draft";
const TOTAL_STEPS = 4;

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

const initialAnswers: PersonalStatementAnswers = {
  fullName: "",
  course: "",
  university: "",
  motivation: "",
  experience: "",
  careerGoals: "",
};

const emptyDraft: SavedDraft = {
  currentStep: 1,
  answers: initialAnswers,
};

function getInitialDraft(): SavedDraft {
  if (typeof window === "undefined") {
    return emptyDraft;
  }

  try {
    const savedValue = window.localStorage.getItem(STORAGE_KEY);

    if (!savedValue) {
      return emptyDraft;
    }

    const parsedDraft = JSON.parse(savedValue) as Partial<SavedDraft>;

    const savedStep =
      typeof parsedDraft.currentStep === "number" &&
      parsedDraft.currentStep >= 1 &&
      parsedDraft.currentStep <= TOTAL_STEPS
        ? parsedDraft.currentStep
        : 1;

    return {
      currentStep: savedStep,
      answers: {
        ...initialAnswers,
        ...parsedDraft.answers,
      },
    };
  } catch (error) {
    console.error("Unable to load saved draft:", error);
    return emptyDraft;
  }
}

export default function PersonalStatementPage() {
  const router = useRouter();

  const [initialDraft] = useState<SavedDraft>(getInitialDraft);

  const [currentStep, setCurrentStep] = useState(
    initialDraft.currentStep,
  );

  const [answers, setAnswers] =
    useState<PersonalStatementAnswers>(initialDraft.answers);

  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    try {
      const draft: SavedDraft = {
        currentStep,
        answers,
      };

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(draft),
      );
    } catch (error) {
      console.error("Unable to save draft:", error);
    }
  }, [answers, currentStep]);

  function updateAnswer(
    field: keyof PersonalStatementAnswers,
    value: string,
  ) {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [field]: value,
    }));
  }

  function handleNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((step) => step + 1);
    }
  }

  function handleBack() {
    if (isComplete) {
      setIsComplete(false);
      return;
    }

    if (currentStep > 1) {
      setCurrentStep((step) => step - 1);
    }
  }

  function handleComplete() {
    setIsComplete(true);
  }

  function editStep(step: number) {
    setIsComplete(false);
    setCurrentStep(step);
  }

  function handleStartOver() {
    const shouldReset = window.confirm(
      "Are you sure you want to delete this draft and start again?",
    );

    if (!shouldReset) {
      return;
    }

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Unable to delete saved draft:", error);
    }

    setAnswers({ ...initialAnswers });
    setCurrentStep(1);
    setIsComplete(false);
  }

  function handleGenerate() {
    router.push("/application/personal-statement/result");
  }

  if (isComplete) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <section className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-green-200 bg-white p-8 shadow-sm">
            <div className="rounded-xl bg-green-50 p-5">
              <p className="text-sm font-semibold text-green-700">
                Questionnaire complete
              </p>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Your answers are ready
              </h1>

              <p className="mt-2 text-slate-600">
                The next stage will use these answers to generate your
                personal statement.
              </p>
            </div>

            <div className="mt-8 space-y-6">
              <ReviewItem
                label="Applicant"
                value={answers.fullName}
              />

              <ReviewItem
                label="Course"
                value={answers.course}
              />

              <ReviewItem
                label="University"
                value={answers.university}
              />

              <ReviewItem
                label="Motivation"
                value={answers.motivation}
              />

              <ReviewItem
                label="Relevant experience"
                value={answers.experience}
              />

              <ReviewItem
                label="Career goals"
                value={answers.careerGoals}
              />
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Return to review
              </button>

              <button
                type="button"
                onClick={handleGenerate}
                className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Generate personal statement
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                Offer.ai
              </p>

              <h1 className="mt-3 text-3xl font-bold text-slate-900">
                Personal Statement Builder
              </h1>
            </div>

            <button
              type="button"
              onClick={handleStartOver}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              Start over
            </button>
          </div>

          <p className="mt-2 text-slate-600">
            Answer a few guided questions to prepare your first draft.
            Your progress is saved automatically.
          </p>
        </div>

        <ProgressBar
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
        />

        <form
          onSubmit={handleNext}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Application details
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  Tell us what and where you are applying to study.
                </p>
              </div>

              <TextInput
                id="fullName"
                label="Full name"
                value={answers.fullName}
                placeholder="Alex Li"
                autoComplete="name"
                onChange={(value) =>
                  updateAnswer("fullName", value)
                }
              />

              <TextInput
                id="course"
                label="Intended course"
                value={answers.course}
                placeholder="For example: MSc Computer Science"
                onChange={(value) =>
                  updateAnswer("course", value)
                }
              />

              <TextInput
                id="university"
                label="Target university"
                value={answers.university}
                placeholder="For example: University of Birmingham"
                onChange={(value) =>
                  updateAnswer("university", value)
                }
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Motivation and experience
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  Give specific examples wherever possible.
                </p>
              </div>

              <TextArea
                id="motivation"
                label="Why do you want to study this course?"
                value={answers.motivation}
                placeholder="Describe what interests you about the subject..."
                onChange={(value) =>
                  updateAnswer("motivation", value)
                }
              />

              <TextArea
                id="experience"
                label="Relevant experience"
                value={answers.experience}
                placeholder="Include projects, work experience, volunteering or achievements..."
                onChange={(value) =>
                  updateAnswer("experience", value)
                }
              />
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Career goals
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  Explain what you hope to do after completing the
                  course.
                </p>
              </div>

              <TextArea
                id="careerGoals"
                label="What are your future career goals?"
                value={answers.careerGoals}
                placeholder="Describe the career or impact you want to pursue..."
                onChange={(value) =>
                  updateAnswer("careerGoals", value)
                }
              />
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Review your answers
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  Check everything carefully before continuing.
                </p>
              </div>

              <ReviewSection
                title="Application details"
                onEdit={() => editStep(1)}
              >
                <ReviewItem
                  label="Applicant"
                  value={answers.fullName}
                />

                <ReviewItem
                  label="Course"
                  value={answers.course}
                />

                <ReviewItem
                  label="University"
                  value={answers.university}
                />
              </ReviewSection>

              <ReviewSection
                title="Motivation and experience"
                onEdit={() => editStep(2)}
              >
                <ReviewItem
                  label="Motivation"
                  value={answers.motivation}
                />

                <ReviewItem
                  label="Relevant experience"
                  value={answers.experience}
                />
              </ReviewSection>

              <ReviewSection
                title="Career goals"
                onEdit={() => editStep(3)}
              >
                <ReviewItem
                  label="Career goals"
                  value={answers.careerGoals}
                />
              </ReviewSection>
            </div>
          )}

          <WizardNavigation
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            onBack={handleBack}
            onComplete={handleComplete}
          />
        </form>
      </section>
    </main>
  );
}

type TextInputProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  autoComplete?: string;
  onChange: (value: string) => void;
};

function TextInput({
  id,
  label,
  value,
  placeholder,
  autoComplete,
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
        type="text"
        required
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

type TextAreaProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

function TextArea({
  id,
  label,
  value,
  placeholder,
  onChange,
}: TextAreaProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      <textarea
        id={id}
        name={id}
        required
        rows={7}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

type ReviewSectionProps = {
  title: string;
  onEdit: () => void;
  children: ReactNode;
};

function ReviewSection({
  title,
  onEdit,
  children,
}: ReviewSectionProps) {
  return (
    <section className="rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-slate-900">
          {title}
        </h3>

        <button
          type="button"
          onClick={onEdit}
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          Edit
        </button>
      </div>

      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

type ReviewItemProps = {
  label: string;
  value: string;
};

function ReviewItem({
  label,
  value,
}: ReviewItemProps) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">
        {label}
      </p>

      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
        {value || "Not provided"}
      </p>
    </div>
  );
}