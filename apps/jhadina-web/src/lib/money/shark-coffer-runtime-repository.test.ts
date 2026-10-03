import {describe,expect,it} from 'vitest'
import type {SharkMoneyTransportEnvelope} from '@jhadina/money-core'
import {
  appendExecutionPackage,
  appendRuntimeRun,
  appendSharkMoneyRuntimeIngress,
  claimSharkRuntimeIngress,
  completeSharkRuntimeIngress,
  listSharkRuntimeIngress,
  releaseSharkRuntimeIngress,
  runtimeRunId,
  type SharkCofferRuntimeRunReceipt,
  type SharkExecutionPlanningPackage,
} from './shark-coffer-runtime-repository'

type Row=Record<string,any>
const primary:Record<string,string>={
  money_shark_runtime_ingress:'envelope_id',
  money_shark_execution_packages:'package_id',
  money_shark_execution_evidence:'evidence_id',
  money_shark_coffer_runtime_runs:'run_id',
}

function memoryClient(){
  const tables=new Map<string,Row[]>()
  const rows=(table:string)=>{const found=tables.get(table)??[];tables.set(table,found);return found}
  const client:any={
    async rpc(name:string,args:any){
      const ingress=rows('money_shark_runtime_ingress')
      if(name==='money_claim_shark_coffer_runtime'){
        const candidates=ingress
          .filter(r=>(r.status??'PENDING')==='PENDING'||((r.status??'PENDING')==='LEASED'&&String(r.lease_expires_at??'')<='2026-10-03T05:10:00Z'))
          .slice(0,Number(args.p_limit??25))
        for(const [index,row] of candidates.entries()){
          row.status='LEASED'
          row.lease_owner=String(args.p_worker_id)
          row.attempt_count=Number(row.attempt_count??0)+1
          row.lease_token='lease:'+String(args.p_worker_id)+':'+String(row.attempt_count)
          row.lease_expires_at='2026-10-03T05:12:00Z'
        }
        return {data:structuredClone(candidates),error:null}
      }
      if(name==='money_release_shark_coffer_runtime'){
        const row=ingress.find(r=>r.envelope_id===args.p_envelope_id)
        if(!row||row.status!=='LEASED'||row.lease_owner!==args.p_worker_id||row.lease_token!==args.p_lease_token)return {data:false,error:null}
        row.status='PENDING';row.lease_owner=null;row.lease_token=null;row.lease_expires_at=null
        return {data:true,error:null}
      }
      if(name==='money_complete_shark_coffer_runtime'){
        const row=ingress.find(r=>r.envelope_id===args.p_envelope_id)
        if(!row||row.status!=='LEASED'||row.lease_owner!==args.p_worker_id||row.lease_token!==args.p_lease_token)return {data:false,error:null}
        row.status='COMPLETED';row.completed_run_id=args.p_run_id;row.lease_owner=null;row.lease_token=null;row.lease_expires_at=null
        return {data:true,error:null}
      }
      return {data:null,error:{message:'unexpected rpc '+name}}
    },
    from(table:string){
      let inserting:Row|undefined
      let predicates:Array<(row:Row)=>boolean>=[]
      let orderField:string|undefined
      let ascending=true
      let limitN:number|undefined
      const q:any={
        insert(row:Row){inserting=row;return q},
        select(_columns?:string,_opts?:unknown){return q},
        eq(field:string,value:any){predicates.push(r=>r[field]===value);return q},
        in(field:string,values:any[]){predicates.push(r=>values.includes(r[field]));return q},
        lte(field:string,value:any){predicates.push(r=>String(r[field])<=String(value));return q},
        gt(field:string,value:any){predicates.push(r=>String(r[field])>String(value));return q},
        order(field:string,opt?:{ascending?:boolean}){orderField=field;ascending=opt?.ascending!==false;return q},
        limit(n:number){limitN=n;return q},
        async maybeSingle(){
          if(inserting){
            const key=primary[table]
            if(!key)throw new Error('missing primary key fixture for '+table)
            const existing=rows(table).find(r=>r[key]===inserting![key])
            if(existing)return {data:null,error:{code:'23505',message:'duplicate'}}
            rows(table).push(structuredClone(inserting))
            return {data:{[key]:inserting[key]},error:null}
          }
          let result=rows(table).filter(r=>predicates.every(fn=>fn(r)))
          if(orderField)result=result.sort((a,b)=>String(a[orderField!]).localeCompare(String(b[orderField!]))*(ascending?1:-1))
          if(limitN!==undefined)result=result.slice(0,limitN)
          return {data:result[0]?structuredClone(result[0]):null,error:null}
        },
        then(resolve:(value:any)=>void,reject:(reason:any)=>void){
          ;(async()=>{
            let result=rows(table).filter(r=>predicates.every(fn=>fn(r)))
            if(orderField)result=result.sort((a,b)=>String(a[orderField!]).localeCompare(String(b[orderField!]))*(ascending?1:-1))
            if(limitN!==undefined)result=result.slice(0,limitN)
            return {data:structuredClone(result),error:null}
          })().then(resolve,reject)
        },
      }
      return q
    },
  }
  return {client,tables}
}

const envelope:SharkMoneyTransportEnvelope={
  schemaVersion:'SHARK-MONEY-02',
  envelopeId:'env:1',
  proposal:{proposalId:'p1',contextId:'ctx1',disposition:'ASK',recommendation:'research',rationale:'test',uncertainty:[],alternatives:['wait']},
  assessment:{
    assessmentId:'a1',chainId:'solana',tokenAddress:'TOKEN',assessedAt:'2026-10-03T05:00:05Z',informationCutoff:'2026-10-03T05:00:03Z',
    tradeType:'information-edge',assessmentVersion:'v1',thesis:'test',confidence:.8,sourceRisk:{overallRisk:.2,band:'candidate'},invalidationConditions:['liquidity collapse'],
    evidenceRefs:[{evidenceId:'e1',source:'helius',sourceGroup:'chain',stance:'SUPPORTS',direction:'BULLISH',strength:.8,confidence:.8,observedAt:'2026-10-03T05:00:00Z',availableAt:'2026-10-03T05:00:03Z',summary:'chain',immutable:true}],
  },
  sourceProvenance:{contentHash:'source-hash',generatedBy:'shark'},allowedUses:['MONEY_RESEARCH_INPUT'],
  authority:{decision:'INTELLIGENCE_ONLY',financialExecution:'NONE',capitalAccess:'NONE',protectedFunds:'NONE',walletSigning:'NONE'},
}
const assessmentInput:any={
  assessmentId:'a1',
  assessedAt:'2026-10-03T05:00:05Z',
  market:{observationId:'market:1',source:'dexscreener',observedAt:'2026-10-03T05:00:01Z',receivedAt:'2026-10-03T05:00:04Z',chainId:'solana',subjectId:'TOKEN',payload:{liquidityUsd:100000,volume24hUsd:300000,buys24h:120,sells24h:40,anomalyScore:.1}},
}

describe('SHARK Coffer runtime durable repository',()=>{
  it('inserts and exactly replays immutable SHARK->Money ingress',async()=>{
    const f=memoryClient()
    const input={userId:'u1',envelope,assessment:assessmentInput,source:'meme-worker',createdAt:'2026-10-03T05:00:05Z'}
    await expect(appendSharkMoneyRuntimeIngress(f.client,input)).resolves.toBe('INSERTED')
    await expect(appendSharkMoneyRuntimeIngress(f.client,input)).resolves.toBe('REPLAY')
    const loaded=await listSharkRuntimeIngress(f.client,{limit:10})
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.envelope.envelopeId).toBe('env:1')
    expect(loaded[0]!.market.authority).toBe('EVIDENCE_ONLY')
    expect(loaded[0]!.market.canExecute).toBe(false)
  })

  it('rejects a replay that mutates the original market observation',async()=>{
    const f=memoryClient()
    const input={userId:'u1',envelope,assessment:assessmentInput,source:'meme-worker',createdAt:'2026-10-03T05:00:05Z'}
    await appendSharkMoneyRuntimeIngress(f.client,input)
    await expect(appendSharkMoneyRuntimeIngress(f.client,{
      ...input,assessment:{...assessmentInput,market:{...assessmentInput.market,payload:{...assessmentInput.market.payload,liquidityUsd:1}}},
    })).rejects.toThrow('SHARK_COFFER_RUNTIME_INGRESS_CONFLICT')
  })

  it('keeps runtime receipts replay-safe and rejects lineage mutation',async()=>{
    const f=memoryClient()
    await appendSharkMoneyRuntimeIngress(f.client,{userId:'u1',envelope,assessment:assessmentInput,source:'meme-worker',createdAt:'2026-10-03T05:00:05Z'})
    const run:SharkCofferRuntimeRunReceipt={
      runId:runtimeRunId('env:1','charter:1','ALLOCATED'),envelopeId:'env:1',charterId:'charter:1',userId:'u1',cofferId:'coffer:1',disposition:'ALLOCATED',
      opportunityId:'opp:1',allocationPlanId:'plan:1',decisionSetId:'decision:1',rebalancePlanId:'rebalance:1',
      runJson:{notionalMinor:'1000'},informationCutoff:'2026-10-03T05:00:05Z',completedAt:'2026-10-03T05:00:06Z',evidenceIds:['e1'],
      authority:'RUNTIME_EVIDENCE_ONLY',canExecute:false,
    }
    await expect(appendRuntimeRun(f.client,run)).resolves.toBe('INSERTED')
    await expect(appendRuntimeRun(f.client,run)).resolves.toBe('REPLAY')
    await expect(appendRuntimeRun(f.client,{...run,runJson:{notionalMinor:'9999'}})).rejects.toThrow('SHARK_COFFER_RUNTIME_RUN_CONFLICT')
  })

  it('execution planning package is still evidence only and cannot smuggle authority',async()=>{
    const f=memoryClient()
    await appendSharkMoneyRuntimeIngress(f.client,{userId:'u1',envelope,assessment:assessmentInput,source:'meme-worker',createdAt:'2026-10-03T05:00:05Z'})
    const pkg:SharkExecutionPlanningPackage={
      packageId:'pkg:1',envelopeId:'env:1',charterId:'charter:1',opportunityId:'opp:1',rebalancePlanId:'rebalance:1',purseIntentId:'purse-intent:1',
      canonicalIntent:{intentId:'canonical:1',planId:'rebalance:1',instrumentId:'meme:solana:TOKEN',side:'BUY',notional:{minor:1000n,currency:'USD'},reasonCodes:['test'],authority:'NONE'},
      executionPlan:{executionPlanId:'execution:1',rebalanceIntentId:'canonical:1',portfolioPlanId:'rebalance:1',instrumentId:'meme:solana:TOKEN',side:'BUY',notional:{minor:1000n,currency:'USD'},urgency:'HIGH',routeId:'route:1',marketSnapshotId:'market-snap:1',slices:[{sliceId:'slice:1',sequence:1,notional:{minor:1000n,currency:'USD'},instruction:'MARKETABLE_LIMIT',limitPriceMinor:100n,earliestAt:'2026-10-03T05:01:00Z',expiresAt:'2026-10-03T05:10:00Z',idempotencyKey:'idem:1',authority:'NONE'}],maxSpreadBps:100,maxParticipationBps:1000,informationCutoff:'2026-10-03T05:01:00Z',expiresAt:'2026-10-03T05:10:00Z',inputHash:'in',provenanceHash:'prov',authority:'ANALYSIS_ONLY',requiresHumanApproval:true},
      preflight:{preflightId:'preflight:1',executionPlanId:'execution:1',provider:'jupiter-ultra',accountId:'coffer-wallet',status:'PASS_FOR_HUMAN_APPROVAL',reasonCodes:[],accountCapabilitySnapshotId:'cap:1',routeSnapshotId:'route:1',marketSnapshotId:'market-snap:1',shadowCertificationReportId:'shadow:1',checkedAt:'2026-10-03T05:01:30Z',expiresAt:'2026-10-03T05:09:00Z',inputHash:'p-in',provenanceHash:'p-prov',authority:'PREFLIGHT_ONLY',requiresHumanApproval:true,canSubmitOrders:false,canAuthorizeLive:false},
      observedAt:'2026-10-03T05:01:30Z',expiresAt:'2026-10-03T05:09:00Z',evidenceIds:['plan:e1'],authority:'EXECUTION_PLANNING_EVIDENCE_ONLY',canExecute:false,
    }
    await expect(appendExecutionPackage(f.client,pkg)).resolves.toBe('INSERTED')
    await expect(appendExecutionPackage(f.client,{...pkg,authority:'EXECUTION_PLANNING_EVIDENCE_ONLY',canExecute:false,preflight:{...pkg.preflight,canSubmitOrders:true as false}} as any))
      .rejects.toThrow('SHARK_COFFER_RUNTIME_PREFLIGHT_AUTHORITY_INVALID')
  })

  it('claims, releases, reclaims and completes ingress with lease fencing',async()=>{
    const f=memoryClient()
    await appendSharkMoneyRuntimeIngress(f.client,{userId:'u1',envelope,assessment:assessmentInput,source:'meme-worker',createdAt:'2026-10-03T05:00:05Z'})
    const first=await claimSharkRuntimeIngress(f.client,{workerId:'worker-a',limit:1,leaseSeconds:120})
    expect(first).toHaveLength(1)
    expect(first[0]?.leaseToken).toBe('lease:worker-a:1')
    expect(first[0]?.attemptCount).toBe(1)
    await expect(releaseSharkRuntimeIngress(f.client,{
      envelopeId:'env:1',workerId:'worker-a',leaseToken:'lease:worker-a:1',
    })).resolves.toBeUndefined()

    const second=await claimSharkRuntimeIngress(f.client,{workerId:'worker-b',limit:1,leaseSeconds:120})
    expect(second).toHaveLength(1)
    expect(second[0]?.attemptCount).toBe(2)
    expect(second[0]?.leaseToken).toBe('lease:worker-b:2')
    await expect(completeSharkRuntimeIngress(f.client,{
      envelopeId:'env:1',workerId:'worker-b',leaseToken:'lease:worker-b:2',runId:'run:terminal',
    })).resolves.toBeUndefined()

    const after=await claimSharkRuntimeIngress(f.client,{workerId:'worker-c',limit:1,leaseSeconds:120})
    expect(after).toEqual([])
  })

  it('rejects stale lease completion tokens',async()=>{
    const f=memoryClient()
    await appendSharkMoneyRuntimeIngress(f.client,{userId:'u1',envelope,assessment:assessmentInput,source:'meme-worker',createdAt:'2026-10-03T05:00:05Z'})
    await claimSharkRuntimeIngress(f.client,{workerId:'worker-a',limit:1})
    await expect(completeSharkRuntimeIngress(f.client,{
      envelopeId:'env:1',workerId:'worker-a',leaseToken:'wrong',runId:'run:bad',
    })).rejects.toThrow('COMPLETE_FENCE_REJECTED')
  })

})
