/**
 * Smart unit suggestions based on ingredient type
 * Shared between web and mobile apps
 */
export const getUnitSuggestions = (ingredientName: string): string[] => {
  const ingredient = ingredientName.toLowerCase();

  // Liquids
  if (
    ingredient.includes('oil') ||
    ingredient.includes('water') ||
    ingredient.includes('milk') ||
    ingredient.includes('cream') ||
    ingredient.includes('juice') ||
    ingredient.includes('vinegar') ||
    ingredient.includes('wine') ||
    ingredient.includes('broth') ||
    ingredient.includes('stock') ||
    ingredient.includes('sauce') ||
    ingredient.includes('syrup')
  ) {
    return ['cup', 'fl oz', 'tbsp', 'tsp', 'ml'];
  }

  // Spices and small amounts
  if (
    ingredient.includes('salt') ||
    ingredient.includes('pepper') ||
    ingredient.includes('garlic powder') ||
    ingredient.includes('onion powder') ||
    ingredient.includes('paprika') ||
    ingredient.includes('cumin') ||
    ingredient.includes('oregano') ||
    ingredient.includes('basil') ||
    ingredient.includes('thyme') ||
    ingredient.includes('cinnamon') ||
    ingredient.includes('nutmeg') ||
    ingredient.includes('ginger') ||
    ingredient.includes('cayenne') ||
    ingredient.includes('chili powder')
  ) {
    return ['tsp', 'tbsp', 'pinch', 'dash', 'g'];
  }

  // Flour, sugar, and baking
  if (
    ingredient.includes('flour') ||
    ingredient.includes('sugar') ||
    ingredient.includes('cocoa') ||
    ingredient.includes('powder') ||
    ingredient.includes('baking')
  ) {
    return ['cup', 'tbsp', 'tsp', 'g', 'oz'];
  }

  // Meats and proteins
  if (
    ingredient.includes('chicken') ||
    ingredient.includes('beef') ||
    ingredient.includes('pork') ||
    ingredient.includes('fish') ||
    ingredient.includes('salmon') ||
    ingredient.includes('shrimp') ||
    ingredient.includes('turkey') ||
    ingredient.includes('bacon') ||
    ingredient.includes('sausage')
  ) {
    return ['lb', 'oz', 'g', 'kg', 'piece'];
  }

  // Eggs
  if (ingredient.includes('egg')) {
    return ['large', 'medium', 'small', 'whole'];
  }

  // Cheese
  if (ingredient.includes('cheese')) {
    return ['cup', 'oz', 'g', 'slice', 'tbsp'];
  }

  // Vegetables and produce
  if (
    ingredient.includes('onion') ||
    ingredient.includes('garlic') ||
    ingredient.includes('tomato') ||
    ingredient.includes('pepper') ||
    ingredient.includes('carrot') ||
    ingredient.includes('celery') ||
    ingredient.includes('potato') ||
    ingredient.includes('lettuce') ||
    ingredient.includes('spinach')
  ) {
    return ['whole', 'cup', 'clove', 'medium', 'large'];
  }

  // Fruits
  if (
    ingredient.includes('apple') ||
    ingredient.includes('banana') ||
    ingredient.includes('orange') ||
    ingredient.includes('lemon') ||
    ingredient.includes('lime') ||
    ingredient.includes('berry') ||
    ingredient.includes('berries')
  ) {
    return ['whole', 'cup', 'medium', 'large', 'oz'];
  }

  // Pasta and grains
  if (
    ingredient.includes('pasta') ||
    ingredient.includes('rice') ||
    ingredient.includes('noodle') ||
    ingredient.includes('quinoa') ||
    ingredient.includes('oat')
  ) {
    return ['cup', 'oz', 'g', 'lb'];
  }

  // Nuts and seeds
  if (
    ingredient.includes('nut') ||
    ingredient.includes('almond') ||
    ingredient.includes('walnut') ||
    ingredient.includes('pecan') ||
    ingredient.includes('seed')
  ) {
    return ['cup', 'oz', 'g', 'tbsp'];
  }

  // Butter and fats
  if (ingredient.includes('butter') || ingredient.includes('margarine')) {
    return ['tbsp', 'cup', 'stick', 'oz', 'g'];
  }

  // Default
  return ['cup', 'tbsp', 'tsp', 'oz', 'lb'];
};

/**
 * Parse a quantity string into a number
 */
export const parseQuantity = (quantity: string): number | null => {
  if (!quantity) return null;

  // Handle fractions
  const fractionMatch = quantity.match(/(\d+)?\s*(\d+)\/(\d+)/);
  if (fractionMatch) {
    const whole = fractionMatch[1] ? parseInt(fractionMatch[1]) : 0;
    const numerator = parseInt(fractionMatch[2]);
    const denominator = parseInt(fractionMatch[3]);
    return whole + numerator / denominator;
  }

  // Handle decimal
  const decimal = parseFloat(quantity);
  return isNaN(decimal) ? null : decimal;
};

/**
 * Format a quantity for display
 */
export const formatQuantity = (amount: number): string => {
  // Common fractions
  const fractions: Record<number, string> = {
    0.25: '1/4',
    0.33: '1/3',
    0.5: '1/2',
    0.67: '2/3',
    0.75: '3/4',
  };

  const decimal = amount % 1;
  const whole = Math.floor(amount);

  // Check for common fractions
  for (const [key, value] of Object.entries(fractions)) {
    if (Math.abs(decimal - parseFloat(key)) < 0.05) {
      return whole > 0 ? `${whole} ${value}` : value;
    }
  }

  // Return as decimal if no fraction match
  return amount.toString();
};
