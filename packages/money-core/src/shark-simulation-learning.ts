import type { OpportunityCandidateV2 } from './cross-asset-fusion-contracts.js'
import { assertOpportunityBoundary } from './cross-asset-fusion-contracts.js'
import type { PaperStrategyResult } from './paper-strategy-result.js'
import { assertSharkMoneyResearchOnly, type SharkMoneyResearchArtifact } from './shark-intelligence-ingress.js'

export const SHARK_SIMULATION_LEARNING_SCHEMA_VERSION='SHARK-SIM-LEARNING-01' as const

export type SharkSimulationLearningEnvelope=Readonly<{
 schemaVersion:typeof SHARK_SIMULATION_LEARNING_SCHEMA_VERSION
 sourceAssessmentId:string
 sourceProposalId:string
 strategyId:string
 scenarioId:string
 opportunityId:string
 paperRunId:string
 strategyResultId:string
 terminalState:'OPEN'|'CLOSED'
 returnBps:number
 aggregateFillRateBps:number
 weightedSlippageBps:number
 feesPaidMinor:string
 currency:string
 evaluatedAt:string
 evidenceIds:readonly string[]
 simulationAuthority:'LEARNING_ONLY'
 financialAuthority:'NONE'
}>

export function createSharkSimulationLearningEnvelope(input:{
 research:SharkMoneyResearchArtifact
 opportunity:OpportunityCandidateV2
 result:PaperStrategyResult
 strategyId:string
 scenarioId:string
 createdAt:string
}):SharkSimulationLearningEnvelope{
 assertSharkMoneyResearchOnly(input.research)
 assertOpportunityBoundary(input.opportunity)
 if(input.opportunity.subjectId!==input.research.subjectId)throw new Error('MONEY_SHARK_LEARNING_SUBJECT_MISMATCH')
 if(input.opportunity.riskStatus!=='ASSESSED'||input.opportunity.liquidityStatus!=='ASSESSED')throw new Error('MONEY_SHARK_LEARNING_OPPORTUNITY_NOT_GOVERNED')
 const expectedEvidenceId=`fusion-evidence:shark:${input.research.sourceAssessmentId}`
 if(!input.opportunity.evidenceIds.includes(expectedEvidenceId))throw new Error('MONEY_SHARK_LEARNING_SOURCE_LINEAGE_MISSING')
 if(input.result.authority!=='LEARNING_ONLY'||input.result.paperRunId.trim()==='')throw new Error('MONEY_SHARK_LEARNING_RESULT_INVALID')
 if(!input.strategyId.trim()||!input.scenarioId.trim())throw new Error('MONEY_SHARK_LEARNING_IDENTITY_REQUIRED')
 if(!input.createdAt||Number.isNaN(Date.parse(input.createdAt))||input.createdAt<input.result.endedAt)throw new Error('MONEY_SHARK_LEARNING_TIME_INVALID')
 const evidenceIds=Object.freeze([...new Set([...input.opportunity.evidenceIds,...input.result.evidenceIds])].sort())
 if(!evidenceIds.length)throw new Error('MONEY_SHARK_LEARNING_EVIDENCE_REQUIRED')
 return Object.freeze({
  schemaVersion:SHARK_SIMULATION_LEARNING_SCHEMA_VERSION,
  sourceAssessmentId:input.research.sourceAssessmentId,
  sourceProposalId:input.research.sourceProposalId,
  strategyId:input.strategyId,
  scenarioId:input.scenarioId,
  opportunityId:input.opportunity.opportunityId,
  paperRunId:input.result.paperRunId,
  strategyResultId:input.result.strategyResultId,
  terminalState:input.result.terminalState,
  returnBps:input.result.returnBps,
  aggregateFillRateBps:input.result.aggregateFillRateBps,
  weightedSlippageBps:input.result.weightedSlippageBps,
  feesPaidMinor:input.result.feesPaid.minor.toString(),
  currency:input.result.currency,
  evaluatedAt:input.result.endedAt,
  evidenceIds,
  simulationAuthority:'LEARNING_ONLY',
  financialAuthority:'NONE',
 })
}
