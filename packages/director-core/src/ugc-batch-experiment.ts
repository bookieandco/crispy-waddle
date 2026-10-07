import type {
  UgcApprovalReceipt,
  UgcProductionPlan,
  UgcGenerationReadiness,
} from './ugc-production.js';
import {
  compileUgcGenerationBrief,
  evaluateUgcGenerationReadiness,
} from './ugc-production.js';
import type {
  CreativeExperiment,
  CreativeVariant,
} from './creative-experiment.js';
import { validateCreativeExperiment } from './creative-experiment.js';
import type { GeneratedAssetRecord } from './generated-asset-resolver.js';
import type { MediaReviewDecisionRecord } from './media-review-lifecycle.js';

export type DirectorUgcExperimentMutationAxis =
  | 'creator'
  | 'location'
  | 'concept'
  | 'script';

export type DirectorUgcGrowthExperimentMode =
  | 'causal-compatible'
  | 'exploratory-only';

export interface DirectorUgcVariantApproval {
  stageApproval: UgcApprovalReceipt;
  generationBriefApproval: UgcApprovalReceipt;
  evidenceIds: readonly string[];
}

export interface DirectorUgcBatchVariantSpec {
  id: string;
  label: string;
  replacementRef: string;
  hypothesis: string;
  approval: DirectorUgcVariantApproval;
  evidenceIds: readonly string[];
}

export interface DirectorUgcVariantProductionPlan {
  id: string;
  experimentId: string;
  projectId: string;
  mutationAxis: DirectorUgcExperimentMutationAxis | 'control';
  replacementRef?: string;
  hypothesis: string;
  productionPlan: UgcProductionPlan;
  generationBrief: ReturnType<typeof compileUgcGenerationBrief>;
  fixedDimensionRefs: Readonly<Record<string,string>>;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_UGC_EXPERIMENT_VARIANT';
}

export interface DirectorUgcBatchExperimentPlan {
  id: string;
  projectId: string;
  controlVariantId: string;
  controlMutationRef: string;
  mutationAxis: DirectorUgcExperimentMutationAxis;
  growthExperimentMode: DirectorUgcGrowthExperimentMode;
  control: DirectorUgcVariantProductionPlan;
  treatments: readonly DirectorUgcVariantProductionPlan[];
  creativeExperiment: CreativeExperiment;
  fixedDimensionRefs: Readonly<Record<string,string>>;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_UGC_BATCH_EXPERIMENT';
}

export interface DirectorUgcVariantOutcomeReceipt {
  schema: 'director.ugc-variant-outcome.v1';
  id: string;
  projectId: string;
  experimentId: string;
  variantId: string;
  mutationAxis: DirectorUgcExperimentMutationAxis | 'control';
  artifactId: string;
  artifactSha256: string;
  generationJobId: string;
  reviewDecisionId: string;
  acceptedAt: string;
  acceptedOutputCostUsd: number;
  costEvidenceIds: readonly string[];
  reviewEvidenceIds: readonly string[];
  experimentEvidenceIds: readonly string[];
  authority: 'DIRECTOR_UGC_VARIANT_OUTCOME';
}

export interface DirectorUgcExperimentSelectionReceipt {
  experimentId: string;
  selectedVariantId: string;
  selectedBy: string;
  selectedAt: string;
  selectionEvidenceRefs: readonly string[];
  authority: 'DIRECTOR_UGC_EXPERIMENT_SELECTION';
}

export interface DirectorUgcBatchPolicy {
  maximumTreatmentVariants: number;
}

export const DIRECTOR_UGC_BATCH_POLICY: Readonly<DirectorUgcBatchPolicy> =
  Object.freeze({ maximumTreatmentVariants: 20 });

const SHA256_RE=/^(?:sha256:)?[a-f0-9]{64}$/i;

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))];
}

function validIso(value:string):boolean{
  return Number.isFinite(Date.parse(value));
}

function axisStage(axis:DirectorUgcExperimentMutationAxis):UgcApprovalReceipt['stage']{
  switch(axis){
    case 'creator':return 'creator';
    case 'location':return 'location';
    case 'concept':return 'concept';
    case 'script':return 'script';
  }
}

function growthMode(axis:DirectorUgcExperimentMutationAxis):DirectorUgcGrowthExperimentMode{
  return axis==='creator'||axis==='location'?'causal-compatible':'exploratory-only';
}

function selectedRefs(readiness:UgcGenerationReadiness):Readonly<Record<string,string>>{
  const {creator,location,concept,script}=readiness.selected;
  if(!creator||!location||!concept||!script)throw new Error('DIRECTOR_UGC_EXPERIMENT_CONTROL_SELECTION_REQUIRED');
  return Object.freeze({
    creator:creator.id,
    location:location.id,
    concept:concept.id,
    script:script.id,
  });
}

function fixedDimensions(
  plan:UgcProductionPlan,
  readiness:UgcGenerationReadiness,
  mutationAxis:DirectorUgcExperimentMutationAxis,
):Readonly<Record<string,string>>{
  const selected=selectedRefs(readiness);
  const dimensions:Record<string,string>={
    productBibleId:plan.product.productBibleId,
    platform:plan.platform,
    aspectRatio:plan.aspectRatio,
    targetRuntimeSeconds:String(plan.targetRuntimeSeconds),
    syntheticDisclosurePolicy:plan.syntheticDisclosurePolicy,
  };
  for(const [key,value] of Object.entries(selected)){
    if(key!==mutationAxis)dimensions[`${key}Ref`]=value;
  }
  return Object.freeze(dimensions);
}

function candidateExists(
  plan:UgcProductionPlan,
  axis:DirectorUgcExperimentMutationAxis,
  replacementRef:string,
):boolean{
  switch(axis){
    case 'creator':return plan.creatorCandidates.some(candidate=>candidate.id===replacementRef);
    case 'location':return plan.locationCandidates.some(candidate=>candidate.id===replacementRef);
    case 'concept':return plan.conceptOptions.some(candidate=>candidate.id===replacementRef);
    case 'script':return plan.scriptCandidates.some(candidate=>candidate.id===replacementRef);
  }
}

function selectedForAxis(
  readiness:UgcGenerationReadiness,
  axis:DirectorUgcExperimentMutationAxis,
):string{
  const refs=selectedRefs(readiness);
  return refs[axis]!;
}

function cloneApproval(approval:UgcApprovalReceipt):UgcApprovalReceipt{
  return Object.freeze({...approval});
}

function buildVariantPlan(
  base:UgcProductionPlan,
  experimentId:string,
  axis:DirectorUgcExperimentMutationAxis,
  fixed:Readonly<Record<string,string>>,
  spec:DirectorUgcBatchVariantSpec,
):DirectorUgcVariantProductionPlan{
  if(!spec.id.trim()||!spec.label.trim()||!spec.replacementRef.trim()||!spec.hypothesis.trim()){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_VARIANT_IDENTITY_REQUIRED');
  }
  if(!spec.evidenceIds.length||!spec.approval.evidenceIds.length){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_VARIANT_EVIDENCE_REQUIRED');
  }
  if(!candidateExists(base,axis,spec.replacementRef)){
    throw new Error(`DIRECTOR_UGC_EXPERIMENT_REPLACEMENT_UNKNOWN:${spec.replacementRef}`);
  }

  const expectedStage=axisStage(axis);
  if(
    spec.approval.stageApproval.stage!==expectedStage||
    spec.approval.stageApproval.selectedRef!==spec.replacementRef
  ){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_MUTATION_APPROVAL_MISMATCH');
  }
  if(
    spec.approval.generationBriefApproval.stage!=='generation-brief'||
    spec.approval.generationBriefApproval.selectedRef!==spec.id
  ){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_GENERATION_BRIEF_APPROVAL_MISMATCH');
  }
  for(const receipt of [spec.approval.stageApproval,spec.approval.generationBriefApproval]){
    if(!receipt.id.trim()||!receipt.approvedBy.trim()||!validIso(receipt.approvedAt)){
      throw new Error('DIRECTOR_UGC_EXPERIMENT_APPROVAL_RECEIPT_INVALID');
    }
  }

  const approvals=base.approvals
    .filter(receipt=>receipt.stage!==expectedStage&&receipt.stage!=='generation-brief')
    .map(cloneApproval);
  approvals.push(cloneApproval(spec.approval.stageApproval));
  approvals.push(cloneApproval(spec.approval.generationBriefApproval));

  const productionPlan:UgcProductionPlan=Object.freeze({
    ...base,
    id:`${base.id}:experiment:${experimentId}:variant:${spec.id}`,
    approvals:Object.freeze(approvals),
    currentStage:'generation',
  });
  const readiness=evaluateUgcGenerationReadiness(productionPlan);
  if(!readiness.ready){
    throw new Error(`DIRECTOR_UGC_EXPERIMENT_VARIANT_NOT_READY:${readiness.reasons.join(',')}`);
  }

  return Object.freeze({
    id:spec.id,
    experimentId,
    projectId:base.projectId,
    mutationAxis:axis,
    replacementRef:spec.replacementRef,
    hypothesis:spec.hypothesis.trim(),
    productionPlan,
    generationBrief:compileUgcGenerationBrief(productionPlan),
    fixedDimensionRefs:Object.freeze({...fixed}),
    evidenceIds:Object.freeze(unique([
      ...spec.evidenceIds,
      ...spec.approval.evidenceIds,
      `ugc-stage-approval:${spec.approval.stageApproval.id}`,
      `ugc-generation-brief-approval:${spec.approval.generationBriefApproval.id}`,
    ])),
    authority:'DIRECTOR_UGC_EXPERIMENT_VARIANT',
  });
}

function creativeVariant(
  variant:DirectorUgcVariantProductionPlan,
  label:string,
):CreativeVariant{
  return Object.freeze({
    id:variant.id,
    label,
    artifactIds:Object.freeze([]),
    generationAttemptIds:Object.freeze([]),
    notes:Object.freeze(unique([
      `ugc-experiment:${variant.experimentId}`,
      `ugc-mutation-axis:${variant.mutationAxis}`,
      ...(variant.replacementRef?[`ugc-replacement:${variant.replacementRef}`]:[]),
      `ugc-hypothesis:${variant.hypothesis}`,
    ])),
  });
}

export function buildDirectorUgcBatchExperiment(input:{
  id:string;
  controlVariantId:string;
  controlPlan:UgcProductionPlan;
  mutationAxis:DirectorUgcExperimentMutationAxis;
  variants:readonly DirectorUgcBatchVariantSpec[];
  hypothesis:string;
  evidenceIds:readonly string[];
  policy?:DirectorUgcBatchPolicy;
}):DirectorUgcBatchExperimentPlan{
  const policy=input.policy??DIRECTOR_UGC_BATCH_POLICY;
  if(!input.id.trim()||!input.controlVariantId.trim()||!input.hypothesis.trim()){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_IDENTITY_REQUIRED');
  }
  if(!input.evidenceIds.length)throw new Error('DIRECTOR_UGC_EXPERIMENT_EVIDENCE_REQUIRED');
  if(
    !Number.isInteger(policy.maximumTreatmentVariants)||
    policy.maximumTreatmentVariants<1||
    policy.maximumTreatmentVariants>20
  )throw new Error('DIRECTOR_UGC_EXPERIMENT_BATCH_POLICY_INVALID');
  if(!input.variants.length)throw new Error('DIRECTOR_UGC_EXPERIMENT_TREATMENTS_REQUIRED');
  if(input.variants.length>policy.maximumTreatmentVariants){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_BATCH_LIMIT_EXCEEDED');
  }

  const controlReadiness=evaluateUgcGenerationReadiness(input.controlPlan);
  if(!controlReadiness.ready){
    throw new Error(`DIRECTOR_UGC_EXPERIMENT_CONTROL_NOT_READY:${controlReadiness.reasons.join(',')}`);
  }
  const controlSelected=selectedForAxis(controlReadiness,input.mutationAxis);
  const fixed=fixedDimensions(input.controlPlan,controlReadiness,input.mutationAxis);
  const ids=new Set<string>([input.controlVariantId]);
  const replacementRefs=new Set<string>();
  const treatments=input.variants.map(spec=>{
    if(ids.has(spec.id))throw new Error('DIRECTOR_UGC_EXPERIMENT_VARIANT_DUPLICATE');
    ids.add(spec.id);
    if(spec.replacementRef===controlSelected){
      throw new Error('DIRECTOR_UGC_EXPERIMENT_VARIANT_EQUALS_CONTROL');
    }
    if(replacementRefs.has(spec.replacementRef)){
      throw new Error('DIRECTOR_UGC_EXPERIMENT_REPLACEMENT_DUPLICATE');
    }
    replacementRefs.add(spec.replacementRef);
    return buildVariantPlan(input.controlPlan,input.id,input.mutationAxis,fixed,spec);
  });

  const control:DirectorUgcVariantProductionPlan=Object.freeze({
    id:input.controlVariantId,
    experimentId:input.id,
    projectId:input.controlPlan.projectId,
    mutationAxis:'control',
    hypothesis:input.hypothesis.trim(),
    productionPlan:input.controlPlan,
    generationBrief:compileUgcGenerationBrief(input.controlPlan),
    fixedDimensionRefs:Object.freeze({...fixed}),
    evidenceIds:Object.freeze(unique([
      ...input.evidenceIds,
      ...input.controlPlan.approvals.map(receipt=>`ugc-control-approval:${receipt.id}`),
    ])),
    authority:'DIRECTOR_UGC_EXPERIMENT_VARIANT',
  });

  const creativeExperiment:CreativeExperiment=Object.freeze({
    id:input.id,
    projectId:input.controlPlan.projectId,
    hypothesis:input.hypothesis.trim(),
    variable:`ugc:${input.mutationAxis}`,
    status:'planned',
    variants:Object.freeze([
      creativeVariant(control,'control'),
      ...treatments.map((variant,index)=>creativeVariant(variant,input.variants[index]!.label)),
    ]),
    evidenceRefs:Object.freeze(unique([
      ...input.evidenceIds,
      ...control.evidenceIds,
      ...treatments.flatMap(variant=>variant.evidenceIds),
    ])),
  });
  const creativeValidation=validateCreativeExperiment(creativeExperiment);
  if(!creativeValidation.valid){
    throw new Error(`DIRECTOR_UGC_EXPERIMENT_CREATIVE_CONTRACT_INVALID:${creativeValidation.reasons.join(',')}`);
  }

  return Object.freeze({
    id:input.id,
    projectId:input.controlPlan.projectId,
    controlVariantId:input.controlVariantId,
    controlMutationRef:controlSelected,
    mutationAxis:input.mutationAxis,
    growthExperimentMode:growthMode(input.mutationAxis),
    control,
    treatments:Object.freeze(treatments),
    creativeExperiment,
    fixedDimensionRefs:Object.freeze({...fixed}),
    evidenceIds:Object.freeze(unique([
      ...input.evidenceIds,
      ...creativeExperiment.evidenceRefs,
    ])),
    authority:'DIRECTOR_UGC_BATCH_EXPERIMENT',
  });
}

function findVariant(
  plan:DirectorUgcBatchExperimentPlan,
  variantId:string,
):DirectorUgcVariantProductionPlan|undefined{
  if(plan.control.id===variantId)return plan.control;
  return plan.treatments.find(variant=>variant.id===variantId);
}

function normalizeSha(value:string):string{
  return value.trim().toLowerCase().replace(/^sha256:/,'');
}

export function issueDirectorUgcVariantOutcome(input:{
  id:string;
  plan:DirectorUgcBatchExperimentPlan;
  variantId:string;
  asset:GeneratedAssetRecord;
  review:MediaReviewDecisionRecord;
  acceptedOutputCostUsd:number;
  costEvidenceIds:readonly string[];
  experimentEvidenceIds:readonly string[];
}):DirectorUgcVariantOutcomeReceipt{
  const variant=findVariant(input.plan,input.variantId);
  if(!variant)throw new Error('DIRECTOR_UGC_EXPERIMENT_OUTCOME_VARIANT_UNKNOWN');
  if(!input.id.trim())throw new Error('DIRECTOR_UGC_EXPERIMENT_OUTCOME_ID_REQUIRED');
  if(input.asset.projectId!==input.plan.projectId||input.review.projectId!==input.plan.projectId){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_OUTCOME_PROJECT_MISMATCH');
  }
  if(input.review.decision!=='approved'){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_OUTCOME_NOT_APPROVED');
  }
  if(input.review.assetId!==input.asset.id||input.review.generationJobId!==input.asset.generationJobId){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_OUTCOME_REVIEW_LINEAGE_MISMATCH');
  }
  if(!input.asset.sha256||!SHA256_RE.test(input.asset.sha256.trim())){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_OUTCOME_SHA256_REQUIRED');
  }
  if(!input.review.evidenceIds.length){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_OUTCOME_REVIEW_EVIDENCE_REQUIRED');
  }
  if(!Number.isFinite(input.acceptedOutputCostUsd)||input.acceptedOutputCostUsd<0){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_OUTCOME_COST_INVALID');
  }
  if(!input.costEvidenceIds.length){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_OUTCOME_COST_EVIDENCE_REQUIRED');
  }
  if(!input.experimentEvidenceIds.length){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_OUTCOME_EXPERIMENT_EVIDENCE_REQUIRED');
  }
  if(!validIso(input.review.decidedAt)){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_OUTCOME_REVIEW_TIME_INVALID');
  }

  return Object.freeze({
    schema:'director.ugc-variant-outcome.v1',
    id:input.id,
    projectId:input.plan.projectId,
    experimentId:input.plan.id,
    variantId:variant.id,
    mutationAxis:variant.mutationAxis,
    artifactId:input.asset.id,
    artifactSha256:normalizeSha(input.asset.sha256),
    generationJobId:input.asset.generationJobId,
    reviewDecisionId:input.review.id,
    acceptedAt:input.review.decidedAt,
    acceptedOutputCostUsd:input.acceptedOutputCostUsd,
    costEvidenceIds:Object.freeze(unique(input.costEvidenceIds)),
    reviewEvidenceIds:Object.freeze(unique(input.review.evidenceIds)),
    experimentEvidenceIds:Object.freeze(unique(input.experimentEvidenceIds)),
    authority:'DIRECTOR_UGC_VARIANT_OUTCOME',
  });
}

export function applyDirectorUgcVariantOutcome(
  experiment:CreativeExperiment,
  receipt:DirectorUgcVariantOutcomeReceipt,
):CreativeExperiment{
  if(experiment.id!==receipt.experimentId||experiment.projectId!==receipt.projectId){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_OUTCOME_EXPERIMENT_MISMATCH');
  }
  const found=experiment.variants.some(variant=>variant.id===receipt.variantId);
  if(!found)throw new Error('DIRECTOR_UGC_EXPERIMENT_OUTCOME_VARIANT_UNKNOWN');

  const updated:CreativeExperiment=Object.freeze({
    ...experiment,
    status:experiment.status==='planned'?'running':experiment.status,
    variants:Object.freeze(experiment.variants.map(variant=>{
      if(variant.id!==receipt.variantId)return variant;
      return Object.freeze({
        ...variant,
        artifactIds:Object.freeze(unique([...variant.artifactIds,receipt.artifactId])),
        generationAttemptIds:Object.freeze(unique([...variant.generationAttemptIds,receipt.generationJobId])),
        notes:Object.freeze(unique([
          ...(variant.notes??[]),
          `accepted-output-cost-usd:${receipt.acceptedOutputCostUsd.toFixed(6)}`,
          `ugc-outcome:${receipt.id}`,
        ])),
      });
    })),
    evidenceRefs:Object.freeze(unique([
      ...experiment.evidenceRefs,
      ...receipt.costEvidenceIds,
      ...receipt.reviewEvidenceIds,
      ...receipt.experimentEvidenceIds,
      `ugc-variant-outcome:${receipt.id}`,
    ])),
  });
  const decision=validateCreativeExperiment(updated);
  if(!decision.valid)throw new Error(`DIRECTOR_UGC_EXPERIMENT_OUTCOME_UPDATE_INVALID:${decision.reasons.join(',')}`);
  return updated;
}

export function applyDirectorUgcExperimentSelection(
  experiment:CreativeExperiment,
  receipt:DirectorUgcExperimentSelectionReceipt,
):CreativeExperiment{
  if(receipt.experimentId!==experiment.id){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_SELECTION_EXPERIMENT_MISMATCH');
  }
  if(!receipt.selectedVariantId.trim()||!receipt.selectedBy.trim()||!validIso(receipt.selectedAt)){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_SELECTION_RECEIPT_INVALID');
  }
  if(!receipt.selectionEvidenceRefs.length){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_SELECTION_EVIDENCE_REQUIRED');
  }
  const selected=experiment.variants.find(variant=>variant.id===receipt.selectedVariantId);
  if(!selected)throw new Error('DIRECTOR_UGC_EXPERIMENT_SELECTION_VARIANT_UNKNOWN');
  if(!selected.artifactIds.length){
    throw new Error('DIRECTOR_UGC_EXPERIMENT_SELECTION_ACCEPTED_ARTIFACT_REQUIRED');
  }

  const updated:CreativeExperiment=Object.freeze({
    ...experiment,
    status:'completed',
    selectedVariantId:receipt.selectedVariantId,
    selectedBy:receipt.selectedBy,
    selectedAt:receipt.selectedAt,
    evidenceRefs:Object.freeze(unique([
      ...experiment.evidenceRefs,
      ...receipt.selectionEvidenceRefs,
      `ugc-experiment-selection:${receipt.selectedVariantId}`,
    ])),
  });
  const decision=validateCreativeExperiment(updated);
  if(!decision.valid)throw new Error(`DIRECTOR_UGC_EXPERIMENT_SELECTION_INVALID:${decision.reasons.join(',')}`);
  return updated;
}
