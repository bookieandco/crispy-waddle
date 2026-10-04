import assert from 'node:assert/strict'
import {
  buildSearchCommercePublishRunway,
  rankSearchCommerceProductCandidates,
  scoreSearchCommerceProductCandidate,
  type SearchCommerceProductSniperSignal,
} from './side-hustle-search-commerce-product-sniper.js'

const now = '2026-10-04T12:00:00.000Z'
const refs = {
  demand: 'https://trends.example/demand',
  buyer: 'https://search.example/buyer',
  competition: 'https://market.example/competition',
  margin: 'evidence:unit-economics',
  channel: 'evidence:channel-fit',
  differentiation: 'evidence:originality',
  automation: 'evidence:automation',
  repeatability: 'evidence:repeatability',
  seasonal: 'evidence:seasonality',
}

function signal(
  kind: SearchCommerceProductSniperSignal['kind'],
  score: number,
  sourceRef: string,
  id = kind,
): SearchCommerceProductSniperSignal {
  return {
    id: 'signal:' + id,
    kind,
    score,
    confidence: 0.85,
    sourceRef,
    observedAt: '2026-10-02T12:00:00.000Z',
    note: kind + ' evidence',
  }
}

const strongSignals: SearchCommerceProductSniperSignal[] = [
  signal('demand', 90, refs.demand),
  signal('buyer_intent', 88, refs.buyer),
  signal('competition_headroom', 76, refs.competition),
  signal('margin_potential', 82, refs.margin),
  signal('differentiation', 86, refs.differentiation),
  signal('channel_fit', 90, refs.channel),
  signal('automation_potential', 85, refs.automation),
  signal('repeatability', 80, refs.repeatability),
  signal('seasonal_fit', 90, refs.seasonal),
  signal('platform_risk', 25, 'evidence:platform-risk'),
  signal('fulfillment_complexity', 30, 'evidence:fulfillment-risk'),
  signal('capital_risk', 10, 'evidence:capital-risk'),
]

const candidate = scoreSearchCommerceProductCandidate({
  id: 'sniper:retro-hometown-ornament',
  ventureId: 'venture:pod-1',
  family: 'pod_personalized_commerce',
  title: 'Original personalized hometown ornament',
  productType: 'ornament',
  buyer: 'holiday gift buyer',
  marketMechanic: 'personal identity plus hometown nostalgia',
  originalConcept: 'Original illustrated hometown coordinate ornament with user-selected place details.',
  targetChannels: ['etsy', 'pupsonstuff'],
  signals: strongSignals,
  competitorArtifactRefs: ['competitor:listing:observed'],
  originalityEvidenceRefs: ['evidence:originality'],
  seasonalWindow: {
    eventId: 'holiday-2026',
    eventDate: '2026-12-25',
    creativeLeadDays: 5,
    productionLeadDays: 4,
    indexingLeadDays: 14,
    shippingBufferDays: 10,
    validationLeadDays: 7,
    evidenceRefs: ['evidence:holiday-date', 'evidence:provider-lead-time'],
  },
  evaluatedAt: now,
})

assert.equal(candidate.recommendation, 'research')
assert.equal(candidate.originality.decision, 'pass')
assert.equal(candidate.publishRunway?.publishBy, '2026-11-15')
assert.equal(candidate.publishRunway?.status, 'open')
assert.equal(candidate.externalActionAuthorized, false)
assert.equal(candidate.publishingAuthorized, false)
assert.ok(candidate.score >= 70)

const missed = buildSearchCommercePublishRunway({
  eventId: 'past-event',
  eventDate: '2026-10-01',
  creativeLeadDays: 2,
  productionLeadDays: 2,
  indexingLeadDays: 2,
  shippingBufferDays: 2,
  validationLeadDays: 2,
  evidenceRefs: ['evidence:event'],
}, now)
assert.equal(missed.status, 'publish_by_passed')
assert.ok(missed.daysUntilPublishBy < 0)

const originalityBlocked = scoreSearchCommerceProductCandidate({
  id: 'sniper:blocked',
  ventureId: 'venture:pod-1',
  family: 'pod_personalized_commerce',
  title: 'Blocked clone',
  productType: 'shirt',
  buyer: 'fan',
  marketMechanic: 'collectible identity',
  originalConcept: 'Direct clone concept',
  targetChannels: ['etsy'],
  signals: strongSignals,
  competitorArtifactRefs: ['competitor:1'],
  intentionalStyleClone: true,
  originalityEvidenceRefs: ['evidence:originality'],
  evaluatedAt: now,
})
assert.equal(originalityBlocked.recommendation, 'reject')
assert.equal(originalityBlocked.directCreativeReplicationAuthorized, false)

const incomplete = scoreSearchCommerceProductCandidate({
  id: 'sniper:incomplete',
  ventureId: 'venture:pod-1',
  family: 'pod_personalized_commerce',
  title: 'Needs evidence',
  productType: 'mug',
  buyer: 'gift buyer',
  marketMechanic: 'personalization',
  originalConcept: 'Original personalized mug concept.',
  targetChannels: ['etsy'],
  signals: [
    signal('demand', 80, refs.demand),
    signal('buyer_intent', 75, refs.buyer),
  ],
  originalityEvidenceRefs: ['evidence:originality'],
  evaluatedAt: now,
})
assert.equal(incomplete.recommendation, 'hold')
assert.ok(incomplete.blockers.some((item) => item.includes('competition_headroom')))

const report = rankSearchCommerceProductCandidates({
  ventureId: 'venture:pod-1',
  family: 'pod_personalized_commerce',
  candidates: [
    {
      id: 'sniper:strong',
      ventureId: 'venture:pod-1',
      family: 'pod_personalized_commerce',
      title: 'Strong original concept',
      productType: 'ornament',
      buyer: 'gift buyer',
      marketMechanic: 'identity gift',
      originalConcept: 'Original identity-led ornament system.',
      targetChannels: ['etsy'],
      signals: strongSignals,
      originalityEvidenceRefs: ['evidence:originality'],
      evaluatedAt: now,
    },
    {
      id: 'sniper:weak',
      ventureId: 'venture:pod-1',
      family: 'pod_personalized_commerce',
      title: 'Weak concept',
      productType: 'mug',
      buyer: 'gift buyer',
      marketMechanic: 'generic gifting',
      originalConcept: 'Original but weakly supported mug idea.',
      targetChannels: ['etsy'],
      signals: [
        signal('demand', 30, refs.demand, 'weak-demand'),
        signal('buyer_intent', 30, refs.buyer, 'weak-buyer'),
        signal('competition_headroom', 20, refs.competition, 'weak-comp'),
        signal('margin_potential', 20, refs.margin, 'weak-margin'),
        signal('channel_fit', 30, refs.channel, 'weak-channel'),
      ],
      originalityEvidenceRefs: ['evidence:originality'],
      evaluatedAt: now,
    },
  ],
  evaluatedAt: now,
})
assert.equal(report.candidates[0]?.id, 'sniper:strong')
assert.equal(report.researchQueue.length, 1)
assert.equal(report.externalActionAuthorized, false)

console.log('side-hustle-search-commerce-product-sniper tests passed')
