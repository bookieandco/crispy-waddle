import { weightSharkExperience, type SharkExperience, type SharkExperienceWeight } from '../experience-ledger'

export const CANONICAL_MONEY_SIMULATION_SCHEMA_VERSION='SHARK-SIM-LEARNING-01' as const

export type CanonicalMoneySimulationLearningEnvelope=Readonly<{
 schemaVersion:typeof CANONICAL_MONEY_SIMULATION_SCHEMA_VERSION
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

export type CanonicalMoneySimulationLearningRecord=Readonly<{
 learningRecordId:string
 evidenceClass:'SIMULATED_TRADE_OUTCOME'
 simulationAuthority:'PAPER_ONLY'
 source:'MONEY_CANONICAL_SIMULATION'
 sourceAssessmentId:string
 sourceProposalId:string
 strategyResultId:string
 opportunityId:string
 paperRunId:string
 scenarioId:string
 strategyId:string
 experience:SharkExperience
 evidenceIds:readonly string[]
 createdAt:string
}>

const clamp=(n:number)=>Math.max(-1,Math.min(1,n))
const clamp01=(n:number)=>Math.max(0,Math.min(1,n))

export function createCanonicalMoneySimulationLearningRecord(
 envelope:CanonicalMoneySimulationLearningEnvelope,
):CanonicalMoneySimulationLearningRecord{
 if(envelope.schemaVersion!==CANONICAL_MONEY_SIMULATION_SCHEMA_VERSION)throw new Error('shark_money_simulation_schema_invalid')
 if(envelope.simulationAuthority!=='LEARNING_ONLY'||envelope.financialAuthority!=='NONE')throw new Error('shark_money_simulation_authority_invalid')
 if(envelope.terminalState!=='CLOSED')throw new Error('shark_money_simulation_learning_requires_closed_result')
 if(!envelope.sourceAssessmentId||!envelope.sourceProposalId||!envelope.strategyResultId||!envelope.opportunityId||!envelope.paperRunId||!envelope.strategyId||!envelope.scenarioId)throw new Error('shark_money_simulation_lineage_required')
 if(!envelope.evaluatedAt||Number.isNaN(Date.parse(envelope.evaluatedAt)))throw new Error('shark_money_simulation_time_invalid')
 if(!Number.isFinite(envelope.returnBps)||!Number.isInteger(envelope.aggregateFillRateBps)||envelope.aggregateFillRateBps<0||envelope.aggregateFillRateBps>10000||!Number.isInteger(envelope.weightedSlippageBps))throw new Error('shark_money_simulation_metrics_invalid')
 if(!/^-?\d+$/.test(envelope.feesPaidMinor)||!envelope.currency.trim())throw new Error('shark_money_simulation_money_invalid')
 const evidenceIds=Object.freeze([...new Set(envelope.evidenceIds)].sort())
 if(!evidenceIds.length)throw new Error('shark_money_simulation_evidence_required')
 const fillConfidence=envelope.aggregateFillRateBps/10000
 const executionQuality=1-Math.min(10000,Math.abs(envelope.weightedSlippageBps))/10000
 const experience:Object extends never?never:SharkExperience=Object.freeze({
  experienceId:`money-paper-experience:${envelope.strategyResultId}`,
  occurredAt:envelope.evaluatedAt,
  scenarioId:envelope.scenarioId,
  strategyId:envelope.strategyId,
  outcomeScore:clamp(envelope.returnBps/10000),
  confidence:clamp01(fillConfidence*executionQuality),
  provenanceComplete:true,
 })
 return Object.freeze({
  learningRecordId:`money-paper-learning:${envelope.strategyResultId}`,
  evidenceClass:'SIMULATED_TRADE_OUTCOME',
  simulationAuthority:'PAPER_ONLY',
  source:'MONEY_CANONICAL_SIMULATION',
  sourceAssessmentId:envelope.sourceAssessmentId,
  sourceProposalId:envelope.sourceProposalId,
  strategyResultId:envelope.strategyResultId,
  opportunityId:envelope.opportunityId,
  paperRunId:envelope.paperRunId,
  scenarioId:envelope.scenarioId,
  strategyId:envelope.strategyId,
  experience,
  evidenceIds,
  createdAt:envelope.evaluatedAt,
 })
}

export function weightCanonicalMoneySimulationLearningRecord(
 record:CanonicalMoneySimulationLearningRecord,
 now:Date,
 relevance:number,
):SharkExperienceWeight{
 if(record.source!=='MONEY_CANONICAL_SIMULATION'||record.simulationAuthority!=='PAPER_ONLY')throw new Error('shark_money_simulation_record_invalid')
 return weightSharkExperience(record.experience,now,relevance)
}
