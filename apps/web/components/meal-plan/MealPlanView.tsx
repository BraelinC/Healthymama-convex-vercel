"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@healthymama/convex";
import { CompactRecipeCard } from "@/components/recipe/CompactRecipeCard";
import { RecipeDetailSheet } from "@/components/recipe/RecipeDetailSheet";
import { MealPlanCookbookSelector } from "./MealPlanCookbookSelector";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MealPlanViewProps {
  userId: string;
}

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

interface DayMeals {
  day: number;
  meals: {
    breakfast: any[];
    lunch: any[];
    dinner: any[];
    snack: any[];
  };
}

export function MealPlanView({ userId }: MealPlanViewProps) {
  const { toast } = useToast();
  const [isRecipeDetailOpen, setIsRecipeDetailOpen] = useState(false);
  const [recipeForDetail, setRecipeForDetail] = useState<any>(null);
  const [isCookbookSelectorOpen, setIsCookbookSelectorOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: number; mealType: string } | null>(null);
  const [maxDays, setMaxDays] = useState(0); // Start empty - user adds days
  const [longPressedCard, setLongPressedCard] = useState<string | null>(null);

  // Fetch meal plan data
  const mealPlanData = useQuery(
    api.mealPlan.getMealPlanByUser,
    userId ? { userId } : "skip"
  );

  // Auto-detect maxDays from existing data
  useEffect(() => {
    if (mealPlanData && mealPlanData.length > 0) {
      const highestDay = Math.max(...mealPlanData.map((entry: any) => entry.dayNumber));
      if (highestDay > maxDays) {
        setMaxDays(highestDay);
      }
    }
  }, [mealPlanData]);

  // Mutations
  const addMealToPlan = useMutation(api.mealPlan.addMealToPlan);
  const removeMealFromPlan = useMutation(api.mealPlan.removeMealFromPlan);
  const removeDayAndShiftDown = useMutation(api.mealPlan.removeDayAndShiftDown);

  const handleRecipeClick = (recipe: any) => {
    setRecipeForDetail(recipe);
    setIsRecipeDetailOpen(true);
  };

  const handleAddMeal = (day: number, mealType: string) => {
    setSelectedSlot({ day, mealType });
    setIsCookbookSelectorOpen(true);
  };

  const handleRecipeSelected = async (recipeId: string) => {
    if (!selectedSlot) return;

    try {
      await addMealToPlan({
        userId,
        userRecipeId: recipeId as any,
        dayNumber: selectedSlot.day,
        mealType: selectedSlot.mealType as any,
      });

      toast({
        title: "Meal added!",
        description: `Added to Day ${selectedSlot.day} ${selectedSlot.mealType}`,
      });
      setIsCookbookSelectorOpen(false);
      setSelectedSlot(null);
    } catch (error) {
      console.error("Error adding meal:", error);
      toast({
        title: "Error",
        description: "Failed to add meal to plan",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMeal = async (mealPlanId: string) => {
    try {
      await removeMealFromPlan({ mealPlanId: mealPlanId as any });
      toast({
        title: "Meal removed",
        description: "Meal removed from plan",
      });
    } catch (error) {
      console.error("Error removing meal:", error);
      toast({
        title: "Error",
        description: "Failed to remove meal",
        variant: "destructive",
      });
    }
  };

  const handleAddDay = () => {
    setMaxDays((prev) => prev + 1);
    toast({
      title: "Day added",
      description: `Day ${maxDays + 1} added to meal plan`,
    });
  };

  const handleRemoveDay = async (dayNumber: number) => {
    try {
      const result = await removeDayAndShiftDown({
        userId,
        dayNumber,
      });

      // Always decrease maxDays when removing a day
      setMaxDays((prev) => Math.max(0, prev - 1));

      toast({
        title: "Day removed",
        description: `Day ${dayNumber} removed${result.shiftedCount > 0 ? ` and ${result.shiftedCount} meals shifted` : ''}`,
      });
    } catch (error) {
      console.error("Error removing day:", error);
      toast({
        title: "Error",
        description: "Failed to remove day",
        variant: "destructive",
      });
    }
  };

  // Long press handlers for mobile
  const handleTouchStart = (mealPlanId: string) => {
    const timeoutId = setTimeout(() => {
      setLongPressedCard(mealPlanId);
    }, 500); // 500ms long press

    // Store timeout ID so we can clear it
    (window as any).longPressTimeout = timeoutId;
  };

  const handleTouchEnd = () => {
    if ((window as any).longPressTimeout) {
      clearTimeout((window as any).longPressTimeout);
    }
  };

  const handleTouchMove = () => {
    // Cancel long press if user moves finger
    if ((window as any).longPressTimeout) {
      clearTimeout((window as any).longPressTimeout);
    }
  };

  // Organize meal plan data by day
  const organizeMealsByDay = (): DayMeals[] => {
    // Create days structure based on maxDays
    const days: DayMeals[] = [];
    for (let i = 1; i <= maxDays; i++) {
      const dayMeals: DayMeals = {
        day: i,
        meals: {
          breakfast: [],
          lunch: [],
          dinner: [],
          snack: [],
        },
      };

      // Find meals for this day if mealPlanData exists
      if (mealPlanData) {
        mealPlanData.forEach((entry: any) => {
          if (entry.dayNumber === i && entry.recipe) {
            const mealEntry = {
              ...entry.recipe,
              mealPlanId: entry._id, // Store mealPlanId for removal
            };
            (dayMeals.meals as any)[entry.mealType].push(mealEntry);
          }
        });
      }

      days.push(dayMeals);
    }

    return days;
  };

  const mealPlanDays = organizeMealsByDay();

  if (!mealPlanData) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading meal plan...
      </div>
    );
  }

  // Show empty state when no days have been added
  if (maxDays === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No meal plan yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
            Click the button below to add your first day
          </p>

          {/* Add Day Button */}
          <button
            onClick={handleAddDay}
            className="border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 rounded-lg p-6 text-center transition-all group w-full max-w-md bg-white"
          >
            <Plus className="w-6 h-6 mx-auto text-gray-400 group-hover:text-purple-500 mb-2" />
            <span className="text-sm text-gray-500 group-hover:text-purple-600">Add Day</span>
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {/* Day Cards */}
        {mealPlanDays.map((dayData) => (
          <div key={dayData.day} className="space-y-4">
            {/* Day Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                  <span className="text-white font-bold text-lg">{dayData.day}</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Day {dayData.day}</h2>
                  <p className="text-sm text-gray-500">
                    {[...dayData.meals.breakfast, ...dayData.meals.lunch, ...dayData.meals.dinner, ...dayData.meals.snack].length} meal{[...dayData.meals.breakfast, ...dayData.meals.lunch, ...dayData.meals.dinner, ...dayData.meals.snack].length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Remove Day Button */}
              <button
                onClick={() => handleRemoveDay(dayData.day)}
                className="w-8 h-8 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                title="Remove this day"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Meal Type Grid - 3 columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Breakfast Column */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    <span className="mr-1">🍳</span> Breakfast
                  </Badge>
                </div>
                {dayData.meals.breakfast.length > 0 ? (
                  dayData.meals.breakfast.map((recipe) => (
                    <div
                      key={recipe.mealPlanId}
                      className="relative group"
                      onTouchStart={() => handleTouchStart(recipe.mealPlanId)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchMove}
                    >
                      <CompactRecipeCard
                        recipe={recipe}
                        onClick={() => {
                          if (longPressedCard === recipe.mealPlanId) {
                            setLongPressedCard(null);
                          } else {
                            handleRecipeClick(recipe);
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMeal(recipe.mealPlanId);
                          setLongPressedCard(null);
                        }}
                        className={`absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-opacity shadow-md z-10 ${
                          longPressedCard === recipe.mealPlanId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))
                ) : (
                  <button
                    onClick={() => handleAddMeal(dayData.day, "breakfast")}
                    className="border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 rounded-lg p-6 text-center transition-all group"
                  >
                    <Plus className="w-6 h-6 mx-auto text-gray-400 group-hover:text-purple-500 mb-2" />
                    <span className="text-sm text-gray-500 group-hover:text-purple-600">Add breakfast</span>
                  </button>
                )}
              </div>

              {/* Lunch Column */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <span className="mr-1">🥗</span> Lunch
                  </Badge>
                </div>
                {dayData.meals.lunch.length > 0 ? (
                  dayData.meals.lunch.map((recipe) => (
                    <div
                      key={recipe.mealPlanId}
                      className="relative group"
                      onTouchStart={() => handleTouchStart(recipe.mealPlanId)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchMove}
                    >
                      <CompactRecipeCard
                        recipe={recipe}
                        onClick={() => {
                          if (longPressedCard === recipe.mealPlanId) {
                            setLongPressedCard(null);
                          } else {
                            handleRecipeClick(recipe);
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMeal(recipe.mealPlanId);
                          setLongPressedCard(null);
                        }}
                        className={`absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-opacity shadow-md z-10 ${
                          longPressedCard === recipe.mealPlanId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))
                ) : (
                  <button
                    onClick={() => handleAddMeal(dayData.day, "lunch")}
                    className="border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 rounded-lg p-6 text-center transition-all group"
                  >
                    <Plus className="w-6 h-6 mx-auto text-gray-400 group-hover:text-purple-500 mb-2" />
                    <span className="text-sm text-gray-500 group-hover:text-purple-600">Add lunch</span>
                  </button>
                )}
              </div>

              {/* Dinner Column */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    <span className="mr-1">🍽️</span> Dinner
                  </Badge>
                </div>
                {dayData.meals.dinner.length > 0 ? (
                  dayData.meals.dinner.map((recipe) => (
                    <div
                      key={recipe.mealPlanId}
                      className="relative group"
                      onTouchStart={() => handleTouchStart(recipe.mealPlanId)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchMove}
                    >
                      <CompactRecipeCard
                        recipe={recipe}
                        onClick={() => {
                          if (longPressedCard === recipe.mealPlanId) {
                            setLongPressedCard(null);
                          } else {
                            handleRecipeClick(recipe);
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMeal(recipe.mealPlanId);
                          setLongPressedCard(null);
                        }}
                        className={`absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-opacity shadow-md z-10 ${
                          longPressedCard === recipe.mealPlanId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))
                ) : (
                  <button
                    onClick={() => handleAddMeal(dayData.day, "dinner")}
                    className="border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 rounded-lg p-6 text-center transition-all group"
                  >
                    <Plus className="w-6 h-6 mx-auto text-gray-400 group-hover:text-purple-500 mb-2" />
                    <span className="text-sm text-gray-500 group-hover:text-purple-600">Add dinner</span>
                  </button>
                )}
              </div>
            </div>

            {/* Snacks - always show multiple add slots */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  <span className="mr-1">🍿</span> Snacks
                </Badge>
                <span className="text-xs text-gray-500">(Click + to add multiple)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Show existing snacks */}
                {dayData.meals.snack.map((recipe) => (
                  <div
                    key={recipe.mealPlanId}
                    className="relative group"
                    onTouchStart={() => handleTouchStart(recipe.mealPlanId)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                  >
                    <CompactRecipeCard
                      recipe={recipe}
                      onClick={() => {
                        if (longPressedCard === recipe.mealPlanId) {
                          setLongPressedCard(null);
                        } else {
                          handleRecipeClick(recipe);
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveMeal(recipe.mealPlanId);
                        setLongPressedCard(null);
                      }}
                      className={`absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-opacity shadow-md z-10 ${
                        longPressedCard === recipe.mealPlanId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                {/* Always show add snack button */}
                <button
                  onClick={() => handleAddMeal(dayData.day, "snack")}
                  className="border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 rounded-lg h-40 flex flex-col items-center justify-center transition-all group"
                >
                  <Plus className="w-6 h-6 text-gray-400 group-hover:text-purple-500 mb-2" />
                  <span className="text-sm text-gray-500 group-hover:text-purple-600">Add snack</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add Day Button - After Days */}
        <button
          onClick={handleAddDay}
          className="border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 rounded-lg p-6 text-center transition-all group bg-white"
        >
          <Plus className="w-6 h-6 mx-auto text-gray-400 group-hover:text-purple-500 mb-2" />
          <span className="text-sm text-gray-500 group-hover:text-purple-600">Add Day</span>
        </button>
      </div>

      {/* Recipe Detail Sheet */}
      {recipeForDetail && (
        <RecipeDetailSheet
          isOpen={isRecipeDetailOpen}
          onClose={() => setIsRecipeDetailOpen(false)}
          recipe={recipeForDetail}
          userId={userId}
          isFavorited={recipeForDetail.isFavorited}
        />
      )}

      {/* Meal Plan Cookbook Selector */}
      {selectedSlot && (
        <MealPlanCookbookSelector
          isOpen={isCookbookSelectorOpen}
          onClose={() => {
            setIsCookbookSelectorOpen(false);
            setSelectedSlot(null);
          }}
          userId={userId}
          dayNumber={selectedSlot.day}
          mealType={selectedSlot.mealType}
          onRecipeSelected={handleRecipeSelected}
        />
      )}
    </>
  );
}
