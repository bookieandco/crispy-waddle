import {afterEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
  health:vi.fn(),
  fingerprint:vi.fn(),
  createProvider:vi.fn(),
}));

vi.mock('@/lib/director-speaker-qc-provider',()=>({
  createConfiguredDirectorSpeakerQcProvider:mocks.createProvider,
}));

afterEach(()=>{
  vi.restoreAllMocks();
  mocks.health.mockReset();
  mocks.fingerprint.mockReset();
  mocks.createProvider.mockReset();
  delete process.env.VERCEL_OIDC_TOKEN;
});

describe('Bonez speaker fingerprint bootstrap',()=>{
  it('fails closed without production machine OIDC',async()=>{
    mocks.createProvider.mockReturnValue({health:mocks.health,fingerprint:mocks.fingerprint});
    const {GET}=await import('./route');
    const response=await GET(new Request('https://app.example/api/director/bonez/speaker-fingerprint/bootstrap'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'});
  });

  it('fails closed when the speaker QC runtime is not configured',async()=>{
    mocks.createProvider.mockReturnValue(undefined);
    const {GET}=await import('./route');
    const response=await GET(new Request(
      'https://app.example/api/director/bonez/speaker-fingerprint/bootstrap',
      {headers:{'x-vercel-oidc-token':'oidc'}},
    ));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('DIRECTOR_SPEAKER_QC_RUNTIME_NOT_CONFIGURED');
  });

  it('fingerprints the private Bonez candidate and persists only the validated receipt',async()=>{
    mocks.health.mockResolvedValue({
      status:'ready',
      productionReady:true,
      modelId:'speechbrain/spkrec-ecapa-voxceleb',
      modelRevision:'ff989f88e92ccc120569763824f8eedd5afc9039',
    });
    mocks.fingerprint.mockResolvedValue({
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
    });
    mocks.createProvider.mockReturnValue({health:mocks.health,fingerprint:mocks.fingerprint});

    const upstream=vi.spyOn(globalThis,'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok:true,
        sourceAssetId:'asset:audio:bonez:voice-audition:v1',
        sourceSha256:'a'.repeat(64),
        mimeType:'audio/mpeg',
        audioBase64:'YXVkaW8=',
        candidate:true,
        canonical:false,
        approved:false,
      }),{status:200,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok:true,
        phase:'DIRECTOR-QUALITY.3-SPEAKER-FINGERPRINT',
        receipt:{id:'speaker-fingerprint:bonez:ecapa:test'},
        approved:false,
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
    expect(mocks.fingerprint).toHaveBeenCalledWith({
      audioBase64:'YXVkaW8=',
      mimeType:'audio/mpeg',
      expectedSourceSha256:'a'.repeat(64),
    });
    expect(upstream).toHaveBeenCalledTimes(2);
    const secondBody=JSON.parse(String(upstream.mock.calls[1]![1]?.body));
    expect(secondBody.action).toBe('speaker-fingerprint-receipt');
    expect(secondBody.receipt.sourceAssetId).toBe('asset:audio:bonez:voice-audition:v1');
    expect(secondBody.receipt.embeddingSha256).toBe('c'.repeat(64));
    expect(secondBody.receipt.qualityClaim).toBe(false);
    expect(JSON.stringify(body)).not.toContain('audioBase64');
  });

  it('rejects a worker receipt that changes the source hash',async()=>{
    mocks.health.mockResolvedValue({status:'ready',productionReady:true});
    mocks.fingerprint.mockResolvedValue({
      sourceSha256:'d'.repeat(64),
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
    });
    mocks.createProvider.mockReturnValue({health:mocks.health,fingerprint:mocks.fingerprint});
    vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      ok:true,
      sourceAssetId:'asset:audio:bonez:voice-audition:v1',
      sourceSha256:'a'.repeat(64),
      mimeType:'audio/mpeg',
      audioBase64:'YXVkaW8=',
    }),{status:200,headers:{'content-type':'application/json'}}));

    const {GET}=await import('./route');
    const response=await GET(new Request(
      'https://app.example/api/director/bonez/speaker-fingerprint/bootstrap',
      {headers:{'x-vercel-oidc-token':'oidc'}},
    ));
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe('DIRECTOR_SPEAKER_QC_SOURCE_HASH_MISMATCH');
  });
});
