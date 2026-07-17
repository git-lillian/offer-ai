type WizardNavigationProps = {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onComplete: () => void;
};

export default function WizardNavigation({
  currentStep,
  totalSteps,
  onBack,
  onComplete,
}: WizardNavigationProps) {
  const isFinalStep = currentStep === totalSteps;

  return (
    <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
      <button
        type="button"
        onClick={onBack}
        disabled={currentStep === 1}
        className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Back
      </button>

      {isFinalStep ? (
        <button
          type="button"
          onClick={onComplete}
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Confirm answers
        </button>
      ) : (
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Continue
        </button>
      )}
    </div>
  );
}