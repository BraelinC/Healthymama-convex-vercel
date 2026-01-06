import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@healthymama/convex";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface CreateRecipeLinkRequest {
  title: string;
  ingredients: string[];
  imageUrl?: string;
  servings?: string | number;
  instructions?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateRecipeLinkRequest = await req.json();
    const { title, ingredients, imageUrl, servings, instructions } = body;

    if (!title || !ingredients || ingredients.length === 0) {
      return NextResponse.json(
        { error: "title and ingredients are required" },
        { status: 400 }
      );
    }

    console.log(`[INSTACART] Creating recipe link for: ${title}`);
    const startTime = Date.now();

    // Call Convex action to create Instacart recipe link
    // (This accesses INSTACART_API_KEY from Convex environment)
    const instacartUrl = await convex.action(
      api.groceries.createInstacartRecipeLink,
      {
        title,
        ingredients,
        imageUrl,
        servings,
        instructions,
      }
    );

    const duration = Date.now() - startTime;
    console.log(
      `[INSTACART] Created recipe link for "${title}" (${duration}ms)`
    );
    console.log(`[INSTACART] Generated URL: ${instacartUrl}`);

    if (!instacartUrl) {
      console.error("[INSTACART] No URL returned from Convex action");
      throw new Error("Instacart URL is empty or undefined");
    }

    return NextResponse.json({
      success: true,
      instacartUrl,
      processingTime: duration,
    });
  } catch (error: any) {
    console.error("[INSTACART] Error creating recipe link:", error);

    return NextResponse.json(
      {
        error: error.message || "Failed to create Instacart recipe link",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
