import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertSharkMoneyResearchOnly,
  assertSharkResearchIngress,
  ingestSharkResearch,
  type SharkMoneyTransportEnvelope,
  type SharkResearchIngressContext,
} from './shark-intelligence-ingress.js'

const context: SharkResearchIngressContext = {
  accountId: 'money-research-account',
  requestedBy: 'user-1',
  receivedAt: '2026-09-21T20:00:02Z',
  sourceNamespace: 'shark',
  evidenceQuality: 'SUPPORTED',
}

function envelope(): SharkMoneyTransportEnvelope {
  return {
    schemaVersion: 'SHARK-MONEY-01',
    envelopeId: 'shark-envelope-1',
    proposal: {
      proposalId: 'meme-trade-proposal_a1',
      contextId: 'ctx-1',
      disposition: 'ASK',
      recommendation: 'Review token for a research opportunity; no execution authority is granted.',
      rationale: 'Evidence-backed SHARK assessment.',
      uncertainty: ['Money must independently evaluate risk.'],
      alternatives: ['DEFER'],
    },
    assessment: {
      assessmentId: 'a1',
      chainId: 'solana-mainnet',
      tokenAddress: 'TOKEN1',
      assessedAt: '2026-09-21T20:00:00Z',
      tradeType: 'new-pair-speculation',
      assessmentVersion: 'meme-trader-assessment-v5-authoritative-lp',
      thesis: 'Candidate has strong activity but requires independent Money review.',
      confidence: 0.7,
      sourceRisk: { overallRisk: 0.3, band: 'candidate' },
      invalidationConditions: ['liquidity collapses'],
      evidenceRefs: [
        {
          evidenceId: 'dexscreener:obs:1',
          source: 'meme-trader',
          observedAt: '2026-09-21T19:59:59Z',
          summary: 'Market observation used by SHARK.',
          immutable: true,
        },
      ],
    },
    sourceProvenance: {
      contentHash: 'prov-hash-1',
      generatedBy: '@jhadina/shark-intelligence-core',
    },
    allowedUses: ['MONEY_RESEARCH_INPUT'],
    authority: {
      decision: 'INTELLIGENCE_ONLY',
      financialExecution: 'NONE',
      capitalAccess: 'NONE',
      protectedFunds: 'NONE',
      walletSigning: 'NONE',
    },
  }
}

test('SHARK-MONEY.1 ingests SHARK as research-only and forces independent Money evaluation', () => {
  const artifact = ingestSharkResearch(envelope(), context)
  assert.equal(artifact.assessment.disposition, 'RESEARCH_ONLY')
  assert.equal(artifact.assessment.riskStatus, 'UNEVALUATED')
  assert.equal(artifact.assessment.liquidityStatus, 'UNEVALUATED')
  assert.equal(artifact.assessment.simulationStatus, 'UNEVALUATED')
  assert.equal(artifact.assessment.authorityStatus, 'MISSING')
  assert.equal(artifact.financialAuthority, 'NONE')
  assert.equal(artifact.capitalAuthority, 'NONE')
  assert.equal(artifact.executionAuthority, 'NONE')
  assert.equal(artifact.protectedFundAuthority, 'NONE')
  assert.equal(artifact.sourceRisk.overallRisk, 0.3)
  assertSharkMoneyResearchOnly(artifact)
})

test('SHARK-MONEY.2 rejects a source PROCEED decision at the ingress boundary', () => {
  const bad = structuredClone(envelope()) as any
  bad.proposal.disposition = 'PROCEED'
  assert.throws(
    () => assertSharkResearchIngress(bad, context),
    /MONEY_SHARK_PROCEED_DISPOSITION_FORBIDDEN/,
  )
})

test('SHARK-MONEY.3 rejects execution or protected-capital authority escalation', () => {
  const capital = structuredClone(envelope()) as any
  capital.authority.capitalAccess = 'GRANTED'
  assert.throws(
    () => assertSharkResearchIngress(capital, context),
    /MONEY_SHARK_AUTHORITY_ESCALATION_FORBIDDEN/,
  )

  const trade = structuredClone(envelope()) as any
  trade.proposal.recommendation = 'use money.trade.submit now'
  assert.throws(
    () => assertSharkResearchIngress(trade, context),
    /MONEY_SHARK_EXECUTION_MATERIAL_FORBIDDEN/,
  )
})

test('SHARK-MONEY.4 rejects mutable, duplicated, and future evidence', () => {
  const mutable = structuredClone(envelope()) as any
  mutable.assessment.evidenceRefs[0].immutable = false
  assert.throws(() => assertSharkResearchIngress(mutable, context), /MONEY_SHARK_MUTABLE_EVIDENCE_FORBIDDEN/)

  const duplicate = structuredClone(envelope()) as any
  duplicate.assessment.evidenceRefs.push({ ...duplicate.assessment.evidenceRefs[0] })
  assert.throws(() => assertSharkResearchIngress(duplicate, context), /MONEY_SHARK_DUPLICATE_EVIDENCE/)

  const future = structuredClone(envelope()) as any
  future.assessment.evidenceRefs[0].observedAt = '2026-09-21T20:00:01Z'
  assert.throws(() => assertSharkResearchIngress(future, context), /MONEY_SHARK_EVIDENCE_AFTER_ASSESSMENT/)
})
