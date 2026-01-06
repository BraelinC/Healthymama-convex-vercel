import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@healthymama/convex";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface GenerateGroceryRequest {
  userId: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateGroceryRequest = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    console.log(`[GROCERIES] Generating list for user: ${userId}`);
    const startTime = Date.now();

    // Call Convex action to generate grocery list
    const result = await convex.action(api.groceries.generateGroceryList, {
      userId,
    });

    const duration = Date.now() - startTime;
    console.log(
      `[GROCERIES] Generated list with ${result.ingredientCount} ingredients from ${result.recipeCount} recipes (${duration}ms)`
    );

    // Create Instacart shopping list via Convex action
    // (This accesses INSTACART_API_KEY from Convex environment)
    const instacartUrl = await convex.action(
      api.groceries.createInstacartShoppingList,
      { ingredients: result.consolidatedIngredients }
    );

    // Update the grocery list with Instacart URL if generated
    if (instacartUrl) {
      await convex.mutation(api.groceries.updateInstacartUrl, {
        listId: result.listId,
        instacartUrl,
      });
    }

    return NextResponse.json({
      success: true,
      listId: result.listId,
      consolidatedIngredients: result.consolidatedIngredients,
      recipeCount: result.recipeCount,
      ingredientCount: result.ingredientCount,
      instacartUrl,
      processingTime: duration,
    });
  } catch (error: any) {
    console.error("[GROCERIES] Error generating list:", error);

    return NextResponse.json(
      {
        error: error.message || "Failed to generate grocery list",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

