import { adaptCommercialOpportunity } from '../adapters/commercial.js'
import { createOpportunityActionIntent } from './action.js'
import { validateCommercialDealContract, qualifyProviderMatch } from './brokerage.js'
import { applyOpportunityIntelligence, buildOpportunityMatch, scoreOpportunity } from './intelligence.js'
import { approveOpportunityForResearch, markOpportunityReady, updatePursuitTask } from './pursuit.js'
import { classifyOpportunityHubCategory, validateExperimentPlan } from './taxonomy.js'

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
}

const opportunity = adaptCommercialOpportunity({
  providerId: 'provider:commerce-dropshipping',
  externalId: 'supplier-1',
  kind: 'dropshipping',
  title: 'Supplier fixture',
  sourceUrl: 'https://example.test/supplier',
  sourceName: 'Fixture',
})

assert(classifyOpportunityHubCategory(opportunity) === 'products', 'Dropshipping must project into Products')

const score = scoreOpportunity({
  fit: 80,
  economics: 70,
  evidence: 60,
  timing: 50,
  execution: 75,
  risk: 20,
  learning: 65,
})
const match = buildOpportunityMatch({
  opportunity,
  requiredCapabilities: ['catalog', 'fulfillment'],
  availableCapabilities: ['catalog', 'fulfillment'],
  evidenceRefs: ['evidence:capabilities'],
})
const intelligent = applyOpportunityIntelligence(opportunity, score, match)
assert(intelligent.opportunityScore === score.overall, 'Deterministic score must be applied to canonical opportunity')
assert(intelligent.metadata?.eligible === true, 'Deterministic match must preserve eligibility')

const qualified = qualifyProviderMatch({
  id: 'provider-match:1',
  opportunityId: opportunity.id,
  providerId: 'provider:1',
  role: 'specialist_vendor',
  score: 90,
  matchedCapabilities: ['catalog', 'fulfillment'],
  capabilityGaps: [],
  complianceFlags: [],
  evidenceRefs: ['evidence:provider'],
  status: 'candidate',
  assessedAt: '2026-09-19T00:00:00Z',
})
assert(qualified.status === 'qualified', 'Provider match must qualify only without gaps/compliance flags')

validateCommercialDealContract({
  id: 'deal:1',
  opportunityId: opportunity.id,
  providerId: 'provider:1',
  role: 'specialist_vendor',
  structure: 'subcontract_margin',
  currency: 'USD',
  basis: 'Fulfilled customer order',
  trigger: 'Provider fulfillment accepted',
  subcontractCost: 20,
  complianceRequirements: ['Provider terms verified'],
  evidenceRefs: ['evidence:deal'],
  status: 'review_ready',
  requiresHumanApproval: true,
  createdAt: '2026-09-19T00:00:00Z',
})

validateExperimentPlan({
  opportunityId: opportunity.id,
  disposition: 'TEST',
  evidenceRefs: ['evidence:test'],
  assumptions: ['Supplier can meet target unit economics'],
  downside: ['Test spend may not convert'],
  budgetCap: 100,
  currency: 'USD',
  timeCapHours: 8,
  measurement: {
    primaryMetric: 'contribution margin',
    successThreshold: 'positive contribution margin after fees',
    stopConditions: ['budget cap reached', 'supplier verification fails'],
  },
})

const research = approveOpportunityForResearch(intelligent, '2026-09-19T00:00:00Z')
let researchCase = research.pursuitCase
for (const task of researchCase.tasks) {
  researchCase = updatePursuitTask(researchCase, task.id, {
    status: 'completed',
    evidenceRefs: [`evidence:${task.id}`],
  }, '2026-09-19T01:00:00Z')
}
const ready = markOpportunityReady(research.opportunity, researchCase, '2026-09-19T02:00:00Z')
const intent = createOpportunityActionIntent({
  opportunity: ready,
  pursuitCase: researchCase,
  executionOwner: 'commerce',
  capability: 'commerce.listing.propose',
  evidenceRefs: ['evidence:research-complete'],
  createdAt: '2026-09-19T02:00:00Z',
  expiresAt: '2026-09-20T02:00:00Z',
})
assert(intent.requiresPolicy && intent.requiresApproval, 'Opportunity action handoff must preserve governance gates')


let blankMatchEvidenceBlocked = false
try {
  buildOpportunityMatch({
    opportunity,
    requiredCapabilities: ['catalog'],
    availableCapabilities: ['catalog'],
    evidenceRefs: [''],
  })
} catch {
  blankMatchEvidenceBlocked = true
}
assert(blankMatchEvidenceBlocked, 'Blank match evidence must be rejected')

let blankActionEvidenceBlocked = false
try {
  createOpportunityActionIntent({
    opportunity: ready,
    pursuitCase: researchCase,
    executionOwner: 'commerce',
    capability: 'commerce.listing.propose',
    evidenceRefs: ['   '],
    createdAt: '2026-09-19T02:00:00Z',
    expiresAt: '2026-09-20T02:00:00Z',
  })
} catch {
  blankActionEvidenceBlocked = true
}
assert(blankActionEvidenceBlocked, 'Blank action handoff evidence must be rejected')
