import {afterEach,describe,expect,it,vi} from 'vitest';

afterEach(()=>{
  vi.restoreAllMocks();
  delete process.env.VERCEL_OIDC_TOKEN;
});

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
}

describe('Bonez speaker fingerprint bootstrap',()=>{
  it('fails closed without production machine OIDC',async()=>{
    const {GET}=await import('./route');
    const response=await GET(new Request('https://app.example/api/director/bonez/speaker-fingerprint/bootstrap'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'});
  });

  it('uses Vercel OIDC for the worker and persists only validated receipt evidence',async()=>{
    const upstream=vi.spyOn(globalThis,'fetch')
      .mockResolvedValueOnce(json({
        ok:true,
        configured:true,
        baseUrl:'https://pod-8092.proxy.runpod.net',
        staticTokenConfigured:false,
        authority:'DIRECTOR_SPEAKER_QC_RUNTIME_BINDING_URL_ONLY',
      }))
      .mockResolvedValueOnce(json({
        ok:true,
        phase:'DIRECTOR-QUALITY.3-SPEAKER-QC-SOURCE',
        sourceAssetId:'asset:audio:bonez:voice-audition:v1',
        sourceSha256:'a'.repeat(64),
        mimeType:'audio/mpeg',
        audioBase64:'YXVkaW8=',
        candidate:true,
        canonical:false,
        approved:false,
      }))
      .mockResolvedValueOnce(json({
        status:'ready',
        productionReady:true,
        modelId:'speechbrain/spkrec-ecapa-voxceleb',
        modelRevision:'ff989f88e92ccc120569763824f8eedd5afc9039',
      }))
      .mockResolvedValueOnce(json({
        sourceSha256:'a'.repeat(64),
        normalizedAudioSha256:'b'.repeat(64),
        modelId:'speechbrain/spkrec-ecapa-voxceleb',
        modelRevision:'ff989f88e92ccc120569763824f8eedd5afc9039',
        embeddingDimensions:192,
        embeddingSha256:'c'.repeat(64),
        fingerprintRef:'speaker-embedding:ecapa-voxceleb:ff989f88e92c:sha256:'+'c'.repeat(64),
        quantization:'l2-int16-v1',
        sampleRateHz:16000,
        durationSeconds:9.04,
        qualityClaim:false,
      }))
      .mockResolvedValueOnce(json({
        ok:true,
        phase:'DIRECTOR-QUALITY.3-SPEAKER-FINGERPRINT',
        receipt:{
          id:'speaker-fingerprint:bonez:ecapa:test',
          sourceSha256:'a'.repeat(64),
          embeddingSha256:'c'.repeat(64),
        },
        approved:false,
      }));

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
    expect(body.runtime).toEqual(expect.objectContaining({
      configured:true,
      productionReady:true,
      status:'ready',
    }));
    expect(upstream).toHaveBeenCalledTimes(5);

    expect(upstream.mock.calls[0]?.[0]).toBe(
      'https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway',
    );
    expect(JSON.parse(String((upstream.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      action:'speaker-runtime-binding',
    });

    expect(upstream.mock.calls[2]?.[0]).toBe('https://pod-8092.proxy.runpod.net/health');
    expect(upstream.mock.calls[3]?.[0]).toBe('https://pod-8092.proxy.runpod.net/v1/fingerprint');
    expect((upstream.mock.calls[3]?.[1] as RequestInit).headers).toEqual(expect.objectContaining({
      authorization:'Bearer oidc',
    }));

    const receiptBody=JSON.parse(String((upstream.mock.calls[4]?.[1] as RequestInit).body));
    expect(receiptBody.action).toBe('speaker-fingerprint-receipt');
    expect(receiptBody.receipt.sourceAssetId).toBe('asset:audio:bonez:voice-audition:v1');
    expect(receiptBody.receipt.audioBase64).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('audioBase64');
  });

  it('preserves an unconfigured runtime blocker without calling the worker',async()=>{
    const upstream=vi.spyOn(globalThis,'fetch')
      .mockResolvedValueOnce(json({
        ok:true,
        configured:false,
        baseUrl:null,
        staticTokenConfigured:false,
      }))
      .mockResolvedValueOnce(json({
        ok:true,
        sourceAssetId:'asset:audio:bonez:voice-audition:v1',
        sourceSha256:'a'.repeat(64),
        mimeType:'audio/mpeg',
        audioBase64:'YXVkaW8=',
      }));

    const {GET}=await import('./route');
    const response=await GET(new Request(
      'https://app.example/api/director/bonez/speaker-fingerprint/bootstrap',
      {headers:{'x-vercel-oidc-token':'oidc'}},
    ));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('DIRECTOR_SPEAKER_QC_RUNTIME_NOT_CONFIGURED');
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('rejects a runtime binding outside admitted worker hosts',async()=>{
    vi.spyOn(globalThis,'fetch')
      .mockResolvedValueOnce(json({
        ok:true,
        configured:true,
        baseUrl:'https://attacker.example/worker',
      }))
      .mockResolvedValueOnce(json({
        ok:true,
        sourceAssetId:'asset:audio:bonez:voice-audition:v1',
        sourceSha256:'a'.repeat(64),
        mimeType:'audio/mpeg',
        audioBase64:'YXVkaW8=',
      }));

    const {GET}=await import('./route');
    const response=await GET(new Request(
      'https://app.example/api/director/bonez/speaker-fingerprint/bootstrap',
      {headers:{'x-vercel-oidc-token':'oidc'}},
    ));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('DIRECTOR_SPEAKER_QC_RUNTIME_URL_NOT_ADMITTED');
  });
});
