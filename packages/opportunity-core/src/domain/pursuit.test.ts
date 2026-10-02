import { approveOpportunityForResearch, isPursuitReady, markOpportunityReady, updatePursuitTask } from './pursuit.js'
import { adaptEmploymentOpportunity } from '../adapters/employment.js'
import { adaptOverageOpportunity } from '../adapters/overage.js'
import { buildSideHustleDiscoveryProvenance, buildSideHustleProfile } from './side-hustles.js'
import type { Opportunity } from './opportunity.js'

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


const partnerOpportunity = {
  ...employment,
  metadata: { ...employment.metadata, capabilityGap: true },
}
const partnerResearch = approveOpportunityForResearch(partnerOpportunity, '2026-09-19T04:00:00Z')
assert(partnerResearch.pursuitCase.tasks.some((task) => task.kind === 'find_partner'), 'Capability gaps must create partner research without authorizing outreach')


let blankResearchEvidenceBlocked = false
try {
  updatePursuitTask(approved.pursuitCase, approved.pursuitCase.tasks[0].id, {
    status: 'completed',
    evidenceRefs: ['   '],
  }, '2026-09-19T05:00:00Z')
} catch {
  blankResearchEvidenceBlocked = true
}
assert(blankResearchEvidenceBlocked, 'Blank research evidence must not complete a required task')


const immutableCaseStart = updatePursuitTask(
  approved.pursuitCase,
  approved.pursuitCase.tasks[0].id,
  { status: 'completed', evidenceRefs: ['evidence:original'] },
  '2026-09-19T05:00:00Z',
)
let completedEvidenceRewriteBlocked = false
try {
  updatePursuitTask(
    immutableCaseStart,
    approved.pursuitCase.tasks[0].id,
    { status: 'completed', evidenceRefs: ['evidence:replacement'] },
    '2026-09-19T06:00:00Z',
  )
} catch {
  completedEvidenceRewriteBlocked = true
}
assert(completedEvidenceRewriteBlocked, 'Completed research evidence must be immutable')


const ventureDiscovery = buildSideHustleDiscoveryProvenance({
  candidateId: 'venture-candidate:software-test',
  recommendation: 'research',
  signalIds: ['signal:a', 'signal:b', 'signal:c'],
  sourceRefs: ['https://a.example', 'https://b.example', 'https://c.example'],
  evidenceScore: 84,
})

const ventureOpportunity: Opportunity = {
  id: 'opportunity:venture-candidate:software-test',
  title: 'Evidence-backed software side hustle',
  family: 'business',
  type: 'commercial',
  sourceUrl: 'https://a.example',
  sourceName: 'Jhadina Venture Discovery',
  claims: [],
  evidence: [],
  verificationStatus: 'unverified',
  sourceConfidence: 0.84,
  fitScore: 84,
  riskFlags: ['requires_make_it_make_sense', 'requires_originality_gate', 'requires_bounded_validation'],
  metadata: {
    sideHustleProfile: buildSideHustleProfile({ family: 'software_apps' }),
    sideHustleDiscovery: ventureDiscovery,
    opportunityAuthority: 'OPPORTUNITY_ONLY',
  },
  status: 'discovered',
  createdAt: '2026-10-01T20:00:00.000Z',
  updatedAt: '2026-10-01T20:00:00.000Z',
}

const ventureResearch = approveOpportunityForResearch(
  ventureOpportunity,
  '2026-10-01T20:05:00.000Z',
)
assert(
  ventureResearch.pursuitCase.tasks.some((task) => task.kind === 'assess_demand_thesis'),
  'Venture Lab research must assess the demand thesis',
)
assert(
  ventureResearch.pursuitCase.tasks.some((task) => task.kind === 'assess_make_it_make_sense'),
  'Venture Lab research must run MAKE IT MAKE SENSE',
)
assert(
  ventureResearch.pursuitCase.tasks.some((task) => task.kind === 'assess_originality_ip'),
  'Venture Lab research must assess originality/IP before validation',
)
const researchDiscovery = ventureResearch.opportunity.metadata?.sideHustleDiscovery as { stage?: string }
const researchIntake = ventureResearch.opportunity.metadata?.ventureLabResearchIntake as {
  researchCaseId?: string
  authority?: string
  externalActionAuthorized?: boolean
  automaticExperimentAuthorized?: boolean
  moneyMovementAuthorized?: boolean
}
assert(researchDiscovery.stage === 'researching', 'Approved Venture Side Hustle must enter researching stage')
assert(researchIntake.researchCaseId === ventureResearch.pursuitCase.id, 'Venture intake must bind the canonical research case')
assert(researchIntake.authority === 'RESEARCH_ONLY', 'Venture research intake must remain research-only')
assert(researchIntake.externalActionAuthorized === false, 'Venture research must not authorize external actions')
assert(researchIntake.automaticExperimentAuthorized === false, 'Research approval must not auto-authorize an experiment')
assert(researchIntake.moneyMovementAuthorized === false, 'Research approval must not authorize money movement')

let heldVentureBlocked = false
try {
  approveOpportunityForResearch({
    ...ventureOpportunity,
    id: 'opportunity:venture-candidate:held',
    metadata: {
      ...ventureOpportunity.metadata,
      sideHustleDiscovery: { ...ventureDiscovery, candidateId: 'venture-candidate:held', recommendation: 'hold' },
    },
  }, '2026-10-01T20:10:00.000Z')
} catch {
  heldVentureBlocked = true
}
assert(heldVentureBlocked, 'Held Venture candidates must not enter research through approval')
