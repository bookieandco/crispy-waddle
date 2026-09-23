export type SourcePreservationKey =
  | 'identity'
  | 'face'
  | 'body'
  | 'wardrobe'
  | 'props'
  | 'original-motion'
  | 'camera'
  | 'framing'
  | 'environment'
  | 'lighting'
  | 'timing'
  | 'dialogue'
  | 'audio'
  | 'background';

export type SourcePreservationPlan = {
  sourceAssetIds: string[];
  preserve: SourcePreservationKey[];
  changeOnly: string[];
  timingMustMatch?: boolean;
  spatialRelationshipsMustMatch?: boolean;
  allowGlobalRegeneration?: boolean;
};

export type NaturalismCue =
  | 'skin-texture'
  | 'asymmetry'
  | 'micro-expression'
  | 'breathing'
  | 'micro-handheld'
  | 'fabric-response'
  | 'hair-lag'
  | 'weight-shift'
  | 'inertia'
  | 'parallax'
  | 'environmental-reaction'
  | 'focus-breathing'
  | 'subtle-grain'
  | 'lens-edge-softness'
  | 'nonuniform-motion';

export type PhysicalResponse = {
  trigger: string;
  subjectResponse?: string;
  cameraResponse?: string;
  environmentResponse?: string;
  wardrobeHairResponse?: string;
  lightResponse?: string;
  soundResponse?: string;
  endState?: string;
};

export type RealismDirectionPlan = {
  version: 1;
  goal: string;
  /** These are intentional naturalistic cues, not generic degradation. */
  naturalismCues: NaturalismCue[];
  physicalResponses: PhysicalResponse[];
  forbiddenShortcuts?: string[];
  sourcePreservation?: SourcePreservationPlan;
  evidenceRefs?: string[];
};

export type RealismDirectionIssue = {
  code:
    | 'REALISM_GOAL_REQUIRED'
    | 'NATURALISM_CUE_REQUIRED'
    | 'PHYSICAL_TRIGGER_REQUIRED'
    | 'PHYSICAL_RESPONSE_REQUIRED'
    | 'SOURCE_REQUIRED'
    | 'CHANGE_ONLY_REQUIRED'
    | 'GLOBAL_REGENERATION_CONFLICT'
    | 'PRESERVE_CHANGE_CONFLICT';
  path: string;
  message: string;
};

export function validateRealismDirectionPlan(plan: RealismDirectionPlan): RealismDirectionIssue[] {
  const issues: RealismDirectionIssue[] = [];

  if (!plan.goal.trim()) {
    issues.push(issue('REALISM_GOAL_REQUIRED', 'goal', 'Realism direction needs a concrete observable goal.'));
  }
  if (!plan.naturalismCues.length) {
    issues.push(issue('NATURALISM_CUE_REQUIRED', 'naturalismCues', 'Choose at least one intentional naturalism cue.'));
  }

  plan.physicalResponses.forEach((response, index) => {
    if (!response.trigger.trim()) {
      issues.push(issue('PHYSICAL_TRIGGER_REQUIRED', `physicalResponses[${index}].trigger`, 'Physical responses need a cause/trigger.'));
    }
    if (![
      response.subjectResponse,
      response.cameraResponse,
      response.environmentResponse,
      response.wardrobeHairResponse,
      response.lightResponse,
      response.soundResponse,
    ].some((value) => value?.trim())) {
      issues.push(issue('PHYSICAL_RESPONSE_REQUIRED', `physicalResponses[${index}]`, 'A physical trigger needs at least one observable response.'));
    }
  });

  const preservation = plan.sourcePreservation;
  if (preservation) {
    if (!preservation.sourceAssetIds.length) {
      issues.push(issue('SOURCE_REQUIRED', 'sourcePreservation.sourceAssetIds', 'Source-preserving edits need one or more source assets.'));
    }
    if (!preservation.changeOnly.length) {
      issues.push(issue('CHANGE_ONLY_REQUIRED', 'sourcePreservation.changeOnly', 'Source-preserving edits must define exactly what is allowed to change.'));
    }
    if (preservation.allowGlobalRegeneration === true && preservation.preserve.length) {
      issues.push(issue(
        'GLOBAL_REGENERATION_CONFLICT',
        'sourcePreservation.allowGlobalRegeneration',
        'Global regeneration conflicts with explicit source-preservation locks.',
      ));
    }

    const normalizedChanges = preservation.changeOnly.map(normalize);
    for (const key of preservation.preserve) {
      if (normalizedChanges.some((change) => change === key || change.includes(key) || key.includes(change))) {
        issues.push(issue(
          'PRESERVE_CHANGE_CONFLICT',
          'sourcePreservation',
          `"${key}" is both preserved and targeted for change.`,
        ));
      }
    }
  }

  return issues;
}

export function assertRealismDirectionPlan(plan: RealismDirectionPlan): RealismDirectionPlan {
  const issues = validateRealismDirectionPlan(plan);
  if (issues.length) {
    throw new Error(`DIRECTOR_REALISM_PLAN_INVALID: ${issues.map((candidate) => `${candidate.code}@${candidate.path}`).join(', ')}`);
  }
  return plan;
}

export function compileRealismDirective(plan: RealismDirectionPlan): string {
  assertRealismDirectionPlan(plan);
  const lines = [
    `Realism goal: ${plan.goal.trim()}`,
    `Naturalism cues: ${plan.naturalismCues.join(', ')}`,
  ];

  plan.physicalResponses.forEach((response, index) => {
    const effects = [
      response.subjectResponse && `subject ${response.subjectResponse}`,
      response.cameraResponse && `camera ${response.cameraResponse}`,
      response.environmentResponse && `environment ${response.environmentResponse}`,
      response.wardrobeHairResponse && `wardrobe/hair ${response.wardrobeHairResponse}`,
      response.lightResponse && `light ${response.lightResponse}`,
      response.soundResponse && `sound ${response.soundResponse}`,
      response.endState && `end state ${response.endState}`,
    ].filter(Boolean);
    lines.push(`Physical beat ${index + 1}: when ${response.trigger}, then ${effects.join('; ')}`);
  });

  if (plan.sourcePreservation) {
    const preservation = plan.sourcePreservation;
    lines.push(`Source assets: ${preservation.sourceAssetIds.join(', ')}`);
    lines.push(`LOCK/PRESERVE: ${preservation.preserve.join(', ')}`);
    lines.push(`CHANGE ONLY: ${preservation.changeOnly.join('; ')}`);
    if (preservation.timingMustMatch) lines.push('Keep original timing.');
    if (preservation.spatialRelationshipsMustMatch) lines.push('Keep original spatial relationships.');
    if (!preservation.allowGlobalRegeneration) lines.push('Do not redesign or regenerate unrelated parts of the source.');
  }

  if (plan.forbiddenShortcuts?.length) {
    lines.push(`Avoid: ${plan.forbiddenShortcuts.join('; ')}`);
  }

  return lines.join('\n');
}

function issue(
  code: RealismDirectionIssue['code'],
  path: string,
  message: string,
): RealismDirectionIssue {
  return { code, path, message };
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
