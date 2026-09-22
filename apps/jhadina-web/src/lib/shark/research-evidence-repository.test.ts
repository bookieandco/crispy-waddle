import {describe,expect,it} from 'vitest'
import {
  SHARK_RESEARCH_CLUSTER_THRESHOLD_GRID,
  appendMeteoraCashFlowEvidence,
  appendMeteoraPositionStateEvidence,
  appendWalletBuyEvidence,
  appendWalletClusterCalibrationObservation,
  appendWalletResearchScoreEvidence,
  evaluatePersistedMeteoraProfitability,
  evaluatePersistedWalletClusterCalibration,
  runPersistedWalletClusterCalibrationProducer,
} from './research-evidence-repository'

type Row=Record<string,any>

function fixtureClient(input:{
  clusterRows?:Row[]
  flowRows?:Row[]
  stateRows?:Row[]
  scoreRows?:Row[]
  buyRows?:Row[]
  launchRows?:Row[]
}={}){
  const tables:Record<string,Row[]>={
    jhadina_shark_wallet_cluster_calibration_observations:[...(input.clusterRows??[])],
    jhadina_shark_meteora_cash_flow_evidence:[...(input.flowRows??[])],
    jhadina_shark_meteora_position_state_evidence:[...(input.stateRows??[])],
    jhadina_shark_wallet_score_evidence:[...(input.scoreRows??[])],
    jhadina_shark_wallet_buy_evidence:[...(input.buyRows??[])],
    jhadina_token_launches:[...(input.launchRows??[])],
  }
  const rpcPayloads:any[]=[]
  const persisted=new Map<string,string>()
  const idFor=(name:string,payload:any)=>{
    if(name==='jhadina_shark_append_cluster_calibration_observation')return String(payload.observationId)
    if(name==='jhadina_shark_append_wallet_score_evidence')return String(payload.scoreId)
    if(name==='jhadina_shark_append_wallet_buy_evidence')return String(payload.evidenceId)
    if(name==='jhadina_shark_append_meteora_cash_flow')return String(payload.evidenceId)
    if(name==='jhadina_shark_append_meteora_position_state')return String(payload.stateId)
    return JSON.stringify(payload)
  }
  const client:any={
    async rpc(name:string,args:any){
      rpcPayloads.push({name,args})
      const payload=args.p_payload
      const key=`${name}:${idFor(name,payload)}`
      const encoded=JSON.stringify(payload)
      const prior=persisted.get(key)
      if(prior!==undefined){
        if(prior!==encoded)return {data:null,error:{message:'fixture_conflict'}}
        return {data:'REPLAY',error:null}
      }
      persisted.set(key,encoded)
      return {data:'INSERTED',error:null}
    },
    from(table:string){
      let rows=[...(tables[table]??[])]
      const chain:any={
        select(){return chain},
        eq(column:string,value:any){rows=rows.filter(row=>row[column]===value);return chain},
        lte(column:string,value:any){rows=rows.filter(row=>String(row[column])<=String(value));return chain},
        in(column:string,values:any[]){rows=rows.filter(row=>values.includes(row[column]));return chain},
        order(column:string,opts:{ascending:boolean}){
          rows.sort((a,b)=>String(a[column]??'').localeCompare(String(b[column]??''))*(opts.ascending?1:-1))
          return chain
        },
        limit(limit:number){return Promise.resolve({data:rows.slice(0,limit),error:null})},
      }
      return chain
    },
  }
  return {client,rpcPayloads,persisted}
}

const clusterObservation:any={
  observationId:'cluster:o1',tokenId:'token:1',scoreModelId:'score-v1',distinctWallets:3,windowSeconds:600,aggregateWalletScore:7,totalUsd:1000,
  observedAt:'2026-09-01T00:00:00Z',availableAt:'2026-09-01T00:00:01Z',outcome:'HEALTHY',evidenceIds:['z','a'],
}
const valuedFlow=(id:string,kind:'DEPOSIT'|'WITHDRAWAL'|'FEE',amount:string,availableAt='2026-09-01T00:00:01Z',rootFlowId=id)=>({
  evidenceId:id,rootFlowId,transactionId:'tx:'+id,position:'position-1',kind,amountMinor:amount,currency:'USDC',
  amountSemantics:'VERIFIED_VALUATION',valuationEvidenceIds:['price:'+id],
  observedAt:'2026-09-01T00:00:00Z',availableAt,source:'fixture',
})
const positionState=(availableAt='2026-09-01T00:00:03Z')=>({
  stateId:'state-1',position:'position-1',currency:'USDC',positionClosed:true,transactionHistoryComplete:true,
  observedAt:'2026-09-01T00:00:02Z',availableAt,evidenceIds:['state:e1'],source:'fixture',
})
const scorePayload=(walletId:string,score:number)=>({
  scoreId:`score:${walletId}`,chainId:'solana-mainnet',walletId,scoreModelId:'score-v1',score,
  informationCutoff:'2026-09-01T00:00:00Z',observedAt:'2026-09-01T00:00:01Z',availableAt:'2026-09-01T00:00:02Z',
  evidenceIds:[`score-e:${walletId}`],authority:'RESEARCH_ONLY',source:'fixture',
})
const buyPayload=(walletId:string,seconds:number,amountUsd:number)=>({
  evidenceId:`buy:${walletId}`,signature:`sig:${walletId}`,chainId:'solana-mainnet',tokenAddress:'TOKEN',walletId,
  observedAt:new Date(Date.parse('2026-09-01T00:00:00Z')+seconds*1000).toISOString(),
  availableAt:new Date(Date.parse('2026-09-01T00:00:01Z')+seconds*1000).toISOString(),
  amountUsd,evidenceIds:[`buy-e:${walletId}`],source:'fixture',
})

describe('SHARK research evidence runtime',()=>{
  it('canonicalizes cluster append payloads and retains research-only threshold grid',async()=>{
    const f=fixtureClient()
    const disposition=await appendWalletClusterCalibrationObservation(f.client,{observation:clusterObservation,source:' detector '})
    expect(disposition).toBe('INSERTED')
    expect(f.rpcPayloads[0].name).toBe('jhadina_shark_append_cluster_calibration_observation')
    expect(f.rpcPayloads[0].args.p_payload.evidenceIds).toEqual(['a','z'])
    expect(f.rpcPayloads[0].args.p_payload.scoreModelId).toBe('score-v1')
    expect(f.rpcPayloads[0].args.p_payload.source).toBe('detector')
    expect(SHARK_RESEARCH_CLUSTER_THRESHOLD_GRID).toHaveLength(27)
  })

  it('evaluates persisted cluster evidence PIT and isolates wallet-score models',async()=>{
    const f=fixtureClient({clusterRows:[
      {available_at:'2026-09-01T00:00:01Z',payload:{...clusterObservation,evidenceIds:['a'],source:'fixture'}},
      {available_at:'2026-09-01T00:00:02Z',payload:{...clusterObservation,observationId:'other-model',tokenId:'token:2',scoreModelId:'score-v2',evidenceIds:['m2'],source:'fixture'}},
      {available_at:'2026-09-03T00:00:01Z',payload:{...clusterObservation,observationId:'future',tokenId:'token:3',availableAt:'2026-09-03T00:00:01Z',evidenceIds:['future'],source:'fixture'}},
    ]})
    const report=await evaluatePersistedWalletClusterCalibration(f.client,{informationCutoff:'2026-09-02T00:00:00Z',scoreModelId:'score-v1'})
    expect(report.observationCount).toBe(1)
    expect(report.excludedFutureObservationIds).toEqual(['future'])
    expect(report.excludedScoreModelObservationIds).toEqual(['other-model'])
    expect(report.canMutateRuntimeThresholds).toBe(false)
    expect(report.rows.every(row=>row.canSelectProductionThreshold===false)).toBe(true)
  })

  it('appends raw wallet score and buy evidence instead of caller-supplied aggregate metrics',async()=>{
    const f=fixtureClient()
    const score=scorePayload('W1',2)
    const buy=buyPayload('W1',10,100)
    await appendWalletResearchScoreEvidence(f.client,{score:{...score,source:undefined} as any,source:'score-worker'})
    await appendWalletBuyEvidence(f.client,{buy:buy as any})
    expect(f.rpcPayloads[0].name).toBe('jhadina_shark_append_wallet_score_evidence')
    expect(f.rpcPayloads[0].args.p_payload.authority).toBe('RESEARCH_ONLY')
    expect(f.rpcPayloads[1].name).toBe('jhadina_shark_append_wallet_buy_evidence')
    expect(f.rpcPayloads[1].args.p_payload.amountUsd).toBe(100)
  })

  it('derives calibration rows from persisted buys, scores, and canonical launch outcomes with replay safety',async()=>{
    const f=fixtureClient({
      scoreRows:[
        {score_model_id:'score-v1',available_at:'2026-09-01T00:00:02Z',payload:scorePayload('W1',2)},
        {score_model_id:'score-v1',available_at:'2026-09-01T00:00:02Z',payload:scorePayload('W2',3)},
      ],
      buyRows:[
        {available_at:'2026-09-01T00:00:11Z',payload:buyPayload('W1',10,100)},
        {available_at:'2026-09-01T00:01:01Z',payload:buyPayload('W2',60,200)},
      ],
      launchRows:[{
        launch_id:'launch:solana-mainnet:TOKEN',chain_id:'solana-mainnet',token_address:'TOKEN',outcome:'HEALTHY',
        outcome_observed_at:'2026-09-02T00:00:00Z',updated_at:'2026-09-02T00:00:01Z',evidence_ids:['outcome:e1'],
      }],
    })
    const first=await runPersistedWalletClusterCalibrationProducer(f.client,{scoreModelId:'score-v1'})
    expect(first).toMatchObject({tokens:1,emitted:1,inserted:1,replayed:0,skippedUnlabeled:0})
    const second=await runPersistedWalletClusterCalibrationProducer(f.client,{scoreModelId:'score-v1'})
    expect(second).toMatchObject({tokens:1,emitted:1,inserted:0,replayed:1,skippedUnlabeled:0})
    const clusterRpc=f.rpcPayloads.find(row=>row.name==='jhadina_shark_append_cluster_calibration_observation')
    expect(clusterRpc.args.p_payload).toMatchObject({
      scoreModelId:'score-v1',distinctWallets:2,aggregateWalletScore:5,totalUsd:300,outcome:'HEALTHY',
    })
  })

  it('serializes Meteora bigint evidence, root lineage, and state through append-only RPCs',async()=>{
    const f=fixtureClient()
    await appendMeteoraCashFlowEvidence(f.client,{source:'meteora-indexer',flow:{
      ...valuedFlow('deposit','DEPOSIT','100000'),
      amountMinor:100000n,
    } as any})
    await appendMeteoraPositionStateEvidence(f.client,{source:'meteora-indexer',state:{
      ...positionState(),
    } as any})
    expect(f.rpcPayloads[0].args.p_payload.amountMinor).toBe('100000')
    expect(f.rpcPayloads[0].args.p_payload.rootFlowId).toBe('deposit')
    expect(f.rpcPayloads[0].args.p_payload.valuationEvidenceIds).toEqual(['price:deposit'])
    expect(f.rpcPayloads[1].name).toBe('jhadina_shark_append_meteora_position_state')
  })

  it('uses latest state at cutoff and excludes future flows without hindsight mutation',async()=>{
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

  it('fails closed without state evidence or when bounded research windows truncate',async()=>{
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
    await expect(evaluatePersistedWalletClusterCalibration(truncated.client,{informationCutoff:'2026-09-02T00:00:00Z',scoreModelId:'score-v1',limit:2}))
      .rejects.toThrow('WINDOW_TRUNCATED')
  })
})
