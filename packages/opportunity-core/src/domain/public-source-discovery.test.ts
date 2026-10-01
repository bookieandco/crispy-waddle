import assert from 'node:assert/strict'
import {
  assessPublicSourceSearchResult,
  buildPublicSourceDiscoveryQueries,
  decidePublicSourceDiscovery,
  extractOfficialProcurementLinks,
  isKnownProcurementPortal,
  type PublicJurisdictionDescriptor,
} from './public-source-discovery.js'

const la:PublicJurisdictionDescriptor={
  id:'county:06037',
  level:'county',
  name:'Los Angeles County',
  state:'CA',
  county:'Los Angeles',
}

const queries=buildPublicSourceDiscoveryQueries(la)
assert.equal(queries.length,3)
assert.ok(queries.every(q=>q.includes('Los Angeles County')))

const gov=assessPublicSourceSearchResult({
  jurisdiction:la,
  result:{
    title:'Los Angeles County Contract Opportunities and Solicitations',
    url:'https://doingbusiness.lacounty.gov/contract-opportunities/',
    snippet:'County procurement bids RFP RFQ vendor portal',
    provider:'web_search',
    observedAt:'2026-10-01T00:00:00Z',
  },
})
assert.equal(gov.status,'official_owner_verified')
assert.ok(gov.confidence>=0.9)

const uncorroborated=assessPublicSourceSearchResult({
  jurisdiction:la,
  result:{
    title:'Los Angeles County bids',
    url:'https://vendors.planetbids.com/portal/example',
    snippet:'Vendor portal solicitations',
    provider:'web_search',
    observedAt:'2026-10-01T00:00:00Z',
  },
})
assert.equal(isKnownProcurementPortal(uncorroborated.sourceUrl),true)
assert.equal(uncorroborated.status,'candidate')
assert.ok(uncorroborated.blockers.some(x=>/official jurisdiction page/i.test(x)))

const links=extractOfficialProcurementLinks({
  officialPageUrl:'https://dpw.lacounty.gov/contracts/',
  evidenceRef:'official-page:1',
  html:'<a href="https://vendors.planetbids.com/portal/example">View bid opportunities / vendor portal</a>',
})
assert.equal(links.length,1)

const corroborated=assessPublicSourceSearchResult({
  jurisdiction:la,
  result:{
    title:'Los Angeles County Public Works bid opportunities',
    url:'https://vendors.planetbids.com/portal/example',
    snippet:'Los Angeles County vendor portal solicitations',
    provider:'web_search',
    observedAt:'2026-10-01T00:00:00Z',
  },
  officialLinkEvidence:links[0],
})
assert.equal(corroborated.status,'official_portal_verified')
assert.equal(corroborated.officialLinkEvidence?.officialPageUrl,'https://dpw.lacounty.gov/contracts/')

const decision=decidePublicSourceDiscovery(la.id,[gov,uncorroborated,corroborated])
assert.equal(decision.status,'SOURCE_VERIFIED')
assert.equal(decision.verifiedSources.length,2)
assert.equal(decision.automaticAdapterActivationAuthorized,false)
assert.equal(decision.externalContactAuthorized,false)

console.log('public source discovery tests passed')
