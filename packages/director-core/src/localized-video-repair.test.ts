import {describe,expect,it} from 'vitest';
import {evaluateLocalizedVideoRepair} from './localized-video-repair';

function estimate(id:string,quantity:number,costPerSecond:number){
  return {
    id,
    projectId:'p',
    provider:'editor-ai',
    modelId:'remove-object',
    pricingUnit:'per-second' as const,
    pricingSourceRef:'pricing:editor',
    quantity,
    unitPriceUsd:costPerSecond,
    estimatedCostUsd:quantity*costPerSecond,
    derivedAt:'2026-09-25T00:00:00Z',
    assumptions:['duration-based repair estimate'],
  };
}

describe('localized video repair',()=>{
  it('captures trim-first object removal as a scoped governed repair',()=>{
    const decision=evaluateLocalizedVideoRepair({
      id:'repair:caboose',
      projectId:'p',
      timelineVersionId:'timeline:v7',
      sourceClipId:'clip:train',
      sourceAssetId:'video:train',
      sourceDurationSeconds:15,
      repairStartSeconds:4,
      repairEndSeconds:8,
      maskAssetId:'mask:wrong-train',
      operation:'remove-object',
      instruction:'Remove the incorrect train/car while preserving the intended background and motion.',
      fullClipEstimate:estimate('cost:full',15,.1),
      scopedRepairEstimate:estimate('cost:trimmed',4,.1),
      evidenceIds:['review:wrong-train','mask:painted'],
      authority:'DIRECTOR_LOCALIZED_VIDEO_REPAIR',
    });
    expect(decision.valid).toBe(true);
    expect(decision.repairDurationSeconds).toBe(4);
    expect(decision.projectedSavingsUsd).toBeCloseTo(1.1);
  });

  it('rejects a repair interval outside the source clip',()=>{
    const decision=evaluateLocalizedVideoRepair({
      id:'repair:bad',
      projectId:'p',
      timelineVersionId:'timeline:v7',
      sourceClipId:'clip',
      sourceAssetId:'video',
      sourceDurationSeconds:5,
      repairStartSeconds:4,
      repairEndSeconds:7,
      maskAssetId:'mask',
      operation:'cleanup',
      instruction:'Clean the region.',
      evidenceIds:['review'],
      authority:'DIRECTOR_LOCALIZED_VIDEO_REPAIR',
    });
    expect(decision.valid).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_VIDEO_REPAIR_RANGE_INVALID');
  });
});
