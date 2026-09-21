import assert from 'node:assert/strict'
import test from 'node:test'
import { createSharkSimulationLearningEnvelope } from './shark-simulation-learning.js'
import type { OpportunityCandidateV2 } from './cross-asset-fusion-contracts.js'
import type { PaperStrategyResult } from './paper-strategy-result.js'
import type { SharkMoneyResearchArtifact } from './shark-intelligence-ingress.js'

const research:SharkMoneyResearchArtifact={
 bridgeVersion:'SHARK-MONEY-01',sourceSchemaVersion:'SHARK-MONEY-01',sourceEnvelopeId:'env1',sourceProposalId:'proposal1',sourceAssessmentId:'a1',
 subjectId:'crypto:solana:TOKEN',chainId:'solana',tokenAddress:'TOKEN',informationCutoff:'2026-09-21T20:00:00Z',thesis:'test',sourceConfidence:.7,
 sourceRisk:{overallRisk:.2,band:'candidate'},invalidationConditions:['liquidity-collapse'],evidence:[],sourceProvenance:{contentHash:'p',generatedBy:'shark'},
 decisionCase:{caseId:'c',accountId:'acct',subjectId:'crypto:solana:TOKEN',requestedBy:'u',informationCutoff:'2026-09-21T20:00:00Z',createdAt:'2026-09-21T20:00:01Z',status:'RESEARCH_ONLY',provenanceHash:'p'},
 assessment:{caseId:'c',evidenceStatus:'INGESTED',freshnessStatus:'UNEVALUATED',riskStatus:'UNEVALUATED',stressStatus:'UNEVALUATED',simulationStatus:'UNEVALUATED',liquidityStatus:'UNEVALUATED',calibrationStatus:'UNEVALUATED',authorityStatus:'MISSING',disposition:'RESEARCH_ONLY'},
 financialAuthority:'NONE',capitalAuthority:'NONE',executionAuthority:'NONE',protectedFundAuthority:'NONE'
}
const opportunity:OpportunityCandidateV2={
 opportunityId:'opp1',thesisId:'thesis1',subjectId:research.subjectId,instrumentIds:['meme:solana:TOKEN'],assetClasses:['MEME'],direction:'BULLISH',horizon:'INTRADAY',
 expectedUpside:.2,expectedDownside:-.1,confidence:.6,liquidityStatus:'ASSESSED',riskStatus:'ASSESSED',invalidationConditions:['liquidity-collapse'],
 evidenceIds:['fusion-evidence:shark:a1'],informationCutoff:'2026-09-21T20:00:00Z',expiresAt:'2026-09-22T20:00:00Z',provenanceHash:'op',authority:'NONE'
}
const result:PaperStrategyResult={
 strategyResultId:'result1',paperRunId:'run1',currency:'USD',startingValue:{minor:100000n,currency:'USD'},endingValue:{minor:110000n,currency:'USD'},
 realizedPnl:{minor:10000n,currency:'USD'},unrealizedPnl:{minor:0n,currency:'USD'},totalPnl:{minor:10000n,currency:'USD'},returnBps:1000,feesPaid:{minor:100n,currency:'USD'},
 aggregateFillRateBps:10000,weightedSlippageBps:20,executionOutcomeIds:['eo1'],executionPlanIds:['ep1'],terminalState:'CLOSED',
 startedAt:'2026-09-21T20:01:00Z',endedAt:'2026-09-21T20:10:00Z',evidenceIds:['fill1'],stateHash:'state',authority:'LEARNING_ONLY'
}

test('SHARK-SIM.1 canonical Money result returns to SHARK with no financial authority',()=>{
 const e=createSharkSimulationLearningEnvelope({research,opportunity,result,strategyId:'NEW_PAIR_POST_BUNDLE_DIP',scenarioId:'launch-1',createdAt:'2026-09-21T20:10:01Z'})
 assert.equal(e.sourceAssessmentId,'a1');assert.equal(e.returnBps,1000);assert.equal(e.financialAuthority,'NONE');assert.equal(e.simulationAuthority,'LEARNING_ONLY')
})

test('SHARK-SIM.2 learning cannot skip independent Money risk/liquidity governance',()=>{
 assert.throws(()=>createSharkSimulationLearningEnvelope({research,opportunity:{...opportunity,riskStatus:'UNKNOWN'},result,strategyId:'s',scenarioId:'x',createdAt:'2026-09-21T20:10:01Z'}),/OPPORTUNITY_NOT_GOVERNED/)
})

test('SHARK-SIM.3 learning requires proof the Money opportunity actually consumed this SHARK assessment',()=>{
 assert.throws(()=>createSharkSimulationLearningEnvelope({research,opportunity:{...opportunity,evidenceIds:['other']},result,strategyId:'s',scenarioId:'x',createdAt:'2026-09-21T20:10:01Z'}),/SOURCE_LINEAGE_MISSING/)
})
