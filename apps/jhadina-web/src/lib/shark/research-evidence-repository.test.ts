import {describe,expect,it} from 'vitest'
import {
  SHARK_RESEARCH_CLUSTER_THRESHOLD_GRID,
  appendMeteoraCashFlowEvidence,
  appendMeteoraPositionStateEvidence,
  appendWalletClusterCalibrationObservation,
  evaluatePersistedMeteoraProfitability,
  evaluatePersistedWalletClusterCalibration,
} from './research-evidence-repository'

type Row={payload:any;position?:string;currency?:string;available_at?:string}

function fixtureClient(input:{clusterRows?:Row[];flowRows?:Row[];stateRows?:Row[]}={}){
  const tables:Record<string,Row[]>={
    jhadina_shark_wallet_cluster_calibration_observations:[...(input.clusterRows??[])],
    jhadina_shark_meteora_cash_flow_evidence:[...(input.flowRows??[])],
    jhadina_shark_meteora_position_state_evidence:[...(input.stateRows??[])],
  }
  const rpcPayloads:any[]=[]
  const client:any={
    async rpc(name:string,args:any){
      rpcPayloads.push({name,args})
      return {data:'INSERTED',error:null}
    },
    from(table:string){
      let rows=[...(tables[table]??[])]
      const chain:any={
        select(){return chain},
        eq(column:string,value:any){rows=rows.filter(row=>(row as any)[column]===value);return chain},
        lte(column:string,value:any){rows=rows.filter(row=>String((row as any)[column])<=String(value));return chain},
        order(column:string,opts:{ascending:boolean}){
          rows.sort((a,b)=>String((a as any)[column]).localeCompare(String((b as any)[column]))*(opts.ascending?1:-1))
          return chain
        },
        limit(limit:number){return Promise.resolve({data:rows.slice(0,limit),error:null})},
      }
      return chain
    },
  }
  return {client,rpcPayloads}
}

const clusterObservation:any={
  observationId:'cluster:o1',tokenId:'token:1',distinctWallets:3,windowSeconds:600,aggregateWalletScore:7,totalUsd:1000,
  observedAt:'2026-09-01T00:00:00Z',availableAt:'2026-09-01T00:00:01Z',outcome:'HEALTHY',evidenceIds:['z','a'],
}
const valuedFlow=(id:string,kind:'DEPOSIT'|'WITHDRAWAL'|'FEE',amount:string,availableAt='2026-09-01T00:00:01Z')=>({
  evidenceId:id,transactionId:'tx:'+id,position:'position-1',kind,amountMinor:amount,currency:'USDC',
  amountSemantics:'VERIFIED_VALUATION',valuationEvidenceIds:['price:'+id],
  observedAt:'2026-09-01T00:00:00Z',availableAt,source:'fixture',
})
const positionState=(availableAt='2026-09-01T00:00:03Z')=>({
  stateId:'state-1',position:'position-1',currency:'USDC',positionClosed:true,transactionHistoryComplete:true,
  observedAt:'2026-09-01T00:00:02Z',availableAt,evidenceIds:['state:e1'],source:'fixture',
})

describe('SHARK-CONVERGE.8 durable research evidence runtime',()=>{
  it('canonicalizes cluster append payloads and retains research-only threshold grid',async()=>{
    const f=fixtureClient()
    const disposition=await appendWalletClusterCalibrationObservation(f.client,{observation:clusterObservation,source:' detector '})
    expect(disposition).toBe('INSERTED')
    expect(f.rpcPayloads[0].name).toBe('jhadina_shark_append_cluster_calibration_observation')
    expect(f.rpcPayloads[0].args.p_payload.evidenceIds).toEqual(['a','z'])
    expect(f.rpcPayloads[0].args.p_payload.source).toBe('detector')
    expect(SHARK_RESEARCH_CLUSTER_THRESHOLD_GRID).toHaveLength(27)
  })

  it('evaluates persisted cluster evidence PIT without production-threshold authority',async()=>{
    const f=fixtureClient({clusterRows:[
      {available_at:'2026-09-01T00:00:01Z',payload:{...clusterObservation,evidenceIds:['a'],source:'fixture'}},
      {available_at:'2026-09-03T00:00:01Z',payload:{...clusterObservation,observationId:'future',tokenId:'token:2',availableAt:'2026-09-03T00:00:01Z',evidenceIds:['future'],source:'fixture'}},
    ]})
    const report=await evaluatePersistedWalletClusterCalibration(f.client,{informationCutoff:'2026-09-02T00:00:00Z'})
    expect(report.observationCount).toBe(1)
    expect(report.excludedFutureObservationIds).toEqual(['future'])
    expect(report.canMutateRuntimeThresholds).toBe(false)
    expect(report.rows.every(row=>row.canSelectProductionThreshold===false)).toBe(true)
  })

  it('serializes Meteora bigint evidence and state through append-only RPCs',async()=>{
    const f=fixtureClient()
    await appendMeteoraCashFlowEvidence(f.client,{source:'meteora-indexer',flow:{
      ...valuedFlow('deposit','DEPOSIT','100000'),
      amountMinor:100000n,
    } as any})
    await appendMeteoraPositionStateEvidence(f.client,{source:'meteora-indexer',state:{
      ...positionState(),
    } as any})
    expect(f.rpcPayloads[0].args.p_payload.amountMinor).toBe('100000')
    expect(f.rpcPayloads[0].args.p_payload.valuationEvidenceIds).toEqual(['price:deposit'])
    expect(f.rpcPayloads[1].name).toBe('jhadina_shark_append_meteora_position_state')
  })

  it('uses the latest state available at cutoff and excludes future flows without hindsight mutation',async()=>{
    const f=fixtureClient({
      flowRows:[
        {position:'position-1',currency:'USDC',available_at:'2026-09-01T00:00:01Z',payload:valuedFlow('deposit','DEPOSIT','100000')},
        {position:'position-1',currency:'USDC',available_at:'2026-09-01T00:00:02Z',payload:valuedFlow('withdraw','WITHDRAWAL','110000','2026-09-01T00:00:02Z')},
        {position:'position-1',currency:'USDC',available_at:'2026-09-03T00:00:00Z',payload:valuedFlow('future-fee','FEE','2000','2026-09-03T00:00:00Z')},
      ],
      stateRows:[
        {position:'position-1',currency:'USDC',available_at:'2026-08-31T23:00:00Z',payload:{...positionState('2026-08-31T23:00:00Z'),stateId:'old',positionClosed:false,observedAt:'2026-08-31T22:59:59Z'}},
        {position:'position-1',currency:'USDC',available_at:'2026-09-01T00:00:03Z',payload:positionState()},
        {position:'position-1',currency:'USDC',available_at:'2026-09-04T00:00:00Z',payload:{...positionState('2026-09-04T00:00:00Z'),stateId:'future-state',observedAt:'2026-09-04T00:00:00Z'}},
      ],
    })
    const result=await evaluatePersistedMeteoraProfitability(f.client,{
      position:'position-1',currency:'USDC',informationCutoff:'2026-09-02T00:00:00Z',
    })
    expect(result.realizationStatus).toBe('CLOSED_COMPLETE')
    expect(result.valuationStatus).toBe('VERIFIED')
    expect(result.realizedPnlMinor).toBe(10000n)
    expect(result.excludedFutureEvidenceIds).toEqual(['future-fee'])
    expect(result.evidenceIds).toContain('state:e1')
    expect(result.authority).toBe('RESEARCH_ONLY')
  })

  it('fails closed without state evidence or when the bounded research window truncates',async()=>{
    const noState=fixtureClient({flowRows:[
      {position:'position-1',currency:'USDC',available_at:'2026-09-01T00:00:01Z',payload:valuedFlow('deposit','DEPOSIT','1')},
    ]})
    await expect(evaluatePersistedMeteoraProfitability(noState.client,{position:'position-1',currency:'USDC',informationCutoff:'2026-09-02T00:00:00Z'}))
      .rejects.toThrow('POSITION_STATE_REQUIRED')

    const rows=Array.from({length:3},(_,i)=>({
      available_at:`2026-09-01T00:00:0${i}Z`,
      payload:{...clusterObservation,observationId:'o'+i,tokenId:'t'+i,availableAt:`2026-09-01T00:00:0${i}Z`,evidenceIds:['e'+i],source:'fixture'},
    }))
    const truncated=fixtureClient({clusterRows:rows})
    await expect(evaluatePersistedWalletClusterCalibration(truncated.client,{informationCutoff:'2026-09-02T00:00:00Z',limit:2}))
      .rejects.toThrow('WINDOW_TRUNCATED')
  })
})
