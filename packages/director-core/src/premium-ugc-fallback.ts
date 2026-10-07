import type {
  DirectorHumanMediaBackendProfile,
  DirectorHumanMediaBillingModel,
  DirectorHumanMediaExecutionTier,
  DirectorHumanMediaRuntimePolicy,
} from './local-human-media-stack.js';
import {
  directorHumanMediaProfile,
  evaluateDirectorHumanMediaCommercialReadiness,
} from './local-human-media-stack.js';
import type {
  GenerationCostEstimate,
  GenerationSpendAuthorization,
} from './generation-spend-gate.js';
import { authorizeGenerationSpend } from './generation-spend-gate.js';
import type { UgcProductionPlan } from './ugc-production.js';
import {
  compileUgcGenerationBrief,
  evaluateUgcGenerationReadiness,
} from './ugc-production.js';

export type DirectorPremiumUgcProviderId = 'muapi-premium' | 'arcads-premium';

export type DirectorPremiumUgcFallbackReason =
  | 'local-unavailable'
  | 'local-qc-exhausted'
  | 'local-runtime-incompatible';

export interface DirectorPremiumUgcProviderBinding {
  id: string;
  providerId: DirectorPremiumUgcProviderId;
  executionTier: Extract<DirectorHumanMediaExecutionTier,'metered-external-api'|'subscription-saas'>;
  billingModel: Extract<DirectorHumanMediaBillingModel,'metered-api'|'subscription'>;
  providerModelRef: string;
  credentialRef: string;
  submitEndpointRef: string;
  statusEndpointRef: string;
  cancelEndpointRef?: string;
  externalServiceEvidenceIds: readonly string[];
  dataHandlingEvidenceIds: readonly string[];
  pricingEvidenceIds: readonly string[];
}

export interface DirectorPremiumUgcFallbackRequest {
  schema: 'director.premium-ugc-fallback-request.v1';
  id: string;
  projectId: string;
  ugcPlanId: string;
  providerId: DirectorPremiumUgcProviderId;
  bindingId: string;
  providerModelRef: string;
  fallbackReason: DirectorPremiumUgcFallbackReason;
  localAttemptEvidenceIds: readonly string[];
  prompt: string;
  referenceAssetIds: readonly string[];
  productBibleId: string;
  creatorRef: string;
  conceptId: string;
  scriptId: string;
  idempotencyKey: string;
  costEstimate: GenerationCostEstimate;
  spendAuthorization: GenerationSpendAuthorization;
  endpointRefs: Readonly<{
    submit: string;
    status: string;
    cancel?: string;
  }>;
  credentialRef: string;
  evidenceIds: readonly string[];
  qualityClaim: false;
  authority: 'DIRECTOR_PREMIUM_UGC_FALLBACK_REQUEST';
  publicationAuthority: 'NONE';
}

export interface DirectorPremiumUgcProviderResult {
  schema: 'director.premium-ugc-provider-result.v1';
  requestId: string;
  providerId: DirectorPremiumUgcProviderId;
  providerJobId: string;
  status: 'queued'|'processing'|'ready'|'failed'|'cancelled';
  outputUris: readonly string[];
  evidenceIds: readonly string[];
  observedAt: string;
  error?: string;
  qualityClaim: false;
  authority: 'DIRECTOR_PREMIUM_UGC_PROVIDER_RESULT';
}

export interface DirectorPremiumUgcTransport {
  submit(
    request: DirectorPremiumUgcFallbackRequest,
  ): Promise<DirectorPremiumUgcProviderResult>;
  status(
    request: DirectorPremiumUgcFallbackRequest,
    providerJobId: string,
  ): Promise<DirectorPremiumUgcProviderResult>;
  cancel(
    request: DirectorPremiumUgcFallbackRequest,
    providerJobId: string,
  ): Promise<void>;
}

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))];
}

function validIso(value:string):boolean{
  return Number.isFinite(Date.parse(value));
}

function allowedByPolicy(
  binding:DirectorPremiumUgcProviderBinding,
  policy:DirectorHumanMediaRuntimePolicy,
):boolean{
  if(binding.executionTier==='metered-external-api')return policy.allowMeteredExternalApi;
  return policy.allowSubscriptionSaas;
}

function providerProfile(
  providerId:DirectorPremiumUgcProviderId,
):DirectorHumanMediaBackendProfile{
  const profile=directorHumanMediaProfile(providerId);
  if(!profile)throw new Error('DIRECTOR_PREMIUM_UGC_PROVIDER_PROFILE_MISSING');
  if(profile.role!=='whole-ugc-generation'||profile.integrationMode!=='worker-candidate'){
    throw new Error('DIRECTOR_PREMIUM_UGC_PROVIDER_PROFILE_INVALID');
  }
  return profile;
}

function validateBinding(
  binding:DirectorPremiumUgcProviderBinding,
  profile:DirectorHumanMediaBackendProfile,
):readonly string[]{
  const reasons:string[]=[];
  if(!binding.id.trim()||!binding.providerModelRef.trim()||!binding.credentialRef.trim()){
    reasons.push('DIRECTOR_PREMIUM_UGC_BINDING_IDENTITY_REQUIRED');
  }
  if(binding.providerId!==profile.id){
    reasons.push('DIRECTOR_PREMIUM_UGC_BINDING_PROVIDER_MISMATCH');
  }
  if(!profile.executionTiers.includes(binding.executionTier)){
    reasons.push('DIRECTOR_PREMIUM_UGC_BINDING_TIER_MISMATCH');
  }
  if(binding.billingModel!==profile.billingModel){
    reasons.push('DIRECTOR_PREMIUM_UGC_BINDING_BILLING_MISMATCH');
  }
  if(!binding.submitEndpointRef.trim()||!binding.statusEndpointRef.trim()){
    reasons.push('DIRECTOR_PREMIUM_UGC_ENDPOINT_REQUIRED');
  }
  if(!binding.externalServiceEvidenceIds.length){
    reasons.push('DIRECTOR_PREMIUM_UGC_SERVICE_EVIDENCE_REQUIRED');
  }
  if(!binding.dataHandlingEvidenceIds.length){
    reasons.push('DIRECTOR_PREMIUM_UGC_DATA_HANDLING_EVIDENCE_REQUIRED');
  }
  if(!binding.pricingEvidenceIds.length){
    reasons.push('DIRECTOR_PREMIUM_UGC_PRICING_EVIDENCE_REQUIRED');
  }
  return Object.freeze(unique(reasons));
}

export function prepareDirectorPremiumUgcFallback(input:{
  id:string;
  plan:UgcProductionPlan;
  providerId:DirectorPremiumUgcProviderId;
  binding:DirectorPremiumUgcProviderBinding;
  runtimePolicy:DirectorHumanMediaRuntimePolicy;
  fallbackReason:DirectorPremiumUgcFallbackReason;
  localAttemptEvidenceIds:readonly string[];
  costEstimate:GenerationCostEstimate;
  spendAuthorization:GenerationSpendAuthorization;
  idempotencyKey:string;
  evidenceIds:readonly string[];
}):DirectorPremiumUgcFallbackRequest{
  const reasons:string[]=[];
  if(!input.id.trim()||!input.idempotencyKey.trim()){
    reasons.push('DIRECTOR_PREMIUM_UGC_REQUEST_IDENTITY_REQUIRED');
  }
  if(!input.localAttemptEvidenceIds.length){
    reasons.push('DIRECTOR_PREMIUM_UGC_LOCAL_ATTEMPT_EVIDENCE_REQUIRED');
  }
  if(!input.evidenceIds.length){
    reasons.push('DIRECTOR_PREMIUM_UGC_REQUEST_EVIDENCE_REQUIRED');
  }

  const profile=providerProfile(input.providerId);
  reasons.push(...validateBinding(input.binding,profile));
  if(input.binding.providerId!==input.providerId){
    reasons.push('DIRECTOR_PREMIUM_UGC_PROVIDER_BINDING_MISMATCH');
  }
  if(!allowedByPolicy(input.binding,input.runtimePolicy)){
    reasons.push('DIRECTOR_PREMIUM_UGC_PAID_TIER_NOT_AUTHORIZED');
  }

  const commercial=evaluateDirectorHumanMediaCommercialReadiness(profile,{
    externalServiceEvidenceIds:input.binding.externalServiceEvidenceIds,
  });
  reasons.push(...commercial.reasons.map(reason=>`DIRECTOR_PREMIUM_UGC:${reason}`));

  const readiness=evaluateUgcGenerationReadiness(input.plan);
  if(!readiness.ready){
    reasons.push(...readiness.reasons.map(reason=>`DIRECTOR_PREMIUM_UGC:${reason}`));
  }

  if(input.costEstimate.projectId!==input.plan.projectId){
    reasons.push('DIRECTOR_PREMIUM_UGC_COST_PROJECT_MISMATCH');
  }
  if(input.costEstimate.provider!==input.providerId){
    reasons.push('DIRECTOR_PREMIUM_UGC_COST_PROVIDER_MISMATCH');
  }
  if(input.costEstimate.modelId!==input.binding.providerModelRef){
    reasons.push('DIRECTOR_PREMIUM_UGC_COST_MODEL_MISMATCH');
  }
  if(!input.binding.pricingEvidenceIds.includes(input.costEstimate.pricingSourceRef)){
    reasons.push('DIRECTOR_PREMIUM_UGC_COST_SOURCE_NOT_ADMITTED');
  }
  const spend=authorizeGenerationSpend(input.costEstimate,input.spendAuthorization);
  reasons.push(...spend.reasons.map(reason=>`DIRECTOR_PREMIUM_UGC:${reason}`));

  const uniqueReasons=unique(reasons);
  if(uniqueReasons.length)throw new Error(uniqueReasons.join(';'));

  const brief=compileUgcGenerationBrief(input.plan);
  return Object.freeze({
    schema:'director.premium-ugc-fallback-request.v1',
    id:input.id,
    projectId:input.plan.projectId,
    ugcPlanId:input.plan.id,
    providerId:input.providerId,
    bindingId:input.binding.id,
    providerModelRef:input.binding.providerModelRef,
    fallbackReason:input.fallbackReason,
    localAttemptEvidenceIds:Object.freeze(unique(input.localAttemptEvidenceIds)),
    prompt:brief.prompt,
    referenceAssetIds:Object.freeze([...brief.referenceAssetIds]),
    productBibleId:brief.productBibleId,
    creatorRef:brief.creatorRef,
    conceptId:brief.conceptId,
    scriptId:brief.scriptId,
    idempotencyKey:input.idempotencyKey.trim(),
    costEstimate:Object.freeze({
      ...input.costEstimate,
      assumptions:Object.freeze([...input.costEstimate.assumptions]),
    }),
    spendAuthorization:Object.freeze({...input.spendAuthorization}),
    endpointRefs:Object.freeze({
      submit:input.binding.submitEndpointRef,
      status:input.binding.statusEndpointRef,
      ...(input.binding.cancelEndpointRef?{cancel:input.binding.cancelEndpointRef}:{}),
    }),
    credentialRef:input.binding.credentialRef,
    evidenceIds:Object.freeze(unique([
      ...input.evidenceIds,
      ...input.localAttemptEvidenceIds,
      ...input.binding.externalServiceEvidenceIds,
      ...input.binding.dataHandlingEvidenceIds,
      ...input.binding.pricingEvidenceIds,
      `cost-estimate:${input.costEstimate.id}`,
    ])),
    qualityClaim:false,
    authority:'DIRECTOR_PREMIUM_UGC_FALLBACK_REQUEST',
    publicationAuthority:'NONE',
  });
}

export function normalizeDirectorPremiumUgcProviderResult(input:{
  request:DirectorPremiumUgcFallbackRequest;
  providerJobId:string;
  status:DirectorPremiumUgcProviderResult['status'];
  outputUris?:readonly string[];
  evidenceIds:readonly string[];
  observedAt:string;
  error?:string;
}):DirectorPremiumUgcProviderResult{
  if(!input.providerJobId.trim())throw new Error('DIRECTOR_PREMIUM_UGC_RESULT_JOB_REQUIRED');
  if(!input.evidenceIds.length)throw new Error('DIRECTOR_PREMIUM_UGC_RESULT_EVIDENCE_REQUIRED');
  if(!validIso(input.observedAt))throw new Error('DIRECTOR_PREMIUM_UGC_RESULT_TIME_INVALID');
  const outputs=unique(input.outputUris??[]);
  if(input.status==='ready'&&!outputs.length){
    throw new Error('DIRECTOR_PREMIUM_UGC_RESULT_OUTPUT_REQUIRED');
  }
  if(input.status==='failed'&&!input.error?.trim()){
    throw new Error('DIRECTOR_PREMIUM_UGC_RESULT_ERROR_REQUIRED');
  }
  return Object.freeze({
    schema:'director.premium-ugc-provider-result.v1',
    requestId:input.request.id,
    providerId:input.request.providerId,
    providerJobId:input.providerJobId,
    status:input.status,
    outputUris:Object.freeze(outputs),
    evidenceIds:Object.freeze(unique(input.evidenceIds)),
    observedAt:input.observedAt,
    ...(input.error?.trim()?{error:input.error.trim()}:{}),
    qualityClaim:false,
    authority:'DIRECTOR_PREMIUM_UGC_PROVIDER_RESULT',
  });
}

export function assertDirectorPremiumUgcResultLineage(input:{
  request:DirectorPremiumUgcFallbackRequest;
  result:DirectorPremiumUgcProviderResult;
}):void{
  if(input.result.requestId!==input.request.id){
    throw new Error('DIRECTOR_PREMIUM_UGC_RESULT_REQUEST_MISMATCH');
  }
  if(input.result.providerId!==input.request.providerId){
    throw new Error('DIRECTOR_PREMIUM_UGC_RESULT_PROVIDER_MISMATCH');
  }
  if(input.result.qualityClaim!==false){
    throw new Error('DIRECTOR_PREMIUM_UGC_RESULT_QUALITY_CLAIM_FORBIDDEN');
  }
}
