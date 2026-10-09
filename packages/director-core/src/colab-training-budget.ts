/**
 * Director's existing character-training subsystem may use an owner-launched
 * Colab notebook as an *experiment*. It is never an unattended Compute Core
 * worker or a substitute for verified character LoRA training/QC receipts.
 *
 * Google AI Plus includes a nominal monthly 50 Colab compute units, but the
 * actual account balance, available accelerator and metering are provider-side
 * values. The planner accepts an explicitly observed balance, never fabricates
 * usage or reaches into the owner's Google account.
 */
export const GOOGLE_AI_PLUS_MONTHLY_COLAB_UNITS = 50;
export const DIRECTOR_COLAB_DEFAULT_RESERVE_UNITS = 10;
export const DIRECTOR_COLAB_MAX_EXPERIMENT_CAP_UNITS = 10;

export type DirectorColabExperimentKind =
  | 'gpu-preflight'
  | 'synthetic-training-canary'
  | 'character-lora-evaluation';

export type DirectorColabTrainingAdmission = Readonly<{
  authority: 'DIRECTOR_COLAB_INTERACTIVE_EXPERIMENT_PLAN_ONLY';
  status: 'manual-launch-eligible' | 'blocked';
  reasons: readonly string[];
  experimentKind: DirectorColabExperimentKind;
  monthlyPlanUnits: typeof GOOGLE_AI_PLUS_MONTHLY_COLAB_UNITS;
  reportedRemainingUnits: number | null;
  reservedUnits: number;
  experimentCapUnits: number;
  manualLaunchOnly: true;
  canAutoLaunch: false;
  canSpend: false;
  canPromoteLora: false;
  canCertifyProductionTraining: false;
  canPublish: false;
  nextAction: 'OWNER_OPEN_REVIEWED_COLAB_NOTEBOOK' | 'RESOLVE_BLOCKERS';
}>;

export type DirectorColabTrainingRequest = Readonly<{
  experimentKind: DirectorColabExperimentKind;
  subscriptionConfirmed: boolean;
  // Read from the current Colab UI; may differ from the nominal monthly amount.
  reportedRemainingUnits: number | null;
  plannedExperimentCapUnits: number;
  reserveUnits?: number;
  ownerApprovedThisTrial: boolean;
  rightsAndModelLicenseVerified: boolean;
  datasetReviewed: boolean;
  notebookSourceReviewed: boolean;
}>;

export function planDirectorColabInteractiveExperiment(
  input: DirectorColabTrainingRequest,
): DirectorColabTrainingAdmission {
  const reasons: string[] = [];
  const reserve = input.reserveUnits ?? DIRECTOR_COLAB_DEFAULT_RESERVE_UNITS;
  const remaining = input.reportedRemainingUnits;
  const cap = input.plannedExperimentCapUnits;

  if (!input.subscriptionConfirmed) reasons.push('DIRECTOR_COLAB_SUBSCRIPTION_UNCONFIRMED');
  if (remaining === null || !Number.isFinite(remaining) || remaining < 0) {
    reasons.push('DIRECTOR_COLAB_REMAINING_UNITS_NOT_OBSERVED');
  }
  if (!Number.isFinite(reserve) || !Number.isInteger(reserve) || reserve < 0 || reserve > GOOGLE_AI_PLUS_MONTHLY_COLAB_UNITS) {
    reasons.push('DIRECTOR_COLAB_RESERVE_INVALID');
  }
  if (!Number.isFinite(cap) || !Number.isInteger(cap) || cap <= 0 || cap > DIRECTOR_COLAB_MAX_EXPERIMENT_CAP_UNITS) {
    reasons.push('DIRECTOR_COLAB_EXPERIMENT_CAP_INVALID');
  }
  if (remaining !== null && Number.isFinite(remaining) &&
      Number.isInteger(cap) && cap > 0 && Number.isInteger(reserve) && reserve >= 0 &&
      cap + reserve > remaining) {
    reasons.push('DIRECTOR_COLAB_INSUFFICIENT_OBSERVED_BALANCE');
  }
  if (!input.ownerApprovedThisTrial) reasons.push('DIRECTOR_COLAB_EXPERIMENT_APPROVAL_REQUIRED');
  if (!input.notebookSourceReviewed) reasons.push('DIRECTOR_COLAB_NOTEBOOK_REVIEW_REQUIRED');
  if (!input.rightsAndModelLicenseVerified) reasons.push('DIRECTOR_COLAB_DATA_MODEL_RIGHTS_REQUIRED');
  if (input.experimentKind === 'character-lora-evaluation' && !input.datasetReviewed) {
    reasons.push('DIRECTOR_COLAB_TRAINING_DATASET_REVIEW_REQUIRED');
  }

  const eligible = reasons.length === 0;
  return Object.freeze({
    authority: 'DIRECTOR_COLAB_INTERACTIVE_EXPERIMENT_PLAN_ONLY',
    status: eligible ? 'manual-launch-eligible' : 'blocked',
    reasons: Object.freeze(reasons),
    experimentKind: input.experimentKind,
    monthlyPlanUnits: GOOGLE_AI_PLUS_MONTHLY_COLAB_UNITS,
    reportedRemainingUnits: remaining,
    reservedUnits: reserve,
    experimentCapUnits: cap,
    manualLaunchOnly: true,
    canAutoLaunch: false,
    canSpend: false,
    canPromoteLora: false,
    canCertifyProductionTraining: false,
    canPublish: false,
    nextAction: eligible ? 'OWNER_OPEN_REVIEWED_COLAB_NOTEBOOK' : 'RESOLVE_BLOCKERS',
  });
}
