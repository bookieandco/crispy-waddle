import {beforeEach,describe,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({
  user:{id:'owner'} as {id:string}|null,
  authorized:true,
  unavailable:false,
  missing:new Set<string>(['director_project_inputs','director_recast_review_receipts']),
  tables:[] as string[],
  writes:0,
}))
vi.mock('@/lib/supabase/server',()=>({
  createClient:async()=>({auth:{getUser:async()=>({data:{user:mocks.user}})}}),
}))
vi.mock('@/lib/director-project-authority',()=>({
  requireDirectorProjectAuthority:async(_db:unknown,opts:{userId:string;projectId:string;capability:string})=>{
    if(!mocks.authorized||opts.userId!=='owner'||opts.projectId!=='project:a'||opts.capability!=='edit')
      throw new Error('DIRECTOR_PROJECT_ACCESS_DENIED')
  },
}))
vi.mock('@/lib/supabase/service-role',()=>({
  createServiceRoleClient:()=>{
    if(mocks.unavailable)return null
    return {from:(table:string)=>{
      mocks.tables.push(table)
      const q:any={}
      q.select=()=>q
      q.eq=()=>q
      q.limit=async()=>({data:[],error:mocks.missing.has(table)?{code:'PGRST205'}:null})
      q.insert=()=>{mocks.writes++;throw Error('WRITE_FORBIDDEN')}
      return q
    }}
  },
}))
import {GET} from './route'
const request=()=>new Request('https://example.test/api/director/recast/readiness?projectId=project%3Aa')
describe('Recast read-only runtime readiness',()=>{
  beforeEach(()=>{
    mocks.user={id:'owner'};mocks.authorized=true;mocks.unavailable=false
    mocks.tables=[];mocks.writes=0
    mocks.missing=new Set(['director_project_inputs','director_recast_review_receipts'])
  })
  it('reports missing Workstation and Recast receipts without inventing permits',async()=>{
    const response=await GET(request())
    expect(response.status).toBe(200)
    const data=await response.json()
    expect(data.sourceUploadReady).toBe(false)
    expect(data.schemaDiagnostics.projectInputs).toBe('MISSING_TABLE')
    expect(data.canMigrateAutomatically).toBe(false)
    expect(data.reviewStoreReady).toBe(false)
    expect(data.nextBlockingGate).toBe('DIRECTOR_RECAST_WORKSTATION_PROJECT_INPUTS_MIGRATION_MISSING')
    expect(data.readyForLivePreview).toBe(false)
    expect(data.noMutationPerformed).toBe(true)
    expect(mocks.writes).toBe(0)
  })
  it('refuses unauthenticated and forbidden project access before DB inspection',async()=>{
    mocks.user=null
    expect((await GET(request())).status).toBe(401)
    expect(mocks.tables).toEqual([])
    mocks.user={id:'owner'};mocks.authorized=false
    expect((await GET(request())).status).toBe(403)
    expect(mocks.tables).toEqual([])
  })
  it('healthy schema does not imply approval to render, spend, or publish',async()=>{
    mocks.missing.clear()
    const data=await(await GET(request())).json()
    expect(data.sourceUploadReady).toBe(true)
    expect(data.reviewStoreReady).toBe(true)
    expect(data.readyForLivePreview).toBe(false)
    expect(data.executionAuthority).toBe('NONE')
    expect(data.publicationAuthority).toBe('NONE')
    expect(mocks.writes).toBe(0)
  })
  it('a storage outage fails closed',async()=>{
    mocks.unavailable=true
    expect((await GET(request())).status).toBe(503)
  })
})