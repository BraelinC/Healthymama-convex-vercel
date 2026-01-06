/**
 * Instacart Developer Platform API - Supported Units
 * Based on: https://docs.instacart.com/developer_platform_api/api/units_of_measurement/
 */

// Valid units for volume/measured items
export const VOLUME_UNITS = [
  'cup', 'cups', 'c',
  'fl oz',
  'can', 'container', 'jar', 'pouch',
  'ounce',
  'gallon', 'gallons', 'gal', 'gals',
  'milliliter', 'millilitre', 'milliliters', 'millilitres', 'ml', 'mls',
  'liter', 'litre', 'liters', 'litres', 'l',
  'pint', 'pints', 'pt', 'pts',
  'quart', 'quarts', 'qt', 'qts',
  'tablespoon', 'tablespoons', 'tb', 'tbs',
  'teaspoon', 'teaspoons', 'ts', 'tsp', 'tspn',
] as const;

// Valid units for weight/mass items
export const WEIGHT_UNITS = [
  'gram', 'grams', 'g', 'gs',
  'kilogram', 'kilograms', 'kg', 'kgs',
  'lb',
  'bag',
  'can', 'container',
  'per lb',
  'ounce', 'ounces', 'oz',
  'pound', 'pounds', 'lbs',
] as const;

// Valid units for countable items
export const COUNT_UNITS = [
  'bunch', 'bunches',
  'can', 'cans',
  'each',
  'ears',
  'head', 'heads',
  'large', 'lrg', 'lge', 'lg',
  'medium', 'med', 'md',
  'package', 'packages', 'packet',
  'small', 'sm',
  'small ears',
  'small head', 'small heads',
] as const;

// All valid units combined
export const ALL_VALID_UNITS = [
  ...VOLUME_UNITS,
  ...WEIGHT_UNITS,
  ...COUNT_UNITS,
] as const;

export type InstacartUnit = typeof ALL_VALID_UNITS[number];

// Common unit aliases to Instacart-supported units
export const UNIT_ALIASES: Record<string, InstacartUnit> = {
  // Tablespoon aliases
  'tbsp': 'tablespoon',
  'tbsps': 'tablespoons',
  'T': 'tablespoon',
  'Tbsp': 'tablespoon',

  // Teaspoon aliases
  'tsp': 'teaspoon',
  'tsps': 'teaspoons',
  't': 'teaspoon',
  'Tsp': 'teaspoon',

  // Cup aliases
  'Cup': 'cup',
  'Cups': 'cups',

  // Ounce aliases
  'oz.': 'oz',
  'Oz': 'oz',
  'ozs': 'ounces',

  // Pound aliases
  'Lb': 'lb',
  'Lbs': 'lbs',
  'LB': 'lb',
  'LBS': 'lbs',
  'pound': 'pound',
  'Pound': 'pound',

  // Gram aliases
  'G': 'g',
  'Gram': 'gram',
  'Grams': 'grams',

  // Kilogram aliases
  'Kg': 'kg',
  'KG': 'kg',
  'Kilogram': 'kilogram',
  'Kilograms': 'kilograms',

  // Liter aliases
  'L': 'l',
  'Liter': 'liter',
  'Liters': 'liters',
  'Litre': 'litre',
  'Litres': 'litres',

  // Milliliter aliases
  'ML': 'ml',
  'Ml': 'ml',
  'Milliliter': 'milliliter',
  'Milliliters': 'milliliters',

  // Gallon aliases
  'Gal': 'gal',
  'Gallon': 'gallon',
  'Gallons': 'gallons',

  // Pint aliases
  'Pint': 'pint',
  'Pints': 'pints',

  // Quart aliases
  'Quart': 'quart',
  'Quarts': 'quarts',

  // Piece/count aliases
  'piece': 'each',
  'pieces': 'each',
  'whole': 'each',
  'item': 'each',
  'items': 'each',

  // Container aliases
  'bottle': 'container',
  'bottles': 'container',
  'box': 'container',
  'boxes': 'container',
  'carton': 'container',
  'cartons': 'container',
};

/**
 * Normalize a unit string to an Instacart-supported unit
 * @param unit - The unit string to normalize (can be AI-generated)
 * @returns A valid Instacart unit or 'each' as default
 */
export function normalizeUnit(unit: string | undefined): InstacartUnit {
  if (!unit || unit.trim() === '') {
    return 'each';
  }

  const trimmed = unit.trim();

  // Check if it's already a valid unit (case-sensitive)
  if (ALL_VALID_UNITS.includes(trimmed as InstacartUnit)) {
    return trimmed as InstacartUnit;
  }

  // Check aliases (case-insensitive)
  const lowerUnit = trimmed.toLowerCase();
  if (UNIT_ALIASES[trimmed]) {
    return UNIT_ALIASES[trimmed];
  }
  if (UNIT_ALIASES[lowerUnit]) {
    return UNIT_ALIASES[lowerUnit];
  }

  // Try to find a partial match
  for (const validUnit of ALL_VALID_UNITS) {
    if (lowerUnit === validUnit.toLowerCase()) {
      return validUnit;
    }
  }

  // Default to 'each' for countable items
  console.warn(`Unknown unit "${unit}", defaulting to "each"`);
  return 'each';
}

/**
 * Parse and normalize a quantity string
 * @param quantity - The quantity string (e.g., "1/2", "2", "1.5")
 * @returns A number or null if invalid
 */
export function parseQuantity(quantity: string | undefined): number | null {
  if (!quantity || quantity.trim() === '') {
    return 1; // Default quantity
  }

  const trimmed = quantity.trim();

  // Handle fractions like "1/2", "1/3", etc.
  if (trimmed.includes('/')) {
    const [numerator, denominator] = trimmed.split('/').map(Number);
    if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }

  // Handle regular numbers
  const num = parseFloat(trimmed);
  if (!isNaN(num) && num > 0) {
    return num;
  }

  return null;
}

/**
 * Validate and prepare ingredient data for Instacart API
 */
export interface InstacartLineItem {
  name: string;
  quantity: number;
  unit: InstacartUnit;
  display_text?: string;
}

export function prepareInstacartLineItem(ingredient: {
  name: string;
  quantity?: string;
  unit?: string;
  displayText: string;
}): InstacartLineItem {
  const quantity = parseQuantity(ingredient.quantity) || 1;
  const unit = normalizeUnit(ingredient.unit);

  return {
    name: ingredient.name,
    quantity,
    unit,
    display_text: ingredient.displayText,
  };
}
