import { createFlow, type FlowEnvelope, type RetentionClass } from "../flow/context-flow";

export interface RecipeIngredient {
  name: string;
  quantity?: string;
  unit?: string;
}

export interface RecipeStep {
  order: number;
  instruction: string;
  timerMinutes?: number;
}

export interface NormalizedRecipe {
  id: string;
  title: string;
  servings?: number;
  prepMinutes?: number;
  cookMinutes?: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  sourceUrl?: string;
  sourceName?: string;
  notes?: string[];
}

export interface RecipeIngestionEnvelope {
  flow: FlowEnvelope<{
    sourceUrl: string;
    rawText?: string;
    extracted: Partial<NormalizedRecipe>;
  }>;
  recipe?: NormalizedRecipe;
}

/**
 * Creates a short-lived ingestion envelope. Raw page material is not memory.
 * A caller must explicitly normalize and promote the resulting recipe.
 */
export function ingestRecipeSource(input: {
  sourceUrl: string;
  extracted: Partial<NormalizedRecipe>;
  rawText?: string;
  retention?: RetentionClass;
}): RecipeIngestionEnvelope {
  return {
    flow: createFlow("data", "recipe-web", {
      sourceUrl: input.sourceUrl,
      rawText: input.rawText,
      extracted: input.extracted,
    }, {
      retention: input.retention ?? "ephemeral",
      trust: "observed",
      reason: "Recipe captured from an explicitly supplied source.",
    }),
  };
}

export function normalizeRecipe(
  envelope: RecipeIngestionEnvelope,
  recipe: Omit<NormalizedRecipe, "id">,
): RecipeIngestionEnvelope {
  return {
    ...envelope,
    recipe: { ...recipe, id: crypto.randomUUID() },
  };
}

export function recipeForApproval(recipe: NormalizedRecipe): FlowEnvelope<NormalizedRecipe> {
  return createFlow("trust", "recipe-ingestion", recipe, {
    retention: "long_term",
    trust: "proposed",
    reason: "Normalized recipe is ready for explicit user save approval.",
  });
}
