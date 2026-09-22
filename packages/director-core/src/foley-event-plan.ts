export type FoleySourceKind = 'recorded' | 'library' | 'synthesized' | 'generated';

export type FoleyRightsStatus =
  | 'owned'
  | 'licensed-commercial'
  | 'licensed-noncommercial'
  | 'public-domain'
  | 'generated'
  | 'unknown';

export interface FoleyEvent {
  id: string;
  projectId: string;
  sourceAssetId: string;
  startSeconds: number;
  endSeconds: number;
  action: string;
  material?: string;
  sourceKind: FoleySourceKind;
  rightsStatus: FoleyRightsStatus;
  evidenceIds: readonly string[];
  objectTrackIds?: readonly string[];
  spatialPan?: number;
  deterministicSeed?: string;
  prompt?: string;
}

export interface FoleyEventPlan {
  id: string;
  projectId: string;
  timelineVersionId: string;
  events: readonly FoleyEvent[];
  authority: 'PROPOSAL_ONLY';
}

export interface FoleyEventPlanDecision {
  valid: boolean;
  reasons: readonly string[];
}

export function validateFoleyEventPlan(
  plan: FoleyEventPlan,
  input: { durationSeconds: number; commercialUse: boolean },
): FoleyEventPlanDecision {
  const reasons: string[] = [];
  if (!plan.id.trim() || !plan.projectId.trim() || !plan.timelineVersionId.trim()) {
    reasons.push('DIRECTOR_FOLEY_PLAN_IDENTITY_REQUIRED');
  }

  for (const event of plan.events) {
    if (event.projectId !== plan.projectId) reasons.push(`DIRECTOR_FOLEY_PROJECT_MISMATCH:${event.id}`);
    if (!event.sourceAssetId.trim() || !event.action.trim()) reasons.push(`DIRECTOR_FOLEY_EVENT_IDENTITY_REQUIRED:${event.id}`);
    if (
      !Number.isFinite(event.startSeconds) ||
      !Number.isFinite(event.endSeconds) ||
      event.startSeconds < 0 ||
      event.endSeconds <= event.startSeconds ||
      event.endSeconds > input.durationSeconds
    ) reasons.push(`DIRECTOR_FOLEY_EVENT_RANGE_INVALID:${event.id}`);
    if (!event.evidenceIds.length) reasons.push(`DIRECTOR_FOLEY_EVIDENCE_REQUIRED:${event.id}`);
    if (event.spatialPan !== undefined && (!Number.isFinite(event.spatialPan) || event.spatialPan < -1 || event.spatialPan > 1)) {
      reasons.push(`DIRECTOR_FOLEY_PAN_INVALID:${event.id}`);
    }
    if (event.sourceKind === 'synthesized' && !event.deterministicSeed?.trim()) {
      reasons.push(`DIRECTOR_FOLEY_SYNTH_SEED_REQUIRED:${event.id}`);
    }
    if (event.sourceKind === 'generated' && !event.prompt?.trim()) {
      reasons.push(`DIRECTOR_FOLEY_GENERATION_PROMPT_REQUIRED:${event.id}`);
    }
    if (event.rightsStatus === 'unknown') reasons.push(`DIRECTOR_FOLEY_RIGHTS_UNKNOWN:${event.id}`);
    if (input.commercialUse && event.rightsStatus === 'licensed-noncommercial') {
      reasons.push(`DIRECTOR_FOLEY_NONCOMMERCIAL_BLOCK:${event.id}`);
    }
  }

  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}
