import type { DecisionDisposition, DecisionProposal, EvidenceRef } from '@jhadina/core-spine'
import type { MemeTradeAssessment } from './assessment'
import { evaluateFiveQuestionGate } from './five-question-gate'

export type MemeTradeDecisionContext = {
  contextId: string
  evidenceSummary?: Record<string, string>
}

function evidenceRefs(assessment: MemeTradeAssessment, summary: Record<string, string>): EvidenceRef[] {
  return assessment.evidenceIds.map((id) => ({
    id,
    source: id.startsWith('arkham:') ? 'arkham' : 'meme-trader',
    observedAt: assessment.assessedAt,
    summary: summary[id] ?? `Evidence ${id} used by Meme Trader assessment.`,
    immutable: true,
  }))
}

export function assessmentToDecisionProposal(
  assessment: MemeTradeAssessment,
  context: MemeTradeDecisionContext,
): DecisionProposal {
  const gate = evaluateFiveQuestionGate(assessment)
  const blocked = assessment.riskAssessment.band === 'blocked'
  const highRisk = assessment.riskAssessment.band === 'high-risk'

  const disposition: DecisionDisposition = blocked
    ? 'DECLINE'
    : !gate.passed || highRisk
      ? 'DEFER'
      : 'ASK'

  const recommendation = blocked
    ? `Do not trade ${assessment.token.tokenAddress}: risk gate is blocked.`
    : !gate.passed
      ? `Do not enter ${assessment.token.tokenAddress} until the identified gate blockers are resolved.`
      : highRisk
        ? `Defer ${assessment.token.tokenAddress}: assessment is high-risk and requires explicit review.`
        : `Review ${assessment.token.tokenAddress} for a ${assessment.tradeType} opportunity; no execution authority is granted by this proposal.`

  const rationale = [
    assessment.thesis,
    `Overall risk=${assessment.riskAssessment.overallRisk.toFixed(3)} (${assessment.riskAssessment.band}).`,
    `Five-question gate=${gate.passed ? 'passed' : 'failed'}.`,
    gate.blockers.length ? `Blockers: ${gate.blockers.join(', ')}.` : 'No deterministic gate blockers.',
    `Confidence=${assessment.confidence.toFixed(3)}.`,
  ].join(' ')

  return {
    id: `meme-trade-proposal_${assessment.assessmentId}`,
    contextId: context.contextId,
    disposition,
    recommendation,
    rationale,
    evidence: evidenceRefs(assessment, context.evidenceSummary ?? {}),
    uncertainty: [
      ...gate.blockers,
      'Assessment is advisory; policy must independently authorize any action.',
      'Position sizing and execution must be evaluated by downstream policy/capability controls.',
    ],
    alternatives: [
      'DEFER and collect additional market, wallet, social, or supply evidence.',
      'PAPER trade the thesis for validation before any live execution.',
      'DECLINE if invalidation conditions are observed.',
    ],
  }
}
