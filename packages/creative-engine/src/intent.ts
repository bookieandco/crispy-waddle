import type { CreativeIntent, CreativeReference, ReferenceRole } from "./types";

export interface CreativeIntentInput {
  operation?: CreativeIntent["operation"];
  prompt?: string;
  references?: CreativeReference[];
  outputCount?: number;
  productId?: string;
  metadata?: Record<string, unknown>;
}

const roles: ReferenceRole[] = [
  "subject",
  "style",
  "composition",
  "product",
  "environment",
  "color",
  "inspiration",
];

export function normalizeCreativeIntent(input: CreativeIntentInput): CreativeIntent {
  const references = (input.references ?? []).filter((reference) =>
    roles.includes(reference.role),
  );

  return {
    operation: input.operation ?? "generate",
    prompt: input.prompt?.trim() || undefined,
    references,
    outputCount: Math.min(Math.max(input.outputCount ?? 3, 1), 8),
    productId: input.productId,
    metadata: input.metadata,
  };
}
