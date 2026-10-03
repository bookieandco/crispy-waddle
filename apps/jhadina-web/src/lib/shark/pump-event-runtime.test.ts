import {describe,expect,it} from 'vitest'
import {
  PUMP_EVENT_DISCRIMINATORS,
  PUMP_PROGRAM_ID,
  decodeBase58,
  derivePumpBondingCurveAddress,
  type PumpDecodedStreamEvent,
} from '@jhadina/shark-intelligence-core/meme-trader'
import {processPumpDecodedStreamEvent,processPumpLogsNotification} from './pump-event-runtime'

const mint='3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump'
const user='11111111111111111111111111111111'
const launchId=`launch:solana-mainnet:${mint}`


const bytes=(...values:Uint8Array[])=>{
  const out=new Uint8Array(values.reduce((sum,value)=>sum+value.length,0));let offset=0
  for(const value of values){out.set(value,offset);offset+=value.length}
  return out
}
const u32=(value:number)=>Uint8Array.of(value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255)
const u64=(value:bigint)=>{
  const out=new Uint8Array(8);let n=value
  for(let i=0;i<8;i++){out[i]=Number(n&255n);n>>=8n}
  return out
}
const text=(value:string)=>{const encoded=new TextEncoder().encode(value);return bytes(u32(encoded.length),encoded)}
const anchorLog=(disc:readonly number[],payload:Uint8Array)=>'Program data: '+btoa(String.fromCharCode(...bytes(Uint8Array.from(disc),payload)))

const event=(overrides:Partial<PumpDecodedStreamEvent>):PumpDecodedStreamEvent=>({
  eventId:'event:1',programId:PUMP_PROGRAM_ID,eventName:'CreateEvent',
  eventDiscriminator:PUMP_EVENT_DISCRIMINATORS.CreateEvent,
  signature:'sig1',slot:100,observedAt:'2026-10-03T05:00:00Z',
  availableAt:'2026-10-03T05:00:00.100Z',source:'helius-parsed-stream',
  data:{mint,user,creator:user,real_token_reserves:'1000'},
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
        mint,available_at:'2026-10-03T05:00:00Z',bonding_curve_address:null,quote_mint:null,
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
        mint,available_at:'2026-10-03T05:00:00Z',bonding_curve_address:null,quote_mint:'QUOTE',
        initial_real_token_reserves:'1000',curve_complete:true,mayhem_mode:false,
      }],
      launches:[{launch_id:launchId,chain_id:'solana-mainnet',token_address:mint}],
    })
    const result=await processPumpDecodedStreamEvent(f.client,event({
      eventName:'CompletePumpAmmMigrationEvent',
      eventDiscriminator:PUMP_EVENT_DISCRIMINATORS.CompletePumpAmmMigrationEvent,
      data:{mint,quote_mint:'QUOTE',pool:'POOL'},
    }))
    expect(result.update.migrationPoolHint).toBe('POOL')
    expect(result.update.observation.pumpSwapPoolVerified).toBe(false)
    expect(result.update.radar.stage).toBe('CURVE_COMPLETE')
    expect(f.rpcCalls.at(-1).args.p_payload.pumpSwapPoolVerified).toBe(false)
  })

  it('processes CreateEvent plus immediate TradeEvent in one logs notification without losing the launch baseline',async()=>{
    const f=fixture()
    const curve=(await derivePumpBondingCurveAddress(mint)).address
    const createPayload=bytes(
      text('Name'),text('SYM'),text('uri'),
      decodeBase58(mint),decodeBase58(curve),decodeBase58(user),decodeBase58(user),
      u64(1791003600n),u64(2000n),u64(3000n),u64(1000n),u64(1_000_000n),
    )
    const tradePayload=bytes(
      decodeBase58(mint),u64(100n),u64(200n),Uint8Array.of(1),decodeBase58(user),u64(1791003601n),
      u64(3100n),u64(1900n),u64(600n),u64(50n),
    )
    const results=await processPumpLogsNotification(f.client,{
      receivedAt:'2026-10-03T05:00:02Z',
      payload:{
        method:'logsNotification',
        params:{result:{context:{slot:200},value:{signature:'sig-batch',err:null,logs:[
          `Program ${PUMP_PROGRAM_ID} invoke [1]`,
          anchorLog(PUMP_EVENT_DISCRIMINATORS.CreateEvent,createPayload),
          `Program ${PUMP_PROGRAM_ID} success`,
          `Program ${PUMP_PROGRAM_ID} invoke [1]`,
          anchorLog(PUMP_EVENT_DISCRIMINATORS.TradeEvent,tradePayload),
          `Program ${PUMP_PROGRAM_ID} success`,
        ]}}},
      },
    })
    expect(results).toHaveLength(2)
    expect(results[0]?.update.observation.initialRealTokenReserves).toBe(1000n)
    expect(results[1]?.update.observation.initialRealTokenReserves).toBe(1000n)
    expect(results[1]?.update.radar.graduationProgress).toBe(.95)
    expect(f.rpcCalls.map(call=>call.name)).toEqual([
      'jhadina_shark_persist_launch_bundle',
      'jhadina_shark_append_pump_lifecycle_observation',
      'jhadina_shark_append_pump_lifecycle_observation',
    ])
  })

})
