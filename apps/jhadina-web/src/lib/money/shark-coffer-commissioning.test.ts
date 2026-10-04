import {describe,expect,it} from 'vitest'
import type {JhadinaPurseCharter} from '@jhadina/money-core'
import {evaluateSharkCofferCommissioning,type SharkCofferCommissioningCounts} from './shark-coffer-commissioning'

const baseCounts:SharkCofferCommissioningCounts={
  ingressCount:0,validatedOpportunityCount:0,purseProcessedRunCount:0,paperProcessedRunCount:0,
  allocationRunCount:0,executionEvidenceCount:0,executionPackageCount:0,autonomousIntentCount:0,
}
const charter=(mode:JhadinaPurseCharter['autonomyMode']):JhadinaPurseCharter=>({
  charterId:'charter:'+mode,charterVersion:'v1',userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',autonomyMode:mode,
  maxTotalDeployableBps:5000,minLiquidReserveMinor:10000n,minEmergencyReserveMinor:5000n,maxSingleOpportunityBps:1000,
  maxCorrelatedExposureBps:2000,maxRebalanceTurnoverBps:2500,
  lanePolicies:[{lane:'MEME',enabled:true,maxAllocationBps:1000,maxSinglePositionBps:500,minConfidenceBps:6000}],
  verifiedOwnerPayoutDestinationId:'owner-payout:1',ownerProfitSweepProtected:true,charterMutationRequiresOwnerApproval:true,
  ownerDestinationMutationRequiresOwnerApproval:true,jhadinaMayAllocate:true,jhadinaMayRebalance:true,
  effectiveAt:'2026-10-03T00:00:00Z',evidenceIds:['owner:charter'],authority:'OWNER_TREASURY_CHARTER',canExecute:false,
})

describe('SHARK Coffer commissioning evidence gate',()=>{
  it('never grants execution authority and waits for real evidence',()=>{
    const result=evaluateSharkCofferCommissioning({schemaReady:true,charters:[charter('PAPER_AUTONOMOUS')],counts:baseCounts})
    expect(result.authority).toBe('COMMISSIONING_EVIDENCE_ONLY')
    expect(result.canExecute).toBe(false)
    expect(result.gates.commission1).toBe('PASS')
    expect(result.gates.commission3).toBe('PASS')
    expect(result.gates.commission4).toBe('WAITING_FOR_EVIDENCE')
    expect(result.gates.commission6).toBe('WAITING_FOR_EVIDENCE')
  })

  it('requires owner-governed paper MEME configuration for the paper gate',()=>{
    const result=evaluateSharkCofferCommissioning({schemaReady:true,charters:[charter('LIVE_GOVERNED_INTENTS')],counts:{...baseCounts,ingressCount:1,validatedOpportunityCount:1}})
    expect(result.liveGovernedMemeCharterCount).toBe(1)
    expect(result.paperMemeCharterCount).toBe(0)
    expect(result.gates.commission6).toBe('OWNER_ACTION_REQUIRED')
  })

  it('passes evidence gates only when the corresponding durable receipts exist',()=>{
    const counts:SharkCofferCommissioningCounts={
      ingressCount:2,validatedOpportunityCount:1,purseProcessedRunCount:1,paperProcessedRunCount:1,
      allocationRunCount:1,executionEvidenceCount:0,executionPackageCount:0,autonomousIntentCount:0,
    }
    const result=evaluateSharkCofferCommissioning({schemaReady:true,charters:[charter('PAPER_AUTONOMOUS')],counts})
    expect(result.gates).toEqual({
      commission1:'PASS',commission3:'PASS',commission4:'PASS',commission5:'PASS',commission6:'PASS',commission7:'PASS',
    })
  })

  it('fails closed when the durable schema is incomplete',()=>{
    const result=evaluateSharkCofferCommissioning({schemaReady:false,charters:[],counts:baseCounts})
    expect(result.gates.commission1).toBe('BLOCKED_EXTERNAL')
    expect(result.gates.commission3).toBe('OWNER_ACTION_REQUIRED')
    expect(result.canExecute).toBe(false)
  })
})
