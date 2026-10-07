import { describe, expect, it } from 'vitest';
import type { GeneratedAssetRecord } from './generated-asset-resolver.js';
import type { MediaReviewDecisionRecord } from './media-review-lifecycle.js';
import type { UgcProductionPlan } from './ugc-production.js';
import {
  applyDirectorUgcExperimentSelection,
  applyDirectorUgcVariantOutcome,
  buildDirectorUgcBatchExperiment,
  issueDirectorUgcVariantOutcome,
} from './ugc-batch-experiment.js';

function plan():UgcProductionPlan{
  return {
    id:'ugc:serum:1',
    projectId:'ads',
    platform:'tiktok',
    aspectRatio:'9:16',
    targetRuntimeSeconds:30,
    product:{
      brandName:'Nalvori',
      productName:'Morning Serum',
      productBibleId:'product:nalvori:serum',
      targetAudience:'women in their 20s who want a simple morning routine',
      valuePropositionRefs:['claim:light-feel','claim:simple-routine'],
      prohibitedClaimRefs:['claim:treats-acne'],
      requiredClaimEvidenceIds:['evidence:brand-copy'],
      referenceAssetIds:['asset:serum-front','asset:serum-open'],
      referenceEvidenceIds:['evidence:product-sheet'],
    },
    creatorCandidates:[
      {
        id:'creator:1',
        creatorNature:'synthetic',
        characterRef:'character:ugc:1',
        audienceFitHypothesis:'relatable early-career morning-routine creator',
        appearanceDirection:['natural skin texture'],
        wardrobeDirection:['simple sleep tee'],
        referenceAssetIds:['asset:creator-sheet'],
        rightsEvidenceIds:['rights:synthetic-character'],
      },
      {
        id:'creator:2',
        creatorNature:'synthetic',
        characterRef:'character:ugc:2',
        audienceFitHypothesis:'busy-parent creator',
        appearanceDirection:['natural'],
        wardrobeDirection:['casual tee'],
        referenceAssetIds:['asset:creator-2'],
        rightsEvidenceIds:['rights:creator-2'],
      },
    ],
    locationCandidates:[
      {
        id:'location:bathroom',
        description:'small lived-in apartment bathroom in morning light',
        realismPurpose:'ordinary phone-recorded morning routine',
        referenceAssetIds:['asset:bathroom'],
        rightsEvidenceIds:['rights:generated-location'],
      },
      {
        id:'location:kitchen',
        description:'small lived-in apartment kitchen in morning light',
        realismPurpose:'ordinary breakfast routine',
        referenceAssetIds:['asset:kitchen'],
        rightsEvidenceIds:['rights:generated-kitchen'],
      },
    ],
    conceptOptions:[
      {
        id:'concept:routine',
        title:'Short morning routine',
        premise:'creator casually walks through the few steps she actually uses',
        format:'routine',
        productUse:'apply a few drops, then moisturizer and sunscreen',
        claimRefs:['claim:light-feel','claim:simple-routine'],
      },
      {
        id:'concept:review',
        title:'Quick review',
        premise:'creator gives a concise first-person product review',
        format:'review',
        productUse:'show bottle, apply a few drops, describe light feel',
        claimRefs:['claim:light-feel'],
      },
    ],
    scriptCandidates:[
      {
        id:'script:1',
        durationSeconds:30,
        spokenText:'I keep my morning routine pretty short. I use a few drops, then moisturizer and sunscreen.',
        pronunciationNotes:{Nalvori:'nal-VOR-ee'},
        performancePlan:{
          version:1,
          sceneFunction:'make the routine feel casual and useful',
          actors:[{actorId:'creator',startingState:'just woke up',endingState:'ready to get dressed'}],
          beats:[{
            id:'apply',
            kind:'action',
            actorId:'creator',
            action:'apply a few drops while continuing to talk',
            endState:'serum spread naturally across cheeks',
          }],
        },
        realismPlan:{
          version:1,
          goal:'phone-shot naturalism',
          naturalismCues:['skin-texture','breathing','nonuniform-motion'],
          physicalResponses:[],
        },
        claimRefs:['claim:light-feel'],
        disclosureLine:'Made with a virtual creator.',
      },
      {
        id:'script:2',
        durationSeconds:30,
        spokenText:'This feels light, fits into my simple routine, and takes only a few seconds to apply.',
        pronunciationNotes:{Nalvori:'nal-VOR-ee'},
        performancePlan:{
          version:1,
          sceneFunction:'deliver a concise testimonial',
          actors:[{actorId:'creator',startingState:'curious',endingState:'satisfied'}],
          beats:[{
            id:'show',
            kind:'action',
            actorId:'creator',
            action:'hold bottle briefly while talking',
            endState:'bottle returns to counter',
          }],
        },
        claimRefs:['claim:light-feel','claim:simple-routine'],
        disclosureLine:'Made with a virtual creator.',
      },
    ],
    approvals:[
      {id:'a1',stage:'product-reference',selectedRef:'product:nalvori:serum',approvedAt:'2026-09-22T00:00:00Z',approvedBy:'owner'},
      {id:'a2',stage:'creator',selectedRef:'creator:1',approvedAt:'2026-09-22T00:01:00Z',approvedBy:'owner'},
      {id:'a3',stage:'location',selectedRef:'location:bathroom',approvedAt:'2026-09-22T00:02:00Z',approvedBy:'owner'},
      {id:'a4',stage:'concept',selectedRef:'concept:routine',approvedAt:'2026-09-22T00:03:00Z',approvedBy:'owner'},
      {id:'a5',stage:'script',selectedRef:'script:1',approvedAt:'2026-09-22T00:04:00Z',approvedBy:'owner'},
      {id:'a6',stage:'generation-brief',selectedRef:'brief:1',approvedAt:'2026-09-22T00:05:00Z',approvedBy:'owner'},
    ],
    currentStage:'generation',
    syntheticDisclosurePolicy:'required',
    authority:'DIRECTOR_UGC_PLAN',
  };
}

function variantSpec(input:{
  id?:string;
  replacementRef?:string;
  stage?:'creator'|'location'|'concept'|'script';
}={}){
  const id=input.id??'variant:creator2';
  const replacementRef=input.replacementRef??'creator:2';
  const stage=input.stage??'creator';
  return {
    id,
    label:'treatment',
    replacementRef,
    hypothesis:'The alternate creator improves qualified response.',
    approval:{
      stageApproval:{
        id:`approval:${id}:stage`,
        stage,
        selectedRef:replacementRef,
        approvedAt:'2026-10-07T02:00:00Z',
        approvedBy:'owner',
      },
      generationBriefApproval:{
        id:`approval:${id}:brief`,
        stage:'generation-brief' as const,
        selectedRef:id,
        approvedAt:'2026-10-07T02:01:00Z',
        approvedBy:'owner',
      },
      evidenceIds:[`evidence:${id}:approval`],
    },
    evidenceIds:[`evidence:${id}`],
  };
}

function creatorExperiment(){
  return buildDirectorUgcBatchExperiment({
    id:'experiment:creator',
    controlVariantId:'variant:control',
    controlPlan:plan(),
    mutationAxis:'creator',
    variants:[variantSpec()],
    hypothesis:'Creator fit changes response while product, setting, concept and script remain fixed.',
    evidenceIds:['growth:hypothesis:creator'],
  });
}

function asset(
  variantId:string,
  id:string,
  jobId:string,
  shaChar:string,
):GeneratedAssetRecord{
  return {
    id,
    projectId:'ads',
    generationJobId:jobId,
    providerId:'local-musetalk',
    mediaType:'video',
    uri:`file:///${id}.mp4`,
    sha256:shaChar.repeat(64),
    createdAt:'2026-10-07T03:00:00Z',
    metadata:{
      ugcExperimentId:'experiment:creator',
      ugcVariantId:variantId,
    },
  };
}

function review(assetRecord:GeneratedAssetRecord,id:string):MediaReviewDecisionRecord{
  return {
    id,
    projectId:'ads',
    runId:'run:1',
    gateId:'gate:review',
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
      projectId:'ads',
      storyboardBoardIds:['board:1'],
      storyboardVersion:1,
      generationStageId:'gen',
      generationStageVersion:1,
      generationJobId:assetRecord.generationJobId,
    },
  };
}

describe('Director UGC batch experiments',()=>{
  it('builds a single-axis creator batch while preserving all fixed UGC dimensions',()=>{
    const experiment=creatorExperiment();
    expect(experiment.growthExperimentMode).toBe('causal-compatible');
    expect(experiment.controlMutationRef).toBe('creator:1');
    expect(experiment.treatments).toHaveLength(1);
    expect(experiment.treatments[0]?.generationBrief.creatorRef).toBe('character:ugc:2');
    expect(experiment.treatments[0]?.generationBrief.conceptId).toBe('concept:routine');
    expect(experiment.treatments[0]?.generationBrief.scriptId).toBe('script:1');
    expect(experiment.fixedDimensionRefs).toMatchObject({
      productBibleId:'product:nalvori:serum',
      platform:'tiktok',
      aspectRatio:'9:16',
      locationRef:'location:bathroom',
      conceptRef:'concept:routine',
      scriptRef:'script:1',
    });
    expect(experiment.creativeExperiment.variants.map(item=>item.id))
      .toEqual(['variant:control','variant:creator2']);
  });

  it('requires explicit mutation-stage and generation-brief approvals for each treatment',()=>{
    const spec=variantSpec();
    spec.approval.stageApproval={...spec.approval.stageApproval,selectedRef:'creator:1'};
    expect(()=>buildDirectorUgcBatchExperiment({
      id:'experiment:bad-approval',
      controlVariantId:'control',
      controlPlan:plan(),
      mutationAxis:'creator',
      variants:[spec],
      hypothesis:'test',
      evidenceIds:['evidence:experiment'],
    })).toThrow('DIRECTOR_UGC_EXPERIMENT_MUTATION_APPROVAL_MISMATCH');
  });

  it('rejects unknown replacements and duplicate replacement refs',()=>{
    expect(()=>buildDirectorUgcBatchExperiment({
      id:'experiment:unknown',
      controlVariantId:'control',
      controlPlan:plan(),
      mutationAxis:'creator',
      variants:[variantSpec({replacementRef:'creator:missing'})],
      hypothesis:'test',
      evidenceIds:['evidence:experiment'],
    })).toThrow('DIRECTOR_UGC_EXPERIMENT_REPLACEMENT_UNKNOWN');

    const one=variantSpec();
    const two=variantSpec({id:'variant:creator2-b'});
    expect(()=>buildDirectorUgcBatchExperiment({
      id:'experiment:duplicate-ref',
      controlVariantId:'control',
      controlPlan:plan(),
      mutationAxis:'creator',
      variants:[one,two],
      hypothesis:'test',
      evidenceIds:['evidence:experiment'],
    })).toThrow('DIRECTOR_UGC_EXPERIMENT_REPLACEMENT_DUPLICATE');
  });

  it('re-runs canonical UGC readiness and rejects a treatment script with an unapproved claim',()=>{
    const p=plan();
    p.scriptCandidates=[...p.scriptCandidates,{
      ...p.scriptCandidates[1]!,
      id:'script:bad',
      claimRefs:['claim:treats-acne'],
    }];
    expect(()=>buildDirectorUgcBatchExperiment({
      id:'experiment:bad-script',
      controlVariantId:'control',
      controlPlan:p,
      mutationAxis:'script',
      variants:[variantSpec({id:'variant:bad-script',replacementRef:'script:bad',stage:'script'})],
      hypothesis:'test',
      evidenceIds:['evidence:experiment'],
    })).toThrow('DIRECTOR_UGC_EXPERIMENT_VARIANT_NOT_READY');
  });

  it('caps the batch at twenty treatment variants',()=>{
    const p=plan();
    p.creatorCandidates=[
      ...p.creatorCandidates,
      ...Array.from({length:20},(_,i)=>({
        ...p.creatorCandidates[1]!,
        id:`creator:extra:${i}`,
        characterRef:`character:extra:${i}`,
        referenceAssetIds:[`asset:creator-extra:${i}`],
        rightsEvidenceIds:[`rights:creator-extra:${i}`],
      })),
    ];
    const specs=Array.from({length:21},(_,i)=>{
      const replacementRef=i===0?'creator:2':`creator:extra:${i-1}`;
      return variantSpec({id:`variant:${i}`,replacementRef});
    });
    expect(()=>buildDirectorUgcBatchExperiment({
      id:'experiment:too-many',
      controlVariantId:'control',
      controlPlan:p,
      mutationAxis:'creator',
      variants:specs,
      hypothesis:'test',
      evidenceIds:['evidence:experiment'],
    })).toThrow('DIRECTOR_UGC_EXPERIMENT_BATCH_LIMIT_EXCEEDED');
  });

  it('marks concept and script families exploratory instead of pretending they are isolated causal tests',()=>{
    const concept=buildDirectorUgcBatchExperiment({
      id:'experiment:concept',
      controlVariantId:'control',
      controlPlan:plan(),
      mutationAxis:'concept',
      variants:[variantSpec({id:'variant:concept',replacementRef:'concept:review',stage:'concept'})],
      hypothesis:'A different concept may change response.',
      evidenceIds:['evidence:concept'],
    });
    const script=buildDirectorUgcBatchExperiment({
      id:'experiment:script',
      controlVariantId:'control',
      controlPlan:plan(),
      mutationAxis:'script',
      variants:[variantSpec({id:'variant:script',replacementRef:'script:2',stage:'script'})],
      hypothesis:'A different script may change response.',
      evidenceIds:['evidence:script'],
    });
    expect(concept.growthExperimentMode).toBe('exploratory-only');
    expect(script.growthExperimentMode).toBe('exploratory-only');
  });

  it('issues an outcome only for an approved asset explicitly bound to the exact experiment variant',()=>{
    const experiment=creatorExperiment();
    const treatmentAsset=asset('variant:creator2','asset:treatment','job:treatment','b');
    const receipt=issueDirectorUgcVariantOutcome({
      id:'outcome:treatment',
      plan:experiment,
      variantId:'variant:creator2',
      asset:treatmentAsset,
      review:review(treatmentAsset,'review:treatment'),
      acceptedOutputCostUsd:2.75,
      costEvidenceIds:['economics:treatment'],
      experimentEvidenceIds:['experiment:receipt:treatment'],
    });
    expect(receipt.artifactSha256).toBe('b'.repeat(64));
    expect(receipt.acceptedOutputCostUsd).toBe(2.75);

    const wrong={...treatmentAsset,metadata:{ugcExperimentId:'experiment:creator',ugcVariantId:'variant:control'}};
    expect(()=>issueDirectorUgcVariantOutcome({
      id:'outcome:wrong',
      plan:experiment,
      variantId:'variant:creator2',
      asset:wrong,
      review:review(wrong,'review:wrong'),
      acceptedOutputCostUsd:2.75,
      costEvidenceIds:['economics:treatment'],
      experimentEvidenceIds:['experiment:receipt:treatment'],
    })).toThrow('DIRECTOR_UGC_EXPERIMENT_OUTCOME_VARIANT_LINEAGE_MISMATCH');
  });

  it('records accepted artifacts/cost evidence and requires explicit evidence-backed selection',()=>{
    const planResult=creatorExperiment();
    const controlAsset=asset('variant:control','asset:control','job:control','a');
    const controlOutcome=issueDirectorUgcVariantOutcome({
      id:'outcome:control',
      plan:planResult,
      variantId:'variant:control',
      asset:controlAsset,
      review:review(controlAsset,'review:control'),
      acceptedOutputCostUsd:1.5,
      costEvidenceIds:['economics:control'],
      experimentEvidenceIds:['growth:control'],
    });

    expect(()=>applyDirectorUgcExperimentSelection(planResult.creativeExperiment,{
      experimentId:planResult.id,
      selectedVariantId:'variant:control',
      selectedBy:'owner',
      selectedAt:'2026-10-07T04:00:00Z',
      selectionEvidenceRefs:['growth:result'],
      authority:'DIRECTOR_UGC_EXPERIMENT_SELECTION',
    })).toThrow('DIRECTOR_UGC_EXPERIMENT_SELECTION_ACCEPTED_ARTIFACT_REQUIRED');

    const updated=applyDirectorUgcVariantOutcome(planResult.creativeExperiment,controlOutcome);
    expect(updated.status).toBe('running');
    expect(updated.variants[0]?.artifactIds).toEqual(['asset:control']);
    expect(updated.variants[0]?.notes).toContain('accepted-output-cost-usd:1.500000');

    const selected=applyDirectorUgcExperimentSelection(updated,{
      experimentId:planResult.id,
      selectedVariantId:'variant:control',
      selectedBy:'owner',
      selectedAt:'2026-10-07T04:00:00Z',
      selectionEvidenceRefs:['growth:result'],
      authority:'DIRECTOR_UGC_EXPERIMENT_SELECTION',
    });
    expect(selected.status).toBe('completed');
    expect(selected.selectedVariantId).toBe('variant:control');
    expect(selected.evidenceRefs).toContain('growth:result');
  });
});
