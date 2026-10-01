import assert from 'node:assert/strict'
import {
  assessPublicComplianceSearchResult,
  buildPublicComplianceDiscoveryQueries,
  complianceTopicCoverage,
} from './public-compliance-source-discovery.js'

const queries=buildPublicComplianceDiscoveryQueries('TX')
assert.equal(queries.length,3)
assert.ok(queries.every(query=>query.includes('Texas')))

const license=assessPublicComplianceSearchResult({
  state:'TX',
  result:{
    title:'Texas Department of Licensing contractor license',
    url:'https://www.tdlr.texas.gov/example',
    snippet:'Texas contractor license requirements for public work',
    provider:'web_search',
    observedAt:'2026-10-01T00:00:00Z',
  },
})
assert.equal(license.officialSourceVerified,true)
assert.ok(license.topics.includes('contractor_license'))

const wage=assessPublicComplianceSearchResult({
  state:'TX',
  result:{
    title:'Texas public works prevailing wage',
    url:'https://example.texas.gov/public-works',
    snippet:'Texas prevailing wage certified payroll apprenticeship',
    provider:'exa',
    observedAt:'2026-10-01T00:00:00Z',
  },
})
assert.equal(wage.officialSourceVerified,true)
assert.ok(wage.topics.includes('prevailing_wage'))
assert.ok(wage.topics.includes('certified_payroll'))
assert.ok(wage.topics.includes('apprenticeship'))

const thirdParty=assessPublicComplianceSearchResult({
  state:'TX',
  result:{
    title:'Texas contractor compliance guide',
    url:'https://example.com/texas-public-works',
    snippet:'Texas prevailing wage contractor licensing',
    provider:'web_search',
    observedAt:'2026-10-01T00:00:00Z',
  },
})
assert.equal(thirdParty.officialSourceVerified,false)
assert.ok(thirdParty.blockers.some(value=>/government domain/i.test(value)))

const coverage=complianceTopicCoverage([license,wage,thirdParty])
assert.equal(coverage.verifiedSourceCount,2)
assert.ok(coverage.coveredTopics.includes('contractor_license'))
assert.equal(coverage.packAutoVerificationAuthorized,false)

console.log('public compliance source discovery tests passed')
