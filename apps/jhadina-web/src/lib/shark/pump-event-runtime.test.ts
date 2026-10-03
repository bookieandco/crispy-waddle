import {describe,expect,it} from 'vitest'
import {
  PUMP_EVENT_DISCRIMINATORS,
  PUMP_PROGRAM_ID,
  type PumpDecodedStreamEvent,
} from '@jhadina/shark-intelligence-core/meme-trader'
import {processPumpDecodedStreamEvent} from './pump-event-runtime'

const mint='3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump'
const user='11111111111111111111111111111111'
const launchId=`launch:solana-mainnet:${mint}`

const event=(overrides:Partial<PumpDecodedStreamEvent>):PumpDecodedStreamEvent=>({
  eventId:'event:1',programId:PUMP_PROGRAM_ID,eventName:'CreateEvent',
  eventDiscriminator:PUMP_EVENT_DISCRIMINATORS.CreateEvent,
  signature:'sig1',slot:100,observedAt:'2026-10-03T05:00:00Z',
  availableAt:'2026-10-03T05:00:00.100Z',source:'helius-parsed-stream',
  data:{mint,bonding_curve:'CURVE',user,creator:user,real_token_reserves:'1000'},
  ...overrides,
})

type Row=Record<string,any>
function fixture(input:{lifecycle?:Row[];launches?:Row[]}={}){
  const tables:Record<string,Row[]>={
    jhadina_shark_pump_lifecycle_observations:[...(input.lifecycle??[])],
    jhadina_token_launches:[...(input.launches??[])],
  }
  const rpcCalls:any[]=[]
  const client:any={
    async rpc(name:string,args:any){
      rpcCalls.push({name,args})
      if(name==='jhadina_shark_persist_launch_bundle')return {data:args.p_launch.launch_id,error:null}
      if(name==='jhadina_shark_append_pump_lifecycle_observation')return {data:'INSERTED',error:null}
      return {data:null,error:{message:'unexpected rpc'}}
    },
    from(table:string){
      let rows=[...(tables[table]??[])]
      const chain:any={
        select(){return chain},
        eq(column:string,value:any){rows=rows.filter(row=>row[column]===value);return chain},
        order(column:string,opts:{ascending:boolean}){
          rows.sort((a,b)=>String(a[column]).localeCompare(String(b[column]))*(opts.ascending?1:-1))
          return chain
        },
        limit(limit:number){return Promise.resolve({data:rows.slice(0,limit),error:null})},
      }
      return chain
    },
  }
  return {client,rpcCalls}
}

describe('Pump decoded event durable runtime',()=>{
  it('persists CreateEvent as a Pump launch before appending lifecycle evidence',async()=>{
    const f=fixture()
    const result=await processPumpDecodedStreamEvent(f.client,event({}))
    expect(result.launchId).toBe(launchId)
    expect(result.launchPersisted).toBe(true)
    expect(result.lifecycleDisposition).toBe('INSERTED')
    expect(f.rpcCalls.map(call=>call.name)).toEqual([
      'jhadina_shark_persist_launch_bundle',
      'jhadina_shark_append_pump_lifecycle_observation',
    ])
    expect(f.rpcCalls[0].args.p_launch.launchpad).toBe('pump.fun')
    expect(f.rpcCalls[1].args.p_payload.initialRealTokenReserves).toBe('1000')
    expect(result.canAuthorizeTrade).toBe(false)
  })

  it('rehydrates initial reserve state for a stateless TradeEvent call',async()=>{
    const f=fixture({
      lifecycle:[{
        mint,available_at:'2026-10-03T05:00:00Z',bonding_curve_address:'CURVE',quote_mint:null,
        initial_real_token_reserves:'1000',curve_complete:false,mayhem_mode:false,
      }],
      launches:[{launch_id:launchId,chain_id:'solana-mainnet',token_address:mint}],
    })
    const result=await processPumpDecodedStreamEvent(f.client,event({
      eventId:'event:trade',eventName:'TradeEvent',
      eventDiscriminator:PUMP_EVENT_DISCRIMINATORS.TradeEvent,
      signature:'sig2',slot:101,observedAt:'2026-10-03T05:00:01Z',availableAt:'2026-10-03T05:00:01.050Z',
      data:{mint,real_token_reserves:'50',is_buy:true},
    }))
    expect(result.launchPersisted).toBe(false)
    expect(result.update.observation.initialRealTokenReserves).toBe(1000n)
    expect(result.update.radar.graduationProgress).toBe(.95)
    expect(result.update.radar.stage).toBe('APPROACHING_GRADUATION')
  })

  it('fails closed on a mid-stream event when durable prior lifecycle is absent',async()=>{
    const f=fixture({launches:[{launch_id:launchId,chain_id:'solana-mainnet',token_address:mint}]})
    await expect(processPumpDecodedStreamEvent(f.client,event({
      eventName:'TradeEvent',eventDiscriminator:PUMP_EVENT_DISCRIMINATORS.TradeEvent,
      data:{mint,real_token_reserves:'50'},
    }))).rejects.toThrow('PRIOR_LIFECYCLE_REQUIRED')
    expect(f.rpcCalls).toHaveLength(0)
  })

  it('persists a migration pool as unverified until canonical migration verification',async()=>{
    const f=fixture({
      lifecycle:[{
        mint,available_at:'2026-10-03T05:00:00Z',bonding_curve_address:'CURVE',quote_mint:'QUOTE',
        initial_real_token_reserves:'1000',curve_complete:true,mayhem_mode:false,
      }],
      launches:[{launch_id:launchId,chain_id:'solana-mainnet',token_address:mint}],
    })
    const result=await processPumpDecodedStreamEvent(f.client,event({
      eventName:'CompletePumpAmmMigrationEvent',
      eventDiscriminator:PUMP_EVENT_DISCRIMINATORS.CompletePumpAmmMigrationEvent,
      data:{mint,bonding_curve:'CURVE',quote_mint:'QUOTE',pool:'POOL'},
    }))
    expect(result.update.migrationPoolHint).toBe('POOL')
    expect(result.update.observation.pumpSwapPoolVerified).toBe(false)
    expect(result.update.radar.stage).toBe('CURVE_COMPLETE')
    expect(f.rpcCalls.at(-1).args.p_payload.pumpSwapPoolVerified).toBe(false)
  })
})
