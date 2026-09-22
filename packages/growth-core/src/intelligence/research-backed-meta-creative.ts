import type { GrowthId, ISODateTime } from "../domain/types.js";
import type { CompetitorCreativePattern } from "./competitor-ad-observation.js";
import type { CreativeEvidenceSignal } from "./creative-evidence-engine.js";

export type MetaAdCreativeFormat = "static_image" | "carousel" | "video" | "ugc_video";

export interface ResearchBackedMetaAdConcept {
  id: GrowthId;
  name: string;
  hook: string;
  message: string;
  visualDirection: string;
  format: MetaAdCreativeFormat;
  sourcePatternIds: readonly GrowthId[];
  productTruthRefs: readonly string[];
  differentiation: string;
  testHypothesis: string;
}

export interface ResearchBackedMetaAdPlan {
  id: GrowthId;
  brandId: GrowthId;
  productId: GrowthId;
  productName: string;
  productDescription: string;
  productTruthRefs: readonly string[];
  sourceObservationIds: readonly GrowthId[];
  sourcePatternIds: readonly GrowthId[];
  concepts: readonly ResearchBackedMetaAdConcept[];
  createdAt: ISODateTime;
  authority: "PRODUCTION_PLAN_ONLY";
  performanceClaim: "UNPROVEN_UNTIL_FIRST_PARTY_TEST";
  competitorCreativeReuse: "FORBIDDEN_WITHOUT_RIGHTS";
}

export function buildResearchBackedMetaAdPlan(input: {
  id: GrowthId;
  brandId: GrowthId;
  productId: GrowthId;
  productName: string;
  productDescription: string;
  productTruthRefs: readonly string[];
  patterns: readonly CompetitorCreativePattern[];
  concepts: readonly ResearchBackedMetaAdConcept[];
  createdAt: ISODateTime;
}): ResearchBackedMetaAdPlan {
  if (!input.id.trim() || !input.brandId.trim() || !input.productId.trim()) {
    throw new Error("GROWTH_META_RESEARCH_ID_REQUIRED");
  }
  if (!input.productName.trim() || !input.productDescription.trim()) {
    throw new Error("GROWTH_META_RESEARCH_PRODUCT_REQUIRED");
  }
  if (!input.productTruthRefs.length) {
    throw new Error("GROWTH_META_RESEARCH_PRODUCT_EVIDENCE_REQUIRED");
  }
  if (!input.patterns.length) {
    throw new Error("GROWTH_META_RESEARCH_PATTERN_REQUIRED");
  }
  if (!input.concepts.length) {
    throw new Error("GROWTH_META_RESEARCH_CONCEPT_REQUIRED");
  }
  if (!Number.isFinite(Date.parse(input.createdAt))) {
    throw new Error("GROWTH_META_RESEARCH_CREATED_AT_INVALID");
  }

  const patternById = new Map(input.patterns.map((pattern) => [pattern.patternId, pattern] as const));
  const observationIds = new Set<GrowthId>();
  for (const pattern of input.patterns) {
    if (!pattern.patternId.trim() || !pattern.observationIds.length || !pattern.evidenceRefs.length) {
      throw new Error("GROWTH_META_RESEARCH_PATTERN_EVIDENCE_REQUIRED");
    }
    pattern.observationIds.forEach((id) => observationIds.add(id));
  }

  const conceptIds = new Set<string>();
  const concepts = input.concepts.map((concept) => {
    if (!concept.id.trim() || conceptIds.has(concept.id)) {
      throw new Error("GROWTH_META_RESEARCH_CONCEPT_ID_INVALID");
    }
    conceptIds.add(concept.id);
    if (!concept.name.trim() || !concept.hook.trim() || !concept.message.trim() || !concept.visualDirection.trim()) {
      throw new Error("GROWTH_META_RESEARCH_CONCEPT_BODY_REQUIRED");
    }
    if (!concept.differentiation.trim()) {
      throw new Error("GROWTH_META_RESEARCH_DIFFERENTIATION_REQUIRED");
    }
    if (!concept.testHypothesis.trim()) {
      throw new Error("GROWTH_META_RESEARCH_HYPOTHESIS_REQUIRED");
    }
    if (!concept.sourcePatternIds.length) {
      throw new Error("GROWTH_META_RESEARCH_CONCEPT_PATTERN_REQUIRED");
    }
    for (const patternId of concept.sourcePatternIds) {
      if (!patternById.has(patternId)) {
        throw new Error("GROWTH_META_RESEARCH_UNKNOWN_PATTERN");
      }
    }
    if (!concept.productTruthRefs.length) {
      throw new Error("GROWTH_META_RESEARCH_CONCEPT_PRODUCT_EVIDENCE_REQUIRED");
    }
    return Object.freeze({
      ...concept,
      sourcePatternIds: Object.freeze([...concept.sourcePatternIds]),
      productTruthRefs: Object.freeze([...concept.productTruthRefs]),
    });
  });

  return Object.freeze({
    id: input.id,
    brandId: input.brandId,
    productId: input.productId,
    productName: input.productName.trim(),
    productDescription: input.productDescription.trim(),
    productTruthRefs: Object.freeze([...input.productTruthRefs]),
    sourceObservationIds: Object.freeze([...observationIds]),
    sourcePatternIds: Object.freeze(input.patterns.map((pattern) => pattern.patternId)),
    concepts: Object.freeze(concepts),
    createdAt: input.createdAt,
    authority: "PRODUCTION_PLAN_ONLY",
    performanceClaim: "UNPROVEN_UNTIL_FIRST_PARTY_TEST",
    competitorCreativeReuse: "FORBIDDEN_WITHOUT_RIGHTS",
  });
}

export function competitorPatternsToCreativeEvidence(input: {
  bigIdea: string;
  patterns: readonly CompetitorCreativePattern[];
  observedAt: ISODateTime;
}): CreativeEvidenceSignal[] {
  if (!input.bigIdea.trim()) throw new Error("GROWTH_META_RESEARCH_BIG_IDEA_REQUIRED");
  if (!Number.isFinite(Date.parse(input.observedAt))) {
    throw new Error("GROWTH_META_RESEARCH_OBSERVED_AT_INVALID");
  }

  return input.patterns.map((pattern) => ({
    id: `meta-research:${pattern.patternId}`,
    evidenceClass: "competitor_pattern" as const,
    bigIdea: input.bigIdea.trim(),
    sourceRefs: Object.freeze([
      ...pattern.evidenceRefs,
      ...pattern.observationIds.map((id) => `competitor-observation:${id}`),
    ]),
    observedAt: input.observedAt,
    recurrence: Math.max(1, pattern.observationIds.length),
  }));
}

export function buildDirectorIntentForMetaAdConcept(input: {
  plan: ResearchBackedMetaAdPlan;
  conceptId: GrowthId;
}): string {
  const concept = input.plan.concepts.find((candidate) => candidate.id === input.conceptId);
  if (!concept) throw new Error("GROWTH_META_RESEARCH_CONCEPT_NOT_FOUND");

  return [
    `Create an original ${concept.format.replace("_", " ")} Meta ad for ${input.plan.productName}.`,
    `Product truth: ${input.plan.productDescription}`,
    `Hook: ${concept.hook}`,
    `Message: ${concept.message}`,
    `Visual direction: ${concept.visualDirection}`,
    `Differentiation requirement: ${concept.differentiation}`,
    `Test hypothesis: ${concept.testHypothesis}`,
    "Competitor evidence is pattern inspiration only. Do not reproduce competitor layouts, logos, copy, photography, video frames, or other protected creative assets.",
    "Do not invent product features, prices, reviews, endorsements, performance claims, or guarantees.",
    "Return creative production only. No campaign launch, spend, or publishing authority.",
  ].join("\n");
}
