import type { GenerationCostEstimate } from './generation-spend-gate.js';

export type LocalizedVideoRepairOperation='remove-object'|'replace-region'|'cleanup';

export interface LocalizedVideoRepairPlan {
  id:string;
  projectId:string;
  timelineVersionId:string;
  sourceClipId:string;
  sourceAssetId:string;
  sourceDurationSeconds:number;
  repairStartSeconds:number;
  repairEndSeconds:number;
  maskAssetId:string;
  operation:LocalizedVideoRepairOperation;
  instruction:string;
  fullClipEstimate?:GenerationCostEstimate;
  scopedRepairEstimate?:GenerationCostEstimate;
  evidenceIds:readonly string[];
  authority:'DIRECTOR_LOCALIZED_VIDEO_REPAIR';
}

export interface LocalizedVideoRepairDecision {
  valid:boolean;
  repairDurationSeconds:number;
  projectedSavingsUsd?:number;
  reasons:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_LOCALIZED_VIDEO_REPAIR_QC';
}

export function evaluateLocalizedVideoRepair(plan:LocalizedVideoRepairPlan):LocalizedVideoRepairDecision{
  const reasons:string[]=[];
  if(
    !plan.id.trim()||
    !plan.projectId.trim()||
    !plan.timelineVersionId.trim()||
    !plan.sourceClipId.trim()||
    !plan.sourceAssetId.trim()
  ) reasons.push('DIRECTOR_VIDEO_REPAIR_IDENTITY_REQUIRED');

  if(!Number.isFinite(plan.sourceDurationSeconds)||plan.sourceDurationSeconds<=0) {
    reasons.push('DIRECTOR_VIDEO_REPAIR_SOURCE_DURATION_INVALID');
  }
  if(
    !Number.isFinite(plan.repairStartSeconds)||
    !Number.isFinite(plan.repairEndSeconds)||
    plan.repairStartSeconds<0||
    plan.repairEndSeconds<=plan.repairStartSeconds||
    plan.repairEndSeconds>plan.sourceDurationSeconds
  ) reasons.push('DIRECTOR_VIDEO_REPAIR_RANGE_INVALID');

  if(!plan.maskAssetId.trim()) reasons.push('DIRECTOR_VIDEO_REPAIR_MASK_REQUIRED');
  if(!plan.instruction.trim()) reasons.push('DIRECTOR_VIDEO_REPAIR_INSTRUCTION_REQUIRED');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_VIDEO_REPAIR_EVIDENCE_REQUIRED');

  for(const [name,estimate] of [
    ['full',plan.fullClipEstimate],
    ['scoped',plan.scopedRepairEstimate],
  ] as const){
    if(!estimate) continue;
    if(estimate.projectId!==plan.projectId) reasons.push(`DIRECTOR_VIDEO_REPAIR_COST_PROJECT_MISMATCH:${name}`);
    if(!estimate.id.trim()||!estimate.provider.trim()||!estimate.modelId.trim()||!estimate.pricingSourceRef.trim()) {
      reasons.push(`DIRECTOR_VIDEO_REPAIR_COST_IDENTITY_REQUIRED:${name}`);
    }
    if(
      !Number.isFinite(estimate.quantity)||estimate.quantity<=0||
      !Number.isFinite(estimate.unitPriceUsd)||estimate.unitPriceUsd<0||
      !Number.isFinite(estimate.estimatedCostUsd)||estimate.estimatedCostUsd<0
    ) reasons.push(`DIRECTOR_VIDEO_REPAIR_COST_INVALID:${name}`);
    if(Math.abs(estimate.quantity*estimate.unitPriceUsd-estimate.estimatedCostUsd)>0.01) {
      reasons.push(`DIRECTOR_VIDEO_REPAIR_COST_MISMATCH:${name}`);
    }
  }

  const repairDuration=Math.max(0,plan.repairEndSeconds-plan.repairStartSeconds);
  let savings: number | undefined;
  if(plan.fullClipEstimate&&plan.scopedRepairEstimate){
    savings=plan.fullClipEstimate.estimatedCostUsd-plan.scopedRepairEstimate.estimatedCostUsd;
    if(savings<0) reasons.push('DIRECTOR_VIDEO_REPAIR_SCOPED_COST_HIGHER');
  }

  return Object.freeze({
    valid:reasons.length===0,
    repairDurationSeconds:repairDuration,
    ...(savings!==undefined?{projectedSavingsUsd:savings}:{}),
    reasons:Object.freeze([...new Set(reasons)]),
    evidenceIds:Object.freeze([...plan.evidenceIds]),
    authority:'DIRECTOR_LOCALIZED_VIDEO_REPAIR_QC',
  });
}
