"use client";

import { FormEvent, useState } from "react";

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

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

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
    if (currentStep > 1) {
      setCurrentStep((step) => step - 1);
    }
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

        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">
              Step {currentStep} of {totalSteps}
            </span>

            <span className="text-slate-500">
              {Math.round(progress)}% complete
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

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

              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Full name
                </label>

                <input
                  id="fullName"
                  type="text"
                  required
                  value={answers.fullName}
                  onChange={(event) =>
                    updateAnswer("fullName", event.target.value)
                  }
                  placeholder="Alex Li"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="course"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Intended course
                </label>

                <input
                  id="course"
                  type="text"
                  required
                  value={answers.course}
                  onChange={(event) =>
                    updateAnswer("course", event.target.value)
                  }
                  placeholder="For example: MSc Computer Science"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="university"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Target university
                </label>

                <input
                  id="university"
                  type="text"
                  required
                  value={answers.university}
                  onChange={(event) =>
                    updateAnswer("university", event.target.value)
                  }
                  placeholder="For example: University of Birmingham"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600"
                />
              </div>
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

              <div>
                <label
                  htmlFor="motivation"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Why do you want to study this course?
                </label>

                <textarea
                  id="motivation"
                  required
                  rows={6}
                  value={answers.motivation}
                  onChange={(event) =>
                    updateAnswer("motivation", event.target.value)
                  }
                  placeholder="Describe what interests you about the subject..."
                  className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="experience"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Relevant experience
                </label>

                <textarea
                  id="experience"
                  required
                  rows={6}
                  value={answers.experience}
                  onChange={(event) =>
                    updateAnswer("experience", event.target.value)
                  }
                  placeholder="Include projects, work experience, volunteering or achievements..."
                  className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Career goals
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  Explain what you hope to do after completing the course.
                </p>
              </div>

              <div>
                <label
                  htmlFor="careerGoals"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  What are your future career goals?
                </label>

                <textarea
                  id="careerGoals"
                  required
                  rows={7}
                  value={answers.careerGoals}
                  onChange={(event) =>
                    updateAnswer("careerGoals", event.target.value)
                  }
                  placeholder="Describe the career or impact you want to pursue..."
                  className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600"
                />
              </div>

              <div className="rounded-xl bg-slate-50 p-5">
                <h3 className="font-semibold text-slate-900">
                  Your application
                </h3>

                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="font-medium text-slate-700">Applicant</dt>
                    <dd className="text-slate-600">{answers.fullName}</dd>
                  </div>

                  <div>
                    <dt className="font-medium text-slate-700">Course</dt>
                    <dd className="text-slate-600">{answers.course}</dd>
                  </div>

                  <div>
                    <dt className="font-medium text-slate-700">University</dt>
                    <dd className="text-slate-600">{answers.university}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>

            {currentStep < totalSteps ? (
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  alert(
                    "Your answers are ready. AI generation will be added next.",
                  )
                }
                className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Review answers
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}