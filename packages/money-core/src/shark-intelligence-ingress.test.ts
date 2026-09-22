import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertSharkMoneyResearchOnly,
  assertSharkResearchIngress,
  ingestSharkResearch,
  sharkResearchToFusionEvidence,
  sharkResearchToGovernedIntelligence,
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
    schemaVersion: 'SHARK-MONEY-02',
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
      informationCutoff: '2026-09-21T19:59:59Z',
      tradeType: 'new-pair-speculation',
      assessmentVersion: 'meme-trader-assessment-v6-multi-venue-liquidity-control',
      thesis: 'Candidate has strong activity but requires independent Money review.',
      confidence: 0.7,
      sourceRisk: { overallRisk: 0.3, band: 'candidate' },
      invalidationConditions: ['liquidity collapses'],
      evidenceRefs: [
        {
          evidenceId: 'dexscreener:obs:1',
          source: 'dexscreener',
          sourceGroup: 'dexscreener-market',
          stance: 'SUPPORTS',
          direction: 'BULLISH',
          strength: 0.7,
          confidence: 0.8,
          observedAt: '2026-09-21T19:59:58Z',
          availableAt: '2026-09-21T19:59:59Z',
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
  assert.equal(artifact.informationCutoff, '2026-09-21T19:59:59Z')
  assert.deepEqual(artifact.evidenceIntegrity.sourceGroups, ['shark:dexscreener-market'])
  assert.equal(artifact.financialAuthority, 'NONE')
  assert.equal(artifact.capitalAuthority, 'NONE')
  assert.equal(artifact.executionAuthority, 'NONE')
  assert.equal(artifact.protectedFundAuthority, 'NONE')
  assertSharkMoneyResearchOnly(artifact)
})

test('SHARK-MONEY.2 rejects old schema, source PROCEED, and authority escalation', () => {
  const old = structuredClone(envelope()) as any
  old.schemaVersion = 'SHARK-MONEY-01'
  assert.throws(() => assertSharkResearchIngress(old, context), /SCHEMA_VERSION_UNSUPPORTED/)

  const proceed = structuredClone(envelope()) as any
  proceed.proposal.disposition = 'PROCEED'
  assert.throws(() => assertSharkResearchIngress(proceed, context), /PROCEED_DISPOSITION_FORBIDDEN/)

  const capital = structuredClone(envelope()) as any
  capital.authority.capitalAccess = 'GRANTED'
  assert.throws(() => assertSharkResearchIngress(capital, context), /AUTHORITY_ESCALATION_FORBIDDEN/)

  const trade = structuredClone(envelope()) as any
  trade.proposal.recommendation = 'use money.trade.submit now'
  assert.throws(() => assertSharkResearchIngress(trade, context), /EXECUTION_MATERIAL_FORBIDDEN/)
})

test('SHARK-MONEY.3 information cutoff is PIT and evidence availability cannot leak forward', () => {
  const futureCutoff = structuredClone(envelope()) as any
  futureCutoff.assessment.informationCutoff = '2026-09-21T20:00:01Z'
  assert.throws(() => assertSharkResearchIngress(futureCutoff, context), /CUTOFF_AFTER_ASSESSMENT/)

  const afterCutoff = structuredClone(envelope()) as any
  afterCutoff.assessment.evidenceRefs[0].availableAt = '2026-09-21T20:00:00Z'
  assert.throws(() => assertSharkResearchIngress(afterCutoff, context), /EVIDENCE_AFTER_CUTOFF/)

  const impossibleAvailability = structuredClone(envelope()) as any
  impossibleAvailability.assessment.evidenceRefs[0].observedAt = '2026-09-21T19:59:59Z'
  impossibleAvailability.assessment.evidenceRefs[0].availableAt = '2026-09-21T19:59:58Z'
  assert.throws(() => assertSharkResearchIngress(impossibleAvailability, context), /AVAILABLE_BEFORE_OBSERVED/)
})

test('SHARK-MONEY.4 rejects mutable, duplicated, and unclassified evidence', () => {
  const mutable = structuredClone(envelope()) as any
  mutable.assessment.evidenceRefs[0].immutable = false
  assert.throws(() => assertSharkResearchIngress(mutable, context), /MUTABLE_EVIDENCE_FORBIDDEN/)

  const duplicate = structuredClone(envelope()) as any
  duplicate.assessment.evidenceRefs.push({ ...duplicate.assessment.evidenceRefs[0] })
  assert.throws(() => assertSharkResearchIngress(duplicate, context), /DUPLICATE_EVIDENCE/)

  const noGroup = structuredClone(envelope()) as any
  noGroup.assessment.evidenceRefs[0].sourceGroup = ''
  assert.throws(() => assertSharkResearchIngress(noGroup, context), /SOURCE_GROUP_REQUIRED/)

  const badStance = structuredClone(envelope()) as any
  badStance.assessment.evidenceRefs[0].stance = 'MAYBE'
  assert.throws(() => assertSharkResearchIngress(badStance, context), /EVIDENCE_STANCE_INVALID/)
})

test('SHARK-MONEY.5 preserves independent source groups as separate Money fusion evidence', () => {
  const multi = structuredClone(envelope()) as any
  multi.assessment.evidenceRefs.push({
    evidenceId: 'helius:wallet:1',
    source: 'helius',
    sourceGroup: 'helius-chain',
    stance: 'SUPPORTS',
    direction: 'BULLISH',
    strength: 0.6,
    confidence: 0.9,
    observedAt: '2026-09-21T19:59:57Z',
    availableAt: '2026-09-21T19:59:59Z',
    summary: 'Independent chain evidence.',
    immutable: true,
  })
  const research = ingestSharkResearch(multi, context)
  const evidence = sharkResearchToFusionEvidence({
    artifact: research,
    instrumentId: 'crypto:solana-mainnet:TOKEN1',
    expiresAt: '2026-09-21T21:00:00Z',
  })
  assert.equal(evidence.length, 2)
  assert.deepEqual(evidence.map((item) => item.sourceGroup).sort(), ['shark:dexscreener-market', 'shark:helius-chain'])
  assert.ok(evidence.every((item) => item.authority === 'NONE'))
  assert.ok(evidence.every((item) => item.availableAt <= research.informationCutoff))
  assert.throws(() => sharkResearchToGovernedIntelligence({
    artifact: research,
    instrumentId: 'crypto:solana-mainnet:TOKEN1',
    direction: 'BULLISH',
    strength: 0.6,
    expiresAt: '2026-09-21T21:00:00Z',
  }), /AGGREGATE_SOURCE_INDEPENDENCE_LOSS/)
})

test('SHARK-MONEY.6 contradictions survive ingress and force review', () => {
  const conflicting = structuredClone(envelope()) as any
  conflicting.assessment.evidenceRefs.push({
    evidenceId: 'liquidity:drain:1',
    source: 'onchain-liquidity',
    sourceGroup: 'pool-state',
    stance: 'CONTRADICTS',
    direction: 'BEARISH',
    strength: 0.9,
    confidence: 0.95,
    observedAt: '2026-09-21T19:59:58Z',
    availableAt: '2026-09-21T19:59:59Z',
    summary: 'Liquidity deterioration contradicts the positive thesis.',
    immutable: true,
  })
  const research = ingestSharkResearch(conflicting, context)
  assert.equal(research.assessment.disposition, 'REQUIRES_REVIEW')
  assert.deepEqual(research.evidenceIntegrity.contradictingEvidenceIds, ['liquidity:drain:1'])
  assert.deepEqual(research.evidenceIntegrity.unresolvedContradictionIds, ['shark-contradiction:a1:liquidity:drain:1'])
  const fusion = sharkResearchToFusionEvidence({
    artifact: research,
    instrumentId: 'crypto:solana-mainnet:TOKEN1',
    expiresAt: '2026-09-21T21:00:00Z',
  })
  assert.equal(fusion.find((item) => item.evidenceId.endsWith('liquidity:drain:1'))?.stance, 'CONTRADICTS')
  assert.throws(() => sharkResearchToGovernedIntelligence({
    artifact: research,
    instrumentId: 'crypto:solana-mainnet:TOKEN1',
    direction: 'BULLISH',
    strength: 0.6,
    expiresAt: '2026-09-21T21:00:00Z',
  }), /AGGREGATE_CONTRADICTION_FORBIDDEN/)
})

test('SHARK-MONEY.7 single-source non-contradictory compatibility adapter remains evidence-only', () => {
  const research = ingestSharkResearch(envelope(), context)
  const artifact = sharkResearchToGovernedIntelligence({
    artifact: research,
    instrumentId: 'crypto:solana-mainnet:TOKEN1',
    direction: 'BULLISH',
    strength: 0.6,
    expiresAt: '2026-09-21T21:00:00Z',
  })
  assert.equal(artifact.domain, 'SHARK')
  assert.equal(artifact.assetClass, 'MEME')
  assert.equal(artifact.financialAuthority, 'NONE')
  assert.equal(artifact.confidence, 0.7)
  assert.deepEqual(artifact.evidenceRefs, ['dexscreener:obs:1'])
  assert.equal('riskDecisionId' in artifact, false)
  assert.equal('allocationDecisionId' in artifact, false)
})
