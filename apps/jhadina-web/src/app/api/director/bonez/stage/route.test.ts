import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
  getUser:vi.fn(),
  getSession:vi.fn(),
}));

vi.mock('@/lib/supabase/server',()=>({
  createClient:vi.fn(async()=>({auth:{getUser:mocks.getUser,getSession:mocks.getSession}})),
}));
vi.mock('@/lib/supabase/service-role',()=>({
  createServiceRoleClient:vi.fn(()=>undefined),
}));
vi.mock('@/lib/director-reference-media',()=>({
  DIRECTOR_REFERENCE_MAX_BYTES:20*1024*1024,
  inspectDirectorReferenceImage:vi.fn(()=>({mimeType:'image/jpeg',width:512,height:512})),
}));
vi.mock('node:crypto',()=>({
  randomBytes:vi.fn(()=>Buffer.alloc(32,7)),
  createHash:vi.fn(()=> {
    let first=0;
    return {
      update(value:Uint8Array){first=Number(value[0]??0);return this;},
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

describe('Bonez reference staging route',()=>{
  beforeEach(()=>{
    vi.restoreAllMocks();
    mocks.getUser.mockResolvedValue({data:{user:{id:'11111111-1111-4111-8111-111111111111'}}});
    mocks.getSession.mockResolvedValue({data:{session:{access_token:'supabase-user-jwt'}}});
    delete process.env.VERCEL_OIDC_TOKEN;
  });
  afterEach(()=>{delete process.env.VERCEL_OIDC_TOKEN;});

  it('requires a signed-in Jhadina user',async()=>{
    mocks.getUser.mockResolvedValue({data:{user:null}});
    const {POST}=await import('./route');
    const response=await POST(new Request('https://app.example/api/director/bonez/stage',{method:'POST'}));
    expect(response.status).toBe(401);
  });

  it('fails closed before staging when uploaded derivative hashes do not match canon',async()=>{
    const upstream=vi.spyOn(globalThis,'fetch');
    const form=new FormData();
    form.set('characterFile',new File([new Uint8Array([9])],'character.jpg',{type:'image/jpeg'}));
    form.set('productFile',new File([new Uint8Array([2])],'product.jpg',{type:'image/jpeg'}));
    const {POST}=await import('./route');
    const response=await POST(new Request('https://app.example/api/director/bonez/stage',{method:'POST',body:form}));
    const body=await response.json();
    expect(response.status).toBe(409);
    expect(String(body.error)).toContain('DIRECTOR_BONEZ_REFERENCE_SHA_MISMATCH');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('uses the verified Supabase session JWT for both stage and bootstrap when Vercel has no privileged env',async()=>{
    const upstream=vi.spyOn(globalThis,'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok:true,phase:'DIRECTOR-QUALITY.2-STAGED',token:'single-use-token',
      }),{status:200,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok:true,phase:'DIRECTOR-QUALITY.2-LIVE',privilegedTransport:'supabase-user-jwt-edge',
      }),{status:200,headers:{'content-type':'application/json'}}));

    const form=new FormData();
    form.set('characterFile',new File([new Uint8Array([1])],'character.jpg',{type:'image/jpeg'}));
    form.set('productFile',new File([new Uint8Array([2])],'product.jpg',{type:'image/jpeg'}));
    const {POST}=await import('./route');
    const response=await POST(new Request('https://app.example/api/director/bonez/stage',{method:'POST',body:form}));
    const body=await response.json();

    expect(response.status).toBe(200);
    expect(body.phase).toBe('DIRECTOR-QUALITY.2-LIVE');
    expect(body.privilegedTransport).toBe('supabase-user-jwt-edge');
    expect(upstream).toHaveBeenCalledTimes(2);

    const [stageUrl,stageInit]=upstream.mock.calls[0]!;
    expect(stageUrl).toBe('https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway');
    expect(stageInit).toEqual(expect.objectContaining({
      headers:expect.objectContaining({authorization:'Bearer supabase-user-jwt'}),
    }));
    const stageBody=JSON.parse(String(stageInit?.body));
    expect(stageBody.action).toBe('stage');
    expect(stageBody.userId).toBe('11111111-1111-4111-8111-111111111111');

    const [,bootstrapInit]=upstream.mock.calls[1]!;
    expect(bootstrapInit).toEqual(expect.objectContaining({
      headers:expect.objectContaining({authorization:'Bearer supabase-user-jwt'}),
    }));
    const bootstrapBody=JSON.parse(String(bootstrapInit?.body));
    expect(bootstrapBody.action).toBe('bootstrap');
    expect(bootstrapBody.token).toBe('single-use-token');
    expect(bootstrapBody.canonical.projectId).toBe('director:bonez:production-quality:v1');
    expect(bootstrapBody.canonical.characterId).toBe('bonez');
  });
});
