import assert from 'node:assert/strict'
import { adaptSubnetOpportunity } from './subnet.js'

const opportunity=adaptSubnetOpportunity({
  externalId:'city-of-san-diego-alvarado',
  title:'City of San Diego: Alvarado Trunk Sewer',
  primeName:'Filanc',
  description:'Prime contractor is requesting sub-bids.',
  closingDate:'2026-10-28',
  performanceStartDate:'2027-01-01',
  placeOfPerformance:'California',
  naicsCode:'237110',
  naicsLabel:'Water and Sewer Line and Related Structures Construction',
  contactName:'Julia Masaitis',
  contactEmail:'bids@example.com',
  sourceUrl:'https://legacy.sba.gov/opportunity/city-of-san-diego-alvarado',
  capturedAt:'2026-09-22T00:00:00.000Z',
})

assert.equal(opportunity.id,'subnet:city-of-san-diego-alvarado')
assert.equal(opportunity.family,'business')
assert.equal(opportunity.type,'contract')
assert.equal(opportunity.deadline,'2026-10-28')
assert.equal(opportunity.metadata?.providerId,'provider:sba-subnet')
assert.equal(opportunity.metadata?.outreachAuthorized,false)
assert.equal(opportunity.metadata?.bidSubmissionAuthorized,false)
assert.equal(opportunity.verificationStatus,'unverified')
assert.equal(opportunity.riskFlags.includes('prime_subcontracting_opportunity'),true)

console.log('SUBNet adapter tests passed')
