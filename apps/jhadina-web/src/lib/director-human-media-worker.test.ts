import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  DirectorHumanMediaHealthReceipt,
  DirectorHumanMediaJobRequest,
  DirectorHumanMediaRuntimeBundle,
} from '@jhadina/director-core/human-media-worker-contract';
import {
  DirectorHumanMediaWorkerClient,
  probeDirectorHumanMediaDeploymentPair,
} from './director-human-media-worker';

const sha=(char:string)=>`sha256:${char.repeat(64)}`;

const bundle:DirectorHumanMediaRuntimeBundle={
  schema:'director.human-media-runtime.v1',
  engine:'musetalk',
  runtimeVersion:'1.0.0',
  sourceRepository:'TMElyralab/MuseTalk',
  sourceRevision:'source-rev',
  image:'ghcr.io/bookieandco/director-musetalk:1.5',
  imageDigest:sha('a'),
  modelArtifacts:[{
    id:'musetalk-1.5',
    sha256:sha('b'),
    licenseEvidenceIds:['license:musetalk'],
  }],
  capabilities:['lip-sync'],
  minGpuVramGiB:8,
  authority:'DIRECTOR_HUMAN_MEDIA_RUNTIME_BUNDLE',
};

const health:DirectorHumanMediaHealthReceipt={
  schema:'director.human-media-health.v1',
  runtimeInstanceId:'runtime:1',
  engine:'musetalk',
  productionReady:true,
  imageDigest:bundle.imageDigest,
  sourceRevision:bundle.sourceRevision,
  modelArtifactSha256s:bundle.modelArtifacts.map(a=>a.sha256),
  gpu:{vendor:'nvidia',model:'RTX',count:1,vramGiBPerDevice:24},
  licenseEvidenceIds:['license:musetalk','license:runtime'],
  observedAt:'2026-10-06T19:00:00.000Z',
  reasons:[],
  authority:'DIRECTOR_HUMAN_MEDIA_HEALTH',
};

const job:DirectorHumanMediaJobRequest={
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
      rightsEvidenceIds:['rights:audio'],
    },
  ],
  parameters:{},
  evidenceIds:['brief:1'],
  sensitiveData:false,
  allowCloudBurst:true,
  authority:'DIRECTOR_HUMAN_MEDIA_JOB',
};

afterEach(()=>vi.unstubAllGlobals());

describe('Director human-media worker client',()=>{
  it('uses the same HTTP contract for health and submission',async()=>{
    const fetchMock=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(health),{
        status:200,
        headers:{'content-type':'application/json'},
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        schema:'director.human-media-execution.v1',
        jobId:job.id,
        providerJobId:'provider:1',
        engine:'musetalk',
        task:'lip-sync',
        status:'queued',
        runtimeInstanceId:'runtime:1',
        imageDigest:bundle.imageDigest,
        sourceRevision:bundle.sourceRevision,
        modelArtifactSha256s:bundle.modelArtifacts.map(a=>a.sha256),
        qualityClaim:false,
        authority:'DIRECTOR_HUMAN_MEDIA_EXECUTION_RECEIPT',
      }),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',fetchMock);

    const client=new DirectorHumanMediaWorkerClient({
      baseUrl:'http://director-musetalk:8095/',
      token:'secret',
    });
    await expect(client.health()).resolves.toMatchObject({productionReady:true});
    await expect(client.submit(job,'idem:1')).resolves.toMatchObject({providerJobId:'provider:1'});

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://director-musetalk:8095/health');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://director-musetalk:8095/v1/jobs');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method:'POST',
      headers:expect.objectContaining({
        authorization:'Bearer secret',
        'idempotency-key':'idem:1',
      }),
    });
  });

  it('probes local and burst deployments and admits burst only with exact parity',async()=>{
    const responses=[
      health,
      {...health,runtimeInstanceId:'runtime:burst'},
    ];
    const fetchMock=vi.fn().mockImplementation(async()=>new Response(
      JSON.stringify(responses.shift()),
      {status:200,headers:{'content-type':'application/json'}},
    ));
    vi.stubGlobal('fetch',fetchMock);

    const pair=await probeDirectorHumanMediaDeploymentPair({
      homebase:{
        id:'musetalk-home',
        tier:'local-homebase',
        bundle,
        client:new DirectorHumanMediaWorkerClient({baseUrl:'http://musetalk.homebase:8095'}),
        nodeId:'homebase-gpu',
      },
      burst:{
        id:'musetalk-burst',
        tier:'gpu-burst',
        bundle,
        client:new DirectorHumanMediaWorkerClient({baseUrl:'https://musetalk.example'}),
        runpodEndpointId:'musetalk-prod',
      },
    });

    expect(pair.homebase.productionReady).toBe(true);
    expect(pair.burst?.productionReady).toBe(true);
    expect(pair.parityReasons).toEqual([]);
    expect(pair.burstAdmissible).toBe(true);
  });

  it('marks a deployment unavailable when health does not match the pinned image',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ...health,
      imageDigest:sha('f'),
    }),{status:200,headers:{'content-type':'application/json'}})));

    const pair=await probeDirectorHumanMediaDeploymentPair({
      homebase:{
        id:'musetalk-home',
        tier:'local-homebase',
        bundle,
        client:new DirectorHumanMediaWorkerClient({baseUrl:'http://musetalk.homebase:8095'}),
      },
    });
    expect(pair.homebase.productionReady).toBe(false);
  });
});
