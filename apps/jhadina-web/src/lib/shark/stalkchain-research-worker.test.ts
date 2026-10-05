import type {SupabaseClient} from '@supabase/supabase-js'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {STALKCHAIN_CANARY_CONFIG,runStalkChainProviderAdmission,runStalkChainResearchWorker,stalkChainResearchWorkerConfig} from './stalkchain-research-worker'

afterEach(()=>{vi.unstubAllGlobals()})

describe('StalkChain scheduled research worker',()=>{
  it('persists a bounded read-only brief and never returns execution authority',async()=>{
    const fetchMock=vi.fn(async(input:string|URL|Request)=>{
      const url=String(input)
      const data=url.includes('stalkchain_fomo_leaderboard')
        ?{traders:[{handle:'steady',userId:'u1',followers:500,wallets:{solana:'w1'}}]}
        :url.includes('stalkchain_fomo_trader_positions')
          ?{positions:[
            {tradeId:'a1',token:{address:'A'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:100,costBasisUsd:1000},
            {tradeId:'a2',token:{address:'B'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:90,costBasisUsd:1000},
            {tradeId:'a3',token:{address:'C'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:80,costBasisUsd:1000},
            {tradeId:'a4',token:{address:'D'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:70,costBasisUsd:1000},
            {tradeId:'a5',token:{address:'E'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:-20,costBasisUsd:1000},
          ]}
          :url.includes('stalkchain_fomo_theses_by_trader')
            ?{theses:[{id:'t1',tokenAddress:'A',text:'early catalyst',createdAt:'2026-10-01T00:00:00Z',tradeUsd:1000}]}
            :undefined
      if(data===undefined)return new Response(JSON.stringify({code:'unexpected_tool'}),{status:404})
      return new Response(JSON.stringify({data,credits:{remaining:321},meta:{durationMs:2}}),{
        status:200,headers:{'content-type':'application/json'},
      })
    })
    vi.stubGlobal('fetch',fetchMock)

    const rpc=vi.fn(async(name:string,args:Record<string,unknown>)=>{
      expect(name).toBe('jhadina_shark_append_stalkchain_research_brief')
      const payload=(args as {p_payload:any}).p_payload
      expect(payload.source).toBe('stalkchain-fomo-read-only')
      expect(payload.traderCount).toBe(1)
      expect(payload.brief.authority).toBe('RESEARCH_ONLY')
      expect(payload.brief.canExecute).toBe(false)
      return {data:'INSERTED',error:null}
    })
    const client={rpc} as unknown as SupabaseClient

    const result=await runStalkChainResearchWorker(client,{
      apiKey:'sc_test',
      generatedAt:'2026-10-05T12:00:00Z',
      leaderboardWindow:'7d',
      limit:1,
      positionLimit:10,
      includeTheses:true,
      thesisLimit:5,
    })

    expect(result.disposition).toBe('INSERTED')
    expect(result.traders).toBe(1)
    expect(result.emerging).toBe(1)
    expect(result.authority).toBe('READ_ONLY_RESEARCH')
    expect(result.canAuthorizeTrade).toBe(false)
    expect(result.canExecute).toBe(false)
    expect(result.canSign).toBe(false)
    expect(result.canBroadcast).toBe(false)
    expect(result.persistenceReplayVerified).toBe(false)
    expect(result.replayDisposition).toBeUndefined()
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('proves the exact persisted canary brief replays without a second provider read',async()=>{
    const fetchMock=vi.fn(async(input:string|URL|Request)=>{
      const url=String(input)
      const data=url.includes('stalkchain_fomo_leaderboard')
        ?{traders:[{handle:'steady',userId:'u1',followers:500,wallets:{solana:'w1'}}]}
        :url.includes('stalkchain_fomo_trader_positions')
          ?{positions:[]}
          :undefined
      if(data===undefined)return new Response(JSON.stringify({code:'unexpected_tool'}),{status:404})
      return new Response(JSON.stringify({data,credits:{remaining:321},meta:{durationMs:2}}),{
        status:200,headers:{'content-type':'application/json'},
      })
    })
    vi.stubGlobal('fetch',fetchMock)
    const rpc=vi.fn()
      .mockResolvedValueOnce({data:'INSERTED',error:null})
      .mockResolvedValueOnce({data:'REPLAY',error:null})
    const client={rpc} as unknown as SupabaseClient
    const result=await runStalkChainResearchWorker(client,{
      apiKey:'sc_test',
      generatedAt:'2026-10-05T12:00:00Z',
      ...STALKCHAIN_CANARY_CONFIG,
      verifyPersistenceReplay:true,
    })
    expect(result.disposition).toBe('INSERTED')
    expect(result.replayDisposition).toBe('REPLAY')
    expect(result.persistenceReplayVerified).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('admits a configured provider with only free status/account calls',async()=>{
    const fetchMock=vi.fn(async(input:string|URL|Request)=>{
      const url=String(input)
      if(!url.includes('stalkchain_health')&&!url.includes('stalkchain_account')){
        return new Response(JSON.stringify({code:'unexpected_tool'}),{status:404})
      }
      return new Response(JSON.stringify({data:{ok:true},credits:{remaining:9000},meta:{durationMs:1}}),{
        status:200,headers:{'content-type':'application/json'},
      })
    })
    vi.stubGlobal('fetch',fetchMock)
    const result=await runStalkChainProviderAdmission('sc_test')
    expect(result.serviceHealthy).toBe(true)
    expect(result.accountReadable).toBe(true)
    expect(result.creditsRemaining).toBe(9000)
    expect(result.canAuthorizeTrade).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the live canary deliberately cheaper than the scheduled workload',()=>{
    expect(STALKCHAIN_CANARY_CONFIG).toEqual({
      leaderboardWindow:'7d',
      limit:1,
      positionLimit:10,
      includeTheses:false,
      thesisLimit:1,
    })
  })

  it('parses bounded environment configuration and rejects invalid values',()=>{
    expect(stalkChainResearchWorkerConfig({
      SHARK_STALKCHAIN_LEADERBOARD_WINDOW:'30d',
      SHARK_STALKCHAIN_TRADER_LIMIT:'12',
      SHARK_STALKCHAIN_POSITION_LIMIT:'80',
      SHARK_STALKCHAIN_INCLUDE_THESES:'false',
      SHARK_STALKCHAIN_THESIS_LIMIT:'20',
    } as unknown as NodeJS.ProcessEnv)).toEqual({
      leaderboardWindow:'30d',
      limit:12,
      positionLimit:80,
      includeTheses:false,
      thesisLimit:20,
    })
    expect(()=>stalkChainResearchWorkerConfig({SHARK_STALKCHAIN_TRADER_LIMIT:'999'} as unknown as NodeJS.ProcessEnv))
      .toThrow('SHARK_STALKCHAIN_TRADER_LIMIT_INVALID')
  })
})
