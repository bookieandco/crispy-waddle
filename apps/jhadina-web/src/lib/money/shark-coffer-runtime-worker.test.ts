import {beforeEach,describe,expect,it,vi} from 'vitest'
import {
  adaptPurseRebalanceIntentToCanonical,
  planExecution,
  type AutonomousTradingMandate,
  type JhadinaPurseCharter,
  type PursePortfolioSnapshot,
  type SharkMoneyTransportEnvelope,
} from '@jhadina/money-core'

const state=vi.hoisted(()=>({
  opportunityEnvelope:undefined as any,
  purseCycle:undefined as any,
  executionPackage:undefined as any,
  mandate:undefined as any,
  runs:[] as any[],
  autonomousIntents:[] as any[],
  releases:[] as any[],
  completions:[] as any[],
}))

vi.mock('./shark-coffer-opportunity-repository',async()=>{
  const core=await import('@jhadina/money-core')
  return {
    admitSharkResearchToAutomatedCoffer:vi.fn(async(_client:any,input:any)=>{
      const opportunity=core.adaptSharkResearchToPurseOpportunity({
        research:input.research,candidate:input.candidate,tradeMims:input.tradeMims,validation:input.validation,
      })
      const opportunityEnvelope=core.ingestPurseOpportunity({charter:input.charter,opportunity,ingestedAt:input.ingestedAt})
      state.opportunityEnvelope=opportunityEnvelope
      return {opportunityEnvelope,persistence:'INSERTED',canExecute:false}
    }),
  }
})

const envelope:SharkMoneyTransportEnvelope={
  schemaVersion:'SHARK-MONEY-02',envelopeId:'env:1',
  proposal:{proposalId:'p1',contextId:'ctx',disposition:'ASK',recommendation:'research',rationale:'test',uncertainty:[],alternatives:['wait']},
  assessment:{
    assessmentId:'a1',chainId:'solana',tokenAddress:'TOKEN',assessedAt:'2026-10-03T05:00:05Z',informationCutoff:'2026-10-03T05:00:03Z',
    tradeType:'information-edge',assessmentVersion:'v1',thesis:'Independent migration evidence may support a bounded entry.',confidence:.82,
    sourceRisk:{overallRisk:.18,band:'candidate'},invalidationConditions:['liquidity collapse'],
    evidenceRefs:[
      {evidenceId:'chain:1',source:'helius',sourceGroup:'chain',stance:'SUPPORTS',direction:'BULLISH',strength:.85,confidence:.9,observedAt:'2026-10-03T05:00:00Z',availableAt:'2026-10-03T05:00:01Z',summary:'verified chain activity',immutable:true},
      {evidenceId:'market:1',source:'dexscreener',sourceGroup:'market',stance:'SUPPORTS',direction:'BULLISH',strength:.8,confidence:.85,observedAt:'2026-10-03T05:00:01Z',availableAt:'2026-10-03T05:00:03Z',summary:'market confirmation',immutable:true},
    ],
  },
  sourceProvenance:{contentHash:'source-hash',generatedBy:'shark'},allowedUses:['MONEY_RESEARCH_INPUT'],
  authority:{decision:'INTELLIGENCE_ONLY',financialExecution:'NONE',capitalAccess:'NONE',protectedFunds:'NONE',walletSigning:'NONE'},
}
const record:any={
  userId:'u1',
  envelope,
  market:{evidenceId:'raw-market:1',assessmentId:'a1',chainId:'solana',tokenAddress:'TOKEN',source:'dexscreener',liquidityUsd:100000,volume24hUsd:300000,buys24h:120,sells24h:40,anomalyScore:.1,observedAt:'2026-10-03T05:00:02Z',availableAt:'2026-10-03T05:00:04Z',evidenceIds:['raw:1'],payloadHash:'raw-hash',authority:'EVIDENCE_ONLY',canExecute:false},
  source:'meme-worker',createdAt:'2026-10-03T05:00:05Z',
  leaseOwner:'worker-test',leaseToken:'lease:test',leaseExpiresAt:'2026-10-03T05:03:00Z',attemptCount:1,
}
const charter:JhadinaPurseCharter={
  charterId:'charter:1',charterVersion:'v1',userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',autonomyMode:'LIVE_GOVERNED_INTENTS',
  maxTotalDeployableBps:5000,minLiquidReserveMinor:0n,minEmergencyReserveMinor:0n,maxSingleOpportunityBps:2500,maxCorrelatedExposureBps:5000,maxRebalanceTurnoverBps:5000,
  lanePolicies:[{lane:'MEME',enabled:true,maxAllocationBps:5000,maxSinglePositionBps:2500,minConfidenceBps:0}],
  verifiedOwnerPayoutDestinationId:'owner:bank',ownerProfitSweepProtected:true,charterMutationRequiresOwnerApproval:true,ownerDestinationMutationRequiresOwnerApproval:true,
  jhadinaMayAllocate:true,jhadinaMayRebalance:true,effectiveAt:'2026-10-03T04:00:00Z',evidenceIds:['charter:e1'],authority:'OWNER_TREASURY_CHARTER',canExecute:false,
}
const treasury:any={cofferId:'coffer:1',userId:'u1',reportingCurrency:'USD',observedAt:'2026-10-03T04:59:00Z',totalReportingValueMinor:100000n,reservedReportingValueMinor:0n,deployableReportingValueMinor:100000n,assets:[],evidenceIds:['treasury:e1'],authority:'TREASURY_ACCOUNTING_EVIDENCE',canMoveMoney:false}
const capital:any={capitalSnapshotId:'liq:1',cofferId:'coffer:1',userId:'u1',reportingCurrency:'USD',availableLiquidityMinor:80000n,observedAt:'2026-10-03T04:59:30Z',evidenceIds:['liq:e1'],authority:'CAPITAL_EVIDENCE'}
const portfolio:PursePortfolioSnapshot={
  snapshotId:'portfolio:1',userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',totalAccountValueMinor:100000n,totalPositionValueMinor:0n,grossPortfolioValueMinor:100000n,
  liquidAccountValueMinor:100000n,executablePositionValueMinor:0n,unsettledMinor:0n,reservedMinor:0n,realizedPnlMinor:0n,unrealizedPnlMinor:0n,
  accounts:[],positions:[],observedAt:'2026-10-03T04:59:30Z',evidenceIds:['portfolio:e1'],authority:'PORTFOLIO_EVIDENCE',canExecute:false,
}

vi.mock('./shark-coffer-runtime-repository',()=>({
  claimSharkRuntimeIngress:vi.fn(async()=>[record]),
  completeSharkRuntimeIngress:vi.fn(async(_client:any,input:any)=>{state.completions.push(input)}),
  releaseSharkRuntimeIngress:vi.fn(async(_client:any,input:any)=>{state.releases.push(input)}),
  loadActivePurseCharters:vi.fn(async()=>[charter]),
  findTerminalRuntimeRunId:vi.fn(async()=>undefined),
  loadLatestAllocatedPurseResumeState:vi.fn(async()=>{
    if(!state.purseCycle||!state.opportunityEnvelope)return undefined
    const decision=state.purseCycle.decisions.allocations.find((x:any)=>x.opportunityId===state.opportunityEnvelope.opportunity.opportunityId)
    const purseIntent=decision?state.purseCycle.rebalance.intents.find((x:any)=>x.instrumentId===decision.instrumentId&&x.strategyId===decision.strategyId&&x.action==='INCREASE'):undefined
    if(!purseIntent)return undefined
    return {
      opportunityEnvelope:state.opportunityEnvelope,
      decisions:state.purseCycle.decisions,
      rebalance:state.purseCycle.rebalance,
      purseIntent,
      allocatedRunId:'run:allocated:1',
      envelopeId:'env:1',
      charterId:'charter:1',
      moneyOpportunityId:state.opportunityEnvelope.opportunity.governance?.moneyOpportunityId,
      completedAt:'2026-10-03T05:01:00Z',
    }
  }),
  countStrategyCalibrationSamples:vi.fn(async()=>25),
  persistSharkCofferRuntimeResearch:vi.fn(async()=>{}),
  loadCofferTreasurySnapshot:vi.fn(async()=>treasury),
  loadPurseCapitalEvidence:vi.fn(async()=>capital),
  loadLatestPursePortfolio:vi.fn(async()=>portfolio),
  loadAdmittedPurseOpportunities:vi.fn(async()=>state.opportunityEnvelope?[state.opportunityEnvelope]:[]),
  loadPurseLearningProfiles:vi.fn(async()=>[]),
  loadPurseDecisionStyle:vi.fn(async()=>undefined),
  portfolioExposures:vi.fn(()=>[]),
  persistPurseCycle:vi.fn(async(_client:any,input:any)=>{state.purseCycle=input}),
  findPurseIntentForOpportunity:vi.fn((input:any)=>{
    const decision=input.decisions.allocations.find((x:any)=>x.opportunityId===input.opportunityId)
    return decision?input.rebalance.intents.find((x:any)=>x.instrumentId===decision.instrumentId&&x.strategyId===decision.strategyId&&x.action==='INCREASE'):undefined
  }),
  appendRuntimeRun:vi.fn(async(_client:any,run:any)=>{state.runs.push(run);return 'INSERTED'}),
  runtimeRunId:vi.fn((envelopeId:string,charterId:string,disposition:string)=>'run:'+envelopeId+':'+charterId+':'+disposition),
  loadExecutionPackage:vi.fn(async()=>state.executionPackage),
  loadSharkCofferExecutionEvidence:vi.fn(async()=>undefined),
  appendExecutionPackage:vi.fn(async(_client:any,pkg:any)=>{state.executionPackage=pkg;return 'INSERTED'}),
  loadActiveAutonomousMandate:vi.fn(async()=>state.mandate),
  appendAutonomousIntent:vi.fn(async(_client:any,input:any)=>{state.autonomousIntents.push(input.intent);return 'INSERTED'}),
}))

import {runSharkCofferRuntimeCycle} from './shark-coffer-runtime-worker'

beforeEach(()=>{
  state.opportunityEnvelope=undefined
  state.purseCycle=undefined
  state.executionPackage=undefined
  state.mandate=undefined
  state.runs.length=0
  state.autonomousIntents.length=0
  state.releases.length=0
  state.completions.length=0
})

describe('SHARK Coffer runtime worker restart/resume',()=>{
  it('allocates cross-lane capital but defers live handoff when governed execution evidence is absent',async()=>{
    const result=await runSharkCofferRuntimeCycle({client:{} as any,now:'2026-10-03T05:01:00Z',limit:10})
    expect(result.researchReady).toBe(1)
    expect(result.failures).toEqual([])
    expect(result.allocated).toBe(1)
    expect(result.autonomousIntentReady).toBe(0)
    expect(result.deferred).toBe(1)
    expect(state.runs.map(x=>x.disposition)).toContain('ALLOCATED')
    expect(state.purseCycle?.plan.authority).toBe('PURSE_ALLOCATION_ONLY')
    expect(state.purseCycle?.rebalance.canExecute).toBe(false)
    expect(state.releases).toHaveLength(1)
    expect(state.completions).toHaveLength(0)
  })

  it('resumes the same durable allocation after discovery evidence is stale without re-running SHARK research',async()=>{
    await runSharkCofferRuntimeCycle({client:{} as any,now:'2026-10-03T05:01:00Z',limit:10})
    const cycle=state.purseCycle
    const decision=cycle.decisions.allocations.find((x:any)=>x.opportunityId===state.opportunityEnvelope.opportunity.opportunityId)
    const purseIntent=cycle.rebalance.intents.find((x:any)=>x.instrumentId===decision.instrumentId&&x.strategyId===decision.strategyId&&x.action==='INCREASE')
    const canonical=adaptPurseRebalanceIntentToCanonical({rebalancePlan:cycle.rebalance,purseIntent})
    const market:any={snapshotId:'exec-market:1',instrumentId:purseIntent.instrumentId,currency:'USD',bidMinor:99n,askMinor:100n,bidSize:'1000',askSize:'1000',visibleDepthNotionalMinor:100000n,observedAt:'2026-10-03T05:01:05Z',availableAt:'2026-10-03T05:01:06Z',expiresAt:'2026-10-03T05:10:00Z',evidenceIds:['exec-market:e1'],provenanceHash:'exec-market:prov'}
    const route:any={routeId:'route:1',provider:'jupiter-ultra',venue:'pumpswap',instrumentId:purseIntent.instrumentId,status:'ACCEPTING',observedAt:'2026-10-03T05:01:05Z',availableAt:'2026-10-03T05:01:06Z',evidenceIds:['route:e1'],provenanceHash:'route:prov'}
    const executionPlan=planExecution({intent:canonical,portfolioPlanId:cycle.rebalance.rebalancePlanId,market,route,informationCutoff:'2026-10-03T05:01:07Z',expiresAt:'2026-10-03T05:10:00Z',urgency:'HIGH',maxSpreadBps:200,maxParticipationBps:10000,sliceCount:1})
    const preflight:any={preflightId:'preflight:1',executionPlanId:executionPlan.executionPlanId,provider:'jupiter-ultra',accountId:'coffer-wallet',status:'PASS_FOR_HUMAN_APPROVAL',reasonCodes:[],accountCapabilitySnapshotId:'cap:1',routeSnapshotId:route.routeId,marketSnapshotId:market.snapshotId,shadowCertificationReportId:'shadow:cert',checkedAt:'2026-10-03T05:01:20Z',expiresAt:'2026-10-03T05:09:00Z',inputHash:'preflight:in',provenanceHash:'preflight:prov',authority:'PREFLIGHT_ONLY',requiresHumanApproval:true,canSubmitOrders:false,canAuthorizeLive:false}
    state.executionPackage={packageId:'pkg:1',envelopeId:'env:1',charterId:'charter:1',opportunityId:state.opportunityEnvelope.opportunity.opportunityId,rebalancePlanId:cycle.rebalance.rebalancePlanId,purseIntentId:purseIntent.intentId,canonicalIntent:canonical,executionPlan,preflight,observedAt:'2026-10-03T05:01:20Z',expiresAt:'2026-10-03T05:09:00Z',evidenceIds:['pkg:e1'],authority:'EXECUTION_PLANNING_EVIDENCE_ONLY',canExecute:false}
    state.mandate={
      mandateId:'mandate:1',userId:'u1',provider:'jupiter-ultra',accountId:'coffer-wallet',currency:'USD',mode:'LIVE_AUTONOMOUS',
      allowedInstrumentPrefixes:['meme:solana:'],allowedStrategyIds:[purseIntent.strategyId],allowOpeningShorts:false,
      limits:{maxOrderNotionalMinor:50000n,maxDailySubmittedNotionalMinor:100000n,maxDailyOrders:10,maxDailyRealizedLossMinor:20000n,maxGrossExposureMinor:100000n,maxDrawdownBps:3000,maxLeverageBps:10000,minModelConfidenceBps:0},
      startsAt:'2026-10-03T04:00:00Z',expiresAt:'2026-10-03T06:00:00Z',approvalReceiptId:'approval:1',actionCoreAuthorityId:'authority:1',policyVersion:'v1',policyHash:'policy:hash',evidenceIds:['mandate:e1'],status:'ACTIVE',activatedAt:'2026-10-03T04:00:00Z',authority:'USER_APPROVED_MANDATE',canAuthorizeTrade:false,
    } satisfies AutonomousTradingMandate

    state.runs.length=0
    state.autonomousIntents.length=0
    state.releases.length=0
    state.completions.length=0
    const resumed=await runSharkCofferRuntimeCycle({client:{} as any,now:'2026-10-03T05:08:00Z',limit:10})
    expect(resumed.failures).toEqual([])
    expect(resumed.autonomousIntentReady).toBe(1)
    expect(state.autonomousIntents).toHaveLength(1)
    expect(state.autonomousIntents[0].authority).toBe('INTELLIGENCE_ONLY')
    expect(state.autonomousIntents[0].canExecute).toBe(false)
    expect(state.runs.map(x=>x.disposition)).toContain('AUTONOMOUS_INTENT_READY')
    expect(state.completions).toHaveLength(1)
    expect(state.completions[0]?.runId).toContain('shark-coffer-runtime:')
    expect(state.releases).toHaveLength(0)
  })

  it('never evaluates another user\'s Coffer charter for a SHARK ingress',async()=>{
    const repository=await import('./shark-coffer-runtime-repository')
    const other={...charter,charterId:'charter:other',userId:'u2',cofferId:'coffer:other'}
    vi.mocked(repository.loadActivePurseCharters).mockResolvedValueOnce([other,charter])
    const result=await runSharkCofferRuntimeCycle({client:{} as any,now:'2026-10-03T05:01:00Z',limit:10})
    expect(result.evaluatedCharterPairs).toBe(1)
    expect(state.runs.every(x=>x.charterId==='charter:1')).toBe(true)
  })

})
