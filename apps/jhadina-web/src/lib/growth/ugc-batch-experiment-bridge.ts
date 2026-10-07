import type {
  DirectorUgcBatchExperimentPlan,
  DirectorUgcVariantOutcomeReceipt,
} from '@jhadina/director-core';
import {
  buildIsolatedAdCreativeExperimentPlan,
  createAdCreativeVariantLineage,
  type AdCreativeExperimentPlan,
  type AdCreativeMutationAxis,
  type AdCreativePlatform,
  type AdCreativeVariantLineage,
} from '@jhadina/growth-core';

export interface DirectorUgcGrowthExperimentBridgePolicy {
  minimumExposuresPerVariant?: number;
  minimumConversionsPerVariant?: number;
  alpha?: number;
  minimumRelativeLift?: number;
}

export interface DirectorUgcGrowthExperimentBridgeResult {
  mode: 'causal-compatible' | 'exploratory-only';
  lineages: readonly AdCreativeVariantLineage[];
  growthPlan?: AdCreativeExperimentPlan;
  reasons: readonly string[];
  evidenceRefs: readonly string[];
  authority: 'DIRECTOR_UGC_GROWTH_EXPERIMENT_BRIDGE';
}

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))];
}

function growthPlatform(platform:DirectorUgcBatchExperimentPlan['control']['productionPlan']['platform']):AdCreativePlatform{
  switch(platform){
    case 'instagram-reels':return 'instagram';
    case 'youtube-shorts':return 'youtube';
    case 'facebook-reels':return 'facebook';
    case 'tiktok':return 'tiktok';
    case 'other':return 'other';
  }
}

function mutationAxis(plan:DirectorUgcBatchExperimentPlan):AdCreativeMutationAxis{
  switch(plan.mutationAxis){
    case 'creator':return 'character';
    case 'location':return 'visual_treatment';
    case 'concept':
    case 'script':
      return 'net_new_concept';
  }
}

function outcomeByVariant(
  plan:DirectorUgcBatchExperimentPlan,
  outcomes:readonly DirectorUgcVariantOutcomeReceipt[],
):Map<string,DirectorUgcVariantOutcomeReceipt>{
  const expected=new Set([
    plan.controlVariantId,
    ...plan.treatments.map(variant=>variant.id),
  ]);
  const mapped=new Map<string,DirectorUgcVariantOutcomeReceipt>();
  for(const outcome of outcomes){
    if(outcome.experimentId!==plan.id||outcome.projectId!==plan.projectId){
      throw new Error('GROWTH_UGC_EXPERIMENT_OUTCOME_LINEAGE_MISMATCH');
    }
    if(!expected.has(outcome.variantId)){
      throw new Error(`GROWTH_UGC_EXPERIMENT_OUTCOME_UNKNOWN_VARIANT:${outcome.variantId}`);
    }
    if(mapped.has(outcome.variantId)){
      throw new Error(`GROWTH_UGC_EXPERIMENT_OUTCOME_DUPLICATE:${outcome.variantId}`);
    }
    mapped.set(outcome.variantId,outcome);
  }
  for(const variantId of expected){
    if(!mapped.has(variantId)){
      throw new Error(`GROWTH_UGC_EXPERIMENT_OUTCOME_MISSING:${variantId}`);
    }
  }
  return mapped;
}

function variantById(plan:DirectorUgcBatchExperimentPlan,variantId:string){
  if(variantId===plan.control.id)return plan.control;
  return plan.treatments.find(variant=>variant.id===variantId);
}

export function bridgeDirectorUgcBatchToGrowth(input:{
  plan:DirectorUgcBatchExperimentPlan;
  outcomes:readonly DirectorUgcVariantOutcomeReceipt[];
  contentProjectId:string;
  styleIdentityRef:string;
  evidenceRefs:readonly string[];
  policy?:DirectorUgcGrowthExperimentBridgePolicy;
}):DirectorUgcGrowthExperimentBridgeResult{
  if(!input.contentProjectId.trim()||!input.styleIdentityRef.trim()){
    throw new Error('GROWTH_UGC_EXPERIMENT_BRIDGE_IDENTITY_REQUIRED');
  }
  if(!input.evidenceRefs.length){
    throw new Error('GROWTH_UGC_EXPERIMENT_BRIDGE_EVIDENCE_REQUIRED');
  }
  const outcomes=outcomeByVariant(input.plan,input.outcomes);
  const axis=mutationAxis(input.plan);
  const platform=growthPlatform(input.plan.control.productionPlan.platform);
  const variantIds=[
    input.plan.controlVariantId,
    ...input.plan.treatments.map(variant=>variant.id),
  ];

  const lineages=variantIds.map((variantId):AdCreativeVariantLineage=>{
    const variant=variantById(input.plan,variantId);
    const outcome=outcomes.get(variantId);
    if(!variant||!outcome)throw new Error('GROWTH_UGC_EXPERIMENT_VARIANT_BINDING_REQUIRED');

    const mutationRef=variantId===input.plan.controlVariantId
      ?input.plan.controlMutationRef
      :variant.replacementRef;
    if(!mutationRef)throw new Error('GROWTH_UGC_EXPERIMENT_MUTATION_REF_REQUIRED');

    const conceptId=input.plan.mutationAxis==='concept'&&variant.replacementRef
      ?variant.replacementRef
      :variant.generationBrief.conceptId;
    const evidenceRefs=unique([
      ...input.evidenceRefs,
      ...variant.evidenceIds,
      ...outcome.reviewEvidenceIds,
      ...outcome.costEvidenceIds,
      ...outcome.experimentEvidenceIds,
      `accepted-output-cost-usd:${outcome.acceptedOutputCostUsd.toFixed(6)}`,
    ]);

    return createAdCreativeVariantLineage({
      id:variant.id,
      contentProjectId:input.contentProjectId,
      conceptId,
      platform,
      productIdentityRef:variant.productionPlan.product.productBibleId,
      styleIdentityRef:input.styleIdentityRef,
      mutationAxis:axis,
      mutationRef,
      ...(variantId===input.plan.controlVariantId
        ?{}
        :{controlVariantId:input.plan.controlVariantId}),
      fixedDimensionRefs:Object.freeze({
        ...input.plan.fixedDimensionRefs,
        ugcExperimentId:input.plan.id,
      }),
      director:{
        directorProjectId:input.plan.projectId,
        directorArtifactId:outcome.artifactId,
        artifactSha256:outcome.artifactSha256,
        reviewDecisionId:outcome.reviewDecisionId,
        evidenceRefs:Object.freeze(unique([
          ...outcome.reviewEvidenceIds,
          ...outcome.experimentEvidenceIds,
          ...outcome.costEvidenceIds,
        ])),
      },
      evidenceRefs:Object.freeze(evidenceRefs),
      createdAt:outcome.acceptedAt,
    });
  });

  const control=lineages.find(lineage=>lineage.id===input.plan.controlVariantId);
  if(!control)throw new Error('GROWTH_UGC_EXPERIMENT_CONTROL_REQUIRED');
  const treatments=lineages.filter(lineage=>lineage.id!==input.plan.controlVariantId);
  const reasons:string[]=[];
  let growthPlan:AdCreativeExperimentPlan|undefined;

  if(input.plan.growthExperimentMode==='causal-compatible'){
    const hypotheses:Record<string,string>={};
    for(const treatment of input.plan.treatments)hypotheses[treatment.id]=treatment.hypothesis;
    growthPlan=buildIsolatedAdCreativeExperimentPlan({
      id:`growth:ugc:${input.plan.id}`,
      control,
      treatments,
      hypotheses,
      minimumExposuresPerVariant:input.policy?.minimumExposuresPerVariant,
      minimumConversionsPerVariant:input.policy?.minimumConversionsPerVariant,
      alpha:input.policy?.alpha,
      minimumRelativeLift:input.policy?.minimumRelativeLift,
      evidenceRefs:Object.freeze(unique([
        ...input.evidenceRefs,
        ...lineages.flatMap(lineage=>lineage.evidenceRefs),
      ])),
    });
  }else{
    reasons.push('GROWTH_UGC_EXPERIMENT_EXPLORATORY_ONLY');
  }

  return Object.freeze({
    mode:input.plan.growthExperimentMode,
    lineages:Object.freeze(lineages),
    ...(growthPlan?{growthPlan}:{}),
    reasons:Object.freeze(reasons),
    evidenceRefs:Object.freeze(unique([
      ...input.evidenceRefs,
      ...lineages.flatMap(lineage=>lineage.evidenceRefs),
    ])),
    authority:'DIRECTOR_UGC_GROWTH_EXPERIMENT_BRIDGE',
  });
}
