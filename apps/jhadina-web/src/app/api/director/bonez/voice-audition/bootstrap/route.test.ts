import {afterEach,describe,expect,it,vi} from 'vitest';

vi.mock('@/lib/supabase/service-role',()=>({
  createServiceRoleClient:vi.fn(()=>undefined),
}));

describe('Bonez voice audition candidate bootstrap',()=>{
  afterEach(()=>{
    vi.restoreAllMocks();
    delete process.env.VERCEL_OIDC_TOKEN;
  });

  it('fails closed without either privileged runtime path',async()=>{
    const {GET}=await import('./route');
    const response=await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ok:false,error:'DIRECTOR_PRIVILEGED_RUNTIME_REQUIRED'});
  });

  it('uses the OIDC-bound Bonez gateway when direct service-role access is absent',async()=>{
    process.env.VERCEL_OIDC_TOKEN='oidc-test-token';
    const upstream=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      ok:true,
      phase:'DIRECTOR-QUALITY.3-VOICE-CANDIDATE',
      approved:false,
      asset:{id:'asset:audio:bonez:voice-audition:v1',sha256:'abc'},
    }),{status:200,headers:{'content-type':'application/json'}}));
    const {GET}=await import('./route');
    const response=await GET();
    const body=await response.json();
    expect(response.status).toBe(200);
    expect(body.approved).toBe(false);
    expect(body.phase).toBe('DIRECTOR-QUALITY.3-VOICE-CANDIDATE');
    expect(upstream).toHaveBeenCalledWith(
      'https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway',
      expect.objectContaining({
        method:'POST',
        headers:expect.objectContaining({authorization:'Bearer oidc-test-token'}),
      }),
    );
    const [,init]=upstream.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({action:'voice-candidate'});
  });
});
