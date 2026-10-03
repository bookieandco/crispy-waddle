import {describe,expect,it} from 'vitest'
import {
  SHARK_RESEARCH_CLUSTER_THRESHOLD_GRID,
  appendExternalSignalOutcomeEvidence,
  appendMemeTradeAssessmentEvidence,
  appendMeteoraCashFlowEvidence,
  appendMeteoraPositionStateEvidence,
  appendWalletClusterCalibrationObservation,
  evaluatePersistedMeteoraProfitability,
  evaluatePersistedWalletClusterCalibration,
  summarizePersistedExternalSignalSource,
} from './research-evidence-repository'

type Row={payload:any;position?:string;currency?:string;available_at?:string;platform?:string;source_handle?:string;channel_id?:string|null;resolved_at?:string}

function fixtureClient(input:{clusterRows?:Row[];flowRows?:Row[];stateRows?:Row[];sourceRows?:Row[]}={}){
  const tables:Record<string,Row[]>={
    jhadina_shark_wallet_cluster_calibration_observations:[...(input.clusterRows??[])],
    jhadina_shark_meteora_cash_flow_evidence:[...(input.flowRows??[])],
    jhadina_shark_meteora_position_state_evidence:[...(input.stateRows??[])],
    jhadina_shark_external_signal_outcomes:[...(input.sourceRows??[])],
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
        is(column:string,value:any){rows=rows.filter(row=>(row as any)[column]===value);return chain},
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

  it('persists canonical meme assessments through append-only RPCs',async()=>{
    const f=fixtureClient()
    const assessment:any={
      assessmentId:'assessment:1',assessedAt:'2026-10-03T03:00:05Z',token:{chainId:'solana-mainnet',tokenAddress:'MINT'},
      riskAssessment:{band:'watch'},confidence:.6,evidenceIds:['z','a'],
    }
    const disposition=await appendMemeTradeAssessmentEvidence(f.client,{assessment,informationCutoff:'2026-10-03T03:00:04Z',source:'meme-worker'})
    expect(disposition).toBe('INSERTED')
    expect(f.rpcPayloads[0].name).toBe('jhadina_shark_append_meme_trade_assessment')
    expect(f.rpcPayloads[0].args.p_payload.evidenceIds).toEqual(['a','z'])
    expect(f.rpcPayloads[0].args.p_payload.riskBand).toBe('watch')
  })

  it('persists and summarizes execution-aware caller outcomes',async()=>{
    const outcome:any={
      outcomeId:'outcome:1',platform:'TELEGRAM',sourceHandle:'Alpha',channelId:'c1',signalObservationId:'signal:1',tokenCandidate:'MINT',
      observedAt:'2026-10-03T03:00:00Z',resolvedAt:'2026-10-03T04:00:00Z',leadTimeMs:120000,executionLatencyMs:500,
      callMarketCapUsd:50000,maxFavorableExcursionBps:14000,maxAdverseExcursionBps:2500,firstIndependentCaller:true,
      migrated:true,rug:false,executableReturnBps:11000,independentDiscovery:true,evidenceIds:['signal','market'],
      authority:'LEARNING_ONLY',canAuthorizeTrade:false,canAutoCopy:false,
    }
    const f=fixtureClient({sourceRows:[{
      platform:'TELEGRAM',source_handle:'Alpha',channel_id:'c1',resolved_at:'2026-10-03T04:00:00Z',
      payload:{...outcome,source:'source-worker'},
    }]})
    await appendExternalSignalOutcomeEvidence(f.client,{outcome,source:'source-worker'})
    expect(f.rpcPayloads[0].name).toBe('jhadina_shark_append_external_signal_outcome')
    const summary=await summarizePersistedExternalSignalSource(f.client,{platform:'TELEGRAM',sourceHandle:'Alpha',channelId:'c1'})
    expect(summary.sampleSize).toBe(1)
    expect(summary.twoXExecutableRate).toBe(1)
    expect(summary.firstIndependentCallerRate).toBe(1)
    expect(summary.medianExecutionLatencyMs).toBe(500)
    expect(summary.canAutoCopy).toBe(false)
  })

})
