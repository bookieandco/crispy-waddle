import {describe,expect,it,vi} from 'vitest'
import {createStalkChainReadOnlyProvider,STALKCHAIN_PROVIDER_AUTHORITY} from '../stalkchain-provider'

describe('StalkChain read-only provider',()=>{
  it('uses the structured API and never returns execution authority',async()=>{
    const fetchImpl=vi.fn(async(url:string|URL|Request,init?:RequestInit)=>new Response(JSON.stringify({
      data:{window:'7d',traders:[{handle:'alpha'}]},
      credits:{remaining:999},
      meta:{tool:'stalkchain_fomo_leaderboard',durationMs:12},
    }),{status:200,headers:{'content-type':'application/json'}}))
    const provider=createStalkChainReadOnlyProvider({
      apiKey:'sc_test',
      fetchImpl:fetchImpl as typeof fetch,
      now:()=>new Date('2026-10-05T12:00:00Z'),
    })
    const result=await provider.call<{window:string}>('stalkchain_fomo_leaderboard',{window:'7d',limit:5})
    expect(result.data.window).toBe('7d')
    expect(result.creditsRemaining).toBe(999)
    expect(result.authority).toBe('EVIDENCE_ONLY')
    expect(result.canAuthorizeTrade).toBe(false)
    expect(result.canSign).toBe(false)
    expect(result.canBroadcast).toBe(false)
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('stalkchain_fomo_leaderboard?window=7d&limit=5')
    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({authorization:'Bearer sc_test'})
    expect(STALKCHAIN_PROVIDER_AUTHORITY.canMoveFunds).toBe(false)
  })

  it('fails closed on vendor errors without leaking the key',async()=>{
    const provider=createStalkChainReadOnlyProvider({
      apiKey:'sc_secret',
      fetchImpl:(async()=>new Response(JSON.stringify({code:'out_of_credits'}),{status:402})) as typeof fetch,
    })
    await expect(provider.call('stalkchain_fomo_token_holders',{address:'TOKEN'})).rejects.toThrow('stalkchain_request_failed:out_of_credits')
    try{await provider.call('stalkchain_fomo_token_holders',{address:'TOKEN'})}catch(error){
      expect(String(error)).not.toContain('sc_secret')
    }
  })
})
