import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
  getUser:vi.fn(),
  getSession:vi.fn(),
}));

vi.mock('@/lib/supabase/server',()=>({
  createClient:vi.fn(async()=>({auth:{getUser:mocks.getUser,getSession:mocks.getSession}})),
}));

describe('Bonez explicit voice approval route',()=>{
  beforeEach(()=>{
    vi.restoreAllMocks();
    mocks.getUser.mockResolvedValue({data:{user:{id:'11111111-1111-4111-8111-111111111111'}}});
    mocks.getSession.mockResolvedValue({data:{session:{access_token:'user-session-jwt'}}});
  });
  afterEach(()=>vi.restoreAllMocks());

  it('requires an authenticated user',async()=>{
    mocks.getUser.mockResolvedValue({data:{user:null}});
    const {POST}=await import('./route');
    const response=await POST(new Request('https://app.example/api/director/bonez/voice-identity/approve',{
      method:'POST',headers:{'content-type':'application/json'},body:'{}',
    }));
    expect(response.status).toBe(401);
  });

  it('requires explicit approval rather than treating evidence as consent',async()=>{
    const {POST}=await import('./route');
    const response=await POST(new Request('https://app.example/api/director/bonez/voice-identity/approve',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        approve:false,
        expectedCandidateSha256:'a'.repeat(64),
        expectedFingerprintRef:'speaker-embedding:ecapa-voxceleb:test:sha256:'+'b'.repeat(64),
        minimumSpeakerSimilarity:0.8,
      }),
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('DIRECTOR_BONEZ_VOICE_EXPLICIT_APPROVAL_REQUIRED');
  });

  it('forwards exact candidate and fingerprint expectations with the user session JWT',async()=>{
    const upstream=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      ok:true,
      phase:'DIRECTOR-QUALITY.3-VOICE-APPROVED',
      voiceIdentityId:'voice:bonez:canonical:v1',
      approvalReceiptId:'voice-approval:bonez:canonical:v1',
      authority:'DIRECTOR_EXPLICIT_VOICE_APPROVAL',
      productionVoiceRuntimeCommissioned:false,
    }),{status:200,headers:{'content-type':'application/json'}}));

    const sha='cb5af66bfe5bbcc7b07c1f9dfc2b9be6b077c290452bab7c2aff60c62d1ce84a';
    const fingerprint='speaker-embedding:ecapa-voxceleb:ff989f88e92c:sha256:'+'b'.repeat(64);
    const {POST}=await import('./route');
    const response=await POST(new Request('https://app.example/api/director/bonez/voice-identity/approve',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        approve:true,
        expectedCandidateSha256:sha,
        expectedFingerprintRef:fingerprint,
        minimumSpeakerSimilarity:0.8,
      }),
    }));
    const body=await response.json();

    expect(response.status).toBe(200);
    expect(body.authority).toBe('DIRECTOR_EXPLICIT_VOICE_APPROVAL');
    expect(body.productionVoiceRuntimeCommissioned).toBe(false);
    expect(upstream).toHaveBeenCalledWith(
      GATEWAY_URL_PLACEHOLDER,
      expect.objectContaining({
        method:'POST',
        headers:expect.objectContaining({authorization:'Bearer user-session-jwt'}),
      }),
    );
    const payload=JSON.parse(String(upstream.mock.calls[0]![1]?.body));
    expect(payload).toEqual({
      action:'voice-approve',
      approve:true,
      expectedCandidateSha256:sha,
      expectedFingerprintRef:fingerprint,
      minimumSpeakerSimilarity:0.8,
    });
  });

  it('preserves Q2/fingerprint conflicts from the authority layer',async()=>{
    vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      ok:false,error:'DIRECTOR_QUALITY_2_REQUIRED',
    }),{status:409,headers:{'content-type':'application/json'}}));
    const {POST}=await import('./route');
    const response=await POST(new Request('https://app.example/api/director/bonez/voice-identity/approve',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        approve:true,
        expectedCandidateSha256:'a'.repeat(64),
        expectedFingerprintRef:'speaker-embedding:ecapa-voxceleb:test:sha256:'+'b'.repeat(64),
        minimumSpeakerSimilarity:0.8,
      }),
    }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('DIRECTOR_QUALITY_2_REQUIRED');
  });
});

const GATEWAY_URL_PLACEHOLDER='https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway';
