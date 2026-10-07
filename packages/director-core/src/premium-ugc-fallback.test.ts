import { describe, expect, it } from 'vitest';
import type { UgcProductionPlan } from './ugc-production.js';
import {
  assertDirectorPremiumUgcResultLineage,
  normalizeDirectorPremiumUgcProviderResult,
  prepareDirectorPremiumUgcFallback,
  type DirectorPremiumUgcProviderBinding,
} from './premium-ugc-fallback.js';

function plan():UgcProductionPlan{
  return {
    id:'ugc:premium:1',
    projectId:'ads',
    platform:'tiktok',
    aspectRatio:'9:16',
    targetRuntimeSeconds:30,
    product:{
      brandName:'Nalvori',
      productName:'Morning Serum',
      productBibleId:'product:nalvori:serum',
      targetAudience:'simple-routine shoppers',
      valuePropositionRefs:['claim:light-feel'],
      prohibitedClaimRefs:['claim:treats-acne'],
      requiredClaimEvidenceIds:['evidence:claim'],
      referenceAssetIds:['asset:product'],
      referenceEvidenceIds:['evidence:product'],
    },
    creatorCandidates:[{
      id:'creator:1',
      creatorNature:'synthetic',
      characterRef:'character:1',
      audienceFitHypothesis:'relatable creator',
      appearanceDirection:['natural'],
      wardrobeDirection:['casual'],
      referenceAssetIds:['asset:creator'],
      rightsEvidenceIds:['rights:creator'],
    }],
    locationCandidates:[{
      id:'location:1',
      description:'small apartment bathroom',
      realismPurpose:'phone-shot realism',
      referenceAssetIds:['asset:location'],
      rightsEvidenceIds:['rights:location'],
    }],
    conceptOptions:[{
      id:'concept:1',
      title:'Routine',
      premise:'quick morning routine',
      format:'routine',
      productUse:'apply a few drops',
      claimRefs:['claim:light-feel'],
    }],
    scriptCandidates:[{
      id:'script:1',
      durationSeconds:30,
      spokenText:'This feels light and fits into my morning routine.',
      pronunciationNotes:{},
      performancePlan:{
        version:1,
        sceneFunction:'casual routine',
        actors:[{actorId:'creator',startingState:'neutral',endingState:'ready'}],
        beats:[{
          id:'show',
          kind:'action',
          actorId:'creator',
          action:'show product briefly',
          endState:'product returns to counter',
        }],
      },
      claimRefs:['claim:light-feel'],
      disclosureLine:'Made with a virtual creator.',
    }],
    approvals:[
      {id:'a1',stage:'product-reference',selectedRef:'product:nalvori:serum',approvedAt:'2026-10-07T01:00:00Z',approvedBy:'owner'},
      {id:'a2',stage:'creator',selectedRef:'creator:1',approvedAt:'2026-10-07T01:01:00Z',approvedBy:'owner'},
      {id:'a3',stage:'location',selectedRef:'location:1',approvedAt:'2026-10-07T01:02:00Z',approvedBy:'owner'},
      {id:'a4',stage:'concept',selectedRef:'concept:1',approvedAt:'2026-10-07T01:03:00Z',approvedBy:'owner'},
      {id:'a5',stage:'script',selectedRef:'script:1',approvedAt:'2026-10-07T01:04:00Z',approvedBy:'owner'},
      {id:'a6',stage:'generation-brief',selectedRef:'brief:1',approvedAt:'2026-10-07T01:05:00Z',approvedBy:'owner'},
    ],
    currentStage:'generation',
    syntheticDisclosurePolicy:'required',
    authority:'DIRECTOR_UGC_PLAN',
  };
}

function binding(providerId:'muapi-premium'|'arcads-premium'):DirectorPremiumUgcProviderBinding{
  const muapi=providerId==='muapi-premium';
  return {
    id:`binding:${providerId}`,
    providerId,
    executionTier:muapi?'metered-external-api':'subscription-saas',
    billingModel:muapi?'metered-api':'subscription',
    providerModelRef:muapi?'seedance-2':'arcads-talking-actor',
    credentialRef:`secret-ref:${providerId}`,
    submitEndpointRef:`provider-endpoint:${providerId}:submit`,
    statusEndpointRef:`provider-endpoint:${providerId}:status`,
    cancelEndpointRef:`provider-endpoint:${providerId}:cancel`,
    externalServiceEvidenceIds:[`terms:${providerId}`],
    dataHandlingEvidenceIds:[`data-policy:${providerId}`],
    pricingEvidenceIds:[`pricing:${providerId}:2026-10-07`],
  };
}

function input(providerId:'muapi-premium'|'arcads-premium'){
  const b=binding(providerId);
  return {
    id:`premium-request:${providerId}`,
    plan:plan(),
    providerId,
    binding:b,
    runtimePolicy:{
      preferLocal:true,
      allowGpuBurst:true,
      allowMeteredExternalApi:providerId==='muapi-premium',
      allowSubscriptionSaas:providerId==='arcads-premium',
    },
    fallbackReason:'local-qc-exhausted' as const,
    localAttemptEvidenceIds:['local-attempt:1','local-qc:exhausted'],
    costEstimate:{
      id:`estimate:${providerId}`,
      projectId:'ads',
      provider:providerId,
      modelId:b.providerModelRef,
      pricingUnit:'per-request' as const,
      pricingSourceRef:b.pricingEvidenceIds[0]!,
      quantity:1,
      unitPriceUsd:4,
      estimatedCostUsd:4,
      derivedAt:'2026-10-07T02:00:00Z',
      assumptions:['one premium fallback attempt'],
    },
    spendAuthorization:{
      estimateId:`estimate:${providerId}`,
      approvedMaximumUsd:5,
      approvedBy:'owner',
      approvedAt:'2026-10-07T02:01:00Z',
    },
    idempotencyKey:`idempotency:${providerId}:1`,
    evidenceIds:['fallback-policy:approved'],
  };
}

describe('premium UGC fallback',()=>{
  it('prepares MuAPI only after explicit external API admission, local-attempt evidence and spend authorization',()=>{
    const request=prepareDirectorPremiumUgcFallback(input('muapi-premium'));
    expect(request.providerId).toBe('muapi-premium');
    expect(request.referenceAssetIds).toEqual(['asset:product','asset:creator','asset:location']);
    expect(request.productBibleId).toBe('product:nalvori:serum');
    expect(request.qualityClaim).toBe(false);
    expect(request.publicationAuthority).toBe('NONE');
    expect(request.evidenceIds).toEqual(expect.arrayContaining([
      'local-attempt:1',
      'terms:muapi-premium',
      'data-policy:muapi-premium',
      'pricing:muapi-premium:2026-10-07',
    ]));
  });

  it('prepares Arcads only when subscription SaaS is explicitly admitted',()=>{
    const request=prepareDirectorPremiumUgcFallback(input('arcads-premium'));
    expect(request.providerId).toBe('arcads-premium');
    expect(request.providerModelRef).toBe('arcads-talking-actor');
  });

  it('blocks paid providers under the default local-first paid-tier policy',()=>{
    const i=input('muapi-premium');
    i.runtimePolicy={preferLocal:true,allowGpuBurst:true,allowMeteredExternalApi:false,allowSubscriptionSaas:false};
    expect(()=>prepareDirectorPremiumUgcFallback(i))
      .toThrow('DIRECTOR_PREMIUM_UGC_PAID_TIER_NOT_AUTHORIZED');
  });

  it('refuses premium fallback without evidence that local execution was attempted or exhausted',()=>{
    const i=input('muapi-premium');
    i.localAttemptEvidenceIds=[];
    expect(()=>prepareDirectorPremiumUgcFallback(i))
      .toThrow('DIRECTOR_PREMIUM_UGC_LOCAL_ATTEMPT_EVIDENCE_REQUIRED');
  });

  it('refuses stale/unapproved Product Truth and UGC readiness before external submission',()=>{
    const i=input('muapi-premium');
    i.plan={
      ...i.plan,
      approvals:i.plan.approvals.filter(receipt=>receipt.stage!=='script'),
    };
    expect(()=>prepareDirectorPremiumUgcFallback(i))
      .toThrow('DIRECTOR_PREMIUM_UGC:DIRECTOR_UGC_APPROVAL_REQUIRED:script');
  });

  it('requires provider pricing provenance and an authorized budget ceiling',()=>{
    const stale=input('muapi-premium');
    stale.costEstimate={...stale.costEstimate,pricingSourceRef:'pricing:unapproved'};
    expect(()=>prepareDirectorPremiumUgcFallback(stale))
      .toThrow('DIRECTOR_PREMIUM_UGC_COST_SOURCE_NOT_ADMITTED');

    const over=input('muapi-premium');
    over.spendAuthorization={...over.spendAuthorization,approvedMaximumUsd:1};
    expect(()=>prepareDirectorPremiumUgcFallback(over))
      .toThrow('DIRECTOR_PREMIUM_UGC:DIRECTOR_COST_BUDGET_EXCEEDED');
  });

  it('normalizes external results without allowing providers to self-assert Director quality',()=>{
    const request=prepareDirectorPremiumUgcFallback(input('muapi-premium'));
    const result=normalizeDirectorPremiumUgcProviderResult({
      request,
      providerJobId:'muapi:job:1',
      status:'ready',
      outputUris:['https://provider.example/video.mp4'],
      evidenceIds:['provider-response:1'],
      observedAt:'2026-10-07T03:00:00Z',
    });
    expect(result.qualityClaim).toBe(false);
    expect(()=>assertDirectorPremiumUgcResultLineage({request,result})).not.toThrow();
    expect(()=>assertDirectorPremiumUgcResultLineage({
      request,
      result:{...result,requestId:'foreign'},
    })).toThrow('DIRECTOR_PREMIUM_UGC_RESULT_REQUEST_MISMATCH');
  });

  it('requires an output for ready status and an error for failed status',()=>{
    const request=prepareDirectorPremiumUgcFallback(input('muapi-premium'));
    expect(()=>normalizeDirectorPremiumUgcProviderResult({
      request,
      providerJobId:'job:1',
      status:'ready',
      evidenceIds:['response:1'],
      observedAt:'2026-10-07T03:00:00Z',
    })).toThrow('DIRECTOR_PREMIUM_UGC_RESULT_OUTPUT_REQUIRED');

    expect(()=>normalizeDirectorPremiumUgcProviderResult({
      request,
      providerJobId:'job:1',
      status:'failed',
      evidenceIds:['response:1'],
      observedAt:'2026-10-07T03:00:00Z',
    })).toThrow('DIRECTOR_PREMIUM_UGC_RESULT_ERROR_REQUIRED');
  });
});
