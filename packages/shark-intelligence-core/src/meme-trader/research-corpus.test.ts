import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAKE_IT_MAKE_SENSE_STAGES,
  SHARK_CHAT_CORPUS_AUTHORITY,
  SHARK_CHAT_RESEARCH_MODULES,
  canAdvanceResearchEvidence,
  summarizeSourceIndependence,
  type ResearchSourceObservation,
} from './research-corpus'

test('chat corpus module ids are unique and cannot grant financial authority', () => {
  const ids = SHARK_CHAT_RESEARCH_MODULES.map((item) => item.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(SHARK_CHAT_RESEARCH_MODULES.length >= 60)
  for (const item of SHARK_CHAT_RESEARCH_MODULES) {
    assert.equal(item.authority.financialExecution, 'NONE')
    assert.equal(item.authority.capitalAccess, 'NONE')
    assert.equal(item.authority.protectedFunds, 'NONE')
    assert.equal(item.authority.walletSigning, 'NONE')
  }
  assert.equal(SHARK_CHAT_CORPUS_AUTHORITY.role, 'RESEARCH_ONLY')
})

test('chat corpus preserves the major research families from the transcript audit', () => {
  const ids = new Set(SHARK_CHAT_RESEARCH_MODULES.map((item) => item.id))
  for (const required of [
    'AXIOM_COMMUNITY_DIP_SCALP_V1',
    'MEME_MANIPULATION_PLAYBOOK_V1',
    'CHART_ONCHAIN_FUSION_V1',
    'REGIME_ADAPTIVE_RETRACE_V1',
    'SOURCE_DEDUP_PROVENANCE_V1',
    'MACRO_EASY_MODE_REGIME_V1',
    'CALLER_ENSEMBLE_AUTOBOT_V1',
    'ATTENTION_CAPITAL_ENGINE_V1',
    'MONEY_STRATEGY_FACTORY_V1',
    'SHARK_STRATEGY_FACTORY_1',
  ]) {
    assert.ok(ids.has(required), `missing canonical module ${required}`)
  }
})

test('duplicate and derivative copies do not inflate independent evidence count', () => {
  const observations: ResearchSourceObservation[] = [
    {
      observationId: 'pump-sniper:video-a',
      sourceFamilyId: 'pump-sniper-marketing-script',
      sourceVersionId: 'v3.2-a',
      independentGroup: 'pump-sniper-origin',
      relationship: 'COMMON_ORIGIN',
      claimIds: ['pump-sniper:latency'],
      promotionalPressure: ['affiliate-link', 'free-trial'],
      authority: 'EVIDENCE_ONLY',
      canAuthorizeTrade: false,
    },
    {
      observationId: 'pump-sniper:video-b',
      sourceFamilyId: 'pump-sniper-marketing-script',
      sourceVersionId: 'v3.2-b',
      independentGroup: 'pump-sniper-origin',
      relationship: 'TRANSCRIPT_VARIANT',
      claimIds: ['pump-sniper:latency'],
      promotionalPressure: ['affiliate-link', 'free-trial'],
      authority: 'EVIDENCE_ONLY',
      canAuthorizeTrade: false,
    },
    {
      observationId: 'pump-sniper:affiliate-rewrite',
      sourceFamilyId: 'pump-sniper-marketing-script',
      sourceVersionId: 'affiliate-1',
      independentGroup: 'pump-sniper-origin',
      relationship: 'AFFILIATE_DERIVATIVE',
      claimIds: ['pump-sniper:latency'],
      promotionalPressure: ['affiliate-link'],
      authority: 'EVIDENCE_ONLY',
      canAuthorizeTrade: false,
    },
  ]
  assert.deepEqual(summarizeSourceIndependence(observations), {
    rawSourceCount: 3,
    independentEvidenceCount: 1,
  })
})

test('independent corroboration increments independence without mutating raw source history', () => {
  const observations: ResearchSourceObservation[] = [
    {
      observationId: 'source-a',
      sourceFamilyId: 'family-a',
      sourceVersionId: '1',
      independentGroup: 'origin-a',
      relationship: 'COMMON_ORIGIN',
      claimIds: ['claim-1'],
      promotionalPressure: [],
      authority: 'EVIDENCE_ONLY',
      canAuthorizeTrade: false,
    },
    {
      observationId: 'source-b',
      sourceFamilyId: 'family-b',
      sourceVersionId: '1',
      independentGroup: 'origin-b',
      relationship: 'INDEPENDENT_CORROBORATION',
      claimIds: ['claim-1'],
      promotionalPressure: [],
      authority: 'EVIDENCE_ONLY',
      canAuthorizeTrade: false,
    },
  ]
  assert.deepEqual(summarizeSourceIndependence(observations), {
    rawSourceCount: 2,
    independentEvidenceCount: 2,
  })
})

test('evidence ladder only moves forward and paper/shadow remain distinct', () => {
  assert.equal(canAdvanceResearchEvidence('UNVERIFIED_SOURCE_CLAIM', 'MULTIPLE_INDEPENDENT_SOURCES'), true)
  assert.equal(canAdvanceResearchEvidence('PRIMARY_DATA_SUPPORTED', 'REPRODUCED_IN_PAPER'), true)
  assert.equal(canAdvanceResearchEvidence('REPRODUCED_IN_PAPER', 'REPRODUCED_IN_SHADOW'), true)
  assert.equal(canAdvanceResearchEvidence('REPRODUCED_IN_SHADOW', 'REPRODUCED_IN_PAPER'), false)
  assert.equal(canAdvanceResearchEvidence('STATISTICALLY_VALIDATED', 'STATISTICALLY_VALIDATED'), false)
})

test('MAKE IT MAKE SENSE challenges hypothesis, trade, and performance separately', () => {
  assert.deepEqual(MAKE_IT_MAKE_SENSE_STAGES.map((item) => item.stage), [
    'HYPOTHESIS',
    'TRADE',
    'PERFORMANCE',
  ])
})
