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

describe('Bonez reference staging route',()=>{
  beforeEach(()=>{
    vi.restoreAllMocks();
    mocks.getUser.mockResolvedValue({data:{user:{id:'11111111-1111-4111-8111-111111111111'}}});
    mocks.getSession.mockResolvedValue({data:{session:{access_token:'supabase-user-jwt'}}});
    process.env.VERCEL_OIDC_TOKEN='oidc-test-token';
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
    form.set('characterFile',new File([new Uint8Array([0xff,0xd8,0xff,0xd9])],'character.jpg',{type:'image/jpeg'}));
    form.set('productFile',new File([new Uint8Array([0xff,0xd8,0xff,0xd9])],'product.jpg',{type:'image/jpeg'}));
    const {POST}=await import('./route');
    const response=await POST(new Request('https://app.example/api/director/bonez/stage',{method:'POST',body:form}));
    const body=await response.json();
    expect(response.status).toBe(409);
    expect(String(body.error)).toContain('DIRECTOR_BONEZ_REFERENCE_SHA_MISMATCH');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('uses the verified user session only for exact-hash staging when request OIDC is unavailable',async()=>{
    delete process.env.VERCEL_OIDC_TOKEN;
    const createHash=await import('node:crypto');
    const digest=vi.spyOn(createHash,'createHash') as any;
    digest
      .mockImplementationOnce(()=>({update:()=>({digest:()=> 'bc3cf5b39b814eac4a18320ece12cc026d5607e1baa41e0355584efa050d89cc'})}))
      .mockImplementationOnce(()=>({update:()=>({digest:()=> '8e09332025a170adf956d726e2774cab7987ec6052644375960bf467bc2847ef'})}));

    const upstream=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      ok:true,
      phase:'DIRECTOR-QUALITY.2-STAGED',
      token:'one-time-machine-token',
      expiresAt:'2026-09-29T18:00:00.000Z',
    }),{status:200,headers:{'content-type':'application/json'}}));

    const form=new FormData();
    form.set('characterFile',new File([new Uint8Array([0xff,0xd8,0xff,0xd9])],'character.jpg',{type:'image/jpeg'}));
    form.set('productFile',new File([new Uint8Array([0xff,0xd8,0xff,0xd9])],'product.jpg',{type:'image/jpeg'}));
    const {POST}=await import('./route');
    const response=await POST(new Request('https://app.example/api/director/bonez/stage',{method:'POST',body:form}));
    const body=await response.json();

    expect(response.status).toBe(202);
    expect(body.phase).toBe('DIRECTOR-QUALITY.2-STAGED');
    expect(body.machineBootstrapRequired).toBe(true);
    expect(body.privilegedTransport).toBe('supabase-user-jwt-edge');
    expect(upstream).toHaveBeenCalledTimes(1);
    const [,init]=upstream.mock.calls[0]!;
    expect(init).toEqual(expect.objectContaining({
      headers:expect.objectContaining({authorization:'Bearer supabase-user-jwt'}),
    }));
    expect(JSON.parse(String(init?.body))).toMatchObject({
      action:'stage',
      userId:'11111111-1111-4111-8111-111111111111',
    });
  });
});
