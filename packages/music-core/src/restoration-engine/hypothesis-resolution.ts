import type { RestorationHypothesis } from "./restoration-hypothesis.js";
import { calculateHypothesisUncertainty, type HypothesisUncertainty } from "./hypothesis-uncertainty.js";

export interface HypothesisResolutionPolicy {
  minPosterior: number;
  maxNormalizedEntropy: number;
  minEvidenceCount: number;
}

export interface RestorationResolution {
  hypothesisId: string;
  kind: RestorationHypothesis["kind"];
  posterior: number;
  uncertainty: HypothesisUncertainty;
  evidenceIds: string[];
  status: "resolved" | "unresolved";
  reason: "dominant-supported-hypothesis" | "insufficient-certainty" | "insufficient-evidence";
}

export interface RestorationResolutionRecommendation {
  resolution: RestorationResolution;
  operationClass: "RESTORATION" | "REVIEW";
  executionAuthorized: false;
}

export function resolveRestorationHypothesis(
  hypotheses: RestorationHypothesis[],
  policy: HypothesisResolutionPolicy,
): RestorationResolution {
  validatePolicy(policy);
  if (hypotheses.length === 0) throw new Error("At least one hypothesis is required");

  const uncertainty = calculateHypothesisUncertainty(hypotheses);
  const ranked = [...hypotheses].sort((a, b) => {
    const posteriorDelta = (b.posterior ?? b.prior) - (a.posterior ?? a.prior);
    return posteriorDelta !== 0 ? posteriorDelta : a.id.localeCompare(b.id);
  });
  const dominant = ranked[0];
  const posterior = dominant.posterior ?? dominant.prior;
  const evidenceIds = [...new Set(dominant.observations.map((observation) => observation.evidenceId))];

  if (evidenceIds.length < policy.minEvidenceCount) {
    return { hypothesisId: dominant.id, kind: dominant.kind, posterior, uncertainty, evidenceIds, status: "unresolved", reason: "insufficient-evidence" };
  }
  if (posterior < policy.minPosterior || uncertainty.normalizedEntropy > policy.maxNormalizedEntropy) {
    return { hypothesisId: dominant.id, kind: dominant.kind, posterior, uncertainty, evidenceIds, status: "unresolved", reason: "insufficient-certainty" };
  }

  return { hypothesisId: dominant.id, kind: dominant.kind, posterior, uncertainty, evidenceIds, status: "resolved", reason: "dominant-supported-hypothesis" };
}

export function buildRestorationRecommendation(
  resolution: RestorationResolution,
): RestorationResolutionRecommendation {
  if (resolution.status !== "resolved") {
    return { resolution, operationClass: "REVIEW", executionAuthorized: false };
  }
  if (resolution.kind !== "damage" && resolution.kind !== "missing-signal" && resolution.kind !== "transfer-artifact") {
    return { resolution, operationClass: "REVIEW", executionAuthorized: false };
  }
  return { resolution, operationClass: "RESTORATION", executionAuthorized: false };
}

function validatePolicy(policy: HypothesisResolutionPolicy): void {
  if (!Number.isFinite(policy.minPosterior) || policy.minPosterior < 0 || policy.minPosterior > 1) {
    throw new Error("Minimum posterior must be between 0 and 1");
  }
  if (!Number.isFinite(policy.maxNormalizedEntropy) || policy.maxNormalizedEntropy < 0 || policy.maxNormalizedEntropy > 1) {
    throw new Error("Maximum normalized entropy must be between 0 and 1");
  }
  if (!Number.isInteger(policy.minEvidenceCount) || policy.minEvidenceCount < 0) {
    throw new Error("Minimum evidence count must be a non-negative integer");
  }
}
