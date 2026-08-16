import type { ReactNode } from "react";
import { Button } from "./button";

export interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onComplete?: () => void;
  completeLabel?: string;
  nextLabel?: string;
  isSubmitting?: boolean;
}

export function WizardNavigation({
  currentStep,
  totalSteps,
  onBack,
  onComplete,
  completeLabel = "Confirm",
  nextLabel = "Continue",
  isSubmitting = false,
}: WizardNavigationProps) {
  const isFinalStep = currentStep === totalSteps;

  return (
    <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
      <Button variant="secondary" onClick={onBack} disabled={currentStep === 1}>
        Back
      </Button>

      {isFinalStep ? (
        <Button onClick={onComplete} disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : completeLabel}
        </Button>
      ) : (
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : nextLabel}
        </Button>
      )}
    </div>
  );
}

export interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-8 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export type { ReactNode };
