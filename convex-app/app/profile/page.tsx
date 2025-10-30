"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChefHat, Save, Plus, X, User, Utensils, Globe, Sparkles } from "lucide-react";

const commonDietaryRestrictions = [
  'Milk', 'Eggs', 'Fish', 'Shellfish', 'Tree Nuts',
  'Peanuts', 'Wheat', 'Soy', 'Sesame'
];

const additionalDietaryOptions = [
  'Vegetarian', 'Vegan', 'Keto', 'Paleo',
  'Gluten-Free', 'Dairy-Free', 'Low Carb', 'Low Sodium',
  'Sugar-Free', 'No Seed Oils', 'Kosher', 'Halal', 'FODMAP'
];

const primaryGoalOptions = [
  'Save Money', 'Meal Prep', 'Gain Muscle', 'Lose Weight',
  'Eat Healthier', 'Energy & Performance', 'Digestive Health'
];

const cuisineOptions = [
  'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian',
  'Thai', 'French', 'Mediterranean', 'American', 'Korean',
  'Vietnamese', 'Greek', 'Spanish', 'Middle Eastern'
];

const foodPreferenceOptions = [
  'Comfort Food', 'Spicy Lover', 'Sweet Tooth', 'Savory Seeker',
  'Loves Italian', 'Enjoys Asian', 'Mediterranean', 'Tex-Mex Fan',
  'Vegetable Focused', 'Protein Packed', 'Quick & Easy', 'Adventurous Eater'
];

const dietarySelectedClass =
  "bg-gradient-to-r from-rose-400 via-red-400 to-rose-500 text-white border-none shadow-lg shadow-rose-200 hover:from-rose-500 hover:to-red-500";
const dietaryUnselectedClass =
  "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 hover:text-rose-700";
const preferenceSelectedClass =
  "bg-gradient-to-r from-purple-500 via-emerald-500 to-purple-600 text-white border-none shadow-md hover:from-purple-600 hover:to-emerald-600";
const preferenceUnselectedClass =
  "bg-white text-purple-600 border border-purple-200 hover:bg-purple-50 hover:text-purple-700";
const cuisineSelectedClass =
  "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white border-none shadow-md hover:from-emerald-600 hover:to-teal-600";
const cuisineUnselectedClass =
  "bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const userId = user?.id || "";

  const profile = useQuery(
    api.users.getUserProfile,
    userId ? { userId } : undefined
  );

  const updateProfile = useMutation(api.users.createOrUpdateUser);

  const [profileName, setProfileName] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [culturalBackground, setCulturalBackground] = useState<string[]>([]);
  const [customRestriction, setCustomRestriction] = useState("");
  const [customPreference, setCustomPreference] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Load profile data when available
  useEffect(() => {
    if (profile?.prefs) {
      setProfileName(profile.prefs.profileName || "");
      setPrimaryGoal(
        profile.prefs.primaryGoal ||
          (profile.prefs.goals && profile.prefs.goals[0]) ||
          ""
      );
      setDietaryRestrictions(profile.prefs.dietaryRestrictions || []);
      setPreferences(profile.prefs.preferences || []);
      setCulturalBackground(profile.prefs.culturalBackground || []);
    }
  }, [profile]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSave = async () => {
    if (!userId || !user?.emailAddresses[0]?.emailAddress) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      await updateProfile({
        userId,
        email: user.emailAddresses[0].emailAddress,
        prefs: {
          diet: profile?.prefs?.diet,
          favorites: profile?.prefs?.favorites || [],
          profileName,
          primaryGoal,
          dietaryRestrictions,
          goals: primaryGoal ? [primaryGoal] : [],
          preferences,
          culturalBackground,
        },
      });

      setSaveSuccess(true);
      setToast({ type: "success", message: "Profile saved successfully!" });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save profile:", error);
      setToast({ type: "error", message: "We couldn't save your profile. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const toggleDietaryRestriction = (restriction: string) => {
    setDietaryRestrictions(prev =>
      prev.includes(restriction)
        ? prev.filter(r => r !== restriction)
        : [...prev, restriction]
    );
  };

  const addCustomRestriction = () => {
    if (customRestriction.trim() && !dietaryRestrictions.includes(customRestriction.trim())) {
      setDietaryRestrictions([...dietaryRestrictions, customRestriction.trim()]);
      setCustomRestriction("");
    }
  };

  const togglePreference = (preference: string) => {
    setPreferences(prev =>
      prev.includes(preference)
        ? prev.filter(p => p !== preference)
        : [...prev, preference]
    );
  };

  const addCustomPreference = () => {
    if (customPreference.trim() && !preferences.includes(customPreference.trim())) {
      setPreferences([...preferences, customPreference.trim()]);
      setCustomPreference("");
    }
  };

  const toggleCuisine = (cuisine: string) => {
    setCulturalBackground(prev =>
      prev.includes(cuisine)
        ? prev.filter(c => c !== cuisine)
        : [...prev, cuisine]
    );
  };

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-emerald-50">
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg transition-all duration-300 ${
            toast.type === "success"
              ? "bg-emerald-500/90 backdrop-blur-sm"
              : "bg-red-500/90 backdrop-blur-sm"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}
      <div className="container mx-auto p-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-r from-purple-500 to-emerald-500 p-3 rounded-full">
              <ChefHat className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-emerald-600 bg-clip-text text-transparent">
                Your Profile
              </h1>
              <p className="text-gray-600 mt-1">
                Personalize your meal planning experience
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <Card className="rounded-3xl border border-purple-100/70 bg-gradient-to-br from-white via-purple-50/80 to-emerald-50/80 shadow-2xl shadow-purple-200/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-purple-600">
                <User className="h-5 w-5 text-purple-500" />
                Basic Information
              </CardTitle>
              <p className="text-sm text-purple-500/80">
                Set a friendly profile name and choose the goal you want Healthy Mama to prioritize.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="profileName" className="text-sm font-semibold text-purple-600">
                  Profile Name
                </Label>
                <Input
                  id="profileName"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g., My Profile"
                  className="mt-2 h-12 rounded-xl border border-purple-200 bg-white/90 px-4 text-purple-700 placeholder:text-purple-300 focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                />
              </div>
              <div>
                <Label htmlFor="primaryGoal" className="text-sm font-semibold text-purple-600">
                  Main Goal
                </Label>
                <Select value={primaryGoal} onValueChange={(value) => setPrimaryGoal(value)}>
                  <SelectTrigger className="mt-2 h-12 rounded-xl border border-purple-200 bg-white/90 px-4 text-purple-700 hover:bg-purple-50/40 focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white">
                    <SelectValue placeholder="Select your main goal" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-purple-100 bg-white text-purple-700 shadow-xl">
                    {primaryGoalOptions.map(goal => (
                      <SelectItem
                        key={goal}
                        value={goal}
                        className="rounded-lg text-purple-700 focus:bg-purple-50 focus:text-purple-900"
                      >
                        {goal}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Dietary Restrictions */}
          <Card className="bg-white border border-rose-100 shadow-xl shadow-rose-100/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-600">
                <Utensils className="h-5 w-5 text-rose-500" />
                Dietary Restrictions
                <span className="text-xs text-rose-400 font-normal">(100% compliance)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Common Allergies:</div>
                <div className="flex flex-wrap gap-2">
                  {commonDietaryRestrictions.map(restriction => (
                    <Button
                      key={restriction}
                      onClick={() => toggleDietaryRestriction(restriction)}
                      variant="outline"
                      size="sm"
                      className={`text-xs transition-all ${
                        dietaryRestrictions.includes(restriction)
                          ? dietarySelectedClass
                          : dietaryUnselectedClass
                      }`}
                    >
                      {restriction}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Diet Types & Preferences:</div>
                <div className="flex flex-wrap gap-2">
                  {additionalDietaryOptions.map(restriction => (
                    <Button
                      key={restriction}
                      onClick={() => toggleDietaryRestriction(restriction)}
                      variant="outline"
                      size="sm"
                      className={`text-xs transition-all ${
                        dietaryRestrictions.includes(restriction)
                          ? dietarySelectedClass
                          : dietaryUnselectedClass
                      }`}
                    >
                      {restriction}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  value={customRestriction}
                  onChange={(e) => setCustomRestriction(e.target.value)}
                  placeholder="Add custom dietary restriction..."
                  className="flex-1 bg-white border border-rose-200 text-slate-800 placeholder:text-rose-300 focus-visible:ring-rose-300"
                  onKeyPress={(e) => e.key === 'Enter' && addCustomRestriction()}
                />
                <Button
                  onClick={addCustomRestriction}
                  size="sm"
                  className="bg-gradient-to-r from-rose-400 to-rose-500 text-white shadow-md hover:from-rose-500 hover:to-rose-600"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {dietaryRestrictions.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-sm font-medium text-red-700 mb-2">
                    Your Dietary Restrictions ({dietaryRestrictions.length}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dietaryRestrictions.map((restriction) => (
                      <Badge
                        key={restriction}
                        className="flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 px-3 py-1"
                      >
                        {restriction}
                        <button
                          onClick={() => toggleDietaryRestriction(restriction)}
                          className="ml-1 text-red-500 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Food Preferences */}
          <Card className="bg-white border border-purple-100 shadow-xl shadow-purple-100/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-600">
                <Sparkles className="h-5 w-5 text-purple-500" />
                Food Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {foodPreferenceOptions.map((preference) => (
                  <Button
                    key={preference}
                    onClick={() => togglePreference(preference)}
                    variant="outline"
                    size="sm"
                    className={`text-xs transition-all ${
                      preferences.includes(preference)
                        ? preferenceSelectedClass
                        : preferenceUnselectedClass
                    }`}
                  >
                    {preference}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={customPreference}
                  onChange={(e) => setCustomPreference(e.target.value)}
                  placeholder="Add custom preference (e.g., Loves brunch)..."
                  className="flex-1 bg-white border border-purple-200 text-slate-800 placeholder:text-purple-200 focus-visible:ring-purple-300"
                  onKeyPress={(e) => e.key === "Enter" && addCustomPreference()}
                />
                <Button
                  onClick={addCustomPreference}
                  size="sm"
                  className="bg-gradient-to-r from-purple-500 to-emerald-500 text-white shadow-md hover:from-purple-600 hover:to-emerald-600"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {preferences.length > 0 && (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-sm font-medium text-purple-700 mb-2">
                    Favorite Food Vibes ({preferences.length}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {preferences.map((preference) => (
                      <Badge
                        key={preference}
                        className="flex items-center gap-1 bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1"
                      >
                        {preference}
                        <button
                          onClick={() => togglePreference(preference)}
                          className="ml-1 text-purple-500 hover:text-purple-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cultural Preferences */}
          <Card className="bg-white border border-emerald-100 shadow-xl shadow-emerald-100/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-600">
                <Globe className="h-5 w-5 text-emerald-500" />
                Cultural Cuisine Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {cuisineOptions.map(cuisine => (
                  <Button
                    key={cuisine}
                    onClick={() => toggleCuisine(cuisine)}
                    variant="outline"
                    size="sm"
                    className={`text-xs transition-all ${
                      culturalBackground.includes(cuisine)
                        ? cuisineSelectedClass
                        : cuisineUnselectedClass
                    }`}
                  >
                    {cuisine}
                  </Button>
                ))}
              </div>

              {culturalBackground.length > 0 && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="text-sm font-medium text-emerald-700 mb-2">
                    Selected Cuisines ({culturalBackground.length}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {culturalBackground.map((cuisine) => (
                      <Badge
                        key={cuisine}
                        className="flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1"
                      >
                        {cuisine}
                        <button
                          onClick={() => toggleCuisine(cuisine)}
                          className="ml-1 text-emerald-500 hover:text-emerald-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className={`text-white border-0 transition-all duration-300 ${
                saveSuccess
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                  : 'bg-gradient-to-r from-purple-500 to-emerald-500 hover:from-purple-600 hover:to-emerald-600'
              }`}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Profile'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

