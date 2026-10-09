import {describe,expect,it} from 'vitest';
import {
  GOOGLE_AI_PLUS_MONTHLY_COLAB_UNITS,
  planDirectorColabInteractiveExperiment,
  type DirectorColabTrainingRequest,
} from './colab-training-budget';

const base:DirectorColabTrainingRequest = {
  experimentKind:'gpu-preflight',
  subscriptionConfirmed:true,
  reportedRemainingUnits:50,
  plannedExperimentCapUnits:3,
  reserveUnits:10,
  ownerApprovedThisTrial:true,
  rightsAndModelLicenseVerified:true,
  datasetReviewed:false,
  notebookSourceReviewed:true,
};

describe('Director AI Plus Colab experiment budget admission',()=>{
  it('caps an owner-approved trial without silently launching or certifying training',()=>{
    const result=planDirectorColabInteractiveExperiment(base);
    expect(GOOGLE_AI_PLUS_MONTHLY_COLAB_UNITS).toBe(50);
    expect(result.status).toBe('manual-launch-eligible');
    expect(result.nextAction).toBe('OWNER_OPEN_REVIEWED_COLAB_NOTEBOOK');
    expect(result.canAutoLaunch).toBe(false);
    expect(result.canSpend).toBe(false);
    expect(result.canPromoteLora).toBe(false);
    expect(result.canCertifyProductionTraining).toBe(false);
    expect(result.canPublish).toBe(false);
  });

  it('does not infer remaining balance from the subscription',()=>{
    const result=planDirectorColabInteractiveExperiment({...base,reportedRemainingUnits:null});
    expect(result.status).toBe('blocked');
    expect(result.reasons).toContain('DIRECTOR_COLAB_REMAINING_UNITS_NOT_OBSERVED');
  });

  it('respects the reserve and never exceeds a 10 unit experiment cap',()=>{
    expect(planDirectorColabInteractiveExperiment({...base,reportedRemainingUnits:12,plannedExperimentCapUnits:3}).reasons)
      .toContain('DIRECTOR_COLAB_INSUFFICIENT_OBSERVED_BALANCE');
    expect(planDirectorColabInteractiveExperiment({...base,plannedExperimentCapUnits:11}).reasons)
      .toContain('DIRECTOR_COLAB_EXPERIMENT_CAP_INVALID');
    expect(planDirectorColabInteractiveExperiment({...base,reserveUnits:51}).reasons)
      .toContain('DIRECTOR_COLAB_RESERVE_INVALID');
  });

  it('requires independent trial approval, reviewed notebook and verified rights',()=>{
    const result=planDirectorColabInteractiveExperiment({
      ...base,ownerApprovedThisTrial:false,notebookSourceReviewed:false,rightsAndModelLicenseVerified:false,
    });
    expect(result.status).toBe('blocked');
    expect(result.reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_COLAB_EXPERIMENT_APPROVAL_REQUIRED',
      'DIRECTOR_COLAB_NOTEBOOK_REVIEW_REQUIRED',
      'DIRECTOR_COLAB_DATA_MODEL_RIGHTS_REQUIRED',
    ]));
  });

  it('requires reviewed actual training dataset for character LoRA evaluation',()=>{
    expect(planDirectorColabInteractiveExperiment({...base,experimentKind:'character-lora-evaluation'}).reasons)
      .toContain('DIRECTOR_COLAB_TRAINING_DATASET_REVIEW_REQUIRED');
    expect(planDirectorColabInteractiveExperiment({...base,experimentKind:'synthetic-training-canary'}).status)
      .toBe('manual-launch-eligible');
  });

  it('rejects nonnumeric balances and fractional estimates',()=>{
    expect(planDirectorColabInteractiveExperiment({...base,reportedRemainingUnits:Number.NaN}).status).toBe('blocked');
    expect(planDirectorColabInteractiveExperiment({...base,plannedExperimentCapUnits:0.5}).status).toBe('blocked');
    expect(planDirectorColabInteractiveExperiment({...base,reserveUnits:-1}).status).toBe('blocked');
  });
});
