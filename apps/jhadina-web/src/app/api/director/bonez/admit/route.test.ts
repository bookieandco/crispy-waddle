import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
  createClient:vi.fn(),
  inspect:vi.fn(()=>({mimeType:'image/jpeg',width:320,height:320})),
}));

vi.mock('@/lib/supabase/server',()=>({createClient:mocks.createClient}));
vi.mock('@/lib/director-reference-media',()=>({
  DIRECTOR_REFERENCE_MAX_BYTES:20_971_520,
  inspectDirectorReferenceImage:mocks.inspect,
}));

vi.mock('node:crypto',()=>({
  createHash:vi.fn(()=> {
    let first=0;
    return {
      update(value:Uint8Array){ first=Number(value[0]??0); return this; },
      digest(){
        return first===1
          ? 'bc3cf5b39b814eac4a18320ece12cc026d5607e1baa41e0355584efa050d89cc'
          : first===2
            ? '8e09332025a170adf956d726e2774cab7987ec6052644375960bf467bc2847ef'
            : 'bad-hash';
      },
    };
  }),
}));

describe('Bonez direct QUALITY.2 admission',()=>{
  beforeEach(()=>{
    vi.restoreAllMocks();
    process.env.VERCEL_OIDC_TOKEN='prod-oidc';
    mocks.createClient.mockResolvedValue({
      auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:'11111111-1111-4111-8111-111111111111'}}})},
    });
  });
  afterEach(()=>{
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.JHADINA_DIRECTOR_BONEZ_GATEWAY_URL;
  });

  it('publishes the pinned admission contract without changing canon',async()=>{
    const {GET}=await import('./route');
    const response=await GET();
    const body=await response.json();
    expect(body).toMatchObject({
      ok:true,
      phase:'DIRECTOR-QUALITY.2-LIVE',
      readyForDirectAdmission:true,
      canonRepinning:false,
      expectedSha256:{
        character:'bc3cf5b39b814eac4a18320ece12cc026d5607e1baa41e0355584efa050d89cc',
        product:'8e09332025a170adf956d726e2774cab7987ec6052644375960bf467bc2847ef',
      },
    });
  });

  it('requires a real signed-in user',async()=>{
    mocks.createClient.mockResolvedValue({
      auth:{getUser:vi.fn().mockResolvedValue({data:{user:null}})},
    });
    const {POST}=await import('./route');
    const response=await POST(new Request('https://app.example/api/director/bonez/admit',{method:'POST',body:new FormData()}));
    expect(response.status).toBe(401);
  });

  it('forwards exact certified derivatives through production OIDC',async()=>{
    const upstream=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      ok:true,
      phase:'DIRECTOR-QUALITY.2-LIVE',
      admissionMode:'direct-authenticated-upload',
    }),{status:200,headers:{'content-type':'application/json'}}));
    const form=new FormData();
    form.set('character',new File([new Uint8Array([1,3,3,7])],'bonez-character.jpg',{type:'image/jpeg'}));
    form.set('product',new File([new Uint8Array([2,4,4,8])],'bonez-product.jpg',{type:'image/jpeg'}));
    const {POST}=await import('./route');
    const response=await POST(new Request('https://app.example/api/director/bonez/admit',{method:'POST',body:form}));
    const body=await response.json();
    expect(response.status).toBe(200);
    expect(body.admissionMode).toBe('direct-authenticated-upload');
    expect(upstream).toHaveBeenCalledTimes(1);
    const [url,init]=upstream.mock.calls[0]!;
    expect(url).toBe('https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway');
    expect(init).toEqual(expect.objectContaining({
      method:'POST',
      headers:expect.objectContaining({authorization:'Bearer prod-oidc'}),
    }));
    const payload=JSON.parse(String(init?.body));
    expect(payload.mode).toBe('direct');
    expect(payload.userId).toBe('11111111-1111-4111-8111-111111111111');
    expect(payload.canonical.projectId).toBe('director:bonez:production-quality:v1');
    expect(payload.characterBase64).toBe(Buffer.from([1,3,3,7]).toString('base64'));
    expect(payload.productBase64).toBe(Buffer.from([2,4,4,8]).toString('base64'));
  });

  it('rejects bytes that do not match the certified hashes before privileged forwarding',async()=>{
    const upstream=vi.spyOn(globalThis,'fetch');
    const form=new FormData();
    form.set('character',new File([new Uint8Array([9])],'wrong.jpg',{type:'image/jpeg'}));
    form.set('product',new File([new Uint8Array([2])],'bonez-product.jpg',{type:'image/jpeg'}));
    const {POST}=await import('./route');
    const response=await POST(new Request('https://app.example/api/director/bonez/admit',{method:'POST',body:form}));
    expect(response.status).toBe(409);
    const body=await response.json();
    expect(body.error).toBe('DIRECTOR_BONEZ_REFERENCE_SHA_MISMATCH');
    expect(body.note).toContain('never silently repins canon');
    expect(upstream).not.toHaveBeenCalled();
  });
});
