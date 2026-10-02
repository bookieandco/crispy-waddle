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
assert.equal(queries.length,4)
assert.ok(queries.every(q=>q.includes('Los Angeles County')))

const hospital:PublicJurisdictionDescriptor={
  id:'public_hospital:ca:example',
  level:'public_hospital',
  name:'Example County Medical Center',
  state:'CA',
}
const hospitalQueries=buildPublicSourceDiscoveryQueries(hospital)
assert.ok(hospitalQueries.every(q=>q.includes('public hospital')))
assert.ok(hospitalQueries.some(q=>q.includes('awards awarded contracts')))

const university:PublicJurisdictionDescriptor={
  id:'public_university:ca:example',
  level:'public_university',
  name:'Example State University',
  state:'CA',
  officialDomainHints:['example.edu'],
}
assert.ok(buildPublicSourceDiscoveryQueries(university).every(q=>q.includes('public university')))

const verifiedEdu=assessPublicSourceSearchResult({
  jurisdiction:university,
  result:{
    title:'Example State University procurement awards',
    url:'https://procurement.example.edu/awards',
    snippet:'Example State University procurement awards awarded contracts vendor portal',
    provider:'web_search',
    observedAt:'2026-10-01T00:00:00Z',
  },
})
assert.equal(verifiedEdu.status,'official_owner_verified')

const unverifiedEdu=assessPublicSourceSearchResult({
  jurisdiction:{...university,officialDomainHints:[]},
  result:{
    title:'Example State University procurement awards',
    url:'https://procurement.example.edu/awards',
    snippet:'Example State University procurement awards awarded contracts vendor portal',
    provider:'web_search',
    observedAt:'2026-10-01T00:00:00Z',
  },
})
assert.equal(unverifiedEdu.status,'candidate')

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

const procurementAward=assessPublicSourceSearchResult({
  jurisdiction:la,
  result:{
    title:'Los Angeles County Purchasing Award Recommendations',
    url:'https://doingbusiness.lacounty.gov/purchasing/award-recommendations',
    snippet:'Procurement contract award recommendations and successful bidders',
    provider:'web_search',
    observedAt:'2026-10-01T00:00:00Z',
  },
})
assert.ok(procurementAward.sourceKinds.includes('award'))
assert.ok(procurementAward.procurementSignals.length>0)

const ceremonialAward=assessPublicSourceSearchResult({
  jurisdiction:{
    id:'city:example',
    level:'city',
    name:'Example City',
    state:'CA',
  },
  result:{
    title:'Example City Employee Service Awards Banquet',
    url:'https://example.gov/news/service-awards',
    snippet:'The city honored employees for years of service.',
    provider:'web_search',
    observedAt:'2026-10-01T00:00:00Z',
  },
})
assert.equal(ceremonialAward.procurementSignals.length,0)
assert.ok(!ceremonialAward.sourceKinds.includes('award'))

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
