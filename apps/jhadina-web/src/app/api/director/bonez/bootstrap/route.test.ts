import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

vi.mock('@/lib/supabase/service-role',()=>({
  createServiceRoleClient:vi.fn(()=>undefined),
}));

describe('Bonez quality bootstrap OIDC fallback',()=>{
  beforeEach(()=>{
    vi.restoreAllMocks();
    process.env.VERCEL_OIDC_TOKEN='oidc-test-token';
    delete process.env.JHADINA_DIRECTOR_BONEZ_GATEWAY_URL;
    delete process.env.DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED;
    delete process.env.DIRECTOR_HUNYUAN_WORKER_URL;
    delete process.env.DIRECTOR_HUNYUAN_WORKER_TOKEN;
  });

  afterEach(()=>{
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.JHADINA_DIRECTOR_BONEZ_GATEWAY_URL;
    delete process.env.DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED;
    delete process.env.DIRECTOR_HUNYUAN_WORKER_URL;
    delete process.env.DIRECTOR_HUNYUAN_WORKER_TOKEN;
  });

  it('forwards the fixed Bonez authority package through Vercel OIDC when service role is absent',async()=>{
    const upstream=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      ok:true,
      phase:'DIRECTOR-QUALITY.2-LIVE',
      projectId:'director:bonez:production-quality:v1',
      characterId:'bonez',
      references:{character:{assetId:'director-ref:bonez:canonical:v2'},product:{assetId:'director-ref:bonez:product-print:v2'}},
      voiceIdentityIds:[],
      privilegedTransport:'vercel-oidc-supabase-edge',
    }),{status:200,headers:{'content-type':'application/json'}}));

    const {GET}=await import('./route');
    const response=await GET(new Request('https://app.example/api/director/bonez/bootstrap?token=bootstrap-token'));
    const json=await response.json();

    expect(response.status).toBe(200);
    expect(json.phase).toBe('DIRECTOR-QUALITY.2-LIVE');
    expect(json.privilegedTransport).toBe('vercel-oidc-supabase-edge');
    expect(json.readiness.movieGradeVoiceApproved).toBe(false);
    expect(json.truthBoundary.noQualityClaimYet).toBe(true);

    expect(upstream).toHaveBeenCalledTimes(1);
    const [url,init]=upstream.mock.calls[0]!;
    expect(url).toBe('https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway');
    expect(init).toEqual(expect.objectContaining({
      method:'POST',
      headers:expect.objectContaining({authorization:'Bearer oidc-test-token'}),
    }));
    const body=JSON.parse(String(init?.body));
    expect(body.token).toBe('bootstrap-token');
    expect(body.canonical.projectId).toBe('director:bonez:production-quality:v1');
    expect(body.canonical.characterId).toBe('bonez');
    expect(body.canonical.references.character.expectedSha).toBe('fb188ca50aa7a2278fee921c9e366d30ec3442e044e62a07f83d3ff78e5ba1f6');
    expect(body.canonical.references.product.expectedSha).toBe('fb188ca50aa7a2278fee921c9e366d30ec3442e044e62a07f83d3ff78e5ba1f6');
  });

  it('fails closed when neither a service role nor Vercel OIDC is available',async()=>{
    delete process.env.VERCEL_OIDC_TOKEN;
    const {GET}=await import('./route');
    const response=await GET(new Request('https://app.example/api/director/bonez/bootstrap?token=bootstrap-token'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'});
  });
});
