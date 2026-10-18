import { describe,it,expect,vi } from 'vitest'
import { checkZeroRigLiveReadiness,executeZeroRigReadOnlyScout } from './zero-rig-live-runtime'

const owner='owner-user-1'
const fullEnv={
  ZERO_RIG_OWNER_USER_ID:owner,
  ZERO_RIG_SUPERTEAM_READS_ENABLED:'true',
  ZERO_RIG_SUPERTEAM_API_KEY:'sk_goodAgentKey1234',
}
const now='2026-10-17T20:00:00.000Z'
describe('ZERO-RIG.LIVE: owner-scoped read-only commissioning',()=>{
  it('fails closed before an owner is configured',()=>{
    expect(checkZeroRigLiveReadiness(owner,{}).state).toBe('owner_unconfigured')
    expect(checkZeroRigLiveReadiness('another-user',fullEnv).state).toBe('forbidden')
    expect(checkZeroRigLiveReadiness(owner,{...fullEnv,ZERO_RIG_SUPERTEAM_READS_ENABLED:'false'}).state).toBe('disabled')
    expect(checkZeroRigLiveReadiness(owner,{...fullEnv,ZERO_RIG_SUPERTEAM_API_KEY:''}).state).toBe('credential_missing')
    const ready=checkZeroRigLiveReadiness(owner,fullEnv)
    expect(ready.state).toBe('ready')
    expect(ready.externalActionsAuthorized).toBe(false)
  })
  it('does not access provider when disabled or user is not owner',async()=>{
    const fetchImpl=vi.fn() as unknown as typeof fetch
    await expect(executeZeroRigReadOnlyScout({userId:'stranger',env:fullEnv,now,fetchImpl})).rejects.toThrow('ZERO_RIG_READ_UNAVAILABLE')
    await expect(executeZeroRigReadOnlyScout({userId:owner,env:{...fullEnv,ZERO_RIG_SUPERTEAM_READS_ENABLED:'false'},now,fetchImpl})).rejects.toThrow('ZERO_RIG_READ_UNAVAILABLE')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('only uses one authenticated safe GET with no submissions',async()=>{
    const fetchImpl=vi.fn(async(_:RequestInfo|URL,init?:RequestInit)=>{
      expect(init?.method).toBe('GET')
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer '+fullEnv.ZERO_RIG_SUPERTEAM_API_KEY)
      return new Response(JSON.stringify({result:[{
        id:'one',slug:'agent-bounty',title:'Research',type:'bounty',status:'OPEN',
        agentAccess:'AGENT_ONLY',deadline:'2026-11-20T00:00:00.000Z',
      }]}),{headers:{'content-type':'application/json'}})
    }) as typeof fetch
    const result=await executeZeroRigReadOnlyScout({userId:owner,env:fullEnv,now,take:5,fetchImpl})
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result.listings).toHaveLength(1)
    expect(result.submissionAuthorized).toBe(false)
    expect(result.claimAuthorized).toBe(false)
    expect(result.spendingAuthorized).toBe(false)
  })
})
