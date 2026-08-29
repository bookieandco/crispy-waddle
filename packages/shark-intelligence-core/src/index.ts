import type { Opportunity, OpportunityClaim } from '@jhadina/opportunity-core'
import { adaptOpportunityEvidence } from './evidence-adapter.js'

export type SharkOpportunityKind = 'token' | 'pool' | 'wallet' | 'market' | 'mining' | 'energy' | 'other'
export type SharkDecision = 'observe' | 'watch' | 'avoid' | 'candidate' | 'needs_human_review'
export type SharkRisk = 'liquidity' | 'holder_concentration' | 'contract_control' | 'sellability' | 'market_structure' | 'social_manipulation' | 'wallet_behavior' | 'source_quality' | 'execution' | 'unknown'
export type SharkEvidence = { sourceId: string; sourceType: 'onchain' | 'market' | 'social' | 'community' | 'research' | 'system'; observedAt: string; signal: string; strength: number; verified: boolean; metadata?: Record<string, string | number | boolean | null> }
export type SharkStreetSignal = { name: 'liquidity_flight' | 'insider_accumulation' | 'insider_distribution' | 'holder_concentration' | 'volume_anomaly' | 'social_hype_without_depth' | 'developer_behavior' | 'migration_behavior' | 'wash_activity' | 'failed_sellability'; direction: 'positive' | 'negative' | 'unknown'; strength: number; rationale: string; evidenceIds: string[] }
export type SharkOpportunityDecision = { id: string; opportunityId: string; kind: SharkOpportunityKind; decision: SharkDecision; confidence: number; expectedValue?: number; downsideRisk?: number; risks: SharkRisk[]; evidence: SharkEvidence[]; streetSignals: SharkStreetSignal[]; sourceQuality: number; novelty: number; repeatability: number; monetizationPotential?: number; productionOrExecutionDifficulty?: number; policy: { policyPassed: boolean; authorizationRequired: boolean; authorized: boolean; executionPermitted: false }; decidedAt: string; modelVersion?: string }
export type SharkOpportunityAssessmentInput = { opportunity: Opportunity; kind?: SharkOpportunityKind; streetSignals?: SharkStreetSignal[]; modelVersion?: string }
const riskFlagMap: Record<string, SharkRisk> = { liquidity: 'liquidity', holder_concentration: 'holder_concentration', contract_control: 'contract_control', sellability: 'sellability', market_structure: 'market_structure', social_manipulation: 'social_manipulation', wallet_behavior: 'wallet_behavior', source_quality: 'source_quality', execution: 'execution' }
function clampScore(value: number | undefined): number { return !Number.isFinite(value) ? 0 : Math.max(0, Math.min(1, value as number)) }
function riskFromClaim(claim: OpportunityClaim): SharkRisk | undefined { return riskFlagMap[claim.field] }
export function assessOpportunity({ opportunity, kind = 'other', streetSignals = [], modelVersion }: SharkOpportunityAssessmentInput): SharkOpportunityDecision { const risks = new Set<SharkRisk>(); for (const flag of opportunity.riskFlags) risks.add(riskFlagMap[flag.toLowerCase().replace(/\s+/g, '_')] ?? 'unknown'); for (const claim of opportunity.claims) { const risk = riskFromClaim(claim); if (risk) risks.add(risk) }; const evidence = opportunity.evidence.map(adaptOpportunityEvidence); const sourceQuality = clampScore(opportunity.sourceConfidence); const confidence = clampScore(opportunity.opportunityScore !== undefined ? opportunity.opportunityScore / 100 : sourceQuality); const severeRisk = risks.has('liquidity') || risks.has('sellability') || risks.has('contract_control'); const decision: SharkDecision = severeRisk ? 'avoid' : evidence.length === 0 ? 'observe' : opportunity.verificationStatus === 'verified' ? 'candidate' : 'needs_human_review'; return { id: `shark:${opportunity.id}`, opportunityId: opportunity.id, kind, decision, confidence, expectedValue: opportunity.expectedValue, downsideRisk: severeRisk ? 1 : risks.size / 10, risks: [...risks], evidence, streetSignals, sourceQuality, novelty: 0, repeatability: 0, policy: { policyPassed: false, authorizationRequired: true, authorized: false, executionPermitted: false }, decidedAt: new Date().toISOString(), modelVersion } }
export function validateSharkDecision(decision: SharkOpportunityDecision): string[] { const errors: string[] = []; if (!decision.id) errors.push('id is required'); if (!decision.opportunityId) errors.push('opportunityId is required'); if (!decision.decidedAt) errors.push('decidedAt is required'); for (const [name, value] of [['confidence', decision.confidence], ['sourceQuality', decision.sourceQuality], ['novelty', decision.novelty], ['repeatability', decision.repeatability]] as const) if (!Number.isFinite(value) || value < 0 || value > 1) errors.push(`${name} must be between 0 and 1`); if (decision.policy.executionPermitted !== false) errors.push('Shark intelligence cannot authorize execution'); if (decision.policy.authorized && !decision.policy.authorizationRequired) errors.push('authorized cannot be true when authorizationRequired is false'); return errors }
export type { SharkObservation, SharkObservationSource } from './observation.js'
export { createSharkObservation, validateSharkObservation } from './observation.js'
export type { SharkObservationInput, SharkObservationIngestionResult, SharkObservationSourceAdapter } from './observation-ingestion.js'
export { ingestSharkObservations } from './observation-ingestion.js'
export type { SharkObservationCluster } from './observation-corroboration.js'
export { corroborateSharkObservations, observationClusterKey } from './observation-corroboration.js'
export type { SharkFeatureStats, SharkLearningSnapshot, SharkOutcome } from './learning.js'
export { buildSharkLearningSnapshot, learningAdjustment, recordSharkOutcome } from './learning.js'
export type { SharkFeatureVector, SharkScore } from './scoring.js'
export { buildSharkFeatureVector, scoreSharkOpportunity } from './scoring.js'
export type { SharkFusedSignal, SharkSourceKind } from './fusion.js'
export { fuseObservations, fuseStreetSignals, inferRiskFromObservation } from './fusion.js'
export type { SharkSimulationConfig, SharkSimulationPoint, SharkSimulationTrade } from './simulation.js'
export { simulateSharkTrade } from './simulation.js'
export type { SharkDecisionRecord, SharkStrategyDefinition } from './strategy-registry.js'
export { SharkStrategyRegistry } from './strategy-registry.js'
export type { SharkAttributedLearningRecord } from './learning-attribution.js'
export { buildAttributedLearningSnapshot, toAttributedLearningRecord } from './learning-attribution.js'
export type { SharkSimulationLearningRecord } from './simulation-learning.js'
export { learnFromSimulationTrade, simulationTradeToOutcome } from './simulation-learning.js'
export { adaptOpportunityEvidence, adaptOpportunityEvidenceSet } from './evidence-adapter.js'
export type { SharkObservationSourceAdapter as SharkObservationAdapter } from './observation-ingestion.js'
