export type EditingTechniqueKind =
  | 'transition'
  | 'timing'
  | 'audio-overlap'
  | 'crop'
  | 'speed'
  | 'color'
  | 'caption'
  | 'montage'
  | 'match-cut'
  | 'layout';

export interface EditingTechniqueParameter {
  key: string;
  type: 'number' | 'string' | 'boolean';
  required: boolean;
  minimum?: number;
  maximum?: number;
}

export interface EditingTechniqueSpec {
  id: string;
  kind: EditingTechniqueKind;
  purpose: string;
  requiredEvidenceKinds: readonly string[];
  requiredCapabilities: readonly string[];
  parameters: readonly EditingTechniqueParameter[];
  qcChecks: readonly string[];
  reversible: boolean;
}

export interface EditingTechniquePlan {
  id: string;
  specId: string;
  projectId: string;
  timelineVersionId: string;
  sourceClipIds: readonly string[];
  parameters: Readonly<Record<string, unknown>>;
  evidenceIds: readonly string[];
  authority: 'PROPOSAL_ONLY';
}

export interface EditingTechniquePlanDecision {
  valid: boolean;
  reasons: readonly string[];
}

/**
 * Technique knowledge describes a portable creative/editing operation without
 * granting execution authority to the knowledge source or a provider.
 */
export function validateEditingTechniquePlan(
  spec: EditingTechniqueSpec,
  plan: EditingTechniquePlan,
): EditingTechniquePlanDecision {
  const reasons: string[] = [];
  if (plan.specId !== spec.id) reasons.push('DIRECTOR_TECHNIQUE_SPEC_MISMATCH');
  if (!plan.projectId.trim()) reasons.push('DIRECTOR_TECHNIQUE_PROJECT_REQUIRED');
  if (!plan.timelineVersionId.trim()) reasons.push('DIRECTOR_TECHNIQUE_TIMELINE_VERSION_REQUIRED');
  if (!plan.sourceClipIds.length) reasons.push('DIRECTOR_TECHNIQUE_SOURCE_CLIP_REQUIRED');
  if (spec.requiredEvidenceKinds.length && !plan.evidenceIds.length) reasons.push('DIRECTOR_TECHNIQUE_EVIDENCE_REQUIRED');

  const declaredKeys = new Set(spec.parameters.map((parameter) => parameter.key));
  for (const key of Object.keys(plan.parameters)) {
    if (!declaredKeys.has(key)) reasons.push(`DIRECTOR_TECHNIQUE_PARAMETER_UNKNOWN:${key}`);
  }

  for (const parameter of spec.parameters) {
    const value = plan.parameters[parameter.key];
    if (value === undefined || value === null) {
      if (parameter.required) reasons.push(`DIRECTOR_TECHNIQUE_PARAMETER_REQUIRED:${parameter.key}`);
      continue;
    }
    if (typeof value !== parameter.type) {
      reasons.push(`DIRECTOR_TECHNIQUE_PARAMETER_TYPE:${parameter.key}`);
      continue;
    }
    if (parameter.type === 'number') {
      const numberValue = value as number;
      if (!Number.isFinite(numberValue)) reasons.push(`DIRECTOR_TECHNIQUE_PARAMETER_FINITE:${parameter.key}`);
      if (parameter.minimum !== undefined && numberValue < parameter.minimum) reasons.push(`DIRECTOR_TECHNIQUE_PARAMETER_MIN:${parameter.key}`);
      if (parameter.maximum !== undefined && numberValue > parameter.maximum) reasons.push(`DIRECTOR_TECHNIQUE_PARAMETER_MAX:${parameter.key}`);
    }
  }

  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}
