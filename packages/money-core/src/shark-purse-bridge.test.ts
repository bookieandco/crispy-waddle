import test from 'node:test'
import assert from 'node:assert/strict'
import {makeItMakeSense,bindMakeItMakeSenseStage} from '@jhadina/core-spine'
import {
  adaptSharkResearchToPurseOpportunity,
  ingestPurseOpportunity,
  type JhadinaPurseCharter,
  type OpportunityCandidateV2,
  type SharkMoneyResearchArtifact,
  type SharkPurseMoneyValidation,
} from './index.js'

const research:SharkMoneyResearchArtifact={
  bridgeVersion:'SHARK-MONEY-02',sourceSchemaVersion:'SHARK-MONEY-02',sourceEnvelopeId:'env1',sourceProposalId:'proposal1',sourceAssessmentId:'a1',
  subjectId:'crypto:solana:TOKEN',chainId:'solana',tokenAddress:'TOKEN',informationCutoff:'2026-10-03T05:00:00Z',thesis:'Independent Pump migration candidate with bounded risk.',sourceConfidence:.8,
  sourceRisk:{overallRisk:.2,band:'candidate'},invalidationConditions:['liquidity-collapse'],
  evidence:[{evidenceId:'e1',sourceId:'shark:chain',sourceGroup:'shark:chain',stance:'SUPPORTS',direction:'BULLISH',strength:.8,confidence:.8,observedAt:'2026-10-03T04:59:00Z',availableAt:'2026-10-03T05:00:00Z',receivedAt:'2026-10-03T05:00:01Z',quality:'SUPPORTED',summary:'chain evidence',inputHash:'h1'}],
  evidenceIntegrity:{informationCutoff:'2026-10-03T05:00:00Z',sourceGroups:['shark:chain'],supportingEvidenceIds:['e1'],contradictingEvidenceIds:[],neutralEvidenceIds:[],unresolvedContradictionIds:[]},
  sourceProvenance:{contentHash:'prov1',generatedBy:'shark'},
  decisionCase:{caseId:'case1',accountId:'acct1',subjectId:'crypto:solana:TOKEN',requestedBy:'u1',informationCutoff:'2026-10-03T05:00:00Z',createdAt:'2026-10-03T05:00:01Z',status:'RESEARCH_ONLY',provenanceHash:'prov1'},
  assessment:{caseId:'case1',evidenceStatus:'INGESTED',freshnessStatus:'UNEVALUATED',riskStatus:'UNEVALUATED',stressStatus:'UNEVALUATED',simulationStatus:'UNEVALUATED',liquidityStatus:'UNEVALUATED',calibrationStatus:'UNEVALUATED',authorityStatus:'MISSING',disposition:'RESEARCH_ONLY'},
  financialAuthority:'NONE',capitalAuthority:'NONE',executionAuthority:'NONE',protectedFundAuthority:'NONE',
}
const candidate:OpportunityCandidateV2={
  opportunityId:'money-opp:1',thesisId:'thesis:1',subjectId:research.subjectId,instrumentIds:['meme:solana:TOKEN'],assetClasses:['MEME'],direction:'BULLISH',horizon:'INTRADAY',
  expectedUpside:.15,expectedDownside:-.08,confidence:.72,liquidityStatus:'ASSESSED',riskStatus:'ASSESSED',invalidationConditions:['liquidity-collapse'],
  evidenceIds:['fusion-evidence:shark:a1:e1'],informationCutoff:'2026-10-03T05:00:02Z',expiresAt:'2026-10-03T05:15:00Z',provenanceHash:'money-prov',authority:'NONE',
}
const validation:SharkPurseMoneyValidation={
  validationId:'money-validation:1',sourceAssessmentId:'a1',moneyOpportunityId:'money-opp:1',strategyId:'MIGRATION_CONFIRM',instrumentId:'meme:solana:TOKEN',
  evidenceQualityBps:8000,liquidityBps:7000,minimumCapitalMinor:1000n,maximumCapitalMinor:5000n,
  observedAt:'2026-10-03T05:00:02Z',availableAt:'2026-10-03T05:00:03Z',expiresAt:'2026-10-03T05:10:00Z',
  correlationGroupIds:['pump-migration'],evidenceIds:['money-risk:1','money-liquidity:1'],authority:'MONEY_VALIDATION_ONLY',canExecute:false,
}
const checks=(evidenceStatus:'PASS'|'REVIEW'|'FAIL'='PASS')=>[
  {dimension:'EVIDENCE' as const,status:evidenceStatus,rationale:'Evidence reviewed.',evidenceRefs:['fusion-evidence:shark:a1:e1']},
  {dimension:'CHRONOLOGY' as const,status:'PASS' as const,rationale:'Chronology reviewed.',evidenceRefs:['fusion-evidence:shark:a1:e1']},
  {dimension:'CAUSAL_LOGIC' as const,status:'PASS' as const,rationale:'Causal logic reviewed.',evidenceRefs:['money-risk:1']},
  {dimension:'INCENTIVES' as const,status:'PASS' as const,rationale:'Actor incentives reviewed.',evidenceRefs:['money-risk:1']},
  {dimension:'BASE_RATES' as const,status:'PASS' as const,rationale:'Replay/base-rate evidence reviewed.',evidenceRefs:['money-risk:1']},
  {dimension:'CONTRADICTIONS' as const,status:'PASS' as const,rationale:'No unresolved contradiction remains.',evidenceRefs:['money-risk:1']},
  {dimension:'ALTERNATIVES' as const,status:'PASS' as const,rationale:'No-trade and later-entry alternatives remain.',evidenceRefs:['money-risk:1']},
]
const mims=(status:'PASS'|'REVIEW'|'FAIL'='PASS')=>bindMakeItMakeSenseStage({
  stage:'TRADE' as const,
  vote:makeItMakeSense({voteId:'mims:'+status,subjectId:candidate.opportunityId,checks:checks(status)}),
  expectedSubjectId:candidate.opportunityId,
})
const charter=(mode:JhadinaPurseCharter['autonomyMode']):JhadinaPurseCharter=>({
  charterId:'charter:1',charterVersion:'v1',userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',autonomyMode:mode,
  maxTotalDeployableBps:5000,minLiquidReserveMinor:10000n,minEmergencyReserveMinor:5000n,maxSingleOpportunityBps:1500,maxCorrelatedExposureBps:2500,maxRebalanceTurnoverBps:5000,
  lanePolicies:[{lane:'MEME',enabled:true,maxAllocationBps:2000,maxSinglePositionBps:1500,minConfidenceBps:6500}],
  verifiedOwnerPayoutDestinationId:'owner:bank',ownerProfitSweepProtected:true,charterMutationRequiresOwnerApproval:true,ownerDestinationMutationRequiresOwnerApproval:true,
  jhadinaMayAllocate:true,jhadinaMayRebalance:true,effectiveAt:'2026-10-03T04:00:00Z',evidenceIds:['charter:e1'],authority:'OWNER_TREASURY_CHARTER',canExecute:false,
})

test('SHARK -> Purse binds Money-governed candidate, trade MIMS, and no execution authority',()=>{
  const opportunity=adaptSharkResearchToPurseOpportunity({research,candidate,tradeMims:mims('PASS'),validation})
  assert.equal(opportunity.sourceKind,'SHARK')
  assert.equal(opportunity.lane,'MEME')
  assert.equal(opportunity.governance?.mimsStatus,'PASS')
  assert.equal(opportunity.governance?.liveEligible,true)
  assert.equal(opportunity.canExecute,false)
})

test('LIVE_GOVERNED Purse admits only a PASS trade vote',()=>{
  const pass=adaptSharkResearchToPurseOpportunity({research,candidate,tradeMims:mims('PASS'),validation})
  const review=adaptSharkResearchToPurseOpportunity({research,candidate,tradeMims:mims('REVIEW'),validation})
  const livePass=ingestPurseOpportunity({charter:charter('LIVE_GOVERNED_INTENTS'),opportunity:pass,ingestedAt:'2026-10-03T05:00:04Z'})
  const liveReview=ingestPurseOpportunity({charter:charter('LIVE_GOVERNED_INTENTS'),opportunity:review,ingestedAt:'2026-10-03T05:00:04Z'})
  assert.equal(livePass.admitted,true)
  assert.equal(liveReview.admitted,false)
  assert.ok(liveReview.reasonCodes.includes('MIMS_PASS_REQUIRED_FOR_LIVE'))
  const shadowReview=ingestPurseOpportunity({charter:charter('SHADOW_AUTONOMOUS'),opportunity:review,ingestedAt:'2026-10-03T05:00:04Z'})
  assert.equal(shadowReview.admitted,true)
})

test('MIMS FAIL is blocked even in paper mode',()=>{
  const failed=adaptSharkResearchToPurseOpportunity({research,candidate,tradeMims:mims('FAIL'),validation})
  const admitted=ingestPurseOpportunity({charter:charter('PAPER_AUTONOMOUS'),opportunity:failed,ingestedAt:'2026-10-03T05:00:04Z'})
  assert.equal(admitted.admitted,false)
  assert.ok(admitted.reasonCodes.includes('MIMS_FAILED'))
})

test('unresolved SHARK contradictions prevent live-governed admission without erasing research value',()=>{
  const contested:SharkMoneyResearchArtifact={
    ...research,
    evidenceIntegrity:{...research.evidenceIntegrity,unresolvedContradictionIds:['contradiction:1']},
  }
  const opportunity=adaptSharkResearchToPurseOpportunity({research:contested,candidate,tradeMims:mims('PASS'),validation})
  assert.equal(opportunity.governance?.liveEligible,false)
  const live=ingestPurseOpportunity({charter:charter('LIVE_GOVERNED_INTENTS'),opportunity,ingestedAt:'2026-10-03T05:00:04Z'})
  assert.equal(live.admitted,false)
  assert.ok(live.reasonCodes.includes('UNRESOLVED_CONTRADICTIONS_FOR_LIVE'))
  const shadow=ingestPurseOpportunity({charter:charter('SHADOW_AUTONOMOUS'),opportunity,ingestedAt:'2026-10-03T05:00:04Z'})
  assert.equal(shadow.admitted,true)
})

test('bridge fails closed when Money candidate is not bound to concrete SHARK evidence',()=>{
  assert.throws(()=>adaptSharkResearchToPurseOpportunity({
    research,candidate:{...candidate,evidenceIds:['other:evidence']},tradeMims:mims('PASS'),validation,
  }),/SOURCE_LINEAGE_MISSING/)
})
