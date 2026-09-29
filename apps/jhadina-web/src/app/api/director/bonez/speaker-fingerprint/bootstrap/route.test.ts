import {afterEach,describe,expect,it,vi} from 'vitest';

afterEach(()=>{
  vi.restoreAllMocks();
  delete process.env.VERCEL_OIDC_TOKEN;
});

describe('Bonez speaker fingerprint bootstrap',()=>{
  it('fails closed without production machine OIDC',async()=>{
    const {GET}=await import('./route');
    const response=await GET(new Request('https://app.example/api/director/bonez/speaker-fingerprint/bootstrap'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'});
  });

  it('delegates the private fingerprint run to the machine-authorized SWLC gateway',async()=>{
    const upstream=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      ok:true,
      phase:'DIRECTOR-QUALITY.3-SPEAKER-FINGERPRINT',
      receipt:{
        id:'speaker-fingerprint:bonez:ecapa:test',
        sourceSha256:'a'.repeat(64),
        embeddingSha256:'b'.repeat(64),
      },
      runtime:{
        configured:true,
        productionReady:true,
        status:'ready',
      },
      authority:'DIRECTOR_SPEAKER_QC_EVIDENCE_ONLY',
      approved:false,
      canonicalVoiceIdentityCreated:false,
    }),{status:200,headers:{'content-type':'application/json'}}));

    const {GET}=await import('./route');
    const response=await GET(new Request(
      'https://app.example/api/director/bonez/speaker-fingerprint/bootstrap',
      {headers:{'x-vercel-oidc-token':'oidc'}},
    ));
    const body=await response.json();

    expect(response.status).toBe(200);
    expect(body.authority).toBe('DIRECTOR_SPEAKER_QC_EVIDENCE_ONLY');
    expect(body.approved).toBe(false);
    expect(body.canonicalVoiceIdentityCreated).toBe(false);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(upstream).toHaveBeenCalledWith(
      'https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway',
      expect.objectContaining({
        method:'POST',
        headers:expect.objectContaining({authorization:'Bearer oidc'}),
        body:JSON.stringify({action:'speaker-fingerprint-run'}),
      }),
    );
    expect(JSON.stringify(body)).not.toContain('audioBase64');
  });

  it('preserves the edge runtime blocker without inventing a local fallback',async()=>{
    vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      ok:false,
      error:'DIRECTOR_SPEAKER_QC_RUNTIME_NOT_CONFIGURED',
    }),{status:500,headers:{'content-type':'application/json'}}));

    const {GET}=await import('./route');
    const response=await GET(new Request(
      'https://app.example/api/director/bonez/speaker-fingerprint/bootstrap',
      {headers:{'x-vercel-oidc-token':'oidc'}},
    ));
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('DIRECTOR_SPEAKER_QC_RUNTIME_NOT_CONFIGURED');
  });
});
