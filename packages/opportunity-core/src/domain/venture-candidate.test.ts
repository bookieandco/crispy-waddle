import assert from 'node:assert/strict'
import {
  synthesizeVentureDiscoveryCandidate,
  ventureCandidateToOpportunity,
  type VentureCandidateProfile,
} from './venture-candidate.js'
import type { VentureMarketSignal } from './venture-factory.js'

const now='2026-10-01T18:00:00.000Z'
const profile:VentureCandidateProfile={
  seedId:'pod-personalized-market',
  family:'pod_personalized_commerce',
  title:'Original personalized hometown gift opportunity',
  buyer:'Gift buyers who want personal local identity',
  jobToBeDone:'Find a meaningful personalized gift quickly',
  paidProblem:'Generic gifts feel impersonal',
  marketMechanic:'Personalization plus local nostalgia',
  unmetAngles:['Neighborhood-specific variants','Milestone bundles'],
}

function signal(id:string,sourceRef:string,kind:VentureMarketSignal['kind'],confidence=0.8):VentureMarketSignal{
  return{id,kind,sourceRef,observedAt:now,note:'Observed market evidence',confidence}
}

{
  const candidate=synthesizeVentureDiscoveryCandidate({
    profile,
    signals:[
      signal('s1','https://etsy.com/listing/1','sales',0.85),
      signal('s2','https://google.com/search?q=gift','search',0.8),
      signal('s3','https://reddit.com/r/gifts','buyer_pain',0.75),
    ],
    generatedAt:now,
  })
  assert.equal(candidate.recommendation,'research')
  assert.equal(candidate.externalActionAuthorized,false)
  assert.equal(candidate.automaticExperimentAuthorized,false)
  assert.equal(candidate.directCreativeReplicationAuthorized,false)
  assert.equal(candidate.score.signalCount,3)
  assert.ok(candidate.score.total>=70)

  const opportunity=ventureCandidateToOpportunity(candidate)
  assert.equal(opportunity.family,'business')
  assert.equal(opportunity.type,'commercial')
  assert.equal(opportunity.status,'discovered')
  assert.equal(opportunity.verificationStatus,'unverified')
  assert.equal(opportunity.metadata?.ventureCandidateId,candidate.id)
  assert.deepEqual(opportunity.metadata?.sideHustleProfile,{
    family:'pod_personalized_commerce',
    role:'standalone',
    automationMaturity:'unvalidated',
    executionOwners:['pupsonstuff','commerce'],
    monetizationModels:['print_on_demand_margin'],
  })
  assert.equal(opportunity.metadata?.hubCategory,'products')
  assert.deepEqual(opportunity.metadata?.sideHustleDiscovery,{
    origin:'venture_factory',
    stage:'research_candidate',
    candidateId:candidate.id,
    recommendation:'research',
    signalIds:['s1','s2','s3'],
    sourceRefs:[
      'https://etsy.com/listing/1',
      'https://google.com/search?q=gift',
      'https://reddit.com/r/gifts',
    ],
    evidenceScore:candidate.score.total,
    authority:'OPPORTUNITY_ONLY',
    externalActionAuthorized:false,
    automaticExperimentAuthorized:false,
    moneyMovementAuthorized:false,
  })
  assert.equal(opportunity.metadata?.opportunityAuthority,'OPPORTUNITY_ONLY')
  assert.equal(opportunity.metadata?.requiresUserApproval,true)
  assert.ok(opportunity.riskFlags.includes('requires_originality_gate'))
}

{
  const candidate=synthesizeVentureDiscoveryCandidate({
    profile,
    signals:[
      signal('s1','https://etsy.com/listing/1','search',0.55),
      signal('s2','https://etsy.com/listing/2','search',0.55),
    ],
    generatedAt:now,
  })
  assert.notEqual(candidate.recommendation,'research')
  assert.ok(candidate.blockers.some(blocker=>blocker.includes('three independent')))
  assert.ok(candidate.blockers.some(blocker=>blocker.includes('source diversity')))
}

{
  const candidate=synthesizeVentureDiscoveryCandidate({
    profile,
    signals:[
      {...signal('s1','https://a.example/x','search',0.9),observedAt:'2026-01-01T00:00:00.000Z'},
      {...signal('s2','https://b.example/x','sales',0.9),observedAt:'2026-01-01T00:00:00.000Z'},
      {...signal('s3','https://c.example/x','buyer_pain',0.9),observedAt:'2026-01-01T00:00:00.000Z'},
    ],
    generatedAt:now,
  })
  assert.ok(candidate.blockers.some(blocker=>blocker.includes('stale')))
}

console.log('venture candidate tests passed')
