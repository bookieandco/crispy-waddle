export type AnimationPrinciple =
  | 'squash-and-stretch'
  | 'anticipation'
  | 'staging'
  | 'straight-ahead-and-pose-to-pose'
  | 'follow-through-and-overlapping-action'
  | 'slow-in-and-slow-out'
  | 'arcs'
  | 'secondary-action'
  | 'timing'
  | 'exaggeration'
  | 'solid-drawing'
  | 'appeal';

export type AnimationMethod = 'pose-to-pose' | 'straight-ahead' | 'hybrid';
export type FrameExposure = 'ones' | 'twos' | 'threes' | 'mixed';
export type ExaggerationStrength = 'subtle' | 'moderate' | 'strong' | 'extreme';

export interface PoseHierarchy {
  keys: readonly string[];
  extremes?: readonly string[];
  breakdowns?: readonly string[];
}

export interface SquashStretchDirection {
  amount: ExaggerationStrength;
  preserveVolume: boolean;
  peakMoment?: string;
  avoidContinuousStretch?: boolean;
}

export interface AnticipationDirection {
  cues: readonly string[];
  levels?: readonly string[];
  audienceLead?: string;
}

export interface StagingDirection {
  primaryRead: string;
  audienceAttentionTarget: string;
  competingActionPolicy: 'none' | 'subordinate' | 'deliberate-misdirection';
  processingPauseSeconds?: number;
}

export interface FollowThroughChain {
  driver: string;
  followers: readonly string[];
  lagFrames: number;
  settleFrames: number;
  massCue?: string;
}

export interface EaseDirection {
  subject: string;
  slowInFrames: number;
  slowOutFrames: number;
  /** Impacts/collisions often should not ease into contact. */
  noEaseAtImpact?: boolean;
}

export interface ArcDirection {
  subject: string;
  path: string;
  referencePoints?: readonly string[];
}

export interface SecondaryActionDirection {
  action: string;
  purpose: string;
  mustNotObscurePrimary?: boolean;
}

export interface TimingDirection {
  fps: number;
  exposure: FrameExposure;
  primaryActionFrames?: number;
  readableHoldFrames?: number;
}

export interface ExaggerationDirection {
  ideaToClarify: string;
  strength: ExaggerationStrength;
  preserveBelievability: boolean;
}

export interface SolidFormDirection {
  preserveVolume: boolean;
  preserveWeight: boolean;
  preserveBalance: boolean;
  avoidTwinning: boolean;
  perspectiveCue?: string;
}

export interface AppealDirection {
  shapeLanguage: readonly string[];
  proportionEmphasis?: readonly string[];
  simplifyDetails?: readonly string[];
  personalityRead: string;
}

export interface AnimationPrinciplesPlan {
  version: 1;
  narrativeGoal: string;
  primaryAction: string;
  method: AnimationMethod;
  poseHierarchy?: PoseHierarchy;
  squashStretch?: SquashStretchDirection;
  anticipation?: AnticipationDirection;
  staging?: StagingDirection;
  followThrough?: readonly FollowThroughChain[];
  easing?: readonly EaseDirection[];
  arcs?: readonly ArcDirection[];
  secondaryActions?: readonly SecondaryActionDirection[];
  timing: TimingDirection;
  exaggeration?: ExaggerationDirection;
  solidForm?: SolidFormDirection;
  appeal?: AppealDirection;
  evidenceRefs?: readonly string[];
}

export interface AnimationPrinciplesIssue {
  code:
    | 'ANIMATION_GOAL_REQUIRED'
    | 'ANIMATION_PRIMARY_ACTION_REQUIRED'
    | 'ANIMATION_TIMING_INVALID'
    | 'ANIMATION_POSE_HIERARCHY_REQUIRED'
    | 'ANIMATION_SQUASH_VOLUME_REQUIRED'
    | 'ANIMATION_ANTICIPATION_REQUIRED'
    | 'ANIMATION_STAGING_REQUIRED'
    | 'ANIMATION_STAGING_PAUSE_INVALID'
    | 'ANIMATION_FOLLOW_THROUGH_INVALID'
    | 'ANIMATION_EASING_INVALID'
    | 'ANIMATION_ARC_INVALID'
    | 'ANIMATION_SECONDARY_ACTION_INVALID'
    | 'ANIMATION_EXAGGERATION_INVALID'
    | 'ANIMATION_SOLID_FORM_INVALID'
    | 'ANIMATION_APPEAL_INVALID';
  path: string;
  message: string;
}

export interface AnimationPrincipleObservation {
  principle: AnimationPrinciple;
  score: number;
  confidence: number;
  evidenceIds: readonly string[];
  notes?: readonly string[];
}

export interface AnimationPrinciplesQcPolicy {
  requiredPrinciples: readonly AnimationPrinciple[];
  minimumScore: number;
  minimumConfidence: number;
}

export interface AnimationPrinciplesQcDecision {
  admissible: boolean;
  reasons: readonly string[];
  observations: readonly AnimationPrincipleObservation[];
  authority: 'DIRECTOR_ANIMATION_QC';
}

export function validateAnimationPrinciplesPlan(
  plan: AnimationPrinciplesPlan,
): readonly AnimationPrinciplesIssue[] {
  const issues: AnimationPrinciplesIssue[] = [];
  if (!plan.narrativeGoal.trim()) {
    issues.push(issue('ANIMATION_GOAL_REQUIRED', 'narrativeGoal', 'Animation needs a concrete narrative/performance goal.'));
  }
  if (!plan.primaryAction.trim()) {
    issues.push(issue('ANIMATION_PRIMARY_ACTION_REQUIRED', 'primaryAction', 'Animation needs one clearly readable primary action.'));
  }
  if (
    !Number.isFinite(plan.timing.fps) ||
    plan.timing.fps <= 0 ||
    (plan.timing.primaryActionFrames !== undefined && (!Number.isInteger(plan.timing.primaryActionFrames) || plan.timing.primaryActionFrames <= 0)) ||
    (plan.timing.readableHoldFrames !== undefined && (!Number.isInteger(plan.timing.readableHoldFrames) || plan.timing.readableHoldFrames < 0))
  ) {
    issues.push(issue('ANIMATION_TIMING_INVALID', 'timing', 'Animation timing must use positive FPS and integer frame budgets.'));
  }

  if (plan.method === 'pose-to-pose' || plan.method === 'hybrid') {
    if (!plan.poseHierarchy?.keys.length) {
      issues.push(issue('ANIMATION_POSE_HIERARCHY_REQUIRED', 'poseHierarchy.keys', 'Pose-to-pose work requires explicit key poses.'));
    }
  }

  if (plan.squashStretch && !plan.squashStretch.preserveVolume) {
    issues.push(issue('ANIMATION_SQUASH_VOLUME_REQUIRED', 'squashStretch.preserveVolume', 'Squash/stretch must preserve overall volume.'));
  }

  if (plan.anticipation && !plan.anticipation.cues.length) {
    issues.push(issue('ANIMATION_ANTICIPATION_REQUIRED', 'anticipation.cues', 'Anticipation needs at least one readable preparation cue.'));
  }

  if (plan.staging) {
    if (!plan.staging.primaryRead.trim() || !plan.staging.audienceAttentionTarget.trim()) {
      issues.push(issue('ANIMATION_STAGING_REQUIRED', 'staging', 'Staging needs a primary read and explicit audience attention target.'));
    }
    if (
      plan.staging.processingPauseSeconds !== undefined &&
      (!Number.isFinite(plan.staging.processingPauseSeconds) || plan.staging.processingPauseSeconds < 0)
    ) {
      issues.push(issue('ANIMATION_STAGING_PAUSE_INVALID', 'staging.processingPauseSeconds', 'Staging pause must be a non-negative finite duration.'));
    }
  }

  plan.followThrough?.forEach((chain, index) => {
    if (
      !chain.driver.trim() ||
      !chain.followers.length ||
      !Number.isInteger(chain.lagFrames) ||
      chain.lagFrames < 0 ||
      !Number.isInteger(chain.settleFrames) ||
      chain.settleFrames < 0
    ) {
      issues.push(issue('ANIMATION_FOLLOW_THROUGH_INVALID', `followThrough[${index}]`, 'Follow-through requires a driver, followers, and non-negative integer lag/settle frames.'));
    }
  });

  plan.easing?.forEach((ease, index) => {
    if (
      !ease.subject.trim() ||
      !Number.isInteger(ease.slowInFrames) ||
      ease.slowInFrames < 0 ||
      !Number.isInteger(ease.slowOutFrames) ||
      ease.slowOutFrames < 0
    ) {
      issues.push(issue('ANIMATION_EASING_INVALID', `easing[${index}]`, 'Slow-in/slow-out requires a subject and non-negative frame counts.'));
    }
  });

  plan.arcs?.forEach((arc, index) => {
    if (!arc.subject.trim() || !arc.path.trim()) {
      issues.push(issue('ANIMATION_ARC_INVALID', `arcs[${index}]`, 'Arc direction needs a subject and a curved path description.'));
    }
  });

  plan.secondaryActions?.forEach((action, index) => {
    if (!action.action.trim() || !action.purpose.trim()) {
      issues.push(issue('ANIMATION_SECONDARY_ACTION_INVALID', `secondaryActions[${index}]`, 'Secondary action needs an action and a supporting purpose.'));
    }
  });

  if (plan.exaggeration && (!plan.exaggeration.ideaToClarify.trim() || !plan.exaggeration.preserveBelievability)) {
    issues.push(issue('ANIMATION_EXAGGERATION_INVALID', 'exaggeration', 'Exaggeration must clarify an idea while preserving believability.'));
  }

  if (plan.solidForm && (
    !plan.solidForm.preserveVolume ||
    !plan.solidForm.preserveWeight ||
    !plan.solidForm.preserveBalance
  )) {
    issues.push(issue('ANIMATION_SOLID_FORM_INVALID', 'solidForm', 'Solid form must preserve volume, weight, and balance.'));
  }

  if (plan.appeal && (!plan.appeal.shapeLanguage.length || !plan.appeal.personalityRead.trim())) {
    issues.push(issue('ANIMATION_APPEAL_INVALID', 'appeal', 'Appeal needs clear shape language and a personality read.'));
  }

  return Object.freeze(issues);
}

export function assertAnimationPrinciplesPlan(plan: AnimationPrinciplesPlan): AnimationPrinciplesPlan {
  const issues = validateAnimationPrinciplesPlan(plan);
  if (issues.length) {
    throw new Error(`DIRECTOR_ANIMATION_PRINCIPLES_INVALID: ${issues.map((candidate) => `${candidate.code}@${candidate.path}`).join(', ')}`);
  }
  return plan;
}

export function compileAnimationPrinciplesDirective(plan: AnimationPrinciplesPlan): string {
  assertAnimationPrinciplesPlan(plan);
  const lines: string[] = [
    `Animation goal: ${plan.narrativeGoal}`,
    `Primary action: ${plan.primaryAction}`,
    `Animation method: ${plan.method}`,
    `Timing: ${format(plan.timing.fps)} fps; exposure ${plan.timing.exposure}${plan.timing.primaryActionFrames ? `; primary action ${plan.timing.primaryActionFrames} frames` : ''}${plan.timing.readableHoldFrames !== undefined ? `; readable hold ${plan.timing.readableHoldFrames} frames` : ''}`,
  ];

  if (plan.poseHierarchy) {
    lines.push(`Pose hierarchy: keys [${plan.poseHierarchy.keys.join(' | ')}]${plan.poseHierarchy.extremes?.length ? `; extremes [${plan.poseHierarchy.extremes.join(' | ')}]` : ''}${plan.poseHierarchy.breakdowns?.length ? `; breakdowns [${plan.poseHierarchy.breakdowns.join(' | ')}]` : ''}`);
  }
  if (plan.squashStretch) {
    lines.push(`Squash/stretch: ${plan.squashStretch.amount}; preserve volume; ${plan.squashStretch.peakMoment ? `peak at ${plan.squashStretch.peakMoment}; ` : ''}${plan.squashStretch.avoidContinuousStretch ? 'do not stretch continuously' : 'use only where motivated'}`);
  }
  if (plan.anticipation) {
    lines.push(`Anticipation: ${plan.anticipation.cues.join(' | ')}${plan.anticipation.levels?.length ? `; levels ${plan.anticipation.levels.join(' -> ')}` : ''}${plan.anticipation.audienceLead ? `; lead audience toward ${plan.anticipation.audienceLead}` : ''}`);
  }
  if (plan.staging) {
    lines.push(`Staging: primary read "${plan.staging.primaryRead}"; audience looks at ${plan.staging.audienceAttentionTarget}; competing actions ${plan.staging.competingActionPolicy}${plan.staging.processingPauseSeconds !== undefined ? `; processing pause ${format(plan.staging.processingPauseSeconds)}s` : ''}`);
  }
  for (const chain of plan.followThrough ?? []) {
    lines.push(`Follow-through: ${chain.driver} leads; ${chain.followers.join(', ')} drag by ${chain.lagFrames} frames and settle over ${chain.settleFrames} frames${chain.massCue ? `; mass cue ${chain.massCue}` : ''}`);
  }
  for (const ease of plan.easing ?? []) {
    lines.push(`Slow in/out: ${ease.subject}; slow-in ${ease.slowInFrames} frames; slow-out ${ease.slowOutFrames} frames${ease.noEaseAtImpact ? '; do not ease into impact/contact' : ''}`);
  }
  for (const arc of plan.arcs ?? []) {
    lines.push(`Arc: ${arc.subject} follows ${arc.path}${arc.referencePoints?.length ? `; through ${arc.referencePoints.join(' -> ')}` : ''}`);
  }
  for (const action of plan.secondaryActions ?? []) {
    lines.push(`Secondary action: ${action.action}; supports ${action.purpose}${action.mustNotObscurePrimary ? '; must not obscure primary action' : ''}`);
  }
  if (plan.exaggeration) {
    lines.push(`Exaggeration: ${plan.exaggeration.strength}; clarify "${plan.exaggeration.ideaToClarify}" while preserving believability`);
  }
  if (plan.solidForm) {
    lines.push(`Solid form: preserve volume, weight and balance; ${plan.solidForm.avoidTwinning ? 'avoid twinning/symmetry' : 'symmetry allowed when intentional'}${plan.solidForm.perspectiveCue ? `; perspective ${plan.solidForm.perspectiveCue}` : ''}`);
  }
  if (plan.appeal) {
    lines.push(`Appeal: shape language ${plan.appeal.shapeLanguage.join(', ')}; personality read "${plan.appeal.personalityRead}"${plan.appeal.proportionEmphasis?.length ? `; emphasize ${plan.appeal.proportionEmphasis.join(', ')}` : ''}${plan.appeal.simplifyDetails?.length ? `; simplify ${plan.appeal.simplifyDetails.join(', ')}` : ''}`);
  }

  return lines.join('\n');
}

export function evaluateAnimationPrinciplesQc(
  observations: readonly AnimationPrincipleObservation[],
  policy: AnimationPrinciplesQcPolicy,
): AnimationPrinciplesQcDecision {
  const reasons: string[] = [];
  const byPrinciple = new Map(observations.map((observation) => [observation.principle, observation]));

  for (const principle of policy.requiredPrinciples) {
    const observation = byPrinciple.get(principle);
    if (!observation) {
      reasons.push(`DIRECTOR_ANIMATION_QC_MISSING:${principle}`);
      continue;
    }
    if (!Number.isFinite(observation.score) || observation.score < 0 || observation.score > 1) {
      reasons.push(`DIRECTOR_ANIMATION_QC_SCORE_INVALID:${principle}`);
    } else if (observation.score < policy.minimumScore) {
      reasons.push(`DIRECTOR_ANIMATION_QC_SCORE_LOW:${principle}`);
    }
    if (!Number.isFinite(observation.confidence) || observation.confidence < policy.minimumConfidence) {
      reasons.push(`DIRECTOR_ANIMATION_QC_CONFIDENCE_LOW:${principle}`);
    }
    if (!observation.evidenceIds.length) {
      reasons.push(`DIRECTOR_ANIMATION_QC_EVIDENCE_REQUIRED:${principle}`);
    }
  }

  return Object.freeze({
    admissible: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
    observations: Object.freeze([...observations]),
    authority: 'DIRECTOR_ANIMATION_QC',
  });
}

function issue(
  code: AnimationPrinciplesIssue['code'],
  path: string,
  message: string,
): AnimationPrinciplesIssue {
  return { code, path, message };
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}
