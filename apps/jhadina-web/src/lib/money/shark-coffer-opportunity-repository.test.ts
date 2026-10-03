import {describe,expect,it} from 'vitest'
import type {JhadinaPurseCharter,PurseOpportunityEnvelope} from '@jhadina/money-core'
import {appendSharkCofferOpportunity} from './shark-coffer-opportunity-repository'

const charter:JhadinaPurseCharter={
  charterId:'charter:1',charterVersion:'v1',userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',autonomyMode:'LIVE_GOVERNED_INTENTS',
  maxTotalDeployableBps:5000,minLiquidReserveMinor:10000n,minEmergencyReserveMinor:5000n,maxSingleOpportunityBps:1500,maxCorrelatedExposureBps:2500,maxRebalanceTurnoverBps:5000,
  lanePolicies:[{lane:'MEME',enabled:true,maxAllocationBps:2000,maxSinglePositionBps:1500,minConfidenceBps:6500}],
  verifiedOwnerPayoutDestinationId:'owner:bank',ownerProfitSweepProtected:true,charterMutationRequiresOwnerApproval:true,ownerDestinationMutationRequiresOwnerApproval:true,
  jhadinaMayAllocate:true,jhadinaMayRebalance:true,effectiveAt:'2026-10-03T04:00:00Z',evidenceIds:['charter:e1'],authority:'OWNER_TREASURY_CHARTER',canExecute:false,
}
const envelope=(mimsStatus:'PASS'|'REVIEW'='PASS'):PurseOpportunityEnvelope=>({
  busEventId:'event:1',charterId:'charter:1',admitted:mimsStatus==='PASS',reasonCodes:mimsStatus==='PASS'?[]:['MIMS_PASS_REQUIRED_FOR_LIVE'],ingestedAt:'2026-10-03T05:00:04Z',
  authority:'OPPORTUNITY_BUS_ONLY',canExecute:false,
  opportunity:{
    opportunityId:'purse-shark:1',sourceId:'a1',sourceKind:'SHARK',lane:'MEME',strategyId:'MIGRATION_CONFIRM',instrumentId:'meme:solana:TOKEN',action:'ENTER',
    thesis:'test',horizon:'INTRADAY',expectedNetEdgeBps:1500,expectedDownsideBps:800,confidenceBps:7200,evidenceQualityBps:8000,liquidityBps:7000,
    minimumCapitalMinor:1000n,maximumCapitalMinor:5000n,correlationGroupIds:['pump-migration'],observedAt:'2026-10-03T05:00:02Z',
    availableAt:'2026-10-03T05:00:03Z',expiresAt:'2026-10-03T05:10:00Z',evidenceIds:['e1','mims:1'],provenanceHash:'prov:1',
    governance:{mimsStage:'TRADE',mimsVoteId:'mims:1',mimsStatus,mimsReasonCodes:[],sourceAssessmentId:'a1',moneyOpportunityId:'money-opp:1',unresolvedContradictionCount:0,liveEligible:mimsStatus==='PASS',evidenceIds:['mims:1'],authority:'GOVERNANCE_EVIDENCE_ONLY',canExecute:false},
    authority:'INTELLIGENCE_ONLY',canExecute:false,
  },
})

function fixture(){
  let stored:any|undefined
  let duplicate=false
  const client:any={
    from(table:string){
      expect(table).toBe('money_purse_opportunity_events')
      const chain:any={
        insert(row:any){chain.row=row;return chain},
        select(){
          if(chain.row){
            if(!duplicate){stored=chain.row;duplicate=true;return {maybeSingle:async()=>({data:{bus_event_id:chain.row.bus_event_id},error:null})}}
            return {maybeSingle:async()=>({data:null,error:{code:'23505',message:'duplicate'}})}
          }
          return chain
        },
        eq(column:string,value:any){
          if(column==='bus_event_id')expect(value).toBe('event:1')
          return chain
        },
        async maybeSingle(){
          return {data:stored?{
            opportunity_id:stored.opportunity_id,admitted:stored.admitted,reason_codes:stored.reason_codes,opportunity_json:stored.opportunity_json,
          }:null,error:null}
        },
      }
      return chain
    },
  }
  return {client,getStored:()=>stored}
}

describe('SHARK Coffer opportunity repository',()=>{
  it('persists MIMS-bound SHARK opportunity evidence with no execution authority',async()=>{
    const f=fixture()
    const disposition=await appendSharkCofferOpportunity(f.client,{charter,envelope:envelope()})
    expect(disposition).toBe('INSERTED')
    expect(f.getStored().authority).toBe('OPPORTUNITY_BUS_ONLY')
    expect(f.getStored().can_execute).toBe(false)
    expect(f.getStored().opportunity_json.governance.mimsStatus).toBe('PASS')
  })

  it('replays the same event idempotently',async()=>{
    const f=fixture()
    expect(await appendSharkCofferOpportunity(f.client,{charter,envelope:envelope()})).toBe('INSERTED')
    expect(await appendSharkCofferOpportunity(f.client,{charter,envelope:envelope()})).toBe('REPLAY')
  })

  it('rejects a replay that mutates the original MIMS decision',async()=>{
    const f=fixture()
    await appendSharkCofferOpportunity(f.client,{charter,envelope:envelope('PASS')})
    await expect(appendSharkCofferOpportunity(f.client,{charter,envelope:envelope('REVIEW')}))
      .rejects.toThrow('SHARK_COFFER_OPPORTUNITY_EVENT_CONFLICT')
  })
})
