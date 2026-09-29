import {afterEach,describe,expect,it,vi} from 'vitest';

vi.mock('@/lib/director-hunyuan-video-provider',()=>({
  createConfiguredDirectorHunyuanVideoProvider:vi.fn(()=>undefined),
}));

describe('Bonez quality preflight',()=>{
  afterEach(()=>{
    vi.restoreAllMocks();
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.JHADINA_VOICE_URL;
    delete process.env.JHADINA_VOICE_TOKEN;
  });

  it('fails closed without production Vercel OIDC',async()=>{
    const {GET}=await import('./route');
    const response=await GET(new Request('https://app.example/api/director/bonez/quality-preflight'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'});
  });

  it('reports live prerequisites without converting candidates into certification',async()=>{
    const upstream=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      ok:true,
      phase:'DIRECTOR-BONEZ-QUALITY-PREFLIGHT-DATA',
      projectId:'director:bonez:production-quality:v1',
      references:[],
      cast:null,
      voiceIdentities:[],
      voiceProviderBindings:[],
      voiceCandidate:{
        id:'asset:audio:bonez:voice-audition:v1',
        sha256:'cb5af66bfe5bbcc7b07c1f9dfc2b9be6b077c290452bab7c2aff60c62d1ce84a',
        providerId:'runway-speech',
        modelId:'eleven_v3',
        approvalPolicy:'studio_qc',
        metadata:{candidate:true,canonical:false,approved:false},
      },
      voiceCandidateReceipt:{
        id:'voice-candidate:bonez:runway:4c04699b-bbc2-4e40-8d8e-502d6a71d959',
        receiptSha256:'cc388b7d4d874dfc62c6e7aaa5193928d2473cbc036ade112603a1cfa25707cd',
        artifactSha256:'cb5af66bfe5bbcc7b07c1f9dfc2b9be6b077c290452bab7c2aff60c62d1ce84a',
        approvalState:'candidate_unapproved',
        artifactHashStatus:'verified',
      },
      speakerQcRuntime:{
        configured:true,
        productionReady:true,
        status:'ready',
        health:{
          modelId:'speechbrain/spkrec-ecapa-voxceleb',
          modelRevision:'ff989f88e92ccc120569763824f8eedd5afc9039',
        },
      },
      speakerFingerprintReceipts:[{
        id:'speaker-fingerprint:bonez:ecapa:ff989f88e92c:0123456789abcdef',
        sourceAssetId:'asset:audio:bonez:voice-audition:v1',
        sourceSha256:'cb5af66bfe5bbcc7b07c1f9dfc2b9be6b077c290452bab7c2aff60c62d1ce84a',
        modelId:'speechbrain/spkrec-ecapa-voxceleb',
        modelRevision:'ff989f88e92ccc120569763824f8eedd5afc9039',
        embeddingDimensions:192,
        embeddingSha256:'0'.repeat(64),
        fingerprintRef:'speaker-embedding:ecapa-voxceleb:ff989f88e92c:sha256:'+'0'.repeat(64),
        quantization:'l2-int16-v1',
        sampleRateHz:16000,
        durationSeconds:9.04,
        qualityClaim:false,
      }],
      recentVideoArtifacts:[],
      stagedChunkCount:0,
      activeBootstrapTokenCount:0,
    }),{status:200,headers:{'content-type':'application/json'}}));

    const {GET}=await import('./route');
    const response=await GET(new Request(
      'https://app.example/api/director/bonez/quality-preflight',
      {headers:{'x-vercel-oidc-token':'request-oidc-token'}},
    ));
    const body=await response.json();

    expect(response.status).toBe(200);
    expect(body.authority).toBe('DIRECTOR_BONEZ_PREFLIGHT_ONLY');
    expect(body.certificationAuthorityUnchanged).toBe(true);
    expect(body.stages['DIRECTOR-QUALITY.2-LIVE'].passed).toBe(false);
    expect(body.stages['DIRECTOR-QUALITY.3-LIVE'].evidence.voiceCandidateReady).toBe(true);
    expect(body.stages['DIRECTOR-QUALITY.3-LIVE'].evidence.voiceCandidateReceiptVerified).toBe(true);
    expect(body.stages['DIRECTOR-QUALITY.3-LIVE'].evidence.speakerFingerprintReady).toBe(true);
    expect(body.stages['DIRECTOR-QUALITY.3-LIVE'].evidence.speakerFingerprintReceiptId).toContain('speaker-fingerprint:bonez');
    expect(body.stages['DIRECTOR-QUALITY.3-LIVE'].evidence.speakerQcRuntime.productionReady).toBe(true);
    expect(body.stages['DIRECTOR-QUALITY.3-LIVE'].passed).toBe(false);
    expect(body.stages['DIRECTOR-QUALITY.3-LIVE'].blockers).toContain('DIRECTOR_BONEZ_APPROVED_VOICE_IDENTITY_REQUIRED');
    expect(body.stages['DIRECTOR-QUALITY.4'].passed).toBe(false);
    expect(body.stages['DIRECTOR-QUALITY.4'].blockers).toContain('DIRECTOR_HUNYUAN_PRODUCTION_NOT_READY');
    expect(body.stages['DIRECTOR-QUALITY.5'].passed).toBe(false);
    expect(upstream).toHaveBeenCalledWith(
      'https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway',
      expect.objectContaining({
        method:'POST',
        headers:expect.objectContaining({authorization:'Bearer request-oidc-token'}),
      }),
    );
  });
});
