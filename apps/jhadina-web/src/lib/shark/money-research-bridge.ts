import { createHash } from 'node:crypto'
import {
  assessmentToDecisionProposal,
  type MemeTradeAssessment,
} from '@jhadina/shark-intelligence-core/meme-trader'
import type { SharkMoneyTransportEnvelope } from '@jhadina/money-core'

export type SharkMoneyEvidenceMetadata = Readonly<{
  evidenceId: string
  source: string
  observedAt: string
  summary: string
  immutable: true
}>

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function createSharkMoneyResearchEnvelope(input: {
  assessment: MemeTradeAssessment
  contextId: string
  evidence: readonly SharkMoneyEvidenceMetadata[]
}): SharkMoneyTransportEnvelope {
  const evidenceById = new Map(input.evidence.map((item) => [item.evidenceId, item] as const))
  const missing = input.assessment.evidenceIds.filter((id) => !evidenceById.has(id))
  if (missing.length) throw new Error(`SHARK_MONEY_EVIDENCE_METADATA_MISSING:${missing.sort().join(',')}`)

  const proposal = assessmentToDecisionProposal(input.assessment, {
    contextId: input.contextId,
    evidenceSummary: Object.fromEntries(input.evidence.map((item) => [item.evidenceId, item.summary])),
  })
  if (proposal.disposition === 'PROCEED') throw new Error('SHARK_MONEY_PROCEED_DISPOSITION_FORBIDDEN')

  const evidenceRefs = Object.freeze(
    input.assessment.evidenceIds.map((id) => {
      const metadata = evidenceById.get(id)!
      return Object.freeze({
        evidenceId: metadata.evidenceId,
        source: metadata.source,
        observedAt: metadata.observedAt,
        summary: metadata.summary,
        immutable: true as const,
      })
    }),
  )

  const contentHash = hash({
    proposalId: proposal.id,
    contextId: proposal.contextId,
    disposition: proposal.disposition,
    assessmentId: input.assessment.assessmentId,
    chainId: input.assessment.token.chainId,
    tokenAddress: input.assessment.token.tokenAddress,
    assessedAt: input.assessment.assessedAt,
    assessmentVersion: input.assessment.assessmentVersion,
    thesis: input.assessment.thesis,
    confidence: input.assessment.confidence,
    sourceRisk: {
      overallRisk: input.assessment.riskAssessment.overallRisk,
      band: input.assessment.riskAssessment.band,
    },
    invalidationConditions: [...input.assessment.invalidation.conditions].sort(),
    evidenceRefs: evidenceRefs.map((item) => ({
      evidenceId: item.evidenceId,
      source: item.source,
      observedAt: item.observedAt,
    })),
  })

  return Object.freeze({
    schemaVersion: 'SHARK-MONEY-01',
    envelopeId: `shark-money:${contentHash}`,
    proposal: Object.freeze({
      proposalId: proposal.id,
      contextId: proposal.contextId,
      disposition: proposal.disposition,
      recommendation: proposal.recommendation,
      rationale: proposal.rationale,
      uncertainty: Object.freeze([...proposal.uncertainty]),
      alternatives: Object.freeze([...proposal.alternatives]),
    }),
    assessment: Object.freeze({
      assessmentId: input.assessment.assessmentId,
      chainId: input.assessment.token.chainId,
      tokenAddress: input.assessment.token.tokenAddress,
      assessedAt: input.assessment.assessedAt,
      tradeType: input.assessment.tradeType,
      assessmentVersion: input.assessment.assessmentVersion,
      thesis: input.assessment.thesis,
      confidence: input.assessment.confidence,
      sourceRisk: Object.freeze({
        overallRisk: input.assessment.riskAssessment.overallRisk,
        band: input.assessment.riskAssessment.band,
      }),
      invalidationConditions: Object.freeze([...input.assessment.invalidation.conditions]),
      evidenceRefs,
    }),
    sourceProvenance: Object.freeze({
      contentHash,
      generatedBy: '@jhadina/shark-intelligence-core',
    }),
    allowedUses: Object.freeze(['MONEY_RESEARCH_INPUT']),
    authority: Object.freeze({
      decision: 'INTELLIGENCE_ONLY',
      financialExecution: 'NONE',
      capitalAccess: 'NONE',
      protectedFunds: 'NONE',
      walletSigning: 'NONE',
    }),
  })
}
