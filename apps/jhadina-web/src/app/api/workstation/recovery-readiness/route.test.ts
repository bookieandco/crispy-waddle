import {beforeEach,describe,expect,it,vi} from 'vitest'

const mocks=vi.hoisted(()=>({
  getUser:vi.fn(),
  runtimeClient:vi.fn(),
  authority:vi.fn(),
  probe:vi.fn(),
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
vi.mock('@/lib/director-schema-recovery',()=>({
  inspectDirectorDurableStoreReadiness:mocks.probe,
}))
import {GET} from './route'
const request=()=>new Request('https://example.test/api/workstation/recovery-readiness?projectId=project-a')

describe('Director durable schema recovery endpoint',()=>{
  beforeEach(()=>{
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({data:{user:{id:'owner-a'}}})
    mocks.runtimeClient.mockResolvedValue({from:vi.fn()})
    mocks.authority.mockResolvedValue({projectId:'project-a',role:'owner'})
    mocks.probe.mockResolvedValue({
      schemaReadable:false,
      durableRoundTripCertified:false,
      independentRestoreCertified:false,
      canApplyMigrations:false,
      probes:[{table:'director_workstation_timelines',readable:false,blocker:'MISSING_SCHEMA'}],
      authority:'READ_ONLY_SCHEMA_PROBE',
    })
  })
  it('never probes storage for an unauthenticated user',async()=>{
    mocks.getUser.mockResolvedValue({data:{user:null}})
    const response=await GET(request())
    expect(response.status).toBe(401)
    expect(mocks.runtimeClient).not.toHaveBeenCalled()
    expect(mocks.probe).not.toHaveBeenCalled()
  })
  it('rejects foreign projects before any schema probe',async()=>{
    mocks.authority.mockRejectedValue(new Error('DIRECTOR_PROJECT_ACCESS_DENIED'))
    const response=await GET(request())
    expect(response.status).toBe(403)
    expect(mocks.probe).not.toHaveBeenCalled()
  })
  it('reports absent durable schema without granting edit/publish authority',async()=>{
    const response=await GET(request())
    expect(response.status).toBe(503)
    const body=await response.json()
    expect(body).toMatchObject({
      ok:false,
      schemaReadable:false,
      canEditProduction:false,
      canDispatchWatch:false,
      durableRoundTripCertified:false,
      independentRestoreCertified:false,
      nextBoundary:'DIRECTOR_SCHEMA_RECONCILIATION_REQUIRED',
    })
    expect(mocks.authority).toHaveBeenCalledWith(expect.anything(),
      {projectId:'project-a',userId:'owner-a',capability:'read'})
    expect(response.headers.get('cache-control')).toBe('no-store, private')
  })
  it('does not treat all reachable stores as durable restoration proof',async()=>{
    mocks.probe.mockResolvedValue({
      schemaReadable:true,
      durableRoundTripCertified:false,
      independentRestoreCertified:false,
      canApplyMigrations:false,
      probes:[],authority:'READ_ONLY_SCHEMA_PROBE',
    })
    const response=await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      schemaReadable:true,
      durableRoundTripCertified:false,
      canEditProduction:false,
      nextBoundary:'DURABLE_WRITE_AND_RESTORE_CERT_REQUIRED',
    })
  })
})
