import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

/**
 * Add a meal to the meal plan
 */
export const addMealToPlan = mutation({
  args: {
    userId: v.string(),
    userRecipeId: v.id("userRecipes"),
    dayNumber: v.number(),
    mealType: v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("snack")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if a meal already exists for this slot
    const existing = await ctx.db
      .query("mealPlan")
      .withIndex("by_user_day_mealtype", (q) =>
        q
          .eq("userId", args.userId)
          .eq("dayNumber", args.dayNumber)
          .eq("mealType", args.mealType)
      )
      .first();

    // If exists, update it; otherwise create new
    let result;
    if (existing) {
      await ctx.db.patch(existing._id, {
        userRecipeId: args.userRecipeId,
        updatedAt: now,
      });
      result = existing._id;
    } else {
      const mealPlanId = await ctx.db.insert("mealPlan", {
        userId: args.userId,
        userRecipeId: args.userRecipeId,
        dayNumber: args.dayNumber,
        mealType: args.mealType,
        createdAt: now,
        updatedAt: now,
      });
      result = mealPlanId;
    }

    // Trigger grocery list regeneration
    await ctx.scheduler.runAfter(2000, api.groceries.triggerGroceryListRegeneration, {
      userId: args.userId,
    });

    return result;
  },
});

/**
 * Remove a meal from the meal plan
 */
export const removeMealFromPlan = mutation({
  args: {
    mealPlanId: v.id("mealPlan"),
  },
  handler: async (ctx, args) => {
    // Get the meal plan entry to get userId before deleting
    const mealPlan = await ctx.db.get(args.mealPlanId);
    if (!mealPlan) {
      throw new Error("Meal plan entry not found");
    }

    await ctx.db.delete(args.mealPlanId);

    // Trigger grocery list regeneration
    await ctx.scheduler.runAfter(2000, api.groceries.triggerGroceryListRegeneration, {
      userId: mealPlan.userId,
    });
  },
});

/**
 * Get all meal plan entries for a user with recipe details
 */
export const getMealPlanByUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch all meal plan entries for this user
    const mealPlanEntries = await ctx.db
      .query("mealPlan")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Fetch recipe details for each entry
    const mealPlanWithRecipes = await Promise.all(
      mealPlanEntries.map(async (entry) => {
        const recipe = await ctx.db.get(entry.userRecipeId);
        return {
          ...entry,
          recipe,
        };
      })
    );

    // Filter out any entries where recipe was deleted
    return mealPlanWithRecipes.filter((entry) => entry.recipe !== null);
  },
});

/**
 * Get meal plan for a specific day
 */
export const getMealPlanByDay = query({
  args: {
    userId: v.string(),
    dayNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const mealPlanEntries = await ctx.db
      .query("mealPlan")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", args.userId).eq("dayNumber", args.dayNumber)
      )
      .collect();

    // Fetch recipe details
    const mealPlanWithRecipes = await Promise.all(
      mealPlanEntries.map(async (entry) => {
        const recipe = await ctx.db.get(entry.userRecipeId);
        return {
          ...entry,
          recipe,
        };
      })
    );

    return mealPlanWithRecipes.filter((entry) => entry.recipe !== null);
  },
});

/**
 * Clear entire meal plan for a user
 */
export const clearMealPlan = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const allEntries = await ctx.db
      .query("mealPlan")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    await Promise.all(allEntries.map((entry) => ctx.db.delete(entry._id)));
  },
});

/**
 * Remove a day and shift all subsequent days down
 */
export const removeDayAndShiftDown = mutation({
  args: {
    userId: v.string(),
    dayNumber: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Delete all meals for the specified day
    const mealsToDelete = await ctx.db
      .query("mealPlan")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", args.userId).eq("dayNumber", args.dayNumber)
      )
      .collect();

    await Promise.all(mealsToDelete.map((entry) => ctx.db.delete(entry._id)));

    // 2. Fetch all meals for days after the deleted day
    const allUserMeals = await ctx.db
      .query("mealPlan")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const mealsToShift = allUserMeals.filter(
      (entry) => entry.dayNumber > args.dayNumber
    );

    // 3. Shift each meal down by 1 day
    await Promise.all(
      mealsToShift.map((entry) =>
        ctx.db.patch(entry._id, {
          dayNumber: entry.dayNumber - 1,
          updatedAt: Date.now(),
        })
      )
    );

    // Trigger grocery list regeneration
    await ctx.scheduler.runAfter(2000, api.groceries.triggerGroceryListRegeneration, {
      userId: args.userId,
    });

    return { deletedCount: mealsToDelete.length, shiftedCount: mealsToShift.length };
  },
});
