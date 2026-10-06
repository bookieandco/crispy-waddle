import { describe, expect, it } from 'vitest';
import {
  evaluateDirectorHumanMediaHealth,
  evaluateDirectorHumanMediaRuntimeParity,
  validateDirectorHumanMediaExecutionReceipt,
  validateDirectorHumanMediaJob,
  type DirectorHumanMediaHealthReceipt,
  type DirectorHumanMediaJobRequest,
  type DirectorHumanMediaRuntimeBundle,
} from './human-media-worker-contract.js';

const sha=(char:string)=>`sha256:${char.repeat(64)}`;

function bundle(engine:DirectorHumanMediaRuntimeBundle['engine']='musetalk'):DirectorHumanMediaRuntimeBundle{
  return {
    schema:'director.human-media-runtime.v1',
    engine,
    runtimeVersion:'1.0.0',
    sourceRepository:engine==='musetalk'?'TMElyralab/MuseTalk':'example/repo',
    sourceRevision:'abc123',
    image:'ghcr.io/bookieandco/director-human-media',
    imageDigest:sha('a'),
    modelArtifacts:[{
      id:'model',
      sha256:sha('b'),
      licenseEvidenceIds:['license:model'],
    }],
    capabilities:engine==='musetalk'?['lip-sync']:['portrait-animation'],
    minGpuVramGiB:8,
    authority:'DIRECTOR_HUMAN_MEDIA_RUNTIME_BUNDLE',
  };
}

function lipSyncJob():DirectorHumanMediaJobRequest{
  return {
    schema:'director.human-media-job.v1',
    id:'job:1',
    projectId:'project:1',
    engine:'musetalk',
    task:'lip-sync',
    inputAssets:[
      {
        assetId:'video:1',
        role:'source-video',
        mediaType:'video',
        sha256:sha('c'),
        rightsEvidenceIds:['rights:video'],
      },
      {
        assetId:'audio:1',
        role:'driving-audio',
        mediaType:'audio',
        sha256:sha('d'),
        rightsEvidenceIds:['rights:voice'],
      },
    ],
    parameters:{},
    evidenceIds:['brief:1'],
    sensitiveData:false,
    allowCloudBurst:true,
    authority:'DIRECTOR_HUMAN_MEDIA_JOB',
  };
}

function health(runtime= bundle()):DirectorHumanMediaHealthReceipt{
  return {
    schema:'director.human-media-health.v1',
    runtimeInstanceId:'runtime:homebase:1',
    engine:runtime.engine,
    productionReady:true,
    imageDigest:runtime.imageDigest,
    sourceRevision:runtime.sourceRevision,
    modelArtifactSha256s:runtime.modelArtifacts.map(a=>a.sha256),
    gpu:{vendor:'nvidia',model:'RTX',count:1,vramGiBPerDevice:24},
    licenseEvidenceIds:['license:runtime'],
    observedAt:'2026-10-06T17:00:00.000Z',
    reasons:[],
    authority:'DIRECTOR_HUMAN_MEDIA_HEALTH',
  };
}

describe('Director human-media worker contract',()=>{
  it('accepts an evidence-backed MuseTalk lip-sync request',()=>{
    expect(validateDirectorHumanMediaJob(lipSyncJob())).toEqual([]);
  });

  it('rejects task/engine mismatches and missing task inputs',()=>{
    const request={...lipSyncJob(),engine:'liveportrait' as const};
    expect(validateDirectorHumanMediaJob(request)).toContain(
      'DIRECTOR_HUMAN_MEDIA_ENGINE_TASK_MISMATCH:liveportrait:lip-sync',
    );
  });

  it('keeps sensitive identity media off public cloud burst',()=>{
    expect(validateDirectorHumanMediaJob({
      ...lipSyncJob(),
      sensitiveData:true,
      allowCloudBurst:true,
    })).toContain('DIRECTOR_HUMAN_MEDIA_SENSITIVE_CLOUD_BURST_FORBIDDEN');
  });

  it('admits health only when the exact image, source and model bundle are booted',()=>{
    const runtime=bundle();
    expect(evaluateDirectorHumanMediaHealth(runtime,health(runtime))).toEqual([]);
    expect(evaluateDirectorHumanMediaHealth(runtime,{
      ...health(runtime),
      imageDigest:sha('f'),
    })).toContain('DIRECTOR_HUMAN_MEDIA_HEALTH_IMAGE_MISMATCH');
  });

  it('requires Homebase and burst to use the same immutable runtime bundle',()=>{
    const home=bundle();
    expect(evaluateDirectorHumanMediaRuntimeParity(home,{...home})).toEqual({
      compatible:true,
      reasons:[],
    });
    expect(evaluateDirectorHumanMediaRuntimeParity(home,{
      ...home,
      imageDigest:sha('e'),
    }).reasons).toContain('DIRECTOR_HUMAN_MEDIA_PARITY_IMAGE_MISMATCH');
  });

  it('never lets a worker self-certify output quality',()=>{
    const request=lipSyncJob();
    const runtime=bundle();
    const reasons=validateDirectorHumanMediaExecutionReceipt(request,runtime,{
      schema:'director.human-media-execution.v1',
      jobId:request.id,
      providerJobId:'provider:1',
      engine:'musetalk',
      task:'lip-sync',
      status:'ready',
      runtimeInstanceId:'runtime:1',
      imageDigest:runtime.imageDigest,
      sourceRevision:runtime.sourceRevision,
      modelArtifactSha256s:runtime.modelArtifacts.map(a=>a.sha256),
      completedAt:'2026-10-06T17:01:00.000Z',
      output:{uri:'asset://output.mp4',mediaType:'video',sha256:sha('f')},
      qualityClaim:false,
      authority:'DIRECTOR_HUMAN_MEDIA_EXECUTION_RECEIPT',
    });
    expect(reasons).toEqual([]);
  });
});
