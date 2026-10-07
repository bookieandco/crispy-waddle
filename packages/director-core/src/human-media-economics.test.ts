import { describe, expect, it } from 'vitest';
import type {
  DirectorHumanMediaExecutionCandidate,
} from './local-human-media-stack.js';
import type {
  GenerationCostEstimate,
} from './generation-spend-gate.js';
import {
  deriveDirectorHumanMediaAcceptedCost,
  routeDirectorHumanMediaByAcceptedCost,
  summarizeDirectorHumanMediaAttemptCost,
  type DirectorHumanMediaAcceptancePrior,
  type DirectorHumanMediaAttemptEconomicsReceipt,
  type DirectorHumanMediaEconomicsCandidate,
} from './human-media-economics.js';

function execution(
  id:string,
  tier:DirectorHumanMediaExecutionCandidate['executionTier'],
  overrides:Partial<DirectorHumanMediaExecutionCandidate>={},
):DirectorHumanMediaExecutionCandidate{
  return {
    id,
    roles:['lip-sync'],
    executionTier:tier,
    billingModel:tier==='gpu-burst'?'metered-compute':'self-hosted',
    healthy:true,
    commercialReady:true,
    ...overrides,
  };
}

function estimate(candidateId:string,cost:number):GenerationCostEstimate{
  return {
    id:`estimate:${candidateId}`,
    projectId:'project:1',
    provider:candidateId,
    modelId:'model:1',
    pricingUnit:'per-request',
    pricingSourceRef:`pricing:${candidateId}:2026-10-06`,
    quantity:1,
    unitPriceUsd:cost,
    estimatedCostUsd:cost,
    derivedAt:'2026-10-06T20:00:00.000Z',
    assumptions:['One bounded human-media attempt.'],
  };
}

function prior(rate=.5,strength=4):DirectorHumanMediaAcceptancePrior{
  return {
    acceptanceRate:rate,
    effectiveSampleSize:strength,
    sourceRef:'acceptance-prior:benchmark:v1',
    derivedAt:'2026-10-06T20:00:00.000Z',
  };
}

function attempt(
  candidateId:string,
  attemptNumber:number,
  accepted:boolean,
  generationCostUsd:number,
  options:{
    repairCostUsd?:number;
    humanReviewMinutes?:number;
    humanLaborRateUsdPerHour?:number;
  }={},
):DirectorHumanMediaAttemptEconomicsReceipt{
  return {
    schema:'director.human-media-attempt-economics.v1',
    id:`attempt:${candidateId}:${attemptNumber}`,
    projectId:'project:1',
    candidateId,
    engine:'musetalk',
    task:'lip-sync',
    executionTier:candidateId.includes('burst')?'gpu-burst':'local-homebase',
    billingModel:candidateId.includes('burst')?'metered-compute':'self-hosted',
    attemptNumber,
    qcAction:accepted?'accept':'reroll-same-engine',
    accepted,
    generationCostUsd,
    repairCostUsd:options.repairCostUsd??0,
    humanReviewMinutes:options.humanReviewMinutes??0,
    humanLaborRateUsdPerHour:options.humanLaborRateUsdPerHour??0,
    pricingSourceRefs:[`actual-cost:${candidateId}:${attemptNumber}`],
    evidenceIds:[`qc:${candidateId}:${attemptNumber}`,`runtime:${candidateId}:${attemptNumber}`],
    observedAt:`2026-10-06T20:0${attemptNumber}:00.000Z`,
    authority:'DIRECTOR_HUMAN_MEDIA_ATTEMPT_ECONOMICS',
  };
}

function candidate(
  id:string,
  tier:DirectorHumanMediaExecutionCandidate['executionTier'],
  currentCost:number,
  receipts:readonly DirectorHumanMediaAttemptEconomicsReceipt[],
  acceptancePrior:DirectorHumanMediaAcceptancePrior|undefined|null=prior(),
  executionOverrides:Partial<DirectorHumanMediaExecutionCandidate>={},
):DirectorHumanMediaEconomicsCandidate{
  return {
    execution:execution(id,tier,executionOverrides),
    engine:'musetalk',
    task:'lip-sync',
    currentGenerationEstimate:estimate(id,currentCost),
    acceptancePrior:acceptancePrior??undefined,
    attemptReceipts:receipts,
  };
}

describe('Director human-media cost per accepted output',()=>{
  it('prices retries, repair and human time into expected cost per accepted output',()=>{
    const c=candidate(
      'local-musetalk',
      'local-homebase',
      1,
      [
        attempt('local-musetalk',1,false,1,{repairCostUsd:.5,humanReviewMinutes:6,humanLaborRateUsdPerHour:30}),
        attempt('local-musetalk',2,true,1,{repairCostUsd:.25,humanReviewMinutes:3,humanLaborRateUsdPerHour:30}),
      ],
      prior(.5,2),
    );
    const cost=deriveDirectorHumanMediaAcceptedCost(c);
    expect(cost.observedAttempts).toBe(2);
    expect(cost.observedAcceptedOutputs).toBe(1);
    expect(cost.observedAcceptanceRate).toBe(.5);
    expect(cost.posteriorAcceptanceRate).toBe(.5);
    expect(cost.observedAverageRepairCostPerAttemptUsd).toBeCloseTo(.375);
    expect(cost.observedAverageHumanCostPerAttemptUsd).toBeCloseTo(2.25);
    expect(cost.expectedCostPerAttemptUsd).toBeCloseTo(3.625);
    expect(cost.expectedAttemptsPerAcceptedOutput).toBeCloseTo(2);
    expect(cost.expectedRetriesPerAcceptedOutput).toBeCloseTo(1);
    expect(cost.expectedCostPerAcceptedOutputUsd).toBeCloseTo(7.25);
    expect(cost.realizedTotalCostUsd).toBeCloseTo(7.25);
    expect(cost.realizedCostPerAcceptedOutputUsd).toBeCloseTo(7.25);
    expect(cost.rankable).toBe(true);
  });

  it('uses the current generation price while learning post-processing overhead from history',()=>{
    const c=candidate(
      'local-musetalk',
      'local-homebase',
      .5,
      [
        attempt('local-musetalk',1,true,2,{repairCostUsd:1}),
        attempt('local-musetalk',2,true,2,{repairCostUsd:1}),
      ],
      prior(1,2),
    );
    const cost=deriveDirectorHumanMediaAcceptedCost(c);
    expect(cost.realizedTotalCostUsd).toBe(6);
    expect(cost.currentGenerationCostUsd).toBe(.5);
    expect(cost.observedAverageRepairCostPerAttemptUsd).toBe(1);
    expect(cost.expectedCostPerAttemptUsd).toBe(1.5);
    expect(cost.expectedCostPerAcceptedOutputUsd).toBe(1.5);
  });

  it('fails closed on sparse history when no acceptance prior exists',()=>{
    const c=candidate(
      'local-musetalk',
      'local-homebase',
      1,
      [attempt('local-musetalk',1,true,1)],
      null,
    );
    const cost=deriveDirectorHumanMediaAcceptedCost(c,3);
    expect(cost.rankable).toBe(false);
    expect(cost.reasons).toContain('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ACCEPTANCE_EVIDENCE_INSUFFICIENT');
    expect(cost.expectedCostPerAcceptedOutputUsd).toBeUndefined();
  });

  it('allows history-only routing after the configured minimum sample size',()=>{
    const c=candidate(
      'local-musetalk',
      'local-homebase',
      1,
      [
        attempt('local-musetalk',1,false,1),
        attempt('local-musetalk',2,true,1),
        attempt('local-musetalk',3,true,1),
      ],
      null,
    );
    const cost=deriveDirectorHumanMediaAcceptedCost(c,3);
    expect(cost.rankable).toBe(true);
    expect(cost.posteriorAcceptanceRate).toBeCloseTo(2/3);
    expect(cost.expectedCostPerAcceptedOutputUsd).toBeCloseTo(1.5);
  });

  it('keeps local Homebase when local is viable under the default local-first policy',()=>{
    const local=candidate(
      'local-musetalk',
      'local-homebase',
      2,
      [attempt('local-musetalk',1,true,2)],
      prior(.9,5),
    );
    const burst=candidate(
      'burst-musetalk',
      'gpu-burst',
      .1,
      [attempt('burst-musetalk',1,true,.1)],
      prior(.95,5),
    );
    const decision=routeDirectorHumanMediaByAcceptedCost('lip-sync',[burst,local]);
    expect(decision.selectedCandidateId).toBe('local-musetalk');
    expect(decision.ranked[0]?.candidateId).toBe('burst-musetalk');
    expect(decision.ranked[0]?.cost.expectedCostPerAcceptedOutputUsd)
      .toBeLessThan(decision.ranked[1]!.cost.expectedCostPerAcceptedOutputUsd!);
  });

  it('escalates to GPU burst when local exceeds an explicit accepted-output budget',()=>{
    const local=candidate(
      'local-musetalk',
      'local-homebase',
      8,
      [
        attempt('local-musetalk',1,false,8),
        attempt('local-musetalk',2,true,8),
      ],
      prior(.5,4),
    );
    const burst=candidate(
      'burst-musetalk',
      'gpu-burst',
      2,
      [attempt('burst-musetalk',1,true,2)],
      prior(.9,5),
    );
    const decision=routeDirectorHumanMediaByAcceptedCost('lip-sync',[local,burst],{
      runtime:{
        preferLocal:true,
        allowGpuBurst:true,
        allowMeteredExternalApi:false,
        allowSubscriptionSaas:false,
      },
      economicOverrideMode:'when-local-unviable',
      maximumAcceptedCostUsd:5,
      minimumObservedAttemptsForHistoryOnly:3,
    });
    expect(decision.ranked.find(item=>item.candidateId==='local-musetalk')?.reasons)
      .toContain('DIRECTOR_HUMAN_MEDIA_ECONOMIC_ROUTER_ACCEPTED_COST_OVER_BUDGET');
    expect(decision.selectedCandidateId).toBe('burst-musetalk');
  });

  it('can optimize globally when an operator explicitly selects always-economic override',()=>{
    const local=candidate(
      'local-musetalk',
      'local-homebase',
      5,
      [attempt('local-musetalk',1,true,5)],
      prior(.8,5),
    );
    const burst=candidate(
      'burst-musetalk',
      'gpu-burst',
      1,
      [attempt('burst-musetalk',1,true,1)],
      prior(.9,5),
    );
    const decision=routeDirectorHumanMediaByAcceptedCost('lip-sync',[local,burst],{
      runtime:{
        preferLocal:true,
        allowGpuBurst:true,
        allowMeteredExternalApi:false,
        allowSubscriptionSaas:false,
      },
      economicOverrideMode:'always',
      minimumObservedAttemptsForHistoryOnly:3,
    });
    expect(decision.selectedCandidateId).toBe('burst-musetalk');
  });

  it('does not admit paid API or subscription candidates unless runtime policy permits them',()=>{
    const paid=candidate(
      'paid-api',
      'metered-external-api',
      .01,
      [],
      prior(.99,10),
      {billingModel:'metered-api'},
    );
    const subscription=candidate(
      'premium-saas',
      'subscription-saas',
      0,
      [],
      prior(.99,10),
      {billingModel:'subscription'},
    );
    const decision=routeDirectorHumanMediaByAcceptedCost('lip-sync',[paid,subscription]);
    expect(decision.selectedCandidateId).toBeUndefined();
    expect(decision.ranked.every(item=>
      item.reasons.includes('DIRECTOR_HUMAN_MEDIA_ECONOMIC_ROUTER_RUNTIME_NOT_ALLOWED')
    )).toBe(true);
  });

  it('rejects attempts whose acceptance flag contradicts the .9 QC action',()=>{
    const bad={
      ...attempt('local-musetalk',1,true,1),
      qcAction:'reroll-same-engine' as const,
    };
    const cost=deriveDirectorHumanMediaAcceptedCost(candidate(
      'local-musetalk',
      'local-homebase',
      1,
      [bad],
      prior(.8,5),
    ));
    expect(cost.rankable).toBe(false);
    expect(cost.reasons).toContain('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ACCEPTANCE_QC_MISMATCH');
  });

  it('rejects cross-project attempt receipts',()=>{
    const bad={
      ...attempt('local-musetalk',1,true,1),
      projectId:'project:other',
    };
    const cost=deriveDirectorHumanMediaAcceptedCost(candidate(
      'local-musetalk',
      'local-homebase',
      1,
      [bad],
      prior(.8,5),
    ));
    expect(cost.rankable).toBe(false);
    expect(cost.reasons).toContain('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_PROJECT_MISMATCH');
  });

  it('rejects duplicate attempt numbers so retries cannot be double-counted',()=>{
    const a=attempt('local-musetalk',1,false,1);
    const b={...attempt('local-musetalk',2,true,1),attemptNumber:1};
    const cost=deriveDirectorHumanMediaAcceptedCost(candidate(
      'local-musetalk',
      'local-homebase',
      1,
      [a,b],
      prior(.5,5),
    ));
    expect(cost.rankable).toBe(false);
    expect(cost.reasons).toContain('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_DUPLICATE');
  });

  it('rejects duplicate receipt IDs even when attempt numbers differ',()=>{
    const a=attempt('local-musetalk',1,false,1);
    const b={...attempt('local-musetalk',2,true,1),id:a.id};
    const cost=deriveDirectorHumanMediaAcceptedCost(candidate(
      'local-musetalk',
      'local-homebase',
      1,
      [a,b],
      prior(.5,5),
    ));
    expect(cost.rankable).toBe(false);
    expect(cost.reasons).toContain('DIRECTOR_HUMAN_MEDIA_ECONOMICS_ATTEMPT_DUPLICATE');
  });

  it('summarizes direct, repair and human labor cost without hiding labor',()=>{
    const receipt=attempt('local-musetalk',1,true,2,{
      repairCostUsd:1,
      humanReviewMinutes:30,
      humanLaborRateUsdPerHour:40,
    });
    expect(summarizeDirectorHumanMediaAttemptCost(receipt)).toEqual({
      generationCostUsd:2,
      repairCostUsd:1,
      humanCostUsd:20,
      totalCostUsd:23,
    });
  });

  it('preserves current spend-estimate provenance instead of inventing provider pricing',()=>{
    const cost=deriveDirectorHumanMediaAcceptedCost(candidate(
      'local-musetalk',
      'local-homebase',
      1,
      [],
      prior(.75,4),
    ));
    expect(cost.rankable).toBe(true);
    expect(cost.pricingSourceRefs).toContain('pricing:local-musetalk:2026-10-06');
    expect(cost.pricingSourceRefs).toContain('acceptance-prior:benchmark:v1');
    expect(cost.evidenceIds).toContain('generation-cost-estimate:estimate:local-musetalk');
  });
});
