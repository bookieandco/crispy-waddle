import type { GrowthId } from '../domain/types.js';
import type { SocialJuggernautPlan } from './social-juggernaut.js';

export type SocialCampaignStage =
  | 'research'
  | 'strategy'
  | 'render'
  | 'review'
  | 'approval'
  | 'schedule'
  | 'publish'
  | 'reconcile'
  | 'measure'
  | 'learn';

export type SocialCampaignCheckpointStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'ambiguous';

export interface SocialCampaignCheckpoint {
  stage: SocialCampaignStage;
  status: SocialCampaignCheckpointStatus;
  attempt: number;
  startedAt?: string;
  updatedAt: string;
  completedAt?: string;
  evidenceRefs: readonly string[];
  externalReceiptRefs: readonly string[];
  approvalRef?: string;
  error?: string;
  recovery:
    | 'NONE'
    | 'RETRY_SAFE'
    | 'RECONCILE_ONLY'
    | 'USER_ACTION_REQUIRED';
}

export interface SocialCampaignRun {
  id: GrowthId;
  subjectId: GrowthId;
  brandId: GrowthId;
  mode: SocialJuggernautPlan['mode'];
  variantIds: readonly string[];
  destinationSetRefs: readonly string[];
  checkpoints: readonly SocialCampaignCheckpoint[];
  currentStage: SocialCampaignStage;
  createdAt: string;
  updatedAt: string;
  policy: Readonly<{
    checkpointEveryStage: true;
    resumeFromLastDurableCheckpoint: true;
    noBlindRetryAfterAmbiguousSideEffect: true;
    exactApprovalRequiredBeforeScheduleOrPublish: true;
    providerReceiptRequiredBeforeDeliveryClaim: true;
    measureBusinessOutcomeNotOnlyReach: true;
  }>;
  authority: 'ORCHESTRATION_ONLY';
  publicationAuthority: 'NONE';
  messagingAuthority: 'NONE';
  paidMediaAuthority: 'NONE';
  externalActionAuthorized: false;
}

const STAGES: readonly SocialCampaignStage[] = Object.freeze([
  'research',
  'strategy',
  'render',
  'review',
  'approval',
  'schedule',
  'publish',
  'reconcile',
  'measure',
  'learn',
]);

const SIDE_EFFECT_STAGES = new Set<SocialCampaignStage>([
  'schedule',
  'publish',
]);

export function createSocialCampaignRun(input: {
  id: GrowthId;
  plan: SocialJuggernautPlan;
  destinationSetRefs: readonly string[];
  createdAt?: string;
}): SocialCampaignRun {
  requireText(input.id, 'id');
  if (!input.plan.variants.length) {
    throw new Error('SOCIAL_CAMPAIGN_VARIANTS_REQUIRED');
  }
  if (!input.destinationSetRefs.length) {
    throw new Error('SOCIAL_CAMPAIGN_DESTINATIONS_REQUIRED');
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  requireDate(createdAt, 'createdAt');

  const checkpoints = STAGES.map((stage) => Object.freeze({
    stage,
    status: 'pending' as const,
    attempt: 0,
    updatedAt: createdAt,
    evidenceRefs: Object.freeze([] as string[]),
    externalReceiptRefs: Object.freeze([] as string[]),
    recovery: 'NONE' as const,
  }));

  return Object.freeze({
    id: input.id,
    subjectId: input.plan.subjectId,
    brandId: input.plan.brandId,
    mode: input.plan.mode,
    variantIds: Object.freeze(input.plan.variants.map((variant) => variant.id)),
    destinationSetRefs: Object.freeze(unique(input.destinationSetRefs)),
    checkpoints: Object.freeze(checkpoints),
    currentStage: 'research' as const,
    createdAt,
    updatedAt: createdAt,
    policy: Object.freeze({
      checkpointEveryStage: true as const,
      resumeFromLastDurableCheckpoint: true as const,
      noBlindRetryAfterAmbiguousSideEffect: true as const,
      exactApprovalRequiredBeforeScheduleOrPublish: true as const,
      providerReceiptRequiredBeforeDeliveryClaim: true as const,
      measureBusinessOutcomeNotOnlyReach: true as const,
    }),
    authority: 'ORCHESTRATION_ONLY' as const,
    publicationAuthority: 'NONE' as const,
    messagingAuthority: 'NONE' as const,
    paidMediaAuthority: 'NONE' as const,
    externalActionAuthorized: false as const,
  });
}

export function updateSocialCampaignCheckpoint(
  run: SocialCampaignRun,
  input: {
    stage: SocialCampaignStage;
    status: Exclude<SocialCampaignCheckpointStatus, 'pending'>;
    observedAt: string;
    evidenceRefs: readonly string[];
    externalReceiptRefs?: readonly string[];
    approvalRef?: string;
    error?: string;
  },
): SocialCampaignRun {
  requireDate(input.observedAt, 'observedAt');
  if (!input.evidenceRefs.length) {
    throw new Error('SOCIAL_CAMPAIGN_CHECKPOINT_EVIDENCE_REQUIRED');
  }

  const index = STAGES.indexOf(input.stage);
  if (index < 0) throw new Error('SOCIAL_CAMPAIGN_STAGE_INVALID');
  const current = run.checkpoints[index]!;

  assertStageCanProgress(run, input.stage, input.status);
  assertTransition(current, input.status);

  const externalReceiptRefs = unique(input.externalReceiptRefs ?? []);
  if (
    input.stage === 'publish'
    && input.status === 'completed'
    && externalReceiptRefs.length === 0
  ) {
    throw new Error('SOCIAL_CAMPAIGN_PUBLISH_RECEIPT_REQUIRED');
  }
  if (
    (input.stage === 'schedule' || input.stage === 'publish')
    && ['running', 'completed'].includes(input.status)
  ) {
    const approval = run.checkpoints[STAGES.indexOf('approval')]!;
    if (approval.status !== 'completed' || !approval.approvalRef) {
      throw new Error('SOCIAL_CAMPAIGN_EXACT_APPROVAL_REQUIRED');
    }
  }
  if (
    input.stage === 'approval'
    && input.status === 'completed'
    && !input.approvalRef?.trim()
  ) {
    throw new Error('SOCIAL_CAMPAIGN_APPROVAL_REF_REQUIRED');
  }

  const recovery = recoveryFor(input.stage, input.status);
  const startedAt = current.startedAt
    ?? (input.status === 'running' ? input.observedAt : current.startedAt);
  const attempt = input.status === 'running'
    ? current.attempt + 1
    : current.attempt;

  const next: SocialCampaignCheckpoint = Object.freeze({
    ...current,
    status: input.status,
    attempt,
    startedAt,
    updatedAt: input.observedAt,
    completedAt: input.status === 'completed' ? input.observedAt : undefined,
    evidenceRefs: Object.freeze(unique([
      ...current.evidenceRefs,
      ...input.evidenceRefs,
    ])),
    externalReceiptRefs: Object.freeze(unique([
      ...current.externalReceiptRefs,
      ...externalReceiptRefs,
    ])),
    approvalRef: input.approvalRef?.trim() || current.approvalRef,
    error: input.error?.trim() || undefined,
    recovery,
  });

  const checkpoints = run.checkpoints.map((checkpoint, checkpointIndex) =>
    checkpointIndex === index ? next : checkpoint
  );

  return Object.freeze({
    ...run,
    checkpoints: Object.freeze(checkpoints),
    currentStage: determineCurrentStage(checkpoints),
    updatedAt: input.observedAt,
  });
}

export function resumeSocialCampaign(run: SocialCampaignRun): Readonly<{
  stage: SocialCampaignStage;
  action: 'START' | 'RESUME' | 'RECONCILE' | 'WAIT' | 'DONE';
  reason: string;
}> {
  const publish = checkpoint(run, 'publish');
  if (publish.status === 'ambiguous') {
    return Object.freeze({
      stage: 'reconcile' as const,
      action: 'RECONCILE' as const,
      reason: 'Publish state is ambiguous; reconcile provider truth before any retry.',
    });
  }

  const firstIncomplete = run.checkpoints.find((item) =>
    item.status !== 'completed'
  );
  if (!firstIncomplete) {
    return Object.freeze({
      stage: 'learn' as const,
      action: 'DONE' as const,
      reason: 'All campaign checkpoints are complete.',
    });
  }

  if (firstIncomplete.status === 'waiting') {
    return Object.freeze({
      stage: firstIncomplete.stage,
      action: 'WAIT' as const,
      reason: 'Checkpoint is waiting for an external dependency or explicit user action.',
    });
  }

  if (firstIncomplete.status === 'running') {
    return Object.freeze({
      stage: firstIncomplete.stage,
      action: 'RESUME' as const,
      reason: 'Resume from the existing durable checkpoint; do not restart prior stages.',
    });
  }

  if (firstIncomplete.status === 'ambiguous') {
    return Object.freeze({
      stage: firstIncomplete.stage,
      action: SIDE_EFFECT_STAGES.has(firstIncomplete.stage)
        ? 'RECONCILE' as const
        : 'WAIT' as const,
      reason: SIDE_EFFECT_STAGES.has(firstIncomplete.stage)
        ? 'Ambiguous side effect requires reconciliation.'
        : 'Ambiguous non-side-effect state requires operator review.',
    });
  }

  return Object.freeze({
    stage: firstIncomplete.stage,
    action: 'START' as const,
    reason: firstIncomplete.status === 'failed'
      ? 'Retry is safe only within this non-ambiguous checkpoint.'
      : 'Start the first incomplete checkpoint.',
  });
}

function assertStageCanProgress(
  run: SocialCampaignRun,
  stage: SocialCampaignStage,
  targetStatus: Exclude<SocialCampaignCheckpointStatus, 'pending'>,
): void {
  const index = STAGES.indexOf(stage);

  if (stage === 'reconcile') {
    const publish = checkpoint(run, 'publish');
    if (!['completed', 'ambiguous'].includes(publish.status)) {
      throw new Error('SOCIAL_CAMPAIGN_RECONCILE_REQUIRES_PUBLISH_ATTEMPT');
    }
  } else if (index > 0) {
    for (let i = 0; i < index; i += 1) {
      const prior = run.checkpoints[i]!;
      if (prior.stage === 'reconcile' && stage === 'measure') {
        continue;
      }
      if (stage === 'reconcile' && prior.stage === 'publish') {
        continue;
      }
      if (prior.status !== 'completed') {
        throw new Error(
          `SOCIAL_CAMPAIGN_PRIOR_STAGE_INCOMPLETE:${prior.stage}`,
        );
      }
    }
  }

  if (
    targetStatus === 'running'
    && stage === 'publish'
    && checkpoint(run, 'publish').status === 'ambiguous'
  ) {
    throw new Error('SOCIAL_CAMPAIGN_AMBIGUOUS_PUBLISH_RETRY_BLOCKED');
  }
}

function assertTransition(
  current: SocialCampaignCheckpoint,
  target: Exclude<SocialCampaignCheckpointStatus, 'pending'>,
): void {
  if (current.status === 'completed') {
    throw new Error('SOCIAL_CAMPAIGN_COMPLETED_STAGE_IMMUTABLE');
  }
  if (
    current.status === 'ambiguous'
    && target === 'running'
    && SIDE_EFFECT_STAGES.has(current.stage)
  ) {
    throw new Error('SOCIAL_CAMPAIGN_AMBIGUOUS_SIDE_EFFECT_RETRY_BLOCKED');
  }
  if (target === 'completed' && current.status === 'pending') {
    throw new Error('SOCIAL_CAMPAIGN_STAGE_MUST_START_BEFORE_COMPLETE');
  }
}

function recoveryFor(
  stage: SocialCampaignStage,
  status: Exclude<SocialCampaignCheckpointStatus, 'pending'>,
): SocialCampaignCheckpoint['recovery'] {
  if (status === 'waiting') return 'USER_ACTION_REQUIRED';
  if (status === 'ambiguous') {
    return SIDE_EFFECT_STAGES.has(stage)
      ? 'RECONCILE_ONLY'
      : 'USER_ACTION_REQUIRED';
  }
  if (status === 'failed') return 'RETRY_SAFE';
  return 'NONE';
}

function determineCurrentStage(
  checkpoints: readonly SocialCampaignCheckpoint[],
): SocialCampaignStage {
  const publish = checkpoints.find((item) => item.stage === 'publish')!;
  if (publish.status === 'ambiguous') return 'reconcile';

  return checkpoints.find((item) => item.status !== 'completed')?.stage
    ?? 'learn';
}

function checkpoint(
  run: SocialCampaignRun,
  stage: SocialCampaignStage,
): SocialCampaignCheckpoint {
  const found = run.checkpoints.find((item) => item.stage === stage);
  if (!found) throw new Error(`SOCIAL_CAMPAIGN_CHECKPOINT_MISSING:${stage}`);
  return found;
}

function requireText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`SOCIAL_CAMPAIGN_FIELD_REQUIRED:${field}`);
}

function requireDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`SOCIAL_CAMPAIGN_DATE_INVALID:${field}`);
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
