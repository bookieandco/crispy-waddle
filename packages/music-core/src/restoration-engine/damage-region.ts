import type { DamageAssessment } from "./damage-assessment.js";

export interface SampleRegion {
  startSample: number;
  endSample: number;
}

export interface ProtectedRegion extends SampleRegion {
  reason: string;
}

export interface DamageRegion {
  id: string;
  sourceArtifactId: string;
  core: SampleRegion;
  contextBefore: SampleRegion;
  contextAfter: SampleRegion;
  allowedChange: SampleRegion;
  protectedRegions: ProtectedRegion[];
  confidence: number;
  abstained: boolean;
  reasons: string[];
}

export interface ChangeMask {
  sourceArtifactId: string;
  sampleCount: number;
  allowed: SampleRegion[];
  protected: ProtectedRegion[];
  policy: "allow-only-declared-region";
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalize = (region: SampleRegion): SampleRegion => ({
  startSample: Math.max(0, Math.floor(region.startSample)),
  endSample: Math.max(0, Math.floor(region.endSample)),
});

const valid = (region: SampleRegion): boolean => region.endSample > region.startSample;

const overlap = (a: SampleRegion, b: SampleRegion): boolean =>
  a.startSample < b.endSample && b.startSample < a.endSample;

/**
 * Localizes the smallest explicitly supported damage region. No audio is changed.
 * The context windows are evidence-only handles; only `allowedChange` may later be edited.
 */
export function localizeDamageRegion(input: {
  assessment: DamageAssessment;
  sampleCount: number;
  contextSamples?: number;
  protectedRegions?: ProtectedRegion[];
}): DamageRegion {
  const fallback = { startSample: 0, endSample: 0 };
  const core = normalize(input.assessment.region ?? fallback);
  const context = Math.max(0, Math.floor(input.contextSamples ?? 0));
  const boundedCore = {
    startSample: Math.min(input.sampleCount, core.startSample),
    endSample: Math.min(input.sampleCount, core.endSample),
  };
  const contextBefore = {
    startSample: Math.max(0, boundedCore.startSample - context),
    endSample: boundedCore.startSample,
  };
  const contextAfter = {
    startSample: boundedCore.endSample,
    endSample: Math.min(input.sampleCount, boundedCore.endSample + context),
  };

  const protectedRegions = (input.protectedRegions ?? [])
    .map((item) => ({ ...item, ...normalize(item) }))
    .filter((item) => valid(item) && overlap(item, boundedCore));

  const confidence = clamp01(input.assessment.confidence);
  const reasons = [...input.assessment.reasons];
  let abstained = !valid(boundedCore) || confidence < 0.8;

  if (!valid(boundedCore)) reasons.push("No valid sample-bounded damage region was supplied.");
  if (confidence < 0.8) reasons.push("Damage-region confidence is below the localization threshold.");
  if (protectedRegions.length) reasons.push("Protected evidence overlaps the proposed damage region.");

  // A protected overlap does not automatically erase the region; it makes the
  // future executor resolve the conflict explicitly instead of silently editing it.
  if (protectedRegions.some((item) => item.startSample <= boundedCore.startSample && item.endSample >= boundedCore.endSample)) {
    abstained = true;
    reasons.push("A protected region fully contains the proposed damage region.");
  }

  return {
    id: `region:${input.assessment.id}`,
    sourceArtifactId: input.assessment.sourceArtifactId,
    core: boundedCore,
    contextBefore,
    contextAfter,
    allowedChange: boundedCore,
    protectedRegions,
    confidence,
    abstained,
    reasons,
  };
}

/** Creates the executor-facing forbidden-change contract. */
export function buildChangeMask(input: {
  sourceArtifactId: string;
  sampleCount: number;
  region: DamageRegion;
}): ChangeMask {
  const allowed = valid(input.region.allowedChange) && !input.region.abstained
    ? [input.region.allowedChange]
    : [];

  return {
    sourceArtifactId: input.sourceArtifactId,
    sampleCount: Math.max(0, Math.floor(input.sampleCount)),
    allowed,
    protected: input.region.protectedRegions,
    policy: "allow-only-declared-region",
  };
}

/** True only when every changed region is explicitly authorized by the mask. */
export function isChangeAuthorized(mask: ChangeMask, changed: SampleRegion): boolean {
  const candidate = normalize(changed);
  if (!valid(candidate) || !mask.allowed.length) return false;
  if (candidate.startSample < 0 || candidate.endSample > mask.sampleCount) return false;
  if (!mask.allowed.some((region) => region.startSample <= candidate.startSample && region.endSample >= candidate.endSample)) {
    return false;
  }
  return !mask.protected.some((region) => overlap(region, candidate));
}
