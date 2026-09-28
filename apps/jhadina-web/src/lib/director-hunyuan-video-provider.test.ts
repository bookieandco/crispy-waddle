import { afterEach, describe, expect, it, vi } from 'vitest';
import { DirectorHunyuanVideoProvider } from './director-hunyuan-video-provider';

afterEach(()=>vi.restoreAllMocks());

const reference={
  assetId:'asset:hero',
  uri:'https://signed.example/hero.png',
  sha256:'a'.repeat(64),
  semanticLabel:'locked hero first frame',
  evidenceIds:['cast:hero'],
};

describe('Director Hunyuan video provider',()=>{
  it('submits a governed Hunyuan I2V job to the worker',async()=>{
    const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      providerJobId:'hunyuan-job-1',
      status:'queued',
      requestId:'request:1',
      projectId:'project:1',
      model:'hunyuan-video-1.5-480p-i2v-step-distilled',
      modelVersion:'HunyuanVideo-1.5',
    }),{status:200,headers:{'content-type':'application/json'}}));

    const provider=new DirectorHunyuanVideoProvider({
      baseUrl:'https://runpod-worker.example/',
      token:'secret',
    });

    await expect(provider.submit({
      requestId:'request:1',
      projectId:'project:1',
      model:'hunyuan-video-1.5-480p-i2v-step-distilled',
      prompt:'The locked hero walks toward camera.',
      reference,
      seed:42,
    },'idem:1')).resolves.toMatchObject({
      providerJobId:'hunyuan-job-1',
      status:'queued',
    });

    const [url,init]=fetchMock.mock.calls[0]!;
    expect(url).toBe('https://runpod-worker.example/v1/jobs');
    expect(init?.headers).toMatchObject({
      'content-type':'application/json',
      'idempotency-key':'idem:1',
      authorization:'Bearer secret',
    });
    const body=JSON.parse(String(init?.body));
    expect(body.request).toMatchObject({
      model:'hunyuan-video-1.5-480p-i2v-step-distilled',
      resolution:'480p',
      seed:42,
      reference:{assetId:'asset:hero',sha256:'a'.repeat(64)},
    });
  });

  it('checks worker production readiness through health',async()=>{
    vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      status:'ready',
      productionReady:true,
      gpuMemoryMb:[24576],
      checkpointTreeReady:true,
      licenseAcknowledged:true,
      territoryAcknowledged:true,
    }),{status:200,headers:{'content-type':'application/json'}}));
    const provider=new DirectorHunyuanVideoProvider({baseUrl:'https://runpod-worker.example'});
    await expect(provider.health()).resolves.toMatchObject({productionReady:true});
  });
});
