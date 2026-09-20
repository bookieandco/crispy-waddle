import { approveOpportunityForResearch, isPursuitReady, markOpportunityReady, updatePursuitTask } from './pursuit.js'
import { adaptEmploymentOpportunity } from '../adapters/employment.js'
import { adaptOverageOpportunity } from '../adapters/overage.js'

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
}

const employment = adaptEmploymentOpportunity({
  providerId: 'provider:placement-jobs',
  externalId: 'job-1',
  title: 'AI contractor',
  sourceUrl: 'https://example.test/jobs/1',
  sourceName: 'Fixture jobs',
})
const approved = approveOpportunityForResearch(employment, '2026-09-19T00:00:00Z')
assert(approved.opportunity.status === 'research_pending', 'Approval must authorize research, not external execution')
assert(approved.pursuitCase.tasks.some((task) => task.kind === 'verify_employer'), 'Employment research must verify employer')
assert(approved.pursuitCase.tasks.some((task) => task.kind === 'assess_capability'), 'Employment research must assess capability')

const recovery = approveOpportunityForResearch(adaptOverageOpportunity({
  id: 'case-1',
  title: 'Recovery fixture',
  sourceUrl: 'https://example.gov/recovery/1',
}), '2026-09-19T00:00:00Z')
assert(recovery.pursuitCase.tasks.some((task) => task.kind === 'verify_identity'), 'Recovery research must verify identity')
assert(recovery.pursuitCase.tasks.some((task) => task.kind === 'verify_entitlement'), 'Recovery research must verify entitlement')

let readyCase = recovery.pursuitCase
for (const task of readyCase.tasks) {
  readyCase = updatePursuitTask(readyCase, task.id, { status: 'completed', evidenceRefs: [`evidence:${task.id}`] }, '2026-09-19T01:00:00Z')
}
assert(isPursuitReady(readyCase), 'All required tasks need evidence before pursuit is ready')


let employmentReadyCase = approved.pursuitCase
for (const task of employmentReadyCase.tasks) {
  employmentReadyCase = updatePursuitTask(employmentReadyCase, task.id, {
    status: 'completed',
    evidenceRefs: [`evidence:${task.id}`],
  }, '2026-09-19T02:00:00Z')
}
const employmentReady = markOpportunityReady(approved.opportunity, employmentReadyCase, '2026-09-19T03:00:00Z')
assert(employmentReady.status === 'ready', 'Employment opportunity must become ready after evidence-complete research')

let recoveryBlocked = false
try {
  markOpportunityReady(recovery.opportunity, readyCase, '2026-09-19T03:00:00Z')
} catch {
  recoveryBlocked = true
}
assert(recoveryBlocked, 'Recovery opportunity must remain blocked without complete claimant/entitlement verification')
