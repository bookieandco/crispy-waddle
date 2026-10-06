import { describe, expect, it } from 'vitest';
import {
  DIRECTOR_HUMAN_MEDIA_RESOURCE_PROFILES,
  directorHumanMediaComputeDraft,
  routeDirectorHumanMediaCompute,
  validateDirectorHumanMediaDeploymentParity,
  type DirectorHumanMediaComputeRequest,
  type DirectorHumanMediaDeployment,
} from './director-human-media-runtime.js';

const digest=(char:string)=>`sha256:${char.repeat(64)}`;

const request:DirectorHumanMediaComputeRequest={
  jobId:'ugc:1:lip-sync',
  projectId:'ugc:1',
  idempotencyKey:'ugc:1:lip-sync',
  engine:'musetalk',
  task:'lip-sync',
  assetIds:['video:1','audio:1'],
  sensitiveData:false,
  allowCloudBurst:true,
  estimatedDurationMinutes:4,
  maxCostUsdPerHour:1.5,
  payload:{jobId:'ugc:1:lip-sync'},
  createdAt:'2026-10-06T18:00:00.000Z',
};

function deployment(
  tier:DirectorHumanMediaDeployment['tier'],
  overrides:Partial<DirectorHumanMediaDeployment>={},
):DirectorHumanMediaDeployment{
  return {
    id:tier==='local-homebase'?'musetalk-home':'musetalk-burst',
    engine:'musetalk',
    tier,
    baseUrl:tier==='local-homebase'?'http://director-musetalk:8095':'https://api.runpod.ai/v2/musetalk',
    image:'ghcr.io/bookieandco/director-musetalk:1.5',
    imageDigest:digest('a'),
    sourceRevision:'musetalk-source-rev',
    modelArtifactDigests:[digest('b'),digest('c')],
    productionReady:true,
    healthObservedAt:'2026-10-06T18:00:00.000Z',
    ...(tier==='local-homebase'?{nodeId:'homebase-gpu-1'}:{runpodEndpointId:'musetalk-prod'}),
    ...overrides,
  };
}

describe('Director human-media compute runtime',()=>{
  it('defines GPU-capable resource profiles for the four local workers',()=>{
    expect(Object.keys(DIRECTOR_HUMAN_MEDIA_RESOURCE_PROFILES).sort()).toEqual([
      'director.human-media.coqui-tts',
      'director.human-media.liveportrait',
      'director.human-media.musetalk',
      'director.human-media.sadtalker',
    ]);
    expect(DIRECTOR_HUMAN_MEDIA_RESOURCE_PROFILES['director.human-media.musetalk']?.resources.gpu?.minVramGiBPerDevice)
      .toBe(8);
  });

  it('builds a Director-owned compute draft and preserves explicit cloud-burst policy',()=>{
    const draft=directorHumanMediaComputeDraft(request);
    expect(draft.authority.system).toBe('director-human-media');
    expect(draft.resourceProfileId).toBe('director.human-media.musetalk');
    expect(draft.constraints).toMatchObject({
      sensitiveData:false,
      allowCloudBurst:true,
      maxCostUsdPerHour:1.5,
    });
    expect(draft.dataLocalityKeys).toContain('asset:video:1');
  });

  it('always prefers a healthy Homebase GPU even when RunPod is reachable',()=>{
    const result=routeDirectorHumanMediaCompute(
      request,
      {homebaseReady:true,localGpuReady:true,runpodReachable:true,offline:false},
      [deployment('local-homebase'),deployment('gpu-burst')],
    );
    expect(result.target).toBe('HOMEBASE_LOCAL');
    expect(result.reason).toBe('DIRECTOR_HUMAN_MEDIA_LOCAL_FIRST');
    expect(result.expectedImageDigest).toBe(digest('a'));
  });

  it('bursts to RunPod only when Homebase capacity is unavailable and the immutable bundle matches',()=>{
    const result=routeDirectorHumanMediaCompute(
      request,
      {homebaseReady:true,localGpuReady:false,runpodReachable:true,offline:false},
      [deployment('local-homebase'),deployment('gpu-burst')],
    );
    expect(result.target).toBe('RUNPOD_GPU');
    expect(result.runpodDispatch?.mode).toBe('SERVERLESS');
    expect(result.runpodDispatch?.endpointId).toBe('musetalk-prod');
    expect(result.runpodDispatch?.payload.input.expectedImageDigest).toBe(digest('a'));
  });

  it('fails closed when the RunPod image differs from the Homebase image',()=>{
    const home=deployment('local-homebase');
    const burst=deployment('gpu-burst',{imageDigest:digest('d')});
    expect(validateDirectorHumanMediaDeploymentParity(home,burst))
      .toContain('DIRECTOR_HUMAN_MEDIA_DEPLOYMENT_IMAGE_DIGEST_MISMATCH');
    const result=routeDirectorHumanMediaCompute(
      request,
      {homebaseReady:true,localGpuReady:false,runpodReachable:true,offline:false},
      [home,burst],
    );
    expect(result.target).toBe('DEFER');
    expect(result.reason).toContain('DIRECTOR_HUMAN_MEDIA_BURST_PARITY_FAILED');
  });

  it('never sends sensitive identity/voice media to public GPU burst',()=>{
    expect(()=>directorHumanMediaComputeDraft({
      ...request,
      sensitiveData:true,
      allowCloudBurst:true,
    })).toThrow('DIRECTOR_HUMAN_MEDIA_COMPUTE_SENSITIVE_BURST_FORBIDDEN');

    const result=routeDirectorHumanMediaCompute(
      {...request,sensitiveData:true,allowCloudBurst:false},
      {homebaseReady:false,localGpuReady:false,runpodReachable:true,offline:false},
      [deployment('local-homebase'),deployment('gpu-burst')],
    );
    expect(result.target).toBe('DEFER');
    expect(result.reason).toBe('DIRECTOR_HUMAN_MEDIA_SENSITIVE_LOCAL_REQUIRED');
  });
});
