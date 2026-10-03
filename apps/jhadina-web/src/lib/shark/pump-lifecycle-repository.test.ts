import {describe,expect,it,vi} from 'vitest'
import {
  appendPumpLifecycleObservation,
  loadPumpLaunchQueue,
  runPumpLifecycleObservationWorker,
} from './pump-lifecycle-repository'
import {observePumpLifecycle} from '@jhadina/shark-intelligence-core/meme-trader'

type Row=Record<string,any>

function fixtureClient(rows:Row[]=[]){
  const rpcPayloads:any[]=[]
  const client:any={
    async rpc(name:string,args:any){
      rpcPayloads.push({name,args})
      return {data:'INSERTED',error:null}
    },
    from(table:string){
      expect(table).toBe('jhadina_token_launches')
      let current=[...rows]
      const chain:any={
        select(){return chain},
        eq(column:string,value:any){current=current.filter(row=>row[column]===value);return chain},
        order(column:string,opts:{ascending:boolean}){
          current.sort((a,b)=>String(a[column]).localeCompare(String(b[column]))*(opts.ascending?1:-1))
          return chain
        },
        limit(limit:number){return Promise.resolve({data:current.slice(0,limit),error:null})},
      }
      return chain
    },
  }
  return {client,rpcPayloads}
}

const pumpRow={
  launch_id:'launch:pump',
  chain_id:'solana-mainnet',
  token_address:'MINT',
  launched_at:'2026-10-03T04:00:00Z',
  launchpad:'pump.fun',
  pump_features:null,
  evidence_ids:['launch:e1'],
}

describe('Pump lifecycle durable worker',()=>{
  it('queues only explicitly Pump-qualified Solana launches',async()=>{
    const f=fixtureClient([
      pumpRow,
      {...pumpRow,launch_id:'launch:feature',token_address:'MINT2',launchpad:null,pump_features:{protocol:'PUMP'}},
      {...pumpRow,launch_id:'launch:other',token_address:'MINT3',launchpad:'other',pump_features:null},
      {...pumpRow,launch_id:'launch:evm',chain_id:'eip155:1',token_address:'0x1'},
    ])
    const rows=await loadPumpLaunchQueue(f.client,10)
    expect(rows.map(row=>row.launch_id).sort()).toEqual(['launch:feature','launch:pump'])
  })

  it('persists a read-only lifecycle observation with radar state',async()=>{
    const f=fixtureClient()
    const observation:any={
      observationId:'pump-curve:CURVE:123',
      mint:'MINT',
      bondingCurveAddress:'CURVE',
      observedAt:'2026-10-03T04:10:00Z',
      availableAt:'2026-10-03T04:10:00Z',
      realTokenReserves:0n,
      complete:true,
      evidenceIds:['curve:e1'],
    }
    const lifecycle=observePumpLifecycle({observation})
    const disposition=await appendPumpLifecycleObservation(f.client,{
      launchId:'launch:pump',observation,lifecycle,source:'pump-rpc',
    })
    expect(disposition).toBe('INSERTED')
    expect(f.rpcPayloads[0].name).toBe('jhadina_shark_append_pump_lifecycle_observation')
    expect(f.rpcPayloads[0].args.p_payload.stage).toBe('CURVE_COMPLETE')
    expect(f.rpcPayloads[0].args.p_payload.realTokenReserves).toBe('0')
    expect(f.rpcPayloads[0].args.p_payload.radar.canAuthorizeTrade).toBe(false)
  })

  it('runs the queue through curve observation and append without trade authority',async()=>{
    const f=fixtureClient([pumpRow])
    const observe=vi.fn(async()=>({
      observationId:'pump-curve:CURVE:124',
      mint:'MINT',
      bondingCurveAddress:'CURVE',
      observedAt:'2026-10-03T04:11:00Z',
      availableAt:'2026-10-03T04:11:00Z',
      realTokenReserves:10n,
      complete:false,
      evidenceIds:['curve:e2'],
    }))
    const result=await runPumpLifecycleObservationWorker(f.client,{
      rpcUrl:'https://rpc.example.test',
      limit:10,
      source:{observe} as any,
    })
    expect(observe).toHaveBeenCalledOnce()
    expect(result).toMatchObject({eligible:1,processed:1,inserted:1,replayed:0,failed:0})
    expect(f.rpcPayloads[0].args.p_payload.radar.canAuthorizeTrade).toBe(false)
  })

  it('isolates per-launch failures instead of aborting the whole batch',async()=>{
    const f=fixtureClient([pumpRow,{...pumpRow,launch_id:'launch:pump2',token_address:'MINT2'}])
    const observe=vi.fn()
      .mockRejectedValueOnce(new Error('rpc_down'))
      .mockResolvedValueOnce({
        observationId:'pump-curve:C2:1',mint:'MINT2',bondingCurveAddress:'C2',
        observedAt:'2026-10-03T04:12:00Z',availableAt:'2026-10-03T04:12:00Z',
        realTokenReserves:5n,complete:false,evidenceIds:['curve:e3'],
      })
    const result=await runPumpLifecycleObservationWorker(f.client,{
      rpcUrl:'https://rpc.example.test',limit:10,source:{observe} as any,
    })
    expect(result.failed).toBe(1)
    expect(result.processed).toBe(1)
    expect(result.failures[0]).toEqual({launchId:'launch:pump',reason:'rpc_down'})
  })
})
