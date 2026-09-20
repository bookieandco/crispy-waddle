import { adaptRemoteOkAiJob, isRemoteOkAiJob, parseRemoteOkFeed } from './remoteok.js'

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
}

const feed = parseRemoteOkFeed([
  { last_updated: 1789862431, legal: 'Please link back to Remote OK.' },
  {
    id: 'ai-1',
    date: '2026-09-19T00:00:00+00:00',
    company: 'Fixture AI Co',
    position: 'Senior AI Engineer',
    tags: ['ai', 'python'],
    description: '<p>Build <strong>LLM</strong> systems.</p>',
    location: 'Worldwide',
    salary_min: 120000,
    salary_max: 160000,
    url: 'https://remoteok.com/remote-jobs/fixture-ai-1',
    apply_url: 'https://remoteok.com/remote-jobs/fixture-ai-1',
  },
  {
    id: 'other-1',
    company: 'Fixture Co',
    position: 'Accountant',
    tags: ['finance'],
    url: 'https://remoteok.com/remote-jobs/fixture-other-1',
  },
])

assert(feed.jobs.length === 2, 'Remote OK parser must ignore the legal metadata row and retain job rows')
assert(feed.legal?.includes('Remote OK') === true, 'Remote OK feed terms metadata must survive parsing')
assert(isRemoteOkAiJob(feed.jobs[0]), 'AI title/tags must classify as AI job')
assert(!isRemoteOkAiJob(feed.jobs[1]), 'Non-AI title/tags must not be mislabeled as AI job')

const opportunity = adaptRemoteOkAiJob(feed.jobs[0], '2026-09-20T00:00:00Z')
assert(opportunity.id === 'employment:provider:remoteok:ai-1', 'Remote OK canonical id must be stable')
assert(opportunity.family === 'employment' && opportunity.type === 'job', 'Remote OK AI listing must normalize to employment/job')
assert(opportunity.status === 'discovered', 'Remote OK discovery must not skip research')
assert(opportunity.verificationStatus === 'unverified', 'Remote OK listing must not manufacture employer verification')
assert(opportunity.sourceName === 'Remote OK', 'Attribution source must be Remote OK')
assert(opportunity.sourceUrl.startsWith('https://remoteok.com/'), 'Opportunity must link back to Remote OK')
assert(opportunity.metadata?.employerName === 'Fixture AI Co', 'Employer name must survive normalization')
assert(opportunity.metadata?.placementHandoffOwner === 'Placement Core', 'Placement must remain the execution handoff owner')
assert(opportunity.metadata?.autoApplyAuthorized === false, 'Discovery must never authorize automatic job application')
assert(opportunity.riskFlags.includes('secondary_job_board_source'), 'Secondary job-board provenance must remain explicit')
assert(opportunity.amount?.min === 120000 && opportunity.amount?.max === 160000, 'Feed salary range must survive when supplied')

let crossHostBlocked = false
try {
  adaptRemoteOkAiJob({ ...feed.jobs[0], url: 'https://example.com/job/1', applyUrl: undefined })
} catch {
  crossHostBlocked = true
}
assert(crossHostBlocked, 'Remote OK adapter must enforce source link-back')
