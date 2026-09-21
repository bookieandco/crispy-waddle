import { createHash } from 'node:crypto'
import type { DecisionAssessment, DecisionCase } from './decision-workflow-contracts.js'
import type { EvidenceQuality, EvidenceRef } from './financial-intelligence-contracts.js'\nimport type { GovernedIntelligenceArtifact } from './cross-asset-fusion-adapters.js'\nimport type { ThesisDirection } from './cross-asset-fusion-contracts.js'

export const SHARK_MONEY_BRIDGE_VERSION = 'SHARK-MONEY-01' as const
export const SUPPORTED_SHARK_MONEY_SCHEMA_VERSION = 'SHARK-MONEY-01' as const

export type SharkProposalDisposition = 'ASK' | 'DEFER' | 'DECLINE'
export type SharkRiskBand = 'candidate' | 'watch' | 'high-risk' | 'blocked'

export type SharkMoneyTransportEnvelope = Readonly<{
  schemaVersion: typeof SUPPORTED_SHARK_MONEY_SCHEMA_VERSION
  envelopeId: string
  proposal: Readonly<{
    proposalId: string
    contextId: string
    disposition: SharkProposalDisposition
    recommendation: string
    rationale: string
    uncertainty: readonly string[]
    alternatives: readonly string[]
  }>
  assessment: Readonly<{
    assessmentId: string
    chainId: string
    tokenAddress: string
    assessedAt: string
    tradeType: string
    assessmentVersion: string
    thesis: string
    confidence: number
    sourceRisk: Readonly<{
      overallRisk: number
      band: SharkRiskBand
    }>
    invalidationConditions: readonly string[]
    evidenceRefs: readonly Readonly<{
      evidenceId: string
      source: string
      observedAt: string
      summary: string
      immutable: true
    }>[]
  }>
  sourceProvenance: Readonly<{
    contentHash: string
    generatedBy: string
  }>
  allowedUses: readonly string[]
  authority: Readonly<{
    decision: 'INTELLIGENCE_ONLY'
    financialExecution: 'NONE'
    capitalAccess: 'NONE'
    protectedFunds: 'NONE'
    walletSigning: 'NONE'
  }>
}>

export type SharkResearchIngressContext = Readonly<{
  accountId: string
  requestedBy: string
  receivedAt: string
  sourceNamespace: string
  evidenceQuality: EvidenceQuality
}>

export type SharkMoneyResearchArtifact = Readonly<{
  bridgeVersion: typeof SHARK_MONEY_BRIDGE_VERSION
  sourceSchemaVersion: typeof SUPPORTED_SHARK_MONEY_SCHEMA_VERSION
  sourceEnvelopeId: string
  sourceProposalId: string
  sourceAssessmentId: string
  subjectId: string
  chainId: string
  tokenAddress: string
  informationCutoff: string
  thesis: string
  sourceConfidence: number
  sourceRisk: SharkMoneyTransportEnvelope['assessment']['sourceRisk']
  invalidationConditions: readonly string[]
  evidence: readonly EvidenceRef[]
  sourceProvenance: SharkMoneyTransportEnvelope['sourceProvenance']
  decisionCase: DecisionCase
  assessment: DecisionAssessment
  financialAuthority: 'NONE'
  capitalAuthority: 'NONE'
  executionAuthority: 'NONE'
  protectedFundAuthority: 'NONE'
}>

function nonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code)
}

function iso(value: string, code: string): void {
  nonEmpty(value, code)
  if (Number.isNaN(Date.parse(value))) throw new Error(code)
}

function unitInterval(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(code)
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function assertSharkResearchIngress(
  envelope: SharkMoneyTransportEnvelope,
  context: SharkResearchIngressContext,
): void {
  if (envelope.schemaVersion !== SUPPORTED_SHARK_MONEY_SCHEMA_VERSION) {
    throw new Error('MONEY_SHARK_SCHEMA_VERSION_UNSUPPORTED')
  }
  if (!envelope.allowedUses.includes('MONEY_RESEARCH_INPUT')) {
    throw new Error('MONEY_SHARK_RESEARCH_USE_NOT_ALLOWED')
  }
  if (
    envelope.authority.decision !== 'INTELLIGENCE_ONLY' ||
    envelope.authority.financialExecution !== 'NONE' ||
    envelope.authority.capitalAccess !== 'NONE' ||
    envelope.authority.protectedFunds !== 'NONE' ||
    envelope.authority.walletSigning !== 'NONE'
  ) {
    throw new Error('MONEY_SHARK_AUTHORITY_ESCALATION_FORBIDDEN')
  }

  const disposition = (envelope.proposal as { disposition?: string }).disposition
  if (!['ASK', 'DEFER', 'DECLINE'].includes(disposition ?? '')) {
    throw new Error('MONEY_SHARK_PROCEED_DISPOSITION_FORBIDDEN')
  }

  nonEmpty(envelope.envelopeId, 'MONEY_SHARK_ENVELOPE_ID_REQUIRED')
  nonEmpty(envelope.proposal.proposalId, 'MONEY_SHARK_PROPOSAL_ID_REQUIRED')
  nonEmpty(envelope.proposal.contextId, 'MONEY_SHARK_CONTEXT_ID_REQUIRED')
  nonEmpty(envelope.assessment.assessmentId, 'MONEY_SHARK_ASSESSMENT_ID_REQUIRED')
  nonEmpty(envelope.assessment.chainId, 'MONEY_SHARK_CHAIN_ID_REQUIRED')
  nonEmpty(envelope.assessment.tokenAddress, 'MONEY_SHARK_TOKEN_ADDRESS_REQUIRED')
  nonEmpty(envelope.assessment.thesis, 'MONEY_SHARK_THESIS_REQUIRED')
  nonEmpty(envelope.assessment.assessmentVersion, 'MONEY_SHARK_ASSESSMENT_VERSION_REQUIRED')
  nonEmpty(envelope.sourceProvenance.contentHash, 'MONEY_SHARK_PROVENANCE_HASH_REQUIRED')
  nonEmpty(envelope.sourceProvenance.generatedBy, 'MONEY_SHARK_GENERATOR_REQUIRED')
  nonEmpty(context.accountId, 'MONEY_SHARK_ACCOUNT_ID_REQUIRED')
  nonEmpty(context.requestedBy, 'MONEY_SHARK_REQUESTED_BY_REQUIRED')
  nonEmpty(context.sourceNamespace, 'MONEY_SHARK_SOURCE_NAMESPACE_REQUIRED')

  iso(envelope.assessment.assessedAt, 'MONEY_SHARK_ASSESSED_AT_INVALID')
  iso(context.receivedAt, 'MONEY_SHARK_RECEIVED_AT_INVALID')
  if (Date.parse(context.receivedAt) < Date.parse(envelope.assessment.assessedAt)) {
    throw new Error('MONEY_SHARK_RECEIVED_BEFORE_ASSESSMENT')
  }

  unitInterval(envelope.assessment.confidence, 'MONEY_SHARK_CONFIDENCE_INVALID')
  unitInterval(envelope.assessment.sourceRisk.overallRisk, 'MONEY_SHARK_SOURCE_RISK_INVALID')
  if (!envelope.assessment.invalidationConditions.length) {
    throw new Error('MONEY_SHARK_INVALIDATION_REQUIRED')
  }
  if (!envelope.assessment.evidenceRefs.length) {
    throw new Error('MONEY_SHARK_EVIDENCE_REQUIRED')
  }

  const evidenceIds = new Set<string>()
  for (const evidence of envelope.assessment.evidenceRefs) {
    nonEmpty(evidence.evidenceId, 'MONEY_SHARK_EVIDENCE_ID_REQUIRED')
    nonEmpty(evidence.source, 'MONEY_SHARK_EVIDENCE_SOURCE_REQUIRED')
    nonEmpty(evidence.summary, 'MONEY_SHARK_EVIDENCE_SUMMARY_REQUIRED')
    iso(evidence.observedAt, 'MONEY_SHARK_EVIDENCE_OBSERVED_AT_INVALID')
    if (Date.parse(evidence.observedAt) > Date.parse(envelope.assessment.assessedAt)) {
      throw new Error('MONEY_SHARK_EVIDENCE_AFTER_ASSESSMENT')
    }
    if (evidence.immutable !== true) throw new Error('MONEY_SHARK_MUTABLE_EVIDENCE_FORBIDDEN')
    if (evidenceIds.has(evidence.evidenceId)) throw new Error('MONEY_SHARK_DUPLICATE_EVIDENCE')
    evidenceIds.add(evidence.evidenceId)
  }

  const serialized = JSON.stringify(envelope)
  if (/privateKey|secretKey|sendTransaction|signTransaction|walletAdapter|money\.trade\.submit|approvalReceiptId|allocationDecisionId/i.test(serialized)) {
    throw new Error('MONEY_SHARK_EXECUTION_MATERIAL_FORBIDDEN')
  }
}

function toMoneyEvidence(
  envelope: SharkMoneyTransportEnvelope,
  context: SharkResearchIngressContext,
): readonly EvidenceRef[] {
  return Object.freeze(
    envelope.assessment.evidenceRefs.map((evidence) =>
      Object.freeze({
        evidenceId: evidence.evidenceId,
        sourceId: `${context.sourceNamespace}:${evidence.source}`,
        observedAt: evidence.observedAt,
        receivedAt: context.receivedAt,
        quality: context.evidenceQuality,
        inputHash: hash({
          envelope: envelope.envelopeId,
          evidenceId: evidence.evidenceId,
          provenance: envelope.sourceProvenance.contentHash,
        }),
      }),
    ),
  )
}

export function ingestSharkResearch(
  envelope: SharkMoneyTransportEnvelope,
  context: SharkResearchIngressContext,
): SharkMoneyResearchArtifact {
  assertSharkResearchIngress(envelope, context)
  const evidence = toMoneyEvidence(envelope, context)
  const subjectId = `crypto:${envelope.assessment.chainId}:${envelope.assessment.tokenAddress}`
  const decisionCase: DecisionCase = Object.freeze({
    caseId: `shark:${envelope.envelopeId}`,
    accountId: context.accountId,
    subjectId,
    requestedBy: context.requestedBy,
    informationCutoff: envelope.assessment.assessedAt,
    createdAt: context.receivedAt,
    status: 'RESEARCH_ONLY',
    provenanceHash: envelope.sourceProvenance.contentHash,
  })
  const assessment: DecisionAssessment = Object.freeze({
    caseId: decisionCase.caseId,
    evidenceStatus: 'INGESTED',
    freshnessStatus: 'UNEVALUATED',
    riskStatus: 'UNEVALUATED',
    stressStatus: 'UNEVALUATED',
    simulationStatus: 'UNEVALUATED',
    liquidityStatus: 'UNEVALUATED',
    calibrationStatus: 'UNEVALUATED',
    authorityStatus: 'MISSING',
    disposition: 'RESEARCH_ONLY',
  })

  return Object.freeze({
    bridgeVersion: SHARK_MONEY_BRIDGE_VERSION,
    sourceSchemaVersion: envelope.schemaVersion,
    sourceEnvelopeId: envelope.envelopeId,
    sourceProposalId: envelope.proposal.proposalId,
    sourceAssessmentId: envelope.assessment.assessmentId,
    subjectId,
    chainId: envelope.assessment.chainId,
    tokenAddress: envelope.assessment.tokenAddress,
    informationCutoff: envelope.assessment.assessedAt,
    thesis: envelope.assessment.thesis,
    sourceConfidence: envelope.assessment.confidence,
    sourceRisk: Object.freeze({ ...envelope.assessment.sourceRisk }),
    invalidationConditions: Object.freeze([...envelope.assessment.invalidationConditions]),
    evidence,
    sourceProvenance: Object.freeze({ ...envelope.sourceProvenance }),
    decisionCase,
    assessment,
    financialAuthority: 'NONE',
    capitalAuthority: 'NONE',
    executionAuthority: 'NONE',
    protectedFundAuthority: 'NONE',
  })
}

export function assertSharkMoneyResearchOnly(artifact: SharkMoneyResearchArtifact): void {
  if (
    artifact.bridgeVersion !== SHARK_MONEY_BRIDGE_VERSION ||
    artifact.sourceSchemaVersion !== SUPPORTED_SHARK_MONEY_SCHEMA_VERSION
  ) {
    throw new Error('MONEY_SHARK_BRIDGE_VERSION_INVALID')
  }
  if (
    artifact.assessment.disposition !== 'RESEARCH_ONLY' ||
    artifact.assessment.authorityStatus !== 'MISSING' ||
    artifact.financialAuthority !== 'NONE' ||
    artifact.capitalAuthority !== 'NONE' ||
    artifact.executionAuthority !== 'NONE' ||
    artifact.protectedFundAuthority !== 'NONE'
  ) {
    throw new Error('MONEY_SHARK_RESEARCH_ONLY_BOUNDARY_VIOLATED')
  }
}


export function sharkResearchToGovernedIntelligence(input: {
  artifact: SharkMoneyResearchArtifact
  instrumentId: string
  direction: ThesisDirection
  strength: number
  expiresAt: string
}): GovernedIntelligenceArtifact {
  assertSharkMoneyResearchOnly(input.artifact)
  nonEmpty(input.instrumentId, 'MONEY_SHARK_INSTRUMENT_ID_REQUIRED')
  unitInterval(input.strength, 'MONEY_SHARK_FUSION_STRENGTH_INVALID')
  iso(input.expiresAt, 'MONEY_SHARK_FUSION_EXPIRY_INVALID')
  if (input.expiresAt <= input.artifact.informationCutoff) {
    throw new Error('MONEY_SHARK_FUSION_EXPIRY_NOT_AFTER_CUTOFF')
  }
  return Object.freeze({
    artifactId: `shark:${input.artifact.sourceAssessmentId}`,
    domain: 'SHARK',
    subjectId: input.artifact.subjectId,
    instrumentId: input.instrumentId,
    assetClass: 'MEME',
    direction: input.direction,
    strength: input.strength,
    confidence: input.artifact.sourceConfidence,
    informationCutoff: input.artifact.informationCutoff,
    expiresAt: input.expiresAt,
    evidenceRefs: Object.freeze(input.artifact.evidence.map((evidence) => evidence.evidenceId).sort()),
    provenanceHash: input.artifact.sourceProvenance.contentHash,
    financialAuthority: 'NONE',
  })
}
