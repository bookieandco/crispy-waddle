import { createHash } from 'node:crypto';
import type {
  BuildHunyuanVideo15RequestInput,
  GenerationProvider,
  GenerationProviderRecord,
  GenerationRequest,
  GenerationResult,
  GenerationSubmissionOptions,
  ModelRecord,
  HunyuanVideo15Model,
} from '@jhadina/director-core';
import {
  DirectorHunyuanVideoProvider,
  type DirectorHunyuanWorkerResult,
} from '@/lib/director-hunyuan-video-provider';
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

function mappedStatus(status:DirectorHunyuanWorkerResult['status']):GenerationResult['status']{
  if(status==='ready') return 'completed';
  if(status==='processing') return 'running';
  if(status==='cancelled') return 'cancelled';
  if(status==='failed') return 'failed';
  return 'queued';
}

export function hunyuanVideo15ModelRecords(providerId='hunyuan-video-1.5'):ModelRecord[]{
  return [
    {
      id:'hunyuan-video-1.5-480p-i2v-step-distilled',
      providerId,
      name:'HunyuanVideo-1.5 480p I2V Step-Distilled',
      version:process.env.HUNYUAN_VIDEO_MODEL_VERSION??'HunyuanVideo-1.5',
      modalities:['video'],
      capabilities:['image-to-video','reference-first-frame','fast-draft-video','temporal-subject-consistency'],
      baseModel:'HunyuanVideo-1.5',
      metadata:{
        intendedUse:'draft-and-production-shot',
        resolution:'480p',
        defaultSteps:12,
        nativeFps:24,
        upstream:'Tencent-Hunyuan/HunyuanVideo-1.5',
      },
    },
    {
      id:'hunyuan-video-1.5-480p-i2v',
      providerId,
      name:'HunyuanVideo-1.5 480p I2V',
      version:process.env.HUNYUAN_VIDEO_MODEL_VERSION??'HunyuanVideo-1.5',
      modalities:['video'],
      capabilities:['image-to-video','reference-first-frame','temporal-subject-consistency'],
      baseModel:'HunyuanVideo-1.5',
      metadata:{resolution:'480p',upstream:'Tencent-Hunyuan/HunyuanVideo-1.5'},
    },
    {
      id:'hunyuan-video-1.5-720p-i2v',
      providerId,
      name:'HunyuanVideo-1.5 720p I2V',
      version:process.env.HUNYUAN_VIDEO_MODEL_VERSION??'HunyuanVideo-1.5',
      modalities:['video'],
      capabilities:['image-to-video','reference-first-frame','temporal-subject-consistency'],
      baseModel:'HunyuanVideo-1.5',
      metadata:{resolution:'720p',upstream:'Tencent-Hunyuan/HunyuanVideo-1.5'},
    },
    {
      id:'hunyuan-video-1.5-480p-t2v',
      providerId,
      name:'HunyuanVideo-1.5 480p T2V',
      version:process.env.HUNYUAN_VIDEO_MODEL_VERSION??'HunyuanVideo-1.5',
      modalities:['video'],
      capabilities:['text-to-video'],
      baseModel:'HunyuanVideo-1.5',
      metadata:{resolution:'480p',upstream:'Tencent-Hunyuan/HunyuanVideo-1.5'},
    },
    {
      id:'hunyuan-video-1.5-720p-t2v',
      providerId,
      name:'HunyuanVideo-1.5 720p T2V',
      version:process.env.HUNYUAN_VIDEO_MODEL_VERSION??'HunyuanVideo-1.5',
      modalities:['video'],
      capabilities:['text-to-video'],
      baseModel:'HunyuanVideo-1.5',
      metadata:{resolution:'720p',upstream:'Tencent-Hunyuan/HunyuanVideo-1.5'},
    },
  ];
}

export class HunyuanDirectorGenerationProvider implements GenerationProvider{
  readonly descriptor:GenerationProviderRecord;
  readonly submissionGuarantee='strong-idempotent' as const;

  constructor(
    private readonly worker:DirectorHunyuanVideoProvider,
    providerId='hunyuan-video-1.5',
  ){
    const models=hunyuanVideo15ModelRecords(providerId);
    this.descriptor={
      id:providerId,
      name:'Director HunyuanVideo-1.5',
      kind:'api',
      capabilities:[...new Set(models.flatMap(model=>model.capabilities))],
      models:models.map(model=>model.id),
      health:'unknown',
      metadata:{
        productionQualityEligible:true,
        upstream:'Tencent-Hunyuan/HunyuanVideo-1.5',
        execution:'shot-take-only',
      },
    };
  }

  private buildInput(request:GenerationRequest):BuildHunyuanVideo15RequestInput{
    if(request.modality!=='video') throw new Error('DIRECTOR_HUNYUAN_VIDEO_MODALITY_REQUIRED');
    const modelId=request.model.id;
    if(!hunyuanVideo15ModelRecords(this.descriptor.id).some(record=>record.id===modelId)){
      throw new Error(`DIRECTOR_HUNYUAN_MODEL_UNSUPPORTED:${modelId}`);
    }
    const model=modelId as HunyuanVideo15Model;

    const isI2v=model.includes('-i2v');
    const refs=(request.references??[]).filter(reference=>reference.media!=='video'&&reference.role!=='audio');
    const selected=isI2v?refs[0]:undefined;
    if(isI2v&&!selected) throw new Error('DIRECTOR_HUNYUAN_I2V_REFERENCE_REQUIRED');
    if(selected&&!selected.uri) throw new Error(`DIRECTOR_HUNYUAN_REFERENCE_URI_REQUIRED:${selected.assetId}`);
    if(selected&&!selected.sha256) throw new Error(`DIRECTOR_HUNYUAN_REFERENCE_HASH_REQUIRED:${selected.assetId}`);

    const requestedSeed=request.parameters.seed;
    const seed=typeof requestedSeed==='number'&&Number.isInteger(requestedSeed)&&requestedSeed>=0
      ? requestedSeed
      : deterministicSeed(request.requestId);

    const aspect=request.parameters.hunyuanAspectRatio;
    const aspectRatio=aspect==='9:16'||aspect==='1:1'||aspect==='16:9'?aspect:'16:9';

    const length=request.parameters.hunyuanVideoLength;
    const videoLength=typeof length==='number'&&Number.isInteger(length)?length:121;

    const steps=request.parameters.hunyuanInferenceSteps;
    const numInferenceSteps=typeof steps==='number'&&Number.isInteger(steps)?steps:undefined;

    return {
      requestId:request.requestId,
      projectId:request.projectId,
      model,
      prompt:request.prompt,
      negativePrompt:typeof request.parameters.negativePrompt==='string'?request.parameters.negativePrompt:undefined,
      ...(selected?{
        reference:{
          assetId:selected.assetId,
          uri:selected.uri!,
          sha256:selected.sha256!,
          semanticLabel:selected.semanticLabel??`${selected.role} reference ${selected.assetId}`,
          evidenceIds:selected.evidenceIds?.length?[...selected.evidenceIds]:[`director-reference:${selected.assetId}`],
        },
      }:{}),
      aspectRatio,
      videoLength,
      seed,
      ...(numInferenceSteps!==undefined?{numInferenceSteps}:{}),
      ...(typeof request.parameters.hunyuanEnableSuperResolution==='boolean'?{
        enableSuperResolution:request.parameters.hunyuanEnableSuperResolution,
      }:{}),
      ...(typeof request.parameters.hunyuanRewritePrompt==='boolean'?{
        rewritePrompt:request.parameters.hunyuanRewritePrompt,
      }:{}),
      offloading:true,
      groupOffloading:true,
      overlapGroupOffloading:false,
    };
  }

  private async ingestReady(state:DirectorHunyuanWorkerResult):Promise<GenerationResult>{
    if(!state.requestId||!state.projectId) throw new Error('DIRECTOR_HUNYUAN_RUNTIME_LINEAGE_MISSING');
    if(!state.runtimeReceiptId||!state.modelVersion||!state.outputSha256){
      throw new Error('DIRECTOR_HUNYUAN_RUNTIME_RECEIPT_INCOMPLETE');
    }
    const media=await this.worker.download(state.providerJobId);
    if(!media.bytes.byteLength) throw new Error('DIRECTOR_HUNYUAN_EMPTY_OUTPUT');
    if(!media.contentType.toLowerCase().includes('video')) throw new Error('DIRECTOR_HUNYUAN_OUTPUT_MIME_INVALID');

    const actualSha=createHash('sha256').update(media.bytes).digest('hex');
    if(actualSha.toLowerCase()!==state.outputSha256.toLowerCase()){
      throw new Error('DIRECTOR_HUNYUAN_OUTPUT_HASH_MISMATCH');
    }

    const client=createServiceRoleClient();
    if(!client) throw new Error('DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED');
    const objectPath=[
      'generation',
      safePathSegment(state.projectId),
      safePathSegment(state.requestId),
      'hunyuan-final.mp4',
    ].join('/');
    const {error}=await client.storage.from('director-media').upload(objectPath,media.bytes,{
      contentType:media.contentType,
      upsert:false,
    });
    if(error&&!String(error.message).toLowerCase().includes('already exists')) throw error;

    return {
      requestId:state.requestId,
      providerId:this.descriptor.id,
      status:'completed',
      assetIds:[`${state.requestId}:hunyuan-output`],
      providerJobId:state.providerJobId,
      metadata:{
        outputs:[{
          uri:`storage://director-media/${objectPath}`,
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
