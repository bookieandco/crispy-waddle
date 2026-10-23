import assert from 'node:assert/strict'
import {NATIONAL_PROCUREMENT_GAP_SOURCES,US_TERRITORY_CODES,assessExpansionIdentity,classifyProcurementPortal} from './national-procurement-expansion.js'
assert.deepEqual(US_TERRITORY_CODES,['PR','GU','VI','AS','MP'])
assert.equal(NATIONAL_PROCUREMENT_GAP_SOURCES.length,4)
assert.equal(NATIONAL_PROCUREMENT_GAP_SOURCES.find(x=>x.family==='tribal_government')?.expectedEntities,575)
assert.ok(NATIONAL_PROCUREMENT_GAP_SOURCES.every(x=>x.bidFeedVerified===false&&!x.externalContactAuthorized))
const tribal=assessExpansionIdentity({canonicalId:'tribe:sample',family:'tribal_government',
 name:'Sample Federally Recognized Tribe',officialRecordId:'demo-only',
 officialCatalogUrl:'https://www.bia.gov/service/tribal-leaders-directory',
 authorityConfirmed:true,bidPortalOfficiallyLinked:false})
assert.equal(tribal.governmentIdentityVerified,true)
assert.equal(tribal.officialBuyerPortalObserved,false)
assert.ok(tribal.blockers.some(x=>x.includes('authorized solicitation')))
const terr=assessExpansionIdentity({canonicalId:'territory:PR',family:'territorial_government',
 name:'Puerto Rico',officialRecordId:'PR',territoryCode:'PR',
 officialCatalogUrl:'https://www.usa.gov/state-governments',
 authorityConfirmed:true,bidPortalUrl:'https://some-portal.example.gov',bidPortalOfficiallyLinked:true})
assert.equal(terr.governmentIdentityVerified,true)
assert.equal(terr.bidFeedCertified,false)
const wrong=classifyProcurementPortal({sourceUrl:'https://evilplanetbids.com/claim',
 officialBuyerLink:'https://example.gov/bids',officialBuyerVerified:false,loginRequired:false,
 robotsAccessApproved:false,reliableBidIds:false,closedBidDetection:false})
assert.equal(wrong.family,'unknown')
assert.equal(wrong.status,'review_required')
assert.equal(wrong.externalFetchAuthorized,false)
const allowed=classifyProcurementPortal({sourceUrl:'https://city.planetbids.com/portal',
 officialBuyerLink:'https://www.city.gov/bids',officialBuyerVerified:true,loginRequired:false,
 robotsAccessApproved:true,reliableBidIds:true,closedBidDetection:true})
assert.equal(allowed.family,'planetbids')
assert.equal(allowed.status,'parser_pilot_candidate')
assert.equal(allowed.certification,'not_certified')
const login=classifyProcurementPortal({...{sourceUrl:'https://city.ionwave.net',officialBuyerLink:'https://city.gov',
 officialBuyerVerified:true,loginRequired:true,robotsAccessApproved:true,reliableBidIds:true,closedBidDetection:true}})
assert.ok(login.blockers.some(x=>x.includes('login')))
assert.equal(login.automatedLoginAuthorized,false)
console.log('PROCURE.NATIONAL.FULL: missing government families and portal access gates PASS')
