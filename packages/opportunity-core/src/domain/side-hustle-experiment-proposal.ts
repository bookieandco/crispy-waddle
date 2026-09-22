import type { Opportunity } from './opportunity.js'
import { getSideHustleDefinition, isSideHustleProfile, type SideHustleFamily } from './side-hustles.js'
import type { SideHustleExperimentCriterion } from './side-hustle-experiment.js'

export type SideHustleValidationArchetype =
  | 'service_demand'
  | 'product_preorder'
  | 'audience_monetization'
  | 'affiliate_conversion'
  | 'software_commitment'
  | 'asset_booking'
  | 'procurement_fit'

export type SideHustleExperimentProposal = {
  opportunityId: string
  family: SideHustleFamily
  familyLabel: string
  archetype: SideHustleValidationArchetype
  hypothesis: string
  targetCustomer: string
  channel: string
  offer: string
  maxSpend: number
  currency: string
  maxHours: number
  maxDurationDays: number
  minimumObservations: number
  successCriteria: SideHustleExperimentCriterion[]
  killCriteria: SideHustleExperimentCriterion[]
  evidenceRefs: string[]
  assumptions: string[]
  requiresReview: true
  generatedAt: string
}

type ArchetypeTemplate = Omit<
  SideHustleExperimentProposal,
  'opportunityId' | 'family' | 'familyLabel' | 'targetCustomer' | 'offer' | 'evidenceRefs' | 'generatedAt'
>

const FAMILY_ARCHETYPE: Record<Exclude<SideHustleFamily, 'trading_investing_intelligence'>, SideHustleValidationArchetype> = {
  ai_business_implementation: 'service_demand',
  business_automation: 'service_demand',
  business_systems: 'service_demand',
  lead_generation_growth: 'service_demand',
  ai_discovery_seo: 'service_demand',
  content_social: 'service_demand',
  creative_advertising: 'service_demand',
  media_production: 'service_demand',
  owned_media: 'audience_monetization',
  creator_monetization: 'audience_monetization',
  digital_products: 'product_preorder',
  software_apps: 'software_commitment',
  communities: 'audience_monetization',
  pod_personalized_commerce: 'product_preorder',
  commerce_affiliate: 'affiliate_conversion',
  dropshipping_product_commerce: 'product_preorder',
  drop_servicing: 'service_demand',
  directories_marketplaces: 'product_preorder',
  physical_asset_businesses: 'asset_booking',
  boring_business_services: 'service_demand',
  research_services: 'service_demand',
  procurement_subcontracting: 'procurement_fit',
  website_revenue_systems: 'service_demand',
  human_premium_services: 'service_demand',
  pr_authority: 'service_demand',
}

const TEMPLATES: Record<SideHustleValidationArchetype, ArchetypeTemplate> = {
  service_demand: {
    archetype: 'service_demand',
    hypothesis: 'A narrowly defined buyer segment will show concrete willingness to pay for this outcome before the service is fully automated.',
    channel: 'Permissioned outreach, warm introductions, or an owned audience where responses can be measured.',
    maxSpend: 100,
    currency: 'USD',
    maxHours: 8,
    maxDurationDays: 14,
    minimumObservations: 5,
    successCriteria: [
      criterion('qualified_conversations', 'qualified_conversations', 'gte', 3, 'sum', 'conversations'),
      criterion('paid_commitments', 'paid_commitments', 'gte', 1, 'sum', 'customers'),
    ],
    killCriteria: [
      criterion('serious_fit_blockers', 'serious_fit_blockers', 'gte', 3, 'sum', 'blockers'),
    ],
    assumptions: [
      'The first test should validate buyer pain and willingness to pay before deep automation.',
      'Qualified conversations count only prospects matching the intended buyer profile.',
      'A paid commitment can be a paid pilot, deposit, or completed purchase; verbal interest alone does not count.',
    ],
    requiresReview: true,
  },
  product_preorder: {
    archetype: 'product_preorder',
    hypothesis: 'A focused buyer segment will convert on a small, clearly presented offer before inventory or production scale is increased.',
    channel: 'A bounded landing-page, marketplace, or owned-audience test with attributable traffic.',
    maxSpend: 100,
    currency: 'USD',
    maxHours: 8,
    maxDurationDays: 14,
    minimumObservations: 50,
    successCriteria: [
      criterion('qualified_visitors', 'qualified_visitors', 'gte', 50, 'sum', 'visitors'),
      criterion('paid_orders', 'paid_orders', 'gte', 1, 'sum', 'orders'),
    ],
    killCriteria: [
      criterion('refund_rate', 'refund_rate', 'gte', 0.5, 'max', 'ratio'),
    ],
    assumptions: [
      'The experiment validates demand before inventory, catalog, or creative scale.',
      'Qualified visitors exclude obvious bots and irrelevant traffic.',
      'A paid order is stronger evidence than clicks, likes, saves, or survey intent.',
    ],
    requiresReview: true,
  },
  audience_monetization: {
    archetype: 'audience_monetization',
    hypothesis: 'A specific audience will repeatedly opt in and produce at least one attributable monetization event.',
    channel: 'One owned or permissioned distribution channel with source attribution.',
    maxSpend: 75,
    currency: 'USD',
    maxHours: 8,
    maxDurationDays: 14,
    minimumObservations: 10,
    successCriteria: [
      criterion('qualified_subscribers', 'qualified_subscribers', 'gte', 10, 'sum', 'subscribers'),
      criterion('monetization_events', 'monetization_events', 'gte', 1, 'sum', 'events'),
    ],
    killCriteria: [
      criterion('unsubscribe_rate', 'unsubscribe_rate', 'gte', 0.25, 'max', 'ratio'),
    ],
    assumptions: [
      'Audience size alone is not proof of a business; the test requires attributable monetization evidence.',
      'Qualified subscribers intentionally opted in and match the target audience.',
      'Monetization events can be paid subscriptions, sponsorship commitments, affiliate conversions, or product purchases.',
    ],
    requiresReview: true,
  },
  affiliate_conversion: {
    archetype: 'affiliate_conversion',
    hypothesis: 'Existing relevant attention can produce attributable conversions without relying on misleading claims or artificial traffic.',
    channel: 'Owned content or a permissioned audience with compliant affiliate disclosure and attribution.',
    maxSpend: 50,
    currency: 'USD',
    maxHours: 6,
    maxDurationDays: 14,
    minimumObservations: 25,
    successCriteria: [
      criterion('qualified_clicks', 'qualified_clicks', 'gte', 25, 'sum', 'clicks'),
      criterion('attributed_conversions', 'attributed_conversions', 'gte', 1, 'sum', 'conversions'),
    ],
    killCriteria: [
      criterion('policy_or_disclosure_violations', 'policy_or_disclosure_violations', 'gte', 1, 'sum', 'violations'),
    ],
    assumptions: [
      'Traffic must already be relevant to the offer; bought or deceptive traffic does not count.',
      'The experiment uses explicit affiliate disclosure and platform-compliant promotion.',
      'Attributed conversions, not clicks alone, are the business evidence.',
    ],
    requiresReview: true,
  },
  software_commitment: {
    archetype: 'software_commitment',
    hypothesis: 'Users with a repeated workflow problem will validate the problem and at least one will make a concrete paid commitment before a full product is built.',
    channel: 'Direct user interviews plus a lightweight demo, prototype, or concierge workflow.',
    maxSpend: 100,
    currency: 'USD',
    maxHours: 12,
    maxDurationDays: 21,
    minimumObservations: 5,
    successCriteria: [
      criterion('problem_interviews', 'problem_interviews', 'gte', 5, 'sum', 'interviews'),
      criterion('paid_commitments', 'paid_commitments', 'gte', 1, 'sum', 'customers'),
    ],
    killCriteria: [
      criterion('critical_workflow_blockers', 'critical_workflow_blockers', 'gte', 3, 'sum', 'blockers'),
    ],
    assumptions: [
      'The first test proves the workflow problem before implementing a large application.',
      'A prototype may be manual or concierge-style if that is enough to demonstrate the outcome.',
      'Paid commitments are stronger evidence than feature requests or compliments.',
    ],
    requiresReview: true,
  },
  asset_booking: {
    archetype: 'asset_booking',
    hypothesis: 'Local or niche demand will produce qualified inquiries and at least one paid booking before capital is committed to additional assets.',
    channel: 'A bounded local listing, waitlist, or direct demand test using a real service area.',
    maxSpend: 100,
    currency: 'USD',
    maxHours: 8,
    maxDurationDays: 21,
    minimumObservations: 5,
    successCriteria: [
      criterion('qualified_inquiries', 'qualified_inquiries', 'gte', 3, 'sum', 'inquiries'),
      criterion('paid_bookings', 'paid_bookings', 'gte', 1, 'sum', 'bookings'),
    ],
    killCriteria: [
      criterion('safety_or_compliance_blockers', 'safety_or_compliance_blockers', 'gte', 1, 'sum', 'blockers'),
    ],
    assumptions: [
      'The first test should avoid buying or leasing additional assets before demand is demonstrated.',
      'Safety, permitting, insurance, and location constraints are hard blockers, not optimization details.',
      'A booking or deposit is stronger evidence than general local interest.',
    ],
    requiresReview: true,
  },
  procurement_fit: {
    archetype: 'procurement_fit',
    hypothesis: 'The target procurement lane contains real solicitations that are both commercially attractive and fulfillable by qualified providers.',
    channel: 'Official procurement sources plus verified provider research; no bid submission is part of the validation experiment.',
    maxSpend: 50,
    currency: 'USD',
    maxHours: 10,
    maxDurationDays: 14,
    minimumObservations: 3,
    successCriteria: [
      criterion('qualified_opportunities', 'qualified_opportunities', 'gte', 3, 'sum', 'opportunities'),
      criterion('fulfillable_matches', 'fulfillable_matches', 'gte', 1, 'sum', 'matches'),
    ],
    killCriteria: [
      criterion('compliance_blockers', 'compliance_blockers', 'gte', 1, 'sum', 'blockers'),
    ],
    assumptions: [
      'Discovery and provider matching can be validated without submitting a bid.',
      'A fulfillable match requires evidence that a provider can meet the relevant scope, geography, timing, and compliance requirements.',
      'Bid submission remains a separate governed action even after the experiment succeeds.',
    ],
    requiresReview: true,
  },
}

export function proposeSideHustleExperiment(input: {
  opportunity: Opportunity
  evidenceRefs?: string[]
  targetCustomer?: string
  offer?: string
  currency?: string
  maxSpend?: number
  maxHours?: number
  maxDurationDays?: number
  generatedAt?: string
}): SideHustleExperimentProposal {
  const profile = input.opportunity.metadata?.sideHustleProfile
  if (!isSideHustleProfile(profile)) {
    throw new Error('Experiment proposal requires a canonical sideHustleProfile')
  }
  if (profile.role === 'capability' || profile.family === 'trading_investing_intelligence') {
    throw new Error('Capability-only side hustle profiles do not receive standalone business experiments')
  }

  const archetype = FAMILY_ARCHETYPE[profile.family]
  const template = TEMPLATES[archetype]
  const familyLabel = getSideHustleDefinition(profile.family).label
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('generatedAt must be a valid date')

  const evidenceRefs = unique(
    input.evidenceRefs?.length
      ? input.evidenceRefs
      : input.opportunity.evidence.map((evidence) => evidence.id),
  )
  if (evidenceRefs.length === 0) throw new Error('Experiment proposal requires at least one evidence reference')

  const targetCustomer = input.targetCustomer?.trim() ||
    `Buyer with a concrete need matching ${familyLabel.toLowerCase()}`
  const offer = input.offer?.trim() ||
    input.opportunity.description?.trim() ||
    input.opportunity.title.trim()

  const proposal: SideHustleExperimentProposal = {
    opportunityId: input.opportunity.id,
    family: profile.family,
    familyLabel,
    archetype,
    hypothesis: template.hypothesis,
    targetCustomer,
    channel: template.channel,
    offer,
    maxSpend: boundedOverride(input.maxSpend, template.maxSpend, 0, 500),
    currency: (input.currency?.trim() || template.currency).toUpperCase(),
    maxHours: boundedOverride(input.maxHours, template.maxHours, 1, 40),
    maxDurationDays: integerOverride(input.maxDurationDays, template.maxDurationDays, 1, 45),
    minimumObservations: template.minimumObservations,
    successCriteria: cloneCriteria(template.successCriteria),
    killCriteria: cloneCriteria(template.killCriteria),
    evidenceRefs,
    assumptions: [
      ...template.assumptions,
      'This is a conservative default proposal, not a prediction of demand or profit.',
      'Review and edit the buyer, offer, limits, and criteria before starting validation.',
    ],
    requiresReview: true,
    generatedAt,
  }

  return proposal
}

function criterion(
  id: string,
  metric: string,
  operator: SideHustleExperimentCriterion['operator'],
  threshold: number,
  aggregation: SideHustleExperimentCriterion['aggregation'],
  unit: string,
): SideHustleExperimentCriterion {
  return { id, metric, operator, threshold, aggregation, unit }
}

function cloneCriteria(criteria: SideHustleExperimentCriterion[]): SideHustleExperimentCriterion[] {
  return criteria.map((criterion) => ({ ...criterion }))
}

function boundedOverride(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Experiment proposal override must be between ${min} and ${max}`)
  }
  return Math.round(value * 100) / 100
}

function integerOverride(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Experiment proposal integer override must be between ${min} and ${max}`)
  }
  return value
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
