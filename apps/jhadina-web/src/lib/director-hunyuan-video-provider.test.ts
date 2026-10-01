import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./vercel-oidc-runtime',()=>({
  currentVercelOidcToken:vi.fn(async()=> 'vercel-oidc-token'),
}));

import {
  DirectorHunyuanVideoProvider,
  createConfiguredDirectorHunyuanVideoProvider,
} from './director-hunyuan-video-provider';

afterEach(()=>{
  vi.restoreAllMocks();
  delete process.env.DIRECTOR_HUNYUAN_WORKER_URL;
  delete process.env.DIRECTOR_HUNYUAN_WORKER_TOKEN;
  delete process.env.DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED;
});

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


  it('discovers a replacement RunPod URL through SWLC and enables generation fail-closed',async()=>{
    const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      ok:true,
      configured:true,
      baseUrl:'https://replacement123-8091.proxy.runpod.net/',
      staticTokenConfigured:false,
      authority:'DIRECTOR_HUNYUAN_RUNTIME_BINDING_URL_ONLY',
    }),{status:200,headers:{'content-type':'application/json'}}));

    const provider=await createConfiguredDirectorHunyuanVideoProvider();
    expect(provider).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway',
      expect.objectContaining({
        method:'POST',
        headers:expect.objectContaining({authorization:'Bearer vercel-oidc-token'}),
      }),
    );
  });

  it('honors an explicit canonical-generation disable even when SWLC could discover a runtime',async()=>{
    process.env.DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED='false';
    const fetchMock=vi.spyOn(globalThis,'fetch');
    await expect(createConfiguredDirectorHunyuanVideoProvider()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-RunPod SWLC binding instead of enabling canonical generation',async()=>{
    vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      ok:true,
      configured:true,
      baseUrl:'https://evil.example/worker',
    }),{status:200,headers:{'content-type':'application/json'}}));

    await expect(createConfiguredDirectorHunyuanVideoProvider()).resolves.toBeUndefined();
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
