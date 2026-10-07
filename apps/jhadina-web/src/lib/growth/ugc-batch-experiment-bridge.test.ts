import { describe, expect, it } from 'vitest';
import {
  buildDirectorUgcBatchExperiment,
  issueDirectorUgcVariantOutcome,
  type DirectorUgcBatchExperimentPlan,
  type GeneratedAssetRecord,
  type MediaReviewDecisionRecord,
  type UgcProductionPlan,
} from '@jhadina/director-core';
import { bridgeDirectorUgcBatchToGrowth } from './ugc-batch-experiment-bridge';

function basePlan():UgcProductionPlan{
  const performancePlan={
    version:1 as const,
    sceneFunction:'natural short-form testimonial',
    actors:[{actorId:'creator',startingState:'neutral',endingState:'confident'}],
    beats:[{
      id:'beat:1',
      kind:'action' as const,
      actorId:'creator',
      action:'show the bottle while talking',
      endState:'bottle rests on counter',
    }],
  };
  return {
    id:'ugc:serum:growth',
    projectId:'director:ads',
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
    creatorCandidates:[
      {
        id:'creator:1',
        creatorNature:'synthetic',
        characterRef:'character:1',
        audienceFitHypothesis:'young professional',
        appearanceDirection:['natural'],
        wardrobeDirection:['casual'],
        referenceAssetIds:['asset:creator:1'],
        rightsEvidenceIds:['rights:creator:1'],
      },
      {
        id:'creator:2',
        creatorNature:'synthetic',
        characterRef:'character:2',
        audienceFitHypothesis:'busy parent',
        appearanceDirection:['natural'],
        wardrobeDirection:['casual'],
        referenceAssetIds:['asset:creator:2'],
        rightsEvidenceIds:['rights:creator:2'],
      },
    ],
    locationCandidates:[{
      id:'location:1',
      description:'small apartment bathroom',
      realismPurpose:'native phone-shot setting',
      referenceAssetIds:['asset:location'],
      rightsEvidenceIds:['rights:location'],
    }],
    conceptOptions:[
      {
        id:'concept:1',
        title:'Routine',
        premise:'quick morning routine',
        format:'routine',
        productUse:'apply a few drops',
        claimRefs:['claim:light-feel'],
      },
      {
        id:'concept:2',
        title:'Review',
        premise:'quick product review',
        format:'review',
        productUse:'show bottle and apply',
        claimRefs:['claim:light-feel'],
      },
    ],
    scriptCandidates:[{
      id:'script:1',
      durationSeconds:30,
      spokenText:'This feels light and fits into my morning routine.',
      pronunciationNotes:{},
      performancePlan,
      claimRefs:['claim:light-feel'],
      disclosureLine:'Made with a virtual creator.',
    }],
    approvals:[
      {id:'a1',stage:'product-reference',selectedRef:'product:nalvori:serum',approvedAt:'2026-10-07T01:00:00Z',approvedBy:'owner'},
      {id:'a2',stage:'creator',selectedRef:'creator:1',approvedAt:'2026-10-07T01:01:00Z',approvedBy:'owner'},
      {id:'a3',stage:'location',selectedRef:'location:1',approvedAt:'2026-10-07T01:02:00Z',approvedBy:'owner'},
      {id:'a4',stage:'concept',selectedRef:'concept:1',approvedAt:'2026-10-07T01:03:00Z',approvedBy:'owner'},
      {id:'a5',stage:'script',selectedRef:'script:1',approvedAt:'2026-10-07T01:04:00Z',approvedBy:'owner'},
      {id:'a6',stage:'generation-brief',selectedRef:'brief:control',approvedAt:'2026-10-07T01:05:00Z',approvedBy:'owner'},
    ],
    currentStage:'generation',
    syntheticDisclosurePolicy:'required',
    authority:'DIRECTOR_UGC_PLAN',
  };
}

function buildCreatorExperiment(){
  return buildDirectorUgcBatchExperiment({
    id:'experiment:creator-growth',
    controlVariantId:'variant:control',
    controlPlan:basePlan(),
    mutationAxis:'creator',
    variants:[{
      id:'variant:creator2',
      label:'busy-parent creator',
      replacementRef:'creator:2',
      hypothesis:'The busy-parent creator improves response.',
      approval:{
        stageApproval:{
          id:'approval:creator2',
          stage:'creator',
          selectedRef:'creator:2',
          approvedAt:'2026-10-07T02:00:00Z',
          approvedBy:'owner',
        },
        generationBriefApproval:{
          id:'approval:creator2:brief',
          stage:'generation-brief',
          selectedRef:'variant:creator2',
          approvedAt:'2026-10-07T02:01:00Z',
          approvedBy:'owner',
        },
        evidenceIds:['approval-evidence:creator2'],
      },
      evidenceIds:['variant-evidence:creator2'],
    }],
    hypothesis:'Creator identity is the only production variable.',
    evidenceIds:['experiment-evidence:creator'],
  });
}

function buildConceptExperiment(){
  return buildDirectorUgcBatchExperiment({
    id:'experiment:concept-growth',
    controlVariantId:'variant:control',
    controlPlan:basePlan(),
    mutationAxis:'concept',
    variants:[{
      id:'variant:concept2',
      label:'review concept',
      replacementRef:'concept:2',
      hypothesis:'The review concept may improve response.',
      approval:{
        stageApproval:{
          id:'approval:concept2',
          stage:'concept',
          selectedRef:'concept:2',
          approvedAt:'2026-10-07T02:00:00Z',
          approvedBy:'owner',
        },
        generationBriefApproval:{
          id:'approval:concept2:brief',
          stage:'generation-brief',
          selectedRef:'variant:concept2',
          approvedAt:'2026-10-07T02:01:00Z',
          approvedBy:'owner',
        },
        evidenceIds:['approval-evidence:concept2'],
      },
      evidenceIds:['variant-evidence:concept2'],
    }],
    hypothesis:'Explore an alternate concept without claiming isolated causality.',
    evidenceIds:['experiment-evidence:concept'],
  });
}

function asset(
  plan:DirectorUgcBatchExperimentPlan,
  variantId:string,
  suffix:string,
  shaChar:string,
):GeneratedAssetRecord{
  return {
    id:`asset:${suffix}`,
    projectId:plan.projectId,
    generationJobId:`job:${suffix}`,
    providerId:'local',
    mediaType:'video',
    uri:`file:///${suffix}.mp4`,
    sha256:shaChar.repeat(64),
    createdAt:'2026-10-07T03:00:00Z',
    metadata:{ugcExperimentId:plan.id,ugcVariantId:variantId},
  };
}

function review(assetRecord:GeneratedAssetRecord):MediaReviewDecisionRecord{
  return {
    id:`review:${assetRecord.id}`,
    projectId:assetRecord.projectId,
    runId:'run:1',
    gateId:'gate:1',
    generationStageId:'gen',
    generationStageVersion:1,
    reviewStageId:'review',
    reviewStageVersion:1,
    assetId:assetRecord.id,
    generationJobId:assetRecord.generationJobId,
    decision:'approved',
    evidenceIds:[`watch:${assetRecord.id}`],
    decidedBy:'owner',
    decidedAt:'2026-10-07T03:05:00Z',
    provenance:{
      projectId:assetRecord.projectId,
      storyboardBoardIds:['board:1'],
      storyboardVersion:1,
      generationStageId:'gen',
      generationStageVersion:1,
      generationJobId:assetRecord.generationJobId,
    },
  };
}

function outcomes(plan:DirectorUgcBatchExperimentPlan){
  return [
    ['variant:control','control','a',1.25],
    [plan.treatments[0]!.id,'treatment','b',2.5],
  ].map(([variantId,suffix,shaChar,cost])=>{
    const a=asset(plan,String(variantId),String(suffix),String(shaChar));
    return issueDirectorUgcVariantOutcome({
      id:`outcome:${suffix}`,
      plan,
      variantId:String(variantId),
      asset:a,
      review:review(a),
      acceptedOutputCostUsd:Number(cost),
      costEvidenceIds:[`economics:${suffix}`],
      experimentEvidenceIds:[`experiment:${suffix}`],
    });
  });
}

describe('Director UGC -> Growth experiment bridge',()=>{
  it('creates a causal-compatible Growth experiment for an isolated creator batch',()=>{
    const plan=buildCreatorExperiment();
    const bridged=bridgeDirectorUgcBatchToGrowth({
      plan,
      outcomes:outcomes(plan),
      contentProjectId:'content:ugc:1',
      styleIdentityRef:'style:ugc:native',
      evidenceRefs:['growth:bridge:1'],
      policy:{minimumExposuresPerVariant:500,minimumConversionsPerVariant:10},
    });

    expect(bridged.mode).toBe('causal-compatible');
    expect(bridged.growthPlan?.mutationAxis).toBe('character');
    expect(bridged.growthPlan?.controlVariantId).toBe('variant:control');
    expect(bridged.growthPlan?.treatmentVariantIds).toEqual(['variant:creator2']);
    expect(bridged.lineages).toHaveLength(2);
    expect(bridged.lineages.every(item=>item.productIdentityRef==='product:nalvori:serum')).toBe(true);
    expect(bridged.lineages.every(item=>item.styleIdentityRef==='style:ugc:native')).toBe(true);
    expect(bridged.lineages[1]?.controlVariantId).toBe('variant:control');
    expect(bridged.lineages[1]?.evidenceRefs).toContain('accepted-output-cost-usd:2.500000');
    expect(bridged.lineages[0]?.fixedDimensionRefs).toMatchObject({
      locationRef:'location:1',
      conceptRef:'concept:1',
      scriptRef:'script:1',
      ugcExperimentId:'experiment:creator-growth',
    });
  });

  it('rejects incomplete accepted-output lineage instead of inventing a Growth experiment',()=>{
    const plan=buildCreatorExperiment();
    expect(()=>bridgeDirectorUgcBatchToGrowth({
      plan,
      outcomes:outcomes(plan).slice(0,1),
      contentProjectId:'content:ugc:1',
      styleIdentityRef:'style:ugc:native',
      evidenceRefs:['growth:bridge:1'],
    })).toThrow('GROWTH_UGC_EXPERIMENT_OUTCOME_MISSING:variant:creator2');
  });

  it('rejects outcome receipts from another Director experiment',()=>{
    const plan=buildCreatorExperiment();
    const receipt={...outcomes(plan)[0]!,experimentId:'experiment:foreign'};
    expect(()=>bridgeDirectorUgcBatchToGrowth({
      plan,
      outcomes:[receipt,outcomes(plan)[1]!],
      contentProjectId:'content:ugc:1',
      styleIdentityRef:'style:ugc:native',
      evidenceRefs:['growth:bridge:1'],
    })).toThrow('GROWTH_UGC_EXPERIMENT_OUTCOME_LINEAGE_MISMATCH');
  });

  it('keeps concept batches exploratory rather than fabricating an isolated causal A/B test',()=>{
    const plan=buildConceptExperiment();
    const bridged=bridgeDirectorUgcBatchToGrowth({
      plan,
      outcomes:outcomes(plan),
      contentProjectId:'content:ugc:2',
      styleIdentityRef:'style:ugc:native',
      evidenceRefs:['growth:bridge:concept'],
    });
    expect(bridged.mode).toBe('exploratory-only');
    expect(bridged.growthPlan).toBeUndefined();
    expect(bridged.reasons).toContain('GROWTH_UGC_EXPERIMENT_EXPLORATORY_ONLY');
    expect(bridged.lineages.every(item=>item.mutationAxis==='net_new_concept')).toBe(true);
  });
});
