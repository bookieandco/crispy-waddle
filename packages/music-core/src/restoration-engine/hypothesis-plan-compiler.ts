import type { RestorationPlan, RestorationCandidate } from "./types.js";
import type { RestorationResolution } from "./hypothesis-resolution.js";

export interface HypothesisPlanCompilerInput {
  resolution: RestorationResolution;
  caseId: string;
  sourceVersionId: string;
  inputArtifactId: string;
  region: { startSample: number; endSample: number };
  operation: string;
  parameters?: Record<string, string | number | boolean>;
  planId: string;
  candidateId: string;
  requiresApproval?: boolean;
}

export function compileResolvedHypothesisToPlan(input: HypothesisPlanCompilerInput): RestorationPlan {
  validateInput(input);
  if (input.resolution.status !== "resolved") throw new Error("Only resolved hypotheses can compile into a restoration plan");
  if (input.resolution.kind !== "damage" && input.resolution.kind !== "missing-signal" && input.resolution.kind !== "transfer-artifact") {
    throw new Error("Hypothesis kind is not eligible for restoration planning");
  }

  const candidate: RestorationCandidate = {
    id: input.candidateId,
    operation: input.operation,
    operationClass: "correction",
    status: "proposed",
    inputArtifactId: input.inputArtifactId,
    parameters: { ...(input.parameters ?? {}) },
    evidenceIds: [...input.resolution.evidenceIds],
    provenance: "derived",
  };

  return {
    id: input.planId,
    caseId: input.caseId,
    sourceVersionId: input.sourceVersionId,
    declaredDamageRegion: { ...input.region },
    allowedPropagationRegion: { ...input.region },
    evidenceIds: [...input.resolution.evidenceIds],
    candidates: [candidate],
    requiresApproval: input.requiresApproval ?? true,
  };
}

function validateInput(input: HypothesisPlanCompilerInput): void {
  if (!input.planId || !input.candidateId || !input.caseId || !input.sourceVersionId || !input.inputArtifactId) {
    throw new Error("Plan compiler identity is required");
  }
  if (!input.operation) throw new Error("Restoration operation is required");
  if (!Number.isInteger(input.region.startSample) || !Number.isInteger(input.region.endSample) || input.region.startSample < 0 || input.region.endSample <= input.region.startSample) {
    throw new Error("Restoration region must be a valid positive sample range");
  }
  if (input.resolution.executionAuthorized !== false) throw new Error("Resolution cannot grant execution authority");
}
