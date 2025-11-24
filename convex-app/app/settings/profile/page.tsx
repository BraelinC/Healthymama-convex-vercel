"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import step components
import { NameStep } from "@/components/onboarding/steps/NameStep";
import { FamilySizeStep } from "@/components/onboarding/steps/FamilySizeStep";
import { AllergensStep } from "@/components/onboarding/steps/AllergensStep";
import { DietaryPreferencesStep } from "@/components/onboarding/steps/DietaryPreferencesStep";
import { CookingSkillStep } from "@/components/onboarding/steps/CookingSkillStep";
import { CuisinesStep } from "@/components/onboarding/steps/CuisinesStep";
import { EquipmentStep } from "@/components/onboarding/steps/EquipmentStep";
import { ServingsStep } from "@/components/onboarding/steps/ServingsStep";

interface ProfileFormData {
  name?: string;
  familySize?: number;
  allergens: string[];
  dietaryPreferences: string[];
  cookingSkillLevel?: "beginner" | "intermediate" | "advanced";
  preferredCuisines?: string[];
  kitchenEquipment?: string[];
  defaultServings?: number;
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const userId = user?.id || "";

  // Fetch current profile
  const profile = useQuery(api.userProfile.getUserProfile, userId ? { userId } : "skip");

  // Mutation to update profile
  const upsertProfile = useMutation(api.userProfile.upsertUserProfile);

  const [formData, setFormData] = useState<ProfileFormData>({
    name: "",
    familySize: undefined,
    allergens: [],
    dietaryPreferences: [],
    cookingSkillLevel: undefined,
    preferredCuisines: [],
    kitchenEquipment: [],
    defaultServings: undefined,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load profile data when available
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        familySize: profile.familySize,
        allergens: profile.allergens || [],
        dietaryPreferences: profile.dietaryPreferences || [],
        cookingSkillLevel: profile.cookingSkillLevel,
        preferredCuisines: profile.preferredCuisines || [],
        kitchenEquipment: profile.kitchenEquipment || [],
        defaultServings: profile.defaultServings,
      });
    }
  }, [profile]);

  const updateFormData = (field: keyof ProfileFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false); // Reset success message when user makes changes
  };

  const handleSave = async () => {
    if (!userId) return;

    setIsSaving(true);
    try {
      await upsertProfile({
        userId,
        name: formData.name || undefined,
        familySize: formData.familySize,
        allergens: formData.allergens,
        dietaryPreferences: formData.dietaryPreferences,
        cookingSkillLevel: formData.cookingSkillLevel,
        preferredCuisines: formData.preferredCuisines,
        kitchenEquipment: formData.kitchenEquipment,
        defaultServings: formData.defaultServings,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); // Hide success message after 3 seconds
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-healthymama-red" />
      </div>
    );
  }

  if (!user) {
    router.push("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-8">
      <div className="container max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="hover:bg-pink-50"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Profile Settings</h1>
            <p className="text-muted-foreground mt-1">
              Update your preferences to get better personalized recommendations
            </p>
          </div>
        </div>

        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle>Your Preferences</CardTitle>
            <CardDescription>
              Edit your profile information and dietary preferences below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="dietary">Dietary</TabsTrigger>
                <TabsTrigger value="preferences">Preferences</TabsTrigger>
                <TabsTrigger value="equipment">Equipment</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6 mt-6">
                <NameStep value={formData.name} onChange={updateFormData} />
                <div className="border-t pt-6">
                  <FamilySizeStep value={formData.familySize} onChange={updateFormData} />
                </div>
                <div className="border-t pt-6">
                  <ServingsStep value={formData.defaultServings} onChange={updateFormData} />
                </div>
              </TabsContent>

              <TabsContent value="dietary" className="space-y-6 mt-6">
                <AllergensStep value={formData.allergens} onChange={updateFormData} />
                <div className="border-t pt-6">
                  <DietaryPreferencesStep
                    value={formData.dietaryPreferences}
                    onChange={updateFormData}
                  />
                </div>
              </TabsContent>

              <TabsContent value="preferences" className="space-y-6 mt-6">
                <CookingSkillStep
                  value={formData.cookingSkillLevel}
                  onChange={updateFormData}
                />
                <div className="border-t pt-6">
                  <CuisinesStep
                    value={formData.preferredCuisines}
                    onChange={updateFormData}
                  />
                </div>
              </TabsContent>

              <TabsContent value="equipment" className="space-y-6 mt-6">
                <EquipmentStep
                  value={formData.kitchenEquipment}
                  onChange={updateFormData}
                />
              </TabsContent>
            </Tabs>

            {/* Save Button */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              {saveSuccess && (
                <p className="text-sm text-green-600 font-medium">
                  Profile updated successfully!
                </p>
              )}
              <div className="ml-auto">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-healthymama-logo-pink hover:bg-[#D81B60]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
