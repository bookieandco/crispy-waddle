export type DirectedTakeQcMetric =
  | 'identity-stability'
  | 'face-stability'
  | 'hand-anatomy'
  | 'blink-naturalism'
  | 'motion-plausibility'
  | 'camera-plan-match'
  | 'focus-plan-match'
  | 'source-preservation'
  | 'performance-plan-match'
  | 'dialogue-prosody'
  | 'audio-sync'
  | 'background-geometry';

export type DirectedTakeQcObservation = {
  metric: DirectedTakeQcMetric;
  score: number;
  confidence: number;
  evidenceIds: readonly string[];
  hardFailure?: boolean;
  startSeconds?: number;
  endSeconds?: number;
  notes?: readonly string[];
};

export type DirectedTakeQcPolicy = {
  id: string;
  requiredMetrics: readonly DirectedTakeQcMetric[];
  minimumScoreByMetric: Readonly<Partial<Record<DirectedTakeQcMetric, number>>>;
  minimumConfidence: number;
  failOnHardFailure: boolean;
};

export type DirectedTakeQcDecision = {
  admissible: boolean;
  reasons: readonly string[];
  observations: readonly DirectedTakeQcObservation[];
  authority: 'DIRECTOR_QC';
};

export type DirectedTakeRepairProposal = {
  scope: 'none' | 'audio-only' | 'region' | 'shot' | 'manual-review';
  failingMetrics: readonly DirectedTakeQcMetric[];
  startSeconds?: number;
  endSeconds?: number;
  preserve: readonly string[];
  instruction: string;
  authority: 'PROPOSAL_ONLY';
};

/**
 * Post-generation acceptance for the things that make a shot feel directed,
 * not merely technically renderable. Perception models supply evidence;
 * Director applies deterministic thresholds and never lets a model self-pass.
 */
export function evaluateDirectedTakeQc(
  observations: readonly DirectedTakeQcObservation[],
  policy: DirectedTakeQcPolicy,
): DirectedTakeQcDecision {
  const reasons: string[] = [];
  const byMetric = new Map(observations.map((observation) => [observation.metric, observation]));

  for (const metric of policy.requiredMetrics) {
    const observation = byMetric.get(metric);
    if (!observation) {
      reasons.push(`DIRECTOR_DIRECTED_TAKE_QC_MISSING:${metric}`);
      continue;
    }

    if (!Number.isFinite(observation.score) || observation.score < 0 || observation.score > 1) {
      reasons.push(`DIRECTOR_DIRECTED_TAKE_QC_SCORE_INVALID:${metric}`);
      continue;
    }

    if (!Number.isFinite(observation.confidence) || observation.confidence < policy.minimumConfidence) {
      reasons.push(`DIRECTOR_DIRECTED_TAKE_QC_CONFIDENCE_LOW:${metric}`);
    }

    if (!observation.evidenceIds.length) {
      reasons.push(`DIRECTOR_DIRECTED_TAKE_QC_EVIDENCE_REQUIRED:${metric}`);
    }

    const minimum = policy.minimumScoreByMetric[metric] ?? 0;
    if (observation.score < minimum) {
      reasons.push(`DIRECTOR_DIRECTED_TAKE_QC_SCORE_LOW:${metric}`);
    }

    if (policy.failOnHardFailure && observation.hardFailure) {
      reasons.push(`DIRECTOR_DIRECTED_TAKE_QC_HARD_FAILURE:${metric}`);
    }
  }

  return Object.freeze({
    admissible: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
    observations: Object.freeze([...observations]),
    authority: 'DIRECTOR_QC',
  });
}

/**
 * Converts deterministic QC failures into a narrow repair proposal.
 * It never authorizes regeneration; normal review/generation gates still decide.
 */
export function planDirectedTakeRepair(
  decision: DirectedTakeQcDecision,
): DirectedTakeRepairProposal {
  if (decision.admissible) {
    return Object.freeze({
      scope: 'none',
      failingMetrics: Object.freeze([]),
      preserve: Object.freeze([]),
      instruction: 'No repair required.',
      authority: 'PROPOSAL_ONLY',
    });
  }

  const failing = decision.observations.filter((observation) =>
    decision.reasons.some((reason) => reason.endsWith(`:${observation.metric}`))
  );
  const failingMetrics = [...new Set(failing.map((observation) => observation.metric))];

  if (!failingMetrics.length) {
    return Object.freeze({
      scope: 'manual-review',
      failingMetrics: Object.freeze([]),
      preserve: Object.freeze([]),
      instruction: 'QC failed without a localized metric; preserve the take and route it to manual review.',
      authority: 'PROPOSAL_ONLY',
    });
  }

  const audioMetrics = new Set<DirectedTakeQcMetric>(['dialogue-prosody', 'audio-sync']);
  const audioOnly = failingMetrics.every((metric) => audioMetrics.has(metric));

  const ranged = failing.filter((observation) =>
    observation.startSeconds !== undefined &&
    observation.endSeconds !== undefined &&
    Number.isFinite(observation.startSeconds) &&
    Number.isFinite(observation.endSeconds) &&
    observation.endSeconds! > observation.startSeconds!
  );
  const allRanged = ranged.length === failing.length && ranged.length > 0;
  const startSeconds = allRanged ? Math.min(...ranged.map((observation) => observation.startSeconds!)) : undefined;
  const endSeconds = allRanged ? Math.max(...ranged.map((observation) => observation.endSeconds!)) : undefined;

  const preserve = preserveForFailures(failingMetrics);
  const scope = audioOnly ? 'audio-only' : allRanged ? 'region' : 'shot';

  return Object.freeze({
    scope,
    failingMetrics: Object.freeze(failingMetrics),
    ...(startSeconds !== undefined && endSeconds !== undefined ? { startSeconds, endSeconds } : {}),
    preserve: Object.freeze(preserve),
    instruction: scope === 'audio-only'
      ? `Repair only dialogue/audio failures: ${failingMetrics.join(', ')}. Preserve picture and camera timing.`
      : scope === 'region'
        ? `Repair only ${formatRange(startSeconds!, endSeconds!)} for: ${failingMetrics.join(', ')}. Preserve unaffected shot intent and continuity.`
        : `Re-film/regenerate this shot for: ${failingMetrics.join(', ')}. Preserve the authored dimensions listed in preserve.`,
    authority: 'PROPOSAL_ONLY',
  });
}

function preserveForFailures(failingMetrics: readonly DirectedTakeQcMetric[]): string[] {
  const preserve = new Set([
    'story-function',
    'approved-dialogue',
    'product/character identity',
    'shot timing',
  ]);

  if (!failingMetrics.includes('camera-plan-match')) preserve.add('camera-plan');
  if (!failingMetrics.includes('focus-plan-match')) preserve.add('focus-plan');
  if (!failingMetrics.includes('performance-plan-match')) preserve.add('performance-plan');
  if (!failingMetrics.includes('background-geometry')) preserve.add('environment/blocking');
  if (!failingMetrics.includes('source-preservation')) preserve.add('source-preservation locks');

  return [...preserve];
}

function formatRange(start: number, end: number): string {
  const fmt = (value: number) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
  return `${fmt(start)}-${fmt(end)}s`;
}

export const REALISTIC_CHARACTER_TAKE_QC: DirectedTakeQcPolicy = Object.freeze({
  id: 'realistic-character:v1',
  requiredMetrics: Object.freeze([
    'identity-stability',
    'face-stability',
    'hand-anatomy',
    'blink-naturalism',
    'motion-plausibility',
    'camera-plan-match',
    'focus-plan-match',
    'performance-plan-match',
    'background-geometry',
  ]),
  minimumScoreByMetric: Object.freeze({
    'identity-stability': 0.82,
    'face-stability': 0.78,
    'hand-anatomy': 0.72,
    'blink-naturalism': 0.62,
    'motion-plausibility': 0.72,
    'camera-plan-match': 0.8,
    'focus-plan-match': 0.75,
    'performance-plan-match': 0.72,
    'background-geometry': 0.72,
  }),
  minimumConfidence: 0.55,
  failOnHardFailure: true,
});

export const SOURCE_PRESERVING_VIDEO_EDIT_QC: DirectedTakeQcPolicy = Object.freeze({
  id: 'source-preserving-video-edit:v1',
  requiredMetrics: Object.freeze([
    'identity-stability',
    'source-preservation',
    'motion-plausibility',
    'camera-plan-match',
    'background-geometry',
  ]),
  minimumScoreByMetric: Object.freeze({
    'identity-stability': 0.88,
    'source-preservation': 0.9,
    'motion-plausibility': 0.75,
    'camera-plan-match': 0.88,
    'background-geometry': 0.82,
  }),
  minimumConfidence: 0.6,
  failOnHardFailure: true,
});
