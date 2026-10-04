import {describe,expect,it} from 'vitest'
import type {JhadinaPurseCharter} from '@jhadina/money-core'
import {evaluateSharkCofferCommissioning,type SharkCofferCommissioningCounts} from './shark-coffer-commissioning'

const baseCounts:SharkCofferCommissioningCounts={
  ingressCount:0,validatedOpportunityCount:0,marketLiquidityEvidenceCount:0,purseProcessedRunCount:0,paperProcessedRunCount:0,
  allocationRunCount:0,executionEvidenceCount:0,executionPackageCount:0,autonomousIntentCount:0,pumpExecutionRouteEvidenceCount:0,
  dexShadowRunCount:0,measuredShadowRunCount:0,activeCofferWalletCount:0,commissionedDexConnectorCount:0,
  signedSimulationNoBroadcastCount:0,boundSignerLeaseCount:0,
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

describe('SHARK Coffer COMMISSION.1-.10 evidence gate',()=>{
  it('never grants execution authority and keeps missing evidence red',()=>{
    const result=evaluateSharkCofferCommissioning({
      schemaReady:true,schedulerOidcVerified:true,charters:[charter('PAPER_AUTONOMOUS')],counts:baseCounts,
    })
    expect(result.authority).toBe('COMMISSIONING_EVIDENCE_ONLY')
    expect(result.canExecute).toBe(false)
    expect(result.gates.commission1).toBe('PASS')
    expect(result.gates.commission2).toBe('PASS')
    expect(result.gates.commission4).toBe('WAITING_FOR_EVIDENCE')
    expect(result.gates.commission8).toBe('WAITING_FOR_EVIDENCE')
    expect(result.gates.commission9).toBe('WAITING_FOR_EVIDENCE')
    expect(result.gates.commission10).toBe('WAITING_FOR_EVIDENCE')
  })

  it('does not convert CRON-secret access into OIDC commissioning proof',()=>{
    const result=evaluateSharkCofferCommissioning({
      schemaReady:true,schedulerOidcVerified:false,charters:[charter('PAPER_AUTONOMOUS')],counts:baseCounts,
    })
    expect(result.gates.commission2).toBe('BLOCKED_EXTERNAL')
    expect(result.canExecute).toBe(false)
  })

  it('requires owner-governed paper MEME configuration for the paper gate',()=>{
    const result=evaluateSharkCofferCommissioning({
      schemaReady:true,schedulerOidcVerified:true,charters:[charter('LIVE_GOVERNED_INTENTS')],
      counts:{...baseCounts,ingressCount:1,validatedOpportunityCount:1,marketLiquidityEvidenceCount:1},
    })
    expect(result.liveGovernedMemeCharterCount).toBe(1)
    expect(result.paperMemeCharterCount).toBe(0)
    expect(result.gates.commission6).toBe('OWNER_ACTION_REQUIRED')
  })

  it('passes COMMISSION.1-.10 only from the corresponding durable evidence',()=>{
    const counts:SharkCofferCommissioningCounts={
      ingressCount:2,validatedOpportunityCount:1,marketLiquidityEvidenceCount:1,purseProcessedRunCount:1,paperProcessedRunCount:1,
      allocationRunCount:1,executionEvidenceCount:1,executionPackageCount:1,autonomousIntentCount:0,pumpExecutionRouteEvidenceCount:1,
      dexShadowRunCount:1,measuredShadowRunCount:1,activeCofferWalletCount:1,commissionedDexConnectorCount:1,
      signedSimulationNoBroadcastCount:1,boundSignerLeaseCount:1,
    }
    const result=evaluateSharkCofferCommissioning({
      schemaReady:true,schedulerOidcVerified:true,charters:[charter('PAPER_AUTONOMOUS')],counts,
    })
    expect(result.gates).toEqual({
      commission1:'PASS',commission2:'PASS',commission3:'PASS',commission4:'PASS',commission5:'PASS',
      commission6:'PASS',commission7:'PASS',commission8:'PASS',commission9:'PASS',commission10:'PASS',
    })
    expect(result.canExecute).toBe(false)
  })

  it('requires the signer, wallet and admitted DEX provider to bind the signed simulation gate',()=>{
    const counts={...baseCounts,signedSimulationNoBroadcastCount:1,boundSignerLeaseCount:1,activeCofferWalletCount:1}
    const result=evaluateSharkCofferCommissioning({
      schemaReady:true,schedulerOidcVerified:true,charters:[charter('PAPER_AUTONOMOUS')],counts,
    })
    expect(result.gates.commission9).toBe('WAITING_FOR_EVIDENCE')
  })

  it('fails closed when the durable schema is incomplete',()=>{
    const result=evaluateSharkCofferCommissioning({
      schemaReady:false,schedulerOidcVerified:true,charters:[],counts:baseCounts,
    })
    expect(result.gates.commission1).toBe('BLOCKED_EXTERNAL')
    expect(result.gates.commission3).toBe('OWNER_ACTION_REQUIRED')
    expect(result.canExecute).toBe(false)
  })
})
