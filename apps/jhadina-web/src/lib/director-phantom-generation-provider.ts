import { createHash } from 'node:crypto';
import type {
  GenerationProvider,
  GenerationProviderRecord,
  GenerationRequest,
  GenerationResult,
  GenerationSubmissionOptions,
  ModelRecord,
} from '@jhadina/director-core';
import {
  DirectorPhantomVideoProvider,
  type DirectorPhantomWorkerResult,
} from '@/lib/director-phantom-video-provider';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

function safePathSegment(value:string):string{
  return value.replace(/[^a-zA-Z0-9._-]/g,'_');
}

function deterministicSeed(value:string):number{
  let hash=2166136261;
  for(let index=0;index<value.length;index+=1){
    hash^=value.charCodeAt(index);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0)&0x7fffffff;
}

function mappedStatus(status:DirectorPhantomWorkerResult['status']):GenerationResult['status']{
  if(status==='ready') return 'completed';
  if(status==='processing') return 'running';
  if(status==='cancelled') return 'cancelled';
  if(status==='failed') return 'failed';
  return 'queued';
}

function referenceRole(role:GenerationRequest['references'] extends Array<infer T>|undefined ? T extends {role:infer R}?R:never:never){
  switch(role){
    case 'character': return 'character' as const;
    case 'product': return 'product' as const;
    case 'location': return 'environment' as const;
    default: return 'prop' as const;
  }
}

export function phantomModelRecords(providerId='phantom-wan'):ModelRecord[]{
  return [
    {
      id:'phantom-wan-1.3b',
      providerId,
      name:'Phantom-Wan 1.3B',
      version:process.env.PHANTOM_MODEL_VERSION_1_3B??'Phantom-Wan-1.3B',
      modalities:['video'],
      capabilities:['image-to-video','subject-to-video','multi-subject-reference','identity-preserving-video','temporal-subject-consistency'],
      baseModel:'Wan2.1-T2V-1.3B',
      metadata:{
        intendedUse:'rehearsal-draft',
        maximumReferenceImages:4,
        supportedSizes:['832*480'],
        upstream:'Phantom-video/Phantom',
      },
    },
    {
      id:'phantom-wan-14b',
      providerId,
      name:'Phantom-Wan 14B',
      version:process.env.PHANTOM_MODEL_VERSION_14B??'Phantom-Wan-14B',
      modalities:['video'],
      capabilities:['image-to-video','subject-to-video','multi-subject-reference','identity-preserving-video','product-reference-video','temporal-subject-consistency'],
      baseModel:'Wan2.1-T2V-1.3B',
      metadata:{
        intendedUse:'final-take',
        maximumReferenceImages:4,
        supportedSizes:['832*480','1280*720'],
        nativeFps:24,
        upstream:'Phantom-video/Phantom',
      },
    },
  ];
}

export class PhantomDirectorGenerationProvider implements GenerationProvider{
  readonly descriptor:GenerationProviderRecord;
  readonly submissionGuarantee='strong-idempotent' as const;

  constructor(
    private readonly worker:DirectorPhantomVideoProvider,
    providerId='phantom-wan',
  ){
    const models=phantomModelRecords(providerId);
    this.descriptor={
      id:providerId,
      name:'Director Phantom-Wan',
      kind:'api',
      capabilities:[...new Set(models.flatMap(model=>model.capabilities))],
      models:models.map(model=>model.id),
      health:'unknown',
      metadata:{
        productionQualityEligible:true,
        upstream:'Phantom-video/Phantom',
        execution:'shot-take-only',
      },
    };
  }

  private buildInput(request:GenerationRequest){
    if(request.modality!=='video') throw new Error('DIRECTOR_PHANTOM_VIDEO_MODALITY_REQUIRED');
    if(request.model.id!=='phantom-wan-1.3b'&&request.model.id!=='phantom-wan-14b'){
      throw new Error(`DIRECTOR_PHANTOM_MODEL_UNSUPPORTED:${request.model.id}`);
    }
    const references=(request.references??[]).filter(reference=>reference.media!=='video'&&reference.role!=='audio');
    if(!references.length) throw new Error('DIRECTOR_PHANTOM_REFERENCE_REQUIRED');
    if(references.length>4) throw new Error('DIRECTOR_PHANTOM_REFERENCE_COUNT_INVALID');
    const phantomReferences=references.map((reference,index)=>{
      if(!reference.uri) throw new Error(`DIRECTOR_PHANTOM_REFERENCE_URI_REQUIRED:${reference.assetId}`);
      if(!reference.sha256) throw new Error(`DIRECTOR_PHANTOM_REFERENCE_HASH_REQUIRED:${reference.assetId}`);
      return {
        id:`reference:${index+1}:${reference.assetId}`,
        role:referenceRole(reference.role),
        assetId:reference.assetId,
        uri:reference.uri,
        sha256:reference.sha256,
        description:reference.semanticLabel??`${reference.role} reference ${reference.assetId}`,
        evidenceIds:reference.evidenceIds?.length?[...reference.evidenceIds]:[`director-reference:${reference.assetId}`],
      };
    });
    const duration=Number(request.parameters.targetRuntimeSeconds??5);
    if(!Number.isFinite(duration)||duration<=0||duration>10) throw new Error('DIRECTOR_PHANTOM_SHOT_DURATION_INVALID');
    const requestedSeed=request.parameters.seed;
    const seed=typeof requestedSeed==='number'&&Number.isInteger(requestedSeed)&&requestedSeed>=0
      ? requestedSeed
      : deterministicSeed(request.requestId);
    return {
      requestId:request.requestId,
      projectId:request.projectId,
      purpose:request.model.id==='phantom-wan-14b'?'final-take' as const:'draft' as const,
      prompt:request.prompt,
      references:phantomReferences,
      durationSeconds:duration,
      seed,
      model:request.model.id,
      ...(request.parameters.phantomSize==='832*480'||request.parameters.phantomSize==='1280*720'
        ? {size:request.parameters.phantomSize} : {}),
      ...(request.parameters.phantomFps===16||request.parameters.phantomFps===24
        ? {fps:request.parameters.phantomFps} : {}),
      ...(request.parameters.sampleSolver==='unipc'||request.parameters.sampleSolver==='dpm++'
        ? {sampleSolver:request.parameters.sampleSolver} : {}),
      ...(typeof request.parameters.sampleSteps==='number'?{sampleSteps:request.parameters.sampleSteps}:{}),
      ...(typeof request.parameters.imageGuidanceScale==='number'?{imageGuidanceScale:request.parameters.imageGuidanceScale}:{}),
      ...(typeof request.parameters.textGuidanceScale==='number'?{textGuidanceScale:request.parameters.textGuidanceScale}:{}),
    };
  }

  private async ingestReady(state:DirectorPhantomWorkerResult):Promise<GenerationResult>{
    if(!state.requestId||!state.projectId) throw new Error('DIRECTOR_PHANTOM_RUNTIME_LINEAGE_MISSING');
    if(!state.runtimeReceiptId||!state.modelVersion||!state.outputSha256){
      throw new Error('DIRECTOR_PHANTOM_RUNTIME_RECEIPT_INCOMPLETE');
    }
    const media=await this.worker.download(state.providerJobId);
    if(!media.bytes.byteLength) throw new Error('DIRECTOR_PHANTOM_EMPTY_OUTPUT');
    if(!media.contentType.toLowerCase().includes('video')) throw new Error('DIRECTOR_PHANTOM_OUTPUT_MIME_INVALID');
    const actualSha=createHash('sha256').update(media.bytes).digest('hex');
    if(actualSha.toLowerCase()!==state.outputSha256.toLowerCase()){
      throw new Error('DIRECTOR_PHANTOM_OUTPUT_HASH_MISMATCH');
    }
    const client=createServiceRoleClient();
    if(!client) throw new Error('DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED');
    const objectPath=[
      'generation',
      safePathSegment(state.projectId),
      safePathSegment(state.requestId),
      'phantom-final.mp4',
    ].join('/');
    const {error}=await client.storage.from('director-media').upload(objectPath,media.bytes,{
      contentType:media.contentType,
      upsert:false,
    });
    if(error&&!String(error.message).toLowerCase().includes('already exists')) throw error;
    const uri=`storage://director-media/${objectPath}`;
    return {
      requestId:state.requestId,
      providerId:this.descriptor.id,
      status:'completed',
      assetIds:[`${state.requestId}:phantom-output`],
      providerJobId:state.providerJobId,
      metadata:{
        outputs:[{
          uri,
          mediaType:'video',
          mimeType:media.contentType,
          sha256:actualSha,
          metadata:{
            model:state.model,
            modelVersion:state.modelVersion,
            productionRuntimeReceiptId:state.runtimeReceiptId,
            providerQualityClaim:state.qualityClaim??false,
            storageBucket:'director-media',
            objectPath,
          },
        }],
        model:state.model,
        modelVersion:state.modelVersion,
        productionRuntimeReceiptId:state.runtimeReceiptId,
        outputSha256:actualSha,
      },
    };
  }

  async submit(request:GenerationRequest,options?:GenerationSubmissionOptions):Promise<GenerationResult>{
    const input=this.buildInput(request);
    const state=await this.worker.submit(input,options?.idempotencyKey??request.requestId);
    if(state.status==='ready') return this.ingestReady(state);
    return {
      requestId:request.requestId,
      providerId:this.descriptor.id,
      status:mappedStatus(state.status),
      assetIds:[],
      providerJobId:state.providerJobId,
      ...(state.error?{error:state.error}:{}),
      metadata:{
        model:state.model??input.model,
        modelVersion:state.modelVersion??request.model.version,
        productionRuntimeReceiptId:state.runtimeReceiptId,
      },
    };
  }

  async status(providerJobId:string):Promise<GenerationResult>{
    const state=await this.worker.status(providerJobId);
    if(state.status==='ready') return this.ingestReady(state);
    return {
      requestId:state.requestId??providerJobId,
      providerId:this.descriptor.id,
      status:mappedStatus(state.status),
      assetIds:[],
      providerJobId,
      ...(state.error?{error:state.error}:{}),
      metadata:{
        model:state.model,
        modelVersion:state.modelVersion,
        productionRuntimeReceiptId:state.runtimeReceiptId,
      },
    };
  }

  async cancel(providerJobId:string):Promise<void>{
    await this.worker.cancel(providerJobId);
  }
}
