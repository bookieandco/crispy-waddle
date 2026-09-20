import assert from 'node:assert/strict'
import { adaptSamOpportunity } from '../adapters/sam.js'
import { decomposeOpportunityRequirements, hasUnresolvedRequiredRequirements } from './opportunity-requirement.js'

const opportunity = adaptSamOpportunity({
  noticeId: 'notice-1',
  title: 'Cloud security engineering services',
  solicitationNumber: 'ABC-1',
  noticeType: 'SOLICITATION',
  naicsCode: '541512',
  setAside: 'Small Business',
  responseDeadline: '2026-10-20T17:00:00Z',
  estimatedValue: 500000,
  placeOfPerformance: 'California',
  description: 'Provide cloud security engineering. Contractor must maintain required security clearance, insurance, and relevant past performance.',
  sourceUrl: 'https://sam.gov/example',
  fetchedAt: '2026-09-20T00:00:00Z',
})
const set = decomposeOpportunityRequirements(opportunity, '2026-09-20T01:00:00Z')
assert.equal(set.opportunityId, 'sam:notice-1')
assert.ok(set.requirements.some((r) => r.kind === 'naics' && r.naicsCodes.includes('541512')))
assert.ok(set.requirements.some((r) => r.kind === 'socioeconomic' && r.severity === 'required'))
assert.ok(set.requirements.some((r) => r.kind === 'geography'))
assert.ok(set.requirements.some((r) => r.kind === 'schedule'))
assert.ok(set.requirements.some((r) => r.kind === 'capacity'))
assert.ok(set.requirements.some((r) => r.kind === 'capability'))
assert.ok(set.requirements.some((r) => r.kind === 'security'))
assert.ok(set.requirements.some((r) => r.kind === 'credential'))
assert.ok(set.requirements.some((r) => r.kind === 'past_performance'))
assert.equal(hasUnresolvedRequiredRequirements(set), true)

const thin = adaptSamOpportunity({ noticeId: 'notice-2', title: 'Services', sourceUrl: 'https://sam.gov/thin', fetchedAt: '2026-09-20T00:00:00Z' })
const thinSet = decomposeOpportunityRequirements(thin, '2026-09-20T01:00:00Z')
assert.ok(thinSet.unresolved.includes('NAICS code is not available.'))
assert.ok(thinSet.unresolved.includes('Place of performance is not available.'))
assert.ok(thinSet.unresolved.includes('Response deadline is not available.'))
assert.equal(hasUnresolvedRequiredRequirements(thinSet), true)

console.log('opportunity-requirement tests passed')
