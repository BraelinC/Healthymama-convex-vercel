import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const EMBEDDING_MODEL = "text-embedding-3-small";

async function embedText(text: string, openAiKey: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      input: text,
      model: EMBEDDING_MODEL,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI embedding failed: ${response.status} ${JSON.stringify(error)}`);
  }

  const payload = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  return payload.data[0].embedding;
}

export const addRecipe = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    ingredients: v.array(v.string()),
    steps: v.array(v.string()),
    community: v.string(),
    dietTags: v.array(v.string()),
    sourceUrl: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY env var not set for embeddings");
    }

    const text = `${args.name}\n${args.description}\nIngredients: ${args.ingredients.join(", ")}\nSteps: ${args.steps.join("\n")}`;
    const embedding = await embedText(text, apiKey);

    return await ctx.db.insert("recipes", {
      name: args.name,
      description: args.description,
      ingredients: args.ingredients,
      steps: args.steps,
      community: args.community,
      dietTags: args.dietTags.map((diet) => diet.toLowerCase()),
      embedding,
      embeddingModel: EMBEDDING_MODEL,
      sourceUrl: args.sourceUrl,
      createdAt: Date.now(),
      createdBy: args.createdBy,
    });
  },
});

export const searchRecipes = query({
  args: {
    embedding: v.array(v.float64()),
    community: v.string(),
    limit: v.optional(v.number()),
    excludedIngredientTerms: v.optional(v.array(v.string())),
    dietPreference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { embedding, community, dietPreference, excludedIngredientTerms = [] } = args;
    const limit = args.limit ?? 5;

    const normalizedDiet = dietPreference?.toLowerCase();
    const normalizedExclusions = excludedIngredientTerms.map((term) => term.toLowerCase());

    const iterator = ctx.db
      .query("recipes")
      .withIndex("by_community_embedding", (q) => q.eq("community", community))
      .vectorSearch("embedding", embedding, { limit: limit * 3 });

    const matches = [];
    for await (const recipe of iterator) {
      if (
        normalizedDiet &&
        recipe.dietTags.length > 0 &&
        !recipe.dietTags.includes(normalizedDiet)
      ) {
        continue;
      }

      const lowerIngredients = recipe.ingredients.map((ing) => ing.toLowerCase());
      if (
        normalizedExclusions.some((term) =>
          lowerIngredients.some((ingredient) => ingredient.includes(term))
        )
      ) {
        continue;
      }

      matches.push(recipe);
      if (matches.length >= limit) break;
    }

    return matches;
  },
});

const SAMPLE_RECIPES: Array<{
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  community: "community_1" | "community_2";
  dietTags: string[];
}> = [
  {
    name: "Weeknight Lemon Herb Chicken",
    description: "Bright and zesty chicken thighs roasted with garlic and herbs.",
    ingredients: [
      "4 boneless chicken thighs",
      "2 lemons",
      "4 cloves garlic",
      "2 tbsp olive oil",
      "1 tbsp fresh thyme",
      "1 tbsp fresh rosemary",
      "Salt",
      "Pepper",
    ],
    steps: [
      "Preheat oven to 400°F (200°C).",
      "Marinate chicken with lemon juice, garlic, olive oil, thyme, rosemary, salt, and pepper.",
      "Bake for 25 minutes until golden and cooked through.",
      "Serve with roasted vegetables or a simple salad.",
    ],
    community: "community_1",
    dietTags: ["omnivore", "gluten-free"],
  },
  {
    name: "15-Minute Creamy Chickpea Pasta",
    description: "A quick vegan pasta with silky chickpea sauce and spinach.",
    ingredients: [
      "8 oz rigatoni pasta",
      "1 can chickpeas, drained",
      "2 cups spinach",
      "2 cloves garlic",
      "1 cup oat milk",
      "2 tbsp nutritional yeast",
      "1 tsp smoked paprika",
      "Salt",
      "Pepper",
    ],
    steps: [
      "Cook pasta according to package instructions.",
      "Blend chickpeas, oat milk, nutritional yeast, paprika, salt, and pepper until smooth.",
      "Sauté garlic, add sauce, simmer 3 minutes.",
      "Toss with pasta and spinach until wilted.",
    ],
    community: "community_2",
    dietTags: ["vegan"],
  },
  {
    name: "Smoky Tempeh Tacos",
    description: "High-protein vegan tacos with chipotle tempeh and citrus slaw.",
    ingredients: [
      "8 oz tempeh",
      "2 tbsp chipotle adobo sauce",
      "1 lime",
      "1 cup shredded cabbage",
      "1/4 cup vegan mayo",
      "1 tsp agave syrup",
      "Corn tortillas",
      "Fresh cilantro",
    ],
    steps: [
      "Crumble tempeh and marinate with chipotle sauce and lime juice.",
      "Pan-fry until crispy.",
      "Mix cabbage, vegan mayo, agave, and pinch of salt for slaw.",
      "Assemble tacos with tempeh, slaw, and cilantro.",
    ],
    community: "community_2",
    dietTags: ["vegan"],
  },
  {
    name: "Sheet Pan Salmon with Maple Glaze",
    description: "One-pan salmon with roasted Brussels sprouts and maple-Dijon glaze.",
    ingredients: [
      "4 salmon fillets",
      "3 cups Brussels sprouts",
      "2 tbsp maple syrup",
      "1 tbsp Dijon mustard",
      "1 tbsp soy sauce",
      "1 tbsp olive oil",
      "Salt",
      "Pepper",
    ],
    steps: [
      "Preheat oven to 425°F (220°C).",
      "Whisk maple syrup, Dijon, soy sauce, olive oil, salt, and pepper.",
      "Toss Brussels sprouts with half the glaze and roast 15 minutes.",
      "Add salmon, brush with remaining glaze, roast 10 more minutes.",
    ],
    community: "community_1",
    dietTags: ["pescatarian", "gluten-free"],
  },
];

export const seedSampleRecipes = action({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY env var not set for seeding");
    }

    for (const recipe of SAMPLE_RECIPES) {
      const existing = await ctx.runQuery(internalRecipesLookup, {
        name: recipe.name,
        community: recipe.community,
      });
      if (existing) continue;

      await ctx.runMutation(addRecipe, {
        ...recipe,
        sourceUrl: undefined,
        createdBy: "system",
      });
    }
  },
});

const internalRecipesLookup = query({
  args: {
    name: v.string(),
    community: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("recipes")
      .withIndex("by_community", (q) => q.eq("community", args.community))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();
  },
});
