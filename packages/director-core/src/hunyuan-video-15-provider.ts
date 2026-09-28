export type HunyuanVideo15Model =
  | 'hunyuan-video-1.5-480p-i2v-step-distilled'
  | 'hunyuan-video-1.5-480p-i2v'
  | 'hunyuan-video-1.5-720p-i2v'
  | 'hunyuan-video-1.5-480p-t2v'
  | 'hunyuan-video-1.5-720p-t2v';

export type HunyuanVideo15Mode = 'i2v' | 't2v';
export type HunyuanVideo15Resolution = '480p' | '720p';
export type HunyuanVideo15AspectRatio = '16:9' | '9:16' | '1:1';

export interface HunyuanVideo15Reference {
  assetId: string;
  uri: string;
  sha256: string;
  semanticLabel: string;
  evidenceIds: readonly string[];
}

export interface HunyuanVideo15Request {
  requestId: string;
  projectId: string;
  model: HunyuanVideo15Model;
  mode: HunyuanVideo15Mode;
  prompt: string;
  negativePrompt: string;
  reference?: HunyuanVideo15Reference;
  resolution: HunyuanVideo15Resolution;
  aspectRatio: HunyuanVideo15AspectRatio;
  videoLength: number;
  seed: number;
  numInferenceSteps: number;
  cfgDistilled: boolean;
  enableStepDistill: boolean;
  enableSuperResolution: boolean;
  rewritePrompt: boolean;
  offloading: boolean;
  groupOffloading: boolean;
  overlapGroupOffloading: boolean;
  source: {
    repository: 'Tencent-Hunyuan/HunyuanVideo-1.5';
    license: 'Tencent-Hunyuan-Community-License';
    territoryRestricted: true;
    minimumGpuMemoryGb: 14;
  };
  authority: 'DIRECTOR_HUNYUAN_VIDEO_15_REQUEST';
}

export interface BuildHunyuanVideo15RequestInput {
  requestId: string;
  projectId: string;
  model: HunyuanVideo15Model;
  prompt: string;
  negativePrompt?: string;
  reference?: HunyuanVideo15Reference;
  aspectRatio?: HunyuanVideo15AspectRatio;
  videoLength?: number;
  seed: number;
  numInferenceSteps?: number;
  enableSuperResolution?: boolean;
  rewritePrompt?: boolean;
  offloading?: boolean;
  groupOffloading?: boolean;
  overlapGroupOffloading?: boolean;
}

const MODEL_POLICY: Readonly<Record<HunyuanVideo15Model, {
  mode:HunyuanVideo15Mode;
  resolution:HunyuanVideo15Resolution;
  cfgDistilled:boolean;
  stepDistilled:boolean;
  defaultSteps:number;
}>> = Object.freeze({
  'hunyuan-video-1.5-480p-i2v-step-distilled': Object.freeze({
    mode:'i2v',resolution:'480p',cfgDistilled:true,stepDistilled:true,defaultSteps:12,
  }),
  'hunyuan-video-1.5-480p-i2v': Object.freeze({
    mode:'i2v',resolution:'480p',cfgDistilled:false,stepDistilled:false,defaultSteps:50,
  }),
  'hunyuan-video-1.5-720p-i2v': Object.freeze({
    mode:'i2v',resolution:'720p',cfgDistilled:false,stepDistilled:false,defaultSteps:50,
  }),
  'hunyuan-video-1.5-480p-t2v': Object.freeze({
    mode:'t2v',resolution:'480p',cfgDistilled:false,stepDistilled:false,defaultSteps:50,
  }),
  'hunyuan-video-1.5-720p-t2v': Object.freeze({
    mode:'t2v',resolution:'720p',cfgDistilled:false,stepDistilled:false,defaultSteps:50,
  }),
});

export const DIRECTOR_HUNYUAN_VIDEO_15_NATIVE_FPS = 24;
export const DIRECTOR_HUNYUAN_VIDEO_15_OPTIMAL_FRAMES = 121;
export const DIRECTOR_HUNYUAN_VIDEO_15_MAX_FRAMES = 241;

function validHash(value:string):boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function validateHunyuanVideo15Request(request:HunyuanVideo15Request):readonly string[] {
  const reasons:string[]=[];
  if(!request.requestId.trim()||!request.projectId.trim()||!request.prompt.trim()){
    reasons.push('DIRECTOR_HUNYUAN_IDENTITY_OR_PROMPT_REQUIRED');
  }
  const policy=MODEL_POLICY[request.model];
  if(!policy) reasons.push('DIRECTOR_HUNYUAN_MODEL_UNSUPPORTED');
  if(policy){
    if(request.mode!==policy.mode) reasons.push('DIRECTOR_HUNYUAN_MODEL_MODE_MISMATCH');
    if(request.resolution!==policy.resolution) reasons.push('DIRECTOR_HUNYUAN_MODEL_RESOLUTION_MISMATCH');
    if(request.cfgDistilled!==policy.cfgDistilled) reasons.push('DIRECTOR_HUNYUAN_CFG_DISTILL_MISMATCH');
    if(request.enableStepDistill!==policy.stepDistilled) reasons.push('DIRECTOR_HUNYUAN_STEP_DISTILL_MISMATCH');
  }
  if(request.mode==='i2v'&&!request.reference) reasons.push('DIRECTOR_HUNYUAN_I2V_REFERENCE_REQUIRED');
  if(request.mode==='t2v'&&request.reference) reasons.push('DIRECTOR_HUNYUAN_T2V_REFERENCE_FORBIDDEN');
  if(request.reference){
    if(!request.reference.assetId.trim()||!request.reference.uri.trim()||!request.reference.semanticLabel.trim()){
      reasons.push('DIRECTOR_HUNYUAN_REFERENCE_INVALID');
    }
    if(!validHash(request.reference.sha256)) reasons.push('DIRECTOR_HUNYUAN_REFERENCE_HASH_INVALID');
    if(!request.reference.evidenceIds.length) reasons.push('DIRECTOR_HUNYUAN_REFERENCE_EVIDENCE_REQUIRED');
  }
  if(!Number.isInteger(request.videoLength)||request.videoLength<5||request.videoLength>DIRECTOR_HUNYUAN_VIDEO_15_MAX_FRAMES){
    reasons.push('DIRECTOR_HUNYUAN_VIDEO_LENGTH_INVALID');
  }
  if(request.videoLength!==DIRECTOR_HUNYUAN_VIDEO_15_OPTIMAL_FRAMES){
    if((request.videoLength-1)%4!==0) reasons.push('DIRECTOR_HUNYUAN_VIDEO_LENGTH_ALIGNMENT_INVALID');
  }
  if(!Number.isInteger(request.seed)||request.seed<0) reasons.push('DIRECTOR_HUNYUAN_SEED_INVALID');
  if(!Number.isInteger(request.numInferenceSteps)||request.numInferenceSteps<1) reasons.push('DIRECTOR_HUNYUAN_STEPS_INVALID');
  if(request.enableStepDistill&&![4,8,12].includes(request.numInferenceSteps)){
    reasons.push('DIRECTOR_HUNYUAN_STEP_DISTILL_STEPS_INVALID');
  }
  return Object.freeze([...new Set(reasons)]);
}

export function buildHunyuanVideo15Request(
  input:BuildHunyuanVideo15RequestInput,
):HunyuanVideo15Request {
  const policy=MODEL_POLICY[input.model];
  if(!policy) throw new Error(`DIRECTOR_HUNYUAN_MODEL_UNSUPPORTED:${input.model}`);
  const request:HunyuanVideo15Request={
    requestId:input.requestId,
    projectId:input.projectId,
    model:input.model,
    mode:policy.mode,
    prompt:input.prompt,
    negativePrompt:input.negativePrompt??'',
    ...(input.reference?{reference:Object.freeze({
      ...input.reference,
      evidenceIds:Object.freeze([...input.reference.evidenceIds]),
    })}:{}),
    resolution:policy.resolution,
    aspectRatio:input.aspectRatio??'16:9',
    videoLength:input.videoLength??DIRECTOR_HUNYUAN_VIDEO_15_OPTIMAL_FRAMES,
    seed:input.seed,
    numInferenceSteps:input.numInferenceSteps??policy.defaultSteps,
    cfgDistilled:policy.cfgDistilled,
    enableStepDistill:policy.stepDistilled,
    enableSuperResolution:input.enableSuperResolution??true,
    rewritePrompt:input.rewritePrompt??false,
    offloading:input.offloading??true,
    groupOffloading:input.groupOffloading??true,
    overlapGroupOffloading:input.overlapGroupOffloading??false,
    source:Object.freeze({
      repository:'Tencent-Hunyuan/HunyuanVideo-1.5',
      license:'Tencent-Hunyuan-Community-License',
      territoryRestricted:true,
      minimumGpuMemoryGb:14,
    }),
    authority:'DIRECTOR_HUNYUAN_VIDEO_15_REQUEST',
  };
  const reasons=validateHunyuanVideo15Request(request);
  if(reasons.length) throw new Error(`DIRECTOR_HUNYUAN_REQUEST_INVALID:${reasons.join(',')}`);
  return Object.freeze(request);
}

export function hunyuanVideo15CliArguments(
  request:HunyuanVideo15Request,
  runtime:{modelPath:string;referencePath?:string;outputPath:string},
):readonly string[] {
  const reasons=validateHunyuanVideo15Request(request);
  if(reasons.length) throw new Error(`DIRECTOR_HUNYUAN_REQUEST_INVALID:${reasons.join(',')}`);
  if(!runtime.modelPath.trim()||!runtime.outputPath.trim()) throw new Error('DIRECTOR_HUNYUAN_RUNTIME_PATH_REQUIRED');
  if(request.mode==='i2v'&&!runtime.referencePath?.trim()) throw new Error('DIRECTOR_HUNYUAN_RUNTIME_REFERENCE_REQUIRED');
  const args=[
    'generate.py',
    '--prompt',request.prompt,
    '--negative_prompt',request.negativePrompt,
    '--resolution',request.resolution,
    '--model_path',runtime.modelPath,
    '--aspect_ratio',request.aspectRatio,
    '--num_inference_steps',String(request.numInferenceSteps),
    '--video_length',String(request.videoLength),
    '--seed',String(request.seed),
    '--image_path',request.mode==='i2v' ? runtime.referencePath! : 'none',
    '--output_path',runtime.outputPath,
    '--sr',String(request.enableSuperResolution),
    '--rewrite',String(request.rewritePrompt),
    '--cfg_distilled',String(request.cfgDistilled),
    '--enable_step_distill',String(request.enableStepDistill),
    '--offloading',String(request.offloading),
    '--group_offloading',String(request.groupOffloading),
    '--overlap_group_offloading',String(request.overlapGroupOffloading),
    '--save_generation_config','true',
  ];
  return Object.freeze(args);
}
