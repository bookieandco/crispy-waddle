import {beforeEach,describe,expect,it,vi} from 'vitest'

const mocks=vi.hoisted(()=>({
  getUser:vi.fn(),runtimeClient:vi.fn(),authority:vi.fn(),publication:vi.fn(),
  from:vi.fn(),
}))
vi.mock('@/lib/supabase/server',()=>({
  createClient:async()=>({auth:{getUser:mocks.getUser}}),
}))
vi.mock('@/lib/supabase/service-role',()=>({
  createRuntimeServiceRoleClient:mocks.runtimeClient,
}))
vi.mock('@/lib/director-project-authority',()=>({
  requireDirectorProjectAuthority:mocks.authority,
}))
vi.mock('@/lib/social/governed-publication',()=>({
  requestSocialPublication:mocks.publication,
}))
vi.mock('@jhadina/director-core/production-asset-admission',()=>({
  directorProductionAssetBlockers:vi.fn(()=>[]),
}))
import {POST} from './route'

const makeRequest=(overrides:Record<string,unknown>={})=>new Request('http://localhost/api/workstation/social-proposal',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({
    projectId:'project-a',assetId:'asset-a',brand:'pupsonstuff',text:'Original private preview',
    targetAccountIds:['social-a'],...overrides,
  }),
})
const query=(record:unknown)=>({
  select(){return this},eq(){return this},order(){return this},limit(){return this},
  async maybeSingle(){return {data:record,error:null}},
})
describe('DIRECTOR-LIVE.24 Social proposal approval boundary',()=>{
  beforeEach(()=>{
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({data:{user:{id:'owner-a'}}})
    mocks.authority.mockResolvedValue({projectId:'project-a',role:'owner'})
    mocks.runtimeClient.mockImplementation(async()=>({from:mocks.from}))
    mocks.publication.mockResolvedValue({proposal:{id:'proposal-1'},approvalReceiptId:'owner-approval-required'})
    mocks.from.mockImplementation((name:string)=>{
      if(name==='director_project_business_context')return query({plan:{format:'short_film'}})
      if(name==='director_project_final_qc_receipts')return query(null)
      throw new Error('UNEXPECTED_TABLE:'+name)
    })
  })
  it('requires a genuine session before privileged runtime or publishing',async()=>{
    mocks.getUser.mockResolvedValue({data:{user:null}})
    const response=await POST(makeRequest())
    expect(response.status).toBe(401)
    expect(mocks.runtimeClient).not.toHaveBeenCalled()
    expect(mocks.publication).not.toHaveBeenCalled()
  })
  it('rejects foreign project before reading final QC or proposing publication',async()=>{
    mocks.authority.mockRejectedValue(new Error('DIRECTOR_PROJECT_ACCESS_DENIED'))
    const response=await POST(makeRequest())
    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.publication).not.toHaveBeenCalled()
  })
  it('does not launder an unapproved short-film master into a Social proposal',async()=>{
    const response=await POST(makeRequest())
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ok:false,error:'DIRECTOR_SOCIAL_FINAL_QC_ADMISSION_REQUIRED'})
    expect(mocks.from).toHaveBeenCalledWith('director_project_final_qc_receipts')
    expect(mocks.publication).not.toHaveBeenCalled()
  })
  it('fails closed if the OIDC runtime has no service identity',async()=>{
    mocks.runtimeClient.mockResolvedValue(null)
    const response=await POST(makeRequest())
    expect(response.status).toBe(503)
    expect(mocks.publication).not.toHaveBeenCalled()
  })
})
