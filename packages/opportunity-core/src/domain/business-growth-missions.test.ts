import assert from 'node:assert/strict'
import { buildBusinessGrowthMissionDeck, scoreBusinessGrowthOutcome, type BusinessGrowthSnapshot } from './business-growth-missions.js'

const observedAt = '2026-10-15T12:00:00.000Z'
const base: BusinessGrowthSnapshot = {
  ventureId: 'venture:pupsonstuff',
  businessId: 'pupsonstuff',
  siteUrl: 'https://pupsonstuff.example',
  observedAt,
  evidence: [
    { ref: 'gsc:verified:1', kind: 'search_console', observedAt, verified: true },
    { ref: 'research:gift:1', kind: 'market_research', observedAt, verified: true },
    { ref: 'audit:structured:1', kind: 'site_audit', observedAt, verified: true },
    { ref: 'community:thread:1', kind: 'community', observedAt, verified: true },
  ],
  signals: [
    { id: 'gift', query: 'custom dog memorial portrait', intent: 'transactional', impressions: 180, clicks: 7,
      existingPageUrl: 'https://pupsonstuff.example/collections/memorial',
      evidenceRefs: ['gsc:verified:1'] },
    { id: 'canvas', query: 'personalized dog canvas', intent: 'commercial', impressions: 95,
      evidenceRefs: ['research:gift:1'] },
    { id: 'technical', query: 'missing product schema', intent: 'informational', issue: 'technical',
      evidenceRefs: ['audit:structured:1'] },
    { id: 'howto', query: 'what is a dog portrait', intent: 'informational',
      evidenceRefs: ['research:gift:1'] },
    { id: 'community', query: 'dog memorial gift recommendations', intent: 'commercial',
      issue: 'community', evidenceRefs: ['community:thread:1'] },
  ],
}

const deck = buildBusinessGrowthMissionDeck(base)
assert.equal(deck.missions.length, 4, 'do not fabricate an article for generic information query')
assert.equal(deck.missions[0]?.kind, 'refresh_page', 'existing high-intent page beats blind new publishing')
assert.deepEqual(deck.missions.map(m => m.kind).sort(),
  ['community_research', 'create_page', 'refresh_page', 'repair_site'].sort())
assert.ok(deck.missions.every(m => m.requiresApproval && !m.externalActionAuthorized && m.earnedXp === 0))
assert.ok(deck.workItems.every(w => w.authorizationEffect === 'NONE' && w.spendUsd === 0))
assert.ok(deck.workItems.every(w => w.agentId === 'marisa:operations'))
assert.equal(deck.totalEarnedXp, 0)

const noProof = buildBusinessGrowthMissionDeck({
  ...base,
  evidence: [{ ref: 'manual:1', kind: 'manual', observedAt, verified: false }],
  signals: [{ id: 'new', query: 'buy custom dog portrait', intent: 'transactional', evidenceRefs: ['manual:1'] }],
})
assert.equal(noProof.missions[0]?.kind, 'measure_baseline')
assert.equal(noProof.missions.find(m => m.sourceSignalId === 'new')?.status, 'evidence_blocked')
assert.equal(noProof.workItems.find(w => w.id.endsWith(':new'))?.status, 'blocked')

const lowTraffic = buildBusinessGrowthMissionDeck({ ...base, signals: [{
  id: 'high-clicks', query: 'pet gift for mom', intent: 'transactional',
  existingPageUrl: 'https://pupsonstuff.example/products/custom-gift',
  clicks: 35, conversions: 0, evidenceRefs: ['gsc:verified:1'],
}] })
assert.equal(lowTraffic.missions[0]?.kind, 'improve_conversion')

const stale = buildBusinessGrowthMissionDeck({ ...base,
  evidence: [{ ref: 'gsc:old', kind: 'search_console', verified: true, observedAt: '2026-01-01T00:00:00.000Z' }],
  signals: [{ id: '1', query: 'pet canvas', intent: 'commercial', evidenceRefs: ['gsc:old'] }],
})
assert.equal(stale.missions[0]?.kind, 'measure_baseline')
assert.equal(stale.missions[1]?.status, 'evidence_blocked')

assert.throws(() => buildBusinessGrowthMissionDeck({ ...base, signals: [
  { id: 'external', query: 'bad', intent: 'transactional',
    existingPageUrl: 'https://competitor.example/product', evidenceRefs: ['gsc:verified:1'] },
] }), /PAGE_NOT_OWNED/)
assert.throws(() => buildBusinessGrowthMissionDeck({ ...base, signals: [
  { id: 'bad', query: 'bad', intent: 'transactional', impressions: -1, evidenceRefs: [] },
] }), /IMPRESSIONS_INVALID/)
assert.throws(() => buildBusinessGrowthMissionDeck({ ...base, evidence: [
  { ref: 'manual:fake', kind: 'manual', observedAt, verified: true },
] }), /MANUAL_CANNOT_VERIFY/)

assert.deepEqual(scoreBusinessGrowthOutcome({ missionId: 'm', providerVerified: false, settledGrossProfitUsd: 100 }),
  { earnedXp: 0, realizedContributionUsd: null, verified: false })
assert.deepEqual(scoreBusinessGrowthOutcome({ missionId: 'm', providerVerified: true,
  settledGrossProfitUsd: 35, experimentCostUsd: 10, settlementRef: 'commerce:settlement:42' }),
  { earnedXp: 45, realizedContributionUsd: 25, verified: true })
assert.deepEqual(scoreBusinessGrowthOutcome({ missionId: 'm', providerVerified: true,
  settledGrossProfitUsd: 10, experimentCostUsd: 30, settlementRef: 'commerce:settlement:43' }),
  { earnedXp: 0, realizedContributionUsd: -20, verified: true })
console.log('BUSINESS-GROWTH-GAME.01 evidence, prioritization, authority and settlement tests passed')
