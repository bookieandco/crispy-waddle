import assert from 'node:assert/strict'
import type {Opportunity} from './opportunity.js'
import {buildSideHustleProfile} from './side-hustles.js'
import {
  createOwnedMediaCycle,
  createOwnedMediaProperty,
  observeOwnedMediaAnalytics,
  observeOwnedMediaMonetization,
  ownedMediaRecordKind,
  recordOwnedMediaPublication,
  transitionOwnedMediaCycle,
} from './side-hustle-owned-media.js'

const now='2026-10-03T15:00:00.000Z'
const opportunity:Opportunity={
  id:'opportunity:owned-media:1',title:'Owned channel',family:'business',type:'commercial',
  sourceName:'Owned media test',sourceUrl:'https://example.test/owned-media',
  claims:[],evidence:[],verificationStatus:'unverified',sourceConfidence:.9,riskFlags:[],
  metadata:{sideHustleProfile:buildSideHustleProfile({family:'owned_media'})},
  status:'ready',createdAt:now,updatedAt:now,
}
const property=createOwnedMediaProperty({
  opportunity,id:'property:youtube:1',propertyType:'youtube_channel',label:'Channel One',
  providerRef:'youtube:channel:1',evidenceRefs:['evidence:channel'],createdAt:now,
})
assert.equal(ownedMediaRecordKind(property),'property')
assert.equal(property.publishingAuthorized,false)

let cycle=createOwnedMediaCycle({
  property,id:'cycle:1',title:'Video one',topicRef:'topic:1',
  evidenceRefs:['evidence:topic'],createdAt:'2026-10-03T15:01:00.000Z',
})
cycle=transitionOwnedMediaCycle({
  cycle,status:'produced',productionRef:'director:production:1',
  evidenceRefs:['evidence:production'],observedAt:'2026-10-03T15:02:00.000Z',
})
cycle=transitionOwnedMediaCycle({
  cycle,status:'approved',approvalRef:'approval:1',
  evidenceRefs:['evidence:approval'],observedAt:'2026-10-03T15:03:00.000Z',
})
const publication=recordOwnedMediaPublication({
  property,cycle,id:'publication:1',providerRef:'youtube',
  externalContentRef:'youtube:video:1',canonicalUrl:'https://example.test/video',
  evidenceRefs:['evidence:publish'],publishedAt:'2026-10-03T15:04:00.000Z',
})
assert.equal(ownedMediaRecordKind(publication),'publication')
assert.equal(publication.publishingAuthorized,false)
cycle=transitionOwnedMediaCycle({
  cycle,status:'published',publicationReceiptId:publication.id,
  evidenceRefs:['evidence:publish'],observedAt:'2026-10-03T15:04:00.000Z',
})
const analytics=observeOwnedMediaAnalytics({
  property,cycle,id:'analytics:1',providerRef:'youtube',
  impressions:1000,views:250,watchSeconds:12000,clicks:20,leads:3,conversions:1,
  grossRevenue:12.5,currency:'usd',evidenceRefs:['evidence:analytics'],
  observedAt:'2026-10-04T15:00:00.000Z',
})
assert.equal(ownedMediaRecordKind(analytics),'analytics')
assert.equal(analytics.moneyMovementAuthorized,false)
const monetization=observeOwnedMediaMonetization({
  property,cycle,id:'monetization:1',kind:'advertising',amount:12.5,currency:'USD',
  providerRef:'youtube',evidenceRefs:['evidence:revenue'],observedAt:'2026-10-04T15:00:00.000Z',
})
assert.equal(ownedMediaRecordKind(monetization),'monetization')
assert.equal(monetization.paymentAuthorized,false)
cycle=transitionOwnedMediaCycle({
  cycle,status:'measured',evidenceRefs:['evidence:analytics'],observedAt:'2026-10-04T15:00:00.000Z',
})
assert.equal(cycle.status,'measured')
assert.equal(cycle.externalActionAuthorized,false)

console.log('side hustle owned media tests passed')
