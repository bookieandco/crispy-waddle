import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
  getUser:vi.fn(),
}));

vi.mock('@/lib/supabase/server',()=>({
  createClient:vi.fn(async()=>({auth:{getUser:mocks.getUser}})),
}));

vi.mock('@/lib/director-reference-media',()=>({
  DIRECTOR_REFERENCE_MAX_BYTES:20*1024*1024,
  inspectDirectorReferenceImage:vi.fn(()=>({mimeType:'image/jpeg',width:512,height:512})),
}));

describe('Bonez reference staging route',()=>{
  beforeEach(()=>{
    vi.restoreAllMocks();
    mocks.getUser.mockResolvedValue({data:{user:{id:'11111111-1111-4111-8111-111111111111'}}});
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
});
