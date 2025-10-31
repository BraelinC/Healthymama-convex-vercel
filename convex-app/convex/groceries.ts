import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

/**
 * Sanitize and fix common JSON errors from AI responses
 */
function sanitizeJSON(jsonString: string): string {
  // Remove any markdown code blocks
  jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '');

  // Fix missing colons after property names
  jsonString = jsonString.replace(/"(\w+)"\s+"/g, '"$1": "');

  // Fix missing quotes around property values (but not numbers)
  jsonString = jsonString.replace(/:\s*([a-zA-Z][a-zA-Z0-9\s]*[a-zA-Z0-9])\s*([,}\]])/g, ': "$1"$2');

  // Fix trailing commas
  jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');

  return jsonString;
}

/**
 * Generate a grocery list from user's meal plan using AI consolidation
 */
export const generateGroceryList = action({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const openRouterKey = process.env.OPEN_ROUTER_API_KEY;
    if (!openRouterKey) {
      throw new Error("OPEN_ROUTER_API_KEY not configured");
    }

    // 1. Fetch user's meal plan via query
    const mealPlanEntries = await ctx.runQuery(
      api.mealPlan.getMealPlanByUser,
      { userId: args.userId }
    );

    if (mealPlanEntries.length === 0) {
      throw new Error("No meal plan found. Add recipes to your meal plan first.");
    }

    // 2. Extract all ingredients from recipes
    const allIngredients: string[] = [];
    const recipeIds: Id<"userRecipes">[] = [];

    for (const entry of mealPlanEntries) {
      if (entry.recipe) {
        recipeIds.push(entry.recipe._id);
        allIngredients.push(...entry.recipe.ingredients);
      }
    }

    if (allIngredients.length === 0) {
      throw new Error("No ingredients found in meal plan recipes.");
    }

    // 3. Call OpenRouter API to consolidate and categorize
    const prompt = `You are a smart grocery list assistant. Consolidate these ingredients into a shopping list.

CRITICAL: Return ONLY valid JSON. No explanations, no markdown, no code blocks.

Rules:
1. Consolidate duplicates (e.g., "2 cups flour" + "1 cup flour" = "3 cups flour")
2. Standardize quantities and units
3. Use ONLY these categories: produce, meat, dairy, bakery, seafood, eggs, vegetables, pantry, other

Required JSON format (copy this structure EXACTLY):
[
  {
    "name": "flour",
    "quantity": "3",
    "unit": "cups",
    "category": "pantry",
    "displayText": "3 cups flour"
  }
]

IMPORTANT: Every property must have a colon (:) and be properly quoted. Check your JSON is valid before responding.

Ingredients:
${allIngredients.map((ing, i) => `${i + 1}. ${ing}`).join("\n")}

Return the JSON array now:`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
        "HTTP-Referer": "https://healthymama.app",
        "X-Title": "HealthyMama Grocery List",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "system",
            content: "You are a JSON-only API. Return valid JSON arrays only. No text, no markdown, no explanations.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1, // Lower temperature for more consistent JSON
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error("No response from AI");
    }

    // 4. Parse AI response with robust error handling
    let consolidatedIngredients;
    try {
      // Extract JSON from response (might be wrapped in markdown code blocks)
      let jsonText = aiResponse.match(/\[[\s\S]*\]/)?.[0];

      if (!jsonText) {
        // Try to find JSON object wrapper
        const objMatch = aiResponse.match(/\{[\s\S]*"ingredients"[\s\S]*\[[\s\S]*\][\s\S]*\}/);
        if (objMatch) {
          const obj = JSON.parse(sanitizeJSON(objMatch[0]));
          jsonText = JSON.stringify(obj.ingredients || obj.items || obj.list);
        } else {
          throw new Error("No JSON array found in AI response");
        }
      }

      // Sanitize and parse
      const sanitized = sanitizeJSON(jsonText);
      consolidatedIngredients = JSON.parse(sanitized);

      // Validate structure
      if (!Array.isArray(consolidatedIngredients)) {
        throw new Error("Response is not an array");
      }

      // Ensure all items have required fields
      consolidatedIngredients = consolidatedIngredients.map((item: any) => ({
        name: item.name || "Unknown",
        quantity: item.quantity || "",
        unit: item.unit || "",
        category: item.category || "other",
        displayText: item.displayText || item.name || "Unknown item",
      }));

    } catch (error) {
      console.error("Failed to parse AI response:", aiResponse);
      console.error("Parse error:", error);

      // Fallback: create basic grocery list without AI
      const fallbackIngredients = allIngredients.map((ing) => ({
        name: ing,
        quantity: "",
        unit: "",
        category: "other",
        displayText: ing,
      }));

      consolidatedIngredients = fallbackIngredients;
      console.log("Using fallback ingredient list");
    }

    // 5. Save to database via mutation
    const listId = await ctx.runMutation(
      api.groceries.saveGroceryList,
      {
        userId: args.userId,
        mealPlanSnapshot: recipeIds,
        consolidatedIngredients,
      }
    );

    return {
      listId,
      consolidatedIngredients,
      recipeCount: recipeIds.length,
      ingredientCount: consolidatedIngredients.length,
    };
  },
});

/**
 * Save a grocery list to the database
 */
export const saveGroceryList = mutation({
  args: {
    userId: v.string(),
    mealPlanSnapshot: v.array(v.id("userRecipes")),
    consolidatedIngredients: v.array(
      v.object({
        name: v.string(),
        quantity: v.optional(v.string()),
        unit: v.optional(v.string()),
        category: v.string(),
        displayText: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const listId = await ctx.db.insert("groceryLists", {
      userId: args.userId,
      mealPlanSnapshot: args.mealPlanSnapshot,
      consolidatedIngredients: args.consolidatedIngredients,
      checkedItems: [], // Start with no items checked
      createdAt: now,
      updatedAt: now,
    });

    return listId;
  },
});

/**
 * Get the latest grocery list for a user
 */
export const getLatestGroceryList = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const lists = await ctx.db
      .query("groceryLists")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(1);

    return lists[0] || null;
  },
});

/**
 * Get all grocery lists for a user (for history)
 */
export const getAllGroceryLists = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("groceryLists")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

/**
 * Toggle a checkbox for an ingredient
 */
export const toggleCheckedItem = mutation({
  args: {
    listId: v.id("groceryLists"),
    ingredientName: v.string(),
  },
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.listId);
    if (!list) {
      throw new Error("Grocery list not found");
    }

    const checkedItems = [...list.checkedItems];
    const index = checkedItems.indexOf(args.ingredientName);

    if (index >= 0) {
      // Uncheck: remove from array
      checkedItems.splice(index, 1);
    } else {
      // Check: add to array
      checkedItems.push(args.ingredientName);
    }

    await ctx.db.patch(args.listId, {
      checkedItems,
      updatedAt: Date.now(),
    });

    return { checkedItems };
  },
});

/**
 * Delete a grocery list
 */
export const deleteGroceryList = mutation({
  args: {
    listId: v.id("groceryLists"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.listId);
  },
});

/**
 * Update Instacart URL for a grocery list
 */
export const updateInstacartUrl = mutation({
  args: {
    listId: v.id("groceryLists"),
    instacartUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.listId, {
      instacartUrl: args.instacartUrl,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Trigger grocery list regeneration (called by meal plan mutations)
 * This schedules the generation to happen asynchronously
 */
export const triggerGroceryListRegeneration = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Schedule the generation action to run after 2 seconds
    // This debounces multiple rapid changes
    await ctx.scheduler.runAfter(2000, api.groceries.generateGroceryList, {
      userId: args.userId,
    });
  },
});

// ========== INSTACART API INTEGRATION ==========

/**
 * Instacart-supported units (from official API docs)
 * https://docs.instacart.com/developer_platform_api/api/units_of_measurement/
 */
const ALL_VALID_UNITS = [
  // Volume
  'cup', 'cups', 'c', 'fl oz', 'can', 'container', 'jar', 'pouch', 'ounce',
  'gallon', 'gallons', 'gal', 'gals', 'milliliter', 'millilitre', 'milliliters',
  'millilitres', 'ml', 'mls', 'liter', 'litre', 'liters', 'litres', 'l',
  'pint', 'pints', 'pt', 'pts', 'quart', 'quarts', 'qt', 'qts',
  'tablespoon', 'tablespoons', 'tb', 'tbs', 'teaspoon', 'teaspoons', 'ts', 'tsp', 'tspn',
  // Weight
  'gram', 'grams', 'g', 'gs', 'kilogram', 'kilograms', 'kg', 'kgs', 'lb', 'bag',
  'per lb', 'ounce', 'ounces', 'oz', 'pound', 'pounds', 'lbs',
  // Count
  'bunch', 'bunches', 'cans', 'each', 'ears', 'head', 'heads',
  'large', 'lrg', 'lge', 'lg', 'medium', 'med', 'md',
  'package', 'packages', 'packet', 'small', 'sm', 'small ears',
  'small head', 'small heads',
];

const UNIT_ALIASES: Record<string, string> = {
  'tbsp': 'tablespoon', 'tbsps': 'tablespoons', 'T': 'tablespoon', 'Tbsp': 'tablespoon',
  'tsps': 'teaspoons', 't': 'teaspoon', 'Tsp': 'teaspoon',
  'Cup': 'cup', 'Cups': 'cups', 'oz.': 'oz', 'Oz': 'oz', 'ozs': 'ounces',
  'Lb': 'lb', 'Lbs': 'lbs', 'LB': 'lb', 'LBS': 'lbs', 'Pound': 'pound',
  'G': 'g', 'Gram': 'gram', 'Grams': 'grams',
  'Kg': 'kg', 'KG': 'kg', 'Kilogram': 'kilogram', 'Kilograms': 'kilograms',
  'L': 'l', 'Liter': 'liter', 'Liters': 'liters', 'Litre': 'litre', 'Litres': 'litres',
  'ML': 'ml', 'Ml': 'ml', 'Milliliter': 'milliliter', 'Milliliters': 'milliliters',
  'Gal': 'gal', 'Gallon': 'gallon', 'Gallons': 'gallons',
  'Pint': 'pint', 'Pints': 'pints', 'Quart': 'quart', 'Quarts': 'quarts',
  'piece': 'each', 'pieces': 'each', 'whole': 'each', 'item': 'each', 'items': 'each',
  'bottle': 'container', 'bottles': 'container', 'box': 'container', 'boxes': 'container',
  'carton': 'container', 'cartons': 'container',
};

/**
 * Normalize unit to Instacart-supported format
 */
function normalizeUnit(unit: string | undefined): string {
  if (!unit || unit.trim() === '') return 'each';

  const trimmed = unit.trim();

  // Already valid?
  if (ALL_VALID_UNITS.includes(trimmed)) return trimmed;

  // Check aliases
  if (UNIT_ALIASES[trimmed]) return UNIT_ALIASES[trimmed];
  if (UNIT_ALIASES[trimmed.toLowerCase()]) return UNIT_ALIASES[trimmed.toLowerCase()];

  // Case-insensitive match
  for (const validUnit of ALL_VALID_UNITS) {
    if (trimmed.toLowerCase() === validUnit.toLowerCase()) return validUnit;
  }

  console.warn(`Unknown unit "${unit}", defaulting to "each"`);
  return 'each';
}

/**
 * Parse quantity string (handles fractions like "1/2")
 */
function parseQuantity(quantity: string | undefined): number {
  if (!quantity || quantity.trim() === '') return 1;

  const trimmed = quantity.trim();

  // Handle fractions
  if (trimmed.includes('/')) {
    const [numerator, denominator] = trimmed.split('/').map(Number);
    if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }

  const num = parseFloat(trimmed);
  return (!isNaN(num) && num > 0) ? num : 1;
}

/**
 * Create Instacart shopping list via official API
 * Runs in Convex action where INSTACART_API_KEY environment variable is accessible
 */
export const createInstacartShoppingList = action({
  args: {
    ingredients: v.array(
      v.object({
        name: v.string(),
        quantity: v.optional(v.string()),
        unit: v.optional(v.string()),
        displayText: v.string(),
        category: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    try {
      const apiKey = process.env.INSTACART_API_KEY;

      if (!apiKey) {
        console.warn("[INSTACART] INSTACART_API_KEY not configured in Convex environment");
        return generateFallbackUrl(args.ingredients);
      }

      // Prepare ingredients with measurements array (Instacart recipe format)
      const ingredients = args.ingredients.map(ing => ({
        name: ing.name,
        display_text: ing.displayText,
        measurements: [{
          quantity: parseQuantity(ing.quantity),
          unit: normalizeUnit(ing.unit),
        }],
      }));

      console.log(`[INSTACART] Creating recipe page with ${ingredients.length} items`);

      // Call Instacart Developer Platform API (recipe endpoint)
      const response = await fetch("https://connect.dev.instacart.tools/idp/v1/products/recipe", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Your Meal Plan Grocery List",
          imageUrl: "",
          link_type: "recipe",
          instructions: ["Shop for these ingredients for your meal plan."],
          ingredients: ingredients,
          landing_page_configuration: {
            partner_linkback_url: "https://healthymama.app",
            enable_pantry_items: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[INSTACART] API error (${response.status}):`, errorText);

        if (response.status === 429) {
          console.warn("[INSTACART] Rate limited by API");
        }

        return generateFallbackUrl(args.ingredients);
      }

      const data = await response.json();
      // Recipe endpoint returns "products_link_url" or "recipe_url"
      const instacartUrl = data.products_link_url || data.recipe_url;

      if (instacartUrl) {
        console.log(`[INSTACART] Successfully created recipe page: ${instacartUrl}`);
        return instacartUrl;
      }

      return generateFallbackUrl(args.ingredients);
    } catch (error) {
      console.error("[INSTACART] Failed to create shopping list:", error);
      return generateFallbackUrl(args.ingredients);
    }
  },
});

/**
 * Fallback: Generate simple Instacart search URL
 */
function generateFallbackUrl(ingredients: Array<{ displayText: string }>): string {
  const items = ingredients.map((ing) => ing.displayText).join(", ");
  const encodedItems = encodeURIComponent(items);
  return `https://www.instacart.com/store/search?query=${encodedItems}`;
}
