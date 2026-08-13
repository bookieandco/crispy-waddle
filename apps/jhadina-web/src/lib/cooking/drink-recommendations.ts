export interface DrinkIngredient {
  name: string;
  amount?: string;
  unit?: string;
  optional?: boolean;
}

export interface DrinkRecipe {
  id: string;
  name: string;
  style?: string;
  ingredients: DrinkIngredient[];
  instructions: string[];
  garnish?: string;
  glassware?: string;
  imageUrl?: string;
  sourceUrl?: string;
}

export interface DrinkRecommendationContext {
  availableIngredients: string[];
  preferredStyles?: string[];
  excludedIngredients?: string[];
}

export interface DrinkRecommendation {
  drink: DrinkRecipe;
  score: number;
  reasons: string[];
  missingIngredients: string[];
}

export function recommendDrinks(
  drinks: DrinkRecipe[],
  context: DrinkRecommendationContext,
): DrinkRecommendation[] {
  const available = new Set(context.availableIngredients.map(normalize));
  const excluded = new Set((context.excludedIngredients ?? []).map(normalize));

  return drinks
    .filter((drink) => !drink.ingredients.some((ingredient) => excluded.has(normalize(ingredient.name))))
    .map((drink) => {
      const missingIngredients = drink.ingredients
        .filter((ingredient) => !ingredient.optional)
        .map((ingredient) => ingredient.name)
        .filter((name) => !available.has(normalize(name)));
      const matched = drink.ingredients.filter((ingredient) => available.has(normalize(ingredient.name))).length;
      let score = matched * 10;
      const reasons: string[] = [];

      if (matched) reasons.push(`You already have ${matched} ingredient${matched === 1 ? "" : "s"}.`);
      const drinkStyle = drink.style;
      if (drinkStyle && context.preferredStyles?.some((style) => normalize(style) === normalize(drinkStyle))) {
        score += 15;
        reasons.push(`Matches your ${drinkStyle} preference.`);
      }
      if (!missingIngredients.length) {
        score += 20;
        reasons.push("You have everything needed.");
      }

      return { drink, score, reasons, missingIngredients };
    })
    .sort((a, b) => b.score - a.score);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
