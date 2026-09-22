import { createHash } from 'node:crypto'
import {
  assessmentToDecisionProposal,
  type MemeTradeAssessment,
} from '@jhadina/shark-intelligence-core/meme-trader'
import type {
  EvidenceStance,
  SharkMoneyTransportEnvelope,
  ThesisDirection,
} from '@jhadina/money-core'

export type SharkMoneyEvidenceMetadata = Readonly<{
  evidenceId: string
  source: string
  sourceGroup: string
  stance: EvidenceStance
  direction: ThesisDirection
  strength: number
  confidence: number
  observedAt: string
  availableAt: string
  summary: string
  immutable: true
}>

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function informationCutoff(evidence: readonly SharkMoneyEvidenceMetadata[]): string {
  if (!evidence.length) throw new Error('SHARK_MONEY_EVIDENCE_REQUIRED')
  for (const item of evidence) {
    if (!item.availableAt || Number.isNaN(Date.parse(item.availableAt))) {
      throw new Error(`SHARK_MONEY_EVIDENCE_AVAILABLE_AT_INVALID:${item.evidenceId}`)
    }
  }
  return [...evidence].sort((a, b) => a.availableAt.localeCompare(b.availableAt)).at(-1)!.availableAt
}

export function createSharkMoneyResearchEnvelope(input: {
  assessment: MemeTradeAssessment
  contextId: string
  evidence: readonly SharkMoneyEvidenceMetadata[]
}): SharkMoneyTransportEnvelope {
  const evidenceById = new Map<string, SharkMoneyEvidenceMetadata>()
  for (const item of input.evidence) {
    if (evidenceById.has(item.evidenceId)) throw new Error(`SHARK_MONEY_DUPLICATE_EVIDENCE_METADATA:${item.evidenceId}`)
    evidenceById.set(item.evidenceId, item)
  }
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
        sourceGroup: metadata.sourceGroup,
        stance: metadata.stance,
        direction: metadata.direction,
        strength: metadata.strength,
        confidence: metadata.confidence,
        observedAt: metadata.observedAt,
        availableAt: metadata.availableAt,
        summary: metadata.summary,
        immutable: true as const,
      })
    }),
  )
  const cutoff = informationCutoff(evidenceRefs)

  const contentHash = hash({
    proposalId: proposal.id,
    contextId: proposal.contextId,
    disposition: proposal.disposition,
    assessmentId: input.assessment.assessmentId,
    chainId: input.assessment.token.chainId,
    tokenAddress: input.assessment.token.tokenAddress,
    assessedAt: input.assessment.assessedAt,
    informationCutoff: cutoff,
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
      sourceGroup: item.sourceGroup,
      stance: item.stance,
      direction: item.direction,
      strength: item.strength,
      confidence: item.confidence,
      observedAt: item.observedAt,
      availableAt: item.availableAt,
    })),
  })

  return Object.freeze({
    schemaVersion: 'SHARK-MONEY-02',
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
      informationCutoff: cutoff,
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
