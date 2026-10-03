import {afterEach,describe,expect,it,vi} from 'vitest';

afterEach(()=>{
  vi.restoreAllMocks();
  delete process.env.DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED;
  delete process.env.DIRECTOR_HUNYUAN_WORKER_URL;
  delete process.env.DIRECTOR_HUNYUAN_WORKER_TOKEN;
  delete process.env.DIRECTOR_HUNYUAN_WORKER_URL_PINNED;
});

describe('Director Hunyuan health route',()=>{
  it('probes the canonical runtime even when generation is disabled',async()=>{
    const fetchMock=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('pod offline'));
    const {GET}=await import('./route');
    const response=await GET();
    const body=await response.json();
    expect(body).toMatchObject({
      ok:true,configured:true,status:'unavailable',productionReady:false,generationEnabled:false,
      error:'pod offline',
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://xn73vwwekavcc6-8091.proxy.runpod.net/health',
    );
    expect(JSON.stringify(body)).not.toContain('xn73vwwekavcc6');
  });

  it('reports production ready only from a ready worker receipt',async()=>{
    process.env.DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED='true';
    process.env.DIRECTOR_HUNYUAN_WORKER_URL='https://healthready-8091.proxy.runpod.net';
    process.env.DIRECTOR_HUNYUAN_WORKER_URL_PINNED='true';
    process.env.DIRECTOR_HUNYUAN_WORKER_TOKEN='secret';
    vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      status:'ready',
      productionReady:true,
      reasons:[],
      checkpointTreeReady:true,
      licenseAcknowledged:true,
      territoryAcknowledged:true,
    }),{status:200,headers:{'content-type':'application/json'}}));
    const {GET}=await import('./route');
    const response=await GET();
    const body=await response.json();
    expect(body).toMatchObject({
      ok:true,configured:true,providerId:'hunyuan-video-1.5',status:'ready',productionReady:true,generationEnabled:true,
    });
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('healthready-8091.proxy.runpod.net');
  });

  it('fails closed when a configured worker is unreachable',async()=>{
    process.env.DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED='true';
    process.env.DIRECTOR_HUNYUAN_WORKER_URL='https://healthdown-8091.proxy.runpod.net';
    process.env.DIRECTOR_HUNYUAN_WORKER_URL_PINNED='true';
    vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('network down'));
    const {GET}=await import('./route');
    const response=await GET();
    const body=await response.json();
    expect(body).toMatchObject({
      ok:true,configured:true,status:'unavailable',productionReady:false,generationEnabled:true,error:'network down',
    });
  });
});
