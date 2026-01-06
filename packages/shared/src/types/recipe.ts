export interface Ingredient {
  id: string;
  amount: string;
  unit: string;
  name: string;
}

export interface Instruction {
  id: string;
  step: number;
  text: string;
}

export interface Recipe {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  imageUrl?: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  cuisine?: string;
  diet?: string;
}

export interface ExtractedRecipe {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  cuisine?: string;
  diet?: string;
}

export interface ParsedIngredient {
  amount: number | null;
  unit: string;
  name: string;
  original: string;
}
