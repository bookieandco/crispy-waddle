import {afterEach,describe,expect,it,vi} from 'vitest';

afterEach(()=>{
  vi.restoreAllMocks();
  delete process.env.DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED;
  delete process.env.DIRECTOR_HUNYUAN_WORKER_URL;
  delete process.env.DIRECTOR_HUNYUAN_WORKER_TOKEN;
});

describe('Director Hunyuan health route',()=>{
  it('reports not configured without exposing an endpoint',async()=>{
    const {GET}=await import('./route');
    const response=await GET();
    const body=await response.json();
    expect(body).toMatchObject({
      ok:true,configured:false,status:'not-configured',productionReady:false,
    });
    expect(JSON.stringify(body)).not.toContain('WORKER_URL');
  });

  it('reports production ready only from a ready worker receipt',async()=>{
    process.env.DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED='true';
    process.env.DIRECTOR_HUNYUAN_WORKER_URL='https://hunyuan.example';
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
      ok:true,configured:true,providerId:'hunyuan-video-1.5',status:'ready',productionReady:true,
    });
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('hunyuan.example');
  });

  it('fails closed when a configured worker is unreachable',async()=>{
    process.env.DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED='true';
    process.env.DIRECTOR_HUNYUAN_WORKER_URL='https://hunyuan.example';
    vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('network down'));
    const {GET}=await import('./route');
    const response=await GET();
    const body=await response.json();
    expect(body).toMatchObject({
      ok:true,configured:true,status:'unavailable',productionReady:false,error:'network down',
    });
  });
});
