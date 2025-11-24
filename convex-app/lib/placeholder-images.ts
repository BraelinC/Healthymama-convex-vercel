/**
 * Smart placeholder image matcher for cookbook categories
 * Uses regex and keyword matching to provide contextual placeholder images
 */

export interface PlaceholderImage {
  url: string;
  alt: string;
  gradient: string;
  icon: string; // Lucide icon name
  iconColor: string; // Tailwind text color class
  bgColor: string; // Tailwind background color class
}

const placeholderLibrary: Record<string, PlaceholderImage> = {
  breakfast: {
    url: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&h=300&fit=crop",
    alt: "Delicious breakfast",
    gradient: "from-red-500 to-orange-400",
    icon: "Egg",
    iconColor: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  lunch: {
    url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    alt: "Fresh lunch",
    gradient: "from-red-600 to-pink-500",
    icon: "Salad",
    iconColor: "text-green-600",
    bgColor: "bg-green-50",
  },
  dinner: {
    url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
    alt: "Delicious dinner",
    gradient: "from-healthymama-red to-red-700",
    icon: "UtensilsCrossed",
    iconColor: "text-red-600",
    bgColor: "bg-red-50",
  },
  dessert: {
    url: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop",
    alt: "Sweet desserts",
    gradient: "from-pink-500 to-healthymama-pink",
    icon: "IceCream",
    iconColor: "text-pink-600",
    bgColor: "bg-pink-50",
  },
  sweets: {
    url: "https://images.unsplash.com/photo-1581798459219-c8f42e7d29f4?w=400&h=300&fit=crop",
    alt: "Sweets & candy",
    gradient: "from-fuchsia-500 to-pink-500",
    icon: "Candy",
    iconColor: "text-fuchsia-600",
    bgColor: "bg-fuchsia-50",
  },
  appetizer: {
    url: "https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=400&h=300&fit=crop",
    alt: "Appetizers",
    gradient: "from-red-500 to-pink-400",
    icon: "Pizza",
    iconColor: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  snack: {
    url: "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&h=300&fit=crop",
    alt: "Healthy snacks",
    gradient: "from-healthymama-red to-pink-500",
    icon: "Cookie",
    iconColor: "text-yellow-700",
    bgColor: "bg-yellow-50",
  },
  salad: {
    url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
    alt: "Fresh salad",
    gradient: "from-red-400 to-pink-400",
    icon: "Salad",
    iconColor: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  soup: {
    url: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
    alt: "Warm soup",
    gradient: "from-red-600 to-red-400",
    icon: "Soup",
    iconColor: "text-orange-700",
    bgColor: "bg-orange-50",
  },
  pasta: {
    url: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop",
    alt: "Pasta dishes",
    gradient: "from-healthymama-red to-pink-500",
    icon: "WheatOff",
    iconColor: "text-amber-700",
    bgColor: "bg-amber-50",
  },
  pizza: {
    url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop",
    alt: "Pizza",
    gradient: "from-red-500 to-orange-500",
    icon: "Pizza",
    iconColor: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  burger: {
    url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    alt: "Burgers",
    gradient: "from-red-600 to-red-400",
    icon: "Beef",
    iconColor: "text-red-700",
    bgColor: "bg-red-50",
  },
  seafood: {
    url: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=400&h=300&fit=crop",
    alt: "Seafood",
    gradient: "from-red-500 to-pink-600",
    icon: "Fish",
    iconColor: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  meat: {
    url: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&h=300&fit=crop",
    alt: "Meat dishes",
    gradient: "from-red-700 to-red-500",
    icon: "Beef",
    iconColor: "text-red-800",
    bgColor: "bg-red-50",
  },
  vegetarian: {
    url: "https://images.unsplash.com/photo-1540914124281-342587941389?w=400&h=300&fit=crop",
    alt: "Vegetarian dishes",
    gradient: "from-red-400 to-pink-400",
    icon: "Leaf",
    iconColor: "text-green-700",
    bgColor: "bg-green-50",
  },
  vegan: {
    url: "https://images.unsplash.com/photo-1547496502-affa22d38842?w=400&h=300&fit=crop",
    alt: "Vegan dishes",
    gradient: "from-red-400 to-pink-500",
    icon: "Sprout",
    iconColor: "text-lime-700",
    bgColor: "bg-lime-50",
  },
  baking: {
    url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop",
    alt: "Baking",
    gradient: "from-pink-500 to-healthymama-pink",
    icon: "CakeSlice",
    iconColor: "text-pink-700",
    bgColor: "bg-pink-50",
  },
  drinks: {
    url: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop",
    alt: "Drinks & beverages",
    gradient: "from-red-400 to-pink-400",
    icon: "GlassWater",
    iconColor: "text-cyan-600",
    bgColor: "bg-cyan-50",
  },
  smoothie: {
    url: "https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=300&fit=crop",
    alt: "Smoothies",
    gradient: "from-pink-500 to-healthymama-pink",
    icon: "CupSoda",
    iconColor: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  coffee: {
    url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop",
    alt: "Coffee",
    gradient: "from-red-700 to-red-500",
    icon: "Coffee",
    iconColor: "text-amber-800",
    bgColor: "bg-amber-50",
  },
  healthy: {
    url: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=300&fit=crop",
    alt: "Healthy meals",
    gradient: "from-red-400 to-pink-400",
    icon: "HeartPulse",
    iconColor: "text-rose-600",
    bgColor: "bg-rose-50",
  },
  comfort: {
    url: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&h=300&fit=crop",
    alt: "Comfort food",
    gradient: "from-red-600 to-red-400",
    icon: "Soup",
    iconColor: "text-orange-700",
    bgColor: "bg-orange-50",
  },
  holiday: {
    url: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400&h=300&fit=crop",
    alt: "Holiday recipes",
    gradient: "from-red-700 to-healthymama-red",
    icon: "Gift",
    iconColor: "text-red-700",
    bgColor: "bg-red-50",
  },
  kids: {
    url: "https://images.unsplash.com/photo-1606787620819-8bdf0c44c293?w=400&h=300&fit=crop",
    alt: "Kid-friendly meals",
    gradient: "from-pink-400 to-healthymama-pink",
    icon: "Baby",
    iconColor: "text-pink-600",
    bgColor: "bg-pink-50",
  },
  quick: {
    url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop",
    alt: "Quick meals",
    gradient: "from-red-500 to-pink-500",
    icon: "Timer",
    iconColor: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  uncategorized: {
    url: "https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=300&fit=crop",
    alt: "Uncategorized recipes",
    gradient: "from-gray-400 to-gray-500",
    icon: "LayoutGrid",
    iconColor: "text-gray-600",
    bgColor: "bg-gray-50",
  },
  default: {
    url: "https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=300&fit=crop",
    alt: "Recipe collection",
    gradient: "from-healthymama-red to-healthymama-pink",
    icon: "ChefHat",
    iconColor: "text-healthymama-red",
    bgColor: "bg-red-50",
  },
};

/**
 * Matches cookbook name to appropriate placeholder image using regex
 * @param cookbookName - The name of the cookbook category
 * @returns PlaceholderImage object with url, alt text, and gradient
 */
export function getPlaceholderImage(cookbookName: string): PlaceholderImage {
  if (!cookbookName) return placeholderLibrary.default;

  const name = cookbookName.toLowerCase().trim();

  // Try exact match first
  if (placeholderLibrary[name]) {
    return placeholderLibrary[name];
  }

  // Regex patterns for fuzzy matching
  const patterns: [RegExp, keyof typeof placeholderLibrary][] = [
    [/breakfast|morning|brunch/i, "breakfast"],
    [/lunch|midday/i, "lunch"],
    [/dinner|supper|evening/i, "dinner"],
    [/sweets|candy|chocolate|treats/i, "sweets"],
    [/dessert|cake|cookie|pastry/i, "dessert"],
    [/appetizer|starter|hors|finger food/i, "appetizer"],
    [/snack/i, "snack"],
    [/salad|greens/i, "salad"],
    [/soup|stew|chowder|bisque/i, "soup"],
    [/pasta|noodle|spaghetti|linguine/i, "pasta"],
    [/pizza/i, "pizza"],
    [/burger|sandwich/i, "burger"],
    [/seafood|fish|shrimp|salmon|tuna/i, "seafood"],
    [/meat|beef|chicken|pork|steak/i, "meat"],
    [/vegetarian|veggie/i, "vegetarian"],
    [/vegan|plant.based/i, "vegan"],
    [/bak(e|ing)|bread|muffin/i, "baking"],
    [/drink|beverage|cocktail|mocktail/i, "drinks"],
    [/smoothie|shake|blend/i, "smoothie"],
    [/coffee|espresso|latte/i, "coffee"],
    [/healthy|wellness|nutrition|diet/i, "healthy"],
    [/comfort|cozy|homemade/i, "comfort"],
    [/holiday|festive|christmas|thanksgiving/i, "holiday"],
    [/kid|child|family|toddler/i, "kids"],
    [/quick|easy|fast|simple|30.min/i, "quick"],
  ];

  // Find first matching pattern
  for (const [pattern, key] of patterns) {
    if (pattern.test(name)) {
      return placeholderLibrary[key];
    }
  }

  // Return default if no match
  return placeholderLibrary.default;
}

/**
 * Get gradient classes for a cookbook category
 * @param cookbookName - The name of the cookbook category
 * @returns Tailwind gradient class string
 */
export function getCategoryGradient(cookbookName: string): string {
  return getPlaceholderImage(cookbookName).gradient;
}
