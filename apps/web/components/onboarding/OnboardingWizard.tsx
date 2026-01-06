"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@healthymama/convex";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

// Step components
import { AllergensStep } from "./steps/AllergensStep";
import { DietaryPreferencesStep } from "./steps/DietaryPreferencesStep";
import { CuisinesStep } from "./steps/CuisinesStep";
import { GoalsStep } from "./steps/GoalsStep";

const TOTAL_STEPS = 4;

interface OnboardingData {
  country?: string;
  allergens: string[];
  dietaryPreferences: string[];
  preferredCuisines?: string[];
  goal?: string;
}

interface OnboardingWizardProps {
  userId: string;
  userName?: string;
  isOpen: boolean;
  onComplete: () => void;
}

export function OnboardingWizard({
  userId,
  userName,
  isOpen,
  onComplete,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<OnboardingData>({
    country: undefined,
    allergens: [],
    dietaryPreferences: [],
    preferredCuisines: [],
    goal: undefined,
  });

  const upsertProfile = useMutation(api.userProfile.upsertUserProfile);

  const updateFormData = (field: keyof OnboardingData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await upsertProfile({
        userId,
        name: userName,
        country: formData.country,
        allergens: formData.allergens,
        dietaryPreferences: formData.dietaryPreferences,
        preferredCuisines: formData.preferredCuisines,
        goal: formData.goal,
      });
      onComplete();
    } catch (error) {
      console.error("Failed to save onboarding data:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercentage = (currentStep / TOTAL_STEPS) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] bg-gradient-to-br from-pink-50 via-white to-red-50 border-2 border-pink-200 flex flex-col"
        hideCloseButton={true}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="space-y-2">
            <DialogTitle
              className="text-2xl font-bold bg-gradient-to-r from-[#dc2626] to-[#ec4899] bg-clip-text text-transparent"
              style={{
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              Welcome to HealthyMama
            </DialogTitle>
            <p className="text-sm text-gray-600">
              Step {currentStep} of {TOTAL_STEPS} - Let's personalize your
              experience
            </p>
            <Progress
              value={progressPercentage}
              className="h-2 bg-pink-100"
              style={{
                background: 'linear-gradient(to right, #fce7f3, #fce7f3)',
              }}
            />
          </div>
        </DialogHeader>

        <div className="py-6 overflow-y-auto flex-1 px-1">
          {currentStep === 1 && (
            <AllergensStep value={formData.allergens} onChange={updateFormData} />
          )}
          {currentStep === 2 && (
            <DietaryPreferencesStep
              value={formData.dietaryPreferences}
              onChange={updateFormData}
            />
          )}
          {currentStep === 3 && (
            <CuisinesStep
              value={formData.preferredCuisines}
              country={formData.country}
              onChange={updateFormData}
            />
          )}
          {currentStep === 4 && (
            <GoalsStep value={formData.goal} onChange={updateFormData} />
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || isSubmitting}
            className="border-pink-300 text-pink-600 hover:bg-pink-50 disabled:opacity-50"
          >
            Back
          </Button>

          {currentStep < TOTAL_STEPS ? (
            <Button
              onClick={handleNext}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-healthymama-red to-healthymama-logo-pink hover:from-red-700 hover:to-pink-600 text-white"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-healthymama-red to-healthymama-logo-pink hover:from-red-700 hover:to-pink-600 text-white"
            >
              {isSubmitting ? "Completing..." : "Complete Setup"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
