import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { normalizeUnit, parseQuantity } from "../lib/instacart-units";
import { createRecipeViaMCP, createShoppingListViaMCP } from "./lib/instacartMCP";

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
 * Parse ingredients using AI (OpenRouter GPT-4o-mini) into Instacart-compatible format
 */
export async function parseIngredientsWithAI(
  ingredients: string[],
  openRouterKey: string
): Promise<Array<{
  name: string;
  display_text: string;
  measurements: Array<{
    quantity: number;
    unit: string;
  }>;
}>> {
  const supportedUnits = [
    "cup", "cups", "tablespoon", "tablespoons", "tbsp", "teaspoon", "teaspoons", "tsp",
    "ounce", "ounces", "oz", "fluid ounce", "fl oz", "pound", "pounds", "lb", "lbs",
    "gram", "grams", "g", "kilogram", "kg", "liter", "l", "milliliter", "ml",
    "gallon", "pint", "quart", "can", "jar", "package", "bunch", "head", "clove",
    "large", "medium", "small", "each"
  ];

  const prompt = `Extract product name, quantity, and unit from each ingredient. Return valid JSON array.

RULES:
1. Extract the simplest, most searchable product name (1-3 words max)
2. Remove ALL from name: modifiers, brands, preparation words
3. Extract quantity as NUMBER (convert fractions: "1/2"=0.5, "1 1/2"=1.5, "2-3"=2.5)
4. Extract unit (cup, tablespoon, teaspoon, pound, ounce, etc. or "each" as default)

EXAMPLES (study these carefully):
Input: "1 1/2 pounds carrots, peeled"
Output: {"name": "carrots", "quantity": 1.5, "unit": "pound"}

Input: "2 tablespoons olive oil"
Output: {"name": "olive oil", "quantity": 2, "unit": "tablespoon"}

Input: "1 15-ounce can chickpeas, rinsed and very well drained"
Output: {"name": "chickpeas", "quantity": 15, "unit": "ounce"}

Input: "1/2 teaspoon cumin seeds"
Output: {"name": "cumin seeds", "quantity": 0.5, "unit": "teaspoon"}

Input: "1/4 teaspoon (or more) red pepper flakes"
Output: {"name": "red pepper flakes", "quantity": 0.25, "unit": "teaspoon"}

Input: "3 tablespoons tahini"
Output: {"name": "tahini", "quantity": 3, "unit": "tablespoon"}

Input: "2 tablespoons lemon juice"
Output: {"name": "lemon juice", "quantity": 2, "unit": "tablespoon"}

Input: "1 small garlic clove, pressed or minced"
Output: {"name": "garlic", "quantity": 1, "unit": "clove"}

Input: "Salt and freshly ground black pepper to taste"
Output: {"name": "salt and pepper", "quantity": 1, "unit": "each"}

Input: "1/4 cup chopped fresh cilantro or parsley, for serving"
Output: {"name": "cilantro", "quantity": 0.25, "unit": "cup"}

Required JSON format:
[
  {"name": "carrots", "quantity": 1.5, "unit": "pound"},
  {"name": "olive oil", "quantity": 2, "unit": "tablespoon"},
  {"name": "chickpeas", "quantity": 15, "unit": "ounce"}
]

Return ONLY the JSON array. No text, no markdown, no explanations.

Ingredients to parse:
${ingredients.map((ing, i) => `${i + 1}. ${ing}`).join("\n")}

Return the JSON array now:`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
        "HTTP-Referer": "https://healthymama.app",
        "X-Title": "HealthyMama Instacart Ingredient Parser",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-safeguard-20b",
        messages: [
          {
            role: "system",
            content: "You are a JSON-only ingredient parser. Return valid JSON arrays with 'name' (simple product name, 1-3 words), 'quantity' (number), and 'unit' (measurement unit) fields. Extract quantities as numbers (convert fractions). Remove modifiers/brands from names. Use 'each' as default unit.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error("No response from AI");
    }

    // Parse with robust error handling
    let jsonText = aiResponse.match(/\[[\s\S]*\]/)?.[0];

    if (!jsonText) {
      // Try to find JSON in an object wrapper
      const objMatch = aiResponse.match(/\{[\s\S]*"ingredients"[\s\S]*\[[\s\S]*\][\s\S]*\}/);
      if (objMatch) {
        const obj = JSON.parse(sanitizeJSON(objMatch[0]));
        jsonText = JSON.stringify(obj.ingredients || obj.items || obj.list || obj.data);
      } else {
        throw new Error("No JSON array found in AI response");
      }
    }

    const sanitized = sanitizeJSON(jsonText);
    const parsed = JSON.parse(sanitized);

    if (!Array.isArray(parsed)) {
      throw new Error("AI response is not an array");
    }

    // Validate and format for Instacart, with fallback to original
    const formatted = parsed.map((item: any, index: number) => {
      // Extract simple product name (working)
      const name = item.name || ingredients[index] || "Unknown ingredient";

      // Use the same simple name for display (no amounts/units in display)
      const displayText = name;

      // Extract and validate quantity
      let quantity = 1;
      if (typeof item.quantity === 'number' && item.quantity > 0) {
        quantity = item.quantity;
      } else if (item.quantity) {
        const parsed = parseQuantity(String(item.quantity));
        quantity = parsed && parsed > 0 ? parsed : 1;
      }

      // Extract and normalize unit
      const unit = item.unit ? normalizeUnit(item.unit) : "each";

      return {
        name: name,
        display_text: displayText,
        measurements: [{
          quantity: quantity,
          unit: unit,
        }],
      };
    });

    console.log(`[INSTACART] AI extracted ${formatted.length} ingredients:`,
      formatted.slice(0, 3).map(i => `${i.name} (${i.measurements[0].quantity} ${i.measurements[0].unit})`).join(", "));

    return formatted;
  } catch (error: any) {
    console.error("[INSTACART] AI parsing failed:", error.message);
    throw error;
  }
}

/**
 * Parse ingredients using regex fallback (used when AI is unavailable)
 */
function parseIngredientsWithRegex(
  ingredients: string[]
): Array<{
  name: string;
  display_text: string;
  measurements: Array<{
    quantity: number;
    unit: string;
  }>;
}> {
  return ingredients.map(ing => {
    // Extract quantity, unit, and name from ingredient string
    // Examples: "2 cups flour", "1 tablespoon salt", "3 large eggs"
    const match = ing.match(/^([\d./]+)?\s*([a-zA-Z]+)?\s*(.+)$/);

    let quantity = 1;
    let unit = "each";
    let name = ing;

    if (match) {
      const [, qty, maybeUnit, rest] = match;
      if (qty) {
        quantity = parseQuantity(qty) ?? 1;
      }
      // Check if maybeUnit is actually a unit (not part of ingredient name)
      const commonUnits = ["cup", "cups", "tablespoon", "tablespoons", "teaspoon", "teaspoons",
                          "oz", "ounce", "ounces", "lb", "pound", "pounds", "gram", "grams",
                          "kg", "kilogram", "large", "medium", "small", "bunch", "can", "jar"];
      if (maybeUnit && commonUnits.includes(maybeUnit.toLowerCase())) {
        unit = normalizeUnit(maybeUnit);
        name = rest.trim();
      } else {
        name = (maybeUnit ? maybeUnit + " " : "") + rest.trim();
      }
    }

    return {
      name: name,
      display_text: ing,
      measurements: [{
        quantity: quantity,
        unit: unit,
      }],
    };
  });
}

/**
 * Simple categorization of ingredients by name
 */
function categorizeIngredient(name: string): string {
  if (!name) return "other";
  const nameLower = name.toLowerCase();

  // Produce & Vegetables
  if (nameLower.match(/(apple|banana|berry|orange|lemon|lime|avocado|tomato|lettuce|spinach|kale|carrot|potato|onion|garlic|pepper|cucumber|celery|broccoli|cauliflower|zucchini|squash|peach|pear|grape|melon|mango)/)) {
    return "produce";
  }

  // Meat & Seafood
  if (nameLower.match(/(chicken|beef|pork|turkey|lamb|fish|salmon|tuna|shrimp|bacon|sausage)/)) {
    return "meat";
  }

  // Dairy & Eggs
  if (nameLower.match(/(milk|cheese|butter|cream|yogurt|egg)/)) {
    return "dairy";
  }

  // Bakery
  if (nameLower.match(/(bread|bun|roll|bagel|tortilla|pita)/)) {
    return "bakery";
  }

  // Pantry
  if (nameLower.match(/(flour|sugar|salt|pepper|oil|vinegar|sauce|pasta|rice|bean|spice|vanilla|cocoa|baking|honey|syrup)/)) {
    return "pantry";
  }

  // Default
  return "other";
}

/**
 * Generate a grocery list from user's meal plan using pre-parsed ingredients (INSTANT!)
 */
export const generateGroceryList = action({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const openRouterKey = process.env.OPEN_ROUTER_API_KEY;

    console.log(`[GROCERY LIST] Starting generation for user ${args.userId}`);

    // 1. Fetch user's meal plan via query
    const mealPlanEntries = await ctx.runQuery(
      api.mealPlan.getMealPlanByUser,
      { userId: args.userId }
    );

    if (mealPlanEntries.length === 0) {
      throw new Error("No meal plan found. Add recipes to your meal plan first.");
    }

    // 2. Collect pre-parsed ingredients from recipes
    const allParsedIngredients: Array<{
      name: string;
      display_text: string;
      quantity: number;
      unit: string;
    }> = [];

    const unparsedIngredients: string[] = [];
    const recipeIds: Id<"userRecipes">[] = [];

    for (const entry of mealPlanEntries) {
      if (entry.recipe) {
        recipeIds.push(entry.recipe._id);

        // Check if recipe has pre-parsed ingredients
        if (entry.recipe.parsedIngredients && entry.recipe.parsedIngredients.length > 0) {
          console.log(`[GROCERY LIST] ✅ Using pre-parsed ingredients from "${entry.recipe.title}"`);
          allParsedIngredients.push(...entry.recipe.parsedIngredients);
        } else {
          console.log(`[GROCERY LIST] ⚠️ Recipe "${entry.recipe.title}" has no pre-parsed ingredients, will parse now`);
          unparsedIngredients.push(...entry.recipe.ingredients);
        }
      }
    }

    // 3. Parse any unparsed ingredients (for old recipes without pre-parsed data)
    if (unparsedIngredients.length > 0 && openRouterKey) {
      console.log(`[GROCERY LIST] Parsing ${unparsedIngredients.length} unparsed ingredients with AI`);
      try {
        const parsed = await parseIngredientsWithAI(unparsedIngredients, openRouterKey);
        allParsedIngredients.push(...parsed);
        console.log(`[GROCERY LIST] ✅ Parsed ${parsed.length} ingredients`);
      } catch (error: any) {
        console.error(`[GROCERY LIST] ❌ Failed to parse ingredients:`, error.message);
        // Create basic fallback for unparsed ingredients
        unparsedIngredients.forEach(ing => {
          allParsedIngredients.push({
            name: ing,
            display_text: ing,
            quantity: 1,
            unit: "each",
          });
        });
      }
    }

    if (allParsedIngredients.length === 0) {
      throw new Error("No ingredients found in meal plan recipes.");
    }

    console.log(`[GROCERY LIST] Total ingredients to consolidate: ${allParsedIngredients.length}`);

    // 4. Consolidate duplicate ingredients (same name + unit)
    const ingredientMap = new Map<string, {
      name: string;
      quantity: number;
      unit: string;
      displayText: string;
      category: string;
    }>();

    for (const ing of allParsedIngredients) {
      // Extract quantity and unit from measurements array if present
      const quantity = ing.quantity ?? ing.measurements?.[0]?.quantity ?? 1;
      const unit = ing.unit ?? ing.measurements?.[0]?.unit ?? "each";

      // Skip if missing required fields
      if (!ing.name || !unit) {
        console.warn(`[GROCERY LIST] Skipping ingredient with missing data:`, ing);
        continue;
      }

      const key = `${ing.name.toLowerCase()}_${unit.toLowerCase()}`;

      if (ingredientMap.has(key)) {
        // Merge quantities
        const existing = ingredientMap.get(key)!;
        existing.quantity += quantity;
        existing.displayText = `${existing.quantity} ${existing.unit} ${existing.name}`;
      } else {
        // Add new ingredient
        ingredientMap.set(key, {
          name: ing.name,
          quantity: quantity,
          unit: unit,
          displayText: `${quantity} ${unit} ${ing.name}`,
          category: categorizeIngredient(ing.name),
        });
      }
    }

    const consolidatedIngredients = Array.from(ingredientMap.values());
    console.log(`[GROCERY LIST] ✅ Consolidated to ${consolidatedIngredients.length} unique ingredients (instant!)`);

    // 5. Convert to database format (quantity as string)
    const ingredientsForDB = consolidatedIngredients.map(ing => ({
      name: ing.name,
      quantity: String(ing.quantity),  // Convert number to string for database
      unit: ing.unit,
      category: ing.category,
      displayText: ing.displayText,
    }));

    // 6. Save to database via mutation
    const listId = await ctx.runMutation(
      api.groceries.saveGroceryList,
      {
        userId: args.userId,
        mealPlanSnapshot: recipeIds,
        consolidatedIngredients: ingredientsForDB,
      }
    );

    return {
      listId,
      consolidatedIngredients: ingredientsForDB,  // Return DB format (strings)
      recipeCount: recipeIds.length,
      ingredientCount: ingredientsForDB.length,
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
      const environment = process.env.INSTACART_ENVIRONMENT || "development";

      if (!apiKey) {
        console.error("[INSTACART SHOPPING LIST] INSTACART_API_KEY not configured");
        throw new Error("INSTACART_API_KEY not configured");
      }

      console.log(`[INSTACART SHOPPING LIST] Environment: ${environment}`);
      console.log(`[INSTACART SHOPPING LIST] API Key present: ${apiKey ? 'YES (length: ' + apiKey.length + ')' : 'NO'}`);
      console.log(`[INSTACART SHOPPING LIST] Creating shopping list with ${args.ingredients.length} items`);

      // Prepare ingredients with measurements array (Instacart format)
      const ingredients = args.ingredients.map(ing => ({
        name: ing.name,
        display_text: ing.displayText,
        measurements: [{
          quantity: parseQuantity(ing.quantity) ?? 1,
          unit: normalizeUnit(ing.unit || ""),
        }],
      }));

      console.log(`[INSTACART SHOPPING LIST] Sample ingredients:`, JSON.stringify(ingredients.slice(0, 3), null, 2));
      console.log(`[INSTACART SHOPPING LIST] ALL ingredients being passed to MCP:`, JSON.stringify(ingredients, null, 2));

      // Call Instacart via MCP (Model Context Protocol) - use recipe tool (same as single recipes)
      console.log(`[INSTACART SHOPPING LIST] Calling MCP with environment: ${environment}`);

      const instacartUrl = await createRecipeViaMCP(
        {
          title: "Your Meal Plan Grocery List",
          ingredients: ingredients,
          instructions: ["Shop for these ingredients from your meal plan."],
          imageUrl: undefined,
          servings: undefined,
        },
        apiKey,
        environment
      );

      if (instacartUrl) {
        console.log(`[INSTACART SHOPPING LIST] ✅ Successfully created shopping list: ${instacartUrl}`);
        return instacartUrl;
      }

      console.error("[INSTACART SHOPPING LIST] ❌ No URL returned from MCP");
      throw new Error("No Instacart URL returned from MCP");
    } catch (error: any) {
      console.error("[INSTACART SHOPPING LIST] ❌ Fatal error:", {
        message: error.message,
        status: error.status,
        fullError: error.toString(),
      });
      // Don't use fallback - throw the error so user can see what went wrong
      throw error;
    }
  },
});

/**
 * Create Instacart shopping link for a single recipe
 * Runs in Convex action where INSTACART_API_KEY environment variable is accessible
 */
export const createInstacartRecipeLink = action({
  args: {
    title: v.string(),
    ingredients: v.array(v.string()),
    imageUrl: v.optional(v.string()),
    servings: v.optional(v.union(v.string(), v.number())),
    instructions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    try {
      const apiKey = process.env.INSTACART_API_KEY;
      const openRouterKey = process.env.OPEN_ROUTER_API_KEY;
      const environment = process.env.INSTACART_ENVIRONMENT || "development";

      // Determine API endpoint based on environment
      const apiUrl = environment === "production"
        ? "https://connect.instacart.com/idp/v1/products/recipe"
        : "https://connect.dev.instacart.tools/idp/v1/products/recipe";

      if (!apiKey) {
        console.error("[INSTACART] INSTACART_API_KEY not configured in Convex environment");
        throw new Error("INSTACART_API_KEY not configured");
      }

      console.log(`[INSTACART] Environment: ${environment}`);
      console.log(`[INSTACART] API Key present: ${apiKey ? 'YES (length: ' + apiKey.length + ')' : 'NO'}`);
      console.log(`[INSTACART] OpenRouter Key present: ${openRouterKey ? 'YES' : 'NO'}`);

      // Parse ingredients: Try AI first, fall back to regex
      let ingredients;

      if (openRouterKey) {
        try {
          console.log(`[INSTACART] Parsing ${args.ingredients.length} ingredients with AI (gpt-4o-mini)`);
          const startTime = Date.now();

          ingredients = await parseIngredientsWithAI(args.ingredients, openRouterKey);

          const duration = Date.now() - startTime;
          console.log(`[INSTACART] ✅ AI parsing successful (${duration}ms)`);
        } catch (aiError: any) {
          console.error(`[INSTACART] ❌ AI parsing failed:`, {
            message: aiError.message,
            status: aiError.status,
            fullError: aiError.toString(),
          });
          console.log(`[INSTACART] Falling back to regex parsing`);
          ingredients = parseIngredientsWithRegex(args.ingredients);
        }
      } else {
        console.log(`[INSTACART] OPEN_ROUTER_API_KEY not configured, using regex parsing`);
        ingredients = parseIngredientsWithRegex(args.ingredients);
      }

      console.log(`[INSTACART] Creating recipe page for "${args.title}" with ${ingredients.length} items`);
      console.log(`[INSTACART] Sample ingredients being sent to MCP:`, JSON.stringify(ingredients.slice(0, 3), null, 2));

      // Call Instacart via MCP (Model Context Protocol)
      console.log(`[INSTACART] Calling MCP with environment: ${environment}`);

      const instacartUrl = await createRecipeViaMCP(
        {
          title: args.title,
          ingredients: ingredients,
          instructions: args.instructions,
          imageUrl: args.imageUrl,
          servings: typeof args.servings === "string"
            ? parseInt(args.servings) || undefined
            : args.servings,
        },
        apiKey,
        environment
      );

      if (instacartUrl) {
        console.log(`[INSTACART MCP] ✅ Successfully created recipe page: ${instacartUrl}`);
        return instacartUrl;
      }

      console.error("[INSTACART MCP] ❌ No URL returned from MCP");
      throw new Error("No Instacart URL returned from MCP");
    } catch (error: any) {
      console.error("[INSTACART] ❌ Fatal error creating recipe link:", {
        message: error.message,
        status: error.status,
        fullError: error.toString(),
      });
      // Don't use fallback - throw the error so user can see what went wrong
      throw error;
    }
  },
});

/**
 * Fallback: Generate simple Instacart search URL for a recipe
 */
function generateRecipeFallbackUrl(ingredients: string[]): string {
  const items = ingredients.join(", ");
  const encodedItems = encodeURIComponent(items);
  return `https://www.instacart.com/store/search?query=${encodedItems}`;
}

/**
 * Fallback: Generate simple Instacart search URL
 */
function generateFallbackUrl(ingredients: Array<{ displayText: string }>): string {
  const items = ingredients.map((ing) => ing.displayText).join(", ");
  const encodedItems = encodeURIComponent(items);
  return `https://www.instacart.com/store/search?query=${encodedItems}`;
}
