import {describe,expect,it} from 'vitest'
import type {StalkChainReadOnlyProvider,StalkChainReadTool,StalkChainToolResponse} from '../stalkchain-provider'
import {runStalkChainTraderResearch} from '../stalkchain-research-runtime'

const response=<T>(tool:StalkChainReadTool,data:T,at:string):StalkChainToolResponse<T>=>({
  data,tool,observedAt:at,creditsRemaining:1000,authority:'EVIDENCE_ONLY',
  canAuthorizeTrade:false,canSign:false,canBroadcast:false,
})

describe('StalkChain research runtime',()=>{
  it('turns leaderboard plus positions into a bounded emerging-trader brief',async()=>{
    const provider:StalkChainReadOnlyProvider={
      async call<T>(tool:StalkChainReadTool):Promise<StalkChainToolResponse<T>>{
        if(tool==='stalkchain_fomo_leaderboard'){
          return response(tool,{traders:[
            {handle:'steady',userId:'u1',followers:500,wallets:{solana:'w1'}},
            {handle:'lottery',userId:'u2',followers:500,wallets:{solana:'w2'}},
          ]},'2026-10-05T00:00:00Z') as StalkChainToolResponse<T>
        }
        if(tool==='stalkchain_fomo_trader_positions'){
          const stack=(provider as unknown as {next?:number}).next??0
          ;(provider as unknown as {next?:number}).next=stack+1
          const positions=stack===0
            ?[
              {tradeId:'a1',token:{address:'A'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:100,costBasisUsd:1000},
              {tradeId:'a2',token:{address:'B'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:90,costBasisUsd:1000},
              {tradeId:'a3',token:{address:'C'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:80,costBasisUsd:1000},
              {tradeId:'a4',token:{address:'D'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:70,costBasisUsd:1000},
              {tradeId:'a5',token:{address:'E'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:-20,costBasisUsd:1000},
            ]
            :[
              {tradeId:'b1',token:{address:'F'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:1000,costBasisUsd:1000},
              {tradeId:'b2',token:{address:'G'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:-100,costBasisUsd:1000},
              {tradeId:'b3',token:{address:'H'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:-100,costBasisUsd:1000},
              {tradeId:'b4',token:{address:'I'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:-100,costBasisUsd:1000},
              {tradeId:'b5',token:{address:'J'},createdAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',realizedPnlUsd:-100,costBasisUsd:1000},
            ]
          return response(tool,{positions},'2026-10-05T00:00:01Z') as StalkChainToolResponse<T>
        }
        throw new Error('unexpected:'+tool)
      },
    }
    const brief=await runStalkChainTraderResearch(provider,{generatedAt:'2026-10-05T00:00:02Z',limit:2,minClosedSamples:5})
    expect(brief.traders).toHaveLength(2)
    expect(brief.emerging[0]?.traderKey).toBe('fomo-user:u1')
    expect(brief.emerging[1]?.reasons).toContain('tail-winner-dependent')
    expect(brief.failures).toEqual([])
    expect(brief.canExecute).toBe(false)
    expect(brief.canAuthorizeTrade).toBe(false)
  })
})
