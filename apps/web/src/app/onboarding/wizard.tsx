"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProgressBar, WizardNavigation, TextInput, Select } from "@offer-ai/ui";
import type { StudentProfile } from "@offer-ai/domain";
import { saveOnboardingStepAction, completeOnboardingAction } from "./actions";
import type { StudentProfile as SP } from "@offer-ai/domain";

const TOTAL_STEPS = 6;

const STUDY_LEVEL_OPTIONS = [
  { value: "foundation", label: "Foundation" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "postgraduate_taught", label: "Postgraduate (taught)" },
  { value: "postgraduate_research", label: "Postgraduate (research)" },
  { value: "phd", label: "PhD" },
];

const ENGLISH_OPTIONS = [
  { value: "not_taken", label: "Not taken yet" },
  { value: "planned", label: "Planned" },
  { value: "taken", label: "Already taken" },
  { value: "exempt", label: "Exempt" },
];

const COUNTRY_OPTIONS = [
  { value: "CN", label: "China" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "IN", label: "India" },
  { value: "PK", label: "Pakistan" },
  { value: "NG", label: "Nigeria" },
  { value: "HK", label: "Hong Kong" },
  { value: "SG", label: "Singapore" },
  { value: "MY", label: "Malaysia" },
  { value: "AE", label: "United Arab Emirates" },
];

const STEP_LABELS = [
  "Basic details",
  "Location",
  "Education",
  "Study intent",
  "Budget",
  "English",
];

export function OnboardingWizard({ initialProfile }: { initialProfile: StudentProfile | null }) {
  const router = useRouter();

  const defaultProfile: SP = {
    userId: "",
    fullName: "",
    email: "",
    currentCountryCode: null,
    nationalityCountryCode: null,
    currentEducationLevel: null,
    intendedStudyLevel: null,
    targetSubjectAreas: [],
    targetEntryYear: null,
    targetCountryCodes: [],
    budgetRange: null,
    englishProficiencyStatus: null,
    onboardingCompletedAt: null,
    updatedAt: new Date(),
  };

  const saved = initialProfile ?? defaultProfile;

  // Resume at the first incomplete step so users can leave and pick up
  // where they stopped (data itself lives in Postgres via server actions).
  const resumeStep = (() => {
    if (!saved.fullName) return 1;
    if (!saved.currentCountryCode || !saved.nationalityCountryCode) return 2;
    if (!saved.currentEducationLevel) return 3;
    if (!saved.intendedStudyLevel) return 4;
    if (!saved.budgetRange) return 5;
    if (!saved.englishProficiencyStatus) return 6;
    return TOTAL_STEPS;
  })();

  const [currentStep, setCurrentStep] = useState(resumeStep);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<SP>(saved);

  function update(field: keyof SP, value: SP[keyof SP]) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function persistStep(step: number, next: number | "done") {
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("step", String(step));
      formData.set("fullName", profile.fullName);
      formData.set("currentCountryCode", profile.currentCountryCode ?? "");
      formData.set("nationalityCountryCode", profile.nationalityCountryCode ?? "");
      formData.set("currentEducationLevel", profile.currentEducationLevel ?? "");
      formData.set("intendedStudyLevel", profile.intendedStudyLevel ?? "");
      formData.set(
        "targetSubjectAreas",
        JSON.stringify(profile.targetSubjectAreas),
      );
      formData.set("targetEntryYear", String(profile.targetEntryYear ?? ""));
      formData.set(
        "targetCountryCodes",
        JSON.stringify(profile.targetCountryCodes),
      );
      formData.set("budgetRange", JSON.stringify(profile.budgetRange));
      formData.set(
        "englishProficiencyStatus",
        profile.englishProficiencyStatus ?? "",
      );

      const result = await saveOnboardingStepAction({}, formData);
      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }

      if (next === "done") {
        await completeOnboardingAction();
        router.push("/dashboard");
        router.refresh();
      } else {
        setCurrentStep(next);
      }
    } catch {
      setError("Unable to save this step. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Offer.ai
          </p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Tell us about yourself</h1>
          <p className="mt-2 text-slate-600">
            Your progress is saved to your account after every step — you can
            leave and resume anytime.
          </p>
        </div>

        <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} labels={STEP_LABELS} />

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (currentStep === TOTAL_STEPS) {
              void persistStep(currentStep, "done");
            } else {
              void persistStep(currentStep, currentStep + 1);
            }
          }}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Basic details</h2>
                <p className="mt-2 text-sm text-slate-600">
                  What should we call you?
                </p>
              </div>
              <TextInput
                id="fullName"
                label="Full name"
                required
                autoComplete="name"
                value={profile.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                placeholder="Alex Li"
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Location</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Where are you now, and where do you hold nationality?
                </p>
              </div>
              <Select
                id="currentCountryCode"
                label="Current country"
                options={COUNTRY_OPTIONS}
                placeholder="Select your current country"
                value={profile.currentCountryCode ?? ""}
                onChange={(event) => update("currentCountryCode", event.target.value || null)}
              />
              <Select
                id="nationalityCountryCode"
                label="Nationality"
                options={COUNTRY_OPTIONS}
                placeholder="Select your nationality"
                value={profile.nationalityCountryCode ?? ""}
                onChange={(event) => update("nationalityCountryCode", event.target.value || null)}
              />
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Current education</h2>
                <p className="mt-2 text-sm text-slate-600">
                  What level of education are you completing now?
                </p>
              </div>
              <TextInput
                id="currentEducationLevel"
                label="Current education level"
                value={profile.currentEducationLevel ?? ""}
                onChange={(event) => update("currentEducationLevel", event.target.value || null)}
                placeholder="For example: High school / Bachelor degree"
              />
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Study intent</h2>
                <p className="mt-2 text-sm text-slate-600">
                  What do you want to study, where and when?
                </p>
              </div>
              <Select
                id="intendedStudyLevel"
                label="Intended study level"
                options={STUDY_LEVEL_OPTIONS}
                placeholder="Select a study level"
                value={profile.intendedStudyLevel ?? ""}
                onChange={(event) => update("intendedStudyLevel", event.target.value || null)}
              />
              <TextInput
                id="targetSubjectAreas"
                label="Target subject areas (comma separated)"
                value={profile.targetSubjectAreas.join(", ")}
                onChange={(event) =>
                  update(
                    "targetSubjectAreas",
                    event.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  )
                }
                placeholder="Computer Science, Data Science"
              />
              <TextInput
                id="targetEntryYear"
                label="Target entry year"
                type="number"
                min={2025}
                max={2035}
                value={profile.targetEntryYear ? String(profile.targetEntryYear) : ""}
                onChange={(event) =>
                  update("targetEntryYear", event.target.value ? Number(event.target.value) : null)
                }
                placeholder="2027"
              />
              <TextInput
                id="targetCountryCodes"
                label="Target countries (comma separated country codes)"
                value={profile.targetCountryCodes.join(", ")}
                onChange={(event) =>
                  update(
                    "targetCountryCodes",
                    event.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
                  )
                }
                placeholder="GB, US"
              />
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Budget</h2>
                <p className="mt-2 text-sm text-slate-600">
                  What is your total study budget (tuition and living costs)?
                </p>
              </div>
              <TextInput
                id="budgetMin"
                label="Budget minimum (GBP)"
                type="number"
                min={0}
                value={
                  profile.budgetRange && profile.budgetRange.min !== null
                    ? String(profile.budgetRange.min)
                    : ""
                }
                onChange={(event) =>
                  update("budgetRange", {
                    currencyCode: "GBP",
                    min: event.target.value ? Number(event.target.value) : null,
                    max: profile.budgetRange?.max ?? null,
                  })
                }
                placeholder="20000"
              />
              <TextInput
                id="budgetMax"
                label="Budget maximum (GBP)"
                type="number"
                min={0}
                value={
                  profile.budgetRange && profile.budgetRange.max !== null
                    ? String(profile.budgetRange.max)
                    : ""
                }
                onChange={(event) =>
                  update("budgetRange", {
                    currencyCode: "GBP",
                    min: profile.budgetRange?.min ?? null,
                    max: event.target.value ? Number(event.target.value) : null,
                  })
                }
                placeholder="40000"
              />
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">English proficiency</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Have you taken an English proficiency test (IELTS, TOEFL…)?
                </p>
              </div>
              <Select
                id="englishProficiencyStatus"
                label="English proficiency status"
                options={ENGLISH_OPTIONS}
                placeholder="Select your status"
                value={profile.englishProficiencyStatus ?? ""}
                onChange={(event) =>
                  update("englishProficiencyStatus", event.target.value || null)
                }
              />
            </div>
          )}

          {error ? (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
            >
              {error}
            </div>
          ) : null}

          <WizardNavigation
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            onBack={() => setCurrentStep((step) => Math.max(1, step - 1))}
            onComplete={() => void persistStep(currentStep, "done")}
            completeLabel="Finish onboarding"
            isSubmitting={saving}
          />
        </form>
      </section>
    </main>
  );
}
