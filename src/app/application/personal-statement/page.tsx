"use client";

import { FormEvent, useState } from "react";
import ProgressBar from "@/components/application/progress-bar";
import WizardNavigation from "@/components/application/wizard-navigation";

type PersonalStatementAnswers = {
  fullName: string;
  course: string;
  university: string;
  motivation: string;
  experience: string;
  careerGoals: string;
};

const initialAnswers: PersonalStatementAnswers = {
  fullName: "",
  course: "",
  university: "",
  motivation: "",
  experience: "",
  careerGoals: "",
};

export default function PersonalStatementPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] =
    useState<PersonalStatementAnswers>(initialAnswers);
  const [isComplete, setIsComplete] = useState(false);

  const totalSteps = 4;

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

    if (currentStep < totalSteps) {
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
              <ReviewItem label="Applicant" value={answers.fullName} />
              <ReviewItem label="Course" value={answers.course} />
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
                onClick={() =>
                  alert("AI generation will be added in the next step.")
                }
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
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Offer.ai
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Personal Statement Builder
          </h1>

          <p className="mt-2 text-slate-600">
            Answer a few guided questions to prepare your first draft.
          </p>
        </div>

        <ProgressBar
          currentStep={currentStep}
          totalSteps={totalSteps}
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
                <ReviewItem label="Course" value={answers.course} />
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
            totalSteps={totalSteps}
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
  onChange: (value: string) => void;
};

function TextInput({
  id,
  label,
  value,
  placeholder,
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
        type="text"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600"
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
        required
        rows={7}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600"
      />
    </div>
  );
}

type ReviewSectionProps = {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
};

function ReviewSection({
  title,
  onEdit,
  children,
}: ReviewSectionProps) {
  return (
    <section className="rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>

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

function ReviewItem({ label, value }: ReviewItemProps) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
        {value || "Not provided"}
      </p>
    </div>
  );
}