import type {
  CommercialWorkOrderAcceptanceCriterion,
  CommercialWorkOrderPriceCadence,
  CommercialWorkOrderScopeItem,
} from './side-hustle-commercial.js'
import {
  isSideHustleProfile,
  type SideHustleFamily,
} from './side-hustles.js'
import type { Opportunity } from './opportunity.js'

export const SIDE_HUSTLE_SERVICE_TEMPLATE_FAMILIES = [
  'ai_business_implementation',
  'business_automation',
  'business_systems',
  'lead_generation_growth',
  'ai_discovery_seo',
  'content_social',
  'creative_advertising',
  'media_production',
  'creator_monetization',
  'drop_servicing',
  'boring_business_services',
  'research_services',
  'procurement_subcontracting',
  'website_revenue_systems',
  'human_premium_services',
  'pr_authority',
] as const satisfies readonly SideHustleFamily[]

export type SideHustleServiceTemplateFamily =
  (typeof SIDE_HUSTLE_SERVICE_TEMPLATE_FAMILIES)[number]

export type SideHustleServiceTemplateScope = {
  id: string
  title: string
  description: string
}

export type SideHustleServiceTemplateCriterion = {
  id: string
  description: string
  required: boolean
}

export type SideHustleServiceTemplate = {
  family: SideHustleServiceTemplateFamily
  templateId: string
  label: string
  outcomePromise: string
  scopeItems: readonly SideHustleServiceTemplateScope[]
  acceptanceCriteria: readonly SideHustleServiceTemplateCriterion[]
}

export type TemplatedCommercialWorkOrderDraft = {
  opportunityId: string
  id: string
  ventureId?: string
  customerRef: string
  title: string
  outcomePromise: string
  scopeItems: CommercialWorkOrderScopeItem[]
  acceptanceCriteria: CommercialWorkOrderAcceptanceCriterion[]
  price: {
    amount: number
    currency: string
    cadence: CommercialWorkOrderPriceCadence
  }
  evidenceRefs: string[]
  createdAt?: string
}

const template = (
  family: SideHustleServiceTemplateFamily,
  label: string,
  outcomePromise: string,
  scopeItems: readonly SideHustleServiceTemplateScope[],
  acceptanceCriteria: readonly SideHustleServiceTemplateCriterion[],
): SideHustleServiceTemplate => Object.freeze({
  family,
  templateId: `side-hustle-service:${family}:v1`,
  label,
  outcomePromise,
  scopeItems: Object.freeze(scopeItems.map((item) => Object.freeze({ ...item }))),
  acceptanceCriteria: Object.freeze(acceptanceCriteria.map((item) => Object.freeze({ ...item }))),
})

export const SIDE_HUSTLE_SERVICE_TEMPLATES: Readonly<
  Record<SideHustleServiceTemplateFamily, SideHustleServiceTemplate>
> = Object.freeze({
  ai_business_implementation: template(
    'ai_business_implementation',
    'AI implementation engagement',
    'Implement an agreed AI-assisted business workflow with documented baseline, operator handoff, and acceptance evidence.',
    [
      { id: 'discovery', title: 'Workflow discovery', description: 'Document the current workflow, pain, baseline, stakeholders, and constraints.' },
      { id: 'implementation', title: 'Implementation', description: 'Configure or build the approved AI-assisted workflow within the agreed scope.' },
      { id: 'handoff', title: 'Operator handoff', description: 'Deliver runbook, ownership notes, and rollback or manual fallback instructions.' },
    ],
    [
      { id: 'baseline-approved', description: 'Customer accepts the documented workflow baseline and target outcome.', required: true },
      { id: 'workflow-demonstrated', description: 'The implemented workflow completes the agreed representative task.', required: true },
      { id: 'handoff-accepted', description: 'Runbook and operator handoff are accepted.', required: true },
    ],
  ),

  business_automation: template(
    'business_automation',
    'Business automation engagement',
    'Automate an agreed repetitive workflow with measurable cycle-time or error reduction and a tested fallback path.',
    [
      { id: 'audit', title: 'Automation audit', description: 'Map triggers, inputs, decisions, handoffs, exceptions, and baseline performance.' },
      { id: 'automation', title: 'Automation build', description: 'Implement the approved workflow automation with bounded permissions.' },
      { id: 'qa', title: 'Failure and rollback QA', description: 'Exercise representative failures, rollback, retry, and manual exception handling.' },
    ],
    [
      { id: 'happy-path', description: 'The approved happy path completes successfully.', required: true },
      { id: 'failure-path', description: 'A representative failure is recovered or safely routed for manual handling.', required: true },
      { id: 'baseline-delta', description: 'Before/after operating evidence is captured.', required: true },
    ],
  ),

  business_systems: template(
    'business_systems',
    'Business systems installation',
    'Install and document an agreed operating system, integration, or business stack with tested ownership and acceptance criteria.',
    [
      { id: 'requirements', title: 'Requirements and architecture', description: 'Capture requirements, systems, users, data boundaries, and success criteria.' },
      { id: 'installation', title: 'Installation and integration', description: 'Configure the approved systems and integrations.' },
      { id: 'acceptance', title: 'Acceptance and operating handoff', description: 'Validate the installed stack and deliver operator documentation.' },
    ],
    [
      { id: 'requirements-met', description: 'Required functions are present and demonstrable.', required: true },
      { id: 'access-boundaries', description: 'Access and authority boundaries are documented and accepted.', required: true },
      { id: 'operator-handoff', description: 'The customer accepts the operating handoff.', required: true },
    ],
  ),

  lead_generation_growth: template(
    'lead_generation_growth',
    'Lead generation and growth engagement',
    'Deliver an agreed volume and quality of attributable prospect or lead evidence with documented qualification rules and handoff.',
    [
      { id: 'icp', title: 'ICP and qualification', description: 'Define buyer, exclusions, qualification criteria, and evidence requirements.' },
      { id: 'research', title: 'Prospect research', description: 'Build evidence-backed prospect records using approved sources.' },
      { id: 'handoff', title: 'Qualified lead handoff', description: 'Deliver qualified records and attribution evidence through the agreed customer handoff.' },
    ],
    [
      { id: 'qualification', description: 'Every accepted lead satisfies the agreed qualification rules.', required: true },
      { id: 'provenance', description: 'Required source/provenance evidence is attached.', required: true },
      { id: 'handoff', description: 'Customer accepts the delivered lead package.', required: true },
    ],
  ),

  ai_discovery_seo: template(
    'ai_discovery_seo',
    'AI discovery / SEO engagement',
    'Improve an agreed discoverability baseline with auditable site changes and measured search, citation, traffic, or conversion evidence.',
    [
      { id: 'baseline', title: 'Discovery baseline', description: 'Capture current search/AI discovery, technical, content, and conversion baseline.' },
      { id: 'implementation', title: 'Discovery implementation', description: 'Apply approved technical, content, structured-data, and AI-discovery changes.' },
      { id: 'measurement', title: 'Observation and measurement', description: 'Measure agreed query, citation, traffic, or conversion observations after implementation.' },
    ],
    [
      { id: 'changes-live', description: 'Approved changes are deployed and observable.', required: true },
      { id: 'measurement-bound', description: 'Before/after evidence is linked to the engagement.', required: true },
      { id: 'customer-accepted', description: 'Customer accepts the implementation and report.', required: true },
    ],
  ),

  content_social: template(
    'content_social',
    'Content and social operations',
    'Produce and deliver an approved content package or publishing cycle with provider receipts, analytics, and business-outcome attribution where available.',
    [
      { id: 'strategy', title: 'Content strategy', description: 'Define audience, platform, format, message, cadence, and measurement goal.' },
      { id: 'production', title: 'Content production', description: 'Create the approved platform-native content package.' },
      { id: 'delivery', title: 'Delivery and analytics', description: 'Deliver or publish through governed channels and capture provider/performance evidence.' },
    ],
    [
      { id: 'creative-approved', description: 'The exact content package is approved or accepted by the customer.', required: true },
      { id: 'delivery-evidence', description: 'Delivery or publishing evidence is recorded.', required: true },
      { id: 'analytics-evidence', description: 'Available performance observations are attached.', required: false },
    ],
  ),

  creative_advertising: template(
    'creative_advertising',
    'Creative and advertising engagement',
    'Deliver approved creative variants tied to an agreed campaign or test plan with measurable contribution evidence where available.',
    [
      { id: 'brief', title: 'Creative brief', description: 'Capture offer, audience, platform, constraints, proof, and success metric.' },
      { id: 'variants', title: 'Creative variants', description: 'Produce the approved variant set with provenance and review evidence.' },
      { id: 'measurement', title: 'Campaign measurement', description: 'Bind creative IDs to provider/campaign observations and contribution evidence.' },
    ],
    [
      { id: 'brief-met', description: 'Creative satisfies the approved brief and required rights/provenance.', required: true },
      { id: 'variants-delivered', description: 'The agreed variants are delivered.', required: true },
      { id: 'measurement-linked', description: 'Campaign measurement lineage is linked when media is run.', required: false },
    ],
  ),

  media_production: template(
    'media_production',
    'Media production job',
    'Deliver the agreed media outputs through the Director review/final pipeline with provenance, revision, delivery, and customer acceptance evidence.',
    [
      { id: 'brief', title: 'Production brief', description: 'Bind source rights, requested outputs, due date, revision limit, and technical specifications.' },
      { id: 'production', title: 'Production and review', description: 'Produce outputs through the governed Director generation/review pipeline.' },
      { id: 'finals', title: 'Final delivery', description: 'Deliver final approved assets and associated provenance evidence.' },
    ],
    [
      { id: 'spec-met', description: 'Final outputs satisfy the agreed technical and creative specifications.', required: true },
      { id: 'rights-provenance', description: 'Required source-rights and provenance evidence is present.', required: true },
      { id: 'final-accepted', description: 'Customer accepts the final deliverables.', required: true },
    ],
  ),

  creator_monetization: template(
    'creator_monetization',
    'Creator monetization engagement',
    'Implement and measure an agreed monetization lane around a creator property with attributable commercial evidence.',
    [
      { id: 'inventory', title: 'Monetization inventory', description: 'Document audience assets, offers, sponsor/affiliate/product/member options, and constraints.' },
      { id: 'activation', title: 'Monetization activation', description: 'Launch the approved bounded monetization test through owning domains.' },
      { id: 'economics', title: 'Revenue attribution', description: 'Reconcile attributable revenue, reversals/refunds, costs, and effort.' },
    ],
    [
      { id: 'lane-activated', description: 'At least one approved monetization lane is activated.', required: true },
      { id: 'attribution', description: 'Commercial observations are attributable to the creator property.', required: true },
      { id: 'customer-accepted', description: 'Customer accepts the delivery/report when this is a service engagement.', required: false },
    ],
  ),

  drop_servicing: template(
    'drop_servicing',
    'Drop servicing engagement',
    'Deliver an agreed client outcome through governed internal/external fulfillment with provider assignment, QA, acceptance, and margin evidence.',
    [
      { id: 'scope', title: 'Client scope', description: 'Lock the client outcome, deliverables, SLA, acceptance criteria, and exclusions.' },
      { id: 'routing', title: 'Fulfillment routing', description: 'Route scope to approved operators/providers without granting automatic external authority.' },
      { id: 'qa', title: 'QA and customer delivery', description: 'Verify fulfilled work, manage rework if needed, and deliver to the customer.' },
    ],
    [
      { id: 'scope-met', description: 'All required scope items are delivered.', required: true },
      { id: 'qa-passed', description: 'Required QA evidence passes.', required: true },
      { id: 'customer-accepted', description: 'Customer accepts the delivered work.', required: true },
    ],
  ),

  boring_business_services: template(
    'boring_business_services',
    'Repeatable business service',
    'Deliver a standardized back-office, spreadsheet, bookkeeping, reporting, or administrative outcome with QA and acceptance evidence.',
    [
      { id: 'intake', title: 'Input intake', description: 'Capture source data, required output, turnaround, exclusions, and privacy constraints.' },
      { id: 'processing', title: 'Standardized processing', description: 'Perform the documented service workflow.' },
      { id: 'qa', title: 'QA and delivery', description: 'Run the defined QA checks and deliver the output.' },
    ],
    [
      { id: 'inputs-accounted', description: 'Required source inputs are accounted for.', required: true },
      { id: 'qa-passed', description: 'Documented QA checks pass.', required: true },
      { id: 'delivery-accepted', description: 'Customer accepts the output.', required: true },
    ],
  ),

  research_services: template(
    'research_services',
    'Research service engagement',
    'Deliver a provenance-rich research package that answers the agreed question with source quality, uncertainty, and acceptance evidence.',
    [
      { id: 'brief', title: 'Research brief', description: 'Lock the question, scope, exclusions, jurisdictions/time window, and evidence standard.' },
      { id: 'research', title: 'Evidence collection and synthesis', description: 'Collect, reconcile, and synthesize evidence with source provenance.' },
      { id: 'report', title: 'Research deliverable', description: 'Deliver findings, uncertainty, citations, and follow-up recommendations.' },
    ],
    [
      { id: 'question-answered', description: 'The agreed research question is directly addressed.', required: true },
      { id: 'provenance-complete', description: 'Required claims are supported by traceable evidence.', required: true },
      { id: 'report-accepted', description: 'Customer accepts the deliverable.', required: true },
    ],
  ),

  procurement_subcontracting: template(
    'procurement_subcontracting',
    'Procurement / subcontracting pursuit support',
    'Deliver an evidence-backed opportunity, prime/work-package/provider match, and governed pursuit package without bypassing bid, outreach, or signature controls.',
    [
      { id: 'opportunity', title: 'Opportunity verification', description: 'Verify the public opportunity/award context, lifecycle, requirements, and timing.' },
      { id: 'matching', title: 'Prime and subcontractor matching', description: 'Build evidence-backed prime/work-package/provider matches.' },
      { id: 'pursuit', title: 'Pursuit package', description: 'Prepare the governed outreach/teaming/quote package for authorized execution.' },
    ],
    [
      { id: 'requirements-grounded', description: 'The pursuit package is grounded in verified requirement evidence.', required: true },
      { id: 'match-grounded', description: 'Prime/provider match rationale is supported by evidence.', required: true },
      { id: 'authority-preserved', description: 'No bid, contact, signature, or spend authority is implied by the delivery.', required: true },
    ],
  ),

  website_revenue_systems: template(
    'website_revenue_systems',
    'Website revenue system engagement',
    'Deploy or improve an agreed website revenue stack with CRM/analytics lineage, rollback evidence, and measured conversion impact.',
    [
      { id: 'baseline', title: 'Revenue baseline', description: 'Capture traffic, funnel, conversion, CRM, analytics, and technical baseline.' },
      { id: 'deployment', title: 'Revenue-system deployment', description: 'Implement the approved site, CRM, analytics, or conversion changes.' },
      { id: 'measurement', title: 'Conversion measurement', description: 'Measure post-deployment outcomes against the agreed baseline.' },
    ],
    [
      { id: 'deployment-accepted', description: 'The agreed changes are deployed and accepted.', required: true },
      { id: 'rollback-documented', description: 'Rollback or recovery path is documented.', required: true },
      { id: 'measurement-attached', description: 'Before/after conversion observations are attached when enough time has elapsed.', required: false },
    ],
  ),

  human_premium_services: template(
    'human_premium_services',
    'Human premium service engagement',
    'Coordinate an explicitly human-delivered premium service with clear intake, preparation, delivery, and customer acceptance evidence.',
    [
      { id: 'intake', title: 'Client intake', description: 'Capture goals, requirements, scheduling constraints, and service boundaries.' },
      { id: 'prep', title: 'Jhadina-assisted preparation', description: 'Prepare research, materials, checklists, or QA support for the human operator.' },
      { id: 'delivery', title: 'Human delivery and follow-up', description: 'Record explicit human delivery, follow-up, and acceptance evidence.' },
    ],
    [
      { id: 'human-delivery', description: 'Required human delivery is explicitly recorded.', required: true },
      { id: 'scope-met', description: 'The agreed service scope is completed.', required: true },
      { id: 'customer-accepted', description: 'Customer accepts the completed service.', required: true },
    ],
  ),

  pr_authority: template(
    'pr_authority',
    'PR / authority-building engagement',
    'Deliver legitimate authority-building research, content, outreach preparation, and placement/discovery evidence without fabricated proof.',
    [
      { id: 'positioning', title: 'Authority positioning', description: 'Define expertise, proof, audience, claims, and prohibited/fabricated-proof boundaries.' },
      { id: 'assets', title: 'Authority assets', description: 'Create the approved media/contact/content package with source evidence.' },
      { id: 'placement', title: 'Placement/discovery tracking', description: 'Track governed outreach or organic placement/discovery evidence and resulting traffic.' },
    ],
    [
      { id: 'proof-grounded', description: 'Claims and proof used in the package are evidence-backed.', required: true },
      { id: 'assets-delivered', description: 'The agreed authority assets are delivered.', required: true },
      { id: 'placement-evidence', description: 'Placement/discovery evidence is attached when placement activity occurs.', required: false },
    ],
  ),
})

export function isSideHustleServiceTemplateFamily(
  family: SideHustleFamily,
): family is SideHustleServiceTemplateFamily {
  return (SIDE_HUSTLE_SERVICE_TEMPLATE_FAMILIES as readonly SideHustleFamily[]).includes(family)
}

export function getSideHustleServiceTemplate(
  family: SideHustleFamily,
): SideHustleServiceTemplate {
  if (!isSideHustleServiceTemplateFamily(family)) {
    throw new Error(`Side Hustle family does not use the service work-order template runtime: ${family}`)
  }
  return SIDE_HUSTLE_SERVICE_TEMPLATES[family]
}

export function buildSideHustleServiceWorkOrderDraft(input: {
  opportunity: Opportunity
  id: string
  ventureId?: string
  customerRef: string
  price: {
    amount: number
    currency: string
    cadence: CommercialWorkOrderPriceCadence
  }
  evidenceRefs: string[]
  createdAt?: string
  title?: string
  outcomePromise?: string
}): TemplatedCommercialWorkOrderDraft {
  const profile = input.opportunity.metadata?.sideHustleProfile
  if (!isSideHustleProfile(profile)) {
    throw new Error('Templated Side Hustle work order requires a canonical sideHustleProfile')
  }
  const serviceTemplate = getSideHustleServiceTemplate(profile.family)
  const evidenceRefs = unique([
    ...input.evidenceRefs,
    `template:${serviceTemplate.templateId}`,
    `opportunity:${input.opportunity.id}`,
  ])
  if (!evidenceRefs.length) throw new Error('Templated Side Hustle work order requires evidence')
  requireText(input.id, 'workOrder.id')
  requireText(input.customerRef, 'workOrder.customerRef')

  return {
    opportunityId: input.opportunity.id,
    id: input.id.trim(),
    ventureId: input.ventureId?.trim() || undefined,
    customerRef: input.customerRef.trim(),
    title: input.title?.trim() || serviceTemplate.label,
    outcomePromise: input.outcomePromise?.trim() || serviceTemplate.outcomePromise,
    scopeItems: serviceTemplate.scopeItems.map((item) => ({
      ...item,
      evidenceRefs: [...evidenceRefs, `template-scope:${serviceTemplate.templateId}:${item.id}`],
    })),
    acceptanceCriteria: serviceTemplate.acceptanceCriteria.map((criterion) => ({ ...criterion })),
    price: {
      amount: input.price.amount,
      currency: input.price.currency,
      cadence: input.price.cadence,
    },
    evidenceRefs,
    createdAt: input.createdAt,
  }
}

function requireText(value: string, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
  return value.trim()
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
