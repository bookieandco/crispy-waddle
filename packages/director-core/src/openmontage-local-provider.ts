import type {WholeVideoProductionBrief,WholeVideoProductionProvider,WholeVideoProviderDescriptor,WholeVideoProviderResult} from './whole-video-provider.js';

/** OpenMontage's upstream is AGENT-FIRST, not a stable remote /generate endpoint.
 * This interface is implemented only by a separately audited, operator-owned
 * agent runner that executes its production stages. Nothing calls cloud providers.
 */
export type OpenMontageSource = {
  assetId:string; sha256:string; rightsReceiptId:string; ownerApproved:boolean;
  kind:'original-video'|'licensed-footage'|'approved-image';
};
export type OpenMontageLocalManifest={
  schema:'director.openmontage.local.v1'; projectId:string; jobId:string;
  idempotencyKey:string; prompt:string; aspectRatio:'1:1'|'9:16'|'16:9';
  runtime:'operator-owned-local'; remoteApiCallsAllowed:false;
  providerPolicy:'local-only'; sourceAssets:readonly OpenMontageSource[];
  plannedSceneCount:number; renderWorkflow:'documentary-montage';
  gate:'storyboard-review-required';
};
const SHA=/^[0-9a-f]{64}$/i;
export function buildOpenMontageLocalManifest(input:{
  brief:WholeVideoProductionBrief;idempotencyKey:string;sources:readonly OpenMontageSource[];
}):OpenMontageLocalManifest {
  if(!input.brief.jobId.trim()||!input.brief.projectId.trim()||!input.idempotencyKey.trim())
    throw new Error('OPENMONTAGE_DURABLE_DIRECTOR_AUTHORITY_REQUIRED');
  if(input.brief.narration||input.brief.character||input.brief.product)
    throw new Error('OPENMONTAGE_CANONICAL_IDENTITY_AND_CHARACTER_SUPPORT_NOT_CERTIFIED');
  if(!input.sources.length||input.sources.some(a=>!a.assetId.trim()||!SHA.test(a.sha256)||
    !a.rightsReceiptId.trim()||!a.ownerApproved))
    throw new Error('OPENMONTAGE_APPROVED_ORIGINAL_LICENSED_MEDIA_REQUIRED');
  if(!input.brief.intent.commercialSafeOnly||input.brief.intent.providerPolicy.allowPaidWithoutApproval)
    throw new Error('OPENMONTAGE_LOCAL_ONLY_POLICY_REQUIRED');
  return Object.freeze({
    schema:'director.openmontage.local.v1' as const,
    jobId:input.brief.jobId,projectId:input.brief.projectId,idempotencyKey:input.idempotencyKey,
    prompt:input.brief.prompt,aspectRatio:input.brief.intent.aspectRatio,
    runtime:'operator-owned-local' as const,remoteApiCallsAllowed:false as const,
    providerPolicy:'local-only' as const,sourceAssets:input.sources.map(a=>({...a})),
    plannedSceneCount:Math.max(1,input.brief.scenes?.length??1),
    renderWorkflow:'documentary-montage' as const,
    gate:'storyboard-review-required' as const,
  });
}

export interface OpenMontageOperatorBridge{
  /** Must execute reviewed OpenMontage stages, not claim a nonexistent upstream API. */
  submit(manifest:OpenMontageLocalManifest):Promise<{jobId:string;status:'queued'|'processing'}>;
  status(jobId:string):Promise<WholeVideoProviderResult>;
  download(jobId:string):Promise<{bytes:Uint8Array;contentType:string}>;
  cancel(jobId:string):Promise<void>;
}
export class OpenMontageLocalProductionProvider implements WholeVideoProductionProvider {
  readonly descriptor:WholeVideoProviderDescriptor={
    id:'openmontage-local',
    name:'OpenMontage Local Agent Production',
    costClass:'free-local',supportedModes:['short','standard','faceless','long-form'],
    health:'unknown',
    supportsCanonicalNarrationIdentity:false,
    supportsProductReference:false,
    supportsCharacterReference:false,
    productionQualityEligible:false,
  };
  constructor(private readonly bridge:OpenMontageOperatorBridge,
    private readonly findApprovedSources:(brief:WholeVideoProductionBrief)=>Promise<readonly OpenMontageSource[]>){}
  async submit(brief:WholeVideoProductionBrief,idempotencyKey:string):Promise<WholeVideoProviderResult>{
    const sources=await this.findApprovedSources(brief);
    const manifest=buildOpenMontageLocalManifest({brief,idempotencyKey,sources});
    const result=await this.bridge.submit(manifest);
    if(!result.jobId.trim())throw new Error('OPENMONTAGE_OPERATOR_JOB_ID_REQUIRED');
    return {providerJobId:result.jobId,status:result.status,qualityClaim:false,
      metadata:{runtime:'local-operator',storyboardReviewRequired:true,sourceCount:sources.length}};
  }
  status(jobId:string){return this.bridge.status(jobId);}
  async download(jobId:string){
    const state=await this.bridge.status(jobId);
    if(state.status!=='ready'||!state.resultUri)
      throw new Error('OPENMONTAGE_RENDER_NOT_CERTIFIED_READY');
    const value=await this.bridge.download(jobId);
    if(!value.bytes.length||!['video/mp4','video/webm'].includes(value.contentType))
      throw new Error('OPENMONTAGE_OUTPUT_INVALID');
    return value;
  }
  cancel(jobId:string){return this.bridge.cancel(jobId);}
}
